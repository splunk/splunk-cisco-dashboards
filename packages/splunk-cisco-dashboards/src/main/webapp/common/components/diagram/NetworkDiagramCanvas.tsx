/**
 * NetworkDiagramCanvas — the authoring surface for the Network
 * Diagram page (Build 106).
 *
 * Where this differs from `TopologyCanvas` (the live-overlay
 * canvas):
 *   • No auto-discovery on mount — the canvas starts blank (or
 *     hydrated from a saved diagram payload) and trusts the
 *     operator to populate it via the palette.
 *   • No ELK auto-layout — operators place nodes themselves; the
 *     layout *is* the artefact.
 *   • Persistence target is the `network_diagrams` lookup, not
 *     localStorage. The parent page (`pages/network_diagram/
 *     index.tsx`) owns the save/load lifecycle; the canvas just
 *     emits `onChange(payload)` whenever the graph mutates and
 *     accepts an `initialPayload` to hydrate from.
 *   • A new region/group node type (`regionGroup`, defined in
 *     `RegionGroupNode.tsx`) is added to the React Flow node-
 *     types map; devices dropped inside a region inherit
 *     `parentId` so dragging a region drags its devices.
 *
 * Data flow (canvas-internal):
 *
 *   ┌────────────────────────────┐         ┌──────────────────┐
 *   │ Palette (drag source)      │         │ PropertiesPanel  │
 *   └─────────────┬──────────────┘         │ (right inspector)│
 *                 │ DnD payload            └────────┬─────────┘
 *                 ▼                                 │
 *   ┌──────────────────────────────────────────────▼─────────┐
 *   │ NetworkDiagramCanvas                                   │
 *   │  ┌──────────────────────────────────────────────────┐  │
 *   │  │ ReactFlow (nodes, edges, drop, connect, click)   │  │
 *   │  └──────────────────────────────────────────────────┘  │
 *   │  setNodes / setEdges → derive SavedDiagramPayload →    │
 *   │  onChange(payload) → page persists to lookup           │
 *   └────────────────────────────────────────────────────────┘
 *
 * The canvas is intentionally NOT debounced internally. Marking
 * dirty + auto-save scheduling is the page's job; the canvas
 * just reports every mutation.
 */

