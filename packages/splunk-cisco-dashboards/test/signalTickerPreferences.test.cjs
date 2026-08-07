"use strict";

const assert = require("assert").strict;
const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const packageRoot = path.resolve(__dirname, "..");
const configPath = path.join(
  packageRoot,
  "src/main/webapp/common/config/signalTicker.ts",
);
const configSource = fs.readFileSync(configPath, "utf8");
const configOutput = ts.transpileModule(configSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
  fileName: configPath,
}).outputText;
const configModule = { exports: {} };
new Function(
  "exports",
  "module",
  "require",
  "__filename",
  "__dirname",
  configOutput,
)(
  configModule.exports,
  configModule,
  require,
  configPath,
  path.dirname(configPath),
);

const {
  DEFAULT_SIGNAL_TICKER_CONFIG,
  MAX_SIGNAL_TICKER_ITEMS,
  applySignalTickerPreferencePatch,
  createSignalTickerPreferencePatch,
  getDefaultSignalTickerConfig,
  sanitizeSignalTickerConfig,
  sanitizeSignalTickerPreferencePatch,
} = configModule.exports;

const workspaceIds = [
  "secure_networking",
  "zero_trust_access_demo",
  "network_resilience_demo",
  "security_operations_demo",
  "executive",
];
const expectedWorkspaceItemIds = {
  secure_networking: [
    "zta_auth_failure_rate",
    "dc_critical_anomalies",
    "sgt_active_assignments",
    "hmf_blocked_flows",
    "te_degraded_tests",
    "palo_alto_sgt_blocks",
  ],
  zero_trust_access_demo: [
    "zta_auth_failure_rate",
    "zta_failed_identities",
    "zta_auth_events",
    "ise_device_footprint",
    "sgt_active_assignments",
    "security_domain_score",
  ],
  network_resilience_demo: [
    "network_health",
    "device_health",
    "critical_network_issues",
    "dc_critical_anomalies",
    "dc_critical_advisories",
    "catalyst_center_age",
  ],
  security_operations_demo: [
    "xdr_incidents",
    "hmf_blocked_flows",
    "zta_failed_identities",
    "zta_auth_failure_rate",
    "dc_critical_advisories",
    "palo_alto_sgt_blocks",
  ],
  executive: [
    "it_domain_score",
    "security_domain_score",
    "user_experience_score",
    "building_domain_score",
    "critical_network_issues",
    "xdr_incidents",
  ],
};
for (const workspaceId of workspaceIds) {
  const fallback = getDefaultSignalTickerConfig(workspaceId);
  assert.ok(fallback.items.length > 0, `${workspaceId} needs a fallback rail`);
  assert.ok(
    fallback.items.length <= MAX_SIGNAL_TICKER_ITEMS,
    `${workspaceId} fallback must remain bounded`,
  );
  assert.deepEqual(
    fallback.items.map(({ id }) => id),
    expectedWorkspaceItemIds[workspaceId],
    `${workspaceId} needs its intended audience-specific rail`,
  );
}

const base = getDefaultSignalTickerConfig("secure_networking");
assert.equal(base.density, "comfortable");
assert.equal(base.fontSize, "standard");
const customized = {
  ...base,
  rows: 2,
  speed: 8,
  items: base.items.slice(0, 3),
};
const patch = createSignalTickerPreferencePatch(base, customized);
assert.deepEqual(Object.keys(patch).sort(), ["items", "rows", "speed"]);
assert.deepEqual(
  patch.items,
  base.items.slice(0, 3).map(({ id }) => ({ id })),
  "item selection must store IDs and explicit deltas instead of stale copies",
);
assert.deepEqual(applySignalTickerPreferencePatch(base, patch), customized);
assert.equal(createSignalTickerPreferencePatch(base, base), null);
assert.deepEqual(
  createSignalTickerPreferencePatch(base, { ...base, fontSize: "small" }),
  { fontSize: "small" },
  "font size must persist as a sparse workspace preference",
);

