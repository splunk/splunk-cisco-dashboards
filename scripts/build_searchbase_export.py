#!/usr/bin/env python3
"""Build searchbase_export.conf from searchbase.conf (broad_curated scope)."""

from __future__ import annotations

import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
# Reuse the canonical SPL formatter so every exported `search` field is
# guaranteed to be one-pipe-per-line + trailing-backslash, regardless of
# whether the upstream searchbase.conf was formatted before this script
# ran. Single source of truth for the SPL house style.
from format_searchbase_conf import format_search, emit_search_field

SOURCE = Path(__file__).resolve().parents[1] / (
    "packages/splunk-cisco-dashboards/src/main/resources/splunk/default/searchbase.conf"
)
# Export artifacts live outside the Splunk app's default/ tree so they are
# never bundled into the shipped package (webpack copies the whole
# src/main/resources/splunk/ directory). They are repo-only deliverables.
EXPORT_DIR = Path(__file__).resolve().parents[1] / (
    "packages/splunk-cisco-dashboards/exports"
)
EXPORT = EXPORT_DIR / "searchbase_export.conf"
REPORT = EXPORT_DIR / "searchbase_export_report.txt"

DROP_FIELDS = {
    "dispatch_context",
    "dispatch_context_force",
    "drilldown_stanza_id",
    "drilldown_search_name",
    "drilldown_button_title",
}

FIELD_ORDER = [
    "search_name",
    "search_author",
    "updated_author",
    "version",
    "date_created",
    "date_updated",
    "category",
    "sub_category",
    "tags",
    "default_viz",
    "viz_options",
    "description",
    "explanation",
    "solution",
    "related_info",
    "search",
]

INDEX_TOKEN = 'index="<<index>>"'

# Any index_* macro should collapse to the portable export token.
INDEX_MACRO_CALL = re.compile(r"`index_[A-Za-z0-9_]+(?:\([^`]*\))?`")

# Generic backtick macro usage in SPL (non-index macros are app dependencies
# unless explicitly expanded during export).
MACRO_CALL = re.compile(r"`([A-Za-z_][\w-]*)(?:\([^`]*\))?`")

# Safe, no-argument macros we can inline during export.
KNOWN_EXPANDABLE_MACROS = {
    "scd_summariesonly": "summariesonly=false allow_old_summaries=false fillnull_value=null",
}

# Detect explicit index assignments and collapse customer-specific index names
# to the same portable token used for index_* macro replacement.
INDEX_ASSIGN_RE = re.compile(
    r'(?<![\w.])index\s*=\s*(?:"([^"]+)"|([A-Za-z0-9_*.\-]+))', re.I
)

SAVEDSEARCH_CMD = re.compile(r"\|\s*savedsearch\b", re.I)
MAKERESULTS_CMD = re.compile(r"\|\s*makeresults\b", re.I)

EXPLICIT_DROP_IDS = {
    "overview_site_tallahassee_health",
    "overview_site_auburndale_health",
    "overview_link_auburndale_tallahassee_health",
    "overview_top_incident_volume",
    "overview_operational_lead",
    "overview_inter_site_latency",
    "overview_active_critical_alerts",
    "overview_topology_overview",
    "overview_site_state_drilldown",
    "overview_link_state_drilldown",
    "overview_link_te_a2a_health",
    "overview_top_incident_volume_demo",
    "overview_operational_lead_demo",
    "overview_site_demo_healthy",
    "overview_site_demo_warning",
    "overview_site_demo_critical",
    "overview_link_demo_healthy",
    "overview_link_demo_warning",
    "overview_link_demo_critical",
}

DEMO_STANZA_IDS = EXPLICIT_DROP_IDS

SITE_STRINGS_SEARCH = [
    "Tallahassee",
    "Auburndale",
    "TLH",
    "AUB",
    "SEOC",
    "Betty Easley",
    "Orlando",
    "MCO",
    "Polk City",
    "Florida",
    "Warehouse",
]

INTERNAL_PLUMBING_IDS = {
    "site_topology_marker_enrichment",
    "site_topology_drift_panel",
}

# SPL commands only — not metric/field paths like dns.lookup.availability
LOOKUP_CMD = re.compile(
    r"(?:^|\|)\s*(?:lookup|inputlookup|outputlookup)\b", re.I | re.M
)

