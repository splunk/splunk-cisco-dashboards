export const DEFAULT_WORKSPACE_ID = "secure_networking";
export const LAST_WORKSPACE_STORAGE_KEY =
  "splunk-cisco-dashboards.lastWorkspace.v1";
export const LAST_WORKSPACE_COOKIE_NAME = "scd_last_workspace_v1";
export const EXECUTIVE_WORKSPACE_SOURCE_ID = "executive" as const;
export const SECURE_NETWORKING_WORKSPACE_SOURCE_ID =
  "secure_networking" as const;
export const AGENTIC_SOC_WORKSPACE_SOURCE_ID = "agentic_soc" as const;

export const WORKSPACE_SOURCE_IDS = [
  EXECUTIVE_WORKSPACE_SOURCE_ID,
  SECURE_NETWORKING_WORKSPACE_SOURCE_ID,
  AGENTIC_SOC_WORKSPACE_SOURCE_ID,
] as const;

export type WorkspaceSourceId = (typeof WORKSPACE_SOURCE_IDS)[number];
export type WorkspaceId = string;
export type WorkspaceMapPosition = "right" | "below" | "above";
export type WorkspaceRegionalView = "map" | "table";

export const ALL_WORKSPACE_SECTION_IDS = [
  "it_health",
  "security",
  "building",
  "custom",
  "zta",
  "secure_infrastructure",
  "scalable_network_segmentation",
  "hybrid_mesh_firewalling",
  "agentic_ops",
  "dns_security",
  "firewall_security",
  "network_detection",
  "unified_investigation",
] as const;

export type SectionId = (typeof ALL_WORKSPACE_SECTION_IDS)[number];

export const AGENTIC_SOC_WORKSPACE_ID =
  "agentic_security_operations_center" as const;

/**
 * Canonical packaged Agentic SOC layout inventory. Factory reset must use
 * this list instead of the effective runtime layout because a local override
 * can hide the very stanza that needs to be removed.
 */
export const PACKAGED_AGENTIC_SOC_LAYOUT_TILE_IDS = {
  dns_security: [
    "agentic_soc_umbrella_dns_requests",
    "agentic_soc_umbrella_unique_domains",
    "agentic_soc_umbrella_blocked_requests",
    "agentic_soc_umbrella_top_categories",
    "agentic_soc_umbrella_top_applications",
    "agentic_soc_umbrella_top_domains",
    "agentic_soc_umbrella_top_clients",
    "agentic_soc_umbrella_response_codes",
    "agentic_soc_umbrella_application_inventory",
  ],
  firewall_security: [
    "agentic_soc_firewall_connection_volume",
    "agentic_soc_firewall_security_intelligence",
    "agentic_soc_firewall_top_destination_ports",
    "agentic_soc_firewall_top_conversations",
    "agentic_soc_firewall_intrusion_threats",
    "agentic_soc_firewall_blocked_connections",
    "agentic_soc_firewall_destinations_by_country",
    "agentic_soc_firewall_top_rules",
    "agentic_soc_firewall_top_applications",
  ],
  network_detection: [
    "agentic_soc_zeek_traffic_volume",
    "agentic_soc_zeek_protocols",
    "agentic_soc_zeek_top_conversations",
    "agentic_soc_zeek_dns_queries",
    "agentic_soc_zeek_dns_response_codes",
    "agentic_soc_zeek_http_hosts",
    "agentic_soc_zeek_tls_posture",
    "agentic_soc_zeek_notices",
    "agentic_soc_zeek_file_types",
  ],
  unified_investigation: [
    "agentic_soc_unified_threat_activity",
    "agentic_soc_unified_xdr_severity",
    "agentic_soc_unified_xdr_status",
    "agentic_soc_unified_xdr_top_detections",
    "agentic_soc_unified_es_action_activity",
    "agentic_soc_unified_es_top_rules",
    "agentic_soc_unified_attack_analyzer_job_scores",
    "agentic_soc_unified_attack_analyzer_detections",
    "agentic_soc_unified_investigation_queue",
  ],
} as const;

export const PACKAGED_AGENTIC_SOC_SEARCHBASE_STANZA_IDS = Object.values(
  PACKAGED_AGENTIC_SOC_LAYOUT_TILE_IDS,
).flat();

