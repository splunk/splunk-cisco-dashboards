/**
 * CustomerTopologyMap
 *
 * Live cyber-twin renderer for the executive topology card.
 *
 * Requirements implemented:
 * - Mapbox GL map background with an overlaid digital-twin layer.
 * - Geodesic arc links (SVG path segments from lat/lon interpolation).
 * - Flow animation on links, where pace is derived from throughput_mbps / 1000.
 * - Glass-hex site markers with status-driven pulse effects.
 * - Collision-aware label placement to avoid overlapping city names.
 * - Realtime Splunk poll manager with Spark-Preview-style rAF batching.
 */

import React,
    {
        useCallback,
        useEffect,
        useMemo,
        useRef,
        useState,
    } from 'react';
import Button from '@splunk/react-ui/Button';
import Card from '@splunk/react-ui/Card';
import { addLeadingSearchCommand } from '@splunk/splunk-utils/search';
import { cn } from '@/common/lib/utils';
import {
    getSearchbaseCatalogue,
    type SearchbaseRecord,
} from '@/common/services/searchbaseCatalogue';
import { runSearch } from '@/common/services/splunkSearchService';
import type {
    CustomerTopology,
    TopologyLink,
    TopologySite,
    TopologyStatus,
} from '@/common/types';

declare global {
    interface Window {
        mapboxgl?: any;
    }
}

type SearchManagerDataSet = {
    on: (event: string, handler: (event?: unknown) => void) => void;
    off?: (event: string, handler: (event?: unknown) => void) => void;
    toJSON: () => Record<string, unknown> | Record<string, unknown>[];
};

type SearchManagerAdapter = {
    on: (event: string, handler: (event?: unknown) => void) => void;
    off?: (event: string, handler: (event?: unknown) => void) => void;
    startSearch: () => void;
    cancel?: () => void;
    dispose?: () => void;
    data: (name: string) => SearchManagerDataSet;
    set?: (name: string, value: unknown) => void;
};

type SearchManagerFactory = {
    create: (config: Record<string, unknown>) => SearchManagerAdapter;
};

type LiveSearchStatus = 'live' | 'loading' | 'error' | 'static';

type TopologyHexState = TopologyStatus;

type SiteLiveState = {
    activeDevices?: number;
    alerts?: number;
    healthPct?: number;
    latencyMs?: number;
    dataState?: Exclude<LiveSearchStatus, 'loading'>;
    telemetrySource?: string;
    lastUpdated?: string;
    dataError?: string;
    status?: TopologyStatus;
};

type LinkLiveState = {
    capacityMbps?: number;
    throughputMbps?: number;
    peakThroughputMbps?: number;
    utilizationPct?: number;
    peakUtilizationPct?: number;
    latencyMs?: number;
    lossPct?: number;
    endpointHealthPct?: number;
    endpointDevices?: number;
    dataState?: Exclude<LiveSearchStatus, 'loading'>;
    telemetrySource?: string;
    lastUpdated?: string;
    dataError?: string;
    status?: TopologyStatus;
};

type SiteSummary = {
    [siteId: string]: SiteLiveState;
};

type LinkSummary = {
    [linkId: string]: LinkLiveState;
};

interface SearchManagerSnapshot {
    sites: SiteSummary;
    links: LinkSummary;
    summary: Record<string, string | number>;
    updatedAt: string;
}

const PRIMARY = '#00f2ff';
const ALERT = '#ff4d4d';
const MAPBOX_VERSION = 'v3.8.0';
const MAPBOX_JS = `https://api.mapbox.com/mapbox-gl-js/${MAPBOX_VERSION}/mapbox-gl.js`;
const MAPBOX_CSS = `https://api.mapbox.com/mapbox-gl-js/${MAPBOX_VERSION}/mapbox-gl.css`;
const DEFAULT_POLL_MS = 1000;
const MIN_FLOW_SPEED = 0.3;
const MAX_FLOW_SPEED = 8;
const GEODESIC_SEGMENTS = 60;

const STATUS_FILL: Record<TopologyHexState, string> = {
    critical: 'rgba(255, 77, 77, 0.28)',
    stable: 'rgba(0, 242, 255, 0.28)',
    warning: 'rgba(255, 173, 67, 0.28)',
    unknown: 'rgba(142, 156, 173, 0.22)',
};

const STATUS_BORDER: Record<TopologyHexState, string> = {
    critical: ALERT,
    stable: PRIMARY,
    warning: '#fbbf24',
    unknown: '#8e9cad',
};

const DEFAULT_TOPOLOGY_MAP_STYLE: CustomerTopology = {
    id: 'customer-site-connectivity',
    name: 'Florida Digital Twin',
    subtitle: 'Optimized, streaming topology flow surface',
    telemetrySearchName: undefined,
    map: {
        center: [28.54, -81.38],
        zoom: 5.9,
        minZoom: 4,
        maxZoom: 12,
        bounds: [
            [22.8, -90.6],
            [33.5, -75.7],
        ],
    },
    sites: [
        {
            id: 'mco',
            name: 'Miami Metro Hub',
            shortName: 'MIA',
            role: 'regional_hub',
            lat: 28.5383,
            lng: -81.3792,
            status: 'stable',
            metrics: {},
            telemetrySource: 'Awaiting normalized site telemetry',
        },
        {
            id: 'tlh',
            name: 'Tallahassee HQ',
            shortName: 'TLH',
            role: 'state_hq',
            lat: 30.4383,
            lng: -84.2807,
            status: 'stable',
            metrics: {},
            telemetrySource: 'Awaiting normalized site telemetry',
        },
        {
            id: 'aft',
            name: 'Auburndale Logistics',
            shortName: 'AFT',
            role: 'logistics',
            lat: 28.0653,
            lng: -81.7876,
            status: 'stable',
            metrics: {},
            telemetrySource: 'Awaiting normalized site telemetry',
        },
    ],
    links: [
        {
            id: 'mco-tlh',
            name: 'MIA ↔ TLH',
            sourceSiteId: 'mco',
            targetSiteId: 'tlh',
            status: 'stable',
            telemetrySource: 'Awaiting topology link telemetry',
        },
        {
            id: 'aft-tlh',
            name: 'AFT ↔ TLH',
            sourceSiteId: 'aft',
            targetSiteId: 'tlh',
            status: 'stable',
            telemetrySource: 'Awaiting topology link telemetry',
        },
        {
            id: 'mco-aft',
            name: 'MIA ↔ AFT',
            sourceSiteId: 'mco',
            targetSiteId: 'aft',
            status: 'stable',
            telemetrySource: 'Awaiting topology link telemetry',
        },
    ],
};

interface CustomerTopologyMapProps {
    topology?: CustomerTopology;
    mapboxAccessToken?: string;
    pollIntervalMs?: number;
    isDark?: boolean;
    earliestTime?: string;
    latestTime?: string;
    refreshToken?: number;
    darkMode?: boolean;
    onSummaryMetricsChange?: (metrics: TopologySummaryMetricMap) => void;
    onOpenInSearch?: (spl: string) => void;
}

export interface TopologySummaryMetric {
    id: string;
    label?: string;
    value: string;
    source: 'live' | 'mock' | 'loading';
}

export type TopologySummaryMetricMap = Record<string, TopologySummaryMetric>;

type SearchSourceShape = {
    siteId?: string;
    linkId?: string;
    targetSiteId?: string;
    sourceSiteId?: string;
    status?: TopologyHexState;
    activeDevices?: number;
    alerts?: number;
    healthPct?: number;
    latencyMs?: number;
    capacityMbps?: number;
    throughputMbps?: number;
    peakThroughputMbps?: number;
    utilizationPct?: number;
    peakUtilizationPct?: number;
    lossPct?: number;
    endpointHealthPct?: number;
    endpointDevices?: number;
};

type ProjectedSite = TopologySite & {
    x: number;
    y: number;
};

type LabelNode = {
    id: string;
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
    visible: boolean;
};

type RenderLink = {
    id: string;
    name: string;
    fromLabel: string;
    toLabel: string;
    path: string;
    throughputMbps?: number;
    status: TopologyHexState;
    utilizationPct?: number;
    telemetrySource?: string;
    lastUpdated?: string;
    dataState?: LiveSearchStatus;
    flowSpeed: number;
};

type RenderViewport = {
    sites: ProjectedSite[];
    links: RenderLink[];
    labels: LabelNode[];
    showCityLabels: boolean;
};

