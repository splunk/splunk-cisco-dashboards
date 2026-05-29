/**
 * MarkerGaugeTile — scalar on a threshold scale with a position marker.
 * Canvas analogue of Splunk `splunk.markergauge`.
 */

import React, { useMemo } from 'react';
import { CanvasScalarTileChrome } from './CanvasScalarTileChrome';
import {
    clampToRange,
    colorForValueInBands,
    percentInRange,
    resolveColorBands,
    resolveGaugeRange,
    DEFAULT_GAUGE_RANGE,
    type ColorBand,
    type GaugeRange,
} from './canvasVizOptions';
import type { DataSource, NoDataReason } from '@/common/hooks/useMetric';

export interface MarkerGaugeTileProps {
    label: string;
    subLabel?: string;
    /** Plumbed through to the chrome's meaning-subtitle row. */
    meaningSubtitle?: string;
    description?: string;
    descriptionFootnote?: string;
    thresholdNote?: string;
    value: string | number;
    unit?: string;
    accentColor?: string;
    vizOptions?: Record<string, unknown>;
    source?: DataSource;
    onOpenInSearch?: () => void;
    onConfigure?: () => void;
    onOpenDetailTable?: () => void;
    detailTableTitle?: string;
    isCustomized?: boolean;
    noDataReason?: NoDataReason;
    rangeLabel?: string;
    className?: string;
}

const DEFAULT_MARKER_BANDS: ColorBand[] = [
    { to: 50, value: '#dc2626' },
    { from: 50, to: 80, value: '#eab308' },
    { from: 80, value: '#16a34a' },
];

const toFiniteNumber = (value: string | number): number | null => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value !== 'string') return null;
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
};

const buildTrackSegments = (
    bands: ColorBand[],
    range: GaugeRange
): Array<{ leftPct: number; widthPct: number; color: string }> => {
    if (bands.length === 0) {
        return [{ leftPct: 0, widthPct: 100, color: '#94a3b8' }];
    }
    const span = range.max - range.min;
    if (span <= 0) return [{ leftPct: 0, widthPct: 100, color: bands[0].value }];

    const segments: Array<{ leftPct: number; widthPct: number; color: string }> = [];
    for (const band of bands) {
        const start = band.from ?? range.min;
        const end = band.to ?? range.max;
        const clampedStart = clampToRange(start, range);
        const clampedEnd = clampToRange(end, range);
        if (clampedEnd <= clampedStart) continue;
        const leftPct = ((clampedStart - range.min) / span) * 100;
        const widthPct = ((clampedEnd - clampedStart) / span) * 100;
        if (widthPct > 0) {
            segments.push({ leftPct, widthPct, color: band.value });
        }
    }
    return segments.length > 0
        ? segments
        : [{ leftPct: 0, widthPct: 100, color: bands[0].value }];
};

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
        <div className="flex flex-col mb-1">
            <span className="text-4xl font-black tracking-tighter leading-none text-slate-400 dark:text-slate-500">
                —
            </span>
            <span className="text-[9px] font-medium text-slate-400 dark:text-slate-500 mt-0.5">
                {subtext}
            </span>
        </div>
    );
};

export const MarkerGaugeTile: React.FC<MarkerGaugeTileProps> = ({
    label,
    subLabel,
    meaningSubtitle,
    description,
    descriptionFootnote,
    thresholdNote,
    value,
    unit = '',
    accentColor = '#0ea5e9',
    vizOptions,
    source,
    onOpenInSearch,
    onConfigure,
    onOpenDetailTable,
    detailTableTitle,
    isCustomized,
    noDataReason,
    rangeLabel,
    className,
}) => {
    const gaugeRange: GaugeRange = resolveGaugeRange(vizOptions);
    const configuredBands = resolveColorBands(vizOptions);
    const bands =
        configuredBands.length > 0 ? configuredBands : DEFAULT_MARKER_BANDS;
    const numeric = toFiniteNumber(value);
    const isNoData = typeof value === 'number' && Number.isNaN(value);
    const markerColor =
        numeric !== null
            ? colorForValueInBands(numeric, bands, accentColor)
            : accentColor;
    const markerLeftPct =
        numeric !== null
            ? percentInRange(clampToRange(numeric, gaugeRange), gaugeRange)
            : 0;

    const trackSegments = useMemo(
        () => buildTrackSegments(bands, gaugeRange),
        [bands, gaugeRange]
    );

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
            onConfigure={onConfigure}
            onOpenDetailTable={onOpenDetailTable}
            detailTableTitle={detailTableTitle}
            isCustomized={isCustomized}
            className={className}
        >
            {isNoData ? (
                <NoDataBody noDataReason={noDataReason} rangeLabel={rangeLabel} />
            ) : (
                <>
                    <div className="flex items-baseline gap-2 mb-1">
                        <span className="text-4xl font-black tracking-tighter leading-none text-slate-700 dark:text-slate-100 tabular-nums">
                            {value}
                            {unit}
                        </span>
                    </div>
                    <div
                        data-tile-control="true"
                        className="flex-1 min-h-[56px] max-h-24 flex flex-col justify-center pt-1"
                    >
                        <div className="relative h-4 w-full rounded-sm overflow-visible">
                            <div className="absolute inset-0 h-full w-full rounded-sm overflow-hidden">
                                {trackSegments.map((seg, index) => (
                                    <div
                                        key={`${seg.leftPct}-${index}`}
                                        className="absolute top-0 h-full"
                                        style={{
                                            left: `${seg.leftPct}%`,
                                            width: `${seg.widthPct}%`,
                                            backgroundColor: seg.color,
                                        }}
                                    />
                                ))}
                            </div>
                            <div
                                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-r-[5px] border-b-[8px] border-l-transparent border-r-transparent"
                                style={{
                                    left: `${Math.max(2, Math.min(98, markerLeftPct))}%`,
                                    borderBottomColor: markerColor,
                                }}
                                aria-hidden="true"
                            />
                        </div>
                        <div className="flex justify-between text-[9px] tabular-nums text-slate-400 dark:text-slate-500 font-medium mt-2">
                            <span>{gaugeRange.min ?? DEFAULT_GAUGE_RANGE.min}</span>
                            <span>{gaugeRange.max ?? DEFAULT_GAUGE_RANGE.max}</span>
                        </div>
                    </div>
                </>
            )}
        </CanvasScalarTileChrome>
    );
};
