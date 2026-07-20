/**
 * elkLayout — wraps the Eclipse Layout Kernel (elkjs) port to produce
 * a React-Flow-compatible layered graph layout from a
 * `DiscoveredTopology`.
 *
 * Why elkjs and not React Flow's built-in dagre helper:
 *   1. Subgraph (parent-node) layout. ELK natively understands
 *      hierarchical containers — pass it nodes with `children` and
 *      it lays each container out independently, then composes the
 *      whole. Dagre is flat. Since our zones (DNAC sites/buildings)
 *      need to render as React Flow subflows, elkjs' tree model
 *      maps 1:1.
 *   2. Edge routing. Layered + orthogonal routing handles the
 *      "switches under a router, firewalls in front, WLC off to
 *      the side" topology of a typical campus diagram much closer
 *      to a Visio architecture sheet than a force-directed blob.
 *   3. Stable. ELK is deterministic given the same input — important
 *      for the override-merge story (operators drag specific nodes
 *      to override the auto-position; everyone else stays
 *      reproducibly placed across reloads).
 *
 * Layout strategy (kept simple for the spike, room to grow):
 *   • Each `building` zone becomes a parent React Flow node.
 *   • Each device whose `siteLabel` resolves to a known building is
 *     placed inside that parent. Devices whose site is unknown go
 *     into a synthetic `__unsited__` parent so they're still
 *     visible (and easy to flag for operator cleanup).
 *   • Edges retain their cross-parent topology — ELK routes edges
 *     between parents naturally.
 *   • Top-level layout direction is left-to-right (`elk.direction:
 *     'RIGHT'`) to match the convention in a customer's reference
 *     diagram (primary site on the left, remotes flowing right).
 *
 * Override merge happens *after* this layout runs: caller passes
 * the result through `applyOverrides()` which preserves the elk
 * coordinates for any node not explicitly overridden, and replaces
 * the (x, y) of overridden nodes with the operator-supplied values.
 * That way "I want THIS device exactly here, but auto-place
 * everything else" works without re-running ELK on every drag.
 */

import ELK from 'elkjs/lib/elk.bundled';
import type {
    DiscoveredTopology,
    TopologyDiscoveredNode,
    TopologyDiscoveredZone,
} from '@/common/services/topologyDiscovery';

/** ELK input/output node shape. We keep a flat structure inside a
 *  single root for simplicity; building zones become first-level
 *  children with their own `children[]` of devices. */
interface ElkNode {
    id: string;
    width?: number;
    height?: number;
    x?: number;
    y?: number;
    children?: ElkNode[];
    edges?: ElkEdge[];
    layoutOptions?: Record<string, string>;
}

interface ElkEdge {
    id: string;
    sources: string[];
    targets: string[];
}

/** React-Flow-compatible node descriptor produced by `layoutTopology`.
 *  We don't import React Flow types here so the layout module stays
 *  framework-agnostic (and unit-testable without a DOM). */
export interface LayoutNode {
    id: string;
    type: string;
    position: { x: number; y: number };
    /** When set, this node is a child of the named parent. The
     *  `position` is parent-relative in that case. */
    parentId?: string;
    width: number;
    height: number;
    data: Record<string, unknown>;
    extent?: 'parent';
    /** Drag handle hint for React Flow; empty for parent zones so
     *  operators can't accidentally drag a whole building. */
    draggable: boolean;
    /** True for the synthetic zone container nodes; helps the
     *  renderer pick the right component class. */
    isZone: boolean;
}

export interface LayoutEdge {
    id: string;
    source: string;
    target: string;
    /** Edge `kind` from discovery passed through verbatim so the
     *  React Flow edge renderer can pick line style. */
    kind: 'physical' | 'synthetic_a2a' | 'logical';
    label?: string;
    data: Record<string, unknown>;
}

export interface LayoutResult {
    nodes: LayoutNode[];
    edges: LayoutEdge[];
}

/** Default sizes used for the layout. Build 105 dropped the
 *  pill-style shapes (140×80) for icon-forward Cisco shapes
 *  (100×110); zones grow accordingly so devices breathe. Overridden
 *  per-node when shape components publish concrete measurements via
 *  React Flow's `onNodesChange` later. */
