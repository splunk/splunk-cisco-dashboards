"use strict";

const assert = require("assert").strict;
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const babel = require("@babel/core");

const packageRoot = path.resolve(__dirname, "..");
const readSource = (relativePath) =>
  fs.readFileSync(path.join(packageRoot, relativePath), "utf8");

const managerScope = readSource(
  "src/main/webapp/common/config/managedStudioViews.js",
);
const dashboardPersistence = readSource("src/main/webapp/common/lib/splunk.js");
const editor = readSource(
  "src/main/webapp/pages/dashboardbuilder/DashboardStudioEditor.jsx",
);
const homePage = readSource(
  "src/main/webapp/pages/dashboardbuilder/DBHomePage.jsx",
);
const setupTuner = readSource(
  "src/main/webapp/pages/macro_index_tuning/index.tsx",
);
const setupBootstrap = readSource(
  "src/main/resources/splunk/appserver/static/start_bootstrap.js",
);
const defaultMacros = readSource(
  "src/main/resources/splunk/default/macros.conf",
);
const searchbase = readSource(
  "src/main/resources/splunk/default/searchbase.conf",
);

const readTopLevelConst = (source, name) => {
  const start = source.indexOf(`const ${name} =`);
  assert.notEqual(start, -1, `Expected ${name} to be declared`);
  const end = source.indexOf("\n};", start);
  assert.notEqual(end, -1, `Expected ${name} to end with a top-level block`);
  return source.slice(start, end + 3);
};

const evaluateTypeScriptConst = (source, name, context = {}) => {
  const declaration = readTopLevelConst(source, name);
  const compiled = babel.transformSync(
    `${declaration}\nmodule.exports = ${name};`,
    {
      filename: "setup-contract.ts",
      presets: ["@babel/preset-typescript"],
    },
  ).code;
  const moduleRecord = { exports: {} };
  const loadDeclaration = vm.runInNewContext(
    `(function(module, exports) {${compiled}\n})`,
    context,
  );
  loadDeclaration(moduleRecord, moduleRecord.exports);
  return moduleRecord.exports;
};

const compiledManagerScope = babel.transformSync(managerScope, {
  plugins: ["@babel/plugin-transform-modules-commonjs"],
}).code;
const moduleRecord = { exports: {} };
const loadManagerScope = vm.runInNewContext(
  `(function(require, module, exports) {${compiledManagerScope}\n})`,
);
loadManagerScope(
  (moduleId) => {
    if (moduleId === "../lib/constants") {
      return { INSIGHTS_APP_ID: "splunk-cisco-dashboards" };
    }
    throw new Error(`Unexpected import: ${moduleId}`);
  },
  moduleRecord,
  moduleRecord.exports,
);

const { requiresDashboardManagerRuntime } = moduleRecord.exports;

assert.equal(
  requiresDashboardManagerRuntime({
    dataSources: { primary: { type: "ds.searchbase" } },
  }),
  true,
);
assert.equal(
  requiresDashboardManagerRuntime({
    visualizations: {
      action: { type: "splunk.cisco_drilldown_action" },
    },
  }),
  true,
);
assert.equal(
  requiresDashboardManagerRuntime(
    JSON.stringify({
      inputs: { time: { type: "input.simpleTimePicker" } },
    }),
  ),
  true,
);
assert.equal(
  requiresDashboardManagerRuntime({
    dataSources: { primary: { type: "ds.search" } },
    visualizations: { chart: { type: "splunk.area" } },
    inputs: { time: { type: "input.timerange" } },
  }),
  false,
);
assert.equal(
  requiresDashboardManagerRuntime({
    visualizations: {
      note: {
        type: "splunk.markdown",
        options: { markdown: "Documentation for ds.searchbase" },
      },
    },
  }),
  false,
  "Text mentioning an extension type must not hide an otherwise native dashboard",
);

assert.match(
  dashboardPersistence,
  /requiresDashboardManagerRuntime\(jsonDefinition\)[\s\S]*?\? ' isVisible="false"'[\s\S]*?: ''/,
  "Create, copy, and metadata paths must derive native visibility from the definition",
);
assert.match(
  editor,
  /requiresDashboardManagerRuntime\(jsonDefinition\)[\s\S]*?\? ' isVisible="false"'[\s\S]*?: ""/,
  "Editor saves must derive native visibility from the latest definition",
);
assert.match(
  homePage,
  /need those extensions are hidden[\s\S]*?native-only definitions remain available/,
  "Dashboard Manager help must explain conditional native visibility",
);

