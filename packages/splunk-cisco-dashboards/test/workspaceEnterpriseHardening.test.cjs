"use strict";

const assert = require("assert").strict;
const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const packageRoot = path.resolve(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(packageRoot, relativePath), "utf8");

const loadTypescriptModule = (relativePath) => {
  const sourcePath = path.join(packageRoot, relativePath);
  const output = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: sourcePath,
  }).outputText;
  const module = { exports: {} };
  new Function(
    "exports",
    "module",
    "require",
    "__filename",
    "__dirname",
    output,
  )(module.exports, module, require, sourcePath, path.dirname(sourcePath));
  return module.exports;
};

const permissions = loadTypescriptModule(
  "src/main/webapp/common/auth/insightsWorkspacePermissions.ts",
);
const resolve = permissions.resolveInsightsWorkspacePermissions;

const openSearchTokens = loadTypescriptModule(
  "src/main/webapp/common/lib/openSearchTokenResolution.ts",
);
const appCatalog = loadTypescriptModule(
  "src/main/webapp/common/lib/appCatalogUrl.ts",
);
const openSearchInputs = {
  site: {
    type: "input.text",
    options: { token: "site_tok", defaultValue: "*" },
  },
  clientType: {
    type: "input.dropdown",
    options: {
      token: "client_type_tok",
      defaultValue: "*",
      items: [
        { label: "All", value: "*" },
        { label: "Wireless", value: "Wireless" },
        { label: "Wired", value: "Wired" },
      ],
    },
  },
  deviceType: {
    type: "input.multiselect",
    options: {
      token: "filter_type",
      defaultValue: ["*"],
      items: [
        { label: "All", value: "*" },
        { label: "AP", value: "AP" },
        { label: "Switch", value: "Switch" },
      ],
    },
  },
  time: {
    type: "input.timerange",
    options: { token: "time_tok", defaultValue: "-24h@h,now" },
  },
};

const injectedSpl = '" | makeresults | eval compromised=1 | search "';
assert.equal(
  openSearchTokens.resolveOpenSearchQuery(
    'index=main Site="$site_tok$"',
    openSearchInputs,
    new URLSearchParams(`site_tok=${encodeURIComponent(injectedSpl)}`),
  ),
  'index=main Site="*"',
  "A free-text URL parameter must not enter the Open in Search SPL",
);
assert.equal(
  openSearchTokens.resolveOpenSearchQuery(
    'index=main Site="$site_tok$"',
    openSearchInputs,
    new URLSearchParams(`form.site_tok=${encodeURIComponent(injectedSpl)}`),
  ),
  'index=main Site="*"',
  "The form-prefixed alias must have the same free-text boundary",
);
assert.equal(
  openSearchTokens.resolveOpenSearchQuery(
    'index=main clientType="$client_type_tok$"',
    openSearchInputs,
    new URLSearchParams("form.client_type_tok=Wireless"),
  ),
  'index=main clientType="Wireless"',
  "Fixed dropdown selections remain usable through the form-prefixed URL alias",
);
assert.equal(
  openSearchTokens.resolveOpenSearchQuery(
    'index=main clientType="$client_type_tok$"',
    openSearchInputs,
    new URLSearchParams(`client_type_tok=${encodeURIComponent(injectedSpl)}`),
  ),
  'index=main clientType="*"',
  "A value outside the dashboard's fixed dropdown choices must fall back to its trusted default",
);
assert.equal(
  openSearchTokens.resolveOpenSearchQuery(
    'index=main type="$filter_type$"',
    openSearchInputs,
    new URLSearchParams("filter_type=AP,Switch"),
  ),
  'index=main type="AP,Switch"',
  "Static multiselect choices remain usable",
);
assert.equal(
  openSearchTokens.resolveOpenSearchQuery(
    'index=main type="$filter_type$"',
    openSearchInputs,
    new URLSearchParams(`filter_type=AP,${encodeURIComponent(injectedSpl)}`),
  ),
  'index=main type="*"',
  "One unsafe multiselect value must reject the entire URL selection",
);
assert.equal(
  openSearchTokens.resolveOpenSearchQuery(
    'index=main earliest="$time_tok.earliest$" latest="$time_tok.latest$"',
    openSearchInputs,
    new URLSearchParams("time_tok.earliest=-4h@m&form.time_tok.latest=now"),
  ),
  'index=main earliest="-4h@m" latest="now"',
  "Bounded time values remain usable from either supported URL key",
);
assert.equal(
  openSearchTokens.resolveOpenSearchQuery(
    'index=main earliest="$time_tok.earliest$"',
    openSearchInputs,
    new URLSearchParams(`time_tok.earliest=${encodeURIComponent(`-4h@m ${injectedSpl}`)}`),
  ),
  'index=main earliest="-24h@h"',
  "Unsafe time syntax must fall back to the app-defined default",
);
assert.equal(
  openSearchTokens.resolveOpenSearchQuery(
    'index=main invalid="$site_tok.unexpected$"',
    openSearchInputs,
    new URLSearchParams(`form.site_tok.unexpected=${encodeURIComponent(injectedSpl)}`),
  ),
  'index=main invalid="$site_tok.unexpected$"',
  "Only the documented earliest/latest timerange suffixes may be resolved",
);
assert.equal(
  openSearchTokens.resolveOpenSearchQuery(
    'index=main invalid="$time_tok.earliest.extra$"',
    openSearchInputs,
    new URLSearchParams("time_tok.earliest.extra=-4h@m"),
  ),
  'index=main invalid="$time_tok.earliest.extra$"',
  "A dotted suffix beyond earliest/latest must not be treated as a trusted timerange token",
);
assert.equal(
  openSearchTokens.resolveOpenSearchQuery(
    'index=main x="$first$" unknown="$unknown$"',
    {
      first: { type: "input.text", options: { token: "first", defaultValue: "$second$" } },
      second: { type: "input.text", options: { token: "second", defaultValue: "resolved" } },
    },
    new URLSearchParams("first=value&unknown=attacker"),
  ),
  'index=main x="$second$" unknown="$unknown$"',
  "Token replacements must be one-pass and unknown URL tokens must remain unresolved",
);

assert.deepEqual(
  resolve({ roles: ["user"], capabilities: ["search"] }),
  {
    username: null,
    roles: ["user"],
    capabilities: ["search"],
    canManageWorkspaces: false,
    canManageSharedTopology: false,
    canManageFactoryTileConfig: false,
  },
  "The regular user role must fail closed for every shared authoring surface",
);

