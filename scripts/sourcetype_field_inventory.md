# Sourcetype Field Inventory

**Generated:** `2026-05-09T04:59:40-0400`  **Window:** `-7d` → `now`  **Sample:** `head 10000` per sourcetype

Authoritative field set for every sourcetype referenced in `searchbase.conf`, discovered live via Splunk's `field_list` macro. Use this as ground truth when reviewing SPL — any field referenced by a stanza that isn't in the matching sourcetype's table below is suspect.

## Summary

| Status | Count | Meaning |
|---|---:|---|
| `pass`    |  33 | Returned at least one field. |
| `empty`   |  11 | Sourcetype has no events in the time window. |
| `fail`    |   0 | Search errored — see note. |
| `skipped` |   0 | Excluded by filter. |

## Sourcetypes by Stanza Count

| Sourcetype | Stanzas | Status | Field Count |
|---|---:|---|---:|
| `cisco:dnac:devicehealth` | 57 | `pass` | 65 |
| `cisco:ios` | 37 | `pass` | 111 |
| `cisco:dnac:client` | 35 | `pass` | 114 |
| `cisco:asa` | 28 | `pass` | 8 |
| `cisco:dnac:clienthealth` | 25 | `pass` | 11 |
| `cisco:spaces:firehose` | 24 | `pass` | 408 |
| `cisco:ftd` | 23 | `empty` | 0 |
| `cisco:ise:syslog` | 22 | `pass` | 587 |
| `cisco:dnac:issue` | 21 | `pass` | 40 |
| `cisco:sfw:estreamer` | 21 | `pass` | 147 |
| `cisco:dnac:compliance` | 11 | `pass` | 30 |
| `cisco:dnac:networkhealth` | 11 | `pass` | 18 |
| `DhcpSrvLog` | 10 | `pass` | 38 |
| `meraki:sensorreadingshistory` | 9 | `empty` | 0 |
| `cisco:xdr:incidents` | 8 | `pass` | 43 |
| `cisco:xdr:incidents-summary` | 8 | `pass` | 121 |
| `meraki:devicesuplinkslossandlatency` | 6 | `empty` | 0 |
| `cisco:cloud_security:dns` | 5 | `empty` | 0 |
| `cisco:dnac:audit:logs` | 5 | `pass` | 48 |
| `ActiveDirectory` | 4 | `pass` | 107 |
| `cisco:dnac:securityadvisory` | 4 | `pass` | 34 |
| `cisco:sdwan:linkhealth` | 4 | `pass` | 61 |
| `thousandeyes:alerts` | 4 | `empty` | 0 |
| `MSAD:NT6:DNS` | 3 | `pass` | 40 |
| `cisco:catalyst:center:compliance:report` | 3 | `pass` | 34 |
| `cisco:catalyst:center:inventory:report` | 3 | `pass` | 31 |
| `cisco:cloud_security:firewall` | 3 | `pass` | 29 |
| `cisco:dnac:site:topology` | 3 | `pass` | 44 |
| `cisco:esa:amp` | 3 | `pass` | 16 |
| `cisco:esa:antispam` | 3 | `pass` | 13 |
| `cisco:esa:content_scanner` | 3 | `pass` | 2 |
| `cisco:estreamer:data` | 3 | `pass` | 17 |
| `cisco:firepower:syslog` | 3 | `empty` | 0 |
| `cisco:sdwan:utd:logs` | 2 | `pass` | 25 |
| `cisco:wsa:l4tm` | 2 | `pass` | 1 |
| `cisco:wsa:squid` | 2 | `pass` | 97 |
| `ms:defender:endpoint:alerts` | 2 | `empty` | 0 |
| `cisco:estreamer:log` | 1 | `pass` | 2 |
| `cisco:estreamer:status` | 1 | `empty` | 0 |
| `f5:bigip:management:device:icontrol` | 1 | `empty` | 0 |
| `meraki:audit` | 1 | `pass` | 11 |
| `meraki:devicesavailabilitieschangehistory` | 1 | `pass` | 16 |
| `oncall:incidents` | 1 | `empty` | 0 |
| `thousandeyes:traces` | 1 | `empty` | 0 |

## Per-Sourcetype Field Lists

### `ActiveDirectory`

- **Status:** `pass`  **Field count:** 107  **Stanzas referencing:** 4  **Latency:** 4674 ms

**Discovered fields**

```
CN, DC, LinkId
OU, accountExpires, adminCount
admonEventType, appSchemaVersion, badPasswordTime
badPwdCount, c, cOMClassID
cn, codePage, countryCode
dNSHostName, dSCorePropagationData, dc
dcName, department, description
displayName, distinguishedName, employeeID
extensionName, flags, gPCFileSysPath
gPCFunctionalityVersion, gPCMachineExtensionNames, gPLink
givenName, groupType, guid_lookup
homePhone, info, initials
installUiLevel, instanceType, isCriticalSystemObject
isDeleted, isRecycled, l
lastKnownParent, lastLogoff, lastLogon
lastLogonTimestamp, lastUpdateSequence, localPolicyFlags
localeID, location, lockoutTime
logonCount, logonHours, machineArchitecture
mail, managedBy, managedObjects
member, memberOf, msDFSR_ComputerReferenceBL
msDS_AzLDAPQuery, msDS_GenerationId, msDS_SupportedEncryptionTypes
msiFileList, msiScriptName, msiScriptPath
name, objectCategory, objectClass
objectGUID, objectSid, operatingSystem
operatingSystemVersion, ou, packageFlags
packageName, packageType, physicalDeliveryOfficeName
postalCode, primaryGroupID, productCode
pwdLastSet, rIDSetReferences, revision
sAMAccountName, sAMAccountType, serverReferenceBL
servicePrincipalName, showInAdvancedViewOnly, sid_lookup
sn, st, street
streetAddress, systemFlags, title
uSNChanged, uSNCreated, upgradeProductCode
userAccountControl, userAccountPropertyFlag, userPrincipalName
versionNumber, versionNumberHi, versionNumberLo
whenChanged, whenCreated
```

**Stanzas using this sourcetype**

- `[admin_macro_index_tuning]` (line 5313)
- `[asset_inventory_build_lookup]` (line 6652)
- `[asset_inventory_ds_gap_analysis]` (line 6733)
- `[executive_dashboard_data_status_pipeline]` (line 7372)

### `DhcpSrvLog`

- **Status:** `pass`  **Field count:** 38  **Stanzas referencing:** 10  **Latency:** 3035 ms

**Discovered fields**

```
Mfg, Mod, Ser
Typ, action, correlation_id
date, description, dest
dest_dns, dest_ip, dest_mac
dest_nt_host, dhc_id, dns_reg_error
ip, mac, msdhcp_id
msdhcp_user, nt_host, probation_time
product, qresult, quarantine_info
raw_mac, reason, relay_agent_information
signature, signature_id, time
transaction_id, user, userclass_ascii
userclass_hex, vendor, vendor_product
vendorclass_ascii, vendorclass_hex
```

**Stanzas using this sourcetype**

- `[admin_macro_index_tuning]` (line 5313)
- `[asset_inventory_build_lookup]` (line 6652)
- `[asset_inventory_ds_gap_analysis]` (line 6733)
- `[executive_dashboard_data_status_pipeline]` (line 7372)
- `[it_critical_systems_dhcp_lease_rate]` (line 3300)
- `[it_critical_systems_dhcp_nack_trend]` (line 3324)
- `[it_critical_systems_dhcp_pool_exhaustion]` (line 3276)
- `[it_critical_systems_dhcp_scope_utilization]` (line 3347)
- `[it_critical_systems_ds_dhcp_pool_exhaustion]` (line 8123)
- `[it_critical_systems_ds_dhcp_scope_utilization]` (line 8148)

### `MSAD:NT6:DNS`

- **Status:** `pass`  **Field count:** 40  **Stanzas referencing:** 3  **Latency:** 4448 ms

**Discovered fields**

```
ANSWER_OR_UPDATE_SECTION, Message, action
additional_answer_count, answer, answer_count
authority_answer_count, context, dest
direction, flags, hexflags
message_type, name, opcode
operation, packetid, protocol
query, query_count, query_type
questionname, questiontype, record_class
record_class_number, record_type, reply_code
reply_code_id, response, src
src_domain, src_ip, src_port
threadid, transaction_id, transport
vendor_dns_action, vendor_product, vendor_query_type
xid
```

**Stanzas using this sourcetype**

- `[asset_inventory_build_lookup]` (line 6652)
- `[asset_inventory_ds_gap_analysis]` (line 6733)
- `[security_resilience_ds_base_dns]` (line 8616)

### `cisco:asa`

- **Status:** `pass`  **Field count:** 8  **Stanzas referencing:** 28  **Latency:** 2793 ms

**Discovered fields**

```
Group, IP, SPI
Username, acl, msgid
signature_id, user
```

**Stanzas using this sourcetype**

- `[admin_macro_index_tuning]` (line 5313)
- `[asset_inventory_firewall_gap]` (line 4387)
- `[escu_alert_asa_logging_disabled]` (line 7180)
- `[escu_alert_asa_privilege_escalation]` (line 7203)
- `[escu_alert_asa_recon_commands]` (line 7227)
- `[escu_alert_fw_compromised_host_indicators]` (line 7251)
- `[escu_alert_fw_repeated_blocked_connections]` (line 7276)
- `[executive_dashboard_data_status_pipeline]` (line 7372)
- `[executive_dashboard_firewall_blocked_count]` (line 785)
- `[executive_dashboard_fw_blocked_trend_compare]` (line 2921)
- `[network_intelligence_blocked_vs_allowed]` (line 3008)
- `[network_intelligence_external_sources]` (line 3052)
- `[network_intelligence_geo_blocked_traffic]` (line 3099)
- `[network_intelligence_top_blocked_ports]` (line 3170)
- `[network_intelligence_top_countries_blocked]` (line 3122)
- `[network_intelligence_top_talkers]` (line 3146)
- `[network_intelligence_traffic_by_action_trend]` (line 3029)
- `[network_intelligence_traffic_by_protocol]` (line 3077)
- `[network_intelligence_traffic_volume_trend]` (line 3195)
- `[security_resilience_assets_at_risk]` (line 3220)
- `[security_resilience_data_exfiltration_indicators]` (line 2683)
- `[security_resilience_ds_base_fw]` (line 8634)
- `[security_resilience_ds_security_events]` (line 9108)
- `[security_resilience_firewall_allowed_count]` (line 1849)
- `[security_resilience_recent_security_events]` (line 2240)
- `[security_resilience_repeated_blocked_sources]` (line 2633)
- `[security_resilience_ssh_activity]` (line 2658)
- `[security_resilience_vpn_session_detail]` (line 2289)

### `cisco:catalyst:center:compliance:report`

- **Status:** `pass`  **Field count:** 34  **Stanzas referencing:** 3  **Latency:** 2868 ms

**Discovered fields**

```
cisco_catalyst_host, collection_timestamp, complianceMessage
complianceStatus, complianceTypeBreakdown{}.complianceType, complianceTypeBreakdown{}.lastSyncTime
complianceTypeBreakdown{}.status, deviceFamily, deviceName
deviceSeries, deviceType, deviceUuid
failCount, ipAddress, issuesDetected{}.complianceType
issuesDetected{}.detectedAt, issuesDetected{}.reason, issuesDetected{}.severity
lastSyncTime, lastUpdateTime, macAddress
passCount, reachabilityStatus, report_name
report_type, role, serialNumber
signature_id, siteHierarchy, softwareType
softwareVersion, timestamp, totalChecks
vendor_product
```

**Stanzas using this sourcetype**

- `[it_critical_systems_compliance_report_noncompliant_detail]` (line 1346)
- `[it_critical_systems_compliance_report_rate]` (line 1298)
- `[it_critical_systems_compliance_report_status_distribution]` (line 1323)

### `cisco:catalyst:center:inventory:report`

- **Status:** `pass`  **Field count:** 31  **Stanzas referencing:** 3  **Latency:** 2814 ms

**Discovered fields**

```
AP Floor, Description, Device Family
Device Name, Device Series, Device Type
Hostname, IP Address, Image Version
Last Sync Time, MAC Address, Manageability Status
Platform, Reachability Status, Role
Role Source, Serial Number, Site Hierarchy
Software Type, Software Version, Tags
Type, Up Time, Wlc Ip Address
cisco_catalyst_host, collection_timestamp, report_name
report_type, signature_id, timestamp
vendor_product
```

