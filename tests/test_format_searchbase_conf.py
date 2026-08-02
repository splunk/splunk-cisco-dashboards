from __future__ import annotations

import unittest

from scripts.format_searchbase_conf import format_search
from scripts.lint_spl_antipatterns import lint_search


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

    def test_retains_bounded_top_n_sort(self) -> None:
        search = "index=main | stats count by host | fields host count | sort 10 - count"

        formatted, changed = format_search(search)

        self.assertTrue(changed)
        self.assertEqual(formatted, "index=main\n| stats count by host\n| sort 10 - count")

    def test_removes_cosmetic_sort_and_paired_reverse(self) -> None:
        search = "index=main | table host status | sort 0 host | reverse | rename host as Host"

        formatted, changed = format_search(search)

        self.assertTrue(changed)
        self.assertEqual(formatted, "index=main\n| table host status\n| rename host as Host")

    def test_preserves_reviewed_unbounded_sort_contract(self) -> None:
        search = "index=main | stats count by severity | sort - count"

        formatted, changed = format_search(search, preserve_unbounded_sort=True)
        violations = lint_search(search, stanza="it_health_thousandeyes_alerts_summary")

        self.assertTrue(changed)
        self.assertTrue(formatted.endswith("| sort - count"))
        self.assertEqual(violations, [])

    def test_lints_stats_adjacent_stages_but_ignores_nested_pipeline(self) -> None:
        search = (
            "index=main [ search index=inventory | fields host | stats count by host ] "
            "| fields host status | stats count by host | sort - count"
        )

        violations = lint_search(search)

        self.assertEqual(
            [violation.rule_id.split()[0] for violation in violations],
            ["R008", "R010"],
        )


if __name__ == "__main__":
    unittest.main()