import React, {
    useCallback,
    useEffect,
    useImperativeHandle,
    useMemo,
    useReducer,
    useRef,
    useState,
} from 'react';
import {
    Trash2,
    Undo2,
    Redo2,
    AlertTriangle,
    Info,
    X as XIcon,
    ZoomIn,
    ZoomOut,
    House,
    Maximize2,
    HelpCircle,
} from 'lucide-react';
import {
    ReactFlow,
    ReactFlowProvider,
    MiniMap,
    Background,
    BackgroundVariant,
    MarkerType,
    applyNodeChanges,
    applyEdgeChanges,
    useReactFlow,
    useOnViewportChange,
    type Node as RFNode,
    type Edge as RFEdge,
    type FinalConnectionState,
    type HandleType,
    type NodeChange,
    type EdgeChange,
    type ReactFlowInstance,
    type XYPosition,
    type EdgeMarker,
    type Viewport,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { cn } from '@/common/lib/utils';
import { TOPOLOGY_NODE_TYPES } from '@/common/components/topology/shapes';
import {
    PropertiesPanel,
    type Selection,
    type NodeUpdate,
    type TitleUpdate,
    type RegionUpdate,
    type TextBoxUpdate,
    type EdgeUpdate,
    type EdgeDirection,
} from '@/common/components/topology/PropertiesPanel';
import {
    type DeviceShapeId,
    type HealthStatus,
    type TopologyDiscoveredNode,
} from '@/common/services/topologyDiscovery';
import {
    type SavedDiagramPayload,
    type SavedDiagramNode,
    type SavedDiagramEdge,
    type SavedDiagramGroup,
    type SavedDiagramTitle,
    type DiagramEdgeAnchor,
    type CustomStencilAsset,
} from '@/common/services/diagramPersistenceService';
import { RegionGroupNode, type RegionGroupNodeData } from './RegionGroupNode';
import { applyHierarchicalLayout } from './hierarchicalLayout';
import {
    DiagramTitleNode,
    DIAGRAM_TITLE_NODE_TYPE,
    DIAGRAM_TITLE_DEFAULTS,
    type DiagramTitleNodeData,
} from './DiagramTitleNode';
import {
    TextBoxNode,
    TEXT_BOX_NODE_TYPE,
    TEXT_BOX_DEFAULTS,
    type TextBoxNodeData,
} from './TextBoxNode';
import {
    AnimatedEdge,
    ANIMATED_EDGE_TYPE,
    type EdgeEndpoint,
    type EdgeEndpointDragArgs,
} from './AnimatedEdge';
import { type HostVisibilityIndex } from '@/common/services/hostVisibilityService';
import {
    PALETTE_DND_MIME,
    NODE_SIZE_PRESETS,
    nodeSizeForCustomStencil,
    nodeSizeForShape,
    type PaletteDragPayload,
} from './types';

const REGION_NODE_TYPE = 'regionGroup';

/** Build 113: shared marker config for `forward`/`backward`/`both`
 *  arrowheads. We use the closed (filled) variant to match the
 *  Visio aesthetic the customer's reference diagrams shipped with;
 *  the size pair is tuned to read clearly without crowding the
 *  midpoint label.
 *
 *  Build 115.11 — added arrow-style variants. `closed` is the old
 *  default; `open` / `thin` use React Flow's open chevron, `dot`
 *  and `diamond` reference custom SVG markers we inject into the
 *  canvas's <defs> via `<EdgeMarkerDefs />` below. The custom
 *  markers go through React Flow as a string `'url(#…)'` rather
 *  than an `EdgeMarker` object — the upstream React Flow type
 *  accepts both. */
type ArrowStyleKey = 'closed' | 'open' | 'thin' | 'dot' | 'diamond';

const ARROWHEADS_BY_STYLE: Record<
    ArrowStyleKey,
    EdgeMarker | string
> = {
    closed: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
    open: { type: MarkerType.Arrow, width: 22, height: 22 },
    thin: { type: MarkerType.Arrow, width: 16, height: 16, strokeWidth: 1 },
    // Custom SVG markers live in `<EdgeMarkerDefs />` as a single
    // `<svg><defs>` overlay that React Flow's edge layer can
    // reference by id. Keep ids URL-safe and namespaced ("ndg-")
    // so we don't collide with marker ids the host page might
    // also be defining.
    dot: 'url(#ndg-arrow-dot)',
    diamond: 'url(#ndg-arrow-diamond)',
};

const resolveArrowStyle = (style: ArrowStyleKey | undefined): ArrowStyleKey =>
    style && style in ARROWHEADS_BY_STYLE ? style : 'closed';

/** Build 113: derive React Flow `markerStart`/`markerEnd` from a
 *  saved direction value. `none` returns `undefined` for both
 *  ends — React Flow then renders a passive line.
 *
 *  Build 115.11 — second parameter selects the arrow glyph
 *  (closed / open / thin / dot / diamond). Falls back to 'closed'
 *  for older saves with no `arrowStyle` field. */
const markersForDirection = (
    direction: EdgeDirection | undefined,
    arrowStyle?: ArrowStyleKey
): { markerStart?: EdgeMarker | string; markerEnd?: EdgeMarker | string } => {
    const head = ARROWHEADS_BY_STYLE[resolveArrowStyle(arrowStyle)];
    switch (direction) {
        case 'forward':
            return { markerEnd: head };
        case 'backward':
            return { markerStart: head };
        case 'both':
            return { markerStart: head, markerEnd: head };
        case 'none':
        default:
            return {};
    }
};

/** Build 115.11 — overlay an `<svg>` with a `<defs>` block at the
 *  canvas root so edges can reference custom marker glyphs by id.
 *  React Flow's built-in marker registry only emits Arrow /
 *  ArrowClosed; anything else (dot, diamond, custom shapes) needs
 *  to live in our own marker dictionary.
 *
 *  The SVG is `position: absolute; width: 0; height: 0` so it
 *  doesn't take any layout space and never intercepts pointer
 *  events. The markers themselves use `markerUnits="strokeWidth"`
 *  so they scale a bit with the line stroke (matches how React
 *  Flow's built-ins behave) and `orient="auto"` so they rotate
 *  to follow the path direction.
 *
 *  Colours are deliberately hard-coded to slate-500 (#64748b) and
 *  the markers use `context-stroke` for fill where supported so
 *  the marker tints to the edge's stroke automatically — but we
 *  fall back to the slate fill for browsers that don't process
 *  `context-stroke` (Safari < 16). The fallback is still legible
 *  on every theme. */
const EdgeMarkerDefs: React.FC = () => (
    <svg
        aria-hidden
        style={{
            position: 'absolute',
            width: 0,
            height: 0,
            pointerEvents: 'none',
        }}
    >
        <defs>
            <marker
                id="ndg-arrow-dot"
                viewBox="0 0 10 10"
                refX="5"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                markerUnits="strokeWidth"
                orient="auto"
            >
                <circle cx="5" cy="5" r="3.5" fill="context-stroke" />
            </marker>
            <marker
                id="ndg-arrow-diamond"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="9"
                markerHeight="9"
                markerUnits="strokeWidth"
                orient="auto"
            >
                <path d="M0,5 L5,0 L10,5 L5,10 Z" fill="context-stroke" />
            </marker>
        </defs>
    </svg>
);

/** Compose the React Flow node-types map. Build 110 reverted the
 *  diagram canvas back to the same light-themed device shapes the
 *  operations canvas (`TopologyCanvas`) uses (see
 *  `topology/shapes.tsx`) — Alan reviewed the Build 109 Cyber-NOC
 *  dark theme and asked to revert to the lighter look from Build
 *  106 ("exactly what I want!!!"). The dark CyberNocShape +
 *  scoped CSS file are kept on disk as a future opt-in but are
 *  no longer wired into the canvas.
 *
 *  Build 113 adds the `diagramTitle` node — a borderless,
 *  font-customisable headline that participates in React Flow's
 *  drag/select machinery but renders no chrome. */
const DIAGRAM_NODE_TYPES = {
    ...TOPOLOGY_NODE_TYPES,
    [REGION_NODE_TYPE]: RegionGroupNode,
    [DIAGRAM_TITLE_NODE_TYPE]: DiagramTitleNode,
    // Build 115.1 — free-placement annotation. Multiple textboxes
    // can coexist per diagram (unlike the singleton title), so the
    // canvas treats them as regular nodes with their own
    // (de)serializer branches in `rfToSaved` / `savedNodeToRF`.
    [TEXT_BOX_NODE_TYPE]: TextBoxNode,
};

/** Build 114: register the custom AnimatedEdge — every edge in
 *  the diagram routes through it. Animation is gated inside the
 *  component on `data.direction !== 'none'`, so passive
 *  (direction='none') edges still render correctly without any
 *  motion. */
const DIAGRAM_EDGE_TYPES = {
    [ANIMATED_EDGE_TYPE]: AnimatedEdge,
};

/** Default edge options. New connections via `handleConnectEnd` and
 *  legacy edges hydrated without an explicit `type` both pick up
 *  the AnimatedEdge renderer. */
const DEFAULT_EDGE_OPTIONS = {
    type: ANIMATED_EDGE_TYPE,
};

/** Build 113: stable React Flow node id for the (single) diagram-
 *  title node. We never have more than one title per diagram, so
 *  using a deterministic id (a) keeps the round-trip predictable
 *  through Save/Load and (b) lets the parent canvas reach in to
 *  select-or-create without a lookup. */
const TITLE_NODE_ID = 'diagram-title';

/** Build 113: convert a `SavedDiagramTitle` into a React Flow node.
 *  The title node has no port handles and explicitly disables the
 *  React Flow selection chrome (we draw our own thin outline in
 *  `DiagramTitleNode` so the visual weight is appropriate for a
 *  headline). */
const savedTitleToRF = (title: SavedDiagramTitle): RFNode => ({
    id: TITLE_NODE_ID,
    type: DIAGRAM_TITLE_NODE_TYPE,
    position: { x: title.x, y: title.y },
    draggable: true,
    selectable: true,
    connectable: false,
    data: {
        text: title.text,
        fontSize: title.fontSize,
        color: title.color,
        bold: title.bold ?? false,
        italic: title.italic ?? false,
    } satisfies DiagramTitleNodeData,
    // High z-index so the title floats above device cards even when
    // their position visually overlaps. Operators expect the title
    // to dominate the page like a slide title would.
    zIndex: 100,
});

/** Edge style by kind. Light-theme palette (Build 110 revert):
 *  physical edges in slate-blue, synthetic A2A in sky-blue
 *  dashed, logical (overlay) edges in lighter dashed slate. */
const edgeStyleForKind = (
    kind: SavedDiagramEdge['kind']
): React.CSSProperties => {
    if (kind === 'synthetic_a2a') {
        return { stroke: '#0ea5e9', strokeWidth: 1.5, strokeDasharray: '6 4' };
    }
    if (kind === 'logical') {
        return { stroke: '#94a3b8', strokeWidth: 1.25, strokeDasharray: '2 4' };
    }
    return { stroke: '#64748b', strokeWidth: 1.5 };
};

/** Build a synthetic `TopologyDiscoveredNode` for the device-
 *  shape data prop. The PropertiesPanel + ShapeNode renderers
 *  expect this shape, so we materialise it from the saved
 *  payload (or from a palette drop) without going back to
 *  asset_inventory. When the node IS asset-bound, we still
 *  prefer the live `asset_inventory` row when one is supplied. */
const buildDeviceData = (params: {
    id: string;
    label: string;
    shortLabel: string;
    shape: DeviceShapeId;
    status?: HealthStatus;
    notes?: string;
    raw?: Record<string, unknown>;
    /** Build 115: vendor / model / serial routed through the
     *  device data so the shape card and inspector both see them.
     *  When undefined the card collapses the vendor·model row to
     *  invisible (no extra height impact). */
    vendor?: string;
    model?: string;
    serialNumber?: string;
    /** Build 115.13 — operator-supplied IP / management address.
     *  When undefined the card falls back to `raw.ip_address` /
     *  `raw.management_ip` from the bound asset row at render
     *  time (see DeviceShape in shapes.tsx). */
    ipAddress?: string;
    /** Build 115.21 — imported stencil artwork for custom shapes. */
    customStencil?: CustomStencilAsset;
}): {
    node: TopologyDiscoveredNode;
    notes: string;
    ipAddress?: string;
    freeformAnchors: true;
    customStencil?: CustomStencilAsset;
} => {
    const node: TopologyDiscoveredNode = {
        id: params.id,
        label: params.label,
        shortLabel: params.shortLabel,
        shape: params.shape,
        status: params.status ?? 'unknown',
        vendor: params.vendor,
        model: params.model,
        serialNumber: params.serialNumber,
        ipAddress: params.ipAddress,
        raw: params.raw ?? { device_type: params.shape },
    };
    return {
        node,
        notes: params.notes ?? '',
        ipAddress: params.ipAddress,
        freeformAnchors: true,
        customStencil: params.customStencil,
    };
};

/** Build 114: fold the `| metadata type=hosts` visibility result
 *  into the asset's health status. The status dot at the top-
 *  right of every device card is the single most-glanced-at
 *  signal in the diagram, and "Splunk hasn't seen this host" is
 *  exactly the kind of operational truth we want to surface
 *  there.
 *
 *  Build 115.9 — metadata is now AUTHORITATIVE for bound shapes.
 *  Earlier builds folded the metadata signal with `assetStatus`
 *  (the asset feed's own health column) and only downgraded to
 *  gray on a positive "silent" signal. That worked when
 *  asset_inventory had a real health_score but produced a gray
 *  LED for any Splunk-provenance bind whose `assetStatus` came
 *  back as `'unknown'` — which is exactly the splunk_inventory
 *  default when `is_connected != yes`. The operator's mental
 *  model is simpler than the fold: "if Splunk sees this host
 *  in the last 24h, light the LED green; if Splunk indexed
 *  this host before but not in the last 24h, light it red; if
 *  Splunk has no record of this host, fall back to whatever the
 *  asset feed knows."
 *
 *  Rules (Build 115.9):
 *    • Any candidate reports `true` (host in metadata, lastTime
 *      within 24h) → return `'healthy'`. Force green even when
 *      `assetStatus = 'unknown'`. The metadata signal is the
 *      one the operator wants for "is this host alive?".
 *    • At least one candidate reports `false` AND no candidate
 *      reports `true` (host in metadata but stale) → return
 *      `'critical'`. The host was previously indexing events
 *      but went silent; that's an actionable red.
 *    • Every candidate is `undefined` (or no candidates) →
 *      keep `assetStatus`. Metadata has no opinion; the asset
 *      feed's own answer (whatever it is) is the best we can
 *      do.
 *    • `hostVisibility = null` (search hasn't completed yet) →
 *      keep `assetStatus`. We don't want to flash green/red
 *      while waiting for the metadata search to finish.
 *
 *  We try multiple candidate hostnames per asset so we tolerate
 *  the typical mismatches between asset_inventory's `device_name`
 *  column and Splunk's actual indexed host field. */
const resolveEffectiveStatus = (
    assetStatus: HealthStatus,
    candidateHosts: Array<string | undefined | null>,
    hostVisibility: HostVisibilityIndex | null
): HealthStatus => {
    if (!hostVisibility) return assetStatus;
    let positivelySilent = false;
    for (const host of candidateHosts) {
        const reporting = hostVisibility.isReporting(host);
        if (reporting === true) return 'healthy';
        if (reporting === false) positivelySilent = true;
    }
    if (positivelySilent) return 'critical';
    // Every candidate is `undefined` (host not in the metadata
    // index at all) — fall back to the asset feed's own answer.
    return assetStatus;
};

const resolveLegacySplunkShape = (
    saved: SavedDiagramNode,
    fallback: DeviceShapeId
): DeviceShapeId => {
    if (fallback.startsWith('splunk_')) return fallback;
    if (!['server', 'database', 'cloud', 'generic'].includes(fallback)) return fallback;
    const vendor = (saved.vendor ?? '').toLowerCase();
    const text = [saved.label, saved.shortLabel, saved.model, saved.type]
        .filter((v): v is string => typeof v === 'string')
        .join(' ')
        .toLowerCase();
    if (vendor !== 'splunk' && !text.includes('splunk')) return fallback;
    if (text.includes('search head cluster') || text.includes('shc')) {
        return 'splunk_search_head_cluster';
    }
    if (text.includes('search head')) return 'splunk_search_head';
    if (text.includes('indexer')) return 'splunk_indexer';
    if (text.includes('cluster manager')) return 'splunk_cluster_manager';
    if (text.includes('deployment server')) return 'splunk_deployment_server';
    if (text.includes('deployer')) return 'splunk_deployer';
    if (text.includes('license manager')) return 'splunk_license_manager';
    if (text.includes('monitoring console')) return 'splunk_monitoring_console';
    if (text.includes('heavy forwarder') || text.includes('hwf')) {
        return 'splunk_heavy_forwarder';
    }
    if (text.includes('universal forwarder') || /\bufs?\b/.test(text)) {
        return 'splunk_universal_forwarder';
    }
    if (text.includes('edge processor')) return 'splunk_edge_processor';
    if (text.includes('connect for syslog') || text.includes('sc4s')) return 'splunk_sc4s';
    if (text.includes('data collection') || text.includes('idm')) {
        return 'splunk_data_collection';
    }
    return fallback;
};

/** Convert a `SavedDiagramNode` (persisted shape) into a
 *  React Flow `Node`. Live `assetIndex` lets us re-bind the
 *  display data to the freshest `asset_inventory` row when
 *  available — without it we render from whatever the saved
 *  payload remembers (still labeled correctly, just no fresh
 *  health).
 *
 *  Build 114: also accepts a `hostVisibility` index so silent
 *  hosts fall back to the gray "no telemetry" dot regardless of
 *  what asset_inventory claims. */
const savedNodeToRF = (
    saved: SavedDiagramNode,
    assetIndex: Map<string, TopologyDiscoveredNode> | null,
    hostVisibility: HostVisibilityIndex | null
): RFNode => {
    // Build 115.1 — textbox branch. Pulled in front of the region
    // / device branches because textboxes have neither asset
    // bindings nor handle ports; treating them as a special case
    // up here keeps the device path uncluttered.
    if (saved.type === TEXT_BOX_NODE_TYPE) {
        const tb = saved.textBox;
        return {
            id: saved.id,
            type: TEXT_BOX_NODE_TYPE,
            position: { x: saved.x, y: saved.y },
            parentId: saved.parentId,
            // Build 115.16 — see the long-form comment on
            // `handleNodeDragStop` below for why we deliberately
            // never set `extent: 'parent'` on parented nodes.
            // Short version: extent: 'parent' clamps the local
            // position so the entire card stays inside the
            // region rectangle, which made fresh drops near the
            // region edge "snap" away from the cursor and
            // produced the erratic-region-drop behaviour the
            // operator reported.
            extent: undefined,
            draggable: true,
            selectable: true,
            connectable: false,
            data: {
                text: tb?.text ?? saved.label ?? '',
                fontSize: tb?.fontSize ?? TEXT_BOX_DEFAULTS.fontSize,
                color: tb?.color ?? TEXT_BOX_DEFAULTS.color,
                bold: tb?.bold ?? TEXT_BOX_DEFAULTS.bold,
                italic: tb?.italic ?? TEXT_BOX_DEFAULTS.italic,
                background: tb?.background ?? TEXT_BOX_DEFAULTS.background,
                border: tb?.border ?? TEXT_BOX_DEFAULTS.border,
                align: tb?.align ?? TEXT_BOX_DEFAULTS.align,
            } satisfies TextBoxNodeData,
            zIndex: 50,
        };
    }
    if (saved.type === REGION_NODE_TYPE) {
        return {
            id: saved.id,
            type: REGION_NODE_TYPE,
            position: { x: saved.x, y: saved.y },
            style: {
                width: saved.width ?? NODE_SIZE_PRESETS.region.width,
                height: saved.height ?? NODE_SIZE_PRESETS.region.height,
            },
            data: {
                label: saved.label ?? 'Region',
                deviceCount: 0,
                // Build 115: accent flows from SavedDiagramGroup
                // through into the node's data so the picker round-
                // trips. The schema field is on `SavedDiagramGroup`,
                // but our flat `savedNodeToRF` receives a normalised
                // `SavedDiagramNode`-shaped object — see how the
                // group layer is folded into nodes higher up.
                accent: (saved as { accent?: string }).accent,
            },
            zIndex: 0,
        };
    }
    const savedShape = (saved.type.replace('device:', '') as DeviceShapeId) || 'generic';
    const shape =
        saved.customStencil !== undefined
            ? 'custom_stencil'
            : resolveLegacySplunkShape(saved, savedShape);
    const live = saved.assetId ? assetIndex?.get(saved.assetId) : undefined;
    const label = live?.label ?? saved.label ?? saved.id;
    const shortLabel = live?.shortLabel ?? saved.shortLabel ?? saved.id;
    const assetStatus: HealthStatus = live?.status ?? 'unknown';
    // Try every plausible Splunk-host alias — asset.label is
    // the device's full DNS name; shortLabel is the post-suffix
    // strip; assetId frequently matches host directly. Belt and
    // braces.
    const candidateHosts: Array<string | undefined | null> = [
        live?.label,
        live?.shortLabel,
        saved.label,
        saved.shortLabel,
        saved.assetId,
        live?.raw['hostname'] as string | undefined,
        live?.raw['device_name'] as string | undefined,
    ];
    const effectiveStatus = resolveEffectiveStatus(
        assetStatus,
        candidateHosts,
        hostVisibility
    );
    const defaultSize =
        shape === 'custom_stencil'
            ? nodeSizeForCustomStencil(saved.customStencil)
            : nodeSizeForShape(shape);
    const isCatalystStencil =
        shape === 'catalyst_3850_24_front' ||
        shape === 'catalyst_3850_24_rear';
    const savedWidth =
        typeof saved.width === 'number' ? saved.width : undefined;
    const savedHeight =
        typeof saved.height === 'number' ? saved.height : undefined;
    const width = savedWidth ?? defaultSize.width;
    const height =
        isCatalystStencil &&
        savedHeight !== undefined &&
        savedHeight > defaultSize.height * 2
            ? Math.max(
                  defaultSize.height,
                  Math.round((width * defaultSize.height) / defaultSize.width)
              )
            : savedHeight ?? defaultSize.height;
    return {
        id: saved.id,
        type: `device:${shape}`,
        position: { x: saved.x, y: saved.y },
        parentId: saved.parentId,
        // Build 115.16 — see `handleNodeDragStop` for why
        // `extent: 'parent'` is deliberately omitted.
        extent: undefined,
        style: {
            width,
            height,
        },
        data: buildDeviceData({
            id: saved.assetId ?? saved.id,
            label,
            shortLabel,
            shape,
            status: effectiveStatus,
            notes: saved.notes,
            raw: live?.raw ?? { device_type: shape },
            // Build 115: per-node manual override always wins over
            // the live asset_inventory value. That way an operator
            // who hand-types `Cisco / N9K-C9300X-48Y4C` for a
            // device that asset_inventory has wrong (or doesn't
            // know about) keeps their override on every reload.
            vendor: saved.vendor ?? live?.vendor,
            model: saved.model ?? live?.model,
            serialNumber: live?.serialNumber,
            // Build 115.13 — IP override from the saved payload.
            // The card renders this directly when set; otherwise
            // the card pulls `raw.ip_address` / `raw.management_ip`
            // from the bound asset row.
            ipAddress: saved.ipAddress,
            customStencil: saved.customStencil,
        }),
        zIndex: 1,
    };
};

const savedEdgeToRF = (saved: SavedDiagramEdge): RFEdge => {
    // Build 113: legacy edges (saved before Build 113) have no
    // `direction` field. We default them to 'none' so the visual
    // matches what was saved (no arrow), preserving back-compat.
    const direction: EdgeDirection = saved.direction ?? 'none';
    const arrowStyle: ArrowStyleKey = (saved.arrowStyle as ArrowStyleKey) ?? 'closed';
    const markers = markersForDirection(direction, arrowStyle);
    return {
        id: saved.id,
        source: saved.sourceId,
        target: saved.targetId,
        // Build 115.1 — restore the persisted handles. When
        // `sourceHandle` / `targetHandle` are undefined React
        // Flow falls back to its default (top-centre) anchor
        // automatically, so legacy payloads from before the
        // fix still load cleanly without manual migration.
        sourceHandle: saved.sourceHandle,
        targetHandle: saved.targetHandle,
        // Build 114: route through AnimatedEdge. `data.direction`
        // gates the moving-dot animation inside the component, so
        // passive edges still render as a plain line.
        type: ANIMATED_EDGE_TYPE,
        label: saved.label,
        // Build 115.5: hydrate `lineColor` if the saved edge has
        // one; otherwise the kind palette (slate-blue / sky /
        // slate-light) drives the line. This keeps existing
        // diagrams visually unchanged on first load after the
        // upgrade.
        style: saved.lineColor
            ? { ...edgeStyleForKind(saved.kind), stroke: saved.lineColor }
            : edgeStyleForKind(saved.kind),
        ...markers,
        data: {
            kind: saved.kind,
            direction,
            // Build 114: forward the operator's colour choice
            // (or undefined → AnimatedEdge picks a per-kind default).
            animationColor: saved.animationColor,
            // Build 115.5: line-colour override.
            lineColor: saved.lineColor,
            // Build 115.11: arrow tip glyph + live-status mode.
            arrowStyle,
            liveStatus: saved.liveStatus === true,
            layer: saved.layer,
            notes: saved.notes ?? '',
            sourceAnchor: normalizeDiagramEdgeAnchor(saved.sourceAnchor),
            targetAnchor: normalizeDiagramEdgeAnchor(saved.targetAnchor),
        },
    };
};

const savedGroupToRF = (g: SavedDiagramGroup): RFNode => ({
    id: g.id,
    type: REGION_NODE_TYPE,
    position: { x: g.x, y: g.y },
    style: { width: g.width, height: g.height },
    data: {
        label: g.label,
        deviceCount: 0,
        accent: g.accent,
    },
    zIndex: 0,
});

/** Inverse direction — produce a save-able payload from the
 *  current React Flow state.
 *
 *  Build 113: the diagram-title node (if present) is split off
 *  into the dedicated `payload.title` field rather than being
 *  serialised as an entry in `payload.nodes`. That keeps the
 *  schema clean (titles aren't network elements) and lets older
 *  clients ignore unknown fields without losing the title. */
const rfToSaved = (
    nodes: RFNode[],
    edges: RFEdge[]
): SavedDiagramPayload => {
    const groups: SavedDiagramGroup[] = [];
    const savedNodes: SavedDiagramNode[] = [];
    let title: SavedDiagramTitle | undefined;
    for (const n of nodes) {
        // Build 115.1 — persist textbox annotations as regular
        // SavedDiagramNode rows with `type: 'textBox'` plus a
        // `textBox` styling sub-object. Goes ahead of the title
        // branch because the title branch `continue;`s — we want
        // the textbox path to do the same and skip the device-
        // shape serialiser entirely.
        if (n.type === TEXT_BOX_NODE_TYPE) {
            const data = (n.data ?? {}) as Partial<TextBoxNodeData>;
            savedNodes.push({
                id: n.id,
                type: TEXT_BOX_NODE_TYPE,
                x: n.position.x,
                y: n.position.y,
                parentId: n.parentId,
                textBox: {
                    text: typeof data.text === 'string' ? data.text : '',
                    fontSize:
                        typeof data.fontSize === 'number'
                            ? data.fontSize
                            : TEXT_BOX_DEFAULTS.fontSize,
                    color:
                        typeof data.color === 'string'
                            ? data.color
                            : TEXT_BOX_DEFAULTS.color,
                    bold: data.bold === true,
                    italic: data.italic === true,
                    background:
                        typeof data.background === 'string'
                            ? data.background
                            : TEXT_BOX_DEFAULTS.background,
                    border:
                        typeof data.border === 'string'
                            ? data.border
                            : TEXT_BOX_DEFAULTS.border,
                    align: data.align ?? TEXT_BOX_DEFAULTS.align,
                },
            });
            continue;
        }
        if (n.type === DIAGRAM_TITLE_NODE_TYPE) {
            const data = (n.data ?? {}) as Partial<DiagramTitleNodeData>;
            title = {
                text: typeof data.text === 'string' ? data.text : '',
                x: n.position.x,
                y: n.position.y,
                fontSize:
                    typeof data.fontSize === 'number'
                        ? data.fontSize
                        : DIAGRAM_TITLE_DEFAULTS.fontSize,
                color:
                    typeof data.color === 'string'
                        ? data.color
                        : DIAGRAM_TITLE_DEFAULTS.color,
                bold: data.bold === true,
                italic: data.italic === true,
            };
            continue;
        }
        if (n.type === REGION_NODE_TYPE) {
            const data = (n.data ?? {}) as Record<string, unknown>;
            const style = (n.style ?? {}) as Record<string, unknown>;
            groups.push({
                id: n.id,
                label: typeof data.label === 'string' ? data.label : 'Region',
                x: n.position.x,
                y: n.position.y,
                width:
                    typeof style.width === 'number'
                        ? style.width
                        : NODE_SIZE_PRESETS.region.width,
                height:
                    typeof style.height === 'number'
                        ? style.height
                        : NODE_SIZE_PRESETS.region.height,
                accent: typeof data.accent === 'string' ? data.accent : undefined,
            });
            continue;
        }
        const data = (n.data ?? {}) as Record<string, unknown>;
        const inner = (data.node ?? {}) as Record<string, unknown>;
        const shape =
            (typeof inner.shape === 'string'
                ? (inner.shape as DeviceShapeId)
                : (n.type?.replace('device:', '') as DeviceShapeId)) ?? 'generic';
        savedNodes.push({
            id: n.id,
            type: n.type ?? `device:${shape}`,
            x: n.position.x,
            y: n.position.y,
            width:
                typeof n.style?.width === 'number'
                    ? (n.style.width as number)
                    : undefined,
            height:
                typeof n.style?.height === 'number'
                    ? (n.style.height as number)
                    : undefined,
            label: typeof inner.label === 'string' ? inner.label : undefined,
            shortLabel:
                typeof inner.shortLabel === 'string' ? inner.shortLabel : undefined,
            assetId:
                typeof inner.id === 'string' && inner.id !== n.id
                    ? (inner.id as string)
                    : (data.assetId as string | undefined),
            parentId: n.parentId,
            notes: typeof data.notes === 'string' ? data.notes : undefined,
            // Build 115: round-trip vendor / model. We only
            // persist these when they're explicitly set on the
            // canvas node — that way a fresh `fetchAssetInventory`
            // can still flow updated platform_id values through
            // for nodes that are bound to a live asset and
            // haven't been hand-overridden.
            vendor:
                typeof inner.vendor === 'string' && inner.vendor.length > 0
                    ? (inner.vendor as string)
                    : undefined,
            model:
                typeof inner.model === 'string' && inner.model.length > 0
                    ? (inner.model as string)
                    : undefined,
            // Build 115.13 — round-trip the IP override. We only
            // persist it when the operator explicitly set one
            // (non-empty string); a card showing an inventory IP
            // by fallback shouldn't pin that value into the saved
            // payload, since a future asset_inventory refresh
            // would then render the same address twice (once from
            // the persisted override, once from the live raw row).
            ipAddress:
                typeof inner.ipAddress === 'string' && inner.ipAddress.length > 0
                    ? (inner.ipAddress as string)
                    : undefined,
            customStencil:
                data.customStencil && typeof data.customStencil === 'object'
                    ? (data.customStencil as CustomStencilAsset)
                    : undefined,
        });
    }
    const savedEdges: SavedDiagramEdge[] = edges.map((e) => {
        const data = (e.data ?? {}) as Record<string, unknown>;
        return {
            id: e.id,
            sourceId: e.source,
            targetId: e.target,
            kind: (data.kind as SavedDiagramEdge['kind']) ?? 'physical',
            // Build 113: serialise direction so arrowheads round-trip.
            direction: (data.direction as EdgeDirection | undefined) ?? 'none',
            // Build 114: round-trip the operator's flowing-dot colour.
            animationColor:
                typeof data.animationColor === 'string'
                    ? data.animationColor
                    : undefined,
            // Build 115.5: round-trip the operator's line colour.
            lineColor:
                typeof data.lineColor === 'string' ? data.lineColor : undefined,
            // Build 115.11: round-trip arrow style + live-status flag.
            // Skip emitting `arrowStyle` when it's the default
            // ('closed') so older diagrams that never touched the
            // field stay byte-identical on save (and `git diff` of
            // the OOB conf doesn't churn on every regen).
            arrowStyle:
                typeof data.arrowStyle === 'string' &&
                data.arrowStyle !== 'closed'
                    ? (data.arrowStyle as SavedDiagramEdge['arrowStyle'])
                    : undefined,
            liveStatus: data.liveStatus === true ? true : undefined,
            label: typeof e.label === 'string' ? e.label : undefined,
            layer: typeof data.layer === 'string' ? data.layer : undefined,
            notes: typeof data.notes === 'string' ? data.notes : undefined,
            // Build 115.1 — fixes "edges snap back to top after
            // save" bug. Without persisting which handle each
            // edge endpoint attaches to, React Flow defaults
            // every endpoint back to the top-centre handle on
            // re-render, regardless of where the operator
            // actually drew it. Capture both ends; either may be
            // null/undefined when the operator drew on a node
            // without specifying a handle (i.e. centre-of-card).
            sourceHandle:
                typeof e.sourceHandle === 'string' ? e.sourceHandle : undefined,
            targetHandle:
                typeof e.targetHandle === 'string' ? e.targetHandle : undefined,
            sourceAnchor: normalizeDiagramEdgeAnchor(data.sourceAnchor),
            targetAnchor: normalizeDiagramEdgeAnchor(data.targetAnchor),
        };
    });
    return {
        version: 1,
        nodes: savedNodes,
        edges: savedEdges,
        groups,
        title,
    };
};

const REGION_ATTACH_OVERLAP_RATIO = 0.18;
const REGION_STICKY_OVERLAP_RATIO = 0.05;

/** Find the smallest region containing a flow-space point. The
 *  "smallest wins" tie-break keeps future nested regions from
 *  accidentally parenting to the outer container. */
const findRegionForPoint = (nodes: RFNode[], point: XYPosition): RFNode | null => {
    let best: RFNode | null = null;
    let bestArea = Infinity;
    for (const n of nodes) {
        if (n.type !== REGION_NODE_TYPE) continue;
        const w = typeof n.style?.width === 'number' ? (n.style.width as number) : 0;
        const h =
            typeof n.style?.height === 'number' ? (n.style.height as number) : 0;
        if (w <= 0 || h <= 0) continue;
        const x0 = n.position.x;
        const y0 = n.position.y;
        const x1 = x0 + w;
        const y1 = y0 + h;
        if (point.x < x0 || point.x > x1 || point.y < y0 || point.y > y1) {
            continue;
        }
        const regionArea = w * h;
        if (regionArea < bestArea) {
            best = n;
            bestArea = regionArea;
        }
    }
    return best;
};

const getRegionRect = (
    node: RFNode
): { x: number; y: number; width: number; height: number } | null => {
    if (node.type !== REGION_NODE_TYPE) return null;
    const width =
        typeof node.style?.width === 'number' ? (node.style.width as number) : 0;
    const height =
        typeof node.style?.height === 'number' ? (node.style.height as number) : 0;
    if (width <= 0 || height <= 0) return null;
    return { x: node.position.x, y: node.position.y, width, height };
};

const getRegionOverlapRatio = (
    shapeRect: { x: number; y: number; width: number; height: number },
    region: RFNode
): number => {
    const regionRect = getRegionRect(region);
    if (!regionRect) return 0;
    return (
        getRectOverlapArea(shapeRect, regionRect) /
        (shapeRect.width * shapeRect.height)
    );
};

/** Resolve which (if any) region-group node a card rectangle
 *  visually belongs to.
 *
 *  Build 1178 — region membership now uses forgiving overlap
 *  with hysteresis instead of "centre or 50% overlap". Operators
 *  can drop near a region edge and still get the obvious parent,
 *  while already-parented children stay attached until they are
 *  almost entirely outside the region. */
const findRegionForRect = (
    nodes: RFNode[],
    shapeRect: { x: number; y: number; width: number; height: number },
    options?: { preferredRegionId?: string | null }
): RFNode | null => {
    if (shapeRect.width <= 0 || shapeRect.height <= 0) return null;
    const centerRegion = findRegionForPoint(nodes, {
        x: shapeRect.x + shapeRect.width / 2,
        y: shapeRect.y + shapeRect.height / 2,
    });
    if (centerRegion) return centerRegion;

    if (options?.preferredRegionId) {
        const preferred = nodes.find((n) => n.id === options.preferredRegionId);
        if (
            preferred &&
            getRegionOverlapRatio(shapeRect, preferred) >= REGION_STICKY_OVERLAP_RATIO
        ) {
            return preferred;
        }
    }

    let best: RFNode | null = null;
    let bestRatio = 0;
    for (const n of nodes) {
        if (n.type !== REGION_NODE_TYPE) continue;
        const overlapRatio = getRegionOverlapRatio(shapeRect, n);
        if (overlapRatio > bestRatio) {
            best = n;
            bestRatio = overlapRatio;
        }
    }
    return bestRatio >= REGION_ATTACH_OVERLAP_RATIO ? best : null;
};

const getRectOverlapArea = (
    a: { x: number; y: number; width: number; height: number },
    b: { x: number; y: number; width: number; height: number }
): number => {
    const width = Math.max(
        0,
        Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
    );
    const height = Math.max(
        0,
        Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
    );
    return width * height;
};

/** Recompute every region's `data.deviceCount` from current
 *  parent assignments. Cheap — runs O(nodes) once per change. */
const annotateRegionCounts = (nodes: RFNode[]): RFNode[] => {
    const counts = new Map<string, number>();
    for (const n of nodes) {
        // Only count "real" device shapes — regions, the title node,
        // and free-placement textboxes (Build 115.1) all live on the
        // canvas as nodes but don't represent devices, so the
        // "Region — 3 devices" badge stays accurate when an operator
        // drops a label inside a region.
        if (n.type === REGION_NODE_TYPE) continue;
        if (n.type === DIAGRAM_TITLE_NODE_TYPE) continue;
        if (n.type === TEXT_BOX_NODE_TYPE) continue;
        if (n.parentId) counts.set(n.parentId, (counts.get(n.parentId) ?? 0) + 1);
    }
    return nodes.map((n) => {
        if (n.type !== REGION_NODE_TYPE) return n;
        const newCount = counts.get(n.id) ?? 0;
        const data = (n.data ?? {}) as Record<string, unknown>;
        if (data.deviceCount === newCount) return n;
        return { ...n, data: { ...data, deviceCount: newCount } };
    });
};

const ensureParentBeforeChild = (
    nodes: RFNode[],
    childId: string,
    parentId?: string
): RFNode[] => {
    if (!parentId) return nodes;
    const childIndex = nodes.findIndex((n) => n.id === childId);
    const parentIndex = nodes.findIndex((n) => n.id === parentId);
    if (childIndex < 0 || parentIndex < 0 || parentIndex < childIndex) {
        return nodes;
    }
    const ordered = [...nodes];
    const [child] = ordered.splice(childIndex, 1);
    const nextParentIndex = ordered.findIndex((n) => n.id === parentId);
    ordered.splice(nextParentIndex + 1, 0, child);
    return ordered;
};

const getNodeWorldPosition = (nodes: RFNode[], node: RFNode): XYPosition => {
    let x = node.position.x;
    let y = node.position.y;
    let parentId: string | undefined = node.parentId;
    let hops = 0;
    while (parentId && hops < 8) {
        const parent = nodes.find((p) => p.id === parentId);
        if (!parent) break;
        x += parent.position.x;
        y += parent.position.y;
        parentId = parent.parentId;
        hops += 1;
    }
    return { x, y };
};

const getNodeSize = (node: RFNode): { width: number; height: number } => {
    const data = (node.data ?? {}) as Record<string, unknown>;
    const customStencil =
        data.customStencil && typeof data.customStencil === 'object'
            ? (data.customStencil as CustomStencilAsset)
            : undefined;
    const fallbackDeviceSize = nodeSizeForShape(
        node.type?.startsWith('device:')
            ? (node.type.replace('device:', '') as DeviceShapeId)
            : undefined
    );
    const width =
        typeof node.style?.width === 'number'
            ? (node.style.width as number)
            : node.type === TEXT_BOX_NODE_TYPE
            ? 120
            : node.type === 'device:custom_stencil'
            ? nodeSizeForCustomStencil(customStencil).width
            : fallbackDeviceSize.width;
    const height =
        typeof node.style?.height === 'number'
            ? (node.style.height as number)
            : node.type === TEXT_BOX_NODE_TYPE
            ? 40
            : node.type === 'device:custom_stencil'
            ? nodeSizeForCustomStencil(customStencil).height
            : fallbackDeviceSize.height;
    return { width, height };
};

const clampAnchorValue = (value: number): number => Math.min(1, Math.max(0, value));

const normalizeDiagramEdgeAnchor = (
    value: unknown
): DiagramEdgeAnchor | undefined => {
    if (!value || typeof value !== 'object') return undefined;
    const anchor = value as Partial<DiagramEdgeAnchor>;
    if (!Number.isFinite(anchor.x) || !Number.isFinite(anchor.y)) {
        return undefined;
    }
    return {
        x: clampAnchorValue(anchor.x as number),
        y: clampAnchorValue(anchor.y as number),
    };
};

const anchorFromHandleId = (
    handleId: string | null | undefined
): DiagramEdgeAnchor | undefined => {
    if (!handleId) return undefined;
    if (handleId.startsWith('left-')) return { x: 0, y: 0.5 };
    if (handleId.startsWith('right-')) return { x: 1, y: 0.5 };
    if (handleId.startsWith('top-')) return { x: 0.5, y: 0 };
    if (handleId.startsWith('bottom-')) return { x: 0.5, y: 1 };
    if (handleId.startsWith('surface-')) return { x: 0.5, y: 0.5 };
    return undefined;
};

const anchorFromFlowPoint = (
    nodes: RFNode[],
    nodeId: string,
    point: XYPosition
): DiagramEdgeAnchor | undefined => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return undefined;
    const world = getNodeWorldPosition(nodes, node);
    const size = getNodeSize(node);
    if (size.width <= 0 || size.height <= 0) return undefined;
    return {
        x: clampAnchorValue((point.x - world.x) / size.width),
        y: clampAnchorValue((point.y - world.y) / size.height),
    };
};

