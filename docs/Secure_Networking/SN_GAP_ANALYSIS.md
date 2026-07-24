# Gap Analysis — Existing Searchbase Coverage vs. the 5 Secure Networking Pillars

**Superseded 2026-07-20 by `SN_SEARCH_BUILD_LIST.md`** (same folder) — that doc re-runs this analysis against all four xlsx tabs (this one only covers `Secure Networking Pillars`), cross-checked against SCAN's `products.conf` for precise sourcetypes/TA/support_level, and is the current authoritative "what to build" list. This doc is kept for its reviewer-comment sourcing and as the historical record of the first pass — read `SN_SEARCH_BUILD_LIST.md` first.

Analysis only — no new `searchbase.conf` stanzas were written in this pass. See `SN_EVENT_SCOPING.md` for the app/TA inventory and stakeholder context this analysis relies on.

**Method:** every leader- and operator-view row from the xlsx's `Secure Networking Pillars` sheet was checked against a full parse of `searchbase.conf` (814 real stanzas — the earlier "840" figure counted SPL subsearch brackets as false stanza headers and has been corrected) for an existing match by sourcetype/keyword, then against the confirmed app/TA inventory in `SN_EVENT_SCOPING.md` for whether the underlying data exists anywhere even without a stanza yet. The xlsx repeats most asks verbatim across the Leader and Operator views (e.g. "SGT sankey permit, deny" appears in both) — those duplicates were merged into a single row below rather than counted twice; every distinct ask was cross-checked against the raw source rows to confirm nothing was silently dropped, but the row counts here are lower than the ~109 raw xlsx rows for that reason, not because rows were skipped.

