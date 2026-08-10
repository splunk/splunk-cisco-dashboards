import json
import re
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import quote


ROOT = Path(__file__).resolve().parents[1]
APP_ROOT = ROOT / "packages" / "splunk-cisco-dashboards" / "src" / "main" / "resources" / "splunk"
VIEWS = APP_ROOT / "default" / "data" / "ui" / "views"
SEARCHBASE = APP_ROOT / "default" / "searchbase.conf"
STORY_CONFIG = ROOT / "scripts" / "secure_networking_story_dashboards.json"
WORKSPACE = VIEWS / "workspace_insights.xml"
TOPOLOGY_CANVAS = VIEWS / "sn_topology_canvas.xml"

CARD_COUNT = 6
CARD_X = (20, 493, 966)
CARD_Y = (128, 624)
CARD_WIDTH = 453
CARD_HEIGHT = 476
GRAPH_TYPES = {"splunk.area", "splunk.bar", "splunk.column", "splunk.pie"}
LEGACY_TABLE_SEARCHES = {
    "executive_dashboard_data_source_status",
    "executive_dashboard_ds_device_health_current_drilldown",
    "monitoring_sdwan_site_health_table",
    "network_nvm_endpoint_os_inventory",
    "overview_link_auburndale_tallahassee_health",
    "overview_link_state_drilldown",
    "overview_topology_overview",
    "secure_networking_excessive_mac_per_port",
    "secure_networking_hmf_enforcement_coverage_by_site",
    "secure_networking_infra_duo_application_access",
    "secure_networking_infra_duo_blocked_posture_identity",
    "secure_networking_infra_secure_endpoint_incidents",
    "secure_networking_ip_sgt_bindings_by_group",
    "secure_networking_ise_policy_family_overview",
    "secure_networking_ise_policy_hits_by_device",
    "secure_networking_meraki_rogue_ap_containment",
    "secure_networking_meraki_ssid_encryption_breakdown",
    "secure_networking_ot_iot_device_visibility",
    "secure_networking_psirt_exposure_by_site_family",
    "secure_networking_router_segmentation_feature_evidence",
    "secure_networking_sdwan_tunnel_health_log",
    "secure_networking_secure_access_dlp_findings",
    "secure_networking_secure_infra_status_rollup",
    "secure_networking_segmentation_secure_workload_alerts_by_type",
    "secure_networking_segmentation_status_rollup",
    "secure_networking_sgt_binding_inventory",
    "secure_networking_sgt_by_site",
    "secure_networking_sgt_distribution_by_site_device",
    "secure_networking_zta_duo_admin_activity_by_outcome",
    "secure_networking_zta_duo_auth_outcomes_by_application",
    "secure_networking_zta_ise_auth_by_device_fail_rate",
    "secure_networking_zta_radius_node_health_by_site",
    "secure_networking_zta_ravpn_connection_rate",
    "secure_networking_zta_ravpn_failure_reasons",
    "secure_networking_zta_ravpn_posture_alerts",
    "secure_networking_zta_ravpn_sessions_by_profile",
    "secure_networking_zta_user_activity_cross_source",
    "secure_networking_zta_ztna_app_access_summary",
    "secure_networking_zta_ztna_blocked_access_reasons",
    "security_isovalent_top_alert_rules",
    "security_multicloud_defense_gateway_health_table",
    "security_multicloud_defense_waf_findings",
    "xdr_aa_forensic_files_network_source_hotspots",
    "xdr_aa_forensic_network_external_egress_watch",
    "xdr_aa_forensic_network_internal_service_pressure",
    "xdr_incident_global_risk_leaderboard",
    "xdr_incident_status_severity_pressure",
}


def _searchbase_properties(text):
    properties = {}
    for match in re.finditer(
        r"^\[([^\]]+)\]\s*$([\s\S]*?)(?=^\[|\Z)", text, re.MULTILINE
    ):
        stanza, body = match.groups()
        values = {}
        for line in body.splitlines():
            property_match = re.match(r"^([A-Za-z][A-Za-z0-9_]*)\s*=\s*(.*)$", line)
            if property_match:
                values[property_match.group(1)] = property_match.group(2).strip()
        properties[stanza] = values
    return properties


