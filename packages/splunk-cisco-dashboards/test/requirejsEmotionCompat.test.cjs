const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const babel = require('@babel/core');
const isPropValid = require('@emotion/is-prop-valid').default;

const moduleId = '@emotion/is-prop-valid';
const source = fs.readFileSync(path.resolve(__dirname,
    '../src/main/webapp/common/shims/requirejsEmotionCompat.js'), 'utf8');
const compiled = babel.transformSync(source, {
    plugins: ['@babel/plugin-transform-modules-commonjs'],
}).code;
const moduleUnderTest = { exports: {} };
vm.runInNewContext(`(function(module,exports){${compiled}\n})`)(
    moduleUnderTest, moduleUnderTest.exports,
);
const { installRequireJsEmotionCompat } = moduleUnderTest.exports;

test('the default dashboard extension starts with the bridge and is not overwritten by a raw copy', () => {
    const config = require('../webpack.config.js')();
    const earlyEntry = config.entry.dashboard_compat;
    assert.equal(earlyEntry.filename, '../dashboard.js');
    assert.ok(earlyEntry.import[0].endsWith('/common/shims/requirejs-emotion-shim.ts'));
    assert.ok(earlyEntry.import[1].endsWith('/appserver/static/dashboard.js'));
    const copy = config.plugins.find(plugin => plugin.constructor.name === 'CopyPlugin');
    assert.ok(copy.patterns.some(pattern => pattern.globOptions?.ignore.includes('**/appserver/static/dashboard.js')));
});

// Model RequireJS's definition queue separately from its executed module table:
// define(name, factory) alone cannot satisfy a synchronous require(name).
function createHost({ amd = true, forwardingShim = true } = {}) {
    const defined = new Map();
    const registered = new Map();
    const definitionQueue = [];
    const asyncQueue = [];
    const errors = [];
    const originalCalls = [];
    const definitions = [];
    function loader(name, callback) {
        originalCalls.push({ receiver: this, args: Array.from(arguments) });
        if (Array.isArray(name)) {
            asyncQueue.push({ names: name, callback });
            return undefined;
        }
        if (defined.has(name)) return defined.get(name);
        const error = new Error(`Module name "${name}" has not been loaded yet for context: _. Use require([])`);
        error.requireType = 'notloaded';
        // Splunk's onError emits a dashboard custom-error event even if Motion
        // immediately catches a subsequent failure reading the missing default.
        loader.onError(error);
        return undefined;
    }
    loader.defined = name => defined.has(name);
    loader.specified = name => defined.has(name) || registered.has(name);
    loader.config = () => loader;
    loader.onError = error => errors.push(error);
    function define(name, dependencies, factory) {
        definitions.push(name);
        definitionQueue.push({ name, factory });
    }
    if (amd) define.amd = {};
    function flush() {
        for (const { name, factory } of definitionQueue.splice(0)) {
            if (!defined.has(name) && !registered.has(name)) registered.set(name, factory);
        }
        for (const { names, callback } of asyncQueue.splice(0)) {
            const modules = names.map(name => {
                if (!defined.has(name) && registered.has(name)) {
                    defined.set(name, registered.get(name)());
                    registered.delete(name);
                }
                return loader(name);
            });
            if (callback) callback(...modules);
        }
    }
    // The Splunk shim exposes config but omits defined/specified; it delegates
    // to a loader captured before the app gets control of window.require.
    const original = forwardingShim ? function(...args) {
        return loader.apply(this, args);
    } : loader;
    if (forwardingShim) {
        original.config = loader.config;
        original.toUrl = name => `/static/js/${name}.js`;
        original.helperSetting = 'before';
    }
    const host = { require: original, requirejs: original, define };
    return { host, loader, original, defined, registered, definitions, errors, originalCalls, flush, asyncQueue };
}

function optionalHeaderRequires(requireFn) {
    const validators = [];
    // Both forms are present in the two Motion copies shipped by C3.
    try { validators.push(requireFn('@emotion/is-prop-valid').default); } catch {}
    try { const name = '@emotion/is-prop-valid'; validators.push(requireFn(name).default); } catch {}
    return validators;
}

test('baseline captured loader emits both dashboard errors despite optional catches', () => {
    const state = createHost();
    assert.equal(optionalHeaderRequires(state.original).length, 0);
    assert.equal(state.errors.length, 2);
    assert.ok(state.errors.every(error => error.requireType === 'notloaded'));
});

test('early bridge supplies both header lookups with the real validator before AMD flush', () => {
    const state = createHost();
    assert.equal(installRequireJsEmotionCompat(state.host, isPropValid), true);
    const validators = optionalHeaderRequires(state.host.require);
    assert.deepEqual(validators, [isPropValid, isPropValid]);
    assert.equal(state.errors.length, 0);
    assert.equal(state.loader.defined(moduleId), false);
    for (const validator of validators) {
        assert.equal(validator('id'), true);
        assert.equal(validator('aria-label'), true);
        assert.equal(validator('data-c3-check'), true);
        assert.equal(validator('notARealDOMProperty'), false);
    }
    assert.equal(state.host.requirejs, state.host.require);
    assert.equal(state.host.__ciscoDashboardsRequirePatched, true);
});

