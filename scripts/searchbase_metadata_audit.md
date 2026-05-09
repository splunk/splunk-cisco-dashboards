# searchbase.conf metadata audit

_Source:_ `packages/splunk-cisco-dashboards/src/main/resources/splunk/default/searchbase.conf`
_Total stanzas:_ **414**

## Picker-gate (`Cisco` tag) coverage

The overview picker filters the catalogue with `entry.tags.includes('Cisco')` (`KpiPickerPanel.tsx:431`). Anything missing the `Cisco` tag is invisible in the picker UI.

| Bucket | Count |
|---|---:|
| Stanzas with `Cisco` tag (visible in picker) | 112 |
| Stanzas without `Cisco` tag (hidden from picker) | 302 |

## Missing prose / classification fields

| Field | Stanzas missing | Stanzas with thin content (<5 words) |
|---|---:|---:|
| `description` | 0 | 0 |
| `explanation` | 0 | 0 |
| `solution` | 0 | 0 |
| `related_info` | 0 | 0 |
| `category` | 0 | - |
| `sub_category` | 0 | - |
| `tags` | 0 | - |

## Category vocabulary

| Category | Count | Sub-categories |
|---|---:|---|
| `Network` | 164 | `Client Health` (14), `Wireless` (13), `Infrastructure` (12), `Network Health` (10), `Network Intelligence` (8), `Compliance` (7), `Site Connectivity` (7), `Device Health` (5), `DHCP Capacity` (5), `Inventory` (4), `WAN / SD-WAN` (4), `Firewall Traffic` (4), `Issues` (4), `Client Distribution` (4), `Client Experience` (4), `Client Traffic` (4), `Statewide Exercise` (4), `Site Topology` (4), `Wireless Capacity` (3), `Operational Intelligence` (3), `Topology` (3), `SSID Analysis` (3), `Client Sessions` (3), `Configuration` (2), `Switching` (2), `Syslog` (2), `Interface Stability` (2), `Routing Stability` (2), `Trend Analysis` (2), `Client Usage` (2), `Client Trend` (2), `Cisco Spaces` (2), `Guest/Wireless` (2), `Layer 2 Stability` (1), `Time Synchronization` (1), `Change Management` (1), `External Traffic` (1), `Traffic Analysis` (1), `Interface Utilization` (1), `Device Inventory` (1), `Catalyst Center` (1), `Routing` (1), `Client OS` (1), `Client Base` (1), `Wireless Quality` (1) |
| `Monitoring` | 86 | `Internet_Insights` (6), `Network` (5), `BGP` (5), `DNS` (5), `Endpoint` (5), `ThousandEyes` (4), `Cloud` (3), `HTTP` (3), `DHCP` (3), `Path_Visualization` (2), `Page_Load` (2), `API` (2), `Transactions` (2), `SaaS` (2), `Alerts` (2), `Administration` (2), `ITSI` (2), `Correlation` (2), `SIP` (2), `Issues` (2), `Device Health` (2), `Interface Health` (2), `Routing` (2), `WAN Health` (2), `SD-WAN` (1), `SASE` (1), `FTP` (1), `Traces` (1), `RTP` (1), `Webex` (1), `Teams` (1), `Zoom` (1), `RoomOS` (1), `Access Points` (1), `General` (1), `Configuration` (1), `NTP` (1), `Site Health` (1), `Switches` (1), `Syslog` (1), `Network Health` (1) |
| `Security` | 63 | `Firewall` (12), `ESCU Alerts` (8), `XDR` (5), `DNS Security` (4), `PSIRT` (4), `Email Security` (3), `IDS / IPS` (3), `Wireless Security` (3), `Endpoint` (2), `Web Security` (2), `Threat Detection` (2), `Trend Analysis` (2), `Threat Geography` (2), `Compliance` (2), `Cloud Security` (1), `UTD / IPS` (1), `Intrusion Prevention` (1), `Remote Access` (1), `Network Syslog` (1), `Firewall Traffic` (1), `Asset Correlation` (1), `Identity Infrastructure` (1), `SD-WAN UTD` (1) |
| `Executive` | 30 | `Executive Dashboard` (20), `Site Connectivity` (4), `Site Operations` (3), `Site Leaderboard` (2), `Issue Overview` (1) |
| `Identity` | 29 | `ISE` (11), `ISE + Active Directory` (6), `Active Directory` (6), `Privileged Access` (3), `Guest Access` (1), `Failed Authentication` (1), `Account Lockout` (1) |
| `Building` | 24 | `Environmental Sensors` (6), `Cisco Spaces` (4), `Safety Sensors` (3), `Collaboration` (2), `Wireless` (2), `Presence` (2), `Occupancy` (2), `Health Score` (1), `Access Points` (1), `Room Utilization` (1) |
| `Demo` | 8 | `Topology Site` (3), `Topology Link` (3), `Site Leaderboard` (2) |
| `Asset` | 4 | `Inventory` (4) |
| `Admin` | 3 | `Troubleshooting` (2), `Macros` (1) |
| `Shared` | 2 | `Nav Dashboard` (2) |
| `Building Resilience` | 1 | `Nav Dashboard` (1) |

