# DC Networking Searchbase Consolidation — Decision Ledger

Generated during the SKILL.md-driven re-audit of `searchbase.conf` (2026-08-03). Scope: all 314 `dc_networking_*` stanzas, reviewed by 5 independent agents against the "Independent Catalog Value Gate" and "Representative Example Consolidation" rules in `.github/skills/audit-searchbase-catalog/SKILL.md`.

**Reference-check method**: every candidate below was grepped repo-wide (all dashboard XML, `savedsearches.conf`, every `drilldown_search_name` value in `searchbase.conf`, in both directions). Result: **zero live consumer references found for any of the 89 stanzas listed below** — every hit outside `searchbase.conf` itself traced to generated/provenance artifacts (`docs/searchbase_review_report.json`, `docs/searchbase-dashboard-unmatched.csv`, `packages/splunk-cisco-dashboards/exports/searchbase_export*.conf`, `scripts/curate_dc_networking_searchbase.py`), none of which are live consumers.

Net effect if applied: 314 → 225 `dc_networking_*` stanzas (28% reduction), 1255 → 1166 total catalog stanzas.

## A. REVIEW DELETE (26) — independently fails the value gate, no keeper needed

| Stanza ID | Reason |
|---|---|
| `dc_networking_schemas_application_profiles` | Naked `dc(templates_anps_name)`, no rename/by/context |
| `dc_networking_schemas_bridge_domain` | Naked `dc(templates_bds_name)`, no context |
| `dc_networking_schemas_contracts` | Naked `dc(templates_contracts_name)`, no context |
| `dc_networking_schemas_external_endpoint_group` | Naked `dc(templates_externalEpgs_name)`, no context |
| `dc_networking_schemas_filters` | Naked `dc(templates_filters_name)`, no context |
| `dc_networking_schemas_vrf` | Naked `dc(templates_vrfs_name)`, no context |
| `dc_networking_orchestrator_overview_epgs_count` | Naked `stats dc(epg)`, no context |
| `dc_networking_orchestrator_overview_schema_count` | Naked `stats dc(id)`, no context |
| `dc_networking_tenant_details_tenant_faults` | Naked `dc(eval(...))`, no rename/by, ugly default label |
| `dc_networking_home_rare_mnemonics` | Byte-identical SPL to `dc_networking_home_top_mnemonics` — exact duplicate, "rare" label is misleading |
| `dc_networking_advisories_advisory` | `tstats` with no `by` clause — aggregates across every advisory, not one; broken single-item drilldown whose token was neutralized |
| `dc_networking_anomalies_anomaly` | Same defect as above for anomalies |
| `dc_networking_home_vms` | Naked `dc(classInfo.VM_Relation.VirtualMachine)`, no context |
| `dc_networking_congestion_average_value_recorded` | Bare fleet-wide `avg(event_value)`, no `by`, subsumed by `..._congestion_details_by_fabric_switch_and_interface` |
| `dc_networking_congestion_maximum_value_recorded` | Same, `max()` |
| `dc_networking_congestion_minimum_value_recorded` | Same, `min()` |
| `dc_networking_n9k_syslog_configuration_events_by_target_ip_over_time` | Thin single-dimension trend, superseded by `..._recent_configuration_events` detail search |
| `dc_networking_n9k_syslog_configuration_events_by_user_over_time` | Same |
| `dc_networking_flow_overview_flow_drop_count` | `\| fields - flows.stats_dropReasons` strips its own grouping label — broken/ambiguous; `..._flow_drop_trend` is the working version |
| `dc_networking_host_traffics_host_traffic_count` | Final `timechart count` (no `by`) discards the host split the name promises |
| `dc_networking_power_actual_power_drawn_over_time` | `split("","::")` splits a literal empty string — `where` clause can never match; non-functional |
| `dc_networking_flow_overview_max_latency_s` | `by _time, flowId` with no reduction — returns many rows, not a single max value |
| `dc_networking_all_interfaces_details_receive_statistics_packets_per_second` | Self-documented always-empty result (neutralized token compared against itself) |
| `dc_networking_all_interfaces_details_transmit_statistics_packets_per_second` | Same defect, mirror direction |
| `dc_networking_users_roles` | Name/endpoint promise role data; actual output is 2 unrelated UI preference booleans |
| `dc_networking_interface_stats_total_number_of_interfaces` | Bare inventory total, duplicates `..._interface_inventory_overview` |

## B. MERGE (63 siblings → 33 keepers) — Representative Example Consolidation

Each keeper survives unchanged (or with a `related_info` customization note below); each sibling is removed as a pure entity/component/direction substitution of the keeper with no unique output.