PROSE_SCRUB_PATTERNS = [
    (re.compile(r"\bFDEM\b", re.I), ""),
    (re.compile(r"\bCisco-FDEM\b", re.I), "Cisco"),
    (re.compile(r"the customer'?s stack", re.I), "your environment"),
    (re.compile(r"\bTallahassee\b", re.I), "Site A"),
    (re.compile(r"\bAuburndale\b", re.I), "Site B"),
    (re.compile(r"\bTLH\b"), "Site-A"),
    (re.compile(r"\bAUB\b"), "Site-B"),
    (re.compile(r"\bSEOC\b"), "Site-C"),
    (re.compile(r"\bBetty Easley\b", re.I), "Building-C"),
    (re.compile(r"\bOrlando\b", re.I), "Site-D"),
    (re.compile(r"\bMCO\b"), "Site-D"),
    (re.compile(r"\bPolk City\b", re.I), "Region"),
    (re.compile(r"\bFlorida/"), "Region/"),
    (re.compile(r"/Florida/"), "/Region/"),
    (re.compile(r"\bFlorida\b(?=/|\s|&)"), "Region"),
    (re.compile(r"Global/Florida/", re.I), "Global/Region/"),
    (re.compile(r"\s{2,}"), " "),
]

PROSE_FIELDS = ("description", "explanation", "solution", "related_info")

HEADER = """# searchbase_export.conf — curated saved-search export for the standalone Searchbase app.
# Sourced from splunk-cisco-dashboards searchbase.conf (broad_curated scope).
# Index macros and hardcoded index assignments are normalized to index="<<index>>".
# Omitted: Demo stanzas, customer-specific overview/topology, lookup-dependent searches,
# admin/internal plumbing, savedsearch/macro dependencies, makeresults placeholders,
# and SPL with hardcoded site names.
"""


def parse_stanzas(text: str) -> list[tuple[str, dict[str, str]]]:
    stanzas: list[tuple[str, dict[str, str]]] = []
    current_id: str | None = None
    current: dict[str, str] = {}
    search_lines: list[str] = []
    in_search = False

    for line in text.splitlines():
        m = re.match(r"^\[([a-z0-9_]+)\]$", line)
        if m:
            if current_id:
                if search_lines:
                    current["search"] = "\n".join(search_lines)
                stanzas.append((current_id, current))
            current_id = m.group(1)
            current = {}
            search_lines = []
            in_search = False
            continue

        if current_id is None:
            continue

        if line.startswith("search = "):
            in_search = True
            search_lines = [line[len("search = ") :]]
            continue

        if in_search:
            if (
                line.startswith(" ")
                or line.startswith("|")
                or line.endswith("\\")
            ):
                search_lines.append(line)
                continue
            current["search"] = "\n".join(search_lines)
            search_lines = []
            in_search = False

        if not in_search and " = " in line:
            key, _, val = line.partition(" = ")
            current[key] = val

    if current_id:
        if search_lines:
            current["search"] = "\n".join(search_lines)
        stanzas.append((current_id, current))
    return stanzas


def replace_index_macros(text: str) -> str:
    return INDEX_MACRO_CALL.sub(INDEX_TOKEN, text)


def expand_known_macros(text: str) -> str:
    out = text
    for macro_name, definition in KNOWN_EXPANDABLE_MACROS.items():
        out = out.replace(f"`{macro_name}`", definition)
    return out


def replace_hardcoded_indexes(text: str) -> str:
    def repl(match: re.Match[str]) -> str:
        value = (match.group(1) or match.group(2) or "").strip()
        value_lc = value.lower()
        if value in {"<<index>>", "*"}:
            return match.group(0)
        if value_lc in {"_internal", "_audit", "_introspection"}:
            return match.group(0)
        if (value.startswith("$") and value.endswith("$")) or (
            value.startswith("<<") and value.endswith(">>")
        ):
            return match.group(0)
        return INDEX_TOKEN

    return INDEX_ASSIGN_RE.sub(repl, text)


def normalize_search_for_export(search: str) -> str:
    out = replace_index_macros(search)
    out = expand_known_macros(out)
    out = replace_hardcoded_indexes(out)
    return out


def scrub_prose(text: str) -> str:
    if not text:
        return text
    out = text
    for pat, repl in PROSE_SCRUB_PATTERNS:
        out = pat.sub(repl, out)
    out = re.sub(r"<li>\s*</li>", "", out)
    return out.strip()


