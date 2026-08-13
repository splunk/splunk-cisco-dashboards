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
const BACKGROUND_BUTTON_PATH = path.join(
    APP_ROOT,
    'src/main/webapp/pages/dashboardbuilder/BackgroundButton.jsx'
);
const DEFAULT_BACKGROUND_SVG_PATH = path.join(
    APP_ROOT,
    'src/main/resources/splunk/appserver/static/page-spotlight-bottom-glow-low-intensity.svg'
);
const DEFAULT_BACKGROUND_ID = 'background://page-spotlight-bottom-glow-low-intensity';
const DEFAULT_BACKGROUND_LABEL = 'Page Spotlight Bottom Glow - Low Intensity';
const PILLAR_DASHBOARDS = [
    'sn_agentic_ops_operational_intelligence.xml',
    'sn_hmf_enforcement.xml',
    'sn_secure_infrastructure_posture.xml',
    'sn_segmentation_readiness.xml',
    'sn_zta_posture.xml',
];
const REMOVED_BACKGROUND_IDS = new Set([
    'background://c3-atmosphere',
    'background://sei-cbr-generic-3',
    'background://sei-cbr-generic-4',
    'background://sei-cbr-title-slide-1',
    'background://sei-cbr-title-slide-2',
    'background://sei-exec-manufacturing',
    'background://sei-generic-1',
    'background://sei-generic-1.1',
    'background://sei-generic-10',
    'background://sei-generic-13',
    'background://sei-generic-15',
    'background://sei-generic-17',
    'background://sei-generic-18',
    'background://sei-generic-19',
    'background://sei-generic-2',
    'background://sei-generic-21',
    'background://sei-generic-22',
    'background://sei-generic-3',
    'background://sei-generic-4',
]);

const defaultBackgroundSvg = fs.readFileSync(DEFAULT_BACKGROUND_SVG_PATH, 'utf8').trim();
if (!/viewBox="0 0 2000 1288"/.test(defaultBackgroundSvg)) {
    throw new Error('Page spotlight must retain its approved 2000 by 1288 viewBox');
}
if (/<(?:script|foreignObject)\b|\son\w+=|(?:href|xlink:href)=/i.test(defaultBackgroundSvg)) {
    throw new Error('Page spotlight must not contain executable or external content');
}
const defaultBackgroundData =
    `data:image/svg+xml;base64,${Buffer.from(defaultBackgroundSvg).toString('base64')}`;

const templates = fs.readFileSync(TEMPLATES_PATH, 'utf8');
const templateSections = templates.split(/(?=^\[background:\/\/)/m);
const templateHeader = templateSections.shift();
const retainedTemplates = templateSections.filter((section) => {
    const stanzaMatch = section.match(/^\[([^\]]+)]/);
    return (
        !stanzaMatch ||
        (stanzaMatch[1] !== DEFAULT_BACKGROUND_ID &&
            !REMOVED_BACKGROUND_IDS.has(stanzaMatch[1]))
    );
});
const defaultTemplate = [
    `[${DEFAULT_BACKGROUND_ID}]`,
    `data = ${defaultBackgroundData}`,
    `name = ${DEFAULT_BACKGROUND_LABEL}`,
    '',
].join('\n');
fs.writeFileSync(
    TEMPLATES_PATH,
    `${templateHeader.trimEnd()}\n\n${defaultTemplate}${retainedTemplates.join('')}`
);

const backgroundButtonSource = fs.readFileSync(BACKGROUND_BUTTON_PATH, 'utf8');
const backgroundButtonPattern =
    /(export const FACTORY_DEFAULT_BACKGROUND_DATA =)[ \t]*\n[ \t]*'data:image\/svg\+xml;base64,[^']+';/;
if (!backgroundButtonPattern.test(backgroundButtonSource)) {
    throw new Error('Unable to find FACTORY_DEFAULT_BACKGROUND_DATA');
}
const nextBackgroundButtonSource = backgroundButtonSource.replace(
    backgroundButtonPattern,
    `$1\n    '${defaultBackgroundData}';`
);
fs.writeFileSync(BACKGROUND_BUTTON_PATH, nextBackgroundButtonSource);

let dashboardCount = 0;
let layoutCount = 0;

for (const filename of PILLAR_DASHBOARDS) {
    const dashboardPath = path.join(VIEWS_DIRECTORY, filename);
    const xml = fs.readFileSync(dashboardPath, 'utf8');
    if (!/<dashboard\s+version="2"/.test(xml)) continue;

    const definitionMatch = xml.match(
        /<definition><!\[CDATA\[([\s\S]*?)\]\]><\/definition>/
    );
    if (!definitionMatch) {
        throw new Error(`${filename} has no Dashboard Studio definition`);
    }

    const definition = JSON.parse(definitionMatch[1]);
    const layoutDefinitions = definition.layout?.layoutDefinitions || {};
    if (!Object.keys(layoutDefinitions).length) {
        throw new Error(`${filename} has no Dashboard Studio layouts`);
    }

    for (const layout of Object.values(layoutDefinitions)) {
        layout.options = {
            ...(layout.options || {}),
            backgroundImage: {
                sizeType: 'contain',
                src: defaultBackgroundData,
                x: 0,
                y: 0,
            },
        };
        layoutCount += 1;
    }

    const serialized = JSON.stringify(definition, null, 4);
    const nextXml = xml.replace(
        definitionMatch[1],
        () => `\n${serialized}\n    `
    );
    fs.writeFileSync(dashboardPath, nextXml);
    dashboardCount += 1;
}

process.stdout.write(
    `Registered the page spotlight and updated ${dashboardCount} pillar dashboards and ${layoutCount} layouts.\n`
);
