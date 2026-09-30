"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const babel = require("@babel/core");

const webapp = path.resolve(__dirname, "../src/main/webapp");
const source = fs.readFileSync(path.join(webapp, "common/lib/splunk.js"), "utf8");
const compiled = babel.transformSync(source, {
  plugins: ["@babel/plugin-transform-modules-commonjs"],
}).code;

function persistence(responses) {
  const calls = [];
  const module = { exports: {} };
  vm.runInNewContext(`(function(require, module, exports) {${compiled}\n})`, {
    URLSearchParams,
    fetch: async (url, init) => {
      calls.push({ url: new URL(url, "http://localhost"), ...init });
      assert.ok(responses.length, "Unexpected request");
      const response = responses.shift();
      if (response instanceof Error) throw response;
      const { status = 200, ...body } = response;
      return { status, text: async () => JSON.stringify(body) };
    },
  })((id) => {
    if (id === "@splunk/splunk-utils/fetch") return { getDefaultFetchInit: () => ({}) };
    if (id === "./constants") return { INSIGHTS_APP_ID: "splunk-cisco-dashboards" };
    if (id === "../config/managedStudioViews") return { requiresDashboardManagerRuntime: () => false };
    if (id === "./imageSource") return {};
    if (id === "./xmlCdata") return { escapeCdata: (value) => value };
    throw new Error(`Unexpected import ${id}`);
  }, module, module.exports);
  return { ...module.exports, calls };
}

const create = (api, sharing = "app") => api.addDash(
  "scd_creation_test", '{"title":"Creation test"}', "Creation test", "", "test", "dark", "builder", sharing,
);

test("new shared dashboards check for collisions, create, then apply app sharing", async () => {
  const api = persistence([{ entry: [] }, { status: 201 }, { status: 200 }]);
  assert.equal((await create(api)).status, 201);
  assert.equal(api.calls.length, 3);
  assert.equal(api.calls[0].method, "GET");
  assert.equal(api.calls[0].url.searchParams.get("search"), 'name="scd_creation_test"');
  assert.equal(api.calls[0].url.searchParams.get("f"), "name");
  assert.equal(new URLSearchParams(api.calls[1].body).get("name"), "scd_creation_test");
  assert.match(api.calls[2].url.pathname, /scd_creation_test\/acl$/);
  assert.equal(new URLSearchParams(api.calls[2].body).get("sharing"), "app");
  assert.equal(new URLSearchParams(api.calls[2].body).get("owner"), "builder");
  assert.equal(new URLSearchParams(api.calls[2].body).get("perms.read"), "*");
  assert.equal(new URLSearchParams(api.calls[2].body).has("perms.write"), false);
});

test("private dashboards skip app sharing", async () => {
  const api = persistence([{ entry: [] }, { status: 201 }]);
  assert.equal((await create(api, "user")).status, 201);
  assert.equal(api.calls.length, 2);
});

test("existing private or shared dashboard IDs are rejected without writes", async () => {
  for (const sharing of ["user", "app"]) {
    const api = persistence([{ entry: [{ name: "scd_creation_test", acl: { sharing } }] }]);
    const result = await create(api);
    assert.equal(result.status, 409);
    assert.match(result.messages[0].text, /different title/);
    assert.deepEqual(api.calls.map((call) => call.method), ["GET"]);
  }
});

test("a concurrent creation conflict never falls back to overwriting the existing dashboard", async () => {
  const api = persistence([{ entry: [] }, { status: 409 }]);
  assert.equal((await create(api)).status, 409);
  assert.equal(api.calls.length, 2);
});

test("failed or malformed collision checks fail before writing", async () => {
  for (const response of [{ status: 403 }, { status: 200 }]) {
    const api = persistence([response]);
    assert.ok((await create(api)).status >= 400);
    assert.equal(api.calls.length, 1);
  }
});

test("sharing conflicts and transport failures retain the saved dashboard identity", async () => {
  for (const failure of [{ status: 409 }, { status: 403 }, new Error("Connection lost")]) {
    const api = persistence([{ entry: [] }, { status: 201 }, failure]);
    const result = await create(api);
    assert.ok(result.status >= 400);
    assert.equal(result.dashboardSaved, true);
    assert.equal(result.dashboardId, "scd_creation_test");
    assert.equal(api.calls.length, 3);
  }
});

test("explicit metadata edits update the existing dashboard without a create request", async () => {
  const api = persistence([{ status: 200 }]);
  const result = await api.updateDashMetadata("scd_creation_test", {}, "Revised title", "Details", "test", "dark", "builder", "user");
  assert.equal(result.status, 200);
  assert.equal(api.calls.length, 1);
  assert.match(api.calls[0].url.pathname, /views\/scd_creation_test$/);
  assert.equal(new URLSearchParams(api.calls[0].body).has("name"), false);
  assert.match(new URLSearchParams(api.calls[0].body).get("eai:data"), /Revised title/);
});

test("shared metadata edits preserve existing ownership and role permissions", async () => {
  for (const sharing of ["app", "global"]) {
    const api = persistence([{ status: 200 }]);
    const result = await api.updateDashMetadata("scd_creation_test", {}, "Revised title", "", "test", "dark", "creator", sharing);
    assert.equal(result.status, 200);
    assert.equal(api.calls.length, 1, "Metadata changes must not submit a new sharing ACL");
    assert.match(api.calls[0].url.pathname, /servicesNS\/creator\/.*\/views\/scd_creation_test$/);
  }
});

