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
 *   1. **Diagrammed boxes that aren't real devices** — a customer's
 *      reference diagram can include things like "Internet", "Azure
 *      Cloud Services", "Web Servers / Email", "Remote Users". These
 *      are conceptual labels for things that don't (and shouldn't)
 *      appear in the asset_inventory feed.
 *
 *   2. **Region/site groupings** — labelled containers like
 *      "Site A" or "Data Center" that organise devices
 *      visually. Always generic; never bound to an asset.
 *
 * Visual model: a 2-column grid of small icon+label tiles. Each
 * tile is a flex card with the inline Cisco SVG centered on top
 * of a short label. Hover lifts the shadow so the affordance
 * "this is grabbable" is obvious without arrow cursors.
 */

import React, { useMemo, useRef, useState } from 'react';
import { ChevronRight, ExternalLink, Search, Trash2, Upload, X } from 'lucide-react';
import { strFromU8, unzipSync } from 'fflate';
import { cn } from '@/common/lib/utils';
import { CISCO_ICONS } from '@/common/components/topology/ciscoIcons';
import type { DeviceShapeId } from '@/common/services/topologyDiscovery';
import type { CustomStencilAsset } from '@/common/services/diagramPersistenceService';
import {
    PALETTE_DND_MIME,
    nodeSizeForCustomStencil,
    type PaletteDragPayload,
} from './types';

// Build 115.5 — palette is split into named sections so the 42
// shapes don't dump as one long alphabetised list. The category
// labels double as section headings in the UI; spec order =
// render order. Sections expanded from 5 → 7 to fit the new
// shape additions (containerised compute, end-user / IoT, and
// physical "places" got their own headers because lumping them
// into the existing sections made the palette read like noise).
type ShapeCategory =
    | 'core'
    | 'advanced'
    | 'security'
    | 'infrastructure'
    | 'storage'
    | 'enduser'
    | 'edge'
    | 'splunk'
    | 'places'
    | 'cisco'
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
    // Advanced / vendor-specific
    { id: 'modular_chassis_switch', label: 'Modular Chassis', description: 'Catalyst 4500/6500 modular chassis switch', category: 'advanced' },
    { id: 'nexus_aci_fabric', label: 'Nexus / ACI', description: 'Cisco Nexus / ACI fabric', category: 'advanced' },
    { id: 'sdwan_controller', label: 'SD-WAN Controller', description: 'Cisco SD-WAN control plane / vManage', category: 'advanced' },
    { id: 'f5_load_balancer', label: 'F5 Load Balancer', description: 'F5 BIG-IP / LTM / GTM load balancer', category: 'advanced' },
    // Security
    { id: 'firewall', label: 'Firewall', description: 'Perimeter / DC firewall (ASA / FTD)', category: 'security' },
    { id: 'palo_alto_firewall', label: 'Palo Alto FW', description: 'Palo Alto Networks firewall', category: 'security' },
    { id: 'fortinet_firewall', label: 'Fortinet FW', description: 'Fortinet FortiGate firewall', category: 'security' },
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
    { id: 'splunk_intermediate_forwarder', label: 'Intermediate Forwarder', description: 'Splunk intermediate forwarder', category: 'splunk' },
    { id: 'splunk_cluster_manager', label: 'Cluster Manager', description: 'Splunk cluster manager', category: 'splunk' },
    { id: 'splunk_deployer', label: 'SHC Deployer', description: 'Search head cluster deployer', category: 'splunk' },
    { id: 'splunk_license_manager', label: 'License Manager', description: 'Splunk license manager', category: 'splunk' },
    { id: 'splunk_monitoring_console', label: 'Monitoring Console', description: 'Splunk monitoring console', category: 'splunk' },
    { id: 'splunk_deployment_server', label: 'Deployment Server', description: 'Splunk deployment server', category: 'splunk' },
    { id: 'splunk_sc4s', label: 'SC4S', description: 'Splunk Connect for Syslog', category: 'splunk' },
    // Places
    { id: 'branch_office', label: 'Branch Office', description: 'Remote / branch site', category: 'places' },
    { id: 'datacenter', label: 'Data Center', description: 'On-prem / co-located data centre', category: 'places' },
    // Official Cisco icons
    { id: 'cisco_router', label: 'Cisco Router', description: 'Official Cisco router icon', category: 'cisco' },
    { id: 'cisco_switch', label: 'Cisco Switch', description: 'Official Cisco switch icon', category: 'cisco' },
    { id: 'cisco_l3_switch', label: 'Cisco L3 Switch', description: 'Official Cisco layer 3 switch icon', category: 'cisco' },
    { id: 'cisco_stack', label: 'Cisco Chassis', description: 'Official Cisco chassis / stack icon', category: 'cisco' },
    { id: 'cisco_wlc', label: 'Cisco WLC', description: 'Official Cisco wireless controller icon', category: 'cisco' },
    { id: 'cisco_access_point', label: 'Cisco AP', description: 'Official Cisco wireless access icon', category: 'cisco' },
    { id: 'cisco_firewall', label: 'Cisco Firewall', description: 'Official Cisco firewall icon', category: 'cisco' },
    { id: 'cisco_server', label: 'Cisco Server', description: 'Official Cisco server icon', category: 'cisco' },
    { id: 'cisco_cloud', label: 'Cisco Cloud', description: 'Official Cisco cloud icon', category: 'cisco' },
    { id: 'cisco_data_center', label: 'Cisco Data Center', description: 'Official Cisco data center icon', category: 'cisco' },
    // Layout
    { id: 'region', label: 'Region / Site', description: 'Labelled container — group devices', category: 'layout' },
    // Build 115.1 — free-placement annotation. Drops a small text
    // node anywhere on the canvas with default styling.
    { id: 'textbox', label: 'Text Box', description: 'Caption, port label, or freeform annotation', category: 'layout' },
    { id: 'generic', label: 'Generic', description: 'Anything not in the icon set', category: 'layout' },
];

