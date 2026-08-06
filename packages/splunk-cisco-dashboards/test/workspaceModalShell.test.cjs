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
  "max-w-[840px]",
  "max-w-[1000px]",
]) {
  assert.ok(
    shell.includes(expectedClass),
    `Shared modal shell must include ${expectedClass}`,
  );
}

assert.match(
  shell,
  /bg-slate-950\/\[0\.56\][\s\S]*backdrop-blur-\[2px\]/,
  "Shared modal shell must use the approved 56% backdrop and 2px blur",
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
  "Detail drilldowns must use the compact variant and widen only for dense tables",
);

console.log("✓ Workspace modal shell design and accessibility tests passed");
