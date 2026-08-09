"use strict";

const assert = require("assert").strict;
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const VIEWS_DIR = path.resolve(
  __dirname,
  "../src/main/resources/splunk/default/data/ui/views",
);
const DASHBOARD_PATH = path.join(VIEWS_DIR, "it_health_v1.xml");
const TEMPLATES_PATH = path.resolve(
  __dirname,
  "../src/main/resources/splunk/default/templates.conf",
);
const PALETTE_PATH = path.resolve(
  __dirname,
  "../src/main/webapp/common/theme/c3VisualizationPalette.ts",
);

const CANVAS = "#0f1117";
const PANEL = "#131a23";
const SECONDARY = "#1c2738";
const TEXT = "#ecf0f5";
const MUTED_TEXT = "#a6adb6";
const ACCENT_STROKE = "rgba(100,158,245,0.28)";
const SECTION_FILL = "rgba(15,17,23,0.78)";
const SECTION_STROKE = "rgba(65,74,86,0.52)";
const BEHAVIOR_DIGEST =
  "00871087996ed30f1803f749566147a2058ad04ef81701b5bd6f7f48f258b080";

const HEADER_RECTANGLES = new Set(["viz_p_hdr_bg", "viz_cc_header_bg"]);
const SECTION_RECTANGLES = new Set([
  "viz_it_section",
  "viz_it_section2",
  "viz_cc_section",
  "viz_te_section",
  "viz_uxh_section",
]);
const GRAPH_TYPES = new Set([
  "splunk.area",
  "splunk.bar",
  "splunk.column",
  "splunk.line",
  "splunk.pie",
]);
const STYLE_OPTION_KEYS = new Set([
  "backgroundColor",
  "fillColor",
  "fillOpacity",
  "strokeColor",
  "strokeOpacity",
  "strokeWidth",
  "rx",
  "fontColor",
  "fontSize",
  "customFontSize",
  "seriesColors",
  "lineWidth",
  "markerDisplay",
  "majorColor",
  "sparklineAreaColor",
  "sparklineStrokeColor",
  "trendColor",
  "tableFormat",
  "linkColor",
  "nodeColor",
  "nodeHighlightColor",
]);
const RETIRED_COLORS = [
  "#2b2b2b",
  "#005073",
  "#6ebe4a",
  "#e5a823",
  "#d64550",
  "#6e6e6e",
  "#8b6fc9",
  "#d43f3f",
  "#eda800",
  "#0ea5e9",
  "rgba(255,255,255,0.78)",
  "rgba(255,255,255,0.88)",
  "rgba(255,255,255,0.45)",
  "rgba(0,0,0,0.08)",
  "rgba(0,0,0,0.06)",
];

const xml = fs.readFileSync(DASHBOARD_PATH, "utf8");
const definitionMatch = xml.match(
  /<definition><!\[CDATA\[([\s\S]*?)\]\]><\/definition>/,
);
assert.ok(definitionMatch, "it_health_v1 must contain a Dashboard Studio definition");
const definition = JSON.parse(definitionMatch[1]);

const templates = fs.readFileSync(TEMPLATES_PATH, "utf8");
const backgroundMatch = templates.match(
  /\[background:\/\/c3-atmosphere\]\ndata = ([^\n]+)\nname = Cisco Cloud Control Atmosphere/,
);
assert.ok(backgroundMatch, "templates.conf must provide the shared C3 atmosphere");
const sharedBackground = backgroundMatch[1];

const paletteSource = fs.readFileSync(PALETTE_PATH, "utf8");
const sharedPalette = new Set(
  [...paletteSource.matchAll(/:\s*'(#[0-9a-f]{6})'/gi)].map((match) =>
    match[1].toLowerCase(),
  ),
);
assert.ok(sharedPalette.size >= 10, "the shared C3 visualization palette must be readable");

assert.match(
  xml,
  /<dashboard\s+version="2"\s+theme="dark"\s+stylesheet="application\.css">/,
  "it_health_v1 must use the saved dark theme and shared Studio stylesheet",
);

for (const [layoutId, layout] of Object.entries(definition.layout.layoutDefinitions)) {
  assert.equal(layout.options.backgroundColor, CANVAS, `${layoutId} must use the C3 canvas`);
  assert.deepEqual(
    layout.options.backgroundImage,
    { sizeType: "cover", src: sharedBackground, x: 0, y: 0 },
    `${layoutId} must use the shared C3 atmosphere`,
  );
}

