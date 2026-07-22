# Secure Networking searchbase.conf Next Build Plan

Purpose: translate Steven Moore's meeting guidance, the Webex Spaces threads, the launch docs, and the existing `SN_SEARCHBASE_BUILD_LOG.md` into a practical build queue for `searchbase.conf`.

This is not a replacement for `SN_SEARCH_BUILD_LIST.md`. Treat that file as the broad inventory. Treat this file as the next working plan for what to build, what to defer, and what needs TA or demo-data work before SPL is useful.

Sensitive note: the Webex Spaces attachment that included temporary access details was reviewed for context only. Do not copy credentials, temp links, or admin details into this repo.

## Steven's message in plain English

Steven is not asking for isolated product dashboards. He is asking each Secure Networking pillar to answer the same operational questions:

1. Do we have the capability?
2. Is it deployed or turned on where it should be?
3. Is it actually doing work?
4. Where are the policy, identity, coverage, or enforcement gaps?

That gives us the search model for every pillar:

| Layer | Search meaning | Typical output |
|---|---|---|
| Capability | Can this site/device/user path support the control? | device/site inventory, software, license, hardware, feature capability |
| Coverage | Where is the control deployed or configured? | percent covered, covered vs. uncovered sites/devices, missing enforcement points |
| Activity | What is the control doing now? | auths, blocks, denies, hits, sessions, counters, policy usage |
| Gaps | What is risky, stale, failing, or inconsistent? | failures, unprotected sites, default tags, unused policy, stale feeds, missing config |

The searchbase should therefore favor reusable searches that produce site/device/policy/activity shapes, not one-off demo panels.

## Chat and launch-doc reality checks

| Theme | What it means for searchbase.conf |
|---|---|
| GSX/demo urgency | Build searches that can render with today's supported TAs and demo data first. Use `makeresults` only in dashboards or demo-data generation, not as the normal searchbase pattern. |
| Executive plus operational story | Each pillar needs a small rollup search plus drilldown searches that explain the rollup. |
| Segmentation is the main story | SGT, SGACL, ISE, and enforcement points need the most build attention. |
| ISE is central | Zero Trust Access and Segmentation both depend on ISE auth, policy, SGT, and device context. |
| Hybrid Mesh Firewalling is coverage plus enforcement | The question is not just "how many blocks"; it is "where do we have distributed enforcement, and where are we missing it?" |
| Secure Infrastructure is partly blocked | Firmware, PSIRT, LDOS, device health can be searched now. TPM, SUDI, secure boot, Broccoli hardening, MACSec, PQC, and detailed crypto posture need Cisco IQ, CLI collection, or a new pipeline. |
| Agentic Ops is still less concrete | Keep Phase 1 to telemetry health, SN baselines, and ThousandEyes coverage. Track AI Defense as future/context unless the demo script explicitly pulls it forward. Do not let speculative workflow or AI-agent rows consume GSX time. |
| Intersight is now a lightweight Secure Infrastructure enrichment | `cisco:intersight:advisories` sample data exists and `secure_networking_intersight_advisory_exposure` is built. Decide later whether it is MVP-visible or kept as an optional drilldown panel. |
| AI Defense and Isovalent are future/context for now | Useful later, but not a required first dashboard path based on Anastasiya's note. |
| TA ownership matters | Prefer `cisco_supported` TAs. Treat duplicate/overlapping ISE, ASA, and cloud security sources as an engineering risk to document, not something to hide in SPL. |

## Current Secure Networking searchbase inventory

These stanzas exist in the working `searchbase.conf` inventory as of the 2026-07-21 P0/P1 plus demo-data-backed build batches. All 29 Secure Networking tagged stanzas pass live `/opt/10` SPL export validation. The five newest demo-data-backed stanzas are SPL-valid but return no rows in the current live window because their sample files are present on disk but not visible as indexed results yet.

