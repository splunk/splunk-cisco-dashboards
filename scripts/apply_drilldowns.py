#!/usr/bin/env python3
"""Add drilldown_search_name and drilldown_button_title to all stanzas that have matching ds_ targets.
Also adds drilldown metadata to stanzas without ds_ targets using reasonable defaults."""
import re

f = "packages/splunk-cisco-dashboards/src/main/resources/splunk/default/searchbase.conf"
content = open(f).read()

# Parse all stanzas
blocks = {}
snames = {}
subcats = {}
cur = None
for line in content.splitlines():
    m = re.match(r'^\[([^\]]+)\]', line)
    if m:
        cur = m.group(1)
        blocks[cur] = []
    elif cur:
        blocks[cur].append(line)
        sn = re.match(r'^search_name\s*=\s*(.+)', line)
        if sn:
            snames[cur] = sn.group(1).strip()
        sc = re.match(r'^sub_category\s*=\s*(.+)', line)
        if sc:
            subcats[cur] = sc.group(1).strip()

ds_stanzas = {n for n in blocks if '_ds_' in n}
drilldown_stanzas = {n for n in blocks if n.endswith('_drilldown')}

# Best-fit mapping rules based on domain knowledge
BEST_FIT = {
    # === Building Resilience ===
    "building_resilience_compliance_detail": ("building_resilience_ds_rooms", "View room details"),
    "building_resilience_device_presence_trend": ("building_resilience_ds_spaces_kpi_devices", "View device details"),
    "building_resilience_environmental_trend_detail": ("building_resilience_ds_room_detail", "View room environment detail"),
    "building_resilience_room_detail": ("building_resilience_ds_room_detail", "View room detail"),
    "building_resilience_sensor_detail": ("building_resilience_ds_room_detail", "View room sensor detail"),
    "building_resilience_spaces_location_breakdown": ("building_resilience_ds_rooms", "View rooms at this location"),
    "building_resilience_ssid_association_trend": ("building_resilience_ds_spaces_kpi_ssids", "View SSID details"),
    "building_resilience_ssid_client_associations": ("building_resilience_ds_spaces_kpi_ssids", "View SSID client details"),
    "building_resilience_user_presence_trend": ("building_resilience_ds_spaces_kpi_users", "View user details"),
    "building_resilience_webex_devices": ("building_resilience_ds_spaces_kpi_devices", "View device details"),
    "building_resilience_webex_people_trend": ("building_resilience_ds_spaces_kpi_users", "View user presence details"),
    "building_resilience_wireless_devices_to_review": ("building_resilience_ds_ap_health_site", "View AP health by site"),
    # === Client Summary ===
    "client_summary_client_by_band": ("client_summary_ds_client_detail", "View client detail"),
    "client_summary_client_by_device_type": ("client_summary_ds_client_detail", "View client detail"),
    "client_summary_client_by_location": ("client_summary_ds_client_detail", "View client detail"),
    "client_summary_client_by_protocol": ("client_summary_ds_client_detail", "View client detail"),
    "client_summary_client_by_ssid": ("client_summary_ds_client_detail", "View client detail"),
    "client_summary_client_count_over_time": ("client_summary_ds_client_detail", "View client detail"),
    "client_summary_client_health_by_location": ("client_summary_ds_client_detail", "View client health detail"),
    "client_summary_client_health_dist": ("client_summary_ds_client_detail", "View client health detail"),
    "client_summary_client_health_kpi": ("client_summary_ds_client_detail", "View client detail"),
    "client_summary_client_onboarding": ("client_summary_ds_client_detail", "View onboarding detail"),
    "client_summary_client_os_dist": ("client_summary_ds_client_detail", "View client detail"),
    "client_summary_top_clients_by_usage": ("client_summary_ds_client_detail", "View client detail"),
    "client_summary_wireless_vs_wired": ("client_summary_ds_client_detail", "View client detail"),
    # === Executive Dashboard ===
    "executive_dashboard_active_clients": ("executive_dashboard_ds_active_clients", "View active client detail"),
    "executive_dashboard_building_domain_score": ("executive_dashboard_ds_building_domain_score", "View building domain detail"),
    "executive_dashboard_building_occupancy": ("executive_dashboard_ds_building_occupancy", "View occupancy detail"),
    "executive_dashboard_data_source_status": ("executive_dashboard_ds_data_source_status", "View data source detail"),
    "executive_dashboard_failed_logon_count": ("executive_dashboard_ds_failed_logon_count", "View failed logon detail"),
    "executive_dashboard_firewall_blocked_count": ("executive_dashboard_ds_firewall_blocked_count", "View firewall block detail"),
    "executive_dashboard_ise_authentication_rate": ("executive_dashboard_ds_ise_authentication_rate", "View ISE auth detail"),
    "executive_dashboard_overall_executive_score": ("executive_dashboard_ds_overall_executive_score", "View executive score detail"),
    "executive_dashboard_thousandeyes_health_score": ("executive_dashboard_ds_thousandeyes_health_score", "View ThousandEyes detail"),
    "executive_dashboard_threat_sources": ("executive_dashboard_ds_threat_sources", "View threat source detail"),
    "executive_dashboard_user_experience_domain_score": ("executive_dashboard_ds_user_experience_domain_score", "View user experience detail"),
    "executive_dashboard_xdr_incident_count": ("executive_dashboard_ds_xdr_incident_count", "View XDR incident detail"),
    "executive_dashboard_fw_blocked_trend_compare": ("executive_dashboard_ds_firewall_blocked_count", "View firewall block detail"),
    "executive_dashboard_security_trend_compare": ("executive_dashboard_ds_threat_sources", "View threat detail"),
    # === Executive Summary ===
    "executive_summary_ap_count": ("executive_summary_ds_ap_count", "View AP detail"),
    "executive_summary_client_health_by_site": ("executive_summary_ds_client_health_by_site", "View site client health"),
    "executive_summary_client_health_trend": ("executive_summary_ds_network_health_trend", "View health trend detail"),
    "executive_summary_healthy_device_count": ("executive_summary_ds_device_health", "View device health detail"),
    "executive_summary_issue_by_priority_kpi": ("executive_summary_ds_issue_detail", "View issue detail"),
    "executive_summary_issue_details": ("executive_summary_ds_issue_detail", "View issue detail"),
    "executive_summary_overall_client_health": ("executive_summary_ds_client_health_by_site", "View client health by site"),
    "executive_summary_top_issues": ("executive_summary_ds_issue_detail", "View issue detail"),
    # === IT Critical Systems ===
    "it_critical_systems_aaa_server_issues": ("it_critical_systems_ds_aaa_server_issues", "View AAA server detail"),
    "it_critical_systems_ap_air_quality_by_site": ("it_critical_systems_ds_ap_detail", "View AP detail"),
    "it_critical_systems_ap_channel_utilization": ("it_critical_systems_ds_ap_detail", "View AP detail"),
    "it_critical_systems_ap_count_by_location": ("it_critical_systems_ds_ap_detail", "View AP detail"),
    "it_critical_systems_ap_disconnect_issues": ("it_critical_systems_ds_ap_detail", "View AP detail"),
    "it_critical_systems_ap_interference_hotspots": ("it_critical_systems_ds_ap_detail", "View AP detail"),
    "it_critical_systems_bgp_neighbor_issues": ("it_critical_systems_ds_bgp_neighbor_issues", "View BGP neighbor detail"),
    "it_critical_systems_compliance_report_noncompliant_detail": ("it_critical_systems_ds_compliance_detail", "View compliance detail"),
    "it_critical_systems_config_change_transactions": ("it_critical_systems_ds_config_changes", "View configuration change detail"),
    "it_critical_systems_configuration_change_trend": ("it_critical_systems_ds_config_changes", "View configuration change detail"),
    "it_critical_systems_configuration_changes": ("it_critical_systems_ds_config_changes", "View configuration change detail"),
    "it_critical_systems_cpu_memory_alerts": ("it_critical_systems_ds_device_detail", "View device detail"),
    "it_critical_systems_device_health_distribution": ("it_critical_systems_ds_device_detail", "View device detail"),
    "it_critical_systems_device_inventory_by_type": ("it_critical_systems_ds_device_detail", "View device detail"),
    "it_critical_systems_dhcp_ios_events": ("it_critical_systems_ds_dhcp_ios_events", "View DHCP IOS event detail"),
    "it_critical_systems_dhcp_pool_exhaustion": ("it_critical_systems_ds_dhcp_pool_exhaustion", "View DHCP pool detail"),
    "it_critical_systems_dhcp_scope_utilization": ("it_critical_systems_ds_dhcp_scope_utilization", "View DHCP scope detail"),
    "it_critical_systems_error_disabled_interfaces": ("it_critical_systems_ds_device_detail", "View device detail"),
    "it_critical_systems_interface_utilization_issues": ("it_critical_systems_ds_device_detail", "View device detail"),
    "it_critical_systems_inventory_unreachable_detail": ("it_critical_systems_ds_device_detail", "View device detail"),
    "it_critical_systems_ios_ntp_time_drift": ("it_critical_systems_ds_device_detail", "View device detail"),
    "it_critical_systems_issue_trend": ("it_critical_systems_ds_issue_detail", "View issue detail"),
    "it_critical_systems_issues_by_priority": ("it_critical_systems_ds_issue_detail", "View issue detail"),
    "it_critical_systems_issues_by_site": ("it_critical_systems_ds_issue_detail", "View issues at this site"),
    "it_critical_systems_link_flap_storm": ("it_critical_systems_ds_link_events", "View link event detail"),
    "it_critical_systems_ntp_time_drift": ("it_critical_systems_ds_device_detail", "View device detail"),
    "it_critical_systems_port_flapping": ("it_critical_systems_ds_link_events", "View link event detail"),
    "it_critical_systems_power_event_detection": ("it_critical_systems_ds_power_events", "View power event detail"),
    "it_critical_systems_power_event_summary": ("it_critical_systems_ds_power_events", "View power event detail"),
    "it_critical_systems_power_impact_report": ("it_critical_systems_ds_power_events", "View power impact detail"),
    "it_critical_systems_power_outage_history": ("it_critical_systems_ds_power_events", "View power outage detail"),
    "it_critical_systems_recent_reboots": ("it_critical_systems_ds_device_detail", "View device detail"),
    "it_critical_systems_route_flapping": ("it_critical_systems_ds_device_detail", "View device detail"),
    "it_critical_systems_routing_reconvergence": ("it_critical_systems_ds_device_detail", "View device detail"),
    "it_critical_systems_site_connectivity_score_trend": ("it_critical_systems_ds_site_connectivity", "View site connectivity detail"),
    "it_critical_systems_site_errors_discards_24h_trend": ("it_critical_systems_ds_link_events", "View link event detail"),
    "it_critical_systems_site_link_availability_pct_trend": ("it_critical_systems_ds_site_connectivity", "View site link detail"),
    "it_critical_systems_site_link_events_24h_trend": ("it_critical_systems_ds_link_events", "View link event detail"),
    "it_critical_systems_site_power_events_24h_trend": ("it_critical_systems_ds_power_events", "View power event detail"),
    "it_critical_systems_stp_and_mac_flapping": ("it_critical_systems_ds_device_detail", "View device detail"),
    "it_critical_systems_stp_reconvergence": ("it_critical_systems_ds_device_detail", "View device detail"),
    "it_critical_systems_switch_count_by_location": ("it_critical_systems_ds_device_detail", "View device detail"),
    "it_critical_systems_syslog_severity_distribution": ("it_critical_systems_ds_device_detail", "View device detail"),
    "it_critical_systems_top_issue_devices": ("it_critical_systems_ds_issue_detail", "View issue detail"),
    "it_critical_systems_topology_device_table": ("it_critical_systems_ds_device_detail", "View device detail"),
    "it_critical_systems_topology_site_role": ("it_critical_systems_ds_site_connectivity", "View site detail"),
    "it_critical_systems_unreachable_devices": ("it_critical_systems_ds_device_detail", "View device detail"),
    "it_critical_systems_wan_bandwidth_detail": ("it_critical_systems_ds_link_events", "View link detail"),
    # === Network Intelligence ===
    "network_intelligence_blocked_vs_allowed": ("network_intelligence_ds_blocked_sources", "View blocked source detail"),
    "network_intelligence_external_sources": ("network_intelligence_ds_blocked_sources", "View source detail"),
    "network_intelligence_geo_blocked_traffic": ("network_intelligence_ds_blocked_sources", "View blocked traffic detail"),
    "network_intelligence_top_blocked_ports": ("network_intelligence_ds_blocked_sources", "View blocked port detail"),
    "network_intelligence_top_countries_blocked": ("network_intelligence_ds_blocked_sources", "View country detail"),
    "network_intelligence_top_talkers": ("network_intelligence_ds_blocked_sources", "View talker detail"),
    "network_intelligence_traffic_by_protocol": ("network_intelligence_ds_blocked_sources", "View protocol detail"),
    # === Security Resilience ===
    "security_resilience_advisory_exposure_by_family": ("security_resilience_ds_advisory_detail", "View advisory detail"),
    "security_resilience_assets_at_risk": ("security_resilience_ds_assets_at_risk", "View asset risk detail"),
    "security_resilience_cloud_fw_blocked": ("security_resilience_ds_cloud_fw_blocked", "View cloud firewall detail"),
    "security_resilience_compliance_distribution": ("security_resilience_ds_compliance_detail", "View compliance detail"),
    "security_resilience_data_exfiltration_indicators": ("security_resilience_ds_data_exfiltration", "View exfiltration detail"),
    "security_resilience_dns_blocked_categories": ("security_resilience_ds_dns_blocked", "View DNS block detail"),
    "security_resilience_dns_blocked_queries": ("security_resilience_ds_dns_blocked", "View DNS query detail"),
    "security_resilience_email_security_events": ("security_resilience_ds_email_security", "View email security detail"),
    "security_resilience_email_threat_count": ("security_resilience_ds_email_security", "View email threat detail"),
    "security_resilience_endpoint_alert_detail": ("security_resilience_ds_endpoint_alerts", "View endpoint alert detail"),
    "security_resilience_failed_logon_sources": ("security_resilience_ds_failed_logons", "View failed logon detail"),
    "security_resilience_failed_logon_users": ("security_resilience_ds_failed_logons", "View failed logon detail"),
    "security_resilience_firepower_event_correlation": ("security_resilience_ds_firepower_events", "View Firepower event detail"),
    "security_resilience_firepower_intrusion_trend": ("security_resilience_ds_firepower_events", "View Firepower event detail"),
    "security_resilience_firepower_top_signatures": ("security_resilience_ds_firepower_events", "View Firepower signature detail"),
    "security_resilience_firewall_allowed_count": ("security_resilience_ds_firewall_allowed", "View allowed traffic detail"),
    "security_resilience_identity_events_trend": ("security_resilience_ds_ise_auth", "View ISE auth detail"),
    "security_resilience_identity_overview_trend": ("security_resilience_ds_ise_auth", "View identity detail"),
    "security_resilience_idsips_alert_count": ("security_resilience_ds_idsips_detail", "View IDS/IPS detail"),
    "security_resilience_idsips_alert_trend": ("security_resilience_ds_idsips_detail", "View IDS/IPS detail"),
    "security_resilience_idsips_classifications": ("security_resilience_ds_idsips_detail", "View IDS/IPS classification detail"),
    "security_resilience_ips_severity_distribution": ("security_resilience_ds_idsips_detail", "View IPS severity detail"),
    "security_resilience_ise_auth_trend": ("security_resilience_ds_ise_auth", "View ISE auth detail"),
    "security_resilience_ise_authentication_rate": ("security_resilience_ds_ise_auth", "View ISE auth detail"),
    "security_resilience_ise_cpu_utilization": ("security_resilience_ds_ise_auth", "View ISE node detail"),
    "security_resilience_ise_disk_utilization": ("security_resilience_ds_ise_auth", "View ISE node detail"),
    "security_resilience_ise_memory_utilization": ("security_resilience_ds_ise_auth", "View ISE node detail"),
    "security_resilience_ise_node_inventory": ("security_resilience_ds_ise_auth", "View ISE node detail"),
    "security_resilience_ise_radius_latency": ("security_resilience_ds_ise_auth", "View ISE latency detail"),
    "security_resilience_ise_tacacs_latency": ("security_resilience_ds_ise_auth", "View ISE latency detail"),
    "security_resilience_locked_accounts": ("security_resilience_ds_locked_accounts", "View locked account detail"),
    "security_resilience_locked_accounts_detail": ("security_resilience_ds_locked_accounts", "View locked account detail"),
    "security_resilience_noncompliant_devices": ("security_resilience_ds_compliance_detail", "View noncompliant device detail"),
    "security_resilience_privileged_logon_count": ("security_resilience_ds_privileged_logons", "View privileged logon detail"),
    "security_resilience_privileged_users_detail": ("security_resilience_ds_privileged_logons", "View privileged user detail"),
    "security_resilience_psirt_critical_advisories": ("security_resilience_ds_advisory_detail", "View critical advisory detail"),
    "security_resilience_recent_security_events": ("security_resilience_ds_recent_security", "View security event detail"),
    "security_resilience_repeated_blocked_sources": ("security_resilience_ds_repeated_blocked", "View repeated block detail"),
    "security_resilience_rogue_device_detail": ("security_resilience_ds_rogue_devices", "View rogue device detail"),
    "security_resilience_sdwan_utd_alerts": ("security_resilience_ds_sdwan_utd", "View UTD alert detail"),
    "security_resilience_sdwan_utd_threat_trend": ("security_resilience_ds_sdwan_utd", "View UTD threat detail"),
    "security_resilience_sdwan_utd_top_threats": ("security_resilience_ds_sdwan_utd", "View UTD threat detail"),
    "security_resilience_severity_by_host": ("security_resilience_ds_idsips_detail", "View host severity detail"),
    "security_resilience_ssh_activity": ("security_resilience_ds_ssh_activity", "View SSH activity detail"),
    "security_resilience_top_blocked_destinations": ("security_resilience_ds_top_blocked", "View blocked destination detail"),
    "security_resilience_vpn_session_detail": ("security_resilience_ds_vpn_sessions", "View VPN session detail"),
    "security_resilience_web_security_events": ("security_resilience_ds_web_security", "View web security detail"),
    "security_resilience_web_threat_count": ("security_resilience_ds_web_security", "View web threat detail"),
    "security_resilience_xdr_by_severity": ("security_resilience_ds_xdr_detail", "View XDR incident detail"),
    "security_resilience_xdr_incident_detail": ("security_resilience_ds_xdr_detail", "View XDR incident detail"),
    # === Orphan _ds_ chart stanzas (added 2026-05-27) ===
    # These were skipped by the original heuristic because their IDs
    # contain `_ds_` (treated as "internal data source"), but they're
    # surfaced in the picker just like regular tiles and need drilldowns
    # to existing detail leaves. Targets chosen from sibling _ds_ stanzas
    # already established as drilldown destinations.
    "client_summary_ds_client_os_dist": ("client_summary_ds_client_by_ssid", "View clients by SSID detail"),
    "client_summary_ds_client_session_by_band": ("client_summary_ds_client_by_ssid", "View clients by SSID detail"),
    "client_summary_ds_client_session_by_protocol": ("client_summary_ds_client_by_ssid", "View clients by SSID detail"),
    "client_summary_ds_client_session_by_ssid": ("client_summary_ds_client_by_ssid", "View clients by SSID detail"),
    "client_summary_ds_client_traffic_by_band": ("client_summary_ds_client_by_ssid", "View clients by SSID detail"),
    "client_summary_ds_client_traffic_by_protocol": ("client_summary_ds_client_by_ssid", "View clients by SSID detail"),
    "client_summary_ds_client_traffic_by_ssid": ("client_summary_ds_client_by_ssid", "View clients by SSID detail"),
    "client_summary_ds_top_ssids_by_traffic": ("client_summary_ds_client_by_ssid", "View clients by SSID detail"),
    "it_critical_systems_ds_device_health_enriched": ("it_critical_systems_ds_site_health", "View site health"),
    "it_critical_systems_ds_issue_by_priority": ("it_critical_systems_ds_base_issues", "View all active issues"),
    "it_critical_systems_ds_switch_by_location": ("it_critical_systems_ds_site_health", "View site health"),
    "it_critical_systems_ds_wow_health": ("it_critical_systems_ds_site_health", "View site health"),
    "user_experience_ds_wireless_signal_quality": ("user_experience_ds_base_client", "View client base detail"),
    # === Orphan drilldown batch (2026-05-27, second pass) ===
    "client_summary_ds_client_by_ssid": ("client_summary_ds_top_clients_by_usage", "Open client usage breakdown"),
    "executive_dashboard_ds_fw_blocked": ("executive_dashboard_firewall_blocked_with_baseline_drilldown", "View top blocked flows"),
    "executive_dashboard_ds_ux_score": ("user_experience_ds_wireless_signal_quality", "Inspect wireless signal quality"),
    "it_critical_systems_ds_ap_by_location": ("it_critical_systems_topology_device_table", "View per-AP device detail"),
    "it_critical_systems_ds_site_health": ("it_critical_systems_ds_base_devicehealth", "Open device health detail"),
    "overview_inter_site_latency": ("overview_link_auburndale_tallahassee_health", "Open inter-site link detail"),
    # === User Experience ===
    "user_experience_client_count_trend": ("user_experience_ds_base_client", "View client detail"),
    "user_experience_client_health_by_type": ("user_experience_ds_base_client", "View client detail"),
    "user_experience_client_health_distribution": ("user_experience_ds_base_client", "View client health detail"),
    "user_experience_client_health_trend": ("user_experience_ds_base_client", "View client health detail"),
    "user_experience_client_onboarding_failures": ("user_experience_ds_base_client", "View onboarding detail"),
    "user_experience_client_peak_by_ssid": ("user_experience_ds_client_peak_by_ssid", "View peak client detail"),
    "user_experience_client_roaming_analysis": ("user_experience_ds_base_client", "View roaming detail"),
    "user_experience_client_top_talkers": ("user_experience_ds_base_client", "View top talker detail"),
    "user_experience_guest_client_surge": ("user_experience_ds_guest_client_surge", "View guest client detail"),
    "user_experience_ise_guest_auth_rate": ("user_experience_ds_ise_guest_auth_rate", "View guest auth detail"),
    "user_experience_thousandeyes_agents": ("user_experience_ds_bandwidth", "View bandwidth detail"),
    "user_experience_thousandeyes_latency_trend": ("user_experience_ds_bandwidth", "View latency detail"),
    "user_experience_thousandeyes_test_results": ("user_experience_ds_bandwidth", "View test result detail"),
    "user_experience_top_ssids_by_clients": ("user_experience_ds_top_ssids_by_clients", "View SSID client detail"),
    "user_experience_wan_bandwidth_table": ("user_experience_ds_bandwidth", "View bandwidth detail"),
    "user_experience_wired_client_health": ("user_experience_ds_base_client", "View wired client detail"),
    # === Other mapped ===
    "asset_inventory_build_lookup": ("asset_inventory_ds_gap_analysis", "View inventory gap analysis"),
    "asset_inventory_firewall_gap": ("asset_inventory_ds_gap_analysis", "View inventory gap analysis"),
    "network_activation_wired_health_kpi": ("network_activation_ds_wired_health", "View wired health detail"),
    "network_activation_wireless_health_kpi": ("network_activation_ds_wireless_health", "View wireless health detail"),
}

