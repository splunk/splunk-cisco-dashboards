const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const babel = require('@babel/core');

const appRoot = path.resolve(__dirname, '..');
const resourceRoot = path.join(appRoot, 'src/main/resources/splunk');
const bootstrapSource = fs.readFileSync(path.join(resourceRoot,
    'appserver/static/executive_insights_bootstrap.js'), 'utf8');
const templateSource = fs.readFileSync(path.join(resourceRoot,
    'appserver/templates/workspace_insights.html'), 'utf8');
const entrySource = fs.readFileSync(path.join(appRoot,
    'src/main/webapp/pages/workspace_insights/render.tsx'), 'utf8');

function browserContext({ native = true, gate = Promise.resolve(true), pathname } = {}) {
    const headNodes = [];
    const bodyNodes = [];
    const document = {
        head: { appendChild: node => { headNodes.push(node); return node; } },
        body: { appendChild: node => { bodyNodes.push(node); return node; } },
        getElementById: id => headNodes.find(node => node.id === id) || null,
        querySelector: selector => selector === 'script[data-scd-executive-insights-bundle]'
            ? bodyNodes.find(node => node.attributes?.['data-scd-executive-insights-bundle']) || null
            : null,
        createElement: tag => ({ tag, attributes: {}, setAttribute(name, value) { this.attributes[name] = value; } }),
    };
    const window = {
        location: { pathname: pathname || '/en-US/app/splunk-cisco-dashboards/workspace_insights' },
        scdExecutiveInsightsNativeShell: native,
        scdSetupGatePromise: gate,
    };
    const exports = {};
    const context = vm.createContext({
        window, document, Promise, Date, module: { exports },
        fetch: () => Promise.reject(new Error('Optional metadata is unavailable in this test')),
        MutationObserver: class { observe() {} disconnect() {} },
    });
    return { context, window, document, headNodes, bodyNodes };
}
async function flushMicrotasks() { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); }
function runBootstrap(state) { vm.runInContext(bootstrapSource, state.context, { timeout: 2000 }); }
function bundleScripts(state) { return state.bodyNodes.filter(node => node.attributes?.['data-scd-executive-insights-bundle']); }

function runTemplate(state) {
    for (const match of templateSource.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
        const code = match[1].replace('${json_decode(splunkd)}', JSON.stringify({ preserved: 'server partials' }));
        if (code.trim()) vm.runInContext(code, state.context, { timeout: 2000 });
    }
}

