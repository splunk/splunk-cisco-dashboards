import React from 'react';
import { ChevronRight, ArrowUpRight, Minus, Plus } from 'lucide-react';
import { cn } from '@/common/lib/utils';

interface TileCountControlConfig {
    /** Currently visible tile count. */
    value: number;
    /** Lower bound (inclusive). Buttons disable when value === min. */
    min: number;
    /** Upper bound (inclusive). Buttons disable when value === max. */
    max: number;
    /** Called with the new count after clicking − or +. Caller is responsible
     *  for clamping; the pill will not invoke onChange when at a bound. */
    onChange: (next: number) => void;
    /** Optional aria/title prefix, e.g. "IT Health tiles". Defaults to "Tiles". */
    label?: string;
}

interface DashboardSectionProps {
    title: string;
    linkText: string;
    /**
     * Splunk view name (without app prefix). Resolved relative to the
     * current app, so {href: 'it_health_v1'} navigates to
     * `/<locale>/app/splunk-cisco-dashboards/it_health_v1`. If omitted
     * the link is non-interactive.
     */
    href?: string;
    children: React.ReactNode;
    className?: string;
    /**
     * When provided, renders a small `−  N  +` pill at the right of
     * the section header so the user can dial the visible tile count
     * up or down. Omit to suppress the control entirely (legacy
     * callers continue to work unchanged).
     */
    tileCount?: TileCountControlConfig;
}

const TileCountPill: React.FC<TileCountControlConfig> = ({
    value,
    min,
    max,
    onChange,
    label = 'Tiles',
}) => {
    const atMin = value <= min;
    const atMax = value >= max;
    return (
        <div
            // The pill is purely a layout preference, not a data
            // affordance — so it whispers rather than shouts. Same
            // colour vocabulary as the section's "Open …" footer
            // link so it reads as part of the chrome.
            className={cn(
                'inline-flex items-center gap-0.5 rounded-md',
                'border border-slate-200 dark:border-slate-700',
                'bg-slate-50/80 dark:bg-slate-800/60',
                'text-slate-600 dark:text-slate-300',
                'select-none'
            )}
            role="group"
            aria-label={`${label}: ${value} of ${max}`}
        >
            <button
                type="button"
                onClick={() => !atMin && onChange(value - 1)}
                disabled={atMin}
                aria-label={`Show fewer ${label.toLowerCase()}`}
                title={atMin ? `Minimum ${min} ${label.toLowerCase()}` : `Show ${value - 1} ${label.toLowerCase()}`}
                className={cn(
                    'flex items-center justify-center w-5 h-5 rounded-l-md',
                    'transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-sky-400',
                    atMin
                        ? 'opacity-40 cursor-not-allowed'
                        : 'hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer'
                )}
            >
                <Minus className="w-3 h-3" />
            </button>
            <span
                // tabular-nums keeps the pill width steady as the
                // user clicks through 3/4/5 — otherwise the +/-
                // buttons jitter sideways on every press.
                className="text-[11px] font-semibold tabular-nums leading-none w-3 text-center"
                aria-hidden="true"
            >
                {value}
            </span>
            <button
                type="button"
                onClick={() => !atMax && onChange(value + 1)}
                disabled={atMax}
                aria-label={`Show more ${label.toLowerCase()}`}
                title={atMax ? `Maximum ${max} ${label.toLowerCase()}` : `Show ${value + 1} ${label.toLowerCase()}`}
                className={cn(
                    'flex items-center justify-center w-5 h-5 rounded-r-md',
                    'transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-sky-400',
                    atMax
                        ? 'opacity-40 cursor-not-allowed'
                        : 'hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer'
                )}
            >
                <Plus className="w-3 h-3" />
            </button>
        </div>
    );
};

