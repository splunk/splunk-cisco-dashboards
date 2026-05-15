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

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ReactFlow,
    ReactFlowProvider,
    Controls,
    MiniMap,
    Background,
    BackgroundVariant,
    addEdge,
    applyNodeChanges,
    applyEdgeChanges,
    useReactFlow,
    type Node as RFNode,
    type Edge as RFEdge,
    type Connection,
    type NodeChange,
    type EdgeChange,
    type ReactFlowInstance,
    type XYPosition,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { cn } from '@/common/lib/utils';
import { TOPOLOGY_NODE_TYPES } from '@/common/components/topology/shapes';
import {
    PropertiesPanel,
    type Selection,
    type NodeUpdate,
    type EdgeUpdate,
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
} from '@/common/services/diagramPersistenceService';
import { RegionGroupNode } from './RegionGroupNode';
import { applyHierarchicalLayout } from './hierarchicalLayout';
import { PALETTE_DND_MIME, NODE_SIZE_PRESETS, type PaletteDragPayload } from './types';

const REGION_NODE_TYPE = 'regionGroup';

/** Compose the React Flow node-types map. Build 110 reverted the
 *  diagram canvas back to the same light-themed device shapes the
 *  operations canvas (`TopologyCanvas`) uses (see
 *  `topology/shapes.tsx`) — Alan reviewed the Build 109 Cyber-NOC
 *  dark theme and asked to revert to the lighter look from Build
 *  106 ("exactly what I want!!!"). The dark CyberNocShape +
 *  scoped CSS file are kept on disk as a future opt-in but are
 *  no longer wired into the canvas. */
const DIAGRAM_NODE_TYPES = {
    ...TOPOLOGY_NODE_TYPES,
    [REGION_NODE_TYPE]: RegionGroupNode,
};

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
}): { node: TopologyDiscoveredNode; notes: string } => {
    const node: TopologyDiscoveredNode = {
        id: params.id,
        label: params.label,
        shortLabel: params.shortLabel,
        shape: params.shape,
        status: params.status ?? 'unknown',
        raw: params.raw ?? { device_type: params.shape },
    };
    return { node, notes: params.notes ?? '' };
};

/** Convert a `SavedDiagramNode` (persisted shape) into a
 *  React Flow `Node`. Live `assetIndex` lets us re-bind the
 *  display data to the freshest `asset_inventory` row when
 *  available — without it we render from whatever the saved
 *  payload remembers (still labeled correctly, just no fresh
 *  health). */
const savedNodeToRF = (
    saved: SavedDiagramNode,
    assetIndex: Map<string, TopologyDiscoveredNode> | null
): RFNode => {
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
            },
            zIndex: 0,
        };
    }
    const shape = (saved.type.replace('device:', '') as DeviceShapeId) || 'generic';
    const live = saved.assetId ? assetIndex?.get(saved.assetId) : undefined;
    const label = live?.label ?? saved.label ?? saved.id;
    const shortLabel = live?.shortLabel ?? saved.shortLabel ?? saved.id;
    const status: HealthStatus = live?.status ?? 'unknown';
    return {
        id: saved.id,
        type: saved.type,
        position: { x: saved.x, y: saved.y },
        parentId: saved.parentId,
        extent: saved.parentId ? 'parent' : undefined,
        style: {
            width: saved.width ?? NODE_SIZE_PRESETS.device.width,
            height: saved.height ?? NODE_SIZE_PRESETS.device.height,
        },
        data: buildDeviceData({
            id: saved.assetId ?? saved.id,
            label,
            shortLabel,
            shape,
            status,
            notes: saved.notes,
            raw: live?.raw ?? { device_type: shape },
        }),
        zIndex: 1,
    };
};

const savedEdgeToRF = (saved: SavedDiagramEdge): RFEdge => ({
    id: saved.id,
    source: saved.sourceId,
    target: saved.targetId,
    label: saved.label,
    style: edgeStyleForKind(saved.kind),
    animated: saved.kind === 'synthetic_a2a',
    data: {
        kind: saved.kind,
        layer: saved.layer,
        notes: saved.notes ?? '',
    },
});

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
 *  current React Flow state. */
