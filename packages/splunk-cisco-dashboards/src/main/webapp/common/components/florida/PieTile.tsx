/**
 * PieTile — categorical pie chart for `[label, value]` table rows.
 *
 * Sibling of {@link BarBreakdownTile}; used when a canvas tile selects
 * `splunk.pie`. Accepts the same `useTableData` row shape (first column
 * = slice label, second = numeric value).
 */

import React, { useMemo } from 'react';
import StudioPie from '@splunk/visualizations/Pie';
import { ExternalLink, Settings2, Table2 } from 'lucide-react';
import { InfoTooltip, type InfoTooltipAnchor } from './InfoTooltip';
import { cn } from '@/common/lib/utils';
import type { DataSource, NoDataReason } from '@/common/hooks/useMetric';

interface PieTileProps {
    label: string;
    subLabel?: string;
    description?: string;
    descriptionFootnote?: string;
    thresholdNote?: string;
    infoAnchor?: InfoTooltipAnchor;
    rows: ReadonlyArray<Record<string, unknown>>;
    columns: ReadonlyArray<string>;
    /** Optional slice colours from `viz_options.seriesColors`. */
    seriesColors?: ReadonlyArray<string>;
    source?: DataSource;
    onOpenInSearch?: () => void;
    onOpenDetailTable?: () => void;
    detailTableTitle?: string;
    onConfigure?: () => void;
    isCustomized?: boolean;
    noDataReason?: NoDataReason;
    rangeLabel?: string;
    visibleSliceCap?: number;
    /** Selects the matching Dashboard Studio chart theme. */
    isDark?: boolean;
    className?: string;
}

const DEFAULT_SLICE_CAP = 8;

const PIE_FALLBACK_COLORS = [
    '#0ea5e9',
    '#8b5cf6',
    '#f59e0b',
    '#10b981',
    '#f43f5e',
    '#6366f1',
    '#14b8a6',
    '#ec4899',
];

const coerceNumber = (raw: unknown): number => {
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    if (typeof raw === 'string') {
        const n = Number(raw.trim());
        return Number.isFinite(n) ? n : 0;
    }
    return 0;
};

const formatCount = (n: number): string =>
    n.toLocaleString(undefined, { maximumFractionDigits: 0 });

const NoDataState: React.FC<{
    noDataReason?: NoDataReason;
    rangeLabel?: string;
    source?: DataSource;
}> = ({ noDataReason, rangeLabel, source }) => {
    let subtext: string;
    if (source === 'loading') {
        subtext = 'loading…';
    } else if (noDataReason === 'error') {
        subtext = 'search failed';
    } else if (noDataReason === 'empty_rows') {
        subtext = rangeLabel
            ? `0 rows · ${rangeLabel.toLowerCase()}`
            : '0 rows returned';
    } else {
        subtext = rangeLabel
            ? `no data · ${rangeLabel.toLowerCase()}`
            : 'no data';
    }
    return (
        <div className="flex flex-col items-start mb-1">
            <span className="text-4xl font-black tracking-tighter leading-none text-slate-400 dark:text-slate-500">
                —
            </span>
            <span className="text-[9px] font-medium text-slate-400 dark:text-slate-500 mt-0.5 leading-tight">
                {subtext}
            </span>
        </div>
    );
};

