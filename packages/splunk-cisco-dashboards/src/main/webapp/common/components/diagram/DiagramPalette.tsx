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
import { Boxes, ListTree } from 'lucide-react';
import { cn } from '@/common/lib/utils';
import { ShapesTab } from './ShapesTab';
import { InventoryTab } from './InventoryTab';

type TabId = 'shapes' | 'inventory';

const TAB_DEFS: Array<{
    id: TabId;
    label: string;
    Icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
}> = [
    { id: 'shapes', label: 'Shapes', Icon: Boxes },
    { id: 'inventory', label: 'Inventory', Icon: ListTree },
];

export const DiagramPalette: React.FC<{ className?: string }> = ({ className }) => {
    const [active, setActive] = useState<TabId>('shapes');
    return (
        <div
            className={cn(
                'flex flex-col w-72 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900',
                className
            )}
        >
            <div
                role="tablist"
                aria-label="Palette tabs"
                className="flex border-b border-slate-200 dark:border-slate-800"
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
                                    ? 'border-sky-500 text-sky-600 dark:text-sky-400 bg-sky-50/50 dark:bg-sky-950/30'
                                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                            )}
                            type="button"
                        >
                            <t.Icon className="w-3.5 h-3.5" aria-hidden />
                            {t.label}
                        </button>
                    );
                })}
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
                {active === 'shapes' ? <ShapesTab /> : <InventoryTab />}
            </div>
        </div>
    );
};
