#!/usr/bin/env python3
"""
Validate Cisco Catalyst DM / harvest stanzas in searchbase.conf.

Runs without restarting Splunk. When live prerequisites are not met
(splunk-cisco-dashboards namespace or Cisco_Catalyst_App DM unavailable),
static checks still run and live dispatch is skipped with a clear reason.

Environment (live dispatch only):

    SPLUNK_BASE_URL=https://localhost:8089
    SPLUNK_USERNAME=...
    SPLUNK_PASSWORD=...
    SPLUNK_OWNER=codex          # optional, default codex
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Iterable
from urllib.error import HTTPError, URLError

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from audit_searchbase_quality import MACROS, SEARCHBASE, _MACRO_RE, parse_conf, parse_macros  # noqa: E402
from validate_searchbase_live import (  # noqa: E402
    SIDE_EFFECT_RE,
    ValidationResult,
    describe_http_error,
    expand_local_macros,
    parse_macro_definitions,
    post_oneshot,
)

CATALYST_APP = "cisco-catalyst-app"
SEARCHBASE_APP = "splunk-cisco-dashboards"
DM_NAME = "Cisco_Catalyst_App"
TOKEN_RE = re.compile(r"(?<!\\)\$[A-Za-z_][A-Za-z0-9_]*\$")
DM_PROBE = f"| tstats count FROM datamodel={DM_NAME}"


@dataclass
class PrerequisiteReport:
    ok: bool
    checks: list[dict[str, str]] = field(default_factory=list)
    dispatch_app: str = SEARCHBASE_APP
    dispatch_owner: str = "codex"


@dataclass
class StaticIssue:
    stanza: str
    line: int
    severity: str
    detail: str


def is_catalyst_stanza(stanza) -> bool:
    if stanza.name.startswith("catalyst_harvest_"):
        return True
    spl = stanza.search or ""
    return DM_NAME in spl


def static_validate(stanza) -> list[StaticIssue]:
    issues: list[StaticIssue] = []
    spl = (stanza.search or "").strip()
    if not spl:
        issues.append(StaticIssue(stanza.name, stanza.line_start, "error", "missing search"))
        return issues

    if TOKEN_RE.search(spl):
        issues.append(
            StaticIssue(
                stanza.name,
                stanza.line_start,
                "error",
                "dashboard token placeholder in search",
            )
        )

    uses_dm = DM_NAME in spl
    ctx = stanza.fields.get("dispatch_context", "").strip()
    force = stanza.fields.get("dispatch_context_force", "").strip()

    if uses_dm:
        if ctx != CATALYST_APP:
            issues.append(
                StaticIssue(
                    stanza.name,
                    stanza.line_start,
                    "error",
                    f"DM search must set dispatch_context = {CATALYST_APP}",
                )
            )
        if force != "0":
            issues.append(
                StaticIssue(
                    stanza.name,
                    stanza.line_start,
                    "warn",
                    "DM search should set dispatch_context_force = 0",
                )
            )
        if "`summariesonly`" not in spl and "summariesonly" not in spl:
            issues.append(
                StaticIssue(
                    stanza.name,
                    stanza.line_start,
                    "warn",
                    "DM tstats should use `summariesonly` macro from cisco-catalyst-app",
                )
            )

    if stanza.name.startswith("catalyst_harvest_"):
        if ctx != CATALYST_APP:
            issues.append(
                StaticIssue(
                    stanza.name,
                    stanza.line_start,
                    "error",
                    f"harvest stanza must set dispatch_context = {CATALYST_APP}",
                )
            )

    if SIDE_EFFECT_RE.search(spl):
        issues.append(
            StaticIssue(
                stanza.name,
                stanza.line_start,
                "info",
                "side-effecting search (skipped for live dispatch)",
            )
        )

    return issues


def probe_namespace(
    base_url: str,
    owner: str,
    app: str,
    username: str,
    password: str,
    verify_ssl: bool,
    timeout: int,
) -> tuple[bool, str]:
    try:
        messages, rows = post_oneshot(
            base_url,
            owner,
            app,
            username,
            password,
            DM_PROBE,
            "-24h",
            "now",
            timeout,
            verify_ssl,
        )
        bad = [m for m in messages if m.get("type") in {"ERROR", "FATAL"}]
        if bad:
            return False, bad[0].get("text", "unknown error")
        return True, f"ok (sample count={rows[0].get('count') if rows else 'n/a'})"
    except HTTPError as exc:
        return False, describe_http_error(exc)
    except (URLError, TimeoutError, json.JSONDecodeError) as exc:
        return False, str(exc)


def check_prerequisites(
    base_url: str,
    username: str,
    password: str,
    owner: str,
    verify_ssl: bool,
    timeout: int,
) -> PrerequisiteReport:
    report = PrerequisiteReport(ok=False, dispatch_owner=owner)
    candidates = [
        (owner, SEARCHBASE_APP),
        ("nobody", SEARCHBASE_APP),
    ]
    for cand_owner, cand_app in candidates:
        ok, detail = probe_namespace(
            base_url, cand_owner, cand_app, username, password, verify_ssl, timeout
        )
        report.checks.append(
            {
                "owner": cand_owner,
                "app": cand_app,
                "status": "pass" if ok else "fail",
                "detail": detail,
            }
        )
        if ok:
            report.ok = True
            report.dispatch_app = cand_app
            report.dispatch_owner = cand_owner
            break
    return report


def dispatch_app_for(stanza, prereqs: PrerequisiteReport) -> tuple[str, str]:
    ctx = stanza.fields.get("dispatch_context", "").strip()
    force = stanza.fields.get("dispatch_context_force", "").strip().lower()
    if ctx and force in {"1", "true", "yes"}:
        return prereqs.dispatch_owner, ctx
    return prereqs.dispatch_owner, prereqs.dispatch_app


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--stanza", action="append", help="Only validate matching stanza name.")
    parser.add_argument("--pilot", action="store_true", help="First 10 runnable catalyst stanzas only.")
    parser.add_argument("--limit", type=int, help="Max live dispatches.")
    parser.add_argument("--offset", type=int, default=0)
    parser.add_argument("--prereqs-only", action="store_true")
    parser.add_argument("--static-only", action="store_true", help="Skip live Splunk dispatch.")
    parser.add_argument("--earliest", default="-24h")
    parser.add_argument("--latest", default="now")
    parser.add_argument("--timeout", type=int, default=45)
    parser.add_argument(
        "--results-file",
        default=str(ROOT / "docs/catalyst_dm_validation_report.json"),
    )
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    base_url = os.environ.get("SPLUNK_BASE_URL", "https://localhost:8089")
    username = os.environ.get("SPLUNK_USERNAME")
    password = os.environ.get("SPLUNK_PASSWORD")
    owner = os.environ.get("SPLUNK_OWNER", "codex")
    verify_ssl = os.environ.get("SPLUNK_VERIFY_SSL", "false").lower() in {"1", "true", "yes"}

    stanza_filter = set(args.stanza or [])
    macros = parse_macros(MACROS)
    macro_definitions = parse_macro_definitions()
    stanzas = [s for s in parse_conf(SEARCHBASE) if is_catalyst_stanza(s)]
    if stanza_filter:
        stanzas = [s for s in stanzas if s.name in stanza_filter or s.search_name in stanza_filter]

    static_issues: list[StaticIssue] = []
    for stanza in stanzas:
        static_issues.extend(static_validate(stanza))

    prereqs = PrerequisiteReport(ok=False)
    live_results: list[ValidationResult] = []
    live_skipped_reason = ""

    if not args.static_only:
        if not username or not password:
            live_skipped_reason = "SPLUNK_USERNAME and SPLUNK_PASSWORD not set"
        else:
            prereqs = check_prerequisites(
                base_url, username, password, owner, verify_ssl, args.timeout
            )
            if args.prereqs_only:
                pass
            elif not prereqs.ok:
                live_skipped_reason = (
                    "live prerequisites failed: no namespace can run "
                    f"datamodel={DM_NAME} (see checks in report)"
                )
            else:
                runnable = 0
                dispatched = 0
                limit = 10 if args.pilot and args.limit is None else args.limit
                for stanza in stanzas:
                    if stanza.fields.get("disabled", "0").strip() == "1":
                        live_results.append(
                            ValidationResult(
                                stanza.name,
                                stanza.search_name,
                                stanza.line_start,
                                "skip",
                                "disabled search",
                            )
                        )
                        continue
                    spl = stanza.search.strip()
                    if not spl or SIDE_EFFECT_RE.search(spl):
                        continue
                    missing_macros = sorted(m for m in set(_MACRO_RE.findall(spl)) if m not in macros)
                    if missing_macros:
                        live_results.append(
                            ValidationResult(
                                stanza.name,
                                stanza.search_name,
                                stanza.line_start,
                                "skip",
                                "missing macro(s): " + ", ".join(missing_macros),
                            )
                        )
                        continue
                    if runnable < args.offset:
                        runnable += 1
                        continue
                    if limit is not None and dispatched >= limit:
                        break
                    runnable += 1
                    dispatched += 1
                    spl_to_run = expand_local_macros(spl, macro_definitions)
                    app_owner, app_name = dispatch_app_for(stanza, prereqs)
                    start = time.monotonic()
                    try:
                        messages, rows = post_oneshot(
                            base_url,
                            app_owner,
                            app_name,
                            username,
                            password,
                            spl_to_run,
                            args.earliest,
                            args.latest,
                            args.timeout,
                            verify_ssl,
                        )
                        elapsed = time.monotonic() - start
                        bad = [m for m in messages if m.get("type") in {"ERROR", "FATAL"}]
                        if bad:
                            live_results.append(
                                ValidationResult(
                                    stanza.name,
                                    stanza.search_name,
                                    stanza.line_start,
                                    "fail",
                                    "; ".join(m.get("text", "") for m in bad),
                                    len(rows),
                                    elapsed,
                                    sorted(rows[0].keys()) if rows else [],
                                )
                            )
                        else:
                            live_results.append(
                                ValidationResult(
                                    stanza.name,
                                    stanza.search_name,
                                    stanza.line_start,
                                    "pass",
                                    "ok" if rows else "ok (no rows returned)",
                                    len(rows),
                                    elapsed,
                                    sorted(rows[0].keys()) if rows else [],
                                )
                            )
                    except HTTPError as exc:
                        elapsed = time.monotonic() - start
                        live_results.append(
                            ValidationResult(
                                stanza.name,
                                stanza.search_name,
                                stanza.line_start,
                                "fail",
                                describe_http_error(exc),
                                0,
                                elapsed,
                            )
                        )
                    except (URLError, TimeoutError, json.JSONDecodeError) as exc:
                        elapsed = time.monotonic() - start
                        live_results.append(
                            ValidationResult(
                                stanza.name,
                                stanza.search_name,
                                stanza.line_start,
                                "fail",
                                str(exc),
                                0,
                                elapsed,
                            )
                        )

    payload = {
        "catalyst_stanza_count": len(stanzas),
        "static": {
            "errors": sum(1 for i in static_issues if i.severity == "error"),
            "warnings": sum(1 for i in static_issues if i.severity == "warn"),
            "issues": [asdict(i) for i in static_issues],
        },
        "prerequisites": asdict(prereqs),
        "live_skipped_reason": live_skipped_reason,
        "live": [asdict(r) for r in live_results],
    }

    results_path = Path(args.results_file)
    results_path.parent.mkdir(parents=True, exist_ok=True)
    results_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")

    if args.json:
        print(json.dumps(payload, indent=2))
    else:
        print(f"catalyst stanzas: {len(stanzas)}")
        print(
            f"static: errors={payload['static']['errors']} "
            f"warnings={payload['static']['warnings']}"
        )
        if live_skipped_reason:
            print(f"live: SKIPPED — {live_skipped_reason}")
        elif args.prereqs_only:
            print("live: prereqs-only mode")
            for check in prereqs.checks:
                print(f"  {check['owner']}/{check['app']}: {check['status']} — {check['detail']}")
        else:
            counts: dict[str, int] = {}
            for result in live_results:
                counts[result.status] = counts.get(result.status, 0) + 1
            print("live:", ", ".join(f"{k}={v}" for k, v in sorted(counts.items())))
            for result in live_results:
                if result.status != "pass":
                    print(f"  {result.status.upper()} {result.search_name}: {result.detail}")
        print(f"report: {results_path}")

    static_failed = payload["static"]["errors"] > 0
    live_failed = any(r.status == "fail" for r in live_results)
    prereq_failed = not args.static_only and not args.prereqs_only and not prereqs.ok and not live_skipped_reason
    return 1 if static_failed or live_failed else (2 if prereq_failed else 0)


if __name__ == "__main__":
    raise SystemExit(main())
