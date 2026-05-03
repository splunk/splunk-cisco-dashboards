/**
 * Bootstrap loader for the Overview page React bundle.
 *
 * Simple XML loads this file via RequireJS (declared in the
 * <dashboard script="..."> attribute). We require() the webpack-built
 * bundle which mounts itself into #scan-root inside the panel.
 */
require([
    '/static/app/splunk-cisco-dashboards/pages/overview.js',
], function () {
    // The React bundle self-initialises on load — nothing else to do.
});
