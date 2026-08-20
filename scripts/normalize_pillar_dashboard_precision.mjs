#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const REPOSITORY_ROOT = path.resolve(import.meta.dirname, '..');
const SPLUNK_DEFAULT_ROOT = path.join(
    REPOSITORY_ROOT,
    'packages/splunk-cisco-dashboards/src/main/resources/splunk/default',
);
const NAV_PATH = path.join(SPLUNK_DEFAULT_ROOT, 'data/ui/nav/default.xml');
const VIEWS_ROOT = path.join(SPLUNK_DEFAULT_ROOT, 'data/ui/views');
const SEARCHBASE_PATH = path.join(SPLUNK_DEFAULT_ROOT, 'searchbase.conf');

const EXPECTED_DASHBOARD_COUNT = 17;
const EXPECTED_CHART_COUNT = 102;
const EXPECTED_STANZA_COUNT = 74;
const EXPECTED_CHRONOLOGICAL_STANZA_COUNT = 66;
const PRECISION = 2;
const ROUNDING_MARKER = '| fields - dashboard_precision_marker';
const RESULT_SHAPE_MARKER = '| fields - dashboard_result_shape_marker';
const LEGACY_ROUNDING_MARKERS = new Set([
    '| fields - __five_pillar_precision_marker',
]);
const DEFINITION_START = '<definition><![CDATA[';
const DEFINITION_END = ']]></definition>';

const STATIC_SUMMARY_STANZAS = new Set([
    'monitoring_sdwan_site_state_summary',
    'monitoring_sdwan_circuit_state_summary',
    'network_nvm_top_users_by_egress',
    'network_nvm_top_processes_by_flow_volume',
    'network_intelligence_blocked_vs_allowed',
    'security_microseg_tetration_alerts_by_severity_type',
    'security_isovalent_alerts_by_severity',
    'secure_networking_cloud_native_security_activity',
]);

function usage() {
    console.error('Usage: node scripts/normalize_pillar_dashboard_precision.mjs --check|--write');
    process.exitCode = 2;
}

function dashboardIdsFromNavigation(navXml) {
    const collections = [
        ...navXml.matchAll(/<collection label="([^"]+)"[^>]*>([\s\S]*?)<\/collection>/g),
    ].slice(0, 5);

    return collections.flatMap((collection) =>
        [...collection[2].matchAll(/dashboard_manager#\/([^"?]+)/g)].map(
            (match) => match[1],
        ),
    );
}

function parseDashboard(xml, filePath) {
    const start = xml.indexOf(DEFINITION_START);
    const end = xml.indexOf(DEFINITION_END, start + DEFINITION_START.length);
    if (start < 0 || end < 0) {
        throw new Error(`${filePath}: Dashboard Studio definition CDATA was not found`);
    }

    return JSON.parse(xml.slice(start + DEFINITION_START.length, end));
}

function resolveSearchbaseReference(definition, dataSourceId, label) {
    let dataSource = definition.dataSources?.[dataSourceId];
    if (dataSource?.type === 'ds.chain') {
        dataSource = definition.dataSources?.[dataSource.options?.extend];
    }

    const stanzaId = dataSource?.options?.ref;
    if (dataSource?.type !== 'ds.searchbase' || !stanzaId) {
        throw new Error(`${label}: Searchbase reference was not found`);
    }
    return stanzaId;
}

function seriesFields(expression) {
    if (typeof expression !== 'string') {
        return [];
    }
    return [...expression.matchAll(/seriesByName\("([^"]+)"\)/g)].map(
        (match) => match[1],
    );
}

function addFields(fieldMap, stanzaId, fields) {
    const stanzaFields = fieldMap.get(stanzaId) ?? new Set();
    for (const field of fields) {
        if (field !== '_time') {
            stanzaFields.add(field);
        }
    }
    fieldMap.set(stanzaId, stanzaFields);
}

