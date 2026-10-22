const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const packageRoot = path.resolve(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(packageRoot, relativePath), "utf8");

const viewName = "sn_data_center_operations";
const viewSource = read(
  `src/main/resources/splunk/default/data/ui/views/${viewName}.xml`,
);
const definitionMatch = viewSource.match(
  /<definition><!\[CDATA\[([\s\S]*?)\]\]><\/definition>/,
);
assert.ok(definitionMatch, `${viewName} must contain a Dashboard Studio definition`);
const definition = JSON.parse(definitionMatch[1]);

const kpiCards = Object.values(definition.visualizations).filter(
  ({ type }) => type === "splunk.singlevalue",
);
assert.equal(kpiCards.length, 15, "the dashboard must retain all 15 KPI cards");
const kpiBindings = kpiCards.map(({ dataSources, options = {} }) =>
  JSON.stringify({
    primary: dataSources?.primary,
    majorValue: options.majorValue,
    sparklineValues: options.sparklineValues,
  }),
);
assert.equal(
  new Set(kpiBindings).size,
  kpiBindings.length,
  "each KPI card must retain a distinct result binding",
);

const expectedRefs = [
  "secure_data_center_aci_critical_fault_count",
  "secure_data_center_aci_denied_flow_count",
  "secure_data_center_aci_fabric_health_score",
  "secure_data_center_aci_port_utilization_trend",
  "secure_data_center_apic_failed_login_count",
  "secure_data_center_secure_firewall_ips_count",
  "secure_networking_dc_aci_configuration_change_count",
  "secure_networking_dc_advisory_count",
  "secure_networking_dc_interface_anomaly_count",
].sort();
const actualRefs = Object.values(definition.dataSources)
  .filter(({ type }) => type === "ds.searchbase")
  .map(({ options }) => options.ref)
  .sort();
assert.deepEqual(actualRefs, expectedRefs);
assert.equal(definition.dataSources.ds_isovalent_base.type, "ds.search");
assert.match(
  definition.dataSources.ds_isovalent_base.options.query,
  /^`index_security`/,
  "the chainable Isovalent parent must use the standard security index macro",
);

assert.equal(
  definition.inputs.input_time_range.options.defaultValue,
  "-24h@h,now,auto",
);
assert.ok(
  definition.inputs.input_time_range.options.selections.every(({ value }) =>
    value.endsWith(",auto"),
  ),
);

const searchbase = read("src/main/resources/splunk/default/searchbase.conf");
for (const ref of expectedRefs) {
  const matches = searchbase.match(new RegExp(`^\\[${ref}\\]$`, "gm")) || [];
  assert.equal(matches.length, 1, `${ref} must exist exactly once`);
}

for (const ref of [
  "secure_networking_dc_interface_anomaly_count",
  "secure_networking_dc_aci_configuration_change_count",
]) {
  const stanza = `${searchbase}\n[__end__]\n`.match(
    new RegExp(`^\\[${ref}\\]\\n([\\s\\S]*?)(?=^\\[__end__\\]|^\\[[^\\]]+\\])`, "m"),
  );
  assert.ok(stanza, `${ref} stanza must be readable`);
  assert.match(stanza[1], /BY _time span=auto/);
  assert.doesNotMatch(stanza[1], /BY _time span=1h/);
}

const deniedFlowStanza = `${searchbase}\n[__end__]\n`.match(
  /^\[secure_data_center_aci_denied_flow_count\]\n([\s\S]*?)(?=^\[__end__\]|^\[[^\]]+\])/m,
);
assert.ok(deniedFlowStanza);
assert.match(deniedFlowStanza[1], /earliest=-1h latest=now/);
assert.match(deniedFlowStanza[1], /span=5m/);
assert.match(deniedFlowStanza[1], /This tile always reports the latest hour/);

const nav = read("src/main/resources/splunk/default/data/ui/nav/default.xml");
assert.match(
  nav,
  /<collection label="Secure Infrastructure"[\s\S]*?dashboard_manager#\/sn_secure_infrastructure_status[\s\S]*?dashboard_manager#\/sn_data_center_operations[\s\S]*?dashboard_manager#\/sn_hmf_sdwan_network_health/,
);
assert.ok(
  fs.existsSync(
    path.join(
      packageRoot,
      "src/main/resources/splunk/appserver/static/images/nav-icons/ServersWrench.svg",
    ),
  ),
);

console.log("Secure Data Center Operations dashboard contract passed.");
