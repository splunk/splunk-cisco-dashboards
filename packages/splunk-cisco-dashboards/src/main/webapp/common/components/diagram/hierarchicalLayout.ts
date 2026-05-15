/**
 * hierarchicalLayout — top-down (TB) auto-layout for diagram
 * nodes whose `position` is `(0, 0)` (i.e. "freshly created /
 * never-laid-out" markers).
 *
 * Why a home-grown layout instead of `dagre`:
 *   The Google AI Studio expert blueprint suggested `dagre`,
 *   which would give us proper Sugiyama layout (rank assignment
 *   + crossing minimisation + position assignment). Two reasons
 *   we go without it:
 *
 *   1.  **Supply chain** — the corporate npm mirror was
 *       unreachable when I went to install `dagre` for Build
 *       109; rather than block the visual overhaul on a
 *       network-flake, I built the slice of dagre we actually
 *       need (~60 lines vs dagre's ~1500). Zero new
 *       dependencies = zero new SBOM rows + zero supply-chain
 *       attack surface.
 *
 *   2.  **Use case fit** — we never call layout on a >1000
 *       node graph; the customer flow is "drop ~5–80 devices
 *       from inventory, auto-arrange, then tweak". For graphs
 *       of that size the "rank by BFS + space evenly per
 *       rank" algorithm produces a result indistinguishable
 *       from dagre's. Crossing minimisation matters at scale;
 *       at 80 nodes the operator just nudges the offending
 *       node by 100px.
 *
 * Algorithm:
 *   1. Build adjacency lists (edges treated as undirected for
 *      root selection but directed for child traversal).
 *   2. Find roots: nodes with NO incoming edges. If the graph
 *      is fully cyclic and has no roots, fall back to the
 *      highest-out-degree node — that's almost always "the
 *      device the operator placed first / the obvious core".
 *   3. BFS from roots, assigning each node a `level`. Nodes
 *      reachable through multiple parents inherit the SHALLOWEST
 *      level (so a switch that has both a router parent and a
 *      firewall parent renders one row below them, not two).
 *   4. For each level, lay nodes out left-to-right with even
 *      horizontal spacing centred on x=0.
 *   5. Disconnected components get appended to the right of the
 *      main tree as their own mini-trees, separated by a column
 *      gap. Operators can then drag whole sub-trees as a unit.
 *
 * Only nodes whose CURRENT position is `(0, 0)` are repositioned.
 * Saved diagrams with explicit positions are left alone — the
 * whole point of "auto-layout on (0,0)" is that it acts as a
 * sentinel for "this node has never been laid out", set by the
 * inventory-import / asset-seed code paths.
 */

import type { Node as RFNode, Edge as RFEdge } from '@xyflow/react';

const DEFAULT_NODE_WIDTH = 180;
const DEFAULT_NODE_HEIGHT = 80;
const HORIZONTAL_GAP = 60; // empty space between nodes in same row
const VERTICAL_GAP = 60;   // empty space between rows
const COMPONENT_GAP = 120; // gap between disconnected sub-trees

interface AdjacencyMaps {
    children: Map<string, string[]>;
    incoming: Map<string, number>;
    outgoingDegree: Map<string, number>;
}

const buildAdjacency = (nodes: RFNode[], edges: RFEdge[]): AdjacencyMaps => {
    const children = new Map<string, string[]>();
    const incoming = new Map<string, number>();
    const outgoingDegree = new Map<string, number>();
    for (const n of nodes) {
        children.set(n.id, []);
        incoming.set(n.id, 0);
        outgoingDegree.set(n.id, 0);
    }
    for (const e of edges) {
        if (!children.has(e.source) || !children.has(e.target)) continue;
        children.get(e.source)!.push(e.target);
        incoming.set(e.target, (incoming.get(e.target) ?? 0) + 1);
        outgoingDegree.set(e.source, (outgoingDegree.get(e.source) ?? 0) + 1);
    }
    return { children, incoming, outgoingDegree };
};

/** BFS from a set of seeds, returning each visited node's level
 *  (shallowest depth). The visited set is shared across calls so
 *  a second BFS for a different connected component sees what's
 *  already laid out and skips it. */
