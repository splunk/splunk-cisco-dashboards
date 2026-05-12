/**
 * InfoTooltip — small hover/focus-revealed help bubble.
 *
 * Renders an `Info` icon that, on hover or keyboard focus, exposes a
 * popover with the supplied description.
 *
 * Why this is portaled to `document.body`:
 *
 * The popover is positioned `fixed` and rendered via `createPortal`
 * straight into `document.body` instead of being a child of the icon
 * span. This is intentional armor against the (in practice frequent)
 * pattern where a section card / tile row / scroll container in the
 * dashboard layout has `overflow-hidden` for legitimate reasons (chart
 * bleed containment, rounded-corner shape, scroll regions). When the
 * popover lived inside the icon span, any such ancestor `overflow-
 * hidden` would visually clip the bottom of the popover regardless of
 * `z-index`, because z-index can't escape an overflow clip path - this
 * is exactly the truncation bug the FDEM 2026-05-11 review surfaced
 * on the IT Health "Critical sites available" tile. Portaling means
 * the popover's only ancestor is `<body>`, so no layout container in
 * the dashboard tree can clip it now or in the future.
 *
 * Positioning is computed in `useLayoutEffect` from the trigger's
 * `getBoundingClientRect()` and clamped to the viewport so the popover
 * stays fully on-screen at narrow widths. Visibility is state-driven
 * (mouseenter/mouseleave + focusin/focusout) rather than CSS-only -
 * we need the open boolean to drive the portal mount, which adds one
 * tiny render per hover but pays for itself by surviving every
 * ancestor-clipping pattern in the layout tree.
 *
 * The popover supports three anchor variants ("auto"=centered,
 * "left"=left-aligned to trigger, "right"=right-aligned to trigger)
 * so it can sit cleanly inside narrow flex rows.
 */

