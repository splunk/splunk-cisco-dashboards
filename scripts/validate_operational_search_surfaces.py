#!/usr/bin/env python3
"""Inventory and safely execute searches wired into shipped app surfaces.

The validator is read-only. It resolves workspace tiles, Signal Rails,
topology link bindings, Dashboard Studio searches, and Searchbase references;
then dispatches each unique root search with bounded serial execution.
"""

from __future__ import annotations

import argparse
import base64
from dataclasses import asdict, dataclass
import json
import os
from pathlib import Path
import re
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET


APP = "splunk-cisco-dashboards"
TOKEN_RE = re.compile(r"\$([A-Za-z0-9_.:-]+)\$")
UNSAFE_RE = re.compile(
    r"(?:^|\|)\s*(?:collect|delete|outputlookup|sendemail|runshellscript)\b",
    re.IGNORECASE,
)


class ValidationError(RuntimeError):
    pass


@dataclass(frozen=True)
class SearchTarget:
    key: str
    surface: str
    source: str
    app: str
    query: str
    earliest: str
    latest: str


@dataclass
class SearchResult:
    key: str
    surface: str
    source: str
    app: str
    status: str
    rows: int = 0
    elapsed_seconds: float = 0.0
    message: str = ""


def split_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


def parse_conf_text(text: str) -> dict[str, dict[str, str]]:
    """Parse the subset of Splunk .conf syntax used by app-owned resources."""
    stanzas: dict[str, dict[str, str]] = {}
    current: dict[str, str] | None = None
    pending_key: str | None = None
    for raw_line in text.splitlines():
        line = raw_line.rstrip()
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if stripped.startswith("[") and stripped.endswith("]"):
            current = stanzas.setdefault(stripped[1:-1], {})
            pending_key = None
            continue
        if current is None:
            continue
        if pending_key is not None:
            continued = stripped
            has_more = continued.endswith("\\")
            if has_more:
                continued = continued[:-1]
            current[pending_key] += "\n" + continued
            pending_key = pending_key if has_more else None
            continue
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        key, value = key.strip(), value.strip()
        has_more = value.endswith("\\")
        if has_more:
            value = value[:-1]
        current[key] = value
        pending_key = key if has_more else None
    return stanzas


def load_conf(path: Path) -> dict[str, dict[str, str]]:
    return parse_conf_text(path.read_text(encoding="utf-8"))


def merge_conf(
    base: dict[str, dict[str, str]], overrides: dict[str, dict[str, str]]
) -> dict[str, dict[str, str]]:
    merged = {name: dict(values) for name, values in base.items()}
    for name, values in overrides.items():
        merged.setdefault(name, {}).update(values)
    return merged


def basic_request(
    base_url: str,
    username: str,
    password: str,
    path: str,
    *,
    fields: dict[str, str] | None = None,
    timeout: int = 60,
    verify_ssl: bool = True,
) -> tuple[int, object]:
    data = urllib.parse.urlencode(fields).encode("utf-8") if fields else None
    token = base64.b64encode(f"{username}:{password}".encode()).decode("ascii")
    request = urllib.request.Request(
        f"{base_url.rstrip('/')}{path}",
        data=data,
        method="POST" if fields else "GET",
        headers={
            "Authorization": f"Basic {token}",
            "Accept": "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
        },
    )
    context = None if verify_ssl else ssl._create_unverified_context()
    try:
        with urllib.request.urlopen(request, context=context, timeout=timeout) as response:
            raw = response.read().decode("utf-8", errors="replace")
            return response.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as error:
        raw = error.read().decode("utf-8", errors="replace")
        try:
            body: object = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            body = {"raw": raw[:1000]}
        return error.code, body


def fetch_effective_conf(
    base_url: str,
    username: str,
    password: str,
    conf_name: str,
    verify_ssl: bool,
) -> dict[str, dict[str, str]]:
    path = (
        f"/servicesNS/-/{APP}/configs/conf-{urllib.parse.quote(conf_name)}"
        "?count=0&output_mode=json"
    )
    try:
        status, body = basic_request(
            base_url, username, password, path, timeout=60, verify_ssl=verify_ssl
        )
    except (TimeoutError, urllib.error.URLError) as error:
        raise ValidationError(
            f"effective {conf_name}.conf read failed: {error.reason if isinstance(error, urllib.error.URLError) else error}"
        ) from error
    if status != 200 or not isinstance(body, dict):
        raise ValidationError(f"effective {conf_name}.conf read failed with HTTP {status}")
    result: dict[str, dict[str, str]] = {}
    for entry in body.get("entry", []):
        name = str(entry.get("name", "")).strip()
        content = entry.get("content", {})
        if name and isinstance(content, dict):
            result[name] = {
                str(key): str(value)
                for key, value in content.items()
                if not str(key).startswith("eai:") and value is not None
            }
    return result