export type WorkspaceSectionIcon =
  | "activity"
  | "shield"
  | "building"
  | "sparkles"
  | "shield-keyhole"
  | "servers"
  | "node-model"
  | "wall-bricks"
  | "robot-face-wrench"
  | "fingerprint-nodes"
  | "server-brackets"
  | "globe-division"
  | "column-arrows-left-right"
  | "robot-face-sparkle"
  | "shield-check"
  | "server-cog"
  | "network"
  | "firewall"
  | "globe"
  | "bot";

export interface WorkspaceSectionMeta {
  id: SectionId;
  title: string;
  linkText: string;
  href?: string;
  icon: WorkspaceSectionIcon;
  /** Optional packaged SVG used as a color-aware mask over the Lucide fallback. */
  iconSrc?: string;
}

export interface WorkspaceAutoDiscoveryConfig {
  stanzaPrefix?: string;
  requiredTag?: string;
  subCategoryToSection: Record<string, SectionId>;
}

export interface WorkspaceSource {
  id: WorkspaceSourceId;
  /** Complete cross-domain catalogue available to workspaces using this template. */
  sections: readonly WorkspaceSectionMeta[];
  /** Sections selected when a workspace is first created from this template. */
  defaultSectionIds: readonly SectionId[];
  defaultVisibleSections: readonly SectionId[];
  maxVisibleSections: number;
  minTileCount: number;
  maxTileCount: number;
  fallbackTileCount: number;
  autoDiscovery?: WorkspaceAutoDiscoveryConfig;
}

export interface InsightsWorkspace {
  id: WorkspaceId;
  label: string;
  sourceWorkspace: WorkspaceSourceId;
  headerTitle?: string;
  headerSubtitle?: string;
  defaultLogoSrc?: string;
  hideDefaultLogo?: boolean;
  sections: readonly WorkspaceSectionMeta[];
  defaultVisibleSections: readonly SectionId[];
  maxVisibleSections: number;
  minTileCount: number;
  maxTileCount: number;
  fallbackTileCount: number;
  autoDiscovery?: WorkspaceAutoDiscoveryConfig;
  legacyViewNames: readonly string[];
  isBuiltIn: boolean;
  enabled: boolean;
  sortOrder: number;
  mapVisible: boolean;
  mapPosition: WorkspaceMapPosition;
  regionalView: WorkspaceRegionalView;
}

const CROSS_DOMAIN_SECTIONS: readonly WorkspaceSectionMeta[] = [
  {
    id: "it_health",
    title: "IT Operations",
    linkText: "Open IT Operations",
    href: "dashboard_manager#/netops_critical_systems_health",
    icon: "activity",
  },
  {
    id: "security",
    title: "Security Operations",
    linkText: "Open Security Operations",
    href: "dashboard_manager#/secops_resilience",
    icon: "shield",
  },
  {
    id: "building",
    title: "Smart Spaces",
    linkText: "Open Smart Spaces",
    href: "dashboard_manager#/workplace_building_intelligence",
    icon: "building",
  },
  {
    id: "custom",
    title: "Executive Command Signals",
    linkText: "Open dashboard builder",
    href: "dashboard_manager",
    icon: "sparkles",
  },
] as const;

const SECURE_NETWORKING_SECTIONS: readonly WorkspaceSectionMeta[] = [
  {
    id: "zta",
    title: "Zero Trust Access",
    linkText: "Open Zero Trust Access",
    href: "dashboard_manager#/sn_zta_posture",
    icon: "fingerprint-nodes",
  },
  {
    id: "secure_infrastructure",
    title: "Secure Infrastructure",
    linkText: "Open Secure Infrastructure",
    href: "dashboard_manager#/sn_secure_infrastructure_posture",
    icon: "server-brackets",
  },
  {
    id: "scalable_network_segmentation",
    title: "Scalable Network Segmentation",
    linkText: "Open Scalable Network Segmentation",
    href: "dashboard_manager#/sn_segmentation_readiness",
    icon: "globe-division",
  },
  {
    id: "hybrid_mesh_firewalling",
    title: "Hybrid Mesh Firewalling",
    linkText: "Open Hybrid Mesh Firewalling",
    href: "dashboard_manager#/sn_hmf_enforcement",
    icon: "column-arrows-left-right",
  },
  {
    id: "agentic_ops",
    title: "Agentic Ops",
    linkText: "Open Agentic Ops",
    href: "dashboard_manager#/sn_agentic_ops_operational_intelligence",
    icon: "robot-face-sparkle",
  },
] as const;