const sideForAnchor = (
    anchor: DiagramEdgeAnchor
): 'left' | 'right' | 'top' | 'bottom' => {
    const distances = [
        { side: 'left' as const, value: anchor.x },
        { side: 'right' as const, value: 1 - anchor.x },
        { side: 'top' as const, value: anchor.y },
        { side: 'bottom' as const, value: 1 - anchor.y },
    ];
    return distances.reduce((best, candidate) =>
        candidate.value < best.value ? candidate : best
    ).side;
};

const handleIdForAnchor = (
    anchor: DiagramEdgeAnchor,
    endpoint: EdgeEndpoint
): string => `${sideForAnchor(anchor)}-${endpoint}`;

const isConnectableDiagramNode = (node: RFNode): boolean =>
    typeof node.type === 'string' && node.type.startsWith('device:');

const findConnectableNodeAtPoint = (
    nodes: RFNode[],
    point: XYPosition,
    options?: { excludeId?: string }
): RFNode | null => {
    let bestNode: RFNode | null = null;
    let bestZIndex = -Infinity;
    let bestIndex = -1;
    nodes.forEach((node, index) => {
        if (!isConnectableDiagramNode(node)) return;
        if (options?.excludeId && node.id === options.excludeId) return;
        const world = getNodeWorldPosition(nodes, node);
        const size = getNodeSize(node);
        if (
            point.x < world.x ||
            point.x > world.x + size.width ||
            point.y < world.y ||
            point.y > world.y + size.height
        ) {
            return;
        }
        const zIndex = typeof node.zIndex === 'number' ? node.zIndex : 0;
        if (zIndex > bestZIndex || (zIndex === bestZIndex && index > bestIndex)) {
            bestNode = node;
            bestZIndex = zIndex;
            bestIndex = index;
        }
    });
    return bestNode;
};

const clientPointFromConnectionEvent = (
    event: MouseEvent | TouchEvent
): XYPosition | null => {
    if ('changedTouches' in event && event.changedTouches.length > 0) {
        const touch = event.changedTouches[0];
        return { x: touch.clientX, y: touch.clientY };
    }
    if ('touches' in event && event.touches.length > 0) {
        const touch = event.touches[0];
        return { x: touch.clientX, y: touch.clientY };
    }
    if ('clientX' in event && 'clientY' in event) {
        return { x: event.clientX, y: event.clientY };
    }
    return null;
};

interface AnchoredConnection {
    sourceId: string;
    targetId: string;
    sourceHandle?: string;
    targetHandle?: string;
    sourceAnchor?: DiagramEdgeAnchor;
    targetAnchor?: DiagramEdgeAnchor;
}

const resolveAnchoredConnection = (
    connectionState: FinalConnectionState,
    nodes: RFNode[],
    landingPoint: XYPosition,
    existingEdge?: RFEdge
): AnchoredConnection | null => {
    const fromHandle = connectionState.fromHandle;
    const toHandle = connectionState.toHandle;
    if (
        connectionState.isValid !== true ||
        !fromHandle ||
        !toHandle ||
        !fromHandle.nodeId ||
        !toHandle.nodeId
    ) {
        return null;
    }
    const fromIsTarget = fromHandle.type === 'target';
    const sourceId = fromIsTarget ? toHandle.nodeId : fromHandle.nodeId;
    const targetId = fromIsTarget ? fromHandle.nodeId : toHandle.nodeId;
    if (sourceId === targetId) return null;

    const existingData = (existingEdge?.data ?? {}) as Record<string, unknown>;
    const existingSourceAnchor = normalizeDiagramEdgeAnchor(
        existingData.sourceAnchor
    );
    const existingTargetAnchor = normalizeDiagramEdgeAnchor(
        existingData.targetAnchor
    );

    return {
        sourceId,
        targetId,
        sourceHandle:
            (fromIsTarget ? toHandle.id : fromHandle.id) ?? undefined,
        targetHandle:
            (fromIsTarget ? fromHandle.id : toHandle.id) ?? undefined,
        sourceAnchor: fromIsTarget
            ? anchorFromFlowPoint(nodes, sourceId, landingPoint) ??
              anchorFromHandleId(toHandle.id)
            : existingEdge
              ? existingSourceAnchor ?? anchorFromHandleId(fromHandle.id)
              : anchorFromHandleId(fromHandle.id),
        targetAnchor: fromIsTarget
            ? existingEdge
                ? existingTargetAnchor ?? anchorFromHandleId(fromHandle.id)
                : anchorFromHandleId(fromHandle.id)
            : anchorFromFlowPoint(nodes, targetId, landingPoint) ??
              anchorFromHandleId(toHandle.id),
    };
};

const canBelongToRegion = (node: RFNode): boolean =>
    node.type !== REGION_NODE_TYPE && node.type !== DIAGRAM_TITLE_NODE_TYPE;

const orderParentsBeforeChildren = (nodes: RFNode[]): RFNode[] => {
    let ordered = nodes;
    for (const node of nodes) {
        ordered = ensureParentBeforeChild(ordered, node.id, node.parentId);
    }
    return ordered;
};

const reconcileRegionMembership = (nodes: RFNode[]): RFNode[] => {
    let changed = false;
    const reconciled = nodes.map((node) => {
        if (!canBelongToRegion(node)) return node;
        const world = getNodeWorldPosition(nodes, node);
        const size = getNodeSize(node);
        const region = findRegionForRect(
            nodes,
            {
                x: world.x,
                y: world.y,
                width: size.width,
                height: size.height,
            },
            { preferredRegionId: node.parentId }
        );
        const targetParentId = region?.id;
        if ((node.parentId ?? undefined) === targetParentId) return node;
        changed = true;
        return {
            ...node,
            position: region
                ? {
                      x: world.x - region.position.x,
                      y: world.y - region.position.y,
                  }
                : world,
            parentId: targetParentId,
            extent: undefined,
        };
    });
    return changed ? orderParentsBeforeChildren(reconciled) : nodes;
};

/** Build 113: edit/view mode. Edit (default) is the full authoring
 *  experience — drag, connect, drop devices, edit properties.
 *  View is read-only / cinematic — no port handles, no dragging,
 *  no connecting, no inspector; but still pans + zooms. */
export type DiagramMode = 'edit' | 'view';

/** Build 113: imperative handle exposed to the parent page so the
 *  header's "Title" button can ask the canvas to insert (or focus)
 *  the diagram title without the parent owning canvas state. */
export interface NetworkDiagramCanvasHandle {
    /** Idempotent: if a title node already exists, select it; else
     *  insert one at the current viewport center and select it. */
    addOrSelectTitle: () => void;
}

export interface NetworkDiagramCanvasProps {
    /** Hydrate the canvas with a previously saved payload. Pass
     *  `null` for a blank diagram. The canvas re-runs on every
     *  identity change of this prop, so the parent should keep
     *  it referentially stable while editing. */
    initialPayload: SavedDiagramPayload | null;
    /** Live `asset_inventory` index for re-binding asset-bound
     *  saved nodes to fresh display data + health status. The
     *  parent loads it once via `fetchAssetInventory()` and
     *  passes it down. `null` while loading. */
    assetIndex: Map<string, TopologyDiscoveredNode> | null;
    /** Build 114: lightweight `| metadata type=hosts` index. When
     *  present, the canvas folds visibility into each device's
     *  status dot — silent / unknown hosts get the "no telemetry"
     *  gray dot regardless of what asset_inventory claimed. The
     *  parent fetches via `fetchHostVisibility()` and passes
     *  down. `null` is treated as "feature not loaded yet" and
     *  preserves the asset-only status. */
    hostVisibility?: HostVisibilityIndex | null;
    /** Fired on every mutation that changes the persisted
     *  payload. Parent uses this to mark dirty + queue saves. */
    onChange: (payload: SavedDiagramPayload) => void;
    /** Build 113: edit (default) or read-only view/present mode. */
    mode?: DiagramMode;
    /** Build 113: imperative handle for the parent header buttons. */
    handleRef?: React.Ref<NetworkDiagramCanvasHandle>;
    /** Build 115.23 — true while a PNG / PDF capture is in flight.
     *  When set, the canvas suppresses the dot-grid background and
     *  forces a pure-white wrapper so the rasterised artefact is a
     *  clean shareable image rather than a screenshot of the editor.
     *  The flag flips back to false the moment the capture finishes
     *  (see `useExportPage.exportAs`). */
    exporting?: boolean;
    className?: string;
}

let nodeIdCounter = Date.now();

// --- Build 115.2 — undo / redo history ----------------------------
//
// We keep a bounded ring of snapshots (last 50 by default), each one
// a fully-rehydrateable `SavedDiagramPayload`. On every "logical"
// mutation (drop, connect, reconnect, delete, drag-stop, apply*)
// the canvas calls `commit()` with the new state — intermediate
// node-drag deltas during a drag-in-progress are intentionally
// skipped because rolling back to mid-drag positions would feel
// jittery rather than useful.
//
// The reducer (vs raw `useState`) avoids a class of stale-closure
// bugs that bit us in earlier prototypes: when undo / redo dispatch
// from a keyboard listener, the listener's closed-over `index`
// could point at a snapshot that had already been overwritten by a
// concurrent commit. The reducer runs against the latest state on
// every dispatch.
type HistoryState = {
    stack: SavedDiagramPayload[];
    /** Index of the *current* snapshot — i.e. the one the canvas
     *  currently reflects. Undo decrements; redo increments. */
    index: number;
};

type HistoryAction =
    | { type: 'commit'; snapshot: SavedDiagramPayload }
    | { type: 'reset'; snapshot: SavedDiagramPayload }
    | { type: 'undo' }
    | { type: 'redo' };

const HISTORY_CAP = 50;

