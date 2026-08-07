import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDownRight, ArrowUpRight, X } from '@/common/icons/SuiIcon';
import { cn } from '@/common/lib/utils';
import type { KPIInstance } from '@/data/kpi-templates';
import {
    computeKPIStatus,
    getInteractiveControlProps,
    getStatusTone,
    getThresholdSummary,
    iconRegistry,
    KPIChart,
} from './MetricCard';

interface ExpandedKPIModalProps {
    kpi: KPIInstance | null;
    onClose: () => void;
}

export const ExpandedKPIModal: React.FC<ExpandedKPIModalProps> = ({
    kpi,
    onClose,
}) => {
    useEffect(() => {
        if (!kpi) return undefined;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [kpi, onClose]);

    if (!kpi || typeof document === 'undefined') return null;

    const portalTarget = document.getElementById('scan-root') ?? document.body;
    const Icon = iconRegistry[kpi.icon];
    const statusValue =
        Math.max(
            kpi.thresholds.healthy,
            kpi.thresholds.warning,
            kpi.thresholds.critical
        ) <= 100 &&
        kpi.progress >= 0 &&
        kpi.progress <= 100 &&
        (Boolean(kpi.valueLabel) || Math.abs(kpi.value) > 100 || Math.abs(kpi.value) <= 10)
            ? kpi.progress
            : kpi.value;
    const status = computeKPIStatus(statusValue, kpi.thresholds);
    const tone = getStatusTone(status);
    const thresholds = getThresholdSummary(kpi);

    return createPortal(
        <div
            className="fixed inset-0 z-[9998] flex items-center justify-center bg-slate-950/58 p-4 backdrop-blur-sm"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
            role="dialog"
            aria-modal="true"
            aria-label={`${kpi.title} expanded view`}
        >
            <div className="flex max-h-[92vh] w-[min(920px,96vw)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-2xl dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                <header className="flex items-center justify-between border-b border-slate-200 px-7 py-5 dark:border-slate-800">
                    <div className="flex min-w-0 items-center gap-3">
                        {Icon && <Icon className={cn('h-7 w-7 flex-shrink-0', tone.text)} />}
                        <div className="min-w-0">
                            <h2 className="truncate text-2xl font-black tracking-tight">
                                {kpi.title}
                            </h2>
                            <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
                                {kpi.app} / {kpi.category} / {kpi.subCategory}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        aria-label="Close expanded KPI"
                        title="Close"
                        {...getInteractiveControlProps(() => onClose())}
                        className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 dark:hover:bg-slate-800 dark:hover:text-white"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </header>

                <div className="overflow-y-auto p-7">
                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="rounded-xl bg-slate-50 p-5 dark:bg-slate-900/80">
                            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                                Current Value
                            </p>
                            <div className="mt-2 flex items-baseline gap-2">
                                <span className="text-4xl font-black tracking-tight">
                                    {kpi.valueLabel ?? kpi.value.toLocaleString()}
                                </span>
                                {kpi.unit && (
                                    <span className="text-sm font-semibold text-slate-500">
                                        {kpi.unit}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-5 dark:bg-slate-900/80">
                            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                                Trend
                            </p>
                            <p className={cn('mt-3 inline-flex items-center gap-1 text-2xl font-black', tone.text)}>
                                {kpi.trend >= 0 ? (
                                    <ArrowUpRight className="h-6 w-6" />
                                ) : (
                                    <ArrowDownRight className="h-6 w-6" />
                                )}
                                {Math.abs(kpi.trend)}%
                            </p>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-5 dark:bg-slate-900/80">
                            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                                Progress
                            </p>
                            <p className="mt-2 text-4xl font-black tracking-tight">
                                {kpi.progress}%
                            </p>
                            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                                <div
                                    className={cn('h-full rounded-full', tone.progress)}
                                    style={{ width: `${kpi.progress}%` }}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 rounded-xl border border-sky-200 bg-sky-50/80 p-5 text-sky-950 dark:border-sky-800/80 dark:bg-sky-950/35 dark:text-sky-100">
                        <p className="text-sm font-black">Description</p>
                        <p className="mt-2 text-sm leading-6">{kpi.description}</p>
                    </div>

                    <div className="mt-6 rounded-xl bg-slate-50 p-5 dark:bg-slate-900/70">
                        <p className="text-sm font-black text-slate-700 dark:text-slate-200">
                            Thresholds
                        </p>
                        <div className="mt-5 grid gap-4 sm:grid-cols-3">
                            {thresholds.map((threshold) => (
                                <div
                                    key={threshold.label}
                                    className="flex flex-col items-center justify-center gap-2 text-center"
                                >
                                    <span
                                        className={cn(
                                            'rounded-full border px-3 py-1 text-xs font-semibold',
                                            threshold.label === 'Healthy' &&
                                                'border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/35 dark:text-emerald-300',
                                            threshold.label === 'Warning' &&
                                                'border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-700 dark:bg-amber-900/35 dark:text-amber-300',
                                            threshold.label === 'Critical' &&
                                                'border-red-300 bg-red-100 text-red-700 dark:border-red-700 dark:bg-red-900/35 dark:text-red-300'
                                        )}
                                    >
                                        {threshold.label}
                                    </span>
                                    <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                                        {threshold.value}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
                        <p className="mb-5 text-base font-black text-slate-900 dark:text-white">
                            Historical Data
                        </p>
                        <div className="h-[310px] text-slate-500">
                            <KPIChart kpi={kpi} showGrid showAxes />
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        portalTarget
    );
};
