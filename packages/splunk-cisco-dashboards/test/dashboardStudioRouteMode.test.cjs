"use strict";

const assert = require("assert").strict;
const fs = require("fs");
const path = require("path");

const packageRoot = path.resolve(__dirname, "..");
const editor = fs.readFileSync(
  path.join(
    packageRoot,
    "src/main/webapp/pages/dashboardbuilder/DashboardStudioEditor.jsx",
  ),
  "utf8",
);

assert.match(
  editor,
  /const requestedRouteMode = currentmode === "edit" \? "edit" : "view";/,
  "Dashboard Manager routes must normalize unsupported or missing modes to view",
);
assert.match(
  editor,
  /readOnly \? "view" : openID \? "edit" : requestedRouteMode/,
  "Cold /edit loads must initialize Dashboard Studio in edit mode",
);
assert.match(
  editor,
  /setDashMode\(requestedRouteMode\);[\s\S]*?apiRef\.getMode\(\) !== requestedRouteMode[\s\S]*?apiRef\.switchMode\(requestedRouteMode\);/,
  "Same-tab route changes must synchronize the mounted Dashboard Studio mode",
);
assert.match(
  editor,
  /\[apiRef, openID, readOnly, requestedRouteMode\]/,
  "Route synchronization must rerun when either the dashboard API or route mode changes",
);

console.log("Dashboard Studio route-mode contract checks passed.");