const toNumber = (raw: unknown): number | undefined => {
    if (raw === null || raw === undefined || raw === '') return undefined;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
};

const toStatus = (raw: unknown): TopologyHexState => {
    if (typeof raw !== 'string') return 'unknown';
    const normalized = raw.trim().toLowerCase();
    if (normalized === 'critical' || normalized === 'down' || normalized === 'bad') {
        return 'critical';
    }
    if (
        normalized === 'warning' ||
        normalized === 'degraded' ||
        normalized === 'risk'
    ) {
        return 'warning';
    }
    if (
        normalized === 'healthy' ||
        normalized === 'stable' ||
        normalized === 'ok' ||
        normalized === 'good' ||
        normalized === 'normal'
    ) {
        return 'stable';
    }
    return 'unknown';
};

const safeText = (raw: unknown, fallback = ''): string => {
    if (raw === null || raw === undefined) return fallback;
    const value = String(raw).trim();
    return value.length > 0 ? value : fallback;
};

const parseSummaryValue = (row: Record<string, unknown>, ...keys: string[]): number | undefined => {
    for (const key of keys) {
        const value = toNumber(row[key]);
        if (value !== undefined) return value;
    }
    return undefined;
};

const parseStatusValue = (row: Record<string, unknown>, ...keys: string[]): TopologyHexState => {
    for (const key of keys) {
        const raw = row[key];
        if (raw !== undefined) {
            const normalized = toStatus(raw);
            if (normalized !== 'unknown') {
                return normalized;
            }
        }
    }
    return 'unknown';
};

const parseSearchbaseSearch = async (
    name: string,
    catalog: Map<string, SearchbaseRecord>,
    earliest: string,
    latest: string,
): Promise<Record<string, unknown>[]> => {
    const entry = catalog.get(name);
    if (!entry?.search) return [];
    const response = await runSearch({
        spl: addLeadingSearchCommand(entry.search),
        earliestTime: earliest,
        latestTime: latest,
        tag: name,
    });
    return Array.isArray(response.results)
        ? response.results.map((row) => row as Record<string, unknown>)
        : [];
};

let searchManagerModulePromise: Promise<SearchManagerFactory | null> | null = null;

const loadSearchManagerModule = (): Promise<SearchManagerFactory | null> => {
    if (searchManagerModulePromise) {
        return searchManagerModulePromise;
    }

    searchManagerModulePromise = new Promise((resolve) => {
        const requireFn = (window as unknown as {
            require?: (...args: unknown[]) => unknown;
        }).require;
        if (typeof window === 'undefined' || !requireFn) {
            resolve(null);
            return;
        }

        (requireFn as (
            deps: string[],
            onLoad: (splunkMvc: {
                SearchManager: new (config: Record<string, unknown>) => SearchManagerAdapter;
            }) => void,
            onError?: (error: unknown) => void,
        ) => void)([
            'splunkjs/mvc',
        ], (splunkMvc: {
            SearchManager: new (config: Record<string, unknown>) => SearchManagerAdapter;
        }) => {
            if (!splunkMvc?.SearchManager) {
                resolve(null);
                return;
            }

            resolve({
                create: (config: Record<string, unknown>): SearchManagerAdapter => {
                    return new splunkMvc.SearchManager(config) as SearchManagerAdapter;
                },
            });
        }, () => resolve(null));
    });

    return searchManagerModulePromise;
};

const normalizeSearchResults = (
    resultData: SearchManagerDataSet | Record<string, unknown> | Record<string, unknown>[] | null,
): Record<string, unknown>[] => {
    if (!resultData) return [];

    if (Array.isArray(resultData)) {
        return resultData as Record<string, unknown>[];
    }

    const payload = resultData;
    if (Array.isArray((payload as Record<string, unknown>).results)) {
        return (payload as { results: Record<string, unknown>[] }).results;
    }

    if (Array.isArray((payload as { rows: unknown[] }).rows)) {
        const rows = (payload as { rows: unknown[] }).rows;
        const fields = ((payload as { fields: { name: string }[] }).fields ?? []) as {
            name: string;
        }[];
        const fieldNames = fields.map((field) => field.name);
        if (!fieldNames.length) return [];
        return rows
            .map((row) => {
                if (!Array.isArray(row)) return null;
                const values = row as unknown[];
                const obj: Record<string, unknown> = {};
                fieldNames.forEach((name, index) => {
                    obj[name] = values[index];
                });
                return obj;
            })
            .filter((row): row is Record<string, unknown> => row !== null);
    }

    return [];
};

const topologyIdSafe = (raw: string): string =>
    raw.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/-+/g, '-').slice(0, 80);

type SearchManagerSubscription = {
    searchName: string;
    manager: SearchManagerAdapter;
    results: SearchManagerDataSet;
    onData: (event?: unknown) => void;
    onError: (event?: unknown) => void;
};

class TopologySearchManager {
    private timer: number | null = null;
    private commitFrame: ReturnType<typeof requestAnimationFrame> | null = null;
    private catalog: Map<string, SearchbaseRecord> = new Map();
    private subscriptions = new Map<string, SearchManagerSubscription>();
    private usingSearchManager = false;
    private mounted = false;
    private hasData = false;
    private snapshot: SearchManagerSnapshot = {
        sites: {},
        links: {},
        summary: {},
        updatedAt: new Date().toISOString(),
    };

    constructor(
        private topology: CustomerTopology,
        private pollIntervalMs: number,
        private earliestTime: string,
        private latestTime: string,
        private onUpdate: (snapshot: SearchManagerSnapshot) => void,
        private onError: (error: string | null) => void
    ) {}

    async start(): Promise<void> {
        this.stop();
        this.mounted = true;
        this.hasData = false;
        this.snapshot = {
            sites: {},
            links: {},
            summary: {},
            updatedAt: new Date().toISOString(),
        };
        await this.loadCatalog();
        const targets = this.collectSearchTargets();
        const uniqueSearches = new Set<string>([
            ...(targets.topologySearch ? [targets.topologySearch] : []),
            ...targets.siteSearchNames,
            ...targets.linkSearchNames,
        ]);
        const searchNames = [...uniqueSearches.values()];

        const factory = await loadSearchManagerModule();
        if (!searchNames.length) {
            this.onError('No topology search bindings configured for the selected topology.');
            this.onUpdate(this.snapshot);
            return;
        }

        if (factory) {
            const started = await this.startSearchManagers(searchNames, factory);
            if (started) {
                this.usingSearchManager = true;
                return;
            }
        }

        this.usingSearchManager = false;
        this.onError(
            factory === null
                ? 'SearchManager runtime unavailable; falling back to polling.'
                : 'No topology searches could start; falling back to polling.',
        );
        await this.tick(searchNames);
        this.timer = window.setInterval(() => {
            void this.tick(searchNames);
        }, this.pollIntervalMs);
    }

    stop(): void {
        this.mounted = false;
        this.stopSearchManagers();
        if (this.timer) {
            window.clearInterval(this.timer);
            this.timer = null;
        }
        if (this.commitFrame) {
            cancelAnimationFrame(this.commitFrame);
            this.commitFrame = null;
        }
    }

    private async loadCatalog(): Promise<void> {
        if (this.catalog.size) return;
        try {
            const latest = await getSearchbaseCatalogue();
            this.catalog = new Map(latest.map((entry) => [entry.searchName, entry]));
            this.onError(null);
        } catch {
            this.catalog = new Map();
            this.onError('Unable to load searchbase.conf search bindings.');
        }
    }

    private collectSearchTargets(): {
        topologySearch?: string;
        siteSearchNames: string[];
        linkSearchNames: string[];
    } {
        const siteSearchNames =
            this.topology.sites
                .map((site) => site.searchName)
                .filter((name): name is string => typeof name === 'string' && name.length > 0);
        const linkSearchNames =
            this.topology.links
                .map((link) => link.searchName)
                .filter((name): name is string => typeof name === 'string' && name.length > 0);

        return {
            topologySearch: this.topology.telemetrySearchName,
            siteSearchNames: Array.from(new Set(siteSearchNames)),
            linkSearchNames: Array.from(new Set(linkSearchNames)),
        };
    }

    private collectSearchNamesFromTargets(): string[] {
        const targets = this.collectSearchTargets();
        return [
            ...(targets.topologySearch ? [targets.topologySearch] : []),
            ...targets.siteSearchNames,
            ...targets.linkSearchNames,
        ];
    }

