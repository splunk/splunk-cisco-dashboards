/**
 * ShapesTab — generic Cisco shape palette.
 *
 * Drag source for the diagram canvas's drop target. Each tile
 * encodes a `PaletteDragPayload` of variant `shape` (a generic
 * device archetype) or `region` (a labelled container). The
 * canvas's drop handler reads the payload from the HTML5 DnD
 * `dataTransfer` channel and spawns the appropriate React Flow
 * node.
 *
 * Why generic-shape tiles in addition to the inventory-row tiles
 * (in the sibling `InventoryTab`)? Two real authoring needs:
 *
 *   1. **Diagrammed boxes that aren't real devices** — the FDEM
 *      reference PDF includes "Internet", "Azure Cloud Services",
 *      "Web Servers / Email", "Remote Users". These are conceptual
 *      labels for things that don't (and shouldn't) appear in the
 *      asset_inventory feed.
 *
 *   2. **Region/site groupings** — labelled containers like
 *      "Tallahassee" or "Data Center" that organise devices
 *      visually. Always generic; never bound to an asset.
 *
 * Visual model: a 2-column grid of small icon+label tiles. Each
 * tile is a flex card with the inline Cisco SVG centered on top
 * of a short label. Hover lifts the shadow so the affordance
 * "this is grabbable" is obvious without arrow cursors.
 */

import React from 'react';
import { cn } from '@/common/lib/utils';
import { CISCO_ICONS } from '@/common/components/topology/ciscoIcons';
import type { DeviceShapeId } from '@/common/services/topologyDiscovery';
import { PALETTE_DND_MIME, type PaletteDragPayload } from './types';

// Build 115.5 — palette is split into named sections so the 42
// shapes don't dump as one long alphabetised list. The category
// labels double as section headings in the UI; spec order =
// render order. Sections expanded from 5 → 7 to fit the new
// shape additions (containerised compute, end-user / IoT, and
// physical "places" got their own headers because lumping them
// into the existing sections made the palette read like noise).
type ShapeCategory =
    | 'core'
    | 'security'
    | 'infrastructure'
    | 'storage'
    | 'enduser'
    | 'edge'
    | 'splunk'
    | 'places'
    | 'layout';

interface ShapeTileSpec {
    /** Tile identity. `region` and `textbox` are layout primitives
     *  (containers and free-placement annotations) rather than
     *  network device shapes; they don't have entries in
     *  `CISCO_ICONS` and the tile renderer paints a custom glyph
     *  for each. */
    id: DeviceShapeId | 'region' | 'textbox';
    label: string;
    description: string;
    category: ShapeCategory;
}