const updatedCentral = {
  ...base,
  items: base.items.map((item, index) =>
    index === 0 ? { ...item, thresholdWarning: 45 } : item,
  ),
};
assert.equal(
  applySignalTickerPreferencePatch(updatedCentral, patch).items[0]
    .thresholdWarning,
  45,
  "an unmodified item field must continue inheriting central updates",
);

const hostileItems = Array.from({ length: 40 }, (_, index) => ({
  id: `item_${index}`,
  searchName: `Search ${index}`,
}));
const bounded = sanitizeSignalTickerConfig({ ...base, items: hostileItems });
assert.equal(bounded.items.length, MAX_SIGNAL_TICKER_ITEMS);
assert.deepEqual(
  sanitizeSignalTickerPreferencePatch({ rows: 3, speed: 999, enabled: false }),
  { speed: 10, enabled: false },
);
assert.equal(
  sanitizeSignalTickerConfig({ ...base, density: undefined }).density,
  "comfortable",
  "missing density must retain the comfortable factory default",
);

const conf = fs.readFileSync(
  path.join(
    packageRoot,
    "src/main/resources/splunk/default/insights_workspaces.conf",
  ),
  "utf8",
);
const stanzaBlocks = conf.split(/(?=^\[)/m);
const signalItemNames = stanzaBlocks
  .filter((block) => block.startsWith("[signal_item."))
  .map((block) => block.match(/^\[signal_item\.([^\]]+)\]/)?.[1]);
assert.equal(
  signalItemNames.length,
  DEFAULT_SIGNAL_TICKER_CONFIG.items.length,
  "TypeScript and central Signal Rail catalogues must contain the same items",
);
assert.equal(
  signalItemNames.length,
  MAX_SIGNAL_TICKER_ITEMS,
  "the reusable Signal Rail catalogue should stay within the bounded fallback size",
);
assert.deepEqual(
  new Set(signalItemNames),
  new Set(DEFAULT_SIGNAL_TICKER_CONFIG.items.map(({ id }) => id)),
  "TypeScript and central Signal Rail catalogue IDs must match",
);