def searchbase_indexes(
    searchbase: dict[str, dict[str, str]]
) -> tuple[
    dict[str, dict[str, str]],
    dict[str, dict[str, str]],
    dict[str, dict[str, str]],
]:
    by_id = {name: values for name, values in searchbase.items() if values.get("search")}
    by_name = {
        values["search_name"]: values
        for values in by_id.values()
        if values.get("search_name")
    }
    by_tile_id: dict[str, dict[str, str]] = {}
    for values in by_id.values():
        try:
            options = json.loads(values.get("viz_options", "{}"))
        except json.JSONDecodeError:
            continue
        for overview in options.get("overview", []):
            if isinstance(overview, dict) and overview.get("tileId"):
                by_tile_id[str(overview["tileId"])] = values
    return by_id, by_name, by_tile_id


def input_tokens(definition: dict[str, object]) -> dict[str, str]:
    tokens: dict[str, str] = {}
    for raw in definition.get("inputs", {}).values():
        if not isinstance(raw, dict):
            continue
        options = raw.get("options", {})
        if not isinstance(options, dict):
            continue
        token = str(options.get("token", "")).strip()
        default = options.get("defaultValue")
        if not token or default is None:
            continue
        if isinstance(default, list):
            tokens[token] = ",".join(str(item) for item in default)
        else:
            tokens[token] = str(default)
        if raw.get("type") == "input.timerange":
            earliest, _, latest = str(default).partition(",")
            tokens[f"{token}.earliest"] = earliest or "-24h"
            tokens[f"{token}.latest"] = latest or "now"
            tokens[f"{token}.span"] = "auto"
    return tokens


def resolve_tokens(value: str, tokens: dict[str, str]) -> tuple[str, list[str]]:
    unresolved: set[str] = set()

    def replace(match: re.Match[str]) -> str:
        name = match.group(1)
        if name in tokens:
            return tokens[name]
        unresolved.add(name)
        return match.group(0)

    return TOKEN_RE.sub(replace, value), sorted(unresolved)


def target_from_record(
    key: str,
    surface: str,
    source: str,
    record: dict[str, str],
    earliest: str,
    latest: str,
) -> SearchTarget:
    return SearchTarget(
        key=key,
        surface=surface,
        source=source,
        app=record.get("dispatch_context", APP) or APP,
        query=record["search"],
        earliest=earliest,
        latest=latest,
    )