**Stanzas using this sourcetype**

- `[it_critical_systems_inventory_device_family_distribution]` (line 1275)
- `[it_critical_systems_inventory_reachability_summary]` (line 1228)
- `[it_critical_systems_inventory_unreachable_detail]` (line 1252)

### `cisco:cloud_security:dns`

- **Status:** `empty`  **Field count:** 0  **Stanzas referencing:** 5  **Latency:** 2639 ms
- **Note:** no events in -7d..now

**Stanzas using this sourcetype**

- `[security_resilience_dns_blocked_categories]` (line 1697)
- `[security_resilience_dns_blocked_queries]` (line 1675)
- `[security_resilience_ds_dns_categories]` (line 8652)
- `[security_resilience_ds_security_events]` (line 9108)
- `[security_resilience_recent_security_events]` (line 2240)

### `cisco:cloud_security:firewall`

- **Status:** `pass`  **Field count:** 29  **Stanzas referencing:** 3  **Latency:** 2762 ms

**Discovered fields**

```
action, appCategory, applicationName
destinationCategories{}, direction, dstIp
dstPort, externalIp, identityNames{}
internalIp, isoTimestamp, networkName
packetSize, policyName, protocol
ruleDescription, ruleId, ruleName
signature_id, sourceTunnel, sourceTunnelId
srcIp, srcPort, timestamp
totalBytes, trafficSourceType, trafficType
tunnelType, verdict
```

**Stanzas using this sourcetype**

- `[security_resilience_cloud_fw_blocked]` (line 1761)
- `[security_resilience_ds_security_events]` (line 9108)
- `[security_resilience_recent_security_events]` (line 2240)

### `cisco:dnac:audit:logs`

- **Status:** `pass`  **Field count:** 48  **Stanzas referencing:** 5  **Latency:** 2656 ms

**Discovered fields**

```
additionalDetails.eventMetadata.auditLogMetadata.type, additionalDetails.eventMetadata.auditLogMetadata.version, category
childCount, ciscoDnaEventLink, context
correlationId, description, details.authSource
details.requestPayload, details.requestPayloadDescriptor, dnacIP
domain, efInstanceId, eventHierarchy
eventHierarchy.hierarchy, eventHierarchy.hierarchyDelimiter, eventId
eventSize, i18n, i18n.messageKey
instanceId, isACKnowledgeable, isDeprecated
isPrivateEvent, isSimulated, message
messageParams, name, namespace
network, network.deviceId, network.siteId
note, parentInstanceId, payloadSize
severity, signature_id, src
startTime, subDomain, tenantId
timestamp, tntId, type
userId, vendor_product, version
```

**Stanzas using this sourcetype**

- `[audit_logs_by_site_lookup_join]` (line 10375)
- `[it_critical_systems_configuration_change_trend]` (line 1203)
- `[it_critical_systems_configuration_changes]` (line 1182)
- `[security_resilience_ds_security_events]` (line 9108)
- `[security_resilience_recent_security_events]` (line 2240)

### `cisco:dnac:client`

- **Status:** `pass`  **Field count:** 114  **Stanzas referencing:** 35  **Latency:** 3124 ms

**Discovered fields**

```
cisco_catalyst_host, connectedNetworkDevice.connectedNetworkDeviceId, connectedNetworkDevice.connectedNetworkDeviceMac
connectedNetworkDevice.connectedNetworkDeviceManagementIp, connectedNetworkDevice.connectedNetworkDeviceName, connectedNetworkDevice.connectedNetworkDeviceType
connectedNetworkDevice.duplexMode, connectedNetworkDevice.interfaceName, connectedNetworkDevice.interfaceSpeed
connection.apEthernetMac, connection.apMac, connection.apMode
connection.authType, connection.band, connection.bridgeVMMode
connection.channel, connection.channelWidth, connection.dataRate
connection.isFabricClient, connection.isIosAnalyticsCapable, connection.l2Vn
connection.l3Vn, connection.linkSpeed, connection.protocol
connection.protocolCapability, connection.radioId, connection.rssi
connection.securityGroupTag, connection.sessionDuration, connection.snr
connection.ssid, connection.upnDuid, connection.upnId
connection.upnName, connection.upnOwner, connection.vlanId
connection.vnId, connection.wlcId, connection.wlcName
connectionStatus, deviceType, formFactor
health.connectedScore, health.isLinkErrorIncluded, health.isRssiIncluded
health.isSnrIncluded, health.linkErrorPercentageThreshold, health.onboardingScore
health.overallScore, health.rssiThreshold, health.snrThreshold
id, ipv4Address, ipv6Addresses
ipv6Addresses{}, isPrivateMacAddress, lastUpdatedTime
latency.background, latency.bestEffort, latency.video
latency.voice, macAddress, name
onboarding.aaaFailureReason, onboarding.aaaServerIp, onboarding.assocDoneTime
onboarding.assocFailureReason, onboarding.authDoneTime, onboarding.avgAssocDuration
onboarding.avgAuthDuration, onboarding.avgDhcpDuration, onboarding.avgRunDuration
onboarding.dhcpDoneTime, onboarding.dhcpFailureReason, onboarding.dhcpServerIp
onboarding.failedRoamingCount, onboarding.latestFailureReason, onboarding.maxAssocDuration
onboarding.maxAuthDuration, onboarding.maxDhcpDuration, onboarding.maxRoamingDuration
onboarding.maxRunDuration, onboarding.onboardingTime, onboarding.otherFailureReason
onboarding.roamingTime, onboarding.successfulRoamingCount, onboarding.totalRoamingAttempts
osType, osVersion, signature_id
siteHierarchy, siteHierarchyId, siteId
tracked, traffic.dnsRequestCount, traffic.dnsResponseCount
traffic.rxBytes, traffic.rxLinkErrorPercentage, traffic.rxPackets
traffic.rxRate, traffic.rxRetries, traffic.rxRetryPercentage
traffic.txBytes, traffic.txDropPercentage, traffic.txDrops
traffic.txLinkErrorPercentage, traffic.txPackets, traffic.txRate
traffic.usage, type, userId
username, vendor, vendor_product
```

**Stanzas using this sourcetype**

- `[client_summary_client_by_band]` (line 4000)
- `[client_summary_client_by_device_type]` (line 3978)
- `[client_summary_client_by_protocol]` (line 4046)
- `[client_summary_client_by_ssid]` (line 4022)
- `[client_summary_client_onboarding]` (line 4112)
- `[client_summary_client_os_dist]` (line 4160)
- `[client_summary_ds_client_by_ssid]` (line 6931)
- `[client_summary_ds_client_os_dist]` (line 6954)
- `[client_summary_ds_client_session_by_band]` (line 6978)
- `[client_summary_ds_client_session_by_protocol]` (line 7003)
- `[client_summary_ds_client_session_by_ssid]` (line 7028)
- `[client_summary_ds_client_traffic_by_band]` (line 7054)
- `[client_summary_ds_client_traffic_by_protocol]` (line 7078)
- `[client_summary_ds_client_traffic_by_ssid]` (line 7103)
- `[client_summary_ds_top_clients_by_usage]` (line 7129)
- `[client_summary_ds_top_ssids_by_traffic]` (line 7154)
- `[client_summary_top_clients_by_usage]` (line 4134)
- `[clients_by_building_lookup_join_demo]` (line 10323)
- `[executive_dashboard_active_clients]` (line 505)
- `[executive_dashboard_ds_active_clients]` (line 7503)
- `[network_activation_ssid_client_trend_24h]` (line 4297)
- `[security_resilience_unauthorized_wireless]` (line 2268)
- `[statewide_ds_ssid_client_trend_24h]` (line 9224)
- `[user_experience_client_health_distribution]` (line 5113)
- `[user_experience_client_onboarding_failures]` (line 5136)
- `[user_experience_client_peak_by_ssid]` (line 3418)
- `[user_experience_client_roaming_analysis]` (line 5157)
- `[user_experience_client_top_talkers]` (line 5179)
- `[user_experience_ds_base_client]` (line 9331)
- `[user_experience_ds_client_peak_by_ssid]` (line 9351)
- `[user_experience_ds_guest_client_surge]` (line 9375)
- `[user_experience_ds_top_ssids_by_clients]` (line 9424)
- `[user_experience_ds_wireless_signal_quality]` (line 9448)
- `[user_experience_guest_client_surge]` (line 3393)
- `[user_experience_top_ssids_by_clients]` (line 5201)

### `cisco:dnac:clienthealth`

- **Status:** `pass`  **Field count:** 11  **Stanzas referencing:** 25  **Latency:** 2407 ms

**Discovered fields**

```
cisco_catalyst_host, clientCount, clientType
clientUniqueCount, endtime, scoreType
scoreValue, signature_id, siteId
starttime, vendor_product
```

**Stanzas using this sourcetype**

- `[client_summary_client_by_location]` (line 3955)
- `[client_summary_client_count_over_time]` (line 3908)
- `[client_summary_client_health_by_location]` (line 4183)
- `[client_summary_client_health_dist]` (line 4090)
- `[client_summary_client_health_kpi]` (line 3933)
- `[client_summary_wireless_vs_wired]` (line 4069)
- `[clienthealth_by_site_lookup_join]` (line 10349)
- `[executive_dashboard_ds_ux_score]` (line 7742)
- `[executive_dashboard_score_pipeline]` (line 7414)
- `[executive_dashboard_user_experience_domain_score]` (line 1056)
- `[executive_summary_client_health_by_site]` (line 3697)
- `[executive_summary_client_health_trend]` (line 3816)
- `[executive_summary_overall_client_health]` (line 3772)
- `[network_activation_wired_client_trend_24h]` (line 4276)
- `[network_activation_wired_health_kpi]` (line 4233)
- `[network_activation_wireless_client_trend_24h]` (line 4255)
- `[network_activation_wireless_health_kpi]` (line 4211)
- `[statewide_ds_wired_client_trend_24h]` (line 9245)
- `[statewide_ds_wireless_client_trend_24h]` (line 9266)
- `[statewide_ds_wireless_client_trend_7d]` (line 9287)
- `[user_experience_client_count_trend]` (line 3466)
- `[user_experience_client_health_by_type]` (line 2460)
- `[user_experience_client_health_trend]` (line 2435)
- `[user_experience_wired_client_health]` (line 2564)
- `[user_experience_wireless_client_health]` (line 2586)

### `cisco:dnac:compliance`

- **Status:** `pass`  **Field count:** 30  **Stanzas referencing:** 11  **Latency:** 2506 ms

**Discovered fields**

```
AssociatedWLCIP, ComplianceComplianceType, ComplianceCount
ComplianceDetail, ComplianceDeviceID, ComplianceLastSyncTime
ComplianceLastUpdateTime, ComplianceState, ComplianceStatus
DeviceFamily, DeviceName, DeviceRole
DeviceSeries, ImageVersion, IpAddress
LastUpdateTime, LastUpdated, MACAddress
ManageErrors, Manageability, Platform
Reachability, ReachabilityFailureReason, SerialNumber
SupportType, Uptime, UptimeSeconds
cisco_catalyst_host, signature_id, vendor_product
```

**Stanzas using this sourcetype**

- `[asset_inventory_build_lookup]` (line 6652)
- `[building_resilience_compliance_detail]` (line 22)
- `[executive_dashboard_building_domain_score]` (line 548)
- `[executive_dashboard_ds_bldg_score]` (line 7523)
- `[executive_dashboard_it_domain_score]` (line 858)
- `[executive_dashboard_score_pipeline]` (line 7414)
- `[it_critical_systems_compliance_distribution]` (line 1160)
- `[it_critical_systems_compliance_rate]` (line 1136)
- `[it_critical_systems_compliance_report]` (line 3644)
- `[security_resilience_compliance_distribution]` (line 5043)
- `[security_resilience_noncompliant_devices]` (line 5065)

### `cisco:dnac:devicehealth`

- **Status:** `pass`  **Field count:** 65  **Stanzas referencing:** 57  **Latency:** 2619 ms

**Discovered fields**