const AGENTIC_SOC_SECTIONS: readonly WorkspaceSectionMeta[] = [
  {
    id: "dns_security",
    title: "DNS Security",
    linkText: "Open DNS security searches",
    href: "searchbase_canvas?category=Security&sub_category=DNS%20Security",
    icon: "globe",
  },
  {
    id: "firewall_security",
    title: "Firewall Threat Defense",
    linkText: "Open firewall threat searches",
    href: "searchbase_canvas?category=Security&sub_category=Firewall%20Threat%20Defense",
    icon: "firewall",
  },
  {
    id: "network_detection",
    title: "Network Detection & Response",
    linkText: "Open network detection searches",
    href: "searchbase_canvas?category=Security&sub_category=Network%20Detection%20%26%20Response",
    icon: "network",
  },
  {
    id: "unified_investigation",
    title: "Unified Detection & Investigation",
    linkText: "Open unified investigation searches",
    href: "searchbase_canvas?category=Security&sub_category=Unified%20Detection%20%26%20Investigation",
    icon: "shield-check",
  },
] as const;

/**
 * Section IDs are stable data contracts. Their owning source tells the runtime
 * which Searchbase overview definitions supply the factory tile catalogue.
 * Keeping that ownership separate from workspace templates lets a Secure
 * Networking workspace add real IT Operations or Security Operations content
 * (and vice versa) without duplicating searches or creating empty sections.
 */
export const WORKSPACE_SECTION_SOURCE: Record<SectionId, WorkspaceSourceId> = {
  it_health: EXECUTIVE_WORKSPACE_SOURCE_ID,
  security: EXECUTIVE_WORKSPACE_SOURCE_ID,
  building: EXECUTIVE_WORKSPACE_SOURCE_ID,
  custom: EXECUTIVE_WORKSPACE_SOURCE_ID,
  zta: SECURE_NETWORKING_WORKSPACE_SOURCE_ID,
  secure_infrastructure: SECURE_NETWORKING_WORKSPACE_SOURCE_ID,
  scalable_network_segmentation: SECURE_NETWORKING_WORKSPACE_SOURCE_ID,
  hybrid_mesh_firewalling: SECURE_NETWORKING_WORKSPACE_SOURCE_ID,
  agentic_ops: SECURE_NETWORKING_WORKSPACE_SOURCE_ID,
  dns_security: AGENTIC_SOC_WORKSPACE_SOURCE_ID,
  firewall_security: AGENTIC_SOC_WORKSPACE_SOURCE_ID,
  network_detection: AGENTIC_SOC_WORKSPACE_SOURCE_ID,
  unified_investigation: AGENTIC_SOC_WORKSPACE_SOURCE_ID,
};

export const getWorkspaceSectionSource = (
  sectionId: SectionId,
): WorkspaceSourceId => WORKSPACE_SECTION_SOURCE[sectionId];

const ALL_WORKSPACE_SECTIONS: readonly WorkspaceSectionMeta[] = [
  ...SECURE_NETWORKING_SECTIONS,
  ...CROSS_DOMAIN_SECTIONS,
  ...AGENTIC_SOC_SECTIONS,
] as const;

const SECURE_NETWORKING_DEFAULT_SECTION_IDS = SECURE_NETWORKING_SECTIONS.map(
  (section) => section.id,
);
const EXECUTIVE_DEFAULT_SECTION_IDS = CROSS_DOMAIN_SECTIONS.map(
  (section) => section.id,
);
const AGENTIC_SOC_DEFAULT_SECTION_IDS = AGENTIC_SOC_SECTIONS.map(
  (section) => section.id,
);

