"use strict";

const assert = require("assert").strict;
const fs = require("fs");
const path = require("path");

const helperPath = path.resolve(
  __dirname,
  "../src/main/webapp/common/lib/dashboardDrilldown.js",
);
const helperSource = fs
  .readFileSync(helperPath, "utf8")
  .replaceAll("export const ", "const ");
const helperModule = { exports: {} };

new Function(
  "module",
  `${helperSource}\nmodule.exports = {
    DEFAULT_DASHBOARD_DRILLDOWN_TIME_RANGE,
    DASHBOARD_DRILLDOWN_PANEL_ICON_SVG,
    DASHBOARD_DRILLDOWN_PANEL_ICON_DATA_URL,
    parseDashboardDrilldownUrl,
    buildDashboardDrilldownUrl,
    createDashboardDrilldownIconVisualization,
    normalizeDashboardDrilldownIcons,
    resolveDashboardDrilldownSearches,
    getDashboardDrilldownMetadata,
    parseDashboardDrilldownTimeRange,
    getDashboardDrilldownInitialTimeRange,
    buildDashboardDrilldownDefinition,
  };`,
)(helperModule);

const {
  DASHBOARD_DRILLDOWN_PANEL_ICON_SVG,
  DASHBOARD_DRILLDOWN_PANEL_ICON_DATA_URL,
  parseDashboardDrilldownUrl,
  buildDashboardDrilldownUrl,
  createDashboardDrilldownIconVisualization,
  normalizeDashboardDrilldownIcons,
  resolveDashboardDrilldownSearches,
  getDashboardDrilldownMetadata,
  parseDashboardDrilldownTimeRange,
  getDashboardDrilldownInitialTimeRange,
  buildDashboardDrilldownDefinition,
} = helperModule.exports;

assert.deepEqual(
  parseDashboardDrilldownUrl(
    "/drilldown?origin=Total # of Apps&target=App Details,Top Apps by Resource Usage,App Details",
  ),
  {
    origin: "Total # of Apps",
    targetIds: ["App Details", "Top Apps by Resource Usage"],
  },
  "internal Studio drilldown URLs must parse and deduplicate targets",
);
assert.equal(parseDashboardDrilldownUrl("https://example.com/drilldown?target=x"), null);
assert.equal(parseDashboardDrilldownUrl("/drilldown?origin=missing-target"), null);

const tooManyTargets = Array.from({ length: 30 }, (_, index) => `target-${index}`);
assert.equal(
  parseDashboardDrilldownUrl(buildDashboardDrilldownUrl({ targetIds: tooManyTargets }))
    .targetIds.length,
  24,
  "target resolution must stay bounded",
);

const sourceDefinition = {
  visualizations: {
    viz_click: {
      type: "splunk.rectangle",
      options: { fillColor: "transparent", strokeColor: "transparent" },
      eventHandlers: [
        {
          type: "drilldown.customUrl",
          options: { url: "/drilldown?origin=Origin&target=target-a" },
        },
      ],
      context: { preserved: true },
    },
    viz_external: {
      type: "splunk.rectangle",
      eventHandlers: [
        {
          type: "drilldown.customUrl",
          options: { url: "https://example.com/details" },
        },
      ],
    },
  },
};
const normalizedDefinition = normalizeDashboardDrilldownIcons(sourceDefinition);
assert.notEqual(normalizedDefinition, sourceDefinition);
assert.equal(normalizedDefinition.visualizations.viz_click.type, "splunk.image");
assert.match(normalizedDefinition.visualizations.viz_click.options.src, /^data:image\/svg\+xml/);
assert.equal(normalizedDefinition.visualizations.viz_click.options.preserveAspectRatio, true);
assert.equal(normalizedDefinition.visualizations.viz_click.options.fillColor, undefined);
assert.deepEqual(normalizedDefinition.visualizations.viz_click.context, { preserved: true });
assert.equal(normalizedDefinition.visualizations.viz_external, sourceDefinition.visualizations.viz_external);
assert.match(DASHBOARD_DRILLDOWN_PANEL_ICON_SVG, /M19\.5 4C20\.3284/);
assert.match(decodeURIComponent(DASHBOARD_DRILLDOWN_PANEL_ICON_DATA_URL), /PanelRightOpen/);

const generatedIcon = createDashboardDrilldownIconVisualization({
  origin: "Origin",
  targetIds: ["target-a"],
});
assert.equal(generatedIcon.type, "splunk.image");
assert.match(generatedIcon.eventHandlers[0].options.url, /^\/drilldown\?/);

const entries = [
  {
    name: "target-a",
    acl: { app: "splunk-cisco-dashboards" },
    content: {
      search_name: "App Details",
      default_viz: "splunk.table",
      viz_options: '{"count":25}',
      description: "<p>Device detail.</p>",
      explanation: "<p>How it works.</p>",
      solution: "<p>Suggested actions.</p>",
      related_info: "<p>Related links.</p>",
      execution_plan: "<p>Runbook.</p>",
    },
  },
  {
    name: "target-b",
    content: { search_name: "Top Apps", default_viz: "splunk.bar" },
  },
];
const resolved = resolveDashboardDrilldownSearches(entries, [
  "Top Apps",
  "App Details",
  "not-installed",
]);
assert.deepEqual(
  resolved.resolvedSearches.map((entry) => entry.name),
  ["target-b", "target-a"],
  "display names and stanza IDs must resolve in requested order",
);
assert.deepEqual(resolved.missingTargetIds, ["not-installed"]);
assert.deepEqual(getDashboardDrilldownMetadata(entries[0]), {
  title: "App Details",
  description: "<p>Device detail.</p>",
  explanation: "<p>How it works.</p>",
  solution: "<p>Suggested actions.</p>",
  relatedInfo: "<p>Related links.</p>",
  executionPlan: "<p>Runbook.</p>",
});

assert.deepEqual(parseDashboardDrilldownTimeRange("-14d@d,now,1w"), {
  earliest: "-14d@d",
  latest: "now",
});
assert.deepEqual(
  getDashboardDrilldownInitialTimeRange({
    inputs: {
      time: {
        type: "input.timerange",
        options: { defaultValue: "-7d@d,now" },
      },
    },
    layout: { globalInputs: ["time"] },
  }),
  { earliest: "-7d@d", latest: "now" },
);

const drilldownDefinition = buildDashboardDrilldownDefinition(entries[0], {
  earliest: "-14d@d",
  latest: "now",
});
assert.deepEqual(Object.keys(drilldownDefinition.dataSources), ["ds_drilldown_target"]);
assert.equal(drilldownDefinition.dataSources.ds_drilldown_target.type, "ds.searchbase");
assert.equal(drilldownDefinition.dataSources.ds_drilldown_target.options.ref, "target-a");
assert.deepEqual(
  drilldownDefinition.dataSources.ds_drilldown_target.options.queryParameters,
  { earliest: "-14d@d", latest: "now" },
);
assert.equal(drilldownDefinition.visualizations.viz_drilldown_result.options.count, 25);

console.log("✓ Dashboard Manager Studio drilldown regression tests passed");