| Keeper (survives) | Customization note to add to keeper's `related_info` | Siblings removed |
|---|---|---|
| `dc_networking_bridge_domain_count_trend_by_tenant` | Swap component=fvBD for vzBrCP (contracts), fvAEPg (EPGs), vzFilter (filters), or l3extOut (L3Out) | `dc_networking_contract_count_trend_by_tenant`, `dc_networking_epg_count_trend_by_tenant`, `dc_networking_filter_count_trend_by_tenant`, `dc_networking_l3out_network_count_trend_by_tenant` |
| `dc_networking_change_tenant_threshold_current_tenant_threshold_statistics` | Swap the tenantThreshold.csv lookup for bdThreshold/contractsThreshold/epgThreshold/filtersThreshold/l3outnetworksThreshold.csv | `dc_networking_change_bridge_domain_threshold_current_bridge_domain_threshold_statistics`, `dc_networking_change_contract_threshold_current_contract_threshold_statistics`, `dc_networking_change_epg_threshold_current_epg_threshold_statistics`, `dc_networking_change_filters_threshold_current_filters_threshold_statistics`, `dc_networking_change_l3out_network_threshold_current_l3out_network_threshold_statistics` |
| `dc_networking_system_threshold_tenant_threshold_gauge` | Swap component/lookup for bridge domain, contracts, EPG, filters, or L3Out equivalents | `dc_networking_system_threshold_bridge_domain_threshold_gauge`, `dc_networking_system_threshold_contracts_threshold_gauge`, `dc_networking_system_threshold_epg_threshold_gauge`, `dc_networking_system_threshold_filters_threshold_gauge`, `dc_networking_system_threshold_l3out_networks_threshold_gauge` |
| `dc_networking_schemas_bridge_domain_fault_details` | Swap `bds_faults_*` prefix for `anps_faults_*`/`contracts_faults_*`/`externalEpgs_faults_*`/`vrfs_faults_*` | `dc_networking_schemas_application_profile_fault_details`, `dc_networking_schemas_contracts_fault_details`, `dc_networking_schemas_external_endpoint_group_fault_details`, `dc_networking_schemas_vrf_fault_details` |
| `dc_networking_schemas_bridge_domain_health_details` | Swap `bds_bdRef`/`bds_health_score` for the anps/externalEpgs/vrfs equivalents | `dc_networking_schemas_application_profile_health_details`, `dc_networking_schemas_external_endpoint_group_health_details`, `dc_networking_schemas_vrf_health_details` |
| `dc_networking_tenants_audit_logs` | Swap `type=tenant` for `type=policy`/`type=schema` | `dc_networking_policy_audit_logs`, `dc_networking_schemas_audit_logs` |
| `dc_networking_epg_details_list_of_all_epgs` | — | `dc_networking_epg_details_epgs_by_tenant_and_application_profile` |
| `dc_networking_epg_details_client_endpoints_by_tenant` | Add `join Tenant,App,EPG [... isAttrBasedEPg=yes ...]` for the microsegmented-only view | `dc_networking_microsegmentation_client_endpoints` |
| `dc_networking_physical_inventory_fabric_module` | Swap the `like(productid/desc,...)` filter for line cards, supervisor modules, or system controllers | `dc_networking_physical_inventory_line_cards`, `dc_networking_physical_inventory_supervisor_module`, `dc_networking_physical_inventory_system_controllers` |
| `dc_networking_physical_inventory_power_supply` | Swap filter for fan modules | `dc_networking_physical_inventory_fan_module` |
| `dc_networking_system_faults_faults_by_type_over_time` | Swap `by type` for `by domain`/`node`/`tenant`/`cause`/`rule` | `dc_networking_system_faults_faults_by_domain_over_time`, `dc_networking_system_faults_faults_by_node_over_time`, `dc_networking_system_faults_faults_by_tenant_over_time`, `dc_networking_system_faults_top_faults_by_cause_over_time`, `dc_networking_system_faults_top_faults_by_rule_over_time` |
| `dc_networking_home_bridge_domain` | Swap `component=fvBD` for fvAp/vzBrCP/fvAEPg/vzFilter/l3extOut | `dc_networking_home_applications`, `dc_networking_home_contracts`, `dc_networking_home_epg`, `dc_networking_home_filters`, `dc_networking_home_l3out_networks` |
| `dc_networking_fabric_details_health_fault_details_leafs` | Swap `Role=leaf` for `Role=spine` | `dc_networking_fabric_details_health_fault_details_spines` |
| `dc_networking_fabric_details_leafs_port_utilization_and_thresholds` | Swap `role=leaf` for `role=spine` | `dc_networking_fabric_details_spines_port_utilization_and_thresholds` |
| `dc_networking_fabric_details_top_affected_leafs` | Swap `Role=leaf` for `Role=spine` | `dc_networking_fabric_details_top_affected_spines` |
| `dc_networking_multi_pod_top_10_affected_leafs_by_health_score` | Swap `node="*leaf*"` for `node="*spine*"` | `dc_networking_multi_pod_top_10_affected_spines_by_health_score` |
| `dc_networking_leaf_switch_count_trend_by_pod` | Swap `role=leaf` for `role=spine` | `dc_networking_spine_switch_count_trend_by_pod` |
| `dc_networking_acl_logs_acl_l3_drop_pkts` | Swap component for `acllogDropL2Pkt` | `dc_networking_acl_logs_acl_l2_drop_pkts` |
| `dc_networking_acl_logs_acl_l3_permit_pkts` | Swap component for `acllogPermitL2Pkt` | `dc_networking_acl_logs_acl_l2_permit_pkts` |
| `dc_networking_acl_logs_l3_drop` | Swap component for the L2 equivalent | `dc_networking_acl_logs_l2_drop` |
| `dc_networking_acl_logs_l3_permit` | Swap component for the L2 equivalent | `dc_networking_acl_logs_l2_permit` |
| `dc_networking_acl_logs_l3_drop_packets_by_node` | Swap component for the L2 equivalent | `dc_networking_acl_logs_l2_drop_packets_by_node` |
| `dc_networking_acl_logs_l3_permit_packets_by_node` | Swap component for the L2 equivalent | `dc_networking_acl_logs_l2_permit_packets_by_node` |
| `dc_networking_acl_logs_l3_drop_packets_by_tenant` | Swap component for the L2 equivalent | `dc_networking_acl_logs_l2_drop_packets_by_tenant` |
| `dc_networking_acl_logs_l3_permit_packets_by_tenant` | Swap component for the L2 equivalent | `dc_networking_acl_logs_l2_permit_packets_by_tenant` |
| `dc_networking_fabric_details_tcam_percentage_threshold_statistics` | — (strictly richer than sibling: adds Max Threshold field) | `dc_networking_change_tcam_threshold_current_tcam_threshold_statistics` |
| `dc_networking_fabric_extenders_detail_line_card` | Swap join/component filter for supervisor card or fan tray | `dc_networking_fabric_extenders_detail_supervisor_card`, `dc_networking_fabric_extenders_detail_fex_id_fan_tray` |
| `dc_networking_fabric_extenders_detail_fex_id_sensors` | Swap component for `eqptExtChFP`/`eqptExtChHP` | `dc_networking_fabric_extenders_detail_fex_id_fabric_port`, `dc_networking_fabric_extenders_detail_fex_id_host_port` |
| `dc_networking_flow_overview_flow_trend` | — (trend is strictly more general than a point total) | `dc_networking_flow_overview_total_flows` |
| `dc_networking_flow_search_flows` | — (identical output contract to sibling, from a different source dashboard) | `dc_networking_host_traffics_host_s` |
| `dc_networking_single_interface_details_input_packet_rate_packets_per_second_history` | Swap `avg(Input Rate)` for `avg(Output Rate)` | `dc_networking_single_interface_details_output_packet_rate_packets_per_second_history` |
| `dc_networking_single_interface_details_input_packets_history` | Swap input packet-type fields for output equivalents | `dc_networking_single_interface_details_output_packets_summary` |
| `dc_networking_all_users_user_details` | Filter `Type="Local User"` or `Type="Remote User"` to reproduce each sibling's scope | `dc_networking_local_users_user_details`, `dc_networking_remote_user_user_details` |

