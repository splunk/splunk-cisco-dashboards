"use strict";

const assert = require("assert").strict;
const fs = require("fs");
const path = require("path");

const packageRoot = path.resolve(__dirname, "..");
const editor = fs.readFileSync(
  path.join(
    packageRoot,
    "src/main/webapp/pages/dashboardbuilder/DashboardStudioEditor.jsx",
  ),
  "utf8",
);
const viewDirectory = path.join(
  packageRoot,
  "src/main/resources/splunk/default/data/ui/views",
);
const managerScope = fs.readFileSync(
  path.join(
    packageRoot,
    "src/main/webapp/common/config/managedStudioViews.js",
  ),
  "utf8",
);
const homePage = fs.readFileSync(
  path.join(
    packageRoot,
    "src/main/webapp/pages/dashboardbuilder/DBHomePage.jsx",
  ),
  "utf8",
);
const customTooltip = fs.readFileSync(
  path.join(
    packageRoot,
    "src/main/webapp/common/components/CustomTooltip/CustomTooltip.jsx",
  ),
  "utf8",
);
const commonStyles = fs.readFileSync(
  path.join(packageRoot, "src/main/webapp/common/styles/commonstyles.css"),
  "utf8",
);
const dashboardDrilldown = fs.readFileSync(
  path.join(
    packageRoot,
    "src/main/webapp/common/lib/dashboardDrilldown.js",
  ),
  "utf8",
);
const drilldownActionViz = fs.readFileSync(
  path.join(
    packageRoot,
    "src/main/webapp/pages/dashboardbuilder/DrilldownActionViz.jsx",
  ),
  "utf8",
);
const drilldownModal = fs.readFileSync(
  path.join(
    packageRoot,
    "src/main/webapp/pages/dashboardbuilder/DashboardStudioDrilldownModal.jsx",
  ),
  "utf8",
);
const simpleTimePicker = fs.readFileSync(
  path.join(
    packageRoot,
    "src/main/webapp/pages/dashboardbuilder/custominput/SimpleTimePicker.jsx",
  ),
  "utf8",
);
const timeRangeUtils = fs.readFileSync(
  path.join(
    packageRoot,
    "src/main/webapp/pages/dashboardbuilder/custominput/timeRangeUtils.jsx",
  ),
  "utf8",
);
const searchBaseDataSource = fs.readFileSync(
  path.join(
    packageRoot,
    "src/main/webapp/pages/dashboardbuilder/SearchBaseDataSource.jsx",
  ),
  "utf8",
);
const searchbaseConf = fs.readFileSync(
  path.join(packageRoot, "src/main/resources/splunk/default/searchbase.conf"),
  "utf8",
);
const extractSetValues = (exportName) => {
  const match = managerScope.match(
    new RegExp(`export const ${exportName} = new Set\\(\\[([\\s\\S]*?)\\]\\);`),
  );
  assert.ok(match, `Expected ${exportName} to be declared as a Set`);
  return Array.from(match[1].matchAll(/"([^"]+)"/g), ([, value]) => value).sort();
};

const readDefinition = (viewName) => {
  const xml = fs.readFileSync(path.join(viewDirectory, `${viewName}.xml`), "utf8");
  const definition = xml.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  assert.ok(definition, `${viewName} must contain a Dashboard Studio definition`);
  return JSON.parse(definition[1]);
};

