#!/usr/bin/env python3
"""Harvest token-free Splunk Attack Analyzer dashboard and alert SPL.

The add-on ships data collection and sourcetype definitions; the companion app
ships Studio dashboards plus three correlation searches.  This harvester keeps
only standalone SPL (no dashboard tokens), replaces the app-local
``saa_indexes`` macro with SCD's ``index_security`` macro, and records the
companion app as catalogue provenance while searches execute locally.
"""

from __future__ import annotations

import argparse
import html
import hashlib
import json
import re
from pathlib import Path

try:
    from scripts.format_searchbase_conf import SOURCE, format_stanza, format_search, parse_stanzas
except ModuleNotFoundError:
    from format_searchbase_conf import SOURCE, format_stanza, format_search, parse_stanzas


APP = Path("/opt/10/etc/apps/Splunk_App_SAA")
VIEWS = APP / "default/data/ui/views"
SAVED_SEARCHES = APP / "default/savedsearches.conf"
SOURCE_APP = "Splunk_App_SAA"
TOKEN = re.compile(r"\$[A-Za-z_][A-Za-z0-9_.]*\$")


def canonical(search: str) -> str:
    formatted, _ = format_search(search)
    return re.sub(r"\s+", " ", formatted.replace("\\\n", " ")).strip().lower()


def rewrite_macro(search: str) -> str:
    return re.sub(r"`saa_indexes`", "`index_security`", search, flags=re.I).strip()


def safe_search(search: str) -> str | None:
    search = rewrite_macro(search)
    if (
        TOKEN.search(search)
        or "splunk:aa:" not in search.lower()
        or re.search(r"(?i)\|\s*dedup\b", search)
    ):
        return None
    return search


def studio_queries(path: Path) -> list[tuple[str, str, str]]:
    text = path.read_text(encoding="utf-8", errors="replace")
    label = path.stem.replace("_", " ")
    match = re.search(r"<label>([^<]+)</label>", text, re.I)
    if match:
        label = match.group(1).strip()
    blob = re.search(r"<definition>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*</definition>", text, re.I)
    if not blob:
        return []
    try:
        definition = json.loads(blob.group(1))
    except json.JSONDecodeError:
        return []
    titles: dict[str, tuple[str, str]] = {}
    for visual in (definition.get("visualizations") or {}).values():
        if not isinstance(visual, dict):
            continue
        source = (visual.get("dataSources") or {}).get("primary")
        if isinstance(source, str):
            titles[source] = (
                str(visual.get("title") or label).strip(),
                str(visual.get("type") or "splunk.table"),
            )
    found: list[tuple[str, str, str]] = []
    for source_id, source in (definition.get("dataSources") or {}).items():
        if not isinstance(source, dict) or source.get("type") != "ds.search":
            continue
        query = ((source.get("options") or {}).get("query"))
        if not isinstance(query, str) or not (query := safe_search(query)):
            continue
        title, viz = titles.get(source_id, (str(source.get("name") or label), "splunk.table"))
        title = html.unescape(title)
        found.append((f"{label} - {title}", viz, query))
    return found


def saved_search_queries() -> list[tuple[str, str, str]]:
    if not SAVED_SEARCHES.exists():
        return []
    found: list[tuple[str, str, str]] = []
    current_name = ""
    search_lines: list[str] = []
    reading_search = False
    for raw_line in SAVED_SEARCHES.read_text(encoding="utf-8").splitlines():
        match = re.match(r"^\[(.+)\]$", raw_line)
        if match:
            if current_name:
                query = safe_search("\n".join(search_lines))
                if query:
                    found.append((current_name.replace("Threat - Threat - ", ""), "splunk.table", query))
            current_name = match.group(1)
            search_lines = []
            reading_search = False
        elif raw_line.startswith("search = "):
            search_lines = [raw_line[len("search = ") :]]
            reading_search = True
        elif reading_search and (raw_line.startswith("|") or search_lines[-1].endswith("\\")):
            search_lines.append(raw_line)
        else:
            reading_search = False
    if current_name:
        query = safe_search("\n".join(search_lines))
        if query:
            found.append((current_name.replace("Threat - Threat - ", ""), "splunk.table", query))
    return found


def stanza_name(title: str, search: str, existing: set[str]) -> str:
    base = re.sub(r"[^a-z0-9]+", "_", title.lower()).strip("_")
    base = f"saa_harvest_{base[:56]}"
    if base not in existing:
        return base
    return f"{base}_{hashlib.sha1(search.encode()).hexdigest()[:8]}"


def metadata(name: str, title: str, viz: str, search: str) -> dict[str, str]:
    default_viz = viz if viz.startswith("splunk.") else "splunk.table"
    tags = "Splunk Attack Analyzer,Harvested"
    if "timechart" in search.lower():
        tags += ",Trend"
    return {
        "search_name": title,
        "search_author": "splunk-cisco-dashboards",
        "updated_author": "splunk-cisco-dashboards",
        "version": "1.0.0",
        "date_created": "2026-08-02",
        "date_updated": "2026-08-02",
        "category": "Security",
        "sub_category": "Splunk Attack Analyzer",
        "tags": tags,
        "dispatch_context": SOURCE_APP,
        "dispatch_context_force": "0",
        "default_viz": default_viz,
        "description": f"<p>Harvested from the Splunk Attack Analyzer <b>{title}</b> search.</p>",
        "explanation": "<p>Uses Splunk Attack Analyzer <code>splunk:aa:*</code> telemetry. The source app's <code>saa_indexes</code> macro is mapped to SCD <code>index_security</code>.</p>",
        "solution": "<p>Confirm Attack Analyzer ingestion and tune the <code>index_security</code> macro if no events are returned.</p>",
        "related_info": "<ul><li><b>Source</b><br>Harvested from <code>Splunk_App_SAA</code>; its companion add-on is <code>Splunk_TA_SAA</code>.</li></ul>",
        "search": search,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=SOURCE)
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()
    original = args.source.read_text(encoding="utf-8")
    stanzas = parse_stanzas(original)
    existing_ids = {name for name, _ in stanzas}
    existing_spl = {canonical(fields.get("search", "")) for _, fields in stanzas}
    candidates = saved_search_queries()
    for view in sorted(VIEWS.glob("*.xml")):
        candidates.extend(studio_queries(view))
    added: list[str] = []
    seen: set[str] = set()
    for title, viz, search in candidates:
        key = canonical(search)
        if key in seen or key in existing_spl:
            continue
        seen.add(key)
        name = stanza_name(title, search, existing_ids)
        stanzas.append((name, metadata(name, title, viz, search)))
        existing_ids.add(name)
        existing_spl.add(key)
        added.append(name)
    additions = [
        format_stanza(name, fields)[0].rstrip()
        for name, fields in stanzas
        if name in added
    ]
    rendered = original.rstrip() + ("\n\n" + "\n\n".join(additions) if additions else "") + "\n"
    print(json.dumps({"candidates": len(candidates), "added": added}, indent=2))
    if args.write and rendered != original:
        args.source.write_text(rendered, encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