## Tag vocabulary

_Total distinct tags:_ **288**

| Tag | Count |
|---|---:|
| `Catalyst_Center` | 120 |
| `Cisco` | 112 |
| `Security` | 79 |
| `ThousandEyes` | 65 |
| `IT_Health` | 65 |
| `TEUC` | 61 |
| `Trend` | 42 |
| `Executive` | 42 |
| `KPI` | 34 |
| `Firewall` | 28 |
| `Network` | 26 |
| `Building` | 23 |
| `Health_Score` | 20 |
| `ISE` | 20 |
| `IT` | 20 |
| `Active_Directory` | 19 |
| `Meraki` | 17 |
| `Site` | 17 |
| `Topology` | 17 |
| `Spaces` | 15 |
| `IOS` | 15 |
| `Map` | 15 |
| `Detail` | 14 |
| `User_Experience` | 14 |
| `Executive_Summary` | 14 |
| `Wireless` | 13 |
| `Issues` | 13 |
| `Client_Summary` | 13 |
| `Identity` | 13 |
| `UX` | 12 |
| `Lookup_Enriched` | 11 |
| `DNAC` | 11 |
| `Client` | 11 |
| `DHCP` | 10 |
| `SSID` | 9 |
| `DNS` | 9 |
| `Network_Intelligence` | 9 |
| `Bandwidth` | 9 |
| `SD-WAN` | 8 |
| `BGP` | 8 |
| `Power` | 8 |
| `ESCU` | 8 |
| `Alert` | 8 |
| `Intelligence` | 8 |
| `Demo` | 8 |
| `Accelerated` | 7 |
| `XDR` | 7 |
| `Compliance` | 7 |
| `ASA` | 6 |
| `Firepower` | 6 |
| `Umbrella` | 6 |
| `Timechart` | 6 |
| `Internet_Insights` | 6 |
| `Endpoint` | 6 |
| `Topology_Site` | 6 |
| `Link` | 6 |
| `Topology_Link` | 6 |
| `Connectivity` | 6 |
| `Webex` | 5 |
| `Inventory` | 5 |
| `Reachability` | 5 |
| `AP` | 5 |
| `Network_Activation` | 5 |
| `Traffic` | 5 |
| `Availability` | 5 |
| `FTD` | 4 |
| `Requires_Cisco_ThousandEyes_DM` | 4 |
| `Severity` | 4 |
| `Routing` | 4 |
| `Comparison` | 4 |
| `Capacity` | 4 |
| `Events` | 4 |
| `Statewide` | 4 |
| `Overview` | 4 |
| `Site_Leaderboard` | 4 |
| `Leaderboard` | 4 |
| `Cisco_Spaces` | 3 |
| `Location` | 3 |
| `Lookup` | 3 |
| `Device_Health` | 3 |
| `Geolocation` | 3 |
| `Utilization` | 3 |
| `Client_Health` | 3 |
| `24h` | 3 |
| `Collaboration` | 3 |
| `Admin` | 3 |
| `Path_Visualization` | 3 |
| `Alerts` | 3 |
| `Correlation` | 3 |
| `ITSI` | 3 |
| `Cloud` | 3 |
| `Throughput` | 3 |
| `HTTP` | 3 |
| `Completion` | 3 |
| `Sessions` | 3 |
| `Tallahassee` | 3 |
| `Orlando` | 3 |
| `Auburndale` | 3 |
| `Nav_Dashboard` | 3 |
| `Migrated_From_SavedSearch` | 3 |
| `Presence` | 2 |
| `Devices` | 2 |
| `ESA` | 2 |
| `Authentication` | 2 |
| `WSA` | 2 |
| `Syslog` | 2 |
| `OSPF` | 2 |
| `EIGRP` | 2 |
| `STP` | 2 |
| `Audit` | 2 |
| `Network_Health` | 2 |
| `Protocol` | 2 |
| `Guest` | 2 |
| `Capacity_Planning` | 2 |
| `Client_Count` | 2 |
| `WAN` | 2 |
| `AAA` | 2 |
| `Priority` | 2 |
| `Onboarding` | 2 |
| `Health` | 2 |
| `Wired` | 2 |
| `Asset_Inventory` | 2 |
| `Timeline` | 2 |
| `Advisory` | 2 |
| `Performance` | 2 |
| `Path_Change` | 2 |
| `Regional` | 2 |
| `Response_Time` | 2 |
| `Page_Load` | 2 |
| `Duration` | 2 |
| `API` | 2 |
| `Transactions` | 2 |
| `Errors` | 2 |
| `SaaS` | 2 |
| `M365` | 2 |
| `Distribution` | 2 |
| `Administration` | 2 |
| `SIP` | 2 |
| `Asset` | 2 |
| `Healthy` | 2 |
| `Warning` | 2 |
| `Critical` | 2 |
| `Clients` | 2 |
| `Lookup_Join` | 2 |
| `Users` | 1 |
| `Rooms` | 1 |
| `Hierarchy` | 1 |
| `Device_Family` | 1 |
| `Score` | 1 |
| `Status` | 1 |
| `Cisco_Cloud_Security` | 1 |
| `Secure_Access` | 1 |
| `Cloud_Firewall` | 1 |
| `Lockout` | 1 |
| `Rogue` | 1 |
| `802.1X` | 1 |
| `MAC_Steal` | 1 |
| `IPS` | 1 |
| `eStreamer` | 1 |
| `Scanning` | 1 |
| `Brute_Force` | 1 |
| `SSH` | 1 |
| `Exfiltration` | 1 |
| `Port_Flapping` | 1 |
| `MAC_Flap` | 1 |
| `NTP` | 1 |
| `Time_Drift` | 1 |
| `Config_Change` | 1 |
| `Error_Disable` | 1 |
| `Traffic_Action` | 1 |
| `External_IP` | 1 |
| `Countries` | 1 |
| `Top_Talkers` | 1 |
| `Ports` | 1 |
| `Blocked` | 1 |
| `Volume` | 1 |
| `Assets` | 1 |
| `Pool_Exhaustion` | 1 |
| `Windows_DHCP` | 1 |
| `Lease_Rate` | 1 |
| `NACK` | 1 |
| `Scope` | 1 |
| `Pool_Exhausted` | 1 |
| `Snooping` | 1 |
| `Threshold` | 1 |
| `Interface` | 1 |
| `Disconnect` | 1 |
| `RADIUS` | 1 |
| `Triage` | 1 |
| `NON_COMPLIANT` | 1 |
| `Report` | 1 |
| `Device_Type` | 1 |
| `Band` | 1 |
| `Health_Distribution` | 1 |
| `Usage` | 1 |
| `OS` | 1 |
| `Coverage` | 1 |
| `RF` | 1 |
| `Spectrum` | 1 |
| `Interference` | 1 |
| `CPU` | 1 |
| `Memory` | 1 |
| `Reporting` | 1 |
| `History` | 1 |
| `Uptime` | 1 |
| `Spanning_Tree` | 1 |
| `Linkgraph` | 1 |
| `Role` | 1 |
| `Remediation` | 1 |
| `CVE` | 1 |
| `Roaming` | 1 |
| `Cache` | 1 |
| `Schedule` | 1 |
| `Optimization` | 1 |
| `Macros` | 1 |
| `Index` | 1 |
| `Tuning` | 1 |
| `Configuration` | 1 |
| `Latency` | 1 |
| `Loss` | 1 |
| `Jitter` | 1 |
| `Agent_to_Agent` | 1 |
| `Hops` | 1 |
| `Quality_Score` | 1 |
| `Updates` | 1 |
| `AS_Path` | 1 |
| `Resolution` | 1 |
| `DNSSEC` | 1 |
| `Provider_Comparison` | 1 |
| `Trace` | 1 |
| `Delegation` | 1 |
| `Outage` | 1 |
| `ISP` | 1 |
| `Proxy` | 1 |
| `Agent` | 1 |
| `Experience_Score` | 1 |
| `Remote_Worker` | 1 |
| `VPN` | 1 |
| `Connection_Type` | 1 |
| `Geographic` | 1 |
| `Workforce` | 1 |
| `Overlay` | 1 |
| `Underlay` | 1 |
| `SASE` | 1 |
| `Zscaler` | 1 |
| `AWS` | 1 |
| `Azure` | 1 |
| `GCP` | 1 |
| `CDN` | 1 |
| `Salesforce` | 1 |
| `ServiceNow` | 1 |
| `FTP` | 1 |
| `Activity_Log` | 1 |
| `Pipeline` | 1 |
| `Service_Health` | 1 |
| `On_Call` | 1 |
| `Incidents` | 1 |
| `Traces` | 1 |
| `OTel` | 1 |
| `Spans` | 1 |
| `APM` | 1 |
| `Root_Cause` | 1 |
| `MTTR` | 1 |
| `MTTI` | 1 |
| `Registration` | 1 |
| `RTP` | 1 |
| `MOS` | 1 |
| `Voice_Quality` | 1 |
| `Meeting_Quality` | 1 |
| `Teams` | 1 |
| `Readiness` | 1 |
| `Zoom` | 1 |
| `RoomOS` | 1 |
| `Email` | 1 |
| `IDS` | 1 |
| `PSIRT` | 1 |
| `Vulnerability` | 1 |
| `Summary` | 1 |
| `Requires_Data_Source` | 1 |
| `Link_Availability` | 1 |
| `Link_Events` | 1 |
| `Discards` | 1 |
| `Quality` | 1 |
| `Hardware` | 1 |
| `Tier_Health` | 1 |
| `GPS` | 1 |
| `Drift` | 1 |
| `Configuration_Audit` | 1 |

