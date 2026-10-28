"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {execFileSync} = require("node:child_process");
const {test} = require("node:test");
const {manifest,fixtures,extraFixtures} = require("../../../scripts/generate_multivendor_fixtures.cjs");
const root=path.resolve(__dirname,"../../..");
const resource=path.join(root,"packages/splunk-cisco-dashboards/src/main/resources/splunk/default");
const conf=fs.readFileSync(path.join(resource,"searchbase.conf"),"utf8");
const blocks=[...conf.matchAll(/^\[([^\]]+)\]\n([\s\S]*?)(?=^\[|(?![\s\S]))/gm)];
const entry=id=>manifest.find(e=>e.id==="mv_"+id);

test("full expansion contains twenty neutral and six searches per vendor with no duplicate questions",()=>{
  assert.equal(manifest.length,80);
  assert.equal(new Set(manifest.map(e=>e.id)).size,80);
  assert.equal(new Set(manifest.map(e=>e.name)).size,80);
  const groups=manifest.reduce((m,e)=>(m[e.group]=(m[e.group]||0)+1,m),{});
  assert.equal(groups['Vendor neutral'],20);delete groups['Vendor neutral'];
  assert.equal(Object.keys(groups).length,10);assert.deepEqual([...new Set(Object.values(groups))],[6]);
  const workspaces=fs.readFileSync(path.join(resource,"insights_workspaces.conf"),"utf8");
  for(const e of manifest){
    const matches=blocks.filter(b=>b[1]===e.id);assert.equal(matches.length,1,e.id);
    const block=matches[0][2],q=block.match(/^search = ([\s\S]*)/m)[1].trim().replace(/\\\n/g,"\n");
    assert.equal(q,e.query,e.id);
    for(const k of ['search_name','search_author','updated_author','date_created','date_updated','category','sub_category','description','explanation','solution','related_info'])assert.match(block,new RegExp(`^${k} = .+`,"m"));
    assert.match(block,/^search_hidden = 0$/m);assert.equal(JSON.parse(block.match(/^viz_options = (.+)$/m)[1]).showRowNumbers,true);
    assert.match(e.ref,/^https:\/\//);
    assert.ok(!workspaces.includes(e.id));
    assert.doesNotMatch(q,/\|\s*(join|transaction|map|collect|outputlookup|delete|mvexpand)\b/);
    assert.match(q,/eventstats count as TotalGroups/);
    assert.ok(q.indexOf('RowsTruncated=if(TotalGroups>1000,1,0)')<q.indexOf('| sort 1000'));
    assert.match(q,/No qualifying observations/);
    assert.ok(q.startsWith(e.source+'\n'));
  }
});
test("neutral searches have CIM or IF-MIB contracts without Cisco fields or source restrictions",()=>{
  for(const e of manifest.filter(e=>e.group==='Vendor neutral')){
    assert.doesNotMatch(e.query,/cisco:|Cisco_|ISE|\bsgt\b/i);
    assert.match(e.source,/tag=|sourcetype IN \("snmp"/);
  }
  assert.match(entry('dns_nxdomain_clients').source,/tag=resolution tag=dns/);
  assert.match(entry('authentication_method_visibility').limits,/does not prove MFA/);
  assert.match(entry('change_failure_records').query,/lower\(Status\)="failure"/);
  assert.match(entry('interface_error_counter_rates').query,/last\(InMarker\) as PreviousIn/);
  assert.match(entry('ipv6_decision_visibility').query,/cidrmatch\("::\/0",Source\)/);
});
test("source variants and field contracts include current and legacy ingest formats",()=>{
  for(const id of ['fortinet_policy_denials','fortinet_vpn_transitions','fortinet_ips_actions'])assert.match(entry(id).source,/fgt_.*fortinet_.*fortigate_/);
  assert.match(entry('checkpoint_policy_audit').source,/cp_log:syslog/);
  assert.match(entry('f5_tls_handshake_failures').source,/f5:bigip:ltm:ssl:error/);
  assert.match(entry('crowdstrike_process_destinations').source,/crowdstrike:events:sensor/);
  for(const e of manifest.filter(e=>e.group==='Microsoft')){
    assert.match(e.source,/ms365:defender:incident:advanced_hunting/);
    assert.match(e.query,/properties\.DeviceId DeviceId/);
    assert.match(e.query,/properties\.ActionType ActionType/);
  }
});
test("counter rates preserve missing snapshots, partition keys, units and resets",()=>{
  for(const id of ['arista_interface_error_rates','arista_interface_discard_rates','arista_interface_transfer_rates']){
    const e=entry(id),q=e.query;
    assert.match(q,/coalesce\(tostring\(In\),"Unknown"\)/);
    assert.match(q,/values\(InMarker\) as Ins/);
    assert.match(q,/by Device Interface _time/);
    assert.match(q,/sort 0 _time Device Interface/);
    assert.match(q,/last\(InMarker\) as PreviousIn/);
    assert.match(q,/Elapsed>0 AND Elapsed<=3600 AND In>=PreviousIn/);
    assert.match(q,/9007199254740991/);
    assert.match(q,/DiscMarker=PreviousDisc/);
    assert.match(q,/tonumber\(UptimeMarker\)>=tonumber\(PreviousUptime\)/);
    assert.match(q,/ContinuityUnverifiedIntervals/);
    assert.match(e.limits,/Records counts valid intervals/);
  }
  assert.match(entry('arista_latest_interface_state').query,/where _time=LatestObservation/);
  assert.match(entry('arista_latest_interface_state').query,/coalesce\(State,"Not reported"\)/);
});
test("endpoint correlation needs stable sensor keys and keeps missing or conflicting context explicit",()=>{
  const cs=entry('crowdstrike_process_destinations').query;
  assert.match(cs,/ProcessKey=if\(IsProcess=1,Target,Context\)/);
  assert.match(cs,/by Agent ProcessKey/);
  assert.match(cs,/Conflicting process context/);
  assert.match(cs,/Process record not observed/);
  assert.match(entry('defender_network_protection_blocks').query,/ExploitGuardNetworkProtectionBlocked/);
  assert.match(entry('defender_remote_session_networking').query,/lower\(RemoteSession\) IN \("true","1"\)/);
});
test("unknown evidence is not silently converted into zero or a health verdict",()=>{
  assert.match(entry('traffic_decision_rates').query,/true\(\),"Unknown"/);
  assert.match(entry('zscaler_zia_transfer_sizes').query,/RequestMeasurements>0,RequestBytes,null\(\)/);
  assert.match(entry('zscaler_zpa_encryption_labels').query,/Encryption IN \("0","1"\),Encryption,"Unknown"/);
  assert.match(entry('infoblox_nxdomain_clients').limits,/query-only/);
  assert.match(entry('checkpoint_rule_action_inventory').limits,/cannot identify never-used or shadowed/);
  assert.match(entry('f5_pool_member_health_messages').limits,/not application availability/);
});
test("DNS record types take precedence over opcode-style query types",()=>{
  const e=entry('dns_unusual_query_types');
  assert.equal(e.fields.QueryType,'record_type query_type');
  assert.match(e.query,/QueryType=coalesce\('record_type','query_type'\)/);
  assert.equal(e.version,'1.0.1');
  assert.match(e.fixture.assertion,/Groups=2 AND MessageRows=0 AND Records=4/);
  assert.ok(e.fixture.rows.some(row=>row.record_type==='TXT'&&row.query_type==='Query'));
  assert.ok(e.fixture.rows.some(row=>row.record_type==='A'&&row.query_type==='TXT'));
  assert.ok(e.fixture.rows.some(row=>Array.isArray(row.record_type)&&row.record_type.length===2));
  assert.equal(entry('infoblox_txt_null_queries').fields.QueryType,'record_type query_type');
  assert.match(entry('infoblox_txt_null_queries').fixture.assertion,/Groups=2 AND MessageRows=0 AND Records=3/);
  assert.equal(entry('dns_response_latency').fields.Latency,'response_time');
  assert.match(entry('intrusion_alert_actions').source,/tag=ids tag=attack$/);
});
test("all eighty definitions have reproducible populated and no-observation native SPL fixtures",()=>{
  assert.equal(fixtures.length,160);
  for(const e of manifest){
    const rows=fixtures.filter(f=>f.id===e.id);assert.equal(rows.length,2);
    for(const f of rows){assert.match(f.query,/TestPassed=if\(/);assert.ok(f.query.includes(e.query.split('\n').slice(1).join('\n')));}
    assert.match(e.fixture.assertion,/Records=/);
    assert.match(e.fixture.post,/MessageRows/);
  }
  assert.equal(extraFixtures.length,28);
  assert.equal(extraFixtures.filter(f=>f.kind==='address-fallback').length,4);
  assert.equal(extraFixtures.filter(f=>f.kind==='integer-domain').length,13);
  assert.equal(extraFixtures.filter(f=>f.kind==='counter-context').length,4);
  assert.ok(extraFixtures.some(f=>f.kind==='discontinuity'));
  assert.ok(extraFixtures.some(f=>f.kind==='truncation'&&f.query.includes('count=1001')));
  assert.ok(extraFixtures.some(f=>f.query.includes('Conflicting process context')));
});
test("CrowdStrike address aliases validate candidates against the event family",()=>{
  for(const id of ['crowdstrike_process_destinations','crowdstrike_blocked_network_events','crowdstrike_ipv6_destinations','crowdstrike_network_listeners']){
    const e=entry(id);
    assert.equal(e.version,id==='crowdstrike_network_listeners'?'1.0.2':'1.0.1');
    assert.match(e.query,/case\(match\('event_simpleName',"IP6"\)/);
    assert.match(e.query,/if\(cidrmatch\("::\/0",'/);
    assert.match(e.query,/if\(cidrmatch\("0\.0\.0\.0\/0",'/);
  }
  assert.equal(entry('crowdstrike_dns_process_context').version,'1.0.0');
  assert.doesNotMatch(entry('traffic_application_bytes').query,/match\('event_simpleName'/);
});
test("integer domains validate aliases before fallback without rejecting fractional timing",()=>{
  const entries=manifest.filter(e=>Object.keys(e.integers).length);
  assert.equal(entries.length,13);
  for(const e of entries){
    for(const [target,[low,high]] of Object.entries(e.integers)){
      assert.ok(e.fields[target]);
      assert.ok(e.query.includes(`>=${low}`));
      if(high!==null)assert.ok(e.query.includes(`<=${high}`));
      for(const alias of e.fields[target].split(' '))assert.ok(e.query.includes(`tonumber('${alias}')=floor(tonumber('${alias}'))`));
    }
  }
  for(const id of ['dns_response_latency','traffic_long_duration','fortinet_sdwan_probe_quality','zscaler_zpa_server_setup']){
    assert.deepEqual(entry(id).integers,{});
    assert.doesNotMatch(entry(id).query,/floor\(tonumber/);
  }
  assert.match(entry('aruba_authentication_failures').ref,/\/Aruba\/clearpass\//);
});
test("authoring check is deterministic and does not change repository files",()=>{
  const before=fs.readFileSync(path.join(resource,"searchbase.conf"));
  execFileSync('python3',[path.join(root,'scripts/generate_multivendor_search_library.py'),'--check'],{env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});
  assert.deepEqual(fs.readFileSync(path.join(resource,"searchbase.conf")),before);
  const docs=execFileSync('python3',[path.join(root,'scripts/generate_multivendor_search_library.py'),'--docs'],{encoding:'utf8',env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});
  assert.equal(fs.readFileSync(path.join(root,'docs/multivendor-search-library.md'),'utf8'),docs);
  const guide=fs.readFileSync(path.join(root,'packages/splunk-cisco-dashboards/src/main/webapp/pages/user_guide/userGuide.md'),'utf8');
  assert.match(guide,/80 optional multivendor searches/);
  assert.match(guide,/Added eighty optional networking investigations/);
});
