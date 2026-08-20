#!/usr/bin/env python3
"""Validate Searchbase and UI drill-down contracts without a Splunk runtime."""

from __future__ import annotations

import re
import sys
from pathlib import Path
from urllib.parse import parse_qs, urlparse


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
PACKAGE_ROOT = REPOSITORY_ROOT / "packages" / "splunk-cisco-dashboards"
SEARCHBASE_PATH = (
    PACKAGE_ROOT / "src/main/resources/splunk/default/searchbase.conf"
)
STUDIO_VIEW_DIRECTORY = (
    PACKAGE_ROOT / "src/main/resources/splunk/default/data/ui/views"
)


def parse_searchbase(source: str) -> dict[str, dict[str, str]]:
    records: dict[str, dict[str, str]] = {}
    current: dict[str, str] | None = None

    for line in source.splitlines():
        stanza_match = re.fullmatch(r"\[([^\]]+)\]", line)
        if stanza_match:
            stanza_id = stanza_match.group(1)
            if stanza_id in records:
                raise ValueError(f"Duplicate Searchbase stanza: {stanza_id}")
            current = {"id": stanza_id}
            records[stanza_id] = current
            continue
        if current is None:
            continue
        field_match = re.match(r"^([A-Za-z0-9_]+)\s*=\s*(.*)$", line)
        if field_match:
            current[field_match.group(1)] = field_match.group(2).strip()

    return records


def require(condition: bool, message: str, failures: list[str]) -> None:
    if not condition:
        failures.append(message)


