const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '../src/main/webapp');
function load(source, requireFn = require) {
    const mod = { exports: {} };
    new Function('require', 'module', 'exports', ts.transpileModule(source, {
        compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2020 },
    }).outputText)(requireFn, mod, mod.exports);
    return mod.exports;
}
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const helpers = load(read('common/lib/refinedSignalRail.ts'));
test('six signals use one row when they fit, three per row when narrower, and honest overflow on tiny rails', () => {
    assert.deepEqual(helpers.refinedSignalRailLayout(6, 1440, 208, 1), { columns: 6, rowCount: 1, overflow: false });
    assert.deepEqual(helpers.refinedSignalRailLayout(6, 900, 208, 1), { columns: 3, rowCount: 2, overflow: false });
    assert.deepEqual(helpers.refinedSignalRailLayout(6, 1440, 208, 2), { columns: 3, rowCount: 2, overflow: false });
    assert.equal(helpers.refinedSignalRailLayout(6, 300, 208, 1).overflow, true);
    assert.equal(helpers.refinedSignalRailLayout(1, 300, 208, 1).columns, 1);
    assert.equal(helpers.refinedSignalRailLayout(6, 900, 240, 1).overflow, false);
});
test('retired selections migrate per workspace without overwriting Glass or other valid styles', () => {
    const src = read('common/components/workspace/SignalRailTicker.tsx');
    const body = src.slice(src.indexOf('const isSignalRailVariant'), src.indexOf('const splitRows'));
    for (const value of ['signal-orbit', 'event-horizon', 'one-cisco-glass', 'original', 'minimal-enterprise', 'prism-pulse', 'invalid', null]) {
        const writes = [];
        const api = load(`const DEFAULT_VARIANT='one-cisco-glass', STORAGE_KEY='rail';
            const userScopedStorageKey = key => 'user.'+key;
            const readUserScopedStorageItem = () => ${JSON.stringify(value)};
            const isRetiredSignalRailStyle = value => value === 'signal-orbit' || value === 'event-horizon';
            const window = {localStorage:{setItem:(...args)=>require('record')(...args)}};
            ${body}; exports.read=readStoredVariant;`, id => id === 'record' ? (...args) => writes.push(args) : require(id));
        {
            const retired = helpers.isRetiredSignalRailStyle(value);
            assert.equal(api.read('rail.workspace'), retired ? 'minimal-enterprise' : ['invalid', null].includes(value) ? 'one-cisco-glass' : value);
            assert.deepEqual(writes, retired ? [['user.rail.workspace', 'minimal-enterprise']] : []);
        }
    }
});
const Component = load(read('common/components/workspace/RefinedSignalRail.tsx'), id => {
    if (id === '@/common/lib/refinedSignalRail') return helpers;
    if (id === '@/common/icons/SuiIcon') return { ExternalLink: props => React.createElement('span', props) };
    if (id === './SignalRailShowcase') return { SignalRailTrend: ({kpi}) => React.createElement('span', null, kpi.series?.length ? 'Observed trend' : 'Trend unavailable') };
    return require(id);
}).default;
test('both refined styles retain measured zero, full escaped labels, unknowns, and permitted Search links', () => {
    const kpis = [
        {id:'a',label:'A full label <script>',category:'Category',value:0,status:'healthy',href:'/search'},
        {id:'b',label:'Unavailable',category:'Category',value:'--',status:'unknown',href:'/search',canOpen:false},
        {id:'c',label:'Attention',category:'Category',value:57,status:'critical'},
    ];
    for (const variant of ['minimal-enterprise', 'prism-pulse']) {
        const html = renderToStaticMarkup(React.createElement(Component, {kpis,variant,fontSize:'standard',density:'comfortable',rows:1,durationSeconds:0,paused:false,onMotionAvailabilityChange:()=>{},controls:React.createElement('button',null,'Style')}));
        assert.equal((html.match(/<article /g)||[]).length,3);
        assert.match(html,/A full label &lt;script&gt;/);
        assert.match(html,/>0<\/span>/); assert.match(html,/>Unknown<\/span>/);
        assert.equal((html.match(/rel="noopener noreferrer"/g)||[]).length,1);
        assert.equal((html.match(/>Style<\/button>/g)||[]).length,1);
        if (variant === 'prism-pulse') { assert.ok(html.indexOf('>Attention<') < html.indexOf('>A full')); assert.match(html,/Trend unavailable/); }
        else assert.ok(html.indexOf('>A full') < html.indexOf('>Attention<'));
    }
});