const home = fs.readFileSync(path.join(webapp, "pages/dashboardbuilder/DBHomePage.jsx"), "utf8");
const handlerSource = home.slice(home.indexOf("  const handleOpenClick ="), home.indexOf("  const refreshDashboards ="));

function createHandler(addDash) {
  const state = { errors: [], savedIds: [], routes: [], pending: [], refreshes: 0 };
  const handler = vm.runInNewContext(`${handlerSource}\nhandleOpenClick`, {
    addDash,
    dashboardTitle: " Creation test ", dashboardDescription: "", dashboardSharing: "app",
    gridLayout: "absolute", currentSplunkUser: "builder", managerDashboards: [], createdDashboardId: "",
    createInFlight: { current: false }, initialDefinition: { layout: {} }, cloneDeep: (v) => JSON.parse(JSON.stringify(v)),
    setIsCreatingDashboard: (v) => state.pending.push(v), setDashboardCreateError: (v) => state.errors.push(v),
    setCreatedDashboardId: (v) => state.savedIds.push(v), refreshDashboards: () => state.refreshes++,
    setOpenCreateDashboard: () => {}, navigate: (v) => state.routes.push(v),
    buildDashboardStudioPath: (id) => `/${id}/edit`, syncDashboardManagerNavigation: async () => {},
    DASHBOARD_MANAGER_TAG: "test", INSIGHTS_APP_ID: "splunk-cisco-dashboards", console,
  });
  return { handler, state };
}

test("the create dialog blocks repeat submissions while saving and opens the editor on success", async () => {
  let resolve;
  let calls = 0;
  const { handler, state } = createHandler(() => {
    calls++;
    return new Promise((done) => { resolve = done; });
  });
  const first = handler();
  await handler();
  assert.equal(calls, 1);
  resolve({ status: 201 });
  await first;
  assert.deepEqual(state.routes, ["/scd_Creation_test/edit"]);
  assert.deepEqual(state.pending, [true, false]);
});

test("the create dialog retains a visible actionable collision message", async () => {
  const { handler, state } = createHandler(async () => ({ status: 409 }));
  await handler();
  assert.match(state.errors.at(-1), /different title/);
  assert.equal(state.routes.length, 0);
  assert.match(home, /role="alert"[\s\S]*?dashboardCreateError/);
});

test("the create dialog offers access to a saved dashboard after sharing failure", async () => {
  const { handler, state } = createHandler(async () => ({ status: 403, dashboardSaved: true }));
  await handler();
  assert.deepEqual(state.savedIds, ["scd_Creation_test"]);
  assert.match(state.errors.at(-1), /was saved.*sharing/);
  assert.equal(state.refreshes, 1);
  assert.match(home, /label="Open saved dashboard"/);
});

test("a rejected request releases the create dialog and asks the user to check the library", async () => {
  const { handler, state } = createHandler(async () => { throw new Error("Offline"); });
  await handler();
  assert.match(state.errors.at(-1), /Check the dashboard library/);
  assert.deepEqual(state.pending, [true, false]);
});

test("all Dashboard Manager error notifications stay until dismissed and expose alert semantics", () => {
  const notifications = [];
  const notificationSource = fs.readFileSync(path.join(webapp, "pages/dashboardbuilder/dashboardNotifications.js"), "utf8");
  const output = babel.transformSync(notificationSource, { plugins: ["@babel/plugin-transform-modules-commonjs"] }).code;
  const module = { exports: {} };
  vm.runInNewContext(`(function(require, module, exports) {${output}\n})`)((id) => {
    if (id.endsWith("/Toaster")) return { create: (message) => notifications.push(message) };
    if (id.endsWith("/ToastConstants")) return { TOAST_TYPES: { ERROR: "error" } };
    throw new Error(`Unexpected import ${id}`);
  }, module, module.exports);
  module.exports.notifyDashboard({ type: "error", message: "Save failed", autoDismiss: true });
  module.exports.notifyDashboard({ type: "success", message: "Saved" });
  assert.equal(notifications[0].autoDismiss, false);
  assert.equal(notifications[0].role, "alert");
  assert.equal(notifications[1].autoDismiss, true);
  assert.equal(notifications[1].role, "status");
  assert.equal(module.exports.dashboardResponseMessage({ messages: [{ text: "Permission denied\nDetails" }] }), "Permission denied");
  assert.equal(module.exports.dashboardResponseMessage({ status: 403, messages: null }), "Request failed (403).");
});

test("one notification host survives Manager route changes above modal stacking contexts", () => {
  const entry = fs.readFileSync(path.join(webapp, "pages/dashboardbuilder/index.jsx"), "utf8");
  const notifications = fs.readFileSync(path.join(webapp, "pages/dashboardbuilder/DashboardManagerNotifications.jsx"), "utf8");
  const editor = fs.readFileSync(path.join(webapp, "pages/dashboardbuilder/DashboardStudioEditor.jsx"), "utf8");
  assert.match(entry, /<DashboardManagerNotifications\s*\/>[\s\S]*?<RouterProvider/);
  for (const component of [home, editor]) {
    assert.doesNotMatch(component, /<ToastMessages|makeCreateToast|import Toaster/);
    assert.match(component, /notifyDashboard/);
  }
  assert.match(notifications, /\[data-test='layer'\]:has\(\[data-test='toast-messages'\]\)/);
  const foreground = Number(notifications.match(/z-index:\s*(\d+)/)[1]);
  const styles = fs.readFileSync(path.join(webapp, "common/styles/commonstyles.css"), "utf8");
  for (const match of styles.matchAll(/z-index:\s*(\d+)/g)) {
    assert.ok(foreground > Number(match[1]), "Notifications must clear every existing app overlay");
  }
});