```
AirQualityHealthGhz24, AirQualityHealthGhz50, AirQualityHealthRadio0
AirQualityHealthRadio1, AssociatedWLCIP, CPUHealth
CPUUtilization, ClientCountGhz24, ClientCountGhz50
ClientCountRadio0, ClientCountRadio1, DeviceDescription
DeviceFamily, DeviceID, DeviceName
DeviceRole, DeviceSeries, DeviceType
HasAirQualityHealth, HasClientCount, HasHealthReport
HasInterferenceHealth, HasNoiseHealth, HasUtilization
HealthScore, ImageVersion, InterDeviceLinkAvailHealth
InterfaceLinkErrHealth, InterferenceHealthGhz24, InterferenceHealthGhz50
InterferenceHealthRadio0, InterferenceHealthRadio1, IpAddress
IssueCount, LastUpdateTime, LastUpdated
Location, MACAddress, ManageErrors
Manageability, MemoryUtilization, MemoryUtilizationHealth
NoiseHealthGhz24, NoiseHealthGhz50, NoiseHealthRadio0
NoiseHealthRadio1, OverallHealth, Platform
Reachability, ReachabilityFailureReason, SerialNumber
Site, SupportType, Uptime
UptimeSeconds, UtilizationGhz24, UtilizationGhz50
UtilizationRadio0, UtilizationRadio1, cisco_catalyst_host
dnac_orig_site, event_source, signature_id
site_id, vendor_product
```

**Stanzas using this sourcetype**

- `[asset_inventory_build_lookup]` (line 6652)
- `[asset_inventory_ds_gap_analysis]` (line 6733)
- `[building_resilience_ds_ap_health_site]` (line 6813)
- `[executive_dashboard_building_domain_score]` (line 548)
- `[executive_dashboard_device_health_trend_compare]` (line 2975)
- `[executive_dashboard_ds_bldg_score]` (line 7523)
- `[executive_dashboard_ds_device_health_current]` (line 7597)
- `[executive_dashboard_ds_device_health_trend_compare]` (line 7622)
- `[executive_dashboard_ds_ux_score]` (line 7742)
- `[executive_dashboard_it_domain_score]` (line 858)
- `[executive_dashboard_score_pipeline]` (line 7414)
- `[executive_dashboard_user_experience_domain_score]` (line 1056)
- `[executive_summary_ap_count]` (line 3879)
- `[executive_summary_device_inventory]` (line 3724)
- `[executive_summary_ds_ap_count]` (line 7816)
- `[executive_summary_ds_device_inventory]` (line 7839)
- `[executive_summary_ds_healthy_device_count]` (line 7861)
- `[executive_summary_ds_network_health_by_site]` (line 7883)
- `[executive_summary_ds_network_health_trend]` (line 7907)
- `[executive_summary_ds_overall_network_health]` (line 7930)
- `[executive_summary_healthy_device_count]` (line 4319)
- `[executive_summary_network_health_by_site]` (line 3672)
- `[executive_summary_overall_network_health]` (line 3748)
- `[it_critical_systems_ap_air_quality_by_site]` (line 4536)
- `[it_critical_systems_ap_channel_utilization]` (line 4559)
- `[it_critical_systems_ap_count_by_location]` (line 1112)
- `[it_critical_systems_ap_interference_hotspots]` (line 4582)
- `[it_critical_systems_cpu_memory_alerts]` (line 4603)
- `[it_critical_systems_device_health_distribution]` (line 4625)
- `[it_critical_systems_device_health_enriched]` (line 3244)
- `[it_critical_systems_device_health_score]` (line 1465)
- `[it_critical_systems_device_health_trend]` (line 1442)
- `[it_critical_systems_ds_ap_by_location]` (line 7952)
- `[it_critical_systems_ds_base_devicehealth]` (line 7978)
- `[it_critical_systems_ds_device_health]` (line 8048)
- `[it_critical_systems_ds_device_health_enriched]` (line 8072)
- `[it_critical_systems_ds_site_health]` (line 8294)
- `[it_critical_systems_ds_switch_by_location]` (line 8351)
- `[it_critical_systems_recent_reboots]` (line 4828)
- `[it_critical_systems_site_connectivity_score_trend]` (line 10084)
- `[it_critical_systems_site_link_availability_pct_trend]` (line 10110)
- `[it_critical_systems_sitelevel_health]` (line 1553)
- `[it_critical_systems_switch_count_by_location]` (line 1580)
- `[it_critical_systems_top_issue_devices]` (line 4897)
- `[it_critical_systems_topology_device_table]` (line 4922)
- `[it_critical_systems_topology_linkgraph]` (line 4944)
- `[it_critical_systems_topology_site_role]` (line 4969)
- `[it_critical_systems_unreachable_devices]` (line 4993)
- `[overview_link_auburndale_tallahassee_health]` (line 9770)
- `[overview_link_orlando_auburndale_health]` (line 9820)
- `[overview_link_orlando_tallahassee_health]` (line 9720)
- `[overview_operational_lead]` (line 9605)
- `[overview_site_auburndale_health]` (line 9691)
- `[overview_site_orlando_health]` (line 9662)
- `[overview_site_tallahassee_health]` (line 9633)
- `[overview_topology_overview]` (line 9480)
- `[shared_ds_dev_health_trend]` (line 10011)

### `cisco:dnac:issue`

- **Status:** `pass`  **Field count:** 40  **Stanzas referencing:** 21  **Latency:** 2574 ms

**Discovered fields**

```
DeviceFamily, DeviceID, DeviceImageVersion
DeviceIpAddress, DeviceLastUpdateTime, DeviceLastUpdated
DeviceMACAddress, DeviceName, DevicePlatform
DeviceRole, DeviceSerialNumber, DeviceSeries
DeviceSupportType, DeviceUptime, DeviceUptimeSeconds
IssueAiDriven, IssueCategory, IssueClientMac
IssueCount, IssueDeviceRole, IssueID
IssueName, IssuePriority, IssueSpecificCategory
IssueSpecificDescription, IssueSpecificEntity, IssueSpecificEntityValue
IssueSpecificName, IssueSpecificPriority, IssueSpecificSeverity
IssueSpecificSource, IssueSpecificSummary, IssueSpecificTimestamp
IssueStatus, SiteName, SiteNameHierarchy
SiteType, cisco_catalyst_host, signature_id
vendor_product
```

**Stanzas using this sourcetype**

- `[executive_dashboard_issue_summary_kpis]` (line 527)
- `[executive_summary_issue_by_priority_kpi]` (line 4362)
- `[executive_summary_issue_details]` (line 4443)
- `[executive_summary_issue_distribution]` (line 3858)
- `[executive_summary_issue_trend]` (line 4341)
- `[executive_summary_top_issues]` (line 3837)
- `[it_critical_systems_aaa_server_issues]` (line 3556)
- `[it_critical_systems_ap_disconnect_issues]` (line 3534)
- `[it_critical_systems_bgp_neighbor_issues]` (line 3512)
- `[it_critical_systems_ds_base_issues]` (line 7998)
- `[it_critical_systems_ds_issue_by_priority]` (line 8197)
- `[it_critical_systems_interface_utilization_issues]` (line 3490)
- `[it_critical_systems_issue_trend]` (line 3578)
- `[it_critical_systems_issues_by_priority]` (line 3623)
- `[it_critical_systems_issues_by_site]` (line 3600)
- `[it_critical_systems_site_bandwidth_pressure_24h_trend]` (line 10158)
- `[it_critical_systems_site_errors_discards_24h_trend]` (line 10180)
- `[it_critical_systems_site_link_events_24h_trend]` (line 10136)
- `[it_critical_systems_site_power_events_24h_trend]` (line 10202)
- `[security_resilience_rogue_device_detail]` (line 2193)
- `[security_resilience_rogue_device_detection]` (line 2169)

### `cisco:dnac:networkhealth`

- **Status:** `pass`  **Field count:** 18  **Stanzas referencing:** 11  **Latency:** 2374 ms

**Discovered fields**

```
badCount, badPercentage, category
cisco_catalyst_host, fairCount, fairPercentage
goodCount, goodPercentage, healthScore
kpiMetrics{}.key, kpiMetrics{}.value, noHealthCount
noHealthPercentage, signature_id, thirdPartyDeviceCount
time, totalCount, vendor_product
```

**Stanzas using this sourcetype**

- `[executive_dashboard_it_domain_score]` (line 858)
- `[executive_dashboard_network_health_score]` (line 897)
- `[executive_dashboard_network_health_trend_compare]` (line 2948)
- `[executive_dashboard_score_pipeline]` (line 7414)
- `[executive_summary_network_health_trend]` (line 3795)
- `[it_critical_systems_ds_wow_health]` (line 8418)
- `[it_critical_systems_network_category_distribution_health_trend]` (line 10224)
- `[it_critical_systems_network_health_category_trend]` (line 4669)
- `[it_critical_systems_network_health_score]` (line 1531)
- `[it_critical_systems_network_health_trend]` (line 1510)
- `[it_critical_systems_weekoverweek_health]` (line 1647)

### `cisco:dnac:securityadvisory`

- **Status:** `pass`  **Field count:** 34  **Stanzas referencing:** 4  **Latency:** 2669 ms

**Discovered fields**

```
AdvisoryCvesStr, AdvisoryDefaultDetectionType, AdvisoryDetectionType
AdvisoryDeviceCount, AdvisoryID, AdvisoryPublicationUrl
AdvisorySir, Amount, Category
DeviceAssociatedWLCIP, DeviceFamily, DeviceImageVersion
DeviceIpAddress, DeviceLastUpdateTime, DeviceLastUpdated
DeviceMACAddress, DeviceManageErrors, DeviceManageability
DeviceName, DevicePlatform, DeviceReachability
DeviceReachabilityFailureReason, DeviceRole, DeviceSerialNumber
DeviceSeries, DeviceSupportType, DeviceUptime
DeviceUptimeSeconds, SubCategory, Summary
cisco_catalyst_host, signature_id, timestamp
vendor_product
```

**Stanzas using this sourcetype**

- `[security_resilience_advisory_exposure_by_family]` (line 5020)
- `[security_resilience_ds_psirt]` (line 9041)
- `[security_resilience_psirt_advisories]` (line 2143)
- `[security_resilience_psirt_critical_advisories]` (line 5087)

### `cisco:dnac:site:topology`

- **Status:** `pass`  **Field count:** 44  **Stanzas referencing:** 3  **Latency:** 2356 ms

**Discovered fields**

```
address, category, ciscoDnaEventLink
cisco_catalyst_host, country, description
details.additionalInfo{}.attribute, details.additionalInfo{}.value, details.deviceCount
details.parentName, details.siteId, details.siteName
details.siteType, details.topology.links, details.topology.nodes
details.topology.rootNode, domain, efInstanceId
eventId, floorNumber, height
id, instanceId, latitude
length, longitude, name
nameHierarchy, namespace, parentId
rfModel, severity, signature_id
src, subDomain, tenantId
timestamp, tntId, type
unitsOfMeasure, userId, vendor_product
version, width
```

**Stanzas using this sourcetype**

- `[it_critical_systems_site_topology_event_type_distribution]` (line 1394)
- `[it_critical_systems_site_topology_recent_changes]` (line 1369)
- `[it_critical_systems_site_topology_site_type_distribution]` (line 1417)

### `cisco:esa:amp`

- **Status:** `pass`  **Field count:** 16  **Stanzas referencing:** 3  **Latency:** 2532 ms

**Discovered fields**

```
Categories, Category, Disposition
MID, Malware, Name
Reason, SHA256, Score
Size, Type, from
sha256, signature_id, upload_action
verdict_source
```

**Stanzas using this sourcetype**

- `[security_resilience_ds_email_security]` (line 8674)
- `[security_resilience_email_security_events]` (line 1720)
- `[security_resilience_email_threat_count]` (line 1742)

### `cisco:esa:antispam`

- **Status:** `pass`  **Field count:** 13  **Stanzas referencing:** 3  **Latency:** 2489 ms

**Discovered fields**

```
idle_wc, max_cpu, max_mid
max_wc, mean_cpu, mean_wc
median_cpu, median_wc, min_cpu
min_wc, signature_id, total_cpu
total_wc
```

**Stanzas using this sourcetype**

- `[security_resilience_ds_email_security]` (line 8674)
- `[security_resilience_email_security_events]` (line 1720)
- `[security_resilience_email_threat_count]` (line 1742)

### `cisco:esa:content_scanner`

- **Status:** `pass`  **Field count:** 2  **Stanzas referencing:** 3  **Latency:** 2460 ms

**Discovered fields**

```
pid, signature_id
```

**Stanzas using this sourcetype**

- `[security_resilience_ds_email_security]` (line 8674)
- `[security_resilience_email_security_events]` (line 1720)
- `[security_resilience_email_threat_count]` (line 1742)

