"use strict";

const assert = require("assert").strict;
const fs = require("fs");
const path = require("path");

const packageRoot = path.resolve(__dirname, "..");
const searchbase = fs.readFileSync(
  path.join(
    packageRoot,
    "src/main/resources/splunk/default/searchbase.conf",
  ),
  "utf8",
);

const stanzaBody = (name) => {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = `${searchbase}\n[__test_end__]\n`.match(
    new RegExp(`^\\[${escaped}\\]\\n([\\s\\S]*?)(?=^\\[)`, "m"),
  );
  assert.ok(match, `Missing Searchbase stanza ${name}`);
  return match[1];
};

const searchText = (name) => {
  const body = stanzaBody(name);
  const match = body.match(/^search = ([\s\S]*)/m);
  assert.ok(match, `Missing search field in ${name}`);
  return match[1];
};

const commands = (name, command) =>
  searchText(name)
    .split("|")
    .map((part) => part.trim())
    .filter((part) => new RegExp(`^${command}\\b`, "i").test(part));

const pickerAdaptiveTstats = [
  "agentic_soc_firewall_connection_volume",
  "agentic_soc_firewall_intrusion_threats",
  "agentic_soc_firewall_security_intelligence",
  "agentic_soc_firewall_top_destination_ports",
  "agentic_soc_umbrella_application_inventory",
  "agentic_soc_umbrella_blocked_requests",
  "agentic_soc_umbrella_dns_requests",
  "agentic_soc_umbrella_unique_domains",
  "agentic_soc_unified_threat_activity",
  "agentic_soc_unified_xdr_severity",
  "agentic_soc_zeek_traffic_volume",
  "catalyst_center_all_clients_total_trend",
  "catalyst_center_client_health",
  "catalyst_center_past_week_client_trends",
  "catalyst_center_total_issue_trend",
  "catalyst_center_traffic_by_protocol_over_time",
  "catalyst_center_wired_health_trend",
  "catalyst_center_wired_total_trend",
  "catalyst_center_wireless_health",
  "catalyst_center_wireless_total_trend",
  "client_summary_client_count_over_time",
  "dashboard_it_health_v1_issues_trend",
  "dashboard_it_health_v1_kpi_issues",
  "dashboard_it_health_v1_kpi_net_health",
  "dashboard_it_health_v1_net_health_trend",
  "dashboard_it_health_v1_network_health",
  "dashboard_netops_readiness_v1_q10_recovery_health",
  "dashboard_spaces_intelligence_v1_net_kpi_client_health",
  "dashboard_workplace_spog_v1_t1_occupancy_kpi",
  "dc_networking_flow_overview_flow_drop_trend",
  "dc_networking_flow_overview_flow_egress_traffic_kbps",
  "dc_networking_flow_overview_flow_ingress_traffic_kbps",
  "dc_networking_flow_overview_flow_latency_trend",
  "dc_networking_host_traffics_host_traffic_kbps",
  "dc_networking_interface_stats_port_speed_over_time_per_interface_gbps",
  "enterprise_ds_wireless_client_trend_7d",
  "executive_dashboard_critical_website_availability_drilldown",
  "executive_dashboard_ds_security_trend_compare",
  "executive_dashboard_firewall_blocked_with_baseline",
  "executive_dashboard_network_health_score",
  "executive_summary_healthy_device_count",
  "executive_summary_issue_trend",
  "executive_summary_network_health_trend",
  "it_critical_systems_ds_device_health",
  "it_critical_systems_issue_trend",
  "it_critical_systems_network_health_trend",
  "it_critical_systems_site_connectivity_score_trend",
  "it_critical_systems_site_errors_discards_24h_trend",
  "it_critical_systems_site_link_events_24h_trend",
  "it_critical_systems_site_power_events_24h_trend",
  "it_critical_systems_weekoverweek_health",
  "it_health_te_net_bgp_path_change_by_monitor",
  "it_health_thousandeyes_alerts_timeline",
  "network_intelligence_ftd_action_ratio_trend",
  "network_intelligence_zeek_conn_blocked_ratio_trend_dm",
  "security_resilience_identity_events_trend",
  "security_resilience_ise_auth_trend",
  "security_resilience_privileged_logon_trend",
  "teuc_5_9_14_dns_resolution_time_trending",
  "teuc_5_9_35_http_server_response_time_tracking",
  "teuc_5_9_38_page_load_duration_trending",
  "teuc_5_9_47_alert_timeline_trending",
  "teuc_5_9_54_mttr_reduction_via_network_vs_application_isolation",
  "teuc_5_9_9_bgp_path_change_trending",
  "user_experience_client_count_trend",
  "user_experience_client_health_by_type",
  "user_experience_client_health_trend",
  "user_experience_guest_client_surge",
  // This sibling trend was not in the reported list but has the same picker contract.
  "agentic_soc_firewall_blocked_connections",
];

