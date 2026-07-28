# searchbase.conf metadata audit

_Source:_ `packages/splunk-cisco-dashboards/src/main/resources/splunk/default/searchbase.conf`
_Total stanzas:_ **920**

## Picker-gate (`Cisco` tag) coverage

The overview picker filters the catalogue with `entry.tags.includes('Cisco')` (`KpiPickerPanel.tsx:431`). Anything missing the `Cisco` tag is invisible in the picker UI.

| Bucket | Count |
|---|---:|
| Stanzas with `Cisco` tag (visible in picker) | 0 |
| Stanzas without `Cisco` tag (hidden from picker) | 920 |

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
| `Network` | 223 | `Network Intelligence` (20), `Site Connectivity` (17), `Wireless` (14), `Client Health` (13), `Infrastructure` (12), `Network Health` (11), `Agentic Ops` (11), `Site Topology` (10), `Compliance` (8), `Secure Infrastructure` (8), `Issues` (7), `Device Health` (6), `Data Center` (6), `DHCP Capacity` (5), `Client Experience` (5), `Inventory` (4), `SSID Analysis` (4), `Statewide Exercise` (4), `WAN / SD-WAN` (3), `Hybrid Firewall` (3), `Wireless Capacity` (3), `Client Distribution` (3), `Topology` (3), `Client Traffic` (3), `Endpoint Telemetry` (3), `Configuration` (2), `Switching` (2), `Interface Stability` (2), `Trend Analysis` (2), `Firewall Traffic` (2), `Operational Intelligence` (2), `Catalyst Center` (2), `Cisco Spaces` (2), `Client Sessions` (2), `ThousandEyes` (2), `Network Diagnostics` (2), `Syslog` (1), `Routing Stability` (1), `Layer 2 Stability` (1), `Time Synchronization` (1), `Change Management` (1), `External Traffic` (1), `Traffic Analysis` (1), `IOS` (1), `Interface Utilization` (1), `Device Inventory` (1), `Client Usage` (1), `Routing` (1), `Client OS` (1), `Client Base` (1), `Wireless Quality` (1) |
| `Security` | 222 | `XDR` (34), `Hybrid Firewall` (28), `Dashboard Studio Same-Root Reconciliation` (16), `Network Intelligence` (15), `UTD / IPS` (11), `Secure Infrastructure` (10), `Firewall` (9), `ESCU Alerts` (8), `Cloud Security` (7), `Dashboard Studio Reconciliation` (7), `IDS / IPS` (6), `GenAI Protection` (6), `Wireless Security` (5), `DNS Security` (4), `Audit` (4), `PSIRT` (3), `Trend Analysis` (3), `SD-WAN Security` (3), `Network Analytics` (3), `Email Threat Defense` (3), `Vulnerability Intelligence` (3), `Zero Trust Access` (3), `Email Security` (2), `Endpoint` (2), `Web Security` (2), `Threat Detection` (2), `Threat Geography` (2), `Compliance` (2), `OT Security` (2), `Microsegmentation` (2), `Email Sandbox` (2), `eBPF Observability` (2), `Secure Network Segmentation` (2), `Intrusion Prevention` (1), `Remote Access` (1), `Network Syslog` (1), `Firewall Traffic` (1), `Asset Correlation` (1), `Identity Infrastructure` (1), `SD-WAN UTD` (1), `Identity` (1), `Executive Score` (1) |
| `Monitoring` | 130 | `ThousandEyes` (12), `TE Application` (11), `SD-WAN` (10), `TE Network` (10), `Network` (7), `TE Voice` (7), `DNS` (5), `Internet Insights` (5), `Hybrid Firewall` (4), `BGP` (3), `HTTP` (3), `TE Configuration` (3), `Agentic Ops` (3), `Cloud` (2), `Page Load` (2), `API` (2), `SaaS` (2), `Alerts` (2), `Correlation` (2), `SIP` (2), `TE Activity Logs` (2), `TE Alerts` (2), `Streaming Telemetry` (2), `Identity` (2), `Geo` (1), `SASE` (1), `FTP` (1), `Administration` (1), `Traces` (1), `RTP` (1), `Teams` (1), `Zoom` (1), `RoomOS` (1), `Access Points` (1), `General` (1), `Issues` (1), `Device Health` (1), `Site Health` (1), `Switches` (1), `WAN Health` (1), `TE Internet Insights` (1), `Firewall` (1), `Firepower` (1), `Catalyst Center` (1), `Cisco Spaces` (1), `Meraki` (1), `Network Intelligence` (1), `Data Center` (1), `Feed Health` (1) |
| `Cisco Spaces` | 72 | `Dashboard Studio Reconciliation` (26), `Dashboard Studio Same-Root Reconciliation` (23), `Space Optimization` (5), `Camera Intelligence` (4), `IoT Sensors` (3), `Space Occupancy` (3), `Capacity Planning` (3), `Webex Device Intelligence` (2), `Collaboration Intelligence` (2), `Device Presence` (1) |
| `Identity` | 68 | `Zero Trust Access` (30), `Secure Network Segmentation` (13), `ISE` (8), `ISE + Active Directory` (5), `Active Directory` (5), `ISE Infrastructure` (4), `Guest Access` (1), `Account Lockout` (1), `Privileged Access` (1) |
| `Network Activation` | 54 | `Dashboard Studio Same-Root Reconciliation` (40), `Dashboard Studio Reconciliation` (14) |
| `Building` | 50 | `Dashboard Studio Same-Root Reconciliation` (9), `Cisco Spaces` (7), `Environmental Sensors` (6), `Occupancy` (6), `Presence` (5), `Safety Sensors` (3), `Wireless Security` (3), `Collaboration` (2), `Wireless` (2), `Compliance` (1), `Health Score` (1), `Access Points` (1), `Room Utilization` (1), `Executive Score` (1), `Webex` (1), `Dashboard Studio Reconciliation` (1) |
| `IT Health` | 39 | `Dashboard Studio Reconciliation` (21), `Dashboard Studio Same-Root Reconciliation` (18) |
| `NetOps Readiness` | 26 | `Dashboard Studio Same-Root Reconciliation` (21), `Dashboard Studio Reconciliation` (5) |
| `Asset` | 18 | `Secure Infrastructure` (9), `Inventory` (4), `Secure Network Segmentation` (2), `Endpoint Telemetry` (1), `Hybrid Firewall` (1), `Zero Trust Access` (1) |
| `Workplace` | 8 | `Dashboard Studio Same-Root Reconciliation` (7), `Dashboard Studio Reconciliation` (1) |
| `ThousandEyes` | 7 | `Network Performance` (3), `Application Performance` (1), `UC & Voice Quality` (1), `Alerting` (1), `Routing & BGP` (1) |
| `Admin` | 3 | `Troubleshooting` (2), `Macros` (1) |

