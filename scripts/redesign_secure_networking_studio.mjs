#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appDefault = path.join(
    repoRoot,
    'packages/splunk-cisco-dashboards/src/main/resources/splunk/default'
);
const viewsDir = path.join(appDefault, 'data/ui/views');
const searchbasePath = path.join(appDefault, 'searchbase.conf');
const writeChanges = process.argv.includes('--write');

const dashboardCopy = {
    'sn_agentic_ops_operational_intelligence.xml': {
        purpose:
            'Coordinate telemetry readiness, path health, routing instability, and AI Defense signals.',
        audience: 'Security and network operations',
        sources: 'AI Defense, ThousandEyes, routing, and feed-health telemetry',
        section: 'Operational posture',
        guidance:
            'Confirm feed health first, then investigate path quality, routing, and enforcement exceptions.',
    },
    'sn_agentic_ops_executive_assurance.xml': {
        purpose:
            'Summarize secure-networking posture, operational risk, and business-relevant outcomes.',
        audience: 'Executives, security leaders, and network leaders',
        sources: 'Cisco network, security, data-center, and telemetry feeds',
        section: 'Executive signals',
        guidance:
            'Use KPIs for posture, trends for trajectory, and feed health to judge confidence.',
    },
    'sn_hmf_dlp_cloud_native_security.xml': {
        purpose:
            'Expose data-loss risk and cloud-native workload controls in one operational view.',
        audience: 'Cloud security, SOC, and workload-security teams',
        sources: 'Secure Access, Secure Workload, and cloud-native security telemetry',
        section: 'Data and workload risk',
        guidance:
            'Review severity patterns first, then investigate DLP findings and workload evidence.',
    },
    'sn_hmf_sdwan_network_health.xml': {
        purpose:
            'Correlate WAN health, reachability, and service-impact signals across the mesh.',
        audience: 'Network operations and service-assurance teams',
        sources: 'Catalyst SD-WAN Manager site, circuit, tunnel, and health telemetry',
        section: 'WAN service health',
        guidance:
            'Use state distribution for posture, then move into site detail and geography.',
    },
    'sn_hmf_threat_detection_enforcement.xml': {
        purpose:
            'Track high-confidence detections and verify the controls enforcing policy.',
        audience: 'SOC, firewall, and cloud-security operations',
        sources: 'Secure Access, Umbrella, Secure Firewall, and Multicloud Defense',
        section: 'Detection pressure',
        guidance:
            'Compare blocked volume and deny rate before reviewing gateway-specific evidence.',
    },
    'sn_hmf_enforcement.xml': {
        purpose:
            'Unify firewall posture, enforcement, and workload protection across the hybrid mesh.',
        audience: 'Firewall, network-security, and SOC teams',
        sources: 'Secure Firewall, Meraki, SD-WAN UTD, Secure Access, and ASA telemetry',
        section: 'Enforcement posture',
        guidance:
            'Start with block volume and feed freshness, then compare trends and site coverage.',
    },
    'sn_segmentation_readiness.xml': {
        purpose:
            'Connect segmentation posture, trust boundaries, and enforcement coverage at scale.',
        audience: 'Network security, identity, and TrustSec operations',
        sources: 'Cisco ISE authentication, SGT, and IP-SGT binding telemetry',
        section: 'TrustSec posture',
        guidance:
            'Read adoption breadth first, then investigate binding mix and site-level gaps.',
    },
    'sn_segmentation_operations.xml': {
        purpose:
            'Summarize segment health, policy alignment, and areas needing investigation.',
        audience: 'Network security and segmentation owners',
        sources: 'Cisco ISE Security Group Tag and IP-SGT binding telemetry',
        section: 'Binding inventory',
        guidance:
            'Start with binding distribution, then use site and device detail to locate gaps.',
    },
    'sn_secure_infrastructure_posture.xml': {
        purpose:
            'Unify infrastructure assurance, exposure, and operational control signals.',
        audience: 'Infrastructure, NetOps, and network-security teams',
        sources: 'Catalyst Center, Catalyst SD-WAN, Nexus Dashboard, and Meraki',
        section: 'Infrastructure assurance',
        guidance:
            'Use footprint and anomaly KPIs to orient, then review trends and detailed rollups.',
    },
    'sn_secure_infrastructure_status.xml': {
        purpose:
            'Track current infrastructure state, exceptions, and emerging operational risk.',
        audience: 'Network operations and wireless-security teams',
        sources: 'Meraki infrastructure, Air Marshal, and wireless configuration telemetry',
        section: 'Wireless infrastructure state',
        guidance:
            'Confirm the managed footprint, then review rogue containment and encryption exceptions.',
    },
    'sn_zta_posture.xml': {
        purpose:
            'Connect identity, posture, policy, and response signals across the access journey.',
        audience: 'Identity, network-security, and SOC teams',
        sources: 'Cisco ISE authentication and network-device enforcement telemetry',
        section: 'Access posture',
        guidance:
            'Compare authentication volume and failure pressure before investigating devices and policy.',
    },
    'sn_zta_authentication_policy_enforcement.xml': {
        purpose:
            'Validate authentication outcomes and verify access policy enforcement.',
        audience: 'Identity, NAC, and access-policy operations',
        sources: 'Cisco ISE RADIUS, policy-set, and network-device telemetry',
        section: 'Policy enforcement',
        guidance:
            'Confirm enforcement footprint and latency, then investigate devices and policy hits.',
    },
    'sn_zta_detection_response.xml': {
        purpose:
            'Surface access-related detections and the response actions that contain risk.',
        audience: 'SOC analysts and incident responders',
        sources: 'Cisco XDR incidents and Attack Analyzer forensic telemetry',
        section: 'Incident pressure',
        guidance:
            'Prioritize lifecycle and severity pressure, then open the supporting forensic evidence.',
    },
    'sn_zta_policy_management.xml': {
        purpose:
            'Monitor access-policy coverage, change, and exceptions needing review.',
        audience: 'Identity-security and access-policy owners',
        sources: 'Cisco Duo authentication, identity, and endpoint-posture telemetry',
        section: 'Policy outcomes',
        guidance:
            'Review decisions by application, then investigate denied identities and posture gaps.',
    },
    'sn_zta_ravpn_sessions_and_posture.xml': {
        purpose:
            'Connect remote-session health with endpoint posture and access risk.',
        audience: 'Remote-access, identity, and security operations',
        sources: 'Secure Access RaVPN, ASA, identity, and endpoint-posture telemetry',
        section: 'Remote-access assurance',
        guidance:
            'Review profile volume and connection pressure before opening failure and posture detail.',
    },
    'sn_zta_user_activity_monitoring.xml': {
        purpose:
            'Reveal unusual access behavior and the identities, devices, and resources involved.',
        audience: 'SOC, identity-threat, and access-security teams',
        sources: 'Cisco ISE, Secure Access ZTNA, and Secure Firewall identity telemetry',
        section: 'Identity activity',
        guidance:
            'Compare access outcomes first, then correlate users across enforcement layers and time.',
    },
};

