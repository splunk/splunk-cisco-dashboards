"use strict";

const assert = require("assert").strict;
const fs = require("fs");
const path = require("path");

const EXPECTED_STUDIO_FILES = [
  "secure_networking_agentic_ops.xml",
  "secure_networking_agentic_ops_executive_overview.xml",
  "secure_networking_hmf_dlp_cloud_native_security.xml",
  "secure_networking_hmf_sdwan_network_health_monitoring.xml",
  "secure_networking_hmf_threat_detection_enforcement.xml",
  "secure_networking_hybrid_mesh_firewalling.xml",
  "secure_networking_scalable_network_segmentation.xml",
  "secure_networking_secure_infrastructure.xml",
  "secure_networking_secure_infrastructure_status.xml",
  "secure_networking_segmentation_overview.xml",
  "secure_networking_zta.xml",
  "secure_networking_zta_authentication_policy_enforcement.xml",
  "secure_networking_zta_detection_response.xml",
  "secure_networking_zta_policy_management.xml",
  "secure_networking_zta_ravpn_sessions_and_posture.xml",
  "secure_networking_zta_user_activity_monitoring.xml",
];

const EXPECTED_GRAPH_COUNTS = {
  "splunk.area": 84,
  "splunk.bar": 6,
  "splunk.column": 4,
  "splunk.pie": 2,
};
const GRAPH_TYPES = new Set(Object.keys(EXPECTED_GRAPH_COUNTS));

const VIEWS_DIR = path.resolve(
  __dirname,
  "../src/main/resources/splunk/default/data/ui/views",
);
const APPLICATION_CSS_PATH = path.resolve(
  __dirname,
  "../src/main/resources/splunk/appserver/static/application.css",
);
const TEMPLATES_CONF_PATH = path.resolve(
  __dirname,
  "../src/main/resources/splunk/default/templates.conf",
);
const BACKGROUND_BUTTON_PATH = path.resolve(
  __dirname,
  "../src/main/webapp/pages/dashboardbuilder/BackgroundButton.jsx",
);
const DASHBOARD_EDITOR_PATH = path.resolve(
  __dirname,
  "../src/main/webapp/pages/dashboardbuilder/DashboardStudioEditor.jsx",
);

const HOME_DARK_PALETTE = {
  canvas: "#0f1117",
  panel: "#131a23",
  secondary: "#1c2738",
  text: "#ecf0f5",
  accent: "#649ef5",
  accentStroke: "rgba(100,158,245,0.28)",
};

