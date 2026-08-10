#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP_ROOT = path.join(REPOSITORY_ROOT, 'packages/splunk-cisco-dashboards');
const VIEWS_DIRECTORY = path.join(
    APP_ROOT,
    'src/main/resources/splunk/default/data/ui/views'
);
const TEMPLATES_PATH = path.join(
    APP_ROOT,
    'src/main/resources/splunk/default/templates.conf'
);
const PALETTE_PATH = path.join(
    APP_ROOT,
    'src/main/webapp/common/theme/c3VisualizationPalette.ts'
);

const STUDIO_DASHBOARDS = [
    'asset_inventory_v1.xml',
    'building_v1.xml',
    'netops_readiness_v1.xml',
    'security_v1.xml',
    'spaces_intelligence_v1.xml',
    'statewide_exercise_v1.xml',
    'statewide_exercise_v1_studio_modern.xml',
    'workplace_spog_v1.xml',
];

const paletteSource = fs.readFileSync(PALETTE_PATH, 'utf8');
const palette = Object.fromEntries(
    [...paletteSource.matchAll(/^\s*(\w+):\s*'(#[0-9a-f]{6})'/gim)].map((match) => [
        match[1],
        match[2].toLowerCase(),
    ])
);

for (const required of [
    'info',
    'cyan',
    'cyanBright',
    'positive',
    'caution',
    'orange',
    'critical',
    'lavender',
    'purple',
    'neutral',
]) {
    if (!palette[required]) {
        throw new Error(`Shared C3 palette is missing ${required}`);
    }
}

const templates = fs.readFileSync(TEMPLATES_PATH, 'utf8');
const backgroundMatch = templates.match(
    /\[background:\/\/c3-atmosphere\]\ndata = ([^\n]+)\nname = Cisco Cloud Control Atmosphere/
);
if (!backgroundMatch) {
    throw new Error('Shared C3 atmospheric background is missing from templates.conf');
}

const sharedBackground = backgroundMatch[1];
const C3 = {
    canvas: '#0f1117',
    panel: '#131a23',
    secondary: '#1c2738',
    text: '#ecf0f5',
    muted: palette.neutral,
    accentStroke: 'rgba(100,158,245,0.28)',
    sectionFill: 'rgba(15,17,23,0.78)',
    sectionStroke: 'rgba(65,74,86,0.52)',
};
const SERIES = [
    palette.info,
    palette.positive,
    palette.caution,
    palette.critical,
    palette.lavender,
    palette.purple,
    palette.cyan,
    palette.cyanBright,
    palette.orange,
];

const CHART_TYPES = new Set([
    'splunk.area',
    'splunk.bar',
    'splunk.column',
    'splunk.line',
    'splunk.pie',
    'splunk.punchcard',
    'splunk.sankey',
    'splunk.scatter',
]);

const normalizeHex = (value) => {
    const normalized = value.toLowerCase();
    if (/^#[0-9a-f]{3}$/.test(normalized)) {
        return `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`;
    }
    return normalized;
};

const mapHexColor = (value) => {
    const normalized = normalizeHex(value);
    if (Object.values(palette).includes(normalized)) return normalized;

    const groups = [
        [
            new Set(['#6ebe4a', '#22c55e', '#16a34a', '#2e9e4a', '#00cdaf', '#6cc04a', '#8bd45b']),
            palette.positive,
        ],
        [new Set(['#e5a823', '#eda800', '#eab308', '#dd9900']), palette.caution],
        [new Set(['#ff8c25', '#f58220', '#ff9a4a']), palette.orange],
        [
            new Set(['#d64550', '#dc2626', '#e5534b', '#ff677b', '#ff6f68']),
            palette.critical,
        ],
        [new Set(['#8b6fc9', '#a88cff']), palette.lavender],
        [new Set(['#7b56db', '#7c3aed', '#a855f7', '#7c5cff', '#cb2196', '#813193']), palette.purple],
        [new Set(['#049fd9', '#009ceb', '#00a6d2', '#0ea5e9', '#35cff5']), palette.cyan],
        [new Set(['#2563eb', '#0051b5', '#0b5394', '#005073']), palette.info],
        [
            new Set([
                '#6e6e6e',
                '#777777',
                '#999999',
                '#9aa0a6',
                '#9e9e9e',
                '#a0a0a0',
                '#cccccc',
                '#94a3b8',
                '#8193a8',
                '#8fa2bd',
                '#61728a',
            ]),
            palette.neutral,
        ],
        [
            new Set(['#000000', '#111827', '#1a1a1a', '#2b2b2b', '#333333', '#424245']),
            C3.text,
        ],
        [
            new Set([
                '#ffffff',
                '#f0f0f0',
                '#f5f5f5',
                '#f5f6f8',
                '#dde1e6',
                '#dce5ef',
                '#e0e0e0',
            ]),
            palette.neutral,
        ],
    ];

    for (const [candidates, replacement] of groups) {
        if (candidates.has(normalized)) return replacement;
    }
    return normalized;
};