const power = resolve({ roles: ["user", "power"], capabilities: ["search"] });
assert.equal(power.canManageWorkspaces, false);
assert.equal(power.canManageSharedTopology, false);
assert.equal(power.canManageFactoryTileConfig, false);

const admin = resolve({
  username: "admin-user",
  roles: ["admin"],
  capabilities: ["search", "ssne_manage_insights_workspaces"],
});
assert.equal(admin.username, "admin-user");
assert.equal(admin.canManageWorkspaces, true);
assert.equal(admin.canManageSharedTopology, true);
assert.equal(admin.canManageFactoryTileConfig, true);

const delegatedManager = resolve({
  roles: ["workspace_curator"],
  capabilities: ["search", "ssne_manage_insights_workspaces"],
});
assert.equal(delegatedManager.canManageWorkspaces, true);
assert.equal(delegatedManager.canManageSharedTopology, true);
assert.equal(delegatedManager.canManageFactoryTileConfig, false);

const broadAdmin = resolve({
  roles: ["workspace_curator"],
  capabilities: ["admin_all_objects"],
});
assert.equal(broadAdmin.canManageWorkspaces, false);
assert.equal(broadAdmin.canManageSharedTopology, false);
assert.equal(broadAdmin.canManageFactoryTileConfig, true);

const workspaceConfig = loadTypescriptModule(
  "src/main/webapp/common/config/insightsWorkspaces.ts",
);
const values = new Map();
const localStorage = {
  getItem: (key) => (values.has(key) ? values.get(key) : null),
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: (key) => values.delete(key),
};
const originalWindow = global.window;
const originalDocument = global.document;
try {
  global.document = { cookie: "" };
  global.window = {
    $C: { USERNAME: "alice@example.com" },
    localStorage,
  };
  const legacyKey = workspaceConfig.legacyWorkspaceStorageKey(
    "splunk-cisco-dashboards.sectionTileOrder.v1",
    "secure_networking",
  );
  values.set(legacyKey, '{"v":1,"order":{}}');
  const aliceKey = workspaceConfig.workspaceStorageKey(
    "splunk-cisco-dashboards.sectionTileOrder.v1",
    "secure_networking",
  );
  assert.match(aliceKey, /\.user\.alice%40example\.com$/);
  assert.equal(
    workspaceConfig.readUserScopedStorageItem(aliceKey),
    '{"v":1,"order":{}}',
  );
  assert.equal(
    values.has(legacyKey),
    false,
    "Legacy state must be consumed once",
  );
  assert.equal(
    values.has(aliceKey),
    true,
    "Migrated state must belong to Alice",
  );

  global.window.$C.USERNAME = "bob@example.com";
  const bobKey = workspaceConfig.workspaceStorageKey(
    "splunk-cisco-dashboards.sectionTileOrder.v1",
    "secure_networking",
  );
  assert.notEqual(bobKey, aliceKey);
  assert.equal(
    workspaceConfig.readUserScopedStorageItem(bobKey),
    null,
    "Bob must not inherit Alice's browser customizations",
  );

  global.window.$C.USERNAME = "alice@example.com";
  global.window.location = {
    pathname: "/en-US/app/splunk-cisco-dashboards/workspace_insights",
    search: "",
  };
  const workspaces = workspaceConfig.PACKAGED_WORKSPACE_FALLBACKS;
  assert.equal(
    workspaceConfig.rememberLastWorkspace(
      "agentic_security_operations_center",
      workspaces,
    ),
    true,
  );
  assert.equal(
    workspaceConfig.getWorkspaceFromLocation(workspaces).id,
    "agentic_security_operations_center",
    "An app load without a workspace query must restore Alice's last workspace",
  );

  global.window.location.search = "?workspace=secure_networking";
  assert.equal(
    workspaceConfig.getWorkspaceFromLocation(workspaces).id,
    "secure_networking",
    "A valid explicit workspace must take precedence over remembered state",
  );

  global.window.location.search = "?workspace=removed_workspace";
  assert.equal(
    workspaceConfig.getWorkspaceFromLocation(workspaces).id,
    "agentic_security_operations_center",
    "An invalid explicit ID must fall through to a valid remembered workspace",
  );

  const lastWorkspaceKey = workspaceConfig.userScopedStorageKey(
    workspaceConfig.LAST_WORKSPACE_STORAGE_KEY,
  );
  values.set(lastWorkspaceKey, "removed_workspace");
  global.window.location.search = "";
  assert.equal(
    workspaceConfig.getWorkspaceFromLocation(workspaces).id,
    workspaceConfig.DEFAULT_WORKSPACE_ID,
    "A stale remembered ID must fall back to the factory workspace",
  );
  assert.equal(
    workspaceConfig.rememberLastWorkspace("removed_workspace", workspaces),
    false,
    "Unknown workspace IDs must never be persisted",
  );

  values.delete(lastWorkspaceKey);
  global.window.localStorage = undefined;
  global.window.location.search =
    "?workspace=agentic_security_operations_center";
  assert.equal(
    workspaceConfig.rememberLastWorkspace(
      "agentic_security_operations_center",
      workspaces,
    ),
    true,
    "A first-party cookie must preserve the workspace when DOM storage is unavailable",
  );
  global.window.location.search = "";
  assert.equal(
    workspaceConfig.getWorkspaceFromLocation(workspaces).id,
    "agentic_security_operations_center",
    "The cookie fallback must restore the last workspace on a bare app load",
  );
} finally {
  if (originalWindow === undefined) delete global.window;
  else global.window = originalWindow;
  if (originalDocument === undefined) delete global.document;
  else global.document = originalDocument;
}