import React, { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';
import { cn } from '@/common/lib/utils';

export type InfoTooltipAnchor = 'auto' | 'left' | 'right';

interface InfoTooltipProps {
    /** Heading shown bold at the top of the popover. */
    title?: string;
    /** Body text — supports a few short lines. */
    description: string;
    /** Optional micro-caption shown italic at the bottom (e.g. SPL stanza name). */
    footnote?: string;
    /** Where to anchor the popover relative to the icon. */
    anchor?: InfoTooltipAnchor;
    /**
     * Accessible label for the icon button when no surrounding label
     * makes the purpose obvious. Defaults to "What does this mean?".
     */
    iconAriaLabel?: string;
    className?: string;
}

// Width of the popover in pixels. Kept in sync with the Tailwind
// `w-[360px]` class on the popover so positioning math and rendered
// width agree.
const POPOVER_WIDTH = 360;
// Vertical gap between the trigger icon and the popover top edge.
const POPOVER_GAP = 6;
// Minimum distance between the popover and the viewport edge so the
// shadow doesn't get cropped when the icon is near the screen edge.
const VIEWPORT_PADDING = 8;

interface TooltipCoords {
    left: number;
    top: number;
}

const computeCoords = (
    rect: DOMRect,
    anchor: InfoTooltipAnchor,
    popoverHeight: number
): TooltipCoords => {
    let left: number;
    if (anchor === 'left') {
        left = rect.left;
    } else if (anchor === 'right') {
        left = rect.right - POPOVER_WIDTH;
    } else {
        left = rect.left + rect.width / 2 - POPOVER_WIDTH / 2;
    }
    left = Math.max(
        VIEWPORT_PADDING,
        Math.min(left, window.innerWidth - POPOVER_WIDTH - VIEWPORT_PADDING)
    );

    // Default: popover hangs below the trigger. If that would push
    // it past the viewport bottom (e.g. tile near the bottom of the
    // page on a short window), flip it above the trigger so the
    // entire body stays visible.
    let top = rect.bottom + POPOVER_GAP;
    if (popoverHeight > 0 && top + popoverHeight > window.innerHeight - VIEWPORT_PADDING) {
        top = Math.max(VIEWPORT_PADDING, rect.top - POPOVER_GAP - popoverHeight);
    }
    return { left, top };
};

export const InfoTooltip: React.FC<InfoTooltipProps> = ({
    title,
    description,
    footnote,
    anchor = 'auto',
    iconAriaLabel = 'What does this mean?',
    className,
}) => {
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const popoverRef = useRef<HTMLSpanElement | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [coords, setCoords] = useState<TooltipCoords | null>(null);

    // Position the popover after it mounts. We measure the popover's
    // actual rendered height on a first pass (with the popover
    // briefly placed off-screen via the initial `coords===null`
    // guard) so the second pass can flip it above the trigger when
    // the body would otherwise overflow the viewport bottom.
    useLayoutEffect(() => {
        if (!isOpen || !triggerRef.current) return;
        const triggerRect = triggerRef.current.getBoundingClientRect();
        const popoverHeight = popoverRef.current
            ? popoverRef.current.getBoundingClientRect().height
            : 0;
        setCoords(computeCoords(triggerRect, anchor, popoverHeight));
    }, [isOpen, anchor, description, title, footnote]);

    // Reposition on scroll / resize so the popover follows its
    // trigger if the page scrolls underneath while the user keeps
    // hovering. We only attach listeners while open, so closed-tile
    // scrolling has zero overhead.
    useLayoutEffect(() => {
        if (!isOpen) return;
        const reposition = () => {
            if (!triggerRef.current) return;
            const triggerRect = triggerRef.current.getBoundingClientRect();
            const popoverHeight = popoverRef.current
                ? popoverRef.current.getBoundingClientRect().height
                : 0;
            setCoords(computeCoords(triggerRect, anchor, popoverHeight));
        };
        window.addEventListener('scroll', reposition, true);
        window.addEventListener('resize', reposition);
        return () => {
            window.removeEventListener('scroll', reposition, true);
            window.removeEventListener('resize', reposition);
        };
    }, [isOpen, anchor]);

    const popover =
        isOpen && typeof document !== 'undefined'
            ? createPortal(
                  <span
                      ref={popoverRef}
                      role="tooltip"
                      style={{
                          position: 'fixed',
                          left: coords?.left ?? -9999,
                          top: coords?.top ?? -9999,
                          width: POPOVER_WIDTH,
                          // Hide on the very first paint while we're
                          // still measuring the actual rendered height.
                          // The follow-up useLayoutEffect commits the
                          // real coords before the browser commits the
                          // frame, so the user never sees the off-screen
                          // placement — this just prevents a one-frame
                          // jump when the height differs from the
                          // initial estimate.
                          visibility: coords ? 'visible' : 'hidden',
                      }}
                      className={cn(
                          'z-[9999] p-4 rounded-lg pointer-events-none',
                          'bg-slate-900 text-slate-100 shadow-xl ring-1 ring-slate-700/60',
                          // 13.5px sub-pixel-rounds noticeably crisper
                          // than 13 on retina displays; leading-[1.6]
                          // is a hair tighter than `leading-relaxed`
                          // (1.625) but reads more densely in the
                          // popover frame.
                          'text-[13.5px] leading-[1.6] normal-case tracking-normal text-left'
                      )}
                  >
                      {title && (
                          <span className="block font-bold text-white text-[15px] mb-2 normal-case">
                              {title}
                          </span>
                      )}
                      <span className="block text-slate-200 font-normal normal-case">
                          {description}
                      </span>
                      {footnote && (
                          <span className="block mt-2.5 pt-2 border-t border-slate-700 text-slate-400 italic text-[11.5px] font-mono break-all leading-snug">
                              {footnote}
                          </span>
                      )}
                  </span>,
                  document.body
              )
            : null;

    return (
        <span
            className={cn(
                'relative inline-flex focus-within:outline-none',
                className
            )}
            onMouseEnter={() => setIsOpen(true)}
            onMouseLeave={() => {
                setIsOpen(false);
                setCoords(null);
            }}
            onFocus={() => setIsOpen(true)}
            onBlur={() => {
                setIsOpen(false);
                setCoords(null);
            }}
        >
            <button
                ref={triggerRef}
                type="button"
                aria-label={iconAriaLabel}
                className="p-0.5 -my-0.5 text-slate-300 hover:text-sky-600 focus:text-sky-600 transition-colors rounded focus:outline-none focus:ring-1 focus:ring-sky-400"
            >
                <Info className="w-3 h-3 stroke-[2.5px]" />
            </button>
            {popover}
        </span>
    );
};
