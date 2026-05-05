#!/usr/bin/env python3
"""
Move nav dashboards away from unscheduled saved-search dependencies.

The app's central search catalogue is searchbase.conf. savedsearches.conf is
reserved for scheduled/materialized searches. This migration:

1. Imports nav-dashboard saved searches that only exist in savedsearches.conf
   into searchbase.conf with minimal truthful metadata.
2. Rewrites nav-dashboard ds.savedSearch data sources to ds.search when the
   referenced search is not scheduled/materialized.
3. Shrinks savedsearches.conf to scheduled, side-effecting, or explicit
   savedsearch-command dependency searches.
"""

from __future__ import annotations

import json
import re
from collections import OrderedDict
from pathlib import Path

from audit_searchbase_quality import (
    SEARCHBASE,
    SAVEDSEARCHES,
    VIEWS,
    Stanza,
    parse_conf,
    parse_nav_dashboards,
)


TODAY = "2026-05-05"
APP = "splunk-cisco-dashboards"
SIDE_EFFECT_RE = re.compile(r"\b(outputlookup|collect|sendemail|script|delete)\b", re.I)
SAVEDSEARCH_COMMAND_RE = re.compile(r"\|\s*savedsearch\s+\"([^\"]+)\"", re.I)


def slugify(name: str, existing: set[str]) -> str:
    slug = re.sub(r"[^A-Za-z0-9]+", "_", name).strip("_").lower()
    slug = slug or "dashboard_search"
    base = slug
    i = 2
    while slug in existing:
        slug = f"{base}_{i}"
        i += 1
    existing.add(slug)
    return slug


def is_kept_savedsearch(stanza: Stanza) -> bool:
    return (
        stanza.fields.get("enableSched", "0").strip() == "1"
        or stanza.fields.get("is_scheduled", "0").strip() == "1"
        or bool(SIDE_EFFECT_RE.search(stanza.search))
    )


def savedsearch_command_refs(stanzas: list[Stanza]) -> set[str]:
    refs: set[str] = set()
    for stanza in stanzas:
        refs.update(SAVEDSEARCH_COMMAND_RE.findall(stanza.search))
    return refs


def nav_saved_refs() -> OrderedDict[str, list[str]]:
    refs: OrderedDict[str, list[str]] = OrderedDict()
    for view in parse_nav_dashboards():
        path = VIEWS / f"{view}.xml"
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8")
        match = re.search(r"<definition><!\[CDATA\[([\s\S]*?)\]\]></definition>", text)
        if not match:
            continue
        try:
            data = json.loads(match.group(1))
        except json.JSONDecodeError:
            continue
        view_refs: list[str] = []
        for cfg in data.get("dataSources", {}).values():
            options = cfg.get("options", {})
            if cfg.get("type") == "ds.savedSearch" or options.get("ref"):
                ref = options.get("ref") or options.get("savedSearch")
                if ref:
                    view_refs.append(ref)
        refs[view] = view_refs
    return refs


def format_conf_value(key: str, value: str) -> str:
    lines = value.splitlines()
    if not lines:
        return f"{key} ="
    if len(lines) == 1:
        return f"{key} = {lines[0]}"
    out = [f"{key} = {lines[0]} \\"]
    for index, line in enumerate(lines[1:], 1):
        suffix = " \\" if index < len(lines) - 1 else ""
        out.append(f"{line}{suffix}")
    return "\n".join(out)


def append_searchbase_imports(
    searchbase: list[Stanza],
    savedsearches: dict[str, Stanza],
    refs_by_view: OrderedDict[str, list[str]],
) -> int:
    existing_names = {s.search_name for s in searchbase}
    existing_stanzas = {s.name for s in searchbase}
    imports: list[tuple[str, OrderedDict[str, str]]] = []

    for view, refs in refs_by_view.items():
        for ref in refs:
            if ref in existing_names or ref not in savedsearches:
                continue
            saved = savedsearches[ref]
            if is_kept_savedsearch(saved):
                continue
            stanza_name = slugify(ref, existing_stanzas)
            fields: OrderedDict[str, str] = OrderedDict()
            fields["search_name"] = ref
            fields["search_author"] = "akhamis"
            fields["updated_author"] = "codex"
            fields["version"] = "1.0.0"
            fields["date_created"] = TODAY
            fields["date_updated"] = TODAY
            fields["category"] = ref.split(" - ", 1)[0]
            fields["sub_category"] = "Nav Dashboard"
            fields["tags"] = "Nav_Dashboard, Migrated_From_SavedSearch"
            fields["dispatch_context"] = APP
            fields["dispatch_context_force"] = "1"
            fields["description"] = saved.fields.get(
                "description",
                "Migrated from savedsearches.conf so searchbase.conf is the source of truth.",
            )
            fields["search"] = saved.search
            imports.append((stanza_name, fields))
            existing_names.add(ref)

    if not imports:
        return 0

    chunks = [
        "",
        "# ======================================================================",
        "# Nav Dashboard Searches Migrated From savedsearches.conf",
        "# ======================================================================",
        "",
    ]
    for stanza_name, fields in imports:
        chunks.append(f"[{stanza_name}]")
        for key, value in fields.items():
            chunks.append(format_conf_value(key, value))
        chunks.append("")

    with SEARCHBASE.open("a", encoding="utf-8") as fh:
        fh.write("\n".join(chunks))

    return len(imports)


