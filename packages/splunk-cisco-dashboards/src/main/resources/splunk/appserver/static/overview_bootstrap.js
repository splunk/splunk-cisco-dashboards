/**
 * Bootstrap loader for the Overview page React bundle.
 *
 * Simple XML loads this file via RequireJS (declared in the
 * <dashboard script="..."> attribute). We require() the webpack-built
 * bundle which mounts itself into #scan-root inside the panel.
 *
 * Splunk serves app static assets with long-lived cache headers. Keep
 * the React bundle request cache-busted so iterative dashboard changes
 * do not leave browsers running a stale broken bundle.
 */
var scdAssetVersion = Date.now();
require([
    '/static/app/splunk-cisco-dashboards/pages/overview.js?v=' + scdAssetVersion,
], function () {
    // The React bundle self-initializes on load.
});