    private mapSearchNamesToRows(
        rows: Record<string, unknown>[],
        snapshot: SearchManagerSnapshot,
        queryName: string,
    ): void {
        const siteById: Map<string, TopologySite> = new Map(
            this.topology.sites.map((site) => [site.id, site]),
        );
        const linkById: Map<string, TopologyLink> = new Map(
            this.topology.links.map((link) => [link.id, link]),
        );

        for (const row of rows) {
            const sourceSiteId =
                typeof row.site_id === 'string'
                    ? row.site_id
                    : typeof row.site === 'string'
                      ? row.site
                      : undefined;
            const sourceShort =
                typeof row.site_short_name === 'string' ? row.site_short_name : undefined;
            const candidateSiteId = siteById.has(sourceSiteId || '')
                ? sourceSiteId
                : siteById.has(sourceShort || '')
                  ? sourceShort
                  : undefined;

            const sourceLinkId =
                typeof row.link_id === 'string'
                    ? row.link_id
                    : typeof row.link === 'string'
                      ? row.link
                      : undefined;

            const normalizedSource = row.source_site_id || row.from_site || row.src_site;
            const normalizedTarget = row.target_site_id || row.to_site || row.dst_site;
            const maybeLinkId =
                sourceLinkId && linkById.has(sourceLinkId)
                    ? sourceLinkId
                    : this.findLinkIdFromEndpoints(
                          String(normalizedSource || ''),
                          String(normalizedTarget || ''),
                          linkById,
                      );

            if (candidateSiteId && siteById.has(candidateSiteId)) {
                const existing = snapshot.sites[candidateSiteId] ?? {};
                const healthPct = parseSummaryValue(
                    row,
                    'health_pct',
                    'health',
                    'healthPercent',
                    'site_health_pct',
                    'health_pct_normalized',
                );
                const activeDevices = parseSummaryValue(
                    row,
                    'active_devices',
                    'activeDevices',
                    'devices',
                    'active_device_count',
                    'device_count',
                );
                const alerts = parseSummaryValue(
                    row,
                    'alerts',
                    'alert_count',
                    'num_alerts',
                    'critical_alert_count',
                );
                const latencyMs = parseSummaryValue(
                    row,
                    'latency_ms',
                    'latency',
                    'avg_latency_ms',
                );

                snapshot.sites[candidateSiteId] = {
                    ...existing,
                    activeDevices:
                        activeDevices !== undefined ? activeDevices : existing.activeDevices,
                    alerts: alerts !== undefined ? alerts : existing.alerts,
                    healthPct: healthPct !== undefined ? healthPct : existing.healthPct,
                    latencyMs: latencyMs !== undefined ? latencyMs : existing.latencyMs,
                    status: parseStatusValue(
                        row,
                        'status',
                        'site_status',
                        'health_state',
                    ),
                    telemetrySource: `searchbase ${queryName}`,
                    dataState: 'live',
                    lastUpdated: new Date().toISOString(),
                };
                continue;
            }

            if (maybeLinkId && linkById.has(maybeLinkId)) {
                const existing = snapshot.links[maybeLinkId] ?? {};
                const throughputMbps = parseSummaryValue(
                    row,
                    'throughput_mbps',
                    'throughput',
                    'throughput_bits_per_second',
                );
                const capacityMbps = parseSummaryValue(
                    row,
                    'capacity_mbps',
                    'capacity',
                    'link_capacity_mbps',
                );
                const utilizationPct = parseSummaryValue(
                    row,
                    'utilization_pct',
                    'utilization',
                    'util',
                );
                const peakThroughputMbps = parseSummaryValue(
                    row,
                    'peak_throughput_mbps',
                    'throughput_peak',
                );
                const peakUtilizationPct = parseSummaryValue(
                    row,
                    'peak_utilization_pct',
                    'utilization_peak',
                );
                const latencyMs = parseSummaryValue(
                    row,
                    'latency_ms',
                    'latency',
                );
                const lossPct = parseSummaryValue(row, 'loss_pct', 'loss', 'loss_percent');
                const endpointHealthPct = parseSummaryValue(
                    row,
                    'endpoint_health_pct',
                    'end_point_health',
                );
                const endpointDevices = parseSummaryValue(
                    row,
                    'endpoint_devices',
                    'endpoint_device_count',
                );

                snapshot.links[maybeLinkId] = {
                    ...existing,
                    capacityMbps: capacityMbps !== undefined ? capacityMbps : existing.capacityMbps,
                    throughputMbps:
                        throughputMbps !== undefined
                            ? throughputMbps
                            : existing.throughputMbps,
                    peakThroughputMbps:
                        peakThroughputMbps !== undefined
                            ? peakThroughputMbps
                            : existing.peakThroughputMbps,
                    utilizationPct:
                        utilizationPct !== undefined
                            ? utilizationPct
                            : existing.utilizationPct,
                    peakUtilizationPct:
                        peakUtilizationPct !== undefined
                            ? peakUtilizationPct
                            : existing.peakUtilizationPct,
                    latencyMs: latencyMs !== undefined ? latencyMs : existing.latencyMs,
                    lossPct: lossPct !== undefined ? lossPct : existing.lossPct,
                    endpointHealthPct:
                        endpointHealthPct !== undefined
                            ? endpointHealthPct
                            : existing.endpointHealthPct,
                    endpointDevices:
                        endpointDevices !== undefined
                            ? endpointDevices
                            : existing.endpointDevices,
                    status: parseStatusValue(
                        row,
                        'status',
                        'link_status',
                        'quality_state',
                    ),
                    telemetrySource: `searchbase ${queryName}`,
                    dataState: 'live',
                    lastUpdated: new Date().toISOString(),
                };
                continue;
            }

            // Fallback: one composite search can emit prefixed payloads like
            // site_<id>_throughput_mbps or link_<id>_utilization_pct.
            for (const site of this.topology.sites) {
                const prefix = `site_${site.id}_`;
                const candidate: SiteLiveState = snapshot.sites[site.id] ?? {};
                const fields = Object.keys(row);
                const byPrefix = fields.some((field) => field.startsWith(prefix));
                if (!byPrefix) continue;
                const activeDevices = parseSummaryValue(row, `${prefix}active_devices`, `${prefix}activeDevices`);
                const alerts = parseSummaryValue(row, `${prefix}alerts`, `${prefix}alert_count`);
                const healthPct = parseSummaryValue(
                    row,
                    `${prefix}health_pct`,
                    `${prefix}healthPercent`,
                );
                const latencyMs = parseSummaryValue(row, `${prefix}latency_ms`, `${prefix}latency`);

                if (
                    activeDevices !== undefined ||
                    alerts !== undefined ||
                    healthPct !== undefined ||
                    latencyMs !== undefined
                ) {
                    snapshot.sites[site.id] = {
                        ...candidate,
                        activeDevices,
                        alerts,
                        healthPct,
                        latencyMs,
                        status: parseStatusValue(row, `${prefix}status`, `${prefix}state`),
                        telemetrySource: `searchbase ${queryName}`,
                        dataState: 'live',
                        lastUpdated: new Date().toISOString(),
                    };
                }
            }

            for (const link of this.topology.links) {
                const prefix = `link_${link.id}_`;
                const candidate: LinkLiveState = snapshot.links[link.id] ?? {};
                const fields = Object.keys(row);
                const byPrefix = fields.some((field) => field.startsWith(prefix));
                if (!byPrefix) continue;

                const throughputMbps = parseSummaryValue(
                    row,
                    `${prefix}throughput_mbps`,
                    `${prefix}throughput`,
                );
                const utilizationPct = parseSummaryValue(
                    row,
                    `${prefix}utilization_pct`,
                    `${prefix}utilization`,
                );
                const capacityMbps = parseSummaryValue(
                    row,
                    `${prefix}capacity_mbps`,
                    `${prefix}capacity`,
                );
                const latencyMs = parseSummaryValue(row, `${prefix}latency_ms`, `${prefix}latency`);

                if (
                    throughputMbps !== undefined ||
                    utilizationPct !== undefined ||
                    capacityMbps !== undefined ||
                    latencyMs !== undefined
                ) {
                    snapshot.links[link.id] = {
                        ...candidate,
                        throughputMbps,
                        utilizationPct,
                        capacityMbps,
                        latencyMs,
                        status: parseStatusValue(row, `${prefix}status`, `${prefix}state`),
                        telemetrySource: `searchbase ${queryName}`,
                        dataState: 'live',
                        lastUpdated: new Date().toISOString(),
                    };
                }
            }
        }
    }

