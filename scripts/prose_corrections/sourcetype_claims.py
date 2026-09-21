"""R1: prose telling the reader the search reads a source type it never reads.

Almost every case has the same history. The stanza began life as a raw-event
search over an `index_*` macro and a named sourcetype, the prose described
that pipeline accurately, and the SPL was later rewritten as a `tstats`
search over an accelerated data model. The SPL moved; the sentence did not.
The result sends a reader to a sourcetype the search never touches, which is
the worst kind of wrong: it is specific, so it gets believed, and it survives
a skim because the sourcetype really does exist.

The fix names the dataset and model the search actually queries, because that
is what a reader needs in order to check the acceleration, find the field
names, or work out why a panel came back empty. Everything else in the
sentence is left alone -- the aggregation, the guards, and the reasoning
around them were correct before and stay correct now.

Two things are deliberately NOT treated as defects, and so are absent here:

  * Lineage. "the issue endpoints that feed <code>cisco:dnac:issue</code> and
    this data model dataset" tells a reader where the model's rows come from.
    On a data-model search that is true and useful, not a contradiction.
  * Contrast and history. "distinct from the <code>cisco:dc:nd:syslog</code>
    stream the platform panels read" and "replaces the demo-only
    <code>http:DNAC_EVENT</code> source" name a sourcetype in order to rule it
    out. Rewriting either would delete the point of the sentence.

One replacement keeps a lineage mention: the firewall KPI already listed its
three vendor sourcetypes in its own voice, and those add-ons are what fill
the Network_Traffic model the tile reads, so the list stays and only the
claim that the search reads them directly goes.
"""

from __future__ import annotations

CATALYST = "<code>datamodel=Cisco_Catalyst_App</code>"