const SHAPE_TILES: ShapeTileSpec[] = [
    // Core network
    { id: 'router', label: 'Router', description: 'WAN edge / aggregation router', category: 'core' },
    { id: 'switch', label: 'L2 Switch', description: 'Access / distribution switch', category: 'core' },
    { id: 'l3_switch', label: 'L3 Switch', description: 'Core / distribution L3 switch', category: 'core' },
    { id: 'stack', label: 'Switch Stack', description: 'Catalyst stack of access switches', category: 'core' },
    { id: 'hub', label: 'Hub', description: 'Multi-port concentrator / patch panel', category: 'core' },
    { id: 'gateway', label: 'Gateway', description: 'SD-WAN / edge gateway', category: 'core' },
    { id: 'proxy', label: 'Proxy', description: 'Forward / reverse proxy', category: 'core' },
    { id: 'wlc', label: 'WLC', description: 'Wireless LAN Controller', category: 'core' },
    { id: 'access_point', label: 'Access Point', description: 'Wireless access point', category: 'core' },
    { id: 'load_balancer', label: 'Load Balancer', description: 'F5 BIG-IP / NetScaler / AWS ELB / Avi ADC', category: 'core' },
    // Security
    { id: 'firewall', label: 'Firewall', description: 'Perimeter / DC firewall (ASA / FTD)', category: 'security' },
    { id: 'waf', label: 'WAF', description: 'Web application firewall', category: 'security' },
    { id: 'vpn_concentrator', label: 'VPN', description: 'VPN concentrator / AnyConnect headend', category: 'security' },
    { id: 'ids_ips', label: 'IDS / IPS', description: 'Intrusion sensor / Stealthwatch', category: 'security' },
    { id: 'siem', label: 'SIEM', description: 'SIEM / SOC analytics', category: 'security' },
    { id: 'ca', label: 'CA', description: 'Certificate authority', category: 'security' },
    { id: 'bastion', label: 'Bastion', description: 'Bastion / jump host', category: 'security' },
    // Servers & infrastructure
    { id: 'server', label: 'Server', description: 'Generic application / endpoint host', category: 'infrastructure' },
    { id: 'web_server', label: 'Web Server', description: 'HTTP / web tier', category: 'infrastructure' },
    { id: 'app_server', label: 'App Server', description: 'Application tier', category: 'infrastructure' },
    { id: 'dns_server', label: 'DNS', description: 'DNS resolver / authoritative', category: 'infrastructure' },
    { id: 'dhcp_server', label: 'DHCP', description: 'DHCP server', category: 'infrastructure' },
    { id: 'mainframe', label: 'Mainframe', description: 'Mainframe / midrange host', category: 'infrastructure' },
    { id: 'container', label: 'Container', description: 'Docker container / Kubernetes pod', category: 'infrastructure' },
    { id: 'vm', label: 'VM', description: 'Virtual machine / hypervisor', category: 'infrastructure' },
    { id: 'database', label: 'Database', description: 'Relational / NoSQL datastore', category: 'infrastructure' },
    // Storage
    { id: 'storage', label: 'Storage', description: 'Generic disk array', category: 'storage' },
    { id: 'nas', label: 'NAS', description: 'Network-attached storage', category: 'storage' },
    { id: 'san', label: 'SAN', description: 'Storage area network', category: 'storage' },
    { id: 'backup', label: 'Backup', description: 'Backup / archive target', category: 'storage' },
    // End-user / IoT
    { id: 'laptop', label: 'Laptop', description: 'Workstation / laptop endpoint', category: 'enduser' },
    { id: 'mobile_phone', label: 'Mobile', description: 'Mobile phone / tablet', category: 'enduser' },
    { id: 'ip_phone', label: 'IP Phone', description: 'CUCM-registered IP phone / VoIP endpoint', category: 'enduser' },
    { id: 'printer', label: 'Printer', description: 'Network printer / MFP', category: 'enduser' },
    { id: 'camera', label: 'Camera', description: 'IP camera / surveillance', category: 'enduser' },
    { id: 'iot_sensor', label: 'IoT Sensor', description: 'IoT telemetry sensor', category: 'enduser' },
    // Edge & cloud
    { id: 'cloud', label: 'Cloud / WAN', description: 'MPLS, private cloud, abstract WAN', category: 'edge' },
    { id: 'internet', label: 'Internet', description: 'Public Internet boundary', category: 'edge' },
    // Build 115.2 — users / human population glyph (remote workers,
    // SOC analysts, end-user pools).
    { id: 'users', label: 'Users', description: 'Remote users, SOC analysts, end-user populations', category: 'edge' },
    // Splunk platform
    { id: 'splunk_search_head', label: 'Search Head', description: 'Splunk search head', category: 'splunk' },
    { id: 'splunk_search_head_cluster', label: 'SH Cluster', description: 'Splunk search head cluster', category: 'splunk' },
    { id: 'splunk_indexer', label: 'Indexer', description: 'Splunk indexer', category: 'splunk' },
    { id: 'splunk_indexer_cluster', label: 'Indexer Cluster', description: 'Splunk indexer cluster', category: 'splunk' },
    { id: 'splunk_heavy_forwarder', label: 'Heavy Forwarder', description: 'Splunk heavy forwarder', category: 'splunk' },
    { id: 'splunk_universal_forwarder', label: 'Universal Forwarder', description: 'Splunk universal forwarder', category: 'splunk' },
    { id: 'splunk_cluster_manager', label: 'Cluster Manager', description: 'Splunk cluster manager', category: 'splunk' },
    { id: 'splunk_deployer', label: 'SHC Deployer', description: 'Search head cluster deployer', category: 'splunk' },
    { id: 'splunk_license_manager', label: 'License Manager', description: 'Splunk license manager', category: 'splunk' },
    { id: 'splunk_monitoring_console', label: 'Monitoring Console', description: 'Splunk monitoring console', category: 'splunk' },
    { id: 'splunk_deployment_server', label: 'Deployment Server', description: 'Splunk deployment server', category: 'splunk' },
    { id: 'splunk_data_collection', label: 'Data Collection', description: 'Splunk data collection node', category: 'splunk' },
    { id: 'splunk_edge_processor', label: 'Edge Processor', description: 'Splunk Edge Processor', category: 'splunk' },
    { id: 'splunk_sc4s', label: 'SC4S', description: 'Splunk Connect for Syslog', category: 'splunk' },
    // Places
    { id: 'branch_office', label: 'Branch Office', description: 'Remote / branch site', category: 'places' },
    { id: 'datacenter', label: 'Data Center', description: 'On-prem / co-located data centre', category: 'places' },
    // Layout
    { id: 'region', label: 'Region / Site', description: 'Labelled container — group devices', category: 'layout' },
    // Build 115.1 — free-placement annotation. Drops a small text
    // node anywhere on the canvas with default styling.
    { id: 'textbox', label: 'Text Box', description: 'Caption, port label, or freeform annotation', category: 'layout' },
    { id: 'generic', label: 'Generic', description: 'Anything not in the icon set', category: 'layout' },
];

