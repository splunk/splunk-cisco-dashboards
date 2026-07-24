# searchbase.conf metadata audit

_Source:_ `packages/splunk-cisco-dashboards/src/main/resources/splunk/default/searchbase.conf`
_Total stanzas:_ **913**

## Picker-gate (`Cisco` tag) coverage

The overview picker filters the catalogue with `entry.tags.includes('Cisco')` (`KpiPickerPanel.tsx:431`). Anything missing the `Cisco` tag is invisible in the picker UI.

| Bucket | Count |
|---|---:|
| Stanzas with `Cisco` tag (visible in picker) | 2 |
| Stanzas without `Cisco` tag (hidden from picker) | 911 |

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
| `Network` | 222 | `Network Intelligence` (20), `Site Connectivity` (17), `Wireless` (14), `Client Health` (13), `Infrastructure` (12), `Network Health` (11), `Site Topology` (10), `Agentic Ops` (10), `Compliance` (8), `Secure Infrastructure` (8), `Issues` (7), `Device Health` (6), `Data Center` (6), `DHCP Capacity` (5), `Client Experience` (5), `Inventory` (4), `SSID Analysis` (4), `Statewide Exercise` (4), `WAN / SD-WAN` (3), `Firewall Traffic` (3), `Wireless Capacity` (3), `Client Distribution` (3), `Topology` (3), `Client Traffic` (3), `Endpoint Telemetry` (3), `Configuration` (2), `Switching` (2), `Interface Stability` (2), `Trend Analysis` (2), `Operational Intelligence` (2), `Catalyst Center` (2), `Cisco Spaces` (2), `Client Sessions` (2), `ThousandEyes` (2), `Network Diagnostics` (2), `Syslog` (1), `Routing Stability` (1), `Layer 2 Stability` (1), `Time Synchronization` (1), `Change Management` (1), `External Traffic` (1), `Traffic Analysis` (1), `IOS` (1), `Interface Utilization` (1), `Device Inventory` (1), `Client Usage` (1), `Routing` (1), `Client OS` (1), `Client Base` (1), `Wireless Quality` (1), `Hybrid Mesh Firewalling` (1), `Scalable Network Segmentation` (1) |
| `Security` | 218 | `XDR` (38), `Hybrid Mesh Firewalling` (22), `Dashboard Studio Same-Root Reconciliation` (16), `Network Intelligence` (15), `UTD / IPS` (11), `Firewall` (10), `Cloud Security` (8), `ESCU Alerts` (8), `Secure Infrastructure` (8), `Dashboard Studio Reconciliation` (7), `IDS / IPS` (6), `GenAI Protection` (6), `Wireless Security` (5), `DNS Security` (4), `Audit` (4), `PSIRT` (3), `Trend Analysis` (3), `SD-WAN Security` (3), `Network Analytics` (3), `Email Threat Defense` (3), `Vulnerability Intelligence` (3), `eBPF Observability` (3), `Email Security` (2), `Endpoint` (2), `Web Security` (2), `Threat Detection` (2), `Threat Geography` (2), `Compliance` (2), `OT Security` (2), `Microsegmentation` (2), `Email Sandbox` (2), `Scalable Network Segmentation` (2), `Intrusion Prevention` (1), `Remote Access` (1), `Network Syslog` (1), `Firewall Traffic` (1), `Asset Correlation` (1), `Identity Infrastructure` (1), `SD-WAN UTD` (1), `Identity` (1), `Executive Score` (1) |
| `Monitoring` | 130 | `SD-WAN` (14), `ThousandEyes` (12), `TE Application` (11), `TE Network` (10), `Network` (7), `TE Voice` (7), `DNS` (5), `Internet Insights` (5), `BGP` (3), `HTTP` (3), `TE Configuration` (3), `Agentic Ops` (3), `Cloud` (2), `Page Load` (2), `API` (2), `SaaS` (2), `Alerts` (2), `Correlation` (2), `SIP` (2), `TE Activity Logs` (2), `TE Alerts` (2), `Streaming Telemetry` (2), `Identity` (2), `Geo` (1), `SASE` (1), `FTP` (1), `Administration` (1), `Traces` (1), `RTP` (1), `Teams` (1), `Zoom` (1), `RoomOS` (1), `Access Points` (1), `General` (1), `Issues` (1), `Device Health` (1), `Site Health` (1), `Switches` (1), `WAN Health` (1), `TE Internet Insights` (1), `Firewall` (1), `Firepower` (1), `Catalyst Center` (1), `Cisco Spaces` (1), `Meraki` (1), `Network Intelligence` (1), `Data Center` (1), `Feed Health` (1) |
| `Cisco Spaces` | 72 | `Dashboard Studio Reconciliation` (26), `Dashboard Studio Same-Root Reconciliation` (23), `Space Optimization` (5), `Camera Intelligence` (4), `IoT Sensors` (3), `Space Occupancy` (3), `Capacity Planning` (3), `Webex Device Intelligence` (2), `Collaboration Intelligence` (2), `Device Presence` (1) |
| `Identity` | 66 | `Zero Trust Access` (18), `Scalable Network Segmentation` (13), `Duo MFA` (9), `ISE` (8), `ISE + Active Directory` (5), `Active Directory` (5), `ISE Infrastructure` (4), `Privileged Access` (2), `Guest Access` (1), `Account Lockout` (1) |
| `Network Activation` | 54 | `Dashboard Studio Same-Root Reconciliation` (40), `Dashboard Studio Reconciliation` (14) |
| `Building` | 50 | `Dashboard Studio Same-Root Reconciliation` (9), `Cisco Spaces` (7), `Environmental Sensors` (6), `Occupancy` (6), `Presence` (5), `Safety Sensors` (3), `Wireless Security` (3), `Collaboration` (2), `Wireless` (2), `Compliance` (1), `Health Score` (1), `Access Points` (1), `Room Utilization` (1), `Executive Score` (1), `Webex` (1), `Dashboard Studio Reconciliation` (1) |
| `IT Health` | 39 | `Dashboard Studio Reconciliation` (21), `Dashboard Studio Same-Root Reconciliation` (18) |
| `NetOps Readiness` | 26 | `Dashboard Studio Same-Root Reconciliation` (21), `Dashboard Studio Reconciliation` (5) |
| `Asset` | 18 | `Secure Infrastructure` (9), `Inventory` (4), `Scalable Network Segmentation` (2), `Endpoint Telemetry` (1), `Hybrid Mesh Firewalling` (1), `Zero Trust Access` (1) |
| `Workplace` | 8 | `Dashboard Studio Same-Root Reconciliation` (7), `Dashboard Studio Reconciliation` (1) |
| `ThousandEyes` | 7 | `Network Performance` (3), `Application Performance` (1), `UC & Voice Quality` (1), `Alerting` (1), `Routing & BGP` (1) |
| `Admin` | 3 | `Troubleshooting` (2), `Macros` (1) |

