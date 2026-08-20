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
const EXPECTED_CARD_COUNT = 102;
const EXPECTED_TREND_CARD_COUNT = 92;
const EXPECTED_STATIC_CARD_COUNT = 10;
const EXPECTED_ABBREVIATED_CARD_COUNT = 96;

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

const FIELD_FALLBACKS = new Map([
    [
        'secure_networking_sdwan_reporting_sites_trend',
        { valueField: 'total_sites', sparkDataField: 'reporting_sites' },
    ],
    [
        'secure_networking_infra_fmc_firewall_count',
        { valueField: 'firewall_count', sparkDataField: 'firewall_count' },
    ],
    ['overview_ap_health', { valueField: 'pct', sparkDataField: 'pct' }],
]);

const LATEST_BUCKET_HEADLINE_STANZAS = new Set([
    'secure_networking_zta_xdr_risk_pressure_trend',
    'security_resilience_sdwan_utd_ips_trend_by_priority',
]);

const DEFAULT_TREND_CONTEXT = [
    { value: '#049fd9', to: 0 },
    { value: '#049fd9', from: 0 },
];

const MANAGER_ONLY_TYPE_MARKERS = [
    '"type": "ds.searchbase"',
    '"type": "input.simpleTimePicker"',
    '"type": "splunk.template_kpi"',
    '"type": "splunk.template_other"',
    '"type": "splunk.cisco_spaces_space_manager"',
];

// Single Value uses a strict `>` comparison at K/M/B/T boundaries. Dividing the
// display-only major value by a number infinitesimally below 1 crosses an exact
// boundary without changing the rendered precision or the numeric trend series.
const ABBREVIATION_BOUNDARY_FORMATTER = ' | divideBy(0.999999999999)';

const DEFINITION_PATTERN = /(<definition><!\[CDATA\[\n)([\s\S]*?)(\n    \]\]><\/definition>)/;

function usage() {
    console.error('Usage: node scripts/normalize_pillar_dashboard_trends.mjs --check|--write');
    process.exitCode = 2;
}

function dashboardIdsFromNavigation(navXml) {
    const collections = [
        ...navXml.matchAll(/<collection label="([^"]+)"[^>]*>([\s\S]*?)<\/collection>/g),
    ].slice(0, 5);

    return collections.flatMap((collection) =>
        [...collection[2].matchAll(/dashboard_manager#\/([^"?]+)/g)].map((match) => ({
            pillar: collection[1],
            id: match[1],
        })),
    );
}

function validateManagerOnlyDashboardVisibility(navXml) {
    const managerOnlyDashboardIds = fs
        .readdirSync(VIEWS_ROOT)
        .filter((fileName) => fileName.endsWith('.xml'))
        .flatMap((fileName) => {
            const filePath = path.join(VIEWS_ROOT, fileName);
            const xml = fs.readFileSync(filePath, 'utf8');
            if (!MANAGER_ONLY_TYPE_MARKERS.some((marker) => xml.includes(marker))) {
                return [];
            }

            const dashboardId = path.basename(fileName, '.xml');
            const root = xml.match(/^<dashboard\b[^>]*>/)?.[0] ?? '';
            if (!/\bisVisible="false"/.test(root)) {
                throw new Error(
                    `${dashboardId}: manager-only dashboard must be hidden from the native catalogue`,
                );
            }
            if (!navXml.includes(`href="dashboard_manager#/${dashboardId}"`)) {
                throw new Error(
                    `${dashboardId}: manager-only dashboard must remain routed through Dashboard Manager`,
                );
            }
            return [dashboardId];
        });

    if (managerOnlyDashboardIds.length !== EXPECTED_DASHBOARD_COUNT) {
        throw new Error(
            `Expected ${EXPECTED_DASHBOARD_COUNT} manager-only dashboards, found ${managerOnlyDashboardIds.length}`,
        );
    }
    return managerOnlyDashboardIds.length;
}

function parseDashboard(xml, filePath) {
    const match = xml.match(DEFINITION_PATTERN);
    if (!match) {
        throw new Error(`${filePath}: Dashboard Studio definition CDATA was not found`);
    }

    return { match, definition: JSON.parse(match[2]) };
}

function searchbaseStanza(searchbase, stanzaId) {
    const marker = `[${stanzaId}]\n`;
    const start = searchbase.indexOf(marker);
    if (start < 0) {
        throw new Error(`Searchbase stanza not found: ${stanzaId}`);
    }

    const remainder = searchbase.slice(start + 1);
    const nextStanza = remainder.search(/\n\[[^\n]+\]\n/);
    return searchbase.slice(start, nextStanza < 0 ? searchbase.length : start + 1 + nextStanza);
}

