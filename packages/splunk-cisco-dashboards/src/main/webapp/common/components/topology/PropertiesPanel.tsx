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

import React, { useEffect, useState } from 'react';
import { X, Trash2, Save } from 'lucide-react';
import { cn } from '@/common/lib/utils';
import type {
    Node as RFNode,
    Edge as RFEdge,
} from '@xyflow/react';
import type { DeviceShapeId } from '@/common/services/topologyDiscovery';

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
}

export interface EdgeUpdate {
    id: string;
    label?: string;
    kind?: 'physical' | 'synthetic_a2a' | 'logical';
    notes?: string;
}

interface PropertiesPanelProps {
    selection: Selection;
    onClose: () => void;
    onNodeUpdate: (update: NodeUpdate) => void;
    onEdgeUpdate: (update: EdgeUpdate) => void;
    onDelete: (id: string, kind: 'node' | 'edge') => void;
}

const DEVICE_SHAPE_OPTIONS: Array<{ id: DeviceShapeId; label: string }> = [
    { id: 'router', label: 'Router' },
    { id: 'switch', label: 'L2 Switch' },
    { id: 'l3_switch', label: 'L3 Switch' },
    { id: 'firewall', label: 'Firewall' },
    { id: 'wlc', label: 'Wireless LAN Controller' },
    { id: 'access_point', label: 'Access Point' },
    { id: 'server', label: 'Server' },
    { id: 'cloud', label: 'Cloud / WAN' },
    { id: 'generic', label: 'Generic' },
];

const EDGE_KIND_OPTIONS: Array<{ id: EdgeUpdate['kind']; label: string; hint: string }> = [
    { id: 'physical', label: 'Physical link', hint: 'Solid grey — port-to-port (CDP/LLDP)' },
    { id: 'synthetic_a2a', label: 'Synthetic (TE A2A)', hint: 'Dashed sky-blue — measurement path' },
    { id: 'logical', label: 'Logical adjacency', hint: 'Dotted slate — BGP/OSPF/EIGRP peer' },
];

const SectionHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-3 pt-3 pb-1">
        {children}
    </div>
);

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div className="px-3 py-1.5">
        <label className="block text-[10px] font-medium text-slate-600 dark:text-slate-400 mb-1">
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

const NodePropertiesForm: React.FC<{
    node: RFNode;
    onApply: (update: NodeUpdate) => void;
    onDelete: (id: string) => void;
}> = ({ node, onApply, onDelete }) => {
    const data = (node.data ?? {}) as { node?: { shape?: DeviceShapeId; label?: string; shortLabel?: string; managementSource?: string }; notes?: string };
    const initialLabel = data.node?.label ?? '';
    const initialShortLabel = data.node?.shortLabel ?? '';
    const initialShape = (data.node?.shape ?? 'generic') as DeviceShapeId;
    const initialNotes = data.notes ?? '';

    const [label, setLabel] = useState<string>(initialLabel);
    const [shortLabel, setShortLabel] = useState<string>(initialShortLabel);
    const [shape, setShape] = useState<DeviceShapeId>(initialShape);
    const [notes, setNotes] = useState<string>(initialNotes);

    useEffect(() => {
        setLabel(initialLabel);
        setShortLabel(initialShortLabel);
        setShape(initialShape);
        setNotes(initialNotes);
    }, [initialLabel, initialShortLabel, initialShape, initialNotes]);

    const handleApply = (): void => {
        onApply({ id: node.id, label, shortLabel, shape, notes });
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
            <div className="px-3 pb-2 space-y-1 text-[10px] text-slate-500 dark:text-slate-400">
                <div>
                    <span className="font-medium">ID:</span>{' '}
                    <code className="font-mono">{node.id}</code>
                </div>
                {data.node?.managementSource && (
                    <div>
                        <span className="font-medium">Source:</span> {data.node.managementSource}
                    </div>
                )}
                <div className="text-[9px] italic pt-1">
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

const EdgePropertiesForm: React.FC<{
    edge: RFEdge;
    onApply: (update: EdgeUpdate) => void;
    onDelete: (id: string) => void;
}> = ({ edge, onApply, onDelete }) => {
    const data = (edge.data ?? {}) as { edge?: { kind?: EdgeUpdate['kind']; label?: string }; notes?: string };
    const initialKind = (data.edge?.kind ?? 'physical') as EdgeUpdate['kind'];
    const initialLabel =
        typeof edge.label === 'string' ? edge.label : data.edge?.label ?? '';
    const initialNotes = data.notes ?? '';

    const [label, setLabel] = useState<string>(initialLabel);
    const [kind, setKind] = useState<EdgeUpdate['kind']>(initialKind);
    const [notes, setNotes] = useState<string>(initialNotes);

    useEffect(() => {
        setLabel(initialLabel);
        setKind(initialKind);
        setNotes(initialNotes);
    }, [initialLabel, initialKind, initialNotes]);

    const handleApply = (): void => {
        onApply({ id: edge.id, label, kind, notes });
    };

    return (
        <>
            <SectionHeader>Endpoints</SectionHeader>
            <div className="px-3 pb-1 space-y-1 text-[11px] text-slate-700 dark:text-slate-300">
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
                    onChange={(e) => setKind(e.target.value as EdgeUpdate['kind'])}
                >
                    {EDGE_KIND_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                            {opt.label}
                        </option>
                    ))}
                </select>
                <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                    {EDGE_KIND_OPTIONS.find((o) => o.id === kind)?.hint}
                </p>
            </Field>

            <SectionHeader>Label</SectionHeader>
            <Field label="Midpoint label (e.g. 100 Mbps, vlan 50)">
                <input
                    className={inputClass}
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder=""
                />
            </Field>

            <SectionHeader>Notes</SectionHeader>
            <Field label="Operator notes">
                <textarea
                    className={cn(inputClass, 'min-h-[64px] resize-y')}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder=""
                />
            </Field>

            <SectionHeader>Provenance</SectionHeader>
            <div className="px-3 pb-2 space-y-1 text-[10px] text-slate-500 dark:text-slate-400">
                <div>
                    <span className="font-medium">ID:</span>{' '}
                    <code className="font-mono">{edge.id}</code>
                </div>
                <div className="text-[9px] italic pt-1">
                    Edge persistence to{' '}
                    <code className="font-mono">network_topology_edges.csv</code> ships in
                    Build 106. For now edits live only in this browser session.
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
    onNodeUpdate,
    onEdgeUpdate,
    onDelete,
}) => {
    if (!selection) return null;

    const titleText =
        selection.kind === 'node' ? 'Node properties' : 'Edge properties';

    return (
        <aside
            className={cn(
                'absolute top-3 right-3 bottom-3 z-20 flex flex-col w-[300px]',
                'rounded-xl border border-slate-200 dark:border-slate-800',
                'bg-white dark:bg-slate-900 shadow-xl overflow-hidden'
            )}
            role="dialog"
            aria-label={titleText}
        >
            <header className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-800">
                <h2 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {titleText}
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
                {selection.kind === 'node' ? (
                    <NodePropertiesForm
                        node={selection.node}
                        onApply={onNodeUpdate}
                        onDelete={(id) => onDelete(id, 'node')}
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
