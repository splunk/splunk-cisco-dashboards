"use strict";

const assert = require("assert").strict;
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const babel = require("@babel/core");

const packageRoot = path.resolve(__dirname, "..");
const readSource = (relativePath) =>
  fs.readFileSync(path.join(packageRoot, relativePath), "utf8");

const pageRoot = "src/main/webapp/pages/secure_networking_pillars";
const configSource = readSource(`${pageRoot}/config.ts`);
const pageSource = readSource(`${pageRoot}/index.tsx`);
const chartSource = readSource(`${pageRoot}/charts.tsx`);
const searchSource = readSource(`${pageRoot}/search.ts`);
const renderSource = readSource(`${pageRoot}/render.tsx`);
const pageStyles = readSource(`${pageRoot}/secure-networking-pillars.css`);
const sharedStyles = readSource("src/main/webapp/common/styles/tailwind.css");
const viewSource = readSource(
  "src/main/resources/splunk/default/data/ui/views/secure_networking_pillars.xml",
);
const bootstrapSource = readSource(
  "src/main/resources/splunk/appserver/static/secure_networking_pillars_bootstrap.js",
);
const navSource = readSource(
  "src/main/resources/splunk/default/data/ui/nav/default.xml",
);
const webpackSource = readSource("webpack.config.js");
const assetVerifierSource = readSource("bin/verify_production_assets.js");
const buildProfile = JSON.parse(readSource("config/build-profile-manifest.json"));
const searchbaseSource = readSource(
  "src/main/resources/splunk/default/searchbase.conf",
);
const studioViewSource = readSource(
  "src/main/resources/splunk/default/data/ui/views/sn_zta_posture.xml",
);
const searchServiceSource = readSource(
  "src/main/webapp/common/services/splunkSearchService.js",
);

const compiledConfig = babel.transformSync(configSource, {
  filename: "config.ts",
  presets: ["@babel/preset-typescript"],
  plugins: ["@babel/plugin-transform-modules-commonjs"],
}).code;
const configModule = { exports: {} };
const loadConfig = vm.runInNewContext(
  `(function(require, module, exports) {${compiledConfig}\n})`,
);
loadConfig(
  (moduleId) => {
    if (moduleId === "@/common/theme/c3VisualizationPalette") {
      return {
        C3_VISUALIZATION_COLORS: {
          info: "#649ef5",
          positive: "#4cbf7f",
          caution: "#f0c243",
          critical: "#fa5762",
          neutral: "#a6adb6",
          purple: "#9b5ff5",
        },
      };
    }
    throw new Error(`Unexpected config import: ${moduleId}`);
  },
  configModule,
  configModule.exports,
);

const { PILLARS, ZERO_TRUST_CARDS } = configModule.exports;

const compiledSearch = babel.transformSync(searchSource, {
  filename: "search.ts",
  presets: ["@babel/preset-typescript"],
  plugins: ["@babel/plugin-transform-modules-commonjs"],
}).code;
const searchModule = { exports: {} };
const loadSearch = vm.runInNewContext(
  `(function(require, module, exports) {${compiledSearch}\n})`,
);
loadSearch(
  (moduleId) => {
    if (moduleId === "react") {
      return { useEffect() {}, useMemo() {}, useState() {} };
    }
    if (moduleId === "@/common/services/searchbaseCatalogue") {
      return { getSearchbaseCatalogue() {} };
    }
    if (moduleId === "@/common/services/splunkSearchService") {
      return { isAbortError() {}, runSearch() {} };
    }
    throw new Error(`Unexpected search import: ${moduleId}`);
  },
  searchModule,
  searchModule.exports,
);

const { normalizePillarRows } = searchModule.exports;

assert.equal(PILLARS.length, 5, "The React shell must expose exactly five pillar tabs");
assert.deepEqual(
  Array.from(PILLARS, (pillar) => pillar.id),
  [
    "zero-trust-access",
    "secure-infrastructure",
    "scalable-network-segmentation",
    "hybrid-mesh-firewalling",
    "agentic-ops",
  ],
  "Pillar order must match the shipped Secure Networking navigation",
);
assert.equal(
  PILLARS.filter((pillar) => pillar.implemented).length,
  1,
  "The proof of concept must identify one implemented pilot without mislabeling future tabs",
);
assert.equal(PILLARS[0].studioView, "sn_zta_posture");

