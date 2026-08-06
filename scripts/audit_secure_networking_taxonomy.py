#!/usr/bin/env python3
"""Audit and optionally fix Secure Networking Searchbase taxonomy metadata."""

from __future__ import annotations

import argparse
import csv
import re
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
SEARCHBASE = ROOT / "packages/splunk-cisco-dashboards/src/main/resources/splunk/default/searchbase.conf"
MAPPING = ROOT / "docs/Secure_Networking/SN Splunk Use Case mapping - Working Version.csv"
PHASE_TAG = "SN Phase 1"

PILLARS = {
    "Zero Trust Access",
    "Secure Infrastructure",
    "Secure Network Segmentation",
    "Hybrid Firewall",
    "Agentic Ops",
}
LEGACY_PILLARS = {
    "Scalable Network Segmentation": "Secure Network Segmentation",
    "Hybrid Mesh Firewalling": "Hybrid Firewall",
}
SEARCH_NAME_ALIASES = {
    "Secure Networking - ZTA Duo Admin Activity by Outcom":
        "Secure Networking - ZTA Duo Admin Activity by Outcome",
}
HEADER_RE = re.compile(r"^\[([^]]+)]$", re.MULTILINE)
FIELD_RE_TEMPLATE = r"(?m)^{field} = (.*)$"


@dataclass
class Stanza:
    name: str
    start: int
    end: int
    body: str

    def field(self, name: str) -> str:
        match = re.search(FIELD_RE_TEMPLATE.format(field=re.escape(name)), self.body)
        return match.group(1).strip() if match else ""


def parse_stanzas(content: str) -> list[Stanza]:
    headers = list(HEADER_RE.finditer(content))
    return [
        Stanza(
            name=match.group(1),
            start=match.start(),
            end=headers[index + 1].start() if index + 1 < len(headers) else len(content),
            body=content[match.start():headers[index + 1].start() if index + 1 < len(headers) else len(content)],
        )
        for index, match in enumerate(headers)
    ]


def csv_assignments() -> tuple[dict[str, str], set[str]]:
    assignments: dict[str, str] = {}
    referenced: set[str] = set()
    current_section = ""
    with MAPPING.open(newline="", encoding="utf-8-sig") as handle:
        for row in csv.reader(handle):
            if len(row) < 5:
                continue
            candidate = row[1].strip()
            if candidate:
                current_section = candidate
            for raw_name in row[4].splitlines():
                name = SEARCH_NAME_ALIASES.get(raw_name.strip().rstrip("."), raw_name.strip().rstrip("."))
                if not name or name == "Searchbase":
                    continue
                referenced.add(name)
                if current_section in PILLARS:
                    assignments[name] = current_section
    return assignments, referenced


def tag_tokens(raw: str) -> list[str]:
    return [token.strip() for token in raw.split(",") if token.strip()]


def desired_tags(raw: str, pillar: str | None, add_identity: bool) -> str:
    tags = [LEGACY_PILLARS.get(tag, tag) for tag in tag_tokens(raw)]
    if pillar:
        tags = [tag for tag in tags if tag not in PILLARS or tag == pillar]
    additions = ["Secure Networking"] if pillar is not None else []
    if pillar:
        additions.append(pillar)
    if add_identity:
        additions.append("Identity")
    for addition in additions:
        if addition not in tags:
            tags.append(addition)
    return ",".join(dict.fromkeys(tags))


def set_field(body: str, field: str, value: str) -> str:
    pattern = FIELD_RE_TEMPLATE.format(field=re.escape(field))
    if re.search(pattern, body):
        return re.sub(pattern, f"{field} = {value}", body, count=1)
    anchor = re.search(r"(?m)^category = .*$", body)
    if not anchor:
        raise ValueError(f"Cannot add {field}: stanza has no category field")
    return body[:anchor.end()] + f"\n{field} = {value}" + body[anchor.end():]


def expected_body(stanza: Stanza, assignments: dict[str, str], referenced: set[str]) -> str:
    body = stanza.body
    search_name = stanza.field("search_name")
    current_subcategory = stanza.field("sub_category")
    pillar = assignments.get(search_name)
    is_duo_identity = stanza.field("category") == "Identity" and "cisco:duo:" in stanza.field("search")
    is_duo_feed_health = stanza.name == "feed_monitor_duo_api_staleness"
    if is_duo_identity:
        pillar = "Zero Trust Access"
    if stanza.name.startswith("secure_networking_") and pillar is None:
        pillar = LEGACY_PILLARS.get(current_subcategory, current_subcategory)
        if pillar not in PILLARS:
            pillar = None
    elif pillar is None and current_subcategory in LEGACY_PILLARS and "Secure Networking" in tag_tokens(stanza.field("tags")):
        pillar = LEGACY_PILLARS[current_subcategory]

    if pillar:
        body = set_field(body, "sub_category", pillar)

    should_tag_secure_networking = (
        search_name in referenced
        or stanza.name.startswith("secure_networking_")
        or is_duo_identity
        or is_duo_feed_health
    )
    tags_pillar = pillar if should_tag_secure_networking else None
    tags = desired_tags(stanza.field("tags"), tags_pillar, is_duo_identity)
    if should_tag_secure_networking and "Secure Networking" not in tag_tokens(tags):
        tags = desired_tags(tags, pillar or "", is_duo_identity)
    if search_name in referenced and PHASE_TAG not in tag_tokens(tags):
        tags = f"{tags},{PHASE_TAG}" if tags else PHASE_TAG
    if tags != stanza.field("tags"):
        body = set_field(body, "tags", tags)
    return body


def audit(content: str) -> tuple[str, list[str], list[str]]:
    assignments, referenced = csv_assignments()
    stanzas = parse_stanzas(content)
    by_search_name = {stanza.field("search_name"): stanza for stanza in stanzas}
    missing = sorted(name for name in referenced if name not in by_search_name)
    changes: list[str] = []
    replacements: list[tuple[int, int, str]] = []
    for stanza in stanzas:
        expected = expected_body(stanza, assignments, referenced)
        if expected != stanza.body:
            changes.append(stanza.name)
            replacements.append((stanza.start, stanza.end, expected))
    for start, end, replacement in reversed(replacements):
        content = content[:start] + replacement + content[end:]
    return content, changes, missing


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fix", action="store_true", help="Apply metadata corrections to searchbase.conf")
    args = parser.parse_args()

    content = SEARCHBASE.read_text(encoding="utf-8")
    corrected, changes, missing = audit(content)
    if args.fix and corrected != content:
        SEARCHBASE.write_text(corrected, encoding="utf-8")

    print(f"Metadata changes needed: {len(changes)}")
    for stanza in changes:
        print(f"  {stanza}")
    print(f"CSV-named searches missing: {len(missing)}")
    for search_name in missing:
        print(f"  {search_name}")
    return 1 if changes or missing else 0


if __name__ == "__main__":
    raise SystemExit(main())