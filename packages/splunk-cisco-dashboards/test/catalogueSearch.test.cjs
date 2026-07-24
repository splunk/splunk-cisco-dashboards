'use strict';

const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const matcherPath = path.resolve(
    __dirname,
    '../src/main/webapp/pages/searchbase_canvas/catalogueSearch.ts'
);
const matcherSource = fs.readFileSync(matcherPath, 'utf8');
const matcherOutput = ts.transpileModule(matcherSource, {
    compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
    },
    fileName: matcherPath,
}).outputText;
const matcherModule = { exports: {} };
const loadMatcher = new Function(
    'exports',
    'module',
    'require',
    '__filename',
    '__dirname',
    matcherOutput
);
loadMatcher(
    matcherModule.exports,
    matcherModule,
    require,
    matcherPath,
    path.dirname(matcherPath)
);

const { recordMatchesCatalogueQuery } = matcherModule.exports;

const fixture = (searchName, values = {}) => ({
    id: searchName.toLowerCase().replace(/\W+/g, '_'),
    searchName,
    description: '',
    search: '',
    ...values,
});

const tests = [];
const test = (name, run) => {
    tests.push({ name, run });
};

test('radius matches the same three catalogue records as Searchbase Fast filter', () => {
    const records = [
        fixture('Executive - Wifi Clients', {
            solution: 'A steep fall may indicate WLAN or RADIUS outages.',
        }),
        fixture('Feed Monitor - ISE - RADIUS Syslog Staleness'),
        fixture('IT - Critical Systems - Issue Trend by Category', {
            search: '| eval issue_group=case(match(IssueName,"AAA"),"AAA/RADIUS")',
        }),
        fixture('IT - Critical Systems - Power Outage Trend', {
            relatedInfo: 'Captures worst-case blast radius per day.',
        }),
        fixture('IT - Critical Systems - STP Reconvergence', {
            relatedInfo: 'Approximates blast radius inside the L2 domain.',
        }),
        fixture('Secure Networking - Infrastructure ISE Network Device Count', {
            explanation: 'Network devices actively sending RADIUS requests.',
        }),
        fixture('Security Resilience - ISE RADIUS Request Latency'),
    ];

    const matches = records
        .filter((record) => recordMatchesCatalogueQuery(record, 'radius'))
        .map((record) => record.searchName);

    assert.deepEqual(matches, [
        'Feed Monitor - ISE - RADIUS Syslog Staleness',
        'IT - Critical Systems - Issue Trend by Category',
        'Security Resilience - ISE RADIUS Request Latency',
    ]);
});

test('searches only stanza, friendly name, description, and SPL', () => {
    const record = fixture('Unrelated search', {
        explanation: 'radius',
        solution: 'radius',
        relatedInfo: 'radius',
        tags: ['radius'],
        vizOptions: { label: 'radius' },
    });

    assert.equal(recordMatchesCatalogueQuery(record, 'radius'), false);
});

test('single words and quoted phrases use case-insensitive substring matching', () => {
    const record = fixture('Daily Active Users');

    assert.equal(recordMatchesCatalogueQuery(record, 'active'), true);
    assert.equal(recordMatchesCatalogueQuery(record, '"active users"'), true);
    assert.equal(recordMatchesCatalogueQuery(record, '"daily users"'), false);
});

test('ordinary multi-word queries match complete words within one field', () => {
    const record = fixture('Daily Active User Report');

    assert.equal(recordMatchesCatalogueQuery(record, 'active daily'), true);
    assert.equal(recordMatchesCatalogueQuery(record, 'active device'), false);

    const splitAcrossFields = fixture('Daily report', {
        description: 'Active users',
    });
    assert.equal(
        recordMatchesCatalogueQuery(splitAcrossFields, 'daily active'),
        false
    );
});

test('long ordinary queries need four matching words, following Searchbase', () => {
    const record = fixture('Daily Active Users by Business Unit');

    assert.equal(
        recordMatchesCatalogueQuery(
            record,
            'daily active users business missing another'
        ),
        true
    );
    assert.equal(
        recordMatchesCatalogueQuery(
            record,
            'daily active users missing another absent'
        ),
        false
    );
});

test('SPL-shaped queries require a contiguous substring', () => {
    const record = fixture('Authentication search', {
        search: '| stats count by user_name | where count >= 5',
    });

    assert.equal(recordMatchesCatalogueQuery(record, 'user_name'), true);
    assert.equal(recordMatchesCatalogueQuery(record, 'count >= 5'), true);
    assert.equal(recordMatchesCatalogueQuery(record, 'count user_name'), false);
});

let failed = 0;
for (const { name, run } of tests) {
    try {
        run();
        console.log(`✓ ${name}`);
    } catch (error) {
        failed += 1;
        console.error(`✗ ${name}`);
        console.error(error);
    }
}

console.log(`${tests.length - failed}/${tests.length} tests passed`);
if (failed > 0) {
    process.exitCode = 1;
}
