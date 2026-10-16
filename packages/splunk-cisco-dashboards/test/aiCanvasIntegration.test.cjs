'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const babel = require('@babel/core');
const React = require('react');
const root = path.resolve(__dirname, '../src/main/webapp');

function loadService() {
    const file = path.join(root, 'pages/dashboardbuilder/aiCanvasIntegration.js');
    const code = babel.transformSync(fs.readFileSync(file, 'utf8'), { plugins: ['@babel/plugin-transform-modules-commonjs'] }).code;
    const module = { exports: {} };
    const rest = (route, ns) => `/services/${ns?.app || '-'}/${ns?.owner || '-'}/${route}`;
    vm.runInNewContext(`(function(require,module,exports){${code}\n})`, {
        URL, URLSearchParams, AbortController, setTimeout, clearTimeout, atob, btoa,
    })((id) => {
        if (id.endsWith('/url')) return { createRESTURL: rest, createURL: (url, params) => `${url}?${new URLSearchParams(params)}` };
        if (id.endsWith('/fetch')) return { getDefaultFetchInit: () => ({ headers: { 'X-Splunk-Form-Key': 'test-csrf' } }) };
        if (id.endsWith('/config')) return { app: 'test-app', username: 'test-user' };
        throw new Error(`Unexpected import ${id}`);
    }, module, module.exports);
    return module.exports;
}

const plain = (value) => JSON.parse(JSON.stringify(value));
function mockRequest(handler) {
    const calls = [];
    return { calls, fetchImpl: async (url, init) => {
        calls.push({ url, init });
        const result = await handler(url, init);
        return { ok: result.status === undefined || result.status < 400, status: result.status || 200, json: async () => result.data };
    } };
}
const content = (value) => ({ data: { entry: [{ content: value }] } });
const synchronous = (value) => ({ subscribe(observer) { observer.next(value); return { unsubscribe() {} }; } });
const source = { type: 'ds.searchbase', options: { ref: 'my-search' } };
const item = { type: 'splunk.line', dataSources: { primary: 'ds1' } };
function dashboard(sources = { ds1: source }) {
    const controllers = Object.fromEntries(Object.entries(sources).map(([id, def]) => [id, {
        def, dataSource: { context: { app: 'dispatch-app', owner: 'search-owner' },
            options: { search: def.type === 'ds.searchbase' ? 'search index=resolved | stats count' : def.options.query },
            searchJob: { getSid: () => synchronous('job-id') },
        },
    }]));
    return { getDataSourceRegistry: () => ({ getDataSourceController: (id) => controllers[id] }),
        getCompleteSearchQueryAndParameters: () => ({ query: '' }), controllers };
}

test('ineligible platforms skip C3 user and Canvas requests and share eligibility across panels', async () => {
    const service = loadService();
    const mock = mockRequest(() => ({ data: { entry: [{ name: 'feature:c3', content: { c3_integration_enabled: 'false' } }] } }));
    const client = service.createCanvasIntegration(mock);
    assert.deepEqual(await Promise.all(Array.from({ length: 100 }, () => client.isEligible())), Array(100).fill(false));
    assert.equal(mock.calls.length, 1);
});

test('C3 approval requires all native status checks and caches one status request', async () => {
    for (const flag of [true, 'true', '1', 1]) {
        const service = loadService();
        const mock = mockRequest((url) => url.includes('web-features')
            ? { data: { entry: [{ name: 'feature:c3', content: { c3_integration_enabled: flag } }] } }
            : { data: [{ isEmailVerified: true, isTACSigned: true, signupStatus: 'approved' }] });
        const client = service.createCanvasIntegration(mock);
        assert.equal(await client.isEligible(), true);
        assert.equal(await client.isEligible(), true);
        assert.equal(mock.calls.length, 2);
    }
    for (const status of [{}, { isEmailVerified: true, isTACSigned: false, signupStatus: 'approved' }]) {
        const service = loadService();
        const mock = mockRequest((url) => url.includes('web-features')
            ? { data: { entry: [{ name: 'feature:c3', content: { c3_integration_enabled: true } }] } }
            : { data: [status] });
        assert.equal(await service.createCanvasIntegration(mock).isEligible(), false);
    }
});

