"use strict";

const assert = require("assert").strict;
const fs = require("fs");
const path = require("path");

const stylesPath = path.resolve(
  __dirname,
  "../src/main/webapp/common/styles/commonstyles.css",
);
const styles = fs.readFileSync(stylesPath, "utf8");
const editorPath = path.resolve(
  __dirname,
  "../src/main/webapp/pages/dashboardbuilder/DashboardStudioEditor.jsx",
);
const editor = fs.readFileSync(editorPath, "utf8");
const insightKpiButtonPath = path.resolve(
  __dirname,
  "../src/main/webapp/pages/dashboardbuilder/InsightKpiButton.jsx",
);
const insightKpiButton = fs.readFileSync(insightKpiButtonPath, "utf8");
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

assert.match(editor, /\bZoom\b/);
assert.match(editor, /dashboardbuilder-display-button/);
assert.match(editor, /dashboardbuilder-actions-button/);
assert.match(editor, /dashboardbuilder-export-json-action/);
assert.match(editor, /dashboardbuilder-clone-action/);
assert.match(styles, /body\.dashboardbuilder-navigation-hidden header/);
assert.match(styles, /body\.dashboardbuilder-navigation-hidden nav/);
assert.match(insightKpiButton, /label="Add Searchbase"/);
assert.match(insightKpiButton, /ariaLabel="Add visualizations from Searchbase"/);
assert.match(insightKpiButton, /dashboardbuilder-searchbase-toolbar-control/);
assert.match(styles, /\.dashboardbuilder-searchbase-toolbar-control \[data-test='button'\]/);
assert.match(editor, /Editing a Searchbase-wired dashboard/);
assert.match(
  editor,
  /dashMode === 'edit' && dashboardUsesSearchbase && showEditContextNotice/,
);
assert.match(editor, /onRequestRemove=\{\(\) => setShowEditContextNotice\(false\)\}/);
assert.match(editor, /does\s+not make the dashboard deploy-anywhere/);
assert.match(editor, /Conversion does <b>not<\/b> package or remove environmental dependencies/);
assert.doesNotMatch(editor, /open it in Dashboard Studio from\s+any context/);

console.log(
  "✓ Dashboard Builder shell-width, toolbar, and edit-guidance regression tests passed",
);
