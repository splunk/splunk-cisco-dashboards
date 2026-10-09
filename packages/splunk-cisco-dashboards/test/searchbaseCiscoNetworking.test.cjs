"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const root = path.resolve(__dirname, "../src/main/resources/splunk");
const conf = fs.readFileSync(path.join(root, "default/searchbase.conf"), "utf8");
const blocks = new Map(
  [...conf.matchAll(/^\[([^\]]+)\]\n([\s\S]*?)(?=^\[|(?![\s\S]))/gm)]
    .map((match) => [match[1], match[2]]),
);
const search = (id) => {
  const block = blocks.get(id);
  assert.ok(block, id);
  const spl = block.match(/^search = ([\s\S]*?)(?=^\w+ = |(?![\s\S]))/m)?.[1];
  assert.ok(spl, `${id} SPL`);
  return spl.trim().replace(/\\\n/g, "\n");
};
const candidates = [
  ["network_dc_hyperfabric_port_inventory", "index_dc", "cisco:dc:hyperfabric:inventory"],
  ["network_dc_hyperfabric_port_rates", "index_dc", "cisco:dc:hyperfabric:performance"],
  ["network_dc_mds_switch_health", "index_dc", "cisco:dc:mds:inventory"],
  ["network_dc_mds_congestion", "index_dc", "cisco:dc:mds:congestion"],
  ["network_dc_nd_interface_congestion", "index_dc", "cisco:dc:nd:congestion"],
  ["network_dc_nd_protocol_peers", "index_dc", "cisco:dc:nd:protocols"],
  ["network_dc_nd_compliance_summary", "index_dc", "cisco:dc:nd:operational"],
  ["network_dc_nd_tcam_utilization", "index_dc", "cisco:dc:nd:operational"],
  ["network_dc_nd_microburst_peaks", "index_dc", "cisco:dc:nd:operational"],
  ["network_dc_nexus_dme_sensors", "index_dc", "cisco:dc:nexus9k:dme"],
  ["network_dc_aci_bgp_domains", "index_dc", "cisco:dc:aci:custom"],
  ["network_dc_nexus_bgp_entity", "index_dc", "cisco:dc:nexus9k:custom"],
  ["network_catalyst_application_inventory", "index_catalyst", "cisco:dnac:application:inventory"],
  ["network_catalyst_swim_images", "index_catalyst", "cisco:dnac:swim"],
  ["network_sdwan_sse_tunnel_health", "index_sdwan", "cisco:sdwan:ssetunnelhealth"],
];

test("new networking searches retain index abstraction, bounded output and documentation", () => {
  const names = [...conf.matchAll(/^\[([^\]]+)\]/gm)].map((m) => m[1]);
  for (const [id, macro, sourcetype] of candidates) {
    assert.equal(names.filter((name) => name === id).length, 1, `${id} must be unique`);
    const spl = search(id);
    assert.ok(spl.startsWith(`\`${macro}\` sourcetype="${sourcetype}"`), id);
    assert.match(spl, /\| sort 1000 /, id);
    assert.doesNotMatch(spl, /earliest=|latest=|index=|fillnull|join /, id);
    for (const field of ["search_name", "description", "explanation", "solution", "related_info", "viz_options"]) {
      assert.match(blocks.get(id), new RegExp(`^${field} = .+`, "m"), `${id} ${field}`);
    }
    JSON.parse(blocks.get(id).match(/^viz_options = (.+)/m)[1]);
  }
});

test("state selection precedes ND open-state filtering across KPIs and drilldowns", () => {
  for (const id of [
    "network_dc_nd_active_anomalies_by_fabric",
    "network_dc_nd_top_active_anomaly_types",
    "network_dc_nd_open_advisories_table",
    "secure_networking_dc_anomaly_count",
    "secure_networking_dc_advisory_count",
    "secure_networking_dc_anomalies_by_severity",
    "secure_networking_dc_security_advisory_detail",
  ]) {
    const spl = search(id);
    assert.match(spl, /max\(_time\) as last_observed by controller signal_id/, id);
    assert.match(spl, /\| dedup controller signal_id/, id);
    assert.ok(spl.indexOf("| dedup") < spl.indexOf('| where lower(cleared)="false"'), id);
    assert.match(spl, /lower\(expired\)="false"/, id);
    assert.doesNotMatch(spl, /coalesce\(cleared,"false"\)/, id);
  }
  assert.match(search("secure_networking_dc_health_signals_trend"), /signal_id=controller\."\|"/);
});

test("ACI detail and rollup use the same latest non-cleared fault population", () => {
  const rollup = search("network_aci_top_fault_codes");
  const detail = search("network_aci_recent_faults_table");
  for (const spl of [rollup, detail]) {
    assert.match(spl, /sourcetype="cisco:dc:aci:class" component=faultInst/);
    assert.match(spl, /max\(_time\) as last_observed by controller dn/);
    assert.ok(spl.indexOf("| dedup controller dn") < spl.indexOf('lower(severity)!="cleared"'));
    assert.match(spl, /coalesce\(lc,""\)!="retaining"/);
  }
});

test("heterogeneous datasets and multivalue records remain correctly scoped", () => {
  assert.match(search("network_dc_nd_compliance_summary"), /dataset=configuration_compliance endpoint_id=compliance_summary/);
  assert.match(search("network_dc_nd_tcam_utilization"), /dataset=policy_cam endpoint_id=tcam_leaf_utilization/);
  assert.match(search("network_dc_nd_microburst_peaks"), /dataset=microbursts endpoint_id=microburst_bursts/);
  assert.match(search("network_dc_nd_microburst_peaks"), /by nd_host fabricName switch interface queue_name peak_timestamp/);
  assert.match(search("network_dc_nd_microburst_peaks"), /worst_peak_vendor_units/);
  const peers = search("network_dc_nd_protocol_peers");
  assert.ok(peers.indexOf("| dedup") < peers.indexOf("| mvexpand peer_record"));
  assert.match(peers, /spath input=peer_record path=peerIp output=peer_ip/);
  assert.match(search("network_dc_nd_tcam_utilization"), /if\(capacity>0,.*null\(\)\)/);
  assert.match(search("network_dc_hyperfabric_port_rates"), /isnotnull\(in_bps\) OR isnotnull\(out_bps\)/);
  assert.doesNotMatch(search("network_catalyst_application_inventory"), /sum\(|application:traffic/);
});

test("coverage drilldowns resolve and defaults stay deployment-neutral", () => {
  const coverage = search("network_cisco_dataset_coverage");
  assert.match(coverage, /count as polling_records/);
  assert.match(coverage, /schema_dataset schema_endpoint schema_resource/);
  const targets = blocks.get("network_cisco_dataset_coverage")
    .match(/^drilldown_stanza_ids = (.+)/m)[1].split(",");
  assert.deepEqual(targets, candidates.map(([id]) => id));
  const macros = fs.readFileSync(path.join(root, "default/macros.conf"), "utf8");
  assert.match(macros, /\[index_dc\]\ndefinition = index IN \(\*\)/);
  assert.match(macros, /cisco:dc:hyperfabric:\*/);
  assert.match(macros, /cisco:dc:mds:\*/);
});