export const DashboardSection: React.FC<DashboardSectionProps> = ({
    title,
    linkText,
    href,
    children,
    className,
    tileCount,
}) => {
    // Build 101 (2026-05-13): the drill-down link moved from a
    // bottom footer row up onto the section title itself. On short
    // viewports the footer was the first thing to get clipped — Alan
    // showed a screenshot at ~600px viewport height where all three
    // "OPEN ..." links were partially obscured and unreachable, even
    // though the page already scrolled. Promoting the title to be
    // the click target solves three problems at once:
    //
    //   1. The section header is the most stable, always-on-top piece
    //      of section chrome — clipping it would imply the section
    //      itself isn't visible.
    //   2. ~36px of vertical chrome per section is reclaimed (3
    //      sections = ~108px back) without changing tile sizing,
    //      letting the chart canvas breathe at its previous floor
    //      height.
    //   3. One affordance to learn instead of two ("click the title
    //      OR the OPEN link").
    //
    // The `linkText` prop is repurposed as the hover/title tooltip
    // ("Open IT health (new tab)") so existing callers don't need
    // to change their contract.
    const titleNode = href ? (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            title={`${linkText} (new tab)`}
            // The whole title row is the hit target. We keep the
            // `<h3>` semantic underneath via aria-label so screen
            // readers still announce it as the section heading
            // first, then read the link role as secondary.
            className={cn(
                'inline-flex items-center gap-1.5 text-[14px] font-black uppercase tracking-tight leading-none transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-sky-400 rounded-sm group/link',
                'text-sky-950 hover:text-sky-700 dark:text-sky-100 dark:hover:text-sky-300'
            )}
        >
            <h3 className="leading-none">{title}</h3>
            {/* Affordance group: chevron nudges right on hover, an
                ArrowUpRight fades in to telegraph "opens new tab".
                Same animation language the old footer link used so
                the visual vocabulary stays consistent across the
                app — operators who learned the previous pattern
                see the same hover behaviour, just on a different
                element. */}
            <ChevronRight
                className="w-3.5 h-3.5 opacity-60 group-hover/link:opacity-100 group-hover/link:translate-x-0.5 transition-all"
                aria-hidden="true"
            />
            <ArrowUpRight
                className="w-3 h-3 -ml-1 opacity-0 -translate-y-0.5 translate-x-0.5 group-hover/link:opacity-100 group-hover/link:translate-y-0 group-hover/link:translate-x-0 transition-all"
                aria-hidden="true"
            />
        </a>
    ) : (
        <h3 className="text-[14px] font-black text-sky-950 dark:text-sky-100 uppercase tracking-tight leading-none">
            {title}
        </h3>
    );

    return (
        <div
            // `min-h-[180px]` is the legibility floor for a row of
            // tiles after the bottom drill-down footer was removed
            // (was 220px when the footer existed; -36px footer chrome
            // = -36px floor). Keeps the headline + sparkline canvas
            // at sizes the design intends:
            //   ~22px section header + ~4px gap +
            //   ~36px tile headline + ~72px chart floor +
            //   ~16px tile margins / section chrome ≈ 180px.
            // Below this the sparkline degenerates to a wavy pixel
            // line, so we cap there and let the page degrade to
            // vertical scroll via the parent column's `overflow-y-auto`
            // — same fixed-height-grid model Splunk Dashboard Studio
            // uses, just with a tighter floor since this layout has
            // less per-section chrome to amortise.
            className={cn(
                'bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2.5 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.1)] dark:shadow-[0_4px_20px_-10px_rgba(0,0,0,0.45)] relative overflow-hidden group flex flex-col flex-shrink-0 min-h-[180px]',
                className
            )}
        >
            <div className="absolute top-0 left-0 w-1.5 h-full bg-sky-100 dark:bg-sky-900/40 group-hover:bg-sky-600 dark:group-hover:bg-sky-500 transition-colors" />

            <div className="flex items-center justify-between mb-1.5">
                {titleNode}
                {tileCount && <TileCountPill {...tileCount} />}
            </div>

            {/*
              * Tile row is intentionally NOT `overflow-hidden`. An
              * earlier fix added that clip here as a chart-bleed
              * safety net, but it was a sledgehammer: it also clipped
              * floating UI rendered into descendant tiles - notably
              * the InfoTooltip popover, whose body would get truncated
              * mid-sentence when it tried to extend below the row. The
              * chart-bleed risk is now contained at the source by an
              * `overflow-hidden` on the chart container inside
              * MetricItem (the only descendant that ever produces
              * unbounded vertical content), so the row can stay open
              * and lets popovers/tooltips/menus extend out of the row
              * naturally. The InfoTooltip is also portaled to
              * `document.body`, which is a separate belt-and-braces
              * defense against any future ancestor clipping pattern.
              */}
            <div className="flex flex-wrap md:flex-nowrap gap-0 divide-x divide-slate-100 dark:divide-slate-800 flex-1 min-h-0">
                {children}
            </div>
        </div>
    );
};
