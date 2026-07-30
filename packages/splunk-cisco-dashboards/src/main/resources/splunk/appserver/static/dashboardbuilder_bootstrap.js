/**
 * Bootstrap loader for the Dashboard Manager React bundle.
 *
 * The Simple XML shell supplies Splunk 10.4's native application rail,
 * while the bundle mounts the Dashboard Manager runtime into #scan-root.
 */
var scdDashboardManagerAssetVersion = Date.now();
require([
    '/static/app/splunk-cisco-dashboards/pages/dashboardbuilder.js?v=' +
        scdDashboardManagerAssetVersion,
], function () {
    // The React bundle self-initializes on load.
});
