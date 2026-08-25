"""Validated custom REST persistence for shared Insights workspaces.

The browser reads merged configuration through Splunk's generic conf endpoints,
but all shared mutations use these capability-protected handlers. This lets a
custom role manage workspaces and topology without receiving the broad
``admin_all_objects`` capability or write access to factory ``searchbase.conf``.
"""

from __future__ import absolute_import

import json
import re
import urllib.parse
from datetime import datetime, timezone

import splunk.rest as rest
from splunk.persistconn.application import PersistentServerConnectionApplication


WORKSPACE_CONF = "insights_workspaces"
TOPOLOGY_CONF = "customer_topology"
APP_NAME = "splunk-cisco-dashboards"
MAX_SCALAR_BYTES = 4096
MAX_LIST_BYTES = 64 * 1024
MAX_TOPOLOGY_PAYLOAD_BYTES = 128 * 1024

_WORKSPACE_FIELDS = frozenset(
    (
        "label",
        "source_workspace",
        "sections",
        "default_visible_sections",
        "max_visible_sections",
        "min_tile_count",
        "max_tile_count",
        "default_tile_count",
        "header_title",
        "header_subtitle",
        "default_logo_src",
        "hide_default_logo",
        "legacy_view_names",
        "is_builtin",
        "enabled",
        "sort_order",
        "map_visible",
        "map_position",
        "regional_view",
        "updated_at",
        "updated_by",
    )
)
_LAYOUT_FIELDS = frozenset(
    ("tiles", "searchbase_additions", "visible_count", "updated_at", "updated_by")
)
_SIGNAL_ITEM_FIELDS = frozenset(
    (
        "search_name",
        "label",
        "value_field",
        "threshold_warning",
        "threshold_critical",
        "threshold_direction",
        "threshold_unit",
        "updated_at",
        "updated_by",
    )
)
_SIGNAL_RAIL_FIELDS = frozenset(
    (
        "enabled",
        "show_priority_drilldown",
        "rows",
        "speed",
        "density",
        "font_size",
        "items",
        "updated_at",
        "updated_by",
    )
)
_TOPOLOGY_FIELDS = frozenset(
    (
        "schema_version",
        "title",
        "description",
        "updated_at",
        "updated_by",
        "site_count",
        "link_count",
        "section_titles",
        "payload_json",
    )
)

_STANZA_RULES = {
    WORKSPACE_CONF: (
        (re.compile(r"^workspace\.[a-z][a-z0-9_]{0,63}$"), _WORKSPACE_FIELDS),
        (
            re.compile(r"^layout\.[a-z][a-z0-9_]{0,63}\.[a-z][a-z0-9_]{0,63}$"),
            _LAYOUT_FIELDS,
        ),
        (re.compile(r"^signal_item\.[a-z][a-z0-9_]{0,127}$"), _SIGNAL_ITEM_FIELDS),
        (re.compile(r"^signal_rail\.[a-z][a-z0-9_]{0,63}$"), _SIGNAL_RAIL_FIELDS),
    ),
    TOPOLOGY_CONF: (
        (
            re.compile(r"^overview_customer_connectivity(?:_[a-z0-9_]{1,72})?$"),
            _TOPOLOGY_FIELDS,
        ),
    ),
}

_LONG_FIELDS = frozenset(
    ("tiles", "searchbase_additions", "sections", "default_visible_sections", "items")
)
_JSON_FIELDS = frozenset(("section_titles", "payload_json"))
_CONTROL_FIELDS = frozenset(("output_mode",))


def allowed_fields(conf_name):
    """Return the union of fields supported by a configuration endpoint."""
    return frozenset(
        field
        for _pattern, fields in _STANZA_RULES.get(conf_name, ())
        for field in fields
    ) | _CONTROL_FIELDS


def fields_for_stanza(conf_name, stanza_name):
    """Resolve a stanza to its exact writable schema or reject it."""
    if not isinstance(stanza_name, str):
        raise ValueError("A valid configuration stanza name is required.")
    for pattern, fields in _STANZA_RULES.get(conf_name, ()):
        if pattern.fullmatch(stanza_name):
            return fields
    raise ValueError('Stanza "{}" is not writable through this endpoint.'.format(stanza_name))


