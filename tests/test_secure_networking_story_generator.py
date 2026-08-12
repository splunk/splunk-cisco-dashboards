import json
import tempfile
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from scripts.generate_secure_networking_story_dashboards import (
    StoryConfigurationError,
    build_dashboard_definition,
    generate_story_dashboards,
    load_story_config,
    main,
    parse_searchbase,
    render_dashboard_xml,
    resolve_card_field_bindings,
    resolve_card_graph_type,
    strip_html,
)


def searchbase_fixture(*, bad_primary: int | None = None) -> str:
    stanzas = []
    for index in range(1, 7):
        overview = {"valueField": "score", "sparkDataField": "score"}
        if index == 2:
            overview["label"] = f"Overview KPI {index}"
        search = (
            "`index_fixture` | stats count as score"
            if index == bad_primary
            else f"`index_fixture` metric={index}\\\n| timechart count as score"
        )
        stanzas.append(
            f"""
[primary_{index}]
search_name = Story KPI {index}
category = Secure & Network {index}
sub_category = Posture * {index}
description = <p>Explains <b>KPI {index}</b> clearly.</p><script>bad()</script>
viz_options = {json.dumps({"overview": [overview]}, separators=(",", ":"))}
search = {search}
""".strip()
        )
        for detail_index in range(1, 3):
            stanzas.append(
                f"""
[detail_{index}_{detail_index}]
search_name = Detail {index}.{detail_index} / evidence
category = Secure Networking
sub_category = Detail
description = <p>Supporting evidence.</p>
search = `index_fixture` | stats count
""".strip()
            )
    return "\n\n".join(stanzas) + "\n"


def story_fixture(label: str = "Story & <Posture>") -> dict:
    return {
        "label": label,
        "description": "Six signals explain posture & risk <cleanly>.",
        "header_icon": "/static/app/example/header.svg?x=1&y=2",
        "cards": [
            {
                "primary": f"primary_{index}",
                "targets": [f"detail_{index}_1", f"detail_{index}_2"],
                "description": "<p>Short <b>powerful</b> story.</p>"
                if index == 1
                else f"KPI {index} story.",
                **({"title": "KPI *one* [unsafe]"} if index == 1 else {}),
            }
            for index in range(1, 7)
        ],
    }


