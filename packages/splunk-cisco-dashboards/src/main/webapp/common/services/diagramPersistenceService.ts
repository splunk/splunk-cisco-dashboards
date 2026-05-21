/**
 * diagramPersistenceService — read/write the
 * `network_diagrams.conf` config file that backs the Network
 * Diagram authoring page.
 *
 * Build 115.3 — migrated from the Build 108 `network_diagrams.csv`
 * lookup. Reasons for the migration:
 *   • Default + local layering — OOB diagrams live in
 *     `default/network_diagrams.conf`; operator saves write to
 *     `local/network_diagrams.conf`. A factory-reset is one
 *     `rm` command. CSV lookups don't have this layering at all
 *     (a customer save of an OOB-shipped diagram would clobber
 *     the OOB version on every install upgrade).
 *   • Per-stanza atomicity — saving one diagram only writes one
 *     stanza. The previous CSV pipeline (`| inputlookup ... |
 *     where ... | append [...] | outputlookup`) rewrote the
 *     entire CSV on every save, so two operators saving
 *     different diagrams concurrently could lose work.
 *   • Native btool introspection — `splunk btool
 *     network_diagrams list --debug` shows exactly which file
 *     contributed each key. CSV lookups have no such surface.
 *   • Hot reload via `[triggers] reload.network_diagrams =
 *     simple` in app.conf — see the spec there. Editing the conf
 *     from disk takes effect without a Splunkd restart.
 *
 * Persistence model — schema_version 2 (Build 115.5):
 *   • One **stanza** per saved diagram, named with the diagram's
 *     human-friendly name.
 *   • Schema is hybrid: human-meaningful metadata fields are
 *     promoted to first-class conf keys so btool / grep / SPL
 *     can introspect a diagram without parsing JSON. The body
 *     (nodes / edges / groups / title coordinates) is still a
 *     single `payload_json` blob — the canvas is the only
 *     consumer of that body and breaking it into 50+ flat keys
 *     gave us no measurable benefit at the cost of a much more
 *     fragile save/load path (see the schema review attached to
 *     the 115.5 design notes).
 *
 *     First-class keys, in order:
 *       schema_version   = 2 (always; missing → 1, treated as
 *                          a Build 115.3 legacy stanza below)
 *       title            = on-canvas title text (top of diagram).
 *                          Empty when no title set.
 *       description      = optional free-form description for
 *                          the picker tooltip / list view.
 *       updated_at       = ISO8601 timestamp of the last save.
 *       updated_by       = Splunk username of the last saver.
 *       node_count       = integer device-shape count.
 *       edge_count       = integer connector count.
 *       group_count      = integer region/group container count.
 *       asset_bindings   = comma-separated list of asset_inventory
 *                          device_names referenced by bound shapes.
 *                          Lets ops grep for "which diagrams use
 *                          host X?" without parsing JSON.
 *       payload_json     = the canonical body. JSON-encoded
 *                          { version, title, nodes, edges, groups }.
 *
 *   • Backward compatibility: stanzas written by Build 115.3 had
 *     only `updated_at`, `updated_by`, `payload_json`. They load
 *     unchanged — `loadDiagram` derives missing metadata from
 *     the parsed payload, and the next save naturally upgrades
 *     them to schema 2.
 *
 * Why the public Splunk REST surface for this:
 *   • Reads: `GET /servicesNS/-/<app>/configs/conf-network_diagrams`
 *     returns every stanza merged across default + local in a
 *     single call. We get parsed-key dicts, no CSV escape hell.
 *   • Writes: `POST /servicesNS/nobody/<app>/configs/conf-
 *     network_diagrams[/<stanza>]` upserts the stanza into
 *     `local/network_diagrams.conf`. We try the update path
 *     first (`/<stanza>`) and fall through to the create path
 *     (no stanza in URL, name= in body) on 404. Nothing in this
 *     flow touches the SPL search dispatcher.
 *
 * Concurrency: still last-writer-wins, but now PER-DIAGRAM
 * rather than per-file. Two operators editing different
 * diagrams simultaneously will both succeed without
 * interference; two operators editing the SAME diagram still
 * race, with the later save winning (acceptable for the
 * single-tenant authoring flow). If multi-user concurrent
 * editing of the same diagram becomes a real requirement, the
 * upgrade path is to add a `revision` key to each stanza and
 * include it in the PUT.
 *
 * Out-of-runtime fallback (local dev outside Splunk Web): all
 * methods short-circuit to a session-scoped in-memory store so
 * the UI is testable end-to-end against fixtures without a real
 * Splunk backend.
 */

import { getSearchAppContext } from './splunkSearchService';

/** Splunk app namespace this service must always target. Used by
 *  the `__debug_targetsApp` helper to assert tests don't
 *  accidentally point the persistence layer at a different app
 *  via `setSearchAppContext('...')`. The conf basename is inlined
 *  in each REST URL below (string-literal so it's never user-
 *  controlled). */
const LOOKUP_NAMESPACE = 'splunk-cisco-dashboards';