const profile = read("src/main/webapp/pages/executive_insights/index.tsx");
const appCatalogUrl = new URL(
  appCatalog.secureNetworkingEssentialsCatalogUrl(),
  "https://splunk.example",
);
assert.equal(
  appCatalogUrl.pathname.endsWith("/manager/launcher/appsremote"),
  true,
);
assert.equal(appCatalogUrl.searchParams.get("order"), "relevance");
assert.equal(
  appCatalogUrl.searchParams.get("query"),
  '"Secure Networking Essentials"',
);
assert.equal(appCatalogUrl.searchParams.get("offset"), "0");
assert.equal(appCatalogUrl.searchParams.get("type"), "app");
assert.deepEqual(appCatalogUrl.searchParams.getAll("category"), [
  "it_operations_management",
  "network_security",
]);
assert.equal(appCatalogUrl.searchParams.get("support"), "developer");
assert.equal(appCatalogUrl.searchParams.get("cim_version"), "8.x");
const headerStart = profile.indexOf('<header className="scd-c3-toolbar');
const headerEnd = profile.indexOf("</header>", headerStart);
const versionLink = profile.indexOf(
  'className="scd-header-app-version"',
  headerStart,
);
assert.ok(headerStart >= 0 && headerEnd > headerStart);
assert.ok(
  versionLink > headerStart && versionLink < headerEnd,
  "The live app version and build link must remain in the workspace header",
);
assert.match(
  profile.slice(versionLink, headerEnd),
  /label=\{appVersionLabel\}[\s\S]*?openInNewContext[\s\S]*?to=\{appCatalogUrl\}/,
);
assert.doesNotMatch(profile, /description=\{appVersionLabel\}/);
const searchService = read(
  "src/main/webapp/common/services/splunkSearchService.js",
);
const topology = read(
  "src/main/webapp/common/components/workspace/CustomerTopologyMap.tsx",
);
assert.match(topology, /attributionControl=\{false\}/);
assert.match(topology, /label="Map credits"/);
assert.match(topology, /Map rendering: Leaflet\. Basemap:/);
const picker = read(
  "src/main/webapp/common/components/workspace/KpiPickerPanel.tsx",
);
const workspaceService = read(
  "src/main/webapp/common/services/insightsWorkspaceService.ts",
);
const tileConfigService = read(
  "src/main/webapp/common/services/searchbaseTileConfigService.ts",
);
const defaultMeta = read("src/main/resources/splunk/metadata/default.meta");
const rail = read(
  "src/main/webapp/common/components/workspace/SignalRailTicker.tsx",
);
const metricItem = read(
  "src/main/webapp/common/components/workspace/MetricItem.tsx",
);
const barBreakdownTile = read(
  "src/main/webapp/common/components/workspace/BarBreakdownTile.tsx",
);
const tileActionMenu = read(
  "src/main/webapp/common/components/workspace/TileActionMenu.tsx",
);
const globalStyles = read("src/main/webapp/common/styles/tailwind.css");
const dashboardSection = read(
  "src/main/webapp/common/components/workspace/DashboardSection.tsx",
);
const helpOverlay = read(
  "src/main/webapp/common/components/workspace/HelpOverlay.tsx",
);
const dashboardBuilderPicker = read(
  "src/main/webapp/pages/dashboardbuilder/DropdownWithSearch.jsx",
);
const dashboardBuilderStyles = read(
  "src/main/webapp/common/styles/commonstyles.css",
);
const modalShell = read(
  "src/main/webapp/common/components/workspace/WorkspaceModalShell.tsx",
);
const appThemeProvider = read(
  "src/main/webapp/common/theme/AppThemeProvider.tsx",
);
const semanticThemeStyles = read(
  "src/main/webapp/common/theme/SemanticThemeStyles.tsx",
);
const tailwindConfig = read("tailwind.config.js");
const signalTickerEditor = read(
  "src/main/webapp/common/components/workspace/SignalTickerRail.tsx",
);
const networkDiagramCanvas = read(
  "src/main/webapp/common/components/diagram/NetworkDiagramCanvas.tsx",
);
const topologyCanvas = read(
  "src/main/webapp/common/components/topology/TopologyCanvas.tsx",
);
const topologyPropertiesPanel = read(
  "src/main/webapp/common/components/topology/PropertiesPanel.tsx",
);
const topologyCanvasPage = read(
  "src/main/webapp/pages/topology_canvas_v1/index.tsx",
);
const diagramHeader = read(
  "src/main/webapp/common/components/diagram/DiagramHeader.tsx",
);
const regionGroupNode = read(
  "src/main/webapp/common/components/diagram/RegionGroupNode.tsx",
);
const securityOperations = read(
  "src/main/webapp/pages/secure_operations_glass/index.tsx",
);
const securityOperationsStyles = read(
  "src/main/webapp/pages/secure_operations_glass/secure-operations-glass.css",
);
const customOpenSearch = read(
  "src/main/webapp/pages/dashboardbuilder/CustomOpenSearch.jsx",
);
const modalFocusTrap = read("src/main/webapp/common/hooks/useModalFocusTrap.ts");
const managerPreviewModal = read(
  "src/main/webapp/common/components/ManagerPreviewModal.jsx",
);
const kpiBrowser = read(
  "src/main/webapp/pages/health_monitoring/components/KPIBrowser.tsx",
);
const expandedKpiModal = read(
  "src/main/webapp/pages/health_monitoring/components/ExpandedKPIModal.tsx",
);
const vizOther = read(
  "src/main/webapp/common/components/templatewizard/viz-other/VizOther.jsx",
);
const diagramPalette = read(
  "src/main/webapp/common/components/diagram/DiagramPalette.tsx",
);
const inventoryTab = read("src/main/webapp/common/components/diagram/InventoryTab.tsx");
const shapesTab = read("src/main/webapp/common/components/diagram/ShapesTab.tsx");
const networkDiagramPage = read("src/main/webapp/pages/network_diagram/index.tsx");
const webpackConfig = read("webpack.config.js");
const packageScript = read("bin/package_app.sh");
const buildScript = read("bin/build.js");
const packageManifest = JSON.parse(read("package.json"));
const m365Page = read(
  "src/main/webapp/pages/m365_activity_monitoring/index.tsx",
);
const macroIndexTuning = read(
  "src/main/webapp/pages/macro_index_tuning/index.tsx",
);
const m365Data = read("src/main/webapp/pages/m365_activity_monitoring/data.ts");
const userGuide = read("src/main/webapp/pages/user_guide/index.tsx");
const workspaceManager = read(
  "src/main/webapp/common/components/workspace/WorkspaceManager.tsx",
);
const insightsWorkspaceService = read(
  "src/main/webapp/common/services/insightsWorkspaceService.ts",
);
const executiveInsights = read(
  "src/main/webapp/pages/executive_insights/index.tsx",
);