assert.equal(
  ZERO_TRUST_CARDS.length,
  6,
  "The React pilot must retain all six Zero Trust Posture stories",
);
assert.deepEqual(
  new Set(Array.from(ZERO_TRUST_CARDS, (card) => card.kind)),
  new Set(["stacked-columns", "line", "table", "ranked-bars"]),
  "The pilot must exercise the Studio dashboard's full visualization mix",
);

const expectedCardContracts = {
  "authentication-outcomes": {
    searchId: "secure_networking_zta_auth_outcome_trend",
    headlineField: "WindowAuthentications",
    drilldownIds: [
      "secure_networking_zta_failure_reasons_by_site",
      "secure_networking_zta_ise_auth_by_device_fail_rate",
    ],
  },
  "authentication-friction": {
    searchId: "secure_networking_zta_ise_auth_failure_rate_trend",
    headlineField: "WindowFailureRatePct",
    drilldownIds: ["secure_networking_zta_ise_auth_by_device_fail_rate"],
  },
  "private-access-status": {
    searchId: "secure_networking_zta_ztna_connection_status_trend",
    headlineField: "WindowConnections",
    drilldownIds: [
      "secure_networking_zta_ztna_app_access_summary",
      "secure_networking_zta_ztna_blocked_access_reasons",
    ],
  },
  "remote-access-health": {
    searchId: "secure_networking_zta_ravpn_connection_attempts_trend",
    headlineField: "WindowFailureRatePct",
    drilldownIds: [
      "secure_networking_zta_ravpn_sessions_by_profile",
      "secure_networking_zta_ravpn_failure_reasons",
      "secure_networking_zta_ravpn_posture_alerts",
    ],
  },
  "risky-mfa-outcomes": {
    searchId: "secure_networking_zta_risky_mfa_outcomes_by_application_factor",
    headlineField: "_WindowRiskyOutcomes",
    drilldownIds: [
      "secure_networking_zta_risky_mfa_outcomes_by_application_factor",
      "secure_networking_infra_duo_blocked_posture_identity",
    ],
  },
  "control-telemetry-volume": {
    searchId: "secure_networking_zta_user_activity_by_source_summary",
    headlineField: "_WindowEvents",
    drilldownIds: ["secure_networking_zta_user_activity_cross_source"],
  },
};
for (const card of ZERO_TRUST_CARDS) {
  const expected = expectedCardContracts[card.id];
  assert.ok(expected, `Missing expected contract for ${card.id}`);
  assert.equal(card.searchId, expected.searchId);
  assert.equal(card.headlineField, expected.headlineField);
  assert.deepEqual(Array.from(card.drilldownIds), expected.drilldownIds);
}

const stanzaIds = new Set(
  Array.from(searchbaseSource.matchAll(/^\[([^\]]+)\]$/gm), (match) => match[1]),
);
for (const card of ZERO_TRUST_CARDS) {
  assert.ok(stanzaIds.has(card.searchId), `Missing primary Searchbase stanza: ${card.searchId}`);
  assert.ok(card.drilldownIds.length > 0, `${card.id} must have a native investigation path`);
  for (const drilldownId of card.drilldownIds) {
    assert.ok(stanzaIds.has(drilldownId), `Missing drilldown Searchbase stanza: ${drilldownId}`);
  }
}

const remoteAccessCard = ZERO_TRUST_CARDS.find(
  (card) => card.id === "remote-access-health",
);
assert.equal(
  remoteAccessCard.thresholds,
  undefined,
  "React must not invent health bands that are absent from the RaVPN contract",
);

