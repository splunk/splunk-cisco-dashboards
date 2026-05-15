/**
 * diagramPersistenceService — read/write the `network_diagrams.csv`
 * lookup that backs the Network Diagram authoring page (Build 108).
 *
 * Persistence model (kept deliberately simple — see
 * `transforms.conf`):
 *   • One row per **saved diagram** (NOT one row per node/edge).
 *     Columns: `name, updated_at, updated_by, payload_json`.
 *   • The diagram's nodes / edges / region groups are encoded as
 *     a single JSON blob in `payload_json`. The React canvas is
 *     the only consumer; SPL never has to parse it.
 *
 * Why a single REST surface (the search dispatcher) for BOTH
 * reads and writes:
 *   • **Reads** are `| inputlookup network_diagrams` dispatched
 *     through `runSearch`. We get parsed row objects for free.
 *   • **Writes** are upsert SPL of the form
 *       | inputlookup network_diagrams
 *       | where name != "<safe_name>"
 *       | append [| makeresults | eval ... | fields - _time]
 *       | sort name
 *       | outputlookup network_diagrams.csv
 *     also dispatched through `runSearch`. The whole upsert runs
 *     server-side as a single search job, so it's atomic from
 *     splunkd's perspective and we never have to round-trip the
 *     full CSV through the browser.
 *
 *     Build 107 tried using Splunk Web's `data/lookup-edit/
 *     lookup_contents` REST endpoint — that surface is a
 *     mrsparkle controller, not a public splunkd endpoint, and
 *     reaching it via `__raw` 404s on Splunk 10.x. The SPL
 *     pipeline above is documented, version-stable, and runs in
 *     the same auth/CSRF/namespace context as our existing reads.
 *
 *     Build 108 is the implementation of that pivot.
 *
 * Concurrency: this service is "last writer wins". Two operators
 * editing the same diagram simultaneously and both saving → the
 * later save overwrites the earlier. That's acceptable for the
 * single-tenant authoring flow; if multi-user concurrent editing
 * becomes a real requirement, the upgrade path is to add a
 * `revision` column and check it inside the SPL `where` clause.
 *
 * Out-of-runtime fallback (local dev outside Splunk Web): all
 * methods short-circuit to a session-scoped in-memory store so
 * the UI is testable end-to-end against fixtures without a real
 * Splunk backend.
 */

import { runSearch, getSearchAppContext } from './splunkSearchService';

/** Splunk app namespace this service must always target. Used by
 *  the `__debug_targetsApp` helper to assert tests don't
 *  accidentally point the persistence layer at a different app
 *  via `setSearchAppContext('...')`. The lookup *filename* is
 *  inlined in each SPL pipeline below (string-literal so it's
 *  never user-controlled). */
const LOOKUP_NAMESPACE = 'splunk-cisco-dashboards';

/**
 * Allow only friendly names to land in the lookup. We use this
 * value both as the SPL search filter (`| search name="X"`) AND
 * as the row primary key, so it has to be safe for both. The
 * ranges chosen below cover ASCII letters/digits, spaces, `_`,
 * `-`, `.` — enough for "FDEM Production v2" / "fdem-prod-v2"
 * style names without opening up SPL injection or CSV escape
 * surprises.
 */
const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 _.\-]{0,63}$/;

const DIAGRAM_PAYLOAD_VERSION = 1;

/**
 * Hard cap on the JSON payload we'll persist in a single row of
 * `network_diagrams.csv`. The cap is enforced client-side to
 * fail fast with a friendly error instead of letting the
 * dispatcher send a multi-megabyte SPL string and have splunkd
 * truncate or reject it. 256 KiB covers a diagram with ~1000
 * nodes + ~500 edges + ~50 region groups; if a real customer
 * ever hits this we'll add chunked saves (Build 110+).
 */
const MAX_PAYLOAD_BYTES = 256 * 1024;

/**
 * The payload shape stored in the CSV's `payload_json` column.
 * Kept lean: positions, sizes, label, type, and provenance flags
 * for nodes; endpoints + style metadata for edges; bounds + label
 * for region groups. The canvas is responsible for re-deriving
 * any displayed-data details (health overlay, KPI tooltips,
 * etc.) from the active `asset_inventory` snapshot at render
 * time — that way a re-discovery of the inventory doesn't
 * invalidate saved diagrams.
 */
export interface SavedDiagramPayload {
    /** Schema version. Bump when a load-time migration is needed. */
    version: number;
    nodes: SavedDiagramNode[];
    edges: SavedDiagramEdge[];
    /** Optional region/group nodes (Build 106 ships a single
     *  Region type; future builds may add Floor / Rack / Cloud-VPC
     *  containers without breaking back-compat). */
    groups: SavedDiagramGroup[];
}