# Verify all targets exist
missing_targets = set()
for src, (tgt, btn) in BEST_FIT.items():
    if tgt not in blocks:
        missing_targets.add(tgt)

if missing_targets:
    print(f"WARNING: {len(missing_targets)} targets don't exist yet:")
    for t in sorted(missing_targets):
        print(f"  {t}")

# Now apply: find the insertion point in each stanza block
applied = 0
skipped = 0
already_set = 0
for src_name, (tgt_name, btn_title) in BEST_FIT.items():
    if src_name not in blocks:
        print(f"SKIP: source stanza {src_name} not found")
        skipped += 1
        continue

    # Idempotency: if the stanza already has any drilldown_search_name,
    # leave it alone. Re-running this script must not duplicate fields
    # or overwrite hand-tuned drilldowns. Run a separate audit if you
    # need to find stanzas pointed at the wrong target.
    if any(line.startswith('drilldown_search_name ') for line in blocks[src_name]):
        already_set += 1
        continue

    tgt_search_name = snames.get(tgt_name)
    if not tgt_search_name:
        # Use the stanza name as fallback
        tgt_search_name = tgt_name

    # Find the stanza header line and insert after dispatch_context_force line.
    # The canonical field-order formatter (`format_searchbase_conf.py`)
    # will move the inserted lines into the proper slot (after
    # viz_options) on its next pass, so the exact insertion anchor here
    # only matters for idempotency, not for final output ordering.
    pattern = re.compile(
        r'(\[' + re.escape(src_name) + r'\]\n(?:.*\n)*?dispatch_context_force\s*=\s*1\n)',
        re.MULTILINE
    )
    m = pattern.search(content)
    if m:
        insert_text = f"drilldown_search_name = {tgt_search_name}\ndrilldown_button_title = {btn_title}\n"
        content = content[:m.end()] + insert_text + content[m.end():]
        applied += 1
    else:
        print(f"PATTERN NOT FOUND for {src_name}")
        skipped += 1

with open(f, 'w') as fh:
    fh.write(content)

print(f"\nApplied: {applied}")
print(f"Already set (idempotent skip): {already_set}")
print(f"Skipped: {skipped}")
