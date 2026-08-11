# Searchbase Canonical Tag Vocabulary

Reference for the `tags` field in
`packages/splunk-cisco-dashboards/src/main/resources/splunk/default/searchbase.conf`.

- **Canonical vocabulary: 139 tags** (target band was 120-150).
- **Legacy vocabulary collapsed: 588 distinct values** across 1082 stanzas.
- Every stanza carries **3-6 tags**, all drawn from this vocabulary.
- Last full retag: **2026-08-07**. Corrected the same day by an evidence audit that removed 317 tags whose only support was the locked `sub_category` — see [Amendments](#amendments).

## Why the vocabulary is shaped this way

Tags on this catalog exist to answer one question: *given a thing I care about, which searches are about it?* A flat list of 588 free-text labels cannot answer that, because two people describing the same search reach for different words and neither knows what the other used.

So the vocabulary is **faceted**. Every tag belongs to exactly one of five facets, and each facet answers a different question about a search:

| Facet | Question it answers | Tags | Evidence it is derived from |
| --- | --- | --- | --- |
| Product | Which Cisco (or third-party) product the telemetry comes from | 31 | the `index_*` macro, the `sourcetype`, the data model, or a product-specific lookup |
| Solution | Which business narrative or dashboard family the search belongs to | 14 | the stanza's locked `category` / `sub_category` |
| Subject | The entity the search counts, groups by, or lists | 27 | the fields the SPL actually groups by (`BY`), renames (`AS`), evaluates, or tables |
| Topic | The operational or security concern | 51 | output fields plus base-search predicates |
| Shape | What kind of answer the search returns | 14 | the SPL command signature (`timechart`, `top`, `predict`, `fit`, `iplocation`, ...) and `default_viz` |
| Provenance | Content that came from an upstream content pack rather than from this app | 2 | the locked `sub_category` and the stanza's existing tags |

A stanza is capped at 2 product, 2 solution, 2 subject, 3 topic, 2 shape and 1 provenance tag. That cap is what keeps a single stanza from being tagged with six near-identical product names, and it is why the per-stanza count lands at 3-6 rather than at whatever the evidence happens to produce.

### Naming conventions

The format skill fixes two of these; the rest are choices made here and applied uniformly.

| Rule | Example | Source |
| --- | --- | --- |
| Subject nouns are plural | `Interfaces`, not `Interface` | format skill |
| Intent / topic tags are singular | `Authentication`, not `Authentications` | format skill |
| Acronyms keep their vendor casing | `SGT`, `BGP`, `SD-WAN`, `MSO`, `HTTP` | convention chosen here |
| Product tags use the current marketing name | `Catalyst Center`, not `DNAC` | convention chosen here |
| Title Case throughout | `Capacity Planning` | convention chosen here |
| No tooling or build-process tags | `Dashboard Studio`, `Harvested`, `Migrated_From_SavedSearch` are dropped | convention chosen here |
| Upstream-content provenance is kept | `ESCU`, `TA Stock Dashboard` survive | format skill, which names these explicitly |
| No pure-sentiment tags | `Healthy`, `Warning`, `Critical` are dropped or folded into `Severity` | convention chosen here |

## The vocabulary

`Stanzas` is the number of the 1082 stanzas carrying that tag as of 2026-08-07.

### Product (31)

Which Cisco (or third-party) product the telemetry comes from. Derived from the `index_*` macro, the `sourcetype`, the data model, or a product-specific lookup.

| Tag | Stanzas |
| --- | ---: |
| `AI Defense` | 6 |
| `ASA` | 8 |
| `Active Directory` | 19 |
| `Catalyst Center` | 292 |
| `Cisco ACI` | 111 |
| `Cisco Spaces` | 130 |
| `Cyber Vision` | 8 |
| `Duo` | 16 |
| `Email Security` | 7 |
| `Email Threat Defense` | 3 |
| `FTD` | 36 |
| `IOS` | 34 |
| `ISE` | 66 |
| `Isovalent` | 3 |
| `MSO` | 24 |
| `Meraki` | 58 |
| `Multicloud Defense` | 8 |
| `Nexus 9000` | 12 |
| `Nexus Dashboard` | 77 |
| `Palo Alto Networks` | 5 |
| `SD-WAN` | 45 |
| `Secure Access` | 33 |
| `Secure Client` | 9 |
| `Secure Network Analytics` | 4 |
| `Secure Workload` | 4 |
| `Splunk Attack Analyzer` | 24 |
| `ThousandEyes` | 108 |
| `Web Security` | 3 |
| `Webex` | 7 |
| `XDR` | 25 |
| `Zeek` | 15 |

### Solution (14)

Which business narrative or dashboard family the search belongs to. Derived from the stanza's locked `category` / `sub_category`.

| Tag | Stanzas |
| --- | ---: |
| `Agentic Ops` | 19 |
| `Building Intelligence` | 51 |
| `Cisco DC Networking` | 176 |
| `Executive` | 51 |
| `Hybrid Mesh Firewalling` | 40 |
| `IT Health` | 115 |
| `NetOps Readiness` | 27 |
| `Network Intelligence` | 48 |
| `Scalable Network Segmentation` | 25 |
| `Secure Infrastructure` | 71 |
| `Secure Networking` | 185 |
| `Security` | 168 |
| `Workplace SPOG` | 10 |
| `Zero Trust Access` | 45 |

### Subject (27)

The entity the search counts, groups by, or lists. Derived from the fields the SPL actually groups by (`BY`), renames (`AS`), evaluates, or tables.

| Tag | Stanzas |
| --- | ---: |
| `Access Points` | 15 |
| `Advisories` | 13 |
| `Alerts` | 22 |
| `Anomaly Records` | 11 |
| `Applications` | 42 |
| `Assets` | 10 |
| `Clients` | 110 |
| `Devices` | 178 |
| `Endpoints` | 60 |
| `Events` | 56 |
| `Faults` | 19 |
| `Files` | 7 |
| `Flows` | 16 |
| `Hosts` | 5 |
| `Incidents` | 14 |
| `Interfaces` | 24 |
| `Issues` | 38 |
| `Policies` | 61 |
| `Rooms` | 27 |
| `Sensors` | 26 |
| `Sessions` | 23 |
| `Sites` | 134 |
| `Tenants` | 36 |
| `Threats` | 34 |
| `Tunnels` | 9 |
| `Users` | 34 |
| `Vulnerabilities` | 7 |

### Topic (51)

The operational or security concern. Derived from output fields plus base-search predicates.

| Tag | Stanzas |
| --- | ---: |
| `Audit` | 29 |
| `Authentication` | 46 |
| `Availability` | 36 |
| `BGP` | 12 |
| `Bandwidth` | 11 |
| `Capacity Planning` | 41 |
| `Cloud Security` | 13 |
| `Collaboration` | 13 |
| `Compliance` | 13 |
| `Configuration` | 13 |
| `DHCP` | 12 |
| `DNS` | 23 |
| `Data Loss Prevention` | 4 |
| `Encryption` | 11 |
| `Environmental` | 20 |
| `Errors` | 15 |
| `Fabric` | 39 |
| `Feed Health` | 34 |
| `Firewall` | 79 |
| `Forensics` | 18 |
| `HTTP` | 18 |
| `Identity` | 82 |
| `Intrusion Prevention` | 20 |
| `Inventory` | 92 |
| `Jitter` | 5 |
| `Latency` | 50 |
| `Lifecycle` | 6 |
| `Machine Learning` | 23 |
| `Malware` | 7 |
| `Occupancy` | 43 |
| `Onboarding` | 16 |
| `Packet Loss` | 15 |
| `Posture` | 10 |
| `Power` | 9 |
| `Presence` | 16 |
| `Reachability` | 20 |
| `Risk` | 10 |
| `Rogue AP` | 10 |
| `Routing` | 11 |
| `SGT` | 15 |
| `SSID` | 16 |
| `Switching` | 12 |
| `Syslog` | 28 |
| `Traffic` | 48 |
| `User Experience` | 25 |
| `Utilization` | 37 |
| `VPN` | 3 |
| `Voice` | 15 |
| `Web Filtering` | 9 |
| `Wired` | 18 |
| `Wireless` | 59 |

### Shape (14)

What kind of answer the search returns. Derived from the SPL command signature (`timechart`, `top`, `predict`, `fit`, `iplocation`, ...) and `default_viz`.

| Tag | Stanzas |
| --- | ---: |
| `Anomaly` | 37 |
| `Comparison` | 8 |
| `Detail` | 25 |
| `Distribution` | 267 |
| `Drilldown` | 114 |
| `Forecast` | 21 |
| `Health Score` | 173 |
| `KPI` | 151 |
| `Leaderboard` | 36 |
| `Map` | 16 |
| `Severity` | 38 |
| `Table` | 331 |
| `Topology` | 17 |
| `Trend` | 237 |

### Provenance (2)

Content that came from an upstream content pack rather than from this app. Derived from the locked `sub_category` and the stanza's existing tags.

| Tag | Stanzas |
| --- | ---: |
| `ESCU` | 8 |
| `TA Stock Dashboard` | 4 |

## Alias mapping

Every one of the 588 legacy tag values maps to exactly one canonical tag or is dropped. Nothing was silently discarded: a legacy tag that carried no filtering value was dropped deliberately, and the reason is in the Dropped table below.

- 487 legacy values remap to a canonical tag.
- 32 legacy values are dropped as noise.

### Remapped

| Legacy tag | Canonical tag |
| --- | --- |
| `802.1X` | `Authentication` |
| `A2A` | `Agentic Ops` |
| `AAA` | `Authentication` |
| `ACI` | `Cisco ACI` |
| `AMP` | `Malware` |
| `AP` | `Access Points` |
| `AP Load` | `Utilization` |
| `AP Usage` | `Utilization` |
| `APIC` | `Cisco ACI` |
| `AV` | `Malware` |
| `AWS` | `Cloud Security` |
| `Abuse` | `Threats` |
| `Access Control` | `Policies` |
| `Access Control Policy` | `Policies` |
| `Action Distribution` | `Distribution` |
| `Active Calls` | `Sessions` |
| `Active Devices` | `Devices` |
| `Activities` | `Events` |
| `Activity Logs` | `Audit` |
| `Admin Activity` | `Audit` |
| `Administrators` | `Users` |
| `Advanced Logging` | `Feed Health` |
| `Advisory` | `Advisories` |
| `Agent` | `Agentic Ops` |
| `Agent Location Match` | `Topology` |
| `Agent to Agent` | `Agentic Ops` |
| `Air Marshal` | `Meraki` |
| `Air Quality` | `Environmental` |
| `Alarms` | `Alerts` |
| `Alert Triage` | `Alerts` |
| `Anomalies` | `Anomaly` |
| `Application` | `Applications` |
| `Application Access` | `Applications` |
| `Application Health` | `Health Score` |
| `Area` | `Rooms` |
| `Asset Management` | `Inventory` |
| `Asset Visibility` | `Cyber Vision` |
| `Assignment` | `Configuration` |
| `Association` | `Wireless` |
| `Assurance Alerts` | `Alerts` |
| `AttackAnalyzer` | `Splunk Attack Analyzer` |
| `Audit Logs` | `Audit` |
| `Authorization` | `Authentication` |
| `Azure` | `Cloud Security` |
| `BSSID` | `Wireless` |
| `Band` | `Wireless` |
| `Baseline` | `Anomaly` |
| `Beacon` | `Threats` |
| `Behavior` | `Trend` |
| `Binding` | `Topology` |
| `Block` | `Policies` |
| `Blocked` | `Policies` |
| `Booking` | `Rooms` |
| `Branch` | `Sites` |
| `Break Room` | `Rooms` |
| `Breakdown` | `Distribution` |
| `Bridge Domain` | `Fabric` |
| `Brute Force` | `Threats` |
| `Building` | `Building Intelligence` |
| `Burst` | `Anomaly` |
| `CO2` | `Environmental` |
| `CPU` | `Utilization` |
| `CVE` | `Vulnerabilities` |
| `CVI` | `Cyber Vision` |
| `CVSS` | `Vulnerabilities` |
| `Cadence` | `Threats` |
| `Cafe` | `Rooms` |
| `Camera` | `Sensors` |
| `Capacity` | `Utilization` |
| `Certificates` | `Encryption` |
| `Change Detection` | `Anomaly` |
| `Change Management` | `Configuration` |
| `Change Tracking` | `Configuration` |
| `Circuits` | `Interfaces` |
| `Cisco Catalyst Center` | `Catalyst Center` |
| `Cisco Duo` | `Duo` |
| `Cisco Firewall` | `Firewall` |
| `Cisco IOS` | `IOS` |
| `Cisco Intersight` | `Secure Infrastructure` |
| `Cisco Meraki` | `Meraki` |
| `Cisco Nexus 9000` | `Nexus 9000` |
| `Cisco Nexus Dashboard` | `Nexus Dashboard` |
| `Cisco Secure Access` | `Secure Access` |
| `Cisco Secure Client` | `Secure Client` |
| `Cisco Secure Workload` | `Secure Workload` |
| `Cisco Security Cloud` | `Secure Networking` |
| `Cisco Spaces Intelligence` | `Cisco Spaces` |
| `Classification` | `Policies` |
| `Client` | `Clients` |
| `Client Connectivity` | `Reachability` |
| `Client Count` | `Clients` |
| `Client Distribution` | `Distribution` |
| `Client Health` | `Health Score` |
| `Client Investigation` | `Forensics` |
| `Client Onboarding` | `Onboarding` |
| `Client Summary` | `Clients` |
| `Cloud Firewall` | `Firewall` |
| `Cloud Native Security` | `Cloud Security` |
| `Codes` | `Errors` |
| `Collection Gap` | `Feed Health` |
| `Completion` | `Availability` |
| `Composite KPI` | `KPI` |
| `Config Change` | `Configuration` |
| `Configuration Management` | `Configuration` |
| `Configuration Status` | `Configuration` |
| `Connection` | `Sessions` |
| `Connection Rate` | `Sessions` |
| `Connection Status` | `Sessions` |
| `Connectivity` | `Reachability` |
| `Container` | `Cloud Security` |
| `Containment` | `Policies` |
| `Contracts` | `Policies` |
| `Control Plane` | `Routing` |
| `Correlation` | `Comparison` |
| `Coverage` | `Inventory` |
| `Crashes` | `Errors` |
| `Critical` | `Severity` |
| `Critical Sites` | `Sites` |
| `Cross-Source` | `Comparison` |
| `Cross-Source Correlation` | `Comparison` |
| `Crypto` | `Encryption` |
| `Cyber Vision TA` | `Cyber Vision` |
| `DLP` | `Data Loss Prevention` |
| `DNAC` | `Catalyst Center` |
| `DNS Security` | `DNS` |
| `DNSSEC` | `DNS` |
| `Data Center` | `Cisco DC Networking` |
| `DataQuality` | `Feed Health` |
| `Dead Zone` | `Availability` |
| `Delegation` | `Configuration` |
| `Denial` | `Policies` |
| `DensityFunction` | `Machine Learning` |
| `Deny` | `Policies` |
| `Desk` | `Rooms` |
| `Destinations` | `Traffic` |
| `Detections` | `Threats` |
| `Device` | `Devices` |
| `Device Availability` | `Availability` |
| `Device Family` | `Inventory` |
| `Device Health` | `Health Score` |
| `Device Inventory` | `Inventory` |
| `Device Posture` | `Posture` |
| `Disconnect` | `Availability` |
| `Domain Score` | `DNS` |
| `Domains` | `DNS` |
| `Doors` | `Environmental` |
| `Down` | `Availability` |
| `Duration` | `Latency` |
| `EIGRP` | `Routing` |
| `EOL` | `Lifecycle` |
| `EPG` | `Policies` |
| `ESA` | `Email Security` |
| `ETD` | `Email Threat Defense` |
| `East-West` | `Traffic` |
| `Efficiency` | `Capacity Planning` |
| `Egress` | `Traffic` |
| `Eliminate` | `Capacity Planning` |
| `Email` | `Email Security` |
| `Encrypted` | `Encryption` |
| `Endace` | `Secure Network Analytics` |
| `Endpoint` | `Endpoints` |
| `Enforcement` | `Policies` |
| `Error Disable` | `Errors` |
| `Event` | `Events` |
| `Executive Summary` | `Executive` |
| `Exfiltration` | `Data Loss Prevention` |
| `Exploits` | `Vulnerabilities` |
| `Exposure` | `Risk` |
| `External IP` | `Traffic` |
| `FEX` | `Nexus 9000` |
| `FMC` | `FTD` |
| `FQDNs` | `DNS` |
| `FTP` | `Applications` |
| `Fabric Adoption` | `Fabric` |
| `Fabric Health` | `Health Score` |
| `Factors` | `Authentication` |
| `Failure` | `Errors` |
| `Failure Rate` | `Errors` |
| `Failures` | `Errors` |
| `Feed Monitor` | `Feed Health` |
| `File Hash` | `Files` |
| `File Inspection` | `Files` |
| `Findings` | `Threats` |
| `Fingerprint` | `Trend` |
| `Firehose` | `Cisco Spaces` |
| `Firepower` | `FTD` |
| `Firewall Count` | `Firewall` |
| `Firmware Lifecycle` | `Lifecycle` |
| `Flap Detection` | `Interfaces` |
| `Flapping` | `Interfaces` |
| `Footprint` | `Inventory` |
| `GCP` | `Cloud Security` |
| `Gateways` | `Devices` |
| `Gathering` | `Rooms` |
| `GenAI` | `AI Defense` |
| `Geo Enriched` | `Map` |
| `Ghost Booking` | `Rooms` |
| `Guest` | `Authentication` |
| `Guest Access` | `Authentication` |
| `HVAC` | `Environmental` |
| `Hardware` | `Inventory` |
| `Headcount` | `Occupancy` |
| `Health Distribution` | `Distribution` |
| `Health Threshold` | `Health Score` |
| `Heatmap` | `Distribution` |
| `History` | `Trend` |
| `Hotspot` | `Rooms` |
| `Humidity` | `Environmental` |
| `Hybrid Firewall` | `Hybrid Mesh Firewalling` |
| `IDS` | `Intrusion Prevention` |
| `IOC` | `Threats` |
| `IP-SGT Bindings` | `SGT` |
| `IPS` | `Intrusion Prevention` |
| `IPSEC` | `VPN` |
| `ISE TA` | `ISE` |
| `ISP` | `Reachability` |
| `ISP Uplink` | `Reachability` |
| `Identity Provider` | `Identity` |
| `Idle` | `Utilization` |
| `Impact Scoring` | `Risk` |
| `Incident` | `Incidents` |
| `Informal` | `Rooms` |
| `Infrastructure` | `Secure Infrastructure` |
| `Ingest Volume` | `Feed Health` |
| `Interference` | `Wireless` |
| `Internet` | `Reachability` |
| `Internet Insights` | `Reachability` |
| `Intersight` | `Secure Infrastructure` |
| `Intrusion Events - Alert Message` | `Intrusion Prevention` |
| `Intrusions` | `Intrusion Prevention` |
| `Investigation` | `Forensics` |
| `IoT` | `Sensors` |
| `Issue Management` | `Issues` |
| `Jobs` | `Splunk Attack Analyzer` |
| `L2 Segmentation` | `Switching` |
| `L3Out` | `Fabric` |
| `LDOS` | `Lifecycle` |
| `LLP5` | `Machine Learning` |
| `LOLBins` | `Forensics` |
| `Lease` | `DHCP` |
| `Lease Rate` | `DHCP` |
| `Legacy KPI` | `KPI` |
| `License Usage` | `Inventory` |
| `Licensing` | `Inventory` |
| `Lineage` | `Forensics` |
| `Link` | `Topology` |
| `Link Availability` | `Availability` |
| `Linkgraph` | `Topology` |
| `Location` | `Sites` |
| `Lockout` | `Authentication` |
| `Logs` | `Events` |
| `Loss` | `Packet Loss` |
| `MAC` | `Switching` |
| `MAC Flap` | `Switching` |
| `MAC Steal` | `Switching` |
| `MFA` | `Authentication` |
| `MITRE` | `Forensics` |
| `MITRE ATT&CK` | `Forensics` |
| `MOS` | `Voice` |
| `MR` | `Meraki` |
| `MX Appliance` | `Meraki` |
| `MX Security Appliance` | `Meraki` |
| `Major` | `Severity` |
| `Matrix` | `Distribution` |
| `Memory` | `Utilization` |
| `Meraki TA` | `Meraki` |
| `Messages` | `Events` |
| `Metric` | `KPI` |
| `Micro-Segmentation` | `Scalable Network Segmentation` |
| `Models` | `Machine Learning` |
| `Monday` | `Trend` |
| `Multivariate` | `Machine Learning` |
| `NAC` | `Authentication` |
| `NACK` | `DHCP` |
| `NAD` | `Devices` |
| `NDFC` | `Nexus Dashboard` |
| `NDR` | `Secure Network Analytics` |
| `NGFW` | `FTD` |
| `NOC` | `IT Health` |
| `NOC Triage` | `IT Health` |
| `NTP` | `Configuration` |
| `NVM` | `Secure Client` |
| `Namespaces` | `Cloud Security` |
| `Network Access` | `Authentication` |
| `Network Compliance` | `Compliance` |
| `Network Device` | `Devices` |
| `Network Health` | `Health Score` |
| `Network Insights` | `Network Intelligence` |
| `Network Performance` | `Latency` |
| `Network Visibility` | `Secure Client` |
| `No-Show` | `Rooms` |
| `Nodes` | `Devices` |
| `Non Compliant` | `Compliance` |
| `North-South` | `Traffic` |
| `Notice` | `Events` |
| `Notices` | `Events` |
| `OSPF` | `Routing` |
| `OT` | `Cyber Vision` |
| `Organizations Security` | `Meraki` |
| `Outcome` | `Distribution` |
| `Outlier` | `Anomaly` |
| `Overlay` | `SD-WAN` |
| `PSIRT` | `Advisories` |
| `Packets` | `Traffic` |
| `Page Load` | `User Experience` |
| `Path Change` | `Routing` |
| `Physical Security` | `Environmental` |
| `Platform` | `Inventory` |
| `PoE` | `Power` |
| `Policy` | `Policies` |
| `Policy Alert` | `Policies` |
| `Policy Hit Count` | `Policies` |
| `Policy Outcome` | `Policies` |
| `Policy Set` | `Policies` |
| `Pool Exhaustion` | `DHCP` |
| `Port` | `Interfaces` |
| `Port Configuration` | `Interfaces` |
| `Port Diagnostics` | `Interfaces` |
| `Port Flapping` | `Interfaces` |
| `Power Budget` | `Power` |
| `Prediction` | `Forecast` |
| `Processes` | `Forensics` |
| `Profile` | `Inventory` |
| `Protocol` | `Traffic` |
| `Protocol Anomaly` | `Anomaly` |
| `Provider Comparison` | `Comparison` |
| `Proxy` | `Web Security` |
| `QUIC` | `Encryption` |
| `QoS` | `Traffic` |
| `Quality` | `User Experience` |
| `Quality Score` | `Health Score` |
| `Queries` | `DNS` |
| `RADIUS` | `Authentication` |
| `RF` | `Wireless` |
| `ROI` | `Capacity Planning` |
| `RSSI` | `Wireless` |
| `RTP` | `Voice` |
| `RaVPN` | `VPN` |
| `RadSec` | `Authentication` |
| `RandomForest` | `Machine Learning` |
| `Raw Events` | `Events` |
| `Readiness` | `NetOps Readiness` |
| `Recommendation` | `Capacity Planning` |
| `Recurring` | `Trend` |
| `Regional` | `Sites` |
| `Remediation` | `Policies` |
| `Remote` | `VPN` |
| `Remote Access` | `VPN` |
| `Remote Access VPN` | `VPN` |
| `Repurpose` | `Capacity Planning` |
| `Resolvers` | `DNS` |
| `Resources` | `Utilization` |
| `Response Time` | `Latency` |
| `Right-Sizing` | `Capacity Planning` |
| `Rogue` | `Rogue AP` |
| `Role` | `Inventory` |
| `Rollup` | `Feed Health` |
| `Room` | `Rooms` |
| `Root Cause Analysis` | `Forensics` |
| `Router` | `Devices` |
| `Rules` | `Policies` |
| `SD-Access` | `Fabric` |
| `SGACL` | `SGT` |
| `SIG` | `Secure Access` |
| `SIP` | `Voice` |
| `SLA` | `Availability` |
| `SMA` | `Email Security` |
| `SMS` | `Voice` |
| `SNA` | `Secure Network Analytics` |
| `SNR` | `Wireless` |
| `SOC` | `Security` |
| `SSE` | `Secure Access` |
| `SSH` | `Encryption` |
| `STP` | `Switching` |
| `SXP` | `SGT` |
| `SaaS` | `Applications` |
| `Scanning` | `Threats` |
| `Scope` | `DHCP` |
| `Score` | `Health Score` |
| `Secure Endpoint` | `Malware` |
| `Security Insights` | `Security` |
| `Security Issues` | `Issues` |
| `Security Zones` | `Policies` |
| `Services` | `Applications` |
| `Session` | `Sessions` |
| `Signatures` | `Intrusion Prevention` |
| `Site` | `Sites` |
| `Site Health` | `Health Score` |
| `Site Leaderboard` | `Leaderboard` |
| `Snooping` | `Switching` |
| `Spanning Tree` | `Switching` |
| `Spectrum` | `Wireless` |
| `Spontaneous` | `Rooms` |
| `Stability` | `Availability` |
| `Staleness` | `Feed Health` |
| `Statistical Baseline` | `Anomaly` |
| `Status` | `Availability` |
| `Stealthwatch` | `Secure Network Analytics` |
| `Strings` | `Forensics` |
| `Submissions` | `Email Security` |
| `Surge` | `Anomaly` |
| `Switches` | `Switching` |
| `T1190` | `Forensics` |
| `TACACS` | `Authentication` |
| `TCAM` | `Utilization` |
| `TLS` | `Encryption` |
| `Tasks` | `Splunk Attack Analyzer` |
| `Telemetry` | `Feed Health` |
| `Telephony` | `Voice` |
| `Temperature` | `Environmental` |
| `Tenant` | `Tenants` |
| `Test` | `ThousandEyes` |
| `Tetragon` | `Isovalent` |
| `Tetration` | `Secure Workload` |
| `Threat` | `Threats` |
| `Threat Attribution` | `Threats` |
| `Threat Categories` | `Threats` |
| `Threat Hunting` | `Forensics` |
| `Threat Indicators` | `Threats` |
| `Threat Intel` | `Threats` |
| `Threat Score` | `Threats` |
| `Threat Trend` | `Threats` |
| `Threshold` | `Anomaly` |
| `Throughput` | `Bandwidth` |
| `Time Drift` | `Configuration` |
| `Timeline` | `Trend` |
| `Top Talkers` | `Traffic` |
| `Topology Link` | `Topology` |
| `Topology Site` | `Sites` |
| `Trace` | `ThousandEyes` |
| `Tracebacks` | `Errors` |
| `Traffic Action` | `Traffic` |
| `Traffic Direction` | `Traffic` |
| `Traffic Flow` | `Flows` |
| `Transport` | `Interfaces` |
| `Trend Analysis` | `Trend` |
| `Triage` | `Forensics` |
| `Trust` | `Zero Trust Access` |
| `Trust Monitor` | `Duo` |
| `TrustSec` | `SGT` |
| `Tuning` | `Configuration` |
| `Tunnel` | `Tunnels` |
| `URL Filter` | `Web Filtering` |
| `URL Filtering` | `Web Filtering` |
| `URLs` | `Web Filtering` |
| `UTD` | `Intrusion Prevention` |
| `Umbrella` | `Secure Access` |
| `Underlay` | `SD-WAN` |
| `Underutilized` | `Utilization` |
| `Unencrypted` | `Encryption` |
| `Uptime` | `Availability` |
| `Usage` | `Utilization` |
| `User` | `Users` |
| `User Activity` | `Users` |
| `Users And Applications` | `Applications` |
| `VLAN` | `Switching` |
| `VNID` | `Fabric` |
| `VRF` | `Routing` |
| `VXLAN` | `Fabric` |
| `Vendors` | `Inventory` |
| `Verdict` | `Distribution` |
| `Video` | `Collaboration` |
| `Voice Quality` | `Voice` |
| `Volume` | `Utilization` |
| `WAF` | `Intrusion Prevention` |
| `WAN` | `Bandwidth` |
| `WAN Edge` | `SD-WAN` |
| `WLAN` | `Wireless` |
| `WLAN Security` | `Wireless` |
| `WSA` | `Web Security` |
| `Waste` | `Capacity Planning` |
| `Watchlist` | `Threats` |
| `Water Detection` | `Environmental` |
| `Web Transaction` | `User Experience` |
| `Weekly` | `Trend` |
| `Windows DHCP` | `DHCP` |
| `Wireless Security` | `Wireless` |
| `Workforce` | `Users` |
| `Workloads` | `Secure Workload` |
| `Workplace` | `Workplace SPOG` |
| `Z Score` | `Anomaly` |
| `Z-Score` | `Anomaly` |
| `ZTNA` | `Zero Trust Access` |
| `eStreamer` | `FTD` |
| `vManage` | `SD-WAN` |

### Dropped as noise

These carried no filtering value: they described the build pipeline, the rendering framework, the demo dataset, or a sentiment already expressed by `Severity`.

| Legacy tag | Why dropped |
| --- | --- |
| `API` | Transport mechanism, not subject matter. |
| `Administrator Users Search` | Restates one stanza's name. |
| `BEC query` | Restates one stanza's name. |
| `Bar` | Chart type, already covered by `Distribution`. |
| `Cisco` | True of nearly the whole catalog. |
| `Cisco Catalyst App Security Insights` | Restates one stanza's name. |
| `Dashboard Studio` | Rendering framework, not subject matter. Was on ~40% of the catalog. |
| `Data Model` | Implementation detail. |
| `Description Search` | Implementation detail. |
| `Dormant` | Ambiguous; meaning not recoverable from the SPL. |
| `Events And Incident Viewer` | UI placement, not subject matter. |
| `Harvested` | Build provenance. |
| `Health` | Too broad; replaced by `Health Score` where the SPL computes one. |
| `Healthy` | Sentiment; the searches are already tagged `Health Score`. |
| `ITSI` | Content-pack provenance. |
| `Index Management` | Implementation detail. |
| `Lookup` | Implementation detail. |
| `Lookup Enriched` | Implementation detail. |
| `Lookup Join` | Implementation detail. |
| `Macros` | Implementation detail. |
| `Network` | True of nearly the whole catalog. |
| `Observability` | True of nearly the whole catalog. |
| `Operations` | True of nearly the whole catalog. |
| `Operations Pressure` | Ambiguous; meaning not recoverable from the SPL. |
| `Overview` | Describes every aggregate search. |
| `Performance` | Too broad to filter on; replaced by `Latency` / `Utilization` where the SPL supports it. |
| `Signal Rail` | UI placement, not subject matter. |
| `Summary` | Describes every aggregate search. |
| `TStats` | Implementation detail. |
| `Third Party` | Ambiguous and already implied by the product tag. |
| `Unique` | Describes a `dc()` call, not subject matter. |
| `Warning` | Sentiment; folded into `Severity` where the SPL actually ranks severity. |

## Near-synonyms deliberately kept separate

A previous mechanical pass over-merged and had to be walked back, so each pair below was checked against the stanzas actually using it before the decision was made.

| Kept apart | Why |
| --- | --- |
| `Bandwidth` vs `Utilization` | `Bandwidth` is an absolute rate (Mbps on a WAN link). `Utilization` is a percentage of a ceiling (CPU %, TCAM %, AP client load). A search answering "how fast" and one answering "how close to full" are different questions. |
| `Availability` vs `Reachability` | `Availability` is a device or service being administratively up (`uptime`, `SLA`). `Reachability` is a path working end-to-end (ThousandEyes probes, ISP uplink, ping). A device can be up and unreachable. |
| `Latency` vs `Packet Loss` vs `Jitter` | Three separate measurements that appear independently in ThousandEyes and SD-WAN searches. Merging them into a single `Performance` tag is what made the old vocabulary unfilterable. |
| `Anomaly` vs `Machine Learning` vs `Forecast` | `Anomaly` is any deviation detection including plain stdev thresholds. `Machine Learning` requires an actual `fit`/`apply` MLTK call. `Forecast` requires `predict` or a forecasting algorithm. Many stanzas are anomaly detection with no ML at all. |
| `Health Score` vs `Severity` vs `Risk` | `Health Score` is a vendor-computed 0-10 or 0-100 score. `Severity` is an ordinal event class (syslog severity, fault severity). `Risk` is a security exposure rating (CVSS, Cyber Vision risk score). They come from different fields. |
| `Firewall` vs `Hybrid Mesh Firewalling` | `Firewall` is the capability (ACLs, deny/permit). `Hybrid Mesh Firewalling` is the Cisco solution narrative and matches a locked `sub_category`. Some firewall searches sit outside that narrative; some HMF searches are about identity, not filtering. |
| `Wireless` vs `SSID` vs `Access Points` vs `Rogue AP` | `Wireless` is the medium. `SSID` partitions by network name. `Access Points` are the infrastructure entity. `Rogue AP` is a security concern. Merging them would make it impossible to find rogue-AP searches specifically. |
| `Wired` vs `Switching` | `Wired` distinguishes wired clients from wireless ones (`client_type="WIRED"`). `Switching` is L2 infrastructure behaviour (STP, VLAN, MAC moves). A wired-client health search has nothing to do with spanning tree. |
| `Identity` vs `Authentication` vs `Posture` | `Identity` is who a principal is (ISE, AD, IdP). `Authentication` is a specific auth event with a pass/fail outcome. `Posture` is device trust state. ISE searches commonly cover one without the others. |
| `Traffic` vs `Flows` | `Traffic` is byte and packet volume. `Flows` is per-conversation records (NetFlow, connection events, zone pairs). A top-talkers byte chart is not a flow record table. |
| `Inventory` vs `Lifecycle` vs `Assets` | `Inventory` is what exists and how much. `Lifecycle` is EOL/EOS/LDOS and firmware version currency. `Assets` specifically means the `asset_inventory` lookup join, which is a different data source from device telemetry. |
| `Occupancy` vs `Presence` vs `Rooms` | `Occupancy` is how full a space is against capacity. `Presence` is whether people or devices are detected at all. `Rooms` is the space entity itself. Cisco Spaces searches use these independently. |
| `DNS` vs `Web Filtering` | Umbrella and Secure Access do both, but Zeek DNS analytics and Windows DHCP/DNS searches have nothing to do with URL categorisation, and FTD URL-category searches never touch DNS. |
| `Feed Health` vs `Availability` | `Feed Health` is about the ingest pipeline (staleness, collection gaps, ingest volume). `Availability` is about the monitored estate. A stale feed and a down device look the same on a dashboard and must be filterable apart. |
| `Distribution` vs `Leaderboard` vs `Comparison` | `Distribution` is a full breakdown across a dimension. `Leaderboard` is a truncated ranking (`top`, `head N`). `Comparison` is two populations set against each other (`appendcols`, `multisearch`, explicit delta fields). |
| `Map` vs `Topology` | `Map` is geographic (`iplocation`, `geostats`, lat/lon). `Topology` is graph structure (links, neighbours, site hierarchy). Both render as diagrams; they answer different questions. |

## Notable merges

| Collapsed into | From |
| --- | --- |
| `Catalyst Center` | `DNAC`, `Cisco Catalyst Center` |
| `Secure Access` | `Umbrella`, `SSE`, `SIG`, `Cisco Secure Access` |
| `FTD` | `Firepower`, `FMC`, `eStreamer`, `NGFW`, `Sourcefire` |
| `Cyber Vision` | `Cyber Vision TA`, `CVI`, `OT`, `Asset Visibility` |
| `SGT` | `TrustSec`, `SGACL`, `SXP`, `IP-SGT Bindings` |
| `Anomaly` | `Outlier`, `Baseline`, `Statistical Baseline`, `Z-Score`, `Z Score`, `Change Detection`, `Surge`, `Burst`, `Threshold`, `Protocol Anomaly` |
| `Health Score` | `Client Health`, `Device Health`, `Network Health`, `Site Health`, `Fabric Health`, `Application Health`, `Quality Score`, `Score`, `Health Threshold` |
| `Feed Health` | `Feed Monitor`, `Staleness`, `Collection Gap`, `Data Quality`, `DataQuality`, `Telemetry`, `Streaming Telemetry`, `Ingest Volume`, `Rollup`, `Advanced Logging` |
| `Utilization` | `Capacity`, `Usage`, `Volume`, `CPU`, `Memory`, `TCAM`, `Resources`, `AP Load`, `AP Usage`, `Underutilized`, `Idle` |
| `Environmental` | `Temperature`, `Humidity`, `CO2`, `Air Quality`, `HVAC`, `Water Detection`, `Doors`, `Physical Security` |
| `Interfaces` | `Port`, `Ports`, `Port Configuration`, `Port Diagnostics`, `Port Flapping`, `Flapping`, `Flap Detection`, `Circuits`, `Transport` |
| `Forensics` | `MITRE`, `MITRE ATT&CK`, `Threat Hunting`, `Investigation`, `Triage`, `Root Cause Analysis`, `Processes`, `Lineage`, `LOLBins`, `Strings` |
| `Threats` | `IOC`, `Watchlist`, `Botnet`, `Abuse`, `Scanning`, `Brute Force`, `Beacon`, `Threat Intel`, `Threat Score`, `Detections`, `Findings` |
| `Policies` | `Rules`, `Policy Set`, `Access Control`, `Access Control Policy`, `Contracts`, `EPG`, `Enforcement`, `Deny`, `Block`, `Blocked`, `Containment`, `Remediation`, `Classification` |
| `Sites` | `Site`, `Location`, `Regional`, `Branch`, `Critical Sites`, `Topology Site` |
| `Authentication` | `AAA`, `RADIUS`, `TACACS`, `RadSec`, `802.1X`, `NAC`, `Authorization`, `Lockout`, `MFA`, `Factors`, `Guest`, `Guest Access` |

## Amendments

Changes to this document after the first full retag. Each entry records what changed and why, so the document stays the single source of truth rather than a snapshot that the file has drifted away from.

### 2026-08-07 — `sub_category` retired as Subject/Topic evidence

The first retag scored the locked `category`/`sub_category` at 80, above output-schema fields and base-search predicates, for **all** facets. That was wrong for Subject and Topic. Those two fields record which dashboard family a stanza was written for; they do not describe what the SPL measures, and in this catalog they diverge constantly — a Cisco Spaces room-optimisation search sat under a `sub_category` that produced a `DHCP` tag, and eleven `dc_networking_*` stanzas carried `Compliance` with zero compliance evidence in their SPL.

A token-footprint audit over all 1082 stanzas surfaced 418 tag/stanza pairs where a Subject or Topic tag had no matching token anywhere in the `search` field. Reading the SPL of each pair individually confirmed **294 unsupported tags**, plus 6 more the audit had missed and 2 removed by the alias amendments below. A second, independent pass by five per-family reviewers agreed with 148 of those verdicts and found 15 more, most of them `Sites` on ACI stanzas whose only location-like field is `apic_host` — a controller identity, not a site. The combined result is **317 tags dropped from 268 stanzas**, with 41 substitute tags added where a removal would otherwise have left a stanza with no Subject or Topic. The remaining 124 pairs were audit false positives — real evidence the regex could not see, mostly product-specific field names (`merakiVpnPeers{}` for `VPN`, `%PLATFORM-2-PEM_NOINPUT` for `Power`, `activeCalls` for `Sessions`) and evidence hidden behind upstream macros such as `` `apic-fabric-overview` ``.

The evidence table, the guard list and maintenance rule 3 are amended accordingly. `sub_category` remains the definitional source for Solution and Provenance tags, where it is correct by construction.

### 2026-08-07 — alias `Rogue Peer` -> `Rogue AP` removed

Semantically wrong. An SD-WAN rogue peer is a control-plane trust problem — an unexpected vSmart or vBond peer in a `control-connection-state-change` log — and contains no access point. Folding it into `Rogue AP` filed a routing concern in the wireless-security bucket and, worse, made `Rogue AP` unreliable as a filter, which is the one property the *Near-synonyms deliberately kept separate* table claims for it.

The single affected stanza, `security_resilience_sdwan_hunt_rogue_peer_indicators`, is retagged to `Routing` (already present on it, and reached from the `Control Plane` alias, which is exactly what the SPL parses). A new `Rogue Peer` term was considered and rejected: it would have one stanza behind it, and `SD-WAN` + `Routing` + `Forensics` already locate the search. `Rogue AP` drops from 14 stanzas to 10 and is not orphaned.

### 2026-08-07 — alias `Blocked Access` -> `Web Filtering` removed

Same class of defect. `Blocked Access` is a generic phrase that any deny decision can produce; mapping it to `Web Filtering` put a ZTNA policy-outcome search into the URL-categorisation bucket, contradicting the `DNS` vs `Web Filtering` row in the deliberate-distinctions table. The affected stanza, `secure_networking_zta_blocked_access_reason_trend`, keeps `Policies`, which is what a ZTNA block reason actually is. `Web Filtering` drops from 11 stanzas to 9 (this stanza plus the `URLs` correction below).

The related aliases `URL Filter`, `URL Filtering` and `URLs` are **kept**: they are genuinely about URL categorisation on FTD and Secure Access. One stanza misused `URLs` (`xdr_aa_forensic_urls_context_posture`, where the URLs are detonation artifacts rather than filtered categories); that was corrected as a tagging error, not an alias defect.

### 2026-08-07 — Subject term `Anomaly Records` added

`Anomaly` is a **Shape** term: it says the search *detects* a deviation, and it is earned by a `stdev`, `DensityFunction`, `IsOutlier` or equivalent step in the SPL. It says nothing about what the search is *about*. That left no way to describe a search whose subject **is** an anomaly record — a row emitted by Nexus Dashboard Insights (`sourcetype="cisco:dc:nd:anomalies"`, `anomalyId`, `anomalyScore`, `anomalyStr`) or by a Zeek/FTD `weird` protocol-anomaly feed. Those searches list, count and group by anomaly records the way other searches list `Faults`, `Advisories` or `Incidents`, and they were being tagged `Issues` as a workaround. `Issues` is the Catalyst Center issue object; borrowing it for Nexus Dashboard anomalies made both terms unreliable filters.

The new Subject term is **`Anomaly Records`**, not `Anomalies`. `Anomalies` would follow the plural-noun convention but differs from the Shape term `Anomaly` by one character, and the two would sit next to each other in every tag list — precisely the confusion the Shape/Subject split exists to prevent. `Anomaly Findings` was rejected because `Findings` is already an alias of `Threats` in the *Notable merges* table. `Anomaly Records` names the artefact, is unambiguous at a glance, and matches the existing two-word Subject term `Access Points`.

Eleven stanzas are retagged, all of them by substitution, so no stanza changes its tag count:

| Stanza | Tag replaced | Why |
| --- | --- | --- |
| `dc_networking_anomalies` | `Issues` | the `Issues` workaround named in the brief |
| `dc_networking_anomalies_anomalies_details` | `Issues` | same |
| `dc_networking_anomalies_anomalies_by_category` | `Issues` | same |
| `dc_networking_anomalies_anomalies_by_severity` | `Issues` | same |
| `dc_networking_anomalies_top_10_nodes_contributing_to_anomalies` | `Issues` | same |
| `network_dc_nd_active_anomalies_by_fabric` | `Anomaly` | `stats ... by anomalyId` then `chart count over fabric`; no detection step, so the Shape tag was unsupported |
| `network_dc_nd_top_active_anomaly_types` | `Anomaly` | same |
| `secure_networking_dc_anomaly_count` | `Anomaly` | `dc(anomalyId)` over a timechart; counts records, detects nothing |
| `secure_networking_dc_anomalies_by_severity` | `Anomaly` | `stats count ... by severity` over anomaly records |
| `secure_networking_dc_health_signals_trend` | `Anomaly` | `dc(signal_id) by signal_type`; pairs with the `Advisories` Subject already on the stanza |
| `network_intelligence_ftd_protocol_anomalies` | `Anomaly` | `cisco:ftd:adv:weird` records grouped `by anomaly_signature, anomaly_category` |

`Anomaly` drops from 43 stanzas to 37 and `Issues` from 43 to 38; neither is orphaned. Six other stanzas that surface anomaly data were examined and deliberately **not** retagged, because their subject is a different entity that anomaly score merely describes: `dc_networking_anomalies_sites_anomaly_score_over_time` (groups by `fabricName`), `dc_networking_interface_stats_number_of_interfaces_with_anomalies` and `dc_networking_interface_stats_top_10_anomalous_nodes` (count interfaces and nodes), `dc_networking_endpoints_average_anomaly_score_by_endpoint` (endpoints), `feed_monitor_aci_nd_staleness` and `feed_monitor_all_feeds_health_matrix` (ingest pipelines).

### 2026-08-07 — `sub_category` corrected where it contradicted its own searches

The retag left `category`/`sub_category` locked, which meant Solution and Provenance tags were still being derived from names that several groups' SPL did not support — `Compliance & Advisories` over eleven stanzas with no compliance evidence, `TE Application` over twelve synthetic-test searches, `Hybrid Firewall` over four SD-WAN site-health searches. 134 stanzas moved to a `sub_category` that describes what they measure; `category` was not touched. The full mapping is recorded in the change that made it.

Only one move affected the Solution facet. `Monitoring / Hybrid Firewall` is the legacy spelling of the `Hybrid Mesh Firewalling` pillar — the *Alias mapping* table already remaps the tag that way — so it was normalised to `Monitoring / Hybrid Mesh Firewalling` rather than merged into `Monitoring / SD-WAN`. Merging would have described the SPL better but removed the only `sub_category` evidence for the `Hybrid Mesh Firewalling` and `Secure Networking` Solution tags those four stanzas carry, and for the `sn_hmf_sdwan_network_health` dashboard they back. Every other move stayed inside its `category`, so no Solution or Provenance tag changed.

### Vocabulary size

One canonical term was added: the Subject term `Anomaly Records`. The vocabulary moves from 138 to **139 terms**, within the agreed 120-150 band. Two alias rows were deleted by the amendments above; no alias row was added.

## How tags are assigned

Tags are evidence-scored, never inferred from the stanza name. Several stanzas in this catalog have names that disagree with their SPL, and the SPL wins.

| Evidence | Score | Example |
| --- | ---: | --- |
| `index_*` macro, `sourcetype`, data model | 100 | `sourcetype="cisco:dc:aci:health"` -> `Cisco ACI` |
| Locked `category` / `sub_category` — **Solution and Provenance facets only** | 80 | `sub_category="Zero Trust Access"` -> `Zero Trust Access` |
| Existing tag, resolved through the alias map | 55 | `DNAC` -> `Catalyst Center` |
| SPL command signature and `default_viz` | 30-48 | `\| predict` -> `Forecast` |
| Product-specific lookup join | 45 | `cisco_dc_nexus_hostname_lookup` -> `Nexus 9000` |
| Narrow full-text predicate | 34 | `client_type="WIRED"` -> `Wired` |
| Output-schema fields (`BY`, `AS`, `eval`, `table`) | 22-30 | `BY ssid` -> `SSID` |
| Base-search predicates | 16-22 | `eventType="SPACE_OCCUPANCY"` -> `Occupancy` |

Three guards matter:

- **`category` and `sub_category` are never positive evidence for a Subject or Topic tag.** Those two fields name the dashboard family a stanza was written for, not what its SPL measures, and the two diverge often enough that treating them as evidence produced 294 unsupported tags in the 2026-08-07 retag (see *Amendments*). A Subject tag must name something the SPL groups by, renames, evaluates or tables; a Topic tag must be traceable to an output field or a base-search predicate. `sub_category` may still contribute to Solution and Provenance tags, where it is the definitional source.
- A stanza that enumerates more than six sourcetypes (or more than eight index macros) gets **no** product tags. Naming two products out of fifty is worse than naming none, so those cross-source admin and feed-monitor searches are described by what they are instead — `Feed Health`, `Configuration`.
- A single-value tile never receives `Distribution` or `Table`, regardless of the intermediate `stats ... by` stages its SPL uses to get to one number.

## Maintaining this

When adding a stanza:

1. Pick 3-6 tags from the tables above. Nothing outside them.
2. At least one Product or Solution tag, and at least one Subject or Topic tag.
3. Every Subject and Topic tag must be justifiable from the `search` field alone. Solution and Provenance tags may come from the locked `category`/`sub_category`. If you cannot point at the evidence, drop the tag.
4. Prefer an existing tag over proposing a new one. A new tag needs to partition the catalog meaningfully, and the vocabulary is already at 139 of the agreed 150 ceiling.
5. Bump `date_updated`.