const CATEGORY_LABELS: Record<ShapeCategory, string> = {
    core: 'Core Network',
    advanced: 'Advanced Network',
    security: 'Security',
    infrastructure: 'Servers & Infrastructure',
    storage: 'Storage',
    enduser: 'End-User & IoT',
    edge: 'Edge & Cloud',
    splunk: 'Splunk Architecture',
    places: 'Places',
    cisco: 'Cisco',
    layout: 'Layout',
};

const SHAPE_SEARCH_ALIASES: Partial<
    Record<ShapeTileSpec['id'], string[]>
> = {
    l3_switch: ['layer 3', 'core switch', 'routing switch'],
    switch: ['l2', 'layer 2', 'access switch'],
    stack: ['switch stack', 'stackwise'],
    modular_chassis_switch: ['modular', 'chassis', '6500', '6504', '4500', '4507', 'supervisor', 'line card'],
    nexus_aci_fabric: ['nexus', 'aci', 'apic', 'fabric', 'leaf spine', 'spine leaf'],
    sdwan_controller: ['sdwan', 'sd-wan', 'vmanage', 'vsmart', 'vbond', 'controller'],
    wlc: ['wireless controller', 'wireless lan controller'],
    access_point: ['ap', 'wireless'],
    load_balancer: ['lb', 'vip', 'elastic load balancer', 'hec endpoint'],
    f5_load_balancer: ['f5', 'big-ip', 'bigip', 'ltm', 'gtm', 'vip', 'lb'],
    vpn_concentrator: ['vpn', 'anyconnect'],
    palo_alto_firewall: ['pa', 'palo', 'pan-os', 'panorama'],
    fortinet_firewall: ['fortinet', 'fortigate', 'fortigate firewall', 'fg'],
    ids_ips: ['ids', 'ips', 'intrusion'],
    web_server: ['web', 'http', 'https'],
    app_server: ['app', 'application'],
    dns_server: ['dns'],
    dhcp_server: ['dhcp'],
    ip_phone: ['phone', 'voice', 'voip'],
    iot_sensor: ['iot', 'sensor'],
    branch_office: ['branch', 'office', 'site'],
    datacenter: ['data center', 'dc'],
    cisco_router: ['official', 'cisco', 'router'],
    cisco_switch: ['official', 'cisco', 'switch', 'l2'],
    cisco_l3_switch: ['official', 'cisco', 'layer 3', 'core switch'],
    cisco_stack: ['official', 'cisco', 'chassis', 'stack'],
    cisco_wlc: ['official', 'cisco', 'wireless controller'],
    cisco_access_point: ['official', 'cisco', 'ap', 'wireless', 'wifi'],
    cisco_firewall: ['official', 'cisco', 'firewall', 'asa', 'ftd'],
    cisco_server: ['official', 'cisco', 'server', 'ucs'],
    cisco_cloud: ['official', 'cisco', 'cloud'],
    cisco_data_center: ['official', 'cisco', 'data center', 'dc'],
    splunk_search_head: ['sh', 'search', 'hybrid search head'],
    splunk_search_head_cluster: ['shc', 'search head cluster'],
    splunk_indexer: ['idx', 'indexer'],
    splunk_indexer_cluster: ['idxc', 'indexer cluster', 'index cluster'],
    splunk_heavy_forwarder: ['hf', 'hwf', 'heavy'],
    splunk_universal_forwarder: ['uf', 'forwarder'],
    splunk_intermediate_forwarder: ['if', 'intermediate', 'intermediary'],
    splunk_cluster_manager: ['cm', 'cluster master'],
    splunk_deployer: ['shc-d', 'shcd', 'deployer'],
    splunk_license_manager: ['lm', 'license'],
    splunk_monitoring_console: ['mc', 'monitoring'],
    splunk_deployment_server: ['ds', 'deployment', 'agent management'],
    splunk_data_collection: ['dcn', 'idm', 'inputs data manager', 'collection'],
    splunk_edge_processor: ['edge processor', 'ingest processor'],
    splunk_sc4s: ['sc4s', 'connect for syslog', 'syslog'],
    region: ['site', 'container', 'group'],
    textbox: ['text', 'label', 'annotation', 'caption'],
};

