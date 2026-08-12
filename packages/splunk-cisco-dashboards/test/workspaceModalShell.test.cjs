"use strict";

const assert = require("assert").strict;
const fs = require("fs");
const path = require("path");

const read = (relativePath) =>
  fs.readFileSync(path.resolve(__dirname, relativePath), "utf8");

const shell = read(
  "../src/main/webapp/common/components/workspace/WorkspaceModalShell.tsx",
);
const metricItem = read(
  "../src/main/webapp/common/components/workspace/MetricItem.tsx",
);
const chartFocus = read(
  "../src/main/webapp/common/components/workspace/ChartFocusDialog.tsx",
);
const searchbaseGuidance = read(
  "../src/main/webapp/common/components/workspace/SearchbaseDrilldownGuidance.tsx",
);
const kpiPicker = read(
  "../src/main/webapp/common/components/workspace/KpiPickerPanel.tsx",
);
const dashboardManagerDrilldown = read(
  "../src/main/webapp/pages/dashboardbuilder/DashboardStudioDrilldownModal.jsx",
);
const searchbaseCatalogue = read(
  "../src/main/webapp/common/services/searchbaseCatalogue.ts",
);
const profile = read("../src/main/webapp/pages/executive_insights/index.tsx");

for (const expectedClass of [
  "max-w-[880px]",
  "max-w-[960px]",
  "max-w-[1120px]",
  "max-w-[1320px]",
]) {
  assert.ok(
    shell.includes(expectedClass),
    `Shared modal shell must include ${expectedClass}`,
  );
}

