"use strict";

const assert = require("assert").strict;
const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const packageRoot = path.resolve(__dirname, "..");
const workspacesPath = path.join(
  packageRoot,
  "src/main/webapp/common/config/insightsWorkspaces.ts",
);
const workspacesSource = fs.readFileSync(workspacesPath, "utf8");
const workspacesOutput = ts.transpileModule(workspacesSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
  fileName: workspacesPath,
}).outputText;
const workspacesModule = { exports: {} };
const loadWorkspaces = new Function(
  "exports",
  "module",
  "require",
  "__filename",
  "__dirname",
  workspacesOutput,
);
loadWorkspaces(
  workspacesModule.exports,
  workspacesModule,
  require,
  workspacesPath,
  path.dirname(workspacesPath),
);

const {
  DEFAULT_WORKSPACE_ID,
  PACKAGED_WORKSPACE_FALLBACKS,
  WORKSPACE_SOURCES,
  getWorkspaceFromLocation,
} = workspacesModule.exports;

const expectedSecureNetworkingSections = [
  ["zta", "Zero Trust Access"],
  ["secure_infrastructure", "Secure Infrastructure"],
  ["scalable_network_segmentation", "Scalable Network Segmentation"],
  ["hybrid_mesh_firewalling", "Hybrid Mesh Firewalling"],
  ["agentic_ops", "Agentic Ops"],
];

const expectedWorkspaceIds = [
  "secure_networking",
  "zero_trust_access_demo",
  "network_resilience_demo",
  "security_operations_demo",
  "executive",
];

assert.equal(DEFAULT_WORKSPACE_ID, "secure_networking");
assert.deepEqual(
  PACKAGED_WORKSPACE_FALLBACKS.map(({ id }) => id),
  expectedWorkspaceIds,
);
assert.equal(PACKAGED_WORKSPACE_FALLBACKS[0].label, "Secure Networking");
assert.deepEqual(
  WORKSPACE_SOURCES.secure_networking.sections.map(({ id, title }) => [
    id,
    title,
  ]),
  expectedSecureNetworkingSections,
  "Secure Networking sections must match the app menu names and order",
);
assert.deepEqual(
  PACKAGED_WORKSPACE_FALLBACKS[0].defaultVisibleSections,
  expectedSecureNetworkingSections.map(([id]) => id),
  "The built-in Secure Networking workspace must show all menu sections " +
    "in order",
);
assert.equal(
  PACKAGED_WORKSPACE_FALLBACKS.find(({ id }) => id === "executive").label,
  "Executive Briefing",
);
assert.equal(
  PACKAGED_WORKSPACE_FALLBACKS.find(
    ({ id }) => id === "zero_trust_access_demo",
  ).sourceWorkspace,
  "secure_networking",
);

const originalWindow = global.window;
try {
  global.window = {
    location: {
      pathname: "/en-US/app/splunk-cisco-dashboards/insights_workspace",
      search: "?workspace=network_resilience_demo",
    },
  };
  assert.equal(
    getWorkspaceFromLocation(PACKAGED_WORKSPACE_FALLBACKS).id,
    "network_resilience_demo",
  );

  global.window.location.pathname =
    "/en-US/app/splunk-cisco-dashboards/executive_briefing_profile";
  global.window.location.search = "";
  assert.equal(
    getWorkspaceFromLocation(PACKAGED_WORKSPACE_FALLBACKS).id,
    "executive",
  );

  global.window.location.pathname =
    "/en-US/app/splunk-cisco-dashboards/secure_networking_profile";
  assert.equal(
    getWorkspaceFromLocation(PACKAGED_WORKSPACE_FALLBACKS).id,
    "secure_networking",
  );
} finally {
  if (originalWindow === undefined) delete global.window;
  else global.window = originalWindow;
}

const confPath = path.join(
  packageRoot,
  "src/main/resources/splunk/default/insights_workspaces.conf",
);
const conf = fs.readFileSync(confPath, "utf8");
const stanzaNames = [...conf.matchAll(/^\[([^\]]+)\]$/gm)].map((match) => match[1]);
const workspaceStanzas = stanzaNames
  .filter((name) => name.startsWith("workspace."))
  .map((name) => name.slice("workspace.".length));
assert.deepEqual(workspaceStanzas, expectedWorkspaceIds);
for (const workspaceId of expectedWorkspaceIds) {
  assert.ok(
    stanzaNames.some((name) => name.startsWith(`layout.${workspaceId}.`)),
    `expected at least one layout stanza for ${workspaceId}`,
  );
}
assert.match(conf, /^source_workspace = /m);
assert.match(conf, /^default_visible_sections = /m);
assert.doesNotMatch(conf, /^profile\s*=/m);

