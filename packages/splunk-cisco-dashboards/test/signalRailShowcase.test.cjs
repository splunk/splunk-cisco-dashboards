const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '..');
const load = (file, requireFn = require) => {
    const mod = { exports: {} };
    new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
        compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2020 },
    }).outputText)(requireFn, mod, mod.exports);
    return mod.exports;
};
const series = load('src/main/webapp/common/lib/signalRailSeries.ts');
test('only live timestamped samples can become a rail trend, including measured zero', () => {
    for (const source of ['loading', 'mock', 'error']) assert.deepEqual(series.observedSignalSeries(source, [1, 2], [10, 20]), []);
    for (const [values, times] of [[[1], [10]], [[1, 2], []], [[1, NaN], [10, 20]], [[1, 2], [10, Infinity]], [[1, 2], [10, 10]]]) {
        assert.deepEqual(series.observedSignalSeries('live', values, times), []);
    }
    assert.deepEqual(series.observedSignalSeries('live', [5, 0], [20, 10]), [{time: 10, value: 0}, {time: 20, value: 5}]);
});
test('trends stay bounded and equality sees time/value updates without reordering inputs', () => {
    const values = Array.from({length: 100}, (_, i) => i);
    const points = series.observedSignalSeries('live', values, values);
    assert.equal(points.length, 60); assert.equal(points[0].time, 40);
    assert.equal(series.sameSignalSeries(points, [...points]), true);
    assert.equal(series.sameSignalSeries(points, [{...points[0], value: 99}, ...points.slice(1)]), false);
    assert.equal(values[0], 0);
});
test('live epoch milliseconds keep their actual date and timezone in hover labels', () => {
    const time = Date.UTC(2026, 10, 12, 18, 30);
    assert.match(series.formatSignalRailTime(time, 'en-US', 'UTC'), /Nov 12, 2026.*06:30.*UTC/);
    assert.deepEqual(series.observedSignalSeries('live', [1, 2], [time, 1e50]), []);
});
const showcaseRequire = id => {
    if (id === '@splunk/splunk-utils/url') return {createStaticURL: p => '/static/' + p};
    if (id === '@/common/lib/signalRailSeries') return series;
    if (id === '@/common/icons/SuiIcon') return {ExternalLink: p => React.createElement('span', p)};
    return require(id);
};
const showcase = load('src/main/webapp/common/components/workspace/SignalRailShowcase.tsx', showcaseRequire).default;
const overflowShowcase = load('src/main/webapp/common/components/workspace/SignalRailShowcase.tsx', id => id === 'react'
    ? {...React, useState: () => [true, () => {}]} : showcaseRequire(id)).default;
const kpis = [
    {id: 'a', label: 'A long unchanged healthy label', value: 0, status: 'healthy', category: 'Network', href: '/search?a', canOpen: true},
    {id: 'b', label: 'Critical signal', value: 57, status: 'critical', category: 'Network'},
    {id: 'c', label: 'Unavailable classification', value: '--', status: 'unknown', category: 'Network'},
];
const render = (variant, extra = {}) => renderToStaticMarkup(React.createElement(showcase, {
    kpis, variant, fontSize: 'standard', density: 'comfortable', rows: 1, durationSeconds: 0, paused: false, ...extra,
}));
test('all three styles retain real values, long labels, unknowns and existing Search links', () => {
    for (const variant of ['prism-pulse', 'signal-orbit', 'event-horizon']) {
        const html = render(variant);
        assert.equal((html.match(/<article /g) || []).length, 3);
        for (const kpi of kpis) assert.ok(html.includes(kpi.label));
        assert.match(html, />0<\/span>/); assert.match(html, /Watching/);
        assert.match(html, /rel="noopener noreferrer"/);
        assert.equal((html.match(/Trend unavailable<\/span>/g) || []).length, 3);
        assert.doesNotMatch(html, /Configure Signal Rail/);
    }
});
test('Prism features first critical signal; Orbit preserves order and does not expose gauge percentages', () => {
    assert.ok(render('prism-pulse').indexOf('Critical signal') < render('prism-pulse').indexOf(kpis[0].label));
    const orbit = render('signal-orbit');
    assert.ok(orbit.indexOf(kpis[0].label) < orbit.indexOf('Critical signal'));
    assert.doesNotMatch(orbit, /role="progressbar"|aria-valuenow|<svg/);
    assert.deepEqual(kpis.map(k => k.id), ['a', 'b', 'c']);
});
test('movement waits for an overflow measurement rather than repeating a set that fits', () => {
    assert.equal((render('event-horizon', {durationSeconds: 60}).match(/<article /g) || []).length, 3);
});
test('when overflow is measured, scrolling duplicates are inaccessible and no signals are omitted', () => {
    const html = renderToStaticMarkup(React.createElement(overflowShowcase, {
        kpis, variant: 'event-horizon', fontSize: 'standard', density: 'comfortable', rows: 2,
        durationSeconds: 60, paused: true,
    }));
    assert.match(html, /data-paused="true"/);
    assert.match(html, /aria-hidden="true"/);
    assert.match(html, /tabindex="-1"/);
    assert.equal((html.match(/<article /g) || []).length, 6);
});
