'use strict';

const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const sourcePath = path.resolve(
    __dirname,
    '../src/main/webapp/common/services/searchbaseDispatch.ts'
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
new Function('exports', 'module', 'require', output)(
    loadedModule.exports,
    loadedModule,
    require
);

const { resolveSearchbaseAppContexts } = loadedModule.exports;

assert.deepEqual(
    resolveSearchbaseAppContexts(
        'splunk-cisco-dashboards',
        'cisco_dc_networking_app_for_splunk',
        false
    ),
    {
        ownerApp: 'splunk-cisco-dashboards',
        catalogueApp: 'cisco_dc_networking_app_for_splunk',
        dispatchContextForce: false,
        dispatchContext: 'splunk-cisco-dashboards',
    }
);

assert.deepEqual(
    resolveSearchbaseAppContexts(
        'splunk-cisco-dashboards',
        'cisco-catalyst-app',
        true
    ),
    {
        ownerApp: 'splunk-cisco-dashboards',
        catalogueApp: 'cisco-catalyst-app',
        dispatchContextForce: true,
        dispatchContext: 'cisco-catalyst-app',
    }
);

assert.deepEqual(
    resolveSearchbaseAppContexts('splunk-cisco-dashboards', undefined, false),
    {
        ownerApp: 'splunk-cisco-dashboards',
        catalogueApp: 'splunk-cisco-dashboards',
        dispatchContextForce: false,
        dispatchContext: 'splunk-cisco-dashboards',
    }
);

console.log('3/3 searchbase dispatch-context tests passed');
