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

const readStudioDefinition = (fileName) => {
  const xml = fs.readFileSync(path.join(VIEWS_ROOT, fileName), "utf8");
  const definitionMatch = xml.match(
    /<definition><!\[CDATA\[([\s\S]*?)\]\]><\/definition>/,
  );
  assert.ok(definitionMatch, `${fileName} must contain a Studio definition`);
  return JSON.parse(definitionMatch[1]);
};
const findLayoutItem = (definition, layoutId, visualizationId) =>
  definition.layout.layoutDefinitions[layoutId].structure.find(
    ({ item }) => item === visualizationId,
  );

const readiness = readStudioDefinition("netops_readiness.xml");
assert.equal(
  Object.hasOwn(readiness.visualizations.viz_nrs_score, "description"),
  false,
  "The readiness score sparkline must not overflow beneath a long description",
);
assert.equal(
  Object.hasOwn(readiness.visualizations.viz_nrs_score, "title"),
  false,
  "The readiness score must use the section heading instead of a duplicate title",
);
assert.equal(
  readiness.visualizations.viz_nrs_per_site_bar.options.dataValuesDisplay,
  "off",
  "The dense per-site chart should expose exact values on hover instead of labeling every bar",
);

const criticalSystems = readStudioDefinition(
  "netops_critical_systems_health.xml",
);
const userExperiencePanel = findLayoutItem(
  criticalSystems,
  "layout_user_experience",
  "viz_uxh_box_gauges",
);
for (const visualizationId of [
  "viz_uxh_wireless_gauge",
  "viz_uxh_wired_gauge",
  "viz_uxh_dev_types_bar",
]) {
  const item = findLayoutItem(
    criticalSystems,
    "layout_user_experience",
    visualizationId,
  );
  const bottomPadding =
    userExperiencePanel.position.y +
    userExperiencePanel.position.h -
    item.position.y -
    item.position.h;
  assert.ok(
    bottomPadding >= 25,
    `layout_user_experience:${visualizationId} must stay inside its panel`,
  );
}

const legacyMacroTuningView = fs.readFileSync(
  path.join(VIEWS_ROOT, "admin_macro_index_tuning.xml"),
  "utf8",
);
assert.match(
  legacyMacroTuningView,
  /<dashboard\b[^>]*\bisVisible="false"/,
  "The legacy Macro Index Tuning redirect must stay out of the Dashboards inventory",
);
const legacyMacroTuningBootstrap = fs.readFileSync(
  path.join(STATIC_ROOT, "macro_index_tuning_bootstrap.js"),
  "utf8",
);
assert.match(
  legacyMacroTuningBootstrap,
  /setup.*setup=1#tune-indexes/s,
  "Old Macro Index Tuning URLs must continue to redirect into Setup",
);

const appNavigation = fs.readFileSync(
  path.join(
    APP_ROOT,
    "src/main/resources/splunk/default/data/ui/nav/default.xml",
  ),
  "utf8",
);
assert.match(
  appNavigation,
  /dashboard_manager#\/secops_resilience">Security Resilience<\/a>/,
  "The Security Operations menu should use the specific Security Resilience label",
);

const securityResilience = readStudioDefinition("secops_resilience.xml");
for (const visualizationId of ["viz_fw_blocked", "viz_fw_allowed"]) {
  assert.equal(
    securityResilience.visualizations[visualizationId].options.sparklineDisplay,
    "off",
    `${visualizationId} must defer trend detail to the dedicated firewall chart`,
  );
  assert.equal(
    securityResilience.visualizations[visualizationId].options.showTrendIndicator,
    false,
    `${visualizationId} must remain a compact headline KPI`,
  );
}

const buildingIntelligence = readStudioDefinition(
  "workplace_building_intelligence.xml",
);
assert.match(
  buildingIntelligence.dataSources.ds_device_by_building.options.query,
  /rename "AP Count" as AP_Count[\s\S]*max\(AP_Count\) as "Access Points"/,
  "The building chart must graph the populated access-point inventory",
);

const spacesIntelligence = readStudioDefinition(
  "workplace_spaces_intelligence.xml",
);
assert.match(
  spacesIntelligence.visualizations.viz_visitor_map.options.baseLayerTileServer,
  /dark_all/,
  "The visitor map must use the approved dark map treatment",
);
assert.ok(
  spacesIntelligence.visualizations.viz_visitor_map.options.zoom <= 3,
  "The visitor map must open at a whole-US zoom",
);
assert.doesNotMatch(
  spacesIntelligence.dataSources.ds_visitor_map.options.query,
  /1=1, 0\.0/,
  "The visitor map must not send unknown campuses to placeholder coordinates",
);
assert.match(
  spacesIntelligence.dataSources.ds_dwell_distribution.options.query,
  /deviceAssociation\.device\.macAddress[\s\S]*sort 0 mac _time[\s\S]*No completed sessions in selected range/,
  "Dwell time must pair ordered association events and provide a friendly empty state",
);

const workplaceOperations = readStudioDefinition(
  "workplace_operations_overview.xml",
);
assert.equal(
  workplaceOperations.visualizations.viz_t3_value.dataSources.primary,
  "ds_t3_network_power_kpi",
  "The energy tile must use measured SD-WAN power telemetry",
);
assert.match(
  workplaceOperations.dataSources.ds_t3_network_power_kpi.options.query,
  /cisco:sdwan:energy:stats[\s\S]*unit_type="Watts"[\s\S]*"Network Power"/,
  "The network-energy query must preserve measured watt units",
);
assert.match(
  workplaceOperations.dataSources.ds_t4_security_kpi.options.query,
  /fillnull value=0 "Active Risks"/,
  "The security posture tile must not select an empty final time bucket",
);

console.log("Studio dashboard visual and appserver asset contracts passed");
