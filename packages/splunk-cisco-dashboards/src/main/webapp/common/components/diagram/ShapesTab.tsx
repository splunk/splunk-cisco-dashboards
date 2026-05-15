/**
 * ShapesTab — generic Cisco shape palette.
 *
 * Drag source for the diagram canvas's drop target. Each tile
 * encodes a `PaletteDragPayload` of variant `shape` (a generic
 * device archetype) or `region` (a labelled container). The
 * canvas's drop handler reads the payload from the HTML5 DnD
 * `dataTransfer` channel and spawns the appropriate React Flow
 * node.
 *
 * Why generic-shape tiles in addition to the inventory-row tiles
 * (in the sibling `InventoryTab`)? Two real authoring needs:
 *
 *   1. **Diagrammed boxes that aren't real devices** — the FDEM
 *      reference PDF includes "Internet", "Azure Cloud Services",
 *      "Web Servers / Email", "Remote Users". These are conceptual
 *      labels for things that don't (and shouldn't) appear in the
 *      asset_inventory feed.
 *
 *   2. **Region/site groupings** — labelled containers like
 *      "Tallahassee" or "Data Center" that organise devices
 *      visually. Always generic; never bound to an asset.
 *
 * Visual model: a 2-column grid of small icon+label tiles. Each
 * tile is a flex card with the inline Cisco SVG centered on top
 * of a short label. Hover lifts the shadow so the affordance
 * "this is grabbable" is obvious without arrow cursors.
 */

import React from 'react';
import { cn } from '@/common/lib/utils';
import { CISCO_ICONS } from '@/common/components/topology/ciscoIcons';
import type { DeviceShapeId } from '@/common/services/topologyDiscovery';
import { PALETTE_DND_MIME, type PaletteDragPayload } from './types';

interface ShapeTileSpec {
    id: DeviceShapeId | 'region';
    label: string;
    description: string;
}

const SHAPE_TILES: ShapeTileSpec[] = [
    { id: 'router', label: 'Router', description: 'WAN edge / aggregation router' },
    { id: 'switch', label: 'L2 Switch', description: 'Access / distribution switch' },
    { id: 'l3_switch', label: 'L3 Switch', description: 'Core / distribution L3 switch' },
    { id: 'firewall', label: 'Firewall', description: 'Perimeter / DC firewall (ASA / FTD)' },
    { id: 'wlc', label: 'WLC', description: 'Wireless LAN Controller' },
    { id: 'access_point', label: 'Access Point', description: 'Wireless access point' },
    { id: 'server', label: 'Server', description: 'Application / endpoint host' },
    { id: 'cloud', label: 'Cloud / WAN', description: 'Internet, Azure / AWS, MPLS, ISP' },
    { id: 'generic', label: 'Generic', description: 'Anything not in the icon set' },
    { id: 'region', label: 'Region / Site', description: 'Labelled container — group devices' },
];

const tilePayload = (id: DeviceShapeId | 'region'): PaletteDragPayload => {
    if (id === 'region') {
        return {
            variant: 'region',
            defaultLabel: 'New Region',
            defaultWidth: 360,
            defaultHeight: 220,
        };
    }
    return {
        variant: 'shape',
        shape: id,
        defaultLabel:
            id === 'l3_switch'
                ? 'L3 Switch'
                : id.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()),
    };
};

const ShapeTile: React.FC<ShapeTileSpec> = ({ id, label, description }) => {
    const Icon = id === 'region' ? null : CISCO_ICONS[id];
    const handleDragStart = (e: React.DragEvent<HTMLDivElement>): void => {
        const payload = tilePayload(id);
        e.dataTransfer.setData(PALETTE_DND_MIME, JSON.stringify(payload));
        // The text/plain payload is a best-effort fallback for
        // operating systems where the custom mime is dropped — at
        // worst the canvas treats it as a generic drop with the
        // shape name visible. The canvas drop handler still
        // requires the custom mime to spawn a node, so this is
        // purely a debug nicety, not a security surface.
        e.dataTransfer.setData('text/plain', `${label}`);
        e.dataTransfer.effectAllowed = 'copy';
    };

    return (
        <div
            draggable
            onDragStart={handleDragStart}
            role="button"
            tabIndex={0}
            aria-label={`Drag ${label} to canvas`}
            title={description}
            className={cn(
                'group flex flex-col items-center justify-center gap-1 p-2 rounded-lg cursor-grab active:cursor-grabbing select-none',
                'border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900',
                'hover:border-sky-400 hover:shadow-md hover:bg-sky-50/50 dark:hover:bg-sky-950/30',
                'transition-all duration-150'
            )}
        >
            <div className="w-10 h-10 flex items-center justify-center text-slate-700 dark:text-slate-300 group-hover:text-sky-600 dark:group-hover:text-sky-400">
                {Icon ? (
                    <Icon className="w-9 h-9" />
                ) : (
                    <div className="w-9 h-7 rounded border-2 border-dashed border-slate-400 dark:border-slate-500 flex items-center justify-center text-[8px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        Region
                    </div>
                )}
            </div>
            <div className="text-[10px] font-medium text-slate-700 dark:text-slate-200 text-center leading-tight">
                {label}
            </div>
        </div>
    );
};

export const ShapesTab: React.FC = () => (
    <div className="flex flex-col gap-3 p-3">
        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
            Drag any shape onto the canvas. Use{' '}
            <span className="font-medium text-slate-700 dark:text-slate-200">
                Region / Site
            </span>{' '}
            to draw a labelled container, then drop devices inside it.
        </p>
        <div className="grid grid-cols-2 gap-2">
            {SHAPE_TILES.map((s) => (
                <ShapeTile key={s.id} {...s} />
            ))}
        </div>
    </div>
);
