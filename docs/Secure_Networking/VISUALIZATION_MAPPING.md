# Visualization Mapping Report

Detailed mapping of existing dashboard panels to visualization requirements.

---

## Summary

- **Total Requirements:** 57
- **Requirements with Matched Panels:** 56
- **Requirements without Matches:** 1
- **Total Matched Panels:** 2779

---

## Detailed Requirement-to-Visualization Mappings

### Requirement 0: Broccoli assessment (device hardening state)

**Stated Visualization Support:** No

**Stated Supporting Apps:** —

**Matched Panels Found:** 69

#### Splunk_TA_cisco_meraki

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Ethernet Port Statuses (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$ 
| dedup serial
| rename name as "Device Name", ports{}.name as "Ports Name...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Devices Without Power Connectivity (table)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename power.ac.isConnected as ac , power.poe.isConnected...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** POE Standard Distribution (chart)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename ports{}.poe.standard as "POE Standard"
| stats cou...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Ports Speed (chart)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename ports{}.linkNegotiation.speed as "Port Speed"
| st...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Wireless Device Ethernet Status | Aggregation Status (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename aggregation.enabled as aggregation_enabled
| eval ...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Network Port Speeds (table)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| rename ports{}.linkNegotiation.speed as port_speed, network.id as "Netwo...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Networks with Most PoE Devices (chart)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename power.poe.isConnected as poe_connected, network.id...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Power Mode Distribution (chart)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename power.mode as "Power Mode"
| stats count by "Power...`

- **Dashboard:** Device Availabilities Change History
  - **Panel:** Top 10 Networks By Device Changes (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesavailabilitieschangehistory" $orgid$ 
| dedup device.serial
| rename network.name as "Network Name" 
| stats ...`

- **Dashboard:** Device Availabilities Change History
  - **Panel:** Top 10 Offline Devices (table)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesavailabilitieschangehistory" $orgid$ details.new{}.value="offline" 
| dedup device.serial
| rename device.nam...`

- **Dashboard:** Device Availabilities Change History
  - **Panel:** Devices Availabilities Change History (table)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesavailabilitieschangehistory" $orgid$ 
| dedup device.serial
| rename details.new{}.value as "New Status", det...`

- **Dashboard:** Device Availabilities Change History
  - **Panel:** Device Status History Over Time (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesavailabilitieschangehistory" $orgid$ 
| dedup device.serial
| rename details.new{}.value as new_status 
| tim...`

- **Dashboard:** Top Devices
  - **Panel:** Device Usage Metrics (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:summarytopdevicesbyusage" $orgid$
| dedup name network.id usage.total usage.percentage
| rename name as "Device Name...`

- **Dashboard:** Top Devices
  - **Panel:** Top 10 Networks By Device Usage (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:summarytopdevicesbyusage" $orgid$
| dedup name network.id usage.total usage.percentage
| rename network.name as "Net...`

- **Dashboard:** Top Devices
  - **Panel:** Device Usage Over Time (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:summarytopdevicesbyusage" $orgid$
| dedup name network.id usage.total usage.percentage
| rename name as "Device Name...`

- **Dashboard:** Appliance VPN Statuses
  - **Panel:** VPN Status Data (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:appliancesdwanstatuses" $orgid$ 
| rename networkName as "Network Name", deviceStatus as "Device Status", Subnet_Nam...`

- **Dashboard:** Wireless Device Packet Loss
  - **Panel:** Packet Loss By Network (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicespacketlossbydevice" $orgid$ 
| eval direction = mvappend("downstream", "upstream") 
| mvexpand direct...`

- **Dashboard:** Wireless Device Packet Loss
  - **Panel:** Total Packets v/s Lost Packets (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicespacketlossbydevice" $orgid$ 
| eval direction = mvappend("Downstream", "Upstream") 
| mvexpand direct...`

- **Dashboard:** Wireless Device Packet Loss
  - **Panel:** Top Networks with High Packet Loss (table)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicespacketlossbydevice" $orgid$ 
| rename upstream.lost as upstream_loss ,downstream.lost as downstream_l...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Total Alerts (single_value)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$ 
| dedup id 
| stats count as "Alert Count"...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Alert Count by Severity (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$
| dedup id
| rename severity as "Severity"
| stats count as "Alert Count" by Severity...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Alert Data (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$ 
| dedup id
| rename id as "Alert Id", startedAt as "Alert Time" , categoryType as "Categor...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Top Affected Networks (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$
| dedup id
| rename network.name as "Network Name", severity as "Severity Level"
| stats co...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Top Affected Devices (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$ 
| dedup id 
| rename scope.devices{}.name as "Device Name", severity as "Severity Level" 
...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Devices Uplinks History (table)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename name as "Device Name", uplinks{}.interface as "Int...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Uplink Interface Distribution (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename uplinks{}.interface as "Uplink Interface" 
| stats...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Address Assignment Modes (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename uplinks{}.addresses{}.assignmentMode as "Assignmen...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Protocol Distribution (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename uplinks{}.addresses{}.protocol as "Address Protoco...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Most Frequent Public Addresses (table)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$
| dedup serial
| rename uplinks{}.addresses{}.public.address as "Public Add...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Most Frequent Gateway IPs (table)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename uplinks{}.addresses{}.gateway as "Gateway" 
| stat...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Top 10 DNS Servers (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$
| dedup serial
| rename uplinks{}.addresses{}.nameservers.addresses{} as "D...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Top 10 Network Uplinks (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename network.id as "Network Id"
| stats count as Count ...`

#### TA_cisco_catalyst

- **Dashboard:** Splunk Resource Utilization
  - **Panel:** Process Health (chart)
  - **Query Preview:** `index=_internal sourcetype IN ("splunktaciscocybervision:log", "splunktaciscodnacenter:log", "splunktaciscoise:log", "splunktaciscosdwan:log") host IN...`

- **Dashboard:** Splunk Resource Utilization
  - **Panel:** Health Monitoring by Input Connection (table)
  - **Query Preview:** `index=_internal sourcetype IN ("splunktaciscocybervision:log", "splunktaciscodnacenter:log", "splunktaciscoise:log", "splunktaciscosdwan:log") host IN...`

#### cisco-catalyst-app

- **Dashboard:** Overview Reports
  - **Panel:** Network Device Types (chart)
  - **Matched Keywords:** device
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Center_Reports.Cisco_...`

- **Dashboard:** Sensors
  - **Panel:** Door Sensor Status - Latest Readings (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" 
    from datamodel=Cisco_Catalyst_App 
    where nodename=Cisco_Catalyst_Dataset.Cisco...`

- **Dashboard:** Users And Applications
  - **Panel:** User Authentication Status (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Authentication Status (chart)
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Overview
  - **Panel:** $client_type_health$ Clients Health Score (single_value)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Client_Inventory_And_...`

- **Dashboard:** Overview
  - **Panel:** Network Health Score - $health_category$ (single_value)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Network_Health_Events...`

- **Dashboard:** Security Insights
  - **Panel:** Device Compliance Status (chart)
  - **Matched Keywords:** device
  - **Query Preview:** `$Cisco Catalyst Center$ | tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Cataly...`

- **Dashboard:** Security Insights
  - **Panel:** Device Compliance State (chart)
  - **Matched Keywords:** device, state
  - **Query Preview:** `$Cisco Catalyst Center$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Compliance_...`

- **Dashboard:** Endpoint Compliance
  - **Panel:** Posture Status Trend Over Time (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events.ISE...`

- **Dashboard:** Network Insights
  - **Panel:** Device Manageability Type (chart)
  - **Matched Keywords:** device
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Health_Events.device_health_managea...`

- **Dashboard:** Network Insights
  - **Panel:** Device Reachability Type (chart)
  - **Matched Keywords:** device
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Health_Events.device_health_reachab...`

- **Dashboard:** Network Insights
  - **Panel:** Device Family Type (chart)
  - **Matched Keywords:** device
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Health_Events.device_health_device_...`

- **Dashboard:** Step 1 Device Classification
  - **Panel:** C2C-0.1.0 Reporting - USCYBERCOM Device Category (chart)
  - **Matched Keywords:** device
  - **Query Preview:** `| inputlookup cisco_catalyst_analytics_reports.csv
| eval filteredCybercom=mvfilter(match(cybercomCategory, `cisco_catalyst_CYBERCOM_Macro`) OR match(...`

- **Dashboard:** Step 1 Device Classification
  - **Panel:** C2C-0.1.1 Reporting - Operating System Summary (chart)
  - **Matched Keywords:** device
  - **Query Preview:** `| inputlookup cisco_catalyst_analytics_reports.csv
| stats count by MatchedPolicy
| sort 0 -count
| rename MatchedPolicy as "Operating System", count ...`

- **Dashboard:** Step 1 Device Classification
  - **Panel:** Untitled (table)
  - **Matched Keywords:** device
  - **Query Preview:** `| inputlookup cisco_catalyst_analytics_reports.csv
| eval filteredCybercom=mvfilter(match(cybercomCategory, `cisco_catalyst_CYBERCOM_Macro`) OR match(...`

- **Dashboard:** Step 1 Device Classification
  - **Panel:** Untitled (table)
  - **Matched Keywords:** device
  - **Query Preview:** `| inputlookup cisco_catalyst_analytics_reports.csv
| stats count by MatchedPolicy
| sort 0 -count
| rename MatchedPolicy as "Operating System", count ...`

- **Dashboard:** Network Compliance
  - **Panel:** Network Device Inventory (table)
  - **Matched Keywords:** device
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename IN (Cisco_Catalyst_Dataset.Cisco_Catalyst_Center_Reports.Ci...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** Client Health Score – Wired and Wireless (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Client_Inventory_And_...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** Endpoint Authentication Status (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** BYOD Device Enrollment (table)
  - **Matched Keywords:** device
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Performance
  - **Panel:** ISE System Health (table)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events by ...`

- **Dashboard:** Performance
  - **Panel:** Network System Health (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count(Cisco_Catalyst_Dataset.Cisco_Catalyst_Network_Performance_Events.network_performance_account_id) f...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Site Health (chart)
  - **Query Preview:** `| tstats `summariesonly` latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_Site_Health_Events.sdwan_site_health_site_health) as "Site Health" from da...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Link Health (chart)
  - **Query Preview:** `| tstats `summariesonly` count from datamodel=Cisco_Catalyst_App 
    where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_Link_Health
    by Ci...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Unified Threat Defense Health (chart)
  - **Query Preview:** `| tstats `summariesonly` latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_UTD_Health.sdwan_utd_health_status) as "Admin Status" from datamodel=Cisco...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Tunnel Health (chart)
  - **Query Preview:** `| tstats `summariesonly` count as Count latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_Tunnel_Health.sdwan_tunnel_health_health) as "Tunnel Health...`

#### cisco_sna_app

- **Dashboard:** Host Snapshot
  - **Panel:** Status: (table)
  - **Query Preview:** `| where row_type="host_status" | eval status_first_seen=strftime(strptime(status_first_seen."+0000","%Y-%m-%dT%H:%M:%SZ%z"),"%Y-%m-%d %H:%M:%S %Z") | ...`

#### ta_cisco_thousandeyes

- **Dashboard:** Data collection Status
  - **Panel:** Number of Streams (single_value)
  - **Query Preview:** `| tstats `summariesonly` dc(Test_Metrics.thousandeyes.stream.id) as count FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE Test_Metrics.thousand...`

- **Dashboard:** Data collection Status
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` count(Test_Metrics.thousandeyes.stream.id) FROM datamodel="Cisco_ThousandEyes.Test_Metrics"  WHERE Test_Metrics.thousandeyes....`

- **Dashboard:** Data collection Status
  - **Panel:** Number of Cloud & Enterprise Agent Tests and Endpoint Agent Tests (single_value)
  - **Query Preview:** `| tstats `summariesonly` dc(Test_Metrics.thousandeyes.test.id) as count FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE Test_Metrics.thousandey...`

- **Dashboard:** Data collection Status
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` values(Test_Metrics.thousandeyes.test.type) as "Test Types" values(Test_Metrics.thousandeyes.test.name) as "Test Name" FROM d...`

- **Dashboard:** Data collection Status
  - **Panel:** Number of Event Inputs (single_value)
  - **Query Preview:** `| tstats `summariesonly` dc(source) as count FROM datamodel="Cisco_ThousandEyes.Events"  WHERE Events.aid IN($tkn_acc_group$)...`

- **Dashboard:** Data collection Status
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` latest(_time) as time FROM datamodel="Cisco_ThousandEyes.Events"  WHERE Events.aid IN($tkn_acc_group$) BY source | eval sourc...`

- **Dashboard:** Data collection Status
  - **Panel:** Number of Activity Inputs (single_value)
  - **Query Preview:** `| tstats `summariesonly` dc(source) as count FROM datamodel="Cisco_ThousandEyes.Activities"  WHERE Activities.aid IN($tkn_acc_group$)...`

- **Dashboard:** Data collection Status
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` latest(_time) as time FROM datamodel="Cisco_ThousandEyes.Activities"  WHERE Activities.aid IN($tkn_acc_group$) BY source | ev...`

---

### Requirement 1: PQC (Post-Quantum Cryptography status)

**Stated Visualization Support:** No

**Stated Supporting Apps:** —

**Matched Panels Found:** 69

#### Splunk_TA_cisco_meraki

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Ethernet Port Statuses (table)
  - **Matched Keywords:** status
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$ 
| dedup serial
| rename name as "Device Name", ports{}.name as "Ports Name...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Devices Without Power Connectivity (table)
  - **Matched Keywords:** status
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename power.ac.isConnected as ac , power.poe.isConnected...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** POE Standard Distribution (chart)
  - **Matched Keywords:** status
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename ports{}.poe.standard as "POE Standard"
| stats cou...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Ports Speed (chart)
  - **Matched Keywords:** status
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename ports{}.linkNegotiation.speed as "Port Speed"
| st...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Wireless Device Ethernet Status | Aggregation Status (chart)
  - **Matched Keywords:** status
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename aggregation.enabled as aggregation_enabled
| eval ...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Network Port Speeds (table)
  - **Matched Keywords:** status
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| rename ports{}.linkNegotiation.speed as port_speed, network.id as "Netwo...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Networks with Most PoE Devices (chart)
  - **Matched Keywords:** status
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename power.poe.isConnected as poe_connected, network.id...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Power Mode Distribution (chart)
  - **Matched Keywords:** status
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename power.mode as "Power Mode"
| stats count by "Power...`

- **Dashboard:** Device Availabilities Change History
  - **Panel:** Top 10 Networks By Device Changes (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesavailabilitieschangehistory" $orgid$ 
| dedup device.serial
| rename network.name as "Network Name" 
| stats ...`

- **Dashboard:** Device Availabilities Change History
  - **Panel:** Top 10 Offline Devices (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesavailabilitieschangehistory" $orgid$ details.new{}.value="offline" 
| dedup device.serial
| rename device.nam...`

- **Dashboard:** Device Availabilities Change History
  - **Panel:** Devices Availabilities Change History (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesavailabilitieschangehistory" $orgid$ 
| dedup device.serial
| rename details.new{}.value as "New Status", det...`

- **Dashboard:** Device Availabilities Change History
  - **Panel:** Device Status History Over Time (chart)
  - **Matched Keywords:** status
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesavailabilitieschangehistory" $orgid$ 
| dedup device.serial
| rename details.new{}.value as new_status 
| tim...`

- **Dashboard:** Top Devices
  - **Panel:** Device Usage Metrics (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:summarytopdevicesbyusage" $orgid$
| dedup name network.id usage.total usage.percentage
| rename name as "Device Name...`

- **Dashboard:** Top Devices
  - **Panel:** Top 10 Networks By Device Usage (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:summarytopdevicesbyusage" $orgid$
| dedup name network.id usage.total usage.percentage
| rename network.name as "Net...`

- **Dashboard:** Top Devices
  - **Panel:** Device Usage Over Time (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:summarytopdevicesbyusage" $orgid$
| dedup name network.id usage.total usage.percentage
| rename name as "Device Name...`

- **Dashboard:** Appliance VPN Statuses
  - **Panel:** VPN Status Data (table)
  - **Matched Keywords:** status
  - **Query Preview:** ``meraki_index` sourcetype="meraki:appliancesdwanstatuses" $orgid$ 
| rename networkName as "Network Name", deviceStatus as "Device Status", Subnet_Nam...`

- **Dashboard:** Wireless Device Packet Loss
  - **Panel:** Packet Loss By Network (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicespacketlossbydevice" $orgid$ 
| eval direction = mvappend("downstream", "upstream") 
| mvexpand direct...`

- **Dashboard:** Wireless Device Packet Loss
  - **Panel:** Total Packets v/s Lost Packets (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicespacketlossbydevice" $orgid$ 
| eval direction = mvappend("Downstream", "Upstream") 
| mvexpand direct...`

- **Dashboard:** Wireless Device Packet Loss
  - **Panel:** Top Networks with High Packet Loss (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicespacketlossbydevice" $orgid$ 
| rename upstream.lost as upstream_loss ,downstream.lost as downstream_l...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Total Alerts (single_value)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$ 
| dedup id 
| stats count as "Alert Count"...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Alert Count by Severity (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$
| dedup id
| rename severity as "Severity"
| stats count as "Alert Count" by Severity...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Alert Data (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$ 
| dedup id
| rename id as "Alert Id", startedAt as "Alert Time" , categoryType as "Categor...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Top Affected Networks (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$
| dedup id
| rename network.name as "Network Name", severity as "Severity Level"
| stats co...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Top Affected Devices (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$ 
| dedup id 
| rename scope.devices{}.name as "Device Name", severity as "Severity Level" 
...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Devices Uplinks History (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename name as "Device Name", uplinks{}.interface as "Int...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Uplink Interface Distribution (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename uplinks{}.interface as "Uplink Interface" 
| stats...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Address Assignment Modes (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename uplinks{}.addresses{}.assignmentMode as "Assignmen...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Protocol Distribution (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename uplinks{}.addresses{}.protocol as "Address Protoco...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Most Frequent Public Addresses (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$
| dedup serial
| rename uplinks{}.addresses{}.public.address as "Public Add...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Most Frequent Gateway IPs (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename uplinks{}.addresses{}.gateway as "Gateway" 
| stat...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Top 10 DNS Servers (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$
| dedup serial
| rename uplinks{}.addresses{}.nameservers.addresses{} as "D...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Top 10 Network Uplinks (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename network.id as "Network Id"
| stats count as Count ...`

#### TA_cisco_catalyst

- **Dashboard:** Splunk Resource Utilization
  - **Panel:** Process Health (chart)
  - **Query Preview:** `index=_internal sourcetype IN ("splunktaciscocybervision:log", "splunktaciscodnacenter:log", "splunktaciscoise:log", "splunktaciscosdwan:log") host IN...`

- **Dashboard:** Splunk Resource Utilization
  - **Panel:** Health Monitoring by Input Connection (table)
  - **Query Preview:** `index=_internal sourcetype IN ("splunktaciscocybervision:log", "splunktaciscodnacenter:log", "splunktaciscoise:log", "splunktaciscosdwan:log") host IN...`

#### cisco-catalyst-app

- **Dashboard:** Overview Reports
  - **Panel:** Network Device Types (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Center_Reports.Cisco_...`

- **Dashboard:** Sensors
  - **Panel:** Door Sensor Status - Latest Readings (chart)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" 
    from datamodel=Cisco_Catalyst_App 
    where nodename=Cisco_Catalyst_Dataset.Cisco...`

- **Dashboard:** Users And Applications
  - **Panel:** User Authentication Status (table)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Authentication Status (chart)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Overview
  - **Panel:** $client_type_health$ Clients Health Score (single_value)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Client_Inventory_And_...`

- **Dashboard:** Overview
  - **Panel:** Network Health Score - $health_category$ (single_value)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Network_Health_Events...`

- **Dashboard:** Security Insights
  - **Panel:** Device Compliance Status (chart)
  - **Matched Keywords:** status
  - **Query Preview:** `$Cisco Catalyst Center$ | tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Cataly...`

- **Dashboard:** Security Insights
  - **Panel:** Device Compliance State (chart)
  - **Query Preview:** `$Cisco Catalyst Center$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Compliance_...`

- **Dashboard:** Endpoint Compliance
  - **Panel:** Posture Status Trend Over Time (chart)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events.ISE...`

- **Dashboard:** Network Insights
  - **Panel:** Device Manageability Type (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Health_Events.device_health_managea...`

- **Dashboard:** Network Insights
  - **Panel:** Device Reachability Type (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Health_Events.device_health_reachab...`

- **Dashboard:** Network Insights
  - **Panel:** Device Family Type (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Health_Events.device_health_device_...`

- **Dashboard:** Step 1 Device Classification
  - **Panel:** C2C-0.1.0 Reporting - USCYBERCOM Device Category (chart)
  - **Query Preview:** `| inputlookup cisco_catalyst_analytics_reports.csv
| eval filteredCybercom=mvfilter(match(cybercomCategory, `cisco_catalyst_CYBERCOM_Macro`) OR match(...`

- **Dashboard:** Step 1 Device Classification
  - **Panel:** C2C-0.1.1 Reporting - Operating System Summary (chart)
  - **Query Preview:** `| inputlookup cisco_catalyst_analytics_reports.csv
| stats count by MatchedPolicy
| sort 0 -count
| rename MatchedPolicy as "Operating System", count ...`

- **Dashboard:** Step 1 Device Classification
  - **Panel:** Untitled (table)
  - **Query Preview:** `| inputlookup cisco_catalyst_analytics_reports.csv
| eval filteredCybercom=mvfilter(match(cybercomCategory, `cisco_catalyst_CYBERCOM_Macro`) OR match(...`

- **Dashboard:** Step 1 Device Classification
  - **Panel:** Untitled (table)
  - **Query Preview:** `| inputlookup cisco_catalyst_analytics_reports.csv
| stats count by MatchedPolicy
| sort 0 -count
| rename MatchedPolicy as "Operating System", count ...`

- **Dashboard:** Network Compliance
  - **Panel:** Network Device Inventory (table)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename IN (Cisco_Catalyst_Dataset.Cisco_Catalyst_Center_Reports.Ci...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** Client Health Score – Wired and Wireless (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Client_Inventory_And_...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** Endpoint Authentication Status (table)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** BYOD Device Enrollment (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Performance
  - **Panel:** ISE System Health (table)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events by ...`

- **Dashboard:** Performance
  - **Panel:** Network System Health (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count(Cisco_Catalyst_Dataset.Cisco_Catalyst_Network_Performance_Events.network_performance_account_id) f...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Site Health (chart)
  - **Query Preview:** `| tstats `summariesonly` latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_Site_Health_Events.sdwan_site_health_site_health) as "Site Health" from da...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Link Health (chart)
  - **Query Preview:** `| tstats `summariesonly` count from datamodel=Cisco_Catalyst_App 
    where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_Link_Health
    by Ci...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Unified Threat Defense Health (chart)
  - **Query Preview:** `| tstats `summariesonly` latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_UTD_Health.sdwan_utd_health_status) as "Admin Status" from datamodel=Cisco...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Tunnel Health (chart)
  - **Query Preview:** `| tstats `summariesonly` count as Count latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_Tunnel_Health.sdwan_tunnel_health_health) as "Tunnel Health...`

#### cisco_sna_app

- **Dashboard:** Host Snapshot
  - **Panel:** Status: (table)
  - **Matched Keywords:** status
  - **Query Preview:** `| where row_type="host_status" | eval status_first_seen=strftime(strptime(status_first_seen."+0000","%Y-%m-%dT%H:%M:%SZ%z"),"%Y-%m-%d %H:%M:%S %Z") | ...`

#### ta_cisco_thousandeyes

- **Dashboard:** Data collection Status
  - **Panel:** Number of Streams (single_value)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` dc(Test_Metrics.thousandeyes.stream.id) as count FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE Test_Metrics.thousand...`

- **Dashboard:** Data collection Status
  - **Panel:** Untitled (table)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` count(Test_Metrics.thousandeyes.stream.id) FROM datamodel="Cisco_ThousandEyes.Test_Metrics"  WHERE Test_Metrics.thousandeyes....`

- **Dashboard:** Data collection Status
  - **Panel:** Number of Cloud & Enterprise Agent Tests and Endpoint Agent Tests (single_value)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` dc(Test_Metrics.thousandeyes.test.id) as count FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE Test_Metrics.thousandey...`

- **Dashboard:** Data collection Status
  - **Panel:** Untitled (table)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` values(Test_Metrics.thousandeyes.test.type) as "Test Types" values(Test_Metrics.thousandeyes.test.name) as "Test Name" FROM d...`

- **Dashboard:** Data collection Status
  - **Panel:** Number of Event Inputs (single_value)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` dc(source) as count FROM datamodel="Cisco_ThousandEyes.Events"  WHERE Events.aid IN($tkn_acc_group$)...`

- **Dashboard:** Data collection Status
  - **Panel:** Untitled (table)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` latest(_time) as time FROM datamodel="Cisco_ThousandEyes.Events"  WHERE Events.aid IN($tkn_acc_group$) BY source | eval sourc...`

- **Dashboard:** Data collection Status
  - **Panel:** Number of Activity Inputs (single_value)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` dc(source) as count FROM datamodel="Cisco_ThousandEyes.Activities"  WHERE Activities.aid IN($tkn_acc_group$)...`

- **Dashboard:** Data collection Status
  - **Panel:** Untitled (table)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` latest(_time) as time FROM datamodel="Cisco_ThousandEyes.Activities"  WHERE Activities.aid IN($tkn_acc_group$) BY source | ev...`

---

### Requirement 2: VRFs, VLANs, VXLANs, SGTs (Segmentation baseline)

**Stated Visualization Support:** Partial

**Stated Supporting Apps:** Cisco Catalyst Add-on for Splunk, Cisco Enterprise Networking for Splunk Platform

**Matched Panels Found:** 2

#### cisco-catalyst-app

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Security Group Tag by Authentication (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events by ...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** IP-SGT Bindings (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_IP_SGT_Bindings by Ci...`

---

### Requirement 3: SGT by Site / Device

**Stated Visualization Support:** Partial

**Stated Supporting Apps:** Splunk Add-on for Cisco Identity Services, Cisco Enterprise Networking for Splunk Platform

**Matched Panels Found:** 71

#### Splunk_TA_cisco_meraki

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Ethernet Port Statuses (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$ 
| dedup serial
| rename name as "Device Name", ports{}.name as "Ports Name...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Devices Without Power Connectivity (table)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename power.ac.isConnected as ac , power.poe.isConnected...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** POE Standard Distribution (chart)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename ports{}.poe.standard as "POE Standard"
| stats cou...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Ports Speed (chart)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename ports{}.linkNegotiation.speed as "Port Speed"
| st...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Wireless Device Ethernet Status | Aggregation Status (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename aggregation.enabled as aggregation_enabled
| eval ...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Network Port Speeds (table)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| rename ports{}.linkNegotiation.speed as port_speed, network.id as "Netwo...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Networks with Most PoE Devices (chart)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename power.poe.isConnected as poe_connected, network.id...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Power Mode Distribution (chart)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename power.mode as "Power Mode"
| stats count by "Power...`

- **Dashboard:** Device Availabilities Change History
  - **Panel:** Top 10 Networks By Device Changes (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesavailabilitieschangehistory" $orgid$ 
| dedup device.serial
| rename network.name as "Network Name" 
| stats ...`

- **Dashboard:** Device Availabilities Change History
  - **Panel:** Top 10 Offline Devices (table)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesavailabilitieschangehistory" $orgid$ details.new{}.value="offline" 
| dedup device.serial
| rename device.nam...`

- **Dashboard:** Device Availabilities Change History
  - **Panel:** Devices Availabilities Change History (table)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesavailabilitieschangehistory" $orgid$ 
| dedup device.serial
| rename details.new{}.value as "New Status", det...`

- **Dashboard:** Device Availabilities Change History
  - **Panel:** Device Status History Over Time (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesavailabilitieschangehistory" $orgid$ 
| dedup device.serial
| rename details.new{}.value as new_status 
| tim...`

- **Dashboard:** Top Devices
  - **Panel:** Device Usage Metrics (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:summarytopdevicesbyusage" $orgid$
| dedup name network.id usage.total usage.percentage
| rename name as "Device Name...`

- **Dashboard:** Top Devices
  - **Panel:** Top 10 Networks By Device Usage (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:summarytopdevicesbyusage" $orgid$
| dedup name network.id usage.total usage.percentage
| rename network.name as "Net...`

- **Dashboard:** Top Devices
  - **Panel:** Device Usage Over Time (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:summarytopdevicesbyusage" $orgid$
| dedup name network.id usage.total usage.percentage
| rename name as "Device Name...`

- **Dashboard:** Appliance VPN Statuses
  - **Panel:** VPN Status Data (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:appliancesdwanstatuses" $orgid$ 
| rename networkName as "Network Name", deviceStatus as "Device Status", Subnet_Nam...`

- **Dashboard:** Wireless Device Packet Loss
  - **Panel:** Packet Loss By Network (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicespacketlossbydevice" $orgid$ 
| eval direction = mvappend("downstream", "upstream") 
| mvexpand direct...`

- **Dashboard:** Wireless Device Packet Loss
  - **Panel:** Total Packets v/s Lost Packets (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicespacketlossbydevice" $orgid$ 
| eval direction = mvappend("Downstream", "Upstream") 
| mvexpand direct...`

- **Dashboard:** Wireless Device Packet Loss
  - **Panel:** Top Networks with High Packet Loss (table)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicespacketlossbydevice" $orgid$ 
| rename upstream.lost as upstream_loss ,downstream.lost as downstream_l...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Total Alerts (single_value)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$ 
| dedup id 
| stats count as "Alert Count"...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Alert Count by Severity (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$
| dedup id
| rename severity as "Severity"
| stats count as "Alert Count" by Severity...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Alert Data (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$ 
| dedup id
| rename id as "Alert Id", startedAt as "Alert Time" , categoryType as "Categor...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Top Affected Networks (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$
| dedup id
| rename network.name as "Network Name", severity as "Severity Level"
| stats co...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Top Affected Devices (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$ 
| dedup id 
| rename scope.devices{}.name as "Device Name", severity as "Severity Level" 
...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Devices Uplinks History (table)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename name as "Device Name", uplinks{}.interface as "Int...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Uplink Interface Distribution (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename uplinks{}.interface as "Uplink Interface" 
| stats...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Address Assignment Modes (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename uplinks{}.addresses{}.assignmentMode as "Assignmen...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Protocol Distribution (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename uplinks{}.addresses{}.protocol as "Address Protoco...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Most Frequent Public Addresses (table)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$
| dedup serial
| rename uplinks{}.addresses{}.public.address as "Public Add...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Most Frequent Gateway IPs (table)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename uplinks{}.addresses{}.gateway as "Gateway" 
| stat...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Top 10 DNS Servers (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$
| dedup serial
| rename uplinks{}.addresses{}.nameservers.addresses{} as "D...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Top 10 Network Uplinks (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename network.id as "Network Id"
| stats count as Count ...`

#### TA_cisco_catalyst

- **Dashboard:** Splunk Resource Utilization
  - **Panel:** Process Health (chart)
  - **Query Preview:** `index=_internal sourcetype IN ("splunktaciscocybervision:log", "splunktaciscodnacenter:log", "splunktaciscoise:log", "splunktaciscosdwan:log") host IN...`

- **Dashboard:** Splunk Resource Utilization
  - **Panel:** Health Monitoring by Input Connection (table)
  - **Query Preview:** `index=_internal sourcetype IN ("splunktaciscocybervision:log", "splunktaciscodnacenter:log", "splunktaciscoise:log", "splunktaciscosdwan:log") host IN...`

#### cisco-catalyst-app

- **Dashboard:** Overview Reports
  - **Panel:** Network Device Types (chart)
  - **Matched Keywords:** device
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Center_Reports.Cisco_...`

- **Dashboard:** Sensors
  - **Panel:** Door Sensor Status - Latest Readings (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" 
    from datamodel=Cisco_Catalyst_App 
    where nodename=Cisco_Catalyst_Dataset.Cisco...`

- **Dashboard:** Users And Applications
  - **Panel:** User Authentication Status (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Authentication Status (chart)
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Security Group Tag by Authentication (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events by ...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** IP-SGT Bindings (chart)
  - **Matched Keywords:** sgt
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_IP_SGT_Bindings by Ci...`

- **Dashboard:** Overview
  - **Panel:** $client_type_health$ Clients Health Score (single_value)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Client_Inventory_And_...`

- **Dashboard:** Overview
  - **Panel:** Network Health Score - $health_category$ (single_value)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Network_Health_Events...`

- **Dashboard:** Security Insights
  - **Panel:** Device Compliance Status (chart)
  - **Matched Keywords:** device
  - **Query Preview:** `$Cisco Catalyst Center$ | tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Cataly...`

- **Dashboard:** Security Insights
  - **Panel:** Device Compliance State (chart)
  - **Matched Keywords:** device
  - **Query Preview:** `$Cisco Catalyst Center$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Compliance_...`

- **Dashboard:** Endpoint Compliance
  - **Panel:** Posture Status Trend Over Time (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events.ISE...`

- **Dashboard:** Network Insights
  - **Panel:** Device Manageability Type (chart)
  - **Matched Keywords:** device
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Health_Events.device_health_managea...`

- **Dashboard:** Network Insights
  - **Panel:** Device Reachability Type (chart)
  - **Matched Keywords:** device
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Health_Events.device_health_reachab...`

- **Dashboard:** Network Insights
  - **Panel:** Device Family Type (chart)
  - **Matched Keywords:** device
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Health_Events.device_health_device_...`

- **Dashboard:** Step 1 Device Classification
  - **Panel:** C2C-0.1.0 Reporting - USCYBERCOM Device Category (chart)
  - **Matched Keywords:** device
  - **Query Preview:** `| inputlookup cisco_catalyst_analytics_reports.csv
| eval filteredCybercom=mvfilter(match(cybercomCategory, `cisco_catalyst_CYBERCOM_Macro`) OR match(...`

- **Dashboard:** Step 1 Device Classification
  - **Panel:** C2C-0.1.1 Reporting - Operating System Summary (chart)
  - **Matched Keywords:** device
  - **Query Preview:** `| inputlookup cisco_catalyst_analytics_reports.csv
| stats count by MatchedPolicy
| sort 0 -count
| rename MatchedPolicy as "Operating System", count ...`

- **Dashboard:** Step 1 Device Classification
  - **Panel:** Untitled (table)
  - **Matched Keywords:** device
  - **Query Preview:** `| inputlookup cisco_catalyst_analytics_reports.csv
| eval filteredCybercom=mvfilter(match(cybercomCategory, `cisco_catalyst_CYBERCOM_Macro`) OR match(...`

- **Dashboard:** Step 1 Device Classification
  - **Panel:** Untitled (table)
  - **Matched Keywords:** device
  - **Query Preview:** `| inputlookup cisco_catalyst_analytics_reports.csv
| stats count by MatchedPolicy
| sort 0 -count
| rename MatchedPolicy as "Operating System", count ...`

- **Dashboard:** Network Compliance
  - **Panel:** Network Device Inventory (table)
  - **Matched Keywords:** device
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename IN (Cisco_Catalyst_Dataset.Cisco_Catalyst_Center_Reports.Ci...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** Client Health Score – Wired and Wireless (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Client_Inventory_And_...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** Endpoint Authentication Status (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** BYOD Device Enrollment (table)
  - **Matched Keywords:** device
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Performance
  - **Panel:** ISE System Health (table)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events by ...`

- **Dashboard:** Performance
  - **Panel:** Network System Health (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count(Cisco_Catalyst_Dataset.Cisco_Catalyst_Network_Performance_Events.network_performance_account_id) f...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Site Health (chart)
  - **Matched Keywords:** site
  - **Query Preview:** `| tstats `summariesonly` latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_Site_Health_Events.sdwan_site_health_site_health) as "Site Health" from da...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Link Health (chart)
  - **Query Preview:** `| tstats `summariesonly` count from datamodel=Cisco_Catalyst_App 
    where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_Link_Health
    by Ci...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Unified Threat Defense Health (chart)
  - **Query Preview:** `| tstats `summariesonly` latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_UTD_Health.sdwan_utd_health_status) as "Admin Status" from datamodel=Cisco...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Tunnel Health (chart)
  - **Query Preview:** `| tstats `summariesonly` count as Count latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_Tunnel_Health.sdwan_tunnel_health_health) as "Tunnel Health...`

#### cisco_sna_app

- **Dashboard:** Host Snapshot
  - **Panel:** Status: (table)
  - **Query Preview:** `| where row_type="host_status" | eval status_first_seen=strftime(strptime(status_first_seen."+0000","%Y-%m-%dT%H:%M:%SZ%z"),"%Y-%m-%d %H:%M:%S %Z") | ...`

#### ta_cisco_thousandeyes

- **Dashboard:** Data collection Status
  - **Panel:** Number of Streams (single_value)
  - **Query Preview:** `| tstats `summariesonly` dc(Test_Metrics.thousandeyes.stream.id) as count FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE Test_Metrics.thousand...`

- **Dashboard:** Data collection Status
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` count(Test_Metrics.thousandeyes.stream.id) FROM datamodel="Cisco_ThousandEyes.Test_Metrics"  WHERE Test_Metrics.thousandeyes....`

- **Dashboard:** Data collection Status
  - **Panel:** Number of Cloud & Enterprise Agent Tests and Endpoint Agent Tests (single_value)
  - **Query Preview:** `| tstats `summariesonly` dc(Test_Metrics.thousandeyes.test.id) as count FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE Test_Metrics.thousandey...`

- **Dashboard:** Data collection Status
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` values(Test_Metrics.thousandeyes.test.type) as "Test Types" values(Test_Metrics.thousandeyes.test.name) as "Test Name" FROM d...`

- **Dashboard:** Data collection Status
  - **Panel:** Number of Event Inputs (single_value)
  - **Query Preview:** `| tstats `summariesonly` dc(source) as count FROM datamodel="Cisco_ThousandEyes.Events"  WHERE Events.aid IN($tkn_acc_group$)...`

- **Dashboard:** Data collection Status
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` latest(_time) as time FROM datamodel="Cisco_ThousandEyes.Events"  WHERE Events.aid IN($tkn_acc_group$) BY source | eval sourc...`

- **Dashboard:** Data collection Status
  - **Panel:** Number of Activity Inputs (single_value)
  - **Query Preview:** `| tstats `summariesonly` dc(source) as count FROM datamodel="Cisco_ThousandEyes.Activities"  WHERE Activities.aid IN($tkn_acc_group$)...`

- **Dashboard:** Data collection Status
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` latest(_time) as time FROM datamodel="Cisco_ThousandEyes.Activities"  WHERE Activities.aid IN($tkn_acc_group$) BY source | ev...`

---

### Requirement 4: SGT Sankey (permit/deny policy flows)

**Stated Visualization Support:** No

**Stated Supporting Apps:** Splunk Add-on for Cisco Identity Services

**Matched Panels Found:** 23

#### cisco-catalyst-app

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Meraki Policy Sync (chart)
  - **Matched Keywords:** policy
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events.ISE...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Security Group Tag by Authentication (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events by ...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** IP-SGT Bindings (chart)
  - **Matched Keywords:** sgt
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_IP_SGT_Bindings by Ci...`

- **Dashboard:** Overview
  - **Panel:** Top Policy Hits for SD-WAN (chart)
  - **Matched Keywords:** policy
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Overview
  - **Panel:** Top Policy Set Hits for Cisco ISE (chart)
  - **Matched Keywords:** policy
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Policy_Events by Cisc...`

- **Dashboard:** Security Insights
  - **Panel:** Dropped FW Flows (table)
  - **Matched Keywords:** flows
  - **Query Preview:** `$Cisco SD-WAN$ | tstats fillnull_value="N/A" `summariesonly` count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Ci...`

- **Dashboard:** Security Insights
  - **Panel:** Inspected FW Flows (table)
  - **Matched Keywords:** flows
  - **Query Preview:** `$Cisco SD-WAN$ | tstats fillnull_value="N/A" `summariesonly` count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Ci...`

- **Dashboard:** Security Insights
  - **Panel:** ISE Authentication Policy Chart (chart)
  - **Matched Keywords:** policy
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** ISE Authorization Policy Chart (chart)
  - **Matched Keywords:** policy
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

#### cisco_sna_app

- **Dashboard:** User Report
  - **Panel:** Flows (Last 24 Hours): (table)
  - **Matched Keywords:** flows
  - **Query Preview:** `| eval firstActiveTime=strftime(strptime(firstActiveTime, "%Y-%m-%dT%H:%M:%S"),"%Y-%m-%d %H:%M:%S") |
                eval lastActiveTime=strftime(str...`

- **Dashboard:** Host Snapshot
  - **Panel:** Most Recent Flows (table)
  - **Matched Keywords:** flows
  - **Query Preview:** `| where row_type="host_flows" and origin_list="most-recent" | eval start_time=strftime(strptime(start_time."+0000","%Y-%m-%dT%H:%M:%SZ%z"),"%Y-%m-%d %...`

- **Dashboard:** Host Snapshot
  - **Panel:** High Traffic Flows (table)
  - **Matched Keywords:** flows
  - **Query Preview:** `| where row_type="host_flows" and origin_list="highest-traffic" | eval start_time=strftime(strptime(start_time."+0000","%Y-%m-%dT%H:%M:%SZ%z"),"%Y-%m-...`

- **Dashboard:** Host Snapshot
  - **Panel:** Interfaces Seeing This Host as a Source in Active Flows (table)
  - **Matched Keywords:** flows
  - **Query Preview:** `| where row_type="host_interface_active_source" | sort 0 + "exporter_ip", "if_index", "direction" | eval current_pps = tostring(current_pps, "commas")...`

- **Dashboard:** Host Snapshot
  - **Panel:** Interfaces Seeing This Host as a Destination in Active Flows (table)
  - **Matched Keywords:** flows
  - **Query Preview:** `| where row_type="host_interface_active_destination" | sort 0 + "exporter_ip", "if_index", "direction" | eval current_pps = tostring(current_pps, "com...`

- **Dashboard:** Top Reports
  - **Panel:** Top Applications by Flows: (chart)
  - **Matched Keywords:** flows
  - **Query Preview:** `| where rowType="results" and reportType="applications" | rename "applicationName" as "Application" | chart values("flows") as "Flows" by "Application...`

- **Dashboard:** Top Reports
  - **Panel:** Top Conversations by Flows: (chart)
  - **Matched Keywords:** flows
  - **Query Preview:** `| where rowType="results" and reportType="conversations" | eval conversation_str=hostIp." <-> ".peerIp  | rename "conversation_str" as "Conversation" ...`

- **Dashboard:** Top Reports
  - **Panel:** Top Hosts by Flows: (chart)
  - **Matched Keywords:** flows
  - **Query Preview:** `| where rowType="results" and reportType="hosts" | rename "hostIp" as "Host" | chart values("flows") as "Flows" by "Host"...`

- **Dashboard:** Top Reports
  - **Panel:** Top Peers by Flows: (chart)
  - **Matched Keywords:** flows
  - **Query Preview:** `| where rowType="results" and reportType="peers" | rename "peerIp" as "Peer" | chart values("flows") as "Flows" by "Peer"...`

- **Dashboard:** Top Reports
  - **Panel:** Top Ports by Flows: (chart)
  - **Matched Keywords:** flows
  - **Query Preview:** `| where rowType="results" and reportType="ports" | eval port_str=if(isnull(port), protocol, port."/".protocol) | rename "port_str" as "Port/Protocol" ...`

- **Dashboard:** Top Reports
  - **Panel:** Top Protocols by Flows: (chart)
  - **Matched Keywords:** flows
  - **Query Preview:** `| where rowType="results" and reportType="protocols" | rename "protocol" as "Protocol" | chart values("flows") as "Flows" by "Protocol"...`

- **Dashboard:** Top Reports
  - **Panel:** Top Services by Flows: (chart)
  - **Matched Keywords:** flows
  - **Query Preview:** `| where rowType="results" and reportType="services" | rename "serviceName" as "Service" | chart values("flows") as "Flows" by "Service"...`

- **Dashboard:** Flows
  - **Panel:** Results (table)
  - **Matched Keywords:** flows
  - **Query Preview:** `| eval firstActiveTime=strftime(strptime(firstActiveTime, "%Y-%m-%dT%H:%M:%S"),"%Y-%m-%d %H:%M:%S") |
                eval lastActiveTime=strftime(str...`

- **Dashboard:** Flows
  - **Panel:** Untitled (table)
  - **Matched Keywords:** flows

---

### Requirement 5: SGT Sankey by Business Service

**Stated Visualization Support:** No

**Stated Supporting Apps:** —

**Matched Panels Found:** 2

#### cisco-catalyst-app

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Security Group Tag by Authentication (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events by ...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** IP-SGT Bindings (chart)
  - **Matched Keywords:** sgt
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_IP_SGT_Bindings by Ci...`

---

### Requirement 6: SGT traffic stats / alerts / thresholds

**Stated Visualization Support:** Partial

**Stated Supporting Apps:** Splunk Add-on for Cisco Identity Services, Cisco Secure Network Analytics Add-on for Splunk

**Matched Panels Found:** 87

#### Splunk_TA_cisco-ise

- **Dashboard:** Cisco ISE TA Troubleshooting Dashboard
  - **Panel:** Network Traffic (single_value)
  - **Matched Keywords:** traffic
  - **Query Preview:** `| pivot Network_Traffic All_Traffic count(All_Traffic) AS "Count of All Traffic" FILTER sourcetype is "cisco:ise:syslog" ROWSUMMARY 0 COLSUMMARY 0 SHO...`

- **Dashboard:** Cisco ISE TA Troubleshooting Dashboard
  - **Panel:** Alerts (single_value)
  - **Matched Keywords:** alerts
  - **Query Preview:** `| pivot Alerts Alerts count(Alerts) AS "Count of Alerts" FILTER sourcetype is "cisco:ise:syslog" ROWSUMMARY 0 COLSUMMARY 0 SHOWOTHER 1...`

#### Splunk_TA_cisco_meraki

- **Dashboard:** Appliance VPN Stats
  - **Panel:** Average Latency (single_value)
  - **Matched Keywords:** stats
  - **Query Preview:** ``meraki_index` sourcetype="meraki:appliancesdwanstatistics" $orgid$ 
| stats avg(merakiVpnPeers{}.latencySummaries{}.avgLatencyMs) as Average_Latency ...`

- **Dashboard:** Appliance VPN Stats
  - **Panel:** Average Loss (single_value)
  - **Matched Keywords:** stats
  - **Query Preview:** ``meraki_index` sourcetype="meraki:appliancesdwanstatistics" $orgid$ 
| stats avg(merakiVpnPeers{}.lossPercentageSummaries{}.avgLossPercentage) as Aver...`

- **Dashboard:** Appliance VPN Stats
  - **Panel:** VPN Metrics (table)
  - **Matched Keywords:** stats
  - **Query Preview:** ``meraki_index` sourcetype="meraki:appliancesdwanstatistics" $orgid$
| rename networkId as "Network ID", networkName as "Network Name", merakiVpnPeers{...`

- **Dashboard:** Appliance VPN Stats
  - **Panel:** Average Jitter (table)
  - **Matched Keywords:** stats
  - **Query Preview:** ``meraki_index` sourcetype="meraki:appliancesdwanstatistics" $orgid$ 
| rename merakiVpnPeers{}.jitterSummaries{}.senderUplink as "Sender Uplink", mera...`

- **Dashboard:** Organizations Security
  - **Panel:** Blocked Alerts Count (chart)
  - **Matched Keywords:** alerts
  - **Query Preview:** ``meraki_index` sourcetype="meraki:organizationsecurity" $orgid$
| stats count as Count by blocked
| rename blocked as "Blocked"...`

- **Dashboard:** Organizations Security
  - **Panel:** Details of Alerts (table)
  - **Matched Keywords:** alerts
  - **Query Preview:** ``meraki_index` sourcetype="meraki:organizationsecurity" $orgid$
| rename eventType as "Event Type", deviceMac as "Device Mac", signature as "Signature...`

- **Dashboard:** Organizations Security
  - **Panel:** Alerts Over Time (chart)
  - **Matched Keywords:** alerts
  - **Query Preview:** ``meraki_index` sourcetype="meraki:organizationsecurity" $orgid$
| timechart count as "Alert Count" span=1d...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Network Port Speeds (table)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| rename ports{}.linkNegotiation.speed as port_speed, network.id as "Netwo...`

- **Dashboard:** Camera Data
  - **Panel:** Cameras Count By Network (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:cameras" $orgid$
| stats count as Count by networkId
| rename networkId as "Netrwork Id"...`

- **Dashboard:** Wireless Device Packet Loss
  - **Panel:** Packet Loss By Network (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicespacketlossbydevice" $orgid$ 
| eval direction = mvappend("downstream", "upstream") 
| mvexpand direct...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Total Alerts (single_value)
  - **Matched Keywords:** alerts
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$ 
| dedup id 
| stats count as "Alert Count"...`

- **Dashboard:** Top Switches
  - **Panel:** Top 10 Network by Energy Usage (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:summarytopswitchesbyenergyusage" $orgid$
| rename network.name as "Network Name" 
| stats sum(usage.total) as "Total...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Top 10 Network Uplinks (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename network.id as "Network Id"
| stats count as Count ...`

- **Dashboard:** Top Clients
  - **Panel:** Total Usage By Network (in MB) (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:summarytopclientsbyusage" $orgid$
| dedup id
| rename network.name as "Network Name"
| stats sum(usage.total) as "To...`

#### cisco-catalyst-app

- **Dashboard:** Overview Reports
  - **Panel:** Network Device Types (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Center_Reports.Cisco_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Security Group Tag by Authentication (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events by ...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** IP-SGT Bindings (chart)
  - **Matched Keywords:** sgt
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_IP_SGT_Bindings by Ci...`

- **Dashboard:** Overview
  - **Panel:** Network Health Score - $health_category$ (single_value)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Network_Health_Events...`

- **Dashboard:** Network Insights
  - **Panel:** Device Manageability Type (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Health_Events.device_health_managea...`

- **Dashboard:** Network Insights
  - **Panel:** Device Reachability Type (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Health_Events.device_health_reachab...`

- **Dashboard:** Network Insights
  - **Panel:** Device Family Type (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Health_Events.device_health_device_...`

- **Dashboard:** Network Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Network Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Network Insights
  - **Panel:** Network Devices By Type (table)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Type_Events Ci...`

- **Dashboard:** Network Insights
  - **Panel:** Top 10 Talkers (chart)
  - **Query Preview:** ``cisco_catalyst_app_index` sourcetype="cisco:cybervision:flows" | stats count by host...`

- **Dashboard:** Network Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Network Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** ``cisco_catalyst_app_index` sourcetype="cisco:cybervision:flows" host="$flows_host$"
                | rename left.label as Source, right.label as Dest...`

- **Dashboard:** Network Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events Cis...`

- **Dashboard:** Network Insights
  - **Panel:** ISE $authentication_latency_type$ Authentication Latency (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events
Cis...`

- **Dashboard:** Network Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Network Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events
   ...`

- **Dashboard:** Network Insights
  - **Panel:** ISE Top 10 Active Endpoints (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events Cis...`

- **Dashboard:** Network Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Network Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events Cis...`

- **Dashboard:** Network Insights
  - **Panel:** Top Networks with High Packet Loss (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App 
  where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst...`

- **Dashboard:** Network Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Network Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Packet_Loss_Details b...`

- **Dashboard:** Network Insights
  - **Panel:** Top 10 Offline Devices (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count 
  from datamodel=Cisco_Catalyst_App 
  where nodename=Cisco_Catalyst_Dataset.Cisco_Catal...`

- **Dashboard:** Network Compliance
  - **Panel:** Catalyst Center NonCompliant Total (single_value)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Center_Reports.Cisco_...`

- **Dashboard:** Network Compliance
  - **Panel:** Catalyst Center Inventory Total (single_value)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Center_Reports.Cisco_...`

- **Dashboard:** Network Compliance
  - **Panel:** NonCompliant Network Devices (table)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Center_Reports.Cisco_...`

- **Dashboard:** Network Compliance
  - **Panel:** Network Device Inventory (table)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename IN (Cisco_Catalyst_Dataset.Cisco_Catalyst_Center_Reports.Ci...`

- **Dashboard:** Performance
  - **Panel:** Network System Health (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count(Cisco_Catalyst_Dataset.Cisco_Catalyst_Network_Performance_Events.network_performance_account_id) f...`

- **Dashboard:** Performance
  - **Panel:** Network Latency (Seconds) (chart)
  - **Query Preview:** `| tstats `summariesonly` avg(Cisco_Catalyst_Dataset.Cisco_Catalyst_Network_Performance_Events.network_performance_network_latency) as avg_latency from...`

- **Dashboard:** Performance
  - **Panel:** Network Loss (Percentage) (chart)
  - **Query Preview:** `| tstats `summariesonly` avg(Cisco_Catalyst_Dataset.Cisco_Catalyst_Network_Performance_Events.network_performance_network_loss) as avg_loss from datam...`

- **Dashboard:** Performance
  - **Panel:** Network Jitter (Milliseconds) (chart)
  - **Query Preview:** `| tstats `summariesonly` avg(Cisco_Catalyst_Dataset.Cisco_Catalyst_Network_Performance_Events.network_performance_network_jitter) as avg_jitter from d...`

#### cisco-cloud-security

- **Dashboard:** Alerts Dashboard
  - **Panel:** Untitled (table)
  - **Matched Keywords:** alerts

#### cisco_sna_app

- **Dashboard:** Host Snapshot
  - **Panel:** Total Traffic (bytes): (single_value)
  - **Matched Keywords:** traffic
  - **Query Preview:** `| where row_type="host_traffic_summary" | fields "total_bytes"...`

- **Dashboard:** Host Snapshot
  - **Panel:** Traffic Summary (table)
  - **Matched Keywords:** traffic
  - **Query Preview:** `| where row_type="host_traffic" | sort 0 + "fc_name" | eval total_packets_received = tostring(total_packets_received, "commas"), total_packets_sent = ...`

- **Dashboard:** Host Snapshot
  - **Panel:** High Traffic Flows (table)
  - **Matched Keywords:** traffic
  - **Query Preview:** `| where row_type="host_flows" and origin_list="highest-traffic" | eval start_time=strftime(strptime(start_time."+0000","%Y-%m-%dT%H:%M:%SZ%z"),"%Y-%m-...`

- **Dashboard:** Flow Collection Trend
  - **Panel:** Latest Total FPS: (single_value)
  - **Query Preview:** `| where deviceId!="0" | sort 0 - time, + deviceName | dedup deviceId | stats sum(fps) as "total_fps" | eval total_fps = tostring(round(total_fps,0), "...`

- **Dashboard:** Flow Collection Trend
  - **Panel:** Average Total FPS: (single_value)
  - **Query Preview:** `| where deviceId!="0" | sort 0 + deviceName | stats avg(fps) as "avg_fps" by deviceId | stats sum(avg_fps) as "total_fps" | eval total_fps = tostring(...`

- **Dashboard:** Flow Collection Trend
  - **Panel:** Max Total FPS: (single_value)
  - **Query Preview:** `| where deviceId!="0" | sort 0 + deviceName | stats max(fps) as "max_fps" by deviceId | stats sum(max_fps) as "total_fps" | eval total_fps = tostring(...`

#### ta_cisco_thousandeyes

- **Dashboard:** Alerts
  - **Panel:** Untitled (table)
  - **Matched Keywords:** alerts
  - **Query Preview:** `| tstats `summariesonly` count, values(Alerts.triggerTime) as triggerTime, values(Alerts.accountId) as accountId, values(Alerts.organizationId) as org...`

- **Dashboard:** Alerts
  - **Panel:** Alerts Summary by Severity (chart)
  - **Matched Keywords:** alerts
  - **Query Preview:** `| tstats `summariesonly` count FROM datamodel="Cisco_ThousandEyes.Alerts" WHERE $tkn_acc_group$ $tkn_severity$ $tkn_test_type$ BY Alerts.severity | re...`

- **Dashboard:** Alerts
  - **Panel:** Alerts Timeline (chart)
  - **Matched Keywords:** alerts
  - **Query Preview:** `| tstats `summariesonly` count FROM datamodel="Cisco_ThousandEyes.Alerts" WHERE $tkn_acc_group$ $tkn_severity$ $tkn_test_type$ BY Alerts.severity _tim...`

- **Dashboard:** Network
  - **Panel:** Untitled (table)

- **Dashboard:** Network
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` count(Test_Metrics.server.address)  as count  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc_group$ $tkn_age...`

- **Dashboard:** Network
  - **Panel:** Network Latency (Seconds) (single_value)
  - **Query Preview:** `| tstats `summariesonly` avg(Test_Metrics.metric_name:network.latency) as avg_latency  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc...`

- **Dashboard:** Network
  - **Panel:** Network Loss (Percentage) (single_value)
  - **Query Preview:** `| tstats `summariesonly` avg(Test_Metrics.metric_name:network.loss) as avg_loss  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc_group...`

- **Dashboard:** Network
  - **Panel:** Network Jitter (Milliseconds) (single_value)
  - **Query Preview:** `| tstats `summariesonly` avg(Test_Metrics.metric_name:network.jitter) as avg_jitter  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc_g...`

- **Dashboard:** Network
  - **Panel:** Network Latency (Seconds) (chart)
  - **Query Preview:** `| tstats `summariesonly` avg(Test_Metrics.metric_name:network.latency) as avg_latency  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc...`

- **Dashboard:** Network
  - **Panel:** Permalinks for $app_dd_1$ (table)
  - **Query Preview:** `| tstats `summariesonly` count(Test_Metrics.thousandeyes.permalink) as count   FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc_group$ ...`

- **Dashboard:** Network
  - **Panel:** Min Hops $app_dd_1$ (single_value)
  - **Query Preview:** `|tstats `summariesonly` min(Path_Viz.hops) as min  FROM datamodel="Cisco_ThousandEyes.Path_Viz" WHERE (Path_Viz.server="$app_dd_1$" OR Path_Viz.server...`

- **Dashboard:** Network
  - **Panel:** Network Loss (Percentage) (chart)
  - **Query Preview:** `| tstats `summariesonly` avg(Test_Metrics.metric_name:network.loss) as avg_loss  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc_group...`

- **Dashboard:** Network
  - **Panel:** Permalinks for $app_dd_2$ (table)
  - **Query Preview:** `| tstats `summariesonly` count(Test_Metrics.thousandeyes.permalink) as count  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc_group$ $...`

- **Dashboard:** Network
  - **Panel:** Min Hops for $app_dd_2$ (single_value)
  - **Query Preview:** `|tstats `summariesonly` min(Path_Viz.hops) as min  FROM datamodel="Cisco_ThousandEyes.Path_Viz" WHERE (Path_Viz.server="$app_dd_2$" OR Path_Viz.server...`

- **Dashboard:** Network
  - **Panel:** Network Jitter (Milliseconds) (chart)
  - **Query Preview:** `| tstats `summariesonly` avg(Test_Metrics.metric_name:network.jitter) as avg_jitter  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc_g...`

- **Dashboard:** Network
  - **Panel:** Permalinks for $app_dd_3$ (table)
  - **Query Preview:** `| tstats `summariesonly` count(Test_Metrics.thousandeyes.permalink) as count  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc_group$ $...`

- **Dashboard:** Network
  - **Panel:** Min Hops for $app_dd_3$ (single_value)
  - **Query Preview:** `|tstats `summariesonly` min(Path_Viz.hops) as min  FROM datamodel="Cisco_ThousandEyes.Path_Viz" WHERE (Path_Viz.server="$app_dd_3$" OR Path_Viz.server...`

- **Dashboard:** Network
  - **Panel:** Untitled (table)

- **Dashboard:** Network
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` count(Test_Metrics.thousandeyes.monitor.name)  as count  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc_grou...`

- **Dashboard:** Network
  - **Panel:** BGP Reachability (map)
  - **Query Preview:** `| tstats `summariesonly` latest(Test_Metrics.metric_name:bgp.reachability)  as count  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc_...`

- **Dashboard:** Network
  - **Panel:** BGP Path Changes Count (chart)
  - **Query Preview:** `| tstats `summariesonly` avg(Test_Metrics.metric_name:bgp.path_changes.count) as avg_change_count  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WH...`

- **Dashboard:** Network
  - **Panel:** Permalinks for $app_dd_4$ (table)
  - **Query Preview:** `| tstats `summariesonly` count(Test_Metrics.thousandeyes.permalink) as count FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc_group$  $...`

- **Dashboard:** Network
  - **Panel:** BGP Updates Count (chart)
  - **Query Preview:** `| tstats `summariesonly` avg(Test_Metrics.metric_name:bgp.updates.count) as avg_update_count  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $...`

- **Dashboard:** Network
  - **Panel:** Permalinks for $app_dd_5$ (table)
  - **Query Preview:** `| tstats `summariesonly` count(Test_Metrics.thousandeyes.permalink) as count FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc_group$  $...`

- **Dashboard:** Network
  - **Panel:** Untitled (table)

- **Dashboard:** Network
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` count(Test_Metrics.dns.question.name)  as count  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc_group$ $tkn_...`

- **Dashboard:** Network
  - **Panel:** DNS Availability (Percentage) (chart)
  - **Query Preview:** `| tstats `summariesonly` avg(Test_Metrics.metric_name:dns.lookup.availability) as avg_avail  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $t...`

- **Dashboard:** Network
  - **Panel:** Permalinks for $app_dd_6$ (table)
  - **Query Preview:** `| tstats `summariesonly` count(Test_Metrics.thousandeyes.permalink) as count FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc_group$ $t...`

- **Dashboard:** Network
  - **Panel:** DNS Duration (Seconds) (chart)
  - **Query Preview:** `| tstats `summariesonly` avg(Test_Metrics.metric_name:dns.lookup.duration) as avg_duration  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tk...`

- **Dashboard:** Network
  - **Panel:** Permalinks for $app_dd_7$ (table)
  - **Query Preview:** `| tstats `summariesonly` count(Test_Metrics.thousandeyes.permalink) as count  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc_group$ $...`

- **Dashboard:** Network
  - **Panel:** DNS Validity (Percentage) (chart)
  - **Query Preview:** `| tstats `summariesonly` avg(Test_Metrics.metric_name:dns.lookup.validity) as avg_valid  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_a...`

- **Dashboard:** Network
  - **Panel:** Permalinks for $app_dd_8$ (table)
  - **Query Preview:** `| tstats `summariesonly` count(Test_Metrics.thousandeyes.permalink) as count   FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc_group$ ...`

---

### Requirement 7: Hybrid Mesh FW – device attachment (SCC)

**Stated Visualization Support:** No

**Stated Supporting Apps:** —

**Matched Panels Found:** 137

#### Splunk_TA_cisco_meraki

- **Dashboard:** Organizations Security
  - **Panel:** Blocked Alerts Count (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:organizationsecurity" $orgid$
| stats count as Count by blocked
| rename blocked as "Blocked"...`

- **Dashboard:** Organizations Security
  - **Panel:** Details of Alerts (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:organizationsecurity" $orgid$
| rename eventType as "Event Type", deviceMac as "Device Mac", signature as "Signature...`

- **Dashboard:** Organizations Security
  - **Panel:** Alerts Over Time (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:organizationsecurity" $orgid$
| timechart count as "Alert Count" span=1d...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Ethernet Port Statuses (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$ 
| dedup serial
| rename name as "Device Name", ports{}.name as "Ports Name...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Devices Without Power Connectivity (table)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename power.ac.isConnected as ac , power.poe.isConnected...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** POE Standard Distribution (chart)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename ports{}.poe.standard as "POE Standard"
| stats cou...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Ports Speed (chart)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename ports{}.linkNegotiation.speed as "Port Speed"
| st...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Wireless Device Ethernet Status | Aggregation Status (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename aggregation.enabled as aggregation_enabled
| eval ...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Network Port Speeds (table)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| rename ports{}.linkNegotiation.speed as port_speed, network.id as "Netwo...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Networks with Most PoE Devices (chart)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename power.poe.isConnected as poe_connected, network.id...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Power Mode Distribution (chart)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename power.mode as "Power Mode"
| stats count by "Power...`

- **Dashboard:** Security Appliances
  - **Panel:** Appliance Security Events (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:securityappliances" $orgid$ 
| dedup occurredAt, deviceSerial
|spath description
| rename eventData.summary as Summa...`

- **Dashboard:** Security Appliances
  - **Panel:** Categories of Data (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:securityappliances" $orgid$
| dedup occurredAt, deviceSerial
| stats count as Count by category
| sort - 0 Count
| r...`

- **Dashboard:** Security Appliances
  - **Panel:** Top Devices with IP Conflicts (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:securityappliances" category="ip_conflicts" $orgid$
| dedup occurredAt, deviceSerial
| stats count as Count by devic...`

- **Dashboard:** Security Appliances
  - **Panel:** Security Events Occurred by Time (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:securityappliances" $orgid$
| dedup occurredAt, deviceSerial
| timechart count as "Events Occured" span=1d...`

- **Dashboard:** Device Availabilities Change History
  - **Panel:** Top 10 Networks By Device Changes (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesavailabilitieschangehistory" $orgid$ 
| dedup device.serial
| rename network.name as "Network Name" 
| stats ...`

- **Dashboard:** Device Availabilities Change History
  - **Panel:** Top 10 Offline Devices (table)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesavailabilitieschangehistory" $orgid$ details.new{}.value="offline" 
| dedup device.serial
| rename device.nam...`

- **Dashboard:** Device Availabilities Change History
  - **Panel:** Devices Availabilities Change History (table)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesavailabilitieschangehistory" $orgid$ 
| dedup device.serial
| rename details.new{}.value as "New Status", det...`

- **Dashboard:** Device Availabilities Change History
  - **Panel:** Device Status History Over Time (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesavailabilitieschangehistory" $orgid$ 
| dedup device.serial
| rename details.new{}.value as new_status 
| tim...`

- **Dashboard:** Top Devices
  - **Panel:** Device Usage Metrics (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:summarytopdevicesbyusage" $orgid$
| dedup name network.id usage.total usage.percentage
| rename name as "Device Name...`

- **Dashboard:** Top Devices
  - **Panel:** Top 10 Networks By Device Usage (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:summarytopdevicesbyusage" $orgid$
| dedup name network.id usage.total usage.percentage
| rename network.name as "Net...`

- **Dashboard:** Top Devices
  - **Panel:** Device Usage Over Time (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:summarytopdevicesbyusage" $orgid$
| dedup name network.id usage.total usage.percentage
| rename name as "Device Name...`

- **Dashboard:** Appliance VPN Statuses
  - **Panel:** VPN Status Data (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:appliancesdwanstatuses" $orgid$ 
| rename networkName as "Network Name", deviceStatus as "Device Status", Subnet_Nam...`

- **Dashboard:** Wireless Device Packet Loss
  - **Panel:** Packet Loss By Network (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicespacketlossbydevice" $orgid$ 
| eval direction = mvappend("downstream", "upstream") 
| mvexpand direct...`

- **Dashboard:** Wireless Device Packet Loss
  - **Panel:** Total Packets v/s Lost Packets (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicespacketlossbydevice" $orgid$ 
| eval direction = mvappend("Downstream", "Upstream") 
| mvexpand direct...`

- **Dashboard:** Wireless Device Packet Loss
  - **Panel:** Top Networks with High Packet Loss (table)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicespacketlossbydevice" $orgid$ 
| rename upstream.lost as upstream_loss ,downstream.lost as downstream_l...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Total Alerts (single_value)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$ 
| dedup id 
| stats count as "Alert Count"...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Alert Count by Severity (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$
| dedup id
| rename severity as "Severity"
| stats count as "Alert Count" by Severity...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Alert Data (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$ 
| dedup id
| rename id as "Alert Id", startedAt as "Alert Time" , categoryType as "Categor...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Top Affected Networks (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$
| dedup id
| rename network.name as "Network Name", severity as "Severity Level"
| stats co...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Top Affected Devices (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$ 
| dedup id 
| rename scope.devices{}.name as "Device Name", severity as "Severity Level" 
...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Devices Uplinks History (table)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename name as "Device Name", uplinks{}.interface as "Int...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Uplink Interface Distribution (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename uplinks{}.interface as "Uplink Interface" 
| stats...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Address Assignment Modes (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename uplinks{}.addresses{}.assignmentMode as "Assignmen...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Protocol Distribution (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename uplinks{}.addresses{}.protocol as "Address Protoco...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Most Frequent Public Addresses (table)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$
| dedup serial
| rename uplinks{}.addresses{}.public.address as "Public Add...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Most Frequent Gateway IPs (table)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename uplinks{}.addresses{}.gateway as "Gateway" 
| stat...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Top 10 DNS Servers (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$
| dedup serial
| rename uplinks{}.addresses{}.nameservers.addresses{} as "D...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Top 10 Network Uplinks (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename network.id as "Network Id"
| stats count as Count ...`

#### TA_cisco_catalyst

- **Dashboard:** Splunk Resource Utilization
  - **Panel:** Process Health (chart)
  - **Query Preview:** `index=_internal sourcetype IN ("splunktaciscocybervision:log", "splunktaciscodnacenter:log", "splunktaciscoise:log", "splunktaciscosdwan:log") host IN...`

- **Dashboard:** Splunk Resource Utilization
  - **Panel:** Health Monitoring by Input Connection (table)
  - **Query Preview:** `index=_internal sourcetype IN ("splunktaciscocybervision:log", "splunktaciscodnacenter:log", "splunktaciscoise:log", "splunktaciscosdwan:log") host IN...`

#### cisco-catalyst-app

- **Dashboard:** Overview Reports
  - **Panel:** Network Device Types (chart)
  - **Matched Keywords:** device
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Center_Reports.Cisco_...`

- **Dashboard:** Sensors
  - **Panel:** Door Sensor Status - Latest Readings (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" 
    from datamodel=Cisco_Catalyst_App 
    where nodename=Cisco_Catalyst_Dataset.Cisco...`

- **Dashboard:** Users And Applications
  - **Panel:** User Authentication Status (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Authentication Status (chart)
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Security and Operational Events Distribution By Severity Over Time (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Cyber_Vision_Syslog_E...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Security Events by Severity (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Cyber_Vision_Syslog_E...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** All Security Events of "$syslog_severity$" Severity (table)
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Security Group Tag by Authentication (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events by ...`

- **Dashboard:** Overview
  - **Panel:** Top 10 Assets By Threat (chart)
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Overview
  - **Panel:** $client_type_health$ Clients Health Score (single_value)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Client_Inventory_And_...`

- **Dashboard:** Overview
  - **Panel:** Network Health Score - $health_category$ (single_value)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Network_Health_Events...`

- **Dashboard:** Security Insights
  - **Panel:** Malicious Files by Malware (chart)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset....`

- **Dashboard:** Security Insights
  - **Panel:** Malicious Files by Type (chart)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset....`

- **Dashboard:** Security Insights
  - **Panel:** URLs by Category (chart)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset....`

- **Dashboard:** Security Insights
  - **Panel:** Blocked Connections Over IPS event (chart)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset....`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$tkn_prevent_run_threat_details$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(_time) as Timestamp from datamodel=Cisco_Cataly...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$tkn_prevent_run_url_details$ | tstats `summariesonly` fillnull_value="N/A" count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Data...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$tkn_prevent_run_ips_details$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Ca...`

- **Dashboard:** Security Insights
  - **Panel:** SGACL - Top Sources (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_SG...`

- **Dashboard:** Security Insights
  - **Panel:** SGACL Events by Action (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count  from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_S...`

- **Dashboard:** Security Insights
  - **Panel:** ACL - Top Denied Sources (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_AC...`

- **Dashboard:** Security Insights
  - **Panel:** ACL - Top Denied Clients (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_AC...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Ci...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats summariesonly=false fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Datase...`

- **Dashboard:** Security Insights
  - **Panel:** Dropped FW Flows (table)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats fillnull_value="N/A" `summariesonly` count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Ci...`

- **Dashboard:** Security Insights
  - **Panel:** Inspected FW Flows (table)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats fillnull_value="N/A" `summariesonly` count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Ci...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats fillnull_value="N/A" `summariesonly` count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Ci...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Ne...`

- **Dashboard:** Security Insights
  - **Panel:** Device Compliance Status (chart)
  - **Matched Keywords:** device
  - **Query Preview:** `$Cisco Catalyst Center$ | tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Cataly...`

- **Dashboard:** Security Insights
  - **Panel:** Device Compliance State (chart)
  - **Matched Keywords:** device
  - **Query Preview:** `$Cisco Catalyst Center$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Compliance_...`

- **Dashboard:** Security Insights
  - **Panel:** Top 10 Vulnerabilities (chart)
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Vulnerabili...`

- **Dashboard:** Security Insights
  - **Panel:** Rogue Devices Count (single_value)
  - **Query Preview:** `| tstats `summariesonly` count as Count from datamodel=Cisco_Catalyst_App 
  where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Rogue_Events 
  by C...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$rogue_devices_detail$ | tstats fillnull_value="N/A" `summariesonly` count as "Count" values(Cisco_Catalyst_Dataset.Cisco_Catalyst_Rogue_Events.rogue_...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$run_vulnerabilities$ 
| tstats fillnull_value="N/A" `summariesonly` count as "Count" values(Cisco_Catalyst_Dataset.catalyst_vendor_product) as "Sourc...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$tkn_prevent_run_device_compliance_details$| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where node...`

- **Dashboard:** Security Insights
  - **Panel:** Security Advisory Details (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Security Insights
  - **Panel:** ISE Authentication Policy Chart (chart)
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** ISE Authorization Policy Chart (chart)
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** Security Events Occurred by Time (chart)
  - **Query Preview:** `| tstats `summariesonly` count as meraki_security_events_count
    from datamodel=Cisco_Catalyst_App 
    where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` count as Count from datamodel=Cisco_Catalyst_App 
  where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Security_Events 
  b...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Security Insights
  - **Panel:** SGACL Activities (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_SG...`

- **Dashboard:** Endpoint Compliance
  - **Panel:** Posture Status Trend Over Time (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events.ISE...`

- **Dashboard:** Network Insights
  - **Panel:** Device Manageability Type (chart)
  - **Matched Keywords:** device
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Health_Events.device_health_managea...`

- **Dashboard:** Network Insights
  - **Panel:** Device Reachability Type (chart)
  - **Matched Keywords:** device
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Health_Events.device_health_reachab...`

- **Dashboard:** Network Insights
  - **Panel:** Device Family Type (chart)
  - **Matched Keywords:** device
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Health_Events.device_health_device_...`

- **Dashboard:** Step 1 Device Classification
  - **Panel:** C2C-0.1.0 Reporting - USCYBERCOM Device Category (chart)
  - **Matched Keywords:** device
  - **Query Preview:** `| inputlookup cisco_catalyst_analytics_reports.csv
| eval filteredCybercom=mvfilter(match(cybercomCategory, `cisco_catalyst_CYBERCOM_Macro`) OR match(...`

- **Dashboard:** Step 1 Device Classification
  - **Panel:** C2C-0.1.1 Reporting - Operating System Summary (chart)
  - **Matched Keywords:** device
  - **Query Preview:** `| inputlookup cisco_catalyst_analytics_reports.csv
| stats count by MatchedPolicy
| sort 0 -count
| rename MatchedPolicy as "Operating System", count ...`

- **Dashboard:** Step 1 Device Classification
  - **Panel:** Untitled (table)
  - **Matched Keywords:** device
  - **Query Preview:** `| inputlookup cisco_catalyst_analytics_reports.csv
| eval filteredCybercom=mvfilter(match(cybercomCategory, `cisco_catalyst_CYBERCOM_Macro`) OR match(...`

- **Dashboard:** Step 1 Device Classification
  - **Panel:** Untitled (table)
  - **Matched Keywords:** device
  - **Query Preview:** `| inputlookup cisco_catalyst_analytics_reports.csv
| stats count by MatchedPolicy
| sort 0 -count
| rename MatchedPolicy as "Operating System", count ...`

- **Dashboard:** Network Compliance
  - **Panel:** Network Device Inventory (table)
  - **Matched Keywords:** device
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename IN (Cisco_Catalyst_Dataset.Cisco_Catalyst_Center_Reports.Ci...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** Client Health Score – Wired and Wireless (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Client_Inventory_And_...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** Endpoint Authentication Status (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** BYOD Device Enrollment (table)
  - **Matched Keywords:** device
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Performance
  - **Panel:** ISE System Health (table)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events by ...`

- **Dashboard:** Performance
  - **Panel:** Network System Health (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count(Cisco_Catalyst_Dataset.Cisco_Catalyst_Network_Performance_Events.network_performance_account_id) f...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Site Health (chart)
  - **Query Preview:** `| tstats `summariesonly` latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_Site_Health_Events.sdwan_site_health_site_health) as "Site Health" from da...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Link Health (chart)
  - **Query Preview:** `| tstats `summariesonly` count from datamodel=Cisco_Catalyst_App 
    where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_Link_Health
    by Ci...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Unified Threat Defense Health (chart)
  - **Query Preview:** `| tstats `summariesonly` latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_UTD_Health.sdwan_utd_health_status) as "Admin Status" from datamodel=Cisco...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Tunnel Health (chart)
  - **Query Preview:** `| tstats `summariesonly` count as Count latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_Tunnel_Health.sdwan_tunnel_health_health) as "Tunnel Health...`

#### cisco_sna_app

- **Dashboard:** User Report
  - **Panel:** Security Index (table)
  - **Query Preview:** `|topalarming report_type=users domain_id=$domain_id$ smc_ip=$smc_ip$
            | where like(username, "$username$") | eval time_session_start=strfti...`

- **Dashboard:** Host Snapshot
  - **Panel:** Status: (table)
  - **Query Preview:** `| where row_type="host_status" | eval status_first_seen=strftime(strptime(status_first_seen."+0000","%Y-%m-%dT%H:%M:%SZ%z"),"%Y-%m-%d %H:%M:%S %Z") | ...`

- **Dashboard:** Host Snapshot
  - **Panel:** Security Index (table)
  - **Query Preview:** `| where row_type="host_security_summary" | fields "security_concern_index", "security_target_index", "security_recon_index", "security_command_and_con...`

- **Dashboard:** Host Snapshot
  - **Panel:** Host is Source of Security Events (Most Recent) (table)
  - **Query Preview:** `| where row_type="host_security_events" and origin_list="source-list" | eval start_time=strftime(strptime(start_time."+0000","%Y-%m-%dT%H:%M:%SZ%z"),"...`

- **Dashboard:** Host Snapshot
  - **Panel:** Host is Target of Security Events (Most Recent) (table)
  - **Query Preview:** `| where row_type="host_security_events" and origin_list="target-list" | eval start_time=strftime(strptime(start_time."+0000","%Y-%m-%dT%H:%M:%SZ%z"),"...`

- **Dashboard:** Security Events
  - **Panel:** Top Security Event Types (chart)
  - **Query Preview:** `| rename "event_type_name" as "Security Event Type" | stats count by "Security Event Type"...`

- **Dashboard:** Security Events
  - **Panel:** Top Security Event Sources (chart)
  - **Query Preview:** `| where source_ip!="Multiple Hosts" and not like("$form.subject_ip$", "%" . source_ip . "%") and not like("$form.peer_ip$", "%" . source_ip . "%") | r...`

- **Dashboard:** Security Events
  - **Panel:** Top Security Event Targets (chart)
  - **Query Preview:** `| where target_ip!="Multiple Hosts" and not like("$form.subject_ip$", "%" . target_ip . "%") and not like("$form.peer_ip$", "%" . target_ip . "%") | r...`

- **Dashboard:** Security Events
  - **Panel:** Results (table)
  - **Query Preview:** `| sort 0 - ci_points | eval start_time=strftime(strptime(start_time."+0000","%Y-%m-%dT%H:%M:%SZ%z"),"%Y-%m-%d %H:%M:%S %Z") | eval last_time=strftime(...`

- **Dashboard:** Security Events
  - **Panel:** Untitled (table)

- **Dashboard:** Security Event Descriptions
  - **Panel:** Untitled (table)
  - **Query Preview:** `| sort 0 name | fields "name", "description" | rename "name" as "Name", "description" as "Description"...`

- **Dashboard:** Security Event Descriptions
  - **Panel:** Untitled (table)

#### ta_cisco_thousandeyes

- **Dashboard:** Data collection Status
  - **Panel:** Number of Streams (single_value)
  - **Query Preview:** `| tstats `summariesonly` dc(Test_Metrics.thousandeyes.stream.id) as count FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE Test_Metrics.thousand...`

- **Dashboard:** Data collection Status
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` count(Test_Metrics.thousandeyes.stream.id) FROM datamodel="Cisco_ThousandEyes.Test_Metrics"  WHERE Test_Metrics.thousandeyes....`

- **Dashboard:** Data collection Status
  - **Panel:** Number of Cloud & Enterprise Agent Tests and Endpoint Agent Tests (single_value)
  - **Query Preview:** `| tstats `summariesonly` dc(Test_Metrics.thousandeyes.test.id) as count FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE Test_Metrics.thousandey...`

- **Dashboard:** Data collection Status
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` values(Test_Metrics.thousandeyes.test.type) as "Test Types" values(Test_Metrics.thousandeyes.test.name) as "Test Name" FROM d...`

- **Dashboard:** Data collection Status
  - **Panel:** Number of Event Inputs (single_value)
  - **Query Preview:** `| tstats `summariesonly` dc(source) as count FROM datamodel="Cisco_ThousandEyes.Events"  WHERE Events.aid IN($tkn_acc_group$)...`

- **Dashboard:** Data collection Status
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` latest(_time) as time FROM datamodel="Cisco_ThousandEyes.Events"  WHERE Events.aid IN($tkn_acc_group$) BY source | eval sourc...`

- **Dashboard:** Data collection Status
  - **Panel:** Number of Activity Inputs (single_value)
  - **Query Preview:** `| tstats `summariesonly` dc(source) as count FROM datamodel="Cisco_ThousandEyes.Activities"  WHERE Activities.aid IN($tkn_acc_group$)...`

- **Dashboard:** Data collection Status
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` latest(_time) as time FROM datamodel="Cisco_ThousandEyes.Activities"  WHERE Activities.aid IN($tkn_acc_group$) BY source | ev...`

---

### Requirement 8: FW enabled status (MX, Secure Router, etc.)

**Stated Visualization Support:** Partial

**Stated Supporting Apps:** Splunk Add-on for Cisco Meraki, Cisco Enterprise Networking for Splunk Platform

**Matched Panels Found:** 137

#### Splunk_TA_cisco_meraki

- **Dashboard:** Organizations Security
  - **Panel:** Blocked Alerts Count (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:organizationsecurity" $orgid$
| stats count as Count by blocked
| rename blocked as "Blocked"...`

- **Dashboard:** Organizations Security
  - **Panel:** Details of Alerts (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:organizationsecurity" $orgid$
| rename eventType as "Event Type", deviceMac as "Device Mac", signature as "Signature...`

- **Dashboard:** Organizations Security
  - **Panel:** Alerts Over Time (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:organizationsecurity" $orgid$
| timechart count as "Alert Count" span=1d...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Ethernet Port Statuses (table)
  - **Matched Keywords:** status
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$ 
| dedup serial
| rename name as "Device Name", ports{}.name as "Ports Name...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Devices Without Power Connectivity (table)
  - **Matched Keywords:** status
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename power.ac.isConnected as ac , power.poe.isConnected...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** POE Standard Distribution (chart)
  - **Matched Keywords:** status
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename ports{}.poe.standard as "POE Standard"
| stats cou...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Ports Speed (chart)
  - **Matched Keywords:** status
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename ports{}.linkNegotiation.speed as "Port Speed"
| st...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Wireless Device Ethernet Status | Aggregation Status (chart)
  - **Matched Keywords:** status
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename aggregation.enabled as aggregation_enabled
| eval ...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Network Port Speeds (table)
  - **Matched Keywords:** status
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| rename ports{}.linkNegotiation.speed as port_speed, network.id as "Netwo...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Networks with Most PoE Devices (chart)
  - **Matched Keywords:** status
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename power.poe.isConnected as poe_connected, network.id...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Power Mode Distribution (chart)
  - **Matched Keywords:** status
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename power.mode as "Power Mode"
| stats count by "Power...`

- **Dashboard:** Security Appliances
  - **Panel:** Appliance Security Events (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:securityappliances" $orgid$ 
| dedup occurredAt, deviceSerial
|spath description
| rename eventData.summary as Summa...`

- **Dashboard:** Security Appliances
  - **Panel:** Categories of Data (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:securityappliances" $orgid$
| dedup occurredAt, deviceSerial
| stats count as Count by category
| sort - 0 Count
| r...`

- **Dashboard:** Security Appliances
  - **Panel:** Top Devices with IP Conflicts (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:securityappliances" category="ip_conflicts" $orgid$
| dedup occurredAt, deviceSerial
| stats count as Count by devic...`

- **Dashboard:** Security Appliances
  - **Panel:** Security Events Occurred by Time (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:securityappliances" $orgid$
| dedup occurredAt, deviceSerial
| timechart count as "Events Occured" span=1d...`

- **Dashboard:** Device Availabilities Change History
  - **Panel:** Top 10 Networks By Device Changes (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesavailabilitieschangehistory" $orgid$ 
| dedup device.serial
| rename network.name as "Network Name" 
| stats ...`

- **Dashboard:** Device Availabilities Change History
  - **Panel:** Top 10 Offline Devices (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesavailabilitieschangehistory" $orgid$ details.new{}.value="offline" 
| dedup device.serial
| rename device.nam...`

- **Dashboard:** Device Availabilities Change History
  - **Panel:** Devices Availabilities Change History (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesavailabilitieschangehistory" $orgid$ 
| dedup device.serial
| rename details.new{}.value as "New Status", det...`

- **Dashboard:** Device Availabilities Change History
  - **Panel:** Device Status History Over Time (chart)
  - **Matched Keywords:** status
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesavailabilitieschangehistory" $orgid$ 
| dedup device.serial
| rename details.new{}.value as new_status 
| tim...`

- **Dashboard:** Top Devices
  - **Panel:** Device Usage Metrics (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:summarytopdevicesbyusage" $orgid$
| dedup name network.id usage.total usage.percentage
| rename name as "Device Name...`

- **Dashboard:** Top Devices
  - **Panel:** Top 10 Networks By Device Usage (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:summarytopdevicesbyusage" $orgid$
| dedup name network.id usage.total usage.percentage
| rename network.name as "Net...`

- **Dashboard:** Top Devices
  - **Panel:** Device Usage Over Time (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:summarytopdevicesbyusage" $orgid$
| dedup name network.id usage.total usage.percentage
| rename name as "Device Name...`

- **Dashboard:** Appliance VPN Statuses
  - **Panel:** VPN Status Data (table)
  - **Matched Keywords:** status
  - **Query Preview:** ``meraki_index` sourcetype="meraki:appliancesdwanstatuses" $orgid$ 
| rename networkName as "Network Name", deviceStatus as "Device Status", Subnet_Nam...`

- **Dashboard:** Wireless Device Packet Loss
  - **Panel:** Packet Loss By Network (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicespacketlossbydevice" $orgid$ 
| eval direction = mvappend("downstream", "upstream") 
| mvexpand direct...`

- **Dashboard:** Wireless Device Packet Loss
  - **Panel:** Total Packets v/s Lost Packets (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicespacketlossbydevice" $orgid$ 
| eval direction = mvappend("Downstream", "Upstream") 
| mvexpand direct...`

- **Dashboard:** Wireless Device Packet Loss
  - **Panel:** Top Networks with High Packet Loss (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicespacketlossbydevice" $orgid$ 
| rename upstream.lost as upstream_loss ,downstream.lost as downstream_l...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Total Alerts (single_value)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$ 
| dedup id 
| stats count as "Alert Count"...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Alert Count by Severity (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$
| dedup id
| rename severity as "Severity"
| stats count as "Alert Count" by Severity...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Alert Data (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$ 
| dedup id
| rename id as "Alert Id", startedAt as "Alert Time" , categoryType as "Categor...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Top Affected Networks (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$
| dedup id
| rename network.name as "Network Name", severity as "Severity Level"
| stats co...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Top Affected Devices (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$ 
| dedup id 
| rename scope.devices{}.name as "Device Name", severity as "Severity Level" 
...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Devices Uplinks History (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename name as "Device Name", uplinks{}.interface as "Int...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Uplink Interface Distribution (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename uplinks{}.interface as "Uplink Interface" 
| stats...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Address Assignment Modes (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename uplinks{}.addresses{}.assignmentMode as "Assignmen...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Protocol Distribution (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename uplinks{}.addresses{}.protocol as "Address Protoco...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Most Frequent Public Addresses (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$
| dedup serial
| rename uplinks{}.addresses{}.public.address as "Public Add...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Most Frequent Gateway IPs (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename uplinks{}.addresses{}.gateway as "Gateway" 
| stat...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Top 10 DNS Servers (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$
| dedup serial
| rename uplinks{}.addresses{}.nameservers.addresses{} as "D...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Top 10 Network Uplinks (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename network.id as "Network Id"
| stats count as Count ...`

#### TA_cisco_catalyst

- **Dashboard:** Splunk Resource Utilization
  - **Panel:** Process Health (chart)
  - **Query Preview:** `index=_internal sourcetype IN ("splunktaciscocybervision:log", "splunktaciscodnacenter:log", "splunktaciscoise:log", "splunktaciscosdwan:log") host IN...`

- **Dashboard:** Splunk Resource Utilization
  - **Panel:** Health Monitoring by Input Connection (table)
  - **Query Preview:** `index=_internal sourcetype IN ("splunktaciscocybervision:log", "splunktaciscodnacenter:log", "splunktaciscoise:log", "splunktaciscosdwan:log") host IN...`

#### cisco-catalyst-app

- **Dashboard:** Overview Reports
  - **Panel:** Network Device Types (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Center_Reports.Cisco_...`

- **Dashboard:** Sensors
  - **Panel:** Door Sensor Status - Latest Readings (chart)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" 
    from datamodel=Cisco_Catalyst_App 
    where nodename=Cisco_Catalyst_Dataset.Cisco...`

- **Dashboard:** Users And Applications
  - **Panel:** User Authentication Status (table)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Authentication Status (chart)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Security and Operational Events Distribution By Severity Over Time (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Cyber_Vision_Syslog_E...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Security Events by Severity (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Cyber_Vision_Syslog_E...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** All Security Events of "$syslog_severity$" Severity (table)
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Security Group Tag by Authentication (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events by ...`

- **Dashboard:** Overview
  - **Panel:** Top 10 Assets By Threat (chart)
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Overview
  - **Panel:** $client_type_health$ Clients Health Score (single_value)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Client_Inventory_And_...`

- **Dashboard:** Overview
  - **Panel:** Network Health Score - $health_category$ (single_value)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Network_Health_Events...`

- **Dashboard:** Security Insights
  - **Panel:** Malicious Files by Malware (chart)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset....`

- **Dashboard:** Security Insights
  - **Panel:** Malicious Files by Type (chart)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset....`

- **Dashboard:** Security Insights
  - **Panel:** URLs by Category (chart)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset....`

- **Dashboard:** Security Insights
  - **Panel:** Blocked Connections Over IPS event (chart)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset....`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$tkn_prevent_run_threat_details$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(_time) as Timestamp from datamodel=Cisco_Cataly...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$tkn_prevent_run_url_details$ | tstats `summariesonly` fillnull_value="N/A" count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Data...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$tkn_prevent_run_ips_details$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Ca...`

- **Dashboard:** Security Insights
  - **Panel:** SGACL - Top Sources (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_SG...`

- **Dashboard:** Security Insights
  - **Panel:** SGACL Events by Action (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count  from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_S...`

- **Dashboard:** Security Insights
  - **Panel:** ACL - Top Denied Sources (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_AC...`

- **Dashboard:** Security Insights
  - **Panel:** ACL - Top Denied Clients (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_AC...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Ci...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats summariesonly=false fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Datase...`

- **Dashboard:** Security Insights
  - **Panel:** Dropped FW Flows (table)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats fillnull_value="N/A" `summariesonly` count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Ci...`

- **Dashboard:** Security Insights
  - **Panel:** Inspected FW Flows (table)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats fillnull_value="N/A" `summariesonly` count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Ci...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats fillnull_value="N/A" `summariesonly` count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Ci...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Ne...`

- **Dashboard:** Security Insights
  - **Panel:** Device Compliance Status (chart)
  - **Matched Keywords:** status
  - **Query Preview:** `$Cisco Catalyst Center$ | tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Cataly...`

- **Dashboard:** Security Insights
  - **Panel:** Device Compliance State (chart)
  - **Query Preview:** `$Cisco Catalyst Center$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Compliance_...`

- **Dashboard:** Security Insights
  - **Panel:** Top 10 Vulnerabilities (chart)
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Vulnerabili...`

- **Dashboard:** Security Insights
  - **Panel:** Rogue Devices Count (single_value)
  - **Query Preview:** `| tstats `summariesonly` count as Count from datamodel=Cisco_Catalyst_App 
  where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Rogue_Events 
  by C...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$rogue_devices_detail$ | tstats fillnull_value="N/A" `summariesonly` count as "Count" values(Cisco_Catalyst_Dataset.Cisco_Catalyst_Rogue_Events.rogue_...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$run_vulnerabilities$ 
| tstats fillnull_value="N/A" `summariesonly` count as "Count" values(Cisco_Catalyst_Dataset.catalyst_vendor_product) as "Sourc...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$tkn_prevent_run_device_compliance_details$| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where node...`

- **Dashboard:** Security Insights
  - **Panel:** Security Advisory Details (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Security Insights
  - **Panel:** ISE Authentication Policy Chart (chart)
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** ISE Authorization Policy Chart (chart)
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** Security Events Occurred by Time (chart)
  - **Query Preview:** `| tstats `summariesonly` count as meraki_security_events_count
    from datamodel=Cisco_Catalyst_App 
    where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` count as Count from datamodel=Cisco_Catalyst_App 
  where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Security_Events 
  b...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Security Insights
  - **Panel:** SGACL Activities (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_SG...`

- **Dashboard:** Endpoint Compliance
  - **Panel:** Posture Status Trend Over Time (chart)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events.ISE...`

- **Dashboard:** Network Insights
  - **Panel:** Device Manageability Type (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Health_Events.device_health_managea...`

- **Dashboard:** Network Insights
  - **Panel:** Device Reachability Type (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Health_Events.device_health_reachab...`

- **Dashboard:** Network Insights
  - **Panel:** Device Family Type (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Health_Events.device_health_device_...`

- **Dashboard:** Step 1 Device Classification
  - **Panel:** C2C-0.1.0 Reporting - USCYBERCOM Device Category (chart)
  - **Query Preview:** `| inputlookup cisco_catalyst_analytics_reports.csv
| eval filteredCybercom=mvfilter(match(cybercomCategory, `cisco_catalyst_CYBERCOM_Macro`) OR match(...`

- **Dashboard:** Step 1 Device Classification
  - **Panel:** C2C-0.1.1 Reporting - Operating System Summary (chart)
  - **Query Preview:** `| inputlookup cisco_catalyst_analytics_reports.csv
| stats count by MatchedPolicy
| sort 0 -count
| rename MatchedPolicy as "Operating System", count ...`

- **Dashboard:** Step 1 Device Classification
  - **Panel:** Untitled (table)
  - **Query Preview:** `| inputlookup cisco_catalyst_analytics_reports.csv
| eval filteredCybercom=mvfilter(match(cybercomCategory, `cisco_catalyst_CYBERCOM_Macro`) OR match(...`

- **Dashboard:** Step 1 Device Classification
  - **Panel:** Untitled (table)
  - **Query Preview:** `| inputlookup cisco_catalyst_analytics_reports.csv
| stats count by MatchedPolicy
| sort 0 -count
| rename MatchedPolicy as "Operating System", count ...`

- **Dashboard:** Network Compliance
  - **Panel:** Network Device Inventory (table)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename IN (Cisco_Catalyst_Dataset.Cisco_Catalyst_Center_Reports.Ci...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** Client Health Score – Wired and Wireless (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Client_Inventory_And_...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** Endpoint Authentication Status (table)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** BYOD Device Enrollment (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Performance
  - **Panel:** ISE System Health (table)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events by ...`

- **Dashboard:** Performance
  - **Panel:** Network System Health (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count(Cisco_Catalyst_Dataset.Cisco_Catalyst_Network_Performance_Events.network_performance_account_id) f...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Site Health (chart)
  - **Query Preview:** `| tstats `summariesonly` latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_Site_Health_Events.sdwan_site_health_site_health) as "Site Health" from da...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Link Health (chart)
  - **Query Preview:** `| tstats `summariesonly` count from datamodel=Cisco_Catalyst_App 
    where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_Link_Health
    by Ci...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Unified Threat Defense Health (chart)
  - **Query Preview:** `| tstats `summariesonly` latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_UTD_Health.sdwan_utd_health_status) as "Admin Status" from datamodel=Cisco...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Tunnel Health (chart)
  - **Query Preview:** `| tstats `summariesonly` count as Count latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_Tunnel_Health.sdwan_tunnel_health_health) as "Tunnel Health...`

#### cisco_sna_app

- **Dashboard:** User Report
  - **Panel:** Security Index (table)
  - **Query Preview:** `|topalarming report_type=users domain_id=$domain_id$ smc_ip=$smc_ip$
            | where like(username, "$username$") | eval time_session_start=strfti...`

- **Dashboard:** Host Snapshot
  - **Panel:** Status: (table)
  - **Matched Keywords:** status
  - **Query Preview:** `| where row_type="host_status" | eval status_first_seen=strftime(strptime(status_first_seen."+0000","%Y-%m-%dT%H:%M:%SZ%z"),"%Y-%m-%d %H:%M:%S %Z") | ...`

- **Dashboard:** Host Snapshot
  - **Panel:** Security Index (table)
  - **Query Preview:** `| where row_type="host_security_summary" | fields "security_concern_index", "security_target_index", "security_recon_index", "security_command_and_con...`

- **Dashboard:** Host Snapshot
  - **Panel:** Host is Source of Security Events (Most Recent) (table)
  - **Query Preview:** `| where row_type="host_security_events" and origin_list="source-list" | eval start_time=strftime(strptime(start_time."+0000","%Y-%m-%dT%H:%M:%SZ%z"),"...`

- **Dashboard:** Host Snapshot
  - **Panel:** Host is Target of Security Events (Most Recent) (table)
  - **Query Preview:** `| where row_type="host_security_events" and origin_list="target-list" | eval start_time=strftime(strptime(start_time."+0000","%Y-%m-%dT%H:%M:%SZ%z"),"...`

- **Dashboard:** Security Events
  - **Panel:** Top Security Event Types (chart)
  - **Query Preview:** `| rename "event_type_name" as "Security Event Type" | stats count by "Security Event Type"...`

- **Dashboard:** Security Events
  - **Panel:** Top Security Event Sources (chart)
  - **Query Preview:** `| where source_ip!="Multiple Hosts" and not like("$form.subject_ip$", "%" . source_ip . "%") and not like("$form.peer_ip$", "%" . source_ip . "%") | r...`

- **Dashboard:** Security Events
  - **Panel:** Top Security Event Targets (chart)
  - **Query Preview:** `| where target_ip!="Multiple Hosts" and not like("$form.subject_ip$", "%" . target_ip . "%") and not like("$form.peer_ip$", "%" . target_ip . "%") | r...`

- **Dashboard:** Security Events
  - **Panel:** Results (table)
  - **Query Preview:** `| sort 0 - ci_points | eval start_time=strftime(strptime(start_time."+0000","%Y-%m-%dT%H:%M:%SZ%z"),"%Y-%m-%d %H:%M:%S %Z") | eval last_time=strftime(...`

- **Dashboard:** Security Events
  - **Panel:** Untitled (table)

- **Dashboard:** Security Event Descriptions
  - **Panel:** Untitled (table)
  - **Query Preview:** `| sort 0 name | fields "name", "description" | rename "name" as "Name", "description" as "Description"...`

- **Dashboard:** Security Event Descriptions
  - **Panel:** Untitled (table)

#### ta_cisco_thousandeyes

- **Dashboard:** Data collection Status
  - **Panel:** Number of Streams (single_value)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` dc(Test_Metrics.thousandeyes.stream.id) as count FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE Test_Metrics.thousand...`

- **Dashboard:** Data collection Status
  - **Panel:** Untitled (table)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` count(Test_Metrics.thousandeyes.stream.id) FROM datamodel="Cisco_ThousandEyes.Test_Metrics"  WHERE Test_Metrics.thousandeyes....`

- **Dashboard:** Data collection Status
  - **Panel:** Number of Cloud & Enterprise Agent Tests and Endpoint Agent Tests (single_value)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` dc(Test_Metrics.thousandeyes.test.id) as count FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE Test_Metrics.thousandey...`

- **Dashboard:** Data collection Status
  - **Panel:** Untitled (table)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` values(Test_Metrics.thousandeyes.test.type) as "Test Types" values(Test_Metrics.thousandeyes.test.name) as "Test Name" FROM d...`

- **Dashboard:** Data collection Status
  - **Panel:** Number of Event Inputs (single_value)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` dc(source) as count FROM datamodel="Cisco_ThousandEyes.Events"  WHERE Events.aid IN($tkn_acc_group$)...`

- **Dashboard:** Data collection Status
  - **Panel:** Untitled (table)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` latest(_time) as time FROM datamodel="Cisco_ThousandEyes.Events"  WHERE Events.aid IN($tkn_acc_group$) BY source | eval sourc...`

- **Dashboard:** Data collection Status
  - **Panel:** Number of Activity Inputs (single_value)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` dc(source) as count FROM datamodel="Cisco_ThousandEyes.Activities"  WHERE Activities.aid IN($tkn_acc_group$)...`

- **Dashboard:** Data collection Status
  - **Panel:** Untitled (table)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` latest(_time) as time FROM datamodel="Cisco_ThousandEyes.Activities"  WHERE Activities.aid IN($tkn_acc_group$) BY source | ev...`

---

### Requirement 9: FW stats / status

**Stated Visualization Support:** Yes

**Stated Supporting Apps:** Splunk Add-on for Cisco Meraki, Cisco Enterprise Networking for Splunk Platform

**Matched Panels Found:** 141

#### Splunk_TA_cisco_meraki

- **Dashboard:** Appliance VPN Stats
  - **Panel:** Average Latency (single_value)
  - **Matched Keywords:** stats
  - **Query Preview:** ``meraki_index` sourcetype="meraki:appliancesdwanstatistics" $orgid$ 
| stats avg(merakiVpnPeers{}.latencySummaries{}.avgLatencyMs) as Average_Latency ...`

- **Dashboard:** Appliance VPN Stats
  - **Panel:** Average Loss (single_value)
  - **Matched Keywords:** stats
  - **Query Preview:** ``meraki_index` sourcetype="meraki:appliancesdwanstatistics" $orgid$ 
| stats avg(merakiVpnPeers{}.lossPercentageSummaries{}.avgLossPercentage) as Aver...`

- **Dashboard:** Appliance VPN Stats
  - **Panel:** VPN Metrics (table)
  - **Matched Keywords:** stats
  - **Query Preview:** ``meraki_index` sourcetype="meraki:appliancesdwanstatistics" $orgid$
| rename networkId as "Network ID", networkName as "Network Name", merakiVpnPeers{...`

- **Dashboard:** Appliance VPN Stats
  - **Panel:** Average Jitter (table)
  - **Matched Keywords:** stats
  - **Query Preview:** ``meraki_index` sourcetype="meraki:appliancesdwanstatistics" $orgid$ 
| rename merakiVpnPeers{}.jitterSummaries{}.senderUplink as "Sender Uplink", mera...`

- **Dashboard:** Organizations Security
  - **Panel:** Blocked Alerts Count (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:organizationsecurity" $orgid$
| stats count as Count by blocked
| rename blocked as "Blocked"...`

- **Dashboard:** Organizations Security
  - **Panel:** Details of Alerts (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:organizationsecurity" $orgid$
| rename eventType as "Event Type", deviceMac as "Device Mac", signature as "Signature...`

- **Dashboard:** Organizations Security
  - **Panel:** Alerts Over Time (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:organizationsecurity" $orgid$
| timechart count as "Alert Count" span=1d...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Ethernet Port Statuses (table)
  - **Matched Keywords:** status
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$ 
| dedup serial
| rename name as "Device Name", ports{}.name as "Ports Name...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Devices Without Power Connectivity (table)
  - **Matched Keywords:** status
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename power.ac.isConnected as ac , power.poe.isConnected...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** POE Standard Distribution (chart)
  - **Matched Keywords:** status
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename ports{}.poe.standard as "POE Standard"
| stats cou...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Ports Speed (chart)
  - **Matched Keywords:** status
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename ports{}.linkNegotiation.speed as "Port Speed"
| st...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Wireless Device Ethernet Status | Aggregation Status (chart)
  - **Matched Keywords:** status
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename aggregation.enabled as aggregation_enabled
| eval ...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Network Port Speeds (table)
  - **Matched Keywords:** status
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| rename ports{}.linkNegotiation.speed as port_speed, network.id as "Netwo...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Networks with Most PoE Devices (chart)
  - **Matched Keywords:** status
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename power.poe.isConnected as poe_connected, network.id...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Power Mode Distribution (chart)
  - **Matched Keywords:** status
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename power.mode as "Power Mode"
| stats count by "Power...`

- **Dashboard:** Security Appliances
  - **Panel:** Appliance Security Events (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:securityappliances" $orgid$ 
| dedup occurredAt, deviceSerial
|spath description
| rename eventData.summary as Summa...`

- **Dashboard:** Security Appliances
  - **Panel:** Categories of Data (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:securityappliances" $orgid$
| dedup occurredAt, deviceSerial
| stats count as Count by category
| sort - 0 Count
| r...`

- **Dashboard:** Security Appliances
  - **Panel:** Top Devices with IP Conflicts (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:securityappliances" category="ip_conflicts" $orgid$
| dedup occurredAt, deviceSerial
| stats count as Count by devic...`

- **Dashboard:** Security Appliances
  - **Panel:** Security Events Occurred by Time (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:securityappliances" $orgid$
| dedup occurredAt, deviceSerial
| timechart count as "Events Occured" span=1d...`

- **Dashboard:** Device Availabilities Change History
  - **Panel:** Top 10 Networks By Device Changes (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesavailabilitieschangehistory" $orgid$ 
| dedup device.serial
| rename network.name as "Network Name" 
| stats ...`

- **Dashboard:** Device Availabilities Change History
  - **Panel:** Top 10 Offline Devices (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesavailabilitieschangehistory" $orgid$ details.new{}.value="offline" 
| dedup device.serial
| rename device.nam...`

- **Dashboard:** Device Availabilities Change History
  - **Panel:** Devices Availabilities Change History (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesavailabilitieschangehistory" $orgid$ 
| dedup device.serial
| rename details.new{}.value as "New Status", det...`

- **Dashboard:** Device Availabilities Change History
  - **Panel:** Device Status History Over Time (chart)
  - **Matched Keywords:** status
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesavailabilitieschangehistory" $orgid$ 
| dedup device.serial
| rename details.new{}.value as new_status 
| tim...`

- **Dashboard:** Top Devices
  - **Panel:** Device Usage Metrics (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:summarytopdevicesbyusage" $orgid$
| dedup name network.id usage.total usage.percentage
| rename name as "Device Name...`

- **Dashboard:** Top Devices
  - **Panel:** Top 10 Networks By Device Usage (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:summarytopdevicesbyusage" $orgid$
| dedup name network.id usage.total usage.percentage
| rename network.name as "Net...`

- **Dashboard:** Top Devices
  - **Panel:** Device Usage Over Time (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:summarytopdevicesbyusage" $orgid$
| dedup name network.id usage.total usage.percentage
| rename name as "Device Name...`

- **Dashboard:** Appliance VPN Statuses
  - **Panel:** VPN Status Data (table)
  - **Matched Keywords:** status
  - **Query Preview:** ``meraki_index` sourcetype="meraki:appliancesdwanstatuses" $orgid$ 
| rename networkName as "Network Name", deviceStatus as "Device Status", Subnet_Nam...`

- **Dashboard:** Wireless Device Packet Loss
  - **Panel:** Packet Loss By Network (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicespacketlossbydevice" $orgid$ 
| eval direction = mvappend("downstream", "upstream") 
| mvexpand direct...`

- **Dashboard:** Wireless Device Packet Loss
  - **Panel:** Total Packets v/s Lost Packets (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicespacketlossbydevice" $orgid$ 
| eval direction = mvappend("Downstream", "Upstream") 
| mvexpand direct...`

- **Dashboard:** Wireless Device Packet Loss
  - **Panel:** Top Networks with High Packet Loss (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicespacketlossbydevice" $orgid$ 
| rename upstream.lost as upstream_loss ,downstream.lost as downstream_l...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Total Alerts (single_value)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$ 
| dedup id 
| stats count as "Alert Count"...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Alert Count by Severity (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$
| dedup id
| rename severity as "Severity"
| stats count as "Alert Count" by Severity...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Alert Data (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$ 
| dedup id
| rename id as "Alert Id", startedAt as "Alert Time" , categoryType as "Categor...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Top Affected Networks (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$
| dedup id
| rename network.name as "Network Name", severity as "Severity Level"
| stats co...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Top Affected Devices (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$ 
| dedup id 
| rename scope.devices{}.name as "Device Name", severity as "Severity Level" 
...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Devices Uplinks History (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename name as "Device Name", uplinks{}.interface as "Int...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Uplink Interface Distribution (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename uplinks{}.interface as "Uplink Interface" 
| stats...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Address Assignment Modes (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename uplinks{}.addresses{}.assignmentMode as "Assignmen...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Protocol Distribution (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename uplinks{}.addresses{}.protocol as "Address Protoco...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Most Frequent Public Addresses (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$
| dedup serial
| rename uplinks{}.addresses{}.public.address as "Public Add...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Most Frequent Gateway IPs (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename uplinks{}.addresses{}.gateway as "Gateway" 
| stat...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Top 10 DNS Servers (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$
| dedup serial
| rename uplinks{}.addresses{}.nameservers.addresses{} as "D...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Top 10 Network Uplinks (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename network.id as "Network Id"
| stats count as Count ...`

#### TA_cisco_catalyst

- **Dashboard:** Splunk Resource Utilization
  - **Panel:** Process Health (chart)
  - **Query Preview:** `index=_internal sourcetype IN ("splunktaciscocybervision:log", "splunktaciscodnacenter:log", "splunktaciscoise:log", "splunktaciscosdwan:log") host IN...`

- **Dashboard:** Splunk Resource Utilization
  - **Panel:** Health Monitoring by Input Connection (table)
  - **Query Preview:** `index=_internal sourcetype IN ("splunktaciscocybervision:log", "splunktaciscodnacenter:log", "splunktaciscoise:log", "splunktaciscosdwan:log") host IN...`

#### cisco-catalyst-app

- **Dashboard:** Overview Reports
  - **Panel:** Network Device Types (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Center_Reports.Cisco_...`

- **Dashboard:** Sensors
  - **Panel:** Door Sensor Status - Latest Readings (chart)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" 
    from datamodel=Cisco_Catalyst_App 
    where nodename=Cisco_Catalyst_Dataset.Cisco...`

- **Dashboard:** Users And Applications
  - **Panel:** User Authentication Status (table)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Authentication Status (chart)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Security and Operational Events Distribution By Severity Over Time (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Cyber_Vision_Syslog_E...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Security Events by Severity (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Cyber_Vision_Syslog_E...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** All Security Events of "$syslog_severity$" Severity (table)
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Security Group Tag by Authentication (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events by ...`

- **Dashboard:** Overview
  - **Panel:** Top 10 Assets By Threat (chart)
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Overview
  - **Panel:** $client_type_health$ Clients Health Score (single_value)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Client_Inventory_And_...`

- **Dashboard:** Overview
  - **Panel:** Network Health Score - $health_category$ (single_value)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Network_Health_Events...`

- **Dashboard:** Security Insights
  - **Panel:** Malicious Files by Malware (chart)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset....`

- **Dashboard:** Security Insights
  - **Panel:** Malicious Files by Type (chart)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset....`

- **Dashboard:** Security Insights
  - **Panel:** URLs by Category (chart)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset....`

- **Dashboard:** Security Insights
  - **Panel:** Blocked Connections Over IPS event (chart)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset....`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$tkn_prevent_run_threat_details$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(_time) as Timestamp from datamodel=Cisco_Cataly...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$tkn_prevent_run_url_details$ | tstats `summariesonly` fillnull_value="N/A" count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Data...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$tkn_prevent_run_ips_details$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Ca...`

- **Dashboard:** Security Insights
  - **Panel:** SGACL - Top Sources (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_SG...`

- **Dashboard:** Security Insights
  - **Panel:** SGACL Events by Action (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count  from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_S...`

- **Dashboard:** Security Insights
  - **Panel:** ACL - Top Denied Sources (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_AC...`

- **Dashboard:** Security Insights
  - **Panel:** ACL - Top Denied Clients (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_AC...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Ci...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats summariesonly=false fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Datase...`

- **Dashboard:** Security Insights
  - **Panel:** Dropped FW Flows (table)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats fillnull_value="N/A" `summariesonly` count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Ci...`

- **Dashboard:** Security Insights
  - **Panel:** Inspected FW Flows (table)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats fillnull_value="N/A" `summariesonly` count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Ci...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats fillnull_value="N/A" `summariesonly` count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Ci...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Ne...`

- **Dashboard:** Security Insights
  - **Panel:** Device Compliance Status (chart)
  - **Matched Keywords:** status
  - **Query Preview:** `$Cisco Catalyst Center$ | tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Cataly...`

- **Dashboard:** Security Insights
  - **Panel:** Device Compliance State (chart)
  - **Query Preview:** `$Cisco Catalyst Center$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Compliance_...`

- **Dashboard:** Security Insights
  - **Panel:** Top 10 Vulnerabilities (chart)
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Vulnerabili...`

- **Dashboard:** Security Insights
  - **Panel:** Rogue Devices Count (single_value)
  - **Query Preview:** `| tstats `summariesonly` count as Count from datamodel=Cisco_Catalyst_App 
  where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Rogue_Events 
  by C...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$rogue_devices_detail$ | tstats fillnull_value="N/A" `summariesonly` count as "Count" values(Cisco_Catalyst_Dataset.Cisco_Catalyst_Rogue_Events.rogue_...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$run_vulnerabilities$ 
| tstats fillnull_value="N/A" `summariesonly` count as "Count" values(Cisco_Catalyst_Dataset.catalyst_vendor_product) as "Sourc...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$tkn_prevent_run_device_compliance_details$| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where node...`

- **Dashboard:** Security Insights
  - **Panel:** Security Advisory Details (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Security Insights
  - **Panel:** ISE Authentication Policy Chart (chart)
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** ISE Authorization Policy Chart (chart)
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** Security Events Occurred by Time (chart)
  - **Query Preview:** `| tstats `summariesonly` count as meraki_security_events_count
    from datamodel=Cisco_Catalyst_App 
    where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` count as Count from datamodel=Cisco_Catalyst_App 
  where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Security_Events 
  b...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Security Insights
  - **Panel:** SGACL Activities (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_SG...`

- **Dashboard:** Endpoint Compliance
  - **Panel:** Posture Status Trend Over Time (chart)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events.ISE...`

- **Dashboard:** Network Insights
  - **Panel:** Device Manageability Type (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Health_Events.device_health_managea...`

- **Dashboard:** Network Insights
  - **Panel:** Device Reachability Type (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Health_Events.device_health_reachab...`

- **Dashboard:** Network Insights
  - **Panel:** Device Family Type (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Health_Events.device_health_device_...`

- **Dashboard:** Step 1 Device Classification
  - **Panel:** C2C-0.1.0 Reporting - USCYBERCOM Device Category (chart)
  - **Query Preview:** `| inputlookup cisco_catalyst_analytics_reports.csv
| eval filteredCybercom=mvfilter(match(cybercomCategory, `cisco_catalyst_CYBERCOM_Macro`) OR match(...`

- **Dashboard:** Step 1 Device Classification
  - **Panel:** C2C-0.1.1 Reporting - Operating System Summary (chart)
  - **Query Preview:** `| inputlookup cisco_catalyst_analytics_reports.csv
| stats count by MatchedPolicy
| sort 0 -count
| rename MatchedPolicy as "Operating System", count ...`

- **Dashboard:** Step 1 Device Classification
  - **Panel:** Untitled (table)
  - **Query Preview:** `| inputlookup cisco_catalyst_analytics_reports.csv
| eval filteredCybercom=mvfilter(match(cybercomCategory, `cisco_catalyst_CYBERCOM_Macro`) OR match(...`

- **Dashboard:** Step 1 Device Classification
  - **Panel:** Untitled (table)
  - **Query Preview:** `| inputlookup cisco_catalyst_analytics_reports.csv
| stats count by MatchedPolicy
| sort 0 -count
| rename MatchedPolicy as "Operating System", count ...`

- **Dashboard:** Network Compliance
  - **Panel:** Network Device Inventory (table)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename IN (Cisco_Catalyst_Dataset.Cisco_Catalyst_Center_Reports.Ci...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** Client Health Score – Wired and Wireless (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Client_Inventory_And_...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** Endpoint Authentication Status (table)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** BYOD Device Enrollment (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Performance
  - **Panel:** ISE System Health (table)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events by ...`

- **Dashboard:** Performance
  - **Panel:** Network System Health (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count(Cisco_Catalyst_Dataset.Cisco_Catalyst_Network_Performance_Events.network_performance_account_id) f...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Site Health (chart)
  - **Query Preview:** `| tstats `summariesonly` latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_Site_Health_Events.sdwan_site_health_site_health) as "Site Health" from da...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Link Health (chart)
  - **Query Preview:** `| tstats `summariesonly` count from datamodel=Cisco_Catalyst_App 
    where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_Link_Health
    by Ci...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Unified Threat Defense Health (chart)
  - **Query Preview:** `| tstats `summariesonly` latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_UTD_Health.sdwan_utd_health_status) as "Admin Status" from datamodel=Cisco...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Tunnel Health (chart)
  - **Query Preview:** `| tstats `summariesonly` count as Count latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_Tunnel_Health.sdwan_tunnel_health_health) as "Tunnel Health...`

#### cisco_sna_app

- **Dashboard:** User Report
  - **Panel:** Security Index (table)
  - **Query Preview:** `|topalarming report_type=users domain_id=$domain_id$ smc_ip=$smc_ip$
            | where like(username, "$username$") | eval time_session_start=strfti...`

- **Dashboard:** Host Snapshot
  - **Panel:** Status: (table)
  - **Matched Keywords:** status
  - **Query Preview:** `| where row_type="host_status" | eval status_first_seen=strftime(strptime(status_first_seen."+0000","%Y-%m-%dT%H:%M:%SZ%z"),"%Y-%m-%d %H:%M:%S %Z") | ...`

- **Dashboard:** Host Snapshot
  - **Panel:** Security Index (table)
  - **Query Preview:** `| where row_type="host_security_summary" | fields "security_concern_index", "security_target_index", "security_recon_index", "security_command_and_con...`

- **Dashboard:** Host Snapshot
  - **Panel:** Host is Source of Security Events (Most Recent) (table)
  - **Query Preview:** `| where row_type="host_security_events" and origin_list="source-list" | eval start_time=strftime(strptime(start_time."+0000","%Y-%m-%dT%H:%M:%SZ%z"),"...`

- **Dashboard:** Host Snapshot
  - **Panel:** Host is Target of Security Events (Most Recent) (table)
  - **Query Preview:** `| where row_type="host_security_events" and origin_list="target-list" | eval start_time=strftime(strptime(start_time."+0000","%Y-%m-%dT%H:%M:%SZ%z"),"...`

- **Dashboard:** Security Events
  - **Panel:** Top Security Event Types (chart)
  - **Query Preview:** `| rename "event_type_name" as "Security Event Type" | stats count by "Security Event Type"...`

- **Dashboard:** Security Events
  - **Panel:** Top Security Event Sources (chart)
  - **Query Preview:** `| where source_ip!="Multiple Hosts" and not like("$form.subject_ip$", "%" . source_ip . "%") and not like("$form.peer_ip$", "%" . source_ip . "%") | r...`

- **Dashboard:** Security Events
  - **Panel:** Top Security Event Targets (chart)
  - **Query Preview:** `| where target_ip!="Multiple Hosts" and not like("$form.subject_ip$", "%" . target_ip . "%") and not like("$form.peer_ip$", "%" . target_ip . "%") | r...`

- **Dashboard:** Security Events
  - **Panel:** Results (table)
  - **Query Preview:** `| sort 0 - ci_points | eval start_time=strftime(strptime(start_time."+0000","%Y-%m-%dT%H:%M:%SZ%z"),"%Y-%m-%d %H:%M:%S %Z") | eval last_time=strftime(...`

- **Dashboard:** Security Events
  - **Panel:** Untitled (table)

- **Dashboard:** Security Event Descriptions
  - **Panel:** Untitled (table)
  - **Query Preview:** `| sort 0 name | fields "name", "description" | rename "name" as "Name", "description" as "Description"...`

- **Dashboard:** Security Event Descriptions
  - **Panel:** Untitled (table)

#### ta_cisco_thousandeyes

- **Dashboard:** Data collection Status
  - **Panel:** Number of Streams (single_value)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` dc(Test_Metrics.thousandeyes.stream.id) as count FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE Test_Metrics.thousand...`

- **Dashboard:** Data collection Status
  - **Panel:** Untitled (table)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` count(Test_Metrics.thousandeyes.stream.id) FROM datamodel="Cisco_ThousandEyes.Test_Metrics"  WHERE Test_Metrics.thousandeyes....`

- **Dashboard:** Data collection Status
  - **Panel:** Number of Cloud & Enterprise Agent Tests and Endpoint Agent Tests (single_value)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` dc(Test_Metrics.thousandeyes.test.id) as count FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE Test_Metrics.thousandey...`

- **Dashboard:** Data collection Status
  - **Panel:** Untitled (table)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` values(Test_Metrics.thousandeyes.test.type) as "Test Types" values(Test_Metrics.thousandeyes.test.name) as "Test Name" FROM d...`

- **Dashboard:** Data collection Status
  - **Panel:** Number of Event Inputs (single_value)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` dc(source) as count FROM datamodel="Cisco_ThousandEyes.Events"  WHERE Events.aid IN($tkn_acc_group$)...`

- **Dashboard:** Data collection Status
  - **Panel:** Untitled (table)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` latest(_time) as time FROM datamodel="Cisco_ThousandEyes.Events"  WHERE Events.aid IN($tkn_acc_group$) BY source | eval sourc...`

- **Dashboard:** Data collection Status
  - **Panel:** Number of Activity Inputs (single_value)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` dc(source) as count FROM datamodel="Cisco_ThousandEyes.Activities"  WHERE Activities.aid IN($tkn_acc_group$)...`

- **Dashboard:** Data collection Status
  - **Panel:** Untitled (table)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` latest(_time) as time FROM datamodel="Cisco_ThousandEyes.Activities"  WHERE Activities.aid IN($tkn_acc_group$) BY source | ev...`

---

### Requirement 10: ZTA identity / auth / policy (ISE, Radius, RadSec)

**Stated Visualization Support:** Yes

**Stated Supporting Apps:** Splunk Add-on for Cisco Identity Services, Cisco ISE App

**Matched Panels Found:** 35

#### Splunk_TA_cisco-ise

- **Dashboard:** Cisco ISE TA Troubleshooting Dashboard
  - **Panel:** Cisco ISE TA version (single_value)
  - **Matched Keywords:** ise
  - **Query Preview:** `| rest services/apps/local/Splunk_TA_cisco-ise splunk_server=local| fields version...`

- **Dashboard:** Cisco ISE TA Troubleshooting Dashboard
  - **Panel:** Total number of Cisco ISE TA events (single_value)
  - **Matched Keywords:** ise
  - **Query Preview:** `| tstats count where index IN `Cisco_ISE_Index` AND sourcetype="cisco:ise:syslog"...`

- **Dashboard:** Cisco ISE TA Troubleshooting Dashboard
  - **Panel:** Event count (chart)
  - **Matched Keywords:** ise
  - **Query Preview:** `index IN `Cisco_ISE_Index` sourcetype IN ("cisco:ise:syslog") | timechart span=12h count(_raw) as "Event count"...`

- **Dashboard:** Cisco ISE TA Troubleshooting Dashboard
  - **Panel:** Distributions of events by index (chart)
  - **Matched Keywords:** ise
  - **Query Preview:** `index IN `Cisco_ISE_Index` sourcetype IN ("cisco:ise:syslog") | stats count by index...`

- **Dashboard:** Cisco ISE TA Troubleshooting Dashboard
  - **Panel:** Trends of events by index (table)
  - **Matched Keywords:** ise
  - **Query Preview:** `index IN `Cisco_ISE_Index` sourcetype IN ("cisco:ise:syslog") | chart sparkline(count) AS "Indexes Trend" count AS Total BY index...`

- **Dashboard:** Cisco ISE TA Troubleshooting Dashboard
  - **Panel:** Events by sources (chart)
  - **Matched Keywords:** ise
  - **Query Preview:** `index IN `Cisco_ISE_Index` sourcetype IN ("cisco:ise:syslog") | top source...`

- **Dashboard:** Cisco ISE TA Troubleshooting Dashboard
  - **Panel:** Events by sourcetypes (chart)
  - **Matched Keywords:** ise
  - **Query Preview:** `index IN `Cisco_ISE_Index` sourcetype IN ("cisco:ise:syslog") | top sourcetype...`

- **Dashboard:** Cisco ISE TA Troubleshooting Dashboard
  - **Panel:** Untitled (table)
  - **Matched Keywords:** ise

- **Dashboard:** Cisco ISE TA Troubleshooting Dashboard
  - **Panel:** Network Traffic (single_value)
  - **Matched Keywords:** ise
  - **Query Preview:** `| pivot Network_Traffic All_Traffic count(All_Traffic) AS "Count of All Traffic" FILTER sourcetype is "cisco:ise:syslog" ROWSUMMARY 0 COLSUMMARY 0 SHO...`

- **Dashboard:** Cisco ISE TA Troubleshooting Dashboard
  - **Panel:** Authentication (single_value)
  - **Matched Keywords:** ise
  - **Query Preview:** `index IN `Cisco_ISE_Index` sourcetype IN ("cisco:ise:syslog") tag IN ("authentication") | stats count AS total_count...`

- **Dashboard:** Cisco ISE TA Troubleshooting Dashboard
  - **Panel:** Change (single_value)
  - **Matched Keywords:** ise
  - **Query Preview:** `index IN `Cisco_ISE_Index` sourcetype IN ("cisco:ise:syslog") tag IN ("change") | stats count AS total_count...`

- **Dashboard:** Cisco ISE TA Troubleshooting Dashboard
  - **Panel:** Alerts (single_value)
  - **Matched Keywords:** ise
  - **Query Preview:** `| pivot Alerts Alerts count(Alerts) AS "Count of Alerts" FILTER sourcetype is "cisco:ise:syslog" ROWSUMMARY 0 COLSUMMARY 0 SHOWOTHER 1...`

- **Dashboard:** Cisco ISE TA Troubleshooting Dashboard
  - **Panel:** Inventory (single_value)
  - **Matched Keywords:** ise
  - **Query Preview:** `| pivot Compute_Inventory All_Inventory count(All_Inventory) AS "Count of All Inventory" FILTER sourcetype is "cisco:ise:syslog" ROWSUMMARY 0 COLSUMMA...`

- **Dashboard:** Cisco ISE TA Troubleshooting Dashboard
  - **Panel:** Endpoint (single_value)
  - **Matched Keywords:** ise
  - **Query Preview:** `| pivot Endpoint Services count(Services) AS "Count of Services" FILTER vendor_product in ("Cisco Identity Services Engine","Cisco Secure Access Contr...`

#### cisco-catalyst-app

- **Dashboard:** Users And Applications
  - **Panel:** User Identity Summary (table)
  - **Matched Keywords:** identity
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Audit Logs for Cisco ISE (table)
  - **Matched Keywords:** ise
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Event Notifications for Cisco ISE (table)
  - **Matched Keywords:** ise
  - **Query Preview:** `| tstats fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Event_Notificati...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Meraki Policy Sync (chart)
  - **Matched Keywords:** policy
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events.ISE...`

- **Dashboard:** Overview
  - **Panel:** Top Policy Hits for SD-WAN (chart)
  - **Matched Keywords:** policy
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Overview
  - **Panel:** Top Policy Set Hits for Cisco ISE (chart)
  - **Matched Keywords:** policy, ise
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Policy_Events by Cisc...`

- **Dashboard:** Overview
  - **Panel:** ISE Authentication Summary (chart)
  - **Matched Keywords:** ise
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Overview
  - **Panel:** ISE Events Summary (chart)
  - **Matched Keywords:** ise
  - **Query Preview:** `| tstats `summariesonly` count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events by _time, Cisc...`

- **Dashboard:** Security Insights
  - **Panel:** ISE Authentication Policy Chart (chart)
  - **Matched Keywords:** policy, ise
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** ISE Authorization Policy Chart (chart)
  - **Matched Keywords:** policy, ise
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Network Insights
  - **Panel:** ISE $authentication_latency_type$ Authentication Latency (chart)
  - **Matched Keywords:** ise
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events
Cis...`

- **Dashboard:** Network Insights
  - **Panel:** ISE Top 10 Active Endpoints (chart)
  - **Matched Keywords:** ise
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events Cis...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** Endpoint Identity Summary (table)
  - **Matched Keywords:** identity
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" 
  from datamodel=Cisco_Catalyst_App 
  where nodename=Cisco_Catalyst_Dataset.Cisco_Cat...`

- **Dashboard:** Performance
  - **Panel:** ISE System Health (table)
  - **Matched Keywords:** ise
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events by ...`

- **Dashboard:** Performance
  - **Panel:** Auth Latency (RADIUS) (chart)
  - **Matched Keywords:** auth, radius
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events.ISE...`

- **Dashboard:** Performance
  - **Panel:** Auth Latency (TACACS) (chart)
  - **Matched Keywords:** auth
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events.ISE...`

- **Dashboard:** Performance
  - **Panel:** Audit Logs for Cisco ISE (table)
  - **Matched Keywords:** ise
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

#### cisco_sna_app

- **Dashboard:** Host Snapshot
  - **Panel:** Identity Sessions (table)
  - **Matched Keywords:** identity
  - **Query Preview:** `| where row_type="host_identity_session" | eval start_time=strftime(strptime(start_time."+0000","%Y-%m-%dT%H:%M:%SZ%z"),"%Y-%m-%d %H:%M:%S %Z") | sort...`

- **Dashboard:** Top Reports
  - **Panel:** Top Services by Bytes: (chart)
  - **Query Preview:** `| where rowType="results" and reportType="services" | rename "serviceName" as "Service" | chart values("bytes") as "Bytes" by "Service"...`

- **Dashboard:** Top Reports
  - **Panel:** Top Services by Packets: (chart)
  - **Query Preview:** `| where rowType="results" and reportType="services" | rename "serviceName" as "Service" | chart values("packets") as "Packets" by "Service"...`

- **Dashboard:** Top Reports
  - **Panel:** Top Services by Flows: (chart)
  - **Query Preview:** `| where rowType="results" and reportType="services" | rename "serviceName" as "Service" | chart values("flows") as "Flows" by "Service"...`

---

### Requirement 11: Policy control plane health

**Stated Visualization Support:** No

**Stated Supporting Apps:** Splunk Add-on for Cisco Identity Services

**Matched Panels Found:** 74

#### Splunk_TA_cisco_meraki

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Ethernet Port Statuses (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$ 
| dedup serial
| rename name as "Device Name", ports{}.name as "Ports Name...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Devices Without Power Connectivity (table)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename power.ac.isConnected as ac , power.poe.isConnected...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** POE Standard Distribution (chart)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename ports{}.poe.standard as "POE Standard"
| stats cou...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Ports Speed (chart)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename ports{}.linkNegotiation.speed as "Port Speed"
| st...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Wireless Device Ethernet Status | Aggregation Status (chart)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename aggregation.enabled as aggregation_enabled
| eval ...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Network Port Speeds (table)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| rename ports{}.linkNegotiation.speed as port_speed, network.id as "Netwo...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Networks with Most PoE Devices (chart)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename power.poe.isConnected as poe_connected, network.id...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Power Mode Distribution (chart)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename power.mode as "Power Mode"
| stats count by "Power...`

- **Dashboard:** Device Availabilities Change History
  - **Panel:** Top 10 Networks By Device Changes (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesavailabilitieschangehistory" $orgid$ 
| dedup device.serial
| rename network.name as "Network Name" 
| stats ...`

- **Dashboard:** Device Availabilities Change History
  - **Panel:** Top 10 Offline Devices (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesavailabilitieschangehistory" $orgid$ details.new{}.value="offline" 
| dedup device.serial
| rename device.nam...`

- **Dashboard:** Device Availabilities Change History
  - **Panel:** Devices Availabilities Change History (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesavailabilitieschangehistory" $orgid$ 
| dedup device.serial
| rename details.new{}.value as "New Status", det...`

- **Dashboard:** Device Availabilities Change History
  - **Panel:** Device Status History Over Time (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesavailabilitieschangehistory" $orgid$ 
| dedup device.serial
| rename details.new{}.value as new_status 
| tim...`

- **Dashboard:** Top Devices
  - **Panel:** Device Usage Metrics (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:summarytopdevicesbyusage" $orgid$
| dedup name network.id usage.total usage.percentage
| rename name as "Device Name...`

- **Dashboard:** Top Devices
  - **Panel:** Top 10 Networks By Device Usage (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:summarytopdevicesbyusage" $orgid$
| dedup name network.id usage.total usage.percentage
| rename network.name as "Net...`

- **Dashboard:** Top Devices
  - **Panel:** Device Usage Over Time (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:summarytopdevicesbyusage" $orgid$
| dedup name network.id usage.total usage.percentage
| rename name as "Device Name...`

- **Dashboard:** Appliance VPN Statuses
  - **Panel:** VPN Status Data (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:appliancesdwanstatuses" $orgid$ 
| rename networkName as "Network Name", deviceStatus as "Device Status", Subnet_Nam...`

- **Dashboard:** Wireless Device Packet Loss
  - **Panel:** Packet Loss By Network (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicespacketlossbydevice" $orgid$ 
| eval direction = mvappend("downstream", "upstream") 
| mvexpand direct...`

- **Dashboard:** Wireless Device Packet Loss
  - **Panel:** Total Packets v/s Lost Packets (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicespacketlossbydevice" $orgid$ 
| eval direction = mvappend("Downstream", "Upstream") 
| mvexpand direct...`

- **Dashboard:** Wireless Device Packet Loss
  - **Panel:** Top Networks with High Packet Loss (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicespacketlossbydevice" $orgid$ 
| rename upstream.lost as upstream_loss ,downstream.lost as downstream_l...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Total Alerts (single_value)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$ 
| dedup id 
| stats count as "Alert Count"...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Alert Count by Severity (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$
| dedup id
| rename severity as "Severity"
| stats count as "Alert Count" by Severity...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Alert Data (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$ 
| dedup id
| rename id as "Alert Id", startedAt as "Alert Time" , categoryType as "Categor...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Top Affected Networks (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$
| dedup id
| rename network.name as "Network Name", severity as "Severity Level"
| stats co...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Top Affected Devices (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$ 
| dedup id 
| rename scope.devices{}.name as "Device Name", severity as "Severity Level" 
...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Devices Uplinks History (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename name as "Device Name", uplinks{}.interface as "Int...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Uplink Interface Distribution (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename uplinks{}.interface as "Uplink Interface" 
| stats...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Address Assignment Modes (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename uplinks{}.addresses{}.assignmentMode as "Assignmen...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Protocol Distribution (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename uplinks{}.addresses{}.protocol as "Address Protoco...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Most Frequent Public Addresses (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$
| dedup serial
| rename uplinks{}.addresses{}.public.address as "Public Add...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Most Frequent Gateway IPs (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename uplinks{}.addresses{}.gateway as "Gateway" 
| stat...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Top 10 DNS Servers (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$
| dedup serial
| rename uplinks{}.addresses{}.nameservers.addresses{} as "D...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Top 10 Network Uplinks (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename network.id as "Network Id"
| stats count as Count ...`

#### TA_cisco_catalyst

- **Dashboard:** Splunk Resource Utilization
  - **Panel:** Process Health (chart)
  - **Matched Keywords:** health
  - **Query Preview:** `index=_internal sourcetype IN ("splunktaciscocybervision:log", "splunktaciscodnacenter:log", "splunktaciscoise:log", "splunktaciscosdwan:log") host IN...`

- **Dashboard:** Splunk Resource Utilization
  - **Panel:** Health Monitoring by Input Connection (table)
  - **Matched Keywords:** health
  - **Query Preview:** `index=_internal sourcetype IN ("splunktaciscocybervision:log", "splunktaciscodnacenter:log", "splunktaciscoise:log", "splunktaciscosdwan:log") host IN...`

#### cisco-catalyst-app

- **Dashboard:** Overview Reports
  - **Panel:** Network Device Types (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Center_Reports.Cisco_...`

- **Dashboard:** Sensors
  - **Panel:** Door Sensor Status - Latest Readings (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" 
    from datamodel=Cisco_Catalyst_App 
    where nodename=Cisco_Catalyst_Dataset.Cisco...`

- **Dashboard:** Users And Applications
  - **Panel:** User Authentication Status (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Authentication Status (chart)
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Meraki Policy Sync (chart)
  - **Matched Keywords:** policy
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events.ISE...`

- **Dashboard:** Overview
  - **Panel:** Top Policy Hits for SD-WAN (chart)
  - **Matched Keywords:** policy
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Overview
  - **Panel:** Top Policy Set Hits for Cisco ISE (chart)
  - **Matched Keywords:** policy
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Policy_Events by Cisc...`

- **Dashboard:** Overview
  - **Panel:** $client_type_health$ Clients Health Score (single_value)
  - **Matched Keywords:** health
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Client_Inventory_And_...`

- **Dashboard:** Overview
  - **Panel:** Network Health Score - $health_category$ (single_value)
  - **Matched Keywords:** health
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Network_Health_Events...`

- **Dashboard:** Security Insights
  - **Panel:** Device Compliance Status (chart)
  - **Query Preview:** `$Cisco Catalyst Center$ | tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Cataly...`

- **Dashboard:** Security Insights
  - **Panel:** Device Compliance State (chart)
  - **Query Preview:** `$Cisco Catalyst Center$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Compliance_...`

- **Dashboard:** Security Insights
  - **Panel:** ISE Authentication Policy Chart (chart)
  - **Matched Keywords:** policy
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** ISE Authorization Policy Chart (chart)
  - **Matched Keywords:** policy
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Endpoint Compliance
  - **Panel:** Posture Status Trend Over Time (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events.ISE...`

- **Dashboard:** Network Insights
  - **Panel:** Device Manageability Type (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Health_Events.device_health_managea...`

- **Dashboard:** Network Insights
  - **Panel:** Device Reachability Type (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Health_Events.device_health_reachab...`

- **Dashboard:** Network Insights
  - **Panel:** Device Family Type (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Health_Events.device_health_device_...`

- **Dashboard:** Step 1 Device Classification
  - **Panel:** C2C-0.1.0 Reporting - USCYBERCOM Device Category (chart)
  - **Query Preview:** `| inputlookup cisco_catalyst_analytics_reports.csv
| eval filteredCybercom=mvfilter(match(cybercomCategory, `cisco_catalyst_CYBERCOM_Macro`) OR match(...`

- **Dashboard:** Step 1 Device Classification
  - **Panel:** C2C-0.1.1 Reporting - Operating System Summary (chart)
  - **Query Preview:** `| inputlookup cisco_catalyst_analytics_reports.csv
| stats count by MatchedPolicy
| sort 0 -count
| rename MatchedPolicy as "Operating System", count ...`

- **Dashboard:** Step 1 Device Classification
  - **Panel:** Untitled (table)
  - **Query Preview:** `| inputlookup cisco_catalyst_analytics_reports.csv
| eval filteredCybercom=mvfilter(match(cybercomCategory, `cisco_catalyst_CYBERCOM_Macro`) OR match(...`

- **Dashboard:** Step 1 Device Classification
  - **Panel:** Untitled (table)
  - **Query Preview:** `| inputlookup cisco_catalyst_analytics_reports.csv
| stats count by MatchedPolicy
| sort 0 -count
| rename MatchedPolicy as "Operating System", count ...`

- **Dashboard:** Network Compliance
  - **Panel:** Network Device Inventory (table)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename IN (Cisco_Catalyst_Dataset.Cisco_Catalyst_Center_Reports.Ci...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** Client Health Score – Wired and Wireless (chart)
  - **Matched Keywords:** health
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Client_Inventory_And_...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** Endpoint Authentication Status (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** BYOD Device Enrollment (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Performance
  - **Panel:** ISE System Health (table)
  - **Matched Keywords:** health
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events by ...`

- **Dashboard:** Performance
  - **Panel:** Network System Health (table)
  - **Matched Keywords:** health
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count(Cisco_Catalyst_Dataset.Cisco_Catalyst_Network_Performance_Events.network_performance_account_id) f...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Site Health (chart)
  - **Matched Keywords:** health
  - **Query Preview:** `| tstats `summariesonly` latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_Site_Health_Events.sdwan_site_health_site_health) as "Site Health" from da...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Link Health (chart)
  - **Matched Keywords:** health
  - **Query Preview:** `| tstats `summariesonly` count from datamodel=Cisco_Catalyst_App 
    where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_Link_Health
    by Ci...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Unified Threat Defense Health (chart)
  - **Matched Keywords:** health
  - **Query Preview:** `| tstats `summariesonly` latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_UTD_Health.sdwan_utd_health_status) as "Admin Status" from datamodel=Cisco...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Tunnel Health (chart)
  - **Matched Keywords:** health
  - **Query Preview:** `| tstats `summariesonly` count as Count latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_Tunnel_Health.sdwan_tunnel_health_health) as "Tunnel Health...`

#### cisco_sna_app

- **Dashboard:** Host Snapshot
  - **Panel:** Status: (table)
  - **Query Preview:** `| where row_type="host_status" | eval status_first_seen=strftime(strptime(status_first_seen."+0000","%Y-%m-%dT%H:%M:%SZ%z"),"%Y-%m-%d %H:%M:%S %Z") | ...`

#### ta_cisco_thousandeyes

- **Dashboard:** Data collection Status
  - **Panel:** Number of Streams (single_value)
  - **Query Preview:** `| tstats `summariesonly` dc(Test_Metrics.thousandeyes.stream.id) as count FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE Test_Metrics.thousand...`

- **Dashboard:** Data collection Status
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` count(Test_Metrics.thousandeyes.stream.id) FROM datamodel="Cisco_ThousandEyes.Test_Metrics"  WHERE Test_Metrics.thousandeyes....`

- **Dashboard:** Data collection Status
  - **Panel:** Number of Cloud & Enterprise Agent Tests and Endpoint Agent Tests (single_value)
  - **Query Preview:** `| tstats `summariesonly` dc(Test_Metrics.thousandeyes.test.id) as count FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE Test_Metrics.thousandey...`

- **Dashboard:** Data collection Status
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` values(Test_Metrics.thousandeyes.test.type) as "Test Types" values(Test_Metrics.thousandeyes.test.name) as "Test Name" FROM d...`

- **Dashboard:** Data collection Status
  - **Panel:** Number of Event Inputs (single_value)
  - **Query Preview:** `| tstats `summariesonly` dc(source) as count FROM datamodel="Cisco_ThousandEyes.Events"  WHERE Events.aid IN($tkn_acc_group$)...`

- **Dashboard:** Data collection Status
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` latest(_time) as time FROM datamodel="Cisco_ThousandEyes.Events"  WHERE Events.aid IN($tkn_acc_group$) BY source | eval sourc...`

- **Dashboard:** Data collection Status
  - **Panel:** Number of Activity Inputs (single_value)
  - **Query Preview:** `| tstats `summariesonly` dc(source) as count FROM datamodel="Cisco_ThousandEyes.Activities"  WHERE Activities.aid IN($tkn_acc_group$)...`

- **Dashboard:** Data collection Status
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` latest(_time) as time FROM datamodel="Cisco_ThousandEyes.Activities"  WHERE Activities.aid IN($tkn_acc_group$) BY source | ev...`

---

### Requirement 12: Radius control plane status

**Stated Visualization Support:** Partial

**Stated Supporting Apps:** Splunk Add-on for Cisco Identity Services

**Matched Panels Found:** 70

#### Splunk_TA_cisco_meraki

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Ethernet Port Statuses (table)
  - **Matched Keywords:** status
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$ 
| dedup serial
| rename name as "Device Name", ports{}.name as "Ports Name...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Devices Without Power Connectivity (table)
  - **Matched Keywords:** status
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename power.ac.isConnected as ac , power.poe.isConnected...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** POE Standard Distribution (chart)
  - **Matched Keywords:** status
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename ports{}.poe.standard as "POE Standard"
| stats cou...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Ports Speed (chart)
  - **Matched Keywords:** status
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename ports{}.linkNegotiation.speed as "Port Speed"
| st...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Wireless Device Ethernet Status | Aggregation Status (chart)
  - **Matched Keywords:** status
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename aggregation.enabled as aggregation_enabled
| eval ...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Network Port Speeds (table)
  - **Matched Keywords:** status
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| rename ports{}.linkNegotiation.speed as port_speed, network.id as "Netwo...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Networks with Most PoE Devices (chart)
  - **Matched Keywords:** status
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename power.poe.isConnected as poe_connected, network.id...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Power Mode Distribution (chart)
  - **Matched Keywords:** status
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename power.mode as "Power Mode"
| stats count by "Power...`

- **Dashboard:** Device Availabilities Change History
  - **Panel:** Top 10 Networks By Device Changes (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesavailabilitieschangehistory" $orgid$ 
| dedup device.serial
| rename network.name as "Network Name" 
| stats ...`

- **Dashboard:** Device Availabilities Change History
  - **Panel:** Top 10 Offline Devices (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesavailabilitieschangehistory" $orgid$ details.new{}.value="offline" 
| dedup device.serial
| rename device.nam...`

- **Dashboard:** Device Availabilities Change History
  - **Panel:** Devices Availabilities Change History (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesavailabilitieschangehistory" $orgid$ 
| dedup device.serial
| rename details.new{}.value as "New Status", det...`

- **Dashboard:** Device Availabilities Change History
  - **Panel:** Device Status History Over Time (chart)
  - **Matched Keywords:** status
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesavailabilitieschangehistory" $orgid$ 
| dedup device.serial
| rename details.new{}.value as new_status 
| tim...`

- **Dashboard:** Top Devices
  - **Panel:** Device Usage Metrics (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:summarytopdevicesbyusage" $orgid$
| dedup name network.id usage.total usage.percentage
| rename name as "Device Name...`

- **Dashboard:** Top Devices
  - **Panel:** Top 10 Networks By Device Usage (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:summarytopdevicesbyusage" $orgid$
| dedup name network.id usage.total usage.percentage
| rename network.name as "Net...`

- **Dashboard:** Top Devices
  - **Panel:** Device Usage Over Time (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:summarytopdevicesbyusage" $orgid$
| dedup name network.id usage.total usage.percentage
| rename name as "Device Name...`

- **Dashboard:** Appliance VPN Statuses
  - **Panel:** VPN Status Data (table)
  - **Matched Keywords:** status
  - **Query Preview:** ``meraki_index` sourcetype="meraki:appliancesdwanstatuses" $orgid$ 
| rename networkName as "Network Name", deviceStatus as "Device Status", Subnet_Nam...`

- **Dashboard:** Wireless Device Packet Loss
  - **Panel:** Packet Loss By Network (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicespacketlossbydevice" $orgid$ 
| eval direction = mvappend("downstream", "upstream") 
| mvexpand direct...`

- **Dashboard:** Wireless Device Packet Loss
  - **Panel:** Total Packets v/s Lost Packets (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicespacketlossbydevice" $orgid$ 
| eval direction = mvappend("Downstream", "Upstream") 
| mvexpand direct...`

- **Dashboard:** Wireless Device Packet Loss
  - **Panel:** Top Networks with High Packet Loss (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicespacketlossbydevice" $orgid$ 
| rename upstream.lost as upstream_loss ,downstream.lost as downstream_l...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Total Alerts (single_value)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$ 
| dedup id 
| stats count as "Alert Count"...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Alert Count by Severity (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$
| dedup id
| rename severity as "Severity"
| stats count as "Alert Count" by Severity...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Alert Data (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$ 
| dedup id
| rename id as "Alert Id", startedAt as "Alert Time" , categoryType as "Categor...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Top Affected Networks (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$
| dedup id
| rename network.name as "Network Name", severity as "Severity Level"
| stats co...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Top Affected Devices (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$ 
| dedup id 
| rename scope.devices{}.name as "Device Name", severity as "Severity Level" 
...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Devices Uplinks History (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename name as "Device Name", uplinks{}.interface as "Int...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Uplink Interface Distribution (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename uplinks{}.interface as "Uplink Interface" 
| stats...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Address Assignment Modes (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename uplinks{}.addresses{}.assignmentMode as "Assignmen...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Protocol Distribution (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename uplinks{}.addresses{}.protocol as "Address Protoco...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Most Frequent Public Addresses (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$
| dedup serial
| rename uplinks{}.addresses{}.public.address as "Public Add...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Most Frequent Gateway IPs (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename uplinks{}.addresses{}.gateway as "Gateway" 
| stat...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Top 10 DNS Servers (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$
| dedup serial
| rename uplinks{}.addresses{}.nameservers.addresses{} as "D...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Top 10 Network Uplinks (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename network.id as "Network Id"
| stats count as Count ...`

#### TA_cisco_catalyst

- **Dashboard:** Splunk Resource Utilization
  - **Panel:** Process Health (chart)
  - **Query Preview:** `index=_internal sourcetype IN ("splunktaciscocybervision:log", "splunktaciscodnacenter:log", "splunktaciscoise:log", "splunktaciscosdwan:log") host IN...`

- **Dashboard:** Splunk Resource Utilization
  - **Panel:** Health Monitoring by Input Connection (table)
  - **Query Preview:** `index=_internal sourcetype IN ("splunktaciscocybervision:log", "splunktaciscodnacenter:log", "splunktaciscoise:log", "splunktaciscosdwan:log") host IN...`

#### cisco-catalyst-app

- **Dashboard:** Overview Reports
  - **Panel:** Network Device Types (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Center_Reports.Cisco_...`

- **Dashboard:** Sensors
  - **Panel:** Door Sensor Status - Latest Readings (chart)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" 
    from datamodel=Cisco_Catalyst_App 
    where nodename=Cisco_Catalyst_Dataset.Cisco...`

- **Dashboard:** Users And Applications
  - **Panel:** User Authentication Status (table)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Authentication Status (chart)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Overview
  - **Panel:** $client_type_health$ Clients Health Score (single_value)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Client_Inventory_And_...`

- **Dashboard:** Overview
  - **Panel:** Network Health Score - $health_category$ (single_value)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Network_Health_Events...`

- **Dashboard:** Security Insights
  - **Panel:** Device Compliance Status (chart)
  - **Matched Keywords:** status
  - **Query Preview:** `$Cisco Catalyst Center$ | tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Cataly...`

- **Dashboard:** Security Insights
  - **Panel:** Device Compliance State (chart)
  - **Query Preview:** `$Cisco Catalyst Center$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Compliance_...`

- **Dashboard:** Endpoint Compliance
  - **Panel:** Posture Status Trend Over Time (chart)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events.ISE...`

- **Dashboard:** Network Insights
  - **Panel:** Device Manageability Type (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Health_Events.device_health_managea...`

- **Dashboard:** Network Insights
  - **Panel:** Device Reachability Type (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Health_Events.device_health_reachab...`

- **Dashboard:** Network Insights
  - **Panel:** Device Family Type (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Health_Events.device_health_device_...`

- **Dashboard:** Step 1 Device Classification
  - **Panel:** C2C-0.1.0 Reporting - USCYBERCOM Device Category (chart)
  - **Query Preview:** `| inputlookup cisco_catalyst_analytics_reports.csv
| eval filteredCybercom=mvfilter(match(cybercomCategory, `cisco_catalyst_CYBERCOM_Macro`) OR match(...`

- **Dashboard:** Step 1 Device Classification
  - **Panel:** C2C-0.1.1 Reporting - Operating System Summary (chart)
  - **Query Preview:** `| inputlookup cisco_catalyst_analytics_reports.csv
| stats count by MatchedPolicy
| sort 0 -count
| rename MatchedPolicy as "Operating System", count ...`

- **Dashboard:** Step 1 Device Classification
  - **Panel:** Untitled (table)
  - **Query Preview:** `| inputlookup cisco_catalyst_analytics_reports.csv
| eval filteredCybercom=mvfilter(match(cybercomCategory, `cisco_catalyst_CYBERCOM_Macro`) OR match(...`

- **Dashboard:** Step 1 Device Classification
  - **Panel:** Untitled (table)
  - **Query Preview:** `| inputlookup cisco_catalyst_analytics_reports.csv
| stats count by MatchedPolicy
| sort 0 -count
| rename MatchedPolicy as "Operating System", count ...`

- **Dashboard:** Network Compliance
  - **Panel:** Network Device Inventory (table)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename IN (Cisco_Catalyst_Dataset.Cisco_Catalyst_Center_Reports.Ci...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** Client Health Score – Wired and Wireless (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Client_Inventory_And_...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** Endpoint Authentication Status (table)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** BYOD Device Enrollment (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Performance
  - **Panel:** ISE System Health (table)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events by ...`

- **Dashboard:** Performance
  - **Panel:** Auth Latency (RADIUS) (chart)
  - **Matched Keywords:** radius
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events.ISE...`

- **Dashboard:** Performance
  - **Panel:** Network System Health (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count(Cisco_Catalyst_Dataset.Cisco_Catalyst_Network_Performance_Events.network_performance_account_id) f...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Site Health (chart)
  - **Query Preview:** `| tstats `summariesonly` latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_Site_Health_Events.sdwan_site_health_site_health) as "Site Health" from da...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Link Health (chart)
  - **Query Preview:** `| tstats `summariesonly` count from datamodel=Cisco_Catalyst_App 
    where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_Link_Health
    by Ci...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Unified Threat Defense Health (chart)
  - **Query Preview:** `| tstats `summariesonly` latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_UTD_Health.sdwan_utd_health_status) as "Admin Status" from datamodel=Cisco...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Tunnel Health (chart)
  - **Query Preview:** `| tstats `summariesonly` count as Count latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_Tunnel_Health.sdwan_tunnel_health_health) as "Tunnel Health...`

#### cisco_sna_app

- **Dashboard:** Host Snapshot
  - **Panel:** Status: (table)
  - **Matched Keywords:** status
  - **Query Preview:** `| where row_type="host_status" | eval status_first_seen=strftime(strptime(status_first_seen."+0000","%Y-%m-%dT%H:%M:%SZ%z"),"%Y-%m-%d %H:%M:%S %Z") | ...`

#### ta_cisco_thousandeyes

- **Dashboard:** Data collection Status
  - **Panel:** Number of Streams (single_value)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` dc(Test_Metrics.thousandeyes.stream.id) as count FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE Test_Metrics.thousand...`

- **Dashboard:** Data collection Status
  - **Panel:** Untitled (table)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` count(Test_Metrics.thousandeyes.stream.id) FROM datamodel="Cisco_ThousandEyes.Test_Metrics"  WHERE Test_Metrics.thousandeyes....`

- **Dashboard:** Data collection Status
  - **Panel:** Number of Cloud & Enterprise Agent Tests and Endpoint Agent Tests (single_value)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` dc(Test_Metrics.thousandeyes.test.id) as count FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE Test_Metrics.thousandey...`

- **Dashboard:** Data collection Status
  - **Panel:** Untitled (table)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` values(Test_Metrics.thousandeyes.test.type) as "Test Types" values(Test_Metrics.thousandeyes.test.name) as "Test Name" FROM d...`

- **Dashboard:** Data collection Status
  - **Panel:** Number of Event Inputs (single_value)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` dc(source) as count FROM datamodel="Cisco_ThousandEyes.Events"  WHERE Events.aid IN($tkn_acc_group$)...`

- **Dashboard:** Data collection Status
  - **Panel:** Untitled (table)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` latest(_time) as time FROM datamodel="Cisco_ThousandEyes.Events"  WHERE Events.aid IN($tkn_acc_group$) BY source | eval sourc...`

- **Dashboard:** Data collection Status
  - **Panel:** Number of Activity Inputs (single_value)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` dc(source) as count FROM datamodel="Cisco_ThousandEyes.Activities"  WHERE Activities.aid IN($tkn_acc_group$)...`

- **Dashboard:** Data collection Status
  - **Panel:** Untitled (table)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` latest(_time) as time FROM datamodel="Cisco_ThousandEyes.Activities"  WHERE Activities.aid IN($tkn_acc_group$) BY source | ev...`

---

### Requirement 13: Sync status (ISE, EntraID, PxGrid)

**Stated Visualization Support:** No

**Stated Supporting Apps:** Splunk Add-on for Cisco Identity Services

**Matched Panels Found:** 100

#### Splunk_TA_cisco-ise

- **Dashboard:** Cisco ISE TA Troubleshooting Dashboard
  - **Panel:** Cisco ISE TA version (single_value)
  - **Matched Keywords:** ise
  - **Query Preview:** `| rest services/apps/local/Splunk_TA_cisco-ise splunk_server=local| fields version...`

- **Dashboard:** Cisco ISE TA Troubleshooting Dashboard
  - **Panel:** Total number of Cisco ISE TA events (single_value)
  - **Matched Keywords:** ise
  - **Query Preview:** `| tstats count where index IN `Cisco_ISE_Index` AND sourcetype="cisco:ise:syslog"...`

- **Dashboard:** Cisco ISE TA Troubleshooting Dashboard
  - **Panel:** Event count (chart)
  - **Matched Keywords:** ise
  - **Query Preview:** `index IN `Cisco_ISE_Index` sourcetype IN ("cisco:ise:syslog") | timechart span=12h count(_raw) as "Event count"...`

- **Dashboard:** Cisco ISE TA Troubleshooting Dashboard
  - **Panel:** Distributions of events by index (chart)
  - **Matched Keywords:** ise
  - **Query Preview:** `index IN `Cisco_ISE_Index` sourcetype IN ("cisco:ise:syslog") | stats count by index...`

- **Dashboard:** Cisco ISE TA Troubleshooting Dashboard
  - **Panel:** Trends of events by index (table)
  - **Matched Keywords:** ise
  - **Query Preview:** `index IN `Cisco_ISE_Index` sourcetype IN ("cisco:ise:syslog") | chart sparkline(count) AS "Indexes Trend" count AS Total BY index...`

- **Dashboard:** Cisco ISE TA Troubleshooting Dashboard
  - **Panel:** Events by sources (chart)
  - **Matched Keywords:** ise
  - **Query Preview:** `index IN `Cisco_ISE_Index` sourcetype IN ("cisco:ise:syslog") | top source...`

- **Dashboard:** Cisco ISE TA Troubleshooting Dashboard
  - **Panel:** Events by sourcetypes (chart)
  - **Matched Keywords:** ise
  - **Query Preview:** `index IN `Cisco_ISE_Index` sourcetype IN ("cisco:ise:syslog") | top sourcetype...`

- **Dashboard:** Cisco ISE TA Troubleshooting Dashboard
  - **Panel:** Untitled (table)
  - **Matched Keywords:** ise

- **Dashboard:** Cisco ISE TA Troubleshooting Dashboard
  - **Panel:** Network Traffic (single_value)
  - **Matched Keywords:** ise
  - **Query Preview:** `| pivot Network_Traffic All_Traffic count(All_Traffic) AS "Count of All Traffic" FILTER sourcetype is "cisco:ise:syslog" ROWSUMMARY 0 COLSUMMARY 0 SHO...`

- **Dashboard:** Cisco ISE TA Troubleshooting Dashboard
  - **Panel:** Authentication (single_value)
  - **Matched Keywords:** ise
  - **Query Preview:** `index IN `Cisco_ISE_Index` sourcetype IN ("cisco:ise:syslog") tag IN ("authentication") | stats count AS total_count...`

- **Dashboard:** Cisco ISE TA Troubleshooting Dashboard
  - **Panel:** Change (single_value)
  - **Matched Keywords:** ise
  - **Query Preview:** `index IN `Cisco_ISE_Index` sourcetype IN ("cisco:ise:syslog") tag IN ("change") | stats count AS total_count...`

- **Dashboard:** Cisco ISE TA Troubleshooting Dashboard
  - **Panel:** Alerts (single_value)
  - **Matched Keywords:** ise
  - **Query Preview:** `| pivot Alerts Alerts count(Alerts) AS "Count of Alerts" FILTER sourcetype is "cisco:ise:syslog" ROWSUMMARY 0 COLSUMMARY 0 SHOWOTHER 1...`

- **Dashboard:** Cisco ISE TA Troubleshooting Dashboard
  - **Panel:** Inventory (single_value)
  - **Matched Keywords:** ise
  - **Query Preview:** `| pivot Compute_Inventory All_Inventory count(All_Inventory) AS "Count of All Inventory" FILTER sourcetype is "cisco:ise:syslog" ROWSUMMARY 0 COLSUMMA...`

- **Dashboard:** Cisco ISE TA Troubleshooting Dashboard
  - **Panel:** Endpoint (single_value)
  - **Matched Keywords:** ise
  - **Query Preview:** `| pivot Endpoint Services count(Services) AS "Count of Services" FILTER vendor_product in ("Cisco Identity Services Engine","Cisco Secure Access Contr...`

#### Splunk_TA_cisco_meraki

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Ethernet Port Statuses (table)
  - **Matched Keywords:** status
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$ 
| dedup serial
| rename name as "Device Name", ports{}.name as "Ports Name...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Devices Without Power Connectivity (table)
  - **Matched Keywords:** status
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename power.ac.isConnected as ac , power.poe.isConnected...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** POE Standard Distribution (chart)
  - **Matched Keywords:** status
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename ports{}.poe.standard as "POE Standard"
| stats cou...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Ports Speed (chart)
  - **Matched Keywords:** status
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename ports{}.linkNegotiation.speed as "Port Speed"
| st...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Wireless Device Ethernet Status | Aggregation Status (chart)
  - **Matched Keywords:** status
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename aggregation.enabled as aggregation_enabled
| eval ...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Network Port Speeds (table)
  - **Matched Keywords:** status
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| rename ports{}.linkNegotiation.speed as port_speed, network.id as "Netwo...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Networks with Most PoE Devices (chart)
  - **Matched Keywords:** status
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename power.poe.isConnected as poe_connected, network.id...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Power Mode Distribution (chart)
  - **Matched Keywords:** status
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename power.mode as "Power Mode"
| stats count by "Power...`

- **Dashboard:** Device Availabilities Change History
  - **Panel:** Top 10 Networks By Device Changes (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesavailabilitieschangehistory" $orgid$ 
| dedup device.serial
| rename network.name as "Network Name" 
| stats ...`

- **Dashboard:** Device Availabilities Change History
  - **Panel:** Top 10 Offline Devices (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesavailabilitieschangehistory" $orgid$ details.new{}.value="offline" 
| dedup device.serial
| rename device.nam...`

- **Dashboard:** Device Availabilities Change History
  - **Panel:** Devices Availabilities Change History (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesavailabilitieschangehistory" $orgid$ 
| dedup device.serial
| rename details.new{}.value as "New Status", det...`

- **Dashboard:** Device Availabilities Change History
  - **Panel:** Device Status History Over Time (chart)
  - **Matched Keywords:** status
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesavailabilitieschangehistory" $orgid$ 
| dedup device.serial
| rename details.new{}.value as new_status 
| tim...`

- **Dashboard:** Top Devices
  - **Panel:** Device Usage Metrics (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:summarytopdevicesbyusage" $orgid$
| dedup name network.id usage.total usage.percentage
| rename name as "Device Name...`

- **Dashboard:** Top Devices
  - **Panel:** Top 10 Networks By Device Usage (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:summarytopdevicesbyusage" $orgid$
| dedup name network.id usage.total usage.percentage
| rename network.name as "Net...`

- **Dashboard:** Top Devices
  - **Panel:** Device Usage Over Time (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:summarytopdevicesbyusage" $orgid$
| dedup name network.id usage.total usage.percentage
| rename name as "Device Name...`

- **Dashboard:** Appliance VPN Statuses
  - **Panel:** VPN Status Data (table)
  - **Matched Keywords:** status
  - **Query Preview:** ``meraki_index` sourcetype="meraki:appliancesdwanstatuses" $orgid$ 
| rename networkName as "Network Name", deviceStatus as "Device Status", Subnet_Nam...`

- **Dashboard:** Wireless Device Packet Loss
  - **Panel:** Packet Loss By Network (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicespacketlossbydevice" $orgid$ 
| eval direction = mvappend("downstream", "upstream") 
| mvexpand direct...`

- **Dashboard:** Wireless Device Packet Loss
  - **Panel:** Total Packets v/s Lost Packets (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicespacketlossbydevice" $orgid$ 
| eval direction = mvappend("Downstream", "Upstream") 
| mvexpand direct...`

- **Dashboard:** Wireless Device Packet Loss
  - **Panel:** Top Networks with High Packet Loss (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicespacketlossbydevice" $orgid$ 
| rename upstream.lost as upstream_loss ,downstream.lost as downstream_l...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Total Alerts (single_value)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$ 
| dedup id 
| stats count as "Alert Count"...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Alert Count by Severity (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$
| dedup id
| rename severity as "Severity"
| stats count as "Alert Count" by Severity...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Alert Data (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$ 
| dedup id
| rename id as "Alert Id", startedAt as "Alert Time" , categoryType as "Categor...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Top Affected Networks (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$
| dedup id
| rename network.name as "Network Name", severity as "Severity Level"
| stats co...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Top Affected Devices (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$ 
| dedup id 
| rename scope.devices{}.name as "Device Name", severity as "Severity Level" 
...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Devices Uplinks History (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename name as "Device Name", uplinks{}.interface as "Int...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Uplink Interface Distribution (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename uplinks{}.interface as "Uplink Interface" 
| stats...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Address Assignment Modes (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename uplinks{}.addresses{}.assignmentMode as "Assignmen...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Protocol Distribution (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename uplinks{}.addresses{}.protocol as "Address Protoco...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Most Frequent Public Addresses (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$
| dedup serial
| rename uplinks{}.addresses{}.public.address as "Public Add...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Most Frequent Gateway IPs (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename uplinks{}.addresses{}.gateway as "Gateway" 
| stat...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Top 10 DNS Servers (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$
| dedup serial
| rename uplinks{}.addresses{}.nameservers.addresses{} as "D...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Top 10 Network Uplinks (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename network.id as "Network Id"
| stats count as Count ...`

#### TA_cisco_catalyst

- **Dashboard:** Splunk Resource Utilization
  - **Panel:** Process Health (chart)
  - **Query Preview:** `index=_internal sourcetype IN ("splunktaciscocybervision:log", "splunktaciscodnacenter:log", "splunktaciscoise:log", "splunktaciscosdwan:log") host IN...`

- **Dashboard:** Splunk Resource Utilization
  - **Panel:** Health Monitoring by Input Connection (table)
  - **Query Preview:** `index=_internal sourcetype IN ("splunktaciscocybervision:log", "splunktaciscodnacenter:log", "splunktaciscoise:log", "splunktaciscosdwan:log") host IN...`

#### cisco-catalyst-app

- **Dashboard:** Overview Reports
  - **Panel:** Network Device Types (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Center_Reports.Cisco_...`

- **Dashboard:** Sensors
  - **Panel:** Door Sensor Status - Latest Readings (chart)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" 
    from datamodel=Cisco_Catalyst_App 
    where nodename=Cisco_Catalyst_Dataset.Cisco...`

- **Dashboard:** Users And Applications
  - **Panel:** User Identity Summary (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Users And Applications
  - **Panel:** User Authentication Status (table)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Authentication Status (chart)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Audit Logs for Cisco ISE (table)
  - **Matched Keywords:** ise
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Event Notifications for Cisco ISE (table)
  - **Matched Keywords:** ise
  - **Query Preview:** `| tstats fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Event_Notificati...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Meraki Policy Sync (chart)
  - **Matched Keywords:** sync
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events.ISE...`

- **Dashboard:** Overview
  - **Panel:** Top Policy Set Hits for Cisco ISE (chart)
  - **Matched Keywords:** ise
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Policy_Events by Cisc...`

- **Dashboard:** Overview
  - **Panel:** $client_type_health$ Clients Health Score (single_value)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Client_Inventory_And_...`

- **Dashboard:** Overview
  - **Panel:** Network Health Score - $health_category$ (single_value)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Network_Health_Events...`

- **Dashboard:** Overview
  - **Panel:** ISE Authentication Summary (chart)
  - **Matched Keywords:** ise
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Overview
  - **Panel:** ISE Events Summary (chart)
  - **Matched Keywords:** ise
  - **Query Preview:** `| tstats `summariesonly` count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events by _time, Cisc...`

- **Dashboard:** Security Insights
  - **Panel:** Device Compliance Status (chart)
  - **Matched Keywords:** status
  - **Query Preview:** `$Cisco Catalyst Center$ | tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Cataly...`

- **Dashboard:** Security Insights
  - **Panel:** Device Compliance State (chart)
  - **Query Preview:** `$Cisco Catalyst Center$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Compliance_...`

- **Dashboard:** Security Insights
  - **Panel:** ISE Authentication Policy Chart (chart)
  - **Matched Keywords:** ise
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** ISE Authorization Policy Chart (chart)
  - **Matched Keywords:** ise
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Endpoint Compliance
  - **Panel:** Posture Status Trend Over Time (chart)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events.ISE...`

- **Dashboard:** Network Insights
  - **Panel:** Device Manageability Type (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Health_Events.device_health_managea...`

- **Dashboard:** Network Insights
  - **Panel:** Device Reachability Type (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Health_Events.device_health_reachab...`

- **Dashboard:** Network Insights
  - **Panel:** Device Family Type (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Health_Events.device_health_device_...`

- **Dashboard:** Network Insights
  - **Panel:** ISE $authentication_latency_type$ Authentication Latency (chart)
  - **Matched Keywords:** ise
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events
Cis...`

- **Dashboard:** Network Insights
  - **Panel:** ISE Top 10 Active Endpoints (chart)
  - **Matched Keywords:** ise
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events Cis...`

- **Dashboard:** Step 1 Device Classification
  - **Panel:** C2C-0.1.0 Reporting - USCYBERCOM Device Category (chart)
  - **Query Preview:** `| inputlookup cisco_catalyst_analytics_reports.csv
| eval filteredCybercom=mvfilter(match(cybercomCategory, `cisco_catalyst_CYBERCOM_Macro`) OR match(...`

- **Dashboard:** Step 1 Device Classification
  - **Panel:** C2C-0.1.1 Reporting - Operating System Summary (chart)
  - **Query Preview:** `| inputlookup cisco_catalyst_analytics_reports.csv
| stats count by MatchedPolicy
| sort 0 -count
| rename MatchedPolicy as "Operating System", count ...`

- **Dashboard:** Step 1 Device Classification
  - **Panel:** Untitled (table)
  - **Query Preview:** `| inputlookup cisco_catalyst_analytics_reports.csv
| eval filteredCybercom=mvfilter(match(cybercomCategory, `cisco_catalyst_CYBERCOM_Macro`) OR match(...`

- **Dashboard:** Step 1 Device Classification
  - **Panel:** Untitled (table)
  - **Query Preview:** `| inputlookup cisco_catalyst_analytics_reports.csv
| stats count by MatchedPolicy
| sort 0 -count
| rename MatchedPolicy as "Operating System", count ...`

- **Dashboard:** Network Compliance
  - **Panel:** Network Device Inventory (table)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename IN (Cisco_Catalyst_Dataset.Cisco_Catalyst_Center_Reports.Ci...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** Client Health Score – Wired and Wireless (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Client_Inventory_And_...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** Endpoint Identity Summary (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" 
  from datamodel=Cisco_Catalyst_App 
  where nodename=Cisco_Catalyst_Dataset.Cisco_Cat...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** Endpoint Authentication Status (table)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** BYOD Device Enrollment (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Performance
  - **Panel:** ISE System Health (table)
  - **Matched Keywords:** ise
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events by ...`

- **Dashboard:** Performance
  - **Panel:** Network System Health (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count(Cisco_Catalyst_Dataset.Cisco_Catalyst_Network_Performance_Events.network_performance_account_id) f...`

- **Dashboard:** Performance
  - **Panel:** Audit Logs for Cisco ISE (table)
  - **Matched Keywords:** ise
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Site Health (chart)
  - **Query Preview:** `| tstats `summariesonly` latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_Site_Health_Events.sdwan_site_health_site_health) as "Site Health" from da...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Link Health (chart)
  - **Query Preview:** `| tstats `summariesonly` count from datamodel=Cisco_Catalyst_App 
    where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_Link_Health
    by Ci...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Unified Threat Defense Health (chart)
  - **Query Preview:** `| tstats `summariesonly` latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_UTD_Health.sdwan_utd_health_status) as "Admin Status" from datamodel=Cisco...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Tunnel Health (chart)
  - **Query Preview:** `| tstats `summariesonly` count as Count latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_Tunnel_Health.sdwan_tunnel_health_health) as "Tunnel Health...`

#### cisco_sna_app

- **Dashboard:** Host Snapshot
  - **Panel:** Status: (table)
  - **Matched Keywords:** status
  - **Query Preview:** `| where row_type="host_status" | eval status_first_seen=strftime(strptime(status_first_seen."+0000","%Y-%m-%dT%H:%M:%SZ%z"),"%Y-%m-%d %H:%M:%S %Z") | ...`

- **Dashboard:** Host Snapshot
  - **Panel:** Identity Sessions (table)
  - **Query Preview:** `| where row_type="host_identity_session" | eval start_time=strftime(strptime(start_time."+0000","%Y-%m-%dT%H:%M:%SZ%z"),"%Y-%m-%d %H:%M:%S %Z") | sort...`

- **Dashboard:** Top Reports
  - **Panel:** Top Services by Bytes: (chart)
  - **Query Preview:** `| where rowType="results" and reportType="services" | rename "serviceName" as "Service" | chart values("bytes") as "Bytes" by "Service"...`

- **Dashboard:** Top Reports
  - **Panel:** Top Services by Packets: (chart)
  - **Query Preview:** `| where rowType="results" and reportType="services" | rename "serviceName" as "Service" | chart values("packets") as "Packets" by "Service"...`

- **Dashboard:** Top Reports
  - **Panel:** Top Services by Flows: (chart)
  - **Query Preview:** `| where rowType="results" and reportType="services" | rename "serviceName" as "Service" | chart values("flows") as "Flows" by "Service"...`

#### ta_cisco_thousandeyes

- **Dashboard:** Data collection Status
  - **Panel:** Number of Streams (single_value)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` dc(Test_Metrics.thousandeyes.stream.id) as count FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE Test_Metrics.thousand...`

- **Dashboard:** Data collection Status
  - **Panel:** Untitled (table)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` count(Test_Metrics.thousandeyes.stream.id) FROM datamodel="Cisco_ThousandEyes.Test_Metrics"  WHERE Test_Metrics.thousandeyes....`

- **Dashboard:** Data collection Status
  - **Panel:** Number of Cloud & Enterprise Agent Tests and Endpoint Agent Tests (single_value)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` dc(Test_Metrics.thousandeyes.test.id) as count FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE Test_Metrics.thousandey...`

- **Dashboard:** Data collection Status
  - **Panel:** Untitled (table)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` values(Test_Metrics.thousandeyes.test.type) as "Test Types" values(Test_Metrics.thousandeyes.test.name) as "Test Name" FROM d...`

- **Dashboard:** Data collection Status
  - **Panel:** Number of Event Inputs (single_value)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` dc(source) as count FROM datamodel="Cisco_ThousandEyes.Events"  WHERE Events.aid IN($tkn_acc_group$)...`

- **Dashboard:** Data collection Status
  - **Panel:** Untitled (table)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` latest(_time) as time FROM datamodel="Cisco_ThousandEyes.Events"  WHERE Events.aid IN($tkn_acc_group$) BY source | eval sourc...`

- **Dashboard:** Data collection Status
  - **Panel:** Number of Activity Inputs (single_value)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` dc(source) as count FROM datamodel="Cisco_ThousandEyes.Activities"  WHERE Activities.aid IN($tkn_acc_group$)...`

- **Dashboard:** Data collection Status
  - **Panel:** Untitled (table)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` latest(_time) as time FROM datamodel="Cisco_ThousandEyes.Activities"  WHERE Activities.aid IN($tkn_acc_group$) BY source | ev...`

---

### Requirement 14: Auth failures / successes

**Stated Visualization Support:** Yes

**Stated Supporting Apps:** Splunk Add-on for Cisco Identity Services, Cisco ISE App

**Matched Panels Found:** 2

#### cisco-catalyst-app

- **Dashboard:** Performance
  - **Panel:** Auth Latency (RADIUS) (chart)
  - **Matched Keywords:** auth
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events.ISE...`

- **Dashboard:** Performance
  - **Panel:** Auth Latency (TACACS) (chart)
  - **Matched Keywords:** auth
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events.ISE...`

---

### Requirement 15: Workflow usage (Agentic Ops)

**Stated Visualization Support:** No

**Stated Supporting Apps:** —

**Matched Panels Found:** 11

#### Splunk_TA_cisco_meraki

- **Dashboard:** API Request Overview
  - **Panel:** API Usage Summary (chart)
  - **Matched Keywords:** usage
  - **Query Preview:** ``meraki_index` sourcetype="meraki:apirequestsoverview" $orgid$ 
| spath path=responseCodeCounts 
| eval responseCodeCounts=split(responseCodeCounts, "...`

- **Dashboard:** Top Devices
  - **Panel:** Device Usage Metrics (chart)
  - **Matched Keywords:** usage
  - **Query Preview:** ``meraki_index` sourcetype="meraki:summarytopdevicesbyusage" $orgid$
| dedup name network.id usage.total usage.percentage
| rename name as "Device Name...`

- **Dashboard:** Top Devices
  - **Panel:** Top 10 Networks By Device Usage (chart)
  - **Matched Keywords:** usage
  - **Query Preview:** ``meraki_index` sourcetype="meraki:summarytopdevicesbyusage" $orgid$
| dedup name network.id usage.total usage.percentage
| rename network.name as "Net...`

- **Dashboard:** Top Devices
  - **Panel:** Device Usage Over Time (chart)
  - **Matched Keywords:** usage
  - **Query Preview:** ``meraki_index` sourcetype="meraki:summarytopdevicesbyusage" $orgid$
| dedup name network.id usage.total usage.percentage
| rename name as "Device Name...`

- **Dashboard:** Top Switches
  - **Panel:** Top 10 Network by Energy Usage (chart)
  - **Matched Keywords:** usage
  - **Query Preview:** ``meraki_index` sourcetype="meraki:summarytopswitchesbyenergyusage" $orgid$
| rename network.name as "Network Name" 
| stats sum(usage.total) as "Total...`

- **Dashboard:** Top Clients
  - **Panel:** Top 10 Clients by Usage (table)
  - **Matched Keywords:** usage
  - **Query Preview:** ``meraki_index` sourcetype="meraki:summarytopclientsbyusage" $orgid$ 
| dedup id 
| rename name as "Name", network.name as "Network Name", usage.percen...`

- **Dashboard:** Top Clients
  - **Panel:** Total Usage By Network (in MB) (chart)
  - **Matched Keywords:** usage
  - **Query Preview:** ``meraki_index` sourcetype="meraki:summarytopclientsbyusage" $orgid$
| dedup id
| rename network.name as "Network Name"
| stats sum(usage.total) as "To...`

- **Dashboard:** Top Clients
  - **Panel:** Client Usage Metrics (in MB) (chart)
  - **Matched Keywords:** usage
  - **Query Preview:** ``meraki_index` sourcetype="meraki:summarytopclientsbyusage" $orgid$
| dedup id
| rename name as "Client Name" 
| stats values(usage.upstream) as "Usag...`

#### cisco-catalyst-app

- **Dashboard:** Users And Applications
  - **Panel:** Application Usage (chart)
  - **Matched Keywords:** usage
  - **Query Preview:** `| tstats `summariesonly` sum(Cisco_Catalyst_Dataset.Cisco_Catalyst_Application_Usage.app_usage_bytes_in) as usage from datamodel=Cisco_Catalyst_App wh...`

- **Dashboard:** Performance
  - **Panel:** Disk Space Usage % (chart)
  - **Matched Keywords:** usage
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events.ISE...`

#### cisco-cloud-security

- **Dashboard:** API Usage Dashboard
  - **Panel:** Untitled (table)
  - **Matched Keywords:** usage

---

### Requirement 16: Workflow reversions / efficacy

**Stated Visualization Support:** No

**Stated Supporting Apps:** —

**No matching panels found.** Custom dashboard development may be required.

---

### Requirement 17: Issues raised by agents

**Stated Visualization Support:** No

**Stated Supporting Apps:** —

**Matched Panels Found:** 5

#### cisco-catalyst-app

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Number of Issues by Priority (chart)
  - **Matched Keywords:** issues
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Active_Issue_Events.active_issue_specific_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Number of Issues by Severity (chart)
  - **Matched Keywords:** issues
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Active_Issue_Events.active_issue_specific_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Number of Issues by Category (chart)
  - **Matched Keywords:** issues
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Active_Issue_Events.active_issue_specific_...`

- **Dashboard:** Overview
  - **Panel:** Total Number of Active Issues (chart)
  - **Matched Keywords:** issues
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Overview
  - **Panel:** Number of Issues by Priority (chart)
  - **Matched Keywords:** issues
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Active_Issue_Events.active_issue_specific_...`

---

### Requirement 18: Telemetry sources (XDR, SNA, Meraki, Cloud)

**Stated Visualization Support:** Partial

**Stated Supporting Apps:** Cisco Security Cloud Add-on, Cisco Secure Network Analytics Add-on for Splunk, Splunk Add-on for Cisco Meraki

**Matched Panels Found:** 24

#### Splunk_TA_cisco-ise

- **Dashboard:** Cisco ISE TA Troubleshooting Dashboard
  - **Panel:** Events by sources (chart)
  - **Matched Keywords:** sources
  - **Query Preview:** `index IN `Cisco_ISE_Index` sourcetype IN ("cisco:ise:syslog") | top source...`

#### Splunk_TA_cisco_meraki

- **Dashboard:** Access Point
  - **Panel:** Wireless Data Logs (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:accesspoints" $orgid$ 
| rename deviceName as "Device Name", deviceSerial as "Device Serial", category as "Category"...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Ethernet Port Statuses (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$ 
| dedup serial
| rename name as "Device Name", ports{}.name as "Ports Name...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Devices Without Power Connectivity (table)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename power.ac.isConnected as ac , power.poe.isConnected...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** POE Standard Distribution (chart)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename ports{}.poe.standard as "POE Standard"
| stats cou...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Ports Speed (chart)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename ports{}.linkNegotiation.speed as "Port Speed"
| st...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Wireless Device Ethernet Status | Aggregation Status (chart)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename aggregation.enabled as aggregation_enabled
| eval ...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Network Port Speeds (table)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| rename ports{}.linkNegotiation.speed as port_speed, network.id as "Netwo...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Networks with Most PoE Devices (chart)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename power.poe.isConnected as poe_connected, network.id...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Power Mode Distribution (chart)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename power.mode as "Power Mode"
| stats count by "Power...`

- **Dashboard:** Wireless Device Packet Loss
  - **Panel:** Packet Loss By Network (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicespacketlossbydevice" $orgid$ 
| eval direction = mvappend("downstream", "upstream") 
| mvexpand direct...`

- **Dashboard:** Wireless Device Packet Loss
  - **Panel:** Total Packets v/s Lost Packets (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicespacketlossbydevice" $orgid$ 
| eval direction = mvappend("Downstream", "Upstream") 
| mvexpand direct...`

- **Dashboard:** Wireless Device Packet Loss
  - **Panel:** Top Networks with High Packet Loss (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicespacketlossbydevice" $orgid$ 
| rename upstream.lost as upstream_loss ,downstream.lost as downstream_l...`

#### cisco-catalyst-app

- **Dashboard:** Users And Applications
  - **Panel:** Top Users - Wired and Wireless (chart)
  - **Query Preview:** `| tstats `summariesonly`  count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_User_Events by Cisco...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Audit Logs for Cisco Meraki (table)
  - **Matched Keywords:** meraki
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count 
  from datamodel=Cisco_Catalyst_App 
  where nodename=Cisco_Catalyst_Dataset.Cisco_Catal...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Meraki Policy Sync (chart)
  - **Matched Keywords:** meraki
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events.ISE...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Wireless Signal Metrics (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events by ...`

- **Dashboard:** Security Insights
  - **Panel:** SGACL - Top Sources (chart)
  - **Matched Keywords:** sources
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_SG...`

- **Dashboard:** Security Insights
  - **Panel:** ACL - Top Denied Sources (chart)
  - **Matched Keywords:** sources
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_AC...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** Client Health Score – Wired and Wireless (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Client_Inventory_And_...`

- **Dashboard:** Performance
  - **Panel:** Audit Logs for Cisco Meraki (table)
  - **Matched Keywords:** meraki
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count 
  from datamodel=Cisco_Catalyst_App 
  where nodename=Cisco_Catalyst_Dataset.Cisco_Catal...`

#### cisco_sna_app

- **Dashboard:** Security Events
  - **Panel:** Top Security Event Sources (chart)
  - **Matched Keywords:** sources
  - **Query Preview:** `| where source_ip!="Multiple Hosts" and not like("$form.subject_ip$", "%" . source_ip . "%") and not like("$form.peer_ip$", "%" . source_ip . "%") | r...`

- **Dashboard:** Cisco SNA App Setup Page
  - **Panel:** Untitled (table)
  - **Matched Keywords:** sna

#### ta_cisco_thousandeyes

- **Dashboard:** Data collection Status
  - **Panel:** Number of Cloud & Enterprise Agent Tests and Endpoint Agent Tests (single_value)
  - **Matched Keywords:** cloud
  - **Query Preview:** `| tstats `summariesonly` dc(Test_Metrics.thousandeyes.test.id) as count FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE Test_Metrics.thousandey...`

---

### Requirement 19: Baseline view (devices, VPN, clients, guest access)

**Stated Visualization Support:** Yes

**Stated Supporting Apps:** Cisco Enterprise Networking for Splunk Platform, Splunk Add-on for Cisco Meraki

**Matched Panels Found:** 58

#### Splunk_TA_cisco_meraki

- **Dashboard:** Appliance VPN Stats
  - **Panel:** Average Latency (single_value)
  - **Matched Keywords:** vpn
  - **Query Preview:** ``meraki_index` sourcetype="meraki:appliancesdwanstatistics" $orgid$ 
| stats avg(merakiVpnPeers{}.latencySummaries{}.avgLatencyMs) as Average_Latency ...`

- **Dashboard:** Appliance VPN Stats
  - **Panel:** Average Loss (single_value)
  - **Matched Keywords:** vpn
  - **Query Preview:** ``meraki_index` sourcetype="meraki:appliancesdwanstatistics" $orgid$ 
| stats avg(merakiVpnPeers{}.lossPercentageSummaries{}.avgLossPercentage) as Aver...`

- **Dashboard:** Appliance VPN Stats
  - **Panel:** VPN Metrics (table)
  - **Matched Keywords:** vpn
  - **Query Preview:** ``meraki_index` sourcetype="meraki:appliancesdwanstatistics" $orgid$
| rename networkId as "Network ID", networkName as "Network Name", merakiVpnPeers{...`

- **Dashboard:** Appliance VPN Stats
  - **Panel:** Average Jitter (table)
  - **Matched Keywords:** vpn
  - **Query Preview:** ``meraki_index` sourcetype="meraki:appliancesdwanstatistics" $orgid$ 
| rename merakiVpnPeers{}.jitterSummaries{}.senderUplink as "Sender Uplink", mera...`

- **Dashboard:** Access Point
  - **Panel:** Wireless Data Logs (table)
  - **Matched Keywords:** access
  - **Query Preview:** ``meraki_index` sourcetype="meraki:accesspoints" $orgid$ 
| rename deviceName as "Device Name", deviceSerial as "Device Serial", category as "Category"...`

- **Dashboard:** Access Point
  - **Panel:** Top Devices by RF Changes (table)
  - **Matched Keywords:** access, devices
  - **Query Preview:** ``meraki_index` sourcetype="meraki:accesspoints" $orgid$ 
| dedup occurredAt, clientId
| spath type 
| search type="auto_rf_channel_change" 
| stats co...`

- **Dashboard:** Access Point
  - **Panel:** Most Common Channel Transition (table)
  - **Matched Keywords:** access
  - **Query Preview:** ``meraki_index` sourcetype="meraki:accesspoints" $orgid$
| dedup occurredAt, clientId
| stats count as "Count" by eventData.oldChan, eventData.newChan
...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Ethernet Port Statuses (table)
  - **Matched Keywords:** devices
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$ 
| dedup serial
| rename name as "Device Name", ports{}.name as "Ports Name...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Devices Without Power Connectivity (table)
  - **Matched Keywords:** devices
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename power.ac.isConnected as ac , power.poe.isConnected...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** POE Standard Distribution (chart)
  - **Matched Keywords:** devices
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename ports{}.poe.standard as "POE Standard"
| stats cou...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Ports Speed (chart)
  - **Matched Keywords:** devices
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename ports{}.linkNegotiation.speed as "Port Speed"
| st...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Wireless Device Ethernet Status | Aggregation Status (chart)
  - **Matched Keywords:** devices
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename aggregation.enabled as aggregation_enabled
| eval ...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Network Port Speeds (table)
  - **Matched Keywords:** devices
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| rename ports{}.linkNegotiation.speed as port_speed, network.id as "Netwo...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Networks with Most PoE Devices (chart)
  - **Matched Keywords:** devices
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename power.poe.isConnected as poe_connected, network.id...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Power Mode Distribution (chart)
  - **Matched Keywords:** devices
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename power.mode as "Power Mode"
| stats count by "Power...`

- **Dashboard:** Security Appliances
  - **Panel:** Top Devices with IP Conflicts (table)
  - **Matched Keywords:** devices
  - **Query Preview:** ``meraki_index` sourcetype="meraki:securityappliances" category="ip_conflicts" $orgid$
| dedup occurredAt, deviceSerial
| stats count as Count by devic...`

- **Dashboard:** Device Availabilities Change History
  - **Panel:** Top 10 Offline Devices (table)
  - **Matched Keywords:** devices
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesavailabilitieschangehistory" $orgid$ details.new{}.value="offline" 
| dedup device.serial
| rename device.nam...`

- **Dashboard:** Device Availabilities Change History
  - **Panel:** Devices Availabilities Change History (table)
  - **Matched Keywords:** devices
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesavailabilitieschangehistory" $orgid$ 
| dedup device.serial
| rename details.new{}.value as "New Status", det...`

- **Dashboard:** Top Devices
  - **Panel:** Device Usage Metrics (chart)
  - **Matched Keywords:** devices
  - **Query Preview:** ``meraki_index` sourcetype="meraki:summarytopdevicesbyusage" $orgid$
| dedup name network.id usage.total usage.percentage
| rename name as "Device Name...`

- **Dashboard:** Top Devices
  - **Panel:** Top 10 Networks By Device Usage (chart)
  - **Matched Keywords:** devices
  - **Query Preview:** ``meraki_index` sourcetype="meraki:summarytopdevicesbyusage" $orgid$
| dedup name network.id usage.total usage.percentage
| rename network.name as "Net...`

- **Dashboard:** Top Devices
  - **Panel:** Device Usage Over Time (chart)
  - **Matched Keywords:** devices
  - **Query Preview:** ``meraki_index` sourcetype="meraki:summarytopdevicesbyusage" $orgid$
| dedup name network.id usage.total usage.percentage
| rename name as "Device Name...`

- **Dashboard:** Appliance VPN Statuses
  - **Panel:** VPN Status Data (table)
  - **Matched Keywords:** vpn
  - **Query Preview:** ``meraki_index` sourcetype="meraki:appliancesdwanstatuses" $orgid$ 
| rename networkName as "Network Name", deviceStatus as "Device Status", Subnet_Nam...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Top Affected Devices (table)
  - **Matched Keywords:** devices
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$ 
| dedup id 
| rename scope.devices{}.name as "Device Name", severity as "Severity Level" 
...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Devices Uplinks History (table)
  - **Matched Keywords:** devices
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename name as "Device Name", uplinks{}.interface as "Int...`

- **Dashboard:** Top Clients
  - **Panel:** Top 10 Clients by Usage (table)
  - **Matched Keywords:** clients
  - **Query Preview:** ``meraki_index` sourcetype="meraki:summarytopclientsbyusage" $orgid$ 
| dedup id 
| rename name as "Name", network.name as "Network Name", usage.percen...`

- **Dashboard:** Top Clients
  - **Panel:** Total Usage By Network (in MB) (chart)
  - **Matched Keywords:** clients
  - **Query Preview:** ``meraki_index` sourcetype="meraki:summarytopclientsbyusage" $orgid$
| dedup id
| rename network.name as "Network Name"
| stats sum(usage.total) as "To...`

- **Dashboard:** Top Clients
  - **Panel:** Client Usage Metrics (in MB) (chart)
  - **Matched Keywords:** clients
  - **Query Preview:** ``meraki_index` sourcetype="meraki:summarytopclientsbyusage" $orgid$
| dedup id
| rename name as "Client Name" 
| stats values(usage.upstream) as "Usag...`

#### cisco-catalyst-app

- **Dashboard:** Users And Applications
  - **Panel:** Guest Authentication (chart)
  - **Matched Keywords:** guest
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Overview
  - **Panel:** $client_type_health$ Clients Health Score (single_value)
  - **Matched Keywords:** clients
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Client_Inventory_And_...`

- **Dashboard:** Overview
  - **Panel:** $client_type_count$ Clients Count (single_value)
  - **Matched Keywords:** clients
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Client_Inventory_And_...`

- **Dashboard:** Security Insights
  - **Panel:** ACL - Top Denied Clients (chart)
  - **Matched Keywords:** clients
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_AC...`

- **Dashboard:** Security Insights
  - **Panel:** Rogue Devices Count (single_value)
  - **Matched Keywords:** devices
  - **Query Preview:** `| tstats `summariesonly` count as Count from datamodel=Cisco_Catalyst_App 
  where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Rogue_Events 
  by C...`

- **Dashboard:** Network Insights
  - **Panel:** Network Devices By Type (table)
  - **Matched Keywords:** devices
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Type_Events Ci...`

- **Dashboard:** Network Insights
  - **Panel:** Top 10 Offline Devices (table)
  - **Matched Keywords:** devices
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count 
  from datamodel=Cisco_Catalyst_App 
  where nodename=Cisco_Catalyst_Dataset.Cisco_Catal...`

- **Dashboard:** Network Compliance
  - **Panel:** NonCompliant Network Devices (table)
  - **Matched Keywords:** devices
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Center_Reports.Cisco_...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** Unknown Endpoints (chart)
  - **Matched Keywords:** clients
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** Client Inventory (chart)
  - **Matched Keywords:** clients
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Client_Inventory_And_...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** Client Health Score – Wired and Wireless (chart)
  - **Matched Keywords:** clients
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Client_Inventory_And_...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** Untitled (table)
  - **Matched Keywords:** clients

- **Dashboard:** Endpoints (Clients)
  - **Panel:** Untitled (table)
  - **Matched Keywords:** clients
  - **Query Preview:** `| inputlookup cisco_catalyst_ise_location.csv...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** Endpoint Identity Summary (table)
  - **Matched Keywords:** clients
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" 
  from datamodel=Cisco_Catalyst_App 
  where nodename=Cisco_Catalyst_Dataset.Cisco_Cat...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** Endpoint Authentication Status (table)
  - **Matched Keywords:** clients
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** Asset Inventory Count (chart)
  - **Matched Keywords:** clients
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` dc(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Events.device_ip_address) as "IT Assets Count" from data...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** Camera Events By Description (chart)
  - **Matched Keywords:** clients
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count 
  from datamodel=Cisco_Catalyst_App 
  where nodename=Cisco_Catalyst_Dataset.Cisco_Catal...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** Untitled (table)
  - **Matched Keywords:** clients

- **Dashboard:** Endpoints (Clients)
  - **Panel:** Untitled (table)
  - **Matched Keywords:** clients

- **Dashboard:** Endpoints (Clients)
  - **Panel:** Untitled (table)
  - **Matched Keywords:** clients
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" 
    from datamodel=Cisco_Catalyst_App 
    where nodename=Cisco_Catalyst_Dataset.Cisco...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** Untitled (table)
  - **Matched Keywords:** clients
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" values(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Events.device_ip_address) as "Devic...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** Untitled (table)
  - **Matched Keywords:** clients

- **Dashboard:** Endpoints (Clients)
  - **Panel:** Untitled (table)
  - **Matched Keywords:** clients
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Cyber_Visio...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** Untitled (table)
  - **Matched Keywords:** clients

- **Dashboard:** Endpoints (Clients)
  - **Panel:** Untitled (table)
  - **Matched Keywords:** clients
  - **Query Preview:** `| tstats `summariesonly` count
    from datamodel=Cisco_Catalyst_App 
    where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Client_Events 
    by C...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** Untitled (table)
  - **Matched Keywords:** clients
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count 
  from datamodel=Cisco_Catalyst_App 
  where nodename=Cisco_Catalyst_Dataset.Cisco_Catal...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** BYOD Device Enrollment (table)
  - **Matched Keywords:** clients
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** Guest Endpoints (table)
  - **Matched Keywords:** clients, guest
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Tunnel Health (chart)
  - **Query Preview:** `| tstats `summariesonly` count as Count latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_Tunnel_Health.sdwan_tunnel_health_health) as "Tunnel Health...`

#### cisco-cloud-security

- **Dashboard:** Access
  - **Panel:** Untitled (table)
  - **Matched Keywords:** access

#### cisco_sna_app

- **Dashboard:** User Report
  - **Panel:** Devices & Sessions: (table)
  - **Matched Keywords:** devices
  - **Query Preview:** `| eval start_time=strftime(strptime(start_time,"%Y-%m-%dT%H:%M:%S.%3N%z"),"%Y-%m-%d %H:%M:%S %Z") | eval end_time=strftime(strptime(end_time,"%Y-%m-%d...`

---

### Requirement 20: ThousandEyes tests / telemetry

**Stated Visualization Support:** Yes

**Stated Supporting Apps:** Cisco ThousandEyes App for Splunk

**Matched Panels Found:** 7

#### Splunk_TA_cisco_meraki

- **Dashboard:** Assurance Alert Data
  - **Panel:** Total Alerts (single_value)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$ 
| dedup id 
| stats count as "Alert Count"...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Alert Count by Severity (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$
| dedup id
| rename severity as "Severity"
| stats count as "Alert Count" by Severity...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Alert Data (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$ 
| dedup id
| rename id as "Alert Id", startedAt as "Alert Time" , categoryType as "Categor...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Top Affected Networks (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$
| dedup id
| rename network.name as "Network Name", severity as "Severity Level"
| stats co...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Top Affected Devices (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$ 
| dedup id 
| rename scope.devices{}.name as "Device Name", severity as "Severity Level" 
...`

#### TA_cisco_catalyst

- **Dashboard:** Splunk Resource Utilization
  - **Panel:** Health Monitoring by Input Connection (table)
  - **Query Preview:** `index=_internal sourcetype IN ("splunktaciscocybervision:log", "splunktaciscodnacenter:log", "splunktaciscoise:log", "splunktaciscosdwan:log") host IN...`

#### ta_cisco_thousandeyes

- **Dashboard:** Data collection Status
  - **Panel:** Number of Cloud & Enterprise Agent Tests and Endpoint Agent Tests (single_value)
  - **Matched Keywords:** tests
  - **Query Preview:** `| tstats `summariesonly` dc(Test_Metrics.thousandeyes.test.id) as count FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE Test_Metrics.thousandey...`

---

### Requirement 21: Inspection points (endpoint, cloud, infra)

**Stated Visualization Support:** Yes

**Stated Supporting Apps:** Cisco ThousandEyes App for Splunk

**Matched Panels Found:** 26

#### Splunk_TA_cisco-ise

- **Dashboard:** Cisco ISE TA Troubleshooting Dashboard
  - **Panel:** Endpoint (single_value)
  - **Matched Keywords:** endpoint
  - **Query Preview:** `| pivot Endpoint Services count(Services) AS "Count of Services" FILTER vendor_product in ("Cisco Identity Services Engine","Cisco Secure Access Contr...`

#### Splunk_TA_cisco_meraki

- **Dashboard:** Top Clients
  - **Panel:** Client Usage Metrics (in MB) (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:summarytopclientsbyusage" $orgid$
| dedup id
| rename name as "Client Name" 
| stats values(usage.upstream) as "Usag...`

#### cisco-catalyst-app

- **Dashboard:** Users And Applications
  - **Panel:** User Identity Summary (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Users And Applications
  - **Panel:** User Authentication Status (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Endpoint Purged (chart)
  - **Matched Keywords:** endpoint
  - **Query Preview:** ``cisco_catalyst_app_index` sourcetype="cisco:ise:syslog" ObjectsPurged=* NOT ObjectsPurged=None vendor_product IN ($product$) | stats count by ise_ser...`

- **Dashboard:** Endpoint Compliance
  - **Panel:** Compliant Total (single_value)
  - **Matched Keywords:** endpoint
  - **Query Preview:** `| inputlookup cisco_catalyst_analytics_reports.csv
| where PostureStatus="Compliant" OR PostureStatus="Grace Compliant"
| dedup macAddress
| stats cou...`

- **Dashboard:** Endpoint Compliance
  - **Panel:** Posture Status Trend Over Time (chart)
  - **Matched Keywords:** endpoint
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events.ISE...`

- **Dashboard:** Endpoint Compliance
  - **Panel:** Compliance Summary (table)
  - **Matched Keywords:** endpoint
  - **Query Preview:** `| inputlookup cisco_catalyst_analytics_reports.csv 
| table macAddress uuid Ipv4Address Ipv6Address cybercomCategory UserName dnsName NetworkDeviceNam...`

- **Dashboard:** Step 2 Manageability and Compliance
  - **Panel:** Endpoint Compliance & Posture Summary (table)
  - **Matched Keywords:** endpoint
  - **Query Preview:** `| savedsearch "cisco_catalyst_0200_reporting_total_discovered_endpoints_step_2" 
| eval "1. Owner" = `cisco_catalyst_reporting_owner`
| eval "2. Area ...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** Client Inventory (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Client_Inventory_And_...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** Client Health Score – Wired and Wireless (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Client_Inventory_And_...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** Endpoint Identity Summary (table)
  - **Matched Keywords:** endpoint
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" 
  from datamodel=Cisco_Catalyst_App 
  where nodename=Cisco_Catalyst_Dataset.Cisco_Cat...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** Endpoint Authentication Status (table)
  - **Matched Keywords:** endpoint
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Master Endpoint Record
  - **Panel:** Master Endpoint Record (table)
  - **Matched Keywords:** endpoint
  - **Query Preview:** `| inputlookup cisco_catalyst_analytics_reports.csv
| rename macAddress as "Mac Address" record_id as "Record ID" uuid as "UUID" cybercomCategory as "C...`

#### cisco_sna_app

- **Dashboard:** User Report
  - **Panel:** Untitled (table)

- **Dashboard:** User Report
  - **Panel:** Username: (single_value)
  - **Query Preview:** `| where detail_key="Username:" | fields "detail_value"...`

- **Dashboard:** User Report
  - **Panel:** Full Name: (single_value)
  - **Query Preview:** `| fillnull value="N/A" | where detail_key="Full Name:" | fields "detail_value"...`

- **Dashboard:** User Report
  - **Panel:** User Details: (table)
  - **Query Preview:** `| fillnull value="--" | where detail_key!="Full Name:" and detail_key!="Username:" | fields "detail_key", "detail_value"...`

- **Dashboard:** User Report
  - **Panel:** Untitled (table)

- **Dashboard:** User Report
  - **Panel:** Security Index (table)
  - **Query Preview:** `|topalarming report_type=users domain_id=$domain_id$ smc_ip=$smc_ip$
            | where like(username, "$username$") | eval time_session_start=strfti...`

- **Dashboard:** User Report
  - **Panel:** Untitled (table)

- **Dashboard:** User Report
  - **Panel:** Devices & Sessions: (table)
  - **Query Preview:** `| eval start_time=strftime(strptime(start_time,"%Y-%m-%dT%H:%M:%S.%3N%z"),"%Y-%m-%d %H:%M:%S %Z") | eval end_time=strftime(strptime(end_time,"%Y-%m-%d...`

- **Dashboard:** User Report
  - **Panel:** Untitled (table)

- **Dashboard:** User Report
  - **Panel:** Flows (Last 24 Hours): (table)
  - **Query Preview:** `| eval firstActiveTime=strftime(strptime(firstActiveTime, "%Y-%m-%dT%H:%M:%S"),"%Y-%m-%d %H:%M:%S") |
                eval lastActiveTime=strftime(str...`

- **Dashboard:** User Report
  - **Panel:** Untitled (table)

#### ta_cisco_thousandeyes

- **Dashboard:** Data collection Status
  - **Panel:** Number of Cloud & Enterprise Agent Tests and Endpoint Agent Tests (single_value)
  - **Matched Keywords:** cloud, endpoint
  - **Query Preview:** `| tstats `summariesonly` dc(Test_Metrics.thousandeyes.test.id) as count FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE Test_Metrics.thousandey...`

---

### Requirement 22: NetFlow visibility (client vs device)

**Stated Visualization Support:** Partial

**Stated Supporting Apps:** Cisco Secure Network Analytics Add-on for Splunk

**Matched Panels Found:** 152

#### Splunk_TA_cisco-ise

- **Dashboard:** Cisco ISE TA Troubleshooting Dashboard
  - **Panel:** Network Traffic (single_value)
  - **Query Preview:** `| pivot Network_Traffic All_Traffic count(All_Traffic) AS "Count of All Traffic" FILTER sourcetype is "cisco:ise:syslog" ROWSUMMARY 0 COLSUMMARY 0 SHO...`

- **Dashboard:** Cisco ISE TA Troubleshooting Dashboard
  - **Panel:** Endpoint (single_value)
  - **Query Preview:** `| pivot Endpoint Services count(Services) AS "Count of Services" FILTER vendor_product in ("Cisco Identity Services Engine","Cisco Secure Access Contr...`

#### Splunk_TA_cisco_meraki

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Ethernet Port Statuses (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$ 
| dedup serial
| rename name as "Device Name", ports{}.name as "Ports Name...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Devices Without Power Connectivity (table)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename power.ac.isConnected as ac , power.poe.isConnected...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** POE Standard Distribution (chart)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename ports{}.poe.standard as "POE Standard"
| stats cou...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Ports Speed (chart)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename ports{}.linkNegotiation.speed as "Port Speed"
| st...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Wireless Device Ethernet Status | Aggregation Status (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename aggregation.enabled as aggregation_enabled
| eval ...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Network Port Speeds (table)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| rename ports{}.linkNegotiation.speed as port_speed, network.id as "Netwo...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Networks with Most PoE Devices (chart)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename power.poe.isConnected as poe_connected, network.id...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Power Mode Distribution (chart)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename power.mode as "Power Mode"
| stats count by "Power...`

- **Dashboard:** Camera Data
  - **Panel:** Cameras Count By Network (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:cameras" $orgid$
| stats count as Count by networkId
| rename networkId as "Netrwork Id"...`

- **Dashboard:** Device Availabilities Change History
  - **Panel:** Top 10 Networks By Device Changes (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesavailabilitieschangehistory" $orgid$ 
| dedup device.serial
| rename network.name as "Network Name" 
| stats ...`

- **Dashboard:** Device Availabilities Change History
  - **Panel:** Top 10 Offline Devices (table)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesavailabilitieschangehistory" $orgid$ details.new{}.value="offline" 
| dedup device.serial
| rename device.nam...`

- **Dashboard:** Device Availabilities Change History
  - **Panel:** Devices Availabilities Change History (table)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesavailabilitieschangehistory" $orgid$ 
| dedup device.serial
| rename details.new{}.value as "New Status", det...`

- **Dashboard:** Device Availabilities Change History
  - **Panel:** Device Status History Over Time (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesavailabilitieschangehistory" $orgid$ 
| dedup device.serial
| rename details.new{}.value as new_status 
| tim...`

- **Dashboard:** Top Devices
  - **Panel:** Device Usage Metrics (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:summarytopdevicesbyusage" $orgid$
| dedup name network.id usage.total usage.percentage
| rename name as "Device Name...`

- **Dashboard:** Top Devices
  - **Panel:** Top 10 Networks By Device Usage (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:summarytopdevicesbyusage" $orgid$
| dedup name network.id usage.total usage.percentage
| rename network.name as "Net...`

- **Dashboard:** Top Devices
  - **Panel:** Device Usage Over Time (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:summarytopdevicesbyusage" $orgid$
| dedup name network.id usage.total usage.percentage
| rename name as "Device Name...`

- **Dashboard:** Appliance VPN Statuses
  - **Panel:** VPN Status Data (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:appliancesdwanstatuses" $orgid$ 
| rename networkName as "Network Name", deviceStatus as "Device Status", Subnet_Nam...`

- **Dashboard:** Wireless Device Packet Loss
  - **Panel:** Packet Loss By Network (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicespacketlossbydevice" $orgid$ 
| eval direction = mvappend("downstream", "upstream") 
| mvexpand direct...`

- **Dashboard:** Wireless Device Packet Loss
  - **Panel:** Total Packets v/s Lost Packets (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicespacketlossbydevice" $orgid$ 
| eval direction = mvappend("Downstream", "Upstream") 
| mvexpand direct...`

- **Dashboard:** Wireless Device Packet Loss
  - **Panel:** Top Networks with High Packet Loss (table)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicespacketlossbydevice" $orgid$ 
| rename upstream.lost as upstream_loss ,downstream.lost as downstream_l...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Total Alerts (single_value)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$ 
| dedup id 
| stats count as "Alert Count"...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Alert Count by Severity (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$
| dedup id
| rename severity as "Severity"
| stats count as "Alert Count" by Severity...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Alert Data (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$ 
| dedup id
| rename id as "Alert Id", startedAt as "Alert Time" , categoryType as "Categor...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Top Affected Networks (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$
| dedup id
| rename network.name as "Network Name", severity as "Severity Level"
| stats co...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Top Affected Devices (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$ 
| dedup id 
| rename scope.devices{}.name as "Device Name", severity as "Severity Level" 
...`

- **Dashboard:** Top Switches
  - **Panel:** Top 10 Network by Energy Usage (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:summarytopswitchesbyenergyusage" $orgid$
| rename network.name as "Network Name" 
| stats sum(usage.total) as "Total...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Devices Uplinks History (table)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename name as "Device Name", uplinks{}.interface as "Int...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Uplink Interface Distribution (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename uplinks{}.interface as "Uplink Interface" 
| stats...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Address Assignment Modes (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename uplinks{}.addresses{}.assignmentMode as "Assignmen...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Protocol Distribution (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename uplinks{}.addresses{}.protocol as "Address Protoco...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Most Frequent Public Addresses (table)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$
| dedup serial
| rename uplinks{}.addresses{}.public.address as "Public Add...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Most Frequent Gateway IPs (table)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename uplinks{}.addresses{}.gateway as "Gateway" 
| stat...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Top 10 DNS Servers (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$
| dedup serial
| rename uplinks{}.addresses{}.nameservers.addresses{} as "D...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Top 10 Network Uplinks (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename network.id as "Network Id"
| stats count as Count ...`

- **Dashboard:** Top Clients
  - **Panel:** Total Usage By Network (in MB) (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:summarytopclientsbyusage" $orgid$
| dedup id
| rename network.name as "Network Name"
| stats sum(usage.total) as "To...`

- **Dashboard:** Top Clients
  - **Panel:** Client Usage Metrics (in MB) (chart)
  - **Matched Keywords:** client
  - **Query Preview:** ``meraki_index` sourcetype="meraki:summarytopclientsbyusage" $orgid$
| dedup id
| rename name as "Client Name" 
| stats values(usage.upstream) as "Usag...`

#### TA_cisco_catalyst

- **Dashboard:** Splunk Resource Utilization
  - **Panel:** Process Health (chart)
  - **Query Preview:** `index=_internal sourcetype IN ("splunktaciscocybervision:log", "splunktaciscodnacenter:log", "splunktaciscoise:log", "splunktaciscosdwan:log") host IN...`

- **Dashboard:** Splunk Resource Utilization
  - **Panel:** Health Monitoring by Input Connection (table)
  - **Query Preview:** `index=_internal sourcetype IN ("splunktaciscocybervision:log", "splunktaciscodnacenter:log", "splunktaciscoise:log", "splunktaciscosdwan:log") host IN...`

#### cisco-catalyst-app

- **Dashboard:** Overview Reports
  - **Panel:** Network Device Types (chart)
  - **Matched Keywords:** device
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Center_Reports.Cisco_...`

- **Dashboard:** Sensors
  - **Panel:** Door Sensor Status - Latest Readings (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" 
    from datamodel=Cisco_Catalyst_App 
    where nodename=Cisco_Catalyst_Dataset.Cisco...`

- **Dashboard:** Users And Applications
  - **Panel:** User Identity Summary (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Users And Applications
  - **Panel:** User Authentication Status (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Authentication Status (chart)
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Endpoint Purged (chart)
  - **Query Preview:** ``cisco_catalyst_app_index` sourcetype="cisco:ise:syslog" ObjectsPurged=* NOT ObjectsPurged=None vendor_product IN ($product$) | stats count by ise_ser...`

- **Dashboard:** Overview
  - **Panel:** $client_type_health$ Clients Health Score (single_value)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Client_Inventory_And_...`

- **Dashboard:** Overview
  - **Panel:** Network Health Score - $health_category$ (single_value)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Network_Health_Events...`

- **Dashboard:** Security Insights
  - **Panel:** Device Compliance Status (chart)
  - **Matched Keywords:** device
  - **Query Preview:** `$Cisco Catalyst Center$ | tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Cataly...`

- **Dashboard:** Security Insights
  - **Panel:** Device Compliance State (chart)
  - **Matched Keywords:** device
  - **Query Preview:** `$Cisco Catalyst Center$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Compliance_...`

- **Dashboard:** Endpoint Compliance
  - **Panel:** Compliant Total (single_value)
  - **Query Preview:** `| inputlookup cisco_catalyst_analytics_reports.csv
| where PostureStatus="Compliant" OR PostureStatus="Grace Compliant"
| dedup macAddress
| stats cou...`

- **Dashboard:** Endpoint Compliance
  - **Panel:** Posture Status Trend Over Time (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events.ISE...`

- **Dashboard:** Endpoint Compliance
  - **Panel:** Compliance Summary (table)
  - **Query Preview:** `| inputlookup cisco_catalyst_analytics_reports.csv 
| table macAddress uuid Ipv4Address Ipv6Address cybercomCategory UserName dnsName NetworkDeviceNam...`

- **Dashboard:** Step 2 Manageability and Compliance
  - **Panel:** Endpoint Compliance & Posture Summary (table)
  - **Query Preview:** `| savedsearch "cisco_catalyst_0200_reporting_total_discovered_endpoints_step_2" 
| eval "1. Owner" = `cisco_catalyst_reporting_owner`
| eval "2. Area ...`

- **Dashboard:** Network Insights
  - **Panel:** Device Manageability Type (chart)
  - **Matched Keywords:** device
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Health_Events.device_health_managea...`

- **Dashboard:** Network Insights
  - **Panel:** Device Reachability Type (chart)
  - **Matched Keywords:** device
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Health_Events.device_health_reachab...`

- **Dashboard:** Network Insights
  - **Panel:** Device Family Type (chart)
  - **Matched Keywords:** device
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Health_Events.device_health_device_...`

- **Dashboard:** Network Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Network Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Network Insights
  - **Panel:** Network Devices By Type (table)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Type_Events Ci...`

- **Dashboard:** Network Insights
  - **Panel:** Top 10 Talkers (chart)
  - **Query Preview:** ``cisco_catalyst_app_index` sourcetype="cisco:cybervision:flows" | stats count by host...`

- **Dashboard:** Network Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Network Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** ``cisco_catalyst_app_index` sourcetype="cisco:cybervision:flows" host="$flows_host$"
                | rename left.label as Source, right.label as Dest...`

- **Dashboard:** Network Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events Cis...`

- **Dashboard:** Network Insights
  - **Panel:** ISE $authentication_latency_type$ Authentication Latency (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events
Cis...`

- **Dashboard:** Network Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Network Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events
   ...`

- **Dashboard:** Network Insights
  - **Panel:** ISE Top 10 Active Endpoints (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events Cis...`

- **Dashboard:** Network Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Network Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events Cis...`

- **Dashboard:** Network Insights
  - **Panel:** Top Networks with High Packet Loss (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App 
  where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst...`

- **Dashboard:** Network Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Network Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Packet_Loss_Details b...`

- **Dashboard:** Network Insights
  - **Panel:** Top 10 Offline Devices (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count 
  from datamodel=Cisco_Catalyst_App 
  where nodename=Cisco_Catalyst_Dataset.Cisco_Catal...`

- **Dashboard:** Step 1 Device Classification
  - **Panel:** C2C-0.1.0 Reporting - USCYBERCOM Device Category (chart)
  - **Matched Keywords:** device
  - **Query Preview:** `| inputlookup cisco_catalyst_analytics_reports.csv
| eval filteredCybercom=mvfilter(match(cybercomCategory, `cisco_catalyst_CYBERCOM_Macro`) OR match(...`

- **Dashboard:** Step 1 Device Classification
  - **Panel:** C2C-0.1.1 Reporting - Operating System Summary (chart)
  - **Matched Keywords:** device
  - **Query Preview:** `| inputlookup cisco_catalyst_analytics_reports.csv
| stats count by MatchedPolicy
| sort 0 -count
| rename MatchedPolicy as "Operating System", count ...`

- **Dashboard:** Step 1 Device Classification
  - **Panel:** Untitled (table)
  - **Matched Keywords:** device
  - **Query Preview:** `| inputlookup cisco_catalyst_analytics_reports.csv
| eval filteredCybercom=mvfilter(match(cybercomCategory, `cisco_catalyst_CYBERCOM_Macro`) OR match(...`

- **Dashboard:** Step 1 Device Classification
  - **Panel:** Untitled (table)
  - **Matched Keywords:** device
  - **Query Preview:** `| inputlookup cisco_catalyst_analytics_reports.csv
| stats count by MatchedPolicy
| sort 0 -count
| rename MatchedPolicy as "Operating System", count ...`

- **Dashboard:** Network Compliance
  - **Panel:** Catalyst Center NonCompliant Total (single_value)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Center_Reports.Cisco_...`

- **Dashboard:** Network Compliance
  - **Panel:** Catalyst Center Inventory Total (single_value)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Center_Reports.Cisco_...`

- **Dashboard:** Network Compliance
  - **Panel:** NonCompliant Network Devices (table)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Center_Reports.Cisco_...`

- **Dashboard:** Network Compliance
  - **Panel:** Network Device Inventory (table)
  - **Matched Keywords:** device
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename IN (Cisco_Catalyst_Dataset.Cisco_Catalyst_Center_Reports.Ci...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** Client Inventory (chart)
  - **Matched Keywords:** client
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Client_Inventory_And_...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** Client Health Score – Wired and Wireless (chart)
  - **Matched Keywords:** client
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Client_Inventory_And_...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** Endpoint Identity Summary (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" 
  from datamodel=Cisco_Catalyst_App 
  where nodename=Cisco_Catalyst_Dataset.Cisco_Cat...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** Endpoint Authentication Status (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** BYOD Device Enrollment (table)
  - **Matched Keywords:** device
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Performance
  - **Panel:** ISE System Health (table)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events by ...`

- **Dashboard:** Performance
  - **Panel:** Network System Health (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count(Cisco_Catalyst_Dataset.Cisco_Catalyst_Network_Performance_Events.network_performance_account_id) f...`

- **Dashboard:** Performance
  - **Panel:** Network Latency (Seconds) (chart)
  - **Query Preview:** `| tstats `summariesonly` avg(Cisco_Catalyst_Dataset.Cisco_Catalyst_Network_Performance_Events.network_performance_network_latency) as avg_latency from...`

- **Dashboard:** Performance
  - **Panel:** Network Loss (Percentage) (chart)
  - **Query Preview:** `| tstats `summariesonly` avg(Cisco_Catalyst_Dataset.Cisco_Catalyst_Network_Performance_Events.network_performance_network_loss) as avg_loss from datam...`

- **Dashboard:** Performance
  - **Panel:** Network Jitter (Milliseconds) (chart)
  - **Query Preview:** `| tstats `summariesonly` avg(Cisco_Catalyst_Dataset.Cisco_Catalyst_Network_Performance_Events.network_performance_network_jitter) as avg_jitter from d...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Site Health (chart)
  - **Query Preview:** `| tstats `summariesonly` latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_Site_Health_Events.sdwan_site_health_site_health) as "Site Health" from da...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Link Health (chart)
  - **Query Preview:** `| tstats `summariesonly` count from datamodel=Cisco_Catalyst_App 
    where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_Link_Health
    by Ci...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Unified Threat Defense Health (chart)
  - **Query Preview:** `| tstats `summariesonly` latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_UTD_Health.sdwan_utd_health_status) as "Admin Status" from datamodel=Cisco...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Tunnel Health (chart)
  - **Query Preview:** `| tstats `summariesonly` count as Count latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_Tunnel_Health.sdwan_tunnel_health_health) as "Tunnel Health...`

- **Dashboard:** Master Endpoint Record
  - **Panel:** Master Endpoint Record (table)
  - **Query Preview:** `| inputlookup cisco_catalyst_analytics_reports.csv
| rename macAddress as "Mac Address" record_id as "Record ID" uuid as "UUID" cybercomCategory as "C...`

#### cisco_sna_app

- **Dashboard:** User Report
  - **Panel:** Untitled (table)

- **Dashboard:** User Report
  - **Panel:** Username: (single_value)
  - **Query Preview:** `| where detail_key="Username:" | fields "detail_value"...`

- **Dashboard:** User Report
  - **Panel:** Full Name: (single_value)
  - **Query Preview:** `| fillnull value="N/A" | where detail_key="Full Name:" | fields "detail_value"...`

- **Dashboard:** User Report
  - **Panel:** User Details: (table)
  - **Query Preview:** `| fillnull value="--" | where detail_key!="Full Name:" and detail_key!="Username:" | fields "detail_key", "detail_value"...`

- **Dashboard:** User Report
  - **Panel:** Untitled (table)

- **Dashboard:** User Report
  - **Panel:** Security Index (table)
  - **Query Preview:** `|topalarming report_type=users domain_id=$domain_id$ smc_ip=$smc_ip$
            | where like(username, "$username$") | eval time_session_start=strfti...`

- **Dashboard:** User Report
  - **Panel:** Untitled (table)

- **Dashboard:** User Report
  - **Panel:** Devices & Sessions: (table)
  - **Query Preview:** `| eval start_time=strftime(strptime(start_time,"%Y-%m-%dT%H:%M:%S.%3N%z"),"%Y-%m-%d %H:%M:%S %Z") | eval end_time=strftime(strptime(end_time,"%Y-%m-%d...`

- **Dashboard:** User Report
  - **Panel:** Untitled (table)

- **Dashboard:** User Report
  - **Panel:** Flows (Last 24 Hours): (table)
  - **Query Preview:** `| eval firstActiveTime=strftime(strptime(firstActiveTime, "%Y-%m-%dT%H:%M:%S"),"%Y-%m-%d %H:%M:%S") |
                eval lastActiveTime=strftime(str...`

- **Dashboard:** User Report
  - **Panel:** Untitled (table)

- **Dashboard:** Host Snapshot
  - **Panel:** Status: (table)
  - **Query Preview:** `| where row_type="host_status" | eval status_first_seen=strftime(strptime(status_first_seen."+0000","%Y-%m-%dT%H:%M:%SZ%z"),"%Y-%m-%d %H:%M:%S %Z") | ...`

- **Dashboard:** Host Snapshot
  - **Panel:** Total Traffic (bytes): (single_value)
  - **Query Preview:** `| where row_type="host_traffic_summary" | fields "total_bytes"...`

- **Dashboard:** Host Snapshot
  - **Panel:** Traffic Summary (table)
  - **Query Preview:** `| where row_type="host_traffic" | sort 0 + "fc_name" | eval total_packets_received = tostring(total_packets_received, "commas"), total_packets_sent = ...`

- **Dashboard:** Host Snapshot
  - **Panel:** High Traffic Flows (table)
  - **Query Preview:** `| where row_type="host_flows" and origin_list="highest-traffic" | eval start_time=strftime(strptime(start_time."+0000","%Y-%m-%dT%H:%M:%SZ%z"),"%Y-%m-...`

- **Dashboard:** Flow Collection Trend
  - **Panel:** Latest Total FPS: (single_value)
  - **Query Preview:** `| where deviceId!="0" | sort 0 - time, + deviceName | dedup deviceId | stats sum(fps) as "total_fps" | eval total_fps = tostring(round(total_fps,0), "...`

- **Dashboard:** Flow Collection Trend
  - **Panel:** Average Total FPS: (single_value)
  - **Query Preview:** `| where deviceId!="0" | sort 0 + deviceName | stats avg(fps) as "avg_fps" by deviceId | stats sum(avg_fps) as "total_fps" | eval total_fps = tostring(...`

- **Dashboard:** Flow Collection Trend
  - **Panel:** Max Total FPS: (single_value)
  - **Query Preview:** `| where deviceId!="0" | sort 0 + deviceName | stats max(fps) as "max_fps" by deviceId | stats sum(max_fps) as "total_fps" | eval total_fps = tostring(...`

#### ta_cisco_thousandeyes

- **Dashboard:** Data collection Status
  - **Panel:** Number of Streams (single_value)
  - **Query Preview:** `| tstats `summariesonly` dc(Test_Metrics.thousandeyes.stream.id) as count FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE Test_Metrics.thousand...`

- **Dashboard:** Data collection Status
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` count(Test_Metrics.thousandeyes.stream.id) FROM datamodel="Cisco_ThousandEyes.Test_Metrics"  WHERE Test_Metrics.thousandeyes....`

- **Dashboard:** Data collection Status
  - **Panel:** Number of Cloud & Enterprise Agent Tests and Endpoint Agent Tests (single_value)
  - **Query Preview:** `| tstats `summariesonly` dc(Test_Metrics.thousandeyes.test.id) as count FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE Test_Metrics.thousandey...`

- **Dashboard:** Data collection Status
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` values(Test_Metrics.thousandeyes.test.type) as "Test Types" values(Test_Metrics.thousandeyes.test.name) as "Test Name" FROM d...`

- **Dashboard:** Data collection Status
  - **Panel:** Number of Event Inputs (single_value)
  - **Query Preview:** `| tstats `summariesonly` dc(source) as count FROM datamodel="Cisco_ThousandEyes.Events"  WHERE Events.aid IN($tkn_acc_group$)...`

- **Dashboard:** Data collection Status
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` latest(_time) as time FROM datamodel="Cisco_ThousandEyes.Events"  WHERE Events.aid IN($tkn_acc_group$) BY source | eval sourc...`

- **Dashboard:** Data collection Status
  - **Panel:** Number of Activity Inputs (single_value)
  - **Query Preview:** `| tstats `summariesonly` dc(source) as count FROM datamodel="Cisco_ThousandEyes.Activities"  WHERE Activities.aid IN($tkn_acc_group$)...`

- **Dashboard:** Data collection Status
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` latest(_time) as time FROM datamodel="Cisco_ThousandEyes.Activities"  WHERE Activities.aid IN($tkn_acc_group$) BY source | ev...`

- **Dashboard:** Network
  - **Panel:** Untitled (table)

- **Dashboard:** Network
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` count(Test_Metrics.server.address)  as count  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc_group$ $tkn_age...`

- **Dashboard:** Network
  - **Panel:** Network Latency (Seconds) (single_value)
  - **Query Preview:** `| tstats `summariesonly` avg(Test_Metrics.metric_name:network.latency) as avg_latency  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc...`

- **Dashboard:** Network
  - **Panel:** Network Loss (Percentage) (single_value)
  - **Query Preview:** `| tstats `summariesonly` avg(Test_Metrics.metric_name:network.loss) as avg_loss  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc_group...`

- **Dashboard:** Network
  - **Panel:** Network Jitter (Milliseconds) (single_value)
  - **Query Preview:** `| tstats `summariesonly` avg(Test_Metrics.metric_name:network.jitter) as avg_jitter  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc_g...`

- **Dashboard:** Network
  - **Panel:** Network Latency (Seconds) (chart)
  - **Query Preview:** `| tstats `summariesonly` avg(Test_Metrics.metric_name:network.latency) as avg_latency  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc...`

- **Dashboard:** Network
  - **Panel:** Permalinks for $app_dd_1$ (table)
  - **Query Preview:** `| tstats `summariesonly` count(Test_Metrics.thousandeyes.permalink) as count   FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc_group$ ...`

- **Dashboard:** Network
  - **Panel:** Min Hops $app_dd_1$ (single_value)
  - **Query Preview:** `|tstats `summariesonly` min(Path_Viz.hops) as min  FROM datamodel="Cisco_ThousandEyes.Path_Viz" WHERE (Path_Viz.server="$app_dd_1$" OR Path_Viz.server...`

- **Dashboard:** Network
  - **Panel:** Network Loss (Percentage) (chart)
  - **Query Preview:** `| tstats `summariesonly` avg(Test_Metrics.metric_name:network.loss) as avg_loss  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc_group...`

- **Dashboard:** Network
  - **Panel:** Permalinks for $app_dd_2$ (table)
  - **Query Preview:** `| tstats `summariesonly` count(Test_Metrics.thousandeyes.permalink) as count  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc_group$ $...`

- **Dashboard:** Network
  - **Panel:** Min Hops for $app_dd_2$ (single_value)
  - **Query Preview:** `|tstats `summariesonly` min(Path_Viz.hops) as min  FROM datamodel="Cisco_ThousandEyes.Path_Viz" WHERE (Path_Viz.server="$app_dd_2$" OR Path_Viz.server...`

- **Dashboard:** Network
  - **Panel:** Network Jitter (Milliseconds) (chart)
  - **Query Preview:** `| tstats `summariesonly` avg(Test_Metrics.metric_name:network.jitter) as avg_jitter  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc_g...`

- **Dashboard:** Network
  - **Panel:** Permalinks for $app_dd_3$ (table)
  - **Query Preview:** `| tstats `summariesonly` count(Test_Metrics.thousandeyes.permalink) as count  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc_group$ $...`

- **Dashboard:** Network
  - **Panel:** Min Hops for $app_dd_3$ (single_value)
  - **Query Preview:** `|tstats `summariesonly` min(Path_Viz.hops) as min  FROM datamodel="Cisco_ThousandEyes.Path_Viz" WHERE (Path_Viz.server="$app_dd_3$" OR Path_Viz.server...`

- **Dashboard:** Network
  - **Panel:** Untitled (table)

- **Dashboard:** Network
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` count(Test_Metrics.thousandeyes.monitor.name)  as count  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc_grou...`

- **Dashboard:** Network
  - **Panel:** BGP Reachability (map)
  - **Query Preview:** `| tstats `summariesonly` latest(Test_Metrics.metric_name:bgp.reachability)  as count  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc_...`

- **Dashboard:** Network
  - **Panel:** BGP Path Changes Count (chart)
  - **Query Preview:** `| tstats `summariesonly` avg(Test_Metrics.metric_name:bgp.path_changes.count) as avg_change_count  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WH...`

- **Dashboard:** Network
  - **Panel:** Permalinks for $app_dd_4$ (table)
  - **Query Preview:** `| tstats `summariesonly` count(Test_Metrics.thousandeyes.permalink) as count FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc_group$  $...`

- **Dashboard:** Network
  - **Panel:** BGP Updates Count (chart)
  - **Query Preview:** `| tstats `summariesonly` avg(Test_Metrics.metric_name:bgp.updates.count) as avg_update_count  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $...`

- **Dashboard:** Network
  - **Panel:** Permalinks for $app_dd_5$ (table)
  - **Query Preview:** `| tstats `summariesonly` count(Test_Metrics.thousandeyes.permalink) as count FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc_group$  $...`

- **Dashboard:** Network
  - **Panel:** Untitled (table)

- **Dashboard:** Network
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` count(Test_Metrics.dns.question.name)  as count  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc_group$ $tkn_...`

- **Dashboard:** Network
  - **Panel:** DNS Availability (Percentage) (chart)
  - **Query Preview:** `| tstats `summariesonly` avg(Test_Metrics.metric_name:dns.lookup.availability) as avg_avail  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $t...`

- **Dashboard:** Network
  - **Panel:** Permalinks for $app_dd_6$ (table)
  - **Query Preview:** `| tstats `summariesonly` count(Test_Metrics.thousandeyes.permalink) as count FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc_group$ $t...`

- **Dashboard:** Network
  - **Panel:** DNS Duration (Seconds) (chart)
  - **Query Preview:** `| tstats `summariesonly` avg(Test_Metrics.metric_name:dns.lookup.duration) as avg_duration  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tk...`

- **Dashboard:** Network
  - **Panel:** Permalinks for $app_dd_7$ (table)
  - **Query Preview:** `| tstats `summariesonly` count(Test_Metrics.thousandeyes.permalink) as count  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc_group$ $...`

- **Dashboard:** Network
  - **Panel:** DNS Validity (Percentage) (chart)
  - **Query Preview:** `| tstats `summariesonly` avg(Test_Metrics.metric_name:dns.lookup.validity) as avg_valid  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_a...`

- **Dashboard:** Network
  - **Panel:** Permalinks for $app_dd_8$ (table)
  - **Query Preview:** `| tstats `summariesonly` count(Test_Metrics.thousandeyes.permalink) as count   FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc_group$ ...`

---

### Requirement 23: SNOW incident monitoring (tickets)

**Stated Visualization Support:** No

**Stated Supporting Apps:** —

**Matched Panels Found:** 56

#### Splunk_TA_cisco_meraki

- **Dashboard:** Assurance Alert Data
  - **Panel:** Total Alerts (single_value)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$ 
| dedup id 
| stats count as "Alert Count"...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Alert Count by Severity (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$
| dedup id
| rename severity as "Severity"
| stats count as "Alert Count" by Severity...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Alert Data (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$ 
| dedup id
| rename id as "Alert Id", startedAt as "Alert Time" , categoryType as "Categor...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Top Affected Networks (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$
| dedup id
| rename network.name as "Network Name", severity as "Severity Level"
| stats co...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Top Affected Devices (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$ 
| dedup id 
| rename scope.devices{}.name as "Device Name", severity as "Severity Level" 
...`

#### TA_cisco_catalyst

- **Dashboard:** Splunk Resource Utilization
  - **Panel:** Health Monitoring by Input Connection (table)
  - **Query Preview:** `index=_internal sourcetype IN ("splunktaciscocybervision:log", "splunktaciscodnacenter:log", "splunktaciscoise:log", "splunktaciscosdwan:log") host IN...`

#### cisco-catalyst-app

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Top 10 Alarms (chart)
  - **Matched Keywords:** incident
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Alarm_Events Cisco_Ca...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Authentication Status (chart)
  - **Matched Keywords:** incident
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Alarm Hidden Panel (table)
  - **Matched Keywords:** incident
  - **Query Preview:** `| tstats `summariesonly` count 
  from datamodel=Cisco_Catalyst_App 
  where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Alarm_Events 
  by Cisco_C...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** incident

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** incident

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** incident
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** incident
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** incident
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** incident
  - **Query Preview:** `$run_auth_action$ 
| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Data...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Number of Issues by Priority (chart)
  - **Matched Keywords:** incident
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Active_Issue_Events.active_issue_specific_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Number of Issues by Severity (chart)
  - **Matched Keywords:** incident
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Active_Issue_Events.active_issue_specific_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Number of Issues by Category (chart)
  - **Matched Keywords:** incident
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Active_Issue_Events.active_issue_specific_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** incident

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** incident
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Audit Logs for Cisco ISE (table)
  - **Matched Keywords:** incident
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Audit Logs for SD-WAN (table)
  - **Matched Keywords:** incident
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Ci...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Audit Logs for Catalyst Center (table)
  - **Matched Keywords:** incident
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Audit Logs for Cisco Meraki (table)
  - **Matched Keywords:** incident
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count 
  from datamodel=Cisco_Catalyst_App 
  where nodename=Cisco_Catalyst_Dataset.Cisco_Catal...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Event Notifications for Cisco ISE (table)
  - **Matched Keywords:** incident
  - **Query Preview:** `| tstats fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Event_Notificati...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** SD-WAN Events (events)
  - **Matched Keywords:** incident
  - **Query Preview:** ``cisco_catalyst_app_index` sourcetype="cisco:sdwan:*" "$notification_search_tkn$"...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Events By Severity for Cyber Vision (chart)
  - **Matched Keywords:** incident
  - **Query Preview:** `| tstats `summariesonly` count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Cyber_Vision_Severity_Events by ...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** incident

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Severity - $severity$ By Type (chart)
  - **Matched Keywords:** incident
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Events Of Type - $type$ And Severity - $severity$ (table)
  - **Matched Keywords:** incident
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Security and Operational Events Distribution By Severity Over Time (chart)
  - **Matched Keywords:** incident
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Cyber_Vision_Syslog_E...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** incident

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** incident
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Cyber_Vision_Syslog_E...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Security Events by Severity (chart)
  - **Matched Keywords:** incident
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Cyber_Vision_Syslog_E...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Operational Events by Severity (chart)
  - **Matched Keywords:** incident
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Cyber_Vision_Syslog_E...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** incident

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (chart)
  - **Matched Keywords:** incident
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** All Security Events of "$syslog_severity$" Severity (table)
  - **Matched Keywords:** incident
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** incident

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (chart)
  - **Matched Keywords:** incident
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** All Operational Events of "$syslog_operational_severity_panel$" Severity (table)
  - **Matched Keywords:** incident
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Cyber_Vision_Syslog_E...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Meraki Policy Sync (chart)
  - **Matched Keywords:** incident
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events.ISE...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** incident

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** incident
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Wireless Signal Metrics (chart)
  - **Matched Keywords:** incident
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events by ...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** incident

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** incident
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events by ...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Security Group Tag by Authentication (chart)
  - **Matched Keywords:** incident
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events by ...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** IP-SGT Bindings (chart)
  - **Matched Keywords:** incident
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_IP_SGT_Bindings by Ci...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** incident

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** incident
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as Count from datamodel=Cisco_Catalyst_App 
    where nodename=Cisco_Catalyst_Dataset.Cisco_Cataly...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** incident

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** incident
  - **Query Preview:** `| tstats `summariesonly` values(Cisco_Catalyst_Dataset.Cisco_Catalyst_IP_SGT_Bindings.cisco_ip_sgt_source) as "Source" count as "Count" from datamodel...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Endpoint Purged (chart)
  - **Matched Keywords:** incident
  - **Query Preview:** ``cisco_catalyst_app_index` sourcetype="cisco:ise:syslog" ObjectsPurged=* NOT ObjectsPurged=None vendor_product IN ($product$) | stats count by ise_ser...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** incident

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** incident
  - **Query Preview:** ``cisco_catalyst_app_index` sourcetype="cisco:ise:syslog" ObjectsPurged=* NOT ObjectsPurged=None vendor_product IN ($product$) ise_servername IN ($endp...`

---

### Requirement 24: Splunk resource / ingest optimization

**Stated Visualization Support:** No

**Stated Supporting Apps:** —

**Matched Panels Found:** 8

#### TA_cisco_catalyst

- **Dashboard:** Splunk Resource Utilization
  - **Panel:** CPU Utilization (chart)
  - **Matched Keywords:** resource, splunk
  - **Query Preview:** `| tstats count from datamodel=TA_Cisco_Catalyst_Resource_Utilization.Resource_Utilization_Introspection_Dataset where host IN ($host$) Resource_Utiliz...`

- **Dashboard:** Splunk Resource Utilization
  - **Panel:** Memory Utilization(%) (chart)
  - **Matched Keywords:** resource, splunk
  - **Query Preview:** `| tstats count from datamodel=TA_Cisco_Catalyst_Resource_Utilization.Resource_Utilization_Introspection_Dataset where host IN ($host$) Resource_Utiliz...`

- **Dashboard:** Splunk Resource Utilization
  - **Panel:** Untitled (table)
  - **Matched Keywords:** resource, splunk

- **Dashboard:** Splunk Resource Utilization
  - **Panel:** Untitled (table)
  - **Matched Keywords:** resource, splunk

- **Dashboard:** Splunk Resource Utilization
  - **Panel:** Untitled (chart)
  - **Matched Keywords:** resource, splunk
  - **Query Preview:** `| tstats count from datamodel=TA_Cisco_Catalyst_Resource_Utilization.Resource_Utilization_Introspection_Dataset where host IN ("*") Resource_Utilizati...`

- **Dashboard:** Splunk Resource Utilization
  - **Panel:** Untitled (chart)
  - **Matched Keywords:** resource, splunk
  - **Query Preview:** `| tstats count from datamodel=TA_Cisco_Catalyst_Resource_Utilization.Resource_Utilization_Introspection_Dataset where host IN ("*") Resource_Utilizati...`

- **Dashboard:** Splunk Resource Utilization
  - **Panel:** Process Health (chart)
  - **Matched Keywords:** resource, splunk
  - **Query Preview:** `index=_internal sourcetype IN ("splunktaciscocybervision:log", "splunktaciscodnacenter:log", "splunktaciscoise:log", "splunktaciscosdwan:log") host IN...`

- **Dashboard:** Splunk Resource Utilization
  - **Panel:** Health Monitoring by Input Connection (table)
  - **Matched Keywords:** resource, splunk
  - **Query Preview:** `index=_internal sourcetype IN ("splunktaciscocybervision:log", "splunktaciscodnacenter:log", "splunktaciscoise:log", "splunktaciscosdwan:log") host IN...`

---

### Requirement 25: SD-WAN path changes / intelligence

**Stated Visualization Support:** Partial

**Stated Supporting Apps:** Cisco Enterprise Networking for Splunk Platform

**Matched Panels Found:** 13

#### Splunk_TA_cisco_meraki

- **Dashboard:** Access Point
  - **Panel:** Top Devices by RF Changes (table)
  - **Matched Keywords:** changes
  - **Query Preview:** ``meraki_index` sourcetype="meraki:accesspoints" $orgid$ 
| dedup occurredAt, clientId
| spath type 
| search type="auto_rf_channel_change" 
| stats co...`

- **Dashboard:** Device Availabilities Change History
  - **Panel:** Top 10 Networks By Device Changes (chart)
  - **Matched Keywords:** changes
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesavailabilitieschangehistory" $orgid$ 
| dedup device.serial
| rename network.name as "Network Name" 
| stats ...`

- **Dashboard:** Audit Data
  - **Panel:** Total Changes (single_value)
  - **Matched Keywords:** changes
  - **Query Preview:** ``meraki_index` sourcetype="meraki:audit" $orgid$
| dedup ts, adminId
| stats count as "Total Changes"...`

#### cisco-catalyst-app

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Audit Logs for SD-WAN (table)
  - **Matched Keywords:** wan
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Ci...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** SD-WAN Events (events)
  - **Matched Keywords:** wan
  - **Query Preview:** ``cisco_catalyst_app_index` sourcetype="cisco:sdwan:*" "$notification_search_tkn$"...`

- **Dashboard:** Overview
  - **Panel:** Top Policy Hits for SD-WAN (chart)
  - **Matched Keywords:** wan
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Performance
  - **Panel:** Audit Logs for SD-WAN (table)
  - **Matched Keywords:** wan
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_SD...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Site Health (chart)
  - **Matched Keywords:** wan
  - **Query Preview:** `| tstats `summariesonly` latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_Site_Health_Events.sdwan_site_health_site_health) as "Site Health" from da...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Link Health (chart)
  - **Matched Keywords:** wan
  - **Query Preview:** `| tstats `summariesonly` count from datamodel=Cisco_Catalyst_App 
    where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_Link_Health
    by Ci...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Unified Threat Defense Health (chart)
  - **Matched Keywords:** wan
  - **Query Preview:** `| tstats `summariesonly` latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_UTD_Health.sdwan_utd_health_status) as "Admin Status" from datamodel=Cisco...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Tunnel Health (chart)
  - **Matched Keywords:** wan
  - **Query Preview:** `| tstats `summariesonly` count as Count latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_Tunnel_Health.sdwan_tunnel_health_health) as "Tunnel Health...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN SSE Tunnels (chart)
  - **Matched Keywords:** wan
  - **Query Preview:** `| tstats `summariesonly`  latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_Sig_Tunnel_State.sdwan_sig_tunnel_tunnel_status_local) as "Tunnel Status ...`

#### ta_cisco_thousandeyes

- **Dashboard:** Network
  - **Panel:** BGP Path Changes Count (chart)
  - **Matched Keywords:** changes, path
  - **Query Preview:** `| tstats `summariesonly` avg(Test_Metrics.metric_name:bgp.path_changes.count) as avg_change_count  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WH...`

---

### Requirement 26: Data availability / CMDB state

**Stated Visualization Support:** No

**Stated Supporting Apps:** —

**Matched Panels Found:** 6

#### cisco-catalyst-app

- **Dashboard:** Security Insights
  - **Panel:** Device Compliance State (chart)
  - **Matched Keywords:** state
  - **Query Preview:** `$Cisco Catalyst Center$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Compliance_...`

#### ta_cisco_thousandeyes

- **Dashboard:** Application
  - **Panel:** HTTP Server Availability (Percentage) (single_value)
  - **Matched Keywords:** availability
  - **Query Preview:** `| tstats `summariesonly` avg(Test_Metrics.metric_name:http.server.request.availability) as avg_avail  FROM datamodel="Cisco_ThousandEyes.Test_Metrics"...`

- **Dashboard:** Application
  - **Panel:** HTTP Server Availability (Percentage) (chart)
  - **Matched Keywords:** availability
  - **Query Preview:** `| tstats `summariesonly` avg(Test_Metrics.metric_name:http.server.request.availability) as avg_avail  FROM datamodel="Cisco_ThousandEyes.Test_Metrics"...`

- **Dashboard:** Network
  - **Panel:** DNS Availability (Percentage) (chart)
  - **Matched Keywords:** availability
  - **Query Preview:** `| tstats `summariesonly` avg(Test_Metrics.metric_name:dns.lookup.availability) as avg_avail  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $t...`

- **Dashboard:** Voice
  - **Panel:** FTP Server Availability (Percentage) (chart)
  - **Matched Keywords:** availability
  - **Query Preview:** `| tstats `summariesonly` avg(Test_Metrics.metric_name:ftp.server.request.availability) as avg_avail  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" ...`

- **Dashboard:** Voice
  - **Panel:** SIP Server Availability (Percentage) (chart)
  - **Matched Keywords:** availability
  - **Query Preview:** `| tstats `summariesonly` avg(Test_Metrics.metric_name:sip.server.request.availability) as avg_avail  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" ...`

---

### Requirement 27: Device health / alerts by site

**Stated Visualization Support:** Yes

**Stated Supporting Apps:** Cisco Enterprise Networking for Splunk Platform, Splunk Add-on for Cisco Meraki

**Matched Panels Found:** 77

#### Splunk_TA_cisco-ise

- **Dashboard:** Cisco ISE TA Troubleshooting Dashboard
  - **Panel:** Alerts (single_value)
  - **Matched Keywords:** alerts
  - **Query Preview:** `| pivot Alerts Alerts count(Alerts) AS "Count of Alerts" FILTER sourcetype is "cisco:ise:syslog" ROWSUMMARY 0 COLSUMMARY 0 SHOWOTHER 1...`

#### Splunk_TA_cisco_meraki

- **Dashboard:** Organizations Security
  - **Panel:** Blocked Alerts Count (chart)
  - **Matched Keywords:** alerts
  - **Query Preview:** ``meraki_index` sourcetype="meraki:organizationsecurity" $orgid$
| stats count as Count by blocked
| rename blocked as "Blocked"...`

- **Dashboard:** Organizations Security
  - **Panel:** Details of Alerts (table)
  - **Matched Keywords:** alerts
  - **Query Preview:** ``meraki_index` sourcetype="meraki:organizationsecurity" $orgid$
| rename eventType as "Event Type", deviceMac as "Device Mac", signature as "Signature...`

- **Dashboard:** Organizations Security
  - **Panel:** Alerts Over Time (chart)
  - **Matched Keywords:** alerts
  - **Query Preview:** ``meraki_index` sourcetype="meraki:organizationsecurity" $orgid$
| timechart count as "Alert Count" span=1d...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Ethernet Port Statuses (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$ 
| dedup serial
| rename name as "Device Name", ports{}.name as "Ports Name...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Devices Without Power Connectivity (table)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename power.ac.isConnected as ac , power.poe.isConnected...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** POE Standard Distribution (chart)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename ports{}.poe.standard as "POE Standard"
| stats cou...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Ports Speed (chart)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename ports{}.linkNegotiation.speed as "Port Speed"
| st...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Wireless Device Ethernet Status | Aggregation Status (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename aggregation.enabled as aggregation_enabled
| eval ...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Network Port Speeds (table)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| rename ports{}.linkNegotiation.speed as port_speed, network.id as "Netwo...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Networks with Most PoE Devices (chart)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename power.poe.isConnected as poe_connected, network.id...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Power Mode Distribution (chart)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename power.mode as "Power Mode"
| stats count by "Power...`

- **Dashboard:** Device Availabilities Change History
  - **Panel:** Top 10 Networks By Device Changes (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesavailabilitieschangehistory" $orgid$ 
| dedup device.serial
| rename network.name as "Network Name" 
| stats ...`

- **Dashboard:** Device Availabilities Change History
  - **Panel:** Top 10 Offline Devices (table)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesavailabilitieschangehistory" $orgid$ details.new{}.value="offline" 
| dedup device.serial
| rename device.nam...`

- **Dashboard:** Device Availabilities Change History
  - **Panel:** Devices Availabilities Change History (table)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesavailabilitieschangehistory" $orgid$ 
| dedup device.serial
| rename details.new{}.value as "New Status", det...`

- **Dashboard:** Device Availabilities Change History
  - **Panel:** Device Status History Over Time (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesavailabilitieschangehistory" $orgid$ 
| dedup device.serial
| rename details.new{}.value as new_status 
| tim...`

- **Dashboard:** Top Devices
  - **Panel:** Device Usage Metrics (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:summarytopdevicesbyusage" $orgid$
| dedup name network.id usage.total usage.percentage
| rename name as "Device Name...`

- **Dashboard:** Top Devices
  - **Panel:** Top 10 Networks By Device Usage (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:summarytopdevicesbyusage" $orgid$
| dedup name network.id usage.total usage.percentage
| rename network.name as "Net...`

- **Dashboard:** Top Devices
  - **Panel:** Device Usage Over Time (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:summarytopdevicesbyusage" $orgid$
| dedup name network.id usage.total usage.percentage
| rename name as "Device Name...`

- **Dashboard:** Appliance VPN Statuses
  - **Panel:** VPN Status Data (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:appliancesdwanstatuses" $orgid$ 
| rename networkName as "Network Name", deviceStatus as "Device Status", Subnet_Nam...`

- **Dashboard:** Wireless Device Packet Loss
  - **Panel:** Packet Loss By Network (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicespacketlossbydevice" $orgid$ 
| eval direction = mvappend("downstream", "upstream") 
| mvexpand direct...`

- **Dashboard:** Wireless Device Packet Loss
  - **Panel:** Total Packets v/s Lost Packets (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicespacketlossbydevice" $orgid$ 
| eval direction = mvappend("Downstream", "Upstream") 
| mvexpand direct...`

- **Dashboard:** Wireless Device Packet Loss
  - **Panel:** Top Networks with High Packet Loss (table)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicespacketlossbydevice" $orgid$ 
| rename upstream.lost as upstream_loss ,downstream.lost as downstream_l...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Total Alerts (single_value)
  - **Matched Keywords:** alerts
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$ 
| dedup id 
| stats count as "Alert Count"...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Alert Count by Severity (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$
| dedup id
| rename severity as "Severity"
| stats count as "Alert Count" by Severity...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Alert Data (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$ 
| dedup id
| rename id as "Alert Id", startedAt as "Alert Time" , categoryType as "Categor...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Top Affected Networks (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$
| dedup id
| rename network.name as "Network Name", severity as "Severity Level"
| stats co...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Top Affected Devices (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$ 
| dedup id 
| rename scope.devices{}.name as "Device Name", severity as "Severity Level" 
...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Devices Uplinks History (table)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename name as "Device Name", uplinks{}.interface as "Int...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Uplink Interface Distribution (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename uplinks{}.interface as "Uplink Interface" 
| stats...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Address Assignment Modes (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename uplinks{}.addresses{}.assignmentMode as "Assignmen...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Protocol Distribution (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename uplinks{}.addresses{}.protocol as "Address Protoco...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Most Frequent Public Addresses (table)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$
| dedup serial
| rename uplinks{}.addresses{}.public.address as "Public Add...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Most Frequent Gateway IPs (table)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename uplinks{}.addresses{}.gateway as "Gateway" 
| stat...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Top 10 DNS Servers (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$
| dedup serial
| rename uplinks{}.addresses{}.nameservers.addresses{} as "D...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Top 10 Network Uplinks (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename network.id as "Network Id"
| stats count as Count ...`

#### TA_cisco_catalyst

- **Dashboard:** Splunk Resource Utilization
  - **Panel:** Process Health (chart)
  - **Matched Keywords:** health
  - **Query Preview:** `index=_internal sourcetype IN ("splunktaciscocybervision:log", "splunktaciscodnacenter:log", "splunktaciscoise:log", "splunktaciscosdwan:log") host IN...`

- **Dashboard:** Splunk Resource Utilization
  - **Panel:** Health Monitoring by Input Connection (table)
  - **Matched Keywords:** health
  - **Query Preview:** `index=_internal sourcetype IN ("splunktaciscocybervision:log", "splunktaciscodnacenter:log", "splunktaciscoise:log", "splunktaciscosdwan:log") host IN...`

#### cisco-catalyst-app

- **Dashboard:** Overview Reports
  - **Panel:** Network Device Types (chart)
  - **Matched Keywords:** device
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Center_Reports.Cisco_...`

- **Dashboard:** Sensors
  - **Panel:** Door Sensor Status - Latest Readings (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" 
    from datamodel=Cisco_Catalyst_App 
    where nodename=Cisco_Catalyst_Dataset.Cisco...`

- **Dashboard:** Users And Applications
  - **Panel:** User Authentication Status (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Authentication Status (chart)
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Overview
  - **Panel:** $client_type_health$ Clients Health Score (single_value)
  - **Matched Keywords:** health
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Client_Inventory_And_...`

- **Dashboard:** Overview
  - **Panel:** Network Health Score - $health_category$ (single_value)
  - **Matched Keywords:** health
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Network_Health_Events...`

- **Dashboard:** Security Insights
  - **Panel:** Device Compliance Status (chart)
  - **Matched Keywords:** device
  - **Query Preview:** `$Cisco Catalyst Center$ | tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Cataly...`

- **Dashboard:** Security Insights
  - **Panel:** Device Compliance State (chart)
  - **Matched Keywords:** device
  - **Query Preview:** `$Cisco Catalyst Center$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Compliance_...`

- **Dashboard:** Endpoint Compliance
  - **Panel:** Posture Status Trend Over Time (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events.ISE...`

- **Dashboard:** Network Insights
  - **Panel:** Device Manageability Type (chart)
  - **Matched Keywords:** device
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Health_Events.device_health_managea...`

- **Dashboard:** Network Insights
  - **Panel:** Device Reachability Type (chart)
  - **Matched Keywords:** device
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Health_Events.device_health_reachab...`

- **Dashboard:** Network Insights
  - **Panel:** Device Family Type (chart)
  - **Matched Keywords:** device
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Health_Events.device_health_device_...`

- **Dashboard:** Step 1 Device Classification
  - **Panel:** C2C-0.1.0 Reporting - USCYBERCOM Device Category (chart)
  - **Matched Keywords:** device
  - **Query Preview:** `| inputlookup cisco_catalyst_analytics_reports.csv
| eval filteredCybercom=mvfilter(match(cybercomCategory, `cisco_catalyst_CYBERCOM_Macro`) OR match(...`

- **Dashboard:** Step 1 Device Classification
  - **Panel:** C2C-0.1.1 Reporting - Operating System Summary (chart)
  - **Matched Keywords:** device
  - **Query Preview:** `| inputlookup cisco_catalyst_analytics_reports.csv
| stats count by MatchedPolicy
| sort 0 -count
| rename MatchedPolicy as "Operating System", count ...`

- **Dashboard:** Step 1 Device Classification
  - **Panel:** Untitled (table)
  - **Matched Keywords:** device
  - **Query Preview:** `| inputlookup cisco_catalyst_analytics_reports.csv
| eval filteredCybercom=mvfilter(match(cybercomCategory, `cisco_catalyst_CYBERCOM_Macro`) OR match(...`

- **Dashboard:** Step 1 Device Classification
  - **Panel:** Untitled (table)
  - **Matched Keywords:** device
  - **Query Preview:** `| inputlookup cisco_catalyst_analytics_reports.csv
| stats count by MatchedPolicy
| sort 0 -count
| rename MatchedPolicy as "Operating System", count ...`

- **Dashboard:** Network Compliance
  - **Panel:** Network Device Inventory (table)
  - **Matched Keywords:** device
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename IN (Cisco_Catalyst_Dataset.Cisco_Catalyst_Center_Reports.Ci...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** Client Health Score – Wired and Wireless (chart)
  - **Matched Keywords:** health
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Client_Inventory_And_...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** Endpoint Authentication Status (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** BYOD Device Enrollment (table)
  - **Matched Keywords:** device
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Performance
  - **Panel:** ISE System Health (table)
  - **Matched Keywords:** health
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events by ...`

- **Dashboard:** Performance
  - **Panel:** Network System Health (table)
  - **Matched Keywords:** health
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count(Cisco_Catalyst_Dataset.Cisco_Catalyst_Network_Performance_Events.network_performance_account_id) f...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Site Health (chart)
  - **Matched Keywords:** health, site
  - **Query Preview:** `| tstats `summariesonly` latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_Site_Health_Events.sdwan_site_health_site_health) as "Site Health" from da...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Link Health (chart)
  - **Matched Keywords:** health
  - **Query Preview:** `| tstats `summariesonly` count from datamodel=Cisco_Catalyst_App 
    where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_Link_Health
    by Ci...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Unified Threat Defense Health (chart)
  - **Matched Keywords:** health
  - **Query Preview:** `| tstats `summariesonly` latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_UTD_Health.sdwan_utd_health_status) as "Admin Status" from datamodel=Cisco...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Tunnel Health (chart)
  - **Matched Keywords:** health
  - **Query Preview:** `| tstats `summariesonly` count as Count latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_Tunnel_Health.sdwan_tunnel_health_health) as "Tunnel Health...`

#### cisco-cloud-security

- **Dashboard:** Alerts Dashboard
  - **Panel:** Untitled (table)
  - **Matched Keywords:** alerts

#### cisco_sna_app

- **Dashboard:** Host Snapshot
  - **Panel:** Status: (table)
  - **Query Preview:** `| where row_type="host_status" | eval status_first_seen=strftime(strptime(status_first_seen."+0000","%Y-%m-%dT%H:%M:%SZ%z"),"%Y-%m-%d %H:%M:%S %Z") | ...`

#### ta_cisco_thousandeyes

- **Dashboard:** Alerts
  - **Panel:** Untitled (table)
  - **Matched Keywords:** alerts
  - **Query Preview:** `| tstats `summariesonly` count, values(Alerts.triggerTime) as triggerTime, values(Alerts.accountId) as accountId, values(Alerts.organizationId) as org...`

- **Dashboard:** Alerts
  - **Panel:** Alerts Summary by Severity (chart)
  - **Matched Keywords:** alerts
  - **Query Preview:** `| tstats `summariesonly` count FROM datamodel="Cisco_ThousandEyes.Alerts" WHERE $tkn_acc_group$ $tkn_severity$ $tkn_test_type$ BY Alerts.severity | re...`

- **Dashboard:** Alerts
  - **Panel:** Alerts Timeline (chart)
  - **Matched Keywords:** alerts
  - **Query Preview:** `| tstats `summariesonly` count FROM datamodel="Cisco_ThousandEyes.Alerts" WHERE $tkn_acc_group$ $tkn_severity$ $tkn_test_type$ BY Alerts.severity _tim...`

- **Dashboard:** Data collection Status
  - **Panel:** Number of Streams (single_value)
  - **Query Preview:** `| tstats `summariesonly` dc(Test_Metrics.thousandeyes.stream.id) as count FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE Test_Metrics.thousand...`

- **Dashboard:** Data collection Status
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` count(Test_Metrics.thousandeyes.stream.id) FROM datamodel="Cisco_ThousandEyes.Test_Metrics"  WHERE Test_Metrics.thousandeyes....`

- **Dashboard:** Data collection Status
  - **Panel:** Number of Cloud & Enterprise Agent Tests and Endpoint Agent Tests (single_value)
  - **Query Preview:** `| tstats `summariesonly` dc(Test_Metrics.thousandeyes.test.id) as count FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE Test_Metrics.thousandey...`

- **Dashboard:** Data collection Status
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` values(Test_Metrics.thousandeyes.test.type) as "Test Types" values(Test_Metrics.thousandeyes.test.name) as "Test Name" FROM d...`

- **Dashboard:** Data collection Status
  - **Panel:** Number of Event Inputs (single_value)
  - **Query Preview:** `| tstats `summariesonly` dc(source) as count FROM datamodel="Cisco_ThousandEyes.Events"  WHERE Events.aid IN($tkn_acc_group$)...`

- **Dashboard:** Data collection Status
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` latest(_time) as time FROM datamodel="Cisco_ThousandEyes.Events"  WHERE Events.aid IN($tkn_acc_group$) BY source | eval sourc...`

- **Dashboard:** Data collection Status
  - **Panel:** Number of Activity Inputs (single_value)
  - **Query Preview:** `| tstats `summariesonly` dc(source) as count FROM datamodel="Cisco_ThousandEyes.Activities"  WHERE Activities.aid IN($tkn_acc_group$)...`

- **Dashboard:** Data collection Status
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` latest(_time) as time FROM datamodel="Cisco_ThousandEyes.Activities"  WHERE Activities.aid IN($tkn_acc_group$) BY source | ev...`

---

### Requirement 28: CVE / PSIRT vulnerability view

**Stated Visualization Support:** No

**Stated Supporting Apps:** Cisco Security Cloud Add-on

**Matched Panels Found:** 2

#### cisco-catalyst-app

- **Dashboard:** Security Insights
  - **Panel:** Security Advisory Details (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Vulnerability Overview
  - **Panel:** Found vulnerability on - $dst_ip$ (table)
  - **Matched Keywords:** vulnerability
  - **Query Preview:** ``cisco_catalyst_app_index` sourcetype="cisco:cybervision:syslog" cat="Security Events" dst="$dst_ip$" | table SCVVulns* | transpose | rename "row 1" a...`

---

### Requirement 29: Devices nearing EOL/LDOS

**Stated Visualization Support:** No

**Stated Supporting Apps:** —

**Matched Panels Found:** 22

#### Splunk_TA_cisco_meraki

- **Dashboard:** Access Point
  - **Panel:** Top Devices by RF Changes (table)
  - **Matched Keywords:** devices
  - **Query Preview:** ``meraki_index` sourcetype="meraki:accesspoints" $orgid$ 
| dedup occurredAt, clientId
| spath type 
| search type="auto_rf_channel_change" 
| stats co...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Ethernet Port Statuses (table)
  - **Matched Keywords:** devices
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$ 
| dedup serial
| rename name as "Device Name", ports{}.name as "Ports Name...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Devices Without Power Connectivity (table)
  - **Matched Keywords:** devices
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename power.ac.isConnected as ac , power.poe.isConnected...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** POE Standard Distribution (chart)
  - **Matched Keywords:** devices
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename ports{}.poe.standard as "POE Standard"
| stats cou...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Ports Speed (chart)
  - **Matched Keywords:** devices
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename ports{}.linkNegotiation.speed as "Port Speed"
| st...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Wireless Device Ethernet Status | Aggregation Status (chart)
  - **Matched Keywords:** devices
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename aggregation.enabled as aggregation_enabled
| eval ...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Network Port Speeds (table)
  - **Matched Keywords:** devices
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| rename ports{}.linkNegotiation.speed as port_speed, network.id as "Netwo...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Networks with Most PoE Devices (chart)
  - **Matched Keywords:** devices
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename power.poe.isConnected as poe_connected, network.id...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Power Mode Distribution (chart)
  - **Matched Keywords:** devices
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename power.mode as "Power Mode"
| stats count by "Power...`

- **Dashboard:** Security Appliances
  - **Panel:** Top Devices with IP Conflicts (table)
  - **Matched Keywords:** devices
  - **Query Preview:** ``meraki_index` sourcetype="meraki:securityappliances" category="ip_conflicts" $orgid$
| dedup occurredAt, deviceSerial
| stats count as Count by devic...`

- **Dashboard:** Device Availabilities Change History
  - **Panel:** Top 10 Offline Devices (table)
  - **Matched Keywords:** devices
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesavailabilitieschangehistory" $orgid$ details.new{}.value="offline" 
| dedup device.serial
| rename device.nam...`

- **Dashboard:** Device Availabilities Change History
  - **Panel:** Devices Availabilities Change History (table)
  - **Matched Keywords:** devices
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesavailabilitieschangehistory" $orgid$ 
| dedup device.serial
| rename details.new{}.value as "New Status", det...`

- **Dashboard:** Top Devices
  - **Panel:** Device Usage Metrics (chart)
  - **Matched Keywords:** devices
  - **Query Preview:** ``meraki_index` sourcetype="meraki:summarytopdevicesbyusage" $orgid$
| dedup name network.id usage.total usage.percentage
| rename name as "Device Name...`

- **Dashboard:** Top Devices
  - **Panel:** Top 10 Networks By Device Usage (chart)
  - **Matched Keywords:** devices
  - **Query Preview:** ``meraki_index` sourcetype="meraki:summarytopdevicesbyusage" $orgid$
| dedup name network.id usage.total usage.percentage
| rename network.name as "Net...`

- **Dashboard:** Top Devices
  - **Panel:** Device Usage Over Time (chart)
  - **Matched Keywords:** devices
  - **Query Preview:** ``meraki_index` sourcetype="meraki:summarytopdevicesbyusage" $orgid$
| dedup name network.id usage.total usage.percentage
| rename name as "Device Name...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Top Affected Devices (table)
  - **Matched Keywords:** devices
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$ 
| dedup id 
| rename scope.devices{}.name as "Device Name", severity as "Severity Level" 
...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Devices Uplinks History (table)
  - **Matched Keywords:** devices
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename name as "Device Name", uplinks{}.interface as "Int...`

#### cisco-catalyst-app

- **Dashboard:** Security Insights
  - **Panel:** Rogue Devices Count (single_value)
  - **Matched Keywords:** devices
  - **Query Preview:** `| tstats `summariesonly` count as Count from datamodel=Cisco_Catalyst_App 
  where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Rogue_Events 
  by C...`

- **Dashboard:** Network Insights
  - **Panel:** Network Devices By Type (table)
  - **Matched Keywords:** devices
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Type_Events Ci...`

- **Dashboard:** Network Insights
  - **Panel:** Top 10 Offline Devices (table)
  - **Matched Keywords:** devices
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count 
  from datamodel=Cisco_Catalyst_App 
  where nodename=Cisco_Catalyst_Dataset.Cisco_Catal...`

- **Dashboard:** Network Compliance
  - **Panel:** NonCompliant Network Devices (table)
  - **Matched Keywords:** devices
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Center_Reports.Cisco_...`

#### cisco_sna_app

- **Dashboard:** User Report
  - **Panel:** Devices & Sessions: (table)
  - **Matched Keywords:** devices
  - **Query Preview:** `| eval start_time=strftime(strptime(start_time,"%Y-%m-%dT%H:%M:%S.%3N%z"),"%Y-%m-%d %H:%M:%S %Z") | eval end_time=strftime(strptime(end_time,"%Y-%m-%d...`

---

### Requirement 30: SD-WAN site view (FW, MX, apps)

**Stated Visualization Support:** Yes

**Stated Supporting Apps:** Cisco Enterprise Networking for Splunk Platform

**Matched Panels Found:** 79

#### Splunk_TA_cisco_meraki

- **Dashboard:** Organizations Security
  - **Panel:** Blocked Alerts Count (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:organizationsecurity" $orgid$
| stats count as Count by blocked
| rename blocked as "Blocked"...`

- **Dashboard:** Organizations Security
  - **Panel:** Details of Alerts (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:organizationsecurity" $orgid$
| rename eventType as "Event Type", deviceMac as "Device Mac", signature as "Signature...`

- **Dashboard:** Organizations Security
  - **Panel:** Alerts Over Time (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:organizationsecurity" $orgid$
| timechart count as "Alert Count" span=1d...`

- **Dashboard:** Security Appliances
  - **Panel:** Appliance Security Events (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:securityappliances" $orgid$ 
| dedup occurredAt, deviceSerial
|spath description
| rename eventData.summary as Summa...`

- **Dashboard:** Security Appliances
  - **Panel:** Categories of Data (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:securityappliances" $orgid$
| dedup occurredAt, deviceSerial
| stats count as Count by category
| sort - 0 Count
| r...`

- **Dashboard:** Security Appliances
  - **Panel:** Top Devices with IP Conflicts (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:securityappliances" category="ip_conflicts" $orgid$
| dedup occurredAt, deviceSerial
| stats count as Count by devic...`

- **Dashboard:** Security Appliances
  - **Panel:** Security Events Occurred by Time (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:securityappliances" $orgid$
| dedup occurredAt, deviceSerial
| timechart count as "Events Occured" span=1d...`

#### cisco-catalyst-app

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Audit Logs for SD-WAN (table)
  - **Matched Keywords:** wan
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Ci...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** SD-WAN Events (events)
  - **Matched Keywords:** wan
  - **Query Preview:** ``cisco_catalyst_app_index` sourcetype="cisco:sdwan:*" "$notification_search_tkn$"...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Security and Operational Events Distribution By Severity Over Time (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Cyber_Vision_Syslog_E...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Security Events by Severity (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Cyber_Vision_Syslog_E...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** All Security Events of "$syslog_severity$" Severity (table)
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Security Group Tag by Authentication (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events by ...`

- **Dashboard:** Overview
  - **Panel:** Top 10 Assets By Threat (chart)
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Overview
  - **Panel:** Top Policy Hits for SD-WAN (chart)
  - **Matched Keywords:** wan
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Security Insights
  - **Panel:** Malicious Files by Malware (chart)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset....`

- **Dashboard:** Security Insights
  - **Panel:** Malicious Files by Type (chart)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset....`

- **Dashboard:** Security Insights
  - **Panel:** URLs by Category (chart)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset....`

- **Dashboard:** Security Insights
  - **Panel:** Blocked Connections Over IPS event (chart)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset....`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$tkn_prevent_run_threat_details$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(_time) as Timestamp from datamodel=Cisco_Cataly...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$tkn_prevent_run_url_details$ | tstats `summariesonly` fillnull_value="N/A" count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Data...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$tkn_prevent_run_ips_details$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Ca...`

- **Dashboard:** Security Insights
  - **Panel:** SGACL - Top Sources (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_SG...`

- **Dashboard:** Security Insights
  - **Panel:** SGACL Events by Action (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count  from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_S...`

- **Dashboard:** Security Insights
  - **Panel:** ACL - Top Denied Sources (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_AC...`

- **Dashboard:** Security Insights
  - **Panel:** ACL - Top Denied Clients (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_AC...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Ci...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats summariesonly=false fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Datase...`

- **Dashboard:** Security Insights
  - **Panel:** Dropped FW Flows (table)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats fillnull_value="N/A" `summariesonly` count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Ci...`

- **Dashboard:** Security Insights
  - **Panel:** Inspected FW Flows (table)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats fillnull_value="N/A" `summariesonly` count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Ci...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats fillnull_value="N/A" `summariesonly` count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Ci...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Ne...`

- **Dashboard:** Security Insights
  - **Panel:** Device Compliance Status (chart)
  - **Query Preview:** `$Cisco Catalyst Center$ | tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Cataly...`

- **Dashboard:** Security Insights
  - **Panel:** Device Compliance State (chart)
  - **Query Preview:** `$Cisco Catalyst Center$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Compliance_...`

- **Dashboard:** Security Insights
  - **Panel:** Top 10 Vulnerabilities (chart)
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Vulnerabili...`

- **Dashboard:** Security Insights
  - **Panel:** Rogue Devices Count (single_value)
  - **Query Preview:** `| tstats `summariesonly` count as Count from datamodel=Cisco_Catalyst_App 
  where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Rogue_Events 
  by C...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$rogue_devices_detail$ | tstats fillnull_value="N/A" `summariesonly` count as "Count" values(Cisco_Catalyst_Dataset.Cisco_Catalyst_Rogue_Events.rogue_...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$run_vulnerabilities$ 
| tstats fillnull_value="N/A" `summariesonly` count as "Count" values(Cisco_Catalyst_Dataset.catalyst_vendor_product) as "Sourc...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$tkn_prevent_run_device_compliance_details$| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where node...`

- **Dashboard:** Security Insights
  - **Panel:** Security Advisory Details (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Security Insights
  - **Panel:** ISE Authentication Policy Chart (chart)
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** ISE Authorization Policy Chart (chart)
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** Security Events Occurred by Time (chart)
  - **Query Preview:** `| tstats `summariesonly` count as meraki_security_events_count
    from datamodel=Cisco_Catalyst_App 
    where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` count as Count from datamodel=Cisco_Catalyst_App 
  where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Security_Events 
  b...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Security Insights
  - **Panel:** SGACL Activities (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_SG...`

- **Dashboard:** Performance
  - **Panel:** Audit Logs for SD-WAN (table)
  - **Matched Keywords:** wan
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_SD...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Site Health (chart)
  - **Matched Keywords:** wan, site
  - **Query Preview:** `| tstats `summariesonly` latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_Site_Health_Events.sdwan_site_health_site_health) as "Site Health" from da...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Link Health (chart)
  - **Matched Keywords:** wan
  - **Query Preview:** `| tstats `summariesonly` count from datamodel=Cisco_Catalyst_App 
    where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_Link_Health
    by Ci...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Unified Threat Defense Health (chart)
  - **Matched Keywords:** wan
  - **Query Preview:** `| tstats `summariesonly` latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_UTD_Health.sdwan_utd_health_status) as "Admin Status" from datamodel=Cisco...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Tunnel Health (chart)
  - **Matched Keywords:** wan
  - **Query Preview:** `| tstats `summariesonly` count as Count latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_Tunnel_Health.sdwan_tunnel_health_health) as "Tunnel Health...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN SSE Tunnels (chart)
  - **Matched Keywords:** wan
  - **Query Preview:** `| tstats `summariesonly`  latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_Sig_Tunnel_State.sdwan_sig_tunnel_tunnel_status_local) as "Tunnel Status ...`

#### cisco_sna_app

- **Dashboard:** User Report
  - **Panel:** Security Index (table)
  - **Query Preview:** `|topalarming report_type=users domain_id=$domain_id$ smc_ip=$smc_ip$
            | where like(username, "$username$") | eval time_session_start=strfti...`

- **Dashboard:** Host Snapshot
  - **Panel:** Security Index (table)
  - **Query Preview:** `| where row_type="host_security_summary" | fields "security_concern_index", "security_target_index", "security_recon_index", "security_command_and_con...`

- **Dashboard:** Host Snapshot
  - **Panel:** Host is Source of Security Events (Most Recent) (table)
  - **Query Preview:** `| where row_type="host_security_events" and origin_list="source-list" | eval start_time=strftime(strptime(start_time."+0000","%Y-%m-%dT%H:%M:%SZ%z"),"...`

- **Dashboard:** Host Snapshot
  - **Panel:** Host is Target of Security Events (Most Recent) (table)
  - **Query Preview:** `| where row_type="host_security_events" and origin_list="target-list" | eval start_time=strftime(strptime(start_time."+0000","%Y-%m-%dT%H:%M:%SZ%z"),"...`

- **Dashboard:** Security Events
  - **Panel:** Top Security Event Types (chart)
  - **Query Preview:** `| rename "event_type_name" as "Security Event Type" | stats count by "Security Event Type"...`

- **Dashboard:** Security Events
  - **Panel:** Top Security Event Sources (chart)
  - **Query Preview:** `| where source_ip!="Multiple Hosts" and not like("$form.subject_ip$", "%" . source_ip . "%") and not like("$form.peer_ip$", "%" . source_ip . "%") | r...`

- **Dashboard:** Security Events
  - **Panel:** Top Security Event Targets (chart)
  - **Query Preview:** `| where target_ip!="Multiple Hosts" and not like("$form.subject_ip$", "%" . target_ip . "%") and not like("$form.peer_ip$", "%" . target_ip . "%") | r...`

- **Dashboard:** Security Events
  - **Panel:** Results (table)
  - **Query Preview:** `| sort 0 - ci_points | eval start_time=strftime(strptime(start_time."+0000","%Y-%m-%dT%H:%M:%SZ%z"),"%Y-%m-%d %H:%M:%S %Z") | eval last_time=strftime(...`

- **Dashboard:** Security Events
  - **Panel:** Untitled (table)

- **Dashboard:** Security Event Descriptions
  - **Panel:** Untitled (table)
  - **Query Preview:** `| sort 0 name | fields "name", "description" | rename "name" as "Name", "description" as "Description"...`

- **Dashboard:** Security Event Descriptions
  - **Panel:** Untitled (table)

---

### Requirement 31: Traffic stats (DIA vs SD-WAN vs SSE)

**Stated Visualization Support:** Yes

**Stated Supporting Apps:** Cisco Secure Network Analytics Add-on for Splunk, Cisco Enterprise Networking for Splunk Platform

**Matched Panels Found:** 85

#### Splunk_TA_cisco-ise

- **Dashboard:** Cisco ISE TA Troubleshooting Dashboard
  - **Panel:** Network Traffic (single_value)
  - **Matched Keywords:** traffic
  - **Query Preview:** `| pivot Network_Traffic All_Traffic count(All_Traffic) AS "Count of All Traffic" FILTER sourcetype is "cisco:ise:syslog" ROWSUMMARY 0 COLSUMMARY 0 SHO...`

#### Splunk_TA_cisco_meraki

- **Dashboard:** Appliance VPN Stats
  - **Panel:** Average Latency (single_value)
  - **Matched Keywords:** stats
  - **Query Preview:** ``meraki_index` sourcetype="meraki:appliancesdwanstatistics" $orgid$ 
| stats avg(merakiVpnPeers{}.latencySummaries{}.avgLatencyMs) as Average_Latency ...`

- **Dashboard:** Appliance VPN Stats
  - **Panel:** Average Loss (single_value)
  - **Matched Keywords:** stats
  - **Query Preview:** ``meraki_index` sourcetype="meraki:appliancesdwanstatistics" $orgid$ 
| stats avg(merakiVpnPeers{}.lossPercentageSummaries{}.avgLossPercentage) as Aver...`

- **Dashboard:** Appliance VPN Stats
  - **Panel:** VPN Metrics (table)
  - **Matched Keywords:** stats
  - **Query Preview:** ``meraki_index` sourcetype="meraki:appliancesdwanstatistics" $orgid$
| rename networkId as "Network ID", networkName as "Network Name", merakiVpnPeers{...`

- **Dashboard:** Appliance VPN Stats
  - **Panel:** Average Jitter (table)
  - **Matched Keywords:** stats
  - **Query Preview:** ``meraki_index` sourcetype="meraki:appliancesdwanstatistics" $orgid$ 
| rename merakiVpnPeers{}.jitterSummaries{}.senderUplink as "Sender Uplink", mera...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Network Port Speeds (table)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| rename ports{}.linkNegotiation.speed as port_speed, network.id as "Netwo...`

- **Dashboard:** Camera Data
  - **Panel:** Cameras Count By Network (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:cameras" $orgid$
| stats count as Count by networkId
| rename networkId as "Netrwork Id"...`

- **Dashboard:** Wireless Device Packet Loss
  - **Panel:** Packet Loss By Network (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicespacketlossbydevice" $orgid$ 
| eval direction = mvappend("downstream", "upstream") 
| mvexpand direct...`

- **Dashboard:** Top Switches
  - **Panel:** Top 10 Network by Energy Usage (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:summarytopswitchesbyenergyusage" $orgid$
| rename network.name as "Network Name" 
| stats sum(usage.total) as "Total...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Top 10 Network Uplinks (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename network.id as "Network Id"
| stats count as Count ...`

- **Dashboard:** Top Clients
  - **Panel:** Total Usage By Network (in MB) (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:summarytopclientsbyusage" $orgid$
| dedup id
| rename network.name as "Network Name"
| stats sum(usage.total) as "To...`

#### cisco-catalyst-app

- **Dashboard:** Overview Reports
  - **Panel:** Network Device Types (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Center_Reports.Cisco_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Audit Logs for SD-WAN (table)
  - **Matched Keywords:** wan
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Ci...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** SD-WAN Events (events)
  - **Matched Keywords:** wan
  - **Query Preview:** ``cisco_catalyst_app_index` sourcetype="cisco:sdwan:*" "$notification_search_tkn$"...`

- **Dashboard:** Overview
  - **Panel:** Top Policy Hits for SD-WAN (chart)
  - **Matched Keywords:** wan
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Overview
  - **Panel:** Network Health Score - $health_category$ (single_value)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Network_Health_Events...`

- **Dashboard:** Network Insights
  - **Panel:** Device Manageability Type (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Health_Events.device_health_managea...`

- **Dashboard:** Network Insights
  - **Panel:** Device Reachability Type (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Health_Events.device_health_reachab...`

- **Dashboard:** Network Insights
  - **Panel:** Device Family Type (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Health_Events.device_health_device_...`

- **Dashboard:** Network Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Network Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Network Insights
  - **Panel:** Network Devices By Type (table)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Type_Events Ci...`

- **Dashboard:** Network Insights
  - **Panel:** Top 10 Talkers (chart)
  - **Query Preview:** ``cisco_catalyst_app_index` sourcetype="cisco:cybervision:flows" | stats count by host...`

- **Dashboard:** Network Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Network Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** ``cisco_catalyst_app_index` sourcetype="cisco:cybervision:flows" host="$flows_host$"
                | rename left.label as Source, right.label as Dest...`

- **Dashboard:** Network Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events Cis...`

- **Dashboard:** Network Insights
  - **Panel:** ISE $authentication_latency_type$ Authentication Latency (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events
Cis...`

- **Dashboard:** Network Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Network Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events
   ...`

- **Dashboard:** Network Insights
  - **Panel:** ISE Top 10 Active Endpoints (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events Cis...`

- **Dashboard:** Network Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Network Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events Cis...`

- **Dashboard:** Network Insights
  - **Panel:** Top Networks with High Packet Loss (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App 
  where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst...`

- **Dashboard:** Network Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Network Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Packet_Loss_Details b...`

- **Dashboard:** Network Insights
  - **Panel:** Top 10 Offline Devices (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count 
  from datamodel=Cisco_Catalyst_App 
  where nodename=Cisco_Catalyst_Dataset.Cisco_Catal...`

- **Dashboard:** Network Compliance
  - **Panel:** Catalyst Center NonCompliant Total (single_value)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Center_Reports.Cisco_...`

- **Dashboard:** Network Compliance
  - **Panel:** Catalyst Center Inventory Total (single_value)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Center_Reports.Cisco_...`

- **Dashboard:** Network Compliance
  - **Panel:** NonCompliant Network Devices (table)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Center_Reports.Cisco_...`

- **Dashboard:** Network Compliance
  - **Panel:** Network Device Inventory (table)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename IN (Cisco_Catalyst_Dataset.Cisco_Catalyst_Center_Reports.Ci...`

- **Dashboard:** Performance
  - **Panel:** Network System Health (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count(Cisco_Catalyst_Dataset.Cisco_Catalyst_Network_Performance_Events.network_performance_account_id) f...`

- **Dashboard:** Performance
  - **Panel:** Network Latency (Seconds) (chart)
  - **Query Preview:** `| tstats `summariesonly` avg(Cisco_Catalyst_Dataset.Cisco_Catalyst_Network_Performance_Events.network_performance_network_latency) as avg_latency from...`

- **Dashboard:** Performance
  - **Panel:** Network Loss (Percentage) (chart)
  - **Query Preview:** `| tstats `summariesonly` avg(Cisco_Catalyst_Dataset.Cisco_Catalyst_Network_Performance_Events.network_performance_network_loss) as avg_loss from datam...`

- **Dashboard:** Performance
  - **Panel:** Network Jitter (Milliseconds) (chart)
  - **Query Preview:** `| tstats `summariesonly` avg(Cisco_Catalyst_Dataset.Cisco_Catalyst_Network_Performance_Events.network_performance_network_jitter) as avg_jitter from d...`

- **Dashboard:** Performance
  - **Panel:** Audit Logs for SD-WAN (table)
  - **Matched Keywords:** wan
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_SD...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Site Health (chart)
  - **Matched Keywords:** wan
  - **Query Preview:** `| tstats `summariesonly` latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_Site_Health_Events.sdwan_site_health_site_health) as "Site Health" from da...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Link Health (chart)
  - **Matched Keywords:** wan
  - **Query Preview:** `| tstats `summariesonly` count from datamodel=Cisco_Catalyst_App 
    where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_Link_Health
    by Ci...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Unified Threat Defense Health (chart)
  - **Matched Keywords:** wan
  - **Query Preview:** `| tstats `summariesonly` latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_UTD_Health.sdwan_utd_health_status) as "Admin Status" from datamodel=Cisco...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Tunnel Health (chart)
  - **Matched Keywords:** wan
  - **Query Preview:** `| tstats `summariesonly` count as Count latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_Tunnel_Health.sdwan_tunnel_health_health) as "Tunnel Health...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN SSE Tunnels (chart)
  - **Matched Keywords:** wan, sse
  - **Query Preview:** `| tstats `summariesonly`  latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_Sig_Tunnel_State.sdwan_sig_tunnel_tunnel_status_local) as "Tunnel Status ...`

#### cisco_sna_app

- **Dashboard:** Host Snapshot
  - **Panel:** Total Traffic (bytes): (single_value)
  - **Matched Keywords:** traffic
  - **Query Preview:** `| where row_type="host_traffic_summary" | fields "total_bytes"...`

- **Dashboard:** Host Snapshot
  - **Panel:** Traffic Summary (table)
  - **Matched Keywords:** traffic
  - **Query Preview:** `| where row_type="host_traffic" | sort 0 + "fc_name" | eval total_packets_received = tostring(total_packets_received, "commas"), total_packets_sent = ...`

- **Dashboard:** Host Snapshot
  - **Panel:** High Traffic Flows (table)
  - **Matched Keywords:** traffic
  - **Query Preview:** `| where row_type="host_flows" and origin_list="highest-traffic" | eval start_time=strftime(strptime(start_time."+0000","%Y-%m-%dT%H:%M:%SZ%z"),"%Y-%m-...`

- **Dashboard:** Flow Collection Trend
  - **Panel:** Latest Total FPS: (single_value)
  - **Query Preview:** `| where deviceId!="0" | sort 0 - time, + deviceName | dedup deviceId | stats sum(fps) as "total_fps" | eval total_fps = tostring(round(total_fps,0), "...`

- **Dashboard:** Flow Collection Trend
  - **Panel:** Average Total FPS: (single_value)
  - **Query Preview:** `| where deviceId!="0" | sort 0 + deviceName | stats avg(fps) as "avg_fps" by deviceId | stats sum(avg_fps) as "total_fps" | eval total_fps = tostring(...`

- **Dashboard:** Flow Collection Trend
  - **Panel:** Max Total FPS: (single_value)
  - **Query Preview:** `| where deviceId!="0" | sort 0 + deviceName | stats max(fps) as "max_fps" by deviceId | stats sum(max_fps) as "total_fps" | eval total_fps = tostring(...`

#### ta_cisco_thousandeyes

- **Dashboard:** Network
  - **Panel:** Untitled (table)

- **Dashboard:** Network
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` count(Test_Metrics.server.address)  as count  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc_group$ $tkn_age...`

- **Dashboard:** Network
  - **Panel:** Network Latency (Seconds) (single_value)
  - **Query Preview:** `| tstats `summariesonly` avg(Test_Metrics.metric_name:network.latency) as avg_latency  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc...`

- **Dashboard:** Network
  - **Panel:** Network Loss (Percentage) (single_value)
  - **Query Preview:** `| tstats `summariesonly` avg(Test_Metrics.metric_name:network.loss) as avg_loss  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc_group...`

- **Dashboard:** Network
  - **Panel:** Network Jitter (Milliseconds) (single_value)
  - **Query Preview:** `| tstats `summariesonly` avg(Test_Metrics.metric_name:network.jitter) as avg_jitter  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc_g...`

- **Dashboard:** Network
  - **Panel:** Network Latency (Seconds) (chart)
  - **Query Preview:** `| tstats `summariesonly` avg(Test_Metrics.metric_name:network.latency) as avg_latency  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc...`

- **Dashboard:** Network
  - **Panel:** Permalinks for $app_dd_1$ (table)
  - **Query Preview:** `| tstats `summariesonly` count(Test_Metrics.thousandeyes.permalink) as count   FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc_group$ ...`

- **Dashboard:** Network
  - **Panel:** Min Hops $app_dd_1$ (single_value)
  - **Query Preview:** `|tstats `summariesonly` min(Path_Viz.hops) as min  FROM datamodel="Cisco_ThousandEyes.Path_Viz" WHERE (Path_Viz.server="$app_dd_1$" OR Path_Viz.server...`

- **Dashboard:** Network
  - **Panel:** Network Loss (Percentage) (chart)
  - **Query Preview:** `| tstats `summariesonly` avg(Test_Metrics.metric_name:network.loss) as avg_loss  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc_group...`

- **Dashboard:** Network
  - **Panel:** Permalinks for $app_dd_2$ (table)
  - **Query Preview:** `| tstats `summariesonly` count(Test_Metrics.thousandeyes.permalink) as count  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc_group$ $...`

- **Dashboard:** Network
  - **Panel:** Min Hops for $app_dd_2$ (single_value)
  - **Query Preview:** `|tstats `summariesonly` min(Path_Viz.hops) as min  FROM datamodel="Cisco_ThousandEyes.Path_Viz" WHERE (Path_Viz.server="$app_dd_2$" OR Path_Viz.server...`

- **Dashboard:** Network
  - **Panel:** Network Jitter (Milliseconds) (chart)
  - **Query Preview:** `| tstats `summariesonly` avg(Test_Metrics.metric_name:network.jitter) as avg_jitter  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc_g...`

- **Dashboard:** Network
  - **Panel:** Permalinks for $app_dd_3$ (table)
  - **Query Preview:** `| tstats `summariesonly` count(Test_Metrics.thousandeyes.permalink) as count  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc_group$ $...`

- **Dashboard:** Network
  - **Panel:** Min Hops for $app_dd_3$ (single_value)
  - **Query Preview:** `|tstats `summariesonly` min(Path_Viz.hops) as min  FROM datamodel="Cisco_ThousandEyes.Path_Viz" WHERE (Path_Viz.server="$app_dd_3$" OR Path_Viz.server...`

- **Dashboard:** Network
  - **Panel:** Untitled (table)

- **Dashboard:** Network
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` count(Test_Metrics.thousandeyes.monitor.name)  as count  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc_grou...`

- **Dashboard:** Network
  - **Panel:** BGP Reachability (map)
  - **Query Preview:** `| tstats `summariesonly` latest(Test_Metrics.metric_name:bgp.reachability)  as count  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc_...`

- **Dashboard:** Network
  - **Panel:** BGP Path Changes Count (chart)
  - **Query Preview:** `| tstats `summariesonly` avg(Test_Metrics.metric_name:bgp.path_changes.count) as avg_change_count  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WH...`

- **Dashboard:** Network
  - **Panel:** Permalinks for $app_dd_4$ (table)
  - **Query Preview:** `| tstats `summariesonly` count(Test_Metrics.thousandeyes.permalink) as count FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc_group$  $...`

- **Dashboard:** Network
  - **Panel:** BGP Updates Count (chart)
  - **Query Preview:** `| tstats `summariesonly` avg(Test_Metrics.metric_name:bgp.updates.count) as avg_update_count  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $...`

- **Dashboard:** Network
  - **Panel:** Permalinks for $app_dd_5$ (table)
  - **Query Preview:** `| tstats `summariesonly` count(Test_Metrics.thousandeyes.permalink) as count FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc_group$  $...`

- **Dashboard:** Network
  - **Panel:** Untitled (table)

- **Dashboard:** Network
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` count(Test_Metrics.dns.question.name)  as count  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc_group$ $tkn_...`

- **Dashboard:** Network
  - **Panel:** DNS Availability (Percentage) (chart)
  - **Query Preview:** `| tstats `summariesonly` avg(Test_Metrics.metric_name:dns.lookup.availability) as avg_avail  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $t...`

- **Dashboard:** Network
  - **Panel:** Permalinks for $app_dd_6$ (table)
  - **Query Preview:** `| tstats `summariesonly` count(Test_Metrics.thousandeyes.permalink) as count FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc_group$ $t...`

- **Dashboard:** Network
  - **Panel:** DNS Duration (Seconds) (chart)
  - **Query Preview:** `| tstats `summariesonly` avg(Test_Metrics.metric_name:dns.lookup.duration) as avg_duration  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tk...`

- **Dashboard:** Network
  - **Panel:** Permalinks for $app_dd_7$ (table)
  - **Query Preview:** `| tstats `summariesonly` count(Test_Metrics.thousandeyes.permalink) as count  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc_group$ $...`

- **Dashboard:** Network
  - **Panel:** DNS Validity (Percentage) (chart)
  - **Query Preview:** `| tstats `summariesonly` avg(Test_Metrics.metric_name:dns.lookup.validity) as avg_valid  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_a...`

- **Dashboard:** Network
  - **Panel:** Permalinks for $app_dd_8$ (table)
  - **Query Preview:** `| tstats `summariesonly` count(Test_Metrics.thousandeyes.permalink) as count   FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc_group$ ...`

---

### Requirement 32: WiFi SSID view / security methods

**Stated Visualization Support:** Yes

**Stated Supporting Apps:** Splunk Add-on for Cisco Meraki

**Matched Panels Found:** 89

#### Splunk_TA_cisco_meraki

- **Dashboard:** Organizations Security
  - **Panel:** Blocked Alerts Count (chart)
  - **Matched Keywords:** security
  - **Query Preview:** ``meraki_index` sourcetype="meraki:organizationsecurity" $orgid$
| stats count as Count by blocked
| rename blocked as "Blocked"...`

- **Dashboard:** Organizations Security
  - **Panel:** Details of Alerts (table)
  - **Matched Keywords:** security
  - **Query Preview:** ``meraki_index` sourcetype="meraki:organizationsecurity" $orgid$
| rename eventType as "Event Type", deviceMac as "Device Mac", signature as "Signature...`

- **Dashboard:** Organizations Security
  - **Panel:** Alerts Over Time (chart)
  - **Matched Keywords:** security
  - **Query Preview:** ``meraki_index` sourcetype="meraki:organizationsecurity" $orgid$
| timechart count as "Alert Count" span=1d...`

- **Dashboard:** Access Point
  - **Panel:** Wireless Data Logs (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:accesspoints" $orgid$ 
| rename deviceName as "Device Name", deviceSerial as "Device Serial", category as "Category"...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Ethernet Port Statuses (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$ 
| dedup serial
| rename name as "Device Name", ports{}.name as "Ports Name...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Devices Without Power Connectivity (table)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename power.ac.isConnected as ac , power.poe.isConnected...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** POE Standard Distribution (chart)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename ports{}.poe.standard as "POE Standard"
| stats cou...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Ports Speed (chart)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename ports{}.linkNegotiation.speed as "Port Speed"
| st...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Wireless Device Ethernet Status | Aggregation Status (chart)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename aggregation.enabled as aggregation_enabled
| eval ...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Network Port Speeds (table)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| rename ports{}.linkNegotiation.speed as port_speed, network.id as "Netwo...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Networks with Most PoE Devices (chart)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename power.poe.isConnected as poe_connected, network.id...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Power Mode Distribution (chart)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename power.mode as "Power Mode"
| stats count by "Power...`

- **Dashboard:** Security Appliances
  - **Panel:** Appliance Security Events (table)
  - **Matched Keywords:** security
  - **Query Preview:** ``meraki_index` sourcetype="meraki:securityappliances" $orgid$ 
| dedup occurredAt, deviceSerial
|spath description
| rename eventData.summary as Summa...`

- **Dashboard:** Security Appliances
  - **Panel:** Categories of Data (chart)
  - **Matched Keywords:** security
  - **Query Preview:** ``meraki_index` sourcetype="meraki:securityappliances" $orgid$
| dedup occurredAt, deviceSerial
| stats count as Count by category
| sort - 0 Count
| r...`

- **Dashboard:** Security Appliances
  - **Panel:** Top Devices with IP Conflicts (table)
  - **Matched Keywords:** security
  - **Query Preview:** ``meraki_index` sourcetype="meraki:securityappliances" category="ip_conflicts" $orgid$
| dedup occurredAt, deviceSerial
| stats count as Count by devic...`

- **Dashboard:** Security Appliances
  - **Panel:** Security Events Occurred by Time (chart)
  - **Matched Keywords:** security
  - **Query Preview:** ``meraki_index` sourcetype="meraki:securityappliances" $orgid$
| dedup occurredAt, deviceSerial
| timechart count as "Events Occured" span=1d...`

- **Dashboard:** Wireless Device Packet Loss
  - **Panel:** Packet Loss By Network (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicespacketlossbydevice" $orgid$ 
| eval direction = mvappend("downstream", "upstream") 
| mvexpand direct...`

- **Dashboard:** Wireless Device Packet Loss
  - **Panel:** Total Packets v/s Lost Packets (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicespacketlossbydevice" $orgid$ 
| eval direction = mvappend("Downstream", "Upstream") 
| mvexpand direct...`

- **Dashboard:** Wireless Device Packet Loss
  - **Panel:** Top Networks with High Packet Loss (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicespacketlossbydevice" $orgid$ 
| rename upstream.lost as upstream_loss ,downstream.lost as downstream_l...`

#### cisco-catalyst-app

- **Dashboard:** Users And Applications
  - **Panel:** Top Users - Wired and Wireless (chart)
  - **Query Preview:** `| tstats `summariesonly`  count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_User_Events by Cisco...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Audit Logs for Cisco Meraki (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count 
  from datamodel=Cisco_Catalyst_App 
  where nodename=Cisco_Catalyst_Dataset.Cisco_Catal...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Security and Operational Events Distribution By Severity Over Time (chart)
  - **Matched Keywords:** security
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Cyber_Vision_Syslog_E...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Security Events by Severity (chart)
  - **Matched Keywords:** security
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Cyber_Vision_Syslog_E...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** All Security Events of "$syslog_severity$" Severity (table)
  - **Matched Keywords:** security
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Meraki Policy Sync (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events.ISE...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Wireless Signal Metrics (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events by ...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Security Group Tag by Authentication (chart)
  - **Matched Keywords:** security
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events by ...`

- **Dashboard:** Overview
  - **Panel:** Top 10 Assets By Threat (chart)
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Security Insights
  - **Panel:** Malicious Files by Malware (chart)
  - **Matched Keywords:** security
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset....`

- **Dashboard:** Security Insights
  - **Panel:** Malicious Files by Type (chart)
  - **Matched Keywords:** security
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset....`

- **Dashboard:** Security Insights
  - **Panel:** URLs by Category (chart)
  - **Matched Keywords:** security
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset....`

- **Dashboard:** Security Insights
  - **Panel:** Blocked Connections Over IPS event (chart)
  - **Matched Keywords:** security
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset....`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security
  - **Query Preview:** `$tkn_prevent_run_threat_details$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(_time) as Timestamp from datamodel=Cisco_Cataly...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security
  - **Query Preview:** `$tkn_prevent_run_url_details$ | tstats `summariesonly` fillnull_value="N/A" count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Data...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security
  - **Query Preview:** `$tkn_prevent_run_ips_details$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Ca...`

- **Dashboard:** Security Insights
  - **Panel:** SGACL - Top Sources (chart)
  - **Matched Keywords:** security
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_SG...`

- **Dashboard:** Security Insights
  - **Panel:** SGACL Events by Action (chart)
  - **Matched Keywords:** security
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count  from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_S...`

- **Dashboard:** Security Insights
  - **Panel:** ACL - Top Denied Sources (chart)
  - **Matched Keywords:** security
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_AC...`

- **Dashboard:** Security Insights
  - **Panel:** ACL - Top Denied Clients (chart)
  - **Matched Keywords:** security
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_AC...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Ci...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security
  - **Query Preview:** `$Cisco SD-WAN$ | tstats summariesonly=false fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Datase...`

- **Dashboard:** Security Insights
  - **Panel:** Dropped FW Flows (table)
  - **Matched Keywords:** security
  - **Query Preview:** `$Cisco SD-WAN$ | tstats fillnull_value="N/A" `summariesonly` count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Ci...`

- **Dashboard:** Security Insights
  - **Panel:** Inspected FW Flows (table)
  - **Matched Keywords:** security
  - **Query Preview:** `$Cisco SD-WAN$ | tstats fillnull_value="N/A" `summariesonly` count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Ci...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security
  - **Query Preview:** `$Cisco SD-WAN$ | tstats fillnull_value="N/A" `summariesonly` count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Ci...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Ne...`

- **Dashboard:** Security Insights
  - **Panel:** Device Compliance Status (chart)
  - **Matched Keywords:** security
  - **Query Preview:** `$Cisco Catalyst Center$ | tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Cataly...`

- **Dashboard:** Security Insights
  - **Panel:** Device Compliance State (chart)
  - **Matched Keywords:** security
  - **Query Preview:** `$Cisco Catalyst Center$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Compliance_...`

- **Dashboard:** Security Insights
  - **Panel:** Top 10 Vulnerabilities (chart)
  - **Matched Keywords:** security
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Vulnerabili...`

- **Dashboard:** Security Insights
  - **Panel:** Rogue Devices Count (single_value)
  - **Matched Keywords:** security
  - **Query Preview:** `| tstats `summariesonly` count as Count from datamodel=Cisco_Catalyst_App 
  where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Rogue_Events 
  by C...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security
  - **Query Preview:** `$rogue_devices_detail$ | tstats fillnull_value="N/A" `summariesonly` count as "Count" values(Cisco_Catalyst_Dataset.Cisco_Catalyst_Rogue_Events.rogue_...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security
  - **Query Preview:** `$run_vulnerabilities$ 
| tstats fillnull_value="N/A" `summariesonly` count as "Count" values(Cisco_Catalyst_Dataset.catalyst_vendor_product) as "Sourc...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security
  - **Query Preview:** `$tkn_prevent_run_device_compliance_details$| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where node...`

- **Dashboard:** Security Insights
  - **Panel:** Security Advisory Details (table)
  - **Matched Keywords:** security
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Security Insights
  - **Panel:** ISE Authentication Policy Chart (chart)
  - **Matched Keywords:** security
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** ISE Authorization Policy Chart (chart)
  - **Matched Keywords:** security
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** Security Events Occurred by Time (chart)
  - **Matched Keywords:** security
  - **Query Preview:** `| tstats `summariesonly` count as meraki_security_events_count
    from datamodel=Cisco_Catalyst_App 
    where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security
  - **Query Preview:** `| tstats `summariesonly` count as Count from datamodel=Cisco_Catalyst_App 
  where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Security_Events 
  b...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Security Insights
  - **Panel:** SGACL Activities (table)
  - **Matched Keywords:** security
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_SG...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** Client Health Score – Wired and Wireless (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Client_Inventory_And_...`

- **Dashboard:** Performance
  - **Panel:** Audit Logs for Cisco Meraki (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count 
  from datamodel=Cisco_Catalyst_App 
  where nodename=Cisco_Catalyst_Dataset.Cisco_Catal...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Unified Threat Defense Health (chart)
  - **Query Preview:** `| tstats `summariesonly` latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_UTD_Health.sdwan_utd_health_status) as "Admin Status" from datamodel=Cisco...`

#### cisco_sna_app

- **Dashboard:** User Report
  - **Panel:** Security Index (table)
  - **Matched Keywords:** security
  - **Query Preview:** `|topalarming report_type=users domain_id=$domain_id$ smc_ip=$smc_ip$
            | where like(username, "$username$") | eval time_session_start=strfti...`

- **Dashboard:** Host Snapshot
  - **Panel:** Security Index (table)
  - **Matched Keywords:** security
  - **Query Preview:** `| where row_type="host_security_summary" | fields "security_concern_index", "security_target_index", "security_recon_index", "security_command_and_con...`

- **Dashboard:** Host Snapshot
  - **Panel:** Host is Source of Security Events (Most Recent) (table)
  - **Matched Keywords:** security
  - **Query Preview:** `| where row_type="host_security_events" and origin_list="source-list" | eval start_time=strftime(strptime(start_time."+0000","%Y-%m-%dT%H:%M:%SZ%z"),"...`

- **Dashboard:** Host Snapshot
  - **Panel:** Host is Target of Security Events (Most Recent) (table)
  - **Matched Keywords:** security
  - **Query Preview:** `| where row_type="host_security_events" and origin_list="target-list" | eval start_time=strftime(strptime(start_time."+0000","%Y-%m-%dT%H:%M:%SZ%z"),"...`

- **Dashboard:** Security Events
  - **Panel:** Top Security Event Types (chart)
  - **Matched Keywords:** security
  - **Query Preview:** `| rename "event_type_name" as "Security Event Type" | stats count by "Security Event Type"...`

- **Dashboard:** Security Events
  - **Panel:** Top Security Event Sources (chart)
  - **Matched Keywords:** security
  - **Query Preview:** `| where source_ip!="Multiple Hosts" and not like("$form.subject_ip$", "%" . source_ip . "%") and not like("$form.peer_ip$", "%" . source_ip . "%") | r...`

- **Dashboard:** Security Events
  - **Panel:** Top Security Event Targets (chart)
  - **Matched Keywords:** security
  - **Query Preview:** `| where target_ip!="Multiple Hosts" and not like("$form.subject_ip$", "%" . target_ip . "%") and not like("$form.peer_ip$", "%" . target_ip . "%") | r...`

- **Dashboard:** Security Events
  - **Panel:** Results (table)
  - **Matched Keywords:** security
  - **Query Preview:** `| sort 0 - ci_points | eval start_time=strftime(strptime(start_time."+0000","%Y-%m-%dT%H:%M:%SZ%z"),"%Y-%m-%d %H:%M:%S %Z") | eval last_time=strftime(...`

- **Dashboard:** Security Events
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security

- **Dashboard:** Security Event Descriptions
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security
  - **Query Preview:** `| sort 0 name | fields "name", "description" | rename "name" as "Name", "description" as "Description"...`

- **Dashboard:** Security Event Descriptions
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security

---

### Requirement 33: WiFi auth methods (WPA2/3/Open)

**Stated Visualization Support:** Yes

**Stated Supporting Apps:** Splunk Add-on for Cisco Meraki

**Matched Panels Found:** 22

#### Splunk_TA_cisco_meraki

- **Dashboard:** Access Point
  - **Panel:** Wireless Data Logs (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:accesspoints" $orgid$ 
| rename deviceName as "Device Name", deviceSerial as "Device Serial", category as "Category"...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Ethernet Port Statuses (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$ 
| dedup serial
| rename name as "Device Name", ports{}.name as "Ports Name...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Devices Without Power Connectivity (table)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename power.ac.isConnected as ac , power.poe.isConnected...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** POE Standard Distribution (chart)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename ports{}.poe.standard as "POE Standard"
| stats cou...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Ports Speed (chart)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename ports{}.linkNegotiation.speed as "Port Speed"
| st...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Wireless Device Ethernet Status | Aggregation Status (chart)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename aggregation.enabled as aggregation_enabled
| eval ...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Network Port Speeds (table)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| rename ports{}.linkNegotiation.speed as port_speed, network.id as "Netwo...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Networks with Most PoE Devices (chart)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename power.poe.isConnected as poe_connected, network.id...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Power Mode Distribution (chart)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename power.mode as "Power Mode"
| stats count by "Power...`

- **Dashboard:** Wireless Device Packet Loss
  - **Panel:** Packet Loss By Network (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicespacketlossbydevice" $orgid$ 
| eval direction = mvappend("downstream", "upstream") 
| mvexpand direct...`

- **Dashboard:** Wireless Device Packet Loss
  - **Panel:** Total Packets v/s Lost Packets (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicespacketlossbydevice" $orgid$ 
| eval direction = mvappend("Downstream", "Upstream") 
| mvexpand direct...`

- **Dashboard:** Wireless Device Packet Loss
  - **Panel:** Top Networks with High Packet Loss (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicespacketlossbydevice" $orgid$ 
| rename upstream.lost as upstream_loss ,downstream.lost as downstream_l...`

#### TA-cisco-cloud-security-addon

- **Dashboard:** Open App
  - **Panel:** Untitled (table)
  - **Matched Keywords:** open

#### cisco-catalyst-app

- **Dashboard:** Users And Applications
  - **Panel:** Top Users - Wired and Wireless (chart)
  - **Query Preview:** `| tstats `summariesonly`  count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_User_Events by Cisco...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Audit Logs for Cisco Meraki (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count 
  from datamodel=Cisco_Catalyst_App 
  where nodename=Cisco_Catalyst_Dataset.Cisco_Catal...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Meraki Policy Sync (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events.ISE...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Wireless Signal Metrics (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events by ...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** Client Health Score – Wired and Wireless (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Client_Inventory_And_...`

- **Dashboard:** Performance
  - **Panel:** Auth Latency (RADIUS) (chart)
  - **Matched Keywords:** auth
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events.ISE...`

- **Dashboard:** Performance
  - **Panel:** Auth Latency (TACACS) (chart)
  - **Matched Keywords:** auth
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events.ISE...`

- **Dashboard:** Performance
  - **Panel:** Audit Logs for Cisco Meraki (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count 
  from datamodel=Cisco_Catalyst_App 
  where nodename=Cisco_Catalyst_Dataset.Cisco_Catal...`

#### cisco-cloud-security

- **Dashboard:** Open AddOn
  - **Panel:** Untitled (table)
  - **Matched Keywords:** open

---

### Requirement 34: WiFi guest access / policy / events

**Stated Visualization Support:** Yes

**Stated Supporting Apps:** Splunk Add-on for Cisco Meraki

**Matched Panels Found:** 94

#### Splunk_TA_cisco-ise

- **Dashboard:** Cisco ISE TA Troubleshooting Dashboard
  - **Panel:** Total number of Cisco ISE TA events (single_value)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats count where index IN `Cisco_ISE_Index` AND sourcetype="cisco:ise:syslog"...`

- **Dashboard:** Cisco ISE TA Troubleshooting Dashboard
  - **Panel:** Distributions of events by index (chart)
  - **Matched Keywords:** events
  - **Query Preview:** `index IN `Cisco_ISE_Index` sourcetype IN ("cisco:ise:syslog") | stats count by index...`

- **Dashboard:** Cisco ISE TA Troubleshooting Dashboard
  - **Panel:** Trends of events by index (table)
  - **Matched Keywords:** events
  - **Query Preview:** `index IN `Cisco_ISE_Index` sourcetype IN ("cisco:ise:syslog") | chart sparkline(count) AS "Indexes Trend" count AS Total BY index...`

- **Dashboard:** Cisco ISE TA Troubleshooting Dashboard
  - **Panel:** Events by sources (chart)
  - **Matched Keywords:** events
  - **Query Preview:** `index IN `Cisco_ISE_Index` sourcetype IN ("cisco:ise:syslog") | top source...`

- **Dashboard:** Cisco ISE TA Troubleshooting Dashboard
  - **Panel:** Events by sourcetypes (chart)
  - **Matched Keywords:** events
  - **Query Preview:** `index IN `Cisco_ISE_Index` sourcetype IN ("cisco:ise:syslog") | top sourcetype...`

#### Splunk_TA_cisco_meraki

- **Dashboard:** Access Point
  - **Panel:** Wireless Data Logs (table)
  - **Matched Keywords:** access
  - **Query Preview:** ``meraki_index` sourcetype="meraki:accesspoints" $orgid$ 
| rename deviceName as "Device Name", deviceSerial as "Device Serial", category as "Category"...`

- **Dashboard:** Access Point
  - **Panel:** Top Devices by RF Changes (table)
  - **Matched Keywords:** access
  - **Query Preview:** ``meraki_index` sourcetype="meraki:accesspoints" $orgid$ 
| dedup occurredAt, clientId
| spath type 
| search type="auto_rf_channel_change" 
| stats co...`

- **Dashboard:** Access Point
  - **Panel:** Most Common Channel Transition (table)
  - **Matched Keywords:** access
  - **Query Preview:** ``meraki_index` sourcetype="meraki:accesspoints" $orgid$
| dedup occurredAt, clientId
| stats count as "Count" by eventData.oldChan, eventData.newChan
...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Ethernet Port Statuses (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$ 
| dedup serial
| rename name as "Device Name", ports{}.name as "Ports Name...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Devices Without Power Connectivity (table)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename power.ac.isConnected as ac , power.poe.isConnected...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** POE Standard Distribution (chart)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename ports{}.poe.standard as "POE Standard"
| stats cou...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Ports Speed (chart)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename ports{}.linkNegotiation.speed as "Port Speed"
| st...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Wireless Device Ethernet Status | Aggregation Status (chart)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename aggregation.enabled as aggregation_enabled
| eval ...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Network Port Speeds (table)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| rename ports{}.linkNegotiation.speed as port_speed, network.id as "Netwo...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Networks with Most PoE Devices (chart)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename power.poe.isConnected as poe_connected, network.id...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Power Mode Distribution (chart)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename power.mode as "Power Mode"
| stats count by "Power...`

- **Dashboard:** Security Appliances
  - **Panel:** Appliance Security Events (table)
  - **Matched Keywords:** events
  - **Query Preview:** ``meraki_index` sourcetype="meraki:securityappliances" $orgid$ 
| dedup occurredAt, deviceSerial
|spath description
| rename eventData.summary as Summa...`

- **Dashboard:** Security Appliances
  - **Panel:** Security Events Occurred by Time (chart)
  - **Matched Keywords:** events
  - **Query Preview:** ``meraki_index` sourcetype="meraki:securityappliances" $orgid$
| dedup occurredAt, deviceSerial
| timechart count as "Events Occured" span=1d...`

- **Dashboard:** Camera Data
  - **Panel:** Camera Events by Type (chart)
  - **Matched Keywords:** events
  - **Query Preview:** ``meraki_index` sourcetype="meraki:cameras" $orgid$
| stats count as Count by type
| rename type as "Type"...`

- **Dashboard:** Wireless Device Packet Loss
  - **Panel:** Packet Loss By Network (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicespacketlossbydevice" $orgid$ 
| eval direction = mvappend("downstream", "upstream") 
| mvexpand direct...`

- **Dashboard:** Wireless Device Packet Loss
  - **Panel:** Total Packets v/s Lost Packets (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicespacketlossbydevice" $orgid$ 
| eval direction = mvappend("Downstream", "Upstream") 
| mvexpand direct...`

- **Dashboard:** Wireless Device Packet Loss
  - **Panel:** Top Networks with High Packet Loss (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicespacketlossbydevice" $orgid$ 
| rename upstream.lost as upstream_loss ,downstream.lost as downstream_l...`

#### cisco-catalyst-app

- **Dashboard:** Users And Applications
  - **Panel:** Top Users - Wired and Wireless (chart)
  - **Query Preview:** `| tstats `summariesonly`  count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_User_Events by Cisco...`

- **Dashboard:** Users And Applications
  - **Panel:** Guest Authentication (chart)
  - **Matched Keywords:** guest
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Top 10 Alarms (chart)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Alarm_Events Cisco_Ca...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Authentication Status (chart)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Alarm Hidden Panel (table)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats `summariesonly` count 
  from datamodel=Cisco_Catalyst_App 
  where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Alarm_Events 
  by Cisco_C...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** events

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** events

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** events
  - **Query Preview:** `$run_auth_action$ 
| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Data...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Number of Issues by Priority (chart)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Active_Issue_Events.active_issue_specific_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Number of Issues by Severity (chart)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Active_Issue_Events.active_issue_specific_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Number of Issues by Category (chart)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Active_Issue_Events.active_issue_specific_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** events

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Audit Logs for Cisco ISE (table)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Audit Logs for SD-WAN (table)
  - **Matched Keywords:** events
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Ci...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Audit Logs for Catalyst Center (table)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Audit Logs for Cisco Meraki (table)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count 
  from datamodel=Cisco_Catalyst_App 
  where nodename=Cisco_Catalyst_Dataset.Cisco_Catal...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Event Notifications for Cisco ISE (table)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Event_Notificati...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** SD-WAN Events (events)
  - **Matched Keywords:** events
  - **Query Preview:** ``cisco_catalyst_app_index` sourcetype="cisco:sdwan:*" "$notification_search_tkn$"...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Events By Severity for Cyber Vision (chart)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats `summariesonly` count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Cyber_Vision_Severity_Events by ...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** events

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Severity - $severity$ By Type (chart)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Events Of Type - $type$ And Severity - $severity$ (table)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Security and Operational Events Distribution By Severity Over Time (chart)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Cyber_Vision_Syslog_E...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** events

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Cyber_Vision_Syslog_E...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Security Events by Severity (chart)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Cyber_Vision_Syslog_E...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Operational Events by Severity (chart)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Cyber_Vision_Syslog_E...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** events

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (chart)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** All Security Events of "$syslog_severity$" Severity (table)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** events

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (chart)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** All Operational Events of "$syslog_operational_severity_panel$" Severity (table)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Cyber_Vision_Syslog_E...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Meraki Policy Sync (chart)
  - **Matched Keywords:** policy, events
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events.ISE...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** events

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Wireless Signal Metrics (chart)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events by ...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** events

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events by ...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Security Group Tag by Authentication (chart)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events by ...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** IP-SGT Bindings (chart)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_IP_SGT_Bindings by Ci...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** events

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as Count from datamodel=Cisco_Catalyst_App 
    where nodename=Cisco_Catalyst_Dataset.Cisco_Cataly...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** events

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats `summariesonly` values(Cisco_Catalyst_Dataset.Cisco_Catalyst_IP_SGT_Bindings.cisco_ip_sgt_source) as "Source" count as "Count" from datamodel...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Endpoint Purged (chart)
  - **Matched Keywords:** events
  - **Query Preview:** ``cisco_catalyst_app_index` sourcetype="cisco:ise:syslog" ObjectsPurged=* NOT ObjectsPurged=None vendor_product IN ($product$) | stats count by ise_ser...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** events

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** events
  - **Query Preview:** ``cisco_catalyst_app_index` sourcetype="cisco:ise:syslog" ObjectsPurged=* NOT ObjectsPurged=None vendor_product IN ($product$) ise_servername IN ($endp...`

- **Dashboard:** Overview
  - **Panel:** Top Policy Hits for SD-WAN (chart)
  - **Matched Keywords:** policy
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Overview
  - **Panel:** Top Policy Set Hits for Cisco ISE (chart)
  - **Matched Keywords:** policy
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Policy_Events by Cisc...`

- **Dashboard:** Overview
  - **Panel:** ISE Events Summary (chart)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats `summariesonly` count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events by _time, Cisc...`

- **Dashboard:** Security Insights
  - **Panel:** SGACL Events by Action (chart)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count  from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_S...`

- **Dashboard:** Security Insights
  - **Panel:** ISE Authentication Policy Chart (chart)
  - **Matched Keywords:** policy
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** ISE Authorization Policy Chart (chart)
  - **Matched Keywords:** policy
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** Security Events Occurred by Time (chart)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats `summariesonly` count as meraki_security_events_count
    from datamodel=Cisco_Catalyst_App 
    where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** Client Health Score – Wired and Wireless (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Client_Inventory_And_...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** Camera Events By Description (chart)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count 
  from datamodel=Cisco_Catalyst_App 
  where nodename=Cisco_Catalyst_Dataset.Cisco_Catal...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** Guest Endpoints (table)
  - **Matched Keywords:** guest
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Performance
  - **Panel:** Audit Logs for Cisco Meraki (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count 
  from datamodel=Cisco_Catalyst_App 
  where nodename=Cisco_Catalyst_Dataset.Cisco_Catal...`

#### cisco-cloud-security

- **Dashboard:** Access
  - **Panel:** Untitled (table)
  - **Matched Keywords:** access

#### cisco_sna_app

- **Dashboard:** Host Snapshot
  - **Panel:** Host is Source of Security Events (Most Recent) (table)
  - **Matched Keywords:** events
  - **Query Preview:** `| where row_type="host_security_events" and origin_list="source-list" | eval start_time=strftime(strptime(start_time."+0000","%Y-%m-%dT%H:%M:%SZ%z"),"...`

- **Dashboard:** Host Snapshot
  - **Panel:** Host is Target of Security Events (Most Recent) (table)
  - **Matched Keywords:** events
  - **Query Preview:** `| where row_type="host_security_events" and origin_list="target-list" | eval start_time=strftime(strptime(start_time."+0000","%Y-%m-%dT%H:%M:%SZ%z"),"...`

- **Dashboard:** Security Events
  - **Panel:** Top Security Event Types (chart)
  - **Matched Keywords:** events
  - **Query Preview:** `| rename "event_type_name" as "Security Event Type" | stats count by "Security Event Type"...`

- **Dashboard:** Security Events
  - **Panel:** Top Security Event Sources (chart)
  - **Matched Keywords:** events
  - **Query Preview:** `| where source_ip!="Multiple Hosts" and not like("$form.subject_ip$", "%" . source_ip . "%") and not like("$form.peer_ip$", "%" . source_ip . "%") | r...`

- **Dashboard:** Security Events
  - **Panel:** Top Security Event Targets (chart)
  - **Matched Keywords:** events
  - **Query Preview:** `| where target_ip!="Multiple Hosts" and not like("$form.subject_ip$", "%" . target_ip . "%") and not like("$form.peer_ip$", "%" . target_ip . "%") | r...`

- **Dashboard:** Security Events
  - **Panel:** Results (table)
  - **Matched Keywords:** events
  - **Query Preview:** `| sort 0 - ci_points | eval start_time=strftime(strptime(start_time."+0000","%Y-%m-%dT%H:%M:%SZ%z"),"%Y-%m-%d %H:%M:%S %Z") | eval last_time=strftime(...`

- **Dashboard:** Security Events
  - **Panel:** Untitled (table)
  - **Matched Keywords:** events

#### ta_cisco_thousandeyes

- **Dashboard:** Events
  - **Panel:** Untitled (table)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats `summariesonly` values(Events.id) as Id values(Events.aid) as aid values(Events.title) as Title values(Events.typeName) as "Type Name" values...`

---

### Requirement 35: Enforcement points (SGT location)

**Stated Visualization Support:** No

**Stated Supporting Apps:** Splunk Add-on for Cisco Identity Services

**Matched Panels Found:** 38

#### Splunk_TA_cisco-ise

- **Dashboard:** Cisco ISE TA Troubleshooting Dashboard
  - **Panel:** Cisco ISE TA version (single_value)
  - **Query Preview:** `| rest services/apps/local/Splunk_TA_cisco-ise splunk_server=local| fields version...`

- **Dashboard:** Cisco ISE TA Troubleshooting Dashboard
  - **Panel:** Total number of Cisco ISE TA events (single_value)
  - **Query Preview:** `| tstats count where index IN `Cisco_ISE_Index` AND sourcetype="cisco:ise:syslog"...`

- **Dashboard:** Cisco ISE TA Troubleshooting Dashboard
  - **Panel:** Event count (chart)
  - **Query Preview:** `index IN `Cisco_ISE_Index` sourcetype IN ("cisco:ise:syslog") | timechart span=12h count(_raw) as "Event count"...`

- **Dashboard:** Cisco ISE TA Troubleshooting Dashboard
  - **Panel:** Distributions of events by index (chart)
  - **Query Preview:** `index IN `Cisco_ISE_Index` sourcetype IN ("cisco:ise:syslog") | stats count by index...`

- **Dashboard:** Cisco ISE TA Troubleshooting Dashboard
  - **Panel:** Trends of events by index (table)
  - **Query Preview:** `index IN `Cisco_ISE_Index` sourcetype IN ("cisco:ise:syslog") | chart sparkline(count) AS "Indexes Trend" count AS Total BY index...`

- **Dashboard:** Cisco ISE TA Troubleshooting Dashboard
  - **Panel:** Events by sources (chart)
  - **Query Preview:** `index IN `Cisco_ISE_Index` sourcetype IN ("cisco:ise:syslog") | top source...`

- **Dashboard:** Cisco ISE TA Troubleshooting Dashboard
  - **Panel:** Events by sourcetypes (chart)
  - **Query Preview:** `index IN `Cisco_ISE_Index` sourcetype IN ("cisco:ise:syslog") | top sourcetype...`

- **Dashboard:** Cisco ISE TA Troubleshooting Dashboard
  - **Panel:** Untitled (table)

- **Dashboard:** Cisco ISE TA Troubleshooting Dashboard
  - **Panel:** Network Traffic (single_value)
  - **Query Preview:** `| pivot Network_Traffic All_Traffic count(All_Traffic) AS "Count of All Traffic" FILTER sourcetype is "cisco:ise:syslog" ROWSUMMARY 0 COLSUMMARY 0 SHO...`

- **Dashboard:** Cisco ISE TA Troubleshooting Dashboard
  - **Panel:** Authentication (single_value)
  - **Query Preview:** `index IN `Cisco_ISE_Index` sourcetype IN ("cisco:ise:syslog") tag IN ("authentication") | stats count AS total_count...`

- **Dashboard:** Cisco ISE TA Troubleshooting Dashboard
  - **Panel:** Change (single_value)
  - **Query Preview:** `index IN `Cisco_ISE_Index` sourcetype IN ("cisco:ise:syslog") tag IN ("change") | stats count AS total_count...`

- **Dashboard:** Cisco ISE TA Troubleshooting Dashboard
  - **Panel:** Alerts (single_value)
  - **Query Preview:** `| pivot Alerts Alerts count(Alerts) AS "Count of Alerts" FILTER sourcetype is "cisco:ise:syslog" ROWSUMMARY 0 COLSUMMARY 0 SHOWOTHER 1...`

- **Dashboard:** Cisco ISE TA Troubleshooting Dashboard
  - **Panel:** Inventory (single_value)
  - **Query Preview:** `| pivot Compute_Inventory All_Inventory count(All_Inventory) AS "Count of All Inventory" FILTER sourcetype is "cisco:ise:syslog" ROWSUMMARY 0 COLSUMMA...`

- **Dashboard:** Cisco ISE TA Troubleshooting Dashboard
  - **Panel:** Endpoint (single_value)
  - **Query Preview:** `| pivot Endpoint Services count(Services) AS "Count of Services" FILTER vendor_product in ("Cisco Identity Services Engine","Cisco Secure Access Contr...`

#### cisco-catalyst-app

- **Dashboard:** Overview Reports
  - **Panel:** Authentication By Location Map (map)
  - **Matched Keywords:** location
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events.ISE...`

- **Dashboard:** Users And Applications
  - **Panel:** Authentication By Location (chart)
  - **Matched Keywords:** location
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Users And Applications
  - **Panel:** User Identity Summary (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Audit Logs for Cisco ISE (table)
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Event Notifications for Cisco ISE (table)
  - **Query Preview:** `| tstats fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Event_Notificati...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Meraki Policy Sync (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events.ISE...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Security Group Tag by Authentication (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events by ...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** IP-SGT Bindings (chart)
  - **Matched Keywords:** sgt
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_IP_SGT_Bindings by Ci...`

- **Dashboard:** Overview
  - **Panel:** Top Policy Hits for SD-WAN (chart)
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Overview
  - **Panel:** Top Policy Set Hits for Cisco ISE (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Policy_Events by Cisc...`

- **Dashboard:** Overview
  - **Panel:** ISE Authentication Summary (chart)
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Overview
  - **Panel:** ISE Events Summary (chart)
  - **Query Preview:** `| tstats `summariesonly` count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events by _time, Cisc...`

- **Dashboard:** Security Insights
  - **Panel:** ISE Authentication Policy Chart (chart)
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** ISE Authorization Policy Chart (chart)
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Network Insights
  - **Panel:** ISE $authentication_latency_type$ Authentication Latency (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events
Cis...`

- **Dashboard:** Network Insights
  - **Panel:** ISE Top 10 Active Endpoints (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events Cis...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** Endpoint Identity Summary (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" 
  from datamodel=Cisco_Catalyst_App 
  where nodename=Cisco_Catalyst_Dataset.Cisco_Cat...`

- **Dashboard:** Performance
  - **Panel:** ISE System Health (table)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events by ...`

- **Dashboard:** Performance
  - **Panel:** Audit Logs for Cisco ISE (table)
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

#### cisco_sna_app

- **Dashboard:** Host Snapshot
  - **Panel:** Location: (table)
  - **Matched Keywords:** location
  - **Query Preview:** `| where row_type="host_geo" | fields "country_address", "country_name" | rename "country_address" as "Address", "country_name" as "Country"...`

- **Dashboard:** Host Snapshot
  - **Panel:** Identity Sessions (table)
  - **Query Preview:** `| where row_type="host_identity_session" | eval start_time=strftime(strptime(start_time."+0000","%Y-%m-%dT%H:%M:%SZ%z"),"%Y-%m-%d %H:%M:%S %Z") | sort...`

- **Dashboard:** Top Reports
  - **Panel:** Top Services by Bytes: (chart)
  - **Query Preview:** `| where rowType="results" and reportType="services" | rename "serviceName" as "Service" | chart values("bytes") as "Bytes" by "Service"...`

- **Dashboard:** Top Reports
  - **Panel:** Top Services by Packets: (chart)
  - **Query Preview:** `| where rowType="results" and reportType="services" | rename "serviceName" as "Service" | chart values("packets") as "Packets" by "Service"...`

- **Dashboard:** Top Reports
  - **Panel:** Top Services by Flows: (chart)
  - **Query Preview:** `| where rowType="results" and reportType="services" | rename "serviceName" as "Service" | chart values("flows") as "Flows" by "Service"...`

---

### Requirement 36: SGT matrix

**Stated Visualization Support:** No

**Stated Supporting Apps:** Splunk Add-on for Cisco Identity Services

**Matched Panels Found:** 2

#### cisco-catalyst-app

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Security Group Tag by Authentication (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events by ...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** IP-SGT Bindings (chart)
  - **Matched Keywords:** sgt
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_IP_SGT_Bindings by Ci...`

---

### Requirement 37: SGT capacity/utilization

**Stated Visualization Support:** No

**Stated Supporting Apps:** —

**Matched Panels Found:** 14

#### Splunk_TA_cisco_meraki

- **Dashboard:** Top Appliances
  - **Panel:** Appliances Utilization Over Time (chart)
  - **Matched Keywords:** utilization
  - **Query Preview:** ``meraki_index` sourcetype="meraki:summarytopappliancesbyutilization" $orgid$
| dedup utilization.average.percentage serial
| rename utilization.averag...`

#### TA_cisco_catalyst

- **Dashboard:** Splunk Resource Utilization
  - **Panel:** CPU Utilization (chart)
  - **Matched Keywords:** utilization
  - **Query Preview:** `| tstats count from datamodel=TA_Cisco_Catalyst_Resource_Utilization.Resource_Utilization_Introspection_Dataset where host IN ($host$) Resource_Utiliz...`

- **Dashboard:** Splunk Resource Utilization
  - **Panel:** Memory Utilization(%) (chart)
  - **Matched Keywords:** utilization
  - **Query Preview:** `| tstats count from datamodel=TA_Cisco_Catalyst_Resource_Utilization.Resource_Utilization_Introspection_Dataset where host IN ($host$) Resource_Utiliz...`

- **Dashboard:** Splunk Resource Utilization
  - **Panel:** Untitled (table)
  - **Matched Keywords:** utilization

- **Dashboard:** Splunk Resource Utilization
  - **Panel:** Untitled (table)
  - **Matched Keywords:** utilization

- **Dashboard:** Splunk Resource Utilization
  - **Panel:** Untitled (chart)
  - **Matched Keywords:** utilization
  - **Query Preview:** `| tstats count from datamodel=TA_Cisco_Catalyst_Resource_Utilization.Resource_Utilization_Introspection_Dataset where host IN ("*") Resource_Utilizati...`

- **Dashboard:** Splunk Resource Utilization
  - **Panel:** Untitled (chart)
  - **Matched Keywords:** utilization
  - **Query Preview:** `| tstats count from datamodel=TA_Cisco_Catalyst_Resource_Utilization.Resource_Utilization_Introspection_Dataset where host IN ("*") Resource_Utilizati...`

- **Dashboard:** Splunk Resource Utilization
  - **Panel:** Process Health (chart)
  - **Matched Keywords:** utilization
  - **Query Preview:** `index=_internal sourcetype IN ("splunktaciscocybervision:log", "splunktaciscodnacenter:log", "splunktaciscoise:log", "splunktaciscosdwan:log") host IN...`

- **Dashboard:** Splunk Resource Utilization
  - **Panel:** Health Monitoring by Input Connection (table)
  - **Matched Keywords:** utilization
  - **Query Preview:** `index=_internal sourcetype IN ("splunktaciscocybervision:log", "splunktaciscodnacenter:log", "splunktaciscoise:log", "splunktaciscosdwan:log") host IN...`

#### cisco-catalyst-app

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Security Group Tag by Authentication (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events by ...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** IP-SGT Bindings (chart)
  - **Matched Keywords:** sgt
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_IP_SGT_Bindings by Ci...`

- **Dashboard:** Performance
  - **Panel:** CPU Utilization % (chart)
  - **Matched Keywords:** utilization
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events.ISE...`

- **Dashboard:** Performance
  - **Panel:** Memory Utilization % (chart)
  - **Matched Keywords:** utilization
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events.ISE...`

- **Dashboard:** Performance
  - **Panel:** Bandwidth Utilization (chart)
  - **Matched Keywords:** utilization
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Bandwidth_Utilization...`

---

### Requirement 38: Traffic block trends / analysis

**Stated Visualization Support:** Yes

**Stated Supporting Apps:** Cisco Secure Network Analytics Add-on for Splunk

**Matched Panels Found:** 73

#### Splunk_TA_cisco-ise

- **Dashboard:** Cisco ISE TA Troubleshooting Dashboard
  - **Panel:** Trends of events by index (table)
  - **Matched Keywords:** trends
  - **Query Preview:** `index IN `Cisco_ISE_Index` sourcetype IN ("cisco:ise:syslog") | chart sparkline(count) AS "Indexes Trend" count AS Total BY index...`

- **Dashboard:** Cisco ISE TA Troubleshooting Dashboard
  - **Panel:** Network Traffic (single_value)
  - **Matched Keywords:** traffic
  - **Query Preview:** `| pivot Network_Traffic All_Traffic count(All_Traffic) AS "Count of All Traffic" FILTER sourcetype is "cisco:ise:syslog" ROWSUMMARY 0 COLSUMMARY 0 SHO...`

#### Splunk_TA_cisco_meraki

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Network Port Speeds (table)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| rename ports{}.linkNegotiation.speed as port_speed, network.id as "Netwo...`

- **Dashboard:** Camera Data
  - **Panel:** Cameras Count By Network (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:cameras" $orgid$
| stats count as Count by networkId
| rename networkId as "Netrwork Id"...`

- **Dashboard:** Wireless Device Packet Loss
  - **Panel:** Packet Loss By Network (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicespacketlossbydevice" $orgid$ 
| eval direction = mvappend("downstream", "upstream") 
| mvexpand direct...`

- **Dashboard:** Top Switches
  - **Panel:** Top 10 Network by Energy Usage (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:summarytopswitchesbyenergyusage" $orgid$
| rename network.name as "Network Name" 
| stats sum(usage.total) as "Total...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Top 10 Network Uplinks (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename network.id as "Network Id"
| stats count as Count ...`

- **Dashboard:** Top Clients
  - **Panel:** Total Usage By Network (in MB) (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:summarytopclientsbyusage" $orgid$
| dedup id
| rename network.name as "Network Name"
| stats sum(usage.total) as "To...`

#### cisco-catalyst-app

- **Dashboard:** Overview Reports
  - **Panel:** Network Device Types (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Center_Reports.Cisco_...`

- **Dashboard:** Overview
  - **Panel:** Network Health Score - $health_category$ (single_value)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Network_Health_Events...`

- **Dashboard:** Network Insights
  - **Panel:** Device Manageability Type (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Health_Events.device_health_managea...`

- **Dashboard:** Network Insights
  - **Panel:** Device Reachability Type (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Health_Events.device_health_reachab...`

- **Dashboard:** Network Insights
  - **Panel:** Device Family Type (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Health_Events.device_health_device_...`

- **Dashboard:** Network Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Network Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Network Insights
  - **Panel:** Network Devices By Type (table)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Type_Events Ci...`

- **Dashboard:** Network Insights
  - **Panel:** Top 10 Talkers (chart)
  - **Query Preview:** ``cisco_catalyst_app_index` sourcetype="cisco:cybervision:flows" | stats count by host...`

- **Dashboard:** Network Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Network Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** ``cisco_catalyst_app_index` sourcetype="cisco:cybervision:flows" host="$flows_host$"
                | rename left.label as Source, right.label as Dest...`

- **Dashboard:** Network Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events Cis...`

- **Dashboard:** Network Insights
  - **Panel:** ISE $authentication_latency_type$ Authentication Latency (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events
Cis...`

- **Dashboard:** Network Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Network Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events
   ...`

- **Dashboard:** Network Insights
  - **Panel:** ISE Top 10 Active Endpoints (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events Cis...`

- **Dashboard:** Network Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Network Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events Cis...`

- **Dashboard:** Network Insights
  - **Panel:** Top Networks with High Packet Loss (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App 
  where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst...`

- **Dashboard:** Network Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Network Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Packet_Loss_Details b...`

- **Dashboard:** Network Insights
  - **Panel:** Top 10 Offline Devices (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count 
  from datamodel=Cisco_Catalyst_App 
  where nodename=Cisco_Catalyst_Dataset.Cisco_Catal...`

- **Dashboard:** Network Compliance
  - **Panel:** Catalyst Center NonCompliant Total (single_value)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Center_Reports.Cisco_...`

- **Dashboard:** Network Compliance
  - **Panel:** Catalyst Center Inventory Total (single_value)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Center_Reports.Cisco_...`

- **Dashboard:** Network Compliance
  - **Panel:** NonCompliant Network Devices (table)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Center_Reports.Cisco_...`

- **Dashboard:** Network Compliance
  - **Panel:** Network Device Inventory (table)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename IN (Cisco_Catalyst_Dataset.Cisco_Catalyst_Center_Reports.Ci...`

- **Dashboard:** Performance
  - **Panel:** Network System Health (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count(Cisco_Catalyst_Dataset.Cisco_Catalyst_Network_Performance_Events.network_performance_account_id) f...`

- **Dashboard:** Performance
  - **Panel:** Network Latency (Seconds) (chart)
  - **Query Preview:** `| tstats `summariesonly` avg(Cisco_Catalyst_Dataset.Cisco_Catalyst_Network_Performance_Events.network_performance_network_latency) as avg_latency from...`

- **Dashboard:** Performance
  - **Panel:** Network Loss (Percentage) (chart)
  - **Query Preview:** `| tstats `summariesonly` avg(Cisco_Catalyst_Dataset.Cisco_Catalyst_Network_Performance_Events.network_performance_network_loss) as avg_loss from datam...`

- **Dashboard:** Performance
  - **Panel:** Network Jitter (Milliseconds) (chart)
  - **Query Preview:** `| tstats `summariesonly` avg(Cisco_Catalyst_Dataset.Cisco_Catalyst_Network_Performance_Events.network_performance_network_jitter) as avg_jitter from d...`

#### cisco_sna_app

- **Dashboard:** Host Snapshot
  - **Panel:** Total Traffic (bytes): (single_value)
  - **Matched Keywords:** traffic
  - **Query Preview:** `| where row_type="host_traffic_summary" | fields "total_bytes"...`

- **Dashboard:** Host Snapshot
  - **Panel:** Traffic Summary (table)
  - **Matched Keywords:** traffic
  - **Query Preview:** `| where row_type="host_traffic" | sort 0 + "fc_name" | eval total_packets_received = tostring(total_packets_received, "commas"), total_packets_sent = ...`

- **Dashboard:** Host Snapshot
  - **Panel:** High Traffic Flows (table)
  - **Matched Keywords:** traffic
  - **Query Preview:** `| where row_type="host_flows" and origin_list="highest-traffic" | eval start_time=strftime(strptime(start_time."+0000","%Y-%m-%dT%H:%M:%SZ%z"),"%Y-%m-...`

- **Dashboard:** Flow Collection Trend
  - **Panel:** Latest Total FPS: (single_value)
  - **Query Preview:** `| where deviceId!="0" | sort 0 - time, + deviceName | dedup deviceId | stats sum(fps) as "total_fps" | eval total_fps = tostring(round(total_fps,0), "...`

- **Dashboard:** Flow Collection Trend
  - **Panel:** Average Total FPS: (single_value)
  - **Query Preview:** `| where deviceId!="0" | sort 0 + deviceName | stats avg(fps) as "avg_fps" by deviceId | stats sum(avg_fps) as "total_fps" | eval total_fps = tostring(...`

- **Dashboard:** Flow Collection Trend
  - **Panel:** Max Total FPS: (single_value)
  - **Query Preview:** `| where deviceId!="0" | sort 0 + deviceName | stats max(fps) as "max_fps" by deviceId | stats sum(max_fps) as "total_fps" | eval total_fps = tostring(...`

#### ta_cisco_thousandeyes

- **Dashboard:** Network
  - **Panel:** Untitled (table)

- **Dashboard:** Network
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` count(Test_Metrics.server.address)  as count  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc_group$ $tkn_age...`

- **Dashboard:** Network
  - **Panel:** Network Latency (Seconds) (single_value)
  - **Query Preview:** `| tstats `summariesonly` avg(Test_Metrics.metric_name:network.latency) as avg_latency  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc...`

- **Dashboard:** Network
  - **Panel:** Network Loss (Percentage) (single_value)
  - **Query Preview:** `| tstats `summariesonly` avg(Test_Metrics.metric_name:network.loss) as avg_loss  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc_group...`

- **Dashboard:** Network
  - **Panel:** Network Jitter (Milliseconds) (single_value)
  - **Query Preview:** `| tstats `summariesonly` avg(Test_Metrics.metric_name:network.jitter) as avg_jitter  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc_g...`

- **Dashboard:** Network
  - **Panel:** Network Latency (Seconds) (chart)
  - **Query Preview:** `| tstats `summariesonly` avg(Test_Metrics.metric_name:network.latency) as avg_latency  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc...`

- **Dashboard:** Network
  - **Panel:** Permalinks for $app_dd_1$ (table)
  - **Query Preview:** `| tstats `summariesonly` count(Test_Metrics.thousandeyes.permalink) as count   FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc_group$ ...`

- **Dashboard:** Network
  - **Panel:** Min Hops $app_dd_1$ (single_value)
  - **Query Preview:** `|tstats `summariesonly` min(Path_Viz.hops) as min  FROM datamodel="Cisco_ThousandEyes.Path_Viz" WHERE (Path_Viz.server="$app_dd_1$" OR Path_Viz.server...`

- **Dashboard:** Network
  - **Panel:** Network Loss (Percentage) (chart)
  - **Query Preview:** `| tstats `summariesonly` avg(Test_Metrics.metric_name:network.loss) as avg_loss  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc_group...`

- **Dashboard:** Network
  - **Panel:** Permalinks for $app_dd_2$ (table)
  - **Query Preview:** `| tstats `summariesonly` count(Test_Metrics.thousandeyes.permalink) as count  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc_group$ $...`

- **Dashboard:** Network
  - **Panel:** Min Hops for $app_dd_2$ (single_value)
  - **Query Preview:** `|tstats `summariesonly` min(Path_Viz.hops) as min  FROM datamodel="Cisco_ThousandEyes.Path_Viz" WHERE (Path_Viz.server="$app_dd_2$" OR Path_Viz.server...`

- **Dashboard:** Network
  - **Panel:** Network Jitter (Milliseconds) (chart)
  - **Query Preview:** `| tstats `summariesonly` avg(Test_Metrics.metric_name:network.jitter) as avg_jitter  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc_g...`

- **Dashboard:** Network
  - **Panel:** Permalinks for $app_dd_3$ (table)
  - **Query Preview:** `| tstats `summariesonly` count(Test_Metrics.thousandeyes.permalink) as count  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc_group$ $...`

- **Dashboard:** Network
  - **Panel:** Min Hops for $app_dd_3$ (single_value)
  - **Query Preview:** `|tstats `summariesonly` min(Path_Viz.hops) as min  FROM datamodel="Cisco_ThousandEyes.Path_Viz" WHERE (Path_Viz.server="$app_dd_3$" OR Path_Viz.server...`

- **Dashboard:** Network
  - **Panel:** Untitled (table)

- **Dashboard:** Network
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` count(Test_Metrics.thousandeyes.monitor.name)  as count  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc_grou...`

- **Dashboard:** Network
  - **Panel:** BGP Reachability (map)
  - **Query Preview:** `| tstats `summariesonly` latest(Test_Metrics.metric_name:bgp.reachability)  as count  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc_...`

- **Dashboard:** Network
  - **Panel:** BGP Path Changes Count (chart)
  - **Query Preview:** `| tstats `summariesonly` avg(Test_Metrics.metric_name:bgp.path_changes.count) as avg_change_count  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WH...`

- **Dashboard:** Network
  - **Panel:** Permalinks for $app_dd_4$ (table)
  - **Query Preview:** `| tstats `summariesonly` count(Test_Metrics.thousandeyes.permalink) as count FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc_group$  $...`

- **Dashboard:** Network
  - **Panel:** BGP Updates Count (chart)
  - **Query Preview:** `| tstats `summariesonly` avg(Test_Metrics.metric_name:bgp.updates.count) as avg_update_count  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $...`

- **Dashboard:** Network
  - **Panel:** Permalinks for $app_dd_5$ (table)
  - **Query Preview:** `| tstats `summariesonly` count(Test_Metrics.thousandeyes.permalink) as count FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc_group$  $...`

- **Dashboard:** Network
  - **Panel:** Untitled (table)

- **Dashboard:** Network
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` count(Test_Metrics.dns.question.name)  as count  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc_group$ $tkn_...`

- **Dashboard:** Network
  - **Panel:** DNS Availability (Percentage) (chart)
  - **Query Preview:** `| tstats `summariesonly` avg(Test_Metrics.metric_name:dns.lookup.availability) as avg_avail  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $t...`

- **Dashboard:** Network
  - **Panel:** Permalinks for $app_dd_6$ (table)
  - **Query Preview:** `| tstats `summariesonly` count(Test_Metrics.thousandeyes.permalink) as count FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc_group$ $t...`

- **Dashboard:** Network
  - **Panel:** DNS Duration (Seconds) (chart)
  - **Query Preview:** `| tstats `summariesonly` avg(Test_Metrics.metric_name:dns.lookup.duration) as avg_duration  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tk...`

- **Dashboard:** Network
  - **Panel:** Permalinks for $app_dd_7$ (table)
  - **Query Preview:** `| tstats `summariesonly` count(Test_Metrics.thousandeyes.permalink) as count  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc_group$ $...`

- **Dashboard:** Network
  - **Panel:** DNS Validity (Percentage) (chart)
  - **Query Preview:** `| tstats `summariesonly` avg(Test_Metrics.metric_name:dns.lookup.validity) as avg_valid  FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_a...`

- **Dashboard:** Network
  - **Panel:** Permalinks for $app_dd_8$ (table)
  - **Query Preview:** `| tstats `summariesonly` count(Test_Metrics.thousandeyes.permalink) as count   FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE $tkn_acc_group$ ...`

---

### Requirement 39: Policy hits by site (campus/branch/DC)

**Stated Visualization Support:** Partial

**Stated Supporting Apps:** Cisco Secure Network Analytics Add-on for Splunk

**Matched Panels Found:** 6

#### cisco-catalyst-app

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Meraki Policy Sync (chart)
  - **Matched Keywords:** policy
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events.ISE...`

- **Dashboard:** Overview
  - **Panel:** Top Policy Hits for SD-WAN (chart)
  - **Matched Keywords:** policy, hits
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Overview
  - **Panel:** Top Policy Set Hits for Cisco ISE (chart)
  - **Matched Keywords:** policy, hits
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Policy_Events by Cisc...`

- **Dashboard:** Security Insights
  - **Panel:** ISE Authentication Policy Chart (chart)
  - **Matched Keywords:** policy
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** ISE Authorization Policy Chart (chart)
  - **Matched Keywords:** policy
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Site Health (chart)
  - **Matched Keywords:** site
  - **Query Preview:** `| tstats `summariesonly` latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_Site_Health_Events.sdwan_site_health_site_health) as "Site Health" from da...`

---

### Requirement 40: Site readiness

**Stated Visualization Support:** No

**Stated Supporting Apps:** —

**Matched Panels Found:** 1

#### cisco-catalyst-app

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Site Health (chart)
  - **Matched Keywords:** site
  - **Query Preview:** `| tstats `summariesonly` latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_Site_Health_Events.sdwan_site_health_site_health) as "Site Health" from da...`

---

### Requirement 41: Segmentation fabric (L2/L3 VNI, EPG/ESG)

**Stated Visualization Support:** No

**Stated Supporting Apps:** —

**Matched Panels Found:** 2

#### cisco-catalyst-app

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Security Group Tag by Authentication (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events by ...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** IP-SGT Bindings (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_IP_SGT_Bindings by Ci...`

---

### Requirement 42: Fabric stats (segments, groups, policies)

**Stated Visualization Support:** No

**Stated Supporting Apps:** —

**Matched Panels Found:** 4

#### Splunk_TA_cisco_meraki

- **Dashboard:** Appliance VPN Stats
  - **Panel:** Average Latency (single_value)
  - **Matched Keywords:** stats
  - **Query Preview:** ``meraki_index` sourcetype="meraki:appliancesdwanstatistics" $orgid$ 
| stats avg(merakiVpnPeers{}.latencySummaries{}.avgLatencyMs) as Average_Latency ...`

- **Dashboard:** Appliance VPN Stats
  - **Panel:** Average Loss (single_value)
  - **Matched Keywords:** stats
  - **Query Preview:** ``meraki_index` sourcetype="meraki:appliancesdwanstatistics" $orgid$ 
| stats avg(merakiVpnPeers{}.lossPercentageSummaries{}.avgLossPercentage) as Aver...`

- **Dashboard:** Appliance VPN Stats
  - **Panel:** VPN Metrics (table)
  - **Matched Keywords:** stats
  - **Query Preview:** ``meraki_index` sourcetype="meraki:appliancesdwanstatistics" $orgid$
| rename networkId as "Network ID", networkName as "Network Name", merakiVpnPeers{...`

- **Dashboard:** Appliance VPN Stats
  - **Panel:** Average Jitter (table)
  - **Matched Keywords:** stats
  - **Query Preview:** ``meraki_index` sourcetype="meraki:appliancesdwanstatistics" $orgid$ 
| rename merakiVpnPeers{}.jitterSummaries{}.senderUplink as "Sender Uplink", mera...`

---

### Requirement 43: FW device status / alerts by site

**Stated Visualization Support:** Yes

**Stated Supporting Apps:** Splunk Add-on for Cisco Meraki, Cisco Enterprise Networking for Splunk Platform

**Matched Panels Found:** 142

#### Splunk_TA_cisco-ise

- **Dashboard:** Cisco ISE TA Troubleshooting Dashboard
  - **Panel:** Alerts (single_value)
  - **Matched Keywords:** alerts
  - **Query Preview:** `| pivot Alerts Alerts count(Alerts) AS "Count of Alerts" FILTER sourcetype is "cisco:ise:syslog" ROWSUMMARY 0 COLSUMMARY 0 SHOWOTHER 1...`

#### Splunk_TA_cisco_meraki

- **Dashboard:** Organizations Security
  - **Panel:** Blocked Alerts Count (chart)
  - **Matched Keywords:** alerts
  - **Query Preview:** ``meraki_index` sourcetype="meraki:organizationsecurity" $orgid$
| stats count as Count by blocked
| rename blocked as "Blocked"...`

- **Dashboard:** Organizations Security
  - **Panel:** Details of Alerts (table)
  - **Matched Keywords:** alerts
  - **Query Preview:** ``meraki_index` sourcetype="meraki:organizationsecurity" $orgid$
| rename eventType as "Event Type", deviceMac as "Device Mac", signature as "Signature...`

- **Dashboard:** Organizations Security
  - **Panel:** Alerts Over Time (chart)
  - **Matched Keywords:** alerts
  - **Query Preview:** ``meraki_index` sourcetype="meraki:organizationsecurity" $orgid$
| timechart count as "Alert Count" span=1d...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Ethernet Port Statuses (table)
  - **Matched Keywords:** status
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$ 
| dedup serial
| rename name as "Device Name", ports{}.name as "Ports Name...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Devices Without Power Connectivity (table)
  - **Matched Keywords:** status
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename power.ac.isConnected as ac , power.poe.isConnected...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** POE Standard Distribution (chart)
  - **Matched Keywords:** status
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename ports{}.poe.standard as "POE Standard"
| stats cou...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Ports Speed (chart)
  - **Matched Keywords:** status
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename ports{}.linkNegotiation.speed as "Port Speed"
| st...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Wireless Device Ethernet Status | Aggregation Status (chart)
  - **Matched Keywords:** device, status
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename aggregation.enabled as aggregation_enabled
| eval ...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Network Port Speeds (table)
  - **Matched Keywords:** status
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| rename ports{}.linkNegotiation.speed as port_speed, network.id as "Netwo...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Networks with Most PoE Devices (chart)
  - **Matched Keywords:** status
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename power.poe.isConnected as poe_connected, network.id...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Power Mode Distribution (chart)
  - **Matched Keywords:** status
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename power.mode as "Power Mode"
| stats count by "Power...`

- **Dashboard:** Security Appliances
  - **Panel:** Appliance Security Events (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:securityappliances" $orgid$ 
| dedup occurredAt, deviceSerial
|spath description
| rename eventData.summary as Summa...`

- **Dashboard:** Security Appliances
  - **Panel:** Categories of Data (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:securityappliances" $orgid$
| dedup occurredAt, deviceSerial
| stats count as Count by category
| sort - 0 Count
| r...`

- **Dashboard:** Security Appliances
  - **Panel:** Top Devices with IP Conflicts (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:securityappliances" category="ip_conflicts" $orgid$
| dedup occurredAt, deviceSerial
| stats count as Count by devic...`

- **Dashboard:** Security Appliances
  - **Panel:** Security Events Occurred by Time (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:securityappliances" $orgid$
| dedup occurredAt, deviceSerial
| timechart count as "Events Occured" span=1d...`

- **Dashboard:** Device Availabilities Change History
  - **Panel:** Top 10 Networks By Device Changes (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesavailabilitieschangehistory" $orgid$ 
| dedup device.serial
| rename network.name as "Network Name" 
| stats ...`

- **Dashboard:** Device Availabilities Change History
  - **Panel:** Top 10 Offline Devices (table)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesavailabilitieschangehistory" $orgid$ details.new{}.value="offline" 
| dedup device.serial
| rename device.nam...`

- **Dashboard:** Device Availabilities Change History
  - **Panel:** Devices Availabilities Change History (table)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesavailabilitieschangehistory" $orgid$ 
| dedup device.serial
| rename details.new{}.value as "New Status", det...`

- **Dashboard:** Device Availabilities Change History
  - **Panel:** Device Status History Over Time (chart)
  - **Matched Keywords:** device, status
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesavailabilitieschangehistory" $orgid$ 
| dedup device.serial
| rename details.new{}.value as new_status 
| tim...`

- **Dashboard:** Top Devices
  - **Panel:** Device Usage Metrics (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:summarytopdevicesbyusage" $orgid$
| dedup name network.id usage.total usage.percentage
| rename name as "Device Name...`

- **Dashboard:** Top Devices
  - **Panel:** Top 10 Networks By Device Usage (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:summarytopdevicesbyusage" $orgid$
| dedup name network.id usage.total usage.percentage
| rename network.name as "Net...`

- **Dashboard:** Top Devices
  - **Panel:** Device Usage Over Time (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:summarytopdevicesbyusage" $orgid$
| dedup name network.id usage.total usage.percentage
| rename name as "Device Name...`

- **Dashboard:** Appliance VPN Statuses
  - **Panel:** VPN Status Data (table)
  - **Matched Keywords:** status
  - **Query Preview:** ``meraki_index` sourcetype="meraki:appliancesdwanstatuses" $orgid$ 
| rename networkName as "Network Name", deviceStatus as "Device Status", Subnet_Nam...`

- **Dashboard:** Wireless Device Packet Loss
  - **Panel:** Packet Loss By Network (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicespacketlossbydevice" $orgid$ 
| eval direction = mvappend("downstream", "upstream") 
| mvexpand direct...`

- **Dashboard:** Wireless Device Packet Loss
  - **Panel:** Total Packets v/s Lost Packets (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicespacketlossbydevice" $orgid$ 
| eval direction = mvappend("Downstream", "Upstream") 
| mvexpand direct...`

- **Dashboard:** Wireless Device Packet Loss
  - **Panel:** Top Networks with High Packet Loss (table)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicespacketlossbydevice" $orgid$ 
| rename upstream.lost as upstream_loss ,downstream.lost as downstream_l...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Total Alerts (single_value)
  - **Matched Keywords:** alerts
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$ 
| dedup id 
| stats count as "Alert Count"...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Alert Count by Severity (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$
| dedup id
| rename severity as "Severity"
| stats count as "Alert Count" by Severity...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Alert Data (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$ 
| dedup id
| rename id as "Alert Id", startedAt as "Alert Time" , categoryType as "Categor...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Top Affected Networks (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$
| dedup id
| rename network.name as "Network Name", severity as "Severity Level"
| stats co...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Top Affected Devices (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$ 
| dedup id 
| rename scope.devices{}.name as "Device Name", severity as "Severity Level" 
...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Devices Uplinks History (table)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename name as "Device Name", uplinks{}.interface as "Int...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Uplink Interface Distribution (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename uplinks{}.interface as "Uplink Interface" 
| stats...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Address Assignment Modes (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename uplinks{}.addresses{}.assignmentMode as "Assignmen...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Protocol Distribution (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename uplinks{}.addresses{}.protocol as "Address Protoco...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Most Frequent Public Addresses (table)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$
| dedup serial
| rename uplinks{}.addresses{}.public.address as "Public Add...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Most Frequent Gateway IPs (table)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename uplinks{}.addresses{}.gateway as "Gateway" 
| stat...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Top 10 DNS Servers (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$
| dedup serial
| rename uplinks{}.addresses{}.nameservers.addresses{} as "D...`

- **Dashboard:** Device Uplink Addresses
  - **Panel:** Top 10 Network Uplinks (chart)
  - **Matched Keywords:** device
  - **Query Preview:** ``meraki_index` sourcetype="meraki:devicesuplinksaddressesbydevice" $orgid$ 
| dedup serial
| rename network.id as "Network Id"
| stats count as Count ...`

#### TA_cisco_catalyst

- **Dashboard:** Splunk Resource Utilization
  - **Panel:** Process Health (chart)
  - **Query Preview:** `index=_internal sourcetype IN ("splunktaciscocybervision:log", "splunktaciscodnacenter:log", "splunktaciscoise:log", "splunktaciscosdwan:log") host IN...`

- **Dashboard:** Splunk Resource Utilization
  - **Panel:** Health Monitoring by Input Connection (table)
  - **Query Preview:** `index=_internal sourcetype IN ("splunktaciscocybervision:log", "splunktaciscodnacenter:log", "splunktaciscoise:log", "splunktaciscosdwan:log") host IN...`

#### cisco-catalyst-app

- **Dashboard:** Overview Reports
  - **Panel:** Network Device Types (chart)
  - **Matched Keywords:** device
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Center_Reports.Cisco_...`

- **Dashboard:** Sensors
  - **Panel:** Door Sensor Status - Latest Readings (chart)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" 
    from datamodel=Cisco_Catalyst_App 
    where nodename=Cisco_Catalyst_Dataset.Cisco...`

- **Dashboard:** Users And Applications
  - **Panel:** User Authentication Status (table)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Authentication Status (chart)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Security and Operational Events Distribution By Severity Over Time (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Cyber_Vision_Syslog_E...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Security Events by Severity (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Cyber_Vision_Syslog_E...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** All Security Events of "$syslog_severity$" Severity (table)
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Security Group Tag by Authentication (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events by ...`

- **Dashboard:** Overview
  - **Panel:** Top 10 Assets By Threat (chart)
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Overview
  - **Panel:** $client_type_health$ Clients Health Score (single_value)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Client_Inventory_And_...`

- **Dashboard:** Overview
  - **Panel:** Network Health Score - $health_category$ (single_value)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Network_Health_Events...`

- **Dashboard:** Security Insights
  - **Panel:** Malicious Files by Malware (chart)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset....`

- **Dashboard:** Security Insights
  - **Panel:** Malicious Files by Type (chart)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset....`

- **Dashboard:** Security Insights
  - **Panel:** URLs by Category (chart)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset....`

- **Dashboard:** Security Insights
  - **Panel:** Blocked Connections Over IPS event (chart)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset....`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$tkn_prevent_run_threat_details$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(_time) as Timestamp from datamodel=Cisco_Cataly...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$tkn_prevent_run_url_details$ | tstats `summariesonly` fillnull_value="N/A" count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Data...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$tkn_prevent_run_ips_details$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Ca...`

- **Dashboard:** Security Insights
  - **Panel:** SGACL - Top Sources (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_SG...`

- **Dashboard:** Security Insights
  - **Panel:** SGACL Events by Action (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count  from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_S...`

- **Dashboard:** Security Insights
  - **Panel:** ACL - Top Denied Sources (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_AC...`

- **Dashboard:** Security Insights
  - **Panel:** ACL - Top Denied Clients (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_AC...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Ci...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats summariesonly=false fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Datase...`

- **Dashboard:** Security Insights
  - **Panel:** Dropped FW Flows (table)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats fillnull_value="N/A" `summariesonly` count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Ci...`

- **Dashboard:** Security Insights
  - **Panel:** Inspected FW Flows (table)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats fillnull_value="N/A" `summariesonly` count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Ci...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats fillnull_value="N/A" `summariesonly` count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Ci...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Ne...`

- **Dashboard:** Security Insights
  - **Panel:** Device Compliance Status (chart)
  - **Matched Keywords:** device, status
  - **Query Preview:** `$Cisco Catalyst Center$ | tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Cataly...`

- **Dashboard:** Security Insights
  - **Panel:** Device Compliance State (chart)
  - **Matched Keywords:** device
  - **Query Preview:** `$Cisco Catalyst Center$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Compliance_...`

- **Dashboard:** Security Insights
  - **Panel:** Top 10 Vulnerabilities (chart)
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Vulnerabili...`

- **Dashboard:** Security Insights
  - **Panel:** Rogue Devices Count (single_value)
  - **Query Preview:** `| tstats `summariesonly` count as Count from datamodel=Cisco_Catalyst_App 
  where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Rogue_Events 
  by C...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$rogue_devices_detail$ | tstats fillnull_value="N/A" `summariesonly` count as "Count" values(Cisco_Catalyst_Dataset.Cisco_Catalyst_Rogue_Events.rogue_...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$run_vulnerabilities$ 
| tstats fillnull_value="N/A" `summariesonly` count as "Count" values(Cisco_Catalyst_Dataset.catalyst_vendor_product) as "Sourc...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$tkn_prevent_run_device_compliance_details$| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where node...`

- **Dashboard:** Security Insights
  - **Panel:** Security Advisory Details (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Security Insights
  - **Panel:** ISE Authentication Policy Chart (chart)
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** ISE Authorization Policy Chart (chart)
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** Security Events Occurred by Time (chart)
  - **Query Preview:** `| tstats `summariesonly` count as meraki_security_events_count
    from datamodel=Cisco_Catalyst_App 
    where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` count as Count from datamodel=Cisco_Catalyst_App 
  where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Security_Events 
  b...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Security Insights
  - **Panel:** SGACL Activities (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_SG...`

- **Dashboard:** Endpoint Compliance
  - **Panel:** Posture Status Trend Over Time (chart)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events.ISE...`

- **Dashboard:** Network Insights
  - **Panel:** Device Manageability Type (chart)
  - **Matched Keywords:** device
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Health_Events.device_health_managea...`

- **Dashboard:** Network Insights
  - **Panel:** Device Reachability Type (chart)
  - **Matched Keywords:** device
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Health_Events.device_health_reachab...`

- **Dashboard:** Network Insights
  - **Panel:** Device Family Type (chart)
  - **Matched Keywords:** device
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Health_Events.device_health_device_...`

- **Dashboard:** Step 1 Device Classification
  - **Panel:** C2C-0.1.0 Reporting - USCYBERCOM Device Category (chart)
  - **Matched Keywords:** device
  - **Query Preview:** `| inputlookup cisco_catalyst_analytics_reports.csv
| eval filteredCybercom=mvfilter(match(cybercomCategory, `cisco_catalyst_CYBERCOM_Macro`) OR match(...`

- **Dashboard:** Step 1 Device Classification
  - **Panel:** C2C-0.1.1 Reporting - Operating System Summary (chart)
  - **Matched Keywords:** device
  - **Query Preview:** `| inputlookup cisco_catalyst_analytics_reports.csv
| stats count by MatchedPolicy
| sort 0 -count
| rename MatchedPolicy as "Operating System", count ...`

- **Dashboard:** Step 1 Device Classification
  - **Panel:** Untitled (table)
  - **Matched Keywords:** device
  - **Query Preview:** `| inputlookup cisco_catalyst_analytics_reports.csv
| eval filteredCybercom=mvfilter(match(cybercomCategory, `cisco_catalyst_CYBERCOM_Macro`) OR match(...`

- **Dashboard:** Step 1 Device Classification
  - **Panel:** Untitled (table)
  - **Matched Keywords:** device
  - **Query Preview:** `| inputlookup cisco_catalyst_analytics_reports.csv
| stats count by MatchedPolicy
| sort 0 -count
| rename MatchedPolicy as "Operating System", count ...`

- **Dashboard:** Network Compliance
  - **Panel:** Network Device Inventory (table)
  - **Matched Keywords:** device
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename IN (Cisco_Catalyst_Dataset.Cisco_Catalyst_Center_Reports.Ci...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** Client Health Score – Wired and Wireless (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Client_Inventory_And_...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** Endpoint Authentication Status (table)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** BYOD Device Enrollment (table)
  - **Matched Keywords:** device
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Performance
  - **Panel:** ISE System Health (table)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events by ...`

- **Dashboard:** Performance
  - **Panel:** Network System Health (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count(Cisco_Catalyst_Dataset.Cisco_Catalyst_Network_Performance_Events.network_performance_account_id) f...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Site Health (chart)
  - **Matched Keywords:** site
  - **Query Preview:** `| tstats `summariesonly` latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_Site_Health_Events.sdwan_site_health_site_health) as "Site Health" from da...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Link Health (chart)
  - **Query Preview:** `| tstats `summariesonly` count from datamodel=Cisco_Catalyst_App 
    where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_Link_Health
    by Ci...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Unified Threat Defense Health (chart)
  - **Query Preview:** `| tstats `summariesonly` latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_UTD_Health.sdwan_utd_health_status) as "Admin Status" from datamodel=Cisco...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Tunnel Health (chart)
  - **Query Preview:** `| tstats `summariesonly` count as Count latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_Tunnel_Health.sdwan_tunnel_health_health) as "Tunnel Health...`

#### cisco-cloud-security

- **Dashboard:** Alerts Dashboard
  - **Panel:** Untitled (table)
  - **Matched Keywords:** alerts

#### cisco_sna_app

- **Dashboard:** User Report
  - **Panel:** Security Index (table)
  - **Query Preview:** `|topalarming report_type=users domain_id=$domain_id$ smc_ip=$smc_ip$
            | where like(username, "$username$") | eval time_session_start=strfti...`

- **Dashboard:** Host Snapshot
  - **Panel:** Status: (table)
  - **Matched Keywords:** status
  - **Query Preview:** `| where row_type="host_status" | eval status_first_seen=strftime(strptime(status_first_seen."+0000","%Y-%m-%dT%H:%M:%SZ%z"),"%Y-%m-%d %H:%M:%S %Z") | ...`

- **Dashboard:** Host Snapshot
  - **Panel:** Security Index (table)
  - **Query Preview:** `| where row_type="host_security_summary" | fields "security_concern_index", "security_target_index", "security_recon_index", "security_command_and_con...`

- **Dashboard:** Host Snapshot
  - **Panel:** Host is Source of Security Events (Most Recent) (table)
  - **Query Preview:** `| where row_type="host_security_events" and origin_list="source-list" | eval start_time=strftime(strptime(start_time."+0000","%Y-%m-%dT%H:%M:%SZ%z"),"...`

- **Dashboard:** Host Snapshot
  - **Panel:** Host is Target of Security Events (Most Recent) (table)
  - **Query Preview:** `| where row_type="host_security_events" and origin_list="target-list" | eval start_time=strftime(strptime(start_time."+0000","%Y-%m-%dT%H:%M:%SZ%z"),"...`

- **Dashboard:** Security Events
  - **Panel:** Top Security Event Types (chart)
  - **Query Preview:** `| rename "event_type_name" as "Security Event Type" | stats count by "Security Event Type"...`

- **Dashboard:** Security Events
  - **Panel:** Top Security Event Sources (chart)
  - **Query Preview:** `| where source_ip!="Multiple Hosts" and not like("$form.subject_ip$", "%" . source_ip . "%") and not like("$form.peer_ip$", "%" . source_ip . "%") | r...`

- **Dashboard:** Security Events
  - **Panel:** Top Security Event Targets (chart)
  - **Query Preview:** `| where target_ip!="Multiple Hosts" and not like("$form.subject_ip$", "%" . target_ip . "%") and not like("$form.peer_ip$", "%" . target_ip . "%") | r...`

- **Dashboard:** Security Events
  - **Panel:** Results (table)
  - **Query Preview:** `| sort 0 - ci_points | eval start_time=strftime(strptime(start_time."+0000","%Y-%m-%dT%H:%M:%SZ%z"),"%Y-%m-%d %H:%M:%S %Z") | eval last_time=strftime(...`

- **Dashboard:** Security Events
  - **Panel:** Untitled (table)

- **Dashboard:** Security Event Descriptions
  - **Panel:** Untitled (table)
  - **Query Preview:** `| sort 0 name | fields "name", "description" | rename "name" as "Name", "description" as "Description"...`

- **Dashboard:** Security Event Descriptions
  - **Panel:** Untitled (table)

#### ta_cisco_thousandeyes

- **Dashboard:** Alerts
  - **Panel:** Untitled (table)
  - **Matched Keywords:** alerts
  - **Query Preview:** `| tstats `summariesonly` count, values(Alerts.triggerTime) as triggerTime, values(Alerts.accountId) as accountId, values(Alerts.organizationId) as org...`

- **Dashboard:** Alerts
  - **Panel:** Alerts Summary by Severity (chart)
  - **Matched Keywords:** alerts
  - **Query Preview:** `| tstats `summariesonly` count FROM datamodel="Cisco_ThousandEyes.Alerts" WHERE $tkn_acc_group$ $tkn_severity$ $tkn_test_type$ BY Alerts.severity | re...`

- **Dashboard:** Alerts
  - **Panel:** Alerts Timeline (chart)
  - **Matched Keywords:** alerts
  - **Query Preview:** `| tstats `summariesonly` count FROM datamodel="Cisco_ThousandEyes.Alerts" WHERE $tkn_acc_group$ $tkn_severity$ $tkn_test_type$ BY Alerts.severity _tim...`

- **Dashboard:** Data collection Status
  - **Panel:** Number of Streams (single_value)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` dc(Test_Metrics.thousandeyes.stream.id) as count FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE Test_Metrics.thousand...`

- **Dashboard:** Data collection Status
  - **Panel:** Untitled (table)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` count(Test_Metrics.thousandeyes.stream.id) FROM datamodel="Cisco_ThousandEyes.Test_Metrics"  WHERE Test_Metrics.thousandeyes....`

- **Dashboard:** Data collection Status
  - **Panel:** Number of Cloud & Enterprise Agent Tests and Endpoint Agent Tests (single_value)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` dc(Test_Metrics.thousandeyes.test.id) as count FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE Test_Metrics.thousandey...`

- **Dashboard:** Data collection Status
  - **Panel:** Untitled (table)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` values(Test_Metrics.thousandeyes.test.type) as "Test Types" values(Test_Metrics.thousandeyes.test.name) as "Test Name" FROM d...`

- **Dashboard:** Data collection Status
  - **Panel:** Number of Event Inputs (single_value)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` dc(source) as count FROM datamodel="Cisco_ThousandEyes.Events"  WHERE Events.aid IN($tkn_acc_group$)...`

- **Dashboard:** Data collection Status
  - **Panel:** Untitled (table)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` latest(_time) as time FROM datamodel="Cisco_ThousandEyes.Events"  WHERE Events.aid IN($tkn_acc_group$) BY source | eval sourc...`

- **Dashboard:** Data collection Status
  - **Panel:** Number of Activity Inputs (single_value)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` dc(source) as count FROM datamodel="Cisco_ThousandEyes.Activities"  WHERE Activities.aid IN($tkn_acc_group$)...`

- **Dashboard:** Data collection Status
  - **Panel:** Untitled (table)
  - **Matched Keywords:** status
  - **Query Preview:** `| tstats `summariesonly` latest(_time) as time FROM datamodel="Cisco_ThousandEyes.Activities"  WHERE Activities.aid IN($tkn_acc_group$) BY source | ev...`

---

### Requirement 44: FW threat blocks / trends

**Stated Visualization Support:** Yes

**Stated Supporting Apps:** Cisco Secure Network Analytics Add-on for Splunk

**Matched Panels Found:** 72

#### Splunk_TA_cisco-ise

- **Dashboard:** Cisco ISE TA Troubleshooting Dashboard
  - **Panel:** Trends of events by index (table)
  - **Matched Keywords:** trends
  - **Query Preview:** `index IN `Cisco_ISE_Index` sourcetype IN ("cisco:ise:syslog") | chart sparkline(count) AS "Indexes Trend" count AS Total BY index...`

#### Splunk_TA_cisco_meraki

- **Dashboard:** Organizations Security
  - **Panel:** Blocked Alerts Count (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:organizationsecurity" $orgid$
| stats count as Count by blocked
| rename blocked as "Blocked"...`

- **Dashboard:** Organizations Security
  - **Panel:** Details of Alerts (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:organizationsecurity" $orgid$
| rename eventType as "Event Type", deviceMac as "Device Mac", signature as "Signature...`

- **Dashboard:** Organizations Security
  - **Panel:** Alerts Over Time (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:organizationsecurity" $orgid$
| timechart count as "Alert Count" span=1d...`

- **Dashboard:** Security Appliances
  - **Panel:** Appliance Security Events (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:securityappliances" $orgid$ 
| dedup occurredAt, deviceSerial
|spath description
| rename eventData.summary as Summa...`

- **Dashboard:** Security Appliances
  - **Panel:** Categories of Data (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:securityappliances" $orgid$
| dedup occurredAt, deviceSerial
| stats count as Count by category
| sort - 0 Count
| r...`

- **Dashboard:** Security Appliances
  - **Panel:** Top Devices with IP Conflicts (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:securityappliances" category="ip_conflicts" $orgid$
| dedup occurredAt, deviceSerial
| stats count as Count by devic...`

- **Dashboard:** Security Appliances
  - **Panel:** Security Events Occurred by Time (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:securityappliances" $orgid$
| dedup occurredAt, deviceSerial
| timechart count as "Events Occured" span=1d...`

#### cisco-catalyst-app

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Security and Operational Events Distribution By Severity Over Time (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Cyber_Vision_Syslog_E...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Security Events by Severity (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Cyber_Vision_Syslog_E...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** All Security Events of "$syslog_severity$" Severity (table)
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Security Group Tag by Authentication (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events by ...`

- **Dashboard:** Overview
  - **Panel:** Top 10 Assets By Threat (chart)
  - **Matched Keywords:** threat
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Security Insights
  - **Panel:** Malicious Files by Malware (chart)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset....`

- **Dashboard:** Security Insights
  - **Panel:** Malicious Files by Type (chart)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset....`

- **Dashboard:** Security Insights
  - **Panel:** URLs by Category (chart)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset....`

- **Dashboard:** Security Insights
  - **Panel:** Blocked Connections Over IPS event (chart)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset....`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$tkn_prevent_run_threat_details$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(_time) as Timestamp from datamodel=Cisco_Cataly...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$tkn_prevent_run_url_details$ | tstats `summariesonly` fillnull_value="N/A" count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Data...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$tkn_prevent_run_ips_details$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Ca...`

- **Dashboard:** Security Insights
  - **Panel:** SGACL - Top Sources (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_SG...`

- **Dashboard:** Security Insights
  - **Panel:** SGACL Events by Action (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count  from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_S...`

- **Dashboard:** Security Insights
  - **Panel:** ACL - Top Denied Sources (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_AC...`

- **Dashboard:** Security Insights
  - **Panel:** ACL - Top Denied Clients (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_AC...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Ci...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats summariesonly=false fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Datase...`

- **Dashboard:** Security Insights
  - **Panel:** Dropped FW Flows (table)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats fillnull_value="N/A" `summariesonly` count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Ci...`

- **Dashboard:** Security Insights
  - **Panel:** Inspected FW Flows (table)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats fillnull_value="N/A" `summariesonly` count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Ci...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats fillnull_value="N/A" `summariesonly` count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Ci...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Ne...`

- **Dashboard:** Security Insights
  - **Panel:** Device Compliance Status (chart)
  - **Query Preview:** `$Cisco Catalyst Center$ | tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Cataly...`

- **Dashboard:** Security Insights
  - **Panel:** Device Compliance State (chart)
  - **Query Preview:** `$Cisco Catalyst Center$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Compliance_...`

- **Dashboard:** Security Insights
  - **Panel:** Top 10 Vulnerabilities (chart)
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Vulnerabili...`

- **Dashboard:** Security Insights
  - **Panel:** Rogue Devices Count (single_value)
  - **Query Preview:** `| tstats `summariesonly` count as Count from datamodel=Cisco_Catalyst_App 
  where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Rogue_Events 
  by C...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$rogue_devices_detail$ | tstats fillnull_value="N/A" `summariesonly` count as "Count" values(Cisco_Catalyst_Dataset.Cisco_Catalyst_Rogue_Events.rogue_...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$run_vulnerabilities$ 
| tstats fillnull_value="N/A" `summariesonly` count as "Count" values(Cisco_Catalyst_Dataset.catalyst_vendor_product) as "Sourc...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$tkn_prevent_run_device_compliance_details$| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where node...`

- **Dashboard:** Security Insights
  - **Panel:** Security Advisory Details (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Security Insights
  - **Panel:** ISE Authentication Policy Chart (chart)
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** ISE Authorization Policy Chart (chart)
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** Security Events Occurred by Time (chart)
  - **Query Preview:** `| tstats `summariesonly` count as meraki_security_events_count
    from datamodel=Cisco_Catalyst_App 
    where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` count as Count from datamodel=Cisco_Catalyst_App 
  where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Security_Events 
  b...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Security Insights
  - **Panel:** SGACL Activities (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_SG...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Unified Threat Defense Health (chart)
  - **Matched Keywords:** threat
  - **Query Preview:** `| tstats `summariesonly` latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_UTD_Health.sdwan_utd_health_status) as "Admin Status" from datamodel=Cisco...`

#### cisco_sna_app

- **Dashboard:** User Report
  - **Panel:** Security Index (table)
  - **Query Preview:** `|topalarming report_type=users domain_id=$domain_id$ smc_ip=$smc_ip$
            | where like(username, "$username$") | eval time_session_start=strfti...`

- **Dashboard:** Host Snapshot
  - **Panel:** Security Index (table)
  - **Query Preview:** `| where row_type="host_security_summary" | fields "security_concern_index", "security_target_index", "security_recon_index", "security_command_and_con...`

- **Dashboard:** Host Snapshot
  - **Panel:** Host is Source of Security Events (Most Recent) (table)
  - **Query Preview:** `| where row_type="host_security_events" and origin_list="source-list" | eval start_time=strftime(strptime(start_time."+0000","%Y-%m-%dT%H:%M:%SZ%z"),"...`

- **Dashboard:** Host Snapshot
  - **Panel:** Host is Target of Security Events (Most Recent) (table)
  - **Query Preview:** `| where row_type="host_security_events" and origin_list="target-list" | eval start_time=strftime(strptime(start_time."+0000","%Y-%m-%dT%H:%M:%SZ%z"),"...`

- **Dashboard:** Security Events
  - **Panel:** Top Security Event Types (chart)
  - **Query Preview:** `| rename "event_type_name" as "Security Event Type" | stats count by "Security Event Type"...`

- **Dashboard:** Security Events
  - **Panel:** Top Security Event Sources (chart)
  - **Query Preview:** `| where source_ip!="Multiple Hosts" and not like("$form.subject_ip$", "%" . source_ip . "%") and not like("$form.peer_ip$", "%" . source_ip . "%") | r...`

- **Dashboard:** Security Events
  - **Panel:** Top Security Event Targets (chart)
  - **Query Preview:** `| where target_ip!="Multiple Hosts" and not like("$form.subject_ip$", "%" . target_ip . "%") and not like("$form.peer_ip$", "%" . target_ip . "%") | r...`

- **Dashboard:** Security Events
  - **Panel:** Results (table)
  - **Query Preview:** `| sort 0 - ci_points | eval start_time=strftime(strptime(start_time."+0000","%Y-%m-%dT%H:%M:%SZ%z"),"%Y-%m-%d %H:%M:%S %Z") | eval last_time=strftime(...`

- **Dashboard:** Security Events
  - **Panel:** Untitled (table)

- **Dashboard:** Security Event Descriptions
  - **Panel:** Untitled (table)
  - **Query Preview:** `| sort 0 name | fields "name", "description" | rename "name" as "Name", "description" as "Description"...`

- **Dashboard:** Security Event Descriptions
  - **Panel:** Untitled (table)

---

### Requirement 45: Secure Access alerts / blocks / policies

**Stated Visualization Support:** Yes

**Stated Supporting Apps:** Cisco Secure Access Add-on for Splunk, Cisco Secure Access App for Splunk

**Matched Panels Found:** 13

#### Splunk_TA_cisco-ise

- **Dashboard:** Cisco ISE TA Troubleshooting Dashboard
  - **Panel:** Alerts (single_value)
  - **Matched Keywords:** alerts
  - **Query Preview:** `| pivot Alerts Alerts count(Alerts) AS "Count of Alerts" FILTER sourcetype is "cisco:ise:syslog" ROWSUMMARY 0 COLSUMMARY 0 SHOWOTHER 1...`

#### Splunk_TA_cisco_meraki

- **Dashboard:** Organizations Security
  - **Panel:** Blocked Alerts Count (chart)
  - **Matched Keywords:** alerts
  - **Query Preview:** ``meraki_index` sourcetype="meraki:organizationsecurity" $orgid$
| stats count as Count by blocked
| rename blocked as "Blocked"...`

- **Dashboard:** Organizations Security
  - **Panel:** Details of Alerts (table)
  - **Matched Keywords:** alerts
  - **Query Preview:** ``meraki_index` sourcetype="meraki:organizationsecurity" $orgid$
| rename eventType as "Event Type", deviceMac as "Device Mac", signature as "Signature...`

- **Dashboard:** Organizations Security
  - **Panel:** Alerts Over Time (chart)
  - **Matched Keywords:** alerts
  - **Query Preview:** ``meraki_index` sourcetype="meraki:organizationsecurity" $orgid$
| timechart count as "Alert Count" span=1d...`

- **Dashboard:** Access Point
  - **Panel:** Wireless Data Logs (table)
  - **Matched Keywords:** access
  - **Query Preview:** ``meraki_index` sourcetype="meraki:accesspoints" $orgid$ 
| rename deviceName as "Device Name", deviceSerial as "Device Serial", category as "Category"...`

- **Dashboard:** Access Point
  - **Panel:** Top Devices by RF Changes (table)
  - **Matched Keywords:** access
  - **Query Preview:** ``meraki_index` sourcetype="meraki:accesspoints" $orgid$ 
| dedup occurredAt, clientId
| spath type 
| search type="auto_rf_channel_change" 
| stats co...`

- **Dashboard:** Access Point
  - **Panel:** Most Common Channel Transition (table)
  - **Matched Keywords:** access
  - **Query Preview:** ``meraki_index` sourcetype="meraki:accesspoints" $orgid$
| dedup occurredAt, clientId
| stats count as "Count" by eventData.oldChan, eventData.newChan
...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Total Alerts (single_value)
  - **Matched Keywords:** alerts
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$ 
| dedup id 
| stats count as "Alert Count"...`

#### cisco-cloud-security

- **Dashboard:** Access
  - **Panel:** Untitled (table)
  - **Matched Keywords:** access

- **Dashboard:** Alerts Dashboard
  - **Panel:** Untitled (table)
  - **Matched Keywords:** alerts

#### ta_cisco_thousandeyes

- **Dashboard:** Alerts
  - **Panel:** Untitled (table)
  - **Matched Keywords:** alerts
  - **Query Preview:** `| tstats `summariesonly` count, values(Alerts.triggerTime) as triggerTime, values(Alerts.accountId) as accountId, values(Alerts.organizationId) as org...`

- **Dashboard:** Alerts
  - **Panel:** Alerts Summary by Severity (chart)
  - **Matched Keywords:** alerts
  - **Query Preview:** `| tstats `summariesonly` count FROM datamodel="Cisco_ThousandEyes.Alerts" WHERE $tkn_acc_group$ $tkn_severity$ $tkn_test_type$ BY Alerts.severity | re...`

- **Dashboard:** Alerts
  - **Panel:** Alerts Timeline (chart)
  - **Matched Keywords:** alerts
  - **Query Preview:** `| tstats `summariesonly` count FROM datamodel="Cisco_ThousandEyes.Alerts" WHERE $tkn_acc_group$ $tkn_severity$ $tkn_test_type$ BY Alerts.severity _tim...`

---

### Requirement 46: Secure Access app/cloud policy blocks

**Stated Visualization Support:** Yes

**Stated Supporting Apps:** Cisco Secure Access Add-on for Splunk

**Matched Panels Found:** 12

#### Splunk_TA_cisco_meraki

- **Dashboard:** Access Point
  - **Panel:** Wireless Data Logs (table)
  - **Matched Keywords:** access
  - **Query Preview:** ``meraki_index` sourcetype="meraki:accesspoints" $orgid$ 
| rename deviceName as "Device Name", deviceSerial as "Device Serial", category as "Category"...`

- **Dashboard:** Access Point
  - **Panel:** Top Devices by RF Changes (table)
  - **Matched Keywords:** access
  - **Query Preview:** ``meraki_index` sourcetype="meraki:accesspoints" $orgid$ 
| dedup occurredAt, clientId
| spath type 
| search type="auto_rf_channel_change" 
| stats co...`

- **Dashboard:** Access Point
  - **Panel:** Most Common Channel Transition (table)
  - **Matched Keywords:** access
  - **Query Preview:** ``meraki_index` sourcetype="meraki:accesspoints" $orgid$
| dedup occurredAt, clientId
| stats count as "Count" by eventData.oldChan, eventData.newChan
...`

#### TA-cisco-cloud-security-addon

- **Dashboard:** Open App
  - **Panel:** Untitled (table)
  - **Matched Keywords:** app

#### cisco-catalyst-app

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Meraki Policy Sync (chart)
  - **Matched Keywords:** policy
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events.ISE...`

- **Dashboard:** Overview
  - **Panel:** Top Policy Hits for SD-WAN (chart)
  - **Matched Keywords:** policy
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Overview
  - **Panel:** Top Policy Set Hits for Cisco ISE (chart)
  - **Matched Keywords:** policy
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Policy_Events by Cisc...`

- **Dashboard:** Security Insights
  - **Panel:** ISE Authentication Policy Chart (chart)
  - **Matched Keywords:** policy
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** ISE Authorization Policy Chart (chart)
  - **Matched Keywords:** policy
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

#### cisco-cloud-security

- **Dashboard:** Access
  - **Panel:** Untitled (table)
  - **Matched Keywords:** access

#### cisco_sna_app

- **Dashboard:** Cisco SNA App Setup Page
  - **Panel:** Untitled (table)
  - **Matched Keywords:** app

#### ta_cisco_thousandeyes

- **Dashboard:** Data collection Status
  - **Panel:** Number of Cloud & Enterprise Agent Tests and Endpoint Agent Tests (single_value)
  - **Matched Keywords:** cloud
  - **Query Preview:** `| tstats `summariesonly` dc(Test_Metrics.thousandeyes.test.id) as count FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE Test_Metrics.thousandey...`

---

### Requirement 47: Policy hits (North/South, East/West)

**Stated Visualization Support:** Partial

**Stated Supporting Apps:** Cisco Secure Network Analytics Add-on for Splunk

**Matched Panels Found:** 5

#### cisco-catalyst-app

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Meraki Policy Sync (chart)
  - **Matched Keywords:** policy
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events.ISE...`

- **Dashboard:** Overview
  - **Panel:** Top Policy Hits for SD-WAN (chart)
  - **Matched Keywords:** policy, hits
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Overview
  - **Panel:** Top Policy Set Hits for Cisco ISE (chart)
  - **Matched Keywords:** policy, hits
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Policy_Events by Cisc...`

- **Dashboard:** Security Insights
  - **Panel:** ISE Authentication Policy Chart (chart)
  - **Matched Keywords:** policy
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** ISE Authorization Policy Chart (chart)
  - **Matched Keywords:** policy
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

---

### Requirement 48: DC FW (front door) visibility

**Stated Visualization Support:** No

**Stated Supporting Apps:** Cisco Secure Network Analytics Add-on for Splunk

**Matched Panels Found:** 72

#### Splunk_TA_cisco_meraki

- **Dashboard:** Organizations Security
  - **Panel:** Blocked Alerts Count (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:organizationsecurity" $orgid$
| stats count as Count by blocked
| rename blocked as "Blocked"...`

- **Dashboard:** Organizations Security
  - **Panel:** Details of Alerts (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:organizationsecurity" $orgid$
| rename eventType as "Event Type", deviceMac as "Device Mac", signature as "Signature...`

- **Dashboard:** Organizations Security
  - **Panel:** Alerts Over Time (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:organizationsecurity" $orgid$
| timechart count as "Alert Count" span=1d...`

- **Dashboard:** Security Appliances
  - **Panel:** Appliance Security Events (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:securityappliances" $orgid$ 
| dedup occurredAt, deviceSerial
|spath description
| rename eventData.summary as Summa...`

- **Dashboard:** Security Appliances
  - **Panel:** Categories of Data (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:securityappliances" $orgid$
| dedup occurredAt, deviceSerial
| stats count as Count by category
| sort - 0 Count
| r...`

- **Dashboard:** Security Appliances
  - **Panel:** Top Devices with IP Conflicts (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:securityappliances" category="ip_conflicts" $orgid$
| dedup occurredAt, deviceSerial
| stats count as Count by devic...`

- **Dashboard:** Security Appliances
  - **Panel:** Security Events Occurred by Time (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:securityappliances" $orgid$
| dedup occurredAt, deviceSerial
| timechart count as "Events Occured" span=1d...`

#### cisco-catalyst-app

- **Dashboard:** Sensors
  - **Panel:** Door Sensor Status - Latest Readings (chart)
  - **Matched Keywords:** door
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" 
    from datamodel=Cisco_Catalyst_App 
    where nodename=Cisco_Catalyst_Dataset.Cisco...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Security and Operational Events Distribution By Severity Over Time (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Cyber_Vision_Syslog_E...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Security Events by Severity (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Cyber_Vision_Syslog_E...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** All Security Events of "$syslog_severity$" Severity (table)
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Security Group Tag by Authentication (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events by ...`

- **Dashboard:** Overview
  - **Panel:** Top 10 Assets By Threat (chart)
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Security Insights
  - **Panel:** Malicious Files by Malware (chart)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset....`

- **Dashboard:** Security Insights
  - **Panel:** Malicious Files by Type (chart)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset....`

- **Dashboard:** Security Insights
  - **Panel:** URLs by Category (chart)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset....`

- **Dashboard:** Security Insights
  - **Panel:** Blocked Connections Over IPS event (chart)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset....`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$tkn_prevent_run_threat_details$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(_time) as Timestamp from datamodel=Cisco_Cataly...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$tkn_prevent_run_url_details$ | tstats `summariesonly` fillnull_value="N/A" count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Data...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$tkn_prevent_run_ips_details$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Ca...`

- **Dashboard:** Security Insights
  - **Panel:** SGACL - Top Sources (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_SG...`

- **Dashboard:** Security Insights
  - **Panel:** SGACL Events by Action (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count  from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_S...`

- **Dashboard:** Security Insights
  - **Panel:** ACL - Top Denied Sources (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_AC...`

- **Dashboard:** Security Insights
  - **Panel:** ACL - Top Denied Clients (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_AC...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Ci...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats summariesonly=false fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Datase...`

- **Dashboard:** Security Insights
  - **Panel:** Dropped FW Flows (table)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats fillnull_value="N/A" `summariesonly` count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Ci...`

- **Dashboard:** Security Insights
  - **Panel:** Inspected FW Flows (table)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats fillnull_value="N/A" `summariesonly` count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Ci...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats fillnull_value="N/A" `summariesonly` count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Ci...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Ne...`

- **Dashboard:** Security Insights
  - **Panel:** Device Compliance Status (chart)
  - **Query Preview:** `$Cisco Catalyst Center$ | tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Cataly...`

- **Dashboard:** Security Insights
  - **Panel:** Device Compliance State (chart)
  - **Query Preview:** `$Cisco Catalyst Center$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Compliance_...`

- **Dashboard:** Security Insights
  - **Panel:** Top 10 Vulnerabilities (chart)
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Vulnerabili...`

- **Dashboard:** Security Insights
  - **Panel:** Rogue Devices Count (single_value)
  - **Query Preview:** `| tstats `summariesonly` count as Count from datamodel=Cisco_Catalyst_App 
  where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Rogue_Events 
  by C...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$rogue_devices_detail$ | tstats fillnull_value="N/A" `summariesonly` count as "Count" values(Cisco_Catalyst_Dataset.Cisco_Catalyst_Rogue_Events.rogue_...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$run_vulnerabilities$ 
| tstats fillnull_value="N/A" `summariesonly` count as "Count" values(Cisco_Catalyst_Dataset.catalyst_vendor_product) as "Sourc...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$tkn_prevent_run_device_compliance_details$| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where node...`

- **Dashboard:** Security Insights
  - **Panel:** Security Advisory Details (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Security Insights
  - **Panel:** ISE Authentication Policy Chart (chart)
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** ISE Authorization Policy Chart (chart)
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** Security Events Occurred by Time (chart)
  - **Query Preview:** `| tstats `summariesonly` count as meraki_security_events_count
    from datamodel=Cisco_Catalyst_App 
    where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` count as Count from datamodel=Cisco_Catalyst_App 
  where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Security_Events 
  b...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Security Insights
  - **Panel:** SGACL Activities (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_SG...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Unified Threat Defense Health (chart)
  - **Query Preview:** `| tstats `summariesonly` latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_UTD_Health.sdwan_utd_health_status) as "Admin Status" from datamodel=Cisco...`

#### cisco_sna_app

- **Dashboard:** User Report
  - **Panel:** Security Index (table)
  - **Query Preview:** `|topalarming report_type=users domain_id=$domain_id$ smc_ip=$smc_ip$
            | where like(username, "$username$") | eval time_session_start=strfti...`

- **Dashboard:** Host Snapshot
  - **Panel:** Security Index (table)
  - **Query Preview:** `| where row_type="host_security_summary" | fields "security_concern_index", "security_target_index", "security_recon_index", "security_command_and_con...`

- **Dashboard:** Host Snapshot
  - **Panel:** Host is Source of Security Events (Most Recent) (table)
  - **Query Preview:** `| where row_type="host_security_events" and origin_list="source-list" | eval start_time=strftime(strptime(start_time."+0000","%Y-%m-%dT%H:%M:%SZ%z"),"...`

- **Dashboard:** Host Snapshot
  - **Panel:** Host is Target of Security Events (Most Recent) (table)
  - **Query Preview:** `| where row_type="host_security_events" and origin_list="target-list" | eval start_time=strftime(strptime(start_time."+0000","%Y-%m-%dT%H:%M:%SZ%z"),"...`

- **Dashboard:** Security Events
  - **Panel:** Top Security Event Types (chart)
  - **Query Preview:** `| rename "event_type_name" as "Security Event Type" | stats count by "Security Event Type"...`

- **Dashboard:** Security Events
  - **Panel:** Top Security Event Sources (chart)
  - **Query Preview:** `| where source_ip!="Multiple Hosts" and not like("$form.subject_ip$", "%" . source_ip . "%") and not like("$form.peer_ip$", "%" . source_ip . "%") | r...`

- **Dashboard:** Security Events
  - **Panel:** Top Security Event Targets (chart)
  - **Query Preview:** `| where target_ip!="Multiple Hosts" and not like("$form.subject_ip$", "%" . target_ip . "%") and not like("$form.peer_ip$", "%" . target_ip . "%") | r...`

- **Dashboard:** Security Events
  - **Panel:** Results (table)
  - **Query Preview:** `| sort 0 - ci_points | eval start_time=strftime(strptime(start_time."+0000","%Y-%m-%dT%H:%M:%SZ%z"),"%Y-%m-%d %H:%M:%S %Z") | eval last_time=strftime(...`

- **Dashboard:** Security Events
  - **Panel:** Untitled (table)

- **Dashboard:** Security Event Descriptions
  - **Panel:** Untitled (table)
  - **Query Preview:** `| sort 0 name | fields "name", "description" | rename "name" as "Name", "description" as "Description"...`

- **Dashboard:** Security Event Descriptions
  - **Panel:** Untitled (table)

---

### Requirement 49: Hybrid Mesh FW logs

**Stated Visualization Support:** No

**Stated Supporting Apps:** Cisco Secure Network Analytics Add-on for Splunk

**Matched Panels Found:** 82

#### Splunk_TA_cisco_meraki

- **Dashboard:** Organizations Security
  - **Panel:** Blocked Alerts Count (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:organizationsecurity" $orgid$
| stats count as Count by blocked
| rename blocked as "Blocked"...`

- **Dashboard:** Organizations Security
  - **Panel:** Details of Alerts (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:organizationsecurity" $orgid$
| rename eventType as "Event Type", deviceMac as "Device Mac", signature as "Signature...`

- **Dashboard:** Organizations Security
  - **Panel:** Alerts Over Time (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:organizationsecurity" $orgid$
| timechart count as "Alert Count" span=1d...`

- **Dashboard:** Access Point
  - **Panel:** Wireless Data Logs (table)
  - **Matched Keywords:** logs
  - **Query Preview:** ``meraki_index` sourcetype="meraki:accesspoints" $orgid$ 
| rename deviceName as "Device Name", deviceSerial as "Device Serial", category as "Category"...`

- **Dashboard:** Security Appliances
  - **Panel:** Appliance Security Events (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:securityappliances" $orgid$ 
| dedup occurredAt, deviceSerial
|spath description
| rename eventData.summary as Summa...`

- **Dashboard:** Security Appliances
  - **Panel:** Categories of Data (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:securityappliances" $orgid$
| dedup occurredAt, deviceSerial
| stats count as Count by category
| sort - 0 Count
| r...`

- **Dashboard:** Security Appliances
  - **Panel:** Top Devices with IP Conflicts (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:securityappliances" category="ip_conflicts" $orgid$
| dedup occurredAt, deviceSerial
| stats count as Count by devic...`

- **Dashboard:** Security Appliances
  - **Panel:** Security Events Occurred by Time (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:securityappliances" $orgid$
| dedup occurredAt, deviceSerial
| timechart count as "Events Occured" span=1d...`

- **Dashboard:** Switches
  - **Panel:** Switches Data Logs (table)
  - **Matched Keywords:** logs
  - **Query Preview:** ``meraki_index` sourcetype="meraki:switches" $orgid$
| dedup occurredAt, deviceSerial
| rename deviceName as "Device Name", deviceSerial as "Device Ser...`

#### cisco-catalyst-app

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Audit Logs for Cisco ISE (table)
  - **Matched Keywords:** logs
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Audit Logs for SD-WAN (table)
  - **Matched Keywords:** logs
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Ci...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Audit Logs for Catalyst Center (table)
  - **Matched Keywords:** logs
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Audit Logs for Cisco Meraki (table)
  - **Matched Keywords:** logs
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count 
  from datamodel=Cisco_Catalyst_App 
  where nodename=Cisco_Catalyst_Dataset.Cisco_Catal...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Security and Operational Events Distribution By Severity Over Time (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Cyber_Vision_Syslog_E...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Security Events by Severity (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Cyber_Vision_Syslog_E...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** All Security Events of "$syslog_severity$" Severity (table)
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Security Group Tag by Authentication (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events by ...`

- **Dashboard:** Overview
  - **Panel:** Top 10 Assets By Threat (chart)
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Security Insights
  - **Panel:** Malicious Files by Malware (chart)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset....`

- **Dashboard:** Security Insights
  - **Panel:** Malicious Files by Type (chart)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset....`

- **Dashboard:** Security Insights
  - **Panel:** URLs by Category (chart)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset....`

- **Dashboard:** Security Insights
  - **Panel:** Blocked Connections Over IPS event (chart)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset....`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$tkn_prevent_run_threat_details$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(_time) as Timestamp from datamodel=Cisco_Cataly...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$tkn_prevent_run_url_details$ | tstats `summariesonly` fillnull_value="N/A" count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Data...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$tkn_prevent_run_ips_details$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Ca...`

- **Dashboard:** Security Insights
  - **Panel:** SGACL - Top Sources (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_SG...`

- **Dashboard:** Security Insights
  - **Panel:** SGACL Events by Action (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count  from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_S...`

- **Dashboard:** Security Insights
  - **Panel:** ACL - Top Denied Sources (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_AC...`

- **Dashboard:** Security Insights
  - **Panel:** ACL - Top Denied Clients (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_AC...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Ci...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats summariesonly=false fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Datase...`

- **Dashboard:** Security Insights
  - **Panel:** Dropped FW Flows (table)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats fillnull_value="N/A" `summariesonly` count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Ci...`

- **Dashboard:** Security Insights
  - **Panel:** Inspected FW Flows (table)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats fillnull_value="N/A" `summariesonly` count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Ci...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats fillnull_value="N/A" `summariesonly` count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Ci...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Ne...`

- **Dashboard:** Security Insights
  - **Panel:** Device Compliance Status (chart)
  - **Query Preview:** `$Cisco Catalyst Center$ | tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Cataly...`

- **Dashboard:** Security Insights
  - **Panel:** Device Compliance State (chart)
  - **Query Preview:** `$Cisco Catalyst Center$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Compliance_...`

- **Dashboard:** Security Insights
  - **Panel:** Top 10 Vulnerabilities (chart)
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Vulnerabili...`

- **Dashboard:** Security Insights
  - **Panel:** Rogue Devices Count (single_value)
  - **Query Preview:** `| tstats `summariesonly` count as Count from datamodel=Cisco_Catalyst_App 
  where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Rogue_Events 
  by C...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$rogue_devices_detail$ | tstats fillnull_value="N/A" `summariesonly` count as "Count" values(Cisco_Catalyst_Dataset.Cisco_Catalyst_Rogue_Events.rogue_...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$run_vulnerabilities$ 
| tstats fillnull_value="N/A" `summariesonly` count as "Count" values(Cisco_Catalyst_Dataset.catalyst_vendor_product) as "Sourc...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$tkn_prevent_run_device_compliance_details$| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where node...`

- **Dashboard:** Security Insights
  - **Panel:** Security Advisory Details (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Security Insights
  - **Panel:** ISE Authentication Policy Chart (chart)
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** ISE Authorization Policy Chart (chart)
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** Security Events Occurred by Time (chart)
  - **Query Preview:** `| tstats `summariesonly` count as meraki_security_events_count
    from datamodel=Cisco_Catalyst_App 
    where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` count as Count from datamodel=Cisco_Catalyst_App 
  where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Security_Events 
  b...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Security Insights
  - **Panel:** SGACL Activities (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_SG...`

- **Dashboard:** Performance
  - **Panel:** Audit Logs for Cisco ISE (table)
  - **Matched Keywords:** logs
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Performance
  - **Panel:** Audit Logs for SD-WAN (table)
  - **Matched Keywords:** logs
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_SD...`

- **Dashboard:** Performance
  - **Panel:** Audit Logs for Catalyst Center (table)
  - **Matched Keywords:** logs
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Performance
  - **Panel:** Audit Logs for Cisco Meraki (table)
  - **Matched Keywords:** logs
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count 
  from datamodel=Cisco_Catalyst_App 
  where nodename=Cisco_Catalyst_Dataset.Cisco_Catal...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Unified Threat Defense Health (chart)
  - **Query Preview:** `| tstats `summariesonly` latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_UTD_Health.sdwan_utd_health_status) as "Admin Status" from datamodel=Cisco...`

#### cisco_sna_app

- **Dashboard:** User Report
  - **Panel:** Security Index (table)
  - **Query Preview:** `|topalarming report_type=users domain_id=$domain_id$ smc_ip=$smc_ip$
            | where like(username, "$username$") | eval time_session_start=strfti...`

- **Dashboard:** Host Snapshot
  - **Panel:** Security Index (table)
  - **Query Preview:** `| where row_type="host_security_summary" | fields "security_concern_index", "security_target_index", "security_recon_index", "security_command_and_con...`

- **Dashboard:** Host Snapshot
  - **Panel:** Host is Source of Security Events (Most Recent) (table)
  - **Query Preview:** `| where row_type="host_security_events" and origin_list="source-list" | eval start_time=strftime(strptime(start_time."+0000","%Y-%m-%dT%H:%M:%SZ%z"),"...`

- **Dashboard:** Host Snapshot
  - **Panel:** Host is Target of Security Events (Most Recent) (table)
  - **Query Preview:** `| where row_type="host_security_events" and origin_list="target-list" | eval start_time=strftime(strptime(start_time."+0000","%Y-%m-%dT%H:%M:%SZ%z"),"...`

- **Dashboard:** Security Events
  - **Panel:** Top Security Event Types (chart)
  - **Query Preview:** `| rename "event_type_name" as "Security Event Type" | stats count by "Security Event Type"...`

- **Dashboard:** Security Events
  - **Panel:** Top Security Event Sources (chart)
  - **Query Preview:** `| where source_ip!="Multiple Hosts" and not like("$form.subject_ip$", "%" . source_ip . "%") and not like("$form.peer_ip$", "%" . source_ip . "%") | r...`

- **Dashboard:** Security Events
  - **Panel:** Top Security Event Targets (chart)
  - **Query Preview:** `| where target_ip!="Multiple Hosts" and not like("$form.subject_ip$", "%" . target_ip . "%") and not like("$form.peer_ip$", "%" . target_ip . "%") | r...`

- **Dashboard:** Security Events
  - **Panel:** Results (table)
  - **Query Preview:** `| sort 0 - ci_points | eval start_time=strftime(strptime(start_time."+0000","%Y-%m-%dT%H:%M:%SZ%z"),"%Y-%m-%d %H:%M:%S %Z") | eval last_time=strftime(...`

- **Dashboard:** Security Events
  - **Panel:** Untitled (table)

- **Dashboard:** Security Event Descriptions
  - **Panel:** Untitled (table)
  - **Query Preview:** `| sort 0 name | fields "name", "description" | rename "name" as "Name", "description" as "Description"...`

- **Dashboard:** Security Event Descriptions
  - **Panel:** Untitled (table)

#### ta_cisco_thousandeyes

- **Dashboard:** Activity Logs
  - **Panel:** Untitled (table)
  - **Matched Keywords:** logs
  - **Query Preview:** `| tstats `summariesonly` values(Activities.accountGroupName) as "Account Group Name" values(Activities.user) as "User" values(Activities.thousandeyes....`

---

### Requirement 50: ToR FW / DPU visibility

**Stated Visualization Support:** No

**Stated Supporting Apps:** —

**Matched Panels Found:** 71

#### Splunk_TA_cisco_meraki

- **Dashboard:** Organizations Security
  - **Panel:** Blocked Alerts Count (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:organizationsecurity" $orgid$
| stats count as Count by blocked
| rename blocked as "Blocked"...`

- **Dashboard:** Organizations Security
  - **Panel:** Details of Alerts (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:organizationsecurity" $orgid$
| rename eventType as "Event Type", deviceMac as "Device Mac", signature as "Signature...`

- **Dashboard:** Organizations Security
  - **Panel:** Alerts Over Time (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:organizationsecurity" $orgid$
| timechart count as "Alert Count" span=1d...`

- **Dashboard:** Security Appliances
  - **Panel:** Appliance Security Events (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:securityappliances" $orgid$ 
| dedup occurredAt, deviceSerial
|spath description
| rename eventData.summary as Summa...`

- **Dashboard:** Security Appliances
  - **Panel:** Categories of Data (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:securityappliances" $orgid$
| dedup occurredAt, deviceSerial
| stats count as Count by category
| sort - 0 Count
| r...`

- **Dashboard:** Security Appliances
  - **Panel:** Top Devices with IP Conflicts (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:securityappliances" category="ip_conflicts" $orgid$
| dedup occurredAt, deviceSerial
| stats count as Count by devic...`

- **Dashboard:** Security Appliances
  - **Panel:** Security Events Occurred by Time (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:securityappliances" $orgid$
| dedup occurredAt, deviceSerial
| timechart count as "Events Occured" span=1d...`

#### cisco-catalyst-app

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Security and Operational Events Distribution By Severity Over Time (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Cyber_Vision_Syslog_E...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Security Events by Severity (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Cyber_Vision_Syslog_E...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** All Security Events of "$syslog_severity$" Severity (table)
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Security Group Tag by Authentication (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events by ...`

- **Dashboard:** Overview
  - **Panel:** Top 10 Assets By Threat (chart)
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Security Insights
  - **Panel:** Malicious Files by Malware (chart)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset....`

- **Dashboard:** Security Insights
  - **Panel:** Malicious Files by Type (chart)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset....`

- **Dashboard:** Security Insights
  - **Panel:** URLs by Category (chart)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset....`

- **Dashboard:** Security Insights
  - **Panel:** Blocked Connections Over IPS event (chart)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset....`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$tkn_prevent_run_threat_details$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(_time) as Timestamp from datamodel=Cisco_Cataly...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$tkn_prevent_run_url_details$ | tstats `summariesonly` fillnull_value="N/A" count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Data...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$tkn_prevent_run_ips_details$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Ca...`

- **Dashboard:** Security Insights
  - **Panel:** SGACL - Top Sources (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_SG...`

- **Dashboard:** Security Insights
  - **Panel:** SGACL Events by Action (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count  from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_S...`

- **Dashboard:** Security Insights
  - **Panel:** ACL - Top Denied Sources (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_AC...`

- **Dashboard:** Security Insights
  - **Panel:** ACL - Top Denied Clients (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_AC...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Ci...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats summariesonly=false fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Datase...`

- **Dashboard:** Security Insights
  - **Panel:** Dropped FW Flows (table)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats fillnull_value="N/A" `summariesonly` count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Ci...`

- **Dashboard:** Security Insights
  - **Panel:** Inspected FW Flows (table)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats fillnull_value="N/A" `summariesonly` count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Ci...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats fillnull_value="N/A" `summariesonly` count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Ci...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Ne...`

- **Dashboard:** Security Insights
  - **Panel:** Device Compliance Status (chart)
  - **Query Preview:** `$Cisco Catalyst Center$ | tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Cataly...`

- **Dashboard:** Security Insights
  - **Panel:** Device Compliance State (chart)
  - **Query Preview:** `$Cisco Catalyst Center$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Compliance_...`

- **Dashboard:** Security Insights
  - **Panel:** Top 10 Vulnerabilities (chart)
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Vulnerabili...`

- **Dashboard:** Security Insights
  - **Panel:** Rogue Devices Count (single_value)
  - **Query Preview:** `| tstats `summariesonly` count as Count from datamodel=Cisco_Catalyst_App 
  where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Rogue_Events 
  by C...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$rogue_devices_detail$ | tstats fillnull_value="N/A" `summariesonly` count as "Count" values(Cisco_Catalyst_Dataset.Cisco_Catalyst_Rogue_Events.rogue_...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$run_vulnerabilities$ 
| tstats fillnull_value="N/A" `summariesonly` count as "Count" values(Cisco_Catalyst_Dataset.catalyst_vendor_product) as "Sourc...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$tkn_prevent_run_device_compliance_details$| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where node...`

- **Dashboard:** Security Insights
  - **Panel:** Security Advisory Details (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Security Insights
  - **Panel:** ISE Authentication Policy Chart (chart)
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** ISE Authorization Policy Chart (chart)
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** Security Events Occurred by Time (chart)
  - **Query Preview:** `| tstats `summariesonly` count as meraki_security_events_count
    from datamodel=Cisco_Catalyst_App 
    where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` count as Count from datamodel=Cisco_Catalyst_App 
  where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Security_Events 
  b...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Security Insights
  - **Panel:** SGACL Activities (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_SG...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Unified Threat Defense Health (chart)
  - **Query Preview:** `| tstats `summariesonly` latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_UTD_Health.sdwan_utd_health_status) as "Admin Status" from datamodel=Cisco...`

#### cisco_sna_app

- **Dashboard:** User Report
  - **Panel:** Security Index (table)
  - **Query Preview:** `|topalarming report_type=users domain_id=$domain_id$ smc_ip=$smc_ip$
            | where like(username, "$username$") | eval time_session_start=strfti...`

- **Dashboard:** Host Snapshot
  - **Panel:** Security Index (table)
  - **Query Preview:** `| where row_type="host_security_summary" | fields "security_concern_index", "security_target_index", "security_recon_index", "security_command_and_con...`

- **Dashboard:** Host Snapshot
  - **Panel:** Host is Source of Security Events (Most Recent) (table)
  - **Query Preview:** `| where row_type="host_security_events" and origin_list="source-list" | eval start_time=strftime(strptime(start_time."+0000","%Y-%m-%dT%H:%M:%SZ%z"),"...`

- **Dashboard:** Host Snapshot
  - **Panel:** Host is Target of Security Events (Most Recent) (table)
  - **Query Preview:** `| where row_type="host_security_events" and origin_list="target-list" | eval start_time=strftime(strptime(start_time."+0000","%Y-%m-%dT%H:%M:%SZ%z"),"...`

- **Dashboard:** Security Events
  - **Panel:** Top Security Event Types (chart)
  - **Query Preview:** `| rename "event_type_name" as "Security Event Type" | stats count by "Security Event Type"...`

- **Dashboard:** Security Events
  - **Panel:** Top Security Event Sources (chart)
  - **Query Preview:** `| where source_ip!="Multiple Hosts" and not like("$form.subject_ip$", "%" . source_ip . "%") and not like("$form.peer_ip$", "%" . source_ip . "%") | r...`

- **Dashboard:** Security Events
  - **Panel:** Top Security Event Targets (chart)
  - **Query Preview:** `| where target_ip!="Multiple Hosts" and not like("$form.subject_ip$", "%" . target_ip . "%") and not like("$form.peer_ip$", "%" . target_ip . "%") | r...`

- **Dashboard:** Security Events
  - **Panel:** Results (table)
  - **Query Preview:** `| sort 0 - ci_points | eval start_time=strftime(strptime(start_time."+0000","%Y-%m-%dT%H:%M:%SZ%z"),"%Y-%m-%d %H:%M:%S %Z") | eval last_time=strftime(...`

- **Dashboard:** Security Events
  - **Panel:** Untitled (table)

- **Dashboard:** Security Event Descriptions
  - **Panel:** Untitled (table)
  - **Query Preview:** `| sort 0 name | fields "name", "description" | rename "name" as "Name", "description" as "Description"...`

- **Dashboard:** Security Event Descriptions
  - **Panel:** Untitled (table)

---

### Requirement 51: Cloud alerts (security events)

**Stated Visualization Support:** Yes

**Stated Supporting Apps:** Cisco Security Cloud Add-on

**Matched Panels Found:** 133

#### Splunk_TA_cisco-ise

- **Dashboard:** Cisco ISE TA Troubleshooting Dashboard
  - **Panel:** Total number of Cisco ISE TA events (single_value)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats count where index IN `Cisco_ISE_Index` AND sourcetype="cisco:ise:syslog"...`

- **Dashboard:** Cisco ISE TA Troubleshooting Dashboard
  - **Panel:** Distributions of events by index (chart)
  - **Matched Keywords:** events
  - **Query Preview:** `index IN `Cisco_ISE_Index` sourcetype IN ("cisco:ise:syslog") | stats count by index...`

- **Dashboard:** Cisco ISE TA Troubleshooting Dashboard
  - **Panel:** Trends of events by index (table)
  - **Matched Keywords:** events
  - **Query Preview:** `index IN `Cisco_ISE_Index` sourcetype IN ("cisco:ise:syslog") | chart sparkline(count) AS "Indexes Trend" count AS Total BY index...`

- **Dashboard:** Cisco ISE TA Troubleshooting Dashboard
  - **Panel:** Events by sources (chart)
  - **Matched Keywords:** events
  - **Query Preview:** `index IN `Cisco_ISE_Index` sourcetype IN ("cisco:ise:syslog") | top source...`

- **Dashboard:** Cisco ISE TA Troubleshooting Dashboard
  - **Panel:** Events by sourcetypes (chart)
  - **Matched Keywords:** events
  - **Query Preview:** `index IN `Cisco_ISE_Index` sourcetype IN ("cisco:ise:syslog") | top sourcetype...`

- **Dashboard:** Cisco ISE TA Troubleshooting Dashboard
  - **Panel:** Alerts (single_value)
  - **Matched Keywords:** alerts
  - **Query Preview:** `| pivot Alerts Alerts count(Alerts) AS "Count of Alerts" FILTER sourcetype is "cisco:ise:syslog" ROWSUMMARY 0 COLSUMMARY 0 SHOWOTHER 1...`

#### Splunk_TA_cisco_meraki

- **Dashboard:** Organizations Security
  - **Panel:** Blocked Alerts Count (chart)
  - **Matched Keywords:** alerts, security
  - **Query Preview:** ``meraki_index` sourcetype="meraki:organizationsecurity" $orgid$
| stats count as Count by blocked
| rename blocked as "Blocked"...`

- **Dashboard:** Organizations Security
  - **Panel:** Details of Alerts (table)
  - **Matched Keywords:** alerts, security
  - **Query Preview:** ``meraki_index` sourcetype="meraki:organizationsecurity" $orgid$
| rename eventType as "Event Type", deviceMac as "Device Mac", signature as "Signature...`

- **Dashboard:** Organizations Security
  - **Panel:** Alerts Over Time (chart)
  - **Matched Keywords:** alerts, security
  - **Query Preview:** ``meraki_index` sourcetype="meraki:organizationsecurity" $orgid$
| timechart count as "Alert Count" span=1d...`

- **Dashboard:** Security Appliances
  - **Panel:** Appliance Security Events (table)
  - **Matched Keywords:** events, security
  - **Query Preview:** ``meraki_index` sourcetype="meraki:securityappliances" $orgid$ 
| dedup occurredAt, deviceSerial
|spath description
| rename eventData.summary as Summa...`

- **Dashboard:** Security Appliances
  - **Panel:** Categories of Data (chart)
  - **Matched Keywords:** security
  - **Query Preview:** ``meraki_index` sourcetype="meraki:securityappliances" $orgid$
| dedup occurredAt, deviceSerial
| stats count as Count by category
| sort - 0 Count
| r...`

- **Dashboard:** Security Appliances
  - **Panel:** Top Devices with IP Conflicts (table)
  - **Matched Keywords:** security
  - **Query Preview:** ``meraki_index` sourcetype="meraki:securityappliances" category="ip_conflicts" $orgid$
| dedup occurredAt, deviceSerial
| stats count as Count by devic...`

- **Dashboard:** Security Appliances
  - **Panel:** Security Events Occurred by Time (chart)
  - **Matched Keywords:** events, security
  - **Query Preview:** ``meraki_index` sourcetype="meraki:securityappliances" $orgid$
| dedup occurredAt, deviceSerial
| timechart count as "Events Occured" span=1d...`

- **Dashboard:** Camera Data
  - **Panel:** Camera Events by Type (chart)
  - **Matched Keywords:** events
  - **Query Preview:** ``meraki_index` sourcetype="meraki:cameras" $orgid$
| stats count as Count by type
| rename type as "Type"...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Total Alerts (single_value)
  - **Matched Keywords:** alerts
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$ 
| dedup id 
| stats count as "Alert Count"...`

#### cisco-catalyst-app

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Top 10 Alarms (chart)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Alarm_Events Cisco_Ca...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Authentication Status (chart)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Alarm Hidden Panel (table)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats `summariesonly` count 
  from datamodel=Cisco_Catalyst_App 
  where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Alarm_Events 
  by Cisco_C...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** events

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** events

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** events
  - **Query Preview:** `$run_auth_action$ 
| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Data...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Number of Issues by Priority (chart)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Active_Issue_Events.active_issue_specific_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Number of Issues by Severity (chart)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Active_Issue_Events.active_issue_specific_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Number of Issues by Category (chart)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Active_Issue_Events.active_issue_specific_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** events

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Audit Logs for Cisco ISE (table)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Audit Logs for SD-WAN (table)
  - **Matched Keywords:** events
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Ci...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Audit Logs for Catalyst Center (table)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Audit Logs for Cisco Meraki (table)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count 
  from datamodel=Cisco_Catalyst_App 
  where nodename=Cisco_Catalyst_Dataset.Cisco_Catal...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Event Notifications for Cisco ISE (table)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Event_Notificati...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** SD-WAN Events (events)
  - **Matched Keywords:** events
  - **Query Preview:** ``cisco_catalyst_app_index` sourcetype="cisco:sdwan:*" "$notification_search_tkn$"...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Events By Severity for Cyber Vision (chart)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats `summariesonly` count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Cyber_Vision_Severity_Events by ...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** events

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Severity - $severity$ By Type (chart)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Events Of Type - $type$ And Severity - $severity$ (table)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Security and Operational Events Distribution By Severity Over Time (chart)
  - **Matched Keywords:** events, security
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Cyber_Vision_Syslog_E...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** events

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Cyber_Vision_Syslog_E...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Security Events by Severity (chart)
  - **Matched Keywords:** events, security
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Cyber_Vision_Syslog_E...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Operational Events by Severity (chart)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Cyber_Vision_Syslog_E...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** events

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (chart)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** All Security Events of "$syslog_severity$" Severity (table)
  - **Matched Keywords:** events, security
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** events

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (chart)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** All Operational Events of "$syslog_operational_severity_panel$" Severity (table)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Cyber_Vision_Syslog_E...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Meraki Policy Sync (chart)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events.ISE...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** events

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Wireless Signal Metrics (chart)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events by ...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** events

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events by ...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Security Group Tag by Authentication (chart)
  - **Matched Keywords:** events, security
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events by ...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** IP-SGT Bindings (chart)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_IP_SGT_Bindings by Ci...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** events

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as Count from datamodel=Cisco_Catalyst_App 
    where nodename=Cisco_Catalyst_Dataset.Cisco_Cataly...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** events

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats `summariesonly` values(Cisco_Catalyst_Dataset.Cisco_Catalyst_IP_SGT_Bindings.cisco_ip_sgt_source) as "Source" count as "Count" from datamodel...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Endpoint Purged (chart)
  - **Matched Keywords:** events
  - **Query Preview:** ``cisco_catalyst_app_index` sourcetype="cisco:ise:syslog" ObjectsPurged=* NOT ObjectsPurged=None vendor_product IN ($product$) | stats count by ise_ser...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** events

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Untitled (table)
  - **Matched Keywords:** events
  - **Query Preview:** ``cisco_catalyst_app_index` sourcetype="cisco:ise:syslog" ObjectsPurged=* NOT ObjectsPurged=None vendor_product IN ($product$) ise_servername IN ($endp...`

- **Dashboard:** Overview
  - **Panel:** Top 10 Assets By Threat (chart)
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Overview
  - **Panel:** ISE Events Summary (chart)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats `summariesonly` count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events by _time, Cisc...`

- **Dashboard:** Security Insights
  - **Panel:** Malicious Files by Malware (chart)
  - **Matched Keywords:** security
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset....`

- **Dashboard:** Security Insights
  - **Panel:** Malicious Files by Type (chart)
  - **Matched Keywords:** security
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset....`

- **Dashboard:** Security Insights
  - **Panel:** URLs by Category (chart)
  - **Matched Keywords:** security
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset....`

- **Dashboard:** Security Insights
  - **Panel:** Blocked Connections Over IPS event (chart)
  - **Matched Keywords:** security
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset....`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security
  - **Query Preview:** `$tkn_prevent_run_threat_details$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(_time) as Timestamp from datamodel=Cisco_Cataly...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security
  - **Query Preview:** `$tkn_prevent_run_url_details$ | tstats `summariesonly` fillnull_value="N/A" count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Data...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security
  - **Query Preview:** `$tkn_prevent_run_ips_details$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Ca...`

- **Dashboard:** Security Insights
  - **Panel:** SGACL - Top Sources (chart)
  - **Matched Keywords:** security
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_SG...`

- **Dashboard:** Security Insights
  - **Panel:** SGACL Events by Action (chart)
  - **Matched Keywords:** events, security
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count  from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_S...`

- **Dashboard:** Security Insights
  - **Panel:** ACL - Top Denied Sources (chart)
  - **Matched Keywords:** security
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_AC...`

- **Dashboard:** Security Insights
  - **Panel:** ACL - Top Denied Clients (chart)
  - **Matched Keywords:** security
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_AC...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Ci...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security
  - **Query Preview:** `$Cisco SD-WAN$ | tstats summariesonly=false fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Datase...`

- **Dashboard:** Security Insights
  - **Panel:** Dropped FW Flows (table)
  - **Matched Keywords:** security
  - **Query Preview:** `$Cisco SD-WAN$ | tstats fillnull_value="N/A" `summariesonly` count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Ci...`

- **Dashboard:** Security Insights
  - **Panel:** Inspected FW Flows (table)
  - **Matched Keywords:** security
  - **Query Preview:** `$Cisco SD-WAN$ | tstats fillnull_value="N/A" `summariesonly` count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Ci...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security
  - **Query Preview:** `$Cisco SD-WAN$ | tstats fillnull_value="N/A" `summariesonly` count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Ci...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Ne...`

- **Dashboard:** Security Insights
  - **Panel:** Device Compliance Status (chart)
  - **Matched Keywords:** security
  - **Query Preview:** `$Cisco Catalyst Center$ | tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Cataly...`

- **Dashboard:** Security Insights
  - **Panel:** Device Compliance State (chart)
  - **Matched Keywords:** security
  - **Query Preview:** `$Cisco Catalyst Center$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Compliance_...`

- **Dashboard:** Security Insights
  - **Panel:** Top 10 Vulnerabilities (chart)
  - **Matched Keywords:** security
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Vulnerabili...`

- **Dashboard:** Security Insights
  - **Panel:** Rogue Devices Count (single_value)
  - **Matched Keywords:** security
  - **Query Preview:** `| tstats `summariesonly` count as Count from datamodel=Cisco_Catalyst_App 
  where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Rogue_Events 
  by C...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security
  - **Query Preview:** `$rogue_devices_detail$ | tstats fillnull_value="N/A" `summariesonly` count as "Count" values(Cisco_Catalyst_Dataset.Cisco_Catalyst_Rogue_Events.rogue_...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security
  - **Query Preview:** `$run_vulnerabilities$ 
| tstats fillnull_value="N/A" `summariesonly` count as "Count" values(Cisco_Catalyst_Dataset.catalyst_vendor_product) as "Sourc...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security
  - **Query Preview:** `$tkn_prevent_run_device_compliance_details$| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where node...`

- **Dashboard:** Security Insights
  - **Panel:** Security Advisory Details (table)
  - **Matched Keywords:** security
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Security Insights
  - **Panel:** ISE Authentication Policy Chart (chart)
  - **Matched Keywords:** security
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** ISE Authorization Policy Chart (chart)
  - **Matched Keywords:** security
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** Security Events Occurred by Time (chart)
  - **Matched Keywords:** events, security
  - **Query Preview:** `| tstats `summariesonly` count as meraki_security_events_count
    from datamodel=Cisco_Catalyst_App 
    where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security
  - **Query Preview:** `| tstats `summariesonly` count as Count from datamodel=Cisco_Catalyst_App 
  where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Security_Events 
  b...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Security Insights
  - **Panel:** SGACL Activities (table)
  - **Matched Keywords:** security
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_SG...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** Camera Events By Description (chart)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count 
  from datamodel=Cisco_Catalyst_App 
  where nodename=Cisco_Catalyst_Dataset.Cisco_Catal...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Unified Threat Defense Health (chart)
  - **Query Preview:** `| tstats `summariesonly` latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_UTD_Health.sdwan_utd_health_status) as "Admin Status" from datamodel=Cisco...`

#### cisco-cloud-security

- **Dashboard:** Alerts Dashboard
  - **Panel:** Untitled (table)
  - **Matched Keywords:** alerts

#### cisco_sna_app

- **Dashboard:** User Report
  - **Panel:** Security Index (table)
  - **Matched Keywords:** security
  - **Query Preview:** `|topalarming report_type=users domain_id=$domain_id$ smc_ip=$smc_ip$
            | where like(username, "$username$") | eval time_session_start=strfti...`

- **Dashboard:** Host Snapshot
  - **Panel:** Security Index (table)
  - **Matched Keywords:** security
  - **Query Preview:** `| where row_type="host_security_summary" | fields "security_concern_index", "security_target_index", "security_recon_index", "security_command_and_con...`

- **Dashboard:** Host Snapshot
  - **Panel:** Host is Source of Security Events (Most Recent) (table)
  - **Matched Keywords:** events, security
  - **Query Preview:** `| where row_type="host_security_events" and origin_list="source-list" | eval start_time=strftime(strptime(start_time."+0000","%Y-%m-%dT%H:%M:%SZ%z"),"...`

- **Dashboard:** Host Snapshot
  - **Panel:** Host is Target of Security Events (Most Recent) (table)
  - **Matched Keywords:** events, security
  - **Query Preview:** `| where row_type="host_security_events" and origin_list="target-list" | eval start_time=strftime(strptime(start_time."+0000","%Y-%m-%dT%H:%M:%SZ%z"),"...`

- **Dashboard:** Security Events
  - **Panel:** Top Security Event Types (chart)
  - **Matched Keywords:** events, security
  - **Query Preview:** `| rename "event_type_name" as "Security Event Type" | stats count by "Security Event Type"...`

- **Dashboard:** Security Events
  - **Panel:** Top Security Event Sources (chart)
  - **Matched Keywords:** events, security
  - **Query Preview:** `| where source_ip!="Multiple Hosts" and not like("$form.subject_ip$", "%" . source_ip . "%") and not like("$form.peer_ip$", "%" . source_ip . "%") | r...`

- **Dashboard:** Security Events
  - **Panel:** Top Security Event Targets (chart)
  - **Matched Keywords:** events, security
  - **Query Preview:** `| where target_ip!="Multiple Hosts" and not like("$form.subject_ip$", "%" . target_ip . "%") and not like("$form.peer_ip$", "%" . target_ip . "%") | r...`

- **Dashboard:** Security Events
  - **Panel:** Results (table)
  - **Matched Keywords:** events, security
  - **Query Preview:** `| sort 0 - ci_points | eval start_time=strftime(strptime(start_time."+0000","%Y-%m-%dT%H:%M:%SZ%z"),"%Y-%m-%d %H:%M:%S %Z") | eval last_time=strftime(...`

- **Dashboard:** Security Events
  - **Panel:** Untitled (table)
  - **Matched Keywords:** events, security

- **Dashboard:** Security Event Descriptions
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security
  - **Query Preview:** `| sort 0 name | fields "name", "description" | rename "name" as "Name", "description" as "Description"...`

- **Dashboard:** Security Event Descriptions
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security

#### ta_cisco_thousandeyes

- **Dashboard:** Events
  - **Panel:** Untitled (table)
  - **Matched Keywords:** events
  - **Query Preview:** `| tstats `summariesonly` values(Events.id) as Id values(Events.aid) as aid values(Events.title) as Title values(Events.typeName) as "Type Name" values...`

- **Dashboard:** Alerts
  - **Panel:** Untitled (table)
  - **Matched Keywords:** alerts
  - **Query Preview:** `| tstats `summariesonly` count, values(Alerts.triggerTime) as triggerTime, values(Alerts.accountId) as accountId, values(Alerts.organizationId) as org...`

- **Dashboard:** Alerts
  - **Panel:** Alerts Summary by Severity (chart)
  - **Matched Keywords:** alerts
  - **Query Preview:** `| tstats `summariesonly` count FROM datamodel="Cisco_ThousandEyes.Alerts" WHERE $tkn_acc_group$ $tkn_severity$ $tkn_test_type$ BY Alerts.severity | re...`

- **Dashboard:** Alerts
  - **Panel:** Alerts Timeline (chart)
  - **Matched Keywords:** alerts
  - **Query Preview:** `| tstats `summariesonly` count FROM datamodel="Cisco_ThousandEyes.Alerts" WHERE $tkn_acc_group$ $tkn_severity$ $tkn_test_type$ BY Alerts.severity _tim...`

- **Dashboard:** Data collection Status
  - **Panel:** Number of Cloud & Enterprise Agent Tests and Endpoint Agent Tests (single_value)
  - **Matched Keywords:** cloud
  - **Query Preview:** `| tstats `summariesonly` dc(Test_Metrics.thousandeyes.test.id) as count FROM datamodel="Cisco_ThousandEyes.Test_Metrics" WHERE Test_Metrics.thousandey...`

---

### Requirement 52: App security data (eBPF, Isovalent)

**Stated Visualization Support:** No

**Stated Supporting Apps:** —

**Matched Panels Found:** 73

#### Splunk_TA_cisco_meraki

- **Dashboard:** Organizations Security
  - **Panel:** Blocked Alerts Count (chart)
  - **Matched Keywords:** security
  - **Query Preview:** ``meraki_index` sourcetype="meraki:organizationsecurity" $orgid$
| stats count as Count by blocked
| rename blocked as "Blocked"...`

- **Dashboard:** Organizations Security
  - **Panel:** Details of Alerts (table)
  - **Matched Keywords:** security
  - **Query Preview:** ``meraki_index` sourcetype="meraki:organizationsecurity" $orgid$
| rename eventType as "Event Type", deviceMac as "Device Mac", signature as "Signature...`

- **Dashboard:** Organizations Security
  - **Panel:** Alerts Over Time (chart)
  - **Matched Keywords:** security
  - **Query Preview:** ``meraki_index` sourcetype="meraki:organizationsecurity" $orgid$
| timechart count as "Alert Count" span=1d...`

- **Dashboard:** Security Appliances
  - **Panel:** Appliance Security Events (table)
  - **Matched Keywords:** security
  - **Query Preview:** ``meraki_index` sourcetype="meraki:securityappliances" $orgid$ 
| dedup occurredAt, deviceSerial
|spath description
| rename eventData.summary as Summa...`

- **Dashboard:** Security Appliances
  - **Panel:** Categories of Data (chart)
  - **Matched Keywords:** security
  - **Query Preview:** ``meraki_index` sourcetype="meraki:securityappliances" $orgid$
| dedup occurredAt, deviceSerial
| stats count as Count by category
| sort - 0 Count
| r...`

- **Dashboard:** Security Appliances
  - **Panel:** Top Devices with IP Conflicts (table)
  - **Matched Keywords:** security
  - **Query Preview:** ``meraki_index` sourcetype="meraki:securityappliances" category="ip_conflicts" $orgid$
| dedup occurredAt, deviceSerial
| stats count as Count by devic...`

- **Dashboard:** Security Appliances
  - **Panel:** Security Events Occurred by Time (chart)
  - **Matched Keywords:** security
  - **Query Preview:** ``meraki_index` sourcetype="meraki:securityappliances" $orgid$
| dedup occurredAt, deviceSerial
| timechart count as "Events Occured" span=1d...`

#### TA-cisco-cloud-security-addon

- **Dashboard:** Open App
  - **Panel:** Untitled (table)
  - **Matched Keywords:** app

#### cisco-catalyst-app

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Security and Operational Events Distribution By Severity Over Time (chart)
  - **Matched Keywords:** security
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Cyber_Vision_Syslog_E...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Security Events by Severity (chart)
  - **Matched Keywords:** security
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Cyber_Vision_Syslog_E...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** All Security Events of "$syslog_severity$" Severity (table)
  - **Matched Keywords:** security
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Security Group Tag by Authentication (chart)
  - **Matched Keywords:** security
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events by ...`

- **Dashboard:** Overview
  - **Panel:** Top 10 Assets By Threat (chart)
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Security Insights
  - **Panel:** Malicious Files by Malware (chart)
  - **Matched Keywords:** security
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset....`

- **Dashboard:** Security Insights
  - **Panel:** Malicious Files by Type (chart)
  - **Matched Keywords:** security
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset....`

- **Dashboard:** Security Insights
  - **Panel:** URLs by Category (chart)
  - **Matched Keywords:** security
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset....`

- **Dashboard:** Security Insights
  - **Panel:** Blocked Connections Over IPS event (chart)
  - **Matched Keywords:** security
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset....`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security
  - **Query Preview:** `$tkn_prevent_run_threat_details$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(_time) as Timestamp from datamodel=Cisco_Cataly...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security
  - **Query Preview:** `$tkn_prevent_run_url_details$ | tstats `summariesonly` fillnull_value="N/A" count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Data...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security
  - **Query Preview:** `$tkn_prevent_run_ips_details$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Ca...`

- **Dashboard:** Security Insights
  - **Panel:** SGACL - Top Sources (chart)
  - **Matched Keywords:** security
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_SG...`

- **Dashboard:** Security Insights
  - **Panel:** SGACL Events by Action (chart)
  - **Matched Keywords:** security
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count  from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_S...`

- **Dashboard:** Security Insights
  - **Panel:** ACL - Top Denied Sources (chart)
  - **Matched Keywords:** security
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_AC...`

- **Dashboard:** Security Insights
  - **Panel:** ACL - Top Denied Clients (chart)
  - **Matched Keywords:** security
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_AC...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Ci...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security
  - **Query Preview:** `$Cisco SD-WAN$ | tstats summariesonly=false fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Datase...`

- **Dashboard:** Security Insights
  - **Panel:** Dropped FW Flows (table)
  - **Matched Keywords:** security
  - **Query Preview:** `$Cisco SD-WAN$ | tstats fillnull_value="N/A" `summariesonly` count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Ci...`

- **Dashboard:** Security Insights
  - **Panel:** Inspected FW Flows (table)
  - **Matched Keywords:** security
  - **Query Preview:** `$Cisco SD-WAN$ | tstats fillnull_value="N/A" `summariesonly` count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Ci...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security
  - **Query Preview:** `$Cisco SD-WAN$ | tstats fillnull_value="N/A" `summariesonly` count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Ci...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Ne...`

- **Dashboard:** Security Insights
  - **Panel:** Device Compliance Status (chart)
  - **Matched Keywords:** security
  - **Query Preview:** `$Cisco Catalyst Center$ | tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Cataly...`

- **Dashboard:** Security Insights
  - **Panel:** Device Compliance State (chart)
  - **Matched Keywords:** security
  - **Query Preview:** `$Cisco Catalyst Center$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Compliance_...`

- **Dashboard:** Security Insights
  - **Panel:** Top 10 Vulnerabilities (chart)
  - **Matched Keywords:** security
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Vulnerabili...`

- **Dashboard:** Security Insights
  - **Panel:** Rogue Devices Count (single_value)
  - **Matched Keywords:** security
  - **Query Preview:** `| tstats `summariesonly` count as Count from datamodel=Cisco_Catalyst_App 
  where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Rogue_Events 
  by C...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security
  - **Query Preview:** `$rogue_devices_detail$ | tstats fillnull_value="N/A" `summariesonly` count as "Count" values(Cisco_Catalyst_Dataset.Cisco_Catalyst_Rogue_Events.rogue_...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security
  - **Query Preview:** `$run_vulnerabilities$ 
| tstats fillnull_value="N/A" `summariesonly` count as "Count" values(Cisco_Catalyst_Dataset.catalyst_vendor_product) as "Sourc...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security
  - **Query Preview:** `$tkn_prevent_run_device_compliance_details$| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where node...`

- **Dashboard:** Security Insights
  - **Panel:** Security Advisory Details (table)
  - **Matched Keywords:** security
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Security Insights
  - **Panel:** ISE Authentication Policy Chart (chart)
  - **Matched Keywords:** security
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** ISE Authorization Policy Chart (chart)
  - **Matched Keywords:** security
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** Security Events Occurred by Time (chart)
  - **Matched Keywords:** security
  - **Query Preview:** `| tstats `summariesonly` count as meraki_security_events_count
    from datamodel=Cisco_Catalyst_App 
    where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security
  - **Query Preview:** `| tstats `summariesonly` count as Count from datamodel=Cisco_Catalyst_App 
  where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Security_Events 
  b...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Security Insights
  - **Panel:** SGACL Activities (table)
  - **Matched Keywords:** security
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_SG...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Unified Threat Defense Health (chart)
  - **Query Preview:** `| tstats `summariesonly` latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_UTD_Health.sdwan_utd_health_status) as "Admin Status" from datamodel=Cisco...`

#### cisco_sna_app

- **Dashboard:** User Report
  - **Panel:** Security Index (table)
  - **Matched Keywords:** security
  - **Query Preview:** `|topalarming report_type=users domain_id=$domain_id$ smc_ip=$smc_ip$
            | where like(username, "$username$") | eval time_session_start=strfti...`

- **Dashboard:** Host Snapshot
  - **Panel:** Security Index (table)
  - **Matched Keywords:** security
  - **Query Preview:** `| where row_type="host_security_summary" | fields "security_concern_index", "security_target_index", "security_recon_index", "security_command_and_con...`

- **Dashboard:** Host Snapshot
  - **Panel:** Host is Source of Security Events (Most Recent) (table)
  - **Matched Keywords:** security
  - **Query Preview:** `| where row_type="host_security_events" and origin_list="source-list" | eval start_time=strftime(strptime(start_time."+0000","%Y-%m-%dT%H:%M:%SZ%z"),"...`

- **Dashboard:** Host Snapshot
  - **Panel:** Host is Target of Security Events (Most Recent) (table)
  - **Matched Keywords:** security
  - **Query Preview:** `| where row_type="host_security_events" and origin_list="target-list" | eval start_time=strftime(strptime(start_time."+0000","%Y-%m-%dT%H:%M:%SZ%z"),"...`

- **Dashboard:** Security Events
  - **Panel:** Top Security Event Types (chart)
  - **Matched Keywords:** security
  - **Query Preview:** `| rename "event_type_name" as "Security Event Type" | stats count by "Security Event Type"...`

- **Dashboard:** Security Events
  - **Panel:** Top Security Event Sources (chart)
  - **Matched Keywords:** security
  - **Query Preview:** `| where source_ip!="Multiple Hosts" and not like("$form.subject_ip$", "%" . source_ip . "%") and not like("$form.peer_ip$", "%" . source_ip . "%") | r...`

- **Dashboard:** Security Events
  - **Panel:** Top Security Event Targets (chart)
  - **Matched Keywords:** security
  - **Query Preview:** `| where target_ip!="Multiple Hosts" and not like("$form.subject_ip$", "%" . target_ip . "%") and not like("$form.peer_ip$", "%" . target_ip . "%") | r...`

- **Dashboard:** Security Events
  - **Panel:** Results (table)
  - **Matched Keywords:** security
  - **Query Preview:** `| sort 0 - ci_points | eval start_time=strftime(strptime(start_time."+0000","%Y-%m-%dT%H:%M:%SZ%z"),"%Y-%m-%d %H:%M:%S %Z") | eval last_time=strftime(...`

- **Dashboard:** Security Events
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security

- **Dashboard:** Security Event Descriptions
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security
  - **Query Preview:** `| sort 0 name | fields "name", "description" | rename "name" as "Name", "description" as "Description"...`

- **Dashboard:** Security Event Descriptions
  - **Panel:** Untitled (table)
  - **Matched Keywords:** security

- **Dashboard:** Cisco SNA App Setup Page
  - **Panel:** Untitled (table)
  - **Matched Keywords:** app

---

### Requirement 53: DC FW North/South vs East/West policy

**Stated Visualization Support:** No

**Stated Supporting Apps:** Cisco Secure Network Analytics Add-on for Splunk

**Matched Panels Found:** 74

#### Splunk_TA_cisco_meraki

- **Dashboard:** Organizations Security
  - **Panel:** Blocked Alerts Count (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:organizationsecurity" $orgid$
| stats count as Count by blocked
| rename blocked as "Blocked"...`

- **Dashboard:** Organizations Security
  - **Panel:** Details of Alerts (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:organizationsecurity" $orgid$
| rename eventType as "Event Type", deviceMac as "Device Mac", signature as "Signature...`

- **Dashboard:** Organizations Security
  - **Panel:** Alerts Over Time (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:organizationsecurity" $orgid$
| timechart count as "Alert Count" span=1d...`

- **Dashboard:** Security Appliances
  - **Panel:** Appliance Security Events (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:securityappliances" $orgid$ 
| dedup occurredAt, deviceSerial
|spath description
| rename eventData.summary as Summa...`

- **Dashboard:** Security Appliances
  - **Panel:** Categories of Data (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:securityappliances" $orgid$
| dedup occurredAt, deviceSerial
| stats count as Count by category
| sort - 0 Count
| r...`

- **Dashboard:** Security Appliances
  - **Panel:** Top Devices with IP Conflicts (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:securityappliances" category="ip_conflicts" $orgid$
| dedup occurredAt, deviceSerial
| stats count as Count by devic...`

- **Dashboard:** Security Appliances
  - **Panel:** Security Events Occurred by Time (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:securityappliances" $orgid$
| dedup occurredAt, deviceSerial
| timechart count as "Events Occured" span=1d...`

#### cisco-catalyst-app

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Security and Operational Events Distribution By Severity Over Time (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Cyber_Vision_Syslog_E...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Security Events by Severity (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Cyber_Vision_Syslog_E...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** All Security Events of "$syslog_severity$" Severity (table)
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Meraki Policy Sync (chart)
  - **Matched Keywords:** policy
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events.ISE...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Security Group Tag by Authentication (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events by ...`

- **Dashboard:** Overview
  - **Panel:** Top 10 Assets By Threat (chart)
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Overview
  - **Panel:** Top Policy Hits for SD-WAN (chart)
  - **Matched Keywords:** policy
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Overview
  - **Panel:** Top Policy Set Hits for Cisco ISE (chart)
  - **Matched Keywords:** policy
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Policy_Events by Cisc...`

- **Dashboard:** Security Insights
  - **Panel:** Malicious Files by Malware (chart)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset....`

- **Dashboard:** Security Insights
  - **Panel:** Malicious Files by Type (chart)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset....`

- **Dashboard:** Security Insights
  - **Panel:** URLs by Category (chart)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset....`

- **Dashboard:** Security Insights
  - **Panel:** Blocked Connections Over IPS event (chart)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset....`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$tkn_prevent_run_threat_details$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(_time) as Timestamp from datamodel=Cisco_Cataly...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$tkn_prevent_run_url_details$ | tstats `summariesonly` fillnull_value="N/A" count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Data...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$tkn_prevent_run_ips_details$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Ca...`

- **Dashboard:** Security Insights
  - **Panel:** SGACL - Top Sources (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_SG...`

- **Dashboard:** Security Insights
  - **Panel:** SGACL Events by Action (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count  from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_S...`

- **Dashboard:** Security Insights
  - **Panel:** ACL - Top Denied Sources (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_AC...`

- **Dashboard:** Security Insights
  - **Panel:** ACL - Top Denied Clients (chart)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_AC...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Ci...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats summariesonly=false fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Datase...`

- **Dashboard:** Security Insights
  - **Panel:** Dropped FW Flows (table)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats fillnull_value="N/A" `summariesonly` count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Ci...`

- **Dashboard:** Security Insights
  - **Panel:** Inspected FW Flows (table)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats fillnull_value="N/A" `summariesonly` count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Ci...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$Cisco SD-WAN$ | tstats fillnull_value="N/A" `summariesonly` count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Ci...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Ne...`

- **Dashboard:** Security Insights
  - **Panel:** Device Compliance Status (chart)
  - **Query Preview:** `$Cisco Catalyst Center$ | tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Cataly...`

- **Dashboard:** Security Insights
  - **Panel:** Device Compliance State (chart)
  - **Query Preview:** `$Cisco Catalyst Center$ | tstats `summariesonly` fillnull_value="N/A" count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Compliance_...`

- **Dashboard:** Security Insights
  - **Panel:** Top 10 Vulnerabilities (chart)
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Vulnerabili...`

- **Dashboard:** Security Insights
  - **Panel:** Rogue Devices Count (single_value)
  - **Query Preview:** `| tstats `summariesonly` count as Count from datamodel=Cisco_Catalyst_App 
  where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Rogue_Events 
  by C...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$rogue_devices_detail$ | tstats fillnull_value="N/A" `summariesonly` count as "Count" values(Cisco_Catalyst_Dataset.Cisco_Catalyst_Rogue_Events.rogue_...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$run_vulnerabilities$ 
| tstats fillnull_value="N/A" `summariesonly` count as "Count" values(Cisco_Catalyst_Dataset.catalyst_vendor_product) as "Sourc...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `$tkn_prevent_run_device_compliance_details$| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where node...`

- **Dashboard:** Security Insights
  - **Panel:** Security Advisory Details (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Security Insights
  - **Panel:** ISE Authentication Policy Chart (chart)
  - **Matched Keywords:** policy
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** ISE Authorization Policy Chart (chart)
  - **Matched Keywords:** policy
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** Security Events Occurred by Time (chart)
  - **Query Preview:** `| tstats `summariesonly` count as meraki_security_events_count
    from datamodel=Cisco_Catalyst_App 
    where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` count as Count from datamodel=Cisco_Catalyst_App 
  where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Security_Events 
  b...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Security Insights
  - **Panel:** Untitled (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Security Insights
  - **Panel:** SGACL Activities (table)
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_SG...`

- **Dashboard:** Performance
  - **Panel:** Cisco SD-WAN Unified Threat Defense Health (chart)
  - **Query Preview:** `| tstats `summariesonly` latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_UTD_Health.sdwan_utd_health_status) as "Admin Status" from datamodel=Cisco...`

#### cisco_sna_app

- **Dashboard:** User Report
  - **Panel:** Security Index (table)
  - **Query Preview:** `|topalarming report_type=users domain_id=$domain_id$ smc_ip=$smc_ip$
            | where like(username, "$username$") | eval time_session_start=strfti...`

- **Dashboard:** Host Snapshot
  - **Panel:** Security Index (table)
  - **Query Preview:** `| where row_type="host_security_summary" | fields "security_concern_index", "security_target_index", "security_recon_index", "security_command_and_con...`

- **Dashboard:** Host Snapshot
  - **Panel:** Host is Source of Security Events (Most Recent) (table)
  - **Query Preview:** `| where row_type="host_security_events" and origin_list="source-list" | eval start_time=strftime(strptime(start_time."+0000","%Y-%m-%dT%H:%M:%SZ%z"),"...`

- **Dashboard:** Host Snapshot
  - **Panel:** Host is Target of Security Events (Most Recent) (table)
  - **Query Preview:** `| where row_type="host_security_events" and origin_list="target-list" | eval start_time=strftime(strptime(start_time."+0000","%Y-%m-%dT%H:%M:%SZ%z"),"...`

- **Dashboard:** Security Events
  - **Panel:** Top Security Event Types (chart)
  - **Query Preview:** `| rename "event_type_name" as "Security Event Type" | stats count by "Security Event Type"...`

- **Dashboard:** Security Events
  - **Panel:** Top Security Event Sources (chart)
  - **Query Preview:** `| where source_ip!="Multiple Hosts" and not like("$form.subject_ip$", "%" . source_ip . "%") and not like("$form.peer_ip$", "%" . source_ip . "%") | r...`

- **Dashboard:** Security Events
  - **Panel:** Top Security Event Targets (chart)
  - **Query Preview:** `| where target_ip!="Multiple Hosts" and not like("$form.subject_ip$", "%" . target_ip . "%") and not like("$form.peer_ip$", "%" . target_ip . "%") | r...`

- **Dashboard:** Security Events
  - **Panel:** Results (table)
  - **Query Preview:** `| sort 0 - ci_points | eval start_time=strftime(strptime(start_time."+0000","%Y-%m-%dT%H:%M:%SZ%z"),"%Y-%m-%d %H:%M:%S %Z") | eval last_time=strftime(...`

- **Dashboard:** Security Events
  - **Panel:** Untitled (table)

- **Dashboard:** Security Event Descriptions
  - **Panel:** Untitled (table)
  - **Query Preview:** `| sort 0 name | fields "name", "description" | rename "name" as "Name", "description" as "Description"...`

- **Dashboard:** Security Event Descriptions
  - **Panel:** Untitled (table)

---

### Requirement 54: Guest WiFi + Geo correlation (Spaces + Meraki)

**Stated Visualization Support:** No

**Stated Supporting Apps:** Splunk Add-on for Cisco Meraki

**Matched Panels Found:** 20

#### Splunk_TA_cisco_meraki

- **Dashboard:** Access Point
  - **Panel:** Wireless Data Logs (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:accesspoints" $orgid$ 
| rename deviceName as "Device Name", deviceSerial as "Device Serial", category as "Category"...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Ethernet Port Statuses (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$ 
| dedup serial
| rename name as "Device Name", ports{}.name as "Ports Name...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Devices Without Power Connectivity (table)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename power.ac.isConnected as ac , power.poe.isConnected...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** POE Standard Distribution (chart)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename ports{}.poe.standard as "POE Standard"
| stats cou...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Ports Speed (chart)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename ports{}.linkNegotiation.speed as "Port Speed"
| st...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Wireless Device Ethernet Status | Aggregation Status (chart)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename aggregation.enabled as aggregation_enabled
| eval ...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Network Port Speeds (table)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| rename ports{}.linkNegotiation.speed as port_speed, network.id as "Netwo...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Networks with Most PoE Devices (chart)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename power.poe.isConnected as poe_connected, network.id...`

- **Dashboard:** Wireless Devices Ethernet Status
  - **Panel:** Power Mode Distribution (chart)
  - **Query Preview:** ``meraki_index`  sourcetype="meraki:wirelessdevicesethernetstatuses" $orgid$
| dedup serial
| rename power.mode as "Power Mode"
| stats count by "Power...`

- **Dashboard:** Wireless Device Packet Loss
  - **Panel:** Packet Loss By Network (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicespacketlossbydevice" $orgid$ 
| eval direction = mvappend("downstream", "upstream") 
| mvexpand direct...`

- **Dashboard:** Wireless Device Packet Loss
  - **Panel:** Total Packets v/s Lost Packets (chart)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicespacketlossbydevice" $orgid$ 
| eval direction = mvappend("Downstream", "Upstream") 
| mvexpand direct...`

- **Dashboard:** Wireless Device Packet Loss
  - **Panel:** Top Networks with High Packet Loss (table)
  - **Query Preview:** ``meraki_index` sourcetype="meraki:wirelessdevicespacketlossbydevice" $orgid$ 
| rename upstream.lost as upstream_loss ,downstream.lost as downstream_l...`

#### cisco-catalyst-app

- **Dashboard:** Users And Applications
  - **Panel:** Top Users - Wired and Wireless (chart)
  - **Query Preview:** `| tstats `summariesonly`  count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_User_Events by Cisco...`

- **Dashboard:** Users And Applications
  - **Panel:** Guest Authentication (chart)
  - **Matched Keywords:** guest
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Audit Logs for Cisco Meraki (table)
  - **Matched Keywords:** meraki
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count 
  from datamodel=Cisco_Catalyst_App 
  where nodename=Cisco_Catalyst_Dataset.Cisco_Catal...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Meraki Policy Sync (chart)
  - **Matched Keywords:** meraki
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events.ISE...`

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Wireless Signal Metrics (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events by ...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** Client Health Score – Wired and Wireless (chart)
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Client_Inventory_And_...`

- **Dashboard:** Endpoints (Clients)
  - **Panel:** Guest Endpoints (table)
  - **Matched Keywords:** guest
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Performance
  - **Panel:** Audit Logs for Cisco Meraki (table)
  - **Matched Keywords:** meraki
  - **Query Preview:** `| tstats `summariesonly` fillnull_value="N/A" count as Count 
  from datamodel=Cisco_Catalyst_App 
  where nodename=Cisco_Catalyst_Dataset.Cisco_Catal...`

---

### Requirement 55: ThousandEyes assurance metrics

**Stated Visualization Support:** Yes

**Stated Supporting Apps:** Cisco ThousandEyes App for Splunk

**Matched Panels Found:** 10

#### Splunk_TA_cisco_meraki

- **Dashboard:** Appliance VPN Stats
  - **Panel:** VPN Metrics (table)
  - **Matched Keywords:** metrics
  - **Query Preview:** ``meraki_index` sourcetype="meraki:appliancesdwanstatistics" $orgid$
| rename networkId as "Network ID", networkName as "Network Name", merakiVpnPeers{...`

- **Dashboard:** Top Devices
  - **Panel:** Device Usage Metrics (chart)
  - **Matched Keywords:** metrics
  - **Query Preview:** ``meraki_index` sourcetype="meraki:summarytopdevicesbyusage" $orgid$
| dedup name network.id usage.total usage.percentage
| rename name as "Device Name...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Total Alerts (single_value)
  - **Matched Keywords:** assurance
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$ 
| dedup id 
| stats count as "Alert Count"...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Alert Count by Severity (chart)
  - **Matched Keywords:** assurance
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$
| dedup id
| rename severity as "Severity"
| stats count as "Alert Count" by Severity...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Alert Data (table)
  - **Matched Keywords:** assurance
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$ 
| dedup id
| rename id as "Alert Id", startedAt as "Alert Time" , categoryType as "Categor...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Top Affected Networks (table)
  - **Matched Keywords:** assurance
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$
| dedup id
| rename network.name as "Network Name", severity as "Severity Level"
| stats co...`

- **Dashboard:** Assurance Alert Data
  - **Panel:** Top Affected Devices (table)
  - **Matched Keywords:** assurance
  - **Query Preview:** ``meraki_index` sourcetype="meraki:assurancealerts" $orgid$ 
| dedup id 
| rename scope.devices{}.name as "Device Name", severity as "Severity Level" 
...`

- **Dashboard:** Top Clients
  - **Panel:** Client Usage Metrics (in MB) (chart)
  - **Matched Keywords:** metrics
  - **Query Preview:** ``meraki_index` sourcetype="meraki:summarytopclientsbyusage" $orgid$
| dedup id
| rename name as "Client Name" 
| stats values(usage.upstream) as "Usag...`

#### TA_cisco_catalyst

- **Dashboard:** Splunk Resource Utilization
  - **Panel:** Health Monitoring by Input Connection (table)
  - **Query Preview:** `index=_internal sourcetype IN ("splunktaciscocybervision:log", "splunktaciscodnacenter:log", "splunktaciscoise:log", "splunktaciscosdwan:log") host IN...`

#### cisco-catalyst-app

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Wireless Signal Metrics (chart)
  - **Matched Keywords:** metrics
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events by ...`

---

### Requirement 56: Agentic policy heatmap

**Stated Visualization Support:** No

**Stated Supporting Apps:** —

**Matched Panels Found:** 5

#### cisco-catalyst-app

- **Dashboard:** Events And Incident Viewer
  - **Panel:** Meraki Policy Sync (chart)
  - **Matched Keywords:** policy
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Syslog_Events.ISE...`

- **Dashboard:** Overview
  - **Panel:** Top Policy Hits for SD-WAN (chart)
  - **Matched Keywords:** policy
  - **Query Preview:** `| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_...`

- **Dashboard:** Overview
  - **Panel:** Top Policy Set Hits for Cisco ISE (chart)
  - **Matched Keywords:** policy
  - **Query Preview:** `| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Policy_Events by Cisc...`

- **Dashboard:** Security Insights
  - **Panel:** ISE Authentication Policy Chart (chart)
  - **Matched Keywords:** policy
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

- **Dashboard:** Security Insights
  - **Panel:** ISE Authorization Policy Chart (chart)
  - **Matched Keywords:** policy
  - **Query Preview:** `| makeresults 
| append 
    [| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App where nodename=Cisco_Catalyst_Dataset.Cisco_...`

---

## Requirements Without Matching Visualizations

These requirements may need custom dashboard development:

- **Req 16:** Workflow reversions / efficacy
  - Stated Support: No
  - Stated Apps: —

