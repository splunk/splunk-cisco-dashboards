import React, { useEffect, useMemo, useState } from 'react';
import ScreenReaderContent from '@splunk/react-ui/ScreenReaderContent';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';

import type { AppColorScheme } from '@/common/theme/AppThemeProvider';
import {
    C3_SERIES_PALETTE,
    C3_VISUALIZATION_COLORS,
} from '@/common/theme/c3VisualizationPalette';

import type {
    PillarCardDefinition,
    PillarSeriesDefinition,
} from './config';
import {
    toFiniteNumber,
    type PillarSearchRow,
} from './search';

const CHART_GRID_COLOR = 'var(--sui-border)';
const CHART_TICK_COLOR = 'var(--sui-content-muted)';
const LIGHT_SAFE_SERIES_COLORS: Readonly<Record<string, string>> = {
    [C3_VISUALIZATION_COLORS.info]: '#1d65b5',
    [C3_VISUALIZATION_COLORS.cyan]: '#006f8b',
    [C3_VISUALIZATION_COLORS.cyanBright]: '#007a99',
    [C3_VISUALIZATION_COLORS.positive]: '#137333',
    [C3_VISUALIZATION_COLORS.caution]: '#8a5d00',
    [C3_VISUALIZATION_COLORS.orange]: '#b54708',
    [C3_VISUALIZATION_COLORS.critical]: '#c52233',
    [C3_VISUALIZATION_COLORS.lavender]: '#5b5fc7',
    [C3_VISUALIZATION_COLORS.purple]: '#6d3cc7',
    [C3_VISUALIZATION_COLORS.neutral]: '#5f6873',
};

const resolveSeriesColor = (color: string, colorScheme: AppColorScheme): string =>
    colorScheme === 'light' ? (LIGHT_SAFE_SERIES_COLORS[color] ?? color) : color;

const SERIES_DASH_PATTERNS = [undefined, '7 3', '2 3', '9 3 2 3', '1 3'] as const;

const seriesPatternId = (cardId: string, field: string): string =>
    `scd-pillar-${cardId}-${field}`.replace(/[^a-zA-Z0-9_-]/g, '-');

const SeriesPattern = ({
    id,
    color,
    index,
    colorScheme,
}: {
    id: string;
    color: string;
    index: number;
    colorScheme: AppColorScheme;
}): JSX.Element => {
    const overlay = colorScheme === 'light' ? 'rgba(0, 0, 0, 0.34)' : 'rgba(255, 255, 255, 0.42)';
    const patternIndex = index % SERIES_DASH_PATTERNS.length;
    return (
        <pattern id={id} width="8" height="8" patternUnits="userSpaceOnUse">
            <rect width="8" height="8" fill={color} />
            {patternIndex === 1 ? (
                <path d="M-2 2L2-2M0 8L8 0M6 10L10 6" stroke={overlay} strokeWidth="1.25" />
            ) : null}
            {patternIndex === 2 ? (
                <path d="M-2 6L2 10M0 0L8 8M6-2L10 2" stroke={overlay} strokeWidth="1.25" />
            ) : null}
            {patternIndex === 3 ? (
                <path d="M2 0V8M6 0V8" stroke={overlay} strokeWidth="1.15" />
            ) : null}
            {patternIndex === 4 ? (
                <circle cx="2" cy="2" r="1.2" fill={overlay} />
            ) : null}
        </pattern>
    );
};

interface PillarVisualizationProps {
    card: PillarCardDefinition;
    rows: readonly PillarSearchRow[];
    colorScheme: AppColorScheme;
}

interface TooltipItem {
    color?: string;
    name?: string;
    value?: string | number;
}

interface ChartTooltipProps {
    active?: boolean;
    label?: string | number;
    payload?: readonly TooltipItem[];
}

const formatValue = (value: number, fractionDigits = 1): string =>
    new Intl.NumberFormat(undefined, {
        notation: Math.abs(value) >= 100000 ? 'compact' : 'standard',
        maximumFractionDigits: fractionDigits,
    }).format(value);

