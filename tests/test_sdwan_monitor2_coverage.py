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


class SdwanMonitor2CoverageTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.text = SEARCHBASE.read_text(encoding="utf-8")
        cls.stanzas = parse_stanzas(cls.text)
        cls.catalyst_stanzas = {
            "monitoring_sdwan_system_event_table",
            "monitoring_sdwan_event_severity_trend",
            "monitoring_sdwan_event_top_types",
            "monitoring_sdwan_current_power_kpi",
            "monitoring_sdwan_energy_usage_trend",
            "monitoring_sdwan_energy_by_site_table",
            "security_resilience_sdwan_access_action_summary",
            "security_resilience_sdwan_access_log_table",
        }
        cls.stream_stanzas = {"monitoring_sdwan_netflow_traffic_trend"}

    def test_live_monitor2_searches_exist(self):
        expected = self.catalyst_stanzas | self.stream_stanzas
        self.assertFalse(expected - set(self.stanzas))

    def test_dispatch_context_and_onboarding_origin_are_preserved(self):
        for stanza_id in self.catalyst_stanzas:
            with self.subTest(stanza=stanza_id):
                fields = self.stanzas[stanza_id]["fields"]
                self.assertEqual(fields["dispatch_context"], "splunk-cisco-dashboards")
                self.assertEqual(fields["dispatch_context_origin"], "TA_cisco_catalyst")
                self.assertEqual(fields["dispatch_context_force"], "1")

        for stanza_id in self.stream_stanzas:
            with self.subTest(stanza=stanza_id):
                fields = self.stanzas[stanza_id]["fields"]
                self.assertEqual(fields["dispatch_context"], "splunk-cisco-dashboards")
                self.assertEqual(fields["dispatch_context_origin"], "Splunk_TA_stream")
                self.assertEqual(fields["dispatch_context_force"], "1")

        hidden_energy = self.stanzas[
            "dashboard_workplace_spog_v1_t3_network_power_kpi"
        ]["fields"]
        self.assertEqual(hidden_energy["dispatch_context"], "splunk-cisco-dashboards")
        self.assertEqual(hidden_energy["dispatch_context_origin"], "TA_cisco_catalyst")

    def test_manager_event_views_use_the_live_event_api_contract(self):
        for stanza_id in (
            "monitoring_sdwan_system_event_table",
            "monitoring_sdwan_event_severity_trend",
            "monitoring_sdwan_event_top_types",
        ):
            with self.subTest(stanza=stanza_id):
                search = self.stanzas[stanza_id]["body"]
                self.assertIn('sourcetype="cisco:sdwan:custom"', search)
                self.assertIn('sourcetype="cisco:sdwan:custom:*"', search)
                self.assertNotIn('sourcetype="cisco:sdwan:system:logs"', search)

        table = self.stanzas["monitoring_sdwan_system_event_table"]["body"]
        self.assertIn("entry_time>100000000000", table)
        self.assertIn("eventname", table)
        self.assertIn("severity_level", table)
        self.assertIn("component", table)
        self.assertIn("| sort 200 -event_epoch", table)
        for field in (
            "Event Time",
            "Hostname",
            "System IP",
            "Name",
            "Severity",
            "Component",
            "Details",
        ):
            self.assertIn(field, table)

    def test_energy_views_use_device_interval_metrics(self):
        for stanza_id in (
            "monitoring_sdwan_current_power_kpi",
            "monitoring_sdwan_energy_usage_trend",
            "monitoring_sdwan_energy_by_site_table",
        ):
            with self.subTest(stanza=stanza_id):
                search = self.stanzas[stanza_id]["body"]
                self.assertIn('sourcetype="cisco:sdwan:energy:stats"', search)

        current_power = self.stanzas["monitoring_sdwan_current_power_kpi"]["body"]
        self.assertIn("latest(current_reading) as device_watts", current_power)
        self.assertIn("sum(device_watts) as total_watts", current_power)

        by_site = self.stanzas["monitoring_sdwan_energy_by_site_table"]["body"]
        for field in (
            "power_usage",
            "current_reading",
            "cost",
            "emission",
            "site_id",
            "host_name",
        ):
            self.assertIn(field, by_site)

    def test_access_views_use_parsed_policy_fields(self):
        for stanza_id in (
            "security_resilience_sdwan_access_action_summary",
            "security_resilience_sdwan_access_log_table",
        ):
            with self.subTest(stanza=stanza_id):
                search = self.stanzas[stanza_id]["body"]
                self.assertIn('sourcetype="cisco:sdwan:access:logs"', search)

        detail = self.stanzas["security_resilience_sdwan_access_log_table"]["body"]
        self.assertIn("| sort 200 -_time", detail)
        for field in (
            "rule",
            "src_ip",
            "dest_ip",
            "src_group_tag",
            "dest_group_tag",
            "dest_port",
        ):
            self.assertIn(field, detail)

    def test_stream_traffic_view_excludes_options_metadata(self):
        search = self.stanzas["monitoring_sdwan_netflow_traffic_trend"]["body"]
        self.assertIn("`index_network`", search)
        self.assertIn('sourcetype IN ("cisco:netflow","stream:netflow")', search)
        self.assertIn('NOT event_name="netFlowOptions"', search)
        self.assertIn("tonumber(bytes_in)", search)
        self.assertIn("bins=48", search)

    def test_new_searches_have_bounded_result_shapes(self):
        for stanza_id in self.catalyst_stanzas | self.stream_stanzas:
            with self.subTest(stanza=stanza_id):
                search = self.stanzas[stanza_id]["body"].lower()
                for forbidden in ("| join ", "| transaction ", "| map ", "| mvexpand "):
                    self.assertNotIn(forbidden, search)

        self.assertIn(
            "top limit=15",
            self.stanzas["monitoring_sdwan_event_top_types"]["body"],
        )
        for stanza_id in (
            "monitoring_sdwan_event_severity_trend",
            "monitoring_sdwan_energy_usage_trend",
            "monitoring_sdwan_netflow_traffic_trend",
        ):
            self.assertIn("bins=48", self.stanzas[stanza_id]["body"])


if __name__ == "__main__":
    unittest.main()
