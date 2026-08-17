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
const entryPath = path.resolve(
  __dirname,
  "../src/main/webapp/pages/dashboardbuilder/index.jsx",
);
const entry = fs.readFileSync(entryPath, "utf8");
const managerPath = path.resolve(
  __dirname,
  "../src/main/webapp/pages/dashboardbuilder/DBHomePage.jsx",
);
const manager = fs.readFileSync(managerPath, "utf8");
const studioViewsPath = path.resolve(
  __dirname,
  "../src/main/resources/splunk/default/data/ui/views",
);
const secureNetworkingStudioViews = fs
  .readdirSync(studioViewsPath)
  .filter(
    (fileName) =>
      fileName.startsWith("sn_") &&
      fileName.endsWith(".xml") &&
      fileName !== "sn_topology_canvas.xml",
  )
  .map((fileName) => ({
    fileName,
    source: fs.readFileSync(path.join(studioViewsPath, fileName), "utf8"),
  }));
const drilldownModalPath = path.resolve(
  __dirname,
  "../src/main/webapp/pages/dashboardbuilder/DashboardStudioDrilldownModal.jsx",
);
const drilldownModal = fs.readFileSync(drilldownModalPath, "utf8");
const drilldownGuidancePath = path.resolve(
  __dirname,
  "../src/main/webapp/common/components/workspace/SearchbaseDrilldownGuidance.tsx",
);
const drilldownGuidance = fs.readFileSync(drilldownGuidancePath, "utf8");
const insightKpiButtonPath = path.resolve(
  __dirname,
  "../src/main/webapp/pages/dashboardbuilder/InsightKpiButton.jsx",
);
const insightKpiButton = fs.readFileSync(insightKpiButtonPath, "utf8");
const dropdownWithSearchPath = path.resolve(
  __dirname,
  "../src/main/webapp/pages/dashboardbuilder/DropdownWithSearch.jsx",
);
const dropdownWithSearch = fs.readFileSync(dropdownWithSearchPath, "utf8");
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

