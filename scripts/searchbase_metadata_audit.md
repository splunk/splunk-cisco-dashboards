# searchbase.conf metadata audit

_Source:_ `packages/splunk-cisco-dashboards/src/main/resources/splunk/default/searchbase.conf`
_Total stanzas:_ **1243**

## Picker-gate (`Cisco` tag) coverage

The overview picker filters the catalogue with `entry.tags.includes('Cisco')` (`KpiPickerPanel.tsx:431`). Anything missing the `Cisco` tag is invisible in the picker UI.

| Bucket | Count |
|---|---:|
| Stanzas with `Cisco` tag (visible in picker) | 0 |
| Stanzas without `Cisco` tag (hidden from picker) | 1243 |

## Missing prose / classification fields

| Field | Stanzas missing | Stanzas with thin content (<5 words) |
|---|---:|---:|
| `description` | 0 | 0 |
| `explanation` | 0 | 0 |
| `solution` | 0 | 0 |
| `related_info` | 0 | 17 |
| `category` | 0 | - |
| `sub_category` | 0 | - |
| `tags` | 0 | - |

### Detail per gap

#### `related_info`

_Thin (<5 words) (17):_

- `[executive_dashboard_ds_building_occupancy_drilldown]`
- `[secure_networking_zta_ise_auth_failure_rate_trend]`
- `[secure_networking_zta_ise_policy_family_activity_trend]`
- `[secure_networking_zta_radius_auth_outcomes_trend]`
- `[secure_networking_zta_radsec_activity_trend]`
- `[secure_networking_zta_duo_auth_outcomes_trend]`
- `[secure_networking_zta_user_activity_source_trend]`
- `[secure_networking_zta_blocked_access_reason_trend]`
- `[secure_networking_meraki_rogue_ap_containment_trend]`
- `[secure_networking_meraki_ssid_encryption_trend]`
- `[secure_networking_trustsec_hardware_inventory_trend]`
- `[secure_networking_sgt_site_activity_trend]`
- `[secure_networking_sgt_device_activity_trend]`
- `[secure_networking_sgt_binding_activity_trend]`
- `[secure_networking_secure_access_dlp_findings_trend]`
- `[secure_networking_thousandeyes_latency_by_agent_trend]`
- `[secure_networking_thousandeyes_http_availability_by_test_trend]`

## Category vocabulary

