"use strict";

const assert = require("assert").strict;
const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const packageRoot = path.resolve(__dirname, "..");
const modulePath = path.join(
  packageRoot,
  "src/main/webapp/common/lib/xmlCdata.ts",
);
const output = ts.transpileModule(fs.readFileSync(modulePath, "utf8"), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
  fileName: modulePath,
}).outputText;
const loadedModule = { exports: {} };
new Function(
  "exports",
  "module",
  "require",
  "__filename",
  "__dirname",
  output,
)(
  loadedModule.exports,
  loadedModule,
  require,
  modulePath,
  path.dirname(modulePath),
);

const { escapeCdata } = loadedModule.exports;
const cdataTerminatorEscape = "]]" + "]]><![CDATA[>";
const dashboardDefinition = JSON.stringify({
  title: "Safe title",
  description: "A literal CDATA terminator ]]> must remain dashboard text",
  nested: { label: "]]>" },
});

assert.equal(
  escapeCdata(dashboardDefinition),
  dashboardDefinition.replace(/]]>/g, cdataTerminatorEscape),
  "Every CDATA terminator must be split before JSON is inserted into XML",
);

for (const relativePath of [
  "src/main/webapp/common/lib/splunk.js",
  "src/main/webapp/pages/dashboardbuilder/DashboardStudioEditor.jsx",
]) {
  const source = fs.readFileSync(path.join(packageRoot, relativePath), "utf8");
  assert.match(
    source,
    /<!\[CDATA\[\$\{escapeCdata\(jsonDefinition\)\}\]\]><\/definition>/,
    `${relativePath} must escape JSON at the CDATA sink`,
  );
}
