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
    Crosshair,
    Download,
    ExternalLink,
    Globe,
    Layers,
    Link2,
    Loader2,
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
    plainTextFromHtml,
    type SearchbaseRecord,
} from '@/common/services/searchbaseCatalogue';
import {
    DEFAULT_CUSTOMER_TOPOLOGY_SECTION_TITLES,
    loadCustomerTopologyConfig,
    saveCustomerTopologyConfig,
    sanitizeCustomerTopologySectionTitles,
    type CustomerTopologySectionTitles,
} from '@/common/services/customerTopologyPersistenceService';
import { runSearch } from '@/common/services/splunkSearchService';
import type {
    CustomerTopology,
    KnownTopologyRole,
    ThousandEyesA2ABinding,
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
    name: 'Customer Site Connectivity',
    subtitle: 'Editable customer site connectivity',
    map: {
        center: [39.5, -98.35],
        zoom: 4.2,
        minZoom: 3,
        maxZoom: 11,
        bounds: [
            [24.0, -126.0],
            [50.5, -66.0],
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
    // writes to the shared customer_topology.conf payload and immediately
    // repopulates the popup for every user. If the customer's network
    // team ever confirms actual circuit bandwidths, the values can be
    // restored here as a packaged default and the shared config entry
    // will override them at runtime.
    sites: [
        {
            id: 'nyc',
            name: 'New York City',
            shortName: 'NYC',
            role: 'state_hq',
            lat: 40.7128,
            lng: -74.006,
            status: 'unknown',
            metrics: {},
            telemetrySource: 'Configured topology item',
        },
        {
            id: 'chicago',
            name: 'Chicago',
            shortName: 'CHI',
            role: 'regional_hub',
            lat: 41.8781,
            lng: -87.6298,
            status: 'unknown',
            metrics: {},
            telemetrySource: 'Configured topology item',
        },
        {
            id: 'austin',
            name: 'Austin',
            shortName: 'AUS',
            role: 'branch',
            lat: 30.2672,
            lng: -97.7431,
            status: 'unknown',
            metrics: {},
            telemetrySource: 'Configured topology item',
        },
        {
            id: 'san-francisco',
            name: 'San Francisco',
            shortName: 'SFO',
            role: 'datacenter',
            lat: 37.7749,
            lng: -122.4194,
            status: 'unknown',
            metrics: {},
            telemetrySource: 'Configured topology item',
        },
        {
            id: 'seattle',
            name: 'Seattle',
            shortName: 'SEA',
            role: 'branch',
            lat: 47.6062,
            lng: -122.3321,
            status: 'unknown',
            metrics: {},
            telemetrySource: 'Configured topology item',
        },
    ],
    links: [
        {
            id: 'nyc-chicago',
            name: 'New York City to Chicago',
            sourceSiteId: 'nyc',
            targetSiteId: 'chicago',
            status: 'unknown',
            telemetrySource: 'Configured topology item',
        },
        {
            id: 'chicago-austin',
            name: 'Chicago to Austin',
            sourceSiteId: 'chicago',
            targetSiteId: 'austin',
            status: 'unknown',
            telemetrySource: 'Configured topology item',
        },
        {
            id: 'austin-san-francisco',
            name: 'Austin to San Francisco',
            sourceSiteId: 'austin',
            targetSiteId: 'san-francisco',
            status: 'unknown',
            telemetrySource: 'Configured topology item',
        },
        {
            id: 'san-francisco-seattle',
            name: 'San Francisco to Seattle',
            sourceSiteId: 'san-francisco',
            targetSiteId: 'seattle',
            status: 'unknown',
            telemetrySource: 'Configured topology item',
        },
        {
            id: 'seattle-chicago',
            name: 'Seattle to Chicago',
            sourceSiteId: 'seattle',
            targetSiteId: 'chicago',
            status: 'unknown',
            telemetrySource: 'Configured topology item',
        },
    ],
};

const STATUS_RANK: Record<TopologyStatus, number> = {
    critical: 4,
    warning: 3,
    unknown: 2,
    stable: 1,
};

const TOPOLOGY_ROLES: KnownTopologyRole[] = [
    'state_hq',
    'regional_hub',
    'logistics',
    'branch',
    'datacenter',
    'internet_edge',
    'campus',
    'office',
    'event_venue',
    'cisco_live',
    'lab',
    'cloud_region',
];

const TOPOLOGY_ROLE_SET = new Set<string>(TOPOLOGY_ROLES);

const isKnownTopologyRole = (value: unknown): value is KnownTopologyRole =>
    typeof value === 'string' && TOPOLOGY_ROLE_SET.has(value);

const ROLE_LABEL: Record<KnownTopologyRole, string> = {
    state_hq: 'HQ',
    regional_hub: 'Regional Hub',
    logistics: 'Logistics',
    branch: 'Branch',
    datacenter: 'Data Center',
    internet_edge: 'Internet Edge',
    campus: 'Campus',
    office: 'Office',
    event_venue: 'Event Venue',
    cisco_live: 'Cisco Live',
    lab: 'Lab',
    cloud_region: 'Cloud Region',
};

const topologyRoleLabel = (role: TopologyRole | undefined): string => {
    const value = typeof role === 'string' ? role.trim() : '';
    if (!value) return 'Role';
    if (isKnownTopologyRole(value)) return ROLE_LABEL[value];

    const spaced = value.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!spaced) return 'Role';
    if (spaced === spaced.toLowerCase()) {
        return spaced.replace(/\b[a-z0-9]/g, (match) => match.toUpperCase());
    }
    return spaced;
};

const normalizeTopologyRoleInput = (
    value: unknown,
    fallback: TopologyRole = 'branch'
): TopologyRole => {
    if (typeof value !== 'string') return fallback;
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    const lower = trimmed.toLowerCase();
    const compact = lower.replace(/[\s_-]+/g, '');
    for (const role of TOPOLOGY_ROLES) {
        if (
            lower === role ||
            lower === ROLE_LABEL[role].toLowerCase() ||
            compact === role.replace(/_/g, '')
        ) {
            return role;
        }
    }
    if (compact === 'hq' || compact === 'headquarters') return 'state_hq';
    if (compact === 'datacenter' || compact === 'datacentre') {
        return 'datacenter';
    }
    return trimmed;
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

const ROLE_DOT_CLASS: Record<KnownTopologyRole, string> = {
    state_hq: 'bg-sky-600',
    regional_hub: 'bg-blue-600',
    logistics: 'bg-indigo-600',
    branch: 'bg-violet-600',
    datacenter: 'bg-purple-600',
    internet_edge: 'bg-slate-600',
    campus: 'bg-cyan-600',
    office: 'bg-sky-400',
    event_venue: 'bg-fuchsia-600',
    cisco_live: 'bg-violet-400',
    lab: 'bg-indigo-400',
    cloud_region: 'bg-zinc-700',
};

type RoleBeaconChrome = { fill: string; halo: string; label: string };

const CUSTOM_ROLE_SWATCHES: Array<{
    dotClass: string;
    chrome: RoleBeaconChrome;
}> = [
    {
        dotClass: 'bg-slate-500',
        chrome: {
            fill: '#64748b',
            halo: 'rgba(100, 116, 139, 0.22)',
            label: 'border-slate-200',
        },
    },
    {
        dotClass: 'bg-cyan-500',
        chrome: {
            fill: '#06b6d4',
            halo: 'rgba(6, 182, 212, 0.23)',
            label: 'border-cyan-200',
        },
    },
    {
        dotClass: 'bg-sky-500',
        chrome: {
            fill: '#0ea5e9',
            halo: 'rgba(14, 165, 233, 0.23)',
            label: 'border-sky-200',
        },
    },
    {
        dotClass: 'bg-blue-500',
        chrome: {
            fill: '#3b82f6',
            halo: 'rgba(59, 130, 246, 0.23)',
            label: 'border-blue-200',
        },
    },
    {
        dotClass: 'bg-indigo-500',
        chrome: {
            fill: '#6366f1',
            halo: 'rgba(99, 102, 241, 0.23)',
            label: 'border-indigo-200',
        },
    },
    {
        dotClass: 'bg-violet-500',
        chrome: {
            fill: '#8b5cf6',
            halo: 'rgba(139, 92, 246, 0.24)',
            label: 'border-violet-200',
        },
    },
    {
        dotClass: 'bg-purple-500',
        chrome: {
            fill: '#a855f7',
            halo: 'rgba(168, 85, 247, 0.23)',
            label: 'border-purple-200',
        },
    },
    {
        dotClass: 'bg-fuchsia-500',
        chrome: {
            fill: '#d946ef',
            halo: 'rgba(217, 70, 239, 0.23)',
            label: 'border-fuchsia-200',
        },
    },
    {
        dotClass: 'bg-zinc-500',
        chrome: {
            fill: '#71717a',
            halo: 'rgba(113, 113, 122, 0.22)',
            label: 'border-zinc-200',
        },
    },
];

const customRoleSwatchIndex = (role: TopologyRole): number => {
    const value = String(role ?? '').trim().toLowerCase();
    if (!value) return 0;
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
        hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
    }
    return hash % CUSTOM_ROLE_SWATCHES.length;
};

const customRoleSwatch = (role: TopologyRole) =>
    CUSTOM_ROLE_SWATCHES[customRoleSwatchIndex(role)] ?? CUSTOM_ROLE_SWATCHES[0];

const topologyRoleDotClass = (role: TopologyRole): string =>
    isKnownTopologyRole(role) ? ROLE_DOT_CLASS[role] : customRoleSwatch(role).dotClass;

const ROLE_BEACON_CHROME: Record<
    KnownTopologyRole,
    RoleBeaconChrome
> = {
    state_hq: {
        fill: '#0284c7',
        halo: 'rgba(2, 132, 199, 0.26)',
        label: 'border-sky-200',
    },
    regional_hub: {
        fill: '#2563eb',
        halo: 'rgba(37, 99, 235, 0.23)',
        label: 'border-blue-200',
    },
    logistics: {
        fill: '#4f46e5',
        halo: 'rgba(79, 70, 229, 0.23)',
        label: 'border-indigo-200',
    },
    branch: {
        fill: '#7c3aed',
        halo: 'rgba(124, 58, 237, 0.23)',
        label: 'border-violet-200',
    },
    datacenter: {
        fill: '#9333ea',
        halo: 'rgba(147, 51, 234, 0.23)',
        label: 'border-purple-200',
    },
    internet_edge: {
        fill: '#475569',
        halo: 'rgba(71, 85, 105, 0.22)',
        label: 'border-slate-200',
    },
    campus: {
        fill: '#0891b2',
        halo: 'rgba(8, 145, 178, 0.23)',
        label: 'border-cyan-200',
    },
    office: {
        fill: '#38bdf8',
        halo: 'rgba(56, 189, 248, 0.23)',
        label: 'border-sky-200',
    },
    event_venue: {
        fill: '#c026d3',
        halo: 'rgba(192, 38, 211, 0.23)',
        label: 'border-fuchsia-200',
    },
    cisco_live: {
        fill: '#a78bfa',
        halo: 'rgba(167, 139, 250, 0.24)',
        label: 'border-violet-200',
    },
    lab: {
        fill: '#818cf8',
        halo: 'rgba(129, 140, 248, 0.23)',
        label: 'border-indigo-200',
    },
    cloud_region: {
        fill: '#3f3f46',
        halo: 'rgba(63, 63, 70, 0.23)',
        label: 'border-zinc-200',
    },
};

const topologyRoleBeaconChrome = (role: TopologyRole) =>
    isKnownTopologyRole(role)
        ? ROLE_BEACON_CHROME[role]
        : customRoleSwatch(role).chrome;

const LEGACY_TOPOLOGY_STORAGE_KEY = 'splunk-cisco-dashboards.customerTopology.v4';
const TOPOLOGY_CONFIG_EVENT = 'splunk-cisco-dashboards:customer-topology-config';
const TOPOLOGY_STORAGE_VERSION = 4;
const TOPOLOGY_STATUSES: TopologyStatus[] = [
    'unknown',
    'stable',
    'warning',
    'critical',
];

const TOPOLOGY_STATUS_FIELD_HELP =
    'Fallback/manual status. If this item has a bound search, live search results ' +
    'override it after they load.';

const TE_A2A_INVENTORY_SEARCH_NAME = 'Overview - Link ThousandEyes A2A Inventory';
const TE_A2A_MATCH_THRESHOLD = 72;
const TE_A2A_CLOSE_MATCH_DELTA = 8;
const TE_A2A_STOP_WORDS = new Set([
    'and',
    'branch',
    'building',
    'campus',
    'center',
    'centre',
    'city',
    'cloud',
    'data',
    'datacenter',
    'edge',
    'hq',
    'hub',
    'office',
    'regional',
    'site',
    'state',
    'the',
]);

const SITE_PLACEMENT_PRESETS: Array<{
    aliases: string[];
    name: string;
    shortName: string;
    lat: number;
    lng: number;
}> = [
    // Offline city resolver for the topology editor. This is not a full
    // geocoder, but it covers common global sites without leaking customer
    // topology names to a public geocoding API from Splunk Web.
    {
        aliases: ['nyc', 'new york', 'new york city', 'new york ny', 'new york, ny', 'new york, usa'],
        name: 'New York City',
        shortName: 'NYC',
        lat: 40.7128,
        lng: -74.006,
    },
    {
        aliases: ['dc', 'washington dc', 'washington, dc', 'washington, usa'],
        name: 'Washington DC',
        shortName: 'DC',
        lat: 38.9072,
        lng: -77.0369,
    },
    {
        aliases: ['la', 'los angeles', 'los angeles ca', 'los angeles, ca', 'los angeles, usa'],
        name: 'Los Angeles',
        shortName: 'LA',
        lat: 34.0522,
        lng: -118.2437,
    },
    {
        aliases: ['chi', 'chicago', 'chicago il', 'chicago, il', 'chicago, usa'],
        name: 'Chicago',
        shortName: 'CHI',
        lat: 41.8781,
        lng: -87.6298,
    },
    {
        aliases: ['aus', 'austin', 'austin tx', 'austin, tx', 'austin, usa'],
        name: 'Austin',
        shortName: 'AUS',
        lat: 30.2672,
        lng: -97.7431,
    },
    {
        aliases: [
            'sf',
            'sfo',
            'san francisco',
            'san francisco ca',
            'san francisco, ca',
            'san francisco, usa',
        ],
        name: 'San Francisco',
        shortName: 'SFO',
        lat: 37.7749,
        lng: -122.4194,
    },
    {
        aliases: ['sea', 'seattle', 'seattle wa', 'seattle, wa', 'seattle, usa'],
        name: 'Seattle',
        shortName: 'SEA',
        lat: 47.6062,
        lng: -122.3321,
    },
    {
        aliases: ['dal', 'dallas', 'dallas tx', 'dallas, tx', 'dallas, usa'],
        name: 'Dallas',
        shortName: 'DAL',
        lat: 32.7767,
        lng: -96.797,
    },
    {
        aliases: ['atl', 'atlanta', 'atlanta ga', 'atlanta, ga', 'atlanta, usa'],
        name: 'Atlanta',
        shortName: 'ATL',
        lat: 33.749,
        lng: -84.388,
    },
    {
        aliases: ['mia', 'miami', 'miami fl', 'miami, fl', 'miami, usa'],
        name: 'Miami',
        shortName: 'MIA',
        lat: 25.7617,
        lng: -80.1918,
    },
    {
        aliases: [
            'las',
            'lv',
            'vegas',
            'las vegas',
            'las vegas, nv',
            'las vegas nv',
            'las vegas, usa',
        ],
        name: 'Las Vegas',
        shortName: 'LAS',
        lat: 36.1699,
        lng: -115.1398,
    },
    {
        aliases: ['sjc', 'san jose', 'san jose ca', 'san jose, ca', 'san jose, california', 'san jose, usa'],
        name: 'San Jose, CA',
        shortName: 'SJC',
        lat: 37.3382,
        lng: -121.8863,
    },
    {
        aliases: ['par', 'paris', 'paris france', 'paris, france'],
        name: 'Paris, France',
        shortName: 'PAR',
        lat: 48.8566,
        lng: 2.3522,
    },
    {
        aliases: ['tyo', 'tokyo', 'tokyo japan', 'tokyo, japan'],
        name: 'Tokyo, Japan',
        shortName: 'TYO',
        lat: 35.6762,
        lng: 139.6503,
    },
    {
        aliases: ['lon', 'london', 'london uk', 'london, uk', 'london england', 'london, england'],
        name: 'London',
        shortName: 'LON',
        lat: 51.5072,
        lng: -0.1276,
    },
    {
        aliases: ['ber', 'berlin', 'berlin germany', 'berlin, germany'],
        name: 'Berlin',
        shortName: 'BER',
        lat: 52.52,
        lng: 13.405,
    },
    {
        aliases: ['fra', 'frankfurt', 'frankfurt germany', 'frankfurt, germany'],
        name: 'Frankfurt',
        shortName: 'FRA',
        lat: 50.1109,
        lng: 8.6821,
    },
    {
        aliases: ['ams', 'amsterdam', 'amsterdam netherlands', 'amsterdam, netherlands'],
        name: 'Amsterdam',
        shortName: 'AMS',
        lat: 52.3676,
        lng: 4.9041,
    },
    {
        aliases: ['dub', 'dublin', 'dublin ireland', 'dublin, ireland'],
        name: 'Dublin',
        shortName: 'DUB',
        lat: 53.3498,
        lng: -6.2603,
    },
    {
        aliases: ['mad', 'madrid', 'madrid spain', 'madrid, spain'],
        name: 'Madrid',
        shortName: 'MAD',
        lat: 40.4168,
        lng: -3.7038,
    },
    {
        aliases: ['bcn', 'barcelona', 'barcelona spain', 'barcelona, spain'],
        name: 'Barcelona',
        shortName: 'BCN',
        lat: 41.3874,
        lng: 2.1686,
    },
    {
        aliases: ['rom', 'rome', 'rome italy', 'rome, italy'],
        name: 'Rome',
        shortName: 'ROM',
        lat: 41.9028,
        lng: 12.4964,
    },
    {
        aliases: ['mil', 'milan', 'milan italy', 'milan, italy'],
        name: 'Milan',
        shortName: 'MIL',
        lat: 45.4642,
        lng: 9.19,
    },
    {
        aliases: ['zur', 'zurich', 'zurich switzerland', 'zurich, switzerland'],
        name: 'Zurich',
        shortName: 'ZUR',
        lat: 47.3769,
        lng: 8.5417,
    },
    {
        aliases: ['gva', 'geneva', 'geneva switzerland', 'geneva, switzerland'],
        name: 'Geneva',
        shortName: 'GVA',
        lat: 46.2044,
        lng: 6.1432,
    },
    {
        aliases: ['sto', 'stockholm', 'stockholm sweden', 'stockholm, sweden'],
        name: 'Stockholm',
        shortName: 'STO',
        lat: 59.3293,
        lng: 18.0686,
    },
    {
        aliases: ['cph', 'copenhagen', 'copenhagen denmark', 'copenhagen, denmark'],
        name: 'Copenhagen',
        shortName: 'CPH',
        lat: 55.6761,
        lng: 12.5683,
    },
    {
        aliases: ['osl', 'oslo', 'oslo norway', 'oslo, norway'],
        name: 'Oslo',
        shortName: 'OSL',
        lat: 59.9139,
        lng: 10.7522,
    },
    {
        aliases: ['hel', 'helsinki', 'helsinki finland', 'helsinki, finland'],
        name: 'Helsinki',
        shortName: 'HEL',
        lat: 60.1699,
        lng: 24.9384,
    },
    {
        aliases: ['vienna', 'vienna austria', 'vienna, austria'],
        name: 'Vienna',
        shortName: 'VIE',
        lat: 48.2082,
        lng: 16.3738,
    },
    {
        aliases: ['prg', 'prague', 'prague czechia', 'prague, czechia', 'prague czech republic'],
        name: 'Prague',
        shortName: 'PRG',
        lat: 50.0755,
        lng: 14.4378,
    },
    {
        aliases: ['waw', 'warsaw', 'warsaw poland', 'warsaw, poland'],
        name: 'Warsaw',
        shortName: 'WAW',
        lat: 52.2297,
        lng: 21.0122,
    },
    {
        aliases: ['lis', 'lisbon', 'lisbon portugal', 'lisbon, portugal'],
        name: 'Lisbon',
        shortName: 'LIS',
        lat: 38.7223,
        lng: -9.1393,
    },
    {
        aliases: ['ath', 'athens', 'athens greece', 'athens, greece'],
        name: 'Athens',
        shortName: 'ATH',
        lat: 37.9838,
        lng: 23.7275,
    },
    {
        aliases: ['ist', 'istanbul', 'istanbul turkey', 'istanbul, turkey'],
        name: 'Istanbul',
        shortName: 'IST',
        lat: 41.0082,
        lng: 28.9784,
    },
    {
        aliases: ['dxb', 'dubai', 'dubai uae', 'dubai, uae', 'dubai united arab emirates'],
        name: 'Dubai',
        shortName: 'DXB',
        lat: 25.2048,
        lng: 55.2708,
    },
    {
        aliases: ['auh', 'abu dhabi', 'abu dhabi uae', 'abu dhabi, uae'],
        name: 'Abu Dhabi',
        shortName: 'AUH',
        lat: 24.4539,
        lng: 54.3773,
    },
    {
        aliases: ['riyadh', 'riyadh saudi arabia', 'riyadh, saudi arabia'],
        name: 'Riyadh',
        shortName: 'RUH',
        lat: 24.7136,
        lng: 46.6753,
    },
    {
        aliases: ['tel aviv', 'tel aviv israel', 'tel aviv, israel'],
        name: 'Tel Aviv',
        shortName: 'TLV',
        lat: 32.0853,
        lng: 34.7818,
    },
    {
        aliases: ['cairo', 'cairo egypt', 'cairo, egypt'],
        name: 'Cairo',
        shortName: 'CAI',
        lat: 30.0444,
        lng: 31.2357,
    },
    {
        aliases: ['jnb', 'johannesburg', 'johannesburg south africa', 'johannesburg, south africa'],
        name: 'Johannesburg',
        shortName: 'JNB',
        lat: -26.2041,
        lng: 28.0473,
    },
    {
        aliases: ['cpt', 'cape town', 'cape town south africa', 'cape town, south africa'],
        name: 'Cape Town',
        shortName: 'CPT',
        lat: -33.9249,
        lng: 18.4241,
    },
    {
        aliases: ['nairobi', 'nairobi kenya', 'nairobi, kenya'],
        name: 'Nairobi',
        shortName: 'NBO',
        lat: -1.2921,
        lng: 36.8219,
    },
    {
        aliases: ['lagos', 'lagos nigeria', 'lagos, nigeria'],
        name: 'Lagos',
        shortName: 'LOS',
        lat: 6.5244,
        lng: 3.3792,
    },
    {
        aliases: ['mum', 'mumbai', 'mumbai india', 'mumbai, india'],
        name: 'Mumbai',
        shortName: 'BOM',
        lat: 19.076,
        lng: 72.8777,
    },
    {
        aliases: ['delhi', 'new delhi', 'new delhi india', 'new delhi, india'],
        name: 'New Delhi',
        shortName: 'DEL',
        lat: 28.6139,
        lng: 77.209,
    },
    {
        aliases: ['blr', 'bangalore', 'bengaluru', 'bengaluru india', 'bengaluru, india'],
        name: 'Bengaluru',
        shortName: 'BLR',
        lat: 12.9716,
        lng: 77.5946,
    },
    {
        aliases: ['sin', 'singapore', 'singapore singapore'],
        name: 'Singapore',
        shortName: 'SIN',
        lat: 1.3521,
        lng: 103.8198,
    },
    {
        aliases: ['hkg', 'hong kong', 'hong kong china', 'hong kong, china'],
        name: 'Hong Kong',
        shortName: 'HKG',
        lat: 22.3193,
        lng: 114.1694,
    },
    {
        aliases: ['sha', 'shanghai', 'shanghai china', 'shanghai, china'],
        name: 'Shanghai',
        shortName: 'SHA',
        lat: 31.2304,
        lng: 121.4737,
    },
    {
        aliases: ['pek', 'beijing', 'beijing china', 'beijing, china'],
        name: 'Beijing',
        shortName: 'PEK',
        lat: 39.9042,
        lng: 116.4074,
    },
    {
        aliases: ['seoul', 'seoul korea', 'seoul south korea', 'seoul, south korea'],
        name: 'Seoul',
        shortName: 'SEL',
        lat: 37.5665,
        lng: 126.978,
    },
    {
        aliases: ['osa', 'osaka', 'osaka japan', 'osaka, japan'],
        name: 'Osaka',
        shortName: 'OSA',
        lat: 34.6937,
        lng: 135.5023,
    },
    {
        aliases: ['taipei', 'taipei taiwan', 'taipei, taiwan'],
        name: 'Taipei',
        shortName: 'TPE',
        lat: 25.033,
        lng: 121.5654,
    },
    {
        aliases: ['bangkok', 'bangkok thailand', 'bangkok, thailand'],
        name: 'Bangkok',
        shortName: 'BKK',
        lat: 13.7563,
        lng: 100.5018,
    },
    {
        aliases: ['kuala lumpur', 'kuala lumpur malaysia', 'kuala lumpur, malaysia'],
        name: 'Kuala Lumpur',
        shortName: 'KUL',
        lat: 3.139,
        lng: 101.6869,
    },
    {
        aliases: ['jakarta', 'jakarta indonesia', 'jakarta, indonesia'],
        name: 'Jakarta',
        shortName: 'JKT',
        lat: -6.2088,
        lng: 106.8456,
    },
    {
        aliases: ['manila', 'manila philippines', 'manila, philippines'],
        name: 'Manila',
        shortName: 'MNL',
        lat: 14.5995,
        lng: 120.9842,
    },
    {
        aliases: ['syd', 'sydney', 'sydney australia', 'sydney, australia'],
        name: 'Sydney',
        shortName: 'SYD',
        lat: -33.8688,
        lng: 151.2093,
    },
    {
        aliases: ['mel', 'melbourne', 'melbourne australia', 'melbourne, australia'],
        name: 'Melbourne',
        shortName: 'MEL',
        lat: -37.8136,
        lng: 144.9631,
    },
    {
        aliases: ['akl', 'auckland', 'auckland new zealand', 'auckland, new zealand'],
        name: 'Auckland',
        shortName: 'AKL',
        lat: -36.8485,
        lng: 174.7633,
    },
    {
        aliases: ['tor', 'toronto', 'toronto canada', 'toronto, canada'],
        name: 'Toronto',
        shortName: 'TOR',
        lat: 43.6532,
        lng: -79.3832,
    },
    {
        aliases: ['yvr', 'vancouver', 'vancouver canada', 'vancouver, canada'],
        name: 'Vancouver',
        shortName: 'YVR',
        lat: 49.2827,
        lng: -123.1207,
    },
    {
        aliases: ['yul', 'montreal', 'montreal canada', 'montreal, canada'],
        name: 'Montreal',
        shortName: 'YUL',
        lat: 45.5019,
        lng: -73.5674,
    },
    {
        aliases: ['mex', 'mexico city', 'mexico city mexico', 'mexico city, mexico'],
        name: 'Mexico City',
        shortName: 'MEX',
        lat: 19.4326,
        lng: -99.1332,
    },
    {
        aliases: ['sao paulo', 'sao paulo brazil', 'sao paulo, brazil', 'são paulo'],
        name: 'Sao Paulo',
        shortName: 'SAO',
        lat: -23.5558,
        lng: -46.6396,
    },
    {
        aliases: ['rio', 'rio de janeiro', 'rio de janeiro brazil', 'rio de janeiro, brazil'],
        name: 'Rio de Janeiro',
        shortName: 'RIO',
        lat: -22.9068,
        lng: -43.1729,
    },
    {
        aliases: ['buenos aires', 'buenos aires argentina', 'buenos aires, argentina'],
        name: 'Buenos Aires',
        shortName: 'BUE',
        lat: -34.6037,
        lng: -58.3816,
    },
    {
        aliases: ['scl', 'santiago', 'santiago chile', 'santiago, chile'],
        name: 'Santiago',
        shortName: 'SCL',
        lat: -33.4489,
        lng: -70.6693,
    },
    {
        aliases: ['bogota', 'bogota colombia', 'bogota, colombia'],
        name: 'Bogota',
        shortName: 'BOG',
        lat: 4.711,
        lng: -74.0721,
    },
    {
        aliases: ['lima', 'lima peru', 'lima, peru'],
        name: 'Lima',
        shortName: 'LIM',
        lat: -12.0464,
        lng: -77.0428,
    },
];

type PersistedTopologyPayload = {
    version: number;
    topology: CustomerTopology;
    sectionTitles: CustomerTopologySectionTitles;
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
 * stanza. Keyed by the building's short name (e.g. "NYC", "CHI")
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

interface ThousandEyesA2ACandidate {
    candidateId: string;
    teAccountId?: string;
    teTestId?: string;
    teTestName?: string;
    sourceAgent?: string;
    targetAgent?: string;
    sourceAgents?: string;
    targetAgents?: string;
    sourceLocation?: string;
    targetLocation?: string;
    sourceCountry?: string;
    targetCountry?: string;
    sourceRegion?: string;
    targetRegion?: string;
    status: TopologyStatus;
    capacityMbps?: number;
    throughputMbps?: number;
    peakThroughputMbps?: number;
    utilizationPct?: number;
    peakUtilizationPct?: number;
    latencyMs?: number;
    lossPct?: number;
    jitterMs?: number;
    endpointHealthPct?: number;
    txMbps?: number;
    rxMbps?: number;
    endpointDevices?: number;
    teLink?: string;
    lastUpdated?: string;
    telemetrySource: string;
}

interface ThousandEyesA2AMatch {
    candidate: ThousandEyesA2ACandidate;
    confidence: number;
    reason: string;
    exact: boolean;
    ambiguous?: boolean;
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

const isTopologyStatus = (value: unknown): value is TopologyStatus =>
    TOPOLOGY_STATUSES.includes(value as TopologyStatus);

const optionalText = (value: unknown): string | undefined => {
    const text = textValue(value);
    return text.length > 0 ? text : undefined;
};

const hasOwnProperty = (value: object, key: PropertyKey): boolean =>
    Object.prototype.hasOwnProperty.call(value, key);

const normalizeSearchBinding = (
    source: object,
    fallbackSearchName?: string
): string | undefined => {
    if (hasOwnProperty(source, 'searchName')) {
        return textValue((source as { [key: string]: unknown }).searchName);
    }
    return optionalText(fallbackSearchName);
};

const optionalTextArray = (value: unknown): string[] => {
    const rawItems = Array.isArray(value)
        ? value
        : typeof value === 'string'
        ? value.split(',')
        : [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of rawItems) {
        const text = optionalText(raw);
        if (!text) continue;
        const key = text.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(text.slice(0, 80));
    }
    return out;
};

const TE_A2A_BINDING_KEYS: Array<keyof ThousandEyesA2ABinding> = [
    'candidateId',
    'teAccountId',
    'teTestId',
    'teTestName',
    'sourceAgent',
    'targetAgent',
    'sourceLocation',
    'targetLocation',
];

const sanitizeThousandEyesA2ABinding = (
    value: unknown,
    fallback?: ThousandEyesA2ABinding
): ThousandEyesA2ABinding | undefined => {
    const source = isRecord(value) ? value : {};
    const normalized: ThousandEyesA2ABinding = {};
    for (const key of TE_A2A_BINDING_KEYS) {
        const text = optionalText(source[key]) ?? optionalText(fallback?.[key]);
        if (text) normalized[key] = text.slice(0, 256);
    }
    return Object.keys(normalized).length > 0 ? normalized : undefined;
};

const normalizeA2AMatchText = (value: unknown): string =>
    textValue(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const compactA2AMatchText = (value: unknown): string =>
    normalizeA2AMatchText(value).replace(/[^a-z0-9]+/g, '');

const escapeMatchRegex = (value: string): string =>
    value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const containsMatchPhrase = (haystack: string, needle: string): boolean => {
    if (!haystack || !needle) return false;
    return new RegExp(`(^|\\s)${escapeMatchRegex(needle)}($|\\s)`).test(
        haystack
    );
};

interface TeSiteAlias {
    label: string;
    phrase: string;
    compact: string;
    strong: boolean;
}

const topologySiteAliasesForTeMatch = (site: TopologySite): TeSiteAlias[] => {
    const aliases: TeSiteAlias[] = [];
    const seen = new Set<string>();
    const add = (raw: unknown, strong = false) => {
        const label = optionalText(raw);
        if (!label) return;
        const phrase = normalizeA2AMatchText(label);
        const compact = compactA2AMatchText(label);
        if (!phrase || !compact || seen.has(compact)) return;
        seen.add(compact);
        aliases.push({ label, phrase, compact, strong });
    };

    add(site.shortName, true);
    add(site.id, true);
    add(site.name, true);
    for (const alias of site.aliases ?? []) add(alias, true);

    for (const raw of [site.name, ...(site.aliases ?? [])]) {
        for (const token of normalizeA2AMatchText(raw).split(' ')) {
            if (token.length < 3 || TE_A2A_STOP_WORDS.has(token)) continue;
            add(token, false);
        }
    }
    return aliases;
};

const teCandidateSideText = (
    candidate: ThousandEyesA2ACandidate,
    side: 'source' | 'target'
): string => {
    const fields =
        side === 'source'
            ? [
                  candidate.sourceAgent,
                  candidate.sourceAgents,
                  candidate.sourceLocation,
                  candidate.sourceCountry,
                  candidate.sourceRegion,
              ]
            : [
                  candidate.targetAgent,
                  candidate.targetAgents,
                  candidate.targetLocation,
                  candidate.targetCountry,
                  candidate.targetRegion,
              ];
    return fields.filter(Boolean).join(' ');
};

const scoreSiteAgainstTeSide = (
    site: TopologySite,
    candidate: ThousandEyesA2ACandidate,
    side: 'source' | 'target'
): { score: number; label?: string } => {
    const sideText = normalizeA2AMatchText(teCandidateSideText(candidate, side));
    const sideCompact = compactA2AMatchText(sideText);
    const sharedText = normalizeA2AMatchText(candidate.teTestName);
    const sharedCompact = compactA2AMatchText(candidate.teTestName);
    let bestScore = 0;
    let bestLabel: string | undefined;

    for (const alias of topologySiteAliasesForTeMatch(site)) {
        let score = 0;
        if (containsMatchPhrase(sideText, alias.phrase)) {
            score = alias.strong ? 52 : 44;
        } else if (
            alias.compact.length >= 3 &&
            sideCompact.includes(alias.compact)
        ) {
            score = alias.strong ? 46 : 36;
        } else {
            const tokens = alias.phrase
                .split(' ')
                .filter(
                    (token) =>
                        token.length >= 3 && !TE_A2A_STOP_WORDS.has(token)
                );
            if (
                tokens.length >= 2 &&
                tokens.every((token) => sideText.includes(token))
            ) {
                score = 32;
            }
        }

        if (
            containsMatchPhrase(sharedText, alias.phrase) ||
            (alias.compact.length >= 3 && sharedCompact.includes(alias.compact))
        ) {
            score = Math.max(score, alias.strong ? 20 : 16);
        }

        if (score > bestScore) {
            bestScore = score;
            bestLabel = alias.label;
        }
    }

    return { score: Math.min(bestScore, 60), label: bestLabel };
};

const sameTeText = (left: unknown, right: unknown): boolean => {
    const a = optionalText(left)?.toLowerCase();
    const b = optionalText(right)?.toLowerCase();
    return Boolean(a && b && a === b);
};

const teBindingMatchesCandidate = (
    binding: ThousandEyesA2ABinding | undefined,
    candidate: ThousandEyesA2ACandidate
): boolean => {
    if (!binding) return false;
    if (sameTeText(binding.candidateId, candidate.candidateId)) return true;
    if (
        sameTeText(binding.teAccountId, candidate.teAccountId) &&
        sameTeText(binding.teTestId, candidate.teTestId)
    ) {
        if (!binding.sourceAgent || !binding.targetAgent) return true;
        const forward =
            sameTeText(binding.sourceAgent, candidate.sourceAgent) &&
            sameTeText(binding.targetAgent, candidate.targetAgent);
        const reverse =
            sameTeText(binding.sourceAgent, candidate.targetAgent) &&
            sameTeText(binding.targetAgent, candidate.sourceAgent);
        return forward || reverse;
    }
    if (!sameTeText(binding.teTestId, candidate.teTestId)) return false;
    const forward =
        sameTeText(binding.sourceAgent, candidate.sourceAgent) &&
        sameTeText(binding.targetAgent, candidate.targetAgent);
    const reverse =
        sameTeText(binding.sourceAgent, candidate.targetAgent) &&
        sameTeText(binding.targetAgent, candidate.sourceAgent);
    return forward || reverse;
};

const scoreTeCandidateForLink = (
    link: TopologyLink,
    sourceSite: TopologySite | undefined,
    targetSite: TopologySite | undefined,
    candidate: ThousandEyesA2ACandidate
): ThousandEyesA2AMatch => {
    if (teBindingMatchesCandidate(link.thousandEyesA2A, candidate)) {
        return {
            candidate,
            confidence: 100,
            reason: 'Saved TE test binding',
            exact: true,
        };
    }

    if (!sourceSite || !targetSite) {
        return {
            candidate,
            confidence: 0,
            reason: 'Missing link endpoint',
            exact: false,
        };
    }

    const forwardSource = scoreSiteAgainstTeSide(sourceSite, candidate, 'source');
    const forwardTarget = scoreSiteAgainstTeSide(targetSite, candidate, 'target');
    const reverseSource = scoreSiteAgainstTeSide(sourceSite, candidate, 'target');
    const reverseTarget = scoreSiteAgainstTeSide(targetSite, candidate, 'source');
    const forward = forwardSource.score + forwardTarget.score;
    const reverse = reverseSource.score + reverseTarget.score;
    const useReverse = reverse > forward;
    const confidence = Math.min(99, Math.max(forward, reverse));
    const sourceLabel = useReverse ? reverseSource.label : forwardSource.label;
    const targetLabel = useReverse ? reverseTarget.label : forwardTarget.label;
    const direction = useReverse ? 'reverse' : 'forward';
    const reason =
        sourceLabel && targetLabel
            ? `${direction} match: ${sourceLabel} / ${targetLabel}`
            : 'Weak name/location match';

    return {
        candidate,
        confidence,
        reason,
        exact: false,
    };
};

const rankTeCandidatesForLink = (
    link: TopologyLink,
    sourceSite: TopologySite | undefined,
    targetSite: TopologySite | undefined,
    candidates: ThousandEyesA2ACandidate[]
): ThousandEyesA2AMatch[] => {
    const sorted = candidates
        .map((candidate) =>
            scoreTeCandidateForLink(link, sourceSite, targetSite, candidate)
        )
        .sort((a, b) => {
            if (a.exact !== b.exact) return a.exact ? -1 : 1;
            if (a.confidence !== b.confidence) return b.confidence - a.confidence;
            return formatTeCandidateLabel(a.candidate).localeCompare(
                formatTeCandidateLabel(b.candidate),
                undefined,
                { sensitivity: 'base' }
            );
        });

    if (sorted.length < 2 || sorted[0].exact) return sorted;
    const [best, second] = sorted;
    if (
        best.confidence >= TE_A2A_MATCH_THRESHOLD &&
        second.confidence >= best.confidence - TE_A2A_CLOSE_MATCH_DELTA
    ) {
        return [{ ...best, ambiguous: true }, ...sorted.slice(1)];
    }
    return sorted;
};

const selectAutoTeMatch = (
    link: TopologyLink,
    sourceSite: TopologySite | undefined,
    targetSite: TopologySite | undefined,
    candidates: ThousandEyesA2ACandidate[]
): ThousandEyesA2AMatch | null => {
    const [best] = rankTeCandidatesForLink(
        link,
        sourceSite,
        targetSite,
        candidates
    );
    if (!best) return null;
    if (best.exact) return best;
    if (best.ambiguous || best.confidence < TE_A2A_MATCH_THRESHOLD) return null;
    return best;
};

const buildThousandEyesPathLink = (
    teAccountId?: string,
    teTestId?: string
): string | undefined => {
    if (!teTestId) return undefined;
    const params = [
        `testId=${encodeURIComponent(teTestId)}`,
        'direction=BIDIRECTIONAL',
        'detailId=pathvis',
        'metrics=oneWayNetLoss',
    ];
    if (teAccountId) params.push(`__a=${encodeURIComponent(teAccountId)}`);
    return `https://app.thousandeyes.com/network-app-synthetics/views/?${params.join(
        '&'
    )}`;
};

const teBindingFromCandidate = (
    candidate: ThousandEyesA2ACandidate
): ThousandEyesA2ABinding => ({
    candidateId: candidate.candidateId,
    teAccountId: candidate.teAccountId,
    teTestId: candidate.teTestId,
    teTestName: candidate.teTestName,
    sourceAgent: candidate.sourceAgent,
    targetAgent: candidate.targetAgent,
    sourceLocation: candidate.sourceLocation,
    targetLocation: candidate.targetLocation,
});

const formatTeCandidateLabel = (candidate: ThousandEyesA2ACandidate): string => {
    const source =
        candidate.sourceAgent ?? candidate.sourceLocation ?? 'Source agent';
    const target =
        candidate.targetAgent ?? candidate.targetLocation ?? 'Target agent';
    const testName = candidate.teTestName ? ` (${candidate.teTestName})` : '';
    return `${source} -> ${target}${testName}`;
};

const formatTeBindingSummary = (
    binding?: ThousandEyesA2ABinding,
    candidate?: ThousandEyesA2ACandidate
): string => {
    if (candidate) return formatTeCandidateLabel(candidate);
    if (!binding) return 'No ThousandEyes A2A binding';
    const source = binding.sourceAgent ?? binding.sourceLocation ?? 'source';
    const target = binding.targetAgent ?? binding.targetLocation ?? 'target';
    const test = binding.teTestName ? ` (${binding.teTestName})` : '';
    return `${source} -> ${target}${test}`;
};

const sanitizeTopology = (
    candidate: unknown,
    fallback: CustomerTopology
): CustomerTopology => {
    const source = isRecord(candidate) ? (candidate as EditableTopology) : fallback;
    const fallbackMap = fallback.map;
    const fallbackSitesById = new Map(
        fallback.sites.map((site) => [site.id, site])
    );
    const fallbackLinksById = new Map(
        fallback.links.map((link) => [link.id, link])
    );
    const rawSites = Array.isArray(source.sites) && source.sites.length > 0
        ? source.sites
        : fallback.sites;
    const usedSiteIds = new Set<string>();
    const sites = rawSites.map((site, index) => {
        const id = uniqueId(
            normalizeId(site.id ?? site.shortName ?? site.name, `site-${index + 1}`),
            usedSiteIds
        );
        const fallbackSite =
            fallbackSitesById.get(id) ?? fallback.sites[index] ?? fallback.sites[0];
        const shortName = textValue(
            site.shortName,
            id.replace(/-/g, '').slice(0, 4).toUpperCase()
        ).slice(0, 8);
        const resolvedSiteSearchName = normalizeSearchBinding(
            site,
            fallbackSitesById.get(id)?.searchName
        );
        const aliases = optionalTextArray(site.aliases);
        const fallbackAliases = optionalTextArray(fallbackSite?.aliases);
        const resolvedAliases =
            aliases.length > 0 ? aliases : fallbackAliases.length > 0 ? fallbackAliases : [];
        return {
            id,
            name: textValue(site.name, fallbackSite?.name ?? shortName),
            shortName: shortName.toUpperCase(),
            ...(resolvedAliases.length > 0 ? { aliases: resolvedAliases } : {}),
            role: normalizeTopologyRoleInput(
                site.role,
                fallbackSite?.role ?? 'branch'
            ),
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
            const searchName = normalizeSearchBinding(
                link,
                fallbackLinksById.get(id)?.searchName
            );
            const thousandEyesA2A = sanitizeThousandEyesA2ABinding(
                link.thousandEyesA2A,
                fallbackLinksById.get(id)?.thousandEyesA2A
            );
            const normalized: TopologyLink = {
                id,
                name: textValue(link.name, `${sourceSiteId} to ${targetSiteId}`),
                sourceSiteId,
                targetSiteId,
                status: isTopologyStatus(link.status)
                    ? link.status
                    : fallbackLink?.status ?? 'unknown',
                dataState:
                    searchName || thousandEyesA2A
                        ? 'loading'
                        : link.dataState ?? 'static',
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
            if (searchName) normalized.searchName = searchName;
            if (searchName === '') normalized.searchName = '';
            if (thousandEyesA2A) normalized.thousandEyesA2A = thousandEyesA2A;
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

interface SitePlacement {
    name: string;
    shortName: string;
    lat: number;
    lng: number;
}

const normalizePlacementQuery = (value: string): string =>
    value
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/\./g, '')
        .replace(/\s*,\s*/g, ',')
        .replace(/[^a-z0-9,-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\s*,\s*/g, ',')
        .replace(/,+/g, ',')
        .replace(/^,|,$/g, '')
        .trim();

const compactPlacementQuery = (value: string): string =>
    normalizePlacementQuery(value).replace(/[^a-z0-9]+/g, '');

const getPlacementAliases = (
    placement: (typeof SITE_PLACEMENT_PRESETS)[number]
): string[] => [placement.name, placement.shortName, ...placement.aliases];

const placementPhrase = (value: string): string =>
    normalizePlacementQuery(value).replace(/,/g, ' ');

const escapeRegex = (value: string): string =>
    value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const includesPlacementPhrase = (query: string, alias: string): boolean =>
    new RegExp(`(^|\\s)${escapeRegex(alias)}($|\\s)`).test(query);

const buildPlacementLookupQueries = (value: string): string[] => {
    const trimmed = value.trim();
    if (!trimmed) return [];

    const queries: string[] = [];
    const add = (candidate: string) => {
        const normalized = candidate.replace(/\s+/g, ' ').trim();
        if (normalized && !queries.includes(normalized)) queries.push(normalized);
    };

    add(trimmed);

    const commaParts = trimmed
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);
    if (commaParts.length > 1) {
        add(commaParts.slice(-2).join(', '));
        add(commaParts[0]);
    }

    const words = trimmed
        .replace(/[^a-zA-Z0-9\s,-]+/g, ' ')
        .split(/\s+/)
        .map((word) => word.trim())
        .filter(Boolean);
    for (let count = Math.min(4, words.length); count >= 1; count -= 1) {
        add(words.slice(-count).join(' '));
    }

    return queries;
};

const placementShortName = (name: string): string => {
    const words = normalizePlacementQuery(name)
        .replace(/,/g, ' ')
        .split(/\s+/)
        .filter((word) => word && !/^\d+$/.test(word));
    if (words.length === 0) return 'SITE';
    if (words.length === 1) return words[0].slice(0, 4).toUpperCase();
    return words
        .slice(0, 4)
        .map((word) => word[0])
        .join('')
        .toUpperCase();
};

const sitePlacementFromPreset = (
    preset: (typeof SITE_PLACEMENT_PRESETS)[number]
): SitePlacement => ({
    name: preset.name,
    shortName: preset.shortName,
    lat: preset.lat,
    lng: preset.lng,
});

const resolveSitePlacement = (value: string): SitePlacement | null => {
    const rawQuery = value.trim();
    const query = normalizePlacementQuery(rawQuery);
    if (!query) return null;
    const coordinateMatch = rawQuery.match(
        /^(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)$/
    );
    if (coordinateMatch) {
        const lat = Number(coordinateMatch[1]);
        const lng = Number(coordinateMatch[2]);
        if (
            Number.isFinite(lat) &&
            Number.isFinite(lng) &&
            lat >= -85 &&
            lat <= 85 &&
            lng >= -180 &&
            lng <= 180
        ) {
            return {
                name: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
                shortName: 'SITE',
                lat,
                lng,
            };
        }
    }

    const queryCompact = compactPlacementQuery(query);
    const queryPhrase = placementPhrase(query);
    let bestPreset: {
        preset: (typeof SITE_PLACEMENT_PRESETS)[number];
        score: number;
    } | null = null;

    for (const candidate of SITE_PLACEMENT_PRESETS) {
        const aliases = getPlacementAliases(candidate);
        for (const alias of aliases) {
            const normalizedAlias = normalizePlacementQuery(alias);
            if (
                normalizedAlias === query ||
                normalizedAlias.replace(/,/g, ' ') === query.replace(/,/g, ' ') ||
                compactPlacementQuery(normalizedAlias) === queryCompact
            ) {
                return sitePlacementFromPreset(candidate);
            }

            const aliasPhrase = placementPhrase(normalizedAlias);
            if (
                aliasPhrase.length >= 4 &&
                includesPlacementPhrase(queryPhrase, aliasPhrase)
            ) {
                const score = aliasPhrase.length;
                if (!bestPreset || score > bestPreset.score) {
                    bestPreset = { preset: candidate, score };
                }
            }
        }
    }

    return bestPreset ? sitePlacementFromPreset(bestPreset.preset) : null;
};

const pickRemoteGeocodeText = (
    query: string,
    address: Record<string, unknown>
): string => {
    const city =
        textValue(address.city) ||
        textValue(address.town) ||
        textValue(address.village) ||
        textValue(address.hamlet) ||
        textValue(address.municipality) ||
        textValue(address.county);
    const region = textValue(address.state);
    const country = textValue(address.country);
    const suffix = region || country;
    if (city && suffix && normalizePlacementQuery(city) !== normalizePlacementQuery(suffix)) {
        return `${city}, ${suffix}`;
    }
    return city || query;
};

const resolveRemoteSitePlacement = async (
    value: string
): Promise<SitePlacement | null> => {
    if (typeof window === 'undefined' || typeof window.fetch !== 'function') {
        return null;
    }

    for (const query of buildPlacementLookupQueries(value)) {
        try {
            const response = await window.fetch(
                `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=1&q=${encodeURIComponent(
                    query
                )}`,
                {
                    headers: {
                        Accept: 'application/json',
                    },
                }
            );
            if (!response.ok) continue;
            const rows = (await response.json()) as unknown;
            const first = Array.isArray(rows) ? rows[0] : null;
            if (!isRecord(first)) continue;

            const lat = Number(first.lat);
            const lng = Number(first.lon);
            if (
                !Number.isFinite(lat) ||
                !Number.isFinite(lng) ||
                lat < -85 ||
                lat > 85 ||
                lng < -180 ||
                lng > 180
            ) {
                continue;
            }

            const address = isRecord(first.address) ? first.address : {};
            const name = pickRemoteGeocodeText(query, address);
            return {
                name,
                shortName: placementShortName(name),
                lat,
                lng,
            };
        } catch {
            // A failed geocoder request should not block manual coordinate entry.
        }
    }

    return null;
};

const resolveSitePlacementWithFallback = async (
    value: string
): Promise<SitePlacement | null> =>
    resolveSitePlacement(value) ?? resolveRemoteSitePlacement(value);

const looksLikeGeneratedSiteName = (value: string): boolean =>
    /^site\s+\d+$/i.test(value.trim());

const looksLikeGeneratedShortName = (value: string): boolean =>
    /^site[-\d]*$/i.test(value.trim()) || value.trim().length === 0;

const topologyLinkEndpointKey = (sourceSiteId: string, targetSiteId: string): string =>
    [sourceSiteId, targetSiteId].sort().join('__');

const topologySiteOptionLabel = (site: TopologySite): string =>
    `${site.shortName || site.id} · ${site.name}`;

const validTopologySites = (sites: TopologySite[]): TopologySite[] =>
    sites.filter(
        (site) =>
            Number.isFinite(site.lat) &&
            Number.isFinite(site.lng) &&
            site.lat >= -85 &&
            site.lat <= 85 &&
            site.lng >= -180 &&
            site.lng <= 180 &&
            !(site.lat === 0 && site.lng === 0)
    );

const topologySiteSpread = (
    sites: TopologySite[]
): { latSpan: number; lngSpan: number } => {
    const usable = validTopologySites(sites);
    if (usable.length < 2) return { latSpan: 0, lngSpan: 0 };
    const lats = usable.map((site) => site.lat);
    const lngs = usable.map((site) => site.lng);
    return {
        latSpan: Math.max(...lats) - Math.min(...lats),
        lngSpan: Math.max(...lngs) - Math.min(...lngs),
    };
};

const minZoomForTopologySites = (sites: TopologySite[], configuredMinZoom: number): number => {
    const { latSpan, lngSpan } = topologySiteSpread(sites);
    if (latSpan > 75 || lngSpan > 210) return Math.min(configuredMinZoom, 0);
    if (latSpan > 45 || lngSpan > 120) return Math.min(configuredMinZoom, 2);
    return configuredMinZoom;
};

const boundsForTopologySites = (
    mapBounds: CustomerTopology['map']['bounds'],
    sites: TopologySite[]
): CustomerTopology['map']['bounds'] => {
    const usable = validTopologySites(sites);
    if (usable.length === 0) return mapBounds;

    const lats = [
        ...usable.map((site) => site.lat),
        mapBounds[0][0],
        mapBounds[1][0],
    ];
    const lngs = [
        ...usable.map((site) => site.lng),
        mapBounds[0][1],
        mapBounds[1][1],
    ];
    const latPadding = Math.max(2, (Math.max(...lats) - Math.min(...lats)) * 0.08);
    const lngPadding = Math.max(3, (Math.max(...lngs) - Math.min(...lngs)) * 0.08);

    return [
        [
            Number(Math.max(-85, Math.min(...lats) - latPadding).toFixed(5)),
            Number(Math.max(-180, Math.min(...lngs) - lngPadding).toFixed(5)),
        ],
        [
            Number(Math.min(85, Math.max(...lats) + latPadding).toFixed(5)),
            Number(Math.min(180, Math.max(...lngs) + lngPadding).toFixed(5)),
        ],
    ];
};

const expandMapForPlacement = (
    map: CustomerTopology['map'],
    sites: TopologySite[],
    placement: SitePlacement
): CustomerTopology['map'] => {
    const usable = validTopologySites(sites);
    const lats = [...usable.map((site) => site.lat), placement.lat];
    const lngs = [...usable.map((site) => site.lng), placement.lng];
    const minLat = Math.max(-85, Math.min(...lats) - 1.5);
    const maxLat = Math.min(85, Math.max(...lats) + 1.5);
    const minLng = Math.max(-180, Math.min(...lngs) - 1.5);
    const maxLng = Math.min(180, Math.max(...lngs) + 1.5);
    const spread = {
        latSpan: maxLat - minLat,
        lngSpan: maxLng - minLng,
    };
    const minZoom =
        spread.latSpan > 75 || spread.lngSpan > 210
            ? Math.min(map.minZoom, 0)
            : spread.latSpan > 45 || spread.lngSpan > 120
            ? Math.min(map.minZoom, 2)
            : Math.min(map.minZoom, 3);
    const zoom =
        spread.latSpan > 75 || spread.lngSpan > 210
            ? 2
            : spread.latSpan > 45 || spread.lngSpan > 120
            ? 3
            : 8;

    return {
        ...map,
        center: [
            Number(placement.lat.toFixed(5)),
            Number(placement.lng.toFixed(5)),
        ],
        zoom: Math.min(map.maxZoom, Math.max(minZoom, zoom)),
        minZoom,
        bounds: [
            [Number(minLat.toFixed(5)), Number(minLng.toFixed(5))],
            [Number(maxLat.toFixed(5)), Number(maxLng.toFixed(5))],
        ],
    };
};

const readLegacyPersistedTopology = (
    fallback: CustomerTopology
): CustomerTopology | null => {
    if (typeof window === 'undefined') return null;
    try {
        const raw = window.localStorage.getItem(LEGACY_TOPOLOGY_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<PersistedTopologyPayload>;
        return sanitizeTopology(parsed.topology ?? parsed, fallback);
    } catch {
        return null;
    }
};

const clearLegacyPersistedTopology = (): void => {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(LEGACY_TOPOLOGY_STORAGE_KEY);
};

const emitTopologyConfigChanged = (): void => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(TOPOLOGY_CONFIG_EVENT));
};

const errorMessage = (error: unknown): string =>
    error instanceof Error ? error.message : String(error);

interface PersistedTopologyState {
    topology: CustomerTopology;
    sectionTitles: CustomerTopologySectionTitles;
    isLoading: boolean;
    error: string | null;
    saveTopology: (next: CustomerTopology) => Promise<void>;
    resetTopology: () => Promise<void>;
    saveSectionTitles: (next: CustomerTopologySectionTitles) => Promise<void>;
    reload: () => Promise<void>;
}

const buildTopologyPayload = (
    topology: CustomerTopology,
    sectionTitles: CustomerTopologySectionTitles
): PersistedTopologyPayload => ({
    version: TOPOLOGY_STORAGE_VERSION,
    topology,
    sectionTitles,
});

const sanitizeTopologyPayload = (
    payload: Partial<PersistedTopologyPayload> | null | undefined,
    fallback: CustomerTopology,
    sectionTitleFallback: CustomerTopologySectionTitles
): {
    topology: CustomerTopology;
    sectionTitles: CustomerTopologySectionTitles;
} => ({
    topology: sanitizeTopology(payload?.topology, fallback),
    sectionTitles: sanitizeCustomerTopologySectionTitles(
        payload?.sectionTitles,
        sectionTitleFallback
    ),
});

const writeSharedTopologyConfig = async (
    topology: CustomerTopology,
    sectionTitles: CustomerTopologySectionTitles
): Promise<void> => {
    await saveCustomerTopologyConfig(
        buildTopologyPayload(topology, sectionTitles)
    );
};

/**
 * Public-facing helper for the "Reset all customisations" flow on
 * the Overview page. As of the shared `customer_topology.conf`
 * migration, the canonical topology is global app state, so this
 * helper only removes the retired per-browser localStorage payload.
 * The Topology Editor's Factory button is the explicit global reset.
 */
export const clearCustomerTopologyStorage = (): void => {
    clearLegacyPersistedTopology();
};

export const usePersistedTopology = (
    fallback: CustomerTopology,
    sectionTitleFallback: CustomerTopologySectionTitles =
        DEFAULT_CUSTOMER_TOPOLOGY_SECTION_TITLES
): PersistedTopologyState => {
    const defaultSectionTitles = useMemo(
        () => sanitizeCustomerTopologySectionTitles(sectionTitleFallback),
        [sectionTitleFallback]
    );
    const [topology, setTopology] = useState<CustomerTopology>(() =>
        cloneTopology(fallback)
    );
    const [sectionTitles, setSectionTitles] =
        useState<CustomerTopologySectionTitles>(() => defaultSectionTitles);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const applyPayload = useCallback(
        (payload: Partial<PersistedTopologyPayload> | null | undefined) => {
            const sanitized = sanitizeTopologyPayload(
                payload,
                fallback,
                defaultSectionTitles
            );
            setTopology(sanitized.topology);
            setSectionTitles(sanitized.sectionTitles);
        },
        [defaultSectionTitles, fallback]
    );

    const reload = useCallback(async () => {
        setIsLoading(true);
        try {
            const payload = await loadCustomerTopologyConfig();
            if (payload) {
                applyPayload(payload);
            } else {
                const legacyTopology = readLegacyPersistedTopology(fallback);
                applyPayload(
                    legacyTopology
                        ? {
                              version: TOPOLOGY_STORAGE_VERSION,
                              topology: legacyTopology,
                              sectionTitles: defaultSectionTitles,
                          }
                        : {
                              version: TOPOLOGY_STORAGE_VERSION,
                              topology: fallback,
                              sectionTitles: defaultSectionTitles,
                          }
                );
            }
            setError(null);
        } catch (err) {
            const legacyTopology = readLegacyPersistedTopology(fallback);
            applyPayload(
                legacyTopology
                    ? {
                          version: TOPOLOGY_STORAGE_VERSION,
                          topology: legacyTopology,
                          sectionTitles: defaultSectionTitles,
                      }
                    : {
                          version: TOPOLOGY_STORAGE_VERSION,
                          topology: fallback,
                          sectionTitles: defaultSectionTitles,
                      }
            );
            setError(errorMessage(err));
        } finally {
            setIsLoading(false);
        }
    }, [applyPayload, defaultSectionTitles, fallback]);

    useEffect(() => {
        void reload();
    }, [reload]);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const onConfigChanged = () => {
            void reload();
        };
        window.addEventListener(TOPOLOGY_CONFIG_EVENT, onConfigChanged);
        return () =>
            window.removeEventListener(TOPOLOGY_CONFIG_EVENT, onConfigChanged);
    }, [reload]);

    const saveTopology = useCallback(
        async (next: CustomerTopology) => {
            const sanitized = sanitizeTopology(next, fallback);
            const previousTopology = topology;
            setTopology(sanitized);
            setError(null);
            try {
                await writeSharedTopologyConfig(sanitized, sectionTitles);
                clearLegacyPersistedTopology();
                emitTopologyConfigChanged();
            } catch (err) {
                setTopology(previousTopology);
                setError(errorMessage(err));
                throw err;
            }
        },
        [fallback, sectionTitles, topology]
    );

    const resetTopology = useCallback(async () => {
        const factory = cloneTopology(fallback);
        const previousTopology = topology;
        setTopology(factory);
        setError(null);
        try {
            await writeSharedTopologyConfig(factory, sectionTitles);
            clearLegacyPersistedTopology();
            emitTopologyConfigChanged();
        } catch (err) {
            setTopology(previousTopology);
            setError(errorMessage(err));
            throw err;
        }
    }, [fallback, sectionTitles, topology]);

    const saveSectionTitles = useCallback(
        async (next: CustomerTopologySectionTitles) => {
            const sanitized = sanitizeCustomerTopologySectionTitles(
                next,
                defaultSectionTitles
            );
            const previousSectionTitles = sectionTitles;
            setSectionTitles(sanitized);
            setError(null);
            try {
                await writeSharedTopologyConfig(topology, sanitized);
                emitTopologyConfigChanged();
            } catch (err) {
                setSectionTitles(previousSectionTitles);
                setError(errorMessage(err));
                throw err;
            }
        },
        [defaultSectionTitles, sectionTitles, topology]
    );

    return {
        topology,
        sectionTitles,
        isLoading,
        error,
        saveTopology,
        resetTopology,
        saveSectionTitles,
        reload,
    };
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

const TOPOLOGY_ANIMATION_LEVEL_KEY = 'florida-topology-animation-level.v2';
const DEFAULT_TOPOLOGY_ANIMATION_LEVEL: TopologyAnimationLevel = 'subtle';
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
    return DEFAULT_TOPOLOGY_ANIMATION_LEVEL;
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

type TopologyRoleLegendMode = 'compact' | 'expanded';

const TOPOLOGY_ROLE_LEGEND_KEY = 'florida-topology-role-legend.v1';

const readStoredRoleLegendMode = (): TopologyRoleLegendMode => {
    if (typeof window === 'undefined') return 'compact';
    try {
        const stored = window.localStorage.getItem(TOPOLOGY_ROLE_LEGEND_KEY);
        if (stored === 'compact' || stored === 'expanded') return stored;
    } catch {
        /* localStorage may be unavailable (private mode etc.) */
    }
    return 'compact';
};

const writeStoredRoleLegendMode = (mode: TopologyRoleLegendMode): void => {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(TOPOLOGY_ROLE_LEGEND_KEY, mode);
    } catch {
        /* swallow */
    }
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
    @keyframes customer-topology-site-wave {
        0% {
            transform: scale(0.62);
            opacity: 0.58;
        }
        70% {
            transform: scale(1.55);
            opacity: 0;
        }
        100% {
            transform: scale(1.55);
            opacity: 0;
        }
    }
    @keyframes customer-topology-site-orbit {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    @keyframes customer-topology-site-core {
        0%, 100% {
            filter: drop-shadow(0 0 5px var(--site-health-soft));
        }
        50% {
            filter: drop-shadow(0 0 12px var(--site-health));
        }
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
        pointer-events: stroke;
    }
    .customer-topology-link-shadow {
        filter: blur(2px);
        mix-blend-mode: multiply;
        pointer-events: none;
    }
    .customer-topology-link-halo {
        filter: drop-shadow(0 0 8px currentColor);
        pointer-events: none;
    }
    .customer-topology-link-highlight {
        filter: drop-shadow(0 1px 2px rgba(15, 23, 42, 0.18));
        pointer-events: none;
    }
    .customer-topology-link-core {
        filter:
            drop-shadow(0 0 4px currentColor)
            drop-shadow(0 0 12px currentColor);
    }
    .customer-topology-link--critical { color: #ef4444; }
    .customer-topology-link--warning  { color: #f59e0b; }
    .customer-topology-link--stable   { color: #22c55e; }
    .customer-topology-link--unknown  { color: #94a3b8; }
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
    .customer-topology-site-beacon {
        --site-wave-speed: 3.2s;
        position: relative;
        display: flex;
        width: 50px;
        height: 50px;
        align-items: center;
        justify-content: center;
        border-radius: 9999px;
        isolation: isolate;
    }
    .customer-topology-site-wave {
        position: absolute;
        inset: 5px;
        border-radius: 9999px;
        border: 1.5px solid var(--site-health);
        background:
            radial-gradient(circle, var(--site-health-soft) 0%, transparent 62%);
        box-shadow:
            0 0 0 1px rgba(255, 255, 255, 0.42) inset,
            0 0 20px var(--site-health-soft);
        animation:
            customer-topology-site-wave
            var(--site-wave-speed)
            cubic-bezier(0.22, 0.85, 0.3, 1)
            infinite;
        transform-origin: center;
        z-index: 0;
    }
    .customer-topology-site-beacon--dark .customer-topology-site-wave {
        inset: 7px;
        border-width: 1.25px;
        border-color: var(--site-accent);
        background:
            radial-gradient(circle, var(--site-accent-soft) 0%, transparent 54%);
        box-shadow:
            0 0 0 1px rgba(248, 250, 252, 0.32) inset,
            0 0 14px var(--site-accent-soft);
    }
    .customer-topology-site-beacon--light .customer-topology-site-wave {
        inset: 4px;
        border-width: 2px;
        border-color: var(--site-accent);
        background:
            radial-gradient(circle, var(--site-accent-soft) 0%, transparent 58%);
        box-shadow:
            0 0 0 1px rgba(15, 23, 42, 0.16) inset,
            0 0 24px var(--site-accent-soft);
    }
    .customer-topology-site-wave--2 {
        animation-delay: -0.95s;
    }
    .customer-topology-site-wave--3 {
        animation-delay: -1.9s;
        opacity: 0.34;
    }
    .customer-topology-site-core {
        position: relative;
        z-index: 4;
        display: flex;
        width: 38px;
        height: 38px;
        align-items: center;
        justify-content: center;
        border-radius: 9999px;
        border: 2px solid var(--site-health);
        background:
            radial-gradient(circle at 30% 24%, rgba(255, 255, 255, 0.98), var(--site-surface) 43%, rgba(255, 255, 255, 0.72) 74%),
            linear-gradient(145deg, rgba(255, 255, 255, 0.92), rgba(226, 232, 240, 0.58));
        box-shadow:
            0 10px 20px rgba(15, 23, 42, 0.24),
            0 0 0 5px var(--site-health-soft),
            0 0 26px var(--site-health-soft);
        animation:
            customer-topology-site-core
            calc(var(--site-wave-speed) * 1.25)
            ease-in-out
            infinite;
    }
    .customer-topology-site-beacon--dark .customer-topology-site-core {
        border-width: 3px;
        border-color: var(--site-accent);
        box-shadow:
            0 10px 22px rgba(2, 6, 23, 0.55),
            0 0 0 4px var(--site-accent-soft),
            0 0 18px var(--site-accent-soft),
            inset 0 0 0 1px rgba(255, 255, 255, 0.9);
    }
    .customer-topology-site-beacon--light .customer-topology-site-core {
        border-width: 3px;
        border-color: #ffffff;
        background:
            radial-gradient(circle at 28% 22%, rgba(255, 255, 255, 0.82), rgba(255, 255, 255, 0.26) 30%, transparent 48%),
            linear-gradient(145deg, var(--site-surface), var(--site-surface));
        box-shadow:
            0 12px 24px rgba(15, 23, 42, 0.34),
            0 0 0 2px rgba(15, 23, 42, 0.2),
            0 0 0 7px var(--site-accent-soft),
            0 0 28px var(--site-accent-soft);
    }
    .customer-topology-site-core::before {
        content: '';
        position: absolute;
        inset: -7px;
        border-radius: inherit;
        background:
            conic-gradient(
                from 0deg,
                transparent 0deg,
                var(--site-health) 44deg,
                transparent 82deg,
                transparent 180deg,
                var(--site-health) 224deg,
                transparent 270deg,
                transparent 360deg
            );
        opacity: 0.52;
        z-index: -1;
        animation:
            customer-topology-site-orbit
            calc(var(--site-wave-speed) * 2.6)
            linear
            infinite;
    }
    .customer-topology-site-beacon--light .customer-topology-site-core::before {
        background:
            conic-gradient(
                from 0deg,
                transparent 0deg,
                var(--site-accent) 44deg,
                transparent 82deg,
                transparent 180deg,
                var(--site-accent) 224deg,
                transparent 270deg,
                transparent 360deg
            );
        opacity: 0.72;
    }
    .customer-topology-site-beacon--dark .customer-topology-site-core::before {
        background:
            conic-gradient(
                from 0deg,
                transparent 0deg,
                var(--site-accent) 44deg,
                transparent 82deg,
                transparent 180deg,
                var(--site-accent) 224deg,
                transparent 270deg,
                transparent 360deg
            );
        opacity: 0.62;
    }
    .customer-topology-site-core::after {
        content: '';
        position: absolute;
        inset: 6px;
        border-radius: inherit;
        border: 1px solid rgba(15, 23, 42, 0.08);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.85);
    }
    .customer-topology-site-beacon--light .customer-topology-site-core::after {
        border-color: rgba(255, 255, 255, 0.24);
        box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.55),
            inset 0 -10px 18px rgba(15, 23, 42, 0.08);
    }
    .customer-topology-site-code {
        position: relative;
        z-index: 2;
        color: var(--site-text);
        font-size: 11px;
        font-weight: 950;
        letter-spacing: 0;
        text-shadow: var(--site-text-shadow);
    }
    .customer-topology-site-led {
        position: absolute;
        right: 2px;
        top: 3px;
        z-index: 7;
        width: 10px;
        height: 10px;
        border: 2px solid #ffffff;
        border-radius: 9999px;
        background: var(--site-health);
        box-shadow:
            0 0 0 2px var(--site-health-soft),
            0 0 12px var(--site-health);
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
    .customer-topology-packet--stable   { color: #22c55e; }
    .customer-topology-packet--unknown  { color: #94a3b8; }
    /* Subtle level: slow the packet glow but keep packets visible */
    .customer-topology-anim--subtle .customer-topology-packet {
        animation-duration: 2.6s;
        opacity: 0.75;
    }
    .customer-topology-anim--subtle .customer-topology-radiate,
    .customer-topology-anim--subtle .customer-topology-alert-ring,
    .customer-topology-anim--subtle .customer-topology-site-wave,
    .customer-topology-anim--subtle .customer-topology-site-core,
    .customer-topology-anim--subtle .customer-topology-site-core::before {
        animation: none !important;
    }
    /* Off level + prefers-reduced-motion: halt everything */
    .customer-topology-anim--off .customer-topology-radiate,
    .customer-topology-anim--off .customer-topology-alert-ring,
    .customer-topology-anim--off .customer-topology-marker-enter,
    .customer-topology-anim--off .customer-topology-packet,
    .customer-topology-anim--off .customer-topology-site-wave,
    .customer-topology-anim--off .customer-topology-site-core,
    .customer-topology-anim--off .customer-topology-site-core::before {
        animation: none !important;
    }
    @media (prefers-reduced-motion: reduce) {
        .customer-topology-radiate,
        .customer-topology-alert-ring,
        .customer-topology-marker-enter,
        .customer-topology-packet,
        .customer-topology-site-wave,
        .customer-topology-site-core,
        .customer-topology-site-core::before {
            animation: none !important;
        }
    }
`;

interface TileLayerPreset {
    id: 'street' | 'satellite' | 'terrain' | 'dark-ops' | 'navigation';
    label: string;
    badge: string;
    light: string;
    dark: string;
    attribution: string;
}

const TILE_LAYER_PRESETS: TileLayerPreset[] = [
    {
        id: 'street',
        label: 'Street',
        badge: 'St',
        light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        attribution:
            '&copy; OpenStreetMap contributors &copy; CARTO',
    },
    {
        id: 'satellite',
        label: 'Satellite',
        badge: 'Sat',
        light:
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        dark:
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attribution: 'Tiles &copy; Esri',
    },
    {
        id: 'terrain',
        label: 'Terrain',
        badge: 'Ter',
        light:
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
        dark:
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
        attribution: 'Tiles &copy; Esri',
    },
    {
        id: 'dark-ops',
        label: 'Dark Ops',
        badge: 'Ops',
        light:
            'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
        dark:
            'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
        attribution: 'Tiles &copy; Esri',
    },
    {
        id: 'navigation',
        label: 'Navigation',
        badge: 'Nav',
        light:
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
        dark:
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
        attribution: 'Tiles &copy; Esri',
    },
];

const DEFAULT_TILE_LAYER_PRESET_ID: TileLayerPreset['id'] = 'terrain';

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

// Build 103 (2026-05-14): the popup formatters now take an optional
// `loading` flag so the "no value yet" string can differentiate
// in-flight data from genuinely-empty values. The TE A2A saved
// search can take 20-40s on a cold cache (raw-event scan, 13+
// stats aggregations) — during that window the popup previously
// rendered identical strings to the "no integration at all" case
// (`'Awaiting'`), which Alan read as a regression on 2026-05-14.
// Using `'Loading…'` while `dataState === 'loading'` lets the
// operator see "search in flight" vs "search returned no value"
// without having to read the dataState debug field.
const formatNumber = (value?: number, loading?: boolean): string =>
    value === undefined ? (loading ? 'Loading…' : 'Awaiting') : value.toLocaleString();

const formatPercent = (value?: number, loading?: boolean): string =>
    value === undefined
        ? loading
            ? 'Loading…'
            : 'Awaiting'
        : `${value.toLocaleString()}%`;

const formatLatency = (value?: number, loading?: boolean): string =>
    value === undefined
        ? loading
            ? 'Loading…'
            : 'Awaiting'
        : `${value.toLocaleString()} ms`;

const formatMbps = (value?: number, loading?: boolean): string =>
    value === undefined
        ? loading
            ? 'Loading…'
            : 'Awaiting'
        : `${value.toLocaleString()} Mbps`;

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

const parseTeA2ACandidateRow = (
    row: Record<string, unknown>
): ThousandEyesA2ACandidate | null => {
    const teAccountId = textFromRow(row, ['teAccountId', 'accountId']);
    const teTestId = textFromRow(row, ['teTestId', 'testId']);
    const sourceAgent = textFromRow(row, ['sourceAgent', 'sourceAgents']);
    const targetAgent = textFromRow(row, ['targetAgent', 'targetAgents']);
    const fallbackId = [teAccountId, teTestId, sourceAgent, targetAgent]
        .filter(Boolean)
        .join('|');
    const candidateId =
        textFromRow(row, ['candidateId', 'id']) || fallbackId || undefined;
    if (!candidateId) return null;

    const status =
        normalizeStatus(textFromRow(row, ['status', 'linkStatus'])) ?? 'unknown';
    const teLink =
        textFromRow(row, ['teLink', 'te_link', 'thousandeyes.permalink']) ??
        buildThousandEyesPathLink(teAccountId, teTestId);

    return {
        candidateId,
        teAccountId,
        teTestId,
        teTestName: textFromRow(row, ['teTestName', 'testName']),
        sourceAgent,
        targetAgent,
        sourceAgents: textFromRow(row, ['sourceAgents', 'source_agents']),
        targetAgents: textFromRow(row, ['targetAgents', 'target_agents']),
        sourceLocation: textFromRow(row, ['sourceLocation', 'source_location']),
        targetLocation: textFromRow(row, ['targetLocation', 'target_location']),
        sourceCountry: textFromRow(row, ['sourceCountry', 'source_country']),
        targetCountry: textFromRow(row, ['targetCountry', 'target_country']),
        sourceRegion: textFromRow(row, ['sourceRegion', 'source_region']),
        targetRegion: textFromRow(row, ['targetRegion', 'target_region']),
        status,
        capacityMbps: finiteNumberFromRow(row, ['capacityMbps', 'capacity_mbps']),
        throughputMbps: finiteNumberFromRow(row, [
            'throughputMbps',
            'throughput_mbps',
        ]),
        peakThroughputMbps: finiteNumberFromRow(row, [
            'peakThroughputMbps',
            'peak_throughput_mbps',
        ]),
        utilizationPct: finiteNumberFromRow(row, [
            'utilizationPct',
            'utilization_pct',
        ]),
        peakUtilizationPct: finiteNumberFromRow(row, [
            'peakUtilizationPct',
            'peak_utilization_pct',
        ]),
        latencyMs: finiteNumberFromRow(row, ['latencyMs', 'latency_ms']),
        lossPct: finiteNumberFromRow(row, ['lossPct', 'loss_pct']),
        jitterMs: finiteNumberFromRow(row, ['jitterMs', 'jitter_ms']),
        endpointHealthPct: finiteNumberFromRow(row, [
            'endpointHealthPct',
            'endpoint_health_pct',
        ]),
        txMbps: finiteNumberFromRow(row, ['txMbps', 'tx_mbps']),
        rxMbps: finiteNumberFromRow(row, ['rxMbps', 'rx_mbps']),
        endpointDevices: finiteNumberFromRow(row, [
            'endpointDevices',
            'endpoint_devices',
        ]),
        teLink,
        lastUpdated: textFromRow(row, ['lastUpdated', 'last_updated', '_time']),
        telemetrySource:
            textFromRow(row, ['telemetrySource', 'telemetry_source']) ??
            'ThousandEyes A2A',
    };
};

const liveLinkPatchFromTeCandidate = (
    base: TopologyLink,
    candidate: ThousandEyesA2ACandidate,
    match?: ThousandEyesA2AMatch
): Partial<TopologyLink> => ({
    ...parseLinkRow(base, candidate as unknown as Record<string, unknown>),
    telemetrySource: match?.exact
        ? candidate.telemetrySource
        : `${candidate.telemetrySource} (${match?.reason ?? 'matched by site identity'})`,
    dataState: 'live',
    dataError: undefined,
});

const missingTeBindingPatch = (link: TopologyLink): Partial<TopologyLink> => {
    const binding = link.thousandEyesA2A;
    return {
        status: 'unknown',
        sourceAgents: binding?.sourceAgent ?? link.sourceAgents,
        targetAgents: binding?.targetAgent ?? link.targetAgents,
        sourceLocation: binding?.sourceLocation ?? link.sourceLocation,
        targetLocation: binding?.targetLocation ?? link.targetLocation,
        teLink:
            link.teLink ??
            buildThousandEyesPathLink(binding?.teAccountId, binding?.teTestId),
        dataState: 'error',
        dataError: 'No recent ThousandEyes A2A metric rows matched this binding',
        telemetrySource: 'ThousandEyes A2A binding awaiting recent metrics',
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
    const role = normalizeTopologyRoleInput(rawRole, inferRoleFromName(name));
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
    haloWeight: number;
    haloOpacity: number;
    highlightWeight: number;
}

const linkFlowProfile = (link: TopologyLink): LinkFlowProfile => {
    switch (link.status) {
        case 'critical':
            return {
                dashArray: '8 7',
                flowSeconds: 0.85,
                breathe: true,
                weight: 4.2,
                opacity: 0.95,
                haloWeight: 13,
                haloOpacity: 0.24,
                highlightWeight: 7,
            };
        case 'warning':
            return {
                dashArray: '10 8',
                flowSeconds: 1.8,
                breathe: false,
                weight: 3.8,
                opacity: 0.9,
                haloWeight: 11,
                haloOpacity: 0.2,
                highlightWeight: 6,
            };
        case 'stable':
            return {
                dashArray: null,
                flowSeconds: null,
                breathe: false,
                weight: 3.4,
                opacity: 0.86,
                haloWeight: 10,
                haloOpacity: 0.18,
                highlightWeight: 5.4,
            };
        case 'unknown':
        default:
            return {
                dashArray: '2 6',
                flowSeconds: null,
                breathe: false,
                weight: 2.2,
                opacity: 0.52,
                haloWeight: 8,
                haloOpacity: 0.12,
                highlightWeight: 4.2,
            };
    }
};

/**
 * Site marker design: role owns the primary marker colour, while status is
 * reserved for the small LED/search-health signal. This avoids role colours
 * being mistaken for healthy, warning, or critical search results.
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

const STATUS_MARKER_SPEED: Record<TopologyStatus, string> = {
    critical: '1.1s',
    warning: '1.75s',
    stable: '3.35s',
    unknown: '4.6s',
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
    const roleChrome = topologyRoleBeaconChrome(site.role);
    const ringColor = STATUS_RING_COLOR[site.status];
    const haloColor = STATUS_HALO_RGBA[site.status];
    const waveSpeed = STATUS_MARKER_SPEED[site.status];
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
    const markerAccentColor = roleChrome.fill;
    const markerAccentHalo = roleChrome.halo;
    const pillBg = markerAccentColor;
    const siteTextColor = '#ffffff';
    const siteTextShadow = '0 1px 2px rgba(15, 23, 42, 0.38)';
    const beaconModeClass = isDark
        ? 'customer-topology-site-beacon--dark'
        : 'customer-topology-site-beacon--light';
    const entranceClass = animateEntrance
        ? 'customer-topology-marker-enter'
        : '';
    const entranceStyle = animateEntrance
        ? `--customer-topology-marker-delay:${entranceDelayMs}ms;`
        : '';
    const healthStyle =
        `--site-health:${ringColor};` +
        `--site-health-soft:${haloColor};` +
        `--site-accent:${markerAccentColor};` +
        `--site-accent-soft:${markerAccentHalo};` +
        `--site-surface:${pillBg};` +
        `--site-text:${siteTextColor};` +
        `--site-text-shadow:${siteTextShadow};` +
        `--site-wave-speed:${waveSpeed};`;
    return L.divIcon({
        className: 'custom-div-icon',
        html: `
      <div class="relative flex flex-col items-center group w-[220px] ${entranceClass}" style="${entranceStyle}${healthStyle}">
        <div class="customer-topology-site-beacon ${beaconModeClass} ${selectionScale} transition-transform duration-200" style="${selectionRing}">
          <span class="customer-topology-site-wave" aria-hidden="true"></span>
          <span class="customer-topology-site-wave customer-topology-site-wave--2" aria-hidden="true"></span>
          <span class="customer-topology-site-wave customer-topology-site-wave--3" aria-hidden="true"></span>
          <span class="customer-topology-site-core" aria-hidden="true">
            <span class="customer-topology-site-code">${safeShortName}</span>
          </span>
          <span class="customer-topology-site-led" aria-hidden="true"></span>
        </div>
        <div class="mt-1 whitespace-nowrap font-semibold px-2.5 py-0.5 rounded-md shadow-sm border text-[11px] ${labelChrome} ${roleChrome.label}" style="border-color:${markerAccentColor}66;">
          ${safeName}
        </div>
      </div>
    `,
        iconSize: [220, 82],
        iconAnchor: [110, 25],
    });
};

interface TopologySiteMarkerProps {
    site: TopologySite;
    index: number;
    isSelected: boolean;
    isSpotlight: boolean;
    isDark: boolean;
    animationLevel: TopologyAnimationLevel;
    shouldAnimateMarkerEntrance: (
        siteId: string,
        level: TopologyAnimationLevel
    ) => boolean;
    onSelect: (site: TopologySite) => void;
}

const TopologySiteMarker: React.FC<TopologySiteMarkerProps> = React.memo(
    ({
        site,
        index,
        isSelected,
        isSpotlight,
        isDark,
        animationLevel,
        shouldAnimateMarkerEntrance,
        onSelect,
    }) => {
        const animateEntrance = useMemo(
            () => shouldAnimateMarkerEntrance(site.id, animationLevel),
            [animationLevel, shouldAnimateMarkerEntrance, site.id]
        );
        const icon = useMemo(
            () =>
                createSiteIcon(
                    site,
                    isSelected,
                    isSpotlight,
                    isDark,
                    animateEntrance,
                    index * 90
                ),
            [
                animateEntrance,
                index,
                isDark,
                isSelected,
                isSpotlight,
                site.id,
                site.name,
                site.role,
                site.shortName,
                site.status,
            ]
        );
        const position = useMemo<[number, number]>(
            () => [site.lat, site.lng],
            [site.lat, site.lng]
        );
        const eventHandlers = useMemo(
            () => ({
                click: () => onSelect(site),
            }),
            [onSelect, site]
        );

        return (
            <Marker
                position={position}
                icon={icon}
                eventHandlers={eventHandlers}
            />
        );
    }
);

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
    const statusClass = `customer-topology-link--${link.status}`;
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
                    weight: 24,
                    opacity: 0.01,
                    lineCap: 'round',
                    lineJoin: 'round',
                    className: 'customer-topology-link-hitbox',
                }}
                eventHandlers={{ click: handleClick }}
            />
            <Polyline
                interactive={false}
                positions={positions}
                pathOptions={{
                    color: '#0f172a',
                    weight: profile.haloWeight + 2,
                    opacity: 0.12,
                    lineCap: 'round',
                    lineJoin: 'round',
                    className: 'customer-topology-link-shadow',
                }}
            />
            <Polyline
                interactive={false}
                positions={positions}
                pathOptions={{
                    color,
                    weight: isSelected ? profile.haloWeight + 2 : profile.haloWeight,
                    opacity: isSelected
                        ? Math.min(0.36, profile.haloOpacity + 0.12)
                        : profile.haloOpacity,
                    lineCap: 'round',
                    lineJoin: 'round',
                    className: `customer-topology-link-halo ${statusClass}`,
                }}
            />
            <Polyline
                interactive={false}
                positions={positions}
                pathOptions={{
                    color: '#ffffff',
                    weight: isSelected
                        ? profile.highlightWeight + 1
                        : profile.highlightWeight,
                    opacity: link.status === 'unknown' ? 0.28 : 0.42,
                    lineCap: 'round',
                    lineJoin: 'round',
                    className: 'customer-topology-link-highlight',
                }}
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
                    className: `customer-topology-link-shell customer-topology-link-core ${statusClass}`,
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
            statusClass: 'customer-topology-packet--unknown',
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
                fill: '#22c55e',
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

const linkPacketPathD = (
    map: L.Map,
    source: TopologySite,
    target: TopologySite
): string | null => {
    const points = computeBezierLine(
        [source.lat, source.lng],
        [target.lat, target.lng]
    );
    if (points.length < 2) return null;
    const layerPoints = points.map(([lat, lng]) =>
        map.latLngToLayerPoint([lat, lng])
    );
    const head = layerPoints[0];
    const tail = layerPoints
        .slice(1)
        .map((p) => `L${p.x},${p.y}`)
        .join(' ');
    return `M${head.x},${head.y} ${tail}`;
};

/**
 * Renders bright "packets" (small SVG circles) traveling end-to-end along
 * each link's bezier curve, color-coded by health status and density-tuned
 * by the active animation level.
 *
 * The implementation lives inside Leaflet's overlay SVG so packets appear
 * above the polyline shells but below the site markers and popups. Leaflet
 * moves the SVG during pan, then re-anchors it after drag end; we update the
 * referenced path geometry in place on those map events so packet animations
 * keep running without a visible restart.
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
    // below to run again, i.e. on the very first attach. Map movement
    // updates the existing hidden path geometry in-place so SMIL packet
    // animations continue smoothly instead of restarting after a drag.
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

    // Step 2: update packet path geometry whenever Leaflet re-anchors
    // the SVG frame. This preserves the existing <animateMotion> nodes,
    // avoiding the visible flicker caused by tearing them down on every
    // pan / resize.
    useEffect(() => {
        let animationFrame = 0;
        const updateGeometry = () => {
            animationFrame = 0;
            const group = groupRef.current;
            if (!group || animationLevel === 'off') return;
            const paths = new Map(
                Array.from(
                    group.querySelectorAll<SVGPathElement>(
                        'path[data-customer-topology-packet-link-id]'
                    )
                ).map((path) => [
                    path.getAttribute('data-customer-topology-packet-link-id'),
                    path,
                ])
            );
            for (const { link, source, target } of linkSegments) {
                const path = paths.get(link.id);
                if (!path) continue;
                const nextD = linkPacketPathD(map, source, target);
                if (nextD) path.setAttribute('d', nextD);
            }
        };
        const scheduleGeometryUpdate = () => {
            if (animationFrame) return;
            animationFrame = window.requestAnimationFrame(updateGeometry);
        };

        map.on('moveend', scheduleGeometryUpdate);
        map.on('zoomend', scheduleGeometryUpdate);
        map.on('viewreset', scheduleGeometryUpdate);
        map.on('resize', scheduleGeometryUpdate);
        return () => {
            if (animationFrame) window.cancelAnimationFrame(animationFrame);
            map.off('moveend', scheduleGeometryUpdate);
            map.off('zoomend', scheduleGeometryUpdate);
            map.off('viewreset', scheduleGeometryUpdate);
            map.off('resize', scheduleGeometryUpdate);
        };
    }, [animationLevel, linkSegments, map]);

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
            const d = linkPacketPathD(map, source, target);
            if (!d) continue;

            const pathId = `customer-topology-packet-path-${link.id}`;
            const path = document.createElementNS(SVG_NS, 'path');
            path.setAttribute('id', pathId);
            path.setAttribute('d', d);
            path.setAttribute('fill', 'none');
            path.setAttribute('data-customer-topology-packet-link-id', link.id);
            defs.appendChild(path);

            // Round-trip motion: one packet now travels source → target → source.
            // Doubling duration preserves the one-way speed operators already
            // reviewed while making the bidirectional circuit intent obvious.
            const roundTripSeconds = profile.durationSeconds * 2;

            for (let i = 0; i < profile.count; i++) {
                // Stagger packet starts so they appear evenly distributed
                // along the path rather than clumping at the origin.
                const beginOffset = (i / profile.count) * roundTripSeconds;
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
                motion.setAttribute('dur', `${roundTripSeconds}s`);
                motion.setAttribute('repeatCount', 'indefinite');
                motion.setAttribute('rotate', 'auto');
                motion.setAttribute('keyPoints', '0;1;0');
                motion.setAttribute('keyTimes', '0;0.5;1');
                motion.setAttribute('calcMode', 'linear');
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

type TopologyMapView = {
    center: CustomerTopology['map']['center'];
    zoom: number;
};

const mapViewFromTopologyMap = (
    map: CustomerTopology['map']
): TopologyMapView => ({
    center: [
        Number(map.center[0].toFixed(5)),
        Number(map.center[1].toFixed(5)),
    ],
    zoom: Number(map.zoom.toFixed(2)),
});

const mapViewFromLeaflet = (map: L.Map): TopologyMapView => {
    const center = map.getCenter();
    return {
        center: [
            Number(center.lat.toFixed(5)),
            Number(center.lng.toFixed(5)),
        ],
        zoom: Number(map.getZoom().toFixed(2)),
    };
};

const topologyMapViewsMatch = (
    left: TopologyMapView,
    right: TopologyMapView
): boolean =>
    left.center[0] === right.center[0] &&
    left.center[1] === right.center[1] &&
    left.zoom === right.zoom;

const MapFrame: React.FC<MapFrameProps> = ({ topology, autoFitSites }) => {
    const map = useMap();
    const [centerLat, centerLng] = topology.map.center;
    const zoom = topology.map.zoom;
    const effectiveBounds = boundsForTopologySites(topology.map.bounds, topology.sites);
    const effectiveMinZoom = minZoomForTopologySites(
        topology.sites,
        topology.map.minZoom
    );
    const [[minLat, minLng], [maxLat, maxLng]] = effectiveBounds;
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
    }, [centerLat, centerLng, map, zoom]);

    useEffect(() => {
        const container = map.getContainer();
        let animationFrame = 0;
        let lastWidth = 0;
        let lastHeight = 0;

        const invalidate = () => {
            animationFrame = 0;
            const rect = container.getBoundingClientRect();
            const width = Math.round(rect.width);
            const height = Math.round(rect.height);
            if (width === lastWidth && height === lastHeight) return;
            lastWidth = width;
            lastHeight = height;
            map.invalidateSize({
                animate: false,
                pan: false,
                debounceMoveend: true,
            });
        };

        const scheduleInvalidate = () => {
            if (animationFrame) return;
            animationFrame = window.requestAnimationFrame(invalidate);
        };

        scheduleInvalidate();
        const observer = new ResizeObserver(scheduleInvalidate);
        observer.observe(container);
        return () => {
            if (animationFrame) window.cancelAnimationFrame(animationFrame);
            observer.disconnect();
        };
    }, [map]);

    useEffect(() => {
        map.setMinZoom(effectiveMinZoom);
        if (map.getZoom() < effectiveMinZoom) {
            map.setZoom(effectiveMinZoom, { animate: false });
        }
    }, [effectiveMinZoom, map]);

    useEffect(() => {
        const nextBounds = L.latLngBounds([minLat, minLng], [maxLat, maxLng]);
        if (nextBounds.isValid()) {
            map.setMaxBounds(nextBounds);
        }
    }, [map, minLat, minLng, maxLat, maxLng]);

    useEffect(() => {
        if (autoFitAppliedRef.current) return;
        if (!autoFitSites || autoFitSites.length === 0) return;
        const usable = validTopologySites(autoFitSites);
        if (usable.length === 0) return;
        const bounds = L.latLngBounds(
            usable.map((site) => [site.lat, site.lng] as [number, number])
        );
        if (!bounds.isValid()) return;
        map.fitBounds(bounds, { padding: [48, 48], animate: false, maxZoom: 9 });
        autoFitAppliedRef.current = true;
    }, [autoFitSites, map]);

    return null;
};

interface MapViewCaptureProps {
    onViewChange: (view: TopologyMapView) => void;
}

const MapViewCapture: React.FC<MapViewCaptureProps> = ({ onViewChange }) => {
    const map = useMap();
    const emitView = useCallback(() => {
        onViewChange(mapViewFromLeaflet(map));
    }, [map, onViewChange]);

    useEffect(() => {
        emitView();
    }, [emitView]);

    useMapEvents({
        moveend: emitView,
        zoomend: emitView,
    });

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
    const [isEditorSaving, setIsEditorSaving] = useState(false);
    const [editorPersistenceError, setEditorPersistenceError] = useState<
        string | null
    >(null);
    const [draftTopology, setDraftTopology] = useState<CustomerTopology>(() =>
        cloneTopology(storedTopology)
    );
    const [currentMapView, setCurrentMapView] = useState<TopologyMapView>(() =>
        mapViewFromTopologyMap(storedTopology.map)
    );
    const [pickSiteId, setPickSiteId] = useState<string | null>(null);
    const [roleLegendMode, setRoleLegendMode] =
        useState<TopologyRoleLegendMode>(readStoredRoleLegendMode);
    const [tilePresetId, setTilePresetId] = useState<TileLayerPreset['id']>(
        DEFAULT_TILE_LAYER_PRESET_ID
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
    const [teA2ACandidates, setTeA2ACandidates] = useState<
        ThousandEyesA2ACandidate[] | null
    >(null);
    const [teA2AInventoryError, setTeA2AInventoryError] = useState<string | null>(
        null
    );
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
    const visualAnimationLevel: TopologyAnimationLevel = isEditorOpen
        ? 'off'
        : animationLevel;

    const setRoleLegendExpanded = useCallback((expanded: boolean) => {
        const next: TopologyRoleLegendMode = expanded ? 'expanded' : 'compact';
        setRoleLegendMode(next);
        writeStoredRoleLegendMode(next);
    }, []);

    const updateCurrentMapView = useCallback((view: TopologyMapView) => {
        setCurrentMapView((current) =>
            topologyMapViewsMatch(current, view) ? current : view
        );
    }, []);

    const applyCurrentMapViewToDraft = useCallback(() => {
        setDraftTopology((current) => ({
            ...current,
            map: {
                ...current.map,
                center: currentMapView.center,
                zoom: currentMapView.zoom,
            },
        }));
    }, [currentMapView]);

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
        const record = catalogueByName[TE_A2A_INVENTORY_SEARCH_NAME];
        if (!record?.search?.trim()) {
            setTeA2ACandidates([]);
            setTeA2AInventoryError(
                'ThousandEyes A2A inventory search is not installed'
            );
            return undefined;
        }

        let cancelled = false;
        setTeA2ACandidates(null);
        setTeA2AInventoryError(null);
        setLiveLinkById((current) => {
            const next = { ...current };
            for (const link of storedTopology.links) {
                if (!link.thousandEyesA2A) continue;
                next[link.id] = {
                    ...next[link.id],
                    dataState:
                        next[link.id]?.dataState === 'live' ? 'live' : 'loading',
                };
            }
            return next;
        });

        runSearch({
            spl: record.search,
            earliestTime,
            latestTime,
            tag: 'topology_te_a2a_inventory',
        })
            .then((res) => {
                if (cancelled) return;
                const rows = (res?.results ?? []) as Array<Record<string, unknown>>;
                const candidates = rows
                    .map(parseTeA2ACandidateRow)
                    .filter(
                        (candidate): candidate is ThousandEyesA2ACandidate =>
                            Boolean(candidate)
                    );
                setTeA2ACandidates(candidates);
                setTeA2AInventoryError(null);
            })
            .catch((err) => {
                if (cancelled) return;
                setTeA2ACandidates([]);
                setTeA2AInventoryError(
                    err instanceof Error ? err.message : String(err)
                );
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
                        if (link.searchName || link.thousandEyesA2A) {
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
                        if (link.searchName || link.thousandEyesA2A) continue;
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
            if (link.thousandEyesA2A) return false;
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

    useEffect(() => {
        if (teA2ACandidates === null) return undefined;
        const siteMap = new Map(storedTopology.sites.map((site) => [site.id, site]));
        setLiveLinkById((current) => {
            const next = { ...current };
            for (const link of storedTopology.links) {
                const sourceSite = siteMap.get(link.sourceSiteId);
                const targetSite = siteMap.get(link.targetSiteId);
                const match = selectAutoTeMatch(
                    link,
                    sourceSite,
                    targetSite,
                    teA2ACandidates
                );

                if (link.thousandEyesA2A) {
                    next[link.id] = match
                        ? {
                              ...next[link.id],
                              ...liveLinkPatchFromTeCandidate(link, match.candidate, match),
                          }
                        : {
                              ...next[link.id],
                              ...missingTeBindingPatch(link),
                          };
                    continue;
                }

                if (link.searchName) continue;

                if (match) {
                    next[link.id] = {
                        ...next[link.id],
                        ...liveLinkPatchFromTeCandidate(link, match.candidate, match),
                    };
                    continue;
                }

                if (next[link.id]?.telemetrySource?.includes('ThousandEyes A2A')) {
                    delete next[link.id];
                }
            }
            return next;
        });
        return undefined;
    }, [teA2ACandidates, storedTopology.links, storedTopology.sites]);

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
            dataState:
                link.searchName || link.thousandEyesA2A
                    ? 'loading'
                    : link.dataState ?? 'static',
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

    const topologyFooterSummaryById = useMemo<TopologySummaryMetricMap>(() => {
        const sourceForItems = (
            items: Array<{ dataState?: TopologySite['dataState'] }>
        ): TopologySummaryMetric['source'] => {
            if (items.some((item) => item.dataState === 'live')) return 'live';
            if (items.some((item) => item.dataState === 'loading')) return 'loading';
            return 'mock';
        };
        const sites = resolvedTopology.sites;
        const links = resolvedTopology.links;
        const sitesWithKnownHealth = sites.filter((site) => site.status !== 'unknown');
        const linksWithKnownHealth = links.filter((link) => link.status !== 'unknown');
        const healthySites = sites.filter((site) => site.status === 'stable').length;
        const healthyLinks = links.filter((link) => link.status === 'stable').length;
        return {
            sites_healthy: {
                id: 'sites_healthy',
                label:
                    sitesWithKnownHealth.length > 0 ? 'Sites healthy' : 'Sites mapped',
                value:
                    sites.length > 0
                        ? sitesWithKnownHealth.length > 0
                            ? `${healthySites}/${sites.length}`
                            : String(sites.length)
                        : '—',
                source: sourceForItems(sites),
            },
            wan_paths_healthy: {
                id: 'wan_paths_healthy',
                label:
                    linksWithKnownHealth.length > 0
                        ? 'WAN paths healthy'
                        : 'WAN paths mapped',
                value:
                    links.length > 0
                        ? linksWithKnownHealth.length > 0
                            ? `${healthyLinks}/${links.length}`
                            : String(links.length)
                        : '—',
                source: sourceForItems(links),
            },
        };
    }, [resolvedTopology.links, resolvedTopology.sites]);

    const parentSummaryMetricById = useMemo<TopologySummaryMetricMap>(
        () => ({
            ...summaryMetricById,
            ...topologyFooterSummaryById,
        }),
        [summaryMetricById, topologyFooterSummaryById]
    );

    useEffect(() => {
        onSummaryMetricsChange?.(parentSummaryMetricById);
    }, [onSummaryMetricsChange, parentSummaryMetricById]);

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
    const selectedSearchName = selectedItemSearchName?.trim() || undefined;
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
        if (
            visualAnimationLevel !== 'on' ||
            isEditorOpen ||
            spotlightIntervalMs <= 0 ||
            spotlightOrder.length === 0
        ) {
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
    }, [
        isEditorOpen,
        spotlightIntervalMs,
        spotlightOrder,
        paused,
        resolvedSelected,
        visualAnimationLevel,
    ]);

    // Escape-to-dismiss + click-outside-to-dismiss now both live inside
    // `SelectionCard` so the panel's lifecycle behaviour is colocated
    // with the panel. The earlier copy of the Escape listener lived
    // here at the parent level and used the bubble phase, which let
    // focused descendants (editor inputs, Leaflet keyboard handlers)
    // swallow the key by stopPropagation. The new copy uses capture
    // phase from inside the popup component itself.

    const tilePreset =
        TILE_LAYER_PRESETS.find((preset) => preset.id === tilePresetId) ??
        TILE_LAYER_PRESETS.find((preset) => preset.id === DEFAULT_TILE_LAYER_PRESET_ID) ??
        TILE_LAYER_PRESETS[0];
    const tileUrl = isDark ? tilePreset.dark : tilePreset.light;
    const effectiveMapBounds = boundsForTopologySites(
        resolvedTopology.map.bounds,
        resolvedTopology.sites
    );
    const effectiveMinZoom = minZoomForTopologySites(
        resolvedTopology.sites,
        resolvedTopology.map.minZoom
    );
    const resolvedSiteSpread = topologySiteSpread(resolvedTopology.sites);
    const shouldAutoFitGlobalTopology =
        resolvedSiteSpread.latSpan > 45 || resolvedSiteSpread.lngSpan > 120;
    const bounds = L.latLngBounds(effectiveMapBounds[0], effectiveMapBounds[1]);
    const roleLegendExpanded = roleLegendMode === 'expanded';
    const roleLegendPreviewSites = resolvedTopology.sites.slice(0, 6);
    const overlayChrome = isDark
        ? 'bg-slate-900/75 border-slate-700/80 text-slate-200 backdrop-blur-md'
        : 'bg-white/78 border-sky-200/80 text-slate-700 backdrop-blur-md';
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

    // Build 99 fix: the spotlight-pause logic was previously
    // bumping `pauseUntilRef` on EVERY click, including ones that
    // *close* the selection panel (toggling off via re-click).
    // Combined with the 11s spotlight tick interval, that meant
    // closing the panel left the alert-ring spotlight invisible
    // for up to 25 seconds — long enough that Alan reported the
    // ring as "broken until I refresh the browser". Re-clicking
    // the same marker to dismiss made it worse: a *fresh* 25s
    // pause clock started every time.
    //
    // Correct semantics: pause the spotlight while the user is
    // actively engaged with a selection (so the spotlight doesn't
    // pull their eye away to a different site mid-read), and
    // resume immediately the moment they dismiss. The
    // `closeSelection` helper below threads that contract through
    // every dismiss path (X button, Escape, click-outside,
    // background click, re-click toggle, opening the editor).
    const closeSelection = useCallback(() => {
        pauseUntilRef.current = 0;
        setSelected(null);
    }, []);

    const selectSite = useCallback((site: TopologySite) => {
        // Mutate the pause ref *outside* the setState updater because
        // strict-mode dev builds invoke updater functions twice for
        // detection — and a ref mutation inside the updater would
        // double-bump the pause clock. `selected` is read here (not
        // via the updater) so we capture the closed-over value at the
        // event boundary.
        const isClose =
            selected?.kind === 'site' && selected.site.id === site.id;
        pauseUntilRef.current = isClose ? 0 : Date.now() + spotlightPauseMs;
        setSelected(isClose ? null : { kind: 'site', site });
    }, [selected, spotlightPauseMs]);

    const selectLink = useCallback((link: TopologyLink) => {
        const isClose =
            selected?.kind === 'link' && selected.link.id === link.id;
        pauseUntilRef.current = isClose ? 0 : Date.now() + spotlightPauseMs;
        setSelected(isClose ? null : { kind: 'link', link });
    }, [selected, spotlightPauseMs]);

    const openEditor = () => {
        // Opening the editor closes any open selection card; that's
        // a dismiss, so resume spotlight immediately rather than
        // pausing. The editor itself doesn't render the spotlight
        // ring (it has its own UI focus), so there's no need to
        // suppress the cycle while the editor is open.
        pauseUntilRef.current = 0;
        setSelected(null);
        setDraftTopology(cloneTopology(storedTopology));
        setEditorPersistenceError(null);
        setIsEditorOpen(true);
    };

    const saveEditor = async () => {
        setIsEditorSaving(true);
        setEditorPersistenceError(null);
        try {
            await saveTopology(draftTopology);
            setPickSiteId(null);
            setIsEditorOpen(false);
        } catch (err) {
            setEditorPersistenceError(errorMessage(err));
        } finally {
            setIsEditorSaving(false);
        }
    };

    const resetEditor = async () => {
        setIsEditorSaving(true);
        setEditorPersistenceError(null);
        try {
            await resetTopology();
            setPickSiteId(null);
            setIsEditorOpen(false);
        } catch (err) {
            setEditorPersistenceError(errorMessage(err));
        } finally {
            setIsEditorSaving(false);
        }
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
                `customer-topology-anim--${visualAnimationLevel}`,
                isDark
                    ? 'bg-slate-900 border-slate-800'
                    : 'bg-slate-100 border-slate-200'
            )}
        >
            <style>{topologyAnimationCss}</style>

            {visualAnimationLevel === 'on' &&
                !isEditorOpen &&
                !resolvedSelected &&
                spotlightSite && (
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
                                    : visualAnimationLevel === 'on'
                                    ? 'bg-emerald-500 animate-pulse'
                                    : 'bg-emerald-500'
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
                maxBoundsViscosity={0.85}
                minZoom={effectiveMinZoom}
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
                        shouldAutoFitGlobalTopology
                            ? resolvedTopology.sites
                            : activeTopology.sites.length === 0
                            ? resolvedTopology.sites
                            : undefined
                    }
                />
                <MapViewCapture onViewChange={updateCurrentMapView} />
                <MapClickCapture
                    enabled={isEditorOpen && Boolean(pickSiteId)}
                    onPick={applyMapPick}
                    onBackgroundClick={closeSelection}
                />
                <TileLayer key={`${tilePreset.id}-${tileUrl}`} attribution="" url={tileUrl} />
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
                        animationLevel={visualAnimationLevel}
                    />
                ))}

                <LinkPacketLayer
                    linkSegments={linkSegments}
                    animationLevel={visualAnimationLevel}
                />


                {spotlightSite &&
                    (spotlightSite.status === 'critical' ||
                        spotlightSite.status === 'warning') &&
                    visualAnimationLevel === 'on' &&
                    !isEditorOpen &&
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
                    <TopologySiteMarker
                        key={site.id}
                        site={site}
                        index={index}
                        isSelected={
                            resolvedSelected?.kind === 'site' &&
                            resolvedSelected.site.id === site.id
                        }
                        isSpotlight={
                            !isEditorOpen &&
                            visualAnimationLevel === 'on' &&
                            spotlightSite?.id === site.id &&
                            !resolvedSelected
                        }
                        isDark={isDark}
                        animationLevel={visualAnimationLevel}
                        shouldAnimateMarkerEntrance={shouldAnimateMarkerEntrance}
                        onSelect={selectSite}
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
                onClose={closeSelection}
                onSelectLink={selectLink}
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
                currentMapView={currentMapView}
                onApplyCurrentMapView={applyCurrentMapViewToDraft}
                onSave={saveEditor}
                onResetFactory={resetEditor}
                isSaving={isEditorSaving}
                saveError={editorPersistenceError}
                onClose={() => {
                    setPickSiteId(null);
                    setEditorPersistenceError(null);
                    setIsEditorOpen(false);
                }}
                catalogueByName={catalogueByName}
                teA2ACandidates={teA2ACandidates}
                teA2AInventoryError={teA2AInventoryError}
                onOpenInSearch={onOpenInSearch}
            />

            <div className="absolute bottom-6 left-4 z-[1000] space-y-3 pointer-events-auto">
                {roleLegendExpanded ? (
                    <div
                        className={cn(
                            'border p-3 rounded-xl shadow-xl max-w-[190px] transition-all',
                            overlayChrome
                        )}
                    >
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                                Site Roles
                            </h5>
                            <button
                                type="button"
                                onClick={() => setRoleLegendExpanded(false)}
                                title="Collapse site roles"
                                aria-label="Collapse site roles"
                                className={cn(
                                    'rounded-md p-1 transition-colors focus:outline-none focus:ring-1 focus:ring-sky-400',
                                    isDark
                                        ? 'hover:bg-slate-800 text-slate-400 hover:text-slate-100'
                                        : 'hover:bg-sky-50 text-slate-400 hover:text-sky-700'
                                )}
                            >
                                <ChevronRight className="h-3.5 w-3.5 rotate-180" />
                            </button>
                        </div>
                        <div className="space-y-2">
                            {resolvedTopology.sites.map((site) => (
                                <LegendRow
                                    key={site.id}
                                    color={topologyRoleDotClass(site.role)}
                                    label={topologyRoleLabel(site.role)}
                                    id={site.shortName}
                                    isDark={isDark}
                                />
                            ))}
                        </div>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={() => setRoleLegendExpanded(true)}
                        title="Show site roles"
                        aria-label="Show site roles"
                        aria-expanded={false}
                        className={cn(
                            'group flex max-w-[190px] items-center gap-2 rounded-full border px-2.5 py-2 shadow-lg transition-all focus:outline-none focus:ring-1 focus:ring-sky-400',
                            overlayChrome
                        )}
                    >
                        <span className="text-[9px] font-black uppercase tracking-[0.18em] text-sky-700 dark:text-sky-300">
                            Roles
                        </span>
                        <span className="flex -space-x-1">
                            {roleLegendPreviewSites.map((site) => (
                                <span
                                    key={site.id}
                                    className={cn(
                                        'h-2.5 w-2.5 rounded-full border border-white shadow-sm dark:border-slate-900',
                                        topologyRoleDotClass(site.role)
                                    )}
                                    title={`${site.shortName}: ${topologyRoleLabel(
                                        site.role
                                    )}`}
                                />
                            ))}
                        </span>
                        <span className="rounded-full bg-sky-500/12 px-1.5 py-0.5 text-[9px] font-black text-sky-700 dark:bg-sky-400/15 dark:text-sky-200">
                            {resolvedTopology.sites.length}
                        </span>
                        <ChevronRight className="h-3.5 w-3.5 text-slate-400 transition-transform group-hover:translate-x-0.5" />
                    </button>
                )}

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
                        {tilePreset.badge}
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
    // Build 99: typeahead filter for the tag picker dropdown. Mirrors
    // the KpiPickerPanel pattern — operators with a vocabulary in
    // mind ("show me ThousandEyes tags") shouldn't have to scroll
    // through 12 chips, they should type to narrow.
    const [tagFilter, setTagFilter] = useState('');
    const tagFilterInputRef = useRef<HTMLInputElement | null>(null);
    const [customDraft, setCustomDraft] = useState(currentSearchName);

    useEffect(() => {
        setCustomDraft(currentSearchName);
    }, [currentSearchName]);

    // Auto-focus the tag-filter input when the picker opens so the
    // operator can start typing immediately. Reset the filter on
    // close so re-opening starts clean.
    useEffect(() => {
        if (tagPickerOpen) {
            const id = window.setTimeout(
                () => tagFilterInputRef.current?.focus(),
                30
            );
            return () => window.clearTimeout(id);
        }
        setTagFilter('');
        return undefined;
    }, [tagPickerOpen]);

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

    // All tags present in the filtered slice, ranked by frequency.
    // Used for the chip picker AND the typeahead match-count badge.
    // Build 99: split out from the displayed list so the typeahead
    // can filter without changing the underlying frequency ranking.
    const tagsAvailableAll = useMemo(() => {
        const counts = new Map<string, number>();
        for (const entry of filtered) {
            for (const tag of entry.tags) {
                counts.set(tag, (counts.get(tag) ?? 0) + 1);
            }
        }
        return Array.from(counts.entries())
            .filter(([tag]) => !activeTags.has(tag) && tag !== 'Cisco')
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    }, [filtered, activeTags]);

    const tagFilterLower = tagFilter.trim().toLowerCase();
    const tagsAvailable = useMemo(() => {
        const list = tagFilterLower
            ? tagsAvailableAll.filter(([tag]) =>
                  tag.toLowerCase().includes(tagFilterLower)
              )
            : tagsAvailableAll;
        return list.slice(0, TOPOLOGY_TAG_CHIP_LIMIT);
    }, [tagsAvailableAll, tagFilterLower]);

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
                {currentSearchName ? (
                    <button
                        type="button"
                        onClick={() => {
                            setCustomDraft('');
                            onPick('');
                        }}
                        className={cn(
                            'inline-flex items-center gap-1 rounded-md border px-1.5 py-1 text-[9px] font-black uppercase tracking-wider transition-colors focus:outline-none focus:ring-1 focus:ring-sky-400',
                            isDark
                                ? 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
                                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                        )}
                        title={`Remove the search binding from this ${label}`}
                    >
                        <X className="w-3 h-3" />
                        Unbind
                    </button>
                ) : (
                    <span
                        className={cn(
                            'rounded-md border px-1.5 py-1 text-[9px] font-black uppercase tracking-wider',
                            isDark
                                ? 'border-slate-800 text-slate-500'
                                : 'border-slate-200 text-slate-400'
                        )}
                    >
                        Optional
                    </span>
                )}
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
                    // Build 99: placeholder explicitly names the
                    // fields the input matches against. The
                    // underlying filter has always searched name +
                    // category + sub-category + tags, but Alan
                    // didn't realise tags were in the haystack ("we
                    // also need the ability to search for tags").
                    // Spelling it out tells the operator that
                    // typing "topology" or "thousandeyes" works
                    // without having to first open the chip
                    // picker.
                    placeholder={`Search ${catalogue.length} entries by name, category, or tag…`}
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

            {(activeTags.size > 0 || tagsAvailableAll.length > 0) && (
                <div className="space-y-1.5">
                    {/* Build 99: typeahead input revealed when the
                      * tag picker is open. The chip-only list scaled
                      * fine for the ~12-tag baseline but became
                      * unscalable as the catalogue grew (now 30+
                      * unique tags); operators with a tag name in
                      * mind ("ThousandEyes", "Topology_Site") had to
                      * scan a long chip wrap to find it. Auto-
                      * focuses on open, Enter selects the first
                      * match, Escape closes the picker. Same UX
                      * contract as KpiPickerPanel's tag dropdown so
                      * the two feel like the same affordance. */}
                    {tagPickerOpen && tagsAvailableAll.length > 0 && (
                        <div className="relative">
                            <Search
                                className={cn(
                                    'absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none',
                                    isDark ? 'text-slate-500' : 'text-slate-400'
                                )}
                            />
                            <input
                                ref={tagFilterInputRef}
                                type="text"
                                value={tagFilter}
                                onChange={(event) =>
                                    setTagFilter(event.target.value)
                                }
                                onKeyDown={(event) => {
                                    if (event.key === 'Escape') {
                                        event.preventDefault();
                                        setTagPickerOpen(false);
                                    } else if (event.key === 'Enter') {
                                        event.preventDefault();
                                        if (tagsAvailable.length > 0) {
                                            const [tag] = tagsAvailable[0];
                                            setActiveTags((prev) =>
                                                new Set(prev).add(tag)
                                            );
                                            setTagPickerOpen(false);
                                        }
                                    }
                                }}
                                placeholder={`Filter ${tagsAvailableAll.length} tag${
                                    tagsAvailableAll.length === 1 ? '' : 's'
                                }… (Enter applies first match)`}
                                className={cn(
                                    'w-full rounded border px-2 py-1 pl-6 pr-6 text-[10px] outline-none transition-colors focus:ring-1 focus:ring-sky-400',
                                    isDark
                                        ? 'bg-slate-950 border-slate-700 text-slate-200 placeholder:text-slate-600'
                                        : 'bg-white border-slate-300 text-slate-700 placeholder:text-slate-400'
                                )}
                            />
                            {tagFilter && (
                                <button
                                    type="button"
                                    onClick={() => setTagFilter('')}
                                    className={cn(
                                        'absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 transition-colors',
                                        isDark
                                            ? 'text-slate-500 hover:text-slate-300'
                                            : 'text-slate-400 hover:text-slate-600'
                                    )}
                                    title="Clear tag filter"
                                >
                                    <X className="w-2.5 h-2.5" />
                                </button>
                            )}
                        </div>
                    )}
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
                                        ? plainTextFromHtml(entry.description).slice(0, 240)
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
                            placeholder="e.g. Overview - Site Health"
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
    onSelectLink?: (link: TopologyLink) => void;
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
    onSelectLink,
    onOpenInSearch,
}) => {
    const dragControls = useDragControls();
    const [showSpl, setShowSpl] = useState(false);
    // Ref on the popup container so we can register a *document-level*
    // mousedown listener that dismisses when the user clicks outside
    // the panel. The map's MapClickCapture only fires when the click
    // hits empty map pixels, which doesn't help when the panel covers
    // basically the entire map column (the customer's narrow right-column
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
            ? topologyRoleLabel(selected.site.role)
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
                                onSelectLink={onSelectLink}
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
                                        aria-label="Open this query in Search"
                                        onClick={onOpenInSearch}
                                        title="Open this query in Search"
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
                                            title="Click to run this SPL in Search"
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
                                Open in Search
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
    currentMapView: TopologyMapView;
    onApplyCurrentMapView: () => void;
    onSave: () => void | Promise<void>;
    onResetFactory: () => void | Promise<void>;
    isSaving?: boolean;
    saveError?: string | null;
    onClose: () => void;
    /**
     * Searchbase catalogue keyed by `searchName`. Used to populate the
     * per-site and per-link "Pick search…" dropdowns so demo / fake
     * stanzas can be swapped in without typing the stanza name.
     * `null` while the catalogue is still loading.
     */
    catalogueByName: Record<string, SearchbaseRecord> | null;
    teA2ACandidates: ThousandEyesA2ACandidate[] | null;
    teA2AInventoryError?: string | null;
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

const editorBindingSummaryClass = (
    isDark: boolean,
    hasBinding: boolean
): string => {
    if (hasBinding) {
        return cn(
            'min-w-0 flex-1 truncate',
            isDark ? 'text-slate-300' : 'text-slate-600'
        );
    }
    return cn(
        'min-w-0 flex-1 truncate',
        isDark ? 'text-slate-500 italic' : 'text-slate-400 italic'
    );
};

const TopologyEditorPanel: React.FC<TopologyEditorPanelProps> = ({
    open,
    topology,
    factoryTopology,
    isDark,
    pickSiteId,
    onPickSite,
    onTopologyChange,
    currentMapView,
    onApplyCurrentMapView,
    onSave,
    onResetFactory,
    isSaving = false,
    saveError,
    onClose,
    catalogueByName,
    teA2ACandidates,
    teA2AInventoryError,
    onOpenInSearch,
}) => {
    const [jsonText, setJsonText] = useState('');
    const [jsonError, setJsonError] = useState<string | null>(null);
    const [sitePlacementDrafts, setSitePlacementDrafts] = useState<
        Record<string, string>
    >({});
    const [sitePlacementErrors, setSitePlacementErrors] = useState<
        Record<string, string>
    >({});
    const [placingSiteIds, setPlacingSiteIds] = useState<Record<string, boolean>>(
        {}
    );

    useEffect(() => {
        if (!open) return undefined;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            onClose();
        };
        document.addEventListener('keydown', onKeyDown, true);
        return () => document.removeEventListener('keydown', onKeyDown, true);
    }, [open, onClose]);

    // The editor's per-card pickers browse the full dashboard-pack
    // catalogue, identical to the in-popup `TopologySearchBrowser`.
    // Tag-narrowing (Topology_Site / Topology_Link) is a *sort
    // hint*, not a filter — those entries float to the top of the
    // list, but every dashboard-pack stanza is reachable via search.
    // This matches the KpiPickerPanel browsing model so editing a
    // tile and editing a topology element feel like the same
    // operation.
    //
    // Build 98 (2026-05-13): scope changed from `tags.includes('Cisco')`
    // to `dispatchContext === 'splunk-cisco-dashboards'`. The `Cisco`
    // tag was removed from every stanza during the FDEM/branding
    // cleanup in Build 91, so the old filter started returning
    // nothing — the topology editor's site / link change-search
    // browsers showed "0 of 0" entries (Alan caught this on
    // 2026-05-13). Same root-cause and same one-line fix as the KPI
    // picker hit in Build 91; the `dispatch_context` field is
    // authored on every stanza in this app's `default/searchbase.conf`
    // (with `dispatch_context_force = 1`) so it's a stable scope key
    // that the FDEM scrub didn't touch.
    const editorSearchOptions = useMemo(() => {
        if (!catalogueByName) return [] as SearchbaseRecord[];
        return Object.values(catalogueByName)
            .filter((record) => record.dispatchContext === 'splunk-cisco-dashboards')
            .sort((a, b) =>
                a.searchName.localeCompare(b.searchName, undefined, {
                    sensitivity: 'base',
                })
            );
    }, [catalogueByName]);

    const editorSiteById = useMemo(() => {
        const map: Record<string, TopologySite> = {};
        for (const site of topology.sites) map[site.id] = site;
        return map;
    }, [topology.sites]);

    const linkNameForEndpoints = useCallback(
        (sourceSiteId: string, targetSiteId: string): string => {
            const source = editorSiteById[sourceSiteId];
            const target = editorSiteById[targetSiteId];
            return `${source?.name ?? sourceSiteId} to ${target?.name ?? targetSiteId}`;
        },
        [editorSiteById]
    );

    const linkHasGeneratedName = useCallback(
        (link: TopologyLink): boolean => {
            const name = link.name.trim();
            return (
                name.length === 0 ||
                name === linkNameForEndpoints(link.sourceSiteId, link.targetSiteId) ||
                name === `${link.sourceSiteId} to ${link.targetSiteId}`
            );
        },
        [linkNameForEndpoints]
    );

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

    const updateSitePlacementDraft = (siteId: string, value: string) => {
        setSitePlacementDrafts((current) => ({
            ...current,
            [siteId]: value,
        }));
        setSitePlacementErrors((current) => {
            if (!current[siteId]) return current;
            const next = { ...current };
            delete next[siteId];
            return next;
        });
    };

    const placeSite = async (siteId: string) => {
        const site = topology.sites.find((candidate) => candidate.id === siteId);
        const draft = sitePlacementDrafts[siteId]?.trim() ?? '';
        const fallbackName =
            site && !looksLikeGeneratedSiteName(site.name) ? site.name.trim() : '';
        const lookupText = draft || fallbackName;

        if (!lookupText) {
            setSitePlacementErrors((current) => ({
                ...current,
                [siteId]:
                    'Enter a city, address, or coordinates. Renamed sites can be placed by name too.',
            }));
            return;
        }

        setPlacingSiteIds((current) => ({ ...current, [siteId]: true }));
        const placement = await resolveSitePlacementWithFallback(lookupText);
        setPlacingSiteIds((current) => {
            const next = { ...current };
            delete next[siteId];
            return next;
        });
        if (!placement) {
            setSitePlacementErrors((current) => ({
                ...current,
                [siteId]:
                    'Could not place that location. Try a city, address, or coordinates like 48.8566,2.3522.',
            }));
            return;
        }

        onPickSite(null);
        onTopologyChange((current) => {
            const nextSites = current.sites.map((site) => {
                if (site.id !== siteId) return site;
                return {
                    ...site,
                    name: looksLikeGeneratedSiteName(site.name)
                        ? placement.name
                        : site.name,
                    shortName: looksLikeGeneratedShortName(site.shortName)
                        ? placement.shortName
                        : site.shortName,
                    lat: Number(placement.lat.toFixed(5)),
                    lng: Number(placement.lng.toFixed(5)),
                };
            });
            return {
                ...current,
                map: expandMapForPlacement(current.map, nextSites, placement),
                sites: nextSites,
            };
        });
        setSitePlacementErrors((current) => {
            if (!current[siteId]) return current;
            const next = { ...current };
            delete next[siteId];
            return next;
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

    const bindThousandEyesA2A = (
        linkId: string,
        candidate: ThousandEyesA2ACandidate
    ) => {
        updateLink(linkId, {
            thousandEyesA2A: teBindingFromCandidate(candidate),
            searchName: '',
            teLink: candidate.teLink,
            telemetrySource: `ThousandEyes A2A binding: ${formatTeCandidateLabel(candidate)}`,
            dataState: 'loading',
            dataError: undefined,
        });
    };

    const clearThousandEyesA2A = (linkId: string) => {
        updateLink(linkId, {
            thousandEyesA2A: undefined,
            teLink: undefined,
            dataState: 'static',
            dataError: undefined,
            telemetrySource: 'Awaiting topology link telemetry',
        });
    };

    const updateLinkEndpoints = (
        link: TopologyLink,
        patch: Pick<Partial<TopologyLink>, 'sourceSiteId' | 'targetSiteId'>
    ) => {
        let sourceSiteId = patch.sourceSiteId ?? link.sourceSiteId;
        let targetSiteId = patch.targetSiteId ?? link.targetSiteId;

        if (sourceSiteId === targetSiteId) {
            const alternate = topology.sites.find((site) => site.id !== sourceSiteId);
            if (!alternate) return;
            if (patch.sourceSiteId) {
                targetSiteId = alternate.id;
            } else {
                sourceSiteId = alternate.id;
            }
        }

        updateLink(link.id, {
            sourceSiteId,
            targetSiteId,
            name: linkHasGeneratedName(link)
                ? linkNameForEndpoints(sourceSiteId, targetSiteId)
                : link.name,
        });
    };

    const addLink = () => {
        if (topology.sites.length < 2) return;

        const current = topology;
        const existingPairs = new Set(
            current.links.map((link) =>
                topologyLinkEndpointKey(link.sourceSiteId, link.targetSiteId)
            )
        );
        const preferredSource =
            (pickSiteId && current.sites.find((site) => site.id === pickSiteId)) ||
            current.sites[0];
        let source = preferredSource;
        let target =
            current.sites.find(
                (site) =>
                    site.id !== source.id &&
                    !existingPairs.has(topologyLinkEndpointKey(source.id, site.id))
            ) || current.sites.find((site) => site.id !== source.id);

        if (!target) return;

        if (existingPairs.has(topologyLinkEndpointKey(source.id, target.id))) {
            for (const candidateSource of current.sites) {
                const candidateTarget = current.sites.find(
                    (site) =>
                        site.id !== candidateSource.id &&
                        !existingPairs.has(
                            topologyLinkEndpointKey(candidateSource.id, site.id)
                        )
                );
                if (candidateTarget) {
                    source = candidateSource;
                    target = candidateTarget;
                    break;
                }
            }
        }

        const used = new Set(current.links.map((link) => link.id));
        const id = uniqueId(`${source.id}-${target.id}`, used);
        const newLink: TopologyLink = {
            id,
            name: `${source.name} to ${target.name}`,
            sourceSiteId: source.id,
            targetSiteId: target.id,
            status: 'unknown',
            telemetrySource: 'Awaiting topology link telemetry',
        };

        onTopologyChange((latest) => {
            const existingPairs = new Set(
                latest.links.map((link) =>
                    topologyLinkEndpointKey(link.sourceSiteId, link.targetSiteId)
                )
            );
            if (existingPairs.has(topologyLinkEndpointKey(source.id, target.id))) {
                return latest;
            }
            return {
                ...latest,
                links: [...latest.links, newLink],
            };
        });

        setExpandedCardKeys((current) => {
            const next = new Set(current);
            next.add(`link:${id}`);
            return next;
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
                            <div className="flex items-center justify-end">
                                <button
                                    type="button"
                                    onClick={onApplyCurrentMapView}
                                    title={`Copy current map view: ${currentMapView.center[0]}, ${currentMapView.center[1]} at zoom ${currentMapView.zoom}`}
                                    className={cn(
                                        'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-black uppercase tracking-wider transition-colors focus:outline-none focus:ring-1 focus:ring-sky-400',
                                        isDark
                                            ? 'border-sky-500/40 bg-sky-500/10 text-sky-200 hover:bg-sky-500/20'
                                            : 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100'
                                    )}
                                >
                                    <Crosshair className="h-3.5 w-3.5" />
                                    Use current view
                                </button>
                            </div>
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
                                    const searchCardKey = `site-search:${site.id}`;
                                    const isSearchPickerOpen =
                                        expandedCardKeys.has(searchCardKey);
                                    const shouldShowSearchPicker =
                                        isSearchPickerOpen || !boundSearch;
                                    const isPlacingSite = Boolean(
                                        placingSiteIds[site.id]
                                    );
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
                                                    'flex items-center gap-2 flex-shrink-0 text-left rounded transition-colors focus:outline-none focus:ring-1 focus:ring-sky-400'
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
                                            </button>
                                            <div className="min-w-0 flex-1">
                                                <input
                                                    aria-label={`Rename site ${site.id}`}
                                                    className={cn(
                                                        'w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-[11px] font-semibold outline-none transition-colors focus:border-sky-400 focus:bg-white focus:ring-1 focus:ring-sky-400',
                                                        isDark
                                                            ? 'text-slate-100 focus:bg-slate-950'
                                                            : 'text-slate-800'
                                                    )}
                                                    value={site.name}
                                                    onChange={(event) =>
                                                        updateSite(site.id, {
                                                            name: event.target.value,
                                                        })
                                                    }
                                                />
                                                <div className="flex min-w-0 items-center gap-1 px-1 text-[10px]">
                                                    <span
                                                        className="max-w-[5rem] truncate font-mono uppercase text-slate-400"
                                                        title={`Internal ID: ${site.id}`}
                                                    >
                                                        {site.id}
                                                    </span>
                                                    <span className="text-slate-400">
                                                        ·
                                                    </span>
                                                    <span
                                                        className={editorBindingSummaryClass(
                                                            isDark,
                                                            Boolean(boundSearch)
                                                        )}
                                                        title={
                                                            boundSearch ||
                                                            'No search bound'
                                                        }
                                                    >
                                                        {boundSearch ||
                                                            'No search bound'}
                                                    </span>
                                                </div>
                                            </div>
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
                                                                ? `Open this search in Search to test it`
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
                                        <div className="pt-2 space-y-1">
                                            <span
                                                className={cn(
                                                    editorLabelClass,
                                                    isDark
                                                        ? 'text-slate-500'
                                                        : 'text-slate-400'
                                                )}
                                            >
                                                Place on map
                                            </span>
                                            <div className="flex items-stretch gap-1">
                                                <input
                                                    aria-label={`Place site ${site.id}`}
                                                    className={editorInputClass(isDark)}
                                                    value={
                                                        sitePlacementDrafts[site.id] ??
                                                        ''
                                                    }
                                                    placeholder="City, address, or 48.8566,2.3522"
                                                    onChange={(event) =>
                                                        updateSitePlacementDraft(
                                                            site.id,
                                                            event.target.value
                                                        )
                                                    }
                                                    onKeyDown={(event) => {
                                                        if (event.key === 'Enter') {
                                                            event.preventDefault();
                                                            void placeSite(site.id);
                                                        }
                                                    }}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => void placeSite(site.id)}
                                                    disabled={isPlacingSite}
                                                    className={cn(
                                                        'inline-flex items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-[10px] font-black uppercase tracking-wider transition-colors focus:outline-none focus:ring-1 focus:ring-sky-400 disabled:cursor-wait disabled:opacity-60',
                                                        isDark
                                                            ? 'border-sky-500/50 bg-sky-500/20 text-sky-200 hover:bg-sky-500/30'
                                                            : 'border-sky-300 bg-sky-100 text-sky-800 hover:bg-sky-200'
                                                    )}
                                                >
                                                    {isPlacingSite && (
                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                    )}
                                                    {isPlacingSite ? 'Placing' : 'Place'}
                                                </button>
                                            </div>
                                            {sitePlacementErrors[site.id] && (
                                                <span className="block text-[9px] font-semibold text-red-500">
                                                    {sitePlacementErrors[site.id]}
                                                </span>
                                            )}
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
                                                    value={String(site.role)}
                                                    onChange={(event) =>
                                                        updateSite(site.id, {
                                                            role: normalizeTopologyRoleInput(
                                                                event.target.value,
                                                                'branch'
                                                            ),
                                                        })
                                                    }
                                                >
                                                    {TOPOLOGY_ROLES.map((role) => (
                                                        <option
                                                            key={role}
                                                            value={role}
                                                        >
                                                            {ROLE_LABEL[role]}
                                                        </option>
                                                    ))}
                                                    {!isKnownTopologyRole(site.role) && (
                                                        <option value={String(site.role)}>
                                                            {topologyRoleLabel(site.role)}
                                                        </option>
                                                    )}
                                                </select>
                                            </label>
                                            <label className="space-y-1">
                                                <span
                                                    title={TOPOLOGY_STATUS_FIELD_HELP}
                                                    className={cn(
                                                        editorLabelClass,
                                                        'cursor-help',
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
                                                Matching aliases
                                            </span>
                                            <input
                                                className={editorInputClass(isDark)}
                                                value={(site.aliases ?? []).join(', ')}
                                                placeholder="AUB, Tallahassee EOC, facility code"
                                                onChange={(event) => {
                                                    const aliases = optionalTextArray(
                                                        event.target.value
                                                    );
                                                    updateSite(site.id, {
                                                        aliases:
                                                            aliases.length > 0
                                                                ? aliases
                                                                : undefined,
                                                    });
                                                }}
                                            />
                                        </label>
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
                                        <div
                                            className={cn(
                                                'rounded-md border px-2.5 py-2',
                                                isDark
                                                    ? 'border-slate-800 bg-slate-950/50'
                                                    : 'border-slate-200 bg-white'
                                            )}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <span
                                                        className={cn(
                                                            editorLabelClass,
                                                            isDark
                                                                ? 'text-slate-500'
                                                                : 'text-slate-400'
                                                        )}
                                                    >
                                                        Search binding
                                                    </span>
                                                    <div
                                                        className={cn(
                                                            'mt-1 truncate text-[11px] font-semibold',
                                                            isDark
                                                                ? boundSearch
                                                                    ? 'text-slate-200'
                                                                    : 'text-slate-500'
                                                                : boundSearch
                                                                ? 'text-slate-700'
                                                                : 'text-slate-400'
                                                        )}
                                                        title={
                                                            boundSearch ||
                                                            'No search bound'
                                                        }
                                                    >
                                                        {boundSearch ||
                                                            'No search bound'}
                                                    </div>
                                                </div>
                                                {boundSearch && (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            toggleCardExpanded(
                                                                searchCardKey
                                                            )
                                                        }
                                                        aria-expanded={
                                                            shouldShowSearchPicker
                                                        }
                                                        className={cn(
                                                            'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[9px] font-black uppercase tracking-wider transition-colors focus:outline-none focus:ring-1 focus:ring-sky-400',
                                                            isDark
                                                                ? 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
                                                                : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                                                        )}
                                                    >
                                                        {shouldShowSearchPicker
                                                            ? 'Hide'
                                                            : 'Change'}
                                                    </button>
                                                )}
                                            </div>
                                            {shouldShowSearchPicker && (
                                                <div className="mt-2">
                                                    <TopologySearchBrowser
                                                        catalogue={
                                                            editorSearchOptions
                                                        }
                                                        currentSearchName={
                                                            site.searchName ?? ''
                                                        }
                                                        preferredTags={[
                                                            'Topology_Site',
                                                        ]}
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
                                            )}
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
                                    Links
                                </h4>
                                <button
                                    type="button"
                                    onClick={addLink}
                                    disabled={topology.sites.length < 2}
                                    title="Add connection"
                                    className="inline-flex items-center gap-1 rounded-md bg-sky-500 px-2 py-1 text-[10px] font-black text-white hover:bg-sky-600 disabled:opacity-40 disabled:hover:bg-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-300"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    Add connection
                                </button>
                            </div>
                            <div className="space-y-2">
                                {topology.links.map((link) => {
                                    const cardKey = `link:${link.id}`;
                                    const isExpanded =
                                        expandedCardKeys.has(cardKey);
                                    const boundSearch =
                                        link.searchName?.trim() || '';
                                    const searchCardKey = `link-search:${link.id}`;
                                    const isSearchPickerOpen =
                                        expandedCardKeys.has(searchCardKey);
                                    const sourceSite = editorSiteById[link.sourceSiteId];
                                    const targetSite = editorSiteById[link.targetSiteId];
                                    const endpointSummary = `${
                                        sourceSite?.shortName ?? link.sourceSiteId
                                    } to ${
                                        targetSite?.shortName ?? link.targetSiteId
                                    }`;
                                    const teMatches = teA2ACandidates
                                        ? rankTeCandidatesForLink(
                                              link,
                                              sourceSite,
                                              targetSite,
                                              teA2ACandidates
                                          )
                                        : [];
                                    const boundTeMatch = teMatches.find(
                                        (match) => match.exact
                                    );
                                    const selectedTeCandidateId =
                                        boundTeMatch?.candidate.candidateId ??
                                        link.thousandEyesA2A?.candidateId ??
                                        '';
                                    const hasTeBinding = Boolean(link.thousandEyesA2A);
                                    const bindingSummary =
                                        boundSearch ||
                                        (hasTeBinding
                                            ? formatTeBindingSummary(
                                                  link.thousandEyesA2A,
                                                  boundTeMatch?.candidate
                                              )
                                            : '');
                                    const teLink =
                                        boundTeMatch?.candidate.teLink ??
                                        link.teLink ??
                                        buildThousandEyesPathLink(
                                            link.thousandEyesA2A?.teAccountId,
                                            link.thousandEyesA2A?.teTestId
                                        );
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
                                                className="flex items-center gap-2 flex-shrink-0 text-left rounded transition-colors focus:outline-none focus:ring-1 focus:ring-sky-400"
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
                                            </button>
                                            <div className="min-w-0 flex-1">
                                                <input
                                                    aria-label={`Rename link ${link.id}`}
                                                    className={cn(
                                                        'w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-[11px] font-semibold outline-none transition-colors focus:border-sky-400 focus:bg-white focus:ring-1 focus:ring-sky-400',
                                                        isDark
                                                            ? 'text-slate-100 focus:bg-slate-950'
                                                            : 'text-slate-800'
                                                    )}
                                                    value={link.name}
                                                    onChange={(event) =>
                                                        updateLink(link.id, {
                                                            name: event.target.value,
                                                        })
                                                    }
                                                />
                                                <div className="flex min-w-0 items-center gap-1 px-1 text-[10px]">
                                                    <span
                                                        className="max-w-[5rem] truncate font-mono uppercase text-slate-400"
                                                        title={`Internal ID: ${link.id}`}
                                                    >
                                                        {endpointSummary}
                                                    </span>
                                                    <span className="text-slate-400">
                                                        ·
                                                    </span>
                                                    <span
                                                        className={editorBindingSummaryClass(
                                                            isDark,
                                                            Boolean(bindingSummary)
                                                        )}
                                                        title={
                                                            bindingSummary ||
                                                            'No search bound'
                                                        }
                                                    >
                                                        {bindingSummary ||
                                                            'No search bound'}
                                                    </span>
                                                </div>
                                            </div>
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
                                                                ? 'Open this search in Search to test it'
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
                                        <div
                                            className={cn(
                                                'mt-2 rounded-md border p-2',
                                                isDark
                                                    ? 'border-slate-800 bg-slate-950/50'
                                                    : 'border-slate-200 bg-white'
                                            )}
                                        >
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
                                                        From
                                                    </span>
                                                    <select
                                                        aria-label={`Source site for link ${link.id}`}
                                                        className={editorInputClass(isDark)}
                                                        value={link.sourceSiteId}
                                                        onChange={(event) =>
                                                            updateLinkEndpoints(link, {
                                                                sourceSiteId:
                                                                    event.target.value,
                                                            })
                                                        }
                                                    >
                                                        {topology.sites.map((site) => (
                                                            <option
                                                                key={site.id}
                                                                value={site.id}
                                                                disabled={
                                                                    site.id ===
                                                                    link.targetSiteId
                                                                }
                                                            >
                                                                {topologySiteOptionLabel(
                                                                    site
                                                                )}
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
                                                        To
                                                    </span>
                                                    <select
                                                        aria-label={`Target site for link ${link.id}`}
                                                        className={editorInputClass(isDark)}
                                                        value={link.targetSiteId}
                                                        onChange={(event) =>
                                                            updateLinkEndpoints(link, {
                                                                targetSiteId:
                                                                    event.target.value,
                                                            })
                                                        }
                                                    >
                                                        {topology.sites.map((site) => (
                                                            <option
                                                                key={site.id}
                                                                value={site.id}
                                                                disabled={
                                                                    site.id ===
                                                                    link.sourceSiteId
                                                                }
                                                            >
                                                                {topologySiteOptionLabel(
                                                                    site
                                                                )}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </label>
                                            </div>
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
                                                    title={TOPOLOGY_STATUS_FIELD_HELP}
                                                    className={cn(
                                                        editorLabelClass,
                                                        'cursor-help',
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
                                        <div
                                            className={cn(
                                                'rounded-md border px-2.5 py-2',
                                                isDark
                                                    ? 'border-slate-800 bg-slate-950/50'
                                                    : 'border-slate-200 bg-white'
                                            )}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <span
                                                        className={cn(
                                                            editorLabelClass,
                                                            isDark
                                                                ? 'text-slate-500'
                                                                : 'text-slate-400'
                                                        )}
                                                    >
                                                        ThousandEyes A2A
                                                    </span>
                                                    <div
                                                        className={cn(
                                                            'mt-1 truncate text-[11px] font-semibold',
                                                            isDark
                                                                ? hasTeBinding
                                                                    ? 'text-slate-200'
                                                                    : 'text-slate-500'
                                                                : hasTeBinding
                                                                ? 'text-slate-700'
                                                                : 'text-slate-400'
                                                        )}
                                                        title={formatTeBindingSummary(
                                                            link.thousandEyesA2A,
                                                            boundTeMatch?.candidate
                                                        )}
                                                    >
                                                        {formatTeBindingSummary(
                                                            link.thousandEyesA2A,
                                                            boundTeMatch?.candidate
                                                        )}
                                                    </div>
                                                    {teA2AInventoryError && (
                                                        <p
                                                            className="mt-1 truncate text-[9px] font-semibold text-red-500"
                                                            title={teA2AInventoryError}
                                                        >
                                                            {teA2AInventoryError}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="flex flex-shrink-0 items-center gap-1">
                                                    {teLink && (
                                                        <a
                                                            href={teLink}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            title="Open ThousandEyes path view"
                                                            className={cn(
                                                                'p-1.5 rounded-md transition-colors focus:outline-none focus:ring-1 focus:ring-sky-400',
                                                                isDark
                                                                    ? 'bg-slate-800 text-sky-300 hover:bg-sky-950/70'
                                                                    : 'bg-slate-50 text-sky-700 hover:bg-sky-100'
                                                            )}
                                                        >
                                                            <ExternalLink className="w-3.5 h-3.5" />
                                                        </a>
                                                    )}
                                                    {hasTeBinding && (
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                clearThousandEyesA2A(
                                                                    link.id
                                                                )
                                                            }
                                                            title="Clear ThousandEyes binding"
                                                            className={cn(
                                                                'p-1.5 rounded-md transition-colors focus:outline-none focus:ring-1 focus:ring-red-400',
                                                                isDark
                                                                    ? 'bg-slate-800 text-red-300 hover:bg-red-950/70'
                                                                    : 'bg-red-50 text-red-600 hover:bg-red-100'
                                                            )}
                                                        >
                                                            <X className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="mt-2">
                                                <select
                                                    aria-label={`ThousandEyes A2A binding for link ${link.id}`}
                                                    className={editorInputClass(isDark)}
                                                    value={selectedTeCandidateId}
                                                    disabled={
                                                        teA2ACandidates === null ||
                                                        teMatches.length === 0
                                                    }
                                                    onChange={(event) => {
                                                        const candidate =
                                                            teA2ACandidates?.find(
                                                                (item) =>
                                                                    item.candidateId ===
                                                                    event.target.value
                                                            );
                                                        if (candidate) {
                                                            bindThousandEyesA2A(
                                                                link.id,
                                                                candidate
                                                            );
                                                        }
                                                    }}
                                                >
                                                    <option value="">
                                                        {teA2ACandidates === null
                                                            ? 'Loading A2A tests'
                                                            : teMatches.length === 0
                                                            ? 'No A2A tests observed'
                                                            : 'Select A2A test'}
                                                    </option>
                                                    {teMatches.slice(0, 30).map(
                                                        (match) => (
                                                            <option
                                                                key={
                                                                    match.candidate
                                                                        .candidateId
                                                                }
                                                                value={
                                                                    match.candidate
                                                                        .candidateId
                                                                }
                                                            >
                                                                {match.exact
                                                                    ? 'Bound'
                                                                    : match.confidence >=
                                                                      TE_A2A_MATCH_THRESHOLD
                                                                    ? 'Suggested'
                                                                    : `${match.confidence}%`}
                                                                {' - '}
                                                                {formatTeCandidateLabel(
                                                                    match.candidate
                                                                )}
                                                            </option>
                                                        )
                                                    )}
                                                </select>
                                                {teMatches[0]?.ambiguous && (
                                                    <p
                                                        className={cn(
                                                            'mt-1 text-[9px] font-semibold',
                                                            isDark
                                                                ? 'text-amber-300'
                                                                : 'text-amber-700'
                                                        )}
                                                    >
                                                        Multiple close A2A matches found
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div
                                            className={cn(
                                                'rounded-md border px-2.5 py-2',
                                                isDark
                                                    ? 'border-slate-800 bg-slate-950/50'
                                                    : 'border-slate-200 bg-white'
                                            )}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <span
                                                        className={cn(
                                                            editorLabelClass,
                                                            isDark
                                                                ? 'text-slate-500'
                                                                : 'text-slate-400'
                                                        )}
                                                    >
                                                        Search binding
                                                    </span>
                                                    <div
                                                        className={cn(
                                                            'mt-1 truncate text-[11px] font-semibold',
                                                            isDark
                                                                ? boundSearch
                                                                    ? 'text-slate-200'
                                                                    : 'text-slate-500'
                                                                : boundSearch
                                                                ? 'text-slate-700'
                                                                : 'text-slate-400'
                                                        )}
                                                        title={
                                                            boundSearch ||
                                                            'No search bound'
                                                        }
                                                    >
                                                        {boundSearch ||
                                                            'No search bound'}
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        toggleCardExpanded(
                                                            searchCardKey
                                                        )
                                                    }
                                                    aria-expanded={isSearchPickerOpen}
                                                    className={cn(
                                                        'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[9px] font-black uppercase tracking-wider transition-colors focus:outline-none focus:ring-1 focus:ring-sky-400',
                                                        isDark
                                                            ? 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
                                                            : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                                                    )}
                                                >
                                                    {isSearchPickerOpen
                                                        ? 'Hide'
                                                        : boundSearch
                                                        ? 'Change'
                                                        : 'Pick search'}
                                                </button>
                                            </div>
                                            {isSearchPickerOpen && (
                                                <div className="mt-2">
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
                                                                thousandEyesA2A:
                                                                    undefined,
                                                                dataState: 'loading',
                                                            })
                                                        }
                                                        isDark={isDark}
                                                        showFreeFormInput
                                                    />
                                                </div>
                                            )}
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
                        <div className="min-w-0 flex-1">
                            {saveError && (
                                <p className="truncate text-[10px] font-semibold text-red-500" title={saveError}>
                                    {saveError}
                                </p>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={onResetFactory}
                            disabled={isSaving}
                            className={cn(
                                'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[10px] font-black transition-colors focus:outline-none focus:ring-1 focus:ring-red-400',
                                isSaving
                                    ? 'cursor-not-allowed opacity-50'
                                    : isDark
                                    ? 'bg-slate-900 text-red-300 hover:bg-red-950/70'
                                    : 'bg-red-50 text-red-600 hover:bg-red-100'
                            )}
                        >
                            {isSaving ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                                <RotateCcw className="w-3.5 h-3.5" />
                            )}
                            Factory
                        </button>
                        <button
                            type="button"
                            onClick={onSave}
                            disabled={isSaving}
                            className={cn(
                                'inline-flex items-center gap-1.5 rounded-md bg-sky-500 px-3 py-1.5 text-[10px] font-black text-white hover:bg-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-300',
                                isSaving && 'cursor-not-allowed opacity-60'
                            )}
                        >
                            {isSaving ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                                <Save className="w-3.5 h-3.5" />
                            )}
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
    onSelectLink?: (link: TopologyLink) => void;
}

const SiteDetails: React.FC<SiteDetailsProps> = ({
    site,
    links,
    isDark,
    enrichment,
    onSelectLink,
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

    // Build 103 (2026-05-14): mirror the link-popup loading-state
    // treatment for sites — when the per-site saved search is in
    // flight the metric pills should read "Loading…" instead of
    // "Awaiting" so operators can tell "search dispatched" from
    // "no integration wired."
    const isSiteLoading = site.dataState === 'loading';
    return (
        <>
            <div className="grid grid-cols-3 gap-2">
                <MetricPill
                    label="Health"
                    value={formatPercent(site.metrics.healthPct, isSiteLoading)}
                    isDark={isDark}
                />
                <MetricPill
                    label="Devices"
                    value={formatNumber(site.metrics.activeDevices, isSiteLoading)}
                    isDark={isDark}
                />
                <MetricPill
                    label="Alerts"
                    value={formatNumber(site.metrics.alerts, isSiteLoading)}
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
                {/* Build 103 (2026-05-14): inline spinner on the
                    sub-line when in flight, so the loading state has
                    a visual affordance not just textual. Mirrors the
                    treatment in the link-popup TELEMETRY SOURCE
                    block above. */}
                <p className="flex items-center gap-1 text-[9px] text-slate-500 leading-relaxed">
                    {site.dataState === 'loading' && (
                        <Loader2
                            className="w-2.5 h-2.5 animate-spin flex-shrink-0"
                            aria-hidden="true"
                        />
                    )}
                    <span>
                        {site.dataState === 'live'
                            ? 'Live searchbase result'
                            : site.dataState === 'loading'
                            ? 'Loading searchbase result'
                            : site.dataState === 'error'
                            ? 'Searchbase result unavailable'
                            : 'Configured value'}
                        {site.lastUpdated
                            ? ` - Updated ${site.lastUpdated}`
                            : ''}
                        {site.dataState === 'error' && site.dataError
                            ? ` - ${site.dataError}`
                            : ''}
                    </span>
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
                            <button
                                type="button"
                                key={link.id}
                                onClick={() => onSelectLink?.(link)}
                                className={cn(
                                    'flex w-full items-center justify-between gap-2 rounded border px-2 py-1 text-left transition-colors focus:outline-none focus:ring-1 focus:ring-sky-400',
                                    isDark
                                        ? 'bg-white/5 border-white/5 hover:bg-white/10'
                                        : 'bg-white border-slate-200 hover:bg-sky-50'
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
                            </button>
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
    // Build 103 (2026-05-14): pass `dataState === 'loading'` to every
    // formatter so undefined values render as 'Loading…' instead of
    // 'Awaiting' while the bound saved search is still in flight.
    // Without this, the popup looks identical during a slow search
    // (the TE A2A scan can take 20-40s on a cold cache) and the
    // "no integration wired" case — Alan misread the in-flight
    // state as a removal regression on 2026-05-14.
    const isLoading = link.dataState === 'loading';
    return (
        <>
            <div className="grid grid-cols-2 gap-2">
                <MetricPill
                    label="Capacity"
                    value={formatMbps(link.capacityMbps, isLoading)}
                    isDark={isDark}
                />
                <MetricPill
                    label="Throughput"
                    value={formatMbps(link.throughputMbps, isLoading)}
                    isDark={isDark}
                />
                <MetricPill
                    label="Peak Throughput"
                    value={formatMbps(link.peakThroughputMbps, isLoading)}
                    isDark={isDark}
                />
                <MetricPill
                    label="Utilization"
                    value={formatPercent(link.utilizationPct, isLoading)}
                    isDark={isDark}
                />
                <MetricPill
                    label="Peak Utilization"
                    value={formatPercent(link.peakUtilizationPct, isLoading)}
                    isDark={isDark}
                />
                <MetricPill
                    label="Latency"
                    value={formatLatency(link.latencyMs, isLoading)}
                    isDark={isDark}
                />
                <MetricPill
                    label="Loss"
                    value={formatPercent(link.lossPct, isLoading)}
                    isDark={isDark}
                />
                <MetricPill
                    label="Jitter"
                    value={formatLatency(link.jitterMs, isLoading)}
                    isDark={isDark}
                />
                <MetricPill
                    label="Endpoint Health"
                    value={formatPercent(link.endpointHealthPct, isLoading)}
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
                {/* Build 103 (2026-05-14): visible loading affordance.
                    During the saved-search round trip the link's
                    `dataState` is `'loading'` for 20-40s on a cold
                    cache (the TE A2A SPL scans raw events with
                    13+ stats aggregations — see the
                    `[overview_link_te_a2a_health]` stanza explanation
                    for the perf trade-off). Pre-Build-103 the popup
                    rendered the static OOB `telemetrySource` text
                    ("Awaiting topology link telemetry") during that
                    window, which is identical to the genuinely-not-
                    wired case. Alan misread that as a regression on
                    2026-05-14 ("you accidently removed the integration
                    with ThousandEyes!"). The real fix has two halves:
                    (1) make the in-flight state visually distinct from
                    "no integration" via this spinner + descriptive
                    copy, and (2) tighten the SPL's time scope in
                    Build 103-B so the cold-cache window is shorter
                    in the first place. */}
                {link.dataState === 'loading' ? (
                    <p
                        className={cn(
                            'flex items-center gap-1.5 text-[10px] leading-relaxed',
                            isDark ? 'text-slate-400' : 'text-slate-500'
                        )}
                    >
                        <Loader2
                            className="w-3 h-3 animate-spin flex-shrink-0"
                            aria-hidden="true"
                        />
                        <span>
                            Querying ThousandEyes A2A test data&hellip;{' '}
                            <span
                                className={cn(
                                    'italic',
                                    isDark ? 'text-slate-500' : 'text-slate-400'
                                )}
                            >
                                first run can take 20-40s while Splunk warms
                                the cache
                            </span>
                        </span>
                    </p>
                ) : (
                    <p
                        className={cn(
                            'text-[10px] leading-relaxed',
                            isDark ? 'text-slate-300' : 'text-slate-700'
                        )}
                    >
                        {link.telemetrySource}
                    </p>
                )}
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
                {/* Build 102 (2026-05-14): TE agent-location row
                    restored. Build 98 dropped this entire row to
                    resolve a customer-site mismatch ("why is it
                    saying Orlando instead of Auburndale?"), but
                    Alan flagged the removal as a regression on
                    review — the row was the visible proof inside
                    the popup that ThousandEyes A2A data is
                    actually reaching the dashboard. Without it the
                    TELEMETRY SOURCE block reads as "thinly wired"
                    even when the integration is healthy.
                    Compromise: bring the row back, but lead with
                    "TE agents at:" so it reads unambiguously as
                    the TE-registered agent geography rather than
                    as a competing claim about the link's
                    endpoints. The customer-site row immediately
                    below ("Auburndale (Logistics) to Tallahassee
                    (State EOC)") stays as ground truth on what
                    the link actually represents. The Orlando-vs-
                    Auburndale mismatch is now clearly attributable
                    to TE agent registration (the AUB-side agent
                    `dema-te01-va` is registered to the Orlando
                    metro in TE because TE aggregates by metro), so
                    operators see WHY the geo string reads
                    "Orlando" rather than wondering if the dashboard
                    is broken. */}
                {(link.sourceLocation || link.targetLocation) && (
                    <p
                        className={cn(
                            'text-[9px] leading-relaxed',
                            isDark ? 'text-slate-400' : 'text-slate-600'
                        )}
                        title="The TE-registered geographic location of each measuring agent (which can differ from the customer site name when TE aggregates agents by metro). The customer site name is shown on the row below."
                    >
                        <span
                            className={cn(
                                'font-semibold',
                                isDark ? 'text-slate-500' : 'text-slate-500'
                            )}
                        >
                            TE agents at:
                        </span>{' '}
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
                                    {topologyRoleLabel(site.role)}
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