const CATEGORY_LABELS: Record<ShapeCategory, string> = {
    core: 'Core Network',
    security: 'Security',
    infrastructure: 'Servers & Infrastructure',
    storage: 'Storage',
    enduser: 'End-User & IoT',
    edge: 'Edge & Cloud',
    splunk: 'Splunk Architecture',
    places: 'Places',
    layout: 'Layout',
};

// Build 115 — friendly default labels so a freshly-dropped shape
// reads naturally on the canvas instead of "Vpn Concentrator" or
// "Ids Ips" (the literal id-with-spaces transform). Keep entries
// here only when the auto-generated label would look ugly.
const SHAPE_DEFAULT_LABEL_OVERRIDES: Partial<Record<DeviceShapeId, string>> = {
    l3_switch: 'L3 Switch',
    vpn_concentrator: 'VPN',
    ids_ips: 'IDS/IPS',
    ip_phone: 'IP Phone',
    load_balancer: 'Load Balancer',
    // Build 115.5 additions
    waf: 'WAF',
    ca: 'CA',
    web_server: 'Web Server',
    app_server: 'App Server',
    dns_server: 'DNS Server',
    dhcp_server: 'DHCP Server',
    nas: 'NAS',
    san: 'SAN',
    iot_sensor: 'IoT Sensor',
    mobile_phone: 'Mobile Phone',
    branch_office: 'Branch Office',
    datacenter: 'Data Center',
    siem: 'SIEM',
    splunk_search_head: 'Search Head',
    splunk_search_head_cluster: 'Search Head Cluster',
    splunk_indexer: 'Indexer',
    splunk_indexer_cluster: 'Indexer Cluster',
    splunk_heavy_forwarder: 'Heavy Forwarder',
    splunk_universal_forwarder: 'Universal Forwarder',
    splunk_cluster_manager: 'Cluster Manager',
    splunk_deployer: 'SHC Deployer',
    splunk_license_manager: 'License Manager',
    splunk_monitoring_console: 'Monitoring Console',
    splunk_deployment_server: 'Deployment Server',
    splunk_data_collection: 'Data Collection',
    splunk_edge_processor: 'Edge Processor',
    splunk_sc4s: 'SC4S',
};

const tilePayload = (
    id: DeviceShapeId | 'region' | 'textbox'
): PaletteDragPayload => {
    if (id === 'region') {
        return {
            variant: 'region',
            defaultLabel: 'New Region',
            defaultWidth: 360,
            defaultHeight: 220,
        };
    }
    if (id === 'textbox') {
        // Empty default text — the textbox renders a "Click to edit
        // text" placeholder until the operator types something via
        // the inspector. Avoids "New text" appearing in finished
        // diagrams when the operator forgets to edit.
        return { variant: 'textbox', defaultText: '' };
    }
    const override = SHAPE_DEFAULT_LABEL_OVERRIDES[id];
    return {
        variant: 'shape',
        shape: id,
        defaultLabel:
            override ??
            id.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()),
    };
};