const searchbase = fs.readFileSync(
  path.join(
    packageRoot,
    "src/main/resources/splunk/default/searchbase.conf",
  ),
  "utf8",
);
const searchbaseNames = new Set(
  [...searchbase.matchAll(/^search_name = (.+)$/gm)].map((match) => match[1]),
);
for (const item of DEFAULT_SIGNAL_TICKER_CONFIG.items) {
  assert.ok(
    searchbaseNames.has(item.searchName),
    `Signal Rail item ${item.id} references missing search ${item.searchName}`,
  );
}
const searchbaseBlocks = searchbase.split(/(?=^\[)/m);
const deliberateNonTimechartSignalSearches = new Set([
  "Executive - Security Domain Score",
  "Executive - Network Health Score Trend",
  "Executive - IT Domain Score",
  "Executive - User Experience Score",
  "Executive - Building Domain Score",
  "Executive - Issue Summary KPIs",
  "Feed Monitor - ThousandEyes - Stream Staleness (Signal Rail KPI)",
  "Feed Monitor - FTD Firewall - Stream Staleness (Signal Rail KPI)",
  "Feed Monitor - FMC eStreamer - IPS Feed Staleness (Signal Rail KPI)",
  "Feed Monitor - ISE - RADIUS Syslog Staleness (Signal Rail KPI)",
  "Feed Monitor - Catalyst Center - API Feed Staleness (Signal Rail KPI)",
  "Feed Monitor - Cisco Spaces - Firehose Staleness (Signal Rail KPI)",
]);
for (const searchName of new Set(
  DEFAULT_SIGNAL_TICKER_CONFIG.items.map(({ searchName }) => searchName),
)) {
  const block = searchbaseBlocks.find(
    (candidate) =>
      candidate.match(/^search_name = (.+)$/m)?.[1] === searchName,
  );
  assert.ok(block, "missing Signal Rail search " + searchName);
  if (deliberateNonTimechartSignalSearches.has(searchName)) continue;
  assert.match(
    block,
    /\| timechart /i,
    searchName + " must expose a Signal Rail timechart",
  );
}
const paloAltoRailSearch = searchbaseBlocks.find((block) =>
  block.startsWith("[secure_networking_palo_alto_policy_enforcement_signal]"),
);
assert.ok(paloAltoRailSearch, "missing the bounded Palo Alto Signal Rail search");
assert.match(paloAltoRailSearch, /sourcetype="pan:traffic"/);
assert.match(paloAltoRailSearch, /timechart fixedrange=false cont=false bins=60/);
assert.match(paloAltoRailSearch, /Blocked=coalesce\(Blocked,0\)/);
assert.doesNotMatch(
  paloAltoRailSearch,
  /\| multisearch|\| eventstats/,
  "the always-on Palo Alto rail search must defer identity correlation to drill-down",
);
for (const workspaceId of workspaceIds) {
  const block = stanzaBlocks.find((candidate) =>
    candidate.startsWith(`[signal_rail.${workspaceId}]`),
  );
  assert.ok(block, `missing central Signal Rail preset for ${workspaceId}`);
  assert.match(block, /^density = comfortable$/m);
  assert.match(block, /^font_size = standard$/m);
  const itemIds = block.match(/^items = (.*)$/m)?.[1].split(",") ?? [];
  assert.ok(itemIds.length > 0 && itemIds.length <= MAX_SIGNAL_TICKER_ITEMS);
  assert.deepEqual(
    itemIds,
    expectedWorkspaceItemIds[workspaceId],
    `${workspaceId} central preset must match its TypeScript fallback`,
  );
  for (const itemId of itemIds) {
    assert.ok(
      signalItemNames.includes(itemId),
      `${workspaceId} references unknown Signal Rail item ${itemId}`,
    );
  }
}

const preferenceService = fs.readFileSync(
  path.join(
    packageRoot,
    "src/main/webapp/common/services/signalTickerPreferenceService.ts",
  ),
  "utf8",
);
assert.match(
  preferenceService,
  /servicesNS\/\$\{encodeURIComponent\(owner\)\}/,
);
assert.doesNotMatch(preferenceService, /servicesNS\/nobody/);
assert.match(preferenceService, /MAX_PREFERENCE_JSON_CHARS = 65_536/);
assert.match(preferenceService, /search: `name="\$\{name\}"`/);
assert.match(preferenceService, /const stanzaPresence = new Map/);

const preferenceServiceOutput = ts.transpileModule(preferenceService, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
  fileName: "signalTickerPreferenceService.ts",
}).outputText;
const preferenceServiceModule = { exports: {} };
const preferenceServiceRequire = (moduleName) => {
  if (moduleName === "@splunk/splunk-utils/fetch") {
    return { createFetchInit: (init) => init };
  }
  if (moduleName === "@/common/config/insightsWorkspaces") {
    return { isWorkspaceId: (value) => workspaceIds.includes(value) };
  }
  if (moduleName === "@/common/config/signalTicker") {
    return {
      sanitizeSignalTickerPreferencePatch: (value) =>
        value && typeof value === "object" ? value : null,
    };
  }
  throw new Error(`Unexpected test dependency: ${moduleName}`);
};
new Function(
  "exports",
  "module",
  "require",
  "__filename",
  "__dirname",
  preferenceServiceOutput,
)(
  preferenceServiceModule.exports,
  preferenceServiceModule,
  preferenceServiceRequire,
  "signalTickerPreferenceService.ts",
  packageRoot,
);

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
assert.match(appConf, /^reload\.insights_workspace_preferences = simple$/m);
assert.match(
  serverConf,
  /^conf_replication_include\.insights_workspace_preferences = true$/m,
);
assert.match(defaultMeta, /^\[insights_workspace_preferences\]$/m);
assert.match(defaultMeta, /^export = none$/m);

