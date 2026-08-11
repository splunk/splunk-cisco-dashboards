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
const themeHookPath = path.resolve(
  __dirname,
  "../src/main/webapp/common/hooks/useTheme.ts",
);
const shellThemePath = path.resolve(
  __dirname,
  "../src/main/webapp/common/theme/splunkShellTheme.ts",
);
const shellThemeStylesPath = path.resolve(
  __dirname,
  "../src/main/webapp/common/styles/splunkShellTheme.css",
);
const dashboardBuilderEntryPath = path.resolve(
  __dirname,
  "../src/main/webapp/pages/dashboardbuilder/index.jsx",
);
const viewsPath = path.resolve(
  __dirname,
  "../src/main/resources/splunk/default/data/ui/views",
);

const editor = fs.readFileSync(editorPath, "utf8");
const manager = fs.readFileSync(managerPath, "utf8");
const splunk = fs.readFileSync(splunkPath, "utf8");
const themeHook = fs.readFileSync(themeHookPath, "utf8");
const shellTheme = fs.readFileSync(shellThemePath, "utf8");
const shellThemeStyles = fs.readFileSync(shellThemeStylesPath, "utf8");
const dashboardBuilderEntry = fs.readFileSync(dashboardBuilderEntryPath, "utf8");

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
const modalThemeProvider = editor.indexOf(
  '<SplunkThemeProvider\n                family="prisma"\n                density="comfortable"\n                colorScheme={dashboardColorScheme}',
);
const firstEditorModal = editor.indexOf('<Modal\n                open={openConvertModal}');
assert.ok(
  modalThemeProvider !== -1 &&
    firstEditorModal !== -1 &&
    modalThemeProvider < firstEditorModal,
  "Dashboard Studio confirmation dialogs must inherit the saved dashboard theme",
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
  manager,
  /dashboardDescription,\s*["']{2},\s*["']dark["']/,
  "new Dashboard Manager dashboards must pair the factory C3 background with the dark theme",
);
assert.match(
  editor,
  /addDash\(dashid, JSON\.stringify\(jsonDefinition\), dashboardTitle, ["']{2}, ["']{2}, ["']dark["']\)/,
  "the Dashboard Manager editor fallback must create new dashboards with the dark theme",
);
assert.match(
  splunk,
  /theme="\$\{dashboardTheme\}"/,
  "Dashboard XML writes must use the requested normalized theme",
);

assert.match(
  shellTheme,
  /document\.documentElement\.setAttribute\(SPLUNK_SHELL_THEME_ATTRIBUTE, theme\)/,
  "The shared theme bridge must publish the resolved dashboard theme on the document root",
);
assert.match(
  themeHook,
  /syncSplunkShellTheme\(resolvedTheme\)/,
  "Theme-capable React dashboards must synchronize Splunk chrome with their resolved theme",
);
assert.match(
  editor,
  /syncSplunkShellTheme\(dashboardColorScheme\)/,
  "Dashboard Studio must synchronize Splunk chrome with the loaded dashboard theme",
);
assert.match(
  dashboardBuilderEntry,
  /splunkShellTheme\.css/,
  "Dashboard Studio must load the shared Splunk shell-theme overrides",
);
for (const resolvedTheme of ["light", "dark"]) {
  assert.match(
    shellThemeStyles,
    new RegExp(`html\\[data-scd-shell-theme=['"]${resolvedTheme}['"]\\]`),
    `The shell-theme stylesheet must define ${resolvedTheme} navigation overrides`,
  );
}

for (const viewFile of fs.readdirSync(viewsPath).filter((name) => name.endsWith(".xml"))) {
  const viewSource = fs.readFileSync(path.join(viewsPath, viewFile), "utf8");
  if (!/<dashboard\b[^>]*\bversion="2"/.test(viewSource)) continue;
  assert.match(
    viewSource,
    /<dashboard\b[^>]*\btheme="(?:light|dark)"/,
    `${viewFile} must declare the shell theme that matches its fixed Dashboard Studio canvas`,
  );
}

console.log("✓ Dashboard theme preservation regression test passed");
