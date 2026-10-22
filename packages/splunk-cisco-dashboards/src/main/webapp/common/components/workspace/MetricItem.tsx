import React from 'react';
import useSplunkTheme from '@splunk/themes/useSplunkTheme';
import {
    ArrowDown,
    ArrowUp,
    AlertTriangle,
    AlertCircle,
    CheckCircle2,
} from '@/common/icons/SuiIcon';
import {
    Sparkline,
    type SparklineDensity,
    type SparklineVizType,
    type DataValuesDisplay,
} from './Sparkline';
import {
    InfoTooltip,
    type InfoTooltipAnchor,
    type InfoTooltipDetailSection,
} from './InfoTooltip';
import { WorkspaceModalShell } from './WorkspaceModalShell';
import { TileActionMenu, TileDrilldownButton } from './TileActionMenu';
import { cn } from '@/common/lib/utils';
import {
    formatCompactMetricNumber,
    formatMetricNumber,
    toFiniteMetricNumber,
} from '@/common/lib/metricValueFormat';
import { C3_VISUALIZATION_COLORS } from '@/common/theme/c3VisualizationPalette';
import type {
    MetricStatus,
    DataSource,
    TimeRange,
    NoDataReason,
    ThresholdLine,
} from '@/common/hooks/useMetric';

interface MetricItemProps {
    label: string;
    subLabel?: string;
    /**
     * Long-form description shown in a hover/focus Info tooltip. When
     * omitted, the info icon is not rendered.
     */
    description?: string;
    /** Complete metadata for this parent tile, separate from drill-down guidance. */
    infoSections?: readonly InfoTooltipDetailSection[];
    /**
     * Caption shown at the bottom of the Info tooltip — typically the
     * resolved SPL or saved-search name so consumers can trace the
     * displayed value back to its source.
     */
    descriptionFootnote?: string;
    /**
     * Structured rows for the THRESHOLDS section of the info popover.
     * Built upstream by `deriveThresholdLines(cfg.thresholds, cfg.unit)`
     * so the rendered ranges are guaranteed to match the
     * `computeStatus` rules that drive the live tile colour.
     */
    thresholdLines?: ThresholdLine[];
    /**
     * Optional supplemental sentence beneath the threshold rows. Use
     * for unit clarifications, threshold-source citations, or as the
     * sole content for tiles with no fixed numeric threshold.
     */
    thresholdNote?: string;
    /** Where the Info tooltip should anchor relative to the icon. */
    infoAnchor?: InfoTooltipAnchor;
    value: string | number;
    unit?: string;
    change?: number;
    sparkData: number[];
    previousData?: number[];
    /**
     * Tooltip label for the dashed comparison overlay on the sparkline.
     * Defaults to `'Prev'` (previous-period overlay). Baseline-overlay
     * tiles set this to `'Avg'` so the hover popover reads "Avg: 96"
     * rather than the misleading "Prev: 96".
     */
    previousLabel?: string;
    /**
     * Optional explicit timestamps (Unix-epoch ms) for `sparkData`.
     * Required for the hover tooltip to show real bucket times on
     * time-series searches; mock series fall back to synthesised
     * timestamps spread across {@link timeRange}.
     */
    sparkTimestamps?: number[];
    /**
     * Page-level dispatched time range. The Sparkline tooltip uses this
     * to synthesise per-bucket dates for single-row + mock series.
     */
    timeRange?: TimeRange;
    color?: string;
    /** Threshold-derived status; drives the headline colour + status icon. */
    status?: MetricStatus;
    /** Data provenance dot. */
    source?: DataSource;
    /**
     * Click → drilldown handler. Bound to the explicit "open in Search"
     * icon button next to the metric label *and* to clicks on the
     * sparkline area. When omitted, both affordances are hidden.
     */
    onOpenInSearch?: () => void;
    /** Native Search URL; preferred over callback popups when available. */
    openInSearchHref?: string;
    /** Searchbase stanza id used by the direct editor action. */
    searchbaseId?: string;
    /** Optional secondary action for contextual detail, distinct from Search. */
    onOpenDetailTable?: () => void;
    /** Tooltip / accessible label for the detail-table action. */
    detailTableTitle?: string;
    /**
     * Click → opens the KPI picker for this tile. When omitted, the
     * gear icon is hidden — useful for tiles that aren't user-editable.
     */
    onConfigure?: () => void;
    /**
     * When true, the tile is bound to a user-picked override; we render
     * a small "modified" dot on the gear so it's obvious which tiles
     * have been customised.
     */
    isCustomized?: boolean;
    sparkTitle?: string;
    /** Studio-like compact formatting for the headline value. */
    abbreviateMajorValue?: boolean;
    /** Studio-like compact formatting for the delta/trend value. */
    abbreviateTrendValue?: boolean;
    /**
     * Populated when {@link value} is `Number.NaN` to explain *why* the
     * tile is showing no data. The component uses this to render a
     * diagnostic subtext (e.g. "0 rows returned in last 7 days")
     * instead of a bare "no data" — that bare message is indistinguishable
     * from a code bug and was the source of the user's "the swap is
     * broken" complaint when in fact the search was running fine but
     * had no events in the dispatched window.
     */
    noDataReason?: NoDataReason;
    /** Label of the dispatched time range — used in the no-data subtext. */
    rangeLabel?: string;
    /**
     * Sparkline visualization variant. Sourced from `searchbase.conf`'s
     * `default_viz` field when present (e.g. `splunk.column` →
     * `'column'`). Defaults to `'area'`, preserving prior behaviour
     * for tiles whose stanza doesn't set the field.
     */
    vizType?: SparklineVizType;
    /**
     * Mirrors Splunk Studio v2's `dataValuesDisplay` option. Sourced
     * from `searchbase.conf`'s `viz_options.dataValuesDisplay`.
     * Defaults to `'minmax'` inside Sparkline so every tile labels
     * both the period low and high without per-stanza configuration.
     */
    dataValuesDisplay?: DataValuesDisplay;
    /** Compact H1 charts hide static labels; focused charts restore detail. */
    sparklineDensity?: SparklineDensity;
    className?: string;
}

