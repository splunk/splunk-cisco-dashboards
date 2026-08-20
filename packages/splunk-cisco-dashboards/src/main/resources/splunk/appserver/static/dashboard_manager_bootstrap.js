/**
 * Restart-safe Simple XML bootstrap for Dashboard Manager.
 *
 * A custom appserver/templates page is not available to Splunk Web until its
 * Mako template lookup is refreshed. Loading the manager from a standard view
 * keeps a first install and an in-place upgrade immediately usable.
 */
(function scdBootstrapDashboardManager() {
  "use strict";

  if (window.scdDashboardManagerBootstrapStarted) return;
  window.scdDashboardManagerBootstrapStarted = true;
  document.body.classList.add("scd-dashboard-manager-shell");

  var localeMatch = window.location.pathname.match(
    /^\/([a-z]{2}-[A-Z]{2})(?:\/|$)/,
  );
  var localePrefix = "/" + (localeMatch ? localeMatch[1] : "en-US");
  var assetBase =
    localePrefix + "/static/app/splunk-cisco-dashboards/";
  var assetVersion = Date.now();

  function assetUrl(relativePath) {
    return assetBase + relativePath + "?v=" + assetVersion;
  }

  function loadStylesheet(relativePath, marker) {
    if (document.querySelector("link[" + marker + "]")) return;
    var stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = assetUrl(relativePath);
    stylesheet.setAttribute(marker, "true");
    document.head.appendChild(stylesheet);
  }

  function loadScript(relativePath, marker, onLoad, onError) {
    var existing = document.querySelector("script[" + marker + "]");
    if (existing) {
      if (existing.dataset.scdLoaded === "true") {
        onLoad();
      } else {
        existing.addEventListener("load", onLoad, { once: true });
        existing.addEventListener("error", onError, { once: true });
      }
      return;
    }

    var script = document.createElement("script");
    script.src = assetUrl(relativePath);
    script.setAttribute(marker, "true");
    script.onload = function () {
      script.dataset.scdLoaded = "true";
      onLoad();
    };
    script.onerror = onError;
    document.body.appendChild(script);
  }

  function renderLoadError() {
    var root = document.getElementById("scan-root");
    if (!root) return;

    root.replaceChildren();
    var panel = document.createElement("div");
    panel.className = "scd-dashboard-manager-load-error";

    var title = document.createElement("h2");
    title.textContent = "Dashboard Manager could not load";
    panel.appendChild(title);

    var detail = document.createElement("p");
    detail.textContent =
      "A required app asset was unavailable. Refresh this page after confirming the app upgrade completed.";
    panel.appendChild(detail);

    var retry = document.createElement("button");
    retry.type = "button";
    retry.textContent = "Refresh page";
    retry.addEventListener("click", function () {
      window.location.reload();
    });
    panel.appendChild(retry);
    root.appendChild(panel);
  }

  function loadDashboardManagerBundle() {
    loadScript(
      "pages/dashboardbuilder.js",
      "data-scd-dashboard-manager-bundle",
      function () {},
      renderLoadError,
    );
  }

  function loadBundleAfterSetupGate() {
    Promise.resolve(window.scdSetupGatePromise)
      .then(function (canLoadApp) {
        if (canLoadApp !== false) loadDashboardManagerBundle();
      })
      .catch(loadDashboardManagerBundle);
  }

  loadStylesheet("application.css", "data-scd-dashboard-manager-styles");
  loadScript(
    "dashboard.js",
    "data-scd-dashboard-manager-title-script",
    function () {},
    function () {
      // Title and route styling are optional; the manager remains usable.
    },
  );

  if (window.scdSetupGatePromise) {
    loadBundleAfterSetupGate();
  } else {
    loadScript(
      "application.js",
      "data-scd-dashboard-manager-setup-gate",
      loadBundleAfterSetupGate,
      loadDashboardManagerBundle,
    );
  }
})();
