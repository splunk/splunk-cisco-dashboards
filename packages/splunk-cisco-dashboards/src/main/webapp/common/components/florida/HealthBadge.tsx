import React from 'react';
import { ShieldAlert, ShieldCheck, ShieldQuestion, ShieldOff } from '@/common/icons/SuiIcon';
import { cn } from '@/common/lib/utils';
import type { MetricStatus } from '@/common/hooks/useMetric';

interface HealthBadgeProps {
    statuses: MetricStatus[];
    className?: string;
}

interface Aggregate {
    overall: MetricStatus;
    critical: number;
    warning: number;
    healthy: number;
    unknown: number;
}

export const aggregateStatuses = (statuses: MetricStatus[]): Aggregate => {
    const counts: Aggregate = {
        overall: 'unknown',
        critical: 0,
        warning: 0,
        healthy: 0,
        unknown: 0,
    };
    for (const s of statuses) counts[s] += 1;
    if (counts.critical > 0) counts.overall = 'critical';
    else if (counts.warning > 0) counts.overall = 'warning';
    else if (counts.healthy > 0) counts.overall = 'healthy';
    else counts.overall = 'unknown';
    return counts;
};

const formatLabel = (agg: Aggregate): string => {
    if (agg.overall === 'critical') {
        const parts = [`${agg.critical} critical`];
        if (agg.warning) parts.push(`${agg.warning} warning`);
        return parts.join(' · ');
    }
    if (agg.overall === 'warning') {
        return `${agg.warning} warning${agg.warning === 1 ? '' : 's'}`;
    }
    if (agg.overall === 'healthy') return 'All systems operational';
    return 'Awaiting metrics';
};

export const HealthBadge: React.FC<HealthBadgeProps> = ({ statuses, className }) => {
    const agg = aggregateStatuses(statuses);
    const label = formatLabel(agg);
    const Icon =
        agg.overall === 'critical'
            ? ShieldAlert
            : agg.overall === 'warning'
            ? ShieldOff
            : agg.overall === 'healthy'
            ? ShieldCheck
            : ShieldQuestion;
    const palette =
        agg.overall === 'critical'
            ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950/40 dark:border-red-900 dark:text-red-300'
            : agg.overall === 'warning'
            ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-300'
            : agg.overall === 'healthy'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-300'
            : 'bg-slate-100 border-slate-200 text-slate-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400';
    return (
        <div
            className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 py-0 text-xs font-bold uppercase leading-none tracking-widest',
                palette,
                className
            )}
            title={`${agg.healthy} healthy / ${agg.warning} warning / ${agg.critical} critical / ${agg.unknown} unknown`}
        >
            <Icon className="h-3 w-3 flex-shrink-0" />
            <span className="leading-none">{label}</span>
        </div>
    );
};
