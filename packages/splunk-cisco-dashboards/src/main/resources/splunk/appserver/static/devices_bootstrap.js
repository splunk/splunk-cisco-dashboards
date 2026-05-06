/**
 * Bootstrap loader for the Devices page React bundle.
 */
var scdAssetVersion = Date.now();
require([
    '/static/app/splunk-cisco-dashboards/pages/devices.js?v=' + scdAssetVersion,
], function () {
    // The React bundle self-initializes on load.
});