### `cisco:estreamer:data`

- **Status:** `pass`  **Field count:** 17  **Stanzas referencing:** 3  **Latency:** 2507 ms

**Discovered fields**

```
archive_timestamp, class, dst_addr
dst_port, event_id, event_sec
event_usec, gen, impact_flag
ip_proto, priority, rev
sensor_id, sid, signature_id
src_addr, src_port
```

**Stanzas using this sourcetype**

- `[asset_inventory_firewall_gap]` (line 4387)
- `[security_resilience_ds_security_events]` (line 9108)
- `[security_resilience_recent_security_events]` (line 2240)

### `cisco:estreamer:log`

- **Status:** `pass`  **Field count:** 2  **Stanzas referencing:** 1  **Latency:** 2420 ms

**Discovered fields**

```
signature_id, timestamp
```

**Stanzas using this sourcetype**

- `[asset_inventory_firewall_gap]` (line 4387)

### `cisco:estreamer:status`

- **Status:** `empty`  **Field count:** 0  **Stanzas referencing:** 1  **Latency:** 2295 ms
- **Note:** no events in -7d..now

**Stanzas using this sourcetype**

- `[asset_inventory_firewall_gap]` (line 4387)

### `cisco:firepower:syslog`

- **Status:** `empty`  **Field count:** 0  **Stanzas referencing:** 3  **Latency:** 2382 ms
- **Note:** no events in -7d..now

**Stanzas using this sourcetype**

- `[admin_macro_index_tuning]` (line 5313)
- `[asset_inventory_firewall_gap]` (line 4387)
- `[executive_dashboard_data_status_pipeline]` (line 7372)

### `cisco:ftd`

- **Status:** `empty`  **Field count:** 0  **Stanzas referencing:** 23  **Latency:** 2399 ms
- **Note:** no events in -7d..now

**Stanzas using this sourcetype**

- `[admin_macro_index_tuning]` (line 5313)
- `[asset_inventory_firewall_gap]` (line 4387)
- `[escu_alert_fw_compromised_host_indicators]` (line 7251)
- `[escu_alert_fw_repeated_blocked_connections]` (line 7276)
- `[executive_dashboard_data_status_pipeline]` (line 7372)
- `[executive_dashboard_firewall_blocked_count]` (line 785)
- `[executive_dashboard_fw_blocked_trend_compare]` (line 2921)
- `[network_intelligence_blocked_vs_allowed]` (line 3008)
- `[network_intelligence_external_sources]` (line 3052)
- `[network_intelligence_geo_blocked_traffic]` (line 3099)
- `[network_intelligence_top_blocked_ports]` (line 3170)
- `[network_intelligence_top_countries_blocked]` (line 3122)
- `[network_intelligence_top_talkers]` (line 3146)
- `[network_intelligence_traffic_by_action_trend]` (line 3029)
- `[network_intelligence_traffic_by_protocol]` (line 3077)
- `[network_intelligence_traffic_volume_trend]` (line 3195)
- `[security_resilience_assets_at_risk]` (line 3220)
- `[security_resilience_data_exfiltration_indicators]` (line 2683)
- `[security_resilience_ds_base_fw]` (line 8634)
- `[security_resilience_firewall_allowed_count]` (line 1849)
- `[security_resilience_repeated_blocked_sources]` (line 2633)
- `[security_resilience_ssh_activity]` (line 2658)
- `[security_resilience_vpn_session_detail]` (line 2289)

### `cisco:ios`

- **Status:** `pass`  **Field count:** 111  **Stanzas referencing:** 37  **Latency:** 13446 ms

**Discovered fields**

```
aci_message_text, action, alarm
alignment, ap_mac, app
applet_name, applet_output, as_number
audit_session_id, authenticator, bw_down
bw_up, bytes, cdp_local_duplex
cdp_neighbor, cdp_remote_duplex, cdp_remote_dvc
cdp_remote_dvc_serial, cdp_remote_dvc_type, change_type
char1, cipher, cisco_header
command, config_source, correlation_tag
dest, dest_int_prefix, dest_int_suffix
dest_interface, dest_ip, dest_mac
dest_port, dest_vlan, detected_on_interface
device_time, direct_ap_mac, disable_cause
duration, dvc, event_id
facility, fail_from, gateway
group_id, hmac, ip_sla_id
ip_sla_id_2, ip_sla_type, lane
line, message_text, message_type
mgmt, mnemonic, module
netmask, network, notice
operating_value, packets, permanent_virtual_circuit
process_id, product, protocol
reason, reliable_time, result
routing_protocol, rule, sensor
severity, severity_description, severity_id
severity_id_and_name, severity_name, signature_id
src, src_int_prefix, src_int_prefix_long
src_int_suffix, src_int_type, src_interface
src_interface_description, src_ip, src_mac
src_port, src_vlan, state_from
state_to, subfacility, switch
switch_id, threshold_value, time_of_day
transport, trigger, tty
type, unit, unknown_id
user, vendor, vendor_action
vendor_action_2, virtual_channel_id, virtual_circuit_descriptor
virtual_path_id, vlan, vrf
```

**Stanzas using this sourcetype**

- `[admin_macro_index_tuning]` (line 5313)
- `[asset_inventory_build_lookup]` (line 6652)
- `[asset_inventory_ds_gap_analysis]` (line 6733)
- `[escu_alert_ios_config_exfil_via_tftp]` (line 7302)
- `[escu_alert_ios_snmp_community_change]` (line 7326)
- `[escu_alert_ios_suspicious_account_creation]` (line 7349)
- `[executive_dashboard_data_status_pipeline]` (line 7372)
- `[it_critical_systems_config_change_transactions]` (line 2836)
- `[it_critical_systems_dhcp_ios_events]` (line 3370)
- `[it_critical_systems_ds_config_change_transactions]` (line 8020)
- `[it_critical_systems_ds_dhcp_ios_events]` (line 8099)
- `[it_critical_systems_ds_error_disabled_interfaces]` (line 8172)
- `[it_critical_systems_ds_ntp_drift]` (line 8218)
- `[it_critical_systems_ds_port_flapping]` (line 8247)
- `[it_critical_systems_ds_route_flapping]` (line 8272)
- `[it_critical_systems_ds_stp_mac_flapping]` (line 8326)
- `[it_critical_systems_ds_syslog_severity]` (line 8376)
- `[it_critical_systems_error_disabled_interfaces]` (line 2865)
- `[it_critical_systems_link_flap_storm]` (line 4647)
- `[it_critical_systems_ntp_time_drift]` (line 2806)
- `[it_critical_systems_port_flapping]` (line 2735)
- `[it_critical_systems_power_event_detection]` (line 4690)
- `[it_critical_systems_power_event_summary]` (line 4712)
- `[it_critical_systems_power_event_timeline]` (line 4733)
- `[it_critical_systems_power_impact_report]` (line 4755)
- `[it_critical_systems_power_outage_history]` (line 4779)
- `[it_critical_systems_power_outage_trend]` (line 4803)
- `[it_critical_systems_route_flapping]` (line 2761)
- `[it_critical_systems_routing_reconvergence]` (line 4853)
- `[it_critical_systems_stp_and_mac_flapping]` (line 2782)
- `[it_critical_systems_stp_reconvergence]` (line 4875)
- `[it_critical_systems_syslog_severity_distribution]` (line 1604)
- `[security_resilience_ds_severity_by_host]` (line 9134)
- `[security_resilience_rogue_device_detail]` (line 2193)
- `[security_resilience_rogue_device_detection]` (line 2169)
- `[security_resilience_severity_by_host]` (line 2708)
- `[security_resilience_unauthorized_wireless]` (line 2268)

### `cisco:ise:syslog`

- **Status:** `pass`  **Field count:** 587  **Stanzas referencing:** 22  **Latency:** 13656 ms

**Discovered fields**