def load_studio_definition(path: Path) -> tuple[str, str, dict, str] | None:
    text = path.read_text(encoding="utf-8")
    match = re.search(r"(<definition><!\[CDATA\[)([\s\S]*?)(\]\]></definition>)", text)
    if not match:
        return None
    return text[: match.start(2)], match.group(2), json.loads(match.group(2)), text[match.end(2) :]


def rewrite_nav_dashboards(
    searchbase_by_name: dict[str, Stanza],
    savedsearches: dict[str, Stanza],
    keep_names: set[str],
) -> tuple[int, int]:
    rewritten_files = 0
    rewritten_sources = 0

    for view in parse_nav_dashboards():
        path = VIEWS / f"{view}.xml"
        if not path.exists():
            continue
        loaded = load_studio_definition(path)
        if loaded is None:
            continue
        prefix, _definition, data, suffix = loaded
        changed = False

        for cfg in data.get("dataSources", {}).values():
            options = cfg.get("options", {})
            ref = options.get("ref") or options.get("savedSearch")
            if not ref or cfg.get("type") != "ds.savedSearch" or ref in keep_names:
                continue

            search = searchbase_by_name.get(ref)
            if search is None and ref in savedsearches:
                search = savedsearches[ref]

            if search is None:
                if ref == "YOUR SAVED SEARCH NAME HERE":
                    options = {"query": "| noop", "queryParameters": options.get("queryParameters", {})}
                else:
                    raise RuntimeError(f"{view}: no searchbase/savedsearches match for {ref!r}")
            else:
                options = {"query": search.search, "queryParameters": options.get("queryParameters", {})}

            if not options["queryParameters"]:
                options.pop("queryParameters")
            cfg["type"] = "ds.search"
            cfg["options"] = options
            cfg["name"] = ref
            changed = True
            rewritten_sources += 1

        if changed:
            body = json.dumps(data, indent="\t", ensure_ascii=False)
            path.write_text(prefix + body + suffix, encoding="utf-8")
            rewritten_files += 1

    return rewritten_files, rewritten_sources


def write_limited_savedsearches(savedsearches: list[Stanza], dependency_names: set[str]) -> int:
    kept = [s for s in savedsearches if is_kept_savedsearch(s) or s.name in dependency_names]
    chunks = [
        "# Scheduled, materialized, and explicit compatibility dependency searches only.",
        "# Dashboard ad-hoc searches live in searchbase.conf and nav dashboard XML.",
        "",
    ]
    for stanza in kept:
        chunks.append(f"[{stanza.name}]")
        for key, value in stanza.fields.items():
            chunks.append(format_conf_value(key, value))
        chunks.append("")
    SAVEDSEARCHES.write_text("\n".join(chunks), encoding="utf-8")
    return len(kept)


def main() -> int:
    searchbase = parse_conf(SEARCHBASE)
    savedsearches = parse_conf(SAVEDSEARCHES)
    saved_by_name = {s.name: s for s in savedsearches}
    refs_by_view = nav_saved_refs()

    imported = append_searchbase_imports(searchbase, saved_by_name, refs_by_view)
    searchbase = parse_conf(SEARCHBASE)
    searchbase_by_name = {s.search_name: s for s in searchbase}
    dependency_names = savedsearch_command_refs(searchbase)
    keep_names = {s.name for s in savedsearches if is_kept_savedsearch(s) or s.name in dependency_names}

    files, sources = rewrite_nav_dashboards(searchbase_by_name, saved_by_name, keep_names)
    kept = write_limited_savedsearches(savedsearches, dependency_names)

    print(f"imported_searchbase_entries={imported}")
    print(f"rewritten_dashboard_files={files}")
    print(f"rewritten_data_sources={sources}")
    print(f"kept_savedsearches={kept}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
