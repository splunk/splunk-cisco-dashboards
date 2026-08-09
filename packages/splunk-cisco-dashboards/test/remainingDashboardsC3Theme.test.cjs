"use strict";

const assert = require("assert").strict;
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const APP_ROOT = path.resolve(__dirname, "..");
const VIEWS_DIR = path.join(
  APP_ROOT,
  "src/main/resources/splunk/default/data/ui/views",
);
const TEMPLATES_PATH = path.join(
  APP_ROOT,
  "src/main/resources/splunk/default/templates.conf",
);
const PALETTE_PATH = path.join(
  APP_ROOT,
  "src/main/webapp/common/theme/c3VisualizationPalette.ts",
);
const SHARED_STYLES_PATH = path.join(
  APP_ROOT,
  "src/main/webapp/common/styles/tailwind.css",
);

const CANVAS = "#0f1117";
const PANEL = "#131a23";
const SECONDARY = "#1c2738";
const TEXT = "#ecf0f5";
const MUTED = "#a6adb6";
const ACCENT_STROKE = "rgba(100,158,245,0.28)";
const SECTION_FILL = "rgba(15,17,23,0.78)";
const SECTION_STROKE = "rgba(65,74,86,0.52)";

const DASHBOARDS = {
  "admin_guide_v1.xml": {
    digest: "2d70500b03d8b1db0e42614535d2ba2de8dfd6b72c50ab43a5d1864049468352",
    dataSources: 23,
    visualizations: 52,
    tabs: 2,
    eventHandlers: 0,
  },
  "asset_inventory_v1.xml": {
    digest: "937e127f71bce1243bad429ad3504bc67ab796e59806e8a20bf65854f44a98b8",
    dataSources: 25,
    visualizations: 41,
    tabs: 3,
    eventHandlers: 0,
  },
  "building_v1.xml": {
    digest: "50d8aa98718334abe6cb536cd470eaf0dfbdc69043505acd147ef4c716ef063a",
    dataSources: 25,
    visualizations: 52,
    tabs: 4,
    eventHandlers: 0,
  },
  "netops_readiness_v1.xml": {
    digest: "b118c5b2db4f20c66cea107bddb95dd386283803b40f5351b1c5f8beaa360f6e",
    dataSources: 29,
    visualizations: 79,
    tabs: 5,
    eventHandlers: 2,
  },
  "security_v1.xml": {
    digest: "ca2357ed96951cf30437d2d58aea2814c7b898942e376af412f31a221aeba42e",
    dataSources: 43,
    visualizations: 50,
    tabs: 3,
    eventHandlers: 0,
  },
  "spaces_intelligence_v1.xml": {
    digest: "40cea6148eb15dd2559760349a8e49fe5da40a7938b9c30f6ffe02b48d33e137",
    dataSources: 58,
    visualizations: 76,
    tabs: 7,
    eventHandlers: 0,
  },
  "statewide_exercise_v1.xml": {
    digest: "966e1c6e3c8874579ada047230ef851aa88e2814857073f8cb31551b66fe661d",
    dataSources: 77,
    visualizations: 106,
    tabs: 4,
    eventHandlers: 0,
  },
  "statewide_exercise_v1_studio_modern.xml": {
    digest: "67c63de0c20c503dbc3f0f195a0fcc9d576be9a6288d3d6af6e1f16221816e30",
    dataSources: 34,
    visualizations: 32,
    tabs: 4,
    eventHandlers: 2,
  },
  "workplace_spog_v1.xml": {
    digest: "4db5155815c22226b068619135136a832a4288dfe9d96b32e6c332effc5958ac",
    dataSources: 9,
    visualizations: 32,
    tabs: 1,
    eventHandlers: 0,
  },
};

const CHART_TYPES = new Set([
  "splunk.area",
  "splunk.bar",
  "splunk.column",
  "splunk.line",
  "splunk.pie",
  "splunk.punchcard",
  "splunk.sankey",
  "splunk.scatter",
]);
const STYLE_OPTION_KEYS = new Set([
  "backgroundColor",
  "fillColor",
  "fillOpacity",
  "strokeColor",
  "strokeOpacity",
  "strokeWidth",
  "rx",
  "rounding",
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

const scrubColors = (value) => {
  if (Array.isArray(value)) return value.map(scrubColors);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, scrubColors(nested)]),
    );
  }
  if (typeof value === "string") {
    return value.replace(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)/gi, "<COLOR>");
  }
  return value;
};

const cleanOptions = (options = {}) =>
  Object.fromEntries(
    Object.entries(options)
      .filter(([key]) => !STYLE_OPTION_KEYS.has(key))
      .map(([key, value]) => [key, scrubColors(value)]),
  );

