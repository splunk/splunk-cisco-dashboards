#!/usr/bin/env python3
"""Normalize Searchbase visualization metadata, prioritizing Secure Networking."""

from __future__ import annotations

import argparse
import html
import json
import re
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
SEARCHBASE_PATH = (
    REPO_ROOT
    / "packages/splunk-cisco-dashboards/src/main/resources/splunk/default/searchbase.conf"
)
STANZA_PATTERN = re.compile(
    r"(?ms)^\[(?P<name>[A-Za-z0-9_.:-]+)\]\n"
    r"(?P<body>.*?)(?=^\[[A-Za-z0-9_.:-]+\]\n|\Z)"
)

PILLAR_COLORS = {
    "Zero Trust Access": ["#0EA5E9", "#16A34A", "#F59E0B", "#DC2626"],
    "Secure Infrastructure": ["#2563EB", "#16A34A", "#F59E0B", "#DC2626"],
    "Scalable Network Segmentation": ["#0D9488", "#2563EB", "#F59E0B", "#DC2626"],
    "Hybrid Mesh Firewalling": ["#DC2626", "#F59E0B", "#16A34A", "#2563EB"],
    "Agentic Ops": ["#0284C7", "#16A34A", "#F59E0B", "#DC2626"],
}

CATEGORY_COLORS = {
    "Security": ["#DC2626", "#F59E0B", "#2563EB", "#16A34A"],
    "Identity": ["#0EA5E9", "#0D9488", "#F59E0B", "#DC2626"],
    "Network": ["#0284C7", "#0D9488", "#F59E0B", "#DC2626"],
    "Monitoring": ["#2563EB", "#16A34A", "#F59E0B", "#DC2626"],
    "Asset": ["#0D9488", "#2563EB", "#F59E0B", "#DC2626"],
    "Building": ["#16A34A", "#0EA5E9", "#F59E0B", "#DC2626"],
    "Cisco Spaces": ["#16A34A", "#0EA5E9", "#F59E0B", "#DC2626"],
}
DEFAULT_COLORS = ["#0284C7", "#16A34A", "#F59E0B", "#DC2626"]
REQUIRED_DISPATCH_CONTEXT = "splunk-cisco-dashboards"

PILLAR_SECTIONS = {
    "Zero Trust Access": "zta",
    "Secure Infrastructure": "secure_infrastructure",
    "Scalable Network Segmentation": "scalable_network_segmentation",
    "Hybrid Mesh Firewalling": "hybrid_mesh_firewalling",
    "Agentic Ops": "agentic_ops",
}

SCALAR_OPTIONS: dict[str, dict[str, Any]] = {
    "secure_networking_sse_total_security_events": {"valueField": "total_events"},
    "secure_networking_sse_cloud_firewall_blocks_count": {"valueField": "blocked_events"},
    "secure_networking_sse_amp_malware_detections": {
        "valueField": "threat_events",
        "thresholds": {"warning": 1, "critical": 10, "direction": "lower_is_better"},
    },
    "secure_networking_fmc_total_events_count": {"valueField": "total_events"},
    "secure_networking_fmc_blocked_count": {"valueField": "blocked_events"},
    "secure_networking_sgt_total_assignments_count": {"valueField": "total_assignments"},
    "secure_networking_sgt_unique_count": {"valueField": "unique_sgts"},
    "secure_networking_sgt_fmc_blocks_total_count": {"valueField": "sgt_enforced_blocks"},
    "secure_networking_zta_ise_auth_events_count": {"valueField": "auth_events"},
    "secure_networking_zta_ise_failed_auth_count": {
        "valueField": "failed_auth",
        "thresholds": {"warning": 25, "critical": 100, "direction": "lower_is_better"},
    },
    "secure_networking_zta_ise_failed_auth_pct": {
        "valueField": "failed_pct",
        "unit": "%",
        "decimals": 1,
        "thresholds": {"warning": 5, "critical": 10, "direction": "lower_is_better"},
    },
    "secure_networking_zta_ztna_session_count": {"valueField": "ztna_sessions"},
    "secure_networking_dc_anomaly_count": {
        "valueField": "critical_entities",
        "thresholds": {"warning": 1, "critical": 5, "direction": "lower_is_better"},
    },
    "secure_networking_dc_advisory_count": {
        "valueField": "critical_count",
        "thresholds": {"warning": 1, "critical": 5, "direction": "lower_is_better"},
    },
    "secure_networking_meraki_rogue_ap_count": {
        "valueField": "rogue_ap_count",
        "thresholds": {"warning": 1, "critical": 5, "direction": "lower_is_better"},
    },
    "secure_networking_meraki_unencrypted_ssid_count": {
        "valueField": "unencrypted_ssid_count",
        "thresholds": {"warning": 1, "critical": 3, "direction": "lower_is_better"},
    },
    "secure_networking_thousandeyes_test_success_vs_failed": {
        "valueField": "degraded_tests",
        "thresholds": {"warning": 1, "critical": 3, "direction": "lower_is_better"},
    },
    "secure_networking_thousandeyes_avg_latency": {
        "valueField": "avg_latency_ms",
        "unit": "ms",
        "decimals": 2,
        "thresholds": {"warning": 100, "critical": 200, "direction": "lower_is_better"},
    },
    "secure_networking_thousandeyes_avg_loss_pct": {
        "valueField": "avg_loss_pct",
        "unit": "%",
        "decimals": 2,
        "thresholds": {"warning": 1, "critical": 5, "direction": "lower_is_better"},
    },
    "secure_networking_thousandeyes_avg_jitter": {
        "valueField": "avg_jitter_ms",
        "unit": "ms",
        "decimals": 2,
        "thresholds": {"warning": 20, "critical": 30, "direction": "lower_is_better"},
    },
    "secure_networking_meraki_switch_count": {"valueField": "switch_count"},
    "secure_networking_meraki_wired_client_count": {"valueField": "wired_client_count"},
    "secure_networking_meraki_ap_count": {"valueField": "ap_count"},
    "secure_networking_meraki_wireless_client_count": {"valueField": "wireless_client_count"},
    "secure_networking_infra_fmc_firewall_count": {"valueField": "firewall_count"},
    "secure_networking_infra_sdwan_edge_count": {"valueField": "sdwan_site_count"},
    "secure_networking_infra_ise_device_count": {"valueField": "ise_device_count"},
    "secure_networking_thousandeyes_web_transaction_errors": {
        "valueField": "total_errors",
        "thresholds": {"warning": 1, "critical": 10, "direction": "lower_is_better"},
    },
}