const STATUS_TEXT_COLOR: Record<MetricStatus, string> = {
    healthy: 'sui-color-default',
    warning: 'sui-color-default',
    critical: 'sui-color-default',
    unknown: 'sui-color-default',
};

// Change-arrow + delta-percent pill color. Historically this was a
// direction-only signal (up=green, down=red), which produced a
// confusing mismatch on "lower is better" metrics: a critical-red
// headline (e.g. "Failed Auth: 142, threshold 100") could ship with
// a cheerful green up-arrow because the value had risen. Alan flagged
// this on 2026-05-11. The fix is to inherit the headline's
// status-aware color so the headline number, the trend arrow, and
// the trend-percent pill all read the same story at a glance.
const STATUS_TREND_COLOR: Record<MetricStatus, string> = {
    healthy: 'sui-color-default',
    warning: 'sui-color-default',
    critical: 'sui-color-default',
    unknown: 'sui-color-default sui-color-muted',
};

// Sparkline stroke/fill palette per status. ALL three statuses
// resolve to a status-driven color so the chart and the headline
// always tell the same story; `unknown` falls through to the tile's
// brand `color` prop so we don't fabricate a status that the data
// hasn't given us.
//
// Why `healthy` is mapped (Build 1174):
//   The earlier design left `healthy` falling through to the tile's
//   brand color so resting-state tiles kept their visual identity
//   (Network Health sky, FW Blocked amber, …). That broke down when
//   the brand color collided with a status color. FW Blocked's brand
//   is `#f59e0b` — the same amber as the `warning` palette below —
//   so a healthy FW Blocked tile rendered with amber bars and looked
//   identical to a warning FW Blocked tile in the chart, even though
//   the headline icon was correctly green-checked. Operator flagged
//   on 2026-05-18 ("I changed the threshold to not alarm until we
//   hit 20k blocks, the chart below is still orange"). Mapping
//   healthy to C3's positive green makes the chart palette track
//   threshold status, never the brand, and keeps the three
//   signals (headline number / trend arrow / chart) in sync. Brand
//   color is still honoured upstream (singlevalue tile background,
//   tile accent edge) so the resting-state identity isn't lost.
//
const MOCK_VIZ_COLOR = C3_VISUALIZATION_COLORS.neutral;
const MOCK_HEADLINE_COLOR = 'sui-color-muted sui-color-default';
const MOCK_DATA_HELP =
    'Sample data shown until live results are available. Bind this tile to a Splunk search to see real values.';

