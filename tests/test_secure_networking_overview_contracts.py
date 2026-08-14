import json
from pathlib import Path
import unittest

from scripts.format_searchbase_conf import format_search, parse_stanzas


ROOT = Path(__file__).resolve().parents[1]
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

TIME_SERIES_CONTRACTS = {
    "security_resilience_cloud_fw_blocked": ("count", "count"),
    "executive_dashboard_ds_device_health_trend_compare": ("current", "current"),
    "it_critical_systems_site_link_availability_pct_trend": (
        "availability_pct",
        "availability_pct",
    ),
    "monitoring_sdwan_tunnel_health_poor_trend": (
        "WindowPoorTunnels",
        "poor_tunnels",
    ),
    "security_resilience_sdwan_utd_ips_trend_by_priority": (
        "WindowHighRisk",
        "High Risk",
    ),
    "security_ai_defense_action_trend": ("WindowBlocked", "Blocked"),
    "security_multicloud_defense_action_breakdown_kpi": (
        "deny_pct",
        "deny_pct",
    ),
    "secure_networking_router_segmentation_feature_trend": (
        "WindowTotal",
        "BucketTotal",
    ),
    "secure_networking_meraki_alerts_trend": (
        "WindowTotalAlerts",
        "alerts_total",
    ),
}

CATEGORICAL_CONTRACTS = {
    "network_intelligence_blocked_vs_allowed": (
        "WindowTotal",
        "Decision",
        "Connections",
    ),
    "monitoring_sdwan_site_state_summary": ("WindowTotal", "State", "Sites"),
    "monitoring_sdwan_circuit_state_summary": (
        "WindowTotal",
        "State",
        "Circuits",
    ),
    "security_microseg_tetration_alerts_by_severity_type": (
        "WindowTotal",
        "Alert Category",
        "Alerts",
    ),
    "network_nvm_top_processes_by_flow_volume": (
        "WindowBytesOut",
        "Process",
        "Bytes Out",
    ),
    "network_nvm_top_users_by_egress": (
        "WindowBytesOut",
        "User",
        "Bytes Out",
    ),
    "security_isovalent_alerts_by_severity": (
        "WindowTotal",
        "Severity",
        "Alerts",
    ),
    "secure_networking_cloud_native_security_activity": (
        "WindowTotal",
        "Provider",
        "Events",
    ),
}

NORMALIZED_SERIES = {
    "security_ai_defense_action_trend": {"Allowed", "Blocked", "Other"},
    "security_resilience_sdwan_utd_ips_trend_by_priority": {
        "High Risk",
        "Medium Risk",
        "Low Risk",
    },
    "secure_networking_router_segmentation_feature_trend": {
        "VXLAN / VNI",
        "VLAN / 802.1Q",
        "VRF",
        "SGT / TrustSec",
        "VPN",
    },
}

SOURCE_CONTRACTS = {
    "security_resilience_cloud_fw_blocked": 'sourcetype="cisco:cloud_security:firewall"',
    "network_intelligence_blocked_vs_allowed": "DATAMODEL=Network_Traffic",
    "executive_dashboard_ds_device_health_trend_compare": "`index_catalyst`",
    "it_critical_systems_site_link_availability_pct_trend": "`index_catalyst`",
    "monitoring_sdwan_tunnel_health_poor_trend": 'sourcetype="cisco:sdwan:tunnelhealth"',
    "monitoring_sdwan_site_state_summary": "Cisco_Catalyst_SDWAN_Site_Health_Events",
    "monitoring_sdwan_circuit_state_summary": 'sourcetype="cisco:sdwan:tunnelhealth"',
    "security_resilience_sdwan_utd_ips_trend_by_priority": 'sourcetype="cisco:sdwan:utd:logs"',
    "security_ai_defense_action_trend": 'sourcetype="cisco:ai:defense"',
    "security_multicloud_defense_action_breakdown_kpi": 'sourcetype="cisco:multicloud:defense:*"',
    "security_microseg_tetration_alerts_by_severity_type": 'sourcetype="cisco:secure:workload"',
    "network_nvm_top_processes_by_flow_volume": 'sourcetype="cisco:nvm:flowdata:v2"',
    "network_nvm_top_users_by_egress": 'sourcetype="cisco:nvm:flowdata:v2"',
    "security_isovalent_alerts_by_severity": 'sourcetype="cisco:isovalent:alert"',
    "secure_networking_router_segmentation_feature_trend": 'sourcetype="cisco:ios"',
    "secure_networking_cloud_native_security_activity": "`index_cloud_native`",
    "secure_networking_meraki_alerts_trend": 'sourcetype="meraki:assurancealerts"',
}


class SecureNetworkingOverviewContractsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.searches = dict(parse_stanzas(SEARCHBASE.read_text(encoding="utf-8")))

    def test_exact_seventeen_story_primary_contracts_are_covered(self):
        expected = set(TIME_SERIES_CONTRACTS) | set(CATEGORICAL_CONTRACTS)
        self.assertEqual(len(expected), 17)
        self.assertFalse(set(TIME_SERIES_CONTRACTS) & set(CATEGORICAL_CONTRACTS))
        self.assertFalse(expected - set(self.searches))

    def test_sdwan_circuit_detail_uses_tloc_grain(self):
        stanza = self.searches["monitoring_sdwan_circuit_availability_table"]
        search = stanza["search"]
        self.assertIn('sourcetype="cisco:sdwan:tunnelhealth"', search)
        self.assertIn("by local_system_ip, local_color", search)
        self.assertIn("dc(name) as peer_tunnels", search)
        for field in (
            "Circuit",
            "Health",
            "Availability (%)",
            "Avg Loss (%)",
            "Avg Latency (ms)",
            "Peer Tunnels",
            "Tunnel Samples",
            "Last Seen",
        ):
            self.assertIn(field, search)

    def test_sdwan_circuit_searches_preserve_dispatch_provenance(self):
        for stanza_id in (
            "monitoring_sdwan_circuit_state_summary",
            "monitoring_sdwan_circuit_availability_table",
        ):
            with self.subTest(stanza=stanza_id):
                fields = self.searches[stanza_id]
                self.assertEqual(
                    fields["dispatch_context"], "splunk-cisco-dashboards"
                )
                self.assertEqual(
                    fields["dispatch_context_origin"], "TA_cisco_catalyst"
                )
                self.assertEqual(fields["dispatch_context_force"], "1")

    def test_time_series_overview_fields_exist_for_data_and_empty_results(self):
        for stanza_id, (value_field, spark_field) in TIME_SERIES_CONTRACTS.items():
            with self.subTest(stanza=stanza_id):
                fields = self.searches[stanza_id]
                options = json.loads(fields["viz_options"])
                overview = options["overview"][0]
                self.assertEqual(overview["tileId"], stanza_id)
                self.assertEqual(overview["valueField"], value_field)
                self.assertEqual(overview["sparkDataField"], spark_field)
                populated, marker, fallback = fields["search"].partition("| appendpipe")
                self.assertTrue(marker)
                for result_field in (value_field, spark_field):
                    self.assertIn(result_field, populated)
                    self.assertIn(result_field, fallback)

    def test_categorical_axes_and_kpis_exist_for_data_and_empty_results(self):
        for stanza_id, (value_field, category_field, series_field) in (
            CATEGORICAL_CONTRACTS.items()
        ):
            with self.subTest(stanza=stanza_id):
                fields = self.searches[stanza_id]
                options = json.loads(fields["viz_options"])
                self.assertEqual(options["overview"][0]["tileId"], stanza_id)
                self.assertEqual(options["overview"][0]["valueField"], value_field)
                populated, marker, fallback = fields["search"].partition("| appendpipe")
                self.assertTrue(marker)
                for result_field in (value_field, category_field, series_field):
                    self.assertIn(result_field, populated)
                    self.assertIn(result_field, fallback)

    def test_finite_dynamic_series_are_normalized_in_both_paths(self):
        for stanza_id, series_names in NORMALIZED_SERIES.items():
            with self.subTest(stanza=stanza_id):
                populated, _, fallback = self.searches[stanza_id]["search"].partition(
                    "| appendpipe"
                )
                for series_name in series_names:
                    self.assertIn(series_name, populated)
                    self.assertIn(series_name, fallback)

    def test_sources_are_preserved_and_fallbacks_are_typed(self):
        for stanza_id, source_marker in SOURCE_CONTRACTS.items():
            with self.subTest(stanza=stanza_id):
                search = self.searches[stanza_id]["search"]
                self.assertIn(source_marker, search)
                self.assertIn("stats count as _empty", search)
                self.assertNotIn('eval category="No matching telemetry', search)
                self.assertNotIn('"No matching telemetry was found.', search)
                self.assertFalse(format_search(search)[1])


if __name__ == "__main__":
    unittest.main()
