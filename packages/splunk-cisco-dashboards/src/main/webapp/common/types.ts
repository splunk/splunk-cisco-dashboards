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

export type KnownTopologyRole =
    | 'state_hq'
    | 'regional_hub'
    | 'logistics'
    | 'branch'
    | 'datacenter'
    | 'internet_edge'
    | 'campus'
    | 'office'
    | 'event_venue'
    | 'cisco_live'
    | 'lab'
    | 'cloud_region';

export type TopologyRole = KnownTopologyRole | (string & {});

export interface ThousandEyesA2ABinding {
    candidateId?: string;
    teAccountId?: string;
    teTestId?: string;
    teTestName?: string;
    sourceAgent?: string;
    targetAgent?: string;
    sourceLocation?: string;
    targetLocation?: string;
}

export interface TopologySite {
    id: string;
    name: string;
    shortName: string;
    aliases?: string[];
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
     * in Mbps. Set through the topology editor (pencil-tool -> site ->
     * "Internet edge Mbps") and persisted in customer_topology.conf so every
     * user sees the same value. Defaults to undefined; the popup hides the
     * "Design of Record" line until a value is entered, and SPL stanzas should
     * treat undefined as "awaiting circuit info" rather than fabricating a
     * denominator. When per-site Internet uplink telemetry becomes available
     * (e.g. ThousandEyes Internet Insights or a NetFlow uplink rollup) the
     * live source should override this customer-entered value, mirroring how
     * live link telemetry overrides the design-of-record capacity in the link
     * stanzas.
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
    /**
     * Path jitter in milliseconds (variation in inter-packet arrival time).
     * Populated when the link's telemetry source is ThousandEyes
     * agent-to-agent — SD-WAN linkhealth and Catalyst Center fallback do
     * not measure jitter. See `[overview_link_*]` searchbase stanzas.
     */
    jitterMs?: number;
    endpointHealthPct?: number;
    endpointDevices?: number;
    /**
     * ThousandEyes-side agent identity for path measurements. When the link
     * is sourced from a TE agent-to-agent test, these surface the actual
     * agents being probed (vs the test name, which can be misleading — see
     * SESSION_LOG 2026-05-12 misnamed-test lesson). Multi-valued from
     * Splunk; a string here is whatever Splunk delivers (usually one name,
     * occasionally newline-joined for multi-pair tests).
     */
    sourceAgents?: string;
    targetAgents?: string;
    /**
     * Geo-enriched agent location strings sourced from
     * `thousandeyes.source.agent.location` / `.target.agent.location`
     * (e.g. "Tallahassee, Florida, US"). Each A2A event ships full geo
     * metadata; we surface the human-readable location string for the map
     * popup so operators can see *where* each agent is, not just the agent
     * name. See `[overview_link_auburndale_tallahassee_health]` v1.6.0.
     */
    sourceLocation?: string;
    targetLocation?: string;
    /**
     * ISO 3166-1 alpha-2 country code for each TE agent (e.g. "US"),
     * sourced from `thousandeyes.source.agent.geo.country.iso_code`.
     */
    sourceCountry?: string;
    targetCountry?: string;
    /**
     * ISO 3166-2 region/state code for each TE agent (e.g. "FL"),
     * sourced from `thousandeyes.source.agent.geo.region.iso_code`.
     */
    sourceRegion?: string;
    targetRegion?: string;
    /**
     * Deep link into the ThousandEyes console for the underlying test.
     * v1.6.0: prefers the per-event `thousandeyes.permalink` (the URL TE
     * itself emits with every metric event, scoped to the right test /
     * agent / direction) and falls back to a constructed Path Visualization
     * URL when the permalink is missing. Map popup renders this as a
     * "View in ThousandEyes" affordance when present.
     */
    teLink?: string;
    lastUpdated?: string;
    dataState?: 'static' | 'loading' | 'live' | 'error';
    dataError?: string;
    /**
     * Human-readable telemetry source. Examples: Catalyst Center interfaces,
     * ThousandEyes, SD-WAN, NetFlow, or placeholder until wired.
     */
    telemetrySource: string;
    searchName?: string;
    thousandEyesA2A?: ThousandEyesA2ABinding;
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
