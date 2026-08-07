/**
 * PropertiesPanel — right-side inspector that opens when an
 * operator selects a node or edge on the topology canvas.
 *
 * Build 105 introduces the editor stage of the topology canvas
 * spike. The panel is intentionally compact and read-only-by-
 * default: every field is rendered, edits commit only when the
 * operator clicks Apply (or presses Enter on a single-line
 * input). This shape keeps the canvas usable as a viewer when
 * non-editor users open it without exposing accidental-mutation
 * surface area.
 *
 * Persistence model:
 *   - Node edits (label/shape/notes) update the React Flow node
 *     in-memory; the canvas's drag-stop handler already persists
 *     position to localStorage. A future Build 107 promotes
 *     these to a `network_topology_views.csv` lookup so edits
 *     survive across browsers.
 *   - Edge edits (label/kind/source/target) update the edge in
 *     memory. Build 106 will pipe edge mutations to
 *     `| outputlookup network_topology_edges.csv` so they
 *     persist server-side and become the source of truth on
 *     next page load.
 *
 * The panel is presentational — it owns no fetch logic and no
 * mutation logic of its own. It exposes `onNodeUpdate`,
 * `onEdgeUpdate`, and `onDelete` callbacks that the canvas
 * implements.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Activity,
    ArrowLeft,
    ArrowLeftRight,
    ArrowRight,
    Bold,
    Italic,
    Minus,
    Save,
    Trash2,
    X,
    type SuiIcon,
} from '@/common/icons/SuiIcon';
import { cn } from '@/common/lib/utils';
import type {
    Node as RFNode,
    Edge as RFEdge,
} from '@xyflow/react';
import type {
    DeviceShapeId,
    TopologyDiscoveredNode,
} from '@/common/services/topologyDiscovery';
import {
    DIAGRAM_TITLE_NODE_TYPE,
    type DiagramTitleNodeData,
} from '@/common/components/diagram/DiagramTitleNode';
import {
    TEXT_BOX_NODE_TYPE,
    type TextBoxAlign,
    type TextBoxNodeData,
} from '@/common/components/diagram/TextBoxNode';

export type Selection =
    | { kind: 'node'; node: RFNode }
    | { kind: 'edge'; edge: RFEdge }
    | null;

export interface NodeUpdate {
    id: string;
    label?: string;
    shortLabel?: string;
    shape?: DeviceShapeId;
    notes?: string;
    /** Build 115: per-node vendor / model overrides. Pass empty
     *  string to clear an override (lets the live asset_inventory
     *  value flow through again). */
    vendor?: string;
    model?: string;
    /** Build 115.13 — per-node IP / management address override.
     *  Empty string clears the override (the card then falls back
     *  to whatever `raw.ip_address` / `raw.management_ip` the
     *  bound asset row carries, if any). `undefined` means no
     *  change — preserve whatever's already on the node. */
    ipAddress?: string;
    /** Build 115.3 — operator-driven binding to a real
     *  `asset_inventory.csv` row. Three states:
     *    • `undefined`   → no change (preserve whatever's already
     *                      on the node).
     *    • `''` (empty)  → unbind. Strip the link; the node becomes
     *                      a free-standing placeholder again. The
     *                      canvas restores any operator-typed
     *                      label/shortLabel/vendor/model and clears
     *                      `node.raw` of inventory provenance.
     *    • `<assetId>`   → bind. The canvas re-derives label /
     *                      shortLabel / vendor / model / raw from
     *                      the live asset and re-shapes the icon
     *                      based on the asset's device_type.
     *  The bound node's React Flow id stays unchanged so existing
     *  edges keep referring to the same endpoints. */
    assetId?: string;
}

/** Build 115: region-specific update payload. Routed through
 *  `onNodeUpdate` with a `kind: 'region'` discriminator so the
 *  canvas keeps a single mutation pathway, like the existing
 *  TitleUpdate pattern. */
export interface RegionUpdate {
    id: string;
    kind: 'region';
    label: string;
    accent: string | undefined;
}

/** Build 113: Title-specific node update. Routed through
 *  `onNodeUpdate` so the canvas keeps a single mutation pathway,
 *  but the discriminating `kind: 'title'` lets the canvas branch
 *  on it cleanly. */
export interface TitleUpdate {
    id: string;
    kind: 'title';
    text: string;
    fontSize: number;
    color: string;
    bold: boolean;
    italic: boolean;
}

/** Build 115.1 — free-placement annotation update. Same routing
 *  pattern as TitleUpdate / RegionUpdate (single mutation pathway
 *  with a `kind` discriminator) so the canvas can branch cleanly
 *  on the inspector's output. Fontsize range matches the title
 *  but with a smaller floor — annotations are typically body-sized
 *  rather than display-sized. */
export interface TextBoxUpdate {
    id: string;
    kind: 'textbox';
    text: string;
    fontSize: number;
    color: string;
    bold: boolean;
    italic: boolean;
    background: string;
    border: string;
    align: TextBoxAlign;
}

export type EdgeDirection = 'none' | 'forward' | 'backward' | 'both';

/** Build 115.11 — arrow tip styles operators can pick from in the
 *  edge inspector. `thin` is the default; the glyphs are rendered
 *  by AnimatedEdge so they inherit the connector colour. */
export type ArrowStyle = 'closed' | 'open' | 'thin' | 'dot' | 'diamond';

export interface EdgeUpdate {
    id: string;
    label?: string;
    kind?: 'physical' | 'synthetic_a2a' | 'logical';
    /** Build 113: arrowhead direction (none / forward / backward / both). */
    direction?: EdgeDirection;
    /** Build 115.11: arrowhead glyph style. */
    arrowStyle?: ArrowStyle;
    /** Build 115.11: when true, the edge stroke colour is driven by
     *  the live `| metadata type=hosts` reporting status of its
     *  endpoints rather than `lineColor` / per-kind defaults. */
    liveStatus?: boolean;
    /** Build 115.5: hex colour for the edge LINE (stroke).
     *  Empty string → fall back to per-kind default; `undefined`
     *  → no change. Same sentinel convention as animationColor
     *  so the canvas update path can treat them uniformly. */
    lineColor?: string;
    /** Build 114: hex colour for the flowing-dot animation. Empty
     *  string means "fall back to per-kind default". `undefined`
     *  means the operator didn't touch this field — leave the
     *  existing value in place. */
    animationColor?: string;
    notes?: string;
}

interface PropertiesPanelProps {
    selection: Selection;
    onClose: () => void;
    /** Build 115.3 — when present, the inspector exposes a
     *  "Bind to host" combobox that lets the operator link a
     *  free-standing shape to a real `asset_inventory.csv` row.
     *  Live ops canvases (`TopologyCanvas`) that already auto-bind
     *  their nodes can omit this prop. */
    assetIndex?: Map<string, TopologyDiscoveredNode> | null;
    onNodeUpdate: (update: NodeUpdate) => void;
    /** Build 113: title nodes route through here with the discriminated
     *  `TitleUpdate` payload. Optional — only the diagram canvas
     *  produces title nodes; the live ops canvas (`TopologyCanvas`)
     *  never sees one and can omit this prop. */
    onTitleUpdate?: (update: TitleUpdate) => void;
    /** Build 115: region (group) rename + accent picker route
     *  through here. Optional, same reasoning as `onTitleUpdate`. */
    onRegionUpdate?: (update: RegionUpdate) => void;
    /** Build 115.1 — free-placement annotation updates flow
     *  through this hook with a `kind: 'textbox'` discriminator.
     *  Optional for the same reason as the others: live ops
     *  canvases that don't expose textboxes can omit the prop. */
    onTextBoxUpdate?: (update: TextBoxUpdate) => void;
    onEdgeUpdate: (update: EdgeUpdate) => void;
    onDelete: (id: string, kind: 'node' | 'edge') => void;
}

/** Build 115.5 — Device-family dropdown options. Grouped by
 *  section comments only (the `<select>` is flat); ordering
 *  matches the palette in ShapesTab.tsx so an operator who
 *  navigates by section finds the same labels in both places.
 *  42 entries. */
