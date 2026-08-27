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
const searchbaseSource = readSource(
  "src/main/resources/splunk/default/searchbase.conf",
);
const studioViewsByPillar = {
  "zero-trust-access": "sn_zta_posture",
  "secure-infrastructure": "sn_secure_infrastructure_posture",
  "scalable-network-segmentation": "sn_segmentation_readiness",
  "hybrid-mesh-firewalling": "sn_hmf_enforcement",
  "agentic-ops": "sn_agentic_ops_operational_intelligence",
};
const studioDefinitionsByPillar = Object.fromEntries(
  Object.entries(studioViewsByPillar).map(([pillarId, viewName]) => {
    const source = readSource(
      `src/main/resources/splunk/default/data/ui/views/${viewName}.xml`,
    );
    return [pillarId, JSON.parse(source.match(/<!\[CDATA\[([\s\S]*?)\]\]>/)[1])];
  }),
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
          cyan: "#049fd9",
          cyanBright: "#00bceb",
          positive: "#4cbf7f",
          caution: "#f0c243",
          orange: "#f7782f",
          critical: "#fa5762",
          lavender: "#9ca6ff",
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

const { PILLARS, PILLAR_CARDS, ZERO_TRUST_CARDS } = configModule.exports;

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
  5,
  "All five pillar tabs must render a complete native dashboard",
);
assert.equal(PILLARS[0].studioView, "sn_zta_posture");
assert.deepEqual(
  Array.from(PILLARS, (pillar) => pillar.studioView),
  Object.values(studioViewsByPillar),
  "Each native tab must retain its side-by-side Studio comparison target",
);

const allCards = Array.from(PILLARS).flatMap((pillar) =>
  Array.from(PILLAR_CARDS[pillar.id]),
);
assert.equal(allCards.length, 30, "The five pillar dashboards must expose 30 cards");
for (const pillar of PILLARS) {
  assert.equal(
    PILLAR_CARDS[pillar.id].length,
    6,
    `${pillar.label} must retain all six Studio stories`,
  );
  assert.equal(pillar.journey.length, 4, `${pillar.label} must expose a four-stage journey`);
}
assert.equal(
  new Set(allCards.map((card) => card.id)).size,
  allCards.length,
  "Card IDs must remain unique across all five dashboards",
);

assert.equal(
  ZERO_TRUST_CARDS.length,
  6,
  "The Zero Trust dashboard must retain all six Studio stories",
);
assert.deepEqual(
  new Set(Array.from(ZERO_TRUST_CARDS, (card) => card.kind)),
  new Set(["stacked-columns", "line", "table", "ranked-bars"]),
  "The native dashboards must retain the full Studio visualization mix",
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
const stanzaBySearchName = new Map();
let activeStanzaId = null;
for (const line of searchbaseSource.split(/\r?\n/)) {
  const stanzaMatch = line.match(/^\[([^\]]+)\]$/);
  if (stanzaMatch) {
    activeStanzaId = stanzaMatch[1];
    continue;
  }
  const searchNameMatch = line.match(/^search_name\s*=\s*(.+)$/);
  if (activeStanzaId && searchNameMatch && !stanzaBySearchName.has(searchNameMatch[1])) {
    stanzaBySearchName.set(searchNameMatch[1], activeStanzaId);
  }
}

for (const card of allCards) {
  assert.ok(stanzaIds.has(card.searchId), `Missing primary Searchbase stanza: ${card.searchId}`);
  assert.ok(card.drilldownIds.length > 0, `${card.id} must have a native investigation path`);
  for (const drilldownId of card.drilldownIds) {
    assert.ok(stanzaIds.has(drilldownId), `Missing drilldown Searchbase stanza: ${drilldownId}`);
  }
}

const normalizeMarkdownTitle = (value) =>
  String(value || "")
    .replace(/^\*\*|\*\*$/g, "")
    .replace(/\\([\-().])/g, "$1");
const studioKindByType = {
  "splunk.column": "stacked-columns",
  "splunk.line": "line",
  "splunk.table": "table",
  "splunk.bar": "ranked-bars",
};

