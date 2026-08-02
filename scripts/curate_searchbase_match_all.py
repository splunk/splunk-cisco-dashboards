#!/usr/bin/env python3
"""Remove exact match-all predicates from every Searchbase search stanza."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

try:
    from scripts.format_searchbase_conf import (
        SOURCE,
        emit_search_field,
        find_unterminated_search_lines,
        format_search,
        parse_stanzas,
    )
    from scripts.harvest_dc_networking_app_to_searchbase import (
        match_all_predicates,
        remove_match_all_predicates,
    )
except ModuleNotFoundError:
    from format_searchbase_conf import (
        SOURCE,
        emit_search_field,
        find_unterminated_search_lines,
        format_search,
        parse_stanzas,
    )
    from harvest_dc_networking_app_to_searchbase import (
        match_all_predicates,
        remove_match_all_predicates,
    )


HEADER = re.compile(r"(?m)^\[([a-z0-9_]+)\]\n")


def curate_text(text: str) -> tuple[str, dict[str, object]]:
    """Clean search bodies while preserving all unaffected stanza text."""
    stanzas = parse_stanzas(text)
    if len({name for name, _ in stanzas}) != len(stanzas):
        raise ValueError("duplicate stanza IDs prevent deterministic curation")

    cleaned_searches: dict[str, str] = {}
    removed_predicates: dict[str, list[str]] = {}
    unterminated_stanzas = {
        stanza_id for _, stanza_id, _ in find_unterminated_search_lines(text)
    }
    for name, fields in stanzas:
        search = fields.get("search")
        if search is None:
            continue
        predicates = match_all_predicates(search)
        if not predicates and name not in unterminated_stanzas:
            continue
        cleaned = (
            remove_match_all_predicates(search.replace("\\\n", " "))
            if predicates
            else search
        )
        formatted, _ = format_search(cleaned)
        if not formatted:
            raise ValueError(f"cleanup produced an empty search: {name}")
        if match_all_predicates(formatted):
            raise ValueError(f"cleanup left match-all predicates: {name}")
        cleaned_searches[name] = formatted
        removed_predicates[name] = predicates

    matches = list(HEADER.finditer(text))
    if not matches:
        raise ValueError("no Searchbase stanzas found")
    output = [text[: matches[0].start()]]
    for index, match in enumerate(matches):
        name = match.group(1)
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        block = text[match.start() : end]
        if name not in cleaned_searches:
            output.append(block)
            continue
        search_start = re.search(r"(?m)^search = ", block)
        if search_start is None:
            raise ValueError(f"parsed search is missing from stanza block: {name}")
        serialized_search = "\n".join(emit_search_field(cleaned_searches[name]))
        output.append(block[: search_start.start()] + serialized_search + "\n\n")

    curated = "".join(output).rstrip() + "\n"
    if failures := find_unterminated_search_lines(curated):
        raise ValueError(f"cleanup left unterminated search lines: {failures[:3]}")
    report: dict[str, object] = {
        "input_stanzas": len(stanzas),
        "changed_stanzas": len(cleaned_searches),
        "formatting_repairs": len(unterminated_stanzas),
        "removed_match_all_predicates": sum(map(len, removed_predicates.values())),
        "changed_stanza_ids": sorted(cleaned_searches),
    }
    return curated, report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=SOURCE)
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()

    original = args.source.read_text(encoding="utf-8")
    curated, report = curate_text(original)
    report["changed"] = curated != original
    print(json.dumps(report, indent=2))
    if args.write and curated != original:
        args.source.write_text(curated, encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())