# Cisco Catalyst App — Harvest Inventory & Raw→DM Conversion Plan

Generated from:
- `cisco-catalyst-app` at `/opt/10/etc/apps/cisco-catalyst-app`
- `searchbase.conf` in this repo

## Executive summary

| Metric | Count |
|--------|------:|
| Total `searchbase.conf` stanzas | 965 |
| Catalyst-ecosystem stanzas still **raw** | 462 |
| Catalyst app dashboard DM queries (unique) | 233 |
| Harvest candidates (low searchbase overlap) | 131 |
| Likely already covered in searchbase | 102 |
| Stanzas using `Cisco_Catalyst_App` today | 0 |

## DM strategy (four layers)

| Layer | Data model | Use for |
|-------|------------|---------|
| Campus / enterprise Cisco | **`Cisco_Catalyst_App`** | DNAC, ISE campus, SD-WAN, Meraki, `stream:netflow`, Cyber Vision, IOS |
| Perimeter firewall | **CIM `Network_Traffic`** | ASA/FTD allow/block, blocked-source KPIs |
| Cross-vendor identity | **CIM `Authentication`** | Windows + ISE blended auth KPIs |
| FTD IPS / eStreamer | **`Cisco_Security`** | Intrusion events, classifications |
| ThousandEyes | **`Cisco_ThousandEyes`** (keep) | Observability; do not switch to `Cisco_Catalyst_Network_Performance_Events` |

## Prerequisites (before any conversion)

1. Install **Cisco Enterprise Networking for Splunk Platform** (`cisco-catalyst-app`) on search heads.
2. Accelerate **`Cisco_Catalyst_App`** data model.
3. Tune **`cisco_catalyst_app_index`** macro (default is `index IN ("")` — must match your DNAC/ISE/SD-WAN indexes).
4. Align with our **`index_catalyst`** macro; Catalyst DM searches use **`summariesonly`** from `cisco-catalyst-app` (not `scd_summariesonly`).
5. Validate each migrated stanza on stack: raw count vs DM count in same window.

## Phase 1 — Raw → `Cisco_Catalyst_App` migration (searchbase.conf)

Convert existing raw stanzas in dependency order. Each wave: pick 5–10 pilot stanzas, validate, then batch.

### Wave 1 — DNAC health KPIs

- **Target dataset:** `Cisco_Catalyst_Device_Health_Events`
- **Scope:** Reachability/manageability scores, AP counts, site health
- **Stanzas to convert:** 126
  - `building_resilience_ds_ap_health_site`
  - `cisco_live_catalyst_center_readiness_active_issues`
  - `cisco_live_catalyst_center_readiness_device_health`
  - `cisco_live_event_ops_onboarding_gap_summary`
  - `cisco_live_event_ops_preflight_coverage_matrix`
  - `dashboard_it_health_v1_ap_by_location`
  - `dashboard_it_health_v1_base_devicehealth_ref`
  - `dashboard_it_health_v1_base_topology_site_role`
  - `dashboard_it_health_v1_cpu_mem`
  - `dashboard_it_health_v1_cpu_mem_trend`
  - `dashboard_it_health_v1_dev_health_trend`
  - `dashboard_it_health_v1_device_health`
  - `dashboard_it_health_v1_health_dist`
  - `dashboard_it_health_v1_kpi_cpu_mem`
  - `dashboard_it_health_v1_kpi_dev_health`
  - … +111 more

### Wave 2 — DNAC client health

- **Target dataset:** `Cisco_Catalyst_Client_Inventory_And_Health_Score_Events`
- **Scope:** Client health scores, UX domain KPIs
- **Stanzas to convert:** 56
  - `client_summary_client_by_location`
  - `client_summary_client_count_over_time`
  - `client_summary_client_health_by_location`
  - `client_summary_client_health_dist`
  - `client_summary_client_health_kpi`
  - `client_summary_wireless_vs_wired`
  - `clienthealth_by_site_lookup_join`
  - `dashboard_it_health_v1_uxh_client_trend`
  - `dashboard_it_health_v1_uxh_wired_health`
  - `dashboard_it_health_v1_uxh_wireless_health`
  - `dashboard_spaces_intelligence_v1_client_health_by_site`
  - `dashboard_spaces_intelligence_v1_convergence_health`
  - `dashboard_spaces_intelligence_v1_net_kpi_client_health`
  - `dashboard_spaces_intelligence_v1_occupancy_vs_health`
  - `dashboard_network_operations_v1_cs_health_dist`
  - … +41 more

