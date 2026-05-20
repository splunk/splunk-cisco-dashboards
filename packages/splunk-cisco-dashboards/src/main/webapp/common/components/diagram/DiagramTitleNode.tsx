/**
 * DiagramTitleNode — on-canvas headline (Build 113).
 *
 * Renders a transparent, borderless, font-customisable text block
 * that sits on the React Flow canvas like any other node — it
 * scales with zoom, accepts drag, and is selectable — but visually
 * has none of the chrome of a device shape (no card surface, no
 * status ring, no port handles).
 *
 * The contract:
 *   • `data.text` drives what's rendered. Empty/whitespace renders
 *     a soft "Click to edit title" hint so operators discover the
 *     edit affordance without on-screen tutorials.
 *   • `data.fontSize` (px), `data.color` (hex), `data.bold`,
 *     `data.italic` are the styling axes. The PropertiesPanel
 *     exposes them when the title node is selected.
 *   • The component is read-only here. Editing happens in the
 *     PropertiesPanel — keeps the on-canvas surface clean and
 *     avoids the contentEditable/IME pitfalls that bite when you
 *     try to inline-edit a node that's also the React Flow drag
 *     target.
 *
 * Why a regular node type (not an overlay outside React Flow):
 *   - Position scales with the canvas viewport (zoom + pan) so
 *     the title stays anchored to the diagram, not the screen.
 *   - Selection / drag / parent-region semantics come for free
 *     from React Flow.
 *   - Saved position round-trips through `rfToSaved` / `savedNodeToRF`
 *     just like any other node, so the parent canvas only needs a
 *     small "extract this to payload.title" hook on serialise and
 *     a "materialise from payload.title" hook on hydrate.
 */

import React from 'react';
import { cn } from '@/common/lib/utils';

/** React Flow node `type` discriminator for the title node. Kept
 *  as a const so the canvas + this component share a single source
 *  of truth and TypeScript catches typos. */
export const DIAGRAM_TITLE_NODE_TYPE = 'diagramTitle';

/** Default styling for newly-inserted titles. The font size lands
 *  somewhere between Visio's "title" (~28pt) and a slide deck's
 *  H1 — big enough to dominate at default zoom, small enough that
 *  a typical 800x600 canvas viewport doesn't clip it. */
export const DIAGRAM_TITLE_DEFAULTS = {
    fontSize: 28,
    color: '#0f172a',
    bold: true,
    italic: false,
} as const;

export interface DiagramTitleNodeData {
    text: string;
    fontSize: number;
    color: string;
    bold?: boolean;
    italic?: boolean;
}

interface DiagramTitleNodeProps {
    data: DiagramTitleNodeData;
    selected?: boolean;
}

export const DiagramTitleNode: React.FC<DiagramTitleNodeProps> = ({
    data,
    selected,
}) => {
    const text = (data.text ?? '').trim();
    const isPlaceholder = text.length === 0;

    return (
        <div
            className={cn(
                // No border by default — titles read as part of the
                // diagram, not as another card. Selection state
                // adds a soft outline so the operator can confirm
                // they grabbed the right element when clicking
                // through nearby nodes.
                'select-none cursor-default whitespace-pre-wrap text-center',
                'transition-[box-shadow,outline-color] duration-150',
                'rounded-md',
                selected
                    ? 'outline outline-2 outline-sky-400/70 outline-offset-2'
                    : 'outline outline-1 outline-transparent',
                // A subtle hover indicator so operators in edit
                // mode discover the title is interactive without
                // permanently decorating it. Disabled cleanly in
                // view mode because hover never fires there
                // (canvas-level data attribute).
                'hover:outline-sky-300/60'
            )}
            style={{
                fontSize: `${data.fontSize}px`,
                color: isPlaceholder ? '#94a3b8' : data.color,
                fontWeight: data.bold ? 700 : 400,
                fontStyle: data.italic ? 'italic' : 'normal',
                lineHeight: 1.15,
                padding: '4px 12px',
                // Letter-spacing tightens proportionally as font
                // size grows, matching the typographic convention
                // for display-size headlines.
                letterSpacing: data.fontSize >= 32 ? '-0.01em' : '0',
                fontFamily:
                    'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            }}
            // Title nodes don't expose port handles — they're not
            // network elements, you can't draw a link from a title.
            // No <Handle> children intentionally.
        >
            {isPlaceholder ? 'Click to edit title' : data.text}
        </div>
    );
};
