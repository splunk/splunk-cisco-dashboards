const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const packageRoot = path.resolve(__dirname, '..');
const searchbase = fs.readFileSync(
    path.join(packageRoot, 'src/main/resources/splunk/default/searchbase.conf'),
    'utf8'
);

const expectedEnabled = new Set([
    'building_resilience_environmental_health_index:overview:environmental_health',
    'executive_dashboard_it_domain_score:overview:it_domain_score',
    'executive_dashboard_it_domain_score:overview:executive_it_score',
    'executive_dashboard_security_domain_score:overview:sec_score',
    'executive_dashboard_security_domain_score:overview:executive_security_score',
    'it_critical_systems_compliance_rate:overview:compliance_rate',
    'it_critical_systems_device_health_score:overview:device_health',
    'it_critical_systems_network_health_score:overview:network_health',
    'security_resilience_ise_radius_latency:overview:zta_ise_radius_latency',
    'executive_dashboard_ds_ux_score:overview:executive_ux_score',
    'overview_active_critical_alerts:overview:executive_active_alerts',
    'overview_inter_site_latency:mapFooter',
    'overview_xdr_critical_incidents:overview:xdr_critical',
    'overview_ap_health:overview:ap_health',
    'it_critical_systems_site_link_availability_pct_trend:mapFooter',
    'executive_dashboard_critical_website_availability:overview:critical_website_availability',
    'feed_monitor_thousandeyes_stream_staleness:overview:agentic_ops_thousandeyes_feed_health',
    'feed_monitor_ftd_firewall_staleness:overview:hmf_ftd_feed_health',
    'feed_monitor_ise_syslog_staleness:overview:zta_ise_feed_health',
    'secure_networking_zta_ise_failed_auth_pct:overview:secure_networking_zta_ise_failed_auth_pct',
    'secure_networking_dc_anomaly_count:overview:secure_networking_dc_anomaly_count',
    'secure_networking_dc_advisory_count:overview:secure_networking_dc_advisory_count',
    'secure_networking_meraki_rogue_ap_count:overview:secure_networking_meraki_rogue_ap_count',
    'secure_networking_meraki_unencrypted_ssid_count:overview:secure_networking_meraki_unencrypted_ssid_count',
    'secure_networking_thousandeyes_test_success_vs_failed:overview:secure_networking_thousandeyes_test_success_vs_failed',
    'secure_networking_thousandeyes_avg_latency:overview:secure_networking_thousandeyes_avg_latency',
    'secure_networking_thousandeyes_avg_loss_pct:overview:secure_networking_thousandeyes_avg_loss_pct',
    'secure_networking_thousandeyes_avg_jitter:overview:secure_networking_thousandeyes_avg_jitter',
    'secure_networking_thousandeyes_network_loss_trend:overview:secure_networking_thousandeyes_network_loss_trend',
    'secure_networking_thousandeyes_web_transaction_errors:overview:secure_networking_thousandeyes_web_transaction_errors',
    'secure_networking_sdwan_apps_health_breakdown:overview:secure_networking_sdwan_apps_health_breakdown',
    'secure_networking_zta_ise_auth_failure_rate_trend:overview:secure_networking_zta_ise_auth_failure_rate_trend',
    'secure_networking_thousandeyes_latency_by_agent_trend:overview:secure_networking_thousandeyes_latency_by_agent_trend',
    'secure_networking_thousandeyes_http_availability_by_test_trend:overview:secure_networking_thousandeyes_http_availability_by_test_trend',
    'secure_networking_webex_join_time_trend:overview:secure_networking_webex_join_time_trend',
    'secure_networking_assurance_score_trend:overview:secure_networking_assurance_score_trend',
    'secure_networking_assurance_attainability_trend:overview:secure_networking_assurance_attainability_trend',
    'secure_networking_assurance_retainability_trend:overview:secure_networking_assurance_retainability_trend',
    'secure_networking_assurance_quality_trend:overview:secure_networking_assurance_quality_trend',
    'secure_networking_assurance_contextual_risk_trend:overview:secure_networking_assurance_contextual_risk_trend',
]);