def inventory_surfaces(
    app_root: Path,
    workspaces: dict[str, dict[str, str]],
    topology: dict[str, dict[str, str]],
    searchbase: dict[str, dict[str, str]],
    earliest: str,
    latest: str,
) -> tuple[list[SearchTarget], list[dict[str, str]], dict[str, int]]:
    by_id, by_name, by_tile_id = searchbase_indexes(searchbase)
    targets: dict[tuple[str, str, str, str], SearchTarget] = {}
    issues: list[dict[str, str]] = []
    counts = {
        "workspace_references": 0,
        "signal_rail_references": 0,
        "topology_references": 0,
        "dashboard_search_roots": 0,
        "dashboard_searchbase_roots": 0,
        "dashboard_chains": 0,
    }

    def add(target: SearchTarget) -> None:
        identity = (target.app, target.query, target.earliest, target.latest)
        targets.setdefault(identity, target)

    for stanza, values in workspaces.items():
        if not stanza.startswith("layout."):
            continue
        for stanza_id in split_csv(values.get("tiles", "")):
            counts["workspace_references"] += 1
            record = by_id.get(stanza_id) or by_tile_id.get(stanza_id)
            if record is None:
                issues.append({"status": "blocked", "source": stanza, "message": f"missing Searchbase stanza {stanza_id}"})
                continue
            add(target_from_record(stanza_id, "workspace", stanza, record, earliest, latest))

    signal_items = {
        name.removeprefix("signal_item."): values
        for name, values in workspaces.items()
        if name.startswith("signal_item.")
    }
    for stanza, values in workspaces.items():
        if not stanza.startswith("signal_rail.") or values.get("enabled", "1") == "0":
            continue
        for item_id in split_csv(values.get("items", "")):
            counts["signal_rail_references"] += 1
            item = signal_items.get(item_id)
            search_name = item.get("search_name", "") if item else ""
            record = by_name.get(search_name)
            if record is None:
                message = f"missing signal item {item_id}" if item is None else f"missing Searchbase search_name {search_name}"
                issues.append({"status": "blocked", "source": stanza, "message": message})
                continue
            add(target_from_record(search_name, "signal_rail", stanza, record, earliest, latest))

    for stanza, values in topology.items():
        raw = values.get("payload_json")
        if not raw:
            continue
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError as error:
            issues.append({"status": "blocked", "source": stanza, "message": f"invalid topology JSON: {error.msg}"})
            continue
        for link in payload.get("topology", {}).get("links", []):
            search_name = str(link.get("searchName", "")).strip()
            if not search_name:
                continue
            counts["topology_references"] += 1
            record = by_name.get(search_name)
            if record is None:
                issues.append({"status": "blocked", "source": stanza, "message": f"missing topology Searchbase search_name {search_name}"})
                continue
            add(target_from_record(search_name, "topology", stanza, record, earliest, latest))

    views_dir = app_root / "default/data/ui/views"
    for path in sorted(views_dir.glob("*.xml")):
        try:
            definition_node = ET.parse(path).getroot().find("definition")
            if definition_node is None or not definition_node.text:
                continue
            definition = json.loads(definition_node.text)
        except (ET.ParseError, json.JSONDecodeError) as error:
            issues.append({"status": "blocked", "source": path.name, "message": f"invalid dashboard definition: {error}"})
            continue
        tokens = input_tokens(definition)
        tokens.setdefault("time_tok.earliest", earliest)
        tokens.setdefault("time_tok.latest", latest)
        tokens.setdefault("time_tok.span", "auto")
        data_sources = definition.get("dataSources", {})
        for data_id, data_source in data_sources.items():
            if not isinstance(data_source, dict):
                continue
            source_type = data_source.get("type")
            options = data_source.get("options", {})
            if source_type == "ds.chain":
                counts["dashboard_chains"] += 1
                parent = str(options.get("extend", "")).strip()
                if not parent or parent not in data_sources:
                    issues.append({"status": "blocked", "source": f"{path.name}:{data_id}", "message": f"missing chain parent {parent or '<empty>'}"})
                continue
            params = options.get("queryParameters", {}) if isinstance(options, dict) else {}
            ds_earliest, unresolved_earliest = resolve_tokens(str(params.get("earliest", earliest)), tokens)
            ds_latest, unresolved_latest = resolve_tokens(str(params.get("latest", latest)), tokens)
            if source_type == "ds.searchbase":
                counts["dashboard_searchbase_roots"] += 1
                ref = str(options.get("ref", "")).strip()
                record = by_id.get(ref)
                if record is None:
                    issues.append({"status": "blocked", "source": f"{path.name}:{data_id}", "message": f"missing Searchbase ref {ref}"})
                    continue
                add(target_from_record(ref, "dashboard_searchbase", f"{path.name}:{data_id}", record, ds_earliest, ds_latest))
            elif source_type == "ds.search":
                counts["dashboard_search_roots"] += 1
                raw_query = str(options.get("query", ""))
                query, unresolved_query = resolve_tokens(raw_query, tokens)
                unresolved = sorted(set(unresolved_query + unresolved_earliest + unresolved_latest))
                if unresolved:
                    issues.append({"status": "deferred", "source": f"{path.name}:{data_id}", "message": f"interaction-dependent tokens: {', '.join(unresolved)}"})
                    continue
                if not query.strip():
                    issues.append({"status": "blocked", "source": f"{path.name}:{data_id}", "message": "empty ds.search query"})
                    continue
                add(SearchTarget(f"{path.stem}:{data_id}", "dashboard", path.name, APP, query, ds_earliest, ds_latest))

    return list(targets.values()), issues, counts


def message_text(body: object) -> str:
    if isinstance(body, dict):
        messages = body.get("messages", [])
        if isinstance(messages, list):
            texts = [str(item.get("text", "")) for item in messages if isinstance(item, dict)]
            if any(texts):
                return "; ".join(text for text in texts if text)[:1000]
        return str(body.get("error", body.get("raw", "")))[:1000]
    return str(body)[:1000]


