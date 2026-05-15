/**
 * SortableMetricCard — drag-to-reorder wrapper around any tile component
 * (MetricItem, TableTile, or the MetricCard chooser that renders one of
 * those at runtime).
 *
 * Layout contract:
 *   * The wrapper replaces the tile's role as the flex child of the
 *     section's tile row. It carries the same flex sizing that
 *     MetricItem/TableTile used to apply directly (`flex-1 basis-0
 *     min-w-[108px]`), so dropping a SortableMetricCard around an
 *     existing tile is a no-op for layout when nothing is being
 *     dragged.
 *   * The actual tile renders as a flex-column child of the wrapper.
 *     Its own `flex-1 basis-0` then fills the wrapper's height
 *     exactly the way a top-level tile fills the section row.
 *
 * Drag affordance:
 *   * A small grip icon sits in the top-left of the tile, hidden by
 *     default and revealed on hover or keyboard focus. Only the
 *     handle button accepts drag listeners — clicks anywhere else on
 *     the tile (gear, info, open-in-search, sparkline) keep working
 *     exactly as before.
 *   * Keyboard accessible by default (the dnd-kit `KeyboardSensor`
 *     ships in the DndContext provider): Tab to focus the handle,
 *     Space to grab, arrow keys to move, Space to drop, Esc to
 *     cancel. ARIA live announcements are emitted automatically.
 *
 * Visual feedback:
 *   * The tile slides into place with a 200ms transition (driven by
 *     `useSortable.transition`).
 *   * The currently dragged tile drops opacity to 0.5 and lifts a
 *     hair off the page (`z-10`) so it stays readable above its
 *     neighbours during the drag.
 */

import React from 'react';
import { GripVertical } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/common/lib/utils';

interface SortableMetricCardProps {
    /**
     * Stable tile id (matches `MetricConfig.id` and the keys in the
     * order map). dnd-kit uses this to identify the item across the
     * SortableContext, so it must match what the parent passes in
     * the `items` array on `<SortableContext items={…}>`.
     */
    id: string;
    /** Human-friendly tile label, used only for the drag handle's aria-label. */
    ariaLabel?: string;
    /** The tile component itself (MetricCard, MetricItem, TableTile, …). */
    children: React.ReactNode;
}

export const SortableMetricCard: React.FC<SortableMetricCardProps> = ({
    id,
    ariaLabel,
    children,
}) => {
    const {
        setNodeRef,
        attributes,
        listeners,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    const style: React.CSSProperties = {
        // CSS.Transform.toString handles 0/null transforms gracefully
        // (returns undefined), so we don't need to gate on transform
        // truthiness ourselves.
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                // Same flex contract MetricItem/TableTile used to
                // own. Keeping it on the wrapper means swapping a
                // bare <MetricCard /> for <SortableMetricCard>
                // <MetricCard /></SortableMetricCard> doesn't change
                // section layout.
                'flex flex-col flex-1 basis-0 min-w-[108px] relative group/sortable',
                // Reorder feedback: lift the dragged tile above its
                // neighbours and drop opacity so the user can still
                // read the source/destination context behind it.
                isDragging && 'z-10 opacity-50'
            )}
        >
            <button
                type="button"
                aria-label={
                    ariaLabel
                        ? `Drag to reorder ${ariaLabel}`
                        : 'Drag to reorder tile'
                }
                title="Drag to reorder · Space to grab, arrows to move, Space to drop"
                {...attributes}
                {...listeners}
                className={cn(
                    // Top-left of the tile. z-20 so the handle floats
                    // above the sparkline canvas without intercepting
                    // hover on the chart itself when the handle isn't
                    // visible.
                    'absolute top-0.5 left-0.5 z-20',
                    'flex items-center justify-center w-4 h-4 rounded',
                    // Translucent chip with a subtle backdrop blur so
                    // when the handle is revealed on hover and lands
                    // on top of the tile label (e.g. "OPEN ISSUES"),
                    // the underlying text still reads through the
                    // chip rather than being abruptly overwritten.
                    'bg-white/85 dark:bg-slate-900/85 backdrop-blur-[2px]',
                    'shadow-sm ring-1 ring-slate-200/70 dark:ring-slate-700/60',
                    'text-slate-500 dark:text-slate-400',
                    'cursor-grab active:cursor-grabbing',
                    'transition-opacity duration-150',
                    // Hidden by default, revealed when the user
                    // actually hovers/focuses the tile or the
                    // handle. While dragging we keep it visible so
                    // the user can see what they've grabbed.
                    isDragging
                        ? 'opacity-100'
                        : 'opacity-0 group-hover/sortable:opacity-100 focus:opacity-100',
                    // Suppress the drag handle when the user is
                    // clearly NOT trying to drag — i.e. they're
                    // hovering an in-tile control (info icon,
                    // open-in-search, configure, sparkline,
                    // table body, etc.) or reading an open info
                    // popover. Two complementary selectors:
                    //
                    //  - `data-tile-control:hover` — the cursor
                    //    is currently over an interactive
                    //    overlay element. Marked components
                    //    (InfoTooltip wrapper, the action
                    //    buttons, sparkline / table / bar
                    //    visualisations) carry the attribute
                    //    so this rule engages naturally on
                    //    hover.
                    //
                    //  - `data-info-open="true"` — the info
                    //    popover is open. Keeps the handle
                    //    suppressed even after the cursor moves
                    //    INTO the popover body, where
                    //    `:hover` no longer matches the (i)
                    //    icon.
                    //
                    // `!opacity-0` is needed to win the cascade
                    // against the `group-hover` and `focus`
                    // overrides above. The popover itself is
                    // portaled out of this subtree, so a future
                    // refactor that wraps the tile body in
                    // another container won't break the match.
                    'group-has-[[data-tile-control="true"]:hover]/sortable:!opacity-0',
                    'group-has-[[data-info-open="true"]]/sortable:!opacity-0',
                    'hover:text-sky-600 dark:hover:text-sky-400',
                    'focus:outline-none focus-visible:ring-1 focus-visible:ring-sky-400'
                )}
            >
                <GripVertical className="w-3 h-3" />
            </button>
            {children}
        </div>
    );
};
