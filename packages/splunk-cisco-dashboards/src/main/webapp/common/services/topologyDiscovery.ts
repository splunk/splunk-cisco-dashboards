/**
 * topologyDiscovery — pulls the auto-generated network inventory out of
 * the existing scheduled-search lookups and normalises it into a
 * platform-neutral `{ nodes[], edges[] }` shape that the React Flow
 * canvas can render directly.
 *
 * Why this lives in a service module (and not inside the canvas
 * component): the lookups it reads are *the customer's source of
 * truth*. Every dashboard that ever needs to draw the network
 * (topology canvas, future floor-plan views, capacity reports,
 * DR runbooks) should pull from the same normalised primitives, not
 * each re-derive them from raw Splunk events. Keeping the conversion
 * here means: one bug fix to the device-type taxonomy → every map
 * view is fixed; one new source feed added to `[Asset Inventory -
 * Build Lookup]` → every map view picks it up automatically.
 *
 * Sources we read today (zero new ingestion required):
 *   • `asset_inventory.csv`
 *       Multi-source unified device inventory. Built daily at 02:05
 *       by the `[Asset Inventory - Build Lookup]` saved search,
 *       which correlates Catalyst Center / Meraki / IOS syslog /
 *       ASA-FTD-Firepower / ISE NADs / F5 BIG-IP / Windows-AD /
 *       DHCP into one row per device, deduplicated by lowercased
 *       device_name and merged "richest source wins" via a
 *       source_priority cascade. Columns: device_name,
 *       device_name_short, device_type, device_family, platform_id,
 *       ip_address, mac_address, software_version, serial_number,
 *       location, device_role, device_series, health_score,
 *       compliance_status, management_source, last_seen.
 *
 *   • `site_topology_lookup.csv`
 *       Hierarchical site snapshot from `cisco:dnac:site:topology`
 *       (filtered to hierarchy-style: global/area/building/floor).
 *       Built hourly by the `[Executive Dashboard - Site Topology
 *       Lookup Generator]` saved search. Columns include id (DNAC
 *       site UUID), name, type, parentId, nameHierarchy, latitude,
 *       longitude, address, country, etc. Floors are pre-enriched
 *       with their parent building's address and GPS so leaf rows
 *       are self-sufficient.
 *
 * What's intentionally NOT read here yet:
 *   • Physical edges (CDP/LLDP) — there is no `cisco:dnac:link:
 *     topology` sourcetype on the standard TA-cisco-catalyst, so
 *     auto-discovery of port-to-port links requires a future REST
 *     modular input against DNAC's `/topology/physical-topology`
 *     endpoint. For the spike, edges come exclusively from the
 *     ThousandEyes A2A synthetic-test wiring (see the
 *     `synthetic_edges` field below).
 *   • Synthetic edges (TE A2A) — the existing
 *     `[overview_link_te_a2a_health]` searchbase stanza (one pair
 *     today: AUB ↔ TLH) is the v1 source. Future builds will
 *     dispatch the full mesh once additional A2A tests are
 *     commissioned (TLH ↔ Orlando / Blanding / SLRC / Rudd /
 *     Easley / Sadowski / MCV).
 *   • Logical edges (BGP/OSPF/EIGRP adjacencies) — data is
 *     flowing via `cisco:ios` syslog and the existing flap-detection
 *     stanzas, but no aggregator job yet builds an edge inventory.
 *     Open follow-up.
 *
 * The runtime split: `fetchAssetInventory()` and `fetchSiteTopology()`
 * each dispatch a single `| inputlookup` against Splunk via
 * `runSearch()`. They cache the parsed result in-memory for the
 * mounted lifetime of the page so the canvas can re-derive layouts
 * without re-fetching. Callers should call the higher-level
 * `discoverTopology()` which composes both into a single graph.
 */

import { runSearch } from './splunkSearchService';

/** Device family normalised to canvas shape ids. Add new ids when the
 *  shape library grows (e.g. `load_balancer`, `voice_gateway`). The
 *  spike ships with seven device shapes plus a `cloud` shape used for
 *  WAN / internet boundaries. Anything unrecognised falls back to
 *  `generic`. */
export type DeviceShapeId =
    | 'switch'
    | 'l3_switch'
    | 'router'
    | 'firewall'
    | 'wlc'
    | 'access_point'
    | 'server'
    | 'cloud'
    | 'generic';

/** Health status normalised across all node sources. Mirrors the
 *  topology map's traffic-light convention so the same colour palette
 *  applies. */
export type HealthStatus = 'healthy' | 'warning' | 'critical' | 'unknown';