const historyReducer = (state: HistoryState, action: HistoryAction): HistoryState => {
    switch (action.type) {
        case 'commit': {
            // Truncate any "redo tail" the moment the operator
            // takes a fresh action — standard undo/redo semantics.
            const truncated = state.stack.slice(0, state.index + 1);
            const last = truncated[truncated.length - 1];
            // Skip duplicates: if the snapshot is byte-identical to
            // the previous commit, history shouldn't grow. Cheaper
            // than re-rendering the canvas to no-op state.
            if (last && JSON.stringify(last) === JSON.stringify(action.snapshot)) {
                return state;
            }
            const stack = [...truncated, action.snapshot];
            const overflow = Math.max(0, stack.length - HISTORY_CAP);
            return {
                stack: overflow ? stack.slice(overflow) : stack,
                index: stack.length - 1 - overflow,
            };
        }
        case 'reset': {
            return { stack: [action.snapshot], index: 0 };
        }
        case 'undo':
            return state.index <= 0 ? state : { ...state, index: state.index - 1 };
        case 'redo':
            return state.index >= state.stack.length - 1
                ? state
                : { ...state, index: state.index + 1 };
        default:
            return state;
    }
};

const HISTORY_INITIAL: HistoryState = { stack: [], index: -1 };

const nextNodeId = (prefix: string): string => {
    nodeIdCounter += 1;
    return `${prefix}_${nodeIdCounter}`;
};