const DEVICE_SHAPE_OPTIONS: Array<{ id: DeviceShapeId; label: string }> = [
    // Core network
    { id: 'router', label: 'Router' },
    { id: 'switch', label: 'L2 Switch' },
    { id: 'l3_switch', label: 'L3 Switch' },
    { id: 'stack', label: 'Switch Stack' },
    { id: 'hub', label: 'Hub' },
    { id: 'gateway', label: 'Gateway / SD-WAN edge' },
    { id: 'proxy', label: 'Proxy' },
    { id: 'wlc', label: 'Wireless LAN Controller' },
    { id: 'access_point', label: 'Access Point' },
    { id: 'load_balancer', label: 'Load Balancer' },
    { id: 'f5_load_balancer', label: 'F5 Load Balancer' },
    { id: 'modular_chassis_switch', label: 'Modular Chassis Switch' },
    { id: 'nexus_aci_fabric', label: 'Nexus / ACI Fabric' },
    { id: 'sdwan_controller', label: 'SD-WAN Controller' },
    { id: 'custom_stencil', label: 'Custom Stencil' },
    // Security
    { id: 'firewall', label: 'Firewall' },
    { id: 'palo_alto_firewall', label: 'Palo Alto Firewall' },
    { id: 'fortinet_firewall', label: 'Fortinet Firewall' },
    { id: 'waf', label: 'Web App Firewall (WAF)' },
    { id: 'vpn_concentrator', label: 'VPN Concentrator' },
    { id: 'ids_ips', label: 'IDS / IPS' },
    { id: 'siem', label: 'SIEM / Analytics' },
    { id: 'ca', label: 'Certificate Authority' },
    { id: 'bastion', label: 'Bastion / Jump Host' },
    // Servers & infrastructure
    { id: 'server', label: 'Server' },
    { id: 'web_server', label: 'Web Server' },
    { id: 'app_server', label: 'Application Server' },
    { id: 'dns_server', label: 'DNS Server' },
    { id: 'dhcp_server', label: 'DHCP Server' },
    { id: 'mainframe', label: 'Mainframe' },
    { id: 'container', label: 'Container / K8s pod' },
    { id: 'vm', label: 'VM / Hypervisor' },
    { id: 'database', label: 'Database' },
    // Storage
    { id: 'storage', label: 'Storage' },
    { id: 'nas', label: 'NAS' },
    { id: 'san', label: 'SAN' },
    { id: 'backup', label: 'Backup' },
    // End-user / IoT
    { id: 'laptop', label: 'Laptop' },
    { id: 'mobile_phone', label: 'Mobile Phone' },
    { id: 'ip_phone', label: 'IP Phone' },
    { id: 'printer', label: 'Printer' },
    { id: 'camera', label: 'Camera' },
    { id: 'iot_sensor', label: 'IoT Sensor' },
    // Edge / cloud
    { id: 'cloud', label: 'Cloud / WAN' },
    { id: 'internet', label: 'Internet' },
    { id: 'users', label: 'Users' },
    // Splunk platform
    { id: 'splunk_search_head', label: 'Splunk Search Head' },
    { id: 'splunk_search_head_cluster', label: 'Splunk Search Head Cluster' },
    { id: 'splunk_indexer', label: 'Splunk Indexer' },
    { id: 'splunk_indexer_cluster', label: 'Splunk Indexer Cluster' },
    { id: 'splunk_heavy_forwarder', label: 'Splunk Heavy Forwarder' },
    { id: 'splunk_universal_forwarder', label: 'Splunk Universal Forwarder' },
    { id: 'splunk_intermediate_forwarder', label: 'Splunk Intermediate Forwarder' },
    { id: 'splunk_cluster_manager', label: 'Splunk Cluster Manager' },
    { id: 'splunk_deployer', label: 'Splunk SHC Deployer' },
    { id: 'splunk_license_manager', label: 'Splunk License Manager' },
    { id: 'splunk_monitoring_console', label: 'Splunk Monitoring Console' },
    { id: 'splunk_deployment_server', label: 'Splunk Deployment Server' },
    { id: 'splunk_sc4s', label: 'Splunk Connect for Syslog' },
    // Places
    { id: 'branch_office', label: 'Branch Office' },
    { id: 'datacenter', label: 'Data Center' },
    // Cisco official icons
    { id: 'cisco_router', label: 'Cisco Router' },
    { id: 'cisco_switch', label: 'Cisco Switch' },
    { id: 'cisco_l3_switch', label: 'Cisco L3 Switch' },
    { id: 'cisco_stack', label: 'Cisco Chassis' },
    { id: 'cisco_wlc', label: 'Cisco WLC' },
    { id: 'cisco_access_point', label: 'Cisco AP' },
    { id: 'cisco_firewall', label: 'Cisco Firewall' },
    { id: 'cisco_server', label: 'Cisco Server' },
    { id: 'cisco_cloud', label: 'Cisco Cloud' },
    { id: 'cisco_data_center', label: 'Cisco Data Center' },
    { id: 'generic', label: 'Generic' },
];

/** Build 115 — region accent palette. Each entry's id matches
 *  the allow-list in `RegionGroupNode.accentClasses`; anything
 *  outside this list silently falls back to slate. The hex on
 *  each tile is just the swatch colour shown to the user — the
 *  region itself uses the matching Tailwind class fragment. */
const REGION_ACCENT_OPTIONS: Array<{
    id: string | undefined;
    label: string;
    swatch: string;
}> = [
    { id: undefined, label: 'Default', swatch: '#64748b' }, // slate-500
    { id: 'sky-500', label: 'Sky', swatch: '#0ea5e9' },
    { id: 'emerald-500', label: 'Emerald', swatch: '#10b981' },
    { id: 'amber-500', label: 'Amber', swatch: '#f59e0b' },
    { id: 'rose-500', label: 'Rose', swatch: '#f43f5e' },
    { id: 'violet-500', label: 'Violet', swatch: '#8b5cf6' },
    { id: 'slate-500', label: 'Slate', swatch: '#64748b' },
];

const EDGE_KIND_OPTIONS: Array<{ id: EdgeUpdate['kind']; label: string; hint: string }> = [
    { id: 'physical', label: 'Physical link', hint: 'Solid grey — port-to-port (CDP/LLDP)' },
    { id: 'synthetic_a2a', label: 'Synthetic (TE A2A)', hint: 'Dashed sky-blue — measurement path' },
    { id: 'logical', label: 'Logical adjacency', hint: 'Dotted slate — BGP/OSPF/EIGRP peer' },
];

const SectionHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-3 pt-3 pb-1">
        {children}
    </div>
);

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div className="px-3 py-1.5">
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            {label}
        </label>
        {children}
    </div>
);

const inputClass = cn(
    'w-full text-[12px] px-2 py-1.5 rounded border',
    'border-slate-200 dark:border-slate-700',
    'bg-white dark:bg-slate-900',
    'text-slate-900 dark:text-slate-100',
    'focus:outline-none focus:ring-2 focus:ring-sky-500/40'
);

/**
 * Build 115.3 — combobox that ties a placeholder shape on the
 * canvas to a real Splunk host (an `asset_inventory.csv` row).
 *
 * Why this lives in the inspector and not on the palette:
 *   • Operators routinely sketch a topology with palette shapes
 *     before they know which physical hosts will play each role
 *     ("here's where the indexer cluster goes"). Forcing the
 *     pick-an-asset step at drop time would break the sketch
 *     workflow and lose the inventory→shape lookup that already
 *     works from the InventoryTab.
 *   • Once the layout is right, binding lets the diagram inherit
 *     live status (the visibility dot from `| metadata
 *     type=hosts`), vendor, model, and serial number from the
 *     authoritative inventory. The operator clicks the shape,
 *     types a host fragment, and picks a match — no canvas
 *     reshuffle.
 *
 * UX notes:
 *   • A free-form `<input>` with a filtered `<ul>` of matches
 *     under it. Plain `<datalist>` would be lighter, but it
 *     can't render the rich label/shortLabel/vendor preview that
 *     makes "is this the right host?" a one-glance decision.
 *   • The list caps at 25 results so a 5,000-host inventory can't
 *     wedge the panel layout. The cap message tells the operator
 *     to keep typing if their host isn't visible.
 *   • Click-outside dismisses; Escape clears the query without
 *     changing the binding.
 */
