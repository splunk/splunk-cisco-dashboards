/**
 * Bootstrap loader for the M365 Activity Monitoring React bundle.
 */
var scdAssetVersion = Date.now();
require([
    '/static/app/splunk-cisco-dashboards/pages/m365_activity_monitoring.js?v=' +
        scdAssetVersion,
], function () {
    // The React bundle self-initializes on load.
});
