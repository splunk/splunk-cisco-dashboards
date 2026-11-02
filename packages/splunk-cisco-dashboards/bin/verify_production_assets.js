#!/usr/bin/env node
/* eslint-disable no-console */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');
const { readManifest } = require('./apply_build_profile.js');

const APP_ROOT = path.resolve(__dirname, '..');
const STAGE_DIR = process.argv[2]
    ? path.resolve(process.cwd(), process.argv[2])
    : path.join(APP_ROOT, 'stage');
const APP_PROFILE = process.argv[3] || 'developer';
const PAGES_DIR = path.join(STAGE_DIR, 'appserver', 'static', 'pages');
const APACHE_LICENSE_SHA256 =
    'cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30';

const ENTRY_NAMES = [
    'executive_insights',
    'workspace_insights',
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
const ALLOWED_PROFILES = new Set(['developer', 'splunkbase', 'preview']);

function entryNamesFrom(staticAssets) {
    return new Set(
        staticAssets.flatMap((assetPath) => {
            const match = assetPath.match(
                /^appserver\/static\/pages\/([^/]+)\.js$/
            );
            return match ? [match[1]] : [];
        })
    );
}

const MANIFEST = readManifest();
const DEVELOPING_ENTRY_NAMES = entryNamesFrom(MANIFEST.developing.staticAssets);
const PREVIEW_RETAINED_ENTRY_NAMES = entryNamesFrom(
    MANIFEST.previewRetained.staticAssets
);

// Which bundles the profile drops, and therefore which ones must be present
// and which must be absent. A preview keeps whatever the manifest retains.
const EXCLUDED_ENTRY_NAMES = new Set(
    APP_PROFILE === 'developer'
        ? []
        : [...DEVELOPING_ENTRY_NAMES].filter(
              (entryName) =>
                  APP_PROFILE !== 'preview' ||
                  !PREVIEW_RETAINED_ENTRY_NAMES.has(entryName)
          )
);
const REQUIRED_ENTRY_NAMES = ENTRY_NAMES.filter(
    (entryName) => !EXCLUDED_ENTRY_NAMES.has(entryName)
);

const FORBIDDEN_SOURCE_EXTENSIONS = new Set(['.jsx', '.ts', '.tsx', '.map']);
const FORBIDDEN_RUNTIME_FILE_EXTENSIONS = new Set(['.pyc', '.pyo']);
const DEVELOPMENT_REACT_MARKERS = [
    'This page is using the development build of React',
    'react.development.js',
    'react-dom.development.js',
    'jsxDEV(',
];
const SOURCE_MAP_DIRECTIVE_PATTERN = /^[ \t]*(?:\/\/|\/\*)[#@]\s*sourceMappingURL\s*=/m;

function walkFiles(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const entryPath = path.join(directory, entry.name);
        return entry.isDirectory() ? walkFiles(entryPath) : [entryPath];
    });
}

function findDirectoriesNamed(directory, name) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        if (!entry.isDirectory()) return [];
        const entryPath = path.join(directory, entry.name);
        return [
            ...(entry.name === name ? [entryPath] : []),
            ...findDirectoriesNamed(entryPath, name),
        ];
    });
}

function fail(message, details = []) {
    console.error(`✗ ${message}`);
    details.forEach((detail) => console.error(`  - ${detail}`));
    process.exit(1);
}

if (!ALLOWED_PROFILES.has(APP_PROFILE)) {
    fail(
        `Unknown app profile "${APP_PROFILE}"; expected developer, splunkbase, or preview.`
    );
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
const leakedPythonRuntimeArtifacts = stagedFiles.filter((filePath) => {
    const relativeParts = path.relative(STAGE_DIR, filePath).split(path.sep);
    return (
        FORBIDDEN_RUNTIME_FILE_EXTENSIONS.has(
            path.extname(filePath).toLowerCase()
        ) || relativeParts.includes('__pycache__')
    );
});
const leakedPythonCacheDirectories = findDirectoriesNamed(
    STAGE_DIR,
    '__pycache__'
);

if (leakedSourceFiles.length > 0) {
    fail(
        'Production stage contains source files or source maps.',
        leakedSourceFiles.map((filePath) => path.relative(STAGE_DIR, filePath))
    );
}

if (
    leakedPythonRuntimeArtifacts.length > 0 ||
    leakedPythonCacheDirectories.length > 0
) {
    fail(
        'Production stage contains Python bytecode or cache files.',
        [
            ...leakedPythonRuntimeArtifacts,
            ...leakedPythonCacheDirectories,
        ].map((filePath) => path.relative(STAGE_DIR, filePath))
    );
}

const missingEntries = [];
const developmentEntries = [];
const invalidEntries = [];
const sourceMapDirectiveEntries = [];

REQUIRED_ENTRY_NAMES.forEach((entryName) => {
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
    if (SOURCE_MAP_DIRECTIVE_PATTERN.test(bundle)) {
        sourceMapDirectiveEntries.push(`${entryName}.js`);
    }

    try {
        new vm.Script(bundle, { filename: bundlePath });
    } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        invalidEntries.push(`${entryName}.js (${detail})`);
    }
});

const leakedDevelopingEntries = [...EXCLUDED_ENTRY_NAMES]
    .filter((entryName) => fs.existsSync(path.join(PAGES_DIR, `${entryName}.js`)))
    .map((entryName) => `${entryName}.js`);

if (leakedDevelopingEntries.length > 0) {
    fail(
        `${APP_PROFILE} stage contains excluded entry bundles.`,
        leakedDevelopingEntries
    );
}

if (missingEntries.length > 0) {
    fail('Production entry bundles are missing or empty.', missingEntries);
}

if (developmentEntries.length > 0) {
    fail('Development React code was found in production bundles.', developmentEntries);
}

if (sourceMapDirectiveEntries.length > 0) {
    fail('Production entry bundles contain source-map directives.', sourceMapDirectiveEntries);
}

if (invalidEntries.length > 0) {
    fail('Production entry bundles contain invalid or truncated JavaScript.', invalidEntries);
}

console.log(
    `✓ Verified ${REQUIRED_ENTRY_NAMES.length} ${APP_PROFILE} production bundles: valid compiled JavaScript only, no source maps`
);