```
ACIReportApicNode, ACIReportDetails, ACIReportEvent
ACIReportISENodeIp, ADDomain, AD_Connector
AD_Domain, AD_Error_Details, AD_Groups_Names
AD_Hostname, AD_Log_Id, AD_User_Candidate_Identities
AD_User_DNS_Domain, AD_User_Join_Point, AD_User_NetBios_Name
AD_User_Qualified_Name, AD_User_Resolved_DNs, AD_User_Resolved_Identities
AD_User_SamAccount_Name, AGG____ACIReportDetails_, ARPHit
ARPMiss, ARPRetrieve, ARPSave
ARPUpdate, AVPair, AccountName
AcctRequest_Flags, Acct_Authentic, Acct_Delay_Time
Acct_Input_Octets, Acct_Input_Packets, Acct_Link_Count
Acct_Multi_Session_Id, Acct_Output_Octets, Acct_Output_Packets
Acct_Session_Id, Acct_Session_Time, Acct_Status_Type
AcsInstance, AcsSessionID, Action
ActiveSessionCount, AdapterInstanceName, AdapterInstanceUuid
Admin, AdminIPAddress, AdminInterface
AdminName, AdminSession, AdminWebappN
AdminWebappT, AdminWebappU, Administrator_Login
Airespace_Wlan_Id, AllowedProtocolMatchedRule, Altiris_Registry
AntiSpywareInstalled, AntiVirusInstalled, Application_Server
ArpCache_InsertUpdate_Received, AuditPasswordType, Authen_Method
Authen_Type, AuthenticationIdentityStore, AuthenticationMethod
AuthenticationStatus, AuthorizationPolicyMatchedRule, AverageRadiusRequestLatency
AverageTacacsRequestLatency, BYODN, BYODRegistration
BYODT, BYODU, Bad_HTTP_Request
BindingOperation, BindingPeerIp, BindingSXPNodeIp
BindingSourceType, BindingTag, BindingVPN
CAServiceN, CAServiceT, CAServiceU
CA_Service, CN, CPMSessionID
Called_Station_ID, Calling_Station_ID, Certificate_Authority_Service
ChangePasswordAfterLogin, ChangePasswordMethod, ClientLatency
Client_Provisioning, CmdSet, CoAHandledEvents
Component, ConfigChangeData, ConfigVersionId
Configuration_Changes, Connect_Info, Connected_Backup_Application
Connectivity, CreateTime, DBListenerN
DBListenerT, DBListenerU, DBServerN
DBServerT, DBServerU, DC
DHCP_Endpoint_Detected, DHCP_Server__dhcpd_, DHCP_Skip_Profiling
DNSReverseLookup_Events_Query, DNS_Endpoint_Detected, DNS_Server__named_
DTLSSupport, Database_Server, DeltaRadiusRequestCount
DeltaTacacsRequestCount, Description, DestinationIPAddress
DestinationPort, DetailedInfo, Details
DeviceRegistrationStatus, Device_Administration, Device_IP_Address
Device_Port, Device_Type, Device_Unique_Id
DhcpPacketsReceived, DhcpSkipProfiling, DomainName
Dynamic_Authorization, EAP, EAP_FAST
EAP_Key_Name, EAP_TLS, EST_Service
EapAuthentication, EapChainingResult, EapTunnel
EmailAddress, EndPointMACAddress, EndPointMatchedProfile
EndPoint_Reprofiling_Events, Endpoint, EndpointCache_InsertUpdate_Received
EndpointIPAddress, EndpointIdentityGroup, EndpointSourceEvent
Endpoint_IP_Address, EndpointsCached, EndpointsDeleted
EndpointsDetected, EndpointsOwnerChanged, EndpointsProfiled
EndpointsRetrievedFromOwner, EndpointsUpdated, Event_Timestamp
External_Active_Directory, FIREW, Failed_Attempt
FailureFlag, FailureReason, Failure_Reason
FeedService, Framed_IP_Address, Framed_IP_Netmask
Framed_MTU, GroupsOrAttributesProcessFailure, Guest
GuestN, GuestT, GuestU
Hermes__pxGrid_Cloud_Agent_, Host, HostID
HostIdentityGroup, HostName_Event_Fetch_FromAD, HttpPacketsNonAdjacentDropped
HttpPacketsReceived, Http_Endpoint_Detected, IPSEC
IPSec, IRF, ISEPolicySetName
ISE_API_Gateway_Database_Service, ISE_API_Gateway_Service, ISE_Application_Server
ISE_Database, ISE_Indexing_Engine, ISE_M_T_Log_Collector
ISE_M_T_Log_Processor, ISE_M_T_Session_Database, ISE_Messaging_Service
ISE_Profiler_DB, IdentityAccessRestricted, IdentityGroup
IdentityGroupID, IdentityMappingServiceN, IdentityMappingServiceT
IdentityMappingServiceU, IdentityPolicyMatchedRule, IdentitySelectionMatchedRule
IdentityStoreName, Identity_Store, IosSensorHttpDetected
IpAddress, IsActive, IsMachineAuthentication
IsMachineIdentity, IsThirdPartyDeviceFlow, IssuedPacInfo
Issued_By, Issued_To, JVMN
JVMT, JVMU, L
LAB, LastActivity, LastNmapScanTime
Licensing, LocalEndPointReads, Location
LoggerName, Logging, LogicalProfile
MDM, MDMFailureReason, MDMLastCheckinTimeStamp
MDMServerID, MDMServerName, MDMUpdateTime
MESSAGE_CLASS, MESSAGE_CODE, MESSAGE_TEXT
M_T_Log_Processor, M_T_Session_Database, MacAddress
MatchedCommandSet, Max_PDP_Session_Count, McAfee_AV_Installation_Win
MessageQueueN, MessageQueueT, MessageQueueU
Min_PDP_Session_Count, MisservicesN, MisservicesT
MisservicesU, MnTLogProcessorN, MnTLogProcessorT
MnTLogProcessorU, MnTSessionDBN, MnTSessionDBT
MnTSessionDBU, Model_Name, NAD_Address
NAS_IP, NAS_IP_Address, NAS_Identifier
NAS_Port, NAS_Port_Id, NAS_Port_Type
NMAP_ScanEvent_Query, NSFN, NSFT
NSFU, Name, Netflow_Endpoint_Detected
NetworkDeviceGroups, NetworkDeviceName, NetworkDeviceProfileId
NetworkDeviceProfileName, Network_Device_Name, Network_Device_Profile
Number_of_Guests, O, OS_Type
OU, ObjectInternalID, ObjectName
ObjectType, Object_Name, Object_Type
OpenSSLErrorMessage, OpenSSLErrorStack, OperatingSystem
OperationCounters, OperationMessageText, OperatorName
OriginalUserName, PID, PRAAction
PRAEnforcementFlag, PRAGraceTime, PRAInterval
PSXLMS, Passed_Authentication, PassiveID
PassiveID_API_Service, PassiveID_Agent_Service, PassiveID_Endpoint_Service
PassiveID_SPAN_Service, PassiveID_Syslog_Service, PassiveID_WMI_Service
PasswordType, PeerIp, PeerSequence
PolicySet_Building_SJC14_WNBU, PolicySet_Building_SJC14_WNBU_Allowed_Protocol_Default, PolicySet_Building_SJC14_WNBU_Allowed_Protocol_WNBU_SJC14_Wireless_Dot1x
PolicySet_Building_SJC14_WNBU_Allowed_Protocol_WNBU_SJC14_Wireless_Dot1x_Identity_Default, PolicySet_Building_SJC14_WNBU_Global_Exception_Default, PolicySet_Building_SJC14_WNBU_OEAP
PolicySet_Building_SJC14_WNBU_OEAP_Allowed_Protocol_WNBU_SJC14_Wireless_Dot1x, PolicySet_Building_SJC14_WNBU_OEAP_Global_Exception_Default, PolicySet_Building_SJCM1_Guest_DR
PolicySet_Building_SJCM1_Guest_DR_Allowed_Protocol_SJCM1_WirelessMAB_R, PolicySet_Building_SJCM1_Guest_DR_Allowed_Protocol_SJCM1_WirelessMAB_R_Identity_Default, PolicySet_Building_SJCM1_Guest_DR_Global_Exception_Alpha_Guest_Registration
PolicySet_Location_BXB_Wireless, PolicySet_Location_BXB_Wireless_Allowed_Protocol_Byod_Dot1x_BXB, PolicySet_Location_BXB_Wireless_Allowed_Protocol_Byod_Dot1x_BXB_Identity_Default
Port, PortNumber, PortalName
PortalUser, Posture, PostureAgentVersion
PostureAssessmentStatus, PostureReport, PostureStatus
Privilege_Level, ProbeDhcpEndpointsDetected, ProbeDnsEndpointLookup
ProbeDnsEndpointLookupAvert, ProbeDnsEndpointsDetected, ProbeHttpEndpointsDetected
ProbeRadiusEndpointsDetected, ProbeSnmpQueryEndpointsDetected, ProbeSnmpTrapEndpointsDetected
Probe_Requests_Dropped, Probe_Requests_Received, Process_Management
Profiler, ProfilerCacheHits, ProfilerDatabaseN
ProfilerDatabaseT, ProfilerDatabaseU, ProfilerN
ProfilerServer, ProfilerT, ProfilerU
Profiler_Database, Protocol, Protocol_Runtime_Context
PsnHostName, QuartzN, QuartzT
QuartzU, RADIUS, RADIUS_packet_ID
REST_Auth_Service, RMIN, RMIT
RMIU, RT_Control, RadiusFlowType
RadiusIdentifier, RadiusPacketType, RadiusPacketsReceived
Radius_Accounting, Radius_Endpoint_Detected, Reason
RemoteUpdate, RemoteUpdateAverted, Remote_Address
RequestLatency, RequestResponseType, RequestTime
Response, ResponseTime, SGA_PAC
SNMPQuery_Events_Query, SNMPTRAP_Endpoint_Detected, SNMPTrap_Events_Received
SNMP_Endpoint_Detected, SPWVersion, SRC
SSE_Connector, SSID, SSL_routines
ST, SXP, SXPMode
SXPNodeIp, SXPVersion, SXP_Engine_Service
Segmentation_Policy_Service, SelectedAccessService, SelectedAuthenticationIdentityStores
SelectedAuthorizationProfiles, SelectedCommandSet, SelectedShellProfile
Serial_Number, Server, ServerType
Service, Service_Argument, Service_Type
SessionID, SessionId, Session_Timeout
Severity, SnmpQueriesPerformed, SnmpTrapsReceived
Software_Version, Source, Sponsor
State, StaticGroupAssignment, Status
Step, StepData, StepLatency
SupplicantProfile, Supplicant_Provisioning, Sxp
Symantec_Management__Agent_Service, SysStatsAcsProcessHealth, SysStatsCpuCount
SysStatsProcessMemoryMB, SysStatsUtilizationCpu, SysStatsUtilizationDiskIO
SysStatsUtilizationDiskSpace, SysStatsUtilizationLoadAvg, SysStatsUtilizationMemory
SysStatsUtilizationNetwork, SyslogN, SyslogT
SyslogU, SystemDomain, SystemName
SystemUser, SystemUserDomain, System_Management
System_Stats, TCNACCoreN, TCNACCoreT
TCNACCoreU, TCNACDSN, TCNACDST
TCNACDSU, TCNACMongoDBN, TCNACMongoDBT
TCNACMongoDBU, TC_NAC_Core_Engine_Container, TC_NAC_MongoDB_Container
TLSCipher, TLSVersion, TS
Tacacs_Accounting, TotalAuthenLatency, TotalFailedAttempts
TotalFailedTime, Total_Certainty_Factor, TrustSec
Tunnel_Medium_Type, Tunnel_Private_Group_ID, Tunnel_Private_Group_ID_tagged
Tunnel_Type, Type, UniqueSubjectID
UpdateTime, UseCase, User
UserAccountControl, UserAdminFlag, UserAgreementStatus
UserName, UserType, User_Name
User_Type, User_change_password, VADN
VADT, VADU, VAServiceN
VAServiceT, VAServiceU, VA_Database
VA_Service, VPN, acme_av_pair
action, alarm_description, alarm_type
allowEasyWiredSession, app, authentication_method
body, change_type, cisco_av_pair
cisco_ise_vendor_action, coaIssued, command
cpm_ac_externalRadiusServer_inputFormat, cpu_load_percent, dataset_name
description, dest, dest_host
dest_ip, dest_mac, dest_name
dest_port, deviceIP, deviceRegistrationStatus
dhcpv6_elapsed_time, dvc, eventsReceived
host_name, id, identityGroup
iowait, ip, ise_host
ise_servername, log_type, mac
message, name, number_of_processes
object, object_attrs, object_category
object_id, portalUser, probe
product, protocol, provisioning_action
query, raw_msg, rcvd
rcvd_dropped, reason, result
security_group_tag, sent, sent_dropped
server, server_type, service
service_id, service_name, session_id
severity, signature, signature_id
src, src_host, src_int
src_ip, src_mac, src_port
src_user, start_mode, status
system_mgmt_desc, threatEventsReceived, timestamp
transport, type, user
user_name, user_type, vaEventsReceived
vendor, vendor_action, vendor_product
x_status, x_user
```

**Stanzas using this sourcetype**

- `[admin_macro_index_tuning]` (line 5313)
- `[asset_inventory_build_lookup]` (line 6652)
- `[asset_inventory_ds_gap_analysis]` (line 6733)
- `[executive_dashboard_data_status_pipeline]` (line 7372)
- `[executive_dashboard_failed_logon_count]` (line 766)
- `[executive_dashboard_ise_authentication_rate]` (line 826)
- `[executive_dashboard_score_pipeline]` (line 7414)
- `[executive_dashboard_security_domain_score]` (line 975)
- `[executive_dashboard_security_trend_compare]` (line 2895)
- `[security_resilience_ds_ise_auth]` (line 8848)
- `[security_resilience_ds_ise_by_nas]` (line 8870)
- `[security_resilience_ds_ise_fail_count]` (line 8896)
- `[security_resilience_ds_ise_failure_reasons]` (line 8915)
- `[security_resilience_ds_ise_trend]` (line 8939)
- `[security_resilience_ds_security_events]` (line 9108)
- `[security_resilience_identity_events_trend]` (line 1892)
- `[security_resilience_identity_overview_trend]` (line 1915)
- `[security_resilience_ise_auth_trend]` (line 2018)
- `[security_resilience_ise_authentication_rate]` (line 1996)
- `[security_resilience_recent_security_events]` (line 2240)
- `[user_experience_ds_ise_guest_auth_rate]` (line 9400)
- `[user_experience_ise_guest_auth_rate]` (line 3442)

### `cisco:sdwan:linkhealth`

- **Status:** `pass`  **Field count:** 61  **Stanzas referencing:** 4  **Latency:** 2768 ms

**Discovered fields**

```
af-type, auto-downstream-bandwidth, auto-neg
auto-negotiate, auto-upstream-bandwidth, bia-address
bw-down-util, bw-up-util, bytes_in
bytes_out, description, duplex
dvc_ip, encap-type, hwaddr
if-admin-status, if-oper-status, ifindex
ifname, interface-type, ip-address
ipv4-subnet-mask, ipv4-tcp-adjust-mss, ipv6-address
ipv6-addrs, ipv6-tcp-adjust-mss, lastupdated
mtu, negotiated-duplex-mode, negotiated-port-speed
num-flaps, packets_in, packets_out
port-type, rx-drops, rx-errors
rx-kbps, rx-octets, rx-packets
rx-pps, secondary, secondary-address
signature_id, speed-mbps, src_interface
src_ip, src_mac, timestamp
tx-drops, tx-errors, tx-kbps
tx-octets, tx-packets, tx-pps
uptime, uptime-date, vdevice-dataKey
vdevice-host-name, vdevice-name, vendor_product
vpn-id
```

**Stanzas using this sourcetype**

- `[overview_link_auburndale_tallahassee_health]` (line 9770)
- `[overview_link_orlando_auburndale_health]` (line 9820)
- `[overview_link_orlando_tallahassee_health]` (line 9720)
- `[overview_topology_overview]` (line 9480)

### `cisco:sdwan:utd:logs`

- **Status:** `pass`  **Field count:** 25  **Stanzas referencing:** 2  **Latency:** 2587 ms

**Discovered fields**

```
Category, Classification, Filename
Filetype, Hostname, Instance_ID
Malware, POLICY, Priority
Reputation, SHA, System_IP
URL, action, dest_ip
dest_port, protocol, raw_signature_id
signature_id, src_ip, src_port
token, utd_amp_disposition, utd_webfilter
vendor_product
```

**Stanzas using this sourcetype**

- `[security_resilience_ds_sdwan_utd]` (line 9087)
- `[security_resilience_sdwan_utd_alerts]` (line 2219)

### `cisco:sfw:estreamer`

- **Status:** `pass`  **Field count:** 147  **Stanzas referencing:** 21  **Latency:** 2571 ms

