# CIM migration status

Generated from `packages/splunk-cisco-dashboards/src/main/resources/splunk/default/searchbase.conf`.

## Summary

| Bucket | Stanzas |
|--------|--------:|
| `Network_Traffic` data model | 38 |
| `Authentication` data model | 31 |
| Raw `index_firewall` (no NT DM in stanza) | 37 |
| Raw identity / Windows / ISE syslog | 26 |

## Phase 2 posture

Per `artifacts/searchbase/cim/searchbase_cim_disposition.txt`, **all 136**
previously flagged raw CIM candidates are intentionally **skipped**
(product-specific fields, composites,
rex on `_raw`, multi-index unions, readiness probes). Production firewall and
identity KPIs already use `tstats` + `scd_summariesonly` on CIM.

## Remaining raw firewall stanzas

- `admin_macro_index_tuning`
- `asset_inventory_gap_analysis`
- `cisco_live_event_ops_onboarding_gap_summary`
- `cisco_live_event_ops_preflight_coverage_matrix`
- `cisco_live_ftd_readiness_advanced_feed_health`
- `dashboard_security_v1_base_fw_ref`
- `dashboard_security_v1_fw_trend`
- `escu_alert_asa_logging_disabled`
- `escu_alert_asa_privilege_escalation`
- `escu_alert_asa_recon_commands`
- `executive_dashboard_data_source_status`
- `executive_dashboard_threat_sources_with_baseline`
- `feed_monitor_all_feeds_health_matrix`
- `feed_monitor_fmc_estreamer_staleness`
- `feed_monitor_ftd_firewall_staleness`
- `network_intelligence_ftd_anomalous_sessions`
- `network_intelligence_ftd_dns_https_svcb_queries`
- `network_intelligence_ftd_dns_rejected_domains`
- `network_intelligence_ftd_http_error_pressure`
- `network_intelligence_ftd_risky_protocol_app_usage`
- `security_multicloud_defense_action_breakdown_kpi`
- `security_multicloud_defense_audit_timeline`
- `security_multicloud_defense_dlp_av_findings`
- `security_multicloud_defense_gateway_health_table`
- `security_multicloud_defense_threat_type_distribution`
- `security_multicloud_defense_top_blocked_apps`
- `security_multicloud_defense_url_fqdn_blocks`
- `security_multicloud_defense_waf_findings`
- `security_operations_dns_tunnel_beacon_cadence`
- `security_operations_soc_telemetry_data_quality_health`
- `security_resilience_ds_base_fw`
- `security_resilience_ds_security_events`
- `security_resilience_ftd_connection_reason_pressure`
- `security_resilience_ftd_file_risk_inventory`
- `security_resilience_ftd_intrusionpacket_burst_summary`
- `security_resilience_recent_security_events`
- `security_resilience_vpn_session_detail`

## Remaining raw identity stanzas (sample)

- `building_resilience_wireless_device_trust_summary`
- `building_resilience_wireless_devices_to_review`
- `building_resilience_wireless_devices_to_review_count`
- `cisco_live_ise_readiness_event_wifi_auth`
- `dashboard_building_v1_trust_review_count`
- `dashboard_it_health_v1_ise_device_logins`
- `dashboard_security_v1_identity_detail_trend`
- `dashboard_security_v1_ise_auth`
- `dashboard_security_v1_ise_fail_trend`
- `dashboard_security_v1_kpi_ise_fail`
- `dashboard_security_v1_priv_trend`
- `executive_dashboard_failed_logon_with_baseline`
- `executive_dashboard_security_domain_score`
- `executive_dashboard_security_domain_score_drilldown`
- `feed_monitor_ise_syslog_staleness`
- `security_operations_lateral_movement_identity_network_pivots`
- `security_resilience_ds_ise_by_nas`
- `security_resilience_ds_ise_failure_reasons`
- `security_resilience_ds_lockout_detail`
- `security_resilience_ise_cpu_utilization`
- `security_resilience_ise_disk_utilization`
- `security_resilience_ise_memory_utilization`
- `security_resilience_ise_node_inventory`
- `security_resilience_ise_radius_latency`
- `security_resilience_ise_tacacs_latency`
- `user_experience_ise_guest_auth_rate`

## Disposition footer

> 
> ======================================================================
> TOTAL candidates: 136   SKIP: 136   REVIEW (unresolved): 0

## Next CIM work (when needed)

1. Leave hidden Dashboard Studio reconciliation stanzas raw (byte parity).
2. Add `_dm` readiness twins rather than rewriting ESCU / FTD detail panels.
3. Re-run this audit after any new firewall or identity panels land.
