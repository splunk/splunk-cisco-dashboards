/**
 * Bootstrap loader for the User Guide React bundle.
 *
 * Simple XML loads this file via RequireJS and the bundle mounts into
 * #scan-root inside the dashboard's HTML panel.
 */
var scdUserGuideAssetVersion = Date.now();
var scdUserGuideLocaleMatch = window.location.pathname.match(
    /^\/([a-z]{2}-[A-Z]{2})(?:\/|$)/
);
var scdUserGuideLocalePrefix =
    '/' + (scdUserGuideLocaleMatch ? scdUserGuideLocaleMatch[1] : 'en-US');
require([
    scdUserGuideLocalePrefix +
        '/static/app/splunk-cisco-dashboards/pages/user_guide.js?v=' +
        scdUserGuideAssetVersion,
], function () {
    // The React bundle self-initializes on load.
});
