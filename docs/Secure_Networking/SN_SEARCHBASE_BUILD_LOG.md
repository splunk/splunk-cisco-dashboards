# Secure Networking — searchbase.conf Build Log

Running record of what's been added to `searchbase.conf` for the Secure Networking effort, what's pending, and exactly what data is needed to unblock each pending item. Update this as work continues — don't let status drift from what's actually in `searchbase.conf`.

**Conventions:** stanza IDs prefixed `secure_networking_`; `tags` always include `Secure Networking` + the pillar name + a collection-method tag naming the source TA (e.g. `ISE TA`, `Meraki TA`, `Catalyst Center TA`, `Cyber Vision TA`). Entries marked **SPL-validated** were run against the live `/opt/10` instance — query via `https://localhost:8093/servicesNS/nobody/splunk-cisco-dashboards/search/jobs/export` (must be namespaced to the app or private lookups/macros won't resolve). Entries marked **parser/quality-audit clean** have passed local searchbase parsing, duplicate-ID checks, and `audit_searchbase_quality.py`, but still need live `/opt/10` SPL export validation.

**Where this fits:** this is the build-execution record. For project context/stakeholders/timeline see `SN_EVENT_SCOPING.md`; for the full 98-item candidate inventory see `SN_SEARCH_BUILD_LIST.md`; for the prioritized P0/P1 queue see `SN_SEARCHBASE_NEXT_BUILD_PLAN.md` (authored separately, via Codex); for the sourcetype↔TA catalog see `SN_SOURCETYPE_REFERENCE.md`. Index: `README.md`.

## Status summary (as of 2026-07-21)

- **`searchbase.conf`:** 843 total stanzas, **29 `secure_networking_`** stanzas. All 29 `Secure Networking` tagged stanzas pass live `/opt/10` export validation as of 2026-07-21. Seven pass with no rows in the current live window (`ip_sgt_bindings`, `vendor_mac_on_nac_port`, and the 5 newest demo-data-backed stanzas); the new DLP/RaVPN/Intersight/SGT sample files are present on disk in demo-data-gen, but not yet visible as indexed live results in that validation window.
- **Overview profile:** the `secure_networking` Overview profile is wired up — now 21 stanzas carry explicit `viz_options.overview` entries across all 5 pillar sections (17 prior entries + 4 new P1 overview tiles), plus 5 `[secure_networking.<section>]` stanzas in `overview_factory_tiles.conf`. Factory-tile ordering still needs a follow-up pass if the new P1 tiles should be pinned into the first viewport. See "Overview profile integration" below.
- **Field-reference dashboards:** ~60 panels catalogued (7 dashboards). 3 field-reference panels built; a broader P0/P1 buildable-today core (source health, site inventory, ISE-auth, segmentation, HMF, secure-infra, SD-WAN) is now represented in searchbase; the rest split between needs-data and genuinely-non-TA pipelines.
- **Verification:** an adversarial audit (2026-07-21) confirmed committed files are scrub-clean and both new ISE stanzas run correct; it also corrected 3 buildability misclassifications (see "Audit corrections"). Latest validation (2026-07-21 19:00): `audit_searchbase.py`, `audit_searchbase_quality.py --json` filtered to Secure Networking (`0` findings), token check, duplicate-stanza check, and full live `/opt/10` export validation all pass.
- **Bug filed:** `app_cisco_common#19` (broken `ta_cisco_catalyst_security_group_tag_mapping` lookup, found building the IP-SGT stanza).

---

## Field-reference dashboard panel inventory

Complete catalog of every panel observed across a set of mature, field-built TrustSec/segmentation reference dashboards (shared as screenshots for reverse-engineering). Panel titles, viz types, and field names are recorded verbatim; all customer/environment identifiers (org, facility, division, hostnames) are intentionally omitted — only the reusable technical structure is kept.

**Critical architectural note on data provenance.** These reference dashboards are fed by data pipelines that mostly do **not** correspond to any shipping Cisco TA:
- **Config-compatibility / TrustSec-readiness panels** (hardware/software compat, global config, access/uplink/AP port config, NetFlow config, MTU) come from a **Cisco inventory-collector export → custom Python scripts → static lookups → Splunk** pipeline. No TA produces this; it needs the external script pipeline or a synthetic sourcetype for demo.
- **Endpoint / CMDB / remediation panels** come from a **ServiceNow CMDB SQL import + ISE merge + third-party device-visibility (IoT/OT) + "flat MAC" allowlist**. No single TA; needs CMDB + those reference sources.
- **SGACL Tracker** comes from **SGACL enforcement logs pushed ~every 90s** — needs `cisco:sdwan:sgacl:logs` (or equivalent ISE/device SGACL logging), which has 0 live events here.
- **Excessive-MAC / vendor-MAC panels** come from **ISE syslog** — the only group largely buildable against a shipping TA today (built, see above).

Status legend: **Built** (stanza exists) · **Buildable** (data/TA exists, not yet written) · **Needs data** (right TA, no live sample yet) · **Needs pipeline** (no TA — needs external script/CMDB/synthetic source).

### Dashboard: Endpoint Search Results (segmentation / CMDB endpoint detail)
Pillar: Scalable Network Segmentation · Collection: ISE + CMDB merge

| Panel | Viz | Key fields | Status |
|---|---|---|---|
| Endpoint Search Results | table | Last_Auth, First_Auth, MAC_Address, IP_Address, division, facility, CMDB_Group, Manufacturer, CMDB_SGT, ISE_SGT, SGT_Mismatch, SGT_Version, CMDB_Status, CI_Class, Device_Type, CI_Sys_ID, CI_URL | **Needs pipeline** (CMDB↔ISE merge; ISE side live, CMDB side absent) |

### Dashboard: Endpoint First Seen Stats (executive segmentation / CMDB coverage)
Pillar: Scalable Network Segmentation · Collection: ISE + CMDB merge, KV-store first-seen

| Panel | Viz | Notes | Status |
|---|---|---|---|
| Total Endpoints | single value | unique MAC addresses | **Buildable** (ISE `dc(EndPointMACAddress)`) |
| Missing from CMDB | single value | no CI class present | **Needs pipeline** (CMDB) |
| CMDB Coverage % | single value | endpoints with CI class / total | **Needs pipeline** (CMDB) |
| SGT Mismatch | single value | CMDB SGT differs from ISE SGT | **Needs pipeline** (CMDB SGT vs ISE SGT) |
| Silver / Silver Coverage % / Non Silver | single values | SGT "version tag" completeness (02=silver/complete, 00=missing) | **Needs pipeline** (CMDB record-completeness) |
| Override | single value | version tag 01 | **Needs pipeline** |
| Remediation | single value | version tag 03 | **Needs pipeline** |
| Device Types Missing from CMDB | bar | by Device_Type | **Needs pipeline** (CMDB) |
| CMDB Coverage by CI Class | bar | by CI class | **Needs pipeline** (CMDB) |

### Dashboard: Endpoint Remediation (SQL/CMDB import remediation)
Pillar: Scalable Network Segmentation · Collection: CMDB SQL import + ISE + IoT/OT visibility + flat-MAC allowlist

| Panel | Viz | Notes | Status |
|---|---|---|---|
| Default Tag Count / Restrictive Default Tag Count | single values | endpoints on default vs. restrictive-default SGT | **Needs pipeline** |
| Total Endpoints (90 days) | single value | — | **Buildable** (ISE) |
| Endpoints Missing from CMDB | single value | no CI class | **Needs pipeline** (CMDB) |
| Endpoint Missing from ORDR | single value | not seen by IoT/OT visibility platform | **Buildable** (corrected 2026-07-21) — ORDR is one 3rd-party option, but Cisco's own **Cyber Vision** (`cisco:cybervision:devices`, shipping via `TA_cisco_catalyst`, 64K+ live events with `mac{}`) is the native OT/IoT visibility source. "Endpoints in ISE but not in OT/IoT inventory" = ISE `EndPointMACAddress` ⋈ Cyber Vision `mac{}`, both shipping sourcetypes. Device-inventory side now built → `secure_networking_ot_iot_device_visibility` |
| Silver Record / Not Silver Record | single values | SGT version tag -02 / -00 | **Needs pipeline** |
| Override Policy / Default Policy Override | single values | SGT version tag -01 / -03 | **Needs pipeline** |
| Endpoint Missing from Flat Mac | single value | not in MAC allowlist | **Needs pipeline** (allowlist source) |
| Top 10 Tags Present | bar | by sgt_profile | **Buildable-ish** (ISE SGT profile counts) |
| Remediation detail | table | Last_Auth, macaddress, facility, group, mfgname, CMDB_SGT, ISE_SGT, SGT_Version, ci_class, devicetype | **Needs pipeline** (CMDB merge) |

### Dashboard: Excessive Unique MAC Port Auth
Pillar: Scalable Network Segmentation · Collection: ISE TA

| Panel | Viz | Key fields | Status |
|---|---|---|---|
| Excessive Unique MAC Port Auth | table | NetworkDeviceName, Address, NAS_Port_Id, Location, Unique_MACs | **Built** → `secure_networking_excessive_mac_per_port` |

### Dashboard: Possible EX_AUTH (virtual/vendor MAC review)
Pillar: Scalable Network Segmentation · Collection: ISE TA

| Panel | Viz | Key fields | Status |
|---|---|---|---|
| Possible EX_AUTH | table | NetworkDeviceName, Address, NAS_Port_Id, mac_address, Vendor MAC, Location | **Built** → `secure_networking_vendor_mac_on_nac_port` |

### Dashboard: SGACL Tracker
Pillar: Scalable Network Segmentation · Collection: SGACL enforcement logs (~90s push)

| Panel | Viz | Key fields | Status |
|---|---|---|---|
| Condensed No Src/Dst Ports | table | Net Dvc IP, Network Device, Ingress Interface, Source IP, Source SGT, Destination IP, Destination SGT, Action, Total Hits, min_time, max_time, Activity (sparkline) | **Needs data** (`cisco:sdwan:sgacl:logs`, 0 events) |
| Detailed no Dedup | table | _time, Net Dvc IP, Network Device, Ingress Interface, Source IP, Source SGT, Destination IP, Destination SGT, Protocol, Source Port, Destination Port, Action, ACL Name, ACL Hits | **Needs data** (same) |

### Dashboard: Config Compatibility / TrustSec Readiness
Pillar: Scalable Network Segmentation (+ Secure Infrastructure for the software/hardware compat parts) · Collection: **inventory-collector + Python-script pipeline — no TA**

**Software / hardware compatibility group** — **Buildable, partially built** (corrected 2026-07-21 by the buildability audit, which caught that this group was contradictorily marked "Needs pipeline" while the doc itself noted the overlap). Every field here (deviceName, productId, swVersion, swType, device family/model) is standard **Catalyst Center inventory** content — `cisco:catalyst:center:inventory:report` + `:compliance:report`, both shipping via `TA_cisco_catalyst` and live. The reference dashboard's exact Python-collector provenance differs, but the panel *content* is fully sourceable today. Already built: `secure_networking_software_license_compatibility` (software/license rollup) and `secure_networking_trustsec_hardware_readiness` (family/model rollup).
| Panel | Viz | Status |
|---|---|---|
| Software Compatibility (Total Supported Devices) | single value | **Buildable** (Catalyst Center inventory) — near-built |
| Top 10 Validated Software by Product Family | pie | **Buildable** (Catalyst Center inventory) |
| Unsupported Software Compatibility (Software + License counts) | 2 single values | **Buildable** — needs a supported-version/license reference lookup for the "unsupported" determination |
| Top 10 Unsupported Software by Product Family | pie | **Buildable** — same lookup dependency |
| Unsupported Software Details | table (deviceName, deviceHostName, deviceIp, division, productId, swVersion, swType, exceptionType) | **Buildable** (Catalyst Center inventory) — near-built via `secure_networking_software_license_compatibility` |

**Global config group** (checks presence of TrustSec/AAA global commands). **Nuanced after the buildability audit (2026-07-21):** the earlier blanket claim "no TA does running-config compliance" was too absolute — `cisco:catalyst:center:compliance:report` IS a shipping config-compliance source (live here, 3,108 events) with dimensions like *Startup vs Running Configuration*, *Network Settings*, *EoX*, *Software Image*, *Critical Security Advisories*, and an overall Compliance Status. **However**, it does NOT expose per-command granularity — there is no discrete "is `ctsRoleBasedEnforcement` present?" field. So a *coarse* device-config-compliance dashboard is **buildable today** from `compliance:report`; the *exact per-command* "Missing Global Command by command" panel still **needs the config-scrape pipeline**.
| Panel | Viz | Status |
|---|---|---|
| Missing Global Command: Device Count | single value | **Needs pipeline** for per-command; a coarse "non-compliant device count" is **Buildable** from `compliance:report` |
| Missing Global Command: by Command | pie (globalTrustSec, ctsRoleBasedEnforcement, ctsRoleBasedEnforcementVlanList, ctsAuthorizationListCtsList, aaaAuthorizationNetworkCtsListGroup, aaaAuthorizationCredentialDownloadCtsListGroup) | **Needs pipeline** (per-command granularity not in `compliance:report`) |
| Missing Global Command (Top 10 by division) | bar | **Needs pipeline** for per-command |
| Missing Global Config Details | table (deviceName, deviceHostName, deviceIp, division, productId, swVersion, swType, exceptionType) | **Buildable** (coarse compliance) from `compliance:report`; per-command detail needs pipeline |

**Access port config group:**
| Panel | Viz | Status |
|---|---|---|
| Access Port Config | single value | **Needs pipeline** |
| Missing Access Port Config | single value | **Needs pipeline** |
| Access Port Config: exemptions | single value | **Needs pipeline** |
| Access Port Config: Misconfigured Ports (missing "switchport mode"/"no switchport") | single value | **Needs pipeline** |
| Missing Access Port Config by Division (Top 10) | bar | **Needs pipeline** |
| Missing Access Port Config Details | table (deviceName, deviceHostName, deviceIp, division, productId, swVersion, swType, Missing_NAC, misConfiguredUserInterface, exemptions, exceptionType) | **Needs pipeline** |

**Uplink port config group** (neighbor-aware, CDP-based):
| Panel | Viz | Status |
|---|---|---|
| Uplink Port Config | single value | **Needs pipeline** |
| Missing Uplink Port Config | single value | **Needs pipeline** |
| Mismatched Uplink Port Config | single value | **Needs pipeline** |
| Exclude Uplink Ports (EX-CTS or EX-AUTH) | single value | **Needs pipeline** |
| Missing Uplink Port Config by Division (Top 10) | bar | **Needs pipeline** |
| Uplink Configuration Issue detail | table (deviceName, deviceIp, interfaceMode, interface, interfaceCts, neighborDeviceName, neighborInterfaceIpAddress, neighborInterfaceMode, neighborInterface, neighborInterfaceCts, exceptionType) | **Needs pipeline** (CDP-neighbor) |

**AP / Trunk (Flex) port config group:**
| Panel | Viz | Status |
|---|---|---|
| Trunk AP (Flex?) Port Config | single value | **Needs pipeline** |
| Missing Trunk AP (Flex?) Port Config | single value | **Needs pipeline** |
| Misconfigured AP Port Config | single value | **Needs pipeline** |
| Excluded AP Port (EX-CTS or EX-AUTH) | single value | **Needs pipeline** |
| Missing Trunk AP (Flex?) Port Config by Division (Top 10) | bar | **Needs pipeline** |
| AP Port Configuration Issue detail | table (deviceName, deviceIp, interfaceMode, interface, interfaceCts, neighborHostName, neighborInterfaceIpAddress, neighborPlatform, exceptionType) | **Needs pipeline** (CDP-neighbor) |

**NetFlow port config group:**
| Panel | Viz | Status |
|---|---|---|
| Netflow Port Config | single value | **Needs pipeline** |
| Missing Netflow Port Config | single value | **Needs pipeline** |
| Missing Netflow Port Config by Division (Top 10) | bar | **Needs pipeline** |
| Missing Netflow Port Config Details | table (deviceName, deviceHostName, deviceIp, division, productId, swVersion, swType, Missing_NetFlow, exceptionType) | **Needs pipeline** |

**MTU group** (neighbor-aware, CDP-based):
| Panel | Viz | Status |
|---|---|---|
| MTU Matching (by interface) | single value | **Needs pipeline** |
| Mismatch MTU (by interface) | single value | **Needs pipeline** |
| Mismatched MTU by Division | bar | **Needs pipeline** |
| Mismatch Details | table (deviceName, deviceIp, interfaceMode, interface, interfaceMTU, neighborDeviceName, neighborInterfaceIpAddress, neighborInterfaceMode, neighborInterface, neighborInterfaceMTU) | **Needs pipeline** (CDP-neighbor) |

**Coverage rollup of this catalog (revised after the 2026-07-21 buildability audit):** ~60 panels across 7 dashboards. **3 built** (Excessive MAC, Vendor/EX-AUTH MAC — ISE TA; OT/IoT Device Visibility — Cyber Vision). More buildable than the first pass concluded: the **software/hardware compatibility group (~5 panels)** is buildable from Catalyst Center inventory (2 near-built already); the **OT/IoT visibility + "missing from OT inventory" concept** is buildable from Cyber Vision; a **coarse device-config-compliance view** is buildable from `cisco:catalyst:center:compliance:report`. Still genuinely non-TA (need CMDB merge, allowlist, per-command config-scrape, or SGACL logging): the CMDB/silver-adoption/remediation panels, the per-command "Missing Global Command" granularity, the neighbor-aware CDP panels (uplink/AP/MTU mismatch), and the SGACL Tracker. **Refined finding: the field dashboards split into (a) a buildable-today core — inventory, compliance, OT/IoT, ISE-auth — and (b) a genuinely-non-TA tail — CMDB record-completeness, per-command config audit, and CDP-neighbor comparison. GSX Phase-1 should target (a); (b) needs pipelines or synthetic sourcetypes.**

## Audit corrections (2026-07-21)

An adversarial buildability audit (3 independent reviewers over the build) returned: **scrub/leak audit clean** (no customer identifiers in committed files), **stanza correctness clean** (both new ISE stanzas run without error, follow tag convention), and **3 buildability reclassifications** — all verified against live `/opt/10` data and applied above:
1. **"Endpoint Missing from ORDR"**: Needs-pipeline → **Buildable** via Cisco Cyber Vision (native OT/IoT visibility, 64K+ live events). Built the device-inventory side.
2. **Software/hardware compatibility group**: Needs-pipeline → **Buildable** from Catalyst Center inventory (an internal contradiction — the doc already noted 2 built stanzas cover it).
3. **Global-config running-config claim**: softened — Catalyst Center `compliance:report` is a real (coarse) config-compliance source, so a device-level compliance view is buildable today; only the exact per-command panel needs the config-scrape pipeline.


## Built (29 stanzas)

| Stanza ID | Pillar | What it does |
|---|---|---|
| `secure_networking_ise_policy_family_overview` | Zero Trust Access | RADIUS (network-access) vs. TACACS+ (device-admin) policy-set breakdown by ISE host. **SPL-validated** |
| `secure_networking_meraki_threat_blocks_by_category` | Hybrid Mesh Firewalling | Blocked threat events by file category/severity. **SPL-validated** |
| `secure_networking_catalyst_center_software_version_inventory` | Secure Infrastructure | Device family/software-version rollup (LDOS groundwork). **SPL-validated** |
| `secure_networking_ip_sgt_bindings_by_group` | Scalable Network Segmentation | IP-to-SGT binding view. Harvested from `cisco-catalyst-app`'s IP-SGT Bindings panel; dropped its broken `ta_cisco_catalyst_security_group_tag_mapping` lookup (doesn't exist) → filed [app_cisco_common#19](https://github3.cisco.com/enterprise-networkapp-splunk/app_cisco_common/issues/19). Updated 2026-07-21 for newly available `cisco:ise:sgtbindings` sample schema (`ipPrefix`, `tag`, `src`, `peerSequence`, `sxpDomain`). **SPL-validated 2026-07-21; no rows returned in current live window** |
| `secure_networking_ise_policy_hits_by_device` | Scalable Network Segmentation | ISE policy-set hit counts by network device. **SPL-validated** |
| `secure_networking_fw_enabled_device_type_by_site` | Hybrid Mesh Firewalling | Meraki device fleet classified MX-firewall/Secure-Router/Teleworker-FW/switch/AP, by site address. **SPL-validated** |
| `secure_networking_sgt_by_site` | Scalable Network Segmentation | SGT-tagged auth events by structured ISE Location hierarchy — better-verified alternative to the bindings-based view above. **SPL-validated** |
| `secure_networking_trustsec_hardware_readiness` | Scalable Network Segmentation | Device family/model rollup — groundwork for a TrustSec hardware-capability search once a reference lookup exists. **SPL-validated** |
| `secure_networking_software_license_compatibility` | Secure Infrastructure | Device software-version/license-tier rollup — groundwork for a real compliance search once a reference lookup exists. **SPL-validated** |
| `secure_networking_excessive_mac_per_port` | Scalable Network Segmentation | Wired ports ranked by distinct-MAC count (loop/hub/rogue-switch detection after NAC rollout). **SPL-validated**; flat until demo data seeds a many-MACs-on-one-port case |
| `secure_networking_vendor_mac_on_nac_port` | Scalable Network Segmentation | Virtual/infrastructure vendor-OUI MACs (VMware/HSRP/F5/ASA/etc.) on wired NAC ports — EX-AUTH exemption candidates. **SPL-validated**; empty until virtual-interface MACs are seeded |
| `secure_networking_ot_iot_device_visibility` | Scalable Network Segmentation | OT/IoT device inventory by type + avg risk score from Cisco Cyber Vision (`cisco:cybervision:devices`). **SPL-validated** — real results (146 "Device", risk 8–45 by type). Added after the buildability audit corrected a misclassification (see Audit corrections below) |
| `secure_networking_source_health_by_pillar` | All / Agentic Ops | Secure Networking source-health matrix by pillar/source/sourcetype, with event count, last seen, age, and status. **SPL-validated 2026-07-21** |
| `secure_networking_site_inventory_rollup` | All / Secure Infrastructure | Cross-controller site inventory from Catalyst Center, Meraki, and SD-WAN. **SPL-validated 2026-07-21** |
| `secure_networking_zta_auth_outcome_trend` | Zero Trust Access | ISE auth success/failure trend from the Authentication data model. **SPL-validated 2026-07-21** |
| `secure_networking_zta_failure_reasons_by_site` | Zero Trust Access | ISE failed-auth reason table by site and network device. **SPL-validated 2026-07-21** |
| `secure_networking_zta_radius_node_health_by_site` | Zero Trust Access | ISE/RADIUS control-plane health by ISE host, site, and network device. **SPL-validated 2026-07-21** |
| `secure_networking_segmentation_status_rollup` | Scalable Network Segmentation | Segmentation adoption rollup by site: auth events, endpoints, SGT-tagged events, distinct SGTs, and coverage %. **SPL-validated 2026-07-21** |
| `secure_networking_sgt_distribution_by_site_device` | Scalable Network Segmentation | SGT-tagged auth events by site, network device, and SGT. **SPL-validated 2026-07-21** |
| `secure_networking_hmf_enforcement_coverage_by_site` | Hybrid Mesh Firewalling | Firewall/enforcement evidence by site from Meraki inventory plus SD-WAN UTD activity. **SPL-validated 2026-07-21** |
| `secure_networking_hmf_unified_blocks_trend` | Hybrid Mesh Firewalling | Unified block/drop/deny trend across Meraki, SD-WAN UTD, Secure Access, and Secure Firewall/ASA-style feeds. **SPL-validated 2026-07-21** |
| `secure_networking_secure_infra_status_rollup` | Secure Infrastructure | Catalyst Center inventory, health, software, and compliance rollup by device family. **SPL-validated 2026-07-21** |
| `secure_networking_psirt_exposure_by_site_family` | Secure Infrastructure | Catalyst Center PSIRT advisory exposure by site and device family. **SPL-validated 2026-07-21** |
| `secure_networking_sdwan_site_view` | Secure Infrastructure | SD-WAN site-health table with device/tunnel/app scores and last-seen freshness. **SPL-validated 2026-07-21** |
| `secure_networking_zta_ravpn_sessions_by_profile` | Zero Trust Access | Secure Access RaVPN activity by VPN profile, region, enforcement host, and SGT, with failures/warnings/user/IP counts. Built from `cisco:cloud_security:ravpn` demo-data schema. **SPL-validated 2026-07-21; no rows returned in current live window** |
| `secure_networking_zta_ravpn_failure_reasons` | Zero Trust Access | RaVPN failure/warning reasons by profile, region, enforcement host, and ASA syslog ID. Built from `event_type`, `asa_syslog_id`, `failed_reasons`, and optional disconnect fields. **SPL-validated 2026-07-21; no rows returned in current live window** |
| `secure_networking_secure_access_dlp_findings` | Hybrid Mesh Firewalling / Zero Trust Access | Secure Access DLP findings by severity, action, rule, classification, data identifier, application, and direction. Built from `cisco:cloud_security:dlp` demo-data schema. **SPL-validated 2026-07-21; no rows returned in current live window** |
| `secure_networking_intersight_advisory_exposure` | Secure Infrastructure | Intersight PSIRT/EOL/field-notice exposure by account, affected object type, advisory type, severity, CVSS, and CVEs. Built from `cisco:intersight:advisories` JSON samples. **SPL-validated 2026-07-21; no rows returned in current live window** |
| `secure_networking_sgt_binding_inventory` | Scalable Network Segmentation | ISE IP-SGT binding inventory by SGT, binding type, SXP domain, source node, peer path, and bound prefixes. Built from `cisco:ise:sgtbindings` JSON samples. **SPL-validated 2026-07-21; no rows returned in current live window** |

## Overview profile integration (`secure_networking` profile)

The shared Overview engine (`common/config/overviewProfiles.ts`) has the `secure_networking` profile fully registered — view `secure_networking_overview`, 5 pillar sections, `autoDiscovery` keyed on the `secure_networking_` prefix + `Secure Networking` tag + sub_category→section mapping. Explicit `viz_options.overview` entries (with `profile: "secure_networking"`) give real tile control (valueField, thresholds, color) beyond what auto-discovery infers. Full detail in `SN_EVENT_SCOPING.md` §"Overview dashboard engine".

**`overview_factory_tiles.conf` — 5 SN sections wired (tileIds in display order):**
| Section stanza | tileIds | visible_count |
|---|---|---|
| `[secure_networking.zta]` | zta_failed_auth_baseline, zta_ise_radius_latency, zta_ise_policy_family, zta_ise_feed_health | 4 |
| `[secure_networking.secure_infrastructure]` | secinfra_psirt_critical, secinfra_software_version_inventory | 2 |
| `[secure_networking.scalable_network_segmentation]` | segmentation_sgt_by_site, segmentation_ip_sgt_bindings, segmentation_policy_hits_by_device | 3 |
| `[secure_networking.hybrid_mesh_firewalling]` | hmf_fw_blocked_count, hmf_fw_blocked_baseline, hmf_threat_blocks, hmf_fw_enabled_device_type, hmf_ftd_feed_health | 5 |
| `[secure_networking.agentic_ops]` | agentic_ops_ai_defense_blocks, agentic_ops_feed_health_matrix, agentic_ops_thousandeyes_feed_health | 3 |

**21 stanzas** carry an explicit SN-scoped `viz_options.overview` entry after the 2026-07-21 P0/P1 batch: 11 `secure_networking_` stanzas + 10 existing executive-profile searches reused via multiple array entries (no duplication — same search, two profile entries). **Note:** several table stanzas (`excessive_mac_per_port`, `vendor_mac_on_nac_port`, `ot_iot_device_visibility`, site inventory, failure reasons, SD-WAN site view) are intentionally operator drill-down tables, discoverable/draggable via the Searchbase app's `Secure Networking` tag but not auto-promoted to KPI tiles. Promote later if wanted.

## Recently unblocked by demo data (built 2026-07-21)

| Concept | Status |
|---|---|
| SGT bindings | Built `secure_networking_sgt_binding_inventory` and refreshed `secure_networking_ip_sgt_bindings_by_group` against the real `cisco:ise:sgtbindings` JSON sample (`ipPrefix`, `tag`, `src`, `peerSequence`, `sxpDomain`, `type`). |
| RaVPN client/session/failure visibility | Built `secure_networking_zta_ravpn_sessions_by_profile` and `secure_networking_zta_ravpn_failure_reasons` from the real `cisco:cloud_security:ravpn` CSV schema. |
| Secure Access DLP | Built `secure_networking_secure_access_dlp_findings` from the real `cisco:cloud_security:dlp` CSV schema. |
| PSIRT/advisories via Intersight | Built `secure_networking_intersight_advisory_exposure` from the real `cisco:intersight:advisories` JSON shape. |

## Pending — still need data

| Concept | Blocked on |
|---|---|
| SGACL / traffic-block tracking with source-SGT → destination-SGT pairs | `cisco:sdwan:sgacl:logs` — no sample data at all yet |
| DC fabric ACL permit/drop by VRF/Tenant | `cisco:dc:aci:class` — no sample with `component=acllogPermitL3Pkt`/`acllogDropL3Pkt` yet; only config/inventory components have been seen |
| Excessive-unique-MAC-per-port (loop/hub detection) | `cisco:ise:syslog` sample now has real wired interface names (`FiveGigabitEthernet1/0/3`, `1/0/4`) but only 6 events per port / 8 distinct MACs total — need one port with 20+ distinct MACs to make the pattern visible, not evenly-spread routine traffic |
| Virtual-interface OUI detection (VMware/Checkpoint/HSRP MACs on wired NAC ports) | Same wired-volume gap as above, plus needs a few endpoint MACs matching those vendor OUI prefixes |
| Endpoint record completeness (identity ↔ asset inventory merge) | Confirmed real data on both sides but **zero MAC overlap** between `cisco:ise:syslog` (`EndPointMACAddress`) and the `asset_inventory` lookup (94 of 237 rows have a `mac_address`) — need at least some correlated values across both |
| SGT mismatch (authoritative-source-assigned SGT vs. ISE-assigned SGT) | Distinct from plain completeness above — needs an authoritative SGT-assignment reference to compare against ISE's actual assignment, flagging divergence. Not yet scoped against real data. |
| Correlation against a secondary device-visibility platform (e.g. an IoT/OT-focused system) | A third data source beyond ISE + CMDB — endpoints present in one but missing from the other. Not yet scoped. |
| Correlation against a secondary MAC inventory/allowlist | A fourth reference list, separate from CMDB and the IoT/OT platform. Not yet scoped. |
| Default-tag fallback rate + override tracking | How many endpoints fall through to a default/catch-all SGT (and how restrictive that default is) vs. how many have an explicit override — a policy-posture metric distinct from raw completeness |
| Top-N SGT distribution by volume | Simple bar of most heavily-assigned SGTs — straightforward once SGT data exists, just not enumerated as its own search yet |
| Device-type and CI-class completeness breakdowns | Two dimensional cuts of the completeness concept (by device type, by CMDB class) — worth their own searches rather than folding into one bundled "completeness" view |

## Pending — needs new collection capability, not just more data

These aren't a "please export more sample data" ask — no TA collects this today, for anyone, regardless of environment:

- Running-config compliance auditing at **per-command granularity** (is `ctsRoleBasedEnforcement` / `globalTrustSec` / the RADIUS-TACACS list-group AAA commands present on each device?) — needs config-scrape/API access to device running-config, which no current TA exposes at that grain. **Note (corrected 2026-07-21):** a *coarser* device-config-compliance view (Startup-vs-Running, Network Settings, EoX, Software Image, Advisories, overall status) IS available today from `cisco:catalyst:center:compliance:report` — so this bullet is specifically about the per-command detail, not config-compliance in general.
- Neighbor-aware config comparison (does *both* sides of a link have the same trust-tag config, do both sides agree on MTU) — needs CDP-neighbor data cross-referenced with per-device config, same territory as above. Worth a device-role-specific variant too: access points specifically (trunk/flex-port config), not just generic switch uplinks — same underlying check, different device population.
- Missing NetFlow port config — same running-config-parsing dependency.
- **Open question, still unanswered**: since this is a demo app rather than a production data pipeline, should the demo-data-gen tool fabricate a plausible synthetic sourcetype for these so the demo has something to show before real collection capability exists? Flagged to Amir, no decision yet.

These match the "Needs new TA" bucket already documented for the `show cts`/MACSec/IPSec items in `SN_SEARCH_BUILD_LIST.md` — same class of work, would need to be scoped as its own TA-engineering effort.

## Not yet attempted

- First-seen/last-seen device tracking via an accumulating KVstore search (rolling window off `cisco:ise:syslog` auth timestamps + `EndPointMACAddress`). No data blocker — just haven't built/tested it yet.
