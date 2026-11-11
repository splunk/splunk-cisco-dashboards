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
const xml=fs.readFileSync(path.join(root,'src/main/resources/splunk/default/data/ui/views/netops_catalyst_operations.xml'),'utf8');
const d=JSON.parse(xml.match(/<!\[CDATA\[([\s\S]*?)\]\]>/)[1]);
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


test('Catalyst dashboards retain native Studio definitions and separate manager routes',()=>{
 for(const [view,title] of [['netops_catalyst_operations','Catalyst Operations (Preview)'],['netops_catalyst_health','Catalyst Health (Under Dev)']]) {
  const text=fs.readFileSync(path.join(root,'src/main/resources/splunk/default/data/ui/views',view+'.xml'),'utf8');
  assert.match(text,/<dashboard version="2"/);
  assert.doesNotMatch(text,/catalyst_operations_bootstrap|catalyst_operations_legacy_redirect/);
  const studio=JSON.parse(text.match(/<!\[CDATA\[([\s\S]*?)\]\]>/)[1]);
  assert.equal(studio.title,title);
  assert.deepEqual(studio.layout.tabs.items.map(t=>t.label),['Overview','Executive Summary','Client Summary','About']);
  assert.ok(Object.keys(studio.dataSources).length>0);
  const nav=fs.readFileSync(path.join(root,'src/main/resources/splunk/default/data/ui/nav/default.xml'),'utf8');
  assert.ok(nav.includes('dashboard_manager#/'+view));
 }
 assert.ok(!fs.existsSync(path.join(root,'src/main/webapp/pages/catalyst_operations')));
});

const investigationModule={exports:{}};
new Function('exports',ts.transpileModule(fs.readFileSync(path.join(root,'src/main/webapp/pages/secure_operations_glass/metricInvestigation.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(investigationModule.exports);
const investigations=investigationModule.exports;
test('metric investigations resolve configured IDs and legacy names without inventing detail searches',()=>{
 const source={id:'headline',searchName:'Headline',drilldownSearchNames:['detail','Detail label','missing','headline']};
 const detail={id:'detail',searchName:'Detail label'};
 assert.deepEqual(investigations.metricInvestigationTargets(source,new Map([['headline',source],['detail',detail]])),[source,detail]);
 assert.deepEqual(investigations.metricInvestigationTargets({...source,drilldownSearchNames:[],drilldownSearchName:'detail'},new Map([['detail',detail]])).map(r=>r.id),['headline','detail']);
 assert.equal(investigations.metricInvestigationTargets({...source,drilldownSearchNames:undefined},new Map()).length,1);
});
test('metric dialog searches start on demand, abort on close and suppress late or partial results',async()=>{
 const record={id:'headline',search:'| makeresults',dispatchContext:'source_app'};
 let calls=0,received=0,errors=0,request,finish;
 const run=async options=>{calls++;request=options;return new Promise(resolve=>{finish=resolve;});};
 const open=()=>investigations.startMetricInvestigation(record,'-24h@h',spl=>spl+' | head 1',run,()=>received++,()=>errors++);
 const unopened=open();unopened();await Promise.resolve();assert.equal(calls,0);
 const close=open();await Promise.resolve();assert.equal(calls,1);assert.equal(request.appContext,'source_app');assert.equal(request.earliestTime,'-24h@h');assert.equal(request.count,201);assert.equal(request.maxTimeSeconds,45);assert.match(request.spl,/head 1$/);
 close();assert.equal(request.signal.aborted,true);finish({results:[{value:1}]});await new Promise(setImmediate);assert.equal(received,0);
 investigations.startMetricInvestigation(record,'-4h',undefined,async()=>({results:[{value:1}],timedOut:true}),()=>received++,()=>errors++);
 await new Promise(setImmediate);assert.equal(errors,1);assert.equal(received,0);
 investigations.startMetricInvestigation({...record,search:'search user=$user$'},'-4h',undefined,run,()=>received++,()=>errors++);
 await new Promise(setImmediate);assert.equal(calls,1);assert.equal(errors,2);
 const reopened=open();await Promise.resolve();assert.equal(calls,2);finish({results:[{value:2}]});await new Promise(setImmediate);assert.equal(received,1);reopened();
});
test('Open in Search renders exactly one icon with safe new-window semantics',()=>{
 const React=require('react');const {renderToStaticMarkup}=require('react-dom/server');
 const Button=require('@splunk/react-ui/Button').default;
 const page=fs.readFileSync(path.join(root,'src/main/webapp/pages/secure_operations_glass/index.tsx'),'utf8');
 const component=page.slice(page.indexOf('const SearchActions ='),page.indexOf('const MetricInvestigationDialog ='));
 const scope={exports:{}};
 new Function('React','Button','Info','ExternalLink','splunkSearchAppUrl','exports',ts.transpileModule(component+'\nexport {SearchActions};',{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.React}}).outputText)(React,Button,()=>React.createElement('svg',{'data-icon':'info'}),()=>React.createElement('svg',{'data-icon':'external'}),()=>'/search?q=test',scope.exports);
 const markup=renderToStaticMarkup(React.createElement(scope.exports.SearchActions,{context:{catalogue:new Map([['test',{searchName:'Example',search:'| makeresults',dispatchContext:'app'}]]),earliest:'-4h'},searchId:'test'}));
 const anchor=markup.match(/<a\b[\s\S]*?<\/a>/)[0];assert.equal((anchor.match(/<svg\b/g)||[]).length,1);assert.match(anchor,/target="_blank"/);assert.match(anchor,/rel="noopener noreferrer"/);assert.match(anchor,/Open Example in Search/);
});
test('Building Intelligence gives descriptive KPIs room without covering daily trends or location panels',()=>{
 const text=fs.readFileSync(path.join(root,'src/main/resources/splunk/default/data/ui/views/workplace_building_intelligence.xml'),'utf8');assert.match(text,/<dashboard version="2"/);
 const studio=JSON.parse(text.match(/<!\[CDATA\[([\s\S]*?)\]\]>/)[1]);const layout=studio.layout.layoutDefinitions.layout_overview;
 const position=id=>layout.structure.find(item=>item.item===id).position;
 for(const id of ['viz_kpi_devices','viz_kpi_users','viz_kpi_occupancy','viz_kpi_ssids','viz_kpi_webex']){
  const metric=position(id),chart=position(id+'_chart');assert.ok(metric.h>=150);assert.ok(metric.y+metric.h<=chart.y,id+' fits above its trend');
  assert.ok(chart.y+chart.h<=position('viz_box_kpi').y+position('viz_box_kpi').h,id+' remains inside KPI area');
 }
 assert.ok(position('viz_box_kpi').y+position('viz_box_kpi').h<position('viz_box_location').y);
 assert.ok(layout.options.height>=1760);
});
