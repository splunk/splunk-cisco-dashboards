const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const folder = path.resolve(__dirname, '../src/main/webapp/pages/dashboardbuilder');
const Button = () => null;
const PanelRightOpen = () => null;
const MagnifierWithPlus = () => null;
const Magnifier = () => null;
const CustomOpenSearch = () => null;
function load(name, mocks, browser = {}) {
    const source = fs.readFileSync(path.join(folder, name), 'utf8');
    const output = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
    const module = { exports: {} };
    new Function('require', 'module', 'exports', 'window', output)((id) => id in mocks ? mocks[id] : require(id), module, module.exports, browser);
    return module.exports.default;
}
test('DC search action binds the intended chart and details matches the Zero Trust drilldown icon', () => {
    const definition = { visualizations: { chart: { dataSources: { primary: 'source' } } }, dataSources: { source: { type: 'ds.searchbase' } } };
    const styled = () => () => Button;
    styled.div = () => Button;
    const Component = load('DrilldownActionViz.jsx', {
        '@splunk/dashboard-context': { useDashboardApi: () => ({ getDefinition: () => definition }) },
        '@splunk/react-ui/Button': Button,
        '@splunk/react-icons/MagnifierWithPlus': MagnifierWithPlus,
        '@splunk/react-icons/Magnifier': Magnifier,
        '../../common/icons/SuiIcon': { PanelRightOpen },
        './CustomOpenSearch': CustomOpenSearch,
        '@splunk/visualizations/common/SplunkVisualization': { propTypes: {}, defaults: {} },
        '@splunk/visualizations/common/withDashboardViz': ({ ReactViz }) => ReactViz,
        'styled-components': styled,
        '../../common/lib/dashboardDrilldown': { DASHBOARD_ACTION_KIND_METRIC_INFO: 'metric-info', DASHBOARD_ACTION_KIND_DRILLDOWN: 'drilldown' },
    });
    const search = Component({ action: 'open-search', targetVisualization: 'chart', label: 'Open faults in Search' }).props.children;
    const bound = search.type(search.props);
    assert.equal(bound.type, CustomOpenSearch);
    assert.equal(bound.props.itemDefinition, definition.visualizations.chart);
    assert.equal(bound.props.dataSources, definition.dataSources);
    assert.equal(bound.props.standalone, true);
    assert.equal(bound.props.label, 'Open faults in Search');
    const details = Component({ action: 'drilldown' }).props.children;
    assert.equal(details.props.icon.type, MagnifierWithPlus);
    assert.equal(details.props.appearance, 'default');
});
test('standalone Search reads the current time range when clicked', () => {
    let state = 0;
    let parameters = { earliest: '-24h', latest: 'now' };
    let opened;
    const Component = load('CustomOpenSearch.jsx', {
        react: { ...React, useState: () => [[false, 'index=dc', 'splunk-cisco-dashboards', [], '-24h', 'now'][state++], () => {}], useEffect: () => {}, useCallback: (fn) => fn },
        '@splunk/react-ui/Button': Button,
        '@splunk/react-icons/MagnifierWithPlus': MagnifierWithPlus,
        '@splunk/react-icons/Magnifier': Magnifier,
        '@splunk/dashboard-action-buttons': { ActionButton: () => null },
        '../../common/icons/SuiIcon': { ExternalLink: () => null },
        '../../common/lib/searchbase': { getSearches: () => {} },
        '../../common/lib/dcNetworkingScope': { applyDcNetworkingScope: (q) => q },
        '../../common/lib/openSearchTokenResolution': { resolveOpenSearchQuery: (q) => q, resolveOpenSearchToken: () => null },
    }, { location: { search: '' }, open: (url) => { opened = new URL(url, 'http://localhost'); } });
    const button = Component({ standalone: true, label: 'Open faults in Search', itemDefinition: { dataSources: { primary: 'source' } }, dataSources: {}, dashboardApi: { dataSourceRegistry: { getDataSourceController: () => ({ def: { options: { queryParameters: parameters } } }) } } });
    assert.equal(button.type, Button);
    assert.equal(button.props.icon.type, Magnifier);
    assert.equal(button.props.appearance, 'subtle');
    assert.equal(button.props['aria-label'], 'Open faults in Search');
    parameters = { earliest: '-7d', latest: '123456' };
    button.props.onClick();
    assert.equal(opened.searchParams.get('earliest'), '-7d');
    assert.equal(opened.searchParams.get('latest'), '123456');
    assert.equal(opened.searchParams.get('q'), 'index=dc');
});
