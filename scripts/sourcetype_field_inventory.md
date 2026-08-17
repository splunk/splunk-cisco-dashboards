# Sourcetype Field Inventory

**Generated:** `2026-05-23T11:07:24-0400`  **Window:** `-7d` → `now`  **Sample:** `head 10000` per sourcetype

Authoritative field set for every sourcetype referenced in `searchbase.conf`, discovered live via Splunk's `field_list` macro. Use this as ground truth when reviewing SPL — any field referenced by a stanza that isn't in the matching sourcetype's table below is suspect.

## Summary

| Status | Count | Meaning |
|---|---:|---|
| `pass`    |   0 | Returned at least one field. |
| `empty`   |   0 | Sourcetype has no events in the time window. |
| `fail`    |  42 | Search errored — see note. |
| `skipped` |   0 | Excluded by filter. |

## Sourcetypes by Stanza Count

| Sourcetype | Stanzas | Status | Field Count |
|---|---:|---|---:|
| `cisco:dnac:devicehealth` | 67 | `fail` | 0 |
| `cisco:dnac:client` | 37 | `fail` | 0 |
| `cisco:ios` | 36 | `fail` | 0 |
| `cisco:spaces:firehose` | 33 | `fail` | 0 |
| `cisco:ise:syslog` | 30 | `fail` | 0 |
| `cisco:asa` | 29 | `fail` | 0 |
| `cisco:dnac:clienthealth` | 26 | `fail` | 0 |
| `cisco:sfw:estreamer` | 25 | `fail` | 0 |
| `cisco:dnac:issue` | 24 | `fail` | 0 |
| `cisco:ftd` | 24 | `fail` | 0 |
| `cisco:dnac:networkhealth` | 11 | `fail` | 0 |
| `cisco:xdr:incidents` | 10 | `fail` | 0 |
| `cisco:xdr:incidents-summary` | 10 | `fail` | 0 |
| `cisco:dnac:compliance` | 9 | `fail` | 0 |
| `meraki:sensorreadingshistory` | 9 | `fail` | 0 |
| `DhcpSrvLog` | 8 | `fail` | 0 |
| `meraki:devicesuplinkslossandlatency` | 6 | `fail` | 0 |
| `cisco:cloud_security:dns` | 5 | `fail` | 0 |
| `cisco:dnac:audit:logs` | 4 | `fail` | 0 |
| `cisco:dnac:securityadvisory` | 4 | `fail` | 0 |
| `cisco:sdwan:utd:logs` | 4 | `fail` | 0 |
| `cisco:thousandeyes:alerts` | 4 | `fail` | 0 |
| `cisco:catalyst:center:compliance:report` | 3 | `fail` | 0 |
| `cisco:catalyst:center:inventory:report` | 3 | `fail` | 0 |
| `cisco:cloud_security:firewall` | 3 | `fail` | 0 |
| `cisco:esa:amp` | 3 | `fail` | 0 |
| `cisco:esa:antispam` | 3 | `fail` | 0 |
| `cisco:esa:content_scanner` | 3 | `fail` | 0 |
| `cisco:estreamer:data` | 3 | `fail` | 0 |
| `cisco:sdwan:linkhealth` | 3 | `fail` | 0 |
| `ActiveDirectory` | 2 | `fail` | 0 |
| `MSAD:NT6:DNS` | 2 | `fail` | 0 |
| `cisco:firepower:syslog` | 2 | `fail` | 0 |
| `cisco:thousandeyes:metric` | 2 | `fail` | 0 |
| `cisco:thousandeyes:trace` | 2 | `fail` | 0 |
| `cisco:wsa:l4tm` | 2 | `fail` | 0 |
| `cisco:wsa:squid` | 2 | `fail` | 0 |
| `ms:defender:endpoint:alerts` | 2 | `fail` | 0 |
| `cisco:estreamer:log` | 1 | `fail` | 0 |
| `cisco:estreamer:status` | 1 | `fail` | 0 |
| `cisco:ucs` | 1 | `fail` | 0 |
| `meraki:audit` | 1 | `fail` | 0 |

## Per-Sourcetype Field Lists

### `ActiveDirectory`

- **Status:** `fail`  **Field count:** 0  **Stanzas referencing:** 2  **Latency:** 37 ms
- **Note:** Expecting value: line 1 column 1 (char 0)

**Stanzas using this sourcetype**

- `[admin_macro_index_tuning]` (line 5722)
- `[asset_inventory_ds_gap_analysis]` (line 6983)

### `DhcpSrvLog`

- **Status:** `fail`  **Field count:** 0  **Stanzas referencing:** 8  **Latency:** 35 ms
- **Note:** Expecting value: line 1 column 1 (char 0)

**Stanzas using this sourcetype**

- `[admin_macro_index_tuning]` (line 5722)
- `[asset_inventory_ds_gap_analysis]` (line 6983)
- `[it_critical_systems_dhcp_lease_rate]` (line 3573)
- `[it_critical_systems_dhcp_nack_trend]` (line 3599)
- `[it_critical_systems_dhcp_pool_exhaustion]` (line 3547)
- `[it_critical_systems_dhcp_scope_utilization]` (line 3624)
- `[it_critical_systems_ds_dhcp_pool_exhaustion]` (line 8260)
- `[it_critical_systems_ds_dhcp_scope_utilization]` (line 8284)

### `MSAD:NT6:DNS`

- **Status:** `fail`  **Field count:** 0  **Stanzas referencing:** 2  **Latency:** 35 ms
- **Note:** Expecting value: line 1 column 1 (char 0)

**Stanzas using this sourcetype**

- `[asset_inventory_ds_gap_analysis]` (line 6983)
- `[security_resilience_ds_base_dns]` (line 8742)

### `cisco:asa`