export const WORKSPACE_SOURCES: Record<WorkspaceSourceId, WorkspaceSource> = {
  executive: {
    id: EXECUTIVE_WORKSPACE_SOURCE_ID,
    sections: ALL_WORKSPACE_SECTIONS,
    defaultSectionIds: EXECUTIVE_DEFAULT_SECTION_IDS,
    defaultVisibleSections: ["it_health", "security", "building"],
    maxVisibleSections: 4,
    minTileCount: 3,
    maxTileCount: 9,
    fallbackTileCount: 3,
  },
  secure_networking: {
    id: SECURE_NETWORKING_WORKSPACE_SOURCE_ID,
    sections: ALL_WORKSPACE_SECTIONS,
    defaultSectionIds: SECURE_NETWORKING_DEFAULT_SECTION_IDS,
    defaultVisibleSections: [
      "zta",
      "secure_infrastructure",
      "scalable_network_segmentation",
      "hybrid_mesh_firewalling",
      "agentic_ops",
    ],
    maxVisibleSections: 5,
    minTileCount: 1,
    maxTileCount: 9,
    fallbackTileCount: 3,
    autoDiscovery: {
      stanzaPrefix: "secure_networking_",
      requiredTag: "Secure Networking",
      subCategoryToSection: {
        "Zero Trust Access": "zta",
        "Secure Infrastructure": "secure_infrastructure",
        "Scalable Network Segmentation": "scalable_network_segmentation",
        "Hybrid Mesh Firewalling": "hybrid_mesh_firewalling",
        "Agentic Ops": "agentic_ops",
        "Agentic Operations": "agentic_ops",
      },
    },
  },
  agentic_soc: {
    id: AGENTIC_SOC_WORKSPACE_SOURCE_ID,
    sections: AGENTIC_SOC_SECTIONS,
    defaultSectionIds: AGENTIC_SOC_DEFAULT_SECTION_IDS,
    defaultVisibleSections: AGENTIC_SOC_DEFAULT_SECTION_IDS,
    maxVisibleSections: 4,
    minTileCount: 1,
    maxTileCount: 3,
    fallbackTileCount: 3,
    autoDiscovery: {
      stanzaPrefix: "agentic_soc_",
      requiredTag: "Agentic SOC",
      subCategoryToSection: {
        "DNS Security": "dns_security",
        "Firewall Threat Defense": "firewall_security",
        "Network Detection & Response": "network_detection",
        "Unified Detection & Investigation": "unified_investigation",
      },
    },
  },
};

export const isWorkspaceId = (raw: unknown): raw is WorkspaceId =>
  typeof raw === "string" && /^[a-z][a-z0-9_]{1,63}$/.test(raw);

export const isWorkspaceSourceId = (raw: unknown): raw is WorkspaceSourceId =>
  typeof raw === "string" &&
  (WORKSPACE_SOURCE_IDS as readonly string[]).includes(raw);

export const isWorkspaceSectionId = (raw: unknown): raw is SectionId =>
  typeof raw === "string" &&
  (ALL_WORKSPACE_SECTION_IDS as readonly string[]).includes(raw);

export const getWorkspaceSource = (
  sourceId: WorkspaceSourceId,
): WorkspaceSource => WORKSPACE_SOURCES[sourceId];

export interface WorkspaceDefinitionInput {
  id: WorkspaceId;
  label: string;
  sourceWorkspace: WorkspaceSourceId;
  sectionIds?: readonly SectionId[];
  defaultVisibleSections?: readonly SectionId[];
  maxVisibleSections?: number;
  minTileCount?: number;
  maxTileCount?: number;
  fallbackTileCount?: number;
  headerTitle?: string;
  headerSubtitle?: string;
  defaultLogoSrc?: string;
  hideDefaultLogo?: boolean;
  legacyViewNames?: readonly string[];
  isBuiltIn?: boolean;
  enabled?: boolean;
  sortOrder?: number;
  mapVisible?: boolean;
  mapPosition?: WorkspaceMapPosition;
  regionalView?: WorkspaceRegionalView;
}

