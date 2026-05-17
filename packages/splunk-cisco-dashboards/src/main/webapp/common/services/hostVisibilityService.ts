/**
 * hostVisibilityService — Build 114.
 *
 * Lightweight "is this host reporting events to Splunk right now?"
 * lookup, modelled after the same `| metadata type=hosts` pattern
 * used by `splunk-cisco-app-navigator`.
 *
 * Why `| metadata` and not a regular search:
 *   • `| metadata` is served from the indexer's tsidx metadata
 *     files — no event scan, no decompression, no time-range
 *     filter at the search head. A typical enterprise stack with
 *     thousands of hosts returns the whole list in <100ms.
 *   • One batch search returns every host on the system. We then
 *     do per-device lookups in JS instead of dispatching a
 *     per-device search, which would be O(N) round-trips.
 *
 * Threshold:
 *   We treat any host whose `lastTime` is within the last 24
 *   hours as "reporting". The 24h window matches the user's spec
 *   ("`| metadata type=hosts last 24h`"). Hosts present in
 *   metadata but older than 24h are reported as "silent". Hosts
 *   absent from metadata entirely are reported as "unknown" — we
 *   can't tell whether the host exists and is just not indexing
 *   here, or whether the operator typed a name that has never
 *   existed. The diagram canvas folds both `silent` and `unknown`
 *   into the same gray-dot status because the operator-visible
 *   meaning is the same: Splunk is not seeing this host on the
 *   network.
 *
 * Caching:
 *   Build 114 runs the metadata search once per page mount. If
 *   that turns out to be too aggressive we'll add an in-memory
 *   TTL cache here; for now a 100ms search per page open is well
 *   under the perceptual threshold.
 */

import { runSearch } from './splunkSearchService';

/** Window inside which a host is considered "reporting". 24h
 *  matches the user spec; longer is too generous for an "is the
 *  device on the network right now" indicator, shorter would
 *  flap during natural lulls (e.g. overnight). */
const REPORTING_WINDOW_SECONDS = 24 * 60 * 60;

/** Maximum hosts to consume from one metadata search. The
 *  underlying SPL command happily returns hundreds of thousands
 *  of rows on big customers; we cap at 50k so a hostile or
 *  unbounded result set can't OOM the renderer. Real enterprise
 *  Splunk stacks rarely exceed 10k unique hostnames. */
const MAX_HOSTS = 50_000;

export type HostReportingState = 'reporting' | 'silent' | 'unknown';

export interface HostVisibilityRecord {
    host: string;
    /** Epoch seconds — when Splunk last indexed an event for this host. */
    lastTime: number;
    /** Total events indexed for this host (across all sourcetypes). */
    totalCount: number;
    /** Derived from `lastTime` against the wall clock at fetch time. */
    state: 'reporting' | 'silent';
}

/** Map of (lower-cased) hostname → record. The case-fold is
 *  important: `asset_inventory.csv` rows often write `dc-pla-01`
 *  while Splunk indexes the same host as `DC-PLA-01`. Matching
 *  case-insensitively is the only way to make the merge reliable
 *  across customer environments. */
export interface HostVisibilityIndex {
    /** Look up a host by name. Returns the record if Splunk has
     *  ever seen this host, else `undefined`. */
    get: (host: string | undefined | null) => HostVisibilityRecord | undefined;
    /** True when the host is in metadata AND lastTime is inside
     *  REPORTING_WINDOW_SECONDS. Returns `undefined` for unknown
     *  hosts so callers can distinguish "Splunk never saw this"
     *  from "Splunk saw it but not recently". */
    isReporting: (host: string | undefined | null) => boolean | undefined;
    /** Number of distinct hosts in the index (for telemetry / debug). */
    size: number;
    /** Wall-clock seconds at which the metadata search ran. Useful
     *  if you want to display a "last refreshed" banner next to
     *  the diagram. */
    fetchedAt: number;
}

/** Build an empty index for use as a default / when the search
 *  fails. `isReporting` returns `undefined` for every input,
 *  which the canvas treats as "unknown" (gray dot). */
export const EMPTY_HOST_VISIBILITY_INDEX: HostVisibilityIndex = {
    get: () => undefined,
    isReporting: () => undefined,
    size: 0,
    fetchedAt: 0,
};

const normaliseHost = (raw: string | undefined | null): string | null => {
    if (!raw) return null;
    const trimmed = String(raw).trim().toLowerCase();
    return trimmed.length > 0 ? trimmed : null;
};