const expectedBands = new Map([
    ['executive_dashboard_security_domain_score:overview:sec_score', [95, 90]],
    ['executive_dashboard_security_domain_score:overview:executive_security_score', [95, 90]],
    ['it_critical_systems_compliance_rate:overview:compliance_rate', [95, 85]],
    ['overview_active_critical_alerts:overview:executive_active_alerts', [0, 5]],
    ['overview_xdr_critical_incidents:overview:xdr_critical', [0, 1]],
    ['overview_ap_health:overview:ap_health', [99, 92]],
    ['secure_networking_zta_ise_failed_auth_pct:overview:secure_networking_zta_ise_failed_auth_pct', [5, 15]],
    ['secure_networking_dc_anomaly_count:overview:secure_networking_dc_anomaly_count', [0, 1]],
    ['secure_networking_dc_advisory_count:overview:secure_networking_dc_advisory_count', [0, 1]],
    ['secure_networking_meraki_rogue_ap_count:overview:secure_networking_meraki_rogue_ap_count', [0, 5]],
    ['secure_networking_meraki_unencrypted_ssid_count:overview:secure_networking_meraki_unencrypted_ssid_count', [0, 1]],
    ['secure_networking_thousandeyes_test_success_vs_failed:overview:secure_networking_thousandeyes_test_success_vs_failed', [0, 3]],
    ['secure_networking_thousandeyes_avg_latency:overview:secure_networking_thousandeyes_avg_latency', [50, 100]],
    ['secure_networking_thousandeyes_avg_loss_pct:overview:secure_networking_thousandeyes_avg_loss_pct', [1, 3]],
    ['secure_networking_thousandeyes_network_loss_trend:overview:secure_networking_thousandeyes_network_loss_trend', [1, 3]],
    ['secure_networking_thousandeyes_web_transaction_errors:overview:secure_networking_thousandeyes_web_transaction_errors', [0, 10]],
    ['secure_networking_sdwan_apps_health_breakdown:overview:secure_networking_sdwan_apps_health_breakdown', [0, 3]],
    ['secure_networking_zta_ise_auth_failure_rate_trend:overview:secure_networking_zta_ise_auth_failure_rate_trend', [5, 15]],
    ['secure_networking_assurance_score_trend:overview:secure_networking_assurance_score_trend', [80, 65]],
    ['secure_networking_assurance_attainability_trend:overview:secure_networking_assurance_attainability_trend', [99, 95]],
    ['secure_networking_assurance_retainability_trend:overview:secure_networking_assurance_retainability_trend', [95, 85]],
    ['secure_networking_assurance_quality_trend:overview:secure_networking_assurance_quality_trend', [80, 65]],
    ['secure_networking_assurance_contextual_risk_trend:overview:secure_networking_assurance_contextual_risk_trend', [0.8, 0.65]],
]);

const thresholdEntries = [];
for (const block of searchbase.split(/(?=^\[)/m)) {
    const stanza = block.match(/^\[([^\]]+)\]/m)?.[1];
    const rawVizOptions = block.match(/^viz_options = (.+)$/m)?.[1];
    if (!stanza || !rawVizOptions) {
        continue;
    }

    const vizOptions = JSON.parse(rawVizOptions);
    for (const [index, item] of (vizOptions.overview || []).entries()) {
        if (!item?.thresholds) {
            continue;
        }
        thresholdEntries.push({
            id: `${stanza}:overview:${item.tileId ?? index}`,
            thresholds: item.thresholds,
            item,
        });
    }

    if (vizOptions.mapFooter?.thresholds) {
        thresholdEntries.push({
            id: `${stanza}:mapFooter`,
            thresholds: vizOptions.mapFooter.thresholds,
            item: vizOptions.mapFooter,
        });
    }
}

assert.equal(thresholdEntries.length, 97, 'Every known threshold object must remain in the audit');
assert.equal(new Set(thresholdEntries.map(({ id }) => id)).size, 97, 'Threshold audit IDs must be unique');

for (const { id, thresholds } of thresholdEntries) {
    assert.equal(typeof thresholds.enabled, 'boolean', `${id} must declare an explicit enabled state`);
    assert.ok(Number.isFinite(thresholds.warning), `${id} must have a finite warning threshold`);
    assert.ok(Number.isFinite(thresholds.critical), `${id} must have a finite critical threshold`);
    assert.ok(
        ['higher_is_better', 'lower_is_better'].includes(thresholds.direction),
        `${id} must use a supported threshold direction`
    );

    if (thresholds.direction === 'higher_is_better') {
        assert.ok(thresholds.critical < thresholds.warning, `${id} higher-is-better bands are reversed`);
    } else {
        assert.ok(thresholds.warning < thresholds.critical, `${id} lower-is-better bands are reversed`);
    }

    assert.equal(
        thresholds.enabled,
        expectedEnabled.has(id),
        `${id} does not match the reviewed default threshold policy`
    );
}

for (const [id, [warning, critical]] of expectedBands) {
    const entry = thresholdEntries.find((candidate) => candidate.id === id);
    assert.ok(entry, `${id} must remain in the threshold inventory`);
    assert.equal(entry.thresholds.warning, warning, `${id} warning band drifted`);
    assert.equal(entry.thresholds.critical, critical, `${id} critical band drifted`);
}

const networkLoss = thresholdEntries.find(
    ({ id }) =>
        id ===
        'secure_networking_thousandeyes_network_loss_trend:overview:secure_networking_thousandeyes_network_loss_trend'
);
assert.equal(networkLoss.item.unit, '%', 'ThousandEyes network-loss threshold preview must show percent units');

console.log(
    `✓ Reviewed ${thresholdEntries.length} Searchbase threshold objects: ` +
        `${expectedEnabled.size} enabled and ${thresholdEntries.length - expectedEnabled.size} disabled by default`
);
