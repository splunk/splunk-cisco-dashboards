"""R11: prose naming a field the SPL does not read.

These stanzas tell the reader the search groups by, collapses on, or ranks by
a named field, and the SPL uses a different name. Most are leftovers from a
rename that never reached the prose: the Catalyst panels moved from raw
`cisco:dnac:devicehealth` events keyed on `DeviceID` to the
`Cisco_Catalyst_Device_Health_Events` dataset keyed on
`device_health_ip_address`, and the Spaces firehose path gained a `device`
level. The SPL is what runs, so the SPL wins and the sentence changes.

Two of these are not renames but claims about a step that is not in the
pipeline at all -- a lookup into `asset_inventory`, a `coalesce` over
`src`/`src_ip`. Naming the real mechanism is the correction; deleting the
sentence would drop the reason a reader wanted it.

Scope note: R11 reports 33 findings and most are not defects. <code> marks
anything monospace, so the rule also catches field *values* (Intersight
`PortPolicies`, Meraki `wirelessController`, vManage `no_data`), React
components (`CustomerTopologyMap`), modular-input scripts, stanza
cross-references, and fields belonging to a different product that the prose
names as a follow-on (ISE `EndPointMACAddress`). None of those assert that
this search reads a field, so none are here.

`it_critical_systems_ds_ap_by_location` is a real R11 defect and is
deliberately absent: pipeline_claims.py already rewrites that clause.

Each correction changes the field name and the words that have to move with
it, and nothing else. Where the same sentence also misnames a command, that
is a pipeline claim and belongs to another module.
"""

from __future__ import annotations

CORRECTIONS = [
    (
        "it_critical_systems_network_health_score",
        "explanation",
        "latest(healthScore) as score",
        "latest(network_health_score) as score",
        "the dataset field is network_health_score; healthScore is the raw TA name",
    ),
    (
        "it_critical_systems_network_health_score",
        "explanation",
        "the newest <code>healthScore</code>",
        "the newest <code>network_health_score</code>",
        "the dataset field is network_health_score; healthScore is the raw TA name",
    ),
    (
        "security_resilience_repeated_blocked_sources",
        "related_info",
        "<b>coalesce for source IPs</b><br>Firewall families use <code>src</code>"
        " or <code>src_ip</code>; coalesce keeps one key.",
        "<b>CIM-normalized source IPs</b><br>Firewall families emit <code>src</code>"
        " or <code>src_ip</code>; this search reads <code>All_Traffic.src</code>"
        " from the <code>Network_Traffic</code> model rather than coalescing the"
        " raw fields itself.",
        "the SPL groups by All_Traffic.src and has no coalesce; src_ip is a"
        " source-event field the model already normalizes",
    ),
    (
        "it_critical_systems_device_health_enriched",
        "explanation",
        "Lowercased names join <code>asset_inventory</code> to append"
        " <code>device_type</code>, <code>location</code>, serial, software,"
        " and compliance.",
        "The same dataset carries <code>device_type</code>, <code>location</code>,"
        " serial number, and software version, so those columns come from the data"
        " model rather than an inventory lookup.",
        "the SPL has no lookup; device_type, location, serial_number and"
        " software_version all come from the device health dataset, and no"
        " compliance field is returned",
    ),
    (
        "executive_summary_network_health_by_site",
        "explanation",
        "per <code>DeviceID</code> and <code>Site</code> collapses",
        "per <code>device_health_ip_address</code> collapses",
        "the SPL splits BY device_health_ip_address; Site is pulled with latest(),"
        " not used as a grouping key",
    ),
    (
        "building_resilience_ds_spaces_kpi_devices",
        "explanation",
        "dc(deviceLocationUpdate.deviceMacAddress)",
        "dc(deviceLocationUpdate.device.macAddress)",
        "the SPL counts deviceLocationUpdate.device.macAddress; this stanza's own"
        " related_info already says the shorthand path does not exist",
    ),
    (
        "executive_dashboard_ds_device_health_current_drilldown",
        "description",
        "One row per <code>DeviceID</code> with the latest",
        "One row per device, keyed on <code>device_health_ip_address</code>,"
        " with the latest",
        "the SPL splits BY device_health_ip_address, so the management IP is the"
        " per-device key",
    ),
    (
        "security_microseg_tetration_top_scopes_by_alert",
        "explanation",
        "<code>severity_rank</code>",
        "<code>sev_rank</code>",
        "the eval creates sev_rank; severity_rank appears nowhere in the SPL",
    ),
]
