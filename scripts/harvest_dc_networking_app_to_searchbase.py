#!/usr/bin/env python3
"""Harvest Cisco DC Networking dashboard searches into searchbase.conf.

Simple XML base/post-process searches and saved-search references are resolved
before dashboard-only tokens are removed. Searches are deduplicated by
case-insensitive, whitespace-normalized SPL while preserving source data-model
and macro usage.
"""

from __future__ import annotations

import argparse
import hashlib
import html
import importlib.util
import json
import re
import sys
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

from defusedxml import ElementTree as ET
from defusedxml.common import DefusedXmlException

REPO = Path(__file__).resolve().parents[1]
DEFAULT_APP = Path("/opt/10/etc/apps/cisco_dc_networking_app_for_splunk")
DEFAULT_SEARCHBASE = REPO / (
    "packages/splunk-cisco-dashboards/src/main/resources/splunk/default/searchbase.conf"
)
DEFAULT_MANIFEST = REPO / "docs/dc_networking_app_harvest_manifest.json"
FORMAT_SCRIPT = REPO / "scripts/format_searchbase_conf.py"
SOURCE_APP = "cisco_dc_networking_app_for_splunk"
TOKEN = re.compile(r"\$([A-Za-z_][A-Za-z0-9_.:-]*)\$")
DM = re.compile(r"(?:from\s+)?datamodel\s*=\s*([A-Za-z0-9_.:-]+)", re.I)


@dataclass(frozen=True)
class DashboardSearch:
    dashboard: str
    dashboard_label: str
    panel_title: str
    search: str
    datamodels: tuple[str, ...]


def load_formatter():
    spec = importlib.util.spec_from_file_location("format_searchbase_conf", FORMAT_SCRIPT)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def canonical_spl(search: str) -> str:
    return re.sub(r"\s+", " ", search.replace("\\\n", " ")).strip().lower()


def persisted_canonical_spl(search: str, formatter) -> str:
    formatted, _ = formatter.format_search(search)
    return canonical_spl(formatted)


def combine_search(base: str, postprocess: str) -> str:
    base = base.strip()
    postprocess = postprocess.strip()
    if not base:
        return postprocess
    if not postprocess:
        return base
    if postprocess.startswith("|"):
        return f"{base} {postprocess}"
    return f"{base} | {postprocess}"


def token_defaults(root: ET.Element) -> dict[str, str]:
    defaults: dict[str, str] = {}
    for element in root.iter():
        token = element.attrib.get("token", "").strip()
        if not token:
            continue
        if element.tag == "set" and element.text and element.text.strip():
            defaults[token] = element.text.strip()
            continue
        for child_name in ("default", "initialValue"):
            child = element.find(child_name)
            if child is not None and child.text and child.text.strip():
                defaults[token] = child.text.strip()
                break
    return defaults


def detokenize(search: str, defaults: dict[str, str]) -> str:
    out = search.strip()
    for token, value in sorted(defaults.items(), key=lambda item: -len(item[0])):
        out = out.replace(f"${token}$", value)

    stages = re.split(r"\s+\|\s+", out)
    cleaned: list[str] = []
    for index, stage in enumerate(stages):
        if not TOKEN.search(stage):
            cleaned.append(stage.strip())
            continue
        if index > 0:
            continue
        stage = re.sub(
            r"\s+[A-Za-z0-9_.:-]+\s+IN\s+\$[A-Za-z_][A-Za-z0-9_.:-]*\$",
            "",
            stage,
            flags=re.I,
        )
        stage = re.sub(
            r'\s+[A-Za-z0-9_.:-]+\s*=\s*["\']?\$[A-Za-z_][A-Za-z0-9_.:-]*\$["\']?',
            "",
            stage,
        )
        stage = TOKEN.sub("", stage)
        stage = re.sub(r"\bwhere\s*$", "", stage, flags=re.I).strip()
        if stage:
            cleaned.append(stage)

    result = " | ".join(part for part in cleaned if part)
    result = re.sub(r"\s+", " ", result).strip()
    result = re.sub(r"\|\s*search\s*(?=\||$)", "", result, flags=re.I).strip()
    result = re.sub(r"\s+", " ", result)
    return result


def parse_savedsearches(path: Path) -> dict[str, str]:
    if not path.is_file():
        return {}
    searches: dict[str, str] = {}
    current = ""
    value: list[str] = []
    in_search = False
    for raw_line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = raw_line.rstrip()
        stanza = re.match(r"^\[([^]]+)\]$", line)
        if stanza:
            if current and value:
                searches[current] = " ".join(value).replace("\\", " ").strip()
            current = stanza.group(1).strip()
            value = []
            in_search = False
        elif current and line.startswith("search = "):
            value = [line.removeprefix("search = ")]
            in_search = line.endswith("\\")
        elif in_search:
            value.append(line)
            in_search = line.endswith("\\")
    if current and value:
        searches[current] = " ".join(value).replace("\\", " ").strip()
    return searches


