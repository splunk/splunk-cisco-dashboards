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
  createInsightsWorkspace,
  getWorkspaceSectionSource,
  getWorkspaceFromLocation,
} = workspacesModule.exports;

const expectedSecureNetworkingSections = [
  ["zta", "Zero Trust Access"],
  ["secure_infrastructure", "Secure Infrastructure"],
  ["scalable_network_segmentation", "Scalable Network Segmentation"],
  ["hybrid_mesh_firewalling", "Hybrid Mesh Firewalling"],
  ["agentic_ops", "Agentic Ops"],
];

const expectedCrossDomainSections = [
  ["it_health", "IT Operations"],
  ["security", "Security Operations"],
  ["building", "Digital Experience"],
  ["custom", "Executive Command Signals"],
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
  WORKSPACE_SOURCES.secure_networking.defaultSectionIds,
  expectedSecureNetworkingSections.map(([id]) => id),
  "The Secure Networking template must keep its focused starting sections",
);
assert.deepEqual(
  WORKSPACE_SOURCES.secure_networking.sections.map(({ id, title }) => [
    id,
    title,
  ]),
  [...expectedSecureNetworkingSections, ...expectedCrossDomainSections],
  "Every workspace template must offer Secure Networking, SecOps, ITOps, digital experience, and executive sections",
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
assert.deepEqual(
  PACKAGED_WORKSPACE_FALLBACKS.map(({ id, headerTitle, headerSubtitle }) => ({
    id,
    headerTitle,
    headerSubtitle,
  })),
  [
    {
      id: "secure_networking",
      headerTitle: "Splunk for Secure Networking",
      headerSubtitle: "Secure Networking Executive Insights",
    },
    {
      id: "zero_trust_access_demo",
      headerTitle: "Zero Trust Access Demo",
      headerSubtitle: "Identity, authentication, and access-policy enforcement",
    },
    {
      id: "network_resilience_demo",
      headerTitle: "Network Resilience Demo",
      headerSubtitle:
        "Infrastructure health, segmentation, and threat containment",
    },
    {
      id: "security_operations_demo",
      headerTitle: "Security Operations Demo",
      headerSubtitle:
        "Operational risk, service health, and executive security signals",
    },
    {
      id: "executive",
      headerTitle: "Global Operations Command",
      headerSubtitle:
        "Enterprise health, risk, and experience at decision speed",
    },
  ],
  "Every packaged workspace must have deliberate factory header copy",
);
assert.equal(
  PACKAGED_WORKSPACE_FALLBACKS.find(
    ({ id }) => id === "zero_trust_access_demo",
  ).sourceWorkspace,
  "secure_networking",
);

const crossDomainSecureWorkspace = createInsightsWorkspace({
  id: "cross_domain_demo",
  label: "Cross-domain Demo",
  sourceWorkspace: "secure_networking",
  sectionIds: ["security", "it_health"],
  defaultVisibleSections: ["security", "it_health"],
});
assert.deepEqual(
  crossDomainSecureWorkspace.sections.map(({ id }) => id),
  ["it_health", "security"],
  "A Secure Networking template must be able to own real ITOps and SecOps sections",
);
assert.equal(getWorkspaceSectionSource("it_health"), "executive");
assert.equal(getWorkspaceSectionSource("security"), "executive");
assert.equal(getWorkspaceSectionSource("zta"), "secure_networking");

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
  const workspaceBlock = conf
    .split(/(?=^\[)/m)
    .find((block) => block.startsWith(`[workspace.${workspaceId}]`));
  assert.ok(workspaceBlock, `expected workspace stanza for ${workspaceId}`);
  assert.match(
    workspaceBlock,
    /^header_title = .+$/m,
    `${workspaceId} must declare a factory header title`,
  );
  assert.match(
    workspaceBlock,
    /^header_subtitle = .+$/m,
    `${workspaceId} must declare a factory header subtitle`,
  );
  assert.ok(
    stanzaNames.some((name) => name.startsWith(`layout.${workspaceId}.`)),
    `expected at least one layout stanza for ${workspaceId}`,
  );
}
const secureNetworkingLayoutBlocks = conf
  .split(/(?=^\[)/m)
  .filter((block) => block.startsWith("[layout.secure_networking."));
const secureNetworkingLayoutTileIds = secureNetworkingLayoutBlocks.flatMap(
  (block) => block.match(/^tiles = (.+)$/m)?.[1].split(",") ?? [],
);
assert.equal(
  secureNetworkingLayoutBlocks.length,
  5,
  "Secure Networking must keep its five canonical sections",
);
assert.ok(
  secureNetworkingLayoutBlocks.every(
    (block) => (block.match(/^tiles = (.+)$/m)?.[1].split(",").length ?? 0) === 9,
  ),
  "Every Secure Networking section must expose exactly nine factory tiles",
);
assert.equal(
  new Set(secureNetworkingLayoutTileIds).size,
  45,
  "The five Secure Networking sections must expose 45 unique factory tiles",
);
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

const secureOverviewMappings = [];
for (const block of searchbaseConf.split(/(?=^\[)/m)) {
  const stanzaId = block.match(/^\[([^\]]+)\]/)?.[1];
  const rawVizOptions = block.match(/^viz_options = (.+)$/m)?.[1];
  if (!stanzaId || !rawVizOptions) continue;
  let vizOptions;
  assert.doesNotThrow(() => {
    vizOptions = JSON.parse(rawVizOptions);
  }, `${stanzaId} must contain valid single-line viz_options JSON`);
  for (const overview of Array.isArray(vizOptions.overview)
    ? vizOptions.overview
    : []) {
    if (overview.workspace !== "secure_networking") continue;
    secureOverviewMappings.push({ block, overview, stanzaId, vizOptions });
  }
}

for (const tileId of secureNetworkingLayoutTileIds) {
  const mappings = secureOverviewMappings.filter(
    ({ overview }) => overview.tileId === tileId,
  );
  assert.equal(
    mappings.length,
    1,
    `${tileId} must resolve to exactly one Secure Networking overview search`,
  );

  const { block, overview, stanzaId, vizOptions } = mappings[0];
  const thresholds = overview.thresholds ?? vizOptions.thresholds;
  const hasNumericThresholds =
    Number.isFinite(thresholds?.warning) &&
    Number.isFinite(thresholds?.critical) &&
    ["higher_is_better", "lower_is_better"].includes(thresholds?.direction);
  const hasQualitativeThreshold =
    typeof overview.thresholdNote === "string" &&
    overview.thresholdNote.trim().length > 0;
  assert.ok(
    hasNumericThresholds || hasQualitativeThreshold,
    `${tileId} must define numeric thresholds or deliberate qualitative threshold guidance`,
  );

  const defaultViz = block.match(/^default_viz = (.+)$/m)?.[1] ?? "";
  if (defaultViz === "splunk.table") continue;
  const valueField = overview.valueField ?? vizOptions.valueField;
  assert.ok(
    typeof valueField === "string" && valueField.trim().length > 0,
    `${tileId} (${stanzaId}) must bind an explicit headline valueField`,
  );

  const search = block.match(/^search = ([\s\S]*?)(?=\n\n|$)/m)?.[1] ?? "";
  const isTimeSeries =
    /^splunk\.(line|area|column)$/.test(defaultViz) &&
    /\| timechart /i.test(search);
  if (isTimeSeries) {
    const sparkDataField = overview.sparkDataField ?? vizOptions.sparkDataField;
    assert.ok(
      typeof sparkDataField === "string" && sparkDataField.trim().length > 0,
      `${tileId} (${stanzaId}) must bind an explicit sparkDataField`,
    );
  }

  const drilldownSearchName = block.match(
    /^drilldown_search_name = (.+)$/m,
  )?.[1];
  assert.ok(
    drilldownSearchName,
    `${tileId} (${stanzaId}) must declare its detail drilldown search`,
  );
  const drilldownMatches = searchbaseConf
    .split(/(?=^\[)/m)
    .filter(
      (candidate) =>
        candidate.match(/^search_name = (.+)$/m)?.[1] === drilldownSearchName,
    );
  assert.equal(
    drilldownMatches.length,
    1,
    `${tileId} must resolve ${drilldownSearchName} to exactly one Searchbase stanza`,
  );
  assert.match(
    drilldownMatches[0],
    /^default_viz = splunk\.table$/m,
    `${tileId} drilldown must use a detail-table visualization`,
  );
  assert.match(
    drilldownMatches[0],
    /^search = .+$/m,
    `${tileId} drilldown must contain executable SPL`,
  );
}

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