**Status legend:**
- **Covered** — an existing stanza already answers this ask.
- **Buildable gap** — no stanza yet, but the data is confirmed available (per the app/TA inventory) — a genuine candidate for new work.
- **Blocked gap** — data isn't available anywhere we've checked. Per Chris's MVP rule, skip these, don't build around them.
- **Needs follow-up** — ambiguous in the source doc itself (including a few rows the xlsx's own authors flagged as speculative), not a mechanical call.

## Summary

**Corrected 2026-07-20** — the original counts below had an arithmetic error (manual tally, not verified against the detail tables). Recomputed directly from the pillar tables; "Covered" folds in "Covered / partial" rows.

| Pillar | Covered (incl. partial) | Buildable gap | Blocked gap | Needs follow-up |
|---|---|---|---|---|
| Secure Infrastructure | 6 | 3 | 2 | 0 |
| Scalable Network Segmentation | 3 | 12 | 0 | 1 |
| Zero Trust Access | 4 | 2 | 0 | 1 |
| Hybrid Mesh Firewalling | 6 | 7 | 2 | 0 |
| Agentic Ops | 4 | 6 | 2 | 6 |
| **Total** | **23** | **30** | **6** | **8** |

30 confirmed buildable gaps, against Amir's ~100-150 new-search estimate from the standup — the estimate is likely counting each buildable gap as several searches (e.g. "SGT by Site, By Device" alone probably needs separate site-rollup, device-rollup, and trend searches), not 1:1 with xlsx rows. Worth reconciling directly with Amir once we're ready to scope authoring work, not assumed to match here.

---

## Pillar 1: Secure Infrastructure

| Use case | Status | Existing stanza(s) / data source | Notes |
|---|---|---|---|
| Secure Infra Status (leader) | Covered | `executive_dashboard_data_source_status`, `dashboard_netops_readiness_v1_*` | Broad device/health status already rolled up |
| Devices/Health, Alerts by Site (operator) | Covered | `dashboard_netops_readiness_v1_q3_aps_poor_health`, DNAC devicehealth stanzas | |
| Broccoli assessment (pre/post hardening, PQC threshold) | **Blocked gap** | none | Confirmed 0 hits for `pqc`/`broccoli`/`macsec` anywhere in searchbase.conf. Intersight (7828) covers UCS/compute HCL only, not IOS/NX-OS crypto readiness. Open question in `SN_EVENT_SCOPING.md`: does `ciscoSplunkC2CReporting` close this? Unconfirmed. |
| PQC: non-capable / capable-if-upgraded / capable-not-deployed / deployed | **Blocked gap** | none | Same as above — this is a restatement of the Broccoli ask. |
| CVE, PSIRT advisories | Covered | `security_resilience_psirt_advisories`, `security_resilience_psirt_critical_advisories`, `security_resilience_advisory_exposure_by_family`, `network_dc_nd_open_advisories_table` | Well covered already, including a DC-fabric-specific advisory view |
| Devices approaching/past LDOS | **Buildable gap** | Catalyst Center inventory data (`cisco:catalyst:center:inventory:report`, `cisco:dnac:compliance`) has device/software-version fields | No existing stanza; needs a new EoL/LDOS lookup joined against inventory — buildable, not yet built |
| SD-WAN Site View (SSE/type/FW/MX/Cat/Apps) | Covered | `monitoring_sdwan_*` category (12 stanzas), SD-WAN link/tunnel/site health from `ta_cisco_common` | |
| Bulk/Agg traffic stats (DIA vs SD-WAN vs SSE) | **Buildable gap** | SD-WAN data exists; no stanza breaks it out DIA-vs-SD-WAN-vs-SSE specifically | |
| WiFi: SSID view by site + security methods + clients by method | Covered / partial | 24 existing SSID-tagged stanzas (`user_experience_top_ssids_by_clients`, `client_summary_client_by_ssid`, etc.) | SSID counts/clients well covered |
| WiFi: Site view of Auth Method (WPA3/WPA2/Open) | **Buildable gap** | Meraki TA (`Splunk_TA_cisco_meraki`) carries wireless auth-mode config fields | No existing stanza queries auth-method specifically — only rogue-device 802.1X tagging exists, not SSID auth-mode breakdown |
| WiFi: Guest access counts, policy, security events | Covered / partial | `user_experience_guest_client_surge`, `user_experience_ise_guest_auth_rate` | Guest counts/auth rate exist; guest *policy* and *security events* less so |

## Pillar 2: Scalable Network Segmentation

This pillar has the most confirmed buildable gaps — `searchbase.conf` has **zero** hits for `sgt`, `trustsec`, `vrf`, `vlan`, or `vxlan` anywhere, but the underlying data is real: `app_cisco_common`'s `Cisco_Catalyst_App` datamodel already ships `Cisco_Catalyst_IP_SGT_Bindings`, `Cisco_Catalyst_SGACL_Events`, and `ISE_Syslog_Security_Group_Tag`; `ta_cisco_common` collects `cisco:ise:securitygroups`/`cisco:ise:sgtbindings`; the DC Networking app (7777) has ACI/Nexus fabric data. None of it is queried from this app's searchbase yet.

| Use case | Status | Existing stanza(s) / data source | Notes |
|---|---|---|---|
| Segmentation Status (leader) | **Buildable gap** | `app_cisco_common` SGT datamodel objects | |
| VRFs/VLANs/VXLANs/SGTs — Site Breakdown | **Buildable gap** | same | |
| SGT by Site, by Device | **Buildable gap** | `Cisco_Catalyst_IP_SGT_Bindings` (already has a device/host field per the panel in `app_cisco_common`'s `events_and_incident_viewer.xml`) | Closest to "shovel-ready" — the datamodel + an existing app_cisco_common panel already do 80% of this |
| SGT sankey permit/deny — policy view | **Buildable gap** | `ISE_Syslog_Security_Group_Tag`, SGACL data | |
| SGT sankey by business service | **Buildable gap** | same, plus a service-mapping lookup | Needs an additional mapping layer (SGT → business service) that doesn't exist yet anywhere |
| SGT traffic stats, alerts, threshold crossing | **Buildable gap** | `Cisco_Catalyst_SGACL_Events` | Steven Moore (reviewer) confirmed SGACL counters are pullable directly from the box |
| SGT Policy View (operator) | **Buildable gap** | same SGT datamodel objects | Filed under "Secure Infrastructure" in the xlsx's own operator section but is genuinely a Segmentation ask |
| Enforcement Points (SGT locale) | **Buildable gap** | SGACL/SGT data, distributed enforcement | |
| SGT Matrix | **Buildable gap** | same as sankey — different viz on the same data | |
| SGT Utilization/Capacity | **Buildable gap** | SGT bindings count vs. device capacity — no capacity-threshold data confirmed yet | Would need a device-capacity reference the inventory may not carry — flag for follow-up if data turns out thinner than expected |
| Traffic Block/Trend Analysis | Covered / partial | `security_resilience_cloud_fw_blocked`, `security_resilience_top_blocked_destinations` cover cloud firewall blocks; SGACL-specific block/trend still a buildable gap | |
| Policy Hits by Site | **Buildable gap** | SGACL + site inventory | |
| Site Readiness (composite exposure/adoption/risk score) | **Needs follow-up** | none | This is the "site score for SN" composite metric Steven Moore flagged as having no known collection mechanism — a real open design question, not a missing TA |
| Segmentation View: Fabrics, L2/L3 VNI, GPO/EPG/ESG, DC↔Campus SGT-to-GPO mapping | Covered / partial | `network_dc_nd_active_anomalies_by_fabric`, `network_aci_health_score_leaderboard` cover fabric health; VNI/GPO/SGT-to-fabric mapping specifically is a buildable gap | |
| # of segments, L2/L3 VNI location by DC, traffic | **Buildable gap** | Nexus DC Networking app (7777) has flow/congestion data | |
| Fabric Stats: Fabrics/Segments/Groups/Policies | Covered / partial | same fabric health stanzas as above | Policy/group rollup specifically still a gap |

## Pillar 3: Zero Trust Access

| Use case | Status | Existing stanza(s) / data source | Notes |
|---|---|---|---|
| ZTA Status (leader) | Covered / partial | ISE infrastructure-health stanzas below roll up into this | |
| ISE/AccMan — identity, auth policy, RADIUS/RADSEC per device | **Buildable gap** | `ta_cisco_common` has `cisco:ise:tacacs:policyset`/`authz:policy`; `app_cisco_common` has `Cisco_Catalyst_ISE_TACACS_Policy_Hit` | RADIUS latency/health already covered (see below); the RADIUS-vs-RADSEC distinction per device is not yet queried |
| Is my common policy control plane healthy? Monitor/operate | Covered | `security_resilience_ise_node_inventory`, `security_resilience_ise_radius_latency`, `it_critical_systems_aaa_server_issues`, `feed_monitor_ise_syslog_staleness` | Directly answers this — no new work needed |
| Is my radius control plane up and operational, by site? | Covered | same stanzas as above | |
| Am I syncing with ISE, AccMan, EntraID, PxGrid, etc.? | **Needs follow-up** | xlsx names SCC as the data source (confirmed unavailable), but ISE's own deployment-node data (`ta_cisco_common`) might partially answer integration/persona-presence even without a literal "sync status" field | Don't classify as flatly blocked — worth a short spike to see what ISE-native data can answer before concluding it needs SCC |
| Auth Failures, Successes | Covered | `executive_dashboard_failed_logon_with_baseline`, `security_resilience_ds_ise_fail_count`, `security_resilience_ds_ise_failure_reasons`, `security_resilience_locked_accounts` | Well covered |
| Guest Wifi Data Monitoring (Spaces geofencing + Meraki client counts, abuse detection) | **Buildable gap** | `ta_cisco_spaces` (location/presence) + Meraki client data | Per earlier review: Spaces TA has no SSID/auth fields, so this needs both sources combined — matches the xlsx's own "Spaces will need some work" note |

## Pillar 4: Hybrid Mesh Firewalling

| Use case | Status | Existing stanza(s) / data source | Notes |
|---|---|---|---|
| Hybrid Mesh Firewalling Status (leader) | Covered / partial | firewall-blocked-count/baseline stanzas roll up into this | |
| How many HMFw devices attached to SCC | **Blocked gap** | none | Confirmed: zero "Security Cloud Control"/"SCC" hits across the entire app/TA inventory, not just this repo |
| How many have FW enabled — MX vs. FW vs. Secure Router, by site | **Buildable gap** | Meraki TA has `meraki:securityappliances` (MX FW config); `ta_cisco_common` has Secure Router data | No stanza yet combines device-type FW-enablement across both sources |
| FW stats/status | Covered | `executive_dashboard_firewall_blocked_count`, `executive_dashboard_firewall_blocked_with_baseline(_drilldown)`, `feed_monitor_ftd_firewall_staleness` | |
| FW Device Status, alerts, by Site | Covered | same firewall stanzas, ASA/FTD detail stanzas | |
| FW blocks, threats — trend/events/stats | Covered | same | |
| Secure Access — Alerts, Blocks, Policies | Covered / partial | `security_resilience_cloud_fw_blocked`, `security_resilience_top_blocked_destinations` (Umbrella/Secure Access cloud firewall) | General blocks covered; policy-level detail less so |
| Secure Access Policy Block for App/Cloud access (DC→Cloud→App view) | **Buildable gap** | Secure Access TA+App pair (7569/5558) confirmed available | No stanza builds the DC→Cloud→App-specific view yet |
| View of policy hits: N/S, E/W | **Buildable gap** | Secure Firewall API/eStreamer data (`SBG-splunk-security-suite`) | |
| DC FW — Front Door | **Buildable gap** | same Security Cloud suite data | |
| Hybrid Mesh FW Logs | **Buildable gap** | same | |
| ToR FW (DPU) | **Buildable gap** | Secure Firewall/Multicloud Defense data — DPU-specific breakdown not confirmed as a distinct field; may need a follow-up check once building starts | |
| Cloud Alerts (AWS/Azure/GCP) | **Buildable gap** | Multicloud Defense (`SBG-splunk-security-suite`) covers cross-cloud security, though not confirmed as native AWS/Azure/GCP alert-source ingestion | |
| App Security Data — Secure App/eBPF/Isovalent | Covered / partial | 12 existing Multicloud Defense/Isovalent-tagged stanzas | |
| DC FW view North/South — Hypershield | **Blocked gap** | none | The xlsx itself labels this "Hypershield / Roadmap item" — not a current-state gap, a genuinely future product |

## Pillar 5: Agentic Ops

The pillar with the most **Needs follow-up** items — several rows in the xlsx are the authors' own speculative placeholders ("I was reaching here," "Yeah, I got nothing here. Dave?").

| Use case | Status | Existing stanza(s) / data source | Notes |
|---|---|---|---|
| Agentic Ops Status (leader) | Covered / partial | AI Defense stanzas + feed-health monitoring roll up into this | |
| Workflows (most/least used, aligned to SN) | **Blocked gap** | none | Confirmed no Workflows API TA anywhere. Steven Moore: contact **Reid Butler**, pullable via API without a TA |
| Workflows reverted / workflow-task correlation to network events | **Blocked gap** | none | Same as above |
| Issues raised by agents | **Needs follow-up** | ambiguous which "agents" (AI Defense? Workflows?) | |
| Where are my telemetry sources? (XDR, SNA, Meraki/Cloud) | Covered | `feed_monitor_all_feeds_health_matrix`, `feed_monitor_ise_syslog_staleness`, `feed_monitor_ftd_firewall_staleness` | This exact kind of feed-health rollup already exists broadly |
| SN baselines (devices, # RaVPN, clients, guest access, mgmt/unmanaged) | **Buildable gap** | Only one existing VPN stanza (`security_resilience_vpn_session_detail`) — not a full RaVPN baseline | |
| ThousandEyes: inspection points, Assurance Tests/Data | Covered | Very well covered — ThousandEyes-tagged stanzas throughout `teuc_*`/`spaces_fit`/`spaces_predict` categories | |
| Client vs. Box visibility — NetFlow enabled, access vs. distribution | **Buildable gap** | Zero NetFlow hits in searchbase despite `cisco-catalyst-enhanced-netflow` existing in the local repo inventory (not yet reviewed) | Worth reviewing that repo before scoping this one — may be more buildable than currently assumed |
| SNOW — Secure Network incident monitoring (open tickets) | **Buildable gap** | `cisco-cloud-security` app manifest references a "Ticket Management" CIM model | Only one loose ServiceNow mention exists today (in a SaaS-response-time comparison, not ticket monitoring) |
| Splunk resource (ingest/SVC usage, Data Fabric federation) | **Buildable gap** | Splunk's own `_internal`/license-usage data is always available regardless of any TA | Steven Moore's own comment: "Prob not leader" — likely an operator-only ask |
| SD-WAN intelligence — NWPI / path-change recommendations | **Buildable gap** | SD-WAN link/tunnel health well covered; NWPI-specific path-change counts not confirmed | |
| Data availability / CMDB config-item state | **Needs follow-up** | vague ask, depends on ServiceNow CMDB integration scope | |
| Agentic Policy/Heatmap | **Needs follow-up** | xlsx author: "I was reaching here" | |
| AI/Agent — Events from AI Defense | Covered | 7 existing AI Defense-tagged stanzas | |
| AI Workload info from o11y (Tokenomics, GPU/CPU vis) | **Buildable gap** | Intersight (7828) v3.2.0 added AI-server/GPU visibility specifically (CAI845A/UCSC885 support, GPU inventory reports) | More buildable now than when the xlsx was written — Intersight's new AI-server reporting is a strong fit |
| Agentic Security: discovery, validation, protection, guardrails | **Needs follow-up** | xlsx author: "Yeah, I got nothing here. Dave?" | |
| AI Agent discovery (future, Galileo) | **Needs follow-up** | Explicitly marked "future" in the source doc | |
| AI Edge Processing | **Needs follow-up** | xlsx author: "I was reaching here" | |

---

## What this resolves from `SN_EVENT_SCOPING.md`'s open questions

- **Catalyst Center visibility gap** (flagged on the 2026-07-20 standup): not a raw-data gap. Catalyst Center/DNAC data is extensively present and queried already (`cisco:dnac:*` sourcetypes throughout Building/Network/NetOps Readiness categories). If Amir's standup comment about "missing Catalyst Center visibility" refers to something specific, it's more likely one of the buildable gaps above that happens to route through Catalyst Center (e.g. LDOS/EoL tracking, or the SGT-to-fabric mapping) than a wholesale absence of Catalyst Center data. Worth a direct follow-up with Chris to pin down which specific visualization was meant.

## Cross-referenced against the SCAN product catalog (2026-07-20)

`~/repo/splunk-cisco-app-navigator`'s `products.conf` (93 products, "Splunk Cisco App Navigator" / SCAN) is AK's own master catalog of every Cisco product's TA/viz-app pairing, `support_level`, `status`, and `sourcetypes` — and separately tracks `coverage_gap`/`gap_type` for roadmap products with no Splunk integration at all. Cross-checking it against this analysis:

**Important taxonomy mismatch found:** SCAN's `gtm_pillar` field (1-5) encodes Cisco's *official* Secure Networking GTM pillars — 1 Secure Campus & Branch, 2 Secure WAN Edge, 3 Data Center & Cloud, 4 End-to-End Visibility & Assurance, 5 Industrial/OT (sourced from a cisco.com collateral doc) — which is **not the same 5-pillar framework** as Chris's deck (ZTA / Secure Infrastructure / Segmentation / Hybrid Mesh Firewalling / Agentic Ops) used throughout this analysis. Both are legitimately "Secure Networking," but they're different mental models. Worth resolving with Alan/Chris directly before this goes further — see Risks in `SN_EVENT_SCOPING.md`.

**Reclassifications and refinements from this cross-check:**
- **"Am I syncing with ISE, AccMan, EntraID, PxGrid, etc."** (ZTA) — was **Needs follow-up**; SCAN confirms `cisco_pxgrid` is `archived`/`not_supported`/`coverage_gap=true`. Reclassify to **Blocked gap** (at least for the PxGrid half of the ask).
- **SN baselines / # of RaVPN** (Agentic Ops, was flagged as thin coverage) — actually well-supported: `cisco_secure_access` (7569/5558) has dedicated `cisco:secure_access:security_events_ravpn` and `cisco:cloud_security:ravpn` sourcetypes. Upgrade confidence on this buildable gap.
- **CVE/PSIRT** (Secure Infrastructure, was Covered) — refine, don't reverse: the "Covered" status holds for DNAC-embedded advisories (`cisco:dnac:securityadvisory`). SCAN reveals a *separate*, more comprehensive PSIRT feed (`ti-cisco-vuln`, Splunkbase 5183, `cisco:vuln:advisories*`) that's `deprecated`/`not_supported`/`coverage_gap=true` (rebuild) — a broader PSIRT integration is itself a buildable/rebuild gap, distinct from the narrower DNAC-scoped view already covered.
- **AI Workload info from o11y** (Agentic Ops buildable gap) — SCAN shows `cisco_appdynamics` is `active` but only `developer_supported`, also flagged `coverage_gap=true` (rebuild). Concrete example of Alan's TA-funding risk: the integration exists today but isn't reliably supported.
- **New gap, not previously listed**: **Cisco Telemetry Broker** — `roadmap`/`not_supported` in SCAN. Relevant to the Agentic Ops "telemetry sources" health story; no current Splunk integration.
- **SGACL-backed Segmentation gaps** now have a second confirmed source: `cisco_catalyst_sdwan` carries `cisco:sdwan:sgacl:logs`, `cisco:sdwan:acl:logs`, `block:host`/`unblock:host`, `drop:pkt`/`pass:pkt` directly, in addition to `app_cisco_common`'s SGACL datamodel object.

**support_level as a proxy for the TA-funding risk** (see `SN_EVENT_SCOPING.md` Risks): SCAN tags every product `cisco_supported` / `splunk_supported` / `developer_supported` / `community_supported` / `not_supported`. Most of what backs our 30 buildable gaps is `cisco_supported` (ISE, Secure Access, Meraki, SD-WAN, Nexus, Security Cloud suite, Intersight) — but `cisco_appdynamics` (developer_supported) and `cisco_provider_connectivity_assurance` (deprecated/community_supported) are weaker, and worth flagging if we lean on them.

## Still open

- The buildable-gap count (30) vs. Amir's ~100-150 new-search estimate needs reconciling — likely each gap above decomposes into several searches (site rollup, device rollup, trend, drilldown) rather than one search per row.
- `cisco-catalyst-enhanced-netflow` and `ciscoSplunkC2CReporting` remain unreviewed; both could move rows from Buildable/Blocked into Covered or a firmer Buildable if reviewed.
- "Needs follow-up" rows (8 total) need a human decision, not further analysis — most are either genuinely speculative in the source doc or depend on an unresolved design question (site score, SCC-alternative for sync status, ServiceNow CMDB scope).