const CUSTOM_STENCIL_STORAGE_KEY = 'scd.networkDiagram.customStencils.v1';
const CUSTOM_STENCIL_IMPORT_LIMIT = 120;
const CUSTOM_STENCIL_BYTE_BUDGET = 4_000_000;
const VISIO_PACKAGE_PATTERN = /\.(vssx|vsdx|vstx)$/i;
const LEGACY_VISIO_PATTERN = /\.(vss|vsd|vst)$/i;
const SUPPORTED_STENCIL_IMAGE_PATTERN = /\.(svg|png)$/i;
const UNSUPPORTED_VISIO_IMAGE_PATTERN = /\.(emf|wmf)$/i;
const MAX_NESTED_VISIO_PACKAGES = 12;
const CISCO_VISIO_STENCIL_LIBRARY_URL =
    'https://www.cisco.com/c/en/us/products/visio-stencil-listing.html';

const normalizeSearch = (value: string): string =>
    value.trim().replace(/\s+/g, ' ').toLowerCase();

const loadCustomStencils = (): CustomStencilAsset[] => {
    if (typeof window === 'undefined') return [];
    try {
        const raw = window.localStorage.getItem(CUSTOM_STENCIL_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as CustomStencilAsset[];
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(
            (asset) =>
                asset &&
                typeof asset.id === 'string' &&
                typeof asset.label === 'string' &&
                typeof asset.src === 'string' &&
                (asset.mediaType === 'image/svg+xml' ||
                    asset.mediaType === 'image/png')
        );
    } catch {
        return [];
    }
};

const saveCustomStencils = (assets: CustomStencilAsset[]): boolean => {
    if (typeof window === 'undefined') return false;
    try {
        window.localStorage.setItem(
            CUSTOM_STENCIL_STORAGE_KEY,
            JSON.stringify(assets)
        );
        return true;
    } catch {
        return false;
    }
};

const slugify = (value: string): string =>
    value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48) || 'stencil';

const hashString = (value: string): string => {
    let hash = 5381;
    for (let i = 0; i < value.length; i += 1) {
        hash = (hash * 33) ^ value.charCodeAt(i);
    }
    return (hash >>> 0).toString(36);
};

const bytesToBase64 = (bytes: Uint8Array): string => {
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.slice(i, i + chunkSize));
    }
    return btoa(binary);
};

const dataUrlFor = (
    bytes: Uint8Array,
    mediaType: CustomStencilAsset['mediaType']
): string => `data:${mediaType};base64,${bytesToBase64(bytes)}`;

const stencilImageMediaType = (
    fileName: string,
    declaredType?: string
): CustomStencilAsset['mediaType'] | undefined => {
    const lower = fileName.toLowerCase();
    if (lower.endsWith('.svg') || declaredType === 'image/svg+xml') {
        return 'image/svg+xml';
    }
    if (lower.endsWith('.png') || declaredType === 'image/png') {
        return 'image/png';
    }
    return undefined;
};

const cleanStencilLabel = (path: string): string => {
    const name = path.split('/').pop() ?? path;
    return name
        .replace(/\.[^.]+$/, '')
        .replace(/^\d+\s*-\s*/, '')
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
};

const normalizeZipPath = (path: string): string =>
    path.replace(/\\/g, '/').replace(/^\/+/, '');

const joinZipPath = (prefix: string, path: string): string =>
    [prefix, normalizeZipPath(path)].filter(Boolean).join('/');

const attrValue = (tag: string, name: string): string | undefined => {
    const match = tag.match(new RegExp(`${name}=(["'])(.*?)\\1`));
    return match?.[2];
};

const resolveZipTarget = (sourcePath: string, target: string): string => {
    const parts = normalizeZipPath(sourcePath).split('/').slice(0, -1);
    for (const part of normalizeZipPath(target).split('/')) {
        if (!part || part === '.') continue;
        if (part === '..') {
            parts.pop();
        } else {
            parts.push(part);
        }
    }
    return parts.join('/');
};

