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
 *  shape library grows (e.g. `voice_gateway`, `siem`). The
 *  spike shipped with seven device shapes plus a `cloud` shape used
 *  for WAN / internet boundaries. Build 115 added eight more shapes
 *  to cover the standard Cisco / network-engineering Visio palette:
 *  switch stacks, load balancers, VPN concentrators, IDS/IPS, plus
 *  database / storage / IP-phone / internet-cloud archetypes the
 *  Florida DEM v8 reference repeatedly used. Anything unrecognised
 *  falls back to `generic`. */
export type DeviceShapeId =
    // --- Core network ---
    | 'switch'
    | 'l3_switch'
    | 'stack'
    | 'router'
    | 'hub' // Build 115.5 — multi-port concentrator
    | 'gateway' // Build 115.5 — SD-WAN edge / edge gateway
    | 'proxy' // Build 115.5 — forward / reverse proxy
    | 'wlc'
    | 'access_point'
    | 'load_balancer'
    | 'f5_load_balancer'
    | 'modular_chassis_switch'
    | 'nexus_aci_fabric'
    | 'sdwan_controller'
    | 'custom_stencil'
    // --- Security ---
    | 'firewall'
    | 'palo_alto_firewall'
    | 'fortinet_firewall'
    | 'waf' // Build 115.5 — web app firewall
    | 'vpn_concentrator'
    | 'ids_ips'
    | 'siem' // Build 115.5 — SIEM / SOC analytics
    | 'ca' // Build 115.5 — certificate authority
    | 'bastion' // Build 115.5 — bastion / jump host
    // --- Servers & infrastructure ---
    | 'server'
    | 'web_server' // Build 115.5
    | 'app_server' // Build 115.5
    | 'dns_server' // Build 115.5
    | 'dhcp_server' // Build 115.5
    | 'mainframe' // Build 115.5
    | 'container' // Build 115.5 — Docker / Kubernetes pod
    | 'vm' // Build 115.5 — virtual machine / hypervisor
    | 'database'
    // --- Storage ---
    | 'storage'
    | 'nas' // Build 115.5
    | 'san' // Build 115.5
    | 'backup' // Build 115.5
    // --- End-user / IoT ---
    | 'laptop' // Build 115.5
    | 'mobile_phone' // Build 115.5
    | 'ip_phone'
    | 'printer' // Build 115.5
    | 'camera' // Build 115.5
    | 'iot_sensor' // Build 115.5
    // --- Edge / cloud ---
    | 'internet'
    | 'cloud'
    // Build 115.2 — "users" archetype for human populations.
    | 'users'
    // --- Splunk platform ---
    | 'splunk_search_head'
    | 'splunk_search_head_cluster'
    | 'splunk_indexer'
    | 'splunk_indexer_cluster'
    | 'splunk_heavy_forwarder'
    | 'splunk_universal_forwarder'
    | 'splunk_intermediate_forwarder'
    | 'splunk_cluster_manager'
    | 'splunk_deployer'
    | 'splunk_license_manager'
    | 'splunk_monitoring_console'
    | 'splunk_deployment_server'
    | 'splunk_data_collection'
    | 'splunk_edge_processor'
    | 'splunk_sc4s'
    // --- Places ---
    | 'branch_office' // Build 115.5
    | 'datacenter' // Build 115.5
    // --- Official Cisco icon set ---
    | 'cisco_router'
    | 'cisco_switch'
    | 'cisco_l3_switch'
    | 'cisco_stack'
    | 'cisco_wlc'
    | 'cisco_access_point'
    | 'cisco_firewall'
    | 'cisco_server'
    | 'cisco_cloud'
    | 'cisco_data_center'
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
    /** Build 115: canonical vendor name (e.g. `Cisco`, `F5`,
     *  `Cisco Meraki`). Derived from `management_source` because
     *  asset_inventory.csv doesn't carry an explicit vendor
     *  column — see `deriveVendor()`. Surfaced on the device
     *  card so operators can tell a Cisco WLC from a F5 ADC at
     *  a glance. */
    vendor?: string;
    /** Build 115: device model identifier. Pulled from
     *  asset_inventory.csv's `platform_id` column (e.g.
     *  `WS-C6504-E`, `9300-48UXM`, `BIG-IP i5800`). When absent
     *  we fall back to `device_series` — never make one up. */
    model?: string;
    /** Build 115: device serial number from asset_inventory.csv.
     *  Not displayed on the small card by default (too noisy)
     *  but available in the inspector and for click-through
     *  flows that need a stable hardware identifier. */
    serialNumber?: string;
    /** Build 115.13 — operator-supplied IP / management address
     *  override. Surfaces as the bottom row of the device card
     *  when the page-level "Show IPs" toggle is on. Falls back
     *  to `raw.ip_address` (asset_inventory) /
     *  `raw.management_ip` (splunk_inventory) at render time
     *  when this field is unset, so unbound shapes the operator
     *  has typed an IP into still display, and bound shapes
     *  show the inventory IP automatically. */
    ipAddress?: string;
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
    /** Build 115.4 — which inventory feed produced this node.
     *  `cisco`  → asset_inventory.csv (Catalyst Center, Meraki,
     *             ASA/FTD, ISE, F5, IOS syslog, AD, DHCP).
     *  `splunk` → splunk_inventory.csv (search heads, indexers,
     *             SHC members, cluster managers, deployment
     *             servers, IDMs, heavy/universal forwarders,
     *             ES/ITSI search heads).
     *  Drives the InventoryTab's "All / Cisco / Splunk" filter
     *  chips. Optional so older callers and tests can omit it. */
    provenance?: 'cisco' | 'splunk';
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

    // Build 115 — most-specific matches first. The order below is
    // intentional: a "Catalyst 9300 stack" should land on `stack`,
    // not on `switch`, even though "stack" appears in the family
    // string and "9300" matches L3-switch patterns.
    if (t === 'stack' || f.includes('stack')) return 'stack';
    if (f.includes('big-ip') || f.includes('f5')) {
        return 'f5_load_balancer';
    }
    if (t === 'load balancer' || f.includes('netscaler') || f.includes('a10') || f.includes('avi')) {
        return 'load_balancer';
    }
    if (
        f.includes('catalyst 450') ||
        f.includes('catalyst 650') ||
        f.includes('ws-c450') ||
        f.includes('ws-c650') ||
        f.includes('4507') ||
        f.includes('6504')
    ) {
        return 'modular_chassis_switch';
    }
    if (f.includes('nexus') || f.includes('aci') || f.includes('apic')) {
        return 'nexus_aci_fabric';
    }
    if (
        f.includes('sd-wan') ||
        f.includes('sdwan') ||
        f.includes('vmanage') ||
        f.includes('vsmart') ||
        f.includes('vbond')
    ) {
        return 'sdwan_controller';
    }
    if (t === 'vpn' || t === 'vpn concentrator' || f.includes('anyconnect') || f.includes('vpn')) {
        return 'vpn_concentrator';
    }
    if (
        t === 'ids' ||
        t === 'ips' ||
        t === 'sensor' ||
        f.includes('stealthwatch') ||
        f.includes('snort') ||
        f.includes('secure network analytics') ||
        f.includes('intrusion')
    ) {
        return 'ids_ips';
    }
    if (t === 'database' || t === 'db' || f.includes('oracle') || f.includes('mysql') || f.includes('postgres')) {
        return 'database';
    }
    if (t === 'storage' || f.includes('san') || f.includes('nas') || f.includes('netapp') || f.includes('emc')) {
        return 'storage';
    }
    if (t === 'phone' || t === 'ip phone' || t === 'voip' || f.includes('cucm') || f.includes('ip phone')) {
        return 'ip_phone';
    }
    if (t === 'internet' || f.includes('internet')) return 'internet';
    // Build 115.2 — "users" archetype. Asset_inventory rarely
    // carries human populations directly; the typical path is an
    // operator hand-dropping the shape from the palette. We still
    // recognise a few common patterns in case a customer feed
    // tags identity-broker records or VDI pools as `users` /
    // `enduser` so they auto-render with the right glyph.
    if (
        t === 'users' ||
        t === 'user' ||
        t === 'enduser' ||
        t === 'end user' ||
        f.includes('end user') ||
        f.includes('enduser')
    ) {
        return 'users';
    }

    if (t === 'router' || f.includes('router') || /asr|isr|csr/.test(f)) return 'router';
    if (
        t === 'firewall' ||
        f.includes('palo alto') ||
        f.includes('pan-os') ||
        f.includes('fortinet') ||
        f.includes('fortigate') ||
        f.includes('asa') ||
        f.includes('ftd') ||
        f.includes('firepower')
    ) {
        if (f.includes('palo alto') || f.includes('pan-os')) {
            return 'palo_alto_firewall';
        }
        if (f.includes('fortinet') || f.includes('fortigate')) {
            return 'fortinet_firewall';
        }
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
    if (t === 'cloud' || f.includes('cloud')) return 'cloud';
    return 'generic';
};