const bfsLevels = (
    seeds: string[],
    adj: AdjacencyMaps,
    visited: Set<string>
): Map<string, number> => {
    const levels = new Map<string, number>();
    const queue: Array<{ id: string; depth: number }> = seeds.map((id) => ({
        id,
        depth: 0,
    }));
    while (queue.length > 0) {
        const { id, depth } = queue.shift()!;
        if (visited.has(id)) {
            // Already at a shallower level on a different path; keep that.
            const existing = levels.get(id);
            if (existing === undefined || depth < existing) levels.set(id, depth);
            continue;
        }
        visited.add(id);
        levels.set(id, depth);
        for (const child of adj.children.get(id) ?? []) {
            if (!visited.has(child)) {
                queue.push({ id: child, depth: depth + 1 });
            }
        }
    }
    return levels;
};

/** Find roots: nodes with zero in-edges. Fallback: pick the
 *  highest-out-degree node when the graph is fully cyclic. */
const findRoots = (nodes: RFNode[], adj: AdjacencyMaps): string[] => {
    const roots = nodes
        .filter((n) => (adj.incoming.get(n.id) ?? 0) === 0)
        .map((n) => n.id);
    if (roots.length > 0) return roots;
    // No roots → cyclic graph. Pick the highest-out-degree node
    // (or the first node by id if degrees are tied) so the BFS
    // still produces SOMETHING reasonable.
    let pick = nodes[0]?.id;
    let bestDegree = -1;
    for (const n of nodes) {
        const deg = adj.outgoingDegree.get(n.id) ?? 0;
        if (deg > bestDegree) {
            bestDegree = deg;
            pick = n.id;
        }
    }
    return pick ? [pick] : [];
};

/** Group ids by level, preserving insertion order so the
 *  left-to-right layout is stable across re-runs. */
const groupByLevel = (
    levels: Map<string, number>
): Map<number, string[]> => {
    const groups = new Map<number, string[]>();
    for (const [id, level] of levels.entries()) {
        const arr = groups.get(level) ?? [];
        arr.push(id);
        groups.set(level, arr);
    }
    return groups;
};

const measureNode = (n: RFNode): { width: number; height: number } => {
    const styleW = (n.style as { width?: unknown } | undefined)?.width;
    const styleH = (n.style as { height?: unknown } | undefined)?.height;
    return {
        width: typeof styleW === 'number' ? styleW : DEFAULT_NODE_WIDTH,
        height: typeof styleH === 'number' ? styleH : DEFAULT_NODE_HEIGHT,
    };
};

/**
 * Public entry point. Returns a NEW array of nodes with updated
 * `position` for every node that was at `(0, 0)`. Nodes with
 * non-zero positions are returned with positions unchanged.
 *
 * The `xOrigin` lets the caller offset the entire tree (used
 * when laying out disconnected components side-by-side).
 */
const layoutComponent = (
    nodes: RFNode[],
    edges: RFEdge[],
    xOrigin: number
): { nodes: RFNode[]; widthUsed: number } => {
    const adj = buildAdjacency(nodes, edges);
    const roots = findRoots(nodes, adj);
    const visited = new Set<string>();
    const levels = bfsLevels(roots, adj, visited);
    const groups = groupByLevel(levels);

    // Nodes that BFS didn't reach (disconnected within this
    // component slice — should be rare since we slice by
    // connectivity outside, but defensive). Place them at level 0.
    for (const n of nodes) {
        if (!levels.has(n.id)) {
            const arr = groups.get(0) ?? [];
            arr.push(n.id);
            groups.set(0, arr);
            levels.set(n.id, 0);
        }
    }

    // Compute row widths so we can centre each row.
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const rowWidths = new Map<number, number>();
    let maxRowWidth = 0;
    for (const [level, ids] of groups.entries()) {
        let w = 0;
        for (let i = 0; i < ids.length; i += 1) {
            const m = measureNode(nodeById.get(ids[i])!);
            w += m.width;
            if (i < ids.length - 1) w += HORIZONTAL_GAP;
        }
        rowWidths.set(level, w);
        if (w > maxRowWidth) maxRowWidth = w;
    }

    // Position each node.
    const placements = new Map<string, { x: number; y: number }>();
    let yCursor = 0;
    const sortedLevels = [...groups.keys()].sort((a, b) => a - b);
    for (const level of sortedLevels) {
        const ids = groups.get(level)!;
        let rowHeight = 0;
        // Centre this row inside the component bounds.
        const rowWidth = rowWidths.get(level) ?? 0;
        let xCursor = xOrigin + (maxRowWidth - rowWidth) / 2;
        for (const id of ids) {
            const m = measureNode(nodeById.get(id)!);
            placements.set(id, { x: xCursor, y: yCursor });
            xCursor += m.width + HORIZONTAL_GAP;
            if (m.height > rowHeight) rowHeight = m.height;
        }
        yCursor += rowHeight + VERTICAL_GAP;
    }

    const out = nodes.map((n) => {
        const p = placements.get(n.id);
        if (!p) return n;
        return { ...n, position: { x: p.x, y: p.y } };
    });
    return { nodes: out, widthUsed: maxRowWidth };
};

