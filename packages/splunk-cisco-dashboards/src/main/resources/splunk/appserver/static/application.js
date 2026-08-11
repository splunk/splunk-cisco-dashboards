/**
 * App-wide first-run gate. A successful setup.conf read reporting "0"
 * redirects direct dashboard URLs to the static Simple XML setup view.
 */
(function scdSetupGate() {
  const app = "splunk-cisco-dashboards";
  const setupViews = new Set(["setup", "admin_macro_index_tuning"]);
  const parts = window.location.pathname.split("/").filter(Boolean);
  const appIndex = parts.indexOf(app);
  const currentView = appIndex >= 0 ? parts[appIndex + 1] || "" : "";
  if (appIndex < 0 || setupViews.has(currentView)) {
    window.scdSetupGatePromise = Promise.resolve(true);
    return;
  }

  const localeMatch = window.location.pathname.match(
    /^\/([a-z]{2}-[A-Z]{2})(?:\/|$)/,
  );
  const locale = `/${localeMatch ? localeMatch[1] : "en-US"}`;
  const endpoint = `${locale}/splunkd/__raw/servicesNS/nobody/${encodeURIComponent(
    app,
  )}/configs/conf-setup/install?output_mode=json`;

  window.scdSetupGatePromise = fetch(endpoint, {
    credentials: "include",
    headers: {
      Accept: "application/json",
      "X-Requested-With": "XMLHttpRequest",
    },
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.json();
    })
    .then((payload) => {
      const entry = payload && payload.entry && payload.entry[0];
      const value = entry && entry.content && entry.content.is_configured;
      const configured =
        value === "1" || value === 1 || value === true || value === "true";
      if (!configured) {
        window.location.replace(
          `${locale}/app/${encodeURIComponent(app)}/setup`,
        );
      }
      return configured;
    })
    .catch(() => {
      // Fail open on an unavailable configuration endpoint to avoid a loop.
      return true;
    });
})();
