from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from scripts.harvest_dc_networking_app_to_searchbase import (
    TOKEN,
    detokenize,
    extract_dashboard,
    has_match_all_predicate,
    remove_match_all_predicates,
    stanza_fields,
)
from scripts.curate_dc_networking_searchbase import curate_text
from scripts.curate_searchbase_match_all import curate_text as curate_catalog_text
from scripts.format_searchbase_conf import find_unterminated_search_lines
from scripts.lint_spl_antipatterns import lint_text
from scripts.validate_searchbase_export import validate_stanza


class HarvestDcNetworkingTest(unittest.TestCase):
    def test_lints_only_limits_before_aggregation(self) -> None:
        conf = """[bad]
search = index=main | head 100 | stats count by host

[good]
search = index=main | stats count by host | sort 0 - count | head 10
"""

        violations = lint_text(conf)

        self.assertEqual(
            [(item.stanza, item.rule_id.split()[0]) for item in violations],
            [("bad", "R007")],
        )

    def test_lints_duplicate_keys_without_misreading_search_continuations(self) -> None:
        conf = """[duplicate]
description = First
description = Second
search = index=main\
earliest=-24h\
| stats count

[instruction]
description = Remove both bullets and replace with something useful.
search = index=main | stats count
"""

        violations = lint_text(conf)

        self.assertEqual(
            [(item.stanza, item.rule_id.split()[0]) for item in violations],
            [("instruction", "R006"), ("duplicate", "R005")],
        )

    def test_export_validation_rejects_forbidden_entity_reducers(self) -> None:
        result = validate_stanza(
            "bad_export",
            {
                "search": "index=main | dedup serial | stats latest(*) as * by serial",
                "search_name": "Bad Export",
            },
        )

        details = [failure.detail for failure in result.failures]
        self.assertTrue(any(detail.startswith("R002") for detail in details))
        self.assertTrue(any(detail.startswith("R004") for detail in details))

    def test_lints_dedup_and_unjustified_fillnull_in_nested_searches(self) -> None:
        conf = """[bad]
search = index=main [ search index=inventory | dedup serial ]\
| fillnull value=0 count\
| table serial count

[allowed]
search = index=main\
| fillnull reason value="Unknown"\
| stats count by reason

[wildcard]
search = index=main\
| stats latest(*) as * by serial
"""

        violations = lint_text(conf)

        self.assertEqual(
            [(item.stanza, item.rule_id.split()[0]) for item in violations],
            [("bad", "R002"), ("bad", "R003"), ("wildcard", "R004")],
        )

    def test_detokenize_preserves_static_filters_and_normalizes_macro(self) -> None:
        search = (
            "| ` authentication_details` | search trig=\"login,session\" "
            "AND user=$selected_user$ AND $formed_host$ | stats count"
        )

        result = detokenize(search, {})

        self.assertEqual(
            result,
            '`authentication_details` | search trig="login,session" '
            '| stats count',
        )
        self.assertIsNone(TOKEN.search(result))

    def test_extracts_only_visualization_searches_and_sanitizes_title(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            dashboard_path = Path(temp_dir) / "authentication.xml"
            dashboard_path.write_text(
                """
                <form>
                    <label>Authentication</label>
                    <search id="base"><query>index=dc</query></search>
                    <fieldset>
                        <input type="dropdown" token="user">
                            <search><query>| inputlookup users.csv</query></search>
                        </input>
                    </fieldset>
                    <row>
                        <panel>
                            <table>
                                <title>Failure by User: "$authFailUser$"</title>
                                <search base="base">
                                    <query>| search user="$authFailUser$" | stats count</query>
                                </search>
                            </table>
                        </panel>
                    </row>
                </form>
                """,
                encoding="utf-8",
            )

            _, entries, skipped = extract_dashboard(dashboard_path, {})

            self.assertEqual(len(entries), 1)
            self.assertEqual(entries[0].panel_title, "Failure by User")
            self.assertEqual(entries[0].search, "index=dc | stats count")
            self.assertEqual(skipped.count("non_visualization_search"), 2)
            fields = stanza_fields(entries[0])
            self.assertNotIn("$", fields["search_name"])
            self.assertEqual(
                fields["search_name"],
                "DC Networking - Authentication - Failure by User",
            )

    def test_removes_only_exact_match_all_predicates(self) -> None:
        search = (
            'index=dc severity="*" node="*leaf*" dn="*/health" '
            '| search Pod="*" Process="*" state="down" '
            '| stats count by node'
        )

        self.assertEqual(
            remove_match_all_predicates(search),
            'index=dc node="*leaf*" dn="*/health" '
            '| search state="down" | stats count by node',
        )
        self.assertTrue(has_match_all_predicate('index=dc severity=*\\\n| stats count'))

    def test_preserves_eval_and_cleans_nested_predicate_stages(self) -> None:
        search = (
            'eventtype=dc | eval state=if(lc!="*", "changed", "same") '
            '| join host [search index=dc | search host="*" | table host] '
            '| tstats count from datamodel=Example where Example.host="*" by Example.site'
        )

        self.assertEqual(
            remove_match_all_predicates(search),
            'eventtype=dc | eval state=if(lc!="*", "changed", "same") '
            '| join host [search index=dc | table host] '
            '| tstats count from datamodel=Example by Example.site',
        )
        self.assertTrue(has_match_all_predicate(search))
        expression = 'eval state=if(lc!="*", 1, 0)'
        self.assertEqual(remove_match_all_predicates(expression), expression)
        self.assertFalse(has_match_all_predicate(expression))

    def test_curates_only_dc_context_and_refuses_unreviewed_duplicates(self) -> None:
        conf = """[other]
dispatch_context = another_app
search = index=main keep="*"

[dc_one]
dispatch_context = cisco_dc_networking_app_for_splunk
search = index=dc severity="*" node="*leaf*" | stats count
"""

        curated, report = curate_text(conf)

        self.assertIn('search = index=main keep="*"', curated)
        self.assertIn('search = index=dc node="*leaf*"', curated)
        self.assertEqual(report["retained_stanzas"], 1)

        duplicate_conf = conf + """
[dc_two]
dispatch_context = cisco_dc_networking_app_for_splunk
search = index=dc node="*leaf*" | stats count
"""
        with self.assertRaisesRegex(ValueError, "unreviewed exact duplicate group"):
            curate_text(duplicate_conf)

    def test_removes_reviewed_low_value_search_and_preserves_richer_coverage(self) -> None:
        conf = """[dc_networking_multi_pod_apics]
dispatch_context = cisco_dc_networking_app_for_splunk
search = `apic_details` | fields - apic_host

[dc_networking_home_apics]
dispatch_context = cisco_dc_networking_app_for_splunk
search = `apic_details` | table Name health operSt apic_host
"""

        curated, report = curate_text(conf)

        self.assertNotIn("[dc_networking_multi_pod_apics]", curated)
        self.assertIn("[dc_networking_home_apics]", curated)
        self.assertEqual(report["removed_low_value"], 1)
        self.assertEqual(report["removed_exact_duplicates"], 0)

    def test_curates_match_all_predicates_across_catalog(self) -> None:
        conf = """# header
[catalyst]
dispatch_context = splunk-cisco-dashboards
search = | tstats count from datamodel=Cisco_Catalyst_App where nodename=Clients client_count=* by client

[nested]
dispatch_context = splunk-cisco-dashboards
search = index=main [ search index=devices (Site=* OR Location=* OR edge=true) | table host ]

[expression]
dispatch_context = cisco_dc_networking_app_for_splunk
search = index=dc | eval changed=if(lc!="*", 1, 0)
"""

        curated, report = curate_catalog_text(conf)

        self.assertIn("where nodename=Clients by client", curated)
        self.assertIn("[search index=devices (edge=true) | table host]", curated)
        self.assertIn('eval changed=if(lc!="*", 1, 0)', curated)
        self.assertEqual(report["changed_stanzas"], 3)
        self.assertEqual(report["changed_searches"], 2)
        self.assertEqual(report["removed_match_all_predicates"], 3)

    def test_repairs_unterminated_multiline_search(self) -> None:
        conf = """[incident_summary]
description = <p>Incident summary.</p>
explanation = <p>Counts incidents.</p>
solution = <p>Review open incidents.</p>
related_info = <p>ServiceNow incidents.</p>
search = sourcetype="snow:incident"
| stats count by severity
| sort - count
"""

        curated, report = curate_catalog_text(conf)

        self.assertEqual(find_unterminated_search_lines(curated), [])
        self.assertIn('search = sourcetype="snow:incident"\\\n', curated)
        self.assertIn("| stats count by severity\n", curated)
        self.assertNotIn("| sort - count", curated)
        self.assertEqual(report["formatting_repairs"], 1)
        self.assertEqual(report["removed_match_all_predicates"], 0)

    def test_removes_only_redundant_timechart_projection(self) -> None:
        conf = (
            "[redundant]\n"
            "search = index=main\\\n"
            '| timechart avg(score) as "Health Score"\\\n'
            '| fields _time "Health Score"\n\n'
            "[meaningful]\n"
            "search = index=main\\\n"
            "| timechart avg(score) as score\\\n"
            "| predict score as predicted\\\n"
            "| fields _time score predicted\n"
        )

        curated, report = curate_catalog_text(conf)

        self.assertNotIn('| fields _time "Health Score"', curated)
        self.assertIn("| fields _time score predicted", curated)
        self.assertEqual(report["removed_redundant_timechart_projections"], 1)
        self.assertEqual(report["projection_stanza_ids"], ["redundant"])

    def test_normalizes_harvested_search_ownership(self) -> None:
        conf = """[dc]
dispatch_context = cisco_dc_networking_app_for_splunk
search = `cisco_dc_aci_index` sourcetype=cisco:dc:aci:class\
| append [search `cisco_dc_n9k_index` sourcetype=cisco:dc:nexus9k]\
| append [search `cisco_dc_nd_index` sourcetype=cisco:dc:nd:syslog]\
| append [tstats `summariesonly` count from datamodel=Cisco_DCN_Fault]\
| append [`apic_details`]
"""

        curated, report = curate_catalog_text(conf)

        self.assertIn("dispatch_context = splunk-cisco-dashboards", curated)
        self.assertEqual(curated.count("`index_dc`"), 3)
        self.assertIn("`scd_summariesonly`", curated)
        self.assertIn("`apic_details`", curated)
        self.assertNotIn("`cisco_dc_aci_index`", curated)
        self.assertEqual(report["normalized_dispatch_contexts"], 1)
        self.assertEqual(
            report["normalized_macro_references"],
            {
                "cisco_dc_aci_index->index_dc": 1,
                "cisco_dc_n9k_index->index_dc": 1,
                "cisco_dc_nd_index->index_dc": 1,
                "summariesonly->scd_summariesonly": 1,
            },
        )

    def test_optimizes_eventtype_base_and_removes_only_table_star(self) -> None:
        conf = (
            "[optimized]\n"
            "explanation = <p>Runs the dashboard panel SPL against the source app's macros and indexed fields. Dashboard-only filters are neutralized.</p>\n"
            'search = eventtype="cisco_dc_nd_mso" mso_api_endpoint=siteHealth\\\n'
            "| table *\\\n"
            '| join id [search eventtype="cisco_dc_aci_health" component=fabricNode | fields id]\\\n'
            "| dedup mso_site_id\\\n"
            "| table mso_site_id health_score\n\n"
            "[unverified]\n"
            "search = eventtype=custom_event severity=critical\\\n"
            "| stats count\n\n"
            "[downstream]\n"
            "search = index=main\\\n"
            "| search eventtype=cisco_dc_nd_mso\\\n"
            "| stats count\n"
        )

        curated, report = curate_catalog_text(conf)

        self.assertIn(
            'search = `index_dc` sourcetype="cisco:dc:nd:mso" mso_api_endpoint=siteHealth',
            curated,
        )
        self.assertNotIn("| table *", curated)
        self.assertIn(
            '[search `index_dc` sourcetype="cisco:dc:aci:health" component=fabricNode',
            curated,
        )
        self.assertIn("| table mso_site_id health_score", curated)
        self.assertIn("Runs curated SPL from this app with app-owned index scoping", curated)
        self.assertNotIn("source app's macros and indexed fields", curated)
        self.assertIn("search = eventtype=custom_event severity=critical", curated)
        self.assertIn("| search eventtype=cisco_dc_nd_mso", curated)
        self.assertEqual(report["removed_table_star_commands"], 1)
        self.assertEqual(report["updated_ownership_explanations"], 1)
        self.assertEqual(
            report["normalized_eventtype_bases"],
            {"cisco_dc_aci_health": 1, "cisco_dc_nd_mso": 1},
        )

    def test_uses_html_heading_for_untitled_visualization(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            dashboard_path = Path(temp_dir) / "vmware.xml"
            dashboard_path.write_text(
                """
                <dashboard>
                    <label>VMware</label>
                    <row><panel>
                        <html><h1>Virtual Machine Alarms</h1></html>
                        <table><search><query>index=vmware | stats count</query></search></table>
                    </panel></row>
                </dashboard>
                """,
                encoding="utf-8",
            )

            _, entries, _ = extract_dashboard(dashboard_path, {})

            self.assertEqual(entries[0].panel_title, "Virtual Machine Alarms")

    def test_rejects_external_entity(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            secret_path = temp_path / "secret.txt"
            secret_path.write_text("XXE_CANARY_SECRET", encoding="utf-8")
            dashboard_path = temp_path / "hostile.xml"
            dashboard_path.write_text(
                f"""
                <?xml version="1.0"?>
                <!DOCTYPE dashboard [
                    <!ENTITY xxe SYSTEM "{secret_path.as_uri()}">
                ]>
                <dashboard>
                    <label>Hostile</label>
                    <row><panel><table><search><query>&xxe;</query></search></table></panel></row>
                </dashboard>
                """.lstrip(),
                encoding="utf-8",
            )

            _, entries, skipped = extract_dashboard(dashboard_path, {})

            self.assertEqual(entries, [])
            self.assertTrue(any(reason.startswith("parse_error:") for reason in skipped))


if __name__ == "__main__":
    unittest.main()