/** Build 115: derive a vendor label from `management_source`. The
 *  unified `asset_inventory.csv` doesn't carry an explicit
 *  `vendor` column because every contributing source (Catalyst
 *  Center, Meraki, IOS syslog, ASA-FTD, ISE NADs, F5 BIG-IP, AD,
 *  DHCP) implies its own vendor. We map management_source →
 *  vendor with a small allow-list, falling back to "Cisco" when
 *  no source matches because the dominant fleet across the eight
 *  sources is Cisco. Returning `undefined` for "no provenance at
 *  all" keeps the shape card tidy when we genuinely don't know. */
const deriveVendor = (
    managementSource: string | undefined
): string | undefined => {
    if (!managementSource) return undefined;
    const s = managementSource.toLowerCase();
    if (s.includes('f5')) return 'F5';
    if (s.includes('meraki')) return 'Cisco Meraki';
    if (s.includes('catalyst center')) return 'Cisco';
    if (s.includes('ise')) return 'Cisco';
    if (s.includes('ios') || s.includes('asa') || s.includes('ftd') || s.includes('firepower'))
        return 'Cisco';
    if (s.includes('windows') || s.includes('active directory')) return 'Microsoft';
    if (s.includes('palo')) return 'Palo Alto';
    if (s.includes('fortinet') || s.includes('fortigate')) return 'Fortinet';
    if (s.includes('arista')) return 'Arista';
    if (s.includes('juniper')) return 'Juniper';
    return 'Cisco';
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
        const managementSource = optionalString(row['management_source']);
        nodes.push({
            id,
            label: name,
            shortLabel,
            shape: mapDeviceTypeToShape(deviceType, deviceFamily),
            status: mapHealthStatus(healthScore, compliance),
            healthScore,
            managementSource,
            // Build 115: vendor / model / serial threaded through
            // so the shape card and inspector can show "Cisco ·
            // WS-C6504-E" without the consumer re-deriving from
            // `raw`. Falls through to undefined when the upstream
            // row is missing the source field.
            vendor: deriveVendor(managementSource),
            model:
                optionalString(row['platform_id']) ??
                optionalString(row['device_series']),
            serialNumber: optionalString(row['serial_number']),
            siteLabel,
            raw: row,
            provenance: 'cisco',
        });
    }
    // Sort deterministically so layouts are stable across reloads
    // (operators dragging a node and refreshing the page should see
    // it in the same place even before override persistence kicks
    // in for newly-discovered nodes).
    nodes.sort((a, b) => a.id.localeCompare(b.id));
    return nodes;
};