const replaceColorLiterals = (value) => {
    if (Array.isArray(value)) return value.map(replaceColorLiterals);
    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value).map(([key, nested]) => [key, replaceColorLiterals(nested)])
        );
    }
    if (typeof value !== 'string') return value;

    return value
        .replace(/rgba\(37,\s*99,\s*235,\s*0\.18\)/gi, 'rgba(100,158,245,0.18)')
        .replace(/rgba\(124,\s*58,\s*237,\s*0\.18\)/gi, 'rgba(156,166,255,0.18)')
        .replace(/#[0-9a-f]{3,6}\b/gi, (color) => mapHexColor(color));
};

const transformVisualization = (visualizationId, visualization) => {
    const transformed = replaceColorLiterals(visualization);
    const options = { ...(transformed.options || {}) };

    if (transformed.type === 'splunk.rectangle') {
        const isHeader = /(?:^|_)(?:hdr|header)(?:_|$)/i.test(visualizationId);
        const isSection = /(?:^|_)section(?:_|$)/i.test(visualizationId);
        options.fillColor = isHeader
            ? C3.secondary
            : isSection
              ? C3.sectionFill
              : C3.panel;
        options.strokeColor = isSection ? C3.sectionStroke : C3.accentStroke;
        options.strokeOpacity = 1;
        options.strokeWidth = 1;
        if ('rounding' in options && !('rx' in options)) options.rounding = 10;
        else options.rx = isSection ? 12 : Math.max(Number(options.rx) || 0, 10);
    } else {
        options.backgroundColor = /(?:^|_)(?:hdr|header)(?:_|_)title(?:_|$)/i.test(
            visualizationId
        )
            ? C3.secondary
            : C3.panel;
    }

    if (transformed.type === 'splunk.markdown') {
        const existingFontColor = options.fontColor;
        options.fontColor =
            typeof existingFontColor === 'string' &&
            [palette.info, palette.cyan, palette.cyanBright, palette.positive, palette.caution, palette.orange, palette.critical, palette.lavender, palette.purple].includes(
                existingFontColor.toLowerCase()
            )
                ? existingFontColor.toLowerCase()
                : /(?:subtitle|description|footer|caption|eyebrow|kicker|muted|note)/i.test(
                        visualizationId
                    )
                  ? C3.muted
                  : C3.text;
        if (options.fontSize === 'custom' && Number(options.customFontSize) < 12) {
            options.customFontSize = 12;
        }
    }

    if (CHART_TYPES.has(transformed.type)) {
        const existingSeries = Array.isArray(options.seriesColors)
            ? options.seriesColors.map((color) => {
                  const mapped =
                      typeof color === 'string' ? replaceColorLiterals(color) : color;
                  return typeof mapped === 'string' &&
                      Object.values(palette).includes(mapped.toLowerCase())
                      ? mapped.toLowerCase()
                      : palette.neutral;
              })
            : [];
        options.seriesColors = existingSeries.length ? existingSeries : [...SERIES];
    }

    if (transformed.type === 'splunk.area' || transformed.type === 'splunk.line') {
        options.lineWidth = 2;
        options.markerDisplay = 'outlined';
    }

    if (transformed.type === 'splunk.table') {
        options.tableFormat = {
            ...(options.tableFormat || {}),
            headerBackgroundColor: C3.secondary,
            headerColor: C3.text,
        };
    }

    if (transformed.type === 'splunk.map' && Array.isArray(options.layers)) {
        options.layers = options.layers.map((layer) => ({
            ...layer,
            ...(Object.prototype.hasOwnProperty.call(layer, 'markerColor')
                ? { markerColor: palette.cyan }
                : {}),
        }));
    }

    return { ...transformed, options };
};

for (const filename of STUDIO_DASHBOARDS) {
    const dashboardPath = path.join(VIEWS_DIRECTORY, filename);
    const xml = fs.readFileSync(dashboardPath, 'utf8');
    const definitionMatch = xml.match(
        /<definition><!\[CDATA\[([\s\S]*?)\]\]><\/definition>/
    );
    if (!definitionMatch) throw new Error(`${filename} has no Dashboard Studio definition`);

    const definition = JSON.parse(definitionMatch[1]);
    definition.visualizations = Object.fromEntries(
        Object.entries(definition.visualizations).map(([visualizationId, visualization]) => [
            visualizationId,
            transformVisualization(visualizationId, visualization),
        ])
    );

    for (const layoutDefinition of Object.values(definition.layout.layoutDefinitions)) {
        const shouldFitWideCanvas = Number(layoutDefinition.options?.width) > 1440;
        layoutDefinition.options = {
            ...(layoutDefinition.options || {}),
            ...(shouldFitWideCanvas ? { display: 'fit-to-width' } : {}),
            backgroundColor: C3.canvas,
            backgroundImage: {
                sizeType: 'cover',
                src: sharedBackground,
                x: 0,
                y: 0,
            },
        };
    }

    const serialized = JSON.stringify(definition, null, '\t');
    const nextXml = xml
        .replace(
            /<dashboard\s+version="2"(?:\s+theme="[^"]+")?(?:\s+stylesheet="[^"]+")?>/,
            '<dashboard version="2" theme="dark" stylesheet="application.css">'
        )
        .replace(definitionMatch[1], () => `\n${serialized}\n`);
    fs.writeFileSync(dashboardPath, nextXml);
    process.stdout.write(`Updated ${filename}\n`);
}
