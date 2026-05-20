# Sourcetype Field Inventory

**Generated:** `2026-05-09T15:36:43-0400`  **Window:** `-7d` → `now`  **Sample:** `head 10000` per sourcetype

Authoritative field set for every sourcetype referenced in `searchbase.conf`, discovered live via Splunk's `field_list` macro. Use this as ground truth when reviewing SPL — any field referenced by a stanza that isn't in the matching sourcetype's table below is suspect.

## Summary

| Status | Count | Meaning |
|---|---:|---|
| `pass`    |  11 | Returned at least one field. |
| `empty`   |   0 | Sourcetype has no events in the time window. |
| `fail`    |   0 | Search errored — see note. |
| `skipped` |   0 | Excluded by filter. |

## Sourcetypes by Stanza Count

| Sourcetype | Stanzas | Status | Field Count |
|---|---:|---|---:|
| `cisco:dnac:devicehealth` | 57 | `pass` | 62 |
| `cisco:dnac:client` | 35 | `pass` | 126 |
| `cisco:dnac:clienthealth` | 25 | `pass` | 11 |
| `cisco:dnac:issue` | 21 | `pass` | 37 |
| `cisco:dnac:compliance` | 11 | `pass` | 34 |
| `cisco:dnac:networkhealth` | 11 | `pass` | 18 |
| `cisco:dnac:audit:logs` | 5 | `pass` | 59 |
| `cisco:dnac:securityadvisory` | 4 | `pass` | 34 |
| `cisco:catalyst:center:compliance:report` | 3 | `pass` | 21 |
| `cisco:catalyst:center:inventory:report` | 3 | `pass` | 22 |
| `cisco:dnac:site:topology` | 3 | `pass` | 20 |

## Per-Sourcetype Field Lists

### `cisco:catalyst:center:compliance:report`

- **Status:** `pass`  **Field count:** 21  **Stanzas referencing:** 3  **Latency:** 986 ms

**Discovered fields**

```
Application Visibility, Compliance Status, Critical Security Advisories
Customization Profile, Device Family, Device Name
Device Type, EoX, Fabric
IP Address, Network Profile, Network Settings
Sl.No, Software Image, Startup Vs Running Configuration
cisco_catalyst_host, collection_timestamp, report_name
report_type, signature_id, vendor_product
```

**Stanzas using this sourcetype**

- `[it_critical_systems_compliance_report_noncompliant_detail]` (line 1346)
- `[it_critical_systems_compliance_report_rate]` (line 1298)
- `[it_critical_systems_compliance_report_status_distribution]` (line 1323)

### `cisco:catalyst:center:inventory:report`

- **Status:** `pass`  **Field count:** 22  **Stanzas referencing:** 3  **Latency:** 942 ms

**Discovered fields**

```
DNA License, Device Family, Device Name
Device Type, Fabric Role, IP Address
Location, Network License, No. of Users
No. of ethernet ports, Part No., Serial No.
Software Version, Status, Time Since Code Upgrade via Cisco DNA Center SWIM
Up Time, cisco_catalyst_host, collection_timestamp
report_name, report_type, signature_id
vendor_product
```

**Stanzas using this sourcetype**

- `[it_critical_systems_inventory_device_family_distribution]` (line 1275)
- `[it_critical_systems_inventory_reachability_summary]` (line 1228)
- `[it_critical_systems_inventory_unreachable_detail]` (line 1252)

### `cisco:dnac:audit:logs`

- **Status:** `pass`  **Field count:** 59  **Stanzas referencing:** 5  **Latency:** 956 ms

**Discovered fields**