- **Status:** `fail`  **Field count:** 0  **Stanzas referencing:** 29  **Latency:** 34 ms
- **Note:** Expecting value: line 1 column 1 (char 0)

**Stanzas using this sourcetype**

- `[admin_macro_index_tuning]` (line 5722)
- `[asset_inventory_firewall_gap]` (line 4752)
- `[escu_alert_asa_logging_disabled]` (line 7420)
- `[escu_alert_asa_privilege_escalation]` (line 7442)
- `[escu_alert_asa_recon_commands]` (line 7465)
- `[escu_alert_fw_compromised_host_indicators]` (line 7488)
- `[escu_alert_fw_repeated_blocked_connections]` (line 7512)
- `[executive_dashboard_firewall_blocked_count]` (line 789)
- `[executive_dashboard_firewall_blocked_with_baseline]` (line 10642)
- `[executive_dashboard_fw_blocked_trend_compare]` (line 3186)
- `[executive_dashboard_threat_sources_with_baseline]` (line 10670)
- `[network_intelligence_blocked_vs_allowed]` (line 3273)
- `[network_intelligence_external_sources]` (line 3321)
- `[network_intelligence_geo_blocked_traffic]` (line 3370)
- `[network_intelligence_top_blocked_ports]` (line 3445)
- `[network_intelligence_top_countries_blocked]` (line 3395)
- `[network_intelligence_top_talkers]` (line 3420)
- `[network_intelligence_traffic_by_action_trend]` (line 3296)
- `[network_intelligence_traffic_by_protocol]` (line 3347)
- `[network_intelligence_traffic_volume_trend]` (line 3471)
- `[security_resilience_assets_at_risk]` (line 3494)
- `[security_resilience_data_exfiltration_indicators]` (line 2943)
- `[security_resilience_ds_base_fw]` (line 8760)
- `[security_resilience_ds_security_events]` (line 9224)
- `[security_resilience_firewall_allowed_count]` (line 1773)
- `[security_resilience_recent_security_events]` (line 2459)
- `[security_resilience_repeated_blocked_sources]` (line 2880)
- `[security_resilience_ssh_activity]` (line 2917)
- `[security_resilience_vpn_session_detail]` (line 2511)

### `cisco:catalyst:center:compliance:report`

- **Status:** `fail`  **Field count:** 0  **Stanzas referencing:** 3  **Latency:** 36 ms
- **Note:** Expecting value: line 1 column 1 (char 0)

**Stanzas using this sourcetype**

- `[it_critical_systems_compliance_report_noncompliant_detail]` (line 1315)
- `[it_critical_systems_compliance_report_rate]` (line 1264)
- `[it_critical_systems_compliance_report_status_distribution]` (line 1291)

### `cisco:catalyst:center:inventory:report`

- **Status:** `fail`  **Field count:** 0  **Stanzas referencing:** 3  **Latency:** 34 ms
- **Note:** Expecting value: line 1 column 1 (char 0)

**Stanzas using this sourcetype**

- `[it_critical_systems_inventory_device_family_distribution]` (line 1240)
- `[it_critical_systems_inventory_reachability_summary]` (line 1192)
- `[it_critical_systems_inventory_unreachable_detail]` (line 1216)

### `cisco:cloud_security:dns`

- **Status:** `fail`  **Field count:** 0  **Stanzas referencing:** 5  **Latency:** 6 ms
- **Note:** Expecting value: line 1 column 1 (char 0)

**Stanzas using this sourcetype**

- `[security_resilience_dns_blocked_categories]` (line 1610)
- `[security_resilience_dns_blocked_queries]` (line 1586)
- `[security_resilience_ds_dns_categories]` (line 8778)
- `[security_resilience_ds_security_events]` (line 9224)
- `[security_resilience_recent_security_events]` (line 2459)

### `cisco:cloud_security:firewall`

- **Status:** `fail`  **Field count:** 0  **Stanzas referencing:** 3  **Latency:** 6 ms
- **Note:** Expecting value: line 1 column 1 (char 0)

**Stanzas using this sourcetype**

- `[security_resilience_cloud_fw_blocked]` (line 1680)
- `[security_resilience_ds_security_events]` (line 9224)
- `[security_resilience_recent_security_events]` (line 2459)

### `cisco:dnac:audit:logs`

- **Status:** `fail`  **Field count:** 0  **Stanzas referencing:** 4  **Latency:** 5 ms
- **Note:** Expecting value: line 1 column 1 (char 0)

**Stanzas using this sourcetype**

- `[it_critical_systems_configuration_change_trend]` (line 1165)
- `[it_critical_systems_configuration_changes]` (line 1142)
- `[security_resilience_ds_security_events]` (line 9224)
- `[security_resilience_recent_security_events]` (line 2459)

### `cisco:dnac:client`

- **Status:** `fail`  **Field count:** 0  **Stanzas referencing:** 37  **Latency:** 5 ms
- **Note:** Expecting value: line 1 column 1 (char 0)

**Stanzas using this sourcetype**

