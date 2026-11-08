const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

function load(relative, mocks = {}) {
    const source = fs.readFileSync(path.join(root, relative), 'utf8');
    const js = ts.transpileModule(source, { compilerOptions: {
        target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.React, allowJs: true, esModuleInterop: true,
    } }).outputText;
    const module = { exports: {} };
    new Function('require', 'exports', 'module', js)(
        (id) => Object.hasOwn(mocks, id) ? mocks[id] : require(id), module.exports, module,
    );
    return module.exports;
}

const scope = load('src/main/webapp/common/lib/dcNetworkingScope.ts');
const conf = fs.readFileSync(path.join(root, 'src/main/resources/splunk/default/searchbase.conf'), 'utf8');
const stanzas = new Map([...conf.matchAll(/^\[(dc_workspace_[^\]]+)\]\n([\s\S]*?)(?=^\[|$(?![\s\S]))/gm)]
    .map((m) => [m[1], m[2]]));
const spl = (id) => stanzas.get(id).match(/^search = ([\s\S]*)/m)[1].trim().replace(/\\\n/g, '\n').replace(/\n# END DC NETWORKING WORKSPACE$/, '');
const definition = JSON.parse(fs.readFileSync(path.join(root, 'src/main/resources/splunk/default/data/ui/views/dc_networking_operations.xml'), 'utf8').match(/<!\[CDATA\[([\s\S]*?)\]\]>/)[1]);

test('DC scope is exact, bounded, injected before aggregation, and rejects SPL/macros/tokens', () => {
    const query = spl('dc_workspace_nd_anomalies');
    const scoped = scope.applyDcNetworkingScope(query, { account: 'Javi_ND', fabric: 'KRK-CSS-EMEA-FAB1', device: 'Leaf-1111' });
    assert.match(scoped, /lower\(Account\)="javi_nd"/);
    assert.match(scoped, /lower\(Fabric\)="krk-css-emea-fab1"/);
    assert.match(scoped, /lower\(Device\)="leaf-1111"/);
    assert.ok(scoped.indexOf('lower(Account)') < scoped.indexOf('eventstats'));
    for (const value of ['x" | collect index=main', '`macro`', '$token$', 'x\\y', 'x\ny', 'x'.repeat(129)]) {
        assert.throws(() => scope.applyDcNetworkingScope(query, { device: value }));
    }
    assert.equal(scope.applyDcNetworkingScope(query, { account: '*' }), query);
    assert.equal(scope.applyDcNetworkingScope('index=other | stats count', { account: 'x' }), 'index=other | stats count');
});

test('time and all scope identities survive the workspace-to-Manager handoff', () => {
    const url = new URL(scope.dcScopeDashboardUrl({ account: 'Javi_ND', fabric: 'FAB 1', device: '10.1.1.1' }, '-4h@h', 'now'), 'https://example.test/app/ssne/');
    assert.equal(url.hash, '#/dc_networking_operations');
    const hydrated = scope.applyDcDashboardHandoff(definition, url.searchParams);
    assert.equal(hydrated.inputs.input_time.options.defaultValue, '-4h@h,now,auto');
    assert.equal(hydrated.inputs.input_account.options.defaultValue, 'javi_nd');
    assert.equal(hydrated.inputs.input_fabric.options.defaultValue, 'fab 1');
    assert.equal(hydrated.inputs.input_device.options.defaultValue, '10.1.1.1');
    assert.equal(definition.inputs.input_account.options.defaultValue, '*');
    const unrelated = { inputs: {}, dataSources: {} };
    assert.equal(scope.applyDcDashboardHandoff(unrelated, url.searchParams), unrelated);
});

test('packaged workspace has all six sections and every tile/drilldown resolves', () => {
    const config = load('src/main/webapp/common/config/insightsWorkspaces.ts');
    const dc = config.PACKAGED_WORKSPACE_FALLBACKS.find((w) => w.id === 'dc_networking');
    assert.equal(dc.sections.length, 6);
    assert.equal(dc.sections[0].title, 'What needs my attention?');
    assert.equal(dc.mapVisible, false);
    assert.equal(stanzas.size, 45);
    assert.equal(dc.maxTileCount, 9);
    for (const [id, body] of stanzas) {
        assert.match(body, /^search_type = display$/m);
        assert.match(body, /^search_hidden = 0$/m);
        assert.ok(spl(id).includes(scope.DC_SCOPE_MARKER));
        for (const ref of (body.match(/^drilldown_stanza_ids = (.+)$/m)?.[1] || '').split(',').filter(Boolean)) {
            assert.ok(stanzas.has(ref), `${id} references missing ${ref}`);
        }
    }
    const layout = fs.readFileSync(path.join(root, 'src/main/resources/splunk/default/insights_workspaces.conf'), 'utf8');
    for (const match of layout.matchAll(/^\[layout\.dc_networking\.([^\]]+)\]\ntiles = (.+)/gm)) {
        assert.ok(dc.sections.some((s) => s.id === match[1]));
        for (const id of match[2].split(',')) assert.ok(stanzas.has(id));
    }
});

