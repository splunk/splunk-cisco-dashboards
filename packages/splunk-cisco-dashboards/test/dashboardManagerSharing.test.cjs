"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const babel = require("@babel/core");

const source = fs.readFileSync(path.resolve(__dirname,
  "../src/main/webapp/common/config/managedStudioViews.js"), "utf8");
const compiled = babel.transformSync(source, {
  plugins: ["@babel/plugin-transform-modules-commonjs"],
}).code;
const record = { exports: {} };
vm.runInNewContext(`(function(require, module, exports) {${compiled}\n})`)(
  () => ({ INSIGHTS_APP_ID: "splunk-cisco-dashboards" }), record, record.exports,
);
const { getDashboardManagerScope, matchesDashboardManagerScope } = record.exports;
const managed = (overrides = {}) => ({
  title: "scd_team_dashboard", app: "splunk-cisco-dashboards",
  owner: "alice", sharing: "app", tag: "dashboard_manager", ...overrides,
});
const inventory = [
  managed({ title: "scd_alice_private", sharing: "user" }),
  managed({ title: "scd_bob_private", owner: "bob", sharing: "user" }),
  managed(),
  managed({ title: "scd_bob_shared", owner: "bob" }),
  managed({ title: "scd_legacy_shared", owner: "nobody" }),
  managed({ title: "scd_global", owner: "carol", sharing: "global" }),
  managed({ title: "sn_zta_posture", owner: "nobody", tag: "" }),
  managed({ title: "ordinary_studio", tag: "" }),
  managed({ title: "scd_other_app", app: "another_app" }),
];
const titles = (user, scope) => inventory
  .filter((dashboard) => matchesDashboardManagerScope(dashboard, user, scope))
  .map((dashboard) => dashboard.title);

test("shared dashboards belong to their owner and are shared with other readers", () => {
  assert.equal(getDashboardManagerScope(managed(), "alice"), "yours");
  assert.equal(getDashboardManagerScope(managed(), "bob"), "shared");
  assert.equal(getDashboardManagerScope(managed({ owner: "nobody" }), "alice"), "shared");
  assert.equal(getDashboardManagerScope(managed({ sharing: "global" }), "bob"), "shared");
});

test("two readers see app and global dashboards in Shared, never another user's private dashboard", () => {
  for (const user of ["alice", "bob"]) {
    assert.deepEqual(titles(user, "shared"), [
      "scd_team_dashboard", "scd_bob_shared", "scd_legacy_shared", "scd_global",
    ]);
  }
  assert.deepEqual(titles("alice", "yours"), ["scd_alice_private", "scd_team_dashboard"]);
  assert.deepEqual(titles("bob", "yours"), ["scd_bob_private", "scd_bob_shared"]);
  assert.deepEqual(titles("alice", "included"), ["sn_zta_posture"]);
});

test("unknown users and sharing values never claim ownership or expose private dashboards", () => {
  assert.equal(getDashboardManagerScope(managed({ sharing: "user" }), ""), undefined);
  assert.equal(getDashboardManagerScope(managed({ sharing: "user" }), "admin"), undefined);
  assert.equal(getDashboardManagerScope(managed({ sharing: "" }), "bob"), undefined);
  assert.equal(getDashboardManagerScope(managed(), ""), "shared");
  assert.equal(matchesDashboardManagerScope(managed(), "alice", "invalid"), false);
});

test("the library exposes Shared as the third keyboard-accessible tab", () => {
  const home = fs.readFileSync(path.resolve(__dirname,
    "../src/main/webapp/pages/dashboardbuilder/DBHomePage.jsx"), "utf8");
  const optionSource = home.match(/const DASHBOARD_SCOPE_OPTIONS = (\[[\s\S]*?\]);/)[1];
  const options = vm.runInNewContext(optionSource);
  assert.deepEqual(Array.from(options, (option) => option.label), ["Included", "Yours", "Shared"]);
  assert.match(home, /matchesDashboardManagerScope\(ds, currentSplunkUser, dashboardScope\)/);
  const handlerSource = home.slice(home.indexOf("  const handleDashboardScopeKeyDown ="),
    home.indexOf("  const stopDashboardPanelAction ="));
  const states = [];
  const focused = [];
  const handler = vm.runInNewContext(`${handlerSource}\nhandleDashboardScopeKeyDown`, {
    DASHBOARD_SCOPE_OPTIONS: options,
    setDashboardScope: (value) => states.push(value), setPageNum: () => {},
    document: { getElementById: (id) => ({ focus: () => focused.push(id) }) },
  });
  for (const [from, key, expected] of [
    ["yours", "ArrowRight", "shared"], ["shared", "ArrowRight", "included"],
    ["included", "ArrowLeft", "shared"], ["yours", "End", "shared"],
    ["shared", "Home", "included"],
  ]) {
    handler(from)({ key, preventDefault() {} });
    assert.equal(states.at(-1), expected);
    assert.equal(focused.at(-1), `dashboard-manager-scope-${expected}`);
  }
});


test("tagged dashboards with custom IDs remain visible in Yours and Shared", () => {
  const custom = managed({ title: "portable-dashboard" });
  assert.equal(getDashboardManagerScope(custom, "alice"), "yours");
  assert.equal(getDashboardManagerScope(custom, "bob"), "shared");
});