const visioImageLabels = (entries: Record<string, Uint8Array>): Map<string, string> => {
    const masters = entries['visio/masters/masters.xml'];
    const masterRels = entries['visio/masters/_rels/masters.xml.rels'];
    if (!masters || !masterRels) return new Map();

    const masterLabels = Array.from(
        strFromU8(masters).matchAll(/<Master\b[^>]*>/g)
    )
        .map((match) => {
            const tag = match[0];
            return attrValue(tag, 'Name') ?? attrValue(tag, 'NameU') ?? '';
        })
        .filter((label) => label.trim().length > 0);

    const masterFiles = Array.from(
        strFromU8(masterRels).matchAll(/<Relationship\b[^>]*>/g)
    )
        .map((match) => attrValue(match[0], 'Target') ?? '')
        .filter((target) => target.toLowerCase().endsWith('.xml'));

    const labels = new Map<string, string>();
    masterFiles.forEach((target, index) => {
        const label = masterLabels[index];
        if (!label) return;
        const masterPath = joinZipPath('visio/masters', target);
        const relPath = joinZipPath(
            'visio/masters/_rels',
            target.replace(/\.xml$/i, '.xml.rels')
        );
        const rels = entries[relPath];
        if (!rels) return;
        const imageRel = Array.from(
            strFromU8(rels).matchAll(/<Relationship\b[^>]*>/g)
        )
            .map((match) => attrValue(match[0], 'Target') ?? '')
            .find((imageTarget) => /\.(svg|png|emf|wmf)$/i.test(imageTarget));
        if (!imageRel) return;
        labels.set(resolveZipTarget(masterPath, imageRel), label);
    });
    return labels;
};

const parseCsv = (text: string): Array<Record<string, string>> => {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let quoted = false;
    for (let i = 0; i < text.length; i += 1) {
        const ch = text[i];
        if (quoted) {
            if (ch === '"' && text[i + 1] === '"') {
                cell += '"';
                i += 1;
            } else if (ch === '"') {
                quoted = false;
            } else {
                cell += ch;
            }
            continue;
        }
        if (ch === '"') {
            quoted = true;
        } else if (ch === ',') {
            row.push(cell);
            cell = '';
        } else if (ch === '\n') {
            row.push(cell);
            rows.push(row);
            row = [];
            cell = '';
        } else if (ch !== '\r') {
            cell += ch;
        }
    }
    if (cell || row.length) {
        row.push(cell);
        rows.push(row);
    }
    const [headers, ...body] = rows;
    if (!headers) return [];
    return body
        .filter((r) => r.some((v) => v.trim().length > 0))
        .map((r) =>
            Object.fromEntries(
                headers.map((h, index) => [h.trim(), (r[index] ?? '').trim()])
            )
        );
};

const svgDimensions = (
    bytes: Uint8Array
): Pick<CustomStencilAsset, 'width' | 'height'> => {
    const text = strFromU8(bytes);
    const numberFromAttr = (name: string): number | undefined => {
        const match = text.match(new RegExp(`${name}="([0-9.]+)`));
        return match ? Number(match[1]) : undefined;
    };
    const width = numberFromAttr('width');
    const height = numberFromAttr('height');
    if (width && height) return { width, height };
    const viewBox = text.match(/viewBox="([^"]+)"/);
    if (!viewBox) return {};
    const parts = viewBox[1].trim().split(/\s+/).map(Number);
    if (parts.length !== 4) return {};
    return {
        width: Number.isFinite(parts[2]) ? parts[2] : undefined,
        height: Number.isFinite(parts[3]) ? parts[3] : undefined,
    };
};

