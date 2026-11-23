"use strict";

const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const source = readFileSync(path.resolve(__dirname, "../src/main/webapp/common/services/askAiToolkit.ts"), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
});
function load({ fetch, oneShot, catalogue = [], username = "codex" } = {}) {
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
    "crypto-js/md5": require("crypto-js/md5"),
    "../lib/constants": { INSIGHTS_APP_ID: "splunk-cisco-dashboards" },
    "../lib/splunk": { getCurrentSplunkUsername: async () => username },
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
  const answer = await askModel("Break it down by device", [example], "approved", [
    { question: "What do I have for Catalyst Center?", answer: { explanation: "What should I look at?" } },
    { question: "Device health", answer: { explanation: "Prior answer" } },
  ], signal);
  assert.deepEqual(answer.source, { id: "device", ownerApp: "other-app" });
  assert.equal(answer.search.title, "Health by device");
  assert.equal(request[1].app, "Splunk_ML_Toolkit");
  assert.equal(request[3].signal, signal);
  const prompt = decodeURIComponent(request[0].search.match(/urldecode\("([^"]+)"\)/)[1]);
  assert.match(prompt, /Prior answer/);
  assert.match(prompt, /What should I look at\?/);
  assert.match(prompt, /stats count by device/);
  assert.doesNotMatch(prompt, /private event/);
});

test("long conversations keep the latest clarification and draft within the prompt limit", async () => {
  let prompt;
  const { askModel } = load({ oneShot: async ({ search }) => {
    prompt = decodeURIComponent(search.match(/urldecode\("([^"]+)"\)/)[1]);
    return { results: [{ ai_result_1: '{"explanation":"Updated the SPL."}' }] };
  } });
  const escaped = '"'.repeat(1000);
  const examples = Array.from({ length: 5 }, () => ({
    searchName: escaped, description: escaped, search: escaped,
  }));
  const conversation = [
    { question: "Old topic", answer: { explanation: "Old answer" } },
    { question: escaped, answer: { explanation: escaped } },
    { question: escaped, answer: {
      explanation: escaped, search: { title: "Device counts", spl: "index=devices | stats count" },
    } },
    { question: "Which time bucket?", answer: { explanation: "By day." } },
  ];
  await askModel("Break it down by site", examples, "approved", conversation, new AbortController().signal);
  const sent = JSON.parse(prompt.slice(prompt.lastIndexOf('\n') + 1));
  assert.ok(prompt.length <= 14000);
  assert.ok(sent.examples.length > 0 && sent.examples.length < examples.length);
  assert.equal(sent.conversation.length, 3);
  assert.deepEqual(sent.conversation[2], { question: "Which time bucket?", answer: "By day." });
  assert.equal(sent.lastDraft, "index=devices | stats count");
});

test("explaining an earlier draft uses its exact SPL and returns only an explanation", async () => {
  let sent;
  const { askModel } = load({ oneShot: async ({ search }) => {
    const prompt = decodeURIComponent(search.match(/urldecode\("([^"]+)"\)/)[1]);
    sent = JSON.parse(prompt.slice(prompt.lastIndexOf("\n") + 1));
    return { results: [{ ai_result_1: JSON.stringify({
      explanation: "The selected draft counts failures.", citation: 1,
      draft: { title: "Unrequested replacement", spl: "index=other | stats count" },
    }) }] };
  } });
  const selected = `index=devices action=failure | eval note="${"a".repeat(2500)}" | stats count`;
  const answer = await askModel("Explain this draft", [{
    id: "other", ownerApp: "demo", searchName: "Another search", description: "", search: "index=other",
  }], "approved", [{
    question: "Draft a different search",
    answer: { explanation: "A more recent draft.", search: { title: "Newer draft", spl: "index=newer" } },
  }], new AbortController().signal, selected);
  assert.equal(sent.selectedSpl, selected);
  assert.equal(sent.lastDraft, undefined);
  assert.deepEqual(sent.examples, []);
  assert.deepEqual(answer, { explanation: "The selected draft counts failures." });
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
  const metadata = {
    description: "Count by device. <script>example</script> & review",
    reference: { category: "Compliance and Auditing", subCategory: "Search", tags: ["AI Defense", "Ask AI"] },
  };
  assert.equal(await saveDraftToSearchbase(draft, "ask_ai_test", metadata, new AbortController().signal), catalogue[0]);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.body.get("parse_only"), "true");
  assert.match(calls[1].url, /configs\/conf-searchbase/);
  const saved = calls[1].options.body;
  assert.equal(saved.get("name"), "ask_ai_test");
  assert.equal(saved.get("search_name"), draft.title);
  assert.equal(saved.get("search"), catalogue[0].search);
  assert.equal(saved.get("search_author"), "codex");
  assert.equal(saved.get("updated_author"), "codex");
  assert.equal(saved.get("search_origin"), "custom");
  assert.equal(saved.get("category"), "Compliance and Auditing");
  assert.equal(saved.get("sub_category"), "Search");
  assert.equal(saved.get("tags"), "Ask AI, AI Defense");
  assert.equal(saved.get("description"), "<p>Count by device. &lt;script&gt;example&lt;/script&gt; &amp; review</p>");
  assert.match(saved.get("date_created"), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  assert.equal(saved.get("date_updated"), saved.get("date_created"));
  const quid = createHash("md5").update(draft.title + catalogue[0].search).digest("hex").toUpperCase();
  assert.equal(saved.get("quid"), quid);
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
  assert.deepEqual(await askModel("Meraki offline devices", [], "approved", [], new AbortController().signal),
    { explanation: text });
});

test("Toolkit error result rows and partial structured drafts are not displayed as answers", async () => {
  for (const [text, expected] of [
    ["Request to the LLM has failed. Please check the provided Connection Management configuration settings.", /request failed/],
    ['{"explanation":"Check your records","draft":', /incomplete structured output/],
  ]) {
    const { askModel } = load({ oneShot: async () => ({ results: [{ ai_result_1: text }] }) });
    await assert.rejects(askModel("Meraki offline devices", [], "approved", [], new AbortController().signal), expected);
  }
});

test("draft saves use complete defaults without a reference and require a signed-in author", async () => {
  const draft = { title: "Device counts", spl: "index=devices | stats count" };
  const catalogue = [{ id: "ask_ai_test", ownerApp: "splunk-cisco-dashboards", search: `search ${draft.spl}` }];
  let saved;
  const fetch = async (url, options) => {
    if (url.includes("conf-searchbase")) saved = options.body;
    return { ok: true };
  };
  await load({ catalogue, fetch }).saveDraftToSearchbase(draft, "ask_ai_test", { description: "" }, new AbortController().signal);
  assert.equal(saved.get("category"), "Custom");
  assert.equal(saved.get("sub_category"), "Search");
  assert.equal(saved.get("tags"), "Ask AI");
  assert.equal(saved.get("description"), "<p>Device counts</p>");

  await assert.rejects(load({ username: "", fetch: async () => assert.fail("No save without an author") })
    .saveDraftToSearchbase(draft, "ask_ai_test", { description: "" }, new AbortController().signal), /signed-in author/);
});
