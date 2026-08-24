"use strict";

const assert = require("assert").strict;
const fs = require("fs");
const path = require("path");

const packageRoot = path.resolve(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(packageRoot, relativePath), "utf8");

const picker = read(
  "src/main/webapp/common/components/workspace/KpiPickerPanel.tsx",
);
const metricItem = read(
  "src/main/webapp/common/components/workspace/MetricItem.tsx",
);
const tileActionMenu = read(
  "src/main/webapp/common/components/workspace/TileActionMenu.tsx",
);
const helpOverlay = read(
  "src/main/webapp/common/components/workspace/HelpOverlay.tsx",
);
const insights = read("src/main/webapp/pages/executive_insights/index.tsx");

assert.match(
  picker,
  /filtersPanelRef\.current[\s\S]*?button\[aria-expanded\][\s\S]*?focus\(\{ preventScroll: true \}\)/,
  "Clearing tile filters must restore focus to the persistent Filters toggle",
);
assert.match(
  picker,
  /drilldownFiltersPanelRef\.current[\s\S]*?button\[aria-expanded\][\s\S]*?focus\(\{ preventScroll: true \}\)/,
  "Clearing drilldown filters must restore focus without scrolling",
);
assert.match(
  tileActionMenu,
  /const expand = \(\) => onExpand\?\.\(toggleRef\.current\)/,
  "Expanded visualizations must retain their persistent tile action toggle",
);
assert.match(
  metricItem,
  /focusReturnRef\.current = returnFocus \?\? null/,
  "Expanded visualizations must remember their invoking control",
);
assert.match(
  metricItem,
  /focusReturnRef\.current\.focus\(\{ preventScroll: true \}\)/,
  "Closing an expanded visualization must restore focus without scrolling",
);
assert.match(
  helpOverlay,
  /closeButtonRef\.current\?\.focus\(\{ preventScroll: true \}\)/,
  "Help must move initial focus to its close button",
);
assert.match(
  insights,
  /helpReturnFocusRef\.current = headerActionsToggleRef\.current[\s\S]*?setHelpOpen\(true\)/,
  "Menu-launched Help must retain the persistent dashboard actions toggle",
);
assert.match(
  insights,
  /helpReturnFocusRef\.current\.focus\(\{ preventScroll: true \}\)/,
  "Closing Help must restore focus without scrolling",
);

console.log("Workspace focus restoration contract checks passed.");
