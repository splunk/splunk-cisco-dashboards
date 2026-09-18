"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const packageRoot = path.resolve(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(packageRoot, relativePath), "utf8");
const searchbase = read("src/main/resources/splunk/default/searchbase.conf");
const savedsearches = read("src/main/resources/splunk/default/savedsearches.conf");

const stanzaBody = (name) => {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = `${searchbase}\n[__test_end__]\n`.match(
    new RegExp(`^\\[${escaped}\\]\\n([\\s\\S]*?)(?=^\\[)`, "m"),
  );
  assert.ok(match, `Missing Searchbase stanza ${name}`);
  return match[1];
};

const expected = [
  "network_akips_low_availability_device_count",
  "network_akips_low_availability_by_location",
  "network_akips_saturated_interface_count",
  "network_akips_interface_saturation_hotspots",
  "network_akips_interface_error_hotspots",
  "network_akips_device_inventory_by_location",
  "network_catalyst_active_issues_by_property",
  "network_catalyst_client_experience_by_property",
  "network_cisco_iq_high_risk_finding_count",
  "network_cisco_iq_high_risk_findings_by_device",
  "network_unified_device_inventory_criticality",
];

for (const name of expected) {
  const matches = searchbase.match(new RegExp(`^\\[${name}\\]$`, "gm")) || [];
  assert.equal(matches.length, 1, `${name} must exist exactly once`);
  const body = stanzaBody(name);
  assert.doesNotMatch(
    body,
    /\bindex=(?!\*)[A-Za-z0-9_-]+/i,
    `${name} must not hard-code a customer index`,
  );
  assert.doesNotMatch(
    body,
    /^tags\s*=.*\bCustomer\b/im,
    `${name} must not use a customer-specific tag`,
  );
}

const availability = stanzaBody("network_akips_low_availability_by_location");
assert.match(availability, /sourcetype="akips:availability"/);
assert.match(availability, /sourcetype="akips:inventory-SysLocation"/);
assert.match(availability, /"Unmapped"/);
assert.match(availability, /where availability<99/);

const saturation = stanzaBody("network_akips_interface_saturation_hotspots");
assert.match(saturation, /latest\(interface_utilisation_pct\)/);
assert.match(saturation, /where utilization>=80/);
assert.match(saturation, /device_host\."::"\.interface/);

const errors = stanzaBody("network_akips_interface_error_hotspots");
assert.match(errors, /earliest\(interface_error_count\)/);
assert.match(errors, /latest\(interface_error_count\)/);
assert.match(errors, /error_delta=last_errors-first_errors/);

const issues = stanzaBody("network_catalyst_active_issues_by_property");
assert.match(issues, /sourcetype IN \("cisco:dnac:issue","cisco:catalyst:issue"\)/);
assert.match(issues, /property=mvindex\(hierarchy_parts,4\)/);
assert.match(issues, /coalesce\(hierarchy_leaf,"Unmapped"\)/);

const experience = stanzaBody("network_catalyst_client_experience_by_property");
assert.match(experience, /poor_clients/);
assert.match(experience, /avg_onboarding_seconds/);
assert.match(experience, /avg_rssi/);

for (const name of [
  "network_cisco_iq_high_risk_finding_count",
  "network_cisco_iq_high_risk_findings_by_device",
]) {
  const body = stanzaBody(name);
  assert.match(body, /sourcetype="cisco:iq:assessment"/);
  assert.match(body, /lower\(risk\)="high"/);
  assert.match(
    body,
    /not treated as a complete device inventory|do not replace authoritative inventory|without claiming Cisco IQ is the authoritative inventory/i,
  );
}

assert.match(savedsearches, /sourcetype="akips:inventory-SysLocation"/);
assert.match(savedsearches, /sourcetype="cisco:iq:assessment"/);
assert.match(savedsearches, /lifecycle_risk/);
assert.match(savedsearches, /criticality_reason/);
assert.match(savedsearches, /values\(akips_location\) as correlated_akips_locations/);
assert.match(savedsearches, /values\(iq_lifecycle_risk\) as correlated_iq_risks/);
assert.match(savedsearches, /location=coalesce\(location,mvindex\(correlated_akips_locations,0\)\)/);
assert.match(savedsearches, /Cisco IQ assessments[^\n]+retaining AKIPS location/);

console.log("Reusable property operations and lifecycle Searchbase contracts passed.");
