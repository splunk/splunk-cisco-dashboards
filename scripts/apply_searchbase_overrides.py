#!/usr/bin/env python3
"""Apply reviewed field corrections to individual searchbase stanzas.

Why this is a script and not a hand edit
----------------------------------------
Same reason as apply_search_visibility.py. searchbase.conf is routinely rebuilt
with:

    git checkout HEAD -- <searchbase.conf>
    python3 scripts/apply_searchbase_taxonomy.py --apply

The taxonomy classifier only manages category, sub_category, and tags, so any
hand edit to another key is silently lost on the next rebuild. Recording the
correction here makes it replayable.

Only the keys named in OVERRIDES are rewritten, on only the stanzas named in
OVERRIDES. Stanza ids, SPL bodies, and every other key are passed through
untouched and verified afterwards.

Usage:
    python3 scripts/apply_searchbase_overrides.py --check   # verify, write nothing
    python3 scripts/apply_searchbase_overrides.py --apply
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

SOURCE = (
    Path(__file__).resolve().parent.parent
    / "packages/splunk-cisco-dashboards/src/main/resources/splunk/default/searchbase.conf"
)

# ---------------------------------------------------------------------------
# dashboard_it_health_v1_issues_trend
# ---------------------------------------------------------------------------
# This stanza documented itself as the effective SPL of Dashboard Studio data
# source ds_issues_trend in netops_critical_systems_health.xml. That data source
# reads raw events (extend ds_base_issues_ref, then timechart fixedrange=false),
# but the stanza's SPL was migrated on 2026-09-02 to a tstats query against the
# accelerated Cisco_Catalyst_App datamodel. The prose was never updated, so it
# described a data path the search no longer uses.
#
# search_name is also disambiguated here. It was "IT Health - Issues Trend",
# one character away from the sibling "IT Health - Issue Trend", which is a
# genuinely different search reading raw events for a different panel. The
# dashboard already calls these two "Open Issues Trend" and "Issue Trend"; this
# adopts the dashboard's own wording. Only the display name changes. The stanza
# id dashboard_it_health_v1_issues_trend is NOT touched, because it is
# referenced by test/adaptiveSearchbaseSpans.test.cjs.
_ISSUES_TREND_RELATED_INFO = (
    "<ul>"
    "<li><b>Accelerated datamodel search</b><br>Reads the "
    "<code>Cisco_Catalyst_App</code> datamodel through <code>tstats</code> "
    "rather than raw events, so it returns quickly over long time ranges but "
    "depends on that datamodel being accelerated.</li>"
    "<li><b>Acceleration dependency</b><br>The <code>scd_summariesonly</code> "
    "macro controls whether only summarised data is read. If this search "
    "returns nothing while raw events clearly exist, check the acceleration "
    "state of <code>Cisco_Catalyst_App</code> before troubleshooting the SPL.</li>"
    "<li><b>Related search</b><br><i>IT Health - Issue Trend</i> answers the "
    "same question from raw <code>cisco:dnac:issue</code> and "
    "<code>cisco:catalyst:issue</code> events, and is the one to use where the "
    "datamodel is not accelerated.</li>"
    "<li><b><a href=\"https://www.cisco.com/c/en/us/support/cloud-systems-management/"
    "dna-center/series.html\">Cisco Catalyst Center support documentation</a></b>"
    "<br>Configuration and API guides for the assurance data behind this "
    "datamodel.</li>"
    "</ul>"
)

OVERRIDES: dict[str, dict[str, str]] = {
    "dashboard_it_health_v1_issues_trend": {
        "search_name": "IT Health - Open Issues Trend",
        "description": (
            "<p>Distinct count of active Catalyst Center issues over time, read "
            "from the accelerated <code>Cisco_Catalyst_App</code> datamodel. "
            "Backs the <i>Open Issues</i> value on "
            "<code>netops_critical_systems_health.xml</code>.</p>"
        ),
        "related_info": _ISSUES_TREND_RELATED_INFO,
    },
}

MANAGED = {stanza: tuple(keys) for stanza, keys in OVERRIDES.items()}


def stanza_ids(text: str) -> list[str]:
    return re.findall(r"^\[([A-Za-z][A-Za-z0-9_-]*)\]\s*$", text, re.M)


def chunks_of(text: str) -> list[str]:
    return re.split(r"(?=^\[[A-Za-z][A-Za-z0-9_-]*\]\s*$)", text, flags=re.M)


def strip_managed(text: str) -> str:
    """Everything except the managed lines of the managed stanzas."""
    out: list[str] = []
    for chunk in chunks_of(text):
        m = re.match(r"^\[([^\]]+)\]", chunk)
        keys = MANAGED.get(m.group(1)) if m else None
        if not keys:
            out.append(chunk)
            continue
        out.append(
            "\n".join(
                line
                for line in chunk.splitlines()
                if not any(line.startswith(f"{k} = ") for k in keys)
            )
        )
    return "".join(out)


def build(original: str) -> tuple[str, int]:
    out: list[str] = []
    changed = 0
    for chunk in chunks_of(original):
        m = re.match(r"^\[([^\]]+)\]", chunk)
        if not m or m.group(1) not in OVERRIDES:
            out.append(chunk)
            continue
        new_chunk = chunk
        for key, value in OVERRIDES[m.group(1)].items():
            pattern = rf"^{key} = .*$"
            if not re.search(pattern, new_chunk, re.M):
                raise SystemExit(
                    f"[{m.group(1)}] is missing a '{key} =' line; refusing to write"
                )
            # A literal replacement avoids backslash escapes in the value.
            new_chunk = re.sub(
                pattern, lambda _m, k=key, v=value: f"{k} = {v}", new_chunk, count=1, flags=re.M
            )
        if new_chunk != chunk:
            changed += 1
        out.append(new_chunk)
    return "".join(out), changed


def field(text: str, stanza: str, key: str) -> str | None:
    for chunk in chunks_of(text):
        m = re.match(r"^\[([^\]]+)\]", chunk)
        if m and m.group(1) == stanza:
            v = re.search(rf"^{key} = (.*)$", chunk, re.M)
            return v.group(1) if v else None
    return None


def verify(original: str, updated: str) -> list[str]:
    errors: list[str] = []

    present = set(stanza_ids(original))
    for stanza in OVERRIDES:
        if stanza not in present:
            errors.append(f"unknown stanza id in OVERRIDES: {stanza}")

    if stanza_ids(original) != stanza_ids(updated):
        errors.append("stanza list changed")

    # The single most important check: nothing outside the managed keys moved.
    if strip_managed(original) != strip_managed(updated):
        errors.append("content outside the managed keys was modified")

    def searches(text: str) -> list[str]:
        return re.findall(r"^search = (.*?)(?=^[a-z_]+\s*=|\Z)", text, re.M | re.S)

    if searches(original) != searches(updated):
        errors.append("at least one 'search =' body changed")

    for stanza, values in OVERRIDES.items():
        for key, want in values.items():
            got = field(updated, stanza, key)
            if got != want:
                errors.append(f"[{stanza}] {key} did not take the override")
            if got is not None and "\n" in got:
                errors.append(f"[{stanza}] {key} value spans lines; conf must stay single-line")

    # A rename is only safe if nothing else referenced the old display name.
    # Guard the invariant rather than trusting a one-off grep.
    names: dict[str, str] = {}
    for chunk in chunks_of(updated):
        m = re.match(r"^\[([^\]]+)\]", chunk)
        if not m:
            continue
        v = re.search(r"^search_name = (.*)$", chunk, re.M)
        if v:
            names[m.group(1)] = v.group(1)
    for stanza, values in OVERRIDES.items():
        old = field(original, stanza, "search_name")
        new = values.get("search_name")
        if new and old and old != new:
            stale = [n for n, nm in names.items() if n != stanza and nm == old]
            if stale:
                errors.append(f"old search_name {old!r} still used by {stale}")

    return errors


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()
    if not (args.apply or args.check):
        ap.error("pass --check or --apply")

    original = SOURCE.read_text()
    updated, changed = build(original)
    errors = verify(original, updated)

    # Re-running must be a no-op, so a rebuild can replay this safely.
    twice, changed_twice = build(updated)
    if twice != updated or changed_twice:
        errors.append("not idempotent: a second run would change the file again")

    keys = sum(len(v) for v in OVERRIDES.values())
    print(f"stanzas corrected this run: {changed} (of {len(OVERRIDES)} managed, {keys} keys)")

    if errors:
        print(f"\nVERIFY FAILED ({len(errors)} problems):")
        for e in errors[:20]:
            print(f"  - {e}")
        return 1
    print("verify: PASS (stanza list, SPL bodies, and all unmanaged keys unchanged)")

    if args.apply:
        SOURCE.write_text(updated)
        print(f"\nwrote {SOURCE}")
    else:
        print("\n--check only, nothing written")
    return 0


if __name__ == "__main__":
    sys.exit(main())
