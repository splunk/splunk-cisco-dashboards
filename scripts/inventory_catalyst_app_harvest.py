#!/usr/bin/env python3
"""Inventory Cisco Catalyst App dashboard SPL vs searchbase.conf harvest overlap.

Reads Simple XML dashboards from cisco-catalyst-app, extracts
datamodel=Cisco_Catalyst_App queries, and compares nodename/agg/BY
signatures against converted stanzas in searchbase.conf.

Outputs docs/catalyst_app_harvest_manifest.json for Phase 3 planning.
"""

from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
DEFAULT_APP = Path("/opt/10/etc/apps/cisco-catalyst-app")
DEFAULT_SEARCHBASE = REPO / (
    "packages/splunk-cisco-dashboards/src/main/resources/splunk/default/searchbase.conf"
)
DEFAULT_OUT = REPO / "docs/catalyst_app_harvest_manifest.json"


def extract_signature(spl: str) -> tuple[str, str, str]:
    s = re.sub(r"\$[^$]+\$", "", spl)
    s = re.sub(r"`[^`]+`", "MACRO", s).lower()
    nm = re.search(r"nodename=([^\s\\|]+)", s)
    leaf = nm.group(1).split(".")[-1].lower() if nm else "unknown"
    by_m = re.search(r"\bby\s+([^|\\\n]+)", s, re.I)
    by_fields = re.sub(r"\s+", " ", by_m.group(1).strip()) if by_m else ""
    agg = "count"
    if "dc(" in s:
        agg = "dc"
    elif "avg(" in s:
        agg = "avg"
    elif "sum(" in s:
        agg = "sum"
    elif "latest(" in s:
        agg = "latest"
    return leaf, agg, by_fields[:120]


def score_complexity(spl: str) -> int:
    bad = 0
    if re.search(r"\$[^$]+\$", spl):
        bad += 3
    if "makeresults" in spl.lower():
        bad += 5
    if "append [" in spl.lower():
        bad += 4
    if len(spl) > 900:
        bad += 2
    return bad


def load_searchbase_sigs(path: Path) -> set[tuple[str, str, str]]:
    text = path.read_text()
    sigs: set[tuple[str, str, str]] = set()
    for block in re.split(r"\n(?=\[)", text):
        if "datamodel=cisco_catalyst_app" not in block.lower():
            continue
        m = re.search(r"search\s*=\s*(.*)", block, re.S)
        if m:
            sigs.add(extract_signature(m.group(1)))
    return sigs


def load_dashboard_queries(app_root: Path) -> list[dict]:
    views = app_root / "default/data/ui/views"
    if not views.is_dir():
        raise FileNotFoundError(f"No dashboard views at {views}")
    out: list[dict] = []
    for xml in sorted(views.glob("*.xml")):
        dash = xml.stem
        for spl in re.findall(r"<query(?:\s[^>]*)?>(.*?)</query>", xml.read_text(), re.S):
            spl = spl.strip()
            if "datamodel=cisco_catalyst_app" not in spl.lower():
                continue
            sig = extract_signature(spl)
            out.append(
                {
                    "dashboard": dash,
                    "nodename_leaf": sig[0],
                    "signature": list(sig),
                    "complexity": score_complexity(spl),
                    "spl": spl,
                }
            )
    return out


def dedupe_queries(queries: list[dict]) -> list[dict]:
    seen: dict[str, dict] = {}
    for q in queries:
        key = re.sub(r"\s+", " ", q["spl"]).strip()
        seen[key] = q
    return list(seen.values())


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--app-root", type=Path, default=DEFAULT_APP)
    p.add_argument("--searchbase", type=Path, default=DEFAULT_SEARCHBASE)
    p.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = p.parse_args()

    sb_sigs = load_searchbase_sigs(args.searchbase)
    queries = dedupe_queries(load_dashboard_queries(args.app_root))
    candidates = [q for q in queries if tuple(q["signature"]) not in sb_sigs]
    covered = [q for q in queries if tuple(q["signature"]) in sb_sigs]

    by_leaf: dict[str, int] = defaultdict(int)
    for q in candidates:
        by_leaf[q["nodename_leaf"]] += 1

    manifest = {
        "app_root": str(args.app_root),
        "searchbase": str(args.searchbase),
        "unique_dm_queries": len(queries),
        "covered_by_signature": len(covered),
        "harvest_candidates": len(candidates),
        "searchbase_catalyst_dm_signatures": len(sb_sigs),
        "candidates_by_nodename_leaf": dict(sorted(by_leaf.items(), key=lambda kv: -kv[1])),
        "candidates": sorted(
            candidates,
            key=lambda q: (q["complexity"], q["nodename_leaf"], q["dashboard"]),
        ),
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(manifest, indent=2) + "\n")

    print(f"unique_dm_queries={len(queries)}")
    print(f"covered_by_signature={len(covered)}")
    print(f"harvest_candidates={len(candidates)}")
    print(f"wrote {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
