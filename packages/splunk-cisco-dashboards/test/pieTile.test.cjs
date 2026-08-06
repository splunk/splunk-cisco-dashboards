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
const hoverZoomPath = path.resolve(
  __dirname,
  "../src/main/webapp/common/components/florida/HoverZoomFrame.tsx",
);
const barBreakdownPath = path.resolve(
  __dirname,
  "../src/main/webapp/common/components/florida/BarBreakdownTile.tsx",
);

const pieTile = fs.readFileSync(pieTilePath, "utf8");
const profile = fs.readFileSync(profilePath, "utf8");
const hoverZoom = fs.readFileSync(hoverZoomPath, "utf8");
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
  hoverZoom,
  /onPointerEnter=\{\(\) => setIsZoomed\(true\)\}/,
  "Compact charts must enlarge on hover",
);
assert.match(
  hoverZoom,
  /onFocus=\{\(\) => setIsZoomed\(true\)\}/,
  "Compact charts must enlarge for keyboard users",
);
assert.match(
  hoverZoom,
  /transform: `scale\(\$\{isZoomed \? scale : 1\}\)`/,
  "Compact chart zoom must use the requested magnification",
);
assert.match(
  pieTile,
  /<HoverZoomFrame[\s\S]*?scale=\{1\.45\}/,
  "Pie charts must use the shared prominent zoom frame",
);
assert.match(
  barBreakdown,
  /<HoverZoomFrame[\s\S]*?scale=\{1\.35\}/,
  "Bar breakdown charts must use the shared zoom frame",
);
assert.match(
  profile,
  /isDark=\{resolvedTheme === "dark"\}/,
  "The profile must pass its theme into native Studio charts",
);

console.log(
  "✓ Native pie, shared chart labels, theme, and zoom regression tests passed",
);
