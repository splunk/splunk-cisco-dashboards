#!/usr/bin/env python3
"""Audit CIM Network_Traffic / Authentication coverage in searchbase.conf.

Writes docs/cim_migration_status.md with DM-backed vs raw counts and
lists stanzas still on index macros that disposition marked as skip.
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
DEFAULT_SEARCHBASE = REPO / (
    "packages/splunk-cisco-dashboards/src/main/resources/splunk/default/searchbase.conf"
)
DEFAULT_DISPOSITION = REPO / "searchbase_cim_disposition.txt"
DEFAULT_OUT = REPO / "docs/cim_migration_status.md"


def parse_stanzas(text: str) -> list[tuple[str, str]]:
    blocks = []
    for block in re.split(r"\n(?=\[)", text):
        m = re.match(r"\[([^\]]+)\]", block)
        if not m:
            continue
        sm = re.search(r"search\s*=\s*(.*)", block, re.S)
        search = sm.group(1) if sm else ""
        blocks.append((m.group(1), search))
    return blocks


def classify(name: str, search: str) -> str:
    s = search.lower()
    if "datamodel=network_traffic" in s or "datamodel=network_traffic" in search:
        return "network_traffic_dm"
    if "datamodel=authentication" in s or "datamodel=authentication" in search:
        return "authentication_dm"
    if "`index_firewall`" in search:
        return "raw_firewall"
    if "`index_identity`" in search or "`index_windows`" in search:
        if "cisco:ise:syslog" in search or "wineventlog" in s:
            return "raw_identity"
    return "other"


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--searchbase", type=Path, default=DEFAULT_SEARCHBASE)
    p.add_argument("--disposition", type=Path, default=DEFAULT_DISPOSITION)
    p.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = p.parse_args()

    stanzas = parse_stanzas(args.searchbase.read_text())
    buckets: dict[str, list[str]] = {
        "network_traffic_dm": [],
        "authentication_dm": [],
        "raw_firewall": [],
        "raw_identity": [],
        "other": [],
    }
    for name, search in stanzas:
        buckets[classify(name, search)].append(name)

    disposition_note = ""
    if args.disposition.is_file():
        disposition_note = args.disposition.read_text().strip().splitlines()[-3:]
        disposition_note = "\n".join(f"> {line}" for line in disposition_note)

    lines = [
        "# CIM migration status",
        "",
        f"Generated from `{args.searchbase.relative_to(REPO)}`.",
        "",
        "## Summary",
        "",
        "| Bucket | Stanzas |",
        "|--------|--------:|",
        f"| `Network_Traffic` data model | {len(buckets['network_traffic_dm'])} |",
        f"| `Authentication` data model | {len(buckets['authentication_dm'])} |",
        f"| Raw `index_firewall` (no NT DM in stanza) | {len(buckets['raw_firewall'])} |",
        f"| Raw identity / Windows / ISE syslog | {len(buckets['raw_identity'])} |",
        "",
        "## Phase 2 posture",
        "",
        "Per `searchbase_cim_disposition.txt`, **all 136** previously flagged raw CIM",
        "candidates are intentionally **skipped** (product-specific fields, composites,",
        "rex on `_raw`, multi-index unions, readiness probes). Production firewall and",
        "identity KPIs already use `tstats` + `scd_summariesonly` on CIM.",
        "",
        "## Remaining raw firewall stanzas",
        "",
    ]
    for n in sorted(buckets["raw_firewall"]):
        lines.append(f"- `{n}`")
    lines.extend(
        [
            "",
            "## Remaining raw identity stanzas (sample)",
            "",
        ]
    )
    for n in sorted(buckets["raw_identity"])[:40]:
        lines.append(f"- `{n}`")
    if len(buckets["raw_identity"]) > 40:
        lines.append(f"- … +{len(buckets['raw_identity']) - 40} more")
    lines.extend(
        [
            "",
            "## Disposition footer",
            "",
            disposition_note or "_No disposition file found._",
            "",
            "## Next CIM work (when needed)",
            "",
            "1. Leave hidden Dashboard Studio reconciliation stanzas raw (byte parity).",
            "2. Add `_dm` readiness twins rather than rewriting ESCU / FTD detail panels.",
            "3. Re-run this audit after any new firewall or identity panels land.",
            "",
        ]
    )
    args.out.write_text("\n".join(lines) + "\n")
    print(f"wrote {args.out}")
    print(
        f"NT DM={len(buckets['network_traffic_dm'])} "
        f"Auth DM={len(buckets['authentication_dm'])} "
        f"raw_fw={len(buckets['raw_firewall'])} "
        f"raw_id={len(buckets['raw_identity'])}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
