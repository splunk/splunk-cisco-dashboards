import json
from pathlib import Path
import re
import unittest

from scripts.format_searchbase_conf import format_search, parse_stanzas
from scripts.lint_spl_antipatterns import lint_search


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

STORY_TRENDS = {
    "secure_networking_infra_secure_endpoint_incident_trend": (
        "Secure Networking - Secure Endpoint Incident and Malware Activity"
    ),
    "secure_networking_zta_xdr_incident_status_severity_trend": (
        "XDR - Incident - Status and Severity Pressure Matrix"
    ),
    "secure_networking_zta_xdr_risk_pressure_trend": (
        "XDR - Incident - Global Risk and Event Pressure Leaderboard"
    ),
    "secure_networking_zta_aa_internal_service_pressure_trend": (
        "XDR - Attack Analyzer - Forensic Network Service Pressure"
    ),
    "secure_networking_zta_aa_external_egress_trend": (
        "XDR - Attack Analyzer - Forensic Network External Egress Watch"
    ),
    "secure_networking_zta_aa_file_source_hotspot_trend": (
        "XDR - Attack Analyzer - Forensic Files Network Source Hotspots"
    ),
    "secure_networking_zta_aa_detection_severity_trend": (
        "XDR - Attack Analyzer - Forensic Detections Engine Severity Pressure"
    ),
    "secure_networking_zta_ravpn_active_clients_sessions_trend": (
        "Secure Networking - ZTA RaVPN Connection Rate and Clients"
    ),
    "secure_networking_zta_ravpn_profile_activity_trend": (
        "Secure Networking - ZTA RaVPN Sessions by Profile"
    ),
    "secure_networking_zta_ravpn_region_activity_trend": (
        "Secure Networking - ZTA RaVPN Sessions by Profile"
    ),
    "secure_networking_zta_ravpn_failure_reason_trend": (
        "Secure Networking - ZTA RaVPN Failure Reasons"
    ),
    "secure_networking_zta_ravpn_posture_outcome_trend": (
        "Secure Networking - ZTA RaVPN Posture Alerts and Logs"
    ),
}

PROVISIONAL_STANZAS = {
    "secure_networking_cloud_native_security_activity_trend",
    "secure_networking_secure_workload_alerts_trend",
    "secure_networking_isovalent_alerts_trend",
    "secure_networking_multicloud_defense_findings_trend",
    "secure_networking_xdr_incident_pressure_trend",
    "secure_networking_xdr_global_risk_trend",
    "secure_networking_xdr_forensic_network_activity_trend",
    "secure_networking_xdr_forensic_file_source_trend",
    "secure_networking_sdwan_site_health_trend",
    "secure_networking_sdwan_tunnel_state_trend",
    "secure_networking_zta_nvm_activity_trend",
}

SOURCE_CONTRACTS = {
    "secure_networking_infra_secure_endpoint_incident_trend": (
        '`index_security` sourcetype="cisco:se"'
    ),
    "secure_networking_zta_xdr_incident_status_severity_trend": (
        'sourcetype="cisco:xdr:incidents-summary"'
    ),
    "secure_networking_zta_xdr_risk_pressure_trend": (
        'sourcetype="cisco:xdr:incidents-summary"'
    ),
    "secure_networking_zta_aa_internal_service_pressure_trend": (
        'sourcetype="splunk:aa:forensic:network"'
    ),
    "secure_networking_zta_aa_external_egress_trend": (
        'sourcetype="splunk:aa:forensic:network"'
    ),
    "secure_networking_zta_aa_file_source_hotspot_trend": (
        'sourcetype="splunk:aa:forensic:files"'
    ),
    "secure_networking_zta_aa_detection_severity_trend": (
        'sourcetype="splunk:aa:forensic:detections"'
    ),
    "secure_networking_zta_ravpn_active_clients_sessions_trend": (
        'sourcetype="cisco:secure_access:security_events_ravpn"'
    ),
    "secure_networking_zta_ravpn_profile_activity_trend": (
        'sourcetype="cisco:cloud_security:ravpn"'
    ),
    "secure_networking_zta_ravpn_region_activity_trend": (
        'sourcetype="cisco:cloud_security:ravpn"'
    ),
    "secure_networking_zta_ravpn_failure_reason_trend": (
        'sourcetype="cisco:cloud_security:ravpn"'
    ),
    "secure_networking_zta_ravpn_posture_outcome_trend": (
        'sourcetype="cisco:secure_access:security_events_ravpn"'
    ),
}

REQUIRED_METADATA = {
    "search_name",
    "search_author",
    "updated_author",
    "version",
    "date_created",
    "date_updated",
    "category",
    "sub_category",
    "tags",
    "dispatch_context",
    "dispatch_context_origin",
    "dispatch_context_force",
    "default_viz",
    "viz_options",
    "drilldown_search_name",
    "description",
    "explanation",
    "solution",
    "related_info",
    "search",
}


class SecureNetworkingStoryTrendsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.searches = dict(parse_stanzas(SEARCHBASE.read_text(encoding="utf-8")))
        cls.searches_by_name = {
            fields["search_name"]: fields
            for fields in cls.searches.values()
            if fields.get("search_name")
        }

    def test_exact_gap_contains_twelve_new_primaries(self):
        found = set(self.searches).intersection(STORY_TRENDS)
        self.assertEqual(len(STORY_TRENDS), 12)
        self.assertEqual(found, set(STORY_TRENDS))
        self.assertFalse(set(self.searches).intersection(PROVISIONAL_STANZAS))

    def test_targets_resolve_and_preserve_dispatch_context(self):
        for stanza_id, target_name in STORY_TRENDS.items():
            with self.subTest(stanza=stanza_id):
                primary = self.searches[stanza_id]
                self.assertEqual(primary["drilldown_search_name"], target_name)
                self.assertIn(target_name, self.searches_by_name)
                target = self.searches_by_name[target_name]
                for field in (
                    "dispatch_context",
                    "dispatch_context_origin",
                    "dispatch_context_force",
                ):
                    self.assertEqual(primary[field], target[field], field)

    def test_primaries_are_bounded_area_trends_with_safe_fallbacks(self):
        bounded_timechart = re.compile(
            r"\| timechart fixedrange=false cont=false bins=(?:48|60)\b"
        )
        for stanza_id in STORY_TRENDS:
            with self.subTest(stanza=stanza_id):
                fields = self.searches[stanza_id]
                search = fields["search"]
                self.assertEqual(fields["default_viz"], "splunk.area")
                self.assertEqual(search.count("| timechart "), 1)
                self.assertRegex(search, bounded_timechart)
                self.assertIn("| appendpipe [ stats count as _empty", search)
                self.assertIn("| where _empty=0", search)
                self.assertIn("_time=now()", search)
                self.assertIn("| fields _time", search)
                self.assertNotIn("| join ", search)
                self.assertNotIn("| sort ", search)
                self.assertFalse(format_search(search)[1])
                self.assertEqual(lint_search(search, stanza=stanza_id), [])

    def test_source_and_filter_contracts_are_reused(self):
        for stanza_id, marker in SOURCE_CONTRACTS.items():
            with self.subTest(stanza=stanza_id):
                search = self.searches[stanza_id]["search"]
                self.assertIn(marker, search)

        self.assertIn(
            'where match(event_value,"(?i)incident|malware|threat|detection|compromise")',
            self.searches[
                "secure_networking_infra_secure_endpoint_incident_trend"
            ]["search"],
        )
        self.assertIn(
            'where destination_ip!="" AND NOT cidrmatch("10.0.0.0/8"',
            self.searches["secure_networking_zta_aa_external_egress_trend"][
                "search"
            ],
        )
        self.assertIn(
            'search event_status="Failed" OR event_status="Warning"',
            self.searches["secure_networking_zta_ravpn_failure_reason_trend"][
                "search"
            ],
        )
        self.assertIn(
            'where match(event_value,"fail|deny|reject|error|warn|alert")',
            self.searches["secure_networking_zta_ravpn_posture_outcome_trend"][
                "search"
            ],
        )

    def test_metadata_and_overview_result_fields_are_complete(self):
        for stanza_id in STORY_TRENDS:
            with self.subTest(stanza=stanza_id):
                fields = self.searches[stanza_id]
                self.assertFalse(REQUIRED_METADATA - set(fields))
                for prose_field in (
                    "description",
                    "explanation",
                    "solution",
                    "related_info",
                ):
                    self.assertTrue(fields[prose_field].startswith(("<p>", "<ul>")))

                options = json.loads(fields["viz_options"])
                self.assertGreaterEqual(len(options["seriesColors"]), 3)
                overview = options["overview"][0]
                self.assertEqual(overview["workspace"], "secure_networking")
                self.assertTrue(overview["label"])
                self.assertTrue(overview["subLabel"])
                self.assertIn(overview["valueField"], fields["search"])
                self.assertIn(overview["sparkDataField"], fields["search"])

    def test_existing_ravpn_connection_search_is_a_bounded_area_drilldown(self):
        fields = self.searches["secure_networking_zta_ravpn_connection_rate"]
        search = fields["search"]
        self.assertEqual(fields["default_viz"], "splunk.area")
        self.assertEqual(
            fields["drilldown_search_name"],
            "Secure Networking - ZTA RaVPN Sessions by Profile",
        )
        self.assertIn(
            "| timechart fixedrange=false cont=false bins=60", search
        )
        self.assertIn("_time=now()", search)
        options = json.loads(fields["viz_options"])
        self.assertEqual(options["overview"][0]["workspace"], "secure_networking")


if __name__ == "__main__":
    unittest.main()
