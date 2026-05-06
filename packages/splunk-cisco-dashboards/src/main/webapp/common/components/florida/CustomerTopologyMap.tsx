/**
 * CustomerTopologyMap
 *
 * Generic site-connectivity map for the executive overview. The default
 * data below represents the current customer story, but the component is
 * intentionally customer-topology driven: sites, links, roles, map frame,
 * and telemetry bindings live in one config object.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Circle,
    MapContainer,
    Marker,
    Polyline,
    TileLayer,
    ZoomControl,
    useMap,
    useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import { AnimatePresence, motion, useDragControls } from 'motion/react';
import {
    Activity,
    Code2,
    Download,
    ExternalLink,
    Layers,
    Link2,
    MapPin,
    MousePointer2,
    Pencil,
    Plus,
    RotateCcw,
    Save,
    Terminal,
    Trash2,
    Upload,
    X,
} from 'lucide-react';
import { cn } from '@/common/lib/utils';
import {
    getSearchbaseCatalogue,
    type SearchbaseRecord,
} from '@/common/services/searchbaseCatalogue';
import { runSearch } from '@/common/services/splunkSearchService';
import type {
    CustomerTopology,
    TopologyLink,
    TopologyRole,
    TopologySite,
    TopologyStatus,
} from '@/common/types';
import 'leaflet/dist/leaflet.css';

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl:
        'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl:
        'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export const CUSTOMER_TOPOLOGY: CustomerTopology = {
    id: 'customer-site-connectivity',
    name: 'Florida Site Connectivity',
    subtitle: 'Editable customer site connectivity',
    telemetrySearchName: 'Overview - Topology Overview',
    map: {
        center: [28.45, -82.85],
        zoom: 6.55,
        minZoom: 5,
        maxZoom: 11,
        bounds: [
            [22.5, -90.0],
            [32.5, -77.0],
        ],
    },
    sites: [
        {
            id: 'tlh',
            name: 'Tallahassee (State EOC)',
            shortName: 'TLH',
            role: 'state_hq',
            lat: 30.4383,
            lng: -84.2807,
            status: 'unknown',
            metrics: {},
            telemetrySource: 'Awaiting normalized site telemetry',
            searchName: 'Overview - Site Tallahassee Health',
        },
        {
            id: 'mco',
            name: 'Orlando (Regional Hub)',
            shortName: 'MCO',
            role: 'regional_hub',
            lat: 28.5383,
            lng: -81.3792,
            status: 'unknown',
            metrics: {},
            telemetrySource: 'Awaiting normalized site telemetry',
            searchName: 'Overview - Site Orlando Health',
        },
        {
            id: 'aub',
            name: 'Auburndale (Logistics)',
            shortName: 'AUB',
            role: 'logistics',
            lat: 28.0653,
            lng: -81.7876,
            status: 'unknown',
            metrics: {},
            telemetrySource: 'Awaiting normalized site telemetry',
            searchName: 'Overview - Site Auburndale Health',
        },
    ],
    links: [
        {
            id: 'mco-tlh',
            name: 'Orlando to Tallahassee',
            sourceSiteId: 'mco',
            targetSiteId: 'tlh',
            status: 'unknown',
            telemetrySource: 'Awaiting topology link telemetry',
            searchName: 'Overview - Link Orlando to Tallahassee Health',
        },
        {
            id: 'aub-tlh',
            name: 'Auburndale to Tallahassee',
            sourceSiteId: 'aub',
            targetSiteId: 'tlh',
            status: 'unknown',
            telemetrySource: 'Awaiting topology link telemetry',
            searchName: 'Overview - Link Auburndale to Tallahassee Health',
        },
    ],
};

const STATUS_RANK: Record<TopologyStatus, number> = {
    critical: 4,
    warning: 3,
    unknown: 2,
    stable: 1,
};

const ROLE_LABEL: Record<TopologyRole, string> = {
    state_hq: 'State HQ',
    regional_hub: 'Regional Hub',
    logistics: 'Logistics',
    branch: 'Branch',
    datacenter: 'Data Center',
    internet_edge: 'Internet Edge',
};

const STATUS_DOT_CLASS: Record<TopologyStatus, string> = {
    critical: 'bg-red-500',
    warning: 'bg-amber-500',
    stable: 'bg-emerald-500',
    unknown: 'bg-slate-400',
};

const STATUS_STROKE: Record<TopologyStatus, string> = {
    critical: '#ef4444',
    warning: '#f59e0b',
    stable: '#0ea5e9',
    unknown: '#94a3b8',
};

const ROLE_DOT_CLASS: Record<TopologyRole, string> = {
    state_hq: 'bg-sky-500',
    regional_hub: 'bg-amber-500',
    logistics: 'bg-red-500',
    branch: 'bg-emerald-500',
    datacenter: 'bg-violet-500',
    internet_edge: 'bg-slate-500',
};

const TOPOLOGY_STORAGE_KEY = 'splunk-cisco-dashboards.customerTopology.v2';
const TOPOLOGY_STORAGE_VERSION = 2;
const TOPOLOGY_ROLES: TopologyRole[] = [
    'state_hq',
    'regional_hub',
    'logistics',
    'branch',
    'datacenter',
    'internet_edge',
];
const TOPOLOGY_STATUSES: TopologyStatus[] = [
    'unknown',
    'stable',
    'warning',
    'critical',
];

type PersistedTopologyPayload = {
    version: number;
    topology: CustomerTopology;
};

export interface TopologySummaryMetric {
    id: string;
    label?: string;
    value: string;
    source: 'live' | 'mock' | 'loading';
}

export type TopologySummaryMetricMap = Record<string, TopologySummaryMetric>;

type EditableTopology = Partial<CustomerTopology> & {
    map?: Partial<CustomerTopology['map']>;
    sites?: Array<Partial<TopologySite>>;
    links?: Array<Partial<TopologyLink>>;
};

const cloneTopology = (topology: CustomerTopology): CustomerTopology =>
    JSON.parse(JSON.stringify(topology)) as CustomerTopology;

const isRecord = (value: unknown): value is Record<string, unknown> =>
    Boolean(value && typeof value === 'object' && !Array.isArray(value));

const textValue = (value: unknown, fallback = ''): string => {
    if (value === null || value === undefined) return fallback;
    const text = String(value).trim();
    return text.length > 0 ? text : fallback;
};

const numberValue = (
    value: unknown,
    fallback: number,
    min?: number,
    max?: number
): number => {
    const parsed = Number(value);
    const finite = Number.isFinite(parsed) ? parsed : fallback;
    return Math.min(max ?? finite, Math.max(min ?? finite, finite));
};

const normalizeId = (value: unknown, fallback: string): string => {
    const source = textValue(value, fallback).toLowerCase();
    const normalized = source.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return normalized || fallback;
};

const uniqueId = (base: string, used: Set<string>): string => {
    let candidate = base;
    let idx = 2;
    while (used.has(candidate)) {
        candidate = `${base}-${idx}`;
        idx += 1;
    }
    used.add(candidate);
    return candidate;
};

const isTopologyRole = (value: unknown): value is TopologyRole =>
    TOPOLOGY_ROLES.includes(value as TopologyRole);

const isTopologyStatus = (value: unknown): value is TopologyStatus =>
    TOPOLOGY_STATUSES.includes(value as TopologyStatus);

const optionalText = (value: unknown): string | undefined => {
    const text = textValue(value);
    return text.length > 0 ? text : undefined;
};

const sanitizeTopology = (
    candidate: unknown,
    fallback: CustomerTopology
): CustomerTopology => {
    const source = isRecord(candidate) ? (candidate as EditableTopology) : fallback;
    const fallbackMap = fallback.map;
    const rawSites = Array.isArray(source.sites) && source.sites.length > 0
        ? source.sites
        : fallback.sites;
    const usedSiteIds = new Set<string>();
    const sites = rawSites.map((site, index) => {
        const fallbackSite = fallback.sites[index] ?? fallback.sites[0];
        const id = uniqueId(
            normalizeId(site.id ?? site.shortName ?? site.name, `site-${index + 1}`),
            usedSiteIds
        );
        const shortName = textValue(
            site.shortName,
            id.replace(/-/g, '').slice(0, 4).toUpperCase()
        ).slice(0, 8);
        return {
            id,
            name: textValue(site.name, fallbackSite?.name ?? shortName),
            shortName: shortName.toUpperCase(),
            role: isTopologyRole(site.role) ? site.role : fallbackSite?.role ?? 'branch',
            lat: numberValue(site.lat, fallbackSite?.lat ?? 39.2, -85, 85),
            lng: numberValue(site.lng, fallbackSite?.lng ?? -96.5, -180, 180),
            status: isTopologyStatus(site.status)
                ? site.status
                : fallbackSite?.status ?? 'unknown',
            metrics: {
                activeDevices: finiteOptionalNumber(site.metrics?.activeDevices),
                alerts: finiteOptionalNumber(site.metrics?.alerts),
                healthPct: finiteOptionalNumber(site.metrics?.healthPct),
                latencyMs: finiteOptionalNumber(site.metrics?.latencyMs),
            },
            lastUpdated: optionalText(site.lastUpdated),
            dataState: site.searchName ? 'loading' : site.dataState ?? 'static',
            dataError: optionalText(site.dataError),
            telemetrySource:
                optionalText(site.telemetrySource) ??
                (site.searchName
                    ? 'Awaiting normalized site telemetry'
                    : 'Configured topology item'),
            searchName: optionalText(site.searchName),
        };
    });

    const validSiteIds = new Set(sites.map((site) => site.id));
    const rawLinks = Array.isArray(source.links) ? source.links : fallback.links;
    const usedLinkIds = new Set<string>();
    const links = rawLinks
        .map((link, index) => {
            const fallbackLink = fallback.links[index] ?? fallback.links[0];
            const sourceSiteId = textValue(
                link.sourceSiteId,
                fallbackLink?.sourceSiteId ?? ''
            );
            const targetSiteId = textValue(
                link.targetSiteId,
                fallbackLink?.targetSiteId ?? ''
            );
            if (!validSiteIds.has(sourceSiteId) || !validSiteIds.has(targetSiteId)) {
                return null;
            }
            const id = uniqueId(
                normalizeId(link.id, `${sourceSiteId}-${targetSiteId}`),
                usedLinkIds
            );
            const normalized: TopologyLink = {
                id,
                name: textValue(link.name, `${sourceSiteId} to ${targetSiteId}`),
                sourceSiteId,
                targetSiteId,
                status: isTopologyStatus(link.status)
                    ? link.status
                    : fallbackLink?.status ?? 'unknown',
                dataState: link.searchName ? 'loading' : link.dataState ?? 'static',
                telemetrySource:
                    optionalText(link.telemetrySource) ??
                    'Awaiting topology link telemetry',
            };
            const capacityMbps = finiteOptionalNumber(link.capacityMbps);
            if (capacityMbps !== undefined) normalized.capacityMbps = capacityMbps;
            const throughputMbps = finiteOptionalNumber(link.throughputMbps);
            if (throughputMbps !== undefined) {
                normalized.throughputMbps = throughputMbps;
            }
            const utilizationPct = finiteOptionalNumber(link.utilizationPct);
            if (utilizationPct !== undefined) {
                normalized.utilizationPct = utilizationPct;
            }
            const latencyMs = finiteOptionalNumber(link.latencyMs);
            if (latencyMs !== undefined) normalized.latencyMs = latencyMs;
            const lossPct = finiteOptionalNumber(link.lossPct);
            if (lossPct !== undefined) normalized.lossPct = lossPct;
            const endpointHealthPct = finiteOptionalNumber(link.endpointHealthPct);
            if (endpointHealthPct !== undefined) {
                normalized.endpointHealthPct = endpointHealthPct;
            }
            const endpointDevices = finiteOptionalNumber(link.endpointDevices);
            if (endpointDevices !== undefined) {
                normalized.endpointDevices = endpointDevices;
            }
            const lastUpdated = optionalText(link.lastUpdated);
            if (lastUpdated) normalized.lastUpdated = lastUpdated;
            const dataError = optionalText(link.dataError);
            if (dataError) normalized.dataError = dataError;
            const searchName = optionalText(link.searchName);
            if (searchName) normalized.searchName = searchName;
            return normalized;
        })
        .filter((link): link is TopologyLink => Boolean(link));

    return {
        id: normalizeId(source.id, fallback.id),
        name: textValue(source.name, fallback.name),
        subtitle: textValue(source.subtitle, fallback.subtitle),
        telemetrySearchName: optionalText(source.telemetrySearchName),
        map: {
            center: [
                numberValue(source.map?.center?.[0], fallbackMap.center[0], -85, 85),
                numberValue(source.map?.center?.[1], fallbackMap.center[1], -180, 180),
            ],
            zoom: numberValue(source.map?.zoom, fallbackMap.zoom, 1, 16),
            minZoom: numberValue(source.map?.minZoom, fallbackMap.minZoom, 1, 16),
            maxZoom: numberValue(source.map?.maxZoom, fallbackMap.maxZoom, 1, 20),
            bounds: [
                [
                    numberValue(
                        source.map?.bounds?.[0]?.[0],
                        fallbackMap.bounds[0][0],
                        -85,
                        85
                    ),
                    numberValue(
                        source.map?.bounds?.[0]?.[1],
                        fallbackMap.bounds[0][1],
                        -180,
                        180
                    ),
                ],
                [
                    numberValue(
                        source.map?.bounds?.[1]?.[0],
                        fallbackMap.bounds[1][0],
                        -85,
                        85
                    ),
                    numberValue(
                        source.map?.bounds?.[1]?.[1],
                        fallbackMap.bounds[1][1],
                        -180,
                        180
                    ),
                ],
            ],
        },
        sites,
        links,
    };
};

const finiteOptionalNumber = (value: unknown): number | undefined => {
    if (value === null || value === undefined || value === '') return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
};

const readPersistedTopology = (fallback: CustomerTopology): CustomerTopology => {
    if (typeof window === 'undefined') return cloneTopology(fallback);
    try {
        const raw = window.localStorage.getItem(TOPOLOGY_STORAGE_KEY);
        if (!raw) return cloneTopology(fallback);
        const parsed = JSON.parse(raw) as Partial<PersistedTopologyPayload>;
        return sanitizeTopology(parsed.topology ?? parsed, fallback);
    } catch {
        return cloneTopology(fallback);
    }
};

const writePersistedTopology = (topology: CustomerTopology): void => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
        TOPOLOGY_STORAGE_KEY,
        JSON.stringify({
            version: TOPOLOGY_STORAGE_VERSION,
            topology,
        })
    );
};

const clearPersistedTopology = (): void => {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(TOPOLOGY_STORAGE_KEY);
};

const usePersistedTopology = (fallback: CustomerTopology) => {
    const [topology, setTopology] = useState<CustomerTopology>(() =>
        readPersistedTopology(fallback)
    );

    useEffect(() => {
        setTopology(readPersistedTopology(fallback));
    }, [fallback]);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const onStorage = (event: StorageEvent) => {
            if (event.key === TOPOLOGY_STORAGE_KEY) {
                setTopology(readPersistedTopology(fallback));
            }
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, [fallback]);

    const saveTopology = useCallback(
        (next: CustomerTopology) => {
            const sanitized = sanitizeTopology(next, fallback);
            setTopology(sanitized);
            writePersistedTopology(sanitized);
        },
        [fallback]
    );

    const resetTopology = useCallback(() => {
        const factory = cloneTopology(fallback);
        clearPersistedTopology();
        setTopology(factory);
    }, [fallback]);

    return { topology, saveTopology, resetTopology };
};

const topologyAnimationCss = `
    @keyframes customer-topology-flow {
        from { stroke-dashoffset: 0; }
        to { stroke-dashoffset: -32; }
    }
    @keyframes customer-topology-pulse {
        0%, 100% { stroke-opacity: 0.55; }
        50% { stroke-opacity: 0.9; }
    }
    .customer-topology-flow-line {
        animation-name: customer-topology-flow;
        animation-timing-function: linear;
        animation-iteration-count: infinite;
    }
    .customer-topology-flow-fast {
        animation-duration: 0.85s;
    }
    .customer-topology-flow-medium {
        animation-duration: 1.7s;
    }
    .customer-topology-flow-slow {
        animation-duration: 3.2s;
    }
    .customer-topology-flow-idle {
        animation-duration: 4.5s;
    }
    .customer-topology-link-hitbox {
        cursor: pointer;
    }
    .customer-topology-alert-ring {
        animation: customer-topology-pulse 2.6s ease-in-out infinite;
    }
`;

interface TileLayerPreset {
    id: 'street' | 'satellite';
    label: string;
    light: string;
    dark: string;
    attribution: string;
}

const TILE_LAYER_PRESETS: TileLayerPreset[] = [
    {
        id: 'street',
        label: 'Street',
        light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        attribution:
            '&copy; OpenStreetMap contributors &copy; CARTO',
    },
    {
        id: 'satellite',
        label: 'Satellite',
        light:
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        dark:
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attribution: 'Tiles &copy; Esri',
    },
];

const escapeHtml = (value: string): string =>
    value.replace(/[&<>"']/g, (ch) => {
        switch (ch) {
            case '&':
                return '&amp;';
            case '<':
                return '&lt;';
            case '>':
                return '&gt;';
            case '"':
                return '&quot;';
            case "'":
                return '&#39;';
            default:
                return ch;
        }
    });

const formatNumber = (value?: number): string =>
    value === undefined ? 'Awaiting' : value.toLocaleString();

const formatPercent = (value?: number): string =>
    value === undefined ? 'Awaiting' : `${value.toLocaleString()}%`;

const formatLatency = (value?: number): string =>
    value === undefined ? 'Awaiting' : `${value.toLocaleString()} ms`;

const formatMbps = (value?: number): string =>
    value === undefined ? 'Awaiting' : `${value.toLocaleString()} Mbps`;

const linkWeight = (link: TopologyLink): number => {
    if (link.utilizationPct === undefined) return 2.4;
    return Math.max(2.4, Math.min(7, 2.4 + link.utilizationPct / 18));
};

const normalizeStatus = (raw: unknown): TopologyStatus | null => {
    if (raw === null || raw === undefined) return null;
    const value = String(raw).trim().toLowerCase();
    if (value === 'critical' || value === 'down' || value === 'failed') {
        return 'critical';
    }
    if (value === 'warning' || value === 'degraded' || value === 'impaired') {
        return 'warning';
    }
    if (value === 'stable' || value === 'healthy' || value === 'up') {
        return 'stable';
    }
    if (value === 'unknown' || value === 'awaiting') return 'unknown';
    return null;
};

const finiteNumberFromRow = (
    row: Record<string, unknown>,
    names: readonly string[]
): number | undefined => {
    for (const name of names) {
        const raw = row[name];
        if (raw === null || raw === undefined || raw === '') continue;
        const value = Number(raw);
        if (Number.isFinite(value)) return value;
    }
    return undefined;
};

const textFromRow = (
    row: Record<string, unknown>,
    names: readonly string[]
): string | undefined => {
    for (const name of names) {
        const raw = row[name];
        if (raw === null || raw === undefined) continue;
        const value = String(raw).trim();
        if (value.length > 0) return value;
    }
    return undefined;
};

const deriveStatus = (
    row: Record<string, unknown>,
    fallback: TopologyStatus
): TopologyStatus => {
    const explicit = normalizeStatus(textFromRow(row, ['status', 'linkStatus']));
    if (explicit) return explicit;

    const lossPct = finiteNumberFromRow(row, ['lossPct', 'loss_pct', 'packetLossPct']);
    const latencyMs = finiteNumberFromRow(row, ['latencyMs', 'latency_ms', 'rttMs']);
    const utilizationPct = finiteNumberFromRow(row, [
        'utilizationPct',
        'utilization_pct',
        'txUtilization',
        'rxUtilization',
    ]);
    const endpointHealthPct = finiteNumberFromRow(row, [
        'endpointHealthPct',
        'endpoint_health_pct',
    ]);

    if (
        (lossPct !== undefined && lossPct >= 5) ||
        (latencyMs !== undefined && latencyMs >= 200) ||
        (utilizationPct !== undefined && utilizationPct >= 95) ||
        (endpointHealthPct !== undefined && endpointHealthPct < 70)
    ) {
        return 'critical';
    }
    if (
        (lossPct !== undefined && lossPct >= 1) ||
        (latencyMs !== undefined && latencyMs >= 100) ||
        (utilizationPct !== undefined && utilizationPct >= 80) ||
        (endpointHealthPct !== undefined && endpointHealthPct < 90)
    ) {
        return 'warning';
    }
    if (
        lossPct !== undefined ||
        latencyMs !== undefined ||
        utilizationPct !== undefined ||
        endpointHealthPct !== undefined
    ) {
        return 'stable';
    }
    return fallback;
};

const parseLinkRow = (
    base: TopologyLink,
    row: Record<string, unknown>
): Partial<TopologyLink> => {
    const throughputMbps = finiteNumberFromRow(row, [
        'throughputMbps',
        'throughput_mbps',
        'trafficMbps',
        'traffic_mbps',
    ]);
    const txMbps = finiteNumberFromRow(row, ['txMbps', 'tx_mbps', 'txRateMbps']);
    const rxMbps = finiteNumberFromRow(row, ['rxMbps', 'rx_mbps', 'rxRateMbps']);
    const combinedThroughput =
        throughputMbps ?? (txMbps !== undefined || rxMbps !== undefined
            ? (txMbps ?? 0) + (rxMbps ?? 0)
            : undefined);

    return {
        status: deriveStatus(row, base.status),
        capacityMbps:
            finiteNumberFromRow(row, [
                'capacityMbps',
                'capacity_mbps',
                'bandwidthMbps',
                'bandwidth_mbps',
            ]) ?? base.capacityMbps,
        throughputMbps: combinedThroughput ?? base.throughputMbps,
        utilizationPct:
            finiteNumberFromRow(row, [
                'utilizationPct',
                'utilization_pct',
                'txUtilization',
                'rxUtilization',
            ]) ?? base.utilizationPct,
        latencyMs:
            finiteNumberFromRow(row, ['latencyMs', 'latency_ms', 'rttMs']) ??
            base.latencyMs,
        lossPct:
            finiteNumberFromRow(row, ['lossPct', 'loss_pct', 'packetLossPct']) ??
            base.lossPct,
        endpointHealthPct:
            finiteNumberFromRow(row, [
                'endpointHealthPct',
                'endpoint_health_pct',
            ]) ?? base.endpointHealthPct,
        endpointDevices:
            finiteNumberFromRow(row, ['endpointDevices', 'endpoint_devices']) ??
            base.endpointDevices,
        lastUpdated:
            textFromRow(row, ['lastUpdated', 'last_updated', '_time']) ??
            base.lastUpdated,
        telemetrySource:
            textFromRow(row, ['telemetrySource', 'telemetry_source', 'source']) ??
            base.telemetrySource,
        dataState: 'live',
        dataError: undefined,
    };
};

const deriveSiteStatus = (
    row: Record<string, unknown>,
    fallback: TopologyStatus
): TopologyStatus => {
    const explicit = normalizeStatus(textFromRow(row, ['status', 'siteStatus']));
    if (explicit) return explicit;

    const healthPct = finiteNumberFromRow(row, [
        'healthPct',
        'health_pct',
        'siteHealthPct',
        'score',
        'health',
    ]);
    const alerts = finiteNumberFromRow(row, [
        'alerts',
        'alertCount',
        'alert_count',
        'issueCount',
        'issue_count',
    ]);
    const latencyMs = finiteNumberFromRow(row, ['latencyMs', 'latency_ms', 'rttMs']);

    if (
        (healthPct !== undefined && healthPct < 70) ||
        (alerts !== undefined && alerts >= 25) ||
        (latencyMs !== undefined && latencyMs >= 200)
    ) {
        return 'critical';
    }
    if (
        (healthPct !== undefined && healthPct < 90) ||
        (alerts !== undefined && alerts > 0) ||
        (latencyMs !== undefined && latencyMs >= 100)
    ) {
        return 'warning';
    }
    if (healthPct !== undefined || alerts !== undefined || latencyMs !== undefined) {
        return 'stable';
    }
    return fallback;
};

const parseSiteRow = (
    base: TopologySite,
    row: Record<string, unknown>
): Partial<TopologySite> => ({
    status: deriveSiteStatus(row, base.status),
    metrics: {
        ...base.metrics,
        activeDevices:
            finiteNumberFromRow(row, [
                'activeDevices',
                'active_devices',
                'deviceCount',
                'device_count',
                'devices',
                'totalDevices',
            ]) ?? base.metrics.activeDevices,
        alerts:
            finiteNumberFromRow(row, [
                'alerts',
                'alertCount',
                'alert_count',
                'issueCount',
                'issue_count',
            ]) ?? base.metrics.alerts,
        healthPct:
            finiteNumberFromRow(row, [
                'healthPct',
                'health_pct',
                'siteHealthPct',
                'score',
                'health',
            ]) ?? base.metrics.healthPct,
        latencyMs:
            finiteNumberFromRow(row, ['latencyMs', 'latency_ms', 'rttMs']) ??
            base.metrics.latencyMs,
    },
    lastUpdated:
        textFromRow(row, ['lastUpdated', 'last_updated', '_time']) ?? base.lastUpdated,
    telemetrySource:
        textFromRow(row, ['telemetrySource', 'telemetry_source', 'source']) ??
        base.telemetrySource,
    dataState: 'live',
    dataError: undefined,
});

const normalizeMetricId = (value: unknown): string =>
    textValue(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '');

const normalizedLinkId = (sourceSiteId?: string, targetSiteId?: string): string =>
    sourceSiteId && targetSiteId ? `${sourceSiteId}-${targetSiteId}` : '';

const rowItemType = (row: Record<string, unknown>): string =>
    normalizeMetricId(textFromRow(row, ['itemType', 'item_type', 'type', 'rowType']));

const parseSummaryRow = (
    row: Record<string, unknown>
): TopologySummaryMetric | null => {
    const id = normalizeMetricId(
        textFromRow(row, [
            'summaryId',
            'summary_id',
            'metricId',
            'metric_id',
            'kpiId',
            'kpi_id',
            'id',
        ])
    );
    if (!id) return null;

    const value =
        textFromRow(row, [
            'value',
            'displayValue',
            'display_value',
            'metricValue',
            'metric_value',
            'site',
            'Site',
        ]) ?? '';
    if (!value) return null;

    return {
        id,
        label: textFromRow(row, ['label', 'name', 'title']),
        value,
        source: 'live',
    };
};

const linkFlowClass = (link: TopologyLink): string => {
    const utilization = link.utilizationPct;
    if (utilization === undefined) {
        return link.dataState === 'live'
            ? 'customer-topology-flow-medium'
            : 'customer-topology-flow-idle';
    }
    if (utilization >= 80) return 'customer-topology-flow-fast';
    if (utilization >= 35) return 'customer-topology-flow-medium';
    return 'customer-topology-flow-slow';
};

const createSiteIcon = (
    site: TopologySite,
    isSelected: boolean,
    isSpotlight: boolean,
    isDark: boolean
) => {
    const safeName = escapeHtml(site.name);
    const safeShortName = escapeHtml(site.shortName);
    const ring = isSelected
        ? 'ring-4 ring-sky-300/60 scale-125'
        : isSpotlight
        ? 'ring-4 ring-sky-400/40 scale-110'
        : '';
    const surface = isDark ? 'bg-slate-900 border' : 'bg-white border-2';
    const labelChrome = isDark
        ? 'bg-slate-900/90 backdrop-blur-sm border-slate-700'
        : 'bg-white/90 backdrop-blur-sm border-slate-200';
    return L.divIcon({
        className: 'custom-div-icon',
        html: `
      <div class="relative flex flex-col items-center group">
        <div class="flex items-center justify-center rounded-full transition-all p-1 shadow-lg ${surface}
          w-8 h-8 ${ring}
          ${
              site.status === 'critical'
                  ? 'border-red-500 text-red-500'
                  : site.status === 'warning'
                  ? 'border-amber-500 text-amber-500'
                  : site.status === 'unknown'
                  ? 'border-slate-400 text-slate-400'
                  : 'border-sky-500 text-sky-500'
          }">
          <span class="font-black text-[10px] tracking-tight">${safeShortName}</span>
          ${
              site.status === 'critical' || site.status === 'warning'
                  ? `
            <span class="absolute -top-1 -right-1 flex h-3 w-3">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  site.status === 'critical' ? 'bg-red-400' : 'bg-amber-400'
              }"></span>
              <span class="relative inline-flex rounded-full h-3 w-3 ${
                  site.status === 'critical' ? 'bg-red-500' : 'bg-amber-500'
              }"></span>
            </span>
          `
                  : ''
          }
        </div>
        <div class="mt-1 whitespace-nowrap font-black px-2 py-0.5 rounded shadow-sm border ${labelChrome} ${
            isDark ? 'text-[11px] text-slate-100' : 'text-[11px] text-slate-800'
        }">
          ${safeName}
        </div>
      </div>
    `,
        iconSize: [40, 40],
        iconAnchor: [20, 40],
    });
};

interface MapFrameProps {
    topology: CustomerTopology;
}

const MapFrame: React.FC<MapFrameProps> = ({ topology }) => {
    const map = useMap();
    const [centerLat, centerLng] = topology.map.center;
    const zoom = topology.map.zoom;
    useEffect(() => {
        let firstApply = true;
        const apply = () => {
            map.invalidateSize();
            if (firstApply) {
                map.setView([centerLat, centerLng], zoom, {
                    animate: false,
                });
                firstApply = false;
            }
        };
        apply();
        const container = map.getContainer();
        const observer = new ResizeObserver(() => apply());
        observer.observe(container);
        return () => observer.disconnect();
    }, [centerLat, centerLng, map, zoom]);
    return null;
};

interface MapClickCaptureProps {
    enabled: boolean;
    onPick: (lat: number, lng: number) => void;
}

const MapClickCapture: React.FC<MapClickCaptureProps> = ({ enabled, onPick }) => {
    useMapEvents({
        click: (event) => {
            if (!enabled) return;
            onPick(event.latlng.lat, event.latlng.lng);
        },
    });
    return null;
};

type SelectedTarget =
    | { kind: 'site'; site: TopologySite }
    | { kind: 'link'; link: TopologyLink };

interface CustomerTopologyMapProps {
    topology?: CustomerTopology;
    isDark?: boolean;
    earliestTime?: string;
    latestTime?: string;
    refreshToken?: number;
    spotlightIntervalMs?: number;
    spotlightPauseMs?: number;
    onOpenInSearch?: (spl: string) => void;
    onSummaryMetricsChange?: (metrics: TopologySummaryMetricMap) => void;
}

export const CustomerTopologyMap: React.FC<CustomerTopologyMapProps> = ({
    topology = CUSTOMER_TOPOLOGY,
    isDark = false,
    earliestTime = '-24h',
    latestTime = 'now',
    refreshToken = 0,
    spotlightIntervalMs = 11000,
    spotlightPauseMs = 25000,
    onOpenInSearch,
    onSummaryMetricsChange,
}) => {
    const [selected, setSelected] = useState<SelectedTarget | null>(null);
    const [spotlightSite, setSpotlightSite] = useState<TopologySite | null>(null);
    const [paused, setPaused] = useState(false);
    const { topology: storedTopology, saveTopology, resetTopology } =
        usePersistedTopology(topology);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [draftTopology, setDraftTopology] = useState<CustomerTopology>(() =>
        cloneTopology(storedTopology)
    );
    const [pickSiteId, setPickSiteId] = useState<string | null>(null);
    const [tilePresetId, setTilePresetId] = useState<TileLayerPreset['id']>(
        TILE_LAYER_PRESETS[0].id
    );
    const [catalogueByName, setCatalogueByName] = useState<Record<
        string,
        SearchbaseRecord
    > | null>(null);
    const [liveLinkById, setLiveLinkById] = useState<Record<
        string,
        Partial<TopologyLink>
    >>({});
    const [liveSiteById, setLiveSiteById] = useState<Record<
        string,
        Partial<TopologySite>
    >>({});
    const [summaryMetricById, setSummaryMetricById] =
        useState<TopologySummaryMetricMap>({});
    const pauseUntilRef = useRef<number>(0);

    useEffect(() => {
        if (!isEditorOpen) {
            setDraftTopology(cloneTopology(storedTopology));
        }
    }, [isEditorOpen, storedTopology]);

    const activeTopology = isEditorOpen ? draftTopology : storedTopology;
    const telemetrySearchName = storedTopology.telemetrySearchName?.trim();

    useEffect(() => {
        onSummaryMetricsChange?.(summaryMetricById);
    }, [onSummaryMetricsChange, summaryMetricById]);

    useEffect(() => {
        let cancelled = false;
        getSearchbaseCatalogue()
            .then((list) => {
                if (cancelled) return;
                const byName: Record<string, SearchbaseRecord> = {};
                for (const record of list) {
                    if (record.searchName) byName[record.searchName] = record;
                }
                setCatalogueByName(byName);
            })
            .catch(() => {
                if (cancelled) return;
                setCatalogueByName({});
            });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (catalogueByName === null) return undefined;
        if (!telemetrySearchName) return undefined;
        const record = catalogueByName[telemetrySearchName];
        if (!record?.search?.trim()) return undefined;

        let cancelled = false;
        setLiveSiteById((current) => {
            const next = { ...current };
            for (const site of storedTopology.sites) {
                next[site.id] = {
                    ...next[site.id],
                    dataState: next[site.id]?.dataState === 'live' ? 'live' : 'loading',
                };
            }
            return next;
        });
        setLiveLinkById((current) => {
            const next = { ...current };
            for (const link of storedTopology.links) {
                next[link.id] = {
                    ...next[link.id],
                    dataState: next[link.id]?.dataState === 'live' ? 'live' : 'loading',
                };
            }
            return next;
        });
        setSummaryMetricById((current) => {
            const loading: TopologySummaryMetricMap = { ...current };
            for (const id of ['top_incident', 'operational_lead']) {
                loading[id] = {
                    ...loading[id],
                    id,
                    value: loading[id]?.value ?? 'Awaiting data',
                    source: loading[id]?.source === 'live' ? 'live' : 'loading',
                };
            }
            return loading;
        });

        const siteByConfiguredId = new Map(
            storedTopology.sites.map((site) => [site.id, site] as const)
        );
        const linkByConfiguredId = new Map(
            storedTopology.links.map((link) => [link.id, link] as const)
        );
        const linkByEndpointKey = new Map(
            storedTopology.links.map(
                (link) =>
                    [
                        normalizedLinkId(link.sourceSiteId, link.targetSiteId),
                        link,
                    ] as const
            )
        );

        runSearch({
            spl: record.search,
            earliestTime,
            latestTime,
            tag: 'topology_overview',
        })
            .then((res) => {
                if (cancelled) return;
                const rows = (res?.results ?? []) as Array<Record<string, unknown>>;
                const siteUpdates: Record<string, Partial<TopologySite>> = {};
                const linkUpdates: Record<string, Partial<TopologyLink>> = {};
                const summaryUpdates: TopologySummaryMetricMap = {};

                for (const row of rows) {
                    const itemType = rowItemType(row);
                    const siteId = normalizeId(
                        textFromRow(row, ['siteId', 'site_id', 'site', 'id']),
                        ''
                    );
                    const explicitLinkId = normalizeId(
                        textFromRow(row, ['linkId', 'link_id', 'id']),
                        ''
                    );
                    const sourceSiteId = normalizeId(
                        textFromRow(row, ['sourceSiteId', 'source_site_id', 'source']),
                        ''
                    );
                    const targetSiteId = normalizeId(
                        textFromRow(row, ['targetSiteId', 'target_site_id', 'target']),
                        ''
                    );
                    const endpointLinkId =
                        normalizedLinkId(sourceSiteId, targetSiteId) || explicitLinkId;

                    if (
                        itemType === 'site' ||
                        (siteId && siteByConfiguredId.has(siteId))
                    ) {
                        const site = siteByConfiguredId.get(siteId);
                        if (site) siteUpdates[site.id] = parseSiteRow(site, row);
                        continue;
                    }

                    if (
                        itemType === 'link' ||
                        (endpointLinkId &&
                            (linkByConfiguredId.has(endpointLinkId) ||
                                linkByEndpointKey.has(endpointLinkId)))
                    ) {
                        const link =
                            linkByConfiguredId.get(endpointLinkId) ??
                            linkByEndpointKey.get(endpointLinkId);
                        if (link) linkUpdates[link.id] = parseLinkRow(link, row);
                        continue;
                    }

                    if (
                        itemType === 'summary' ||
                        itemType === 'kpi' ||
                        itemType === 'insight'
                    ) {
                        const metric = parseSummaryRow(row);
                        if (metric) summaryUpdates[metric.id] = metric;
                    }
                }

                setLiveSiteById((current) => {
                    const next = { ...current };
                    for (const site of storedTopology.sites) {
                        next[site.id] =
                            siteUpdates[site.id] ??
                            ({
                                status: 'unknown',
                                metrics: {},
                                dataState: 'error',
                                dataError: 'Topology search returned no site row',
                                telemetrySource:
                                    site.telemetrySource ??
                                    'Awaiting normalized site telemetry',
                            } satisfies Partial<TopologySite>);
                    }
                    return next;
                });
                setLiveLinkById((current) => {
                    const next = { ...current };
                    for (const link of storedTopology.links) {
                        next[link.id] =
                            linkUpdates[link.id] ??
                            ({
                                dataState: 'error',
                                dataError: 'Topology search returned no link row',
                            } satisfies Partial<TopologyLink>);
                    }
                    return next;
                });
                setSummaryMetricById(summaryUpdates);
            })
            .catch((err) => {
                if (cancelled) return;
                const message = err instanceof Error ? err.message : String(err);
                setLiveSiteById((current) => {
                    const next = { ...current };
                    for (const site of storedTopology.sites) {
                        next[site.id] = {
                            status: 'unknown',
                            metrics: {},
                            dataState: 'error',
                            dataError: message,
                            telemetrySource:
                                site.telemetrySource ??
                                'Awaiting normalized site telemetry',
                        };
                    }
                    return next;
                });
                setLiveLinkById((current) => {
                    const next = { ...current };
                    for (const link of storedTopology.links) {
                        next[link.id] = {
                            dataState: 'error',
                            dataError: message,
                        };
                    }
                    return next;
                });
                setSummaryMetricById({});
            });

        return () => {
            cancelled = true;
        };
    }, [
        catalogueByName,
        earliestTime,
        latestTime,
        refreshToken,
        storedTopology.links,
        storedTopology.sites,
        telemetrySearchName,
    ]);

    useEffect(() => {
        if (catalogueByName === null) return undefined;
        if (telemetrySearchName) return undefined;
        let cancelled = false;
        const searchableSites = storedTopology.sites.filter((site) => {
            if (!site.searchName) return false;
            const record = catalogueByName[site.searchName];
            return Boolean(record?.search?.trim());
        });
        if (searchableSites.length === 0) return undefined;

        setLiveSiteById((current) => {
            const next = { ...current };
            for (const site of searchableSites) {
                next[site.id] = {
                    ...next[site.id],
                    dataState: next[site.id]?.dataState === 'live' ? 'live' : 'loading',
                };
            }
            return next;
        });

        searchableSites.forEach((site) => {
            const record = site.searchName ? catalogueByName[site.searchName] : null;
            if (!record?.search) return;
            runSearch({
                spl: record.search,
                earliestTime,
                latestTime,
                tag: `topology_site_${site.id}`,
            })
                .then((res) => {
                    if (cancelled) return;
                    const rows = (res?.results ?? []) as Array<Record<string, unknown>>;
                    const row = [...rows].reverse().find((candidate) =>
                        Object.keys(candidate).some((key) => !key.startsWith('_'))
                    );
                    setLiveSiteById((current) => ({
                        ...current,
                        [site.id]: row
                            ? parseSiteRow(site, row)
                            : {
                                  status: 'unknown',
                                  metrics: {},
                                  dataState: 'error',
                                  dataError: 'Search returned no site rows',
                                  telemetrySource:
                                      site.telemetrySource ??
                                      'Awaiting normalized site telemetry',
                              },
                    }));
                })
                .catch((err) => {
                    if (cancelled) return;
                    setLiveSiteById((current) => ({
                        ...current,
                        [site.id]: {
                            status: 'unknown',
                            metrics: {},
                            dataState: 'error',
                            dataError: err instanceof Error ? err.message : String(err),
                            telemetrySource:
                                site.telemetrySource ??
                                'Awaiting normalized site telemetry',
                        },
                    }));
                });
        });

        return () => {
            cancelled = true;
        };
    }, [
        catalogueByName,
        earliestTime,
        latestTime,
        refreshToken,
        storedTopology.sites,
        telemetrySearchName,
    ]);

    useEffect(() => {
        if (catalogueByName === null) return undefined;
        if (telemetrySearchName) return undefined;
        let cancelled = false;
        const searchableLinks = storedTopology.links.filter((link) => {
            if (!link.searchName) return false;
            const record = catalogueByName[link.searchName];
            return Boolean(record?.search?.trim());
        });
        if (searchableLinks.length === 0) return undefined;

        setLiveLinkById((current) => {
            const next = { ...current };
            for (const link of searchableLinks) {
                next[link.id] = {
                    ...next[link.id],
                    dataState: next[link.id]?.dataState === 'live' ? 'live' : 'loading',
                };
            }
            return next;
        });

        searchableLinks.forEach((link) => {
            const record = link.searchName ? catalogueByName[link.searchName] : null;
            if (!record?.search) return;
            runSearch({
                spl: record.search,
                earliestTime,
                latestTime,
                tag: `topology_link_${link.id}`,
            })
                .then((res) => {
                    if (cancelled) return;
                    const rows = (res?.results ?? []) as Array<Record<string, unknown>>;
                    const row = [...rows].reverse().find((candidate) =>
                        Object.keys(candidate).some((key) => !key.startsWith('_'))
                    );
                    setLiveLinkById((current) => ({
                        ...current,
                        [link.id]: row
                            ? parseLinkRow(link, row)
                            : {
                                  dataState: 'error',
                                  dataError: 'Search returned no link rows',
                              },
                    }));
                })
                .catch((err) => {
                    if (cancelled) return;
                    setLiveLinkById((current) => ({
                        ...current,
                        [link.id]: {
                            dataState: 'error',
                            dataError: err instanceof Error ? err.message : String(err),
                        },
                    }));
                });
        });

        return () => {
            cancelled = true;
        };
    }, [
        catalogueByName,
        earliestTime,
        latestTime,
        refreshToken,
        storedTopology.links,
        telemetrySearchName,
    ]);

    const resolvedTopology = useMemo<CustomerTopology>(
        () => ({
            ...activeTopology,
            sites: activeTopology.sites.map((site) => {
                const liveSite = liveSiteById[site.id];
                return {
                    ...site,
                    dataState: site.searchName ? 'loading' : site.dataState ?? 'static',
                    ...liveSite,
                    metrics: {
                        ...site.metrics,
                        ...(liveSite?.metrics ?? {}),
                    },
                };
            }),
            links: activeTopology.links.map((link) => ({
                ...link,
                dataState: link.searchName ? 'loading' : link.dataState ?? 'static',
                ...liveLinkById[link.id],
            })),
        }),
        [activeTopology, liveLinkById, liveSiteById]
    );

    const siteById = useMemo(() => {
        const map: Record<string, TopologySite> = {};
        for (const site of resolvedTopology.sites) map[site.id] = site;
        return map;
    }, [resolvedTopology.sites]);

    const linkSegments = useMemo(
        () =>
            resolvedTopology.links
                .map((link) => ({
                    link,
                    source: siteById[link.sourceSiteId],
                    target: siteById[link.targetSiteId],
                }))
                .filter(
                    (
                        segment
                    ): segment is {
                        link: TopologyLink;
                        source: TopologySite;
                        target: TopologySite;
                    } => Boolean(segment.source && segment.target)
                ),
        [siteById, resolvedTopology.links]
    );

    const resolvedSelected = useMemo<SelectedTarget | null>(() => {
        if (!selected) return null;
        if (selected.kind === 'site') {
            return {
                kind: 'site',
                site: resolvedTopology.sites.find((site) => site.id === selected.site.id) ??
                    selected.site,
            };
        }
        return {
            kind: 'link',
            link:
                resolvedTopology.links.find((link) => link.id === selected.link.id) ??
                selected.link,
        };
    }, [resolvedTopology.links, resolvedTopology.sites, selected]);

    const selectedSearchName =
        resolvedSelected?.kind === 'site'
            ? resolvedSelected.site.searchName
            : resolvedSelected?.kind === 'link'
            ? resolvedSelected.link.searchName
            : undefined;
    const selectedRecord =
        selectedSearchName && catalogueByName
            ? catalogueByName[selectedSearchName] ?? null
            : null;
    const selectedSpl =
        selectedSearchName && selectedRecord?.search?.trim()
            ? selectedRecord.search.trim()
            : '';

    const spotlightOrder = useMemo(
        () =>
            [...resolvedTopology.sites].sort((a, b) => {
                const alertDelta =
                    (b.metrics.alerts ?? 0) - (a.metrics.alerts ?? 0);
                return STATUS_RANK[b.status] - STATUS_RANK[a.status] || alertDelta;
            }),
        [resolvedTopology.sites]
    );

    useEffect(() => {
        if (spotlightIntervalMs <= 0 || spotlightOrder.length === 0) {
            return undefined;
        }
        let idx = 0;
        const tick = () => {
            const now = Date.now();
            if (paused || pauseUntilRef.current > now || resolvedSelected) return;
            const next = spotlightOrder[idx % spotlightOrder.length];
            idx += 1;
            setSpotlightSite(next);
        };
        tick();
        const id = window.setInterval(tick, spotlightIntervalMs);
        return () => window.clearInterval(id);
    }, [spotlightIntervalMs, spotlightOrder, paused, resolvedSelected]);

    useEffect(() => {
        if (!resolvedSelected) return undefined;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setSelected(null);
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [resolvedSelected]);

    const tilePreset =
        TILE_LAYER_PRESETS.find((preset) => preset.id === tilePresetId) ??
        TILE_LAYER_PRESETS[0];
    const tileUrl = isDark ? tilePreset.dark : tilePreset.light;
    const bounds = L.latLngBounds(
        resolvedTopology.map.bounds[0],
        resolvedTopology.map.bounds[1]
    );
    const overlayChrome = isDark
        ? 'bg-slate-900/90 border-slate-700 text-slate-200 backdrop-blur-md'
        : 'bg-white/95 border-slate-200 text-slate-700 backdrop-blur-md';
    const buttonChrome = isDark
        ? 'bg-slate-900/90 border-slate-700 hover:bg-slate-800 text-slate-200'
        : 'bg-white/95 border-slate-200 hover:bg-slate-50 text-slate-600';

    const openSelectedInSearch = () => {
        if (selectedSpl && onOpenInSearch) onOpenInSearch(selectedSpl);
    };

    const cycleTilePreset = () => {
        const index = TILE_LAYER_PRESETS.findIndex((preset) => preset.id === tilePresetId);
        const next = TILE_LAYER_PRESETS[(index + 1) % TILE_LAYER_PRESETS.length];
        setTilePresetId(next.id);
    };

    const selectSite = (site: TopologySite) => {
        pauseUntilRef.current = Date.now() + spotlightPauseMs;
        setSelected((current) =>
            current?.kind === 'site' && current.site.id === site.id
                ? null
                : { kind: 'site', site }
        );
    };

    const selectLink = (link: TopologyLink) => {
        pauseUntilRef.current = Date.now() + spotlightPauseMs;
        setSelected((current) =>
            current?.kind === 'link' && current.link.id === link.id
                ? null
                : { kind: 'link', link }
        );
    };

    const openEditor = () => {
        pauseUntilRef.current = Date.now() + spotlightPauseMs;
        setSelected(null);
        setDraftTopology(cloneTopology(storedTopology));
        setIsEditorOpen(true);
    };

    const saveEditor = () => {
        saveTopology(draftTopology);
        setPickSiteId(null);
        setIsEditorOpen(false);
    };

    const resetEditor = () => {
        resetTopology();
        setPickSiteId(null);
        setIsEditorOpen(false);
    };

    const applyMapPick = (lat: number, lng: number) => {
        if (!pickSiteId) return;
        setDraftTopology((current) => ({
            ...current,
            sites: current.sites.map((site) =>
                site.id === pickSiteId
                    ? {
                          ...site,
                          lat: Number(lat.toFixed(5)),
                          lng: Number(lng.toFixed(5)),
                      }
                    : site
            ),
        }));
    };

    return (
        <div
            className={cn(
                'relative w-full h-full min-h-[320px] overflow-hidden border rounded-xl shadow-inner group',
                isDark
                    ? 'bg-slate-900 border-slate-800'
                    : 'bg-slate-100 border-slate-200'
            )}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
        >
            <style>{topologyAnimationCss}</style>

            {!resolvedSelected && spotlightSite && (
                <div
                    className={cn(
                        'absolute top-3 left-3 z-[999] px-2 py-1 rounded-md border text-[9px] font-bold uppercase tracking-widest pointer-events-none',
                        isDark
                            ? 'bg-slate-900/70 border-slate-700 text-slate-300 backdrop-blur'
                            : 'bg-white/85 border-slate-200 text-slate-500 backdrop-blur'
                    )}
                >
                    <span className="inline-flex items-center gap-1.5">
                        <span
                            className={cn(
                                'w-1.5 h-1.5 rounded-full',
                                paused
                                    ? 'bg-slate-400'
                                    : 'bg-emerald-500 animate-pulse'
                            )}
                        />
                        {paused
                            ? 'Topology paused'
                            : `Watching ${spotlightSite.shortName}`}
                    </span>
                </div>
            )}

            <MapContainer
                center={resolvedTopology.map.center}
                zoom={resolvedTopology.map.zoom}
                maxBounds={bounds}
                maxBoundsViscosity={1.0}
                minZoom={resolvedTopology.map.minZoom}
                maxZoom={resolvedTopology.map.maxZoom}
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
                scrollWheelZoom={false}
                attributionControl={false}
                className="z-10"
            >
                <MapFrame topology={resolvedTopology} />
                <MapClickCapture
                    enabled={isEditorOpen && Boolean(pickSiteId)}
                    onPick={applyMapPick}
                />
                <TileLayer key={tileUrl} attribution="" url={tileUrl} />
                <ZoomControl position="bottomright" />

                {linkSegments.map(({ link, source, target }) => {
                    const positions: [[number, number], [number, number]] = [
                        [source.lat, source.lng],
                        [target.lat, target.lng],
                    ];
                    const isSelected =
                        resolvedSelected?.kind === 'link' &&
                        resolvedSelected.link.id === link.id;
                    return (
                        <React.Fragment key={link.id}>
                            <Polyline
                                positions={positions}
                                pathOptions={{
                                    color: '#ffffff',
                                    weight: 16,
                                    opacity: 0.01,
                                    className: 'customer-topology-link-hitbox',
                                }}
                                eventHandlers={{
                                    click: () => selectLink(link),
                                }}
                            />
                            <Polyline
                                positions={positions}
                                pathOptions={{
                                    color: STATUS_STROKE[link.status],
                                    weight: linkWeight(link),
                                    dashArray:
                                        link.status === 'stable' ? '8 12' : '4 8',
                                    opacity: isSelected ? 0.95 : 0.62,
                                    className: cn(
                                        'customer-topology-flow-line',
                                        linkFlowClass(link)
                                    ),
                                }}
                                eventHandlers={{
                                    click: () => selectLink(link),
                                }}
                            />
                        </React.Fragment>
                    );
                })}

                {spotlightSite &&
                    (spotlightSite.status === 'critical' ||
                        spotlightSite.status === 'warning') &&
                    !resolvedSelected && (
                        <Circle
                            key={`spotlight-${spotlightSite.id}`}
                            center={[spotlightSite.lat, spotlightSite.lng]}
                            radius={28000}
                            pathOptions={{
                                color: STATUS_STROKE[spotlightSite.status],
                                fillOpacity: 0,
                                weight: 1.2,
                                opacity: 0.6,
                                dashArray: '4 5',
                                className: 'customer-topology-alert-ring',
                            }}
                        />
                    )}

                {resolvedTopology.sites.map((site) => (
                    <Marker
                        key={site.id}
                        position={[site.lat, site.lng]}
                        icon={createSiteIcon(
                            site,
                            resolvedSelected?.kind === 'site' &&
                                resolvedSelected.site.id === site.id,
                            spotlightSite?.id === site.id && !resolvedSelected,
                            isDark
                        )}
                        eventHandlers={{
                            click: () => selectSite(site),
                        }}
                    />
                ))}
            </MapContainer>

            <SelectionCard
                selected={resolvedSelected}
                topology={resolvedTopology}
                siteById={siteById}
                catalogueLoaded={catalogueByName !== null}
                selectedSearchName={selectedSearchName}
                selectedSpl={selectedSpl}
                onClose={() => setSelected(null)}
                onOpenInSearch={onOpenInSearch ? openSelectedInSearch : undefined}
            />

            <TopologyEditorPanel
                open={isEditorOpen}
                topology={draftTopology}
                factoryTopology={topology}
                isDark={isDark}
                pickSiteId={pickSiteId}
                onPickSite={setPickSiteId}
                onTopologyChange={setDraftTopology}
                onSave={saveEditor}
                onResetFactory={resetEditor}
                onClose={() => {
                    setPickSiteId(null);
                    setIsEditorOpen(false);
                }}
            />

            <div className="absolute bottom-6 left-4 z-[1000] space-y-3 pointer-events-auto">
                <div
                    className={cn(
                        'border p-3 rounded-lg shadow-lg max-w-[170px]',
                        overlayChrome
                    )}
                >
                    <h5 className="text-[10px] font-black uppercase tracking-[0.2em] mb-3 text-slate-400">
                        Site Roles
                    </h5>
                    <div className="space-y-2">
                        {resolvedTopology.sites.map((site) => (
                            <LegendRow
                                key={site.id}
                                color={ROLE_DOT_CLASS[site.role]}
                                label={ROLE_LABEL[site.role]}
                                id={site.shortName}
                                isDark={isDark}
                            />
                        ))}
                    </div>
                </div>

                <button
                    type="button"
                    onClick={cycleTilePreset}
                    title={`Tiles: ${tilePreset.label}. Click to cycle.`}
                    aria-label={`Switch base map. Current: ${tilePreset.label}`}
                    className={cn(
                        'border p-2 rounded-lg shadow-md transition-colors focus:outline-none focus:ring-1 focus:ring-sky-400 relative',
                        buttonChrome
                    )}
                >
                    <Layers className="w-4 h-4" />
                    <span className="absolute -bottom-1 -right-1 px-1 py-0.5 rounded text-[7px] font-bold uppercase tracking-widest bg-sky-500 text-white shadow-sm">
                        {tilePreset.id.charAt(0)}
                    </span>
                </button>

                <button
                    type="button"
                    onClick={openEditor}
                    title="Edit topology"
                    aria-label="Edit topology"
                    className={cn(
                        'border p-2 rounded-lg shadow-md transition-colors focus:outline-none focus:ring-1 focus:ring-sky-400',
                        buttonChrome
                    )}
                >
                    <Pencil className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

interface SelectionCardProps {
    selected: SelectedTarget | null;
    topology: CustomerTopology;
    siteById: Record<string, TopologySite>;
    catalogueLoaded: boolean;
    selectedSearchName?: string;
    selectedSpl: string;
    onClose: () => void;
    onOpenInSearch?: () => void;
}

const SelectionCard: React.FC<SelectionCardProps> = ({
    selected,
    topology,
    siteById,
    catalogueLoaded,
    selectedSearchName,
    selectedSpl,
    onClose,
    onOpenInSearch,
}) => {
    const dragControls = useDragControls();
    const connectedLinks = useMemo(() => {
        if (!selected || selected.kind !== 'site') return [];
        return topology.links.filter(
            (link) =>
                link.sourceSiteId === selected.site.id ||
                link.targetSiteId === selected.site.id
        );
    }, [selected, topology.links]);

    const title =
        selected?.kind === 'site'
            ? selected.site.name
            : selected
            ? selected.link.name
            : '';
    const subtitle =
        selected?.kind === 'site'
            ? ROLE_LABEL[selected.site.role]
            : selected
            ? `${siteById[selected.link.sourceSiteId]?.shortName ?? '?'} to ${
                  siteById[selected.link.targetSiteId]?.shortName ?? '?'
              }`
            : '';
    const status =
        selected?.kind === 'site'
            ? selected.site.status
            : selected
            ? selected.link.status
            : 'unknown';

    return (
        <AnimatePresence>
            {selected && (
                <motion.div
                    initial={{ opacity: 0, x: 20, scale: 0.94 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 20, scale: 0.94 }}
                    drag
                    dragControls={dragControls}
                    dragListener={false}
                    dragMomentum={false}
                    dragElastic={0.04}
                    className="absolute top-3 right-3 bottom-16 z-[2000] w-[min(22rem,calc(100%-1.5rem))] bg-[#1a1c1e] text-slate-300 rounded-lg border border-slate-700 shadow-2xl overflow-hidden flex flex-col"
                >
                    <div
                        className="bg-slate-800/50 px-4 py-2 border-b border-slate-700 flex items-center justify-between cursor-move touch-none flex-shrink-0"
                        onPointerDown={(event) => dragControls.start(event)}
                        title="Drag topology details"
                    >
                        <div className="flex items-center gap-2 min-w-0">
                            <Terminal className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                            <div className="min-w-0">
                                <p className="text-[10px] font-mono font-bold tracking-tight text-slate-400 uppercase truncate">
                                    {title}
                                </p>
                                <p className="text-[9px] text-slate-500 truncate">
                                    {subtitle}
                                </p>
                            </div>
                            <div
                                className={cn(
                                    'w-2 h-2 rounded-full flex-shrink-0',
                                    STATUS_DOT_CLASS[status]
                                )}
                            />
                        </div>
                        <button
                            type="button"
                            aria-label="Close topology details"
                            onClick={onClose}
                            onPointerDown={(event) => event.stopPropagation()}
                            className="text-slate-500 hover:text-white transition-colors p-0.5 rounded hover:bg-white/5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    <div className="p-3 space-y-3 overflow-y-auto overscroll-contain flex-1 min-h-0">
                        {selected.kind === 'site' ? (
                            <SiteDetails site={selected.site} links={connectedLinks} />
                        ) : (
                            <LinkDetails link={selected.link} siteById={siteById} />
                        )}

                        <div className="space-y-1">
                            <div className="flex items-center justify-between">
                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                                    Searchbase SPL
                                </span>
                                {selectedSpl && onOpenInSearch ? (
                                    <button
                                        type="button"
                                        aria-label="Open this query in Splunk Search"
                                        onClick={onOpenInSearch}
                                        title="Open this query in Splunk Search"
                                        className="text-slate-600 hover:text-sky-400 transition-colors rounded focus:outline-none focus:ring-1 focus:ring-sky-500"
                                    >
                                        <Activity className="w-3 h-3" />
                                    </button>
                                ) : (
                                    <Activity className="w-3 h-3 text-slate-600" />
                                )}
                            </div>
                            <div className="w-full rounded border border-slate-800 bg-black/55 p-2 font-mono">
                                {!catalogueLoaded ? (
                                    <p className="text-[10px] text-slate-500 italic leading-relaxed">
                                        Loading searchbase SPL...
                                    </p>
                                ) : selectedSpl ? (
                                    <pre className="m-0 text-[10px] text-sky-200 leading-relaxed whitespace-pre-wrap break-words select-text">
                                        {selectedSpl}
                                    </pre>
                                ) : (
                                    <p className="text-[10px] text-slate-500 leading-relaxed">
                                        No searchbase binding for this topology item.
                                    </p>
                                )}
                            </div>
                            {selectedSearchName && (
                                <p
                                    className="text-[9px] font-mono text-slate-500 truncate"
                                    title={`Source: searchbase.conf search_name "${selectedSearchName}"`}
                                >
                                    search_name &quot;{selectedSearchName}&quot;
                                </p>
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={onOpenInSearch}
                            disabled={!onOpenInSearch || !selectedSpl}
                            className={cn(
                                'inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold transition-colors focus:outline-none focus:ring-1 focus:ring-sky-500',
                                onOpenInSearch && selectedSpl
                                    ? 'text-sky-400 hover:text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 cursor-pointer'
                                    : 'text-slate-500 bg-slate-700/30 cursor-not-allowed'
                            )}
                        >
                            <ExternalLink className="w-3 h-3" />
                            Open in Splunk Search
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

interface TopologyEditorPanelProps {
    open: boolean;
    topology: CustomerTopology;
    factoryTopology: CustomerTopology;
    isDark: boolean;
    pickSiteId: string | null;
    onPickSite: (siteId: string | null) => void;
    onTopologyChange: React.Dispatch<React.SetStateAction<CustomerTopology>>;
    onSave: () => void;
    onResetFactory: () => void;
    onClose: () => void;
}

const editorInputClass = (isDark: boolean): string =>
    cn(
        'w-full rounded-md border px-2 py-1.5 text-[11px] font-semibold outline-none transition-colors focus:ring-1 focus:ring-sky-400',
        isDark
            ? 'bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-600'
            : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400'
    );

const editorLabelClass = 'text-[8px] font-black uppercase tracking-widest';

const TopologyEditorPanel: React.FC<TopologyEditorPanelProps> = ({
    open,
    topology,
    factoryTopology,
    isDark,
    pickSiteId,
    onPickSite,
    onTopologyChange,
    onSave,
    onResetFactory,
    onClose,
}) => {
    const [jsonText, setJsonText] = useState('');
    const [jsonError, setJsonError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) {
            setJsonError(null);
        }
    }, [open]);

    const updateSite = (siteId: string, patch: Partial<TopologySite>) => {
        onTopologyChange((current) => ({
            ...current,
            sites: current.sites.map((site) =>
                site.id === siteId
                    ? {
                          ...site,
                          ...patch,
                          metrics: patch.metrics
                              ? { ...site.metrics, ...patch.metrics }
                              : site.metrics,
                      }
                    : site
            ),
        }));
    };

    const addSite = () => {
        onTopologyChange((current) => {
            const used = new Set(current.sites.map((site) => site.id));
            const id = uniqueId(`site-${current.sites.length + 1}`, used);
            return {
                ...current,
                sites: [
                    ...current.sites,
                    {
                        id,
                        name: `Site ${current.sites.length + 1}`,
                        shortName: id.replace(/-/g, '').slice(0, 4).toUpperCase(),
                        role: 'branch',
                        lat: Number(current.map.center[0].toFixed(5)),
                        lng: Number(current.map.center[1].toFixed(5)),
                        status: 'unknown',
                        metrics: {},
                        telemetrySource: 'Configured topology item',
                    },
                ],
            };
        });
    };

    const removeSite = (siteId: string) => {
        onPickSite(pickSiteId === siteId ? null : pickSiteId);
        onTopologyChange((current) => ({
            ...current,
            sites: current.sites.filter((site) => site.id !== siteId),
            links: current.links.filter(
                (link) =>
                    link.sourceSiteId !== siteId && link.targetSiteId !== siteId
            ),
        }));
    };

    const updateLink = (linkId: string, patch: Partial<TopologyLink>) => {
        onTopologyChange((current) => ({
            ...current,
            links: current.links.map((link) =>
                link.id === linkId ? { ...link, ...patch } : link
            ),
        }));
    };

    const addLink = () => {
        onTopologyChange((current) => {
            if (current.sites.length < 2) return current;
            const source = current.sites[0];
            const target = current.sites[1];
            const used = new Set(current.links.map((link) => link.id));
            const id = uniqueId(`${source.id}-${target.id}`, used);
            return {
                ...current,
                links: [
                    ...current.links,
                    {
                        id,
                        name: `${source.name} to ${target.name}`,
                        sourceSiteId: source.id,
                        targetSiteId: target.id,
                        status: 'unknown',
                        telemetrySource: 'Awaiting topology link telemetry',
                    },
                ],
            };
        });
    };

    const removeLink = (linkId: string) => {
        onTopologyChange((current) => ({
            ...current,
            links: current.links.filter((link) => link.id !== linkId),
        }));
    };

    const updateMap = (patch: Partial<CustomerTopology['map']>) => {
        onTopologyChange((current) => ({
            ...current,
            map: {
                ...current.map,
                ...patch,
            },
        }));
    };

    const exportTopology = () => {
        setJsonError(null);
        setJsonText(
            JSON.stringify(
                {
                    version: TOPOLOGY_STORAGE_VERSION,
                    topology: sanitizeTopology(topology, factoryTopology),
                },
                null,
                2
            )
        );
    };

    const importTopology = () => {
        try {
            let parsed: unknown = JSON.parse(jsonText);
            if (typeof parsed === 'string') {
                parsed = JSON.parse(parsed);
            }
            const imported =
                isRecord(parsed) && 'topology' in parsed
                    ? (parsed as Partial<PersistedTopologyPayload>).topology
                    : parsed;
            const sanitized = sanitizeTopology(imported, factoryTopology);
            onTopologyChange(sanitized);
            setJsonText(
                JSON.stringify(
                    {
                        version: TOPOLOGY_STORAGE_VERSION,
                        topology: sanitized,
                    },
                    null,
                    2
                )
            );
            setJsonError(null);
        } catch (err) {
            setJsonError(err instanceof Error ? err.message : String(err));
        }
    };

    return (
        <AnimatePresence>
            {open && (
                <motion.aside
                    initial={{ opacity: 0, x: 28, scale: 0.98 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 28, scale: 0.98 }}
                    className={cn(
                        'absolute top-3 right-3 bottom-3 z-[2200] w-[min(430px,calc(100%-1.5rem))] rounded-xl border shadow-2xl overflow-hidden flex flex-col',
                        isDark
                            ? 'bg-slate-950/96 border-slate-700 text-slate-100'
                            : 'bg-white/98 border-slate-200 text-slate-800'
                    )}
                >
                    <div
                        className={cn(
                            'px-4 py-3 border-b flex items-center justify-between gap-3',
                            isDark ? 'border-slate-800' : 'border-slate-200'
                        )}
                    >
                        <div className="min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-500">
                                Topology Editor
                            </p>
                            <p
                                className={cn(
                                    'text-[10px] font-semibold truncate',
                                    isDark ? 'text-slate-400' : 'text-slate-500'
                                )}
                            >
                                {topology.name}
                            </p>
                        </div>
                        <button
                            type="button"
                            aria-label="Close topology editor"
                            onClick={onClose}
                            className={cn(
                                'p-1.5 rounded-md transition-colors focus:outline-none focus:ring-1 focus:ring-sky-400',
                                isDark
                                    ? 'hover:bg-slate-800 text-slate-400'
                                    : 'hover:bg-slate-100 text-slate-500'
                            )}
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-auto p-4 space-y-4">
                        <section className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                                <label className="space-y-1">
                                    <span
                                        className={cn(
                                            editorLabelClass,
                                            isDark ? 'text-slate-500' : 'text-slate-400'
                                        )}
                                    >
                                        Name
                                    </span>
                                    <input
                                        className={editorInputClass(isDark)}
                                        value={topology.name}
                                        onChange={(event) =>
                                            onTopologyChange((current) => ({
                                                ...current,
                                                name: event.target.value,
                                            }))
                                        }
                                    />
                                </label>
                                <label className="space-y-1">
                                    <span
                                        className={cn(
                                            editorLabelClass,
                                            isDark ? 'text-slate-500' : 'text-slate-400'
                                        )}
                                    >
                                        Subtitle
                                    </span>
                                    <input
                                        className={editorInputClass(isDark)}
                                        value={topology.subtitle}
                                        onChange={(event) =>
                                            onTopologyChange((current) => ({
                                                ...current,
                                                subtitle: event.target.value,
                                            }))
                                        }
                                    />
                                </label>
                            </div>
                            <label className="block space-y-1">
                                <span
                                    className={cn(
                                        editorLabelClass,
                                        isDark ? 'text-slate-500' : 'text-slate-400'
                                    )}
                                >
                                    Topology telemetry search_name
                                </span>
                                <input
                                    className={editorInputClass(isDark)}
                                    value={topology.telemetrySearchName ?? ''}
                                    placeholder="Overview - Topology Overview"
                                    onChange={(event) =>
                                        onTopologyChange((current) => ({
                                            ...current,
                                            telemetrySearchName: event.target.value,
                                        }))
                                    }
                                />
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                <label className="space-y-1">
                                    <span
                                        className={cn(
                                            editorLabelClass,
                                            isDark ? 'text-slate-500' : 'text-slate-400'
                                        )}
                                    >
                                        Center Lat
                                    </span>
                                    <input
                                        type="number"
                                        step="0.0001"
                                        className={editorInputClass(isDark)}
                                        value={topology.map.center[0]}
                                        onChange={(event) =>
                                            updateMap({
                                                center: [
                                                    Number(event.target.value),
                                                    topology.map.center[1],
                                                ],
                                            })
                                        }
                                    />
                                </label>
                                <label className="space-y-1">
                                    <span
                                        className={cn(
                                            editorLabelClass,
                                            isDark ? 'text-slate-500' : 'text-slate-400'
                                        )}
                                    >
                                        Center Lng
                                    </span>
                                    <input
                                        type="number"
                                        step="0.0001"
                                        className={editorInputClass(isDark)}
                                        value={topology.map.center[1]}
                                        onChange={(event) =>
                                            updateMap({
                                                center: [
                                                    topology.map.center[0],
                                                    Number(event.target.value),
                                                ],
                                            })
                                        }
                                    />
                                </label>
                                <label className="space-y-1">
                                    <span
                                        className={cn(
                                            editorLabelClass,
                                            isDark ? 'text-slate-500' : 'text-slate-400'
                                        )}
                                    >
                                        Zoom
                                    </span>
                                    <input
                                        type="number"
                                        step="0.1"
                                        className={editorInputClass(isDark)}
                                        value={topology.map.zoom}
                                        onChange={(event) =>
                                            updateMap({ zoom: Number(event.target.value) })
                                        }
                                    />
                                </label>
                            </div>
                        </section>

                        <section className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                                <h4 className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                                    Sites
                                </h4>
                                <button
                                    type="button"
                                    onClick={addSite}
                                    title="Add site"
                                    className="inline-flex items-center gap-1 rounded-md bg-sky-500 px-2 py-1 text-[10px] font-black text-white hover:bg-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-300"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    Add
                                </button>
                            </div>
                            <div className="space-y-2">
                                {topology.sites.map((site) => (
                                    <div
                                        key={site.id}
                                        className={cn(
                                            'rounded-lg border p-3 space-y-2',
                                            isDark
                                                ? 'border-slate-800 bg-slate-900/70'
                                                : 'border-slate-200 bg-slate-50'
                                        )}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <MapPin className="w-4 h-4 text-sky-500 flex-shrink-0" />
                                                <span className="text-[10px] font-mono uppercase text-slate-400 truncate">
                                                    {site.id}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        onPickSite(
                                                            pickSiteId === site.id
                                                                ? null
                                                                : site.id
                                                        )
                                                    }
                                                    title="Click the map to set this site's lat/lng"
                                                    className={cn(
                                                        'p-1.5 rounded-md transition-colors focus:outline-none focus:ring-1 focus:ring-sky-400',
                                                        pickSiteId === site.id
                                                            ? 'bg-sky-500 text-white'
                                                            : isDark
                                                            ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                                            : 'bg-white text-slate-500 hover:bg-slate-100'
                                                    )}
                                                >
                                                    <MousePointer2 className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => removeSite(site.id)}
                                                    title="Remove site"
                                                    className={cn(
                                                        'p-1.5 rounded-md transition-colors focus:outline-none focus:ring-1 focus:ring-red-400',
                                                        isDark
                                                            ? 'bg-slate-800 text-red-300 hover:bg-red-950/70'
                                                            : 'bg-white text-red-500 hover:bg-red-50'
                                                    )}
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <label className="space-y-1">
                                                <span
                                                    className={cn(
                                                        editorLabelClass,
                                                        isDark
                                                            ? 'text-slate-500'
                                                            : 'text-slate-400'
                                                    )}
                                                >
                                                    Name
                                                </span>
                                                <input
                                                    className={editorInputClass(isDark)}
                                                    value={site.name}
                                                    onChange={(event) =>
                                                        updateSite(site.id, {
                                                            name: event.target.value,
                                                        })
                                                    }
                                                />
                                            </label>
                                            <label className="space-y-1">
                                                <span
                                                    className={cn(
                                                        editorLabelClass,
                                                        isDark
                                                            ? 'text-slate-500'
                                                            : 'text-slate-400'
                                                    )}
                                                >
                                                    Short
                                                </span>
                                                <input
                                                    className={editorInputClass(isDark)}
                                                    value={site.shortName}
                                                    maxLength={8}
                                                    onChange={(event) =>
                                                        updateSite(site.id, {
                                                            shortName:
                                                                event.target.value.toUpperCase(),
                                                        })
                                                    }
                                                />
                                            </label>
                                            <label className="space-y-1">
                                                <span
                                                    className={cn(
                                                        editorLabelClass,
                                                        isDark
                                                            ? 'text-slate-500'
                                                            : 'text-slate-400'
                                                    )}
                                                >
                                                    Role
                                                </span>
                                                <select
                                                    className={editorInputClass(isDark)}
                                                    value={site.role}
                                                    onChange={(event) =>
                                                        updateSite(site.id, {
                                                            role: event.target
                                                                .value as TopologyRole,
                                                        })
                                                    }
                                                >
                                                    {TOPOLOGY_ROLES.map((role) => (
                                                        <option key={role} value={role}>
                                                            {ROLE_LABEL[role]}
                                                        </option>
                                                    ))}
                                                </select>
                                            </label>
                                            <label className="space-y-1">
                                                <span
                                                    className={cn(
                                                        editorLabelClass,
                                                        isDark
                                                            ? 'text-slate-500'
                                                            : 'text-slate-400'
                                                    )}
                                                >
                                                    Status
                                                </span>
                                                <select
                                                    className={editorInputClass(isDark)}
                                                    value={site.status}
                                                    onChange={(event) =>
                                                        updateSite(site.id, {
                                                            status: event.target
                                                                .value as TopologyStatus,
                                                        })
                                                    }
                                                >
                                                    {TOPOLOGY_STATUSES.map((status) => (
                                                        <option
                                                            key={status}
                                                            value={status}
                                                        >
                                                            {status}
                                                        </option>
                                                    ))}
                                                </select>
                                            </label>
                                            <label className="space-y-1">
                                                <span
                                                    className={cn(
                                                        editorLabelClass,
                                                        isDark
                                                            ? 'text-slate-500'
                                                            : 'text-slate-400'
                                                    )}
                                                >
                                                    Lat
                                                </span>
                                                <input
                                                    type="number"
                                                    step="0.00001"
                                                    className={editorInputClass(isDark)}
                                                    value={site.lat}
                                                    onChange={(event) =>
                                                        updateSite(site.id, {
                                                            lat: Number(
                                                                event.target.value
                                                            ),
                                                        })
                                                    }
                                                />
                                            </label>
                                            <label className="space-y-1">
                                                <span
                                                    className={cn(
                                                        editorLabelClass,
                                                        isDark
                                                            ? 'text-slate-500'
                                                            : 'text-slate-400'
                                                    )}
                                                >
                                                    Lng
                                                </span>
                                                <input
                                                    type="number"
                                                    step="0.00001"
                                                    className={editorInputClass(isDark)}
                                                    value={site.lng}
                                                    onChange={(event) =>
                                                        updateSite(site.id, {
                                                            lng: Number(
                                                                event.target.value
                                                            ),
                                                        })
                                                    }
                                                />
                                            </label>
                                        </div>
                                        <label className="block space-y-1">
                                            <span
                                                className={cn(
                                                    editorLabelClass,
                                                    isDark
                                                        ? 'text-slate-500'
                                                        : 'text-slate-400'
                                                )}
                                            >
                                                search_name
                                            </span>
                                            <input
                                                className={editorInputClass(isDark)}
                                                value={site.searchName ?? ''}
                                                placeholder="Overview - Site Tallahassee Health"
                                                onChange={(event) =>
                                                    updateSite(site.id, {
                                                        searchName: event.target.value,
                                                    })
                                                }
                                            />
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                                <h4 className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                                    Links
                                </h4>
                                <button
                                    type="button"
                                    onClick={addLink}
                                    disabled={topology.sites.length < 2}
                                    title="Add link"
                                    className="inline-flex items-center gap-1 rounded-md bg-sky-500 px-2 py-1 text-[10px] font-black text-white hover:bg-sky-600 disabled:opacity-40 disabled:hover:bg-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-300"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    Add
                                </button>
                            </div>
                            <div className="space-y-2">
                                {topology.links.map((link) => (
                                    <div
                                        key={link.id}
                                        className={cn(
                                            'rounded-lg border p-3 space-y-2',
                                            isDark
                                                ? 'border-slate-800 bg-slate-900/70'
                                                : 'border-slate-200 bg-slate-50'
                                        )}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <Link2 className="w-4 h-4 text-sky-500 flex-shrink-0" />
                                                <span className="text-[10px] font-mono uppercase text-slate-400 truncate">
                                                    {link.id}
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => removeLink(link.id)}
                                                title="Remove link"
                                                className={cn(
                                                    'p-1.5 rounded-md transition-colors focus:outline-none focus:ring-1 focus:ring-red-400',
                                                    isDark
                                                        ? 'bg-slate-800 text-red-300 hover:bg-red-950/70'
                                                        : 'bg-white text-red-500 hover:bg-red-50'
                                                )}
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                        <label className="block space-y-1">
                                            <span
                                                className={cn(
                                                    editorLabelClass,
                                                    isDark
                                                        ? 'text-slate-500'
                                                        : 'text-slate-400'
                                                )}
                                            >
                                                Name
                                            </span>
                                            <input
                                                className={editorInputClass(isDark)}
                                                value={link.name}
                                                onChange={(event) =>
                                                    updateLink(link.id, {
                                                        name: event.target.value,
                                                    })
                                                }
                                            />
                                        </label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <label className="space-y-1">
                                                <span
                                                    className={cn(
                                                        editorLabelClass,
                                                        isDark
                                                            ? 'text-slate-500'
                                                            : 'text-slate-400'
                                                    )}
                                                >
                                                    Source
                                                </span>
                                                <select
                                                    className={editorInputClass(isDark)}
                                                    value={link.sourceSiteId}
                                                    onChange={(event) =>
                                                        updateLink(link.id, {
                                                            sourceSiteId:
                                                                event.target.value,
                                                        })
                                                    }
                                                >
                                                    {topology.sites.map((site) => (
                                                        <option
                                                            key={site.id}
                                                            value={site.id}
                                                        >
                                                            {site.shortName}
                                                        </option>
                                                    ))}
                                                </select>
                                            </label>
                                            <label className="space-y-1">
                                                <span
                                                    className={cn(
                                                        editorLabelClass,
                                                        isDark
                                                            ? 'text-slate-500'
                                                            : 'text-slate-400'
                                                    )}
                                                >
                                                    Target
                                                </span>
                                                <select
                                                    className={editorInputClass(isDark)}
                                                    value={link.targetSiteId}
                                                    onChange={(event) =>
                                                        updateLink(link.id, {
                                                            targetSiteId:
                                                                event.target.value,
                                                        })
                                                    }
                                                >
                                                    {topology.sites.map((site) => (
                                                        <option
                                                            key={site.id}
                                                            value={site.id}
                                                        >
                                                            {site.shortName}
                                                        </option>
                                                    ))}
                                                </select>
                                            </label>
                                            <label className="space-y-1">
                                                <span
                                                    className={cn(
                                                        editorLabelClass,
                                                        isDark
                                                            ? 'text-slate-500'
                                                            : 'text-slate-400'
                                                    )}
                                                >
                                                    Status
                                                </span>
                                                <select
                                                    className={editorInputClass(isDark)}
                                                    value={link.status}
                                                    onChange={(event) =>
                                                        updateLink(link.id, {
                                                            status: event.target
                                                                .value as TopologyStatus,
                                                        })
                                                    }
                                                >
                                                    {TOPOLOGY_STATUSES.map((status) => (
                                                        <option
                                                            key={status}
                                                            value={status}
                                                        >
                                                            {status}
                                                        </option>
                                                    ))}
                                                </select>
                                            </label>
                                            <label className="space-y-1">
                                                <span
                                                    className={cn(
                                                        editorLabelClass,
                                                        isDark
                                                            ? 'text-slate-500'
                                                            : 'text-slate-400'
                                                    )}
                                                >
                                                    Capacity Mbps
                                                </span>
                                                <input
                                                    type="number"
                                                    className={editorInputClass(isDark)}
                                                    value={link.capacityMbps ?? ''}
                                                    onChange={(event) =>
                                                        updateLink(link.id, {
                                                            capacityMbps:
                                                                event.target.value === ''
                                                                    ? undefined
                                                                    : Number(
                                                                          event.target
                                                                              .value
                                                                      ),
                                                        })
                                                    }
                                                />
                                            </label>
                                        </div>
                                        <label className="block space-y-1">
                                            <span
                                                className={cn(
                                                    editorLabelClass,
                                                    isDark
                                                        ? 'text-slate-500'
                                                        : 'text-slate-400'
                                                )}
                                            >
                                                search_name
                                            </span>
                                            <input
                                                className={editorInputClass(isDark)}
                                                value={link.searchName ?? ''}
                                                placeholder="Overview - Link Orlando to Tallahassee Health"
                                                onChange={(event) =>
                                                    updateLink(link.id, {
                                                        searchName: event.target.value,
                                                    })
                                                }
                                            />
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                                <h4 className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                                    JSON
                                </h4>
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={exportTopology}
                                        title="Export topology JSON"
                                        className={cn(
                                            'p-1.5 rounded-md transition-colors focus:outline-none focus:ring-1 focus:ring-sky-400',
                                            isDark
                                                ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        )}
                                    >
                                        <Download className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={importTopology}
                                        title="Import topology JSON"
                                        className={cn(
                                            'p-1.5 rounded-md transition-colors focus:outline-none focus:ring-1 focus:ring-sky-400',
                                            isDark
                                                ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        )}
                                    >
                                        <Upload className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                            <textarea
                                className={cn(
                                    editorInputClass(isDark),
                                    'min-h-[96px] font-mono font-medium leading-relaxed resize-y'
                                )}
                                value={jsonText}
                                onChange={(event) => setJsonText(event.target.value)}
                                placeholder="Export or paste topology JSON"
                            />
                            {jsonError && (
                                <p className="text-[10px] font-semibold text-red-500">
                                    {jsonError}
                                </p>
                            )}
                        </section>
                    </div>

                    <div
                        className={cn(
                            'border-t p-3 flex items-center justify-between gap-2',
                            isDark ? 'border-slate-800' : 'border-slate-200'
                        )}
                    >
                        <button
                            type="button"
                            onClick={onResetFactory}
                            className={cn(
                                'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[10px] font-black transition-colors focus:outline-none focus:ring-1 focus:ring-red-400',
                                isDark
                                    ? 'bg-slate-900 text-red-300 hover:bg-red-950/70'
                                    : 'bg-red-50 text-red-600 hover:bg-red-100'
                            )}
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Factory
                        </button>
                        <button
                            type="button"
                            onClick={onSave}
                            className="inline-flex items-center gap-1.5 rounded-md bg-sky-500 px-3 py-1.5 text-[10px] font-black text-white hover:bg-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-300"
                        >
                            <Save className="w-3.5 h-3.5" />
                            Save
                        </button>
                    </div>
                </motion.aside>
            )}
        </AnimatePresence>
    );
};

interface SiteDetailsProps {
    site: TopologySite;
    links: TopologyLink[];
}

const SiteDetails: React.FC<SiteDetailsProps> = ({ site, links }) => (
    <>
        <div className="grid grid-cols-2 gap-2">
            <MetricPill label="Health" value={formatPercent(site.metrics.healthPct)} />
            <MetricPill
                label="Devices"
                value={formatNumber(site.metrics.activeDevices)}
            />
            <MetricPill label="Alerts" value={formatNumber(site.metrics.alerts)} />
            <MetricPill label="Latency" value={formatLatency(site.metrics.latencyMs)} />
        </div>
        <div className="rounded bg-white/5 border border-white/5 p-2 space-y-1">
            <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-slate-500">
                <Code2 className="w-3 h-3" />
                Telemetry Source
            </div>
            <p className="text-[10px] text-slate-300 leading-relaxed">
                {site.telemetrySource ??
                    (site.searchName
                        ? 'Awaiting normalized site telemetry'
                        : 'Configured topology item')}
            </p>
            <p className="text-[9px] text-slate-500 leading-relaxed">
                {site.dataState === 'live'
                    ? 'Live searchbase result'
                    : site.dataState === 'loading'
                    ? 'Loading searchbase result'
                    : site.dataState === 'error'
                    ? 'Searchbase result unavailable'
                    : 'Configured value'}
                {site.lastUpdated ? ` - Updated ${site.lastUpdated}` : ''}
                {site.dataState === 'error' && site.dataError
                    ? ` - ${site.dataError}`
                    : ''}
            </p>
        </div>
        {links.length > 0 && (
            <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-slate-500">
                    <Link2 className="w-3 h-3" />
                    Connected Paths
                </div>
                <div className="space-y-1">
                    {links.map((link) => (
                        <div
                            key={link.id}
                            className="flex items-center justify-between rounded bg-white/5 border border-white/5 px-2 py-1"
                        >
                            <span className="text-[10px] font-bold text-slate-300 truncate">
                                {link.name}
                            </span>
                            <span
                                className={cn(
                                    'ml-2 w-2 h-2 rounded-full flex-shrink-0',
                                    STATUS_DOT_CLASS[link.status]
                                )}
                                title={link.status}
                            />
                        </div>
                    ))}
                </div>
            </div>
        )}
    </>
);

interface LinkDetailsProps {
    link: TopologyLink;
    siteById: Record<string, TopologySite>;
}

const LinkDetails: React.FC<LinkDetailsProps> = ({ link, siteById }) => (
    <>
        <div className="grid grid-cols-2 gap-2">
            <MetricPill label="Capacity" value={formatMbps(link.capacityMbps)} />
            <MetricPill label="Throughput" value={formatMbps(link.throughputMbps)} />
            <MetricPill label="Utilization" value={formatPercent(link.utilizationPct)} />
            <MetricPill label="Latency" value={formatLatency(link.latencyMs)} />
            <MetricPill label="Loss" value={formatPercent(link.lossPct)} />
            <MetricPill
                label="Endpoint Health"
                value={formatPercent(link.endpointHealthPct)}
            />
        </div>
        <div className="rounded bg-white/5 border border-white/5 p-2 space-y-1">
            <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-slate-500">
                <Code2 className="w-3 h-3" />
                Telemetry Source
            </div>
            <p className="text-[10px] text-slate-300 leading-relaxed">
                {link.telemetrySource}
            </p>
            <p className="text-[9px] text-slate-500 leading-relaxed">
                {siteById[link.sourceSiteId]?.name ?? link.sourceSiteId} to{' '}
                {siteById[link.targetSiteId]?.name ?? link.targetSiteId}
                {link.lastUpdated ? ` - Updated ${link.lastUpdated}` : ''}
                {link.dataState === 'error' && link.dataError
                    ? ` - ${link.dataError}`
                    : ''}
            </p>
        </div>
    </>
);

interface MetricPillProps {
    label: string;
    value: string;
}

const MetricPill: React.FC<MetricPillProps> = ({ label, value }) => (
    <div className="flex flex-col bg-white/5 p-2 rounded border border-white/5">
        <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-1">
            {label}
        </span>
        <span className="text-lg font-black font-mono text-white leading-none truncate">
            {value}
        </span>
    </div>
);

interface LegendRowProps {
    color: string;
    label: string;
    id: string;
    isDark: boolean;
}

const LegendRow: React.FC<LegendRowProps> = ({ color, label, id, isDark }) => (
    <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
            <div className={cn('w-2 h-2 rounded-full flex-shrink-0', color)} />
            <span
                className={cn(
                    'text-[10px] font-bold truncate',
                    isDark ? 'text-slate-300' : 'text-slate-600'
                )}
            >
                {label}
            </span>
        </div>
        <span
            className={cn(
                'text-[10px] font-mono flex-shrink-0',
                isDark ? 'text-slate-500' : 'text-slate-400'
            )}
        >
            {id}
        </span>
    </div>
);

interface TopologySiteTableProps {
    topology?: CustomerTopology;
}

export const TopologySiteTable: React.FC<TopologySiteTableProps> = ({
    topology = CUSTOMER_TOPOLOGY,
}) => {
    const { topology: persistedTopology } = usePersistedTopology(topology);
    const linksBySite = useMemo(() => {
        const map: Record<string, TopologyLink[]> = {};
        for (const site of persistedTopology.sites) map[site.id] = [];
        for (const link of persistedTopology.links) {
            map[link.sourceSiteId]?.push(link);
            map[link.targetSiteId]?.push(link);
        }
        return map;
    }, [persistedTopology]);

    return (
        <div className="h-full w-full overflow-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-[11px] tabular-nums">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900/95 backdrop-blur-sm">
                    <tr className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                        <th className="px-3 py-2 font-black">Site</th>
                        <th className="px-3 py-2 font-black">Role</th>
                        <th className="px-3 py-2 font-black text-right">Health</th>
                        <th className="px-3 py-2 font-black text-right">Devices</th>
                        <th className="px-3 py-2 font-black text-right">Alerts</th>
                        <th className="px-3 py-2 font-black text-right">Path</th>
                        <th className="px-3 py-2 font-black text-right">Latency</th>
                    </tr>
                </thead>
                <tbody>
                    {persistedTopology.sites.map((site) => {
                        const siteLinks = linksBySite[site.id] ?? [];
                        const worstLink = [...siteLinks].sort(
                            (a, b) =>
                                STATUS_RANK[b.status] - STATUS_RANK[a.status]
                        )[0];
                        return (
                            <tr
                                key={site.id}
                                className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                            >
                                <td className="px-3 py-1.5">
                                    <div className="flex items-center gap-2">
                                        <span
                                            className={cn(
                                                'w-2 h-2 rounded-full flex-shrink-0',
                                                STATUS_DOT_CLASS[site.status]
                                            )}
                                            title={site.status}
                                        />
                                        <div className="flex flex-col leading-tight min-w-0">
                                            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-100 truncate">
                                                {site.name}
                                            </span>
                                            <span className="text-[9px] font-mono text-slate-400 dark:text-slate-500 uppercase">
                                                {site.shortName}
                                            </span>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                                    {ROLE_LABEL[site.role]}
                                </td>
                                <td className="px-3 py-1.5 text-right font-mono text-slate-700 dark:text-slate-200">
                                    {formatPercent(site.metrics.healthPct)}
                                </td>
                                <td className="px-3 py-1.5 text-right font-mono text-slate-700 dark:text-slate-200">
                                    {formatNumber(site.metrics.activeDevices)}
                                </td>
                                <td
                                    className={cn(
                                        'px-3 py-1.5 text-right font-mono font-bold',
                                        (site.metrics.alerts ?? 0) > 0
                                            ? 'text-red-500 dark:text-red-400'
                                            : 'text-slate-400 dark:text-slate-500'
                                    )}
                                >
                                    {formatNumber(site.metrics.alerts)}
                                </td>
                                <td className="px-3 py-1.5 text-right">
                                    {worstLink ? (
                                        <span
                                            className={cn(
                                                'inline-flex items-center justify-end gap-1 font-mono font-bold',
                                                worstLink.status === 'critical'
                                                    ? 'text-red-500 dark:text-red-400'
                                                    : worstLink.status === 'warning'
                                                    ? 'text-amber-500 dark:text-amber-300'
                                                    : 'text-emerald-500 dark:text-emerald-300'
                                            )}
                                        >
                                            <span
                                                className={cn(
                                                    'w-1.5 h-1.5 rounded-full',
                                                    STATUS_DOT_CLASS[worstLink.status]
                                                )}
                                            />
                                            {worstLink.status}
                                        </span>
                                    ) : (
                                        <span className="text-slate-400">Awaiting</span>
                                    )}
                                </td>
                                <td className="px-3 py-1.5 text-right font-mono text-slate-700 dark:text-slate-200">
                                    {formatLatency(worstLink?.latencyMs)}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};
