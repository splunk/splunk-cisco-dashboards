/**
 * Shared header chrome for Searchbase Canvas scalar/gauge tiles.
 */

import React from 'react';
import { ExternalLink, Settings2, Table2 } from 'lucide-react';
import { InfoTooltip, type InfoTooltipAnchor } from './InfoTooltip';
import { cn } from '@/common/lib/utils';
import type { DataSource } from '@/common/hooks/useMetric';

export interface CanvasScalarTileChromeProps {
    label: string;
    subLabel?: string;
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
                            <ExternalLink className="w-3 h-3 stroke-[2.5px]" />
                        </button>
                    )}
                    {onOpenDetailTable && (
                        <button
                            type="button"
                            onClick={onOpenDetailTable}
                            title={detailTableTitle ?? 'View detail table'}
                            aria-label={detailTableTitle ?? `View ${label} detail table`}
                            data-tile-control="true"
                            className="p-0.5 -my-0.5 text-slate-300 dark:text-slate-500 hover:text-sky-600 dark:hover:text-sky-300 transition-colors rounded focus:outline-none focus:ring-1 focus:ring-sky-400"
                        >
                            <Table2 className="w-3 h-3 stroke-[2.5px]" />
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
                            <Settings2 className="w-3 h-3 stroke-[2.5px]" />
                            {isCustomized && (
                                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-sky-500 border border-white dark:border-slate-900" />
                            )}
                        </button>
                    )}
                </span>
            </span>
            {subLabel && (
                <span className="text-[9.5px] text-slate-400 dark:text-slate-500 font-medium tracking-tight leading-tight line-clamp-1 min-h-[12px]">
                    {subLabel}
                </span>
            )}
        </div>
        {children}
    </div>
);
