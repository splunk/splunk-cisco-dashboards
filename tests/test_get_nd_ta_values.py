from __future__ import annotations

import importlib.util
from pathlib import Path
import sys
import unittest


SCRIPT_PATH = Path(__file__).resolve().parents[1] / "scripts" / "get_nd_ta_values.py"
SPEC = importlib.util.spec_from_file_location("get_nd_ta_values", SCRIPT_PATH)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


class GetNdTaValuesTests(unittest.TestCase):
    def test_parse_endpoint_accepts_host_and_https_url(self) -> None:
        self.assertEqual(
            MODULE.parse_endpoint("nd.example.test"),
            MODULE.Endpoint("nd.example.test", 443),
        )
        self.assertEqual(
            MODULE.parse_endpoint("https://10.0.0.10:8443/"),
            MODULE.Endpoint("10.0.0.10", 8443),
        )

    def test_parse_endpoint_rejects_page_path(self) -> None:
        with self.assertRaisesRegex(ValueError, "dashboard page path"):
            MODULE.parse_endpoint("https://nd.example.test/manage")

    def test_extract_inventory(self) -> None:
        fabrics = MODULE.extract_fabrics(
            {"fabrics": [{"name": "fabric-b"}, {"fabricName": "fabric-a"}]}
        )
        nodes = MODULE.extract_nodes(
            {
                "switches": [
                    {"fabricName": "fabric-a", "nodeName": "leaf-1"},
                    {"siteName": "fabric-a", "hostname": "leaf-2"},
                ]
            }
        )
        self.assertEqual(fabrics, ["fabric-a", "fabric-b"])
        self.assertEqual(nodes, {"fabric-a": {"leaf-1", "leaf-2"}})

    def test_extract_interface_pairs_inherits_nested_node_context(self) -> None:
        payload = {
            "entries": [
                {
                    "siteName": "fabric-a",
                    "nodeName": "leaf-1",
                    "entries": [
                        {"interfaceName": "eth1/1"},
                        {"interfaceName": "eth1/2"},
                    ],
                }
            ]
        }
        self.assertEqual(
            MODULE.extract_interface_pairs(payload, "fabric-a"),
            {
                ("fabric-a", "leaf-1", "eth1/1"),
                ("fabric-a", "leaf-1", "eth1/2"),
            },
        )

    def test_nested_generic_name_does_not_replace_fabric_context(self) -> None:
        payload = {
            "entries": [
                {
                    "siteName": "fabric-a",
                    "nodeName": "leaf-1",
                    "entries": [{"name": "counter-name", "interfaceName": "eth1/1"}],
                }
            ]
        }
        self.assertEqual(
            MODULE.extract_interface_pairs(payload, "fabric-a"),
            {("fabric-a", "leaf-1", "eth1/1")},
        )

    def test_serialized_output_never_contains_a_secret(self) -> None:
        discovery = MODULE.Discovery(
            fabrics=["fabric-a"],
            nodes={"fabric-a": {"leaf-1"}},
            interfaces={("fabric-a", "leaf-1", "eth1/1")},
            warnings=[],
        )
        result = MODULE.as_serializable(
            discovery,
            MODULE.Endpoint("nd.example.test", 443),
            "svc-splunk",
            "local",
        )
        self.assertEqual(result["account"]["password"], "PROMPTED_NOT_PRINTED")
        self.assertIsNone(result["account"]["login_domain"])
        self.assertNotIn("token", result["account"])

    def test_interface_discovery_paginates_without_repeating_data(self) -> None:
        class FakeClient:
            def __init__(self) -> None:
                self.offsets: list[int] = []
                self.calls: list[dict[str, object]] = []

            def get(self, _path: str, params: dict[str, object]) -> dict[str, object]:
                self.calls.append(dict(params))
                offset = int(params["offset"])
                self.offsets.append(offset)
                entries = {
                    0: [
                        {"nodeName": "leaf-1", "interfaceName": "eth1/1"},
                        {"nodeName": "leaf-1", "interfaceName": "eth1/2"},
                    ],
                    2: [{"nodeName": "leaf-2", "interfaceName": "eth1/1"}],
                }[offset]
                return {"entries": entries, "totalResultsCount": 3}

        client = FakeClient()
        pairs = MODULE._discover_interfaces_from_endpoint(
            client,
            "/test",
            {"count": 2, "startDate": "now-1h", "endDate": "now"},
            "fabric-a",
        )

        self.assertEqual(client.offsets, [0, 2])
        self.assertEqual(
            pairs,
            {
                ("fabric-a", "leaf-1", "eth1/1"),
                ("fabric-a", "leaf-1", "eth1/2"),
                ("fabric-a", "leaf-2", "eth1/1"),
            },
        )
        self.assertRegex(str(client.calls[0]["startDate"]), r"Z$")
        self.assertRegex(str(client.calls[0]["endDate"]), r"Z$")


if __name__ == "__main__":
    unittest.main()
