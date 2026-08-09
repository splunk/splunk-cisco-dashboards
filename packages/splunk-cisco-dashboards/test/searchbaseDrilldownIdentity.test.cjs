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

const { resolveConfiguredDrilldownIdentity } = catalogueModule.exports;

assert.equal(
  resolveConfiguredDrilldownIdentity({
    drilldown_stanza_id: "canonical_target",
  }),
  "canonical_target",
  "new defaults must resolve by stanza id",
);
assert.equal(
  resolveConfiguredDrilldownIdentity({
    drilldown_stanza_id: "canonical_target",
    drilldown_search_name: "Legacy Friendly Target",
  }),
  "Legacy Friendly Target",
  "an installed legacy local override must continue to win",
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
assert.match(tileConfigSource, /drilldown_stanza_id:\s*drilldownStanzaId \?\? ''/);
assert.match(tileConfigSource, /drilldown_search_name:\s*''/);

console.log("✓ Searchbase drilldown identity migration tests passed");