function searchbaseOverview(stanza) {
    const line = stanza.split('\n').find((entry) => entry.startsWith('viz_options = '));
    if (!line) {
        return {};
    }

    const options = JSON.parse(line.slice('viz_options = '.length));
    return options.overview?.[0] ?? {};
}

function resolveFields(stanzaId, stanza) {
    const overview = searchbaseOverview(stanza);
    const fallback = FIELD_FALLBACKS.get(stanzaId) ?? {};
    const valueField = overview.valueField ?? fallback.valueField;
    const sparkDataField = overview.sparkDataField ?? fallback.sparkDataField;

    if (!valueField) {
        throw new Error(`${stanzaId}: no selected-window valueField is defined`);
    }
    if (!stanza.includes(valueField)) {
        throw new Error(`${stanzaId}: valueField ${valueField} is absent from the stanza`);
    }

    if (!STATIC_SUMMARY_STANZAS.has(stanzaId)) {
        if (!sparkDataField) {
            throw new Error(`${stanzaId}: no chronological sparkDataField is defined`);
        }
        if (!stanza.includes(sparkDataField)) {
            throw new Error(`${stanzaId}: sparkDataField ${sparkDataField} is absent from the stanza`);
        }
    }

    return { valueField, sparkDataField };
}

function resolveSearchbaseSource(definition, primaryDataSourceId, label) {
    const primaryDataSource = definition.dataSources?.[primaryDataSourceId];
    if (!primaryDataSource) {
        throw new Error(`${label}: primary data source ${primaryDataSourceId} was not found`);
    }

    const baseDataSourceId =
        primaryDataSource.type === 'ds.chain'
            ? primaryDataSource.options?.extend
            : primaryDataSourceId;
    const baseDataSource = definition.dataSources?.[baseDataSourceId];
    const stanzaId = baseDataSource?.options?.ref;
    if (baseDataSource?.type !== 'ds.searchbase' || !stanzaId) {
        throw new Error(`${label}: Searchbase reference was not found`);
    }

    return { baseDataSourceId, stanzaId };
}

function restoreSearchbaseDataSource(
    definition,
    visualization,
    baseDataSourceId,
    changes,
    label,
) {
    if (visualization.dataSources.primary !== baseDataSourceId) {
        visualization.dataSources.primary = baseDataSourceId;
        changes.push(`${label}.dataSources.primary`);
    }

    for (const suffix of ['window_value', 'trend_projection']) {
        const dataSourceId = `${baseDataSourceId}_${suffix}`;
        const dataSource = definition.dataSources?.[dataSourceId];
        if (dataSource?.type === 'ds.chain' && dataSource.options?.extend === baseDataSourceId) {
            delete definition.dataSources[dataSourceId];
            changes.push(`${label}.${dataSourceId}`);
        }
    }
}

function seriesField(expression) {
    return typeof expression === 'string'
        ? expression.match(/seriesByName\("([^"]+)"\)/)?.[1]
        : undefined;
}

function resolveStaticSparkDataField(definition, visualizationId, stanzaId) {
    const trendId = visualizationId.replace(/_singlevalue$/, '_trend');
    const options = definition.visualizations?.[trendId]?.options ?? {};
    const field = [options.y, options.value, options.x].map(seriesField).find(Boolean);
    if (!field) {
        throw new Error(`${stanzaId}: categorical chart field was not found in ${trendId}`);
    }
    return field;
}

function validateNoSearchbaseChains(definition, dashboardId) {
    for (const [dataSourceId, dataSource] of Object.entries(definition.dataSources ?? {})) {
        if (dataSource.type !== 'ds.chain') {
            continue;
        }
        const parentId = dataSource.options?.extend;
        if (definition.dataSources?.[parentId]?.type === 'ds.searchbase') {
            throw new Error(
                `${dashboardId}.${dataSourceId}: ds.searchbase cannot parent ds.chain`,
            );
        }
    }
}

function setOption(options, key, value, changes, label) {
    if (options[key] !== value) {
        options[key] = value;
        changes.push(`${label}.${key}`);
    }
}

function deleteOption(options, key, changes, label) {
    if (Object.hasOwn(options, key)) {
        delete options[key];
        changes.push(`${label}.${key}`);
    }
}

