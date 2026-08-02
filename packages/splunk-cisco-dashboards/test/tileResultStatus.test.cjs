'use strict';

const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const sourcePath = path.resolve(
    __dirname,
    '../src/main/webapp/pages/searchbase_canvas/tileResultStatus.ts'
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
    isSearchFailureReason,
    tileResultFilterIsVisible,
    tileResultStatusForNoDataReason,
} = loadedModule.exports;

for (const reason of ['dispatch_failed', 'job_failed', 'error']) {
    assert.equal(isSearchFailureReason(reason), true);
    assert.equal(tileResultStatusForNoDataReason(reason), 'failed');
}

for (const reason of ['empty_rows', 'column_missing', 'no_numeric_column']) {
    assert.equal(isSearchFailureReason(reason), false);
    assert.equal(tileResultStatusForNoDataReason(reason), 'needs_attention');
}

assert.equal(tileResultFilterIsVisible('failed', 0), false);
assert.equal(tileResultFilterIsVisible('failed', 1), true);
assert.equal(tileResultFilterIsVisible('needs_attention', 0), true);
assert.equal(tileResultFilterIsVisible('working', 0), true);
assert.equal(tileResultFilterIsVisible('all', 0), true);

console.log('✓ tile result status tests passed');
