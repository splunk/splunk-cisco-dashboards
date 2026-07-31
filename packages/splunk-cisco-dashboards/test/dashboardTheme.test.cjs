"use strict";

const assert = require("assert").strict;
const fs = require("fs");
const path = require("path");

const editorPath = path.resolve(
  __dirname,
  "../src/main/webapp/pages/dashboardbuilder/DashboardStudioEditor.jsx",
);
const managerPath = path.resolve(
  __dirname,
  "../src/main/webapp/pages/dashboardbuilder/DBHomePage.jsx",
);
const splunkPath = path.resolve(
  __dirname,
  "../src/main/webapp/common/lib/splunk.js",
);

const editor = fs.readFileSync(editorPath, "utf8");
const manager = fs.readFileSync(managerPath, "utf8");
const splunk = fs.readFileSync(splunkPath, "utf8");

assert.match(
  editor,
  /const dashboardColorScheme = normalizeDashboardTheme\(\s*currentDashboard\?\.theme,\s*dashboardBuilderColorScheme,?\s*\)/,
  "Dashboard Studio must prefer the saved dashboard theme over the user theme",
);
assert.match(
  editor,
  /<SplunkThemeProvider[\s\S]*?colorScheme=\{dashboardColorScheme\}/,
  "The embedded Dashboard Studio theme provider must receive the dashboard theme",
);
assert.match(
  editor,
  /ignoreAttributes:\s*false,[\s\S]*?attributeNamePrefix:\s*''/,
  "Dashboard XML parsing must retain the theme attribute",
);
assert.match(
  editor,
  /theme:\s*normalizeDashboardTheme\(jObj\.dashboard\.theme\)/,
  "Loaded dashboard records must retain the saved theme",
);
assert.match(
  editor,
  /currentDashboard\.tag,\s*dashboardColorScheme,\s*\)/,
  "Dashboard saves must preserve the effective dashboard theme",
);
assert.match(
  manager,
  /theme:\s*normalizeDashboardTheme\(jObj\.dashboard\.theme\)/,
  "Dashboard Manager records must retain the saved theme",
);
assert.match(
  manager,
  /dashboardMetadataTarget\.theme/,
  "Metadata saves must preserve the saved dashboard theme",
);
assert.match(
  splunk,
  /theme="\$\{dashboardTheme\}"/,
  "Dashboard XML writes must use the requested normalized theme",
);

console.log("✓ Dashboard theme preservation regression test passed");