def main() -> int:
    failures: list[str] = []
    searchbase_source = SEARCHBASE_PATH.read_text(encoding="utf-8")
    try:
        records = parse_searchbase(searchbase_source)
    except ValueError as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1

    by_name = {
        record["search_name"]: record
        for record in records.values()
        if record.get("search_name")
    }

    relationship_count = 0
    table_source_count = 0
    for source in records.values():
        source_has_drilldown = False
        for field in (
            "drilldown_stanza_id",
            "drilldown_stanza_ids",
            "drilldown_search_name",
        ):
            for target in filter(None, map(str.strip, source.get(field, "").split(","))):
                source_has_drilldown = True
                relationship_count += 1
                resolved_target = records.get(target) or by_name.get(target)
                require(
                    resolved_target is not None,
                    f"{source['id']} {field} does not resolve {target}",
                    failures,
                )
                require(
                    bool(resolved_target and resolved_target.get("search")),
                    f"{source['id']} {field} target {target} has no search",
                    failures,
                )
        if source_has_drilldown and source.get("default_viz") == "splunk.table":
            table_source_count += 1
            require(
                bool(source.get("drilldown_button_title")),
                f"Table source {source['id']} needs an explicit drill-down label",
                failures,
            )

    expected_mappings = {
        "network_intelligence_blocked_vs_allowed":
            "network_intelligence_blocked_flow_detail",
        "user_experience_ds_wireless_signal_quality":
            "user_experience_ds_wireless_signal_quality_detail",
        "security_resilience_sdwan_utd_top_signatures":
            "security_resilience_sdwan_utd_signature_event_detail",
        "security_resilience_sdwan_utd_amp_disposition_trend":
            "security_resilience_sdwan_utd_amp_top_malware",
    }
    for source_id, target_id in expected_mappings.items():
        source = records.get(source_id, {})
        target = records.get(target_id, {})
        require(
            source.get("drilldown_stanza_id") == target_id,
            f"{source_id} must drill down to {target_id}",
            failures,
        )
        require(
            target.get("default_viz") == "splunk.table",
            f"{target_id} must remain an event/detail table",
            failures,
        )

    require(
        re.search(
            r"^drilldown_button_title\s*=.*\bselected\b",
            searchbase_source,
            flags=re.IGNORECASE | re.MULTILINE,
        )
        is None,
        "Tile-level actions must not imply that a row or category was selected",
        failures,
    )

    studio_target_count = 0
    for view_path in sorted(STUDIO_VIEW_DIRECTORY.glob("sn_*.xml")):
        view_source = view_path.read_text(encoding="utf-8")
        for relative_url in re.findall(r'/drilldown\?[^"\s]+', view_source):
            targets = parse_qs(urlparse(relative_url).query).get("target", [""])[0]
            for target in filter(None, map(str.strip, targets.split(","))):
                studio_target_count += 1
                resolved_target = records.get(target) or by_name.get(target)
                require(
                    resolved_target is not None,
                    f"{view_path.name} does not resolve Studio target {target}",
                    failures,
                )
                require(
                    bool(resolved_target and resolved_target.get("search")),
                    f"{view_path.name} target {target} has no search",
                    failures,
                )

    require(studio_target_count > 0, "Studio drill-down inventory is empty", failures)

    expected_studio_targets = {
        "sn_hmf_enforcement.xml": (
            "target=secure_networking_sgt_palo_alto_policy_effectiveness,"
            "secure_networking_sgt_palo_alto_traffic_detail"
        ),
        "sn_zta_posture.xml":
            "target=secure_networking_zta_user_activity_cross_source",
        "sn_zta_user_activity_monitoring.xml": (
            "target=secure_networking_zta_user_activity_cross_source,"
            "secure_networking_infra_duo_application_access"
        ),
    }
    for view_name, target_text in expected_studio_targets.items():
        view_source = (STUDIO_VIEW_DIRECTORY / view_name).read_text(encoding="utf-8")
        require(
            target_text in view_source,
            f"{view_name} must use canonical target ids",
            failures,
        )

    workspace_source = (
        PACKAGE_ROOT / "src/main/webapp/pages/executive_insights/index.tsx"
    ).read_text(encoding="utf-8")
    table_tile_source = (
        PACKAGE_ROOT / "src/main/webapp/common/components/workspace/TableTile.tsx"
    ).read_text(encoding="utf-8")
    dashboard_drilldown_source = (
        PACKAGE_ROOT / "src/main/webapp/common/lib/dashboardDrilldown.js"
    ).read_text(encoding="utf-8")
    drilldown_action_source = (
        PACKAGE_ROOT
        / "src/main/webapp/pages/dashboardbuilder/DrilldownActionViz.jsx"
    ).read_text(encoding="utf-8")
    dashboard_modal_source = (
        PACKAGE_ROOT
        / "src/main/webapp/pages/dashboardbuilder/DashboardStudioDrilldownModal.jsx"
    ).read_text(encoding="utf-8")
    common_styles_source = (
        PACKAGE_ROOT / "src/main/webapp/common/styles/commonstyles.css"
    ).read_text(encoding="utf-8")

    workspace_contracts = {
        "target visualization metadata": "defaultViz: detail.defaultViz",
        "visualization definition": "buildWorkspaceDrilldownDefinition",
        "Dashboard Studio renderer": "<DashboardContextProvider",
        "view-only preset": "preset={EnterpriseViewOnlyPreset}",
        "table accessible name": "aria-labelledby={resultTitleId}",
        "canonical paginator": '<Paginator.Compact',
    }
    for label, contract in workspace_contracts.items():
        require(contract in workspace_source, f"Workspace is missing {label}", failures)

    require(
        re.search(
            r"data-detail-visualization=\{\s*activeConfig\.defaultViz",
            workspace_source,
        )
        is not None,
        "Workspace is missing visualization identity",
        failures,
    )

    require(
        'className="sui-bg-section transition-colors sui-hover-bg-overlay"'
        not in workspace_source,
        "Detail-table rows must not advertise an unavailable row action",
        failures,
    )
    require(
        "aria-label={`${label} results`}" in table_tile_source,
        "Compact tables must have an accessible name",
        failures,
    )
    require(
        "sui-hover-bg-overlay transition-colors" not in table_tile_source,
        "Compact table rows must not advertise an unavailable row action",
        failures,
    )
    require(
        "DASHBOARD_DRILLDOWN_ACCESSIBLE_TITLE = 'View details'"
        in dashboard_drilldown_source,
        "Dashboard drill-down controls need an action-accurate accessible title",
        failures,
    )
    require(
        "type: DASHBOARD_DRILLDOWN_ACTION_TYPE" in dashboard_drilldown_source,
        "Dashboard drill-down definitions need the custom action visualization",
        failures,
    )
    require(
        "@splunk/react-icons/MagnifierWithPlus" in drilldown_action_source,
        "Dashboard drill-down action must use the selected React icon",
        failures,
    )
    require(
        "hideLabel" in drilldown_action_source
        and "label={label}" in drilldown_action_source,
        "Dashboard drill-down action needs a hover and focus label",
        failures,
    )
    require(
        "type: 'ds.search'" in dashboard_drilldown_source,
        "Workspace visualizations must use the supported ds.search source",
        failures,
    )
    require(
        "DrilldownArrow" not in dashboard_modal_source,
        "Dashboard Studio must not duplicate Paginator navigation with overlay arrows",
        failures,
    )
    require(
        "body.dashboard-builder-drilldown-open" not in common_styles_source,
        "Drill-down CSS must not target generated SUI implementation classes",
        failures,
    )

    if failures:
        for failure in failures:
            print(f"ERROR: {failure}", file=sys.stderr)
        return 1

    print(
        "Validated "
        f"{len(records)} Searchbase stanzas, "
        f"{relationship_count} Searchbase drill-down relationships, and "
        f"{studio_target_count} Dashboard Studio targets; "
        f"{table_source_count} table sources have explicit labels."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