| Stanza | Pillar | Current role |
|---|---|---|
| `secure_networking_ise_policy_family_overview` | Zero Trust Access | RADIUS/network-access vs. TACACS/device-admin policy-set breakdown by ISE host |
| `secure_networking_meraki_threat_blocks_by_category` | Hybrid Mesh Firewalling | Meraki blocked threats by category/severity |
| `secure_networking_catalyst_center_software_version_inventory` | Secure Infrastructure | Catalyst Center software-version inventory groundwork for LDOS/EoL |
| `secure_networking_ip_sgt_bindings_by_group` | Scalable Network Segmentation | IP-to-SGT binding view, refreshed for the new `cisco:ise:sgtbindings` sample schema |
| `secure_networking_ise_policy_hits_by_device` | Scalable Network Segmentation | ISE policy-set hits by network device |
| `secure_networking_fw_enabled_device_type_by_site` | Hybrid Mesh Firewalling | Meraki fleet classified by firewall-capable device type and site |
| `secure_networking_sgt_by_site` | Scalable Network Segmentation | SGT-tagged ISE auth events by structured location |
| `secure_networking_trustsec_hardware_readiness` | Scalable Network Segmentation | Device family/model rollup groundwork for TrustSec readiness |
| `secure_networking_software_license_compatibility` | Secure Infrastructure | Software/license rollup groundwork for compliance |
| `secure_networking_excessive_mac_per_port` | Scalable Network Segmentation | Wired ports with excessive distinct MACs |
| `secure_networking_vendor_mac_on_nac_port` | Scalable Network Segmentation | Vendor/virtual MACs on wired NAC ports, EX-AUTH candidates |
| `secure_networking_ot_iot_device_visibility` | Scalable Network Segmentation | Cyber Vision OT/IoT device visibility by device type and risk |
| `secure_networking_source_health_by_pillar` | All / Agentic Ops | Source-health matrix by Secure Networking pillar/source/sourcetype |
| `secure_networking_site_inventory_rollup` | All / Secure Infrastructure | Cross-controller site inventory from Catalyst Center, Meraki, and SD-WAN |
| `secure_networking_zta_auth_outcome_trend` | Zero Trust Access | ISE auth success/failure trend |
| `secure_networking_zta_failure_reasons_by_site` | Zero Trust Access | ISE auth failure reasons by site/network device |
| `secure_networking_zta_radius_node_health_by_site` | Zero Trust Access | ISE/RADIUS node and network-device health by site |
| `secure_networking_segmentation_status_rollup` | Scalable Network Segmentation | Segmentation adoption rollup by site |
| `secure_networking_sgt_distribution_by_site_device` | Scalable Network Segmentation | SGT distribution by site and network device |
| `secure_networking_hmf_enforcement_coverage_by_site` | Hybrid Mesh Firewalling | Firewall/enforcement coverage evidence by site |
| `secure_networking_hmf_unified_blocks_trend` | Hybrid Mesh Firewalling | Unified block/drop/deny trend across HMF sources |
| `secure_networking_secure_infra_status_rollup` | Secure Infrastructure | Catalyst Center inventory/health/software/compliance rollup |
| `secure_networking_psirt_exposure_by_site_family` | Secure Infrastructure | PSIRT exposure by site and device family |
| `secure_networking_sdwan_site_view` | Secure Infrastructure | SD-WAN site health and score table |
| `secure_networking_zta_ravpn_sessions_by_profile` | Zero Trust Access | Secure Access RaVPN activity and failures by profile/region/enforcement host/SGT |
| `secure_networking_zta_ravpn_failure_reasons` | Zero Trust Access | Secure Access RaVPN failure/warning reasons with ASA syslog context |
| `secure_networking_secure_access_dlp_findings` | Hybrid Mesh Firewalling / Zero Trust Access | Secure Access DLP findings by rule/classification/application/direction |
| `secure_networking_intersight_advisory_exposure` | Secure Infrastructure | Intersight PSIRT/EOL/field-notice exposure by affected object type |
| `secure_networking_sgt_binding_inventory` | Scalable Network Segmentation | ISE IP-SGT binding inventory by SGT, binding type, SXP domain, source node, and peer path |

## Phase labels

| Phase | Meaning |
|---|---|
| P0 | Build or validate first because other searches depend on it. Usually source, feed, or inventory health. |
| P1 | Build for GSX/MVP searchbase now if data is present or demo-data is already being seeded. |
| P1-data | SPL is worth designing, but the stanza cannot be validated until specific demo data lands. |
| P1-TA | Desired for GSX story, but not searchbase-only work. Requires TA, API, CLI, lookup, or synthetic demo-source work first. |
| P2 | Post-GSX or future narrative. Keep tracked, but do not spend first build cycle here. |

## P0 foundation searches

These should be boring and reliable. They help us avoid building panels on empty or stale sources.

