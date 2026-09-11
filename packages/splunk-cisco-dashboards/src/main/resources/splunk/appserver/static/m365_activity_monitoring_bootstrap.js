/**
 * Bootstrap loader for the M365 Activity Monitoring React bundle.
 */
var scdAssetVersion = Date.now();
var scdLocaleMatch = window.location.pathname.match(
    /^\/([a-z]{2}-[A-Z]{2})(?:\/|$)/
);
var scdLocalePrefix = '/' + (scdLocaleMatch ? scdLocaleMatch[1] : 'en-US');
require([
    scdLocalePrefix +
        '/static/app/splunk-cisco-dashboards/pages/m365_activity_monitoring.js?v=' +
        scdAssetVersion,
], function () {
    // The React bundle self-initializes on load.
});