test('eligibility failures remain hidden and never grant access', async () => {
    const service = loadService();
    const mock = mockRequest(() => ({ status: 403 }));
    assert.equal(await service.createCanvasIntegration(mock).isEligible(), false);
    assert.equal(mock.calls.length, 1);
});

test('an uncached approved user follows the native identity fallback', async () => {
    const service = loadService();
    const token = `e30.${btoa(JSON.stringify({ iss: 'https://identity.example.test' }))}.test`;
    const mock = mockRequest((url) => {
        if (url.includes('web-features')) return { data: { entry: [
            { name: 'feature:c3', content: { c3_integration_enabled: true } },
            { name: 'feature:c3_base_urls', content: { tenants_base_url: 'tenants.example.test', waitlist_base_url: 'signup.example.test' } },
        ] } };
        if (url.includes('C3Eligibility')) return { data: [] };
        if (url.includes('authorization/tokens')) return content({ token });
        if (url.includes('/userinfo')) return { data: { email_verified: true, email: 'test@example.test' } };
        if (url.includes('tenantcontext')) return { data: { tacAccepted: true } };
        if (url.includes('waitlist')) return { data: { status: 'approved' } };
        throw new Error('Unexpected request');
    });
    assert.equal(await service.createCanvasIntegration(mock).isEligible(), true);
    assert.equal(mock.calls.length, 6);
});

test('the preview reuses the running Searchbase job, dispatch namespace and submitted SPL', async () => {
    const service = loadService();
    const mock = mockRequest((url) => url.includes('results_preview')
        ? { data: { fields: [{ name: 'count' }], columns: [[7]] } }
        : content({ request: { earliest_time: '100', latest_time: '200' }, resultCount: 1, dispatchState: 'DONE' }));
    const panel = await service.createCanvasIntegration(mock).preparePanel(dashboard(), item, { ds1: source });
    assert.equal(panel.searchMetadata.query.query, 'search index=resolved | stats count');
    assert.equal(panel.searchMetadata.earliest_time, '100');
    assert.equal(panel.sid, 'job-id');
    assert.equal(mock.calls.length, 2);
    assert.ok(mock.calls.every(({ url, init }) => url.startsWith('/services/dispatch-app/search-owner/search/v2/jobs/job-id') && !init.method));
    assert.match(mock.calls[1].url, /count=100&offset=0/);
});

test('nested chains keep the resolved Searchbase root and all postprocess queries', () => {
    const service = loadService();
    const sources = { ds1: source, ds2: { type: 'ds.chain', options: { extend: 'ds1', query: '| where count>1' } }, ds3: { type: 'ds.chain', options: { extend: 'ds2', query: '| head 5' } } };
    assert.equal(service.resolvePanelQuery(dashboard(sources), sources, 'ds3'), 'search index=resolved | stats count\n| where count>1\n| head 5');
    sources.ds2.options.extend = 'ds3';
    assert.throws(() => service.resolvePanelQuery(dashboard(sources), sources, 'ds3'), /invalid search chain/);
});

test('unresolved search tokens fail before reading or transmitting results', async () => {
    const service = loadService();
    const mock = mockRequest(() => content({}));
    const api = dashboard();
    api.controllers.ds1.dataSource.options.search = 'search index=$index$';
    await assert.rejects(service.createCanvasIntegration(mock).preparePanel(api, item, { ds1: source }), /unresolved inputs/);
    assert.equal(mock.calls.length, 1);
});

test('a missing running job fails without dispatching another search', async () => {
    const service = loadService();
    const api = dashboard();
    delete api.controllers.ds1.dataSource.searchJob;
    await assert.rejects(service.panelSearchId(api, item), /no search job/);
});