const BindToHostField: React.FC<{
    assetIndex: Map<string, TopologyDiscoveredNode>;
    boundAssetId: string;
    onBind: (assetId: string) => void;
    onUnbind: () => void;
}> = ({ assetIndex, boundAssetId, onBind, onUnbind }) => {
    const [query, setQuery] = useState<string>('');
    const [open, setOpen] = useState<boolean>(false);
    const containerRef = useRef<HTMLDivElement | null>(null);

    const boundAsset = boundAssetId ? assetIndex.get(boundAssetId) ?? null : null;

    useEffect(() => {
        const handleClick = (e: MouseEvent): void => {
            if (
                containerRef.current &&
                !containerRef.current.contains(e.target as Node)
            ) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const matches = useMemo<TopologyDiscoveredNode[]>(() => {
        const q = query.trim().toLowerCase();
        const all = Array.from(assetIndex.values());
        if (q.length === 0) {
            // Show first 25 alphabetised hosts when the query is
            // empty so the operator gets an at-a-glance view of
            // what's bindable. Sorting by label keeps the same
            // first-25 each click instead of jittering.
            return all
                .slice()
                .sort((a, b) =>
                    (a.label ?? a.id).localeCompare(b.label ?? b.id)
                )
                .slice(0, 25);
        }
        const out: TopologyDiscoveredNode[] = [];
        for (const a of all) {
            const haystack = `${a.id} ${a.label ?? ''} ${a.shortLabel ?? ''} ${
                a.vendor ?? ''
            } ${a.model ?? ''}`.toLowerCase();
            if (haystack.includes(q)) {
                out.push(a);
                if (out.length >= 25) break;
            }
        }
        return out;
    }, [query, assetIndex]);

    return (
        <div className="px-3 py-1.5" ref={containerRef}>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Bind to host
                <span className="ml-1 text-xs font-normal text-slate-400">
                    {assetIndex.size.toLocaleString()} known hosts
                </span>
            </label>
            {boundAsset ? (
                <div className="flex items-start gap-2 p-2 rounded border border-emerald-200 dark:border-emerald-700/60 bg-emerald-50/60 dark:bg-emerald-950/30">
                    <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-medium text-emerald-800 dark:text-emerald-200 truncate">
                            {boundAsset.label ?? boundAsset.id}
                        </div>
                        <div className="text-xs text-emerald-700 dark:text-emerald-300 truncate">
                            {boundAsset.shortLabel ?? boundAsset.id}
                            {boundAsset.vendor ? ` · ${boundAsset.vendor}` : ''}
                            {boundAsset.model ? ` ${boundAsset.model}` : ''}
                        </div>
                    </div>
                    <button
                        type="button"
                        className="text-xs px-2 py-1 rounded border border-emerald-300 dark:border-emerald-600 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
                        onClick={() => {
                            onUnbind();
                            setQuery('');
                            setOpen(false);
                        }}
                        title="Detach this shape from the bound host (label / vendor / model are kept)"
                    >
                        Unbind
                    </button>
                </div>
            ) : (
                <div className="relative">
                    <input
                        className={inputClass}
                        type="text"
                        value={query}
                        placeholder="Type a host name, vendor, or model…"
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setOpen(true);
                        }}
                        onFocus={() => setOpen(true)}
                        onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                                setQuery('');
                                setOpen(false);
                            }
                        }}
                    />
                    {open && matches.length > 0 ? (
                        <ul className="absolute z-30 mt-1 left-0 right-0 max-h-64 overflow-auto rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg">
                            {matches.map((a) => (
                                <li key={a.id}>
                                    <button
                                        type="button"
                                        className="block w-full text-left px-2 py-1.5 hover:bg-sky-50 dark:hover:bg-sky-900/30"
                                        onClick={() => {
                                            onBind(a.id);
                                            setQuery('');
                                            setOpen(false);
                                        }}
                                    >
                                        <div className="text-[12px] text-slate-900 dark:text-slate-100 truncate">
                                            {a.label ?? a.id}
                                        </div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                            {a.shortLabel ?? a.id}
                                            {a.vendor ? ` · ${a.vendor}` : ''}
                                            {a.model ? ` ${a.model}` : ''}
                                        </div>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : open && query.length > 0 ? (
                        <div className="absolute z-30 mt-1 left-0 right-0 px-3 py-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-500 shadow-sm">
                            No hosts match “{query}”.
                        </div>
                    ) : null}
                </div>
            )}
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-tight">
                Binding pulls vendor, model, and live host status from{' '}
                <code className="text-xs">asset_inventory</code>. The shape is auto-
                reshaped to match the host&apos;s device family.
            </p>
        </div>
    );
};

const NodePropertiesForm: React.FC<{
    node: RFNode;
    onApply: (update: NodeUpdate) => void;
    /** Build 115.10 — invoked AFTER an explicit Apply press so the
     *  parent can dismiss the panel. NOT invoked from inline
     *  binding apply (Build 115.3 single-click flow), since the
     *  operator typically wants to see the rebound state before
     *  closing the panel. */
    onApplyComplete?: () => void;
    onDelete: (id: string) => void;
    /** Build 115.3 — when present, the form renders a "Bind to
     *  host" combobox under the Identity section. Operators pick
     *  an asset_inventory row to retroactively bind a placeholder
     *  shape to a real Splunk host so the visibility (`| metadata
     *  type=hosts`) status dot lights up. */
    assetIndex?: Map<string, TopologyDiscoveredNode> | null;
}> = ({ node, onApply, onApplyComplete, onDelete, assetIndex }) => {
    const data = (node.data ?? {}) as {
        node?: {
            shape?: DeviceShapeId;
            label?: string;
            shortLabel?: string;
            managementSource?: string;
            // Build 115: hardware metadata visible in the inspector
            vendor?: string;
            model?: string;
            serialNumber?: string;
            // Build 115.13 — operator-supplied IP override.
            ipAddress?: string;
            // Build 115.2: when the inspector first loads a node
            // dropped pre-fix (or hand-built without explicit
            // vendor/model), we still want to show the live
            // asset_inventory hint instead of empty fields. The
            // shape card already does this fallback at render time
            // (see `DeviceShape` in shapes.tsx); mirror the chain
            // here so the two surfaces never disagree.
            raw?: Record<string, unknown>;
        };
        notes?: string;
    };
    const initialLabel = data.node?.label ?? '';
    const initialShortLabel = data.node?.shortLabel ?? '';
    const initialShape = (data.node?.shape ?? 'generic') as DeviceShapeId;
    const initialNotes = data.notes ?? '';
    // Build 115.2 — fallback chain: explicit vendor / model →
    // raw.vendor / raw.platform_id from asset_inventory → empty.
    // Matches the device-card render in shapes.tsx exactly so the
    // inspector and card stay in sync for every dropped device.
    const rawVendor =
        typeof data.node?.raw?.['vendor'] === 'string'
            ? (data.node.raw['vendor'] as string)
            : '';
    const rawModel =
        typeof data.node?.raw?.['platform_id'] === 'string'
            ? (data.node.raw['platform_id'] as string)
            : '';
    const initialVendor = data.node?.vendor ?? rawVendor;
    const initialModel = data.node?.model ?? rawModel;
    // Build 115.13 — IP fallback chain mirrors the device card:
    // explicit override → asset_inventory `ip_address` →
    // splunk_inventory `management_ip` → empty.
    const rawIp =
        typeof data.node?.raw?.['ip_address'] === 'string'
            ? (data.node.raw['ip_address'] as string)
            : typeof data.node?.raw?.['management_ip'] === 'string'
              ? (data.node.raw['management_ip'] as string)
              : '';
    const initialIpAddress = data.node?.ipAddress ?? rawIp;

    // Build 115.5 — derive the bound asset id from a positive
    // assetIndex membership test, NOT from the previous
    // id-equality heuristic. The 115.3 logic
    // (`data.node.id !== node.id`) worked for shape-from-palette
    // drops but FAILED for inventory drops, where the React Flow
    // node id IS the asset id by design (see handleDrop's `asset`
    // variant) — meaning a freshly-dropped indexer / switch /
    // access-point appeared as "unbound" in the inspector even
    // though it was in fact bound to a real host. Re-binding the
    // same shape to the same host then looked like nothing
    // happened (input cleared, no green pill), which is the bug
    // the operator reported as "it keeps erasing it".
    //
    // The corrected test asks the only question that matters:
    // does `data.node.id` resolve to a live asset_inventory row?
    // If yes → bound, regardless of how the shape got there
    // (inventory drop / palette shape / inspector-bound).
    // If no  → not bound, and the input takes input from the
    // operator who's about to bind a real host.
    const candidateAssetId =
        typeof data.node?.['id' as keyof typeof data.node] === 'string'
            ? ((data.node as { id?: string }).id as string)
            : '';
    const initialBoundAssetId =
        candidateAssetId.length > 0 && assetIndex?.has(candidateAssetId)
            ? candidateAssetId
            : '';

    const [label, setLabel] = useState<string>(initialLabel);
    const [shortLabel, setShortLabel] = useState<string>(initialShortLabel);
    const [shape, setShape] = useState<DeviceShapeId>(initialShape);
    const [notes, setNotes] = useState<string>(initialNotes);
    const [vendor, setVendor] = useState<string>(initialVendor);
    const [model, setModel] = useState<string>(initialModel);
    const [ipAddress, setIpAddress] = useState<string>(initialIpAddress);

    useEffect(() => {
        setLabel(initialLabel);
        setShortLabel(initialShortLabel);
        setShape(initialShape);
        setNotes(initialNotes);
        setVendor(initialVendor);
        setModel(initialModel);
        setIpAddress(initialIpAddress);
    }, [
        initialLabel,
        initialShortLabel,
        initialShape,
        initialNotes,
        initialVendor,
        initialModel,
        initialIpAddress,
    ]);

    /** Build 115.10 — auto-bind heuristic. When the operator
     *  Applies a label / shortLabel that exactly matches an asset
     *  the inventory already knows about (case-insensitive across
     *  asset.id / label / shortLabel / FQDN-short forms) AND the
     *  shape is currently unbound, treat the Apply as an implicit
     *  bind. This is the "if we know the device, just bind it"
     *  shortcut — the operator can still unbind via the Bind to
     *  host control if the heuristic guessed wrong.
     *
     *  We only auto-bind on EXACT matches (after lower-case +
     *  whitespace trim). Fuzzy matching would surprise operators
     *  who happen to type a substring of a real host. The list of
     *  candidates we compare against covers the practical FQDN /
     *  short-name skew between asset_inventory and
     *  `| metadata type=hosts`. */
    const matchAssetByName = (): string | null => {
        if (!assetIndex || initialBoundAssetId) return null;
        const norm = (s: string): string => s.trim().toLowerCase();
        const shortOf = (s: string): string => norm(s).split('.')[0] ?? '';
        const candidates = [norm(label), norm(shortLabel), shortOf(label)]
            .filter((c) => c.length > 0);
        if (candidates.length === 0) return null;
        let match: string | null = null;
        let matchCount = 0;
        for (const asset of assetIndex.values()) {
            const aliases = [
                asset.id,
                asset.label,
                asset.shortLabel,
                (asset.raw?.['hostname'] as string | undefined) ?? '',
                (asset.raw?.['device_name'] as string | undefined) ?? '',
            ]
                .filter(Boolean)
                .flatMap((alias) => [norm(alias), shortOf(alias)]);
            const hit = aliases.some((a) => candidates.includes(a));
            if (hit) {
                match = asset.id;
                matchCount += 1;
                if (matchCount > 1) return null; // ambiguous → punt
            }
        }
        return match;
    };

    const handleApply = (): void => {
        const auto = matchAssetByName();
        const update: NodeUpdate = {
            id: node.id,
            label,
            shortLabel,
            shape,
            notes,
            vendor,
            model,
            ipAddress,
        };
        if (auto) {
            // Treat the Apply press as an implicit bind so the
            // canvas's `handleNodeUpdate` rebuilds vendor / model /
            // raw from the live asset row and the LED lights up
            // the moment the metadata search confirms the host.
            update.assetId = auto;
        }
        onApply(update);
        onApplyComplete?.();
    };

    /** Build 115.3 — apply a binding change WITHOUT requiring a
     *  separate "Apply" press. Binding is a destructive operation
     *  (it overwrites label / vendor / model with the live asset's
     *  values), so a single-click flow with an immediate apply +
     *  toast is the right UX. The canvas-side handler funnels back
     *  through `handleNodeUpdate`, which short-circuits to the
     *  bind branch when `assetId` is non-empty.
     *
     *  We pass the full set of currently-typed fields so an
     *  operator who'd already started editing notes / shortLabel
     *  doesn't lose their pending changes. */
    const handleBindChange = (newAssetId: string): void => {
        onApply({
            id: node.id,
            label,
            shortLabel,
            shape,
            notes,
            vendor,
            model,
            ipAddress,
            assetId: newAssetId,
        });
    };

    return (
        <>
            <SectionHeader>Identity</SectionHeader>
            <Field label="Display name">
                <input
                    className={inputClass}
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="device.hostname.example"
                />
            </Field>
            <Field label="Short alias (shown on the canvas)">
                <input
                    className={inputClass}
                    value={shortLabel}
                    onChange={(e) => setShortLabel(e.target.value)}
                    placeholder="device"
                />
            </Field>

            {assetIndex && assetIndex.size > 0 ? (
                <BindToHostField
                    assetIndex={assetIndex}
                    boundAssetId={initialBoundAssetId}
                    onBind={(assetId) => handleBindChange(assetId)}
                    onUnbind={() => handleBindChange('')}
                />
            ) : null}

            <SectionHeader>Shape</SectionHeader>
            <Field label="Device family">
                <select
                    className={inputClass}
                    value={shape}
                    onChange={(e) => setShape(e.target.value as DeviceShapeId)}
                >
                    {DEVICE_SHAPE_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                            {opt.label}
                        </option>
                    ))}
                </select>
            </Field>

            <SectionHeader>Hardware</SectionHeader>
            <Field label="Vendor">
                <input
                    className={inputClass}
                    value={vendor}
                    onChange={(e) => setVendor(e.target.value)}
                    placeholder="e.g. Cisco"
                />
            </Field>
            <Field label="Model">
                <input
                    className={inputClass}
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="e.g. C9300-24"
                />
            </Field>
            {/* Build 115.13 — IP / management address. Shown below
             *  Model so it sits with the rest of the inventory
             *  metadata. We don't validate the address (allow
             *  IPv4, IPv6, hostnames, FQDNs) so operators can
             *  document whatever notation the actual environment
             *  uses; the page-level "Show IPs" toggle controls
             *  whether the value gets rendered on the card. */}
            <Field label="IP / Management address">
                <input
                    className={inputClass}
                    value={ipAddress}
                    onChange={(e) => setIpAddress(e.target.value)}
                    placeholder="10.0.1.42 / 2001:db8::1 / mgmt.example"
                    autoComplete="off"
                    spellCheck={false}
                />
            </Field>
            {data.node?.serialNumber ? (
                <div className="px-3 pb-2 text-xs text-slate-500 dark:text-slate-400">
                    Serial:{' '}
                    <code className="font-mono">{data.node.serialNumber}</code>
                </div>
            ) : null}

            <SectionHeader>Notes</SectionHeader>
            <Field label="Operator notes">
                <textarea
                    className={cn(inputClass, 'min-h-[64px] resize-y')}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Free-form context (location, owner, change-control window, …)"
                />
            </Field>

            <SectionHeader>Provenance</SectionHeader>
            <div className="px-3 pb-2 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                <div>
                    <span className="font-medium">ID:</span>{' '}
                    <code className="font-mono">{node.id}</code>
                </div>
                {data.node?.managementSource && (
                    <div>
                        <span className="font-medium">Source:</span> {data.node.managementSource}
                    </div>
                )}
                <div className="text-xs italic pt-1">
                    Edits stay local until Build 107 ships{' '}
                    <code className="font-mono">network_topology_views.csv</code>.
                </div>
            </div>

            <div className="flex items-center gap-2 px-3 py-3 border-t border-slate-200 dark:border-slate-800">
                <button
                    type="button"
                    onClick={handleApply}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-sky-500 hover:bg-sky-600 text-white shadow-sm"
                >
                    <Save className="w-3.5 h-3.5" aria-hidden /> Apply
                </button>
                <button
                    type="button"
                    onClick={() => onDelete(node.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border border-rose-300 dark:border-rose-700 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30"
                >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden /> Remove
                </button>
            </div>
        </>
    );
};

/** Build 113: clamp the title font size to a sane editorial range.
 *  12px is roughly footnote-size — anything smaller stops reading
 *  as a "title". 96px is the upper bound where a single-line title
 *  starts to clip at default zoom on a 1080p canvas; the operator
 *  can still zoom out to see larger titles, but the inspector won't
 *  let them paint themselves into a corner with 200px text. */
const TITLE_FONT_MIN = 12;
const TITLE_FONT_MAX = 96;

/** Build 113: presets for the title color picker. We expose a small
 *  curated swatch (slate-900 default, sky-700, emerald-700, amber-
 *  600, rose-600, violet-600) plus a free-form input — gives the
 *  operator a one-click path for the common cases without locking
 *  them out of "I really want this specific brand purple". */
const TITLE_COLOR_PRESETS: Array<{ value: string; label: string }> = [
    { value: '#0f172a', label: 'Slate (default)' },
    { value: '#0369a1', label: 'Sky' },
    { value: '#047857', label: 'Emerald' },
    { value: '#b45309', label: 'Amber' },
    { value: '#be123c', label: 'Rose' },
    { value: '#6d28d9', label: 'Violet' },
];

/** Build 115 — Region inspector. Lets the operator rename a
 *  region's header and pick a tint colour from the seven-entry
 *  accent allow-list (slate / sky / emerald / amber / rose /
 *  violet, plus a "default" tile that clears any existing
 *  override). The accent colour drives both the dashed border
 *  and the device-count pill in `RegionGroupNode`. */
const RegionPropertiesForm: React.FC<{
    node: RFNode;
    onApply: (update: RegionUpdate) => void;
    onApplyComplete?: () => void;
    onDelete: (id: string) => void;
}> = ({ node, onApply, onApplyComplete, onDelete }) => {
    const data = (node.data ?? {}) as { label?: string; accent?: string; deviceCount?: number };
    const initialLabel = typeof data.label === 'string' ? data.label : '';
    const initialAccent = typeof data.accent === 'string' ? data.accent : undefined;

    const [label, setLabel] = useState<string>(initialLabel);
    const [accent, setAccent] = useState<string | undefined>(initialAccent);

    useEffect(() => {
        setLabel(initialLabel);
        setAccent(initialAccent);
    }, [initialLabel, initialAccent]);

    const handleApply = (): void => {
        onApply({ id: node.id, kind: 'region', label, accent });
        onApplyComplete?.();
    };

    return (
        <>
            <SectionHeader>Region</SectionHeader>
            <Field label="Name">
                <input
                    className={inputClass}
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="Site A, Data Center, DMZ, …"
                />
            </Field>
            <Field label="Accent colour">
                <div className="grid grid-cols-4 gap-1.5">
                    {REGION_ACCENT_OPTIONS.map((opt) => {
                        const isActive =
                            (accent ?? undefined) === (opt.id ?? undefined);
                        return (
                            <button
                                type="button"
                                key={opt.label}
                                onClick={() => setAccent(opt.id)}
                                title={opt.label}
                                className={cn(
                                    'flex flex-col items-center justify-center gap-1 rounded border py-1.5 text-xs transition-colors',
                                    isActive
                                        ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300'
                                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-500 dark:text-slate-400'
                                )}
                            >
                                <span
                                    className="w-4 h-4 rounded-full border border-slate-300/60"
                                    style={{ background: opt.swatch }}
                                />
                                {opt.label}
                            </button>
                        );
                    })}
                </div>
            </Field>

            <SectionHeader>Stats</SectionHeader>
            <div className="px-3 pb-2 text-xs text-slate-500 dark:text-slate-400">
                Devices in this region:{' '}
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {typeof data.deviceCount === 'number' ? data.deviceCount : 0}
                </span>
                <div className="text-xs italic pt-1">
                    Drag the corner / side handles on the canvas to resize the
                    region. Devices dropped inside snap to it automatically.
                </div>
            </div>

            <div className="flex items-center gap-2 px-3 py-3 border-t border-slate-200 dark:border-slate-800">
                <button
                    type="button"
                    onClick={handleApply}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-sky-500 hover:bg-sky-600 text-white shadow-sm"
                >
                    <Save className="w-3.5 h-3.5" aria-hidden /> Apply
                </button>
                <button
                    type="button"
                    onClick={() => onDelete(node.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border border-rose-300 dark:border-rose-700 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30"
                >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden /> Remove
                </button>
            </div>
        </>
    );
};

const TitlePropertiesForm: React.FC<{
    node: RFNode;
    onApply: (update: TitleUpdate) => void;
    onApplyComplete?: () => void;
    onDelete: (id: string) => void;
}> = ({ node, onApply, onApplyComplete, onDelete }) => {
    const data = (node.data ?? {}) as Partial<DiagramTitleNodeData>;
    const initialText = data.text ?? '';
    const initialFontSize =
        typeof data.fontSize === 'number'
            ? Math.min(TITLE_FONT_MAX, Math.max(TITLE_FONT_MIN, data.fontSize))
            : 28;
    const initialColor =
        typeof data.color === 'string' && data.color.startsWith('#')
            ? data.color
            : '#0f172a';
    const initialBold = data.bold === true;
    const initialItalic = data.italic === true;

    const [text, setText] = useState<string>(initialText);
    const [fontSize, setFontSize] = useState<number>(initialFontSize);
    const [color, setColor] = useState<string>(initialColor);
    const [bold, setBold] = useState<boolean>(initialBold);
    const [italic, setItalic] = useState<boolean>(initialItalic);

    useEffect(() => {
        setText(initialText);
        setFontSize(initialFontSize);
        setColor(initialColor);
        setBold(initialBold);
        setItalic(initialItalic);
    }, [initialText, initialFontSize, initialColor, initialBold, initialItalic]);

    const handleApply = (): void => {
        onApply({
            id: node.id,
            kind: 'title',
            text,
            fontSize: Math.min(TITLE_FONT_MAX, Math.max(TITLE_FONT_MIN, fontSize)),
            color,
            bold,
            italic,
        });
        onApplyComplete?.();
    };

    return (
        <>
            <SectionHeader>Title text</SectionHeader>
            <Field label="Headline">
                <textarea
                    className={cn(inputClass, 'min-h-[60px] resize-y')}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Diagram title (e.g. Florida DEM Network)"
                    autoFocus
                />
            </Field>

            <SectionHeader>Typography</SectionHeader>
            <Field label={`Font size — ${fontSize}px`}>
                <input
                    type="range"
                    min={TITLE_FONT_MIN}
                    max={TITLE_FONT_MAX}
                    step={1}
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                    className="w-full accent-sky-500"
                    aria-label="Font size"
                />
            </Field>
            <Field label="Style">
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={() => setBold((b) => !b)}
                        title="Toggle bold"
                        aria-pressed={bold}
                        className={cn(
                            'flex items-center justify-center w-8 h-7 rounded border text-xs font-medium transition-colors',
                            bold
                                ? 'bg-sky-50 dark:bg-sky-900/30 border-sky-300 dark:border-sky-700 text-sky-700 dark:text-sky-300'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                        )}
                    >
                        <Bold className="w-3.5 h-3.5" aria-hidden />
                    </button>
                    <button
                        type="button"
                        onClick={() => setItalic((i) => !i)}
                        title="Toggle italic"
                        aria-pressed={italic}
                        className={cn(
                            'flex items-center justify-center w-8 h-7 rounded border text-xs font-medium transition-colors',
                            italic
                                ? 'bg-sky-50 dark:bg-sky-900/30 border-sky-300 dark:border-sky-700 text-sky-700 dark:text-sky-300'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                        )}
                    >
                        <Italic className="w-3.5 h-3.5" aria-hidden />
                    </button>
                </div>
            </Field>

            <SectionHeader>Colour</SectionHeader>
            <Field label="Preset palette">
                <div className="flex items-center gap-1.5 flex-wrap">
                    {TITLE_COLOR_PRESETS.map((p) => {
                        const active =
                            color.toLowerCase() === p.value.toLowerCase();
                        return (
                            <button
                                key={p.value}
                                type="button"
                                title={p.label}
                                aria-label={p.label}
                                aria-pressed={active}
                                onClick={() => setColor(p.value)}
                                className={cn(
                                    'w-6 h-6 rounded-full border-2 transition-transform',
                                    active
                                        ? 'border-sky-400 scale-110 shadow-sm'
                                        : 'border-white dark:border-slate-800 hover:scale-105'
                                )}
                                style={{ backgroundColor: p.value }}
                            />
                        );
                    })}
                </div>
            </Field>
            <Field label="Custom hex (e.g. #1e3a8a)">
                <input
                    type="text"
                    className={cn(inputClass, 'font-mono')}
                    value={color}
                    onChange={(e) => {
                        const v = e.target.value.trim();
                        // Accept any string while typing; the preview
                        // gracefully falls back to the previous valid
                        // colour if this isn't a parseable CSS colour.
                        setColor(v || '#0f172a');
                    }}
                    placeholder="#0f172a"
                />
            </Field>

            <SectionHeader>Provenance</SectionHeader>
            <div className="px-3 pb-2 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                <div>
                    <span className="font-medium">ID:</span>{' '}
                    <code className="font-mono">{node.id}</code>
                </div>
                <div className="text-xs italic pt-1">
                    Persists with the diagram to{' '}
                    <code className="font-mono">network_diagrams.csv</code> on Save.
                </div>
            </div>

            <div className="flex items-center gap-2 px-3 py-3 border-t border-slate-200 dark:border-slate-800">
                <button
                    type="button"
                    onClick={handleApply}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-sky-500 hover:bg-sky-600 text-white shadow-sm"
                >
                    <Save className="w-3.5 h-3.5" aria-hidden /> Apply
                </button>
                <button
                    type="button"
                    onClick={() => onDelete(node.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border border-rose-300 dark:border-rose-700 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30"
                >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden /> Remove title
                </button>
            </div>
        </>
    );
};

/** Build 115.1 — text-box font size limits. Floor (10px) accommodates
 *  port-label callouts that sit alongside small connector boxes;
 *  ceiling (48px) is well below the 96px title cap because once
 *  you're at 48px you should probably be using the (single, special)
 *  diagram title node instead. */
const TEXTBOX_FONT_MIN = 10;
const TEXTBOX_FONT_MAX = 48;

/** Build 115.1 — annotation card preset palette. Curated to read
 *  well as labels (light / muted fills) without competing with the
 *  device shapes for visual weight. `transparent` is the default
 *  ("just text, no card") and ships first so operators see the
 *  zero-decoration option as the obvious starting point. */
const TEXTBOX_BACKGROUND_PRESETS: Array<{
    value: string;
    label: string;
    swatch: string;
}> = [
    { value: 'transparent', label: 'None', swatch: 'transparent' },
    { value: '#ffffff', label: 'White', swatch: '#ffffff' },
    { value: '#f1f5f9', label: 'Slate 100', swatch: '#f1f5f9' },
    { value: '#fef3c7', label: 'Amber 100', swatch: '#fef3c7' },
    { value: '#dcfce7', label: 'Emerald 100', swatch: '#dcfce7' },
    { value: '#dbeafe', label: 'Sky 100', swatch: '#dbeafe' },
    { value: '#fce7f3', label: 'Rose 100', swatch: '#fce7f3' },
];

const TEXTBOX_BORDER_PRESETS: Array<{ value: string; label: string }> = [
    { value: 'none', label: 'None' },
    { value: '1px solid #cbd5e1', label: 'Light' },
    { value: '1px solid #64748b', label: 'Medium' },
    { value: '1.5px dashed #94a3b8', label: 'Dashed' },
    { value: '2px solid #0f172a', label: 'Bold' },
];

const TEXTBOX_ALIGN_OPTIONS: Array<{ id: TextBoxAlign; label: string }> = [
    { id: 'left', label: 'Left' },
    { id: 'center', label: 'Center' },
    { id: 'right', label: 'Right' },
];

const TextBoxPropertiesForm: React.FC<{
    node: RFNode;
    onApply: (update: TextBoxUpdate) => void;
    onApplyComplete?: () => void;
    onDelete: (id: string) => void;
}> = ({ node, onApply, onApplyComplete, onDelete }) => {
    const data = (node.data ?? {}) as Partial<TextBoxNodeData>;
    const initialText = data.text ?? '';
    const initialFontSize =
        typeof data.fontSize === 'number'
            ? Math.min(
                  TEXTBOX_FONT_MAX,
                  Math.max(TEXTBOX_FONT_MIN, data.fontSize)
              )
            : 14;
    const initialColor =
        typeof data.color === 'string' && data.color.startsWith('#')
            ? data.color
            : '#0f172a';
    const initialBold = data.bold === true;
    const initialItalic = data.italic === true;
    const initialBackground =
        typeof data.background === 'string' ? data.background : 'transparent';
    const initialBorder = typeof data.border === 'string' ? data.border : 'none';
    const initialAlign: TextBoxAlign = data.align ?? 'left';

    const [text, setText] = useState<string>(initialText);
    const [fontSize, setFontSize] = useState<number>(initialFontSize);
    const [color, setColor] = useState<string>(initialColor);
    const [bold, setBold] = useState<boolean>(initialBold);
    const [italic, setItalic] = useState<boolean>(initialItalic);
    const [background, setBackground] = useState<string>(initialBackground);
    const [border, setBorder] = useState<string>(initialBorder);
    const [align, setAlign] = useState<TextBoxAlign>(initialAlign);

    useEffect(() => {
        setText(initialText);
        setFontSize(initialFontSize);
        setColor(initialColor);
        setBold(initialBold);
        setItalic(initialItalic);
        setBackground(initialBackground);
        setBorder(initialBorder);
        setAlign(initialAlign);
    }, [
        initialText,
        initialFontSize,
        initialColor,
        initialBold,
        initialItalic,
        initialBackground,
        initialBorder,
        initialAlign,
    ]);

    const handleApply = (): void => {
        onApply({
            id: node.id,
            kind: 'textbox',
            text,
            fontSize: Math.min(
                TEXTBOX_FONT_MAX,
                Math.max(TEXTBOX_FONT_MIN, fontSize)
            ),
            color,
            bold,
            italic,
            background,
            border,
            align,
        });
        onApplyComplete?.();
    };

    return (
        <>
            <SectionHeader>Annotation text</SectionHeader>
            <Field label="Content">
                <textarea
                    className={cn(inputClass, 'min-h-[60px] resize-y')}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="e.g. REST API — TCP 8089"
                    autoFocus
                />
            </Field>

            <SectionHeader>Typography</SectionHeader>
            <Field label={`Font size — ${fontSize}px`}>
                <input
                    type="range"
                    min={TEXTBOX_FONT_MIN}
                    max={TEXTBOX_FONT_MAX}
                    step={1}
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                    className="w-full accent-sky-500"
                    aria-label="Font size"
                />
            </Field>
            <Field label="Style">
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={() => setBold((b) => !b)}
                        title="Toggle bold"
                        aria-pressed={bold}
                        className={cn(
                            'flex items-center justify-center w-8 h-7 rounded border text-xs font-medium transition-colors',
                            bold
                                ? 'bg-sky-50 dark:bg-sky-900/30 border-sky-300 dark:border-sky-700 text-sky-700 dark:text-sky-300'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                        )}
                    >
                        <Bold className="w-3.5 h-3.5" aria-hidden />
                    </button>
                    <button
                        type="button"
                        onClick={() => setItalic((i) => !i)}
                        title="Toggle italic"
                        aria-pressed={italic}
                        className={cn(
                            'flex items-center justify-center w-8 h-7 rounded border text-xs font-medium transition-colors',
                            italic
                                ? 'bg-sky-50 dark:bg-sky-900/30 border-sky-300 dark:border-sky-700 text-sky-700 dark:text-sky-300'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                        )}
                    >
                        <Italic className="w-3.5 h-3.5" aria-hidden />
                    </button>
                </div>
            </Field>
            <Field label="Alignment">
                <div className="flex items-center gap-1">
                    {TEXTBOX_ALIGN_OPTIONS.map((opt) => (
                        <button
                            key={opt.id}
                            type="button"
                            onClick={() => setAlign(opt.id)}
                            aria-pressed={align === opt.id}
                            className={cn(
                                'flex-1 px-2 py-1 rounded border text-xs font-medium transition-colors',
                                align === opt.id
                                    ? 'bg-sky-50 dark:bg-sky-900/30 border-sky-300 dark:border-sky-700 text-sky-700 dark:text-sky-300'
                                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                            )}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </Field>

            <SectionHeader>Text colour</SectionHeader>
            <Field label="Preset palette">
                <div className="flex items-center gap-1.5 flex-wrap">
                    {TITLE_COLOR_PRESETS.map((p) => {
                        const active = color.toLowerCase() === p.value.toLowerCase();
                        return (
                            <button
                                key={p.value}
                                type="button"
                                title={p.label}
                                aria-label={p.label}
                                aria-pressed={active}
                                onClick={() => setColor(p.value)}
                                className={cn(
                                    'w-6 h-6 rounded-full border-2 transition-transform',
                                    active
                                        ? 'border-sky-400 scale-110 shadow-sm'
                                        : 'border-white dark:border-slate-800 hover:scale-105'
                                )}
                                style={{ backgroundColor: p.value }}
                            />
                        );
                    })}
                </div>
            </Field>
            <Field label="Custom hex">
                <input
                    type="text"
                    className={cn(inputClass, 'font-mono')}
                    value={color}
                    onChange={(e) => {
                        const v = e.target.value.trim();
                        setColor(v || '#0f172a');
                    }}
                    placeholder="#0f172a"
                />
            </Field>

            <SectionHeader>Card surface</SectionHeader>
            <Field label="Background">
                <div className="flex items-center gap-1.5 flex-wrap">
                    {TEXTBOX_BACKGROUND_PRESETS.map((p) => {
                        const active = background === p.value;
                        return (
                            <button
                                key={p.value}
                                type="button"
                                title={p.label}
                                aria-label={p.label}
                                aria-pressed={active}
                                onClick={() => setBackground(p.value)}
                                className={cn(
                                    'w-6 h-6 rounded-full border transition-transform',
                                    active
                                        ? 'border-sky-400 scale-110 shadow-sm'
                                        : 'border-slate-300 dark:border-slate-600 hover:scale-105',
                                    p.value === 'transparent' &&
                                        'bg-[conic-gradient(at_top_left,_#fff_25%,_#e2e8f0_25%_50%,_#fff_50%_75%,_#e2e8f0_75%)] bg-[length:8px_8px]'
                                )}
                                style={
                                    p.value === 'transparent'
                                        ? undefined
                                        : { backgroundColor: p.swatch }
                                }
                            />
                        );
                    })}
                </div>
            </Field>
            <Field label="Border">
                <select
                    className={inputClass}
                    value={border}
                    onChange={(e) => setBorder(e.target.value)}
                >
                    {TEXTBOX_BORDER_PRESETS.map((p) => (
                        <option key={p.value} value={p.value}>
                            {p.label}
                        </option>
                    ))}
                </select>
            </Field>

            <div className="flex items-center gap-2 px-3 py-3 border-t border-slate-200 dark:border-slate-800">
                <button
                    type="button"
                    onClick={handleApply}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-sky-500 hover:bg-sky-600 text-white shadow-sm"
                >
                    <Save className="w-3.5 h-3.5" aria-hidden /> Apply
                </button>
                <button
                    type="button"
                    onClick={() => onDelete(node.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border border-rose-300 dark:border-rose-700 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30"
                >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden /> Remove
                </button>
            </div>
        </>
    );
};

/** Build 113: Edge direction options for the segmented control.
 *  The Lucide icon set (Minus / ArrowRight / ArrowLeft /
 *  ArrowLeftRight) lets each option read at a glance even at the
 *  small button size used in the inspector. */
const EDGE_DIRECTION_OPTIONS: Array<{
    id: EdgeDirection;
    label: string;
    icon: SuiIcon;
    hint: string;
}> = [
    { id: 'none', label: 'No arrow', icon: Minus, hint: 'Plain line' },
    {
        id: 'forward',
        label: 'Source → Target',
        icon: ArrowRight,
        hint: 'Arrowhead at target',
    },
    {
        id: 'backward',
        label: 'Target → Source',
        icon: ArrowLeft,
        hint: 'Arrowhead at source',
    },
    {
        id: 'both',
        label: 'Bi-directional',
        icon: ArrowLeftRight,
        hint: 'Arrowheads at both ends',
    },
];

/** Build 114: animation colour swatches for the edge inspector.
 *  Same palette + format as the title-colour picker so operators
 *  see one cohesive design language across the inspector. */
const EDGE_ANIMATION_COLOR_PRESETS: Array<{ value: string; label: string }> = [
    { value: '#0ea5e9', label: 'Sky (default)' },
    { value: '#10b981', label: 'Emerald' },
    { value: '#f59e0b', label: 'Amber' },
    { value: '#f43f5e', label: 'Rose' },
    { value: '#8b5cf6', label: 'Violet' },
    { value: '#64748b', label: 'Slate' },
];

/** Build 115.5 — preset palette for the edge LINE colour. We pick
 *  hues that read against both light and dark canvases at the
 *  default stroke width (1.5px). The slate value matches
 *  `edgeStyleForKind('physical')` so "Slate" is a one-click way
 *  to revert a custom-coloured edge to the physical default
 *  without going through Auto. */
const EDGE_LINE_COLOR_PRESETS: Array<{ value: string; label: string }> = [
    { value: '#475569', label: 'Slate (default)' },
    { value: '#0ea5e9', label: 'Sky' },
    { value: '#10b981', label: 'Emerald' },
    { value: '#f59e0b', label: 'Amber' },
    { value: '#f43f5e', label: 'Rose' },
    { value: '#8b5cf6', label: 'Violet' },
];

/** Build 115.11 — arrow tip glyph options for the edge inspector.
 *  These mirror the keys in `ARROWHEADS_BY_STYLE` on the canvas
 *  side; keep them in sync when adding new glyphs. */
const ARROW_STYLE_OPTIONS: Array<{
    id: ArrowStyle;
    label: string;
    hint: string;
}> = [
    { id: 'thin', label: 'Thin chevron', hint: 'Default — subtle, minimal' },
    { id: 'open', label: 'Open chevron', hint: 'Lighter look' },
    { id: 'closed', label: 'Filled dart', hint: 'Filled directional tip' },
    { id: 'dot', label: 'Dot', hint: 'Circle terminator' },
    { id: 'diamond', label: 'Diamond', hint: 'Filled rhombus' },
];

const EdgePropertiesForm: React.FC<{
    edge: RFEdge;
    onApply: (update: EdgeUpdate) => void;
    onDelete: (id: string) => void;
}> = ({ edge, onApply, onDelete }) => {
    const data = (edge.data ?? {}) as {
        edge?: { kind?: EdgeUpdate['kind']; label?: string };
        kind?: EdgeUpdate['kind'];
        direction?: EdgeDirection;
        arrowStyle?: ArrowStyle;
        liveStatus?: boolean;
        animationColor?: string;
        lineColor?: string;
        notes?: string;
    };
    const initialKind = (data.kind ?? data.edge?.kind ?? 'physical') as EdgeUpdate['kind'];
    const initialDirection = (data.direction ?? 'none') as EdgeDirection;
    const initialArrowStyle: ArrowStyle = (data.arrowStyle as ArrowStyle) ?? 'thin';
    const initialLiveStatus = data.liveStatus === true;
    const initialLabel =
        typeof edge.label === 'string' ? edge.label : data.edge?.label ?? '';
    const initialNotes = data.notes ?? '';
    const initialAnimationColor = data.animationColor ?? '';
    const initialLineColor = data.lineColor ?? '';

    const [label, setLabel] = useState<string>(initialLabel);
    const [kind, setKind] = useState<EdgeUpdate['kind']>(initialKind);
    const [direction, setDirection] = useState<EdgeDirection>(initialDirection);
    const [arrowStyle, setArrowStyle] = useState<ArrowStyle>(initialArrowStyle);
    const [liveStatus, setLiveStatus] = useState<boolean>(initialLiveStatus);
    const [animationColor, setAnimationColor] =
        useState<string>(initialAnimationColor);
    const [lineColor, setLineColor] = useState<string>(initialLineColor);
    const [notes, setNotes] = useState<string>(initialNotes);

    useEffect(() => {
        setLabel(initialLabel);
        setKind(initialKind);
        setDirection(initialDirection);
        setArrowStyle(initialArrowStyle);
        setLiveStatus(initialLiveStatus);
        setAnimationColor(initialAnimationColor);
        setLineColor(initialLineColor);
        setNotes(initialNotes);
    }, [
        initialLabel,
        initialKind,
        initialDirection,
        initialArrowStyle,
        initialLiveStatus,
        initialAnimationColor,
        initialLineColor,
        initialNotes,
    ]);

    /** Build 115.5 — live preview. Every setter goes through this
     *  helper so the canvas mirrors the inspector immediately
     *  (operators asked: "let me see the change before I save").
     *  We pass the FULL set of current fields each time so the
     *  canvas's `handleEdgeUpdate` gets a complete picture and
     *  doesn't have to reason about partial updates. The Save
     *  button on the page header still controls persistence to
     *  network_diagrams.conf — this only mutates the in-memory
     *  canvas state. */
    const commit = (overrides: Partial<EdgeUpdate>): void => {
        onApply({
            id: edge.id,
            label,
            kind,
            direction,
            arrowStyle,
            liveStatus,
            animationColor: animationColor.trim(),
            lineColor: lineColor.trim(),
            notes,
            ...overrides,
        });
    };

    // Animation only renders when the edge has a direction; we
    // dim the colour controls when direction='none' to make the
    // dependency obvious instead of leaving the picker live but
    // visually inert.
    const animationActive = direction !== 'none';

    return (
        <>
            <SectionHeader>Endpoints</SectionHeader>
            <div className="px-3 pb-1 space-y-1 text-xs text-slate-700 dark:text-slate-300">
                <div>
                    <span className="font-medium text-slate-500 dark:text-slate-400">Source:</span>{' '}
                    <code className="font-mono">{edge.source}</code>
                </div>
                <div>
                    <span className="font-medium text-slate-500 dark:text-slate-400">Target:</span>{' '}
                    <code className="font-mono">{edge.target}</code>
                </div>
            </div>

            <SectionHeader>Edge kind</SectionHeader>
            <Field label="Relationship">
                <select
                    className={inputClass}
                    value={kind}
                    onChange={(e) => {
                        const next = e.target.value as EdgeUpdate['kind'];
                        setKind(next);
                        commit({ kind: next });
                    }}
                >
                    {EDGE_KIND_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                            {opt.label}
                        </option>
                    ))}
                </select>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {EDGE_KIND_OPTIONS.find((o) => o.id === kind)?.hint}
                </p>
            </Field>

            <SectionHeader>Direction</SectionHeader>
            <Field label="Arrowheads">
                <div
                    className="flex items-stretch gap-0.5 p-0.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40"
                    role="radiogroup"
                    aria-label="Edge direction"
                >
                    {EDGE_DIRECTION_OPTIONS.map((opt) => {
                        const Icon = opt.icon;
                        const active = direction === opt.id;
                        return (
                            <button
                                key={opt.id}
                                type="button"
                                role="radio"
                                aria-checked={active}
                                title={`${opt.label} — ${opt.hint}`}
                                onClick={() => {
                                    setDirection(opt.id);
                                    commit({ direction: opt.id });
                                }}
                                className={cn(
                                    'flex-1 flex items-center justify-center px-2 py-1 rounded text-xs font-medium transition-colors',
                                    active
                                        ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-sm border border-sky-200 dark:border-sky-700'
                                        : 'text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-900/40 border border-transparent'
                                )}
                            >
                                <Icon className="w-3.5 h-3.5" aria-hidden />
                            </button>
                        );
                    })}
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {EDGE_DIRECTION_OPTIONS.find((o) => o.id === direction)?.hint}
                </p>
            </Field>

            {/* Build 115.11 — arrow tip glyph picker. Only meaningful
             *  when an arrow is shown (direction !== 'none'); we
             *  dim it otherwise rather than hiding it so operators
             *  can preview their choice before re-enabling
             *  arrowheads. */}
            <Field label="Arrow style">
                <select
                    className={cn(
                        inputClass,
                        direction === 'none' && 'opacity-50'
                    )}
                    value={arrowStyle}
                    onChange={(e) => {
                        const next = e.target.value as ArrowStyle;
                        setArrowStyle(next);
                        commit({ arrowStyle: next });
                    }}
                    disabled={direction === 'none'}
                >
                    {ARROW_STYLE_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                            {opt.label}
                        </option>
                    ))}
                </select>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {ARROW_STYLE_OPTIONS.find((o) => o.id === arrowStyle)
                        ?.hint ?? ''}
                </p>
            </Field>

            {/* Build 115.11 — live-status toggle. When ON, the
             *  edge stroke is recoloured by the bound-host
             *  reporting status of its endpoints (green / red),
             *  mirroring the site connector animation in the
             *  Florida overview dashboard. Override stays
             *  available — the toggle just decides whether the
             *  operator's `lineColor` or live status wins. */}
            <Field label="Live status">
                <button
                    type="button"
                    role="switch"
                    aria-checked={liveStatus}
                    onClick={() => {
                        const next = !liveStatus;
                        setLiveStatus(next);
                        commit({ liveStatus: next });
                    }}
                    className={cn(
                        'inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-xs transition-colors w-full justify-start',
                        liveStatus
                            ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300'
                            : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    )}
                    title={
                        liveStatus
                            ? 'On — line glows green when both ends are reporting, red when either is silent.'
                            : 'Off — line uses the colour you pick below.'
                    }
                >
                    <Activity
                        className={cn(
                            'w-3.5 h-3.5',
                            liveStatus
                                ? 'text-emerald-500'
                                : 'text-slate-400'
                        )}
                        aria-hidden
                    />
                    <span className="font-medium">
                        {liveStatus ? 'Reporting from hosts' : 'Static colour'}
                    </span>
                </button>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Recolour the line based on live <code>| metadata</code> activity for bound endpoints — green when reporting, red when stale.
                </p>
            </Field>

            {/* Build 115.5 — line colour. Tints the stroke
                itself, distinct from the flowing-dot animation
                colour. Operators asked for this so they can
                colour-code by L2 / L3 / VRF / fabric in the same
                diagram. Active even when direction='none' since
                a stroke colour reads regardless of arrows. */}
            <SectionHeader>Line colour</SectionHeader>
            <Field label="Stroke colour">
                <div className="flex items-center gap-1.5 flex-wrap">
                    {EDGE_LINE_COLOR_PRESETS.map((p) => {
                        const active =
                            lineColor.toLowerCase() === p.value.toLowerCase();
                        return (
                            <button
                                key={p.value}
                                type="button"
                                title={p.label}
                                aria-label={p.label}
                                aria-pressed={active}
                                onClick={() => {
                                    setLineColor(p.value);
                                    commit({ lineColor: p.value });
                                }}
                                className={cn(
                                    'w-6 h-6 rounded-full border-2 transition-transform',
                                    active
                                        ? 'border-sky-400 scale-110 shadow-sm'
                                        : 'border-white dark:border-slate-800 hover:scale-105'
                                )}
                                style={{ backgroundColor: p.value }}
                            />
                        );
                    })}
                    <button
                        type="button"
                        onClick={() => {
                            setLineColor('');
                            commit({ lineColor: '' });
                        }}
                        title="Use the per-kind default line colour"
                        className={cn(
                            'h-6 px-2 rounded-full text-xs font-medium border transition-colors',
                            lineColor === ''
                                ? 'bg-sky-50 dark:bg-sky-900/30 border-sky-300 dark:border-sky-700 text-sky-700 dark:text-sky-300'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300'
                        )}
                    >
                        Auto
                    </button>
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {lineColor
                        ? `Custom colour ${lineColor}`
                        : 'Auto — colour matches the edge kind.'}
                </p>
            </Field>

            <SectionHeader>Animation</SectionHeader>
            <Field label="Flowing-dot colour">
                <div
                    className={cn(
                        'flex items-center gap-1.5 flex-wrap',
                        !animationActive && 'opacity-50 pointer-events-none'
                    )}
                    aria-disabled={!animationActive}
                >
                    {EDGE_ANIMATION_COLOR_PRESETS.map((p) => {
                        const active =
                            animationColor.toLowerCase() === p.value.toLowerCase();
                        return (
                            <button
                                key={p.value}
                                type="button"
                                title={p.label}
                                aria-label={p.label}
                                aria-pressed={active}
                                onClick={() => {
                                    setAnimationColor(p.value);
                                    commit({ animationColor: p.value });
                                }}
                                className={cn(
                                    'w-6 h-6 rounded-full border-2 transition-transform',
                                    active
                                        ? 'border-sky-400 scale-110 shadow-sm'
                                        : 'border-white dark:border-slate-800 hover:scale-105'
                                )}
                                style={{ backgroundColor: p.value }}
                            />
                        );
                    })}
                    <button
                        type="button"
                        onClick={() => {
                            setAnimationColor('');
                            commit({ animationColor: '' });
                        }}
                        title="Use the per-kind default colour"
                        className={cn(
                            'h-6 px-2 rounded-full text-xs font-medium border transition-colors',
                            animationColor === ''
                                ? 'bg-sky-50 dark:bg-sky-900/30 border-sky-300 dark:border-sky-700 text-sky-700 dark:text-sky-300'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300'
                        )}
                    >
                        Auto
                    </button>
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {animationActive
                        ? animationColor
                            ? `Custom colour ${animationColor}`
                            : 'Auto — colour matches the edge kind.'
                        : 'Pick a direction above to show the flowing-dot animation.'}
                </p>
            </Field>

            <SectionHeader>Label</SectionHeader>
            <Field label="Midpoint label (e.g. 100 Mbps, vlan 50)">
                <input
                    className={inputClass}
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    onBlur={() => commit({ label })}
                    placeholder=""
                />
            </Field>

            <SectionHeader>Notes</SectionHeader>
            <Field label="Operator notes">
                <textarea
                    className={cn(inputClass, 'min-h-[64px] resize-y')}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    onBlur={() => commit({ notes })}
                    placeholder=""
                />
            </Field>

            <SectionHeader>Provenance</SectionHeader>
            <div className="px-3 pb-2 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                <div>
                    <span className="font-medium">ID:</span>{' '}
                    <code className="font-mono">{edge.id}</code>
                </div>
                <div className="text-xs italic pt-1">
                    {/* Build 115.5 — edge changes preview live on
                        the canvas; the page header's Save still
                        controls persistence to the conf file. */}
                    Edits preview live on the canvas. Click the
                    page header&apos;s <strong>Save</strong> to persist to{' '}
                    <code className="font-mono">network_diagrams.conf</code>.
                </div>
            </div>

            <div className="flex items-center gap-2 px-3 py-3 border-t border-slate-200 dark:border-slate-800">
                <button
                    type="button"
                    onClick={() => onDelete(edge.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border border-rose-300 dark:border-rose-700 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30"
                >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden /> Remove
                </button>
            </div>
        </>
    );
};

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
    selection,
    onClose,
    assetIndex,
    onNodeUpdate,
    onTitleUpdate,
    onRegionUpdate,
    onTextBoxUpdate,
    onEdgeUpdate,
    onDelete,
}) => {
    if (!selection) return null;

    // Build 113: title nodes route to a different form than device
    // nodes. The discriminator is the React Flow node `type`.
    // Build 115: region nodes route to a third form (rename + accent).
    // Build 115.1: textbox nodes route to a fourth form (text + style).
    const isTitleNode =
        selection.kind === 'node' && selection.node.type === DIAGRAM_TITLE_NODE_TYPE;
    const isRegionNode =
        selection.kind === 'node' && selection.node.type === 'regionGroup';
    const isTextBoxNode =
        selection.kind === 'node' && selection.node.type === TEXT_BOX_NODE_TYPE;

    const headerText = isTitleNode
        ? 'Title properties'
        : isRegionNode
          ? 'Region properties'
          : isTextBoxNode
            ? 'Text box properties'
            : selection.kind === 'node'
              ? 'Node properties'
              : 'Edge properties';

    return (
        <aside
            className={cn(
                'absolute top-3 right-3 bottom-3 z-20 flex flex-col w-[300px]',
                'rounded-xl border border-slate-200 dark:border-slate-800',
                'bg-white dark:bg-slate-900 shadow-xl overflow-hidden'
            )}
            role="dialog"
            aria-label={headerText}
        >
            <header className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-800">
                <h2 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {headerText}
                </h2>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close properties panel"
                    className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400"
                >
                    <X className="w-3.5 h-3.5" aria-hidden />
                </button>
            </header>
            <div className="flex-1 overflow-y-auto">
                {selection.kind === 'node' && isTitleNode && onTitleUpdate ? (
                    <TitlePropertiesForm
                        node={selection.node}
                        onApply={onTitleUpdate}
                        onApplyComplete={onClose}
                        onDelete={(id) => onDelete(id, 'node')}
                    />
                ) : selection.kind === 'node' && isRegionNode && onRegionUpdate ? (
                    <RegionPropertiesForm
                        node={selection.node}
                        onApply={onRegionUpdate}
                        onApplyComplete={onClose}
                        onDelete={(id) => onDelete(id, 'node')}
                    />
                ) : selection.kind === 'node' && isTextBoxNode && onTextBoxUpdate ? (
                    <TextBoxPropertiesForm
                        node={selection.node}
                        onApply={onTextBoxUpdate}
                        onApplyComplete={onClose}
                        onDelete={(id) => onDelete(id, 'node')}
                    />
                ) : selection.kind === 'node' ? (
                    <NodePropertiesForm
                        node={selection.node}
                        onApply={onNodeUpdate}
                        onApplyComplete={onClose}
                        onDelete={(id) => onDelete(id, 'node')}
                        assetIndex={assetIndex}
                    />
                ) : (
                    <EdgePropertiesForm
                        edge={selection.edge}
                        onApply={onEdgeUpdate}
                        onDelete={(id) => onDelete(id, 'edge')}
                    />
                )}
            </div>
        </aside>
    );
};