- `[client_summary_client_by_band]` (line 4344)
- `[client_summary_client_by_device_type]` (line 4321)
- `[client_summary_client_by_protocol]` (line 4393)
- `[client_summary_client_by_ssid]` (line 4368)
- `[client_summary_client_onboarding]` (line 4464)
- `[client_summary_client_os_dist]` (line 4515)
- `[client_summary_ds_client_by_ssid]` (line 7181)
- `[client_summary_ds_client_os_dist]` (line 7203)
- `[client_summary_ds_client_session_by_band]` (line 7226)
- `[client_summary_ds_client_session_by_protocol]` (line 7250)
- `[client_summary_ds_client_session_by_ssid]` (line 7274)
- `[client_summary_ds_client_traffic_by_band]` (line 7299)
- `[client_summary_ds_client_traffic_by_protocol]` (line 7322)
- `[client_summary_ds_client_traffic_by_ssid]` (line 7346)
- `[client_summary_ds_top_clients_by_usage]` (line 7371)
- `[client_summary_ds_top_ssids_by_traffic]` (line 7395)
- `[client_summary_top_clients_by_usage]` (line 4488)
- `[clienthealth_by_site_lookup_join]` (line 10503)
- `[clients_by_building_lookup_join_demo]` (line 10478)
- `[executive_dashboard_active_clients]` (line 591)
- `[executive_dashboard_ds_active_clients]` (line 7604)
- `[network_operations_ssid_client_trend_24h]` (line 4658)
- `[security_resilience_unauthorized_wireless]` (line 2488)
- `[enterprise_client_ssid_drilldown]` (line 13008)
- `[enterprise_ds_ssid_client_trend_24h]` (line 9336)
- `[user_experience_client_health_distribution]` (line 5514)
- `[user_experience_client_onboarding_failures]` (line 5538)
- `[user_experience_client_peak_by_ssid]` (line 3727)
- `[user_experience_client_roaming_analysis]` (line 5561)
- `[user_experience_client_top_talkers]` (line 5585)
- `[user_experience_ds_base_client]` (line 9453)
- `[user_experience_ds_client_peak_by_ssid]` (line 9473)
- `[user_experience_ds_guest_client_surge]` (line 9494)
- `[user_experience_ds_top_ssids_by_clients]` (line 9540)
- `[user_experience_ds_wireless_signal_quality]` (line 9563)
- `[user_experience_guest_client_surge]` (line 3704)
- `[user_experience_top_ssids_by_clients]` (line 5609)

### `cisco:dnac:clienthealth`

- **Status:** `fail`  **Field count:** 0  **Stanzas referencing:** 26  **Latency:** 5 ms
- **Note:** Expecting value: line 1 column 1 (char 0)

**Stanzas using this sourcetype**

- `[client_summary_client_by_location]` (line 4297)
- `[client_summary_client_count_over_time]` (line 4246)
- `[client_summary_client_health_by_location]` (line 4539)
- `[client_summary_client_health_dist]` (line 4440)
- `[client_summary_client_health_kpi]` (line 4273)
- `[client_summary_wireless_vs_wired]` (line 4417)
- `[clienthealth_by_site_lookup_join]` (line 10503)
- `[executive_dashboard_ds_ux_score]` (line 7880)
- `[executive_dashboard_user_experience_domain_score]` (line 1012)
- `[executive_summary_client_health_by_site]` (line 4022)
- `[executive_summary_client_health_trend]` (line 4150)
- `[executive_summary_overall_client_health]` (line 4102)
- `[network_operations_wired_client_trend_24h]` (line 4635)
- `[network_operations_wired_health_kpi]` (line 4588)
- `[network_operations_wireless_client_trend_24h]` (line 4612)
- `[network_operations_wireless_health_kpi]` (line 4564)
- `[enterprise_client_wired_drilldown]` (line 12978)
- `[enterprise_client_wireless_drilldown]` (line 12948)
- `[enterprise_ds_wired_client_trend_24h]` (line 9359)
- `[enterprise_ds_wireless_client_trend_24h]` (line 9382)
- `[enterprise_ds_wireless_client_trend_7d]` (line 9405)
- `[user_experience_client_count_trend]` (line 3776)
- `[user_experience_client_health_by_type]` (line 2698)
- `[user_experience_client_health_trend]` (line 2671)
- `[user_experience_wired_client_health]` (line 2812)
- `[user_experience_wireless_client_health]` (line 2836)

### `cisco:dnac:compliance`

- **Status:** `fail`  **Field count:** 0  **Stanzas referencing:** 9  **Latency:** 5 ms
- **Note:** Expecting value: line 1 column 1 (char 0)

**Stanzas using this sourcetype**

- `[building_resilience_compliance_detail]` (line 24)
- `[executive_dashboard_building_domain_score]` (line 639)
- `[executive_dashboard_ds_bldg_score]` (line 7624)
- `[executive_dashboard_it_domain_score]` (line 845)
- `[it_critical_systems_compliance_distribution]` (line 1118)
- `[it_critical_systems_compliance_rate]` (line 1092)
- `[it_critical_systems_compliance_report]` (line 3971)
- `[security_resilience_compliance_distribution]` (line 5445)
- `[security_resilience_noncompliant_devices]` (line 5468)

### `cisco:dnac:devicehealth`

- **Status:** `fail`  **Field count:** 0  **Stanzas referencing:** 67  **Latency:** 7 ms
- **Note:** Expecting value: line 1 column 1 (char 0)

**Stanzas using this sourcetype**