    private findLinkIdFromEndpoints(
        sourceSiteId: string,
        targetSiteId: string,
        linkById: Map<string, TopologyLink>,
    ): string | undefined {
        const normalizedSource = String(sourceSiteId || '').trim();
        const normalizedTarget = String(targetSiteId || '').trim();
        if (!normalizedSource || !normalizedTarget) return undefined;

        const direct = `${normalizedSource}-${normalizedTarget}`;
        const reverse = `${normalizedTarget}-${normalizedSource}`;

        for (const id of linkById.keys()) {
            if (id === direct || id === reverse) {
                return id;
            }
        }

        const sourceInName =
            [...linkById.keys()].find((id) =>
                id.includes(normalizedSource) && id.includes(normalizedTarget)
            );
        return sourceInName;
    }

    private async startSearchManagers(
        searchNames: string[],
        factory: SearchManagerFactory,
    ): Promise<boolean> {
        let startedAny = false;

        for (const searchName of searchNames) {
            const entry = this.catalog.get(searchName);
            if (!entry?.search) {
                this.onError(`No searchbase stanza found for ${searchName}.`);
                continue;
            }

            try {
                const manager = factory.create({
                    id: `cisco-topology-${topologyIdSafe(searchName)}`,
                    search: addLeadingSearchCommand(entry.search),
                    earliest_time: this.earliestTime,
                    latest_time: this.latestTime,
                    preview: true,
                    cache: false,
                    autostart: true,
                });
                const dataSet = manager.data('results');
                const onData = (event?: unknown) => {
                    this.onManagerData(searchName, dataSet, event);
                };
                const onError = (event?: unknown) => {
                    this.onManagerError(searchName, event);
                };

                dataSet.on('data', onData);
                manager.on?.('search:error', onError);
                manager.on?.('search:failed', onError);
                manager.on?.('error', onError);

                this.subscriptions.set(searchName, {
                    searchName,
                    manager,
                    results: dataSet,
                    onData,
                    onError,
                });

                startedAny = true;
                manager.startSearch?.();
                this.onManagerData(searchName, dataSet, dataSet.toJSON());
            } catch (error) {
                this.onError(
                    `Unable to start topology SearchManager for ${searchName}: ${
                        error instanceof Error ? error.message : 'unknown'
                    }`
                );
            }
        }

        if (!startedAny) {
            return false;
        }

        this.usingSearchManager = true;
        return true;
    }

    private stopSearchManagers(): void {
        for (const sub of this.subscriptions.values()) {
            sub.results.off?.('data', sub.onData);
            const manager = sub.manager;
            manager.off?.('search:error', sub.onError);
            manager.off?.('search:failed', sub.onError);
            manager.off?.('error', sub.onError);
            manager.cancel?.();
            manager.dispose?.();
        }
        this.subscriptions.clear();
    }

    private onManagerData(
        searchName: string,
        dataSet: SearchManagerDataSet,
        event?: unknown,
    ): void {
        if (!this.mounted) return;

        const rows = this.normalizeSearchManagerRows(searchName, event, dataSet);
        this.snapshot.summary[searchName] = rows.length;
        if (rows.length) {
            this.hasData = true;
            this.mapSearchNamesToRows(rows, this.snapshot, searchName);
        }
        this.snapshot.updatedAt = new Date().toISOString();
        this.schedulePublish();
    }

    private onManagerError(searchName: string, event?: unknown): void {
        if (!this.mounted) return;
        const message =
            event instanceof Error
                ? `${searchName}: ${event.message}`
                : typeof event === 'string'
                  ? `${searchName}: ${event}`
                  : `${searchName}: topology stream error`;
        this.onError(message);
    }

    private normalizeSearchManagerRows(
        _searchName: string,
        event: unknown,
        dataSet: SearchManagerDataSet,
    ): Record<string, unknown>[] {
        if (event) {
            const fromEvent = normalizeSearchResults(event as Record<string, unknown>);
            if (fromEvent.length) return fromEvent;
        }

        const source = dataSet?.toJSON ? dataSet.toJSON() : null;
        return normalizeSearchResults(source as Record<string, unknown>);
    }

    private schedulePublish(): void {
        if (!this.mounted || this.commitFrame !== null) return;

        this.commitFrame = requestAnimationFrame(() => {
            this.commitFrame = null;
            if (!this.mounted) return;

            const snapshot = this.snapshot;
            this.onUpdate({
                ...snapshot,
                sites: { ...snapshot.sites },
                links: { ...snapshot.links },
                summary: { ...snapshot.summary },
            });

            if (!this.hasData) {
                this.onError('No topology telemetry rows have been received yet.');
            } else {
                this.onError(null);
            }
        });
    }

    private async tick(searchNames?: string[]): Promise<void> {
        if (!this.mounted) return;

        const latest = this.latestTime;
        const earliest = this.earliestTime;
        const snapshot: SearchManagerSnapshot = {
            sites: {},
            links: {},
            summary: {},
            updatedAt: new Date().toISOString(),
        };

        try {
            const catalogLoaded = this.catalog.size > 0;
            if (!catalogLoaded) {
                await this.loadCatalog();
            }

            const uniqueSearches = new Set<string>(
                searchNames && searchNames.length
                    ? searchNames
                    : this.collectSearchNamesFromTargets(),
            );

            const queries = [...uniqueSearches.values()].map((searchName) =>
                parseSearchbaseSearch(searchName, this.catalog, earliest, latest)
                    .then((rows) => ({ searchName, rows, err: null as string | null }))
                    .catch((err: unknown) => ({
                        searchName,
                        rows: [] as Record<string, unknown>[],
                        err: err instanceof Error ? err.message : 'search failed',
                    }))
            );

            const executed = await Promise.all(queries);
            let hadData = false;

            for (const result of executed) {
                if (!this.mounted) return;
                if (result.err) {
                    this.onError(result.err);
                    continue;
                }

                const { searchName, rows } = result;
                if (rows.length > 0) {
                    hadData = true;
                }
                this.mapSearchNamesToRows(rows, snapshot, searchName);
            }

            this.onUpdate(hadData ? snapshot : this.withMissingAsError(snapshot));
            this.onError(hadData ? null : 'No telemetry returned for this polling cycle.');
        } catch (error) {
            this.onError(
                error instanceof Error
                    ? error.message
                    : 'Topology realtime stream temporarily unavailable.'
            );
            this.onUpdate(snapshot);
        }
    }

    private withMissingAsError(snapshot: SearchManagerSnapshot): SearchManagerSnapshot {
        const erroredSites: SiteSummary = {};
        for (const site of this.topology.sites) {
            const existing = snapshot.sites[site.id];
            erroredSites[site.id] = {
                ...existing,
                dataState: existing ? existing.dataState : 'error',
                dataError: existing?.dataError || 'No live telemetry row returned yet',
                telemetrySource:
                    existing?.telemetrySource ?? 'Awaiting normalized site telemetry',
            };
        }

        const erroredLinks: LinkSummary = {};
        for (const link of this.topology.links) {
            const existing = snapshot.links[link.id];
            erroredLinks[link.id] = {
                ...existing,
                dataState: existing ? existing.dataState : 'error',
                dataError: existing?.dataError || 'No live telemetry row returned yet',
                telemetrySource:
                    existing?.telemetrySource ?? 'Awaiting topology link telemetry',
            };
        }

        return {
            ...snapshot,
            sites: erroredSites,
            links: erroredLinks,
        };
    }
}

let mapboxLoadPromise: Promise<typeof window.mapboxgl> | null = null;