for (const [visualizationId, visualization] of Object.entries(
  definition.visualizations,
)) {
  const options = visualization.options || {};

  if (visualization.type === "splunk.rectangle") {
    if (HEADER_RECTANGLES.has(visualizationId)) {
      assert.equal(options.fillColor, SECONDARY);
      assert.equal(options.strokeColor, ACCENT_STROKE);
    } else if (SECTION_RECTANGLES.has(visualizationId)) {
      assert.equal(options.fillColor, SECTION_FILL);
      assert.equal(options.strokeColor, SECTION_STROKE);
    } else {
      assert.equal(options.fillColor, PANEL);
      assert.equal(options.strokeColor, ACCENT_STROKE);
    }
  } else {
    assert.equal(
      options.backgroundColor,
      visualizationId === "viz_p_hdr_title" ? SECONDARY : PANEL,
      `${visualizationId} must use the shared C3 dark surface`,
    );
  }

  if (visualization.type === "splunk.markdown") {
    assert.ok(
      [TEXT, MUTED_TEXT, "#649ef5", "#f0c243"].includes(options.fontColor),
      `${visualizationId} must use the shared dark typography hierarchy`,
    );
    if (options.fontSize === "custom") {
      assert.ok(
        options.customFontSize >= 12,
        `${visualizationId} supporting text must remain at least 12px`,
      );
    }
  }

  if (GRAPH_TYPES.has(visualization.type)) {
    assert.ok(
      Array.isArray(options.seriesColors) && options.seriesColors.length > 0,
      `${visualizationId} must declare an explicit C3 series palette`,
    );
    for (const color of options.seriesColors) {
      assert.ok(
        sharedPalette.has(color.toLowerCase()),
        `${visualizationId} uses a color outside c3VisualizationPalette.ts: ${color}`,
      );
    }
  }

  if (visualization.type === "splunk.table") {
    assert.equal(
      options.tableFormat?.headerBackgroundColor,
      SECONDARY,
      `${visualizationId} must use the dark secondary surface for table headers`,
    );
  }
}

assert.equal(definition.visualizations.viz_link_graph.options.linkColor, MUTED_TEXT);
assert.equal(definition.visualizations.viz_link_graph.options.nodeColor, "#649ef5");
assert.equal(
  definition.visualizations.viz_link_graph.options.nodeHighlightColor,
  "#f0c243",
);

const normalizedXml = xml.toLowerCase();
for (const color of RETIRED_COLORS) {
  assert.equal(
    normalizedXml.includes(color),
    false,
    `it_health_v1 must not retain retired light/legacy color ${color}`,
  );
}

const scrubColors = (value) => {
  if (Array.isArray(value)) return value.map(scrubColors);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, scrubColors(nested)]),
    );
  }
  if (typeof value === "string" && /^(?:#|rgba?\()/i.test(value)) {
    return "<COLOR>";
  }
  return value;
};

const cleanOptions = (options = {}) =>
  Object.fromEntries(
    Object.entries(options)
      .filter(([key]) => !STYLE_OPTION_KEYS.has(key))
      .map(([key, value]) => [key, scrubColors(value)]),
  );

const behaviorProjection = {
  title: definition.title,
  description: definition.description,
  inputs: definition.inputs,
  defaults: definition.defaults,
  dataSources: definition.dataSources,
  layout: {
    globalInputs: definition.layout.globalInputs,
    tabs: definition.layout.tabs,
    options: Object.fromEntries(
      Object.entries(definition.layout.options || {}).filter(
        ([key]) => !["backgroundColor", "backgroundImage"].includes(key),
      ),
    ),
    layoutDefinitions: Object.fromEntries(
      Object.entries(definition.layout.layoutDefinitions).map(([layoutId, layout]) => [
        layoutId,
        {
          type: layout.type,
          options: Object.fromEntries(
            Object.entries(layout.options || {}).filter(
              ([key]) => !["backgroundColor", "backgroundImage"].includes(key),
            ),
          ),
          structure: layout.structure,
        },
      ]),
    ),
  },
  applicationProperties: definition.applicationProperties,
  visualizations: Object.fromEntries(
    Object.entries(definition.visualizations).map(([visualizationId, visualization]) => [
      visualizationId,
      {
        type: visualization.type,
        title: visualization.title,
        description: visualization.description,
        dataSources: visualization.dataSources,
        eventHandlers: visualization.eventHandlers,
        containerOptions: visualization.containerOptions,
        showProgressBar: visualization.showProgressBar,
        showLastUpdated: visualization.showLastUpdated,
        options: cleanOptions(visualization.options),
        context: scrubColors(visualization.context),
      },
    ]),
  ),
};

const actualDigest = crypto
  .createHash("sha256")
  .update(JSON.stringify(behaviorProjection))
  .digest("hex");
assert.equal(
  actualDigest,
  BEHAVIOR_DIGEST,
  "it_health_v1 searches, tokens, inputs, tabs, layouts, visualizations, or interactions changed",
);

assert.equal(Object.keys(definition.dataSources).length, 79);
assert.equal(Object.keys(definition.visualizations).length, 118);
assert.deepEqual(
  definition.layout.tabs.items.map(({ label }) => label),
  [
    "Overview",
    "User Experience",
    "ThousandEyes",
    "Details & KPI Reference",
    "Catalyst Center Intelligence",
    "About",
  ],
);
assert.equal(
  Object.values(definition.visualizations).reduce(
    (count, visualization) => count + (visualization.eventHandlers?.length || 0),
    0,
  ),
  2,
);

console.log("✓ IT Health C3 dark-theme and behavior-preservation contract passed");
