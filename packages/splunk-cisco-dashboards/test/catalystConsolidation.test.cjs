const assert=require('node:assert/strict'),{test}=require('node:test'),fs=require('fs'),path=require('path'),ts=require('typescript'),vm=require('vm'),React=require('react');
const dir=path.resolve(__dirname,'../src/main/webapp/pages/catalyst_operations');
function load(name,mocks={}) {const m={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(path.join(dir,name),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,esModuleInterop:true,jsx:ts.JsxEmit.React}}).outputText)(id=>Object.hasOwn(mocks,id)?mocks[id]:id.startsWith('./')?require(path.join(dir,id)):require(id),m,m.exports);return m.exports;}
const api=load('model.ts'),sources=require(path.join(dir,'sourceDefinitions.json'));
const scope={earliest:'-24h',latest:'now',site:'*',clientType:'*',issue:'NTP "clock" issue'};
test('all useful old and new panels have an accessible consolidated destination',()=>{
 const c=api.catalogue;assert.deepEqual(c.tabs.map(t=>t.label),['Overview','Executive Summary','Client Summary']);
 const visible=new Set(c.tabs.flatMap(t=>[...t.core,...t.groups.flatMap(g=>g.panels)]));visible.add('operations_viz_ex_issue_detail_modal');
 for(const [source,d] of Object.entries(sources))for(const [id,v] of Object.entries(d.visualizations)) {
  if(!v.dataSources)continue;const destination=c.coverage[source+'_'+id];assert.ok(destination,id);
  if(destination.startsWith('removed:'))assert.ok(['ds_bw','ds_bw_public'].includes(v.dataSources.primary));else assert.ok(visible.has(destination),destination);
 }
 for(const panel of Object.values(c.panels)){const q=api.panelQuery(panel,scope);assert.ok(q.spl);assert.doesNotMatch(q.spl,/\|\s*(noop|dedup|collect|outputlookup|delete)\b/);assert.doesNotMatch(q.spl,/\$[\w.]+\$/);}
});
test('filters stay inside SPL string literals and macro/token input fails closed',()=>{
 const p=api.catalogue.panels.operations_viz_client_details;
 assert.throws(()=>api.panelQuery(p,{...scope,site:'x" | collect index=main'}));
 const q=api.panelQuery(p,{...scope,site:'Building "A"'}).spl;assert.ok(q.includes('Site="Building \\\"A\\\""'));
 for(const site of ['`macro`','$token$'])assert.throws(()=>api.panelQuery(p,{...scope,site}));
 const detail=api.panelQuery(api.catalogue.panels.operations_viz_ex_issue_detail_modal,scope);assert.match(detail.spl,/Issue="NTP \\"clock\\" issue"/);
});
test('headline unknowns remain unknown rather than stale or negative percentages',()=>{
 const p=api.catalogue.panels.operations_viz_ov_wireless_health;
 assert.equal(api.metricValue(p,[{'Wireless Health':90},{'Wireless Health':-1}]),null);
 assert.equal(api.metricValue(p,[{'Wireless Health':101}]),null);
 assert.equal(api.metricValue(p,[{'Wireless Health':0}]),0);
});
test('the page caps concurrency and never starts an abandoned queued request',async()=>{
 const gate=api.createSearchGate(1),a=new AbortController(),b=new AbortController();let release,calls=0;
 const first=gate(a.signal,()=>{calls++;return new Promise(r=>{release=r;});});await Promise.resolve();
 const second=gate(b.signal,async()=>{calls++;});const rejected=assert.rejects(second);b.abort();await rejected;assert.equal(calls,1);release();await first;
});
test('closed optional sections do not mount panels that own search requests',()=>{
 let open=false;const stub=()=>null;
 const hooks={...React,useState:v=>[typeof v==='boolean'?open:v,set=>{open=typeof set==='function'?set(open):set;}],useEffect(){assert.fail('No closed section effect');}};
 const page=load('index.tsx',{react:hooks,recharts:new Proxy({},{get:()=>stub}),'@splunk/react-time-range/Dropdown':stub,'./useTimeParser':{useTimeParser:stub},'@/common/services/splunkSearchService':{runManagedSearch(){assert.fail('No closed section search');}},'@/common/lib/splunkSearchUrl':{},'@/common/hooks/useExportPage':{},'@/common/components/workspace/WorkspaceModalShell':{},'../expandable_search_example/lifecycle':{},'./model':api});
 const group=api.catalogue.tabs[0].groups[0];const props={group,scope,refresh:0,onIssue(){}};
 const walk=(n,f)=>{if(n&&typeof n==='object'){f(n);React.Children.forEach(n.props?.children,c=>walk(c,f));}};
 let children=[],button;walk(page.Section(props),n=>{if(n.type===page.PanelView)children.push(n);if(n.type==='button')button=n;});assert.equal(children.length,0);
 button.props.onClick();children=[];walk(page.Section(props),n=>{if(n.type===page.PanelView)children.push(n);});assert.equal(children.length,group.panels.length);
});
test('legacy native and Manager links preserve selected time and tab during redirect',()=>{
 const script=fs.readFileSync(path.resolve(dir,'../../../resources/splunk/appserver/static/catalyst_operations_legacy_redirect.js'),'utf8');
 for(const href of ['http://forge:8000/en-US/app/splunk-cisco-dashboards/dashboard_manager?tab=layout_exec&form.time_tok.earliest=-4h#/netops_catalyst_health','http://forge:8000/en-US/app/splunk-cisco-dashboards/netops_catalyst_health?tab=layout_client','http://forge:8000/en-US/app/splunk-cisco-dashboards/dashboard_manager?tab=layout_client#/netops_catalyst_operations']) {
  let dest;vm.runInNewContext(script,{URL,window:{location:{href,replace:s=>{dest=s;}},addEventListener(){}}});const url=new URL(dest);assert.ok(url.pathname.endsWith('/netops_catalyst_operations'));assert.equal(url.search,new URL(href).search);assert.equal(url.hash,'');
 }
 assert.equal(api.initialTab('layout_exec'),'executive');assert.equal(api.initialTab('layout_client'),'client');
});
if(process.env.CATALYST_QUERY_EXPORT)fs.writeFileSync(process.env.CATALYST_QUERY_EXPORT,JSON.stringify(Object.entries(api.catalogue.panels).map(([id,p])=>({id,...api.panelQuery(p,{...scope,issue:'Clock issue'})}))));
