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
