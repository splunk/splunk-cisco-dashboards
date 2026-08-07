#!/usr/bin/env python3
"""Normalise the ``tags`` controlled vocabulary in ``searchbase.conf``.

The catalogue accumulated 647 distinct tags across ~1082 stanzas, 60% of
them used only once or twice. That is too large to function as a filter in
the KPI picker, the Dashboard Builder dropdown, or the topology map's tag
facet -- all three intersect tags with AND, so near-synonyms silently
produce empty result sets.

This script applies the mechanical half of the consolidation:

* ``ALIASES``    -- provably-equivalent names collapse to one canonical tag
                    (``DNAC`` -> ``Catalyst Center``, ``Site`` -> ``Sites``).
* ``NOISE``      -- implementation detail, authoring provenance, and UI
                    component names that describe *how* a search was built
                    rather than *what* it answers.

Per-stanza specificity (ensuring every stanza carries 3-6 meaningful
subject and intent tags) is deliberately **not** automated: it requires
reading the SPL and is done during the per-domain metadata passes.

Both maps are intentionally conservative. A merge is only listed when the
two names denote the same product, the same plural/singular subject, or the
same intent -- correlation alone is not sufficient evidence, per
``.github/skills/audit-searchbase-catalog/SKILL.md``.

Usage::

    python3 scripts/normalize_searchbase_tags.py --check
    python3 scripts/normalize_searchbase_tags.py --apply
"""

from __future__ import annotations

import argparse
import collections
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SEARCHBASE = (
    ROOT
    / "packages"
    / "splunk-cisco-dashboards"
    / "src"
    / "main"
    / "resources"
    / "splunk"
    / "default"
    / "searchbase.conf"
)

# ---------------------------------------------------------------------------
# Canonical product names. Cisco markets these under specific names; the
# catalogue should use exactly one spelling per product so a tag filter on
# "Catalyst Center" cannot miss stanzas tagged "DNAC".
# ---------------------------------------------------------------------------
PRODUCT_ALIASES = {
    "Cisco Catalyst Center": "Catalyst Center",
    "DNAC": "Catalyst Center",
    "Cisco Meraki": "Meraki",
    "Cisco Spaces Intelligence": "Cisco Spaces",
    "ACI": "Cisco ACI",
    "Cisco Nexus Dashboard": "Nexus Dashboard",
    "Cisco Nexus 9000": "Nexus 9000",
    "Cisco Duo": "Duo",
    "Cisco IOS": "IOS",
    "Cisco Firewall": "Firewall",
    "Cisco Secure Access": "Secure Access",
    "Cisco Secure Client": "Secure Client",
    "Cisco Secure Workload": "Secure Workload",
    "Tetration": "Secure Workload",
    "AttackAnalyzer": "Splunk Attack Analyzer",
    "ETD": "Email Threat Defense",
    "ISE TA": "ISE",
    # Cisco renamed Stealthwatch to Secure Network Analytics; both legacy
    # spellings co-occur on all three affected stanzas.
    "SNA": "Secure Network Analytics",
    "Stealthwatch": "Secure Network Analytics",
}

# ---------------------------------------------------------------------------
# Subject tags name what the search is about and are plural, per
# ``.cursor/skills/splunk-spl-searchbase-format/SKILL.md``.
# ---------------------------------------------------------------------------
PLURAL_ALIASES = {
    "Client": "Clients",
    "Device": "Devices",
    "Site": "Sites",
    "Topology Site": "Sites",
    "Session": "Sessions",
    "Event": "Events",
    "User": "Users",
    "Endpoint": "Endpoints",
    "Tunnel": "Tunnels",
    "Advisory": "Advisories",
    "Incident": "Incidents",
    "Failure": "Failures",
    "Threat": "Threats",
    "Policy": "Policies",
    "Anomalies": "Anomaly",  # intent tag: singular wins
    "AP": "Access Points",
    "Interface": "Interfaces",
    "Sensor Data": "Sensors",
    "Host": "Hosts",
    "Asset": "Assets",
    "Vulnerability": "Vulnerabilities",
}

