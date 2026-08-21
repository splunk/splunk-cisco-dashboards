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

const macroLoader = readTopLevelConst(setupTuner, "loadScdIndexMacroNames");
const indexMacroPatternLiteral = macroLoader.match(
  /\.filter\(\(name\) => (\/\^index_[^\n]+?\/)\.test\(name\)\)/,
)?.[1];
assert.ok(
  indexMacroPatternLiteral,
  "Setup routing discovery must use an anchored zero-argument index-macro filter",
);
const indexMacroPattern = vm.runInNewContext(indexMacroPatternLiteral);
const effectiveMacroNames = [
  "index_identity",
  "index_thruput(1)",
  "index_catalyst",
  "index_bad-name",
  "not_an_index_macro",
];
const routingMacroNames = effectiveMacroNames.filter((name) =>
  indexMacroPattern.test(name),
);
assert.deepEqual(routingMacroNames, ["index_identity", "index_catalyst"]);
const buildIndexMacroOrClause = evaluateTypeScriptConst(
  setupTuner,
  "buildIndexMacroOrClause",
);
const routingPredicate = buildIndexMacroOrClause(routingMacroNames);
assert.match(routingPredicate, /`index_identity`/);
assert.match(routingPredicate, /`index_catalyst`/);
assert.doesNotMatch(
  routingPredicate,
  /index_thruput|\([^)]*\)/,
  "Generated routing SPL must never invoke parameterized helper macros",
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

console.log("Dashboard Manager visibility and setup regression checks passed.");