const selectAppOwnedIndexMacroNames = evaluateTypeScriptConst(
  setupTuner,
  "selectAppOwnedIndexMacroNames",
);
const effectiveMacros = [
  { name: "index_identity", acl: { app: "splunk-cisco-dashboards" } },
  { name: "index_dns_umbrella", acl: { app: "splunk-cisco-dashboards" } },
  { name: "index_network_ftd", acl: { app: "splunk-cisco-dashboards" } },
  { name: "index_thruput(1)", acl: { app: "splunk-cisco-dashboards" } },
  { name: "index_bad-name", acl: { app: "splunk-cisco-dashboards" } },
  { name: "index_time_delta", acl: { app: "SA-EndpointProtection" } },
  { name: "not_an_index_macro", acl: { app: "splunk-cisco-dashboards" } },
];
const routingMacroNames = selectAppOwnedIndexMacroNames(
  effectiveMacros,
  "splunk-cisco-dashboards",
);
assert.deepEqual(Array.from(routingMacroNames), [
  "index_dns_umbrella",
  "index_identity",
  "index_network_ftd",
]);
const buildIndexMacroOrClause = evaluateTypeScriptConst(
  setupTuner,
  "buildIndexMacroOrClause",
);
const routingPredicate = buildIndexMacroOrClause(routingMacroNames);
assert.match(routingPredicate, /`index_identity`/);
assert.match(routingPredicate, /`index_network_ftd`/);
assert.doesNotMatch(
  routingPredicate,
  /index_thruput|index_time_delta|\([^)]*\)/,
  "Generated routing SPL must never invoke parameterized or foreign macros",
);
const injectIndexMacroOrClause = evaluateTypeScriptConst(
  setupTuner,
  "injectIndexMacroOrClause",
  {
    buildIndexMacroOrClause,
    SCD_INDEX_MACRO_OR_PLACEHOLDER: "__SCD_INDEX_MACRO_OR__",
  },
);
const tuningSearchBlock = searchbase.match(
  /\[admin_macro_index_tuning\]([\s\S]*?)(?=\n\[[^\]]+\])/,
)?.[1];
assert.ok(tuningSearchBlock, "Searchbase must contain the setup tuning search");
const tuningTstatsLine = tuningSearchBlock.match(/\nsearch = ([^\n]+)\\\n/)?.[1];
assert.ok(tuningTstatsLine, "The setup tuning search must start with tstats");
const injectedTuningSearch = injectIndexMacroOrClause(
  tuningTstatsLine,
  routingMacroNames,
);
assert.doesNotMatch(injectedTuningSearch, /index_time_delta|index_thruput/);
assert.equal(
  Array.from(injectedTuningSearch).filter((character) => character === "(")
    .length,
  Array.from(injectedTuningSearch).filter((character) => character === ")")
    .length,
  "The generated tstats predicate must keep balanced parentheses",
);
assert.match(
  setupTuner,
  /selectAppOwnedIndexMacroNames\(entries \?\? \[\], APP_NAME\)/,
  "The effective macro inventory must be restricted to this app before dispatch",
);

