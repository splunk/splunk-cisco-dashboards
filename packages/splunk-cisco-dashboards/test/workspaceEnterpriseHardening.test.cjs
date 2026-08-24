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
  )(
    module.exports,
    module,
    require,
    sourcePath,
    path.dirname(sourcePath),
  );
  return module.exports;
};

const permissions = loadTypescriptModule(
  "src/main/webapp/common/auth/insightsWorkspacePermissions.ts",
);
const resolve = permissions.resolveInsightsWorkspacePermissions;

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
assert.equal(power.canManageWorkspaces, true);
assert.equal(power.canManageSharedTopology, true);
assert.equal(power.canManageFactoryTileConfig, false);

const admin = resolve({
  username: "admin-user",
  roles: ["admin"],
  capabilities: ["search"],
});
assert.equal(admin.username, "admin-user");
assert.equal(admin.canManageWorkspaces, true);
assert.equal(admin.canManageSharedTopology, true);
assert.equal(admin.canManageFactoryTileConfig, true);

const delegatedAdmin = resolve({
  roles: ["workspace_curator"],
  capabilities: ["admin_all_objects"],
});
assert.equal(delegatedAdmin.canManageWorkspaces, true);
assert.equal(delegatedAdmin.canManageFactoryTileConfig, true);

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
try {
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
  assert.equal(values.has(legacyKey), false, "Legacy state must be consumed once");
  assert.equal(values.has(aliceKey), true, "Migrated state must belong to Alice");

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
} finally {
  if (originalWindow === undefined) delete global.window;
  else global.window = originalWindow;
}

const profile = read("src/main/webapp/pages/executive_insights/index.tsx");
const topology = read(
  "src/main/webapp/common/components/workspace/CustomerTopologyMap.tsx",
);
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
const signalTickerEditor = read(
  "src/main/webapp/common/components/workspace/SignalTickerRail.tsx",
);
const networkDiagramCanvas = read(
  "src/main/webapp/common/components/diagram/NetworkDiagramCanvas.tsx",
);
const topologyCanvas = read(
  "src/main/webapp/common/components/topology/TopologyCanvas.tsx",
);
const diagramHeader = read(
  "src/main/webapp/common/components/diagram/DiagramHeader.tsx",
);
const securityOperations = read(
  "src/main/webapp/pages/secure_operations_glass/index.tsx",
);
const securityOperationsStyles = read(
  "src/main/webapp/pages/secure_operations_glass/secure-operations-glass.css",
);
const webpackConfig = read("webpack.config.js");
const packageScript = read("bin/package_app.sh");
const m365Page = read(
  "src/main/webapp/pages/m365_activity_monitoring/index.tsx",
);
const m365Data = read(
  "src/main/webapp/pages/m365_activity_monitoring/data.ts",
);

assert.match(profile, /useInsightsWorkspacePermissions\(\)/);
assert.match(profile, /canManageTopology=\{canManageSharedTopology\}/);
assert.match(
  profile,
  /onEditTitle=\{[\s\S]*?canManageSharedTopology[\s\S]*?: undefined/,
);
assert.match(profile, /workspaceAddedSearchbaseIds/);
assert.match(profile, /label="Remove default"/);
assert.match(
  profile,
  /<Modal\.Header title="Remove tile for everyone\?"/,
);
assert.match(
  profile,
  /aria-label=\{`Remove default: \$\{record\.searchName\} from \$\{sectionTitle\}`\}/,
  "The shared-removal accessible name must contain its visible label",
);
assert.doesNotMatch(helpOverlay, /Right-click any tile|via\s+the section title/i);
assert.match(
  helpOverlay,
  /Open a tile(?:&apos;|')s action menu and choose Configure tile/,
);
assert.match(tileActionMenu, /const expand = \(\) => onExpand\?\.\(toggleRef\.current\)/);
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
assert.match(profile, /<ScreenReaderContent aria-live="polite">[\s\S]*?Showing \{activeConfig\.metadata\.title\}/);
assert.match(
  profile,
  /canManageWorkspace \? \([\s\S]*?<RadioBar[\s\S]*?: \([\s\S]*?<StaticContent>Add for me<\/StaticContent>/,
  "Regular users must see a static personal destination rather than a one-option selector",
);
assert.match(topology, /\{canManageTopology && \([\s\S]*?label="Edit topology"/);
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
assert.match(tileConfigService, /restores the target if the source update fails/);
assert.match(
  defaultMeta,
  /\[insights_workspaces\][\s\S]*?write : \[ admin, power, sc_admin \]/,
  "Shared workspace writes must be enforced for power and administrator roles",
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
assert.doesNotMatch(
  rail,
  /#0d2b5e|#1749a0|#0d4f8a|#020617|#07142d|#0c1f3d/i,
);
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
assert.match(dashboardBuilderPicker, /onPointerDown=\{\(event\) => event\.stopPropagation\(\)\}/);
assert.match(dashboardBuilderStyles, /\.dropdown-kpi-filter-caret\.is-open/);
assert.doesNotMatch(
  globalStyles,
  /\.scd-c3-surface \.scd-signal-rail-ticker \{[\s\S]*?rgb\(19 26 35/,
  "The C3 shell must not force every Signal Rail variant onto a fixed dark palette",
);

assert.match(signalTickerEditor, /import Slider from ['"]@splunk\/react-ui\/Slider['"]/);
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
  /closeButtonRef\.current\?\.focus\(\{ preventScroll: true \}\)/,
  "Help must move initial focus into its dialog",
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
assert.match(securityOperations, /role="tab"[\s\S]*?aria-selected=\{activeTab === tab\.id\}/);
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
