#!/usr/bin/env python3
"""Fill in missing ``related_info`` / ``explanation`` / ``solution`` on
the small set of stanzas that the metadata audit flagged as gaps.

Most of the gaps are on internal helpers that the React Overview page
queries by name -- they don't strictly need picker prose, but they do
appear in the Searchbase app interface and the Splunk admin UI, where
a reasonable ``related_info`` makes a real difference for findability
and onboarding context.

The script is idempotent: it only writes a field if the stanza is
currently missing it, never overwrites existing content.

Run::

    python3 scripts/fix_searchbase_prose_gaps.py
"""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SEARCHBASE = (
    ROOT
    / "packages"
    / "splunk-cisco-dashboards"
    / "src"
    / "main"
    / "resources"
    / "splunk"
    / "default"
    / "searchbase.conf"
)

DATE_NEW = "2026-05-09"
AUTHOR_NEW = "codex"


# ---------------------------------------------------------------------------
# Per-stanza fills. Keys are stanza names. Values are dicts with optional
# ``explanation`` / ``solution`` / ``related_info`` content that will be
# inserted only if that field is missing on the stanza today.
# ---------------------------------------------------------------------------
FILLS: dict[str, dict[str, str]] = {
    # ---------- Overview map: per-site health ----------
    "overview_site_tallahassee_health": {
        "related_info": (
            "<ul>"
            "<li><b>Map consumer</b><br>Rendered by <code>CustomerTopologyMap</code> "
            "as the Tallahassee site marker; the React layer reads "
            "<code>healthPct</code> + <code>status</code> directly.</li>"
            "<li><b>Sibling stanzas</b><br><code>[overview_site_orlando_health]</code>, "
            "<code>[overview_site_auburndale_health]</code>; demo variants "
            "<code>[overview_site_demo_healthy/warning/critical]</code> back the picker preview.</li>"
            "<li><b>Site normalisation</b><br>The <code>dnac_site_normalize</code> macro "
            "is the single source of truth for collapsing TLH / SEOC / Betty Easley path "
            "variants into one rollup.</li>"
            "</ul>"
        ),
    },
    "overview_site_orlando_health": {
        "related_info": (
            "<ul>"
            "<li><b>Map consumer</b><br>Rendered by <code>CustomerTopologyMap</code> "
            "as the Orlando site marker.</li>"
            "<li><b>Sibling stanzas</b><br><code>[overview_site_tallahassee_health]</code>, "
            "<code>[overview_site_auburndale_health]</code>; demo variants "
            "<code>[overview_site_demo_healthy/warning/critical]</code> back the picker preview.</li>"
            "<li><b>Site normalisation</b><br><code>dnac_site_normalize</code> handles the "
            "ORL / OEM / Florida Hospital path variants.</li>"
            "</ul>"
        ),
    },
    "overview_site_auburndale_health": {
        "related_info": (
            "<ul>"
            "<li><b>Map consumer</b><br>Rendered by <code>CustomerTopologyMap</code> "
            "as the Auburndale site marker.</li>"
            "<li><b>Sibling stanzas</b><br><code>[overview_site_tallahassee_health]</code>, "
            "<code>[overview_site_orlando_health]</code>; demo variants "
            "<code>[overview_site_demo_healthy/warning/critical]</code> back the picker preview.</li>"
            "<li><b>Site normalisation</b><br><code>dnac_site_normalize</code> handles the AUB "
            "and Polk / Auburndale path variants.</li>"
            "</ul>"
        ),
    },
    # ---------- Overview map: per-link health ----------
    "overview_link_orlando_tallahassee_health": {
        "related_info": (
            "<ul>"
            "<li><b>Map consumer</b><br>Rendered by <code>CustomerTopologyMap</code> as the "
            "ORL&harr;TLH connectivity line; the React layer reads "
            "<code>linkUtilizationMbps</code>, <code>capacityMbps</code>, and "
            "<code>status</code>.</li>"
            "<li><b>Sibling stanzas</b><br><code>[overview_link_auburndale_tallahassee_health]</code>, "
            "<code>[overview_link_orlando_auburndale_health]</code>; demo variants "
            "<code>[overview_link_demo_healthy/warning/critical]</code>.</li>"
            "<li><b>Capacity convention</b><br>Static capacity values come from the "
            "design-of-record; tune them via the <code>linkCapacities</code> table in "
            "<code>CustomerTopologyMap.tsx</code>.</li>"
            "</ul>"
        ),
    },
    "overview_link_auburndale_tallahassee_health": {
        "related_info": (
            "<ul>"
            "<li><b>Map consumer</b><br>Rendered by <code>CustomerTopologyMap</code> as the "
            "AUB&harr;TLH connectivity line.</li>"
            "<li><b>Sibling stanzas</b><br><code>[overview_link_orlando_tallahassee_health]</code>, "
            "<code>[overview_link_orlando_auburndale_health]</code>; demo variants "
            "<code>[overview_link_demo_healthy/warning/critical]</code>.</li>"
            "<li><b>Capacity convention</b><br>Static capacity values come from the "
            "design-of-record; tune via <code>linkCapacities</code> in "
            "<code>CustomerTopologyMap.tsx</code>.</li>"
            "</ul>"
        ),
    },
    "overview_link_orlando_auburndale_health": {
        "related_info": (
            "<ul>"
            "<li><b>Map consumer</b><br>Rendered by <code>CustomerTopologyMap</code> as the "
            "ORL&harr;AUB connectivity line.</li>"
            "<li><b>Sibling stanzas</b><br><code>[overview_link_orlando_tallahassee_health]</code>, "
            "<code>[overview_link_auburndale_tallahassee_health]</code>; demo variants "
            "<code>[overview_link_demo_healthy/warning/critical]</code>.</li>"
            "<li><b>Capacity convention</b><br>Static capacity values come from the "
            "design-of-record; tune via <code>linkCapacities</code> in "
            "<code>CustomerTopologyMap.tsx</code>.</li>"
            "</ul>"
        ),
    },
    # ---------- Overview map: demo / synthetic site variants ----------
    "overview_site_demo_healthy": {
        "related_info": (
            "<ul>"
            "<li><b>Purpose</b><br>Synthetic <code>healthPct=100</code> row for the picker "
            "preview &mdash; lets dashboard authors see how a healthy site marker renders "
            "without waiting for live <code>cisco:dnac:devicehealth</code> data.</li>"
            "<li><b>Sibling demo stanzas</b><br><code>[overview_site_demo_warning]</code>, "
            "<code>[overview_site_demo_critical]</code>.</li>"
            "<li><b>Production analogue</b><br>The 3 live <code>overview_site_*_health</code> "
            "stanzas (Tallahassee / Orlando / Auburndale) emit the same row shape from real data.</li>"
            "</ul>"
        ),
    },
    "overview_site_demo_warning": {
        "related_info": (
            "<ul>"
            "<li><b>Purpose</b><br>Synthetic <code>healthPct=80</code> row to preview the "
            "warning marker style in the picker.</li>"
            "<li><b>Sibling demo stanzas</b><br><code>[overview_site_demo_healthy]</code>, "
            "<code>[overview_site_demo_critical]</code>.</li>"
            "<li><b>Production analogue</b><br>Live <code>overview_site_*_health</code> stanzas "
            "emit the same row shape from <code>cisco:dnac:devicehealth</code>.</li>"
            "</ul>"
        ),
    },
    "overview_site_demo_critical": {
        "related_info": (
            "<ul>"
            "<li><b>Purpose</b><br>Synthetic <code>healthPct=55</code> row to preview the "
            "critical marker style in the picker.</li>"
            "<li><b>Sibling demo stanzas</b><br><code>[overview_site_demo_healthy]</code>, "
            "<code>[overview_site_demo_warning]</code>.</li>"
            "<li><b>Production analogue</b><br>Live <code>overview_site_*_health</code> stanzas "
            "emit the same row shape from <code>cisco:dnac:devicehealth</code>.</li>"
            "</ul>"
        ),
    },
    # ---------- Overview map: demo / synthetic link variants ----------
    "overview_link_demo_healthy": {
        "related_info": (
            "<ul>"
            "<li><b>Purpose</b><br>Synthetic healthy-link row for the picker preview.</li>"
            "<li><b>Sibling demo stanzas</b><br><code>[overview_link_demo_warning]</code>, "
            "<code>[overview_link_demo_critical]</code>.</li>"
            "<li><b>Production analogue</b><br>Live <code>overview_link_*_health</code> stanzas "
            "emit the same row shape from WAN telemetry.</li>"
            "</ul>"
        ),
    },
    "overview_link_demo_warning": {
        "related_info": (
            "<ul>"
            "<li><b>Purpose</b><br>Synthetic warning-link row for the picker preview.</li>"
            "<li><b>Sibling demo stanzas</b><br><code>[overview_link_demo_healthy]</code>, "
            "<code>[overview_link_demo_critical]</code>.</li>"
            "<li><b>Production analogue</b><br>Live <code>overview_link_*_health</code> stanzas "
            "emit the same row shape from WAN telemetry.</li>"
            "</ul>"
        ),
    },
    "overview_link_demo_critical": {
        "related_info": (
            "<ul>"
            "<li><b>Purpose</b><br>Synthetic critical-link row for the picker preview.</li>"
            "<li><b>Sibling demo stanzas</b><br><code>[overview_link_demo_healthy]</code>, "
            "<code>[overview_link_demo_warning]</code>.</li>"
            "<li><b>Production analogue</b><br>Live <code>overview_link_*_health</code> stanzas "
            "emit the same row shape from WAN telemetry.</li>"
            "</ul>"
        ),
    },
    # ---------- Overview umbrella ----------
    "overview_topology_overview": {
        "related_info": (
            "<ul>"
            "<li><b>Map consumer</b><br>Used by <code>CustomerTopologyMap</code> as a "
            "summary banner / fallback when individual site stanzas haven&rsquo;t loaded.</li>"
            "<li><b>Sibling stanzas</b><br>The per-site (<code>overview_site_*_health</code>) "
            "and per-link (<code>overview_link_*_health</code>) stanzas back the individual "
            "markers and lines on the same map.</li>"
            "<li><b>Hidden from picker</b><br>This stanza is queried directly by the React "
            "overview page, so it intentionally does NOT carry the picker-gate "
            "<code>Cisco</code> tag.</li>"
            "</ul>"
        ),
    },
    # ---------- Shared / nav helpers ----------
    "shared_ds_dev_health_trend": {
        "explanation": (
            "<p>Drives the device-health trend panel shared across multiple Studio "
            "dashboards. Reads <code>cisco:dnac:devicehealth</code>, scores each device "
            "(0/50/100 by reachability + manageability), and timecharts the average. "
            "Centralised here so every dashboard renders the same trend definition without "
            "duplicating SPL.</p>"
        ),
        "solution": (
            "<p>Returns a single timechart series suitable for any line / area panel. "
            "Drops in volume mean either fewer monitored devices or more devices entering "
            "an unreachable / unmanaged state.</p>"
        ),
        "related_info": (
            "<ul>"
            "<li><b>Reuse pattern</b><br>Multiple Studio dashboards bind their device-health "
            "trend tile to this stanza so the calculation stays consistent.</li>"
            "<li><b>Sibling shared stanzas</b><br><code>[shared_ds_annotations]</code> "
            "supplies overlay annotations; pair the two for richer trend storytelling.</li>"
            "</ul>"
        ),
    },
    "building_resilience_ds_room_detail": {
        "explanation": (
            "<p>Underpins the room-level detail drill-down on the Building Resilience "
            "dashboard. Aggregates per-room sensor and presence telemetry into a single "
            "row so the panel can render without each tile re-running the SPL.</p>"
        ),
        "solution": (
            "<p>Returns one row per room with the latest health, occupancy, and sensor "
            "snapshot. The Building Resilience dashboard's room-detail drilldown reads "
            "directly from this dataset.</p>"
        ),
        "related_info": (
            "<ul>"
            "<li><b>Dashboard consumer</b><br>Building Resilience &rarr; Room Detail "
            "drilldown.</li>"
            "<li><b>Hidden from picker</b><br>Internal helper queried by name from the "
            "dashboard; intentionally does NOT carry the <code>Cisco</code> picker-gate "
            "tag.</li>"
            "</ul>"
        ),
    },
    "shared_ds_annotations": {
        "explanation": (
            "<p>Centralised event-annotation feed for trend panels: surfaces "
            "change-windows, deploy markers, and incident timestamps that other shared "
            "datasources (e.g. <code>[shared_ds_dev_health_trend]</code>) can overlay.</p>"
        ),
        "solution": (
            "<p>Returns timestamped annotation rows ready for <code>splunk.line</code> / "
            "<code>splunk.area</code> overlay configuration. Empty result simply means "
            "no annotated events in the selected window.</p>"
        ),
        "related_info": (
            "<ul>"
            "<li><b>Pairs well with</b><br><code>[shared_ds_dev_health_trend]</code> and "
            "any other timechart panel that benefits from change-window context.</li>"
            "<li><b>Hidden from picker</b><br>Internal helper queried by dashboards "
            "directly; intentionally does NOT carry the <code>Cisco</code> picker-gate tag.</li>"
            "</ul>"
        ),
    },
}