| Pillar | Proposed stanza | Search question / output | Dimensions and drilldown | Primary TA/app | Sourcetypes | Phase |
|---|---|---|---|---|---|---|
| All | `secure_networking_source_health_by_pillar` | Which Secure Networking feeds are fresh, stale, or missing? Output one row per pillar/source. | pillar, source, sourcetype, latest event, age, status | Multiple | ISE, Meraki, Secure Access, Catalyst, SD-WAN, FTD/ASA, ThousandEyes, AI Defense | P0 |
| All | `secure_networking_site_inventory_rollup` | What sites, regions, networks, and devices are visible to the app? | site, region, controller, product family, device count | Catalyst Center, Meraki, SD-WAN, DC Networking | `cisco:dnac:*`, `meraki:*`, `cisco:sdwan:*`, `cisco:dc:*` | P0 |
| All | `secure_networking_policy_object_inventory` | Which policy objects are visible across ISE, Secure Access, firewall, SGT, and SGACL sources? | policy family, policy name, source platform, last_seen | Catalyst/ISE, Secure Access, CiscoSecurityCloud | `cisco:ise:*`, `cisco:cloud_security:*`, `cisco:secure_access:*`, firewall policy sourcetypes | P0 |

## P1 searchbase build queue

These are the searches I would build next in `searchbase.conf`, ordered around the five overview sections and Steven's capability/coverage/activity/gap model.