## Tag vocabulary

_Total distinct tags:_ **658**

| Tag | Count |
|---|---:|
| `SCD` | 913 |
| `Dashboard Studio` | 209 |
| `Catalyst Center` | 156 |
| `Security` | 149 |
| `Searchbase Same-Root Reconciliation` | 134 |
| `TA Stock Dashboard` | 125 |
| `dCloud` | 125 |
| `ThousandEyes` | 118 |
| `IT Health` | 115 |
| `Need to Validate` | 114 |
| `Secure Networking` | 99 |
| `Trend` | 90 |
| `Table` | 88 |
| `Searchbase Reconciliation` | 75 |
| `Cisco Secure Networking - Executive Summary` | 73 |
| `Firewall` | 67 |
| `Cisco Spaces` | 61 |
| `Detail` | 56 |
| `Network` | 53 |
| `KPI` | 50 |
| `Cisco Spaces Intelligence` | 49 |
| `spaces_intelligence_v1` | 49 |
| `SD-WAN` | 45 |
| `ISE` | 43 |
| `Executive` | 40 |
| `XDR` | 40 |
| `Leaderboard` | 39 |
| `it_health_v1` | 39 |
| `Building` | 33 |
| `IOS` | 32 |
| `Meraki` | 31 |
| `Forecast` | 30 |
| `Cisco ISE TA Troubleshooting Dashboard` | 27 |
| `Machine Learning` | 27 |
| `Network Activation Modern` | 27 |
| `statewide_exercise_v1_studio_modern` | 27 |
| `Network Activation Report` | 27 |
| `statewide_exercise_v1` | 27 |
| `NetOps Readiness` | 26 |
| `netops_readiness_v1` | 26 |
| `Hybrid Mesh Firewalling` | 26 |
| `Anomaly` | 25 |
| `Drilldown` | 24 |
| `Secure Infrastructure` | 24 |
| `Alerts` | 23 |
| `security_v1` | 23 |
| `Cisco Secure Networking - Operations` | 22 |
| `User Experience` | 22 |
| `Bar` | 22 |
| `Events And Incident Viewer` | 21 |
| `Active Directory` | 21 |
| `Endpoints (Clients)` | 21 |
| `Sites` | 21 |
| `Firepower` | 20 |
| `Health` | 20 |
| `AttackAnalyzer` | 20 |
| `Zero Trust Access` | 20 |
| `Wireless` | 19 |
| `Description Search` | 19 |
| `Zeek` | 19 |
| `Indexes` | 19 |
| `Scalable Network Segmentation` | 19 |
| `DNS` | 18 |
| `HTTP` | 18 |
| `Health Score` | 17 |
| `FTD` | 17 |
| `Application` | 17 |
| `query_count_severity` | 16 |
| `Cisco Secure Networking - Glass Table` | 16 |
| `Map` | 16 |
| `Topology` | 16 |
| `SSE` | 16 |
| `Compliance` | 15 |
| `CC - Sourcetype health - last event and age and status` | 15 |
| `Breakdown` | 15 |
| `FMC` | 15 |
| `P1` | 15 |
| `Umbrella` | 14 |
| `Inventory` | 14 |
| `Clients` | 14 |
| `Forensics` | 14 |
| `Feed Health` | 14 |
| `Devices` | 13 |
| `Executive Summary` | 13 |
| `Identity` | 13 |
| `Risk` | 13 |
| `Feed Monitor` | 13 |
| `Signal Rail` | 13 |
| `TrustSec` | 13 |
| `Agentic Ops` | 13 |
| `Issues` | 12 |
| `Latency` | 12 |
| `UTD` | 12 |
| `Client Summary` | 12 |
| `Administrator Users Search` | 12 |
| `Staleness` | 12 |
| `SGT` | 12 |
| `Lookup Enriched` | 11 |
| `ASA` | 11 |
| `Cisco ASA TA Monitoring Dashboard` | 11 |
| `Severity` | 11 |
| `BGP` | 11 |
| `Availability` | 11 |
| `Events` | 11 |
| `Sessions` | 11 |
| `Duo` | 11 |
| `Data Center` | 11 |
| `ISE TA` | 11 |
| `SSID` | 10 |
| `DHCP` | 10 |
| `Network Insights` | 10 |
| `Cisco Secure Networking - Operations Glass Table` | 10 |
| `Building Intelligence` | 10 |
| `building_v1` | 10 |
| `Authentication` | 9 |
| `Voice` | 9 |
| `Webex` | 8 |
| `Cloud Firewall` | 8 |
| `eStreamer` | 8 |
| `Capacity` | 8 |
| `Power` | 8 |
| `ESCU` | 8 |
| `Multicloud Defense` | 8 |
| `inbound_bytes_ascending` | 8 |
| `Nexus Dashboard` | 8 |
| `LLP5` | 8 |
| `DensityFunction` | 8 |
| `Workplace SPOG` | 8 |
| `workplace_spog_v1` | 8 |
| `Presence` | 7 |
| `Reachability` | 7 |
| `Email` | 7 |
| `Infrastructure` | 7 |
| `Network Intelligence` | 7 |
| `Bandwidth` | 7 |
| `Collaboration` | 7 |
| `Loss` | 7 |
| `Jitter` | 7 |
| `Occupancy` | 7 |
| `Tunnels` | 7 |
| `NVM` | 7 |
| `Policy` | 7 |
| `Site` | 7 |
| `Block` | 7 |
| `Location` | 6 |
| `Cloud Security` | 6 |
| `BEC query` | 6 |
| `Audit` | 6 |
| `Device Health` | 6 |
| `AP` | 6 |
| `Advisory` | 6 |
| `Internet Insights` | 6 |
| `SIP` | 6 |
| `Critical` | 6 |
| `Incidents` | 6 |
| `Link` | 6 |
| `Topology Link` | 6 |
| `Errors` | 6 |
| `Malware` | 6 |
| `AI Defense` | 6 |
| `GenAI` | 6 |
| `ZTA` | 6 |
| `ZTNA` | 6 |
| `Footprint` | 6 |
| `Users` | 5 |
| `Utilization` | 5 |
| `Traffic` | 5 |
| `Throughput` | 5 |
| `API` | 5 |
| `FTP` | 5 |
| `Distribution` | 5 |
| `Connectivity` | 5 |
| `Categories` | 5 |
| `Files` | 5 |
| `ACI` | 5 |
| `Telemetry` | 5 |
| `Calendar` | 5 |
| `RandomForest` | 5 |
| `Enforcement` | 5 |
| `P1-data` | 5 |
| `Trust` | 4 |
| `Secure Access` | 4 |
| `Signatures` | 4 |
| `IDS` | 4 |
| `IPS` | 4 |
| `Syslog` | 4 |
| `Comparison` | 4 |
| `Network Health` | 4 |
| `Assets` | 4 |
| `RADIUS` | 4 |
| `Client Health` | 4 |
| `Wired` | 4 |
| `Correlation` | 4 |
| `Page Load` | 4 |
| `SaaS` | 4 |
| `RTP` | 4 |
| `Destinations` | 4 |
| `Endpoint` | 4 |
| `Topology Site` | 4 |
| `Baseline` | 4 |
| `AMP` | 4 |
| `Anomalies` | 4 |
| `Cyber Vision` | 4 |
| `Vulnerabilities` | 4 |
| `Jobs` | 4 |
| `Matrix` | 4 |
| `Detections` | 4 |
| `Camera` | 4 |
| `IoT` | 4 |
| `Lease` | 4 |
| `NAC` | 4 |
| `Time Series` | 4 |
| `NDFC` | 4 |
| `Cisco Catalyst SD-WAN` | 4 |
| `MAC` | 3 |
| `Performance` | 3 |
| `Status` | 3 |
| `Rogue` | 3 |
| `Cisco WSA TA Troubleshooting Dashboard` | 3 |
| `Routing` | 3 |
| `Protocol` | 3 |
| `Interfaces` | 3 |
| `AAA` | 3 |
| `Overview` | 3 |
| `Timeline` | 3 |
| `Admin` | 3 |
| `Agent to Agent` | 3 |
| `Activity Logs` | 3 |
| `MOS` | 3 |
| `Agent Location Match` | 3 |
| `Geo Enriched` | 3 |
| `Configuration Status` | 3 |
| `SIG` | 3 |
| `Audit Logs` | 3 |
| `URLs` | 3 |
| `Administrators` | 3 |
| `Activities` | 3 |
| `Fabric` | 3 |
| `PSIRT` | 3 |
| `Tetration` | 3 |
| `query_indexes` | 3 |
| `Stealthwatch` | 3 |
| `SNA` | 3 |
| `Alarms` | 3 |
| `Hosts` | 3 |
| `ETD` | 3 |
| `Processes` | 3 |
| `CVI` | 3 |
| `query_active_breaches` | 3 |
| `Isovalent` | 3 |
| `Tetragon` | 3 |
| `Intrusions` | 3 |
| `Watchlist` | 3 |
| `Observables` | 3 |
| `Endace` | 3 |
| `Prediction` | 3 |
| `Temperature` | 3 |
| `Workplace` | 3 |
| `ROI` | 3 |
| `SGACL` | 3 |
| `Cisco Catalyst App Security Insights` | 3 |
| `Cisco Secure Access` | 3 |
| `NGFW` | 3 |
| `Network Performance` | 3 |
| `Sensor Data` | 2 |
| `Security Insights` | 2 |
| `Lookup` | 2 |
| `ESA` | 2 |
| `Defender` | 2 |
| `Endpoints` | 2 |
| `802.1X` | 2 |
| `MAC Steal` | 2 |
| `WSA` | 2 |
| `OSPF` | 2 |
| `EIGRP` | 2 |
| `STP` | 2 |
| `NTP` | 2 |
| `Time Drift` | 2 |
| `Top Talkers` | 2 |
| `Pool Exhaustion` | 2 |
| `Scope` | 2 |
| `Guest` | 2 |
| `Capacity Planning` | 2 |
| `Client Count` | 2 |
| `Onboarding` | 2 |
| `Usage` | 2 |
| `Coverage` | 2 |
| `CPU` | 2 |
| `CVE` | 2 |
| `Optimization` | 2 |
| `Regional` | 2 |
| `DNSSEC` | 2 |
| `Traces` | 2 |
| `Proxy` | 2 |
| `Cloud` | 2 |
| `Response Time` | 2 |
| `Completion` | 2 |
| `M365` | 2 |
| `ServiceNow` | 2 |
| `Readiness` | 2 |
| `query_new_potential_heartbeats_detected` | 2 |
| `Site Connectivity` | 2 |
| `Access Points` | 2 |
| `Site Leaderboard` | 2 |
| `Legacy KPI` | 2 |
| `A2A` | 2 |
| `Raw Events` | 2 |
| `Healthy` | 2 |
| `Warning` | 2 |
| `Quality` | 2 |
| `Hardware` | 2 |
| `Lookup Join` | 2 |
| `Critical Sites` | 2 |
| `Agent` | 2 |
| `Health Threshold` | 2 |
| `Domain Score` | 2 |
| `Site Health` | 2 |
| `Policies` | 2 |
| `Container` | 2 |
| `DLP` | 2 |
| `Posture` | 2 |
| `CVSS` | 2 |
| `Secure Workload` | 2 |
| `SMA` | 2 |
| `Submissions` | 2 |
| `Faults` | 2 |
| `Rules` | 2 |
| `Tracebacks` | 2 |
| `Crashes` | 2 |
| `Queries` | 2 |
| `TLS` | 2 |
| `Certificates` | 2 |
| `Leases` | 2 |
| `Strings` | 2 |
| `Resources` | 2 |
| `Tasks` | 2 |
| `Findings` | 2 |
| `Disposition` | 2 |
| `Indicators` | 2 |
| `Worklog` | 2 |
| `Telephony` | 2 |
| `SMS` | 2 |
| `Intrusion Events - Alert Message` | 2 |
| `Multivariate` | 2 |
| `HVAC` | 2 |
| `Device` | 2 |
| `NOC` | 2 |
| `Internet` | 2 |
| `Booking` | 2 |
| `Waste` | 2 |
| `Heatmap` | 2 |
| `Weekly` | 2 |
| `Monday` | 2 |
| `Surge` | 2 |
| `vManage` | 2 |
| `MFA` | 2 |
| `Threat` | 2 |
| `IP-SGT Bindings` | 2 |
| `Catalyst Center TA` | 2 |
| `P0` | 2 |
| `Cisco` | 2 |
| `Failure` | 2 |
| `Exposure` | 2 |
| `RaVPN` | 2 |
| `SXP` | 2 |
| `DNS Security` | 2 |
| `Investigation` | 2 |
| `Failure Rate` | 2 |
| `NAD` | 2 |
| `Network Device` | 2 |
| `User` | 2 |
| `Device Posture` | 2 |
| `Rogue AP` | 2 |
| `WLAN` | 2 |
| `Tunnel` | 2 |
| `Branch` | 2 |
| `Test` | 2 |
| `Packet Loss` | 2 |
| `Application Health` | 2 |
| `Rooms` | 1 |
| `Hierarchy` | 1 |
| `Device Family` | 1 |
| `Score` | 1 |
| `Network Compliance` | 1 |
| `Lockout` | 1 |
| `Traffic Direction` | 1 |
| `Scanning` | 1 |
| `Brute Force` | 1 |
| `SSH` | 1 |
| `Exfiltration` | 1 |
| `Port Flapping` | 1 |
| `MAC Flap` | 1 |
| `Config Change` | 1 |
| `Error Disable` | 1 |
| `Traffic Action` | 1 |
| `External IP` | 1 |
| `Ports` | 1 |
| `Blocked` | 1 |
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
| `Network Activation` | 1 |
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
| `WAN` | 1 |
| `Quality Score` | 1 |
| `Path Change` | 1 |
| `Resolution` | 1 |
| `Provider Comparison` | 1 |
| `Delegation` | 1 |
| `Outage` | 1 |
| `ISP` | 1 |
| `ITSI` | 1 |
| `Workforce` | 1 |
| `Overlay` | 1 |
| `Underlay` | 1 |
| `SASE` | 1 |
| `Zscaler` | 1 |
| `CDN` | 1 |
| `Path Visualization` | 1 |
| `Duration` | 1 |
| `Salesforce` | 1 |
| `Administration` | 1 |
| `OTel` | 1 |
| `Spans` | 1 |
| `APM` | 1 |
| `Root Cause` | 1 |
| `MTTR` | 1 |
| `MTTI` | 1 |
| `Registration` | 1 |
| `Voice Quality` | 1 |
| `Teams` | 1 |
| `Zoom` | 1 |
| `RoomOS` | 1 |
| `Summary` | 1 |
| `Operations Pressure` | 1 |
| `Binding` | 1 |
| `Link Availability` | 1 |
| `Link Events` | 1 |
| `Discards` | 1 |
| `Tier Health` | 1 |
| `GPS` | 1 |
| `Metrics` | 1 |
| `High` | 1 |
| `Web Transactions` | 1 |
| `Threat Intel` | 1 |
| `Active Devices` | 1 |
| `Wi-Fi` | 1 |
| `Collab` | 1 |
| `Circuits` | 1 |
| `Transport` | 1 |
| `Down` | 1 |
| `Users And Applications` | 1 |
| `URL Filter` | 1 |
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
| `Advisories` | 1 |
| `Verdicts` | 1 |
| `Pie` | 1 |
| `Threat Score` | 1 |
| `Exploits` | 1 |
| `Codes` | 1 |
| `Namespaces` | 1 |
| `Workloads` | 1 |
| `Resolvers` | 1 |
| `Encrypted` | 1 |
| `Flows` | 1 |
| `Notices` | 1 |
| `Domains` | 1 |
| `Services` | 1 |
| `Egress` | 1 |
| `LOLBins` | 1 |
| `IOC` | 1 |
| `Lineage` | 1 |
| `Tactics` | 1 |
| `Hotspots` | 1 |
| `Sources` | 1 |
| `Analysts` | 1 |
| `Notes` | 1 |
| `Connections` | 1 |
| `Packets` | 1 |
| `Crypto` | 1 |
| `Operations` | 1 |
| `QUIC` | 1 |
| `Logins` | 1 |
| `LateralMovement` | 1 |
| `Pivot` | 1 |
| `Abuse` | 1 |
| `Burst` | 1 |
| `Tunneling` | 1 |
| `Beacon` | 1 |
| `Cadence` | 1 |
| `DataQuality` | 1 |
| `SOC` | 1 |
| `Outlier` | 1 |
| `Desk` | 1 |
| `Room` | 1 |
| `Area` | 1 |
| `Active Calls` | 1 |
| `VoIP` | 1 |
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
| `Monthly` | 1 |
| `Planning` | 1 |
| `30-Day` | 1 |
| `Fingerprint` | 1 |
| `Informal` | 1 |
| `Spontaneous` | 1 |
| `Behavior` | 1 |
| `Idle` | 1 |
| `Cost` | 1 |
| `Seat-Hours` | 1 |
| `Recurring` | 1 |
| `Z-Score` | 1 |
| `Event` | 1 |
| `DNAC` | 1 |
| `Firehose` | 1 |
| `NDR` | 1 |
| `All Feeds` | 1 |
| `Overview - Per-product health - events and MB and last event ...` | 1 |
| `TACACS` | 1 |
| `Organizations Security` | 1 |
| `LDOS` | 1 |
| `Deny` | 1 |
| `Meraki TA` | 1 |
| `Licensing` | 1 |
| `Port` | 1 |
| `MAC OUI` | 1 |
| `Cyber Vision TA` | 1 |
| `OT` | 1 |
| `Asset Visibility` | 1 |
| `Overview - Ingest by sourcetype - events and MB and age and s...` | 1 |
| `Rollup` | 1 |
| `Blocks` | 1 |
| `Remote Access VPN` | 1 |
| `Profile` | 1 |
| `Cisco Duo` | 1 |
| `Admin Activity` | 1 |
| `Identity Provider` | 1 |
| `Data Loss` | 1 |
| `Cisco Intersight` | 1 |
| `EOL` | 1 |
| `Cisco Secure Client` | 1 |
| `Action` | 1 |
| `Verdict` | 1 |
| `File Inspection` | 1 |
| `File Hash` | 1 |
| `On-Premises Firewall` | 1 |
| `Cisco Firepower` | 1 |
| `AC_RuleAction` | 1 |
| `Allow` | 1 |
| `URL Filtering` | 1 |
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
| `SGT Correlation` | 1 |
| `Assignment` | 1 |
| `Unique` | 1 |
| `Classification` | 1 |
| `Failed` | 1 |
| `Denial` | 1 |
| `Secure Client` | 1 |
| `Remote Access` | 1 |
| `Session` | 1 |
| `Cisco Secure Networking - Zero Trust Access` | 1 |
| `Policy Outcome` | 1 |
| `Blocked Access` | 1 |
| `Connection Status` | 1 |
| `Policy Set` | 1 |
| `Authorization` | 1 |
| `Cross-Source` | 1 |
| `Fabric Health` | 1 |
| `Vulnerability` | 1 |
| `WLAN Security` | 1 |
| `Containment` | 1 |
| `Wireless Security` | 1 |
| `Encryption` | 1 |
| `WPA` | 1 |
| `Open` | 1 |
| `Open Network` | 1 |
| `Unencrypted` | 1 |
| `Client` | 1 |
| `MAC Address` | 1 |
| `Network Visibility` | 1 |
| `Observability` | 1 |
| `Video` | 1 |
| `Remote` | 1 |
| `Trace` | 1 |
| `Metric` | 1 |
| `Switches` | 1 |
| `MR` | 1 |
| `Association` | 1 |
| `Firewall Count` | 1 |
| `WAN Edge` | 1 |
| `Web Transaction` | 1 |
| `Path Changes` | 1 |
| `Stability` | 1 |
| `ITSM` | 1 |
| `Ticket Management` | 1 |
| `Splunk Self-Monitoring` | 1 |
| `Ingest Volume` | 1 |
| `License Usage` | 1 |
| `IPSEC` | 1 |
| `Cisco Secure Workload` | 1 |
| `Micro-Segmentation` | 1 |