def split_into_stanzas(text: str) -> list[tuple[str | None, str]]:
    chunks: list[tuple[str | None, str]] = []
    current_name: str | None = None
    current_body: list[str] = []
    for line in text.splitlines(keepends=True):
        m = re.match(r"^\[([^\]]+)\]\s*\n?$", line)
        if m:
            chunks.append((current_name, "".join(current_body)))
            current_name = m.group(1)
            current_body = [line]
        else:
            current_body.append(line)
    chunks.append((current_name, "".join(current_body)))
    return chunks


def has_prop(body: str, key: str) -> bool:
    pattern = rf"^{re.escape(key)}\s*=\s*\S+"
    return re.search(pattern, body, flags=re.M) is not None


def insert_prop_before_search(body: str, key: str, value: str) -> str:
    """Insert ``key = value`` immediately before the ``search = ...`` line.

    Falls back to appending to the end of the stanza body if no
    ``search`` field is found.
    """
    line = f"{key} = {value}\n"
    m = re.search(r"^search\s*=", body, flags=re.M)
    if m:
        return body[: m.start()] + line + body[m.start() :]
    return body + line


def get_prop(body: str, key: str) -> str | None:
    m = re.search(rf"^{re.escape(key)}\s*=\s*(.*)$", body, flags=re.M)
    return m.group(1).rstrip() if m else None


