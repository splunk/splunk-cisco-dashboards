import React, { useEffect, useRef } from 'react';
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
import { useModalFocusTrap } from '@/common/hooks/useModalFocusTrap';

interface ExpandedKPIModalProps {
    kpi: KPIInstance | null;
    onClose: () => void;
}

export const ExpandedKPIModal: React.FC<ExpandedKPIModalProps> = ({
    kpi,
    onClose,
}) => {
    const dialogRef = useRef<HTMLDivElement | null>(null);
    const closeButtonRef = useRef<HTMLButtonElement | null>(null);

    useModalFocusTrap({
        isOpen: Boolean(kpi),
        dialogRef,
        initialFocusRef: closeButtonRef,
        onClose,
    });

    useEffect(() => {
        if (!kpi) return undefined;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [kpi]);

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
            ref={dialogRef}
            className="fixed inset-0 z-[9998] flex items-center justify-center sui-bg-page p-4 backdrop-blur-sm"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
            role="dialog"
            aria-modal="true"
            aria-label={`${kpi.title} expanded view`}
            tabIndex={-1}
        >
            <div className="flex max-h-[92vh] w-[min(920px,96vw)] flex-col overflow-hidden rounded-xl border    shadow-2xl sui-border-default sui-bg-page sui-color-active">
                <header className="flex items-center justify-between border-b  px-7 py-5 sui-border-weak">
                    <div className="flex min-w-0 items-center gap-3">
                        {Icon && <Icon className={cn('h-7 w-7 flex-shrink-0', tone.text)} />}
                        <div className="min-w-0">
                            <h2 className="truncate text-2xl font-black tracking-tight">
                                {kpi.title}
                            </h2>
                            <p className="mt-1 text-sm font-semibold  sui-color-default">
                                {kpi.app} / {kpi.category} / {kpi.subCategory}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        ref={closeButtonRef}
                        aria-label="Close expanded KPI"
                        title="Close"
                        {...getInteractiveControlProps(() => onClose())}
                        className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg sui-color-muted transition   focus:outline-none focus-visible:ring-2 sui-focus-visible-ring sui-hover-bg-overlay sui-hover-color-active"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </header>

                <div className="overflow-y-auto p-7">
                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="rounded-xl  p-5 sui-bg-section">
                            <p className="text-sm font-semibold  sui-color-default">
                                Current Value
                            </p>
                            <div className="mt-2 flex items-baseline gap-2">
                                <span className="text-4xl font-black tracking-tight">
                                    {kpi.valueLabel ?? kpi.value.toLocaleString()}
                                </span>
                                {kpi.unit && (
                                    <span className="text-sm font-semibold sui-color-muted">
                                        {kpi.unit}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="rounded-xl  p-5 sui-bg-section">
                            <p className="text-sm font-semibold  sui-color-default">
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
                        <div className="rounded-xl  p-5 sui-bg-section">
                            <p className="text-sm font-semibold  sui-color-default">
                                Progress
                            </p>
                            <p className="mt-2 text-4xl font-black tracking-tight">
                                {kpi.progress}%
                            </p>
                            <div className="mt-3 h-2 overflow-hidden rounded-full sui-bg-progress-track">
                                <div
                                    className={cn('h-full rounded-full', tone.progress)}
                                    style={{ width: `${kpi.progress}%` }}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 rounded-xl border p-5 sui-border-notification-info sui-bg-notification-info sui-color-active">
                        <p className="text-sm font-black">Description</p>
                        <p className="mt-2 text-sm leading-6">{kpi.description}</p>
                    </div>

                    <div className="mt-6 rounded-xl  p-5 sui-bg-section">
                        <p className="text-sm font-black  sui-color-active">
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
                                                'sui-border-notification-positive sui-bg-notification-positive sui-color-active',
                                            threshold.label === 'Warning' &&
                                                'sui-border-notification-warning sui-bg-notification-warning sui-color-active',
                                            threshold.label === 'Critical' &&
                                                'sui-border-notification-negative sui-bg-notification-negative sui-color-active'
                                        )}
                                    >
                                        {threshold.label}
                                    </span>
                                    <span className="text-sm font-semibold  sui-color-default">
                                        {threshold.value}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="mt-6 rounded-xl border   p-5 sui-border-weak sui-bg-page">
                        <p className="mb-5 text-base font-black  sui-color-active">
                            Historical Data
                        </p>
                        <div className="h-[310px] sui-color-muted">
                            <KPIChart kpi={kpi} showGrid showAxes />
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        portalTarget
    );
};