const DEFAULTS = {
    deviceWidth: 100,
    deviceHeight: 110,
    zoneWidth: 480,
    zoneHeight: 320,
    /** Padding inside a zone container before children start laying
     *  out. Keeps the zone label legible above its devices. */
    zonePadding: 32,
    /** Padding between top-level zones in the root. */
    rootPadding: 60,
};

/** Synthetic zone for devices whose site is unknown — we still need
 *  somewhere to put them so operators can see "n devices we couldn't
 *  attribute to a site, please fix the asset_inventory location
 *  field". */
const UNSITED_ZONE_ID = '__unsited__';
const UNSITED_ZONE_LABEL = 'Unsited devices';

/** Build the elk input tree from a discovered topology. We group
 *  devices by their `siteLabel` (asset_inventory.location), folding
 *  any device with a missing/empty site into the synthetic
 *  `UNSITED_ZONE_ID` bucket. */
const buildElkTree = (
    topology: DiscoveredTopology
): { root: ElkNode; zonesUsed: Map<string, TopologyDiscoveredZone> } => {
    const zonesById = new Map<string, TopologyDiscoveredZone>();
    for (const z of topology.zones) zonesById.set(z.id, z);

    // Devices keyed by the zone bucket they fall into. We use the
    // device's siteLabel string as the key for the spike since the
    // asset_inventory.location field is a string, not the
    // site_topology UUID. A future build can hook up a UUID resolver
    // for richer parent-child behaviour.
    const devicesByBucket = new Map<string, TopologyDiscoveredNode[]>();
    for (const node of topology.nodes) {
        const bucket = node.siteLabel?.trim().length ? node.siteLabel : UNSITED_ZONE_ID;
        const arr = devicesByBucket.get(bucket) ?? [];
        arr.push(node);
        devicesByBucket.set(bucket, arr);
    }

    const zonesUsed = new Map<string, TopologyDiscoveredZone>();
    const zoneChildren: ElkNode[] = [];
    for (const [bucket, devices] of devicesByBucket.entries()) {
        // Spike behaviour: bucket label IS the zone id. Attempt to
        // match it against a real DNAC zone for prettier labels;
        // otherwise synthesise a transient zone descriptor so the
        // canvas still has something to render.
        const matchedZone = [...zonesById.values()].find(
            (z) => z.name === bucket || z.id === bucket
        );
        const zoneId = matchedZone?.id ?? bucket;
        if (matchedZone) zonesUsed.set(zoneId, matchedZone);

        zoneChildren.push({
            id: zoneId,
            width: DEFAULTS.zoneWidth,
            height: DEFAULTS.zoneHeight,
            // Per-zone layout: pack devices into a roughly square
            // grid (the ELK `box` algorithm) so a 30-device site
            // doesn't render as a single 30-cell column. `box`
            // ignores intra-zone edges and just tiles the children
            // — the natural fit for "all the gear at site X" while
            // operators are still building out the inter-device
            // links via the editor. When dense connectivity arrives
            // we can switch back to `layered` per-zone.
            layoutOptions: {
                'elk.algorithm': 'box',
                'elk.padding': `[top=${DEFAULTS.zonePadding},left=14,bottom=14,right=14]`,
                'elk.spacing.nodeNode': '16',
                'elk.box.packingMode': 'GROUP_DEC',
                'elk.aspectRatio': '1.5',
            },
            children: devices.map((d) => ({
                id: d.id,
                width: DEFAULTS.deviceWidth,
                height: DEFAULTS.deviceHeight,
            })),
        });
    }

    // Synthetic root: lays the zones out left-to-right. This is the
    // top-level direction operators expect (an east-flowing diagram
    // with the HQ on the left).
    const root: ElkNode = {
        id: '__root__',
        layoutOptions: {
            'elk.algorithm': 'layered',
            'elk.direction': 'RIGHT',
            'elk.padding': `[top=${DEFAULTS.rootPadding},left=${DEFAULTS.rootPadding},bottom=${DEFAULTS.rootPadding},right=${DEFAULTS.rootPadding}]`,
            'elk.spacing.nodeNode': '80',
            'elk.layered.spacing.nodeNodeBetweenLayers': '120',
        },
        children: zoneChildren,
        edges: topology.edges.map((e) => ({
            id: e.id,
            sources: [e.sourceId],
            targets: [e.targetId],
        })),
    };
    return { root, zonesUsed };
};

