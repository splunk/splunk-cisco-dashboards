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

console.log("Dashboard Manager visibility checks passed.");
