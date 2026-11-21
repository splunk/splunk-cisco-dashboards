const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const source = fs.readFileSync(path.resolve(__dirname, '../src/main/webapp/pages/dashboardbuilder/DashboardStudioDrilldownModal.jsx'), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
const urlSource = fs.readFileSync(path.resolve(__dirname, '../src/main/webapp/common/lib/splunkSearchUrl.ts'), 'utf8');
const urlModule = {};
new Function('exports', ts.transpileModule(urlSource, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(urlModule);
const Shell = () => null;
const Core = () => null;
const Provider = () => null;
const Guidance = () => null;
const Compact = () => null;
function render(mode, width = 800) {
    const entries = [{ name: 'primary', content: { search: 'index=test | stats count' } }, { name: 'related', content: { search: 'index=test | timechart count' } }];
    const setters = [];
    const layouts = [];
    let stateIndex = 0;
    const states = [entries, '', 0, { type: '', message: '' }, width];
    const builds = [];
    const Component = () => null;
    const mocks = {
        react: { ...React, useState: () => { const index = stateIndex++; return [states[index], (value) => setters.push([index, value])]; }, useRef: (value) => ({ current: value }), useMemo: (fn) => fn(), useCallback: (fn) => fn, useEffect: () => {}, useLayoutEffect: (fn) => layouts.push(fn) },
        '@splunk/themes': { variables: {} },
        '@splunk/dashboard-context': { DashboardContextProvider: Provider },
        '@splunk/dashboard-core': { DashboardCore: Core },
        '@splunk/react-ui/Message': Object.assign(Component, { Title: Component }),
        '@splunk/react-ui/Paginator': { Compact },
        '@splunk/react-ui/ScreenReaderContent': Component,
        '@splunk/react-ui/WaitSpinner': Component,
        'dompurify': { sanitize: (value) => value },
        'styled-components': { div: () => Component },
        '../../common/components/workspace/SearchbaseDrilldownGuidance': Guidance,
        '../../common/components/workspace/WorkspaceModalShell': { WorkspaceModalShell: Shell },
        '../../common/icons/SuiIcon': { ExternalLink: Component, Info: Component, Search: Component },
        '../../common/lib/splunk': { addDash: () => {} },
        '../../common/lib/searchbase': { getSearches: () => {} },
        '../../common/lib/splunkSearchUrl': urlModule,
        '../../common/lib/dcNetworkingScope': { applyDcNetworkingScope: (query) => query + ' | search Account="lab"' },
        '../../common/lib/dashboardDrilldown': {
            resolveDashboardDrilldownSearches: () => ({ resolvedSearches: entries, missingTargetIds: [] }),
            getDashboardDrilldownMetadata: () => ({ title: 'Primary metric', category: 'Network', subCategory: '', description: '' }),
            buildDashboardDrilldownDefinition: (...args) => { builds.push(args); return { dataSources: { ds_drilldown_target: { options: {} } } }; },
        },
        '../../common/styles/tailwind.css': {},
    };
    const module = { exports: {} };
    new Function('require', 'module', 'exports', output)((id) => { if (!(id in mocks)) throw Error(id); return mocks[id]; }, module, module.exports);
    const timeRange = { earliest: '-7d', latest: 'now' };
    const scope = { account: 'lab' };
    const tree = module.exports.default({ open: true, mode, origin: 'Authentication Outcomes', targetIds: ['primary'], timeRange, dcScope: scope });
    const nodes = [];
    function walk(node) {
        if (Array.isArray(node)) { node.forEach(walk); return; }
        if (!node || typeof node !== 'object') return;
        nodes.push(node);
        walk(node.props?.children);
    }
    walk(tree);
    return { tree, nodes, builds, layouts, setters, scope, timeRange };
}
for (const mode of ['metric-info', 'drilldown']) {
    test(`${mode} renders results with the selected time and scope alongside guidance`, () => {
        const result = render(mode);
        assert.equal(result.nodes.filter((node) => node.type === Core).length, 1);
        assert.equal(result.nodes.filter((node) => node.type === Guidance).length, 1);
        assert.equal(result.tree.props.openInSearchbaseHref, '/en-US/app/searchbase/start#/edit/primary#basic-information');
        assert.equal(result.builds.length, 1);
        assert.equal(result.builds[0][1], result.timeRange);
        assert.match(result.builds[0][0].content.search, /Account="lab"/);
        const definition = result.nodes.find((node) => node.type === Provider).props.initialDefinition;
        assert.equal(definition.dataSources.ds_drilldown_target.options.dcScope, result.scope);
        assert.equal(result.nodes.filter((node) => node.type === Compact).length, mode === 'drilldown' ? 1 : 0);
    });
    test(`${mode} measures the result area before mounting the dashboard`, () => {
        const result = render(mode, 0);
        assert.equal(result.nodes.filter((node) => node.type === Core).length, 0);
        const container = result.nodes.find((node) => node.props?.className === 'dashboard-builder-drilldown-dashboard');
        container.ref.current = { getBoundingClientRect: () => ({ width: 760 }) };
        result.layouts[0]();
        assert.ok(result.setters.some(([index, value]) => index === 4 && value === 760));
    });
}
