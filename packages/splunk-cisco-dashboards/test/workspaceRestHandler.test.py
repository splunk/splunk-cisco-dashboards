"""Unit scenarios for the capability-protected workspace REST validator."""

import importlib.util
import json
import pathlib
import sys
import types
import urllib.parse
import unittest

# Importing the handler directly from src/main/resources must not create a
# release-input __pycache__ directory during local validation.
sys.dont_write_bytecode = True


class _PersistentServerConnectionApplication:
    def __init__(self):
        pass


fake_splunk = types.ModuleType("splunk")
fake_rest = types.ModuleType("splunk.rest")
fake_rest.calls = []
fake_rest.response_status = 201
fake_rest.response_content = b'{"entry": []}'
fake_rest.raise_non_raw_http_errors = False


def _simple_request(path, **kwargs):
    fake_rest.calls.append((path, kwargs))
    if (
        fake_rest.raise_non_raw_http_errors
        and fake_rest.response_status >= 400
        and not kwargs.get("rawResult")
    ):
        raise RuntimeError("ResourceNotFound")
    return (
        types.SimpleNamespace(status=fake_rest.response_status),
        fake_rest.response_content,
    )


fake_rest.simpleRequest = _simple_request
fake_application = types.ModuleType("splunk.persistconn.application")
fake_application.PersistentServerConnectionApplication = (
    _PersistentServerConnectionApplication
)
fake_persistconn = types.ModuleType("splunk.persistconn")
fake_persistconn.application = fake_application
fake_splunk.rest = fake_rest
fake_splunk.persistconn = fake_persistconn
sys.modules.setdefault("splunk", fake_splunk)
sys.modules.setdefault("splunk.rest", fake_rest)
sys.modules.setdefault("splunk.persistconn", fake_persistconn)
sys.modules.setdefault("splunk.persistconn.application", fake_application)

handler_path = (
    pathlib.Path(__file__).resolve().parents[1]
    / "src/main/resources/splunk/bin/scd_workspace_rest.py"
)
spec = importlib.util.spec_from_file_location("scd_workspace_rest", handler_path)
handler = importlib.util.module_from_spec(spec)
spec.loader.exec_module(handler)