const displayValue = (value: unknown): string => {
    const numeric = toFiniteNumber(value);
    if (numeric !== null) return formatValue(numeric, 2);
    if (value === null || value === undefined || value === '') return '—';
    return String(value);
};

const formatTime = (value: unknown): string => {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    const numeric = Number(raw);
    const parsed = Number.isFinite(numeric)
        ? new Date(numeric < 1e12 ? numeric * 1000 : numeric)
        : new Date(raw);
    if (Number.isNaN(parsed.valueOf())) return raw;
    return parsed.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
};

const ChartTooltip = ({ active, label, payload }: ChartTooltipProps): JSX.Element | null => {
    if (!active || !payload?.length) return null;
    return (
        <div className="scd-pillar-chart-tooltip">
            {label ? <div className="scd-pillar-chart-tooltip-time">{label}</div> : null}
            {payload.map((item) => (
                <div className="scd-pillar-chart-tooltip-row" key={item.name}>
                    <span
                        aria-hidden="true"
                        className="scd-pillar-legend-dot"
                        style={{ backgroundColor: item.color }}
                    />
                    <span>{item.name}</span>
                    <strong>{displayValue(item.value)}</strong>
                </div>
            ))}
        </div>
    );
};

const deriveSeries = (
    card: PillarCardDefinition,
    rows: readonly PillarSearchRow[]
): readonly PillarSeriesDefinition[] => {
    const configured = [...(card.series ?? [])];
    if (!card.dynamicSeries) return configured;

    const configuredFields = new Set(configured.map((series) => series.field));
    const excluded = new Set([
        '_time',
        card.headlineField,
        card.deltaField ?? '',
        ...(card.excludedSeriesFields ?? []),
    ]);
    const extraFields: string[] = [];
    rows.forEach((row) => {
        Object.entries(row).forEach(([field, value]) => {
            if (
                excluded.has(field) ||
                field.startsWith('_') ||
                field.startsWith('Window') ||
                field === 'dashboard_precision_marker' ||
                configuredFields.has(field) ||
                extraFields.includes(field) ||
                toFiniteNumber(value) === null
            ) {
                return;
            }
            extraFields.push(field);
        });
    });

    return [
        ...configured,
        ...extraFields.map((field, index) => ({
            field,
            label: field,
            color: C3_SERIES_PALETTE[(configured.length + index) % C3_SERIES_PALETTE.length],
        })),
    ];
};

const SeriesLegend = ({
    series,
    visibleFields,
    onToggle,
}: {
    series: readonly PillarSeriesDefinition[];
    visibleFields: ReadonlySet<string>;
    onToggle: (field: string) => void;
}): JSX.Element => (
    <div className="scd-pillar-chart-legend" role="group" aria-label="Chart series">
        {series.map((item, index) => {
            const visible = visibleFields.has(item.field);
            const isOnlyVisibleSeries = visible && visibleFields.size === 1;
            return (
                <button
                    type="button"
                    key={item.field}
                    aria-pressed={visible}
                    className="scd-pillar-chart-legend-item"
                    disabled={isOnlyVisibleSeries}
                    onClick={() => onToggle(item.field)}
                    title={
                        isOnlyVisibleSeries
                            ? `${item.label} is the only visible series`
                            : `${visible ? 'Hide' : 'Show'} ${item.label}`
                    }
                >
                    <span
                        aria-hidden="true"
                        className={`scd-pillar-legend-dot is-pattern-${
                            index % SERIES_DASH_PATTERNS.length
                        }`}
                        style={{ backgroundColor: item.color, opacity: visible ? 1 : 0.28 }}
                    />
                    <span>{item.label}</span>
                </button>
            );
        })}
    </div>
);