DRILLDOWNS = {
    "secure_networking_meraki_threat_blocks_by_category": "Secure Networking - Meraki Threat Event Detail",
    "secure_networking_sgacl_enforcement_activity_trend": "Secure Networking - SGACL Deny Pairs by SGT",
    "secure_networking_ip_sgt_bindings_by_group": "Secure Networking - SGT Binding Inventory",
    "secure_networking_zta_auth_outcome_trend": "Secure Networking - ZTA Failure Reasons by Site",
    "secure_networking_hmf_unified_blocks_trend": "Secure Networking - FMC Blocked Connection Detail",
    "secure_networking_sse_total_security_events": "Secure Networking - SSE Security Event Detail",
    "secure_networking_sse_cloud_firewall_verdict_split": "Secure Networking - SSE Security Event Detail",
    "secure_networking_sse_cloud_firewall_blocks_count": "Secure Networking - SSE Security Event Detail",
    "secure_networking_sse_dns_blocked_categories": "Secure Networking - SSE Security Event Detail",
    "secure_networking_sse_dns_activity_trend": "Secure Networking - SSE Security Event Detail",
    "secure_networking_sse_amp_malware_detections": "Secure Networking - SSE AMP Threat Detail Table",
    "secure_networking_fmc_total_events_count": "Secure Networking - FMC Blocked Connection Detail",
    "secure_networking_fmc_blocked_count": "Secure Networking - FMC Blocked Connection Detail",
    "secure_networking_fmc_activity_trend": "Secure Networking - FMC Blocked Connection Detail",
    "secure_networking_fmc_top_url_categories_blocked": "Secure Networking - FMC Blocked Connection Detail",
    "secure_networking_fmc_top_rules_hit": "Secure Networking - FMC Blocked Connection Detail",
    "secure_networking_sgt_total_assignments_count": "Secure Networking - SGT Binding Inventory",
    "secure_networking_sgt_unique_count": "Secure Networking - SGT Binding Inventory",
    "secure_networking_sgt_fmc_blocks_by_sgt": "Secure Networking - FMC Events Correlated by SGT",
    "secure_networking_sgt_fmc_blocks_total_count": "Secure Networking - FMC Events Correlated by SGT",
    "secure_networking_zta_ise_auth_events_count": "Secure Networking - ZTA ISE Auth Failure Rate by Network Device",
    "secure_networking_zta_ise_failed_auth_count": "Secure Networking - ZTA Failure Reasons by Site",
    "secure_networking_zta_ise_failed_auth_pct": "Secure Networking - ZTA ISE Auth Failure Rate by Network Device",
    "secure_networking_zta_ztna_session_count": "Secure Networking - ZTA ZTNA Application Access Summary",
    "secure_networking_zta_ztna_device_category_outcomes": "Secure Networking - ZTA ZTNA Blocked Access Reasons",
    "secure_networking_zta_ztna_connection_status_trend": "Secure Networking - ZTA ZTNA Application Access Summary",
    "secure_networking_dc_anomaly_count": "Secure Networking - DC Fabric Anomalies by Severity",
    "secure_networking_dc_advisory_count": "Secure Networking - DC Security Advisory Detail",
    "secure_networking_dc_health_signals_trend": "Secure Networking - DC Fabric Anomalies by Severity",
    "secure_networking_meraki_rogue_ap_count": "Secure Networking - Meraki Rogue AP Containment Status",
    "secure_networking_meraki_unencrypted_ssid_count": "Secure Networking - Meraki SSID Encryption Breakdown",
    "secure_networking_meraki_switch_count": "Secure Networking - Site Inventory Rollup",
    "secure_networking_meraki_wired_client_count": "Secure Networking - Meraki Top Clients by Bandwidth Usage",
    "secure_networking_meraki_ap_count": "Secure Networking - Site Inventory Rollup",
    "secure_networking_meraki_wireless_client_count": "Secure Networking - Meraki Top Clients by Bandwidth Usage",
    "secure_networking_infra_fmc_firewall_count": "Secure Networking - HMF Enforcement Coverage by Site",
    "secure_networking_infra_sdwan_edge_count": "Secure Networking - SD-WAN Site View",
    "secure_networking_infra_ise_device_count": "Secure Networking - ZTA RADIUS Node Health by Site",
    "secure_networking_sdwan_apps_health_breakdown": "Secure Networking - SD-WAN Site View",
    "secure_networking_thousandeyes_test_success_vs_failed": "Secure Networking - ThousandEyes HTTP Availability by Test",
    "secure_networking_thousandeyes_avg_latency": "Secure Networking - ThousandEyes Latency by Agent Location",
    "secure_networking_thousandeyes_avg_loss_pct": "Secure Networking - ThousandEyes Latency by Agent Location",
    "secure_networking_thousandeyes_avg_jitter": "Secure Networking - ThousandEyes Latency by Agent Location",
    "secure_networking_thousandeyes_network_loss_trend": "Secure Networking - ThousandEyes Latency by Agent Location",
    "secure_networking_thousandeyes_web_transaction_errors": "Secure Networking - ThousandEyes HTTP Trace Log",
    "secure_networking_thousandeyes_bgp_path_changes_trend": "Secure Networking - ThousandEyes BGP Path Change Detail",
}