**Discovered fields**

```
AC_RuleAction, AC_RuleReason, Application
ApplicationID, ApplicationProductivityIndex, ApplicationRiskIndex
AuthenticationSource, Classification, ClientAppDetector
ClientApplication, ClientApplicationID, ClientApplicationProductivityIndex
ClientApplicationRiskIndex, ClientApplicationVersion, ConnectionDuration
ConnectionID, DNS_Query, DNS_RecordDescription
DNS_ResponseType, DNS_TTL, DestinationSecurityGroup
DestinationSecurityGroupTag, DestinationSecurityGroupType, Device
DeviceIP, DeviceSerialNumber, DeviceUUID
EVE_Fingerprint, EVE_Process, EVE_ProcessConfidencePct
EVE_ThreatConfidenceIndex, EVE_ThreatConfidencePct, EgressInterface
EgressInterfaceUUID, EgressVRF, EgressZone
EgressZoneUUID, EndpointProfile, EventID
EventMicrosecond, EventSecond, EventType
FileAction, FileCount, FileDirection
FileName, FilePolicy, FileSHA256
FileSize, FileStorageStatus, FileType
FirewallPolicy, FirewallPolicyUUID, FirewallRule
FirewallRuleID, FirstPacketSecond, GeneratorID
HTTP_Hostname, HTTP_Referer, HTTP_Response
HTTP_URI, Hostname, ICMP_Code
ICMP_Type, IOC_Count, Impact
ImpactFlag, IngressInterface, IngressInterfaceUUID
IngressVRF, IngressZone, IngressZoneUUID
InitiatorBytes, InitiatorIP, InitiatorPackets
InitiatorPort, InlineResult, InlineResultID
InspectedPacketCount, InspectionMicroseconds, InstanceID
IntrusionCount, IntrusionPolicy, IntrusionPolicyRevUUID
IntrusionPolicyUUID, IntrusionRuleMessage, LastPacketSecond
MitreAttackGroups, NAP_Policy, NAP_PolicyUUID
PacketData, PacketLength, PacketLinkTypeID
PacketMicrosecond, PacketSecond, PrefilterPolicy
Priority, PriorityID, Protocol
ProtocolID, RealmID, RealmName
ReferencedHost, ResponderBytes, ResponderContinent
ResponderContinentCode, ResponderCountry, ResponderCountryCode
ResponderCountryID, ResponderIP, ResponderPackets
ResponderPort, SHA_Disposition, SSL_ActualAction
SSL_CertFingerprint, SSL_CipherSuite, SSL_ExpectedAction
SSL_FlowStatus, SSL_Policy, SSL_Rule
SSL_Server, SSL_ServerCertStatus, SSL_SessionID
SSL_URL_Category, SSL_Version, SensorID
SignatureID, SignatureRevision, SnortRuleGroups
SnortVersionID, SourceSecurityGroup, SourceSecurityGroupTag
SourceSecurityGroupType, SperoDisposition, URI
URL, URL_Category, URL_Reputation
UserAgent, UserID, UserName
UserProtocol, WebApplication, WebApplicationHTTP
WebApplicationID, WebApplicationProductivityIndex, signature_id
```

**Stanzas using this sourcetype**

- `[admin_macro_index_tuning]` (line 5313)
- `[asset_inventory_firewall_gap]` (line 4387)
- `[escu_alert_fw_repeated_blocked_connections]` (line 7276)
- `[executive_dashboard_data_status_pipeline]` (line 7372)
- `[executive_dashboard_firewall_blocked_count]` (line 785)
- `[executive_dashboard_fw_blocked_trend_compare]` (line 2921)
- `[network_intelligence_blocked_vs_allowed]` (line 3008)
- `[network_intelligence_external_sources]` (line 3052)
- `[network_intelligence_geo_blocked_traffic]` (line 3099)
- `[network_intelligence_top_blocked_ports]` (line 3170)
- `[network_intelligence_top_countries_blocked]` (line 3122)
- `[network_intelligence_top_talkers]` (line 3146)
- `[network_intelligence_traffic_by_action_trend]` (line 3029)
- `[network_intelligence_traffic_by_protocol]` (line 3077)
- `[network_intelligence_traffic_volume_trend]` (line 3195)
- `[security_resilience_assets_at_risk]` (line 3220)
- `[security_resilience_ds_base_fw]` (line 8634)
- `[security_resilience_firewall_allowed_count]` (line 1849)
- `[security_resilience_idsips_classifications]` (line 1974)
- `[security_resilience_ips_severity_distribution]` (line 2612)
- `[security_resilience_repeated_blocked_sources]` (line 2633)

### `cisco:spaces:firehose`

- **Status:** `pass`  **Field count:** 408  **Stanzas referencing:** 24  **Latency:** 2441 ms

**Discovered fields**

