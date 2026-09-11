/**
 * Bootstrap loader for the Searchbase Canvas React bundle.
 *
 * Simple XML loads this file via RequireJS and the bundle mounts into
 * #scan-root inside the dashboard's HTML panel.
 */
var scdAssetVersion = Date.now();
var scdLocaleMatch = window.location.pathname.match(
    /^\/([a-z]{2}-[A-Z]{2})(?:\/|$)/
);
var scdLocalePrefix = '/' + (scdLocaleMatch ? scdLocaleMatch[1] : 'en-US');
require([
    scdLocalePrefix +
        '/static/app/splunk-cisco-dashboards/pages/searchbase_canvas.js?v=' +
        scdAssetVersion,
], function () {
    // The React bundle self-initializes on load.
});