export const PieTile: React.FC<PieTileProps> = ({
    label,
    subLabel,
    description,
    descriptionFootnote,
    thresholdNote,
    infoAnchor = 'auto',
    rows,
    columns,
    seriesColors,
    source,
    onOpenInSearch,
    onOpenDetailTable,
    detailTableTitle,
    onConfigure,
    isCustomized = false,
    noDataReason,
    rangeLabel,
    visibleSliceCap = DEFAULT_SLICE_CAP,
    isDark = false,
    className,
}) => {
    const dimensionCol = columns[0];
    const valueCol = columns[1];

    const chartData = useMemo(() => {
        if (!dimensionCol || !valueCol) return [];
        const buckets = new Map<string, number>();
        for (const r of rows) {
            const dimRaw = r[dimensionCol];
            const key =
                typeof dimRaw === 'string'
                    ? dimRaw.trim()
                    : dimRaw === null || dimRaw === undefined
                    ? ''
                    : String(dimRaw);
            if (key === '') continue;
            buckets.set(key, (buckets.get(key) ?? 0) + coerceNumber(r[valueCol]));
        }
        return Array.from(buckets.entries())
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [rows, dimensionCol, valueCol]);

    const visibleSlices = useMemo(
        () => chartData.slice(0, visibleSliceCap),
        [chartData, visibleSliceCap]
    );
    const overflowCount = Math.max(0, chartData.length - visibleSlices.length);
    const hasData = visibleSlices.length > 0;
    const total = chartData.reduce((acc, e) => acc + e.value, 0);

    const colors = useMemo(() => {
        const fromOptions = (seriesColors ?? []).filter(
            (c) => typeof c === 'string' && /^#[0-9a-f]{3,8}$/i.test(c.trim())
        );
        if (fromOptions.length > 0) return fromOptions.map((c) => c.trim());
        return PIE_FALLBACK_COLORS;
    }, [seriesColors]);

    // Dashboard Studio visualizations consume columnar search results rather
    // than Recharts' row objects. Keeping this adapter here lets the profile,
    // Searchbase Canvas, and any future overview reuse the same native
    // `splunk.pie` renderer that Studio itself ships.
    const studioDataSources = useMemo(
        () => ({
            primary: {
                requestParams: { offset: 0, count: visibleSlices.length },
                data: {
                    fields: [
                        { name: dimensionCol || 'Label', type: 'string' },
                        {
                            name: valueCol || 'Value',
                            type: 'number',
                            type_special: 'count',
                        },
                    ],
                    columns: [
                        visibleSlices.map((slice) => slice.name),
                        visibleSlices.map((slice) => String(slice.value)),
                    ],
                },
                meta: { totalCount: visibleSlices.length },
            },
        }),
        [dimensionCol, valueCol, visibleSlices]
    );

    const studioOptions = useMemo(
        () => ({
            label: dimensionCol,
            value: valueCol,
            showDonutHole: false,
            labelDisplay: 'valuesAndPercentage',
            percentagePrecision: 1,
            collapseThreshold: 0,
            collapseExcludeZero: true,
            collapseLabel: 'Other',
            legendDisplay: 'right',
            seriesColors: colors,
            backgroundColor: isDark ? '#0f172a' : '#ffffff',
        }),
        [colors, dimensionCol, isDark, valueCol]
    );
    const zoomOriginClass =
        infoAnchor === 'right'
            ? 'origin-right'
            : infoAnchor === 'left'
            ? 'origin-left'
            : 'origin-center';

    return (
        <div
            className={cn(
                'flex flex-col flex-1 basis-0 min-w-[140px] px-1.5 py-1 relative',
                className
            )}
        >
            {source && (
                <span
                    className={cn(
                        'absolute top-1 right-2 w-1.5 h-1.5 rounded-full',
                        source === 'live'
                            ? 'bg-emerald-500'
                            : source === 'loading'
                            ? 'bg-amber-400 animate-pulse'
                            : 'bg-slate-300'
                    )}
                    title={
                        source === 'live'
                            ? 'Wired to saved search (live)'
                            : source === 'loading'
                            ? 'Loading saved search…'
                            : 'No saved search assigned'
                    }
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

            {hasData ? (
                <div
                    role="img"
                    data-tile-control="true"
                    tabIndex={0}
                    aria-label={`${label} pie chart. Total ${formatCount(total)}. Hover or focus to enlarge.`}
                    title="Values and percentages are shown on the chart · Hover to enlarge"
                    className={cn(
                        'group/piezoom relative z-0 mt-0.5 flex min-h-[118px] flex-1 overflow-visible rounded-md',
                        'focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400',
                        'hover:z-30 focus-within:z-30'
                    )}
                >
                    <div
                        className={cn(
                            'absolute inset-0 transform-gpu rounded-md transition-[transform,box-shadow,background-color] duration-200 ease-out',
                            'group-hover/piezoom:scale-[1.28] group-focus-within/piezoom:scale-[1.28]',
                            'group-hover/piezoom:bg-white group-hover/piezoom:shadow-2xl group-hover/piezoom:ring-1 group-hover/piezoom:ring-sky-300',
                            'dark:group-hover/piezoom:bg-slate-900 dark:group-hover/piezoom:ring-sky-700',
                            'group-focus-within/piezoom:bg-white group-focus-within/piezoom:shadow-2xl group-focus-within/piezoom:ring-1 group-focus-within/piezoom:ring-sky-300',
                            'dark:group-focus-within/piezoom:bg-slate-900 dark:group-focus-within/piezoom:ring-sky-700',
                            zoomOriginClass
                        )}
                    >
                        <StudioPie
                            width="100%"
                            height="100%"
                            themeKey={isDark ? 'enterpriseDark' : 'enterpriseLight'}
                            options={studioOptions}
                            dataSources={studioDataSources}
                        />
                        <span className="pointer-events-none absolute left-1 top-1 rounded bg-white/90 px-1.5 py-0.5 text-[9px] font-bold tabular-nums text-slate-600 shadow-sm ring-1 ring-slate-200/80 dark:bg-slate-950/90 dark:text-slate-200 dark:ring-slate-700/80">
                            Total {formatCount(total)}
                        </span>
                    </div>
                    {overflowCount > 0 && (
                        <span className="pointer-events-none absolute bottom-0 left-1 z-10 rounded bg-white/85 px-1 text-[9px] italic text-slate-400 dark:bg-slate-950/85 dark:text-slate-500">
                            +{overflowCount} more
                        </span>
                    )}
                </div>
            ) : (
                <NoDataState
                    noDataReason={noDataReason}
                    rangeLabel={rangeLabel}
                    source={source}
                />
            )}
        </div>
    );
};
