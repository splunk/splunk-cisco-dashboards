const assert = require('node:assert/strict');
const { test } = require('node:test');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const standard = JSON.parse(fs.readFileSync(path.join(root, 'scripts/dashboard_time_range.json'), 'utf8'));
const views = path.join(root, 'packages/splunk-cisco-dashboards/src/main/resources/splunk/default/data/ui/views');
const dc = JSON.parse(fs.readFileSync(path.join(views, 'dc_networking_operations.xml'), 'utf8').match(/<!\[CDATA\[([\s\S]*?)\]\]>/)[1]);
const run = (folder) => spawnSync('python3', ['scripts/validate_dashboard_time_inputs.py', ...(folder ? ['--views', folder] : [])], { cwd: root, encoding: 'utf8', env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } });
const fixture = (mutate) => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'dashboard-time-'));
    try {
        const definition = structuredClone(dc);
        mutate(definition);
        fs.writeFileSync(path.join(folder, 'fixture.xml'), `<dashboard><definition><![CDATA[${JSON.stringify(definition)}]]></definition></dashboard>`);
        return run(folder);
    } finally { fs.rmSync(folder, { recursive: true, force: true }); }
};
test('all shipped Studio dashboards pass the time-input audit', () => {
    const result = run();
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /shared pickers, \d+ native pickers/);
});
test('DC uses all standard presets and header placement without changing search time token identities', () => {
    assert.deepEqual(dc.inputs.input_time, standard);
    assert.deepEqual(standard.options.selections.map((s) => s.label), ['4h', '24h', '48h', '7d', '30d']);
    assert.equal(standard.options.defaultValue, '-24h@h,now,auto');
    assert.equal(standard.options.showAdvanced, true);
    assert.deepEqual(dc.layout.globalInputs, []);
    const picker = dc.layout.layoutDefinitions.layout_1.structure.find((s) => s.item === 'input_time').position;
    const header = dc.layout.layoutDefinitions.layout_1.structure.find((s) => s.item === 'header').position;
    assert.ok(header.x + header.w <= picker.x, 'Header text must not overlap the picker');
    assert.ok(dc.layout.layoutDefinitions.layout_1.options.width - picker.x - picker.w >= 100, 'Keep clear of the Manager toolbar');
    for (const source of Object.values(dc.dataSources)) assert.deepEqual(source.options.queryParameters, {
        earliest: '$time_tok.earliest$', latest: '$time_tok.latest$', span: '$time_tok.span$',
    });
});
test('packaging rejects preset, Advanced and default-value drift', () => {
    for (const mutate of [
        (d) => d.inputs.input_time.options.selections.pop(),
        (d) => { d.inputs.input_time.options.showAdvanced = false; },
        (d) => { d.inputs.input_time.options.defaultValue = '-4h,now,auto'; },
    ]) {
        const result = fixture(mutate);
        assert.notEqual(result.status, 0);
        assert.match(result.stdout, /shared time picker must match/);
    }
});
test('packaging rejects unbound tokens, compressed controls and misplaced pickers', () => {
    for (const [mutate, message] of [
        [(d) => { Object.values(d.dataSources)[0].options.queryParameters.earliest = '$wrong_time.earliest$'; }, /unbound time token/],
        [(d) => { d.layout.layoutDefinitions.layout_1.structure.find((s) => s.item === 'input_time').position.w = 200; }, /too small/],
        [(d) => { d.layout.globalInputs = ['input_time']; }, /not globalInputs/],
        [(d) => { d.layout.options.submitButton = true; }, /immediate submission/],
        [(d) => { d.layout.options.submitOnDashboardLoad = false; }, /submission on load/],
        [(d) => { d.layout.layoutDefinitions.layout_1.structure = d.layout.layoutDefinitions.layout_1.structure.filter((s) => s.item !== 'input_time'); }, /expected one positioned/],
    ]) {
        const result = fixture(mutate);
        assert.notEqual(result.status, 0);
        assert.match(result.stdout, message);
    }
});
test('native Studio pickers retain their intentional lookback but must use native value format', () => {
    const result = fixture((d) => {
        d.inputs = { native: { type: 'input.timerange', options: { token: 'global_time', defaultValue: '-7d@h,now' } } };
        d.dataSources = {};
    });
    assert.equal(result.status, 0, result.stdout);
    const invalid = fixture((d) => {
        d.inputs = { native: { type: 'input.timerange', options: { token: 'time_tok', defaultValue: '-7d,now,auto' } } };
    });
    assert.notEqual(invalid.status, 0);
    assert.match(invalid.stdout, /native time range requires/);
});