export interface SavedDiagramNode {
    id: string;
    /** React Flow node type id (e.g. `device:switch`,
     *  `device:firewall`, `regionGroup`). Matches the
     *  `TOPOLOGY_NODE_TYPES` registry entries plus any new types
     *  the diagram canvas adds. */
    type: string;
    x: number;
    y: number;
    width?: number;
    height?: number;
    /** Human-supplied display name. */
    label?: string;
    /** Compact alias for the bottom-of-card secondary line. */
    shortLabel?: string;
    /** When this node represents a real device from
     *  `asset_inventory.csv`, this is the lowercased
     *  `device_name`. The canvas uses it on render to look up
     *  health / KPI live data. When `undefined`, the node is
     *  generic / unbound. */
    assetId?: string;
    /** Optional parent group id for nesting inside region nodes. */
    parentId?: string;
    /** Free-form notes the operator may attach to a node. */
    notes?: string;
}

export interface SavedDiagramEdge {
    id: string;
    sourceId: string;
    targetId: string;
    /** Edge style category (drives solid vs dashed, color, animation). */
    kind: 'physical' | 'synthetic_a2a' | 'logical';
    /** Free-form midpoint label (e.g. "100Mbps", "VLAN 50"). */
    label?: string;
    /** Optional layer chip (e.g. "L2", "L3") shown alongside the label. */
    layer?: string;
    notes?: string;
}

export interface SavedDiagramGroup {
    id: string;
    label: string;
    x: number;
    y: number;
    width: number;
    height: number;
    /** Tailwind-classname or hex tint for the group fill. */
    accent?: string;
}

/**
 * Lightweight directory row for the diagram-picker dropdown.
 * Excludes the (potentially large) JSON payload so the picker
 * load is cheap.
 */
export interface DiagramSummary {
    name: string;
    updatedAt: string;
    updatedBy: string;
}

interface DiagramRow extends DiagramSummary {
    payloadJson: string;
}

/** Session-only in-memory store used when the page is rendered
 *  outside Splunk Web (local dev). Survives across method calls
 *  inside a single page load. */
const MOCK_STORE: Map<string, DiagramRow> = new Map();

const isInSplunkRuntime = (): boolean => {
    if (typeof window === 'undefined') return false;
    if ((window as unknown as { __SPLUNK_RUNTIME__?: boolean }).__SPLUNK_RUNTIME__ === false) {
        return false;
    }
    if ((window as unknown as { __SPLUNK_RUNTIME__?: boolean }).__SPLUNK_RUNTIME__ === true) {
        return true;
    }
    return Boolean((window as unknown as { $C?: unknown }).$C);
};

export class InvalidDiagramNameError extends Error {
    constructor(name: string) {
        super(
            `Invalid diagram name: "${name}". Use 1–64 letters, digits, ` +
                `spaces, dots, hyphens or underscores.`
        );
        this.name = 'InvalidDiagramNameError';
    }
}

export class DiagramPersistenceError extends Error {
    public readonly status?: number;
    constructor(message: string, status?: number) {
        super(message);
        this.name = 'DiagramPersistenceError';
        this.status = status;
    }
}

const assertValidName = (name: string): void => {
    if (typeof name !== 'string' || !NAME_PATTERN.test(name)) {
        throw new InvalidDiagramNameError(name);
    }
};

const optionalString = (raw: unknown): string => {
    if (typeof raw !== 'string') return '';
    return raw;
};

/**
 * Escape a JS string so it is safe to embed inside SPL
 * double-quoted literals. SPL recognises two escape sequences in
 * "..." strings: `\\` for a literal backslash and `\"` for a
 * literal double-quote. No other character needs escaping
 * (newlines/tabs in payloads survive verbatim, which is fine —
 * `outputlookup` writes them through to CSV unchanged).
 *
 * We DO NOT need to worry about SPL injection from user input
 * here because:
 *   - `name` is independently validated against `NAME_PATTERN`
 *     which rejects backslashes and quotes outright.
 *   - `updatedAt` and `updatedBy` are produced by THIS module
 *     from `Date.now()` and `$C.USERNAME`, never user input.
 *   - `payload_json` is `JSON.stringify(...)` output, so it
 *     contains only ASCII-safe escapes itself; we just need to
 *     re-escape the JSON's own `\` and `"` for SPL's parser.
 */
const escapeSpl = (s: string): string =>
    s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

