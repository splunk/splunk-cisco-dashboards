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
import { useSplunkTheme } from '@splunk/themes';
import { ChartFocusDialog } from './ChartFocusDialog';
import {
    InfoTooltip,
    type InfoTooltipAnchor,
    type InfoTooltipDetailSection,
} from './InfoTooltip';
import { TileActionMenu, TileDrilldownButton } from './TileActionMenu';
import { cn } from '@/common/lib/utils';
import { C3_SERIES_PALETTE } from '@/common/theme/c3VisualizationPalette';
import type { DataSource, NoDataReason } from '@/common/hooks/useMetric';

interface PieTileProps {
    label: string;
    subLabel?: string;
    description?: string;
    infoSections?: readonly InfoTooltipDetailSection[];
    descriptionFootnote?: string;
    thresholdNote?: string;
    infoAnchor?: InfoTooltipAnchor;
    rows: ReadonlyArray<Record<string, unknown>>;
    columns: ReadonlyArray<string>;
    /** Optional bar colours from `viz_options.seriesColors`. */
    seriesColors?: ReadonlyArray<string>;
    source?: DataSource;
    onOpenInSearch?: () => void;
    searchbaseId?: string;
    onOpenDetailTable?: () => void;
    detailTableTitle?: string;
    onConfigure?: () => void;
    isCustomized?: boolean;
    noDataReason?: NoDataReason;
    rangeLabel?: string;
    visibleSliceCap?: number;
    className?: string;
}

const DEFAULT_SLICE_CAP = 8;

// The Studio charting bundle is substantial. Load it only when a legacy
// composition tile is actually visible instead of charging every Insights
// Workspace visit for a renderer that most workspaces never use.
const StudioBar = React.lazy(() => import('@splunk/visualizations/Bar'));

const ChartLoadingState: React.FC = () => (
    <div className="flex h-full w-full items-center justify-center text-xs font-semibold  sui-color-muted">
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
    } else if (noDataReason === 'capacity_limited') {
        subtext = 'search slots busy · refresh after searches finish';
    } else if (noDataReason === 'dispatch_failed' || noDataReason === 'job_failed' || noDataReason === 'error') {
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
            <span className="text-4xl font-black tracking-tighter leading-none  sui-color-muted">
                —
            </span>
            <span className="text-xs font-medium  sui-color-muted mt-0.5 leading-tight">
                {subtext}
            </span>
        </div>
    );
};

export const PieTile: React.FC<PieTileProps> = ({
    label,
    subLabel,
    description,
    infoSections,
    descriptionFootnote,
    thresholdNote,
    infoAnchor = 'auto',
    rows,
    columns,
    seriesColors,
    source,
    onOpenInSearch,
    searchbaseId,
    onOpenDetailTable,
    detailTableTitle,
    onConfigure,
    isCustomized = false,
    noDataReason,
    rangeLabel,
    visibleSliceCap = DEFAULT_SLICE_CAP,
    className,
}) => {
    const [isFocusOpen, setIsFocusOpen] = useState(false);
    const theme = useSplunkTheme();
    const chartThemeKey = theme.colorScheme === 'dark' ? 'enterpriseDark' : 'enterprise';
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
            backgroundColor: theme.backgroundColorSection,
        }),
        [colors, theme.backgroundColorSection]
    );
    const focusStudioOptions = useMemo(
        () => ({ ...studioOptions, backgroundColor: theme.backgroundColorSection }),
        [studioOptions, theme.backgroundColorSection]
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
                            ? 'sui-bg-positive'
                            : source === 'loading'
                            ? 'sui-bg-warning animate-pulse'
                            : 'sui-bg-floating'
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
                <span className="sui-color-default font-bold sui-color-active tracking-tight leading-tight flex items-center gap-1">
                    <span className="flex items-center gap-1 min-w-0 truncate">{label}</span>
                    <span className="ml-auto flex items-center gap-0.5 flex-shrink-0">
                        {description && (
                            <InfoTooltip
                                title={label}
                                description={description}
                                detailSections={infoSections}
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
                            searchbaseId={searchbaseId}
                            onExpand={hasData ? () => setIsFocusOpen(true) : undefined}
                            onConfigure={onConfigure}
                            isCustomized={isCustomized}
                        />
                    </span>
                </span>
                {subLabel && (
                    <span className="sui-color-default  sui-color-muted font-medium tracking-tight leading-tight line-clamp-1 min-h-[12px]">
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
                            themeKey={chartThemeKey}
                            options={studioOptions}
                            dataSources={studioDataSources}
                        />
                    </React.Suspense>
                    <span className="pointer-events-none absolute left-1 top-1 rounded  px-1.5 py-0.5 text-xs font-bold tabular-nums  shadow-sm ring-1 sui-focus-ring sui-bg-page sui-color-active sui-focus-ring">
                        Total {formatCount(total)}
                    </span>
                    {overflowCount > 0 && (
                        <span className="pointer-events-none absolute bottom-0 left-1 z-10 rounded  px-1 text-xs italic  sui-bg-page sui-color-muted">
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
                    className="relative h-full min-h-[320px] rounded-[10px] border sui-border-default sui-bg-section p-3"
                >
                    <React.Suspense fallback={<ChartLoadingState />}>
                        <StudioBar
                            width="100%"
                            height="100%"
                            themeKey={chartThemeKey}
                            options={focusStudioOptions}
                            dataSources={studioDataSources}
                        />
                    </React.Suspense>
                    <span className="pointer-events-none absolute left-4 top-4 rounded sui-bg-page px-2 py-1 text-xs font-bold tabular-nums sui-color-active shadow-sm ring-1 sui-focus-ring">
                        Total {formatCount(total)}
                    </span>
                    {overflowCount > 0 && (
                        <span className="pointer-events-none absolute bottom-3 left-4 rounded sui-bg-page px-1.5 py-0.5 text-xs italic sui-color-muted">
                            +{overflowCount} more
                        </span>
                    )}
                </div>
            </ChartFocusDialog>
        </div>
    );
};