const TrendChart = ({ card, rows, colorScheme }: PillarVisualizationProps): JSX.Element => {
    const series = useMemo(() => deriveSeries(card, rows), [card, rows]);
    const renderedSeries = useMemo(
        () =>
            series.map((item) => ({
                ...item,
                color: resolveSeriesColor(item.color, colorScheme),
            })),
        [colorScheme, series]
    );
    const [visibleFields, setVisibleFields] = useState<ReadonlySet<string>>(
        () => new Set(series.map((item) => item.field))
    );

    useEffect(() => {
        setVisibleFields(new Set(series.map((item) => item.field)));
    }, [series]);

    const data = useMemo(
        () =>
            rows.map((row) => {
                const normalized: Record<string, unknown> = {
                    ...row,
                    __timeLabel: formatTime(row._time),
                };
                series.forEach((item) => {
                    normalized[item.field] = toFiniteNumber(row[item.field]);
                });
                return normalized;
            }),
        [rows, series]
    );

    const toggleSeries = (field: string): void => {
        setVisibleFields((current) => {
            const next = new Set(current);
            if (next.has(field) && next.size > 1) next.delete(field);
            else next.add(field);
            return next;
        });
    };

    const seriesSummary = series
        .filter((item) => visibleFields.has(item.field))
        .map((item) => {
            const values = rows
                .map((row) => toFiniteNumber(row[item.field]))
                .filter((value): value is number => value !== null);
            if (values.length === 0) return `${item.label}: no reported values`;
            return `${item.label}: first ${formatValue(values[0], 2)}, last ${formatValue(
                values[values.length - 1],
                2
            )}, minimum ${formatValue(Math.min(...values), 2)}, maximum ${formatValue(
                Math.max(...values),
                2
            )}`;
        })
        .join('. ');
    const ariaLabel = `${card.title} ${
        card.kind === 'line' ? 'line trend' : 'stacked column trend'
    } with ${data.length} time buckets. ${seriesSummary}.`;

    return (
        <div className="scd-pillar-chart-stack">
            <div className="scd-pillar-chart" role="img" aria-label={ariaLabel}>
                <ResponsiveContainer width="100%" height="100%">
                    {card.kind === 'line' ? (
                        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                            <CartesianGrid
                                stroke={CHART_GRID_COLOR}
                                strokeDasharray="3 5"
                                vertical={false}
                            />
                            <XAxis
                                axisLine={false}
                                dataKey="__timeLabel"
                                minTickGap={44}
                                tick={{ fill: CHART_TICK_COLOR, fontSize: 12 }}
                                tickLine={false}
                            />
                            <YAxis
                                hide
                                domain={card.headlineUnit === '%' ? [0, 100] : [0, 'auto']}
                            />
                            <Tooltip content={<ChartTooltip />} />
                            {renderedSeries.map((item, index) =>
                                visibleFields.has(item.field) ? (
                                    <Line
                                        key={item.field}
                                        activeDot={{ r: 4, strokeWidth: 0 }}
                                        dataKey={item.field}
                                        dot={false}
                                        connectNulls={card.connectNulls}
                                        isAnimationActive={false}
                                        name={item.label}
                                        stroke={item.color}
                                        strokeDasharray={SERIES_DASH_PATTERNS[index % SERIES_DASH_PATTERNS.length]}
                                        strokeWidth={2}
                                        type="monotone"
                                    />
                                ) : null
                            )}
                        </LineChart>
                    ) : (
                        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                            <defs>
                                {renderedSeries.map((item, index) => (
                                    <SeriesPattern
                                        key={item.field}
                                        id={seriesPatternId(card.id, item.field)}
                                        color={item.color}
                                        index={index}
                                        colorScheme={colorScheme}
                                    />
                                ))}
                            </defs>
                            <CartesianGrid
                                stroke={CHART_GRID_COLOR}
                                strokeDasharray="3 5"
                                vertical={false}
                            />
                            <XAxis
                                axisLine={false}
                                dataKey="__timeLabel"
                                minTickGap={44}
                                tick={{ fill: CHART_TICK_COLOR, fontSize: 12 }}
                                tickLine={false}
                            />
                            <YAxis hide />
                            <Tooltip content={<ChartTooltip />} />
                            {renderedSeries.map((item) =>
                                visibleFields.has(item.field) ? (
                                    <Bar
                                        key={item.field}
                                        dataKey={item.field}
                                        fill={`url(#${seriesPatternId(card.id, item.field)})`}
                                        isAnimationActive={false}
                                        maxBarSize={24}
                                        name={item.label}
                                        stackId="signal"
                                    />
                                ) : null
                            )}
                        </BarChart>
                    )}
                </ResponsiveContainer>
            </div>
            {renderedSeries.length > 1 ? (
                <SeriesLegend
                    series={renderedSeries}
                    visibleFields={visibleFields}
                    onToggle={toggleSeries}
                />
            ) : null}
        </div>
    );
};

