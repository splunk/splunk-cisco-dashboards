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

test('all shared presets submit their event and token value synchronously', () => {
    const React = require('react');
    const babel = require('@babel/core');
    const vm = require('node:vm');
    const file = path.join(root, 'packages/splunk-cisco-dashboards/src/main/webapp/pages/dashboardbuilder/custominput/SimpleTimePicker.jsx');
    const code = babel.transformSync(fs.readFileSync(file, 'utf8'), { plugins: ['@babel/plugin-transform-react-jsx', '@babel/plugin-transform-modules-commonjs'] }).code;
    const hooks = { ...React, useState: (v) => [v, () => {}], useEffect() {}, useRef: (v) => ({ current: v }), useCallback: (f) => f, useMemo: (f) => f() };
    const stub = new Proxy(() => null, { get: () => stub });
    const record = { exports: {} };
    const split = (value = '') => { const [earliest, latest, span = 'auto'] = value.split(','); return { earliest, latest, span }; };
    vm.runInNewContext(`(function(require,module,exports){${code}\n})`)((id) => {
        if (id === 'react') return { __esModule: true, default: hooks, ...hooks };
        if (id === '@splunk/dashboard-inputs') return { BaseInput: { defaultProps: {} }, withInputWrapper: (c) => c };
        if (id === './timeRangeUtils') return { DEFAULT_SPAN: 'auto', isValidTimeSpan: () => true, parseTimeRangeValue: split, toTimeRangeValue: (v) => `${v.earliest},${v.latest},${v.span}` };
        if (id.startsWith('lodash/')) return require(id);
        return new Proxy({ __esModule: true, default: stub }, { get: (t, k) => k in t ? t[k] : stub });
    }, record, record.exports);
    const Picker = record.exports.default;
    const calls = [];
    const tree = Picker({ id: 'time', options: standard.options, value: '-4h,now,auto', onValueChange: (event, value) => calls.push({ event, value }) });
    const nodes = (node) => Array.isArray(node) ? node.flatMap(nodes) : node && typeof node === 'object' ? [node, ...nodes(node.props?.children)] : [];
    for (const selection of standard.options.selections) {
        const button = nodes(tree).find((n) => n.props?.value === selection.value);
        assert.ok(button, selection.label);
        const event = { preventDefault() {}, stopPropagation() {} };
        button.props.onClick(event, {});
        assert.equal(calls.at(-1)?.value, selection.value, 'Dispatch must happen before the input event lifecycle ends');
        assert.equal(calls.at(-1)?.event, event);
        assert.deepEqual({ ...Picker.valueToTokens(selection.value, standard.options) }, {
            'time_tok.earliest': selection.value.split(',')[0], 'time_tok.latest': 'now', 'time_tok.span': 'auto',
        });
    }
    assert.equal(calls.length, 5);
});
