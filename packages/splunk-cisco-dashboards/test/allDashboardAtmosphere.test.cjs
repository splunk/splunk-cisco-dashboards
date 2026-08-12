const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const APP_ROOT = path.resolve(__dirname, '..');
const VIEWS_DIR = path.join(
    APP_ROOT,
    'src/main/resources/splunk/default/data/ui/views'
);
const STATIC_DIR = path.join(APP_ROOT, 'src/main/resources/splunk/appserver/static');
const TEMPLATES_PATH = path.join(
    APP_ROOT,
    'src/main/resources/splunk/default/templates.conf'
);
const WEBAPP_ROOT = path.join(APP_ROOT, 'src/main/webapp');
const PILLAR_STUDIO_FILES = new Set([
    'sn_agentic_ops_operational_intelligence.xml',
    'sn_hmf_enforcement.xml',
    'sn_secure_infrastructure_posture.xml',
    'sn_segmentation_readiness.xml',
    'sn_zta_posture.xml',
]);
const REMOVED_BACKGROUND_IDS = [
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
];

const dataUriFor = (fileName) => {
    const source = fs.readFileSync(path.join(STATIC_DIR, fileName), 'utf8').trim();
    return {
        source,
        data: `data:image/svg+xml;base64,${Buffer.from(source).toString('base64')}`,
    };
};
const atmosphere = dataUriFor('c3-atmosphere.svg');
const spotlight = dataUriFor('page-spotlight-bottom-glow-low-intensity.svg');

