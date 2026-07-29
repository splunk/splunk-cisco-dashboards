# Search Build List — All 4 Tabs, Cross-Checked Against SCAN

Supersedes the narrower scope of `SN_GAP_ANALYSIS.md` (which only covered the `Secure Networking Pillars` tab). This list decomposes **all four tabs** — `Secure Networking Pillars`, `Pillar Deep Dive`, `Pillar Mapping-ish`, `Chris Updates` — into distinct candidate searches, deduplicated across tabs (the same ask usually appears at 2-3 levels of granularity across them). Cross-checked against `searchbase.conf` (814 stanzas) for what's already built, and against SCAN's `products.conf` (`SN_SOURCETYPE_REFERENCE.md`) for authoritative sourcetypes/TA/support_level.

**Status legend:**
- **Available** — already a stanza in `searchbase.conf` today. Cited by id.
- **Needs work** — data confirmed available (sourcetype/datamodel exists, TA is `cisco_supported` or close to it), but no search built yet. This is the real "to-do list."
- **Needs new TA** — no existing modular input/collection mechanism produces this data at all (usually device-CLI-only today, e.g. `show cts ...`, `show platform security tpm`). Building the search first requires building or extending a TA.
- **Blocked** — confirmed no path to Splunk today (per SCAN `coverage_gap=true`/roadmap/archived, or per reviewer comment). Skip per Chris's MVP rule.
- **Needs follow-up** — ambiguous, speculative in the source doc itself, or a design question with no clear owner yet.

## GSX Priority (Phase 1) vs. Post-GSX (Phase 2)

**Rule, confirmed 2026-07-20: Phase 1 is needed for GSX, Phase 2 is post-GSX.** Phase tags below come directly from the xlsx — `Secure Networking Pillars`' "Foundational" (≈Phase 1) / "Comprehensive" (≈Phase 2) column, and `Pillar Deep Dive`'s explicit "Phase 1"/"Phase 2"/"Ph1\*" tags — not guessed. Where a specific row wasn't explicitly tagged, phase was inferred from its immediate neighbors in the same block (marked "lean" below) rather than assumed; genuinely ambiguous ones are called out separately.

**The actual GSX punch list — Phase 1 AND still needs building** (excludes items already Available, and items Blocked regardless of phase):

