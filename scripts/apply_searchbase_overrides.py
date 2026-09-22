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

# ---------------------------------------------------------------------------
# "exercise" -> "surge event" display renames
# ---------------------------------------------------------------------------
# These five stanzas were authored during a customer engagement whose planned
# surge event was called an "exercise". That is the customer's operational
# vocabulary, not Cisco product vocabulary, so it does not belong in a shipped
# catalogue. "Surge event" says the same thing without carrying the engagement
# context, and matches the "surge" wording the panels already use elsewhere.
#
# Only search_name changes. The stanza ids are NOT touched: they encode the
# dashboard/data-source reconciliation convention
# (dashboard_<view>_v1_<dsid> mirrors ds_<dsid>), so renaming them would break
# the provenance link recorded in each stanza's related_info.
#
# The SPL is NOT touched either. dashboard_spaces_intelligence_v1_operations_compare_kpi
# builds an internal bucket label `phase=if(_time<split_time, "baseline",
# "exercise")`, compares against it in `stats avg(eval(if(phase="exercise",
# ...)))`, and then drops everything but `multiplier` with `| fields multiplier`.
# The literal is a self-referential comparison key that never reaches the panel,
# and the same SPL is duplicated in the dashboard's inline data source, so
# renaming it would have to stay byte-synchronised across both files to avoid
# silently zeroing the KPI - risk with no user-visible gain. The sibling
# compare_chart search does surface its phase labels, and those already read
# "Baseline (first half)" / "Operations (second half)".
# ---------------------------------------------------------------------------
# Agentic SOC DHCP tiles: prose that names the wrong source type
# ---------------------------------------------------------------------------
# These three read the accelerated Network_Sessions data model through tstats
# and filter it to DHCP. Their prose was written when the SPL filtered
# sourcetype="dhcp"; the SPL now filters sourcetype="dhcpd", the value that
# actually returns events in the target estate, so the prose names a source
# type none of them reads.
#
# The word "confirmed" also goes. It asserted that the named source type had
# been verified present in the accelerated model, which was true of the
# original value at authoring time and has not been re-established since.
# Membership in an accelerated data model is a property of the environment,
# not of this repository: it depends on the add-on that tags the events and
# on the acceleration being enabled. Prose in a shipped catalogue should not
# claim an environment fact it cannot check. Each tile now says which source
# type it reads and leaves the verifying to the operator, who can settle it
# with:
#
#     | tstats count FROM datamodel=Network_Sessions.All_Sessions
#           WHERE `index_dhcp` BY sourcetype
#
# If that returns a source type other than dhcpd, the SPL is what needs
# changing, and these three strings move with it.
#
# The SPL is NOT touched here. dhcpd is the only value tested against live
# data, and nothing in this repository can improve on that.
_DHCP_ACTIVITY_EXPLANATION = (
    "<p><code>tstats</code> counts the <code>dhcpd</code> member with "
    "<code>span=auto</code> and broadcasts <code>WindowSessions</code> for the "
    "headline. This provides identity and endpoint context; it is not a threat "
    "count.</p>"
)
_DHCP_ACTIVITY_RELATED_INFO = (
    "<ul><li><b>Headline</b><br><code>WindowSessions</code> is the "
    "selected-window modeled DHCP event total.</li>"
    "<li><b>Source contract</b><br>Reads <code>sourcetype=\"dhcpd\"</code> from "
    "accelerated <code>Network_Sessions.All_Sessions</code>. The tile is empty "
    "unless that source type is both present and tagged into the model.</li></ul>"
)
_DHCP_DEVICES_RELATED_INFO = (
    "<ul><li><b>Headline semantics</b><br><code>PeakBucketObservedDevices</code> "
    "is the maximum distinct MAC count in any automatic bucket, not a "
    "managed-device inventory or an exact whole-window distinct count.</li>"
    "<li><b>Source contract</b><br><code>All_Sessions.dest_mac</code> from the "
    "<code>dhcpd</code> member of accelerated "
    "<code>Network_Sessions.All_Sessions</code>.</li></ul>"
)
_DHCP_OUTCOMES_EXPLANATION = (
    "<p>Accelerated <code>tstats</code> groups the <code>dhcpd</code> member of "
    "<code>Network_Sessions.All_Sessions</code> by <code>All_Sessions.action</code> "
    "and counts modeled sessions.</p>"
)
_DHCP_OUTCOMES_RELATED_INFO = (
    "<ul><li><b>Interpretation</b><br>A high count reflects activity volume; the "
    "action and signature context determine whether it is expected.</li>"
    "<li><b>Field dependency</b><br>Requires <code>All_Sessions.action</code> to "
    "be populated by whichever add-on normalises the DHCP feed. An empty result "
    "can mean the field is unmapped rather than that no sessions occurred.</li></ul>"
)

