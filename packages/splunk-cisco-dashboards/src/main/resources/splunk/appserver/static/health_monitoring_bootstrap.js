/**
 * Bootstrap loader for the Health Monitoring Dashboard React bundle.
 */
var scdHealthMonitoringAssetVersion = Date.now();
require([
    '/static/app/splunk-cisco-dashboards/pages/health_monitoring.js?v=' +
        scdHealthMonitoringAssetVersion,
], function () {
    // The React bundle self-initializes on load.
});
