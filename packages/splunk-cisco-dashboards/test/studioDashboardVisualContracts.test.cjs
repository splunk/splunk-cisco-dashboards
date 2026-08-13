"use strict";

const assert = require("assert").strict;
const fs = require("fs");
const path = require("path");

const APP_ROOT = path.resolve(__dirname, "..");
const REPOSITORY_ROOT = path.resolve(APP_ROOT, "../..");
const VIEWS_ROOT = path.join(
  APP_ROOT,
  "src/main/resources/splunk/default/data/ui/views",
);
const STATIC_ROOT = path.join(
  APP_ROOT,
  "src/main/resources/splunk/appserver/static",
);
const PALETTE_SOURCE = fs.readFileSync(
  path.join(APP_ROOT, "src/main/webapp/common/theme/c3VisualizationPalette.ts"),
  "utf8",
);
const C3_COLORS = new Set(
  [...PALETTE_SOURCE.matchAll(/:\s*'(#[0-9a-f]{6})'/gi)].map((match) =>
    match[1].toLowerCase(),
  ),
);
C3_COLORS.add("#ecf0f5");
C3_COLORS.add("#a6adb6");
const C3_RGB = new Set(
  [...C3_COLORS].map((color) =>
    [1, 3, 5]
      .map((offset) => Number.parseInt(color.slice(offset, offset + 2), 16))
      .join(","),
  ),
);

const studioFiles = fs
  .readdirSync(VIEWS_ROOT)
  .filter((fileName) => fileName.endsWith(".xml"))
  .filter((fileName) =>
    /<dashboard\s+version="2"/.test(
      fs.readFileSync(path.join(VIEWS_ROOT, fileName), "utf8"),
    ),
  )
  .sort();

const assertApprovedColor = (value, message) => {
  if (typeof value !== "string" || value.startsWith(">")) return;
  const rgbaMatch = value.match(
    /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(?:0|1|0?\.\d+)\s*\)$/i,
  );
  assert.ok(
    C3_COLORS.has(value.toLowerCase()) ||
      (rgbaMatch && C3_RGB.has(rgbaMatch.slice(1, 4).join(","))),
    `${message}: ${value}`,
  );
};

for (const fileName of studioFiles) {
  const xml = fs.readFileSync(path.join(VIEWS_ROOT, fileName), "utf8");
  const definitionMatch = xml.match(
    /<definition><!\[CDATA\[([\s\S]*?)\]\]><\/definition>/,
  );
  assert.ok(definitionMatch, `${fileName} must contain a Studio definition`);
  const definition = JSON.parse(definitionMatch[1]);

  for (const [visualizationId, visualization] of Object.entries(
    definition.visualizations || {},
  )) {
    if (visualization.type !== "splunk.singlevalue") continue;
    const options = visualization.options || {};

    assert.ok(options.majorColor, `${fileName}:${visualizationId} major color`);
    assertApprovedColor(
      options.majorColor,
      `${fileName}:${visualizationId} major color must use the C3 palette`,
    );

    if (options.trendDisplay !== "off") {
      assert.ok(
        options.trendColor,
        `${fileName}:${visualizationId} must not use the default black trend color`,
      );
      assertApprovedColor(
        options.trendColor,
        `${fileName}:${visualizationId} trend color must use the C3 palette`,
      );
      if (options.trendColor.startsWith(">")) {
        const colors = visualization.context?.trendColorEditorConfig?.map(
          ({ value }) => value,
        );
        assert.ok(
          colors?.length,
          `${fileName}:${visualizationId} dynamic trend color needs a range`,
        );
        for (const color of colors) {
          assertApprovedColor(
            color,
            `${fileName}:${visualizationId} trend range must use the C3 palette`,
          );
        }
      }
    }

    if (options.sparklineDisplay !== "off") {
      assert.ok(
        options.sparklineStrokeColor,
        `${fileName}:${visualizationId} must not use a default sparkline color`,
      );
      assertApprovedColor(
        options.sparklineStrokeColor,
        `${fileName}:${visualizationId} sparkline must use the C3 palette`,
      );
      assert.equal(
        Object.hasOwn(options, "sparklineSeriesColor"),
        false,
        `${fileName}:${visualizationId} uses the unsupported sparklineSeriesColor option`,
      );
    }

    if (options.showSparklineAreaGraph === true) {
      assert.ok(
        options.sparklineAreaColor,
        `${fileName}:${visualizationId} sparkline area needs an explicit C3 color`,
      );
      assertApprovedColor(
        options.sparklineAreaColor,
        `${fileName}:${visualizationId} sparkline area must use the C3 palette`,
      );
    }
  }

  const largeHeaderTitles = new Set(
    Object.entries(definition.visualizations || {})
      .filter(
        ([, visualization]) =>
          visualization.type === "splunk.markdown" &&
          visualization.options?.fontSize === "large" &&
          /^##\s/.test(visualization.options?.markdown || ""),
      )
      .map(([visualizationId]) => visualizationId),
  );
  for (const [layoutId, layout] of Object.entries(
    definition.layout?.layoutDefinitions || {},
  )) {
    for (const item of layout.structure || []) {
      if (!largeHeaderTitles.has(item.item)) continue;
      assert.ok(
        item.position?.h >= 40,
        `${fileName}:${layoutId}:${item.item} must allow the title to render without clipping`,
      );
    }
  }
}

