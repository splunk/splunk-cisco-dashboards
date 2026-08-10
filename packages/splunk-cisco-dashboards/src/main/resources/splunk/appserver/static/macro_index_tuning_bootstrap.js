/* global require */
/* eslint-disable global-require, import/no-dynamic-require */

/**
 * Bootstrap loader for the Macro Index Tuning React bundle.
 *
 * Simple XML loads this file via RequireJS and the bundle mounts into
 * #scan-root inside the dashboard's HTML panel.
 */
const scdAssetVersion = Date.now();
if (/\/admin_macro_index_tuning\/?$/.test(window.location.pathname)) {
  window.location.replace(
        `${window.location.pathname.replace(
            /\/admin_macro_index_tuning\/?$/,
            '/setup',
        )}?setup=1#tune-indexes`,
    );
} else {
    const tuningBundle =
        `/static/app/splunk-cisco-dashboards/pages/macro_index_tuning.js?v=${scdAssetVersion}`;
    require([
        tuningBundle,
    ], () => {
        // The React bundle self-initializes on load.
    });
}