| Pillar | Proposed stanza | Search question / output | Dimensions and drilldown | Primary TA/app | Sourcetypes | Phase |
|---|---|---|---|---|---|---|
| Zero Trust Access | `secure_networking_zta_auth_outcome_trend` | Are access attempts succeeding or failing over time? Output timechart/table by auth outcome. | site, ISE node, network device, identity, reason, policy set | TA_cisco_catalyst / ISE | `cisco:ise:syslog` | P1 |
| Zero Trust Access | `secure_networking_zta_failure_reasons_by_site` | Why are identities failing access? Output ranked failure reasons by site/device. | site, NetworkDeviceName, FailureReason, user, endpoint MAC | TA_cisco_catalyst / ISE | `cisco:ise:syslog` | P1 |
| Zero Trust Access | `secure_networking_zta_radius_node_health_by_site` | Which ISE/RADIUS nodes are slow, failing, or not receiving traffic? | ISE host, site, request count, failure rate, latency where present | TA_cisco_catalyst / ISE | `cisco:ise:syslog`, ISE policy sourcetypes | P1 |
| Zero Trust Access | `secure_networking_zta_ravpn_sessions_by_profile` | Who is using remote access VPN and where are session failures/disconnects? | vpn_profile, session_type, security_group_tag, assigned_ip, disconnection_reason | Cisco Secure Access / cloud security | `cisco:cloud_security:ravpn`, `cisco:secure_access:security_events_ravpn` | Built 2026-07-21 |
| Zero Trust Access | `secure_networking_zta_ravpn_failure_reasons` | Why are RaVPN sessions failing or warning? | vpn_profile, region, host, event_type, failed_reasons, asa_syslog_id | Cisco Secure Access / cloud security | `cisco:cloud_security:ravpn` | Built 2026-07-21 |
| Zero Trust Access | `secure_networking_zta_ztna_app_access_summary` | Which private apps are being accessed through ZTNA and by whom? | app, user, connector, policy, action, location | Cisco Secure Access | `cisco:cloud_security:ztna`, `cisco:cloud_security:ztnaflow`, `cisco:secure_access:security_events_ztna` | P1 |
| Zero Trust Access | `secure_networking_zta_wifi_auth_method_by_ssid` | Which SSIDs are open, WPA2, WPA3, guest, or enterprise auth? | org, network, SSID, auth mode, encryption, site | Meraki | Needs Meraki Wireless SSIDs API input | P1-TA |
| Zero Trust Access | `secure_networking_zta_guest_wifi_location_risk` | Are guest/open WiFi clients showing risky location or usage patterns? | SSID, client, site, location zone, duration, traffic volume | Meraki plus Spaces | Meraki client data plus Spaces firehose | P2 |
| Secure Infrastructure | `secure_networking_secure_infra_status_rollup` | What is the infrastructure health and readiness summary by site? | site, product family, online status, software family, advisory count | Catalyst Center, Meraki, SD-WAN | `cisco:dnac:*`, `meraki:*`, `cisco:sdwan:*` | P1 |
| Secure Infrastructure | `secure_networking_psirt_exposure_by_site_family` | Which sites/device families have critical or high advisories? | advisory ID, severity, product family, software version, site | Catalyst Center | `cisco:dnac:securityadvisory` | P1 |
| Secure Infrastructure | `secure_networking_intersight_advisory_exposure` | Which UCS/compute objects have PSIRT/EOL/field-notice exposure? | account, affected object type, advisory type, severity, CVSS, CVEs | Cisco Intersight | `cisco:intersight:advisories` | Built 2026-07-21 |
| Secure Infrastructure | `secure_networking_ldos_eol_exposure_by_family` | Which devices are near or past LDOS/EoL? | product family, model, software version, site, EoL date | Catalyst Center plus EoL lookup | `cisco:catalyst:center:inventory:report`, `cisco:dnac:compliance` | P1-TA |
| Secure Infrastructure | `secure_networking_sdwan_site_view` | Which SD-WAN sites are healthy, degraded, or missing telemetry? | site, vEdge/cEdge, control status, tunnel status, app health | TA_cisco_catalyst / SD-WAN | `cisco:sdwan:*` | P1 |
| Secure Infrastructure | `secure_networking_device_hardening_code_level` | Which devices miss target hardened-code or secure config baseline? | site, model, software, baseline, exception | New lookup or config pipeline | No current TA-only source | P1-TA |
| Scalable Network Segmentation | `secure_networking_segmentation_status_rollup` | What is the segmentation adoption summary by site? | site, devices, endpoints, SGT count, SGT-auth count, SGACL activity | ISE, Catalyst, SD-WAN | `cisco:ise:syslog`, `cisco:ise:securitygroups`, `cisco:sdwan:sgacl:logs` | P1 |
| Scalable Network Segmentation | `secure_networking_security_groups_catalog` | What SGTs/security groups exist and when were they last seen? | SGT ID, SGT name, description, source platform, last_seen | TA_cisco_catalyst / ISE | `cisco:ise:securitygroups`, `cisco:ise:syslog` | P1-data |
| Scalable Network Segmentation | `secure_networking_sgt_distribution_by_site_device` | Which sites/devices are assigning which SGTs? | site, NetworkDeviceName, security_group_tag, auth count, endpoint count | TA_cisco_catalyst / ISE | `cisco:ise:syslog`, `cisco:ise:sgtbindings` | P1 |
| Scalable Network Segmentation | `secure_networking_sgt_binding_inventory` | Which IP prefixes are bound to which SGTs and learned through which SXP paths? | SGT, binding type, SXP domain, source node, peer path, bound prefix | TA_cisco_catalyst / ISE | `cisco:ise:sgtbindings` | Built 2026-07-21 |
| Scalable Network Segmentation | `secure_networking_sgt_default_fallback_rate` | How often do endpoints fall into default or catch-all SGTs? | site, device, default tag, explicit tag, endpoint MAC | ISE plus SGT reference lookup | `cisco:ise:syslog`, `cisco:ise:securitygroups` | P1-data |
| Scalable Network Segmentation | `secure_networking_sgacl_deny_pairs` | Which source SGT to destination SGT pairs are being denied? | source SGT, destination SGT, action, protocol, device, ingress interface | TA_cisco_catalyst / SD-WAN SGACL | `cisco:sdwan:sgacl:logs` | P1-data |
| Scalable Network Segmentation | `secure_networking_sgacl_enforcement_activity_trend` | Is role-based policy being enforced over time? | time, action, source SGT, destination SGT, enforcement device | TA_cisco_catalyst / SD-WAN SGACL | `cisco:sdwan:sgacl:logs` | P1-data |
| Scalable Network Segmentation | `secure_networking_sgacl_policy_matrix` | What does the current SGT policy matrix look like? | source SGT, destination SGT, permit/deny, hit count | ISE plus SGACL logs | `cisco:ise:securitygroups`, `cisco:sdwan:sgacl:logs` | P1-data |
| Scalable Network Segmentation | `secure_networking_enforcement_points_by_site` | Where is segmentation enforcement happening, and where is it absent? | site, device, enforcement type, hit count, last_seen | ISE, SD-WAN, firewall | `cisco:ise:*`, `cisco:sdwan:sgacl:logs`, firewall logs | P1 |
| Scalable Network Segmentation | `secure_networking_vrf_vlan_vxlan_adoption_by_site` | How far along is each site in the segmentation journey? | site, VRF count, VLAN count, VXLAN/VNI count, SGT count | Catalyst, DC Networking | `cisco:dnac:*`, `cisco:dc:*`, `cisco:ise:*` | P1 |
| Hybrid Mesh Firewalling | `secure_networking_hmf_enforcement_coverage_by_site` | Which sites have firewall/enforcement coverage, and which do not? | site, MX, Secure Router, FTD/ASA, SSE, MCD, coverage status | Meraki, Catalyst, Secure Access, CiscoSecurityCloud | `meraki:*`, `cisco:sdwan:*`, `cisco:cloud_security:*`, firewall sourcetypes | P1 |
| Hybrid Mesh Firewalling | `secure_networking_hmf_unified_blocks_trend` | What is being blocked across Meraki, firewall, Secure Access, and MCD? | time, platform, action, category, policy, source/destination | Multiple security TAs | `meraki:*`, `cisco:asa`, `cisco:ftd:syslog`, `cisco:cloud_security:firewall`, MCD sourcetypes | P1 |
| Hybrid Mesh Firewalling | `secure_networking_secure_access_dlp_findings` | What sensitive data is Secure Access DLP detecting or blocking? | severity, action, rule, data classification, data identifier, application, direction | Cisco Secure Access / cloud security | `cisco:cloud_security:dlp` | Built 2026-07-21 |
| Hybrid Mesh Firewalling | `secure_networking_hmf_policy_hits_by_platform` | Which distributed firewall policies are active or unused? | platform, policy, rule, action, hits, last_seen | CiscoSecurityCloud, Secure Access, Meraki | firewall, Secure Access firewall/proxy, Meraki security appliances | P1 |
| Hybrid Mesh Firewalling | `secure_networking_hmf_blocks_by_source_sgt` | Are firewall blocks tied back to source SGT or identity? | source SGT, identity, source IP, destination, policy, platform | ISE plus firewall logs | firewall logs enriched with SGT, ISE auth context | P1-data |
| Hybrid Mesh Firewalling | `secure_networking_hmf_unprotected_sites` | Where is a site missing firewall, ACL, or SSE enforcement? | site, device count, enforcement present, enforcement missing | Inventory plus firewall/SSE feeds | inventory plus security event feeds | P1 |
| Agentic Ops | `secure_networking_agentic_source_health_matrix` | Are the telemetry sources needed for agent-assisted operations healthy? | source, pillar, latest event, stale threshold, owner | Multiple | all SN sourcetypes | P1 |
| Agentic Ops | `secure_networking_agentic_sn_baselines` | What are the normal baselines for clients, RaVPN sessions, guest access, and devices? | metric, site, baseline, current, delta | Meraki, ISE, Secure Access | `meraki:*`, `cisco:ise:*`, RaVPN sourcetypes | P1-data |
| Agentic Ops | `secure_networking_agentic_thousandeyes_coverage` | Where do we have ThousandEyes assurance tests covering SN paths? | site, test, agent, target, status | ThousandEyes | `cisco:thousandeyes:*` | P1 |
| Agentic Ops | `secure_networking_agentic_ai_defense_notables` | Which AI Defense events/notables can feed the Secure Networking story? | notable, severity, policy, workload/app, status | CiscoSecurityCloud | `cisco:ai:defense`, `cisco:ai:defense:notable` | P2 |
| Agentic Ops | `secure_networking_agentic_workflow_usage` | Are workflows/agents being used and helping operations? | workflow, user, org, success, revert, related incident | New workflow integration | No TA today | P2 |