const rfToSaved = (
    nodes: RFNode[],
    edges: RFEdge[]
): SavedDiagramPayload => {
    const groups: SavedDiagramGroup[] = [];
    const savedNodes: SavedDiagramNode[] = [];
    for (const n of nodes) {
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
        });
    }
    const savedEdges: SavedDiagramEdge[] = edges.map((e) => {
        const data = (e.data ?? {}) as Record<string, unknown>;
        return {
            id: e.id,
            sourceId: e.source,
            targetId: e.target,
            kind: (data.kind as SavedDiagramEdge['kind']) ?? 'physical',
            label: typeof e.label === 'string' ? e.label : undefined,
            layer: typeof data.layer === 'string' ? data.layer : undefined,
            notes: typeof data.notes === 'string' ? data.notes : undefined,
        };
    });
    return {
        version: 1,
        nodes: savedNodes,
        edges: savedEdges,
        groups,
    };
};

const rectContains = (
    nodeRect: { x: number; y: number; width: number; height: number },
    point: XYPosition
): boolean =>
    point.x >= nodeRect.x &&
    point.x <= nodeRect.x + nodeRect.width &&
    point.y >= nodeRect.y &&
    point.y <= nodeRect.y + nodeRect.height;

/** Resolve which (if any) region-group node contains the given
 *  flow-coordinate point. Returns the smallest matching region
 *  so nested regions resolve to the most specific container. */
const findContainingRegion = (nodes: RFNode[], point: XYPosition): RFNode | null => {
    let best: RFNode | null = null;
    let bestArea = Infinity;
    for (const n of nodes) {
        if (n.type !== REGION_NODE_TYPE) continue;
        const w = typeof n.style?.width === 'number' ? (n.style.width as number) : 0;
        const h =
            typeof n.style?.height === 'number' ? (n.style.height as number) : 0;
        if (w === 0 || h === 0) continue;
        const rect = { x: n.position.x, y: n.position.y, width: w, height: h };
        if (rectContains(rect, point)) {
            const area = w * h;
            if (area < bestArea) {
                best = n;
                bestArea = area;
            }
        }
    }
    return best;
};

/** Recompute every region's `data.deviceCount` from current
 *  parent assignments. Cheap — runs O(nodes) once per change. */
