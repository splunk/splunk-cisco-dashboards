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

const guardedDensityProjections = [
  "building_resilience_fit_occupancy_hourofweek_anomaly",
  "spaces_fit_camera_headcount_anomaly",
  "spaces_fit_device_presence_ratio_anomaly",
  "spaces_fit_iot_temperature_anomaly",
  "teuc_fit_alert_volume_timeslot_anomaly",
  "teuc_fit_bgp_path_changes_anomaly",
  "teuc_fit_multivariate_network_health_anomaly",
];

const discoveredDensityProjections = [];
const stanzaParts = searchbase.split(/^\[([^\]]+)\]\n/m);
for (let index = 1; index < stanzaParts.length; index += 2) {
  const name = stanzaParts[index];
  const body = stanzaParts[index + 1];
  if (/\| fit DensityFunction\b/.test(body) && /\| fields\s+[^-]/.test(body)) {
    discoveredDensityProjections.push(name);
  }
}

assert.deepEqual(
  discoveredDensityProjections.sort(),
  guardedDensityProjections,
  "The guarded stanza list must cover every DensityFunction search with a positive fields projection",
);

for (const name of guardedDensityProjections) {
  const body = stanzaBody(name);
  assert.match(body, /\| fit DensityFunction\b/);
  assert.match(
    body,
    /\| fields\s+[^\n]+\\\n\| noop search_optimization=false(?:\\|\n)/,
    `${name} must disable search optimization after its final fields projection`,
  );
}

console.log("MLTK projection optimization guards passed.");
