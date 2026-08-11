"use strict";

const assert = require("assert").strict;
const fs = require("fs");
const path = require("path");

const read = (relativePath) =>
  fs.readFileSync(path.resolve(__dirname, relativePath), "utf8");

const oneCdSurface = read(
  "../src/main/webapp/common/components/florida/OneCdSurface.tsx",
);
const dashboardSection = read(
  "../src/main/webapp/common/components/florida/DashboardSection.tsx",
);
const topologyMap = read(
  "../src/main/webapp/common/components/florida/CustomerTopologyMap.tsx",
);
const profile = read(
  "../src/main/webapp/pages/executive_insights/index.tsx",
);
const signalRail = read(
  "../src/main/webapp/common/components/florida/SignalRailTicker.tsx",
);
const signalTickerRail = read(
  "../src/main/webapp/common/components/florida/SignalTickerRail.tsx",
);
const signalTickerConfig = read(
  "../src/main/webapp/common/config/signalTicker.ts",
);
const tailwindStyles = read(
  "../src/main/webapp/common/styles/tailwind.css",
);
const workspacesConf = read(
  "../src/main/resources/splunk/default/insights_workspaces.conf",
);

assert.match(
  oneCdSurface,
  /from '@splunk\/react-ui\/SpotLight'/,
  "1CD atmosphere must use the released SUI SpotLight component",
);
assert.match(
  oneCdSurface,
  /from '@splunk\/react-ui\/RadioBar'/,
  "Small related view choices must use the released SUI RadioBar component",
);
assert.match(
  oneCdSurface,
  /styled\(Card\)\.attrs\(\{ material: 'glass' as const \}\)/,
  "Glass overlays must use the SUI Card glass material instead of a CSS lookalike",
);
assert.match(
  oneCdSurface,
  /\{ variables \} from '@splunk\/themes'/,
  "1CD surface styling must resolve through Splunk design tokens",
);
assert.match(
  oneCdSurface,
  /\[role='radio'\]\[aria-checked='true'\][\s\S]*?background-color: \$\{variables\.interactiveColorPrimary\}/,
  "The demo RadioBar must retain SUI semantics while making its selected state unmistakable",
);
assert.match(
  dashboardSection,
  /spotlight=\{collapsed \? 'element' : false\}/,
  "Collapsed metric panels must retain the designer's discovery spotlight",
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
  /DEFAULT_VARIANT: SignalRailVariant = 'one-cisco-glass'/,
  "The 1CD glass treatment must be the factory Signal Rail presentation",
);
assert.match(
  signalRail,
  /<OneCdGlassCard[\s\S]*?tag="article"[\s\S]*?<Badge/,
  "Status overview KPIs must use SUI glass cards and badges",
);
assert.match(
  signalRail,
  /if \(variant === 'one-cisco-glass'\) \{[\s\S]{0,240}?'min-w-0 px-4 py-3'[\s\S]{0,120}?'min-w-0 px-5 py-4'/,
  "Glass status cards must hug their content instead of imposing a minimum height",
);
assert.match(
  signalRail,
  /'scd-signal-rail-item flex flex-col gap-0 overflow-hidden'[\s\S]{0,1400}?className="mt-1\.5 flex items-end justify-between gap-3"/,
  "Glass status cards must keep the subtitle-to-value spacing compact",
);
assert.match(
  signalRail,
  /spotlight=\{variant === 'one-cisco-glass' \? 'page-top' : false\}/,
  "The 1CD status overview must use the released SUI page-top SpotLight preset",
);
assert.match(
  signalRail,
  /color-mix\(in srgb, \$\{STATUS_BADGE_COLOR\.critical\} 50%, transparent\)/,
  "Status badge fills must match the designer's 50% severity treatment",
);
assert.match(
  signalRail,
  /foregroundColor=\{variables\.contentColorActive\}/,
  "Status badge text must use a readable SUI content token",
);
assert.match(
  tailwindStyles,
  /\.scd-one-cisco-spotlight-canvas[\s\S]*?background-image: none[\s\S]*?\.scd-signal-rail-ticker\[data-variant='one-cisco-glass'\][\s\S]*?background: transparent/,
  "The SUI SpotLight preset must not be obscured by custom workspace or rail gradients",
);
assert.match(
  signalRail,
  /variant === 'one-cisco-glass' \|\| durationSeconds <= 0/,
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
  /from '@splunk\/react-ui\/Slider'/,
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
  /header_title = Secure Networking Operations[\s\S]*?header_subtitle = Live posture, policy, infrastructure, and connectivity/,
  "The primary workspace title must summarize the operational area",
);

console.log("1CD design contracts passed");