- `[asset_inventory_ds_gap_analysis]` (line 6983)
- `[building_resilience_ds_ap_health_site]` (line 7062)
- `[executive_dashboard_building_domain_score]` (line 639)
- `[executive_dashboard_device_health_trend_compare]` (line 3244)
- `[executive_dashboard_ds_bldg_score]` (line 7624)
- `[executive_dashboard_ds_bldg_score_drilldown]` (line 12836)
- `[executive_dashboard_ds_device_health_current]` (line 7733)
- `[executive_dashboard_ds_device_health_current_drilldown]` (line 12415)
- `[executive_dashboard_ds_device_health_trend_compare]` (line 7760)
- `[executive_dashboard_ds_ux_score]` (line 7880)
- `[executive_dashboard_issue_summary_kpis]` (line 615)
- `[executive_dashboard_issue_summary_kpis_drilldown]` (line 12450)
- `[executive_dashboard_it_domain_score]` (line 845)
- `[executive_dashboard_user_experience_domain_score]` (line 1012)
- `[executive_summary_ap_count]` (line 4219)
- `[executive_summary_device_inventory]` (line 4050)
- `[executive_summary_ds_ap_count]` (line 7958)
- `[executive_summary_ds_device_inventory]` (line 7981)
- `[executive_summary_ds_healthy_device_count]` (line 8003)
- `[executive_summary_ds_network_health_by_site]` (line 8025)
- `[executive_summary_ds_network_health_trend]` (line 8048)
- `[executive_summary_ds_overall_network_health]` (line 8071)
- `[executive_summary_healthy_device_count]` (line 4682)
- `[executive_summary_issue_details]` (line 4810)
- `[executive_summary_network_health_by_site]` (line 3996)
- `[executive_summary_overall_network_health]` (line 4076)
- `[it_critical_systems_aaa_server_issues]` (line 3873)
- `[it_critical_systems_ap_air_quality_by_site]` (line 4914)
- `[it_critical_systems_ap_channel_utilization]` (line 4938)
- `[it_critical_systems_ap_count_by_location]` (line 1066)
- `[it_critical_systems_ap_disconnect_issues]` (line 3848)
- `[it_critical_systems_ap_interference_hotspots]` (line 4962)
- `[it_critical_systems_bgp_neighbor_issues]` (line 3823)
- `[it_critical_systems_cpu_memory_alerts]` (line 4984)
- `[it_critical_systems_device_health_distribution]` (line 5007)
- `[it_critical_systems_device_health_enriched]` (line 3519)
- `[it_critical_systems_device_health_score]` (line 1364)
- `[it_critical_systems_device_health_trend]` (line 1339)
- `[it_critical_systems_ds_ap_by_location]` (line 8093)
- `[it_critical_systems_ds_base_devicehealth]` (line 8118)
- `[it_critical_systems_ds_device_health]` (line 8187)
- `[it_critical_systems_ds_device_health_enriched]` (line 8211)
- `[it_critical_systems_ds_site_health]` (line 8425)
- `[it_critical_systems_ds_switch_by_location]` (line 8480)
- `[it_critical_systems_interface_utilization_issues]` (line 3798)
- `[it_critical_systems_issues_by_site]` (line 3922)
- `[it_critical_systems_recent_reboots]` (line 5224)
- `[it_critical_systems_site_connectivity_score_trend]` (line 10250)
- `[it_critical_systems_site_link_availability_pct_trend]` (line 10278)
- `[it_critical_systems_sitelevel_health]` (line 1459)
- `[it_critical_systems_switch_count_by_location]` (line 1487)
- `[it_critical_systems_top_issue_devices]` (line 5296)
- `[it_critical_systems_topology_device_table]` (line 5322)
- `[it_critical_systems_topology_linkgraph]` (line 5345)
- `[it_critical_systems_topology_site_role]` (line 5372)
- `[it_critical_systems_unreachable_devices]` (line 5397)
- `[it_health_sites_below_threshold]` (line 10987)
- `[it_health_sites_below_threshold_drilldown]` (line 12518)
- `[overview_ap_health]` (line 9744)
- `[overview_ap_health_drilldown]` (line 12918)
- `[overview_link_site_1_site_2_health]` (line 9944)
- `[overview_operational_lead]` (line 9800)
- `[overview_site_2_health]` (line 9908)
- `[overview_site_state_drilldown]` (line 13071)
- `[overview_site_1_health]` (line 9872)
- `[overview_topology_overview]` (line 9586)
- `[shared_ds_dev_health_trend]` (line 10186)

### `cisco:dnac:issue`

- **Status:** `fail`  **Field count:** 0  **Stanzas referencing:** 24  **Latency:** 7 ms
- **Note:** Expecting value: line 1 column 1 (char 0)

**Stanzas using this sourcetype**

- `[executive_dashboard_issue_summary_kpis]` (line 615)
- `[executive_dashboard_issue_summary_kpis_drilldown]` (line 12450)
- `[executive_summary_issue_by_priority_kpi]` (line 4729)
- `[executive_summary_issue_details]` (line 4810)
- `[executive_summary_issue_distribution]` (line 4196)
- `[executive_summary_issue_trend]` (line 4706)
- `[executive_summary_top_issues]` (line 4173)
- `[it_critical_systems_aaa_server_issues]` (line 3873)
- `[it_critical_systems_ap_disconnect_issues]` (line 3848)
- `[it_critical_systems_bgp_neighbor_issues]` (line 3823)
- `[it_critical_systems_ds_base_issues]` (line 8138)
- `[it_critical_systems_ds_issue_by_priority]` (line 8331)
- `[it_critical_systems_interface_utilization_issues]` (line 3798)
- `[it_critical_systems_issue_trend]` (line 3898)
- `[it_critical_systems_issues_by_priority]` (line 3948)
- `[it_critical_systems_issues_by_site]` (line 3922)
- `[it_critical_systems_site_bandwidth_pressure_24h_trend]` (line 10330)
- `[it_critical_systems_site_errors_discards_24h_trend]` (line 10354)
- `[it_critical_systems_site_link_events_24h_trend]` (line 10306)
- `[it_critical_systems_site_power_events_24h_trend]` (line 10378)
- `[overview_site_2_health]` (line 9908)
- `[overview_site_1_health]` (line 9872)
- `[security_resilience_rogue_device_detail]` (line 2284)
- `[security_resilience_rogue_device_detection]` (line 2258)

### `cisco:dnac:networkhealth`

- **Status:** `fail`  **Field count:** 0  **Stanzas referencing:** 11  **Latency:** 5 ms
- **Note:** Expecting value: line 1 column 1 (char 0)

**Stanzas using this sourcetype**