/** Convert raw `| metadata type=hosts` rows into a HostVisibilityIndex.
 *  Rows look like:
 *    { host: "dc-pla-01", lastTime: "1778471952", totalCount: "1347", ... }
 *  (Splunk returns numeric fields as strings — `Number()` parses
 *  them back; `NaN` falls through to `0` so a malformed row
 *  registers as silent rather than throwing.) */
const buildIndex = (
    rows: Array<Record<string, unknown>>,
    nowSec: number
): HostVisibilityIndex => {
    const map = new Map<string, HostVisibilityRecord>();
    let imported = 0;
    for (const row of rows) {
        if (imported >= MAX_HOSTS) break;
        const host = normaliseHost(row['host'] as string | undefined);
        if (!host) continue;
        const lastTime = Number(row['lastTime'] ?? 0);
        const totalCount = Number(row['totalCount'] ?? 0);
        const safeLastTime = Number.isFinite(lastTime) ? lastTime : 0;
        const ageSec = nowSec - safeLastTime;
        const state: HostVisibilityRecord['state'] =
            ageSec >= 0 && ageSec <= REPORTING_WINDOW_SECONDS
                ? 'reporting'
                : 'silent';
        map.set(host, {
            host,
            lastTime: safeLastTime,
            totalCount: Number.isFinite(totalCount) ? totalCount : 0,
            state,
        });
        imported += 1;
    }
    return {
        get: (h) => {
            const k = normaliseHost(h);
            return k ? map.get(k) : undefined;
        },
        isReporting: (h) => {
            const k = normaliseHost(h);
            if (!k) return undefined;
            const rec = map.get(k);
            if (!rec) return undefined;
            return rec.state === 'reporting';
        },
        size: map.size,
        fetchedAt: nowSec,
    };
};

/**
 * Fetch the current host-visibility index from Splunk.
 *
 * Resolves to `EMPTY_HOST_VISIBILITY_INDEX` (rather than rejecting)
 * if the search fails — the canvas can still render every device
 * with a "no telemetry" gray dot, which is exactly the right
 * fallback for an environment where the operator has lost
 * visibility into Splunk itself.
 *
 * Build 115.9 — fixes a sneaky "LED stays gray" symptom on stacks
 * with > 1000 reporting hosts: the previous call inherited
 * `runSearch`'s default `count = 1000`, so any host beyond the
 * first 1000 (sorted by Splunk's metadata enumeration order, which
 * is not host-name) silently fell out of the index. Bound shapes
 * pointing at a "missing" host hit the `undefined` fall-through in
 * `resolveEffectiveStatus` and rendered with the asset feed's
 * stale status (typically gray for Splunk's own hosts because
 * splunk_inventory doesn't carry a separate health column).
 *
 * We now request `count = MAX_HOSTS` (50k) so the returned set is
 * bounded by our own client-side cap rather than the dashboard
 * default.
 */
export const fetchHostVisibility = async (): Promise<HostVisibilityIndex> => {
    try {
        // `| metadata type=hosts` is metadata-only; the
        // earliest/latest time params don't filter the response
        // (metadata always returns the full population) but they
        // still satisfy `runSearch`'s parameter shape.
        //
        // We project `host`, `lastTime`, `totalCount` and sort by
        // `lastTime` desc so that, on a hostile stack with more
        // than `MAX_HOSTS` distinct hosts, our truncation keeps
        // the most-recently-active hosts (which are the ones the
        // operator is most likely to bind shapes to).
        const response = await runSearch({
            spl:
                '| metadata type=hosts ' +
                '| fields host, lastTime, totalCount ' +
                '| sort 0 - lastTime',
            earliestTime: '-24h',
            latestTime: 'now',
            tag: 'metadata:hosts',
            count: MAX_HOSTS,
        });
        const rows = (response?.results ?? []) as Array<Record<string, unknown>>;
        const nowSec = Math.floor(Date.now() / 1000);
        return buildIndex(rows, nowSec);
    } catch {
        // Suppressed on purpose — we never want a metadata
        // failure to prevent the diagram from rendering. The
        // empty index causes every status dot to fall through to
        // 'unknown', which the operator can read as "Splunk
        // visibility is unavailable".
        return EMPTY_HOST_VISIBILITY_INDEX;
    }
};