## Tag vocabulary

_Total distinct tags:_ **597**

| Tag | Count |
|---|---:|
| `SCD` | 920 |
| `Dashboard Studio` | 209 |
| `Catalyst Center` | 155 |
| `Secure Networking` | 137 |
| `TA Stock Dashboard` | 125 |
| `dCloud` | 125 |
| `ThousandEyes` | 119 |
| `Trend` | 90 |
| `IT Health` | 76 |
| `Cisco Secure Networking - Executive Summary` | 73 |
| `Detail` | 61 |
| `Firewall` | 57 |
| `KPI` | 50 |
| `Cisco Spaces Intelligence` | 49 |
| `Executive` | 40 |
| `SN Phase 1` | 39 |
| `Leaderboard` | 39 |
| `ISE` | 36 |
| `Hybrid Firewall` | 36 |
| `Zero Trust Access` | 34 |
| `Meraki` | 31 |
| `SD-WAN` | 31 |
| `IOS` | 31 |
| `Drilldown` | 29 |
| `Cisco Spaces` | 28 |
| `Sites` | 28 |
| `Cisco ISE TA Troubleshooting Dashboard` | 27 |
| `Secure Infrastructure` | 27 |
| `Forecast` | 27 |
| `Machine Learning` | 27 |
| `Network Activation Modern` | 27 |
| `Network Activation Report` | 27 |
| `Anomaly` | 25 |
| `Endpoint` | 24 |
| `Security` | 23 |
| `Cisco Secure Networking - Operations` | 22 |
| `User Experience` | 22 |
| `Events And Incident Viewer` | 21 |
| `Network` | 21 |
| `Alerts` | 21 |
| `Health` | 20 |
| `AttackAnalyzer` | 20 |
| `Description Search` | 19 |
| `Zeek` | 19 |
| `FTD` | 18 |
| `Application` | 18 |
| `Firepower` | 17 |
| `SSE` | 17 |
| `Secure Network Segmentation` | 17 |
| `Health Score` | 16 |
| `Active Directory` | 16 |
| `Cisco Secure Networking - Glass Table` | 16 |
| `Map` | 16 |
| `Topology` | 16 |
| `FMC` | 16 |
| `Device` | 15 |
| `Umbrella` | 15 |
| `Client` | 15 |
| `HTTP` | 15 |
| `Breakdown` | 15 |
| `Identity` | 15 |
| `Inventory` | 14 |
| `Forensics` | 14 |
| `Agentic Ops` | 14 |
| `DNS` | 13 |
| `Executive Summary` | 13 |
| `Risk` | 13 |
| `Feed Monitor` | 13 |
| `Signal Rail` | 13 |
| `Feed Health` | 13 |
| `TrustSec` | 13 |
| `Latency` | 12 |
| `UTD` | 12 |
| `Wireless` | 12 |
| `Client Summary` | 12 |
| `Event` | 12 |
| `Session` | 12 |
| `Duo` | 12 |
| `Administrator Users Search` | 12 |
| `Staleness` | 12 |
| `SGT` | 12 |
| `Lookup Enriched` | 11 |
| `ASA` | 11 |
| `Cisco ASA TA Monitoring Dashboard` | 11 |
| `Severity` | 11 |
| `Availability` | 11 |
| `ISE TA` | 11 |
| `SSID` | 10 |
| `DHCP` | 10 |
| `Network Insights` | 10 |
| `Cisco Secure Networking - Operations Glass Table` | 10 |
| `Authentication` | 10 |
| `Block` | 10 |
| `Tunnel` | 10 |
| `Building Intelligence` | 10 |
| `BGP` | 9 |
| `Voice` | 9 |
| `Nexus Dashboard` | 9 |
| `Cloud Firewall` | 8 |
| `eStreamer` | 8 |
| `Power` | 8 |
| `Advisory` | 8 |
| `ESCU` | 8 |
| `Multicloud Defense` | 8 |
| `LLP5` | 8 |
| `DensityFunction` | 8 |
| `Workplace SPOG` | 8 |
| `Webex` | 7 |
| `User` | 7 |
| `Reachability` | 7 |
| `Email` | 7 |
| `Infrastructure` | 7 |
| `Network Intelligence` | 7 |
| `Capacity` | 7 |
| `Compliance` | 7 |
| `Bandwidth` | 7 |
| `Collaboration` | 7 |
| `Loss` | 7 |
| `Jitter` | 7 |
| `NVM` | 7 |
| `Policy` | 7 |
| `Location` | 6 |
| `BEC query` | 6 |
| `AP` | 6 |
| `Critical` | 6 |
| `Incidents` | 6 |
| `Link` | 6 |
| `Topology Link` | 6 |
| `Errors` | 6 |
| `Malware` | 6 |
| `AI Defense` | 6 |
| `GenAI` | 6 |
| `Lease` | 6 |
| `ZTNA` | 6 |
| `Footprint` | 6 |
| `Cloud Security` | 5 |
| `Audit` | 5 |
| `Utilization` | 5 |
| `RADIUS` | 5 |
| `Issues` | 5 |
| `Traffic` | 5 |
| `Throughput` | 5 |
| `Distribution` | 5 |
| `Connectivity` | 5 |
| `Threat Categories` | 5 |
| `Files` | 5 |
| `ACI` | 5 |
| `Telemetry` | 5 |
| `RandomForest` | 5 |
| `Enforcement` | 5 |
| `NDFC` | 5 |
| `Trust` | 4 |
| `Secure Access` | 4 |
| `Signatures` | 4 |
| `IDS` | 4 |
| `IPS` | 4 |
| `Syslog` | 4 |
| `Comparison` | 4 |
| `Device Health` | 4 |
| `Assets` | 4 |
| `Wired` | 4 |
| `Destinations` | 4 |
| `Topology Site` | 4 |
| `Baseline` | 4 |
| `SIP` | 4 |
| `FTP` | 4 |
| `AMP` | 4 |
| `Anomalies` | 4 |
| `Cyber Vision` | 4 |
| `Vulnerabilities` | 4 |
| `Jobs` | 4 |
| `Matrix` | 4 |
| `Detections` | 4 |
| `Camera` | 4 |
| `IoT` | 4 |
| `NAC` | 4 |
| `Data Center` | 4 |
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
| `CVE` | 3 |
| `Agent to Agent` | 3 |
| `Path Change` | 3 |
| `Activity Logs` | 3 |
| `MOS` | 3 |
| `Agent Location Match` | 3 |
| `Geo Enriched` | 3 |
| `API` | 3 |
| `Configuration Status` | 3 |
| `RTP` | 3 |
| `SIG` | 3 |
| `Audit Logs` | 3 |
| `URLs` | 3 |
| `Administrators` | 3 |
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
| `TLS` | 3 |
| `Intrusions` | 3 |
| `Watchlist` | 3 |
| `Observables` | 3 |
| `Endace` | 3 |
| `Prediction` | 3 |
| `Temperature` | 3 |
| `Occupancy` | 3 |
| `Workplace` | 3 |
| `ROI` | 3 |
| `MFA` | 3 |
| `Threat` | 3 |
| `SGACL` | 3 |
| `Cisco Catalyst App Security Insights` | 3 |
| `Failure` | 3 |
| `Cisco Secure Access` | 3 |
| `NGFW` | 3 |
| `Network Performance` | 3 |
| `Sensor Data` | 2 |
| `Room` | 2 |
| `Security Insights` | 2 |
| `Lookup` | 2 |
| `ESA` | 2 |
| `Defender` | 2 |
| `802.1X` | 2 |
| `MAC Steal` | 2 |
| `WSA` | 2 |
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
| `Capacity Planning` | 2 |
| `Client Count` | 2 |
| `Onboarding` | 2 |
| `Usage` | 2 |
| `Coverage` | 2 |
| `CPU` | 2 |
| `Client Health` | 2 |
| `Optimization` | 2 |
| `Regional` | 2 |
| `DNSSEC` | 2 |
| `Trace` | 2 |
| `Proxy` | 2 |
| `Correlation` | 2 |
| `Response Time` | 2 |
| `Completion` | 2 |
| `M365` | 2 |
| `ServiceNow` | 2 |
| `Readiness` | 2 |
| `Presence` | 2 |
| `Access Points` | 2 |
| `XDR` | 2 |
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
| `Metric` | 2 |
| `Agent` | 2 |
| `Health Threshold` | 2 |
| `Page Load` | 2 |
| `Web Transaction` | 2 |
| `Domain Score` | 2 |
| `Policies` | 2 |
| `URL Filter` | 2 |
| `Container` | 2 |
| `DLP` | 2 |
| `Posture` | 2 |
| `CVSS` | 2 |
| `Secure Workload` | 2 |
| `Verdict` | 2 |
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
| `Findings` | 2 |
| `Disposition` | 2 |
| `Hotspot` | 2 |
| `Indicators` | 2 |
| `Worklog` | 2 |
| `Telephony` | 2 |
| `SMS` | 2 |
| `Intrusion Events - Alert Message` | 2 |
| `Multivariate` | 2 |
| `HVAC` | 2 |
| `NOC` | 2 |
| `Internet` | 2 |
| `Booking` | 2 |
| `Waste` | 2 |
| `Heatmap` | 2 |
| `Weekly` | 2 |
| `Monday` | 2 |
| `Surge` | 2 |
| `vManage` | 2 |
| `IP-SGT Bindings` | 2 |
| `Exposure` | 2 |
| `RaVPN` | 2 |
| `Cisco Duo` | 2 |
| `SXP` | 2 |
| `DNS Security` | 2 |
| `Investigation` | 2 |
| `Failure Rate` | 2 |
| `NAD` | 2 |
| `Network Device` | 2 |
| `Device Posture` | 2 |
| `Rogue AP` | 2 |
| `WLAN` | 2 |
| `Branch` | 2 |
| `Test` | 2 |
| `Packet Loss` | 2 |
| `Application Health` | 2 |
| `SaaS` | 2 |
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
| `Building` | 1 |
| `Binding` | 1 |
| `Link Availability` | 1 |
| `Link Events` | 1 |
| `Discards` | 1 |
| `Tier Health` | 1 |
| `GPS` | 1 |
| `High` | 1 |
| `Internet Insights` | 1 |
| `Threat Intel` | 1 |
| `Active Devices` | 1 |
| `Wi-Fi` | 1 |
| `Collab` | 1 |
| `Site Health` | 1 |
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
| `Lineage` | 1 |
| `Tactics` | 1 |
| `Sources` | 1 |
| `Analysts` | 1 |
| `Notes` | 1 |
| `Connection` | 1 |
| `Packets` | 1 |
| `Crypto` | 1 |
| `Operations` | 1 |
| `QUIC` | 1 |
| `Logins` | 1 |
| `LateralMovement` | 1 |
| `Pivot` | 1 |
| `Abuse` | 1 |
| `Burst` | 1 |
| `Beacon` | 1 |
| `Cadence` | 1 |
| `DataQuality` | 1 |
| `SOC` | 1 |
| `Outlier` | 1 |
| `Desk` | 1 |
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
| `Gathering` | 1 |
| `Break Room` | 1 |
| `Cafe` | 1 |
| `Monthly` | 1 |
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
| `TACACS` | 1 |
| `Organizations Security` | 1 |
| `LDOS` | 1 |
| `Deny` | 1 |
| `Meraki TA` | 1 |
| `Licensing` | 1 |
| `MAC OUI` | 1 |
| `Cyber Vision TA` | 1 |
| `OT` | 1 |
| `Asset Visibility` | 1 |
| `Overview - Ingest by sourcetype` | 1 |
| `RadSec` | 1 |
| `Network Access` | 1 |
| `Collection Gap` | 1 |
| `Rollup` | 1 |
| `Remote Access VPN` | 1 |
| `Profile` | 1 |
| `Admin Activity` | 1 |
| `Identity Provider` | 1 |
| `Outcome` | 1 |
| `Data Loss` | 1 |
| `Cisco Intersight` | 1 |
| `EOL` | 1 |
| `Cisco Secure Client` | 1 |
| `Action` | 1 |
| `File Inspection` | 1 |
| `File Hash` | 1 |
| `On-Premises Firewall` | 1 |
| `Cisco Firepower` | 1 |
| `AC_RuleAction` | 1 |
| `Allow` | 1 |
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
| `Denial` | 1 |
| `Secure Client` | 1 |
| `Remote Access` | 1 |
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
| `MAC Address` | 1 |
| `Sites Health` | 1 |
| `Network Visibility` | 1 |
| `Observability` | 1 |
| `Video` | 1 |
| `Remote` | 1 |
| `Switches` | 1 |
| `MR` | 1 |
| `Association` | 1 |
| `Firewall Count` | 1 |
| `WAN Edge` | 1 |
| `Stability` | 1 |
| `ITSM` | 1 |
| `Ticket Management` | 1 |
| `Splunk Self-Monitoring` | 1 |
| `Ingest Volume` | 1 |
| `License Usage` | 1 |
| `IPSEC` | 1 |
| `Cisco Secure Workload` | 1 |
| `Micro-Segmentation` | 1 |

