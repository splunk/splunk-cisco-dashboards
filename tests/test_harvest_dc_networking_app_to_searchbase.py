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


class HarvestDcNetworkingTest(unittest.TestCase):
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