def has_lookup_in_search(search: str) -> bool:
    return bool(LOOKUP_CMD.search(search))


def has_makeresults_in_search(search: str) -> bool:
    return bool(MAKERESULTS_CMD.search(search))


def has_savedsearch_in_search(search: str) -> bool:
    return bool(SAVEDSEARCH_CMD.search(search))


def unresolved_macros(search: str) -> list[str]:
    unresolved: set[str] = set()
    for macro_name in MACRO_CALL.findall(search):
        if macro_name.startswith("index_"):
            continue
        if macro_name in KNOWN_EXPANDABLE_MACROS:
            continue
        unresolved.add(macro_name)
    return sorted(unresolved)


def has_hardcoded_site_in_search(search: str) -> bool:
    for s in SITE_STRINGS_SEARCH:
        if s in search:
            return True
    return False


def classify_drop(stanza_id: str, fields: dict[str, str]) -> tuple[bool, str, str]:
    category = fields.get("category", "")
    search = fields.get("search", "")

    if category == "Demo" or stanza_id in DEMO_STANZA_IDS:
        return True, "demo", ""

    if stanza_id.startswith("admin_") or stanza_id in INTERNAL_PLUMBING_IDS:
        return True, "admin_internal", ""

    if has_lookup_in_search(search):
        return True, "lookup_dependent", ""

    if has_savedsearch_in_search(search):
        return True, "savedsearch_dependency", "uses | savedsearch"

    if has_makeresults_in_search(search):
        return True, "makeresults_placeholder", "uses | makeresults (synthetic/disabled stub)"

    unresolved = unresolved_macros(search)
    if unresolved:
        return (
            True,
            "macro_dependency",
            "unresolved macro(s): " + ", ".join(unresolved),
        )

    if has_hardcoded_site_in_search(search):
        return True, "hardcoded_site_search", ""

    if stanza_id.startswith("overview_") and re.search(
        r"(tallahassee|auburndale|tlh|aub|seoc|betty|orlando|mco|polk|warehouse|florida|demo)",
        stanza_id,
        re.I,
    ):
        return True, "customer_overview", ""

    return False, "", ""


def pick_spl_duplicate_winner(ids: list[str]) -> str:
    def score(sid: str) -> tuple[int, int, str]:
        penalty = 0
        if "_ds_" in sid:
            penalty += 10
        if sid.startswith("executive_summary"):
            penalty += 5
        if sid.startswith("statewide"):
            penalty += 3
        return (penalty, -len(sid), sid)

    return min(ids, key=score)


def normalize_search(search: str) -> str:
    return re.sub(r"\s+", " ", search.strip())


def normalize_index_macro_prose(text: str) -> tuple[str, int]:
    """Replace <code>index_FOO</code> in prose with the export index token."""
    return re.subn(
        r"<code>index_[A-Za-z0-9_]+(?:\([^<]*\))?</code>",
        '<code>index="<<index>>"</code>',
        text,
    )


def fix_dropped_stanza_refs(text: str, dropped_stanza_ids: set[str]) -> str:
    """Only rewrite cross-references to stanzas omitted from the export."""
    if not dropped_stanza_ids:
        return text
    out = text
    for ref in sorted(dropped_stanza_ids, key=len, reverse=True):
        # Bracketed form inside <code> is common in related_info cross-links.
        out = out.replace(
            f"<code>[{ref}]</code>", "<code>related saved search</code>"
        )
        out = out.replace(f"<code>{ref}</code>", "<code>related saved search</code>")
        out = out.replace(f"[{ref}]", "a related saved search")
    return out


def format_stanza(stanza_id: str, fields: dict[str, str]) -> str:
    lines = [f"[{stanza_id}]"]
    for key in FIELD_ORDER:
        if key in ("default_viz", "viz_options") and key not in fields:
            continue
        if key not in fields:
            continue
        val = fields[key]
        if key == "search":
            # Re-run the canonical formatter (one-pipe-per-line +
            # trailing-backslash). Idempotent when the source is already
            # canonical; corrective when it isn't.
            canonical, _ = format_search(val)
            lines.extend(emit_search_field(canonical))
        else:
            lines.append(f"{key} = {val}")
    return "\n".join(lines)