const DemoDataChip: React.FC = () => (
    <span
        data-tile-control="true"
        className="relative inline-flex group/demo"
        title={MOCK_DATA_HELP}
    >
        <button
            type="button"
            aria-label={MOCK_DATA_HELP}
            data-tile-control="true"
            className="px-1.5 py-0.5 rounded-full border  sui-border-default  sui-bg-popup text-xs font-extrabold tracking-normal  sui-color-default focus:outline-none focus:ring-1 sui-focus-ring"
        >
            Demo data
        </button>
        <span
            role="tooltip"
            className="pointer-events-none absolute right-0 top-full z-50 mt-1 w-56 rounded-md sui-bg-section px-2 py-1.5 text-xs leading-snug sui-color-active shadow-lg ring-1 sui-focus-ring opacity-0 transition-opacity group-hover/demo:opacity-100 group-focus-within/demo:opacity-100"
        >
            {MOCK_DATA_HELP}
        </span>
    </span>
);

const StatusIcon: React.FC<{ status: MetricStatus }> = ({ status }) => {
    if (status === 'critical')
        return <AlertCircle className="w-3 h-3 sui-color-negative" aria-label="Critical" />;
    if (status === 'warning')
        return <AlertTriangle className="w-3 h-3 sui-color-warning" aria-label="Warning" />;
    if (status === 'healthy')
        return <CheckCircle2 className="w-3 h-3 sui-color-positive" aria-label="Healthy" />;
    return null;
};