class SecureNetworkingStoryGeneratorTest(unittest.TestCase):
    def setUp(self):
        self.searchbase = parse_searchbase(searchbase_fixture())
        self.dashboard_id = "sn_fixture_story"
        self.story = story_fixture()

    def test_searchbase_parser_joins_spl_and_strips_html(self):
        entry = self.searchbase["primary_1"]
        self.assertIn("\n| timechart count as score", entry.search)
        self.assertEqual(strip_html(entry.get("description")), "Explains KPI 1 clearly.")
        self.assertNotIn("bad()", strip_html(entry.get("description")))

    def test_definition_is_six_card_dark_story_with_bounded_dispatches(self):
        definition = build_dashboard_definition(
            self.dashboard_id, self.story, self.searchbase
        )

        self.assertEqual(definition["title"], self.story["label"])
        self.assertEqual(definition["description"], self.story["description"])
        self.assertEqual(
            definition["visualizations"]["viz_header_icon"]["options"]["src"],
            self.story["header_icon"],
        )
        layout = definition["layout"]["layoutDefinitions"]["layout_overview"]
        self.assertEqual(layout["type"], "absolute")
        self.assertEqual(layout["options"]["display"], "auto-scale")
        self.assertEqual(layout["options"]["width"], 1440)
        self.assertEqual(layout["options"]["backgroundColor"], "#020617")
        self.assertEqual(
            definition["visualizations"]["viz_header_bg"]["options"],
            {
                "fillColor": "#1e293b",
                "strokeColor": "rgba(14,165,233,0.42)",
                "rx": 10,
            },
        )

        sources = definition["dataSources"]
        self.assertEqual(len(sources), 6)
        self.assertTrue(all(source["type"] == "ds.searchbase" for source in sources.values()))
        self.assertEqual(
            {source["options"]["ref"] for source in sources.values()},
            {f"primary_{index}" for index in range(1, 7)},
        )
        for source in sources.values():
            self.assertEqual(
                source["options"]["queryParameters"],
                {
                    "earliest": "$time_tok.earliest$",
                    "latest": "$time_tok.latest$",
                },
            )

        visualizations = definition["visualizations"]
        self.assertNotIn("splunk.table", {viz["type"] for viz in visualizations.values()})
        self.assertEqual(
            sum(viz["type"] == "splunk.singlevalue" for viz in visualizations.values()), 6
        )
        self.assertEqual(
            sum(viz["type"] == "splunk.area" for viz in visualizations.values()), 6
        )
        triggers = [
            viz
            for viz in visualizations.values()
            if viz["type"] == "splunk.rectangle" and viz.get("eventHandlers")
        ]
        self.assertEqual(len(triggers), 6)
        self.assertTrue(
            all(trigger["options"]["fillColor"] == "transparent" for trigger in triggers)
        )

        bindings = {}
        for viz in visualizations.values():
            if viz["type"] in {"splunk.singlevalue", "splunk.area"}:
                source_id = viz["dataSources"]["primary"]
                bindings.setdefault(source_id, []).append(viz["type"])
        self.assertEqual(set(bindings), set(sources))
        self.assertTrue(
            all(sorted(types) == ["splunk.area", "splunk.singlevalue"] for types in bindings.values())
        )

        first_metadata = visualizations["viz_card_01_metadata"]["options"]["markdown"]
        first_description = visualizations["viz_card_01_description"]["options"]["markdown"]
        first_title = visualizations["viz_card_01_title"]["options"]["markdown"]
        first_single = visualizations["viz_card_01_singlevalue"]
        first_graph = visualizations["viz_card_01_trend"]
        self.assertIn("Secure & Network 1", first_metadata)
        self.assertIn("Posture \\* 1", first_metadata)
        self.assertEqual(first_description, "Short powerful story\\.")
        self.assertEqual(first_title, "**KPI \\*one\\* \\[unsafe\\]**")
        self.assertEqual(
            first_single["options"]["majorValue"],
            '> primary | seriesByName("score") | lastPoint()',
        )
        self.assertEqual(
            first_graph["options"]["x"],
            '> primary | seriesByName("_time")',
        )
        self.assertEqual(
            first_graph["options"]["y"],
            '> primary | seriesByName("score")',
        )
        self.assertEqual(
            visualizations["viz_card_02_title"]["options"]["markdown"],
            "**Overview KPI 2**",
        )
        self.assertNotIn("<", first_description)
        self.assertFalse(any("drilldown_icon" in viz_id for viz_id in visualizations))
        serialized = json.dumps(definition)
        for retired_color in (
            "#07101d",
            "#0f1a2a",
            "#111f31",
            "#16283c",
            "#e8f1fb",
            "#53bfff",
            "#8bd45b",
            "#ff9a4a",
            "#ff7169",
            "#7c3aed",
            "#14b8a6",
            "rgba(53,207,245,0.42)",
        ):
            self.assertNotIn(retired_color, serialized)

        first_url = triggers[0]["eventHandlers"][0]["options"]["url"]
        params = parse_qs(urlparse(first_url).query)
        self.assertEqual(params["origin"], ["KPI *one* [unsafe]"])
        self.assertEqual(
            params["target"], ["Detail 1.1 / evidence,Detail 1.2 / evidence"]
        )

        backgrounds = [
            block
            for block in layout["structure"]
            if block["item"].endswith("_background")
        ]
        self.assertEqual(len(backgrounds), 6)
        self.assertEqual(
            sorted({block["position"]["x"] for block in backgrounds}), [20, 493, 966]
        )
        self.assertEqual(
            sorted({block["position"]["y"] for block in backgrounds}), [128, 624]
        )
        structures = {block["item"]: block["position"] for block in layout["structure"]}
        self.assertEqual(
            structures["viz_card_01_singlevalue"],
            {"x": 36, "y": 284, "w": 421, "h": 88},
        )
        self.assertEqual(
            structures["viz_card_01_trend"],
            {"x": 36, "y": 376, "w": 421, "h": 212},
        )

    def test_xml_is_well_formed_escaped_and_deterministic(self):
        xml_one = render_dashboard_xml(self.dashboard_id, self.story, self.searchbase)
        xml_two = render_dashboard_xml(self.dashboard_id, self.story, self.searchbase)
        self.assertEqual(xml_one, xml_two)
        self.assertIn('theme="dark"', xml_one)
        self.assertIn("Story &amp; &lt;Posture&gt;", xml_one)

        root = ET.fromstring(xml_one)
        self.assertEqual(root.findtext("label"), self.story["label"])
        definition = json.loads(root.findtext("definition"))
        self.assertEqual(definition["title"], self.story["label"])

        hostile = story_fixture(label="Safe ]]> ending")
        hostile_xml = render_dashboard_xml(self.dashboard_id, hostile, self.searchbase)
        hostile_root = ET.fromstring(hostile_xml)
        hostile_definition = json.loads(hostile_root.findtext("definition"))
        self.assertEqual(hostile_definition["title"], "Safe ]]> ending")

    def test_validation_rejects_bad_count_refs_metadata_and_non_time_series(self):
        too_few = story_fixture()
        too_few["cards"] = too_few["cards"][:-1]
        with self.assertRaisesRegex(StoryConfigurationError, "exactly 6 cards"):
            build_dashboard_definition(self.dashboard_id, too_few, self.searchbase)

        missing = story_fixture()
        missing["cards"][0]["targets"] = ["missing_detail"]
        with self.assertRaisesRegex(StoryConfigurationError, "missing Searchbase"):
            build_dashboard_definition(self.dashboard_id, missing, self.searchbase)

        bad_searchbase = parse_searchbase(searchbase_fixture(bad_primary=3))
        with self.assertRaisesRegex(StoryConfigurationError, "categorical search"):
            build_dashboard_definition(self.dashboard_id, self.story, bad_searchbase)

        missing_category = parse_searchbase(searchbase_fixture())
        missing_category["primary_2"].values.pop("category")
        with self.assertRaisesRegex(StoryConfigurationError, "missing category"):
            build_dashboard_definition(self.dashboard_id, self.story, missing_category)

        missing_fields = parse_searchbase(searchbase_fixture())
        missing_fields["primary_1"].values["viz_options"] = "{}"
        with self.assertRaisesRegex(StoryConfigurationError, "valueField is required"):
            build_dashboard_definition(self.dashboard_id, self.story, missing_fields)

        wrong_field = story_fixture()
        wrong_field["cards"][0]["valueField"] = "not_a_result_field"
        with self.assertRaisesRegex(StoryConfigurationError, "not present in Searchbase"):
            build_dashboard_definition(self.dashboard_id, wrong_field, self.searchbase)

    def test_categorical_graphs_are_allowed_but_tables_and_bad_area_searches_are_not(self):
        categorical = parse_searchbase(searchbase_fixture(bad_primary=3))
        categorical["primary_3"].values["default_viz"] = "splunk.pie"
        categorical["primary_3"].values["search"] = (
            "`index_fixture` | stats count as score by category"
        )
        pie_story = story_fixture()
        pie_story["cards"][2]["categoryField"] = "category"
        definition = build_dashboard_definition(self.dashboard_id, pie_story, categorical)
        self.assertEqual(definition["visualizations"]["viz_card_03_trend"]["type"], "splunk.pie")
        self.assertEqual(
            definition["visualizations"]["viz_card_03_trend"]["dataSources"],
            {"primary": "ds_story_03"},
        )
        self.assertEqual(len(definition["dataSources"]), 6)
        self.assertEqual(
            definition["visualizations"]["viz_card_03_trend"]["options"]["label"],
            '> primary | seriesByName("category")',
        )
        self.assertEqual(
            definition["visualizations"]["viz_card_03_trend"]["options"]["value"],
            '> primary | seriesByName("score")',
        )

        explicit = story_fixture()
        explicit["cards"][2]["vizType"] = "bar"
        explicit["cards"][2]["xField"] = "category"
        definition = build_dashboard_definition(self.dashboard_id, explicit, categorical)
        self.assertEqual(definition["visualizations"]["viz_card_03_trend"]["type"], "splunk.bar")

        multi_series = story_fixture()
        multi_series["cards"][0]["graphFields"] = ["score", "other_score"]
        multi_searchbase = parse_searchbase(searchbase_fixture())
        multi_searchbase["primary_1"].values["search"] += (
            "\n| eval other_score=score"
        )
        definition = build_dashboard_definition(
            self.dashboard_id, multi_series, multi_searchbase
        )
        self.assertEqual(
            definition["visualizations"]["viz_card_01_trend"]["options"]["y"],
            '> primary | frameBySeriesNames("score", "other_score")',
        )

        table = story_fixture()
        table["cards"][0]["vizType"] = "splunk.table"
        with self.assertRaisesRegex(StoryConfigurationError, "cannot use a table"):
            build_dashboard_definition(self.dashboard_id, table, self.searchbase)

        bad_area = story_fixture()
        bad_area["cards"][2]["vizType"] = "area"
        with self.assertRaisesRegex(StoryConfigurationError, "area mode"):
            build_dashboard_definition(self.dashboard_id, bad_area, categorical)

        self.assertEqual(
            resolve_card_graph_type(
                {"vizType": "column"},
                categorical["primary_3"],
                "fixture.card",
            ),
            "splunk.column",
        )
        self.assertEqual(
            resolve_card_field_bindings(
                {"categoryField": "category"},
                categorical["primary_3"],
                "splunk.pie",
                "fixture.card",
            ).graph_fields,
            ("score",),
        )

    def test_config_loaders_selected_generation_and_cli_check_do_not_mutate_views(self):
        second_id = "sn_fixture_second"
        stories = {self.dashboard_id: self.story, second_id: story_fixture("Second")}
        with tempfile.TemporaryDirectory() as temp_directory:
            root = Path(temp_directory)
            json_config = root / "stories.json"
            json_config.write_text(json.dumps(stories), encoding="utf-8")
            self.assertEqual(set(load_story_config(json_config)), set(stories))

            python_config = root / "stories.py"
            python_config.write_text(
                f"DASHBOARD_STORIES = {stories!r}\n", encoding="utf-8"
            )
            self.assertEqual(set(load_story_config(python_config)), set(stories))

            output = root / "views"
            rendered = generate_story_dashboards(
                stories,
                self.searchbase,
                output,
                selected=[second_id],
            )
            self.assertEqual(list(rendered), [second_id])
            self.assertTrue((output / f"{second_id}.xml").is_file())
            self.assertFalse((output / f"{self.dashboard_id}.xml").exists())

            searchbase_path = root / "searchbase.conf"
            searchbase_path.write_text(searchbase_fixture(), encoding="utf-8")
            check_output = root / "check-only"
            return_code = main(
                [
                    "--config",
                    str(json_config),
                    "--searchbase",
                    str(searchbase_path),
                    "--output-dir",
                    str(check_output),
                    "--view",
                    self.dashboard_id,
                    "--check",
                ]
            )
            self.assertEqual(return_code, 0)
            self.assertFalse(check_output.exists())


if __name__ == "__main__":
    unittest.main()
