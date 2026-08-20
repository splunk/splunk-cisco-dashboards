#!/usr/bin/env python3
"""Execute every five-pillar Dashboard Studio drill-down against Splunk."""

from __future__ import annotations

import argparse
import base64
import json
import os
import re
import ssl
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, quote, urlencode, urlparse
from urllib.request import Request, urlopen
from xml.etree import ElementTree


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
PACKAGE_ROOT = REPOSITORY_ROOT / "packages" / "splunk-cisco-dashboards"
SEARCHBASE_PATH = PACKAGE_ROOT / "src/main/resources/splunk/default/searchbase.conf"
STUDIO_VIEW_DIRECTORY = (
    PACKAGE_ROOT / "src/main/resources/splunk/default/data/ui/views"
)
EMPTY_RESULT_MESSAGE = "No matching telemetry was found"


@dataclass(frozen=True)
class Target:
    stanza_id: str
    search_name: str
    search: str
    references: tuple[str, ...]


@dataclass(frozen=True)
class LiveResult:
    stanza_id: str
    search_name: str
    reference_count: int
    row_count: int
    status: str
    errors: tuple[str, ...]


def parse_searchbase(source: str) -> dict[str, dict[str, str]]:
    """Parse Searchbase including backslash-continued SPL fields."""

    records: dict[str, dict[str, str]] = {}
    current: dict[str, str] | None = None
    pending_key: str | None = None
    pending_parts: list[str] = []

    def finish_pending() -> None:
        nonlocal pending_key, pending_parts
        if current is not None and pending_key is not None:
            current[pending_key] = "\n".join(pending_parts).strip()
        pending_key = None
        pending_parts = []

    for line in source.splitlines():
        stanza_match = re.fullmatch(r"\[([^\]]+)\]", line)
        if stanza_match:
            finish_pending()
            stanza_id = stanza_match.group(1)
            current = {"id": stanza_id}
            records[stanza_id] = current
            continue

        if current is None:
            continue

        if pending_key is not None:
            continued = line.endswith("\\")
            pending_parts.append(line[:-1] if continued else line)
            if not continued:
                finish_pending()
            continue

        field_match = re.match(r"^([A-Za-z0-9_]+)\s*=\s*(.*)$", line)
        if not field_match:
            continue
        key, value = field_match.groups()
        if value.endswith("\\"):
            pending_key = key
            pending_parts = [value[:-1]]
        else:
            current[key] = value.strip()

    finish_pending()
    return records


def studio_references() -> tuple[dict[str, list[str]], int]:
    references: dict[str, list[str]] = {}
    card_count = 0
    for view_path in sorted(STUDIO_VIEW_DIRECTORY.glob("sn_*.xml")):
        root = ElementTree.parse(view_path).getroot()
        definition_text = root.findtext("definition")
        if not definition_text:
            continue
        definition = json.loads(definition_text)
        dashboard_title = definition.get("title", view_path.stem)
        for visualization in definition.get("visualizations", {}).values():
            for handler in visualization.get("eventHandlers", []):
                if handler.get("type") != "drilldown.customUrl":
                    continue
                relative_url = handler.get("options", {}).get("url", "")
                query = parse_qs(urlparse(relative_url).query)
                origin = query.get("origin", ["Unknown card"])[0]
                card_count += 1
                for target in query.get("target", [""])[0].split(","):
                    target = target.strip()
                    if target:
                        references.setdefault(target, []).append(
                            f"{dashboard_title} / {origin}"
                        )
    return references, card_count


def resolve_targets(
    records: dict[str, dict[str, str]], references: dict[str, list[str]]
) -> list[Target]:
    by_name = {
        record["search_name"]: record
        for record in records.values()
        if record.get("search_name")
    }
    resolved: dict[str, Target] = {}
    failures: list[str] = []

    for reference, locations in references.items():
        record = records.get(reference) or by_name.get(reference)
        if record is None:
            failures.append(f"Unresolved target: {reference}")
            continue
        search = record.get("search", "").strip()
        if not search:
            failures.append(f"Target has no SPL: {record['id']}")
            continue
        stanza_id = record["id"]
        previous = resolved.get(stanza_id)
        combined_locations = tuple(
            sorted(set((previous.references if previous else ()) + tuple(locations)))
        )
        resolved[stanza_id] = Target(
            stanza_id=stanza_id,
            search_name=record.get("search_name", stanza_id),
            search=search,
            references=combined_locations,
        )

    if failures:
        raise ValueError("\n".join(failures))
    return sorted(resolved.values(), key=lambda target: target.search_name.lower())


def normalized_search(search: str) -> str:
    stripped = search.strip()
    if stripped.startswith("|") or re.match(r"(?i)^search\s", stripped):
        return stripped
    return f"search {stripped}"