const {
  deleteSignalTickerPreference,
  loadSignalTickerPreference,
  saveSignalTickerPreference,
} = preferenceServiceModule.exports;

const originalWindow = global.window;
const originalDocument = global.document;
const originalFetch = global.fetch;
const queuedResponses = [];
const capturedRequests = [];
const jsonResponse = (status, body = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

const restoreGlobal = (name, value) => {
  if (value === undefined) delete global[name];
  else global[name] = value;
};

(async () => {
  global.window = {
    __SPLUNK_RUNTIME__: true,
    $C: { USERNAME: "alice" },
    setTimeout,
  };
  global.document = { cookie: "" };
  global.fetch = async (url, init = {}) => {
    capturedRequests.push({ url: String(url), init });
    assert.ok(queuedResponses.length, `unexpected fetch: ${url}`);
    return queuedResponses.shift();
  };

  try {
    queuedResponses.push(jsonResponse(200, { entry: [] }));
    const emptyLoad = await loadSignalTickerPreference("secure_networking");
    assert.deepEqual(emptyLoad, { available: true, patch: null });
    assert.equal(capturedRequests.length, 1);
    const lookupUrl = new URL(capturedRequests[0].url, "http://localhost");
    assert.ok(
      lookupUrl.pathname.endsWith("/conf-insights_workspace_preferences"),
      "missing preferences must query the collection instead of a stanza URL",
    );
    assert.equal(lookupUrl.searchParams.get("count"), "1");
    assert.equal(
      lookupUrl.searchParams.get("search"),
      'name="signal_rail.secure_networking"',
    );

    queuedResponses.push(jsonResponse(201));
    assert.equal(
      await saveSignalTickerPreference("secure_networking", {
        density: "comfortable",
      }),
      true,
    );
    assert.equal(capturedRequests.length, 2, "known absence must skip an update probe");
    assert.equal(capturedRequests[1].init.method, "POST");
    assert.ok(
      capturedRequests[1].init.body.includes(
        "name=signal_rail.secure_networking",
      ),
    );

    queuedResponses.push(jsonResponse(200));
    assert.equal(await deleteSignalTickerPreference("secure_networking"), true);
    assert.equal(capturedRequests.length, 3);
    assert.equal(capturedRequests[2].init.method, "DELETE");

    assert.equal(await deleteSignalTickerPreference("secure_networking"), true);
    assert.equal(
      capturedRequests.length,
      3,
      "resetting an already absent override must not issue a DELETE probe",
    );

    queuedResponses.push(
      jsonResponse(200, {
        entry: [
          {
            name: "signal_rail.executive",
            content: {
              preferences_json: JSON.stringify({ speed: 6 }),
            },
          },
        ],
      }),
    );
    const existingLoad = await loadSignalTickerPreference("executive");
    assert.deepEqual(existingLoad, {
      available: true,
      patch: { speed: 6 },
    });

    queuedResponses.push(jsonResponse(200));
    assert.equal(
      await saveSignalTickerPreference("executive", { speed: 8 }),
      true,
    );
    assert.equal(capturedRequests.length, 5, "known presence must update directly");
    assert.ok(capturedRequests[4].url.endsWith("/signal_rail.executive"));

    queuedResponses.push(jsonResponse(200));
    assert.equal(await deleteSignalTickerPreference("executive"), true);
    assert.equal(capturedRequests.length, 6);

    console.log(
      "✓ Signal Rail central defaults and private preference tests passed",
    );
  } finally {
    restoreGlobal("window", originalWindow);
    restoreGlobal("document", originalDocument);
    restoreGlobal("fetch", originalFetch);
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
