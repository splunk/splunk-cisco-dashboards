"use strict";

const assert = require("assert").strict;
const fs = require("fs");
const path = require("path");

const read = (relativePath) =>
  fs.readFileSync(path.resolve(__dirname, relativePath), "utf8");

const shell = read(
  "../src/main/webapp/common/components/florida/WorkspaceModalShell.tsx",
);
const metricItem = read(
  "../src/main/webapp/common/components/florida/MetricItem.tsx",
);
const chartFocus = read(
  "../src/main/webapp/common/components/florida/ChartFocusDialog.tsx",
);
const searchbaseGuidance = read(
  "../src/main/webapp/common/components/florida/SearchbaseDrilldownGuidance.tsx",
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
  /rounded-\[4px\][\s\S]*border-white\/\[0\.18\][\s\S]*rgba\(255,255,255,0\.01\)[\s\S]*rgba\(90,101,111,0\.45\)[\s\S]*rgba\(62,73,83,0\.25\)[\s\S]*backdrop-blur-\[75px\]/,
  "Shared modal shell must follow the SUI glass radius, border, tint, and blur treatment",
);
assert.match(
  shell,
  /0_50px_200px[\s\S]*0_29px_66px[\s\S]*inset_0_1px_4px/,
  "Shared modal shell must preserve the SUI layered modal shadow stack",
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
  /<SearchbaseDrilldownGuidance[\s\S]*metadata=\{activeMetadata\}[\s\S]*appearance="manager"/,
  "Dashboard Manager must use the shared Searchbase guidance contract",
);
assert.match(
  profile,
  /<SearchbaseDrilldownGuidance[\s\S]*metadata=\{config\.metadata\}[\s\S]*appearance="workspace"/,
  "Insights Workspace must use the same Searchbase guidance contract",
);
assert.match(
  profile,
  /\{config\.metadata\.title\}[\s\S]*activeClassification\.join\(" • "\)/,
  "Workspace drilldowns must identify the active target and its category metadata",
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
  /DOMPurify\.sanitize[\s\S]*aria-expanded=\{expanded\}[\s\S]*max-h-\[220px\]/,
  "Workspace guidance must sanitize Searchbase HTML and remain collapsible and bounded",
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

console.log("✓ Workspace modal shell design and accessibility tests passed");
