#!/usr/bin/env python3
"""Remove exact match-all predicates from every Searchbase search stanza."""

from __future__ import annotations

import argparse
import json
import re
import shlex
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
LOCAL_DISPATCH_CONTEXT = "splunk-cisco-dashboards"
EXPORTED_DISPATCH_CONTEXTS = {"cisco_dc_networking_app_for_splunk"}
LOCAL_MACROS = {
    "cisco_dc_aci_index": "index_dc",
    "cisco_dc_n9k_index": "index_dc",
    "cisco_dc_nd_index": "index_dc",
    "summariesonly": "scd_summariesonly",
}


def normalize_macro_ownership(search: str) -> tuple[str, dict[str, int]]:
    """Replace foreign macros when Searchbase owns an equivalent abstraction."""
    normalized = search
    replacements: dict[str, int] = {}
    for foreign, local in LOCAL_MACROS.items():
        count = normalized.count(f"`{foreign}`")
        if not count:
            continue
        normalized = normalized.replace(f"`{foreign}`", f"`{local}`")
        replacements[f"{foreign}->{local}"] = count
    return normalized, replacements


def remove_redundant_timechart_projection(search: str) -> tuple[str, bool]:
    """Remove a terminal fields command that only repeats timechart output."""
    logical = search.replace("\\\n", "\n")
    lines = [line.strip() for line in logical.splitlines() if line.strip()]
    if len(lines) < 2:
        return search, False
    timechart, projection = lines[-2:]
    if not re.match(r"^\|\s*timechart\b", timechart, re.I) or not re.match(
        r"^\|\s*fields\b", projection, re.I
    ):
        return search, False
    if re.search(r"\sby\s", timechart, re.I):
        return search, False
    aliases = [
        alias.strip('"')
        for alias in re.findall(r'\bas\s+("[^"]+"|\S+)', timechart, re.I)
    ]
    if not aliases:
        return search, False
    try:
        projected = shlex.split(
            re.sub(r"^\|\s*fields\s+", "", projection, flags=re.I).replace(",", " ")
        )
    except ValueError:
        return search, False
    if projected != ["_time", *aliases]:
        return search, False
    return "\n".join(lines[:-1]), True


def curate_text(text: str) -> tuple[str, dict[str, object]]:
    """Clean search bodies while preserving all unaffected stanza text."""
    stanzas = parse_stanzas(text)
    if len({name for name, _ in stanzas}) != len(stanzas):
        raise ValueError("duplicate stanza IDs prevent deterministic curation")

    cleaned_searches: dict[str, str] = {}
    removed_predicates: dict[str, list[str]] = {}
    removed_projections: list[str] = []
    normalized_dispatch_contexts: list[str] = []
    normalized_macros: dict[str, int] = {}
    unterminated_stanzas = {
        stanza_id for _, stanza_id, _ in find_unterminated_search_lines(text)
    }
    for name, fields in stanzas:
        search = fields.get("search")
        if search is None:
            continue
        normalized_search, macro_replacements = normalize_macro_ownership(search)
        for replacement, count in macro_replacements.items():
            normalized_macros[replacement] = normalized_macros.get(replacement, 0) + count
        predicates = match_all_predicates(normalized_search)
        without_projection, projection_removed = remove_redundant_timechart_projection(
            normalized_search
        )
        context_normalized = fields.get("dispatch_context") in EXPORTED_DISPATCH_CONTEXTS
        if context_normalized:
            normalized_dispatch_contexts.append(name)
        if (
            not predicates
            and name not in unterminated_stanzas
            and not projection_removed
            and not macro_replacements
        ):
            continue
        cleaned = (
            remove_match_all_predicates(without_projection.replace("\\\n", " "))
            if predicates
            else without_projection
        )
        formatted, _ = format_search(cleaned)
        if not formatted:
            raise ValueError(f"cleanup produced an empty search: {name}")
        if match_all_predicates(formatted):
            raise ValueError(f"cleanup left match-all predicates: {name}")
        cleaned_searches[name] = formatted
        removed_predicates[name] = predicates
        if projection_removed:
            removed_projections.append(name)

    matches = list(HEADER.finditer(text))
    if not matches:
        raise ValueError("no Searchbase stanzas found")
    output = [text[: matches[0].start()]]
    for index, match in enumerate(matches):
        name = match.group(1)
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        block = text[match.start() : end]
        if name in normalized_dispatch_contexts:
            block = re.sub(
                r"(?m)^dispatch_context = \S+$",
                f"dispatch_context = {LOCAL_DISPATCH_CONTEXT}",
                block,
                count=1,
            )
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
    changed_stanza_ids = sorted(
        set(cleaned_searches).union(normalized_dispatch_contexts)
    )
    report: dict[str, object] = {
        "input_stanzas": len(stanzas),
        "changed_stanzas": len(changed_stanza_ids),
        "changed_searches": len(cleaned_searches),
        "formatting_repairs": len(unterminated_stanzas),
        "removed_match_all_predicates": sum(map(len, removed_predicates.values())),
        "removed_redundant_timechart_projections": len(removed_projections),
        "projection_stanza_ids": sorted(removed_projections),
        "normalized_dispatch_contexts": len(normalized_dispatch_contexts),
        "normalized_macro_references": dict(sorted(normalized_macros.items())),
        "changed_stanza_ids": changed_stanza_ids,
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