const colorReplacements = new Map([
    ['#020617', '#07101d'],
    ['#0f172a', '#0f1a2a'],
    ['#e2e8f0', '#e8f1fb'],
    ['#dc2626', '#ff7169'],
    ['#16a34a', '#8bd45b'],
    ['#eab308', '#ff9a4a'],
    ['#f59e0b', '#ff9a4a'],
    ['#06b6d4', '#35cff5'],
    ['#0ea5e9', '#53bfff'],
]);

function parseSearchbaseDescriptions(text) {
    const descriptions = new Map();
    let stanza = null;
    for (const line of text.split(/\r?\n/)) {
        const stanzaMatch = line.match(/^\[([^\]]+)]$/);
        if (stanzaMatch) {
            stanza = stanzaMatch[1];
            continue;
        }
        const descriptionMatch = line.match(/^description\s*=\s*(.*)$/);
        if (stanza && descriptionMatch) {
            descriptions.set(stanza, descriptionMatch[1]);
        }
    }
    return descriptions;
}

function decodeHtml(text) {
    const entities = new Map([
        ['&amp;', '&'],
        ['&mdash;', '—'],
        ['&ndash;', '–'],
        ['&nbsp;', ' '],
        ['&rsquo;', '’'],
        ['&lsquo;', '‘'],
        ['&rdquo;', '”'],
        ['&ldquo;', '“'],
        ['&deg;', '°'],
        ['&rarr;', '→'],
        ['&lt;', '<'],
        ['&gt;', '>'],
        ['&quot;', '"'],
        ['&#39;', "'"],
    ]);
    let output = text.replace(/<[^>]*>/g, ' ');
    for (const [entity, value] of entities) {
        output = output.replaceAll(entity, value);
    }
    return output.replace(/\s+/g, ' ').trim();
}

