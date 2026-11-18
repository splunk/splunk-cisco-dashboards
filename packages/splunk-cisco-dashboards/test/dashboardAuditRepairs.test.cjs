const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const babel = require('@babel/core');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/main/webapp/common/lib/dashboardDrilldown.js'), 'utf8');
const compiled = babel.transformSync(source, {plugins: ['@babel/plugin-transform-modules-commonjs']}).code;
const record = {exports: {}};
vm.runInNewContext(`(function(module,exports){${compiled}\n})`)(record, record.exports);
const {buildDashboardDrilldownDefinition, buildWorkspaceDrilldownDefinition} = record.exports;
const conf = fs.readFileSync(path.join(root, 'src/main/resources/splunk/default/searchbase.conf'), 'utf8');
const stanzas = Object.fromEntries([...conf.matchAll(/^\[([^\]]+)\]\n([\s\S]*?)(?=^\[|$(?![\s\S]))/gm)].map(m => [m[1], m[2]]));
for (const alias of ['unstacked', 'default']) {
    test(`existing catalogue ${alias} options work in both modal entry points without mutation`, () => {
        const options = {stackMode: alias, seriesColors: ['#38BDF8']};
        const workspace = buildWorkspaceDrilldownDefinition({defaultViz: 'splunk.column', vizOptions: options});
        const dashboard = buildDashboardDrilldownDefinition({name: 'metric', content: {default_viz: 'splunk.column', viz_options: JSON.stringify(options)}});
        for (const d of [workspace, dashboard]) assert.equal(d.visualizations.viz_drilldown_result.options.stackMode, 'auto');
        assert.equal(options.stackMode, alias);
    });
}
test('valid stacking and token expressions retain their meaning', () => {
    for (const stackMode of ['auto', 'stacked', 'stacked100', '$stack_mode$']) {
        const d = buildWorkspaceDrilldownDefinition({defaultViz: 'splunk.column', vizOptions: {stackMode}});
        assert.equal(d.visualizations.viz_drilldown_result.options.stackMode, stackMode);
    }
});
test('bundled chart options use supported stacking literals', () => {
    for (const [id, block] of Object.entries(stanzas)) {
        const raw = block.match(/^viz_options = (.+)$/m)?.[1];
        if (!raw) continue;
        const options = JSON.parse(raw);
        if (options.stackMode) assert.ok(['auto', 'stacked', 'stacked100'].includes(options.stackMode), id);
    }
});
test('Active alerts navigates to an existing alert detail search', () => {
    const block = stanzas.overview_active_critical_alerts;
    const id = block.match(/^drilldown_stanza_id = (.+)$/m)[1];
    assert.equal(id, 'it_health_te_alerts_recent_detail');
    assert.match(stanzas[id], /DATAMODEL=Cisco_ThousandEyes.Alerts/);
    assert.match(stanzas[id], /"Alert ID"/);
});
test('wireless traffic totals normalize duplicate multivalue counters before arithmetic', () => {
    for (const id of ['client_summary_ds_client_traffic_by_band', 'client_summary_ds_top_ssids_by_traffic']) {
        const query = stanzas[id].split('search = ')[1];
        assert.match(query, /tonumber\(mvindex\(mvdedup\('traffic.txBytes'\),0\)\)/);
        assert.match(query, /tonumber\(mvindex\(mvdedup\('traffic.rxBytes'\),0\)\)/);
        assert.match(query, /isnotnull\(tx_bytes\) OR isnotnull\(rx_bytes\)/);
        assert.match(query, /stats sum\(total_bytes\) as traffic_bytes/);
    }
});
