#!/usr/bin/env python3
"""Normalize and trim Searchbase tags without removing semantic or provenance tags."""

from __future__ import annotations

import argparse
import csv
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SEARCHBASE = (
    ROOT
    / "packages/splunk-cisco-dashboards/src/main/resources/splunk/default/searchbase.conf"
)
MATCHES_CSV = ROOT / "docs/searchbase-dashboard-matches.csv"

INTERNAL_TAGS = {
    "Indexes",
    "P0",
    "P1",
    "P1-data",
    "Searchbase Reconciliation",
    "Searchbase Same-Root Reconciliation",
    "query_count_severity",
}
PROTECTED_TAGS = {
    "SCD",
    "Secure Networking",
    "Zero Trust Access",
    "Secure Infrastructure",
    "Scalable Network Segmentation",
    "Hybrid Mesh Firewalling",
    "Agentic Ops",
    "ThousandEyes",
    "A2A",
    "Inventory",
    "Binding",
    "Topology_Link",
    "TA Stock Dashboard",
    "dCloud",
    "Catalyst App Harvest",
    "Dashboard Studio",
    "Nav_Dashboard",
    "Migrated_From_SavedSearch",
}
VIZ_TAGS = {
    "splunk.table": "Table",
    "splunk.bar": "Bar",
    "splunk.pie": "Pie",
}
TAG_ALIASES = {
    "Advisories": "Advisory",
    "Blocked": "Block",
    "Blocks": "Block",
    "Cisco Catalyst SD-WAN": "SD-WAN",
    "Clients": "Client",
    "Connections": "Connection",
    "Devices": "Device",
    "DNAC": "Catalyst Center",
    "Endpoints": "Endpoint",
    "Events": "Event",
    "Failed": "Failure",
    "Failures": "Failure",
    "Flows": "Flow",
    "Hotspots": "Hotspot",
    "Leases": "Lease",
    "Metrics": "Metric",
    "Path Changes": "Path Change",
    "Ports": "Port",
    "Rooms": "Room",
    "Sessions": "Session",
    "Traces": "Trace",
    "Tunneling": "Tunnel",
    "Tunnels": "Tunnel",
    "URL Filtering": "URL Filter",
    "Users": "User",
    "Verdicts": "Verdict",
    "Web Transactions": "Web Transaction",
}
STANZA_PATTERN = re.compile(
    r"(?ms)^\[(?P<name>[A-Za-z0-9_.:-]+)\]\n"
    r"(?P<body>.*?)(?=^\[[A-Za-z0-9_.:-]+\]\n|\Z)"
)
FIELD_PATTERN = re.compile(r"(?m)^(?P<key>[A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?P<value>.*)$")


def dashboard_provenance_tags() -> set[str]:
    tags: set[str] = set()
    with MATCHES_CSV.open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            tags.add(row["dashboard_name"].split(" / ", 1)[0].strip())
    return tags


def parse_fields(body: str) -> dict[str, str]:
    return {
        match.group("key"): match.group("value").strip()
        for match in FIELD_PATTERN.finditer(body)
    }


def trim_tags(fields: dict[str, str], protected: set[str]) -> tuple[list[str], list[str]]:
    raw_tags = [tag.strip() for tag in fields.get("tags", "").split(",") if tag.strip()]
    tags = [TAG_ALIASES.get(tag, tag) for tag in raw_tags]
    tag_set = set(tags)
    facets = {
        fields.get("category", "").strip().casefold(),
        fields.get("sub_category", "").strip().casefold(),
    } - {""}
    redundant_viz_tag = VIZ_TAGS.get(fields.get("default_viz", "").strip())
    kept: list[str] = []
    removed: list[str] = []
    seen: set[str] = set()

    for raw_tag, tag in zip(raw_tags, tags):
        folded = tag.casefold()
        remove = (
            tag in INTERNAL_TAGS
            or (tag not in protected and folded in facets)
            or tag == redundant_viz_tag
            or (tag == "Firepower" and "FTD" in tag_set)
            or (tag == "ZTA" and "Zero Trust Access" in tag_set)
            or (tag == "Time Series" and "Trend" in tag_set)
            or folded in seen
        )
        if raw_tag != tag:
            removed.append(f"{raw_tag} -> {tag}")
        if remove:
            if raw_tag == tag:
                removed.append(tag)
        else:
            kept.append(tag)
            seen.add(folded)
    return kept, removed


def trim(content: str) -> tuple[str, dict[str, list[str]]]:
    protected = PROTECTED_TAGS | dashboard_provenance_tags()
    changes: dict[str, list[str]] = {}

    def replace_stanza(match: re.Match[str]) -> str:
        name = match.group("name")
        body = match.group("body")
        fields = parse_fields(body)
        kept, removed = trim_tags(fields, protected)
        if not removed:
            return match.group(0)
        changes[name] = removed
        new_tags = "tags = " + ",".join(kept)
        body = re.sub(r"(?m)^tags\s*=.*$", lambda _: new_tags, body, count=1)
        return f"[{name}]\n{body}"

    return STANZA_PATTERN.sub(replace_stanza, content), changes


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Write the trimmed catalog.")
    args = parser.parse_args()

    original = SEARCHBASE.read_text(encoding="utf-8")
    updated, changes = trim(original)
    tag_changes = Counter(tag for tags in changes.values() for tag in tags)
    action = "updated" if args.apply else "would update"
    print(
        f"{action} {len(changes)} stanzas; "
        f"normalize/remove {sum(tag_changes.values())} tag tokens"
    )
    for tag, count in tag_changes.most_common():
        print(f"{count:4d}  {tag}")
    if args.apply and updated != original:
        SEARCHBASE.write_text(updated, encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())