/**
 * Load every diagram row currently in the lookup. Used by both
 * `listDiagrams` (drops the payload column) and `loadDiagram`
 * (keeps it). Returns rows in CSV order; the UI sorts as needed.
 */
const fetchAllRows = async (): Promise<DiagramRow[]> => {
    if (!isInSplunkRuntime()) {
        return Array.from(MOCK_STORE.values()).sort((a, b) =>
            a.name.localeCompare(b.name)
        );
    }
    // The SPL filter intentionally selects only rows whose `name`
    // matches our friendly-name pattern. Garbage rows that
    // somehow got into the lookup outside of this service won't
    // appear in the picker (and thus can't crash the UI parser).
    let res;
    try {
        res = await runSearch({
            spl: '| inputlookup network_diagrams | fields name updated_at updated_by payload_json',
            earliestTime: '-1m',
            latestTime: 'now',
            tag: 'network_diagrams_list',
        });
    } catch (err) {
        throw new DiagramPersistenceError(
            err instanceof Error ? err.message : 'Lookup read failed'
        );
    }
    const rows = Array.isArray(res?.results) ? res.results : [];
    const out: DiagramRow[] = [];
    for (const row of rows) {
        const r = row as Record<string, unknown>;
        const name = optionalString(r['name']);
        if (!name || !NAME_PATTERN.test(name)) continue;
        out.push({
            name,
            updatedAt: optionalString(r['updated_at']),
            updatedBy: optionalString(r['updated_by']),
            payloadJson: optionalString(r['payload_json']),
        });
    }
    return out;
};

/**
 * Upsert a single row into `network_diagrams.csv` server-side.
 * Builds an SPL pipeline that:
 *   1. Reads the current lookup contents.
 *   2. Filters out any existing row with the same `name`.
 *   3. Appends a new row built with `makeresults | eval ...`.
 *   4. Sorts by name (stable picker order) and writes the whole
 *      result back via `outputlookup`.
 *
 * The whole pipeline runs as one search job, so splunkd treats
 * it as a single unit of work — no client-side read-modify-write
 * window where another save could clobber us mid-flight (beyond
 * the standard last-writer-wins semantics).
 */
const upsertRowSpl = async (row: DiagramRow): Promise<void> => {
    if (!isInSplunkRuntime()) {
        MOCK_STORE.set(row.name, row);
        return;
    }
    const safeName = escapeSpl(row.name);
    const safeUpdatedAt = escapeSpl(row.updatedAt);
    const safeUpdatedBy = escapeSpl(row.updatedBy);
    const safePayload = escapeSpl(row.payloadJson);
    // The trailing `| fields - _time` strips the field that
    // `makeresults` adds; the lookup schema doesn't include
    // `_time` and Splunk would otherwise persist it.
    const spl =
        '| inputlookup network_diagrams ' +
        `| where name != "${safeName}" ` +
        '| append [ ' +
        '| makeresults ' +
        `| eval name="${safeName}", updated_at="${safeUpdatedAt}", ` +
        `updated_by="${safeUpdatedBy}", payload_json="${safePayload}" ` +
        '| fields - _time ' +
        '] ' +
        '| sort name ' +
        '| outputlookup network_diagrams.csv';
    try {
        await runSearch({
            spl,
            earliestTime: '-1m',
            latestTime: 'now',
            tag: 'network_diagrams_save',
        });
    } catch (err) {
        throw new DiagramPersistenceError(
            err instanceof Error ? err.message : 'Lookup write failed'
        );
    }
};

/**
 * Delete a single row from `network_diagrams.csv` server-side.
 * Same shape as `upsertRowSpl` minus the `append` block.
 */
const deleteRowSpl = async (name: string): Promise<void> => {
    if (!isInSplunkRuntime()) {
        MOCK_STORE.delete(name);
        return;
    }
    const safeName = escapeSpl(name);
    const spl =
        '| inputlookup network_diagrams ' +
        `| where name != "${safeName}" ` +
        '| outputlookup network_diagrams.csv';
    try {
        await runSearch({
            spl,
            earliestTime: '-1m',
            latestTime: 'now',
            tag: 'network_diagrams_delete',
        });
    } catch (err) {
        throw new DiagramPersistenceError(
            err instanceof Error ? err.message : 'Lookup write failed'
        );
    }
};

/** Get the current Splunk username for the `updated_by` audit
 *  field. Best-effort only — falls back to `unknown` outside
 *  the runtime. */
const getCurrentUser = (): string => {
    if (typeof window === 'undefined') return 'unknown';
    const $C = (window as unknown as { $C?: Record<string, unknown> }).$C;
    if ($C && typeof $C === 'object') {
        const u = $C['USERNAME'];
        if (typeof u === 'string' && u.trim().length > 0) return u.trim();
    }
    return 'unknown';
};