test('named AMD preload makes captured aliases resolve after queue processing', () => {
    const state = createHost();
    const capturedAlias = state.original;
    installRequireJsEmotionCompat(state.host, isPropValid);
    assert.deepEqual(state.definitions, [moduleId]);
    assert.equal(state.asyncQueue.length, 1);
    state.flush();
    assert.deepEqual(optionalHeaderRequires(capturedAlias), [isPropValid, isPropValid]);
    assert.equal(state.loader(moduleId).default, isPropValid);
    assert.equal(state.errors.length, 0);
});

test('other modules and loader error reporting retain original behavior', () => {
    const state = createHost();
    const otherModule = { value: 42 };
    state.defined.set('existing/module', otherModule);
    const originalErrorHandler = state.loader.onError;
    installRequireJsEmotionCompat(state.host, isPropValid);
    const receiver = {};
    assert.equal(state.host.require.call(receiver, 'existing/module'), otherModule);
    assert.equal(state.originalCalls.at(-1).receiver, receiver);
    assert.equal(state.host.require('unrelated/missing'), undefined);
    assert.equal(state.errors.length, 1);
    assert.match(state.errors[0].message, /unrelated\/missing/);
    assert.equal(state.loader.onError, originalErrorHandler);
    let asyncValue;
    state.host.require(['existing/module'], value => { asyncValue = value; });
    state.flush();
    assert.equal(asyncValue, otherModule);
});

test('existing executed provider is preserved without redefining or wrapping', () => {
    const state = createHost();
    const provider = { default: () => false };
    state.defined.set(moduleId, provider);
    assert.equal(installRequireJsEmotionCompat(state.host, isPropValid), true);
    assert.equal(state.host.require, state.original);
    assert.equal(state.host.requirejs, state.original);
    assert.equal(state.host.require(moduleId), provider);
    assert.deepEqual(state.definitions, []);
    assert.equal(state.asyncQueue.length, 0);
});

test('pending provider is not overwritten and takes precedence once loaded', () => {
    const state = createHost();
    const existingValidator = () => false;
    const provider = { default: existingValidator };
    state.registered.set(moduleId, () => provider);
    installRequireJsEmotionCompat(state.host, isPropValid);
    assert.deepEqual(state.definitions, []);
    assert.equal(state.host.require(moduleId).default, isPropValid);
    state.flush();
    assert.equal(state.host.require(moduleId), provider);
    assert.equal(state.original(moduleId), provider);
    assert.equal(state.errors.length, 0);
});

test('no AMD host receives only the narrow synchronous bridge', () => {
    for (const removeDefine of [false, true]) {
        const state = createHost({ amd: false });
        if (removeDefine) delete state.host.define;
        installRequireJsEmotionCompat(state.host, isPropValid);
        assert.deepEqual(optionalHeaderRequires(state.host.require), [isPropValid, isPropValid]);
        assert.deepEqual(state.definitions, []);
        assert.equal(state.asyncQueue.length, 0);
        assert.equal(state.errors.length, 0);
    }
});

test('loader without inspection helpers still forwards all unrelated calls', () => {
    const calls = [];
    const original = (...args) => { calls.push(args); return 'forwarded'; };
    const host = { require: original };
    installRequireJsEmotionCompat(host, isPropValid);
    assert.equal(host.require(moduleId).default, isPropValid);
    assert.equal(host.require('other', 'argument'), 'forwarded');
    assert.deepEqual(calls, [['other', 'argument']]);
    assert.equal(host.requirejs, undefined);
});

test('absent loader is a harmless no-op', () => {
    assert.equal(installRequireJsEmotionCompat(undefined, isPropValid), false);
    assert.equal(installRequireJsEmotionCompat(null, isPropValid), false);
    assert.equal(installRequireJsEmotionCompat({}, isPropValid), false);
    assert.equal(installRequireJsEmotionCompat({ require: {} }, isPropValid), false);
});

test('installation is idempotent and helper reads and writes remain live', () => {
    const state = createHost();
    installRequireJsEmotionCompat(state.host, isPropValid);
    const patched = state.host.require;
    assert.equal(installRequireJsEmotionCompat(state.host, isPropValid), true);
    assert.equal(state.host.require, patched);
    assert.equal(state.asyncQueue.length, 1);
    assert.deepEqual(state.definitions, [moduleId]);
    assert.equal(patched.toUrl('abc'), '/static/js/abc.js');
    state.original.helperSetting = 'updated externally';
    assert.equal(patched.helperSetting, 'updated externally');
    patched.helperSetting = 'updated through bridge';
    assert.equal(state.original.helperSetting, 'updated through bridge');
    assert.equal(patched.config, state.original.config);
});

test('an independently supplied requirejs alias is not replaced', () => {
    const state = createHost();
    const otherAlias = () => 'separate context';
    state.host.requirejs = otherAlias;
    installRequireJsEmotionCompat(state.host, isPropValid);
    assert.equal(state.host.requirejs, otherAlias);
});