def _expected_drilldown_url(origin, target_names):
    targets = ",".join(quote(name, safe="") for name in target_names)
    return f"/drilldown?origin={quote(origin, safe='')}&target={targets}"


def _without_markdown_escapes(value):
    return value.replace("\\", "")


class SecureNetworkingPillarDashboardTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.stories = json.loads(STORY_CONFIG.read_text(encoding="utf-8"))
        cls.searchbase_text = SEARCHBASE.read_text(encoding="utf-8")
        cls.searchbase = _searchbase_properties(cls.searchbase_text)
        cls.studio_paths = sorted(
            path
            for path in VIEWS.glob("sn_*.xml")
            if path.name != TOPOLOGY_CANVAS.name
        )

    def test_story_config_is_authoritative_for_all_sixteen_studio_dashboards(self):
        self.assertEqual(len(self.studio_paths), 16)
        self.assertEqual(
            set(self.stories),
            {path.stem for path in self.studio_paths},
        )

        for dashboard_id, story in self.stories.items():
            with self.subTest(dashboard_id=dashboard_id):
                self.assertEqual(len(story["cards"]), CARD_COUNT)
                self.assertEqual(
                    len({card["primary"] for card in story["cards"]}),
                    CARD_COUNT,
                )
                for card in story["cards"]:
                    self.assertIn(card["primary"], self.searchbase)
                    self.assertTrue(card["targets"])
                    for target in card["targets"]:
                        self.assertIn(target, self.searchbase)
                        self.assertTrue(self.searchbase[target].get("search_name"))

    def test_every_legacy_table_search_is_preserved_as_detail_or_promoted(self):
        primaries = {
            card["primary"]
            for story in self.stories.values()
            for card in story["cards"]
        }
        targets = {
            target
            for story in self.stories.values()
            for card in story["cards"]
            for target in card["targets"]
        }

        self.assertEqual(len(LEGACY_TABLE_SEARCHES), 47)
        self.assertEqual(
            LEGACY_TABLE_SEARCHES - targets,
            {"secure_networking_zta_ravpn_connection_rate"},
        )
        self.assertIn("secure_networking_zta_ravpn_connection_rate", primaries)
        self.assertLessEqual(LEGACY_TABLE_SEARCHES, primaries | targets)

    def test_five_pillar_studio_stories_do_not_dispatch_feed_monitors(self):
        for dashboard_id, story in self.stories.items():
            with self.subTest(dashboard_id=dashboard_id):
                refs = [
                    ref
                    for card in story["cards"]
                    for ref in (card["primary"], *card["targets"])
                ]
                self.assertFalse(
                    any(ref.startswith("feed_monitor_") for ref in refs),
                    f"{dashboard_id} must not use feed freshness searches",
                )

    def test_each_dashboard_has_exact_six_card_story_contract(self):
        for dashboard_id, story in self.stories.items():
            with self.subTest(dashboard_id=dashboard_id):
                root = ET.parse(VIEWS / f"{dashboard_id}.xml").getroot()
                definition = json.loads(root.findtext("definition"))

                self.assertEqual(root.attrib.get("version"), "2")
                self.assertEqual(root.attrib.get("theme"), "dark")
                self.assertEqual(root.findtext("label"), story["label"])
                self.assertEqual(root.findtext("description"), story["description"])
                self.assertEqual(definition["title"], story["label"])
                self.assertEqual(definition["description"], story["description"])

                data_sources = definition["dataSources"]
                expected_data_source_ids = [
                    f"ds_story_{index:02d}" for index in range(1, CARD_COUNT + 1)
                ]
                self.assertEqual(list(data_sources), expected_data_source_ids)
                self.assertEqual(len(data_sources), CARD_COUNT)

                for index, card in enumerate(story["cards"], start=1):
                    data_source_id = f"ds_story_{index:02d}"
                    source = data_sources[data_source_id]
                    primary = card["primary"]
                    metadata = self.searchbase[primary]
                    self.assertEqual(source["type"], "ds.searchbase")
                    self.assertEqual(source["options"]["ref"], primary)
                    self.assertEqual(source["name"], metadata["search_name"])
                    self.assertEqual(
                        source["options"]["queryParameters"],
                        {
                            "earliest": "$time_tok.earliest$",
                            "latest": "$time_tok.latest$",
                        },
                    )

                visualizations = definition["visualizations"]
                singles = {
                    visualization_id: visualization
                    for visualization_id, visualization in visualizations.items()
                    if visualization.get("type") == "splunk.singlevalue"
                }
                graphs = {
                    visualization_id: visualization
                    for visualization_id, visualization in visualizations.items()
                    if visualization.get("type") in GRAPH_TYPES
                }
                triggers = {
                    visualization_id: visualization
                    for visualization_id, visualization in visualizations.items()
                    if visualization_id.endswith("_drilldown_trigger")
                }

                self.assertEqual(len(singles), CARD_COUNT)
                self.assertEqual(len(graphs), CARD_COUNT)
                self.assertEqual(len(triggers), CARD_COUNT)
                self.assertNotIn(
                    "splunk.table",
                    {visualization.get("type") for visualization in visualizations.values()},
                )

                for index in range(1, CARD_COUNT + 1):
                    data_source_id = f"ds_story_{index:02d}"
                    single_id = f"viz_card_{index:02d}_singlevalue"
                    graph_id = f"viz_card_{index:02d}_trend"
                    self.assertEqual(
                        singles[single_id]["dataSources"], {"primary": data_source_id}
                    )
                    self.assertEqual(
                        graphs[graph_id]["dataSources"], {"primary": data_source_id}
                    )

                bound_consumers = {
                    data_source_id: {
                        visualization_id
                        for visualization_id, visualization in visualizations.items()
                        if visualization.get("dataSources", {}).get("primary")
                        == data_source_id
                    }
                    for data_source_id in data_sources
                }
                for index, data_source_id in enumerate(expected_data_source_ids, start=1):
                    self.assertEqual(
                        bound_consumers[data_source_id],
                        {
                            f"viz_card_{index:02d}_singlevalue",
                            f"viz_card_{index:02d}_trend",
                        },
                    )

    def test_drilldown_triggers_preserve_config_order_and_searchbase_display_names(self):
        for dashboard_id, story in self.stories.items():
            with self.subTest(dashboard_id=dashboard_id):
                definition = json.loads(
                    ET.parse(VIEWS / f"{dashboard_id}.xml")
                    .getroot()
                    .findtext("definition")
                )
                visualizations = definition["visualizations"]
                structure = definition["layout"]["layoutDefinitions"]["layout_overview"][
                    "structure"
                ]
                expected_trigger_ids = [
                    f"viz_card_{index:02d}_drilldown_trigger"
                    for index in range(1, CARD_COUNT + 1)
                ]
                ordered_trigger_ids = [
                    entry["item"]
                    for entry in structure
                    if entry["item"].endswith("_drilldown_trigger")
                ]
                self.assertEqual(ordered_trigger_ids, expected_trigger_ids)

                for index, card in enumerate(story["cards"], start=1):
                    trigger = visualizations[
                        f"viz_card_{index:02d}_drilldown_trigger"
                    ]
                    target_names = [
                        self.searchbase[target]["search_name"]
                        for target in card["targets"]
                    ]
                    self.assertEqual(trigger["type"], "splunk.rectangle")
                    self.assertEqual(
                        trigger["eventHandlers"],
                        [
                            {
                                "type": "drilldown.customUrl",
                                "options": {
                                    "url": _expected_drilldown_url(
                                        card["title"], target_names
                                    )
                                },
                            }
                        ],
                    )
                    self.assertEqual(
                        trigger["options"],
                        {"fillColor": "transparent", "strokeColor": "transparent"},
                    )

    def test_dark_three_by_two_geometry_and_searchbase_metadata_badges(self):
        expected_card_positions = [
            (CARD_X[column], CARD_Y[row])
            for row in range(2)
            for column in range(3)
        ]

        for dashboard_id, story in self.stories.items():
            with self.subTest(dashboard_id=dashboard_id):
                definition = json.loads(
                    ET.parse(VIEWS / f"{dashboard_id}.xml")
                    .getroot()
                    .findtext("definition")
                )
                visualizations = definition["visualizations"]
                layout = definition["layout"]["layoutDefinitions"]["layout_overview"]
                entries = {entry["item"]: entry for entry in layout["structure"]}

                self.assertEqual(
                    layout["options"],
                    {
                        "backgroundColor": "#020617",
                        "display": "auto-scale",
                        "height": 1128,
                        "width": 1440,
                    },
                )
                self.assertEqual(
                    entries["viz_header_bg"]["position"],
                    {"x": 20, "y": 0, "w": 1400, "h": 104},
                )
                self.assertEqual(
                    visualizations["viz_header_bg"]["options"]["fillColor"],
                    "#1e293b",
                )

                for index, ((x, y), card) in enumerate(
                    zip(expected_card_positions, story["cards"]), start=1
                ):
                    prefix = f"viz_card_{index:02d}"
                    self.assertEqual(
                        entries[f"{prefix}_background"]["position"],
                        {"x": x, "y": y, "w": CARD_WIDTH, "h": CARD_HEIGHT},
                    )
                    self.assertEqual(
                        visualizations[f"{prefix}_background"]["options"],
                        {
                            "fillColor": "#0f172a",
                            "strokeColor": "rgba(14,165,233,0.42)",
                            "rx": 12,
                        },
                    )
                    self.assertEqual(
                        entries[f"{prefix}_title"]["position"],
                        {"x": x + 16, "y": y + 12, "w": CARD_WIDTH - 76, "h": 34},
                    )
                    self.assertEqual(
                        entries[f"{prefix}_metadata"]["position"],
                        {"x": x + 16, "y": y + 48, "w": CARD_WIDTH - 32, "h": 24},
                    )
                    self.assertEqual(
                        entries[f"{prefix}_description"]["position"],
                        {"x": x + 16, "y": y + 76, "w": CARD_WIDTH - 32, "h": 68},
                    )
                    self.assertEqual(
                        entries[f"{prefix}_singlevalue"]["position"],
                        {
                            "x": x + 16,
                            "y": y + 156,
                            "w": CARD_WIDTH - 32,
                            "h": 88,
                        },
                    )
                    self.assertEqual(
                        entries[f"{prefix}_trend"]["position"],
                        {
                            "x": x + 16,
                            "y": y + 248,
                            "w": CARD_WIDTH - 32,
                            "h": 212,
                        },
                    )
                    self.assertEqual(
                        entries[f"{prefix}_drilldown_trigger"]["position"],
                        {"x": x + CARD_WIDTH - 55, "y": y + 6, "w": 42, "h": 42},
                    )

                    primary_metadata = self.searchbase[card["primary"]]
                    metadata_options = visualizations[f"{prefix}_metadata"]["options"]
                    self.assertEqual(metadata_options["fontColor"], "#7dd3fc")
                    self.assertEqual(metadata_options["customFontSize"], 11)
                    self.assertEqual(
                        _without_markdown_escapes(metadata_options["markdown"]),
                        (
                            f"{primary_metadata['category']}  •  "
                            f"{primary_metadata['sub_category']}"
                        ),
                    )
                    self.assertTrue(
                        visualizations[f"{prefix}_description"]["options"]["markdown"]
                    )

    def test_time_token_contract_is_preserved(self):
        for dashboard_id, story in self.stories.items():
            with self.subTest(dashboard_id=dashboard_id):
                definition = json.loads(
                    ET.parse(VIEWS / f"{dashboard_id}.xml")
                    .getroot()
                    .findtext("definition")
                )
                self.assertEqual(
                    definition["inputs"]["input_time_range"]["options"],
                    {"defaultValue": "-24h@h,now", "token": "time_tok"},
                )
                self.assertEqual(definition["layout"]["globalInputs"], ["input_time_range"])
                self.assertEqual(
                    definition["layout"]["tabs"]["items"],
                    [{"label": "overview", "layoutId": "layout_overview"}],
                )

    def test_secure_networking_workspace_remains_classic_v11(self):
        root = ET.parse(WORKSPACE).getroot()
        self.assertEqual(root.tag, "dashboard")
        self.assertEqual(root.attrib.get("version"), "1.1")
        self.assertEqual(root.attrib.get("theme"), "dark")
        self.assertIsNone(root.find("definition"))
        self.assertNotIn("workspace_insights", self.stories)


if __name__ == "__main__":
    unittest.main()
