"use strict";

const assert = require("assert").strict;
const fs = require("fs");
const path = require("path");

const pieTilePath = path.resolve(
  __dirname,
  "../src/main/webapp/common/components/workspace/PieTile.tsx",
);
const profilePath = path.resolve(
  __dirname,
  "../src/main/webapp/pages/executive_insights/index.tsx",
);
const chartFocusPath = path.resolve(
  __dirname,
  "../src/main/webapp/common/components/workspace/ChartFocusDialog.tsx",
);
const modalShellPath = path.resolve(
  __dirname,
  "../src/main/webapp/common/components/workspace/WorkspaceModalShell.tsx",
);
const barBreakdownPath = path.resolve(
  __dirname,
  "../src/main/webapp/common/components/workspace/BarBreakdownTile.tsx",
);

const pieTile = fs.readFileSync(pieTilePath, "utf8");
const profile = fs.readFileSync(profilePath, "utf8");
const chartFocus = fs.readFileSync(chartFocusPath, "utf8");
const modalShell = fs.readFileSync(modalShellPath, "utf8");
const barBreakdown = fs.readFileSync(barBreakdownPath, "utf8");

assert.match(
  pieTile,
  /React\.lazy\(\(\) => import\('@splunk\/visualizations\/Bar'\)\)/,
  "Legacy pie catalogue entries must lazy-load the Dashboard Studio bar renderer",
);
assert.match(
  pieTile,
  /<React\.Suspense fallback=\{<ChartLoadingState \/>\}>/,
  "The optional native chart bundle must have a deterministic loading state",
);
assert.doesNotMatch(
  pieTile,
  /from 'recharts'/,
  "Composition tiles must not fall back to the compact Recharts renderer",
);
assert.match(
  pieTile,
  /dataValuesDisplay:\s*'all'/,
  "Composition bars must show their values",
);
assert.match(
  pieTile,
  /x:\s*'> primary \| seriesByIndex\(0\)'/,
  "Composition bars must bind the category series explicitly",
);
assert.match(
  pieTile,
  /y:\s*'> primary \| seriesByIndex\(1\)'/,
  "Composition bars must bind the numeric series explicitly",
);
assert.match(
  pieTile,
  /onExpand=\{hasData \? \(\) => setIsFocusOpen\(true\) : undefined\}/,
  "Composition charts must expose expand through the tile action menu",
);
assert.match(
  barBreakdown,
  /onExpand=\{hasData \? \(\) => setIsFocusOpen\(true\) : undefined\}/,
  "Bar breakdown charts must expose expand through the tile action menu",
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
  "Composition charts must not enlarge automatically on hover",
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
  "✓ Native ranked bars, labels, theme, and explicit expansion regression tests passed",
);
