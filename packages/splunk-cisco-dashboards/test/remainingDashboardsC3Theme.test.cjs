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
const C3_BACKGROUND_PATH = path.join(
  APP_ROOT,
  "src/main/resources/splunk/appserver/static/c3-atmosphere.svg",
);
const SPOTLIGHT_BACKGROUND_PATH = path.join(
  APP_ROOT,
  "src/main/resources/splunk/appserver/static/page-spotlight-bottom-glow-low-intensity.svg",
);
const PALETTE_PATH = path.join(
  APP_ROOT,
  "src/main/webapp/common/theme/c3VisualizationPalette.ts",
);
const SHARED_STYLES_PATH = path.join(
  APP_ROOT,
  "src/main/webapp/common/theme/SemanticThemeStyles.tsx",
);

const CANVAS = "#0f1117";
const PANEL = "#131a23";
const SECONDARY = "#1c2738";
const TEXT = "#ecf0f5";
const MUTED = "#a6adb6";
const ACCENT_STROKE = "rgba(100,158,245,0.28)";
const SECTION_FILL = "rgba(15,17,23,0.78)";
const SECTION_STROKE = "rgba(65,74,86,0.52)";
const PILLAR_STUDIO_FILES = new Set([
  "sn_agentic_ops_operational_intelligence.xml",
  "sn_hmf_enforcement.xml",
  "sn_secure_infrastructure_posture.xml",
  "sn_segmentation_readiness.xml",
  "sn_zta_posture.xml",
]);