- `[executive_dashboard_it_domain_score]` (line 845)
- `[executive_dashboard_network_health_score]` (line 886)
- `[executive_dashboard_network_health_trend_compare]` (line 3215)
- `[executive_summary_network_health_trend]` (line 4127)
- `[it_critical_systems_ds_wow_health]` (line 8546)
- `[it_critical_systems_network_category_distribution_health_trend]` (line 10402)
- `[it_critical_systems_network_health_category_trend]` (line 5053)
- `[it_critical_systems_network_health_score]` (line 1435)
- `[it_critical_systems_network_health_score_drilldown]` (line 12387)
- `[it_critical_systems_network_health_trend]` (line 1412)
- `[it_critical_systems_weekoverweek_health]` (line 1559)

### `cisco:dnac:securityadvisory`

- **Status:** `fail`  **Field count:** 0  **Stanzas referencing:** 4  **Latency:** 6 ms
- **Note:** Expecting value: line 1 column 1 (char 0)

**Stanzas using this sourcetype**

- `[security_resilience_advisory_exposure_by_family]` (line 5421)
- `[security_resilience_ds_psirt]` (line 9159)
- `[security_resilience_psirt_advisories]` (line 2231)
- `[security_resilience_psirt_critical_advisories]` (line 5491)

### `cisco:esa:amp`

- **Status:** `fail`  **Field count:** 0  **Stanzas referencing:** 3  **Latency:** 7 ms
- **Note:** Expecting value: line 1 column 1 (char 0)

**Stanzas using this sourcetype**

- `[security_resilience_ds_email_security]` (line 8801)
- `[security_resilience_email_security_events]` (line 1635)
- `[security_resilience_email_threat_count]` (line 1659)

### `cisco:esa:antispam`

- **Status:** `fail`  **Field count:** 0  **Stanzas referencing:** 3  **Latency:** 6 ms
- **Note:** Expecting value: line 1 column 1 (char 0)

**Stanzas using this sourcetype**

- `[security_resilience_ds_email_security]` (line 8801)
- `[security_resilience_email_security_events]` (line 1635)
- `[security_resilience_email_threat_count]` (line 1659)

### `cisco:esa:content_scanner`

- **Status:** `fail`  **Field count:** 0  **Stanzas referencing:** 3  **Latency:** 5 ms
- **Note:** Expecting value: line 1 column 1 (char 0)

**Stanzas using this sourcetype**

- `[security_resilience_ds_email_security]` (line 8801)
- `[security_resilience_email_security_events]` (line 1635)
- `[security_resilience_email_threat_count]` (line 1659)

### `cisco:estreamer:data`

- **Status:** `fail`  **Field count:** 0  **Stanzas referencing:** 3  **Latency:** 5 ms
- **Note:** Expecting value: line 1 column 1 (char 0)

**Stanzas using this sourcetype**

- `[asset_inventory_firewall_gap]` (line 4752)
- `[security_resilience_ds_security_events]` (line 9224)
- `[security_resilience_recent_security_events]` (line 2459)

### `cisco:estreamer:log`

- **Status:** `fail`  **Field count:** 0  **Stanzas referencing:** 1  **Latency:** 6 ms
- **Note:** Expecting value: line 1 column 1 (char 0)

**Stanzas using this sourcetype**

- `[asset_inventory_firewall_gap]` (line 4752)

### `cisco:estreamer:status`

- **Status:** `fail`  **Field count:** 0  **Stanzas referencing:** 1  **Latency:** 6 ms
- **Note:** Expecting value: line 1 column 1 (char 0)

**Stanzas using this sourcetype**

- `[asset_inventory_firewall_gap]` (line 4752)

### `cisco:firepower:syslog`

- **Status:** `fail`  **Field count:** 0  **Stanzas referencing:** 2  **Latency:** 7 ms
- **Note:** Expecting value: line 1 column 1 (char 0)

**Stanzas using this sourcetype**

- `[admin_macro_index_tuning]` (line 5722)
- `[asset_inventory_firewall_gap]` (line 4752)

### `cisco:ftd`

- **Status:** `fail`  **Field count:** 0  **Stanzas referencing:** 24  **Latency:** 7 ms
- **Note:** Expecting value: line 1 column 1 (char 0)

**Stanzas using this sourcetype**

- `[admin_macro_index_tuning]` (line 5722)
- `[asset_inventory_firewall_gap]` (line 4752)
- `[escu_alert_fw_compromised_host_indicators]` (line 7488)
- `[escu_alert_fw_repeated_blocked_connections]` (line 7512)
- `[executive_dashboard_firewall_blocked_count]` (line 789)
- `[executive_dashboard_firewall_blocked_with_baseline]` (line 10642)
- `[executive_dashboard_fw_blocked_trend_compare]` (line 3186)
- `[executive_dashboard_threat_sources_with_baseline]` (line 10670)
- `[network_intelligence_blocked_vs_allowed]` (line 3273)
- `[network_intelligence_external_sources]` (line 3321)
- `[network_intelligence_geo_blocked_traffic]` (line 3370)
- `[network_intelligence_top_blocked_ports]` (line 3445)
- `[network_intelligence_top_countries_blocked]` (line 3395)
- `[network_intelligence_top_talkers]` (line 3420)
- `[network_intelligence_traffic_by_action_trend]` (line 3296)
- `[network_intelligence_traffic_by_protocol]` (line 3347)
- `[network_intelligence_traffic_volume_trend]` (line 3471)
- `[security_resilience_assets_at_risk]` (line 3494)
- `[security_resilience_data_exfiltration_indicators]` (line 2943)
- `[security_resilience_ds_base_fw]` (line 8760)
- `[security_resilience_firewall_allowed_count]` (line 1773)
- `[security_resilience_repeated_blocked_sources]` (line 2880)
- `[security_resilience_ssh_activity]` (line 2917)
- `[security_resilience_vpn_session_detail]` (line 2511)

