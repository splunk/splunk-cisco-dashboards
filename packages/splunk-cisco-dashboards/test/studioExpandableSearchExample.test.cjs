const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {test}=require('node:test');
const Ajv=require('ajv');
const jsonata=require('jsonata');
const {defaultSchema}=require('@splunk/dashboard-definition');
const root=path.resolve(__dirname,'..');
const id='studio_expandable_search_example';
const xml=fs.readFileSync(path.join(root,'src/main/resources/splunk/default/data/ui/views',id+'.xml'),'utf8');
const d=JSON.parse(xml.match(/<!\[CDATA\[([\s\S]*?)\]\]>/)[1]);

test('example is a native editable Studio definition with no custom bootstrap or React entry',()=>{
 assert.match(xml,/<dashboard version="2"/);assert.doesNotMatch(xml,/\bscript=|\bstylesheet=|scan-root|bootstrap/);
 const validate=new Ajv({strict:false,allErrors:true}).compile(defaultSchema);
 assert.ok(validate(d),JSON.stringify(validate.errors));
 assert.equal(d.applicationProperties.hideEdit,false);
 const webpack=fs.readFileSync(path.join(root,'webpack.config.js'),'utf8');assert.ok(!webpack.includes(id));
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'config/build-profile-manifest.json'),'utf8'));
 assert.ok(manifest.developing.views.includes(id));
 const nav=fs.readFileSync(path.join(root,'src/main/resources/splunk/default/data/ui/nav/default.xml'),'utf8');
 assert.ok(nav.includes('href="'+id+'"'));assert.ok(!nav.includes('dashboard_manager#/'+id));
});

test('native toggle expressions start closed and change labels and visibility together',async()=>{
 for(const kind of ['clients','devices']){
  const input=d.inputs['input_'+kind];assert.equal(input.type,'input.button');
  assert.equal(d.defaults.tokens.default['show_'+kind].value,'false');
  const expressions=d.expressions.eval;
  const evaluate=async(name,state)=>jsonata(expressions[name].value.replaceAll('$show_'+kind+'$','state')).evaluate({state});
  assert.match(await evaluate('label_'+kind,'false'),/^\+ Show/);
  assert.equal(await evaluate('toggle_'+kind,'false'),'true');
  assert.match(await evaluate('label_'+kind,'true'),/^− Hide/);
  assert.equal(await evaluate('toggle_'+kind,'true'),'false');
  const condition=d.expressions.conditions['condition_'+kind].value.replaceAll('$show_'+kind+'$','state');
  assert.equal(await jsonata(condition).evaluate({state:'false'}),false);
  assert.equal(await jsonata(condition).evaluate({state:'true'}),true);
  assert.deepEqual(d.visualizations['viz_hidden_'+kind].containerOptions.visibility.showConditions,['condition_'+kind]);
 }
});

test('detail tabs own independent searches without a first-tab or search-token consumer',()=>{
 const tabs=d.layout.tabs.items;assert.equal(tabs.length,3);
 const owners=new Map();
 for(const tab of tabs){
  const structure=d.layout.layoutDefinitions[tab.layoutId].structure;
  for(const item of structure){
   const ds=d.visualizations[item.item]?.dataSources?.primary;
   if(ds){assert.ok(!owners.has(ds),'No shared data-source consumer may force an unvisited tab search');owners.set(ds,tab.layoutId);}
  }
 }
 assert.equal(owners.get('ds_deferred_client'),'layout_client');
 assert.equal(owners.get('ds_deferred_device'),'layout_device');
 assert.equal(d.layout.tabs.items[0].layoutId,'layout_visibility');
 assert.equal(Object.keys(d.dataSources).length,4);
 for(const source of Object.values(d.dataSources)){
  assert.equal(source.type,'ds.search');assert.match(source.options.query,/^\| makeresults count=3/);
  assert.match(source.options.query,/ExecutedAt/);
  assert.deepEqual(source.options.queryParameters,{earliest:'$global_time.earliest$',latest:'$global_time.latest$'});
 }
 assert.doesNotMatch(JSON.stringify(d.defaults),/ds_|job|result/);
 const guidance=d.visualizations.viz_explanation.options.markdown;
 assert.match(guidance,/synthetic demonstration data/);
 assert.match(guidance,/show\/hide condition does not promise/);
 assert.match(guidance,/cache/);
 assert.match(guidance,/does not promise fresh execution or cancellation/);
});