def transform_fields(
    fields: dict[str, str], dropped_stanza_ids: set[str]
) -> tuple[dict[str, str], int]:
    export_fields = {k: v for k, v in fields.items() if k not in DROP_FIELDS}
    index_prose_hits = 0
    for key, val in list(export_fields.items()):
        if key == "search":
            export_fields[key] = normalize_search_for_export(val)
        else:
            export_fields[key] = replace_index_macros(val)
    for pf in PROSE_FIELDS:
        if pf not in export_fields:
            continue
        export_fields[pf] = scrub_prose(export_fields[pf])
        normalized, n = normalize_index_macro_prose(export_fields[pf])
        export_fields[pf] = normalized
        index_prose_hits += n
        export_fields[pf] = fix_dropped_stanza_refs(
            export_fields[pf], dropped_stanza_ids
        )
    return export_fields, index_prose_hits


def main() -> int:
    text = SOURCE.read_text(encoding="utf-8")
    stanzas = parse_stanzas(text)
    drop_reasons: Counter[str] = Counter()
    dropped_ids: list[tuple[str, str, str]] = []

    candidates: list[tuple[str, dict[str, str]]] = []
    for sid, fields in stanzas:
        prepared = dict(fields)
        if "search" in prepared:
            prepared["search"] = normalize_search_for_export(prepared["search"])

        drop, reason, detail = classify_drop(sid, prepared)
        if drop:
            drop_reasons[reason] += 1
            dropped_ids.append((sid, reason, detail))
            continue
        candidates.append((sid, prepared))

    # SPL-exact duplicate dedup (prefer non-_ds_, non-executive_summary)
    by_search: dict[str, list[str]] = defaultdict(list)
    for sid, fields in candidates:
        by_search[normalize_search(fields.get("search", ""))].append(sid)

    spl_drop: set[str] = set()
    for _search, ids in by_search.items():
        if len(ids) < 2:
            continue
        winner = pick_spl_duplicate_winner(ids)
        for sid in ids:
            if sid != winner:
                spl_drop.add(sid)
                drop_reasons["duplicate_spl"] += 1
                dropped_ids.append((sid, "duplicate_spl", ""))

    candidates = [(s, f) for s, f in candidates if s not in spl_drop]

    # search_name collision dedup
    seen_norm: dict[str, str] = {}
    name_drops: set[str] = set()
    for sid, fields in candidates:
        sn = fields.get("search_name", "")
        norm = re.sub(r"[^a-z0-9]+", "", sn.lower())
        if norm in seen_norm:
            name_drops.add(sid)
            drop_reasons["duplicate_search_name"] += 1
            dropped_ids.append((sid, "duplicate_search_name", ""))
        else:
            seen_norm[norm] = sid
    candidates = [(s, f) for s, f in candidates if s not in name_drops]

    all_source_stanza_ids = {sid for sid, _ in stanzas}
    kept_ids = {s for s, _ in candidates}
    dropped_stanza_ids = all_source_stanza_ids - kept_ids

    index_prose_total = 0
    kept: list[tuple[str, dict[str, str]]] = []
    for sid, fields in candidates:
        export_fields, n = transform_fields(fields, dropped_stanza_ids)
        index_prose_total += n
        kept.append((sid, export_fields))

    export_blocks = [HEADER.strip(), ""]
    for sid, fields in kept:
        export_blocks.append(format_stanza(sid, fields))

    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    EXPORT.write_text("\n\n".join(export_blocks) + "\n", encoding="utf-8")

    by_cat = Counter(f.get("category", "?") for _, f in kept)
    report_lines = [
        f"Total source stanzas: {len(stanzas)}",
        f"Kept: {len(kept)}",
        f"Dropped: {len(stanzas) - len(kept)}",
        "Drop reasons:",
        *[f"  {k}: {v}" for k, v in sorted(drop_reasons.items())],
        "By category (kept):",
        *[f"  {k}: {v}" for k, v in sorted(by_cat.items())],
        f"Index macro prose normalizations (<code>index_*</code>): {index_prose_total}",
        "",
        "Dropped stanza IDs (first 40):",
        *[
            f"  {sid} ({reason}){': ' + detail if detail else ''}"
            for sid, reason, detail in dropped_ids[:40]
        ],
    ]
    REPORT.write_text("\n".join(report_lines) + "\n", encoding="utf-8")
    print("\n".join(report_lines[:20]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
