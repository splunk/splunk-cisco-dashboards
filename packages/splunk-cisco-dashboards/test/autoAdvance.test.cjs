'use strict';

const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const sourcePath = path.resolve(
    __dirname,
    '../src/main/webapp/pages/searchbase_canvas/autoAdvance.ts'
);
const source = fs.readFileSync(sourcePath, 'utf8');
const output = ts.transpileModule(source, {
    compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
    },
    fileName: sourcePath,
}).outputText;
const loadedModule = { exports: {} };
const loadSource = new Function(
    'exports',
    'module',
    'require',
    '__filename',
    '__dirname',
    output
);
loadSource(
    loadedModule.exports,
    loadedModule,
    require,
    sourcePath,
    path.dirname(sourcePath)
);

const {
    buildAutoAdvancePlan,
    settleAutoAdvanceTile,
} = loadedModule.exports;

const plan = buildAutoAdvancePlan(
    ['tile-1', 'tile-2', 'tile-3', 'tile-4', 'tile-5'],
    new Set(['tile-1', 'tile-3', 'tile-4', 'tile-5']),
    2
);

assert.deepEqual(plan, {
    pages: [['tile-1'], ['tile-3', 'tile-4'], ['tile-5']],
    totalSearches: 4,
});

assert.deepEqual(
    buildAutoAdvancePlan(
        ['missing-1', 'missing-2', 'tile-3'],
        new Set(['tile-3']),
        2
    ),
    { pages: [[], ['tile-3']], totalSearches: 1 },
    'empty visual pages are preserved so the controller can advance past them'
);

assert.deepEqual(
    buildAutoAdvancePlan([], new Set(), 0),
    { pages: [[]], totalSearches: 0 },
    'an empty canvas still has one stable visual page'
);

assert.deepEqual(
    settleAutoAdvanceTile(['tile-1', 'tile-2'], 'tile-1'),
    ['tile-2']
);
assert.deepEqual(
    settleAutoAdvanceTile(['tile-2'], 'already-settled'),
    ['tile-2'],
    'duplicate or stale completion callbacks are ignored'
);

console.log('✓ auto-advance planning tests passed');
