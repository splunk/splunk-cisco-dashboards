/**
 * Topology canvas shape library — Build 105 rewrite.
 *
 * Build 104 (the spike) used lucide-react icons inside a pill-style
 * card. Per Alan's feedback ("a wall of pills doesn't look like a
 * topology diagram"), Build 105 promotes the device icon to the
 * primary visual element using inline Cisco-style SVGs from
 * `ciscoIcons.tsx`. The new shape geometry mirrors the look of an
 * actual Visio Cisco network diagram:
 *
 *   ┌────────────────────┐
 *   │   [ icon SVG ]     │  ← icon dominates the upper 2/3 of the card
 *   │     ●              │  ← status dot top-right
 *   ├────────────────────┤
 *   │  short-label       │  ← bold device name
 *   │  device_type       │  ← muted secondary
 *   └────────────────────┘
 *
 * Status outline + status dot ride on the card border, NOT the icon
 * itself, so the icon's intrinsic Cisco branding stays clean.
 *
 * Edge-drawing UX (also new in Build 105):
 *   - Handles on all four sides (Top / Right / Bottom / Left).
 *   - Handles are visually small at rest and grow on node hover so
 *     operators discover the connection points without clutter.
 *   - `isConnectable={true}` so dragging from any handle creates a
 *     new edge — wired to the canvas's `onConnect` handler which
 *     opens the Build 105 properties panel for the new edge.
 *   - Each shape exposes BOTH a source and target handle on every
 *     side; React Flow picks based on drag direction.
 */

import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { cn } from '@/common/lib/utils';
import type {
    HealthStatus,
    TopologyDiscoveredNode,
    DeviceShapeId,
} from '@/common/services/topologyDiscovery';
import { CISCO_ICONS } from './ciscoIcons';

interface ShapeData {
    node: TopologyDiscoveredNode;
}

const STATUS_PRESETS: Record<
    HealthStatus,
    {
        ring: string;
        dot: string;
        accent: string;
        label: string;
    }
> = {
    healthy: {
        ring: 'ring-emerald-500/60 border-emerald-500/30',
        dot: 'bg-emerald-500',
        accent: 'text-emerald-600 dark:text-emerald-400',
        label: 'Healthy',
    },
    warning: {
        ring: 'ring-amber-500/70 border-amber-500/40',
        dot: 'bg-amber-500',
        accent: 'text-amber-600 dark:text-amber-400',
        label: 'Warning',
    },
    critical: {
        ring: 'ring-rose-500/80 border-rose-500/50',
        dot: 'bg-rose-500',
        accent: 'text-rose-600 dark:text-rose-400',
        label: 'Critical',
    },
    unknown: {
        ring: 'ring-slate-400/40 border-slate-300/60 dark:border-slate-700/60',
        dot: 'bg-slate-400',
        accent: 'text-slate-500 dark:text-slate-400',
        label: 'No telemetry',
    },
};

/** Map shape ids to icons. Single source of truth so adding a new
 *  shape (e.g. a future `load_balancer`) means one new entry here
 *  + one new SVG in `ciscoIcons.tsx` + one new branch in
 *  `mapDeviceTypeToShape`. */
const SHAPE_TO_ICON: Record<DeviceShapeId, keyof typeof CISCO_ICONS> = {
    switch: 'switch',
    l3_switch: 'l3_switch',
    router: 'router',
    firewall: 'firewall',
    wlc: 'wlc',
    access_point: 'access_point',
    server: 'server',
    cloud: 'cloud',
    generic: 'generic',
};

/** Connection handles on all four sides. Each side gets BOTH a
 *  `source` and `target` handle so React Flow can attach edges in
 *  either direction. They share an id-prefix per side so the
 *  properties panel can record "left port" vs "right port" later
 *  if we want directional edge routing. */