test('native wrappers and chain metadata expose the existing job without a direct searchJob member', async () => {
    const service = loadService();
    const api = dashboard();
    api.controllers.ds1.dataSource = { getSid: () => synchronous('native-job') };
    assert.equal(await service.panelSearchId(api, item), 'native-job');
    api.getDataSourceMetaData = () => ({ sid: 'chain-job' });
    assert.equal(await service.panelSearchId(api, item), 'chain-job');
});

test('chain previews apply postprocessing instead of exporting unfiltered base results', async () => {
    const service = loadService();
    const sources = { ds1: source, ds2: { type: 'ds.chain', options: { extend: 'ds1', query: '| where count>1' } } };
    const mock = mockRequest((url) => url.includes('results_preview')
        ? { data: { fields: [{ name: 'count' }], columns: [[7]] } }
        : content({ request: { earliest_time: '100', latest_time: '200' } }));
    const api = dashboard(sources);
    api.getDataSourceMetaData = () => ({ sid: 'base-job' });
    const panel = await service.createCanvasIntegration(mock).preparePanel(api, { ...item, dataSources: { primary: 'ds2' } }, sources);
    assert.equal(new URL(mock.calls[1].url, 'http://local.test').searchParams.get('search'), '| where count>1');
    assert.equal(panel.searchMetadata.query.query, 'search index=resolved | stats count\n| where count>1');
});

test('oversized previews are bounded by rows and bytes before a Canvas write', async () => {
    const service = loadService();
    const run = async (columns) => {
        const mock = mockRequest((url) => url.includes('results_preview')
            ? { data: { fields: [{ name: 'count' }], columns } } : content({}));
        return service.createCanvasIntegration(mock).preparePanel(dashboard(), item, { ds1: source });
    };
    assert.equal((await run([Array(101).fill(7)])).resultsData.columns[0].length, 100);
    await assert.rejects(run([['x'.repeat(5 * 1024 * 1024)]]), /too large/);
});

test('Canvas pagination is explicit and uses native page offsets without Splunk headers', async () => {
    const service = loadService();
    const mock = mockRequest((url) => {
        if (url.includes('ai_canvas_auth')) return { data: { access_token: 'test-token' } };
        if (url.includes('conf-ai-canvas')) return content({ ai_canvas_base_url: 'https://canvas.example.test/' });
        const offset = Number(new URL(url).searchParams.get('offset'));
        return { data: { boards: Array.from({ length: offset === 0 ? 50 : 1 }, (_, i) => ({ boardId: `board-${offset + i}`, name: `Board ${offset + i}` })), total: 51 } };
    });
    const session = await service.createCanvasIntegration(mock).openSession();
    assert.equal((await session.list()).boards.length, 50);
    assert.equal((await session.list(50)).boards.length, 1);
    assert.equal(mock.calls.length, 4);
    for (const { init } of mock.calls.slice(2)) {
        assert.equal(init.headers['X-Splunk-Form-Key'], undefined);
        assert.equal(init.credentials, 'omit');
        assert.equal(init.redirect, 'error');
        assert.equal(init.headers['x-aiassistant-client-product'], 'canvas-splunk');
    }
});

test('the observed boards HTTP 500 is surfaced and never automatically retried', async () => {
    const service = loadService();
    const mock = mockRequest((url) => url.includes('ai_canvas_auth') ? { data: { access_token: 'test-token' } }
        : url.includes('conf-ai-canvas') ? content({ ai_canvas_base_url: 'https://canvas.example.test' }) : { status: 500 });
    const session = await service.createCanvasIntegration(mock).openSession();
    await assert.rejects(session.list(), /Failed to get canvases.*HTTP 500/);
    assert.equal(mock.calls.length, 3);
});

