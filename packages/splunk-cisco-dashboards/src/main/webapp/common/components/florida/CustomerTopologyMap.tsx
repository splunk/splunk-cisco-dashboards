/**
 * CustomerTopologyMap
 *
 * Generic site-connectivity map for the executive overview. The default
 * data below represents the current customer story, but the component is
 * intentionally customer-topology driven: sites, links, roles, map frame,
 * and telemetry bindings live in one config object.
 */

import React, {
    useCallback,
    useEffect,
    useMemo,
    useReducer,
    useRef,
    useState,
    useSyncExternalStore,
} from 'react';
import {
    Circle,
    MapContainer,
    Marker,
    Pane,
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
    Check,
    ChevronRight,
    Code2,
    Download,
    ExternalLink,
    Globe,
    Layers,
    Link2,
    MapPin,
    MousePointer2,
    Pencil,
    Plus,
    RotateCcw,
    Save,
    Search,
    Sparkles,
    Tag,
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
        // Center re-derived for the TLH+AUB-only topology (David call,
        // 2026-05-12): MCO/Orlando was never an FDEM site and has been
        // removed. The midpoint between TLH (30.4383, -84.2807) and
        // AUB (28.0653, -81.7876) sits at ~(29.25, -83.03), which
        // keeps both markers visible at the default zoom without
        // needing to pan. Bounds are kept permissive so the user can
        // still pan to neighbouring states for context.
        center: [29.25, -83.0],
        zoom: 6.55,
        minZoom: 5,
        maxZoom: 11,
        bounds: [
            [22.5, -90.0],
            [32.5, -77.0],
        ],
    },
    // `internetEdgeMbps` is intentionally left undefined on every site.
    // The earlier 1000 / 500 / 500 placeholders were initial estimates
    // from a design-of-record conversation that was never confirmed
    // against real circuit records. Shipping them on a customer-facing
    // exec dashboard meant the popup was claiming a number we did not
    // actually know. The site-level "Design of Record" block in the
    // popup is conditional on the value being defined, so leaving it
    // unset hides the block cleanly and matches the rest of the
    // popup's "Awaiting"-pattern for empty fields. Customers who want
    // to surface a real number can enter it through the existing
    // topology editor pencil-tool ("Internet edge Mbps" field), which
    // writes to the persisted localStorage payload
    // (`splunk-cisco-dashboards.customerTopology.v4`) and immediately
    // repopulates the popup. If FDEM's network team ever confirms
    // actual circuit bandwidths, the values can be restored here as a
    // packaged default and the editor entry will override them
    // per-user as before.
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
        // Single TLH<->AUB inter-site link. The TLH<->MCO and
        // MCO<->AUB legs were removed alongside the MCO site (David
        // call, 2026-05-12). A ThousandEyes agent-to-agent test does
        // exist for this pair, but as of the call the Tallahassee
        // enterprise agent (`demt-te01-va`) is unresponsive to probes,
        // so the link popup will read "Awaiting" until either the
        // agent recovers or the SPL stanza is rewired to consume the
        // A2A `Test_Metrics` data once it's trustworthy.
        {
            id: 'aub-tlh',
            name: 'Auburndale to Tallahassee',
            sourceSiteId: 'aub',
            targetSiteId: 'tlh',
            status: 'unknown',
            telemetrySource: 'Awaiting topology link telemetry',
            // OOB default is the dedicated TE A2A stanza
            // `[overview_link_te_a2a_health]` (added 2026-05-12). It
            // returns one normalized row per A2A test path between the
            // two cities with all three network metrics (latency, loss,
            // jitter) plus geo-enriched agent identity and the TE
            // permalink. The multi-source umbrella stanza
            // `Overview - Link Auburndale to Tallahassee Health` is
            // still in the catalogue for customers running SD-WAN who
            // want SD-WAN > TE > Catalyst Center prioritization;
            // operators can swap back to it via the in-popup catalogue
            // browser.
            searchName: 'Overview - Link ThousandEyes A2A Health',
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
    stable: '#22c55e',
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

const ROLE_BEACON_CHROME: Record<
    TopologyRole,
    { fill: string; halo: string; label: string }
> = {
    state_hq: {
        fill: '#0ea5e9',
        halo: 'rgba(14, 165, 233, 0.26)',
        label: 'border-sky-200',
    },
    regional_hub: {
        fill: '#f59e0b',
        halo: 'rgba(245, 158, 11, 0.24)',
        label: 'border-amber-200',
    },
    logistics: {
        fill: '#ef4444',
        halo: 'rgba(239, 68, 68, 0.22)',
        label: 'border-red-200',
    },
    branch: {
        fill: '#10b981',
        halo: 'rgba(16, 185, 129, 0.22)',
        label: 'border-emerald-200',
    },
    datacenter: {
        fill: '#8b5cf6',
        halo: 'rgba(139, 92, 246, 0.22)',
        label: 'border-violet-200',
    },
    internet_edge: {
        fill: '#64748b',
        halo: 'rgba(100, 116, 139, 0.22)',
        label: 'border-slate-200',
    },
};

const TOPOLOGY_STORAGE_KEY = 'splunk-cisco-dashboards.customerTopology.v4';
const TOPOLOGY_STORAGE_VERSION = 4;
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

/**
 * Site-level metadata sourced from `cisco:dnac:site:topology` via the
 * `Site Topology - Map Marker Enrichment (Buildings with GPS)` searchbase
 * stanza. Keyed by the building's short name (e.g. "TLH", "AUB")
 * which matches the `shortName` of `TopologySite` entries in
 * `CUSTOMER_TOPOLOGY`. Sites that DNAC isn't currently managing simply
 * have no entry; consumers MUST treat the lookup as optional.
 */
export interface SiteEnrichment {
    address?: string;
    country?: string;
    lat?: number;
    lon?: number;
    nameHierarchy?: string;
    siteLabel?: string;
    lastUpdated?: string;
}

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
        const resolvedSiteSearchName =
            optionalText(site.searchName) ??
            optionalText(fallbackSite?.searchName);
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
            dataState: resolvedSiteSearchName ? 'loading' : site.dataState ?? 'static',
            dataError: optionalText(site.dataError),
            telemetrySource:
                optionalText(site.telemetrySource) ??
                (resolvedSiteSearchName
                    ? 'Awaiting normalized site telemetry'
                    : 'Configured topology item'),
            searchName: resolvedSiteSearchName,
            internetEdgeMbps:
                finiteOptionalNumber(site.internetEdgeMbps) ??
                fallbackSite?.internetEdgeMbps,
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
            const peakThroughputMbps = finiteOptionalNumber(link.peakThroughputMbps);
            if (peakThroughputMbps !== undefined) {
                normalized.peakThroughputMbps = peakThroughputMbps;
            }
            const utilizationPct = finiteOptionalNumber(link.utilizationPct);
            if (utilizationPct !== undefined) {
                normalized.utilizationPct = utilizationPct;
            }
            const peakUtilizationPct = finiteOptionalNumber(link.peakUtilizationPct);
            if (peakUtilizationPct !== undefined) {
                normalized.peakUtilizationPct = peakUtilizationPct;
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
            const searchName =
                optionalText(link.searchName) ??
                optionalText(fallbackLink?.searchName);
            if (searchName) normalized.searchName = searchName;
            return normalized;
        })
        .filter((link): link is TopologyLink => Boolean(link));

    return {
        id: normalizeId(source.id, fallback.id),
        name: textValue(source.name, fallback.name),
        subtitle: textValue(source.subtitle, fallback.subtitle),
        telemetrySearchName:
            optionalText(source.telemetrySearchName) ??
            optionalText(fallback.telemetrySearchName),
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

/**
 * Public-facing helper for the "Reset all customisations" flow on
 * the Overview page. Wipes the persisted topology so the next mount
 * of `<CustomerTopologyMap />` reads `null` from localStorage and
 * falls through to the default `CUSTOMER_TOPOLOGY` factory.
 *
 * NOTE: in-tab callers must also force a remount of the map (e.g.
 * by bumping its `key` prop) — `localStorage` `storage` events only
 * fire across tabs, not in the originating tab, so the existing
 * mounted map won't reseed itself just because storage was cleared.
 */
export const clearCustomerTopologyStorage = (): void => {
    clearPersistedTopology();
};

export const usePersistedTopology = (fallback: CustomerTopology) => {
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

/**
 * Topology animation level: governs the intensity of map animations
 * (marker entrance, link hover bumps, packet streams). Persisted in
 * localStorage so each operator's preference survives reloads.
 *
 *  - 'on'     : full effects (entrance bounce, marching dashes, packet streams)
 *  - 'subtle' : reduced effects (no entrance, slower packets, no bounce)
 *  - 'off'    : every keyframe halted; equivalent to honoring
 *               `prefers-reduced-motion` system-wide
 *
 * `prefers-reduced-motion: reduce` forces the effective level to 'off'
 * regardless of the stored preference. Stored preference is preserved so
 * the user gets their previous setting back if the OS preference flips.
 */
type TopologyAnimationLevel = 'on' | 'subtle' | 'off';

const TOPOLOGY_ANIMATION_LEVEL_KEY = 'florida-topology-animation-level';
const TOPOLOGY_ANIMATION_LEVELS: TopologyAnimationLevel[] = [
    'on',
    'subtle',
    'off',
];

const readStoredAnimationLevel = (): TopologyAnimationLevel => {
    if (typeof window === 'undefined') return 'on';
    try {
        const stored = window.localStorage.getItem(
            TOPOLOGY_ANIMATION_LEVEL_KEY
        );
        if (
            stored === 'on' ||
            stored === 'subtle' ||
            stored === 'off'
        ) {
            return stored;
        }
    } catch {
        /* localStorage may be unavailable (private mode etc.) */
    }
    return 'on';
};

const subscribeStoredAnimationLevel = (
    onChange: () => void
): (() => void) => {
    if (typeof window === 'undefined') return () => undefined;
    const handler = (event: StorageEvent) => {
        if (event.key === TOPOLOGY_ANIMATION_LEVEL_KEY) onChange();
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
};

const subscribeReducedMotion = (onChange: () => void): (() => void) => {
    if (typeof window === 'undefined' || !window.matchMedia) {
        return () => undefined;
    }
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (typeof mql.addEventListener === 'function') {
        mql.addEventListener('change', onChange);
        return () => mql.removeEventListener('change', onChange);
    }
    // Safari < 14 fallback
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
};

const useTopologyAnimationLevel = (): {
    level: TopologyAnimationLevel; // effective level (after reduced-motion override)
    storedLevel: TopologyAnimationLevel; // raw stored preference
    setLevel: (next: TopologyAnimationLevel) => void;
    reducedMotion: boolean;
} => {
    const storedLevel = useSyncExternalStore<TopologyAnimationLevel>(
        subscribeStoredAnimationLevel,
        readStoredAnimationLevel,
        () => 'on'
    );
    const reducedMotion = useSyncExternalStore(
        subscribeReducedMotion,
        () => {
            if (typeof window === 'undefined' || !window.matchMedia) return false;
            return window.matchMedia(
                '(prefers-reduced-motion: reduce)'
            ).matches;
        },
        () => false
    );
    const setLevel = useCallback((next: TopologyAnimationLevel) => {
        if (typeof window === 'undefined') return;
        try {
            window.localStorage.setItem(
                TOPOLOGY_ANIMATION_LEVEL_KEY,
                next
            );
            // `storage` events do not fire in the same tab, so dispatch
            // manually to nudge other useSyncExternalStore subscribers
            // mounted in the same window.
            window.dispatchEvent(
                new StorageEvent('storage', {
                    key: TOPOLOGY_ANIMATION_LEVEL_KEY,
                    newValue: next,
                })
            );
        } catch {
            /* swallow */
        }
    }, []);
    return {
        level: reducedMotion ? 'off' : storedLevel,
        storedLevel,
        setLevel,
        reducedMotion,
    };
};

const TOPOLOGY_ANIMATION_LEVEL_LABELS: Record<TopologyAnimationLevel, string> =
    {
        on: 'Animations: On',
        subtle: 'Animations: Subtle',
        off: 'Animations: Off',
    };

const topologyAnimationCss = `
    @keyframes customer-topology-pulse {
        0%, 100% { stroke-opacity: 0.55; }
        50% { stroke-opacity: 0.9; }
    }
    @keyframes customer-topology-radiate {
        0% { transform: scale(0.85); opacity: 0.55; }
        70% { transform: scale(1.55); opacity: 0; }
        100% { transform: scale(1.55); opacity: 0; }
    }
    @keyframes customer-topology-marker-enter {
        0%   { transform: scale(0) translateY(-12px); opacity: 0; }
        70%  { transform: scale(1.18) translateY(0); opacity: 1; }
        100% { transform: scale(1) translateY(0); opacity: 1; }
    }
    @keyframes customer-topology-packet-glow {
        0%, 100% { filter: drop-shadow(0 0 1.5px currentColor); }
        50%      { filter: drop-shadow(0 0 4px currentColor); }
    }
    .customer-topology-link-hitbox {
        cursor: pointer;
    }
    .customer-topology-alert-ring {
        animation: customer-topology-pulse 2.6s ease-in-out infinite;
    }
    .customer-topology-radiate {
        animation-name: customer-topology-radiate;
        animation-timing-function: ease-out;
        animation-iteration-count: infinite;
        transform-origin: center;
    }
    .customer-topology-radiate--stable {
        animation-duration: 3.4s;
    }
    .customer-topology-radiate--unknown {
        animation-duration: 4.6s;
        opacity: 0.35;
    }
    .customer-topology-radiate--warning {
        animation-duration: 1.7s;
    }
    .customer-topology-radiate--critical {
        animation-duration: 0.95s;
    }
    /* Marker entrance — staggered via inline --customer-topology-marker-delay */
    .customer-topology-marker-enter {
        animation-name: customer-topology-marker-enter;
        animation-duration: 720ms;
        animation-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1);
        animation-fill-mode: both;
        animation-delay: var(--customer-topology-marker-delay, 0ms);
        transform-origin: center bottom;
    }
    /* Hover bump for connectivity lines */
    .customer-topology-link-shell {
        transition: stroke-width 180ms ease-out, stroke-opacity 180ms ease-out;
    }
    .customer-topology-link-shell:hover {
        stroke-opacity: 1 !important;
        stroke-width: calc(var(--customer-topology-link-weight, 2.4) + 1.6px) !important;
    }
    /* Packet stream visuals */
    .customer-topology-packet {
        animation: customer-topology-packet-glow 1.6s ease-in-out infinite;
    }
    .customer-topology-packet--critical { color: #ef4444; }
    .customer-topology-packet--warning  { color: #f59e0b; }
    .customer-topology-packet--stable   { color: #38bdf8; }
    /* Subtle level: slow the packet glow but keep packets visible */
    .customer-topology-anim--subtle .customer-topology-packet {
        animation-duration: 2.6s;
        opacity: 0.75;
    }
    /* Off level + prefers-reduced-motion: halt everything */
    .customer-topology-anim--off .customer-topology-radiate,
    .customer-topology-anim--off .customer-topology-alert-ring,
    .customer-topology-anim--off .customer-topology-marker-enter,
    .customer-topology-anim--off .customer-topology-packet {
        animation: none !important;
    }
    @media (prefers-reduced-motion: reduce) {
        .customer-topology-radiate,
        .customer-topology-alert-ring,
        .customer-topology-marker-enter,
        .customer-topology-packet {
            animation: none !important;
        }
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

const SPL_COMMANDS = new Set([
    'append',
    'appendcols',
    'bin',
    'chart',
    'dedup',
    'eval',
    'eventstats',
    'fields',
    'filldown',
    'fillnull',
    'head',
    'inputlookup',
    'join',
    'lookup',
    'makeresults',
    'makemv',
    'mvexpand',
    'predict',
    'rename',
    'rex',
    'search',
    'sort',
    'spath',
    'stats',
    'streamstats',
    'table',
    'tail',
    'timechart',
    'tstats',
    'union',
    'where',
]);

const SPL_KEYWORDS = new Set([
    'and',
    'as',
    'by',
    'case',
    'coalesce',
    'earliest',
    'false',
    'if',
    'in',
    'isnotnull',
    'isnull',
    'latest',
    'like',
    'lower',
    'match',
    'max',
    'min',
    'not',
    'null',
    'or',
    'round',
    'sum',
    'tonumber',
    'tostring',
    'true',
    'values',
]);

const renderSplBlock = (spl: string): React.ReactNode =>
    spl.split('\n').map((line, lineIndex) => (
        <React.Fragment key={`spl-line-${lineIndex}`}>
            {renderSplLine(line, lineIndex)}
            {lineIndex < spl.split('\n').length - 1 ? '\n' : null}
        </React.Fragment>
    ));

const renderSplLine = (line: string, lineIndex: number): React.ReactNode[] => {
    const pattern =
        /(`[^`]*`|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\|\s*[A-Za-z_][A-Za-z0-9_]*|\b\d+(?:\.\d+)?\b|\b[A-Za-z_][A-Za-z0-9_.:{}-]*\b)/g;
    const parts = line.split(pattern);

    return parts.map((part, partIndex) => {
        if (!part) return null;

        const key = `spl-${lineIndex}-${partIndex}`;

        if (part.startsWith('`') && part.endsWith('`')) {
            return (
                <span key={key} className="text-amber-700 dark:text-amber-300">
                    {part}
                </span>
            );
        }

        if (
            (part.startsWith('"') && part.endsWith('"')) ||
            (part.startsWith("'") && part.endsWith("'"))
        ) {
            return (
                <span key={key} className="text-emerald-700 dark:text-emerald-300">
                    {part}
                </span>
            );
        }

        if (part.startsWith('|')) {
            const command = part.slice(1).trim();
            return (
                <React.Fragment key={key}>
                    <span className="text-sky-700 dark:text-sky-400">|</span>
                    {command ? (
                        <>
                            {' '}
                            <span className="text-violet-700 dark:text-violet-300">
                                {command}
                            </span>
                        </>
                    ) : null}
                </React.Fragment>
            );
        }

        if (/^\d+(?:\.\d+)?$/.test(part)) {
            return (
                <span key={key} className="text-orange-700 dark:text-orange-300">
                    {part}
                </span>
            );
        }

        const normalized = part.toLowerCase();
        if (SPL_COMMANDS.has(normalized)) {
            return (
                <span key={key} className="text-violet-700 dark:text-violet-300">
                    {part}
                </span>
            );
        }

        if (SPL_KEYWORDS.has(normalized)) {
            return (
                <span key={key} className="text-sky-700 dark:text-sky-300">
                    {part}
                </span>
            );
        }

        if (part.includes('=') || part.includes('.')) {
            return (
                <span key={key} className="text-slate-700 dark:text-slate-200">
                    {part}
                </span>
            );
        }

        return (
            <span key={key} className="text-slate-900 dark:text-slate-100">
                {part}
            </span>
        );
    });
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
        peakThroughputMbps:
            finiteNumberFromRow(row, [
                'peakThroughputMbps',
                'peak_throughput_mbps',
                'throughputPeakMbps',
            ]) ?? base.peakThroughputMbps,
        utilizationPct:
            finiteNumberFromRow(row, [
                'utilizationPct',
                'utilization_pct',
                'txUtilization',
                'rxUtilization',
            ]) ?? base.utilizationPct,
        peakUtilizationPct:
            finiteNumberFromRow(row, [
                'peakUtilizationPct',
                'peak_utilization_pct',
                'utilizationPeakPct',
            ]) ?? base.peakUtilizationPct,
        latencyMs:
            finiteNumberFromRow(row, ['latencyMs', 'latency_ms', 'rttMs']) ??
            base.latencyMs,
        lossPct:
            finiteNumberFromRow(row, ['lossPct', 'loss_pct', 'packetLossPct']) ??
            base.lossPct,
        jitterMs:
            finiteNumberFromRow(row, ['jitterMs', 'jitter_ms']) ?? base.jitterMs,
        endpointHealthPct:
            finiteNumberFromRow(row, [
                'endpointHealthPct',
                'endpoint_health_pct',
            ]) ?? base.endpointHealthPct,
        endpointDevices:
            finiteNumberFromRow(row, ['endpointDevices', 'endpoint_devices']) ??
            base.endpointDevices,
        sourceAgents:
            textFromRow(row, ['sourceAgents', 'source_agents', 'sourceAgent']) ??
            base.sourceAgents,
        targetAgents:
            textFromRow(row, ['targetAgents', 'target_agents', 'targetAgent']) ??
            base.targetAgents,
        sourceLocation:
            textFromRow(row, [
                'sourceLocation',
                'source_location',
                'thousandeyes.source.agent.location',
            ]) ?? base.sourceLocation,
        targetLocation:
            textFromRow(row, [
                'targetLocation',
                'target_location',
                'thousandeyes.target.agent.location',
            ]) ?? base.targetLocation,
        sourceCountry:
            textFromRow(row, [
                'sourceCountry',
                'source_country',
                'thousandeyes.source.agent.geo.country.iso_code',
            ]) ?? base.sourceCountry,
        targetCountry:
            textFromRow(row, [
                'targetCountry',
                'target_country',
                'thousandeyes.target.agent.geo.country.iso_code',
            ]) ?? base.targetCountry,
        sourceRegion:
            textFromRow(row, [
                'sourceRegion',
                'source_region',
                'thousandeyes.source.agent.geo.region.iso_code',
            ]) ?? base.sourceRegion,
        targetRegion:
            textFromRow(row, [
                'targetRegion',
                'target_region',
                'thousandeyes.target.agent.geo.region.iso_code',
            ]) ?? base.targetRegion,
        teLink:
            textFromRow(row, [
                'teLink',
                'te_link',
                'thousandeyesPermalink',
                'thousandeyes.permalink',
            ]) ?? base.teLink,
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

const inferRoleFromName = (name: string): TopologyRole => {
    const n = name.toLowerCase();
    if (/\bhq\b|headquart|state[-_ ]?eoc/.test(n)) return 'state_hq';
    if (/\bhub\b|\breg(ion(al)?)?\d?\b/.test(n)) return 'regional_hub';
    if (/\blog(istics)?\b|warehouse|distribution|depot/.test(n)) return 'logistics';
    if (/\bdc\d?\b|datacenter|data[-_ ]center|colo/.test(n)) return 'datacenter';
    if (/\bcgw\b|\baws\b|\bazure\b|\bgcp\b|\bcloud\b/.test(n)) return 'internet_edge';
    return 'branch';
};

const isTopologyRoleValue = (value: unknown): value is TopologyRole =>
    typeof value === 'string' && (TOPOLOGY_ROLES as readonly string[]).includes(value);

const buildShortName = (name: string): string => {
    const trimmed = name.trim();
    if (!trimmed) return '?';
    const parts = trimmed.split(/[^A-Za-z0-9]+/).filter(Boolean);
    if (parts.length >= 2) {
        return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
    }
    return trimmed.slice(0, 3).toUpperCase();
};

/**
 * Build a full TopologySite from a discovery search row when the siteId
 * isn't already configured. Requires at least lat/lng + a siteId/name.
 */
const parseSiteRowAsDiscovered = (
    row: Record<string, unknown>
): TopologySite | null => {
    const siteId = normalizeId(
        textFromRow(row, ['siteId', 'site_id', 'site', 'id']),
        ''
    );
    const lat = finiteNumberFromRow(row, ['lat', 'latitude']);
    const lng = finiteNumberFromRow(row, ['lng', 'lon', 'long', 'longitude']);
    if (!siteId || lat === undefined || lng === undefined) return null;
    if (lat === 0 && lng === 0) return null;

    const name =
        textFromRow(row, ['siteName', 'site_name', 'name', 'displayName']) ?? siteId;
    const rawRole = textFromRow(row, ['role', 'siteRole', 'site_role']);
    const role: TopologyRole = isTopologyRoleValue(rawRole)
        ? rawRole
        : inferRoleFromName(name);
    const shortName = (
        textFromRow(row, ['shortName', 'short_name', 'siteCode', 'site_code']) ??
        buildShortName(name)
    )
        .slice(0, 4)
        .toUpperCase();

    const placeholder: TopologySite = {
        id: siteId,
        name,
        shortName,
        role,
        lat,
        lng,
        status: 'unknown',
        metrics: {},
        telemetrySource: 'Auto-discovered from topology search',
        searchName: undefined,
    };
    const updates = parseSiteRow(placeholder, row);
    return {
        ...placeholder,
        ...updates,
        metrics: { ...placeholder.metrics, ...(updates.metrics ?? {}) },
    };
};

/**
 * Build a full TopologyLink from a discovery search row. Requires resolvable
 * source/target site ids; the caller should ensure both endpoints exist (as
 * either configured or discovered sites) before rendering it.
 */
const parseLinkRowAsDiscovered = (
    row: Record<string, unknown>
): TopologyLink | null => {
    const sourceSiteId = normalizeId(
        textFromRow(row, ['sourceSiteId', 'source_site_id', 'source']),
        ''
    );
    const targetSiteId = normalizeId(
        textFromRow(row, ['targetSiteId', 'target_site_id', 'target']),
        ''
    );
    if (!sourceSiteId || !targetSiteId || sourceSiteId === targetSiteId) return null;

    const explicitId = normalizeId(textFromRow(row, ['linkId', 'link_id', 'id']), '');
    const id = explicitId || normalizedLinkId(sourceSiteId, targetSiteId);
    if (!id) return null;

    const name =
        textFromRow(row, ['name', 'linkName', 'link_name']) ??
        `${sourceSiteId} ↔ ${targetSiteId}`;

    const placeholder: TopologyLink = {
        id,
        name,
        sourceSiteId,
        targetSiteId,
        status: 'unknown',
        telemetrySource: 'Auto-discovered from topology search',
        searchName: undefined,
    };
    const updates = parseLinkRow(placeholder, row);
    return { ...placeholder, ...updates };
};

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

/**
 * Compute a slight bezier-curved polyline between two geographic points.
 * The curve sits perpendicular to the chord at its midpoint, giving lines
 * a subtle "network arc" feel without becoming a route. Curvature is a
 * fraction of chord length; 32 segments keeps the path smooth at any zoom
 * level while staying inexpensive to render.
 */
const computeBezierLine = (
    source: [number, number],
    target: [number, number],
    curvature = 0.12,
    segments = 32
): Array<[number, number]> => {
    const [sLat, sLng] = source;
    const [tLat, tLng] = target;
    const dLat = tLat - sLat;
    const dLng = tLng - sLng;
    const length = Math.sqrt(dLat * dLat + dLng * dLng) || 1;
    const offset = curvature * length;
    // Perpendicular direction (rotate 90deg clockwise in lat/lng space).
    const perpLat = -dLng / length;
    const perpLng = dLat / length;
    const ctrlLat = (sLat + tLat) / 2 + perpLat * offset;
    const ctrlLng = (sLng + tLng) / 2 + perpLng * offset;
    const points: Array<[number, number]> = [];
    for (let i = 0; i <= segments; i += 1) {
        const t = i / segments;
        const oneMinusT = 1 - t;
        const lat =
            oneMinusT * oneMinusT * sLat +
            2 * oneMinusT * t * ctrlLat +
            t * t * tLat;
        const lng =
            oneMinusT * oneMinusT * sLng +
            2 * oneMinusT * t * ctrlLng +
            t * t * tLng;
        points.push([lat, lng]);
    }
    return points;
};

interface LinkFlowProfile {
    /**
     * stroke-dasharray applied to the polyline. `null` means a solid line
     * (used for the calm "stable" state so healthy links don't appear to
     * march).
     */
    dashArray: string | null;
    /**
     * Animation period in seconds for the marching dash. `null` disables
     * the SVG <animate> element entirely. We keep stable links static so
     * the eye reads them as quiet/healthy at a glance.
     */
    flowSeconds: number | null;
    /**
     * If true, also animate stroke-opacity for a "breathing" alert glow.
     * Reserved for critical so it stands out without being distracting on
     * warning/unknown.
     */
    breathe: boolean;
    weight: number;
    opacity: number;
}

const linkFlowProfile = (link: TopologyLink): LinkFlowProfile => {
    switch (link.status) {
        case 'critical':
            return {
                dashArray: '6 6',
                flowSeconds: 0.7,
                breathe: true,
                weight: 3.6,
                opacity: 0.95,
            };
        case 'warning':
            return {
                dashArray: '8 6',
                flowSeconds: 1.6,
                breathe: false,
                weight: 3.0,
                opacity: 0.9,
            };
        case 'stable':
            return {
                dashArray: null,
                flowSeconds: null,
                breathe: false,
                weight: 2.4,
                opacity: 0.7,
            };
        case 'unknown':
        default:
            return {
                dashArray: '2 6',
                flowSeconds: null,
                breathe: false,
                weight: 1.8,
                opacity: 0.45,
            };
    }
};

/**
 * Site marker design: status drives the visible chrome (border ring colour,
 * radiating-halo cadence, optional corner alert dot); role drives the inner
 * letter glyph and the label-border tint. This keeps "what's wrong" the
 * dominant signal while still conveying "what role this site plays".
 */
const STATUS_RING_COLOR: Record<TopologyStatus, string> = {
    critical: '#ef4444',
    warning: '#f59e0b',
    stable: '#10b981',
    unknown: '#94a3b8',
};

const STATUS_HALO_RGBA: Record<TopologyStatus, string> = {
    critical: 'rgba(239, 68, 68, 0.45)',
    warning: 'rgba(245, 158, 11, 0.40)',
    stable: 'rgba(16, 185, 129, 0.32)',
    unknown: 'rgba(148, 163, 184, 0.28)',
};

const STATUS_RADIATE_CLASS: Record<TopologyStatus, string> = {
    critical: 'customer-topology-radiate customer-topology-radiate--critical',
    warning: 'customer-topology-radiate customer-topology-radiate--warning',
    stable: 'customer-topology-radiate customer-topology-radiate--stable',
    unknown: 'customer-topology-radiate customer-topology-radiate--unknown',
};

const createSiteIcon = (
    site: TopologySite,
    isSelected: boolean,
    isSpotlight: boolean,
    isDark: boolean,
    animateEntrance: boolean,
    entranceDelayMs: number
) => {
    const safeName = escapeHtml(site.name);
    const safeShortName = escapeHtml(site.shortName);
    const roleChrome = ROLE_BEACON_CHROME[site.role];
    const ringColor = STATUS_RING_COLOR[site.status];
    const haloColor = STATUS_HALO_RGBA[site.status];
    const radiateClass = STATUS_RADIATE_CLASS[site.status];
    const ringWidth = site.status === 'critical' ? 2.5 : 2;
    const selectionScale = isSelected
        ? 'scale-110'
        : isSpotlight
        ? 'scale-105'
        : '';
    const selectionRing = isSelected
        ? `box-shadow:0 0 0 4px rgba(14, 165, 233, 0.35), 0 8px 18px rgba(15,23,42,0.22);`
        : isSpotlight
        ? `box-shadow:0 0 0 4px rgba(14, 165, 233, 0.18), 0 6px 14px rgba(15,23,42,0.18);`
        : `box-shadow:0 6px 14px rgba(15,23,42,0.18);`;
    const labelChrome = isDark
        ? 'bg-slate-900/90 backdrop-blur-sm border-slate-700 text-slate-100'
        : 'bg-white/90 backdrop-blur-sm border-slate-200 text-slate-800';
    const pillBg = isDark ? '#0f172a' : '#ffffff';
    const showAlertDot =
        site.status === 'critical' || site.status === 'warning';
    const entranceClass = animateEntrance
        ? 'customer-topology-marker-enter'
        : '';
    const entranceStyle = animateEntrance
        ? `--customer-topology-marker-delay:${entranceDelayMs}ms;`
        : '';
    return L.divIcon({
        className: 'custom-div-icon',
        html: `
      <div class="relative flex flex-col items-center group w-[200px] ${entranceClass}" style="${entranceStyle}">
        <div class="relative flex items-center justify-center w-9 h-9 ${selectionScale} transition-transform duration-200">
          <span
            class="absolute inset-0 rounded-full ${radiateClass}"
            style="background:${haloColor};"
            aria-hidden="true"
          ></span>
          <span
            class="absolute inset-0 rounded-full"
            style="background:${pillBg}; border:${ringWidth}px solid ${ringColor}; ${selectionRing}"
            aria-hidden="true"
          ></span>
          <span
            class="relative z-10 font-black text-[12px] tracking-tight"
            style="color:${roleChrome.fill};"
          >${safeShortName}</span>
          ${
              showAlertDot
                  ? `
            <span class="absolute -top-0.5 -right-0.5 z-20 flex h-3 w-3">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  site.status === 'critical' ? 'bg-red-400' : 'bg-amber-400'
              }"></span>
              <span class="relative inline-flex rounded-full h-3 w-3 border border-white ${
                  site.status === 'critical' ? 'bg-red-500' : 'bg-amber-500'
              }"></span>
            </span>
          `
                  : ''
          }
        </div>
        <div class="mt-1 whitespace-nowrap font-semibold px-2.5 py-0.5 rounded-md shadow-sm border text-[11px] ${labelChrome} ${roleChrome.label}">
          ${safeName}
        </div>
      </div>
    `,
        iconSize: [200, 70],
        iconAnchor: [100, 18],
    });
};

const SVG_NS = 'http://www.w3.org/2000/svg';

interface TopologyLinkPathProps {
    link: TopologyLink;
    source: TopologySite;
    target: TopologySite;
    isSelected: boolean;
    onSelect: (link: TopologyLink) => void;
    /**
     * Effective animation level. 'off' suppresses SMIL marching/breathing
     * entirely; 'subtle' slows it; 'on' uses the original cadence.
     */
    animationLevel: TopologyAnimationLevel;
}

/**
 * Renders a single bezier-curved link line between two sites with a separate
 * invisible hitbox for clicks. The visible line uses native SVG <animate>
 * elements injected into Leaflet's underlying <path> for the marching-dash
 * "flow" effect. SMIL animation runs on the GPU and is anchored to the SVG
 * element, so it does not stutter when Leaflet redraws the path on pan/zoom
 * the way a CSS stroke-dashoffset animation would.
 *
 * Status drives motion:
 *   - stable:   solid line, no animation (calm/healthy at a glance)
 *   - warning:  amber dashes, medium-speed flow
 *   - critical: red dashes, fast flow + stroke-opacity breathe
 *   - unknown:  thin grey dashes, no animation
 */
const TopologyLinkPath: React.FC<TopologyLinkPathProps> = ({
    link,
    source,
    target,
    isSelected,
    onSelect,
    animationLevel,
}) => {
    const positions = useMemo(
        () =>
            computeBezierLine(
                [source.lat, source.lng],
                [target.lat, target.lng]
            ),
        [source.lat, source.lng, target.lat, target.lng]
    );
    const profile = useMemo(() => linkFlowProfile(link), [link]);
    const color = STATUS_STROKE[link.status];
    const polylineRef = useRef<L.Polyline | null>(null);

    // Subtle level: slow the marching dashes and breathing roughly 70% to keep
    // the line readable as "alive" without the eye-grabbing cadence of full.
    // Off level: skip SMIL injection entirely so the path is fully static.
    const flowSeconds =
        animationLevel === 'off'
            ? null
            : animationLevel === 'subtle' && profile.flowSeconds !== null
            ? profile.flowSeconds * 1.4
            : profile.flowSeconds;
    const enableBreathe = animationLevel !== 'off' && profile.breathe;

    useEffect(() => {
        const polyline = polylineRef.current;
        if (!polyline) return undefined;
        const apply = () => {
            const element = polyline.getElement() as SVGPathElement | null;
            if (!element) return;
            element
                .querySelectorAll('animate[data-customer-topology-flow]')
                .forEach((node) => node.remove());
            if (flowSeconds !== null) {
                const flow = document.createElementNS(SVG_NS, 'animate');
                flow.setAttribute('attributeName', 'stroke-dashoffset');
                flow.setAttribute('from', '0');
                flow.setAttribute('to', '-24');
                flow.setAttribute('dur', `${flowSeconds}s`);
                flow.setAttribute('repeatCount', 'indefinite');
                flow.setAttribute('data-customer-topology-flow', 'dash');
                element.appendChild(flow);
            }
            if (enableBreathe) {
                const breathe = document.createElementNS(SVG_NS, 'animate');
                breathe.setAttribute('attributeName', 'stroke-opacity');
                breathe.setAttribute(
                    'values',
                    `${profile.opacity};${Math.min(1, profile.opacity + 0.05)};${profile.opacity * 0.65};${profile.opacity}`
                );
                breathe.setAttribute(
                    'dur',
                    animationLevel === 'subtle' ? '2.4s' : '1.4s'
                );
                breathe.setAttribute('repeatCount', 'indefinite');
                breathe.setAttribute('data-customer-topology-flow', 'breathe');
                element.appendChild(breathe);
            }
        };
        // Leaflet may not have inserted the <path> into the DOM yet on first
        // mount, so re-apply once the element is available. `add` fires after
        // the path is attached.
        apply();
        polyline.on('add', apply);
        return () => {
            polyline.off('add', apply);
            const element = polyline.getElement() as SVGPathElement | null;
            element
                ?.querySelectorAll('animate[data-customer-topology-flow]')
                .forEach((node) => node.remove());
        };
    }, [flowSeconds, enableBreathe, profile.opacity, animationLevel]);

    const handleClick = useCallback(
        (event: L.LeafletMouseEvent) => {
            // Leaflet polylines (unlike Markers) bubble click events up to the
            // map's click handler by default. Without this stop, clicking a
            // link triggers our background "click outside to dismiss"
            // handler on the MapContainer right after selectLink runs,
            // which immediately clears the selection. Stop the propagation
            // here so the link click is the only event the map sees.
            L.DomEvent.stopPropagation(event);
            onSelect(link);
        },
        [link, onSelect]
    );

    return (
        <>
            <Polyline
                positions={positions}
                pathOptions={{
                    color: '#ffffff',
                    weight: 16,
                    opacity: 0.01,
                    className: 'customer-topology-link-hitbox',
                }}
                eventHandlers={{ click: handleClick }}
            />
            <Polyline
                ref={polylineRef}
                positions={positions}
                pathOptions={{
                    color,
                    weight: isSelected ? profile.weight + 1 : profile.weight,
                    opacity: isSelected ? 1 : profile.opacity,
                    dashArray: profile.dashArray ?? undefined,
                    lineCap: 'round',
                    lineJoin: 'round',
                    className: 'customer-topology-link-shell',
                }}
                eventHandlers={{ click: handleClick }}
            />
        </>
    );
};

/**
 * Per-link packet stream profile. Counts/durations are deliberately tuned so
 * that even at level='on' the stable links carry a calm, slow trickle while
 * critical links pop with a tight, urgent cadence. The eye reads density and
 * speed *together* as a health signal.
 */
interface PacketProfile {
    count: number;
    durationSeconds: number;
    radius: number;
    fill: string;
    statusClass: string;
    opacity: number;
}

const packetProfile = (
    status: TopologyStatus,
    level: TopologyAnimationLevel
): PacketProfile | null => {
    if (level === 'off') return null;
    const subtle = level === 'subtle';
    if (status === 'unknown') {
        // 2026-05-13: previously returned null so unknown links
        // sat completely still. That made the map look broken on
        // dev stacks where the bound search hadn't started
        // returning rows yet (e.g. the new TE A2A stanza on a
        // customer who hasn't had any A2A samples in 24h). The
        // fix: render a slow, faint "probe" packet stream so the
        // link is visibly alive even before data lands. This is a
        // marketing animation, not a status signal — once data
        // returns, the status promotes to stable/warning/critical
        // and the packets re-tune accordingly.
        return {
            count: subtle ? 1 : 2,
            durationSeconds: subtle ? 8.0 : 6.5,
            radius: subtle ? 2.2 : 2.4,
            fill: '#94a3b8',
            statusClass: 'customer-topology-packet--stable',
            opacity: subtle ? 0.35 : 0.45,
        };
    }
    switch (status) {
        case 'critical':
            return {
                count: subtle ? 2 : 3,
                durationSeconds: subtle ? 2.4 : 1.6,
                radius: subtle ? 3.2 : 3.6,
                fill: '#ef4444',
                statusClass: 'customer-topology-packet--critical',
                opacity: 0.95,
            };
        case 'warning':
            return {
                count: subtle ? 2 : 4,
                durationSeconds: subtle ? 4.4 : 3.2,
                radius: subtle ? 2.8 : 3.0,
                fill: '#f59e0b',
                statusClass: 'customer-topology-packet--warning',
                opacity: 0.92,
            };
        case 'stable':
        default:
            return {
                // Subtle is now "alive but unhurried" instead of "barely
                // there" — eye still catches motion within a glance, but
                // it doesn't pull focus from real data.
                count: subtle ? 3 : 5,
                durationSeconds: subtle ? 5.5 : 4.5,
                radius: subtle ? 2.8 : 3.2,
                fill: '#38bdf8',
                statusClass: 'customer-topology-packet--stable',
                opacity: subtle ? 0.85 : 0.95,
            };
    }
};

interface LinkPacketLayerProps {
    linkSegments: Array<{
        link: TopologyLink;
        source: TopologySite;
        target: TopologySite;
    }>;
    animationLevel: TopologyAnimationLevel;
}

/**
 * Renders bright "packets" (small SVG circles) traveling end-to-end along
 * each link's bezier curve, color-coded by health status and density-tuned
 * by the active animation level.
 *
 * The implementation lives inside a custom Leaflet pane (zIndex 410, between
 * Leaflet's default overlayPane=400 and markerPane=600) so packets appear
 * above the polyline shells but below the site markers and popups. Custom
 * panes are translated by Leaflet automatically on pan, so we only need to
 * recompute path geometry on `zoomend` and `viewreset` — pan is free.
 *
 * Animation itself uses SVG <animateMotion> + <mpath> for two reasons:
 *   1. Consistency with the existing SMIL approach used by TopologyLinkPath
 *      (the codebase already depends on SMIL working in the target
 *      browsers).
 *   2. SMIL animations run inside the browser's compositor without
 *      involving the JS frame loop, so we keep 60fps even with a dozen
 *      packets in flight on a busy CPU.
 */
/**
 * Bulletproof packet-flow layer.
 *
 * Earlier attempts wrapped the packets in a custom react-leaflet `<Pane>`
 * with our own `<svg>`. Both attempts had subtle SVG-sizing / viewport
 * bugs that meant the marching-dash animation worked (because it lives
 * inside Leaflet's *own* properly-sized overlay SVG) but the packet
 * circles never painted on the live map even though the same SMIL
 * pattern rendered fine in a standalone HTML test.
 *
 * The fix: stop running our own SVG. Find Leaflet's existing overlay
 * `<svg>` element — the one Leaflet creates lazily when the first
 * vector layer is added, and which it sizes / positions correctly on
 * every zoom + pan — and append a `<g>` group directly into it. All
 * `<defs><path>` + `<circle>` + `<animateMotion>` elements live inside
 * that group, so they share Leaflet's already-correct viewBox and
 * inherit its zoom-driven transforms automatically.
 *
 * This mirrors exactly how `TopologyLinkPath` injects its `<animate>`
 * elements onto the polyline path object — same imperative DOM pattern,
 * proven to work in this codebase.
 */
const LinkPacketLayer: React.FC<LinkPacketLayerProps> = ({
    linkSegments,
    animationLevel,
}) => {
    const map = useMap();
    const groupRef = useRef<SVGGElement | null>(null);
    // version is bumped any time we want the imperative re-render effect
    // below to run again — i.e. on the very first attach AND on every
    // map zoomend / viewreset / moveend / resize event.
    const [version, bumpVersion] = useReducer((n: number) => n + 1, 0);

    // Step 1: find Leaflet's existing overlay <svg> and append our <g>.
    // Leaflet only creates that <svg> when the first vector renderer is
    // initialised. By the time this effect runs the `<TopologyLinkPath>`
    // siblings have already been mounted, but Leaflet sometimes defers
    // SVG creation by an animation frame — so we retry on rAF until the
    // element appears.
    useEffect(() => {
        const SVG_NS = 'http://www.w3.org/2000/svg';
        let cancelled = false;
        let group: SVGGElement | null = null;
        let rafId: number | null = null;

        const attach = () => {
            if (cancelled) return;
            const overlayPane = map.getPanes().overlayPane;
            const svg = overlayPane?.querySelector('svg');
            if (!svg) {
                rafId = requestAnimationFrame(attach);
                return;
            }
            group = document.createElementNS(SVG_NS, 'g');
            group.setAttribute('class', 'customer-topology-packets-group');
            group.setAttribute('pointer-events', 'none');
            svg.appendChild(group);
            groupRef.current = group;
            bumpVersion();
        };
        attach();

        return () => {
            cancelled = true;
            if (rafId !== null) cancelAnimationFrame(rafId);
            if (group && group.parentNode) {
                group.parentNode.removeChild(group);
            }
            groupRef.current = null;
        };
    }, [map]);

    // Step 2: re-render packets whenever the map's world↔pixel mapping
    // could have changed. Pan moves the overlay SVG via a CSS transform
    // (no re-render needed for that), but `viewreset` fires when Leaflet
    // re-anchors the SVG and `zoomend` fires after each zoom completes —
    // both times we need to recompute layer-point coords.
    useEffect(() => {
        const handler = () => bumpVersion();
        map.on('zoomend', handler);
        map.on('viewreset', handler);
        map.on('moveend', handler);
        map.on('resize', handler);
        return () => {
            map.off('zoomend', handler);
            map.off('viewreset', handler);
            map.off('moveend', handler);
            map.off('resize', handler);
        };
    }, [map]);

    // Step 3: imperatively rebuild the packet DOM whenever inputs change.
    // We blow away the previous children and rebuild — `<animateMotion>`
    // elements are cheap and there's no benefit to diff-style updates.
    useEffect(() => {
        const group = groupRef.current;
        if (!group) return;
        const SVG_NS = 'http://www.w3.org/2000/svg';
        const XLINK_NS = 'http://www.w3.org/1999/xlink';

        // Clear previous render
        while (group.firstChild) {
            group.removeChild(group.firstChild);
        }
        if (animationLevel === 'off') return;

        const defs = document.createElementNS(SVG_NS, 'defs');
        group.appendChild(defs);

        for (const { link, source, target } of linkSegments) {
            const profile = packetProfile(link.status, animationLevel);
            if (!profile) continue;
            const points = computeBezierLine(
                [source.lat, source.lng],
                [target.lat, target.lng]
            );
            if (points.length < 2) continue;
            const layerPoints = points.map(([lat, lng]) =>
                map.latLngToLayerPoint([lat, lng])
            );
            const head = layerPoints[0];
            const tail = layerPoints
                .slice(1)
                .map((p) => `L${p.x},${p.y}`)
                .join(' ');
            const d = `M${head.x},${head.y} ${tail}`;

            const pathId = `customer-topology-packet-path-${link.id}`;
            const path = document.createElementNS(SVG_NS, 'path');
            path.setAttribute('id', pathId);
            path.setAttribute('d', d);
            path.setAttribute('fill', 'none');
            defs.appendChild(path);

            for (let i = 0; i < profile.count; i++) {
                // Stagger packet starts so they appear evenly distributed
                // along the path rather than clumping at the origin.
                const beginOffset =
                    (i / profile.count) * profile.durationSeconds;
                const circle = document.createElementNS(SVG_NS, 'circle');
                circle.setAttribute('r', String(profile.radius));
                circle.setAttribute('cx', '0');
                circle.setAttribute('cy', '0');
                circle.setAttribute('fill', profile.fill);
                circle.setAttribute('opacity', String(profile.opacity));
                circle.setAttribute(
                    'class',
                    `customer-topology-packet ${profile.statusClass}`
                );

                const motion = document.createElementNS(SVG_NS, 'animateMotion');
                motion.setAttribute('dur', `${profile.durationSeconds}s`);
                motion.setAttribute('repeatCount', 'indefinite');
                motion.setAttribute('rotate', 'auto');
                motion.setAttribute('begin', `-${beginOffset}s`);

                const mpath = document.createElementNS(SVG_NS, 'mpath');
                // Belt + braces — set both modern and legacy refs since
                // some Chromium and Safari variants resolve only one
                // form depending on the host page's SVG mode.
                mpath.setAttributeNS(XLINK_NS, 'xlink:href', `#${pathId}`);
                mpath.setAttribute('href', `#${pathId}`);

                motion.appendChild(mpath);
                circle.appendChild(motion);
                group.appendChild(circle);
            }
        }
    }, [linkSegments, animationLevel, map, version]);

    return null;
};

interface MapFrameProps {
    topology: CustomerTopology;
    autoFitSites?: TopologySite[];
}

const MapFrame: React.FC<MapFrameProps> = ({ topology, autoFitSites }) => {
    const map = useMap();
    const [centerLat, centerLng] = topology.map.center;
    const zoom = topology.map.zoom;
    const autoFitAppliedRef = useRef(false);

    // Track the last view we *programmatically* set so subsequent renders
    // that re-derive the same center/zoom don't fight the user's manual
    // pan/zoom. We only call `setView` when the editor (or persisted
    // topology) actually changes the requested center / zoom — not on
    // every render, and not when the user has been panning.
    //
    // Why the imperative dance instead of just passing `center`/`zoom` to
    // <MapContainer>? Because react-leaflet's MapContainer ignores
    // center/zoom prop changes after the initial mount — that's a
    // documented quirk of the library. Without `setView` here, edits to
    // Center Lat / Center Lng / Zoom in the topology editor would write
    // to localStorage but the visible map would never move.
    const lastAppliedViewRef = useRef<{
        lat: number;
        lng: number;
        zoom: number;
    } | null>(null);

    useEffect(() => {
        const apply = () => {
            map.invalidateSize();
            const last = lastAppliedViewRef.current;
            if (
                !last ||
                last.lat !== centerLat ||
                last.lng !== centerLng ||
                last.zoom !== zoom
            ) {
                map.setView([centerLat, centerLng], zoom, { animate: false });
                lastAppliedViewRef.current = {
                    lat: centerLat,
                    lng: centerLng,
                    zoom,
                };
            }
        };
        apply();
        const container = map.getContainer();
        const observer = new ResizeObserver(() => apply());
        observer.observe(container);
        return () => observer.disconnect();
    }, [centerLat, centerLng, map, zoom]);

    useEffect(() => {
        if (autoFitAppliedRef.current) return;
        if (!autoFitSites || autoFitSites.length === 0) return;
        const usable = autoFitSites.filter(
            (site) =>
                Number.isFinite(site.lat) &&
                Number.isFinite(site.lng) &&
                !(site.lat === 0 && site.lng === 0)
        );
        if (usable.length === 0) return;
        const bounds = L.latLngBounds(
            usable.map((site) => [site.lat, site.lng] as [number, number])
        );
        if (!bounds.isValid()) return;
        map.fitBounds(bounds, { padding: [40, 40], animate: false, maxZoom: 9 });
        autoFitAppliedRef.current = true;
    }, [autoFitSites, map]);

    return null;
};

interface MapClickCaptureProps {
    enabled: boolean;
    onPick: (lat: number, lng: number) => void;
    onBackgroundClick?: () => void;
}

const MapClickCapture: React.FC<MapClickCaptureProps> = ({
    enabled,
    onPick,
    onBackgroundClick,
}) => {
    useMapEvents({
        click: (event) => {
            if (enabled) {
                onPick(event.latlng.lat, event.latlng.lng);
                return;
            }
            // Map background click (not a marker / not a link path / not the
            // editor pick mode) — used as a "click outside to dismiss"
            // affordance for the SelectionCard. Marker and link clicks
            // don't bubble up to the map's click event, and the
            // SelectionCard sits as a sibling DOM element so clicks
            // inside the panel never reach the map.
            onBackgroundClick?.();
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
    const [discoveredSiteById, setDiscoveredSiteById] = useState<Record<
        string,
        TopologySite
    >>({});
    const [discoveredLinkById, setDiscoveredLinkById] = useState<Record<
        string,
        TopologyLink
    >>({});
    const [summaryMetricById, setSummaryMetricById] =
        useState<TopologySummaryMetricMap>({});
    const [siteEnrichmentByShortName, setSiteEnrichmentByShortName] = useState<
        Record<string, SiteEnrichment>
    >({});
    const pauseUntilRef = useRef<number>(0);

    // Animation level (controls marker entrance, link hover, packet streams).
    const {
        level: animationLevel,
        storedLevel: storedAnimationLevel,
        setLevel: setAnimationLevel,
        reducedMotion,
    } = useTopologyAnimationLevel();

    // Track which sites we've already shown the entrance animation for so a
    // later toggle of animation level doesn't restart drop-in for everyone.
    const animatedSitesRef = useRef<Set<string>>(new Set());
    const shouldAnimateMarkerEntrance = useCallback(
        (siteId: string, level: TopologyAnimationLevel) => {
            if (level !== 'on') return false;
            if (animatedSitesRef.current.has(siteId)) return false;
            animatedSitesRef.current.add(siteId);
            return true;
        },
        []
    );

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
        if (!telemetrySearchName) {
            setDiscoveredSiteById({});
            setDiscoveredLinkById({});
            return undefined;
        }
        const record = catalogueByName[telemetrySearchName];
        if (!record?.search?.trim()) {
            setDiscoveredSiteById({});
            setDiscoveredLinkById({});
            return undefined;
        }

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
                const discoveredSites: Record<string, TopologySite> = {};
                const discoveredLinkRows: Array<Record<string, unknown>> = [];

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
                        if (site) {
                            siteUpdates[site.id] = parseSiteRow(site, row);
                        } else if (itemType === 'site' && siteId) {
                            const discovered = parseSiteRowAsDiscovered(row);
                            if (discovered) discoveredSites[discovered.id] = discovered;
                        }
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
                        if (link) {
                            linkUpdates[link.id] = parseLinkRow(link, row);
                        } else if (itemType === 'link') {
                            discoveredLinkRows.push(row);
                        }
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

                const discoveredLinks: Record<string, TopologyLink> = {};
                if (discoveredLinkRows.length > 0) {
                    const knownEndpointIds = new Set<string>([
                        ...siteByConfiguredId.keys(),
                        ...Object.keys(discoveredSites),
                    ]);
                    for (const row of discoveredLinkRows) {
                        const link = parseLinkRowAsDiscovered(row);
                        if (!link) continue;
                        if (
                            !knownEndpointIds.has(link.sourceSiteId) ||
                            !knownEndpointIds.has(link.targetSiteId)
                        ) {
                            continue;
                        }
                        discoveredLinks[link.id] = link;
                    }
                }

                setLiveSiteById((current) => {
                    const next = { ...current };
                    for (const site of storedTopology.sites) {
                        if (site.searchName) {
                            if (siteUpdates[site.id]) {
                                next[site.id] = {
                                    ...next[site.id],
                                    ...siteUpdates[site.id],
                                };
                            }
                            continue;
                        }
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
                        if (link.searchName) {
                            if (linkUpdates[link.id]) {
                                next[link.id] = {
                                    ...next[link.id],
                                    ...linkUpdates[link.id],
                                };
                            }
                            continue;
                        }
                        next[link.id] =
                            linkUpdates[link.id] ??
                            ({
                                dataState: 'error',
                                dataError: 'Topology search returned no link row',
                            } satisfies Partial<TopologyLink>);
                    }
                    return next;
                });
                setDiscoveredSiteById(discoveredSites);
                setDiscoveredLinkById(discoveredLinks);
                setSummaryMetricById(summaryUpdates);
            })
            .catch((err) => {
                if (cancelled) return;
                const message = err instanceof Error ? err.message : String(err);
                setLiveSiteById((current) => {
                    const next = { ...current };
                    for (const site of storedTopology.sites) {
                        if (site.searchName) continue;
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
                        if (link.searchName) continue;
                        next[link.id] = {
                            dataState: 'error',
                            dataError: message,
                        };
                    }
                    return next;
                });
                setDiscoveredSiteById({});
                setDiscoveredLinkById({});
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
    ]);

    useEffect(() => {
        if (catalogueByName === null) return undefined;
        const enrichmentSearchName =
            'Site Topology - Map Marker Enrichment (Buildings with GPS)';
        const record = catalogueByName[enrichmentSearchName];
        if (!record?.search?.trim()) {
            // Stanza isn't installed (e.g. dashboard deployed before the
            // 2026-05-08 site:topology integration). Quietly no-op so older
            // deployments keep working.
            return undefined;
        }
        let cancelled = false;
        runSearch({
            spl: record.search,
            earliestTime,
            latestTime,
            tag: 'topology_marker_enrichment',
        })
            .then((res) => {
                if (cancelled) return;
                const rows = (res?.results ?? []) as Array<
                    Record<string, unknown>
                >;
                const next: Record<string, SiteEnrichment> = {};
                for (const row of rows) {
                    const nameRaw = row['name'];
                    if (typeof nameRaw !== 'string' || nameRaw.length === 0) {
                        continue;
                    }
                    const shortName = nameRaw.trim();
                    if (shortName.length === 0) continue;
                    const latNum = Number(row['lat']);
                    const lonNum = Number(row['lon']);
                    next[shortName] = {
                        address:
                            typeof row['address'] === 'string'
                                ? (row['address'] as string)
                                : undefined,
                        country:
                            typeof row['country'] === 'string'
                                ? (row['country'] as string)
                                : undefined,
                        lat: Number.isFinite(latNum) ? latNum : undefined,
                        lon: Number.isFinite(lonNum) ? lonNum : undefined,
                        nameHierarchy:
                            typeof row['nameHierarchy'] === 'string'
                                ? (row['nameHierarchy'] as string)
                                : undefined,
                        siteLabel:
                            typeof row['Site'] === 'string'
                                ? (row['Site'] as string)
                                : undefined,
                        lastUpdated:
                            typeof row['lastUpdated'] === 'string'
                                ? (row['lastUpdated'] as string)
                                : undefined,
                    };
                }
                setSiteEnrichmentByShortName(next);
            })
            .catch(() => {
                // Lookup may be empty on first deploy (the populator search
                // hasn't run yet). Don't surface an error to the user — the
                // map degrades gracefully without enrichment.
                if (cancelled) return;
                setSiteEnrichmentByShortName({});
            });
        return () => {
            cancelled = true;
        };
    }, [catalogueByName, earliestTime, latestTime, refreshToken]);

    useEffect(() => {
        if (catalogueByName === null) return undefined;
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
    ]);

    const resolvedTopology = useMemo<CustomerTopology>(() => {
        const configuredSites = activeTopology.sites.map((site) => {
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
        });
        const configuredLinks = activeTopology.links.map((link) => ({
            ...link,
            dataState: link.searchName ? 'loading' : link.dataState ?? 'static',
            ...liveLinkById[link.id],
        }));
        const configuredSiteIds = new Set(configuredSites.map((s) => s.id));
        const configuredLinkIds = new Set(configuredLinks.map((l) => l.id));

        const extraSites = Object.values(discoveredSiteById).filter(
            (site) => !configuredSiteIds.has(site.id)
        );
        const extraLinks = Object.values(discoveredLinkById).filter(
            (link) => !configuredLinkIds.has(link.id)
        );

        return {
            ...activeTopology,
            sites: [...configuredSites, ...extraSites],
            links: [...configuredLinks, ...extraLinks],
        };
    }, [activeTopology, liveLinkById, liveSiteById, discoveredSiteById, discoveredLinkById]);

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

    const selectedItemSearchName =
        resolvedSelected?.kind === 'site'
            ? resolvedSelected.site.searchName
            : resolvedSelected?.kind === 'link'
            ? resolvedSelected.link.searchName
            : undefined;
    const selectedSearchName = selectedItemSearchName || telemetrySearchName;
    const selectedRecord =
        selectedSearchName && catalogueByName
            ? catalogueByName[selectedSearchName] ?? null
            : null;
    const selectedSpl =
        selectedSearchName && selectedRecord?.search?.trim()
            ? selectedRecord.search.trim()
            : '';

    // NOTE: the popup-side search picker was removed on 2026-05-13
    // per Alan's request — the read-only popup is now inspect+run
    // only ("when we actually click on the link itself, there is no
    // need to have at that point any option to select any search
    // really, just show what is attached is fine and an ability to
    // run it"). All search-rebinding now lives in the topology
    // editor's per-card pickers (pencil button), where it has
    // proper save/discard semantics. The previous helper functions
    // (popupSearchOptions, updateSelectedSearchName) lived here
    // until that change and were removed alongside the picker.

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

    // Escape-to-dismiss + click-outside-to-dismiss now both live inside
    // `SelectionCard` so the panel's lifecycle behaviour is colocated
    // with the panel. The earlier copy of the Escape listener lived
    // here at the parent level and used the bubble phase, which let
    // focused descendants (editor inputs, Leaflet keyboard handlers)
    // swallow the key by stopPropagation. The new copy uses capture
    // phase from inside the popup component itself.

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
                `customer-topology-anim--${animationLevel}`,
                isDark
                    ? 'bg-slate-900 border-slate-800'
                    : 'bg-slate-100 border-slate-200'
            )}
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
                <MapFrame
                    topology={resolvedTopology}
                    autoFitSites={
                        activeTopology.sites.length === 0
                            ? resolvedTopology.sites
                            : undefined
                    }
                />
                <MapClickCapture
                    enabled={isEditorOpen && Boolean(pickSiteId)}
                    onPick={applyMapPick}
                    onBackgroundClick={() => setSelected(null)}
                />
                <TileLayer key={tileUrl} attribution="" url={tileUrl} />
                <ZoomControl position="bottomright" />

                {linkSegments.map(({ link, source, target }) => (
                    <TopologyLinkPath
                        key={link.id}
                        link={link}
                        source={source}
                        target={target}
                        isSelected={
                            resolvedSelected?.kind === 'link' &&
                            resolvedSelected.link.id === link.id
                        }
                        onSelect={selectLink}
                        animationLevel={animationLevel}
                    />
                ))}

                <LinkPacketLayer
                    linkSegments={linkSegments}
                    animationLevel={animationLevel}
                />


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

                {resolvedTopology.sites.map((site, index) => (
                    <Marker
                        key={site.id}
                        position={[site.lat, site.lng]}
                        icon={createSiteIcon(
                            site,
                            resolvedSelected?.kind === 'site' &&
                                resolvedSelected.site.id === site.id,
                            spotlightSite?.id === site.id && !resolvedSelected,
                            isDark,
                            // Entrance animation runs only on the first mount of
                            // each site marker. We tie it to a stable per-site
                            // ref so toggling animation level later does not
                            // re-trigger a now-distracting drop-in.
                            shouldAnimateMarkerEntrance(site.id, animationLevel),
                            index * 90
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
                isDark={isDark}
                catalogueLoaded={catalogueByName !== null}
                selectedSearchName={selectedSearchName}
                selectedSpl={selectedSpl}
                siteEnrichmentByShortName={siteEnrichmentByShortName}
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
                catalogueByName={catalogueByName}
                onOpenInSearch={onOpenInSearch}
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

                <button
                    type="button"
                    onClick={() => {
                        const idx = TOPOLOGY_ANIMATION_LEVELS.indexOf(
                            storedAnimationLevel
                        );
                        const nextIdx =
                            (idx + 1) % TOPOLOGY_ANIMATION_LEVELS.length;
                        setAnimationLevel(
                            TOPOLOGY_ANIMATION_LEVELS[nextIdx]
                        );
                    }}
                    title={
                        reducedMotion
                            ? 'Animations forced off by your OS reduce-motion setting. Click to cycle preference (will apply when reduce-motion is disabled).'
                            : `${TOPOLOGY_ANIMATION_LEVEL_LABELS[storedAnimationLevel]}. Click to cycle.`
                    }
                    aria-label={
                        TOPOLOGY_ANIMATION_LEVEL_LABELS[animationLevel]
                    }
                    className={cn(
                        'border p-2 rounded-lg shadow-md transition-colors focus:outline-none focus:ring-1 focus:ring-sky-400 relative',
                        buttonChrome,
                        animationLevel === 'off' && 'opacity-60'
                    )}
                >
                    <Sparkles
                        className={cn(
                            'w-4 h-4',
                            animationLevel === 'on' && 'text-sky-500',
                            animationLevel === 'subtle' && 'text-slate-400',
                            animationLevel === 'off' && 'text-slate-500'
                        )}
                    />
                    <span
                        className={cn(
                            'absolute -bottom-1 -right-1 px-1 py-0.5 rounded text-[7px] font-bold uppercase tracking-widest text-white shadow-sm',
                            animationLevel === 'on' && 'bg-sky-500',
                            animationLevel === 'subtle' && 'bg-slate-500',
                            animationLevel === 'off' && 'bg-slate-700'
                        )}
                    >
                        {animationLevel === 'on'
                            ? 'On'
                            : animationLevel === 'subtle'
                            ? 'Sub'
                            : 'Off'}
                    </span>
                </button>
            </div>
        </div>
    );
};

/**
 * `TopologySearchBrowser` — KpiPickerPanel-style browse-and-pick UI
 * for swapping which `searchbase.conf` entry powers a site marker
 * or a link line.
 *
 * Why a custom component instead of reusing `KpiPickerPanel`
 * directly: that component is wired to `MetricOverride` (tile
 * customisations), persists into the metric-override store, and
 * carries a tile-specific value-field / label override flow that
 * doesn't apply to topology elements. Topology picks are simpler
 * (one field: `searchName`) and need to be embedded inline inside
 * the popup / editor card rather than slid in as a panel. So we
 * mirror its filter model (free-text + tag chips + scrollable
 * list, all over the Cisco-tagged catalogue) but keep the surface
 * area focused on this one job.
 *
 * The result list is sorted with three layers of priority:
 *   1. Currently-bound entry first (so the operator sees their
 *      starting point at the top, even after typing a query that
 *      would otherwise demote it).
 *   2. Entries tagged with one of `preferredTags` next — these
 *      are the searches we know are shaped for this surface
 *      (Topology_Site for sites, Topology_Link for links). They
 *      get a small "site" / "link" badge so the operator can
 *      scan-spot them.
 *   3. Everything else alphabetically.
 *
 * Tag chips are scoped to the *current filtered slice* (the same
 * progressive-narrowing pattern the KPI picker uses), so picking
 * "ThousandEyes" then "agent-to-agent" leaves only entries
 * matching both — the dropdown options shrink as you narrow.
 */
interface TopologySearchBrowserProps {
    /** Full Cisco-tagged catalogue. Filtering happens inside this component. */
    catalogue: SearchbaseRecord[];
    /** searchName currently bound to this site / link, used for highlight + sort. */
    currentSearchName: string;
    /** Tag(s) to surface to the top of the list (e.g. `Topology_Site`). */
    preferredTags: string[];
    /** Human label for the surface — shown in the header and the per-row badge. */
    label: 'site' | 'link';
    /** Click-an-entry handler. Caller persists. */
    onPick: (searchName: string) => void;
    isDark: boolean;
    /**
     * When true, the browser also emits a free-form text input
     * underneath the list so the operator can type a custom
     * stanza name not in the catalogue (used in the editor; the
     * read-only popup hides this for simplicity).
     */
    showFreeFormInput?: boolean;
}

const TOPOLOGY_TAG_CHIP_LIMIT = 12;

const TopologySearchBrowser: React.FC<TopologySearchBrowserProps> = ({
    catalogue,
    currentSearchName,
    preferredTags,
    label,
    onPick,
    isDark,
    showFreeFormInput = false,
}) => {
    const [query, setQuery] = useState('');
    const [activeTags, setActiveTags] = useState<Set<string>>(() => new Set());
    const [tagPickerOpen, setTagPickerOpen] = useState(false);
    const [customDraft, setCustomDraft] = useState(currentSearchName);

    useEffect(() => {
        setCustomDraft(currentSearchName);
    }, [currentSearchName]);

    const queryLower = query.trim().toLowerCase();
    const filtered = useMemo(() => {
        return catalogue.filter((entry) => {
            if (queryLower) {
                const haystack =
                    entry.searchName.toLowerCase() +
                    '\n' +
                    entry.category.toLowerCase() +
                    '\n' +
                    entry.subCategory.toLowerCase() +
                    '\n' +
                    entry.tags.join(' ').toLowerCase();
                if (!haystack.includes(queryLower)) return false;
            }
            for (const tag of activeTags) {
                if (!entry.tags.includes(tag)) return false;
            }
            return true;
        });
    }, [catalogue, queryLower, activeTags]);

    const sorted = useMemo(() => {
        return [...filtered].sort((a, b) => {
            if (a.searchName === currentSearchName) return -1;
            if (b.searchName === currentSearchName) return 1;
            const aPreferred = preferredTags.some((tag) =>
                a.tags.includes(tag)
            );
            const bPreferred = preferredTags.some((tag) =>
                b.tags.includes(tag)
            );
            if (aPreferred && !bPreferred) return -1;
            if (!aPreferred && bPreferred) return 1;
            return a.searchName.localeCompare(b.searchName, undefined, {
                sensitivity: 'base',
            });
        });
    }, [filtered, currentSearchName, preferredTags]);

    const tagsAvailable = useMemo(() => {
        const counts = new Map<string, number>();
        for (const entry of filtered) {
            for (const tag of entry.tags) {
                counts.set(tag, (counts.get(tag) ?? 0) + 1);
            }
        }
        return Array.from(counts.entries())
            .filter(([tag]) => !activeTags.has(tag) && tag !== 'Cisco')
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
            .slice(0, TOPOLOGY_TAG_CHIP_LIMIT);
    }, [filtered, activeTags]);

    return (
        <div
            className={cn(
                'space-y-2 rounded-md border-2 px-2.5 py-2.5',
                isDark
                    ? 'border-sky-500/60 bg-sky-500/10'
                    : 'border-sky-500/70 bg-sky-50'
            )}
        >
            <div className="flex items-center justify-between gap-2">
                <span
                    className={cn(
                        'text-[10px] font-black uppercase tracking-widest',
                        isDark ? 'text-sky-300' : 'text-sky-700'
                    )}
                >
                    Change search ({label})
                </span>
                <span
                    className={cn(
                        'text-[8px] font-mono uppercase tracking-wider',
                        isDark ? 'text-sky-400/70' : 'text-sky-600/80'
                    )}
                >
                    {sorted.length} of {catalogue.length}
                </span>
            </div>

            <div className="relative">
                <Search
                    className={cn(
                        'absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none',
                        isDark ? 'text-slate-500' : 'text-slate-400'
                    )}
                />
                <input
                    type="text"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={`Search ${catalogue.length} catalogue entries…`}
                    className={cn(
                        'w-full rounded-md border-2 px-2 py-1.5 pl-7 pr-7 text-[11px] outline-none transition-colors focus:ring-2 focus:ring-sky-400',
                        isDark
                            ? 'bg-slate-950 border-sky-500/50 text-slate-100 placeholder:text-slate-600'
                            : 'bg-white border-sky-400 text-slate-800 placeholder:text-slate-400'
                    )}
                />
                {query && (
                    <button
                        type="button"
                        onClick={() => setQuery('')}
                        className={cn(
                            'absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 transition-colors',
                            isDark
                                ? 'text-slate-500 hover:text-slate-300'
                                : 'text-slate-400 hover:text-slate-600'
                        )}
                        title="Clear search"
                    >
                        <X className="w-3 h-3" />
                    </button>
                )}
            </div>

            {(activeTags.size > 0 || tagsAvailable.length > 0) && (
                <div className="flex flex-wrap items-center gap-1">
                    {Array.from(activeTags).map((tag) => (
                        <button
                            key={`active-${tag}`}
                            type="button"
                            onClick={() => {
                                setActiveTags((prev) => {
                                    const next = new Set(prev);
                                    next.delete(tag);
                                    return next;
                                });
                            }}
                            className={cn(
                                'inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-[9px] font-semibold transition-colors',
                                isDark
                                    ? 'bg-sky-500/20 border-sky-500/50 text-sky-200 hover:bg-sky-500/30'
                                    : 'bg-sky-100 border-sky-300 text-sky-800 hover:bg-sky-200'
                            )}
                            title={`Remove tag filter: ${tag}`}
                        >
                            {tag}
                            <X className="w-2.5 h-2.5" />
                        </button>
                    ))}
                    {tagPickerOpen &&
                        tagsAvailable.map(([tag, count]) => (
                            <button
                                key={`avail-${tag}`}
                                type="button"
                                onClick={() => {
                                    setActiveTags((prev) =>
                                        new Set(prev).add(tag)
                                    );
                                    setTagPickerOpen(false);
                                }}
                                className={cn(
                                    'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] transition-colors',
                                    isDark
                                        ? 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                                )}
                                title={`Filter to entries tagged ${tag}`}
                            >
                                {tag}
                                <span
                                    className={cn(
                                        'text-[8px]',
                                        isDark
                                            ? 'text-slate-500'
                                            : 'text-slate-400'
                                    )}
                                >
                                    {count}
                                </span>
                            </button>
                        ))}
                    {!tagPickerOpen && tagsAvailable.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setTagPickerOpen(true)}
                            className={cn(
                                'inline-flex items-center gap-0.5 rounded-full border border-dashed px-2 py-0.5 text-[9px] transition-colors',
                                isDark
                                    ? 'border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-500'
                                    : 'border-slate-300 text-slate-500 hover:text-slate-700 hover:border-slate-400'
                            )}
                            title="Show available tag filters"
                        >
                            <Tag className="w-2.5 h-2.5" />
                            + filter by tag
                        </button>
                    )}
                    {tagPickerOpen && (
                        <button
                            type="button"
                            onClick={() => setTagPickerOpen(false)}
                            className={cn(
                                'inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-[9px] transition-colors',
                                isDark
                                    ? 'border-slate-700 text-slate-500 hover:text-slate-300'
                                    : 'border-slate-300 text-slate-500 hover:text-slate-700'
                            )}
                            title="Close tag picker"
                        >
                            <X className="w-2.5 h-2.5" />
                            close tags
                        </button>
                    )}
                </div>
            )}

            <ul
                className={cn(
                    'max-h-[18rem] overflow-y-auto rounded-md border',
                    isDark
                        ? 'border-slate-800 bg-slate-950/60'
                        : 'border-slate-200 bg-white'
                )}
            >
                {sorted.length === 0 && (
                    <li
                        className={cn(
                            'px-2 py-3 text-center text-[10px] italic',
                            isDark ? 'text-slate-500' : 'text-slate-400'
                        )}
                    >
                        No matches. Clear the filters or
                        {showFreeFormInput
                            ? ' type a custom name below.'
                            : ' open the editor to type a custom name.'}
                    </li>
                )}
                {sorted.map((entry) => {
                    const isSelected = entry.searchName === currentSearchName;
                    const isPreferred = preferredTags.some((tag) =>
                        entry.tags.includes(tag)
                    );
                    return (
                        <li key={entry.id}>
                            <button
                                type="button"
                                onClick={() => onPick(entry.searchName)}
                                className={cn(
                                    'w-full text-left px-2 py-1.5 border-b last:border-b-0 transition-colors',
                                    isDark
                                        ? 'border-slate-800 hover:bg-slate-800/60'
                                        : 'border-slate-100 hover:bg-sky-50',
                                    isSelected &&
                                        (isDark
                                            ? 'bg-sky-500/15'
                                            : 'bg-sky-100/70')
                                )}
                                title={
                                    entry.description
                                        ? entry.description
                                              .replace(/<[^>]+>/g, '')
                                              .slice(0, 240)
                                        : entry.searchName
                                }
                            >
                                <div className="flex items-start gap-1.5">
                                    {isSelected ? (
                                        <Check
                                            className={cn(
                                                'w-3 h-3 mt-0.5 flex-shrink-0',
                                                isDark
                                                    ? 'text-sky-300'
                                                    : 'text-sky-600'
                                            )}
                                        />
                                    ) : (
                                        <div className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <div
                                            className={cn(
                                                'text-[11px] font-semibold truncate',
                                                isSelected &&
                                                    (isDark
                                                        ? 'text-sky-200'
                                                        : 'text-sky-800'),
                                                !isSelected &&
                                                    (isDark
                                                        ? 'text-slate-200'
                                                        : 'text-slate-800')
                                            )}
                                        >
                                            {entry.searchName}
                                        </div>
                                        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                            {entry.category && (
                                                <span
                                                    className={cn(
                                                        'text-[9px] font-mono',
                                                        isDark
                                                            ? 'text-slate-500'
                                                            : 'text-slate-500'
                                                    )}
                                                >
                                                    {entry.category}
                                                </span>
                                            )}
                                            {entry.subCategory && (
                                                <span
                                                    className={cn(
                                                        'text-[9px]',
                                                        isDark
                                                            ? 'text-slate-600'
                                                            : 'text-slate-400'
                                                    )}
                                                >
                                                    · {entry.subCategory}
                                                </span>
                                            )}
                                            {isPreferred && (
                                                <span
                                                    className={cn(
                                                        'inline-flex rounded px-1 text-[8px] font-bold uppercase tracking-wider',
                                                        isDark
                                                            ? 'bg-sky-500/20 text-sky-300'
                                                            : 'bg-sky-100 text-sky-700'
                                                    )}
                                                    title={`This search is shaped for a topology ${label}`}
                                                >
                                                    {label}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </button>
                        </li>
                    );
                })}
            </ul>

            {showFreeFormInput && (
                <div className="space-y-1">
                    <label
                        className={cn(
                            'block text-[8px] font-black uppercase tracking-widest',
                            isDark ? 'text-slate-500' : 'text-slate-500'
                        )}
                    >
                        Or type a custom search name
                    </label>
                    <div className="flex items-stretch gap-1">
                        <input
                            type="text"
                            value={customDraft}
                            onChange={(event) =>
                                setCustomDraft(event.target.value)
                            }
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                    event.preventDefault();
                                    onPick(customDraft.trim());
                                }
                            }}
                            placeholder="e.g. Overview - Site Tallahassee Health"
                            className={cn(
                                'flex-1 rounded-md border px-2 py-1.5 text-[11px] outline-none transition-colors focus:ring-2 focus:ring-sky-400',
                                isDark
                                    ? 'bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-600'
                                    : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400'
                            )}
                        />
                        <button
                            type="button"
                            onClick={() => onPick(customDraft.trim())}
                            disabled={
                                customDraft.trim() ===
                                (currentSearchName ?? '').trim()
                            }
                            className={cn(
                                'rounded-md border px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors',
                                isDark
                                    ? 'bg-sky-500/20 border-sky-500/50 text-sky-200 hover:bg-sky-500/30 disabled:opacity-40 disabled:cursor-not-allowed'
                                    : 'bg-sky-100 border-sky-300 text-sky-800 hover:bg-sky-200 disabled:opacity-40 disabled:cursor-not-allowed'
                            )}
                            title="Apply this custom name as the search for this element"
                        >
                            Apply
                        </button>
                    </div>
                </div>
            )}

            <p
                className={cn(
                    'text-[9px] leading-relaxed',
                    isDark ? 'text-sky-200/80' : 'text-sky-800/80'
                )}
            >
                Pick any search from the {catalogue.length}-entry searchbase
                catalogue to drive this {label}. Type to filter, click a tag
                to narrow, click an entry to apply.
            </p>
        </div>
    );
};

interface SelectionCardProps {
    selected: SelectedTarget | null;
    topology: CustomerTopology;
    siteById: Record<string, TopologySite>;
    isDark: boolean;
    catalogueLoaded: boolean;
    selectedSearchName?: string;
    selectedSpl: string;
    siteEnrichmentByShortName?: Record<string, SiteEnrichment>;
    onClose: () => void;
    onOpenInSearch?: () => void;
}

/**
 * Read-only popup that opens when the operator clicks a marker or
 * a link on the map. Per Alan's 2026-05-13 feedback, this surface
 * is intentionally inspect-only: it shows the bound `searchName`,
 * the live SPL, and an "Open in Splunk Search" button so the
 * operator can verify and run the underlying query, but it does
 * NOT offer a search-picker on this surface. Search swaps belong
 * in the topology editor (pencil button), where they are an
 * editorial action with proper save/discard semantics. Mixing
 * "view a marker" and "rebind a marker" on the same popup made
 * the edit feel surprising and the inspect feel cluttered.
 */
const SelectionCard: React.FC<SelectionCardProps> = ({
    selected,
    topology,
    siteById,
    isDark,
    catalogueLoaded,
    selectedSearchName,
    selectedSpl,
    siteEnrichmentByShortName,
    onClose,
    onOpenInSearch,
}) => {
    const dragControls = useDragControls();
    const [showSpl, setShowSpl] = useState(false);
    // Ref on the popup container so we can register a *document-level*
    // mousedown listener that dismisses when the user clicks outside
    // the panel. The map's MapClickCapture only fires when the click
    // hits empty map pixels, which doesn't help when the panel covers
    // basically the entire map column (FDEM's narrow right-column
    // layout). With this ref we catch clicks anywhere on the page.
    const panelRef = useRef<HTMLDivElement>(null);
    const selectedKey = selected
        ? selected.kind === 'site'
            ? `site:${selected.site.id}`
            : `link:${selected.link.id}`
        : '';
    const connectedLinks = useMemo(() => {
        if (!selected || selected.kind !== 'site') return [];
        return topology.links.filter(
            (link) =>
                link.sourceSiteId === selected.site.id ||
                link.targetSiteId === selected.site.id
        );
    }, [selected, topology.links]);

    useEffect(() => {
        setShowSpl(false);
    }, [selectedKey, selectedSearchName]);

    // Document-level click-outside dismiss. We deliberately skip the
    // dismissal when the click lands on a leaflet marker or
    // interactive svg path — those have their own click-to-toggle
    // handlers and we don't want to fight them. We also skip clicks
    // inside leaflet popups / tooltips (used by the editor pick
    // mode).
    useEffect(() => {
        if (!selected) return undefined;
        const onMouseDown = (event: MouseEvent) => {
            const target = event.target;
            if (!(target instanceof Node)) return;
            const panel = panelRef.current;
            if (panel && panel.contains(target)) return;
            if (
                target instanceof Element &&
                target.closest(
                    '.leaflet-marker-icon, .leaflet-interactive, .leaflet-popup, .leaflet-tooltip'
                )
            ) {
                return;
            }
            onClose();
        };
        // Capture phase so descendant `stopPropagation()` calls (the
        // editor panel, the map's marker handlers, etc.) cannot
        // swallow the dismissal.
        document.addEventListener('mousedown', onMouseDown, true);
        return () =>
            document.removeEventListener('mousedown', onMouseDown, true);
    }, [selected, onClose]);

    // Document-level Escape dismiss. Owned by SelectionCard rather
    // than the parent so the dismissal contract sits next to the
    // panel's other lifecycle behaviour (drag, click-outside, X
    // button). Capture phase for the same reason as the mousedown
    // handler above — we never want a focused editor input or a
    // Leaflet keyboard handler to eat the Escape.
    useEffect(() => {
        if (!selected) return undefined;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.stopPropagation();
                onClose();
            }
        };
        document.addEventListener('keydown', onKey, true);
        return () => document.removeEventListener('keydown', onKey, true);
    }, [selected, onClose]);

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
                    ref={panelRef}
                    initial={{ opacity: 0, x: 20, scale: 0.94 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 20, scale: 0.94 }}
                    drag
                    dragControls={dragControls}
                    dragListener={false}
                    dragMomentum={false}
                    dragElastic={0.04}
                    className={cn(
                        'absolute top-3 right-3 bottom-16 z-[2000] w-[min(22rem,calc(100%-1.5rem))] rounded-lg border overflow-hidden flex flex-col',
                        isDark
                            ? 'bg-[#1a1c1e] text-slate-300 border-slate-700 shadow-2xl'
                            : 'bg-white text-slate-700 border-slate-200 shadow-xl'
                    )}
                >
                    <div
                        className={cn(
                            'px-4 py-2 border-b flex items-center justify-between cursor-move touch-none flex-shrink-0',
                            isDark
                                ? 'bg-slate-800/50 border-slate-700'
                                : 'bg-slate-50 border-slate-200'
                        )}
                        onPointerDown={(event) => dragControls.start(event)}
                        title="Drag topology details"
                    >
                        <div className="flex items-center gap-2 min-w-0">
                            <Terminal className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                            <div className="min-w-0">
                                <p
                                    className={cn(
                                        'text-[10px] font-mono font-bold tracking-tight uppercase truncate',
                                        isDark ? 'text-slate-400' : 'text-slate-700'
                                    )}
                                >
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
                            className={cn(
                                'transition-colors p-0.5 rounded focus:outline-none focus:ring-1 focus:ring-sky-500',
                                isDark
                                    ? 'text-slate-500 hover:text-white hover:bg-white/5'
                                    : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                            )}
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    <div className="p-3 space-y-3 overflow-y-auto overscroll-contain flex-1 min-h-0">
                        {selected.kind === 'site' ? (
                            <SiteDetails
                                site={selected.site}
                                links={connectedLinks}
                                isDark={isDark}
                                enrichment={
                                    siteEnrichmentByShortName?.[
                                        selected.site.shortName
                                    ]
                                }
                            />
                        ) : (
                            <LinkDetails
                                link={selected.link}
                                siteById={siteById}
                                isDark={isDark}
                            />
                        )}

                        {/*
                            Inspect-only data-source line. Click is
                            "view what this marker / link is wired to"
                            — picking a different search lives in the
                            editor (pencil button), so this surface
                            stays focused on inspect + run.
                        */}
                        <div className="space-y-1">
                            <div className="flex items-center justify-between gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowSpl((current) => !current)}
                                    aria-expanded={showSpl}
                                    aria-controls="topology-searchbase-spl-block"
                                    title={
                                        showSpl
                                            ? 'Hide the SPL preview'
                                            : 'Show the literal SPL from searchbase.conf'
                                    }
                                    className={cn(
                                        'inline-flex min-w-0 items-center gap-1 rounded px-1 py-0.5 text-[9px] font-bold uppercase tracking-widest transition-colors focus:outline-none focus:ring-1 focus:ring-sky-500',
                                        isDark
                                            ? 'text-slate-500 hover:text-slate-200'
                                            : 'text-slate-500 hover:text-slate-700'
                                    )}
                                >
                                    <ChevronRight
                                        className={cn(
                                            'w-2.5 h-2.5 flex-shrink-0 transition-transform',
                                            showSpl && 'rotate-90'
                                        )}
                                    />
                                    {showSpl ? 'Hide SPL' : 'Show SPL'}
                                    {!showSpl && selectedSearchName && (
                                        <span className="ml-1 min-w-0 max-w-[12rem] truncate font-mono text-[9px] normal-case tracking-normal text-slate-600">
                                            · {selectedSearchName}
                                        </span>
                                    )}
                                </button>
                                {selectedSpl && onOpenInSearch ? (
                                    <button
                                        type="button"
                                        aria-label="Open this query in Splunk Search"
                                        onClick={onOpenInSearch}
                                        title="Open this query in Splunk Search"
                                        className={cn(
                                            'transition-colors rounded focus:outline-none focus:ring-1 focus:ring-sky-500',
                                            isDark
                                                ? 'text-slate-600 hover:text-sky-400'
                                                : 'text-slate-400 hover:text-sky-700'
                                        )}
                                    >
                                        <Activity className="w-3 h-3" />
                                    </button>
                                ) : (
                                    <Activity
                                        className={cn(
                                            'w-3 h-3',
                                            isDark ? 'text-slate-600' : 'text-slate-400'
                                        )}
                                    />
                                )}
                            </div>
                            {showSpl && (
                                <div
                                    id="topology-searchbase-spl-block"
                                    className={cn(
                                        'w-full rounded-lg border p-2 font-mono',
                                        isDark
                                            ? 'border-slate-700 bg-slate-950 shadow-inner shadow-black/30'
                                            : 'border-slate-200 bg-slate-50 shadow-inner shadow-slate-200/70'
                                    )}
                                >
                                    {!catalogueLoaded ? (
                                        <p className="text-[11px] text-slate-400 italic leading-relaxed">
                                            Loading searchbase SPL...
                                        </p>
                                    ) : selectedSpl && onOpenInSearch ? (
                                        <button
                                            type="button"
                                            onClick={onOpenInSearch}
                                            title="Click to run this SPL in Splunk Search"
                                            className={cn(
                                                'block w-full text-left rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-sky-400',
                                                isDark
                                                    ? 'hover:bg-slate-900/60'
                                                    : 'hover:bg-slate-100/80'
                                            )}
                                        >
                                            <pre
                                                className={cn(
                                                    'm-0 max-h-[28rem] overflow-auto rounded-md px-3 py-3 text-[12px] leading-6 whitespace-pre-wrap break-words select-text ring-1',
                                                    isDark
                                                        ? 'bg-slate-950 ring-white/5'
                                                        : 'bg-white ring-black/5'
                                                )}
                                            >
                                                {renderSplBlock(selectedSpl)}
                                            </pre>
                                        </button>
                                    ) : selectedSpl ? (
                                        <pre
                                            className={cn(
                                                'm-0 max-h-[28rem] overflow-auto rounded-md px-3 py-3 text-[12px] leading-6 whitespace-pre-wrap break-words select-text ring-1',
                                                isDark
                                                    ? 'bg-slate-950 ring-white/5'
                                                    : 'bg-white ring-black/5'
                                            )}
                                        >
                                            {renderSplBlock(selectedSpl)}
                                        </pre>
                                    ) : (
                                        <p className="text-[11px] text-slate-400 leading-relaxed">
                                            No searchbase binding for this topology item.
                                        </p>
                                    )}
                                </div>
                            )}
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
                                        ? isDark
                                            ? 'text-sky-400 hover:text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 cursor-pointer'
                                            : 'text-sky-700 hover:text-sky-800 bg-sky-50 hover:bg-sky-100 cursor-pointer'
                                        : isDark
                                          ? 'text-slate-500 bg-slate-700/30 cursor-not-allowed'
                                          : 'text-slate-400 bg-slate-100 cursor-not-allowed'
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
    /**
     * Searchbase catalogue keyed by `searchName`. Used to populate the
     * per-site and per-link "Pick search…" dropdowns so demo / fake
     * stanzas can be swapped in without typing the stanza name.
     * `null` while the catalogue is still loading.
     */
    catalogueByName: Record<string, SearchbaseRecord> | null;
    /**
     * Optional dispatch for the per-card "Open in Splunk Search"
     * affordance. When wired by the parent map, each editor card
     * gets a button that pushes the bound stanza's SPL into a new
     * Splunk Search tab — same UX as the "Open in Search" buttons
     * on tile pickers, so operators can sanity-check a search
     * before saving the topology.
     */
    onOpenInSearch?: (spl: string) => void;
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
    catalogueByName,
    onOpenInSearch,
}) => {
    const [jsonText, setJsonText] = useState('');
    const [jsonError, setJsonError] = useState<string | null>(null);

    // The editor's per-card pickers browse the FULL Cisco-tagged
    // catalogue, identical to the in-popup `TopologySearchBrowser`.
    // Tag-narrowing (Topology_Site / Topology_Link) is a *sort
    // hint*, not a filter — those entries float to the top of the
    // list, but every Cisco stanza is reachable via search. This
    // matches the KpiPickerPanel browsing model so editing a tile
    // and editing a topology element feel like the same operation.
    const editorSearchOptions = useMemo(() => {
        if (!catalogueByName) return [] as SearchbaseRecord[];
        return Object.values(catalogueByName)
            .filter((record) => record.tags.includes('Cisco'))
            .sort((a, b) =>
                a.searchName.localeCompare(b.searchName, undefined, {
                    sensitivity: 'base',
                })
            );
    }, [catalogueByName]);

    // Collapsed-by-default site / link cards. Storing the
    // *expanded* set (rather than the collapsed set) means a fresh
    // editor open shows everything compact, matching Alan's 2026-
    // 05-13 ask: "can the sites and links default to collapsable
    // here?". Keys are site / link IDs, namespaced with `site:` /
    // `link:` so a future shared ID space wouldn't collide.
    const [expandedCardKeys, setExpandedCardKeys] = useState<Set<string>>(
        () => new Set()
    );
    const toggleCardExpanded = useCallback((key: string) => {
        setExpandedCardKeys((prev) => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    }, []);
    // Reset card-collapse state every time the editor closes so a
    // re-open starts from the canonical "everything collapsed"
    // baseline. Without this, a long editing session can leave a
    // dozen cards expanded across multiple sessions.
    useEffect(() => {
        if (!open) setExpandedCardKeys(new Set());
    }, [open]);

    // SPL lookup helper for the per-card "Open in Search" button.
    // Reads the searchbase catalogue and dispatches the bound
    // stanza's literal SPL through the parent's `onOpenInSearch`
    // handler — same plumbing as the read-only popup's button, so
    // both surfaces behave identically.
    const handleOpenInSearch = useCallback(
        (searchName: string | undefined) => {
            if (!searchName || !onOpenInSearch || !catalogueByName) return;
            const spl = catalogueByName[searchName]?.search?.trim();
            if (spl) onOpenInSearch(spl);
        },
        [onOpenInSearch, catalogueByName]
    );

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
                        // Background is fully opaque so map labels (city
                        // names, road outlines) don't bleed through the
                        // form fields — that was the "I can't read what
                        // I'm typing" complaint. Earlier revisions used
                        // `bg-slate-950/96` / `bg-white/98` for a frosted
                        // feel, but those slash-opacity values aren't in
                        // Tailwind's default scale and aren't in
                        // `tailwind.config.js`, so they were silently
                        // dropped — the panel rendered effectively
                        // transparent. `backdrop-blur-sm` keeps a subtle
                        // overlay feel for the small areas around the
                        // rounded corners and on top of any drag-handle
                        // sticker that pokes out, without sacrificing
                        // legibility of the main form area.
                        'absolute top-3 right-3 bottom-3 z-[2200] w-[min(430px,calc(100%-1.5rem))] rounded-xl border shadow-2xl overflow-hidden flex flex-col backdrop-blur-sm',
                        isDark
                            ? 'bg-slate-950 border-slate-700 text-slate-100'
                            : 'bg-white border-slate-200 text-slate-800'
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
                                {topology.sites.map((site) => {
                                    const cardKey = `site:${site.id}`;
                                    const isExpanded =
                                        expandedCardKeys.has(cardKey);
                                    const boundSearch =
                                        site.searchName?.trim() || '';
                                    return (
                                    <div
                                        key={site.id}
                                        className={cn(
                                            'rounded-lg border overflow-hidden',
                                            isDark
                                                ? 'border-slate-800 bg-slate-900/70'
                                                : 'border-slate-200 bg-slate-50'
                                        )}
                                    >
                                        {/*
                                            Collapsible header. Click the
                                            chevron + ID block to toggle the
                                            full-detail body. Defaulting to
                                            collapsed (per Alan's 2026-05-13
                                            ask) keeps the editor panel
                                            short on customers with lots of
                                            sites — operators expand only
                                            the card they're touching.
                                        */}
                                        <div className="flex items-center justify-between gap-2 p-3">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    toggleCardExpanded(cardKey)
                                                }
                                                aria-expanded={isExpanded}
                                                title={
                                                    isExpanded
                                                        ? 'Collapse site details'
                                                        : 'Expand site details'
                                                }
                                                className={cn(
                                                    'flex items-center gap-2 min-w-0 flex-1 text-left rounded transition-colors focus:outline-none focus:ring-1 focus:ring-sky-400'
                                                )}
                                            >
                                                <ChevronRight
                                                    className={cn(
                                                        'w-3.5 h-3.5 flex-shrink-0 transition-transform',
                                                        isDark
                                                            ? 'text-slate-400'
                                                            : 'text-slate-500',
                                                        isExpanded && 'rotate-90'
                                                    )}
                                                />
                                                <MapPin className="w-4 h-4 text-sky-500 flex-shrink-0" />
                                                <div className="min-w-0 flex-1">
                                                    <div className="text-[10px] font-mono uppercase text-slate-400 truncate">
                                                        {site.id}
                                                    </div>
                                                    <div
                                                        className={cn(
                                                            'text-[10px] truncate',
                                                            boundSearch
                                                                ? isDark
                                                                    ? 'text-slate-200'
                                                                    : 'text-slate-700'
                                                                : isDark
                                                                ? 'text-slate-500 italic'
                                                                : 'text-slate-400 italic'
                                                        )}
                                                        title={
                                                            boundSearch ||
                                                            'No search bound — expand to pick one.'
                                                        }
                                                    >
                                                        {boundSearch ||
                                                            'No search bound'}
                                                    </div>
                                                </div>
                                            </button>
                                            <div className="flex items-center gap-1">
                                                {onOpenInSearch && (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            handleOpenInSearch(
                                                                boundSearch
                                                            )
                                                        }
                                                        disabled={!boundSearch}
                                                        title={
                                                            boundSearch
                                                                ? `Open this search in Splunk Search to test it`
                                                                : 'Pick a search first to enable testing'
                                                        }
                                                        className={cn(
                                                            'p-1.5 rounded-md transition-colors focus:outline-none focus:ring-1 focus:ring-sky-400',
                                                            !boundSearch
                                                                ? isDark
                                                                    ? 'bg-slate-800/50 text-slate-600 cursor-not-allowed'
                                                                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                                                : isDark
                                                                ? 'bg-slate-800 text-sky-300 hover:bg-sky-950/70'
                                                                : 'bg-white text-sky-700 hover:bg-sky-50'
                                                        )}
                                                    >
                                                        <ExternalLink className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
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
                                        {isExpanded && (
                                        <div
                                            className={cn(
                                                'px-3 pb-3 space-y-2 border-t',
                                                isDark
                                                    ? 'border-slate-800'
                                                    : 'border-slate-200'
                                            )}
                                        >
                                        {/*
                                            Data-source picker. Lives at the
                                            top of the expanded body because
                                            "which search powers this
                                            marker?" is the most-asked
                                            question once the site exists in
                                            the topology. The header above
                                            already shows the bound search
                                            name + an "Open in Search"
                                            button so an operator can
                                            sanity-check before expanding
                                            the picker.
                                        */}
                                        <div className="pt-2">
                                            <TopologySearchBrowser
                                                catalogue={editorSearchOptions}
                                                currentSearchName={
                                                    site.searchName ?? ''
                                                }
                                                preferredTags={['Topology_Site']}
                                                label="site"
                                                onPick={(searchName) =>
                                                    updateSite(site.id, {
                                                        searchName,
                                                    })
                                                }
                                                isDark={isDark}
                                                showFreeFormInput
                                            />
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
                                                Internet edge Mbps
                                            </span>
                                            <input
                                                type="number"
                                                min="0"
                                                step="1"
                                                className={editorInputClass(isDark)}
                                                value={site.internetEdgeMbps ?? ''}
                                                placeholder="e.g. 1000"
                                                onChange={(event) =>
                                                    updateSite(site.id, {
                                                        internetEdgeMbps:
                                                            event.target.value === ''
                                                                ? undefined
                                                                : Number(
                                                                      event.target
                                                                          .value
                                                                  ),
                                                    })
                                                }
                                            />
                                            <span
                                                className={cn(
                                                    'block text-[9px] tracking-wide',
                                                    isDark
                                                        ? 'text-slate-500'
                                                        : 'text-slate-400'
                                                )}
                                            >
                                                Optional. Populates the
                                                "Design of Record" line on this
                                                site&rsquo;s popup. Leave blank
                                                if the circuit speed is not
                                                confirmed yet.
                                            </span>
                                        </label>
                                        </div>
                                        )}
                                    </div>
                                    );
                                })}
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
                                {topology.links.map((link) => {
                                    const cardKey = `link:${link.id}`;
                                    const isExpanded =
                                        expandedCardKeys.has(cardKey);
                                    const boundSearch =
                                        link.searchName?.trim() || '';
                                    return (
                                    <div
                                        key={link.id}
                                        className={cn(
                                            'rounded-lg border overflow-hidden',
                                            isDark
                                                ? 'border-slate-800 bg-slate-900/70'
                                                : 'border-slate-200 bg-slate-50'
                                        )}
                                    >
                                        <div className="flex items-center justify-between gap-2 p-3">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    toggleCardExpanded(cardKey)
                                                }
                                                aria-expanded={isExpanded}
                                                title={
                                                    isExpanded
                                                        ? 'Collapse link details'
                                                        : 'Expand link details'
                                                }
                                                className="flex items-center gap-2 min-w-0 flex-1 text-left rounded transition-colors focus:outline-none focus:ring-1 focus:ring-sky-400"
                                            >
                                                <ChevronRight
                                                    className={cn(
                                                        'w-3.5 h-3.5 flex-shrink-0 transition-transform',
                                                        isDark
                                                            ? 'text-slate-400'
                                                            : 'text-slate-500',
                                                        isExpanded && 'rotate-90'
                                                    )}
                                                />
                                                <Link2 className="w-4 h-4 text-sky-500 flex-shrink-0" />
                                                <div className="min-w-0 flex-1">
                                                    <div className="text-[10px] font-mono uppercase text-slate-400 truncate">
                                                        {link.id}
                                                    </div>
                                                    <div
                                                        className={cn(
                                                            'text-[10px] truncate',
                                                            boundSearch
                                                                ? isDark
                                                                    ? 'text-slate-200'
                                                                    : 'text-slate-700'
                                                                : isDark
                                                                ? 'text-slate-500 italic'
                                                                : 'text-slate-400 italic'
                                                        )}
                                                        title={
                                                            boundSearch ||
                                                            'No search bound — expand to pick one.'
                                                        }
                                                    >
                                                        {boundSearch ||
                                                            'No search bound'}
                                                    </div>
                                                </div>
                                            </button>
                                            <div className="flex items-center gap-1">
                                                {onOpenInSearch && (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            handleOpenInSearch(
                                                                boundSearch
                                                            )
                                                        }
                                                        disabled={!boundSearch}
                                                        title={
                                                            boundSearch
                                                                ? 'Open this search in Splunk Search to test it'
                                                                : 'Pick a search first to enable testing'
                                                        }
                                                        className={cn(
                                                            'p-1.5 rounded-md transition-colors focus:outline-none focus:ring-1 focus:ring-sky-400',
                                                            !boundSearch
                                                                ? isDark
                                                                    ? 'bg-slate-800/50 text-slate-600 cursor-not-allowed'
                                                                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                                                : isDark
                                                                ? 'bg-slate-800 text-sky-300 hover:bg-sky-950/70'
                                                                : 'bg-white text-sky-700 hover:bg-sky-50'
                                                        )}
                                                    >
                                                        <ExternalLink className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
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
                                        </div>
                                        {isExpanded && (
                                        <div
                                            className={cn(
                                                'px-3 pb-3 space-y-2 border-t',
                                                isDark
                                                    ? 'border-slate-800'
                                                    : 'border-slate-200'
                                            )}
                                        >
                                        {/*
                                            Editor variant of the link
                                            catalogue browser. Same
                                            component as the site card,
                                            scoped to `Topology_Link`-tagged
                                            stanzas as the preferred sort
                                            but with full Cisco-tagged
                                            catalogue browsable. The
                                            header above already shows the
                                            bound search name + an "Open
                                            in Search" button for quick
                                            sanity-checks.
                                        */}
                                        <div className="pt-2">
                                            <TopologySearchBrowser
                                                catalogue={editorSearchOptions}
                                                currentSearchName={
                                                    link.searchName ?? ''
                                                }
                                                preferredTags={['Topology_Link']}
                                                label="link"
                                                onPick={(searchName) =>
                                                    updateLink(link.id, {
                                                        searchName,
                                                    })
                                                }
                                                isDark={isDark}
                                                showFreeFormInput
                                            />
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
                                        </div>
                                        )}
                                    </div>
                                    );
                                })}
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
    isDark: boolean;
    enrichment?: SiteEnrichment;
}

const SiteDetails: React.FC<SiteDetailsProps> = ({
    site,
    links,
    isDark,
    enrichment,
}) => {
    const hasEnrichment = Boolean(
        enrichment &&
            (enrichment.address ||
                enrichment.lat !== undefined ||
                enrichment.lon !== undefined)
    );
    const coordinatesLabel =
        enrichment?.lat !== undefined && enrichment?.lon !== undefined
            ? `${enrichment.lat.toFixed(5)}, ${enrichment.lon.toFixed(5)}`
            : null;

    return (
        <>
            <div className="grid grid-cols-3 gap-2">
                <MetricPill
                    label="Health"
                    value={formatPercent(site.metrics.healthPct)}
                    isDark={isDark}
                />
                <MetricPill
                    label="Devices"
                    value={formatNumber(site.metrics.activeDevices)}
                    isDark={isDark}
                />
                <MetricPill
                    label="Alerts"
                    value={formatNumber(site.metrics.alerts)}
                    isDark={isDark}
                />
            </div>
            {hasEnrichment && (
                <div
                    className={cn(
                        'rounded border p-2 space-y-1',
                        isDark
                            ? 'bg-white/5 border-white/5'
                            : 'bg-slate-50 border-slate-200'
                    )}
                >
                    <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-slate-500">
                        <MapPin className="w-3 h-3" />
                        Address & Location
                    </div>
                    {enrichment?.address && (
                        <p
                            className={cn(
                                'text-[10px] leading-relaxed',
                                isDark ? 'text-slate-300' : 'text-slate-700'
                            )}
                        >
                            {enrichment.address}
                        </p>
                    )}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[9px] text-slate-500 leading-relaxed">
                        {enrichment?.country && (
                            <span>{enrichment.country}</span>
                        )}
                        {coordinatesLabel && (
                            <span className="font-mono">
                                {coordinatesLabel}
                            </span>
                        )}
                        {enrichment?.siteLabel && (
                            <span className="font-mono">
                                {enrichment.siteLabel}
                            </span>
                        )}
                    </div>
                    <p className="text-[9px] text-slate-500 leading-relaxed">
                        Source: cisco:dnac:site:topology
                        {enrichment?.lastUpdated
                            ? ` - Updated ${enrichment.lastUpdated}`
                            : ''}
                    </p>
                </div>
            )}
            {site.internetEdgeMbps !== undefined && (
                <div
                    className={cn(
                        'rounded border p-2 space-y-1',
                        isDark
                            ? 'bg-white/5 border-white/5'
                            : 'bg-slate-50 border-slate-200'
                    )}
                >
                    <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-slate-500">
                        <Globe className="w-3 h-3" />
                        Design of Record
                    </div>
                    <div className="flex items-center justify-between gap-2 text-[10px] leading-relaxed">
                        <span
                            className={cn(
                                isDark ? 'text-slate-300' : 'text-slate-700'
                            )}
                        >
                            Internet Edge Bandwidth
                        </span>
                        <span
                            className={cn(
                                'font-mono font-bold',
                                isDark ? 'text-slate-100' : 'text-slate-900'
                            )}
                        >
                            {formatMbps(site.internetEdgeMbps)}
                        </span>
                    </div>
                    <p className="text-[9px] text-slate-500 leading-relaxed">
                        Static configuration value &mdash; will be overridden
                        when per-site Internet uplink telemetry is wired in.
                    </p>
                </div>
            )}
            <div
                className={cn(
                    'rounded border p-2 space-y-1',
                    isDark
                        ? 'bg-white/5 border-white/5'
                        : 'bg-slate-50 border-slate-200'
                )}
            >
                <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-slate-500">
                    <Code2 className="w-3 h-3" />
                    Telemetry Source
                </div>
                <p
                    className={cn(
                        'text-[10px] leading-relaxed',
                        isDark ? 'text-slate-300' : 'text-slate-700'
                    )}
                >
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
                                className={cn(
                                    'flex items-center justify-between gap-2 rounded border px-2 py-1',
                                    isDark
                                        ? 'bg-white/5 border-white/5'
                                        : 'bg-white border-slate-200'
                                )}
                                title={`${link.name}: ${formatMbps(
                                    link.throughputMbps
                                )}, ${formatPercent(
                                    link.utilizationPct
                                )} utilized`}
                            >
                                <div className="min-w-0">
                                    <span
                                        className={cn(
                                            'block text-[10px] font-bold truncate',
                                            isDark
                                                ? 'text-slate-300'
                                                : 'text-slate-700'
                                        )}
                                    >
                                        {link.name}
                                    </span>
                                    <span className="block text-[8.5px] font-mono text-slate-500 truncate">
                                        {formatMbps(link.throughputMbps)} ·{' '}
                                        {formatPercent(link.utilizationPct)}
                                    </span>
                                </div>
                                <div className="flex flex-shrink-0 items-center gap-1.5">
                                    {link.capacityMbps !== undefined && (
                                        <span className="font-mono text-[8.5px] text-slate-500">
                                            {formatMbps(link.capacityMbps)}
                                        </span>
                                    )}
                                    <span
                                        className={cn(
                                            'w-2 h-2 rounded-full',
                                            STATUS_DOT_CLASS[link.status]
                                        )}
                                        title={link.status}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </>
    );
};

interface LinkDetailsProps {
    link: TopologyLink;
    siteById: Record<string, TopologySite>;
    isDark: boolean;
}

const LinkDetails: React.FC<LinkDetailsProps> = ({ link, siteById, isDark }) => {
    // Render the agent pair only when both sides are present. We learned on
    // 2026-05-12 that TE test names can be misleading (the "TLH - AUB
    // Connection" test was actually targeting an Orlando agent under the
    // hood), so when the underlying data carries explicit source/target
    // agent names, we display them prominently in the popup as ground truth
    // — that way the operator sees which agents are *actually* being probed,
    // not just the test's marketing name.
    const showAgentPair = Boolean(link.sourceAgents && link.targetAgents);
    return (
        <>
            <div className="grid grid-cols-2 gap-2">
                <MetricPill
                    label="Capacity"
                    value={formatMbps(link.capacityMbps)}
                    isDark={isDark}
                />
                <MetricPill
                    label="Throughput"
                    value={formatMbps(link.throughputMbps)}
                    isDark={isDark}
                />
                <MetricPill
                    label="Peak Throughput"
                    value={formatMbps(link.peakThroughputMbps)}
                    isDark={isDark}
                />
                <MetricPill
                    label="Utilization"
                    value={formatPercent(link.utilizationPct)}
                    isDark={isDark}
                />
                <MetricPill
                    label="Peak Utilization"
                    value={formatPercent(link.peakUtilizationPct)}
                    isDark={isDark}
                />
                <MetricPill
                    label="Latency"
                    value={formatLatency(link.latencyMs)}
                    isDark={isDark}
                />
                <MetricPill
                    label="Loss"
                    value={formatPercent(link.lossPct)}
                    isDark={isDark}
                />
                <MetricPill
                    label="Jitter"
                    value={formatLatency(link.jitterMs)}
                    isDark={isDark}
                />
                <MetricPill
                    label="Endpoint Health"
                    value={formatPercent(link.endpointHealthPct)}
                    isDark={isDark}
                />
            </div>
            <div
                className={cn(
                    'rounded border p-2 space-y-1',
                    isDark ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-200'
                )}
            >
                <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-slate-500">
                    <Code2 className="w-3 h-3" />
                    Telemetry Source
                </div>
                <p
                    className={cn(
                        'text-[10px] leading-relaxed',
                        isDark ? 'text-slate-300' : 'text-slate-700'
                    )}
                >
                    {link.telemetrySource}
                </p>
                {showAgentPair && (
                    <p
                        className={cn(
                            'text-[10px] leading-relaxed font-mono',
                            isDark ? 'text-slate-400' : 'text-slate-600'
                        )}
                    >
                        Measured by {link.sourceAgents}
                        {' \u2194 '}
                        {link.targetAgents}
                    </p>
                )}
                {(link.sourceLocation || link.targetLocation) && (
                    <p
                        className={cn(
                            'text-[9px] leading-relaxed',
                            isDark ? 'text-slate-400' : 'text-slate-600'
                        )}
                    >
                        {link.sourceLocation ?? '\u2014'}
                        {' \u2194 '}
                        {link.targetLocation ?? '\u2014'}
                    </p>
                )}
                <p className="text-[9px] text-slate-500 leading-relaxed">
                    {siteById[link.sourceSiteId]?.name ?? link.sourceSiteId} to{' '}
                    {siteById[link.targetSiteId]?.name ?? link.targetSiteId}
                    {link.lastUpdated ? ` - Updated ${link.lastUpdated}` : ''}
                    {link.dataState === 'error' && link.dataError
                        ? ` - ${link.dataError}`
                        : ''}
                </p>
                {link.teLink && (
                    <a
                        href={link.teLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                            'mt-1 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold transition-colors',
                            isDark
                                ? 'bg-sky-500/10 text-sky-300 hover:bg-sky-500/20'
                                : 'bg-sky-50 text-sky-700 hover:bg-sky-100'
                        )}
                    >
                        <ExternalLink className="w-3 h-3" />
                        View in ThousandEyes
                    </a>
                )}
            </div>
        </>
    );
};

interface MetricPillProps {
    label: string;
    value: string;
    isDark: boolean;
}

const MetricPill: React.FC<MetricPillProps> = ({ label, value, isDark }) => (
    <div
        className={cn(
            'flex flex-col p-2 rounded border',
            isDark ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-200'
        )}
    >
        <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-1">
            {label}
        </span>
        <span
            className={cn(
                'text-lg font-black font-mono leading-none truncate',
                isDark ? 'text-white' : 'text-slate-900'
            )}
        >
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
