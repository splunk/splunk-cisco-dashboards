"use strict";

const assert = require("assert").strict;
const fs = require("fs");
const path = require("path");

const read = (relativePath) =>
  fs.readFileSync(path.resolve(__dirname, relativePath), "utf8");

const topologyConfig = read(
  "../src/main/webapp/common/config/workspaceTopologies.ts",
);
const topologyMap = read(
  "../src/main/webapp/common/components/workspace/CustomerTopologyMap.tsx",
);
const persistence = read(
  "../src/main/webapp/common/services/customerTopologyPersistenceService.ts",
);
const ticker = read("../src/main/webapp/common/config/signalTicker.ts");
const tickerPersistence = read(
  "../src/main/webapp/common/services/signalTickerPreferenceService.ts",
);
const signalRail = read(
  "../src/main/webapp/common/components/workspace/SignalRailTicker.tsx",
);
const signalTickerRail = read(
  "../src/main/webapp/common/components/workspace/SignalTickerRail.tsx",
);
const signalTickerHook = read(
  "../src/main/webapp/common/hooks/usePersistedSignalTicker.ts",
);
const tailwindStyles = read(
  "../src/main/webapp/common/styles/tailwind.css",
);
const workspacesConf = read(
  "../src/main/resources/splunk/default/insights_workspaces.conf",
);
const profile = read("../src/main/webapp/pages/executive_insights/index.tsx");
const userGuide = read("../src/main/webapp/pages/user_guide/index.tsx");
const profileRender = read(
  "../src/main/webapp/pages/executive_insights/render.tsx",
);
const rawRender = read("../src/main/webapp/common/render-raw.tsx");
const kpiPicker = read(
  "../src/main/webapp/common/components/workspace/KpiPickerPanel.tsx",
);
const metricHook = read("../src/main/webapp/common/hooks/useMetric.ts");
const tileConfigService = read(
  "../src/main/webapp/common/services/searchbaseTileConfigService.ts",
);
const metricItem = read(
  "../src/main/webapp/common/components/workspace/MetricItem.tsx",
);
const tileActionMenu = read(
  "../src/main/webapp/common/components/workspace/TileActionMenu.tsx",
);
const workspaceManager = read(
  "../src/main/webapp/common/components/workspace/WorkspaceManager.tsx",
);
const infoTooltip = read(
  "../src/main/webapp/common/components/workspace/InfoTooltip.tsx",
);
const sortableMetricCard = read(
  "../src/main/webapp/common/components/workspace/SortableMetricCard.tsx",
);
const sparkline = read(
  "../src/main/webapp/common/components/workspace/Sparkline.tsx",
);
const dashboardSection = read(
  "../src/main/webapp/common/components/workspace/DashboardSection.tsx",
);
const sectionPresentation = read(
  "../src/main/webapp/common/hooks/usePersistedSectionPresentation.ts",
);
const sectionHeights = read(
  "../src/main/webapp/common/hooks/usePersistedSectionHeights.ts",
);
const c3VisualizationPalette = read(
  "../src/main/webapp/common/theme/c3VisualizationPalette.ts",
);

assert.match(
  tailwindStyles,
  /#scan-root\s+:where\([\s\S]*?button:not\(\[data-test='button'\]\)[\s\S]*?color: inherit;/,
  "The custom-button reset must stay low-specificity so component text, surface, border, and spacing utilities remain visible",
);
assert.doesNotMatch(
  tailwindStyles,
  /#scan-root\s+button:not\(\[data-test='button'\]\)/,
  "The custom-button reset must not outrank Tailwind dark-mode utilities",
);
assert.match(
  profile,
  /const \[filtersOpen, setFiltersOpen\] = useState\(true\);[\s\S]*?setFiltersOpen\(true\);/,
  "The Add Search drawer must restore its full catalogue filters whenever it opens",
);