/* ───────────────────────  Splunk inventory  ───────────────────────
 *
 * Build 115.4 — second inventory feed for the Network Diagram
 * authoring page. Reads `splunk_inventory.csv` (populated daily
 * by the [Splunk Inventory - Build Lookup] saved search) and
 * normalises each row into a `TopologyDiscoveredNode` with the
 * same shape as the Cisco asset_inventory feed, so the page can
 * concat both and render them through the same InventoryTab,
 * AssetIndex (for Bind-to-host), and live-status overlays.
 *
 * Why a separate fetcher (vs extending `fetchAssetInventory`):
 *   • The role vocabulary is different — Splunk hosts carry
 *     `primary_role` tokens like `indexer`, `cluster_manager`,
 *     `search_head_cluster`, `heavy_forwarder`, `idm` — which
 *     the existing `mapDeviceTypeToShape` matcher doesn't
 *     understand. Folding both into one matcher would either
 *     bloat that function or leak Splunk-specific cases into
 *     Cisco code paths.
 *   • The shape→model translation is also different: a Splunk
 *     SHC member should display as "Splunk · ITSI Production
 *     SHC" using the cluster label, not the platform_id.
 *   • Distinct provenance lets the InventoryTab show
 *     accurate per-source counts ("231 Cisco devices, 42
 *     Splunk hosts") without the user having to know which
 *     vendor field implies which.
 */