const DASHBOARDS = {
  "admin_asset_inventory.xml": {
    digest: "937e127f71bce1243bad429ad3504bc67ab796e59806e8a20bf65854f44a98b8",
    dataSources: 25,
    visualizations: 41,
    tabs: 3,
    eventHandlers: 0,
  },
  "workplace_building_intelligence.xml": {
    digest: "50d8aa98718334abe6cb536cd470eaf0dfbdc69043505acd147ef4c716ef063a",
    dataSources: 25,
    visualizations: 52,
    tabs: 4,
    eventHandlers: 0,
  },
  "netops_readiness.xml": {
    digest: "b118c5b2db4f20c66cea107bddb95dd386283803b40f5351b1c5f8beaa360f6e",
    dataSources: 29,
    visualizations: 79,
    tabs: 5,
    eventHandlers: 2,
  },
  "secops_resilience.xml": {
    digest: "ca2357ed96951cf30437d2d58aea2814c7b898942e376af412f31a221aeba42e",
    dataSources: 43,
    visualizations: 50,
    tabs: 3,
    eventHandlers: 0,
  },
  "workplace_spaces_intelligence.xml": {
    digest: "47cb20787336662e68fda7774d8ba72fa9131ac8d0bd97441dd81a7a8dfdaf5b",
    dataSources: 58,
    visualizations: 76,
    tabs: 7,
    eventHandlers: 0,
  },
  "netops_catalyst_health.xml": {
    digest: "966e1c6e3c8874579ada047230ef851aa88e2814857073f8cb31551b66fe661d",
    dataSources: 77,
    visualizations: 106,
    tabs: 4,
    eventHandlers: 0,
  },
  "netops_catalyst_operations.xml": {
    digest: "ed497ec61c0ad9791c0096c138209496efa4e3e4063151ae01d1de18ebda6098",
    dataSources: 34,
    visualizations: 32,
    tabs: 4,
    eventHandlers: 2,
  },
  "workplace_operations_overview.xml": {
    digest: "753fedb7c1ff37489fc349f5c421c5830fd9b31f8c2a1cc93a9bb9224b7b4891",
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

const sharedBackground = `data:image/svg+xml;base64,${Buffer.from(
  fs.readFileSync(C3_BACKGROUND_PATH, "utf8").trim(),
).toString("base64")}`;
const spotlightBackground = `data:image/svg+xml;base64,${Buffer.from(
  fs.readFileSync(SPOTLIGHT_BACKGROUND_PATH, "utf8").trim(),
).toString("base64")}`;

const paletteSource = fs.readFileSync(PALETTE_PATH, "utf8");
const sharedPalette = new Set(
  [...paletteSource.matchAll(/:\s*'(#[0-9a-f]{6})'/gi)].map((match) =>
    match[1].toLowerCase(),
  ),
);
assert.ok(sharedPalette.size >= 10, "the shared C3 visualization palette must be readable");

const studioViewFiles = fs
  .readdirSync(VIEWS_DIR)
  .filter((filename) => filename.endsWith(".xml"))
  .filter((filename) =>
    /<dashboard\s+version="2"/.test(fs.readFileSync(path.join(VIEWS_DIR, filename), "utf8")),
  )
  .sort();

assert.ok(studioViewFiles.length > 0, "at least one native Studio dashboard must exist");

for (const filename of studioViewFiles) {
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
  const layoutDefinitions = definition.layout?.layoutDefinitions || {};
  assert.ok(
    Object.keys(layoutDefinitions).length > 0,
    `${filename} must contain at least one Studio layout`,
  );

  for (const [layoutId, layout] of Object.entries(layoutDefinitions)) {
    assert.equal(layout.options?.backgroundColor, CANVAS, `${filename}:${layoutId} canvas`);
    const expectedBackground = PILLAR_STUDIO_FILES.has(filename)
      ? spotlightBackground
      : sharedBackground;
    assert.deepEqual(
      layout.options?.backgroundImage,
      { sizeType: "contain", src: expectedBackground, x: 0, y: 0 },
      `${filename}:${layoutId} approved background`,
    );
    if (Number(layout.options?.width) > 1440) {
      assert.equal(
        layout.options?.display,
        "fit-to-width",
        `${filename}:${layoutId} wide canvas must not create horizontal page overflow`,
      );
    }
  }
}

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
      { sizeType: "contain", src: sharedBackground, x: 0, y: 0 },
      `${filename}:${layoutId} atmosphere`,
    );
  }

  for (const [visualizationId, visualization] of Object.entries(
    definition.visualizations,
  )) {
    const options = visualization.options || {};
    if (typeof options.markerDisplay === "string" && !options.markerDisplay.startsWith("$")) {
      assert.ok(
        ["off", "filled", "outlined"].includes(options.markerDisplay),
        `${filename}:${visualizationId} uses invalid markerDisplay ${options.markerDisplay}`,
      );
    }
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
      assert.equal(options.markerDisplay, "outlined", `${filename}:${visualizationId} markers`);
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

for (const filename of ["secops_overview.xml", "user_guide.xml"]) {
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
assert.match(userGuideSource, /scd-c3-surface/);
assert.match(userGuideSource, /scd-c3-atmosphere/);
assert.doesNotMatch(userGuideSource, /data-theme=/);
assert.doesNotMatch(userGuideSource, /useTheme|ThemeToggle/);

const sharedStyles = fs.readFileSync(SHARED_STYLES_PATH, "utf8");
for (const [token, semanticToken] of [
  ["--scd-c3-canvas", "backgroundColorPage"],
  ["--scd-c3-panel", "backgroundColorSection"],
  ["--scd-c3-secondary", "backgroundColorPopup"],
  ["--scd-c3-text", "contentColorActive"],
  ["--scd-c3-muted", "contentColorMuted"],
]) {
  assert.match(sharedStyles, new RegExp(`${token}:\\s*\\$\\{variables\\.${semanticToken}\\}`));
}

const allViewFiles = fs.readdirSync(VIEWS_DIR).filter((filename) => filename.endsWith(".xml"));
for (const filename of allViewFiles) {
  const xml = fs.readFileSync(path.join(VIEWS_DIR, filename), "utf8");
  assert.doesNotMatch(xml, /<dashboard[^>]*\stheme="light"/, `${filename} remains light`);
}

console.log(
  `${studioViewFiles.length} native Studio dashboards use their approved C3 or pillar spotlight background.`,
);
