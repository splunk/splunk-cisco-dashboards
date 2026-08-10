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
const ATMOSPHERE_SVG_PATH = path.join(
    APP_ROOT,
    'src/main/resources/splunk/appserver/static/c3-atmosphere.svg'
);

const atmosphereSvg = fs.readFileSync(ATMOSPHERE_SVG_PATH, 'utf8').trim();
if (/\bstroke(?:-width)?=/i.test(atmosphereSvg)) {
    throw new Error('Shared C3 atmosphere must remain borderless');
}
const sharedBackground = `data:image/svg+xml;base64,${Buffer.from(atmosphereSvg).toString('base64')}`;

const templates = fs.readFileSync(TEMPLATES_PATH, 'utf8');
const templateBackgroundPattern =
    /(\[background:\/\/c3-atmosphere\]\ndata = )[^\n]+(\nname = Cisco Cloud Control Atmosphere)/;
if (!templateBackgroundPattern.test(templates)) {
    throw new Error('Shared C3 Studio background is missing from templates.conf');
}
fs.writeFileSync(
    TEMPLATES_PATH,
    templates.replace(templateBackgroundPattern, `$1${sharedBackground}$2`)
);

const backgroundButtonSource = fs.readFileSync(BACKGROUND_BUTTON_PATH, 'utf8');
const backgroundButtonPattern =
    /(export const C3_DEFAULT_BACKGROUND_DATA =)[ \t]*\n[ \t]*'data:image\/svg\+xml;base64,[^']+';/;
if (!backgroundButtonPattern.test(backgroundButtonSource)) {
    throw new Error('Unable to find C3_DEFAULT_BACKGROUND_DATA');
}
const nextBackgroundButtonSource = backgroundButtonSource.replace(
    backgroundButtonPattern,
    `$1\n    '${sharedBackground}';`
);
fs.writeFileSync(BACKGROUND_BUTTON_PATH, nextBackgroundButtonSource);

let dashboardCount = 0;
let layoutCount = 0;

for (const filename of fs.readdirSync(VIEWS_DIRECTORY).filter((name) => name.endsWith('.xml'))) {
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
                src: sharedBackground,
                x: 0,
                y: 0,
            },
        };
        layoutCount += 1;
    }

    // Secure Networking definitions predate the tab-indented Studio dashboards.
    // Retain each dashboard family's established formatting so this focused sync
    // does not generate thousands of whitespace-only changes.
    const isSecureNetworking = filename.startsWith('sn_');
    const indentation = isSecureNetworking ? 4 : '\t';
    const serialized = JSON.stringify(definition, null, indentation);
    const closingPadding = isSecureNetworking ? '    ' : '';
    const nextXml = xml.replace(
        definitionMatch[1],
        () => `\n${serialized}\n${closingPadding}`
    );
    fs.writeFileSync(dashboardPath, nextXml);
    dashboardCount += 1;
}

process.stdout.write(
    `Updated ${dashboardCount} Studio dashboards and ${layoutCount} layouts.\n`
);