def execute_target(
    target: SearchTarget,
    base_url: str,
    username: str,
    password: str,
    timeout: int,
    verify_ssl: bool,
) -> SearchResult:
    started = time.monotonic()
    if UNSAFE_RE.search(target.query):
        return SearchResult(target.key, target.surface, target.source, target.app, "blocked", message="write-capable SPL command rejected")
    query = target.query.strip()
    if not query.lower().startswith("search ") and not query.startswith("|"):
        query = "search " + query
    path = f"/servicesNS/-/{urllib.parse.quote(target.app)}/search/v2/jobs"
    try:
        status, body = basic_request(
            base_url,
            username,
            password,
            path,
            fields={
                "search": query,
                "earliest_time": target.earliest,
                "latest_time": target.latest,
                "exec_mode": "oneshot",
                "output_mode": "json",
                "count": "1",
                "max_time": str(timeout),
            },
            timeout=timeout + 10,
            verify_ssl=verify_ssl,
        )
    except (TimeoutError, urllib.error.URLError) as error:
        return SearchResult(target.key, target.surface, target.source, target.app, "failed", elapsed_seconds=round(time.monotonic() - started, 3), message=str(error)[:1000])
    elapsed = round(time.monotonic() - started, 3)
    if status != 200 or not isinstance(body, dict):
        return SearchResult(target.key, target.surface, target.source, target.app, "failed", elapsed_seconds=elapsed, message=f"HTTP {status}: {message_text(body)}")
    messages = message_text(body)
    if messages and re.search(r"\b(?:error|fatal|failed|terminated prematurely)\b", messages, re.IGNORECASE):
        return SearchResult(target.key, target.surface, target.source, target.app, "failed", elapsed_seconds=elapsed, message=messages)
    rows = len(body.get("results", [])) if isinstance(body.get("results", []), list) else 0
    return SearchResult(target.key, target.surface, target.source, target.app, "populated" if rows else "clean_empty", rows=rows, elapsed_seconds=elapsed, message=messages)


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument("--app-root", type=Path, default=Path(__file__).resolve().parents[1] / "packages/splunk-cisco-dashboards/src/main/resources/splunk")
    result.add_argument("--base-url", default=os.environ.get("SPLUNK_BASE_URL", ""))
    result.add_argument("--username", default=os.environ.get("SPLUNK_USERNAME", ""))
    result.add_argument("--password", default=os.environ.get("SPLUNK_PASSWORD", ""))
    result.add_argument("--earliest", default="-24h")
    result.add_argument("--latest", default="now")
    result.add_argument("--timeout", type=int, default=60)
    result.add_argument("--inventory-only", action="store_true")
    result.add_argument("--no-effective-config", action="store_true")
    result.add_argument("--verify-ssl", action="store_true")
    result.add_argument("--json", action="store_true")
    result.add_argument("--output", type=Path)
    result.add_argument(
        "--match",
        help="Only execute targets whose key, source, or surface contains this case-insensitive text",
    )
    return result


def main() -> int:
    args = parser().parse_args()
    default_dir = args.app_root / "default"
    workspaces = load_conf(default_dir / "insights_workspaces.conf")
    topology = load_conf(default_dir / "customer_topology.conf")
    searchbase = load_conf(default_dir / "searchbase.conf")
    effective = False
    if args.base_url and not args.no_effective_config:
        if not args.username or not args.password:
            raise ValidationError("username and password are required for live validation")
        workspaces = merge_conf(workspaces, fetch_effective_conf(args.base_url, args.username, args.password, "insights_workspaces", args.verify_ssl))
        topology = merge_conf(topology, fetch_effective_conf(args.base_url, args.username, args.password, "customer_topology", args.verify_ssl))
        searchbase = merge_conf(searchbase, fetch_effective_conf(args.base_url, args.username, args.password, "searchbase", args.verify_ssl))
        effective = True
    targets, issues, counts = inventory_surfaces(args.app_root, workspaces, topology, searchbase, args.earliest, args.latest)
    if args.match:
        needle = args.match.casefold()
        targets = [
            target
            for target in targets
            if needle in f"{target.key} {target.source} {target.surface}".casefold()
        ]
        if not targets:
            raise ValidationError(f"no search targets matched {args.match!r}")
        counts["matched_search_targets"] = len(targets)
    results: list[SearchResult] = []
    if not args.inventory_only:
        if not args.base_url or not args.username or not args.password:
            raise ValidationError("base URL, username, and password are required unless --inventory-only is used")
        for index, target in enumerate(targets, 1):
            print(f"[{index}/{len(targets)}] {target.surface}: {target.key}", file=sys.stderr, flush=True)
            results.append(execute_target(target, args.base_url, args.username, args.password, args.timeout, args.verify_ssl))
    status_counts: dict[str, int] = {}
    for issue in issues:
        status_counts[issue["status"]] = status_counts.get(issue["status"], 0) + 1
    for result in results:
        status_counts[result.status] = status_counts.get(result.status, 0) + 1
    report = {
        "ok": not any(issue["status"] == "blocked" for issue in issues)
        and not any(result.status in {"blocked", "failed"} for result in results),
        "effective_config": effective,
        "inventory": {**counts, "unique_search_targets": len(targets)},
        "status_counts": status_counts,
        "issues": issues,
        "results": [asdict(result) for result in results],
    }
    rendered = json.dumps(report, indent=2, sort_keys=True) if args.json else json.dumps(report, sort_keys=True)
    if args.output:
        args.output.write_text(rendered + "\n", encoding="utf-8")
        print(
            json.dumps(
                {
                    "ok": report["ok"],
                    "inventory": report["inventory"],
                    "status_counts": report["status_counts"],
                    "output": str(args.output),
                },
                sort_keys=True,
            )
        )
    else:
        print(rendered)
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except ValidationError as error:
        print(json.dumps({"ok": False, "error": str(error)}), file=sys.stderr)
        raise SystemExit(2)
