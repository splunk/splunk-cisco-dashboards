/**
 * SingleValueRadialTile — headline scalar with a radial progress arc.
 *
 * Canvas analogue of Splunk Dashboard Studio's `splunk.singlevalueradial`
 * "scoreboard" gauge. Defaults to a 180-degree half-arc with the headline
 * value (and optional inline delta) centred inside the arc as SVG text.
 *
 * Configurable via `viz_options` keys (see `canvasVizOptions.ts` for the
 * full schema): `arcDegrees`, `min` / `max`, `showDelta`, `deltaFormat`,
 * `deltaField`, `decimals`, `valueSuffix`, `trackColor`, `fillColor`.
 *
 * Defaults are tuned so a stanza that just sets
 * `default_viz = splunk.singlevalueradial` (no `viz_options`) renders
 * the DS scoreboard look out of the box.
 */

import React from 'react';
import { CanvasScalarTileChrome } from './CanvasScalarTileChrome';
import {
    clampToRange,
    colorForValueInBands,
    percentInRange,
    resolveArcDegrees,
    resolveColorBands,
    resolveDecimals,
    resolveDeltaFormat,
    resolveFillColorOverride,
    resolveGaugeRange,
    resolveShowDelta,
    resolveTrackColor,
    resolveValueSuffix,
    type DeltaFormat,
    type GaugeRange,
} from './canvasVizOptions';
import type { DataSource, NoDataReason } from '@/common/hooks/useMetric';
import { C3_VISUALIZATION_COLORS } from '@/common/theme/c3VisualizationPalette';

export interface SingleValueRadialTileProps {
    label: string;
    subLabel?: string;
    /** Plumbed through to the chrome's meaning-subtitle row. */
    meaningSubtitle?: string;
    description?: string;
    descriptionFootnote?: string;
    thresholdNote?: string;
    value: string | number;
    /**
     * Optional delta to display inline with the headline. Interpreted
     * per `viz_options.deltaFormat`: `absolute` renders the raw number,
     * `percent` appends `%`. Wired by the Searchbase Canvas from
     * `useMetric.change`.
     */
    change?: number;
    unit?: string;
    accentColor?: string;
    vizOptions?: Record<string, unknown>;
    source?: DataSource;
    onOpenInSearch?: () => void;
    searchbaseId?: string;
    onConfigure?: () => void;
    onOpenDetailTable?: () => void;
    detailTableTitle?: string;
    isCustomized?: boolean;
    noDataReason?: NoDataReason;
    rangeLabel?: string;
    className?: string;
}

const toFiniteNumber = (value: string | number): number | null => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value !== 'string') return null;
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
};

// ---------------------------------------------------------------------------
// Geometry helpers — polar -> cartesian for SVG arc paths.
// `angleDeg` convention: 0 deg points up (toward decreasing y), positive
// values sweep clockwise. This matches a gauge mental model where the
// top of the dial is the centre of the sweep.
// ---------------------------------------------------------------------------

const polarToCartesian = (
    cx: number,
    cy: number,
    r: number,
    angleDeg: number
): { x: number; y: number } => {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
};

/**
 * Build an SVG arc `d` attribute centred symmetrically around the top
 * of a circle. `arcDegrees` is the total sweep; 180 is a half-arc, 360
 * is a full ring (drawn as two semi-arcs since SVG cannot draw a full
 * circle in a single A command).
 */
const buildArcPath = (
    cx: number,
    cy: number,
    r: number,
    arcDegrees: number
): string => {
    const sweep = Math.max(0, Math.min(360, arcDegrees));
    if (sweep >= 360) {
        return [
            `M ${cx} ${cy - r}`,
            `A ${r} ${r} 0 1 1 ${cx} ${cy + r}`,
            `A ${r} ${r} 0 1 1 ${cx} ${cy - r}`,
        ].join(' ');
    }
    const start = polarToCartesian(cx, cy, r, -sweep / 2);
    const end = polarToCartesian(cx, cy, r, sweep / 2);
    const largeArcFlag = sweep > 180 ? 1 : 0;
    return [
        `M ${start.x} ${start.y}`,
        `A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`,
    ].join(' ');
};

/** Length (px) of the visible arc — used for strokeDasharray tweens. */
const arcPathLength = (r: number, arcDegrees: number): number => {
    const sweep = Math.max(0, Math.min(360, arcDegrees));
    return (Math.PI * r * sweep) / 180;
};

const formatNumber = (n: number, decimals: number): string =>
    Number.isFinite(n) ? n.toFixed(decimals) : '0';

// Match the chrome's universal accent fallback so the radial knows when
// the caller's `accentColor` is the default sky-blue (i.e. the stanza
// did not override `seriesColors`) and we should drop to a DS-style
// near-black fill instead.
const DEFAULT_ACCENT_FALLBACK = C3_VISUALIZATION_COLORS.info;
// DS scoreboard fill: dark slate, near-black, theme primary.
const RADIAL_DEFAULT_FILL = '#131a23';
// DS-style neutral track. Hex-equivalent of Tailwind slate-200 so the
// custom override and the default render at the same lightness.
const RADIAL_DEFAULT_TRACK = '#e2e8f0';

