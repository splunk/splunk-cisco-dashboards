/**
 * TopologyCanvas — React Flow wrapper that renders the discovered
 * network topology as a Visio-style interactive diagram.
 *
 * Build 105 expanded the spike from "render-only" to "editor"
 * shape: operators can now (a) hover any node to reveal port
 * handles on all four sides, (b) drag from a handle to another
 * node to create a new edge, (c) click any node or edge to open
 * the right-side properties panel and rename / re-shape / re-kind
 * / annotate / delete it.
 *
 * Architecture (unchanged from Build 104, just wider):
 *   1. `discoverTopology()` (services/topologyDiscovery) fetches
 *      `asset_inventory.csv` + `site_topology_lookup.csv` and
 *      produces a normalised `{ nodes, edges, zones }`.
 *   2. `layoutTopology()` (lib/elkLayout) feeds that into elkjs
 *      and gets back a positioned React-Flow-shaped graph.
 *   3. `applyOverrides()` merges any operator-supplied per-node
 *      `(x, y)` overrides loaded from localStorage on top.
 *   4. We hand the result to `<ReactFlow>` and wire the standard
 *      controls plus `onConnect` / `onNodeClick` / `onEdgeClick`.
 *   5. Mutations dispatched from `<PropertiesPanel>` route through
 *      `setNodes` / `setEdges` so React Flow stays in sync without
 *      re-running ELK.
 *
 * Persistence boundaries (in this build):
 *   - Position drags  → localStorage (key `topologyCanvasOverrides.v1`)
 *   - Manual edges    → in-memory only (Build 106 ships the
 *                       `network_topology_edges.csv` lookup-driven
 *                       persistence)
 *   - Property edits  → in-memory only (Build 107 ships the
 *                       `network_topology_views.csv` lookup)
 *
 * Edge data sourcing:
 *   For Build 105 the canvas combines two edge sources:
 *     a) Auto-discovered edges from `fetchEdges` (today: TE A2A).
 *     b) Manually-drawn edges via `onConnect` (in-memory).
 *   They share a single `manualEdges` state slice so the
 *   properties-panel mutations and the auto-discovery refresh
 *   coexist cleanly.
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
    type Node as RFNode,
    type Edge as RFEdge,
    type Connection,
    useReactFlow,
    type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Loader2, RefreshCw, RotateCcw, Network as NetworkIcon, Save } from 'lucide-react';
import { cn } from '@/common/lib/utils';
import {
    discoverTopology,
    type DiscoveredTopology,
    type TopologyDiscoveredEdge,
} from '@/common/services/topologyDiscovery';
import {
    layoutTopology,
    applyOverrides,
    type LayoutNode,
    type LayoutEdge,
} from '@/common/lib/elkLayout';
import { TOPOLOGY_NODE_TYPES } from './shapes';
import {
    PropertiesPanel,
    type Selection,
    type NodeUpdate,
    type EdgeUpdate,
} from './PropertiesPanel';

const OVERRIDE_STORAGE_KEY = 'topologyCanvasOverrides.v1';
const MANUAL_EDGES_STORAGE_KEY = 'topologyCanvasManualEdges.v1';

type OverrideMap = Record<string, { x: number; y: number }>;

interface PersistedManualEdge {
    id: string;
    source: string;
    target: string;
    label?: string;
    kind: 'physical' | 'synthetic_a2a' | 'logical';
    notes?: string;
}

const readOverrides = (): OverrideMap => {
    if (typeof window === 'undefined') return {};
    try {
        const raw = window.localStorage.getItem(OVERRIDE_STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
        const out: OverrideMap = {};
        for (const [k, v] of Object.entries(parsed)) {
            if (
                v &&
                typeof v === 'object' &&
                typeof (v as { x?: unknown }).x === 'number' &&
                typeof (v as { y?: unknown }).y === 'number'
            ) {
                out[k] = { x: (v as { x: number }).x, y: (v as { y: number }).y };
            }
        }
        return out;
    } catch {
        return {};
    }
};

const writeOverrides = (overrides: OverrideMap): void => {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(OVERRIDE_STORAGE_KEY, JSON.stringify(overrides));
    } catch {
        // Best-effort; quota-full or denied-by-policy browsers
        // gracefully fall back to in-memory only for the session.
    }
};

const clearOverrides = (): void => {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.removeItem(OVERRIDE_STORAGE_KEY);
    } catch {
        // ignore
    }
};

const readManualEdges = (): PersistedManualEdge[] => {
    if (typeof window === 'undefined') return [];
    try {
        const raw = window.localStorage.getItem(MANUAL_EDGES_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(
            (e): e is PersistedManualEdge =>
                e &&
                typeof e === 'object' &&
                typeof e.id === 'string' &&
                typeof e.source === 'string' &&
                typeof e.target === 'string' &&
                (e.kind === 'physical' || e.kind === 'synthetic_a2a' || e.kind === 'logical')
        );
    } catch {
        return [];
    }
};

const writeManualEdges = (edges: PersistedManualEdge[]): void => {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(MANUAL_EDGES_STORAGE_KEY, JSON.stringify(edges));
    } catch {
        // ignore
    }
};

const edgeStyleForKind = (
    kind: 'physical' | 'synthetic_a2a' | 'logical'
): React.CSSProperties => {
    if (kind === 'synthetic_a2a') {
        return { stroke: '#0ea5e9', strokeWidth: 1.5, strokeDasharray: '6 4' };
    }
    if (kind === 'logical') {
        return { stroke: '#94a3b8', strokeWidth: 1.25, strokeDasharray: '2 4' };
    }
    return { stroke: '#64748b', strokeWidth: 1.5 };
};

const toRFNodes = (nodes: LayoutNode[]): RFNode[] =>
    nodes.map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: n.data,
        parentId: n.parentId,
        extent: n.extent,
        draggable: n.draggable,
        zIndex: n.isZone ? 0 : 1,
        style: n.isZone
            ? {
                  width: n.width,
                  height: n.height,
                  padding: 0,
                  background: 'transparent',
                  border: 'none',
              }
            : { width: n.width, height: n.height },
    }));

const toRFEdges = (edges: LayoutEdge[]): RFEdge[] =>
    edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label,
        style: edgeStyleForKind(e.kind),
        animated: e.kind === 'synthetic_a2a',
        data: { edge: e.data, kind: e.kind, notes: '' },
    }));

const persistedEdgeToRFEdge = (e: PersistedManualEdge): RFEdge => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label,
    style: edgeStyleForKind(e.kind),
    animated: e.kind === 'synthetic_a2a',
    data: { edge: { kind: e.kind, label: e.label }, kind: e.kind, notes: e.notes ?? '' },
});

export interface TopologyCanvasProps {
    fetchEdges?: (topology: DiscoveredTopology) => Promise<TopologyDiscoveredEdge[]>;
    className?: string;
}

const TopologyCanvasInner: React.FC<TopologyCanvasProps> = ({
    fetchEdges,
    className,
}) => {
    const [topology, setTopology] = useState<DiscoveredTopology | null>(null);
    const [discoveredEdges, setDiscoveredEdges] = useState<TopologyDiscoveredEdge[]>([]);
    const [layoutResult, setLayoutResult] = useState<{
        nodes: LayoutNode[];
        edges: LayoutEdge[];
    } | null>(null);
    const [nodes, setNodes] = useState<RFNode[]>([]);
    const [edges, setEdges] = useState<RFEdge[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isLayingOut, setIsLayingOut] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [selection, setSelection] = useState<Selection>(null);
    const overridesRef = useRef<OverrideMap>(readOverrides());
    const manualEdgesRef = useRef<PersistedManualEdge[]>(readManualEdges());
    const reactFlow = useReactFlow();

    const recomputeLayout = useCallback(
        async (
            currentTopology: DiscoveredTopology,
            currentEdges: TopologyDiscoveredEdge[]
        ) => {
            setIsLayingOut(true);
            try {
                const composed: DiscoveredTopology = {
                    ...currentTopology,
                    edges: currentEdges,
                };
                const laid = await layoutTopology(composed);
                const merged = applyOverrides(laid, overridesRef.current);
                setLayoutResult(merged);
                setNodes(toRFNodes(merged.nodes));
                // Build the edge list = layout edges (auto-discovered)
                // + manual edges (operator-drawn, persisted).
                const layoutRFEdges = toRFEdges(merged.edges);
                const manualRFEdges = manualEdgesRef.current.map(persistedEdgeToRFEdge);
                setEdges([...layoutRFEdges, ...manualRFEdges]);
            } finally {
                setIsLayingOut(false);
            }
        },
        []
    );

    useEffect(() => {
        let cancelled = false;
        const load = async (): Promise<void> => {
            setIsLoading(true);
            setError(null);
            try {
                const t = await discoverTopology();
                if (cancelled) return;
                setTopology(t);
                await recomputeLayout(t, []);
                if (fetchEdges) {
                    try {
                        const e = await fetchEdges(t);
                        if (cancelled) return;
                        setDiscoveredEdges(e);
                        await recomputeLayout(t, e);
                    } catch (edgeErr) {
                        // eslint-disable-next-line no-console
                        console.warn('TopologyCanvas: fetchEdges failed', edgeErr);
                    }
                }
            } catch (err) {
                if (cancelled) return;
                setError(
                    err instanceof Error ? err.message : 'Topology discovery failed'
                );
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };
        void load();
        return () => {
            cancelled = true;
        };
    }, [fetchEdges, recomputeLayout]);

    /** Drag-stop persistence — same as Build 104. */
    const handleNodeDragStop = useCallback(
        (_event: React.MouseEvent, node: RFNode) => {
            if (!node.draggable) return;
            const next: OverrideMap = {
                ...overridesRef.current,
                [node.id]: { x: node.position.x, y: node.position.y },
            };
            overridesRef.current = next;
            writeOverrides(next);
        },
        []
    );

    /** New in Build 105: edge-creation handler. Wires React Flow's
     *  `onConnect` event to a manual-edge model. We use
     *  `addEdge` from React Flow to splice the new edge into the
     *  current edge list, then mirror it into our persisted
     *  manual-edges store. */
    const handleConnect = useCallback((connection: Connection): void => {
        if (!connection.source || !connection.target) return;
        // Disallow self-loops; they're rarely useful in network
        // topology and they break ELK if present in a future
        // re-layout.
        if (connection.source === connection.target) return;

        const id = `manual__${connection.source}__${connection.target}__${Date.now()}`;
        const persisted: PersistedManualEdge = {
            id,
            source: connection.source,
            target: connection.target,
            kind: 'physical',
            label: '',
            notes: '',
        };
        manualEdgesRef.current = [...manualEdgesRef.current, persisted];
        writeManualEdges(manualEdgesRef.current);

        setEdges((current) =>
            addEdge(
                {
                    id,
                    source: connection.source as string,
                    target: connection.target as string,
                    sourceHandle: connection.sourceHandle ?? undefined,
                    targetHandle: connection.targetHandle ?? undefined,
                    style: edgeStyleForKind('physical'),
                    data: {
                        edge: { kind: 'physical', label: '' },
                        kind: 'physical',
                        notes: '',
                    },
                },
                current
            )
        );
    }, []);

    /** Selection handlers — open the properties panel. */
    const handleNodeClick = useCallback((_e: React.MouseEvent, node: RFNode) => {
        // Clicking a zone container shouldn't open the panel — they're
        // chrome, not editable entities.
        if (node.type === 'topologyZone') return;
        setSelection({ kind: 'node', node });
    }, []);

    const handleEdgeClick = useCallback((_e: React.MouseEvent, edge: RFEdge) => {
        setSelection({ kind: 'edge', edge });
    }, []);

    const handlePaneClick = useCallback(() => {
        setSelection(null);
    }, []);

    /** Properties-panel mutations: route through setNodes/setEdges. */
    const handleNodeUpdate = useCallback((update: NodeUpdate): void => {
        setNodes((current) =>
            current.map((n) => {
                if (n.id !== update.id) return n;
                const existingData = (n.data ?? {}) as Record<string, unknown>;
                const existingNode = (existingData.node ?? {}) as Record<string, unknown>;
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
                            shape: update.shape ?? (existingNode.shape as string | undefined),
                        },
                        notes: update.notes ?? existingData.notes,
                    },
                };
            })
        );
        // Rebroadcast the updated node into selection so the panel
        // reflects the just-applied values without needing a re-click.
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
    }, []);

    const handleEdgeUpdate = useCallback((update: EdgeUpdate): void => {
        setEdges((current) =>
            current.map((e) => {
                if (e.id !== update.id) return e;
                const newKind = update.kind ?? ((e.data as { kind?: string })?.kind as
                    | 'physical'
                    | 'synthetic_a2a'
                    | 'logical');
                return {
                    ...e,
                    label: update.label ?? e.label,
                    style: edgeStyleForKind(newKind ?? 'physical'),
                    animated: newKind === 'synthetic_a2a',
                    data: {
                        ...((e.data ?? {}) as Record<string, unknown>),
                        kind: newKind,
                        notes: update.notes,
                    },
                };
            })
        );
        // Mirror the change into the persisted manual-edges store
        // when the edge is operator-drawn.
        const idx = manualEdgesRef.current.findIndex((m) => m.id === update.id);
        if (idx >= 0) {
            const existing = manualEdgesRef.current[idx];
            const next: PersistedManualEdge = {
                ...existing,
                label: update.label ?? existing.label,
                kind: update.kind ?? existing.kind,
                notes: update.notes ?? existing.notes,
            };
            manualEdgesRef.current = [
                ...manualEdgesRef.current.slice(0, idx),
                next,
                ...manualEdgesRef.current.slice(idx + 1),
            ];
            writeManualEdges(manualEdgesRef.current);
        }
    }, []);

    const handleDelete = useCallback(
        (id: string, kind: 'node' | 'edge'): void => {
            if (kind === 'edge') {
                setEdges((current) => current.filter((e) => e.id !== id));
                manualEdgesRef.current = manualEdgesRef.current.filter((m) => m.id !== id);
                writeManualEdges(manualEdgesRef.current);
            } else {
                setNodes((current) => current.filter((n) => n.id !== id));
                // Removing a node also orphans any incident edges;
                // drop those so the canvas doesn't render dangling
                // lines.
                setEdges((current) =>
                    current.filter((e) => e.source !== id && e.target !== id)
                );
                manualEdgesRef.current = manualEdgesRef.current.filter(
                    (m) => m.source !== id && m.target !== id
                );
                writeManualEdges(manualEdgesRef.current);
            }
            setSelection(null);
        },
        []
    );

    const handleResetLayout = useCallback(async () => {
        clearOverrides();
        overridesRef.current = {};
        if (topology) {
            await recomputeLayout(topology, discoveredEdges);
            window.requestAnimationFrame(() => {
                reactFlow.fitView({ padding: 0.15, duration: 250 });
            });
        }
    }, [topology, discoveredEdges, reactFlow, recomputeLayout]);

    const handleRefresh = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const t = await discoverTopology();
            setTopology(t);
            const e = fetchEdges ? await fetchEdges(t).catch(() => []) : [];
            setDiscoveredEdges(e);
            await recomputeLayout(t, e);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Topology discovery failed');
        } finally {
            setIsLoading(false);
        }
    }, [fetchEdges, recomputeLayout]);

    /** Save All — temporary diagnostic that confirms persisted
     *  state is what we expect. Build 106 replaces this with a
     *  real outputlookup pipeline. */
    const handleSaveAll = useCallback((): void => {
        const payload = {
            overrides: overridesRef.current,
            manualEdges: manualEdgesRef.current,
            savedAt: new Date().toISOString(),
        };
        // eslint-disable-next-line no-console
        console.info('TopologyCanvas saved snapshot', payload);
        // Visible confirmation. Replace with a proper toast in
        // Build 106 once the lookup pipeline lands.
        if (typeof window !== 'undefined') {
            window.alert(
                `Saved locally:\n${Object.keys(payload.overrides).length} position overrides\n${payload.manualEdges.length} manual edges\n\nBuild 106 will write these to network_topology_edges.csv.`
            );
        }
    }, []);

    const isEmpty =
        !isLoading && !error && (!topology || topology.nodes.length === 0);

    return (
        <div
            className={cn(
                'relative w-full h-full rounded-xl border bg-white dark:bg-slate-900 overflow-hidden',
                'border-slate-200 dark:border-slate-800',
                className
            )}
        >
            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={TOPOLOGY_NODE_TYPES as NodeTypes}
                onNodeDragStop={handleNodeDragStop}
                onConnect={handleConnect}
                onNodeClick={handleNodeClick}
                onEdgeClick={handleEdgeClick}
                onPaneClick={handlePaneClick}
                fitView
                fitViewOptions={{ padding: 0.15 }}
                proOptions={{ hideAttribution: true }}
                minZoom={0.2}
                maxZoom={2.5}
                connectOnClick={false}
                edgesReconnectable
            >
                <Background variant={BackgroundVariant.Dots} gap={24} size={1} />
                <Controls position="bottom-left" />
                <MiniMap
                    position="bottom-right"
                    pannable
                    zoomable
                    nodeStrokeWidth={2}
                    nodeColor={(n) => {
                        if (n.type === 'topologyZone') return '#cbd5e1';
                        return '#0ea5e9';
                    }}
                />
            </ReactFlow>

            {/* Toolbar overlay */}
            <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
                <button
                    type="button"
                    onClick={handleRefresh}
                    className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium shadow-sm',
                        'bg-white/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200',
                        'border border-slate-200 dark:border-slate-700',
                        'hover:bg-white dark:hover:bg-slate-800 transition-colors'
                    )}
                    title="Re-fetch asset_inventory and site_topology_lookup"
                >
                    <RefreshCw
                        className={cn('w-3.5 h-3.5', isLayingOut && 'animate-spin')}
                        aria-hidden
                    />
                    Refresh
                </button>
                <button
                    type="button"
                    onClick={handleResetLayout}
                    className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium shadow-sm',
                        'bg-white/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200',
                        'border border-slate-200 dark:border-slate-700',
                        'hover:bg-white dark:hover:bg-slate-800 transition-colors'
                    )}
                    title="Discard manual position overrides and re-run auto-layout"
                >
                    <RotateCcw className="w-3.5 h-3.5" aria-hidden />
                    Reset layout
                </button>
                <button
                    type="button"
                    onClick={handleSaveAll}
                    className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium shadow-sm',
                        'bg-sky-500/90 hover:bg-sky-500 text-white',
                        'border border-sky-600/30',
                        'transition-colors'
                    )}
                    title="Save the current layout + manual edges (local-only until Build 106)"
                >
                    <Save className="w-3.5 h-3.5" aria-hidden />
                    Save snapshot
                </button>
            </div>

            {/* Hint banner: tells operators how to draw edges */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 px-3 py-1 rounded-full text-[10px] font-medium bg-slate-900/80 dark:bg-slate-100/90 text-slate-100 dark:text-slate-900 shadow-sm pointer-events-none">
                Hover a device to reveal its 4 ports · drag from a port to another device to draw a link · click any node or edge to edit
            </div>

            {/* Properties panel */}
            <PropertiesPanel
                selection={selection}
                onClose={() => setSelection(null)}
                onNodeUpdate={handleNodeUpdate}
                onEdgeUpdate={handleEdgeUpdate}
                onDelete={handleDelete}
            />

            {/* Loading / empty / error overlays */}
            {(isLoading || isLayingOut) && !error && nodes.length === 0 && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm">
                    <Loader2 className="w-6 h-6 animate-spin text-sky-500" aria-hidden />
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                        Reading asset_inventory.csv and site_topology_lookup.csv&hellip;
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                        First run after a scheduled rebuild can take a few seconds.
                    </p>
                </div>
            )}
            {error && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 px-6 text-center">
                    <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">
                        Topology discovery failed
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md">
                        {error}
                    </p>
                </div>
            )}
            {isEmpty && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 px-6 text-center">
                    <NetworkIcon className="w-8 h-8 text-slate-400" aria-hidden />
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        No devices in <code className="font-mono text-xs">asset_inventory.csv</code> yet
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md">
                        The <code className="font-mono">[Asset Inventory - Build Lookup]</code> scheduled search builds this lookup nightly. Run it on demand from the Splunk Searches &amp; Reports UI to see the canvas populate without waiting until 02:05.
                    </p>
                </div>
            )}
        </div>
    );
};

export const TopologyCanvas: React.FC<TopologyCanvasProps> = (props) => (
    <ReactFlowProvider>
        <TopologyCanvasInner {...props} />
    </ReactFlowProvider>
);
