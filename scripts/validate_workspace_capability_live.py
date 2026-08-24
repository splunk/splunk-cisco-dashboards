#!/usr/bin/env python3
"""Exercise delegated Insights workspace authorization against live Splunk.

The harness creates uniquely named temporary roles, users, workspace stanzas,
and topology stanzas, then removes every object in a ``finally`` block. It never
restarts Splunk and never prints credentials.
"""

from __future__ import annotations

import base64
import json
import os
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid


APP = "splunk-cisco-dashboards"
CAPABILITY = "scd_manage_insights_workspaces"


class LiveValidationError(RuntimeError):
    pass


def env_required(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise LiveValidationError(f"{name} is required")
    return value


def request(
    base_url: str,
    auth: tuple[str, str],
    path: str,
    method: str = "GET",
    fields: dict[str, str | list[str]] | None = None,
    verify_ssl: bool = True,
) -> tuple[int, object]:
    data = None
    if fields is not None:
        data = urllib.parse.urlencode(fields, doseq=True).encode("utf-8")
    token = base64.b64encode(f"{auth[0]}:{auth[1]}".encode("utf-8")).decode("ascii")
    req = urllib.request.Request(
        f"{base_url.rstrip('/')}{path}",
        data=data,
        method=method,
        headers={
            "Authorization": f"Basic {token}",
            "Accept": "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
        },
    )
    context = None if verify_ssl else ssl._create_unverified_context()
    try:
        with urllib.request.urlopen(req, context=context, timeout=30) as response:
            raw = response.read().decode("utf-8", errors="replace")
            return response.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as error:
        raw = error.read().decode("utf-8", errors="replace")
        try:
            body: object = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            body = {"raw": raw[:500]}
        return error.code, body


def expect(status: int, allowed: tuple[int, ...], scenario: str) -> None:
    if status not in allowed:
        raise LiveValidationError(
            f"{scenario}: expected HTTP {allowed}, received HTTP {status}"
        )


def quoted(value: str) -> str:
    return urllib.parse.quote(value, safe="")


def current_capabilities(
    base_url: str, auth: tuple[str, str], verify_ssl: bool
) -> set[str]:
    status, body = request(
        base_url,
        auth,
        "/services/authentication/current-context?output_mode=json",
        verify_ssl=verify_ssl,
    )
    expect(status, (200,), "read current user capabilities")
    entries = body.get("entry", []) if isinstance(body, dict) else []
    content = entries[0].get("content", {}) if entries else {}
    return set(content.get("capabilities", []))


def create_role(
    base_url: str,
    admin_auth: tuple[str, str],
    role: str,
    verify_ssl: bool,
    capability: str | None = None,
) -> None:
    fields: dict[str, str | list[str]] = {
        "name": role,
        "imported_roles": "user",
    }
    if capability:
        fields["capabilities"] = capability
    status, _body = request(
        base_url,
        admin_auth,
        "/services/authorization/roles?output_mode=json",
        "POST",
        fields,
        verify_ssl,
    )
    expect(status, (200, 201), f"create temporary role {role}")


def create_user(
    base_url: str,
    admin_auth: tuple[str, str],
    username: str,
    password: str,
    role: str,
    verify_ssl: bool,
) -> None:
    status, _body = request(
        base_url,
        admin_auth,
        "/services/authentication/users?output_mode=json",
        "POST",
        {
            "name": username,
            "password": password,
            "roles": role,
            "force-change-pass": "0",
        },
        verify_ssl,
    )
    expect(status, (200, 201), f"create temporary user {username}")


def workspace_fields(label: str) -> dict[str, str]:
    return {
        "label": label,
        "source_workspace": "secure_networking",
        "sections": "zta",
        "default_visible_sections": "zta",
        "max_visible_sections": "1",
        "min_tile_count": "1",
        "max_tile_count": "9",
        "default_tile_count": "3",
        "hide_default_logo": "1",
        "is_builtin": "0",
        "enabled": "1",
        "sort_order": "999",
        "map_visible": "0",
        "map_position": "right",
        "regional_view": "table",
        "output_mode": "json",
    }


def exercise_workspace_crud(
    base_url: str,
    auth: tuple[str, str],
    stanza: str,
    verify_ssl: bool,
    cleanup: list[tuple[str, str]],
) -> None:
    endpoint = "scd_insights_workspaces"
    base_path = f"/servicesNS/nobody/{APP}/{endpoint}"
    status, _body = request(
        base_url,
        auth,
        f"{base_path}?output_mode=json",
        "POST",
        {"name": stanza, **workspace_fields("Authorization probe")},
        verify_ssl,
    )
    expect(status, (200, 201), f"create {stanza}")
    cleanup.append((endpoint, stanza))

    status, _body = request(
        base_url,
        auth,
        f"{base_path}/{quoted(stanza)}?output_mode=json",
        "POST",
        {"label": "Authorization probe updated", "output_mode": "json"},
        verify_ssl,
    )
    expect(status, (200,), f"update {stanza}")

    status, _body = request(
        base_url,
        auth,
        f"/servicesNS/-/{APP}/configs/conf-insights_workspaces/{quoted(stanza)}?output_mode=json",
        verify_ssl=verify_ssl,
    )
    expect(status, (200,), f"read {stanza} through generic merged conf endpoint")

    status, _body = request(
        base_url,
        auth,
        f"{base_path}/{quoted(stanza)}?output_mode=json",
        "DELETE",
        verify_ssl=verify_ssl,
    )
    expect(status, (200,), f"delete {stanza}")
    cleanup.remove((endpoint, stanza))


def exercise_topology_crud(
    base_url: str,
    auth: tuple[str, str],
    stanza: str,
    verify_ssl: bool,
    cleanup: list[tuple[str, str]],
) -> None:
    endpoint = "scd_customer_topology"
    base_path = f"/servicesNS/nobody/{APP}/{endpoint}"
    fields = {
        "schema_version": "1",
        "title": "Authorization probe",
        "description": "Temporary live validation",
        "site_count": "0",
        "link_count": "0",
        "section_titles": json.dumps({"security": "Security"}),
        "payload_json": json.dumps({"version": 1, "topology": {"sites": [], "links": []}}),
        "output_mode": "json",
    }
    status, _body = request(
        base_url,
        auth,
        f"{base_path}?output_mode=json",
        "POST",
        {"name": stanza, **fields},
        verify_ssl,
    )
    expect(status, (200, 201), f"create {stanza}")
    cleanup.append((endpoint, stanza))

    status, _body = request(
        base_url,
        auth,
        f"/servicesNS/-/{APP}/configs/conf-customer_topology/{quoted(stanza)}?output_mode=json",
        verify_ssl=verify_ssl,
    )
    expect(status, (200,), f"read {stanza} through generic merged conf endpoint")

    status, _body = request(
        base_url,
        auth,
        f"{base_path}/{quoted(stanza)}?output_mode=json",
        "DELETE",
        verify_ssl=verify_ssl,
    )
    expect(status, (200,), f"delete {stanza}")
    cleanup.remove((endpoint, stanza))


def main() -> int:
    base_url = env_required("SPLUNK_BASE_URL")
    admin_auth = (env_required("SPLUNK_USERNAME"), env_required("SPLUNK_PASSWORD"))
    verify_ssl = os.environ.get("SPLUNK_VERIFY_SSL", "true").lower() not in {
        "0",
        "false",
        "no",
    }
    suffix = uuid.uuid4().hex[:8]
    delegated_role = f"scd14_delegated_{suffix}"
    viewer_role = f"scd14_viewer_{suffix}"
    delegated_user = f"scd14_delegated_{suffix}"
    viewer_user = f"scd14_viewer_{suffix}"
    power_user = f"scd14_power_{suffix}"
    sc_admin_user = f"scd14_sc_admin_{suffix}"
    password = f"SCD-14-{suffix}-Test!"
    created_roles: list[str] = []
    created_users: list[str] = []
    cleanup_stanzas: list[tuple[str, str]] = []
    factory_probe = f"scd14_factory_probe_{suffix}"
    factory_probe_created = False
    results: dict[str, str] = {}

    try:
        admin_caps = current_capabilities(base_url, admin_auth, verify_ssl)
        if CAPABILITY not in admin_caps:
            raise LiveValidationError("admin did not inherit the workspace capability")
        exercise_workspace_crud(
            base_url,
            admin_auth,
            f"workspace.scd14_admin_{suffix}",
            verify_ssl,
            cleanup_stanzas,
        )
        results["admin"] = "shared workspace CRUD allowed"

        create_role(base_url, admin_auth, delegated_role, verify_ssl, CAPABILITY)
        created_roles.append(delegated_role)
        create_role(base_url, admin_auth, viewer_role, verify_ssl)
        created_roles.append(viewer_role)
        for username, role in (
            (delegated_user, delegated_role),
            (viewer_user, viewer_role),
            (power_user, "power"),
        ):
            create_user(base_url, admin_auth, username, password, role, verify_ssl)
            created_users.append(username)

        delegated_auth = (delegated_user, password)
        viewer_auth = (viewer_user, password)
        power_auth = (power_user, password)

        if CAPABILITY not in current_capabilities(base_url, power_auth, verify_ssl):
            raise LiveValidationError("power did not inherit the workspace capability")
        exercise_workspace_crud(
            base_url,
            power_auth,
            f"workspace.scd14_power_{suffix}",
            verify_ssl,
            cleanup_stanzas,
        )
        results["power"] = "capability inherited; shared workspace CRUD allowed"

        delegated_caps = current_capabilities(base_url, delegated_auth, verify_ssl)
        if CAPABILITY not in delegated_caps or "admin_all_objects" in delegated_caps:
            raise LiveValidationError(
                "delegated role did not receive the intended narrow capability set"
            )
        exercise_workspace_crud(
            base_url,
            delegated_auth,
            f"workspace.scd14_delegated_{suffix}",
            verify_ssl,
            cleanup_stanzas,
        )
        exercise_topology_crud(
            base_url,
            delegated_auth,
            f"overview_customer_connectivity_scd14_{suffix}",
            verify_ssl,
            cleanup_stanzas,
        )
        results["delegated_custom_role"] = "workspace and topology CRUD allowed"

        status, _body = request(
            base_url,
            delegated_auth,
            f"/servicesNS/nobody/{APP}/configs/conf-searchbase?output_mode=json",
            "POST",
            {"name": factory_probe, "search_name": "Authorization probe"},
            verify_ssl,
        )
        factory_probe_created = status in (200, 201)
        expect(status, (403,), "delegated role factory Searchbase write denial")
        results["factory_searchbase"] = "delegated role denied"

        for conf_name in ("insights_workspaces", "customer_topology"):
            status, _body = request(
                base_url,
                viewer_auth,
                f"/servicesNS/-/{APP}/configs/conf-{conf_name}?output_mode=json&count=1",
                verify_ssl=verify_ssl,
            )
            expect(status, (200,), f"viewer generic read for {conf_name}")
        status, _body = request(
            base_url,
            viewer_auth,
            f"/servicesNS/nobody/{APP}/scd_insights_workspaces?output_mode=json",
            "POST",
            {
                "name": f"workspace.scd14_viewer_{suffix}",
                **workspace_fields("Must be denied"),
            },
            verify_ssl,
        )
        expect(status, (403,), "viewer shared workspace mutation denial")
        results["unprivileged_custom_role"] = "generic reads allowed; mutation denied"

        validation_auth = delegated_auth
        validation_scenarios = (
            (
                "invalid stanza",
                f"/servicesNS/nobody/{APP}/scd_insights_workspaces/{quoted('searchbase.forbidden')}?output_mode=json",
                {"label": "Denied"},
            ),
            (
                "cross-schema field",
                f"/servicesNS/nobody/{APP}/scd_insights_workspaces/{quoted(f'layout.scd14_{suffix}.security')}?output_mode=json",
                {"source_workspace": "secure_networking"},
            ),
            (
                "invalid topology JSON",
                f"/servicesNS/nobody/{APP}/scd_customer_topology/{quoted(f'overview_customer_connectivity_scd14_invalid_{suffix}')}?output_mode=json",
                {"payload_json": "[]"},
            ),
            (
                "oversized topology JSON",
                f"/servicesNS/nobody/{APP}/scd_customer_topology/{quoted(f'overview_customer_connectivity_scd14_large_{suffix}')}?output_mode=json",
                {"payload_json": json.dumps({"value": "x" * (128 * 1024)})},
            ),
        )
        for scenario, path, fields in validation_scenarios:
            status, _body = request(
                base_url,
                validation_auth,
                path,
                "POST",
                fields,
                verify_ssl,
            )
            expect(status, (400,), f"server validation: {scenario}")
        results["server_validation"] = "all malformed and oversized writes denied"

        status, _body = request(
            base_url,
            admin_auth,
            "/services/authorization/roles/sc_admin?output_mode=json",
            verify_ssl=verify_ssl,
        )
        if status == 200:
            create_status, _body = request(
                base_url,
                admin_auth,
                "/services/authentication/users?output_mode=json",
                "POST",
                {
                    "name": sc_admin_user,
                    "password": password,
                    "roles": "sc_admin",
                    "force-change-pass": "0",
                },
                verify_ssl,
            )
            if create_status in (200, 201):
                created_users.append(sc_admin_user)
                sc_admin_auth = (sc_admin_user, password)
                if CAPABILITY not in current_capabilities(
                    base_url, sc_admin_auth, verify_ssl
                ):
                    raise LiveValidationError("sc_admin did not inherit the capability")
                exercise_workspace_crud(
                    base_url,
                    sc_admin_auth,
                    f"workspace.scd14_sc_admin_{suffix}",
                    verify_ssl,
                    cleanup_stanzas,
                )
                results["sc_admin"] = (
                    "capability inherited; shared workspace CRUD allowed"
                )
            elif create_status == 403:
                results["sc_admin"] = (
                    "skipped: test administrator cannot assign the sc_admin role"
                )
            else:
                raise LiveValidationError(
                    "create temporary sc_admin user: expected HTTP "
                    f"(200, 201, 403), received HTTP {create_status}"
                )
        elif status == 404:
            results["sc_admin"] = "not installed on this Splunk Enterprise instance"
        else:
            raise LiveValidationError(f"sc_admin discovery returned HTTP {status}")

        print(json.dumps({"status": "passed", "scenarios": results}, indent=2))
        return 0
    finally:
        for endpoint, stanza in reversed(cleanup_stanzas):
            request(
                base_url,
                admin_auth,
                f"/servicesNS/nobody/{APP}/{endpoint}/{quoted(stanza)}?output_mode=json",
                "DELETE",
                verify_ssl=verify_ssl,
            )
        if factory_probe_created:
            request(
                base_url,
                admin_auth,
                f"/servicesNS/nobody/{APP}/configs/conf-searchbase/{quoted(factory_probe)}?output_mode=json",
                "DELETE",
                verify_ssl=verify_ssl,
            )
        for username in reversed(created_users):
            request(
                base_url,
                admin_auth,
                f"/services/authentication/users/{quoted(username)}?output_mode=json",
                "DELETE",
                verify_ssl=verify_ssl,
            )
        for role in reversed(created_roles):
            request(
                base_url,
                admin_auth,
                f"/services/authorization/roles/{quoted(role)}?output_mode=json",
                "DELETE",
                verify_ssl=verify_ssl,
            )


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except LiveValidationError as error:
        print(json.dumps({"status": "failed", "error": str(error)}), file=sys.stderr)
        raise SystemExit(1)
