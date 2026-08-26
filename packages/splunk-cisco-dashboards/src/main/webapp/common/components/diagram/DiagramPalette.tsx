/**
 * DiagramPalette — left sidebar for the Network Diagram page.
 *
 * Two tabs:
 *   1. **Shapes** — generic Cisco shape archetypes + region/site
 *      container. For things that aren't (or shouldn't be) bound
 *      to a real device row.
 *   2. **Inventory** — filterable, draggable list of real devices
 *      from `asset_inventory`. Drag a row onto the canvas to
 *      spawn an asset-bound node.
 *
 * The palette is dumb chrome: it owns NO canvas state. All
 * interactivity happens via HTML5 DnD payloads (mime
 * `application/x-scd-palette-payload`) that the canvas's drop
 * handler reads. This keeps the palette swappable / testable
 * independently of the canvas.
 */

import React, { useState } from 'react';
import { Boxes, ListTree, type SuiIcon } from '@/common/icons/SuiIcon';
import { cn } from '@/common/lib/utils';
import { ShapesTab } from './ShapesTab';
import { InventoryTab } from './InventoryTab';
import type { PaletteDragPayload } from './types';

type TabId = 'shapes' | 'inventory';

const TAB_DEFS: Array<{
    id: TabId;
    label: string;
    Icon: SuiIcon;
}> = [
    { id: 'shapes', label: 'Shapes', Icon: Boxes },
    { id: 'inventory', label: 'Inventory', Icon: ListTree },
];

export const DiagramPalette: React.FC<{
    className?: string;
    onAddToCanvas?: (payload: PaletteDragPayload) => void;
}> = ({ className, onAddToCanvas }) => {
    const [active, setActive] = useState<TabId>('shapes');
    return (
        <div
            className={cn(
                'flex h-full min-h-0 w-72 flex-col overflow-hidden border-r   [contain:layout_paint] sui-border-weak sui-bg-section',
                className
            )}
        >
            <div
                role="tablist"
                aria-label="Palette tabs"
                className="flex border-b  sui-border-weak"
            >
                {TAB_DEFS.map((t) => {
                    const isActive = t.id === active;
                    return (
                        <button
                            key={t.id}
                            role="tab"
                            aria-selected={isActive}
                            onClick={() => setActive(t.id)}
                            className={cn(
                                'flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-xs font-medium border-b-2 transition-colors',
                                isActive
                                    ? 'sui-border-notification-info sui-color-active sui-bg-notification-info'
                                    : 'sui-border-transparent  sui-color-default  sui-hover-color-active'
                            )}
                            type="button"
                        >
                            <t.Icon className="w-3.5 h-3.5" aria-hidden />
                            {t.label}
                        </button>
                    );
                })}
            </div>
            {/* Build 115.7 — switched from `overflow-hidden` to
             *  `overflow-y-auto` so the Shapes catalogue (now 42
             *  shapes across 7+ sections) can actually scroll on
             *  short viewports. Previously anything below
             *  Servers & Infrastructure was clipped because the
             *  wrapper hid the overflow and `ShapesTab` itself
             *  had no scroll viewport of its own. */}
            <div className="flex-1 min-h-0 overflow-y-auto [contain:layout_paint]">
                {active === 'shapes' ? (
                    <ShapesTab onAddToCanvas={onAddToCanvas} />
                ) : (
                    <InventoryTab onAddToCanvas={onAddToCanvas} />
                )}
            </div>
        </div>
    );
};