function normalizeMajorValue(visualization, baseExpression, changes, label) {
    const options = visualization.options ?? (visualization.options = {});
    if (visualization.context?.abbreviationBoundaryMatches) {
        delete visualization.context.abbreviationBoundaryMatches;
        changes.push(`${label}.context.abbreviationBoundaryMatches`);
        if (Object.keys(visualization.context).length === 0) {
            delete visualization.context;
        }
    }

    if (options.shouldAbbreviateMajorValue === false) {
        setOption(options, 'majorValue', baseExpression, changes, label);
        return;
    }

    setOption(
        options,
        'majorValue',
        `${baseExpression}${ABBREVIATION_BOUNDARY_FORMATTER}`,
        changes,
        label,
    );
}

function normalizeCard(visualization, stanzaId, fields, changes, label) {
    const options = visualization.options ?? (visualization.options = {});

    if (STATIC_SUMMARY_STANZAS.has(stanzaId)) {
        setOption(
            options,
            'sparklineValues',
            `> primary | seriesByName("${fields.sparkDataField}")`,
            changes,
            label,
        );
        normalizeMajorValue(
            visualization,
            '> sparklineValues | lastPoint()',
            changes,
            label,
        );
        setOption(options, 'trendDisplay', 'off', changes, label);
        setOption(options, 'showTrendIndicator', false, changes, label);
        deleteOption(options, 'shouldAbbreviateTrendValue', changes, label);
        deleteOption(options, 'trendColor', changes, label);
        deleteOption(options, 'trendFontSize', changes, label);
        deleteOption(options, 'trendValue', changes, label);

        if (visualization.context?.trendColorEditorConfig) {
            delete visualization.context.trendColorEditorConfig;
            changes.push(`${label}.context.trendColorEditorConfig`);
            if (Object.keys(visualization.context).length === 0) {
                delete visualization.context;
            }
        }
        return 'static';
    }

    setOption(
        options,
        'sparklineValues',
        `> primary | seriesByName("${fields.sparkDataField}")`,
        changes,
        label,
    );
    normalizeMajorValue(
        visualization,
        fields.valueField === fields.sparkDataField ||
            LATEST_BUCKET_HEADLINE_STANZAS.has(stanzaId)
            ? '> sparklineValues | lastPoint()'
            : `> primary | seriesByName("${fields.valueField}") | lastPoint()`,
        changes,
        label,
    );
    setOption(options, 'trendDisplay', 'absolute', changes, label);
    setOption(options, 'showTrendIndicator', true, changes, label);
    setOption(options, 'trendValue', '> sparklineValues | delta(-2)', changes, label);

    if (options.shouldAbbreviateTrendValue === undefined) {
        options.shouldAbbreviateTrendValue = options.shouldAbbreviateMajorValue !== false;
        changes.push(`${label}.shouldAbbreviateTrendValue`);
    }
    if (options.trendColor === undefined) {
        options.trendColor = '> trendValue | rangeValue(trendColorEditorConfig)';
        changes.push(`${label}.trendColor`);
    }
    if (options.trendFontSize === undefined) {
        options.trendFontSize = 28;
        changes.push(`${label}.trendFontSize`);
    }
    if (!visualization.context?.trendColorEditorConfig) {
        visualization.context = {
            ...(visualization.context ?? {}),
            trendColorEditorConfig: DEFAULT_TREND_CONTEXT,
        };
        changes.push(`${label}.context.trendColorEditorConfig`);
    }

    return 'trend';
}

