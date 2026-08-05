import json
import re
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
APP_ROOT = ROOT / "packages" / "splunk-cisco-dashboards" / "src" / "main" / "resources" / "splunk"
VIEWS = APP_ROOT / "default" / "data" / "ui" / "views"
NAV = APP_ROOT / "default" / "data" / "ui" / "nav" / "default.xml"
SEARCHBASE = APP_ROOT / "default" / "searchbase.conf"

DASHBOARDS = {
    "secure_networking_zta_authentication_policy_enforcement": {
        "label": "Authentication and Policy Enforcement",
        "refs": {
            "secure_networking_zta_ise_auth_by_device_fail_rate",
            "secure_networking_ise_policy_hits_by_device",
            "secure_networking_infra_ise_device_count",
            "secure_networking_ise_policy_family_overview",
            "secure_networking_zta_radius_node_health_by_site",
            "security_resilience_ise_radius_latency",
            "secure_networking_zta_duo_admin_activity_by_outcome",
        },
    },
    "secure_networking_zta_policy_management": {
        "label": "Policy Management",
        "refs": {
            "secure_networking_zta_duo_auth_outcomes_by_application",
            "secure_networking_infra_duo_blocked_posture_identity",
        },
    },
    "secure_networking_zta_user_activity_monitoring": {
        "label": "User Activity Monitoring",
        "refs": {
            "secure_networking_zta_user_activity_cross_source",
            "secure_networking_zta_ztna_blocked_access_reasons",
            "secure_networking_zta_ztna_device_category_outcomes",
            "secure_networking_zta_ztna_connection_status_trend",
            "secure_networking_zta_ztna_app_access_summary",
            "network_nvm_endpoint_os_inventory",
            "network_nvm_top_processes_by_flow_volume",
            "network_nvm_top_destination_hosts",
            "network_nvm_top_users_by_egress",
            "secure_networking_zta_duo_auth_outcomes_by_application",
            "secure_networking_infra_secure_endpoint_incidents",
            "secure_networking_infra_duo_blocked_posture_identity",
            "secure_networking_infra_duo_application_access",
        },
    },
    "secure_networking_zta_detection_response": {
        "label": "Detection & Response",
        "refs": {
            "xdr_incident_status_severity_pressure",
            "xdr_incident_global_risk_leaderboard",
            "xdr_aa_forensic_network_internal_service_pressure",
            "xdr_aa_forensic_network_external_egress_watch",
            "xdr_aa_forensic_files_network_source_hotspots",
        },
    },
    "secure_networking_zta_ravpn_sessions_and_posture": {
        "label": "Remote Access VPN (RaVPN) Sessions and Posture",
        "refs": {
            "secure_networking_zta_ravpn_sessions_by_profile",
            "secure_networking_zta_ravpn_connection_rate",
            "secure_networking_zta_ravpn_failure_reasons",
            "secure_networking_zta_ravpn_posture_alerts",
        },
    },
    "secure_networking_secure_infrastructure_status": {
        "label": "Secure Infrastructure Status",
        "refs": {
            "secure_networking_meraki_rogue_ap_count",
            "secure_networking_meraki_rogue_ap_containment",
            "secure_networking_meraki_ssid_encryption_breakdown",
            "secure_networking_meraki_ap_count",
            "secure_networking_meraki_unencrypted_ssid_count",
            "secure_networking_meraki_wireless_client_count",
            "secure_networking_infra_fmc_firewall_count",
            "feed_monitor_ftd_firewall_staleness",
            "executive_dashboard_data_source_status",
        },
    },
    "secure_networking_segmentation_overview": {
        "label": "Segmentation Overview",
        "refs": {
            "secure_networking_sgt_by_site",
            "secure_networking_ip_sgt_bindings_by_group",
            "secure_networking_sgt_distribution_by_site_device",
            "secure_networking_sgt_binding_inventory",
        },
    },
    "secure_networking_hmf_sdwan_network_health_monitoring": {
        "label": "SD-WAN and Network Health Monitoring",
        "refs": {
            "monitoring_sdwan_circuit_state_summary",
            "monitoring_sdwan_site_health_map",
            "monitoring_sdwan_site_health_table",
            "monitoring_sdwan_site_state_summary",
            "secure_networking_sdwan_tunnel_health_log",
            "monitoring_sdwan_tunnel_health_poor_trend",
        },
    },
    "secure_networking_hmf_threat_detection_enforcement": {
        "label": "Threat Detection and Enforcement",
        "refs": {
            "network_intelligence_blocked_vs_allowed",
            "security_resilience_cloud_fw_blocked",
            "security_multicloud_defense_gateway_health_table",
            "security_multicloud_defense_waf_findings",
            "security_multicloud_defense_action_breakdown_kpi",
            "security_isovalent_alerts_by_severity",
            "security_isovalent_top_alert_rules",
            "xdr_incident_status_severity_pressure",
            "xdr_incident_global_risk_leaderboard",
        },
    },
    "secure_networking_hmf_dlp_cloud_native_security": {
        "label": "DLP and Cloud Native Security",
        "refs": {
            "secure_networking_secure_access_dlp_findings",
            "secure_networking_segmentation_secure_workload_alerts_by_type",
            "security_microseg_tetration_alerts_by_severity_type",
            "secure_networking_cloud_native_security_activity",
        },
    },
    "secure_networking_agentic_ops_executive_overview": {
        "label": "Executive Overview",
        "refs": {
            "overview_ap_health",
            "secure_networking_meraki_ap_count",
            "secure_networking_dc_health_signals_trend",
            "feed_monitor_all_feeds_health_matrix",
            "overview_topology_overview",
            "overview_link_auburndale_tallahassee_health",
            "overview_link_state_drilldown",
            "executive_dashboard_ds_device_health_current_drilldown",
            "executive_dashboard_ds_device_health_trend_compare",
            "executive_summary_healthy_device_count",
            "executive_dashboard_data_source_status",
        },
    },
}