/** Splunk REST conf basename (appears in the `conf-<basename>`
 *  segment of the URL). Matches the file name in
 *  `default/network_diagrams.conf`. */
const CONF_BASENAME = 'network_diagrams';

/**
 * Allow only friendly names to land as conf stanzas. We use this
 * value both as the URL path segment in REST calls AND as the
 * stanza primary key, so it has to be safe for both. The ranges
 * chosen below cover ASCII letters/digits, spaces, `_`, `-`, `.`
 * — enough for "FDEM Production v2" / "fdem-prod-v2" style names
 * without opening up URL-injection, conf-stanza-injection, or
 * btool-CLI surprises. NOTE: spaces are URL-encoded by
 * `encodeURIComponent` before they hit the network.
 */
const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 _.\-]{0,63}$/;

const DIAGRAM_PAYLOAD_VERSION = 1;

/** Build 115.5 — current conf-stanza schema version. Bumped to 2
 *  when the metadata-promotion (Option C) hybrid schema landed.
 *  Missing or older values are tolerated on read via the legacy
 *  fallback in `coerceRow`. */
const CURRENT_SCHEMA_VERSION = 2;

/** Build 115.7 — names of the OOB ("factory") diagrams shipped in
 *  `default/network_diagrams.conf`. Source of truth is the
 *  generator (`scripts/generate_oob_diagrams.mjs`); this list is
 *  the runtime mirror used by the page to label/disable Delete
 *  appropriately for shipped diagrams.
 *
 *  Why hardcoded: the merged conf REST read can't tell us
 *  "this stanza name exists in default/" without a second
 *  request, and even an `acl.removable=false` signal is
 *  ambiguous between "factory diagram" and "permission denied".
 *  Maintaining this small list against the generator is far
 *  cheaper than threading a layer-detection round-trip. Add new
 *  entries here whenever `generate_oob_diagrams.mjs` ships a new
 *  stanza; the build verifies via SESSION_LOG conventions and
 *  the conf is regenerated regularly so a missed update is
 *  surfaced quickly.
 *
 *  NOTE: stanza names must match the .conf headers exactly,
 *  including capitalisation and punctuation. */
const FACTORY_DIAGRAM_NAMES: ReadonlySet<string> = new Set<string>([
    'Splunk Cloud Deployment Architecture',
    'Single Server Deployment - S1',
    'Distributed Clustered Single Site - C1 C11',
    'Distributed Clustered with SHC Single Site - C3 C13',
    'Distributed Non-Clustered - D1 D11',
    'Multi-Site Clustered - M2 M12',
    'Multi-Site Clustered with SHC - M3 M13',
    'Multi-Site Stretched SHC - M4 M14',
    'HEC Topology Choices',
    'Data Collection Node Topology',
    'Data Collection Using Kafka and HEC',
    'Intermediary Forwarding Topology',
    'Data Collection Topology Overview',
]);

/** Public predicate: is the given stanza name one of the factory
 *  diagrams shipped in the app's `default/network_diagrams.conf`?
 *  Page UI uses this to grey out the Delete button (or relabel it
 *  to Revert) on shipped diagrams. */
export const isFactoryDiagram = (name: string | null | undefined): boolean => {
    if (!name) return false;
    return FACTORY_DIAGRAM_NAMES.has(name);
};

/**
 * Hard cap on the JSON payload we'll persist in a single conf
 * stanza. Splunk's conf parser nominally tolerates very long
 * lines, but customers running btool / `splunk show config`
 * appreciate not having a single 1 MiB key in their dump. The
 * cap is enforced client-side to fail fast with a friendly error
 * instead of letting the dispatcher send a multi-megabyte POST
 * body and have splunkd reject it. 256 KiB covers a diagram with
 * ~1000 nodes + ~500 edges + ~50 region groups; if a real
 * customer ever hits this we'll add chunked saves (Build 116+).
 */
const MAX_PAYLOAD_BYTES = 256 * 1024;