def set_prop(body: str, key: str, value: str) -> str:
    pattern = rf"^({re.escape(key)}\s*=\s*).*$"
    if re.search(pattern, body, flags=re.M):
        return re.sub(pattern, lambda m: f"{m.group(1)}{value}", body, count=1, flags=re.M)
    return insert_prop_before_search(body, key, value)


def bump_version(version: str | None) -> str:
    if not version:
        return "1.0.1"
    parts = version.strip().split(".")
    if not parts or not parts[-1].isdigit():
        return f"{version}.1"
    parts[-1] = str(int(parts[-1]) + 1)
    return ".".join(parts)


def main() -> int:
    text = SEARCHBASE.read_text()
    chunks = split_into_stanzas(text)

    touched: list[tuple[str, list[str]]] = []
    for i, (name, body) in enumerate(chunks):
        if name is None or name not in FILLS:
            continue
        original_body = body
        added: list[str] = []
        for key, value in FILLS[name].items():
            if not has_prop(body, key):
                body = insert_prop_before_search(body, key, value)
                added.append(key)
        if body != original_body:
            current_version = get_prop(body, "version")
            body = set_prop(body, "version", bump_version(current_version))
            body = set_prop(body, "date_updated", DATE_NEW)
            body = set_prop(body, "updated_author", AUTHOR_NEW)
            touched.append((name, added))
            chunks[i] = (name, body)

    new_text = "".join(b for _, b in chunks)
    if new_text == text:
        print("No changes (already filled).")
        return 0
    SEARCHBASE.write_text(new_text)
    print(f"Wrote {SEARCHBASE.relative_to(ROOT)}")
    print(f"Touched {len(touched)} stanzas:")
    for name, added in touched:
        print(f"  - [{name}]  added: {', '.join(added)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
