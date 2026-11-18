const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const file = path.resolve(__dirname, '../src/main/webapp/common/config/workspaceVisualizations.ts');
const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const loaded = {exports:{}};
new Function('exports','module','require',code)(loaded.exports,loaded,require);
const {parseWorkspaceVisualizations:parse,resolveWorkspaceVisualization:resolve} = loaded.exports;
test('shared choices round-trip JSON and recover safely from corrupt or unsupported state', () => {
  const valid = {tile_two:'singlevalueradial',tile_one:'column'};
  assert.deepEqual(parse(JSON.stringify(valid)), {tile_one:'column',tile_two:'singlevalueradial'});
  assert.deepEqual(parse(JSON.stringify(parse(valid))), parse(valid));
  for(const invalid of ['{broken','[]','null',undefined,42]) assert.deepEqual(parse(invalid), {});
  assert.deepEqual(parse({'bad/key':'line',good:'script'}), {});
  assert.equal(Object.hasOwn(parse('{"__proto__":"line","constructor":"line"}'),'__proto__'),false);
  assert.equal(Object.keys(parse(Object.fromEntries(Array.from({length:300},(_,i)=>['tile_'+i,'line'])))).length,256);
});
test('personal choice wins, shared choice is fallback, display flags survive and reset inherits', () => {
  assert.deepEqual(resolve({vizOverride:'line',hideDelta:true},'column'),{vizOverride:'line',hideDelta:true});
  assert.deepEqual(resolve({hideDelta:true},'column'),{vizOverride:'column',hideDelta:true});
  assert.equal(resolve(undefined,undefined),undefined);
  assert.equal(resolve(undefined,'unsupported'),undefined);
  assert.equal(resolve(undefined,parse('{}').tile_one),undefined);
});
const root = path.resolve(__dirname, '../src/main/webapp');
function load(relative, cache = new Map()) {
 const filename = path.join(root, relative);
 if(cache.has(filename)) return cache.get(filename).exports;
 const m = {exports:{}}; cache.set(filename,m);
 const output = ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 const req = name => name === '@splunk/splunk-utils/fetch' ? {createFetchInit: x=>x} : name.startsWith('@/') ? load(name.slice(2)+'.ts',cache) : require(name);
 new Function('exports','module','require',output)(m.exports,m,req);
 return m.exports;
}
test('shared layout survives reload, stays workspace scoped, preserves other settings and detects stale writes', async () => {
 const oldWindow=global.window,oldFetch=global.fetch;
 global.window={__SPLUNK_RUNTIME__:true,$C:{USERNAME:'test-manager'}};
 const service=load('common/services/insightsWorkspaceService.ts');
 const config=load('common/config/insightsWorkspaces.ts');
 const workspace=config.PACKAGED_WORKSPACE_FALLBACKS.find(w=>w.id==='secure_networking');
 const section=workspace.sections[0].id;
 const stanza=`layout.${workspace.id}.${section}`;
 let content={tiles:'one,two',visible_count:'2',searchbase_additions:'search_one',viz_overrides:'{"two":"table"}'};
 const writes=[];
 global.fetch=async (url,init={})=>{
  if(init.method==='POST') {writes.push([url,new URLSearchParams(init.body)]);content={...content,...Object.fromEntries(new URLSearchParams(init.body))};}
  return {ok:true,status:200,json:async()=>({entry:[{name:stanza,content}]})};
 };
 try {
  const before=(await service.loadInsightsWorkspaces()).layouts[workspace.id];
  const next={...before[section],vizOverrides:{...before[section].vizOverrides,one:'column'}};
  await service.saveWorkspaceLayout(workspace,{[section]:next},before);
  assert.equal(writes.length,1);assert.ok(writes[0][0].endsWith(stanza));
  assert.equal(writes[0][1].get('tiles'),'one,two');assert.equal(writes[0][1].get('searchbase_additions'),'search_one');
  const reload=await service.loadInsightsWorkspaces();
  assert.deepEqual(reload.layouts[workspace.id][section].vizOverrides,{one:'column',two:'table'});
  assert.equal(reload.layouts.executive,undefined);
  await assert.rejects(service.saveWorkspaceLayout(workspace,{[section]:next},before),/changed/);
  assert.equal(writes.length,1);
  global.fetch=async()=>({ok:false,status:403,json:async()=>({messages:[{text:'Forbidden'}]})});
  await assert.rejects(service.saveWorkspaceLayout(workspace,{[section]:next}),/Forbidden/);
 } finally {global.window=oldWindow;global.fetch=oldFetch;}
});
