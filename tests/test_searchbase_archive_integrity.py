import json
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
APP_SRC = ROOT / "packages" / "splunk-cisco-dashboards" / "src" / "main"
DEFAULT = APP_SRC / "resources" / "splunk" / "default"
LIVE_SEARCHBASE = DEFAULT / "searchbase.conf"
ARCHIVED_SEARCHBASE = DEFAULT / "searchbase.bak"
INSIGHTS_WORKSPACES = DEFAULT / "insights_workspaces.conf"


def parse_stanzas(path):
    text = path.read_text(encoding="utf-8")
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


class SearchbaseArchiveIntegrityTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.live = parse_stanzas(LIVE_SEARCHBASE)
        cls.archived = parse_stanzas(ARCHIVED_SEARCHBASE)
        cls.archived_names = {
            stanza["fields"].get("search_name"): stanza_id
            for stanza_id, stanza in cls.archived.items()
            if stanza["fields"].get("search_name")
        }

    def test_archive_and_live_registry_do_not_overlap(self):
        self.assertTrue(self.archived, "searchbase.bak must contain archived stanzas")
        self.assertEqual(
            set(self.live) & set(self.archived),
            set(),
            "A Searchbase stanza cannot be both live and archived",
        )

    def test_archived_ids_are_not_referenced_by_runtime_source(self):
        archived_markers = list(self.archived) + list(self.archived_names)
        archived_marker_pattern = re.compile(
            r"(?<![A-Za-z0-9_])(?:"
            + "|".join(
                sorted(
                    (re.escape(marker) for marker in archived_markers),
                    key=len,
                    reverse=True,
                )
            )
            + r")(?![A-Za-z0-9_])"
        )
        references = []
        for path in APP_SRC.rglob("*"):
            if not path.is_file() or path in {LIVE_SEARCHBASE, ARCHIVED_SEARCHBASE}:
                continue
            text = path.read_text(encoding="utf-8", errors="ignore")
            for match in archived_marker_pattern.finditer(text):
                references.append(
                    f"{match.group(0)} in {path.relative_to(ROOT)}:"
                    f"{text.count(chr(10), 0, match.start()) + 1}"
                )
        self.assertEqual(
            references,
            [],
            "Archived Searchbase IDs or display names still have runtime source references:\n"
            + "\n".join(references),
        )

    def test_live_drilldowns_do_not_target_archived_searches(self):
        references = []
        for source_id, stanza in self.live.items():
            target_name = stanza["fields"].get("drilldown_search_name")
            if target_name in self.archived_names:
                references.append(
                    f"{source_id} -> {self.archived_names[target_name]} ({target_name})"
                )
        self.assertEqual(
            references,
            [],
            "Live drilldowns target archived searches:\n" + "\n".join(references),
        )

    def test_archived_searches_are_not_indirect_insights_tiles(self):
        insights_text = INSIGHTS_WORKSPACES.read_text(encoding="utf-8")
        configured_tiles = {
            tile.strip()
            for match in re.finditer(r"^tiles\s*=\s*(.*)$", insights_text, re.MULTILINE)
            for tile in match.group(1).split(",")
            if tile.strip()
        }
        references = []
        for stanza_id, stanza in self.archived.items():
            raw_options = stanza["fields"].get("viz_options", "{}")
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
            "Archived searches still provide configured Insights tiles:\n"
            + "\n".join(references),
        )


if __name__ == "__main__":
    unittest.main()