const pngDimensions = (
    bytes: Uint8Array
): Pick<CustomStencilAsset, 'width' | 'height'> => {
    if (
        bytes.length < 24 ||
        bytes[0] !== 0x89 ||
        bytes[1] !== 0x50 ||
        bytes[2] !== 0x4e ||
        bytes[3] !== 0x47
    ) {
        return {};
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return {
        width: view.getUint32(16),
        height: view.getUint32(20),
    };
};

interface ImportedStencilResult {
    assets: CustomStencilAsset[];
    skipped: number;
    containsVisioStencil: boolean;
    containsUnsupportedVisioMedia: boolean;
    failedVisioPackages: number;
}

interface StencilImportInventory {
    entries: Map<string, { bytes: Uint8Array; label?: string }>;
    containsVisioStencil: boolean;
    containsUnsupportedVisioMedia: boolean;
    failedVisioPackages: number;
    nestedVisioPackages: number;
}

const collectStencilEntries = (
    entries: Record<string, Uint8Array>,
    prefix = '',
    inventory: StencilImportInventory = {
        entries: new Map(),
        containsVisioStencil: false,
        containsUnsupportedVisioMedia: false,
        failedVisioPackages: 0,
        nestedVisioPackages: 0,
    }
): StencilImportInventory => {
    const labelByPath = visioImageLabels(entries);
    if (labelByPath.size > 0) {
        inventory.containsVisioStencil = true;
    }

    for (const [rawPath, file] of Object.entries(entries)) {
        const path = normalizeZipPath(rawPath);
        const nestedPath = joinZipPath(prefix, path);
        const lower = path.toLowerCase();

        if (LEGACY_VISIO_PATTERN.test(lower)) {
            inventory.containsVisioStencil = true;
            continue;
        }

        if (VISIO_PACKAGE_PATTERN.test(lower)) {
            inventory.containsVisioStencil = true;
            if (inventory.nestedVisioPackages >= MAX_NESTED_VISIO_PACKAGES) {
                inventory.failedVisioPackages += 1;
                continue;
            }
            try {
                inventory.nestedVisioPackages += 1;
                collectStencilEntries(unzipSync(file), nestedPath, inventory);
            } catch {
                inventory.failedVisioPackages += 1;
            }
            continue;
        }

        if (UNSUPPORTED_VISIO_IMAGE_PATTERN.test(lower)) {
            inventory.containsUnsupportedVisioMedia = true;
        }

        inventory.entries.set(nestedPath, {
            bytes: file,
            label: labelByPath.get(path),
        });
    }

    return inventory;
};

const importCustomStencilsFromZip = (
    bytes: Uint8Array
): ImportedStencilResult => {
    const inventory = collectStencilEntries(unzipSync(bytes));
    const entries = inventory.entries;
    const entryPaths = Array.from(entries.keys());
    const byLowerPath = new Map<string, string>();
    entryPaths.forEach((path) => byLowerPath.set(path.toLowerCase(), path));
    const manifestPath = byLowerPath.get('manifest.csv');
    const candidates: Array<{ path: string; label: string }> = [];

    if (manifestPath) {
        const manifest = entries.get(manifestPath);
        const rows = manifest ? parseCsv(strFromU8(manifest.bytes)) : [];
        for (const row of rows) {
            const label = row.name || cleanStencilLabel(row.svg || row.png || '');
            const svgPath = row.svg ? `svg/${row.svg}` : '';
            const pngPath = row.svg
                ? `png/${row.svg.replace(/\.svg$/i, '.png')}`
                : row.png
                  ? `png/${row.png}`
                  : '';
            const chosen =
                byLowerPath.get(pngPath.toLowerCase()) ??
                byLowerPath.get(svgPath.toLowerCase());
            if (chosen) candidates.push({ path: chosen, label });
        }
    }

    if (candidates.length === 0) {
        const grouped = new Map<string, { png?: string; svg?: string; label: string }>();
        for (const path of entryPaths) {
            const lower = path.toLowerCase();
            if (!SUPPORTED_STENCIL_IMAGE_PATTERN.test(lower)) continue;
            const label = entries.get(path)?.label ?? cleanStencilLabel(path);
            const key = slugify(label);
            const current = grouped.get(key) ?? { label };
            if (lower.endsWith('.png')) current.png = path;
            if (lower.endsWith('.svg')) current.svg = path;
            grouped.set(key, current);
        }
        for (const group of grouped.values()) {
            candidates.push({ path: group.png ?? group.svg ?? '', label: group.label });
        }
    }

    const assets: CustomStencilAsset[] = [];
    let totalBytes = 0;
    let skipped = 0;
    for (const candidate of candidates) {
        if (!candidate.path || assets.length >= CUSTOM_STENCIL_IMPORT_LIMIT) {
            skipped += 1;
            continue;
        }
        const file = entries.get(candidate.path)?.bytes;
        if (!file) continue;
        const lower = candidate.path.toLowerCase();
        const mediaType: CustomStencilAsset['mediaType'] = lower.endsWith('.svg')
            ? 'image/svg+xml'
            : 'image/png';
        const src = dataUrlFor(file, mediaType);
        if (totalBytes + src.length > CUSTOM_STENCIL_BYTE_BUDGET) {
            skipped += 1;
            continue;
        }
        totalBytes += src.length;
        const dimensions =
            mediaType === 'image/svg+xml' ? svgDimensions(file) : pngDimensions(file);
        assets.push({
            id: `custom-${slugify(candidate.label)}-${hashString(
                `${candidate.path}:${file.length}`
            )}`,
            label: candidate.label || cleanStencilLabel(candidate.path),
            src,
            mediaType,
            ...dimensions,
        });
    }
    return {
        assets,
        skipped,
        containsVisioStencil: inventory.containsVisioStencil,
        containsUnsupportedVisioMedia: inventory.containsUnsupportedVisioMedia,
        failedVisioPackages: inventory.failedVisioPackages,
    };
};

const importCustomStencilImage = (
    bytes: Uint8Array,
    fileName: string,
    mediaType: CustomStencilAsset['mediaType']
): ImportedStencilResult => {
    const label = cleanStencilLabel(fileName);
    const src = dataUrlFor(bytes, mediaType);
    const dimensions =
        mediaType === 'image/svg+xml' ? svgDimensions(bytes) : pngDimensions(bytes);

    return {
        assets:
            src.length > CUSTOM_STENCIL_BYTE_BUDGET
                ? []
                : [
                      {
                          id: `custom-${slugify(label)}-${hashString(
                              `${fileName}:${bytes.length}`
                          )}`,
                          label,
                          src,
                          mediaType,
                          ...dimensions,
                      },
                  ],
        skipped: src.length > CUSTOM_STENCIL_BYTE_BUDGET ? 1 : 0,
        containsVisioStencil: false,
        containsUnsupportedVisioMedia: false,
        failedVisioPackages: 0,
    };
};

const importFailureMessage = (result: ImportedStencilResult): string => {
    if (result.containsUnsupportedVisioMedia) {
        return [
            'That Visio ZIP only exposes EMF/WMF artwork, which the browser',
            'cannot render. Export SVG/PNG first, then import that ZIP.',
        ].join(' ');
    }
    if (result.failedVisioPackages) {
        return 'Could not unpack the nested Visio stencil package in that ZIP.';
    }
    if (result.containsVisioStencil) {
        return [
            'That Visio ZIP did not include SVG/PNG artwork.',
            'Export SVG/PNG first, then import that ZIP.',
        ].join(' ');
    }
    return 'No SVG or PNG stencils found in that zip.';
};

const importSuccessMessage = (
    result: ImportedStencilResult,
    stored: boolean
): string =>
    `${result.assets.length} imported${
        result.skipped ? `, ${result.skipped} skipped` : ''
    }${
        result.containsUnsupportedVisioMedia ? ', EMF/WMF artwork skipped' : ''
    }${stored ? '' : ' (not saved; browser storage is full)'}`;

const customStencilMatchesQuery = (
    asset: CustomStencilAsset,
    query: string
): boolean => {
    if (!query) return true;
    const haystack = `${asset.id} ${asset.label} custom imported stencil`.toLowerCase();
    return query.split(' ').every((term) => haystack.includes(term));
};

const tileMatchesQuery = (tile: ShapeTileSpec, query: string): boolean => {
    if (!query) return true;
    const terms = query.split(' ');
    const haystack = [
        tile.id,
        tile.label,
        tile.description,
        CATEGORY_LABELS[tile.category],
        ...(SHAPE_SEARCH_ALIASES[tile.id] ?? []),
    ]
        .join(' ')
        .toLowerCase();
    return terms.every((term) => haystack.includes(term));
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
    f5_load_balancer: 'F5 Load Balancer',
    modular_chassis_switch: 'Modular Chassis',
    nexus_aci_fabric: 'Nexus / ACI Fabric',
    sdwan_controller: 'SD-WAN Controller',
    palo_alto_firewall: 'Palo Alto Firewall',
    fortinet_firewall: 'Fortinet Firewall',
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
    splunk_intermediate_forwarder: 'Intermediate Forwarder',
    splunk_cluster_manager: 'Cluster Manager',
    splunk_deployer: 'SHC Deployer',
    splunk_license_manager: 'License Manager',
    splunk_monitoring_console: 'Monitoring Console',
    splunk_deployment_server: 'Deployment Server',
    splunk_data_collection: 'Data Collection',
    splunk_edge_processor: 'Edge Processor',
    splunk_sc4s: 'SC4S',
    cisco_router: 'Cisco Router',
    cisco_switch: 'Cisco Switch',
    cisco_l3_switch: 'Cisco L3 Switch',
    cisco_stack: 'Cisco Chassis',
    cisco_wlc: 'Cisco WLC',
    cisco_access_point: 'Cisco AP',
    cisco_firewall: 'Cisco Firewall',
    cisco_server: 'Cisco Server',
    cisco_cloud: 'Cisco Cloud',
    cisco_data_center: 'Cisco Data Center',
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
            <div
                className={cn(
                    'flex items-center justify-center text-slate-700 dark:text-slate-300 group-hover:text-sky-600 dark:group-hover:text-sky-400',
                    'w-10 h-10'
                )}
            >
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

const CustomStencilTile: React.FC<{ asset: CustomStencilAsset }> = ({ asset }) => {
    const size = nodeSizeForCustomStencil(asset);
    const isWide = size.width / size.height >= 2.5;
    const handleDragStart = (e: React.DragEvent<HTMLDivElement>): void => {
        const payload: PaletteDragPayload = {
            variant: 'customStencil',
            asset,
        };
        e.dataTransfer.setData(PALETTE_DND_MIME, JSON.stringify(payload));
        e.dataTransfer.setData('text/plain', asset.label);
        e.dataTransfer.effectAllowed = 'copy';
    };

    return (
        <div
            draggable
            onDragStart={handleDragStart}
            role="button"
            tabIndex={0}
            aria-label={`Drag ${asset.label} to canvas`}
            title={asset.label}
            className={cn(
                'group flex flex-col items-center justify-center gap-1 p-2 rounded-lg cursor-grab active:cursor-grabbing select-none',
                'border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900',
                'hover:border-sky-400 hover:shadow-md hover:bg-sky-50/50 dark:hover:bg-sky-950/30',
                'transition-all duration-150'
            )}
        >
            <div
                className={cn(
                    'flex items-center justify-center text-slate-700 dark:text-slate-300 group-hover:text-sky-600 dark:group-hover:text-sky-400',
                    isWide ? 'h-10 w-full px-1' : 'w-10 h-10'
                )}
            >
                <img
                    src={asset.src}
                    alt=""
                    className={cn(
                        'block object-contain',
                        isWide ? 'h-9 w-full' : 'h-9 w-9'
                    )}
                    draggable={false}
                />
            </div>
            <div className="text-[10px] font-medium text-slate-700 dark:text-slate-200 text-center leading-tight">
                {asset.label}
            </div>
        </div>
    );
};

interface CategoryDrawerProps {
    label: string;
    count: number;
    open: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}

const CategoryDrawer: React.FC<CategoryDrawerProps> = ({
    label,
    count,
    open,
    onToggle,
    children,
}) => (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/70">
        <button
            type="button"
            aria-expanded={open}
            onClick={onToggle}
            className={cn(
                'flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left',
                'text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400',
                'hover:bg-slate-50 hover:text-sky-700 dark:hover:bg-slate-800/70 dark:hover:text-sky-300'
            )}
        >
            <span className="flex min-w-0 items-center gap-1.5">
                <ChevronRight
                    className={cn(
                        'h-3.5 w-3.5 flex-shrink-0 transition-transform duration-150',
                        open && 'rotate-90'
                    )}
                />
                <span className="truncate">{label}</span>
            </span>
            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                {count}
            </span>
        </button>
        {open ? (
            <div className="grid grid-cols-2 gap-2 border-t border-slate-100 p-2 dark:border-slate-800">
                {children}
            </div>
        ) : null}
    </div>
);

export const ShapesTab: React.FC = () => {
    const [query, setQuery] = useState('');
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [customStencils, setCustomStencils] =
        useState<CustomStencilAsset[]>(loadCustomStencils);
    const [importMessage, setImportMessage] = useState<string>('');
    const [expandedCategories, setExpandedCategories] = useState<
        Set<ShapeCategory>
    >(() => new Set());
    const normalizedQuery = normalizeSearch(query);
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
        'advanced',
        'security',
        'infrastructure',
        'storage',
        'enduser',
        'edge',
        'splunk',
        'places',
        'cisco',
        'layout',
    ];
    const filteredTiles = useMemo(
        () =>
            SHAPE_TILES.filter((tile) =>
                tileMatchesQuery(tile, normalizedQuery)
            ),
        [normalizedQuery]
    );
    const filteredCustomStencils = useMemo(
        () =>
            customStencils.filter((asset) =>
                customStencilMatchesQuery(asset, normalizedQuery)
            ),
        [customStencils, normalizedQuery]
    );
    const grouped = useMemo(() => {
        const next = new Map<ShapeCategory, ShapeTileSpec[]>();
        for (const tile of filteredTiles) {
            const bucket = next.get(tile.category) ?? [];
            bucket.push(tile);
            next.set(tile.category, bucket);
        }
        return next;
    }, [filteredTiles]);

    const handleImportClick = (): void => {
        fileInputRef.current?.click();
    };

    const handleImportFile = async (
        event: React.ChangeEvent<HTMLInputElement>
    ): Promise<void> => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        try {
            const bytes = new Uint8Array(await file.arrayBuffer());
            const directImageMediaType = stencilImageMediaType(file.name, file.type);
            const result = directImageMediaType
                ? importCustomStencilImage(bytes, file.name, directImageMediaType)
                : importCustomStencilsFromZip(bytes);
            if (result.assets.length === 0) {
                setImportMessage(
                    directImageMediaType
                        ? 'That image is too large to save as a custom stencil.'
                        : importFailureMessage(result)
                );
                return;
            }
            const merged = [
                ...result.assets,
                ...customStencils.filter(
                    (existing) =>
                        !result.assets.some((asset) => asset.id === existing.id)
                ),
            ];
            const stored = saveCustomStencils(merged);
            setCustomStencils(merged);
            setImportMessage(importSuccessMessage(result, stored));
        } catch {
            setImportMessage(
                'Could not read that file. Import a ZIP, SVG, PNG, or browser-readable .vssx/.vsdx package.'
            );
        }
    };

    const handleClearCustomStencils = (): void => {
        setCustomStencils([]);
        saveCustomStencils([]);
        setImportMessage('');
    };

    const visibleCategories = ordered.filter((cat) => grouped.has(cat));
    const allVisibleExpanded =
        visibleCategories.length > 0 &&
        visibleCategories.every((cat) => expandedCategories.has(cat));
    const toggleCategory = (cat: ShapeCategory): void => {
        setExpandedCategories((current) => {
            const next = new Set(current);
            if (next.has(cat)) {
                next.delete(cat);
            } else {
                next.add(cat);
            }
            return next;
        });
    };
    const toggleAllCategories = (): void => {
        setExpandedCategories(
            allVisibleExpanded ? new Set() : new Set(visibleCategories)
        );
    };

    return (
        <div className="flex flex-col gap-3 p-3">
            <div className="flex gap-2">
                <div className="relative min-w-0 flex-1">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        type="search"
                        placeholder="Search shapes..."
                        aria-label="Search shapes"
                        className={cn(
                            'h-8 w-full rounded-md border border-slate-200 bg-white pl-8 pr-8 text-xs text-slate-700 outline-none',
                            'placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100',
                            'dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:focus:ring-sky-950'
                        )}
                    />
                    {query ? (
                        <button
                            type="button"
                            onClick={() => setQuery('')}
                            aria-label="Clear shape search"
                            className="absolute right-1.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    ) : null}
                </div>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".zip,.svg,.png,.vssx,.vsdx,.vstx,application/zip,image/svg+xml,image/png"
                    className="hidden"
                    onChange={(event) => {
                        void handleImportFile(event);
                    }}
                />
                <button
                    type="button"
                    onClick={handleImportClick}
                    title="Import stencil ZIP, SVG, PNG, or Visio package"
                    className="flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-600 hover:border-sky-400 hover:text-sky-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                >
                    <Upload className="h-3.5 w-3.5" />
                    Import
                </button>
                {customStencils.length > 0 ? (
                    <button
                        type="button"
                        onClick={handleClearCustomStencils}
                        title="Clear custom stencils"
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-400 hover:border-rose-300 hover:text-rose-500 dark:border-slate-800 dark:bg-slate-900"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </button>
                ) : null}
            </div>
            {importMessage ? (
                <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                    {importMessage}
                </div>
            ) : null}
            <div className="rounded-md border border-sky-100 bg-sky-50/60 px-2 py-1.5 text-[10px] leading-snug text-slate-600 dark:border-sky-950 dark:bg-sky-950/20 dark:text-slate-300">
                Need Cisco device artwork? Download stencil ZIPs from{' '}
                <a
                    href={CISCO_VISIO_STENCIL_LIBRARY_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-0.5 font-medium text-sky-700 hover:text-sky-800 dark:text-sky-300 dark:hover:text-sky-200"
                >
                    Cisco&apos;s Visio stencil library
                    <ExternalLink className="h-3 w-3" />
                </a>
                . Import a ZIP, SVG/PNG export, or .vssx package that includes
                browser-readable SVG/PNG media. EMF/WMF-only stencils need
                conversion first.
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                {normalizedQuery ? (
                    <>
                        {filteredTiles.length + filteredCustomStencils.length}{' '}
                        {filteredTiles.length + filteredCustomStencils.length === 1
                            ? 'shape'
                            : 'shapes'}{' '}
                        found
                    </>
                ) : (
                    <>
                        Drag any shape onto the canvas. Use{' '}
                        <span className="font-medium text-slate-700 dark:text-slate-200">
                            Region / Site
                        </span>{' '}
                        to draw a labelled container, then drop devices inside it.
                    </>
                )}
            </p>
            {filteredTiles.length > 0 && !normalizedQuery ? (
                <button
                    type="button"
                    onClick={toggleAllCategories}
                    className={cn(
                        'self-start rounded-md border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-500',
                        'hover:border-sky-300 hover:text-sky-700 dark:border-slate-800 dark:text-slate-400 dark:hover:border-sky-900 dark:hover:text-sky-300'
                    )}
                >
                    {allVisibleExpanded ? 'Collapse all' : 'Expand all'}
                </button>
            ) : null}
            {filteredTiles.length === 0 ? (
                filteredCustomStencils.length === 0 ? (
                    <div className="rounded-md border border-dashed border-slate-200 px-3 py-5 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                        No shapes match that search.
                    </div>
                ) : null
            ) : null}
            {filteredCustomStencils.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                    <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-0.5">
                        Custom Stencils
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        {filteredCustomStencils.map((asset) => (
                            <CustomStencilTile key={asset.id} asset={asset} />
                        ))}
                    </div>
                </div>
            ) : null}
            {ordered.map((cat) => {
                const tiles = grouped.get(cat);
                if (!tiles || tiles.length === 0) return null;
                const isOpen =
                    Boolean(normalizedQuery) || expandedCategories.has(cat);
                return (
                    <CategoryDrawer
                        key={cat}
                        label={CATEGORY_LABELS[cat]}
                        count={tiles.length}
                        open={isOpen}
                        onToggle={() => toggleCategory(cat)}
                    >
                        {tiles.map((s) => (
                            <ShapeTile key={s.id} {...s} />
                        ))}
                    </CategoryDrawer>
                );
            })}
        </div>
    );
};