for (const name of pickerAdaptiveTstats) {
  const temporalTstats = commands(name, "tstats").filter((command) =>
    /\bBY\b[^|]*\b_time\b/i.test(command),
  );
  assert.ok(temporalTstats.length > 0, `${name} must time-bucket its tstats output`);
  for (const command of temporalTstats) {
    assert.match(
      command,
      /\b_time\s+span=auto\b/i,
      `${name} must use automatic tstats buckets with span next to _time`,
    );
    assert.doesNotMatch(
      command,
      /\bspan=\d+(?:\.\d+)?(?:s|m|h|d|w|mon|q|y)\b/i,
      `${name} must not pin a numeric tstats span`,
    );
  }
}

const pickerAdaptiveTimecharts = [
  "dashboard_netops_readiness_v1_score_nrs_trend",
  "catalyst_center_device_aggregate_throughput_trend",
  "dc_networking_vmware_esx_server_farm",
  "network_iosxr_memory_utilization_trend",
  "network_iosxr_interface_input_utilization",
  "network_iosxr_interface_output_utilization",
  "network_iosxr_peak_interface_throughput",
  "network_iosxr_bgp_established_pct",
  "network_iosxr_bgp_memory_use",
  "network_iosxr_bgp_throttled_neighbors",
  "network_iosxr_bgp_restart_count",
  "network_iosxr_bgp_session_state_trend",
  "network_iosxr_isis_route_count_rib",
  "security_resilience_sdwan_utd_amp_disposition_trend",
];

for (const name of pickerAdaptiveTimecharts) {
  const timecharts = commands(name, "timechart");
  assert.ok(timecharts.length > 0, `${name} must contain a timechart`);
  for (const command of timecharts) {
    assert.doesNotMatch(
      command,
      /\bspan=\d+(?:\.\d+)?(?:s|m|h|d|w|mon|q|y)\b/i,
      `${name} must let timechart choose its display span`,
    );
  }
}

const pickerAdaptiveBins = [
  "building_resilience_user_presence_trend",
  "catalyst_center_ap_reachability",
  "catalyst_center_client_activity_and_onboarding",
  "catalyst_center_device_aggregate_throughput_trend",
  "catalyst_center_wired_client_trend",
  "dashboard_building_v1_device_presence_trend",
  "dashboard_building_v1_occupancy_trend",
  "dashboard_building_v1_webex_people_trend",
  "dashboard_it_health_v1_config_trend",
  "dashboard_netops_readiness_v1_q4_onboarding_per_site",
  "dashboard_spaces_intelligence_v1_capacity_trend",
  "dashboard_spaces_intelligence_v1_convergence_health",
  "dashboard_spaces_intelligence_v1_env_occupancy_overlay",
  "dashboard_spaces_intelligence_v1_issues_with_occupancy",
  "dashboard_spaces_intelligence_v1_onboarding_vs_occupancy",
  "dashboard_spaces_intelligence_v1_operations_surge",
  "dashboard_spaces_intelligence_v1_wifi_with_occupancy",
  "dashboard_workplace_spog_v1_t3_network_power_kpi",
  "enterprise_ds_wired_client_trend_24h",
  "enterprise_ds_wireless_client_trend_24h",
  "secure_networking_assurance_contextual_risk_trend",
  "secure_networking_assurance_quality_trend",
];

for (const name of pickerAdaptiveBins) {
  const temporalBins = commands(name, "bin").filter((command) =>
    /\b_time\b/i.test(command),
  );
  assert.ok(temporalBins.length > 0, `${name} must bucket its time-series input`);
  assert.doesNotMatch(
    searchText(name),
    /\bspan\s*=/i,
    `${name} must let Splunk choose its bin size from the dispatch range`,
  );
}

