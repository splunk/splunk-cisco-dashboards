"use strict";

const assert = require("assert").strict;
const fs = require("fs");
const path = require("path");

const stylesPath = path.resolve(
  __dirname,
  "../src/main/webapp/common/styles/commonstyles.css",
);
const styles = fs.readFileSync(stylesPath, "utf8");
const wrapperSelector =
  "body > div[role='main'] > div:has(> #collection_container.dashboardbuilderview)";
const ruleStart = styles.indexOf(wrapperSelector);

assert.notEqual(ruleStart, -1, "Dashboard Builder wrapper rule must exist");

const declarationStart = styles.indexOf("{", ruleStart);
const declarationEnd = styles.indexOf("}", declarationStart);
const declarations = styles.slice(declarationStart + 1, declarationEnd);

assert.match(declarations, /min-width:\s*0\s*;/);
assert.match(declarations, /width:\s*100%\s*;/);
assert.match(declarations, /max-width:\s*100%\s*;/);
assert.doesNotMatch(declarations, /^\s*width:\s*0(?:px)?\s*;/m);

console.log("✓ Dashboard Builder shell-width regression test passed");
