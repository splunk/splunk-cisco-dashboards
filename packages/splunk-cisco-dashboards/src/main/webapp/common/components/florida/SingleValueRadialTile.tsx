/**
 * SingleValueRadialTile — headline scalar with a radial progress ring.
 * Canvas analogue of Splunk `splunk.singlevalueradial`.
 */

import React from 'react';
import { CanvasScalarTileChrome } from './CanvasScalarTileChrome';
import {
    clampToRange,
    colorForValueInBands,
    percentInRange,
    resolveColorBands,
    resolveGaugeRange,
    type GaugeRange,
} from './canvasVizOptions';
import { cn } from '@/common/lib/utils';
import type { DataSource, NoDataReason } from '@/common/hooks/useMetric';

export interface SingleValueRadialTileProps {
    label: string;
    subLabel?: string;
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

const toFiniteNumber = (value: string | number): number | null => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value !== 'string') return null;
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
};

const RadialRing: React.FC<{
    percent: number;
    strokeColor: string;
}> = ({ percent, strokeColor }) => {
    const size = 88;
    const stroke = 8;
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const clamped = Math.max(0, Math.min(100, percent));
    const offset = circumference * (1 - clamped / 100);
    return (
        <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className="flex-shrink-0"
            aria-hidden="true"
        >
            <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth={stroke}
                className="text-slate-200 dark:text-slate-700"
            />
            <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={strokeColor}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
        </svg>
    );
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
        <div className="flex flex-1 items-center justify-center gap-4 min-h-[88px]">
            <div className="flex flex-col">
                <span className="text-4xl font-black tracking-tighter leading-none text-slate-400 dark:text-slate-500">
                    —
                </span>
                <span className="text-[9px] font-medium text-slate-400 dark:text-slate-500 mt-0.5">
                    {subtext}
                </span>
            </div>
        </div>
    );
};

export const SingleValueRadialTile: React.FC<SingleValueRadialTileProps> = ({
    label,
    subLabel,
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
    const bands = resolveColorBands(vizOptions);
    const numeric = toFiniteNumber(value);
    const isNoData = typeof value === 'number' && Number.isNaN(value);
    const fillColor =
        numeric !== null
            ? colorForValueInBands(numeric, bands, accentColor)
            : accentColor;
    const percent =
        numeric !== null ? percentInRange(clampToRange(numeric, gaugeRange), gaugeRange) : 0;

    return (
        <CanvasScalarTileChrome
            label={label}
            subLabel={subLabel}
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
                <div
                    data-tile-control="true"
                    className="flex flex-1 items-center justify-center gap-3 min-h-[88px] max-h-28"
                >
                    <RadialRing percent={percent} strokeColor={fillColor} />
                    <span
                        className={cn(
                            'text-3xl font-black tracking-tighter leading-none text-slate-700 dark:text-slate-100 tabular-nums'
                        )}
                    >
                        {value}
                        {unit}
                    </span>
                </div>
            )}
        </CanvasScalarTileChrome>
    );
};