const stanzaParts = searchbase.split(/^\[([^\]]+)\]\n/m);
const numericSpanStanzas = (commandName) => {
  const result = new Set();
  for (let index = 1; index < stanzaParts.length; index += 2) {
    const name = stanzaParts[index];
    const body = stanzaParts[index + 1];
    const searchMatch = body.match(/^search = ([\s\S]*)/m);
    if (!searchMatch) continue;
    const matchingCommands = searchMatch[1]
      .split("|")
      .map((part) => part.trim())
      .filter((part) => new RegExp(`^${commandName}\\b`, "i").test(part));
    if (
      matchingCommands.some((command) =>
        /\bspan=\d+(?:\.\d+)?(?:s|m|h|d|w|mon|q|y)\b/i.test(command),
      )
    ) {
      result.add(name);
    }
  }
  return [...result].sort();
};

assert.deepEqual(numericSpanStanzas("tstats"), [
  "dashboard_netops_readiness_v1_c_issues_forecast",
  "it_health_composite_service_alerts",
  "teuc_fit_alert_volume_timeslot_anomaly",
  "teuc_fit_bgp_path_changes_anomaly",
  "teuc_fit_latency_calendar_profile",
  "teuc_fit_multivariate_network_health_anomaly",
  "teuc_predict_http_availability_forecast",
  "teuc_predict_network_latency_forecast",
]);

assert.deepEqual(numericSpanStanzas("timechart"), [
  "building_resilience_predict_active_users_forecast",
  "building_resilience_predict_device_count_forecast",
  "building_resilience_predict_occupancy_forecast",
  "dashboard_netops_readiness_v1_a_nrs_forecast",
  "dashboard_spaces_intelligence_v1_capacity_predict",
  "dashboard_spaces_intelligence_v1_visitor_daily",
  "it_health_composite_service_health_score",
  "network_iosxr_mltk_cpu_anomaly",
  "spaces_predict_camera_headcount_24h_forecast",
  "spaces_predict_desk_utilization_forecast",
  "spaces_predict_iot_temperature_forecast",
  "spaces_predict_webex_active_calls_forecast",
]);

// Source/calculation cadence remains fixed where the math depends on it.
assert.match(
  searchText("dashboard_netops_readiness_v1_score_nrs_trend"),
  /bin _time span=1h/g,
);
assert.equal(
  (searchText("dc_networking_vmware_esx_server_farm").match(/bin _time span=1m/g) || [])
    .length,
  2,
);
assert.match(
  searchText("network_iosxr_peak_interface_throughput"),
  /mstats[\s\S]*span=5m[\s\S]*delta_bytes_received \* 8\) \/ 300/,
);
assert.match(
  searchText("network_iosxr_bgp_session_state_trend"),
  /mstats[\s\S]*span=10s[\s\S]*timechart min\(session_state\) AS worst_session_state/,
);

for (const name of [
  "dc_networking_flow_overview_flow_egress_traffic_kbps",
  "dc_networking_flow_overview_flow_ingress_traffic_kbps",
  "dc_networking_host_traffics_host_traffic_kbps",
]) {
  assert.match(searchText(name), /timechart per_second\(/);
}
assert.match(
  searchText("teuc_5_9_38_page_load_duration_trending"),
  /timechart avg\(avg_load_s\)/,
);

const pickerAdaptiveBinNames = new Set(pickerAdaptiveBins);
for (const name of new Set([
  ...pickerAdaptiveTstats.filter(
    (stanza) => stanza !== "executive_summary_healthy_device_count",
  ),
  ...pickerAdaptiveTimecharts,
])) {
  if (pickerAdaptiveBinNames.has(name)) continue;
  assert.match(stanzaBody(name), /^date_updated = 2026-09-02$/m);
}

for (const name of pickerAdaptiveBins) {
  assert.match(stanzaBody(name), /^date_updated = 2026-09-03$/m);
}

assert.match(
  stanzaBody("building_resilience_user_presence_trend"),
  /^solution = .*buckets selected automatically for the active time range\./m,
  "the user-presence guidance must describe its adaptive buckets",
);
assert.doesNotMatch(
  stanzaBody("building_resilience_user_presence_trend"),
  /^solution = .*15-minute buckets/m,
  "the user-presence guidance must not promise the retired fixed span",
);
