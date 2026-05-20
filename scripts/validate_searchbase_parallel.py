#!/usr/bin/env python3
"""
Parallel version of validate_searchbase_live.py.

Dispatches every runnable stanza in searchbase.conf against Splunk's
/search/jobs/oneshot endpoint using a thread pool, streams JSONL progress
to disk so partial results survive interruption, and prints a triage
summary at the end.

Usage (env vars required by the underlying validator already work):

    SPLUNK_BASE_URL=https://localhost:8089 \
    SPLUNK_USERNAME=codex SPLUNK_PASSWORD=changeme \
    SPLUNK_VERIFY_SSL=false \
    python3 scripts/validate_searchbase_parallel.py \
      --workers 12 --timeout 20 --earliest=-24h --latest=now \
      --jsonl-out /tmp/searchbase-audit/full.jsonl
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import asdict
from pathlib import Path
from threading import Lock
from urllib.error import HTTPError, URLError

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from audit_searchbase_quality import (  # noqa: E402  (import after sys.path tweak)
    MACROS,
    SEARCHBASE,
    _MACRO_RE,
    parse_conf,
    parse_macros,
)
from validate_searchbase_live import (  # noqa: E402
    SIDE_EFFECT_RE,
    ValidationResult,
    describe_http_error,
    expand_local_macros,
    parse_macro_definitions,
    post_oneshot,
)


def _classify(stanza, macros, args, macro_definitions):
    """Return (skip_reason | None, spl_to_run)."""
    if not args.include_disabled and stanza.fields.get("disabled", "0").strip() == "1":
        return ("skip:disabled", "")
    spl = stanza.search.strip()
    if not spl:
        return ("skip:missing-search", "")
    missing = sorted(m for m in set(_MACRO_RE.findall(spl)) if m not in macros)
    if missing and not args.include_missing_macros:
        return (f"skip:missing-macro {','.join(missing)}", "")
    if SIDE_EFFECT_RE.search(spl) and not args.include_side_effects:
        return ("skip:side-effect", "")
    if args.no_expand_local_macros:
        return (None, spl)
    return (None, expand_local_macros(spl, macro_definitions))


def _run_one(stanza, spl, args, env):
    start = time.monotonic()
    try:
        messages, rows = post_oneshot(
            env["base_url"],
            env["owner"],
            env["app"],
            env["username"],
            env["password"],
            spl,
            args.earliest,
            args.latest,
            args.timeout,
            env["verify_ssl"],
        )
        elapsed = time.monotonic() - start
        bad = [m for m in messages if m.get("type") in {"ERROR", "FATAL"}]
        if bad:
            return ValidationResult(
                stanza.name,
                stanza.search_name,
                stanza.line_start,
                "fail",
                "; ".join(m.get("text", "") for m in bad)[:500],
                len(rows),
                elapsed,
                sorted(rows[0].keys()) if rows else [],
            )
        return ValidationResult(
            stanza.name,
            stanza.search_name,
            stanza.line_start,
            "pass",
            "ok" if rows else "ok (no rows returned)",
            len(rows),
            elapsed,
            sorted(rows[0].keys()) if rows else [],
        )
    except HTTPError as exc:
        return ValidationResult(
            stanza.name,
            stanza.search_name,
            stanza.line_start,
            "fail",
            describe_http_error(exc)[:500],
            0,
            time.monotonic() - start,
        )
    except (URLError, TimeoutError, json.JSONDecodeError) as exc:
        return ValidationResult(
            stanza.name,
            stanza.search_name,
            stanza.line_start,
            "fail",
            str(exc)[:500],
            0,
            time.monotonic() - start,
        )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--timeout", type=int, default=20)
    parser.add_argument("--earliest", default="-24h")
    parser.add_argument("--latest", default="now")
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--include-side-effects", action="store_true")
    parser.add_argument("--include-disabled", action="store_true")
    parser.add_argument("--include-missing-macros", action="store_true")
    parser.add_argument("--no-expand-local-macros", action="store_true")
    parser.add_argument("--jsonl-out", required=True)
    parser.add_argument("--summary-out", default=None)
    args = parser.parse_args()

    env = {
        "base_url": os.environ.get("SPLUNK_BASE_URL", "https://localhost:8089"),
        "username": os.environ["SPLUNK_USERNAME"],
        "password": os.environ["SPLUNK_PASSWORD"],
        "owner": os.environ.get("SPLUNK_OWNER", "admin"),
        "app": os.environ.get("SPLUNK_APP", "splunk-cisco-dashboards"),
        "verify_ssl": os.environ.get("SPLUNK_VERIFY_SSL", "false").lower() in {"1", "true", "yes"},
    }

    macros = parse_macros(MACROS)
    macro_definitions = parse_macro_definitions()
    stanzas = parse_conf(SEARCHBASE)

    runnable: list[tuple[object, str]] = []
    skipped: list[ValidationResult] = []
    for stanza in stanzas:
        reason, spl = _classify(stanza, macros, args, macro_definitions)
        if reason is not None:
            skipped.append(
                ValidationResult(stanza.name, stanza.search_name, stanza.line_start, "skip", reason)
            )
            continue
        runnable.append((stanza, spl))
        if args.limit is not None and len(runnable) >= args.limit:
            break

    print(f"stanzas={len(stanzas)}  runnable={len(runnable)}  skipped={len(skipped)}  workers={args.workers}", flush=True)

    Path(os.path.dirname(args.jsonl_out)).mkdir(parents=True, exist_ok=True)
    out_lock = Lock()
    with open(args.jsonl_out, "w", encoding="utf-8") as fh:
        for r in skipped:
            fh.write(json.dumps(asdict(r)) + "\n")
        fh.flush()

        completed = 0
        passed = 0
        failed = 0
        empty = 0
        t0 = time.monotonic()
        with ThreadPoolExecutor(max_workers=args.workers) as ex:
            futures = {ex.submit(_run_one, st, spl, args, env): st for (st, spl) in runnable}
            for fut in as_completed(futures):
                r = fut.result()
                with out_lock:
                    fh.write(json.dumps(asdict(r)) + "\n")
                    fh.flush()
                completed += 1
                if r.status == "pass":
                    passed += 1
                    if r.result_count == 0:
                        empty += 1
                elif r.status == "fail":
                    failed += 1
                if completed % 25 == 0 or completed == len(runnable):
                    el = time.monotonic() - t0
                    rate = completed / max(el, 0.001)
                    eta = (len(runnable) - completed) / max(rate, 0.001)
                    print(
                        f"  [{completed:>4}/{len(runnable)}] "
                        f"pass={passed} (empty={empty}) fail={failed}  "
                        f"rate={rate:.1f}/s  eta={eta:.0f}s",
                        flush=True,
                    )

    summary_lines = [
        f"runnable={len(runnable)} skipped={len(skipped)}",
        f"pass={passed} (empty={empty}) fail={failed}",
        f"elapsed_total_seconds={time.monotonic()-t0:.1f}",
    ]
    summary = "\n".join(summary_lines)
    print()
    print(summary)
    if args.summary_out:
        Path(args.summary_out).write_text(summary + "\n")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
