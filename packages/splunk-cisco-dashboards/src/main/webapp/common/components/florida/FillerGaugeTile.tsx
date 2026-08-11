/**
 * FillerGaugeTile — horizontal filler gauge for a single scalar.
 * Canvas analogue of Splunk `splunk.fillergauge`.
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
import type { DataSource, NoDataReason } from '@/common/hooks/useMetric';
import { C3_VISUALIZATION_COLORS } from '@/common/theme/c3VisualizationPalette';

export interface FillerGaugeTileProps {
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

const toFiniteNumber = (value: string | number): number | null => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value !== 'string') return null;
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
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
            <span className="text-xs font-medium text-slate-400 dark:text-slate-500 mt-0.5">
                {subtext}
            </span>
        </div>
    );
};

export const FillerGaugeTile: React.FC<FillerGaugeTileProps> = ({
    label,
    subLabel,
    meaningSubtitle,
    description,
    descriptionFootnote,
    thresholdNote,
    value,
    unit = '',
    accentColor = C3_VISUALIZATION_COLORS.info,
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
    const widthPct =
        numeric !== null
            ? percentInRange(clampToRange(numeric, gaugeRange), gaugeRange)
            : 0;

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
                        className="flex-1 min-h-[48px] max-h-20 flex flex-col justify-center gap-1 pt-1"
                    >
                        <div className="h-3 w-full rounded-sm bg-slate-100 dark:bg-slate-800 overflow-hidden">
                            <div
                                className="h-full rounded-sm transition-[width]"
                                style={{
                                    width: `${Math.max(2, widthPct)}%`,
                                    backgroundColor: fillColor,
                                }}
                            />
                        </div>
                        <div className="flex justify-between text-xs tabular-nums text-slate-400 dark:text-slate-500 font-medium">
                            <span>{gaugeRange.min}</span>
                            <span>{gaugeRange.max}</span>
                        </div>
                    </div>
                </>
            )}
        </CanvasScalarTileChrome>
    );
};