def effective_views(app_root: Path) -> list[Path]:
    views: dict[str, Path] = {}
    for layer in ("default", "local"):
        directory = app_root / layer / "data/ui/views"
        if directory.is_dir():
            for path in sorted(directory.glob("*.xml")):
                views[path.name] = path
    return sorted(views.values(), key=lambda path: path.name)


def nearest_title(ancestors: list[ET.Element], dashboard_label: str) -> str:
    for ancestor in reversed(ancestors):
        title = ancestor.find("title")
        if title is not None and title.text and title.text.strip():
            return title.text.strip()
    return dashboard_label


def extract_dashboard(
    path: Path, savedsearches: dict[str, str]
) -> tuple[str, list[DashboardSearch], list[str]]:
    try:
        text = path.read_text(encoding="utf-8", errors="strict")
        if len(text.encode("utf-8")) > 10_000_000:
            return path.stem, [], ["file_too_large"]
        root = ET.fromstring(
            text, forbid_dtd=True, forbid_entities=True, forbid_external=True
        )
    except (OSError, UnicodeError, ET.ParseError, DefusedXmlException) as exc:
        return path.stem, [], [f"parse_error:{type(exc).__name__}"]

    label_element = root.find("label")
    label = (
        label_element.text.strip()
        if label_element is not None and label_element.text
        else path.stem.replace("_", " ").title()
    )
    defaults = token_defaults(root)
    search_by_id: dict[str, ET.Element] = {}
    for element in root.iter("search"):
        search_id = element.attrib.get("id", "").strip()
        if search_id:
            search_by_id[search_id] = element

    resolved: dict[int, str] = {}

    def resolve(element: ET.Element, stack: frozenset[str] = frozenset()) -> str:
        cache_key = id(element)
        if cache_key in resolved:
            return resolved[cache_key]
        query = element.find("query")
        own = query.text.strip() if query is not None and query.text else ""
        ref = element.attrib.get("ref", "").strip()
        if ref and not own:
            own = savedsearches.get(ref, "")
        base_id = element.attrib.get("base", "").strip()
        if base_id and base_id not in stack and base_id in search_by_id:
            own = combine_search(
                resolve(search_by_id[base_id], stack | {base_id}), own
            )
        resolved[cache_key] = own
        return own

    found: list[DashboardSearch] = []
    skipped: list[str] = []

    def walk(element: ET.Element, ancestors: list[ET.Element]) -> None:
        if element.tag == "search":
            raw = resolve(element)
            search = detokenize(raw, defaults)
            if not search or len(search) < 12 or TOKEN.search(search):
                skipped.append("empty_or_token_only")
            elif re.fullmatch(r"\|?\s*(?:inputlookup|makeresults)\b[^|]*", search, re.I):
                skipped.append("input_plumbing")
            else:
                datamodels = tuple(sorted(set(DM.findall(search))))
                found.append(
                    DashboardSearch(
                        dashboard=path.stem,
                        dashboard_label=label,
                        panel_title=nearest_title(ancestors, label),
                        search=search,
                        datamodels=datamodels,
                    )
                )
        for child in element:
            walk(child, ancestors + [element])

    walk(root, [])
    return label, found, skipped


def infer_viz(search: str) -> str:
    lowered = search.lower()
    if "timechart" in lowered:
        return "splunk.area"
    if re.search(r"\bchart\b", lowered):
        return "splunk.column"
    if re.search(r"\bstats\s+(?:dc\([^)]*\)|count)(?:\s+as\s+[^|]+)?$", lowered):
        return "splunk.singlevalue"
    return "splunk.table"


def stanza_id(entry: DashboardSearch, existing: set[str]) -> str:
    dashboard = re.sub(r"[^a-z0-9]+", "_", entry.dashboard.lower()).strip("_")[:28]
    digest = hashlib.sha256(canonical_spl(entry.search).encode()).hexdigest()[:8]
    base = f"dc_networking_harvest_{dashboard}_{digest}"
    candidate = base
    suffix = 2
    while candidate in existing:
        candidate = f"{base}_{suffix}"
        suffix += 1
    existing.add(candidate)
    return candidate


