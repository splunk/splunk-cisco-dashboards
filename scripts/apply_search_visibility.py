#!/usr/bin/env python3
"""Unhide reviewed searchbase stanzas by setting search_hidden = 0.

Why this is a script and not a hand edit
----------------------------------------
apply_searchbase_taxonomy.py is routinely run as:

    git checkout HEAD -- <searchbase.conf>
    python3 scripts/apply_searchbase_taxonomy.py --apply

That checkout restores HEAD, and the taxonomy classifier only manages
category, sub_category, and tags, so it will not re-apply a visibility
change. Any hand edit to search_hidden is therefore silently lost on the
next taxonomy rebuild. Keeping the decision here makes it replayable:
re-run this script after any rebuild and the state is restored.

This script rewrites only 'search_hidden' lines on the stanzas named below.
Stanza ids, SPL bodies, and every other key are passed through untouched and
verified afterwards.

Usage:
    python3 scripts/apply_search_visibility.py --check   # verify, write nothing
    python3 scripts/apply_search_visibility.py --apply
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

SOURCE = (
    Path(__file__).resolve().parent.parent
    / "packages/splunk-cisco-dashboards/src/main/resources/splunk/default/searchbase.conf"
)

MANAGED_KEY = "search_hidden"

# ---------------------------------------------------------------------------
# Unhidden
# ---------------------------------------------------------------------------
# Every stanza below was verified to resolve all of its macros and lookups, to
# carry a real default_viz, and not to duplicate an already-visible search.

# Orphaned base searches from the Cisco Spaces Intelligence v1 refactor. That
# dashboard moved to self-contained inline ds.search panels -- see its own
# "Architecture" note -- which left these stanzas unreferenced but not wrong.
UNHIDE_SPACES_INTELLIGENCE: tuple[str, ...] = (
    "dashboard_spaces_intelligence_v1_operations_compare_chart",
    "dashboard_spaces_intelligence_v1_operations_surge",
    "dashboard_spaces_intelligence_v1_ap_health_dist",
    "dashboard_spaces_intelligence_v1_ap_health_table",
    "dashboard_spaces_intelligence_v1_band_distribution",
    "dashboard_spaces_intelligence_v1_capacity_gauge_first",
    "dashboard_spaces_intelligence_v1_capacity_predict",
    "dashboard_spaces_intelligence_v1_capacity_trend",
    "dashboard_spaces_intelligence_v1_client_health_by_site",
    "dashboard_spaces_intelligence_v1_convergence_health",
    "dashboard_spaces_intelligence_v1_convergence_occupancy",
    "dashboard_spaces_intelligence_v1_env_occupancy_overlay",
    "dashboard_spaces_intelligence_v1_env_scatter",
    "dashboard_spaces_intelligence_v1_issues_by_site",
    "dashboard_spaces_intelligence_v1_issues_with_occupancy",
    "dashboard_spaces_intelligence_v1_kpi_avg_week",
    "dashboard_spaces_intelligence_v1_kpi_peak_today",
    "dashboard_spaces_intelligence_v1_net_kpi_client_health",
    "dashboard_spaces_intelligence_v1_net_kpi_compliance",
    "dashboard_spaces_intelligence_v1_occupancy_vs_health",
    "dashboard_spaces_intelligence_v1_onboarding_vs_occupancy",
    "dashboard_spaces_intelligence_v1_user_count_city",
    "dashboard_spaces_intelligence_v1_visitor_map",
    "dashboard_spaces_intelligence_v1_week_compare",
    "dashboard_spaces_intelligence_v1_wifi_with_occupancy",
    "dashboard_spaces_intelligence_v1_operations_compare_kpi",
    "dashboard_spaces_intelligence_v1_operations_env",
    "dashboard_spaces_intelligence_v1_operations_kpi_ssid",
    "dashboard_spaces_intelligence_v1_operations_wifi",
    "dashboard_spaces_intelligence_v1_dwell_distribution",
    "dashboard_spaces_intelligence_v1_env_kpi_temp",
    "dashboard_spaces_intelligence_v1_env_summary",
    "dashboard_spaces_intelligence_v1_humidity_trend",
    "dashboard_spaces_intelligence_v1_inter_campus",
    "dashboard_spaces_intelligence_v1_kpi_repeat_pct",
    "dashboard_spaces_intelligence_v1_room_kpi_ghost",
    "dashboard_spaces_intelligence_v1_room_kpi_hot",
    "dashboard_spaces_intelligence_v1_room_kpi_total",
    "dashboard_spaces_intelligence_v1_room_punchcard",
    "dashboard_spaces_intelligence_v1_room_tier_pie",
    "dashboard_spaces_intelligence_v1_room_top_bar",
    "dashboard_spaces_intelligence_v1_room_util",
    "dashboard_spaces_intelligence_v1_sankey_flow",
    "dashboard_spaces_intelligence_v1_ssid_daily",
    "dashboard_spaces_intelligence_v1_temp_trend",
    "dashboard_spaces_intelligence_v1_visitor_daily",
)

# Orphaned base searches from the IT Health v1 dashboard refactor.
UNHIDE_IT_HEALTH: tuple[str, ...] = (
    "dashboard_it_health_v1_config_detail",
    "dashboard_it_health_v1_config_trend",
    "dashboard_it_health_v1_intf_util",
    "dashboard_it_health_v1_ise_device_logins",
    "dashboard_it_health_v1_issue_by_priority",
    "dashboard_it_health_v1_issue_by_severity",
    "dashboard_it_health_v1_issue_by_site",
    "dashboard_it_health_v1_issue_trend",
    "dashboard_it_health_v1_issues_trend",
    "dashboard_it_health_v1_kpi_issues",
    "dashboard_it_health_v1_kpi_reboots",
    "dashboard_it_health_v1_kpi_unreachable",
    "dashboard_it_health_v1_open_issues",
    "dashboard_it_health_v1_top_client_issues",
    "dashboard_it_health_v1_top_sites_issues",
    "dashboard_it_health_v1_ap_by_location",
    "dashboard_it_health_v1_cpu_mem",
    "dashboard_it_health_v1_health_dist",
    "dashboard_it_health_v1_kpi_cpu_mem",
    "dashboard_it_health_v1_kpi_dhcp",
    "dashboard_it_health_v1_kpi_syslog",
    "dashboard_it_health_v1_link_graph",
    "dashboard_it_health_v1_reboots",
    "dashboard_it_health_v1_site_health_distribution",
    "dashboard_it_health_v1_topology_by_role",
    "dashboard_it_health_v1_topology_device_table",
    "dashboard_it_health_v1_unreachable",
    "dashboard_it_health_v1_uxh_top_client_os",
    "dashboard_it_health_v1_uxh_top_device_types",
)

# Orphaned base searches from the NetOps Readiness v1 dashboard refactor.
UNHIDE_NETOPS_READINESS: tuple[str, ...] = (
    "dashboard_netops_readiness_v1_correlation_strip",
    "dashboard_netops_readiness_v1_q3_aps_poor_health",
    "dashboard_netops_readiness_v1_q5_ap_saturation",
    "dashboard_netops_readiness_v1_q5_at_risk_count",
    "dashboard_netops_readiness_v1_score_a",
    "dashboard_netops_readiness_v1_a_nrs_forecast",
    "dashboard_netops_readiness_v1_b_capacity_gauge",
    "dashboard_netops_readiness_v1_c_issues_forecast",
    "dashboard_netops_readiness_v1_d_wow_users",
    "dashboard_netops_readiness_v1_q10_recovery_health",
    "dashboard_netops_readiness_v1_q10_recovery_onboarding",
    "dashboard_netops_readiness_v1_q1_people_per_ap",
    "dashboard_netops_readiness_v1_q2_capacity_headroom",
    "dashboard_netops_readiness_v1_q4_concurrent_users",
    "dashboard_netops_readiness_v1_q4_onboarding_per_site",
    "dashboard_netops_readiness_v1_q6_issues_severity",
    "dashboard_netops_readiness_v1_q6_occupancy_overlay",
    "dashboard_netops_readiness_v1_q7_ssid_concurrency",
    "dashboard_netops_readiness_v1_q8_surge_per_building",
    "dashboard_netops_readiness_v1_q9_worst_clients",
    "dashboard_netops_readiness_v1_score_drisk",
    "dashboard_netops_readiness_v1_score_nrs_trend",
    "dashboard_netops_readiness_v1_score_per_site",
    "dashboard_netops_readiness_v1_score_q",
    "dashboard_netops_readiness_v1_score_r",
)

# Catalyst Center tiles inherited from TA_cisco_catalyst.
UNHIDE_CATALYST_CENTER: tuple[str, ...] = (
    "catalyst_center_exec_issue_summary",
    "catalyst_center_device_health_detail",
    "catalyst_center_client_details_wired_and_wireless",
    "catalyst_center_client_distribution",
    "catalyst_center_access_points",
    "catalyst_center_device_health_distribution",
    "catalyst_center_routers",
    "catalyst_center_switches",
    "catalyst_center_device_inventory",
    "catalyst_center_issues",
    "catalyst_center_clients_by_band_type",
    "catalyst_center_session_hours_by_protocol",
    "catalyst_center_traffic_by_band_mb",
    "catalyst_center_traffic_by_protocol_over_time",
    "catalyst_center_traffic_by_ssid_over_time",
    "catalyst_center_access_point_count_trend",
    "catalyst_center_open_issues_by_priority_p1_p4",
    "catalyst_center_kpi_deltas_this_week_vs_last_week",
    "catalyst_center_ap_reachability",
    "catalyst_center_client_health",
)

# Orphaned base searches from the Workplace SPOG v1 dashboard refactor.
UNHIDE_WORKPLACE_SPOG: tuple[str, ...] = (
    "dashboard_workplace_spog_v1_t1_occupancy_kpi",
    "dashboard_workplace_spog_v1_correlation",
    "dashboard_workplace_spog_v1_issues",
    "dashboard_workplace_spog_v1_main_trend",
    "dashboard_workplace_spog_v1_persite",
    "dashboard_workplace_spog_v1_t2_nqi_kpi",
    "dashboard_workplace_spog_v1_t3_network_power_kpi",
    "dashboard_workplace_spog_v1_t4_security_kpi",
    "dashboard_workplace_spog_v1_t5_nrs_kpi",
)

# Orphaned base searches from the Building Intelligence v1 refactor.
UNHIDE_BUILDING_INTELLIGENCE: tuple[str, ...] = (
    "dashboard_building_v1_device_presence_trend",
    "dashboard_building_v1_kpi_devices",
    "dashboard_building_v1_kpi_ssids",
    "dashboard_building_v1_kpi_users",
    "dashboard_building_v1_webex_people_trend",
    "dashboard_building_v1_webex_trend",
)

# Orphaned base searches from the Security v1 dashboard refactor.
UNHIDE_SECURITY_V1: tuple[str, ...] = (
    "dashboard_security_v1_identity_detail_trend",
    "dashboard_security_v1_priv_trend",
    "dashboard_security_v1_fw_allowed_trend",
    "dashboard_security_v1_ise_auth",
    "dashboard_security_v1_ise_fail_trend",
    "dashboard_security_v1_kpi_failed",
)

# One-off orphans that share no family with the rest.
UNHIDE_ASSORTED: tuple[str, ...] = (
    "it_critical_systems_wan_bandwidth_detail",
    "admin_macro_index_tuning",
    "overview_xdr_critical_incidents",
    "overview_top_incident_volume",
    "asset_inventory_ot_devices_by_vendor",
)

UNHIDE: tuple[str, ...] = (
    UNHIDE_SPACES_INTELLIGENCE
    + UNHIDE_IT_HEALTH
    + UNHIDE_NETOPS_READINESS
    + UNHIDE_CATALYST_CENTER
    + UNHIDE_WORKPLACE_SPOG
    + UNHIDE_BUILDING_INTELLIGENCE
    + UNHIDE_SECURITY_V1
    + UNHIDE_ASSORTED
)

# Nothing is being held back now that the Spaces Intelligence trial is applied.
# Kept as a named slot so a future batch has an obvious place to land.
DEFERRED: dict[str, tuple[str, ...]] = {}

# ---------------------------------------------------------------------------
# Deliberately still hidden
# ---------------------------------------------------------------------------
# Recorded so the reasoning survives. verify() asserts these are still hidden,
# so promoting one by accident fails the run rather than shipping silently.

# Each of these restates a search that is already visible, differing only in
# cosmetics or a filter literal. Surfacing them would give the catalogue two
# entries answering one question.
KEEP_HIDDEN_NEAR_DUPLICATE: tuple[str, ...] = (
    "dashboard_it_health_v1_kpi_net_health",
    "dashboard_it_health_v1_net_health_trend",
    "dashboard_it_health_v1_network_health",
    "dashboard_it_health_v1_uxh_wired_health",
    "dashboard_it_health_v1_uxh_wireless_health",
    "catalyst_center_wireless_health",
    "catalyst_center_wired_client_trend",
    "catalyst_center_wired_health_trend",
    "catalyst_center_wired_total_trend",
    "catalyst_center_wireless_total_trend",
    "catalyst_center_total_issue_trend",
    "dashboard_building_v1_occupancy_trend",
    "dashboard_building_v1_rooms",
    "dashboard_building_v1_ssid_clients",
    "dashboard_it_health_v1_device_health",
    "dashboard_it_health_v1_inv_total",
    "dashboard_security_v1_failed_detail_users",
    "dashboard_security_v1_kpi_privileged",
    "dashboard_security_v1_lockouts_trend",
    "catalyst_center_all_clients_total_trend",
    "catalyst_center_client_activity_and_onboarding",
    "catalyst_center_client_distribution_by_location",
    "catalyst_center_client_distribution_by_os",
    "catalyst_center_past_week_client_trends",
    "catalyst_center_clients_by_device_type",
    "catalyst_center_clients_by_location",
    "catalyst_center_ssids_by_client_count",
    "catalyst_center_client_onboarding_time_avg_ms",
    "catalyst_center_session_hours_by_band",
    "catalyst_center_top_ssids_by_session_hours",
    "catalyst_center_top_clients_by_data_usage",
    "catalyst_center_sites_with_highest_client_health",
    "catalyst_center_network_device_counts",
    "catalyst_center_sites_with_highest_of_devices_in_good_health",
    "catalyst_center_healthy_devices",
)

# Reached from a parent tile's drilldown, which supplies the row context they
# filter on. Standalone they render unscoped and misleading.
KEEP_HIDDEN_DRILLDOWN_TARGET: tuple[str, ...] = (
    "building_resilience_sensor_detail",
    "security_resilience_dns_base_search",
    "network_intelligence_blocked_flow_detail",
    "asset_inventory_ds_gap_analysis",
    "it_critical_systems_ds_base_devicehealth",
    "it_critical_systems_ds_base_issues",
    "security_resilience_ds_base_fw",
    "security_resilience_ds_xdr_detail",
    "user_experience_ds_base_client",
    "user_experience_ds_wireless_signal_quality_detail",
    "it_health_te_app_test_detail",
    "it_health_te_config_event_input_source_last_ingest",
    "overview_xdr_critical_incidents_drilldown",
    "executive_dashboard_building_domain_score_drilldown",
    "security_resilience_sdwan_utd_signature_event_detail",
    "catalyst_center_issue_detail",
    "secure_networking_meraki_threat_event_detail",
    "secure_networking_sse_security_event_detail",
    "secure_networking_fmc_blocked_connection_detail",
    "secure_networking_dc_security_advisory_detail",
    "secure_networking_thousandeyes_bgp_path_change_detail",
)

# Chart-overlay marker data, not tiles: these emit rows of timestamps, labels,
# and hex colour codes for another panel to draw on top of its own series.
KEEP_HIDDEN_ANNOTATION_FEED: tuple[str, ...] = (
    "dashboard_spaces_intelligence_v1_convergence_annotations",
    "dashboard_spaces_intelligence_v1_env_annotation",
    "dashboard_building_v1_annotation_occupancy_spike",
)

# Dashboard Studio chain roots. They intentionally stop before any aggregation
# because the panels that extend them supply it.
KEEP_HIDDEN_BASE_FRAGMENT: tuple[str, ...] = (
    "dashboard_it_health_v1_base_issues_ref",
    "dashboard_it_health_v1_uxh_base_client_ref",
)

# Read the Splunk REST API rather than an index. They work, but only for users
# holding the capability, so they stay out of the general catalogue.
KEEP_HIDDEN_REST: tuple[str, ...] = (
    "admin_cache_hit_summary",
    "admin_schedule_health_advisor",
)

# Synthetic makeresults scaffolding with no data source behind it.
KEEP_HIDDEN_PLACEHOLDER: tuple[str, ...] = (
    "dashboard_spaces_intelligence_v1_operations_annotation",
)

KEEP_HIDDEN: dict[str, tuple[str, ...]] = {
    "near-duplicate of a visible search": KEEP_HIDDEN_NEAR_DUPLICATE,
    "drilldown target": KEEP_HIDDEN_DRILLDOWN_TARGET,
    "chart annotation feed": KEEP_HIDDEN_ANNOTATION_FEED,
    "dashboard chain base fragment": KEEP_HIDDEN_BASE_FRAGMENT,
    "REST API, capability gated": KEEP_HIDDEN_REST,
    "synthetic placeholder": KEEP_HIDDEN_PLACEHOLDER,
}


def stanza_ids(text: str) -> list[str]:
    return re.findall(r"^\[([A-Za-z][A-Za-z0-9_-]*)\]\s*$", text, re.M)


def strip_managed(text: str) -> str:
    """Everything except the managed line, for an equality check."""
    return "\n".join(
        line for line in text.splitlines() if not line.startswith(f"{MANAGED_KEY} = ")
    )


def build(original: str) -> tuple[str, int]:
    targets = set(UNHIDE)
    chunks = re.split(r"(?=^\[[A-Za-z][A-Za-z0-9_-]*\]\s*$)", original, flags=re.M)
    out: list[str] = []
    changed = 0
    for chunk in chunks:
        m = re.match(r"^\[([^\]]+)\]", chunk)
        if not m or m.group(1) not in targets:
            out.append(chunk)
            continue
        if not re.search(rf"^{MANAGED_KEY} = .*$", chunk, re.M):
            raise SystemExit(
                f"[{m.group(1)}] is missing a '{MANAGED_KEY} =' line; refusing to write"
            )
        new_chunk = re.sub(
            rf"^{MANAGED_KEY} = .*$", f"{MANAGED_KEY} = 0", chunk, count=1, flags=re.M
        )
        if new_chunk != chunk:
            changed += 1
        out.append(new_chunk)
    return "".join(out), changed


def verify(original: str, updated: str) -> list[str]:
    errors: list[str] = []

    present = set(stanza_ids(original))
    keep = {n: reason for reason, ids in KEEP_HIDDEN.items() for n in ids}

    for name in UNHIDE:
        if name not in present:
            errors.append(f"unknown stanza id in UNHIDE: {name}")
    for name in keep:
        if name not in present:
            errors.append(f"unknown stanza id in KEEP_HIDDEN: {name}")
    if len(set(UNHIDE)) != len(UNHIDE):
        dupes = sorted({n for n in UNHIDE if UNHIDE.count(n) > 1})
        errors.append(f"stanza listed twice in UNHIDE: {dupes}")

    overlap = set(UNHIDE) & {n for ids in DEFERRED.values() for n in ids}
    if overlap:
        errors.append(f"stanza listed in both UNHIDE and DEFERRED: {sorted(overlap)}")
    blocked = set(UNHIDE) & set(keep)
    if blocked:
        errors.append(
            "stanza is in UNHIDE but recorded as deliberately hidden: "
            + ", ".join(f"{n} ({keep[n]})" for n in sorted(blocked))
        )

    if stanza_ids(original) != stanza_ids(updated):
        errors.append("stanza list changed")

    # The single most important check: nothing outside search_hidden moved.
    if strip_managed(original) != strip_managed(updated):
        errors.append(f"content outside '{MANAGED_KEY}' was modified")

    def searches(text: str) -> list[str]:
        return re.findall(r"^search = (.*?)(?=^[a-z_]+\s*=|\Z)", text, re.M | re.S)

    if searches(original) != searches(updated):
        errors.append("at least one 'search =' body changed")

    # Only the named stanzas may have changed visibility, and each must be 0.
    def visibility(text: str) -> dict[str, str]:
        found = {}
        for chunk in re.split(r"(?=^\[[A-Za-z][A-Za-z0-9_-]*\]\s*$)", text, flags=re.M):
            m = re.match(r"^\[([^\]]+)\]", chunk)
            if not m:
                continue
            v = re.search(rf"^{MANAGED_KEY} = (.*)$", chunk, re.M)
            if v:
                found[m.group(1)] = v.group(1).strip()
        return found

    before, after = visibility(original), visibility(updated)
    if set(before) != set(after):
        errors.append(f"'{MANAGED_KEY}' key appeared or vanished on some stanza")
    moved = {n for n in before if before[n] != after.get(n)}
    if moved - set(UNHIDE):
        errors.append(f"unrequested visibility change: {sorted(moved - set(UNHIDE))}")
    for name in UNHIDE:
        if after.get(name) != "0":
            errors.append(f"[{name}] did not end at {MANAGED_KEY} = 0")
    for name, reason in keep.items():
        if after.get(name) != "1":
            errors.append(f"[{name}] must stay hidden ({reason})")

    for name, value in after.items():
        if value not in ("0", "1"):
            errors.append(f"[{name}] has non-boolean {MANAGED_KEY} {value!r}")

    return errors


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()
    if not (args.apply or args.check):
        ap.error("pass --check or --apply")

    original = SOURCE.read_text()
    updated, changed = build(original)
    errors = verify(original, updated)

    # Re-running must be a no-op, so a rebuild can replay this safely.
    twice, changed_twice = build(updated)
    if twice != updated or changed_twice:
        errors.append("not idempotent: a second run would change the file again")

    deferred_total = sum(len(v) for v in DEFERRED.values())
    keep_total = sum(len(v) for v in KEEP_HIDDEN.values())
    print(f"stanzas unhidden this run: {changed} (of {len(UNHIDE)} managed)")
    print(f"deferred candidates on record: {deferred_total}")
    print(f"deliberately still hidden on record: {keep_total}")
    hidden_after = sum(1 for line in updated.splitlines() if line == f"{MANAGED_KEY} = 1")
    visible_after = sum(1 for line in updated.splitlines() if line == f"{MANAGED_KEY} = 0")
    print(f"visibility after: {visible_after} shown, {hidden_after} hidden")

    if errors:
        print(f"\nVERIFY FAILED ({len(errors)} problems):")
        for e in errors[:20]:
            print(f"  - {e}")
        return 1
    print(f"verify: PASS (stanza list, SPL bodies, and all keys but {MANAGED_KEY} unchanged)")

    if args.apply:
        SOURCE.write_text(updated)
        print(f"\nwrote {SOURCE}")
    else:
        print("\n--check only, nothing written")
    return 0


if __name__ == "__main__":
    sys.exit(main())