## Searches that are searchbase-worthy, but not yet searchbase-ready

These should not become real stanzas until collection or demo data exists. Keep them visible because they are central to Steven's desired narrative.

| Pillar | Desired search | Why it matters | Blocker |
|---|---|---|---|
| Scalable Network Segmentation | TrustSec/CTS global config compliance | Answers whether segmentation is actually configured on the boxes | Needs device running-config or CLI collection, not a current shipping TA |
| Scalable Network Segmentation | Access/uplink/AP port TrustSec config compliance | Shows rollout gaps at the interface level | Needs config scrape plus neighbor/CDP context |
| Scalable Network Segmentation | SGACL hit counters every 90 seconds | Steven's strongest "doing work" metric for segmentation | Needs `cisco:sdwan:sgacl:logs` or equivalent sample/live feed |
| Scalable Network Segmentation | Endpoint CMDB coverage and SGT mismatch | Shows identity-to-asset completeness and policy correctness | Needs MAC overlap among ISE, CMDB, and authoritative SGT reference |
| Secure Infrastructure | TPM/SUDI/Secure Boot/PQC status | True hardware trust posture | Needs Cisco IQ or another authoritative source |
| Secure Infrastructure | MACSec/IPSec/TLS crypto posture | Strong secure infrastructure story | Needs CLI/API collection beyond current TAs |
| Zero Trust Access | Meraki SSID auth mode | Steven explicitly called out open/guest/WPA posture | Needs Meraki Wireless SSIDs API input in TA or synthetic demo source |
| Hybrid Mesh Firewalling | SCC-connected vs. not connected | Helpful for mesh coverage, but not available today | SCC is roadmap/not-supported in current catalog |
| Agentic Ops | Workflow usage and efficacy | Eventually proves agent-assisted operations | Needs workflow API integration and owner decision |

