const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const APP_ROOT = path.resolve(__dirname, '..');
const VIEWS_DIR = path.join(
    APP_ROOT,
    'src/main/resources/splunk/default/data/ui/views'
);
const ATMOSPHERE_PATH = path.join(
    APP_ROOT,
    'src/main/resources/splunk/appserver/static/c3-atmosphere.svg'
);
const TEMPLATES_PATH = path.join(
    APP_ROOT,
    'src/main/resources/splunk/default/templates.conf'
);
const WEBAPP_ROOT = path.join(APP_ROOT, 'src/main/webapp');

const atmosphereSvg = fs.readFileSync(ATMOSPHERE_PATH, 'utf8').trim();
const atmosphereData = `data:image/svg+xml;base64,${Buffer.from(atmosphereSvg).toString('base64')}`;

assert.doesNotMatch(
    atmosphereSvg,
    /\bstroke(?:-width)?=/i,
    'the canonical C3 atmosphere must not draw a frame or border'
);
for (const color of ['#0b1118', '#30aacc', '#0c1a56', '#2c93e1', '#80148c']) {
    assert.match(atmosphereSvg.toLowerCase(), new RegExp(color));
}

const templates = fs.readFileSync(TEMPLATES_PATH, 'utf8');
assert.match(
    templates,
    new RegExp(
        `\\[background:\\/\\/c3-atmosphere\\]\\ndata = ${atmosphereData.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\nname = Cisco Cloud Control Atmosphere`
    ),
    'Dashboard Manager must register the canonical C3 atmosphere'
);

const studioFiles = [];
let studioLayoutCount = 0;
const simpleXmlDashboards = [];

for (const fileName of fs.readdirSync(VIEWS_DIR).filter((name) => name.endsWith('.xml'))) {
    const xml = fs.readFileSync(path.join(VIEWS_DIR, fileName), 'utf8');
    if (/<dashboard\s+version="2"/.test(xml)) {
        const match = xml.match(/<definition><!\[CDATA\[([\s\S]*?)\]\]><\/definition>/);
        assert.ok(match, `${fileName} must contain a Studio definition`);
        const definition = JSON.parse(match[1]);
        const layouts = Object.entries(definition.layout?.layoutDefinitions || {});
        assert.ok(layouts.length > 0, `${fileName} must contain at least one layout`);
        for (const [layoutId, layout] of layouts) {
            assert.deepEqual(
                layout.options?.backgroundImage,
                { sizeType: 'contain', src: atmosphereData, x: 0, y: 0 },
                `${fileName}/${layoutId} must use the canonical borderless atmosphere`
            );
            studioLayoutCount += 1;
        }
        studioFiles.push(fileName);
    } else if (/<dashboard\s+version="1\.1"/.test(xml) && !/isDashboard="False"/.test(xml)) {
        simpleXmlDashboards.push(fileName);
    }
}

assert.equal(studioFiles.length, 25, 'all 25 Dashboard Studio dashboards must be covered');
assert.equal(studioLayoutCount, 53, 'all 53 Dashboard Studio layouts must be covered');
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
        `${relativePath} must use the shared C3 atmosphere contract`
    );
}

for (const cssPath of [
    path.join(WEBAPP_ROOT, 'common/styles/tailwind.css'),
    path.join(WEBAPP_ROOT, 'pages/macro_index_tuning/macro-index-tuning.css'),
    path.join(APP_ROOT, 'src/main/resources/splunk/appserver/static/start.css'),
]) {
    assert.match(
        fs.readFileSync(cssPath, 'utf8'),
        /\/static\/app\/splunk-cisco-dashboards\/c3-atmosphere\.svg/,
        `${path.relative(APP_ROOT, cssPath)} must reference the canonical asset`
    );
}

const backgroundButton = fs.readFileSync(
    path.join(WEBAPP_ROOT, 'pages/dashboardbuilder/BackgroundButton.jsx'),
    'utf8'
);
assert.ok(
    backgroundButton.includes(atmosphereData),
    'new Dashboard Manager dashboards must use the canonical atmosphere'
);

process.stdout.write(
    `Verified the shared C3 atmosphere across ${studioFiles.length + simpleXmlDashboards.length} dashboards and ${studioLayoutCount} Studio layouts.\n`
);
