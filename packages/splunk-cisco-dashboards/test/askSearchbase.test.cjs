"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const sourcePath = path.resolve(__dirname, "../src/main/webapp/common/services/askSearchbase.ts");
const { outputText } = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
});
const exportsFromSource = {};
new Function("exports", outputText)(exportsFromSource);
const { rankSearchbaseMatches } = exportsFromSource;

test("Searchbase deep links support Basic Information and preserve the SPL and catalogue routes", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../src/main/webapp/common/lib/splunkSearchUrl.ts"), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const library = {};
  new Function("exports", outputText)(library);
  const route = "/en-US/app/searchbase/start";
  assert.equal(library.splunkSearchbaseEditUrl("device health", "basic-information"), `${route}#/edit/device%20health#basic-information`);
  assert.equal(library.splunkSearchbaseEditUrl("device_health"), `${route}#/edit/device_health#search-spl`);
  assert.equal(library.splunkSearchbaseEditUrl(undefined, "basic-information"), route);
});

test("Searchbase discovery distinguishes a missing app from an unavailable registry", async () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../src/main/webapp/common/lib/searchbase.js"), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const app = { name: "searchbase" };
  const scenarios = [
    [200, [app], true],
    [404, [], false],
    [403, [], null],
    [200, [], null],
    [200, [{ ...app, content: { disabled: true } }], null],
  ];
  for (const [status, entry, expected] of scenarios) {
    const library = {};
    const fetch = async (url) => {
      assert.match(url, /\/services\/apps\/local\/searchbase\?/);
      return { ok: status === 200, status, json: async () => ({ entry }) };
    };
    new Function("exports", "require", "fetch", outputText)(library, () => ({ getDefaultFetchInit: () => ({}) }), fetch);
    assert.equal(await library.isSearchBaseInstalled(), expected, `registry status ${status}, ${entry.length} entries`);
  }
});

function record(id, searchName, overrides = {}) {
  return {
    id,
    searchName,
    ownerApp: "test-searchbase",
    category: "Network",
    subCategory: "Device Health",
    tags: [],
    description: "",
    search: "| makeresults",
    ...overrides,
  };
}

test("matches a plain-language question and prefers a title over incidental metadata", () => {
  const exact = record("device_health", "Catalyst Center Device Health");
  const related = record("feed", "API Feed Freshness", { tags: ["Catalyst Center"] });
  assert.deepEqual(
    rankSearchbaseMatches([related, exact], "Show me Catalyst Center device health over the past 24 hours"),
    [exact, related],
  );
});

test("returns all ranked product matches past the first five for both question phrasings", () => {
  const catalogue = Array.from({ length: 12 }, (_, index) =>
    record(`catalyst_${index}`, `Catalyst Center Metric ${String(index).padStart(2, "0")}`));
  const unordered = [record("unrelated", "ThousandEyes Test Health"), ...catalogue.slice().reverse()];
  assert.deepEqual(rankSearchbaseMatches(unordered, "What do I have for Catalyst Center?"), catalogue);
  assert.deepEqual(rankSearchbaseMatches(unordered, "What searches do I have for Catalyst Center?"), catalogue);
});

test("keeps qualified matches across apps and excludes hidden, empty, and weak matches", () => {
  const allowed = record("retry_rates", "Payment Gateway Retry Rates", { ownerApp: "customer-app" });
  const sameId = record("retry_rates", "Payment Gateway Retry Rates");
  const hidden = record("hidden", "Payment Gateway Retry Rates", { searchHidden: true });
  const empty = record("empty", "Payment Gateway Retry Rates", { search: " " });
  const weak = record("other", "Payment Reconciliation");
  assert.deepEqual(
    rankSearchbaseMatches([hidden, empty, weak, sameId, allowed], "What is the payment gateway retry rate?"),
    [allowed, sameId],
  );
  assert.deepEqual(rankSearchbaseMatches([allowed], "Show wireless access-point failures"), []);
});

test("does not discover internal matches and keeps operational searches that use makeresults", () => {
  const internal = record("preview", "Topology Health", { searchInternal: true });
  const operational = record("live", "Topology Health", {
    search: 'index=network | append [ | makeresults | eval data_status="No matching telemetry" ]',
  });
  assert.deepEqual(rankSearchbaseMatches([internal, operational], "topology health"), [operational]);
});

test("the shipped demo stanzas and synthetic annotations remain enabled for existing references but hidden from discovery", () => {
  const conf = fs.readFileSync(path.resolve(__dirname, "../src/main/resources/splunk/default/searchbase.conf"), "utf8");
  const internalIds = ["dashboard_spaces_intelligence_v1_operations_annotation"];
  for (const type of ["site", "link"]) {
    for (const state of ["healthy", "warning", "critical"]) internalIds.push(`overview_${type}_demo_${state}`);
  }
  const stanzas = conf.split(/^\[/m);
  for (const id of internalIds) {
    const stanza = stanzas.find((part) => part.startsWith(`${id}]\n`));
    assert.ok(stanza, id);
    assert.match(stanza, /^search_hidden = 1$/m);
    assert.match(stanza, /^search_internal = 1$/m);
    assert.doesNotMatch(stanza, /^disabled = (1|true|yes)$/im);
    assert.match(stanza, /^search = \| makeresults\b/m);
  }
});

test("uses source hints in SPL to supplement a strong catalogue match", () => {
  const denied = record("denied", "Palo Alto Denied Zone and Rule Boundaries", {
    search: "`index_firewall` sourcetype=pan:traffic",
  });
  const similarSource = record("other", "Enterprise Firewall Overview", {
    search: "`index_firewall` sourcetype=pan:traffic action=denied",
  });
  const crossVendor = record("cross_vendor", "Cross-Vendor Denied Destinations", {
    description: "Finds firewall connections including Palo Alto and other vendors.",
  });
  assert.deepEqual(
    rankSearchbaseMatches([similarSource, crossVendor, denied], "Find Palo Alto firewall denied connections"),
    [denied, crossVendor],
  );
});

test("SPL highlighting preserves whitespace, quotes, and copyable search text", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../src/main/webapp/common/components/SplSyntax.tsx"), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  });
  const highlighted = {};
  new Function("exports", "require", outputText)(highlighted, require);
  const spl = '`index_catalyst`\n|   where status="up" AND count>=2';
  const html = renderToStaticMarkup(React.createElement(highlighted.SplSyntax, { spl }));
  assert.match(html, /data-spl-token="command"[^>]*>\|   where/);
  assert.match(html, /data-spl-token="macro"/);
  assert.match(html, /data-spl-token="string"/);
  assert.equal(html.replace(/<[^>]*>/g, "").replaceAll("&quot;", '"').replaceAll("&gt;", ">"), spl);
});