## Recommended build order

1. Build `secure_networking_source_health_by_pillar` and `secure_networking_site_inventory_rollup` first. They will make the five new drill-down dashboards more honest, because every empty panel can show whether the data source is absent or just quiet.
2. Build the ZTA ISE auth trio next: `secure_networking_zta_auth_outcome_trend`, `secure_networking_zta_failure_reasons_by_site`, and `secure_networking_zta_radius_node_health_by_site`.
3. Build the Segmentation adoption set: `secure_networking_segmentation_status_rollup`, `secure_networking_sgt_distribution_by_site_device`, `secure_networking_security_groups_catalog`, and `secure_networking_enforcement_points_by_site`.
4. Build the HMF coverage/activity set: `secure_networking_hmf_enforcement_coverage_by_site`, `secure_networking_hmf_unified_blocks_trend`, and `secure_networking_hmf_policy_hits_by_platform`.
5. Build Secure Infrastructure rollups that do not need Cisco IQ first: `secure_networking_secure_infra_status_rollup`, `secure_networking_psirt_exposure_by_site_family`, and `secure_networking_sdwan_site_view`.
6. Demo data has landed for RaVPN, DLP, SGT bindings, and Intersight advisories; those stanzas are built and live-export validated for syntax/runtime. Next step is making the sample files visible in indexed `/opt/10` searches so result-shape validation returns rows.
7. Keep the CLI/config/IQ items out of normal searchbase implementation until the team decides whether to build a TA, a custom pipeline, or synthetic demo sourcetypes.

## What this means for the five drill-down dashboards

| Dashboard section | First useful overview tab inputs | Later panel families |
|---|---|---|
| Zero Trust Access | Time selector, auth success/failure trend, failure reasons, RADIUS node health, RaVPN profile/failure tables | ZTNA app access, guest WiFi risk, WiFi auth method, Duo/Secure Endpoint posture |
| Secure Infrastructure | Time selector, health/readiness rollup, PSIRT exposure, software/LDOS groundwork, SD-WAN site view | MACSec, secure boot, TPM/SUDI, Broccoli/hardening, PQC |
| Scalable Network Segmentation | Time selector, segmentation status, SGT by site/device, security group catalog, policy hits, excessive/vendor MAC | SGACL matrix, deny pairs, endpoint CMDB coverage, config compliance |
| Hybrid Mesh Firewalling | Time selector, enforcement coverage by site, unified blocks trend, policy hits, unprotected sites | source-SGT firewall blocks, DC/MCD/Secure Workload joins, N/S and E/W policy views |
| Agentic Ops | Time selector, telemetry-source health, SN baselines, ThousandEyes coverage | AI Defense notables, workflow usage, AI-agent guardrails |

## Open decisions

| Decision | Owner / next step |
|---|---|
| Should demo-data-gen fabricate config-compliance and SGACL sourcetypes for GSX, or should those panels wait for real collection? | Amir plus demo-data owner |
| Which ISE TA is canonical for the app dependency list? | TA/app owners; avoid requiring three overlapping ISE TAs |
| Is the Meraki Wireless SSIDs API input in scope before GSX? | TA_cisco_meraki owner plus demo owner |
| Should Secure Infrastructure promote Intersight advisory exposure into the MVP dashboard, or keep it as an optional drilldown? | Anastasiya/Chris unless script changes |
| Which Agentic Ops panels are actually part of the Secure Networking demo script? | Chris/story owner |
| Should the newest 5 demo-data-backed searchbase additions be promoted into dashboard panels immediately, or wait for live export validation first? | Amir/code owner |