const loadMapbox = (accessToken: string): Promise<typeof window.mapboxgl> => {
    if (typeof window === 'undefined') {
        return Promise.reject(new Error('Map rendering unavailable in this environment.'));
    }

    if (window.mapboxgl) {
        if (accessToken) {
            window.mapboxgl.accessToken = accessToken;
        }
        return Promise.resolve(window.mapboxgl);
    }

    if (mapboxLoadPromise) {
        return mapboxLoadPromise;
    }

    mapboxLoadPromise = new Promise((resolve, reject) => {
        const css = document.createElement('link');
        css.rel = 'stylesheet';
        css.href = MAPBOX_CSS;
        css.dataset.role = 'mapbox-cisco-style';
        if (!document.querySelector(`link[data-role="mapbox-cisco-style"]`)) {
            document.head.appendChild(css);
        }

        const script = document.createElement('script');
        script.src = MAPBOX_JS;
        script.async = true;
        script.onload = () => {
            if (!window.mapboxgl) {
                reject(new Error('Mapbox failed to initialize.'));
                return;
            }
            if (accessToken) {
                window.mapboxgl.accessToken = accessToken;
            }
            resolve(window.mapboxgl);
        };
        script.onerror = () =>
            reject(new Error('Failed to load Mapbox runtime from CDN.'));
        document.body.appendChild(script);
    });

    return mapboxLoadPromise;
};

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;
const toDegrees = (radians: number): number => (radians * 180) / Math.PI;

const wrapLng = (lng: number): number => {
    if (lng > 180) return ((lng + 180) % 360) - 180;
    if (lng < -180) return ((lng - 180) % 360) + 180;
    return lng;
};

const geodesic = (
    source: [number, number],
    target: [number, number],
    segments = GEODESIC_SEGMENTS,
): [number, number][] => {
    const [lng1Deg, lat1Deg] = source;
    const [lng2Deg, lat2Deg] = target;

    const φ1 = toRadians(lat1Deg);
    const φ2 = toRadians(lat2Deg);
    const λ1 = toRadians(lng1Deg);
    const λ2 = toRadians(lng2Deg);
    const d = 2 * Math.asin(
        Math.sqrt(
            Math.sin((φ2 - φ1) / 2) ** 2 +
                Math.cos(φ1) * Math.cos(φ2) * Math.sin((λ2 - λ1) / 2) ** 2,
        ),
    );

    if (d === 0) {
        return [source, target];
    }

    const points: [number, number][] = [];
    for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const A = Math.sin((1 - t) * d) / Math.sin(d);
        const B = Math.sin(t * d) / Math.sin(d);

        const x =
            A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
        const y =
            A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
        const z = A * Math.sin(φ1) + B * Math.sin(φ2);

        const φ = Math.atan2(z, Math.sqrt(x * x + y * y));
        const λ = Math.atan2(y, x);

        points.push([wrapLng(toDegrees(λ)), toDegrees(φ)]);
    }

    return points;
};

