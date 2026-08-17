"use strict";

const assert = require("assert").strict;
const fs = require("fs");
const path = require("path");

const read = (relativePath) =>
  fs.readFileSync(path.resolve(__dirname, relativePath), "utf8");

const oneCdPrimitives = read(
  "../src/main/webapp/common/components/workspace/OneCdPrimitives.tsx",
);
const dashboardSection = read(
  "../src/main/webapp/common/components/workspace/DashboardSection.tsx",
);
const topologyMap = read(
  "../src/main/webapp/common/components/workspace/CustomerTopologyMap.tsx",
);
const profile = read("../src/main/webapp/pages/executive_insights/index.tsx");
const signalRail = read(
  "../src/main/webapp/common/components/workspace/SignalRailTicker.tsx",
);
const signalTickerRail = read(
  "../src/main/webapp/common/components/workspace/SignalTickerRail.tsx",
);
const signalTickerConfig = read(
  "../src/main/webapp/common/config/signalTicker.ts",
);
const tailwindStyles = read("../src/main/webapp/common/styles/tailwind.css");
const workspacesConf = read(
  "../src/main/resources/splunk/default/insights_workspaces.conf",
);
const workspaceConfig = read(
  "../src/main/webapp/common/config/insightsWorkspaces.ts",
);
const suiIcons = read("../src/main/webapp/common/icons/SuiIcon.tsx");
const applicationStyles = read(
  "../src/main/resources/splunk/appserver/static/application.css",
);
const navigation = read(
  "../src/main/resources/splunk/default/data/ui/nav/default.xml",
);
const secureNetworkingStories = JSON.parse(
  read("../../../scripts/secure_networking_story_dashboards.json"),
);

const approvedStudioIcons = {
  sn_zta_: "Fingerprint",
  sn_secure_infrastructure_: "NetworkDevices",
  sn_segmentation_: "Globe",
  sn_hmf_: "ArrowsDoubleLeftRight",
  sn_agentic_ops_: "RobotAgent",
};

const approvedPillarIcons = [
  ["Zero Trust Access", "shield-keyhole", "ShieldKeyhole", "Fingerprint"],
  ["Secure Infrastructure", "servers", "Servers", "NetworkDevices"],
  ["Scalable Network Segmentation", "node-model", "NodeModel", "Globe"],
  [
    "Hybrid Mesh Firewalling",
    "wall-bricks",
    "WallBricks",
    "ArrowsDoubleLeftRight",
  ],
  ["Agentic Ops", "robot-face-wrench", "RobotFaceWrench", "RobotAgent"],
];

