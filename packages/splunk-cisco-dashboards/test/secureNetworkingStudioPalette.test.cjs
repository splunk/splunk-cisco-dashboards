"use strict";

const assert = require("assert").strict;
const fs = require("fs");
const path = require("path");

const DASHBOARD_NAMES = [
  "secure_networking_zta",
  "secure_networking_secure_infrastructure",
  "secure_networking_scalable_network_segmentation",
  "secure_networking_hybrid_mesh_firewalling",
  "secure_networking_agentic_ops",
];

const VIEWS_DIR = path.resolve(
  __dirname,
  "../src/main/resources/splunk/default/data/ui/views",
);
const APPLICATION_CSS_PATH = path.resolve(
  __dirname,
  "../src/main/resources/splunk/appserver/static/application.css",
);

const HOME_DARK_PALETTE = {
  canvas: "#020617", // slate-950
  panel: "#0f172a", // slate-900
  secondary: "#1e293b", // slate-800
  text: "#f1f5f9", // slate-100
  accent: "#0ea5e9", // sky-500
  accentStroke: "rgba(14,165,233,0.42)",
};

const BRIGHT_TREND_COLORS = new Set([
  "#5eead4", // teal-300
  "#67e8f9", // cyan-300
  "#6ee7b7", // emerald-300
  "#7dd3fc", // sky-300
  "#c4b5fd", // violet-300
  "#cbd5e1", // slate-300
  "#fcd34d", // amber-300
  "#fda4af", // rose-300
  "#fdba74", // orange-300
]);

const ALLOWED_COLORS = new Set([
  ...Object.values(HOME_DARK_PALETTE)
    .filter((color) => color.startsWith("#"))
    .map((color) => color.toLowerCase()),
  "#64748b", // slate-500
  "#2563eb", // blue-600
  "#16a34a", // green-600
  "#f59e0b", // amber-500
  "#dc2626", // red-600
  "#8b5cf6", // violet-500
  "#0d9488", // teal-600
  ...BRIGHT_TREND_COLORS,
]);

const RETIRED_STUDIO_COLORS = [
  "#07101d",
  "#0f1a2a",
  "#111f31",
  "#16283c",
  "#53bfff",
  "#8bd45b",
  "#ff9a4a",
  "#ff7169",
  "#7c3aed",
  "#14b8a6",
  "rgba(53,207,245,0.42)",
];

const readDashboard = (name) => {
  const filePath = path.resolve(
    __dirname,
    `../src/main/resources/splunk/default/data/ui/views/${name}.xml`,
  );
  const xml = fs.readFileSync(filePath, "utf8");
  const definitionMatch = xml.match(/<definition><!\[CDATA\[([\s\S]*?)\]\]><\/definition>/);
  assert.ok(definitionMatch, `${name} must contain a Dashboard Studio definition`);
  return { xml, definition: JSON.parse(definitionMatch[1]) };
};