```
cameraCounts.count, cameraCounts.countDelta, cameraCounts.location.apCount
cameraCounts.location.inferredLocationTypes{}, cameraCounts.location.locationId, cameraCounts.location.name
cameraCounts.location.parent.apCount, cameraCounts.location.parent.inferredLocationTypes{}, cameraCounts.location.parent.locationId
cameraCounts.location.parent.name, cameraCounts.location.parent.parent.apCount, cameraCounts.location.parent.parent.inferredLocationTypes{}
cameraCounts.location.parent.parent.locationId, cameraCounts.location.parent.parent.name, cameraCounts.location.parent.parent.sourceLocationId
cameraCounts.location.parent.sourceLocationId, cameraCounts.location.sourceLocationId, deviceAssociation.device.deviceId
deviceAssociation.device.deviceModel, deviceAssociation.device.dhcpProfileInfo.dcCertaintyMetric, deviceAssociation.device.dhcpProfileInfo.dcDeviceClassTag
deviceAssociation.device.dhcpProfileInfo.dcProfileName, deviceAssociation.device.dhcpProfileInfo.dcProtocolMap, deviceAssociation.device.email
deviceAssociation.device.firstName, deviceAssociation.device.gender, deviceAssociation.device.lastName
deviceAssociation.device.macAddress, deviceAssociation.device.manufacturer, deviceAssociation.device.mobile
deviceAssociation.device.openRoamingUserId, deviceAssociation.device.os, deviceAssociation.device.osVersion
deviceAssociation.device.postalCode, deviceAssociation.device.type, deviceAssociation.device.userId
deviceAssociation.event, deviceAssociation.ipv4, deviceAssociation.ipv6{}
deviceAssociation.location.apCount, deviceAssociation.location.floorNumber, deviceAssociation.location.inferredLocationTypes{}
deviceAssociation.location.locationId, deviceAssociation.location.name, deviceAssociation.location.parent.apCount
deviceAssociation.location.parent.inferredLocationTypes{}, deviceAssociation.location.parent.locationId, deviceAssociation.location.parent.name
deviceAssociation.location.parent.parent.apCount, deviceAssociation.location.parent.parent.inferredLocationTypes{}, deviceAssociation.location.parent.parent.locationId
deviceAssociation.location.parent.parent.name, deviceAssociation.location.parent.parent.parent.apCount, deviceAssociation.location.parent.parent.parent.inferredLocationTypes{}
deviceAssociation.location.parent.parent.parent.locationId, deviceAssociation.location.parent.parent.parent.name, deviceAssociation.location.parent.parent.parent.parent.apCount
deviceAssociation.location.parent.parent.parent.parent.inferredLocationTypes{}, deviceAssociation.location.parent.parent.parent.parent.locationId, deviceAssociation.location.parent.parent.parent.parent.name
deviceAssociation.location.parent.parent.parent.parent.sourceLocationId, deviceAssociation.location.parent.parent.parent.sourceLocationId, deviceAssociation.location.parent.parent.sourceLocationId
deviceAssociation.location.parent.sourceLocationId, deviceAssociation.location.sourceLocationId, deviceAssociation.rawUserId
deviceAssociation.ssid, deviceCounts.associatedCount, deviceCounts.associatedDelta
deviceCounts.bleTagCount, deviceCounts.estimatedCapacityPercentage, deviceCounts.estimatedDensity
deviceCounts.estimatedProbingCount, deviceCounts.location.apCount, deviceCounts.location.floorNumber
deviceCounts.location.inferredLocationTypes{}, deviceCounts.location.locationId, deviceCounts.location.name
deviceCounts.location.parent.apCount, deviceCounts.location.parent.inferredLocationTypes{}, deviceCounts.location.parent.locationId
deviceCounts.location.parent.name, deviceCounts.location.parent.parent.apCount, deviceCounts.location.parent.parent.inferredLocationTypes{}
deviceCounts.location.parent.parent.locationId, deviceCounts.location.parent.parent.name, deviceCounts.location.parent.parent.parent.apCount
deviceCounts.location.parent.parent.parent.inferredLocationTypes{}, deviceCounts.location.parent.parent.parent.locationId, deviceCounts.location.parent.parent.parent.name
deviceCounts.location.parent.parent.parent.parent.apCount, deviceCounts.location.parent.parent.parent.parent.inferredLocationTypes{}, deviceCounts.location.parent.parent.parent.parent.locationId
deviceCounts.location.parent.parent.parent.parent.name, deviceCounts.location.parent.parent.parent.parent.sourceLocationId, deviceCounts.location.parent.parent.parent.sourceLocationId
deviceCounts.location.parent.parent.sourceLocationId, deviceCounts.location.parent.sourceLocationId, deviceCounts.location.sourceLocationId
deviceCounts.probingDelta, deviceCounts.probingRandomizedPercentage, deviceCounts.rfidTagCount
deviceCounts.userCount, deviceCounts.wiredUserCount, deviceCounts.wirelessUserCount
deviceLocationUpdate.confidenceFactor, deviceLocationUpdate.device.deviceId, deviceLocationUpdate.device.deviceModel
deviceLocationUpdate.device.dhcpProfileInfo.dcCertaintyMetric, deviceLocationUpdate.device.dhcpProfileInfo.dcDeviceClassTag, deviceLocationUpdate.device.dhcpProfileInfo.dcProfileName
deviceLocationUpdate.device.dhcpProfileInfo.dcProtocolMap, deviceLocationUpdate.device.email, deviceLocationUpdate.device.firstName
deviceLocationUpdate.device.gender, deviceLocationUpdate.device.lastName, deviceLocationUpdate.device.macAddress
deviceLocationUpdate.device.manufacturer, deviceLocationUpdate.device.mobile, deviceLocationUpdate.device.openRoamingUserId
deviceLocationUpdate.device.os, deviceLocationUpdate.device.osVersion, deviceLocationUpdate.device.postalCode
deviceLocationUpdate.device.type, deviceLocationUpdate.device.userId, deviceLocationUpdate.deviceClassification
deviceLocationUpdate.ipv4, deviceLocationUpdate.ipv6{}, deviceLocationUpdate.lastSeen
deviceLocationUpdate.latitude, deviceLocationUpdate.location.apCount, deviceLocationUpdate.location.floorNumber
deviceLocationUpdate.location.inferredLocationTypes{}, deviceLocationUpdate.location.locationId, deviceLocationUpdate.location.name
deviceLocationUpdate.location.parent.apCount, deviceLocationUpdate.location.parent.inferredLocationTypes{}, deviceLocationUpdate.location.parent.locationId
deviceLocationUpdate.location.parent.name, deviceLocationUpdate.location.parent.parent.apCount, deviceLocationUpdate.location.parent.parent.inferredLocationTypes{}
deviceLocationUpdate.location.parent.parent.locationId, deviceLocationUpdate.location.parent.parent.name, deviceLocationUpdate.location.parent.parent.parent.apCount
deviceLocationUpdate.location.parent.parent.parent.inferredLocationTypes{}, deviceLocationUpdate.location.parent.parent.parent.locationId, deviceLocationUpdate.location.parent.parent.parent.name
deviceLocationUpdate.location.parent.parent.parent.parent.apCount, deviceLocationUpdate.location.parent.parent.parent.parent.inferredLocationTypes{}, deviceLocationUpdate.location.parent.parent.parent.parent.locationId
deviceLocationUpdate.location.parent.parent.parent.parent.name, deviceLocationUpdate.location.parent.parent.parent.parent.sourceLocationId, deviceLocationUpdate.location.parent.parent.parent.sourceLocationId
deviceLocationUpdate.location.parent.parent.sourceLocationId, deviceLocationUpdate.location.parent.sourceLocationId, deviceLocationUpdate.location.sourceLocationId
deviceLocationUpdate.longitude, deviceLocationUpdate.mapId, deviceLocationUpdate.maxDetectedRssi
deviceLocationUpdate.rawUserId, deviceLocationUpdate.ssid, deviceLocationUpdate.unc
deviceLocationUpdate.visitId, deviceLocationUpdate.xPos, deviceLocationUpdate.yPos
devicePresence.activeDevicesCount, devicePresence.daysSinceLastVisit, devicePresence.device.deviceId
devicePresence.device.deviceModel, devicePresence.device.dhcpProfileInfo.dcCertaintyMetric, devicePresence.device.dhcpProfileInfo.dcDeviceClassTag
devicePresence.device.dhcpProfileInfo.dcProfileName, devicePresence.device.dhcpProfileInfo.dcProtocolMap, devicePresence.device.email
devicePresence.device.firstName, devicePresence.device.gender, devicePresence.device.lastName
devicePresence.device.macAddress, devicePresence.device.manufacturer, devicePresence.device.mobile
devicePresence.device.openRoamingUserId, devicePresence.device.os, devicePresence.device.osVersion
devicePresence.device.postalCode, devicePresence.device.type, devicePresence.device.userId
devicePresence.deviceClassification, devicePresence.entryDateTime, devicePresence.entryTimestamp
devicePresence.exitDateTime, devicePresence.exitTimestamp, devicePresence.inActiveDevicesCount
devicePresence.location.apCount, devicePresence.location.inferredLocationTypes{}, devicePresence.location.locationId
devicePresence.location.name, devicePresence.location.parent.apCount, devicePresence.location.parent.inferredLocationTypes{}
devicePresence.location.parent.locationId, devicePresence.location.parent.name, devicePresence.location.parent.parent.apCount
devicePresence.location.parent.parent.inferredLocationTypes{}, devicePresence.location.parent.parent.locationId, devicePresence.location.parent.parent.name
devicePresence.location.parent.parent.sourceLocationId, devicePresence.location.parent.sourceLocationId, devicePresence.location.sourceLocationId
devicePresence.presenceEventType, devicePresence.rawUserId, devicePresence.ssid
devicePresence.timeZone, devicePresence.visitClassification, devicePresence.visitDurationMinutes
devicePresence.visitId, devicePresence.wasInActive, eventType
iotTelemetry.deviceInfo.companyId, iotTelemetry.deviceInfo.deviceId, iotTelemetry.deviceInfo.deviceMacAddress
iotTelemetry.deviceInfo.deviceModel, iotTelemetry.deviceInfo.deviceName, iotTelemetry.deviceInfo.deviceType
iotTelemetry.deviceInfo.firmwareVersion, iotTelemetry.deviceInfo.label, iotTelemetry.deviceInfo.manufacturer
iotTelemetry.deviceInfo.rawDeviceId, iotTelemetry.deviceInfo.serviceUuid, iotTelemetry.deviceInfo.vendorId
iotTelemetry.deviceRtcTime, iotTelemetry.humidity.humidityInPercentage, iotTelemetry.humidity.rawHumidity
iotTelemetry.location.apCount, iotTelemetry.location.inferredLocationTypes{}, iotTelemetry.location.locationId
iotTelemetry.location.name, iotTelemetry.location.parent.apCount, iotTelemetry.location.parent.inferredLocationTypes{}
iotTelemetry.location.parent.locationId, iotTelemetry.location.parent.name, iotTelemetry.location.parent.parent.apCount
iotTelemetry.location.parent.parent.inferredLocationTypes{}, iotTelemetry.location.parent.parent.locationId, iotTelemetry.location.parent.parent.name
iotTelemetry.location.parent.parent.sourceLocationId, iotTelemetry.location.parent.sourceLocationId, iotTelemetry.location.sourceLocationId
iotTelemetry.maxDetectedRssi, iotTelemetry.rawHeader, iotTelemetry.rawPayload
iotTelemetry.sequenceNum, partnerTenantId, rawCameraCounts.cameraId
rawCameraCounts.cameraZoneId, rawCameraCounts.count, rawCameraCounts.location.apCount
rawCameraCounts.location.inferredLocationTypes{}, rawCameraCounts.location.locationId, rawCameraCounts.location.name
rawCameraCounts.location.parent.apCount, rawCameraCounts.location.parent.inferredLocationTypes{}, rawCameraCounts.location.parent.locationId
rawCameraCounts.location.parent.name, rawCameraCounts.location.parent.parent.apCount, rawCameraCounts.location.parent.parent.inferredLocationTypes{}
rawCameraCounts.location.parent.parent.locationId, rawCameraCounts.location.parent.parent.name, rawCameraCounts.location.parent.parent.sourceLocationId
rawCameraCounts.location.parent.sourceLocationId, rawCameraCounts.location.sourceLocationId, recordTimestamp
recordUid, signature_id, spaceOccupancy.bookingStatus
spaceOccupancy.location.apCount, spaceOccupancy.location.floorNumber, spaceOccupancy.location.inferredLocationTypes{}
spaceOccupancy.location.locationId, spaceOccupancy.location.name, spaceOccupancy.location.parent.apCount
spaceOccupancy.location.parent.inferredLocationTypes{}, spaceOccupancy.location.parent.locationId, spaceOccupancy.location.parent.name
spaceOccupancy.location.parent.parent.apCount, spaceOccupancy.location.parent.parent.inferredLocationTypes{}, spaceOccupancy.location.parent.parent.locationId
spaceOccupancy.location.parent.parent.name, spaceOccupancy.location.parent.parent.parent.apCount, spaceOccupancy.location.parent.parent.parent.inferredLocationTypes{}
spaceOccupancy.location.parent.parent.parent.locationId, spaceOccupancy.location.parent.parent.parent.name, spaceOccupancy.location.parent.parent.parent.parent.apCount
spaceOccupancy.location.parent.parent.parent.parent.inferredLocationTypes{}, spaceOccupancy.location.parent.parent.parent.parent.locationId, spaceOccupancy.location.parent.parent.parent.parent.name
spaceOccupancy.location.parent.parent.parent.parent.sourceLocationId, spaceOccupancy.location.parent.parent.parent.sourceLocationId, spaceOccupancy.location.parent.parent.sourceLocationId
spaceOccupancy.location.parent.sourceLocationId, spaceOccupancy.location.sourceLocationId, spaceOccupancy.peakPeopleCount
spaceOccupancy.peoplePresence, spaceOccupancy.space.capacity, spaceOccupancy.space.floorId
spaceOccupancy.space.id, spaceOccupancy.space.name, spaceOccupancy.space.occupancyType
spaceOccupancy.space.type, spaceOccupancy.timeZone, spaceOccupancy.windowStartDateTime
spaceOccupancy.windowStartTimestamp, spacesTenantId, spacesTenantName
userPresence.activeUsersCount.totalUsers, userPresence.activeUsersCount.usersWithUserId, userPresence.activeUsersCount.usersWithoutUserId
userPresence.connection, userPresence.entryDateTime, userPresence.entryTimestamp
userPresence.exitDateTime, userPresence.exitTimestamp, userPresence.inActiveUsersCount.totalUsers
userPresence.inActiveUsersCount.usersWithUserId, userPresence.inActiveUsersCount.usersWithoutUserId, userPresence.location.apCount
userPresence.location.floorNumber, userPresence.location.inferredLocationTypes{}, userPresence.location.locationId
userPresence.location.name, userPresence.location.parent.apCount, userPresence.location.parent.inferredLocationTypes{}
userPresence.location.parent.locationId, userPresence.location.parent.name, userPresence.location.parent.parent.apCount
userPresence.location.parent.parent.inferredLocationTypes{}, userPresence.location.parent.parent.locationId, userPresence.location.parent.parent.name
userPresence.location.parent.parent.parent.apCount, userPresence.location.parent.parent.parent.inferredLocationTypes{}, userPresence.location.parent.parent.parent.locationId
userPresence.location.parent.parent.parent.name, userPresence.location.parent.parent.parent.parent.apCount, userPresence.location.parent.parent.parent.parent.inferredLocationTypes{}
userPresence.location.parent.parent.parent.parent.locationId, userPresence.location.parent.parent.parent.parent.name, userPresence.location.parent.parent.parent.parent.sourceLocationId
userPresence.location.parent.parent.parent.sourceLocationId, userPresence.location.parent.parent.sourceLocationId, userPresence.location.parent.sourceLocationId
userPresence.location.sourceLocationId, userPresence.presenceEventType, userPresence.rawUserId
userPresence.timeZone, userPresence.user.deviceIds{}, userPresence.user.email
userPresence.user.firstName, userPresence.user.gender, userPresence.user.lastName
userPresence.user.mobile, userPresence.user.openRoamingUserId, userPresence.user.postalCode
userPresence.user.userId, userPresence.visitDurationMinutes, userPresence.visitId
userPresence.wasInActive, webexTelemetryUpdate.deviceInfo.deviceId, webexTelemetryUpdate.deviceInfo.displayName
webexTelemetryUpdate.deviceInfo.ipAddress, webexTelemetryUpdate.deviceInfo.macAddress, webexTelemetryUpdate.deviceInfo.orgId
webexTelemetryUpdate.deviceInfo.product, webexTelemetryUpdate.deviceInfo.serialNumber, webexTelemetryUpdate.deviceInfo.softwareVersion
webexTelemetryUpdate.deviceInfo.workspaceId, webexTelemetryUpdate.location.apCount, webexTelemetryUpdate.location.floorNumber
webexTelemetryUpdate.location.inferredLocationTypes{}, webexTelemetryUpdate.location.locationId, webexTelemetryUpdate.location.name
webexTelemetryUpdate.location.parent.apCount, webexTelemetryUpdate.location.parent.inferredLocationTypes{}, webexTelemetryUpdate.location.parent.locationId
webexTelemetryUpdate.location.parent.name, webexTelemetryUpdate.location.parent.parent.apCount, webexTelemetryUpdate.location.parent.parent.inferredLocationTypes{}
webexTelemetryUpdate.location.parent.parent.locationId, webexTelemetryUpdate.location.parent.parent.name, webexTelemetryUpdate.location.parent.parent.parent.apCount
webexTelemetryUpdate.location.parent.parent.parent.inferredLocationTypes{}, webexTelemetryUpdate.location.parent.parent.parent.locationId, webexTelemetryUpdate.location.parent.parent.parent.name
webexTelemetryUpdate.location.parent.parent.parent.parent.apCount, webexTelemetryUpdate.location.parent.parent.parent.parent.inferredLocationTypes{}, webexTelemetryUpdate.location.parent.parent.parent.parent.locationId
webexTelemetryUpdate.location.parent.parent.parent.parent.name, webexTelemetryUpdate.location.parent.parent.parent.parent.sourceLocationId, webexTelemetryUpdate.location.parent.parent.parent.sourceLocationId
webexTelemetryUpdate.location.parent.parent.sourceLocationId, webexTelemetryUpdate.location.parent.sourceLocationId, webexTelemetryUpdate.location.sourceLocationId
webexTelemetryUpdate.telemetries{}.activeCalls, webexTelemetryUpdate.telemetries{}.airQuality, webexTelemetryUpdate.telemetries{}.ambientNoise
webexTelemetryUpdate.telemetries{}.ambientTemp, webexTelemetryUpdate.telemetries{}.peopleCount, webexTelemetryUpdate.telemetries{}.presence
webexTelemetryUpdate.telemetries{}.relativeHumidity, webexTelemetryUpdate.telemetries{}.soundLevel, webexTelemetryUpdate.telemetries{}.standByState
```

**Stanzas using this sourcetype**

- `[building_resilience_device_presence_trend]` (line 434)
- `[building_resilience_ds_room_detail]` (line 10033)
- `[building_resilience_ds_rooms]` (line 6844)
- `[building_resilience_ds_spaces_kpi_devices]` (line 6868)
- `[building_resilience_ds_spaces_kpi_ssids]` (line 6889)
- `[building_resilience_ds_spaces_kpi_users]` (line 6910)
- `[building_resilience_environmental_health_index]` (line 87)
- `[building_resilience_humidity]` (line 151)
- `[building_resilience_room_detail]` (line 456)
- `[building_resilience_spaces_location_breakdown]` (line 478)
- `[building_resilience_ssid_association_trend]` (line 390)
- `[building_resilience_ssid_client_associations]` (line 365)
- `[building_resilience_temperature]` (line 275)
- `[building_resilience_user_presence_trend]` (line 412)
- `[building_resilience_webex_devices]` (line 319)
- `[building_resilience_webex_people_trend]` (line 342)
- `[executive_dashboard_active_devices]` (line 4471)
- `[executive_dashboard_building_domain_score]` (line 548)
- `[executive_dashboard_building_occupancy]` (line 598)
- `[executive_dashboard_collab_devices]` (line 4494)
- `[executive_dashboard_ds_bldg_score]` (line 7523)
- `[executive_dashboard_ds_building_occupancy]` (line 7572)
- `[executive_dashboard_score_pipeline]` (line 7414)
- `[executive_dashboard_wifi_clients]` (line 4515)

