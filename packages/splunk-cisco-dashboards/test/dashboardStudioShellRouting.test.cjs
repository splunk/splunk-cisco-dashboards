"use strict";

const assert = require("assert").strict;
const fs = require("fs");
const path = require("path");

const read = (relativePath) =>
  fs.readFileSync(path.resolve(__dirname, relativePath), "utf8");

const viewsRoot = path.resolve(
  __dirname,
  "../src/main/resources/splunk/default/data/ui/views",
);
const navigation = read(
  "../src/main/resources/splunk/default/data/ui/nav/default.xml",
).replace(/<!--[\s\S]*?-->/g, "");
const applicationStyles = read(
  "../src/main/resources/splunk/appserver/static/application.css",
);
const executiveInsights = read(
  "../src/main/webapp/pages/executive_insights/index.tsx",
);
const userGuide = read("../src/main/webapp/pages/user_guide/index.tsx");

const nativeStudioViews = fs
  .readdirSync(viewsRoot)
  .filter((fileName) => fileName.endsWith(".xml"))
  .filter((fileName) =>
    /<dashboard\s+version="2"/.test(
      fs.readFileSync(path.join(viewsRoot, fileName), "utf8"),
    ),
  )
  .map((fileName) => fileName.replace(/\.xml$/, ""))
  .sort();
const dashboardManagerNavViews = [
  ...navigation.matchAll(/href="dashboard_manager#\/([^"]+)"/g),
]
  .map(([, viewName]) => viewName)
  .sort();

assert.deepEqual(
  dashboardManagerNavViews,
  nativeStudioViews,
  "Every native Studio navigation link must preserve the styled app shell",
);

const approvedPillarIcons = new Map([
  ["Zero Trust Access", "Fingerprint"],
  ["Secure Infrastructure", "NetworkDevices"],
  ["Scalable Network Segmentation", "Globe"],
  ["Hybrid Mesh Firewalling", "ArrowsDoubleLeftRight"],
  ["Agentic Ops", "RobotAgent"],
]);
for (const [label, icon] of approvedPillarIcons) {
  assert.match(
    navigation,
    new RegExp(`<collection label="${label}" icon="${icon}">`),
    `${label} must retain the design-approved ${icon} icon`,
  );
  assert.match(
    applicationStyles,
    new RegExp(
      `\\[title="${label}"\\][\\s\\S]{0,160}?images/nav-icons/${icon}\\.svg`,
    ),
    `${label} must retain its design-approved navigation asset`,
  );
}

for (const viewName of [
  "admin_asset_inventory",
  "netops_catalyst_health",
  "netops_critical_systems_health",
  "netops_readiness",
  "secops_resilience",
  "workplace_building_intelligence",
  "workplace_operations_overview",
  "workplace_spaces_intelligence",
]) {
  assert.match(
    executiveInsights,
    new RegExp(`MANAGED_STUDIO_VIEW_NAMES[\\s\\S]*?"${viewName}"`),
    `${viewName} must use Dashboard Manager for executive drilldowns`,
  );
}
assert.match(
  executiveInsights,
  /isManagedStudioView \? "dashboard_manager" : viewName[\s\S]*?const routeHash = isManagedStudioView \? `#\/\$\{viewName\}` : "";[\s\S]*?`\$\{baseUrl\}\?\$\{params\.toString\(\)\}\$\{routeHash\}`/,
  "Managed Studio drilldowns must preserve time parameters before the route hash",
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
    `${viewName} must preserve the styled app shell from the user guide`,
  );
}

console.log("Dashboard Studio shell routing contracts passed");
