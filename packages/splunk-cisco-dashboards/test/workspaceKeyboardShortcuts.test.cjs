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
    }
    getAttribute(name) { return name === 'role' ? this.role : null; }
}

const setup = (scoped = true) => {
    let listener;
    let cleanup;
    const scope = new Element();
    const body = new Element('BODY');
    const root = new Element('HTML');
    const triggered = [];
    const module = { exports: {} };
    vm.runInNewContext(`(function(require,module,exports){${compiled}\n})`, {
        HTMLElement: Element,
        document: {
            body, documentElement: root, activeElement: body,
            addEventListener: (_type, handler) => { listener = handler; },
            removeEventListener: () => { listener = null; },
        },
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
    return { scope, body, triggered, press, cleanup: () => cleanup() };
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
