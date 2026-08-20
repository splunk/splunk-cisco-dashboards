/**
 * Bootstrap loader for the Network Topology Canvas v1 React bundle.
 *
 * Mirrors `executive_insights_bootstrap.js`: Simple XML loads this via the
 * `<dashboard script="...">` attribute. We require() the webpack
 * bundle which mounts itself into `#scan-root` inside the panel.
 *
 * The cache-bust query string ensures iterative dashboard changes
 * don't leave browsers running a stale broken bundle while we're
 * still iterating on the topology canvas spike.
 */
var scdAssetVersion = Date.now();
var scdLocaleMatch = window.location.pathname.match(
    /^\/([a-z]{2}-[A-Z]{2})(?:\/|$)/
);
var scdLocalePrefix = '/' + (scdLocaleMatch ? scdLocaleMatch[1] : 'en-US');
require([
    scdLocalePrefix +
        '/static/app/splunk-cisco-dashboards/pages/topology_canvas_v1.js?v=' +
        scdAssetVersion,
], function () {
    // The React bundle self-initializes on load.
});
