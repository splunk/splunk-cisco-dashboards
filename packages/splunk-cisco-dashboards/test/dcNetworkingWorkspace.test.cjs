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
    const scopedDefinition = { ...definition, inputs: { ...definition.inputs,
        input_account: { options: { token: 'dc_account', defaultValue: '*' } },
        input_fabric: { options: { token: 'dc_fabric', defaultValue: '*' } },
        input_device: { options: { token: 'dc_device', defaultValue: '*' } },
    } };
    const hydrated = scope.applyDcDashboardHandoff(scopedDefinition, url.searchParams);
    assert.equal(hydrated.inputs.input_time_range.options.defaultValue, '-4h@h,now,auto');
    assert.equal(hydrated.inputs.input_account.options.defaultValue, 'javi_nd');
    assert.equal(hydrated.inputs.input_fabric.options.defaultValue, 'fab 1');
    assert.equal(hydrated.inputs.input_device.options.defaultValue, '10.1.1.1');
    assert.equal(scopedDefinition.inputs.input_account.options.defaultValue, '*');
    assert.equal(scope.applyDcDashboardHandoff(definition, url.searchParams).inputs.input_time_range.options.defaultValue, '-4h@h,now,auto');
    const unrelated = { inputs: {}, dataSources: {} };
    assert.equal(scope.applyDcDashboardHandoff(unrelated, url.searchParams), unrelated);
});