function collectPrecisionContract() {
    const navXml = fs.readFileSync(NAV_PATH, 'utf8');
    const dashboardIds = dashboardIdsFromNavigation(navXml);
    if (dashboardIds.length !== EXPECTED_DASHBOARD_COUNT) {
        throw new Error(
            `Expected ${EXPECTED_DASHBOARD_COUNT} dashboards, found ${dashboardIds.length}`,
        );
    }

    const fieldMap = new Map();
    let chartCount = 0;

    for (const dashboardId of dashboardIds) {
        const filePath = path.join(VIEWS_ROOT, `${dashboardId}.xml`);
        const definition = parseDashboard(fs.readFileSync(filePath, 'utf8'), filePath);

        for (const [visualizationId, visualization] of Object.entries(
            definition.visualizations ?? {},
        )) {
            const label = `${dashboardId}.${visualizationId}`;
            const type = visualization.type;
            const isCartesian = ['splunk.area', 'splunk.bar', 'splunk.column'].includes(type);
            const isPie = type === 'splunk.pie';
            const isSingleValue = type === 'splunk.singlevalue';

            if (!isCartesian && !isPie && !isSingleValue) {
                continue;
            }

            const stanzaId = resolveSearchbaseReference(
                definition,
                visualization.dataSources?.primary,
                label,
            );

            if (isSingleValue) {
                addFields(fieldMap, stanzaId, [
                    ...seriesFields(visualization.options?.majorValue),
                    ...seriesFields(visualization.options?.sparklineValues),
                ]);
                continue;
            }

            chartCount += 1;
            const numericExpression = isPie
                ? visualization.options?.value
                : visualization.options?.y;
            const numericFields = seriesFields(numericExpression);
            if (numericFields.length !== 1) {
                throw new Error(
                    `${label}: expected one explicit numeric series selector, found ${numericFields.length}`,
                );
            }
            addFields(fieldMap, stanzaId, numericFields);
        }
    }

    if (chartCount !== EXPECTED_CHART_COUNT) {
        throw new Error(`Expected ${EXPECTED_CHART_COUNT} charts, found ${chartCount}`);
    }
    if (fieldMap.size !== EXPECTED_STANZA_COUNT) {
        throw new Error(
            `Expected ${EXPECTED_STANZA_COUNT} Searchbase stanzas, found ${fieldMap.size}`,
        );
    }

    const chronologicalStanzaCount = [...fieldMap.keys()].filter(
        (stanzaId) => !STATIC_SUMMARY_STANZAS.has(stanzaId),
    ).length;
    if (chronologicalStanzaCount !== EXPECTED_CHRONOLOGICAL_STANZA_COUNT) {
        throw new Error(
            `Expected ${EXPECTED_CHRONOLOGICAL_STANZA_COUNT} chronological Searchbase stanzas, found ${chronologicalStanzaCount}`,
        );
    }

    for (const [stanzaId, fields] of fieldMap) {
        if (fields.size === 0) {
            throw new Error(`${stanzaId}: no numeric fields were resolved`);
        }
    }

    return { dashboardIds, chartCount, fieldMap, chronologicalStanzaCount };
}

function stanzaRanges(searchbase) {
    const matches = [...searchbase.matchAll(/^\[([^\]]+)\]$/gm)];
    return new Map(
        matches.map((match, index) => [
            match[1],
            {
                start: match.index,
                end: matches[index + 1]?.index ?? searchbase.length,
            },
        ]),
    );
}

function searchLineRange(stanza, stanzaId) {
    const searchMatch = /^search = .*$/m.exec(stanza);
    if (!searchMatch) {
        throw new Error(`${stanzaId}: search property was not found`);
    }

    let lineStart = searchMatch.index;
    let lineEnd = stanza.indexOf('\n', lineStart);
    if (lineEnd < 0) {
        lineEnd = stanza.length;
    }

    while (stanza.slice(lineStart, lineEnd).endsWith('\\')) {
        lineStart = lineEnd + 1;
        lineEnd = stanza.indexOf('\n', lineStart);
        if (lineEnd < 0) {
            lineEnd = stanza.length;
        }
    }

    return { start: lineStart, end: lineEnd };
}

function quoteResultField(field) {
    return JSON.stringify(field);
}

function quoteEvalField(field) {
    return `'${field.replaceAll("'", "\\'")}'`;
}

function sortedFields(fields) {
    return [...fields].sort((left, right) => left.localeCompare(right));
}

