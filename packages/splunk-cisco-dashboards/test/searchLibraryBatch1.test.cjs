"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const {generateFixtures,expression,source}=require("../../../scripts/generate_search_library_batch1_fixtures.cjs");
const root = path.resolve(__dirname,"../src/main/resources/splunk/default");
const conf = fs.readFileSync(path.join(root,"searchbase.conf"),"utf8");
const ids = ["operations_cisco_ingestion_delay_by_source","operations_cisco_feed_bucket_coverage",
  "operations_ise_multivalue_field_quality","security_zeek_certificate_expiry_inventory",
  "security_zeek_certificate_expiry_summary","security_zeek_certificate_rotation_candidates",
  "network_dc_mds_transmit_wait_trend","network_dc_mds_repeated_congestion",
  "network_dc_mds_switch_resource_trend","network_dc_hyperfabric_port_rate_trend",
  "network_dc_hyperfabric_directional_imbalance","network_dc_hyperfabric_measurement_coverage"];
const blocks = new Map(ids.map(id=>{
  const matches=[...conf.matchAll(new RegExp(`^\\[${id}\\]\\n([\\s\\S]*?)(?=^\\[|(?![\\s\\S]))`,"gm"))];
  assert.equal(matches.length,1,id);
  return [id,matches[0][1]];
}));
const query=id=>blocks.get(id).match(/^search = ([\s\S]*)/m)[1].trim().replace(/\\\n/g,"\n");