### Wave 3 — DNAC network health

- **Target dataset:** `Cisco_Catalyst_Network_Health_Events`
- **Scope:** Network health category scores
- **Stanzas to convert:** 13
  - `dashboard_it_health_v1_kpi_net_health`
  - `dashboard_it_health_v1_net_health_trend`
  - `dashboard_it_health_v1_network_health`
  - `dashboard_spaces_intelligence_v1_net_kpi_health`
  - `executive_dashboard_network_health_score`
  - `executive_dashboard_network_health_trend_compare`
  - `it_critical_systems_ds_wow_health`
  - `it_critical_systems_network_category_distribution_health_trend`
  - `it_critical_systems_network_health_category_trend`
  - `it_critical_systems_network_health_score`
  - `it_critical_systems_network_health_score_drilldown`
  - `it_critical_systems_network_health_trend`
  - `it_critical_systems_weekoverweek_health`

### Wave 4 — DNAC issues

- **Target dataset:** `Cisco_Catalyst_Active_Issue_Events`
- **Scope:** Active issues, rogue-adjacent, interface/BGP/AAA issue panels
- **Stanzas to convert:** 52
  - `dashboard_it_health_v1_base_issues_ref`
  - `dashboard_it_health_v1_intf_util`
  - `dashboard_it_health_v1_issue_by_priority`
  - `dashboard_it_health_v1_issue_by_severity`
  - `dashboard_it_health_v1_issue_by_site`
  - `dashboard_it_health_v1_issue_category_split`
  - `dashboard_it_health_v1_issue_trend`
  - `dashboard_it_health_v1_issue_trend_cat`
  - `dashboard_it_health_v1_issues_trend`
  - `dashboard_it_health_v1_kpi_issues`
  - `dashboard_it_health_v1_open_issues`
  - `dashboard_it_health_v1_top_client_issues`
  - `dashboard_it_health_v1_top_network_issues`
  - `dashboard_it_health_v1_top_sites_issues`
  - `dashboard_netops_readiness_v1_c_issues_forecast`
  - … +37 more

### Wave 5 — DNAC compliance & PSIRT

- **Target dataset:** `Cisco_Catalyst_Device_Compliance_Events`
- **Scope:** Compliance rate, distribution, PSIRT/advisory
- **Stanzas to convert:** 14
  - `building_resilience_compliance_detail`
  - `cisco_live_catalyst_center_readiness_compliance`
  - `dashboard_it_health_v1_compliance`
  - `dashboard_it_health_v1_compliance_donut`
  - `dashboard_spaces_intelligence_v1_net_kpi_compliance`
  - `it_critical_systems_compliance_distribution`
  - `it_critical_systems_compliance_rate`
  - `it_critical_systems_compliance_report`
  - `it_critical_systems_compliance_report_noncompliant_detail`
  - `it_critical_systems_compliance_report_rate`
  - `it_critical_systems_compliance_report_status_distribution`
  - `network_ccc_compliance_rate_kpi`
  - `security_resilience_compliance_distribution`
  - `security_resilience_noncompliant_devices`

### Wave 6 — DNAC client detail

- **Target dataset:** `Cisco_Catalyst_Client_Events`
- **Scope:** Client tables, SSID/band, usage (high stanza count)
- **Stanzas to convert:** 67
  - `cisco_live_catalyst_center_readiness_wireless_clients`
  - `client_summary_client_by_band`
  - `client_summary_client_by_device_type`
  - `client_summary_client_by_protocol`
  - `client_summary_client_by_ssid`
  - `client_summary_client_onboarding`
  - `client_summary_client_os_dist`
  - `client_summary_ds_client_by_ssid`
  - `client_summary_ds_client_os_dist`
  - `client_summary_ds_client_session_by_band`
  - `client_summary_ds_client_session_by_protocol`
  - `client_summary_ds_client_session_by_ssid`
  - `client_summary_ds_client_traffic_by_band`
  - `client_summary_ds_client_traffic_by_protocol`
  - `client_summary_ds_client_traffic_by_ssid`
  - … +52 more