for (const pillar of PILLARS) {
  const definition = studioDefinitionsByPillar[pillar.id];
  const cards = Array.from(PILLAR_CARDS[pillar.id]);
  const configuredSearchIds = [];

  cards.forEach((card, index) => {
    const story = String(index + 1).padStart(2, "0");
    const dataSource = definition.dataSources[`ds_story_${story}`];
    const title = definition.visualizations[`viz_card_${story}_title`];
    const trend = definition.visualizations[`viz_card_${story}_trend`];
    const trigger = definition.visualizations[`viz_card_${story}_drilldown_trigger`];
    const targetUrl = trigger.eventHandlers[0].options.url;
    const targetNames = new URL(targetUrl, "https://localhost").searchParams
      .get("target")
      .split(",");
    const targetIds = targetNames.map((target) =>
      stanzaIds.has(target) ? target : stanzaBySearchName.get(target),
    );

    configuredSearchIds.push(card.searchId);
    assert.equal(
      card.searchId,
      dataSource.options.ref,
      `${pillar.label} story ${index + 1} must use the Studio primary Searchbase binding`,
    );
    assert.equal(
      card.title,
      normalizeMarkdownTitle(title.options.markdown),
      `${pillar.label} story ${index + 1} must retain the Studio title`,
    );
    assert.equal(
      card.kind,
      studioKindByType[trend.type],
      `${card.title} must retain the Studio visualization contract`,
    );
    assert.ok(
      targetIds.every(Boolean),
      `${card.title} contains an unresolved Studio drilldown target: ${targetNames.join(", ")}`,
    );
    assert.deepEqual(
      Array.from(card.drilldownIds),
      targetIds,
      `${card.title} must retain every Studio drilldown in order`,
    );
  });

  assert.deepEqual(
    configuredSearchIds,
    Object.values(definition.dataSources).map((source) => source.options.ref),
    `${pillar.label} must share all six Studio primary search contracts`,
  );
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
  normalizePillarRows(
    [
      { _time: "2026-08-21T11:00:00Z", assignments_trend: "0", total_assignments: "0" },
      { _time: "2026-08-21T12:00:00Z", assignments_trend: "0", total_assignments: "0" },
    ],
    { zeroOnlyIsEmpty: true },
  ).length,
  0,
  "A multi-row synthetic all-zero fallback must be treated as no data",
);
assert.equal(
  normalizePillarRows([
    { category: "No matching telemetry was found.", value: "0" },
  ]).length,
  0,
  "A Searchbase message row must not be rendered as evidence",
);
assert.equal(
  normalizePillarRows([
    {
      _time: "2026-08-21T12:00:00Z",
      avg_loss_pct: "0",
      WindowAvgLossPct: "0",
      "No matching telemetry was found. Widen the time range.": "0",
    },
  ]).length,
  0,
  "A no-data marker stored in a field name must not become a chart series",
);
assert.equal(
  normalizePillarRows([
    { Test: "No telemetry", "Minimum Availability %": null },
  ]).length,
  0,
  "A labelled null telemetry sentinel must not be rendered as evidence",
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
assert.equal(
  normalizePillarRows(
    [
      {
        _time: "2026-08-21T12:00:00Z",
        AdoptionRate: "0",
        WindowAdoptionRate: "0",
        AuthEvents: "42",
        TaggedAuthEvents: "0",
      },
    ],
    { zeroOnlyIsEmpty: true },
  ).length,
  1,
  "A real zero adoption rate with observed authentication volume must remain live",
);

assert.match(pageSource, /<TabLayout[\s\S]*?<TabLayout\.Panel/);
assert.match(pageSource, /<PillarDashboard/);
assert.match(pageSource, /PILLAR_CARDS\[pillar\.id\]/);
assert.doesNotMatch(pageSource, /PillarPreview|ZeroTrustDashboard|React pilot/);
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
assert.match(chartSource, /connectNulls=\{card\.connectNulls\}/);
assert.match(chartSource, /card\.rankLimit \?\? 10/);
assert.match(chartSource, /card\.valueLabel \?\? valueField/);
assert.match(chartSource, /card\.excludedSeriesFields/);
assert.match(searchSource, /\.\.\.Object\.keys\(row\)/);
assert.match(searchSource, /rows\.flatMap/);
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

const DARK_STUDIO_CARD_SURFACE = "#131a23";
const relativeLuminance = (hexColor) => {
  const channels = hexColor
    .match(/[0-9a-f]{2}/gi)
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4,
    );
  return (
    0.2126 * channels[0] +
    0.7152 * channels[1] +
    0.0722 * channels[2]
  );
};
const contrastRatio = (foreground, background) => {
  const lighter = Math.max(
    relativeLuminance(foreground),
    relativeLuminance(background),
  );
  const darker = Math.min(
    relativeLuminance(foreground),
    relativeLuminance(background),
  );
  return (lighter + 0.05) / (darker + 0.05);
};