## C. Flagged for follow-up (not deletion candidates — correctness/fidelity notes only)

- `dc_networking_faults_transition_faults_repeated_often_detail` — name promises repeat-count/frequency but SPL has no such computation; content is otherwise valid (KEEP), rename or logic fix recommended.
- `dc_networking_flow_overview_top_50_flow_latency` — name promises "Top 50" but SPL has no `sort`/`head`/limit at all; unranked, unbounded result set (Deterministic Top-N defect).
- `dc_networking_interface_stats_top_10_anomalous_nodes` — same defect class: "Top 10" promised, no ranking/limit present.
- `dc_networking_fault_report` vs `dc_networking_system_faults_faults_by_severity_detail` — both query `Cisco_DCN_Fault` with different enrichment paths (lookup-based vs. data-model `latest()`); genuine overlap, but which is authoritative needs more evidence — left unresolved.
- `dc_networking_home_applications` (in the Home ACI Object Counts family above) has a latent correctness bug independent of the merge: its `stats` clause groups `by dn` only, omitting `apic_host` (risk of cross-site collapse) — moot once merged into the keeper, noted here in case the merge is deferred.

## Execution status

Not yet applied. Bulk removal via a Bash script was blocked by the Claude Code permission classifier (writes to this file are gated); execution requires either an explicit Bash permission grant or per-stanza edits through the Edit tool.