assert.equal(
  normalizePillarRows(
    [{
      _time: "2026-08-21T12:00:00Z",
      "Failure Rate %": "0",
      WindowFailureRatePct: "0",
      BucketAuthentications: "0",
    }],
    { zeroOnlyIsEmpty: true },
  ).length,
  0,
  "A synthetic all-zero time-series fallback must be treated as no data",
);
assert.equal(
  normalizePillarRows([
    { category: "No matching telemetry was found.", value: "0" },
  ]).length,
  0,
  "A Searchbase message row must not be rendered as evidence",
);
assert.equal(
  normalizePillarRows(
    [{
      _time: "2026-08-21T12:00:00Z",
      "Failure Rate %": "0",
      WindowFailureRatePct: "0",
      BucketAuthentications: "42",
    }],
    { zeroOnlyIsEmpty: true },
  ).length,
  1,
  "A healthy zero failure rate with real authentication volume must remain live",
);

const studioDefinition = JSON.parse(
  studioViewSource.match(/<!\[CDATA\[([\s\S]*?)\]\]>/)[1],
);
const studioPrimaryRefs = new Set(
  Object.values(studioDefinition.dataSources).map((source) => source.options.ref),
);
assert.deepEqual(
  new Set(Array.from(ZERO_TRUST_CARDS, (card) => card.searchId)),
  studioPrimaryRefs,
  "React and Studio must share the exact six primary Searchbase bindings",
);

assert.match(pageSource, /<TabLayout[\s\S]*?<TabLayout\.Panel/);
assert.match(pageSource, /new URLSearchParams\(window\.location\.search\)/);
assert.match(pageSource, /window\.history\.pushState/);
assert.match(pageSource, /<WorkspaceModalShell/);
assert.match(pageSource, /<SearchbaseDrilldownGuidance/);
assert.match(pageSource, /<AppearanceMenuItems/);
assert.match(pageSource, /aria-sort=/);
assert.match(pageSource, /No matching evidence/);
assert.match(pageSource, /count:\s*0/);
assert.match(pageSource, /DETAIL_PAGE_SIZE/);
assert.doesNotMatch(pageSource, /visibleColumns\(searchState\.rows\)[\s\S]{0,180}\.slice\(0,\s*9\)/);
assert.match(chartSource, /aria-pressed=/);
assert.match(chartSource, /isAnimationActive=\{false\}/);
assert.match(chartSource, /LIGHT_SAFE_SERIES_COLORS/);
assert.match(chartSource, /minimum \$\{formatValue/);
assert.match(searchSource, /response\?\.cachedFailure/);
assert.match(searchServiceSource, /cachedFailure:\s*true/);
assert.doesNotMatch(
  `${pageSource}\n${chartSource}`,
  /from ['"]@splunk\/dashboard(?:-|['"])/,
  "The proof must not embed the Dashboard Studio runtime",
);

assert.match(renderSource, /allowColorSchemeChoice:\s*true/);
assert.match(renderSource, /secure-networking-pillars\.css/);
assert.match(pageStyles, /@media \(max-width: 820px\)/);
assert.match(pageStyles, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(
  sharedStyles,
  /\.scd-one-cisco-spotlight-canvas\s*\{[\s\S]*?background-color:\s*var\(--sui-background-page,\s*#0b1118\)/,
  "The shared Home canvas must resolve through the active light/dark theme",
);

assert.match(viewSource, /script="application\.js,secure_networking_pillars_bootstrap\.js"/);
assert.match(viewSource, /<div id="scan-root"><\/div>/);
assert.match(bootstrapSource, /pages\/secure_networking_pillars\.js\?v=/);
assert.match(bootstrapSource, /window\.scdSetupGatePromise/);
assert.match(bootstrapSource, /Promise\.resolve\(setupGate\)/);
assert.match(navSource, /href="secure_networking_pillars"/);
assert.match(webpackSource, /secure_networking_pillars:\s*path\.join/);
assert.match(assetVerifierSource, /'secure_networking_pillars'/);
assert.ok(
  buildProfile.developing.views.includes("secure_networking_pillars"),
  "The preview view must be included in developer builds",
);

console.log("Secure Networking React pillar dashboard checks passed.");