export interface TopologyDiscoveredNode {
    /** Lowercased device_name from asset_inventory; stable join key. */
    id: string;
    /** Human label (often the FQDN or the full device_name). */
    label: string;
    /** Short alias for compact display (the `device_name_short`
     *  column from asset_inventory, falling back to the full name
     *  with the first dot-segment kept). */
    shortLabel: string;
    /** Canvas shape selector. Driven from device_type/device_family
     *  via `mapDeviceTypeToShape`. */
    shape: DeviceShapeId;
    /** Health status derived from health_score and compliance_status.
     *  Always defined; defaults to 'unknown' when neither field is
     *  available. */
    status: HealthStatus;
    /** Numeric health score (0-100) when available, else undefined. */
    healthScore?: number;
    /** Comma-separated source provenance from the asset_inventory
     *  cascade (e.g. "Catalyst Center, ISE NAD"). Surfaced in the
     *  shape's debug overlay. */
    managementSource?: string;
    /** DNAC site UUID for parent-zone resolution; matched against
     *  `site_topology_lookup.id`. */
    siteId?: string;
    /** Best-effort site label (location string from
     *  asset_inventory; resolved to `site_topology_lookup.name`
     *  when the UUID is parseable). */
    siteLabel?: string;
    /** Raw row preserved for popovers and click-through actions
     *  (open-in-search, deep links). Treat as opaque. */
    raw: Record<string, unknown>;
}

export interface TopologyDiscoveredZone {
    /** DNAC site UUID. */
    id: string;
    /** Display name from `nameHierarchy`. */
    name: string;
    /** Parent zone UUID for hierarchical nesting; null at the root. */
    parentId: string | null;
    /** `global`, `area`, `building`, `floor`. We typically render
     *  `building` and `floor` as React Flow parent nodes; `area`
     *  and `global` are virtual roots. */
    type: 'global' | 'area' | 'building' | 'floor' | 'unknown';
}

export interface TopologyDiscoveredEdge {
    /** Stable id for React Flow keying. Format
     *  `${sourceId}__${targetId}__${kind}`. */
    id: string;
    sourceId: string;
    targetId: string;
    /** What kind of relationship the edge represents. The shape
     *  library renders each kind with its own line style:
     *    - physical: solid (port-to-port from CDP/LLDP, future)
     *    - synthetic_a2a: dashed (TE A2A measurement)
     *    - logical: dotted (BGP/OSPF/EIGRP adjacency, future)
     */
    kind: 'physical' | 'synthetic_a2a' | 'logical';
    status: HealthStatus;
    /** Free-form midpoint label (e.g. `100 Mbps`, `latency 12 ms`). */
    label?: string;
    raw?: Record<string, unknown>;
}

export interface DiscoveredTopology {
    nodes: TopologyDiscoveredNode[];
    edges: TopologyDiscoveredEdge[];
    zones: TopologyDiscoveredZone[];
    /** When the snapshot was assembled in browser-local time;
     *  surfaced in the canvas footer for "freshness at a glance". */
    fetchedAt: string;
}

/**
 * Map asset_inventory.device_type / device_family to a canvas
 * shape id. Keep this matcher *additive*: when a new device family
 * lands, add a branch — never remove one without checking which
 * upstream feed produced it. Unknown values fall through to
 * `'generic'` so the canvas always renders something rather than
 * silently dropping the node.
 */
const mapDeviceTypeToShape = (
    deviceType: string | undefined,
    deviceFamily: string | undefined
): DeviceShapeId => {
    const t = (deviceType ?? '').toLowerCase();
    const f = (deviceFamily ?? '').toLowerCase();
    if (t === 'router' || f.includes('router') || /asr|isr|csr/.test(f)) return 'router';
    if (
        t === 'firewall' ||
        f.includes('asa') ||
        f.includes('ftd') ||
        f.includes('firepower')
    ) {
        return 'firewall';
    }
    if (t === 'wlc' || f.includes('wireless controller') || /^c?9800/i.test(f)) return 'wlc';
    if (t === 'ap' || f.includes('access point') || f === 'unified ap') return 'access_point';
    // L3 switches: name-driven heuristic — Catalyst 9500/9600/9300X
    // commonly run as L3 switches in customer environments. We bias
    // toward L3 only when the family explicitly suggests it; mixed
    // C9300/C9200 deployments still render as the generic L2 shape
    // unless asset_inventory carries an explicit `l3_capable` field
    // we can read here in a later build.
    if (t === 'switch' && /9500|9600/.test(f)) return 'l3_switch';
    if (t === 'switch' || f.includes('switch')) return 'switch';
    if (t === 'server' || f.includes('server')) return 'server';
    if (t === 'cloud' || f.includes('cloud') || f.includes('internet')) return 'cloud';
    return 'generic';
};

/**
 * Derive a health status from the inventory row. health_score is
 * the primary signal (Catalyst Center's reachability + manageability
 * blend, range 0/50/100); compliance_status is a fallback nudge for
 * devices outside DNAC's purview. Anything else returns 'unknown'
 * so the shape outline reads as "no telemetry" rather than misleading
 * green.
 */
