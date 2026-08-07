/**
 * Shared header chrome for Searchbase Canvas scalar/gauge tiles.
 *
 * The header renders up to three rows in this fixed order:
 *
 *   1. TITLE — bold uppercase tile label plus the action buttons
 *      (info, open-in-search, drilldown, configure).
 *   2. MEANING SUBTITLE (optional) — a short "what does this measure"
 *      sentence sourced upstream from `record.explanation` (with
 *      `record.description` as fallback). Single-line with ellipsis
 *      overflow; omitted entirely when the upstream record provides
 *      neither field, so existing tiles render unchanged.
 *   3. CATEGORY BREADCRUMB (optional) — the existing `subLabel` line
 *      ("Security / GenAI Protection", etc.).
 */

import React from 'react';
import { ExternalLink, PanelRightOpen, Settings2 } from '@/common/icons/SuiIcon';
import { InfoTooltip, type InfoTooltipAnchor } from './InfoTooltip';
import { cn } from '@/common/lib/utils';
import type { DataSource } from '@/common/hooks/useMetric';

export interface CanvasScalarTileChromeProps {
    label: string;
    /** Category / sub-category breadcrumb; rendered as the bottom header row. */
    subLabel?: string;
    /**
     * Short "what does this measure" sentence shown directly under the
     * title. App-wide chrome change introduced in Build 1224: every
     * scalar/gauge tile now renders this row when the upstream
     * searchbase record carries an `explanation` (or, as a fallback,
     * a `description`). Truncated to one line with ellipsis overflow;
     * omitted when neither field is present.
     */
    meaningSubtitle?: string;
    description?: string;
    descriptionFootnote?: string;
    thresholdNote?: string;
    infoAnchor?: InfoTooltipAnchor;
    source?: DataSource;
    onOpenInSearch?: () => void;
    onConfigure?: () => void;
    onOpenDetailTable?: () => void;
    detailTableTitle?: string;
    isCustomized?: boolean;
    className?: string;
    children: React.ReactNode;
}

export const CanvasScalarTileChrome: React.FC<CanvasScalarTileChromeProps> = ({
    label,
    subLabel,
    meaningSubtitle,
    description,
    descriptionFootnote,
    thresholdNote,
    infoAnchor = 'auto',
    source,
    onOpenInSearch,
    onConfigure,
    onOpenDetailTable,
    detailTableTitle,
    isCustomized = false,
    className,
    children,
}) => (
    <div
        className={cn(
            'flex flex-col flex-1 basis-0 min-w-[108px] px-1.5 py-1 relative',
            className
        )}
    >
        {source === 'loading' && (
            <span
                className="absolute top-1 right-2 w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"
                title="Loading saved search…"
            />
        )}
        {source === 'live' && (
            <span
                className="absolute top-1 right-2 w-1.5 h-1.5 rounded-full bg-emerald-500"
                title="Wired to saved search (live)"
            />
        )}

        <div data-tile-control="true" className="flex flex-col mb-0.5">
            <span className="text-[12px] font-bold text-slate-800 dark:text-slate-100 tracking-tight leading-tight uppercase flex items-center gap-1">
                <span className="flex items-center gap-1 min-w-0 truncate">{label}</span>
                <span className="ml-auto flex items-center gap-0.5 flex-shrink-0">
                    {description && (
                        <InfoTooltip
                            title={label}
                            description={description}
                            thresholdNote={thresholdNote}
                            footnote={descriptionFootnote}
                            anchor={infoAnchor}
                            iconAriaLabel={`What does ${label} measure?`}
                        />
                    )}
                    {onOpenInSearch && (
                        <button
                            type="button"
                            onClick={onOpenInSearch}
                            title="Open in Search"
                            aria-label={`Open ${label} in Search`}
                            data-tile-control="true"
                            className="p-0.5 -my-0.5 text-slate-300 dark:text-slate-500 hover:text-sky-600 dark:hover:text-sky-300 transition-colors rounded focus:outline-none focus:ring-1 focus:ring-sky-400"
                        >
                            <ExternalLink className="w-3.5 h-3.5 stroke-[2.4px]" />
                        </button>
                    )}
                    {onOpenDetailTable && (
                        <button
                            type="button"
                            onClick={onOpenDetailTable}
                            title={
                                detailTableTitle
                                    ? `Drill down: ${detailTableTitle}`
                                    : 'Drill down to details'
                            }
                            aria-label={`Drill down from ${label} to details`}
                            data-tile-control="true"
                            className="p-0.5 -my-0.5 text-slate-300 dark:text-slate-500 hover:text-sky-600 dark:hover:text-sky-300 transition-colors rounded focus:outline-none focus:ring-1 focus:ring-sky-400"
                        >
                            <PanelRightOpen className="w-3.5 h-3.5 stroke-[2.4px]" />
                        </button>
                    )}
                    {onConfigure && (
                        <button
                            type="button"
                            onClick={onConfigure}
                            title={
                                isCustomized
                                    ? `Configure ${label} (customised)`
                                    : `Configure ${label}`
                            }
                            aria-label={`Configure ${label} tile`}
                            data-tile-control="true"
                            className="p-0.5 -my-0.5 text-slate-300 dark:text-slate-500 hover:text-sky-600 dark:hover:text-sky-300 transition-colors rounded focus:outline-none focus:ring-1 focus:ring-sky-400 relative"
                        >
                            <Settings2 className="w-3.5 h-3.5 stroke-[2.4px]" />
                            {isCustomized && (
                                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-sky-500 border border-white dark:border-slate-900" />
                            )}
                        </button>
                    )}
                </span>
            </span>
            {meaningSubtitle && (
                <span
                    className="text-[10.5px] text-slate-500 dark:text-slate-400 font-medium tracking-tight leading-snug truncate"
                    title={meaningSubtitle}
                >
                    {meaningSubtitle}
                </span>
            )}
            {subLabel && (
                <span className="text-[9.5px] text-slate-400 dark:text-slate-500 font-medium tracking-tight leading-tight line-clamp-1 min-h-[12px]">
                    {subLabel}
                </span>
            )}
        </div>
        {children}
    </div>
);