def validate_settings(conf_name, stanza_name, raw_settings):
    """Collapse form values and enforce field, size, and JSON boundaries."""
    permitted = fields_for_stanza(conf_name, stanza_name)
    settings = {}
    for key, raw in raw_settings.items():
        if key in _CONTROL_FIELDS:
            continue
        if key not in permitted:
            raise ValueError('Field "{}" is not valid for stanza "{}".'.format(key, stanza_name))
        value = raw[-1] if isinstance(raw, list) and raw else raw
        if value is None:
            value = ""
        if not isinstance(value, str):
            value = str(value)
        encoded_size = len(value.encode("utf-8"))
        limit = (
            MAX_TOPOLOGY_PAYLOAD_BYTES
            if key == "payload_json"
            else MAX_LIST_BYTES
            if key in _LONG_FIELDS
            else MAX_SCALAR_BYTES
        )
        if encoded_size > limit:
            raise ValueError('Field "{}" exceeds its {}-byte limit.'.format(key, limit))
        if key in _JSON_FIELDS and value:
            try:
                parsed = json.loads(value)
            except (TypeError, ValueError):
                raise ValueError('Field "{}" must contain valid JSON.'.format(key))
            if not isinstance(parsed, dict):
                raise ValueError('Field "{}" must contain a JSON object.'.format(key))
        settings[key] = value
    return settings


_ENDPOINTS = {
    "scd_insights_workspaces": WORKSPACE_CONF,
    "scd_customer_topology": TOPOLOGY_CONF,
}


def _json_payload(raw):
    if not raw:
        return {}
    if isinstance(raw, bytes):
        raw = raw.decode("utf-8")
    return json.loads(raw)


def _form_payload(request):
    raw = request.get("payload", "")
    if isinstance(raw, bytes):
        raw = raw.decode("utf-8")
    return urllib.parse.parse_qs(raw, keep_blank_values=True)


def _route(request):
    rest_path = request.get("rest_path", "")
    for endpoint, conf_name in _ENDPOINTS.items():
        marker = "/{}".format(endpoint)
        marker_index = rest_path.find(marker)
        if marker_index < 0:
            continue
        suffix = rest_path[marker_index + len(marker) :].strip("/")
        stanza_name = urllib.parse.unquote(suffix) if suffix else None
        return endpoint, conf_name, stanza_name
    raise ValueError("Unknown workspace configuration endpoint.")


def _response_payload(content):
    if not content:
        return {}
    if isinstance(content, bytes):
        content = content.decode("utf-8", errors="replace")
    try:
        return json.loads(content)
    except (TypeError, ValueError):
        return {"message": str(content)[:1000]}


class WorkspaceMutationHandler(PersistentServerConnectionApplication):
    """Capability-gated proxy to app-local conf persistence.

    ``passSystemAuth`` supplies the system token only after splunkd has checked
    ``scd_manage_insights_workspaces``. The handler validates the exact stanza
    and field surface, then uses that token for the generic conf write so a
    narrow custom role does not need the raw conf object's write ACL.
    """

    def __init__(self, _command_line, _command_arg):
        PersistentServerConnectionApplication.__init__(self)

    def _proxy(self, request, conf_name, stanza_name, method, settings=None):
        system_token = request.get("system_authtoken")
        if not system_token:
            return {"status": 500, "payload": {"error": "System authorization is unavailable."}}
        path = "/servicesNS/nobody/{}/configs/conf-{}".format(APP_NAME, conf_name)
        if stanza_name:
            path = "{}/{}".format(path, urllib.parse.quote(stanza_name, safe=""))
        response, content = rest.simpleRequest(
            path,
            sessionKey=system_token,
            method=method,
            postargs=settings,
            getargs={"output_mode": "json"},
            raiseAllErrors=False,
        )
        return {
            "status": int(response.status),
            "payload": _response_payload(content),
        }

    def handle(self, in_string):
        try:
            request = _json_payload(in_string)
            _endpoint, conf_name, stanza_name = _route(request)
            method = str(request.get("method", "")).upper()
            if method == "GET":
                return self._proxy(request, conf_name, stanza_name, "GET")
            if method == "POST":
                is_create = stanza_name is None
                raw_settings = _form_payload(request)
                if stanza_name is None:
                    name_values = raw_settings.pop("name", [])
                    stanza_name = name_values[-1] if name_values else None
                settings = validate_settings(conf_name, stanza_name, raw_settings)
                settings["updated_at"] = datetime.now(timezone.utc).isoformat().replace(
                    "+00:00", "Z"
                )
                session = request.get("session", {})
                settings["updated_by"] = str(session.get("user") or "unknown")
                if "name" in settings:
                    settings.pop("name")
                if not is_create:
                    return self._proxy(
                        request, conf_name, stanza_name, "POST", settings
                    )
                create_settings = {"name": stanza_name}
                create_settings.update(settings)
                return self._proxy(
                    request, conf_name, None, "POST", create_settings
                )
            if method == "DELETE":
                fields_for_stanza(conf_name, stanza_name)
                return self._proxy(request, conf_name, stanza_name, "DELETE")
            return {"status": 405, "payload": {"error": "Method not allowed."}}
        except ValueError as error:
            return {"status": 400, "payload": {"error": str(error)}}
        except Exception:
            return {
                "status": 500,
                "payload": {"error": "Workspace configuration persistence failed."},
            }