assert.doesNotMatch(
    atmosphere.source,
    /\bstroke(?:-width)?=/i,
    'the retained C3 atmosphere must not draw a frame or border'
);
for (const color of ['#0b1118', '#30aacc', '#0c1a56', '#2c93e1', '#80148c']) {
    assert.match(atmosphere.source.toLowerCase(), new RegExp(color));
}
assert.match(spotlight.source, /viewBox="0 0 2000 1288"/);
assert.match(spotlight.source, /<feGaussianBlur[^>]*stdDeviation="140"/);
assert.match(spotlight.source.toLowerCase(), /#ff9000/);
assert.match(spotlight.source.toLowerCase(), /#ff007f/);
assert.doesNotMatch(spotlight.source, /<(?:script|foreignObject)\b|\son\w+=|(?:href|xlink:href)=/i);

const templates = fs.readFileSync(TEMPLATES_PATH, 'utf8');
assert.match(
    templates,
    new RegExp(
        `\\[background:\\/\\/page-spotlight-bottom-glow-low-intensity\\]\\ndata = ${spotlight.data.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\nname = Page Spotlight Bottom Glow - Low Intensity`
    ),
    'Dashboard Manager must register the approved page spotlight'
);
for (const backgroundId of REMOVED_BACKGROUND_IDS) {
    assert.ok(
        !templates.includes(`[${backgroundId}]`),
        `${backgroundId} must not remain in the background selector registry`
    );
}

const studioFiles = [];
let studioLayoutCount = 0;
let spotlightLayoutCount = 0;
const simpleXmlDashboards = [];

for (const fileName of fs.readdirSync(VIEWS_DIR).filter((name) => name.endsWith('.xml'))) {
    const xml = fs.readFileSync(path.join(VIEWS_DIR, fileName), 'utf8');
    if (/<dashboard\s+version="2"/.test(xml)) {
        const match = xml.match(/<definition><!\[CDATA\[([\s\S]*?)\]\]><\/definition>/);
        assert.ok(match, `${fileName} must contain a Studio definition`);
        const definition = JSON.parse(match[1]);
        const layouts = Object.entries(definition.layout?.layoutDefinitions || {});
        assert.ok(layouts.length > 0, `${fileName} must contain at least one layout`);
        const expectedData = PILLAR_STUDIO_FILES.has(fileName) ? spotlight.data : atmosphere.data;
        for (const [layoutId, layout] of layouts) {
            assert.deepEqual(
                layout.options?.backgroundImage,
                { sizeType: 'contain', src: expectedData, x: 0, y: 0 },
                `${fileName}/${layoutId} must use its approved background`
            );
            studioLayoutCount += 1;
            if (PILLAR_STUDIO_FILES.has(fileName)) spotlightLayoutCount += 1;
        }
        studioFiles.push(fileName);
    } else if (/<dashboard\s+version="1\.1"/.test(xml) && !/isDashboard="False"/.test(xml)) {
        simpleXmlDashboards.push(fileName);
    }
}

assert.equal(studioFiles.length, 25, 'all 25 Dashboard Studio dashboards must be covered');
assert.equal(studioLayoutCount, 53, 'all 53 Dashboard Studio layouts must be covered');
assert.equal(spotlightLayoutCount, 5, 'the five pillar landing layouts must use the spotlight');
assert.deepEqual(
    simpleXmlDashboards.sort(),
    [
        'admin_macro_index_tuning.xml',
        'netops_health_monitoring.xml',
        'network_diagram.xml',
        'searchbase_canvas.xml',
        'secops_overview.xml',
        'setup.xml',
        'sn_topology_canvas.xml',
        'user_guide.xml',
        'workplace_m365_activity_monitoring.xml',
        'workspace_insights.xml',
    ],
    'the complete Simple XML dashboard inventory must stay explicit'
);

const runtimeContracts = [
    ['pages/executive_insights/index.tsx', /scd-one-cisco-spotlight-canvas/],
    ['pages/secure_operations_glass/index.tsx', /scd-c3-atmosphere/],
    ['pages/user_guide/index.tsx', /scd-c3-atmosphere/],
    ['pages/health_monitoring/HealthMonitoringDashboard.tsx', /scd-c3-atmosphere/],
    ['pages/network_diagram/index.tsx', /scd-c3-atmosphere/],
    ['pages/topology_canvas_v1/index.tsx', /scd-c3-atmosphere/],
    ['pages/m365_activity_monitoring/index.tsx', /scd-c3-atmosphere/],
    ['pages/macro_index_tuning/index.tsx', /scd-c3-atmosphere/],
    ['pages/searchbase_canvas/index.tsx', /C3_ATMOSPHERE_BACKGROUND_STYLE/],
];

for (const [relativePath, marker] of runtimeContracts) {
    assert.match(
        fs.readFileSync(path.join(WEBAPP_ROOT, relativePath), 'utf8'),
        marker,
        `${relativePath} must preserve its existing C3 atmosphere contract`
    );
}

for (const cssPath of [
    path.join(WEBAPP_ROOT, 'common/styles/tailwind.css'),
    path.join(APP_ROOT, 'src/main/resources/splunk/appserver/static/start.css'),
]) {
    assert.match(
        fs.readFileSync(cssPath, 'utf8'),
        /\/static\/app\/splunk-cisco-dashboards\/c3-atmosphere\.svg/,
        `${path.relative(APP_ROOT, cssPath)} must preserve its existing background asset`
    );
}

const backgroundButton = fs.readFileSync(
    path.join(WEBAPP_ROOT, 'pages/dashboardbuilder/BackgroundButton.jsx'),
    'utf8'
);
assert.ok(
    backgroundButton.includes(spotlight.data),
    'new Dashboard Manager dashboards must use the approved page spotlight'
);
assert.match(
    backgroundButton,
    /FACTORY_DEFAULT_BACKGROUND_NAME[\s\S]*background:\/\/page-spotlight-bottom-glow-low-intensity/
);
assert.match(
    backgroundButton,
    /prepareBackgroundChoices[\s\S]*seenNames[\s\S]*seenImages/,
    'the selector must inject the factory default and deduplicate stale or uploaded copies'
);
for (const backgroundId of REMOVED_BACKGROUND_IDS) {
    const suffix = backgroundId.match(/^background:\/\/sei-(.+)$/)?.[1];
    if (suffix) {
        assert.ok(
            backgroundButton.includes(`'${suffix}'`),
            `the ${suffix} suffix must be filtered from stale IS4S and SEI runtime responses`
        );
    }
}

process.stdout.write(
    `Verified the page spotlight on five pillar dashboards and preserved ${studioLayoutCount - spotlightLayoutCount} existing Studio layouts.\n`
);
