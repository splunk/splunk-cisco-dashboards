# Sourcetype SPL Audit

**Generated:** `2026-05-09T14:28:14-0400`  **Inventory window:** `-7d` &rarr; `now`  **Inventory generated:** `2026-05-09T04:59:40-0400`

Per-stanza audit of `searchbase.conf` against the discovered field inventory in `sourcetype_field_inventory.json`. A finding means the stanza references a field that is **not** in the discovered field set for any of its sourcetypes, **and** is not a Splunk built-in, a `field_list`-suppressed field, a well-known CIM alias, or synthesized earlier in the same SPL (`eval`, `rename ... as`, `stats ... as`, `lookup ... OUTPUT`, `rex (?<name>...)`).

**Heuristic scope (intentionally narrow):**

- Only fields referenced via `stats|eventstats|streamstats|chart|timechart|tstats <fn>(<field>)`, `... by <field>`, `rename <field> as ...`, or `dedup <field>...` are inspected. Field references inside `eval` / `where` expressions are skipped (parsing them reliably needs a real SPL grammar).
- Stanzas whose sourcetypes returned `empty` / `fail` in the inventory are skipped - we have no ground truth to compare to.
- Pure `| makeresults` stanzas (no sourcetype query) are skipped - they invent their fields by definition.
- CIM data model references (`All_Traffic.dvc`, `Authentication.action`, etc.) are auto-suppressed. They can only be validated against an accelerated data model, not against raw event fields.
- Standard CIM field aliases (`dest_port`, `src_ip`, `Country`, etc.) are auto-suppressed. They are populated by TA `props.conf` field aliases at search-time, so the discovery search does not see them in raw events.

## Summary

| Metric | Count |
|---|---:|
| Stanzas inspected |  284 |
| Stanzas skipped (no sourcetype) |  102 |
| Stanzas skipped (makeresults / synthetic) |    9 |
| Stanzas skipped (no inventory data) |   23 |
| **Stanzas flagged** | **   9** |

## High-confidence findings

All of this stanza's sourcetypes returned data in the inventory, so we have a complete comparison set. Treat these as actionable candidates for a typo / wrong-field bug.

| # | Stanza | Sourcetype(s) | Suspicious fields |
|---:|---|---|---|
| 1 | `[audit_logs_by_site_lookup_join]` (line 10443) | `cisco:dnac:audit:logs` | `network.deviceId`, `network.siteId` |
| 2 | `[executive_dashboard_issue_summary_kpis]` (line 527) | `cisco:dnac:issue` | `SiteName` |
| 3 | `[executive_summary_issue_details]` (line 4443) | `cisco:dnac:issue` | `SiteName` |
| 4 | `[it_critical_systems_aaa_server_issues]` (line 3556) | `cisco:dnac:issue` | `SiteName` |
| 5 | `[it_critical_systems_ap_disconnect_issues]` (line 3534) | `cisco:dnac:issue` | `SiteName`, `SiteNameHierarchy` |
| 6 | `[it_critical_systems_bgp_neighbor_issues]` (line 3512) | `cisco:dnac:issue` | `SiteName` |
| 7 | `[it_critical_systems_interface_utilization_issues]` (line 3490) | `cisco:dnac:issue` | `SiteName` |
| 8 | `[it_critical_systems_issues_by_site]` (line 3600) | `cisco:dnac:issue` | `SiteName` |

## Partial-confidence findings

At least one of this stanza's sourcetypes had **no data** in the inventory (status `empty` or `fail`), so the comparison set is incomplete - the flagged field might legitimately come from one of the empty/missing sourcetypes. Re-run the audit on a stack that has data for all of them before treating these as bugs.

