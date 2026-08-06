import React from 'react';
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    Cell,
    ComposedChart,
    Line,
    LineChart,
    ReferenceDot,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import type { TimeRange } from '@/common/hooks/useMetric';

/**
 * Sparkline visualization variants. The default (`area`) preserves
 * existing tile rendering. `line` and `column` are activated when a
 * `searchbase.conf` stanza sets `default_viz` to `splunk.line` or
 * `splunk.column` respectively. `singlevalue` suppresses the spark
 * entirely (the headline value is the whole story).
 */
export type SparklineVizType = 'area' | 'line' | 'column' | 'bar' | 'singlevalue';

/**
 * Mirrors Splunk Dashboard Studio v2's `dataValuesDisplay` option for
 * line/area/column visualizations.
 *
 *   `'minmax'`   — label both the lowest and highest data points.
 *                  When min and max land on the same point (flat
 *                  series, single bucket) we collapse to a single
 *                  bubble so the two don't overlap.
 *   `'maxonly'`  — preserves the historical "peak only" behaviour
 *                  some legacy stanzas may rely on.
 *   `'off'`      — suppress the value bubble entirely (clean spark).
 *   `'all'`      — Studio's `"all"` labels every point; sparklines
 *                  are too narrow for that, so we treat it as
 *                  `'minmax'`.
 *
 * Sourced from `searchbase.conf`'s `viz_options.dataValuesDisplay`
 * via the searchbase catalogue. Default is `'minmax'` so the app no
 * longer hard-codes a single peak marker on every tile.
 */
export type DataValuesDisplay = 'off' | 'minmax' | 'maxonly' | 'all';

/**
 * Map an arbitrary string (typically `viz_options.dataValuesDisplay`
 * read from JSON) onto our supported set, falling back to `'minmax'`
 * when the value is missing, malformed, or a Studio mode we can't
 * meaningfully render in a 100x110 spark canvas.
 */
export const normalizeDataValuesDisplay = (
    raw: unknown
): DataValuesDisplay => {
    if (typeof raw !== 'string') return 'minmax';
    const v = raw.trim().toLowerCase();
    if (v === 'off' || v === 'minmax' || v === 'maxonly') return v;
    if (v === 'all') return 'minmax';
    return 'minmax';
};

/**
 * Map a Splunk visualization id (e.g. `splunk.column`) onto the
 * sparkline variant the dashboard knows how to render. Unknown viz
 * ids fall back to `area` so a typo or a viz the dashboard doesn't
 * support yet still produces a usable tile.
 */
export const sparklineVizTypeFromSplunkViz = (
    splunkViz: string | undefined
): SparklineVizType => {
    if (typeof splunkViz !== 'string') return 'area';
    switch (splunkViz.trim().toLowerCase()) {
        case 'splunk.column':
            return 'column';
        // Build 1187: `splunk.bar` (Splunk's horizontal-bar viz id)
        // now resolves to its own `bar` variant instead of the prior
        // collapse to `column`. Sparkline.tsx renders this with
        // recharts `layout="vertical"`, which is recharts'
        // (counter-intuitive) name for a horizontal-bar layout —
        // the bars grow rightwards along a numeric X axis with a
        // categorical Y axis. Existing conf entries that use
        // `splunk.bar` will start picking up horizontal rendering
        // automatically; switch them to `splunk.column` if the
        // tile relies on vertical bars.
        case 'splunk.bar':
            return 'bar';
        case 'splunk.line':
            return 'line';
        case 'splunk.singlevalue':
        case 'splunk.singlevalueradial':
        case 'splunk.singlevalueicon':
            return 'singlevalue';
        case 'splunk.area':
        default:
            return 'area';
    }
};