DRILLDOWN_BUTTONS = {
    "splunk.singlevalue": "Investigate supporting detail",
    "splunk.singlevalueradial": "Investigate supporting detail",
    "splunk.line": "Investigate trend drivers",
    "splunk.area": "Investigate trend drivers",
    "splunk.bar": "Investigate selected category",
    "splunk.column": "Investigate selected category",
    "splunk.pie": "Investigate selected segment",
}


def parse_fields(body: str) -> dict[str, str]:
    fields: dict[str, str] = {}
    for line in body.splitlines():
        match = re.match(r"^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$", line)
        if match:
            fields[match.group(1)] = match.group(2).strip()
    return fields


def is_secure_networking(fields: dict[str, str]) -> bool:
    return "Secure Networking" in {
        tag.strip() for tag in fields.get("tags", "").split(",")
    }


def is_drilldown(fields: dict[str, str]) -> bool:
    return "Drilldown" in {tag.strip() for tag in fields.get("tags", "").split(",")}


def visualization_defaults(default_viz: str, colors: list[str]) -> dict[str, Any]:
    if default_viz in {"splunk.line", "splunk.area"}:
        return {
            "seriesColors": colors,
            "lineWidth": 2,
            "legendDisplay": "bottom",
            "nullValueDisplay": "gaps",
            "dataValuesDisplay": "minmax",
        }
    if default_viz in {"splunk.bar", "splunk.column"}:
        return {
            "seriesColors": colors,
            "stackMode": "unstacked",
            "legendDisplay": "bottom",
        }
    if default_viz == "splunk.pie":
        return {"seriesColors": colors, "legendDisplay": "right"}
    if default_viz in {"splunk.singlevalue", "splunk.singlevalueradial"}:
        return {"seriesColors": [colors[0]], "showSparkline": True}
    return {"seriesColors": colors, "legendDisplay": "off"}


