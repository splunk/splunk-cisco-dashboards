"use strict";

const assert = require("assert").strict;
const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const helperPath = path.resolve(
  __dirname,
  "../src/main/webapp/common/lib/appVersion.ts",
);
const helperSource = fs.readFileSync(helperPath, "utf8");
const helperOutput = ts.transpileModule(helperSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
  fileName: helperPath,
}).outputText;
const helperModule = { exports: {} };
const loadHelper = new Function(
  "exports",
  "module",
  "require",
  "__filename",
  "__dirname",
  helperOutput,
);
loadHelper(
  helperModule.exports,
  helperModule,
  require,
  helperPath,
  path.dirname(helperPath),
);

const { compareAppVersions, resolveAppVersions } = helperModule.exports;

assert.equal(compareAppVersions("3.2.42", "3.2.41"), 1);
assert.equal(compareAppVersions("3.10.0", "3.9.99"), 1);
assert.equal(compareAppVersions("3.2.42", "3.2.42.0"), 0);
assert.equal(compareAppVersions("3.2.42-rc.2", "3.2.42"), -1);
assert.equal(compareAppVersions("3.2.42-rc.2", "3.2.42-rc.1"), 1);
assert.equal(compareAppVersions("development", "3.2.42"), null);

assert.deepEqual(
  resolveAppVersions({
    installedVersion: "3.2.42",
    updateVersion: "3.2.41",
  }),
  { version: "3.2.42", updateVersion: "" },
);
assert.deepEqual(
  resolveAppVersions({
    installedVersion: "3.2.41",
    updateVersion: "3.2.42",
  }),
  { version: "3.2.41", updateVersion: "3.2.42" },
);
assert.deepEqual(
  resolveAppVersions({
    installedVersion: "3.2.42",
    updateVersion: "3.2.42",
  }),
  { version: "3.2.42", updateVersion: "" },
);

console.log("✓ app version comparison tests passed");