interface SparklineProps {
    data: number[];
    color: string;
    /**
     * Visualization variant. Defaults to `area` to preserve the
     * pre-conf-driven behaviour. When the conf-stanza-derived value
     * is `singlevalue`, the caller should skip mounting Sparkline
     * entirely; the component still renders nothing for that case
     * as a safety net.
     */
    vizType?: SparklineVizType;
    /**
     * Optional comparison series; rendered as a dashed grey line behind
     * the primary series. Originally introduced as a "vs. previous
     * period" overlay - same SPL shifted back by `range.spanSeconds` -
     * but now also drives the "vs. baseline (rolling average)" overlay
     * when the underlying searchbase stanza emits a baseline column on
     * the same rows as the primary series. Resampled to {data.length}
     * so both series align horizontally regardless of their original
     * row counts.
     */
    previousData?: number[];
    /**
     * Tooltip label for the comparison series. Defaults to `'Prev'` for
     * backwards-compat with the previous-period overlay. Tiles using
     * the rolling-average baseline overlay should pass `'Avg'` (or
     * any short label) so the hover popover reads naturally.
     */
    previousLabel?: string;
    /**
     * Optional explicit Unix-epoch (ms) timestamps for each `data`
     * point. Live time-series searches should pass real timestamps so
     * the hover tooltip reads true bucket times. When omitted, the
     * Sparkline synthesises evenly-spaced timestamps across the page-
     * level {@link timeRange} so single-row + mock series still get a
     * meaningful hover label.
     */
    timestamps?: number[];
    /**
     * Page-level dispatched range. Used to synthesise timestamps when
     * none are provided so the hover tooltip still shows date/time
     * even for searches that return a single row plus a mock spark.
     */
    timeRange?: TimeRange;
    /**
     * Pretty-printed value formatter (e.g. add a unit suffix). Defaults
     * to a locale-aware integer formatter.
     */
    formatValue?: (value: number) => string;
    /** Click handler. When set, the sparkline gets a hover affordance. */
    onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
    title?: string;
    /**
     * Splunk Studio v2 `dataValuesDisplay` analogue. Defaults to
     * `'minmax'` so every tile shows both the period low and high
     * without per-stanza configuration. `searchbase.conf` stanzas
     * may override via `viz_options.dataValuesDisplay`.
     */
    dataValuesDisplay?: DataValuesDisplay;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Stretch / compress `series` to `targetLen` data points using nearest-
// neighbour sampling. We need this because the comparison-period search
// can return a different row count than the live one.
const resampleSeries = (series: number[], targetLen: number): number[] => {
    if (series.length === 0 || targetLen === 0) return [];
    if (series.length === targetLen) return series;
    const out = new Array<number>(targetLen);
    for (let i = 0; i < targetLen; i += 1) {
        const idx = Math.min(
            series.length - 1,
            Math.floor((i / targetLen) * series.length)
        );
        out[i] = series[idx];
    }
    return out;
};

// Convert one of Splunk's relative time modifiers (`-7d@d`, `-24h@h`,
// `now`, `-30m`) into a Unix-epoch (ms) timestamp anchored at the
// supplied `now`. Returns null on anything we can't parse — the caller
// gracefully falls back to "now - 7d" then.
const splunkTimeToEpoch = (token: string | undefined, now: number): number | null => {
    if (!token) return null;
    const trimmed = token.trim();
    if (trimmed === 'now') return now;
    const m = trimmed.match(/^([+-])(\d+)([smhdw])(?:@[smhdw])?$/);
    if (!m) return null;
    const sign = m[1] === '-' ? -1 : 1;
    const amount = Number(m[2]);
    if (!Number.isFinite(amount)) return null;
    const unit = m[3];
    const unitMs: Record<string, number> = {
        s: 1000,
        m: 60_000,
        h: 3_600_000,
        d: 86_400_000,
        w: 604_800_000,
    };
    return now + sign * amount * unitMs[unit];
};

// Build a synthetic, evenly-spaced timestamp series across the page's
// dispatched range. The `data.length` points are placed at equal slices
// from `earliest` to `latest`. Output is in Unix-epoch (ms).
const synthesizeTimestamps = (length: number, range?: TimeRange): number[] => {
    if (length === 0) return [];
    const now = Date.now();
    const fallbackEarliest = now - 7 * 86_400_000;
    const start = splunkTimeToEpoch(range?.earliest, now) ?? fallbackEarliest;
    const end = splunkTimeToEpoch(range?.latest, now) ?? now;
    if (length === 1) return [end];
    const step = (end - start) / (length - 1);
    const out = new Array<number>(length);
    for (let i = 0; i < length; i += 1) out[i] = Math.round(start + step * i);
    return out;
};

// Pick a date format granularity that makes sense for the dispatched
// range. Sub-day → "MMM d, HH:mm"; multi-day → "MMM d".
const formatTimestamp = (epoch: number, range?: TimeRange): string => {
    const dt = new Date(epoch);
    if (Number.isNaN(dt.valueOf())) return '';
    const span = range?.spanSeconds ?? 0;
    const includeTime = span > 0 && span < 3 * 86_400;
    return includeTime
        ? dt.toLocaleString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
          })
        : dt.toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
          });
};

