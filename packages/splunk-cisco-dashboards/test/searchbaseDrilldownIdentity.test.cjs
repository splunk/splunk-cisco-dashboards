"use strict";

const assert = require("assert").strict;
const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const packageRoot = path.resolve(__dirname, "..");
const cataloguePath = path.join(
  packageRoot,
  "src/main/webapp/common/services/searchbaseCatalogue.ts",
);
const source = fs.readFileSync(cataloguePath, "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
  fileName: cataloguePath,
}).outputText;
const catalogueModule = { exports: {} };
const stubRequire = (request) => {
  if (request === "./splunkSearchService") {
    return { getSearchAppContext: () => "splunk-cisco-dashboards" };
  }
  if (request === "./searchbaseDispatch") {
    return {
      resolveSearchbaseAppContexts: (ownerApp) => ({
        ownerApp,
        catalogueApp: ownerApp,
        dispatchContext: ownerApp,
        dispatchContextForce: false,
      }),
    };
  }
  return require(request);
};
new Function("exports", "module", "require", output)(
  catalogueModule.exports,
  catalogueModule,
  stubRequire,
);

const {
  resolveConfiguredDrilldownIdentities,
  resolveConfiguredDrilldownIdentity,
} = catalogueModule.exports;

assert.deepEqual(
  resolveConfiguredDrilldownIdentities({
    drilldown_stanza_ids: "target_a, target_b,target_a",
  }),
  ["target_a", "target_b"],
  "plural target ids must preserve order and remove duplicates",
);

assert.equal(
  resolveConfiguredDrilldownIdentity({
    drilldown_stanza_id: "canonical_target",
  }),
  "canonical_target",
  "new defaults must resolve by stanza id",
);
assert.deepEqual(
  resolveConfiguredDrilldownIdentities({
    drilldown_search_name: "Legacy, Friendly Target",
  }),
  ["Legacy, Friendly Target"],
  "legacy friendly names containing commas must remain one compatibility target",
);
assert.equal(
  resolveConfiguredDrilldownIdentity({
    drilldown_stanza_ids: "plural_a,plural_b",
    drilldown_stanza_id: "canonical_target",
    drilldown_search_name: "Legacy Friendly Target",
  }),
  "Legacy Friendly Target",
  "an installed legacy local override must continue to win",
);
assert.deepEqual(
  resolveConfiguredDrilldownIdentities({
    drilldown_stanza_ids: "plural_a,plural_b",
    drilldown_stanza_id: "canonical_target",
  }),
  ["plural_a", "plural_b"],
  "plural canonical targets must take precedence over the singular compatibility key",
);
assert.equal(
  resolveConfiguredDrilldownIdentity({
    drilldown_stanza_id: " canonical_target ",
    drilldown_search_name: "   ",
  }),
  "canonical_target",
  "a cleared legacy key must fall through to the canonical stanza id",
);

assert.equal(
  resolveConfiguredDrilldownIdentities({
    drilldown_stanza_ids: Array.from({ length: 30 }, (_, index) => `target_${index}`).join(","),
  }).length,
  24,
  "configured drilldown workflows must remain bounded",
);
assert.equal(
  resolveConfiguredDrilldownIdentity({
    drilldown_stanza_id: " ",
    drilldown_search_name: " ",
  }),
  undefined,
  "clearing both keys must remove the drilldown",
);

const tileConfigSource = fs.readFileSync(
  path.join(
    packageRoot,
    "src/main/webapp/common/services/searchbaseTileConfigService.ts",
  ),
  "utf8",
);
assert.match(tileConfigSource, /drilldown_stanza_ids:\s*normalizedIds\.join\(','\)/);
assert.match(tileConfigSource, /drilldown_stanza_id:\s*''/);
assert.match(tileConfigSource, /drilldown_search_name:\s*''/);

const defaultSearchbase = fs.readFileSync(
  path.join(
    packageRoot,
    "src/main/resources/splunk/default/searchbase.conf",
  ),
  "utf8",
);
assert.match(
  defaultSearchbase,
  /\[secure_networking_zta_ise_auth_failure_rate_trend\][\s\S]*?drilldown_stanza_ids = secure_networking_zta_ise_auth_by_device_fail_rate,secure_networking_zta_ise_enforcement_by_domain/,
  "the Secure Networking ISE trend must ship a live two-search drilldown workflow",
);

console.log("✓ Searchbase drilldown identity migration tests passed");
