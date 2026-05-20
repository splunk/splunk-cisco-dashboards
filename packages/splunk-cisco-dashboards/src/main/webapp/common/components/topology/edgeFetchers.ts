/**
 * topologyEdgeFetchers — pluggable edge-source adapters for the
 * topology canvas. Each fetcher takes a `DiscoveredTopology` (so it
 * can resolve its own endpoint IDs against the discovered nodes)
 * and returns zero-or-more `TopologyDiscoveredEdge`s.
 *
 * Why a separate module: the canvas wrapper accepts a single
 * `fetchEdges` callback; the page can compose multiple fetchers via
 * `Promise.all` to overlay synthetic + physical + logical edges in
 * one render. Each adapter is responsible for ITS source's
 * normalization, not the canvas, so adding a new feed (say, a
 * future DNAC physical-link modular input) is a matter of writing
 * one more adapter and concatenating.
 */

import { runSearch } from '@/common/services/splunkSearchService';
import { getSearchbaseCatalogue } from '@/common/services/searchbaseCatalogue';
import type {
    DiscoveredTopology,
    TopologyDiscoveredEdge,
    HealthStatus,
} from '@/common/services/topologyDiscovery';

/** Friendly `search_name` of the searchbase stanza that backs the
 *  synthetic A2A edge fetcher. Kept here (and not in the stanza id)
 *  because `search_name` is the stable, reviewer-visible key. */
const TE_A2A_SEARCH_NAME = 'Overview - Link ThousandEyes A2A Health';

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

/** Map the upstream TE stanza's `status` string ("stable",
 *  "warning", "critical", "unknown") to our canonical
 *  `HealthStatus`. */
const mapTeStatus = (raw: string | undefined): HealthStatus => {
    switch ((raw ?? '').toLowerCase()) {
        case 'stable':
            return 'healthy';
        case 'warning':
            return 'warning';
        case 'critical':
            return 'critical';
        default:
            return 'unknown';
    }
};

/**
 * Pick a "representative" device in the discovered topology for a
 * given site. For the spike we use a simple heuristic: the first
 * device whose `siteLabel` (asset_inventory.location) case-
 * insensitively contains any of the supplied site tokens, with
 * router/firewall device shapes preferred over switches (since the
 * synthetic A2A test conceptually rides over the WAN edge). When
 * no router/firewall is found, we fall back to the first matching
 * device of any kind. When no device matches at all, we return
 * undefined and the caller drops the edge.
 *
 * Token matching is intentionally loose so customer-specific
 * naming (e.g. "Tallahassee Operations Center" vs "TLH Ops")
 * doesn't break the join.
 */
const pickRepresentativeDeviceId = (
    topology: DiscoveredTopology,
    siteTokens: string[]
): string | undefined => {
    if (siteTokens.length === 0) return undefined;
    const lowerTokens = siteTokens
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t.length > 0);
    const matches = topology.nodes.filter((n) => {
        const haystack = (n.siteLabel ?? '').toLowerCase();
        return lowerTokens.some((t) => haystack.includes(t));
    });
    if (matches.length === 0) return undefined;
    const preferred = matches.find(
        (m) => m.shape === 'router' || m.shape === 'firewall'
    );
    return (preferred ?? matches[0]).id;
};

/**
 * Synthetic-edge fetcher backed by the `[overview_link_te_a2a_
 * health]` stanza. Resolves the AUB↔TLH measurement to
 * representative devices in the customer's asset inventory and
 * emits one `synthetic_a2a` edge.
 *
 * Today this is hard-coded to AUB↔TLH because that's the only
 * commissioned A2A test. When additional tests come online (TLH↔
 * Orlando / Blanding / SLRC / Rudd / Easley / Sadowski / MCV) the
 * call site can either:
 *   • dispatch this fetcher per-pair with different stanza names,
 *   • or upgrade the underlying SPL to return one row per
 *     (sourceCity, targetCity) tuple and rewrite this fetcher to
 *     iterate the results.
 */