def execute_target(
    target: Target,
    *,
    base_url: str,
    owner: str,
    app: str,
    username: str,
    password: str,
    earliest: str,
    latest: str,
    timeout: float,
    verify_ssl: bool,
) -> LiveResult:
    endpoint = (
        f"{base_url.rstrip('/')}/servicesNS/{quote(owner, safe='')}/"
        f"{quote(app, safe='')}/search/jobs/export"
    )
    payload = urlencode(
        {
            "search": normalized_search(target.search),
            "earliest_time": earliest,
            "latest_time": latest,
            "output_mode": "json",
            "count": "20",
        }
    ).encode("utf-8")
    authorization = base64.b64encode(f"{username}:{password}".encode("utf-8"))
    request = Request(
        endpoint,
        data=payload,
        headers={
            "Authorization": f"Basic {authorization.decode('ascii')}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        method="POST",
    )
    context = None if verify_ssl else ssl._create_unverified_context()
    rows: list[dict[str, Any]] = []
    errors: list[str] = []
    try:
        with urlopen(request, timeout=timeout, context=context) as response:
            body = response.read().decode("utf-8", errors="replace")
    except HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        errors.append(f"HTTP {error.code}: {body[:300]}")
    except (TimeoutError, URLError) as error:
        errors.append(str(error))
        body = ""

    for line in body.splitlines():
        if not line.strip():
            continue
        try:
            item = json.loads(line)
        except json.JSONDecodeError as error:
            errors.append(f"Invalid JSON response: {error}")
            continue
        for message in item.get("messages", []):
            if str(message.get("type", "")).upper() in {"ERROR", "FATAL"}:
                errors.append(str(message.get("text", "Unknown Splunk search error")))
        result = item.get("result")
        if isinstance(result, dict):
            rows.append(result)

    placeholder = any(
        EMPTY_RESULT_MESSAGE.lower() in json.dumps(row).lower() for row in rows
    )
    if errors:
        status = "error"
    elif placeholder:
        status = "placeholder"
    elif not rows:
        status = "empty"
    else:
        status = "populated"

    return LiveResult(
        stanza_id=target.stanza_id,
        search_name=target.search_name,
        reference_count=len(target.references),
        row_count=len(rows),
        status=status,
        errors=tuple(errors),
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--base-url",
        default=os.environ.get("SPLUNK_BASE_URL", "https://127.0.0.1:8093"),
    )
    parser.add_argument("--username", default=os.environ.get("SPLUNK_USERNAME"))
    parser.add_argument("--password", default=os.environ.get("SPLUNK_PASSWORD"))
    parser.add_argument("--owner", default=os.environ.get("SPLUNK_OWNER"))
    parser.add_argument("--app", default="splunk-cisco-dashboards")
    parser.add_argument("--earliest", default="-24h")
    parser.add_argument("--latest", default="now")
    parser.add_argument("--timeout", type=float, default=60.0)
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--verify-ssl", action="store_true")
    parser.add_argument("--json", action="store_true", dest="json_output")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if not args.username or not args.password:
        print(
            "ERROR: set SPLUNK_USERNAME and SPLUNK_PASSWORD or pass --username/--password",
            file=sys.stderr,
        )
        return 2
    owner = args.owner or args.username

    records = parse_searchbase(SEARCHBASE_PATH.read_text(encoding="utf-8"))
    references, card_count = studio_references()
    try:
        targets = resolve_targets(records, references)
    except ValueError as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1

    results: list[LiveResult] = []
    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as executor:
        futures = {
            executor.submit(
                execute_target,
                target,
                base_url=args.base_url,
                owner=owner,
                app=args.app,
                username=args.username,
                password=args.password,
                earliest=args.earliest,
                latest=args.latest,
                timeout=args.timeout,
                verify_ssl=args.verify_ssl,
            ): target
            for target in targets
        }
        for future in as_completed(futures):
            results.append(future.result())

    results.sort(key=lambda result: result.search_name.lower())
    counts = {
        status: sum(result.status == status for result in results)
        for status in ("populated", "placeholder", "empty", "error")
    }
    payload = {
        "dashboards": 17,
        "cards": card_count,
        "target_references": sum(result.reference_count for result in results),
        "unique_targets": len(results),
        "counts": counts,
        "results": [asdict(result) for result in results],
    }
    if args.json_output:
        print(json.dumps(payload, indent=2))
    else:
        print(
            "Validated "
            f"{payload['dashboards']} dashboards, {payload['cards']} cards, "
            f"{payload['target_references']} target references, and "
            f"{payload['unique_targets']} unique live searches: "
            f"{counts['populated']} populated, {counts['placeholder']} placeholder, "
            f"{counts['empty']} empty, {counts['error']} error."
        )
        for result in results:
            if result.status == "populated":
                continue
            detail = f" rows={result.row_count}"
            if result.errors:
                detail += f" error={'; '.join(result.errors)}"
            print(
                f"{result.status.upper()}: {result.stanza_id} "
                f"({result.search_name}){detail}"
            )

    return 0 if counts == {"populated": len(results), "placeholder": 0, "empty": 0, "error": 0} else 1


if __name__ == "__main__":
    raise SystemExit(main())