/** Validate the JSON we're about to round-trip is in fact a
 *  shape we recognise. We don't inspect every field — just
 *  enough that a subtly-malformed row in the CSV won't take
 *  down the canvas. The canvas is expected to do its own
 *  defensive parsing on top. */
const validatePayload = (raw: unknown): SavedDiagramPayload => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new DiagramPersistenceError('Saved diagram payload is malformed.');
    }
    const p = raw as Partial<SavedDiagramPayload>;
    const nodes = Array.isArray(p.nodes) ? p.nodes : [];
    const edges = Array.isArray(p.edges) ? p.edges : [];
    const groups = Array.isArray(p.groups) ? p.groups : [];
    return {
        version: typeof p.version === 'number' ? p.version : DIAGRAM_PAYLOAD_VERSION,
        nodes: nodes as SavedDiagramNode[],
        edges: edges as SavedDiagramEdge[],
        groups: groups as SavedDiagramGroup[],
    };
};

/**
 * Return a directory of saved diagrams, lightest possible payload.
 * Used by the diagram-picker dropdown in the page header.
 */
export const listDiagrams = async (): Promise<DiagramSummary[]> => {
    const rows = await fetchAllRows();
    return rows.map(({ name, updatedAt, updatedBy }) => ({
        name,
        updatedAt,
        updatedBy,
    }));
};

/**
 * Load the named diagram's payload. Returns `null` when no such
 * diagram exists (so the caller can decide whether to show "not
 * found" or fall through to the New Diagram flow).
 */
export const loadDiagram = async (
    name: string
): Promise<SavedDiagramPayload | null> => {
    assertValidName(name);
    const rows = await fetchAllRows();
    const row = rows.find((r) => r.name === name);
    if (!row) return null;
    if (!row.payloadJson) {
        // Empty payload — treat as a fresh, blank diagram with this
        // name. (Shouldn't happen via this service, but handle it
        // gracefully if a row was inserted by hand.)
        return { version: DIAGRAM_PAYLOAD_VERSION, nodes: [], edges: [], groups: [] };
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(row.payloadJson);
    } catch (err) {
        throw new DiagramPersistenceError(
            `Saved diagram payload is not valid JSON: ${
                err instanceof Error ? err.message : 'parse error'
            }`
        );
    }
    return validatePayload(parsed);
};

/**
 * Upsert the diagram by name. The upsert is a single
 * server-side SPL job (`| inputlookup ... | where ... | append
 * [...] | outputlookup ...`) — last-writer-wins (see file
 * header). The existing-rows read+filter+append is done by
 * splunkd, so the browser never has to ship the full CSV.
 */
export const saveDiagram = async (
    name: string,
    payload: SavedDiagramPayload
): Promise<DiagramSummary> => {
    assertValidName(name);
    const safePayload: SavedDiagramPayload = {
        version: DIAGRAM_PAYLOAD_VERSION,
        nodes: Array.isArray(payload.nodes) ? payload.nodes : [],
        edges: Array.isArray(payload.edges) ? payload.edges : [],
        groups: Array.isArray(payload.groups) ? payload.groups : [],
    };
    const updatedAt = new Date().toISOString();
    const updatedBy = getCurrentUser();
    const payloadJson = JSON.stringify(safePayload);
    if (payloadJson.length > MAX_PAYLOAD_BYTES) {
        // Fail before we even attempt to dispatch — splunkd would
        // otherwise truncate or reject a multi-MB SPL string and
        // the operator would see an opaque toast.
        throw new DiagramPersistenceError(
            `Diagram is too large to save (${Math.round(
                payloadJson.length / 1024
            )} KiB; cap is ${Math.round(MAX_PAYLOAD_BYTES / 1024)} KiB). ` +
                'Try splitting it into multiple smaller diagrams.'
        );
    }
    await upsertRowSpl({ name, updatedAt, updatedBy, payloadJson });
    return { name, updatedAt, updatedBy };
};

/** Delete the named diagram. No-op if it doesn't exist. */
export const deleteDiagram = async (name: string): Promise<void> => {
    assertValidName(name);
    await deleteRowSpl(name);
};

/** Resolve to true iff `getSearchAppContext()` agrees the diagram
 *  service is targeting the right app. Used in tests to assert
 *  we never accidentally write to a different namespace. */
export const __debug_targetsApp = (): boolean =>
    getSearchAppContext() === LOOKUP_NAMESPACE;
