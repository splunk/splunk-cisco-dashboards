/**
 * Bootstrap loader for the Searchbase Canvas React bundle.
 *
 * Simple XML loads this file via RequireJS and the bundle mounts into
 * #scan-root inside the dashboard's HTML panel.
 */
var scdAssetVersion = Date.now();
require([
    '/static/app/splunk-cisco-dashboards/pages/searchbase_canvas.js?v=' +
        scdAssetVersion,
], function () {
    // The React bundle self-initializes on load.
});
