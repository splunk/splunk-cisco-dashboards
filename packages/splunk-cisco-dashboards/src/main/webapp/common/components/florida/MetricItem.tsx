import React from 'react';
import {
    ArrowDown,
    ArrowUp,
    AlertTriangle,
    AlertCircle,
    CheckCircle2,
    ExternalLink,
} from 'lucide-react';
import { Sparkline } from './Sparkline';
import { InfoTooltip, type InfoTooltipAnchor } from './InfoTooltip';
import { cn } from '@/common/lib/utils';
import type { MetricStatus, DataSource, TimeRange } from '@/common/hooks/useMetric';

interface MetricItemProps {
    label: string;
    subLabel?: string;
    /**
     * Long-form description shown in a hover/focus Info tooltip. When
     * omitted, the info icon is not rendered.
     */
    description?: string;
    /**
     * Caption shown at the bottom of the Info tooltip — typically the
     * resolved SPL or saved-search name so consumers can trace the
     * displayed value back to its source.
     */
    descriptionFootnote?: string;
    /** Where the Info tooltip should anchor relative to the icon. */
    infoAnchor?: InfoTooltipAnchor;
    value: string | number;
    unit?: string;
    change?: number;
    sparkData: number[];
    previousData?: number[];
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
    sparkTitle?: string;
    className?: string;
}

const STATUS_TEXT_COLOR: Record<MetricStatus, string> = {
    healthy: 'text-sky-600 dark:text-sky-300',
    warning: 'text-amber-500 dark:text-amber-300',
    critical: 'text-red-600 dark:text-red-400',
    unknown: 'text-sky-600 dark:text-sky-300',
};

const StatusIcon: React.FC<{ status: MetricStatus }> = ({ status }) => {
    if (status === 'critical')
        return <AlertCircle className="w-3 h-3 text-red-500" aria-label="Critical" />;
    if (status === 'warning')
        return <AlertTriangle className="w-3 h-3 text-amber-500" aria-label="Warning" />;
    if (status === 'healthy')
        return <CheckCircle2 className="w-3 h-3 text-emerald-500" aria-label="Healthy" />;
    return null;
};

export const MetricItem: React.FC<MetricItemProps> = ({
    label,
    subLabel,
    description,
    descriptionFootnote,
    infoAnchor = 'auto',
    value,
    unit = '',
    change,
    sparkData,
    previousData,
    sparkTimestamps,
    timeRange,
    color = '#0ea5e9',
    status = 'unknown',
    source,
    onOpenInSearch,
    sparkTitle,
    className,
}) => {
    return (
        <div className={cn('flex flex-col min-w-[160px] px-2 py-1 relative', className)}>
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
                            : 'No saved search assigned (mock data)'
                    }
                />
            )}

            <div className="flex flex-col mb-0.5">
                <span className="text-[12px] font-bold text-slate-800 dark:text-slate-100 tracking-tight leading-tight uppercase flex items-center gap-1">
                    <span className="flex items-center gap-1 min-w-0 truncate">
                        {label}
                        {status !== 'unknown' && <StatusIcon status={status} />}
                    </span>
                    <span className="ml-auto flex items-center gap-0.5 flex-shrink-0">
                        {description && (
                            <InfoTooltip
                                title={label}
                                description={description}
                                footnote={descriptionFootnote}
                                anchor={infoAnchor}
                                iconAriaLabel={`What does ${label} measure?`}
                            />
                        )}
                        {onOpenInSearch && (
                            <button
                                type="button"
                                onClick={onOpenInSearch}
                                title={sparkTitle ?? 'Open in Splunk Search'}
                                aria-label={`Open ${label} in Splunk Search`}
                                className="p-0.5 -my-0.5 text-slate-300 dark:text-slate-500 hover:text-sky-600 dark:hover:text-sky-300 transition-colors rounded focus:outline-none focus:ring-1 focus:ring-sky-400"
                            >
                                <ExternalLink className="w-3 h-3 stroke-[2.5px]" />
                            </button>
                        )}
                    </span>
                </span>
                {subLabel && (
                    <span className="text-[9.5px] text-slate-400 dark:text-slate-500 font-medium tracking-tight leading-tight line-clamp-1 min-h-[12px]">
                        {subLabel}
                    </span>
                )}
            </div>

            <div className="flex items-baseline gap-2 mb-1">
                <span
                    className={cn(
                        'text-4xl font-black tracking-tighter leading-none transition-colors',
                        STATUS_TEXT_COLOR[status]
                    )}
                >
                    {value}
                    {unit}
                </span>
                {change !== undefined && (
                    <div
                        className={cn(
                            'flex items-center text-[10px] font-black',
                            change >= 0 ? 'text-green-500' : 'text-red-500'
                        )}
                    >
                        {change >= 0 ? (
                            <ArrowUp className="w-3 h-3 stroke-[3px]" />
                        ) : (
                            <ArrowDown className="w-3 h-3 stroke-[3px]" />
                        )}
                        <span>{change > 0 ? `+${change}` : change}%</span>
                    </div>
                )}
            </div>

            <div className="h-10 mt-auto opacity-80 hover:opacity-100 transition-opacity">
                <Sparkline
                    data={sparkData}
                    color={color}
                    previousData={previousData}
                    timestamps={sparkTimestamps}
                    timeRange={timeRange}
                    formatValue={(n) => `${n.toLocaleString()}${unit}`}
                    onClick={onOpenInSearch}
                    title={sparkTitle}
                />
            </div>
        </div>
    );
};
