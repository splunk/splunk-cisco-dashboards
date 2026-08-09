/**
 * Keep browser-tab titles consistent across Classic and Studio dashboards.
 * Splunk appends its product version after the dashboard label; remove that
 * suffix and apply the Secure Networking product acronym exactly once.
 */
(function setSasnDashboardTitle() {
  const prefix = "SASN | ";
  const splunkVersionSuffix = /\s*\|\s*Splunk(?:\s+Enterprise)?\s+[\w.-]+\s*$/i;
  const sasnPrefix = /^(?:SASN\s*\|\s*)+/i;

  const normalizeTitle = (title) => {
    const dashboardName = String(title || "")
      .replace(splunkVersionSuffix, "")
      .replace(sasnPrefix, "")
      .trim();

    return dashboardName ? `${prefix}${dashboardName}` : "";
  };

  const applyTitle = () => {
    const nextTitle = normalizeTitle(document.title);
    if (nextTitle && document.title !== nextTitle) {
      document.title = nextTitle;
    }
  };

  applyTitle();

  const titleElement = document.querySelector("title");
  if (!titleElement || typeof MutationObserver === "undefined") {
    return;
  }

  const observer = new MutationObserver(applyTitle);
  observer.observe(titleElement, {
    childList: true,
    characterData: true,
    subtree: true,
  });
})();

/**
 * Pilot the Insights Workspace density on one Dashboard Studio story before
 * applying it to the full factory set. Dashboard Manager is a hash-routed SPA,
 * so keep the body marker synchronized as users move between dashboards.
 */
(function setStudioHomeDensityPilot() {
  const pilotDashboard =
    "secure_networking_zta_authentication_policy_enforcement";
  const pilotClass = "scd-studio-home-density-pilot";

  const applyPilotClass = () => {
    const dashboardId = window.location.hash
      .replace(/^#\/?/, "")
      .split(/[/?&]/, 1)[0];
    document.body.classList.toggle(pilotClass, dashboardId === pilotDashboard);
  };

  applyPilotClass();
  window.addEventListener("hashchange", applyPilotClass);
})();
