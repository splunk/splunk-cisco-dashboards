#!/usr/bin/env python3
"""Discover Cisco Nexus Dashboard values needed by the DC Networking TA.

The script performs only authentication and read-only GET requests. Passwords are
collected with getpass, are never echoed, and are never included in the output.
"""

from __future__ import annotations

import argparse
import getpass
import json
import re
import ssl
import sys
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Iterable, Mapping
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit
from urllib.request import HTTPSHandler, Request, build_opener


FABRICS_PATH = "/api/v1/manage/fabricsSummary"
SWITCHES_PATH = "/api/v1/manage/inventory/switches"
INTERFACE_PATHS = (
    (
        "/sedgeapi/v1/cisco-nir/api/api/v1/protocols/statusDetails",
        {"history": 0},
    ),
    (
        "/sedgeapi/v1/cisco-nir/api/api/v1/protocols/details",
        {
            "statName": "interface",
            "startDate": "now-1h",
            "endDate": "now",
            "count": 1000,
        },
    ),
    (
        "/sedgeapi/v1/cisco-nir/api/api/v1/congestion/counters",
        {"scope": "interface", "count": 1000, "offset": 0},
    ),
)

FABRIC_CONTEXT_KEYS = ("fabricName", "siteName", "fabric", "site")
FABRIC_NAME_KEYS = (*FABRIC_CONTEXT_KEYS, "name", "displayName")
NODE_KEYS = ("nodeName", "switchName", "hostName", "hostname", "node")
INTERFACE_KEYS = (
    "interfaceName",
    "localInterfaceName",
    "ifName",
    "interface",
)


class NDClientError(RuntimeError):
    """Raised when Nexus Dashboard cannot satisfy a request."""


@dataclass(frozen=True)
class Endpoint:
    host: str
    port: int

    @property
    def authority(self) -> str:
        host = f"[{self.host}]" if ":" in self.host else self.host
        return f"{host}:{self.port}"


def parse_endpoint(value: str, port_override: int | None = None) -> Endpoint:
    """Parse a hostname, IP, or HTTPS URL into an ND endpoint."""
    candidate = value.strip()
    if not candidate:
        raise ValueError("Nexus Dashboard hostname/IP cannot be empty")
    parsed = urlsplit(candidate if "://" in candidate else f"https://{candidate}")
    if parsed.scheme.lower() != "https":
        raise ValueError("Nexus Dashboard must be accessed with HTTPS")
    if not parsed.hostname:
        raise ValueError(f"Could not determine a hostname from {value!r}")
    if parsed.path not in ("", "/") or parsed.query or parsed.fragment:
        raise ValueError("Enter only the ND hostname/IP, not a dashboard page path")
    return Endpoint(parsed.hostname, port_override or parsed.port or 443)


def _first_string(record: Mapping[str, Any], keys: Iterable[str]) -> str | None:
    for key in keys:
        value = record.get(key)
        if isinstance(value, str) and value.strip() and value.strip() != "*":
            return value.strip()
    return None


def _walk_dicts(value: Any) -> Iterable[Mapping[str, Any]]:
    if isinstance(value, Mapping):
        yield value
        for child in value.values():
            yield from _walk_dicts(child)
    elif isinstance(value, list):
        for child in value:
            yield from _walk_dicts(child)


def _preferred_records(payload: Any, collection_keys: Iterable[str]) -> list[Mapping[str, Any]]:
    """Return records from the first recognized collection in an API response."""
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, Mapping)]
    if not isinstance(payload, Mapping):
        return []
    for key in collection_keys:
        value = payload.get(key)
        if isinstance(value, list):
            return [item for item in value if isinstance(item, Mapping)]
    for key in ("data", "response", "result", "value"):
        if key in payload:
            records = _preferred_records(payload[key], collection_keys)
            if records:
                return records
    return []


def extract_fabrics(payload: Any) -> list[str]:
    records = _preferred_records(payload, ("fabrics", "sites", "entries", "items"))
    names = {_first_string(record, FABRIC_NAME_KEYS) for record in records}
    return sorted(name for name in names if name)


def extract_nodes(payload: Any) -> dict[str, set[str]]:
    records = _preferred_records(payload, ("switches", "nodes", "entries", "items"))
    result: dict[str, set[str]] = defaultdict(set)
    for record in records:
        fabric = _first_string(record, FABRIC_CONTEXT_KEYS)
        node = _first_string(record, NODE_KEYS)
        if fabric and node:
            result[fabric].add(node)
    return dict(result)


