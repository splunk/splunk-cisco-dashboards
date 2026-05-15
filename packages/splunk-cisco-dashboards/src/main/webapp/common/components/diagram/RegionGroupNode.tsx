/**
 * RegionGroupNode — a labelled container node that the diagram
 * canvas uses to organise devices into named "rooms" (sites,
 * zones, network segments). Mirrors the boxed regions in the
 * Florida DEM v8 PDF reference: Tallahassee, Orlando, Blanding,
 * Data Center, etc.
 *
 * Visual model:
 *   ┌─────────────────────────────────────────────┐
 *   │ ▢ Tallahassee                          12 → │  ← header bar
 *   ├─────────────────────────────────────────────┤
 *   │                                             │
 *   │           (devices live in here)            │
 *   │                                             │
 *   └─────────────────────────────────────────────┘
 *
 * Behavioural model:
 *   • The node is registered with `type: 'regionGroup'` in the
 *     React Flow node-types map. Other nodes (devices) can be
 *     made children by setting `parentId` and `extent: 'parent'`,
 *     so dragging the region drags every device inside.
 *   • The header is the only "draggable handle" for the region —
 *     the body lets pointer events pass through so dropping a
 *     palette item INTO a region works as expected. The
 *     `nodrag` className is React Flow's mechanism for that.
 *   • Selection state is rendered via a thicker border + accent
 *     color when `selected` is true, so the operator gets
 *     immediate feedback that the region (not a device inside
 *     it) is the active selection.
 *   • An optional `accent` (Tailwind class fragment, e.g.
 *     `sky-500`, `emerald-500`) drives the border / header tint —
 *     handy for visually distinguishing site regions from zone
 *     regions when both coexist. A small swatch-picker in the
 *     properties panel sets this in a follow-up build.
 *
 * The Build 106 region is intentionally NOT resizable from inside
 * this component — Build 107 wires React Flow's
 * `<NodeResizer>` so customers can drag-resize. For 106 the
 * region has a fixed default size (360×220, see
 * `NODE_SIZE_PRESETS.region`) and can be dragged but not resized.
 */

import React from 'react';
import { Layers } from 'lucide-react';
import { cn } from '@/common/lib/utils';

export interface RegionGroupNodeData {
    /** Display name shown in the header bar. */
    label: string;
    /** Number of child devices currently parented to this region.
     *  The canvas counts these on every render and pushes the
     *  count into `data` so the node stays cheap (no incident-
     *  edge scan inside this component). */
    deviceCount: number;
    /** Optional Tailwind colour fragment (e.g. `sky-500`,
     *  `emerald-500`). Defaults to `slate-500` when undefined. */
    accent?: string;
}

const accentClasses = (
    accent: string | undefined
): { border: string; tint: string; pill: string } => {
    // Centralise the accent → class mapping so a typo in `accent`
    // can't render an arbitrary string into a className. Anything
    // not in this allow-list falls back to the neutral slate
    // palette.
    //
    // Build 109: the diagram canvas runs the dark Cyber-NOC
    // theme; the operations canvas runs the light theme. Tailwind
    // `dark:` modifiers cover both — but we shifted the dark
    // shades to sit cleanly on the `#0b0f1a` canvas (more saturated
    // borders, more opaque tints) without making the light theme
    // look "off".
    switch (accent) {
        case 'sky-500':
            return {
                border: 'border-sky-400/60 dark:border-sky-500/70',
                tint: 'bg-sky-50/60 dark:bg-sky-950/40',
                pill: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
            };
        case 'emerald-500':
            return {
                border: 'border-emerald-400/60 dark:border-emerald-500/70',
                tint: 'bg-emerald-50/60 dark:bg-emerald-950/40',
                pill: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
            };
        case 'amber-500':
            return {
                border: 'border-amber-400/60 dark:border-amber-500/70',
                tint: 'bg-amber-50/60 dark:bg-amber-950/40',
                pill: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
            };
        case 'rose-500':
            return {
                border: 'border-rose-400/60 dark:border-rose-500/70',
                tint: 'bg-rose-50/60 dark:bg-rose-950/40',
                pill: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
            };
        case 'violet-500':
            return {
                border: 'border-violet-400/60 dark:border-violet-500/70',
                tint: 'bg-violet-50/60 dark:bg-violet-950/40',
                pill: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
            };
        case 'slate-500':
        default:
            return {
                border: 'border-slate-400/60 dark:border-slate-600/70',
                tint: 'bg-slate-50/60 dark:bg-slate-900/60',
                pill: 'bg-slate-500/10 text-slate-700 dark:text-slate-300',
            };
    }
};

export const RegionGroupNode: React.FC<{
    data: RegionGroupNodeData;
    selected?: boolean;
}> = ({ data, selected }) => {
    const a = accentClasses(data.accent);
    return (
        <div
            className={cn(
                'rounded-xl border-2 border-dashed transition-shadow',
                a.border,
                a.tint,
                selected && 'shadow-lg outline outline-2 outline-sky-500/70 outline-offset-2'
            )}
            style={{ width: '100%', height: '100%' }}
        >
            <div
                className={cn(
                    'flex items-center justify-between gap-2 px-3 py-1.5 rounded-t-[10px]',
                    'border-b border-dashed',
                    a.border,
                    'text-[11px] font-semibold uppercase tracking-wider'
                )}
            >
                <div className="flex items-center gap-1.5 min-w-0">
                    <Layers className="w-3 h-3 flex-shrink-0 opacity-70" aria-hidden />
                    <span className="truncate text-slate-700 dark:text-slate-200">
                        {data.label}
                    </span>
                </div>
                <span
                    className={cn(
                        'flex-shrink-0 px-1.5 py-0.5 rounded text-[9px] font-mono normal-case tracking-normal',
                        a.pill
                    )}
                >
                    {data.deviceCount} device{data.deviceCount === 1 ? '' : 's'}
                </span>
            </div>
            {/* Body is a no-op pass-through so palette drops into the
             *  region land on the canvas (and the canvas's drop
             *  handler computes a parentId from the coordinates). */}
            <div className="nodrag w-full h-[calc(100%-30px)]" />
        </div>
    );
};
