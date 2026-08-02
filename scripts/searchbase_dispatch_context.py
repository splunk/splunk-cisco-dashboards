#!/usr/bin/env python3
"""Assign Searchbase catalogue provenance without forcing search execution.

``dispatch_context`` is used by the catalogue UI as the source-app facet.
Harvested entries and entries with an unambiguous App Navigator sourcetype
owner retain that source-app classification, while ``dispatch_context_force =
0`` keeps execution in the app that owns the searchbase.conf stanza.
Cross-source and locally authored entries remain explicitly forced to
``splunk-cisco-dashboards``.
"""

from __future__ import annotations

import argparse
import fnmatch
import json
import re
from collections import Counter
from pathlib import Path

try:
    from scripts.format_searchbase_conf import SOURCE, parse_stanzas
except ModuleNotFoundError:
    from format_searchbase_conf import SOURCE, parse_stanzas


LOCAL_APP = "splunk-cisco-dashboards"
DC_NETWORKING_APP = "cisco_dc_networking_app_for_splunk"
THOUSANDEYES_APP = "ta_cisco_thousandeyes"
CATALYST_APP = "cisco-catalyst-app"
MERAKI_APP = "Splunk_TA_cisco_meraki"
SPACES_APP = "ta_cisco_spaces"
SOURCETYPE_CATALOG = Path(__file__).with_name("searchbase_sourcetype_catalog.json")

# These Catalyst-derived searches use raw events rather than the
# Cisco_Catalyst_App data-model root, so the SPL alone cannot identify their
# original catalogue provenance. Their source was verified against the
# pre-normalization Searchbase history.
CATALYST_RAW_SOURCE_STANZAS = frozenset(
    {
        "dashboard_netops_readiness_v1_a_nrs_forecast",
        "dashboard_netops_readiness_v1_score_per_site",
        "dashboard_netops_readiness_v1_score_r",
        "dashboard_workplace_spog_v1_main_trend",
        "dashboard_workplace_spog_v1_persite",
        "dashboard_workplace_spog_v1_t2_nqi_kpi",
        "statewide_ds_wired_client_trend_24h",
        "statewide_ds_wireless_client_trend_24h",
    }
)

HEADER = re.compile(r"(?m)^\[([a-z0-9_]+)\]\n")
SOURCETYPE_EQUALS = re.compile(r'(?i)\bsourcetype\s*=\s*"?([A-Za-z0-9:_*.-]+)"?')
SOURCETYPE_IN = re.compile(r"(?is)\bsourcetype\s+IN\s*\(([^)]*)\)")


def load_sourcetype_owners() -> dict[str, frozenset[str]]:
    """Load the App Navigator-derived TA ownership catalog."""
    payload = json.loads(SOURCETYPE_CATALOG.read_text(encoding="utf-8"))
    return {
        pattern: frozenset(owners)
        for pattern, owners in payload["owners"].items()
    }


SOURCETYPE_OWNERS = load_sourcetype_owners()


def search_sourcetypes(search: str) -> set[str]:
    """Extract explicit sourcetype values from a Searchbase SPL definition."""
    values = set(SOURCETYPE_EQUALS.findall(search))
    for values_clause in SOURCETYPE_IN.findall(search):
        values.update(re.findall(r'"([^"\s,]+)"|\b([A-Za-z0-9:_*.-]+)\b', values_clause))
    return {
        value if isinstance(value, str) else next(part for part in value if part)
        for value in values
    }


def sourcetype_owners(search: str) -> set[str]:
    """Return one owning app only when the SPL is unambiguously classified."""
    owners: set[str] = set()
    for sourcetype in search_sourcetypes(search):
        normalized = sourcetype.lower()
        # products.conf lists individual Meraki and Spaces sourcetypes. SPL
        # commonly uses their family wildcard, so preserve ownership for
        # those searches as well instead of treating the wildcard as unknown.
        if normalized.startswith("meraki:"):
            owners.add(MERAKI_APP)
        if normalized.startswith("cisco:spaces:firehose"):
            owners.add(SPACES_APP)
        if "*" in sourcetype:
            continue
        for pattern, apps in SOURCETYPE_OWNERS.items():
            if fnmatch.fnmatchcase(sourcetype, pattern):
                owners.update(apps)
    return owners


def expected_dispatch_settings(
    stanza_name: str, fields: dict[str, str]
) -> tuple[str, str]:
    """Return the catalogue source app and force flag for one stanza."""
    search = fields.get("search", "")
    prose = " ".join(
        fields.get(key, "")
        for key in ("description", "explanation", "related_info")
    ).lower()

    if stanza_name.startswith("dc_networking_"):
        return DC_NETWORKING_APP, "0"
    if (
        "harvested from <code>ta_cisco_thousandeyes</code>" in prose
        or re.search(r'(?i)\bdatamodel\s*=\s*"?Cisco_ThousandEyes"?\b', search)
    ):
        return THOUSANDEYES_APP, "0"
    if (
        "Cisco_Catalyst_App" in search
        or stanza_name in CATALYST_RAW_SOURCE_STANZAS
        or "harvested from <code>cisco-catalyst-app</code>" in prose
    ):
        return CATALYST_APP, "0"
    owners = sourcetype_owners(search)
    if len(owners) == 1:
        return owners.pop(), "0"
    return LOCAL_APP, "1"


def assign_dispatch_contexts(text: str) -> tuple[str, Counter[tuple[str, str]]]:
    """Rewrite only dispatch metadata, preserving all other stanza text."""
    parsed = dict(parse_stanzas(text))
    matches = list(HEADER.finditer(text))
    if not matches:
        raise ValueError("no Searchbase stanzas found")
    if len(parsed) != len(matches):
        raise ValueError("duplicate or malformed stanza IDs prevent safe assignment")

    counts: Counter[tuple[str, str]] = Counter()
    output = [text[: matches[0].start()]]
    for index, match in enumerate(matches):
        stanza_name = match.group(1)
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        block = text[match.start() : end]
        context, force = expected_dispatch_settings(stanza_name, parsed[stanza_name])
        counts[(context, force)] += 1
        block, context_changes = re.subn(
            r"(?m)^dispatch_context = \S+$",
            f"dispatch_context = {context}",
            block,
            count=1,
        )
        block, force_changes = re.subn(
            r"(?m)^dispatch_context_force = \S+$",
            f"dispatch_context_force = {force}",
            block,
            count=1,
        )
        if context_changes != 1 or force_changes != 1:
            raise ValueError(f"missing dispatch metadata in stanza: {stanza_name}")
        output.append(block)
    return "".join(output), counts


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=SOURCE)
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()

    original = args.source.read_text(encoding="utf-8")
    updated, counts = assign_dispatch_contexts(original)
    report = {
        "changed": updated != original,
        "stanzas": sum(counts.values()),
        "assignments": {
            f"{context}|force={force}": count
            for (context, force), count in sorted(counts.items())
        },
    }
    print(json.dumps(report, indent=2))
    if args.write and updated != original:
        args.source.write_text(updated, encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