def extract_interface_pairs(payload: Any, default_fabric: str) -> set[tuple[str, str, str]]:
    """Extract (fabric, node, interface) tuples while preserving nested context."""
    pairs: set[tuple[str, str, str]] = set()

    def visit(value: Any, fabric: str | None, node: str | None) -> None:
        if isinstance(value, list):
            for child in value:
                visit(child, fabric, node)
            return
        if not isinstance(value, Mapping):
            return

        current_fabric = _first_string(value, FABRIC_CONTEXT_KEYS) or fabric or default_fabric
        current_node = _first_string(value, NODE_KEYS) or node
        current_interface = _first_string(value, INTERFACE_KEYS)
        if current_fabric and current_node and current_interface:
            pairs.add((current_fabric, current_node, current_interface))

        for child in value.values():
            if isinstance(child, (Mapping, list)):
                visit(child, current_fabric, current_node)

    visit(payload, default_fabric, None)
    return pairs


def slug(value: str) -> str:
    normalized = re.sub(r"[^A-Za-z0-9]+", "_", value).strip("_").lower()
    return normalized or "value"


class NDClient:
    def __init__(
        self,
        endpoint: Endpoint,
        *,
        timeout: float,
        insecure: bool,
        ca_file: str | None,
    ) -> None:
        self.endpoint = endpoint
        self.timeout = timeout
        self.token: str | None = None
        if insecure:
            context = ssl.create_default_context()
            context.check_hostname = False
            context.verify_mode = ssl.CERT_NONE
        else:
            context = ssl.create_default_context(cafile=ca_file)
        self.opener = build_opener(HTTPSHandler(context=context))

    def request(
        self,
        method: str,
        path: str,
        *,
        params: Mapping[str, Any] | None = None,
        payload: Mapping[str, Any] | None = None,
    ) -> Any:
        normalized_path = "/" + path.lstrip("/")
        query = f"?{urlencode(params, doseq=True)}" if params else ""
        url = f"https://{self.endpoint.authority}{normalized_path}{query}"
        headers = {"Accept": "application/json"}
        body = None
        if payload is not None:
            body = json.dumps(payload).encode("utf-8")
            headers["Content-Type"] = "application/json"
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        request = Request(url, data=body, headers=headers, method=method)
        try:
            with self.opener.open(request, timeout=self.timeout) as response:
                raw = response.read()
        except HTTPError as error:
            # Do not print response bodies: a failed authentication service could
            # echo request data, and this helper must never expose credentials.
            raise NDClientError(
                f"HTTP {error.code} ({error.reason}) for {normalized_path}"
            ) from None
        except URLError as error:
            reason = getattr(error, "reason", error)
            raise NDClientError(f"Could not reach Nexus Dashboard: {reason}") from None
        except TimeoutError:
            raise NDClientError(f"Timed out requesting {normalized_path}") from None

        if not raw:
            return {}
        try:
            return json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise NDClientError(f"Nexus Dashboard returned non-JSON data for {normalized_path}") from error

    def login(self, username: str, password: str, domain: str) -> None:
        response = self.request(
            "POST",
            "/login",
            payload={"userName": username, "userPasswd": password, "domain": domain},
        )
        token = response.get("token") if isinstance(response, Mapping) else None
        if not isinstance(token, str) or not token:
            raise NDClientError("Login succeeded but the response did not contain a token")
        self.token = token

    def get(self, path: str, params: Mapping[str, Any] | None = None) -> Any:
        return self.request("GET", path, params=params)


@dataclass
class Discovery:
    fabrics: list[str]
    nodes: dict[str, set[str]]
    interfaces: set[tuple[str, str, str]]
    warnings: list[str]


def _response_total(payload: Any) -> int | None:
    for record in _walk_dicts(payload):
        for key in ("totalResultsCount", "totalItemsCount"):
            value = record.get(key)
            if isinstance(value, int) and value >= 0:
                return value
    return None