export const createInsightsWorkspace = (
  input: WorkspaceDefinitionInput,
): InsightsWorkspace => {
  const source = getWorkspaceSource(input.sourceWorkspace);
  const sourceSectionIds = new Set(
    source.sections.map((section) => section.id),
  );
  const requestedSectionIds = input.sectionIds ?? source.defaultSectionIds;
  const sectionIdSet = new Set(
    requestedSectionIds.filter((sectionId) => sourceSectionIds.has(sectionId)),
  );
  const sections = source.sections.filter((section) =>
    sectionIdSet.has(section.id),
  );
  const defaultSectionIdSet = new Set(source.defaultSectionIds);
  const defaultSections = source.sections.filter((section) =>
    defaultSectionIdSet.has(section.id),
  );
  const safeSections = sections.length > 0 ? sections : defaultSections;
  const safeSectionIds = new Set(safeSections.map((section) => section.id));
  const requestedDefaults =
    input.defaultVisibleSections ?? source.defaultVisibleSections;
  const defaultVisibleSections = requestedDefaults.filter((section) =>
    safeSectionIds.has(section),
  );
  const safeDefaults =
    defaultVisibleSections.length > 0
      ? defaultVisibleSections
      : [safeSections[0].id];
  const maxVisibleSections = Math.min(
    Math.max(input.maxVisibleSections ?? safeSections.length, 1),
    safeSections.length,
  );
  const minTileCount = Math.max(input.minTileCount ?? source.minTileCount, 1);
  const maxTileCount = Math.max(
    input.maxTileCount ?? source.maxTileCount,
    minTileCount,
  );

  return {
    id: input.id,
    label: input.label.trim() || input.id,
    sourceWorkspace: input.sourceWorkspace,
    headerTitle: input.headerTitle?.trim() || undefined,
    headerSubtitle: input.headerSubtitle?.trim() || undefined,
    defaultLogoSrc: input.defaultLogoSrc?.trim() || undefined,
    hideDefaultLogo: Boolean(input.hideDefaultLogo),
    sections: safeSections,
    defaultVisibleSections: safeDefaults.slice(0, maxVisibleSections),
    maxVisibleSections,
    minTileCount,
    maxTileCount,
    fallbackTileCount: Math.min(
      Math.max(
        input.fallbackTileCount ?? source.fallbackTileCount,
        minTileCount,
      ),
      maxTileCount,
    ),
    autoDiscovery: source.autoDiscovery,
    legacyViewNames: input.legacyViewNames ?? [],
    isBuiltIn: Boolean(input.isBuiltIn),
    enabled: input.enabled ?? true,
    sortOrder: input.sortOrder ?? 100,
    mapVisible: input.mapVisible ?? true,
    mapPosition: input.mapPosition ?? "right",
    regionalView: input.regionalView ?? "map",
  };
};

export const toWorkspaceDefinitionInput = (
  workspace: InsightsWorkspace,
  patch: Partial<WorkspaceDefinitionInput> = {},
): WorkspaceDefinitionInput => ({
  id: workspace.id,
  label: workspace.label,
  sourceWorkspace: workspace.sourceWorkspace,
  sectionIds: workspace.sections.map((section) => section.id),
  defaultVisibleSections: workspace.defaultVisibleSections,
  maxVisibleSections: workspace.maxVisibleSections,
  minTileCount: workspace.minTileCount,
  maxTileCount: workspace.maxTileCount,
  fallbackTileCount: workspace.fallbackTileCount,
  headerTitle: workspace.headerTitle,
  headerSubtitle: workspace.headerSubtitle,
  defaultLogoSrc: workspace.defaultLogoSrc,
  hideDefaultLogo: workspace.hideDefaultLogo,
  legacyViewNames: workspace.legacyViewNames,
  isBuiltIn: workspace.isBuiltIn,
  enabled: workspace.enabled,
  sortOrder: workspace.sortOrder,
  mapVisible: workspace.mapVisible,
  mapPosition: workspace.mapPosition,
  regionalView: workspace.regionalView,
  ...patch,
});