| Category | Count | Sub-categories |
|---|---:|---|
| `Data Center Networking` | 314 | `ACI Tenant & Policy` (56), `Controller & Site Inventory` (49), `ACI Fabric Health` (39), `Multi-Site Orchestrator` (31), `Nexus 9000 Platform` (27), `ACI Syslog & Events` (22), `Nexus Dashboard Traffic & Flow` (22), `Authentication & Audit` (16), `Nexus Dashboard Interfaces` (16), `Compliance & Advisories` (13), `Nexus Dashboard Syslog` (10), `VMware Integration` (10), `Application Discovery` (3) |
| `Network` | 231 | `Network Intelligence` (21), `Site Connectivity` (17), `Client Health` (13), `Wireless` (13), `Agentic Ops` (13), `Infrastructure` (12), `Network Health` (11), `Site Topology` (10), `Secure Infrastructure` (10), `Issues` (8), `Compliance` (8), `Device Health` (6), `Data Center` (6), `DHCP Capacity` (5), `Client Experience` (5), `Inventory` (4), `SSID Analysis` (4), `Statewide Exercise` (4), `Endpoint Telemetry` (4), `WAN / SD-WAN` (3), `Wireless Capacity` (3), `Client Distribution` (3), `Cisco Spaces` (3), `Topology` (3), `Client Traffic` (3), `Secure Network Segmentation` (3), `Configuration` (2), `Switching` (2), `Interface Stability` (2), `Time Synchronization` (2), `Trend Analysis` (2), `Hybrid Firewall` (2), `Firewall Traffic` (2), `Operational Intelligence` (2), `Client Sessions` (2), `ThousandEyes` (2), `Network Diagnostics` (2), `Syslog` (1), `Routing Stability` (1), `Layer 2 Stability` (1), `Change Management` (1), `External Traffic` (1), `Traffic Analysis` (1), `Interface Utilization` (1), `Device Inventory` (1), `Client Usage` (1), `Routing` (1), `Client OS` (1), `Client Base` (1), `Wireless Quality` (1), `Catalyst Center` (1) |
| `Security` | 211 | `Hybrid Firewall` (28), `XDR` (23), `Firewall` (14), `Network Intelligence` (14), `Secure Infrastructure` (11), `UTD / IPS` (11), `Identity` (11), `ESCU Alerts` (8), `Cloud Security` (7), `IDS / IPS` (7), `Wireless Security` (7), `GenAI Protection` (6), `DNS Security` (4), `PSIRT` (4), `Audit` (4), `Email Security` (3), `Web Security` (3), `Trend Analysis` (3), `SD-WAN Security` (3), `Network Analytics` (3), `Email Threat Defense` (3), `Vulnerability Intelligence` (3), `eBPF Observability` (3), `Zero Trust Access` (3), `Endpoint` (2), `Threat Detection` (2), `Threat Geography` (2), `Compliance` (2), `SD-WAN UTD` (2), `OT Security` (2), `Microsegmentation` (2), `Email Sandbox` (2), `Secure Network Segmentation` (2), `Intrusion Prevention` (1), `Remote Access` (1), `Network Syslog` (1), `Firewall Traffic` (1), `Asset Correlation` (1), `Identity Infrastructure` (1), `Executive Score` (1) |
| `Monitoring` | 131 | `ThousandEyes` (12), `TE Application` (12), `SD-WAN` (10), `TE Network` (10), `Network` (7), `TE Voice` (7), `DNS` (5), `Internet Insights` (5), `Hybrid Firewall` (4), `BGP` (3), `HTTP` (3), `TE Configuration` (3), `Agentic Ops` (3), `Cloud` (2), `Page Load` (2), `API` (2), `SaaS` (2), `Alerts` (2), `Correlation` (2), `SIP` (2), `TE Activity Logs` (2), `TE Alerts` (2), `Streaming Telemetry` (2), `Identity` (2), `Geo` (1), `SASE` (1), `FTP` (1), `Administration` (1), `Traces` (1), `RTP` (1), `Teams` (1), `Zoom` (1), `RoomOS` (1), `Access Points` (1), `General` (1), `Issues` (1), `Device Health` (1), `Site Health` (1), `Switches` (1), `WAN Health` (1), `TE Internet Insights` (1), `Firewall` (1), `Firepower` (1), `Catalyst Center` (1), `Cisco Spaces` (1), `Meraki` (1), `Network Intelligence` (1), `Data Center` (1), `Feed Health` (1) |
| `Identity` | 82 | `Zero Trust Access` (39), `Secure Network Segmentation` (16), `ISE` (7), `ISE + Active Directory` (6), `Active Directory` (5), `ISE Infrastructure` (4), `Secure Infrastructure` (2), `Guest Access` (1), `Account Lockout` (1), `Privileged Access` (1) |
| `Cisco Spaces` | 71 | `Space Occupancy` (13), `Network Health` (13), `Space Optimization` (12), `IoT Sensors` (11), `Device Presence` (9), `Capacity Planning` (5), `Camera Intelligence` (4), `Webex Device Intelligence` (2), `Collaboration Intelligence` (2) |
| `Catalyst Center` | 54 | `Client Health Trends` (14), `Device & Network Health` (13), `Client Traffic & Onboarding` (10), `Issue Tracking` (7), `Client Distribution Analytics` (7), `Executive Summary Analytics` (3) |
| `Building` | 50 | `Cisco Spaces` (11), `Occupancy` (7), `Environmental Sensors` (6), `Presence` (6), `Collaboration` (4), `Safety Sensors` (3), `Wireless` (3), `Wireless Security` (3), `Room Utilization` (2), `Compliance` (1), `Health Score` (1), `Access Points` (1), `Executive Score` (1), `Webex` (1) |
| `IT Health` | 38 | `Issue Tracking` (11), `Device Health` (9), `Client Health` (5), `Device Inventory` (5), `Network Health` (3), `Configuration Auditing` (2), `Network Alerts` (2), `Network Authentication` (1) |
| `NetOps Readiness` | 26 | `Network Readiness Score` (5), `Capacity Planning` (5), `Occupancy Analytics` (5), `Readiness Score Components` (4), `Client Experience` (4), `Issue Tracking` (3) |
| `Asset` | 18 | `Secure Infrastructure` (9), `Inventory` (4), `Secure Network Segmentation` (3), `Hybrid Firewall` (1), `Zero Trust Access` (1) |
| `Workplace` | 8 | `Executive KPI Scorecard` (4), `Trend Analytics` (2), `Issue Tracking` (1), `Site Leaderboard` (1) |
| `ThousandEyes` | 6 | `Network Performance` (3), `Application Performance` (1), `Alerting` (1), `Routing & BGP` (1) |
| `Admin` | 3 | `Troubleshooting` (2), `Macros` (1) |

