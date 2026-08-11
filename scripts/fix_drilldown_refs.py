#!/usr/bin/env python3
"""Migrate Searchbase drilldown targets from search_name to stanza ids.

The command is a dry run by default. It validates that every legacy friendly
name resolves to exactly one stanza before changing any text, then replaces
only the matching metadata line. Existing stanza-id references are validated
and left untouched, so the migration is safe to re-run.
"""

from __future__ import annotations

import argparse
import re
from collections import defaultdict
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SEARCHBASE = REPO_ROOT / (
    "packages/splunk-cisco-dashboards/src/main/resources/splunk/default/searchbase.conf"
)
STANZA_HEADER = re.compile(r"^\[([^\]]+)\]$")
SEARCH_NAME = re.compile(r"^search_name\s*=\s*(.+)$")
LEGACY_TARGET = re.compile(r"^(\s*)drilldown_search_name\s*=\s*(.+?)\s*$")
CANONICAL_TARGET = re.compile(r"^(\s*)drilldown_stanza_id\s*=\s*(.+?)\s*$")


def parse_identities(text: str) -> tuple[set[str], dict[str, list[str]]]:
    stanza_ids: set[str] = set()
    ids_by_search_name: dict[str, list[str]] = defaultdict(list)
    current_id: str | None = None

    for line in text.splitlines():
        header = STANZA_HEADER.match(line)
        if header:
            current_id = header.group(1).strip()
            stanza_ids.add(current_id)
            continue
        if current_id is None:
            continue
        friendly = SEARCH_NAME.match(line)
        if friendly:
            ids_by_search_name[friendly.group(1).strip()].append(current_id)

    return stanza_ids, dict(ids_by_search_name)


def migrate(text: str) -> tuple[str, int, list[str]]:
    stanza_ids, ids_by_search_name = parse_identities(text)
    errors: list[str] = []
    migrated = 0
    output: list[str] = []

    for line_number, line in enumerate(text.splitlines(keepends=True), start=1):
        content = line.rstrip("\r\n")
        newline = line[len(content) :]
        legacy = LEGACY_TARGET.match(content)
        canonical = CANONICAL_TARGET.match(content)

        if legacy:
            target_name = legacy.group(2).strip()
            matches = ids_by_search_name.get(target_name, [])
            if len(matches) != 1:
                errors.append(
                    f"line {line_number}: legacy target {target_name!r} resolved to "
                    f"{len(matches)} stanzas"
                )
                output.append(line)
                continue
            output.append(
                f"{legacy.group(1)}drilldown_stanza_id = {matches[0]}{newline}"
            )
            migrated += 1
            continue

        if canonical:
            target_id = canonical.group(2).strip()
            if target_id not in stanza_ids:
                errors.append(
                    f"line {line_number}: stanza target {target_id!r} does not exist"
                )

        output.append(line)

    return "".join(output), migrated, errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="write the validated migration")
    parser.add_argument(
        "--path",
        type=Path,
        default=DEFAULT_SEARCHBASE,
        help="Searchbase conf to inspect (defaults to the shipped app config)",
    )
    args = parser.parse_args()

    source = args.path.resolve()
    original = source.read_text(encoding="utf-8")
    updated, migrated, errors = migrate(original)

    if errors:
        print(f"Refusing migration: {len(errors)} invalid drilldown target(s)")
        for error in errors:
            print(f"  {error}")
        return 1

    if args.apply and updated != original:
        source.write_text(updated, encoding="utf-8")

    action = "Migrated" if args.apply else "Would migrate"
    print(f"{action} {migrated} drilldown target(s) to stanza ids in {source}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