assert.match(
  dashboardSection,
  /<CollapsiblePanel[\s\S]*?headingLevel=\{2\}[\s\S]*?title=\{[\s\S]*?\{title\}[\s\S]*?<\/span>/,
  "Dashboard section titles must use CollapsiblePanel's level-two heading semantics",
);
assert.doesNotMatch(
  dashboardSection,
  /ArrowUpRight/,
  "The section link must rely on Button's built-in new-window indicator without a duplicate icon",
);
assert.match(
  sectionHeights,
  /defaultLevel: 2/,
  "Workspace sections must default to H2 so tile content has sufficient vertical room",
);
assert.match(
  profile,
  /<h2 className="text-base font-bold\s+sui-color-info[\s\S]*?\{topologyHeaderName\}[\s\S]*?<\/h2>/,
  "The connectivity panel title must use the page's level-two section hierarchy",
);
assert.match(
  sparkline,
  /sparkline-gradient-\$\{React\.useId\(\)\.replace/,
  "Every sparkline must use a unique SVG gradient id",
);
assert.doesNotMatch(
  sparkline,
  /id=\{`gradient-\$\{color\}`\}/,
  "Sparkline gradient ids must not collide when tiles share a color",
);

for (const workspaceId of [
  "secure_networking",
  "zero_trust_access_demo",
  "network_resilience_demo",
  "security_operations_demo",
  "executive",
]) {
  assert.match(
    topologyConfig,
    new RegExp(`${workspaceId}:`),
    `${workspaceId} must own a topology preset`,
  );
  assert.match(
    workspacesConf,
    new RegExp(`^\\[signal_rail\\.${workspaceId}\\]$`, "m"),
    `${workspaceId} must own a central signal rail preset`,
  );
}

assert.match(
  tickerPersistence,
  /servicesNS\/\$\{encodeURIComponent\(owner\)\}/,
  "Signal Rail preferences must use the authenticated user's namespace",
);
assert.doesNotMatch(
  tickerPersistence,
  /servicesNS\/nobody/,
  "Signal Rail preferences must never write to the shared nobody namespace",
);

assert.match(topologyConfig, /'London to Paris'/, "Europe story must include London to Paris");
assert.match(topologyConfig, /'Singapore to Tokyo'/, "APAC story must be distinct");
assert.match(topologyConfig, /'Toronto to Washington'/, "SOC story must be distinct");
assert.match(topologyConfig, /'London to Dubai'/, "Executive story must be distinct");
for (const factoryMapTitle of [
  "Identity Trust Journey",
  "Resilience Path Atlas",
  "Threat Response Theater",
  "Global Operations Pulse",
]) {
  assert.ok(
    topologyConfig.includes(factoryMapTitle),
    `${factoryMapTitle} must ship as a workspace-specific factory map title`,
  );
}
assert.match(
  persistence,
  /stanzaNameForTopology/,
  "Topology persistence must scope saved maps by topology",
);
assert.match(
  topologyMap,
  /useState<TopologySurfaceMode>\('geo'\)/,
  "The geographic topology must be the factory connectivity view",
);
assert.match(
  topologyMap,
  /surfaceMode === 'command' \? \([\s\S]*?<TopologyCommandView/,
  "The connectivity surface must retain a command-view rendering path",
);
assert.match(
  topologyMap,
  /const COMMAND_MIN_SCALE = 1;[\s\S]*?const COMMAND_MAX_SCALE = 4;/,
  "Command topology zoom must stay bounded between fit and four times magnification",
);
assert.match(
  topologyMap,
  /requestAnimationFrame[\s\S]*?viewportGroupRef\.current\?\.setAttribute\([\s\S]*?'transform'/,
  "Command topology navigation must animate one SVG viewport transform instead of rerendering every node",
);
assert.match(
  topologyMap,
  /addEventListener\('wheel', handleWheel, \{ passive: false \}\)/,
  "Command topology must support cursor-anchored wheel and trackpad zoom",
);
assert.match(
  topologyMap,
  /onPointerDown=\{beginPan\}[\s\S]*?onPointerMove=\{continuePan\}[\s\S]*?onPointerUp=\{endPan\}/,
  "Command topology must support pointer panning",
);
assert.match(
  topologyMap,
  /aria-label="Zoom out command topology"[\s\S]*?aria-live="polite"[\s\S]*?aria-label="Zoom in command topology"[\s\S]*?aria-label="Fit command topology to view"/,
  "Command topology must expose accessible zoom, percentage, and fit controls",
);
assert.match(
  topologyMap,
  /case '0':[\s\S]*?scheduleViewport\(COMMAND_FIT_VIEWPORT\)/,
  "Command topology keyboard navigation must include a fit shortcut",
);
assert.match(
  topologyMap,
  /\['geo', 'Geo'\]/,
  "The geographic topology must remain available as an explicit presentation",
);
assert.match(
  topologyMap,
  /name: 'Secure Network Command Map',[\s\S]*subtitle: 'Live sites, trust paths, and policy-enforcement health'/,
  "Secure Networking must ship its own command-map title and decision-oriented subtitle",
);
assert.match(
  topologyMap,
  /const STATUS_STROKE:[\s\S]*?critical: '#fa5762',[\s\S]*?warning: '#f0c243',[\s\S]*?stable: '#4cbf7f',[\s\S]*?unknown: '#a6adb6'/,
  "Topology status links and beacons must use the shared C3 operational palette",
);
const roleChromeBlock = topologyMap.match(
  /const TOPOLOGY_ROLE_CHROME:[\s\S]*?= \{([\s\S]*?)\n\};\n\nconst CUSTOM_ROLE_SWATCHES/,
);
assert.ok(roleChromeBlock, "Topology roles must have a central color contract");
const roleColors = [
  ...roleChromeBlock[1].matchAll(/fill: '(#[0-9a-f]{6})'/gi),
].map((match) => match[1].toLowerCase());
assert.equal(roleColors.length, 12, "Every built-in topology role must define a color");
assert.equal(
  new Set(roleColors).size,
  roleColors.length,
  "Every built-in topology role must use a unique color",
);
assert.match(
  topologyMap,
  /<Select[\s\S]*?className="scd-topology-role-select"[\s\S]*?labelText="Site role"[\s\S]*?<Select\.Option[\s\S]*?icon=\{[\s\S]*?<TopologyRoleSwatch role=\{role\} \/>/,
  "The topology role picker must expose every role color through SUI Select",
);
assert.match(
  persistence,
  /topology\.name === LEGACY_FACTORY_TOPOLOGY_NAME[\s\S]*FACTORY_TOPOLOGY_NAME/,
  "Existing untouched factory map titles must migrate to the new Secure Networking story",
);
assert.match(
  profile,
  /getWorkspaceTopology\(insightsWorkspace\.id\)/,
  "The profile must select topology from the active workspace",
);
assert.match(
  profile,
  /<MapLayoutRadioBar[\s\S]*?<Select[\s\S]*?labelText="Dashboard time range"[\s\S]*?TIME_RANGE_OPTIONS\.map[\s\S]*?<Select[\s\S]*?prefixLabel="Refresh rate"[\s\S]*?AUTO_REFRESH_OPTIONS\.map[\s\S]*?<Button[\s\S]*?appearance="subtle"[\s\S]*?<RefreshCw[\s\S]*?<Dropdown/,
  "The header must follow the mockup order: map layout, time range, refresh rate, refresh, actions",
);
assert.match(
  profile,
  /scd-overview-page scd-c3-surface/,
  "The overview must opt into the C3-inspired content surface",
);
assert.doesNotMatch(
  profile,
  /Splunk Field Solutions · Insights Workspace|scd-c3-footer/,
  "Insights Workspace must not reserve a branded footer strip",
);
assert.match(
  rawRender,
  /showCopyrightMark\?: boolean;[\s\S]*options\.showCopyrightMark !== false && <CopyrightMark \/>/,
  "Raw page mounts must allow a surface to suppress the shared copyright mark",
);
assert.match(
  profileRender,
  /mountPageRaw\(ExecutiveInsightsPage, \{ showCopyrightMark: false \}\);/,
  "Insights Workspace must suppress the floating copyright mark",
);
assert.match(
  dashboardSection,
  /import CollapsiblePanel from "@splunk\/react-ui\/CollapsiblePanel";[\s\S]*?<CollapsiblePanel/,
  "Dashboard sections must use the released SUI CollapsiblePanel treatment",
);
assert.match(
  profile,
  /"dark scd-one-cisco-spotlight-canvas sui-bg-page sui-color-default"/,
  "The Figma-led workspace must keep a neutral canvas for the SUI SpotLight preset",
);
assert.match(
  profile,
  /import SpotLight from "@splunk\/react-ui\/SpotLight";[\s\S]*?<SpotLight[\s\S]*?variant="page-top"/,
  "The workspace must mount SUI SpotLight directly at the page level",
);
assert.match(
  tailwindStyles,
  /\.scd-one-cisco-spotlight-canvas[\s\S]*?background-color:\s*#0b1118[\s\S]*?background-image:\s*none/,
  "The dark workspace must not place the legacy custom gradient behind SUI SpotLight",
);
assert.match(
  tailwindStyles,
  /\.scd-signal-rail-ticker\[data-variant='one-cisco-glass'\][\s\S]*?background:\s*transparent/,
  "The 1CD status rail must expose the SUI SpotLight instead of an opaque custom background",
);
assert.match(
  tailwindStyles,
  /\.scd-c3-surface \.scd-c3-panel[\s\S]*?rgb\(19 26 35 \/ 98%\)[\s\S]*?backdrop-filter: blur\(8px\)/,
  "C3 panels must remain readable, mostly opaque surfaces above the atmospheric canvas",
);
for (const color of [
  "#649ef5",
  "#4cbf7f",
  "#f0c243",
  "#fa5762",
  "#9ca6ff",
  "#9b5ff5",
  "#049fd9",
  "#00bceb",
  "#f7782f",
]) {
  assert.ok(
    c3VisualizationPalette.includes(color),
    `The shared C3 visualization palette must include ${color}`,
  );
}
assert.match(
  metricItem,
  /healthy: C3_VISUALIZATION_COLORS\.positive,[\s\S]*?warning: C3_VISUALIZATION_COLORS\.caution,[\s\S]*?critical: C3_VISUALIZATION_COLORS\.critical/,
  "Metric status charts must use the shared C3 operational palette",
);
assert.match(
  kpiPicker,
  /<Switch[\s\S]*?appearance="toggle"[\s\S]*?selected=\{thresholdsEnabled\}[\s\S]*?>[\s\S]*?Use thresholds[\s\S]*?<\/Switch>/,
  "Tile configuration must expose an accessible threshold on/off control",
);
assert.match(
  kpiPicker,
  /thresholds\.enabled = thresholdsEnabled/,
  "Threshold enablement changes must be included in the shared tile-config patch",
);
assert.match(
  tileConfigService,
  /thresholds\.enabled !== undefined \? \{ enabled: thresholds\.enabled \} : \{\}/,
  "Shared searchbase persistence must save an explicit threshold enabled state",
);
assert.match(
  profile,
  /const enabled = readOverviewBoolean\(raw, "enabled"\);[\s\S]*?enabled: enabled \?\? fallback\?\.enabled/,
  "Workspace metric parsing must preserve the shared threshold enabled state",
);
assert.equal(
  (metricHook.match(/thresholds\.enabled === false/g) ?? []).length,
  2,
  "Disabled thresholds must suppress both status classification and threshold-band text",
);
assert.match(
  sparkline,
  /offset="0%"[\s\S]*?stopOpacity=\{0\.24\}[\s\S]*?offset="55%"[\s\S]*?stopOpacity=\{0\.08\}[\s\S]*?offset="100%"[\s\S]*?stopOpacity=\{0\}/,
  "Area sparklines must use the restrained C3 graduated fill",
);
assert.match(
  profile,
  /<Menu\.Heading title>[\s\S]*?Dashboard controls · \{headerHealthSummary\}[\s\S]*?<\/Menu\.Heading>/,
  "The aggregate dashboard status must move into the SUI actions menu",
);
assert.match(
  profile,
  /<OneCdRadioBar[\s\S]*?ariaLabel="Map layout"[\s\S]*?options=\{MAP_LAYOUT_OPTIONS\}/,
  "The map layout control must use the shared SUI RadioBar and include map visibility",
);
assert.doesNotMatch(
  profile,
  /<MapPositionToggle|toggleMapVisibility|<SlidingPanels/,
  "Map layout, time range, and refresh rate must not be duplicated in the map card or actions menu",
);
assert.match(
  profile,
  /<Button[\s\S]*?appearance="subtle"[\s\S]*?<RefreshCw[\s\S]*?label=\{`Refresh dashboard data now\./,
  "Manual refresh must remain the only direct dashboard action beside the kebab menu",
);
assert.doesNotMatch(
  profile,
  /OneCdGlassHeaderButton/,
  "Header actions must use react-ui Button directly instead of a custom wrapper",
);
assert.match(
  profile,
  /<Dropdown[\s\S]*?toggle=\{[\s\S]*?<Button[\s\S]*?appearance="subtle"[\s\S]*?hideLabel[\s\S]*?icon=\{<ChevronDown[\s\S]*?label=\{`Switch workspace\. Current: \$\{insightsWorkspace\.label\}`\}[\s\S]*?<Menu style=\{\{ width: WORKSPACE_MENU_WIDTH_PX \}\}>[\s\S]*?workspaces\.map[\s\S]*?<Menu\.Item[\s\S]*?to=\{`\$\{splunkViewAppUrl\("workspace_insights"\)\}[\s\S]*?selectable[\s\S]*?selected=\{workspace\.id === insightsWorkspace\.id\}/,
  "Workspace switching must use an accessible SUI Dropdown menu beside the page title",
);
assert.match(
  profile,
  /const MANAGED_STUDIO_VIEW_NAMES = new Set\(\[[\s\S]*?"netops_critical_systems_health"[\s\S]*?"secops_resilience"[\s\S]*?"workplace_building_intelligence"[\s\S]*?\]\);/,
  "Executive drilldowns must identify native Studio views that require Dashboard Manager",
);
assert.match(
  profile,
  /isManagedStudioView \? "dashboard_manager" : viewName[\s\S]*?const routeHash = isManagedStudioView \? `#\/\$\{viewName\}` : "";[\s\S]*?`\$\{baseUrl\}\?\$\{params\.toString\(\)\}\$\{routeHash\}`/,
  "Executive drilldowns must place time parameters before the Dashboard Manager route hash",
);
for (const viewName of [
  "netops_critical_systems_health",
  "secops_resilience",
  "workplace_building_intelligence",
  "workplace_spaces_intelligence",
  "netops_catalyst_health",
]) {
  assert.match(
    userGuide,
    new RegExp(`view: "dashboard_manager#/${viewName}"`),
    `${viewName} must preserve the app shell when opened from the user guide`,
  );
}
assert.match(
  profile,
  /<Menu\.Divider \/>[\s\S]*?<Menu\.Item[\s\S]*?setWorkspaceManagerOpen\(true\)[\s\S]*?Edit workspaces/,
  "Workspace management must be available from the workspace menu",
);
assert.doesNotMatch(
  profile,
  /<select[\s\S]*?aria-label="Workspace"/,
  "Workspace switching must not rely on a visually hidden native select",
);
assert.match(
  workspaceManager,
  /<Modal[\s\S]*?initialFocus="first"[\s\S]*?onRequestClose=\{onClose\}[\s\S]*?open=\{open\}[\s\S]*?returnFocus=\{returnFocus\}[\s\S]*?<Modal\.Header[\s\S]*?title="Insights workspaces"/,
  "Workspace management must use a named SUI Modal with managed focus",
);
assert.doesNotMatch(
  workspaceManager,
  /if \(!open\) return null/,
  "WorkspaceManager must remain mounted so SUI Modal can restore focus on close",
);
assert.doesNotMatch(
  workspaceManager,
  /aria-label="Close workspace manager"|<X className=/,
  "WorkspaceManager must use Modal.Header's built-in close control",
);
assert.doesNotMatch(
  profile,
  /ThemeToggle|cycleTheme/,
  "The dashboard header must not expose theme-toggle button wiring",
);
assert.doesNotMatch(
  profile,
  /<User className=/,
  "The app header must not duplicate Splunk's global signed-in user control",
);
assert.match(
  tileActionMenu,
  /<PanelRightOpen \/>/,
  "Tile drilldowns must use the open-details-panel icon in the tile action menu",
);
assert.match(
  tileActionMenu,
  /<Menu\.Heading title>Tile actions<\/Menu\.Heading>[\s\S]*?Open in Search[\s\S]*?Open details[\s\S]*?Expand visualization[\s\S]*?Configure tile/,
  "Tile controls must be consolidated into a labeled action menu",
);
assert.match(
  metricItem,
  /iconAriaLabel=\{`What does \$\{label\} measure\?`\}/,
  "Metric information controls must retain a descriptive accessible label",
);
assert.match(
  infoTooltip,
  /<Info variant="filled" className="h-4 w-4" aria-hidden="true" \/>/,
  "Metric information controls must use the legible filled Splunk React icon",
);
assert.match(
  signalRail,
  /#scan-root \.scd-signal-rail-ticker:hover \.scd-signal-rail-controls,[\s\S]*?#scan-root \.scd-signal-rail-ticker:focus-within \.scd-signal-rail-controls,[\s\S]*?opacity: 1 !important;[\s\S]*?pointer-events: auto;/,
  "Signal Rail controls must reveal only on rail hover or keyboard focus",
);
assert.match(
  signalRail,
  /scd-signal-rail-controls absolute right-2 top-1\/2 z-\[90\]/,
  "Signal Rail controls must float outside the marquee's flex layout",
);
assert.doesNotMatch(
  signalRail,
  /relative z-\[90\] flex shrink-0 items-center/,
  "Hidden Signal Rail controls must not reserve space or cover signal tiles",
);
assert.match(
  signalRail,
  /#scan-root \.scd-signal-rail-controls\[data-open='true'\][\s\S]*?opacity: 1 !important;[\s\S]*?pointer-events: auto;/,
  "Signal Rail controls must remain available while the style picker is open",
);
assert.match(
  signalRail,
  /data-open=\{pickerOpen\}/,
  "Signal Rail controls must expose the style picker's open state to the scoped CSS",
);
assert.match(
  signalRail,
  /border sui-border-transparent sui-bg-transparent shadow-none/,
  "Signal Rail control buttons must use transparent chrome over signal tiles",
);
assert.match(
  signalRail,
  /data-signal-rail-controls="true"/,
  "Signal Rail controls must expose a stable live-verification hook",
);
assert.match(
  signalRail,
  /items-center overflow-visible/,
  "Signal Rail layout shell must allow the style picker to escape the ticker row",
);
assert.doesNotMatch(
  signalRail,
  /relative z-\[70\] flex w-full min-w-0 max-w-full items-center overflow-hidden/,
  "Signal Rail layout shell must not clip the style picker",
);
assert.match(
  tailwindStyles,
  /#scan-root \.scd-signal-rail-ticker \{[\s\S]*?overflow: visible;[\s\S]*?contain: inline-size;[\s\S]*?\}/,
  "Signal Rail page styles must not clip the style picker",
);
assert.match(
  signalRail,
  /aria-label=\{`Ticker style:/,
  "Signal Rail's icon-only style control must have an accessible label",
);
assert.doesNotMatch(
  signalRail,
  /relative z-\[80\] hidden shrink-0 items-center/,
  "Signal Rail must not reserve a fixed leading label block",
);
assert.match(
  signalRail,
  /aria-label=\{`Signal Rail with \$\{kpis\.length\} KPIs`\}/,
  "Signal Rail must retain an accessible name after removing the visible label block",
);
assert.match(
  signalRail,
  /data-font-size=\{fontSize\}/,
  "Signal Rail must expose its selected tile font size",
);
assert.match(
  signalTickerRail,
  />\s*Font size\s*</,
  "Signal Rail settings must expose a tile font-size control",
);
assert.match(
  signalTickerHook,
  /isWorkspaceDefault[\s\S]*?signalTickerConfigsEqual\(config, defaultConfig\)/,
  "Signal Rail persistence must expose whether the active settings match the workspace default",
);
assert.match(
  signalTickerRail,
  /disabled=\{isWorkspaceDefault\}[\s\S]*?'Using workspace default'[\s\S]*?'Restore workspace default'/,
  "Signal Rail settings must distinguish the no-op default state from an available restore action",
);
assert.match(
  profile,
  /isWorkspaceDefault=\{signalTickerIsWorkspaceDefault\}/,
  "The workspace profile must pass the persisted default-state result into Signal Rail settings",
);
assert.match(
  sortableMetricCard,
  /group\/tile-actions/,
  "Tile reorder and hide controls must use a dedicated action-corner hover target",
);
assert.doesNotMatch(
  sortableMetricCard,
  /group-hover\/sortable:opacity-100/,
  "Hovering the full tile must not reveal reorder or hide controls",
);
assert.match(
  dashboardSection,
  /data-section-density=\{compactHeight \? ["']compact["'] : ["']standard["']\}/,
  "H1 must expose a real compact section density",
);
assert.match(
  profile,
  /compactHeight=\{renderCompactHeight\}/,
  "The H1 height control must activate compact section rendering",
);
assert.match(
  sparkline,
  /data-sparkline-density=\{compact \? 'compact' : 'detailed'\}/,
  "Sparklines must expose their adaptive compact or detailed presentation",
);
assert.match(
  sparkline,
  /compact[\s\S]*?top: 6[\s\S]*?bottom: 6[\s\S]*?!compact && Number\.isFinite\(firstTime\)/,
  "Compact H1 sparklines must reclaim plot height from labels and timestamp chrome",
);
assert.match(
  metricItem,
  /sparklineDensity === 'detailed'[\s\S]*?h-28 min-h-28 flex-none[\s\S]*?flex-1 min-h-\[72px\] max-h-28/,
  "Detailed sparklines must retain enough canvas height for labels, while compact charts remain flexible",
);
assert.match(
  sparkline,
  /const minimumSpan = Math\.max\(1, Math\.abs\(center\) \* 0\.05\)/,
  "Sparkline domains must retain a bounded minimum range for near-flat data",
);
assert.match(
  dashboardSection,
  /<CollapsiblePanel[\s\S]*?onChange=\{onToggleCollapsed\}[\s\S]*?open=\{!collapsed\}/,
  "The controlled CollapsiblePanel must expose and update the persisted section state",
);
assert.doesNotMatch(
  dashboardSection,
  /renderChildrenWhenCollapsed/,
  "Collapsed panels must use CollapsiblePanel's normal mount and measurement behavior",
);
assert.match(
  dashboardSection,
  /focused \? "Exit focus view" : "Focus this section"/,
  "The section action menu must communicate the current focus action",
);
assert.match(
  profile,
  /focusedSection === section[\s\S]*?collapsedSections\[section\] \|\| focusedSection/,
  "Focusing one section must temporarily collapse its siblings",
);
assert.match(
  profile,
  /!isSectionFocused &&[\s\S]*?compactDensity \|\| renderCompactHeight/,
  "Focused sections must restore detailed chart presentation",
);
assert.match(
  sectionPresentation,
  /sectionPresentation\.v1[\s\S]*?workspaceStorageKey\(/,
  "Collapsed section preferences must stay private to the active workspace",
);

console.log("✓ Workspace topology, signal rail, and drilldown affordance tests passed");