const NetworkDiagramCanvasInner: React.FC<NetworkDiagramCanvasProps> = ({
    initialPayload,
    assetIndex,
    hostVisibility,
    onChange,
    mode = 'edit',
    handleRef,
    exporting = false,
    className,
}) => {
    // `null` from the parent ↔ feature still loading. The canvas
    // gracefully falls back to "asset_inventory wins" until the
    // metadata index arrives (typically <100ms after mount).
    const visibilityIndex: HostVisibilityIndex | null =
        hostVisibility ?? null;
    const isViewMode = mode === 'view';
    const [nodes, setNodes] = useState<RFNode[]>([]);
    const [edges, setEdges] = useState<RFEdge[]>([]);
    const [selection, setSelection] = useState<Selection>(null);
    const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);
    /** Build 115.9 — drives the canvas help popover (open on click,
     *  close on outside click / Escape / × button). Replaces the
     *  Build 115.6 hover-only `?` chip; operators wanted a click-
     *  to-open instructions card with structured content rather
     *  than a one-line tooltip. */
    const [helpOpen, setHelpOpen] = useState<boolean>(false);
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const reconnectingRef = useRef<boolean>(false);
    const endpointDragOriginalEdgeRef = useRef<RFEdge | null>(null);
    const reactFlow = useReactFlow();
    const initialPayloadRef = useRef<SavedDiagramPayload | null>(initialPayload);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    /** Build 115.10 — keep live mirrors of the asset / metadata
     *  indexes so the hydrate effect (and any drop / reload that
     *  needs them) can read the freshest values without the
     *  effect needing them as React deps. Listing them as deps
     *  used to nuke an in-progress drop the moment
     *  `fetchHostVisibility()` resolved (≈1s after mount), because
     *  the effect would re-hydrate from `initialPayload` and throw
     *  away whatever the operator had just dropped. */
    const assetIndexRef =
        useRef<Map<string, TopologyDiscoveredNode> | null>(assetIndex);
    const visibilityIndexRef =
        useRef<HostVisibilityIndex | null>(hostVisibility ?? null);
    assetIndexRef.current = assetIndex;
    visibilityIndexRef.current = hostVisibility ?? null;

    useEffect(() => {
        setSelection((prev) => {
            if (prev?.kind === 'node') {
                const latest = nodes.find((n) => n.id === prev.node.id);
                if (!latest) return null;
                return latest === prev.node ? prev : { kind: 'node', node: latest };
            }
            if (prev?.kind === 'edge') {
                const latest = edges.find((e) => e.id === prev.edge.id);
                if (!latest) return null;
                return latest === prev.edge ? prev : { kind: 'edge', edge: latest };
            }
            return prev;
        });
    }, [nodes, edges]);

    // --- Build 115.2: undo/redo + delete confirmation state -------
    //
    // History is committed at "logical" boundaries (drop, connect,
    // reconnect, delete, drag-stop, apply*) rather than on every
    // node-position delta during a drag. `isReplayingRef` flips on
    // while we apply an undo/redo so the side-effects of
    // setNodes/setEdges (which would normally call `emitChange`)
    // don't loop us back into the history.
    const [history, dispatchHistory] = useReducer(historyReducer, HISTORY_INITIAL);
    const isReplayingRef = useRef<boolean>(false);
    const canUndo = history.index > 0;
    const canRedo = history.index < history.stack.length - 1;

    // The "do you really want to delete this?" gate. When this is
    // non-null, the canvas renders a small modal and waits on the
    // operator to confirm or cancel. `pendingTargets` carries one
    // entry per item the operator selected for deletion (a single
    // node, a single edge, or a multi-select via React Flow).
    type DeleteTarget = { id: string; kind: 'node' | 'edge'; label: string };
    const [pendingDelete, setPendingDelete] = useState<DeleteTarget[] | null>(null);

    /** Hydrate from the saved payload on mount and whenever the
     *  parent passes a new one (e.g. operator opened a different
     *  diagram). After materialising nodes/edges from the saved
     *  payload, run `applyHierarchicalLayout` — this is a no-op
     *  for diagrams whose nodes already have explicit positions
     *  (every diagram saved through the UI), but auto-arranges
     *  payloads where nodes were seeded at `(0, 0)` (e.g. a
     *  future "Suggest from inventory" button or a customer-
     *  supplied seed payload). */
    useEffect(() => {
        initialPayloadRef.current = initialPayload;
        const payload = initialPayload;
        if (!payload) {
            setNodes([]);
            setEdges([]);
            // Build 115.2 — fresh blank canvas resets undo history.
            // Without this, opening a different diagram would leave
            // `Undo` reaching into the previous diagram's history.
            dispatchHistory({
                type: 'reset',
                snapshot: { version: 1, nodes: [], edges: [], groups: [] },
            });
            return;
        }
        const groupNodes = payload.groups.map(savedGroupToRF);
        const deviceNodes = payload.nodes.map((n) =>
            // Build 115.10 — read indexes from refs so this effect
            // doesn't have to depend on them. Late-arriving asset /
            // visibility data is reflected via the patch effect
            // below; recreating nodes here would clobber any drops
            // / edits the operator made between mount and the
            // metadata search resolving.
            savedNodeToRF(n, assetIndexRef.current, visibilityIndexRef.current)
        );
        const rfEdges = payload.edges.map(savedEdgeToRF);
        // Build 113: hydrate the optional on-canvas title last so it
        // sits at the end of the array (paint order = highest z) —
        // titles read as "above" the diagram surface, not buried
        // beneath device cards.
        const titleNodes: RFNode[] = payload.title ? [savedTitleToRF(payload.title)] : [];
        const merged = [...groupNodes, ...deviceNodes];
        const laidOut = applyHierarchicalLayout(
            { nodes: merged, edges: rfEdges },
            { onlyZeroPositions: true }
        );
        setNodes(annotateRegionCounts(reconcileRegionMembership([...laidOut, ...titleNodes])));
        setEdges(rfEdges);
        // Build 115.2 — anchor history at the loaded payload. Undo
        // can no longer cross diagram boundaries; the first commit
        // after this becomes the operator's first reversible step.
        dispatchHistory({ type: 'reset', snapshot: payload });
        // Reset to 100% shortly after hydrate. The floating
        // viewport controls show the live zoom, so starting from a
        // predictable 100% is less surprising than auto-fit landing
        // at 90% or 73% depending on the diagram bounds. Operators
        // can still hit the fit button when they want a full-view
        // overview.
        window.requestAnimationFrame(() => {
            try {
                void reactFlow.setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 0 });
            } catch {
                // ignore — viewport not ready yet
            }
        });
    }, [initialPayload, reactFlow]);

    /** Build 115.10 — patch live device-status / live asset data
     *  in-place when the asset or metadata index resolves AFTER
     *  the canvas has mounted. The previous implementation listed
     *  both indexes as deps on the hydrate effect, which meant
     *  the effect re-ran (and rebuilt the entire `nodes` array
     *  from `initialPayload`) the moment either index landed —
     *  ~1 second after mount, when `fetchHostVisibility` returns.
     *  Any palette drop or drag the operator did in that window
     *  was thrown away, producing the "shape jumps outside the
     *  region" / "shape disappears" reports.
     *
     *  The patch is intentionally narrow:
     *    • only device nodes (regions / textboxes / titles
     *      preserved by reference);
     *    • only `status` and live `vendor`/`model`/`raw` fields
     *      touched (positions, parents, sizes, notes left alone);
     *    • returns the same node reference when nothing changes,
     *      so React Flow doesn't re-render unaffected cards. */
    useEffect(() => {
        setNodes((current) => {
            let mutated = false;
            const next = current.map((n) => {
                if (n.type === REGION_NODE_TYPE) return n;
                if (n.type === DIAGRAM_TITLE_NODE_TYPE) return n;
                if (n.type === TEXT_BOX_NODE_TYPE) return n;
                const data = (n.data ?? {}) as Record<string, unknown>;
                const inner = (data.node ?? {}) as Partial<TopologyDiscoveredNode>;
                if (!inner || typeof inner !== 'object') return n;
                const innerId = typeof inner.id === 'string' ? inner.id : n.id;
                const live = assetIndex?.get(innerId);
                const candidateHosts: Array<string | undefined | null> = [
                    live?.label,
                    live?.shortLabel,
                    inner.label,
                    inner.shortLabel,
                    innerId,
                    live?.raw?.['hostname'] as string | undefined,
                    live?.raw?.['device_name'] as string | undefined,
                ];
                const assetStatus: HealthStatus =
                    live?.status ?? (inner.status as HealthStatus | undefined) ?? 'unknown';
                const effectiveStatus = resolveEffectiveStatus(
                    assetStatus,
                    candidateHosts,
                    hostVisibility ?? null
                );
                if (effectiveStatus === inner.status) return n;
                mutated = true;
                return {
                    ...n,
                    data: {
                        ...data,
                        node: { ...inner, status: effectiveStatus },
                    },
                };
            });
            return mutated ? next : current;
        });
        // We deliberately avoid emitting / committing history here:
        // the LED is a derived signal, not an operator edit.
    }, [assetIndex, hostVisibility]);

    /** Push the latest mutation to the parent. We materialise the
     *  payload from the LATEST (post-update) nodes/edges using a
     *  functional setter pattern so we never read stale state. */
    const emitChange = useCallback(
        (latestNodes: RFNode[], latestEdges: RFEdge[]): void => {
            try {
                const payload = rfToSaved(latestNodes, latestEdges);
                onChangeRef.current(payload);
            } catch {
                // Defensive — never let serialization errors crash
                // the canvas. The parent still has the previous
                // payload; the next mutation will retry.
            }
        },
        []
    );

    /** Build 115.2 — commit a snapshot to the undo stack at a
     *  "logical boundary" (drop / connect / reconnect / dragstop /
     *  apply* / delete). Suppressed during replay so undo/redo
     *  don't pollute history with the very state they just
     *  restored. Declared up here (not next to undo/redo which
     *  read history state) because every change handler needs to
     *  call it; declaring it later would force them to use lazy
     *  refs and lose the dependency-array hygiene tsc enforces. */
    const commitHistory = useCallback(
        (nodesNow: RFNode[], edgesNow: RFEdge[]): void => {
            if (isReplayingRef.current) return;
            const snapshot = rfToSaved(nodesNow, edgesNow);
            dispatchHistory({ type: 'commit', snapshot });
        },
        []
    );

    /** Build 115.5 — does this batch of node changes actually
     *  change the persisted shape of the diagram? React Flow
     *  fires `select` and `dimensions` events constantly (on
     *  every click and every node-mount measurement), and
     *  position events fire on every frame of an in-progress
     *  drag (`dragging: true`). None of those should mark the
     *  diagram dirty — the operator hasn't decided to commit
     *  anything yet. Without this guard, the parent's
     *  beforeunload guard fires on a fresh page load the moment
     *  the operator clicks ANYWHERE, which is exactly the bug
     *  the 115.5 review flagged. */
    const isMutatingNodeChanges = (changes: NodeChange[]): boolean => {
        for (const c of changes) {
            switch (c.type) {
                case 'select':
                    continue;
                case 'dimensions':
                    // Build 115.11 — React Flow fires `dimensions`
                    // for two distinct reasons: (1) initial node
                    // measurement on mount, which is purely visual
                    // and has `resizing: undefined`; and (2)
                    // operator-driven NodeResizer handle drags,
                    // which carry `resizing: true`. Only the
                    // second case needs to mark the diagram dirty
                    // and emit. Without this split, regions and
                    // device cards both quietly resized in memory
                    // but the operator's change never made it to
                    // disk.
                    if (
                        (c as NodeChange & { resizing?: boolean }).resizing === true
                    ) {
                        return true;
                    }
                    continue;
                case 'position':
                    // Mid-drag positions are intermediate; the
                    // committed move comes through onNodeDragStop
                    // (handleNodeDragStop) which calls emitChange
                    // explicitly. Skipping mid-drag emits also
                    // dramatically cuts the parent re-render rate
                    // during a drag.
                    if (c.dragging === true) continue;
                    return true;
                default:
                    return true;
            }
        }
        return false;
    };

    /** Build 115.5 — same guard for edges. Edge `select` events
     *  fire on every click; nothing in the persisted payload
     *  changes when an edge is selected, so we shouldn't emit. */
    const isMutatingEdgeChanges = (changes: EdgeChange[]): boolean => {
        for (const c of changes) {
            if (c.type === 'select') continue;
            return true;
        }
        return false;
    };

    const handleNodesChange = useCallback(
        (changes: NodeChange[]) => {
            const mutates = isMutatingNodeChanges(changes);
            setNodes((current) => {
                const shouldReconcileRegions = changes.some((change) => {
                    if (
                        change.type !== 'position' &&
                        change.type !== 'dimensions'
                    ) {
                        return false;
                    }
                    if (change.type === 'position' && change.dragging === true) {
                        return false;
                    }
                    if (
                        (change as NodeChange & { resizing?: boolean }).resizing ===
                        true
                    ) {
                        return false;
                    }
                    const node = current.find((n) => n.id === change.id);
                    return Boolean(
                        node &&
                            (node.type === REGION_NODE_TYPE ||
                                canBelongToRegion(node))
                    );
                });
                const applied = applyNodeChanges(changes, current);
                const reconciled = shouldReconcileRegions
                    ? reconcileRegionMembership(applied)
                    : applied;
                const next = annotateRegionCounts(reconciled);
                if (mutates) emitChange(next, edges);
                return next;
            });
        },
        [edges, emitChange]
    );

    const handleEdgesChange = useCallback(
        (changes: EdgeChange[]) => {
            const mutates = isMutatingEdgeChanges(changes);
            setEdges((current) => {
                const next = applyEdgeChanges(changes, current);
                if (mutates) emitChange(nodes, next);
                return next;
            });
        },
        [nodes, emitChange]
    );

    /** React Flow only renders edge-reconnect affordances when an
     *  `onReconnect` prop exists, but the old callback receives
     *  only handle ids — not the cursor point the operator dropped
     *  on. Keep this as the opt-in hook and commit the real update
     *  in `handleReconnectEnd`, where React Flow gives us the
     *  native mouse/touch event. */
    const handleReconnect = useCallback((): void => {
        // Actual reconnect persistence happens in handleReconnectEnd.
    }, []);

    const handleReconnectStart = useCallback((): void => {
        reconnectingRef.current = true;
    }, []);

    /** Build 115.17 — apply a transient `data.dropHovering` flag
     *  to whichever region (if any) the in-flight drag is
     *  currently aimed at. Drives the live highlight on
     *  `RegionGroupNode`. We mutate the regions' `data` in place
     *  inside `setNodes` rather than tracking a parallel state
     *  variable — this keeps the highlight perfectly in sync with
     *  the node layer (no chance of a region rendering hovered
     *  while it's been deleted, etc.) and lets RegionGroupNode
     *  read the flag via its data prop without extra context.
     *  The flag is never persisted (`rfToSaved` strips it) and is
     *  always cleared on drop / drag-stop / drag-leave.
     *
     *  Defined up here (above `handleDrop`,
     *  `handleNodeDragStop`, `handleDragOver`, `handleNodeDrag`)
     *  because all four consume it; declaring it later would
     *  trigger TS's "used before declaration" check on the
     *  earlier handlers. */
    const applyDropHover = useCallback(
        (current: RFNode[], targetRegionId: string | null): RFNode[] => {
            // Bail without producing a new array if nothing
            // changed — avoids React Flow re-rendering every
            // region on every dragOver tick (which fires at
            // ~mouse-move frequency).
            const needsChange = current.some((n) => {
                if (n.type !== REGION_NODE_TYPE) return false;
                const data = n.data as unknown as RegionGroupNodeData | undefined;
                const isHovered = Boolean(data?.dropHovering);
                const shouldHover = n.id === targetRegionId;
                return isHovered !== shouldHover;
            });
            if (!needsChange) return current;
            return current.map((n) => {
                if (n.type !== REGION_NODE_TYPE) return n;
                const data = (n.data ?? {}) as unknown as RegionGroupNodeData;
                const shouldHover = n.id === targetRegionId;
                if (Boolean(data.dropHovering) === shouldHover) return n;
                return {
                    ...n,
                    data: { ...data, dropHovering: shouldHover },
                };
            });
        },
        []
    );

    /** Build 115.17 — convenience: clear any drop-hover flag
     *  currently set, no-op if none set. Used by the drag-leave
     *  path to restore the "no live preview" baseline. */
    const clearDropHover = useCallback((): void => {
        setNodes((current) => applyDropHover(current, null));
    }, [applyDropHover, setNodes]);

    /** Build 115: auto-parent a device to a region when its final
     *  drag-stop card rectangle belongs inside the region, and
     *  un-parent when it lands outside. Without this, an existing
     *  device dragged INTO a region would visually overlap but
     *  the region's `deviceCount` would stay at zero (only fresh
     *  drops from the palette ran the parenting check) — which
     *  is exactly the "0 devices" gripe the user flagged in the
     *  Build 115 screenshots.
     *
     *  Implementation note: a node's `node.position` is relative
     *  to its current parent (or world if no parent). To compare
     *  against region rects (which are world coordinates) we walk
     *  any existing parent chain to derive the world position
     *  before checking containment. `getWorldPosition` keeps that
     *  inline so the helper doesn't leak across file boundaries
     *  for a single-call use case.
     *
     *  Build 115.16 — `extent: 'parent'` removed (everywhere a
     *  node is parented to a region: this handler, the three
     *  `handleDrop` branches, and the two `savedNodeToRF`
     *  branches). Operator report: "we still have a major bug
     *  with moving objects into a region! really weird
     *  behavior" — turns out the regression-after-fix story for
     *  region drops is `extent: 'parent'` clamping the local
     *  position so the *entire card* stays inside the region
     *  rectangle. Two consequences:
     *
     *    1. A child cannot be dragged out of its region; the
     *       drag is silently constrained at the region's edge.
     *       The drag-stop handler below never gets a chance to
     *       reparent because the node never reaches another
     *       region.
     *    2. A fresh drop landing near a region's right or
     *       bottom edge ends up with a local position that
     *       would put part of the card outside the region.
     *       React Flow clamps that local position inward by
     *       the overflow amount, so the card visibly snaps
     *       *away* from where the operator dropped it — the
     *       "shape moves outside / behaves erratically" jolt.
     *
     *  Without `extent: 'parent'`, the cursor and the card stay
     *  aligned end-to-end. The drag-stop handler does all the
     *  parenting work: drop inside region → reparent + convert
     *  to local; drop outside region → un-parent + keep world
     *  position. Children of a parented region still follow
     *  their parent on drag (React Flow honours `parentId`
     *  alone for that — `extent` only adds the constraint, it
     *  isn't required for the parent-drag-children behaviour).
     *  RegionGroupNode renders with `overflow: visible` so
     *  children at local positions outside the parent's
     *  rectangle render visibly outside (no DOM clipping).
     *
     *  Build 1177 — use the released CARD RECTANGLE for region
     *  membership, not the release cursor. The cursor/grab point
     *  made membership feel random: a card could look inside but
     *  stay unparented if the grab point was outside, and the
     *  reverse could happen at an edge. The shared `findRegionForRect`
     *  rule attaches on meaningful overlap and keeps an existing
     *  parent until the card is clearly outside. */
    const handleNodeDragStop = useCallback(
        (_event: React.MouseEvent, node: RFNode) => {
            // Don't re-parent the region itself, the title node,
            // or anything else that isn't a device. (Title node
            // and region behave fine without parenting.)
            if (
                node.type === REGION_NODE_TYPE ||
                node.type === DIAGRAM_TITLE_NODE_TYPE
            ) {
                return;
            }
            setNodes((current) => {
                const getWorldPosition = (n: RFNode): XYPosition => {
                    let x = n.position.x;
                    let y = n.position.y;
                    let parentId: string | undefined = n.parentId;
                    // Cycle guard — pathological saved data
                    // shouldn't lock the UI in an infinite loop.
                    let hops = 0;
                    while (parentId && hops < 8) {
                        const parent = current.find((p) => p.id === parentId);
                        if (!parent) break;
                        x += parent.position.x;
                        y += parent.position.y;
                        parentId = parent.parentId;
                        hops += 1;
                    }
                    return { x, y };
                };
                const currentNode = current.find((n) => n.id === node.id) ?? node;
                const world = getWorldPosition(currentNode);
                const size = getNodeSize(currentNode);
                const containingRegion = findRegionForRect(
                    current,
                    {
                        x: world.x,
                        y: world.y,
                        width: size.width,
                        height: size.height,
                    },
                    { preferredRegionId: currentNode.parentId }
                );
                const currentParentId = currentNode.parentId ?? null;
                const targetParentId = containingRegion?.id ?? null;
                if (currentParentId === targetParentId) {
                    // No parent change. The position deltas were
                    // already applied frame-by-frame via
                    // `handleNodesChange`, but we still record a
                    // single history snapshot here so the operator
                    // can undo a drag with one ⌘Z. Without this
                    // commit the drag would be invisible to undo.
                    // Build 115.17 — also clear any drop-hover
                    // preview (the drag may have lit up a region
                    // mid-flight even though no parent change
                    // resulted).
                    const cleared = applyDropHover(current, null);
                    const annotated = annotateRegionCounts(cleared);
                    if (annotated !== current) {
                        emitChange(annotated, edges);
                        commitHistory(annotated, edges);
                        return annotated;
                    }
                    commitHistory(current, edges);
                    return current;
                }
                const newLocal = containingRegion
                    ? {
                          x: world.x - containingRegion.position.x,
                          y: world.y - containingRegion.position.y,
                      }
                    : world;
                const next = current.map((n) => {
                    if (n.id !== node.id) return n;
                    return {
                        ...n,
                        position: newLocal,
                        parentId: containingRegion?.id,
                        // Build 115.16 — see the function-level
                        // comment above. Always undefined.
                        extent: undefined,
                    };
                });
                // Build 1175 — React Flow resolves parented
                // children in node-array order. If a device existed
                // before the region was added, reparenting left the
                // order as [child, parent], so React Flow rendered
                // the child's local coordinates as global for one
                // pass: the visible "snap out" bug. Keep the target
                // parent before the child whenever parentId changes.
                const ordered = ensureParentBeforeChild(
                    next,
                    node.id,
                    containingRegion?.id
                );
                // Build 115.17 — clear drop-hover preview now
                // that we've committed the parent change.
                const cleared = applyDropHover(ordered, null);
                const annotated = annotateRegionCounts(cleared);
                emitChange(annotated, edges);
                commitHistory(annotated, edges);
                return annotated;
            });
        },
        [edges, emitChange, commitHistory, applyDropHover, reactFlow]
    );

    const handleConnectEnd = useCallback(
        (event: MouseEvent | TouchEvent, connectionState: FinalConnectionState) => {
            if (reconnectingRef.current) return;
            const clientPoint = clientPointFromConnectionEvent(event);
            if (!clientPoint) return;
            const landingPoint = reactFlow.screenToFlowPosition(clientPoint);
            const anchored = resolveAnchoredConnection(
                connectionState,
                nodes,
                landingPoint
            );
            if (!anchored) return;

            const id = `e_${anchored.sourceId}__${anchored.targetId}__${Date.now()}`;
            // Build 113: new connections default to a forward arrow
            // so the customer's intent ("X talks to Y") is captured
            // immediately. They can still flip to no-arrow / both
            // via the inspector.
            const initialDirection: EdgeDirection = 'forward';
            const newEdge: RFEdge = {
                id,
                source: anchored.sourceId,
                target: anchored.targetId,
                sourceHandle: anchored.sourceHandle,
                targetHandle: anchored.targetHandle,
                // Build 114: animated edge type so the moving dot
                // is on by default for new directional connections.
                type: ANIMATED_EDGE_TYPE,
                style: edgeStyleForKind('physical'),
                ...markersForDirection(initialDirection, 'closed'),
                data: {
                    kind: 'physical',
                    direction: initialDirection,
                    arrowStyle: 'closed' as ArrowStyleKey,
                    liveStatus: false,
                    notes: '',
                    sourceAnchor: anchored.sourceAnchor,
                    targetAnchor: anchored.targetAnchor,
                },
            };
            setEdges((current) => {
                const next = [...current, newEdge];
                emitChange(nodes, next);
                commitHistory(nodes, next);
                return next;
            });
        },
        [nodes, emitChange, commitHistory, reactFlow]
    );

    const handleReconnectEnd = useCallback(
        (
            event: MouseEvent | TouchEvent,
            oldEdge: RFEdge,
            _handleType: HandleType,
            connectionState: FinalConnectionState
        ) => {
            reconnectingRef.current = false;
            const clientPoint = clientPointFromConnectionEvent(event);
            if (!clientPoint) return;
            const landingPoint = reactFlow.screenToFlowPosition(clientPoint);
            const anchored = resolveAnchoredConnection(
                connectionState,
                nodes,
                landingPoint,
                oldEdge
            );
            if (!anchored) return;

            setEdges((current) => {
                const next = current.map((edge) => {
                    if (edge.id !== oldEdge.id) return edge;
                    const existingData = (edge.data ?? {}) as Record<string, unknown>;
                    return {
                        ...edge,
                        source: anchored.sourceId,
                        target: anchored.targetId,
                        sourceHandle: anchored.sourceHandle,
                        targetHandle: anchored.targetHandle,
                        data: {
                            ...existingData,
                            sourceAnchor: anchored.sourceAnchor,
                            targetAnchor: anchored.targetAnchor,
                        },
                    };
                });
                emitChange(nodes, next);
                commitHistory(nodes, next);
                return next;
            });
        },
        [nodes, emitChange, commitHistory, reactFlow]
    );

    const handleEdgeEndpointDrag = useCallback(
        (args: EdgeEndpointDragArgs): void => {
            if (isViewMode) return;

            if (args.phase === 'start') {
                endpointDragOriginalEdgeRef.current =
                    edges.find((edge) => edge.id === args.edgeId) ?? null;
                return;
            }

            if (args.phase === 'cancel') {
                const original = endpointDragOriginalEdgeRef.current;
                endpointDragOriginalEdgeRef.current = null;
                if (!original) return;
                setEdges((current) =>
                    current.map((edge) =>
                        edge.id === original.id ? original : edge
                    )
                );
                return;
            }

            const point = args.point;
            if (!point) return;

            setEdges((current) => {
                const edge = current.find((candidate) => candidate.id === args.edgeId);
                if (!edge) return current;
                const original = endpointDragOriginalEdgeRef.current;
                const oppositeNodeId =
                    args.endpoint === 'source' ? edge.target : edge.source;
                const destination = findConnectableNodeAtPoint(nodes, point, {
                    excludeId: oppositeNodeId,
                });

                if (!destination) {
                    if (args.phase === 'commit' && original) {
                        endpointDragOriginalEdgeRef.current = null;
                        return current.map((candidate) =>
                            candidate.id === original.id ? original : candidate
                        );
                    }
                    return current;
                }

                const anchor = anchorFromFlowPoint(
                    nodes,
                    destination.id,
                    point
                );
                if (!anchor) return current;

                const handleId = handleIdForAnchor(anchor, args.endpoint);
                let updatedEdge: RFEdge | null = null;
                const next = current.map((candidate) => {
                    if (candidate.id !== args.edgeId) return candidate;
                    const existingData = (candidate.data ?? {}) as Record<
                        string,
                        unknown
                    >;
                    updatedEdge = {
                        ...candidate,
                        source:
                            args.endpoint === 'source'
                                ? destination.id
                                : candidate.source,
                        target:
                            args.endpoint === 'target'
                                ? destination.id
                                : candidate.target,
                        sourceHandle:
                            args.endpoint === 'source'
                                ? handleId
                                : candidate.sourceHandle,
                        targetHandle:
                            args.endpoint === 'target'
                                ? handleId
                                : candidate.targetHandle,
                        data: {
                            ...existingData,
                            sourceAnchor:
                                args.endpoint === 'source'
                                    ? anchor
                                    : existingData.sourceAnchor,
                            targetAnchor:
                                args.endpoint === 'target'
                                    ? anchor
                                    : existingData.targetAnchor,
                        },
                    };
                    return updatedEdge;
                });

                if (args.phase === 'commit') {
                    endpointDragOriginalEdgeRef.current = null;
                    emitChange(nodes, next);
                    commitHistory(nodes, next);
                    if (updatedEdge) {
                        setSelection((prev) =>
                            prev?.kind === 'edge' && prev.edge.id === args.edgeId
                                ? { kind: 'edge', edge: updatedEdge as RFEdge }
                                : prev
                        );
                    }
                }

                return next;
            });
        },
        [edges, isViewMode, nodes, emitChange, commitHistory]
    );

    /** Drop handler. Reads the palette payload off the DnD
     *  channel, computes the drop point in flow coordinates,
     *  determines whether it landed inside a region (→ child
     *  with `parentId`) or on the open canvas, and spawns the
     *  appropriate node. */
    const handleDrop = useCallback(
        (event: React.DragEvent<HTMLDivElement>) => {
            event.preventDefault();
            if (!rfInstance) return;
            const raw = event.dataTransfer.getData(PALETTE_DND_MIME);
            if (!raw) return;
            let payload: PaletteDragPayload;
            try {
                payload = JSON.parse(raw) as PaletteDragPayload;
            } catch {
                return; // malformed payload — ignore
            }
            const cursor = rfInstance.screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
            });

            /** Build 115.17 — palette drops are now CENTRED on
             *  the cursor instead of placing the shape's
             *  top-left at the cursor. The previous behaviour
             *  meant a card dropped near a region's right edge
             *  ended up extending 100+px BEYOND the edge —
             *  visually outside the region even though the
             *  operator dropped INSIDE it. Centring matches the
             *  drag-image position the browser shows during the
             *  drag, so "what you see is what you get" on
             *  release.
             *
             *  The snap-to-20px-grid is then applied to the
             *  resulting top-left so customer-arranged diagrams
             *  stay tidy. */
            const snapPoint = (p: XYPosition): XYPosition => ({
                x: Math.round(p.x / 20) * 20,
                y: Math.round(p.y / 20) * 20,
            });
            /** Compute the snapped top-left for a shape of the
             *  given size whose CENTRE should land at `cursor`. */
            const centeredTopLeft = (
                size: { width: number; height: number }
            ): XYPosition =>
                snapPoint({
                    x: cursor.x - size.width / 2,
                    y: cursor.y - size.height / 2,
                });

            setNodes((current) => {
                let newNode: RFNode;
                if (payload.variant === 'textbox') {
                    // Build 115.1 — annotation drop. Honour
                    // region-parenting (so a textbox dropped inside
                    // a region moves with it on subsequent drags),
                    // mirroring how shape drops behave.
                    //
                    // Build 115.17 — textboxes are sized by their
                    // text content (no fixed width on the node),
                    // so we use a small representative rect for
                    // the centring + hit-test. 120×40 covers the
                    // typical first-line label without cropping
                    // the user's intent.
                    const TEXTBOX_HIT_SIZE = { width: 120, height: 40 };
                    const topLeft = centeredTopLeft(TEXTBOX_HIT_SIZE);
                    const shapeRect = {
                        x: topLeft.x,
                        y: topLeft.y,
                        width: TEXTBOX_HIT_SIZE.width,
                        height: TEXTBOX_HIT_SIZE.height,
                    };
                    const region = findRegionForRect(current, shapeRect);
                    const localPoint = region
                        ? {
                              x: topLeft.x - region.position.x,
                              y: topLeft.y - region.position.y,
                          }
                        : topLeft;
                    newNode = {
                        id: nextNodeId('textbox'),
                        type: TEXT_BOX_NODE_TYPE,
                        position: localPoint,
                        parentId: region?.id,
                        // Build 115.16 — see `handleNodeDragStop`
                        // for why parented nodes deliberately do
                        // not get `extent: 'parent'`.
                        extent: undefined,
                        draggable: true,
                        selectable: true,
                        connectable: false,
                        data: {
                            text: payload.defaultText,
                            fontSize: TEXT_BOX_DEFAULTS.fontSize,
                            color: TEXT_BOX_DEFAULTS.color,
                            bold: TEXT_BOX_DEFAULTS.bold,
                            italic: TEXT_BOX_DEFAULTS.italic,
                            background: TEXT_BOX_DEFAULTS.background,
                            border: TEXT_BOX_DEFAULTS.border,
                            align: TEXT_BOX_DEFAULTS.align,
                        } satisfies TextBoxNodeData,
                        zIndex: 50,
                    };
                } else if (payload.variant === 'region') {
                    // Build 115.17 — centre the new region on the
                    // cursor. Regions are 360×220 by default, so
                    // dropping with cursor at the canvas centre
                    // produces a region centred on that point
                    // rather than offset 180×110 to the
                    // bottom-right of the cursor.
                    newNode = {
                        id: nextNodeId('region'),
                        type: REGION_NODE_TYPE,
                        position: centeredTopLeft({
                            width: payload.defaultWidth,
                            height: payload.defaultHeight,
                        }),
                        style: {
                            width: payload.defaultWidth,
                            height: payload.defaultHeight,
                        },
                        data: {
                            label: payload.defaultLabel,
                            deviceCount: 0,
                        },
                        zIndex: 0,
                    };
                } else if (payload.variant === 'customStencil') {
                    const nodeSize = nodeSizeForCustomStencil(payload.asset);
                    const topLeft = centeredTopLeft(nodeSize);
                    const shapeRect = {
                        x: topLeft.x,
                        y: topLeft.y,
                        width: nodeSize.width,
                        height: nodeSize.height,
                    };
                    const region = findRegionForRect(current, shapeRect);
                    const localPoint = region
                        ? {
                              x: topLeft.x - region.position.x,
                              y: topLeft.y - region.position.y,
                          }
                        : topLeft;
                    newNode = {
                        id: nextNodeId('custom-stencil'),
                        type: 'device:custom_stencil',
                        position: localPoint,
                        parentId: region?.id,
                        extent: undefined,
                        style: {
                            width: nodeSize.width,
                            height: nodeSize.height,
                        },
                        data: buildDeviceData({
                            id: payload.asset.id,
                            label: payload.asset.label,
                            shortLabel: payload.asset.label,
                            shape: 'custom_stencil',
                            customStencil: payload.asset,
                            raw: {
                                device_type: 'custom_stencil',
                                custom_stencil_id: payload.asset.id,
                            },
                        }),
                        zIndex: 1,
                    };
                } else if (payload.variant === 'shape') {
                    const nodeSize = nodeSizeForShape(payload.shape);
                    const topLeft = centeredTopLeft(nodeSize);
                    const shapeRect = {
                        x: topLeft.x,
                        y: topLeft.y,
                        width: nodeSize.width,
                        height: nodeSize.height,
                    };
                    const region = findRegionForRect(current, shapeRect);
                    const localPoint = region
                        ? {
                              x: topLeft.x - region.position.x,
                              y: topLeft.y - region.position.y,
                          }
                        : topLeft;
                    newNode = {
                        id: nextNodeId('shape'),
                        type: `device:${payload.shape}`,
                        position: localPoint,
                        parentId: region?.id,
                        // Build 115.16 — see `handleNodeDragStop`
                        // for why parented nodes deliberately do
                        // not get `extent: 'parent'`.
                        extent: undefined,
                        style: {
                            width: nodeSize.width,
                            height: nodeSize.height,
                        },
                        data: buildDeviceData({
                            id: nextNodeId('asset'),
                            label: payload.defaultLabel,
                            shortLabel: payload.defaultLabel,
                            shape: payload.shape,
                        }),
                        zIndex: 1,
                    };
                } else {
                    // asset variant — preserve the asset id as the
                    // React Flow node id so duplicate drops collide
                    // and we keep at most one node per real device
                    // per diagram. Skip the drop if the asset is
                    // already on the canvas.
                    if (current.some((n) => n.id === payload.assetId)) {
                        return current;
                    }
                    const topLeft = centeredTopLeft(NODE_SIZE_PRESETS.device);
                    const shapeRect = {
                        x: topLeft.x,
                        y: topLeft.y,
                        width: NODE_SIZE_PRESETS.device.width,
                        height: NODE_SIZE_PRESETS.device.height,
                    };
                    const region = findRegionForRect(current, shapeRect);
                    const localPoint = region
                        ? {
                              x: topLeft.x - region.position.x,
                              y: topLeft.y - region.position.y,
                          }
                        : topLeft;
                    const live = assetIndex?.get(payload.assetId);
                    // Build 114: dropping a fresh asset onto the
                    // canvas runs through the same status-fold as
                    // hydrating a saved one, so dropped devices
                    // get the gray "no telemetry" dot if Splunk
                    // isn't currently seeing events from them.
                    const droppedStatus = resolveEffectiveStatus(
                        live?.status ?? 'unknown',
                        [
                            live?.label ?? payload.label,
                            live?.shortLabel ?? payload.shortLabel,
                            payload.assetId,
                            live?.raw['hostname'] as string | undefined,
                            live?.raw['device_name'] as string | undefined,
                        ],
                        visibilityIndex
                    );
                    newNode = {
                        id: payload.assetId,
                        type: `device:${payload.shape}`,
                        position: localPoint,
                        parentId: region?.id,
                        // Build 115.16 — see `handleNodeDragStop`
                        // for why parented nodes deliberately do
                        // not get `extent: 'parent'`.
                        extent: undefined,
                        style: {
                            width: NODE_SIZE_PRESETS.device.width,
                            height: NODE_SIZE_PRESETS.device.height,
                        },
                        data: buildDeviceData({
                            id: payload.assetId,
                            label: live?.label ?? payload.label,
                            shortLabel: live?.shortLabel ?? payload.shortLabel,
                            shape: payload.shape,
                            status: droppedStatus,
                            raw: live?.raw,
                            // Build 115.2 — populate vendor / model /
                            // serial from the live asset_inventory row
                            // at drop time. Without these the
                            // inspector's Hardware fields read empty
                            // (the "Cisco" / "WS-C6504-E" you saw
                            // are *placeholder* strings, not values),
                            // even though the device card itself fell
                            // back to `raw.platform_id` and *looked*
                            // correct. Fixing the drop puts a single
                            // source of truth on the node.
                            vendor: live?.vendor,
                            model: live?.model,
                            serialNumber: live?.serialNumber,
                        }),
                        zIndex: 1,
                    };
                }
                // Build 115.17 — clear the live drop-hover
                // preview now that the drop has resolved. Without
                // this, the highlighted region would stay lit
                // until the next dragOver / leave because no
                // dragLeave fires after a successful drop.
                const withNewNode = [...current, newNode];
                const withMembership = reconcileRegionMembership(withNewNode);
                const cleared = applyDropHover(withMembership, null);
                const next = annotateRegionCounts(cleared);
                emitChange(next, edges);
                commitHistory(next, edges);
                return next;
            });
        },
        [
            rfInstance,
            assetIndex,
            visibilityIndex,
            edges,
            emitChange,
            commitHistory,
            applyDropHover,
        ]
    );

    const handleDragOver = useCallback(
        (event: React.DragEvent<HTMLDivElement>) => {
            // Only accept drops that carry our palette mime — but we
            // can't read mime values here (browsers limit it on
            // dragover). The cheapest signal is `types` includes our
            // custom mime; if it does, we set drop effect to copy.
            if (!event.dataTransfer.types.includes(PALETTE_DND_MIME)) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';
            // Build 115.17 — compute and surface the live drop
            // preview. We model the to-be-spawned shape as a
            // device-sized rect centred on the cursor (the same
            // sizing handleDrop uses for shape / asset variants —
            // close enough for region drops since regions don't
            // parent into other regions, and close enough for
            // textboxes since their rect is even smaller). The
            // candidate region (if any) lights up via
            // `dropHovering`.
            if (!rfInstance) return;
            const cursor = rfInstance.screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
            });
            const topLeft = {
                x: Math.round(
                    (cursor.x - NODE_SIZE_PRESETS.device.width / 2) / 20
                ) * 20,
                y: Math.round(
                    (cursor.y - NODE_SIZE_PRESETS.device.height / 2) / 20
                ) * 20,
            };
            const shapeRect = {
                x: topLeft.x,
                y: topLeft.y,
                width: NODE_SIZE_PRESETS.device.width,
                height: NODE_SIZE_PRESETS.device.height,
            };
            setNodes((current) => {
                const region = findRegionForRect(current, shapeRect);
                return applyDropHover(current, region?.id ?? null);
            });
        },
        [rfInstance, setNodes, applyDropHover]
    );

    /** Build 115.17 — clear the drop-hover preview when the
     *  cursor leaves the canvas mid-drag (e.g. operator
     *  cancelled and dragged out to the palette / browser
     *  chrome). Without this, the highlight can stick on a
     *  region until the user clicks elsewhere. */
    const handleDragLeave = useCallback(
        (event: React.DragEvent<HTMLDivElement>) => {
            // dragleave fires for every child element transition;
            // ignore the events that are still inside our wrapper.
            const related = event.relatedTarget as Node | null;
            if (related && event.currentTarget.contains(related)) return;
            clearDropHover();
        },
        [clearDropHover]
    );

    /** Build 115.17 — same drop-hover preview as
     *  `handleDragOver`, but for the case where the operator is
     *  dragging an EXISTING node around the canvas (no HTML5
     *  DnD). Build 1177 computes the candidate region from the
     *  dragged card rectangle, matching `handleNodeDragStop`, so
     *  the highlight is a faithful preview of "what happens if I
     *  release right now". */
    const handleNodeDrag = useCallback(
        (_event: React.MouseEvent, node: RFNode) => {
            if (
                node.type === REGION_NODE_TYPE ||
                node.type === DIAGRAM_TITLE_NODE_TYPE
            ) {
                return;
            }
            setNodes((current) => {
                const currentNode = current.find((n) => n.id === node.id) ?? node;
                const world = getNodeWorldPosition(current, currentNode);
                const size = getNodeSize(currentNode);
                const region = findRegionForRect(
                    current,
                    {
                        x: world.x,
                        y: world.y,
                        width: size.width,
                        height: size.height,
                    },
                    { preferredRegionId: currentNode.parentId }
                );
                return applyDropHover(current, region?.id ?? null);
            });
        },
        [setNodes, applyDropHover]
    );

    const handleNodeClick = useCallback((_e: React.MouseEvent, node: RFNode) => {
        setSelection({ kind: 'node', node });
    }, []);

    const handleEdgeClick = useCallback((_e: React.MouseEvent, edge: RFEdge) => {
        setSelection({ kind: 'edge', edge });
    }, []);

    const handlePaneClick = useCallback(() => {
        setSelection(null);
    }, []);

    const handleNodeUpdate = useCallback(
        (update: NodeUpdate): void => {
            // Capture the rebound node from the setter so the panel
            // selection rebroadcast (below) sees the post-update data
            // instead of the stale `prev.node`. Without this, binding a
            // shape to a host wouldn't refresh the inspector's
            // Vendor/Model fields until the operator clicked away
            // and back.
            let updatedNode: RFNode | null = null;
            setNodes((current) => {
                const next = current.map((n) => {
                    if (n.id !== update.id) return n;
                    if (n.type === REGION_NODE_TYPE) {
                        const data = (n.data ?? {}) as Record<string, unknown>;
                        return {
                            ...n,
                            data: {
                                ...data,
                                label: update.label ?? data.label,
                            },
                        };
                    }
                    const existingData = (n.data ?? {}) as Record<string, unknown>;
                    const existingNode = (existingData.node ?? {}) as Record<
                        string,
                        unknown
                    >;
                    // Build 115.3 — host binding. Three cases:
                    //   • assetId is a non-empty string → BIND. We
                    //     re-derive label / shortLabel / vendor /
                    //     model / serial / raw from the live asset
                    //     and (when the operator hasn't explicitly
                    //     picked a shape via update.shape) re-shape
                    //     the icon based on the asset's device_type.
                    //     `data.node.id` is set to the asset id so
                    //     resolveEffectiveStatus's `| metadata` host
                    //     match can light up the status dot.
                    //   • assetId === '' → UNBIND. `data.node.id`
                    //     reverts to `n.id` so rfToSaved drops the
                    //     persisted assetId next save. Operator's
                    //     hand-typed label / vendor / model stay
                    //     untouched.
                    //   • assetId === undefined → no binding change;
                    //     fall through to the legacy update path.
                    const isBinding =
                        typeof update.assetId === 'string' &&
                        update.assetId.length > 0;
                    const isUnbinding = update.assetId === '';
                    const live = isBinding
                        ? assetIndex?.get(update.assetId as string) ?? undefined
                        : undefined;
                    const liveShape: DeviceShapeId | undefined = live?.shape;
                    const finalShape: DeviceShapeId | undefined =
                        update.shape ??
                        (isBinding ? liveShape : undefined) ??
                        (existingNode.shape as DeviceShapeId | undefined) ??
                        (n.type?.replace('device:', '') as DeviceShapeId | undefined);
                    const newType = finalShape ? `device:${finalShape}` : n.type;
                    if (isBinding && live) {
                        // Rebuild data via buildDeviceData so the
                        // node looks identical to one freshly dropped
                        // from the inventory tab.
                        const labelCandidate =
                            update.label ?? live.label ?? (existingNode.label as string | undefined) ?? n.id;
                        const shortLabelCandidate =
                            update.shortLabel ??
                            live.shortLabel ??
                            (existingNode.shortLabel as string | undefined) ??
                            n.id;
                        const vendorCandidate =
                            update.vendor === undefined
                                ? live.vendor
                                : update.vendor.trim().length > 0
                                  ? update.vendor.trim()
                                  : undefined;
                        const modelCandidate =
                            update.model === undefined
                                ? live.model
                                : update.model.trim().length > 0
                                  ? update.model.trim()
                                  : undefined;
                        // Build 115.13 — IP override on bind. We
                        // accept the operator's typed value
                        // (preserving a label they entered before
                        // binding); when they didn't touch the
                        // field we leave the slot undefined so
                        // the card falls back to the live asset
                        // row's `ip_address` at render time.
                        const ipCandidate =
                            update.ipAddress === undefined
                                ? undefined
                                : update.ipAddress.trim().length > 0
                                  ? update.ipAddress.trim()
                                  : undefined;
                        const folded = resolveEffectiveStatus(
                            live.status ?? 'unknown',
                            [
                                live.label,
                                live.shortLabel,
                                update.assetId,
                                (live.raw['hostname'] as string | undefined) ?? undefined,
                                (live.raw['device_name'] as string | undefined) ?? undefined,
                            ],
                            visibilityIndex
                        );
                        const newData = buildDeviceData({
                            id: update.assetId as string,
                            label: labelCandidate,
                            shortLabel: shortLabelCandidate,
                            shape: finalShape ?? 'generic',
                            status: folded,
                            notes:
                                update.notes ??
                                (existingData.notes as string | undefined),
                            raw: live.raw,
                            vendor: vendorCandidate,
                            model: modelCandidate,
                            serialNumber: live.serialNumber,
                            ipAddress: ipCandidate,
                        });
                        const result = { ...n, type: newType, data: newData };
                        updatedNode = result;
                        return result;
                    }
                    if (isUnbinding) {
                        // Reset the data.node.id to the synthetic
                        // React Flow id and clear inventory raw, so
                        // the next rfToSaved skips persisting an
                        // assetId. Operator overrides for label /
                        // shortLabel / vendor / model carry through —
                        // unbinding shouldn't punish the operator
                        // for typing in fields manually.
                        const labelCandidate =
                            update.label ??
                            (existingNode.label as string | undefined) ??
                            n.id;
                        const shortLabelCandidate =
                            update.shortLabel ??
                            (existingNode.shortLabel as string | undefined) ??
                            n.id;
                        const vendorCandidate =
                            update.vendor === undefined
                                ? (existingNode.vendor as string | undefined)
                                : update.vendor.trim().length > 0
                                  ? update.vendor.trim()
                                  : undefined;
                        const modelCandidate =
                            update.model === undefined
                                ? (existingNode.model as string | undefined)
                                : update.model.trim().length > 0
                                  ? update.model.trim()
                                  : undefined;
                        // Build 115.13 — preserve operator IP on
                        // unbind. They likely typed it before they
                        // realised they wanted the shape unbound;
                        // erasing it here would punish that flow.
                        const ipCandidate =
                            update.ipAddress === undefined
                                ? (existingNode.ipAddress as string | undefined)
                                : update.ipAddress.trim().length > 0
                                  ? update.ipAddress.trim()
                                  : undefined;
                        const newData = buildDeviceData({
                            id: n.id,
                            label: labelCandidate,
                            shortLabel: shortLabelCandidate,
                            shape: finalShape ?? 'generic',
                            status: 'unknown',
                            notes:
                                update.notes ??
                                (existingData.notes as string | undefined),
                            raw: { device_type: finalShape ?? 'generic' },
                            vendor: vendorCandidate,
                            model: modelCandidate,
                            serialNumber: undefined,
                            ipAddress: ipCandidate,
                        });
                        const result = { ...n, type: newType, data: newData };
                        updatedNode = result;
                        return result;
                    }
                    // Build 115: vendor + model are nullable. An
                    // operator can set them ("Cisco") or clear them
                    // (empty string) — both round-trip. We treat
                    // empty string as "remove this override" by
                    // dropping it to undefined so the live
                    // asset_inventory value (if any) flows through.
                    const nextVendor =
                        update.vendor === undefined
                            ? (existingNode.vendor as string | undefined)
                            : update.vendor.trim().length > 0
                              ? update.vendor.trim()
                              : undefined;
                    const nextModel =
                        update.model === undefined
                            ? (existingNode.model as string | undefined)
                            : update.model.trim().length > 0
                              ? update.model.trim()
                              : undefined;
                    // Build 115.13 — IP override mirrors vendor /
                    // model: empty string clears, undefined keeps,
                    // anything else replaces. Persisted via
                    // rfToSaved when non-empty.
                    const nextIpAddress =
                        update.ipAddress === undefined
                            ? (existingNode.ipAddress as string | undefined)
                            : update.ipAddress.trim().length > 0
                              ? update.ipAddress.trim()
                              : undefined;
                    const nextShape =
                        update.shape ??
                        ((existingNode.shape as DeviceShapeId | undefined) ??
                            'generic');
                    const result = {
                        ...n,
                        type: newType,
                        data: {
                            ...existingData,
                            customStencil:
                                nextShape === 'custom_stencil'
                                    ? (existingData.customStencil as
                                          | CustomStencilAsset
                                          | undefined)
                                    : undefined,
                            node: {
                                ...existingNode,
                                label: update.label ?? existingNode.label,
                                shortLabel: update.shortLabel ?? existingNode.shortLabel,
                                shape: nextShape,
                                vendor: nextVendor,
                                model: nextModel,
                                ipAddress: nextIpAddress,
                            },
                            notes: update.notes ?? existingData.notes,
                        },
                    };
                    updatedNode = result;
                    return result;
                });
                emitChange(next, edges);
                commitHistory(next, edges);
                return next;
            });
            // Rebroadcast so the inspector reflects the post-apply
            // state — especially important for the binding path,
            // where vendor / model / label all flipped at once.
            // `updatedNode` was captured inside the setter above.
            const refreshed = updatedNode;
            if (refreshed) {
                setSelection((prev) =>
                    prev && prev.kind === 'node' && prev.node.id === update.id
                        ? { kind: 'node', node: refreshed }
                        : prev
                );
            }
        },
        [edges, emitChange, commitHistory, assetIndex, visibilityIndex]
    );

    /** Build 115: region-specific updater. Lets the inspector
     *  rename a region (header label) and pick its accent colour
     *  without dragging both fields through the generic NodeUpdate
     *  payload (which is device-shaped). The discriminator is the
     *  `kind: 'region'` literal in `RegionUpdate`. */
    const handleRegionUpdate = useCallback(
        (update: RegionUpdate): void => {
            setNodes((current) => {
                const next = current.map((n) => {
                    if (n.id !== update.id || n.type !== REGION_NODE_TYPE) return n;
                    const data = (n.data ?? {}) as Record<string, unknown>;
                    return {
                        ...n,
                        data: {
                            ...data,
                            label: update.label,
                            // `accent` is allowed to be cleared
                            // (undefined → falls through to slate
                            // default in the renderer).
                            accent: update.accent,
                        },
                    };
                });
                emitChange(next, edges);
                commitHistory(next, edges);
                return next;
            });
        },
        [edges, emitChange, commitHistory]
    );

    const handleEdgeUpdate = useCallback(
        (update: EdgeUpdate): void => {
            setEdges((current) => {
                const next = current.map((e) => {
                    if (e.id !== update.id) return e;
                    const existingData = (e.data ?? {}) as Record<string, unknown>;
                    const newKind =
                        update.kind ?? (((existingData.kind as string | undefined) ??
                            'physical') as SavedDiagramEdge['kind']);
                    // Build 113: pull direction either from the
                    // update or from the existing edge data so an
                    // operator who only renames the edge doesn't
                    // accidentally lose their arrow setting.
                    const newDirection: EdgeDirection =
                        update.direction ??
                        ((existingData.direction as EdgeDirection | undefined) ??
                            'none');
                    // Build 115.11: arrow tip glyph + live-status mode.
                    // Like direction we keep the prior value when the
                    // operator's update doesn't touch the field.
                    const newArrowStyle: ArrowStyleKey =
                        (update.arrowStyle as ArrowStyleKey | undefined) ??
                        ((existingData.arrowStyle as ArrowStyleKey | undefined) ??
                            'closed');
                    const newLiveStatus: boolean =
                        update.liveStatus !== undefined
                            ? update.liveStatus
                            : existingData.liveStatus === true;
                    const markers = markersForDirection(newDirection, newArrowStyle);
                    // Build 114: animation colour. Apply if the
                    // update specifies one; otherwise keep what
                    // was there. Empty-string is treated as
                    // "unset" so the AnimatedEdge falls back to
                    // its per-kind default.
                    const newAnimationColor =
                        update.animationColor !== undefined
                            ? update.animationColor || undefined
                            : (existingData.animationColor as string | undefined);
                    // Build 115.5: line colour (stroke). Same
                    // sentinel convention as animationColor:
                    // empty string clears the override (falls back
                    // to the per-kind default), undefined leaves
                    // the existing override untouched.
                    const newLineColor =
                        update.lineColor !== undefined
                            ? update.lineColor || undefined
                            : (existingData.lineColor as string | undefined);
                    // Compose the final stroke style: per-kind
                    // base palette + operator override. Stroke
                    // width / dasharray are kept from the kind
                    // palette so a custom-coloured logical edge
                    // still reads as dotted, and a custom-coloured
                    // synthetic still reads as dashed.
                    const baseStyle = edgeStyleForKind(newKind);
                    const finalStyle: React.CSSProperties = newLineColor
                        ? { ...baseStyle, stroke: newLineColor }
                        : baseStyle;
                    return {
                        ...e,
                        // Build 114: ensure the edge stays on the
                        // animated edge type — applies to legacy
                        // edges hydrated before defaultEdgeOptions
                        // had a chance to set it.
                        type: ANIMATED_EDGE_TYPE,
                        label: update.label ?? e.label,
                        style: finalStyle,
                        // Reset both marker slots first, then apply
                        // the new ones — otherwise switching from
                        // 'both' to 'forward' would leave the start
                        // marker behind.
                        markerStart: markers.markerStart,
                        markerEnd: markers.markerEnd,
                        data: {
                            ...existingData,
                            kind: newKind,
                            direction: newDirection,
                            arrowStyle: newArrowStyle,
                            liveStatus: newLiveStatus,
                            animationColor: newAnimationColor,
                            lineColor: newLineColor,
                            notes: update.notes,
                        },
                    };
                });
                emitChange(nodes, next);
                commitHistory(nodes, next);
                return next;
            });
        },
        [nodes, emitChange, commitHistory]
    );

    /** Build 113: title-node update path. The PropertiesPanel only
     *  sends a `TitleUpdate` for the title node, so we update both
     *  the node's data (so the visual refreshes) and rebroadcast
     *  the selection so the panel's controlled inputs see the new
     *  values. */
    const handleTitleUpdate = useCallback(
        (update: TitleUpdate): void => {
            setNodes((current) => {
                const next = current.map((n) => {
                    if (n.id !== update.id) return n;
                    if (n.type !== DIAGRAM_TITLE_NODE_TYPE) return n;
                    return {
                        ...n,
                        data: {
                            text: update.text,
                            fontSize: update.fontSize,
                            color: update.color,
                            bold: update.bold,
                            italic: update.italic,
                        } satisfies DiagramTitleNodeData,
                    };
                });
                emitChange(next, edges);
                commitHistory(next, edges);
                return next;
            });
            setSelection((prev) =>
                prev && prev.kind === 'node' && prev.node.id === update.id
                    ? {
                          kind: 'node',
                          node: {
                              ...prev.node,
                              data: {
                                  text: update.text,
                                  fontSize: update.fontSize,
                                  color: update.color,
                                  bold: update.bold,
                                  italic: update.italic,
                              } satisfies DiagramTitleNodeData,
                          },
                      }
                    : prev
            );
        },
        [edges, emitChange, commitHistory]
    );

    /** Build 115.1 — textbox update path. Mirrors handleTitleUpdate
     *  but operates on `TextBoxNodeData` and is keyed by node id
     *  rather than the singleton title id, since multiple textboxes
     *  coexist per diagram. Re-broadcasts the selection so the
     *  inspector's controlled inputs see the post-apply state. */
    const handleTextBoxUpdate = useCallback(
        (update: TextBoxUpdate): void => {
            setNodes((current) => {
                const next = current.map((n) => {
                    if (n.id !== update.id) return n;
                    if (n.type !== TEXT_BOX_NODE_TYPE) return n;
                    return {
                        ...n,
                        data: {
                            text: update.text,
                            fontSize: update.fontSize,
                            color: update.color,
                            bold: update.bold,
                            italic: update.italic,
                            background: update.background,
                            border: update.border,
                            align: update.align,
                        } satisfies TextBoxNodeData,
                    };
                });
                emitChange(next, edges);
                commitHistory(next, edges);
                return next;
            });
            setSelection((prev) =>
                prev && prev.kind === 'node' && prev.node.id === update.id
                    ? {
                          kind: 'node',
                          node: {
                              ...prev.node,
                              data: {
                                  text: update.text,
                                  fontSize: update.fontSize,
                                  color: update.color,
                                  bold: update.bold,
                                  italic: update.italic,
                                  background: update.background,
                                  border: update.border,
                                  align: update.align,
                              } satisfies TextBoxNodeData,
                          },
                      }
                    : prev
            );
        },
        [edges, emitChange, commitHistory]
    );

    /** Build 113: insert a title at the viewport center, or focus
     *  the existing title if one is already present. Idempotent —
     *  safe to call from a header button without checking state. */
    const addOrSelectTitle = useCallback((): void => {
        setNodes((current) => {
            const existing = current.find(
                (n) => n.type === DIAGRAM_TITLE_NODE_TYPE
            );
            if (existing) {
                setSelection({ kind: 'node', node: existing });
                // Pan/zoom to bring the title into view if it's
                // currently off-screen. Best-effort — failures are
                // non-fatal (e.g. viewport not ready).
                try {
                    reactFlow.fitView({
                        padding: 0.25,
                        duration: 250,
                        nodes: [{ id: existing.id }],
                        maxZoom: 1.5,
                    });
                } catch {
                    // ignore
                }
                return current;
            }
            // No title yet — drop one at the current viewport center.
            // We use `getViewport()` + the wrapper bounds to estimate
            // a "near the top" position so the title lands somewhere
            // immediately useful instead of dead-center over the
            // existing diagram.
            const vp = reactFlow.getViewport();
            const wrapperRect = wrapperRef.current?.getBoundingClientRect();
            const screenX = wrapperRect ? wrapperRect.left + wrapperRect.width / 2 : 200;
            // Land the title roughly 12% from the top of the viewport.
            const screenY = wrapperRect ? wrapperRect.top + wrapperRect.height * 0.12 : 80;
            let pos: XYPosition;
            try {
                pos = reactFlow.screenToFlowPosition({ x: screenX, y: screenY });
            } catch {
                pos = { x: -vp.x / vp.zoom, y: -vp.y / vp.zoom };
            }
            const newTitle: RFNode = savedTitleToRF({
                text: '',
                x: pos.x,
                y: pos.y,
                fontSize: DIAGRAM_TITLE_DEFAULTS.fontSize,
                color: DIAGRAM_TITLE_DEFAULTS.color,
                bold: DIAGRAM_TITLE_DEFAULTS.bold,
                italic: DIAGRAM_TITLE_DEFAULTS.italic,
            });
            const next = [...current, newTitle];
            // Auto-select so the inspector opens with focus on the
            // text field — ready for the operator to start typing.
            setSelection({ kind: 'node', node: newTitle });
            emitChange(next, edges);
            commitHistory(next, edges);
            return next;
        });
    }, [edges, emitChange, commitHistory, reactFlow]);

    useImperativeHandle(
        handleRef,
        () => ({ addOrSelectTitle }),
        [addOrSelectTitle]
    );

    /** Delete one or many items at once. The selection-driven
     *  confirmation flow funnels through `executeDelete` after the
     *  operator confirms; the inspector's "Delete" button funnels
     *  through `requestDelete` (single-target convenience wrapper). */
    const executeDelete = useCallback(
        (targets: { id: string; kind: 'node' | 'edge' }[]): void => {
            if (targets.length === 0) return;
            const nodeIds = new Set(
                targets.filter((t) => t.kind === 'node').map((t) => t.id)
            );
            const edgeIds = new Set(
                targets.filter((t) => t.kind === 'edge').map((t) => t.id)
            );
            setNodes((currentNodes) => {
                const filteredNodes = annotateRegionCounts(
                    currentNodes
                        .filter((n) => !nodeIds.has(n.id))
                        .map((n) =>
                            n.parentId && nodeIds.has(n.parentId)
                                ? { ...n, parentId: undefined, extent: undefined }
                                : n
                        )
                );
                setEdges((currentEdges) => {
                    const filteredEdges = currentEdges.filter(
                        (e) =>
                            !edgeIds.has(e.id) &&
                            !nodeIds.has(e.source) &&
                            !nodeIds.has(e.target)
                    );
                    emitChange(filteredNodes, filteredEdges);
                    commitHistory(filteredNodes, filteredEdges);
                    return filteredEdges;
                });
                return filteredNodes;
            });
            setSelection(null);
        },
        [emitChange, commitHistory]
    );

    const handleDelete = useCallback(
        (id: string, kind: 'node' | 'edge'): void => {
            executeDelete([{ id, kind }]);
        },
        [executeDelete]
    );

    /** Build 115.2 — open the confirmation modal for one or many
     *  pending deletions. Resolving the labels here (instead of
     *  inside the modal) keeps the modal pure-presentational and
     *  lets us show the operator the exact short-alias of each
     *  device or "edge from A to B" for an edge. */
    const requestDelete = useCallback(
        (targets: { id: string; kind: 'node' | 'edge' }[]): void => {
            if (targets.length === 0) return;
            const annotated = targets
                .map(({ id, kind }) => {
                    if (kind === 'edge') {
                        const edge = edges.find((e) => e.id === id);
                        if (!edge) return null;
                        const src = nodes.find((n) => n.id === edge.source);
                        const dst = nodes.find((n) => n.id === edge.target);
                        const srcLabel =
                            (src?.data as { node?: { shortLabel?: string } })?.node
                                ?.shortLabel ?? edge.source;
                        const dstLabel =
                            (dst?.data as { node?: { shortLabel?: string } })?.node
                                ?.shortLabel ?? edge.target;
                        return {
                            id,
                            kind: 'edge' as const,
                            label: `${srcLabel} → ${dstLabel}`,
                        };
                    }
                    const node = nodes.find((n) => n.id === id);
                    if (!node) return null;
                    const data = node.data as
                        | { node?: { shortLabel?: string; label?: string }; label?: string; text?: string }
                        | undefined;
                    const label =
                        data?.node?.shortLabel ??
                        data?.node?.label ??
                        data?.label ??
                        data?.text ??
                        id;
                    return { id, kind: 'node' as const, label };
                })
                .filter((t): t is DeleteTarget => t !== null);
            if (annotated.length === 0) return;
            setPendingDelete(annotated);
        },
        [nodes, edges]
    );

    /** The user-facing "Delete" key handler. Builds the target list
     *  from React Flow's *internal* multi-select (when the operator
     *  has lasso-selected several items) before falling back to the
     *  inspector's single-item selection. */
    const requestDeleteFromKeyboard = useCallback((): void => {
        const selectedNodeIds = nodes.filter((n) => n.selected).map((n) => n.id);
        const selectedEdgeIds = edges.filter((e) => e.selected).map((e) => e.id);
        if (selectedNodeIds.length > 0 || selectedEdgeIds.length > 0) {
            requestDelete([
                ...selectedNodeIds.map((id) => ({ id, kind: 'node' as const })),
                ...selectedEdgeIds.map((id) => ({ id, kind: 'edge' as const })),
            ]);
            return;
        }
        if (selection?.kind === 'node') {
            requestDelete([{ id: selection.node.id, kind: 'node' }]);
        } else if (selection?.kind === 'edge') {
            requestDelete([{ id: selection.edge.id, kind: 'edge' }]);
        }
    }, [nodes, edges, selection, requestDelete]);

    /** Build 115.2 — undo / redo. We replay an entire saved payload
     *  rather than applying inverse operations; payloads are small
     *  (typically a few KB), JSON-serialisable, and rehydrating
     *  through the same code path that loads diagrams from the
     *  lookup is the simplest "definitely correct" implementation. */
    const replaySnapshot = useCallback(
        (payload: SavedDiagramPayload): void => {
            isReplayingRef.current = true;
            try {
                const groupNodes = payload.groups.map(savedGroupToRF);
                const deviceNodes = payload.nodes.map((n) =>
                    savedNodeToRF(n, assetIndex, visibilityIndex)
                );
                const titleNodes: RFNode[] = payload.title
                    ? [savedTitleToRF(payload.title)]
                    : [];
                const rfEdges = payload.edges.map(savedEdgeToRF);
                setNodes(
                    annotateRegionCounts(
                        reconcileRegionMembership([
                            ...groupNodes,
                            ...deviceNodes,
                            ...titleNodes,
                        ])
                    )
                );
                setEdges(rfEdges);
                setSelection(null);
                onChangeRef.current(payload);
            } finally {
                // Release the replay flag on the next frame so any
                // setNodes/setEdges side-effects scheduled for this
                // pass (`emitChange`, layout passes) finish first.
                window.requestAnimationFrame(() => {
                    isReplayingRef.current = false;
                });
            }
        },
        [assetIndex, visibilityIndex]
    );

    const undo = useCallback((): void => {
        if (!canUndo) return;
        const target = history.stack[history.index - 1];
        if (target) replaySnapshot(target);
        dispatchHistory({ type: 'undo' });
    }, [canUndo, history.stack, history.index, replaySnapshot]);

    const redo = useCallback((): void => {
        if (!canRedo) return;
        const target = history.stack[history.index + 1];
        if (target) replaySnapshot(target);
        dispatchHistory({ type: 'redo' });
    }, [canRedo, history.stack, history.index, replaySnapshot]);

    // --- Build 115.2: keyboard shortcuts --------------------------
    //
    // Shortcuts:
    //   Delete / Backspace  → confirm-then-delete current selection
    //   Esc                 → cancel pending modal, else clear selection
    //   ⌘Z / Ctrl+Z         → undo
    //   ⌘⇧Z / ⌘Y / Ctrl+Y   → redo
    //
    // We attach the listener at `window` level (not the wrapper)
    // because React Flow steals focus from the wrapper after every
    // node click, which would silently kill keyboard shortcuts. The
    // input/textarea/contentEditable guard at the top is what keeps
    // the inspector's text fields usable while the canvas listens.
    useEffect(() => {
        if (isViewMode) return undefined;
        const onKey = (e: KeyboardEvent): void => {
            const target = e.target as HTMLElement | null;
            if (target) {
                const tag = target.tagName;
                if (
                    tag === 'INPUT' ||
                    tag === 'TEXTAREA' ||
                    tag === 'SELECT' ||
                    target.isContentEditable
                ) {
                    return;
                }
            }
            const isMod = e.metaKey || e.ctrlKey;
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (pendingDelete) return; // already confirming
                e.preventDefault();
                requestDeleteFromKeyboard();
            } else if (e.key === 'Escape') {
                if (pendingDelete) {
                    setPendingDelete(null);
                } else if (selection) {
                    setSelection(null);
                }
            } else if (isMod && (e.key === 'z' || e.key === 'Z')) {
                e.preventDefault();
                if (e.shiftKey) {
                    redo();
                } else {
                    undo();
                }
            } else if (isMod && (e.key === 'y' || e.key === 'Y')) {
                e.preventDefault();
                redo();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [
        isViewMode,
        pendingDelete,
        selection,
        requestDeleteFromKeyboard,
        undo,
        redo,
    ]);

    const isEmpty = nodes.length === 0;
    const initialFitDone = useRef<boolean>(false);
    useEffect(() => {
        if (initialFitDone.current) return;
        if (nodes.length === 0) return;
        initialFitDone.current = true;
    }, [nodes.length]);

    const proOptions = useMemo(() => ({ hideAttribution: true }), []);
    const runtimeEdges = useMemo(
        () =>
            edges.map((edge) => ({
                ...edge,
                data: {
                    ...(edge.data ?? {}),
                    onEndpointDrag: isViewMode ? undefined : handleEdgeEndpointDrag,
                },
            })),
        [edges, handleEdgeEndpointDrag, isViewMode]
    );

    return (
        <div
            ref={wrapperRef}
            data-view-mode={isViewMode ? 'true' : undefined}
            className={cn(
                'relative w-full h-full rounded-xl border overflow-hidden',
                /* Build 115.23 — wrapper background.
                 *
                 * Three states, three palettes:
                 *
                 *   1. exporting=true        → ALWAYS pure white,
                 *      regardless of theme. Operators export to
                 *      share with audiences who want a printable
                 *      / pasteable artefact, so a dark-mode
                 *      capture would look out of place in a
                 *      slide deck or PDF report. White is the
                 *      universal "shareable" background.
                 *
                 *   2. isViewMode (Present)  → pure white in
                 *      light theme (was `bg-slate-50` ≈ #f8fafc,
                 *      a faint gray tint that operators told us
                 *      "looked dirty next to the white slide
                 *      around it"). Dark theme stays at
                 *      `slate-950` for cinematic dark walk-
                 *      throughs — the operator who chose dark
                 *      theme also wants present mode dark.
                 *
                 *   3. edit                  → unchanged from
                 *      previous builds (white in light, slate-
                 *      900 in dark). Operators are working in
                 *      this mode; the slight-warmer dark surface
                 *      is part of the editor identity. */
                exporting
                    ? 'bg-white border-slate-200'
                    : isViewMode
                    ? 'bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800',
                // Build 113: in view mode, suppress every port handle
                // hovered or otherwise — handles are the visible
                // editing affordance, and view mode is supposed to
                // feel like a finished diagram. The `data-view-mode`
                // attribute on this wrapper is the css selector
                // anchor; the global `[data-view-mode] .react-flow__handle`
                // rule below hides every handle inside.
                '[&[data-view-mode]_.react-flow__handle]:!opacity-0',
                '[&[data-view-mode]_.react-flow__handle]:pointer-events-none',
                className
            )}
            onDrop={isViewMode ? undefined : handleDrop}
            onDragOver={isViewMode ? undefined : handleDragOver}
            onDragLeave={isViewMode ? undefined : handleDragLeave}
        >
            {/* Build 115.11 — custom SVG marker dictionary. Has to
             *  live inside the same DOM subtree as the React Flow
             *  edge layer so the `url(#ndg-arrow-*)` references on
             *  individual edges resolve. Sized to zero so it
             *  doesn't influence layout / hit-testing. */}
            <EdgeMarkerDefs />
            <ReactFlow
                nodes={nodes}
                edges={runtimeEdges}
                nodeTypes={DIAGRAM_NODE_TYPES}
                edgeTypes={DIAGRAM_EDGE_TYPES}
                defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
                onNodesChange={handleNodesChange}
                onEdgesChange={handleEdgesChange}
                onConnectEnd={handleConnectEnd}
                onReconnect={handleReconnect}
                onReconnectStart={handleReconnectStart}
                onReconnectEnd={handleReconnectEnd}
                // Build 115: re-parent devices when their drag-stop
                // lands inside (or leaves) a region. View mode
                // disables dragging so the handler is a no-op there;
                // we still register it because edit mode needs it
                // and React Flow tolerates the always-on prop.
                onNodeDrag={isViewMode ? undefined : handleNodeDrag}
                onNodeDragStop={handleNodeDragStop}
                onNodeClick={handleNodeClick}
                onEdgeClick={handleEdgeClick}
                onPaneClick={handlePaneClick}
                onInit={setRfInstance}
                defaultViewport={{ x: 0, y: 0, zoom: 1 }}
                proOptions={proOptions}
                minZoom={0.2}
                maxZoom={5}
                connectOnClick={false}
                // Build 113: gate every editing affordance on `mode`.
                // View mode preserves pan + zoom (so the operator can
                // navigate the diagram) but disables anything that
                // would mutate it.
                nodesDraggable={!isViewMode}
                nodesConnectable={!isViewMode}
                edgesReconnectable={!isViewMode}
                reconnectRadius={16}
                elementsSelectable={!isViewMode}
                selectNodesOnDrag={false}
                snapToGrid={!isViewMode}
                snapGrid={[20, 20]}
                /* Build 115.19 — wheel / trackpad behaviour.
                 *
                 * Default React Flow: wheel = zoom. That's the
                 * Google-Maps mental model and works for
                 * "navigate a finished map" UX, but for an
                 * AUTHORING surface it fights the operator —
                 * the natural expectation when a card you're
                 * editing extends below the visible viewport
                 * is "scroll the canvas with the trackpad",
                 * exactly like a long document. With wheel-as-
                 * zoom, scrolling toward the bottom of the
                 * diagram zooms in until you have to drag the
                 * viewport up by hand, then scroll again, etc.
                 * Operator quote (Build 115.18 follow-up):
                 *
                 *   "right now I need to move the mouse to
                 *    the edge of the screen to stop it from
                 *    zooming and at that point it does allow
                 *    me to scroll up/down."
                 *
                 * Fix: wheel scrolls the canvas (pans the
                 * viewport), modifier key (Cmd / Ctrl) +
                 * wheel zooms. Trackpad pinch still zooms
                 * because it's already a deliberate gesture.
                 *
                 *   panOnScroll       — wheel/trackpad-scroll
                 *                       pans the viewport.
                 *   zoomOnScroll      — disabled so wheel
                 *                       alone never zooms.
                 *   zoomActivationKeyCode — Meta (Cmd on Mac,
                 *                       Win key on Windows) OR
                 *                       Control. Holding either
                 *                       while scrolling
                 *                       switches the gesture
                 *                       from pan to zoom.
                 *   zoomOnPinch       — left at default true
                 *                       so trackpad pinch zoom
                 *                       still works.
                 *   zoomOnDoubleClick — left at default so a
                 *                       double-click zooms in,
                 *                       matching the Controls
                 *                       widget on the bottom-
                 *                       left.
                 *
                 * View mode keeps the same behaviour for
                 * consistency — operators told us flipping
                 * gesture rules between modes is more
                 * disorienting than the "zoom requires
                 * modifier" affordance everywhere.
                 */
                panOnScroll
                zoomOnScroll={false}
                zoomActivationKeyCode={['Meta', 'Control']}
            >
                {/* Build 114: skip the dot-grid background entirely in
                 *  view mode. Operators told us the grid pattern
                 *  competes with the diagram during a present-mode
                 *  walkthrough — a clean white canvas reads as
                 *  "finished artefact" instead of "editor surface".
                 *  Build 115.23 — same logic when `exporting` is
                 *  true: a PNG / PDF capture is a shareable
                 *  artefact, and the dot grid in the rasterised
                 *  output reads as "screenshot of the editor" not
                 *  "diagram". So we suppress the grid for both
                 *  view mode AND in-flight exports. */}
                {!isViewMode && !exporting && (
                    <Background variant={BackgroundVariant.Dots} gap={24} size={1} />
                )}
                {!exporting && (
                    <MiniMap
                        className="scd-export-exclude"
                        position="bottom-left"
                        pannable
                        zoomable
                        nodeStrokeWidth={2}
                        nodeColor={(n) => {
                            if (n.type === REGION_NODE_TYPE) return '#cbd5e1';
                            if (n.type === DIAGRAM_TITLE_NODE_TYPE) return 'transparent';
                            // Build 115.1 — annotations don't read as
                            // network elements on the minimap. Render
                            // them transparent so the minimap still
                            // communicates "where the devices are" at
                            // a glance, not "where the labels are".
                            if (n.type === TEXT_BOX_NODE_TYPE) return 'transparent';
                            return '#0ea5e9';
                        }}
                    />
                )}
            </ReactFlow>

            {!exporting && (
                <CanvasViewportControls
                    helpOpen={helpOpen}
                    onHelpToggle={() => setHelpOpen((v) => !v)}
                    onHelpClose={() => setHelpOpen(false)}
                />
            )}

            {/* Hint banner: tells operators what to do on a blank canvas
             *  Build 113: only shown in edit mode — view mode is for
             *  presenting an already-built diagram, so an empty-canvas
             *  hint there would be misleading. */}
            {isEmpty && !isViewMode && (
                <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
                    <div className="px-4 py-3 rounded-xl bg-white/85 dark:bg-slate-900/85 backdrop-blur-sm border border-dashed border-slate-300 dark:border-slate-700 text-center max-w-md">
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                            Drop devices, shapes, or regions onto the canvas
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            Use the <span className="font-medium">Shapes</span> tab on the left
                            for generic Cisco icons and Regions, or the{' '}
                            <span className="font-medium">Inventory</span> tab to drag real
                            devices from <code className="font-mono">asset_inventory</code>.
                            Hover any device to reveal port handles and drag to draw a link.
                        </p>
                    </div>
                </div>
            )}

            {/* Build 113: PropertiesPanel is suppressed entirely in
             *  view mode — selecting nodes still works (it's helpful
             *  for highlighting), but the inspector would clutter
             *  the cinematic view. */}
            {!isViewMode && (
                <PropertiesPanel
                    selection={selection}
                    onClose={() => setSelection(null)}
                    assetIndex={assetIndex}
                    onNodeUpdate={handleNodeUpdate}
                    onTitleUpdate={handleTitleUpdate}
                    onRegionUpdate={handleRegionUpdate}
                    onTextBoxUpdate={handleTextBoxUpdate}
                    onEdgeUpdate={handleEdgeUpdate}
                    onDelete={(id, kind) => requestDelete([{ id, kind }])}
                />
            )}
            {!isViewMode && (canUndo || canRedo) && (
                <UndoRedoControls
                    canUndo={canUndo}
                    canRedo={canRedo}
                    onUndo={undo}
                    onRedo={redo}
                />
            )}
            {pendingDelete && (
                <DeleteConfirmDialog
                    targets={pendingDelete}
                    onCancel={() => setPendingDelete(null)}
                    onConfirm={() => {
                        executeDelete(
                            pendingDelete.map(({ id, kind }) => ({ id, kind }))
                        );
                        setPendingDelete(null);
                    }}
                />
            )}
        </div>
    );
};

// --- Canvas viewport controls --------------------------------------
//
// Replaces React Flow's small default Controls with the larger
// diagram-tool control stack operators expect: zoom in, live zoom
// percentage, zoom out, reset home, fit-to-view, and the help bubble.
const CanvasViewportControls: React.FC<{
    helpOpen: boolean;
    onHelpToggle: () => void;
    onHelpClose: () => void;
}> = ({ helpOpen, onHelpToggle, onHelpClose }) => {
    const reactFlow = useReactFlow();
    const [zoomPct, setZoomPct] = useState<number>(100);

    const updateZoom = useCallback((zoom: number): void => {
        setZoomPct(Math.round(zoom * 100));
    }, []);

    useEffect(() => {
        try {
            updateZoom(reactFlow.getZoom());
        } catch {
            // React Flow may not have initialised the viewport yet.
        }
    }, [reactFlow, updateZoom]);

    useOnViewportChange({
        onChange: useCallback(
            (viewport: Viewport) => {
                updateZoom(viewport.zoom);
            },
            [updateZoom]
        ),
        onEnd: useCallback(
            (viewport: Viewport) => {
                updateZoom(viewport.zoom);
            },
            [updateZoom]
        ),
    });

    const controls: Array<{
        label: string;
        title: string;
        Icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
        onClick: () => void;
    }> = [
        {
            label: 'Zoom in',
            title: 'Zoom in',
            Icon: ZoomIn,
            onClick: () => void reactFlow.zoomIn({ duration: 160 }),
        },
        {
            label: 'Zoom out',
            title: 'Zoom out',
            Icon: ZoomOut,
            onClick: () => void reactFlow.zoomOut({ duration: 160 }),
        },
        {
            label: 'Reset view',
            title: 'Reset view to 100%',
            Icon: House,
            onClick: () =>
                void reactFlow.setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 220 }),
        },
        {
            label: 'Fit diagram',
            title: 'Fit diagram to view',
            Icon: Maximize2,
            onClick: () => void reactFlow.fitView({ padding: 0.18, duration: 220 }),
        },
    ];

    return (
        <div
            className="absolute right-5 bottom-5 z-20 pointer-events-none"
            data-export-exclude="true"
        >
            <div className="relative pointer-events-auto">
                <div
                    className={cn(
                        'w-16 rounded-xl border border-slate-200 bg-white/95',
                        'dark:bg-slate-900/95 dark:border-slate-700',
                        'shadow-[0_12px_30px_rgba(15,23,42,0.14)] backdrop-blur',
                        'py-2 flex flex-col items-center'
                    )}
                >
                    <ViewportButton {...controls[0]} />
                    <div className="my-1.5 h-px w-9 bg-slate-200 dark:bg-slate-700" />
                    <div
                        aria-label={`Zoom ${zoomPct}%`}
                        className="h-8 flex items-center justify-center text-base font-semibold text-slate-700 dark:text-slate-200"
                    >
                        {zoomPct}%
                    </div>
                    <div className="my-1.5 h-px w-9 bg-slate-200 dark:bg-slate-700" />
                    <ViewportButton {...controls[1]} />
                    <div className="my-2 h-px w-9 bg-slate-200 dark:bg-slate-700" />
                    <ViewportButton {...controls[2]} />
                    <div className="my-2 h-px w-9 bg-slate-200 dark:bg-slate-700" />
                    <ViewportButton {...controls[3]} />
                </div>
                <button
                    type="button"
                    aria-label="Canvas instructions"
                    aria-expanded={helpOpen}
                    title="Canvas instructions"
                    onClick={onHelpToggle}
                    className={cn(
                        'absolute -right-3 -bottom-3 w-10 h-10 rounded-full',
                        'flex items-center justify-center border border-slate-200',
                        'bg-white text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.2)]',
                        'dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100',
                        'hover:text-sky-600 dark:hover:text-sky-300 transition-colors'
                    )}
                >
                    <HelpCircle className="w-6 h-6" aria-hidden />
                </button>
                {helpOpen && (
                    <CanvasHelpPopover onClose={onHelpClose} />
                )}
            </div>
        </div>
    );
};

