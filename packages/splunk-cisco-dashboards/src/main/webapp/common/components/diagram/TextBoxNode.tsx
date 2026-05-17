/**
 * TextBoxNode — free-placement annotation (Build 115.1).
 *
 * Sibling to `DiagramTitleNode`, but designed for *multiple*
 * instances per diagram and for arbitrary annotations the operator
 * wants to drop anywhere on the canvas — protocol-gateway labels,
 * "REST API TCP 8089" boxes, callouts, "ASN 65001", etc.
 *
 * Differences from a title:
 *   • No singleton restriction. Every drop from the palette gets a
 *     unique id, multiple coexist.
 *   • Smaller default font (14px vs 28px) — these are body
 *     annotations, not headlines.
 *   • Optional background fill + border so the operator can render
 *     either a transparent caption (default) or a "card" annotation
 *     that visually reads as a labelled box (used by the OOB Splunk
 *     Cloud diagram for the protocol-gateway boxes).
 *   • Default left-aligned because operators paste prose / port
 *     numbers / descriptions into them, not centred display text.
 *
 * The shared rationale (regular React-Flow node, not an external
 * overlay) carries over from `DiagramTitleNode`: the textbox scales
 * with zoom, drags with the canvas, supports parent-region nesting,
 * and round-trips through `rfToSaved` / `savedNodeToRF` like any
 * other node — no bespoke serialiser needed.
 */
import React from 'react';
import { cn } from '@/common/lib/utils';

/** React Flow node type id for the textbox node. Distinct from
 *  `diagramTitle` so we can keep title-specific behaviours (single-
 *  instance, headline styling) cleanly separated from the
 *  free-placement annotation flow. */
export const TEXT_BOX_NODE_TYPE = 'textBox';

/** Default styling for newly-inserted text boxes. The font size is
 *  small enough for body annotations but still readable at 100%
 *  zoom; transparent background by default so a textbox dropped on
 *  empty canvas blends in cleanly. Operators can opt into a card
 *  surface via the inspector when they want a "labelled box" look
 *  (e.g. the "REST API TCP 8089" gateway boxes). */
export const TEXT_BOX_DEFAULTS = {
    fontSize: 14,
    color: '#0f172a',
    bold: false,
    italic: false,
    background: 'transparent',
    border: 'none',
    align: 'left' as const,
} as const;

export type TextBoxAlign = 'left' | 'center' | 'right';

export interface TextBoxNodeData {
    text: string;
    fontSize: number;
    color: string;
    bold?: boolean;
    italic?: boolean;
    /** CSS background colour. `transparent` (or any falsy value)
     *  means "no fill" — the textbox reads as a floating caption.
     *  Hex values render as a card surface. */
    background?: string;
    /** CSS border shorthand (e.g. `1px solid #94a3b8`). `none` or
     *  empty string means no border. */
    border?: string;
    align?: TextBoxAlign;
}

interface TextBoxNodeProps {
    data: TextBoxNodeData;
    selected?: boolean;
}

export const TextBoxNode: React.FC<TextBoxNodeProps> = ({ data, selected }) => {
    const text = (data.text ?? '').trim();
    const isPlaceholder = text.length === 0;

    const background = data.background ?? TEXT_BOX_DEFAULTS.background;
    const border = data.border ?? TEXT_BOX_DEFAULTS.border;
    const isCarded =
        background !== 'transparent' &&
        background !== '' &&
        background !== undefined;

    return (
        <div
            className={cn(
                'select-none cursor-default whitespace-pre-wrap',
                'transition-[box-shadow,outline-color] duration-150',
                'rounded-md',
                // Selection outline is a soft sky ring — same
                // affordance as DiagramTitleNode so operators get
                // a consistent "this element is selected" cue
                // across the whole diagram.
                selected
                    ? 'outline outline-2 outline-sky-400/70 outline-offset-2'
                    : 'outline outline-1 outline-transparent',
                'hover:outline-sky-300/60'
            )}
            style={{
                fontSize: `${data.fontSize}px`,
                color: isPlaceholder ? '#94a3b8' : data.color,
                fontWeight: data.bold ? 600 : 400,
                fontStyle: data.italic ? 'italic' : 'normal',
                lineHeight: 1.3,
                textAlign: data.align ?? TEXT_BOX_DEFAULTS.align,
                padding: isCarded ? '6px 12px' : '4px 8px',
                background: isCarded ? background : 'transparent',
                // Treat `none` / empty as "no border" so saved
                // payloads with explicit `border: 'none'` still
                // render correctly.
                border: border && border !== 'none' ? border : undefined,
                // A subtle shadow when carded — mirrors the floating
                // "card" feel of device shapes without overpowering
                // the textbox typography.
                boxShadow: isCarded
                    ? '0 1px 2px rgba(15, 23, 42, 0.06), 0 1px 3px rgba(15, 23, 42, 0.04)'
                    : undefined,
                fontFamily:
                    'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                // Min width so an empty textbox still shows the
                // placeholder cleanly without collapsing into a
                // single-pixel hit target.
                minWidth: 80,
            }}
            // No <Handle> children: textboxes are annotations, not
            // network elements; you cannot draw a connector to or
            // from one. Kept consistent with DiagramTitleNode.
        >
            {isPlaceholder ? 'Click to edit text' : data.text}
        </div>
    );
};