export const PACKAGED_WORKSPACE_FALLBACKS: readonly InsightsWorkspace[] = [
  createInsightsWorkspace({
    id: "secure_networking",
    label: "Secure Networking",
    sourceWorkspace: "secure_networking",
    headerTitle: "Splunk Secure Networking Essentials",
    headerSubtitle: "Secure Networking Executive Insights",
    hideDefaultLogo: true,
    isBuiltIn: true,
    sortOrder: 10,
  }),
  createInsightsWorkspace({
    id: "zero_trust_access_demo",
    label: "Zero Trust Access Demo",
    sourceWorkspace: "secure_networking",
    sectionIds: ["zta", "secure_infrastructure", "agentic_ops"],
    defaultVisibleSections: ["zta", "secure_infrastructure", "agentic_ops"],
    headerTitle: "Zero Trust Access Demo",
    headerSubtitle: "Identity, authentication, and access-policy enforcement",
    hideDefaultLogo: true,
    isBuiltIn: true,
    sortOrder: 20,
  }),
  createInsightsWorkspace({
    id: "network_resilience_demo",
    label: "Network Resilience Demo",
    sourceWorkspace: "secure_networking",
    sectionIds: [
      "secure_infrastructure",
      "scalable_network_segmentation",
      "hybrid_mesh_firewalling",
      "agentic_ops",
    ],
    headerTitle: "Network Resilience Demo",
    headerSubtitle:
      "Infrastructure health, segmentation, and threat containment",
    hideDefaultLogo: true,
    isBuiltIn: true,
    sortOrder: 30,
  }),
  createInsightsWorkspace({
    id: AGENTIC_SOC_WORKSPACE_ID,
    label: "Agentic Security Operations Center",
    sourceWorkspace: "agentic_soc",
    headerTitle: "Agentic Security Operations Center",
    headerSubtitle:
      "Live conference DNS, firewall, packet, detection, and investigation telemetry",
    hideDefaultLogo: true,
    isBuiltIn: true,
    sortOrder: 40,
    mapVisible: false,
    regionalView: "table",
  }),
  createInsightsWorkspace({
    id: "security_operations_demo",
    label: "Security Operations Demo",
    sourceWorkspace: "executive",
    sectionIds: ["security", "it_health", "custom"],
    defaultVisibleSections: ["security", "it_health", "custom"],
    headerTitle: "Security Operations Demo",
    headerSubtitle:
      "Operational risk, service health, and executive security signals",
    isBuiltIn: true,
    sortOrder: 50,
  }),
  createInsightsWorkspace({
    id: "executive",
    label: "Executive Briefing",
    sourceWorkspace: "executive",
    sectionIds: ["it_health", "security", "building"],
    defaultVisibleSections: ["it_health", "security", "building"],
    maxVisibleSections: 3,
    fallbackTileCount: 9,
    headerTitle: "Global Operations Command",
    headerSubtitle: "Enterprise health, risk, and experience at decision speed",
    isBuiltIn: true,
    sortOrder: 60,
  }),
];

export const getFallbackWorkspace = (
  workspaceId: WorkspaceId,
): InsightsWorkspace =>
  PACKAGED_WORKSPACE_FALLBACKS.find(
    (workspace) => workspace.id === workspaceId,
  ) ?? PACKAGED_WORKSPACE_FALLBACKS[0];

export const getWorkspaceFromLocation = (
  workspaces: readonly InsightsWorkspace[],
): InsightsWorkspace => {
  const fallback =
    workspaces.find((workspace) => workspace.id === DEFAULT_WORKSPACE_ID) ??
    workspaces[0] ??
    PACKAGED_WORKSPACE_FALLBACKS[0];
  if (typeof window === "undefined") return fallback;

  const params = new URLSearchParams(window.location.search);
  const explicit = params.get("workspace") ?? params.get("overview_profile");
  if (explicit) {
    const selected = workspaces.find((workspace) => workspace.id === explicit);
    if (selected) return selected;
  }

  const parts = window.location.pathname.split("/").filter(Boolean);
  const viewName =
    parts.length > 0 ? decodeURIComponent(parts[parts.length - 1]) : "";
  const legacyWorkspace = workspaces.find((workspace) =>
    workspace.legacyViewNames.includes(viewName),
  );
  if (legacyWorkspace) return legacyWorkspace;

  const rememberedId = readLastWorkspaceId();
  return (
    workspaces.find((workspace) => workspace.id === rememberedId) ?? fallback
  );
};

export const sectionIdsForWorkspace = (
  workspace: InsightsWorkspace,
): readonly SectionId[] => workspace.sections.map((section) => section.id);

export const sectionIdSetForWorkspace = (
  workspace: InsightsWorkspace,
): Set<SectionId> => new Set(sectionIdsForWorkspace(workspace));

const USER_STORAGE_SCOPE_MARKER = ".user.";