const secureWorkspaceConf = conf
  .split(/(?=^\[)/m)
  .find((block) => block.startsWith("[workspace.secure_networking]"));
assert.ok(
  secureWorkspaceConf,
  "expected the built-in Secure Networking workspace stanza",
);
const expectedSecureSectionIds = expectedSecureNetworkingSections
  .map(([id]) => id)
  .join(",");
assert.match(
  secureWorkspaceConf,
  new RegExp(`^sections = ${expectedSecureSectionIds}$`, "m"),
  "The shared workspace config must preserve menu section order",
);
assert.match(
  secureWorkspaceConf,
  new RegExp(`^default_visible_sections = ${expectedSecureSectionIds}$`, "m"),
  "All canonical Secure Networking sections must be visible by default",
);

const hybridMeshLayoutConf = conf
  .split(/(?=^\[)/m)
  .find((block) =>
    block.startsWith("[layout.secure_networking.hybrid_mesh_firewalling]"),
  );
assert.ok(
  hybridMeshLayoutConf,
  "expected the shared Hybrid Mesh Firewalling layout stanza",
);
const hybridMeshTileIds = hybridMeshLayoutConf
  .match(/^tiles = (.+)$/m)?.[1]
  .split(",");
assert.ok(hybridMeshTileIds, "Hybrid Mesh Firewalling must declare tile order");
const paloTrendTileIds = [
  "secure_networking_sgt_palo_alto_policy_effectiveness_trend",
  "secure_networking_sgt_palo_alto_traffic_trend",
];
const paloDetailTileIds = [
  "secure_networking_sgt_palo_alto_policy_effectiveness",
  "secure_networking_sgt_palo_alto_traffic_detail",
];
for (const tileId of paloTrendTileIds) {
  assert.ok(
    hybridMeshTileIds.includes(tileId),
    `${tileId} must be a shared Hybrid Mesh Firewalling tile`,
  );
}
for (const tileId of paloDetailTileIds) {
  assert.ok(
    !hybridMeshTileIds.includes(tileId),
    `${tileId} must remain a drilldown instead of a workspace tile`,
  );
}
assert.match(
  hybridMeshLayoutConf,
  /^visible_count = 5$/m,
  "The two Palo Alto trend tiles must be visible in the shared layout",
);

const searchbaseConf = fs.readFileSync(
  path.join(packageRoot, "src/main/resources/splunk/default/searchbase.conf"),
  "utf8",
);
assert.match(searchbaseConf, /"workspace":"secure_networking"/);
assert.doesNotMatch(searchbaseConf, /"profile":"secure_networking"/);
const expectedSecureSectionTitles = new Set(
  expectedSecureNetworkingSections.map(([, title]) => title),
);
const secureNetworkingSearchStanzas = searchbaseConf
  .split(/(?=^\[)/m)
  .filter((block) => block.startsWith("[secure_networking_"));
assert.ok(
  secureNetworkingSearchStanzas.length > 0,
  "expected Secure Networking Searchbase stanzas",
);
for (const block of secureNetworkingSearchStanzas) {
  const stanzaName = block.match(/^\[([^\]]+)\]/)?.[1] ?? "unknown";
  const subCategory = block.match(/^sub_category = (.+)$/m)?.[1];
  assert.ok(subCategory, `${stanzaName} must declare a sub_category`);
  assert.ok(
    expectedSecureSectionTitles.has(subCategory),
    `${stanzaName} must use an exact Secure Networking menu section name; got ${subCategory}`,
  );
}

const searchbaseStanza = (stanzaId) =>
  searchbaseConf
    .split(/(?=^\[)/m)
    .find((block) => block.startsWith(`[${stanzaId}]`));
const paloTrendDrilldownPairs = [
  [
    "secure_networking_sgt_palo_alto_policy_effectiveness_trend",
    "Secure Networking - Palo Alto SGT Policy Effectiveness",
  ],
  [
    "secure_networking_sgt_palo_alto_traffic_trend",
    "Secure Networking - Palo Alto Traffic Correlated by SGT",
  ],
];
for (const [trendId, drilldownName] of paloTrendDrilldownPairs) {
  const block = searchbaseStanza(trendId);
  assert.ok(block, `expected ${trendId}`);
  assert.match(block, /^sub_category = Hybrid Mesh Firewalling$/m);
  assert.match(block, /\| timechart /);
  assert.match(
    block,
    new RegExp(`^drilldown_search_name = ${drilldownName}$`, "m"),
    `${trendId} must drill into its corresponding table search`,
  );
}
for (const detailId of paloDetailTileIds) {
  const block = searchbaseStanza(detailId);
  assert.ok(block, `expected ${detailId}`);
  assert.match(block, /^sub_category = Hybrid Mesh Firewalling$/m);
  assert.match(block, /^default_viz = splunk\.table$/m);
  assert.doesNotMatch(
    block,
    /^drilldown_search_name = /m,
    `${detailId} must terminate its trend drilldown`,
  );
}

const appConf = fs.readFileSync(
  path.join(packageRoot, "src/main/resources/splunk/default/app.conf"),
  "utf8",
);
const serverConf = fs.readFileSync(
  path.join(packageRoot, "src/main/resources/splunk/default/server.conf"),
  "utf8",
);
const defaultMeta = fs.readFileSync(
  path.join(packageRoot, "src/main/resources/splunk/metadata/default.meta"),
  "utf8",
);
assert.match(appConf, /^reload\.insights_workspaces = simple$/m);
assert.match(
  serverConf,
  /^conf_replication_include\.insights_workspaces = true$/m,
);
assert.match(defaultMeta, /^\[insights_workspaces\]$/m);
assert.doesNotMatch(`${appConf}\n${serverConf}\n${defaultMeta}`, /overview_factory_tiles/);

console.log("✓ Insights workspace tests passed");