const elk = new ELK();

/**
 * Run elkjs over the discovered topology and return React-Flow-shaped
 * nodes and edges. Async because elkjs does its work in a Web Worker
 * (or sync fallback, depending on browser).
 */
export const layoutTopology = async (
    topology: DiscoveredTopology
): Promise<LayoutResult> => {
    if (topology.nodes.length === 0) {
        return { nodes: [], edges: [] };
    }
    const { root, zonesUsed } = buildElkTree(topology);
    const laid = (await elk.layout(root as unknown as Parameters<typeof elk.layout>[0])) as ElkNode;

    const nodes: LayoutNode[] = [];

    // Emit each zone as a parent React Flow node, then its children
    // as parented device nodes. We resolve zone labels via the
    // `zonesUsed` map (DNAC display name) and fall back to the
    // bucket key (which is the asset_inventory.location string) so
    // unsited buckets still get a readable label.
    for (const zone of laid.children ?? []) {
        const zoneId = zone.id;
        const isUnsited = zoneId === UNSITED_ZONE_ID;
        const zoneLabel = isUnsited
            ? UNSITED_ZONE_LABEL
            : zonesUsed.get(zoneId)?.name ?? zoneId;
        nodes.push({
            id: zoneId,
            type: 'topologyZone',
            position: {
                x: zone.x ?? 0,
                y: zone.y ?? 0,
            },
            width: zone.width ?? DEFAULTS.zoneWidth,
            height: zone.height ?? DEFAULTS.zoneHeight,
            data: {
                label: zoneLabel,
                isUnsited,
                deviceCount: zone.children?.length ?? 0,
            },
            draggable: false,
            isZone: true,
        });

        for (const child of zone.children ?? []) {
            const node = topology.nodes.find((n) => n.id === child.id);
            if (!node) continue;
            nodes.push({
                id: child.id,
                type: `device:${node.shape}`,
                parentId: zoneId,
                extent: 'parent',
                position: {
                    // ELK gives child positions zone-relative; React
                    // Flow expects parent-relative, so they line up
                    // 1:1 as-is.
                    x: child.x ?? 0,
                    y: child.y ?? 0,
                },
                width: child.width ?? DEFAULTS.deviceWidth,
                height: child.height ?? DEFAULTS.deviceHeight,
                data: {
                    node,
                },
                draggable: true,
                isZone: false,
            });
        }
    }

    const edges: LayoutEdge[] = topology.edges.map((e) => ({
        id: e.id,
        source: e.sourceId,
        target: e.targetId,
        kind: e.kind,
        label: e.label,
        data: { edge: e },
    }));

    return { nodes, edges };
};

/**
 * Apply per-node `(x, y)` overrides on top of an elk layout result.
 * Used by the canvas to merge operator-dragged positions into the
 * auto-laid-out graph without re-running ELK on every drag.
 *
 * Override semantics:
 *   • Override key is the node id (lowercased device_name).
 *   • Override coordinates are interpreted in the same coordinate
 *     space as the elk output (parent-relative for parented nodes,
 *     root-relative for top-level nodes), since that's what the
 *     canvas saves when the operator drags.
 *   • Nodes without an override retain their elk-assigned position.
 *   • Override entries for nodes that no longer exist in the layout
 *     are silently ignored — they're harmless until the device
 *     reappears in the inventory.
 */
export const applyOverrides = (
    result: LayoutResult,
    overrides: Record<string, { x: number; y: number }>
): LayoutResult => ({
    edges: result.edges,
    nodes: result.nodes.map((n) => {
        const override = overrides[n.id];
        return override
            ? {
                  ...n,
                  position: { x: override.x, y: override.y },
              }
            : n;
    }),
});