const cleanIndexToken = evaluateTypeScriptConst(setupTuner, "cleanIndexToken");
const extractIndexTokens = evaluateTypeScriptConst(
  setupTuner,
  "extractIndexTokens",
  { cleanIndexToken },
);
const formatMacroDefinition = evaluateTypeScriptConst(
  setupTuner,
  "formatMacroDefinition",
  {
    cleanIndexToken,
    DEFAULT_INDEX_IN_DEFINITION: "index IN (*)",
    DEFAULT_INDEX_OR_DEFINITION: "(index=*)",
    DEFAULT_SOURCETYPE_IN_DEFINITION: "sourcetype IN (*)",
  },
);
const isPureIndexAllowlistDefinition = evaluateTypeScriptConst(
  setupTuner,
  "isPureIndexAllowlistDefinition",
);
const buildAdditiveCimDraftDefinition = evaluateTypeScriptConst(
  setupTuner,
  "buildAdditiveCimDraftDefinition",
  {
    cleanIndexToken,
    extractIndexTokens,
    formatMacroDefinition,
    isPureIndexAllowlistDefinition,
  },
);
assert.equal(
  buildAdditiveCimDraftDefinition("index IN (aci, nd)", ["aci"]),
  "index IN (aci, nd)",
  "A bounded CIM scan must not remove a saved but dormant index",
);
assert.equal(
  buildAdditiveCimDraftDefinition("(index=aci OR index=nd)", ["aci"]),
  "(index=aci OR index=nd)",
  "Discovery must not rewrite an equivalent saved definition when no index is new",
);
assert.equal(
  buildAdditiveCimDraftDefinition("index IN (aci)", ["cisco_ise", "aci"]),
  "index IN (aci, cisco_ise)",
  "CIM discovery must add newly detected indexes to the saved allowlist",
);
assert.equal(
  buildAdditiveCimDraftDefinition("index IN (*)", ["aci"]),
  "index IN (*)",
  "Discovery must preserve an explicit wildcard allowlist",
);
assert.equal(
  buildAdditiveCimDraftDefinition("custom_current_predicate", ["aci"]),
  "custom_current_predicate",
  "Discovery must not rewrite a non-standard current definition",
);
assert.equal(
  buildAdditiveCimDraftDefinition("index=aci sourcetype=cisco:ise:syslog", [
    "cisco_ise",
  ]),
  "index=aci sourcetype=cisco:ise:syslog",
  "Discovery must preserve non-index predicates in a custom definition",
);
const normalizeCimModelSelection = evaluateTypeScriptConst(
  setupTuner,
  "normalizeCimModelSelection",
);
const approvedCimMacros = [
  "cim_Alerts_indexes",
  "cim_Authentication_indexes",
  "cim_Network_Traffic_indexes",
];
assert.deepEqual(
  Array.from(
    normalizeCimModelSelection(approvedCimMacros, [
      "cim_Network_Traffic_indexes",
      "removed_model",
      "cim_Authentication_indexes",
      "cim_Authentication_indexes",
    ]),
  ),
  ["cim_Authentication_indexes", "cim_Network_Traffic_indexes"],
  "CIM selection must discard unknown values, deduplicate, and retain catalog order",
);
assert.deepEqual(
  Array.from(normalizeCimModelSelection(approvedCimMacros, [])),
  [],
  "An empty CIM selection must remain an explicit no-tuning choice",
);
const selectCimRowsByMacroNames = evaluateTypeScriptConst(
  setupTuner,
  "selectCimRowsByMacroNames",
);
const cimSelectionRows = [
  { macro: "cim_Alerts_indexes", changed: true },
  { macro: "cim_Authentication_indexes", changed: true },
  { macro: "cim_Network_Traffic_indexes", changed: false },
];
assert.deepEqual(
  Array.from(
    selectCimRowsByMacroNames(cimSelectionRows, [
      "cim_Authentication_indexes",
      "cim_Network_Traffic_indexes",
    ]),
    (row) => ({ ...row }),
  ),
  [
    { macro: "cim_Authentication_indexes", changed: true },
    { macro: "cim_Network_Traffic_indexes", changed: false },
  ],
  "Only explicitly selected CIM rows may reach the setup change derivation",
);
assert.deepEqual(
  Array.from(selectCimRowsByMacroNames(cimSelectionRows, [])),
  [],
  "Continuing without CIM tuning must produce no eligible CIM rows",
);
assert.match(
  setupTuner,
  /loadMacroDetailsByConfig\(\s*CIM_MACRO_CONFIGS,\s*\{ requireDefinitions: true \},\s*\)/,
  "CIM discovery must require a trustworthy saved-definition baseline",
);
const fallbackCatalogSource = setupTuner.match(
  /const FALLBACK_SCD_INDEX_MACRO_NAMES = \[([\s\S]*?)\] as const;/,
)?.[1];
assert.ok(fallbackCatalogSource, "Setup must retain a safe routing fallback");
const fallbackRoutingMacros = Array.from(
  fallbackCatalogSource.matchAll(/"(index_[A-Za-z0-9_]+)"/g),
  ([, name]) => name,
);
const configuredRoutingMacros = Array.from(
  defaultMacros.matchAll(/^\[(index_[A-Za-z0-9_]+)\]$/gm),
  ([, name]) => name,
).sort();
assert.deepEqual(
  fallbackRoutingMacros,
  configuredRoutingMacros,
  "The safe fallback must exactly match this app's shipped index macros",
);

const requirementsStart = setupTuner.indexOf(
  "const CORE_DATA_MODEL_REQUIREMENTS:",
);
const requirementsEnd = setupTuner.indexOf(
  "] as const;",
  requirementsStart,
);
assert.ok(
  requirementsStart >= 0 && requirementsEnd > requirementsStart,
  "Setup must declare its required data-model catalog",
);
const requirementsSource = setupTuner.slice(
  requirementsStart,
  requirementsEnd,
);
const requirementObjects =
  requirementsSource.match(/\n  \{[\s\S]*?\n  \},?/g) || [];
