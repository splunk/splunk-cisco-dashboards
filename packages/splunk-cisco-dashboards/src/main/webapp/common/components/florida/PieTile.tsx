/**
 * PieTile — compatibility renderer for categorical composition rows.
 *
 * Sibling of {@link BarBreakdownTile}; used when a canvas tile selects
 * `splunk.pie`. The catalogue value is preserved for backwards compatibility,
 * but the UI intentionally renders Splunk's current horizontal Bar
 * visualization: ranked bars make category magnitude and long labels much
 * easier to compare than pie angles. Accepts the same `useTableData` row shape
 * (first column = category label, second = numeric value).
 */

import React, { useMemo, useState } from 'react';
import { ChartFocusDialog } from './ChartFocusDialog';
import { InfoTooltip, type InfoTooltipAnchor } from './InfoTooltip';
import { TileActionMenu } from './TileActionMenu';
import { cn } from '@/common/lib/utils';
import { C3_SERIES_PALETTE } from '@/common/theme/c3VisualizationPalette';
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
    /** Optional bar colours from `viz_options.seriesColors`. */
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

// The Studio charting bundle is substantial. Load it only when a legacy
// composition tile is actually visible instead of charging every Insights
// Workspace visit for a renderer that most workspaces never use.
const StudioBar = React.lazy(() => import('@splunk/visualizations/Bar'));

const ChartLoadingState: React.FC = () => (
    <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-400 dark:text-slate-500">
        Loading chart…
    </div>
);

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
            <span className="text-xs font-medium text-slate-400 dark:text-slate-500 mt-0.5 leading-tight">
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
    const [isFocusOpen, setIsFocusOpen] = useState(false);
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
        return C3_SERIES_PALETTE;
    }, [seriesColors]);

    // Dashboard Studio visualizations consume columnar search results rather
    // than row objects. Keeping this adapter here lets the profile and
    // Searchbase Canvas reuse the native Splunk renderer while older catalogue
    // entries continue to declare `splunk.pie`.
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
            // Native Bar uses Dashboard Studio's dynamic-options expressions.
            x: '> primary | seriesByIndex(0)',
            y: '> primary | seriesByIndex(1)',
            stackMode: 'auto',
            dataValuesDisplay: 'all',
            legendDisplay: 'off',
            xAxisTitleVisibility: 'hide',
            yAxisTitleVisibility: 'hide',
            xAxisLabelVisibility: 'show',
            yAxisLabelVisibility: 'show',
            showXMajorGridLines: false,
            showYMajorGridLines: false,
            seriesColors: colors,
            backgroundColor: isDark ? '#131a23' : '#ffffff',
        }),
        [colors, isDark]
    );
    const focusStudioOptions = useMemo(
        () => ({ ...studioOptions, backgroundColor: '#131a23' }),
        [studioOptions]
    );
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
                        <TileActionMenu
                            label={label}
                            onOpenInSearch={onOpenInSearch}
                            onOpenDetailTable={onOpenDetailTable}
                            detailTableTitle={detailTableTitle}
                            onExpand={hasData ? () => setIsFocusOpen(true) : undefined}
                            onConfigure={onConfigure}
                            isCustomized={isCustomized}
                        />
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
                    aria-label={`${label} ranked horizontal bar chart. Total ${formatCount(total)}.`}
                    title="Ranked category values are shown on the chart"
                    data-tile-control="true"
                    className="relative mt-0.5 flex min-h-[118px] flex-1"
                >
                    <React.Suspense fallback={<ChartLoadingState />}>
                        <StudioBar
                            width="100%"
                            height="100%"
                            themeKey={isDark ? 'enterpriseDark' : 'enterpriseLight'}
                            options={studioOptions}
                            dataSources={studioDataSources}
                        />
                    </React.Suspense>
                    <span className="pointer-events-none absolute left-1 top-1 rounded bg-white/90 px-1.5 py-0.5 text-xs font-bold tabular-nums text-slate-600 shadow-sm ring-1 ring-slate-200/80 dark:bg-slate-950/90 dark:text-slate-200 dark:ring-slate-700/80">
                        Total {formatCount(total)}
                    </span>
                    {overflowCount > 0 && (
                        <span className="pointer-events-none absolute bottom-0 left-1 z-10 rounded bg-white/85 px-1 text-xs italic text-slate-400 dark:bg-slate-950/85 dark:text-slate-500">
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

            <ChartFocusDialog
                isOpen={isFocusOpen && hasData}
                label={label}
                subLabel={subLabel}
                onClose={() => setIsFocusOpen(false)}
                onOpenInSearch={onOpenInSearch}
                onOpenDetailTable={onOpenDetailTable}
                detailTableTitle={detailTableTitle}
            >
                <div
                    role="img"
                    aria-label={`Expanded ${label} ranked horizontal bar chart. Total ${formatCount(total)}.`}
                    className="relative h-full min-h-[320px] rounded-[10px] border border-[#1e3449] bg-[#0e1a2b] p-3"
                >
                    <React.Suspense fallback={<ChartLoadingState />}>
                        <StudioBar
                            width="100%"
                            height="100%"
                            themeKey="enterpriseDark"
                            options={focusStudioOptions}
                            dataSources={studioDataSources}
                        />
                    </React.Suspense>
                    <span className="pointer-events-none absolute left-4 top-4 rounded bg-slate-950/90 px-2 py-1 text-xs font-bold tabular-nums text-slate-200 shadow-sm ring-1 ring-slate-700/80">
                        Total {formatCount(total)}
                    </span>
                    {overflowCount > 0 && (
                        <span className="pointer-events-none absolute bottom-3 left-4 rounded bg-slate-950/85 px-1.5 py-0.5 text-xs italic text-slate-500">
                            +{overflowCount} more
                        </span>
                    )}
                </div>
            </ChartFocusDialog>
        </div>
    );
};