def _discover_interfaces_from_endpoint(
    client: NDClient,
    path: str,
    base_params: Mapping[str, Any],
    fabric: str,
) -> set[tuple[str, str, str]]:
    """Read one interface endpoint, including offset pagination when supported."""
    params = dict(base_params)
    params["siteName"] = fabric
    now = datetime.now(timezone.utc)
    if params.get("endDate") == "now":
        params["endDate"] = now.isoformat(timespec="milliseconds").replace("+00:00", "Z")
    if params.get("startDate") == "now-1h":
        params["startDate"] = (now - timedelta(hours=1)).isoformat(
            timespec="milliseconds"
        ).replace("+00:00", "Z")
    page_size = params.get("count")
    if not isinstance(page_size, int) or page_size <= 0:
        response = client.get(path, params)
        return extract_interface_pairs(response, fabric)

    offset = int(params.get("offset", 0))
    pairs: set[tuple[str, str, str]] = set()
    while True:
        params["offset"] = offset
        response = client.get(path, params)
        page_pairs = extract_interface_pairs(response, fabric)
        previous_count = len(pairs)
        pairs.update(page_pairs)
        total = _response_total(response)
        if not page_pairs or (total is not None and offset + page_size >= total):
            break
        if len(pairs) == previous_count:
            break
        page_records = _preferred_records(response, ("entries", "items"))
        if total is None and len(page_records) < page_size:
            break
        offset += page_size
    return pairs


def discover(client: NDClient, requested_fabrics: list[str], skip_interfaces: bool) -> Discovery:
    warnings: list[str] = []
    fabrics_payload = client.get(FABRICS_PATH)
    fabrics = extract_fabrics(fabrics_payload)
    if not fabrics:
        raise NDClientError(f"No fabric names were found in {FABRICS_PATH}")

    if requested_fabrics:
        available = set(fabrics)
        missing = sorted(set(requested_fabrics) - available)
        if missing:
            warnings.append("Requested fabrics not returned by ND: " + ", ".join(missing))
        fabrics = [fabric for fabric in fabrics if fabric in set(requested_fabrics)]
        if not fabrics:
            raise NDClientError("None of the requested fabric names were returned by ND")

    nodes: dict[str, set[str]] = defaultdict(set)
    try:
        switch_payload = client.get(SWITCHES_PATH)
        for fabric, names in extract_nodes(switch_payload).items():
            nodes[fabric].update(names)
    except NDClientError as error:
        warnings.append(f"Switch inventory was unavailable: {error}")

    interfaces: set[tuple[str, str, str]] = set()
    if not skip_interfaces:
        for fabric in fabrics:
            discovered_for_fabric: set[tuple[str, str, str]] = set()
            endpoint_errors: list[str] = []
            for path, base_params in INTERFACE_PATHS:
                try:
                    discovered_for_fabric = _discover_interfaces_from_endpoint(
                        client, path, base_params, fabric
                    )
                except NDClientError as error:
                    endpoint_errors.append(f"{path}: {error}")
                    continue
                if discovered_for_fabric:
                    break
            if not discovered_for_fabric:
                message = f"No node/interface pairs were returned for fabric {fabric!r}"
                if endpoint_errors:
                    message += "; " + " | ".join(endpoint_errors)
                warnings.append(message)
            interfaces.update(discovered_for_fabric)
            for pair_fabric, node, _interface in discovered_for_fabric:
                nodes[pair_fabric].add(node)

    return Discovery(fabrics, dict(nodes), interfaces, warnings)


def as_serializable(discovery: Discovery, endpoint: Endpoint, username: str, domain: str) -> dict[str, Any]:
    grouped: dict[str, dict[str, list[str]]] = {
        fabric: defaultdict(list) for fabric in discovery.fabrics
    }
    for fabric, node, interface in sorted(discovery.interfaces):
        if fabric in grouped:
            grouped[fabric][node].append(interface)

    return {
        "account": {
            "account_name": "ND_Account",
            "hostname": endpoint.host,
            "port": endpoint.port,
            "authentication_type": (
                "local_user_authentication" if domain == "local" else "remote_user_authentication"
            ),
            "username": username,
            "login_domain": None if domain == "local" else domain,
            "password": "PROMPTED_NOT_PRINTED",
        },
        "recommended_defaults": {
            "index": "nd",
            "interval": 300,
            "granularity": "5m",
            "scope": "interface",
        },
        "fabrics": [
            {
                "name": fabric,
                "nodes": {
                    node: sorted(grouped[fabric].get(node, []))
                    for node in sorted(discovery.nodes.get(fabric, set()))
                },
            }
            for fabric in discovery.fabrics
        ],
        "warnings": discovery.warnings,
    }