function roundingBlock(fields, stanzaId) {
    const fieldsInOrder = sortedFields(fields);
    const assignments = fieldsInOrder
        .map((field) => {
            const resultField = quoteResultField(field);
            const evalField = quoteEvalField(field);
            return `${resultField}=if(isnum(${evalField}) AND ${evalField}!=round(${evalField},0),round(${evalField},${PRECISION}),${evalField})`;
        });
    const rounding = `| eval ${assignments.join(', ')}\\\n${ROUNDING_MARKER}`;
    if (STATIC_SUMMARY_STANZAS.has(stanzaId)) {
        return rounding;
    }

    const populatedFields = fieldsInOrder
        .map((field) => `isnotnull(${quoteEvalField(field)})`)
        .join(' AND ');
    const fallbackAssignments = fieldsInOrder
        .map((field) => `${quoteResultField(field)}=0`)
        .join(', ');
    const fallbackFields = fieldsInOrder.map(quoteResultField).join(' ');

    return (
        `${RESULT_SHAPE_MARKER}\\\n` +
        `| where ${populatedFields}\\\n` +
        '| appendpipe [ stats count as dashboard_shape_count | where dashboard_shape_count=0 ' +
        `| eval _time=now(), ${fallbackAssignments} | fields _time ${fallbackFields} ]\\\n` +
        rounding
    );
}

function normalizeSearchbase(searchbase, fieldMap, write) {
    let output = searchbase;
    let changes = 0;
    const ranges = stanzaRanges(searchbase);
    const edits = [];

    for (const [stanzaId, fields] of fieldMap) {
        const range = ranges.get(stanzaId);
        if (!range) {
            throw new Error(`${stanzaId}: Searchbase stanza was not found`);
        }

        const stanza = searchbase.slice(range.start, range.end);
        const lineRange = searchLineRange(stanza, stanzaId);
        const currentLine = stanza.slice(lineRange.start, lineRange.end);
        const expectedBlock = roundingBlock(fields, stanzaId);

        let editStart = lineRange.start;
        let replacement;
        if (currentLine === ROUNDING_MARKER || LEGACY_ROUNDING_MARKERS.has(currentLine)) {
            const resultShapeMarkerStart = stanza.lastIndexOf(
                `${RESULT_SHAPE_MARKER}\\\n`,
                lineRange.start,
            );
            const previousLineEnd = lineRange.start - 1;
            const previousLineStart = stanza.lastIndexOf('\n', previousLineEnd - 1) + 1;
            const currentBlockStart =
                resultShapeMarkerStart >= 0 ? resultShapeMarkerStart : previousLineStart;
            const currentBlock = stanza.slice(currentBlockStart, lineRange.end);
            if (currentBlock === expectedBlock) {
                continue;
            }
            editStart = currentBlockStart;
            replacement = expectedBlock;
        } else if (
            currentLine.endsWith(ROUNDING_MARKER) ||
            [...LEGACY_ROUNDING_MARKERS].some((marker) => currentLine.endsWith(marker))
        ) {
            replacement = expectedBlock;
        } else {
            replacement = `${currentLine}\\\n${expectedBlock}`;
        }
        edits.push({
            start: range.start + editStart,
            end: range.start + lineRange.end,
            replacement,
            stanzaId,
        });
        changes += 1;
    }

    if (!write && changes > 0) {
        const examples = edits.slice(0, 5).map((edit) => edit.stanzaId).join(', ');
        throw new Error(
            `${changes} Searchbase stanzas need precision normalization (for example: ${examples})`,
        );
    }

    for (const edit of edits.sort((left, right) => right.start - left.start)) {
        output = output.slice(0, edit.start) + edit.replacement + output.slice(edit.end);
    }

    return { output, changes };
}

function main() {
    const mode = process.argv[2];
    if (!['--check', '--write'].includes(mode) || process.argv.length !== 3) {
        usage();
        return;
    }

    const { dashboardIds, chartCount, fieldMap, chronologicalStanzaCount } =
        collectPrecisionContract();
    const searchbase = fs.readFileSync(SEARCHBASE_PATH, 'utf8');
    const { output, changes } = normalizeSearchbase(searchbase, fieldMap, mode === '--write');

    if (mode === '--write' && output !== searchbase) {
        fs.writeFileSync(SEARCHBASE_PATH, output);
    }

    console.log(
        `${mode === '--write' ? 'Normalized' : 'Validated'} ${dashboardIds.length} dashboards, ${chartCount} charts, and ${fieldMap.size} Searchbase stanzas (${changes} change${changes === 1 ? '' : 's'}).`,
    );
    console.log(
        `Validated non-null result-shape guards for ${chronologicalStanzaCount} chronological stanzas.`,
    );
}

try {
    main();
} catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
}
