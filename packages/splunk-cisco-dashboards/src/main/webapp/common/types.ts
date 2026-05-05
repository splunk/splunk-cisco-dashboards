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
    /**
     * searchbase.conf `search_name` used for the SPL preview and drilldown.
     */
    searchName?: string;
}

export interface TopologyLink {
    id: string;
    name: string;
    sourceSiteId: string;
    targetSiteId: string;
    status: TopologyStatus;
    capacityMbps?: number;
    throughputMbps?: number;
    utilizationPct?: number;
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