export const MetricItem: React.FC<MetricItemProps> = ({
    label,
    subLabel,
    description,
    infoSections,
    descriptionFootnote,
    thresholdLines,
    thresholdNote,
    infoAnchor = 'auto',
    value,
    unit = '',
    change,
    sparkData,
    previousData,
    previousLabel,
    sparkTimestamps,
    timeRange,
    color = C3_VISUALIZATION_COLORS.info,
    status = 'unknown',
    source,
    onOpenInSearch,
    openInSearchHref,
    searchbaseId,
    onOpenDetailTable,
    detailTableTitle,
    onConfigure,
    isCustomized = false,
    sparkTitle,
    abbreviateMajorValue = true,
    abbreviateTrendValue = true,
    noDataReason,
    rangeLabel,
    vizType = 'area',
    dataValuesDisplay,
    sparklineDensity = 'auto',
    className,
}) => {
    const theme = useSplunkTheme();
    const [isFocusOpen, setIsFocusOpen] = React.useState(false);
    const focusReturnRef = React.useRef<HTMLElement | null>(null);
    const isMock = source === 'mock';
    const numericValue = toFiniteMetricNumber(value);
    const renderedText =
        abbreviateMajorValue &&
        numericValue !== null &&
        unit !== '%' &&
        unit !== 'ms' &&
        unit !== 'Mbps'
            ? formatMetricNumber(numericValue, unit)
            : `${value}${unit}`;
    const displayChange =
        typeof change === 'number' &&
        Number.isFinite(change) &&
        abbreviateTrendValue
            ? formatCompactMetricNumber(change)
            : change;
    const isNoData = typeof value === 'number' && Number.isNaN(value);
    const statusVizColor: Partial<Record<MetricStatus, string>> = {
        healthy: theme.severityColorNormal,
        warning: theme.severityColorWarning,
        critical: theme.severityColorCritical,
    };
    const focusChartColor = isMock
        ? MOCK_VIZ_COLOR
        : statusVizColor[status] ?? color;
    const focusFormatValue = (n: number): string =>
        abbreviateMajorValue &&
        unit !== '%' &&
        unit !== 'ms' &&
        unit !== 'Mbps'
            ? formatMetricNumber(n, unit)
            : `${n.toLocaleString()}${unit}`;
    const hasExpandableChart = vizType !== 'singlevalue' && sparkData.length > 0;

    const openDetailFromFocus = React.useCallback(() => {
        setIsFocusOpen(false);
        onOpenDetailTable?.();
    }, [onOpenDetailTable]);
    const closeFocus = React.useCallback(() => {
        setIsFocusOpen(false);
        window.requestAnimationFrame(() => {
            if (focusReturnRef.current?.isConnected) {
                focusReturnRef.current.focus({ preventScroll: true });
            }
            focusReturnRef.current = null;
        });
    }, []);

    return (
        // flex-1 + basis-0 makes every tile grab an equal share of the
        // section's free width — without it the tiles sat at their
        // natural content width and left a half-section of whitespace
        // before the divider rule. min-w is a safety floor for very
        // narrow panes / very long labels: tiles never collapse below
        // 108px regardless of how the splitter is positioned.
        // min-w tuned for 5 tiles per section: at the smallest xl
        // breakpoint (1280px) each tile lands at ~118px usable width,
        // and at 1600px we get ~176px. The 4xl headline + sparkline
        // both still render legibly in that range.
        <div
            className={cn(
                'flex flex-col flex-1 basis-0 min-w-[108px] px-1.5 py-1 relative',
                isMock &&
                    'rounded-md border border-dashed  sui-border-default',
                className
            )}
        >
            {source === 'loading' && (
                <span
                    className="absolute top-1 right-2 w-1.5 h-1.5 rounded-full sui-bg-warning animate-pulse"
                    title="Loading saved search…"
                />
            )}

            <div
                // `data-tile-control` so the title/header row
                // suppresses the SortableMetricCard drag handle
                // while the cursor is over the tile name (or its
                // inline controls). Without this, the GripVertical
                // chip at `top-0.5 left-0.5` pops in on any tile
                // hover and visibly clips the first character of
                // the label. The grip still appears when the
                // cursor is over the empty top-left corner of the
                // sortable wrapper — i.e. the actual drag zone —
                // so the affordance isn't lost, just no longer
                // floating over the label text.
                data-tile-control="true"
                className="flex flex-col mb-0.5"
            >
                <span className="sui-color-default font-bold sui-color-active tracking-tight leading-tight flex items-center gap-1">
                    <span className="flex items-center gap-1 min-w-0 truncate">
                        {label}
                        {status !== 'unknown' && <StatusIcon status={status} />}
                    </span>
                    <span className="ml-auto flex items-center gap-0.5 flex-shrink-0">
                        {isMock && <DemoDataChip />}
                        {description && (
                            <InfoTooltip
                                title={label}
                                description={description}
                                detailSections={infoSections}
                                thresholdLines={thresholdLines}
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
                            openInSearchHref={openInSearchHref}
                            onOpenInSearch={onOpenInSearch}
                            searchbaseId={searchbaseId}
                            onExpand={
                                hasExpandableChart
                                    ? (returnFocus) => {
                                          focusReturnRef.current = returnFocus ?? null;
                                          setIsFocusOpen(true);
                                      }
                                    : undefined
                            }
                            onConfigure={onConfigure}
                            isCustomized={isCustomized}
                        />
                    </span>
                </span>
                {subLabel && (
                    <span className="sui-color-default font-medium tracking-tight leading-tight line-clamp-1 min-h-[12px]">
                        {subLabel}
                    </span>
                )}
            </div>

            {(() => {
                // NaN is the sentinel `useMetric` emits when an
                // override-bound tile's search ran successfully but
                // returned nothing (or no numeric column). We render
                // "—" with no unit and no change arrow so the user can
                // tell at a glance "the swap took effect, the search
                // just has no data on this Splunk env" — instead of
                // misreading "0%" as the original tile's value.
                if (isNoData) {
                    // Diagnostic subtext: tells the user *why* the tile
                    // is empty. The bare "no data" we used to render
                    // looked indistinguishable from a code bug, which
                    // is what made every picker-bound tile look
                    // "broken" even when the swap had dispatched
                    // cleanly and Splunk had simply returned nothing
                    // in the chosen window.
                    let subtext: string;
                    if (noDataReason === 'capacity_limited') {
                        subtext = 'search slots busy · refresh after searches finish';
                    } else if (noDataReason === 'dispatch_failed' || noDataReason === 'job_failed' || noDataReason === 'error') {
                        subtext = 'search failed';
                    } else if (noDataReason === 'column_missing') {
                        // Honors the strict valueField rule in
                        // useMetric: the user typed a column the SPL
                        // doesn't emit. Picker chips show the real
                        // column names — point them there.
                        subtext = 'value field not emitted by search';
                    } else if (noDataReason === 'no_numeric_column') {
                        subtext = rangeLabel
                            ? `no numeric values · ${rangeLabel.toLowerCase()}`
                            : 'no numeric values returned';
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
                        <div className="flex flex-col mb-1">
                            <div className="flex items-baseline gap-2">
                                <span className="text-4xl font-black tracking-tighter leading-none  sui-color-muted">
                                    —
                                </span>
                            </div>
                            <span className="text-xs font-medium  sui-color-muted mt-0.5 leading-tight">
                                {subtext}
                            </span>
                        </div>
                    );
                }
                const showChange =
                    !isMock && change !== undefined && Number.isFinite(change);
                // Auto-shrink the headline font when the search emits a
                // long string headline (e.g. "17 of 18 available") so
                // it fits inside the tile at typical section widths
                // without clipping. Numeric headlines and short strings
                // keep the traditional text-4xl punch. Threshold of 7
                // characters covers single units like "100%", "1.2k",
                // "142", and shrinks for "17 of 18", "17/18 sites", etc.
                const headlineSizeClass =
                    typeof value === 'string' && renderedText.length > 7
                        ? 'text-2xl'
                        : 'text-4xl';
                return (
                    <div className="flex items-baseline gap-2 mb-1">
                        <span
                            className={cn(
                                'font-black tracking-tighter leading-none transition-colors',
                                headlineSizeClass,
                                isMock ? MOCK_HEADLINE_COLOR : STATUS_TEXT_COLOR[status]
                            )}
                        >
                            {renderedText}
                        </span>
                        {showChange && (
                            <div
                                className={cn(
                                    'flex items-center text-xs font-black',
                                    STATUS_TREND_COLOR[status]
                                )}
                            >
                                {(change as number) >= 0 ? (
                                    <ArrowUp className="w-3 h-3 sui-stroke-default" />
                                ) : (
                                    <ArrowDown className="w-3 h-3 sui-stroke-default" />
                                )}
                                <span>
                                    {(change as number) > 0
                                        ? `+${displayChange}`
                                        : displayChange}
                                    %
                                </span>
                            </div>
                        )}
                    </div>
                );
            })()}

            {vizType !== 'singlevalue' ? (
                // Tile sparkline canvas. Detailed charts reserve vertical
                // space for their min/max bubbles and timestamp footer, so
                // they must retain the 112px design-target height. Letting
                // that mode collapse to the compact 72px floor leaves less
                // room than its 28px top + bottom Recharts margins and
                // projects every value onto the same horizontal line.
                // Compact charts keep the flexible 72–112px contract so a
                // short viewport can still compress safely.
                //
                // `overflow-hidden` on the chart container is the
                // local containment for that bleed: any chart content
                // that overflows the chart's allocated slot is clipped
                // at chart bounds, not at the section row level. The
                // earlier safety-net clip on the tile row in
                // DashboardSection was the right intent in the wrong
                // place - it also clipped sibling popovers (notably
                // the InfoTooltip body) and floating menus. Clipping
                // here keeps the chart visually contained without
                // collateral damage to any other tile UI.
                //
                // mt-3/pt-2 keeps the headline-to-chart gap tight
                // without wasting pixels at full size.
                <div
                    // Sparkline canvas is marked
                    // `data-tile-control="true"` so the
                    // SortableMetricCard drag handle hides while
                    // the user hovers the chart to read the
                    // Recharts tooltip. Without this, the handle
                    // floats over the "Hover for date and value"
                    // bubble (Alan flagged in the 2026-05-14
                    // review).
                    data-tile-control="true"
                    className={cn(
                        'mt-2 overflow-hidden pt-1 opacity-[0.92] transition-opacity hover:opacity-100',
                        sparklineDensity === 'detailed'
                            ? 'h-28 min-h-28 flex-none'
                            : 'flex-1 min-h-[72px] max-h-28'
                    )}
                >
                    {/* Sparkline is intentionally NOT wired to the
                        drilldown click. The ExternalLink icon next to
                        the tile label is the explicit "Open in Search"
                        affordance — duplicating that on the chart
                        canvas was a stray click target that kept
                        yanking users out of the dashboard when they
                        were just trying to read the trend. The
                        Recharts hover tooltip remains; only the
                        clickable wrapper is gone. */}
                    <Sparkline
                        data={sparkData}
                        color={isMock ? MOCK_VIZ_COLOR : statusVizColor[status] ?? color}
                        vizType={vizType}
                        dataValuesDisplay={dataValuesDisplay}
                        density={sparklineDensity}
                        previousData={previousData}
                        previousLabel={previousLabel}
                        timestamps={sparkTimestamps}
                        timeRange={timeRange}
                        // Build 99: tooltip values follow the same
                        // compact-vs-locale rule as the headline (see
                        // `renderedText` above) — abbreviate to K/M/B/T
                        // for raw counts where the headline already
                        // does, but keep the full number for unit
                        // domains where compaction makes no sense
                        // (`%`, `ms`, `Mbps` — already short, and
                        // `74Mbps` reads OK as `74Mbps` no matter
                        // what). Without this, the headline showed
                        // "74k" while the hover bubbles showed
                        // "73,537.79" — visually disorienting and
                        // they look like different metrics.
                        formatValue={(n) =>
                            abbreviateMajorValue &&
                            unit !== '%' &&
                            unit !== 'ms' &&
                            unit !== 'Mbps'
                                ? formatMetricNumber(n, unit)
                                : `${n.toLocaleString()}${unit}`
                        }
                        title={sparkTitle}
                    />
                </div>
            ) : (
                // Single-value tiles need a flex spacer so they share
                // their row's height with chart-bearing siblings; without
                // this, a singlevalue tile would collapse to its headline
                // height and the divider rules between tiles would not
                // line up across the row.
                <div className="flex-1 min-h-0" aria-hidden="true" />
            )}

            <WorkspaceModalShell
                isOpen={isFocusOpen && hasExpandableChart}
                variant="metric"
                title={label}
                subtitle={subLabel}
                onClose={closeFocus}
                onOpenInSearch={onOpenInSearch}
                onOpenDetailTable={
                    onOpenDetailTable ? openDetailFromFocus : undefined
                }
                detailTableTitle={detailTableTitle}
                headerMeta={
                    <>
                        {status !== 'unknown' && <StatusIcon status={status} />}
                        {isMock && <DemoDataChip />}
                    </>
                }
                contentClassName="grid gap-4 overflow-y-auto sui-bg-section p-5 lg:grid-cols-[200px_minmax(0,1fr)]"
            >
                <div className="rounded-[10px] border sui-border-default sui-bg-section p-4">
                    <div
                        className={cn(
                            'text-5xl font-black leading-none tracking-tighter',
                            isMock ? MOCK_HEADLINE_COLOR : STATUS_TEXT_COLOR[status]
                        )}
                    >
                        {isNoData ? '—' : renderedText}
                    </div>
                    {typeof change === 'number' &&
                        Number.isFinite(change) &&
                        !isMock && (
                            <div
                                className={cn(
                                    'mt-3 inline-flex items-center rounded-full sui-bg-page px-2 py-1 text-xs font-black',
                                    STATUS_TREND_COLOR[status]
                                )}
                            >
                                {change >= 0 ? (
                                    <ArrowUp className="h-3.5 w-3.5 sui-stroke-default" />
                                ) : (
                                    <ArrowDown className="h-3.5 w-3.5 sui-stroke-default" />
                                )}
                                <span>
                                    {change > 0 ? `+${displayChange}` : displayChange}%
                                </span>
                            </div>
                        )}
                    <div className="mt-4 space-y-2 text-xs font-semibold sui-color-default">
                        <div className="flex items-center justify-between gap-3">
                            <span>Status</span>
                            <span className="capitalize sui-color-default">{status}</span>
                        </div>
                        {rangeLabel && (
                            <div className="flex items-center justify-between gap-3">
                                <span>Range</span>
                                <span className="text-right sui-color-default">
                                    {rangeLabel}
                                </span>
                            </div>
                        )}
                        {previousLabel && previousData?.length ? (
                            <div className="flex items-center justify-between gap-3">
                                <span>Overlay</span>
                                <span className="sui-color-default">{previousLabel}</span>
                            </div>
                        ) : null}
                    </div>
                </div>

                <div className="h-full min-h-[280px] rounded-[10px] border sui-border-default sui-bg-section p-3">
                    <Sparkline
                        data={sparkData}
                        color={focusChartColor}
                        vizType={vizType}
                        dataValuesDisplay={dataValuesDisplay}
                        density="detailed"
                        previousData={previousData}
                        previousLabel={previousLabel}
                        timestamps={sparkTimestamps}
                        timeRange={timeRange}
                        formatValue={focusFormatValue}
                        title={sparkTitle}
                    />
                </div>
            </WorkspaceModalShell>
        </div>
    );
};
