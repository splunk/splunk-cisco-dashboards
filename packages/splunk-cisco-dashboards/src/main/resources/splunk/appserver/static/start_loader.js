/**
 * Splunk serves app static assets with long-lived cache headers. Load the
 * setup controller and its stylesheet with a per-page cache key so fast app
 * installs are visible immediately without restarting Splunk.
 */
(function scdLoadSetupAssets() {
  const assetVersion = Date.now();
  const assetBase = "/static/app/splunk-cisco-dashboards/";

  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = `${assetBase}start.css?v=${assetVersion}`;
  document.head.appendChild(stylesheet);

  const script = document.createElement("script");
  script.src = `${assetBase}start_bootstrap.js?v=${assetVersion}`;
  document.body.appendChild(script);
})();