function main() {
    const mode = process.argv[2];
    if (!['--check', '--write'].includes(mode) || process.argv.length !== 3) {
        usage();
        return;
    }

    const searchbase = fs.readFileSync(SEARCHBASE_PATH, 'utf8');
    const navXml = fs.readFileSync(NAV_PATH, 'utf8');
    const dashboards = dashboardIdsFromNavigation(navXml);
    const managerOnlyDashboardCount = validateManagerOnlyDashboardVisibility(navXml);
    if (dashboards.length !== EXPECTED_DASHBOARD_COUNT) {
        throw new Error(
            `Expected ${EXPECTED_DASHBOARD_COUNT} menu dashboards, found ${dashboards.length}`,
        );
    }

    let cardCount = 0;
    let trendCardCount = 0;
    let staticCardCount = 0;
    let abbreviatedCardCount = 0;
    const changedFiles = [];
    const pendingChanges = [];

    for (const dashboard of dashboards) {
        const filePath = path.join(VIEWS_ROOT, `${dashboard.id}.xml`);
        const xml = fs.readFileSync(filePath, 'utf8');
        const { match, definition } = parseDashboard(xml, filePath);
        const changes = [];
        const semanticBindings = new Map();

        for (const [visualizationId, visualization] of Object.entries(
            definition.visualizations ?? {},
        )) {
            if (visualization.type !== 'splunk.singlevalue') {
                continue;
            }

            cardCount += 1;
            if (visualization.options?.shouldAbbreviateMajorValue !== false) {
                abbreviatedCardCount += 1;
            }
            const dataSourceId = visualization.dataSources?.primary;
            const label = `${dashboard.id}.${visualizationId}`;
            const { baseDataSourceId, stanzaId } = resolveSearchbaseSource(
                definition,
                dataSourceId,
                label,
            );

            const stanza = searchbaseStanza(searchbase, stanzaId);
            const fields = resolveFields(stanzaId, stanza);
            if (STATIC_SUMMARY_STANZAS.has(stanzaId)) {
                fields.sparkDataField = resolveStaticSparkDataField(
                    definition,
                    visualizationId,
                    stanzaId,
                );
            }
            const semanticBinding = [
                stanzaId,
                fields.valueField,
                fields.sparkDataField,
            ].join('\u0000');
            const priorVisualizationId = semanticBindings.get(semanticBinding);
            if (priorVisualizationId) {
                throw new Error(
                    `${dashboard.id}: ${priorVisualizationId} and ${visualizationId} share the same semantic binding (${stanzaId}: ${fields.valueField}/${fields.sparkDataField})`,
                );
            }
            semanticBindings.set(semanticBinding, visualizationId);
            restoreSearchbaseDataSource(
                definition,
                visualization,
                baseDataSourceId,
                changes,
                label,
            );
            const kind = normalizeCard(
                visualization,
                stanzaId,
                fields,
                changes,
                label,
            );
            if (kind === 'trend') {
                trendCardCount += 1;
            } else {
                staticCardCount += 1;
            }
        }

        validateNoSearchbaseChains(definition, dashboard.id);

        if (changes.length > 0) {
            pendingChanges.push(...changes);
            changedFiles.push(path.relative(REPOSITORY_ROOT, filePath));
            if (mode === '--write') {
                const serialized = JSON.stringify(definition, null, 4);
                const updatedXml = xml.replace(DEFINITION_PATTERN, `$1${serialized}$3`);
                fs.writeFileSync(filePath, updatedXml);
            }
        }
    }

    if (cardCount !== EXPECTED_CARD_COUNT) {
        throw new Error(`Expected ${EXPECTED_CARD_COUNT} cards, found ${cardCount}`);
    }
    if (trendCardCount !== EXPECTED_TREND_CARD_COUNT) {
        throw new Error(
            `Expected ${EXPECTED_TREND_CARD_COUNT} chronological cards, found ${trendCardCount}`,
        );
    }
    if (staticCardCount !== EXPECTED_STATIC_CARD_COUNT) {
        throw new Error(
            `Expected ${EXPECTED_STATIC_CARD_COUNT} categorical cards, found ${staticCardCount}`,
        );
    }
    if (abbreviatedCardCount !== EXPECTED_ABBREVIATED_CARD_COUNT) {
        throw new Error(
            `Expected ${EXPECTED_ABBREVIATED_CARD_COUNT} abbreviated cards, found ${abbreviatedCardCount}`,
        );
    }

    if (mode === '--check' && pendingChanges.length > 0) {
        console.error(`Trend contract violations: ${pendingChanges.length}`);
        for (const change of pendingChanges) {
            console.error(`- ${change}`);
        }
        process.exitCode = 1;
        return;
    }

    const action = mode === '--write' ? 'Normalized' : 'Validated';
    console.log(
        `${action} ${dashboards.length} dashboards and ${cardCount} cards ` +
            `(${trendCardCount} chronological, ${staticCardCount} categorical, ` +
            `${abbreviatedCardCount} abbreviated); ${managerOnlyDashboardCount} ` +
            'manager-only dashboards are hidden from the native catalogue.',
    );
    if (changedFiles.length > 0) {
        console.log(`${mode === '--write' ? 'Changed' : 'Would change'} ${changedFiles.length} files:`);
        for (const file of changedFiles) {
            console.log(`- ${file}`);
        }
    }
}

main();
