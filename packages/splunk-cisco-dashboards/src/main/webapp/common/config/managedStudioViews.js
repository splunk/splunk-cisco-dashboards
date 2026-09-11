import { INSIGHTS_APP_ID } from "../lib/constants";

export const DASHBOARD_MANAGER_TAG = "dashboard_manager";

// Only these packaged views use Dashboard Manager framework extensions.
// Routing an ordinary Studio view through the Manager shell does not make it a
// Dashboard Manager framework dashboard.
export const DASHBOARD_MANAGER_FRAMEWORK_VIEW_NAMES = new Set([
  "sn_agentic_ops_executive_assurance",
  "sn_agentic_ops_operational_intelligence",
  "sn_agentic_ops_secure_networking_assurance",
  "sn_data_center_operations",
  "sn_hmf_dlp_cloud_native_security",
  "sn_hmf_enforcement",
  "sn_hmf_sdwan_network_health",
  "sn_hmf_threat_detection_enforcement",
  "sn_secure_infrastructure_posture",
  "sn_secure_infrastructure_status",
  "sn_segmentation_operations",
  "sn_segmentation_readiness",
  "sn_zta_authentication_policy_enforcement",
  "sn_zta_detection_response",
  "sn_zta_policy_management",
  "sn_zta_posture",
  "sn_zta_ravpn_sessions_and_posture",
  "sn_zta_user_activity_monitoring",
]);

// These native Dashboard Studio views use the Manager route for presentation
// compatibility only. They are intentionally excluded from its library.
export const MANAGER_ROUTED_STUDIO_VIEW_NAMES = new Set([
  "admin_asset_inventory",
  "netops_catalyst_health",
  "netops_critical_systems_health",
  "netops_readiness",
  "secops_resilience",
  "workplace_building_intelligence",
  "workplace_operations_overview",
  "workplace_spaces_intelligence",
]);

export const DASHBOARD_MANAGER_EXTENSION_TYPES = new Set([
  "ds.searchbase",
  "input.simpleTimePicker",
  "splunk.template_kpi",
  "splunk.template_other",
  "splunk.cisco_spaces_space_manager",
  "splunk.cisco_drilldown_action",
]);

const normalizeValue = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const getDashboardAppFromServiceUri = (uri) => {
  if (!uri || typeof uri !== "string") {
    return "";
  }

  try {
    const pathname = /^https?:\/\//i.test(uri) ? new URL(uri).pathname : uri;
    const match = pathname.match(/\/servicesNS\/[^/]+\/([^/]+)\//);
    return match?.[1] ? decodeURIComponent(match[1]) : "";
  } catch (error) {
    return "";
  }
};

export const getDashboardNamespaceApp = (entry) =>
  entry?.app ||
  entry?.acl?.app ||
  entry?.content?.["eai:acl.app"] ||
  getDashboardAppFromServiceUri(entry?.id) ||
  getDashboardAppFromServiceUri(entry?.links?.alternate) ||
  entry?.content?.["eai:appName"] ||
  entry?.contentApp ||
  "";

const parseDashboardDefinition = (definition) => {
  if (definition && typeof definition === "object") {
    return definition;
  }

  if (typeof definition !== "string") {
    return undefined;
  }

  try {
    const parsedDefinition = JSON.parse(definition);
    return parsedDefinition && typeof parsedDefinition === "object"
      ? parsedDefinition
      : undefined;
  } catch (error) {
    return undefined;
  }
};

export const requiresDashboardManagerRuntime = (definition) => {
  const parsedDefinition = parseDashboardDefinition(definition);
  if (!parsedDefinition) {
    return false;
  }

  return ["dataSources", "visualizations", "inputs"].some((collectionName) =>
    Object.values(parsedDefinition[collectionName] || {}).some((component) =>
      DASHBOARD_MANAGER_EXTENSION_TYPES.has(component?.type),
    ),
  );
};

const hasLegacyDashboardManagerIdentity = (dashboard) => {
  const dashboardId = String(dashboard?.title || dashboard?.name || "");
  const dashboardTag = normalizeValue(dashboard?.tag);

  if (
    dashboardTag === DASHBOARD_MANAGER_TAG ||
    dashboardId.startsWith("scd_") ||
    DASHBOARD_MANAGER_FRAMEWORK_VIEW_NAMES.has(dashboardId) ||
    requiresDashboardManagerRuntime(dashboard?.definition)
  ) {
    return true;
  }

  return Array.from(DASHBOARD_MANAGER_FRAMEWORK_VIEW_NAMES).some(
    (managedViewName) => dashboardId.startsWith(`${managedViewName}_copy_`),
  );
};

export const getDashboardManagerScope = (dashboard, currentUsername) => {
  if (
    normalizeValue(getDashboardNamespaceApp(dashboard)) !==
    normalizeValue(INSIGHTS_APP_ID)
  ) {
    return undefined;
  }

  const dashboardId = String(dashboard?.title || dashboard?.name || "");
  const owner = normalizeValue(dashboard?.owner || dashboard?.author);
  const username = normalizeValue(currentUsername);

  if (
    username &&
    owner === username &&
    hasLegacyDashboardManagerIdentity(dashboard)
  ) {
    return "yours";
  }

  if (
    DASHBOARD_MANAGER_FRAMEWORK_VIEW_NAMES.has(dashboardId) &&
    normalizeValue(dashboard?.sharing) !== "user"
  ) {
    return "included";
  }

  if (
    normalizeValue(dashboard?.sharing) === "app" &&
    hasLegacyDashboardManagerIdentity(dashboard)
  ) {
    return "yours";
  }

  return undefined;
};

export const isDashboardManagerDashboard = (dashboard, currentUsername) =>
  Boolean(getDashboardManagerScope(dashboard, currentUsername));