| # | Stanza | Sourcetype(s) | Suspicious fields |
|---:|---|---|---|
| 1 | `[asset_inventory_build_lookup]` (line 6652) | `ActiveDirectory`, `DhcpSrvLog`, `MSAD:NT6:DNS`, `cisco:dnac:compliance`, `cisco:dnac:devicehealth`, `cisco:ios`, `cisco:ise:syslog`, `f5:bigip:management:device:icontrol`, `meraki:devicesavailabilitieschangehistory` | `hostname`, `managementIp`, `marketingName`, `platform`, `version` |

## Per-stanza detail

### `[audit_logs_by_site_lookup_join]` (line 10443) &mdash; *high confidence*

- **Sourcetypes:** `cisco:dnac:audit:logs`
- **References (high-signal positions only):** `Site`, `_time`, `address`, `category`, `deviceId`, `network.deviceId`, `network.siteId`, `severity`, `siteNodeName`, `siteNodeType`, `userId`
- **Pipeline-synthesized:** `Site`, `address`, `categories`, `deviceId`, `devicesAffected`, `lastEventTime`, `name`, `severities`, `siteFromPath`, `siteFromUuid`, `siteId`, `siteNodeName`, `siteNodeType`, `siteNodeTypes`, `siteNodes`, `type`, `uniqueUsers`

**Suspicious fields:**

- `network.deviceId` &mdash; not present in any of this stanza's sourcetypes.
- `network.siteId` &mdash; not present in any of this stanza's sourcetypes.

### `[executive_dashboard_issue_summary_kpis]` (line 527) &mdash; *high confidence*

- **Sourcetypes:** `cisco:dnac:issue`
- **References (high-signal positions only):** `DeviceName`, `IssueID`, `SiteName`
- **Pipeline-synthesized:** `affected_devices`, `affected_sites`, `critical`, `high`, `total`

**Suspicious fields:**

- `SiteName` &mdash; not present in any of this stanza's sourcetypes.

### `[executive_summary_issue_details]` (line 4443) &mdash; *high confidence*

- **Sourcetypes:** `cisco:dnac:issue`
- **References (high-signal positions only):** `DeviceName`, `Explanation`, `IssueID`, `IssueName`, `IssueSpecificDescription`, `IssueSpecificPriority`, `IssueSpecificSummary`, `SiteName`
- **Pipeline-synthesized:** `Count`, `Description`, `Devices`, `Explanation`, `Issue`, `Priority`, `Sites`, `Summary`, `Why`

**Suspicious fields:**

- `SiteName` &mdash; not present in any of this stanza's sourcetypes.

### `[it_critical_systems_aaa_server_issues]` (line 3556) &mdash; *high confidence*

- **Sourcetypes:** `cisco:dnac:issue`
- **References (high-signal positions only):** `DeviceFamily`, `DeviceIpAddress`, `DeviceName`, `IssueID`, `IssueSpecificDescription`, `IssueSpecificEntity`, `IssueSpecificSeverity`, `IssueStatus`, `SiteName`
- **Pipeline-synthesized:** `Device`, `Family`, `IP`, `Site`, `aaa_server`, `description`, `issue_count`, `severity`, `status`

**Suspicious fields:**

- `SiteName` &mdash; not present in any of this stanza's sourcetypes.

### `[it_critical_systems_ap_disconnect_issues]` (line 3534) &mdash; *high confidence*

- **Sourcetypes:** `cisco:dnac:issue`
- **References (high-signal positions only):** `DeviceFamily`, `DeviceIpAddress`, `DeviceName`, `IssueID`, `IssueSpecificDescription`, `IssueSpecificSeverity`, `SiteName`, `SiteNameHierarchy`
- **Pipeline-synthesized:** `AP`, `IP`, `Site`, `description`, `disconnect_count`, `family`, `severity`

**Suspicious fields:**

- `SiteName` &mdash; not present in any of this stanza's sourcetypes.
- `SiteNameHierarchy` &mdash; not present in any of this stanza's sourcetypes.

### `[it_critical_systems_bgp_neighbor_issues]` (line 3512) &mdash; *high confidence*