assert.match(
  shell,
  /DEFAULT_BACKDROP_OPACITY = 16;[\s\S]*backdrop-blur-\[2px\][\s\S]*backgroundColor: `rgba\(2, 6, 23, \$\{backdropOpacity \/ 100\}\)`/,
  "Shared modal shell must keep the workspace clearly recognizable behind the dialog",
);
assert.match(
  shell,
  /aria-label="Backdrop opacity"[\s\S]*aria-valuetext=\{`\$\{backdropOpacity\}% opaque`\}/,
  "Shared modal shell must expose an accessible backdrop-opacity control",
);
assert.match(
  shell,
  /min=\{MIN_BACKDROP_OPACITY\}[\s\S]*max=\{MAX_BACKDROP_OPACITY\}[\s\S]*step=\{1\}/,
  "Backdrop opacity must support the full zero-to-100 percent range",
);
assert.match(
  shell,
  /onInput=\{updateBackdropOpacity\}/,
  "Backdrop opacity must update continuously while the range is dragged",
);
assert.match(
  shell,
  /localStorage\.getItem\(BACKDROP_OPACITY_STORAGE_KEY\)[\s\S]*localStorage\.setItem\(BACKDROP_OPACITY_STORAGE_KEY, String\(value\)\)/,
  "Backdrop opacity must persist across workspace dialogs",
);
assert.match(
  shell,
  /data-workspace-modal-backdrop="true"[\s\S]*data-backdrop-opacity=\{backdropOpacity\}/,
  "The live backdrop must expose its configured opacity for verification",
);
assert.match(
  shell,
  /renderInDocumentBody[\s\S]*?\? document\.body[\s\S]*?document\.getElementById\('scan-root'\)/,
  "The shared shell must support document-level portals for transformed Dashboard Studio canvases",
);
assert.match(
  shell,
  /renderInDocumentBody \? \([\s\S]*?<div id="scan-root" data-workspace-modal-portal="document">/,
  "Document-level portals must recreate the scoped Tailwind root used by the shared shell",
);
assert.match(
  shell,
  /rounded-\[4px\][\s\S]*sui-border-weak[\s\S]*sui-bg-section[\s\S]*sui-color-active[\s\S]*sui-shadow-overlay[\s\S]*backdrop-blur-\[75px\]/,
  "Shared modal shell must use semantic SUI surface, border, text, and elevation tokens",
);
assert.match(
  shell,
  /sui-shadow-overlay/,
  "Shared modal shell must use the SUI overlay elevation token",
);
for (const accessibleResizeLabel of [
  "Resize dialog width",
  "Resize dialog height",
  "Resize dialog width and height",
]) {
  assert.ok(
    shell.includes(`aria-label="${accessibleResizeLabel}"`),
    `Detail dialogs must expose the ${accessibleResizeLabel.toLowerCase()} control`,
  );
}
assert.match(
  shell,
  /onDoubleClick=\{resetAutoSize\}/,
  "Resizable detail dialogs must offer a quick return to automatic sizing",
);
assert.match(
  shell,
  /event\.shiftKey \? 48 : 16/,
  "Resize controls must support precise and accelerated keyboard resizing",
);
assert.match(
  shell,
  /event\.key !== 'Tab'[\s\S]*first[\s\S]*last\.focus\(\)/,
  "Shared modal shell must trap keyboard focus",
);
assert.match(
  shell,
  /tabIndex=\{-1\}[\s\S]*aria-hidden="true"[\s\S]*absolute inset-0/,
  "The pointer-only modal backdrop must stay out of the accessibility tree",
);
assert.match(
  shell,
  /previouslyFocused\?\.isConnected[\s\S]*previouslyFocused\.focus/,
  "Shared modal shell must restore focus after closing",
);
assert.match(
  metricItem,
  /<WorkspaceModalShell[\s\S]*?variant="metric"/,
  "Time-series metric expansion must use the metric-focus variant",
);
assert.match(
  chartFocus,
  /<WorkspaceModalShell[\s\S]*?variant="chart"/,
  "Categorical chart expansion must use the chart-focus variant",
);
assert.match(
  profile,
  /<WorkspaceModalShell[\s\S]*?variant="detail"[\s\S]*?wide=\{displayColumns\.length > 5\}/,
  "Detail drilldowns must auto-widen further for dense tables",
);
assert.match(
  profile,
  /searchbaseId: detail\.id[\s\S]*openInSearchHref=\{searchUrl\}[\s\S]*openInSearchbaseHref=\{searchbaseUrl\}/,
  "Detail drilldowns must expose both Search and Searchbase destinations",
);
assert.match(
  profile,
  /data-detail-search-summary="true"\s*>\s*<div className="min-w-0 flex-1">/,
  "The non-interactive detail summary must not show a misleading search icon",
);
assert.match(
  shell,
  /openInSearchbaseHref[\s\S]*Open \$\{title\} in Searchbase[\s\S]*Searchbase[\s\S]*\{searchAction\}[\s\S]*\{searchbaseAction\}/,
  "The shared modal shell must place Searchbase beside Search",
);
assert.match(
  kpiPicker,
  /data-current-search-actions="true"[\s\S]*View in Searchbase[\s\S]*Test in Search/,
  "Configure Tile must keep the bound search's learning and test actions permanently visible",
);
assert.match(
  kpiPicker,
  /DRILLDOWN_TARGET_LIMIT = 24[\s\S]*useState<\s*string\[\]\s*>\(\[\]\)[\s\S]*Navigation order/,
  "Configure Tile must author an ordered and bounded multi-search drilldown workflow",
);
assert.match(
  kpiPicker,
  /drilldownSearchNames: drilldownChanged \? nextDrilldowns : undefined/,
  "Configure Tile must persist the complete ordered drilldown target list",
);
for (const stateTitle of [
  "Loading details",
  "Details unavailable",
  "No results in this time range",
]) {
  assert.ok(
    profile.includes(`title="${stateTitle}"`),
    `Every detail drilldown must use the shared ${stateTitle.toLowerCase()} state`,
  );
}
assert.match(
  profile,
  /kind === "error" \? "alert" : "status"[\s\S]*aria-live=/,
  "Detail drilldown states must announce loading, empty, and failure changes accessibly",
);
assert.ok(
  profile.includes("Try a wider range or open the query in Search."),
  "Empty drilldowns must offer a consistent recovery action",
);

assert.match(
  dashboardManagerDrilldown,
  /<WorkspaceModalShell[\s\S]*openInSearchHref=\{activeSearchUrl \|\| undefined\}[\s\S]*openInSearchbaseHref=[\s\S]*renderInDocumentBody/,
  "Dashboard Manager drilldowns must use the same shared shell and header actions as Insights Workspace",
);
assert.match(
  dashboardManagerDrilldown,
  /import '\.\.\/\.\.\/common\/styles\/tailwind\.css';/,
  "Dashboard Manager must load the shared shell's scoped utility styles",
);
assert.match(
  dashboardManagerDrilldown,
  /<SearchbaseDrilldownGuidance[\s\S]*metadata=\{activeMetadata\}[\s\S]*appearance="workspace"/,
  "Dashboard Manager must use the shared Insights Workspace guidance treatment",
);
assert.match(
  profile,
  /<SearchbaseDrilldownGuidance[\s\S]*metadata=\{activeConfig\.metadata\}[\s\S]*appearance="workspace"/,
  "Insights Workspace must use the same Searchbase guidance contract",
);
assert.match(
  profile,
  /\{activeConfig\.metadata\.title\}[\s\S]*activeClassification\.join\(" • "\)/,
  "Workspace drilldowns must identify the active target and its category metadata",
);
assert.match(
  profile,
  /aria-label="Drilldown search navigation"[\s\S]*Back[\s\S]*\{activeIndex \+ 1\} \/ \{config\.targets\.length\}[\s\S]*Forward/,
  "Insights Workspace must expose Dashboard Manager-style Back and Forward target navigation",
);
assert.match(
  profile,
  /const activeConfig = config\.targets\[activeIndex\][\s\S]*runSearch\(\{[\s\S]*spl: activeConfig\.spl/,
  "Insights Workspace must dispatch only the active drilldown target",
);
for (const metadataField of [
  "description",
  "explanation",
  "solution",
  "relatedInfo",
  "executionPlan",
]) {
  assert.ok(
    searchbaseGuidance.includes(metadataField),
    `Shared guidance must render bounded ${metadataField} metadata`,
  );
}
assert.match(
  searchbaseGuidance,
  /DOMPurify\.sanitize[\s\S]*aria-expanded=\{expanded\}/,
  "Workspace guidance must sanitize Searchbase HTML and remain collapsible",
);
assert.match(
  searchbaseGuidance,
  /querySelectorAll<HTMLAnchorElement>\('a\[href\]'\)[\s\S]*setAttribute\('target', '_blank'\)[\s\S]*setAttribute\('rel', 'noopener noreferrer'\)/,
  "Every link in every Searchbase metadata field must open safely in a new tab",
);
assert.match(
  searchbaseGuidance,
  /sui-guidance-content[\s\S]*?\[&_code\]:font-mono/,
  "Workspace guidance must render inline SPL as high-contrast code instead of red prose",
);
assert.match(
  searchbaseGuidance,
  /expanded \? 'flex min-h-\[120px\] flex-1 flex-col'[\s\S]*min-h-0 flex-1 grid-cols-1/,
  "Expanded workspace guidance must use the remaining dialog height",
);
assert.doesNotMatch(
  searchbaseGuidance,
  /\b(?:fetch|runSearch|getSearchbaseCatalogue)\s*\(/,
  "Shared guidance must never fetch metadata or dispatch a second search",
);
assert.match(
  searchbaseCatalogue,
  /execution_plan\?: string;[\s\S]*executionPlan:[\s\S]*content\.execution_plan/,
  "The Searchbase catalogue must expose execution-plan guidance",
);

const detailModalStart = profile.indexOf(
  "const MetricDetailTableModal: React.FC<MetricDetailTableModalProps>",
);
const detailModalEnd = profile.indexOf(
  "// Section title editor",
  detailModalStart,
);
const detailModal = profile.slice(detailModalStart, detailModalEnd);
assert.equal(
  (detailModal.match(/runSearch\(\{/g) ?? []).length,
  1,
  "A visible Workspace drilldown must dispatch exactly one supporting search",
);
assert.match(
  detailModal,
  /const controller = new AbortController\(\)[\s\S]*count: 1000,[\s\S]*signal: controller\.signal[\s\S]*controller\.abort\(\)/,
  "Workspace drilldowns must cap results and cancel obsolete dispatches",
);
assert.match(
  detailModal,
  /max-h-\[min\(46vh,520px\)\][\s\S]*data-detail-results-region="content-aware"/,
  "Detail results must follow their content height and cap large tables without hiding guidance",
);

console.log("✓ Workspace modal shell design and accessibility tests passed");
