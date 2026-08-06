from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from scripts.match_searchbase_to_dashboards import extract_xml_queries


class ExtractXmlQueriesTest(unittest.TestCase):
    def test_extracts_query_from_safe_dashboard_xml(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            dashboard_path = Path(temp_dir) / "network_health.xml"
            dashboard_path.write_text(
                """
                <dashboard>
                    <label>Network Health</label>
                    <search>
                        <query><![CDATA[index=network | stats count]]></query>
                    </search>
                </dashboard>
                """,
                encoding="utf-8",
            )

            self.assertEqual(
                extract_xml_queries(dashboard_path),
                [("Network Health", "index=network | stats count")],
            )

    def test_rejects_external_entity_without_reading_local_file(self) -> None:
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
                    <label>Hostile Dashboard</label>
                    <search><query>&xxe;</query></search>
                </dashboard>
                """.lstrip(),
                encoding="utf-8",
            )

            self.assertEqual(extract_xml_queries(dashboard_path), [])

    def test_preserves_regex_fallback_for_malformed_non_dtd_xml(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            dashboard_path = Path(temp_dir) / "legacy_dashboard.xml"
            dashboard_path.write_text(
                """
                <dashboard>
                    <label>Legacy Dashboard</label>
                    <search><query>index=legacy | stats count</query></search>
                """,
                encoding="utf-8",
            )

            self.assertEqual(
                extract_xml_queries(dashboard_path),
                [("Legacy Dashboard", "index=legacy | stats count")],
            )


if __name__ == "__main__":
    unittest.main()
