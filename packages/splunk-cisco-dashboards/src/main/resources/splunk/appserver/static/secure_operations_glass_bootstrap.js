/**
 * Loads the React bundle for the Secure Operations Glass Simple XML view.
 */
var scdSecureOperationsGlassAssetVersion = Date.now();
require([
    '/static/app/splunk-cisco-dashboards/pages/secure_operations_glass.js?v=' +
        scdSecureOperationsGlassAssetVersion,
], function () {
    // The React bundle mounts itself into #scan-root.
});
