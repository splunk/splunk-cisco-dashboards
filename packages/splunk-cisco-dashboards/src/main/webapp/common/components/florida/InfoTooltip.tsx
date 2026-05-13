/**
 * InfoTooltip — small hover/focus-revealed help bubble.
 *
 * Renders an `Info` icon that, on hover or keyboard focus, exposes a
 * popover with the supplied description.
 *
 * Why this is portaled to `#scan-root` (NOT `document.body`):
 *
 * The popover is positioned `fixed` and rendered via `createPortal`
 * out of the icon span and into the React app's mount node
 * (`#scan-root`). The first revision of this rewrite portaled into
 * `document.body` directly, which was technically the cleanest answer
 * for ancestor-clipping but completely broke the popover's styling on
 * the production stack: the project's `tailwind.config.js` scopes
 * every utility class under `#scan-root` (`important: '#scan-root'`)
 * to keep Tailwind's reset / utilities from leaking into Splunk Web's
 * own chrome around the panel. So on `<body>` directly, none of
 * `bg-slate-900`, `p-4`, `rounded-lg`, `shadow-xl`, etc. were applied
 * - the popover rendered as raw unstyled text floating over the tile
 * content (caught immediately by Alan in the FDEM 2026-05-11 review).
 *
 * `#scan-root` is the right portal target because:
 *  - It's INSIDE the Tailwind scope, so utility classes apply
 *    normally (no need to switch to inline styles).
 *  - It's OUTSIDE every dashboard-layout container that has
 *    `overflow-hidden` (section cards, tile rows, scroll regions),
 *    so the popover is not clipped by any of them.
 *  - It's the same root we already mount React into
 *    (`render.jsx` -> `getElementById('scan-root')`), so we know
 *    the element always exists when our component renders.
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
import type { ThresholdLine } from '@/common/hooks/useMetric';

export type InfoTooltipAnchor = 'auto' | 'left' | 'right';

interface InfoTooltipProps {
    /** Heading shown bold at the top of the popover. */
    title?: string;
    /** Body text — supports a few short lines. */
    description: string;
    /**
     * Threshold rows for the THRESHOLDS section, typically derived
     * from a tile's `MetricThresholds` via `deriveThresholdLines`.
     * Rendered as colour-coded "Healthy / Warning / Critical" rows
     * so the popover answers "what counts as good?" at a glance.
     * When omitted, no THRESHOLDS section is rendered.
     */
    thresholdLines?: ThresholdLine[];
    /**
     * Optional supplemental sentence shown beneath the threshold rows
     * (or as the entire section body when `thresholdLines` is omitted
     * — e.g. "No fixed threshold; watch trend"). Use this to clarify
     * unit mismatches, cite threshold sources, or explain qualitative
     * thresholds for trend-only metrics.
     */
    thresholdNote?: string;
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

// Tone → text colour for the threshold labels in the popover. We use
// slightly brighter shades than the dashboard headline palette
// because the popover background is dark slate-900 and the headline
// palette is tuned for the white tile background — same colour roles
// (sky/amber/red), shifted up a step for legibility on dark.
const THRESHOLD_TONE_TEXT: Record<ThresholdLine['tone'], string> = {
    healthy: 'text-emerald-400',
    warning: 'text-amber-400',
    critical: 'text-red-400',
    unknown: 'text-slate-300',
};

const THRESHOLD_TONE_DOT: Record<ThresholdLine['tone'], string> = {
    healthy: 'bg-emerald-400',
    warning: 'bg-amber-400',
    critical: 'bg-red-400',
    unknown: 'bg-slate-400',
};

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
    thresholdLines,
    thresholdNote,
    footnote,
    anchor = 'auto',
    iconAriaLabel = 'What does this mean?',
    className,
}) => {
    // The THRESHOLDS section is rendered when *either* the structured
    // rows or the supplemental note is provided. For tiles with no
    // fixed numeric threshold (e.g. "Active devices" — a trend-only
    // metric), the caller passes only `thresholdNote`, and the section
    // becomes "Operational signal — watch the trend".
    const showThresholds =
        (Array.isArray(thresholdLines) && thresholdLines.length > 0) ||
        Boolean(thresholdNote);
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
        // showThresholds is included so the popover repositions when
        // the THRESHOLDS section grows or shrinks the body height
        // (e.g. switching between tiles with 3 threshold rows and
        // tiles with only a note).
    }, [isOpen, anchor, description, title, footnote, showThresholds]);

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

    // Portal target: `#scan-root` (the React mount node) rather than
    // `document.body`. Tailwind utilities are scoped under #scan-root
    // via `important: '#scan-root'` in tailwind.config.js, so anything
    // rendered outside that scope gets no styling at all - which
    // shipped briefly in the previous revision and made the popover
    // render as raw text. SSR-safe fallback to `body` in the
    // theoretical case the element is missing; in practice render.jsx
    // ensures it exists before mounting React.
    const portalTarget =
        typeof document === 'undefined'
            ? null
            : document.getElementById('scan-root') ?? document.body;

    const popover =
        isOpen && portalTarget
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
                      {showThresholds && (
                          <span className="block mt-3 pt-2.5 border-t border-slate-700">
                              {/* Section header. Mirrors the all-caps
                                  treatment of "DESCRIPTION/VALUE" in
                                  the reference design: a tight, sky-
                                  blue label that primes the eye for a
                                  short data block below. */}
                              <span className="block text-sky-400 text-[11px] font-bold tracking-wider mb-1.5 uppercase">
                                  Thresholds
                              </span>
                              {Array.isArray(thresholdLines) && thresholdLines.length > 0 && (
                                  <span className="block space-y-1">
                                      {thresholdLines.map((line) => (
                                          <span
                                              key={`${line.tone}-${line.label}`}
                                              className="flex items-baseline gap-2"
                                          >
                                              <span
                                                  aria-hidden="true"
                                                  className={cn(
                                                      'inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 translate-y-[1px]',
                                                      THRESHOLD_TONE_DOT[line.tone]
                                                  )}
                                              />
                                              <span
                                                  className={cn(
                                                      'font-semibold w-[68px] flex-shrink-0',
                                                      THRESHOLD_TONE_TEXT[line.tone]
                                                  )}
                                              >
                                                  {line.label}
                                              </span>
                                              <span className="text-slate-200 font-mono text-[12.5px]">
                                                  {line.value}
                                              </span>
                                          </span>
                                      ))}
                                  </span>
                              )}
                              {thresholdNote && (
                                  <span
                                      className={cn(
                                          'block text-slate-300 text-[12.5px] leading-snug',
                                          Array.isArray(thresholdLines) && thresholdLines.length > 0
                                              ? 'mt-1.5'
                                              : ''
                                      )}
                                  >
                                      {thresholdNote}
                                  </span>
                              )}
                          </span>
                      )}
                      {footnote && (
                          <span className="block mt-2.5 pt-2 border-t border-slate-700 text-slate-400 italic text-[11.5px] font-mono break-all leading-snug">
                              {footnote}
                          </span>
                      )}
                  </span>,
                  portalTarget
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