assert.match(
  workspaceManager,
  /const TemplateRadioList = styled\(RadioList\)[\s\S]*?grid-template-columns: \[input\] 20px \[label\] minmax\(0, 1fr\)[\s\S]*?min-inline-size: 20px[\s\S]*?<TemplateRadioList/,
  "Workspace template radios must retain a circular 20px control track in the narrow editor",
);

assert.match(
  insightsWorkspaceService,
  /getWorkspaceSignalRailFallback[\s\S]*?workspace\.sourceWorkspace === "agentic_soc"[\s\S]*?: workspace\.sourceWorkspace[\s\S]*?getDefaultSignalTickerConfig\(templateWorkspaceId\)/,
  "Custom workspaces without a rail stanza must inherit the six-item rail for their selected template",
);
assert.match(
  workspaceManager,
  /copyDraft\([\s\S]*?signalRails\[selected\.id\]/,
  "Duplicating a workspace must carry its resolved Signal Rail into persistence",
);
assert.match(
  workspaceManager,
  /saveInsightsWorkspace\([\s\S]*?draft\.signalRailToCopy/,
  "Saving a cloned workspace must persist the carried Signal Rail",
);
assert.match(
  insightsWorkspaceService,
  /saveWorkspaceSignalRail[\s\S]*?signalItemStanzaName\(item\.id\)[\s\S]*?signalRailStanzaName\(workspace\.id\)[\s\S]*?items: sanitized\.items\.map\(\(item\) => item\.id\)\.join\(","\)/,
  "Saving a Signal Rail must persist each KPI definition and the shared item order",
);
assert.match(
  insightsWorkspaceService,
  /deleteInsightsWorkspace[\s\S]*?deleteStanza\(signalRailStanzaName\(workspace\.id\)\)/,
  "Deleting a custom workspace must also remove its cloned Signal Rail stanza",
);
assert.match(
  executiveInsights,
  /<WorkspaceManager[\s\S]*?signalRails=\{signalRails\}/,
  "The workspace manager must receive the resolved rails used by the live workspace",
);

assert.match(
  customOpenSearch,
  /resolveOpenSearchQuery\([\s\S]*?dashboardApi\?\.getDefinition\?\.\(\)\.inputs \|\| \{\}/,
  "Open in Search must use the policy resolver at the SPL boundary",
);
assert.doesNotMatch(
  customOpenSearch,
  /getUrlParameter|spl\.replaceAll\(/,
  "Open in Search must not copy URL values directly into SPL",
);
assert.match(
  customOpenSearch,
  /ds\.chain[\s\S]*?ds\.searchbase[\s\S]*?ds\.search[\s\S]*?setSplSearch\(resolveTokenValue\(spl\)\)/,
  "Every supported data source type must converge through the guarded resolver",
);
assert.match(
  modalFocusTrap,
  /const previouslyFocused = document\.activeElement[\s\S]*?focus\(\{ preventScroll: true \}\)/,
  "Portal dialogs must restore the invoking control after closing",
);
assert.match(
  modalFocusTrap,
  /event\.key === 'Escape'[\s\S]*?event\.key !== 'Tab'[\s\S]*?FOCUSABLE_SELECTOR/,
  "Portal dialogs must handle Escape and contain Tab traversal",
);
assert.match(
  modalFocusTrap,
  /dialog\.addEventListener\('keydown', onKeyDown\)[\s\S]*?dialog\.removeEventListener\('keydown', onKeyDown\)/,
  "Each portal dialog must own its keyboard boundary rather than closing a sibling dialog",
);
assert.match(
  kpiBrowser,
  /<input[\s\S]*?aria-label="Filter KPI library"/,
  "The initially focused KPI filter must expose its purpose to assistive technology",
);
for (const modal of [managerPreviewModal, kpiBrowser, expandedKpiModal]) {
  assert.match(modal, /useModalFocusTrap\(\{/);
  assert.match(modal, /role="dialog"[\s\S]*?aria-modal="true"[\s\S]*?tabIndex=\{-1\}/);
}
assert.match(
  vizOther,
  /<Modal open=\{modalOpen\}[\s\S]*?<Button[\s\S]*?onClick=\{\(\) => setModalOpen\(false\)\}/,
  "The nested description dialog must close itself rather than the outer wizard",
);
for (const palette of [inventoryTab, shapesTab]) {
  assert.doesNotMatch(palette, /role="button"/);
  assert.match(
    palette,
    /<button[\s\S]*?type="button"[\s\S]*?onClick=\{\(\) => onAddToCanvas\?\.\(/,
    "Palette items need a native keyboard-operable button action",
  );
}
const inventoryRowMarkup = inventoryTab.slice(
  inventoryTab.indexOf('const InventoryRow'),
  inventoryTab.indexOf('const FilterDropdown'),
);
const shapeTileMarkup = shapesTab.slice(
  shapesTab.indexOf('const ShapeTile'),
  shapesTab.indexOf('interface CategoryDrawerProps'),
);
assert.doesNotMatch(
  inventoryRowMarkup,
  /<div[\s>]/,
  "Inventory palette buttons must use phrasing-content children",
);
assert.doesNotMatch(
  shapeTileMarkup,
  /<div[\s>]/,
  "Shape palette buttons must use phrasing-content children",
);
assert.match(diagramPalette, /onAddToCanvas=\{onAddToCanvas\}/);
assert.match(
  networkDiagramCanvas,
  /const addPaletteItemAt = useCallback[\s\S]*?const handleDrop = useCallback[\s\S]*?addPaletteItemAt\(/,
  "Pointer drops must retain the common palette item creation boundary",
);
assert.match(
  networkDiagramCanvas,
  /const addPaletteItem = useCallback[\s\S]*?addPaletteItemAt\([\s\S]*?\(\) => \(\{ addOrSelectTitle, addPaletteItem \}\)/,
  "Keyboard palette activation must create nodes through the same canvas path",
);
assert.match(networkDiagramPage, /onAddToCanvas=\{handleAddPaletteItem\}/);
assert.match(
  userGuide,
  /Open in Search accepts only[\s\S]*?dashboard-defined safe filter values/,
  "The current in-app release notes must disclose the Open in Search safety boundary",
);
assert.match(
  userGuide,
  /Topology palette items and key manager\/KPI[\s\S]*?complete keyboard operation/,
  "The current in-app release notes must disclose the keyboard accessibility improvements",
);
assert.match(
  userGuide,
  /bounded Dashboard Builder background[\s\S]*?capability delegation/,
  "The current in-app release notes must disclose bounded shared background management",
);
assert.match(
  userGuide,
  /build\.sh --install[\s\S]*?SplunkBase[\s\S]*?--developer[\s\S]*?--fast/,
  "The current in-app release notes must document SplunkBase defaults and explicit developer workflows",
);
assert.match(
  userGuide,
  /SplunkBase build, install,[\s\S]*?one[\s\S]*?clean-source packaging path[\s\S]*?exact release-eligible archive/,
  "The current in-app release notes must document one clean release path for build and install",
);
assert.match(
  userGuide,
  /successful SplunkBase install[\s\S]*?upload-ready archive[\s\S]*?target&apos;s installed build does not affect package/,
  "The current in-app release notes must document target-independent package construction",
);
assert.match(
  userGuide,
  /Custom Insights workspaces can now be created[\s\S]*?template choices[\s\S]*?circular radio controls/,
  "The current in-app release notes must document workspace creation and radio geometry fixes",
);
assert.match(
  userGuide,
  /Insights workspace editors, drawers, map controls,[\s\S]*?readable Splunk UI colors in both/,
  "The current in-app release notes must document the appearance repair",
);
assert.match(
  userGuide,
  /Add search now opens and resets with only[\s\S]*?this app selected[\s\S]*?Entire catalogue remains[\s\S]*?available/,
  "The current in-app release notes must document the Add search default repair",
);
assert.match(
  userGuide,
  /Agentic SOC section headers no longer expose actions[\s\S]*?development-only Searchbase Canvas/,
  "The current in-app release notes must document removal of release-dead Canvas actions",
);
assert.match(
  userGuide,
  /repository-root VERSION file[\s\S]*?Source app\.conf and[\s\S]*?app\.manifest retain placeholders[\s\S]*?allocate the next[\s\S]*?build automatically/,
  "The current in-app release notes must document VERSION-only release packaging",
);

assert.match(profile, /useInsightsWorkspacePermissions\(\)/);
assert.match(
  profile,
  /\{!isSectionCollapsed && \([\s\S]*?<DndContext/,
  "Collapsed sections must not mount metric hooks or dispatch their searches",
);
assert.match(profile, /dispatchPriority=\{10 \+ sectionIndex \* 10\}/);
assert.match(profile, /<Menu\.Heading>Search loading<\/Menu\.Heading>/);
assert.match(profile, /Enter full screen presentation mode/);
assert.match(profile, /scd-presentation-mode/);
assert.doesNotMatch(
  profile,
  /CUSTOMER_NAME_SPL|tag:\s*["']customer_name["']|setCustomerName/,
  "Workspace headers must not dispatch the deprecated customer_name macro search",
);
assert.match(
  profile,
  /insightsWorkspace\.headerTitle\s*\|\|\s*insightsWorkspace\.label\s*\|\|\s*DEFAULT_HEADER_TITLE_FALLBACK/,
  "Workspace title fallback must use config and the packaged label",
);
assert.doesNotMatch(
  profile,
  /brandingOverride\.title\s*\|\|/,
  "Header title must not prefer a per-browser branding overlay over the shared workspace",
);
assert.match(
  profile,
  /persistWorkspacePatch\(\{\s*headerTitle: next\.title/,
  "The branding editor must write the header title to the shared workspace",
);
assert.match(
  profile,
  /Saved on this workspace for every viewer/,
  "Branding logo help must describe shared workspace persistence",
);
assert.doesNotMatch(
  profile,
  /Stored in your browser only/,
  "Branding logo help must not describe a per-browser overlay",
);
assert.match(
  profile,
  /canManageWorkspaceConfig \? persistSharedSignalRail/,
  "Administrators must persist Signal Rail KPIs to the shared workspace",
);
assert.match(
  profile,
  /speed: signalTickerDefault\.speed[\s\S]*?density: signalTickerDefault\.density[\s\S]*?fontSize: signalTickerDefault\.fontSize/,
  "Shared Signal Rail saves must keep personal speed and density off the workspace stanza",
);
assert.match(
  profile,
  /canManageWorkspace \? "workspace" : "personal"/,
  "Workspace managers must default new section tiles to the shared workspace",
);
assert.match(
  profile,
  /signalTickerPersistenceStatus === ["']loading["'][\s\S]*?\? null[\s\S]*?: searchbaseByName/,
  "Signal rail SPL must wait until persisted preferences finish hydrating",
);
assert.match(searchService, /DEFAULT_CONCURRENT_TILE_SEARCHES = 2/);
assert.match(searchService, /activeDispatchPriority/);
assert.match(profile, /canManageTopology=\{canManageSharedTopology\}/);
assert.match(
  profile,
  /onEditTitle=\{[\s\S]*?canManageSharedTopology[\s\S]*?: undefined/,
);
assert.match(profile, /workspaceAddedSearchbaseIds/);
assert.match(profile, /label="Remove default"/);
assert.match(profile, /<Modal\.Header title="Remove tile for everyone\?"/);
assert.match(
  profile,
  /aria-label=\{`Remove default: \$\{record\.searchName\} from \$\{sectionTitle\}`\}/,
  "The shared-removal accessible name must contain its visible label",
);
assert.doesNotMatch(
  helpOverlay,
  /Right-click any tile|via\s+the section title/i,
);
assert.match(
  helpOverlay,
  /Open a tile(?:&apos;|')s action menu and choose Configure tile/,
);
assert.match(
  tileActionMenu,
  /const expand = \(\) => onExpand\?\.\(toggleRef\.current\)/,
);
assert.match(
  tileActionMenu,
  /label=\{`Open \$\{label\} in Search`\}/,
  "Every searchable tile must expose a visible Open in Search icon",
);
assert.match(
  tileActionMenu,
  /to=\{openInSearchHref\}/,
  "Open in Search must use a native link so Splunk Cloud popup policy cannot swallow the drilldown",
);
assert.match(
  profile,
  /const buildOverviewDescription =/,
  "Workspace tiles must compose the complete Searchbase metadata contract",
);
assert.match(profile, /Operator action/);
assert.match(profile, /Data source and context/);
assert.match(
  searchService,
  /\[SSNE Diagnostics\] ENABLED/,
  "Opt-in diagnostics must announce themselves at a console level operators can see",
);
assert.match(
  barBreakdownTile,
  /formatCompactMetricNumber\(n\)/,
  "Categorical tile headlines and values must use the shared compact formatter",
);
assert.match(
  metricItem,
  /focusReturnRef\.current = returnFocus \?\? null/,
  "Expanded charts opened from a transient menu item must return to the persistent tile action toggle",
);
assert.match(
  metricItem,
  /focusReturnRef\.current\.focus\(\{ preventScroll: true \}\)/,
  "Closing an expanded chart must restore focus without scrolling the dashboard",
);
assert.match(helpOverlay, /top-right section link or keyboard shortcuts/);
assert.match(profile, /aria-live="polite" role="status"/);
assert.match(profile, /previousAction\?\.isConnected/);
assert.match(
  profile,
  /<Paginator\.Compact[\s\S]*?aria-label="Drill-down search navigation"[\s\S]*?current=\{activeIndex \+ 1\}[\s\S]*?totalPages=\{config\.targets\.length\}/,
  "Multi-target drill-downs must use the native paginated search navigation",
);
assert.match(
  profile,
  /<ScreenReaderContent aria-live="polite">[\s\S]*?Showing \{activeConfig\.metadata\.title\}/,
);
assert.match(
  profile,
  /canManageWorkspace \? \([\s\S]*?<RadioBar[\s\S]*?: \([\s\S]*?<StaticContent>Add for me<\/StaticContent>/,
  "Regular users must see a static personal destination rather than a one-option selector",
);
assert.match(
  profile,
  /makeDefaultAddTileAppSelection = \([\s\S]*?new Set\(app \? \[app\] : \[\]\)/,
  "The Add search drawer must default its app facet to the current app",
);
assert.match(
  profile,
  /const currentSearchbaseOwnerApp =[\s\S]*?\?\? APP_NAME/,
  "The Add search drawer must retain the packaged app default while its catalogue loads",
);
assert.match(
  profile,
  /setSelectedApps\(makeDefaultAddTileAppSelection\(currentAppOwner\)\)/,
  "Opening or clearing the Add search drawer must restore the current-app selection",
);
assert.match(
  profile,
  /isDefaultAddTileAppSelection\(selectedApps, currentAppOwner\)/,
  "The current-app default must not be reported as an active filter",
);
assert.match(
  topology,
  /\{canManageTopology && \([\s\S]*?label="Edit topology"/,
);
assert.match(
  picker,
  /Search replacement is organization-wide and requires an[\s\S]*?administrator/,
);
assert.match(
  picker,
  /Drilldown targets are organization-wide and require[\s\S]*?administrator/,
);
assert.match(
  picker,
  /filtersPanelRef\.current[\s\S]*?button\[aria-expanded\][\s\S]*?focus\(\{ preventScroll: true \}\)/,
  "Clearing tile filters must restore focus to the persistent Filters toggle",
);
assert.match(
  picker,
  /drilldownFiltersPanelRef\.current[\s\S]*?button\[aria-expanded\][\s\S]*?focus\(\{ preventScroll: true \}\)/,
  "Clearing drilldown filters must restore focus without scrolling",
);
assert.match(workspaceService, /class InsightsWorkspaceConflictError/);
assert.match(workspaceService, /assertLayoutIsCurrent/);
assert.match(workspaceService, /resetBuiltInInsightsWorkspace/);
assert.match(
  profile,
  /Reset workspace to factory defaults/,
  "Administrators need a visible full workspace factory-reset action",
);
assert.match(
  profile,
  /permanently removes app-local insights_workspaces\.conf and [\s\S]*?searchbase\.conf overrides/,
  "Factory reset must warn before removing shared local overrides",
);
assert.match(
  profile,
  /resetInsightsWorkspaceTileConfig\([\s\S]*?resetBuiltInInsightsWorkspace\([\s\S]*?handleResetAllCustomizations\(\)/,
  "Full reset must clear Searchbase, workspace conf, and personal preferences",
);
assert.match(
  tileConfigService,
  /restores the target if the source update fails/,
);
assert.match(
  defaultMeta,
  /\[insights_workspaces\][\s\S]*?write : \[ admin, sc_admin \]/,
  "Raw shared workspace writes must be restricted to administrator roles",
);
assert.match(
  defaultMeta,
  /\[searchbase\][\s\S]*?write : \[ admin, sc_admin \]/,
  "Factory tile configuration must remain administrator-only on the server",
);

for (const variant of [
  "original",
  "bloomberg",
  "minimal-enterprise",
  "telemetry-constellation",
]) {
  assert.match(rail, new RegExp(`id: "${variant}"`));
}
assert.doesNotMatch(rail, /Cisco Blue Gradient|cisco-blue-gradient/);

assert.match(rail, /const SignalRailShell = styled\.section/);
assert.match(rail, /variables\.backgroundColorSection/);
assert.match(rail, /variables\.backgroundColorPage/);
assert.match(rail, /variables\.uiColorAccent/);
assert.match(rail, /variables\.uiColorAccentComplement/);
assert.doesNotMatch(rail, /#0d2b5e|#1749a0|#0d4f8a|#020617|#07142d|#0c1f3d/i);
assert.doesNotMatch(
  rail,
  /rgba\((?:34, 211, 238|168, 85, 247|125, 211, 252|103, 232, 249)/,
);
assert.match(
  rail,
  /const SignalRailControls = styled\.div`[\s\S]*?position: absolute;[\s\S]*?right: \$\{variables\.spacingSmall\};[\s\S]*?opacity: 0;[\s\S]*?pointer-events: none;/,
);
assert.match(
  rail,
  /\.scd-signal-rail-ticker:hover &[\s\S]*?\.scd-signal-rail-ticker:focus-within &[\s\S]*?opacity: 1;[\s\S]*?pointer-events: auto;/,
);
assert.match(
  rail,
  /@media \(any-hover: none\), \(any-pointer: coarse\) \{[\s\S]*?position: static;[\s\S]*?opacity: 1;[\s\S]*?pointer-events: auto;/,
);
assert.match(
  rail,
  /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?transition: none;/,
);
assert.match(rail, /label="Configure Signal Rail"/);
assert.match(
  rail,
  /const StatusPill = styled\(Badge\)[\s\S]*?STATUS_PILL_TOKENS\[\$status\][\s\S]*?background-color: color-mix\([\s\S]*?50%,[\s\S]*?transparent[\s\S]*?color: \$\{variables\.contentColorActive\}/,
  "Signal Rail status badges must use semantic SUI tokens with readable active text",
);
assert.match(profile, /description: "Configure Signal Rail"/);
assert.match(
  signalTickerEditor,
  /KPIs are shared with every viewer\. Speed and density stay private to you\./,
  "Administrators must see that Signal Rail KPIs are shared",
);
assert.match(
  signalTickerEditor,
  /Private display preferences for this workspace/,
  "Viewers must keep Signal Rail speed and density private",
);
assert.doesNotMatch(
  profile,
  />\s*Configure signal rail\s*<\/Menu\.Item>/,
  "The dashboard actions menu must not duplicate the contextual Signal Rail control",
);

assert.match(profile, /const MAP_HEIGHT_DEFAULT: MapHeightMode = "compact"/);
assert.match(profile, /<Menu\.Heading>Map height<\/Menu\.Heading>/);
assert.match(profile, />\s*Match workspace\s*<\/Menu\.Item>/);
assert.match(profile, />\s*Compact\s*<\/Menu\.Item>/);
assert.match(profile, /data-map-height=\{mapHeightMode\}/);
assert.match(profile, /meaningfulTilePageCount\(/);
assert.match(
  profile,
  /aria-label=\{`View in Searchbase: \$\{record\.searchName\}`\}[\s\S]*?label="View in Searchbase"[\s\S]*?openInNewContext[\s\S]*?to=\{searchbaseUrl\}/,
  "Every Add Search result must retain its direct Searchbase editor action",
);
assert.match(dashboardSection, />Tiles per page<\/span>/);
assert.match(dashboardSection, /All \{tilePager\.total\} visible/);
assert.match(
  dashboardSection,
  /tilePager\.showingAll \|\| tilePager\.pageCount > 1/,
  "Pagination arrows must disappear when there is no useful next page",
);
assert.match(dashboardBuilderPicker, /@splunk\/react-icons\/ChevronRight/);
assert.doesNotMatch(
  dashboardBuilderPicker,
  /filtersOpen \? ['"]\^['"] : ['"]v['"]/,
);
assert.match(dashboardBuilderPicker, />\s*View in Searchbase\s*<\/Link>/);
assert.match(
  dashboardBuilderPicker,
  /onPointerDown=\{\(event\) => event\.stopPropagation\(\)\}/,
);
assert.match(dashboardBuilderStyles, /\.dropdown-kpi-filter-caret\.is-open/);
assert.doesNotMatch(
  globalStyles,
  /\.scd-c3-surface \.scd-signal-rail-ticker \{[\s\S]*?rgb\(19 26 35/,
  "The C3 shell must not force every Signal Rail variant onto a fixed dark palette",
);

assert.match(
  signalTickerEditor,
  /import Slider from ['"]@splunk\/react-ui\/Slider['"]/,
);
assert.match(
  signalTickerEditor,
  /<Slider[\s\S]*?inputId="signal-rail-speed"[\s\S]*?onChange=\{\(_event, \{ value \}\) =>[\s\S]*?speed: value/,
  "The legacy Signal Rail speed must use the same controlled SUI Slider plumbing as connector motion",
);
assert.doesNotMatch(
  signalTickerEditor,
  /<input[\s\S]{0,180}type="range"[\s\S]{0,180}Signal rail speed/,
);

assert.match(modalShell, /const previouslyFocused = document\.activeElement/);
assert.match(
  appThemeProvider,
  /mountRoot\.dataset\.appColorScheme = colorScheme[\s\S]*?mountRoot\.style\.colorScheme = colorScheme/,
  "The application appearance must reach native controls under the React mount root",
);
assert.match(
  modalShell,
  /data-workspace-modal-portal="document"[\s\S]*?data-app-color-scheme=\{colorScheme\}[\s\S]*?style=\{\{ colorScheme \}\}/,
  "Body-portaled workspace dialogs must carry the selected appearance",
);
assert.doesNotMatch(
  modalShell,
  /<div id="scan-root"/,
  "Body-portaled dialogs must not duplicate the React mount ID",
);
for (const source of [semanticThemeStyles, globalStyles, tailwindConfig]) {
  assert.match(
    source,
    /\[data-workspace-modal-portal=["\\]document/,
    "Every style boundary must include document-body workspace dialogs",
  );
}
for (const surface of ["page", "section", "popup", "transparent"]) {
  assert.match(
    semanticThemeStyles,
    new RegExp(`:is\\(input, select, textarea\\)\\.sui-bg-${surface}`),
    `Native ${surface} controls must override Splunk Web legacy input colors with SUI tokens`,
  );
}
assert.match(
  semanticThemeStyles,
  /\.scd-action-primary[\s\S]*?actionColorBackgroundPrimary[\s\S]*?actionColorContentPrimary/,
  "Solid primary actions must keep the SUI action fill and foreground together",
);
assert.match(
  semanticThemeStyles,
  /\.scd-action-destructive[\s\S]*?actionColorBackgroundDestructive[\s\S]*?actionColorContentDestructive/,
  "Solid destructive actions must keep the SUI action fill and foreground together",
);
assert.match(
  semanticThemeStyles,
  /\.scd-action-secondary[\s\S]*?actionColorBackgroundSecondary[\s\S]*?actionColorContentSecondary/,
  "Contextual actions must use the complete SUI secondary action palette",
);
assert.match(
  semanticThemeStyles,
  /\.scd-action-destructive-secondary[\s\S]*?actionColorBackgroundDestructiveSecondary[\s\S]*?actionColorContentDestructiveSecondary/,
  "Contextual destructive actions must use the complete SUI destructive-secondary palette",
);
assert.match(
  semanticThemeStyles,
  /\.scd-insights-layer-content[\s\S]*?input\[type="text"\][\s\S]*?background-color: transparent[\s\S]*?contentColorActive/,
  "App-owned SUI layers must neutralize Splunk Web's legacy dark inner-input fill",
);
assert.match(
  workspaceManager,
  /<Modal\.Body className="scd-insights-layer-content">/,
  "Workspace Manager custom content must carry the theme boundary inside the SUI modal",
);
assert.match(
  picker,
  /<Drawer\.Body[\s\S]{0,120}?className="scd-insights-layer-content"[\s\S]{0,120}?id="configure-tile-drawer"/,
);
assert.match(
  executiveInsights,
  /<Drawer\.Body className="scd-insights-layer-content">/,
);
for (const source of [workspaceManager, picker, executiveInsights]) {
  assert.doesNotMatch(
    source,
    /<(?:Modal|StyledDrawer|Drawer)\s[^>]*className="scd-insights-layer-content"/,
    "Custom theme boundaries must not override SUI Modal or Drawer chrome",
  );
}
for (const source of [
  topology,
  signalTickerEditor,
  executiveInsights,
  topologyCanvas,
  topologyPropertiesPanel,
  topologyCanvasPage,
  diagramHeader,
  regionGroupNode,
  m365Page,
  macroIndexTuning,
]) {
  assert.doesNotMatch(
    source,
    /sui-bg-accent[^"\n]*sui-color-(?:active|info)|sui-color-(?:active|info)[^"\n]*sui-bg-accent/,
    "Insights actions and badges must not pair the accent fill with a low-contrast foreground",
  );
  assert.doesNotMatch(
    source,
    /sui-bg-notification-(?:info|positive|negative|warning)[^"\n]*sui-color-(?:info|positive|negative|warning)|sui-color-(?:info|positive|negative|warning)[^"\n]*sui-bg-notification-(?:info|positive|negative|warning)/,
    "Weak notification surfaces must use an AA foreground instead of same-hue content text",
  );
}
assert.match(
  modalShell,
  /previouslyFocused\?\.isConnected[\s\S]*?focus\(\{ preventScroll: true \}\)/,
  "Shared workspace dialogs must restore the invoking control without scrolling",
);
assert.match(profile, /returnFocus=\{pickerReturnFocusRef\}/);
assert.match(profile, /returnFocus=\{addTileReturnFocusRef\}/);
assert.match(
  profile,
  /helpReturnFocusRef\.current = headerActionsToggleRef\.current[\s\S]*?setHelpOpen\(true\)/,
  "Menu-launched Help must return to the persistent Dashboard actions toggle",
);
assert.match(
  helpOverlay,
  /useModalFocusTrap\(\{[\s\S]*?initialFocusRef: closeButtonRef/,
  "Help must move initial focus into its dialog and contain keyboard focus",
);
assert.match(
  signalTickerEditor,
  /useModalFocusTrap\(\{[\s\S]*?initialFocusRef: closeButtonRef/,
  "Signal Rail must move initial focus into its dialog and contain keyboard focus",
);

for (const shell of [
  "netops_health_monitoring.xml",
  "sn_topology_canvas.xml",
  "workplace_m365_activity_monitoring.xml",
]) {
  assert.match(
    read(`src/main/resources/splunk/default/data/ui/views/${shell}`),
    /<dashboard[^>]*theme="dark"/,
    `${shell} must not wrap its dark React page in a light Simple XML shell`,
  );
}
assert.doesNotMatch(networkDiagramCanvas, /return '#0ea5e9'|return '#cbd5e1'/);
assert.match(networkDiagramCanvas, /return 'var\(--sui-content-info\)'/);
assert.doesNotMatch(topologyCanvas, /return '#0ea5e9'|return '#cbd5e1'/);
assert.match(topologyCanvas, /minZoom=\{0\.5\}/);
assert.match(diagramHeader, /<h1 className="flex-shrink-0 whitespace-nowrap/);
assert.match(securityOperations, /role="tablist"/);
assert.match(
  securityOperations,
  /role="tab"[\s\S]*?aria-selected=\{activeTab === tab\.id\}/,
);
assert.match(
  securityOperationsStyles,
  /\.scd-glass-metric \{[\s\S]*?padding: 12px 78px 10px 14px;/,
  "Metric cards must reserve room for both named Search actions",
);
assert.match(webpackConfig, /__SCD_PACKAGE_BUILD__/);
assert.match(
  packageScript,
  /s\/__SCD_PACKAGE_BUILD__\/\$\{new_build\}\/g/,
  "Packaging must stamp the chosen app build into the compiled bundle badge",
);
assert.match(packageScript, /refusing a mismatched package/);
assert.doesNotMatch(
  packageScript,
  /rm\s+-rf\s+["']?\$\{STAGE_DIR\}\/local["']?/,
  "Packaging must not delete stage/local because it can belong to a live linked app",
);
assert.doesNotMatch(
  packageScript,
  /rm\s+-f\s+["']?\$\{STAGE_DIR\}\/metadata\/local\.meta["']?/,
  "Packaging must not delete source stage metadata created by a live linked app",
);
assert.match(
  packageScript,
  /rm -rf "\$\{TMP_DIR\}\/\$\{APP_NAME\}\/local"/,
  "Runtime local state must be removed only from the temporary archive copy",
);
assert.match(
  packageScript,
  /rm -f\s+"\$\{TMP_DIR\}\/\$\{APP_NAME\}\/metadata\/local\.meta"/,
  "Runtime metadata must be removed only from the temporary archive copy",
);
assert.equal(
  packageManifest.scripts["pack:app"],
  "bash bin/package_app.sh",
  "yarn pack:app must use the canonical packaging path",
);
assert.match(
  buildScript,
  /function pack\(\{ minify = false \} = \{\}\) \{[\s\S]*?run\("bash", packageArgs\);/,
  "The legacy build.js pack entry point must delegate to the canonical package script",
);
assert.doesNotMatch(
  buildScript,
  /run\("tar",/,
  "build.js must not create a divergent archive directly",
);
assert.match(m365Page, /Bundled sample data/);
assert.match(m365Page, /APP_VERSION_LABEL/);
assert.doesNotMatch(m365Page, />\s*Live Data\s*</);
assert.doesNotMatch(m365Data, /App Version|v3\.2\.0|Last Updated/);

for (const hook of [
  "useBrandingOverride.ts",
  "usePersistedMetricOverrides.ts",
  "usePersistedSearchbaseDrilldowns.ts",
  "usePersistedSectionHeights.ts",
  "usePersistedSectionHiddenTiles.ts",
  "usePersistedSectionLayout.ts",
  "usePersistedSectionPresentation.ts",
  "usePersistedSectionTileAdditions.ts",
  "usePersistedSectionTileCounts.ts",
  "usePersistedSectionTileOrder.ts",
]) {
  assert.match(
    read(`src/main/webapp/common/hooks/${hook}`),
    /readUserScopedStorageItem/,
    `${hook} must read account-scoped browser state`,
  );
}

console.log("Insights Workspace enterprise hardening contract passed.");
