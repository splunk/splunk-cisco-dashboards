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

const pieTile = fs.readFileSync(pieTilePath, "utf8");
const profile = fs.readFileSync(profilePath, "utf8");

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
  /onPointerEnter=\{\(\) => setIsZoomed\(true\)\}/,
  "Pie charts must enlarge on hover",
);
assert.match(
  pieTile,
  /onFocus=\{\(\) => setIsZoomed\(true\)\}/,
  "Pie charts must enlarge for keyboard users",
);
assert.match(
  pieTile,
  /transform: `scale\(\$\{isZoomed \? 1\.45 : 1\}\)`/,
  "Pie chart hover and focus zoom must be prominent",
);
assert.match(
  profile,
  /isDark=\{resolvedTheme === "dark"\}/,
  "The profile must pass its theme into native Studio charts",
);

console.log(
  "✓ Native Dashboard Studio pie, labels, theme, and zoom regression tests passed",
);