- **Sourcetypes:** `cisco:dnac:issue`
- **References (high-signal positions only):** `DeviceFamily`, `DeviceIpAddress`, `DeviceName`, `IssueID`, `IssueSpecificDescription`, `IssueSpecificEntity`, `IssueSpecificSeverity`, `SiteName`
- **Pipeline-synthesized:** `Device`, `Family`, `IP`, `Site`, `description`, `flap_count`, `neighbor`, `severity`

**Suspicious fields:**

- `SiteName` &mdash; not present in any of this stanza's sourcetypes.

### `[it_critical_systems_interface_utilization_issues]` (line 3490) &mdash; *high confidence*

- **Sourcetypes:** `cisco:dnac:issue`
- **References (high-signal positions only):** `DeviceFamily`, `DeviceImageVersion`, `DeviceIpAddress`, `DeviceName`, `DevicePlatform`, `IssueID`, `IssueSpecificEntity`, `IssueSpecificSeverity`, `SiteName`
- **Pipeline-synthesized:** `Device`, `Family`, `IP`, `Platform`, `Site`, `affected_interfaces`, `issue_count`, `severity`, `sw_version`

**Suspicious fields:**

- `SiteName` &mdash; not present in any of this stanza's sourcetypes.

### `[it_critical_systems_issues_by_site]` (line 3600) &mdash; *high confidence*

- **Sourcetypes:** `cisco:dnac:issue`
- **References (high-signal positions only):** `DeviceName`, `IssueID`, `IssueSpecificCategory`, `SiteName`
- **Pipeline-synthesized:** `Site`, `affected_devices`, `categories`, `critical_high`, `total_issues`

**Suspicious fields:**

- `SiteName` &mdash; not present in any of this stanza's sourcetypes.

### `[asset_inventory_build_lookup]` (line 6652) &mdash; *partial confidence*

- **Sourcetypes:** `ActiveDirectory`, `DhcpSrvLog`, `MSAD:NT6:DNS`, `cisco:dnac:compliance`, `cisco:dnac:devicehealth`, `cisco:ios`, `cisco:ise:syslog`, `f5:bigip:management:device:icontrol`, `meraki:devicesavailabilitieschangehistory`
- **No inventory data for:** `f5:bigip:management:device:icontrol` &mdash; the flagged field may be supplied by one of these.
- **References (high-signal positions only):** `ComplianceStatus`, `DeviceFamily`, `DeviceName`, `DeviceRole`, `DeviceSeries`, `DeviceType`, `ImageVersion`, `IpAddress`, `MACAddress`, `Manageability`, `Platform`, `Reachability`, `SerialNumber`, `Site`, `_time`, `compliance_status`, `device.model`, `device.name`, `device.productType`, `device.serial`, `device_family`, `device_name`, `device_role`, `device_series`, `device_type`, `device_type_raw`, `health_score`, `host`, `hostname`, `ip_address`, `last_seen`, `location`, `mac_address`, `managementIp`, `management_source`, `marketingName`, `name`, `network.name`, `platform`, `platform_id`, `serial_number`, `software_version`, `version`
- **Pipeline-synthesized:** `_time`, `all_sources`, `compliance_status`, `device_family`, `device_name`, `device_name_short`, `device_role`, `device_series`, `device_type`, `device_type_raw`, `health_score`, `ip_address`, `last_seen`, `location`, `mac_address`, `manageability`, `management_source`, `meraki_type`, `platform_id`, `reachability`, `serial_number`, `software_version`, `source_priority`

**Suspicious fields:**

- `hostname` &mdash; not present in any of this stanza's sourcetypes.
- `managementIp` &mdash; not present in any of this stanza's sourcetypes.
- `marketingName` &mdash; not present in any of this stanza's sourcetypes.
- `platform` &mdash; not present in any of this stanza's sourcetypes.
- `version` &mdash; not present in any of this stanza's sourcetypes.

