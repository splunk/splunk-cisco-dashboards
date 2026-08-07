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
  /bg-slate-950\/\[0\.42\][\s\S]*backdrop-blur-md/,
  "Shared modal shell must use a translucent blurred backdrop",
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

console.log("✓ Workspace modal shell design and accessibility tests passed");