function concise(text, maxLength = 220) {
    if (text.length <= maxLength) return text;
    const candidate = text.slice(0, maxLength + 1);
    const sentenceEnd = Math.max(candidate.lastIndexOf('. '), candidate.lastIndexOf('; '));
    if (sentenceEnd >= Math.floor(maxLength * 0.55)) {
        return candidate.slice(0, sentenceEnd + 1).trim();
    }
    const wordEnd = candidate.lastIndexOf(' ');
    return `${candidate.slice(0, wordEnd).trim()}…`;
}

function escapeXml(text) {
    return text
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&apos;');
}

function replaceColors(value) {
    if (Array.isArray(value)) return value.map(replaceColors);
    if (value && typeof value === 'object') {
        for (const [key, child] of Object.entries(value)) {
            value[key] = replaceColors(child);
        }
        return value;
    }
    if (typeof value !== 'string') return value;
    return colorReplacements.get(value.toLowerCase()) ?? value;
}

function isDataVisualization(id, visualization) {
    if (id.startsWith('viz_header')) return false;
    if (id === 'viz_design_context' || id === 'viz_design_section') return false;
    return !['splunk.rectangle', 'splunk.image', 'splunk.markdown'].includes(visualization.type);
}

function descriptionForVisualization(definition, visualization, descriptions) {
    const dataSourceId = visualization.dataSources?.primary;
    const ref = dataSourceId ? definition.dataSources?.[dataSourceId]?.options?.ref : null;
    if (!ref) return { ref: null, description: null };
    const raw = descriptions.get(ref);
    return { ref, description: raw ? concise(decodeHtml(raw)) : null };
}

function compactPanelHeight(entry, definition, rowLength) {
    if (rowLength >= 3) return 200;

    const type =
        definition.visualizations?.[entry.item]?.type ??
        definition.inputs?.[entry.item]?.type ??
        '';
    if (type === 'splunk.singlevalue') return 190;
    if (type === 'splunk.singlevalueradial') return 200;
    if (['splunk.table', 'splunk.map'].includes(type)) return 300;
    if (
        ['splunk.area', 'splunk.bar', 'splunk.column', 'splunk.line', 'splunk.pie'].includes(
            type
        )
    ) {
        return 280;
    }
    return 260;
}

function redesignLayout(layoutDefinition, definition) {
    const structure = layoutDefinition.structure ?? [];
    const byItem = new Map(structure.map((entry) => [entry.item, entry]));

    const headerBg = byItem.get('viz_header_bg');
    if (headerBg) headerBg.position = { x: 20, y: 0, w: 1400, h: 88 };
    const headerIcon = byItem.get('viz_header_icon');
    if (headerIcon) headerIcon.position = { x: 36, y: 14, w: 56, h: 56 };
    const header = byItem.get('viz_header');
    if (header) header.position = { x: 108, y: 4, w: 1292, h: 76 };

    const withoutDesignElements = structure.filter(
        (entry) => !['viz_design_context', 'viz_design_section'].includes(entry.item)
    );
    const firstDataIndex = withoutDesignElements.findIndex(
        (entry) => !['viz_header_bg', 'viz_header_icon', 'viz_header'].includes(entry.item)
    );
    const insertAt = firstDataIndex < 0 ? withoutDesignElements.length : firstDataIndex;
    withoutDesignElements.splice(
        insertAt,
        0,
        {
            item: 'viz_design_context',
            position: { x: 20, y: 100, w: 1400, h: 64 },
            type: 'block',
        },
        {
            item: 'viz_design_section',
            position: { x: 20, y: 176, w: 1400, h: 54 },
            type: 'block',
        }
    );

    const reservedItems = new Set([
        'viz_header_bg',
        'viz_header_icon',
        'viz_header',
        'viz_design_context',
        'viz_design_section',
    ]);
    const dataEntries = withoutDesignElements.filter((entry) => !reservedItems.has(entry.item));
    const rowYs = [...new Set(dataEntries.map((entry) => entry.position.y))].sort(
        (left, right) => left - right
    );
    let nextY = 242;
    for (const rowY of rowYs) {
        const entries = dataEntries.filter((entry) => entry.position.y === rowY);
        const heights = entries.map((entry) => compactPanelHeight(entry, definition, entries.length));
        const rowHeight = Math.max(...heights);
        for (const entry of entries) {
            entry.position.y = nextY;
            entry.position.h = compactPanelHeight(entry, definition, entries.length);
        }
        nextY += rowHeight + 16;
    }

    layoutDefinition.structure = withoutDesignElements;
    layoutDefinition.options.height = Math.max(640, nextY + 4);
    layoutDefinition.options.backgroundColor = '#07101d';
}

