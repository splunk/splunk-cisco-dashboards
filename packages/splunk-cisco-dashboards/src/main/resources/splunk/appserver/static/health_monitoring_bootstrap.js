/**
 * Bootstrap loader for the Health Monitoring Dashboard React bundle.
 */
var scdHealthMonitoringAssetVersion = Date.now();
var scdHealthMonitoringLocaleMatch = window.location.pathname.match(
    /^\/([a-z]{2}-[A-Z]{2})(?:\/|$)/
);
var scdHealthMonitoringLocalePrefix =
    '/' + (scdHealthMonitoringLocaleMatch ? scdHealthMonitoringLocaleMatch[1] : 'en-US');
require([
    scdHealthMonitoringLocalePrefix +
        '/static/app/splunk-cisco-dashboards/pages/health_monitoring.js?v=' +
        scdHealthMonitoringAssetVersion,
], function () {
    // The React bundle self-initializes on load.
});
