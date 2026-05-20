#!/usr/bin/env python3
"""
Triage the JSONL output of validate_searchbase_parallel.py into:
  1. Hard failures (SPL/HTTP errors) — top priority
  2. Empty passes — search ran but returned no rows.
       Bucket each by primary sourcetype to identify systematic data gaps
       vs per-search filter problems.
  3. Skips — disabled, missing-macro, side-effect (informational)

Reads searchbase.conf to resolve sourcetypes per stanza.
"""
from __future__ import annotations
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SEARCHBASE = ROOT / "packages/splunk-cisco-dashboards/src/main/resources/splunk/default/searchbase.conf"


def parse_stanza_sourcetypes(path: Path) -> dict[str, list[str]]:
    sts: dict[str, list[str]] = {}
    cur = None
    cur_search = ""
    cur_search_active = False
    with path.open() as f:
        for line in f:
            stripped = line.rstrip("\n")
            m = re.match(r"^\[([^\]]+)\]\s*$", stripped)
            if m:
                if cur and cur_search:
                    sts[cur] = re.findall(r'sourcetype\s*=\s*"([^"]+)"', cur_search) + \
                               re.findall(r"sourcetype\s*=\s*([A-Za-z][\w:\.\-]+)", cur_search)
                cur = m.group(1)
                cur_search = ""
                cur_search_active = False
                continue
            if stripped.startswith("search ="):
                cur_search = stripped[len("search ="):].lstrip()
                cur_search_active = True
                continue
            if cur_search_active:
                if stripped.startswith(" ") or stripped.startswith("\t") or stripped == "":
                    cur_search += " " + stripped.strip()
                else:
                    cur_search_active = False
        if cur and cur_search:
            sts[cur] = re.findall(r'sourcetype\s*=\s*"([^"]+)"', cur_search) + \
                       re.findall(r"sourcetype\s*=\s*([A-Za-z][\w:\.\-]+)", cur_search)
    return sts


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: triage_validation.py <full.jsonl>", file=sys.stderr)
        return 2
    path = Path(sys.argv[1])
    rows = [json.loads(line) for line in path.read_text().splitlines() if line.strip()]
    by_status = defaultdict(list)
    for r in rows:
        by_status[r["status"]].append(r)

    fails = by_status.get("fail", [])
    passes = by_status.get("pass", [])
    skips = by_status.get("skip", [])
    empty = [r for r in passes if r["result_count"] == 0]
    nonempty = [r for r in passes if r["result_count"] > 0]

    print("=" * 80)
    print(f"TOTAL: {len(rows)}  |  pass={len(passes)}  fail={len(fails)}  skip={len(skips)}")
    print(f"PASSES: with-rows={len(nonempty)}  empty={len(empty)}")
    print("=" * 80)

    # --- 1. Failures
    print()
    print(f"## FAILURES ({len(fails)}) — search did not complete cleanly")
    print()
    for r in sorted(fails, key=lambda r: r["stanza"]):
        print(f"  [{r['stanza']}]  (line {r['line']})")
        print(f"    name : {r['search_name']}")
        print(f"    error: {r['detail']}")

    # --- 2. Empty passes grouped by sourcetype ---
    sourcetype_map = parse_stanza_sourcetypes(SEARCHBASE)
    by_st: dict[tuple[str, ...], list[dict]] = defaultdict(list)
    for r in empty:
        sts = tuple(sorted(set(sourcetype_map.get(r["stanza"], [])))) or ("(no-sourcetype)",)
        by_st[sts].append(r)

    print()
    print(f"## EMPTY PASSES ({len(empty)}) — search ran but returned 0 rows, grouped by sourcetype")
    print()
    sorted_groups = sorted(by_st.items(), key=lambda kv: -len(kv[1]))
    for sts, rs in sorted_groups:
        # Highlight if all stanzas in this group are also empty
        st_label = ", ".join(sts)
        print(f"  [{len(rs):>3}]  {st_label}")
        for r in rs[:5]:
            print(f"           - {r['stanza']:<55s}  {r['search_name']}")
        if len(rs) > 5:
            print(f"           ... and {len(rs)-5} more")
    print()

    # --- 3. Skips
    print()
    print(f"## SKIPS ({len(skips)}) — informational")
    by_reason = Counter(r["detail"].split(":", 2)[1].strip() if r["detail"].startswith("skip:") else r["detail"] for r in skips)
    for reason, n in by_reason.most_common():
        print(f"  [{n:>3}]  {reason}")

    # --- 4. Sourcetype health summary ---
    print()
    print("## SOURCETYPE HEALTH MATRIX")
    print()
    st_total = Counter()
    st_empty = Counter()
    for r in passes:
        for st in sourcetype_map.get(r["stanza"], []) or ["(no-sourcetype)"]:
            st_total[st] += 1
            if r["result_count"] == 0:
                st_empty[st] += 1
    rows_table = []
    for st, n in st_total.most_common():
        e = st_empty[st]
        pct = 100 * e / n if n else 0
        rows_table.append((pct, n, e, st))
    rows_table.sort(key=lambda r: (-r[0], -r[1]))
    print(f"  {'empty %':>8} {'total':>6} {'empty':>6}  sourcetype")
    for pct, n, e, st in rows_table:
        marker = ""
        if pct >= 80:
            marker = "  <-- mostly empty"
        elif pct >= 50:
            marker = "  <-- often empty"
        print(f"  {pct:>7.0f}% {n:>6} {e:>6}  {st}{marker}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
