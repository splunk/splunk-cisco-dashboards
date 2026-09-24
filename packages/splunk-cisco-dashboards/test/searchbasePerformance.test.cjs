"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const conf = fs.readFileSync(path.join(__dirname, "../src/main/resources/splunk/default/searchbase.conf"), "utf8");
function search(name) {
  const body = conf.split(`[${name}]\n`)[1]?.split(/\n\[/)[0];
  assert.ok(body, name);
  return body.split(/^search = /m)[1].trim().replace(/\\\n/g, "\n");
}

test("event volume and FTD freshness use index metadata, not raw events or lagging models", () => {
  for (const name of ["security_resilience_web_security_events", "security_resilience_sdwan_audit_log_total",
    "feed_monitor_ftd_firewall_staleness", "secure_networking_sse_total_security_events"]) {
    const spl = search(name);
    assert.match(spl, /^\| tstats /);
    assert.doesNotMatch(spl, /datamodel=|summariesonly|earliest=|latest=/);
  }
  const ftd = search("feed_monitor_ftd_firewall_staleness");
  assert.match(ftd, /sourcetype="cisco:ftd" OR sourcetype="cisco:ftd:\*"/);
  assert.match(ftd, /latest\(_time\) as last_ts count as event_count/);
  assert.match(ftd, /BY _time span=1s/);
  assert.match(ftd, /timechart max\(last_ts\) as last_ts sum\(event_count\) as event_count/);
  assert.match(ftd, /fillnull value=0 event_count\n\| filldown last_ts/);
  assert.match(ftd, /age_minutes<=30/);
  assert.match(ftd, /age_minutes<=90/);
});

test("model conversions retain source scope, metric fields, and configurable summary coverage", () => {
  for (const suffix of ["traffic_spike_candidates", "traffic_drop_candidates", "asymmetric_traffic_candidates"]) {
    const spl = search(`catalyst_center_interface_${suffix}`);
    assert.match(spl, /^\| tstats `summariesonly`/);
    assert.match(spl, /FROM datamodel=Cisco_Catalyst_App.Cisco_Catalyst_Dataset/);
    assert.match(spl, /nodename=Cisco_Catalyst_Dataset.Cisco_Catalyst_Device_Health_Interface_Events/);
    assert.match(spl, /`index_catalyst` sourcetype="cisco:dnac:devicehealth:interface"/);
    assert.match(spl, /device_health_interface_has_stats=True/);
    assert.match(spl, /device_health_interface_rx_rate=\*/);
    assert.match(spl, /device_health_interface_tx_rate=\*/);
    assert.doesNotMatch(spl, /earliest=|latest=|device_health_interface_speed/);
    if (!suffix.startsWith("asymmetric")) assert.match(spl, /BY _time span=15m/);
  }
  for (const name of ["teuc_5_9_37_page_load_completion_rate", "secure_networking_assurance_quality_summary"]) {
    const spl = search(name);
    assert.match(spl, /^\| tstats `summariesonly`/);
    assert.match(spl, /FROM datamodel=Cisco_ThousandEyes.Test_Metrics/);
    assert.match(spl, /`index_thousandeyes` sourcetype="cisco:thousandeyes:metric"/);
    assert.doesNotMatch(spl, /earliest=|latest=/);
  }
  assert.match(search("secure_networking_assurance_quality_summary"), /perc95\(Test_Metrics.metric_name:network.latency\)/);
});

test("expensive display enrichment follows selection without narrowing the detection population", () => {
  const sse = search("secure_networking_sse_security_event_detail");
  assert.ok(sse.indexOf("| sort 500 priority - _time") < sse.indexOf('"Last Seen"=strftime'));
  assert.ok(sse.indexOf("| eval Action=") < sse.indexOf("| sort 500"));
  const ftd = search("network_intelligence_ftd_anomalous_sessions");
  assert.ok(ftd.indexOf("| eventstats perc99") < ftd.indexOf("| where duration_secs"));
  assert.ok(ftd.indexOf("| where duration_secs") < ftd.indexOf("| sort 30"));
  assert.ok(ftd.indexOf("| sort 30") < ftd.indexOf("| eval source="));
  assert.match(ftd, /bytes_in, bytes_out, InitiatorBytes \+ ResponderBytes/);
});