test('Manager dashboard uses visible library sources, global time/scope and dark styling', () => {
    assert.equal(Object.keys(definition.dataSources).length, 14);
    for (const source of Object.values(definition.dataSources)) {
        assert.equal(source.type, 'ds.searchbase');
        assert.ok(stanzas.has(source.options.ref));
        assert.equal(source.options.queryParameters.earliest, '$time_tok.earliest$');
        assert.equal(source.options.queryParameters.latest, '$time_tok.latest$');
        assert.deepEqual(source.options.dcScope, { account: '$dc_account$', fabric: '$dc_fabric$', device: '$dc_device$' });
    }
    for (const block of definition.layout.structure) {
        assert.ok(block.position.x + block.position.w <= definition.layout.options.width);
        assert.ok(block.position.y + block.position.h <= definition.layout.options.height);
    }
    assert.equal(definition.layout.options.backgroundColor, '#0b1018');
});

test('Searchbase runtime scopes actual SPL and fails before dispatch on invalid scope', async () => {
    const created = [];
    const mocks = {
        '../../common/lib/dcNetworkingScope': scope,
        '@splunk/datasources': { DataSource: class { constructor(options, context) { this.options = options; this.context = context; } equals(other) { return JSON.stringify(this.options) === JSON.stringify(other.options); } } },
        '@splunk/splunk-utils/config': { app: 'splunk-cisco-dashboards' },
        '@splunk/ui-utils/i18n': { _: (value) => value },
        '@splunk/dashboard-utils': { console: { error() {} }, noop() {} },
        '../../common/lib/searchbase': { getSearchBaseConfStanza: async () => ({ status: 200, entry: [{ content: { search: spl('dc_workspace_nd_anomalies') } }] }) },
        '@splunk/search-job': { create(options) { created.push(options); return { getSid: () => ({ first: () => ({ toPromise: async () => 'test-sid' }) }) }; } },
    };
    const DataSource = load('src/main/webapp/pages/dashboardbuilder/SearchBaseDataSource.jsx', mocks).default;
    const good = new DataSource({ ref: 'dc_workspace_nd_anomalies', dcScope: { account: 'Javi_ND' }, queryParameters: { earliest: '-4h', latest: 'now' } }, {});
    assert.equal(await good.setup(), 'test-sid', String(good.setupError));
    assert.match(created[0].search, /lower\(Account\)="javi_nd"/);
    assert.equal(created[0].earliest_time, '-4h');
    const otherScope = new DataSource({ ref: 'dc_workspace_nd_anomalies', dcScope: { account: 'another-controller' }, queryParameters: { earliest: '-4h', latest: 'now' } }, {});
    assert.equal(good.equals(otherScope), false, 'Changing scope must invalidate the datasource even when time/ref are unchanged');
    const bad = new DataSource({ ref: 'dc_workspace_nd_anomalies', dcScope: { account: '`bad`' } }, {});
    assert.equal(await bad.setup(), null);
    assert.ok(bad.setupError);
    assert.equal(created.length, 1);
});

