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
const workspacesConf = read(
  "../src/main/resources/splunk/default/insights_workspaces.conf",
);
const profile = read("../src/main/webapp/pages/executive_insights/index.tsx");
const metricItem = read(
  "../src/main/webapp/common/components/florida/MetricItem.tsx",
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
  /name: 'Secure Network Command Map',[\s\S]*subtitle: 'Live sites, trust paths, and policy-enforcement health'/,
  "Secure Networking must ship its own command-map title and decision-oriented subtitle",
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
  /cn\(inputClass, "w-\[124px\]"\)/,
  "The time-range selector must preserve title space with a compact width",
);
assert.match(
  profile,
  /max-\[1399px\]:\[&>span\]:hidden/,
  "The health badge must collapse to its status icon before truncating the title",
);
assert.match(
  profile,
  /cn\(inputClass, "w-\[72px\]"\)/,
  "The auto-refresh selector must preserve title space with a compact width",
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
  signalRail,
  /relative z-\[90\] flex shrink-0 items-center gap-1/,
  "Signal Rail controls must reserve layout space instead of covering KPI content",
);
assert.doesNotMatch(
  signalRail,
  /absolute right-1\.5 top-1\/2 z-\[90\]/,
  "Signal Rail controls must not be absolutely positioned over the marquee",
);
assert.match(
  signalRail,
  /aria-label=\{`Ticker style:/,
  "Signal Rail's icon-only style control must have an accessible label",
);

console.log("✓ Workspace topology, signal rail, and drilldown affordance tests passed");
