/**
 * Bootstrap loader for the Network Diagram (Build 106) React bundle.
 *
 * Mirrors `topology_canvas_v1_bootstrap.js`: Simple XML loads this
 * via the `<dashboard script="...">` attribute. We require() the
 * webpack bundle which mounts itself into `#scan-root` inside the
 * panel.
 *
 * The cache-bust query string ensures iterative dashboard changes
 * don't leave browsers running a stale broken bundle while we're
 * still iterating on the diagram authoring experience.
 */
var scdAssetVersion = Date.now();
require([
    '/static/app/splunk-cisco-dashboards/pages/network_diagram.js?v=' + scdAssetVersion,
], function () {
    // The React bundle self-initializes on load.
});
