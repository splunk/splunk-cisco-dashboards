/**
 * Bootstrap loader for the User Guide React bundle.
 *
 * Simple XML loads this file via RequireJS and the bundle mounts into
 * #scan-root inside the dashboard's HTML panel.
 */
var scdUserGuideAssetVersion = Date.now();
require([
    '/static/app/splunk-cisco-dashboards/pages/user_guide.js?v=' +
        scdUserGuideAssetVersion,
], function () {
    // The React bundle self-initializes on load.
});