const ShapeTile: React.FC<ShapeTileSpec> = ({ id, label, description }) => {
    // `region` and `textbox` are not in `CISCO_ICONS` — they paint
    // their own custom glyph below (a dashed rect for region, an
    // "T" for textbox). Everything else looks up the Cisco SVG.
    const Icon =
        id === 'region' || id === 'textbox' ? null : CISCO_ICONS[id];
    const handleDragStart = (e: React.DragEvent<HTMLDivElement>): void => {
        const payload = tilePayload(id);
        e.dataTransfer.setData(PALETTE_DND_MIME, JSON.stringify(payload));
        // The text/plain payload is a best-effort fallback for
        // operating systems where the custom mime is dropped — at
        // worst the canvas treats it as a generic drop with the
        // shape name visible. The canvas drop handler still
        // requires the custom mime to spawn a node, so this is
        // purely a debug nicety, not a security surface.
        e.dataTransfer.setData('text/plain', `${label}`);
        e.dataTransfer.effectAllowed = 'copy';
    };

    return (
        <div
            draggable
            onDragStart={handleDragStart}
            role="button"
            tabIndex={0}
            aria-label={`Drag ${label} to canvas`}
            title={description}
            className={cn(
                'group flex flex-col items-center justify-center gap-1 p-2 rounded-lg cursor-grab active:cursor-grabbing select-none',
                'border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900',
                'hover:border-sky-400 hover:shadow-md hover:bg-sky-50/50 dark:hover:bg-sky-950/30',
                'transition-all duration-150'
            )}
        >
            <div className="w-10 h-10 flex items-center justify-center text-slate-700 dark:text-slate-300 group-hover:text-sky-600 dark:group-hover:text-sky-400">
                {Icon ? (
                    <Icon className="w-9 h-9" />
                ) : id === 'textbox' ? (
                    // A typographic "T" reads as "text" at a glance,
                    // matching the affordance of design-tool text
                    // tools (Figma, Sketch, Visio).
                    <div className="w-9 h-7 rounded border border-slate-300 dark:border-slate-600 flex items-center justify-center text-[14px] font-serif font-semibold text-slate-500 dark:text-slate-400">
                        T
                    </div>
                ) : (
                    <div className="w-9 h-7 rounded border-2 border-dashed border-slate-400 dark:border-slate-500 flex items-center justify-center text-[8px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        Region
                    </div>
                )}
            </div>
            <div className="text-[10px] font-medium text-slate-700 dark:text-slate-200 text-center leading-tight">
                {label}
            </div>
        </div>
    );
};

export const ShapesTab: React.FC = () => {
    // Build 115 — group tiles by category so the 18-shape palette
    // stays scannable. We compute groups inline rather than
    // pre-bucketing because the spec order in `SHAPE_TILES` is
    // the canonical render order — moving things around in code
    // moves them in the UI without a second source of truth.
    // Build 115.5 — section render order. Matches the
    // `ShapeCategory` union order and the section list documented
    // in `CATEGORY_LABELS`.
    const ordered: ShapeCategory[] = [
        'core',
        'security',
        'infrastructure',
        'storage',
        'enduser',
        'edge',
        'splunk',
        'places',
        'layout',
    ];
    const grouped = new Map<ShapeCategory, ShapeTileSpec[]>();
    for (const tile of SHAPE_TILES) {
        const bucket = grouped.get(tile.category) ?? [];
        bucket.push(tile);
        grouped.set(tile.category, bucket);
    }
    return (
        <div className="flex flex-col gap-3 p-3">
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                Drag any shape onto the canvas. Use{' '}
                <span className="font-medium text-slate-700 dark:text-slate-200">
                    Region / Site
                </span>{' '}
                to draw a labelled container, then drop devices inside it.
            </p>
            {ordered.map((cat) => {
                const tiles = grouped.get(cat);
                if (!tiles || tiles.length === 0) return null;
                return (
                    <div key={cat} className="flex flex-col gap-1.5">
                        <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-0.5">
                            {CATEGORY_LABELS[cat]}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {tiles.map((s) => (
                                <ShapeTile key={s.id} {...s} />
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