const ViewportButton: React.FC<{
    label: string;
    title: string;
    Icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
    onClick: () => void;
}> = ({ label, title, Icon, onClick }) => (
    <button
        type="button"
        aria-label={label}
        title={title}
        onClick={onClick}
        className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-700 hover:bg-slate-100 hover:text-sky-600 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-sky-300 transition-colors"
    >
        <Icon className="w-5 h-5" aria-hidden />
    </button>
);

const CanvasHelpPopover: React.FC<{ onClose: () => void }> = ({ onClose }) => (
    <div
        role="dialog"
        aria-label="Canvas instructions"
        className={cn(
            'absolute right-[4.5rem] bottom-0 w-80 rounded-lg shadow-xl',
            'bg-white dark:bg-slate-900',
            'border border-slate-200 dark:border-slate-700',
            'text-slate-700 dark:text-slate-200'
        )}
        onKeyDown={(e) => {
            if (e.key === 'Escape') onClose();
        }}
    >
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <Info className="w-3.5 h-3.5" aria-hidden />
                Canvas tips
            </div>
            <button
                type="button"
                onClick={onClose}
                aria-label="Close instructions"
                className="p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
            >
                <XIcon className="w-3.5 h-3.5" aria-hidden />
            </button>
        </div>
        <div className="px-3 py-2 text-[11px] leading-relaxed space-y-2">
            <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-0.5">
                    Add shapes
                </div>
                Drag any tile from <span className="font-semibold">Shapes</span> or a
                row from <span className="font-semibold">Inventory</span> onto the
                canvas. Use <span className="font-semibold">Region / Site</span> first
                to group devices.
            </div>
            <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-0.5">
                    Pan &amp; zoom
                </div>
                Wheel or two-finger scroll pans. Hold Cmd / Ctrl while scrolling to
                zoom, or use the control stack.
            </div>
            <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-0.5">
                    Shortcuts
                </div>
                Del deletes selection, Cmd/Ctrl + Z undoes, Cmd/Ctrl + Shift + Z redoes,
                and Esc closes dialogs or exits Present mode.
            </div>
        </div>
    </div>
);

