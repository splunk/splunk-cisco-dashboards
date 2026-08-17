"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const packageRoot = path.resolve(__dirname, "..");
const repositoryRoot = path.resolve(packageRoot, "../..");
const searchbase = fs.readFileSync(
  path.join(packageRoot, "src/main/resources/splunk/default/searchbase.conf"),
  "utf8",
);
const xml = fs.readFileSync(
  path.join(
    packageRoot,
    "src/main/resources/splunk/default/data/ui/views/sn_agentic_ops_secure_networking_assurance.xml",
  ),
  "utf8",
);
const storyConfig = JSON.parse(
  fs.readFileSync(
    path.join(repositoryRoot, "scripts/secure_networking_story_dashboards.json"),
    "utf8",
  ),
);
const navigation = fs.readFileSync(
  path.join(packageRoot, "src/main/resources/splunk/default/data/ui/nav/default.xml"),
  "utf8",
);
const mathGuide = fs.readFileSync(path.join(packageRoot, "docs/MATH.md"), "utf8");

const definitionMatch = xml.match(
  /<definition><!\[CDATA\[([\s\S]*?)\]\]><\/definition>/,
);
assert.ok(definitionMatch, "Secure Networking Assurance must contain a Studio definition");
const definition = JSON.parse(definitionMatch[1]);

const getStanza = (name) => {
  const marker = `[${name}]`;
  const start = searchbase.indexOf(marker);
  assert.notEqual(start, -1, `${name} must exist in Searchbase`);
  const next = searchbase.indexOf("\n[", start + marker.length);
  return searchbase.slice(start, next === -1 ? undefined : next);
};

const score = getStanza("secure_networking_assurance_score_trend");
assert.match(score, /E_base=round\(0\.40\*A\+0\.30\*R\+0\.30\*Q,2\)/);
assert.match(score, /SNAS=round\(E_base\*D_risk,2\)/);
assert.match(
  score,
  /D_risk=round\(max\(0\.50,1-0\.50\*\(risk_pressure\/1000\)\),3\)/,
);
assert.match(score, /avg\(metric_name:http\.server\.request\.availability\) as A/);
assert.match(score, /0\.50\*ise_success\+0\.50\*ztna_success/);
assert.match(score, /0\.60\*latency_score\+0\.40\*loss_score/);
assert.match(
  score,
  /where isnotnull\(A\) AND isnotnull\(Q\) AND isnotnull\(ise_success\) AND isnotnull\(ztna_success\)/,
  "The score must require every ARQ source instead of treating missing telemetry as healthy",
);
assert.doesNotMatch(score, /makeresults|random\(|coalesce\([^\n]*(?:A|R|Q|D_risk)[^\n]*,\s*(?:1|100)\)/i);
assert.doesNotMatch(
  score,
  /secure_networking_hmf_unified_blocks|BucketBlocks|WindowBlocks/,
  "Successful enforcement activity must remain evidence, not an automatic score penalty",
);

const componentContracts = [
  ["secure_networking_assurance_attainability_trend", "Attainability", "WindowAttainability"],
  ["secure_networking_assurance_retainability_trend", "Retainability", "WindowRetainability"],
  ["secure_networking_assurance_quality_trend", "Quality", "WindowQuality"],
  ["secure_networking_assurance_contextual_risk_trend", "D_risk", "WindowRiskMultiplier"],
];
for (const [stanzaName, seriesField, valueField] of componentContracts) {
  const stanza = getStanza(stanzaName);
  assert.ok(stanza.includes(seriesField), `${stanzaName} must emit ${seriesField}`);
  assert.ok(stanza.includes(valueField), `${stanzaName} must emit ${valueField}`);
  assert.doesNotMatch(stanza, /makeresults|random\(/i);
}

const story = storyConfig.sn_agentic_ops_secure_networking_assurance;
assert.ok(story, "The assurance dashboard must remain in the story source of truth");
assert.equal(story.cards.length, 6);
assert.deepEqual(
  story.cards.map(({ primary }) => primary),
  [
    "secure_networking_assurance_score_trend",
    "secure_networking_assurance_attainability_trend",
    "secure_networking_assurance_retainability_trend",
    "secure_networking_assurance_quality_trend",
    "secure_networking_assurance_contextual_risk_trend",
    "secure_networking_hmf_unified_blocks_trend",
  ],
);

const orderedRefs = Object.values(definition.dataSources).map(
  (dataSource) => dataSource.options.ref,
);
assert.deepEqual(orderedRefs, story.cards.map(({ primary }) => primary));
const riskTileOptions = definition.visualizations.viz_card_05_singlevalue.options;
assert.equal(riskTileOptions.numberPrecision, 3);
assert.equal(riskTileOptions.shouldAbbreviateMajorValue, false);
assert.equal(riskTileOptions.unit, "×");
assert.match(
  navigation,
  /dashboard_manager#\/sn_agentic_ops_secure_networking_assurance">Secure Networking Assurance/,
);

assert.match(mathGuide, /### 4b\. Secure Networking Assurance Score/);
assert.match(mathGuide, /SNAS = E_base \* D_risk/);
assert.match(mathGuide, /does not\s+claim KTP conformance/i);
assert.match(mathGuide, /Blocks are not automatically treated\s+as failures/i);

console.log(
  "✓ Secure Networking Assurance preserves the ARQ × risk method, requires real telemetry, and keeps enforcement evidence contextual",
);