test('empty and malformed Canvas pages are distinguished', async () => {
    for (const data of [{ boards: [], total: 0 }, { boards: null, total: 50 }]) {
        const service = loadService();
        const mock = mockRequest((url) => url.includes('ai_canvas_auth') ? { data: { access_token: 'test-token' } }
            : url.includes('conf-ai-canvas') ? content({ ai_canvas_base_url: 'https://canvas.example.test' }) : { data });
        const session = await service.createCanvasIntegration(mock).openSession();
        if (data.boards) assert.deepEqual(plain(await session.list()), data);
        else await assert.rejects(session.list(), /invalid canvas list/);
    }
});

test('card creation carries the native Splunk widget schema and search context', async () => {
    const service = loadService();
    const mock = mockRequest((url, init) => {
        if (url.includes('ai_canvas_auth')) return { data: { access_token: 'test-token' } };
        if (url.includes('conf-ai-canvas')) return content({ ai_canvas_base_url: 'https://canvas.example.test' });
        if (url.endsWith('/cards')) return { data: { cardId: ['card-1'] } };
        assert.equal(init.method, 'POST');
        return { data: { board: { boardId: 'board-1' } } };
    });
    const panel = { type: 'splunk.column', resultsData: { fields: [{ name: 'count' }], columns: [[7]] }, searchMetadata: { query: { query: 'search index=resolved | stats count', sid: 'job-id' } } };
    const session = await service.createCanvasIntegration(mock).openSession();
    assert.equal(await session.create('Investigation', 'Description'), 'board-1');
    assert.deepEqual(plain(await session.add('board-1', panel, 'Authentication')), ['card-1']);
    const payload = JSON.parse(mock.calls[3].init.body).cards[0];
    assert.equal(payload.data.name, 'SplunkGeneric');
    assert.equal(payload.userData.text.contentType, 'SPL_WIDGET_TEXT');
    assert.equal(payload.data.props.vizOptions.vizType, 'bar');
    assert.equal(payload.data.props.searchMetadata.query.sid, 'job-id');
    assert.equal(payload.sources[0].query, panel.searchMetadata.query.query);
});

test('cross-launch keeps the platform tenant context and references only created cards', async () => {
    const service = loadService();
    const mock = mockRequest(() => content({ redirect_uri: 'https://cloud.example.test/home?tenant=test' }));
    const url = new URL(await service.createCanvasIntegration(mock).launchUrl('board/1', ['card-1']));
    assert.equal(url.pathname, '/home/canvas/boards/board%2F1');
    assert.equal(url.searchParams.get('tenant'), 'test');
    assert.deepEqual(JSON.parse(atob(url.searchParams.get('canvas'))).context.assistant.cardIds, ['card-1']);
    assert.equal(mock.calls[0].init.method, 'POST');
    assert.throws(() => service.httpsUrl('http://unsafe.test'), /HTTPS/);
    assert.throws(() => service.httpsUrl('https://user:pass@unsafe.test'), /HTTPS/);
});

test('the view toolbar uses the six native Studio actions in native order', () => {
    const file = path.join(root, 'common/udf/presets.jsx');
    const code = babel.transformSync(fs.readFileSync(file, 'utf8'), { presets: ['@babel/preset-react'], plugins: ['@babel/plugin-transform-modules-commonjs'] }).code;
    const module = { exports: {} };
    const types = Object.fromEntries(['CloneButton', 'DeleteButton', 'FullscreenButton', 'RefreshButton', 'ExportButton', 'LayerButton', 'InspectPanelAction', 'AddToCanvasPanelAction'].map((name) => [name, name]));
    vm.runInNewContext(`(function(require,module,exports){${code}\n})`)((id) => {
        if (id === 'react') return React;
        if (id.includes('EnterpriseViewOnlyPreset')) return { __esModule: true, default: {} };
        if (id.includes('CustomOpenSearch')) return { __esModule: true, default: 'OpenSearch' };
        return types;
    }, module, module.exports);
    assert.deepEqual(Array.from(module.exports.actionMenus.view, (element) => element.type), [
        'OpenSearch', 'InspectPanelAction', 'FullscreenButton', 'RefreshButton', 'AddToCanvasPanelAction', 'ExportButton',
    ]);
});