// --- Build 115.2 — Undo / Redo toolbar -----------------------------
//
// Sits at the bottom-center of the canvas. Two minimal IconButtons, no labels, with tooltips
// showing the keyboard shortcut so operators discover the bindings
// without us forcing a learning prompt.
const UndoRedoControls: React.FC<{
    canUndo: boolean;
    canRedo: boolean;
    onUndo: () => void;
    onRedo: () => void;
}> = ({ canUndo, canRedo, onUndo, onRedo }) => {
    const isMac =
        typeof navigator !== 'undefined' &&
        /Mac|iPhone|iPad|iPod/.test(navigator.platform);
    const mod = isMac ? '⌘' : 'Ctrl';
    return (
        <div
            className={cn(
                'absolute bottom-3 left-1/2 -translate-x-1/2 z-10',
                'flex items-center gap-0.5 rounded-lg border bg-white/95',
                'dark:bg-slate-900/95 dark:border-slate-700',
                'shadow-[0_2px_6px_rgba(0,0,0,0.06),0_8px_24px_rgba(0,0,0,0.04)]',
                'backdrop-blur'
            )}
        >
            <button
                type="button"
                onClick={onUndo}
                disabled={!canUndo}
                title={`Undo (${mod}Z)`}
                aria-label="Undo"
                className={cn(
                    'p-1.5 rounded-l-lg transition-colors',
                    canUndo
                        ? 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                        : 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                )}
            >
                <Undo2 className="w-4 h-4" />
            </button>
            <button
                type="button"
                onClick={onRedo}
                disabled={!canRedo}
                title={`Redo (${mod}⇧Z)`}
                aria-label="Redo"
                className={cn(
                    'p-1.5 rounded-r-lg transition-colors',
                    canRedo
                        ? 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                        : 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                )}
            >
                <Redo2 className="w-4 h-4" />
            </button>
        </div>
    );
};