const defaultFormatValue = (value: number): string =>
    Number.isFinite(value) ? value.toLocaleString() : '—';

interface ValueMarkerProps {
    cx?: number;
    cy?: number;
    value: number;
    color: string;
    formatValue: (value: number) => string;
    viewBox?: {
        x?: number;
        y?: number;
        width?: number;
        height?: number;
    };
    /**
     * Where the bubble sits relative to the data point. Max markers
     * float above (`'top'`); min markers float below (`'bottom'`).
     * Both anchor with a dashed leader line back to the data dot.
     */
    position?: 'top' | 'bottom';
}

const ValueMarker: React.FC<ValueMarkerProps> = ({
    cx,
    cy,
    value,
    color,
    formatValue,
    viewBox,
    position = 'top',
}) => {
    if (
        !Number.isFinite(cx ?? Number.NaN) ||
        !Number.isFinite(cy ?? Number.NaN) ||
        !Number.isFinite(value)
    ) {
        return null;
    }
    const label = formatValue(value);
    const width = Math.max(28, label.length * 7 + 12);
    const bubbleHeight = 20;
    const chartX = viewBox?.x ?? 0;
    const chartY = viewBox?.y ?? 0;
    const chartWidth = viewBox?.width ?? 9999;
    const chartHeight = viewBox?.height ?? 9999;
    const clamp = (n: number, min: number, max: number) =>
        Math.max(min, Math.min(max, n));
    const bubbleX = clamp(
        (cx as number) - width / 2,
        chartX + 1,
        chartX + chartWidth - width - 1
    );
    // Top: bubble sits above the data point with leader line going
    // down. Bottom: bubble sits below with leader line going up. The
    // 10-px gap matches the visual breathing room the previous
    // peak-only marker used so the two-marker minmax pair feels
    // visually balanced rather than crammed.
    const desiredY =
        position === 'top'
            ? (cy as number) - bubbleHeight - 10
            : (cy as number) + 10;
    const bubbleY = clamp(
        desiredY,
        chartY + 1,
        chartY + chartHeight - bubbleHeight - 1
    );
    const bubbleCenterX = bubbleX + width / 2;
    const lineY2 = position === 'top' ? bubbleY + bubbleHeight : bubbleY;
    return (
        <g>
            <line
                x1={cx}
                y1={cy}
                x2={bubbleCenterX}
                y2={lineY2}
                stroke={color}
                strokeWidth={1.5}
                strokeDasharray="3 2"
            />
            <circle cx={cx} cy={cy} r={3.5} fill={color} stroke="#ffffff" strokeWidth={1.5} />
            <rect
                x={bubbleX}
                y={bubbleY}
                rx={6}
                ry={6}
                width={width}
                height={bubbleHeight}
                fill="#0f172a"
                opacity={0.92}
            />
            <text
                x={bubbleCenterX}
                y={bubbleY + 13}
                textAnchor="middle"
                fontSize="10"
                fontWeight="700"
                fill="#ffffff"
            >
                {label}
            </text>
        </g>
    );
};

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