### Wave 7 — DNAC audit

- **Target dataset:** `Cisco_Catalyst_Audit_Log_Events`
- **Scope:** Config change trends
- **Stanzas to convert:** 7
  - `cisco_live_catalyst_center_readiness_audit_activity`
  - `dashboard_it_health_v1_config_detail`
  - `dashboard_it_health_v1_config_trend`
  - `it_critical_systems_configuration_change_trend`
  - `it_critical_systems_configuration_changes`
  - `security_resilience_ds_security_events`
  - `security_resilience_recent_security_events`

### Wave 8 — ISE campus (ISE-only panels)

- **Target dataset:** `Cisco_Catalyst_ISE_Syslog_Events`
- **Scope:** CPU/memory/RADIUS/TACACS/node inventory
- **Stanzas to convert:** 0

### Wave 9 — SD-WAN

- **Target dataset:** `Cisco_Catalyst_SDWAN_*`
- **Scope:** Site/link/tunnel/UTD health + UTD threats
- **Stanzas to convert:** 19
  - `executive_dashboard_data_source_status`
  - `monitoring_sdwan_circuit_state_summary`
  - `monitoring_sdwan_device_inventory_table`
  - `monitoring_sdwan_site_health_map`
  - `monitoring_sdwan_site_health_table`
  - `monitoring_sdwan_site_state_summary`
  - `monitoring_sdwan_transport_health_trend`
  - `monitoring_sdwan_tunnel_health_poor_trend`
  - `monitoring_sdwan_tunnel_health_table`
  - `monitoring_sdwan_tunnel_kpi_total`
  - `monitoring_sdwan_tunnel_state_summary`
  - `monitoring_sdwan_wan_edge_reachability_summary`
  - `overview_link_state_drilldown`
  - `security_resilience_sdwan_audit_log_table`
  - `security_resilience_sdwan_audit_log_top_users`
  - … +4 more

### Wave 10 — Meraki / building

- **Target dataset:** `Cisco_Catalyst_Sensor_Events`
- **Scope:** Environmental, rogue, sensor detail
- **Stanzas to convert:** 4
  - `building_resilience_co2_level`
  - `building_resilience_humidity`
  - `building_resilience_sensor_detail`
  - `building_resilience_temperature`

### Wave 11 — Netflow stream

- **Target dataset:** `Cisco_Catalyst_Bandwidth_Utilization`
- **Scope:** Only where intent is bandwidth/app tagging, not firewall deny KPIs
- **Stanzas to convert:** 0

### Unmapped / review manually

- `it_critical_systems_inventory_device_family_distribution`
- `it_critical_systems_inventory_reachability_summary`
- `it_critical_systems_inventory_unreachable_detail`
- `network_ccc_inventory_software_version_distribution`
- `network_ccc_top_noncompliant_devices`

## Phase 2 — Keep on CIM / other DMs (do not move to Catalyst DM)

| Domain | Stanzas | Action |
|--------|--------:|--------|
| CIM Network_Traffic — expand remaining firewall KPIs | 38 | Keep / finish CIM migration |
| CIM Authentication — Windows+ISE blended panels | 31 | Keep / finish CIM migration |
| Cisco_Security — IPS/eStreamer | 14 | Keep / finish CIM migration |
| Cisco_ThousandEyes — keep current TE stanzas | 120 | Keep / finish CIM migration |
| Firewall raw — VPN session, FTD connection detail, federated tables | 29 | Keep / finish CIM migration |

## Phase 3 — Harvest from `cisco-catalyst-app` dashboards

Net-new SPL to evaluate for `searchbase.conf` (low overlap with existing stanzas).

**131 unique dashboard queries** flagged as harvest candidates.

### `Cisco_Catalyst_Cyber_Vision_Syslog_Events` (17 queries)