export const getCurrentSplunkUsername = (): string | null => {
  if (typeof window === "undefined") return null;
  const runtime = window as unknown as {
    $C?: Record<string, unknown>;
  };
  const username = runtime.$C?.USERNAME;
  return typeof username === "string" && username.trim()
    ? username.trim()
    : null;
};

export const userScopedStorageKey = (baseKey: string): string => {
  const username = getCurrentSplunkUsername();
  const scope = username ? encodeURIComponent(username) : "anonymous";
  return `${baseKey}${USER_STORAGE_SCOPE_MARKER}${scope}`;
};

export const legacyStorageKeyFromUserScoped = (
  storageKey: string,
): string | null => {
  const markerIndex = storageKey.lastIndexOf(USER_STORAGE_SCOPE_MARKER);
  return markerIndex > 0 ? storageKey.slice(0, markerIndex) : null;
};

/**
 * Read account-scoped browser state and migrate the old origin-wide value once.
 * Removing the legacy key after a successful copy prevents the next Splunk user
 * in the same browser profile from inheriting the previous user's preferences.
 */
export const readUserScopedStorageItem = (
  storageKey: string,
): string | null => {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    const scopedValue = window.localStorage.getItem(storageKey);
    if (scopedValue !== null) return scopedValue;
    if (!getCurrentSplunkUsername()) return null;

    const legacyKey = legacyStorageKeyFromUserScoped(storageKey);
    if (!legacyKey) return null;
    const legacyValue = window.localStorage.getItem(legacyKey);
    if (legacyValue === null) return null;

    window.localStorage.setItem(storageKey, legacyValue);
    window.localStorage.removeItem(legacyKey);
    return legacyValue;
  } catch {
    return null;
  }
};

export function readLastWorkspaceId(): WorkspaceId | null {
  const value = readUserScopedStorageItem(
    userScopedStorageKey(LAST_WORKSPACE_STORAGE_KEY),
  );
  const trimmed = value?.trim();
  if (trimmed) return trimmed;
  if (typeof document === "undefined") return null;
  try {
    const prefix = `${LAST_WORKSPACE_COOKIE_NAME}=`;
    const encoded = document.cookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(prefix))
      ?.slice(prefix.length);
    const cookieValue = encoded ? decodeURIComponent(encoded).trim() : "";
    return cookieValue || null;
  } catch {
    return null;
  }
}

export function rememberLastWorkspace(
  workspaceId: WorkspaceId,
  workspaces: readonly InsightsWorkspace[],
): boolean {
  if (
    typeof window === "undefined" ||
    !workspaces.some((workspace) => workspace.id === workspaceId)
  ) {
    return false;
  }
  let persisted = false;
  try {
    if (window.localStorage) {
      window.localStorage.setItem(
        userScopedStorageKey(LAST_WORKSPACE_STORAGE_KEY),
        workspaceId,
      );
      persisted = true;
    }
  } catch {
    // Splunk Cloud can run app frames with DOM storage unavailable. The
    // first-party cookie below remains a durable browser fallback.
  }
  if (typeof document !== "undefined") {
    try {
      const secure = window.location.protocol === "https:" ? "; Secure" : "";
      document.cookie = `${LAST_WORKSPACE_COOKIE_NAME}=${encodeURIComponent(
        workspaceId,
      )}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
      persisted = true;
    } catch {
      // Keep the successful localStorage write, when available.
    }
  }
  return persisted;
}

export const legacyWorkspaceStorageKey = (
  baseKey: string,
  workspaceId: WorkspaceId,
): string => {
  // Keep the original Executive keys unscoped so existing users retain
  // their preferences after the profile-to-workspace migration.
  if (workspaceId === EXECUTIVE_WORKSPACE_SOURCE_ID) return baseKey;
  const versionMatch = baseKey.match(/\.v\d+$/);
  if (!versionMatch) return `${baseKey}.${workspaceId}`;
  return `${baseKey.slice(0, versionMatch.index)}.${workspaceId}${versionMatch[0]}`;
};

export const workspaceStorageKey = (
  baseKey: string,
  workspaceId: WorkspaceId,
): string =>
  userScopedStorageKey(legacyWorkspaceStorageKey(baseKey, workspaceId));
