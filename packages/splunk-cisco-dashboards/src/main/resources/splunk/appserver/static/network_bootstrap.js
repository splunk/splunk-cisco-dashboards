/**
 * Bootstrap loader for the Network page React bundle.
 */
var scdAssetVersion = Date.now();
require([
    '/static/app/splunk-cisco-dashboards/pages/network.js?v=' + scdAssetVersion,
], function () {
    // The React bundle self-initializes on load.
});