const NodeHandles: React.FC = () => {
    const sides: Array<{ pos: Position; id: string; style: React.CSSProperties }> = [
        { pos: Position.Top, id: 'top', style: { top: -4 } },
        { pos: Position.Right, id: 'right', style: { right: -4 } },
        { pos: Position.Bottom, id: 'bottom', style: { bottom: -4 } },
        { pos: Position.Left, id: 'left', style: { left: -4 } },
    ];
    return (
        <>
            {sides.map((s) => (
                <React.Fragment key={s.id}>
                    <Handle
                        type="source"
                        position={s.pos}
                        id={`${s.id}-source`}
                        className="!w-2.5 !h-2.5 !bg-sky-500 !border-2 !border-white dark:!border-slate-900 opacity-0 group-hover:opacity-100 transition-opacity"
                        style={s.style}
                    />
                    <Handle
                        type="target"
                        position={s.pos}
                        id={`${s.id}-target`}
                        className="!w-2.5 !h-2.5 !bg-sky-400 !border-2 !border-white dark:!border-slate-900 opacity-0 group-hover:opacity-100 transition-opacity"
                        style={s.style}
                    />
                </React.Fragment>
            ))}
        </>
    );
};

const DeviceShape: React.FC<{ data: ShapeData; selected?: boolean }> = ({
    data,
    selected,
}) => {
    const { node } = data;
    const status = STATUS_PRESETS[node.status];
    const iconId = SHAPE_TO_ICON[node.shape] ?? 'generic';
    const Icon = CISCO_ICONS[iconId];
    const detail =
        (node.raw['device_type'] as string | undefined) ??
        (node.raw['platform_id'] as string | undefined) ??
        node.shape;

    return (
        <div
            className={cn(
                'group relative flex flex-col items-stretch rounded-lg border bg-white dark:bg-slate-900',
                'shadow-sm transition-all hover:shadow-md',
                'ring-2 ring-offset-1 dark:ring-offset-slate-950',
                status.ring,
                selected &&
                    'shadow-lg outline outline-2 outline-sky-500/70 outline-offset-2'
            )}
            style={{ width: 100, height: 110 }}
            title={`${node.label}\nStatus: ${status.label}${
                node.healthScore !== undefined ? ` (${node.healthScore})` : ''
            }${node.managementSource ? `\nSource: ${node.managementSource}` : ''}`}
        >
            <NodeHandles />
            {/* Icon area — top 2/3 */}
            <div className="flex-1 flex items-center justify-center px-2 pt-2 pb-1 relative">
                <Icon className={cn('w-12 h-12', status.accent)} />
                {/* Status dot, top-right */}
                <span
                    className={cn(
                        'absolute top-1.5 right-1.5 w-2 h-2 rounded-full',
                        status.dot
                    )}
                    aria-label={status.label}
                />
            </div>
            {/* Label area — bottom 1/3, separated by a hairline */}
            <div className="border-t border-slate-200 dark:border-slate-800 px-2 py-1 leading-tight">
                <div className="text-[10px] font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {node.shortLabel}
                </div>
                <div className="text-[8px] text-slate-500 dark:text-slate-400 truncate uppercase tracking-wide">
                    {detail}
                </div>
            </div>
        </div>
    );
};

export const SwitchShape = DeviceShape;
export const RouterShape = DeviceShape;
export const FirewallShape = DeviceShape;
export const WlcShape = DeviceShape;
export const AccessPointShape = DeviceShape;
export const ServerShape = DeviceShape;
export const CloudShape = DeviceShape;
export const GenericShape = DeviceShape;
export const L3SwitchShape = DeviceShape;

/** Parent zone container — visual chrome for grouping devices by
 *  customer site. Non-draggable, non-clickable, no handles. */
export const TopologyZoneNode: React.FC<{
    data: { label: string; isUnsited: boolean; deviceCount: number };
}> = ({ data }) => (
    <div
        className={cn(
            'rounded-xl border-2 border-dashed bg-slate-50/60 dark:bg-slate-900/40',
            data.isUnsited
                ? 'border-amber-400/60 dark:border-amber-500/40'
                : 'border-slate-300/70 dark:border-slate-700/70'
        )}
        style={{ width: '100%', height: '100%' }}
    >
        <div className="flex items-center justify-between px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
            <span className="truncate">{data.label}</span>
            <span className="ml-2 px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 text-[9px]">
                {data.deviceCount}
            </span>
        </div>
    </div>
);

export const TOPOLOGY_NODE_TYPES = {
    'device:switch': SwitchShape,
    'device:l3_switch': L3SwitchShape,
    'device:router': RouterShape,
    'device:firewall': FirewallShape,
    'device:wlc': WlcShape,
    'device:access_point': AccessPointShape,
    'device:server': ServerShape,
    'device:cloud': CloudShape,
    'device:generic': GenericShape,
    topologyZone: TopologyZoneNode,
} as const;