/**
 * The payload shape stored in the stanza's `payload_json` value.
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
    /** Optional on-canvas title (Build 113). When present, the
     *  canvas renders a transparent, font-customisable headline
     *  node at the operator's chosen position. Older saved
     *  payloads without this field load fine — the validator
     *  preserves it as `undefined`. */
    title?: SavedDiagramTitle;
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
    /** Build 115: per-node vendor override. When unset, the
     *  canvas pulls vendor from the bound `assetId`'s row in
     *  `asset_inventory.csv`. Operators can hand-set this for
     *  hand-placed shapes from the palette (e.g. a generic
     *  router shape representing an MFN provider router that
     *  doesn't appear in asset_inventory). */
    vendor?: string;
    /** Build 115: per-node model override (e.g. `WS-C6504-E`,
     *  `BIG-IP i5800`). Same fallback semantics as `vendor`. */
    model?: string;
    /** Build 115.13 — operator-supplied IPv4 / IPv6 / management
     *  address. Surfaces as a small mono-font row at the bottom
     *  of the device card and is gated by the page-level "Show
     *  IPs" toggle so the operator can hide every address before
     *  sharing the diagram screenshot. When absent, the card
     *  falls back to `node.raw['ip_address']` from the bound
     *  asset_inventory row (if any). Empty string → clear the
     *  override; `undefined` → no change. */
    ipAddress?: string;
    /** Build 115.21 — user-imported stencil artwork. Diagrams
     *  persist the exact asset dropped onto the canvas so a saved
     *  diagram keeps rendering even if the operator later clears
     *  their local custom-shape library. */
    customStencil?: CustomStencilAsset;
    /** Build 115.1: free-placement textbox styling. Only present
     *  when `type === 'textBox'`. Carries everything needed to
     *  re-hydrate the on-canvas annotation: text, fontSize, color,
     *  weight/italic, optional fill/border, alignment. Kept as a
     *  single optional sub-object (rather than top-level fields)
     *  so non-textbox nodes don't carry dead schema and a future
     *  migration to "richer annotations" (e.g. multi-line bullet
     *  lists) lives here cleanly. */
    textBox?: {
        text: string;
        fontSize: number;
        color: string;
        bold?: boolean;
        italic?: boolean;
        background?: string;
        border?: string;
        align?: 'left' | 'center' | 'right';
    };
}

export interface CustomStencilAsset {
    id: string;
    label: string;
    src: string;
    mediaType: 'image/svg+xml' | 'image/png';
    width?: number;
    height?: number;
}

export interface SavedDiagramEdge {
    id: string;
    sourceId: string;
    targetId: string;
    /** Edge style category (drives solid vs dashed, color, animation). */
    kind: 'physical' | 'synthetic_a2a' | 'logical';
    /** Arrowhead direction (Build 113):
     *    • `none`     → no arrowheads (passive line)
     *    • `forward`  → arrow at target end (source → target)
     *    • `backward` → arrow at source end (target → source)
     *    • `both`     → bi-directional, arrowhead at each end
     *  Default for older saved payloads (no `direction` field) is
     *  `none` so existing diagrams render unchanged. New edges
     *  drawn in the canvas default to `forward`. */
    direction?: 'none' | 'forward' | 'backward' | 'both';
    /** Build 114: hex colour for the edge's flowing-dot animation.
     *  Animation is implicit when `direction !== 'none'`; this
     *  field only controls the dot's colour. Falls back to a
     *  per-`kind` default (sky for synthetic, slate for physical /
     *  logical) when omitted. */
    animationColor?: string;
    /** Build 115.5: hex colour for the edge LINE itself (the
     *  stroke). Distinct from `animationColor` (which only tints
     *  the moving dots). When omitted, the line falls back to
     *  the per-`kind` default palette so existing diagrams
     *  render unchanged. Operators asked for line-colour control
     *  because grouping by colour is the fastest way to read a
     *  busy multi-VRF / multi-fabric topology — colour the L3
     *  hops red and the L2 trunks blue, scan in 2 seconds. */
    lineColor?: string;
    /** Build 115.11 — arrowhead glyph style. Operators asked for
     *  alternatives to the default closed-triangle marker because
     *  it reads heavy on dense diagrams. We expose three React
     *  Flow built-ins plus two custom SVG markers we inject into
     *  the canvas's <defs> at render time:
     *    • 'closed' (default) — filled triangle, classic Visio.
     *    • 'open'             — open chevron, lighter look.
     *    • 'thin'             — narrow chevron, subtle.
     *    • 'dot'              — small filled circle (terminator).
     *    • 'diamond'          — filled diamond rhombus.
     *  Older saved payloads without this field render with
     *  'closed' for backwards compatibility. */
    arrowStyle?: 'closed' | 'open' | 'thin' | 'dot' | 'diamond';
    /** Build 115.11 — when true, the edge stroke colour is driven
     *  by the live reporting status of the bound endpoints rather
     *  than `lineColor` / per-kind defaults. Mirrors the site
     *  connector animation in the Florida overview dashboard:
     *  green dashes when both ends are healthy, red dashes when
     *  either end is silent in `| metadata type=hosts`. The
     *  visible dash period matches the existing flowing-dot
     *  cycle so the two animations look intentional together. */
    liveStatus?: boolean;
    /** Free-form midpoint label (e.g. "100Mbps", "VLAN 50"). */
    label?: string;
    /** Optional layer chip (e.g. "L2", "L3") shown alongside the label. */
    layer?: string;
    notes?: string;
    /** Build 115.1: source / target HANDLE ids — i.e. which port
     *  on each node the edge actually attaches to. React Flow
     *  exposes a ring of named handles per node ("left-source",
     *  "right-source", "top-target", etc.); without persisting
     *  these, every saved edge re-renders glued to the default
     *  top-centre handle on load (the "edges snap back to top
     *  after save" bug). Optional so older saved payloads load
     *  unchanged — they just keep the default handle behaviour
     *  they had before. */
    sourceHandle?: string;
    targetHandle?: string;
    /** Build 115.20 — exact endpoint anchors inside each node,
     *  stored as normalised 0..1 coordinates relative to the
     *  node's current bounds. This lets diagram connectors land
     *  anywhere on a device face (Visio-style) instead of snapping
     *  back to one of the four named React Flow side handles. */
    sourceAnchor?: DiagramEdgeAnchor;
    targetAnchor?: DiagramEdgeAnchor;
}