const annotateRegionCounts = (nodes: RFNode[]): RFNode[] => {
    const counts = new Map<string, number>();
    for (const n of nodes) {
        if (n.type === REGION_NODE_TYPE) continue;
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
    /** Fired on every mutation that changes the persisted
     *  payload. Parent uses this to mark dirty + queue saves. */
    onChange: (payload: SavedDiagramPayload) => void;
    className?: string;
}

let nodeIdCounter = Date.now();
const nextNodeId = (prefix: string): string => {
    nodeIdCounter += 1;
    return `${prefix}_${nodeIdCounter}`;
};

const NetworkDiagramCanvasInner: React.FC<NetworkDiagramCanvasProps> = ({
    initialPayload,
    assetIndex,
    onChange,
    className,
}) => {
    const [nodes, setNodes] = useState<RFNode[]>([]);
    const [edges, setEdges] = useState<RFEdge[]>([]);
    const [selection, setSelection] = useState<Selection>(null);
    const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const reactFlow = useReactFlow();
    const initialPayloadRef = useRef<SavedDiagramPayload | null>(initialPayload);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

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
            return;
        }
        const groupNodes = payload.groups.map(savedGroupToRF);
        const deviceNodes = payload.nodes.map((n) => savedNodeToRF(n, assetIndex));
        const rfEdges = payload.edges.map(savedEdgeToRF);
        const merged = [...groupNodes, ...deviceNodes];
        const laidOut = applyHierarchicalLayout(
            { nodes: merged, edges: rfEdges },
            { onlyZeroPositions: true }
        );
        setNodes(annotateRegionCounts(laidOut));
        setEdges(rfEdges);
        // Fit view shortly after hydrate so the operator lands on
        // a centered, sized-to-fit canvas instead of starting at
        // (0,0). Wrapped in rAF because the React Flow viewport
        // is only available after the next layout pass.
        window.requestAnimationFrame(() => {
            try {
                reactFlow.fitView({ padding: 0.15, duration: 250 });
            } catch {
                // ignore — viewport not ready yet
            }
        });
    }, [initialPayload, assetIndex, reactFlow]);

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

    const handleNodesChange = useCallback(
        (changes: NodeChange[]) => {
            setNodes((current) => {
                const next = annotateRegionCounts(applyNodeChanges(changes, current));
                emitChange(next, edges);
                return next;
            });
        },
        [edges, emitChange]
    );

    const handleEdgesChange = useCallback(
        (changes: EdgeChange[]) => {
            setEdges((current) => {
                const next = applyEdgeChanges(changes, current);
                emitChange(nodes, next);
                return next;
            });
        },
        [nodes, emitChange]
    );

    const handleConnect = useCallback(
        (connection: Connection) => {
            if (!connection.source || !connection.target) return;
            if (connection.source === connection.target) return; // disallow self-loops
            const id = `e_${connection.source}__${connection.target}__${Date.now()}`;
            const newEdge: RFEdge = {
                id,
                source: connection.source,
                target: connection.target,
                sourceHandle: connection.sourceHandle ?? undefined,
                targetHandle: connection.targetHandle ?? undefined,
                style: edgeStyleForKind('physical'),
                data: { kind: 'physical', notes: '' },
            };
            setEdges((current) => {
                const next = addEdge(newEdge, current);
                emitChange(nodes, next);
                return next;
            });
        },
        [nodes, emitChange]
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
            const point = rfInstance.screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
            });
            // Snap to a 20px grid so customer-arranged diagrams
            // stay tidy without an explicit "snap to grid" mode.
            const snapped = {
                x: Math.round(point.x / 20) * 20,
                y: Math.round(point.y / 20) * 20,
            };

            setNodes((current) => {
                let newNode: RFNode;
                if (payload.variant === 'region') {
                    newNode = {
                        id: nextNodeId('region'),
                        type: REGION_NODE_TYPE,
                        position: snapped,
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
                } else if (payload.variant === 'shape') {
                    const region = findContainingRegion(current, snapped);
                    const localPoint = region
                        ? {
                              x: snapped.x - region.position.x,
                              y: snapped.y - region.position.y,
                          }
                        : snapped;
                    newNode = {
                        id: nextNodeId('shape'),
                        type: `device:${payload.shape}`,
                        position: localPoint,
                        parentId: region?.id,
                        extent: region ? 'parent' : undefined,
                        style: {
                            width: NODE_SIZE_PRESETS.device.width,
                            height: NODE_SIZE_PRESETS.device.height,
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
                    const region = findContainingRegion(current, snapped);
                    const localPoint = region
                        ? {
                              x: snapped.x - region.position.x,
                              y: snapped.y - region.position.y,
                          }
                        : snapped;
                    const live = assetIndex?.get(payload.assetId);
                    newNode = {
                        id: payload.assetId,
                        type: `device:${payload.shape}`,
                        position: localPoint,
                        parentId: region?.id,
                        extent: region ? 'parent' : undefined,
                        style: {
                            width: NODE_SIZE_PRESETS.device.width,
                            height: NODE_SIZE_PRESETS.device.height,
                        },
                        data: buildDeviceData({
                            id: payload.assetId,
                            label: live?.label ?? payload.label,
                            shortLabel: live?.shortLabel ?? payload.shortLabel,
                            shape: payload.shape,
                            status: live?.status ?? 'unknown',
                            raw: live?.raw,
                        }),
                        zIndex: 1,
                    };
                }
                const next = annotateRegionCounts([...current, newNode]);
                emitChange(next, edges);
                return next;
            });
        },
        [rfInstance, assetIndex, edges, emitChange]
    );

    const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        // Only accept drops that carry our palette mime — but we
        // can't read mime values here (browsers limit it on
        // dragover). The cheapest signal is `types` includes our
        // custom mime; if it does, we set drop effect to copy.
        if (event.dataTransfer.types.includes(PALETTE_DND_MIME)) {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';
        }
    }, []);

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
                    const newType = update.shape ? `device:${update.shape}` : n.type;
                    return {
                        ...n,
                        type: newType,
                        data: {
                            ...existingData,
                            node: {
                                ...existingNode,
                                label: update.label ?? existingNode.label,
                                shortLabel: update.shortLabel ?? existingNode.shortLabel,
                                shape:
                                    update.shape ??
                                    (existingNode.shape as string | undefined),
                            },
                            notes: update.notes ?? existingData.notes,
                        },
                    };
                });
                emitChange(next, edges);
                return next;
            });
            // Rebroadcast so the panel reflects the just-applied values.
            setSelection((prev) =>
                prev && prev.kind === 'node' && prev.node.id === update.id
                    ? {
                          kind: 'node',
                          node: {
                              ...prev.node,
                              type: update.shape ? `device:${update.shape}` : prev.node.type,
                              data: {
                                  ...((prev.node.data ?? {}) as Record<string, unknown>),
                                  notes: update.notes,
                              },
                          },
                      }
                    : prev
            );
        },
        [edges, emitChange]
    );

    const handleEdgeUpdate = useCallback(
        (update: EdgeUpdate): void => {
            setEdges((current) => {
                const next = current.map((e) => {
                    if (e.id !== update.id) return e;
                    const newKind =
                        update.kind ?? (((e.data as { kind?: string })?.kind ??
                            'physical') as SavedDiagramEdge['kind']);
                    return {
                        ...e,
                        label: update.label ?? e.label,
                        style: edgeStyleForKind(newKind),
                        animated: newKind === 'synthetic_a2a',
                        data: {
                            ...((e.data ?? {}) as Record<string, unknown>),
                            kind: newKind,
                            notes: update.notes,
                        },
                    };
                });
                emitChange(nodes, next);
                return next;
            });
        },
        [nodes, emitChange]
    );

    const handleDelete = useCallback(
        (id: string, kind: 'node' | 'edge'): void => {
            if (kind === 'edge') {
                setEdges((current) => {
                    const next = current.filter((e) => e.id !== id);
                    emitChange(nodes, next);
                    return next;
                });
            } else {
                setNodes((current) => {
                    // Cascade: deleting a node also drops its incident
                    // edges; deleting a region also un-parents (but
                    // does not delete) its children.
                    const next = annotateRegionCounts(
                        current
                            .filter((n) => n.id !== id)
                            .map((n) =>
                                n.parentId === id ? { ...n, parentId: undefined, extent: undefined } : n
                            )
                    );
                    setEdges((edgeCurrent) => {
                        const filtered = edgeCurrent.filter(
                            (e) => e.source !== id && e.target !== id
                        );
                        emitChange(next, filtered);
                        return filtered;
                    });
                    return next;
                });
            }
            setSelection(null);
        },
        [nodes, emitChange]
    );

    const isEmpty = nodes.length === 0;
    const initialFitDone = useRef<boolean>(false);
    useEffect(() => {
        if (initialFitDone.current) return;
        if (nodes.length === 0) return;
        initialFitDone.current = true;
    }, [nodes.length]);

    const proOptions = useMemo(() => ({ hideAttribution: true }), []);

    return (
        <div
            ref={wrapperRef}
            className={cn(
                'relative w-full h-full rounded-xl border bg-white dark:bg-slate-900 overflow-hidden',
                'border-slate-200 dark:border-slate-800',
                className
            )}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
        >
            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={DIAGRAM_NODE_TYPES}
                onNodesChange={handleNodesChange}
                onEdgesChange={handleEdgesChange}
                onConnect={handleConnect}
                onNodeClick={handleNodeClick}
                onEdgeClick={handleEdgeClick}
                onPaneClick={handlePaneClick}
                onInit={setRfInstance}
                fitView
                fitViewOptions={{ padding: 0.15 }}
                proOptions={proOptions}
                minZoom={0.2}
                maxZoom={2.5}
                connectOnClick={false}
                edgesReconnectable
                selectNodesOnDrag={false}
                snapToGrid
                snapGrid={[20, 20]}
            >
                <Background variant={BackgroundVariant.Dots} gap={24} size={1} />
                <Controls position="bottom-left" />
                <MiniMap
                    position="bottom-right"
                    pannable
                    zoomable
                    nodeStrokeWidth={2}
                    nodeColor={(n) => {
                        if (n.type === REGION_NODE_TYPE) return '#cbd5e1';
                        return '#0ea5e9';
                    }}
                />
            </ReactFlow>

            {/* Hint banner: tells operators what to do on a blank canvas */}
            {isEmpty && (
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

            {!isEmpty && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 px-3 py-1 rounded-full text-[10px] font-medium bg-slate-900/80 dark:bg-slate-100/90 text-slate-100 dark:text-slate-900 shadow-sm pointer-events-none">
                    Drag devices in from the left · hover a device to reveal ports · drag
                    between ports to link · click any node or edge to edit
                </div>
            )}

            <PropertiesPanel
                selection={selection}
                onClose={() => setSelection(null)}
                onNodeUpdate={handleNodeUpdate}
                onEdgeUpdate={handleEdgeUpdate}
                onDelete={handleDelete}
            />
        </div>
    );
};

export const NetworkDiagramCanvas: React.FC<NetworkDiagramCanvasProps> = (props) => (
    <ReactFlowProvider>
        <NetworkDiagramCanvasInner {...props} />
    </ReactFlowProvider>
);
