#!/usr/bin/env python3
"""Apply upstream dashboard provenance tags to searchbase.conf from match CSV."""

from __future__ import annotations

import csv
import re
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
PROVENANCE_MARKER = "TA Stock Dashboard"

# Canonical upstream app tag names (from app.conf labels in /opt/10/etc/apps).
APP_TAG_ALIASES = {
    "Cisco Meraki Add-on for Splunk": "Cisco Meraki Add-on for Splunk",
    "Cisco Enterprise Networking for Splunk Platform": "Cisco Enterprise Networking for Splunk",
    "Splunk Add-on for Cisco ISE": "Splunk Add-on for Cisco ISE",
    "Cisco Spaces Add-on for Splunk": "Cisco Spaces Add-on for Splunk",
    "Splunk Add-on for Cisco ASA": "Splunk Add-on for Cisco ASA",
    "Cisco Cyber Vision App for Splunk": "Cisco Cyber Vision App for Splunk",
    "Cisco Cyber Vision Add-on for Splunk": "Cisco Cyber Vision Add-on for Splunk",
    "Cisco Security Cloud": "Cisco Security Cloud",
    "Cisco Catalyst Add-on for Splunk": "Cisco Catalyst Add-on for Splunk",
    "Cisco Catalyst Center Add-on": "Cisco Catalyst Center Add-on",
    "Cisco Control Center": "Cisco Control Center",
    "Cisco DC Networking App for Splunk": "Cisco DC Networking App for Splunk",
    "Cisco Intersight Add-On for Splunk": "Cisco Intersight Add-on for Splunk",
    "Cisco Networks": "Cisco Networks",
    "Cisco SD-WAN App for Splunk": "Cisco SD-WAN App for Splunk",
    "Cisco SNA App": "Cisco SNA App",
    "Cisco Secure Access Add-on for Splunk": "Cisco Secure Access Add-on for Splunk",
    "Cisco Secure Access App for Splunk": "Cisco Secure Access App for Splunk",
    "Cisco ThousandEyes App for Splunk": "Cisco ThousandEyes App for Splunk",
    "Cisco CESA Dashboard": "Cisco CESA Dashboard",
    "Splunk Add-on for Cisco ESA": "Splunk Add-on for Cisco ESA",
    "Splunk Add-on for Cisco UCS": "Splunk Add-on for Cisco UCS",
    "Splunk Add-on for Cisco WSA": "Splunk Add-on for Cisco WSA",
}


def dashboard_tag(name: str) -> str:
    leaf = name.split(" / ")[-1].strip()
    leaf = re.sub(r"\s+", " ", leaf)
    if len(leaf) > 64:
        leaf = leaf[:61] + "..."
    return leaf


def known_app_labels() -> set[str]:
    labels: set[str] = set()
    for raw, canonical in APP_TAG_ALIASES.items():
        labels.add(raw)
        labels.add(canonical)
    return labels


def load_dashboard_tags(path: Path) -> set[str]:
    tags: set[str] = set()
    with path.open(encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            tags.add(dashboard_tag(row["dashboard_name"]))
    return tags


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


def strip_provenance_tags(
    existing: str,
    app_labels: set[str],
    dashboard_tags: set[str],
) -> str:
    app_fold = {label.casefold() for label in app_labels}
    dash_fold = {tag.casefold() for tag in dashboard_tags}
    kept: list[str] = []
    for part in (p.strip() for p in existing.split(",") if p.strip()):
        fold = part.casefold()
        if part == PROVENANCE_MARKER:
            continue
        if fold in app_fold or fold in dash_fold:
            continue
        kept.append(part)
    return ",".join(kept)


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
    return [PROVENANCE_MARKER, app, dash]


def apply_tags(content: str, matches: dict[str, dict[str, str]]) -> tuple[str, int]:
    app_labels = known_app_labels()
    dashboard_tags = load_dashboard_tags(MATCHES_CSV)
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

        if current_stanza and line.startswith("tags = "):
            old = line.split("=", 1)[1].strip()
            base = strip_provenance_tags(old, app_labels, dashboard_tags)
            if current_stanza in matches:
                new_tags = merge_tags(base, provenance_tags(matches[current_stanza]))
            else:
                new_tags = base
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
    by_app: dict[str, int] = {}
    for match in matches.values():
        app = APP_TAG_ALIASES.get(match["app_name"], match["app_name"])
        by_app[app] = by_app.get(app, 0) + 1
    print(f"Applied provenance tags to {changed} stanzas (threshold >= {CONFIDENCE_THRESHOLD}).")
    print(f"Candidate stanzas in CSV: {len(matches)}")
    print("Tags by upstream app:")
    for app, count in sorted(by_app.items(), key=lambda item: (-item[1], item[0])):
        print(f"  {count:4d}  {app}")


if __name__ == "__main__":
    main()