const EvidenceTable = ({ card, rows }: PillarVisualizationProps): JSX.Element => {
    const columns = card.tableColumns ?? [];
    const displayedRows = rows.slice(0, 5);
    return (
        <div className="scd-pillar-table-wrap">
            <table className="scd-pillar-table">
                <caption>
                    <ScreenReaderContent>{card.title} evidence</ScreenReaderContent>
                </caption>
                <thead>
                    <tr>
                        {columns.map((column) => (
                            <th scope="col" key={column}>
                                {column}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {displayedRows.map((row, index) => (
                        <tr key={`${String(row[columns[0]] ?? 'row')}-${index}`}>
                            {columns.map((column) => (
                                <td key={column}>{displayValue(row[column])}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const RankedBars = ({ card, rows, colorScheme }: PillarVisualizationProps): JSX.Element => {
    const categoryField = card.categoryField ?? '';
    const valueField = card.valueField ?? '';
    const valueLabel = card.valueLabel ?? valueField;
    const data = rows.slice(0, card.rankLimit ?? 10).map((row) => ({
        label: String(row[categoryField] ?? 'Unknown'),
        value: toFiniteNumber(row[valueField]) ?? 0,
    }));

    return (
        <div
            className="scd-pillar-chart scd-pillar-ranked-chart"
            role="img"
            aria-label={`${card.title} ranked comparison with ${data.length} categories. ${data
                .map((item) => `${item.label}: ${formatValue(item.value, 2)} ${valueLabel}`)
                .join('. ')}.`}
        >
            <ResponsiveContainer width="100%" height="100%">
                <BarChart
                    data={data}
                    layout="vertical"
                    margin={{ top: 2, right: 16, bottom: 2, left: 8 }}
                >
                    <CartesianGrid
                        horizontal={false}
                        stroke={CHART_GRID_COLOR}
                        strokeDasharray="3 5"
                    />
                    <XAxis hide type="number" />
                    <YAxis
                        axisLine={false}
                        dataKey="label"
                        tick={{ fill: CHART_TICK_COLOR, fontSize: 12 }}
                        tickLine={false}
                        type="category"
                        width={card.categoryAxisWidth ?? 108}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar
                        dataKey="value"
                        fill={resolveSeriesColor(
                            card.barColor ?? C3_SERIES_PALETTE[1],
                            colorScheme
                        )}
                        isAnimationActive={false}
                        maxBarSize={18}
                        name={card.valueLabel ?? valueField}
                        radius={[0, 4, 4, 0]}
                    />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

export const PillarVisualization = ({
    card,
    rows,
    colorScheme,
}: PillarVisualizationProps): JSX.Element => {
    if (card.kind === 'table') {
        return <EvidenceTable card={card} rows={rows} colorScheme={colorScheme} />;
    }
    if (card.kind === 'ranked-bars') {
        return <RankedBars card={card} rows={rows} colorScheme={colorScheme} />;
    }
    return <TrendChart card={card} rows={rows} colorScheme={colorScheme} />;
};

export const formatPillarValue = formatValue;