OVERRIDES: dict[str, dict[str, str]] = {
    "agentic_soc_unified_threat_activity": {
        "explanation": _DHCP_ACTIVITY_EXPLANATION,
        "related_info": _DHCP_ACTIVITY_RELATED_INFO,
    },
    "agentic_soc_unified_xdr_severity": {
        "related_info": _DHCP_DEVICES_RELATED_INFO,
    },
    "agentic_soc_unified_xdr_status": {
        "explanation": _DHCP_OUTCOMES_EXPLANATION,
        "related_info": _DHCP_OUTCOMES_RELATED_INFO,
    },
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
    "dashboard_netops_readiness_v1_q3_aps_poor_health": {
        "search_name": "NetOps Readiness - Q3 - DNAC: APs to fix before the surge event",
    },
    "dashboard_netops_readiness_v1_q8_surge_per_building": {
        "search_name": (
            "NetOps Readiness - Q8 - Spaces: Surge multiplier per building "
            "(baseline week vs surge event)"
        ),
    },
    "dashboard_spaces_intelligence_v1_operations_compare_chart": {
        "search_name": (
            "Cisco Spaces Intelligence - Spaces baseline vs surge event - "
            "same metrics, side-by-side"
        ),
    },
    "dashboard_spaces_intelligence_v1_operations_compare_kpi": {
        "search_name": (
            "Cisco Spaces Intelligence - Spaces baseline vs surge event - "
            "surge multiplier"
        ),
    },
    "dashboard_spaces_intelligence_v1_operations_wifi": {
        "search_name": (
            "Cisco Spaces Intelligence - Spaces - WiFi associations by SSID + "
            "surge event annotations"
        ),
    },
    # The same "exercise" wording also reached the catalogue prose of four
    # unrelated stanzas. These strings render in the Searchbase browser, so they
    # are genericised for the same reason as the display names above.
    "enterprise_ds_ssid_client_trend_24h": {
        "explanation": (
            "<p>This search targets the Catalyst Center macro "
            "<code>index_catalyst</code> with sourcetype "
            "<code>cisco:dnac:client</code>, wireless-only "
            "<code>type=\"Wireless\"</code>. It timecharts distinct "
            "<code>macAddress</code> values per interval &mdash; a rolling "
            "unique client census &mdash; split by the "
            "<code>connection.ssid</code> multivalue field for SSID-level "
            "staffing views during enterprise surge events.</p>"
        ),
    },
    "catalyst_center_wired_health_kpi": {
        "description": (
            "<p>Mirrors the wireless KPI pattern for <b>wired clients</b>, "
            "yielding <b>health score</b>, <b>total count</b>, and the same "
            "<b>four bucket columns</b> for surge event command views.</p>"
        ),
    },
    "executive_summary_issue_trend": {
        "solution": (
            "<p><b>Operational insight:</b> A <b>P1 line that slopes up</b> "
            "during a surge event is a <b>go/no-go signal</b> for "
            "leadership-pair with remediation staffing.</p>"
        ),
    },
    "overview_link_state_drilldown": {
        "related_info": (
            "<ul><li><b><a href=\"https://www.cisco.com/c/en/us/support/routers/"
            "sd-wan/series.html\">Cisco Catalyst SD-WAN documentation</a></b><br>"
            "Interface and circuit monitoring in SD-WAN Manager, including the "
            "bandwidth utilisation fields read here.</li><li><b>Paired tiles</b>"
            "<br>The topology link tiles and the site-to-site link health charts "
            "on the executive and readiness dashboards use the same link health "
            "feed.</li></ul>"
        ),
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