test("first expansion batch is additive, visible, bounded and self-contained",()=>{
  const layout=fs.readFileSync(path.join(root,"insights_workspaces.conf"),"utf8");
  for(const id of ids){
    const block=blocks.get(id), spl=query(id);
    for(const field of ["search_name","search_author","version","category","sub_category","description","explanation","solution","related_info"])
      assert.match(block,new RegExp(`^${field} = .+`,"m"),`${id}: ${field}`);
    assert.match(block,/^search_hidden = 0$/m);
    JSON.parse(block.match(/^viz_options = (.+)$/m)[1]);
    assert.ok(!layout.includes(id),"library additions must not change a workspace");
    assert.doesNotMatch(spl,/\|\s*(join|transaction|map|collect|outputlookup|delete|mvexpand)\b/);
    assert.match(spl,/No matching observations were found/);
    if(block.includes("default_viz = splunk.table")) {
      assert.match(spl,/eventstats count as TotalGroups/);
      assert.ok(spl.indexOf("RowsTruncated=if(TotalGroups>1000,1,0)")<spl.indexOf("| sort 1000"));
    } else assert.match(spl,/timechart fixedrange=false cont=false bins=60/);
  }
});
test("ingestion delay separates negative clocks and bucket occupancy uses finite picker bounds",()=>{
  const delay=query(ids[0]), coverage=query(ids[1]);
  assert.match(delay,/delay_seconds=_indextime-_time/);
  assert.match(delay,/nonnegative_delay=if\(delay_seconds>=0,delay_seconds,null\(\)\)/);
  assert.match(delay,/perc95\(nonnegative_delay\)/);
  assert.match(coverage,/^\| tstats/);
  assert.match(coverage,/window_start>0 AND window_end>window_start/);
  assert.match(coverage,/floor\(\(window_end-0\.001\)\/900\)-floor\(window_start\/900\)\+1/);
  assert.match(coverage,/dc\(_time\) as ActiveBuckets/);
  assert.doesNotMatch(coverage,/earliest=|latest=|Healthy/);
  assert.match(query(ids[2]),/mvcount\(mvdedup\('<<FIELD>>'\)\)/);
});
test("certificates share latest identified observations, retain invalid dates and avoid renewal claims",()=>{
  const certIds=ids.slice(3,6), common=query(certIds[0]).split("\n| eval DaysToExpiry=round")[0].trimEnd();
  for(const id of certIds){
    const spl=query(id);
    assert.ok(spl.startsWith(common));
    assert.match(spl,/mvcount\(cert_values\),0\)=1/);
    assert.match(spl,/where _time=latest_observed/);
    assert.match(spl,/values\(EndRaw\) as ends/);
    assert.match(spl,/isnull\(NotAfter\),"Unknown expiry"/);
    assert.match(spl,/NotAfter<NotBefore,"Invalid validity range"/);
    assert.match(spl,/NotBefore>now\(\),"Not yet valid"/);
    assert.match(spl,/NotAfter<=now\(\),"Expired"/);
  }
  assert.match(query(certIds[1]),/sum\(Certificates\) as IdentifiedCertificates/);
  assert.match(query(certIds[2]),/where Fingerprints>1/);
  assert.match(blocks.get(certIds[2]),/does not prove renewal/);
});
test("SAN recurrence counts valid buckets rather than repeated polls or elapsed outage time",()=>{
  const spl=query(ids[7]);
  assert.ok(spl.indexOf("| bin _time span=15m")<spl.indexOf("| eval Elevated="));
  assert.match(spl,/where ValidMeasurements>0/);
  assert.match(spl,/Elevated=if\(BucketPeakTxWaitPct>=10,1,0\)/);
  assert.match(spl,/where ElevatedBuckets>=2/);
  assert.match(spl,/ElevatedBuckets\/ObservedBuckets/);
  for(const id of ids.slice(6,9)) {
    assert.match(query(id),/mvdedup\('<<FIELD>>'\)/);
    assert.match(query(id),/<=100/);
    assert.doesNotMatch(query(id),/fillnull|coalesce\((cpu|memory|tx_wait_pct|tonumber)/);
  }
});
test("Hyperfabric latest missing rates remain unknown, valid zero remains idle, inventory keys are not joined",()=>{
  const directional=query(ids[10]),coverage=query(ids[11]);
  for(const spl of [directional,coverage]){
    assert.ok(spl.indexOf("where _time=latest_observed")<spl.indexOf("values(in_marker)"));
    assert.match(spl,/in_marker=coalesce\(tostring\(in_bps\),"Not reported"\)/);
    assert.match(spl,/in_bps=if\(mvcount\(in_values\)=1,tonumber/);
    assert.doesNotMatch(spl,/where isnotnull\(in_bps\)|vendor\.id|\| append \[/);
  }
  assert.match(directional,/isnull\(in_bps\) OR isnull\(out_bps\),"Incomplete measurement",total_bps=0,"Idle"/);
  assert.match(coverage,/count as ObservedCounterPorts/);
  assert.match(coverage,/BothDirections\/ObservedCounterPorts/);
  assert.match(query(ids[9]),/in_mbps=in_bps\/1000000/);
  assert.doesNotMatch(query(ids[9]),/sum\(in_mbps\)|sum\(out_mbps\)/);
});
test("actual-SPL fixture generator preserves vendor field names and casts multivalue numeric inputs",()=>{
  assert.equal(expression([1,2]),"mvappend(tostring(1),tostring(2))");
  assert.match(source({rows:[{"vendor.cpuUsage":50}]}),/eval vendor\.cpuUsage=case/);
  assert.doesNotMatch(source({rows:[{"vendor.cpuUsage":50}]}),/eval 'vendor/);
});
test("every new query has a reproducible populated and empty SPL fixture",()=>{
  const cases=JSON.parse(fs.readFileSync(path.join(__dirname,"fixtures/searchLibraryBatch1Cases.json"),"utf8"));
  assert.deepEqual(cases.map(c=>c.id),ids);
  const fixtures=generateFixtures(conf,cases);
  assert.equal(fixtures.length,24);
  for(const fixture of fixtures){
    assert.match(fixture.query,/TestPassed=if\(/);
    assert.ok(fixture.query.includes(query(fixture.id).split("\n").slice(1).join("\n")));
  }
  assert.equal(fixtures.find(f=>f.id===ids[1]&&f.kind==="populated").earliest,"-1h@h");
});
