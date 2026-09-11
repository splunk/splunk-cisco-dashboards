"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const packageRoot = path.resolve(__dirname, "..");
const viewPath = path.join(
  packageRoot,
  "src/main/resources/splunk/default/data/ui/views/netops_readiness.xml",
);
const searchbasePath = path.join(
  packageRoot,
  "src/main/resources/splunk/default/searchbase.conf",
);
const savedSearchesPath = path.join(
  packageRoot,
  "src/main/resources/splunk/default/savedsearches.conf",
);

const xml = fs.readFileSync(viewPath, "utf8");
const definitionMatch = xml.match(
  /<definition><!\[CDATA\[([\s\S]*?)\]\]><\/definition>/,
);
assert.ok(definitionMatch, "netops_readiness.xml must contain a Studio definition");
const definition = JSON.parse(definitionMatch[1]);

const qualityFormula = "quality=0.35*h100+0.35*o100+0.30*r100";
const baseFormula =
  "E_base=A*`nrs_w_nrs_a` + R*`nrs_w_nrs_r` + Q*`nrs_w_nrs_q`";

for (const dataSourceId of [
  "ds_a_nrs_forecast",
  "ds_score_nrs_trend",
  "ds_score_per_site",
]) {
  const query = definition.dataSources[dataSourceId].options.query;
  assert.ok(
    query.includes(qualityFormula),
    `${dataSourceId} must use the canonical health/onboarding/RSSI Q formula`,
  );
  assert.ok(
    query.includes(baseFormula),
    `${dataSourceId} must calculate the same ARQ base`,
  );
  assert.ok(
    query.includes("E_base*D_risk"),
    `${dataSourceId} must apply D_risk to the composite`,
  );
  assert.ok(
    query.includes("latest(IssueStatus)"),
    `${dataSourceId} must calculate risk from the latest issue state`,
  );
}

assert.equal(
  definition.dataSources.ds_score_per_site_nrs_only.type,
  "ds.chain",
  "The per-site bar must reuse the detailed per-site score instead of duplicating math",
);
assert.equal(
  definition.dataSources.ds_score_per_site_nrs_only.options.extend,
  "ds_score_per_site",
);
assert.equal(
  definition.dataSources.ds_score_nrs_spark.type,
  "ds.chain",
  "The sparkline must reuse the trend data source instead of duplicating SPL",
);
assert.equal(
  definition.dataSources.ds_score_nrs_spark.options.extend,
  "ds_score_nrs_trend",
);
assert.equal(
  definition.dataSources.ds_score_nrs_spark.options.query,
  "| fields _time NRS",
);
assert.ok(
  definition.dataSources.ds_score_q.options.query.includes(
    "score=0.35*h+0.35*o+0.30*r",
  ),
  "The standalone Q tile must retain the canonical Q weights",
);

assert.deepEqual(
  definition.visualizations.viz_nrs_score.context.majorColorEditorConfig.map(
    ({ from, to }) => ({ from, to }),
  ),
  [{ from: undefined, to: 70 }, { from: 70, to: 80 }, { from: 80, to: undefined }],
  "NRS colors must reflect the achievable 0-85 readiness scale",
);
assert.equal(
  definition.visualizations.viz_nrs_drisk.options.unit,
  "×",
  "D_risk is a multiplier, not a percentage",
);
assert.deepEqual(
  definition.visualizations.viz_nrs_drisk.context.majorColorEditorConfig.map(
    ({ from, to }) => ({ from, to }),
  ),
  [
    { from: undefined, to: 0.75 },
    { from: 0.75, to: 0.9 },
    { from: 0.9, to: undefined },
  ],
  "D_risk colors must use its 0.50-1.00 multiplier scale",
);

const headerCopy = definition.visualizations.viz_tab_a_hdr.options.markdown;
assert.match(headerCopy, /KTP v2\.0\.0-inspired operational adaptation/);
assert.match(headerCopy, /Healthy ≥ 80, watch 70-79, act-now < 70/);
assert.doesNotMatch(headerCopy, /Green ≥ 90|amber 75-89|red < 75/);

const aboutCopy = definition.visualizations.viz_about.options.markdown;
assert.match(aboutCopy, /ktp-rfc\/tree\/v2\.0\.0/);
assert.match(aboutCopy, /does not claim KTP conformance/);
assert.match(aboutCopy, /35% mean client health/);
assert.doesNotMatch(aboutCopy, /standalone Q tile additionally|headline NRS, 60%/i);

const searchbase = fs.readFileSync(searchbasePath, "utf8");
const getStanza = (name) => {
  const marker = `[${name}]`;
  const start = searchbase.indexOf(marker);
  assert.notEqual(start, -1, `${name} must exist in Searchbase`);
  const next = searchbase.indexOf("\n[", start + marker.length);
  return searchbase.slice(start, next === -1 ? undefined : next);
};

for (const stanzaName of [
  "dashboard_netops_readiness_v1_a_nrs_forecast",
  "dashboard_netops_readiness_v1_score_nrs_trend",
  "dashboard_netops_readiness_v1_score_per_site",
]) {
  const stanza = getStanza(stanzaName);
  assert.ok(stanza.includes(qualityFormula), `${stanzaName} Q definition drifted`);
  assert.ok(stanza.includes("E_base*D_risk"), `${stanzaName} omits D_risk`);
  assert.doesNotMatch(stanza, /Q here uses average client health only|not applied|not folded/i);
}

const riskStanza = getStanza("dashboard_netops_readiness_v1_score_drisk");
assert.ok(riskStanza.includes("latest(IssueStatus)"));
assert.doesNotMatch(riskStanza, /do not currently multiply|only surfaced here/i);

const qStanza = getStanza("dashboard_netops_readiness_v1_score_q");
assert.doesNotMatch(qStanza, /distinct from the single-factor Q/i);

const savedSearches = fs.readFileSync(savedSearchesPath, "utf8");
const alertStart = savedSearches.indexOf("[NetOps Alert - NRS Below Threshold]");
const alertEnd = savedSearches.indexOf("\n[", alertStart + 1);
const alert = savedSearches.slice(alertStart, alertEnd);
assert.ok(alert.includes("0.35*h100+0.35*o100+0.30*r100"));
assert.ok(alert.includes("E_base*D_risk"));
assert.doesNotMatch(alert, /D=0\.95|Simplified NRS proxy/);

console.log("✓ NetOps NRS uses one ARQ definition, applies risk, and documents the KTP v2.0.0 adaptation");