const behaviorDigest = (definition) => {
  const projection = {
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

  return crypto.createHash("sha256").update(JSON.stringify(projection)).digest("hex");
};

for (const [filename, baseline] of Object.entries(DASHBOARDS)) {
  const xml = fs.readFileSync(path.join(VIEWS_DIR, filename), "utf8");
  assert.match(
    xml,
    /<dashboard\s+version="2"\s+theme="dark"\s+stylesheet="application\.css">/,
    `${filename} must use the saved dark theme and shared Studio stylesheet`,
  );

  const definitionMatch = xml.match(
    /<definition><!\[CDATA\[([\s\S]*?)\]\]><\/definition>/,
  );
  assert.ok(definitionMatch, `${filename} must contain a Dashboard Studio definition`);
  const definition = JSON.parse(definitionMatch[1]);

  assert.equal(Object.keys(definition.dataSources).length, baseline.dataSources);
  assert.equal(Object.keys(definition.visualizations).length, baseline.visualizations);
  assert.equal(definition.layout.tabs.items.length, baseline.tabs);
  assert.equal(
    Object.values(definition.visualizations).reduce(
      (count, visualization) =>
        count + (Array.isArray(visualization.eventHandlers) ? visualization.eventHandlers.length : 0),
      0,
    ),
    baseline.eventHandlers,
  );

  for (const [layoutId, layout] of Object.entries(definition.layout.layoutDefinitions)) {
    assert.equal(layout.options.backgroundColor, CANVAS, `${filename}:${layoutId} canvas`);
    assert.deepEqual(
      layout.options.backgroundImage,
      { sizeType: "cover", src: sharedBackground, x: 0, y: 0 },
      `${filename}:${layoutId} atmosphere`,
    );
  }

  for (const [visualizationId, visualization] of Object.entries(
    definition.visualizations,
  )) {
    const options = visualization.options || {};
    if (visualization.type === "splunk.rectangle") {
      const isHeader = /(?:^|_)(?:hdr|header)(?:_|$)/i.test(visualizationId);
      const isSection = /(?:^|_)section(?:_|$)/i.test(visualizationId);
      assert.equal(
        options.fillColor,
        isHeader ? SECONDARY : isSection ? SECTION_FILL : PANEL,
        `${filename}:${visualizationId} rectangle fill`,
      );
      assert.equal(
        options.strokeColor,
        isSection ? SECTION_STROKE : ACCENT_STROKE,
        `${filename}:${visualizationId} rectangle stroke`,
      );
    } else {
      assert.ok(
        [PANEL, SECONDARY].includes(options.backgroundColor),
        `${filename}:${visualizationId} must use an opaque dark surface`,
      );
    }

    if (visualization.type === "splunk.markdown") {
      assert.ok(
        [TEXT, MUTED, ...sharedPalette].includes(options.fontColor.toLowerCase()),
        `${filename}:${visualizationId} must use the C3 typography hierarchy`,
      );
      if (options.fontSize === "custom") {
        assert.ok(Number(options.customFontSize) >= 12, `${filename}:${visualizationId} font size`);
      }
    }

    if (CHART_TYPES.has(visualization.type)) {
      assert.ok(options.seriesColors?.length, `${filename}:${visualizationId} chart palette`);
      for (const color of options.seriesColors) {
        assert.ok(
          sharedPalette.has(color.toLowerCase()),
          `${filename}:${visualizationId} uses a color outside the shared C3 palette: ${color}`,
        );
      }
    }

    if (visualization.type === "splunk.area" || visualization.type === "splunk.line") {
      assert.equal(options.lineWidth, 2, `${filename}:${visualizationId} line width`);
      assert.equal(options.markerDisplay, "show", `${filename}:${visualizationId} markers`);
    }

    if (visualization.type === "splunk.table") {
      assert.equal(options.tableFormat?.headerBackgroundColor, SECONDARY);
      assert.equal(options.tableFormat?.headerColor, TEXT);
    }
  }

  assert.equal(
    behaviorDigest(definition),
    baseline.digest,
    `${filename} searches, tokens, inputs, tabs, layout geometry, visualizations, or interactions changed`,
  );
}

for (const filename of ["secure_operations_glass.xml", "user_guide.xml"]) {
  const xml = fs.readFileSync(path.join(VIEWS_DIR, filename), "utf8");
  assert.match(xml, /<dashboard\s+version="1\.1"\s+theme="dark"/);
  assert.match(xml, /color: #a6adb6; background: #0f1117;/);
}

const secureOperationsSource = fs.readFileSync(
  path.join(APP_ROOT, "src/main/webapp/pages/secure_operations_glass/index.tsx"),
  "utf8",
);
assert.match(secureOperationsSource, /C3_SERIES_PALETTE/);
assert.doesNotMatch(secureOperationsSource, /LIGHT_COLORS|DARK_COLORS/);

const userGuideSource = fs.readFileSync(
  path.join(APP_ROOT, "src/main/webapp/pages/user_guide/index.tsx"),
  "utf8",
);
assert.match(userGuideSource, /useTheme\(\)/);
assert.match(userGuideSource, /scd-c3-surface/);
assert.match(userGuideSource, /ThemeToggle/);

const sharedStyles = fs.readFileSync(SHARED_STYLES_PATH, "utf8");
for (const [token, value] of [
  ["--scd-c3-canvas", CANVAS],
  ["--scd-c3-panel", PANEL],
  ["--scd-c3-secondary", SECONDARY],
  ["--scd-c3-text", TEXT],
  ["--scd-c3-muted", MUTED],
]) {
  assert.match(sharedStyles, new RegExp(`${token}:\\s*${value.replace("#", "\\#")}`));
}

const allViewFiles = fs.readdirSync(VIEWS_DIR).filter((filename) => filename.endsWith(".xml"));
for (const filename of allViewFiles) {
  const xml = fs.readFileSync(path.join(VIEWS_DIR, filename), "utf8");
  assert.doesNotMatch(xml, /<dashboard[^>]*\stheme="light"/, `${filename} remains light`);
}

console.log("Remaining dashboards C3 dark-theme checks passed.");