test('fault state, counter gaps and relationship types remain distinct in SPL', () => {
    assert.match(spl('dc_workspace_nd_anomalies'), /lower\(cleared\)="false" AND lower\(expired\)="false"/);
    assert.ok(spl('dc_workspace_nd_anomalies').indexOf('dedup') < spl('dc_workspace_nd_anomalies').indexOf('lower(cleared)'));
    assert.match(spl('dc_workspace_coverage'), /isnull\(LastObserved\),"No observations/);
    assert.doesNotMatch(spl('dc_workspace_coverage'), /fillnull|coalesce\((?:LastObserved|HealthPct|AgeMinutes),0\)/);
    assert.match(spl('dc_workspace_hf_measurements'), /Rates not reported; throughput unknown/);
    assert.match(spl('dc_workspace_san_analytics'), /units and flow identity unreported/);
    assert.match(spl('dc_workspace_inventory_matches'), /ProductCount>1/);
    assert.match(spl('dc_workspace_reported_links'), /Reported topology; not classified as a physical connection/);
});

test('overview uses charts, supports nine searches per section, and keeps tables as evidence', () => {
    let charts = 0;
    const sections = new Map();
    for (const [id, body] of stanzas) {
        const options = JSON.parse(body.match(/^viz_options = (.+)$/m)[1]);
        if (!options.overview) continue;
        charts += 1;
        assert.match(body, /^default_viz = splunk\.(line|bar)$/m);
        const section = options.overview[0].section;
        sections.set(section, (sections.get(section) || 0) + 1);
        for (const target of body.match(/^drilldown_stanza_ids = (.+)$/m)[1].split(',')) {
            assert.match(stanzas.get(target), /^default_viz = splunk.table$/m, `${id} must open detailed evidence`);
        }
        if (body.includes('default_viz = splunk.line')) {
            assert.match(spl(id), /by .* Bucket/);
            assert.match(spl(id), /where isnotnull\(Metric\)/);
            assert.doesNotMatch(spl(id), /fillnull|timechart/);
        }
    }
    assert.equal(charts, 27);
    assert.equal(sections.size, 6);
    assert.ok([...sections.values()].every((count) => count >= 3 && count <= 9));
    assert.equal(Object.values(definition.visualizations).filter((v) => v.type === 'splunk.table').length, 0);
    assert.equal(Object.values(definition.visualizations).filter((v) => v.type === 'splunk.cisco_drilldown_action').length, 14);
});

test('SUI defaults distinguish workspaces and uploaded branding remains replaceable', () => {
    const iconNames = ['Briefcase', 'ShieldKeyhole', 'Shield', 'FingerprintNodes', 'Pulse', 'NetworkDevices', 'RobotFaceSparkle'];
    const icons = load('src/main/webapp/common/components/workspace/WorkspaceDefaultIcon.tsx', Object.fromEntries(
        iconNames.map((name) => [`@splunk/react-icons/${name}`, function Icon() { return null; }]),
    ));
    const config = load('src/main/webapp/common/config/insightsWorkspaces.ts');
    const expected = { dc_networking: 'network', secure_networking: 'secure', zero_trust_access_demo: 'access',
        network_resilience_demo: 'pulse', agentic_security_operations_center: 'soc', security_operations_demo: 'security', executive: 'executive' };
    for (const workspace of config.PACKAGED_WORKSPACE_FALLBACKS) {
        assert.equal(icons.workspaceIconName(workspace), expected[workspace.id]);
        assert.equal(workspace.hideDefaultLogo, false);
    }
    const page = fs.readFileSync(path.join(root, 'src/main/webapp/pages/executive_insights/index.tsx'), 'utf8');
    assert.match(page, /next\.logoDataUri \?\? ""/);
    assert.match(page, /defaultIcon=\{<WorkspaceDefaultIcon workspace=\{insightsWorkspace\}/);
    assert.match(page, /readImageAsDataUri\(file\)/);
    assert.match(page, /dataUri.length > BRANDING_LOGO_DATA_URI_MAX_BYTES/);
});

test('Manager drilldown URLs carry validated exact scope and reject injected values', () => {
    assert.deepEqual(scope.dcScopeFromDrilldownUrl('/drilldown?target=x&dc_account=Javi_ND&dc_fabric=FAB1&dc_device=Leaf-1'),
        { account: 'javi_nd', fabric: 'fab1', device: 'leaf-1' });
    assert.equal(scope.dcScopeFromDrilldownUrl('/drilldown?target=x'), undefined);
    assert.throws(() => scope.dcScopeFromDrilldownUrl('/drilldown?target=x&dc_account=%60bad%60'));
});
