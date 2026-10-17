const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const babel = require('@babel/core');

const moduleUnderTest = { exports: {} };
const code = babel.transformSync(fs.readFileSync(path.resolve(__dirname,
    '../src/main/webapp/pages/dashboardbuilder/fullscreenFocus.js'), 'utf8'), {
    plugins: ['@babel/plugin-transform-modules-commonjs'],
}).code;
vm.runInNewContext(`(function(exports){${code}\n})`)(moduleUnderTest.exports);
const { bindPanelFullscreenFocus } = moduleUnderTest.exports;

function harness() {
    const doc = new EventTarget();
    const frames = new Map();
    let nextFrame = 0;
    const focused = [];
    doc.defaultView = {
        requestAnimationFrame(callback) { frames.set(++nextFrame, callback); return nextFrame; },
        cancelAnimationFrame(id) { frames.delete(id); },
    };
    doc.fullscreenElement = null;
    const root = { ownerDocument: doc, contains: (panel) => panel.owner === root };
    const panel = (owner = root) => {
        const result = { owner, isConnected: true };
        result.button = { focus(options) { focused.push({ button: this, options }); } };
        result.querySelector = (selector) => {
            assert.equal(selector, '[data-test="fullscreen-button"]');
            return result.button;
        };
        return result;
    };
    const change = (selected) => {
        doc.fullscreenElement = selected ? { closest: () => selected } : null;
        doc.dispatchEvent(new Event('fullscreenchange'));
    };
    const flush = () => {
        const callbacks = [...frames.values()]; frames.clear();
        callbacks.forEach((callback) => callback());
    };
    return { root, doc, panel, change, flush, frames, focused };
}

test('Escape/fullscreen exit restores the originating native button after rendering', () => {
    const h = harness(); const a = h.panel(); const b = h.panel();
    const cleanup = bindPanelFullscreenFocus(h.root);
    h.change(b); h.change(null);
    h.change(null);
    assert.equal(h.focused.length, 0, 'wait for the exit render');
    h.flush();
    assert.equal(h.focused.length, 1);
    assert.equal(h.focused[0].button, b.button);
    assert.notEqual(h.focused[0].button, a.button);
    assert.equal(h.focused[0].options.preventScroll, true);
    h.change(null); h.flush();
    assert.equal(h.focused.length, 1, 'duplicate exit events must not steal focus');
    cleanup();
});

test('foreign dashboards and whole-document fullscreen do not restore a panel', () => {
    const h = harness(); const cleanup = bindPanelFullscreenFocus(h.root);
    h.change(h.panel({})); h.change(null); h.flush();
    h.doc.fullscreenElement = { closest: () => null };
    h.doc.dispatchEvent(new Event('fullscreenchange'));
    h.change(null); h.flush();
    assert.equal(h.focused.length, 0);
    cleanup();
});

test('switching fullscreen panels or reentering before the frame cancels old restoration', () => {
    const h = harness(); const a = h.panel(); const b = h.panel();
    const cleanup = bindPanelFullscreenFocus(h.root);
    h.change(a); h.change(null);
    h.change(b); h.flush();
    assert.equal(h.focused.length, 0);
    h.change(null); h.flush();
    assert.equal(h.focused[0].button, b.button);
    cleanup();
});

test('focus resolves a remounted button and ignores a removed panel or action', () => {
    const h = harness(); const a = h.panel(); const cleanup = bindPanelFullscreenFocus(h.root);
    h.change(a); h.change(null);
    const replacement = { focus() { h.focused.push({ button: replacement }); } };
    a.button = replacement; h.flush();
    assert.equal(h.focused[0].button, replacement);
    h.change(a); h.change(null); a.isConnected = false; h.flush();
    assert.equal(h.focused.length, 1);
    a.isConnected = true; a.button = null;
    h.change(a); h.change(null); h.flush();
    assert.equal(h.focused.length, 1);
    cleanup();
});

test('unmount removes the listener and cancels pending focus', () => {
    const h = harness(); const a = h.panel(); const cleanup = bindPanelFullscreenFocus(h.root);
    h.change(a); h.change(null); cleanup(); h.flush();
    h.change(a); h.change(null); h.flush();
    assert.equal(h.frames.size, 0);
    assert.equal(h.focused.length, 0);
});