interface SparklineTooltipProps {
    active?: boolean;
    payload?: Array<{
        payload?: {
            time: number;
            value: number;
            previous: number | null;
        };
    }>;
    formatValue: (n: number) => string;
    range?: TimeRange;
    color: string;
    /**
     * Label for the dashed comparison line in the tooltip. Defaults
     * to "Prev" for the historical previous-period overlay; baseline
     * tiles override to "Avg" via {@link SparklineProps.previousLabel}.
     */
    previousLabel: string;
}

const SparklineTooltip: React.FC<SparklineTooltipProps> = ({
    active,
    payload,
    formatValue,
    range,
    color,
    previousLabel,
}) => {
    if (!active || !payload || payload.length === 0) return null;
    const point = payload[0]?.payload;
    if (!point) return null;
    const timeLabel = formatTimestamp(point.time, range);
    return (
        <div
            role="tooltip"
            className="pointer-events-none rounded-md border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm shadow-lg px-2 py-1 text-[10px] leading-tight"
        >
            <div className="font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                {timeLabel}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
                <span
                    className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: color }}
                    aria-hidden="true"
                />
                <span className="font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                    {formatValue(point.value)}
                </span>
            </div>
            {point.previous !== null && Number.isFinite(point.previous) && (
                <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                        className="inline-block w-2 h-px bg-slate-600 dark:bg-slate-300 flex-shrink-0"
                        aria-hidden="true"
                    />
                    <span className="text-slate-500 dark:text-slate-400 tabular-nums">
                        {previousLabel}: {formatValue(point.previous as number)}
                    </span>
                </div>
            )}
        </div>
    );
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const Sparkline: React.FC<SparklineProps> = ({
    data,
    color,
    vizType = 'area',
    previousData,
    previousLabel = 'Prev',
    timestamps,
    timeRange,
    formatValue = defaultFormatValue,
    onClick,
    title,
    dataValuesDisplay = 'minmax',
}) => {
    if (vizType === 'singlevalue') return null;
    const hasPrevious = Array.isArray(previousData) && previousData.length > 0;
    const previousAligned = hasPrevious
        ? resampleSeries(previousData as number[], data.length)
        : null;

    // Resolve the per-point timestamp series. Real data wins; otherwise
    // synthesise across the dispatched range.
    const resolvedTimestamps =
        Array.isArray(timestamps) && timestamps.length === data.length
            ? timestamps
            : synthesizeTimestamps(data.length, timeRange);

    const chartData = data.map((val, i) => ({
        index: i,
        time: resolvedTimestamps[i] ?? Date.now(),
        value: val,
        previous: previousAligned ? previousAligned[i] : null,
    }));
    // Locate the period high (`peakPoint`) and low (`troughPoint`)
    // in a single pass. We only consider finite values so a stray
    // NaN/Infinity doesn't anchor a marker on a non-renderable point.
    let peakPoint: (typeof chartData)[number] | null = null;
    let troughPoint: (typeof chartData)[number] | null = null;
    for (const point of chartData) {
        if (!Number.isFinite(point.value)) continue;
        if (peakPoint === null || point.value > peakPoint.value) {
            peakPoint = point;
        }
        if (troughPoint === null || point.value < troughPoint.value) {
            troughPoint = point;
        }
    }

    const interactiveProps = onClick
        ? {
              role: 'button',
              tabIndex: 0,
              onClick,
              onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onClick(e as unknown as React.MouseEvent<HTMLDivElement>);
                  }
              },
              title,
              className:
                  'h-full w-full cursor-pointer rounded transition-opacity hover:opacity-100 focus:outline-none focus:ring-1 focus:ring-sky-400',
          }
        : { className: 'h-full w-full' };

    const tooltipContent = (
        <Tooltip
            cursor={{ stroke: color, strokeWidth: 1, strokeOpacity: 0.4, strokeDasharray: '2 2' }}
            isAnimationActive={false}
            content={
                <SparklineTooltip
                    formatValue={formatValue}
                    range={timeRange}
                    color={color}
                    previousLabel={previousLabel}
                />
            }
            wrapperStyle={{ zIndex: 50, outline: 'none' }}
        />
    );

    // We mount XAxis/YAxis with `hide` so Recharts sets up scales for
    // the cursor + tooltip but we don't render axis chrome.
    //
    // Two X-axis variants:
    //   - `hiddenAxes` (numeric, default for line/area): bars/dots are
    //     placed at their literal `index` x-coordinate, which gives
    //     the line and area charts a continuous domain that matches
    //     the timestamp footer cleanly.
    //   - `hiddenAxesCategorical`: bars are slotted into evenly-spaced
    //     category cells. Used by the column branch only. Without this,
    //     `<Bar>` inside a `<ComposedChart type="number">` x-axis renders
    //     each bar centered on its x value, so the first bar overflows
    //     half-width past the LEFT edge of the chart canvas and the
    //     last overflows past the RIGHT edge — exactly the side-overflow
    //     Alan flagged after the 2026-05-11 line→column switch. A
    //     categorical x-axis auto-sizes bars to fit their slot and keeps
    //     them inside the canvas; the dashed baseline `<Line>` continues
    //     to draw correctly because Recharts treats categorical x-values
    //     as evenly-spaced for line series too.
    const hiddenAxes = (
        <>
            <XAxis dataKey="index" type="number" hide domain={['dataMin', 'dataMax']} />
            <YAxis hide type="number" domain={['auto', 'auto']} />
        </>
    );
    const hiddenAxesCategorical = (
        <>
            <XAxis dataKey="index" type="category" hide />
            <YAxis hide type="number" domain={['auto', 'auto']} />
        </>
    );

    // Top + bottom reserved for the floating value-label bubbles
    // (rect 20px tall + leader line + 4-px breathing room each).
    // Bottom margin matches the top so the min bubble and max bubble
    // both fit cleanly inside the chart area when minmax is active.
    // Side margins keep the path from kissing the tile edges and
    // clipping the active-dot ring.
    const chartMargin = { top: 28, right: 12, bottom: 28, left: 12 };
    // Decide which markers to render. `'off'` is empty, `'maxonly'`
    // preserves the historical single-peak behaviour, and `'minmax'`
    // (default) renders both endpoints — collapsing to the peak alone
    // when min and max happen to land on the same data point (flat
    // series, single bucket, NaN-only series). This is the cleanest
    // analogue of Splunk Studio's `dataValuesDisplay:"minmax"` for a
    // narrow sparkline canvas.
    const valueMarkers: React.ReactElement[] = [];
    if (dataValuesDisplay !== 'off' && peakPoint) {
        valueMarkers.push(
            <ReferenceDot
                key="peak"
                x={peakPoint.index}
                y={peakPoint.value}
                isFront
                ifOverflow="extendDomain"
                shape={
                    <ValueMarker
                        value={peakPoint.value}
                        color={color}
                        formatValue={formatValue}
                        position="top"
                    />
                }
            />
        );
        const wantsMin = dataValuesDisplay !== 'maxonly';
        const distinctTrough =
            troughPoint &&
            (troughPoint.index !== peakPoint.index ||
                troughPoint.value !== peakPoint.value);
        if (wantsMin && distinctTrough) {
            valueMarkers.push(
                <ReferenceDot
                    key="trough"
                    x={(troughPoint as NonNullable<typeof troughPoint>).index}
                    y={(troughPoint as NonNullable<typeof troughPoint>).value}
                    isFront
                    ifOverflow="extendDomain"
                    shape={
                        <ValueMarker
                            value={
                                (troughPoint as NonNullable<typeof troughPoint>)
                                    .value
                            }
                            color={color}
                            formatValue={formatValue}
                            position="bottom"
                        />
                    }
                />
            );
        }
    }
    const gradientDefs = (
        <defs>
            <linearGradient id={`gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
        </defs>
    );

    let chartElement: React.ReactElement;
    if (vizType === 'column') {
        // ComposedChart so the column branch can render a dashed
        // baseline overlay line on top of the bars when the underlying
        // searchbase stanza emits a baseline column. Falls back to a
        // plain BarChart visually when `previousData` is absent because
        // ComposedChart with a single <Bar> child renders identically
        // to BarChart at this canvas size; the only cost is one extra
        // recharts wrapper which is negligible. Without this the
        // baseline line was silently dropped on column-viz tiles
        // (Alan flagged on 2026-05-11: "Failed Auth + FW Blocked are
        // hard to read as line-on-line, can we use bars + overlay?").
        chartElement = (
            <ComposedChart data={chartData} margin={chartMargin}>
                {hiddenAxesCategorical}
                {tooltipContent}
                <Bar
                    dataKey="value"
                    fill={color}
                    radius={[2, 2, 0, 0]}
                    isAnimationActive={false}
                >
                    {peakPoint &&
                        chartData.map((point) => (
                            <Cell
                                key={`cell-${point.index}`}
                                fill={point.index === peakPoint.index ? color : color}
                                fillOpacity={point.index === peakPoint.index ? 1 : 0.55}
                            />
                        ))}
                </Bar>
                {hasPrevious && (
                    <Line
                        type="monotone"
                        dataKey="previous"
                        stroke="var(--baseline-stroke)"
                        strokeWidth={2.25}
                        strokeDasharray="8 4"
                        strokeOpacity={0.9}
                        dot={false}
                        isAnimationActive={false}
                    />
                )}
                {valueMarkers}
            </ComposedChart>
        );
    } else if (vizType === 'bar') {
        // Build 1187 — horizontal bars. `layout="vertical"` is
        // recharts' (regrettably-named) prop that flips the chart
        // axes: bars grow rightwards along a numeric X axis with a
        // categorical Y axis (one slot per data point). Mirrors the
        // column branch's ComposedChart + Bar + optional dashed
        // baseline overlay so the same tile can switch between
        // column and bar layouts via the picker without losing the
        // baseline overlay or the peak/trough Cell highlighting.
        //
        // Axis setup is intentionally inline rather than a shared
        // `hiddenAxesHorizontal` helper because horizontal-bar
        // tiles are the only consumers and centralising them would
        // hide the layout flip from the rest of the file. Both
        // axes still carry `hide` so the tooltip/cursor scales are
        // wired up but no axis chrome paints.
        //
        // `radius={[0, 2, 2, 0]}` rounds the right edge of each bar
        // (matching the column branch's top-edge rounding). Peak
        // and baseline overlays unchanged in spirit, but
        // `valueMarkers` had to be rebuilt below — see comment.
        //
        // Build 1187.1 — value-marker swap fix. The shared
        // `valueMarkers` array (used by area/line/column) places
        // `<ReferenceDot x={index} y={value}>`, which is correct
        // when the X axis is the index axis and the Y axis is the
        // value axis. With `layout="vertical"` those axes are
        // swapped: X becomes the value axis, Y becomes the
        // category-index axis. Reusing the shared array fed
        // `peakPoint.value` (e.g. 15000) into the *category* axis,
        // which combined with `ifOverflow="extendDomain"` extended
        // the category domain to include the value as a brand-new
        // category — squashing the actual bars into a fraction of
        // the canvas so they appeared empty after one render
        // (Alan flagged on 2026-05-18: "showed bar graph for a
        // second, then immediately blank"). The fix: rebuild the
        // markers locally with `x` and `y` swapped so the dot
        // anchors at the right edge of the appropriate bar without
        // distorting either domain.
        const barValueMarkers: React.ReactElement[] = [];
        if (dataValuesDisplay !== 'off' && peakPoint) {
            barValueMarkers.push(
                <ReferenceDot
                    key="peak-bar"
                    x={peakPoint.value}
                    y={peakPoint.index}
                    isFront
                    ifOverflow="extendDomain"
                    shape={
                        <ValueMarker
                            value={peakPoint.value}
                            color={color}
                            formatValue={formatValue}
                            position="top"
                        />
                    }
                />
            );
            const wantsMin = dataValuesDisplay !== 'maxonly';
            const distinctTrough =
                troughPoint &&
                (troughPoint.index !== peakPoint.index ||
                    troughPoint.value !== peakPoint.value);
            if (wantsMin && distinctTrough) {
                const t = troughPoint as NonNullable<typeof troughPoint>;
                barValueMarkers.push(
                    <ReferenceDot
                        key="trough-bar"
                        x={t.value}
                        y={t.index}
                        isFront
                        ifOverflow="extendDomain"
                        shape={
                            <ValueMarker
                                value={t.value}
                                color={color}
                                formatValue={formatValue}
                                position="bottom"
                            />
                        }
                    />
                );
            }
        }
        chartElement = (
            <ComposedChart data={chartData} layout="vertical" margin={chartMargin}>
                <XAxis hide type="number" domain={['auto', 'auto']} />
                <YAxis dataKey="index" type="category" hide />
                {tooltipContent}
                <Bar
                    dataKey="value"
                    fill={color}
                    radius={[0, 2, 2, 0]}
                    isAnimationActive={false}
                >
                    {peakPoint &&
                        chartData.map((point) => (
                            <Cell
                                key={`cell-${point.index}`}
                                fill={point.index === peakPoint.index ? color : color}
                                fillOpacity={point.index === peakPoint.index ? 1 : 0.55}
                            />
                        ))}
                </Bar>
                {hasPrevious && (
                    <Line
                        type="monotone"
                        dataKey="previous"
                        stroke="var(--baseline-stroke)"
                        strokeWidth={2.25}
                        strokeDasharray="8 4"
                        strokeOpacity={0.9}
                        dot={false}
                        isAnimationActive={false}
                    />
                )}
                {barValueMarkers}
            </ComposedChart>
        );
    } else if (vizType === 'line') {
        chartElement = (
            <LineChart data={chartData} margin={chartMargin}>
                {hiddenAxes}
                {tooltipContent}
                {hasPrevious && (
                    <Line
                        type="monotone"
                        dataKey="previous"
                        stroke="var(--baseline-stroke)"
                        strokeWidth={2.25}
                        strokeDasharray="8 4"
                        strokeOpacity={0.9}
                        dot={false}
                        isAnimationActive={false}
                    />
                )}
                <Line
                    type="monotone"
                    dataKey="value"
                    stroke={color}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                    activeDot={{ r: 3, stroke: color, strokeWidth: 1, fill: '#fff' }}
                />
                {valueMarkers}
            </LineChart>
        );
    } else if (hasPrevious) {
        chartElement = (
            <ComposedChart data={chartData} margin={chartMargin}>
                {gradientDefs}
                {hiddenAxes}
                {tooltipContent}
                <Line
                    type="monotone"
                    dataKey="previous"
                    stroke="var(--baseline-stroke)"
                    strokeWidth={2.25}
                    strokeDasharray="8 4"
                    strokeOpacity={0.9}
                    dot={false}
                    isAnimationActive={false}
                />
                <Area
                    type="monotone"
                    dataKey="value"
                    stroke={color}
                    strokeWidth={2}
                    fillOpacity={1}
                    fill={`url(#gradient-${color})`}
                    isAnimationActive={false}
                    activeDot={{ r: 3, stroke: color, strokeWidth: 1, fill: '#fff' }}
                />
                {valueMarkers}
            </ComposedChart>
        );
    } else {
        chartElement = (
            <AreaChart data={chartData} margin={chartMargin}>
                {gradientDefs}
                {hiddenAxes}
                {tooltipContent}
                <Area
                    type="monotone"
                    dataKey="value"
                    stroke={color}
                    strokeWidth={2}
                    fillOpacity={1}
                    fill={`url(#gradient-${color})`}
                    isAnimationActive={false}
                    activeDot={{ r: 3, stroke: color, strokeWidth: 1, fill: '#fff' }}
                />
                {valueMarkers}
            </AreaChart>
        );
    }

    // Time-axis footer. Two anchor labels (period start / period end)
    // sit beneath the spark — the standard sparkline convention used
    // by Apple Stocks, Google Finance mini-charts, and Splunk's own
    // single-value sparklines. Per-bucket times remain available via
    // the hover tooltip; the footer just answers "where does this
    // trend start and end?" at a glance.
    //
    // We deliberately don't use a Recharts `<XAxis>` here:
    //   - mounting a second visible axis fights the existing
    //     hidden index-axis the ReferenceDots depend on,
    //   - tick-collision logic on a 100–250px-wide canvas is fiddly,
    //   - the footer is decoupled from the chart so it never clashes
    //     with the min/max value bubbles, which live inside the
    //     plot area.
    //
    // Cost: ~11px stolen from the chart canvas (text-[9px] glyph
    // height + 2px top padding). The trough bubble's clamp logic
    // still keeps it inside the chart inner area, so labels never
    // overlap a value bubble.
    const firstTime = resolvedTimestamps[0];
    const lastTime = resolvedTimestamps[resolvedTimestamps.length - 1];
    const showFooter =
        Number.isFinite(firstTime) && Number.isFinite(lastTime);
    // Single-bucket searches (and 1-row tiles where we synthesise a
    // single timestamp) collapse to one centered label so we don't
    // print the same date twice.
    const sameTime = firstTime === lastTime;
    const footerJustify = sameTime ? 'justify-center' : 'justify-between';

    return (
        <div {...interactiveProps}>
            {/* Build 98 (2026-05-13): Theme-aware baseline / previous-period
              * overlay stroke. Declared as a CSS custom property here and
              * referenced via `stroke="var(--baseline-stroke)"` on the
              * three `<Line dataKey="previous">` elements below. The
              * Tailwind arbitrary-property syntax flips the value when
              * any ancestor carries the `.dark` class (set on the page
              * root by `pages/executive_insights` from `useTheme()`), so the same
              * Sparkline instance reads its own theme without prop
              * plumbing or hook reordering — important because Sparkline
              * has an `if (vizType === 'singlevalue') return null` early
              * return at the top of the component which would otherwise
              * make any added theme hook subject to React error #310.
              *
              * Colour choices:
              *   • Light: slate-600 (#475569) — readable on white bg,
              *     doesn't compete with axis text or status icons.
              *   • Dark:  slate-300 (#cbd5e1) — readable on slate-950
              *     bg, sits visually behind the primary tile colour.
              *
              * Stroke width bumped 1.75 → 2.25 and dash pattern
              * lengthened 6/3 → 8/4 so the line doesn't read as a
              * "row of pixels" at small chart heights — the previous
              * style melted into the gridline noise on the dashboard
              * landing page (Alan flagged on 2026-05-13). */}
            <div className="flex flex-col h-full w-full [--baseline-stroke:#475569] dark:[--baseline-stroke:#cbd5e1]">
                <div className="flex-1 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                        {chartElement}
                    </ResponsiveContainer>
                </div>
                {showFooter && (
                    <div
                        className={`flex items-center pt-0.5 px-3 text-[9px] tabular-nums leading-none text-slate-400 dark:text-slate-400 font-medium select-none ${footerJustify}`}
                        aria-hidden="true"
                    >
                        {sameTime ? (
                            <span>{formatTimestamp(firstTime, timeRange)}</span>
                        ) : (
                            <>
                                <span>
                                    {formatTimestamp(firstTime, timeRange)}
                                </span>
                                <span>
                                    {formatTimestamp(lastTime, timeRange)}
                                </span>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