assert.match(
  profile,
  /from "@splunk\/react-ui\/SpotLight"/,
  "The Insights Workspace page must import the released SUI SpotLight component directly",
);
assert.match(
  oneCdPrimitives,
  /from '@splunk\/react-ui\/RadioBar'/,
  "Small related view choices must use the released SUI RadioBar component",
);
assert.match(
  oneCdPrimitives,
  /styled\(Card\)\.attrs\(\{ material: 'glass' as const \}\)/,
  "Glass overlays use the glass material supplied by the repository's pinned SUI 5.13 package",
);
assert.doesNotMatch(
  oneCdPrimitives,
  /styled\(Card\)[\s\S]*?border-radius/,
  "SUI Card must retain its built-in radius instead of duplicating it in custom CSS",
);
assert.doesNotMatch(
  oneCdPrimitives,
  /interactiveColorPrimary|contentColorInverted|accentColor|background-color|box-shadow|!important/,
  "The view RadioBar must not recreate a selected-state treatment with custom color, glow, or forced overrides",
);
assert.match(
  oneCdPrimitives,
  /styled\(RadioBar\)[\s\S]*?\[role='menuitemradio'\][\s\S]*?opacity: 0\.82[\s\S]*?\[aria-checked='true'\][\s\S]*?:focus-visible[\s\S]*?opacity: 1/,
  "The SUI RadioBar may add only a subtle opacity lift for the selected or keyboard-focused option",
);
assert.match(
  oneCdPrimitives,
  /<StyledRadioBar[\s\S]*?role="menubar"[\s\S]*?value=\{value\}/,
  "The view selector must retain the released SUI RadioBar's view-switching menu semantics",
);
assert.doesNotMatch(dashboardSection, /OneCdSurface|SpotLight|spotlight=/);
assert.match(
  dashboardSection,
  /import CollapsiblePanel from "@splunk\/react-ui\/CollapsiblePanel";/,
  "Workspace metric sections must use the released SUI CollapsiblePanel",
);
assert.match(
  dashboardSection,
  /<CollapsiblePanel[\s\S]*?actions=\{actions\}[\s\S]*?open=\{!collapsed\}/,
  "The SUI CollapsiblePanel must own the persisted expand-collapse interaction",
);
assert.doesNotMatch(
  dashboardSection,
  /renderChildrenWhenCollapsed|panelBodyMinHeight|innerBodyStyles/,
  "Workspace sections must use CollapsiblePanel's normal content layout without synthetic body sizing",
);
assert.match(
  dashboardSection,
  /<Dropdown[\s\S]*?<Menu[\s\S]*?addTileAction\.label[\s\S]*?Edit section titles[\s\S]*?Focus this section[\s\S]*?Decrease height[\s\S]*?Show fewer tiles/,
  "Secondary section actions must remain available in the SUI kebab menu",
);
assert.match(
  dashboardSection,
  /const TileCountControl = styled[\s\S]*?Visible tiles[\s\S]*?Show fewer[\s\S]*?Show more/,
  "Workspace sections must expose the restored inline visible-tile stepper",
);
assert.match(
  dashboardSection,
  /const TileCountStepper = styled[\s\S]*?backgroundColorPopup[\s\S]*?const TileCountValue = styled[\s\S]*?actionColorBorderSecondary[\s\S]*?backgroundColorPopup/,
  "Visible-tile controls must use the unified elevated control surface instead of the page canvas",
);
assert.match(
  dashboardSection,
  /const ShowAllButton = styled\(Button\)[\s\S]*?backgroundColorPopup[\s\S]*?actionColorContentStandalone/,
  "Show-all actions must use the bordered elevated surface with standalone action color",
);
assert.match(
  dashboardSection,
  /Show all \$\{tilePager\.total\}[\s\S]*?Paginator\.Compact[\s\S]*?configured/,
  "Workspace sections must expose configured-tile paging and temporary show-all controls",
);
assert.match(
  dashboardSection,
  /effectiveTileCount[\s\S]*?tilePager\?\.showingAll[\s\S]*?Math\.min\(tilePager\.total, tileCount\.max\)[\s\S]*?TileCountValue[\s\S]*?effectiveTileCount/,
  "Show-all mode must report the effective number of visible tiles without overwriting the compact preference",
);
assert.match(
  profile,
  /sectionTilePages[\s\S]*?showAllTileSections[\s\S]*?tilePageStart[\s\S]*?catalogueIds\.slice/,
  "Tile paging and show-all state must remain transient and separate from persisted tile counts",
);
assert.doesNotMatch(
  dashboardSection,
  /aria-label=\{collapsed \? `Expand|Collapse section|TileCountPill|HeightPill/,
  "Metric sections must not recreate controls already owned by CollapsiblePanel or the action menu",
);
assert.match(
  topologyMap,
  /<Select[\s\S]*?labelText="Connectivity presentation"[\s\S]*?setSurfaceMode\(value as TopologySurfaceMode\)/,
  "The in-map connectivity presentation must use the compact SUI Select requested by the design",
);
assert.match(
  profile,
  /<OneCdRadioBar[\s\S]*?ariaLabel="Topology view"[\s\S]*?options=\{REGIONAL_VIEW_OPTIONS\}/,
  "The page-level Map/Table selector must use the controlled SUI RadioBar requested by the design",
);
assert.match(
  topologyMap,
  /<OneCdGlassCard[\s\S]*?tag="aside"[\s\S]*?>[\s\S]*?Site Roles[\s\S]*?<\/OneCdGlassCard>/,
  "The map's high-emphasis role overlay must use the SUI glass card material",
);
assert.doesNotMatch(
  topologyMap,
  /role="tablist"[\s\S]{0,1800}?<button[\s\S]{0,600}?aria-selected=\{surfaceMode === mode\}/,
  "The map must not recreate RadioBar semantics with local buttons",
);
assert.match(
  signalRail,
  /DEFAULT_VARIANT: SignalRailVariant = ["']one-cisco-glass["']/,
  "The 1CD glass treatment must be the factory Signal Rail presentation",
);
assert.match(
  signalRail,
  /const StatusPill = styled\(Badge\)[\s\S]*?const SignalGlassCard = styled\(OneCdGlassCard\)[\s\S]*?<SignalGlassCard[\s\S]*?tag="article"[\s\S]*?<StatusPill/,
  "The live KPI row must use SUI glass cards and styled SUI badges",
);
assert.doesNotMatch(
  signalRail,
  /Live operations|Status overview/,
  "The KPI row must not repeat the top bar with a second overview heading",
);
assert.match(
  signalRail,
  /if \(variant === ["']one-cisco-glass["']\) \{[\s\S]{0,240}?["']min-w-0 px-4 py-3["'][\s\S]{0,120}?["']min-w-0 px-5 py-4["']/,
  "Glass status cards must hug their content instead of imposing a minimum height",
);
assert.match(
  signalRail,
  /const MetricContent = styled\.span[\s\S]*?flex-wrap: wrap;[\s\S]*?align-items: center;[\s\S]*?justify-content: center;[\s\S]*?min-width: 0;[\s\S]*?width: 100%;/,
  "Glass status card metric content must be centered as a group",
);
assert.match(
  profile,
  /<SpotLight[\s\S]*?variant="page-top"[\s\S]*?intensity="low"[\s\S]*?scale=\{0\.5\}/,
  "The Insights Workspace root must own the released SUI page-top SpotLight preset",
);
assert.doesNotMatch(signalRail, /OneCdSurface|SpotLight|spotlight=/);
assert.doesNotMatch(topologyMap, /OneCdSurface|SpotLight|spotlight=/);
assert.match(
  signalRail,
  /healthy: variables\.severityColorNormal,[\s\S]*?warning: variables\.severityColorNotice,[\s\S]*?critical: variables\.severityColorAlert,[\s\S]*?unknown: variables\.severityColorUnknown/,
  "Status pills must use Splunk semantic severity tokens",
);
assert.match(
  signalRail,
  /const MetricValue = styled\.span[\s\S]*?color: \$\{\(\{ \$status \}\) => STATUS_PILL_TOKENS\[\$status\]\};[\s\S]*?font-size: 2\.65rem;/,
  "Exception status values must retain the large matching semantic color",
);
assert.match(
  signalRail,
  /\[data-status="warning"\]::after[\s\S]*?severityColorNotice[\s\S]*?\[data-status="critical"\]::after[\s\S]*?severityColorAlert[\s\S]*?\[data-status="healthy"\] \$\{MetricValue\}[\s\S]*?contentColorDefault[\s\S]*?font-size: 2\.35rem/,
  "Signal Rail must emphasize exceptions while keeping healthy cards readable and quieter",
);
assert.match(
  signalRail,
  /border: 1px solid \$\{\(\{ \$status \}\) => STATUS_PILL_TOKENS\[\$status\]\}[\s\S]*?color-mix\([\s\S]*?\$\{\(\{ \$status \}\) => STATUS_PILL_TOKENS\[\$status\]\} 50%,[\s\S]*?transparent/,
  "Status pills must use the exact severity color for their border and a 50% transparent body",
);
assert.match(
  signalRail,
  /const StatusPill = styled\(Badge\)[\s\S]*?color: \$\{variables\.contentColorActive\}/,
  "Status pill text must use a readable SUI content token",
);
assert.match(
  tailwindStyles,
  /\.scd-one-cisco-spotlight-canvas[\s\S]*?background-image: none[\s\S]*?\.scd-signal-rail-ticker\[data-variant=["']one-cisco-glass["']\][\s\S]*?background: transparent/,
  "The SUI SpotLight preset must not be obscured by custom workspace or rail gradients",
);
assert.match(
  signalRail,
  /variant === ["']one-cisco-glass["'] \|\| durationSeconds <= 0/,
  "The 1CD status overview must remain static because motion belongs to map connectors",
);
assert.match(
  signalRail,
  /staticMode \? \([\s\S]*?grid-cols-\[repeat\(auto-fit,minmax\(180px,1fr\)\)\][\s\S]*?<KpiItem/,
  "The static status overview must fit six KPIs in one responsive desktop row",
);
assert.match(
  signalRail,
  /<a[\s\S]*?aria-label=\{`Open \$\{label\} in Search`\}[\s\S]*?<ExternalLink/,
  "Glass status cards must use the top-right icon link instead of making the whole card clickable",
);
assert.match(
  signalRail,
  /@media \(prefers-reduced-motion: reduce\)[\s\S]*?animation: none !important/,
  "Signal Rail motion must honor the operating-system reduced-motion preference",
);
assert.match(
  signalTickerConfig,
  /DEFAULT_SIGNAL_TICKER_CONFIG:[\s\S]*?speed: 0,/,
  "Signal Rail motion must be disabled by default",
);
assert.match(
  signalTickerConfig,
  /SIGNAL_TICKER_SPEED_STEP = 1\.25/,
  "The historic 0..10 storage scale must expose exact quarter-speed increments",
);
assert.match(
  signalTickerRail,
  /config\.speed \/ NORMAL_SIGNAL_TICKER_SPEED[\s\S]*?}×/,
  "Signal Rail settings must present speed as a user-facing multiplier",
);
assert.equal(
  (workspacesConf.match(/^speed = 0$/gm) ?? []).length,
  5,
  "Every factory workspace must default the Signal Rail to static",
);
assert.match(
  topologyMap,
  /from ["']@splunk\/react-ui\/Slider["']/,
  "Connector motion speed must use the native SUI Slider",
);
assert.match(
  topologyMap,
  /DEFAULT_TOPOLOGY_CONNECTOR_SPEED = 0/,
  "Topology connector trails must be static by default",
);
assert.match(
  topologyMap,
  /TOPOLOGY_CONNECTOR_SPEED_STEP = 0\.25/,
  "Topology connector trails must expose quarter-speed control",
);
assert.match(
  topologyMap,
  /roundTripSeconds = \(profile\.durationSeconds \* 2\) \/ connectorSpeed/,
  "Connector packet duration must respond directly to the selected speed",
);
assert.match(
  workspacesConf,
  /header_title = Splunk for Secure Networking[\s\S]*?header_subtitle = Secure Networking Executive Insights/,
  "The primary workspace title must summarize the operational area",
);

const secureNetworkingSectionConfig = workspaceConfig.match(
  /const SECURE_NETWORKING_SECTIONS:[\s\S]*?\] as const;/,
);
assert.ok(
  secureNetworkingSectionConfig,
  "Secure Networking sections must retain a single explicit icon contract",
);
assert.doesNotMatch(
  secureNetworkingSectionConfig[0],
  /iconSrc:/,
  "Workspace section headers must render the approved native SUI React icons",
);

assert.doesNotMatch(
  applicationStyles,
  /calc\(50%|width: 26px|height: 26px|flex: 0 0 26px/,
  "Splunk navigation must not thicken or enlarge the approved SUI icons",
);
assert.match(
  applicationStyles,
  /width: 24px;[\s\S]{0,220}?mask: var\(--scd-pillar-icon\) center \/ contain no-repeat;/,
  "Unsupported shell icons must use one centered SUI vector at Splunk's native rendered size",
);
for (const [title, key, componentName, navigationIcon] of approvedPillarIcons) {
  assert.match(
    secureNetworkingSectionConfig[0],
    new RegExp(`title: ["']${title}["'][\\s\\S]*?icon: ["']${key}["']`),
    `${title} must use ${componentName}`,
  );
  assert.match(
    suiIcons,
    new RegExp(
      `import ${componentName}Icon from ["']@splunk/react-icons/${componentName}["']`,
    ),
    `${componentName} must come directly from @splunk/react-icons`,
  );
  assert.match(
    suiIcons,
    new RegExp(
      `export const ${componentName} = adaptSuiIcon\\(${componentName}Icon, ["']${componentName}["']\\)`,
    ),
    `${componentName} must be exposed through the shared SUI icon adapter`,
  );
  assert.match(
    profile,
    new RegExp(`["']?${key}["']?: ${componentName}`),
    `${title}'s workspace icon key must resolve to ${componentName}`,
  );

  assert.match(
    navigation,
    new RegExp(`<collection label="${title}" icon="${navigationIcon}">`),
    `${title} must expose its approved icon through Splunk navigation`,
  );

  const assetName = `${navigationIcon}.svg`;
  assert.match(
    applicationStyles,
    new RegExp(
      `\\[title="${title}"\\][\\s\\S]{0,160}?images/nav-icons/${assetName.replace(".", "\\.")}`,
    ),
    `${title}'s Splunk navigation item must use the matching navigation vector`,
  );
  const staticAsset = read(
    `../src/main/resources/splunk/appserver/static/images/nav-icons/${assetName}`,
  );
  assert.match(
    staticAsset,
    /<svg[^>]*viewBox="0 0 24 24"[\s\S]*<path\b/,
    `${title}'s Splunk navigation asset must be a populated 24px SVG`,
  );
  assert.match(
    staticAsset,
    /fill="#649ef5"/,
    `${title}'s shared Studio and navigation asset must remain readable on a dark canvas`,
  );
}

for (const [dashboardId, story] of Object.entries(secureNetworkingStories)) {
  const matchingPrefix = Object.keys(approvedStudioIcons).find((prefix) =>
    dashboardId.startsWith(prefix),
  );
  assert.ok(
    matchingPrefix,
    `${dashboardId} must belong to one approved pillar`,
  );
  const assetName = `${approvedStudioIcons[matchingPrefix]}.svg`;
  const expectedPath = `/static/app/splunk-cisco-dashboards/images/nav-icons/${assetName}`;
  assert.equal(
    story.header_icon,
    expectedPath,
    `${dashboardId} must reuse the exact approved menu icon in Dashboard Studio`,
  );

  const studioView = read(
    `../src/main/resources/splunk/default/data/ui/views/${dashboardId}.xml`,
  );
  assert.match(
    studioView,
    new RegExp(`"src": "${expectedPath.replaceAll("/", "\\/")}"`),
    `${dashboardId} must contain the generated approved Studio icon path`,
  );
}

console.log("1CD design contracts passed");
