"use strict";

const assert = require("assert").strict;
const fs = require("fs");
const path = require("path");

const packageRoot = path.resolve(__dirname, "..");
const searchbaseConf = fs.readFileSync(
  path.join(
    packageRoot,
    "src/main/resources/splunk/default/searchbase.conf",
  ),
  "utf8",
);

const stanza = (id) => {
  const block = searchbaseConf
    .split(/(?=^\[)/m)
    .find((candidate) => candidate.startsWith("[" + id + "]"));
  assert.ok(block, "expected Searchbase stanza " + id);
  return block;
};

const expectBounded = (id, limit) => {
  assert.match(
    stanza(id),
    new RegExp("\\| sort " + limit + " "),
    id + " must use a bounded top-N sort",
  );
};

const expectAggregateSafe = (id) => {
  const block = stanza(id);
  assert.match(
    block,
    /\|\s*(?:stats|tstats)\b/,
    id + " must retain an explicit aggregate grain",
  );
  assert.doesNotMatch(
    block,
    /\|\s*sort\b/,
    id + " must not globally sort an aggregated result",
  );
};

assert.doesNotMatch(
  searchbaseConf,
  /(?:_?latencyS)\*1000/,
  "ThousandEyes network.latency is already milliseconds and must not be multiplied",
);
assert.match(
  stanza("overview_inter_site_latency"),
  /^drilldown_stanza_id = it_critical_systems_ds_site_health$/m,
);
expectAggregateSafe("overview_link_state_drilldown");

for (const id of [
  "secure_networking_sgt_by_site",
  "secure_networking_sgt_distribution_by_site_device",
  "secure_networking_sgt_site_activity_trend",
  "secure_networking_zta_radius_node_health_by_site",
]) {
  assert.match(
    stanza(id),
    /NAD: /,
    id + " must fall back to a reporting NAD when site metadata is absent",
  );
  assert.doesNotMatch(
    stanza(id),
    /(?:site|location_context)=coalesce\([^\n]*"Unknown"/i,
    id + " must not collapse missing site metadata into Unknown",
  );
}
assert.match(
  stanza("secure_networking_sgt_site_activity_trend"),
  /by location_context limit=8 useother=true/,
);
expectAggregateSafe("secure_networking_sgt_by_site");
expectAggregateSafe("secure_networking_sgt_distribution_by_site_device");
expectAggregateSafe("secure_networking_zta_radius_node_health_by_site");

const identityBySource = stanza(
  "secure_networking_zta_user_activity_cross_source",
);
assert.match(
  identityBySource,
  /^search_name = Secure Networking - ZTA Identity Activity by Source$/m,
);
assert.match(identityBySource, /"SGT: "\.SourceSecurityGroup/);
assert.match(identityBySource, /"Identity \/ Security Context"/);
assert.doesNotMatch(identityBySource, /\blayers_seen\b|\bfail_layers\b/);
expectAggregateSafe("secure_networking_zta_user_activity_cross_source");
assert.match(
  stanza("secure_networking_zta_user_activity_source_trend"),
  /^drilldown_stanza_id = secure_networking_zta_user_activity_cross_source$/m,
);

const ztnaDetail = stanza(
  "secure_networking_zta_ztna_blocked_access_reasons",
);
assert.match(ztnaDetail, /rule_name/);
assert.doesNotMatch(
  ztnaDetail,
  /policy_ruleset="Unknown"|enforcement="Unknown"|posture="Unknown"/,
);
assert.doesNotMatch(
  ztnaDetail,
  /"Policy Ruleset"|"Enforced By"|"Posture"|\bas Posture\b/,
);
expectAggregateSafe("secure_networking_zta_ztna_blocked_access_reasons");

const bgpDetail = stanza(
  "secure_networking_thousandeyes_bgp_path_change_detail",
);
assert.match(bgpDetail, /^search = \| tstats /m);
assert.match(bgpDetail, /"Test ID"/);
assert.match(bgpDetail, /"ThousandEyes Link"/);
assert.doesNotMatch(bgpDetail, /\bAgent\b|\bTarget\b/);
expectAggregateSafe("secure_networking_thousandeyes_bgp_path_change_detail");

const httpDetail = stanza("secure_networking_thousandeyes_http_trace_log");
assert.match(httpDetail, /"Metric Coverage"/);
assert.match(httpDetail, /"Not reported"/);
assert.match(httpDetail, /Status=case\(/);
expectAggregateSafe("secure_networking_thousandeyes_http_trace_log");

assert.match(
  stanza("secure_networking_site_inventory_rollup"),
  /"SD-WAN Site"/,
);
const sdwanSite = stanza("secure_networking_sdwan_site_view");
assert.match(sdwanSite, /"Telemetry Coverage"/);
assert.match(sdwanSite, /"Not reported"/);
assert.doesNotMatch(sdwanSite, /"Device Types"/);

const iseNodes = stanza("security_resilience_ise_node_inventory");
assert.match(iseNodes, /\\\.samples\$/);
assert.match(iseNodes, /Status=case\(/);
assert.match(iseNodes, /"Telemetry Coverage"/);
expectAggregateSafe("security_resilience_ise_node_inventory");

assert.match(
  stanza("executive_dashboard_firewall_blocked_with_baseline"),
  /by _time span=1h,/,
);
expectAggregateSafe("executive_dashboard_firewall_blocked_with_baseline_drilldown");
for (const id of [
  "secure_networking_fmc_blocked_connection_detail",
  "secure_networking_sse_security_event_detail",
]) {
  expectBounded(id, 500);
}

console.log("✓ Secure Networking profile search-quality tests passed");