```
additionalDetails.eventMetadata.auditLogMetadata.type, additionalDetails.eventMetadata.auditLogMetadata.version, category
childCount, ciscoDnaEventLink, ciscoDnaEventLinkIPv4
ciscoDnaEventLinkIPv6, clientId, context
description, details.authSource, details.requestPayload
details.requestPayloadDescriptor, dnacIP, dnacIPv4
dnacIPv6, domain, efInstanceId
eventHierarchy, eventHierarchy.hierarchy, eventHierarchy.hierarchyDelimiter
eventId, eventSize, i18n
instanceId, isACKnowledgeable, isAlert
isDeprecated, isPrivateEvent, isSimulated
message, messageParams, name
namespace, network, network.deviceId
network.siteId, note, parentInstanceId
payloadSize, productId, resourceDomain._id
resourceDomain.name, resourceDomain.resourceGroups{}.name, resourceDomain.resourceGroups{}.srcResourceId
resourceDomain.resourceGroups{}.type, severity, signature_id
src, startTime, subDomain
tenantId, timestamp, tntId
type, userId, userName
vendor_product, version
```

**Stanzas using this sourcetype**

- `[audit_logs_by_site_lookup_join]` (line 10443)
- `[it_critical_systems_configuration_change_trend]` (line 1203)
- `[it_critical_systems_configuration_changes]` (line 1182)
- `[security_resilience_ds_security_events]` (line 9108)
- `[security_resilience_recent_security_events]` (line 2240)

### `cisco:dnac:client`

- **Status:** `pass`  **Field count:** 126  **Stanzas referencing:** 35  **Latency:** 972 ms

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
health.connectedScore, health.dataRateThreshold, health.discardsThreshold
health.isDataRateIncluded, health.isDiscardsIncluded, health.isLinkErrorIncluded
health.isRetriesIncluded, health.isRssiIncluded, health.isSnrIncluded
health.isUtilizationIncluded, health.linkErrorPercentageThreshold, health.onboardingScore
health.overallScore, health.retriesThreshold, health.rssiThreshold
health.snrThreshold, health.utilizationThreshold, id
ipv4Address, ipv6Addresses, isPrivateMacAddress
lastUpdatedTime, latency.background, latency.bestEffort
latency.video, latency.voice, macAddress
name, onboarding.aaaFailureReason, onboarding.aaaServerIp
onboarding.assocDoneTime, onboarding.assocFailureReason, onboarding.authDoneTime
onboarding.avgAssocDuration, onboarding.avgAuthDuration, onboarding.avgDhcpDuration
onboarding.avgRunDuration, onboarding.dhcpDoneTime, onboarding.dhcpFailureReason
onboarding.dhcpServerIp, onboarding.failedRoamingCount, onboarding.latestFailureReason
onboarding.maxAssocDuration, onboarding.maxAuthDuration, onboarding.maxDhcpDuration
onboarding.maxRoamingDuration, onboarding.maxRunDuration, onboarding.onboardingTime
onboarding.otherFailureReason, onboarding.roamingTime, onboarding.successfulRoamingCount
onboarding.totalRoamingAttempts, osType, osVersion
signature_id, siteHierarchy, siteHierarchyId
siteId, tracked, traffic.dnsRequestCount
traffic.dnsResponseCount, traffic.inDiscards, traffic.inUtilization
traffic.outDiscards, traffic.outUtilization, traffic.rxBytes
traffic.rxLinkErrorPercentage, traffic.rxPackets, traffic.rxRate
traffic.rxRetries, traffic.rxRetryPercentage, traffic.txBytes
traffic.txDropPercentage, traffic.txDrops, traffic.txLinkErrorPercentage
traffic.txPackets, traffic.txRate, traffic.usage
trustScore, type, userId
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
- `[clients_by_building_lookup_join_demo]` (line 10391)
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

- **Status:** `pass`  **Field count:** 11  **Stanzas referencing:** 25  **Latency:** 975 ms

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
- `[clienthealth_by_site_lookup_join]` (line 10417)
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

- **Status:** `pass`  **Field count:** 34  **Stanzas referencing:** 11  **Latency:** 990 ms

**Discovered fields**

