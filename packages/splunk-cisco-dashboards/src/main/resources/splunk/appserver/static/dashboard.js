/**
 * Keep browser-tab titles consistent across Classic and Studio dashboards.
 * Splunk appends its product version after the dashboard label; remove that
 * suffix and apply the Secure Networking product acronym exactly once.
 */
(function setSasnDashboardTitle() {
  const prefix = "SSNE | ";
  const splunkVersionSuffix = /\s*\|\s*Splunk(?:\s+Enterprise)?\s+[\w.-]+\s*$/i;
  const sasnPrefix = /^(?:SSNE\s*\|\s*)+/i;

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
 * Apply the approved Insights Workspace density to every native Studio
 * Dashboard Manager view shipped by this app. Dashboard Manager is a
 * hash-routed SPA, so keep the body marker synchronized as users move between
 * dashboards.
 */
(function setManagedStudioTemplate() {
  const managedDashboards = new Set([
    "admin_asset_inventory",
    "workplace_building_intelligence",
    "netops_critical_systems_health",
    "netops_readiness",
    "sn_agentic_ops_operational_intelligence",
    "sn_agentic_ops_executive_assurance",
    "sn_agentic_ops_secure_networking_assurance",
    "sn_hmf_dlp_cloud_native_security",
    "sn_hmf_sdwan_network_health",
    "sn_hmf_threat_detection_enforcement",
    "sn_hmf_enforcement",
    "sn_segmentation_readiness",
    "sn_secure_infrastructure_posture",
    "sn_secure_infrastructure_status",
    "sn_segmentation_operations",
    "sn_zta_posture",
    "sn_zta_authentication_policy_enforcement",
    "sn_zta_detection_response",
    "sn_zta_policy_management",
    "sn_zta_ravpn_sessions_and_posture",
    "sn_zta_user_activity_monitoring",
    "secops_resilience",
    "workplace_spaces_intelligence",
    "netops_catalyst_health",
    "netops_catalyst_operations",
    "workplace_operations_overview",
  ]);
  const templateClass = "scd-managed-studio-template";

  const applyTemplateClass = () => {
    const dashboardId = window.location.hash
      .replace(/^#\/?/, "")
      .split(/[/?&]/, 1)[0];
    document.body.classList.toggle(
      templateClass,
      managedDashboards.has(dashboardId),
    );
  };

  applyTemplateClass();
  window.addEventListener("hashchange", applyTemplateClass);
})();