/** Identify connected components (treating edges as undirected
 *  for connectivity). Each component is laid out independently
 *  and concatenated horizontally so disconnected sub-trees
 *  don't overlap. */
const partitionComponents = (
    nodes: RFNode[],
    edges: RFEdge[]
): RFNode[][] => {
    const idToIdx = new Map(nodes.map((n, i) => [n.id, i]));
    const undirected = new Map<string, Set<string>>();
    for (const n of nodes) undirected.set(n.id, new Set());
    for (const e of edges) {
        if (!undirected.has(e.source) || !undirected.has(e.target)) continue;
        undirected.get(e.source)!.add(e.target);
        undirected.get(e.target)!.add(e.source);
    }
    const seen = new Set<string>();
    const components: RFNode[][] = [];
    for (const n of nodes) {
        if (seen.has(n.id)) continue;
        const stack = [n.id];
        const comp: RFNode[] = [];
        while (stack.length > 0) {
            const id = stack.pop()!;
            if (seen.has(id)) continue;
            seen.add(id);
            const idx = idToIdx.get(id);
            if (idx !== undefined) comp.push(nodes[idx]);
            for (const neighbour of undirected.get(id) ?? []) {
                if (!seen.has(neighbour)) stack.push(neighbour);
            }
        }
        components.push(comp);
    }
    return components;
};

export interface LayoutInputs {
    /** All nodes (including ones that already have positions). */
    nodes: RFNode[];
    /** All edges. Used to determine connectivity / hierarchy. */
    edges: RFEdge[];
}

export interface LayoutOptions {
    /** When true, NEVER touch a node whose current position is
     *  not (0, 0). Default: true. Set to false to force a full
     *  re-layout (e.g. "Auto-arrange" button — Build 110+). */
    onlyZeroPositions?: boolean;
}

/**
 * Apply the hierarchical layout to nodes whose current position
 * is `(0, 0)` (or to ALL nodes if `onlyZeroPositions: false`).
 * Returns a new array (no input mutation).
 */
export const applyHierarchicalLayout = (
    { nodes, edges }: LayoutInputs,
    { onlyZeroPositions = true }: LayoutOptions = {}
): RFNode[] => {
    if (nodes.length === 0) return nodes;

    // Region-group nodes (`type: 'regionGroup'`) and any node
    // that already has a non-(0,0) position should be left
    // exactly where they are. Strip them out, lay out only the
    // "fresh" device nodes, then merge the two slices back.
    const movable: RFNode[] = [];
    const pinned: RFNode[] = [];
    for (const n of nodes) {
        const isFresh =
            (n.position?.x ?? 0) === 0 && (n.position?.y ?? 0) === 0;
        const isRegion = n.type === 'regionGroup';
        if (isRegion) {
            pinned.push(n);
            continue;
        }
        if (onlyZeroPositions && !isFresh) {
            pinned.push(n);
            continue;
        }
        movable.push(n);
    }
    if (movable.length === 0) return nodes;

    // Only consider edges that connect two movable nodes —
    // otherwise we'd accidentally inflate ranks based on edges
    // that touch already-placed nodes.
    const movableIds = new Set(movable.map((n) => n.id));
    const movableEdges = edges.filter(
        (e) => movableIds.has(e.source) && movableIds.has(e.target)
    );

    const components = partitionComponents(movable, movableEdges);
    const laidOut: RFNode[] = [];
    let xOffset = 0;
    for (const comp of components) {
        const compEdges = movableEdges.filter(
            (e) =>
                comp.some((c) => c.id === e.source) ||
                comp.some((c) => c.id === e.target)
        );
        const { nodes: positioned, widthUsed } = layoutComponent(
            comp,
            compEdges,
            xOffset
        );
        laidOut.push(...positioned);
        xOffset += widthUsed + COMPONENT_GAP;
    }

    // Re-index by id and produce the final array preserving
    // input order.
    const byId = new Map(laidOut.map((n) => [n.id, n]));
    return nodes.map((n) => byId.get(n.id) ?? n);
};