TREND_DASHBOARDS = {
    "secure_networking_agentic_ops_executive_overview",
    "secure_networking_hmf_threat_detection_enforcement",
    "secure_networking_secure_infrastructure_status",
    "secure_networking_zta_authentication_policy_enforcement",
}


class SecureNetworkingPillarDashboardTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.searchbase_text = SEARCHBASE.read_text(encoding="utf-8")
        cls.searchbase_stanzas = set(
            re.findall(r"^\[([^\]]+)\]\s*$", cls.searchbase_text, re.MULTILINE)
        )
        cls.searchbase_by_stanza = {
            match.group(1): match.group(2)
            for match in re.finditer(
                r"^\[([^\]]+)\]\s*$([\s\S]*?)(?=^\[|\Z)",
                cls.searchbase_text,
                re.MULTILINE,
            )
        }
        cls.nav_root = ET.parse(NAV).getroot()

    def test_dashboard_definitions_match_csv_mapping(self):
        for dashboard_id, expected in DASHBOARDS.items():
            with self.subTest(dashboard_id=dashboard_id):
                root = ET.parse(VIEWS / f"{dashboard_id}.xml").getroot()
                self.assertEqual(root.findtext("label"), expected["label"])
                definition = json.loads(root.findtext("definition"))

                self.assertEqual(definition["title"], expected["label"])
                self.assertEqual(
                    definition["inputs"]["input_time_range"]["options"],
                    {"defaultValue": "-24h@h,now", "token": "time_tok"},
                )
                self.assertEqual(definition["layout"]["globalInputs"], ["input_time_range"])
                self.assertEqual(
                    definition["layout"]["tabs"]["items"],
                    [{"label": "overview", "layoutId": "layout_overview"}],
                )

                data_sources = definition["dataSources"]
                refs = {source["options"]["ref"] for source in data_sources.values()}
                self.assertEqual(refs, expected["refs"])
                self.assertTrue(refs <= self.searchbase_stanzas)

                for source in data_sources.values():
                    self.assertEqual(source["type"], "ds.searchbase")
                    self.assertEqual(
                        source["options"]["queryParameters"],
                        {
                            "earliest": "$time_tok.earliest$",
                            "latest": "$time_tok.latest$",
                        },
                    )

                bound_visualizations = [
                    visualization
                    for visualization in definition["visualizations"].values()
                    if "dataSources" in visualization
                ]
                self.assertEqual(len(bound_visualizations), len(expected["refs"]))
                for visualization in bound_visualizations:
                    self.assertIn(visualization["dataSources"]["primary"], data_sources)

    def test_navigation_uses_dashboard_builder_hash_routes(self):
        nav_links = {
            node.attrib.get("href"): "".join(node.itertext()).strip()
            for node in self.nav_root.iter("a")
        }
        for dashboard_id, expected in DASHBOARDS.items():
            with self.subTest(dashboard_id=dashboard_id):
                href = f"dashboardbuilder#/{dashboard_id}"
                self.assertEqual(nav_links.get(href), expected["label"])

    def test_requested_single_values_use_time_series_and_trend_chrome(self):
        for dashboard_id in TREND_DASHBOARDS:
            with self.subTest(dashboard_id=dashboard_id):
                root = ET.parse(VIEWS / f"{dashboard_id}.xml").getroot()
                definition = json.loads(root.findtext("definition"))
                singles = [
                    visualization
                    for visualization in definition["visualizations"].values()
                    if visualization.get("type") == "splunk.singlevalue"
                ]
                self.assertTrue(singles)
                for visualization in singles:
                    options = visualization["options"]
                    self.assertEqual(options["sparklineDisplay"], "below")
                    self.assertEqual(options["trendDisplay"], "percent")
                    self.assertTrue(options["showTrendIndicator"])

                    data_source_id = visualization["dataSources"]["primary"]
                    ref = definition["dataSources"][data_source_id]["options"]["ref"]
                    stanza = self.searchbase_by_stanza[ref]
                    self.assertIn("_time", stanza, f"{ref} must return a time series")

    def test_map_pie_and_latency_result_contracts(self):
        sdwan = json.loads(
            ET.parse(VIEWS / "secure_networking_hmf_sdwan_network_health_monitoring.xml")
            .getroot()
            .findtext("definition")
        )
        map_options = sdwan["visualizations"]["viz_monitoring_sdwan_site_health_map"]["options"]
        self.assertEqual(map_options["center"], [20, -20])
        self.assertLess(map_options["zoom"], 1)
        self.assertIn("tonumber(raw_lat)", self.searchbase_by_stanza["monitoring_sdwan_site_health_map"])

        pie_search = self.searchbase_by_stanza["secure_networking_ip_sgt_bindings_by_group"]
        self.assertIn('| table "SGT Tag" "Bound IPs"', pie_search)
        self.assertNotIn('"ISE Node"', pie_search)

        latency_search = self.searchbase_by_stanza["security_resilience_ise_radius_latency"]
        self.assertIn("limit=6 useother=false", latency_search)
        self.assertIn("latency_ms>0", latency_search)


if __name__ == "__main__":
    unittest.main()
