const assert = require('node:assert/strict');
const {test} = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const root=path.resolve(__dirname,'../src/main/webapp/pages/expandable_search_example');
function load(name,mocks={}) {
 const m={exports:{}};
 new Function('require','module','exports',ts.transpileModule(fs.readFileSync(path.join(root,name),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText)(id=>id in mocks?mocks[id]:require(id),m,m.exports);
 return m.exports;
}
const {startSectionSearch}=load('lifecycle.ts');
const {EXAMPLE_TABS}=load('config.ts');
test('closing before dispatch (StrictMode cleanup) submits zero searches',async()=>{
 let calls=0;
 const stop=startSectionSearch({run:async()=>{calls++;},onStart(){},onResult(){},onError(){}});
 stop();await Promise.resolve();assert.equal(calls,0);
});
test('opening dispatches once; closing aborts and suppresses late results; reopening is fresh',async()=>{
 let calls=0,results=0,signal,resolve;
 const options={run:s=>{signal=s;calls++;return new Promise(r=>{resolve=r;});},onStart(){},onResult(){results++;},onError(){assert.fail('Unexpected error');}};
 const stop=startSectionSearch(options);await Promise.resolve();assert.equal(calls,1);assert.equal(signal.aborted,false);
 stop();assert.equal(signal.aborted,true);resolve('late');await Promise.resolve();assert.equal(results,0);
 const stopAgain=startSectionSearch(options);await Promise.resolve();assert.equal(calls,2);resolve('fresh');await Promise.resolve();assert.equal(results,1);stopAgain();
});
test('closed sections never mount the component that owns the search effect',()=>{
 let open=false;
 const hooks={...React,useState:initial=>[typeof initial==='boolean'?open:initial,next=>{open=typeof next==='function'?next(open):next;}],useEffect(){assert.fail('Closed section must not execute an effect');}};
 const page=load('index.tsx',{react:hooks,'@/common/services/splunkSearchService':{runManagedSearch(){assert.fail('Closed section must not search');}},'./config':{EXAMPLE_TABS},'./lifecycle':{startSectionSearch}});
 const props={section:EXAMPLE_TABS[0].sections[0],earliest:'-4h',onStart(){}};
 const walk=(node,fn)=>{if(!node||typeof node!=='object')return;fn(node);React.Children.forEach(node.props?.children,c=>walk(c,fn));};
 let tree=page.ExpandableSection(props),owned=[];walk(tree,n=>{if(n.type===page.SectionResults)owned.push(n);});assert.equal(owned.length,0);
 let button;walk(tree,n=>{if(n.type==='button')button=n;});assert.equal(button.props['aria-expanded'],false);button.props.onClick();
 tree=page.ExpandableSection(props);owned=[];walk(tree,n=>{if(n.type===page.SectionResults)owned.push(n);});assert.equal(owned.length,1);
});
test('three operational tabs use bounded read-only searches and no placeholder data',()=>{
 assert.deepEqual(EXAMPLE_TABS.map(x=>x.label),['Overview','Executive Summary','Client Summary']);
 for(const tab of EXAMPLE_TABS) for(const section of tab.sections) {
  assert.match(section.spl,/`index_catalyst`/);assert.match(section.spl,/sort 20/);assert.doesNotMatch(section.spl,/collect|outputlookup|delete|noop/);
 }
});
