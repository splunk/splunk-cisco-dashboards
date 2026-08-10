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
 * Apply the approved Insights Workspace density to every native Studio
 * Dashboard Manager view shipped by this app. Dashboard Manager is a
 * hash-routed SPA, so keep the body marker synchronized as users move between
 * dashboards.
 */
(function setManagedStudioTemplate() {
  const managedDashboards = new Set([
    "asset_inventory_v1",
    "building_v1",
    "it_health_v1",
    "netops_readiness_v1",
    "secure_networking_agentic_ops",
    "secure_networking_agentic_ops_executive_overview",
    "secure_networking_hmf_dlp_cloud_native_security",
    "secure_networking_hmf_sdwan_network_health_monitoring",
    "secure_networking_hmf_threat_detection_enforcement",
    "secure_networking_hybrid_mesh_firewalling",
    "secure_networking_scalable_network_segmentation",
    "secure_networking_secure_infrastructure",
    "secure_networking_secure_infrastructure_status",
    "secure_networking_segmentation_overview",
    "secure_networking_zta",
    "secure_networking_zta_authentication_policy_enforcement",
    "secure_networking_zta_detection_response",
    "secure_networking_zta_policy_management",
    "secure_networking_zta_ravpn_sessions_and_posture",
    "secure_networking_zta_user_activity_monitoring",
    "security_v1",
    "spaces_intelligence_v1",
    "statewide_exercise_v1",
    "statewide_exercise_v1_studio_modern",
    "workplace_spog_v1",
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