const pillarNavSource = navSource.split('<collection label="More"')[0];
const pillarViewNames = Array.from(
  pillarNavSource.matchAll(/dashboard_manager#\/([^"?]+)/g),
  (match) => match[1],
);
assert.equal(pillarViewNames.length, 17, "The five pillar collections must retain 17 Studio dashboards");
let pillarVisibleTrendCount = 0;
for (const viewName of pillarViewNames) {
  const source = readSource(
    `src/main/resources/splunk/default/data/ui/views/${viewName}.xml`,
  );
  const definition = JSON.parse(source.match(/<!\[CDATA\[([\s\S]*?)\]\]>/)[1]);
  const bindingSignatures = [];
  for (const visualization of Object.values(definition.visualizations)) {
    if (visualization.type !== "splunk.singlevalue") continue;
    const options = visualization.options || {};
    const showsTrend =
      options.showTrendIndicator === true && options.trendDisplay !== "off";
    if (showsTrend) {
      pillarVisibleTrendCount += 1;
      assert.equal(
        options.trendColor,
        "> trendValue | rangeValue(trendColorEditorConfig)",
        `${viewName} must apply semantic colors to visible trend values`,
      );
    } else {
      assert.equal(
        Object.hasOwn(options, "trendColor"),
        false,
        `${viewName} must not initialize color for a hidden trend value`,
      );
    }
    bindingSignatures.push(JSON.stringify({
      primary: visualization.dataSources?.primary,
      majorValue: options.majorValue,
      sparklineValues: options.sparklineValues,
    }));
  }
  assert.equal(bindingSignatures.length, 6, `${viewName} must retain six KPI cards`);
  assert.equal(
    new Set(bindingSignatures).size,
    bindingSignatures.length,
    `${viewName} must not duplicate a complete metric result binding`,
  );
}
assert.equal(
  pillarVisibleTrendCount,
  65,
  "all visible Secure Networking trends must retain semantic color bindings",
);

const studioViewsPath = path.join(
  packageRoot,
  "src/main/resources/splunk/default/data/ui/views",
);
const studioViewFiles = fs
  .readdirSync(studioViewsPath)
  .filter((fileName) => fileName.endsWith(".xml"))
  .filter((fileName) =>
    /<dashboard\s+version="2"/.test(
      fs.readFileSync(path.join(studioViewsPath, fileName), "utf8"),
    ),
  )
  .sort();
let allVisibleTrendCount = 0;
for (const fileName of studioViewFiles) {
  const source = fs.readFileSync(path.join(studioViewsPath, fileName), "utf8");
  const definition = JSON.parse(source.match(/<!\[CDATA\[([\s\S]*?)\]\]>/)[1]);
  assert.match(
    source,
    /<dashboard\s+version="2"[^>]*theme="dark"/,
    `${fileName} must declare the dark Studio theme`,
  );

  for (const [visualizationId, visualization] of Object.entries(
    definition.visualizations || {},
  )) {
    const options = visualization.options || {};
    for (const propertyName of ["fontColor", "majorColor"]) {
      const color = options[propertyName];
      if (typeof color !== "string" || !/^#[0-9a-f]{6}$/i.test(color)) {
        continue;
      }
      const minimumContrast = propertyName === "fontColor" ? 4.5 : 3;
      assert.ok(
        contrastRatio(color, DARK_STUDIO_CARD_SURFACE) >= minimumContrast,
        `${fileName}:${visualizationId} ${propertyName} ${color} is too dark for the managed dark surface`,
      );
    }

    if (visualization.type !== "splunk.singlevalue") continue;
    const showsTrend =
      options.showTrendIndicator === true && options.trendDisplay !== "off";
    if (!showsTrend) continue;

    allVisibleTrendCount += 1;
    assert.ok(
      options.trendColor,
      `${fileName}:${visualizationId} must bind a visible trend color instead of falling back to black`,
    );
    if (/^#[0-9a-f]{6}$/i.test(options.trendColor)) {
      assert.ok(
        contrastRatio(options.trendColor, DARK_STUDIO_CARD_SURFACE) >= 3,
        `${fileName}:${visualizationId} trend color ${options.trendColor} is too dark for the managed dark surface`,
      );
    }
    for (const { value: color } of
      visualization.context?.trendColorEditorConfig || []) {
      assert.match(
        color,
        /^#[0-9a-f]{6}$/i,
        `${fileName}:${visualizationId} must use a literal semantic trend color`,
      );
      assert.ok(
        contrastRatio(color, DARK_STUDIO_CARD_SURFACE) >= 3,
        `${fileName}:${visualizationId} semantic trend color ${color} is too dark for the managed dark surface`,
      );
    }
  }
}
assert.equal(
  studioViewFiles.length,
  26,
  "the color audit must cover every shipped Studio dashboard",
);
assert.equal(
  allVisibleTrendCount,
  107,
  "the color audit must cover every visible Studio trend value",
);
console.log("Secure Networking React pillar dashboard checks passed.");