CORRECTIONS = [
    (
        "executive_dashboard_firewall_blocked_count",
        "explanation",
        "The base search applies <code>index_firewall</code> across three "
        "sourcetypes&mdash;<code>cisco:asa</code>, <code>cisco:ftd</code>, and "
        "<code>cisco:sfw:estreamer</code>&mdash;and keeps rows whose "
        "<code>action</code> (or raw text) indicates a deny path via a broad OR "
        "of <code>blocked</code>, <code>Block</code>, <code>Deny</code>, and "
        "literal <code>&quot;denied&quot;</code> tokens to absorb vendor "
        "spelling differences.",
        "The base search runs <code>tstats</code> against "
        "<code>datamodel=Network_Traffic</code> at "
        "<code>nodename=All_Traffic.Traffic_By_Action.Blocked_Traffic</code>, so "
        "CIM tagging decides what counts as a deny rather than a raw-text match "
        "on vendor spellings &mdash; firewall sourcetypes such as "
        "<code>cisco:asa</code>, <code>cisco:ftd</code>, and "
        "<code>cisco:sfw:estreamer</code> reach this tile only once their "
        "add-ons map them into that model.",
        "SPL is a Network_Traffic tstats search and reads no sourcetype directly",
    ),
    (
        "it_critical_systems_compliance_rate",
        "explanation",
        "Each indexed <code>cisco:dnac:compliance</code> row represents a check "
        "outcome.",
        "Each row in the <code>Cisco_Catalyst_Device_Compliance_Events</code> "
        f"dataset of {CATALYST} represents a check outcome.",
        "SPL reads the compliance events dataset, not the compliance sourcetype",
    ),
    (
        "it_critical_systems_compliance_report_rate",
        "explanation",
        "The search reads <code>cisco:catalyst:center:compliance:report</code>, "
        "drops rows",
        "The search reads the "
        "<code>Cisco_Catalyst_Center_Compliance_Report</code> dataset of "
        f"{CATALYST}, drops rows",
        "SPL reads the compliance report dataset, not the report sourcetype",
    ),
    (
        "user_experience_client_health_trend",
        "explanation",
        "Starting from <code>cisco:dnac:clienthealth</code> on "
        "<code>`index_catalyst`</code>, the search keeps",
        "Starting from the "
        "<code>Cisco_Catalyst_Client_Inventory_And_Health_Score_Events</code> "
        f"dataset of {CATALYST}, the search keeps",
        "SPL is a tstats search over the client health dataset, not raw events",
    ),
    (
        "user_experience_wired_client_health",
        "explanation",
        "The search filters <code>cisco:dnac:clienthealth</code> to",
        "The search filters the "
        "<code>Cisco_Catalyst_Client_Inventory_And_Health_Score_Events</code> "
        f"dataset of {CATALYST} to",
        "SPL is a tstats search over the client health dataset, not raw events",
    ),
    (
        "user_experience_wireless_client_health",
        "explanation",
        "on <code>cisco:dnac:clienthealth</code>.",
        "on the "
        "<code>Cisco_Catalyst_Client_Inventory_And_Health_Score_Events</code> "
        f"dataset of {CATALYST}.",
        "SPL is a tstats search over the client health dataset, not raw events",
    ),
    (
        "it_critical_systems_issue_trend",
        "explanation",
        "Every <code>cisco:dnac:issue</code> row passes through",
        "Every <code>Cisco_Catalyst_Active_Issue_Events</code> row returned from "
        f"{CATALYST} passes through",
        "SPL is a tstats search over the active issue dataset, not raw events",
    ),
    (
        "executive_summary_client_health_by_site",
        "explanation",
        "Filters <code>cisco:dnac:clienthealth</code> to",
        "Filters <code>cisco:dnac:client</code> and "
        "<code>cisco:catalyst:client</code> to",
        "SPL reads the client sourcetypes; the clienthealth sourcetype is absent",
    ),
    (
        "it_critical_systems_ds_ap_by_location",
        "explanation",
        "The query uses <code>index_catalyst</code> over "
        "<code>cisco:dnac:devicehealth</code>, retaining only AP families.",
        "The query runs <code>tstats</code> over the "
        "<code>Cisco_Catalyst_Device_Health_Events</code> dataset of "
        f"{CATALYST}, retaining only AP families.",
        "SPL is a tstats search over the device health dataset, not raw events",
    ),
    (
        "it_critical_systems_ds_base_devicehealth",
        "explanation",
        "The query runs on <code>index_catalyst</code> with "
        "<code>cisco:dnac:devicehealth</code>.",
        "The query runs <code>tstats</code> over the "
        "<code>Cisco_Catalyst_Device_Health_Events</code> dataset of "
        f"{CATALYST}.",
        "SPL is a tstats search over the device health dataset, not raw events",
    ),
    (
        "shared_ds_dev_health_trend",
        "explanation",
        "Reads <code>cisco:dnac:devicehealth</code>, scores each device",
        "Reads the <code>Cisco_Catalyst_Device_Health_Events</code> dataset of "
        f"{CATALYST}, scores each device",
        "SPL is a tstats search over the device health dataset, not raw events",
    ),
    (
        "overview_site_state_drilldown",
        "explanation",
        "Reads <code>cisco:dnac:devicehealth</code>, normalizes sites",
        "Reads the <code>Cisco_Catalyst_Device_Health_Events</code> dataset of "
        f"{CATALYST}, normalizes sites",
        "SPL is a tstats search over the device health dataset, not raw events",
    ),
    (
        "monitoring_sdwan_tunnel_kpi_total",
        "explanation",
        "Pulls the latest poll per tunnel <code>name</code> from "
        "<code>cisco:sdwan:tunnelhealth</code> within the dashboard window and "
        "counts distinct names.",
        "Counts distinct tunnel names in the "
        "<code>Cisco_Catalyst_SDWAN_Tunnel_Health</code> dataset of "
        f"{CATALYST} within the dashboard window.",
        "SPL is a tstats search over the SD-WAN tunnel health dataset",
    ),
    (
        "overview_operational_lead",
        "explanation",
        "manageability from <code>cisco:dnac:devicehealth</code>, scores each "
        "device",
        "manageability from the "
        "<code>Cisco_Catalyst_Device_Health_Events</code> dataset of "
        f"{CATALYST}, scores each device",
        "SPL is a tstats search over the device health dataset, not raw events",
    ),
]