# ---------------------------------------------------------------------------
# Intent tags name what the search does and are singular.
# ---------------------------------------------------------------------------
# ``Health`` and ``Capacity`` are deliberately NOT merged into ``Health
# Score`` and ``Capacity Planning``. Inspection shows ``Health`` marks
# infrastructure state (ISE CPU, container health, gateway health) rather
# than a computed 0-100 score, and ``Capacity`` spans both current
# utilisation and forward planning. Neither pair meets the skill's
# proven-synonymy bar, so both stay distinct.
INTENT_ALIASES = {
    "Score": "Health Score",
    "Executive Summary": "Executive",
    "Client Summary": "Clients",
    "Client Count": "Clients",
    "Client Distribution": "Distribution",
    "Breakdown": "Distribution",
    "Prediction": "Forecast",
    "Topology Link": "Topology",
}

ALIASES = {**PRODUCT_ALIASES, **PLURAL_ALIASES, **INTENT_ALIASES}

# ---------------------------------------------------------------------------
# Noise tags describe how a search was authored or rendered rather than what
# operational question it answers. They cannot usefully narrow a filter
# because they do not correlate with any customer-facing concern.
# ---------------------------------------------------------------------------
NOISE = {
    # SPL implementation detail
    "Data Model",
    "TStats",
    "Lookup Enriched",
    "Geo Enriched",
    "Description Search",
    # Authoring / harvest provenance
    "Dashboard Studio",
    "Harvested",
    "TA Stock Dashboard",
    "Migrated_From_SavedSearch",
    "Composite_Replacement",
    # UI component names, not subjects
    "Signal Rail",
    "Events And Incident Viewer",
    "Administrator Users Search",
    "Cisco Catalyst App Security Insights",
    "BEC query",
    # Redundant: every stanza in this app is Cisco
    "Cisco",
}

# Algorithm names are folded into the Machine Learning intent tag: the
# specific estimator is an implementation choice recorded in the SPL and the
# explanation, not a facet users filter on.
ALGORITHM_TAGS = {"LLP5", "DensityFunction", "RandomForest"}


def canonicalise(tags: list[str]) -> list[str]:
    """Return the normalised tag list, preserving first-seen order."""
    out: list[str] = []
    for tag in tags:
        if tag in NOISE:
            continue
        if tag in ALGORITHM_TAGS:
            tag = "Machine Learning"
        tag = ALIASES.get(tag, tag)
        if tag not in out:
            out.append(tag)
    return out


def process(text: str) -> tuple[str, collections.Counter, int]:
    stats: collections.Counter = collections.Counter()
    changed = 0
    lines = text.splitlines(keepends=True)
    for i, line in enumerate(lines):
        stripped = line.rstrip("\n")
        if not stripped.startswith("tags = "):
            continue
        original = [t.strip() for t in stripped[7:].split(",") if t.strip()]
        new = canonicalise(original)
        if not new:
            # Never strip a stanza down to an empty tag list; leaving the
            # original is safer than emitting a stanza no filter can reach.
            stats["skipped_would_empty"] += 1
            continue
        if new != original:
            changed += 1
            for t in original:
                if t in NOISE:
                    stats[f"removed: {t}"] += 1
                elif t in ALGORITHM_TAGS:
                    stats["folded to Machine Learning"] += 1
                elif t in ALIASES:
                    stats[f"{t} -> {ALIASES[t]}"] += 1
            eol = "\n" if line.endswith("\n") else ""
            lines[i] = "tags = " + ",".join(new) + eol
    return "".join(lines), stats, changed


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--source", default=str(SEARCHBASE))
    ap.add_argument("--apply", action="store_true", help="Write changes to disk")
    args = ap.parse_args()

    path = Path(args.source)
    text = path.read_text()
    new_text, stats, changed = process(text)

    before = collections.Counter()
    after = collections.Counter()
    for line in text.splitlines():
        if line.startswith("tags = "):
            before.update(t.strip() for t in line[7:].split(",") if t.strip())
    for line in new_text.splitlines():
        if line.startswith("tags = "):
            after.update(t.strip() for t in line[7:].split(",") if t.strip())

    print(f"stanzas with tag changes : {changed}")
    print(f"distinct tags before     : {len(before)}")
    print(f"distinct tags after      : {len(after)}")
    print(f"reduction                : {len(before) - len(after)}")
    print("\ntop transformations:")
    for key, count in stats.most_common(30):
        print(f"  {count:4d}  {key}")

    if args.apply:
        path.write_text(new_text)
        print(f"\nwrote {path}")
    else:
        print("\n(dry run -- pass --apply to write)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
