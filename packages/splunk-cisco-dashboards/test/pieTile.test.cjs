"use strict";

const assert = require("assert").strict;
const fs = require("fs");
const path = require("path");

const pieTilePath = path.resolve(
  __dirname,
  "../src/main/webapp/common/components/florida/PieTile.tsx",
);
const profilePath = path.resolve(
  __dirname,
  "../src/main/webapp/pages/executive_insights/index.tsx",
);
const chartFocusPath = path.resolve(
  __dirname,
  "../src/main/webapp/common/components/florida/ChartFocusDialog.tsx",
);
const modalShellPath = path.resolve(
  __dirname,
  "../src/main/webapp/common/components/florida/WorkspaceModalShell.tsx",
);
const barBreakdownPath = path.resolve(
  __dirname,
  "../src/main/webapp/common/components/florida/BarBreakdownTile.tsx",
);

const pieTile = fs.readFileSync(pieTilePath, "utf8");
const profile = fs.readFileSync(profilePath, "utf8");
const chartFocus = fs.readFileSync(chartFocusPath, "utf8");
const modalShell = fs.readFileSync(modalShellPath, "utf8");
const barBreakdown = fs.readFileSync(barBreakdownPath, "utf8");

assert.match(
  pieTile,
  /import StudioPie from '@splunk\/visualizations\/Pie'/,
  "Pie tiles must use the Dashboard Studio pie renderer",
);
assert.doesNotMatch(
  pieTile,
  /from 'recharts'/,
  "Pie tiles must not fall back to the compact Recharts renderer",
);
assert.match(
  pieTile,
  /labelDisplay:\s*'valuesAndPercentage'/,
  "Pie slices must show values and percentages",
);
assert.match(
  pieTile,
  /percentagePrecision:\s*1/,
  "Pie percentages must use a readable precision",
);
assert.match(
  pieTile,
  /title=\{`Expand \$\{label\}`\}/,
  "Pie charts must use an explicit expand action",
);
assert.match(
  barBreakdown,
  /title=\{`Expand \$\{label\}`\}/,
  "Bar breakdown charts must use an explicit expand action",
);
assert.match(
  modalShell,
  /role="dialog"[\s\S]*?aria-modal="true"/,
  "Expanded charts must use the shared accessible modal dialog shell",
);
assert.match(
  chartFocus,
  /variant="chart"/,
  "Expanded categorical charts must use the chart-focus size variant",
);
assert.doesNotMatch(
  pieTile,
  /HoverZoomFrame|onPointerEnter|Hover to enlarge/,
  "Pie charts must not enlarge automatically on hover",
);
assert.doesNotMatch(
  barBreakdown,
  /HoverZoomFrame|onPointerEnter|Hover to enlarge/,
  "Bar breakdown charts must not enlarge automatically on hover",
);
assert.match(
  profile,
  /isDark=\{resolvedTheme === "dark"\}/,
  "The profile must pass its theme into native Studio charts",
);

console.log(
  "✓ Native pie, chart labels, theme, and explicit expansion regression tests passed",
);