**3, 4, 5, 6, 7** (ZTA — RADIUS/RADSEC, TrustSec/CTS×2, SGACL enforcement, SGT-VLAN mapping) · **9, 10** (RaVPN) · **11, 12** (ZTNA, "if SSE can natively provide it") · **14** (WiFi SSID Auth Method — basic only, not the traffic/geofencing overlay, which is Phase 2) · **32, 33** (LDOS, SD-WAN Site View) · **36, 37, 38, 39, 41, 42, 43, 44, 46, 47** (Segmentation — Status/VRF-VLAN-VXLAN breakdown/SGT-by-site/SGT-sankey/SGACL-traffic/SGT-Policy-View/Enforcement-Points/SGT-Matrix/Traffic-Block/Policy-Hits — i.e. most of Segmentation's core SGT visualizations) · **51** (Fabric Stats) · **52, 53** (ISE/Access-Manager SGT groups, tagged "Ph1\*" — asterisk = conditional) · **54** (Router/Switch VRF-VLAN-VXLAN config) · **58, 59** (SSE SGT Policy Groups, SNA native analytics, "Ph1\*") · **67** (FW-enabled MX vs. FW vs. Secure Router) · **84** (SN baselines/RaVPN).

That's **30 items** — the real "build this before GSX" list, out of the 54 total buildable items. Items **4 and 5 carry extra risk**: they're tagged Phase 1 in the xlsx but classified "Needs new TA" above — CLI-based collection that doesn't exist in any TA today. Flag these for an early go/no-go call rather than assuming they'll land in time.

**Update 2026-07-21:** several of those Phase-1 rows now have at least partial Secure Networking stanzas: 7, 9, 10, 33, 38, 52, 67, and 84. Use the per-row status table below as the current source of truth rather than treating the original punch-list sentence as all unstarted work.

**Already Available + Phase 1** (no new work, but worth confirming they're tagged/discoverable for the demo): 1, 2, 16, 17, 19, 30, 78, 79, 80.

**Blocked regardless of phase** (Phase 1 desired but data doesn't exist — don't burn GSX time on these): 8 (PxGrid), 18 (API/comms sync, partially), 65, 66 (SCC).

**Phase 2 — defer post-GSX**: 13, 20-29 (the Cisco-IQ hardening/crypto checklist — moot, all Blocked anyway), 31, 34, 35, 40, 45, 48, 49, 50, 55, 56, 57, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 81, 82, 85, 86, 87, 89, 90, 91, 92, 93-98. This also resolves an earlier open question: the yellow-highlighted "DC/Cloud Hybrid Mesh Firewalling" rows in the xlsx (69-73) are yellow specifically because they're the Comprehensive/Phase-2-tagged items in that pillar — not an unexplained flag.

**One tension worth a direct check, not a guess**: item 88 (SD-WAN NWPI) is tagged "Comprehensive"/Phase 2 in the xlsx, but the TA-remediation PDF lists NWPI as an active, current capability of `ta_cisco_thousandeyes`. Worth 5 minutes confirming which is right before deciding whether it's in or out of the GSX list.

---

**Pillars, confirmed against the pptx** (Zero Trust Access / Secure Infrastructure / Scalable Network Segmentation / Hybrid Mesh Firewalling / Agentic Ops) — reminder: this is a **different taxonomy** from SCAN's `gtm_pillar` field (Cisco's official Secure Campus & Branch / Secure WAN Edge / DC & Cloud / End-to-End Visibility & Assurance / Industrial-OT). This doc uses the pptx/Chris taxonomy throughout, matching the rest of this project's docs.

---

## Zero Trust Access

| # | Search / use case | Data model or object | Sourcetypes | TA (addon, Splunkbase UID, support_level) | Status | Notes |
|---|---|---|---|---|---|---|
| 1 | Common policy control plane health (RADIUS latency, ISE node inventory, AAA issues) | raw sourcetype | `cisco:ise:syslog` | `TA_cisco_catalyst` (7538, cisco_supported) | **Available** | `security_resilience_ise_node_inventory`, `security_resilience_ise_radius_latency`, `it_critical_systems_aaa_server_issues`, `feed_monitor_ise_syslog_staleness` |
| 2 | Auth failures/successes, trend + baseline, lockouts | raw sourcetype | `cisco:ise:syslog` | same | **Available** | `executive_dashboard_failed_logon_with_baseline`, `security_resilience_ds_ise_fail_count`, `_ds_ise_failure_reasons`, `_locked_accounts` |
| 3 | RADIUS vs. RADSEC distinction per device/identity | `Cisco_Catalyst_ISE_TACACS_Policy_Hit`, `Cisco_Catalyst_ISE_Authentication_Policy_Hit` (app_cisco_common) | `cisco:ise:radius:policyset`, `cisco:ise:radius:authz:policy`, `cisco:ise:tacacs:policyset`, `cisco:ise:tacacs:authz:policy` | `TA_cisco_catalyst`/`cisco-catalyst-app` (7538/7539, cisco_supported) | **Built 2026-07-20 (partial)** | `secure_networking_ise_policy_family_overview` — validated against live `/opt/10` data. Ships RADIUS-network-access vs. TACACS+-device-admin policy-set breakdown; does NOT answer the literal RADIUS-vs-RADSEC wire-protocol question (no field for that found in this sourcetype) — see stanza's `explanation` for the honest caveat |
| 4 | TrustSec/CTS device capability & config status | none — CLI-only | none today | none | **Needs new TA** | Steven Moore: "We have apps for Cat, Meraki, Nexus — pretty sure none of them provide this info." Feeds `show cts`, `show cts capability interface`, `show running-config cts` |
| 5 | TrustSec RADIUS-vs-RADSEC auth stats + SXP peer status | none — CLI-only | none today | none | **Needs new TA** | Feeds `show cts authorization entries`, `show cts credentials`, `show cts environment-data`, `show cts sxp` |
| 6 | SGACL / role-based enforcement status | `Cisco_Catalyst_SGACL_Events` (app_cisco_common) | `cisco:ise:securitygroups`, `cisco:sdwan:sgacl:logs` | `TA_cisco_catalyst` (7538, cisco_supported) | **Needs work** | Datamodel exists; feeds `show cts role-based access-list/enable/policy` conceptually, but via existing SGACL event data, not new CLI collection |
| 7 | SGT-to-VLAN/interface mapping | `Cisco_Catalyst_IP_SGT_Bindings` (app_cisco_common) | `cisco:ise:sgtbindings` | `TA_cisco_catalyst`/`cisco-catalyst-app` (7538/7539, cisco_supported) | **Built 2026-07-21 (partial)** | `secure_networking_sgt_binding_inventory` and refreshed `secure_networking_ip_sgt_bindings_by_group` cover IP-to-SGT binding inventory. VLAN/interface mapping still needs an enrichment source beyond the raw bindings sample. |
| 8 | Am I syncing with ISE/AccMan/EntraID/PxGrid? | none | none | — | **Blocked** | SCAN: `cisco_pxgrid` archived/not_supported. "Access Manager" isn't a cataloged SCAN product at all — treat as unclear/unsupported too |
| 9 | RaVPN — clients, sessions, connect rate, connect failures | raw sourcetype | `cisco:secure_access:security_events_ravpn`, `cisco:cloud_security:ravpn` | `TA-cisco-cloud-security-addon`/`cisco-cloud-security` (7569/5558, cisco_supported) | **Built 2026-07-21; expanded 2026-07-29** | `secure_networking_zta_ravpn_sessions_by_profile`, `secure_networking_zta_ravpn_failure_reasons`, and `secure_networking_zta_ravpn_connection_rate` cover profile activity, clients, sessions, 15-minute connect rate, failures, and failure percentage across both RaVPN sourcetypes. |
| 10 | RaVPN — posture checks/fails, alerts/logs | raw sourcetype | same TA, `security_events_*` family | same | **Built 2026-07-29 (schema-tolerant)** | `secure_networking_zta_ravpn_posture_alerts` normalizes structured posture, severity, reason, user, device, profile, and region fields across both RaVPN sourcetypes. Detailed posture output still depends on enabling `security_events_ravpn` and the fields exposed by the installed add-on version. |
| 11 | ZTNA — app-access visibility (what apps, where, when, whom) | none yet | `cisco:cloud_security:ztna`, `ztnaenrollment`, `ztnaflow`, `cisco:secure_access:security_events_ztna` | same (7569/5558) | **Built 2026-07-23** | `secure_networking_zta_ztna_app_access_summary` covers application/user adoption from `ztnaflow`; `secure_networking_zta_ztna_device_category_outcomes` and `secure_networking_zta_ztna_blocked_access_reasons` add policy-decision, device-category, posture, and denial-reason visibility from `ztna`. |
| 12 | ZTNA — Duo/Secure Endpoint incident events, malware, blocked posture/identity events | none yet | `cisco:duo:*`, `cisco:se` | `CiscoSecurityCloud` (7404, cisco_supported) | **Built 2026-07-29 (field validation pending for `cisco:se`)** | `secure_networking_infra_secure_endpoint_incidents`, `secure_networking_infra_duo_blocked_posture_identity`, and `secure_networking_infra_duo_application_access` cover malware/incidents, denied identity and endpoint-posture controls, and application access by identity/location/time. The repository has no live `cisco:se` field sample, so that stanza uses schema-tolerant normalization and must be confirmed against the deployed Cisco Security Cloud version. |
| 13 | Guest WiFi — geofencing + client-count composite (abuse detection) | none yet | Spaces firehose + `meraki:securityappliances`/client sourcetypes | `ta_cisco_spaces` + `Splunk_TA_cisco_meraki` (5580, cisco_supported) | **Needs work** | Spaces alone has no SSID/auth fields — needs both sources combined, matches xlsx's own "Spaces will need some work" |
| 14 | WiFi — SSID Auth Method (WPA3/WPA2/Open) by site | none yet | none confirmed | `Splunk_TA_cisco_meraki` (5580, cisco_supported) | **Corrected 2026-07-20 — Needs new TA input** | Checked all 35 Meraki sourcetypes present in live `/opt/10` data — none carry SSID/auth-mode config (WPA2/WPA3/Open). `VISUALIZATION_MAPPING.md` claims "Stated Visualization Support: Yes" for this requirement but its 22 matched panels are all keyword noise, not real matches — the claim doesn't hold up. Would need a new input against Meraki's Wireless SSIDs API, which this TA doesn't currently collect |
| 15 | ZTNA/Secure Client — what stats are even useful here | — | — | `cisco_secure_client` is `roadmap`/`not_supported` in SCAN, no sourcetypes at all | **Needs follow-up** | The xlsx's own author: "I am admittedly unsure... suggest connecting with the Security folks (J Fanelli, M Brabec)" |

## Secure Infrastructure

| # | Search / use case | Data model or object | Sourcetypes | TA | Status | Notes |
|---|---|---|---|---|---|---|
| 16 | Device/site inventory hierarchy (Org-Network-Device, Region-Group-Site, Area-Building-Floor, DC-Pod-Row-Rack) | Catalyst/Meraki/SD-WAN/Nexus inventory objects | `cisco:dnac:*`, `meraki:organizations*`, `cisco:dc:*` | `TA_cisco_catalyst` (7538) + `cisco_dc_networking_app_for_splunk` (7777), both cisco_supported | **Available** | Foundational — already extensively queried |
| 17 | Device/system online status — generic health indicator woven across all pillars | — | many, per-system | many | **Available** | `feed_monitor_all_feeds_health_matrix` already does this pattern broadly |
| 18 | API/comms integration status (e.g. is ISE-PxGrid comms alive) | — | — | — | **Blocked** (partially) | PxGrid confirmed archived; other integration-status checks (EntraID sync etc.) not confirmed available either |
| 19 | Devices/Health, Alerts by Site (Meraki) | — | `meraki:devices*`, `meraki:assurancealerts` | `Splunk_TA_cisco_meraki` (5580, cisco_supported) | **Available** | |
| 20 | TPM presence, all device types | — | none | none | **Blocked** | Cisco IQ-sourced (`show platform security tpm`), not in Splunk |
| 21 | SUDI cert attestation, all device types | — | none | none | **Blocked** | Cisco IQ-sourced |
| 22 | Secure Boot status, all device types | — | none | none | **Blocked** | Cisco IQ-sourced |
| 23 | Project Broccoli / hardened-code assessment | — | none | none | **Blocked** | Confirmed real gap by reviewer (Steven Moore); 0 hits anywhere |
| 24 | Mythos patch status | — | none | none | **Blocked** | Cisco IQ-sourced |
| 25 | PQC readiness (crypto-agile capability) | — | none | none | **Blocked** | Cisco IQ-sourced |
| 26 | PQC enabled (feature turned on) | — | none | none | **Blocked** | Cisco IQ-sourced |
| 27 | MACSec readiness/enabled, all device types | — | none | none | **Needs new TA** | `show macsec summary` is device-CLI, not Cisco-IQ-only — a real (if unbuilt) collection path exists, unlike TPM/SUDI/Broccoli above |
| 28 | IPSec status | — | none | none | **Needs new TA** | `show crypto session` — CLI-only today |
| 29 | TLS status, cipher suite, PQC-vs-classic negotiation detail | — | none | none | **Needs new TA** | Stephen Orr's explicit ask — wants AES-256-GCM/AES-256-GCM-XPN-level detail |
| 30 | CVE/PSIRT — DNAC-scoped advisories | — | `cisco:dnac:securityadvisory` | `TA_cisco_catalyst` (7538, cisco_supported) | **Available** | `security_resilience_psirt_advisories`, `_psirt_critical_advisories`, `_advisory_exposure_by_family` |
| 31 | CVE/PSIRT — comprehensive, all-Cisco vulnerability feed | — | `cisco:vuln:advisories*` | `ti-cisco-vuln` (5183, **deprecated/not_supported**) | **Needs work (rebuild first)** | Separate, broader feed from #30; the TA itself needs rebuilding before a search can be reliably built on it |
| 32 | Devices approaching/past LDOS (end of support) | Catalyst Center inventory | `cisco:catalyst:center:inventory:report`, `cisco:dnac:compliance` | `TA_cisco_catalyst` (7538, cisco_supported) | **Built 2026-07-20 (groundwork only)** | `secure_networking_catalyst_center_software_version_inventory` — device family/software-version rollup, validated against live data. Still needs a Cisco EoL reference lookup (doesn't exist yet) joined in before this is a true LDOS status search — see stanza's `explanation` |
| 33 | SD-WAN Site View composite (SSE?/type/FW/MX/Cat/Apps) | — | `cisco:sdwan:*` | `TA_cisco_catalyst` (7538, cisco_supported) | **Built 2026-07-21 (partial)** | `secure_networking_sdwan_site_view` covers SD-WAN site health/device/tunnel/app scores. SSE/MX/Cat composite enrichment is still future work. |
| 34 | Bulk/Agg traffic stats — DIA vs. SD-WAN vs. SSE | — | `cisco:sdwan:*` + `cisco:cloud_security:*` | same + `TA-cisco-cloud-security-addon` (7569) | **Needs work** | |
| 35 | Extend all crypto/hardening checks above to UCS/iPhones/RoomOS/WLC/MCG/IIoT | — | — | — | **Needs follow-up** | Stephen Orr's scope-widening ask — a scope decision before it's a search |

## Scalable Network Segmentation

The pillar with the most work, once decomposed at `Pillar Deep Dive`'s granularity.

| # | Search / use case | Data model or object | Sourcetypes | TA | Status | Notes |
|---|---|---|---|---|---|---|
| 36 | Segmentation Status (leader rollup) | SGT datamodel objects | — | `cisco-catalyst-app`/`TA_cisco_catalyst` (7539/7538) | **Needs work** | |
| 37 | VRF/VLAN/VXLAN/SGT — site breakdown, adoption journey | same | `security_group_tag`, structured `Location` field | same | **Built 2026-07-21 (validated)** | `secure_networking_sgt_by_site` — much better data source than the SGT-bindings sourcetype: `cisco:ise:syslog` with `security_group_tag=*` carries a real structured Location hierarchy (e.g. `AMER#ATL`) and has live events today. Confirmed 4 distinct SGTs across 4 sites on `/opt/10`. Same underlying object also backs `app_cisco_common`'s "Security Group Tag by Authentication" panel |
| 38 | **SGT by Site, by Device** | `Cisco_Catalyst_IP_SGT_Bindings` | `cisco:ise:sgtbindings` | same, cisco_supported | **Built 2026-07-21 (SPL-valid)** | `secure_networking_ip_sgt_bindings_by_group` — harvested from `cisco-catalyst-app`'s IP-SGT Bindings panel (dropped its broken `ta_cisco_catalyst_security_group_tag_mapping` lookup, which doesn't exist — filed as [app_cisco_common#19](https://github3.cisco.com/enterprise-networkapp-splunk/app_cisco_common/issues/19)). Refreshed for the newly available `cisco:ise:sgtbindings` sample schema; live export validation passes but current live search window returns no rows. |
| 39 | SGT sankey permit/deny — policy view | `ISE_Syslog_Security_Group_Tag`, SGACL data | `cisco:ise:securitygroups` | same | **Needs work** | |
| 40 | SGT sankey by business service | same + new lookup | — | same | **Needs work** | Needs a new SGT→business-service mapping lookup that doesn't exist anywhere yet |
| 41 | SGT traffic stats, alerts, threshold crossing (SGACL counters) | `Cisco_Catalyst_SGACL_Events` | `cisco:sdwan:sgacl:logs` | `TA_cisco_catalyst` (7538, cisco_supported) | **Needs work** | Steven Moore confirmed SGACL counters pullable directly from the box; now confirmed via SD-WAN sourcetype too |
| 42 | SGT Policy View | same SGT objects | — | same | **Needs work** | |
| 43 | Enforcement Points (SGT locale, distributed enforcement) | SGACL/SGT data | — | same | **Needs work** | |
| 44 | SGT Matrix | same data as #39, different viz | — | same | **Needs work** | |
| 45 | SGT Utilization/Capacity vs. device threshold | SGT bindings count | — | same | **Needs work** | Capacity-threshold reference data not confirmed to exist — flag if thinner than expected once building starts |
| 46 | Traffic Block/Trend Analysis | — | `cisco:sdwan:sgacl:logs`, `acl:logs`, `block:host`/`unblock:host`, `drop:pkt`/`pass:pkt` | `TA_cisco_catalyst` (7538, cisco_supported) | **Needs work** | |
| 47 | Policy Hits by Site (campus/branch/WAN/DC/fabric) | SGACL + site inventory | — | same | **Built 2026-07-20 (proxy)** | `secure_networking_ise_policy_hits_by_device` — validated against live `/opt/10` data. Uses `NetworkDeviceName` (which encodes site in this environment's naming, e.g. `site-hyd04-a-wlc01`) as the site proxy, not a structured Catalyst Center `Location` join yet — see stanza's `explanation` for the honest framing |
| 48 | Site Readiness — composite exposure/adoption/risk score | — | — | — | **Needs follow-up** | Steven Moore's own open question — no known collection mechanism for a composite "site score" |
| 49 | DC segmentation view: Fabrics, L2/L3 VNI, GPO/EPG/ESG, SGT-to-GPO mapping | `network_dc_nd_*` (fabric health) + new SGT-to-fabric mapping | `cisco:dc:nd:anomalies`, `congestion`, `flows` | `cisco_dc_networking_app_for_splunk` (7777, cisco_supported) | **Needs work** | Fabric *health* already covered; VNI/GPO/SGT mapping specifically is new |
| 50 | # of segments, L2/L3 VNI location by DC, traffic | same | `cisco:dc:nd:congestion`, `endpoints`, `flows` | same | **Needs work** | |
| 51 | Fabric Stats: Fabrics/Segments/Groups/Policies (campus macro view) | same fabric health stanzas | — | same | **Needs work** | |
| 52 | ISE — what SGT groups exist, by site | `Cisco_Catalyst_IP_SGT_Bindings`, `ISE_Syslog_Security_Group_Tag` | `cisco:ise:securitygroups`, `cisco:ise:sgtbindings` | `TA_cisco_catalyst` (7538, cisco_supported) | **Built 2026-07-21 (partial)** | `secure_networking_sgt_binding_inventory` covers binding inventory by raw SGT/tag and SXP path; a friendly-name security-group catalog still needs `cisco:ise:securitygroups` data or a lookup. |
| 53 | Access Manager — SGT Groups | — | — | — | **Needs follow-up** | "Access Manager" is not a cataloged SCAN product at all — unclear if there's any real TA path here |
| 54 | Router/Catalyst Switch — VRF/VLAN/VXLAN/VPN/SGT/fabric-enabled config | — | device config fields via `TA_cisco_catalyst` | same (7538, cisco_supported) | **Built 2026-07-29 (observed evidence only)** | `secure_networking_router_segmentation_feature_evidence` and `secure_networking_router_segmentation_feature_trend` classify `cisco:ios` telemetry for VRF, VLAN/802.1Q, VXLAN/VNI, VPN, and SGT/TrustSec. This is event-driven evidence, not authoritative running-config inventory; complete adoption counts still require periodic CLI/config collection. |
| 55 | Nexus — VRF/VLAN/VXLAN/SGT/fabric-enabled (`show contracts vrf`/`show vlan`/`show nve vrf`/`show contracts sgt`/EVPN-enabled) | — | uncertain whether Nexus Dashboard API exposes these | `cisco_dc_networking_app_for_splunk` (7777) | **Needs new TA (uncertain)** | Doc itself flags uncertainty: "We can see if Nexus Dashboard api has the options" — needs a research spike before scoping as buildable |
| 56 | Secure Workload — service contracts, policies | — | `cisco:secure:workload` | `CiscoSecurityCloud` (7404, cisco_supported) | **Needs work** | Sourcetype exists; service-contract/policy-specific fields not confirmed yet |
| 57 | SD-WAN VPNs + SGT-to-VPN mapping | — | `cisco:sdwan:*` | `TA_cisco_catalyst` (7538, cisco_supported) | **Needs work** | |
| 58 | SSE — SGT Policy Groups | — | `cisco:cloud_security:*` | `TA-cisco-cloud-security-addon` (7569, cisco_supported) | **Needs work** | SGT-to-SSE-policy-group mapping specifically not confirmed |
| 59 | SNA/Stealthwatch — leverage native TrustSec Matrix flow/SGT analytics | — | `cisco:sna`, `sna:notable`, `sna:risk` | `CiscoSecurityCloud` (7404, cisco_supported) | **Needs work** | Doc's own recommendation: lean on SNA's own analytics rather than solving raw netflow-to-SGT correlation directly in Splunk — lower-effort path than it looks |

## Hybrid Mesh Firewalling

| # | Search / use case | Data model or object | Sourcetypes | TA | Status | Notes |
|---|---|---|---|---|---|---|
| 60 | FW stats/status | `Network_Traffic` CIM | ASA/FTD | `CiscoSecurityCloud` (7404, cisco_supported) | **Available** | `executive_dashboard_firewall_blocked_count`, `_with_baseline(_drilldown)` |
| 61 | FW Device Status, alerts, by Site | — | `cisco:asa`, `cisco:ftd:syslog` | same | **Available** | `feed_monitor_ftd_firewall_staleness` + ASA/FTD detail stanzas |
| 62 | FW blocks, threats — trend/events/stats | — | same | same | **Available** | Enriched 2026-07-20 with `secure_networking_meraki_threat_blocks_by_category` — Meraki-side blocked-threat breakdown by file category/severity, validated against live data (harvested from `Splunk_TA_cisco_meraki`'s own `security_appliances.xml` dashboard) |
| 63 | Secure Access — Alerts, Blocks, Policies (general) | — | `cisco:cloud_security:firewall`/proxy/dns/dlp | `TA-cisco-cloud-security-addon` (7569, cisco_supported) | **Available (partial)** | `security_resilience_cloud_fw_blocked`, `_top_blocked_destinations`, and `secure_networking_secure_access_dlp_findings` cover general blocks plus DLP findings. Policy-level detail still needs deeper Secure Access fields. |
| 64 | App Security Data — unified Secure App/eBPF/Isovalent view, joined to DC/Fabric policy | — | `cisco:isovalent:*` | `CiscoSecurityCloud` (7404, cisco_supported) | **Available (partial)** | 12 existing Isovalent/Multicloud-Defense-tagged stanzas; the DC/Fabric join specifically isn't built |
| 65 | Devices attached to Security Cloud Control | — | none | none | **Blocked** | SCAN: `cisco_security_cloud_control` roadmap/not_supported — third independent confirmation |
| 66 | % devices connected to SCC vs. not | — | none | none | **Blocked** | Same |
| 67 | FW enabled — MX vs. FW vs. Secure Router, by site | — | `meraki:securityappliances` + `TA_cisco_catalyst` Secure Router data | `Splunk_TA_cisco_meraki` (5580) + `TA_cisco_catalyst` (7538), both cisco_supported | **Built 2026-07-21 (partial)** | `secure_networking_hmf_enforcement_coverage_by_site` provides site-level enforcement evidence from Meraki inventory and SD-WAN UTD. It still needs richer Secure Router/Catalyst enrichment for the literal MX vs. FW vs. Secure Router breakdown. |
| 68 | Secure Access Policy Block — DC→Cloud→App view | — | `cisco:cloud_security:privateapps`, `security_events_web` | `TA-cisco-cloud-security-addon` (7569, cisco_supported) | **Needs work** | |
| 69 | View of policy hits: N/S, E/W (inside the DC) | — | `cisco:sfw:estreamer`, `cisco:sfw:policy` | `CiscoSecurityCloud` (7404, cisco_supported) | **Needs work** | |
| 70 | DC FW — Front Door | — | same | same | **Needs work** | |
| 71 | Hybrid Mesh FW Logs (unified across platforms) | — | same | same | **Needs work** | |
| 72 | ToR FW (DPU) | — | uncertain — DPU-specific field not confirmed | `CiscoSecurityCloud` (7404) or Multicloud Defense | **Needs work (uncertain)** | Check field availability once building starts |
| 73 | Cloud Alerts (AWS/Azure/GCP native) | — | `cisco:multicloud:defense:*` (proxy, not native CSP) | `CiscoSecurityCloud` (7404, cisco_supported) | **Needs work** | Multicloud Defense gives cross-cloud security coverage; native per-CSP alert ingestion unconfirmed — doc's own suggestion is direct CSP API |
| 74 | DC FW N/S policy — inside the DC (Hypershield) | — | none | none | **Blocked** | SCAN confirms `cisco_hypershield` roadmap/not_supported — doc itself calls this a roadmap item |
| 75 | Mesh Policy Engine / Adaptive Policy status | — | none confirmed | none confirmed | **Needs follow-up** | Not a cataloged SCAN product; unclear what, if anything, exposes this today |
| 76 | SmartSwitch integration status | — | none | none | **Blocked (Ph2 per doc)** | Doc's own note: "Integration needed, Ph2" |
| 77 | Site map + alert heatmap + policy view (Ph2 composite) | — | depends on SCC | — | **Needs follow-up** | Explicitly a Phase 2 aspiration in the source doc, gated on SCC access |

## Agentic Ops

The most speculative pillar — several rows are the xlsx authors' own placeholders.

| # | Search / use case | Data model or object | Sourcetypes | TA | Status | Notes |
|---|---|---|---|---|---|---|
| 78 | Telemetry source health (XDR/SNA/Meraki/Cloud feed status) | — | many | many | **Available** | `feed_monitor_all_feeds_health_matrix`, `_ise_syslog_staleness`, `_ftd_firewall_staleness` — this exact pattern already exists broadly |
| 79 | AI/Agent events from AI Defense | — | `cisco:ai:defense`, `cisco:ai:defense:notable` | `CiscoSecurityCloud` (7404, cisco_supported) | **Available** | 7 existing stanzas |
| 80 | ThousandEyes — inspection points, assurance tests/data | — | `cisco:thousandeyes:*` | `ta_cisco_thousandeyes` (7719, cisco_supported) | **Available** | Very well covered already |
| 81 | Workflows — most/least used, aligned to SN, per-user/per-org stats | — | none (Workflows API only) | none | **Blocked** | Contact **Reid Butler** — API exists, no TA; pullable without one if someone builds the integration |
| 82 | Workflows reverted (efficacy), correlated to network events | — | none | none | **Blocked** | Same |
| 83 | Issues raised by agents | — | — | — | **Needs follow-up** | Ambiguous which "agents" (AI Defense? Workflows?) |
| 84 | SN baselines (devices, # RaVPN, clients, guest access, mgmt/unmanaged) | — | `cisco:secure_access:security_events_ravpn` + Meraki client data | `TA-cisco-cloud-security-addon` (7569) + `Splunk_TA_cisco_meraki` (5580) | **Needs work (RaVPN partial built)** | RaVPN activity/failure tables now exist; full baseline/current/delta logic across clients, guest access, devices, and unmanaged assets still needs a dedicated baseline stanza. |
| 85 | Client vs. Box visibility — NetFlow enabled, access vs. distribution | — | uncertain | uncertain | **Needs work (uncertain)** | SCAN's own `cisco_netflow` product is `archived`/`not_supported` — the generic path is dead. `cisco-catalyst-enhanced-netflow` (unreviewed local repo) may be a newer/different implementation; review before concluding either way |
| 86 | SNOW — Secure Network incident monitoring (open tickets) | "Ticket Management" CIM | ServiceNow API | referenced in `cisco-cloud-security` app manifest | **Needs work** | Only one loose ServiceNow mention exists today, not real ticket monitoring |
| 87 | Splunk resource — ingest/SVC usage, "can we report on ourselves" | — | `_internal`, license usage | none needed | **Needs work** | No TA required at all — Splunk's own internal telemetry. Steven Moore: "Prob not leader" |
| 88 | SD-WAN intelligence — NWPI / path-change recommendations | — | `cisco:sdwan:*` | `TA_cisco_catalyst` (7538, cisco_supported) | **Needs work** | SD-WAN health well covered; NWPI-specific path-change counts unconfirmed |
| 89 | AI Workload info from o11y — Tokenomics, GPU/CPU vis | — | `cisco:intersight:*` (GPU/AI-server reporting, v3.2.0) + AppDynamics | `Splunk_TA_Cisco_Intersight` (7828, cisco_supported) + `Splunk_TA_AppDynamics` (3471, **developer_supported**) | **Needs work** | Intersight side solid; AppDynamics side flagged `coverage_gap=true` (rebuild) in SCAN — a real example of the TA-funding risk |
| 90 | Cisco Telemetry Broker status | — | none | none | **Blocked** | SCAN: roadmap/not_supported |
| 91 | Intersight — automation stats, agent/app stats | — | `cisco:intersight:*` | `Splunk_TA_Cisco_Intersight` (7828, cisco_supported) | **Needs work** | Doc's own open question: "Can it give me automation stats?" — needs checking which Intersight fields actually cover this |
| 92 | % onboarded to Cloud Control | — | none | none | **Blocked** | Needs API; SCC-adjacent gap |
| 93 | Cisco Data Fabric federation view (where am I federated) | — | — | — | **Needs follow-up** | Vague scope, doc itself: "Prob not leader" |
| 94 | Agentic Policy/Heatmap | — | — | — | **Needs follow-up** | xlsx author: "I was reaching here" |
| 95 | Agentic Security — discovery, validation, protection, guardrails | — | — | — | **Needs follow-up** | xlsx author: "Yeah, I got nothing here. Dave?" |
| 96 | AI Agent discovery (Galileo) | — | — | — | **Needs follow-up** | Explicitly marked "future" in the source doc |
| 97 | AI Edge Processing | — | — | — | **Needs follow-up** | xlsx author: "I was reaching here" |
| 98 | IoT Policy Group(s) — higher-level policy view w/ IoT capabilities | — | — | — | **Needs follow-up** | From the `Original` sheet only — cut from the final `Secure Networking Pillars` sheet, lower priority |

---

## Roll-up

**Verified by counting the actual table rows, not hand-tallied** (the earlier `SN_GAP_ANALYSIS.md` summary had a manual arithmetic error — not repeating that here). **Stale as of 2026-07-20 evening** — 6 items have since moved to Built/corrected statuses (3, 32, 38, 47, 62, 67 built; 14 corrected to Needs-new-TA-input) and the table below hasn't been recounted against those changes yet. Treat individual row statuses (above) as current; treat this summary table as directionally right but a turn or two behind.

| Pillar | Available | Needs work | Needs new TA | Blocked | Needs follow-up | Total |
|---|---|---|---|---|---|---|
| Zero Trust Access | 2 | 9 | 2 | 1 | 1 | 15 |
| Secure Infrastructure | 4 | 4 | 3 | 8 | 1 | 20 |
| Scalable Network Segmentation | 0 | 21 | 1 | 0 | 2 | 24 |
| Hybrid Mesh Firewalling | 5 | 7 | 0 | 4 | 2 | 18 |
| Agentic Ops | 3 | 7 | 0 | 4 | 7 | 21 |
| **Total** | **14** | **48** | **6** | **17** | **13** | **98** |

**48 "Needs work" + 6 "Needs new TA" = 54 genuinely buildable searches**, plus 14 already available (which may still need pillar-tagging/retagging to be discoverable in the drag-and-drop UI — see the open tagging question in `SN_EVENT_SCOPING.md`). That's much closer to Amir's ~100-150 estimate than the earlier 30-item list — especially once several of these (e.g. the SGT items, which are really site-rollup + device-rollup + trend + drilldown each) get decomposed further during actual authoring.

**Segmentation is overwhelmingly the highest-effort pillar**: 21 of 24 items need work, zero are available, and it's the only pillar where nothing already exists. Everything else has at least some available foundation to build from. **Secure Infrastructure has the most hard blocks** (8 of 20) — almost entirely the Cisco-IQ-sourced hardening/crypto checklist (TPM/SUDI/Secure Boot/Broccoli/Mythos/PQC).

## Cross-doc notes

- Rows citing `cisco_supported` TAs are the safest bets given Alan's TA-funding risk (`SN_EVENT_SCOPING.md` Risks). Rows relying on `developer_supported`/`community_supported`/deprecated TAs (#31 PSIRT, #89 AppDynamics half) carry that risk directly.
- "Needs new TA" items (#4, #5 TrustSec CLI collection; #27-29 MACSec/IPSec/TLS) are a different category of work than "Needs work" — they're TA/collection-engineering projects, not searchbase authoring, and should probably be scoped/prioritized separately from the rest of this list.
- "Needs follow-up" items (16 total) need a human decision, not more analysis — see `SN_GAP_ANALYSIS.md`'s equivalent note.