```
AssociatedWLCIP, ComplianceComplianceType, ComplianceCount
ComplianceDetail, ComplianceDeviceCount, ComplianceDeviceID
ComplianceLastSyncTime, ComplianceLastUpdateTime, ComplianceState
ComplianceStatus, CompliantDeviceCount, DeviceFamily
DeviceName, DeviceRole, DeviceSeries
ImageVersion, IpAddress, LastUpdateTime
LastUpdated, MACAddress, ManageErrors
Manageability, Platform, Reachability
ReachabilityFailureReason, SerialNumber, SupportType
Uptime, UptimeSeconds, cisco_catalyst_center_host
cisco_catalyst_host, signature_id, timestamp
vendor_product
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

- **Status:** `pass`  **Field count:** 62  **Stanzas referencing:** 57  **Latency:** 778 ms

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
signature_id, vendor_product
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
- `[it_critical_systems_site_connectivity_score_trend]` (line 10152)
- `[it_critical_systems_site_link_availability_pct_trend]` (line 10178)
- `[it_critical_systems_sitelevel_health]` (line 1553)
- `[it_critical_systems_switch_count_by_location]` (line 1580)
- `[it_critical_systems_top_issue_devices]` (line 4897)
- `[it_critical_systems_topology_device_table]` (line 4922)
- `[it_critical_systems_topology_linkgraph]` (line 4944)
- `[it_critical_systems_topology_site_role]` (line 4969)
- `[it_critical_systems_unreachable_devices]` (line 4993)
- `[overview_link_auburndale_tallahassee_health]` (line 9838)
- `[overview_link_orlando_auburndale_health]` (line 9888)
- `[overview_link_orlando_tallahassee_health]` (line 9788)
- `[overview_operational_lead]` (line 9607)
- `[overview_site_auburndale_health]` (line 9759)
- `[overview_site_orlando_health]` (line 9730)
- `[overview_site_tallahassee_health]` (line 9701)
- `[overview_topology_overview]` (line 9480)
- `[shared_ds_dev_health_trend]` (line 10079)

### `cisco:dnac:issue`

- **Status:** `pass`  **Field count:** 37  **Stanzas referencing:** 21  **Latency:** 797 ms

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
IssueStatus, cisco_catalyst_host, signature_id
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
- `[it_critical_systems_site_bandwidth_pressure_24h_trend]` (line 10226)
- `[it_critical_systems_site_errors_discards_24h_trend]` (line 10248)
- `[it_critical_systems_site_link_events_24h_trend]` (line 10204)
- `[it_critical_systems_site_power_events_24h_trend]` (line 10270)
- `[security_resilience_rogue_device_detail]` (line 2193)
- `[security_resilience_rogue_device_detection]` (line 2169)

### `cisco:dnac:networkhealth`

- **Status:** `pass`  **Field count:** 18  **Stanzas referencing:** 11  **Latency:** 794 ms

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
- `[it_critical_systems_network_category_distribution_health_trend]` (line 10292)
- `[it_critical_systems_network_health_category_trend]` (line 4669)
- `[it_critical_systems_network_health_score]` (line 1531)
- `[it_critical_systems_network_health_trend]` (line 1510)
- `[it_critical_systems_weekoverweek_health]` (line 1647)

### `cisco:dnac:securityadvisory`

- **Status:** `pass`  **Field count:** 34  **Stanzas referencing:** 4  **Latency:** 800 ms

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

- **Status:** `pass`  **Field count:** 20  **Stanzas referencing:** 3  **Latency:** 766 ms

**Discovered fields**

```
address, cisco_catalyst_host, country
floorNumber, height, id
latitude, length, longitude
name, nameHierarchy, parentId
rfModel, signature_id, siteHierarchyId
timestamp, type, unitsOfMeasure
vendor_product, width
```

**Stanzas using this sourcetype**

- `[it_critical_systems_site_topology_event_type_distribution]` (line 1394)
- `[it_critical_systems_site_topology_recent_changes]` (line 1369)
- `[it_critical_systems_site_topology_site_type_distribution]` (line 1417)