const dataModelRequirements = requirementObjects.map((source) => {
  const capabilitySource = source.match(
    /applicableCapabilities:\s*\[([^\]]*)\]/,
  )?.[1];
  const applicableCapabilities = capabilitySource
    ? Array.from(
        capabilitySource.matchAll(/"([^"]+)"/g),
        ([, capabilityId]) => capabilityId,
      )
    : undefined;
  return {
    key: source.match(/key:\s*"([^"]+)"/)?.[1],
    label: source.match(/label:\s*"([^"]+)"/)?.[1],
    app: source.match(/app:\s*([A-Z0-9_]+)/)?.[1],
    model: source.match(/model:\s*"([^"]+)"/)?.[1],
    priority: source.match(/priority:\s*"([^"]+)"/)?.[1],
    ...(applicableCapabilities ? { applicableCapabilities } : {}),
  };
});
assert.equal(dataModelRequirements.length, 13);

const dataCenterModels = dataModelRequirements
  .filter((requirement) =>
    requirement.applicableCapabilities?.includes("data-center"),
  )
  .map((requirement) => requirement.model);
assert.deepEqual(dataCenterModels, [
  "Cisco_DCN_Auth",
  "Cisco_DCN_Counters",
  "Cisco_DCN_Events",
  "Cisco_DCN_Fault",
  "Cisco_DCN_Health",
  "Cisco_DCN_Statistics",
  "Cisco_DCN_Systems",
  "Cisco_DCN_nexus_dashboard",
]);

const selectApplicableDataModelRequirements = evaluateTypeScriptConst(
  setupTuner,
  "selectApplicableDataModelRequirements",
);
const nonDataCenterCapabilities = new Set([
  "enterprise-networking",
  "identity",
  "security",
  "thousandeyes",
]);
const withoutDataCenterModels = selectApplicableDataModelRequirements(
  dataModelRequirements,
  nonDataCenterCapabilities,
);
assert.deepEqual(
  Array.from(withoutDataCenterModels, (requirement) => requirement.model),
  [
    "Cisco_Catalyst_App",
    "Cisco_Security",
    "Cisco_ThousandEyes",
    "Authentication",
    "Network_Traffic",
  ],
  "A completed discovery without DC evidence must omit every DC Networking model",
);

assert.deepEqual(
  Array.from(
    selectApplicableDataModelRequirements(
      dataModelRequirements,
      new Set(["identity"]),
    ),
    (requirement) => requirement.model,
  ),
  ["Cisco_Catalyst_App", "Authentication", "Network_Traffic"],
  "ISE identity data must require the Enterprise Networking model, not the Security model",
);
assert.deepEqual(
  Array.from(
    selectApplicableDataModelRequirements(
      dataModelRequirements,
      new Set(["security"]),
    ),
    (requirement) => requirement.model,
  ),
  ["Cisco_Security", "Authentication", "Network_Traffic"],
  "Security data must require the Cisco Security model and the CIM baseline",
);

