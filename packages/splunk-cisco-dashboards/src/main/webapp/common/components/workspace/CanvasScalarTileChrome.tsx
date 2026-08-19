/**
 * Shared header chrome for Searchbase Canvas scalar/gauge tiles.
 *
 * The header renders up to three rows in this fixed order:
 *
 *   1. TITLE — bold sentence-case tile label plus the action buttons
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
import { InfoTooltip, type InfoTooltipAnchor } from './InfoTooltip';
import { TileActionMenu, TileDrilldownButton } from './TileActionMenu';
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
                className="absolute top-1 right-2 w-1.5 h-1.5 rounded-full sui-bg-warning animate-pulse"
                title="Loading saved search…"
            />
        )}
        {source === 'live' && (
            <span
                className="absolute top-1 right-2 w-1.5 h-1.5 rounded-full sui-bg-positive"
                title="Wired to saved search (live)"
            />
        )}

        <div data-tile-control="true" className="flex flex-col mb-0.5">
            <span className="sui-color-default font-bold sui-color-active tracking-tight leading-tight flex items-center gap-1">
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
                    <TileDrilldownButton
                        label={label}
                        onOpenDetailTable={onOpenDetailTable}
                        detailTableTitle={detailTableTitle}
                    />
                    <TileActionMenu
                        label={label}
                        onOpenInSearch={onOpenInSearch}
                        onConfigure={onConfigure}
                        isCustomized={isCustomized}
                    />
                </span>
            </span>
            {meaningSubtitle && (
                <span
                    className="sui-color-default font-medium tracking-tight leading-snug truncate"
                    title={meaningSubtitle}
                >
                    {meaningSubtitle}
                </span>
            )}
            {subLabel && (
                <span className="sui-color-default  sui-color-muted font-medium tracking-tight leading-tight line-clamp-1 min-h-[12px]">
                    {subLabel}
                </span>
            )}
        </div>
        {children}
    </div>
);