def print_text(result: Mapping[str, Any]) -> None:
    account = result["account"]
    defaults = result["recommended_defaults"]
    print("\nNexus Dashboard account values for the TA")
    print(f"  Account Name        : {account['account_name']}")
    print(f"  Hostname/IP Address : {account['hostname']}")
    print(f"  Port                : {account['port']}")
    print(f"  Authentication Type : {account['authentication_type']}")
    print(f"  Username            : {account['username']}")
    print(f"  Password            : use the password entered at the prompt")
    login_domain = account["login_domain"] or "not required for local authentication"
    print(f"  Login Domain        : {login_domain}")

    print("\nExact fabric names")
    for fabric in result["fabrics"]:
        print(f"  {fabric['name']}")

    print("\nSuggested Congestion inputs (one per node; do not use '*')")
    suggestion_count = 0
    for fabric in result["fabrics"]:
        for node, interfaces in fabric["nodes"].items():
            if not interfaces:
                continue
            suggestion_count += 1
            print(f"\n  Name           : congestion_{slug(fabric['name'])}_{slug(node)}")
            print(f"  Fabric Name    : {fabric['name']}")
            print(f"  Node Name      : {node}")
            print(f"  Interface Name : {','.join(interfaces)}")
            print(f"  Scope          : {defaults['scope']}")
            print(f"  Granularity    : {defaults['granularity']}")
            print(f"  Interval       : {defaults['interval']}")
            print(f"  Index          : {defaults['index']} (must already exist in Splunk)")

    if suggestion_count == 0:
        print("  No complete node/interface combinations were discovered.")
        print("  Review the warnings below and confirm the user has read access to telemetry data.")

    if result["warnings"]:
        print("\nWarnings")
        for warning in result["warnings"]:
            print(f"  - {warning}")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Prompt for Nexus Dashboard credentials and discover the exact fabric, "
            "node, and interface names required by the Cisco DC Networking TA."
        )
    )
    parser.add_argument("--host", help="ND hostname, IP, or HTTPS URL; prompted if omitted")
    parser.add_argument("--port", type=int, help="ND HTTPS port (default: URL port or 443)")
    parser.add_argument("--username", help="ND username; prompted if omitted")
    parser.add_argument("--domain", default="local", help="ND login domain (default: local)")
    parser.add_argument(
        "--fabric",
        action="append",
        default=[],
        help="Limit discovery to one exact fabric name; repeat for additional fabrics",
    )
    parser.add_argument("--timeout", type=float, default=30.0, help="HTTP timeout in seconds")
    parser.add_argument("--ca-file", help="CA certificate bundle used to verify ND TLS")
    parser.add_argument(
        "--insecure",
        action="store_true",
        help="Disable TLS verification for a lab/self-signed certificate",
    )
    parser.add_argument(
        "--skip-interfaces",
        action="store_true",
        help="Discover only fabrics and switches",
    )
    parser.add_argument("--json", action="store_true", help="Print JSON instead of text")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.insecure and args.ca_file:
        parser.error("--insecure and --ca-file cannot be used together")
    if args.port is not None and not 1 <= args.port <= 65535:
        parser.error("--port must be between 1 and 65535")
    if args.timeout <= 0:
        parser.error("--timeout must be greater than zero")

    host_value = args.host or input("Nexus Dashboard hostname or IP: ").strip()
    try:
        endpoint = parse_endpoint(host_value, args.port)
    except ValueError as error:
        parser.error(str(error))

    username = (args.username or input("Nexus Dashboard username: ")).strip()
    if not username:
        parser.error("username cannot be empty")
    domain = args.domain.strip()
    if not domain:
        parser.error("domain cannot be empty")
    password = getpass.getpass("Nexus Dashboard password: ")
    if not password:
        parser.error("password cannot be empty")

    if args.insecure:
        print(
            "WARNING: TLS certificate verification is disabled for this run.",
            file=sys.stderr,
        )

    client = NDClient(
        endpoint,
        timeout=args.timeout,
        insecure=args.insecure,
        ca_file=args.ca_file,
    )
    try:
        client.login(username, password, domain)
        discovery = discover(client, args.fabric, args.skip_interfaces)
    except NDClientError as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1
    finally:
        password = ""  # Drop the local reference as soon as requests are complete.

    result = as_serializable(discovery, endpoint, username, domain)
    if args.json:
        print(json.dumps(result, indent=2, sort_keys=True))
    else:
        print_text(result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