const resolveRadialColors = (
    vizOptions: Record<string, unknown> | undefined,
    accentColor: string,
    bands: ReturnType<typeof resolveColorBands>,
    numeric: number | null
): { fillColor: string; trackColor: string } => {
    const trackOverride = resolveTrackColor(vizOptions);
    const fillOverride = resolveFillColorOverride(vizOptions);

    let fillColor: string;
    if (fillOverride) {
        fillColor = fillOverride;
    } else if (numeric !== null && bands.length > 0) {
        // colorForValueInBands returns the fallback when no band
        // matches; pass an empty sentinel so we can detect "no match"
        // and fall through to the accent / radial default chain.
        const banded = colorForValueInBands(numeric, bands, '');
        if (banded.length > 0) {
            fillColor = banded;
        } else if (accentColor && accentColor !== DEFAULT_ACCENT_FALLBACK) {
            fillColor = accentColor;
        } else {
            fillColor = RADIAL_DEFAULT_FILL;
        }
    } else if (accentColor && accentColor !== DEFAULT_ACCENT_FALLBACK) {
        fillColor = accentColor;
    } else {
        fillColor = RADIAL_DEFAULT_FILL;
    }

    return {
        fillColor,
        trackColor: trackOverride ?? RADIAL_DEFAULT_TRACK,
    };
};

// ---------------------------------------------------------------------------
// Arc renderer (pure SVG)
// ---------------------------------------------------------------------------

const STROKE_WIDTH = 9;
const ARC_RADIUS = 54;
// Vertical centre placement: for a half-arc we anchor near the bottom
// so the arc opens downward (scoreboard look). For a full circle the
// centre lives in the middle of the viewBox.
const halfArcGeometry = (
    arcDegrees: number
): { width: number; height: number; cx: number; cy: number } => {
    const inset = STROKE_WIDTH / 2 + 2;
    const width = ARC_RADIUS * 2 + STROKE_WIDTH + 4;
    if (arcDegrees >= 360) {
        const height = width;
        return { width, height, cx: width / 2, cy: height / 2 };
    }
    if (arcDegrees > 180) {
        // Greater than 180 means the arc "drops below" the diameter.
        const height = ARC_RADIUS * 2 + STROKE_WIDTH + 4;
        return { width, height, cx: width / 2, cy: ARC_RADIUS + inset };
    }
    // 0 < arcDegrees <= 180: arc lives in the upper half of the bounds.
    const height = ARC_RADIUS + inset * 2;
    return { width, height, cx: width / 2, cy: ARC_RADIUS + inset };
};

interface RadialArcProps {
    percent: number;
    fillColor: string;
    trackColor: string;
    arcDegrees: number;
    valueText: string;
    deltaText: string | null;
    isMockOrLoading: boolean;
}

const RadialArc: React.FC<RadialArcProps> = ({
    percent,
    fillColor,
    trackColor,
    arcDegrees,
    valueText,
    deltaText,
    isMockOrLoading,
}) => {
    const { width, height, cx, cy } = halfArcGeometry(arcDegrees);
    const path = buildArcPath(cx, cy, ARC_RADIUS, arcDegrees);
    const length = arcPathLength(ARC_RADIUS, arcDegrees);
    const clampedPct = Math.max(0, Math.min(100, percent));
    const offset = length * (1 - clampedPct / 100);

    // For a 180-degree arc the value sits visually *inside* the arc;
    // nudge the text up a touch so it isn't clipped by the open end.
    const textY =
        arcDegrees <= 180
            ? cy - ARC_RADIUS * 0.18
            : cy;

    return (
        <svg
            width="100%"
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="xMidYMid meet"
            className="block max-h-[112px]"
            aria-hidden="true"
        >
            <path
                d={path}
                fill="none"
                stroke={trackColor}
                strokeWidth={STROKE_WIDTH}
                strokeLinecap="round"
            />
            <path
                d={path}
                fill="none"
                stroke={fillColor}
                strokeWidth={STROKE_WIDTH}
                strokeLinecap="round"
                strokeDasharray={length}
                strokeDashoffset={offset}
                style={{
                    transition: 'stroke-dashoffset 600ms ease-out',
                    opacity: isMockOrLoading ? 0.55 : 1,
                }}
            />
            {/*
              Single text element with two tspans keeps the value and
              delta on the same baseline (tspan default alphabetic
              alignment) while letting `textAnchor="middle"` centre the
              combined run inside the arc. This satisfies the "centered
              inside the arc as SVG text" requirement and produces the
              DS look ("85   ↑4") without needing JS bbox measurement.
            */}
            <text
                x={cx}
                y={textY}
                textAnchor="middle"
                dominantBaseline="central"
                className="sui-fill-active tabular-nums"
                style={{
                    fontFamily: 'inherit',
                    fontWeight: 800,
                    letterSpacing: '-0.02em',
                }}
            >
                <tspan style={{ fontSize: '28px' }}>{valueText}</tspan>
                {deltaText !== null && (
                    <tspan
                        dx="6"
                        className="sui-fill-muted sui-fill-default"
                        style={{ fontSize: '13px', fontWeight: 700 }}
                    >
                        {deltaText}
                    </tspan>
                )}
            </text>
        </svg>
    );
};

