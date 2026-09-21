"""R13: "pair with" pointers to stanza ids that are not in the catalogue.

A cross-reference is a navigation instruction. When the id is wrong the
reader gets nothing back from a catalogue search and cannot tell whether the
companion search was renamed, never shipped, or removed.

Three groups here.

1. A stale "_ds_" infix. These ids predate a rename that dropped the
   datasource marker, and the current id is otherwise identical:
       executive_dashboard_ds_building_occupancy -> executive_dashboard_building_occupancy
       executive_summary_ds_ap_count             -> executive_summary_ap_count
       executive_dashboard_ds_active_devices     -> executive_dashboard_active_devices

2. XDR companions whose live counterparts have the shape the sentence
   promises:
       security_resilience_xdr_severity_breakdown -> security_resilience_xdr_by_severity
           "XDR by Severity", stats count by severity: the per-severity
           histogram.
       security_resilience_xdr_incident_detail    -> security_resilience_ds_xdr_detail
           "XDR Detail", the per-incident table.

3. A twin that does not exist under any name.
   executive_dashboard_failed_logon_with_baseline describes its identity
   normalization as "the same as executive_dashboard_failed_logon_count".
   There is no non-baseline executive failed-logon stanza -- the only other
   failed-logon searches live under security_resilience_* and
   dashboard_security_v1_*, and none is the referenced twin. Rather than
   guess at a substitute, these two sentences now state the normalization
   directly, which is what the reference existed to convey. Read off the
   SPL: ISE 5400 plus Windows EventCode=4625, identity lowercased and
   trimmed from whichever user field the source populates, Windows domain
   prefix stripped by rex sed, and "-", "n/a", "anonymous" and #...#
   placeholders dropped.

   The description also called the trend "hourly". The SPL uses
   timechart bins=200, which divides whatever window the dashboard passes,
   so the bucket size is not fixed at an hour. Corrected in passing since
   the sentence was being rewritten anyway.
"""

from __future__ import annotations

CORRECTIONS = [
    # -- group 1: stale _ds_ infix ------------------------------------------
    (
        "building_resilience_rooms_occupied_trend",
        "explanation",
        "Same logic as <code>executive_dashboard_ds_building_occupancy</code>,",
        "Same logic as <code>executive_dashboard_building_occupancy</code>,",
        "stanza id carries a _ds_ infix dropped in a rename",
    ),
    (
        "overview_ap_health",
        "related_info",
        "<b>Parent stanza</b><br><code>executive_summary_ds_ap_count</code>",
        "<b>Parent stanza</b><br><code>executive_summary_ap_count</code>",
        "stanza id carries a _ds_ infix dropped in a rename",
    ),
    (
        "overview_ap_health",
        "related_info",
        "the underlying <code>executive_summary_ds_ap_count</code> stays scoped",
        "the underlying <code>executive_summary_ap_count</code> stays scoped",
        "stanza id carries a _ds_ infix dropped in a rename",
    ),
    (
        "overview_ap_health",
        "related_info",
        "Pair with <code>executive_dashboard_ds_active_devices</code>",
        "Pair with <code>executive_dashboard_active_devices</code>",
        "stanza id carries a _ds_ infix dropped in a rename",
    ),
    (
        "overview_ap_health",
        "related_info",
        "and <code>executive_dashboard_ds_building_occupancy</code> &mdash;",
        "and <code>executive_dashboard_building_occupancy</code> &mdash;",
        "stanza id carries a _ds_ infix dropped in a rename",
    ),
    # -- group 2: XDR companions -------------------------------------------
    (
        "overview_xdr_critical_incidents",
        "related_info",
        "<code>security_resilience_xdr_severity_breakdown</code>",
        "<code>security_resilience_xdr_by_severity</code>",
        "stanza id does not exist; counterpart is xdr_by_severity",
    ),
    (
        "overview_xdr_critical_incidents",
        "related_info",
        "<code>security_resilience_xdr_incident_detail</code>",
        "<code>security_resilience_ds_xdr_detail</code>",
        "stanza id does not exist; counterpart is ds_xdr_detail",
    ),
    # -- group 3: twin that was never shipped ------------------------------
    (
        "executive_dashboard_failed_logon_with_baseline",
        "description",
        "<p>Hourly trend of <b>distinct failing identities</b> (same normalization as <code>executive_dashboard_failed_logon_count</code>) with baseline and window-total broadcast columns.</p>",
        "<p>Trend of <b>distinct failing identities</b> across Cisco ISE <code>5400</code> events and Windows <code>EventCode=4625</code>, each normalized to one lowercase identity, with baseline and window-total broadcast columns.</p>",
        "referenced twin stanza does not exist; state the normalization directly",
    ),
    (
        "executive_dashboard_failed_logon_with_baseline",
        "explanation",
        "<p>Same identity normalization and <code>#CTSREQUEST#</code> / <code>#&hellip;#</code> placeholder exclusion as <code>executive_dashboard_failed_logon_count</code>. Hourly <code>dc(identity)</code> with baseline and window <code>total_count</code>.</p>",
        "<p>Identity is normalized to a lowercase, trimmed value from whichever user field the source populates, with the domain prefix stripped from Windows accounts by <code>rex</code> in <code>sed</code> mode. Empty values, <code>-</code>, <code>n/a</code>, <code>anonymous</code> and <code>#CTSREQUEST#</code> / <code>#&hellip;#</code> placeholders are excluded so a placeholder cannot register as a failing account. <code>timechart bins=200 dc(identity)</code> then plots failures, with <code>eventstats</code> supplying the average as <code>baseline</code> and the window-wide <code>total_count</code>.</p>",
        "referenced twin stanza does not exist; state the normalization directly",
    ),
]
