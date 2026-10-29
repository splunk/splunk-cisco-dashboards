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
const insightKpiButton = fs.readFileSync(
  path.join(
    packageRoot,
    "src/main/webapp/pages/dashboardbuilder/InsightKpiButton.jsx",
  ),
  "utf8",
);
const addSearchPicker = fs.readFileSync(
  path.join(
    packageRoot,
    "src/main/webapp/pages/dashboardbuilder/DropdownWithSearch.jsx",
  ),
  "utf8",
);
const searchbaseConf = fs.readFileSync(
  path.join(packageRoot, "src/main/resources/splunk/default/searchbase.conf"),
  "utf8",
);
const navigation = fs.readFileSync(
  path.join(packageRoot, "src/main/resources/splunk/default/data/ui/nav/default.xml"),
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

for (const viewName of [
  "admin_asset_inventory",
  "netops_catalyst_health",
  "netops_catalyst_operations",
  "netops_critical_systems_health",
  "netops_readiness",
  "secops_resilience",
  "workplace_building_intelligence",
  "workplace_operations_overview",
  "workplace_spaces_intelligence",
]) {
  assert.match(
    navigation,
    new RegExp(`href="dashboard_manager#/${viewName}"`),
    `${viewName} must open through Dashboard Manager to preserve the styled app shell`,
  );
}

assert.match(
  editor,
  /const requestedRouteMode = currentmode === "edit" \? "edit" : "view";/,
  "Dashboard Manager routes must normalize unsupported or missing modes to view",
);
assert.match(
  editor,
  /editedDefinition\?\.applicationProperties\?\.hideEdit \?\? false[\s\S]*?!hideDashboardEdit && <ModeSwitch/,
  "View-mode Dashboard Manager toolbars must show native Edit unless a dashboard explicitly hides it",
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
  /VIEWPORT_FIT_DASHBOARD_IDS = new Set\([\s\S]*?DASHBOARD_MANAGER_FRAMEWORK_VIEW_NAMES[\s\S]*?!WIDTH_FIT_DASHBOARD_IDS.has\(viewName\)/,
  "Included metric dashboards must use viewport fit while readable tables use width fit",
);
assert.match(
  editor,
  /WIDTH_FIT_DASHBOARD_IDS = new Set\(\[[\s\S]*?MANAGER_ROUTED_STUDIO_VIEW_NAMES/,
  "Native Studio views routed through Dashboard Manager must use width fitting",
);
assert.match(
  editor,
  /calculateWidthFitScale[\s\S]*?viewportWidth \/ canvasWidth/,
  "Manager-routed native Studio views must derive scale from available width",
);
assert.match(
  editor,
  /canvasHeight \* scale \+ MANAGED_STUDIO_CHROME_HEIGHT/,
  "Manager-routed native Studio views must grow their host to the scaled canvas height",
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

for (const viewName of routedStudioViews) {
  const definition = readDefinition(viewName);
  const layoutDefinitions = definition.layout?.layoutDefinitions || {
    default: definition.layout,
  };

  for (const [layoutId, layout] of Object.entries(layoutDefinitions)) {
    const canvasWidth = Number(layout.options?.width);
    const canvasHeight = Number(layout.options?.height);
    assert.ok(
      Number.isFinite(canvasWidth) && Number.isFinite(canvasHeight),
      `${viewName}:${layoutId} must declare finite canvas dimensions`,
    );

    const rectanglePositions = new Set();
    for (const item of layout.structure || []) {
      const visualization = definition.visualizations?.[item.item];
      assert.ok(
        visualization || definition.inputs?.[item.item],
        `${viewName}:${layoutId}:${item.item} must reference a defined item`,
      );
      assert.ok(
        item.position.x >= 0 &&
          item.position.y >= 0 &&
          item.position.x + item.position.w <= canvasWidth &&
          item.position.y + item.position.h <= canvasHeight,
        `${viewName}:${layoutId}:${item.item} must fit inside its canvas`,
      );

      if (visualization?.type === "splunk.rectangle") {
        const positionKey = [
          item.position.x,
          item.position.y,
          item.position.w,
          item.position.h,
        ].join(":");
        assert.ok(
          !rectanglePositions.has(positionKey),
          `${viewName}:${layoutId} must not stack duplicate background rectangles`,
        );
        rectanglePositions.add(positionKey);
      }
    }
  }
}

const workplaceOperationsDefinition = readDefinition(
  "workplace_operations_overview",
);
assert.ok(
  !workplaceOperationsDefinition.visualizations.viz_bmxsRvR0,
  "Workplace Operations must not retain the duplicate third KPI background",
);
const workplaceOperationsItems =
  workplaceOperationsDefinition.layout.layoutDefinitions.layout_1.structure;
const workplaceThirdKpiBox = workplaceOperationsItems.find(
  ({ item }) => item === "viz_t3_box",
);
const workplaceThirdKpiValue = workplaceOperationsItems.find(
  ({ item }) => item === "viz_t3_value",
);
assert.ok(workplaceThirdKpiBox && workplaceThirdKpiValue);
assert.ok(
  workplaceThirdKpiBox.position.y + workplaceThirdKpiBox.position.h >=
    workplaceThirdKpiValue.position.y + workplaceThirdKpiValue.position.h,
  "Workplace Operations third KPI value must fit inside its background card",
);

const securityResilienceDefinition = readDefinition("secops_resilience");
const securityResilienceDetails =
  securityResilienceDefinition.layout.layoutDefinitions.layout_details.structure;
const securityResilienceDetailsNarrative = securityResilienceDetails.find(
  ({ item }) => item === "viz_narr_details",
);
const securityResilienceDetailsSection = securityResilienceDetails.find(
  ({ item }) => item === "viz_sec_section2",
);
assert.ok(
  securityResilienceDetailsNarrative && securityResilienceDetailsSection,
  "Security Resilience Details must retain its narrative and section frame",
);
assert.equal(
  securityResilienceDetailsNarrative.position.x,
  securityResilienceDetailsSection.position.x + 20,
  "Security Resilience Details narrative must align with the section content inset",
);
assert.equal(
  securityResilienceDetailsNarrative.position.x +
    securityResilienceDetailsNarrative.position.w,
  securityResilienceDetailsSection.position.x +
    securityResilienceDetailsSection.position.w -
    20,
  "Security Resilience Details narrative must span the section without wrapping into a scrollbar",
);

const netopsReadinessDefinition = readDefinition("netops_readiness");
const netopsReadinessTabA =
  netopsReadinessDefinition.layout.layoutDefinitions.layout_tab_a.structure;
const netopsReadinessTabC =
  netopsReadinessDefinition.layout.layoutDefinitions.layout_tab_c.structure;
const assertItemInset = (items, itemId, boxId) => {
  const item = items.find(({ item: id }) => id === itemId);
  const box = items.find(({ item: id }) => id === boxId);
  assert.ok(item && box);
  assert.ok(
    item.position.x + item.position.w <= box.position.x + box.position.w - 5 &&
      item.position.y + item.position.h <= box.position.y + box.position.h - 5,
    `${itemId} must remain visibly inset from ${boxId}`,
  );
};
assertItemInset(netopsReadinessTabA, "viz_nrs_drisk", "viz_box_a_headline");
assertItemInset(netopsReadinessTabA, "viz_arq_legend", "viz_box_a_headline");
assertItemInset(netopsReadinessTabC, "viz_q5_saturation", "viz_box_c_q5");
assertItemInset(
  netopsReadinessTabC,
  "viz_q6_occupancy_overlay",
  "viz_box_c_q6",
);

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
  /<strong>Included<\/strong>[\s\S]*?<strong>Yours<\/strong>[\s\S]*?owned by you[\s\S]*?<strong> Shared<\/strong>[\s\S]*?other users/,
  "Help must explain Included, Yours, and Shared library scopes",
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

assert.equal(frameworkViews.length, 19, "The library must cover 19 included dashboards");
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
assert.match(
  authOutcomeStanza,
  /`index_identity` sourcetype="cisco:ise:syslog" \(log_type="Passed_Authentications" OR log_type="Failed_Attempts"\)/,
  "Authentication Outcomes must use the same raw ISE population as Authentication Friction",
);
assert.doesNotMatch(
  authOutcomeStanza,
  /DATAMODEL=Authentication/,
  "Authentication Outcomes must not report a false zero when the optional CIM data model is unavailable",
);
assert.match(
  authOutcomeStanza,
  /count\(eval\(outcome="Success"\)\) as Success count\(eval\(outcome="Failure"\)\) as Failure/,
  "Authentication Outcomes must expose explicit successful and failed series",
);
assert.match(
  authOutcomeStanza,
  /case\(log_type="Failed_Attempts","Failure",log_type="Passed_Authentications","Success"/,
  "Authentication Outcomes must classify the authoritative ISE log type before action fallbacks",
);
const authFrictionStanza = searchbaseConf.match(
  /\[secure_networking_zta_ise_auth_failure_rate_trend\]([\s\S]*?)\n\[/,
)?.[1];
assert.ok(authFrictionStanza, "Authentication Friction Searchbase stanza must exist");
assert.match(
  authFrictionStanza,
  /count as "Bucket Authentications" sum\(is_failed\) as "Bucket Failures"/,
  "Authentication Friction must retain the per-bucket denominator and failure count",
);
assert.match(
  authFrictionStanza,
  /eval is_failed=if\(log_type="Failed_Attempts",1,0\)/,
  "Authentication Friction must use the same mutually exclusive ISE outcome definition",
);
assert.match(
  authFrictionStanza,
  /eventstats sum\("Bucket Authentications"\) as WindowAuths sum\("Bucket Failures"\) as WindowFailures/,
  "Authentication Friction must aggregate quoted display-field names into the window rate",
);
const riskyMfaStanza = searchbaseConf.match(
  /\[secure_networking_zta_risky_mfa_outcomes_by_application_factor\]([\s\S]*?)\n\[/,
)?.[1];
assert.ok(riskyMfaStanza, "Risky MFA Outcomes Searchbase stanza must exist");
assert.match(
  riskyMfaStanza,
  /eval RiskyOutcomes=Denied\+Fraud/,
  "Risky MFA Outcomes must mean denied plus fraud events",
);
assert.ok(
  riskyMfaStanza.indexOf(
    "eventstats sum(RiskyOutcomes) as _WindowRiskyOutcomes",
  ) < riskyMfaStanza.indexOf("sort 10 - RiskyOutcomes"),
  "The full-window Risky MFA total must be calculated before the evidence is truncated",
);
assert.doesNotMatch(
  riskyMfaStanza,
  /\| head 10/,
  "Risky MFA evidence must use one bounded sort instead of a redundant head",
);
assert.match(
  riskyMfaStanza,
  /where RiskyOutcomes>0/,
  "The ranked evidence must omit application/factor pairs without risky outcomes",
);
assert.match(
  riskyMfaStanza,
  /sort 10 - RiskyOutcomes - Fraud - Denied application factor/,
  "Risky MFA evidence must use a deterministic severity-first ranking",
);
assert.match(
  riskyMfaStanza,
  /table "Application \/ Factor" "Risky Outcomes" "Failure Rate %" _WindowRiskyOutcomes/,
  "Risky MFA evidence must expose a compact ranked pair, count, and rate",
);
assert.match(
  riskyMfaStanza,
  /No denied or fraud MFA events/,
  "Risky MFA Outcomes must have an explicit zero-event state",
);
const remoteAccessAttemptsStanza = searchbaseConf.match(
  /\[secure_networking_zta_ravpn_connection_attempts_trend\]([\s\S]*?)\n\[/,
)?.[1];
assert.ok(
  remoteAccessAttemptsStanza,
  "Remote Access Health connection-attempt Searchbase stanza must exist",
);
assert.match(
  remoteAccessAttemptsStanza,
  /BucketAttempts=Connects\+'Connect Failures'/,
  "Remote Access Health must define attempts as successful plus failed connections",
);
assert.match(
  remoteAccessAttemptsStanza,
  /eventstats sum\(BucketAttempts\) as WindowAttempts/,
  "Remote Access Health must expose the complete selected-window attempt total",
);
assert.match(
  remoteAccessAttemptsStanza,
  /sum\("Connect Failures"\) as WindowFailures/,
  "Remote Access Health must aggregate its quoted failure field into the window rate",
);
assert.match(
  remoteAccessAttemptsStanza,
  /WindowFailureRatePct=if\(WindowAttempts>0,round\(WindowFailures\/WindowAttempts\*100,1\),0\)/,
  "Remote Access Health must headline the selected-window failed-attempt rate",
);
assert.ok(
  remoteAccessAttemptsStanza.indexOf('match(event_value,"disconnect|terminate|close|logout")') <
    remoteAccessAttemptsStanza.indexOf('match(event_value,"connect|success|allow|establish")'),
  "Disconnect events must be excluded before connected attempts are classified",
);
assert.doesNotMatch(
  remoteAccessAttemptsStanza,
  /addtotals fieldname=BucketTotal Clients Sessions Connects "Connect Failures"/,
  "Remote Access Health must not add clients, sessions, and outcomes into one KPI",
);
const activityBySourceStanza = searchbaseConf.match(
  /\[secure_networking_zta_user_activity_by_source_summary\]([\s\S]*?)\n\[/,
)?.[1];
assert.ok(
  activityBySourceStanza,
  "Control Telemetry Volume source-summary Searchbase stanza must exist",
);
assert.match(
  activityBySourceStanza,
  /stats count as Events by source_layer/,
  "Control Telemetry Volume must aggregate selected-window events by source",
);
assert.match(
  activityBySourceStanza,
  /eventstats sum\(Events\) as _WindowEvents/,
  "Control Telemetry Volume must expose the selected-window source total",
);
assert.match(
  activityBySourceStanza,
  /table "Control Source" Events _WindowEvents/,
  "Control Telemetry Volume must return the categorical bar-chart shape",
);
assert.match(
  activityBySourceStanza,
  /No matching telemetry/,
  "Control Telemetry Volume must retain an explicit zero-event state",
);
assert.match(
  activityBySourceStanza,
  /telemetry volume rather than correlated users/,
  "Control Telemetry Volume must not imply cross-product user correlation",
);
assert.doesNotMatch(
  activityBySourceStanza,
  /(?:UserName|user|SourceSecurityGroup)!=""/,
  "Control Telemetry Volume must count source events even when optional context fields are absent",
);
const incidentSeverityStanza = searchbaseConf.match(
  /\[secure_networking_zta_xdr_incident_status_severity_trend\]([\s\S]*?)\n\[/,
)?.[1];
assert.ok(incidentSeverityStanza, "Incident Severity Searchbase stanza must exist");
assert.match(
  incidentSeverityStanza,
  /"valueField":"WindowIncidents"/,
  "Incident Severity metadata must use its distinct-window incident field",
);
assert.match(
  incidentSeverityStanza,
  /incident_severity="WindowIncidents"[\s\S]*?\| timechart[^\n]+by incident_severity/,
  "Incident Severity must emit its synthetic window series with a directly valid field name",
);
assert.doesNotMatch(
  incidentSeverityStanza,
  /__window__|\| rename[^\n]+WindowIncidents/,
  "Incident Severity must not use the invalid double-underscore rename sentinel",
);
const internalServiceStanza = searchbaseConf.match(
  /\[secure_networking_zta_aa_internal_service_pressure_trend\]([\s\S]*?)\n\[/,
)?.[1];
assert.ok(internalServiceStanza, "Internal Service Pressure Searchbase stanza must exist");
assert.match(
  internalServiceStanza,
  /"valueField":"WindowNetworkFlows".*"sparkDataField":"Network Flows"/,
  "Internal Service Pressure metadata must not bind to legacy mixed-unit aliases",
);
for (const stanzaId of [
  "secure_networking_zta_blocked_access_reason_trend",
  "secure_networking_zta_ztna_blocked_access_reasons",
  "secure_networking_zta_blocked_access_reason_summary",
]) {
  const denialStanza = searchbaseConf.match(
    new RegExp(`\\[${stanzaId}\\]([\\s\\S]*?)\\n\\[`),
  )?.[1];
  assert.ok(denialStanza, `${stanzaId} must exist`);
  assert.match(
    denialStanza,
    /match\(outcome,"\^\(BLOCK\|BLOCKED\|DENY\|DENIED\|DROP\|DROPPED\)\$"\)/,
    `${stanzaId} must use exact deny-class outcomes`,
  );
  assert.doesNotMatch(
    denialStanza,
    /match\(outcome,"BLOCK\|DENY\|DROP"\)/,
    `${stanzaId} must not classify UNBLOCKED as a blocked outcome`,
  );
}
const ztnaConnectionStatusStanza = searchbaseConf.match(
  /\[secure_networking_zta_ztna_connection_status_trend\]([\s\S]*?)\n\[/,
)?.[1];
assert.ok(
  ztnaConnectionStatusStanza,
  "Private Application Access Searchbase stanza must exist",
);
assert.match(
  ztnaConnectionStatusStanza,
  /1==1,"Unknown"/,
  "Private Application Access must normalize every unrecognized status to Unknown",
);
assert.doesNotMatch(
  ztnaConnectionStatusStanza,
  /1==1,coalesce\(action,connection_status/,
  "Private Application Access must not emit arbitrary raw status series",
);
for (const stanzaId of [
  "xdr_aa_forensic_network_external_egress_watch",
  "secure_networking_zta_aa_external_destination_summary",
  "secure_networking_zta_aa_external_egress_trend",
]) {
  const externalEgressStanza = searchbaseConf.match(
    new RegExp(`\\[${stanzaId}\\]([\\s\\S]*?)\\n\\[`),
  )?.[1];
  assert.ok(externalEgressStanza, `${stanzaId} must exist`);
  assert.match(
    externalEgressStanza,
    /cidrmatch\("169\.254\.0\.0\/16",destination_ip\)/,
    `${stanzaId} must exclude the complete IPv4 link-local range`,
  );
}
const sgaclTrendStanza = searchbaseConf.match(
  /\[secure_networking_sgacl_enforcement_activity_trend\]([\s\S]*?)\n\[/,
)?.[1];
assert.ok(sgaclTrendStanza, "SGACL Enforcement Searchbase stanza must exist");
assert.match(
  sgaclTrendStanza,
  /BY _time, Cisco_Catalyst_Dataset\.Cisco_Catalyst_SGACL_Events\.sgacl_action/,
  "SGACL Enforcement must leave _time available for an explicit span override",
);
assert.doesNotMatch(
  sgaclTrendStanza,
  /BY _time span=1h/,
  "SGACL Enforcement must let Auto choose the final timechart bucket width",
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
const timeSeriesX = '> primary | seriesByName("_time")';
const lineCard = (title, ref, headlineField, unit, y, overrides = {}) => ({
  title,
  type: "splunk.line",
  ref,
  headlineField,
  unit,
  options: {
    x: timeSeriesX,
    y,
    lineWidth: 2,
    legendDisplay: "off",
    dataValuesDisplay: "minmax",
    ...overrides,
  },
});
const columnCard = (title, ref, headlineField, unit, y, overrides = {}) => ({
  title,
  type: "splunk.column",
  ref,
  headlineField,
  unit,
  options: {
    x: timeSeriesX,
    y,
    stackMode: "stacked",
    legendDisplay: "bottom",
    dataValuesDisplay: "off",
    ...overrides,
  },
});
const barCard = (title, ref, headlineField, unit, x, y) => ({
  title,
  type: "splunk.bar",
  ref,
  headlineField,
  unit,
  options: {
    x,
    y,
    stackMode: "unstacked",
    legendDisplay: "off",
    dataValuesDisplay: "all",
  },
});
const tableCard = (
  title,
  ref,
  headlineField,
  unit,
  tableTitle,
  columns,
  projection,
) => ({
  title,
  type: "splunk.table",
  ref,
  headlineField,
  unit,
  tableTitle,
  columns,
  projection,
});
const dashboardCardContracts = {
  sn_agentic_ops_executive_assurance: [
    columnCard("Fleet Device Health", "secure_networking_fleet_device_health_summary", "HealthyPct", "%", '> primary | seriesByName("Devices")', { x: '> primary | seriesByName("Health State")', stackMode: "unstacked", legendDisplay: "off", dataValuesDisplay: "all" }),
    tableCard("Lowest Site Connectivity", "secure_networking_site_connectivity_summary", "WindowMinAvailabilityPct", "%", "Lowest observed sites", ["Affected Links", "Availability %", "Site"], '> primary | frameBySeriesNames("Site", "Availability %", "Affected Links")'),
    columnCard("Wireless Availability", "overview_ap_health", "pct", "%", '> primary | frameBySeriesNames("up", "down")'),
    lineCard("Identity Friction", "secure_networking_zta_ise_auth_failure_rate_trend", "WindowFailureRatePct", "%", '> primary | seriesByName("Failure Rate %")'),
    columnCard("Reported Enforcement Blocks", "secure_networking_hmf_unified_blocks_trend", "WindowBlocks", " blocks", '> primary | frameBySeriesNames("Meraki MX", "SD-WAN UTD", "Secure Access", "Secure Firewall / ASA")'),
    tableCard("Lowest Application Availability", "secure_networking_thousandeyes_http_availability_summary", "WindowMinAvailabilityPct", "%", "Lowest observed tests", ["Average Availability %", "Latest Availability %", "Minimum Availability %", "Test"], '> primary | frameBySeriesNames("Test", "Minimum Availability %", "Average Availability %", "Latest Availability %")'),
  ],
  sn_agentic_ops_operational_intelligence: [
    tableCard("Degraded ThousandEyes Tests", "secure_networking_thousandeyes_test_health_summary", "DegradedTests", " degraded tests", "Tests needing attention", ["Latest Availability %", "Peak Loss %", "Status", "Test"], '> primary | frameBySeriesNames("Test", "Latest Availability %", "Peak Loss %", "Status")'),
    columnCard("AI Defense Policy Outcomes", "security_ai_defense_action_trend", "WindowBlocked", " blocked decisions", '> primary | frameBySeriesNames("Allowed", "Blocked", "Other")'),
    barCard("Latency by Reporting Agent", "secure_networking_thousandeyes_latency_by_agent_summary", "WindowPeakLatencyMs", " ms", '> primary | seriesByName("Agent")', '> primary | seriesByName("P95 Latency ms")'),
    lineCard("Network Loss", "secure_networking_thousandeyes_network_loss_trend", "WindowAvgLossPct", "%", '> primary | frameBySeriesNames("avg_loss_pct", "max_loss_pct")', { legendDisplay: "bottom" }),
    barCard("Lowest Application Availability", "secure_networking_thousandeyes_http_availability_summary", "WindowMinAvailabilityPct", "%", '> primary | seriesByName("Test")', '> primary | seriesByName("Minimum Availability %")'),
    barCard("BGP Path Changes by Test", "secure_networking_thousandeyes_bgp_path_changes_summary", "WindowPathChanges", " path changes", '> primary | seriesByName("Test")', '> primary | seriesByName("Path Changes")'),
  ],
  sn_agentic_ops_secure_networking_assurance: [
    lineCard("Secure Networking Assurance Score", "secure_networking_assurance_score_trend", "SNAS", " / 100", '> primary | seriesByName("SNAS")'),
    lineCard("A - Attainability", "secure_networking_assurance_attainability_trend", "WindowAttainability", "%", '> primary | seriesByName("Attainability")'),
    lineCard("R - Retainability", "secure_networking_assurance_retainability_trend", "WindowRetainability", "%", '> primary | frameBySeriesNames("Retainability", "ise_success", "ztna_success")', { legendDisplay: "bottom" }),
    tableCard("Q - Quality", "secure_networking_assurance_quality_summary", "WindowQuality", " / 100", "Quality components", ["Component", "Measurement", "Score"], '> primary | frameBySeriesNames("Component", "Measurement", "Score")'),
    tableCard("Contextual risk multiplier", "secure_networking_assurance_contextual_risk_summary", "WindowRiskMultiplier", "×", "Active incident pressure", ["Global Score", "Incident", "Status"], '> primary | frameBySeriesNames("Incident", "Status", "Global Score")'),
    columnCard("Reported Distributed Enforcement Blocks", "secure_networking_hmf_unified_blocks_trend", "WindowBlocks", " blocks", '> primary | frameBySeriesNames("Meraki MX", "SD-WAN UTD", "Secure Access", "Secure Firewall / ASA")'),
  ],
  sn_hmf_dlp_cloud_native_security: [
    columnCard("Data Loss Findings", "secure_networking_secure_access_dlp_findings_trend", "WindowElevatedFindings", " findings", '> primary | frameWithoutSeriesNames("ElevatedFindings", "WindowElevatedFindings")'),
    barCard("Workload Alert Pressure", "security_microseg_tetration_alerts_by_severity_type", "WindowTotal", " alerts", '> primary | seriesByName("Alert Category")', '> primary | seriesByName("Alerts")'),
    lineCard("Cloud Enforcement Rate", "security_multicloud_defense_action_breakdown_kpi", "WindowDenyPct", " %", '> primary | seriesByName("deny_pct")'),
    tableCard("Runtime Detection Severity", "security_isovalent_alerts_by_severity", "WindowTotal", " alerts", "", ["Severity", "Alerts"]),
    columnCard("Network Security Decisions", "network_intelligence_blocked_vs_allowed", "WindowTotal", " connections", '> primary | seriesByName("Connections")', { x: '> primary | seriesByName("Decision")', stackMode: "unstacked", legendDisplay: "off", dataValuesDisplay: "all" }),
    tableCard("Cloud Security Activity", "secure_networking_cloud_native_security_activity", "WindowTotal", " events", "", ["Provider", "Sourcetype", "Events", "First Seen", "Last Seen"]),
  ],
  sn_hmf_enforcement: [
    lineCard("Reporting Firewalls", "secure_networking_infra_fmc_firewall_count", "firewall_count", " firewalls", '> primary | seriesByName("firewall_count")'),
    columnCard("Unified Block Activity", "secure_networking_hmf_unified_blocks_trend", "WindowBlocks", " blocks", '> primary | frameWithoutSeriesNames("BucketBlocks", "WindowBlocks")'),
    columnCard("FMC Enforcement Activity", "secure_networking_fmc_activity_trend", "WindowBlocks", " blocked events", '> primary | frameWithoutSeriesNames("WindowBlocks")'),
    columnCard("DNS Security Activity", "secure_networking_sse_dns_activity_trend", "WindowBlocked", " blocked requests", '> primary | frameWithoutSeriesNames("WindowBlocked")'),
    columnCard("SGT-tagged Policy Decisions", "secure_networking_sgt_palo_alto_policy_effectiveness_trend", "WindowBlocked", " blocked decisions", '> primary | frameWithoutSeriesNames("WindowBlocked")'),
    columnCard("Data Protection Findings", "secure_networking_secure_access_dlp_findings_trend", "WindowElevatedFindings", " findings", '> primary | frameWithoutSeriesNames("ElevatedFindings", "WindowElevatedFindings")'),
  ],
  sn_hmf_sdwan_network_health: [
    barCard("Site Health", "monitoring_sdwan_site_state_summary", "DownSites", " down sites", '> primary | seriesByName("State")', '> primary | seriesByName("Sites")'),
    barCard("Circuit Availability", "monitoring_sdwan_circuit_state_summary", "DownCircuits", " down circuits", '> primary | seriesByName("State")', '> primary | seriesByName("Circuits")'),
    lineCard("Degraded Tunnels", "monitoring_sdwan_tunnel_health_poor_trend", "WindowPoorTunnels", " poor tunnels", '> primary | seriesByName("poor_tunnels")'),
    columnCard("Application Health", "secure_networking_sdwan_apps_health_breakdown", "degraded_sites", " degraded sites", '> primary | frameBySeriesNames("degraded_sites_trend", "healthy_sites_trend")'),
    lineCard("Path Loss", "secure_networking_thousandeyes_network_loss_trend", "WindowAvgLossPct", " %", '> primary | frameBySeriesNames("avg_loss_pct", "max_loss_pct")', { legendDisplay: "bottom" }),
    columnCard("Routing Stability", "secure_networking_thousandeyes_bgp_path_changes_trend", "WindowPathChanges", " path changes", '> primary | frameWithoutSeriesNames("BucketPathChanges", "WindowPathChanges")'),
  ],
  sn_hmf_threat_detection_enforcement: [
    columnCard("Firewall Decisions", "network_intelligence_blocked_vs_allowed", "WindowTotal", " connections", '> primary | seriesByName("Connections")', { x: '> primary | seriesByName("Decision")', stackMode: "unstacked", legendDisplay: "off", dataValuesDisplay: "all" }),
    columnCard("Cloud Firewall Blocks", "security_resilience_cloud_fw_blocked", "WindowUniqueBlockedFlows", " unique flows", '> primary | seriesByName("count")', { stackMode: "unstacked", legendDisplay: "off" }),
    lineCard("Multicloud Deny Rate", "security_multicloud_defense_action_breakdown_kpi", "WindowDenyPct", " %", '> primary | seriesByName("deny_pct")'),
    tableCard("Runtime Alerts", "security_isovalent_alerts_by_severity", "WindowTotal", " alerts", "", ["Severity", "Alerts"]),
    columnCard("Branch IPS Pressure", "security_resilience_sdwan_utd_ips_trend_by_priority", "WindowHighRisk", " high-risk events", '> primary | frameBySeriesNames("High Risk", "Medium Risk", "Low Risk")'),
    columnCard("Unified Enforcement", "secure_networking_hmf_unified_blocks_trend", "WindowBlocks", " blocks", '> primary | frameWithoutSeriesNames("BucketBlocks", "WindowBlocks")'),
  ],
  sn_secure_infrastructure_posture: [
    columnCard("Data Center Signals", "secure_networking_dc_health_signals_trend", "WindowUniqueAnomalies", " unique anomalies", '> primary | frameBySeriesNames("Anomaly", "Advisory", "Unknown")'),
    lineCard("Critical Advisories", "secure_networking_dc_advisory_count", "critical_count", " critical advisories", '> primary | seriesByName("critical_count_trend")'),
    lineCard("Reporting Access Points", "secure_networking_meraki_ap_count", "WindowReportingAPs", " access points", '> primary | seriesByName("ap_count")'),
    columnCard("Wireless Containment", "secure_networking_meraki_rogue_ap_containment_trend", "WindowUncontainedAPs", " uncontained APs", '> primary | frameBySeriesNames("Contained", "Uncontained")'),
    lineCard("Wireless Clients Observed", "secure_networking_meraki_wireless_client_count", "WindowUniqueClients", " clients", '> primary | seriesByName("wireless_client_count")'),
    lineCard("Reporting SD-WAN Sites", "secure_networking_sdwan_reporting_sites_trend", "total_sites", " sites", '> primary | seriesByName("reporting_sites")'),
  ],
  sn_secure_infrastructure_status: [
    lineCard("Reporting Access Points", "secure_networking_meraki_ap_count", "WindowReportingAPs", " access points", '> primary | seriesByName("ap_count")'),
    lineCard("Catalyst Active Issues", "secure_networking_catalyst_active_issues_trend", "CurrentActiveIssues", " active issues", '> primary | seriesByName("BucketIssues")'),
    lineCard("Reporting SD-WAN Sites", "secure_networking_sdwan_reporting_sites_trend", "total_sites", " sites", '> primary | seriesByName("reporting_sites")'),
    columnCard("Data Center Signals", "secure_networking_dc_health_signals_trend", "WindowUniqueAnomalies", " unique anomalies", '> primary | frameBySeriesNames("Anomaly", "Advisory", "Unknown")'),
    lineCard("Endpoint Incidents", "secure_networking_infra_secure_endpoint_incident_trend", "WindowIncidents", " incidents", '> primary | seriesByName("Incidents")'),
    columnCard("Firewall Activity", "secure_networking_fmc_activity_trend", "WindowBlocks", " blocked events", '> primary | frameWithoutSeriesNames("WindowBlocks")'),
  ],
  sn_segmentation_operations: [
    barCard("Tagged Authentication Events by Location", "secure_networking_sgt_site_activity_summary", "WindowEvents", " events", '> primary | seriesByName("Location Context")', '> primary | seriesByName("Events")'),
    barCard("Tagged Endpoints by Reporting Device", "secure_networking_sgt_device_activity_summary", "WindowTaggedEndpoints", " endpoints", '> primary | seriesByName("Network Device")', '> primary | seriesByName("Tagged Endpoints")'),
    barCard("Observed IP-SGT Bindings", "secure_networking_sgt_binding_activity_summary", "WindowBoundPrefixes", " prefixes", '> primary | seriesByName("Security Group")', '> primary | seriesByName("Bound Prefixes")'),
    columnCard("Observed SGACL Decisions", "secure_networking_sgacl_enforcement_activity_trend", "WindowTotal", " events", '> primary | frameWithoutSeriesNames("BucketTotal", "WindowTotal")'),
    columnCard("Observed Segmentation Feature Events", "secure_networking_router_segmentation_feature_trend", "WindowTotal", " events", '> primary | frameBySeriesNames("VXLAN / VNI", "VLAN / 802.1Q", "VRF", "SGT / TrustSec", "VPN")'),
    barCard("FMC Blocks by SGT Context", "secure_networking_sgt_fmc_blocks_by_sgt_summary", "WindowBlocks", " blocks", '> primary | seriesByName("SGT Context")', '> primary | seriesByName("Blocks")'),
  ],
  sn_segmentation_readiness: [
    barCard("TrustSec Hardware Inventory", "secure_networking_trustsec_hardware_readiness_summary", "WindowDevices", " devices", '> primary | seriesByName("Device Family")', '> primary | seriesByName("Devices")'),
    lineCard("Observed Endpoint-SGT Assignments", "secure_networking_sgt_total_assignments_count", "total_assignments", " assignments", '> primary | seriesByName("assignments_trend")'),
    barCard("Observed Security Groups in Use", "secure_networking_sgt_activity_summary", "WindowSecurityGroups", " groups", '> primary | seriesByName("Security Group")', '> primary | seriesByName("Events")'),
    lineCard("Observed Segmentation Adoption Rate", "secure_networking_segmentation_adoption_rate_trend", "WindowAdoptionRate", "%", '> primary | seriesByName("AdoptionRate")'),
    tableCard("Sites With No Observed SGT Coverage", "secure_networking_segmentation_zero_coverage_sites_summary", "WindowZeroCoverageSites", " sites", "Zero-coverage sites", ["Authentication Events", "Coverage %", "Site", "Tagged Events"], '> primary | frameBySeriesNames("Site", "Authentication Events", "Tagged Events", "Coverage %")'),
    barCard("Tagged Authentication Events by Location", "secure_networking_sgt_site_activity_summary", "WindowEvents", " events", '> primary | seriesByName("Location Context")', '> primary | seriesByName("Events")'),
  ],
  sn_zta_authentication_policy_enforcement: [
    lineCard("Authentication Failure Rate", "secure_networking_zta_ise_auth_failure_rate_trend", "WindowFailureRatePct", "%", '> primary | seriesByName("Failure Rate %")'),
    columnCard("Policy Family Activity", "secure_networking_zta_ise_policy_family_activity_trend", "WindowTotal", " policy hits", '> primary | frameWithoutSeriesNames("BucketTotal", "WindowTotal")'),
    columnCard("RADIUS Outcomes", "secure_networking_zta_radius_auth_outcomes_trend", "WindowAuths", " authentications", '> primary | frameWithoutSeriesNames("BucketTotal", "WindowFailures", "WindowAuths")'),
    columnCard("RadSec Transport Activity", "secure_networking_zta_radsec_activity_trend", "WindowActivity", " authentications", '> primary | frameWithoutSeriesNames("Activity", "WindowActivity", "WindowFailures")'),
    columnCard("Duo Policy Outcomes", "secure_networking_zta_duo_auth_outcomes_trend", "WindowRiskyOutcomes", " events", '> primary | frameWithoutSeriesNames("RiskyOutcomes", "WindowRiskyOutcomes")'),
    lineCard("ISE Enforcement Footprint", "secure_networking_infra_ise_device_count", "WindowISEDevices", " devices", '> primary | seriesByName("ise_device_count")'),
  ],
  sn_zta_detection_response: [
    columnCard("Incident Severity", "secure_networking_zta_xdr_incident_status_severity_trend", "WindowIncidents", " incidents", '> primary | frameWithoutSeriesNames("BucketTotal", "WindowTotal", "WindowIncidents")'),
    lineCard("Incident Risk Pressure", "secure_networking_zta_xdr_risk_pressure_trend", "WindowPeakRisk", " score", '> primary | frameWithoutSeriesNames("BucketTotal", "WindowPeakRisk")', { legendDisplay: "bottom" }),
    columnCard("Internal Service Pressure", "secure_networking_zta_aa_internal_service_pressure_trend", "WindowNetworkFlows", " flows", '> primary | frameWithoutSeriesNames("BucketTotal", "WindowTotal", "WindowNetworkFlows")', { stackMode: "unstacked" }),
    barCard("External Egress Activity", "secure_networking_zta_aa_external_destination_summary", "WindowExternalFlows", " flows", '> primary | seriesByName("External Destination")', '> primary | seriesByName("Flows")'),
    tableCard("File Source Hotspots", "secure_networking_zta_aa_file_source_summary", "WindowArtifacts", " artifacts", "Top file sources", ["File Source", "Artifacts", "Unique Hashes", "Analysis Jobs", "Risk"], '> primary | frameBySeriesNames("File Source", "Artifacts", "Unique Hashes", "Analysis Jobs", "Risk")'),
    columnCard("Detection Severity", "secure_networking_zta_aa_detection_severity_trend", "WindowTotal", " detections", '> primary | frameWithoutSeriesNames("BucketTotal", "WindowTotal")'),
  ],
  sn_zta_policy_management: [
    columnCard("Policy Family Activity", "secure_networking_zta_ise_policy_family_activity_trend", "WindowTotal", " policy hits", '> primary | frameWithoutSeriesNames("BucketTotal", "WindowTotal")'),
    columnCard("RADIUS Enforcement", "secure_networking_zta_radius_auth_outcomes_trend", "WindowAuths", " authentications", '> primary | frameWithoutSeriesNames("BucketTotal", "WindowFailures", "WindowAuths")'),
    columnCard("Secure Transport Activity", "secure_networking_zta_radsec_activity_trend", "WindowActivity", " authentications", '> primary | frameWithoutSeriesNames("Activity", "WindowActivity", "WindowFailures")'),
    tableCard("MFA Policy Outcomes", "secure_networking_zta_risky_mfa_outcomes_by_application_factor", "_WindowRiskyOutcomes", " events", "Most affected application / factor", ["Application / Factor", "Risky Outcomes", "Failure Rate %"]),
    barCard("ZTNA Denial Reasons", "secure_networking_zta_blocked_access_reason_summary", "WindowBlocked", " blocks", '> primary | seriesByName("Denial Reason")', '> primary | seriesByName("Events")'),
    columnCard("SGACL Enforcement", "secure_networking_sgacl_enforcement_activity_trend", "WindowTotal", " events", '> primary | frameWithoutSeriesNames("BucketTotal", "WindowTotal")'),
  ],
  sn_zta_posture: [
    columnCard("Authentication Outcomes", "secure_networking_zta_auth_outcome_trend", "WindowAuthentications", " authentications", '> primary | frameWithoutSeriesNames("BucketAuthentications", "WindowAuthentications")'),
    lineCard("Authentication Friction", "secure_networking_zta_ise_auth_failure_rate_trend", "WindowFailureRatePct", "%", '> primary | seriesByName("Failure Rate %")'),
    columnCard("Private Access Status", "secure_networking_zta_ztna_connection_status_trend", "WindowConnections", " connections", '> primary | frameWithoutSeriesNames("BucketConnections", "WindowConnections")'),
    columnCard("Remote Access Health", "secure_networking_zta_ravpn_connection_attempts_trend", "WindowFailureRatePct", "%", '> primary | frameBySeriesNames("Connects", "Connect Failures")'),
    tableCard("Risky MFA Outcomes", "secure_networking_zta_risky_mfa_outcomes_by_application_factor", "_WindowRiskyOutcomes", " events", "Most affected application / factor", ["Application / Factor", "Risky Outcomes", "Failure Rate %"]),
    barCard("Control Telemetry Volume", "secure_networking_zta_user_activity_by_source_summary", "_WindowEvents", " events", '> primary | seriesByName("Control Source")', '> primary | seriesByName("Events")'),
  ],
  sn_zta_ravpn_sessions_and_posture: [
    lineCard("Observed VPN Clients and Sessions", "secure_networking_zta_ravpn_active_clients_sessions_trend", "WindowPeakClients", " clients", '> primary | frameWithoutSeriesNames("BucketTotal", "WindowPeakClients")', { legendDisplay: "bottom" }),
    columnCard("Connection Outcomes", "secure_networking_zta_ravpn_connection_attempts_trend", "WindowFailureRatePct", "%", '> primary | frameWithoutSeriesNames("Clients", "Sessions", "BucketAttempts", "WindowAttempts", "WindowFailures", "Failure Rate %", "WindowFailureRatePct")'),
    lineCard("Observed VPN Profiles", "secure_networking_zta_ravpn_profile_activity_trend", "WindowActiveProfiles", " profiles", '> primary | seriesByName("ActiveProfiles")'),
    lineCard("Observed VPN Regions", "secure_networking_zta_ravpn_region_activity_trend", "WindowActiveRegions", " regions", '> primary | seriesByName("ActiveRegions")'),
    barCard("Failure Reasons", "secure_networking_zta_ravpn_failure_reason_summary", "WindowFailureEvents", " events", '> primary | seriesByName("Failure Reason")', '> primary | seriesByName("Events")'),
    columnCard("Posture Outcomes", "secure_networking_zta_ravpn_posture_outcome_trend", "WindowPostureIssues", " events", '> primary | frameWithoutSeriesNames("PostureIssues", "WindowPostureIssues")'),
  ],
  sn_zta_user_activity_monitoring: [
    barCard("Control Telemetry Volume", "secure_networking_zta_user_activity_by_source_summary", "_WindowEvents", " events", '> primary | seriesByName("Control Source")', '> primary | seriesByName("Events")'),
    columnCard("Private Application Access", "secure_networking_zta_ztna_connection_status_trend", "WindowConnections", " connections", '> primary | frameWithoutSeriesNames("BucketConnections", "WindowConnections")'),
    barCard("Access Denial Causes", "secure_networking_zta_blocked_access_reason_summary", "WindowBlocked", " blocks", '> primary | seriesByName("Denial Reason")', '> primary | seriesByName("Events")'),
    tableCard("MFA Activity", "secure_networking_zta_risky_mfa_outcomes_by_application_factor", "_WindowRiskyOutcomes", " events", "Most affected application / factor", ["Application / Factor", "Risky Outcomes", "Failure Rate %"]),
    barCard("User Egress Concentration", "network_nvm_top_users_by_egress", "WindowBytesOut", " bytes out", '> primary | seriesByName("User")', '> primary | seriesByName("Bytes Out")'),
    barCard("Process Egress Concentration", "network_nvm_top_processes_by_flow_volume", "WindowBytesOut", " bytes out", '> primary | seriesByName("Process")', '> primary | seriesByName("Bytes Out")'),
  ],
};
const infoXPositions = [534, 1167, 1800, 534, 1167, 1800];
const investigationXPositions = [578, 1211, 1844, 578, 1211, 1844];
const normalizeCardTitle = (markdown) =>
  markdown
    .replace(/^\*\*/, "")
    .replace(/\*\*$/, "")
    .replace(/\\([\-_.])/g, "$1");

const extractHeadlineField = (singleValue) => {
  const majorValue = singleValue?.options?.majorValue || "";
  const headlineExpression = majorValue.includes("seriesByName(")
    ? majorValue
    : singleValue?.options?.sparklineValues || "";
  return headlineExpression.match(/seriesByName\("([^"]+)"\)/)?.[1];
};
const assertHiddenYAxis = (viewName, trendId, options) => {
  assert.equal(options.showYMajorGridLines, false, viewName + " " + trendId);
  assert.equal(options.showYMinorGridLines, false, viewName + " " + trendId);
  assert.equal(options.yAxisLabelVisibility, "hide", viewName + " " + trendId);
  assert.equal(options.yAxisLineVisibility, "hide", viewName + " " + trendId);
  assert.equal(
    options.yAxisMajorTickVisibility,
    "hide",
    viewName + " " + trendId,
  );
  assert.equal(
    options.yAxisMinorTickVisibility,
    "hide",
    viewName + " " + trendId,
  );
  assert.equal(options.yAxisTitleVisibility, "hide", viewName + " " + trendId);
};

assert.deepEqual(
  [...Object.keys(dashboardCardContracts), "sn_data_center_operations", "sn_network_service_investigations"].sort(),
  frameworkViews,
  "The semantic card contracts must cover every managed dashboard",
);

let rolloutCardCount = 0;
let rolloutInfoActionCount = 0;
let rolloutInvestigationActionCount = 0;
let rolloutProjectionCount = 0;
const rolloutTypeCounts = {
  "splunk.bar": 0,
  "splunk.column": 0,
  "splunk.line": 0,
  "splunk.table": 0,
};
// The Secure Data Center dashboard retains its purpose-built 15-KPI layout;
// secureDataCenterDashboard.test.cjs owns that distinct semantic contract.
const sixCardFrameworkViews = frameworkViews.filter(
  (viewName) => !["sn_data_center_operations", "sn_network_service_investigations"].includes(viewName),
);
sixCardFrameworkViews.forEach((viewName) => {
  const definition = readDefinition(viewName);
  const overview = definition.layout.layoutDefinitions.layout_overview;
  const cardContracts = dashboardCardContracts[viewName];
  const primaryDataSources = Object.values(definition.dataSources).filter(
    ({ type }) => type === "ds.searchbase",
  );
  assert.equal(overview.options.width, 1920, viewName + " must use pilot width");
  assert.equal(overview.options.height, 1024, viewName + " must use pilot height");
  assert.equal(
    overview.structure.length,
    52,
    viewName + " must have 52 layout items",
  );
  assert.equal(
    overview.structure.filter(({ item }) => definition.visualizations[item]).length,
    51,
    viewName + " must retain 51 overview visualizations",
  );
  assert.equal(
    primaryDataSources.length,
    6,
    viewName + " must retain six primary Searchbase data sources",
  );
  assert.equal(
    Object.keys(definition.dataSources).length,
    6,
    viewName + " must contain only its six primary Searchbase sources",
  );
  assert.equal(cardContracts.length, 6, viewName + " must contract six cards");
  assert.equal(
    definition.inputs.input_time_range.options.defaultValue,
    "-24h@h,now,auto",
    viewName + " must default to the hour-aligned Last 24 hours preset with Auto span",
  );
  assert.equal(
    definition.inputs.input_time_range.options.selections.find(({ label }) => label === "24h").value,
    "-24h@h,now,auto",
    viewName + " 24h shortcut must match the advanced time preset",
  );
  assert.ok(
    definition.inputs.input_time_range.options.selections.every(({ value }) =>
      value.endsWith(",auto"),
    ),
    viewName + " quick ranges must leave timechart bucket selection on Auto",
  );
  primaryDataSources.forEach((dataSource) => {
    assert.equal(
      dataSource.options.queryParameters.span,
      "$time_tok.span$",
      viewName + " must pass the optional span token to every Searchbase source",
    );
  });
  Object.entries(definition.visualizations).forEach(([visualizationId, viz]) => {
    assert.notEqual(
      viz.type,
      "splunk.area",
      viewName + " " + visualizationId + " must not regress to an area chart",
    );
  });

  cardContracts.forEach((contract, index) => {
    const color = expectedColors[index];
    const cardId = String(index + 1).padStart(2, "0");
    const trendId = "viz_card_" + cardId + "_trend";
    const titleId = "viz_card_" + cardId + "_title";
    const singleValueId = "viz_card_" + cardId + "_singlevalue";
    const infoId = "viz_card_" + cardId + "_info_trigger";
    const investigationId = "viz_card_" + cardId + "_drilldown_trigger";
    const baseDataSourceId = "ds_story_" + cardId;
    const trend = definition.visualizations[trendId];
    const singleValue = definition.visualizations[singleValueId];
    const options = trend?.options;
    const origin = normalizeCardTitle(
      definition.visualizations[titleId]?.options?.markdown || "",
    );
    const baseDataSource = definition.dataSources[baseDataSourceId];
    const infoTrigger = definition.visualizations[infoId];
    const investigationTrigger = definition.visualizations[investigationId];
    const infoLayout = overview.structure.find(({ item }) => item === infoId);
    const investigationLayout = overview.structure.find(
      ({ item }) => item === investigationId,
    );
    const titleLayout = overview.structure.find(({ item }) => item === titleId);

    assert.ok(options, viewName + " " + trendId + " must exist");
    assert.equal(origin, contract.title, viewName + " " + titleId + " title");
    assert.equal(trend.type, contract.type, viewName + " " + trendId + " type");
    assert.equal(
      singleValue?.dataSources?.primary,
      baseDataSourceId,
      viewName + " " + singleValueId + " primary datasource",
    );
    assert.equal(
      baseDataSource?.type,
      "ds.searchbase",
      viewName + " " + baseDataSourceId + " must remain a Searchbase source",
    );
    assert.equal(
      baseDataSource?.options?.ref,
      contract.ref,
      viewName + " " + baseDataSourceId + " Searchbase ref",
    );
    assert.match(
      searchbaseConf,
      new RegExp(`^\\[${contract.ref}\\]$`, "m"),
      viewName + " " + baseDataSourceId + " Searchbase stanza must exist",
    );
    assert.equal(
      extractHeadlineField(singleValue),
      contract.headlineField,
      viewName + " " + singleValueId + " headline field",
    );
    assert.ok(
      typeof singleValue?.options?.unit === "string" &&
        singleValue.options.unit.length > 0,
      viewName + " " + singleValueId + " must label its KPI unit",
    );
    assert.equal(
      singleValue.options.unit,
      contract.unit,
      viewName + " " + singleValueId + " unit",
    );

    assert.equal(
      trend.dataSources.primary,
      baseDataSourceId,
      viewName + " " + trendId + " datasource",
    );
    if (contract.projection) {
      assert.equal(
        options.table,
        contract.projection,
        viewName + " " + trendId + " compact table projection",
      );
      rolloutProjectionCount += 1;
    }

    if (contract.type === "splunk.table") {
      assert.equal(trend.title, contract.tableTitle, viewName + " " + trendId);
      assert.equal(options.count, 5, viewName + " " + trendId);
      assert.equal(options.backgroundColor, "#131a23", viewName + " " + trendId);
      assert.equal(options.headerVisibility, "fixed", viewName + " " + trendId);
      assert.equal(options.showInternalFields, false, viewName + " " + trendId);
      assert.equal(options.showRowNumbers, false, viewName + " " + trendId);
      assert.deepEqual(
        Object.keys(options.columnFormat).sort(),
        [...contract.columns].sort(),
        viewName + " " + trendId + " compact table columns",
      );
    } else {
      Object.entries(contract.options).forEach(([optionName, expectedValue]) => {
        assert.deepEqual(
          options[optionName],
          expectedValue,
          viewName + " " + trendId + " " + optionName,
        );
      });
      assert.equal(
        options.areaOpacity,
        undefined,
        viewName + " " + trendId + " must not retain area fill",
      );
      assertHiddenYAxis(viewName, trendId, options);
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
        viewName + " " + trendId + " approved ordered palette",
      );
    }

    assert.equal(infoTrigger?.type, "splunk.rectangle", viewName + " " + infoId);
    assert.equal(
      investigationTrigger?.type,
      "splunk.rectangle",
      viewName + " " + investigationId,
    );
    [infoTrigger, investigationTrigger].forEach((trigger) => {
      assert.deepEqual(
        trigger?.options,
        { fillColor: "transparent", strokeColor: "transparent" },
        viewName + " card " + cardId + " action overlay",
      );
      assert.equal(trigger?.eventHandlers?.length, 1);
      assert.equal(trigger?.eventHandlers?.[0]?.type, "drilldown.customUrl");
    });
    assert.equal(
      infoTrigger.eventHandlers[0].options.url,
      "/metric-info?origin=" +
        encodeURIComponent(origin) +
        "&target=" +
        contract.ref,
      viewName + " " + infoId + " About action",
    );
    const investigationUrl = new URL(
      investigationTrigger.eventHandlers[0].options.url,
      "http://dashboard.test",
    );
    assert.equal(investigationUrl.pathname, "/drilldown");
    assert.equal(
      investigationUrl.searchParams.get("origin"),
      origin,
      viewName + " " + investigationId + " visible origin",
    );
    assert.ok(
      investigationUrl.searchParams.get("target")?.trim(),
      viewName + " " + investigationId + " must retain a Magnify+ target",
    );

    assert.equal(infoLayout?.position?.x, infoXPositions[index]);
    assert.equal(infoLayout?.position?.y, index < 3 ? 118 : 574);
    assert.equal(infoLayout?.position?.w, 42);
    assert.equal(infoLayout?.position?.h, 42);
    assert.equal(
      investigationLayout?.position?.x,
      investigationXPositions[index],
    );
    assert.equal(investigationLayout?.position?.y, index < 3 ? 118 : 574);
    assert.equal(investigationLayout?.position?.w, 42);
    assert.equal(investigationLayout?.position?.h, 42);
    assert.equal(titleLayout?.position?.w, 482);
    assert.ok(
      overview.structure.findIndex(({ item }) => item === infoId) <
        overview.structure.findIndex(({ item }) => item === investigationId),
      viewName + " " + infoId + " must precede Magnify+ in visual and keyboard order",
    );

    rolloutTypeCounts[contract.type] += 1;
    rolloutCardCount += 1;
    rolloutInfoActionCount += 1;
    rolloutInvestigationActionCount += 1;
  });
});
assert.equal(rolloutCardCount, 102);
assert.equal(rolloutInfoActionCount, 102);
assert.equal(rolloutInvestigationActionCount, 102);
assert.equal(rolloutProjectionCount, 7);
const rolloutSearchbaseRefs = new Set(
  Object.values(dashboardCardContracts)
    .flat()
    .map(({ ref }) => ref),
);
for (const ref of rolloutSearchbaseRefs) {
  const stanza = searchbaseConf.match(
    new RegExp(`^\\[${ref}\\]([\\s\\S]*?)(?=^\\[|$)`, "m"),
  );
  assert.ok(stanza, `${ref} Searchbase stanza must exist`);
  assert.doesNotMatch(
    stanza[1],
    /\|\s*(?:eventstats|stats|streamstats)\b[^\n]*\b(?:sum|max|min|avg|latest|earliest|values|dc|perc\d*)\(\s*'[^']+'\s*\)/,
    `${ref} aggregate commands must use double-quoted spaced or dotted field names; single quotes produce null aggregates in Splunk`,
  );
}
assert.deepEqual(rolloutTypeCounts, {
  "splunk.bar": 21,
  "splunk.column": 41,
  "splunk.line": 27,
  "splunk.table": 13,
});
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
assert.match(
  editor,
  /<Link[\s\S]*?to=\{splunkSearchbaseEditUrl\(search\.name\)\}[\s\S]*?Edit in Searchbase/,
  "The Searchbase data-source action must use the locale-aware editor URL helper",
);
assert.doesNotMatch(
  editor,
  /window\.open\([\s\S]*?\/app\/searchbase\/start/,
  "The Searchbase data-source action must not open a locale-less route",
);
assert.match(
  commonStyles,
  /dashboard-builder-themed-modal-dark \.dashboardbuilder-convert-explanation[\s\S]*?color: #d6dee8 !important/,
  "The conversion explanation must use readable dark-theme text",
);
assert.match(
  addSearchPicker,
  /const DEFAULT_APP = 'splunk-cisco-dashboards'[\s\S]*?useState\(DEFAULT_APP\)[\s\S]*?setSelectedApp\(DEFAULT_APP\)/,
  "The Dashboard Studio search picker must default and reset to this app",
);
assert.match(
  insightKpiButton,
  /DARK_TREND_COLOR = '#8bb8ff'[\s\S]*?LIGHT_TREND_COLOR = '#006d9c'[\s\S]*?trendColor[\s\S]*?options/,
  "New single-value searches must use a readable theme-aware trend color",
);
assert.match(
  editor,
  /<InsightKpiButton\s+key="insightKpi"\s+colorScheme=\{dashboardColorScheme\}\s+\/>/,
  "Added searches must receive Dashboard Studio's active color scheme",
);
assert.match(timeRangeUtils, /DEFAULT_EARLIEST = '-24h@h'/);
assert.match(
  timeRangeUtils,
  /DEFAULT_VALUE = `\$\{DEFAULT_EARLIEST\},\$\{DEFAULT_LATEST\},\$\{DEFAULT_SPAN\}`/,
);
assert.match(
  editor,
  /defaultValue: "-24h@h,now"/,
  "New dashboards must keep the -24h@h global time default",
);

console.log(
  "Dashboard Studio route, Manager scope, help, and 19-dashboard library checks passed.",
);
