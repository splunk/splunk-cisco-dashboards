export interface City {
    id: string;
    name: string;
    lat: number;
    lng: number;
    status: 'critical' | 'warning' | 'stable';
    importance: 'primary' | 'secondary';
    metrics: {
        events: number;
        alerts: number;
        latency: number;
    };
    /**
     * searchbase.conf `search_name` that powers the "Active SPL Query"
     * preview card and the "Open in Splunk Search" drilldown for this
     * site.
     */
    savedSearch: string;
}

export interface SearchResult {
    timestamp: string;
    city: string;
    query: string;
    results: number;
}

export type TopologyStatus = 'critical' | 'warning' | 'stable' | 'unknown';

export type TopologyRole =
    | 'state_hq'
    | 'regional_hub'
    | 'logistics'
    | 'branch'
    | 'datacenter'
    | 'internet_edge';

export interface TopologySite {
    id: string;
    name: string;
    shortName: string;
    role: TopologyRole;
    lat: number;
    lng: number;
    status: TopologyStatus;
    metrics: {
        activeDevices?: number;
        alerts?: number;
        healthPct?: number;
        latencyMs?: number;
    };
    lastUpdated?: string;
    dataState?: 'static' | 'loading' | 'live' | 'error';
    dataError?: string;
    telemetrySource?: string;
    /**
     * searchbase.conf `search_name` used for the SPL preview and drilldown.
     */
    searchName?: string;
    /**
     * Customer-entered design-of-record Internet edge bandwidth for the site,
     * in Mbps. Set through the topology editor (pencil-tool → site → "Internet
     * edge Mbps") and persisted in the customer-topology localStorage payload.
     * Defaults to undefined; the popup hides the "Design of Record" line until
     * a value is entered, and SPL stanzas should treat undefined as "awaiting
     * circuit info" rather than fabricating a denominator. When per-site
     * Internet uplink telemetry becomes available (e.g. ThousandEyes Internet
     * Insights or a NetFlow uplink rollup) the live source should override
     * this customer-entered value, mirroring how live link telemetry overrides
     * the design-of-record capacity in the link stanzas.
     */
    internetEdgeMbps?: number;
}

export interface TopologyLink {
    id: string;
    name: string;
    sourceSiteId: string;
    targetSiteId: string;
    status: TopologyStatus;
    capacityMbps?: number;
    throughputMbps?: number;
    peakThroughputMbps?: number;
    utilizationPct?: number;
    peakUtilizationPct?: number;
    latencyMs?: number;
    lossPct?: number;
    endpointHealthPct?: number;
    endpointDevices?: number;
    lastUpdated?: string;
    dataState?: 'static' | 'loading' | 'live' | 'error';
    dataError?: string;
    /**
     * Human-readable telemetry source. Examples: Catalyst Center interfaces,
     * ThousandEyes, SD-WAN, NetFlow, or placeholder until wired.
     */
    telemetrySource: string;
    searchName?: string;
}

export interface CustomerTopology {
    id: string;
    name: string;
    subtitle: string;
    /**
     * Optional searchbase.conf `search_name` that can return normalized
     * topology rows for all sites, links, and map-adjacent summary cards.
     */
    telemetrySearchName?: string;
    map: {
        center: [number, number];
        zoom: number;
        minZoom: number;
        maxZoom: number;
        bounds: [[number, number], [number, number]];
    };
    sites: TopologySite[];
    links: TopologyLink[];
}
