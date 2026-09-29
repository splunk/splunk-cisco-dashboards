#!/usr/bin/env python3
"""Read-only, fixed-window comparison of changed Searchbase SPL against a Git ref.

Uses the existing operational validator's HTTP client. Credentials come from the
environment; output contains counts/timings, never event contents or credentials.
Empty-result parity is reported separately and is not populated qualification.
"""
import argparse
import json
import math
import os
from pathlib import Path
import re
import subprocess
import time

from validate_operational_search_surfaces import basic_request, load_conf, parse_conf_text, UNSAFE_RE

CONF = "packages/splunk-cisco-dashboards/src/main/resources/splunk/default/searchbase.conf"


def equivalent(left, right):
    if isinstance(left, dict) and isinstance(right, dict):
        return left.keys() == right.keys() and all(equivalent(left[k], right[k]) for k in left)
    if isinstance(left, list) and isinstance(right, list):
        return len(left) == len(right) and all(equivalent(a, b) for a, b in zip(left, right))
    try:
        return math.isclose(float(left), float(right), rel_tol=1e-9, abs_tol=1e-9)
    except (ValueError, TypeError):
        return left == right


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-ref", default="HEAD")
    parser.add_argument("--window-seconds", type=int, default=86400)
    parser.add_argument("--end-lag-seconds", type=int, default=120)
    parser.add_argument("--match", default="")
    parser.add_argument("--summaries-only", action="store_true",
                        help="Test candidate acceleration explicitly without changing saved macros")
    parser.add_argument("--intermediate", action="store_true",
                        help="Compare first aggregation before downstream thresholds can hide mismatches")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    before = parse_conf_text(subprocess.check_output(
        ["git", "show", f"{args.base_ref}:{CONF}"], cwd=root, text=True))
    after = load_conf(root / CONF)
    comparison_clock = int(time.time())
    end = comparison_clock - args.end_lag_seconds
    failures = 0
    for name, record in after.items():
        old = before.get(name, {}).get("search")
        new = record.get("search")
        if not old or not new or old == new or args.match not in name:
            continue
        rows, elapsed, messages = [], [], []
        for candidate, query in enumerate((old, new)):
            # Freeze display/fallback timestamps identically for sequential jobs.
            query = re.sub(r"\bnow\(\)", str(comparison_clock), query)
            if candidate and args.summaries_only:
                query = query.replace("`summariesonly`", "summariesonly=true allow_old_summaries=false")
            if args.intermediate:
                lines = query.splitlines()
                stop = next((i for i, line in enumerate(lines)
                             if line.startswith("| stats ") or line.startswith("| tstats ")), None)
                if stop is not None:
                    # Keep the new model-field rename so schemas can be compared.
                    if stop + 1 < len(lines) and lines[stop + 1].startswith("| rename "):
                        stop += 1
                    query = "\n".join(lines[:stop + 1])
            if UNSAFE_RE.search(query):
                raise ValueError(f"Write-capable SPL rejected: {name}")
            start = time.monotonic()
            status, body = basic_request(
                os.environ["SPLUNK_BASE_URL"], os.environ["SPLUNK_USERNAME"],
                os.environ["SPLUNK_PASSWORD"],
                "/servicesNS/admin/splunk-cisco-dashboards/search/v2/jobs",
                fields={"search": query if query.startswith("|") else "search " + query,
                        "earliest_time": str(end - args.window_seconds), "latest_time": str(end),
                        "exec_mode": "oneshot", "output_mode": "json", "count": "0", "max_time": "45"},
                timeout=55, verify_ssl=False)
            elapsed.append(round(time.monotonic() - start, 3))
            if status != 200 or not isinstance(body, dict) or body.get("preview"):
                raise RuntimeError(f"Incomplete/failed search {name}: HTTP {status}")
            messages.extend(body.get("messages", []))
            rows.append(body.get("results", []))
        # Row order is part of the comparison, including ordered top-N outputs.
        unexpected = [message for message in messages if message !=
                      {"type": "INFO", "text": "No matching fields exist."}]
        match = equivalent(*rows) and not unexpected
        failures += not match
        print(json.dumps({"stanza": name, "seconds": elapsed, "rows": list(map(len, rows)),
                          "parity": match, "nonempty_result": bool(rows[0]),
                          "messages": messages, "intermediate": args.intermediate}), flush=True)
    return int(failures > 0)


if __name__ == "__main__":
    raise SystemExit(main())