| Dashboard | Nodename | Notes |
|-----------|----------|-------|
| `events_and_incident_viewer` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Cyber_Vision_Syslog_Events` | \| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App wher… |
| `events_and_incident_viewer` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Cyber_Vision_Syslog_Events` | \| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App wher… |
| `events_and_incident_viewer` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Cyber_Vision_Syslog_Events` | \| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App wher… |
| `events_and_incident_viewer` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Cyber_Vision_Syslog_Events` | \| tstats fillnull_value="N/A" `summariesonly` count from datamodel=Cisco_Catalys… |
| `events_and_incident_viewer` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Cyber_Vision_Syslog_Events` | \| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App wher… |
| `events_and_incident_viewer` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Cyber_Vision_Syslog_Events` | \| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Ci… |
| `events_and_incident_viewer` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Cyber_Vision_Syslog_Events` | \| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App wher… |
| `events_and_incident_viewer` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Cyber_Vision_Syslog_Events` | \| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App wher… |
| `events_and_incident_viewer` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Cyber_Vision_Syslog_Events` | \| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Ci… |
| `events_and_incident_viewer` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Cyber_Vision_Syslog_Events` | \| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App wher… |
| `events_and_incident_viewer` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Cyber_Vision_Syslog_Events` | \| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App wher… |
| `events_and_incident_viewer` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Cyber_Vision_Syslog_Events` | \| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Ci… |
| … | | +5 more queries |

### `Cisco_Catalyst_Network_Performance_Events` (8 queries)

