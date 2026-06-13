# searchbase.conf metadata audit

_Source:_ `packages/splunk-cisco-dashboards/src/main/resources/splunk/default/searchbase.conf`
_Total stanzas:_ **676**

## Picker-gate (`Cisco` tag) coverage

The overview picker filters the catalogue with `entry.tags.includes('Cisco')` (`KpiPickerPanel.tsx:431`). Anything missing the `Cisco` tag is invisible in the picker UI.

| Bucket | Count |
|---|---:|
| Stanzas with `Cisco` tag (visible in picker) | 0 |
| Stanzas without `Cisco` tag (hidden from picker) | 676 |

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
| `Network` | 208 | `Network Intelligence` (28), `Client Health` (16), `Wireless` (14), `Infrastructure` (12), `Network Health` (11), `Compliance` (9), `Site Connectivity` (9), `Data Center` (6), `Device Health` (5), `DHCP Capacity` (5), `Inventory` (4), `WAN / SD-WAN` (4), `Firewall Traffic` (4), `Issues` (4), `Client Distribution` (4), `Client Experience` (4), `SSID Analysis` (4), `Client Traffic` (4), `Statewide Exercise` (4), `Site Topology` (4), `Wireless Capacity` (3), `Operational Intelligence` (3), `Topology` (3), `Client Sessions` (3), `Endpoint Telemetry` (3), `Configuration` (2), `Switching` (2), `Syslog` (2), `Interface Stability` (2), `Routing Stability` (2), `Trend Analysis` (2), `Client Usage` (2), `Client Trend` (2), `Catalyst Center` (2), `Cisco Spaces` (2), `Guest/Wireless` (2), `ThousandEyes` (2), `Network Diagnostics` (2), `Layer 2 Stability` (1), `Time Synchronization` (1), `Change Management` (1), `External Traffic` (1), `Traffic Analysis` (1), `IOS` (1), `Interface Utilization` (1), `Device Inventory` (1), `Routing` (1), `Client OS` (1), `Client Base` (1), `Wireless Quality` (1) |
| `Security` | 173 | `XDR` (39), `Firewall` (16), `Network Intelligence` (14), `UTD / IPS` (12), `Cloud Security` (8), `ESCU Alerts` (8), `IDS / IPS` (6), `GenAI Protection` (6), `DNS Security` (5), `Wireless Security` (5), `PSIRT` (4), `Audit` (4), `Email Security` (3), `Endpoint` (3), `SD-WAN Security` (3), `Network Analytics` (3), `Email Threat Defense` (3), `Vulnerability Intelligence` (3), `eBPF Observability` (3), `Web Security` (2), `Threat Detection` (2), `Trend Analysis` (2), `Threat Geography` (2), `Compliance` (2), `OT Security` (2), `Microsegmentation` (2), `Email Sandbox` (2), `Intrusion Prevention` (1), `Remote Access` (1), `Network Syslog` (1), `Firewall Traffic` (1), `Asset Correlation` (1), `Identity Infrastructure` (1), `SD-WAN UTD` (1), `Identity` (1), `Executive Score` (1) |
| `Monitoring` | 167 | `TE Application` (15), `TE Network` (15), `ThousandEyes` (14), `SD-WAN` (13), `TE Configuration` (9), `TE Voice` (9), `Network` (6), `Internet Insights` (6), `BGP` (5), `DNS` (5), `Endpoint` (4), `TE Alerts` (4), `TE Internet Insights` (4), `Cloud` (3), `HTTP` (3), `DHCP` (3), `Path Visualization` (2), `Page Load` (2), `API` (2), `Transactions` (2), `SaaS` (2), `Alerts` (2), `Correlation` (2), `SIP` (2), `Issues` (2), `Device Health` (2), `Interface Health` (2), `Routing` (2), `WAN Health` (2), `TE Activity Logs` (2), `Streaming Telemetry` (2), `Geo` (1), `SASE` (1), `FTP` (1), `Administration` (1), `ITSI` (1), `Traces` (1), `RTP` (1), `Webex` (1), `Teams` (1), `Zoom` (1), `RoomOS` (1), `Access Points` (1), `General` (1), `Configuration` (1), `NTP` (1), `Site Health` (1), `Switches` (1), `Syslog` (1), `Network Health` (1) |
| `Identity` | 44 | `ISE` (11), `Duo MFA` (8), `ISE + Active Directory` (6), `Active Directory` (6), `ISE Infrastructure` (6), `Privileged Access` (4), `Guest Access` (1), `Failed Authentication` (1), `Account Lockout` (1) |
| `Executive` | 34 | `Executive Dashboard` (18), `Site Connectivity` (5), `Site Leaderboard` (2), `Site Operations` (2), `Issue Overview` (1), `Operations Pressure` (1), `Security Posture` (1), `Wireless Infrastructure` (1), `Device Health` (1), `Issues` (1), `Site Health` (1) |
| `Building` | 33 | `Cisco Spaces` (7), `Environmental Sensors` (5), `Safety Sensors` (3), `Occupancy` (3), `Wireless Security` (3), `Collaboration` (2), `Wireless` (2), `Presence` (2), `Health Score` (1), `Access Points` (1), `Room Utilization` (1), `Nav Dashboard` (1), `Executive Score` (1), `Webex` (1) |
| `Demo` | 8 | `Topology Site` (3), `Topology Link` (3), `Site Leaderboard` (2) |
| `Asset` | 5 | `Inventory` (4), `Endpoint Telemetry` (1) |
| `Admin` | 3 | `Troubleshooting` (2), `Macros` (1) |
| `Shared` | 1 | `Nav Dashboard` (1) |

