#!/usr/bin/env python3
"""Assign Searchbase catalogue provenance without forcing search execution.

``dispatch_context`` is used by the catalogue UI as the source-app facet.
Harvested entries therefore retain the app they came from, while
``dispatch_context_force = 0`` keeps execution in the app that owns the
searchbase.conf stanza. Locally authored entries remain explicitly forced to
``splunk-cisco-dashboards``.
"""

from __future__ import annotations

import argparse
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
    if "harvested from <code>ta_cisco_thousandeyes</code>" in prose:
        return THOUSANDEYES_APP, "0"
    if (
        "Cisco_Catalyst_App" in search
        or stanza_name in CATALYST_RAW_SOURCE_STANZAS
        or "harvested from <code>cisco-catalyst-app</code>" in prose
    ):
        return CATALYST_APP, "0"
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
