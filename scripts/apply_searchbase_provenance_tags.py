#!/usr/bin/env python3
"""Apply upstream dashboard provenance tags to searchbase.conf from match CSV."""

from __future__ import annotations

import csv
import re
from collections import OrderedDict
from datetime import date
from pathlib import Path

SEARCHBASE = Path(
    "/Users/akhamis/repo/splunk-cisco-dashboards/"
    "packages/splunk-cisco-dashboards/src/main/resources/splunk/default/searchbase.conf"
)
MATCHES_CSV = Path(
    "/Users/akhamis/repo/splunk-cisco-dashboards/docs/searchbase-dashboard-matches.csv"
)
CONFIDENCE_THRESHOLD = 0.60
UPDATED_AUTHOR = "akhamis"
DATE_UPDATED = date.today().strftime("%Y-%m-%d %H:%M:%S")

# Canonical upstream app tag names (from app.conf labels in /opt/10/etc/apps).
APP_TAG_ALIASES = {
    "Cisco Meraki Add-on for Splunk": "Cisco Meraki Add-on for Splunk",
    "Cisco Enterprise Networking for Splunk Platform": "Cisco Enterprise Networking for Splunk",
    "Splunk Add-on for Cisco ISE": "Splunk Add-on for Cisco ISE",
    "Cisco Spaces Add-on for Splunk": "Cisco Spaces Add-on for Splunk",
    "Splunk Add-on for Cisco ASA": "Splunk Add-on for Cisco ASA",
    "Cisco Cyber Vision App for Splunk": "Cisco Cyber Vision App for Splunk",
    "Cisco Security Cloud": "Cisco Security Cloud",
}


def load_best_matches(path: Path) -> dict[str, dict[str, str]]:
    by_stanza: dict[str, list[dict[str, str]]] = {}
    with path.open(encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            by_stanza.setdefault(row["stanza_id"], []).append(row)
    best: dict[str, dict[str, str]] = {}
    for stanza_id, rows in by_stanza.items():
        rows.sort(key=lambda r: -float(r["confidence"]))
        top = rows[0]
        if float(top["confidence"]) >= CONFIDENCE_THRESHOLD:
            best[stanza_id] = top
    return best


def dashboard_tag(name: str) -> str:
    # Use the leaf dashboard/panel title for a compact provenance tag.
    leaf = name.split(" / ")[-1].strip()
    leaf = re.sub(r"\s+", " ", leaf)
    if len(leaf) > 64:
        leaf = leaf[:61] + "..."
    return leaf


def merge_tags(existing: str, additions: list[str]) -> str:
    parts = [p.strip() for p in existing.split(",") if p.strip()]
    seen = {p.casefold(): p for p in parts}
    for tag in additions:
        key = tag.casefold()
        if key not in seen:
            seen[key] = tag
    return ",".join(seen.values())


def provenance_tags(match: dict[str, str]) -> list[str]:
    app = APP_TAG_ALIASES.get(match["app_name"], match["app_name"])
    dash = dashboard_tag(match["dashboard_name"])
    return ["TA Stock Dashboard", app, dash]


def apply_tags(content: str, matches: dict[str, dict[str, str]]) -> tuple[str, int]:
    lines = content.splitlines()
    out: list[str] = []
    current_stanza: str | None = None
    changed = 0
    i = 0
    while i < len(lines):
        line = lines[i]
        m = re.match(r"^\[([^\]]+)\]$", line)
        if m and m.group(1) != "default":
            current_stanza = m.group(1)
            out.append(line)
            i += 1
            continue

        if current_stanza and line.startswith("tags = ") and current_stanza in matches:
            old = line.split("=", 1)[1].strip()
            new_tags = merge_tags(old, provenance_tags(matches[current_stanza]))
            if new_tags != old:
                out.append(f"tags = {new_tags}")
                changed += 1
            else:
                out.append(line)
            i += 1
            continue

        if current_stanza and line.startswith("date_updated = ") and current_stanza in matches:
            out.append(f"date_updated = {DATE_UPDATED}")
            i += 1
            continue

        if current_stanza and line.startswith("updated_author = ") and current_stanza in matches:
            out.append(f"updated_author = {UPDATED_AUTHOR}")
            i += 1
            continue

        out.append(line)
        i += 1

    return "\n".join(out) + ("\n" if content.endswith("\n") else ""), changed


def main() -> None:
    matches = load_best_matches(MATCHES_CSV)
    original = SEARCHBASE.read_text(encoding="utf-8")
    updated, changed = apply_tags(original, matches)
    SEARCHBASE.write_text(updated, encoding="utf-8")
    print(f"Applied provenance tags to {changed} stanzas (threshold >= {CONFIDENCE_THRESHOLD}).")
    print(f"Candidate stanzas in CSV: {len(matches)}")


if __name__ == "__main__":
    main()
