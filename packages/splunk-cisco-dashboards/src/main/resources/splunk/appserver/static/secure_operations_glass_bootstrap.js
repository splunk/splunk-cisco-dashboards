/**
 * Loads the React bundle for the Secure Operations Glass Simple XML view.
 */
var scdSecureOperationsGlassAssetVersion = Date.now();
var scdSecureOperationsGlassLocaleMatch = window.location.pathname.match(
    /^\/([a-z]{2}-[A-Z]{2})(?:\/|$)/
);
var scdSecureOperationsGlassLocalePrefix =
    '/' +
    (scdSecureOperationsGlassLocaleMatch
        ? scdSecureOperationsGlassLocaleMatch[1]
        : 'en-US');
require([
    scdSecureOperationsGlassLocalePrefix +
        '/static/app/splunk-cisco-dashboards/pages/secure_operations_glass.js?v=' +
        scdSecureOperationsGlassAssetVersion,
], function () {
    // The React bundle mounts itself into #scan-root.
});