// ---------------------------------------------------------------------------
// Delta formatting helpers
// ---------------------------------------------------------------------------

const ARROW_UP = '\u2191'; // U+2191 UPWARDS ARROW
const ARROW_DOWN = '\u2193'; // U+2193 DOWNWARDS ARROW

const formatDelta = (
    change: number | undefined,
    format: DeltaFormat,
    decimals: number
): string | null => {
    if (typeof change !== 'number' || !Number.isFinite(change)) return null;
    const magnitude = Math.abs(change);
    const body = magnitude.toFixed(decimals);
    let prefix = '';
    if (change > 0) prefix = ARROW_UP;
    else if (change < 0) prefix = ARROW_DOWN;
    return format === 'percent' ? `${prefix}${body}%` : `${prefix}${body}`;
};

// ---------------------------------------------------------------------------
// No-data body
// ---------------------------------------------------------------------------

const NoDataBody: React.FC<{
    noDataReason?: NoDataReason;
    rangeLabel?: string;
}> = ({ noDataReason, rangeLabel }) => {
    let subtext: string;
    if (noDataReason === 'error') {
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
        <div className="flex flex-1 items-center justify-center gap-4 min-h-[88px]">
            <div className="flex flex-col items-center">
                <span className="text-4xl font-black tracking-tighter leading-none  sui-color-muted">
                    —
                </span>
                <span className="text-xs font-medium  sui-color-muted mt-0.5">
                    {subtext}
                </span>
            </div>
        </div>
    );
};

// ---------------------------------------------------------------------------
// Tile component
// ---------------------------------------------------------------------------

export const SingleValueRadialTile: React.FC<SingleValueRadialTileProps> = ({
    label,
    subLabel,
    meaningSubtitle,
    description,
    descriptionFootnote,
    thresholdNote,
    value,
    change,
    unit = '',
    accentColor = DEFAULT_ACCENT_FALLBACK,
    vizOptions,
    source,
    onOpenInSearch,
    searchbaseId,
    onConfigure,
    onOpenDetailTable,
    detailTableTitle,
    isCustomized,
    noDataReason,
    rangeLabel,
    className,
}) => {
    const gaugeRange: GaugeRange = resolveGaugeRange(vizOptions);
    const bands = resolveColorBands(vizOptions);
    const arcDegrees = resolveArcDegrees(vizOptions);
    const showDelta = resolveShowDelta(vizOptions);
    const deltaFormat = resolveDeltaFormat(vizOptions);
    const decimals = resolveDecimals(vizOptions);
    const suffix = resolveValueSuffix(vizOptions);

    const numeric = toFiniteNumber(value);
    const isNoData = typeof value === 'number' && Number.isNaN(value);
    const { fillColor, trackColor } = resolveRadialColors(
        vizOptions,
        accentColor,
        bands,
        numeric
    );

    // Headline string. Numeric values respect `decimals`; string values
    // (e.g. SPL emitted "12 of 18 available") render verbatim. Authors
    // that need a unit append it via `unit` (legacy) or via
    // `valueSuffix` (new viz_option, more obvious).
    let valueText: string;
    if (typeof value === 'string') {
        valueText = value;
    } else if (numeric !== null) {
        valueText = formatNumber(numeric, decimals);
    } else {
        valueText = '0';
    }
    const valueSuffix = suffix || unit;
    if (valueSuffix) valueText = `${valueText}${valueSuffix}`;

    const deltaText = showDelta
        ? formatDelta(change, deltaFormat, decimals === 0 ? 0 : Math.min(decimals, 2))
        : null;

    const percent =
        numeric !== null
            ? percentInRange(clampToRange(numeric, gaugeRange), gaugeRange)
            : 0;

    const isMockOrLoading = source === 'mock' || source === 'loading';

    return (
        <CanvasScalarTileChrome
            label={label}
            subLabel={subLabel}
            meaningSubtitle={meaningSubtitle}
            description={description}
            descriptionFootnote={descriptionFootnote}
            thresholdNote={thresholdNote}
            source={source}
            onOpenInSearch={onOpenInSearch}
            searchbaseId={searchbaseId}
            onConfigure={onConfigure}
            onOpenDetailTable={onOpenDetailTable}
            detailTableTitle={detailTableTitle}
            isCustomized={isCustomized}
            className={className}
        >
            {isNoData ? (
                <NoDataBody noDataReason={noDataReason} rangeLabel={rangeLabel} />
            ) : (
                <div
                    data-tile-control="true"
                    className="flex flex-1 items-center justify-center min-h-[88px]"
                >
                    <RadialArc
                        percent={percent}
                        fillColor={fillColor}
                        trackColor={trackColor}
                        arcDegrees={arcDegrees}
                        valueText={valueText}
                        deltaText={deltaText}
                        isMockOrLoading={isMockOrLoading}
                    />
                </div>
            )}
        </CanvasScalarTileChrome>
    );
};
