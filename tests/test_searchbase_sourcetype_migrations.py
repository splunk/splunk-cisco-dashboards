from pathlib import Path
import json
import re
import unittest

from scripts.format_searchbase_conf import parse_stanzas


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
BUILD_PROFILE_MANIFEST = (
    ROOT
    / "packages"
    / "splunk-cisco-dashboards"
    / "config"
    / "build-profile-manifest.json"
)

DIRECT_PAIRS = (
    ("cisco:dnac:clienthealth", "cisco:catalyst:clienthealth"),
    ("cisco:dnac:devicehealth", "cisco:catalyst:devicehealth"),
    ("cisco:dnac:compliance", "cisco:catalyst:compliance"),
    ("cisco:dnac:issue", "cisco:catalyst:issue"),
    ("cisco:dnac:networkhealth", "cisco:catalyst:networkhealth"),
    ("cisco:dnac:securityadvisory", "cisco:catalyst:securityadvisory"),
    ("cisco:dnac:client", "cisco:catalyst:client"),
    ("cisco:dnac:inventory:report", "cisco:catalyst:center:inventory:report"),
    ("cisco:dnac:compliance:report", "cisco:catalyst:center:compliance:report"),
    ("cisco:dnac:report", "cisco:catalyst:center:report"),
    ("cisco:netflow", "stream:netflow"),
    ("cisco:sdwan:system:logs", "cisco:sdwan:sytem:logs"),
)

CUSTOM_FAMILIES = (
    ("cisco:dnac:custom", "cisco:dnac:custom:*"),
    ("cisco:sdwan:custom", "cisco:sdwan:custom:*"),
    ("cisco:ise:custom", "cisco:ise:custom:*"),
    ("cisco:cybervision:custom", "cisco:cybervision:custom:*"),
)

POLICY_MIGRATIONS = (
    ("cisco:ise:radius:policyset", "radius", "policy_set"),
    ("cisco:ise:radius:authz:policy", "radius", "authorization_rule"),
    ("cisco:ise:tacacs:policyset", "tacacs", "policy_set"),
    ("cisco:ise:tacacs:authz:policy", "tacacs", "authorization_rule"),
)

ISE_SYSLOG_SOURCETYPES = (
    "cisco:ise:syslog",
    "cisco:ise",
    "Cisco:ISE:Syslog",
)


def _predicate_has(search: str, sourcetype: str) -> bool:
    value = re.escape(sourcetype)
    equality = rf'sourcetype\s*={{1,2}}\s*"?{value}"?(?![A-Za-z0-9_:*.-])'
    in_list = rf'sourcetype\s+IN\s*\([^)]*(?<![A-Za-z0-9_:*.-])"?{value}"?(?![A-Za-z0-9_:*.-])'
    return bool(re.search(equality, search) or re.search(in_list, search))


class SearchbaseSourcetypeMigrationsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        manifest = json.loads(BUILD_PROFILE_MANIFEST.read_text(encoding="utf-8"))
        developing_ids = set(manifest["developing"]["searchbaseStanzas"])
        cls.searches = {
            stanza_id: fields
            for stanza_id, fields in parse_stanzas(
                SEARCHBASE.read_text(encoding="utf-8")
            )
            if stanza_id not in developing_ids
        }

    def test_direct_migrations_never_use_only_one_sourcetype(self):
        for stanza_id, fields in self.searches.items():
            search = fields["search"]
            for current, previous in DIRECT_PAIRS:
                with self.subTest(stanza=stanza_id, current=current, previous=previous):
                    has_current = _predicate_has(search, current)
                    has_previous = _predicate_has(search, previous)
                    self.assertEqual(has_current, has_previous)

    def test_ise_syslog_searches_cover_current_and_retained_names(self):
        for stanza_id, fields in self.searches.items():
            search = fields["search"]
            coverage = [_predicate_has(search, value) for value in ISE_SYSLOG_SOURCETYPES]
            if not any(coverage):
                continue
            with self.subTest(stanza=stanza_id):
                self.assertTrue(
                    all(coverage) or 'sourcetype="cisco:ise:*"' in search,
                    "ISE syslog predicates must cover all retained sourcetypes",
                )

    def test_custom_api_families_are_dual_read_when_targeted(self):
        for stanza_id, fields in self.searches.items():
            search = fields["search"]
            for current, previous in CUSTOM_FAMILIES:
                with self.subTest(stanza=stanza_id, current=current):
                    self.assertEqual(
                        _predicate_has(search, current),
                        _predicate_has(search, previous),
                    )

    def test_ise_policy_history_has_current_discriminated_coverage(self):
        previous_values = tuple(item[0] for item in POLICY_MIGRATIONS)
        for stanza_id, fields in self.searches.items():
            search = fields["search"]
            whole_family = all(_predicate_has(search, value) for value in previous_values)
            for previous, protocol, record_type in POLICY_MIGRATIONS:
                if not _predicate_has(search, previous):
                    continue
                with self.subTest(stanza=stanza_id, previous=previous):
                    self.assertTrue(_predicate_has(search, "cisco:ise:policy"))
                    if not whole_family:
                        self.assertIn(f"policy_protocol={protocol}", search)
                        self.assertIn(f"policy_record_type={record_type}", search)

    def test_sdwan_access_history_has_current_family_coverage(self):
        previous_values = (
            "cisco:sdwan:acl:logs",
            "cisco:sdwan:sgacl:logs",
            "cisco:sgacl:logs",
        )
        for stanza_id, fields in self.searches.items():
            search = fields["search"]
            if not any(_predicate_has(search, value) for value in previous_values):
                continue
            with self.subTest(stanza=stanza_id):
                self.assertTrue(_predicate_has(search, "cisco:sdwan:access:logs"))

    def test_migrations_do_not_use_transition_eventtypes(self):
        migration_terms = re.compile(
            r"cisco:(?:dnac|catalyst|sdwan|ise|cybervision|netflow)|stream:netflow",
            re.IGNORECASE,
        )
        for stanza_id, fields in self.searches.items():
            search = fields["search"]
            if migration_terms.search(search):
                with self.subTest(stanza=stanza_id):
                    self.assertNotRegex(search, r"\beventtype\s*=")

    def test_retired_ise_securitygroups_is_not_a_live_search_source(self):
        for stanza_id, fields in self.searches.items():
            with self.subTest(stanza=stanza_id):
                self.assertFalse(
                    _predicate_has(fields["search"], "cisco:ise:securitygroups")
                )


if __name__ == "__main__":
    unittest.main()