### `cisco:ios`

- **Status:** `fail`  **Field count:** 0  **Stanzas referencing:** 36  **Latency:** 6 ms
- **Note:** Expecting value: line 1 column 1 (char 0)

**Stanzas using this sourcetype**

- `[admin_macro_index_tuning]` (line 5722)
- `[asset_inventory_ds_gap_analysis]` (line 6983)
- `[escu_alert_ios_config_exfil_via_tftp]` (line 7537)
- `[escu_alert_ios_snmp_community_change]` (line 7560)
- `[escu_alert_ios_suspicious_account_creation]` (line 7582)
- `[it_critical_systems_config_change_transactions]` (line 3101)
- `[it_critical_systems_dhcp_ios_events]` (line 3649)
- `[it_critical_systems_ds_config_change_transactions]` (line 8160)
- `[it_critical_systems_ds_dhcp_ios_events]` (line 8237)
- `[it_critical_systems_ds_error_disabled_interfaces]` (line 8307)
- `[it_critical_systems_ds_ntp_drift]` (line 8352)
- `[it_critical_systems_ds_port_flapping]` (line 8380)
- `[it_critical_systems_ds_route_flapping]` (line 8404)
- `[it_critical_systems_ds_stp_mac_flapping]` (line 8456)
- `[it_critical_systems_ds_syslog_severity]` (line 8504)
- `[it_critical_systems_error_disabled_interfaces]` (line 3131)
- `[it_critical_systems_ios_ntp_time_drift]` (line 3674)
- `[it_critical_systems_link_flap_storm]` (line 5030)
- `[it_critical_systems_ntp_time_drift]` (line 3070)
- `[it_critical_systems_port_flapping]` (line 2994)
- `[it_critical_systems_power_event_detection]` (line 5076)
- `[it_critical_systems_power_event_summary]` (line 5099)
- `[it_critical_systems_power_event_timeline]` (line 5122)
- `[it_critical_systems_power_impact_report]` (line 5146)
- `[it_critical_systems_power_outage_history]` (line 5172)
- `[it_critical_systems_power_outage_trend]` (line 5197)
- `[it_critical_systems_route_flapping]` (line 3021)
- `[it_critical_systems_routing_reconvergence]` (line 5250)
- `[it_critical_systems_stp_and_mac_flapping]` (line 3044)
- `[it_critical_systems_stp_reconvergence]` (line 5273)
- `[it_critical_systems_syslog_severity_distribution]` (line 1512)
- `[security_resilience_ds_severity_by_host]` (line 9249)
- `[security_resilience_rogue_device_detail]` (line 2284)
- `[security_resilience_rogue_device_detection]` (line 2258)
- `[security_resilience_severity_by_host]` (line 2969)
- `[security_resilience_unauthorized_wireless]` (line 2488)

### `cisco:ise:syslog`

- **Status:** `fail`  **Field count:** 0  **Stanzas referencing:** 30  **Latency:** 7 ms
- **Note:** Expecting value: line 1 column 1 (char 0)

**Stanzas using this sourcetype**

- `[admin_macro_index_tuning]` (line 5722)
- `[asset_inventory_ds_gap_analysis]` (line 6983)
- `[building_resilience_wireless_device_trust_summary]` (line 437)
- `[building_resilience_wireless_devices_to_review]` (line 489)
- `[building_resilience_wireless_devices_to_review_count]` (line 553)
- `[executive_dashboard_failed_logon_count]` (line 758)
- `[executive_dashboard_failed_logon_with_baseline]` (line 10697)
- `[executive_dashboard_ise_authentication_rate]` (line 811)
- `[executive_dashboard_security_domain_score]` (line 949)
- `[executive_dashboard_security_domain_score_drilldown]` (line 12671)
- `[executive_dashboard_security_trend_compare]` (line 3158)
- `[security_resilience_ds_ise_auth]` (line 8970)
- `[security_resilience_ds_ise_by_nas]` (line 8992)
- `[security_resilience_ds_ise_fail_count]` (line 9017)
- `[security_resilience_ds_ise_failure_reasons]` (line 9036)
- `[security_resilience_ds_ise_trend]` (line 9059)
- `[security_resilience_ds_security_events]` (line 9224)
- `[security_resilience_identity_events_trend]` (line 1819)
- `[security_resilience_identity_overview_trend]` (line 1844)
- `[security_resilience_ise_auth_trend]` (line 1958)
- `[security_resilience_ise_authentication_rate]` (line 1934)
- `[security_resilience_ise_cpu_utilization]` (line 1982)
- `[security_resilience_ise_disk_utilization]` (line 2028)
- `[security_resilience_ise_memory_utilization]` (line 2005)
- `[security_resilience_ise_node_inventory]` (line 2097)
- `[security_resilience_ise_radius_latency]` (line 2051)
- `[security_resilience_ise_tacacs_latency]` (line 2074)
- `[security_resilience_recent_security_events]` (line 2459)
- `[user_experience_ds_ise_guest_auth_rate]` (line 9516)
- `[user_experience_ise_guest_auth_rate]` (line 3750)

### `cisco:sdwan:linkhealth`

- **Status:** `fail`  **Field count:** 0  **Stanzas referencing:** 3  **Latency:** 7 ms
- **Note:** Expecting value: line 1 column 1 (char 0)

**Stanzas using this sourcetype**

- `[overview_link_site_1_site_2_health]` (line 9944)
- `[overview_link_state_drilldown]` (line 13037)
- `[overview_topology_overview]` (line 9586)

### `cisco:sdwan:utd:logs`