## Tag vocabulary

_Total distinct tags:_ **428**

| Tag | Count |
|---|---:|
| `Security` | 147 |
| `Catalyst Center` | 139 |
| `Trend` | 96 |
| `IT Health` | 82 |
| `ThousandEyes` | 79 |
| `Table` | 77 |
| `Cisco Live` | 73 |
| `Network` | 69 |
| `Detail` | 64 |
| `TA Stock Dashboard` | 58 |
| `Executive` | 56 |
| `KPI` | 51 |
| `XDR` | 42 |
| `Firewall` | 41 |
| `Leaderboard` | 41 |
| `SD-WAN` | 36 |
| `Building` | 32 |
| `ISE` | 29 |
| `User Experience` | 26 |
| `Alerts` | 26 |
| `Drilldown` | 26 |
| `Cisco Spaces` | 25 |
| `Sites` | 22 |
| `Bar` | 22 |
| `DNS` | 20 |
| `AttackAnalyzer` | 20 |
| `Health Score` | 19 |
| `Active Directory` | 19 |
| `IOS` | 19 |
| `Wireless` | 18 |
| `Map` | 17 |
| `HTTP` | 17 |
| `Topology` | 17 |
| `Meraki` | 16 |
| `Breakdown` | 16 |
| `Health` | 15 |
| `Identity` | 15 |
| `Application` | 15 |
| `Zeek` | 15 |
| `Issues` | 14 |
| `BGP` | 14 |
| `Executive Summary` | 14 |
| `Clients` | 14 |
| `Risk` | 14 |
| `Forensics` | 14 |
| `Client Summary` | 13 |
| `Anomaly` | 13 |
| `DHCP` | 12 |
| `Severity` | 12 |
| `Events` | 12 |
| `Lookup Enriched` | 11 |
| `Compliance` | 11 |
| `UTD` | 11 |
| `Availability` | 11 |
| `Sessions` | 11 |
| `SSID` | 10 |
| `Devices` | 10 |
| `Firepower` | 10 |
| `Internet Insights` | 10 |
| `Overview` | 10 |
| `Duo` | 10 |
| `FTD` | 9 |
| `Network Intelligence` | 9 |
| `Configuration Status` | 9 |
| `Voice` | 9 |
| `Inventory` | 8 |
| `Latency` | 8 |
| `Power` | 8 |
| `ESCU` | 8 |
| `Intelligence` | 8 |
| `Multicloud Defense` | 8 |
| `ASA` | 7 |
| `Reachability` | 7 |
| `Bandwidth` | 7 |
| `SIP` | 7 |
| `Tunnels` | 7 |
| `Webex` | 6 |
| `Umbrella` | 6 |
| `Infrastructure` | 6 |
| `Audit` | 6 |
| `Traffic` | 6 |
| `Disabled` | 6 |
| `Endpoint` | 6 |
| `Throughput` | 6 |
| `Errors` | 6 |
| `FTP` | 6 |
| `Critical` | 6 |
| `Incidents` | 6 |
| `Connectivity` | 6 |
| `AI Defense` | 6 |
| `GenAI` | 6 |
| `Cloud Firewall` | 5 |
| `Device Health` | 5 |
| `AP` | 5 |
| `Client Health` | 5 |
| `Network Activation` | 5 |
| `Loss` | 5 |
| `Distribution` | 5 |
| `Topology Site` | 5 |
| `Link` | 5 |
| `Topology Link` | 5 |
| `Files` | 5 |
| `Users` | 4 |
| `Location` | 4 |
| `Signatures` | 4 |
| `eStreamer` | 4 |
| `IDS` | 4 |
| `Routing` | 4 |
| `Comparison` | 4 |
| `Assets` | 4 |
| `Capacity` | 4 |
| `Jitter` | 4 |
| `Page Load` | 4 |
| `API` | 4 |
| `RTP` | 4 |
| `Destinations` | 4 |
| `Applications` | 4 |
| `Site Leaderboard` | 4 |
| `Legacy KPI` | 4 |
| `Malware` | 4 |
| `Anomalies` | 4 |
| `Cyber Vision` | 4 |
| `Vulnerabilities` | 4 |
| `NVM` | 4 |
| `Telemetry` | 4 |
| `Jobs` | 4 |
| `Detections` | 4 |
| `Presence` | 3 |
| `MAC` | 3 |
| `Trust` | 3 |
| `Rogue` | 3 |
| `IPS` | 3 |
| `Network Health` | 3 |
| `Utilization` | 3 |
| `Wired` | 3 |
| `Collaboration` | 3 |
| `Timeline` | 3 |
| `Admin` | 3 |
| `Path Visualization` | 3 |
| `Traces` | 3 |
| `Correlation` | 3 |
| `Cloud` | 3 |
| `Completion` | 3 |
| `Activity Logs` | 3 |
| `Agent Location Match` | 3 |
| `Geo Enriched` | 3 |
| `Baseline` | 3 |
| `SIG` | 3 |
| `SSE` | 3 |
| `Audit Logs` | 3 |
| `Categories` | 3 |
| `URLs` | 3 |
| `Administrators` | 3 |
| `Activities` | 3 |
| `Nexus Dashboard` | 3 |
| `Stealthwatch` | 3 |
| `SNA` | 3 |
| `Hosts` | 3 |
| `ETD` | 3 |
| `Processes` | 3 |
| `CVI` | 3 |
| `ACI` | 3 |
| `Isovalent` | 3 |
| `Tetragon` | 3 |
| `TLS` | 3 |
| `Intrusions` | 3 |
| `Watchlist` | 3 |
| `Observables` | 3 |
| `Status` | 2 |
| `Lookup` | 2 |
| `ESA` | 2 |
| `Authentication` | 2 |
| `802.1X` | 2 |
| `MAC Steal` | 2 |
| `WSA` | 2 |
| `Syslog` | 2 |
| `OSPF` | 2 |
| `EIGRP` | 2 |
| `STP` | 2 |
| `NTP` | 2 |
| `Time Drift` | 2 |
| `Protocol` | 2 |
| `Pool Exhaustion` | 2 |
| `Guest` | 2 |
| `Capacity Planning` | 2 |
| `Client Count` | 2 |
| `WAN` | 2 |
| `AAA` | 2 |
| `Priority` | 2 |
| `Onboarding` | 2 |
| `CPU` | 2 |
| `Advisory` | 2 |
| `Performance` | 2 |
| `Agent to Agent` | 2 |
| `Path Change` | 2 |
| `Regional` | 2 |
| `DNSSEC` | 2 |
| `ITSI` | 2 |
| `Response Time` | 2 |
| `Duration` | 2 |
| `Transactions` | 2 |
| `SaaS` | 2 |
| `M365` | 2 |
| `MOS` | 2 |
| `PSIRT` | 2 |
| `Site Connectivity` | 2 |
| `Healthy` | 2 |
| `Warning` | 2 |
| `Nav Dashboard` | 2 |
| `Lookup Join` | 2 |
| `Critical Sites` | 2 |
| `Health Threshold` | 2 |
| `Web Transactions` | 2 |
| `Domain Score` | 2 |
| `Interfaces` | 2 |
| `Policies` | 2 |
| `AMP` | 2 |
| `Container` | 2 |
| `Endpoints` | 2 |
| `Posture` | 2 |
| `CVSS` | 2 |
| `Secure Workload` | 2 |
| `Tetration` | 2 |
| `SMA` | 2 |
| `Submissions` | 2 |
| `Faults` | 2 |
| `Tracebacks` | 2 |
| `Crashes` | 2 |
| `Queries` | 2 |
| `Certificates` | 2 |
| `Leases` | 2 |
| `Strings` | 2 |
| `Resources` | 2 |
| `Tasks` | 2 |
| `Findings` | 2 |
| `Disposition` | 2 |
| `Indicators` | 2 |
| `Matrix` | 2 |
| `Worklog` | 2 |
| `Telephony` | 2 |
| `SMS` | 2 |
| `Rooms` | 1 |
| `Hierarchy` | 1 |
| `Device Family` | 1 |
| `Score` | 1 |
| `Cisco Cloud Security` | 1 |
| `Secure Access` | 1 |
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
| `Countries` | 1 |
| `Top Talkers` | 1 |
| `Ports` | 1 |
| `Blocked` | 1 |
| `Volume` | 1 |
| `Windows DHCP` | 1 |
| `Lease Rate` | 1 |
| `NACK` | 1 |
| `Scope` | 1 |
| `Snooping` | 1 |
| `Threshold` | 1 |
| `Interface` | 1 |
| `Disconnect` | 1 |
| `RADIUS` | 1 |
| `Triage` | 1 |
| `Non Compliant` | 1 |
| `Device Type` | 1 |
| `Band` | 1 |
| `Health Distribution` | 1 |
| `Usage` | 1 |
| `OS` | 1 |
| `Coverage` | 1 |
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
| `CVE` | 1 |
| `Roaming` | 1 |
| `Cache` | 1 |
| `Schedule` | 1 |
| `Optimization` | 1 |
| `Tuning` | 1 |
| `Configuration` | 1 |
| `Hops` | 1 |
| `Quality Score` | 1 |
| `Updates` | 1 |
| `Resolution` | 1 |
| `Provider Comparison` | 1 |
| `Delegation` | 1 |
| `Outage` | 1 |
| `ISP` | 1 |
| `Proxy` | 1 |
| `Agent` | 1 |
| `Experience Score` | 1 |
| `Remote Worker` | 1 |
| `VPN` | 1 |
| `Connection Type` | 1 |
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
| `Administration` | 1 |
| `Service Health` | 1 |
| `OTel` | 1 |
| `Spans` | 1 |
| `APM` | 1 |
| `Root Cause` | 1 |
| `MTTR` | 1 |
| `MTTI` | 1 |
| `Registration` | 1 |
| `Voice Quality` | 1 |
| `Meeting Quality` | 1 |
| `Teams` | 1 |
| `Readiness` | 1 |
| `Zoom` | 1 |
| `RoomOS` | 1 |
| `Protocols` | 1 |
| `Email` | 1 |
| `Vulnerability` | 1 |
| `Summary` | 1 |
| `Operations Pressure` | 1 |
| `Access Points` | 1 |
| `Requires Data Source` | 1 |
| `A2A` | 1 |
| `Raw Events` | 1 |
| `Link Availability` | 1 |
| `Link Events` | 1 |
| `Discards` | 1 |
| `Quality` | 1 |
| `Hardware` | 1 |
| `Tier Health` | 1 |
| `GPS` | 1 |
| `Drift` | 1 |
| `Configuration Audit` | 1 |
| `HTTP Errors` | 1 |
| `High` | 1 |
| `Threat Intel` | 1 |
| `Active Devices` | 1 |
| `Wi-Fi` | 1 |
| `Occupancy` | 1 |
| `Collab` | 1 |
| `APs` | 1 |
| `Site Health` | 1 |
| `Circuits` | 1 |
| `Transport` | 1 |
| `Down` | 1 |
| `URL Filter` | 1 |
| `Models` | 1 |
| `MITRE` | 1 |
| `Messages` | 1 |
| `Gateways` | 1 |
| `FQDNs` | 1 |
| `WAF` | 1 |
| `DLP` | 1 |
| `AV` | 1 |
| `Tenant` | 1 |
| `Authentications` | 1 |
| `Factors` | 1 |
| `Trust Monitor` | 1 |
| `Dormant` | 1 |
| `Vendors` | 1 |
| `Fabrics` | 1 |
| `Advisories` | 1 |
| `Scopes` | 1 |
| `Verdicts` | 1 |
| `Pie` | 1 |
| `Threat Score` | 1 |
| `Exploits` | 1 |
| `Fabric` | 1 |
| `Codes` | 1 |
| `Rules` | 1 |
| `Namespaces` | 1 |
| `Workloads` | 1 |
| `Resolvers` | 1 |
| `Cipher` | 1 |
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
| `Locations` | 1 |
| `Connections` | 1 |
| `Packets` | 1 |
| `Crypto` | 1 |
| `Operations` | 1 |
| `Endace` | 1 |
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