for (const relativePath of [
  "bkd-sei-generic-1.svg",
  "bkd-sei-generic-3.svg",
  "bkd-sei-generic-7.svg",
  "bkd-sei-generic-8.svg",
  "bkd-sei-generic-10.svg",
  "bkd-sei-generic-11.svg",
  "images/background_statewide.png",
  "images/overview/secure-networking/agentic-ops.svg",
  "images/overview/secure-networking/hybrid-mesh-firewalling.svg",
  "images/overview/secure-networking/secure-infrastructure.svg",
  "images/overview/secure-networking/segmentation.svg",
  "images/overview/secure-networking/zero-trust-access.svg",
]) {
  assert.equal(
    fs.existsSync(path.join(STATIC_ROOT, relativePath)),
    false,
    `${relativePath} is an unreferenced legacy asset and must stay removed`,
  );
}

const collectFiles = (root) =>
  fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(root, entry.name);
    return entry.isDirectory() ? collectFiles(entryPath) : [entryPath];
  });
const sourceFiles = [
  ...collectFiles(path.join(APP_ROOT, "src")),
  ...collectFiles(path.join(REPOSITORY_ROOT, "scripts")),
];
const sourceText = sourceFiles
  .map((filePath) => {
    const contents = fs.readFileSync(filePath);
    return contents.includes(0) ? null : [filePath, contents.toString("utf8")];
  })
  .filter(Boolean);
for (const assetPath of collectFiles(path.join(APP_ROOT, "src/main/resources/splunk/appserver"))) {
  const relativePath = path.relative(STATIC_ROOT, assetPath);
  if (relativePath === "dashboard.css") continue;
  const fileName = path.basename(assetPath);
  assert.ok(
    sourceText.some(
      ([sourcePath, contents]) => sourcePath !== assetPath && contents.includes(fileName),
    ),
    `${relativePath} must have a source reference or an explicit convention exception`,
  );
}

const vizKpiSource = fs.readFileSync(
  path.join(APP_ROOT, "src/main/webapp/common/components/templatewizard/viz-kpi/VizKpi.jsx"),
  "utf8",
);
assert.ok(fs.existsSync(path.join(STATIC_ROOT, "icn_view.svg")));
assert.match(vizKpiSource, /src="\/static\/app\/splunk-cisco-dashboards\/icn_view\.svg"/);
assert.ok(fs.existsSync(path.join(STATIC_ROOT, "placeholder.svg")));
assert.match(vizKpiSource, /splunk-cisco-dashboards\/placeholder\.svg/);

console.log("Studio dashboard visual and appserver asset contracts passed");