/** Map a Splunk `primary_role` token (or, when absent, a parsed
 *  `role` mvfield) to a canvas DeviceShapeId. Vocabulary kept in
 *  ONE place rather than scattered across the InventoryTab and
 *  Bind-to-host flows. Falls through to `'generic'` so an unknown
 *  role still renders something rather than blanking the canvas. */
const mapSplunkRoleToShape = (
    primaryRole: string | undefined,
    rolesCsv: string | undefined,
    name: string | undefined
): DeviceShapeId => {
    const p = (primaryRole ?? '').toLowerCase();
    const r = (rolesCsv ?? '').toLowerCase();
    const n = (name ?? '').toLowerCase();

    // Build 1177 — Splunk roles now use Splunk-specific glyphs
    // instead of generic server/database cards.
    if (
        p === 'indexer' ||
        n.startsWith('idx-') ||
        n.startsWith('idxc-') ||
        r.includes('cluster_slave') ||
        r.includes('search_peer')
    ) {
        return 'splunk_indexer';
    }
    if (p === 'search_head_cluster' || r.includes('shc_captain')) {
        return 'splunk_search_head_cluster';
    }
    if (p === 'search_head' || p === 'cluster_search_head' || n.startsWith('sh-')) {
        return 'splunk_search_head';
    }
    if (p === 'cluster_manager') return 'splunk_cluster_manager';
    if (p === 'deployment_server') return 'splunk_deployment_server';
    if (p === 'license_manager') return 'splunk_license_manager';
    if (p === 'monitoring_console') return 'splunk_monitoring_console';
    if (p === 'heavy_forwarder' || n.startsWith('hf-')) return 'splunk_heavy_forwarder';
    if (p === 'universal_forwarder' || n.startsWith('uf-')) {
        return 'splunk_universal_forwarder';
    }
    if (
        p === 'intermediate_forwarder' ||
        p === 'intermediary_forwarder' ||
        n.startsWith('if-')
    ) {
        return 'splunk_intermediate_forwarder';
    }
    if (p === 'idm' || n.startsWith('idm-')) return 'splunk_data_collection';
    return 'server';
};

/** Derive a friendly model string from the Splunk row. Goes for
 *  cluster-aware naming first (e.g. "ITSI Production SHC",
 *  "Production Indexer Cluster") since that's what operators
 *  actually want on the canvas; falls back to the role token
 *  ("Search Head", "Heavy Forwarder", "Indexer") when there's
 *  no cluster membership to anchor on. The Splunk version
 *  string lives in `version` and is exposed via `raw` for
 *  inspector hover. */