class WorkspaceRestValidationTest(unittest.TestCase):
    def setUp(self):
        fake_rest.calls.clear()
        fake_rest.response_status = 201
        fake_rest.response_content = b'{"entry": []}'
        fake_rest.raise_non_raw_http_errors = False

    def test_accepts_every_supported_stanza_family(self):
        scenarios = (
            (handler.WORKSPACE_CONF, "workspace.delegated_ops", {"label": ["Ops"]}),
            (
                handler.WORKSPACE_CONF,
                "layout.delegated_ops.security",
                {"tiles": ["one,two"], "visible_count": ["2"]},
            ),
            (
                handler.WORKSPACE_CONF,
                "signal_item.blocked_flows",
                {"search_name": ["Blocked flows"], "value_field": ["count"]},
            ),
            (
                handler.WORKSPACE_CONF,
                "signal_rail.delegated_ops",
                {"enabled": ["1"], "items": ["blocked_flows"]},
            ),
            (
                handler.TOPOLOGY_CONF,
                "overview_customer_connectivity_delegated_ops",
                {
                    "section_titles": [json.dumps({"security": "Security"})],
                    "payload_json": [
                        json.dumps(
                            {
                                "version": 1,
                                "topology": {"sites": [], "links": []},
                            }
                        )
                    ],
                },
            ),
            (
                handler.TEMPLATES_CONF,
                "background://bg_1730000000000",
                {"data": ["data:image/png;base64,iVBORw0KGgo="]},
            ),
        )
        for conf_name, stanza, fields in scenarios:
            with self.subTest(stanza=stanza):
                self.assertEqual(
                    handler.validate_settings(conf_name, stanza, fields),
                    {key: value[-1] for key, value in fields.items()},
                )

    def test_ignores_transport_control_fields(self):
        self.assertEqual(
            handler.validate_settings(
                handler.WORKSPACE_CONF,
                "workspace.delegated_ops",
                {"label": ["Ops"], "output_mode": ["json"]},
            ),
            {"label": "Ops"},
        )

    def test_rejects_out_of_scope_or_malformed_stanzas(self):
        for conf_name, stanza in (
            (handler.WORKSPACE_CONF, "searchbase.factory_tile"),
            (handler.WORKSPACE_CONF, "workspace.../../authorize"),
            (handler.WORKSPACE_CONF, "layout.missing_section"),
            (handler.TOPOLOGY_CONF, "other_topology"),
            (handler.TOPOLOGY_CONF, "overview_customer_connectivity-unsafe"),
            (handler.TEMPLATES_CONF, "background://factory_override"),
        ):
            with self.subTest(stanza=stanza), self.assertRaises(ValueError):
                handler.fields_for_stanza(conf_name, stanza)

    def test_rejects_fields_from_a_different_stanza_schema(self):
        with self.assertRaisesRegex(ValueError, "not valid"):
            handler.validate_settings(
                handler.WORKSPACE_CONF,
                "layout.delegated_ops.security",
                {"source_workspace": ["secure_networking"]},
            )
        with self.assertRaisesRegex(ValueError, "not valid"):
            handler.validate_settings(
                handler.TOPOLOGY_CONF,
                "overview_customer_connectivity",
                {"tiles": ["one,two"]},
            )

    def test_rejects_invalid_json_shapes(self):
        for value in ("not-json", "[]", '"scalar"'):
            with self.subTest(value=value), self.assertRaises(ValueError):
                handler.validate_settings(
                    handler.TOPOLOGY_CONF,
                    "overview_customer_connectivity",
                    {"payload_json": [value]},
                )

    def test_enforces_scalar_list_and_payload_size_limits(self):
        scenarios = (
            (
                handler.WORKSPACE_CONF,
                "workspace.delegated_ops",
                "label",
                "x" * (handler.MAX_SCALAR_BYTES + 1),
            ),
            (
                handler.WORKSPACE_CONF,
                "layout.delegated_ops.security",
                "tiles",
                "x" * (handler.MAX_LIST_BYTES + 1),
            ),
            (
                handler.TOPOLOGY_CONF,
                "overview_customer_connectivity",
                "payload_json",
                json.dumps({"value": "x" * handler.MAX_TOPOLOGY_PAYLOAD_BYTES}),
            ),
            (
                handler.TEMPLATES_CONF,
                "background://bg_1730000000000",
                "data",
                "data:image/png;base64,"
                + "a" * handler.MAX_TEMPLATE_BACKGROUND_DATA_BYTES,
            ),
        )
        for conf_name, stanza, field, value in scenarios:
            with self.subTest(field=field), self.assertRaisesRegex(ValueError, "limit"):
                handler.validate_settings(conf_name, stanza, {field: [value]})

    def test_allows_bounded_shared_workspace_logos(self):
        oversized = "data:image/png;base64," + "a" * (handler.MAX_LOGO_BYTES)
        with self.assertRaisesRegex(ValueError, "limit"):
            handler.validate_settings(
                handler.WORKSPACE_CONF,
                "workspace.delegated_ops",
                {"default_logo_src": [oversized]},
            )
        safe_sources = (
            "data:image/svg+xml;utf8,%3Csvg%2F%3E",
            "data:image/png;base64,iVBORw0KGgo=",
            "/static/app/splunk-cisco-dashboards/icn_view.svg",
        )
        for value in safe_sources:
            with self.subTest(value=value):
                self.assertEqual(
                    handler.validate_settings(
                        handler.WORKSPACE_CONF,
                        "workspace.delegated_ops",
                        {"default_logo_src": [value]},
                    ),
                    {"default_logo_src": value},
                )
        for value in (
            "https://example.test/logo.png",
            "//example.test/logo.png",
            "javascript:alert(1)",
            "file:///etc/passwd",
            "data:text/html,<script>alert(1)</script>",
        ):
            with self.subTest(value=value), self.assertRaisesRegex(
                ValueError, "default_logo_src"
            ):
                handler.validate_settings(
                    handler.WORKSPACE_CONF,
                    "workspace.delegated_ops",
                    {"default_logo_src": [value]},
                )

    def test_restricts_template_background_sources(self):
        safe_source = "data:image/png;base64,iVBORw0KGgo="
        self.assertEqual(
            handler.validate_settings(
                handler.TEMPLATES_CONF,
                "background://bg_1730000000000",
                {"data": [safe_source]},
            ),
            {"data": safe_source},
        )
        for value in (
            "https://example.test/background.png",
            "data:image/svg+xml;base64,PHN2Zy8+",
            "data:image/png;base64,aGVsbG8=",
            "data:image/png;base64,not-base64",
        ):
            with self.subTest(value=value), self.assertRaisesRegex(ValueError, "data"):
                handler.validate_settings(
                    handler.TEMPLATES_CONF,
                    "background://bg_1730000000000",
                    {"data": [value]},
                )

    def test_rejects_unbounded_or_malformed_topology_collections(self):
        oversized_sites = {
            "topology": {
                "sites": [{}] * (handler.MAX_TOPOLOGY_SITES + 1),
                "links": [],
            }
        }
        oversized_links = {
            "topology": {
                "sites": [],
                "links": [{}] * (handler.MAX_TOPOLOGY_LINKS + 1),
            }
        }
        oversized_aliases = {
            "topology": {
                "sites": [
                    {"aliases": ["site"] * (handler.MAX_TOPOLOGY_SITE_ALIASES + 1)}
                ],
                "links": [],
            }
        }
        malformed_entries = {
            "topology": {"sites": [None], "links": ["not-an-object"]}
        }
        for payload in (
            oversized_sites,
            oversized_links,
            oversized_aliases,
            malformed_entries,
        ):
            with self.subTest(payload=payload), self.assertRaisesRegex(
                ValueError, "topology"
            ):
                handler.validate_settings(
                    handler.TOPOLOGY_CONF,
                    "overview_customer_connectivity",
                    {"payload_json": [json.dumps(payload)]},
                )

    def test_live_handler_uses_system_token_after_validation(self):
        app = handler.WorkspaceMutationHandler(None, None)
        response = app.handle(
            json.dumps(
                {
                    "method": "POST",
                    "rest_path": "/scd_insights_workspaces",
                    "payload": (
                        "name=workspace.delegated_ops&label=Ops&"
                        "source_workspace=secure_networking&output_mode=json"
                    ),
                    "system_authtoken": "system-token",
                    "session": {"user": "delegated-user", "authtoken": "caller-token"},
                }
            ).encode("utf-8")
        )
        self.assertEqual(response["status"], 201)
        self.assertEqual(len(fake_rest.calls), 1)
        path, kwargs = fake_rest.calls[0]
        self.assertEqual(
            path,
            "/servicesNS/nobody/splunk-cisco-dashboards/configs/conf-insights_workspaces",
        )
        self.assertEqual(kwargs["sessionKey"], "system-token")
        self.assertNotEqual(kwargs["sessionKey"], "caller-token")
        self.assertEqual(kwargs["postargs"]["name"], "workspace.delegated_ops")
        self.assertEqual(kwargs["postargs"]["updated_by"], "delegated-user")
        self.assertNotIn("output_mode", kwargs["postargs"])

    def test_live_handler_preserves_missing_stanza_404_for_create_fallback(self):
        fake_rest.response_status = 404
        fake_rest.response_content = b'{"messages":[{"text":"Not found"}]}'
        fake_rest.raise_non_raw_http_errors = True
        app = handler.WorkspaceMutationHandler(None, None)
        response = app.handle(
            json.dumps(
                {
                    "method": "POST",
                    "rest_path": "/scd_insights_workspaces/workspace.delegated_ops",
                    "payload": "label=Ops&source_workspace=secure_networking",
                    "system_authtoken": "system-token",
                    "session": {"user": "delegated-user"},
                }
            )
        )
        self.assertEqual(response["status"], 404)
        self.assertEqual(len(fake_rest.calls), 1)
        _path, kwargs = fake_rest.calls[0]
        self.assertTrue(kwargs["rawResult"])

    def test_live_handler_rejects_before_system_write(self):
        app = handler.WorkspaceMutationHandler(None, None)
        response = app.handle(
            json.dumps(
                {
                    "method": "POST",
                    "rest_path": "/scd_insights_workspaces/searchbase.forbidden",
                    "payload": "label=Denied",
                    "system_authtoken": "system-token",
                    "session": {"user": "delegated-user"},
                }
            )
        )
        self.assertEqual(response["status"], 400)
        self.assertEqual(fake_rest.calls, [])

    def test_template_background_handler_checks_quota_before_system_write(self):
        safe_data = "data:image/png;base64,iVBORw0KGgo="
        fake_rest.response_content = json.dumps(
            {
                "entry": [
                    {
                        "name": "background://bg_{}".format(index),
                        "content": {"data": safe_data},
                    }
                    for index in range(handler.MAX_TEMPLATE_BACKGROUND_ENTRIES)
                ]
            }
        ).encode("utf-8")
        app = handler.WorkspaceMutationHandler(None, None)
        response = app.handle(
            json.dumps(
                {
                    "method": "POST",
                    "rest_path": "/scd_dashboard_backgrounds",
                    "payload": urllib.parse.urlencode(
                        {
                            "name": "background://bg_1730000000000",
                            "data": safe_data,
                        }
                    ),
                    "system_authtoken": "system-token",
                    "session": {"user": "delegated-user"},
                }
            )
        )
        self.assertEqual(response["status"], 400)
        self.assertIn("entry limit", response["payload"]["error"])
        self.assertEqual(len(fake_rest.calls), 1)
        self.assertEqual(fake_rest.calls[0][1]["method"], "GET")
        self.assertEqual(fake_rest.calls[0][1]["getargs"]["count"], "0")

    def test_template_background_handler_uses_system_token_after_validation(self):
        safe_data = "data:image/png;base64,iVBORw0KGgo="
        app = handler.WorkspaceMutationHandler(None, None)
        response = app.handle(
            json.dumps(
                {
                    "method": "POST",
                    "rest_path": "/scd_dashboard_backgrounds",
                    "payload": urllib.parse.urlencode(
                        {
                            "name": "background://bg_1730000000000",
                            "data": safe_data,
                        }
                    ),
                    "system_authtoken": "system-token",
                    "session": {"user": "delegated-user", "authtoken": "caller-token"},
                }
            )
        )
        self.assertEqual(response["status"], 201)
        self.assertEqual(len(fake_rest.calls), 2)
        _list_path, list_kwargs = fake_rest.calls[0]
        write_path, write_kwargs = fake_rest.calls[1]
        self.assertEqual(list_kwargs["method"], "GET")
        self.assertEqual(
            write_path,
            "/servicesNS/nobody/splunk-cisco-dashboards/configs/conf-templates",
        )
        self.assertEqual(write_kwargs["sessionKey"], "system-token")
        self.assertNotEqual(write_kwargs["sessionKey"], "caller-token")
        self.assertEqual(
            write_kwargs["postargs"]["name"], "background://bg_1730000000000"
        )


if __name__ == "__main__":
    unittest.main()