// --- Build 115.2 — Delete confirmation modal -----------------------
//
// Lightweight in-canvas modal (no portal needed — the diagram is
// already its own scrolling region). The modal lists the items
// scheduled for deletion so the operator sees exactly what's about
// to disappear, especially valuable for multi-select via React
// Flow's lasso. Esc / Cancel dismiss; Enter / Delete confirm
// (handled at the canvas-level keyboard listener so operators don't
// have to mouse over to the button).
const DeleteConfirmDialog: React.FC<{
    targets: { id: string; kind: 'node' | 'edge'; label: string }[];
    onConfirm: () => void;
    onCancel: () => void;
}> = ({ targets, onConfirm, onCancel }) => {
    const nodeCount = targets.filter((t) => t.kind === 'node').length;
    const edgeCount = targets.filter((t) => t.kind === 'edge').length;
    const summary = ((): string => {
        const parts: string[] = [];
        if (nodeCount > 0) parts.push(`${nodeCount} ${nodeCount === 1 ? 'shape' : 'shapes'}`);
        if (edgeCount > 0) parts.push(`${edgeCount} ${edgeCount === 1 ? 'connection' : 'connections'}`);
        return parts.join(' and ');
    })();

    // Capture Enter to confirm, Esc to cancel — common modal UX.
    useEffect(() => {
        const onKey = (e: KeyboardEvent): void => {
            if (e.key === 'Enter') {
                e.preventDefault();
                onConfirm();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                onCancel();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onConfirm, onCancel]);

    return (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-900/30 backdrop-blur-sm">
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Confirm deletion"
                className={cn(
                    'w-[420px] max-w-[90%] rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700',
                    'shadow-[0_4px_12px_rgba(0,0,0,0.08),0_24px_48px_rgba(0,0,0,0.06)]',
                    'p-4'
                )}
            >
                <div className="flex items-start gap-3">
                    <div className="shrink-0 mt-0.5 rounded-full bg-rose-50 dark:bg-rose-950/40 p-1.5">
                        <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            Delete {summary}?
                        </div>
                        <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                            {nodeCount > 0
                                ? 'Connected lines will also be removed. Children of deleted regions will be unparented.'
                                : 'This connection will be removed from the diagram.'}{' '}
                            You can undo this with {(typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform)) ? '⌘Z' : 'Ctrl+Z'}.
                        </div>
                        {targets.length <= 6 ? (
                            <ul className="mt-2 max-h-32 overflow-auto rounded border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 px-2 py-1 text-[11px] text-slate-700 dark:text-slate-300">
                                {targets.map((t) => (
                                    <li key={`${t.kind}:${t.id}`} className="truncate py-0.5">
                                        <span className="text-slate-400 mr-1">{t.kind === 'edge' ? '↔' : '▢'}</span>
                                        {t.label}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                                {targets.length} items will be deleted.
                            </div>
                        )}
                    </div>
                </div>
                <div className="mt-4 flex items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-3 py-1.5 text-xs rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        autoFocus
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-rose-600 hover:bg-rose-500 text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-rose-500/40"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );
};

export const NetworkDiagramCanvas: React.FC<NetworkDiagramCanvasProps> = (props) => (
    <ReactFlowProvider>
        <NetworkDiagramCanvasInner {...props} />
    </ReactFlowProvider>
);
