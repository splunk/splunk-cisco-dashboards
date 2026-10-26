const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const file = path.resolve(__dirname, '../src/main/webapp/common/hooks/useKeyboardShortcuts.ts');
const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

class Element {
    constructor(tagName = 'DIV', editable = false, role = null) {
        this.tagName = tagName;
        this.isContentEditable = editable;
        this.role = role;
        this.className = '';
        this.parentElement = null;
    }
    getAttribute(name) { return name === 'role' ? this.role : null; }
    closest(selector) {
        assert.equal(selector, '.dashboard-panel');
        for (let element = this; element; element = element.parentElement) {
            if (element.className.split(' ').includes('dashboard-panel')) return element;
        }
        return null;
    }
}

const setup = (scoped = true) => {
    let listener;
    let cleanup;
    const scope = new Element();
    const body = new Element('BODY');
    const root = new Element('HTML');
    const panel = new Element();
    panel.className = 'dashboard-panel';
    scope.parentElement = panel;
    panel.parentElement = body;
    const documentState = {
        body, documentElement: root, activeElement: body,
        addEventListener: (_type, handler) => { listener = handler; },
        removeEventListener: () => { listener = null; },
    };
    const triggered = [];
    const module = { exports: {} };
    vm.runInNewContext(`(function(require,module,exports){${compiled}\n})`, {
        HTMLElement: Element,
        document: documentState,
        window: { setTimeout, clearTimeout },
    })((id) => {
        assert.equal(id, 'react');
        return { useRef: (value) => ({ current: value }), useEffect: (effect) => { cleanup = effect(); } };
    }, module, module.exports);
    module.exports.useKeyboardShortcuts(
        ['r', 't', 'g r'].map((keys) => ({ keys, handler: () => triggered.push(keys) })),
        true,
        scoped ? { current: scope } : undefined,
    );
    const press = (key, eventPath = [scope], overrides = {}) => {
        let prevented = false;
        listener({ key, target: eventPath[0], composedPath: () => eventPath,
            preventDefault: () => { prevented = true; }, ...overrides });
        return prevented;
    };
    return { scope, body, panel, triggered, press,
        focus: (element) => { documentState.activeElement = element; },
        cleanup: () => cleanup() };
};

test('workspace shortcuts work only inside the workspace, including go combinations', () => {
    const h = setup();
    try {
        assert.equal(h.press('r'), true);
        assert.equal(h.press('t'), true);
        h.press('g'); h.press('r');
        assert.deepEqual(h.triggered, ['r', 't', 'g r']);
        assert.equal(h.press('r', [new Element('AI-ASSISTANT')]), false);
        assert.equal(h.press('t', [new Element('BUTTON')]), false);
        assert.equal(h.triggered.length, 3);
    } finally { h.cleanup(); }
});

test('shortcuts still work from the unfocused page background', () => {
    const h = setup();
    try {
        assert.equal(h.press('r', [h.body]), true);
        assert.equal(h.press('t', [h.body]), true);
        assert.deepEqual(h.triggered, ['r', 't']);
    } finally { h.cleanup(); }
});

test('shortcuts work when the owning Splunk dashboard panel has background focus', () => {
    const h = setup();
    try {
        h.focus(h.panel);
        assert.equal(h.press('r', [h.panel, h.body]), true);
        assert.equal(h.press('t', [h.panel, h.body]), true);
        h.press('g', [h.panel, h.body]); h.press('r', [h.panel, h.body]);
        assert.deepEqual(h.triggered, ['r', 't', 'g r']);
    } finally { h.cleanup(); }
});

test('owning-panel support does not claim sibling panels, controls or shadow editors', () => {
    const h = setup();
    try {
        const otherPanel = new Element();
        otherPanel.className = 'dashboard-panel';
        const externalControl = new Element('BUTTON');
        const editorHost = new Element('AI-ASSISTANT');
        for (const target of [otherPanel, externalControl, editorHost]) {
            h.focus(target);
            assert.equal(h.press('r', [target, h.panel, h.body]), false);
            assert.equal(h.press('t', [target, h.panel, h.body]), false);
        }
        h.focus(h.panel);
        assert.equal(h.press('r', [new Element('TEXTAREA'), h.panel]), false);
        assert.equal(h.press('t', [new Element('DIV', true), editorHost, h.panel], { target: editorHost }), false);
        h.focus(editorHost);
        assert.equal(h.press('r', [h.panel, h.body]), false);
        assert.deepEqual(h.triggered, []);
    } finally { h.cleanup(); }
});

test('typing in native, contenteditable, ARIA and shadow editors does not trigger shortcuts', () => {
    const h = setup();
    try {
        for (const editor of [new Element('INPUT'), new Element('TEXTAREA'),
            new Element('SELECT'), new Element('DIV', true), new Element('DIV', false, 'textbox')]) {
            assert.equal(h.press('r', [editor, h.scope]), false);
            assert.equal(h.press('t', [new Element('SPAN'), editor, new Element('AI-ASSISTANT'), h.scope]), false);
        }
        assert.deepEqual(h.triggered, []);
    } finally { h.cleanup(); }
});

test('claimed, composing, held and modified keys are ignored and reset go mode', () => {
    const h = setup();
    try {
        for (const flag of ['defaultPrevented', 'isComposing', 'repeat', 'metaKey', 'ctrlKey', 'altKey']) {
            h.press('g');
            assert.equal(h.press('r', [h.scope], { [flag]: true }), false);
            h.press('r');
        }
        assert.deepEqual(h.triggered, Array(6).fill('r'));
        h.press('g');
        h.press('t', [new Element('AI-ASSISTANT')]);
        h.press('r');
        assert.equal(h.triggered.at(-1), 'r');
    } finally { h.cleanup(); }
});

test('editable shadow paths are protected for callers without a scope', () => {
    const h = setup(false);
    try {
        const host = new Element('AI-ASSISTANT');
        assert.equal(h.press('r', [new Element('DIV', true), host], { target: host }), false);
        assert.deepEqual(h.triggered, []);
    } finally { h.cleanup(); }
});