function redesignDashboard(fileName, descriptions) {
    const copy = dashboardCopy[fileName];
    const filePath = path.join(viewsDir, fileName);
    const xml = fs.readFileSync(filePath, 'utf8');
    const cdataMatch = xml.match(/<definition><!\[CDATA\[\n([\s\S]*?)\n\s*]]><\/definition>/);
    if (!cdataMatch) throw new Error(`${fileName}: Dashboard Studio definition CDATA not found`);

    const definition = JSON.parse(cdataMatch[1]);
    replaceColors(definition);
    definition.description = copy.purpose;

    const headerBg = definition.visualizations.viz_header_bg;
    if (headerBg) {
        headerBg.options = {
            ...headerBg.options,
            fillColor: '#16283c',
            strokeColor: 'rgba(53,207,245,0.42)',
        };
    }
    const header = definition.visualizations.viz_header;
    if (header) {
        header.options = {
            ...header.options,
            backgroundColor: 'transparent',
            fontColor: '#e8f1fb',
            markdown: `# ${definition.title}\n${copy.purpose}`,
        };
    }

    definition.visualizations.viz_design_context = {
        type: 'splunk.markdown',
        title: '',
        showLastUpdated: false,
        showProgressBar: false,
        options: {
            backgroundColor: '#111f31',
            fontColor: '#e8f1fb',
            markdown:
                `**Audience:** ${copy.audience}  •  ` +
                `**Sources:** ${copy.sources}  •  ` +
                `**Reading guide:** ${copy.guidance}  •  ` +
                '**Freshness:** Uses the dashboard time range',
        },
    };
    definition.visualizations.viz_design_section = {
        type: 'splunk.markdown',
        title: '',
        showLastUpdated: false,
        showProgressBar: false,
        options: {
            backgroundColor: '#111f31',
            fontColor: '#e8f1fb',
            markdown: `### ${copy.section}\n${copy.guidance}`,
        },
    };

    const missingDescriptions = [];
    let describedPanels = 0;
    for (const [id, visualization] of Object.entries(definition.visualizations)) {
        if (!isDataVisualization(id, visualization)) continue;
        const resolved = descriptionForVisualization(definition, visualization, descriptions);
        if (!resolved.description) {
            missingDescriptions.push({ id, ref: resolved.ref });
            continue;
        }
        visualization.description = resolved.description;
        visualization.options = visualization.options ?? {};
        visualization.options.backgroundColor = '#0f1a2a';
        describedPanels += 1;
    }
    if (missingDescriptions.length > 0) {
        throw new Error(
            `${fileName}: missing Searchbase descriptions for ${JSON.stringify(missingDescriptions)}`
        );
    }

    for (const layoutDefinition of Object.values(definition.layout?.layoutDefinitions ?? {})) {
        redesignLayout(layoutDefinition, definition);
    }

    const serialized = JSON.stringify(definition, null, '\t');
    let updated = xml.replace(cdataMatch[0], `<definition><![CDATA[\n${serialized}\n    ]]></definition>`);
    updated = updated.replace(
        /<description>[\s\S]*?<\/description>/,
        `<description>${escapeXml(copy.purpose)}</description>`
    );

    if (writeChanges && updated !== xml) fs.writeFileSync(filePath, updated);
    return { fileName, describedPanels, changed: updated !== xml };
}

const descriptions = parseSearchbaseDescriptions(fs.readFileSync(searchbasePath, 'utf8'));
const results = Object.keys(dashboardCopy).sort().map((fileName) => {
    return redesignDashboard(fileName, descriptions);
});
const totalPanels = results.reduce((sum, result) => sum + result.describedPanels, 0);

if (results.length !== 16) throw new Error(`Expected 16 dashboards, found ${results.length}`);
if (totalPanels !== 131) throw new Error(`Expected 131 described panels, found ${totalPanels}`);

console.log(
    JSON.stringify(
        {
            mode: writeChanges ? 'write' : 'check',
            dashboards: results.length,
            describedPanels: totalPanels,
            changedFiles: results.filter((result) => result.changed).map((result) => result.fileName),
        },
        null,
        2
    )
);
