import React from 'react';
import {
    Area,
    AreaChart,
    ComposedChart,
    Line,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import type { TimeRange } from '@/common/hooks/useMetric';

interface SparklineProps {
    data: number[];
    color: string;
    /**
     * Optional previous-period series; rendered as a dashed grey line
     * behind the area for "vs. previous period" comparison. Resampled
     * to {data.length} so both series align horizontally.
     */
    previousData?: number[];
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
}

const SparklineTooltip: React.FC<SparklineTooltipProps> = ({
    active,
    payload,
    formatValue,
    range,
    color,
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
                        className="inline-block w-2 h-px bg-slate-400 flex-shrink-0"
                        aria-hidden="true"
                    />
                    <span className="text-slate-500 dark:text-slate-400 tabular-nums">
                        Prev: {formatValue(point.previous as number)}
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
    previousData,
    timestamps,
    timeRange,
    formatValue = defaultFormatValue,
    onClick,
    title,
}) => {
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
                />
            }
            wrapperStyle={{ zIndex: 50, outline: 'none' }}
        />
    );

    // We mount XAxis/YAxis with `hide` so Recharts sets up scales for
    // the cursor + tooltip but we don't render axis chrome.
    const hiddenAxes = (
        <>
            <XAxis dataKey="index" type="number" hide domain={['dataMin', 'dataMax']} />
            <YAxis hide type="number" domain={['auto', 'auto']} />
        </>
    );

    return (
        <div {...interactiveProps}>
            <ResponsiveContainer width="100%" height="100%">
                {hasPrevious ? (
                    <ComposedChart data={chartData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                        <defs>
                            <linearGradient
                                id={`gradient-${color}`}
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                            >
                                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={color} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        {hiddenAxes}
                        {tooltipContent}
                        <Line
                            type="monotone"
                            dataKey="previous"
                            stroke="#94a3b8"
                            strokeWidth={1}
                            strokeDasharray="4 3"
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
                    </ComposedChart>
                ) : (
                    <AreaChart data={chartData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                        <defs>
                            <linearGradient
                                id={`gradient-${color}`}
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                            >
                                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={color} stopOpacity={0} />
                            </linearGradient>
                        </defs>
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
                    </AreaChart>
                )}
            </ResponsiveContainer>
        </div>
    );
};