const mapHealthStatus = (
    healthScore: number | undefined,
    complianceStatus: string | undefined
): HealthStatus => {
    if (typeof healthScore === 'number' && Number.isFinite(healthScore)) {
        if (healthScore >= 90) return 'healthy';
        if (healthScore >= 50) return 'warning';
        return 'critical';
    }
    const c = (complianceStatus ?? '').toLowerCase();
    if (c === 'compliant') return 'healthy';
    if (c === 'non-compliant' || c === 'non_compliant') return 'warning';
    return 'unknown';
};

const optionalString = (raw: unknown): string | undefined => {
    if (typeof raw !== 'string') return undefined;
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : undefined;
};

const optionalNumber = (raw: unknown): number | undefined => {
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    if (typeof raw === 'string' && raw.trim().length > 0) {
        const parsed = Number(raw);
        return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
};

/**
 * Run a single `| inputlookup` against Splunk and return the parsed
 * row array. Wraps `runSearch` with a stricter contract: empty
 * results don't throw — they just return `[]` so downstream
 * normalisation can produce a partial graph (e.g. asset inventory
 * missing → no nodes; site topology missing → no zones; canvas
 * still renders the synthetic-edge layer alone).
 */
const inputlookup = async (
    name: string
): Promise<Array<Record<string, unknown>>> => {
    const safeName = String(name).trim();
    if (!/^[A-Za-z0-9_\-.]+$/.test(safeName)) {
        throw new Error(`Invalid lookup name: ${safeName}`);
    }
    const res = await runSearch({
        spl: `| inputlookup ${safeName}`,
        earliestTime: '-1m',
        latestTime: 'now',
        tag: `topology_${safeName}`,
    });
    // `runSearch` is JS-typed and returns `Array<Object>`. Each row
    // is in fact a flat key/value bag — cast through `unknown` so
    // downstream callers can index by string without TS friction.
    return Array.isArray(res?.results)
        ? (res.results as unknown as Array<Record<string, unknown>>)
        : [];
};

export const fetchAssetInventory = async (): Promise<TopologyDiscoveredNode[]> => {
    const rows = await inputlookup('asset_inventory');
    const nodes: TopologyDiscoveredNode[] = [];
    for (const row of rows) {
        const name = optionalString(row['device_name']);
        if (!name) continue;
        const id = name.toLowerCase();
        const shortLabel =
            optionalString(row['device_name_short']) ??
            (id.includes('.') ? id.split('.')[0] : id);
        const deviceType = optionalString(row['device_type']);
        const deviceFamily = optionalString(row['device_family']);
        const healthScore = optionalNumber(row['health_score']);
        const compliance = optionalString(row['compliance_status']);
        const siteLabel = optionalString(row['location']);
        nodes.push({
            id,
            label: name,
            shortLabel,
            shape: mapDeviceTypeToShape(deviceType, deviceFamily),
            status: mapHealthStatus(healthScore, compliance),
            healthScore,
            managementSource: optionalString(row['management_source']),
            siteLabel,
            raw: row,
        });
    }
    // Sort deterministically so layouts are stable across reloads
    // (operators dragging a node and refreshing the page should see
    // it in the same place even before override persistence kicks
    // in for newly-discovered nodes).
    nodes.sort((a, b) => a.id.localeCompare(b.id));
    return nodes;
};

export const fetchSiteTopology = async (): Promise<TopologyDiscoveredZone[]> => {
    const rows = await inputlookup('site_topology_lookup');
    const zones: TopologyDiscoveredZone[] = [];
    for (const row of rows) {
        const id = optionalString(row['id']);
        const name = optionalString(row['name']) ?? id;
        if (!id || !name) continue;
        const typeRaw = (optionalString(row['type']) ?? '').toLowerCase();
        const type: TopologyDiscoveredZone['type'] =
            typeRaw === 'global' ||
            typeRaw === 'area' ||
            typeRaw === 'building' ||
            typeRaw === 'floor'
                ? typeRaw
                : 'unknown';
        zones.push({
            id,
            name,
            parentId: optionalString(row['parentId']) ?? null,
            type,
        });
    }
    return zones;
};

/**
 * High-level entrypoint for the canvas. Composes the asset inventory
 * + site topology fetches into a single `DiscoveredTopology`. Edges
 * are intentionally NOT fetched here because their dispatch path is
 * search-bound (one search per synthetic test) rather than lookup-
 * bound — the canvas wires them in a separate effect alongside
 * shape-level live data refreshes.
 */
export const discoverTopology = async (): Promise<DiscoveredTopology> => {
    const [nodes, zones] = await Promise.all([
        fetchAssetInventory().catch(() => [] as TopologyDiscoveredNode[]),
        fetchSiteTopology().catch(() => [] as TopologyDiscoveredZone[]),
    ]);
    return {
        nodes,
        edges: [],
        zones,
        fetchedAt: new Date().toISOString(),
    };
};
