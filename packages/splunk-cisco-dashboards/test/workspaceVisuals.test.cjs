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
  "../src/main/webapp/common/components/florida/CustomerTopologyMap.tsx",
);
const persistence = read(
  "../src/main/webapp/common/services/customerTopologyPersistenceService.ts",
);
const ticker = read("../src/main/webapp/common/config/signalTicker.ts");
const tickerPersistence = read(
  "../src/main/webapp/common/services/signalTickerPreferenceService.ts",
);
const signalRail = read(
  "../src/main/webapp/common/components/florida/SignalRailTicker.tsx",
);
const signalTickerRail = read(
  "../src/main/webapp/common/components/florida/SignalTickerRail.tsx",
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
const metricItem = read(
  "../src/main/webapp/common/components/florida/MetricItem.tsx",
);
const infoTooltip = read(
  "../src/main/webapp/common/components/florida/InfoTooltip.tsx",
);
const sortableMetricCard = read(
  "../src/main/webapp/common/components/florida/SortableMetricCard.tsx",
);
const sparkline = read(
  "../src/main/webapp/common/components/florida/Sparkline.tsx",
);
const dashboardSection = read(
  "../src/main/webapp/common/components/florida/DashboardSection.tsx",
);
const sectionPresentation = read(
  "../src/main/webapp/common/hooks/usePersistedSectionPresentation.ts",
);
const c3VisualizationPalette = read(
  "../src/main/webapp/common/theme/c3VisualizationPalette.ts",
);

assert.match(
  dashboardSection,
  /<h2 className="leading-none">\{title\}<\/h2>/,
  "Dashboard section titles must follow the page h1 with level-two headings",
);
assert.match(
  profile,
  /<h2 className="text-base font-bold text-sky-900[\s\S]*?\{topologyHeaderName\}[\s\S]*?<\/h2>/,
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
  /<Select[\s\S]*?className="scd-toolbar-select"[\s\S]*?labelText="Dashboard time range"[\s\S]*?style=\{\{ width: 124 \}\}/,
  "The time-range selector must use SUI Select at a compact width",
);
assert.match(
  tailwindStyles,
  /\.scd-toolbar-select\[data-test='select'\][\s\S]*?color: rgb\(241 245 249\) !important/,
  "Dark command-bar SUI selectors must keep their labels and carets visible in either Splunk theme",
);
assert.match(
  profile,
  /scd-overview-page scd-c3-surface/,
  "The overview must opt into the C3-inspired content surface",
);
assert.match(
  dashboardSection,
  /scd-c3-panel bg-white dark:bg-slate-900/,
  "Dashboard sections must use the shared C3 panel treatment",
);
assert.match(
  profile,
  /resolvedTheme === "dark" && "dark scd-c3-atmosphere"/,
  "The dark workspace must use the shared borderless C3 atmosphere",
);
assert.doesNotMatch(profile, /@splunk\/react-ui\/SpotLight/);
assert.match(
  tailwindStyles,
  /\.scd-c3-atmosphere[\s\S]*?background-color:\s*#0b1118[\s\S]*?c3-atmosphere\.svg/,
  "The dark workspace must use the central atmospheric asset",
);
assert.match(
  tailwindStyles,
  /\.scd-c3-surface\.dark \.scd-c3-panel[\s\S]*?rgb\(19 26 35 \/ 98%\)[\s\S]*?backdrop-filter: blur\(8px\)/,
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
  sparkline,
  /offset="0%"[\s\S]*?stopOpacity=\{0\.24\}[\s\S]*?offset="55%"[\s\S]*?stopOpacity=\{0\.08\}[\s\S]*?offset="100%"[\s\S]*?stopOpacity=\{0\}/,
  "Area sparklines must use the restrained C3 graduated fill",
);
assert.match(
  tailwindStyles,
  /\.scd-toolbar-select\[data-test='select'\] \{[\s\S]*?border-color: transparent !important;[\s\S]*?background: transparent !important;[\s\S]*?box-shadow: none !important;/,
  "Command-bar selectors must remain borderless on the dark dashboard header",
);
assert.match(
  profile,
  /max-\[1399px\]:\[&>span\]:hidden/,
  "The health badge must collapse to its status icon before truncating the title",
);
assert.match(
  profile,
  /<Select[\s\S]*?className="scd-toolbar-select"[\s\S]*?labelText="Auto-refresh interval"[\s\S]*?style=\{\{ width: 72 \}\}/,
  "The auto-refresh selector must use SUI Select at a compact width",
);
assert.match(
  profile,
  /aria-label="Refresh dashboard data now"/,
  "Manual refresh must remain discoverable while auto-refresh is off",
);
assert.match(
  profile,
  /<Globe2 className="w-4 h-4"/,
  "Map visibility must use the SUI globe metaphor",
);
assert.match(
  profile,
  /<Layers3 className="h-4 w-4 flex-shrink-0"/,
  "Workspace switching must use the SUI layers metaphor",
);
assert.match(
  profile,
  /<ThemeToggle[\s\S]*?theme=\{theme\}[\s\S]*?onCycle=\{cycleTheme\}[\s\S]*?className=\{iconBtnClass\}[\s\S]*?iconOnly/,
  "The crowded overview header must use the compact theme control with explicit toolbar contrast",
);
assert.doesNotMatch(
  profile,
  /<User className=/,
  "The app header must not duplicate Splunk's global signed-in user control",
);
assert.match(
  metricItem,
  /PanelRightOpen className="w-3\.5 h-3\.5/,
  "Tile drilldowns must use a larger open-details-panel icon",
);
assert.match(
  metricItem,
  /Drill down from \$\{label\} to details/,
  "Tile drilldowns must have an explicit accessible label",
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
  /border border-transparent bg-transparent shadow-none/,
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
  /data-section-density=\{compactHeight \? 'compact' : 'standard'\}/,
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
  sparkline,
  /const minimumSpan = Math\.max\(1, Math\.abs\(center\) \* 0\.05\)/,
  "Sparkline domains must retain a bounded minimum range for near-flat data",
);
assert.match(
  dashboardSection,
  /aria-expanded=\{!collapsed\}[\s\S]*?aria-controls=\{sectionBodyId\}/,
  "Section collapse controls must expose their state and controlled region",
);
assert.match(
  dashboardSection,
  /collapsed && 'hidden'/,
  "Collapsed sections must hide mounted content instead of unmounting live searches",
);
assert.match(
  dashboardSection,
  /aria-pressed=\{focused\}/,
  "Section focus controls must expose their pressed state",
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