assert.match(
  editor,
  /const requestedRouteMode = currentmode === "edit" \? "edit" : "view";/,
  "Dashboard Manager routes must normalize unsupported or missing modes to view",
);
assert.match(
  editor,
  /readOnly \? "view" : openID \? "edit" : requestedRouteMode/,
  "Cold /edit loads must initialize Dashboard Studio in edit mode",
);
assert.match(
  editor,
  /setDashMode\(requestedRouteMode\);[\s\S]*?apiRef\.getMode\(\) !== requestedRouteMode[\s\S]*?apiRef\.switchMode\(requestedRouteMode\);/,
  "Same-tab route changes must synchronize the mounted Dashboard Studio mode",
);
assert.match(
  editor,
  /\[apiRef, openID, readOnly, requestedRouteMode\]/,
  "Route synchronization must rerun when either the dashboard API or route mode changes",
);
assert.match(
  editor,
  /VIEWPORT_FIT_DASHBOARD_IDS = DASHBOARD_MANAGER_FRAMEWORK_VIEW_NAMES/,
  "Every included Dashboard Manager view must use the approved viewport fit",
);
assert.match(
  editor,
  /new ResizeObserver\(scheduleViewportFit\)/,
  "Viewport fitting must react to Dashboard Studio container resizing",
);
assert.match(
  editor,
  /querySelector\(\s*'\[data-test="LayoutContainer"\]'\s*,?\s*\)/,
  "Viewport fitting must measure the usable Studio container directly",
);
assert.match(
  editor,
  /querySelector\(\s*'\[data-test="absolute-layout"\]'\s*,?\s*\)/,
  "Viewport fitting must observe and correct Dashboard Studio auto-scaling",
);
assert.match(
  editor,
  /Math\.abs\(renderedScale - scale\) < 0\.001/,
  "Viewport fitting must reapply when Studio replaces the requested scale",
);
assert.match(
  editor,
  /window\.addEventListener\("resize", scheduleViewportFit\)/,
  "Viewport fitting must react when the browser moves or resizes",
);
assert.doesNotMatch(
  editor,
  /Math\.min\(\s*1,\s*viewportWidth \/ canvasWidth/,
  "Viewport fitting must be able to scale up on a larger display",
);

const extensionTypePattern =
  /ds\.searchbase|input\.simpleTimePicker|splunk\.template_kpi|splunk\.template_other|splunk\.cisco_spaces_space_manager|splunk\.cisco_drilldown_action/;
const extensionBackedViews = fs
  .readdirSync(viewDirectory)
  .filter((fileName) => fileName.endsWith(".xml"))
  .filter((fileName) =>
    extensionTypePattern.test(
      fs.readFileSync(path.join(viewDirectory, fileName), "utf8"),
    ),
  )
  .map((fileName) => path.basename(fileName, ".xml"))
  .sort();
const frameworkViews = extractSetValues(
  "DASHBOARD_MANAGER_FRAMEWORK_VIEW_NAMES",
);
const routedStudioViews = extractSetValues("MANAGER_ROUTED_STUDIO_VIEW_NAMES");

assert.deepEqual(
  frameworkViews,
  extensionBackedViews,
  "Dashboard Manager Included views must match the extension-backed XML dashboards",
);
assert.ok(
  !frameworkViews.includes("admin_asset_inventory"),
  "Asset Inventory is a native Studio dashboard, not a Dashboard Manager framework dashboard",
);
assert.deepEqual(
  frameworkViews.filter((viewName) => routedStudioViews.includes(viewName)),
  [],
  "Framework membership and presentation-only Manager routing must stay separate",
);

assert.match(
  homePage,
  /Dashboards in 60 Seconds combines Searchbase and Dashboard Studio/,
  "The main Dashboard Manager UI must use the customer-facing promise",
);
assert.match(
  homePage,
  /without writing SPL or code/,
  "The main UI must explain the no-code dashboard-building value",
);
assert.match(
  homePage,
  /guided drilldown wiring that is not available in Dashboard Studio alone/,
  "The main UI must explain the drilldown differentiation",
);
assert.match(
  homePage,
  /What it is:[\s\S]*?custom preset and editor integration to Dashboard[\s\S]*?Studio/,
  "The technical help must name how Dashboard Manager extends Studio",
);
assert.match(
  homePage,
  /What it adds:[\s\S]*?wires dashboard content to drilldown views/,
  "The technical help must explain the drilldown capability",
);
assert.match(
  homePage,
  /keeps shared SPL synchronized/,
  "The main UI must explain why the Studio extension is required",
);
assert.match(
  homePage,
  /<strong>Included<\/strong>[\s\S]*?<strong>Yours<\/strong>[\s\S]*?create or copy/,
  "Help must state the exact Included and Yours library scopes",
);
assert.match(
  homePage,
  /Ordinary Studio dashboards are[\s\S]*?intentionally not listed/,
  "Help must explain that ordinary Studio dashboards are outside this library",
);
assert.doesNotMatch(
  homePage,
  /eyeball icon|KPIs shipped with Splunk|Searchbase on Splunkbase/,
  "Help must not reintroduce the retired or inaccurate instructions",
);
assert.match(
  homePage,
  /aria-label="Dashboard Manager help"/,
  "The help trigger must have an accessible name",
);
assert.match(
  homePage,
  /<section[\s\S]*?aria-labelledby="dashboard-manager-library-title"[\s\S]*?<button[\s\S]*?aria-label="Dashboard Manager help"/,
  "The help button must sit in a semantic library section instead of inside a collapsible toggle",
);
assert.doesNotMatch(
  homePage,
  /<CollapsiblePanel[\s\S]*?Dashboard Manager help/,
  "The help control must never be nested inside another button",
);

assert.match(
  customTooltip,
  /useSplunkTheme/,
  "Portal tooltips must derive semantic colors from the active Splunk theme",
);
assert.match(
  customTooltip,
  /--custom-tooltip-background-popup/,
  "Portal tooltips must carry their theme variables across the document portal",
);
assert.match(
  customTooltip,
  /onFocusCapture=\{\(\) => \{[\s\S]*?isFocusWithin\.current = true[\s\S]*?onBlurCapture=\{\(\) => \{[\s\S]*?isFocusWithin\.current = false/,
  "Tooltip content must be available from keyboard focus",
);
assert.match(
  customTooltip,
  /role=\{persistent \? 'dialog' : 'tooltip'\}/,
  "Persistent help must use dialog semantics instead of nesting controls in a tooltip",
);
assert.match(
  commonStyles,
  /#custom_tool_tip \.body \{[\s\S]*?background: var\(--custom-tooltip-background-popup/,
  "The help body must use the active popup surface token",
);
assert.match(
  commonStyles,
  /#custom_tool_tip \.body p,[\s\S]*?color: var\(--custom-tooltip-content-default/,
  "Help copy must use an explicit semantic foreground token",
);

assert.equal(frameworkViews.length, 17, "The rollout must cover 17 included dashboards");
assert.match(
  timeRangeUtils,
  /DEFAULT_SPAN = 'auto'/,
  "Simple time ranges must represent no explicit span as Auto",
);
assert.match(
  simpleTimePicker,
  /Auto lets timechart choose/,
  "Advanced time-range help must explain automatic bucket selection",
);
assert.match(
  simpleTimePicker,
  /\{showAdvanced && \(\s*<Button\s*aria-label="Advanced time range"/,
  "The advanced time-range icon button must retain an accessible name",
);
assert.match(
  searchBaseDataSource,
  /applySpanOverride[\s\S]*?timechart[\s\S]*?tstats/,
  "Explicit span overrides must be applied to Searchbase trend transforms",
);
const authOutcomeStanza = searchbaseConf.match(
  /\[secure_networking_zta_auth_outcome_trend\]([\s\S]*?)\n\[/,
)?.[1];
assert.ok(authOutcomeStanza, "Authentication Outcomes Searchbase stanza must exist");
assert.doesNotMatch(
  authOutcomeStanza,
  /by _time span=1h, Authentication\.action/,
  "Authentication Outcomes must not force a one-hour pre-aggregation span",
);
const expectedColors = [
  "#e44273",
  "#9b5ff4",
  "#e2a811",
  "#3abdfa",
  "#159352",
  "#0d8e97",
];
const baseSeriesColors = [
  "#9b5ff4",
  "#3abdfa",
  "#0d8e97",
  "#e2a811",
  "#e44273",
  "#a9afda",
  "#d8580f",
  "#f88ddc",
  "#159352",
  "#9abe2d",
  "#6574f3",
  "#ff9297",
  "#d14baf",
  "#24c4c9",
  "#bb6e04",
  "#6ec641",
  "#777daf",
  "#ff9755",
  "#698c07",
  "#c69fff",
];
const infoXPositions = [534, 1167, 1800, 534, 1167, 1800];
const normalizeCardTitle = (markdown) =>
  markdown
    .replace(/^\*\*/, "")
    .replace(/\*\*$/, "")
    .replace(/\\([\-_.])/g, "$1");

let rolloutCardCount = 0;
let rolloutInfoActionCount = 0;
let rolloutInvestigationActionCount = 0;
frameworkViews.forEach((viewName) => {
  const definition = readDefinition(viewName);
  const overview = definition.layout.layoutDefinitions.layout_overview;
  assert.equal(overview.options.width, 1920, `${viewName} must use pilot width`);
  assert.equal(overview.options.height, 1024, `${viewName} must use pilot height`);
  assert.equal(overview.structure.length, 52, `${viewName} must have 52 layout items`);
  assert.equal(
    Object.keys(definition.visualizations).length,
    51,
    `${viewName} must have 51 visualizations`,
  );
  assert.equal(
    Object.keys(definition.dataSources).length,
    6,
    `${viewName} must retain six primary data sources`,
  );
  assert.equal(
    definition.inputs.input_time_range.options.defaultValue,
    "-24h,now,auto",
    `${viewName} must default its timechart span to Auto`,
  );
  assert.ok(
    definition.inputs.input_time_range.options.selections.every(({ value }) =>
      value.endsWith(",auto"),
    ),
    `${viewName} quick ranges must leave timechart bucket selection on Auto`,
  );
  Object.values(definition.dataSources).forEach((dataSource) => {
    assert.equal(
      dataSource.options.queryParameters.span,
      "$time_tok.span$",
      `${viewName} must pass the optional span token to every Searchbase source`,
    );
  });

  expectedColors.forEach((color, index) => {
    const cardId = String(index + 1).padStart(2, "0");
    const trendId = `viz_card_${cardId}_trend`;
    const titleId = `viz_card_${cardId}_title`;
    const infoId = `viz_card_${cardId}_info_trigger`;
    const investigationId = `viz_card_${cardId}_drilldown_trigger`;
    const options = definition.visualizations[trendId]?.options;
    const origin = normalizeCardTitle(
      definition.visualizations[titleId]?.options?.markdown || "",
    );
    const target = definition.dataSources[`ds_story_${cardId}`]?.options?.ref;
    const infoTrigger = definition.visualizations[infoId];
    const investigationTrigger = definition.visualizations[investigationId];
    const infoLayout = overview.structure.find(({ item }) => item === infoId);
    const titleLayout = overview.structure.find(({ item }) => item === titleId);

    assert.ok(options, `${viewName} ${trendId} must exist`);
    const expectedSeriesColors =
      index === 5
        ? [color, ...baseSeriesColors.filter((candidate) => candidate !== color)]
        : [...baseSeriesColors];
    if (index !== 5) {
      const primaryColorIndex = expectedSeriesColors.indexOf(color);
      expectedSeriesColors[primaryColorIndex] = expectedSeriesColors[0];
      expectedSeriesColors[0] = color;
    }
    assert.deepEqual(
      options.seriesColors,
      expectedSeriesColors,
      `${viewName} ${trendId} must use the approved ordered palette`,
    );
    assert.equal(options.areaOpacity, 0.45);
    assert.equal(options.lineWidth, 2);
    assert.equal(options.showYMajorGridLines, false);
    assert.equal(options.showYMinorGridLines, false);
    assert.equal(options.yAxisLabelVisibility, "hide");
    assert.equal(options.yAxisLineVisibility, "hide");
    assert.equal(options.yAxisMajorTickVisibility, "hide");
    assert.equal(options.yAxisMinorTickVisibility, "hide");
    assert.equal(options.yAxisTitleVisibility, "hide");
    assert.equal(
      infoTrigger?.eventHandlers?.[0]?.options?.url,
      `/metric-info?origin=${encodeURIComponent(origin)}&target=${target}`,
      `${viewName} ${infoId} must identify its visible metric and primary Searchbase stanza`,
    );
    assert.equal(infoLayout?.position?.x, infoXPositions[index]);
    assert.equal(infoLayout?.position?.y, index < 3 ? 118 : 574);
    assert.equal(infoLayout?.position?.w, 42);
    assert.equal(infoLayout?.position?.h, 42);
    assert.equal(titleLayout?.position?.w, 482);
    assert.equal(
      new URL(
        investigationTrigger?.eventHandlers?.[0]?.options?.url,
        "http://dashboard.test",
      ).searchParams.get("origin"),
      origin,
      `${viewName} ${investigationId} must retain the visible card title`,
    );
    assert.ok(
      overview.structure.findIndex(({ item }) => item === infoId) <
        overview.structure.findIndex(({ item }) => item === investigationId),
      `${viewName} ${infoId} must precede Magnify+ in visual and keyboard order`,
    );
    rolloutCardCount += 1;
    rolloutInfoActionCount += 1;
    rolloutInvestigationActionCount += 1;
  });
});
assert.equal(rolloutCardCount, 102);
assert.equal(rolloutInfoActionCount, 102);
assert.equal(rolloutInvestigationActionCount, 102);
assert.match(
  dashboardDrilldown,
  /parseDashboardMetricInfoUrl[\s\S]*?METRIC_INFO_PATH/,
  "Dashboard actions must recognize metric-info URLs separately from drilldowns",
);
assert.match(
  dashboardDrilldown,
  /DASHBOARD_DRILLDOWN_ACCESSIBLE_TITLE = 'Investigate drivers'/,
  "Magnify+ must describe its causal investigation purpose",
);
assert.match(
  drilldownActionViz,
  /DASHBOARD_ACTION_KIND_METRIC_INFO[\s\S]*?<InformationCircle/,
  "Metric-info actions must render the native information icon",
);
assert.match(
  drilldownModal,
  /isMetricInfo[\s\S]*?openInSearchbaseHref/,
  "Metric information must retain a direct Searchbase action",
);
assert.match(
  drilldownModal,
  /heading=\{isMetricInfo \? 'About this metric'/,
  "Metric information must distinguish primary-metric guidance from drilldown guidance",
);
assert.match(
  drilldownModal,
  /`Investigate \$\{origin \|\| 'dashboard activity'\}`/,
  "Investigation modal titles must describe the action instead of exposing drilldown jargon",
);
assert.doesNotMatch(
  drilldownModal,
  /`Drill down:/,
  "Investigation modal titles must not use ambiguous drilldown jargon",
);
assert.match(
  commonStyles,
  /\.dashboard-builder-drilldown-modal \.sui-guidance-content p,[\s\S]*?color: var\(--sui-content-default\) !important/,
  "Searchbase HTML paragraphs must retain readable foreground contrast in the modal",
);

console.log(
  "Dashboard Studio route, Manager scope, help, and 17-dashboard rollout checks passed.",
);
