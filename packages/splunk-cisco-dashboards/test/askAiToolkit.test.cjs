"use strict";

const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const source = readFileSync(path.resolve(__dirname, "../src/main/webapp/common/services/askAiToolkit.ts"), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
function load({ fetch, oneShot, catalogue = [] } = {}) {
  const service = {};
  const imports = {
    "@splunk/splunk-utils/fetch": { getDefaultFetchInit: () => ({ credentials: "include" }) },
    "@splunk/splunk-utils/search": {
      oneShot,
      addLeadingSearchCommand: (spl) => /^search\s|^\|/i.test(spl) ? spl : `search ${spl}`,
    },
    "@splunk/splunk-utils/url": {
      createRESTURL: (route, ns) => `/${ns?.app ?? "system"}/${route}`,
    },
    "../lib/constants": { INSIGHTS_APP_ID: "splunk-cisco-dashboards" },
    "./searchbaseCatalogue": {
      clearSearchbaseCache() {},
      getSearchbaseCatalogue: async () => catalogue,
    },
  };
  new Function("exports", "require", "fetch", outputText)(service, (id) => imports[id], fetch);
  return service;
}

test("encodes UTF-8 user and catalog text as a single data field in a one-row Toolkit search", () => {
  const { buildModelSearch } = load();
  const input = '日本 " | delete\n\x60macro\x60 {example} invalid\r\n';
  const spl = buildModelSearch(input, "Approved Model");
  assert.equal(decodeURIComponent(spl.match(/urldecode\("([^"]+)"\)/)[1]), input);
  assert.match(spl, /\| ai prompt="\{scd_prompt\}" connection="Approved Model"/);
  assert.equal(spl.includes("delete"), false);
  assert.throws(() => buildModelSearch(input, 'connection" | delete'), /valid AI Toolkit/);
});

test("model availability requires enabled settings and permission to execute the Toolkit command", async () => {
  for (const capabilities of [[], ["apply_ai_commander_command"]]) {
    const { getAskAiSettings } = load({ fetch: async (url) => ({
      ok: true,
      json: async () => ({ entry: [{
        content: url.includes("current-context") ? { capabilities } : { enabled: "1", connection: "approved" },
        acl: { can_write: "1" },
      }] }),
    }) });
    assert.deepEqual(await getAskAiSettings(), {
      enabled: true, connection: "approved", writable: true, canUseModel: capabilities.length > 0,
    });
  }
});

test("drafting uses the configured Toolkit app and bounded, citable Searchbase examples", async () => {
  let request;
  const { askModel } = load({ oneShot: async (...args) => {
    request = args;
    return { results: [{ ai_result_1: JSON.stringify({
      explanation: "Use the device-health search.", citation: 1,
      draft: { title: "Health by device", spl: "index=devices | stats count by device" },
    }) }] };
  } });
  const example = { id: "device", ownerApp: "other-app", searchName: "Device health",
    description: "<b>Device health</b>", search: "index=devices | stats count by device", rawEvents: ["private event"] };
  const signal = new AbortController().signal;
  const answer = await askModel("Break it down by device", [example], "approved", {
    explanation: "Prior answer",
  }, signal);
  assert.deepEqual(answer.source, { id: "device", ownerApp: "other-app" });
  assert.equal(answer.search.title, "Health by device");
  assert.equal(request[1].app, "Splunk_ML_Toolkit");
  assert.equal(request[3].signal, signal);
  const prompt = decodeURIComponent(request[0].search.match(/urldecode\("([^"]+)"\)/)[1]);
  assert.match(prompt, /Prior answer/);
  assert.match(prompt, /stats count by device/);
  assert.doesNotMatch(prompt, /private event/);
});

test("draft links and save reject write commands and unverified nested SPL", () => {
  const { canValidateDraft } = load();
  assert.equal(canValidateDraft('index=devices | eval note="literal | outputlookup" | stats count by device'), true);
  for (const draft of [
    "| delete", "index=devices | outputlookup results.csv", "index=devices [| savedsearch unknown]",
    "index=devices \x60unknown\x60", "index=devices | lookup myLookup ip", "index=devices | unknown",
  ]) assert.equal(canValidateDraft(draft), false, draft);
});

test("saving a reviewed draft parses it without execution and recovers an existing matching stanza on retry", async () => {
  const calls = [];
  const draft = { title: "Device counts", spl: "index=devices | stats count" };
  const catalogue = [{
    id: "ask_ai_test", ownerApp: "splunk-cisco-dashboards", search: `search ${draft.spl}`,
  }];
  const { saveDraftToSearchbase } = load({ catalogue, fetch: async (url, options) => {
    calls.push({ url, options });
    return { ok: url.endsWith("search/v2/parser"), status: 400 };
  } });
  assert.equal(await saveDraftToSearchbase(draft, "ask_ai_test", new AbortController().signal), catalogue[0]);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.body.get("parse_only"), "true");
  assert.match(calls[1].url, /configs\/conf-searchbase/);
  assert.equal(calls[1].options.body.get("name"), "ask_ai_test");
});

test("Ask AI settings default off, use administrator write access, and reload with the app", () => {
  const resources = path.resolve(__dirname, "../src/main/resources/splunk");
  assert.match(readFileSync(path.join(resources, "default/ask_ai.conf"), "utf8"), /^enabled = 0$/m);
  assert.match(readFileSync(path.join(resources, "default/app.conf"), "utf8"), /^reload\.ask_ai = simple$/m);
  assert.match(readFileSync(path.join(resources, "metadata/default.meta"), "utf8"),
    /\[ask_ai\]\naccess = read : \[ \* \], write : \[ admin, sc_admin \]/);
});

test("a plain-language clarification stays visible without draft or citation actions", async () => {
  const text = "I don’t have a Meraki-specific example. Which field contains the device status?";
  const { askModel } = load({ oneShot: async () => ({ results: [{ ai_result_1: text }] }) });
  assert.deepEqual(await askModel("Meraki offline devices", [], "approved", undefined, new AbortController().signal),
    { explanation: text });
});

test("Toolkit error result rows and partial structured drafts are not displayed as answers", async () => {
  for (const [text, expected] of [
    ["Request to the LLM has failed. Please check the provided Connection Management configuration settings.", /request failed/],
    ['{"explanation":"Check your records","draft":', /incomplete structured output/],
  ]) {
    const { askModel } = load({ oneShot: async () => ({ results: [{ ai_result_1: text }] }) });
    await assert.rejects(askModel("Meraki offline devices", [], "approved", undefined, new AbortController().signal), expected);
  }
});