for (const dashboardName of DASHBOARD_NAMES) {
  const { xml, definition } = readDashboard(dashboardName);
  const layout = definition.layout.layoutDefinitions.layout_overview;
  const header = definition.visualizations.viz_header_bg.options;

  assert.equal(
    layout.options.backgroundColor,
    HOME_DARK_PALETTE.canvas,
    `${dashboardName} must use the Insights Workspace canvas color`,
  );
  assert.equal(
    header.fillColor,
    HOME_DARK_PALETTE.secondary,
    `${dashboardName} must use the Insights Workspace secondary surface for its header`,
  );
  assert.equal(
    header.strokeColor,
    HOME_DARK_PALETTE.accentStroke,
    `${dashboardName} must use the Insights Workspace sky accent for its header border`,
  );

  for (const retiredColor of RETIRED_STUDIO_COLORS) {
    assert.ok(
      !xml.toLowerCase().includes(retiredColor),
      `${dashboardName} must not retain retired Studio color ${retiredColor}`,
    );
  }

  const colors = [...xml.matchAll(/#[0-9a-f]{6}/gi)].map((match) =>
    match[0].toLowerCase(),
  );
  for (const color of colors) {
    assert.ok(
      ALLOWED_COLORS.has(color),
      `${dashboardName} uses ${color}, which is outside the home dashboard palette`,
    );
  }

  const visualizations = Object.values(definition.visualizations);
  const opaqueBackgrounds = visualizations
    .map((visualization) => visualization.options?.backgroundColor)
    .filter((color) => color && color !== "transparent");
  assert.ok(opaqueBackgrounds.length > 0, `${dashboardName} must define panel backgrounds`);
  for (const backgroundColor of opaqueBackgrounds) {
    assert.ok(
      [HOME_DARK_PALETTE.panel, HOME_DARK_PALETTE.secondary].includes(backgroundColor),
      `${dashboardName} uses unexpected panel background ${backgroundColor}`,
    );
  }

  assert.ok(
    colors.includes(HOME_DARK_PALETTE.text),
    `${dashboardName} must use the Insights Workspace primary text color`,
  );
  assert.ok(
    colors.includes(HOME_DARK_PALETTE.accent) || colors.includes("#7dd3fc"),
    `${dashboardName} must use the Insights Workspace accent or its brighter trend counterpart`,
  );
}

const applicationCss = fs.readFileSync(APPLICATION_CSS_PATH, "utf8");
assert.match(
  applicationCss,
  /\[data-test='viz-description'\][\s\S]*?white-space:\s*normal;[\s\S]*?-webkit-line-clamp:\s*3;/,
  "Dashboard Studio descriptions must wrap to the shared three-line limit",
);
assert.match(
  applicationCss,
  /\[data-test='viz-size-wrapper'\][\s\S]*?flex:\s*1 1 0;[\s\S]*?height:\s*auto !important;/,
  "Dashboard Studio visualizations must resize below wrapped descriptions",
);

const secureNetworkingStudioViews = fs
  .readdirSync(VIEWS_DIR)
  .filter((fileName) => fileName.startsWith("secure_networking_") && fileName.endsWith(".xml"))
  .map((fileName) => ({
    fileName,
    xml: fs.readFileSync(path.join(VIEWS_DIR, fileName), "utf8"),
  }))
  .filter(({ xml }) => /<dashboard\s+version="2"/.test(xml) && /"description"\s*:/.test(xml))
  .map(({ fileName, xml }) => {
    const definitionMatch = xml.match(
      /<definition><!\[CDATA\[([\s\S]*?)\]\]><\/definition>/,
    );
    assert.ok(definitionMatch, `${fileName} must contain a Dashboard Studio definition`);
    return { fileName, xml, definition: JSON.parse(definitionMatch[1]) };
  });

assert.ok(
  secureNetworkingStudioViews.length > DASHBOARD_NAMES.length,
  "The stylesheet regression must cover pillar detail dashboards as well as the five landing dashboards",
);
let areaChartCount = 0;
for (const { fileName, xml, definition } of secureNetworkingStudioViews) {
  assert.match(
    xml,
    /<dashboard\s+version="2"[^>]*stylesheet="application\.css"/,
    `${fileName} must load the shared description treatment`,
  );

  for (const [visualizationId, visualization] of Object.entries(
    definition.visualizations,
  )) {
    assert.notEqual(
      visualization.type,
      "splunk.line",
      `${fileName}:${visualizationId} must use the higher-contrast area trend treatment`,
    );
    assert.ok(
      !(
        visualization.type === "splunk.singlevalue" &&
        visualization.options?.sparklineDisplay === "below"
      ),
      `${fileName}:${visualizationId} must not hide a time series in a single-value sparkline`,
    );
    if (visualization.type !== "splunk.area") continue;

    areaChartCount += 1;
    assert.equal(
      visualization.options?.lineWidth,
      3,
      `${fileName}:${visualizationId} must use the thicker dark-mode area outline`,
    );
    assert.ok(
      visualization.options?.seriesColors?.length > 0,
      `${fileName}:${visualizationId} must define an explicit bright series palette`,
    );
    for (const color of visualization.options.seriesColors) {
      assert.ok(
        BRIGHT_TREND_COLORS.has(color.toLowerCase()),
        `${fileName}:${visualizationId} uses low-contrast area color ${color}`,
      );
    }
  }
}

assert.equal(
  areaChartCount,
  27,
  "Secure Networking Studio must preserve all 27 high-contrast area trend panels",
);

console.log("✓ Secure Networking Studio palette regression test passed");