const withDataCenterModels = selectApplicableDataModelRequirements(
  dataModelRequirements,
  new Set([...nonDataCenterCapabilities, "data-center"]),
);
assert.deepEqual(
  Array.from(
    withDataCenterModels.filter((requirement) =>
      requirement.applicableCapabilities?.includes("data-center"),
    ),
    (requirement) => requirement.model,
  ),
  dataCenterModels,
  "Detected DC evidence must retain all eight DC Networking models",
);
assert.deepEqual(
  Array.from(
    selectApplicableDataModelRequirements(dataModelRequirements, null),
    (requirement) => requirement.model,
  ),
  dataModelRequirements.map((requirement) => requirement.model),
  "Unavailable discovery evidence must preserve the conservative full catalog",
);
assert.match(
  setupBootstrap,
  /setupRoot\.dataset\.scdSetupDiscoveryState = errors\.data \? "error" : "ready";[\s\S]*?setupRoot\.dataset\.scdSetupDetectedCapabilities =\s*detectedCapabilityIds\.join\(","\);/,
  "Static discovery must bridge its completed capability evidence to React",
);
assert.match(
  setupTuner,
  /setupRoot\?\.dataset\.scdSetupDiscoveryState !== "ready"\) return null;[\s\S]*?setupRoot\.dataset\.scdSetupDetectedCapabilities/,
  "React must distinguish completed empty evidence from missing or failed discovery",
);
assert.match(
  setupTuner,
  /selectApplicableDataModelRequirements\(\s*CORE_DATA_MODEL_REQUIREMENTS,\s*setupMode \? readDetectedSetupCapabilityIds\(\) : null,\s*\)/,
  "The acceleration list must be derived from setup discovery evidence",
);
assert.match(
  setupTuner,
  /if \(!setupScanReady\) \{[\s\S]*?The routing scan must finish successfully before you continue\./,
  "Step 4 must not advance after a failed routing scan",
);
assert.match(
  setupTuner,
  /scanState === "error"[\s\S]*?Routing scan did not complete[\s\S]*?run the scan again before continuing/,
  "A failed Step 4 scan must never be announced as complete",
);
assert.match(
  setupTuner,
  /onClick=\{continueToCim\}[\s\S]*?aria-describedby="scd-routing-scan-guidance"/,
  "The Continue to CIM action must expose persistent routing-scan guidance",
);
assert.match(
  setupTuner,
  /const SETUP_ROUTE_GUARD_MESSAGE =\s*"Complete the routing scan before opening later setup steps\.";/,
  "The invalid-route guard must explain the prerequisite clearly",
);
assert.match(
  setupTuner,
  /!\["tune-cim", "review"\]\.includes\(setupRoute\)[\s\S]*?message: SETUP_ROUTE_GUARD_MESSAGE[\s\S]*?history\.replaceState\(null, "", "#tune-indexes"\)[\s\S]*?setSetupRoute\("tune-indexes"\)/,
  "Later setup hashes must return to Step 4 until routing is ready",
);
assert.match(
  setupTuner,
  /scanState !== "ready"\) return;[\s\S]*?current\.message === SETUP_ROUTE_GUARD_MESSAGE[\s\S]*?\{ state: "idle" \}/,
  "A successful routing scan must clear only stale route-guard feedback",
);
assert.match(
  setupTuner,
  /if \(integratedSetupView && scanState !== "ready"\) \{[\s\S]*?complete the routing scan before finishing setup/,
  "Direct navigation must not let integrated setup finish after a failed routing scan",
);
assert.match(
  setupTuner,
  /useState<string\[\]>\(\[\]\)[\s\S]*?label="Data models to tune"[\s\S]*?selectAllAppearance="checkbox"/,
  "Step 5 must begin with no selected CIM models and provide an accessible select-all picker",
);
assert.match(setupBootstrap, /"Tune CIM models"/);
assert.match(setupTuner, /"Tune CIM models"/);
const cimDiscoveryCatalog = setupTuner.match(
  /const CIM_DATA_MODEL_DISCOVERY_CONFIGS = \[([\s\S]*?)\] as const;/,
)?.[1];
assert.ok(cimDiscoveryCatalog, "The approved CIM discovery catalog must exist");
assert.equal(
  [...cimDiscoveryCatalog.matchAll(/model: "([^"]+)"/g)].length,
  22,
  "Step 5 must expose exactly the 22 approved CIM data models",
);
assert.doesNotMatch(
  cimDiscoveryCatalog,
  /cim_Application_State_indexes|model: "App"/,
  "The removed App data model must not remain discoverable or selectable",
);
assert.match(
  setupTuner,
  /<CollapsiblePanel\s+appearance="subtle"\s+defaultOpen[\s\S]*?title=\{setupCimReviewTitle\}/,
  "The selected-model review must be visible by default",
);
assert.match(
  setupTuner,
  /cimScanState === "ready"[\s\S]*?selectCimRowsByMacroNames\(\s*cimRows,\s*selectedSetupCimMacroNames,\s*\)[\s\S]*?const setupCimChangesToSave/,
  "Only explicitly selected rows from a completed CIM discovery may enter setup changes",
);
assert.match(
  setupTuner,
  /Discovery is read-only\.[\s\S]*?No model has been added to the draft plan yet\./,
  "Step 5 must explain that discovery does not automatically opt models into the draft plan",
);
assert.match(
  setupTuner,
  /label=\{[\s\S]*?Skip CIM tuning[\s\S]*?\}/,
  "An empty CIM selection must offer an explicit no-tuning continuation path",
);
assert.match(
  setupTuner,
  /for \(const row of setupCimChangesToSave\)/,
  "Final setup must save only the selected-scoped CIM change list",
);

console.log("Dashboard Manager visibility and setup regression checks passed.");