### `cisco:wsa:l4tm`

- **Status:** `pass`  **Field count:** 1  **Stanzas referencing:** 2  **Latency:** 2283 ms

**Discovered fields**

```
signature_id
```

**Stanzas using this sourcetype**

- `[security_resilience_web_security_events]` (line 2310)
- `[security_resilience_web_threat_count]` (line 2330)

### `cisco:wsa:squid`

- **Status:** `pass`  **Field count:** 97  **Stanzas referencing:** 2  **Latency:** 2248 ms

**Discovered fields**

```
CatId, ac, accountStatusPolicy
aid, asid, campuscode
category, ch, channel
cid, cms_redirect, continue
creative, crumb, de
device, emr, encoding
flowEntry, flowName, followup
gclick, gclid, hl
hsa_acc, hsa_ad, hsa_cam
hsa_grp, hsa_net, hsa_src
hsa_tgt, hsa_ver, keyword
keywords, l, locale
ls, match_type, matchtype
mediumofinquiry, message, mh
milestone, mip, mm
mn, ms, mt
mv, mvi, network
nw, o, openid_assoc_handle
openid_claimed_id, openid_identity, openid_mode
openid_ns, openid_ns_pape, openid_pape_max_auth_age
openid_return_to, osid, osname
pageId, passive, path
pl, q, qo
rch, rd, redirect
ref, rid, school_ad_platform
school_campus, school_channel, school_medium
school_program, school_source, service
shardbypass, showRmrMe, signature_id
static, uilel, url
utm_campaign, utm_content, utm_medium
utm_source, utm_term, v
vendoraffliatedid, ver, visit_id
zcid
```

**Stanzas using this sourcetype**

- `[security_resilience_web_security_events]` (line 2310)
- `[security_resilience_web_threat_count]` (line 2330)

### `cisco:xdr:incidents`

- **Status:** `pass`  **Field count:** 43  **Stanzas referencing:** 8  **Latency:** 2255 ms

**Discovered fields**

```
assignees{}, categories{}, client_id
confidence, created, description
detection_sources{}, discovery_method, enrichment_status
external_ids{}, external_references{}.description, external_references{}.external_id
external_references{}.source_name, external_references{}.url, groups{}
id, incident_source, incident_time.closed
incident_time.contained, incident_time.discovered, incident_time.opened
incident_time.reported, meta.ai_description, modified
owner, owner_id, promotion_method
schema_version, scores.asset, scores.global
scores.ml_score, scores.ttp, severity
short_description, signature_id, source_uri
status, tactics{}, techniques{}
timestamp, title, tlp
type
```

**Stanzas using this sourcetype**

- `[executive_dashboard_ds_xdr_incidents]` (line 7774)
- `[executive_dashboard_xdr_incident_count]` (line 1089)
- `[overview_top_incident_volume]` (line 9580)
- `[overview_topology_overview]` (line 9480)
- `[security_resilience_ds_xdr_by_severity]` (line 9181)
- `[security_resilience_ds_xdr_detail]` (line 9201)
- `[security_resilience_xdr_by_severity]` (line 2349)
- `[security_resilience_xdr_incident_detail]` (line 2368)

### `cisco:xdr:incidents-summary`

- **Status:** `pass`  **Field count:** 121  **Stanzas referencing:** 8  **Latency:** 2330 ms

**Discovered fields**

```
assignees{}, categories{}, context.asset_properties{}.properties{}.name
context.asset_properties{}.properties{}.value, context.attack_patterns{}.abstraction_level, context.attack_patterns{}.created
context.attack_patterns{}.description, context.attack_patterns{}.external_ids{}, context.attack_patterns{}.external_references{}.description
context.attack_patterns{}.external_references{}.external_id, context.attack_patterns{}.external_references{}.source_name, context.attack_patterns{}.external_references{}.url
context.attack_patterns{}.groups{}, context.attack_patterns{}.id, context.attack_patterns{}.kill_chain_phases{}.kill_chain_name
context.attack_patterns{}.kill_chain_phases{}.phase_name, context.attack_patterns{}.modified, context.attack_patterns{}.owner
context.attack_patterns{}.schema_version, context.attack_patterns{}.short_description, context.attack_patterns{}.source
context.attack_patterns{}.source_uri, context.attack_patterns{}.timestamp, context.attack_patterns{}.title
context.attack_patterns{}.tlp, context.attack_patterns{}.type, context.attack_patterns{}.x_mitre_contributors{}
context.attack_patterns{}.x_mitre_platforms{}, context.indicators{}.client_id, context.indicators{}.created
context.indicators{}.description, context.indicators{}.external_ids{}, context.indicators{}.groups{}
context.indicators{}.id, context.indicators{}.modified, context.indicators{}.owner
context.indicators{}.producer, context.indicators{}.schema_version, context.indicators{}.source
context.indicators{}.source_uri, context.indicators{}.tags{}, context.indicators{}.timestamp
context.indicators{}.title, context.indicators{}.tlp, context.indicators{}.type
context.indicators{}.valid_time.end_time, context.indicators{}.valid_time.start_time, context.relationships{}.client_id
context.relationships{}.created, context.relationships{}.external_ids{}, context.relationships{}.groups{}
context.relationships{}.id, context.relationships{}.modified, context.relationships{}.owner
context.relationships{}.relationship_type, context.relationships{}.schema_version, context.relationships{}.source
context.relationships{}.source_ref, context.relationships{}.target_ref, context.relationships{}.timestamp
context.relationships{}.tlp, context.relationships{}.type, context.sightings{}.created
context.sightings{}.description, context.sightings{}.external_ids{}, context.sightings{}.external_references{}.source_name
context.sightings{}.internal, context.sightings{}.modified, context.sightings{}.observables{}.type
context.sightings{}.observables{}.value, context.sightings{}.relations{}.origin, context.sightings{}.relations{}.related.type
context.sightings{}.relations{}.related.value, context.sightings{}.relations{}.relation, context.sightings{}.relations{}.relation_info.actions{}.applies_to
context.sightings{}.relations{}.relation_info.actions{}.source, context.sightings{}.relations{}.relation_info.actions{}.started_at, context.sightings{}.relations{}.relation_info.actions{}.status
context.sightings{}.relations{}.relation_info.actions{}.type, context.sightings{}.relations{}.relation_info.direction, context.sightings{}.relations{}.source.type
context.sightings{}.relations{}.source.value, context.sightings{}.resolution, context.sightings{}.schema_version
context.sightings{}.short_description, context.sightings{}.source, context.sightings{}.source_uri
context.sightings{}.targets{}.observables{}.type, context.sightings{}.targets{}.observables{}.value, context.sightings{}.targets{}.observed_time.end_time
context.sightings{}.targets{}.observed_time.start_time, context.sightings{}.targets{}.type, context.sightings{}.title
context.sightings{}.type, created, description
detection_sources{}, discovery_method, enrichment_status
external_ids{}, external_references{}.description, external_references{}.external_id
external_references{}.source_name, external_references{}.url, id
incident_time.discovered, incident_time.opened, incident_time.reported
meta.ai_description, modified, promotion_method
schema_version, severity, short_description
signature_id, source_uri, status
timestamp, title, tlp
type
```

**Stanzas using this sourcetype**

- `[executive_dashboard_ds_xdr_incidents]` (line 7774)
- `[executive_dashboard_xdr_incident_count]` (line 1089)
- `[overview_top_incident_volume]` (line 9580)
- `[overview_topology_overview]` (line 9480)
- `[security_resilience_ds_xdr_by_severity]` (line 9181)
- `[security_resilience_ds_xdr_detail]` (line 9201)
- `[security_resilience_xdr_by_severity]` (line 2349)
- `[security_resilience_xdr_incident_detail]` (line 2368)

### `f5:bigip:management:device:icontrol`

- **Status:** `empty`  **Field count:** 0  **Stanzas referencing:** 1  **Latency:** 2156 ms
- **Note:** no events in -7d..now

**Stanzas using this sourcetype**

- `[asset_inventory_build_lookup]` (line 6652)

### `meraki:audit`

- **Status:** `pass`  **Field count:** 11  **Stanzas referencing:** 1  **Latency:** 2289 ms

**Discovered fields**

```
adminEmail, adminId, adminName
label, networkId, networkName
newValue, oldValue, organizationId
page, ts
```

**Stanzas using this sourcetype**

- `[it_critical_systems_configuration_change_trend]` (line 1203)

### `meraki:devicesavailabilitieschangehistory`

- **Status:** `pass`  **Field count:** 16  **Stanzas referencing:** 1  **Latency:** 2251 ms

**Discovered fields**

```
category, details.new{}.name, details.new{}.value
details.old{}.name, details.old{}.value, device.model
device.name, device.productType, device.serial
device.tags{}, network.id, network.name
network.tags{}, network.url, organizationId
ts
```

**Stanzas using this sourcetype**

- `[asset_inventory_build_lookup]` (line 6652)

### `meraki:devicesuplinkslossandlatency`

- **Status:** `empty`  **Field count:** 0  **Stanzas referencing:** 6  **Latency:** 2162 ms
- **Note:** no events in -7d..now

**Stanzas using this sourcetype**

- `[it_critical_systems_ds_wan_bandwidth_detail]` (line 8397)
- `[it_critical_systems_wan_bandwidth_detail]` (line 1625)
- `[user_experience_bandwidth_trend]` (line 2414)
- `[user_experience_ds_bandwidth]` (line 9308)
- `[user_experience_wan_bandwidth_table]` (line 2392)
- `[user_experience_wan_latency_by_uplink]` (line 2543)

### `meraki:sensorreadingshistory`

- **Status:** `empty`  **Field count:** 0  **Stanzas referencing:** 9  **Latency:** 2111 ms
- **Note:** no events in -7d..now

**Stanzas using this sourcetype**

- `[building_resilience_co2_level]` (line 1)
- `[building_resilience_door_alerts]` (line 64)
- `[building_resilience_environmental_health_index]` (line 87)
- `[building_resilience_environmental_trend_detail]` (line 111)
- `[building_resilience_fire_safety_status]` (line 130)
- `[building_resilience_humidity]` (line 151)
- `[building_resilience_sensor_detail]` (line 253)
- `[building_resilience_temperature]` (line 275)
- `[building_resilience_water_leak_detection]` (line 298)

### `ms:defender:endpoint:alerts`

- **Status:** `empty`  **Field count:** 0  **Stanzas referencing:** 2  **Latency:** 2078 ms
- **Note:** no events in -7d..now

**Stanzas using this sourcetype**

- `[security_resilience_ds_endpoint_detail]` (line 8696)
- `[security_resilience_endpoint_alert_detail]` (line 1781)

### `oncall:incidents`

- **Status:** `empty`  **Field count:** 0  **Stanzas referencing:** 1  **Latency:** 2050 ms
- **Note:** no events in -7d..now

**Stanzas using this sourcetype**

- `[teuc_5_9_51_on_call_incident_routing]` (line 6400)

### `thousandeyes:alerts`

- **Status:** `empty`  **Field count:** 0  **Stanzas referencing:** 4  **Latency:** 1897 ms
- **Note:** no events in -7d..now

**Stanzas using this sourcetype**

- `[teuc_5_9_19_isp_performance_degradation_alerts]` (line 5725)
- `[teuc_5_9_46_alert_severity_distribution]` (line 6296)
- `[teuc_5_9_47_alert_timeline_trending]` (line 6316)
- `[teuc_5_9_54_mttr_reduction_via_network_vs_application_isolation]` (line 6466)

### `thousandeyes:traces`

- **Status:** `empty`  **Field count:** 0  **Stanzas referencing:** 1  **Latency:** 1825 ms
- **Note:** no events in -7d..now

**Stanzas using this sourcetype**

- `[teuc_5_9_52_trace_span_analysis]` (line 6421)

