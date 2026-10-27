const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '../../..');
const resources = path.join(root, 'packages/splunk-cisco-dashboards/src/main/resources/splunk');
const views = path.join(resources, 'default/data/ui/views');
const read = (view) => JSON.parse(fs.readFileSync(path.join(views, `${view}.xml`), 'utf8').match(/<!\[CDATA\[([\s\S]*?)\]\]>/)[1]);
const catalogue = fs.readFileSync(path.join(resources, 'default/searchbase.conf'), 'utf8');
const targets = new Set([...catalogue.matchAll(/^\[([^\]\n]+)\]|^search_name\s*=\s*(.+)$/gm)].map((match) => match[1] || match[2].trim()));
const newView = 'sn_network_service_investigations';
const updatedViews = ['sn_zta_posture', 'sn_zta_authentication_policy_enforcement', 'sn_hmf_threat_detection_enforcement', 'sn_hmf_sdwan_network_health', 'sn_data_center_operations', 'sn_secure_infrastructure_posture', 'sn_agentic_ops_operational_intelligence'];

test('investigation surfaces regenerate without drift', () => {
    execFileSync('python3', ['scripts/generate_network_investigations.py', '--check'], { cwd: root, env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } });
});

test('new dashboard has exactly six catalogue-backed evidence tables and bounded layout', () => {
    const d = read(newView);
    assert.equal(Object.keys(d.dataSources).length, 6);
    assert.deepEqual(Object.values(d.dataSources).map((ds) => ds.options.ref), ['mv_traffic_application_bytes', 'mv_traffic_decision_rates', 'mv_dns_nxdomain_clients', 'mv_dns_response_latency', 'mv_web_server_errors', 'mv_traffic_remote_administration']);
    for (const ds of Object.values(d.dataSources)) {
        assert.equal(ds.type, 'ds.searchbase');
        assert.ok(targets.has(ds.options.ref));
        assert.deepEqual(ds.options.queryParameters, { earliest: '$time_tok.earliest$', latest: '$time_tok.latest$', span: '$time_tok.span$' });
        assert.equal(ds.options.refresh, undefined);
    }
    const tables = Object.values(d.visualizations).filter((v) => v.type === 'splunk.table');
    assert.equal(tables.length, 6);
    assert.ok(tables.every((v) => v.options.count === 5));
    assert.ok(tables.every((v) => v.options.tableFormat.textOverflow === 'ellipsis'));
    assert.equal(d.layout.options.showTitleAndDescription, false);
    assert.equal(d.inputs.input_time_range.options.defaultValue, '-24h@h,now,auto');
    const layout = d.layout.layoutDefinitions.layout_overview;
    const timePosition = layout.structure.find(({ item }) => item === 'input_time_range').position;
    assert.equal(d.inputs.input_time_range.options.showAdvanced, true);
    assert.ok(timePosition.w >= 360, 'All five shortcuts and the custom-range button need to fit');
    assert.ok(layout.options.width-timePosition.x-timePosition.w >= 100, 'Keep the custom-range button clear of the overlaid Manager toolbar');
    assert.equal(layout.options.width, 1120, 'Evidence tables should not shrink below readable desktop text in the app pane');
    for (let i=1; i<=6; i++) assert.equal(d.visualizations[`viz_evidence_${i}_title`].options.customFontSize, 16, 'Markdown heading multipliers must not clip long card names');
    for (const item of layout.structure) {
        assert.ok(d.visualizations[item.item] || d.inputs[item.item]);
        const { x, y, w, h } = item.position;
        assert.ok(x >= 0 && y >= 0 && w > 0 && h > 0);
        assert.ok(x+w <= layout.options.width && y+h <= layout.options.height, item.item);
    }
    assert.match(d.visualizations.viz_scope.options.markdown, /not unique sessions|missing feeds/i);
});

test('every new action is bounded, accessible and resolves to the existing catalogue', () => {
    for (const view of [...updatedViews, newView]) {
        const d = read(view);
        for (const v of Object.values(d.visualizations)) {
            for (const handler of v.eventHandlers || []) {
                const value = handler.options?.url;
                if (!value?.startsWith('/drilldown?') && !value?.startsWith('/metric-info?')) continue;
                assert.ok(value.length <= 4096, view);
                const params = new URL(value, 'https://example.invalid').searchParams;
                const ids = params.get('target').split(',');
                assert.ok(ids.length > 0 && ids.length <= 24, view);
                assert.equal(new Set(ids).size, ids.length, view);
                for (const id of ids) assert.ok(targets.has(id), `${view}: ${id}`);
                if (v.type === 'splunk.cisco_drilldown_action') {
                    assert.ok(v.options.label.length > 12, view);
                    assert.equal(v.dataSources, undefined, 'Action-only controls must not dispatch overview searches');
                }
            }
        }
    }
});

test('new investigation tabs add no automatic searches or disconnected elements', () => {
    for (const view of ['sn_data_center_operations', 'sn_secure_infrastructure_posture', 'sn_agentic_ops_operational_intelligence']) {
        const d = read(view);
        const layout = d.layout.layoutDefinitions.layout_catalogue_investigations;
        assert.ok(d.layout.tabs.items.some((t) => t.layoutId === 'layout_catalogue_investigations'));
        const ids = new Set(layout.structure.map((i) => i.item));
        for (const id of ids) {
            const v = d.visualizations[id];
            assert.ok(v || d.inputs[id]);
            assert.equal(v?.dataSources, undefined, `${view}: ${id}`);
        }
        assert.equal(Object.keys(d.dataSources).length, view === 'sn_data_center_operations' ? 16 : 6);
    }
});

test('new dashboard is navigable, managed and uses readable width fitting', () => {
    const nav = fs.readFileSync(path.join(resources, 'default/data/ui/nav/default.xml'), 'utf8');
    assert.match(nav, /<collection label="Secure Infrastructure"[\s\S]*?dashboard_manager#\/sn_network_service_investigations/);
    const web = path.join(root, 'packages/splunk-cisco-dashboards/src/main/webapp');
    assert.match(fs.readFileSync(path.join(web, 'common/config/managedStudioViews.js'), 'utf8'), /"sn_network_service_investigations"/);
    assert.match(fs.readFileSync(path.join(resources, 'appserver/static/dashboard.js'), 'utf8'), /"sn_network_service_investigations"/);
    const editor = fs.readFileSync(path.join(web, 'pages/dashboardbuilder/DashboardStudioEditor.jsx'), 'utf8');
    assert.match(editor, /WIDTH_FIT_DASHBOARD_IDS = new Set\(\[[\s\S]*?"sn_network_service_investigations"/);
    assert.match(editor, /!WIDTH_FIT_DASHBOARD_IDS.has\(viewName\)/);
    assert.match(editor, /data-dashboard-id=\{dashID\}/);
    const styles = fs.readFileSync(path.join(resources, 'appserver/static/application.css'), 'utf8');
    assert.match(styles, /div:has\(#collection_container.dashboardbuilderview \[data-dashboard-id="sn_network_service_investigations"\]\)[\s\S]*?min-width: 0/);
    assert.match(styles, /\[data-dashboard-id="sn_network_service_investigations"\] \[data-test="cell"\] > div > span\s*\{\s*display: block/);
    const guide = fs.readFileSync(path.join(web, 'pages/user_guide/userGuide.md'), 'utf8');
    assert.match(guide, /Network service and catalogue investigations/);
    assert.match(guide, /Added \*\*Network Service Investigations\*\*/);
});