assert.match(editor, /const DASHBOARD_STUDIO_HEIGHT = 1200;/);
assert.match(
  editor,
  /const hideDashboardEdit = editedDefinition\?\.applicationProperties\?\.hideEdit \?\? true;/,
  "Dashboard Manager must default missing edit-visibility metadata to hidden",
);
assert.match(
  editor,
  /\{!hideDashboardEdit && <ModeSwitch key="modeSwitch" \/>\}/,
  "View mode must honor Dashboard Studio hideEdit metadata",
);
assert.doesNotMatch(editor, /dashboardbuilder-edit-disabled/);
assert.match(
  manager,
  /const buildDashboardStudioPath = \(dashboardId, mode = "view"\)/,
  "Dashboard Manager links must open Dashboard Studio in view mode",
);
assert.match(manager, /: `\/\$\{encodedDashboardId\}`;/);
assert.match(manager, /navigate\(buildDashboardStudioPath\(dash\.title, "edit"\)\);/);
assert.match(entry, /<Route path=":dashboardid\/:currentmode"/);
assert.ok(secureNetworkingStudioViews.length > 0);
secureNetworkingStudioViews.forEach(({ fileName, source: studioView }) => {
  assert.match(
    studioView,
    /"applicationProperties"\s*:\s*\{[\s\S]*?"hideEdit"\s*:\s*true/,
    `${fileName} must hide the View-mode Edit control by default`,
  );
});
assert.match(
  editor,
  /const embeddedDashboardHeight = embededMode \? '100%' : DASHBOARD_STUDIO_HEIGHT;/,
);
assert.match(editor, /height=\{DASHBOARD_STUDIO_HEIGHT\}/);
assert.doesNotMatch(editor, /height=["']1200["']/);
assert.match(
  entry,
  /import 'monaco-editor\/esm\/vs\/editor\/contrib\/find\/browser\/findController\.js';/,
  "Dashboard Builder must register Monaco's focused find and replace contribution",
);
assert.doesNotMatch(
  entry,
  /monaco-editor\/esm\/vs\/editor\/(?:editor\.all|edcore\.main)/,
  "Dashboard Builder must not load Monaco's full editor contribution bundle",
);

assert.match(editor, /\bZoom\b/);
assert.match(editor, /dashboardbuilder-display-button/);
assert.match(editor, /dashboardbuilder-actions-button/);
assert.match(editor, /dashboardbuilder-export-json-action/);
assert.match(editor, /dashboardbuilder-clone-action/);
assert.match(
  editor,
  /dashMode === 'edit' && dashboardUsesSearchbase[\s\S]*?\? 'editconvert'[\s\S]*?: dashMode \|\| 'view'/,
  "Searchbase dashboards must not receive the edit toolbar while in view mode",
);
assert.match(editor, /if \(\(dashMode \?\? 'view'\) === 'view' && isDashboardMounted\) \{/);
assert.match(editor, /apiRef\?\.collapseToolbar\?\.\(\);/);
assert.match(editor, /\[apiRef, dashID, dashMode, isDashboardMounted\]/);
assert.match(styles, /body\.dashboardbuilder-navigation-hidden header/);
assert.match(styles, /body\.dashboardbuilder-navigation-hidden nav/);
assert.match(insightKpiButton, /label="Add Searchbase"/);
assert.match(insightKpiButton, /ariaLabel="Add Searchbase searches"/);
assert.doesNotMatch(insightKpiButton, /@splunk\/react-ui\/Tooltip/);
assert.doesNotMatch(insightKpiButton, /dashboardbuilder-searchbase-toolbar-tooltip/);
assert.match(insightKpiButton, /import Layout from '@splunk\/react-ui\/Layout'/);
assert.match(insightKpiButton, /import Typography from '@splunk\/react-ui\/Typography'/);
assert.match(insightKpiButton, /color="inherit"/);
assert.match(insightKpiButton, /<Layout>/);
assert.match(insightKpiButton, /<Typography[\s\S]*?as="span"/);
assert.match(insightKpiButton, /describedBy=\{helpTextId\}/);
assert.match(
  insightKpiButton,
  /Browse reusable, centrally managed searches from the Cisco Searchbase catalogue\./,
);
assert.match(dropdownWithSearch, /aria-describedby=\{describedBy\}/);
assert.doesNotMatch(insightKpiButton, /Add visualizations from Searchbase/);
assert.match(insightKpiButton, /dashboardbuilder-searchbase-toolbar-control/);
assert.match(styles, /\.dashboardbuilder-searchbase-toolbar-control \[data-test='button'\]/);
assert.match(editor, /Editing a Searchbase-wired dashboard/);
assert.match(editor, /onLinkToUrl: handleDashboardLinkToUrl/);
assert.match(editor, /<DashboardStudioDrilldownModal/);
assert.match(editor, /ownerApp=\{currentDashboard\?\.app\}/);
assert.match(editor, /response\.entry\[0\]\.acl\?\.app/);
assert.match(manager, /initialDashboard=\{selectedDash\}/);
assert.match(editor, /dashboard-builder-drilldown-open/);
assert.match(styles, /dashboard-builder-drilldown-open[\s\S]*?z-index:\s*100003/);
assert.match(editor, /initialDefinition=\{runtimeDashboardDefinition\}/);
assert.match(drilldownModal, /getDashboardDrilldownMetadata/);
assert.match(drilldownModal, /activeMetadata\.category/);
assert.match(drilldownModal, /activeMetadata\.subCategory/);
assert.match(drilldownModal, /dashboard-builder-drilldown-classification/);
assert.match(drilldownModal, /<Search size=\{20\} aria-hidden="true"/);
assert.match(
  drilldownModal,
  /<WorkspaceModalShell[\s\S]*?variant="detail"/,
);
assert.match(
  drilldownModal,
  /openInSearchHref=\{activeSearchUrl \|\| undefined\}/,
);
assert.match(
  drilldownModal,
  /openInSearchbaseHref=\{[\s\S]*?splunkSearchbaseEditUrl\(activeSearch\.name\)/,
);
assert.match(drilldownModal, /renderInDocumentBody/);
assert.match(
  drilldownModal,
  /<DashboardCore width="100%" height=\{DRILLDOWN_RESULT_HEIGHT\}/,
);
assert.match(
  styles,
  /\.dashboard-builder-drilldown-result-shell \{[\s\S]*?min-height:\s*340px;/,
);
assert.match(
  styles,
  /\.dashboard-builder-drilldown-dashboard \{[\s\S]*?height:\s*340px;/,
);
assert.match(
  styles,
  /\[data-searchbase-drilldown-guidance='workspace'\] code \{[\s\S]*?background:\s*rgba\(2, 44, 34, 0\.72\);[\s\S]*?color:\s*#a7f3d0;[\s\S]*?font-family:\s*ui-monospace[^;]*!important/,
);
assert.match(styles, /\.dashboard-builder-drilldown-classification/);
assert.match(
  styles,
  /dashboard-builder-themed-modal-dark \.dashboard-builder-drilldown-classification/,
);
assert.match(drilldownModal, />\s*Back\s*</);
assert.match(drilldownModal, />\s*Forward\s*</);
assert.match(
  drilldownModal,
  /<SearchbaseDrilldownGuidance[\s\S]*appearance="workspace"/,
);
assert.match(drilldownGuidance, /title="Description"/);
assert.match(drilldownGuidance, /title="Explanation"/);
assert.match(drilldownGuidance, /title="Solution"/);
assert.match(drilldownGuidance, /title="Related information"/);
assert.match(drilldownModal, /Generate a Dashboard/);
assert.match(drilldownModal, /DOMPurify\.sanitize/);
assert.equal(
  (drilldownModal.match(/<DashboardCore/g) || []).length,
  1,
  "Only the active drilldown search may be mounted and dispatched",
);
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