test('search shortcuts reject executable protocols and control-character URLs', () => {
    for (const href of ['/en-US/app/search?q=a%20b', 'https://splunk.example/search', 'http://forge:8000/search']) assert.equal(helpers.isSignalRailSearchHref(href), true);
    for (const href of ['javascript:alert(1)', 'data:text/html,hello', '//untrusted.example', '/\\evil', '/search\nscript', undefined]) assert.equal(helpers.isSignalRailSearchHref(href), false);
});

test('overflow duplicates are inaccessible while reduced-motion layouts stay scrollable without animation', () => {
    for (const reduced of [false, true]) {
        const Rail = load(read('common/components/workspace/RefinedSignalRail.tsx'), id => {
            if (id === 'react') return {...React, useState: initial => [typeof initial === 'number' ? 300 : reduced, () => {}]};
            if (id === '@/common/lib/refinedSignalRail') return helpers;
            if (id === '@/common/icons/SuiIcon') return {ExternalLink: props => React.createElement('span', props)};
            if (id === './SignalRailShowcase') return {SignalRailTrend: () => null};
            return require(id);
        }).default;
        const kpis = Array.from({length:6}, (_,i)=>({id:String(i),label:'Signal '+i,category:'Source',value:i,status:'healthy',href:'/search'}));
        const html=renderToStaticMarkup(React.createElement(Rail,{kpis,variant:'prism-pulse',fontSize:'standard',density:'comfortable',rows:1,durationSeconds:60,paused:true,onMotionAvailabilityChange:()=>{},controls:null}));
        assert.equal((html.match(/<article /g)||[]).length,reduced?6:12);
        if(reduced){assert.doesNotMatch(html,/scd-signal-rail-marquee-track/);assert.match(html,/tabindex="0" role="region"/);}
        else {assert.match(html,/data-paused="true"/);assert.equal((html.match(/tabindex="-1"/g)||[]).length,6);}
    }
});

test('Minimal and Prism move at positive speed on wide and narrow rails, respecting Static, Pause and reduced motion', () => {
    const kpis = Array.from({length:6}, (_,i)=>({id:String(i),label:'Signal '+i,category:'Source',value:i,status:'healthy',href:'/search'}));
    for (const variant of ['minimal-enterprise','prism-pulse']) {
        for (const width of [1440,900,300]) {
            for (const {duration,reduced,paused} of [
                {duration:60,reduced:false,paused:false},
                {duration:30,reduced:false,paused:true},
                {duration:0,reduced:false,paused:false},
                {duration:60,reduced:true,paused:false},
            ]) {
                const Rail = load(read('common/components/workspace/RefinedSignalRail.tsx'), id => {
                    if(id==='react') return {...React,useState:initial=>[typeof initial==='number'?width:reduced,()=>{}]};
                    if(id==='@/common/lib/refinedSignalRail') return helpers;
                    if(id==='@/common/icons/SuiIcon') return {ExternalLink:props=>React.createElement('span',props)};
                    if(id==='./SignalRailShowcase') return {SignalRailTrend:()=>null};
                    return require(id);
                }).default;
                const html=renderToStaticMarkup(React.createElement(Rail,{kpis,variant,fontSize:'standard',density:'comfortable',rows:1,durationSeconds:duration,paused,onMotionAvailabilityChange:()=>{},controls:null}));
                const moving=duration>0&&!reduced;
                assert.equal((html.match(/<article /g)||[]).length,moving?12:6,`${variant}, width ${width}, duration ${duration}, reduced ${reduced}`);
                if(moving){
                    assert.match(html,/scd-signal-rail-marquee-track/);
                    assert.match(html,new RegExp(`animation-duration:${duration}s`));
                    assert.match(html,new RegExp(`data-paused="${paused}"`));
                    assert.equal((html.match(/tabindex="-1"/g)||[]).length,6);
                    assert.match(html,/aria-hidden="true"/);
                    if(width===1440) assert.match(html,/width:1440px/,'Fitted rows still get a real animation width');
                } else assert.doesNotMatch(html,/scd-signal-rail-marquee-track/);
            }
        }
    }
});
