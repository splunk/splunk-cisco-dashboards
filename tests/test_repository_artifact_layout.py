import runpy
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
SEARCHBASE_ARTIFACTS = ROOT / "artifacts" / "searchbase"


class RepositoryArtifactLayoutTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        sys.path.insert(0, str(SCRIPTS))
        cls.build_export = runpy.run_path(str(SCRIPTS / "build_searchbase_export.py"))
        cls.validate_export = runpy.run_path(
            str(SCRIPTS / "validate_searchbase_export.py")
        )
        cls.build_review = runpy.run_path(
            str(SCRIPTS / "build_searchbase_review_report.py")
        )
        cls.audit_cim = runpy.run_path(
            str(SCRIPTS / "audit_cim_migration_status.py")
        )

    @classmethod
    def tearDownClass(cls):
        if sys.path and sys.path[0] == str(SCRIPTS):
            sys.path.pop(0)

    def test_generated_searchbase_artifacts_use_the_central_layout(self):
        expected_files = {
            SEARCHBASE_ARTIFACTS / "exports" / "searchbase_export.conf",
            SEARCHBASE_ARTIFACTS / "exports" / "searchbase_export_fail.conf",
            SEARCHBASE_ARTIFACTS / "exports" / "searchbase_export_pass.conf",
            SEARCHBASE_ARTIFACTS / "exports" / "searchbase_export_report.txt",
            SEARCHBASE_ARTIFACTS / "exports" / "temp_searchbase.conf",
            SEARCHBASE_ARTIFACTS
            / "reports"
            / "searchbase_review_report.json",
            SEARCHBASE_ARTIFACTS / "cim" / "searchbase_cim_inventory.csv",
            SEARCHBASE_ARTIFACTS / "cim" / "searchbase_cim_disposition.txt",
        }
        self.assertEqual(
            {path for path in expected_files if not path.is_file()},
            set(),
            "Every organized Searchbase artifact must exist",
        )

    def test_generators_and_validators_target_the_central_layout(self):
        export_dir = SEARCHBASE_ARTIFACTS / "exports"
        self.assertEqual(self.build_export["EXPORT_DIR"], export_dir)
        self.assertEqual(self.validate_export["EXPORT_DIR"], export_dir)
        self.assertEqual(
            self.build_review["REPORT"],
            SEARCHBASE_ARTIFACTS / "reports" / "searchbase_review_report.json",
        )
        self.assertEqual(
            self.audit_cim["DEFAULT_DISPOSITION"],
            SEARCHBASE_ARTIFACTS / "cim" / "searchbase_cim_disposition.txt",
        )

    def test_retired_artifact_locations_do_not_return(self):
        retired_paths = {
            ROOT / "packages" / "splunk-cisco-dashboards" / "exports",
            ROOT / "docs" / "searchbase_review_report.json",
            ROOT / "searchbase_cim_inventory.csv",
            ROOT / "searchbase_cim_disposition.txt",
            ROOT
            / "packages"
            / "splunk-cisco-dashboards"
            / "docs"
            / "SESSION_LOG.md",
        }
        self.assertEqual(
            {path for path in retired_paths if path.exists()},
            set(),
            "Generated artifacts and history must stay in their organized locations",
        )
        self.assertTrue((ROOT / "docs" / "history" / "SESSION_LOG.md").is_file())


if __name__ == "__main__":
    unittest.main()