const pathFromCoordinates = (points: [number, number][]): string => {
    if (points.length === 0) return '';
    const [x0, y0] = points[0];
    return points
        .map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${x.toFixed(3)} ${y.toFixed(3)}`)
        .join(' ');
};

const measure = (
    text: string,
    opts: { size?: number; paddingX?: number; paddingY?: number },
): { width: number; height: number } => {
    const size = opts.size ?? 11;
    const width = Math.max(48, text.length * (size * 0.65) + (opts.paddingX ?? 22));
    const height = (size ?? 11) + (opts.paddingY ?? 8);
    return { width, height };
};

const overlaps = (a: LabelNode, b: LabelNode): boolean => {
    if (!a.visible || !b.visible) return false;
    return !(
        a.x + a.width < b.x ||
        b.x + b.width < a.x ||
        a.y + a.height < b.y ||
        b.y + b.height < a.y
    );
};

const placeLabel = (
    candidates: LabelNode[],
    id: string,
    text: string,
    x: number,
    y: number,
    margin = 16,
): LabelNode => {
    const { width, height } = measure(text, { size: 11, paddingX: 12, paddingY: 6 });
    const tries = [
        { x: 0, y: -36 },
        { x: 16, y: -20 },
        { x: -16, y: -20 },
        { x: 0, y: 20 },
        { x: 16, y: 20 },
        { x: -16, y: 20 },
    ];

    for (const candidate of tries) {
        const node: LabelNode = {
            id,
            text,
            x: x + candidate.x,
            y: y + candidate.y,
            width,
            height,
            visible: false,
        };

        const collides = candidates.some((existing) => overlaps(node, existing));
        if (!collides) {
            node.visible = true;
            candidates.push(node);
            return node;
        }
    }

    const fallback: LabelNode = {
        id,
        text,
        x,
        y,
        width,
        height: 0,
        visible: false,
    };
    return fallback;
};

const statusPulseClass = (status: TopologyHexState): string => {
    if (status === 'critical') return 'site-critical';
    if (status === 'stable') return 'site-healthy';
    if (status === 'warning') return 'site-warn';
    return 'site-unknown';
};

const linkFlowSpeed = (throughputMbps: number | undefined): number => {
    if (!throughputMbps || !Number.isFinite(throughputMbps)) return MIN_FLOW_SPEED;
    const candidate = throughputMbps / 1000;
    return Math.max(MIN_FLOW_SPEED, Math.min(MAX_FLOW_SPEED, candidate));
};

const statusText = (status: TopologyHexState): string => {
    if (status === 'critical') return 'Critical';
    if (status === 'stable') return 'Healthy';
    if (status === 'warning') return 'Warning';
    return 'Unknown';
};

const topologyTableNumber = (value: number | undefined): string =>
    Number.isFinite(value as number) ? `${value}` : '—';

const formatPercent = (value: number | undefined): string =>
    value === undefined ? '—' : `${value.toFixed(1)}%`;

const formatMs = (value: number | undefined): string =>
    value === undefined ? '—' : `${value.toFixed(0)} ms`;

const formatMbps = (value: number | undefined): string =>
    value === undefined ? '—' : `${value.toFixed(0)} Mbps`;

const digitalTwinStyle = `
    @keyframes criticalPulse {
        0%, 100% {
            filter: drop-shadow(0 0 0.1rem rgba(255,77,77,0.35)) drop-shadow(0 0 0.35rem rgba(255,77,77,0.2));
            opacity: 0.88;
        }
        50% {
            filter: drop-shadow(0 0 0.22rem rgba(255,77,77,0.7)) drop-shadow(0 0 0.55rem rgba(255,77,77,0.45));
            opacity: 1;
        }
    }

    @keyframes healthyPulse {
        0%, 100% {
            filter: drop-shadow(0 0 0.08rem rgba(0,242,255,0.22));
            opacity: 0.9;
        }
        50% {
            transform: scale(1.05);
            filter: drop-shadow(0 0 0.28rem rgba(0,242,255,0.62));
            opacity: 1;
        }
    }

    @keyframes linkFlow {
        from {
            stroke-dashoffset: 0;
        }
        to {
            stroke-dashoffset: -200;
        }
    }

    .digital-twin-map {
        background: radial-gradient(circle at 40% 20%, rgba(0,242,255,0.11), rgba(2,10,22,0.95) 45%, rgba(2,10,20,1) 100%);
        box-shadow: inset 0 0 0 1px rgba(0,242,255,0.14);
        position: relative;
        overflow: hidden;
        min-height: 480px;
    }

    .digital-twin-map .mapboxgl-canvas {
        filter: saturate(0.85) contrast(1.05) brightness(0.7);
    }

    .dt-overlay {
        pointer-events: none;
        mix-blend-mode: screen;
    }

    .dt-link {
        fill: none;
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-width: 3;
        stroke-opacity: 0.72;
        animation: linkFlow 1.2s linear infinite;
        vector-effect: non-scaling-stroke;
    }

    .dt-link-critical {
        stroke: rgba(255, 77, 77, 0.92);
        stroke-width: 3.5;
        animation-name: linkFlow;
    }

    .dt-link-warning {
        stroke: rgba(251, 191, 36, 0.95);
        stroke-width: 2.8;
        animation-name: linkFlow;
    }

    .dt-link-healthy {
        stroke: rgba(0, 242, 255, 0.85);
        stroke-width: 2.6;
        animation-name: linkFlow;
    }

    .dt-link-unknown {
        stroke: rgba(142, 156, 173, 0.75);
        stroke-width: 2;
        animation-name: linkFlow;
    }

    .dt-link {
        stroke-dasharray: 12 10;
    }

    .site-hex {
        transition: transform 220ms ease;
    }

    .site-healthy {
        animation: healthyPulse 6s ease-in-out infinite;
    }

    .site-critical {
        animation: criticalPulse 0.85s ease-in-out infinite;
    }

    .site-warn {
        opacity: 0.96;
    }

    .site-unknown {
        opacity: 0.82;
    }

    .dt-site-name {
        fill: rgba(232, 242, 248, 0.96);
        font: 600 10px/1 'Inter', 'Segoe UI', sans-serif;
        letter-spacing: 0.02em;
        text-anchor: middle;
        pointer-events: none;
        text-shadow: 0 0 12px rgba(0,242,255,0.46);
    }

    .dt-site-value {
        fill: rgba(208, 224, 229, 0.95);
        font: 600 9px/1 'Inter', 'Segoe UI', sans-serif;
        text-anchor: middle;
        pointer-events: none;
    }

    .dt-map-label {
        fill: #f0fbff;
        font: 700 10px/1 'Inter', 'Segoe UI', sans-serif;
        text-anchor: start;
        text-shadow: 0 1px 4px rgba(0,0,0,0.85);
        pointer-events: none;
    }

    .dt-label-box {
        fill: rgba(7, 16, 27, 0.66);
        fill-opacity: 0.94;
        stroke: rgba(0,242,255,0.34);
        stroke-width: 1;
    }

    .map-layer-shell {
        backdrop-filter: blur(5px);
    }
`;

const mapStyleDefinition = {
    version: 8,
    name: 'cyber-dark-satellite',
    glyphs:
        'https://raw.githubusercontent.com/lukasmartinelli/mapbox-gl-glyphs/master/{fontstack}/{range}.pbf',
    sources: {
        satellite: {
            type: 'raster',
            tiles: [
                'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            ],
            tileSize: 256,
            attribution:
                'Esri, Maxar, Earthstar Geographics, and the GIS user community',
        },
        darken: {
            type: 'raster',
            tiles: [
                'https://stamen-tiles.a.ssl.fastly.net/toner-background/{z}/{x}/{y}.png',
            ],
            tileSize: 256,
            attribution: 'Maps by Stamen Design, OpenStreetMap contributors',
        },
    },
    layers: [
        {
            id: 'satellite-tiles',
            type: 'raster',
            source: 'satellite',
            paint: {
                'raster-brightness-min': 0.32,
                'raster-brightness-max': 0.12,
                'raster-saturation': -0.65,
            },
        },
        {
            id: 'darken-layer',
            type: 'raster',
            source: 'darken',
            paint: {
                'raster-opacity': 0.2,
            },
        },
    ],
};

const useTopologySearchManager = (
    topology: CustomerTopology,
    pollIntervalMs: number,
    earliestTime: string,
    latestTime: string,
    refreshToken: number,
) => {
    const [snapshot, setSnapshot] = useState<SearchManagerSnapshot>({
        sites: {},
        links: {},
        summary: {},
        updatedAt: new Date().toISOString(),
    });
    const [streamError, setStreamError] = useState<string | null>(null);
    const rafRef = useRef<number | null>(null);
    const workingSnapshot = useRef<SearchManagerSnapshot>(snapshot);
    const managerRef = useRef<TopologySearchManager | null>(null);

    const commit = useCallback((next: SearchManagerSnapshot) => {
        workingSnapshot.current = next;
        if (rafRef.current !== null) return;
        rafRef.current = requestAnimationFrame(() => {
            setSnapshot(workingSnapshot.current);
            rafRef.current = null;
        });
    }, []);

    useEffect(() => {
        managerRef.current?.stop();
        const manager = new TopologySearchManager(
            topology,
            pollIntervalMs,
            earliestTime,
            latestTime,
            (next) => {
                commit({
                    ...next,
                    updatedAt: next.updatedAt,
                    sites: next.sites,
                    links: next.links,
                    summary: next.summary,
                });
            },
            (error) => {
                setStreamError(error);
            },
        );
        managerRef.current = manager;
        void manager.start();

        return () => {
            manager.stop();
            managerRef.current = null;
            if (rafRef.current !== null) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
        };
    }, [commit, earliestTime, latestTime, pollIntervalMs, refreshToken, topology]);

    const mergedSites = useMemo(() => {
        return topology.sites.map((site) => {
            const live = snapshot.sites[site.id] ?? {};
            return {
                ...site,
                status: live.status ?? site.status,
                metrics: {
                    ...site.metrics,
                    activeDevices:
                        live.activeDevices ?? site.metrics.activeDevices,
                    alerts: live.alerts ?? site.metrics.alerts,
                    healthPct: live.healthPct ?? site.metrics.healthPct,
                    latencyMs: live.latencyMs ?? site.metrics.latencyMs,
                },
                dataState: live.dataState,
                telemetrySource: live.telemetrySource ?? site.telemetrySource,
                dataError: live.dataError,
                lastUpdated: live.lastUpdated,
            };
        });
    }, [snapshot.sites, topology.sites]);

    const mergedLinks = useMemo(() => {
        return topology.links.map((link) => {
            const live = snapshot.links[link.id] ?? {};
            return {
                ...link,
                status: live.status ?? link.status,
                capacityMbps: live.capacityMbps ?? link.capacityMbps,
                throughputMbps:
                    live.throughputMbps ?? link.throughputMbps,
                peakThroughputMbps:
                    live.peakThroughputMbps ?? link.peakThroughputMbps,
                utilizationPct: live.utilizationPct ?? link.utilizationPct,
                peakUtilizationPct:
                    live.peakUtilizationPct ?? link.peakUtilizationPct,
                latencyMs: live.latencyMs ?? link.latencyMs,
                lossPct: live.lossPct ?? link.lossPct,
                endpointHealthPct:
                    live.endpointHealthPct ?? link.endpointHealthPct,
                endpointDevices: live.endpointDevices ?? link.endpointDevices,
                dataState: live.dataState,
                telemetrySource: live.telemetrySource ?? link.telemetrySource,
                dataError: live.dataError,
                lastUpdated: live.lastUpdated,
            };
        });
    }, [snapshot.links, topology.links]);

    return {
        mergedSites,
        mergedLinks,
        summary: snapshot.summary,
        updatedAt: snapshot.updatedAt,
        error: streamError,
    };
};

const useMapViewport = (
    mapRef: React.RefObject<any>,
    mergedSites: TopologySite[],
    mergedLinks: TopologyLink[],
): RenderViewport => {
    const [viewport, setViewport] = useState<RenderViewport>({
        sites: [],
        links: [],
        labels: [],
        showCityLabels: true,
    });

    const refreshRef = useRef<number | null>(null);

    const recalc = useCallback(() => {
        const map = mapRef.current;
        if (!map) return;

        const siteLookup = new Map(mergedSites.map((site) => [site.id, site]));
        const linkLookup = new Map(mergedLinks.map((link) => [link.id, link]));

        const projectedSites: ProjectedSite[] = mergedSites
            .map((site): ProjectedSite | null => {
                const point = map.project([site.lng, site.lat]);
                if (!point) return null;
                return {
                    ...site,
                    x: point.x,
                    y: point.y,
                };
            })
            .filter((site): site is ProjectedSite => site !== null);

        const labels: LabelNode[] = [];
        const withLabels = projectedSites.map((site) => {
            const label = placeLabel(labels, site.id, site.shortName, site.x, site.y);
            return {
                ...site,
                dataState: site.dataState,
            };
        });

        const links: RenderLink[] = [];
        for (const link of mergedLinks) {
            const source = siteLookup.get(link.sourceSiteId);
            const target = siteLookup.get(link.targetSiteId);
            if (!source || !target) continue;

            const s = map.project([source.lng, source.lat]);
            const t = map.project([target.lng, target.lat]);
            if (!s || !t) continue;

            const arc = geodesic([source.lng, source.lat], [target.lng, target.lat], GEODESIC_SEGMENTS);
            const pathPoints = arc
                .map(([lng, lat]) => map.project([lng, lat]))
                .map((point) => point);

            const d = pathFromCoordinates(
                pathPoints.map((point) => [point.x, point.y] as [number, number]),
            );

            const flowSpeed = linkFlowSpeed(
                typeof link.throughputMbps === 'number'
                    ? link.throughputMbps
                    : typeof link.peakThroughputMbps === 'number'
                      ? link.peakThroughputMbps
                      : undefined,
            );

            links.push({
                id: link.id,
                name: link.name,
                fromLabel: source.shortName,
                toLabel: target.shortName,
                status: link.status,
                path: d,
                throughputMbps: link.throughputMbps,
                utilizationPct: link.utilizationPct,
                telemetrySource: link.telemetrySource,
                lastUpdated: link.lastUpdated,
                dataState: link.dataState,
                flowSpeed,
            });
        }

        setViewport({
            sites: withLabels,
            links,
            labels,
            showCityLabels: true,
        });
    }, [mergedSites, mergedLinks]);

    const schedule = useCallback(() => {
        if (refreshRef.current !== null) return;
        refreshRef.current = requestAnimationFrame(() => {
            refreshRef.current = null;
            recalc();
        });
    }, [recalc]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        recalc();
        map.on('move', schedule);
        map.on('zoom', schedule);
        map.on('rotate', schedule);
        map.on('resize', schedule);
        map.on('pitch', schedule);

        return () => {
            if (refreshRef.current !== null) {
                cancelAnimationFrame(refreshRef.current);
                refreshRef.current = null;
            }
            if (!map || !map.off) return;
            map.off('move', schedule);
            map.off('zoom', schedule);
            map.off('rotate', schedule);
            map.off('resize', schedule);
            map.off('pitch', schedule);
        };
    }, [mapRef, recalc, schedule]);

    useEffect(() => {
        schedule();
    }, [mergedSites, mergedLinks, schedule]);

    return viewport;
};

export const CustomerTopologyMap: React.FC<CustomerTopologyMapProps> = ({
    topology = DEFAULT_TOPOLOGY_MAP_STYLE,
    mapboxAccessToken = '',
    pollIntervalMs = DEFAULT_POLL_MS,
    darkMode,
    isDark,
    earliestTime = '-24h',
    latestTime = 'now',
    refreshToken = 0,
    onSummaryMetricsChange,
    onOpenInSearch,
}) => {
    const actualDarkMode = isDark ?? darkMode ?? true;
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);
    const [mapReady, setMapReady] = useState(false);
    const [mapError, setMapError] = useState<string | null>(null);
    const [selectedEntity, setSelectedEntity] = useState<string | null>(null);

    const {
        mergedSites,
        mergedLinks,
        updatedAt,
        error: streamError,
        summary,
    } = useTopologySearchManager(
        topology,
        pollIntervalMs,
        earliestTime,
        latestTime,
        refreshToken,
    );

    useEffect(() => {
        if (!onSummaryMetricsChange) return;

        const metricMap: TopologySummaryMetricMap = {};

        const toValue = (value: string | number | undefined): string =>
            typeof value === 'number'
                ? value.toLocaleString()
                : typeof value === 'string'
                  ? value
                  : '—';

        for (const [id, size] of Object.entries(summary)) {
            metricMap[id] = {
                id,
                value: toValue(size as unknown as number | string | undefined),
                source: 'live',
            };
        }

        onSummaryMetricsChange(metricMap);
    }, [summary, onSummaryMetricsChange]);

    const viewport = useMapViewport(mapRef, mergedSites, mergedLinks);

    useEffect(() => {
        let alive = true;

        loadMapbox(mapboxAccessToken)
            .then((mapbox) => {
                if (!alive || !mapContainerRef.current) return;
                if (!mapbox) throw new Error('Mapbox SDK unavailable.');

                if (mapRef.current) {
                    mapRef.current.remove();
                    mapRef.current = null;
                    setMapReady(false);
                }

                const map = new mapbox.Map({
                    container: mapContainerRef.current,
                    style: mapStyleDefinition,
                    center: topology.map.center,
                    zoom: topology.map.zoom,
                    minZoom: topology.map.minZoom,
                    maxZoom: topology.map.maxZoom,
                });

                mapRef.current = map;

                map.on('load', () => {
                    setMapReady(true);
                    setMapError(null);
                });

                map.on('error', (evt: unknown) => {
                    setMapError('Map error: unable to render live map layer.');
                });
            })
            .catch((error) => {
                setMapError(
                    error instanceof Error
                        ? error.message
                        : 'Unable to initialize map runtime.'
                );
            });

        return () => {
            alive = false;
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, [topology.map.center, topology.map.maxZoom, topology.map.minZoom, topology.map.zoom, mapboxAccessToken]);

    const selectedLink = useMemo(() => {
        if (!selectedEntity) return null;
        return mergedLinks.find((link) => link.id === selectedEntity) ?? null;
    }, [mergedLinks, selectedEntity]);

    const selectedSite = useMemo(() => {
        if (!selectedEntity) return null;
        return mergedSites.find((site) => site.id === selectedEntity) ?? null;
    }, [mergedSites, selectedEntity]);

    const linkCount = mergedLinks.length;
    const siteCount = mergedSites.length;

    return (
        <Card
            className={cn(
                'relative h-full w-full overflow-hidden',
                actualDarkMode
                    ? 'bg-[#050e1a] text-[#e4f5ff] border border-white/10'
                    : 'bg-[#f6f8fb] text-[#08111f]'
            )}
            style={{ minHeight: '540px' }}
        >
            <style>{digitalTwinStyle}</style>
            <div
                className="absolute inset-0"
                aria-label="Florida live network topology"
            >
                <div
                    ref={mapContainerRef}
                    className="digital-twin-map absolute inset-0 map-layer-shell"
                />
                <svg
                    className="dt-overlay absolute inset-0 w-full h-full"
                    viewBox="0 0 1000 1000"
                    preserveAspectRatio="none"
                    style={{
                        width: '100%',
                        height: '100%',
                    }}
                    aria-hidden="true"
                >
                    <defs>
                        <filter id="dt-hex-blur" x="-100%" y="-100%" width="300%" height="300%">
                            <feGaussianBlur stdDeviation="0.25" result="blur" />
                            <feMerge>
                                <feMergeNode in="SourceGraphic" />
                                <feMergeNode in="blur" />
                            </feMerge>
                        </filter>
                    </defs>

                    {viewport.links.map((link) => {
                        const className =
                            link.status === 'critical'
                                ? 'dt-link dt-link-critical'
                                : link.status === 'warning'
                                  ? 'dt-link dt-link-warning'
                                  : link.status === 'stable'
                                    ? 'dt-link dt-link-healthy'
                                    : 'dt-link dt-link-unknown';

                        const style = {
                            animationDuration: `${(7 / Math.max(0.3, link.flowSpeed)).toFixed(2)}s`,
                            stroke: link.status === 'critical' ? ALERT : link.status === 'stable' ? PRIMARY : undefined,
                        } as React.CSSProperties;

                        return (
                            <g
                                key={link.id}
                                onMouseEnter={() => setSelectedEntity(link.id)}
                                onMouseLeave={() => setSelectedEntity(null)}
                            >
                                <path
                                    className={className}
                                    d={link.path}
                                    fill="none"
                                    style={style}
                                    stroke={
                                        link.status === 'stable'
                                            ? `url(#cyber-link-gradient-${link.id})`
                                            : undefined
                                    }
                                />
                            </g>
                        );
                    })}

                    {viewport.sites.map((site) => {
                        const isCritical = site.status === 'critical';
                        const isHealthy = site.status === 'stable';
                        const statusClass = statusPulseClass(site.status);
                        return (
                            <g
                                key={site.id}
                                className="pointer-events-none"
                                transform={`translate(${site.x - 28}, ${site.y - 34})`}
                                onMouseEnter={() => setSelectedEntity(site.id)}
                                onMouseLeave={() => setSelectedEntity(null)}
                            >
                                <path
                                    className={cn('site-hex', statusClass)}
                                    d="M28,6 L52,18 L52,42 L28,54 L4,42 L4,18 Z"
                                    fill={STATUS_FILL[site.status]}
                                    stroke={STATUS_BORDER[site.status]}
                                    strokeWidth={2}
                                    filter="url(#dt-hex-blur)"
                                />
                                <text
                                    className="dt-site-name"
                                    x="28"
                                    y="28"
                                >
                                    {site.shortName}
                                </text>
                                <text
                                    className="dt-site-value"
                                    x="28"
                                    y="42"
                                >
                                    {site.metrics.healthPct === undefined
                                        ? 'live'
                                        : formatPercent(site.metrics.healthPct)}
                                </text>
                                {isCritical && (
                                    <text
                                        className="dt-site-value"
                                        x="28"
                                        y="54"
                                        fill={ALERT}
                                    >
                                        {statusText('critical')}
                                    </text>
                                )}
                                {isHealthy && (
                                    <text
                                        className="dt-site-value"
                                        x="28"
                                        y="54"
                                        fill={PRIMARY}
                                    >
                                        {statusText('stable')}
                                    </text>
                                )}
                            </g>
                        );
                    })}

                    {viewport.labels
                        .filter((label) => label.visible)
                        .map((label) => (
                            <g key={`label-${label.id}`} transform={`translate(${label.x}, ${label.y})`}>
                                <rect
                                    className="dt-label-box"
                                    x="-2"
                                    y="-10"
                                    width={label.width}
                                    height={label.height}
                                    rx={6}
                                    ry={6}
                                />
                                <text
                                    className="dt-map-label"
                                    x="6"
                                    y="2"
                                >
                                    {label.text}
                                </text>
                            </g>
                        ))}
                </svg>

                <div className="absolute left-3 top-3 flex flex-wrap items-center gap-2 px-2 py-2 rounded-md border border-white/10 bg-black/50 backdrop-blur-sm">
                    <div className="text-[11px] text-white/85 font-semibold tracking-wide">
                        {topology.name}
                    </div>
                    <div className="text-[10px] text-white/70">{topology.subtitle}</div>
                    <div className="text-[10px] text-white/65 ml-auto">
                        {updatedAt}
                    </div>
                </div>

                <div className="absolute right-3 top-3 flex flex-col gap-1 rounded-md border border-white/10 bg-black/55 p-2 backdrop-blur-sm text-[10px]">
                    <div className="font-semibold text-white/80">Legend</div>
                    <div className="flex items-center gap-2">
                        <span className="inline-flex h-2 w-2 rounded-full" style={{ background: PRIMARY }} />
                        <span className="text-white/80">Healthy flow/path</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="inline-flex h-2 w-2 rounded-full" style={{ background: ALERT }} />
                        <span className="text-white/80">Critical status / flow</span>
                    </div>
                    <div className="text-white/65 mt-1">
                        Sites: {siteCount} | Links: {linkCount}
                    </div>
                </div>

                <div className="absolute left-3 bottom-3 rounded-md border border-white/10 bg-black/60 px-3 py-2 backdrop-blur-sm text-[10px] max-w-[66%]">
                    <div className="space-y-1 text-white/85">
                        <div>
                            Stream: {streamError ? 'degraded' : 'running'} ·
                            Poll interval: {Math.max(1, Math.round(pollIntervalMs / 1000))}s
                        </div>
                        <div className="text-white/65">
                            {selectedSite
                                ? `Selected site: ${selectedSite.name} (${formatPercent(
                                      selectedSite.metrics.healthPct,
                                  )} health, ${topologyNumber(selectedSite.metrics.activeDevices)} devices)`
                                : selectedLink
                                  ? `Selected link: ${selectedLink.name} (${formatMbps(
                                      selectedLink.throughputMbps,
                                  )}, ${formatPercent(selectedLink.utilizationPct)})`
                                  : 'Hover a site or link for details'}
                        </div>
                        <div className="text-white/50">
                            {streamError ? streamError : 'Data stream from Splunk SearchManager is active.'}
                        </div>
                    </div>
                </div>

                <div className="absolute right-3 bottom-3">
                    <Button
                        appearance="secondary"
                        onClick={() => setSelectedEntity(null)}
                        label="Reset Selection"
                    />
                </div>

                {mapError && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm p-8">
                        <div className="max-w-md rounded-md border border-rose-400/50 bg-slate-900/90 px-4 py-3 text-sm text-white">
                            <div className="font-semibold text-rose-300 mb-1">Map bootstrap failed</div>
                            <p className="text-white/85">{mapError}</p>
                            <p className="text-white/65 text-[11px] mt-1">
                                This shell still renders data and markers but needs Mapbox runtime access.
                            </p>
                        </div>
                    </div>
                )}
                {!mapReady && !mapError && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/35 backdrop-blur-sm text-[11px] text-white/80">
                        Booting Mapbox digital twin runtime…
                    </div>
                )}
            </div>
        </Card>
    );
};

