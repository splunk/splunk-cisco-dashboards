import re
import unittest
from pathlib import Path


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


def parse_stanzas(text):
    matches = list(
        re.finditer(r"^\[([A-Za-z0-9_.:-]+)\]\s*$", text, re.MULTILINE)
    )
    stanzas = {}
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        body = text[match.start() : end]
        fields = {
            field.group(1): field.group(2).strip()
            for field in re.finditer(
                r"^([A-Za-z0-9_.-]+)\s*=\s*(.*)$", body, re.MULTILINE
            )
        }
        stanzas[match.group(1)] = {"body": body, "fields": fields}
    return stanzas


class PortableSearchbaseSearchesTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.text = SEARCHBASE.read_text(encoding="utf-8")
        cls.stanzas = parse_stanzas(cls.text)
        cls.target_ids = {
            "catalyst_center_wips_active_rogue_threats",
            "overview_inter_site_latency",
            "security_resilience_ds_ids_classification",
            "security_resilience_firepower_event_correlation",
            "security_resilience_sdwan_utd_amp_top_malware",
            "spaces_fit_area_occupancy_anomaly",
            "spaces_fit_camera_multivariate_anomaly",
            "teuc_5_9_37_page_load_completion_rate",
        }

    def test_requested_searches_are_live_and_app_owned(self):
        self.assertEqual(self.target_ids - set(self.stanzas), set())
        for stanza_id in self.target_ids:
            fields = self.stanzas[stanza_id]["fields"]
            self.assertEqual(fields.get("dispatch_context"), "splunk-cisco-dashboards")
            self.assertEqual(fields.get("dispatch_context_force"), "1")

    def test_requested_searches_do_not_use_demo_only_dependencies(self):
        forbidden = re.compile(
            r"DATAMODEL=Cisco_Security|cisco_catalyst_app_index|"
            r"source=\"http:DNAC_EVENT\"|\|\s*fit\b|into\s+user:|\|\s*spath\b",
            re.IGNORECASE,
        )
        for stanza_id in self.target_ids:
            self.assertIsNone(
                forbidden.search(self.stanzas[stanza_id]["body"]), stanza_id
            )

    def test_searchbase_has_no_spath_pipeline_commands(self):
        self.assertIsNone(
            re.search(r"(?m)^\s*\|\s*spath\b", self.text, re.IGNORECASE)
        )

    def test_portable_source_contracts_are_explicit(self):
        expected = {
            "catalyst_center_wips_active_rogue_threats": "`index_catalyst`",
            "overview_inter_site_latency": "`index_catalyst`",
            "security_resilience_ds_ids_classification": "`index_firewall`",
            "security_resilience_firepower_event_correlation": "`index_firewall`",
            "security_resilience_sdwan_utd_amp_top_malware": "`index_sdwan`",
            "spaces_fit_area_occupancy_anomaly": "`index_spaces`",
            "spaces_fit_camera_multivariate_anomaly": "`index_spaces`",
            "teuc_5_9_37_page_load_completion_rate": "`index_thousandeyes`",
        }
        for stanza_id, marker in expected.items():
            self.assertIn(marker, self.stanzas[stanza_id]["fields"]["search"])

    def test_replaced_searches_keep_useful_result_contracts(self):
        bodies = {key: self.stanzas[key]["body"] for key in self.target_ids}
        self.assertIn('table "Last Detected", "Issue ID"', bodies["catalyst_center_wips_active_rogue_threats"])
        self.assertIn("Classification, Impact", bodies["security_resilience_ds_ids_classification"])
        self.assertIn('rename direction as "Traffic Direction"', bodies["security_resilience_firepower_event_correlation"])
        self.assertIn('table "Threat Type", "Indicator"', bodies["security_resilience_sdwan_utd_amp_top_malware"])
        self.assertIn("is_anomaly", bodies["spaces_fit_area_occupancy_anomaly"])
        self.assertIn("is_count_outlier", bodies["spaces_fit_camera_multivariate_anomaly"])
        self.assertIn('"Completion %"', bodies["teuc_5_9_37_page_load_completion_rate"])

    def test_array_expansion_uses_correlated_json_objects(self):
        for stanza_id in (
            "secure_networking_meraki_rogue_ap_threat_intelligence",
            "secure_networking_meraki_switch_ports_detail",
        ):
            body = self.stanzas[stanza_id]["body"]
            self.assertIn("json_array_to_mv", body)
            self.assertIn("json_extract_exact", body)

    def test_updated_drilldowns_resolve_to_live_search_names(self):
        names = {
            stanza["fields"].get("search_name")
            for stanza in self.stanzas.values()
            if stanza["fields"].get("search_name")
        }
        for stanza_id, stanza in self.stanzas.items():
            target = stanza["fields"].get("drilldown_search_name")
            if target in {
                "Catalyst Center - Active Security Issues",
                "Spaces - Camera Headcount and Change Anomaly Scores",
            }:
                self.assertIn(target, names, stanza_id)


if __name__ == "__main__":
    unittest.main()