## Tag vocabulary

_Total distinct tags:_ **598**

| Tag | Count |
|---|---:|
| `Cisco DC Networking` | 314 |
| `Catalyst Center` | 226 |
| `Cisco ACI` | 217 |
| `Secure Networking` | 159 |
| `ThousandEyes` | 121 |
| `Trend` | 82 |
| `IT Health` | 81 |
| `Operations` | 68 |
| `Data Model` | 62 |
| `TStats` | 62 |
| `Firewall` | 61 |
| `KPI` | 53 |
| `Cisco Spaces Intelligence` | 49 |
| `ISE` | 46 |
| `Syslog` | 45 |
| `Cisco Nexus 9000` | 44 |
| `Zero Trust Access` | 43 |
| `Cisco Spaces` | 40 |
| `Executive` | 40 |
| `Dashboard Studio` | 39 |
| `Leaderboard` | 37 |
| `Hybrid Firewall` | 35 |
| `Meraki` | 34 |
| `Secure Infrastructure` | 32 |
| `SD-WAN` | 31 |
| `IOS` | 31 |
| `Endpoint` | 30 |
| `Authentication` | 29 |
| `Sites` | 29 |
| `Machine Learning` | 25 |
| `Security` | 24 |
| `Anomaly` | 24 |
| `Secure Network Segmentation` | 24 |
| `Cisco Nexus Dashboard` | 23 |
| `User Experience` | 22 |
| `Alerts` | 22 |
| `Forecast` | 22 |
| `Identity` | 22 |
| `Events And Incident Viewer` | 21 |
| `FTD` | 21 |
| `Network` | 21 |
| `AttackAnalyzer` | 20 |
| `Application` | 19 |
| `Health Score` | 18 |
| `Firepower` | 18 |
| `SSE` | 18 |
| `Zeek` | 18 |
| `Health` | 17 |
| `FMC` | 17 |
| `SGT` | 17 |
| `Device` | 16 |
| `Active Directory` | 16 |
| `Map` | 16 |
| `Topology` | 16 |
| `HTTP` | 16 |
| `TrustSec` | 16 |
| `Agentic Ops` | 16 |
| `Umbrella` | 15 |
| `Inventory` | 15 |
| `Client` | 15 |
| `Breakdown` | 15 |
| `Duo` | 15 |
| `Forensics` | 14 |
| `SSID` | 13 |
| `DNS` | 13 |
| `Latency` | 13 |
| `Wireless` | 13 |
| `Issues` | 13 |
| `Executive Summary` | 13 |
| `Feed Monitor` | 13 |
| `Signal Rail` | 13 |
| `Feed Health` | 13 |
| `UTD` | 12 |
| `Client Summary` | 12 |
| `Availability` | 12 |
| `Event` | 12 |
| `Session` | 12 |
| `Staleness` | 12 |
| `Lookup Enriched` | 11 |
| `ASA` | 11 |
| `Severity` | 11 |
| `Risk` | 11 |
| `ISE TA` | 11 |
| `DHCP` | 10 |
| `Network Insights` | 10 |
| `Block` | 10 |
| `Readiness` | 10 |
| `Tunnel` | 10 |
| `Building Intelligence` | 10 |
| `VMware` | 10 |
| `Score` | 9 |
| `BGP` | 9 |
| `Nexus Dashboard` | 9 |
| `Policy` | 9 |
| `User` | 8 |
| `Location` | 8 |
| `Reachability` | 8 |
| `Cloud Firewall` | 8 |
| `eStreamer` | 8 |
| `Power` | 8 |
| `Advisory` | 8 |
| `ESCU` | 8 |
| `Voice` | 8 |
| `Multicloud Defense` | 8 |
| `DensityFunction` | 8 |
| `Occupancy` | 8 |
| `Workplace SPOG` | 8 |
| `ZTNA` | 8 |
| `Description Search` | 7 |
| `Email` | 7 |
| `Infrastructure` | 7 |
| `Network Intelligence` | 7 |
| `Utilization` | 7 |
| `Capacity` | 7 |
| `Compliance` | 7 |
| `Capacity Planning` | 7 |
| `Bandwidth` | 7 |
| `RADIUS` | 7 |
| `Collaboration` | 7 |
| `NVM` | 7 |
| `Site` | 7 |
| `Webex` | 6 |
| `BEC query` | 6 |
| `Audit` | 6 |
| `AP` | 6 |
| `Client Health` | 6 |
| `Loss` | 6 |
| `Jitter` | 6 |
| `Access Points` | 6 |
| `Critical` | 6 |
| `Link` | 6 |
| `Topology Link` | 6 |
| `Errors` | 6 |
| `Malware` | 6 |
| `AI Defense` | 6 |
| `GenAI` | 6 |
| `Lease` | 6 |
| `LLP5` | 6 |
| `Footprint` | 6 |
| `Cloud Security` | 5 |
| `Secure Access` | 5 |
| `Device Health` | 5 |
| `Traffic` | 5 |
| `Throughput` | 5 |
| `Distribution` | 5 |
| `Connectivity` | 5 |
| `FTP` | 5 |
| `Threat Categories` | 5 |
| `Files` | 5 |
| `ACI` | 5 |
| `Prediction` | 5 |
| `RandomForest` | 5 |
| `TA Stock Dashboard` | 5 |
| `Enforcement` | 5 |
| `Cisco Secure Access` | 5 |
| `NDFC` | 5 |
| `Performance` | 4 |
| `Signatures` | 4 |
| `IDS` | 4 |
| `IPS` | 4 |
| `Comparison` | 4 |
| `Assets` | 4 |
| `Onboarding` | 4 |
| `Wired` | 4 |
| `Correlation` | 4 |
| `Destinations` | 4 |
| `Topology Site` | 4 |
| `Baseline` | 4 |
| `SIP` | 4 |
| `AMP` | 4 |
| `Anomalies` | 4 |
| `Posture` | 4 |
| `Cyber Vision` | 4 |
| `Vulnerabilities` | 4 |
| `TLS` | 4 |
| `Jobs` | 4 |
| `Camera` | 4 |
| `IoT` | 4 |
| `MFA` | 4 |
| `Rogue AP` | 4 |
| `NAC` | 4 |
| `RaVPN` | 4 |
| `Data Center` | 4 |
| `MAC` | 3 |
| `Trust` | 3 |
| `Rogue` | 3 |
| `WSA` | 3 |
| `Routing` | 3 |
| `Protocol` | 3 |
| `Client Count` | 3 |
| `Interfaces` | 3 |
| `AAA` | 3 |
| `Overview` | 3 |
| `Timeline` | 3 |
| `CVE` | 3 |
| `Agent to Agent` | 3 |
| `Path Change` | 3 |
| `Activity Logs` | 3 |
| `Agent Location Match` | 3 |
| `Geo Enriched` | 3 |
| `Quality` | 3 |
| `Hardware` | 3 |
| `Agent` | 3 |
| `API` | 3 |
| `Configuration Status` | 3 |
| `RTP` | 3 |
| `SIG` | 3 |
| `Audit Logs` | 3 |
| `URLs` | 3 |
| `DLP` | 3 |
| `Administrators` | 3 |
| `Administrator Users Search` | 3 |
| `Activities` | 3 |
| `Fabric` | 3 |
| `PSIRT` | 3 |
| `Tetration` | 3 |
| `Stealthwatch` | 3 |
| `SNA` | 3 |
| `Alarms` | 3 |
| `Hosts` | 3 |
| `ETD` | 3 |
| `Processes` | 3 |
| `CVI` | 3 |
| `Isovalent` | 3 |
| `Tetragon` | 3 |
| `Telemetry` | 3 |
| `Advanced Logging` | 3 |
| `Intrusions` | 3 |
| `Matrix` | 3 |
| `Temperature` | 3 |
| `Workplace` | 3 |
| `ROI` | 3 |
| `Surge` | 3 |
| `Threat` | 3 |
| `IP-SGT Bindings` | 3 |
| `SGACL` | 3 |
| `Cisco Catalyst App Security Insights` | 3 |
| `Failure` | 3 |
| `Remote Access VPN` | 3 |
| `Cisco Security Cloud` | 3 |
| `SXP` | 3 |
| `NGFW` | 3 |
| `Failure Rate` | 3 |
| `Network Device` | 3 |
| `Test` | 3 |
| `Network Performance` | 3 |
| `Application Health` | 3 |
| `Sensor Data` | 2 |
| `Room` | 2 |
| `Status` | 2 |
| `Lookup` | 2 |
| `ESA` | 2 |
| `Defender` | 2 |
| `802.1X` | 2 |
| `MAC Steal` | 2 |
| `Port Flapping` | 2 |
| `OSPF` | 2 |
| `EIGRP` | 2 |
| `STP` | 2 |
| `NTP` | 2 |
| `Time Drift` | 2 |
| `Network Health` | 2 |
| `Top Talkers` | 2 |
| `Port` | 2 |
| `Pool Exhaustion` | 2 |
| `Scope` | 2 |
| `Guest` | 2 |
| `Usage` | 2 |
| `Coverage` | 2 |
| `CPU` | 2 |
| `Optimization` | 2 |
| `Regional` | 2 |
| `DNSSEC` | 2 |
| `Trace` | 2 |
| `Proxy` | 2 |
| `Response Time` | 2 |
| `Completion` | 2 |
| `M365` | 2 |
| `ServiceNow` | 2 |
| `MOS` | 2 |
| `Presence` | 2 |
| `Site Health` | 2 |
| `Switches` | 2 |
| `Building` | 2 |
| `XDR` | 2 |
| `Site Leaderboard` | 2 |
| `Legacy KPI` | 2 |
| `A2A` | 2 |
| `Raw Events` | 2 |
| `Healthy` | 2 |
| `Warning` | 2 |
| `Lookup Join` | 2 |
| `Critical Sites` | 2 |
| `Metric` | 2 |
| `Health Threshold` | 2 |
| `Page Load` | 2 |
| `Web Transaction` | 2 |
| `Domain Score` | 2 |
| `Policies` | 2 |
| `URL Filter` | 2 |
| `Container` | 2 |
| `CVSS` | 2 |
| `Secure Workload` | 2 |
| `SMA` | 2 |
| `Submissions` | 2 |
| `Faults` | 2 |
| `Rules` | 2 |
| `Tracebacks` | 2 |
| `Crashes` | 2 |
| `Queries` | 2 |
| `Certificates` | 2 |
| `Strings` | 2 |
| `Resources` | 2 |
| `Tasks` | 2 |
| `Telephony` | 2 |
| `SMS` | 2 |
| `Detections` | 2 |
| `Intrusion Events - Alert Message` | 2 |
| `Multivariate` | 2 |
| `HVAC` | 2 |
| `NOC` | 2 |
| `Booking` | 2 |
| `Waste` | 2 |
| `Heatmap` | 2 |
| `Weekly` | 2 |
| `Monday` | 2 |
| `vManage` | 2 |
| `Cross-Source` | 2 |
| `Wireless Security` | 2 |
| `TACACS` | 2 |
| `Cisco IOS` | 2 |
| `Router` | 2 |
| `VRF` | 2 |
| `VLAN` | 2 |
| `VXLAN` | 2 |
| `VPN` | 2 |
| `RadSec` | 2 |
| `Exposure` | 2 |
| `Failures` | 2 |
| `Outcome` | 2 |
| `DNS Security` | 2 |
| `Investigation` | 2 |
| `NAD` | 2 |
| `Device Posture` | 2 |
| `Blocked Access` | 2 |
| `Containment` | 2 |
| `WLAN` | 2 |
| `Encryption` | 2 |
| `Branch` | 2 |
| `Packet Loss` | 2 |
| `SaaS` | 2 |
| `Hierarchy` | 1 |
| `Device Family` | 1 |
| `Network Compliance` | 1 |
| `Lockout` | 1 |
| `Traffic Direction` | 1 |
| `Detail` | 1 |
| `Scanning` | 1 |
| `Brute Force` | 1 |
| `SSH` | 1 |
| `Exfiltration` | 1 |
| `MAC Flap` | 1 |
| `Config Change` | 1 |
| `Error Disable` | 1 |
| `Traffic Action` | 1 |
| `External IP` | 1 |
| `Volume` | 1 |
| `Windows DHCP` | 1 |
| `Lease Rate` | 1 |
| `NACK` | 1 |
| `Snooping` | 1 |
| `Threshold` | 1 |
| `Disconnect` | 1 |
| `Triage` | 1 |
| `Non Compliant` | 1 |
| `Band` | 1 |
| `Health Distribution` | 1 |
| `OS` | 1 |
| `Priority` | 1 |
| `RF` | 1 |
| `Spectrum` | 1 |
| `Interference` | 1 |
| `Memory` | 1 |
| `History` | 1 |
| `Uptime` | 1 |
| `Spanning Tree` | 1 |
| `Linkgraph` | 1 |
| `Role` | 1 |
| `Remediation` | 1 |
| `Roaming` | 1 |
| `Cache` | 1 |
| `Schedule` | 1 |
| `Tuning` | 1 |
| `Configuration` | 1 |
| `Macros` | 1 |
| `Index Management` | 1 |
| `WAN` | 1 |
| `Quality Score` | 1 |
| `Resolution` | 1 |
| `Provider Comparison` | 1 |
| `Delegation` | 1 |
| `Outage` | 1 |
| `ISP` | 1 |
| `ITSI` | 1 |
| `Workforce` | 1 |
| `Overlay` | 1 |
| `Underlay` | 1 |
| `Zscaler` | 1 |
| `CDN` | 1 |
| `Path Visualization` | 1 |
| `Duration` | 1 |
| `Salesforce` | 1 |
| `OTel` | 1 |
| `Spans` | 1 |
| `APM` | 1 |
| `Root Cause` | 1 |
| `MTTR` | 1 |
| `MTTI` | 1 |
| `Registration` | 1 |
| `Voice Quality` | 1 |
| `Summary` | 1 |
| `Operations Pressure` | 1 |
| `Incidents` | 1 |
| `Binding` | 1 |
| `Link Availability` | 1 |
| `Link Events` | 1 |
| `Discards` | 1 |
| `Tier Health` | 1 |
| `GPS` | 1 |
| `Major` | 1 |
| `Internet Insights` | 1 |
| `Threat Intel` | 1 |
| `Active Devices` | 1 |
| `Wi-Fi` | 1 |
| `Collab` | 1 |
| `Circuits` | 1 |
| `Transport` | 1 |
| `Down` | 1 |
| `Users And Applications` | 1 |
| `Models` | 1 |
| `MITRE` | 1 |
| `Messages` | 1 |
| `Gateways` | 1 |
| `FQDNs` | 1 |
| `WAF` | 1 |
| `AV` | 1 |
| `Tenant` | 1 |
| `Factors` | 1 |
| `Trust Monitor` | 1 |
| `Dormant` | 1 |
| `Vendors` | 1 |
| `Verdict` | 1 |
| `Threat Score` | 1 |
| `Exploits` | 1 |
| `Codes` | 1 |
| `Namespaces` | 1 |
| `Workloads` | 1 |
| `Resolvers` | 1 |
| `Encrypted` | 1 |
| `Flow` | 1 |
| `Notices` | 1 |
| `Domains` | 1 |
| `Services` | 1 |
| `Egress` | 1 |
| `LOLBins` | 1 |
| `IOC` | 1 |
| `Watchlist` | 1 |
| `Lineage` | 1 |
| `Protocol Anomaly` | 1 |
| `Notice` | 1 |
| `Policy Alert` | 1 |
| `Connection` | 1 |
| `Packets` | 1 |
| `Crypto` | 1 |
| `QUIC` | 1 |
| `Logins` | 1 |
| `LateralMovement` | 1 |
| `Pivot` | 1 |
| `Abuse` | 1 |
| `Burst` | 1 |
| `Beacon` | 1 |
| `Cadence` | 1 |
| `Endace` | 1 |
| `DataQuality` | 1 |
| `SOC` | 1 |
| `Outlier` | 1 |
| `Desk` | 1 |
| `Area` | 1 |
| `Active Calls` | 1 |
| `SLA` | 1 |
| `Dead Zone` | 1 |
| `Underutilized` | 1 |
| `Eliminate` | 1 |
| `Repurpose` | 1 |
| `Ghost Booking` | 1 |
| `No-Show` | 1 |
| `Efficiency` | 1 |
| `Right-Sizing` | 1 |
| `Recommendation` | 1 |
| `Hotspot` | 1 |
| `Gathering` | 1 |
| `Break Room` | 1 |
| `Cafe` | 1 |
| `Fingerprint` | 1 |
| `Informal` | 1 |
| `Spontaneous` | 1 |
| `Behavior` | 1 |
| `Idle` | 1 |
| `Cost` | 1 |
| `Seat-Hours` | 1 |
| `Recurring` | 1 |
| `Z-Score` | 1 |
| `Firehose` | 1 |
| `NDR` | 1 |
| `All Feeds` | 1 |
| `Security Insights` | 1 |
| `IDS/IPS` | 1 |
| `Intrusion Detection` | 1 |
| `Organizations Security` | 1 |
| `LDOS` | 1 |
| `Deny` | 1 |
| `Meraki TA` | 1 |
| `Licensing` | 1 |
| `MAC OUI` | 1 |
| `Cyber Vision TA` | 1 |
| `OT` | 1 |
| `Asset Visibility` | 1 |
| `Network Access` | 1 |
| `Collection Gap` | 1 |
| `Rollup` | 1 |
| `Profile` | 1 |
| `Clients` | 1 |
| `Sessions` | 1 |
| `Connection Rate` | 1 |
| `Logs` | 1 |
| `Cisco Duo` | 1 |
| `Admin Activity` | 1 |
| `Identity Provider` | 1 |
| `Secure Endpoint` | 1 |
| `Incident` | 1 |
| `Blocked` | 1 |
| `Application Access` | 1 |
| `Cisco Intersight` | 1 |
| `EOL` | 1 |
| `Cisco Secure Client` | 1 |
| `File Inspection` | 1 |
| `File Hash` | 1 |
| `Access Control` | 1 |
| `Policy Hit Count` | 1 |
| `Access Control Policy` | 1 |
| `Action Distribution` | 1 |
| `Application Detection` | 1 |
| `App-ID` | 1 |
| `Platform` | 1 |
| `Security Zones` | 1 |
| `Traffic Flow` | 1 |
| `East-West` | 1 |
| `North-South` | 1 |
| `Assignment` | 1 |
| `Unique` | 1 |
| `Classification` | 1 |
| `Denial` | 1 |
| `Secure Client` | 1 |
| `Remote Access` | 1 |
| `Policy Outcome` | 1 |
| `Connection Status` | 1 |
| `Policy Set` | 1 |
| `Authorization` | 1 |
| `Fabric Health` | 1 |
| `WLAN Security` | 1 |
| `Unencrypted` | 1 |
| `BSSID` | 1 |
| `Sites Health` | 1 |
| `Network Visibility` | 1 |
| `Observability` | 1 |
| `Cloud Native Security` | 1 |
| `AWS` | 1 |
| `Azure` | 1 |
| `GCP` | 1 |
| `Threats` | 1 |
| `Video` | 1 |
| `Remote` | 1 |
| `MR` | 1 |
| `Association` | 1 |
| `Firewall Count` | 1 |
| `WAN Edge` | 1 |
| `Stability` | 1 |
| `Internet` | 1 |
| `ITSM` | 1 |
| `Ticket Management` | 1 |
| `Ingest Volume` | 1 |
| `License Usage` | 1 |
| `IPSEC` | 1 |
| `Cisco Secure Workload` | 1 |
| `Micro-Segmentation` | 1 |
| `User Activity` | 1 |
| `Air Marshal` | 1 |
| `Findings` | 1 |

