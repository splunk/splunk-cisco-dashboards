/** Loads the React-native Secure Networking Pillars bundle. */
function scdLoadSecureNetworkingPillarsBundle() {
    var scdSecureNetworkingPillarsAssetVersion = Date.now();
    require([
        '/static/app/splunk-cisco-dashboards/pages/secure_networking_pillars.js?v=' +
            scdSecureNetworkingPillarsAssetVersion,
    ], function () {
        // The bundle mounts itself into the Simple XML #scan-root host.
    });
}

function scdLoadSecureNetworkingPillarsWhenConfigured() {
    // application.js establishes this first-run gate before Simple XML view
    // scripts execute. Fail open for nonstandard shells that omit the gate,
    // matching the established Home Workspace bootstrap behavior.
    var setupGate = window.scdSetupGatePromise;
    Promise.resolve(setupGate).then(function (canLoadApp) {
        if (canLoadApp !== false) scdLoadSecureNetworkingPillarsBundle();
    });
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    scdLoadSecureNetworkingPillarsWhenConfigured();
}