const deriveSplunkModel = (
    primaryRole: string | undefined,
    indexClusterLabel: string | undefined,
    shClusterLabel: string | undefined,
    isEs: boolean,
    isItsi: boolean
): string => {
    const p = (primaryRole ?? '').toLowerCase();
    if (indexClusterLabel) return `Indexer Cluster · ${indexClusterLabel}`;
    if (shClusterLabel) {
        const flavour = isItsi ? 'ITSI SHC' : isEs ? 'ES SHC' : 'SHC';
        return `${flavour} · ${shClusterLabel}`;
    }
    switch (p) {
        case 'indexer':
            return 'Indexer';
        case 'cluster_manager':
            return 'Cluster Manager';
        case 'search_head':
        case 'cluster_search_head':
            return isItsi ? 'ITSI Search Head' : isEs ? 'ES Search Head' : 'Search Head';
        case 'search_head_cluster':
            return isItsi ? 'ITSI SHC' : isEs ? 'ES SHC' : 'Search Head Cluster';
        case 'license_manager':
            return 'License Manager';
        case 'deployment_server':
            return 'Deployment Server';
        case 'heavy_forwarder':
            return 'Heavy Forwarder';
        case 'universal_forwarder':
            return 'Universal Forwarder';
        case 'intermediate_forwarder':
        case 'intermediary_forwarder':
            return 'Intermediate Forwarder';
        case 'idm':
            return 'Inputs Data Manager';
        default:
            return primaryRole && primaryRole.length > 0 ? primaryRole : 'Splunk Host';
    }
};

/** Read `splunk_inventory.csv` (populated by the daily saved
 *  search) and return one TopologyDiscoveredNode per host. Rows
 *  with no `host_name` are skipped (defensive — should never
 *  happen with the saved-search projection, but a hand-edit of
 *  the lookup CSV could leave one). */
export const fetchSplunkInventory = async (): Promise<TopologyDiscoveredNode[]> => {
    const rows = await inputlookup('splunk_inventory');
    const nodes: TopologyDiscoveredNode[] = [];
    for (const row of rows) {
        const hostName = optionalString(row['host_name']);
        if (!hostName) continue;
        const id = hostName.toLowerCase();
        const name = optionalString(row['name']);
        const label = optionalString(row['label']) ?? hostName;
        // The discovery search assigns `name` like "idx-01" or
        // "shc-01"; that's exactly what we want for the compact
        // shortLabel on the canvas card. Fall back to the host's
        // first dot-segment when the row predates the projection.
        const shortLabel = name ?? (id.includes('.') ? id.split('.')[0] : id);
        const primaryRole = optionalString(row['primary_role']);
        const rolesCsv = optionalString(row['role']);
        const indexClusterLabel = optionalString(row['index_cluster_label']);
        const shClusterLabel = optionalString(row['sh_cluster_label']);
        const isEs = optionalString(row['is_es']) === 'yes';
        const isItsi = optionalString(row['is_itsi']) === 'yes';
        const isConnected = optionalString(row['is_connected']) === 'yes';
        const env = optionalString(row['env']);
        const version = optionalString(row['version']);
        const model = deriveSplunkModel(
            primaryRole,
            indexClusterLabel,
            shClusterLabel,
            isEs,
            isItsi
        );
        const shape = mapSplunkRoleToShape(primaryRole, rolesCsv, name);
        // Health: `is_connected` is the strongest live signal we
        // have. There's no equivalent of Catalyst Center's
        // health_score in Splunk's introspection feed; "no signal
        // for 24h" already means the host isn't writing
        // _introspection / _internal, so anything missing from the
        // saved-search output is implicitly unknown.
        const status: HealthStatus = isConnected ? 'healthy' : 'unknown';
        nodes.push({
            id,
            label,
            shortLabel,
            shape,
            status,
            // managementSource doubles as the inventory-source
            // facet in the InventoryTab. Format mirrors the
            // Cisco rows ("Catalyst Center", "Meraki Dashboard")
            // so the existing FilterDropdown picks it up
            // without any code changes.
            managementSource: env === 'Cloud' ? 'Splunk Cloud' : 'Splunk Enterprise',
            vendor: 'Splunk',
            model,
            // No serial number on Splunk hosts — software, not
            // hardware. Leave undefined.
            serialNumber: undefined,
            siteLabel: undefined,
            raw: {
                ...row,
                // Surface the Splunk-version string under the
                // same key the inspector hover already reads
                // for "platform_id"-style hints, so a bound
                // host shows "Splunk 9.2.1" without any new UI.
                platform_id: version,
                device_type: shape,
            },
            provenance: 'splunk',
        });
    }
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