def stanza_fields(entry: DashboardSearch) -> dict[str, str]:
    dashboard = html.escape(entry.dashboard_label)
    panel = html.escape(entry.panel_title)
    dm_text = ", ".join(entry.datamodels)
    dm_prose = (
        f" Preserves source data-model usage: <code>{html.escape(dm_text)}</code>."
        if dm_text
        else ""
    )
    tags = ["Cisco DC Networking", "DC Networking App Harvest"]
    if entry.datamodels:
        tags.extend(["Data Model", "TStats"])
    return {
        "search_name": f"DC Networking - {entry.panel_title}",
        "search_author": "akhamis",
        "updated_author": "akhamis",
        "version": "1.0.0",
        "date_created": "2026-07-30 00:00:00",
        "date_updated": "2026-07-30 00:00:00",
        "category": "Network",
        "sub_category": "Data Center Networking",
        "tags": ",".join(tags),
        "dispatch_context": SOURCE_APP,
        "dispatch_context_force": "1",
        "default_viz": infer_viz(entry.search),
        "description": f"<p>{panel} from the Cisco DC Networking dashboard <code>{dashboard}</code>.</p>",
        "explanation": f"<p>Harvested from <code>{entry.dashboard}.xml</code>.{dm_prose}</p>",
        "solution": "<p>Use this search to monitor Cisco ACI, Nexus, and Nexus Dashboard data-center operations.</p>",
        "related_info": (
            f"<ul><li><b>Provenance</b><br><code>{SOURCE_APP}</code> / "
            f"<code>{entry.dashboard}.xml</code>.</li></ul>"
        ),
        "search": entry.search,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--app-root", type=Path, default=DEFAULT_APP)
    parser.add_argument("--searchbase", type=Path, default=DEFAULT_SEARCHBASE)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    views = effective_views(args.app_root)
    if not views:
        parser.error(f"no Simple XML dashboards found under {args.app_root}")
    savedsearches: dict[str, str] = {}
    for layer in ("default", "local"):
        savedsearches.update(parse_savedsearches(args.app_root / layer / "savedsearches.conf"))

    formatter = load_formatter()
    original = args.searchbase.read_text(encoding="utf-8")
    stanzas = formatter.parse_stanzas(original)
    existing_names = {name for name, _ in stanzas}
    existing_spl = {
        persisted_canonical_spl(fields.get("search", ""), formatter)
        for _, fields in stanzas
        if fields.get("search")
    }

    by_search: dict[str, DashboardSearch] = {}
    sources: dict[str, set[str]] = defaultdict(set)
    dashboard_report: dict[str, dict[str, object]] = {}
    parse_errors: list[str] = []
    for view in views:
        label, searches, skipped = extract_dashboard(view, savedsearches)
        dashboard_report[view.stem] = {
            "label": label,
            "extracted": len(searches),
            "skipped": len(skipped),
        }
        parse_errors.extend(f"{view.name}:{reason}" for reason in skipped if reason.startswith("parse_error"))
        for entry in searches:
            key = persisted_canonical_spl(entry.search, formatter)
            sources[key].add(entry.dashboard)
            by_search.setdefault(key, entry)

    candidates = [
        entry
        for entry in by_search.values()
        if persisted_canonical_spl(entry.search, formatter) not in existing_spl
    ]
    candidates.sort(key=lambda entry: (entry.dashboard, entry.panel_title, canonical_spl(entry.search)))
    added: list[str] = []
    for entry in candidates:
        name = stanza_id(entry, existing_names)
        stanzas.append((name, stanza_fields(entry)))
        added.append(name)

    manifest = {
        "source_app": str(args.app_root),
        "dashboards_scanned": len(views),
        "dashboards": dashboard_report,
        "unique_dashboard_searches": len(by_search),
        "already_in_searchbase": len(by_search) - len(candidates),
        "harvest_candidates": len(candidates),
        "duplicate_dashboard_occurrences": sum(len(items) - 1 for items in sources.values()),
        "data_model_candidates": sum(bool(entry.datamodels) for entry in candidates),
        "data_models": sorted({dm for entry in candidates for dm in entry.datamodels}),
        "parse_errors": parse_errors,
        "added_stanzas": added,
    }

    print(json.dumps({key: value for key, value in manifest.items() if key != "dashboards"}, indent=2))
    if args.dry_run or not added:
        return 0

    new_blocks = [
        formatter.format_stanza(name, fields)[0]
        for name, fields in stanzas[-len(added) :]
    ]
    updated = original.rstrip() + "\n\n" + "\n\n".join(new_blocks) + "\n"
    args.searchbase.write_text(updated, encoding="utf-8")
    args.manifest.parent.mkdir(parents=True, exist_ok=True)
    args.manifest.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())