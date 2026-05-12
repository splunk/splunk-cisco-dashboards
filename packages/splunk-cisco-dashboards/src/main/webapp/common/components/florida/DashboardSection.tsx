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
    return (
        <div
            className={cn(
                'bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2.5 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.1)] dark:shadow-[0_4px_20px_-10px_rgba(0,0,0,0.45)] relative overflow-hidden group flex flex-col',
                className
            )}
        >
            <div className="absolute top-0 left-0 w-1.5 h-full bg-sky-100 dark:bg-sky-900/40 group-hover:bg-sky-600 dark:group-hover:bg-sky-500 transition-colors" />

            <div className="flex items-center justify-between mb-1.5">
                <h3 className="text-[14px] font-black text-sky-950 dark:text-sky-100 uppercase tracking-tight leading-none">
                    {title}
                </h3>
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

            <div className="mt-1.5 pt-1.5 border-t border-slate-50 dark:border-slate-800">
                <a
                    href={href ?? '#'}
                    aria-disabled={!href}
                    target={href ? '_blank' : undefined}
                    rel={href ? 'noopener noreferrer' : undefined}
                    onClick={(e) => {
                        if (!href) e.preventDefault();
                    }}
                    className={cn(
                        'inline-flex items-center text-[11px] font-black uppercase tracking-wider transition-colors group/link',
                        href
                            ? 'text-sky-600 hover:text-sky-700 dark:text-sky-300 dark:hover:text-sky-200 cursor-pointer'
                            : 'text-slate-400 dark:text-slate-600 cursor-not-allowed'
                    )}
                >
                    <ChevronRight className="w-3 h-3 mr-0.5 group-hover/link:translate-x-0.5 transition-transform" />
                    {linkText}
                    <ArrowUpRight className="w-3 h-3 ml-1 opacity-0 -translate-y-0.5 translate-x-0.5 group-hover/link:opacity-100 group-hover/link:translate-y-0 group-hover/link:translate-x-0 transition-all" />
                </a>
            </div>
        </div>
    );
};