export interface DiagramEdgeAnchor {
    x: number;
    y: number;
}

/**
 * On-canvas diagram title (Build 113). Rendered as a transparent,
 * borderless headline that the operator can drag, resize-by-typing,
 * and restyle (font size, colour, bold/italic). Distinct from the
 * `name` of the diagram (which is the stanza identifier shown in
 * the page header / picker dropdown) — this is the title the
 * operator wants to *read on the diagram itself*.
 */
export interface SavedDiagramTitle {
    text: string;
    /** Position in flow coordinates so the title scales with zoom. */
    x: number;
    y: number;
    /** Pixel font-size (clamped 12 – 96 by the inspector). */
    fontSize: number;
    /** Hex colour string (e.g. `#0f172a`). */
    color: string;
    bold?: boolean;
    italic?: boolean;
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
    /** Build 115.5 — promoted metadata visible to the diagram
     *  picker so the dropdown can render a richer line ("Splunk
     *  Cloud Production · 12 nodes · 14 edges") without us
     *  having to fetch and parse the body of every diagram. */
    title?: string;
    description?: string;
    nodeCount?: number;
    edgeCount?: number;
    groupCount?: number;
    /** Comma-list copied straight from the conf field (no
     *  parsing) — surfaced for places that want to filter the
     *  picker by host membership in future. */
    assetBindings?: string;
    schemaVersion?: number;
    /** Build 115.7 — true iff the stanza currently exists in the
     *  app's `local/network_diagrams.conf` overlay (and the user
     *  has permission to remove it). Mirrors the `acl.removable`
     *  flag that the conf REST endpoint returns per entry.
     *
     *  Combined with `isFactoryDiagram(name)` this lets the UI
     *  distinguish three states without a second REST round-trip:
     *    • factory + !hasLocalOverride → Delete disabled (the
     *      stanza only lives in default/, REST DELETE is a no-op).
     *    • factory +  hasLocalOverride → "Revert" instead of
     *      Delete; clearing the local stanza re-exposes the
     *      shipped default.
     *    • custom  +  hasLocalOverride → regular delete.
     *
     *  False (or undefined) is the safe default — disable Delete
     *  on anything we can't prove is removable. */
    hasLocalOverride?: boolean;
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

/** Build 115.5 — coerce a possibly-stringy conf value to a
 *  finite non-negative integer. Splunk REST returns every field
 *  as a string ("12", not 12). Empty / NaN / negative → undefined
 *  so the consumer can decide between "absent" and "explicitly 0". */
const optionalInt = (raw: unknown): number | undefined => {
    if (raw === undefined || raw === null) return undefined;
    const s = typeof raw === 'string' ? raw.trim() : String(raw);
    if (!s) return undefined;
    const n = Number.parseInt(s, 10);
    if (!Number.isFinite(n) || n < 0) return undefined;
    return n;
};

/** Build 115.5 — extract the comma-separated asset_bindings list
 *  for serialisation. We sort + dedupe so two saves of the same
 *  payload produce byte-identical conf output (helps git diffs
 *  on local/network_diagrams.conf and stops btool from
 *  flagging spurious "changed" entries). */
const computeAssetBindings = (payload: SavedDiagramPayload): string => {
    const bound = new Set<string>();
    for (const n of payload.nodes ?? []) {
        // Build 115.3 onwards: bound shapes carry an explicit
        // assetId. Pre-115.3 stanzas may carry the assetId as the
        // node `id` itself for inventory drops; we don't try to
        // reconstruct that here — only freshly-saved nodes
        // populate the bindings list.
        const assetId = (n as { assetId?: string }).assetId;
        if (typeof assetId === 'string' && assetId.trim().length > 0) {
            bound.add(assetId.trim());
        }
    }
    return Array.from(bound).sort().join(',');
};

/** Build 115.5 — header text from the canvas title (if any) is
 *  the closest thing to a "title" of the diagram itself. We
 *  prefer this for `title=` in the stanza so the picker sees
 *  what the operator typed on the canvas, not the (often
 *  shorter) stanza name. */
const computeDiagramTitle = (payload: SavedDiagramPayload): string => {
    const t = payload.title?.text;
    return typeof t === 'string' ? t.trim() : '';
};

/**
 * Read the splunkweb CSRF cookie set by the Splunk Web runtime.
 * Splunk requires this header (`X-Splunk-Form-Key`) on all
 * mutating REST calls dispatched through the `__raw` proxy. The
 * cookie name is `splunkweb_csrf_token_<port>`; we match any
 * suffix to stay port-independent.
 */
const getCsrfToken = (): string | null => {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(/(?:^|;\s*)splunkweb_csrf_token_\w+=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
};

const buildBaseUrl = (
    appName: string,
    forWrite: boolean
): string => {
    // Read paths use `/-/` (default user) so default + local
    // stanzas merge transparently. Write paths use `/nobody/` so
    // the change lands in the app's `local/` namespace and is
    // visible to every user, not user-scoped private storage.
    const owner = forWrite ? 'nobody' : '-';
    return `/en-US/splunkd/__raw/servicesNS/${owner}/${encodeURIComponent(
        appName
    )}/configs/conf-${CONF_BASENAME}`;
};

/**
 * Translate the REST error vocabulary into a sentence operators
 * can act on. Splunk REST surfaces a JSON envelope with
 * `messages: [{ type, text }]`; raw HTTP status codes mostly
 * reflect auth state. This function massages both into a single
 * human-friendly toast string.
 */
const friendlyMessage = (
    status: number,
    body: unknown,
    verb: string
): string => {
    const messages = Array.isArray(
        (body as { messages?: Array<{ text?: string }> })?.messages
    )
        ? (body as { messages: Array<{ text?: string }> }).messages
        : [];
    const detail = messages
        .map((m) => (typeof m?.text === 'string' ? m.text : ''))
        .filter((t) => t.length > 0)
        .join('; ');
    if (status === 401 || status === 403) {
        // Build 115.18 — disambiguate the two common 401 / 403
        // causes. CSRF failures (the splunkweb_csrf_token_<port>
        // cookie is missing or stale) are by far the most common
        // and are fixed by a page reload, NOT by changing role
        // permissions. We try to detect that signal in the
        // server's error envelope text and recommend a reload
        // first; otherwise we fall back to the generic
        // permissions hint.
        const looksLikeCsrf =
            /csrf/i.test(detail) ||
            // Fallback heuristic: 401 with no CSRF cookie present
            // in the browser is almost always a stale-session
            // CSRF rather than a permissions failure.
            (status === 401 && getCsrfToken() === null);
        if (looksLikeCsrf) {
            return (
                `Couldn't ${verb}: Splunk session token is stale (HTTP ${status} ${
                    detail || 'CSRF validation failed'
                }). ` +
                'Reload the page to refresh the CSRF cookie, then try the ' +
                'save again. Your in-progress diagram is preserved on the canvas ' +
                'until you reload, so copy any unsaved annotations to a safe place ' +
                'before refreshing.'
            );
        }
        return (
            `Couldn't ${verb}: authentication or authorisation failed (HTTP ${status})${
                detail ? ` — ${detail}` : ''
            }. ` +
            'Check that your role has write access to network_diagrams.conf ' +
            '(default ACL: admin / sc_admin / power), then reload the page.'
        );
    }
    if (status === 409) {
        return (
            `Couldn't ${verb}: a conflicting save just landed. ` +
            'Reload the diagram and re-apply your changes.'
        );
    }
    if (status >= 500) {
        return (
            `Couldn't ${verb}: Splunk reported an internal error (HTTP ${status})` +
            (detail ? `: ${detail}` : '') +
            '. Retry; if it persists, check splunkd.log.'
        );
    }
    if (detail) {
        return `Couldn't ${verb}: ${detail}`;
    }
    return `Couldn't ${verb}: HTTP ${status}.`;
};

const withRetry = async <T>(
    fn: () => Promise<T>,
    maxAttempts = 3
): Promise<T> => {
    let lastErr: unknown;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        try {
            return await fn();
        } catch (err) {
            lastErr = err;
            if (attempt < maxAttempts - 1) {
                const delayMs = 250 * (attempt === 0 ? 1 : 3);
                await new Promise<void>((resolve) => {
                    setTimeout(resolve, delayMs);
                });
            }
        }
    }
    throw lastErr;
};

/**
 * Splunk REST entry as returned by `/configs/conf-<file>` GET.
 * Each `entry[]` element corresponds to one stanza; `name` is
 * the stanza name and `content` is the key/value dict.
 *
 * `acl.removable` (Build 115.7) tells us whether splunkd would
 * accept a DELETE on this stanza. It's `true` only when the
 * stanza exists in the writable layer (typically `local/`) AND
 * the current user has permission to remove it. We surface this
 * up to the page so the Delete button can be greyed out for
 * factory-only stanzas instead of failing silently when REST
 * declines the request.
 */
interface ConfRestEntry {
    name?: string;
    content?: Record<string, unknown>;
    acl?: {
        removable?: boolean;
        [key: string]: unknown;
    };
}

/**
 * Fetch every diagram stanza currently in the conf. Used by both
 * `listDiagrams` (drops the payload key) and `loadDiagram`
 * (keeps it). Returns rows in arbitrary stanza order; the UI
 * sorts as needed.
 */
const fetchAllRows = async (): Promise<DiagramRow[]> => {
    if (!isInSplunkRuntime()) {
        return Array.from(MOCK_STORE.values()).sort((a, b) =>
            a.name.localeCompare(b.name)
        );
    }
    const appName = getSearchAppContext();
    const headers: Record<string, string> = { Accept: 'application/json' };
    const csrf = getCsrfToken();
    if (csrf) headers['X-Splunk-Form-Key'] = csrf;
    const url = `${buildBaseUrl(appName, false)}?output_mode=json&count=0`;

    let res: Response;
    try {
        res = await withRetry(() =>
            fetch(url, {
                method: 'GET',
                credentials: 'include',
                headers,
            })
        );
    } catch (err) {
        throw new DiagramPersistenceError(
            `Couldn't load the saved diagrams: network error — ${
                err instanceof Error ? err.message : String(err)
            }`
        );
    }
    if (!res.ok) {
        let body: unknown = null;
        try {
            body = await res.json();
        } catch {
            // ignore body parse errors — the status code is enough
        }
        throw new DiagramPersistenceError(
            friendlyMessage(res.status, body, 'load the saved diagrams'),
            res.status
        );
    }
    const json = (await res.json()) as { entry?: ConfRestEntry[] };
    const entries = Array.isArray(json.entry) ? json.entry : [];
    const out: DiagramRow[] = [];
    for (const e of entries) {
        const name = optionalString(e.name);
        // Skip the magic `default` stanza Splunk auto-injects with
        // server-side defaults — it's not a real diagram.
        if (!name || name === 'default') continue;
        if (!NAME_PATTERN.test(name)) continue;
        // Build 115.7 — propagate `acl.removable` so the page can
        // tell whether DELETE will actually do anything (true only
        // when the stanza exists in local/ and the user has
        // permission to remove it).
        const hasLocalOverride = e.acl?.removable === true;
        out.push(coerceRow(name, e.content ?? {}, hasLocalOverride));
    }
    return out;
};

/** Build 115.5 — turn a single REST `content` dict into a
 *  `DiagramRow`. Handles the two on-disk schema versions:
 *
 *    • schema_version = 2 (current): every metadata field is a
 *      first-class conf key; we read them directly. `payload_json`
 *      still holds the body (nodes / edges / groups / title).
 *
 *    • schema_version missing OR = 1 (Build 115.3 legacy): only
 *      `updated_at`, `updated_by`, `payload_json` were written.
 *      We derive title / counts / asset_bindings from the parsed
 *      payload on the fly so the in-memory `DiagramRow` always
 *      looks "current" to callers. The next save naturally
 *      promotes the stanza to schema 2 (see `upsertRowRest`).
 *
 *  We keep parse failures soft: a malformed `payload_json` still
 *  returns a row with the name + audit fields; the body just
 *  comes back empty. The picker can show the entry as
 *  "(unparseable)" instead of vanishing entirely. */
const coerceRow = (
    name: string,
    content: Record<string, unknown>,
    hasLocalOverride: boolean
): DiagramRow => {
    const payloadJson = optionalString(content['payload_json']);
    const explicitVersion = optionalInt(content['schema_version']);
    const isLegacy = explicitVersion === undefined || explicitVersion < 2;

    // Fast-path: schema 2 — trust the on-disk metadata.
    if (!isLegacy) {
        return {
            name,
            updatedAt: optionalString(content['updated_at']),
            updatedBy: optionalString(content['updated_by']),
            schemaVersion: explicitVersion,
            title: optionalString(content['title']),
            description: optionalString(content['description']),
            nodeCount: optionalInt(content['node_count']),
            edgeCount: optionalInt(content['edge_count']),
            groupCount: optionalInt(content['group_count']),
            assetBindings: optionalString(content['asset_bindings']),
            hasLocalOverride,
            payloadJson,
        };
    }

    // Legacy: derive metadata from the parsed body. We tolerate
    // payload parse errors by returning empty / zero counts —
    // the operator still sees the stanza name + audit fields in
    // the picker and can re-save to upgrade.
    let title = '';
    let nodeCount: number | undefined;
    let edgeCount: number | undefined;
    let groupCount: number | undefined;
    let assetBindings: string | undefined;
    if (payloadJson) {
        try {
            const parsed = JSON.parse(payloadJson) as Partial<SavedDiagramPayload>;
            const safe = validatePayload(parsed);
            title = computeDiagramTitle(safe);
            nodeCount = safe.nodes.length;
            edgeCount = safe.edges.length;
            groupCount = safe.groups.length;
            assetBindings = computeAssetBindings(safe);
        } catch {
            // Soft-fail: leave derived metadata undefined.
        }
    }
    return {
        name,
        updatedAt: optionalString(content['updated_at']),
        updatedBy: optionalString(content['updated_by']),
        schemaVersion: 1,
        title,
        nodeCount,
        edgeCount,
        groupCount,
        assetBindings,
        hasLocalOverride,
        payloadJson,
    };
};

/**
 * Upsert a single stanza into `local/network_diagrams.conf` via
 * the Splunk REST conf endpoint.
 *
 * Splunk's conf REST surface splits create vs update across two
 * different URLs:
 *   • CREATE → `POST /configs/conf-<file>`         body: `name=<stanza>&...keys`
 *   • UPDATE → `POST /configs/conf-<file>/<name>`  body: `...keys`
 *
 * We try UPDATE first; on 404 (stanza doesn't exist yet) we fall
 * through to CREATE. That keeps the happy path one-round-trip
 * and avoids a separate "exists?" probe.
 */
const upsertRowRest = async (row: DiagramRow): Promise<void> => {
    if (!isInSplunkRuntime()) {
        MOCK_STORE.set(row.name, row);
        return;
    }
    const appName = getSearchAppContext();
    const headers: Record<string, string> = {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
    };
    const csrf = getCsrfToken();
    if (csrf) headers['X-Splunk-Form-Key'] = csrf;

    // Build 115.5 — write the schema-2 metadata fields alongside
    // the body. Empty strings are written explicitly (rather than
    // omitted) so a save that clears the title doesn't leave
    // a stale value behind from a previous save in local/.
    const sharedFields = new URLSearchParams({
        schema_version: String(row.schemaVersion ?? CURRENT_SCHEMA_VERSION),
        title: row.title ?? '',
        description: row.description ?? '',
        updated_at: row.updatedAt,
        updated_by: row.updatedBy,
        node_count: String(row.nodeCount ?? 0),
        edge_count: String(row.edgeCount ?? 0),
        group_count: String(row.groupCount ?? 0),
        asset_bindings: row.assetBindings ?? '',
        payload_json: row.payloadJson,
        // `output_mode=json` makes Splunk return a structured
        // error envelope instead of XML, which the friendly
        // message formatter relies on.
        output_mode: 'json',
    });

    const updateUrl = `${buildBaseUrl(appName, true)}/${encodeURIComponent(row.name)}`;
    let res: Response;
    try {
        res = await withRetry(() =>
            fetch(updateUrl, {
                method: 'POST',
                credentials: 'include',
                headers,
                body: sharedFields.toString(),
            })
        );
    } catch (err) {
        throw new DiagramPersistenceError(
            `Couldn't save the diagram: network error — ${
                err instanceof Error ? err.message : String(err)
            }`
        );
    }
    if (res.ok) return;

    if (res.status === 404) {
        // Stanza doesn't exist yet — fall through to create.
        const createBody = new URLSearchParams(sharedFields);
        createBody.set('name', row.name);
        let createRes: Response;
        try {
            createRes = await withRetry(() =>
                fetch(buildBaseUrl(appName, true), {
                    method: 'POST',
                    credentials: 'include',
                    headers,
                    body: createBody.toString(),
                })
            );
        } catch (err) {
            throw new DiagramPersistenceError(
                `Couldn't save the diagram: network error — ${
                    err instanceof Error ? err.message : String(err)
                }`
            );
        }
        if (!createRes.ok) {
            let body: unknown = null;
            try {
                body = await createRes.json();
            } catch {
                /* ignore */
            }
            throw new DiagramPersistenceError(
                friendlyMessage(createRes.status, body, 'save the diagram'),
                createRes.status
            );
        }
        return;
    }

    let body: unknown = null;
    try {
        body = await res.json();
    } catch {
        /* ignore */
    }
    throw new DiagramPersistenceError(
        friendlyMessage(res.status, body, 'save the diagram'),
        res.status
    );
};

/**
 * Delete a single stanza from `local/network_diagrams.conf`.
 * Note: this only affects the `local/` overlay — diagrams shipped
 * in `default/` re-appear after the delete, which is the expected
 * factory-reset behaviour. If a customer truly wants to hide an
 * OOB diagram, they can save an override stanza with an empty
 * payload and ignore it in the picker — but we don't expose that
 * UX today.
 */
const deleteRowRest = async (name: string): Promise<void> => {
    if (!isInSplunkRuntime()) {
        MOCK_STORE.delete(name);
        return;
    }
    const appName = getSearchAppContext();
    const headers: Record<string, string> = {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
    };
    const csrf = getCsrfToken();
    if (csrf) headers['X-Splunk-Form-Key'] = csrf;

    const url = `${buildBaseUrl(appName, true)}/${encodeURIComponent(name)}?output_mode=json`;
    let res: Response;
    try {
        res = await withRetry(() =>
            fetch(url, {
                method: 'DELETE',
                credentials: 'include',
                headers,
            })
        );
    } catch (err) {
        throw new DiagramPersistenceError(
            `Couldn't delete the diagram: network error — ${
                err instanceof Error ? err.message : String(err)
            }`
        );
    }
    // 404 is a no-op success: the stanza was already gone (or
    // only existed in default/, which we can't delete via REST
    // anyway).
    if (res.ok || res.status === 404) return;
    let body: unknown = null;
    try {
        body = await res.json();
    } catch {
        /* ignore */
    }
    throw new DiagramPersistenceError(
        friendlyMessage(res.status, body, 'delete the diagram'),
        res.status
    );
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
 *  enough that a subtly-malformed stanza in the conf won't take
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
    // Title is optional; only carry it through if it has a string
    // text and finite numeric coordinates. Anything malformed falls
    // back to "no title" rather than corrupting the canvas.
    let title: SavedDiagramTitle | undefined;
    if (p.title && typeof p.title === 'object') {
        const t = p.title as Partial<SavedDiagramTitle>;
        if (
            typeof t.text === 'string' &&
            Number.isFinite(t.x) &&
            Number.isFinite(t.y) &&
            Number.isFinite(t.fontSize)
        ) {
            title = {
                text: t.text,
                x: t.x as number,
                y: t.y as number,
                fontSize: t.fontSize as number,
                color: typeof t.color === 'string' ? t.color : '#0f172a',
                bold: t.bold === true,
                italic: t.italic === true,
            };
        }
    }
    return {
        version: typeof p.version === 'number' ? p.version : DIAGRAM_PAYLOAD_VERSION,
        nodes: nodes as SavedDiagramNode[],
        edges: edges as SavedDiagramEdge[],
        groups: groups as SavedDiagramGroup[],
        title,
    };
};

/**
 * Return a directory of saved diagrams, lightest possible payload.
 * Used by the diagram-picker dropdown in the page header.
 */
export const listDiagrams = async (): Promise<DiagramSummary[]> => {
    const rows = await fetchAllRows();
    // Build 115.5 — promote every metadata field through the
    // summary so the picker can render a richer one-line preview
    // ("Splunk Cloud Production · 12 nodes / 14 edges") without
    // a second REST round-trip per row.
    return rows.map(
        ({
            name,
            updatedAt,
            updatedBy,
            schemaVersion,
            title,
            description,
            nodeCount,
            edgeCount,
            groupCount,
            assetBindings,
            hasLocalOverride,
        }) => ({
            name,
            updatedAt,
            updatedBy,
            schemaVersion,
            title,
            description,
            nodeCount,
            edgeCount,
            groupCount,
            assetBindings,
            hasLocalOverride,
        })
    );
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
        // gracefully if a stanza was inserted by hand.)
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
 * Upsert the diagram by name. The upsert is a single REST POST
 * to `/configs/conf-network_diagrams[/<stanza>]`. Per-stanza
 * atomic from splunkd's perspective — last-writer-wins
 * concurrency at the diagram level (see file header).
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
        title: payload.title,
    };
    const updatedAt = new Date().toISOString();
    const updatedBy = getCurrentUser();
    const payloadJson = JSON.stringify(safePayload);
    if (payloadJson.length > MAX_PAYLOAD_BYTES) {
        // Fail before we even attempt to dispatch — splunkd would
        // otherwise reject a multi-MB POST body and the operator
        // would see an opaque toast.
        throw new DiagramPersistenceError(
            `Diagram is too large to save (${Math.round(
                payloadJson.length / 1024
            )} KiB; cap is ${Math.round(MAX_PAYLOAD_BYTES / 1024)} KiB). ` +
                'Try splitting it into multiple smaller diagrams.'
        );
    }
    // Build 115.5 — derive the schema-2 metadata fields from the
    // body once, on save. Cheaper than re-deriving on every read,
    // and guarantees on-disk metadata stays consistent with the
    // payload (a partial save can't drift them apart).
    const title = computeDiagramTitle(safePayload);
    const assetBindings = computeAssetBindings(safePayload);
    const row: DiagramRow = {
        name,
        updatedAt,
        updatedBy,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        title,
        // `description` is reserved for a future operator field;
        // we always write empty for now so the conf has the slot
        // and a hand-edit just needs to add a value, not the key.
        description: '',
        nodeCount: safePayload.nodes.length,
        edgeCount: safePayload.edges.length,
        groupCount: safePayload.groups.length,
        assetBindings,
        // A successful save lands a stanza in `local/`, which makes
        // it removable. We set this both on the row we send to
        // upsert (so the MOCK_STORE branch behaves consistently in
        // local-dev) and on the returned summary above.
        hasLocalOverride: true,
        payloadJson,
    };
    await upsertRowRest(row);
    return {
        name,
        updatedAt,
        updatedBy,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        title,
        description: '',
        nodeCount: row.nodeCount,
        edgeCount: row.edgeCount,
        groupCount: row.groupCount,
        assetBindings,
        // A successful save always produces a local-layer stanza,
        // so the saved diagram is removable from this point on.
        hasLocalOverride: true,
    };
};

/** Delete the named diagram. No-op if it doesn't exist (or only
 *  exists in `default/` — Splunk's REST won't let you DELETE
 *  default-shipped stanzas, which is by design). */
export const deleteDiagram = async (name: string): Promise<void> => {
    assertValidName(name);
    await deleteRowRest(name);
};

/** Resolve to true iff `getSearchAppContext()` agrees the diagram
 *  service is targeting the right app. Used in tests to assert
 *  we never accidentally write to a different namespace. */
export const __debug_targetsApp = (): boolean =>
    getSearchAppContext() === LOOKUP_NAMESPACE;