| Dashboard | Nodename | Notes |
|-----------|----------|-------|
| `performance` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Network_Performance_Events` | \| tstats `summariesonly` fillnull_value="N/A" count(Cisco_Catalyst_Dataset.Cisco… |
| `performance` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Network_Performance_Events` | \| tstats `summariesonly` fillnull_value="N/A" count(Cisco_Catalyst_Dataset.Cisco… |
| `performance` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Network_Performance_Events` | \| tstats `summariesonly` fillnull_value="N/A" count(Cisco_Catalyst_Dataset.Cisco… |
| `performance` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Network_Performance_Events` | \| tstats `summariesonly` fillnull_value="N/A" count(Cisco_Catalyst_Dataset.Cisco… |
| `performance` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Network_Performance_Events` | \| tstats `summariesonly` fillnull_value="N/A" count(Cisco_Catalyst_Dataset.Cisco… |
| `performance` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Network_Performance_Events` | \| tstats `summariesonly` avg(Cisco_Catalyst_Dataset.Cisco_Catalyst_Network_Perfo… |
| `performance` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Network_Performance_Events` | \| tstats `summariesonly` avg(Cisco_Catalyst_Dataset.Cisco_Catalyst_Network_Perfo… |
| `performance` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Network_Performance_Events` | \| tstats `summariesonly` avg(Cisco_Catalyst_Dataset.Cisco_Catalyst_Network_Perfo… |

### `Cisco_Catalyst_SGACL_Events` (7 queries)

| Dashboard | Nodename | Notes |
|-----------|----------|-------|
| `security_insights` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_SGACL_Events` | \| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisc… |
| `security_insights` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_SGACL_Events` | \| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisc… |
| `security_insights` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_SGACL_Events` | $Cisco SD-WAN$ \| tstats `summariesonly` fillnull_value="N/A" count as Count from… |
| `security_insights` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_SGACL_Events` | \| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisc… |
| `security_insights` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_SGACL_Events` | \| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisc… |
| `security_insights` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_SGACL_Events` | \| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisc… |
| `security_insights` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_SGACL_Events` | \| tstats `summariesonly` fillnull_value="N/A" sum(Cisco_Catalyst_Dataset.Cisco_C… |

### `Cisco_Catalyst_Device_Events` (6 queries)

| Dashboard | Nodename | Notes |
|-----------|----------|-------|
| `endpoint` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Events` | \| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Ci… |
| `endpoint` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Events` | $empty_tkn_unknown_endpoint$ \| tstats `summariesonly` fillnull_value="N/A" count… |
| `endpoint` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Events` | \| tstats fillnull_value="N/A" `summariesonly` dc(Cisco_Catalyst_Dataset.Cisco_Ca… |
| `endpoint` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Events` | \| tstats fillnull_value="N/A" `summariesonly` count as "Count" values(Cisco_Cata… |
| `endpoint` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Events` | \| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Ci… |
| `endpoint` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Events` | \| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Ci… |

### `Cisco_Catalyst_Alarm_Events` (5 queries)

| Dashboard | Nodename | Notes |
|-----------|----------|-------|
| `events_and_incident_viewer` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Alarm_Events` | \| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App wher… |
| `events_and_incident_viewer` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Alarm_Events` | \| tstats `summariesonly` count from datamodel=Cisco_Catalyst_App where nodename=… |
| `events_and_incident_viewer` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Alarm_Events` | \| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Ci… |
| `events_and_incident_viewer` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Alarm_Events` | \| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Ci… |
| `events_and_incident_viewer` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Alarm_Events` | \| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Ci… |

### `Cisco_Catalyst_Cyber_Vision_Severity_Events` (5 queries)

| Dashboard | Nodename | Notes |
|-----------|----------|-------|
| `events_and_incident_viewer` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Cyber_Vision_Severity_Events` | \| tstats `summariesonly` count from datamodel=Cisco_Catalyst_App where nodename=… |
| `events_and_incident_viewer` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Cyber_Vision_Severity_Events` | \| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App wher… |
| `events_and_incident_viewer` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Cyber_Vision_Severity_Events` | \| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Ci… |
| `events_and_incident_viewer` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Cyber_Vision_Severity_Events` | \| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Ci… |
| `events_and_incident_viewer` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Cyber_Vision_Severity_Events` | \| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Ci… |

### `Cisco_Catalyst_Vulnerabilities_Events` (5 queries)

| Dashboard | Nodename | Notes |
|-----------|----------|-------|
| `overview` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Vulnerabilities_Events` | \| tstats fillnull_value="N/A" `summariesonly` count from datamodel=Cisco_Catalys… |
| `overview` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Vulnerabilities_Events` | \| tstats fillnull_value="N/A" `summariesonly` dc(Cisco_Catalyst_Dataset.Cisco_Ca… |
| `overview` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Vulnerabilities_Events` | $run_device$ \| tstats fillnull_value="N/A" `summariesonly` count as "Count" valu… |
| `security_insights` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Vulnerabilities_Events` | \| tstats `summariesonly` count as "Count" values(Cisco_Catalyst_Dataset.Cisco_Ca… |
| `security_insights` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Vulnerabilities_Events` | $run_vulnerabilities$ \| tstats fillnull_value="N/A" `summariesonly` count as "Co… |

### `Cisco_Catalyst_Center_Reports` (4 queries)

| Dashboard | Nodename | Notes |
|-----------|----------|-------|
| `network_compliance_analytics_reports` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Center_Reports.Cisco_Catalyst_Ce` | \| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App wher… |
| `network_compliance_analytics_reports` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Center_Reports.Cisco_Catalyst_Ce` | \| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App wher… |
| `network_compliance_analytics_reports` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Center_Reports.Cisco_Catalyst_Ce` | \| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App wher… |
| `overview_analytics_reports` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Center_Reports.Cisco_Catalyst_Ce` | \| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App wher… |

### `UNKNOWN` (4 queries)

| Dashboard | Nodename | Notes |
|-----------|----------|-------|
| `network_compliance_analytics_reports` | `UNKNOWN` | \| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App wher… |
| `performance` | `UNKNOWN` | \| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App wher… |
| `performance` | `UNKNOWN` | \| tstats `summariesonly` count as "Count" latest(Cisco_Catalyst_Dataset.Cisco_Ca… |
| `usersandapplication` | `UNKNOWN` | $empty_tkn_app_usage$ \| tstats `summariesonly` fillnull_value="N/A" count as "Co… |

### `Cisco_Catalyst_Policy_Events` (4 queries)

| Dashboard | Nodename | Notes |
|-----------|----------|-------|
| `overview` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Policy_Events` | \| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Ci… |
| `overview` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Policy_Events` | \| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App wher… |
| `overview` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Policy_Events` | \| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Ci… |
| `overview` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Policy_Events` | $run_policy_ise$ \| tstats `summariesonly` count as "Count" from datamodel=Cisco_… |

### `Cisco_Catalyst_ISE_Authentication_Policy_Hit` (4 queries)

| Dashboard | Nodename | Notes |
|-----------|----------|-------|
| `security_insights` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Authentication_Policy_Hit` | \| makeresults \| append [\| tstats `summariesonly` count as "Count" from datamodel… |
| `security_insights` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Authentication_Policy_Hit` | \| makeresults \| append [\| tstats `summariesonly` count as "Count" from datamodel… |
| `security_insights` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Authentication_Policy_Hit` | \| makeresults \| append [\| tstats `summariesonly` count as "Count" from datamodel… |
| `security_insights` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Authentication_Policy_Hit` | \| makeresults \| append [\| tstats `summariesonly` count as "Count" from datamodel… |

### `Cisco_Catalyst_ISE_Authentication_Policy_Rule_Hit` (4 queries)

| Dashboard | Nodename | Notes |
|-----------|----------|-------|
| `security_insights` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Authentication_Policy_Rule_H` | \| makeresults \| append [\| tstats `summariesonly` count as "Count" from datamodel… |
| `security_insights` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Authentication_Policy_Rule_H` | \| makeresults \| append [\| tstats `summariesonly` count as "Count" from datamodel… |
| `security_insights` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Authentication_Policy_Rule_H` | \| makeresults \| append [\| tstats `summariesonly` count as "Count" from datamodel… |
| `security_insights` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_ISE_Authentication_Policy_Rule_H` | \| makeresults \| append [\| tstats `summariesonly` count as "Count" from datamodel… |

### `Cisco_Catalyst_Netflow_Events` (4 queries)

| Dashboard | Nodename | Notes |
|-----------|----------|-------|
| `security_insights` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Netflow_Events` | $Cisco SD-WAN$ \| tstats fillnull_value="N/A" `summariesonly` count as Count from… |
| `security_insights` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Netflow_Events` | $Cisco SD-WAN$ \| tstats fillnull_value="N/A" `summariesonly` count as Count from… |
| `security_insights` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Netflow_Events` | $Cisco SD-WAN$ \| tstats fillnull_value="N/A" `summariesonly` count as Count from… |
| `security_insights` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Netflow_Events` | \| tstats fillnull_value="N/A" `summariesonly` count as Count from datamodel=Cisc… |

### `Cisco_Catalyst_Camera_Events` (3 queries)

| Dashboard | Nodename | Notes |
|-----------|----------|-------|
| `endpoint` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Camera_Events` | \| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisc… |
| `endpoint` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Camera_Events` | \| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Ci… |
| `endpoint` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Camera_Events` | \| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Ci… |

### `Cisco_Catalyst_IP_SGT_Bindings` (3 queries)

| Dashboard | Nodename | Notes |
|-----------|----------|-------|
| `events_and_incident_viewer` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_IP_SGT_Bindings` | \| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App wher… |
| `events_and_incident_viewer` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_IP_SGT_Bindings` | \| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App wher… |
| `events_and_incident_viewer` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_IP_SGT_Bindings` | \| tstats `summariesonly` values(Cisco_Catalyst_Dataset.Cisco_Catalyst_IP_SGT_Bin… |

### `Cisco_Catalyst_Meraki_Audit_Events` (3 queries)

| Dashboard | Nodename | Notes |
|-----------|----------|-------|
| `events_and_incident_viewer` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Meraki_Audit_Events` | \| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisc… |
| `events_and_incident_viewer` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Meraki_Audit_Events` | \| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisc… |
| `performance` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Meraki_Audit_Events` | \| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisc… |

### `Cisco_Catalyst_Packet_Loss_Details` (3 queries)

| Dashboard | Nodename | Notes |
|-----------|----------|-------|
| `network_insights` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Packet_Loss_Details` | \| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisc… |
| `network_insights` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Packet_Loss_Details` | \| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App wher… |
| `network_insights` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Packet_Loss_Details` | \| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App wher… |

### `Cisco_Catalyst_Protocol_Events` (3 queries)

| Dashboard | Nodename | Notes |
|-----------|----------|-------|
| `overview` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Protocol_Events` | \| tstats fillnull_value="N/A" `summariesonly` count from datamodel=Cisco_Catalys… |
| `overview` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Protocol_Events` | \| tstats summariesonly=false fillnull_value="N/A" count as "Count" values(Cisco_… |
| `overview` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Protocol_Events` | $run_protocol$ \| tstats summariesonly=false fillnull_value="N/A" values(Cisco_Ca… |

### `Cisco_Catalyst_Bandwidth_Utilization` (3 queries)

| Dashboard | Nodename | Notes |
|-----------|----------|-------|
| `performance` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Bandwidth_Utilization` | \| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App wher… |
| `performance` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Bandwidth_Utilization` | \| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App wher… |
| `performance` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Bandwidth_Utilization` | \| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App wher… |

### `Cisco_Catalyst_ACL_Events` (3 queries)

| Dashboard | Nodename | Notes |
|-----------|----------|-------|
| `security_insights` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_ACL_Events` | \| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisc… |
| `security_insights` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_ACL_Events` | \| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisc… |
| `security_insights` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_ACL_Events` | $Cisco SD-WAN$ \| tstats summariesonly=false fillnull_value="N/A" count as Count … |

### `Cisco_Catalyst_Rogue_Events` (3 queries)

| Dashboard | Nodename | Notes |
|-----------|----------|-------|
| `security_insights` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Rogue_Events` | \| tstats `summariesonly` count as Count from datamodel=Cisco_Catalyst_App where … |
| `security_insights` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Rogue_Events` | \| tstats fillnull_value="N/A" values(Cisco_Catalyst_Dataset.Cisco_Catalyst_Rogue… |
| `security_insights` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Rogue_Events` | $rogue_devices_detail$ \| tstats fillnull_value="N/A" `summariesonly` count as "C… |

### `Cisco_Catalyst_Security_Events` (3 queries)

| Dashboard | Nodename | Notes |
|-----------|----------|-------|
| `security_insights` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Security_Events` | \| tstats `summariesonly` count as meraki_security_events_count from datamodel=Ci… |
| `security_insights` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Security_Events` | \| tstats `summariesonly` count as Count from datamodel=Cisco_Catalyst_App where … |
| `security_insights` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Security_Events` | \| tstats fillnull_value="N/A" `summariesonly` count as Count from datamodel=Cisc… |

### `Cisco_Catalyst_Meraki_Device_Events` (3 queries)

| Dashboard | Nodename | Notes |
|-----------|----------|-------|
| `sensors` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Meraki_Device_Events` | \| tstats `summariesonly` fillnull_value="N/A" count from datamodel=Cisco_Catalys… |
| `sensors` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Meraki_Device_Events` | \| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Ci… |
| `sensors` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Meraki_Device_Events` | \| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Ci… |

### `Cisco_Catalyst_Cyber_Vision_Device_Events` (2 queries)

| Dashboard | Nodename | Notes |
|-----------|----------|-------|
| `endpoint` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Cyber_Vision_Device_Events` | \| tstats fillnull_value="N/A" `summariesonly` count from datamodel=Cisco_Catalys… |
| `endpoint` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Cyber_Vision_Device_Events` | \| tstats fillnull_value="N/A" `summariesonly` values(Cisco_Catalyst_Dataset.Cisc… |

### `Cisco_Catalyst_Identity_Events` (2 queries)

| Dashboard | Nodename | Notes |
|-----------|----------|-------|
| `endpoint` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Identity_Events` | \| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Ci… |
| `usersandapplication` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Identity_Events` | \| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Ci… |

### `Cisco_Catalyst_Meraki_Clients_Events` (2 queries)

| Dashboard | Nodename | Notes |
|-----------|----------|-------|
| `endpoint` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Meraki_Clients_Events` | \| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisc… |
| `endpoint` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Meraki_Clients_Events` | \| tstats fillnull_value="N/A" `summariesonly` count as Count from datamodel=Cisc… |

### `Cisco_Catalyst_Audit_Events` (2 queries)

| Dashboard | Nodename | Notes |
|-----------|----------|-------|
| `events_and_incident_viewer` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Audit_Events` | \| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Ci… |
| `performance` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Audit_Events` | \| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Ci… |

### `Cisco_Catalyst_Device_Type_Events` (2 queries)

| Dashboard | Nodename | Notes |
|-----------|----------|-------|
| `network_insights` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Type_Events` | \| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App wher… |
| `network_insights` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Type_Events` | \| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Ci… |

### `Cisco_Catalyst_Offline_Devices` (2 queries)

| Dashboard | Nodename | Notes |
|-----------|----------|-------|
| `network_insights` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Offline_Devices` | \| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisc… |
| `network_insights` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Offline_Devices` | \| tstats `summariesonly` fillnull_value="N/A" count as "Count" from datamodel=Ci… |

### `Cisco_Catalyst_SDWAN_Sig_Tunnel_State` (2 queries)

| Dashboard | Nodename | Notes |
|-----------|----------|-------|
| `performance` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_Sig_Tunnel_State` | \| tstats `summariesonly` latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_Sig_… |
| `performance` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_Sig_Tunnel_State` | \| tstats `summariesonly` fillnull_value="Unknown" count as Count from datamodel=… |

### `Cisco_Catalyst_SDWAN_Tunnel_Health` (2 queries)

| Dashboard | Nodename | Notes |
|-----------|----------|-------|
| `performance` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_Tunnel_Health` | \| tstats `summariesonly` count as Count latest(Cisco_Catalyst_Dataset.Cisco_Cata… |
| `performance` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_Tunnel_Health` | \| tstats `summariesonly` fillnull_value="N/A" count as Count from datamodel=Cisc… |

### `Cisco_Catalyst_SDWAN_UTD_Health` (2 queries)

| Dashboard | Nodename | Notes |
|-----------|----------|-------|
| `performance` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_UTD_Health` | \| tstats `summariesonly` latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_UTD_… |
| `performance` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_SDWAN_UTD_Health` | \| tstats `summariesonly` count as Count from datamodel=Cisco_Catalyst_App where … |

### `Cisco_Catalyst_URL_Events` (2 queries)

| Dashboard | Nodename | Notes |
|-----------|----------|-------|
| `security_insights` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_URL_Events` | $Cisco SD-WAN$ \| tstats `summariesonly` fillnull_value="N/A" count as "Count" fr… |
| `security_insights` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_URL_Events` | $tkn_prevent_run_url_details$ \| tstats `summariesonly` fillnull_value="N/A" coun… |

### `Cisco_Catalyst_User_Events` (2 queries)

| Dashboard | Nodename | Notes |
|-----------|----------|-------|
| `usersandapplication` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_User_Events` | \| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App wher… |
| `usersandapplication` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_User_Events` | \| tstats fillnull_value="N/A" `summariesonly` count as "Count" from datamodel=Ci… |

### `Cisco_Catalyst_Event_Notifications` (1 queries)

| Dashboard | Nodename | Notes |
|-----------|----------|-------|
| `events_and_incident_viewer` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Event_Notifications` | \| tstats fillnull_value="N/A" count as "Count" from datamodel=Cisco_Catalyst_App… |

### `Cisco_Catalyst_Application_Usage` (1 queries)

| Dashboard | Nodename | Notes |
|-----------|----------|-------|
| `usersandapplication` | `Cisco_Catalyst_Dataset.Cisco_Catalyst_Application_Usage` | \| tstats `summariesonly` sum(Cisco_Catalyst_Dataset.Cisco_Catalyst_Application_U… |

## Catalyst app dashboards (inventory)

| Dashboard XML | DM queries |
|---------------|----------:|
| `events_and_incident_viewer.xml` | 52 |
| `security_insights.xml` | 44 |
| `performance.xml` | 42 |
| `overview.xml` | 27 |
| `endpoint.xml` | 22 |
| `sensors.xml` | 19 |
| `network_insights.xml` | 17 |
| `usersandapplication.xml` | 10 |
| `network_compliance_analytics_reports.xml` | 4 |
| `overview_analytics_reports.xml` | 1 |
| `endpoint_compliance_analytics_reports.xml` | 1 |

## SPL conversion pattern (raw → Catalyst DM)

**Before (raw):**
```spl
`index_catalyst` sourcetype="cisco:dnac:devicehealth"
| stats latest(Reachability) as reachability by DeviceName
```
**After (Catalyst DM):**
```spl
| tstats `summariesonly` latest(Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Health_Events.device_health_reachability) as reachability
  FROM DATAMODEL=Cisco_Catalyst_App
  WHERE nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Health_Events
  BY Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Health_Events.device_health_device_name
```
Field names must come from `Cisco_Catalyst_App.json` — never guess.

## Validation checklist (per stanza)

1. Set `dispatch_context = cisco-catalyst-app` and `dispatch_context_force = 1` (the DM is app-scoped; searches must dispatch in that app namespace).
2. Run raw + DM versions side-by-side in same time window.
3. Compare row counts / KPI values (allow ±5% for acceleration lag).
4. Update `explanation` to cite DM dataset + nodename.
5. Run `scripts/format_searchbase_conf.py --check`.
6. Confirm DM acceleration covers the sourcetypes in `cisco_catalyst_app_sourcetypes`.
