from __future__ import annotations

import unittest

from scripts.format_searchbase_conf import format_search, format_stanza
from scripts.lint_spl_antipatterns import lint_search, lint_text


class FormatSearchbaseConfTest(unittest.TestCase):
    def test_removes_projection_and_sort_stages_around_stats(self) -> None:
        search = (
            "index=main | fields host status | sort 0 host | table host status "
            "| stats count by host | fields host count | sort - count"
        )

        formatted, changed = format_search(search)

        self.assertTrue(changed)
        self.assertEqual(formatted, "index=main\n| stats count by host")

    def test_preserves_subsearch_stages_and_non_stats_pipeline(self) -> None:
        search = (
            "index=main [ search index=inventory | fields host | stats count by host ] "
            "| fields host status | sort host"
        )

        formatted, changed = format_search(search)

        self.assertTrue(changed)
        self.assertIn("[ search index=inventory | fields host | stats count by host ]", formatted)
        self.assertTrue(formatted.endswith("| fields host status"))

    def test_keeps_post_stats_pipeline_when_suffix_is_not_only_projection_or_sort(self) -> None:
        search = "index=main | stats count by host | eval healthy=count>0 | fields host healthy"

        formatted, changed = format_search(search)

        self.assertTrue(changed)
        self.assertTrue(formatted.endswith("| eval healthy=count>0\n| fields host healthy"))

    def test_removes_bounded_top_n_sort_after_stats(self) -> None:
        search = "index=main | stats count by host | fields host count | sort 10 - count"

        formatted, changed = format_search(search)

        self.assertTrue(changed)
        self.assertEqual(formatted, "index=main\n| stats count by host")

    def test_removes_cosmetic_sort_and_paired_reverse(self) -> None:
        search = "index=main | table host status | sort 0 host | reverse | rename host as Host"

        formatted, changed = format_search(search)

        self.assertTrue(changed)
        self.assertEqual(formatted, "index=main\n| table host status\n| rename host as Host")

    def test_stats_rule_overrides_reviewed_unbounded_sort_contract(self) -> None:
        search = "index=main | stats count by severity | sort - count"

        formatted, changed = format_search(search, preserve_unbounded_sort=True)
        violations = lint_search(search, stanza="it_health_thousandeyes_alerts_summary")

        self.assertTrue(changed)
        self.assertEqual(formatted, "index=main\n| stats count by severity")
        self.assertEqual([violation.rule_id.split()[0] for violation in violations], ["R011"])

    def test_removes_nested_sort_when_search_uses_tstats(self) -> None:
        search = (
            "index=main | join host [ | tstats count where index=inventory by host "
            "| sort 0 host - count | streamstats count by host ] | table host"
        )

        formatted, changed = format_search(search)

        self.assertTrue(changed)
        self.assertNotIn("sort", formatted)
        self.assertIn("streamstats count by host", formatted)

    def test_removes_sort_language_from_aggregate_metadata(self) -> None:
        block, search_changed, metadata_changed = format_stanza(
            "aggregate_summary",
            {
                "description": "Results are sorted descending.",
                "related_info": "Use <code>sort -count</code> for triage.",
                "search": "index=main | stats count by host | sort - count",
            },
        )

        self.assertTrue(search_changed)
        self.assertTrue(metadata_changed)
        self.assertNotIn("sort", block.lower())
        self.assertIn("| stats count by host", block)

    def test_lints_stats_adjacent_stages_but_ignores_nested_pipeline(self) -> None:
        search = (
            "index=main [ search index=inventory | fields host | stats count by host ] "
            "| fields host status | stats count by host | sort - count"
        )

        violations = lint_search(search)

        self.assertEqual(
            [violation.rule_id.split()[0] for violation in violations],
            ["R008", "R011"],
        )

    def test_allows_explicit_table_ui_sort_guidance(self) -> None:
        conf = """[table_ui]
solution = <p>Row order is not defined by the search — the visualization controls presentation, so sort Count in the table when needed.</p>
search = index=main | stats count as Count by host
"""

        self.assertEqual(lint_text(conf), [])

    def test_rejects_metadata_claim_that_aggregate_search_sorts_rows(self) -> None:
        conf = """[stale_claim]
solution = <p>Results are sorted by Count so the busiest host appears first.</p>
search = index=main | stats count as Count by host
"""

        violations = lint_text(conf)

        self.assertEqual([violation.rule_id.split()[0] for violation in violations], ["R012"])


if __name__ == "__main__":
    unittest.main()
