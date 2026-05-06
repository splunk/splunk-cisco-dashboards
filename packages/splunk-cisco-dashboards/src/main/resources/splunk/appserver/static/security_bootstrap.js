/**
 * Bootstrap loader for the Security page React bundle.
 */
var scdAssetVersion = Date.now();
require([
    '/static/app/splunk-cisco-dashboards/pages/security.js?v=' + scdAssetVersion,
], function () {
    // The React bundle self-initializes on load.
});