test('workspace uses an app-owned HTML view without the Simple XML dashboard host', () => {
    const view = fs.readFileSync(path.join(resourceRoot,
        'default/data/ui/views/workspace_insights.xml'), 'utf8');
    assert.match(view, /<view\s/);
    assert.match(view, /template="splunk-cisco-dashboards:\/templates\/workspace_insights\.html"/);
    assert.match(view, /type="html"/);
    assert.match(view, /<label>Insights Workspace<\/label>/);
    assert.doesNotMatch(view, /<dashboard\b|<row\b|script="/);
    assert.doesNotMatch(templateSource, /dashboard_1\.1|build\/pages\/(?:dark|light|enterprise)\/common\.js|layout-modern-nav\.js|unified-header\.js|https:\/\//);
});

test('native template preserves config, localization and server-provided partials', () => {
    assert.match(templateSource, /make_url\('\/config\?autoload=1'\)/);
    assert.match(templateSource, /make_url\('\/static\/js\/i18n\.js'\)/);
    assert.match(templateSource, /make_url\('\/i18ncatalog\?autoload=1'\)/);
    assert.match(templateSource, /json_decode\(splunkd\)/);
    const state = browserContext();
    runTemplate(state);
    assert.equal(state.window.scdExecutiveInsightsNativeShell, true);
    assert.equal(state.context.__splunkd_partials__.preserved, 'server partials');
    assert.match(state.headNodes[0].href, /^\/en-US\/static\/app\/splunk-cisco-dashboards\/application\.css\?v=\d+$/);
    assert.equal(state.headNodes[0].rel, 'stylesheet');
});

test('template loads the setup gate before appending the shared bootstrap', () => {
    const state = browserContext();
    runTemplate(state);
    assert.equal(state.bodyNodes.length, 1);
    assert.match(state.bodyNodes[0].src, /\/application\.js\?v=\d+$/);
    assert.equal(state.bodyNodes[0].onload, state.bodyNodes[0].onerror);
    state.bodyNodes[0].onload();
    assert.equal(state.bodyNodes.length, 2);
    assert.match(state.bodyNodes[1].src, /\/executive_insights_bootstrap\.js\?v=\d+$/);
});

test('template retains the setup-script failure fallback without loading a legacy host', () => {
    const state = browserContext({ pathname: '/app/splunk-cisco-dashboards/workspace_insights' });
    runTemplate(state);
    assert.match(state.bodyNodes[0].src, /^\/static\/app\/splunk-cisco-dashboards\/application\.js/);
    state.bodyNodes[0].onerror();
    assert.equal(state.bodyNodes.length, 2);
    assert.match(state.bodyNodes[1].src, /^\/static\/app\/splunk-cisco-dashboards\/executive_insights_bootstrap\.js/);
    assert.ok(state.bodyNodes.every(node => !/dashboard_1\.1|common\.js/.test(node.src)));
});

test('native flag selects the native workspace bundle after a successful setup gate', async () => {
    const state = browserContext();
    runBootstrap(state);
    await flushMicrotasks();
    assert.equal(bundleScripts(state).length, 1);
    assert.match(bundleScripts(state)[0].src, /^\/static\/app\/splunk-cisco-dashboards\/pages\/workspace_insights\.js\?v=\d+$/);
    state.context.scdLoadExecutiveInsightsBundle();
    assert.equal(bundleScripts(state).length, 1, 'Repeated bootstrap calls must not duplicate the workspace bundle');
});

test('legacy executive shell retains its existing bundle unless native flag is boolean true', async () => {
    for (const native of [undefined, false, 'true']) {
        const state = browserContext({ native });
        state.window.scdExecutiveInsightsNativeShell = native;
        runBootstrap(state);
        await flushMicrotasks();
        assert.equal(bundleScripts(state).length, 1);
        assert.match(bundleScripts(state)[0].src, /\/pages\/executive_insights\.js\?v=\d+$/);
    }
});

test('pending setup gate prevents premature native navigation and bundle loading', async () => {
    let releaseGate;
    const gate = new Promise(resolve => { releaseGate = resolve; });
    const state = browserContext({ gate });
    runBootstrap(state);
    await flushMicrotasks();
    assert.equal(bundleScripts(state).length, 0);
    releaseGate(true);
    await flushMicrotasks();
    assert.equal(bundleScripts(state).length, 1);
    assert.match(bundleScripts(state)[0].src, /\/pages\/workspace_insights\.js/);
});

test('unconfigured setup gate blocks both native and legacy workspace bundles', async () => {
    for (const native of [true, false]) {
        const state = browserContext({ native, gate: Promise.resolve(false) });
        runBootstrap(state);
        await flushMicrotasks();
        assert.equal(bundleScripts(state).length, 0);
    }
});

test('missing setup gate retains the documented fail-open behavior', async () => {
    const state = browserContext();
    delete state.window.scdSetupGatePromise;
    runBootstrap(state);
    await flushMicrotasks();
    assert.equal(bundleScripts(state).length, 1);
});

test('update badge version and locale helpers remain available in native bootstrap', () => {
    const state = browserContext();
    runBootstrap(state);
    const helpers = state.context.module.exports;
    assert.equal(helpers.compareAppVersions('1.0.80', '1.0.70'), 1);
    assert.equal(helpers.resolveAppVersions('1.0.70', '1.0.80').updateVersion, '1.0.80');
    assert.equal(helpers.resolveAppVersions('1.0.80', '1.0.70').updateVersion, '');
    assert.equal(helpers.localePrefix('/fr-FR/app/splunk-cisco-dashboards/workspace_insights'), '/fr-FR');
});

test('native React entry installs compatibility before invoking the native layout', () => {
    const compiled = babel.transformSync(entrySource, {
        filename: 'render.tsx', babelrc: false, configFile: false,
        presets: ['@babel/preset-typescript', '@babel/preset-react'],
        plugins: ['@babel/plugin-transform-modules-commonjs'],
    }).code;
    const events = [];
    const layoutCalls = [];
    function AppThemeProvider() {}
    function ExecutiveInsightsPage() {}
    const React = { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }) };
    const layout = (...args) => {
        assert.equal(events[0], '@/common/shims/requirejs-emotion-shim');
        layoutCalls.push(args);
    };
    const stubs = {
        react: React,
        '@splunk/react-page/18': layout,
        '@/common/theme/AppThemeProvider': AppThemeProvider,
        '../executive_insights': ExecutiveInsightsPage,
        '@/common/styles/tailwind.css': {},
        '@/common/shims/requirejs-emotion-shim': {},
    };
    const module = { exports: {} };
    vm.runInNewContext(`(function(require,module,exports){${compiled}\n})`)((id) => {
        assert.ok(Object.hasOwn(stubs, id), `Unexpected native entry dependency: ${id}`);
        events.push(id);
        return stubs[id];
    }, module, module.exports);
    assert.equal(layoutCalls.length, 1);
    const [tree, options] = layoutCalls[0];
    assert.equal(tree.type, AppThemeProvider);
    assert.equal(tree.props.allowColorSchemeChoice, true);
    assert.equal(tree.props.children[0].type, 'div');
    const mainTarget = tree.props.children[0];
    assert.equal(mainTarget.props.id, 'main');
    assert.equal(mainTarget.props.tabIndex, -1);
    const mount = mainTarget.props.children[0];
    assert.equal(mount.props.id, 'scan-root');
    assert.equal(mount.props.children[0].type, ExecutiveInsightsPage);
    assert.equal(options.pageTitle, 'SSNE | Insights Workspace');
    assert.equal(options.navLayout, 'auto');
    assert.equal(options.hideAppBar, false);
    assert.equal(options.theme, 'dark');
    assert.equal(options.themeDensity, 'comfortable');
    assert.equal(options.themeFamily, 'prisma');
});

test('webpack packages the native workspace entry separately from the executive fallback', () => {
    const config = require('../webpack.config.js')();
    assert.ok(config.entry.workspace_insights.endsWith('/pages/workspace_insights/render.tsx'));
    assert.ok(config.entry.executive_insights.endsWith('/pages/executive_insights/render.tsx'));
});