- **Status:** `fail`  **Field count:** 0  **Stanzas referencing:** 4  **Latency:** 5 ms
- **Note:** Expecting value: line 1 column 1 (char 0)

**Stanzas using this sourcetype**

- `[security_resilience_ds_sdwan_utd]` (line 9203)
- `[security_resilience_sdwan_utd_alerts]` (line 2312)
- `[security_resilience_sdwan_utd_threat_trend]` (line 2335)
- `[security_resilience_sdwan_utd_top_threats]` (line 2360)

### `cisco:sfw:estreamer`

- **Status:** `fail`  **Field count:** 0  **Stanzas referencing:** 25  **Latency:** 6 ms
- **Note:** Expecting value: line 1 column 1 (char 0)

**Stanzas using this sourcetype**

- `[admin_macro_index_tuning]` (line 5722)
- `[asset_inventory_firewall_gap]` (line 4752)
- `[escu_alert_fw_repeated_blocked_connections]` (line 7512)
- `[executive_dashboard_firewall_blocked_count]` (line 789)
- `[executive_dashboard_firewall_blocked_with_baseline]` (line 10642)
- `[executive_dashboard_fw_blocked_trend_compare]` (line 3186)
- `[executive_dashboard_threat_sources_with_baseline]` (line 10670)
- `[network_intelligence_blocked_vs_allowed]` (line 3273)
- `[network_intelligence_external_sources]` (line 3321)
- `[network_intelligence_geo_blocked_traffic]` (line 3370)
- `[network_intelligence_top_blocked_ports]` (line 3445)
- `[network_intelligence_top_countries_blocked]` (line 3395)
- `[network_intelligence_top_talkers]` (line 3420)
- `[network_intelligence_traffic_by_action_trend]` (line 3296)
- `[network_intelligence_traffic_by_protocol]` (line 3347)
- `[network_intelligence_traffic_volume_trend]` (line 3471)
- `[security_resilience_assets_at_risk]` (line 3494)
- `[security_resilience_ds_base_fw]` (line 8760)
- `[security_resilience_firepower_event_correlation]` (line 2388)
- `[security_resilience_firepower_intrusion_trend]` (line 2412)
- `[security_resilience_firepower_top_signatures]` (line 2436)
- `[security_resilience_firewall_allowed_count]` (line 1773)
- `[security_resilience_idsips_classifications]` (line 1911)
- `[security_resilience_ips_severity_distribution]` (line 2858)
- `[security_resilience_repeated_blocked_sources]` (line 2880)

### `cisco:spaces:firehose`

- **Status:** `fail`  **Field count:** 0  **Stanzas referencing:** 33  **Latency:** 7 ms
- **Note:** Expecting value: line 1 column 1 (char 0)

**Stanzas using this sourcetype**

- `[building_resilience_device_presence_trend]` (line 365)
- `[building_resilience_ds_room_detail]` (line 10211)
- `[building_resilience_ds_rooms]` (line 7093)
- `[building_resilience_ds_spaces_kpi_devices]` (line 7118)
- `[building_resilience_ds_spaces_kpi_ssids]` (line 7139)
- `[building_resilience_ds_spaces_kpi_users]` (line 7160)
- `[building_resilience_environmental_health_index]` (line 74)
- `[building_resilience_environmental_trend_detail]` (line 102)
- `[building_resilience_humidity]` (line 147)
- `[building_resilience_room_detail]` (line 390)
- `[building_resilience_rooms_occupied_trend]` (line 7705)
- `[building_resilience_spaces_location_breakdown]` (line 413)
- `[building_resilience_ssid_association_trend]` (line 318)
- `[building_resilience_ssid_client_associations]` (line 292)
- `[building_resilience_temperature]` (line 195)
- `[building_resilience_user_presence_trend]` (line 342)
- `[building_resilience_webex_devices]` (line 243)
- `[building_resilience_webex_people_trend]` (line 267)
- `[building_resilience_wireless_device_trust_summary]` (line 437)
- `[building_resilience_wireless_devices_to_review]` (line 489)
- `[building_resilience_wireless_devices_to_review_count]` (line 553)
- `[executive_dashboard_active_devices]` (line 4837)
- `[executive_dashboard_active_devices_drilldown]` (line 12739)
- `[executive_dashboard_building_domain_score]` (line 639)
- `[executive_dashboard_building_occupancy]` (line 693)
- `[executive_dashboard_collab_devices]` (line 4862)
- `[executive_dashboard_collab_devices_drilldown]` (line 12885)
- `[executive_dashboard_ds_bldg_score]` (line 7624)
- `[executive_dashboard_ds_bldg_score_drilldown]` (line 12836)
- `[executive_dashboard_ds_building_occupancy]` (line 7678)
- `[executive_dashboard_ds_building_occupancy_drilldown]` (line 12801)
- `[executive_dashboard_wifi_clients]` (line 4885)
- `[executive_dashboard_wifi_clients_drilldown]` (line 12768)

### `cisco:thousandeyes:alerts`

- **Status:** `fail`  **Field count:** 0  **Stanzas referencing:** 4  **Latency:** 7 ms
- **Note:** Expecting value: line 1 column 1 (char 0)

**Stanzas using this sourcetype**

- `[teuc_5_9_19_isp_performance_degradation_alerts]` (line 6116)
- `[teuc_5_9_46_alert_severity_distribution]` (line 6666)
- `[teuc_5_9_47_alert_timeline_trending]` (line 6685)
- `[teuc_5_9_54_mttr_reduction_via_network_vs_application_isolation]` (line 6809)

### `cisco:thousandeyes:metric`

- **Status:** `fail`  **Field count:** 0  **Stanzas referencing:** 2  **Latency:** 7 ms
- **Note:** Expecting value: line 1 column 1 (char 0)

