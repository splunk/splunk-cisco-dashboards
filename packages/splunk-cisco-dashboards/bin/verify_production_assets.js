#!/usr/bin/env node
/* eslint-disable no-console */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');

const APP_ROOT = path.resolve(__dirname, '..');
const STAGE_DIR = process.argv[2]
    ? path.resolve(process.cwd(), process.argv[2])
    : path.join(APP_ROOT, 'stage');
const PAGES_DIR = path.join(STAGE_DIR, 'appserver', 'static', 'pages');
const APACHE_LICENSE_SHA256 =
    'cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30';

const ENTRY_NAMES = [
    'executive_insights',
    'health_monitoring',
    'topology_canvas_v1',
    'network_diagram',
    'searchbase_canvas',
    'm365_activity_monitoring',
    'macro_index_tuning',
    'user_guide',
    'secure_operations_glass',
    'secure_networking_pillars',
    'dashboardbuilder',
];

const FORBIDDEN_SOURCE_EXTENSIONS = new Set(['.jsx', '.ts', '.tsx', '.map']);
const DEVELOPMENT_REACT_MARKERS = [
    'This page is using the development build of React',
    'react.development.js',
    'react-dom.development.js',
    'jsxDEV(',
];

function walkFiles(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const entryPath = path.join(directory, entry.name);
        return entry.isDirectory() ? walkFiles(entryPath) : [entryPath];
    });
}

function fail(message, details = []) {
    console.error(`✗ ${message}`);
    details.forEach((detail) => console.error(`  - ${detail}`));
    process.exit(1);
}

if (!fs.existsSync(STAGE_DIR) || !fs.existsSync(PAGES_DIR)) {
    fail('Production stage is missing; run the webpack build first.');
}

const stagedFiles = walkFiles(STAGE_DIR);
const licensePath = path.join(STAGE_DIR, 'LICENSE');
const noticePath = path.join(STAGE_DIR, 'NOTICE');

if (
    !fs.existsSync(licensePath) ||
    !fs.statSync(licensePath).isFile() ||
    !fs.existsSync(noticePath) ||
    !fs.statSync(noticePath).isFile()
) {
    fail('Production stage must contain top-level LICENSE and NOTICE files.');
}

const licenseDigest = crypto
    .createHash('sha256')
    .update(fs.readFileSync(licensePath))
    .digest('hex');
if (licenseDigest !== APACHE_LICENSE_SHA256) {
    fail('Production LICENSE is not the canonical Apache License 2.0 text.');
}

const notice = fs.readFileSync(noticePath, 'utf8');
if (!notice.includes('Copyright 2026 Splunk Inc.')) {
    fail('Production NOTICE is missing the Splunk Inc. copyright notice.');
}

const leakedSourceFiles = stagedFiles.filter((filePath) =>
    FORBIDDEN_SOURCE_EXTENSIONS.has(path.extname(filePath).toLowerCase())
);

if (leakedSourceFiles.length > 0) {
    fail(
        'Production stage contains source files or source maps.',
        leakedSourceFiles.map((filePath) => path.relative(STAGE_DIR, filePath))
    );
}

const missingEntries = [];
const developmentEntries = [];
const invalidEntries = [];

ENTRY_NAMES.forEach((entryName) => {
    const bundlePath = path.join(PAGES_DIR, `${entryName}.js`);
    if (!fs.existsSync(bundlePath) || fs.statSync(bundlePath).size === 0) {
        missingEntries.push(`${entryName}.js`);
        return;
    }

    const bundle = fs.readFileSync(bundlePath, 'utf8');
    const matchedMarker = DEVELOPMENT_REACT_MARKERS.find((marker) =>
        bundle.includes(marker)
    );
    if (matchedMarker) {
        developmentEntries.push(`${entryName}.js (${matchedMarker})`);
    }

    try {
        new vm.Script(bundle, { filename: bundlePath });
    } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        invalidEntries.push(`${entryName}.js (${detail})`);
    }
});

if (missingEntries.length > 0) {
    fail('Production entry bundles are missing or empty.', missingEntries);
}

if (developmentEntries.length > 0) {
    fail('Development React code was found in production bundles.', developmentEntries);
}

if (invalidEntries.length > 0) {
    fail('Production entry bundles contain invalid or truncated JavaScript.', invalidEntries);
}

console.log(
    `✓ Verified ${ENTRY_NAMES.length} production bundles: valid compiled JavaScript only, no source maps`
);
