"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {test} = require("node:test");
const {generateFixtures} = require("../../../scripts/generate_search_library_batch1_fixtures.cjs");
const {cases} = require("../../../scripts/generate_search_library_batch2_fixtures.cjs");
const root = path.resolve(__dirname,"../src/main/resources/splunk/default");
const conf = fs.readFileSync(path.join(root,"searchbase.conf"),"utf8");
const blocks = new Map([...conf.matchAll(/^\[([^\]]+)\]\n([\s\S]*?)(?=^\[|(?![\s\S]))/gm)].map(m=>[m[1],m[2]]));
const query = i => blocks.get(cases[i].id).match(/^search = ([\s\S]*)/m)[1].trim().replace(/\\\n/g,"\n");
test("second expansion is twelve visible optional searches with bounded evidence",()=>{
  assert.equal(cases.length,12);
  assert.equal(new Set(cases.map(c=>c.id)).size,12);
  const layout=fs.readFileSync(path.join(root,"insights_workspaces.conf"),"utf8");
  for(let i=0;i<cases.length;i++){
    const block=blocks.get(cases[i].id),spl=query(i);
    for(const field of ["search_name","search_author","version","category","sub_category","description","explanation","solution","related_info"])
      assert.match(block,new RegExp(`^${field} = .+`,"m"));
    assert.match(block,/^search_hidden = 0$/m);
    assert.equal(JSON.parse(block.match(/^viz_options = (.+)$/m)[1]).showRowNumbers,true);
    assert.ok(!layout.includes(cases[i].id));
    assert.doesNotMatch(spl,/\|\s*(join|transaction|map|collect|outputlookup|delete|mvexpand)\b/);
    assert.match(spl,/No qualifying observations were found/);
    assert.ok(spl.indexOf("RowsTruncated=if(TotalGroups>1000,1,0)")<spl.indexOf("| sort 1000"));
  }
});
test("firewall evidence does not conflate translation failures with measured capacity or unused rules",()=>{
  assert.match(query(0),/%\(\?:ASA\|FTD\)-\[0-7\]-/);
  assert.match(query(0),/MessageId!="710004" OR match\(evidence/);
  assert.match(query(0),/MessageId="305006","Translation creation failure"/);
  assert.match(query(1),/HostRecordSharePct=round\(100\*Records\/HostNatRecords/);
  assert.match(query(2),/where Records<=5/);
  assert.match(blocks.get(cases[2].id),/Never label an absent or quiet rule unused/);
});
test("Duo sequences deduplicate identities and exclude equal/reversed timestamps",()=>{
  for(const i of [3,4]){
    assert.match(query(i),/by AuthId/);
    assert.match(query(i),/mvcount\(users\)=1 AND mvcount\(applications\)=1 AND mvcount\(outcomes\)=1/);
  }
  assert.ok(query(3).indexOf("by User Application _time")<query(3).indexOf("| streamstats time_window="));
  assert.match(query(3),/sort 0 _time User Application/);
  assert.match(query(3),/time_window=10m/);
  assert.match(query(3),/PriorDenials=WindowDenials-Denials/);
  assert.doesNotMatch(query(3),/current=f time_window=/);
  assert.match(query(3),/Successes>0 AND PriorDenials>=3/);
  assert.match(query(4),/RiskyEvents>=5/);
  assert.match(query(5),/^\| tstats .*datamodel=Authentication .*span=15m/);
});
test("change candidates use exact host/device keys, positive elapsed time and first issue observations",()=>{
  for(const i of [6,7,8]){
    const spl=query(i);
    assert.match(spl,/sort 0 _time ReportingHost/);
    assert.match(spl,/streamstats current=f last\(/);
    assert.match(spl,/_time>Previous\w+Time AND _time<=Previous\w+Time\+900/);
    assert.doesNotMatch(spl,/lookup|join|transaction/);
  }
  assert.match(query(8),/IsAudit=1 OR _time=FirstActiveObservation/);
  assert.match(query(8),/if\(IsAudit=1,'network.deviceId',DeviceID\)/);
  assert.match(query(8),/by ReportingHost DeviceKey/);
});
test("cross-vendor coverage retains unknowns, classifies real addresses and shares normalization",()=>{
  const common=query(9).split("\n| eval AddressPair=")[0];
  for(const i of [9,10,11]){
    assert.ok(query(i).startsWith(common));
    assert.match(query(i),/cidrmatch\("::\/0"/);
    assert.match(query(i),/nullif\(trim\(mvindex/);
    assert.match(query(i),/true\(\),"Unknown"/);
    assert.doesNotMatch(query(i),/conn_state.*Allowed|reset.*Allowed/);
  }
  assert.match(query(11),/count as Records sum\(ValidPair\)/);
  assert.match(query(9),/sum\(Records\) as SourceRecords by sourcetype/);
});
test("every search has native SPL positive/adversarial and no-observation fixtures",()=>{
  const fixtures=generateFixtures(conf,cases);
  assert.equal(fixtures.length,24);
  for(const f of fixtures){
    assert.match(f.query,/TestPassed=if\(/);
    const i=cases.findIndex(c=>c.id===f.id);
    assert.ok(f.query.includes(query(i).split("\n").slice(1).join("\n")));
  }
  assert.ok(cases[3].rows.some(r=>r['user.name']==='equal'));
  assert.ok(cases[8].rows.some(r=>r.userId==='system'));
  assert.ok(cases[9].rows.some(r=>r.src_ip==='aa:bb:cc:dd:ee:ff'));
});
