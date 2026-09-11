"use strict";

const assert = require("assert").strict;
const fs = require("fs");
const path = require("path");

const packageRoot = path.resolve(__dirname, "..");
const searchbase = fs.readFileSync(
  path.join(
    packageRoot,
    "src/main/resources/splunk/default/searchbase.conf",
  ),
  "utf8",
);

const stanzaBody = (name) => {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = `${searchbase}\n[__test_end__]\n`.match(
    new RegExp(`^\\[${escaped}\\]\\n([\\s\\S]*?)(?=^\\[)`, "m"),
  );
  assert.ok(match, `Missing Searchbase stanza ${name}`);
  return match[1];
};

const cpu = stanzaBody("network_iosxr_mltk_cpu_anomaly");
const interfaceTrend = stanzaBody(
  "network_iosxr_mltk_interface_error_anomaly",
);
const interfaceExplain = stanzaBody(
  "network_iosxr_mltk_interface_error_explain",
);

for (const [name, body] of [
  ["CPU", cpu],
  ["interface trend", interfaceTrend],
  ["interface explanation", interfaceExplain],
]) {
  assert.doesNotMatch(body, /\|\s*(?:apply|fit)\b/i, `${name} must not use MLTK commands`);
  assert.doesNotMatch(
    body,
    /cpu_anomaly_model_all_routers|iface_err_df_model_v2|DensityFunction|pre-trained/i,
    `${name} must not reference an external model artifact`,
  );
  assert.match(body, /baseline_samples\s*>?=\s*12/);
  assert.match(body, /baseline_stdev\s*>\s*0/);
}

// Display names are stable identifiers for saved canvases; the implementation
// and operator copy carry the statistical-baseline migration.
assert.match(cpu, /search_name = Network - CPU Anomalies \(MLTK\)/);
assert.match(cpu, /description = .*rolling statistical baseline/);
assert.match(
  interfaceTrend,
  /search_name = Network - Interface Error Rate Anomalies \(MLTK\)/,
);
assert.match(interfaceTrend, /description = .*rolling statistical baseline/);
assert.match(cpu, /eventstats count\(cpu_utilization\)[^\n]+BY source_nodename/);
assert.match(cpu, /anomaly_score = if\(isnotnull\(z_score\)/);
assert.match(cpu, /is_anomaly = if\(anomaly_score >= 0\.8, "Yes", "No"\)/);
for (const field of [
  "_time",
  "source_nodename",
  "cpu_utilization",
  "anomaly_score",
  "is_anomaly",
  "status",
]) {
  assert.match(cpu, new RegExp(`fields [^\\n]*\\b${field}\\b`));
}

const sharedInterfaceExpressions = [
  "eventstats count(total_error_rate) AS baseline_samples avg(total_error_rate) AS baseline_mean stdev(total_error_rate) AS baseline_stdev BY source",
  "eval upper_threshold = if(baseline_samples >= 12 AND baseline_stdev > 0, baseline_mean + (3 * baseline_stdev), null())",
  "eval z_score = if(isnotnull(upper_threshold), (total_error_rate - baseline_mean) / baseline_stdev, null())",
  "eval is_anomaly = if(isnotnull(z_score) AND z_score >= 3, 1, 0)",
];
for (const expression of sharedInterfaceExpressions) {
  assert.ok(interfaceTrend.includes(expression), `Trend missing: ${expression}`);
  assert.ok(interfaceExplain.includes(expression), `Explain missing: ${expression}`);
}
assert.match(interfaceTrend, /stats avg\(total_error_rate\) as total_error_rate avg\(anomaly_point\) as anomaly_point by _time/);
assert.match(interfaceExplain, /where is_anomaly=1/);
assert.match(interfaceExplain, /Observed error rate/);
assert.match(interfaceExplain, /three-sigma threshold/);
assert.doesNotMatch(interfaceExplain, /BoundaryRanges|rare-high|LOW dip|DENSITY outlier/);

const sampleStats = (values) => {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.length > 1
      ? values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
        (values.length - 1)
      : 0;
  return { mean, stdev: Math.sqrt(variance) };
};

const cpuScore = (value, samples, mean, stdev) => {
  if (samples < 12 || !(stdev > 0)) return 0;
  const zScore = Math.abs((value - mean) / stdev);
  return Math.round(Math.min(zScore / 3, 1) * 1000) / 1000;
};

const interfaceFlag = (value, samples, mean, stdev) => {
  if (samples < 12 || !(stdev > 0)) return 0;
  return (value - mean) / stdev >= 3 ? 1 : 0;
};

assert.equal(cpuScore(90, 11, 10, 2), 0, "CPU must fail closed below 12 samples");
assert.equal(cpuScore(90, 12, 10, 0), 0, "CPU must fail closed on zero variance");
assert.equal(cpuScore(12, 12, 10, 2), 0.333, "Ordinary variation must remain unflagged");
assert.equal(cpuScore(14.8, 12, 10, 2), 0.8, "The documented 2.4-sigma boundary must flag");
assert.equal(cpuScore(100, 12, 10, 2), 1, "A clear CPU spike must cap at score 1");

assert.equal(interfaceFlag(100, 11, 10, 2), 0, "Interface detector must require 12 samples");
assert.equal(interfaceFlag(100, 12, 10, 0), 0, "Interface detector must reject zero variance");
assert.equal(interfaceFlag(15.9, 12, 10, 2), 0, "A sub-three-sigma rate must remain normal");
assert.equal(interfaceFlag(16, 12, 10, 2), 1, "The three-sigma boundary must flag");
assert.equal(interfaceFlag(100, 12, 10, 2), 1, "A clear interface spike must flag");

const cpuFixture = [...Array(12).fill(10), 100];
const cpuFixtureStats = sampleStats(cpuFixture);
assert.ok(
  cpuScore(
    cpuFixture.at(-1),
    cpuFixture.length,
    cpuFixtureStats.mean,
    cpuFixtureStats.stdev,
  ) >= 0.8,
  "A data-backed spike fixture must be anomalous when its own population is baselined",
);

console.log("Self-contained IOS-XR anomaly Searchbase contract passed.");
