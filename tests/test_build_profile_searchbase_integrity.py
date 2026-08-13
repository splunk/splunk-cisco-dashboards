import json
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
APP_SRC = ROOT / "packages" / "splunk-cisco-dashboards" / "src" / "main"
PACKAGE_ROOT = ROOT / "packages" / "splunk-cisco-dashboards"
DEFAULT = APP_SRC / "resources" / "splunk" / "default"
LIVE_SEARCHBASE = DEFAULT / "searchbase.conf"
SAVED_SEARCHES = DEFAULT / "savedsearches.conf"
RETIRED_SEARCHBASE_BACKUP = DEFAULT / "searchbase.bak"
INSIGHTS_WORKSPACES = DEFAULT / "insights_workspaces.conf"
VIEWS = DEFAULT / "data" / "ui" / "views"
MANIFEST_PATH = PACKAGE_ROOT / "config" / "build-profile-manifest.json"


def parse_stanzas(path):
    text = path.read_text(encoding="utf-8")
    matches = list(re.finditer(r"^\[([^\]\r\n]+)\]\s*$", text, re.MULTILINE))
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


class DevelopingSearchbaseIntegrityTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
        cls.developing_ids = cls.manifest["developing"]["searchbaseStanzas"]
        cls.developing_id_set = set(cls.developing_ids)
        cls.developing_view_paths = {
            VIEWS / f"{view_id}.xml"
            for view_id in cls.manifest["developing"]["views"]
        }
        cls.developing_saved_searches = set(
            cls.manifest["developing"]["savedSearches"]
        )
        cls.live = parse_stanzas(LIVE_SEARCHBASE)
        cls.saved_searches = parse_stanzas(SAVED_SEARCHES)
        cls.developing_names = {
            stanza["fields"].get("search_name"): stanza_id
            for stanza_id, stanza in cls.live.items()
            if stanza_id in cls.developing_id_set
            and stanza["fields"].get("search_name")
        }

    def test_backup_was_replaced_by_the_build_manifest(self):
        self.assertFalse(
            RETIRED_SEARCHBASE_BACKUP.exists(),
            "searchbase.bak must not return after migration to the build manifest",
        )

    def test_developing_ids_are_unique_and_exist_in_searchbase(self):
        self.assertEqual(
            len(self.developing_ids),
            len(self.developing_id_set),
            "Developing Searchbase IDs must be unique",
        )
        self.assertEqual(
            self.developing_id_set - set(self.live),
            set(),
            "Every developing Searchbase ID must resolve to searchbase.conf",
        )

    def test_released_runtime_sources_do_not_reference_developing_searches(self):
        markers = list(self.developing_ids)
        if not markers:
            return
        marker_pattern = re.compile(
            r"(?<![A-Za-z0-9_])(?:"
            + "|".join(
                sorted(
                    (re.escape(marker) for marker in markers),
                    key=len,
                    reverse=True,
                )
            )
            + r")(?![A-Za-z0-9_])"
        )
        references = []

        for path in APP_SRC.rglob("*"):
            if not path.is_file() or path in self.developing_view_paths:
                continue
            if path == LIVE_SEARCHBASE:
                documents = [
                    (stanza_id, stanza["body"])
                    for stanza_id, stanza in self.live.items()
                    if stanza_id not in self.developing_id_set
                ]
            elif path == SAVED_SEARCHES:
                documents = [
                    (stanza_id, stanza["body"])
                    for stanza_id, stanza in self.saved_searches.items()
                    if stanza_id not in self.developing_saved_searches
                ]
            else:
                documents = [
                    (
                        str(path.relative_to(ROOT)),
                        path.read_text(encoding="utf-8", errors="ignore"),
                    )
                ]

            for document_name, text in documents:
                for match in marker_pattern.finditer(text):
                    references.append(f"{match.group(0)} in {document_name}")

        self.assertEqual(
            references,
            [],
            "Released runtime sources reference developing Searchbase resources:\n"
            + "\n".join(references),
        )

    def test_released_drilldowns_do_not_target_developing_searches(self):
        references = []
        for source_id, stanza in self.live.items():
            if source_id in self.developing_id_set:
                continue
            target_name = stanza["fields"].get("drilldown_search_name")
            if target_name in self.developing_names:
                references.append(
                    f"{source_id} -> {self.developing_names[target_name]} "
                    f"({target_name})"
                )
        self.assertEqual(
            references,
            [],
            "Released Searchbase drilldowns target developing searches:\n"
            + "\n".join(references),
        )

    def test_developing_searches_are_not_released_insights_tiles(self):
        insights_text = INSIGHTS_WORKSPACES.read_text(encoding="utf-8")
        configured_tiles = {
            tile.strip()
            for match in re.finditer(r"^tiles\s*=\s*(.*)$", insights_text, re.MULTILINE)
            for tile in match.group(1).split(",")
            if tile.strip()
        }
        references = []
        for stanza_id in self.developing_ids:
            raw_options = self.live[stanza_id]["fields"].get("viz_options", "{}")
            try:
                options = json.loads(raw_options)
            except json.JSONDecodeError:
                continue
            overview = options.get("overview", [])
            if not isinstance(overview, list):
                continue
            for tile in overview:
                tile_id = tile.get("tileId") if isinstance(tile, dict) else None
                if tile_id in configured_tiles:
                    references.append(f"{stanza_id} -> Insights tile {tile_id}")
        self.assertEqual(
            references,
            [],
            "Developing searches still provide released Insights tiles:\n"
            + "\n".join(references),
        )


if __name__ == "__main__":
    unittest.main()