const C3_GRAPH_COLORS = new Set([
  "#649ef5", // information blue
  "#4cbf7f", // healthy green
  "#f0c243", // caution yellow
  "#fa5762", // critical red
  "#9ca6ff", // comparison lavender
  "#9b5ff5", // comparison purple
  "#049fd9", // chart cyan
  "#00bceb", // bright cyan
  "#f7782f", // orange
  "#a6adb6", // neutral
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
  ...C3_GRAPH_COLORS,
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
  "#0f172a",
  "#1e293b",
  "#f1f5f9",
  "#0ea5e9",
  "rgba(14,165,233,0.42)",
  "#5eead4",
  "#67e8f9",
  "#6ee7b7",
  "#7dd3fc",
  "#c4b5fd",
  "#cbd5e1",
  "#fcd34d",
  "#fda4af",
  "#fdba74",
];

const readDashboard = (fileName) => {
  const filePath = path.join(VIEWS_DIR, fileName);
  const xml = fs.readFileSync(filePath, "utf8");
  const definitionMatch = xml.match(
    /<definition><!\[CDATA\[([\s\S]*?)\]\]><\/definition>/,
  );
  assert.ok(definitionMatch, `${fileName} must contain a Dashboard Studio definition`);
  return { fileName, xml, definition: JSON.parse(definitionMatch[1]) };
};

const templatesSource = fs.readFileSync(TEMPLATES_CONF_PATH, "utf8");
const c3BackgroundMatch = templatesSource.match(
  /\[background:\/\/c3-atmosphere\]\ndata = ([^\n]+)\nname = Cisco Cloud Control Atmosphere/,
);
assert.ok(c3BackgroundMatch, "templates.conf must provide the factory C3 atmosphere background");
const c3BackgroundData = c3BackgroundMatch[1];
assert.match(c3BackgroundData, /^data:image\/svg\+xml;base64,/);

const backgroundButtonSource = fs.readFileSync(BACKGROUND_BUTTON_PATH, "utf8");
assert.match(
  backgroundButtonSource,
  /useState\(C3_DEFAULT_BACKGROUND_NAME\)/,
  "Dashboard Manager must select the C3 atmosphere background by default",
);
assert.match(
  backgroundButtonSource,
  /aria-label="Choose dashboard background or theme"/,
  "Dashboard Manager must expose an accessible name for the background selector",
);

const dashboardEditorSource = fs.readFileSync(DASHBOARD_EDITOR_PATH, "utf8");
assert.match(
  dashboardEditorSource,
  /src: C3_DEFAULT_BACKGROUND_DATA/,
  "new Dashboard Manager dashboards must use the C3 atmosphere background",
);

const actualStudioFiles = fs
  .readdirSync(VIEWS_DIR)
  .filter((fileName) => fileName.startsWith("secure_networking_") && fileName.endsWith(".xml"))
  .filter((fileName) =>
    /<dashboard\s+version="2"/.test(fs.readFileSync(path.join(VIEWS_DIR, fileName), "utf8")),
  )
  .sort();

assert.deepEqual(
  actualStudioFiles,
  EXPECTED_STUDIO_FILES,
  "Secure Networking must ship the authoritative set of 16 Studio story dashboards",
);

const dashboardViews = actualStudioFiles.map(readDashboard);
const totalGraphCounts = Object.fromEntries(
  Object.keys(EXPECTED_GRAPH_COUNTS).map((type) => [type, 0]),
);

for (const { fileName, xml, definition } of dashboardViews) {
  assert.match(
    xml,
    /<dashboard\s+version="2"[^>]*theme="dark"[^>]*stylesheet="application\.css"/,
    `${fileName} must use the dark theme and shared Studio stylesheet`,
  );

  const visualizations = definition.visualizations;
  const visualizationEntries = Object.entries(visualizations);
  const dataSources = definition.dataSources;
  const layout = definition.layout.layoutDefinitions.layout_overview;
  const header = visualizations.viz_header_bg?.options;

  assert.equal(layout.type, "absolute", `${fileName} must use an absolute layout`);
  assert.equal(layout.options.width, 1440, `${fileName} must use the 1440-pixel canvas`);
  assert.equal(
    layout.options.display,
    "auto-scale",
    `${fileName} must auto-scale its 1440-pixel canvas`,
  );
  assert.equal(
    layout.options.backgroundColor,
    HOME_DARK_PALETTE.canvas,
    `${fileName} must use the Insights Workspace canvas color`,
  );
  assert.deepEqual(
    layout.options.backgroundImage,
    { sizeType: "cover", src: c3BackgroundData, x: 0, y: 0 },
    `${fileName} must use the factory C3 atmosphere background`,
  );
  assert.equal(
    header?.fillColor,
    HOME_DARK_PALETTE.secondary,
    `${fileName} must use the secondary surface for its header`,
  );
  assert.equal(
    header?.strokeColor,
    HOME_DARK_PALETTE.accentStroke,
    `${fileName} must use the C3 information accent for its header border`,
  );

  assert.equal(
    Object.keys(dataSources).length,
    6,
    `${fileName} must dispatch exactly six Searchbase searches`,
  );
  for (const [dataSourceId, dataSource] of Object.entries(dataSources)) {
    assert.equal(dataSource.type, "ds.searchbase", `${fileName}:${dataSourceId} must use Searchbase`);
    assert.deepEqual(
      dataSource.options?.queryParameters,
      { earliest: "$time_tok.earliest$", latest: "$time_tok.latest$" },
      `${fileName}:${dataSourceId} must use the shared time_tok input`,
    );
  }

  const graphEntries = visualizationEntries.filter(([, visualization]) =>
    GRAPH_TYPES.has(visualization.type),
  );
  assert.equal(graphEntries.length, 6, `${fileName} must render exactly six KPI graphs`);
  assert.equal(
    visualizationEntries.filter(([, visualization]) => visualization.type === "splunk.singlevalue")
      .length,
    6,
    `${fileName} must render one headline value for each KPI graph`,
  );
  assert.ok(
    visualizationEntries.every(([, visualization]) => visualization.type !== "splunk.table"),
    `${fileName} must keep detail tables out of the six-card canvas`,
  );
  assert.ok(
    visualizationEntries.every(([, visualization]) => visualization.type !== "splunk.line"),
    `${fileName} must not regress area trends to low-contrast line charts`,
  );

  const cardBackgrounds = layout.structure.filter(({ item }) =>
    item.endsWith("_background"),
  );
  assert.equal(cardBackgrounds.length, 6, `${fileName} must define six card backgrounds`);
  assert.deepEqual(
    [...new Set(cardBackgrounds.map(({ position }) => position.x))].sort((a, b) => a - b),
    [20, 493, 966],
    `${fileName} must lay out three KPI columns`,
  );
  assert.deepEqual(
    [...new Set(cardBackgrounds.map(({ position }) => position.y))].sort((a, b) => a - b),
    [128, 624],
    `${fileName} must lay out two KPI rows`,
  );
  for (const { item } of cardBackgrounds) {
    assert.equal(
      visualizations[item].options?.fillColor,
      HOME_DARK_PALETTE.panel,
      `${fileName}:${item} must use the current card surface`,
    );
    assert.equal(
      visualizations[item].options?.strokeColor,
      HOME_DARK_PALETTE.accentStroke,
      `${fileName}:${item} must use the current card border`,
    );
  }

  for (let cardNumber = 1; cardNumber <= 6; cardNumber += 1) {
    const cardKey = `card_${String(cardNumber).padStart(2, "0")}`;
    const singleValue = visualizations[`viz_${cardKey}_singlevalue`];
    const graph = visualizations[`viz_${cardKey}_trend`];
    const trigger = visualizations[`viz_${cardKey}_drilldown_trigger`];
    const backgroundBlock = layout.structure.find(
      ({ item }) => item === `viz_${cardKey}_background`,
    );
    const singleValueBlock = layout.structure.find(
      ({ item }) => item === `viz_${cardKey}_singlevalue`,
    );
    const graphBlock = layout.structure.find(
      ({ item }) => item === `viz_${cardKey}_trend`,
    );

    assert.ok(singleValue, `${fileName}:${cardKey} must have a headline value`);
    assert.ok(graph, `${fileName}:${cardKey} must have a supporting graph`);
    assert.equal(
      singleValue.dataSources?.primary,
      graph.dataSources?.primary,
      `${fileName}:${cardKey} must share one Searchbase dispatch across both visualizations`,
    );
    assert.equal(
      singleValue.options?.sparklineDisplay,
      "off",
      `${fileName}:${cardKey} must not hide the trend in a single-value sparkline`,
    );
    assert.equal(
      singleValue.options?.trendDisplay,
      "off",
      `${fileName}:${cardKey} must reserve trend rendering for the supporting graph`,
    );
    assert.match(
      singleValue.options?.majorValue || "",
      /^> primary \| seriesByName\(".+"\) \| lastPoint\(\)$/,
      `${fileName}:${cardKey} must bind its headline to one named result field`,
    );

    assert.ok(backgroundBlock, `${fileName}:${cardKey} must have card geometry`);
    assert.deepEqual(
      singleValueBlock?.position,
      {
        x: backgroundBlock.position.x + 16,
        y: backgroundBlock.position.y + 156,
        w: 421,
        h: 88,
      },
      `${fileName}:${cardKey} must center the headline above the graph`,
    );
    assert.deepEqual(
      graphBlock?.position,
      {
        x: backgroundBlock.position.x + 16,
        y: backgroundBlock.position.y + 248,
        w: 421,
        h: 212,
      },
      `${fileName}:${cardKey} must use a compact full-width lower graph`,
    );

    assert.ok(trigger, `${fileName}:${cardKey} must provide a drilldown trigger`);
    assert.equal(trigger.type, "splunk.rectangle");
    assert.equal(trigger.options?.fillColor, "transparent");
    assert.equal(trigger.options?.strokeColor, "transparent");
    assert.equal(trigger.eventHandlers?.length, 1);
    assert.equal(trigger.eventHandlers?.[0]?.type, "drilldown.customUrl");
    assert.match(
      trigger.eventHandlers?.[0]?.options?.url || "",
      /^\/drilldown\?origin=.+&target=.+/,
      `${fileName}:${cardKey} must route to one or more ordered Searchbase details`,
    );
    assert.ok(
      !visualizations[`viz_${cardKey}_drilldown_icon`],
      `${fileName}:${cardKey} must rely on Dashboard Manager for the standard drilldown icon`,
    );
  }

  for (const [visualizationId, graph] of graphEntries) {
    totalGraphCounts[graph.type] += 1;
    assert.equal(
      graph.options?.backgroundColor,
      "transparent",
      `${fileName}:${visualizationId} must preserve the card background`,
    );
    assert.ok(
      graph.options?.seriesColors?.length > 0,
      `${fileName}:${visualizationId} must define an explicit C3 series palette`,
    );
    for (const color of graph.options.seriesColors) {
      assert.ok(
        C3_GRAPH_COLORS.has(color.toLowerCase()),
        `${fileName}:${visualizationId} uses a graph color outside the C3 palette: ${color}`,
      );
    }
    if (graph.type === "splunk.area") {
      assert.equal(
        graph.options?.lineWidth,
        3,
        `${fileName}:${visualizationId} must use the thicker area outline`,
      );
      assert.equal(graph.options?.markerDisplay, "outlined");
      assert.equal(graph.options?.nullValueDisplay, "connect");
    } else if (graph.type === "splunk.bar" || graph.type === "splunk.column") {
      assert.equal(graph.options?.stackMode, "unstacked");
      assert.equal(graph.options?.legendDisplay, "right");
    } else if (graph.type === "splunk.pie") {
      assert.equal(graph.options?.legendDisplay, "right");
    }
    if (graph.type === "splunk.pie") {
      assert.match(
        graph.options?.label || "",
        /^> primary \| seriesByName\(".+"\)$/,
        `${fileName}:${visualizationId} must bind its pie category field`,
      );
      assert.match(
        graph.options?.value || "",
        /^> primary \| seriesByName\(".+"\)$/,
        `${fileName}:${visualizationId} must bind its pie value field`,
      );
    } else {
      assert.match(
        graph.options?.x || "",
        /^> primary \| seriesByName\(".+"\)$/,
        `${fileName}:${visualizationId} must bind its x-axis field`,
      );
      assert.match(
        graph.options?.y || "",
        /^> primary \| (?:seriesByName|frameBySeriesNames)\(".+"(?:, ".+")*\)$/,
        `${fileName}:${visualizationId} must bind only its intended graph fields`,
      );
    }
  }

  for (const retiredColor of RETIRED_STUDIO_COLORS) {
    assert.ok(
      !xml.toLowerCase().includes(retiredColor),
      `${fileName} must not retain retired Studio color ${retiredColor}`,
    );
  }
  const colors = [...xml.matchAll(/#[0-9a-f]{6}/gi)].map((match) =>
    match[0].toLowerCase(),
  );
  for (const color of colors) {
    assert.ok(
      ALLOWED_COLORS.has(color),
      `${fileName} uses ${color}, which is outside the home dashboard palette`,
    );
  }
  assert.ok(
    colors.includes(HOME_DARK_PALETTE.text),
    `${fileName} must use the primary dark-mode text color`,
  );
  assert.ok(
    colors.includes(HOME_DARK_PALETTE.accent) || colors.includes("#049fd9"),
    `${fileName} must use the C3 information blue or chart cyan`,
  );
}

assert.deepEqual(
  totalGraphCounts,
  EXPECTED_GRAPH_COUNTS,
  "The 16 story dashboards must preserve their 96 intentionally selected graph types",
);
assert.equal(
  Object.values(totalGraphCounts).reduce((total, count) => total + count, 0),
  96,
  "The story dashboard set must contain exactly 96 graphs",
);

const applicationCss = fs.readFileSync(APPLICATION_CSS_PATH, "utf8");
assert.match(
  applicationCss,
  /\[data-test='viz-description'\][\s\S]*?white-space:\s*normal;[\s\S]*?-webkit-line-clamp:\s*3;/,
  "Dashboard Studio descriptions must retain the shared wrapping treatment",
);
assert.match(
  applicationCss,
  /\[data-test='viz-size-wrapper'\][\s\S]*?flex:\s*1 1 0;[\s\S]*?height:\s*auto !important;/,
  "Dashboard Studio visualizations must resize below wrapped descriptions",
);

console.log(
  "✓ Secure Networking palette and 16-dashboard six-card story contract passed",
);