interface TopologySiteTableProps {
    topology?: CustomerTopology;
}

const topologyNumber = (value: number | undefined): string =>
    value === undefined ? '—' : value.toLocaleString();

export const TopologySiteTable: React.FC<TopologySiteTableProps> = ({
    topology = DEFAULT_TOPOLOGY_MAP_STYLE,
}) => {
    const { mergedSites, mergedLinks, updatedAt } = useTopologySearchManager(
        topology,
        DEFAULT_POLL_MS,
        '-24h',
        'now',
        0,
    );

    const linksBySite = useMemo(() => {
        const map: Record<string, TopologyLink[]> = {};
        for (const site of mergedSites) {
            map[site.id] = [];
        }
        for (const link of mergedLinks) {
            map[link.sourceSiteId]?.push(link);
            map[link.targetSiteId]?.push(link);
        }
        return map;
    }, [mergedLinks, mergedSites]);

    return (
        <Card className="h-full w-full overflow-auto border border-white/10 bg-slate-950/30 p-0">
            <div className="px-3 py-2 text-[11px] text-white/80 border-b border-white/10 flex items-center justify-between">
                <span className="font-semibold">Site Health Table</span>
                <span className="text-white/55">Updated {updatedAt}</span>
            </div>
            <table className="w-full text-left text-[11px]">
                <thead className="text-[10px] tracking-wide uppercase text-white/60">
                    <tr>
                        <th className="px-2 py-2">Site</th>
                        <th className="px-2 py-2">Status</th>
                        <th className="px-2 py-2 text-right">Health</th>
                        <th className="px-2 py-2 text-right">Devices</th>
                        <th className="px-2 py-2 text-right">Alerts</th>
                        <th className="px-2 py-2 text-right">Latency</th>
                    </tr>
                </thead>
                <tbody>
                    {mergedSites.map((site) => {
                        const connected = linksBySite[site.id] ?? [];
                        const countConnections = connected.length;
                        const worstStatus =
                            connected
                                .map((link) => link.status)
                                .sort((a, b) => {
                                    const severity = {
                                        critical: 3,
                                        warning: 2,
                                        stable: 1,
                                        unknown: 0,
                                    };
                                    return severity[b] - severity[a];
                                })[0] ?? 'unknown';

                        return (
                            <tr
                                key={site.id}
                                className="border-t border-white/10 text-white/90 hover:bg-white/[0.06]"
                            >
                                <td className="px-2 py-1.5 font-semibold">{site.name}</td>
                                <td className="px-2 py-1.5">
                                    <span
                                        className="inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px]"
                                        style={{
                                            color: STATUS_BORDER[site.status],
                                            background: `${STATUS_FILL[site.status]}`,
                                            border: `1px solid ${STATUS_BORDER[site.status]}`,
                                        }}
                                    >
                                        {statusText(site.status)}
                                    </span>
                                </td>
                                <td className="px-2 py-1.5 text-right font-mono">
                                    {formatPercent(site.metrics.healthPct)}
                                </td>
                                <td className="px-2 py-1.5 text-right font-mono">
                                    {topologyNumber(site.metrics.activeDevices)}
                                </td>
                                <td className="px-2 py-1.5 text-right font-mono">
                                    {topologyNumber(site.metrics.alerts)}
                                </td>
                                <td className="px-2 py-1.5 text-right font-mono">
                                    {formatMs(site.metrics.latencyMs)}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            {mergedLinks.length > 0 && (
                <div className="px-2 pt-3 pb-2 text-[10px] text-white/55">
                    {mergedLinks.filter((link) => link.status === 'critical').length} critical links ·
                    {mergedLinks.length} total
                </div>
            )}
            <div className="px-2 pb-2 text-[10px] text-white/45">
                {topology.name} · Streamed from searchbase telemetry using SearchManager-style polling
            </div>
        </Card>
    );
};

export const CUSTOMER_TOPOLOGY = DEFAULT_TOPOLOGY_MAP_STYLE;

export interface CustomerTopologyMapSummary {
    siteHealth: number;
    linksCritical: number;
    updatedAt: string;
}

export const summarizeTopology = (topology: CustomerTopology): CustomerTopologyMapSummary => {
    let weightedHealth = 0;
    for (const site of topology.sites) {
        weightedHealth += site.metrics.healthPct ?? 0;
    }

    const totalHealth =
        topology.sites.length > 0 ? weightedHealth / topology.sites.length : 0;

    return {
        siteHealth: totalHealth,
        linksCritical: topology.links.filter((link) => link.status === 'critical').length,
        updatedAt: new Date().toISOString(),
    };
};
