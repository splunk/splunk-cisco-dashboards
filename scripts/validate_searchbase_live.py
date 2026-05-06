#!/usr/bin/env python3
"""
Run searchbase.conf searches against Splunk for syntax/runtime validation.

Credentials are intentionally provided through environment variables:

    SPLUNK_BASE_URL=https://host:8089
    SPLUNK_USERNAME=...
    SPLUNK_PASSWORD=...

By default the validator skips searches with side effects such as
outputlookup/collect/delete. Use --include-side-effects only when you
intend to run those materializing searches.
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import re
import ssl
import sys
import time
from dataclasses import asdict, dataclass, field
from typing import Iterable
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, quote
from urllib.request import Request, urlopen

from audit_searchbase_quality import (
    MACROS,
    SEARCHBASE,
    _MACRO_RE,
    is_cisco_trend_candidate,
    parse_conf,
    parse_macros,
    tag_tokens,
)


SIDE_EFFECT_RE = re.compile(r"\b(outputlookup|collect|sendemail|script|delete)\b", re.I)


@dataclass
class ValidationResult:
    stanza: str
    search_name: str
    line: int
    status: str
    detail: str
    result_count: int = 0
    elapsed_seconds: float = 0.0
    result_fields: list[str] = field(default_factory=list)


def splunk_search_text(spl: str) -> str:
    spl = spl.strip()
    if spl.startswith("|") or re.match(r"^search\b", spl, re.I):
        return spl
    return "search " + spl


def parse_macro_definitions() -> dict[str, str]:
    definitions: dict[str, str] = {}
    for stanza in parse_conf(MACROS):
        if "(" in stanza.name:
            continue
        definition = stanza.fields.get("definition")
        if definition is not None:
            definitions[stanza.name] = definition.strip()
    return definitions


def expand_local_macros(spl: str, definitions: dict[str, str]) -> str:
    def replace(match: re.Match[str]) -> str:
        name = match.group(1)
        if name not in definitions:
            return match.group(0)
        return definitions[name]

    return _MACRO_RE.sub(replace, spl)


def describe_http_error(exc: HTTPError) -> str:
    body = exc.read().decode("utf-8", errors="replace")
    if body:
        try:
            payload = json.loads(body)
        except json.JSONDecodeError:
            return f"HTTP {exc.code}: {body[:500]}"
        messages = payload.get("messages") or []
        texts = [m.get("text", "") for m in messages if m.get("text")]
        if texts:
            return f"HTTP {exc.code}: " + "; ".join(texts)
        return f"HTTP {exc.code}: {body[:500]}"
    return f"HTTP {exc.code}: {exc.reason}"


def post_oneshot(
    base_url: str,
    owner: str,
    app: str,
    username: str,
    password: str,
    spl: str,
    earliest: str,
    latest: str,
    timeout: int,
    verify_ssl: bool,
) -> tuple[list[dict], list[dict]]:
    owner_q = quote(owner, safe="")
    app_q = quote(app, safe="")
    url = f"{base_url.rstrip('/')}/servicesNS/{owner_q}/{app_q}/search/jobs/oneshot"
    body = urlencode(
        {
            "search": splunk_search_text(spl),
            "earliest_time": earliest,
            "latest_time": latest,
            "output_mode": "json",
            "count": "1",
        }
    ).encode("utf-8")
    token = base64.b64encode(f"{username}:{password}".encode("utf-8")).decode("ascii")
    req = Request(
        url,
        data=body,
        headers={
            "Authorization": f"Basic {token}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        method="POST",
    )
    context = None if verify_ssl else ssl._create_unverified_context()
    with urlopen(req, timeout=timeout, context=context) as resp:
        data = json.loads(resp.read().decode("utf-8") or "{}")
    return data.get("messages", []), data.get("results", [])


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--stanza", action="append", help="Only validate matching stanza name.")
    parser.add_argument(
        "--tag",
        action="append",
        help="Only validate stanzas with this exact comma-separated tag token.",
    )
    parser.add_argument("--limit", type=int, help="Stop after N runnable searches.")
    parser.add_argument(
        "--offset",
        type=int,
        default=0,
        help="Skip N runnable searches after filters. Useful for batch/resume runs.",
    )
    parser.add_argument(
        "--sleep-between",
        type=float,
        default=0.0,
        help="Seconds to sleep between dispatched searches.",
    )
    parser.add_argument(
        "--results-file",
        help="Write JSON validation results to this path in addition to stdout summary.",
    )
    parser.add_argument("--earliest", default="-4h")
    parser.add_argument("--latest", default="now")
    parser.add_argument("--timeout", type=int, default=45)
    parser.add_argument(
        "--require-final-timechart",
        action="store_true",
        help="Fail selected searches that do not end with a metric-producing timechart.",
    )
    parser.add_argument(
        "--require-time-field",
        action="store_true",
        help="Fail selected searches when returned rows do not contain _time.",
    )
    parser.add_argument("--include-side-effects", action="store_true")
    parser.add_argument("--include-disabled", action="store_true")
    parser.add_argument("--include-missing-macros", action="store_true")
    parser.add_argument(
        "--no-expand-local-macros",
        action="store_true",
        help="Send backtick macros to Splunk instead of expanding local no-argument macros first.",
    )
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    base_url = os.environ.get("SPLUNK_BASE_URL", "https://localhost:8089")
    username = os.environ.get("SPLUNK_USERNAME")
    password = os.environ.get("SPLUNK_PASSWORD")
    owner = os.environ.get("SPLUNK_OWNER", "admin")
    app = os.environ.get("SPLUNK_APP", "splunk-cisco-dashboards")
    verify_ssl = os.environ.get("SPLUNK_VERIFY_SSL", "false").lower() in {"1", "true", "yes"}

    if not username or not password:
        print("SPLUNK_USERNAME and SPLUNK_PASSWORD are required.", file=sys.stderr)
        return 2

    stanza_filter = set(args.stanza or [])
    tag_filter = set(args.tag or [])
    macros = parse_macros(MACROS)
    macro_definitions = parse_macro_definitions()
    stanzas = parse_conf(SEARCHBASE)
    results: list[ValidationResult] = []
    runnable = 0
    dispatched = 0

    for stanza in stanzas:
        if stanza_filter and stanza.name not in stanza_filter and stanza.search_name not in stanza_filter:
            continue
        if tag_filter and not (tag_filter & tag_tokens(stanza.fields.get("tags", ""))):
            continue
        if not args.include_disabled and stanza.fields.get("disabled", "0").strip() == "1":
            results.append(
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
        if not spl:
            results.append(
                ValidationResult(stanza.name, stanza.search_name, stanza.line_start, "skip", "missing search")
            )
            continue
        if args.require_final_timechart and not is_cisco_trend_candidate(spl):
            results.append(
                ValidationResult(
                    stanza.name,
                    stanza.search_name,
                    stanza.line_start,
                    "fail",
                    "selected search does not end with a metric-producing timechart",
                )
            )
            continue

        missing_macros = sorted(m for m in set(_MACRO_RE.findall(spl)) if m not in macros)
        if missing_macros and not args.include_missing_macros:
            results.append(
                ValidationResult(
                    stanza.name,
                    stanza.search_name,
                    stanza.line_start,
                    "skip",
                    "missing macro(s): " + ", ".join(missing_macros),
                )
            )
            continue

        if SIDE_EFFECT_RE.search(spl) and not args.include_side_effects:
            results.append(
                ValidationResult(
                    stanza.name,
                    stanza.search_name,
                    stanza.line_start,
                    "skip",
                    "side-effecting search",
                )
            )
            continue

        if runnable < args.offset:
            runnable += 1
            continue

        if args.limit is not None and dispatched >= args.limit:
            break
        runnable += 1
        dispatched += 1
        spl_to_run = spl if args.no_expand_local_macros else expand_local_macros(spl, macro_definitions)

        start = time.monotonic()
        try:
            messages, rows = post_oneshot(
                base_url,
                owner,
                app,
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
                results.append(
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
            elif args.require_time_field and rows and "_time" not in rows[0]:
                results.append(
                    ValidationResult(
                        stanza.name,
                        stanza.search_name,
                        stanza.line_start,
                        "fail",
                        "returned row does not contain _time",
                        len(rows),
                        elapsed,
                        sorted(rows[0].keys()),
                    )
                )
            else:
                results.append(
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
            results.append(
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
            results.append(
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
        if args.sleep_between > 0 and (args.limit is None or dispatched < args.limit):
            time.sleep(args.sleep_between)

    if args.results_file:
        with open(args.results_file, "w", encoding="utf-8") as fh:
            json.dump([asdict(r) for r in results], fh, indent=2)
            fh.write("\n")

    if args.json:
        print(json.dumps([asdict(r) for r in results], indent=2))
    else:
        counts = {}
        for result in results:
            counts[result.status] = counts.get(result.status, 0) + 1
        print("validation status:", ", ".join(f"{k}={v}" for k, v in sorted(counts.items())))
        print(
            "result rows:",
            f"with_rows={sum(1 for r in results if r.result_count > 0)}",
            f"empty={sum(1 for r in results if r.result_count == 0 and r.status == 'pass')}",
        )
        for result in results:
            if result.status != "pass":
                print(f"{result.status.upper()} {result.line} {result.search_name}: {result.detail}")
    return 1 if any(r.status == "fail" for r in results) else 0


if __name__ == "__main__":
    raise SystemExit(main())