export const fetchThousandEyesA2AEdges = async (
    topology: DiscoveredTopology
): Promise<TopologyDiscoveredEdge[]> => {
    // Resolve the inline SPL out of `searchbase.conf` rather than
    // dispatching `| savedsearch "..."` — the stanza is *not* a real
    // saved search (only a searchbase entry), so the savedsearch
    // command path 400s on most stacks. The catalogue lookup uses
    // the same configs/conf-searchbase REST surface the picker
    // already calls, so it piggybacks the existing cache.
    let spl: string;
    try {
        const catalogue = await getSearchbaseCatalogue();
        const record = catalogue.find((r) => r.searchName === TE_A2A_SEARCH_NAME);
        if (!record || record.search.trim().length === 0) {
            // Stanza not shipped on this stack (older install or
            // edited conf); skip silently — the canvas just renders
            // without TE overlays.
            return [];
        }
        spl = record.search;
    } catch {
        // Catalogue REST call failed (offline / permission). Fail
        // closed — no edges, no error toast in the canvas.
        return [];
    }

    let res;
    try {
        res = await runSearch({
            spl,
            earliestTime: '-4h@h',
            latestTime: 'now',
            tag: 'topology_te_a2a',
        });
    } catch {
        // Search dispatch failed (e.g. SPL macro missing on stack).
        // Treat as "no overlay available" rather than crashing the
        // canvas.
        return [];
    }

    // `runSearch` is JS-typed; cast each row to a flat string-key
    // bag so we can index into the saved-search output without TS
    // friction.
    const rows: Array<Record<string, unknown>> = Array.isArray(res?.results)
        ? (res.results as unknown as Array<Record<string, unknown>>)
        : [];
    const edges: TopologyDiscoveredEdge[] = [];
    for (const row of rows) {
        const sourceTokens = ['Tallahassee', 'TLH', 'tlh'];
        const targetTokens = ['Auburndale', 'AUB', 'aub'];
        // The stanza also embeds source/target locations on the
        // row itself; prefer those when available so customers
        // who tag agents with a city other than what the test
        // name says still get a sensible join.
        const sourceLocation = optionalString(row['sourceLocation']);
        const targetLocation = optionalString(row['targetLocation']);
        if (sourceLocation) sourceTokens.unshift(sourceLocation);
        if (targetLocation) targetTokens.unshift(targetLocation);

        const sourceId = pickRepresentativeDeviceId(topology, sourceTokens);
        const targetId = pickRepresentativeDeviceId(topology, targetTokens);
        if (!sourceId || !targetId) continue;

        const status = mapTeStatus(optionalString(row['status']));
        const latencyMs = optionalNumber(row['latencyMs']);
        const lossPct = optionalNumber(row['lossPct']);
        const jitterMs = optionalNumber(row['jitterMs']);
        const labelParts: string[] = [];
        if (latencyMs !== undefined) labelParts.push(`${latencyMs} ms`);
        if (lossPct !== undefined) labelParts.push(`${lossPct}% loss`);
        if (jitterMs !== undefined) labelParts.push(`${jitterMs} ms jitter`);
        const label = labelParts.length > 0 ? labelParts.join(' · ') : 'TE A2A';

        edges.push({
            id: `te__${sourceId}__${targetId}`,
            sourceId,
            targetId,
            kind: 'synthetic_a2a',
            status,
            label,
            raw: row,
        });
    }
    return edges;
};

/**
 * Convenience composer: invokes every shipped fetcher in parallel
 * and concatenates the results. Page-level callers pass this as the
 * `fetchEdges` prop on `TopologyCanvas`.
 */
export const fetchAllEdges = async (
    topology: DiscoveredTopology
): Promise<TopologyDiscoveredEdge[]> => {
    const results = await Promise.allSettled([fetchThousandEyesA2AEdges(topology)]);
    const out: TopologyDiscoveredEdge[] = [];
    for (const r of results) {
        if (r.status === 'fulfilled') out.push(...r.value);
    }
    return out;
};
