'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const babel = require('@babel/core');
const { cloneDeep } = require('lodash');
const webapp = path.resolve(__dirname, '../src/main/webapp');
const plain = (value) => JSON.parse(JSON.stringify(value));
function load(lookup = async () => ({ status: 200, entry: [{ content: { search: '| makeresults | eval count=3' } }] })) {
    const compile = (file, imports) => {
        const module = { exports: {} };
        const code = babel.transformSync(fs.readFileSync(path.join(webapp, file), 'utf8'), {
            plugins: ['@babel/plugin-transform-modules-commonjs'],
        }).code;
        vm.runInNewContext(`(function(require,module,exports){${code}\n})`, { URL })((id) => {
            if (!(id in imports)) throw Error(`Unexpected import ${id}`);
            return imports[id];
        }, module, module.exports);
        return module.exports;
    };
    const managed = compile('common/config/managedStudioViews.js', { '../lib/constants': { INSIGHTS_APP_ID: 'splunk-cisco-dashboards' } });
    return { ...managed, ...compile('pages/dashboardbuilder/searchbaseDefinitionUtils.js', {
        'lodash-es': { cloneDeep },
        '../../common/lib/searchbase': { getSearchBaseConfStanza: lookup },
        '../../common/config/managedStudioViews': managed,
    }) };
}
const definition = () => ({
    title: 'Conversion example',
    applicationProperties: { collapseNavigation: true, hideEdit: true, hideExport: false },
    dataSources: {
        base: { type: 'ds.searchbase', name: 'Base search', options: { ref: 'my_search', ownerApp: 'another_app', queryParameters: { earliest: '$time.earliest$', latest: '$time.latest$', span: '$time.span$' } } },
        chain: { type: 'ds.chain', options: { extend: 'base', query: '| stats sum(count)' } },
    },
    inputs: { time: { type: 'input.simpleTimePicker', options: { defaultValue: '-24h,now,auto', token: 'time', showAdvanced: true, selections: [{ value: '-4h,now,auto' }] } } },
    visualizations: { action: { type: 'splunk.cisco_drilldown_action' }, chart: { type: 'splunk.table', dataSources: { primary: 'chain' } } },
    layout: { type: 'absolute', structure: [{ item: 'action' }, { item: 'chart' }], layoutDefinitions: { tab1: { structure: [{ item: 'action' }, { item: 'chart' }] } } },
});
test('conversion preserves exact stanza SPL, namespace, chain references, time token and original definition', async () => {
    const calls = [];
    const spl = 'index=test\n| eval note="keep $unrelated$ and \\"quotes\\""\n| stats count';
    const api = load(async (...args) => { calls.push(args); return { status: 200, entry: [{ content: { search: spl } }] }; });
    const original = definition();
    const before = cloneDeep(original);
    const result = await api.resolveSearchbaseDefinitionForNativeStudio(original);
    const converted = result.definition;
    assert.deepEqual(original, before);
    assert.deepEqual(calls, [['my_search', 'another_app']]);
    assert.equal(converted.dataSources.base.type, 'ds.search');
    assert.equal(converted.dataSources.base.options.query, spl);
    assert.equal('ref' in converted.dataSources.base.options, false);
    assert.equal('ownerApp' in converted.dataSources.base.options, false);
    assert.deepEqual(plain(converted.dataSources.chain), original.dataSources.chain);
    assert.deepEqual(plain(converted.dataSources.base.options.queryParameters), { earliest: '$time.earliest$', latest: '$time.latest$' });
    assert.deepEqual(plain(converted.inputs.time.options), { defaultValue: '-24h,now', token: 'time' });
    assert.equal(result.convertedDataSources, 1);
    assert.equal(result.convertedInputs, 1);
    assert.deepEqual(plain(converted.applicationProperties), { collapseNavigation: true, hideEdit: false, hideExport: false });
});
test('Manager-only actions are removed from every tab and layout without dropping charts', async () => {
    const api = load();
    const result = await api.resolveSearchbaseDefinitionForNativeStudio(definition());
    assert.equal(result.removedActions, 1);
    assert.equal(result.definition.visualizations.action, undefined);
    assert.ok(result.definition.visualizations.chart);
    assert.deepEqual(plain(result.definition.layout.structure), [{ item: 'chart' }]);
    assert.deepEqual(plain(result.definition.layout.layoutDefinitions.tab1.structure), [{ item: 'chart' }]);
    assert.equal(api.requiresDashboardManagerRuntime(result.definition), false, 'saved XML must be visible to native Studio');
});
test('partially converted copies can be repaired without fetching or replacing their inline SPL', async () => {
    const api = load(() => { throw Error('Do not fetch already inlined searches'); });
    const original = definition();
    original.dataSources.base.type = 'ds.search';
    original.dataSources.base.options = { query: '| makeresults', queryParameters: { earliest: '$time.earliest$', latest: '$time.latest$', span: '$time.span$' } };
    original.inputs.time.type = 'input.timerange';
    assert.equal(api.needsNativeStudioConversion(original), true);
    const result = await api.resolveSearchbaseDefinitionForNativeStudio(original);
    assert.equal(result.definition.dataSources.base.options.query, '| makeresults');
    assert.equal(result.convertedDataSources, 0);
    assert.equal(api.needsNativeStudioConversion(result.definition), false);
    assert.deepEqual(plain((await api.resolveSearchbaseDefinitionForNativeStudio(result.definition)).definition), plain(result.definition));
});
test('failed or missing Searchbase lookups leave the original unchanged', async () => {
    for (const response of [{ status: 403 }, { status: 200, entry: [] }, { status: 500, entry: [{ content: { search: 'stale' } }] }]) {
        const api = load(async () => response);
        const original = definition();
        const before = cloneDeep(original);
        await assert.rejects(api.resolveSearchbaseDefinitionForNativeStudio(original), /my_search/);
        assert.deepEqual(original, before);
    }
    const api = load();
    const original = definition();
    delete original.dataSources.base.options.ref;
    await assert.rejects(api.resolveSearchbaseDefinitionForNativeStudio(original), /base.*missing a ref/);
});
test('other Manager extensions fail atomically instead of producing an unusable native dashboard', async () => {
    const api = load();
    const original = definition();
    original.visualizations.custom = { type: 'splunk.template_kpi' };
    const before = cloneDeep(original);
    await assert.rejects(api.resolveSearchbaseDefinitionForNativeStudio(original), /other Dashboard Manager extensions/);
    assert.deepEqual(original, before);
});
test('native definitions and span-only partial conversions are detected correctly', () => {
    const api = load();
    assert.equal(api.needsNativeStudioConversion({}), false);
    assert.equal(api.needsNativeStudioConversion({ applicationProperties: { hideEdit: true } }), true);
    assert.equal(api.needsNativeStudioConversion({ inputs: { time: { type: 'input.timerange', options: { defaultValue: '-7d,now' } } } }), false);
    assert.equal(api.needsNativeStudioConversion({ dataSources: { search: { type: 'ds.search', options: { query: '| makeresults', queryParameters: { span: '$time.span$' } } } } }), true);
});
test('saving a completed conversion enables native listing and editing while preserving managed views', async () => {
    const api = load();
    const editor = fs.readFileSync(path.join(webapp, 'pages/dashboardbuilder/DashboardStudioEditor.jsx'), 'utf8');
    const saveFunction = editor.slice(editor.indexOf('async function updateDash('), editor.indexOf('const getDefinitionTextValue'));
    const calls = [];
    const save = vm.runInNewContext(`${saveFunction}\nupdateDash`, {
        requiresDashboardManagerRuntime: api.requiresDashboardManagerRuntime,
        normalizeDashboardTheme: (value) => value,
        escapeXml: (value) => value,
        escapeCdata: (value) => value,
        defaultFetchInit: {},
        fetch: async (url, init) => { calls.push({ url, init }); return { status: 200, json: async () => ({}) }; },
    });
    const original = definition();
    const converted = (await api.resolveSearchbaseDefinitionForNativeStudio(original)).definition;
    for (const [value, managed] of [[original, true], [converted, false]]) {
        await save('existing_copy', JSON.stringify(value), 'splunk-cisco-dashboards', 'existing_owner', 'Description', 'Title', 'dashboard_manager', 'dark');
        const request = calls.at(-1);
        const xml = new URLSearchParams(request.init.body).get('eai:data');
        assert.equal(xml.includes('isVisible="false"'), managed);
        assert.equal(xml.includes(`"hideEdit": ${managed}`), true);
        assert.ok(xml.includes('<tag>dashboard_manager</tag>'));
        assert.match(request.url, /servicesNS\/existing_owner\/splunk-cisco-dashboards\/data\/ui\/views\/existing_copy\?/);
        assert.equal(request.init.method, 'POST');
    }
});
