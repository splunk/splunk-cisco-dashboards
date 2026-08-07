#!/usr/bin/env node
/* eslint-disable no-console */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PAGES = path.join(ROOT, 'stage', 'appserver', 'static', 'pages');
const MEBIBYTE = 1024 * 1024;
const enforce = process.argv.includes('--enforce');

const entryBudgetsMiB = {
    dashboardbuilder: 42,
    executive_insights: 16,
    searchbase_canvas: 16,
};

const formatMiB = (bytes) => `${(bytes / MEBIBYTE).toFixed(2)} MiB`;
const budgetFor = (name) => {
    // Optional Dashboard Studio visualizations pull their charting runtime
    // into an async chunk. The initial page no longer pays this cost; cap the
    // deferred payload separately so a future upgrade cannot grow unnoticed.
    if (/^\d+\./.test(name)) return 10;
    return entryBudgetsMiB[name.replace(/\.js$/, '')] ?? 6;
};

if (!fs.existsSync(PAGES)) {
    console.error(`Bundle directory is missing: ${PAGES}`);
    console.error('Run yarn start or yarn build first.');
    process.exit(1);
}

const rows = fs
    .readdirSync(PAGES)
    .filter((name) => name.endsWith('.js'))
    .map((name) => {
        const bytes = fs.statSync(path.join(PAGES, name)).size;
        const budgetMiB = budgetFor(name);
        return {
            name,
            bytes,
            budgetMiB,
            over: bytes > budgetMiB * MEBIBYTE,
        };
    })
    .sort((a, b) => b.bytes - a.bytes);

console.log('Unminified Splunk page bundle report');
console.log('Asset'.padEnd(42), 'Size'.padStart(11), 'Budget'.padStart(10), 'Status'.padStart(8));
for (const row of rows) {
    console.log(
        row.name.padEnd(42),
        formatMiB(row.bytes).padStart(11),
        `${row.budgetMiB} MiB`.padStart(10),
        (row.over ? 'OVER' : 'ok').padStart(8)
    );
}

const total = rows.reduce((sum, row) => sum + row.bytes, 0);
const overBudget = rows.filter((row) => row.over);
console.log(`Total JavaScript: ${formatMiB(total)}`);
console.log(
    overBudget.length === 0
        ? 'All measured unminified bundles are within their regression budgets.'
        : `${overBudget.length} bundle(s) exceed their regression budget.`
);

if (enforce && overBudget.length > 0) process.exit(1);
