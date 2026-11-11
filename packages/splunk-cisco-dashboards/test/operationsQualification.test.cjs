const assert = require('node:assert/strict');
const {test} = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root,'src/main/webapp/pages/secure_operations_glass/search.ts'),'utf8');
const moduleRecord = {exports:{}};
new Function('require','module','exports',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(
 id=>id==='react'?{useMemo:f=>f()}: {},moduleRecord,moduleRecord.exports);
const api=moduleRecord.exports;
test('headlines bind intended totals and never fall back to a trend bucket',()=>{
 assert.equal(api.getScalarValue([{assignments_trend:3,total_assignments:49}],['total_assignments']),49);
 assert.equal(api.getScalarValue([{assignments_trend:3}],['total_assignments']),null);
 assert.equal(api.getScalarValue([{total_events:0}],['total_events']),0);
});
test('no telemetry rows stay unknown and preserve their explanation',()=>{
 const text='No matching telemetry was found. Confirm source coverage.';
 for(const row of [{data_status:text,total_events:0},{category:text,value:0},{'Data Status':text},{message:text}]) {
  assert.equal(api.getTelemetryMessage([row]),text);
  assert.equal(api.getScalarValue([row],['total_events']),null);
 }
 assert.equal(api.getTelemetryMessage([{total_events:0}]),null);
});
test('identity predicate uses normalized identity and rejects unsupported query shapes',()=>{
 const q='search index=x\n| eval identity_context=UserName\n| stats count as event_count by identity_context';
 assert.match(api.identityActivitySearch(q,'user47*'),/search identity_context="user47\*"\n\| stats/);
 assert.throws(()=>api.identityActivitySearch('search index=x','user47'));
 assert.throws(()=>api.identityActivitySearch(q,''));
 for(const bad of ['x" | collect index=main','x\ny']) assert.equal(api.identityActivitySearch(q,bad).split('|').length,q.split('|').length+1);
});
test('investigation summary counts identities across layers without treating layers as identities',()=>{
 const rows=[{'Source Layer':'ISE / NAC','Identity / Security Context':'alice','Total Events':'2','Failures / Blocks':'1'},
 {'Source Layer':'ZTNA','Identity / Security Context':'alice','Total Events':'3','Failures / Blocks':'0'},
 {'Source Layer':'ISE / NAC','Identity / Security Context':'bob','Total Events':'1','Failures / Blocks':'1'}];
 const s=api.summarizeIdentityActivity(rows);
 assert.equal(s.totalEvents,6);assert.equal(s.secondValue,2);assert.equal(s.thirdValue,2);
 assert.equal(api.summarizeIdentityActivity([{message:'No matching telemetry'}]).totalEvents,null);
});
test('category and DLP headlines aggregate before the UI result cap',()=>{
 assert.match(api.dnsCategoryMetricSearch('search index=x'),/stats dc\(Category\) as category_count/);
 assert.match(api.dlpFindingMetricSearch('search index=x'),/stats sum\(Events\) as finding_count/);
});
const d=JSON.parse(fs.readFileSync(path.join(root,'src/main/webapp/pages/catalyst_operations/sourceDefinitions.json'),'utf8')).operations;
test('Catalyst preserves client type grain, unknown readings, and observed time buckets',()=>{
 const q=d.dataSources.ds_mod_client_distribution_score.options.query;
 assert.match(q,/by clientType scoreType/);assert.doesNotMatch(q,/dedup|eventstats/);
 for(const key of ['ds_wired_trend_24h','ds_wireless_trend_24h'])assert.match(d.dataSources[key].options.query,/timechart fixedrange=false cont=false/);
 for(const key of ['ds_cs_health_trend','ds_wired_health_trend','ds_wireless_health_trend']) assert.match(d.dataSources[key].options.query,/<=100.*null\(\)/);
 for(const key of ['viz_ex_ap_health','viz_ex_switch_health','viz_ex_router_health','viz_ex_firewall_health']) assert.equal(d.visualizations[key].type,'splunk.singlevalue');
 assert.match(d.inputs.input_site_filter.title,/detail panels/);
});
// Export the exact production transforms for the native-SPL fixture runner.
if(process.env.OPS_FIXTURE_EXPORT)fs.writeFileSync(process.env.OPS_FIXTURE_EXPORT,JSON.stringify({dns:api.dnsCategoryMetricSearch('| makeresults'),dlp:api.dlpFindingMetricSearch('| makeresults'),identity:api.identityActivitySearch('search index=x\n| eval identity_context=UserName\n| stats count as event_count by identity_context','user47*')}));
