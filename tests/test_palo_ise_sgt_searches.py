from pathlib import Path
import unittest

from scripts.format_searchbase_conf import format_search, parse_stanzas
from scripts.lint_spl_antipatterns import lint_search


ROOT = Path(__file__).resolve().parents[1]
DEFAULT = ROOT / "packages/splunk-cisco-dashboards/src/main/resources/splunk/default"
DETAIL = "secure_networking_sgt_palo_alto_traffic_detail"
ROLLUP = "secure_networking_sgt_palo_alto_policy_effectiveness"


class PaloIseSgtSearchTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.searches = dict(parse_stanzas((DEFAULT / "searchbase.conf").read_text()))
        cls.macros = dict(parse_stanzas((DEFAULT / "macros.conf").read_text()))

    def test_firewall_macro_covers_palo_alto(self):
        self.assertIn("pan:*", self.macros["index_firewall"]["description"])

    def test_searches_have_reciprocal_drilldowns_and_verified_sources(self):
        detail = self.searches[DETAIL]
        rollup = self.searches[ROLLUP]

        self.assertEqual(
            detail["drilldown_search_name"],
            rollup["search_name"],
        )
        self.assertEqual(
            rollup["drilldown_search_name"],
            detail["search_name"],
        )
        for stanza_id, fields in ((DETAIL, detail), (ROLLUP, rollup)):
            with self.subTest(stanza=stanza_id):
                search = fields["search"]
                self.assertIn('`index_firewall` sourcetype="pan:traffic"', search)
                self.assertIn('`index_identity` sourcetype="cisco:ise:syslog"', search)
                self.assertIn("eventstats", search)
                self.assertNotIn("| join ", search)
                self.assertEqual(fields["dispatch_context"], "TA_cisco_catalyst")
                self.assertEqual(fields["dispatch_context_force"], "0")
                self.assertFalse(format_search(search)[1])
                self.assertEqual(lint_search(search, stanza=stanza_id), [])

    def test_detail_and_rollup_preserve_distinct_operational_grains(self):
        detail_search = self.searches[DETAIL]["search"]
        rollup_search = self.searches[ROLLUP]["search"]

        self.assertIn('table "Traffic Time", "Source IP", "SGT Name"', detail_search)
        self.assertNotIn("| stats ", detail_search)
        self.assertIn("| stats count as traffic_events", rollup_search)
        self.assertIn('by sgt_name, ise_sgt, rule', rollup_search)
        self.assertNotIn("| sort ", rollup_search)


if __name__ == "__main__":
    unittest.main()