def plain_text(raw: str) -> str:
    text = re.sub(r"<br\s*/?>", " ", raw, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", "", text)
    return re.sub(r"\s+", " ", html.unescape(text)).strip()


def overview_defaults(name: str, fields: dict[str, str], color: str) -> dict[str, Any]:
    pillar = fields.get("sub_category", "")
    scalar = SCALAR_OPTIONS.get(name, {})
    note = plain_text(fields.get("solution", "")) or (
        "Use the drilldown and the search result distribution to establish an environment-specific baseline."
    )
    overview: dict[str, Any] = {
        "profile": "secure_networking",
        "tileId": name,
        "section": PILLAR_SECTIONS[pillar],
        "label": re.sub(r"^Secure Networking\s*-\s*", "", fields["search_name"]),
        "subLabel": pillar,
        "color": color,
        "thresholdNote": note[:2000],
    }
    for key in ("valueField", "unit", "thresholds"):
        if key in scalar:
            overview[key] = scalar[key]
    return overview


def merge_viz_options(name: str, fields: dict[str, str]) -> str:
    raw = fields.get("viz_options", "")
    existing: dict[str, Any] = json.loads(raw) if raw else {}
    pillar = fields.get("sub_category", "")
    colors = PILLAR_COLORS.get(
        pillar, CATEGORY_COLORS.get(fields.get("category", ""), DEFAULT_COLORS)
    )
    defaults = visualization_defaults(fields.get("default_viz", "splunk.table"), colors)
    if not is_secure_networking(fields):
        if raw:
            return raw
        return json.dumps(defaults, separators=(",", ":"), ensure_ascii=True)
    scalar = SCALAR_OPTIONS.get(name, {})
    for key in ("valueField", "decimals"):
        if key in scalar:
            defaults[key] = scalar[key]
    if "unit" in scalar:
        defaults["valueSuffix"] = scalar["unit"]
    merged = {**defaults, **existing}
    if is_drilldown(fields):
        merged.pop("overview", None)
        return json.dumps(merged, separators=(",", ":"), ensure_ascii=True)
    authored = merged.get("overview")
    generated = overview_defaults(name, fields, colors[0])
    if isinstance(authored, list) and authored and isinstance(authored[0], dict):
        merged["overview"] = [{**generated, **authored[0]}, *authored[1:]]
    elif isinstance(authored, dict):
        merged["overview"] = [{**generated, **authored}]
    else:
        merged["overview"] = [generated]
    return json.dumps(merged, separators=(",", ":"), ensure_ascii=True)


def set_field(body: str, key: str, value: str, after: str) -> str:
    replacement = f"{key} = {value}"
    pattern = re.compile(rf"(?m)^{re.escape(key)}\s*=.*$")
    if pattern.search(body):
        return pattern.sub(lambda _: replacement, body, count=1)
    anchor = re.compile(rf"(?m)^(?P<line>{re.escape(after)}\s*=.*)$")
    if not anchor.search(body):
        raise ValueError(f"Cannot insert {key}: missing {after} anchor")
    return anchor.sub(
        lambda match: f"{match.group('line')}\n{replacement}", body, count=1
    )


def enrich(content: str) -> tuple[str, int]:
    changed = 0

    def replace(match: re.Match[str]) -> str:
        nonlocal changed
        name = match.group("name")
        body = match.group("body")
        fields = parse_fields(body)
        next_body = set_field(
            body,
            "dispatch_context",
            REQUIRED_DISPATCH_CONTEXT,
            after="tags",
        )
        next_body = set_field(
            next_body,
            "dispatch_context_force",
            "1",
            after="dispatch_context",
        )
        next_body = set_field(
            next_body,
            "viz_options",
            merge_viz_options(name, fields),
            after="default_viz",
        )
        target = DRILLDOWNS.get(name)
        if target:
            next_body = set_field(
                next_body,
                "drilldown_search_name",
                target,
                after="viz_options",
            )
            next_body = set_field(
                next_body,
                "drilldown_button_title",
                DRILLDOWN_BUTTONS[fields.get("default_viz", "splunk.table")],
                after="drilldown_search_name",
            )
        if next_body == body:
            return match.group(0)
        changed += 1
        return f"[{name}]\n{next_body}"

    return STANZA_PATTERN.sub(replace, content), changed


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="write changes to searchbase.conf")
    args = parser.parse_args()

    original = SEARCHBASE_PATH.read_text(encoding="utf-8")
    updated, changed = enrich(original)
    mode = "updated" if args.apply else "would update"
    print(f"{mode} {changed} Searchbase stanzas")
    if args.apply and updated != original:
        SEARCHBASE_PATH.write_text(updated, encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())