test('packaged workspace has all six sections and every tile/drilldown resolves', () => {
    const config = load('src/main/webapp/common/config/insightsWorkspaces.ts');
    const dc = config.PACKAGED_WORKSPACE_FALLBACKS.find((w) => w.id === 'dc_networking');
    assert.equal(dc.sections.length, 6);
    assert.equal(dc.sections[0].title, 'What needs my attention?');
    assert.equal(dc.mapVisible, true);
    assert.equal(stanzas.size, 78);
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
    assert.deepEqual(Object.keys(definition.inputs), ['input_time_range']);
    for (const source of Object.values(definition.dataSources)) {
        assert.equal(source.type, 'ds.searchbase');
        assert.ok(stanzas.has(source.options.ref));
        assert.equal(source.options.queryParameters.earliest, '$time_tok.earliest$');
        assert.equal(source.options.queryParameters.latest, '$time_tok.latest$');
        assert.equal(source.options.dcScope, undefined);
    }
    for (const block of definition.layout.layoutDefinitions.layout_1.structure) {
        assert.ok(block.position.x + block.position.w <= definition.layout.layoutDefinitions.layout_1.options.width);
        assert.ok(block.position.y + block.position.h <= definition.layout.layoutDefinitions.layout_1.options.height);
    }
    assert.equal(definition.layout.layoutDefinitions.layout_1.options.backgroundColor, '#0b1018');
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
        assert.equal(options.showTotal, false, 'Do not sum percentages or ages into a headline');
        assert.match(spl(id), /where isnotnull\(Metric\)/);
        assert.match(body, /^default_viz = splunk\.(line|area|column|bar|singlevalueradial|fillergauge)$/m);
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
    for (const section of sections.keys()) {
        const types = new Set([...stanzas.values()].filter(body => body.includes(`"section":"${section}"`)).map(body => body.match(/^default_viz = (.+)$/m)[1]));
        assert.ok(types.size >= 4, `${section} needs visual variety`);
    }
    assert.equal(charts, 54);
    assert.equal(sections.size, 6);
    const config = load('src/main/webapp/common/config/insightsWorkspaces.ts');
    assert.equal(config.WORKSPACE_SOURCES.dc_networking.fallbackTileCount, 9);
    const layouts = fs.readFileSync(path.join(root, 'src/main/resources/splunk/default/insights_workspaces.conf'), 'utf8');
    assert.equal([...layouts.matchAll(/\[layout.dc_networking.[^\]]+\][^[]*visible_count = 9/g)].length, 6);
    assert.equal(new Set([...stanzas.values()].filter(b => b.includes('\"overview\"')).map(b => b.match(/^default_viz = (.+)$/m)[1])).size, 6);
    assert.ok([...sections.values()].every((count) => count === 9));
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

test('non-additive bars omit the summed headline while existing count bars retain it', () => {
    const React = require('react');
    const { renderToStaticMarkup } = require('react-dom/server');
    const { BarBreakdownTile } = load('src/main/webapp/common/components/workspace/BarBreakdownTile.tsx', {
        './ChartFocusDialog': { ChartFocusDialog: () => null },
        './InfoTooltip': { InfoTooltip: () => null },
        './TileActionMenu': { TileActionMenu: () => null, TileDrilldownButton: () => null },
        '@/common/lib/metricValueFormat': { formatCompactMetricNumber: String },
        '@/common/lib/utils': { cn: (...values) => values.filter(Boolean).join(' ') },
    });
    const props = { label: 'CPU comparison', rows: [{ Cpu: 'one', Metric: '60' }, { Cpu: 'two', Metric: '90' }], columns: ['Cpu', 'Metric'], source: 'live' };
    const measured = renderToStaticMarkup(React.createElement(BarBreakdownTile, { ...props, showTotal: false }));
    assert.doesNotMatch(measured, /Total 150|>150</);
    assert.match(measured, /Individual category measurements/);
    assert.match(measured, />60</);
    assert.match(measured, />90</);
    const counted = renderToStaticMarkup(React.createElement(BarBreakdownTile, props));
    assert.match(counted, /Total 150/);
});

test('all DC searches honor the existing index macro without literal index routing', () => {
    for (const id of stanzas.keys()) {
        assert.ok(spl(id).startsWith('`index_dc` '), id);
        assert.doesNotMatch(spl(id), /\bindex\s*(?:=|IN\s*\()/i, id);
        assert.ok(!spl(id).includes('dc_workspace_indexes'), id);
    }
    const macros = fs.readFileSync(path.join(root, 'src/main/resources/splunk/default/macros.conf'), 'utf8');
    assert.ok(!macros.includes('[dc_workspace_indexes]'));
    const page = fs.readFileSync(path.join(root, 'src/main/webapp/pages/executive_insights/index.tsx'), 'utf8');
    assert.ok(!page.includes('DcNetworkingScopeBar'));
});

 test('workspace icons have bounded pixel dimensions in the switcher', () => {
    const React = require('react');
    const { renderToStaticMarkup } = require('react-dom/server');
    const mocks = Object.fromEntries(['Briefcase','ShieldKeyhole','Shield','FingerprintNodes','Pulse','NetworkDevices','RobotFaceSparkle'].map(name => [`@splunk/react-icons/${name}`, props => React.createElement('svg', props)]));
    const Icon = load('src/main/webapp/common/components/workspace/WorkspaceDefaultIcon.tsx', mocks).default;
    for (const size of [20, 28]) {
        const html = renderToStaticMarkup(React.createElement(Icon, { workspace: {id:'dc_networking',sourceWorkspace:'dc_networking'},size }));
        assert.match(html, new RegExp(`width:${size}px;height:${size}px`));
        assert.doesNotMatch(html, /100%/);
    }
 });

test('critical share is a severity-colored headline trend with a classified active denominator', () => {
    const body=stanzas.get('dc_workspace_attention_critical_share');
    assert.match(body, /^default_viz = splunk.line$/m);
    const options=JSON.parse(body.match(/^viz_options = (.+)$/m)[1]);
    assert.equal(options.seriesColors[0], '#fa5762');
    assert.equal(options.overview[0].unit, '%');
    assert.match(spl('dc_workspace_attention_critical_share'), /stats avg\(Metric\) as Metric by Bucket/);
    assert.match(spl('dc_workspace_attention_critical_share'), /"medium"/);
});

// Shared chart mode regressions; isolated loader for native renderer adapters.
{
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { SplunkThemeProvider, useSplunkTheme } = require('@splunk/themes');
const root = path.resolve(__dirname, '../src/main/webapp');
const dir = 'common/components/workspace/';

function loadChart(file, extras = {}) {
    const mocks = {
        './CanvasScalarTileChrome': { CanvasScalarTileChrome: ({ children }) => React.createElement('div', null, children) },
        './ChartFocusDialog': { ChartFocusDialog: () => null },
        './InfoTooltip': { InfoTooltip: () => null },
        './TileActionMenu': { TileActionMenu: () => null, TileDrilldownButton: () => null },
        '@/common/lib/utils': { cn: (...values) => values.filter(Boolean).join(' ') },
        react: { ...React, lazy: () => props => React.createElement('div', { 'data-native-theme': props.themeKey, 'data-native-background': props.options.backgroundColor }) },
        ...extras,
    };
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
    const module = { exports: {} };
    new Function('require', 'module', 'exports', js)(id => {
        if (Object.hasOwn(mocks, id)) return mocks[id];
        if (id.startsWith('./')) return loadChart(path.posix.join(path.posix.dirname(file), `${id}.ts`), extras);
        if (id.startsWith('@/')) return loadChart(`${id.slice(2)}.ts`, extras);
        return require(id);
    }, module, module.exports);
    return module.exports;
}

function render(component, props, mode) {
    let theme;
    function Probe() { theme = useSplunkTheme(); return React.createElement(component, props); }
    const html = renderToStaticMarkup(React.createElement(SplunkThemeProvider, { family: 'prisma', colorScheme: mode, density: 'compact' }, React.createElement(Probe)));
    return { html, theme };
}

for (const mode of ['dark', 'light']) {
    test(`radial arc stays visible in ${mode} mode at zero, partial and full values`, () => {
        const { SingleValueRadialTile: Gauge } = loadChart(dir + 'SingleValueRadialTile.tsx');
        for (const value of [0, 50, 100]) {
            const { html } = render(Gauge, { label: 'Measured percentage', value, source: 'live' }, mode);
            assert.match(html, /stroke="#649ef5"/);
            assert.match(html, /stroke="var\(--sui-content-disabled, #89919c\)"/);
            assert.doesNotMatch(html, /stroke="#131a23"/);
            assert.match(html, /sui-fill-active/);
        }
        const { html } = render(Gauge, { label:'Unknown', value:NaN, noDataReason:'empty_rows' }, mode);
        assert.doesNotMatch(html, /<svg/);
        assert.match(html, /—/);
    });
    test(`radial explicit colors and threshold bands retain precedence in ${mode} mode`, () => {
        const { SingleValueRadialTile: Gauge } = loadChart(dir + 'SingleValueRadialTile.tsx');
        let { html } = render(Gauge, { label:'Custom', value:80, accentColor:'#123456', vizOptions:{ fillColor:'#abcdef', trackColor:'#654321' } }, mode);
        assert.match(html, /stroke="#abcdef"/);
        assert.match(html, /stroke="#654321"/);
        ({ html } = render(Gauge, { label:'Threshold', value:80, vizOptions:{ thresholds:[{from:50,to:100,value:'#fa5762'}] } }, mode));
        assert.match(html, /stroke="#fa5762"/);
    });
    test(`fill, marker, categorical and native composition renderers use ${mode} theme roles`, () => {
        const { FillerGaugeTile } = loadChart(dir + 'FillerGaugeTile.tsx');
        let { html } = render(FillerGaugeTile, { label:'Measured zero',value:0 }, mode);
        assert.match(html, /width:0%/);
        assert.match(html, /var\(--sui-content-disabled/);
        const { MarkerGaugeTile } = loadChart(dir + 'MarkerGaugeTile.tsx');
        ({ html } = render(MarkerGaugeTile, {label:'Bounded measure',value:90}, mode));
        assert.match(html, /var\(--sui-content-positive/);
        const { BarBreakdownTile } = loadChart(dir + 'BarBreakdownTile.tsx');
        ({ html } = render(BarBreakdownTile, {label:'Severity',rows:[{Severity:'Critical',Metric:2}],columns:['Severity','Metric']}, mode));
        assert.match(html, /var\(--sui-content-negative/);
        const { PieTile } = loadChart(dir + 'PieTile.tsx');
        const native = render(PieTile, {label:'Composition',rows:[{Product:'ACI',Metric:2}],columns:['Product','Metric']}, mode);
        assert.match(native.html, new RegExp(`data-native-theme="${mode==='dark'?'enterpriseDark':'enterprise'}"`));
        assert.ok(native.html.includes(`data-native-background="${native.theme.backgroundColorSection}"`));
    });
}

test('sparkline baselines, annotations and point outlines follow the active theme', () => {
    const source=fs.readFileSync(path.join(root,dir+'Sparkline.tsx'),'utf8');
    assert.match(source, /var\(--sui-content-disabled/);
    assert.match(source, /var\(--sui-background-popup/);
    assert.match(source, /var\(--sui-content-active/);
    assert.match(source, /var\(--sui-background-section/);
    assert.doesNotMatch(source, /fill="#0f172a"|--baseline-stroke:#cbd5e1/);
});


test('display rounding defaults to two decimal places without rounding the search data', () => {
    const format = loadChart('common/lib/metricValueFormat.ts');
    for (const input of [93.55172413793103, '93.55172413793103']) {
        assert.equal(format.formatMetricDisplayValue(input, '%'), '93.55%');
        assert.equal(format.formatMetricDisplayValue(input, '%', false), '93.55%');
    }
    assert.equal(format.formatMetricDisplayValue(1.642499999999998, '%'), '1.64%');
    assert.equal(format.formatMetricDisplayValue(10.931034482758621, '%'), '10.93%');
    assert.equal(format.formatMetricDisplayValue(76), '76');
    assert.equal(format.formatMetricDisplayValue('Unavailable'), 'Unavailable');
    assert.equal(format.formatMetricDisplayValue(0, '%'), '0%');
    assert.equal(format.formatMetricDisplayValue(-1.2345, 'ms'), '-1.23ms');
    const options = loadChart(dir+'canvasVizOptions.ts');
    assert.equal(options.resolveDecimals(undefined), 2);
    assert.equal(options.resolveDecimals({decimals:1}), 1);
    const {SingleValueRadialTile} = loadChart(dir+'SingleValueRadialTile.tsx');
    const {FillerGaugeTile} = loadChart(dir+'FillerGaugeTile.tsx');
    const {MarkerGaugeTile} = loadChart(dir+'MarkerGaugeTile.tsx');
    for (const Gauge of [SingleValueRadialTile,FillerGaugeTile,MarkerGaugeTile]) {
        const {html}=render(Gauge,{label:'Precision',value:'93.55172413793103',unit:'%'},'dark');
        assert.match(html,/93\.55/);
        assert.doesNotMatch(html,/>93\.551724/);
    }
});

}

test('port timelines aggregate narrow latest readings without retaining raw poll events', () => {
    for (const id of ['dc_workspace_hf_ports_history', 'dc_workspace_hf_enabled_history']) {
        const query = spl(id);
        assert.doesNotMatch(query, /eventstats|dedup|mvexpand/);
        assert.match(query, /fields _time Account FabricId node_id vendor.id Bucket Reading/);
        assert.match(query, /stats latest\(Reading\) as Metric by Account FabricId node_id vendor.id Bucket/);
        assert.ok(query.indexOf('DCWorkspaceScope=1') < query.indexOf('| fields'));
        assert.match(query, /Reading=coalesce\([\s\S]*,-1\)/);
        assert.match(query, /where isnotnull\(Metric\) AND Metric>=0/);
    }
});

test('DC time picker receives the same route styling as the standard dashboards', () => {
    const chrome = fs.readFileSync(path.join(root, 'src/main/resources/splunk/appserver/static/dashboard.js'), 'utf8');
    assert.match(chrome, /managedDashboards = new Set\(\[[\s\S]*?"dc_networking_operations"/);
    assert.ok(definition.inputs.input_time_range);
});


test('DC enables a five-product rail and an inventory-only factory topology', () => {
    const signal = load('src/main/webapp/common/config/signalTicker.ts');
    const defaults = signal.getDefaultSignalTickerConfig('dc_networking');
    assert.equal(defaults.enabled, true);
    assert.equal(defaults.items.length,5);
    for (const item of defaults.items) {
        const body=[...stanzas.values()].find(body=>body.includes(`search_name = ${item.searchName}\n`));
        assert.ok(body,item.searchName);
        assert.equal(item.valueField,'Metric');
        assert.equal(item.thresholdWarning,undefined,'Do not invent health thresholds');
    }
    const topology = load('src/main/webapp/common/config/workspaceTopologies.ts',{
        '@/common/components/workspace/CustomerTopologyMap': { CUSTOMER_TOPOLOGY: {id:'other'} },
    }).getWorkspaceTopology('dc_networking');
    assert.equal(topology.name,'Fabrics needing attention');
    assert.deepEqual(topology.sites,[]);
    assert.deepEqual(topology.links,[]);
    const page=fs.readFileSync(path.join(root,'src/main/webapp/pages/executive_insights/index.tsx'),'utf8');
    assert.doesNotMatch(page,/<DcFabricTopology/);
    assert.match(page,/commandOnly=\{isDcNetworking\}/);
    assert.equal(topology.telemetrySearchName,'DC Networking Workspace - DC fabrics for the standard map');
    assert.match(page,/mapPrimaryBaseCfg = isDcNetworking \? undefined/);
});

test('standard map limits attention to three named fabrics without invented geography or health', () => {
    const query=spl('dc_workspace_fabric_map');
    assert.match(query,/sha256/);
    assert.match(query,/\| head 3/);
    assert.match(query,/where HasInventory=1/);
    assert.match(query,/CriticalAnomalies>0,"critical"/);
    assert.match(query,/true\(\),"unknown"/);
    assert.match(query,/by Account Controller Fabric/);
    assert.doesNotMatch(query,/lat=|lng=|activeDevices=/);
    assert.match(query,/`index_dc`/);
});

test('DC rail styling is private to the workspace and preserves existing global choices', () => {
    const source=fs.readFileSync(path.join(root,'src/main/webapp/common/components/workspace/SignalRailTicker.tsx'),'utf8');
    const helpers=source.slice(source.indexOf('const isSignalRailVariant ='),source.indexOf('const splitRows ='));
    const js=ts.transpileModule(helpers,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;
    const storage=new Map([['user.signalRailVariant','event-horizon']]);
    const key=name=>'user.'+name;
    const api=new Function('window','readUserScopedStorageItem','userScopedStorageKey','STORAGE_KEY','DEFAULT_VARIANT',
        js+';return {readStoredVariant,writeStoredVariant};')(
        {localStorage:{setItem:(key,value)=>storage.set(key,value)}},key=>storage.get(key)??null,key,'signalRailVariant','one-cisco-glass');
    assert.equal(api.readStoredVariant(),'event-horizon');
    assert.equal(api.readStoredVariant('signalRailVariant.dc_networking','original'),'original');
    api.writeStoredVariant('minimal-enterprise','signalRailVariant.dc_networking');
    assert.equal(api.readStoredVariant('signalRailVariant.dc_networking','original'),'minimal-enterprise');
    assert.equal(api.readStoredVariant(),'event-horizon');
    storage.set(key('signalRailVariant.dc_networking'),'invalid');
    assert.equal(api.readStoredVariant('signalRailVariant.dc_networking','original'),'original');
});
