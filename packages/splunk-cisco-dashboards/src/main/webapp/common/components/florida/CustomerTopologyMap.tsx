/**
 * CustomerTopologyMap
 *
 * Generic site-connectivity map for the executive overview. The default
 * data below represents the current FDEM story, but the component is
 * intentionally customer-topology driven: sites, links, roles, map frame,
 * and telemetry bindings live in one config object.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Circle,
    MapContainer,
    Marker,
    Polyline,
    TileLayer,
    ZoomControl,
    useMap,
} from 'react-leaflet';
import L from 'leaflet';
import { AnimatePresence, motion } from 'motion/react';
import {
    Activity,
    Code2,
    ExternalLink,
    Layers,
    Link2,
    Terminal,
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

export const FDEM_TOPOLOGY: CustomerTopology = {
    id: 'fdem-site-connectivity',
    name: 'FDEM Site Connectivity',
    subtitle: 'Hub paths into the State EOC',
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
            status: 'stable',
            metrics: {
                activeDevices: 824,
                alerts: 0,
                healthPct: 99,
                latencyMs: 28,
            },
            searchName: 'Overview - site_tlh',
        },
        {
            id: 'mco',
            name: 'Orlando (Regional Hub)',
            shortName: 'MCO',
            role: 'regional_hub',
            lat: 28.5383,
            lng: -81.3792,
            status: 'warning',
            metrics: {
                activeDevices: 410,
                alerts: 12,
                healthPct: 91,
                latencyMs: 145,
            },
            searchName: 'Overview - site_mco',
        },
        {
            id: 'aub',
            name: 'Auburndale (Logistics)',
            shortName: 'AUB',
            role: 'logistics',
            lat: 28.0653,
            lng: -81.7876,
            status: 'critical',
            metrics: {
                activeDevices: 188,
                alerts: 42,
                healthPct: 64,
                latencyMs: 310,
            },
            searchName: 'Overview - site_aub',
        },
    ],
    links: [
        {
            id: 'mco-tlh',
            name: 'Orlando to Tallahassee',
            sourceSiteId: 'mco',
            targetSiteId: 'tlh',
            status: 'unknown',
            capacityMbps: 10000,
            telemetrySource: 'Awaiting topology link telemetry',
            searchName: 'Overview - link_mco_tlh',
        },
        {
            id: 'aub-tlh',
            name: 'Auburndale to Tallahassee',
            sourceSiteId: 'aub',
            targetSiteId: 'tlh',
            status: 'unknown',
            capacityMbps: 10000,
            telemetrySource: 'Awaiting topology link telemetry',
            searchName: 'Overview - link_aub_tlh',
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
              site.status !== 'stable'
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
    useEffect(() => {
        let firstApply = true;
        const apply = () => {
            map.invalidateSize();
            if (firstApply) {
                map.setView(topology.map.center, topology.map.zoom, {
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
    }, [map, topology]);
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
}

export const CustomerTopologyMap: React.FC<CustomerTopologyMapProps> = ({
    topology = FDEM_TOPOLOGY,
    isDark = false,
    earliestTime = '-24h',
    latestTime = 'now',
    refreshToken = 0,
    spotlightIntervalMs = 11000,
    spotlightPauseMs = 25000,
    onOpenInSearch,
}) => {
    const [selected, setSelected] = useState<SelectedTarget | null>(null);
    const [spotlightSite, setSpotlightSite] = useState<TopologySite | null>(null);
    const [paused, setPaused] = useState(false);
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
    const pauseUntilRef = useRef<number>(0);

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
        let cancelled = false;
        const searchableLinks = topology.links.filter((link) => {
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
    }, [catalogueByName, earliestTime, latestTime, refreshToken, topology.links]);

    const resolvedTopology = useMemo<CustomerTopology>(
        () => ({
            ...topology,
            links: topology.links.map((link) => ({
                ...link,
                dataState: link.searchName ? 'loading' : link.dataState ?? 'static',
                ...liveLinkById[link.id],
            })),
        }),
        [liveLinkById, topology]
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
                    spotlightSite.status !== 'stable' &&
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
                    className="absolute top-3 right-3 z-[2000] w-80 bg-[#1a1c1e] text-slate-300 rounded-lg border border-slate-700 shadow-2xl overflow-hidden"
                >
                    <div className="bg-slate-800/50 px-4 py-2 border-b border-slate-700 flex items-center justify-between">
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
                            className="text-slate-500 hover:text-white transition-colors p-0.5 rounded hover:bg-white/5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    <div className="p-3 space-y-3">
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
                                <Activity className="w-3 h-3 text-slate-600" />
                            </div>
                            <button
                                type="button"
                                onClick={onOpenInSearch}
                                disabled={!onOpenInSearch || !selectedSpl}
                                title={
                                    selectedSpl
                                        ? 'Open this query in Splunk Search'
                                        : 'No runnable SPL loaded yet'
                                }
                                className={cn(
                                    'w-full text-left rounded p-2 border font-mono transition-colors focus:outline-none focus:ring-1 focus:ring-sky-500',
                                    selectedSpl && onOpenInSearch
                                        ? 'bg-black/60 hover:bg-black/80 border-slate-800 hover:border-sky-700'
                                        : 'bg-black/40 border-slate-800 cursor-not-allowed'
                                )}
                            >
                                {!catalogueLoaded ? (
                                    <p className="text-[10px] text-slate-500 italic leading-relaxed">
                                        Loading searchbase SPL...
                                    </p>
                                ) : selectedSpl ? (
                                    <p className="text-[10px] text-sky-200 leading-relaxed whitespace-pre-wrap break-all">
                                        {selectedSpl}
                                    </p>
                                ) : (
                                    <p className="text-[10px] text-slate-500 leading-relaxed">
                                        No searchbase binding for this topology item.
                                    </p>
                                )}
                            </button>
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
    topology = FDEM_TOPOLOGY,
}) => {
    const linksBySite = useMemo(() => {
        const map: Record<string, TopologyLink[]> = {};
        for (const site of topology.sites) map[site.id] = [];
        for (const link of topology.links) {
            map[link.sourceSiteId]?.push(link);
            map[link.targetSiteId]?.push(link);
        }
        return map;
    }, [topology]);

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
                    {topology.sites.map((site) => {
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