**Stanzas using this sourcetype**

- `[overview_link_te_a2a_health]` (line 10008)
- `[teuc_5_9_28_geographic_workforce_performance_comparison]` (line 6287)

### `cisco:thousandeyes:trace`

- **Status:** `fail`  **Field count:** 0  **Stanzas referencing:** 2  **Latency:** 5 ms
- **Note:** Expecting value: line 1 column 1 (char 0)

**Stanzas using this sourcetype**

- `[it_health_thousandeyes_endpoint_traces]` (line 10893)
- `[teuc_5_9_52_trace_span_analysis]` (line 6765)

### `cisco:ucs`

- **Status:** `fail`  **Field count:** 0  **Stanzas referencing:** 1  **Latency:** 5 ms
- **Note:** Expecting value: line 1 column 1 (char 0)

**Stanzas using this sourcetype**

- `[admin_macro_index_tuning]` (line 5722)

### `cisco:wsa:l4tm`

- **Status:** `fail`  **Field count:** 0  **Stanzas referencing:** 2  **Latency:** 5 ms
- **Note:** Expecting value: line 1 column 1 (char 0)

**Stanzas using this sourcetype**

- `[security_resilience_web_security_events]` (line 2534)
- `[security_resilience_web_threat_count]` (line 2556)

### `cisco:wsa:squid`

- **Status:** `fail`  **Field count:** 0  **Stanzas referencing:** 2  **Latency:** 7 ms
- **Note:** Expecting value: line 1 column 1 (char 0)

**Stanzas using this sourcetype**

- `[security_resilience_web_security_events]` (line 2534)
- `[security_resilience_web_threat_count]` (line 2556)

### `cisco:xdr:incidents`

- **Status:** `fail`  **Field count:** 0  **Stanzas referencing:** 10  **Latency:** 7 ms
- **Note:** Expecting value: line 1 column 1 (char 0)

**Stanzas using this sourcetype**

- `[executive_dashboard_ds_xdr_incidents]` (line 7912)
- `[executive_dashboard_ds_xdr_incidents_drilldown]` (line 12643)
- `[executive_dashboard_xdr_incident_count]` (line 1045)
- `[overview_top_incident_volume]` (line 9774)
- `[overview_xdr_critical_incidents]` (line 9718)
- `[overview_xdr_critical_incidents_drilldown]` (line 12710)
- `[security_resilience_ds_xdr_by_severity]` (line 9294)
- `[security_resilience_ds_xdr_detail]` (line 9314)
- `[security_resilience_xdr_by_severity]` (line 2577)
- `[security_resilience_xdr_incident_detail]` (line 2599)

### `cisco:xdr:incidents-summary`

- **Status:** `fail`  **Field count:** 0  **Stanzas referencing:** 10  **Latency:** 6 ms
- **Note:** Expecting value: line 1 column 1 (char 0)

**Stanzas using this sourcetype**

- `[executive_dashboard_ds_xdr_incidents]` (line 7912)
- `[executive_dashboard_ds_xdr_incidents_drilldown]` (line 12643)
- `[executive_dashboard_xdr_incident_count]` (line 1045)
- `[overview_top_incident_volume]` (line 9774)
- `[overview_xdr_critical_incidents]` (line 9718)
- `[overview_xdr_critical_incidents_drilldown]` (line 12710)
- `[security_resilience_ds_xdr_by_severity]` (line 9294)
- `[security_resilience_ds_xdr_detail]` (line 9314)
- `[security_resilience_xdr_by_severity]` (line 2577)
- `[security_resilience_xdr_incident_detail]` (line 2599)

### `meraki:audit`

- **Status:** `fail`  **Field count:** 0  **Stanzas referencing:** 1  **Latency:** 7 ms
- **Note:** Expecting value: line 1 column 1 (char 0)

**Stanzas using this sourcetype**

- `[it_critical_systems_configuration_change_trend]` (line 1165)

### `meraki:devicesuplinkslossandlatency`

- **Status:** `fail`  **Field count:** 0  **Stanzas referencing:** 6  **Latency:** 6 ms
- **Note:** Expecting value: line 1 column 1 (char 0)

**Stanzas using this sourcetype**

- `[it_critical_systems_ds_wan_bandwidth_detail]` (line 8525)
- `[it_critical_systems_wan_bandwidth_detail]` (line 1535)
- `[user_experience_bandwidth_trend]` (line 2648)
- `[user_experience_ds_bandwidth]` (line 9428)
- `[user_experience_wan_bandwidth_table]` (line 2624)
- `[user_experience_wan_latency_by_uplink]` (line 2789)

### `meraki:sensorreadingshistory`

- **Status:** `fail`  **Field count:** 0  **Stanzas referencing:** 9  **Latency:** 7 ms
- **Note:** Expecting value: line 1 column 1 (char 0)

**Stanzas using this sourcetype**

- `[building_resilience_co2_level]` (line 1)
- `[building_resilience_door_alerts]` (line 48)
- `[building_resilience_environmental_health_index]` (line 74)
- `[building_resilience_environmental_trend_detail]` (line 102)
- `[building_resilience_humidity]` (line 147)
- `[building_resilience_sensor_detail]` (line 171)
- `[building_resilience_temperature]` (line 195)
- `[building_resilience_water_leak_detection]` (line 220)
- `[building_resilience_water_safety_status]` (line 124)

### `ms:defender:endpoint:alerts`

- **Status:** `fail`  **Field count:** 0  **Stanzas referencing:** 2  **Latency:** 4 ms
- **Note:** Expecting value: line 1 column 1 (char 0)

**Stanzas using this sourcetype**

- `[security_resilience_ds_endpoint_detail]` (line 8823)
- `[security_resilience_endpoint_alert_detail]` (line 1702)

