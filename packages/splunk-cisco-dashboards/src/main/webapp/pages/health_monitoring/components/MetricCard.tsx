import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Button from '@splunk/react-ui/Button';
import { motion } from 'motion/react';
import {
    Activity,
    ArrowDownRight,
    ArrowUpRight,
    Building2,
    Cloud,
    Database,
    Gauge,
    HardDrive,
    HelpCircle,
    Lock,
    Maximize2,
    Radio,
    Server,
    Settings2,
    Shield,
    Wifi,
    X,
    Zap,
} from '@/common/icons/SuiIcon';
import {
    Area,
    AreaChart,
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
import { cn } from '@/common/lib/utils';
import { C3_VISUALIZATION_COLORS } from '@/common/theme/c3VisualizationPalette';
import type {
    KPIChartType,
    KPIIconName,
    KPIInstance,
    KPIThresholdDirection,
    KPIThresholds,
} from '@/data/kpi-templates';

export type KPIStatus = 'healthy' | 'warning' | 'critical';

interface MetricCardProps {
    kpi: KPIInstance;
    onConfigure: (kpi: KPIInstance) => void;
    onExpand: (kpi: KPIInstance) => void;
    onRemove: (kpi: KPIInstance) => void;
}

export const iconRegistry: Record<
    KPIIconName,
    React.ComponentType<{ className?: string }>
> = {
    activity: Activity,
    database: Database,
    wifi: Wifi,
    server: Server,
    shield: Shield,
    lock: Lock,
    zap: Zap,
    'hard-drive': HardDrive,
    radio: Radio,
    cloud: Cloud,
    building: Building2,
    gauge: Gauge,
};

export const iconOptions: Array<{ value: KPIIconName; label: string }> = [
    { value: 'activity', label: 'Activity' },
    { value: 'database', label: 'Database' },
    { value: 'wifi', label: 'Wi-Fi' },
    { value: 'server', label: 'Server' },
    { value: 'shield', label: 'Shield' },
    { value: 'lock', label: 'Lock' },
    { value: 'zap', label: 'Power' },
    { value: 'hard-drive', label: 'Storage' },
    { value: 'radio', label: 'Radio' },
    { value: 'cloud', label: 'Cloud' },
    { value: 'building', label: 'Building' },
    { value: 'gauge', label: 'Gauge' },
];

const stopDragProps = {
    draggable: false,
    onMouseDown: (event: React.MouseEvent) => event.stopPropagation(),
    onPointerDown: (event: React.PointerEvent) => event.stopPropagation(),
    onDragStart: (event: React.DragEvent) => {
        event.preventDefault();
        event.stopPropagation();
    },
};

export const getInteractiveControlProps = (
    onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void
) => ({
    ...stopDragProps,
    onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        onClick?.(event);
    },
});

export const computeKPIStatus = (
    value: number,
    thresholds: KPIThresholds
): KPIStatus => {
    if (thresholds.direction === 'higher-is-better') {
        if (value >= thresholds.healthy) return 'healthy';
        if (value >= thresholds.warning) return 'warning';
        return 'critical';
    }
    if (value <= thresholds.healthy) return 'healthy';
    if (value <= thresholds.warning) return 'warning';
    return 'critical';
};

const getStatusBasis = (kpi: KPIInstance): number => {
    const maxThreshold = Math.max(
        kpi.thresholds.healthy,
        kpi.thresholds.warning,
        kpi.thresholds.critical
    );
    const usesPercentBands =
        maxThreshold <= 100 &&
        kpi.progress >= 0 &&
        kpi.progress <= 100 &&
        (Boolean(kpi.valueLabel) || Math.abs(kpi.value) > 100 || Math.abs(kpi.value) <= 10);
    return usesPercentBands ? kpi.progress : kpi.value;
};

const statusTone: Record<
    KPIStatus,
    { text: string; progress: string; soft: string; border: string }
> = {
    healthy: {
        text: 'sui-color-positive',
        progress: 'sui-bg-status-positive',
        soft: 'sui-bg-notification-positive',
        border: 'sui-border-notification-positive',
    },
    warning: {
        text: 'sui-color-warning',
        progress: 'sui-bg-status-warning',
        soft: 'sui-bg-notification-warning',
        border: 'sui-border-notification-warning',
    },
    critical: {
        text: 'sui-color-negative',
        progress: 'sui-bg-status-negative',
        soft: 'sui-bg-notification-negative',
        border: 'sui-border-notification-negative',
    },
};

const compactNumber = (value: number): string => {
    const abs = Math.abs(value);
    if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}m`;
    if (abs >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
    return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '');
};

const formatThreshold = (
    label: 'Healthy' | 'Warning' | 'Critical',
    thresholds: KPIThresholds,
    unit?: string
): string => {
    const suffix = unit ?? '';
    if (thresholds.direction === 'higher-is-better') {
        if (label === 'Healthy') return `>= ${thresholds.healthy}${suffix}`;
        if (label === 'Warning') {
            return `${thresholds.warning}${suffix}-${thresholds.healthy}${suffix}`;
        }
        return `< ${thresholds.warning}${suffix}`;
    }
    if (label === 'Healthy') return `<= ${thresholds.healthy}${suffix}`;
    if (label === 'Warning') {
        return `${thresholds.healthy}${suffix}-${thresholds.warning}${suffix}`;
    }
    return `> ${thresholds.warning}${suffix}`;
};

const chartColor = (kpi: KPIInstance, status: KPIStatus): string => {
    if (status === 'critical') return C3_VISUALIZATION_COLORS.critical;
    if (status === 'warning') return C3_VISUALIZATION_COLORS.caution;
    return kpi.color;
};

interface KPIChartProps {
    kpi: KPIInstance;
    height?: number | string;
    showGrid?: boolean;
    showAxes?: boolean;
}

export const KPIChart: React.FC<KPIChartProps> = ({
    kpi,
    height = '100%',
    showGrid = false,
    showAxes = false,
}) => {
    const status = computeKPIStatus(getStatusBasis(kpi), kpi.thresholds);
    const color = chartColor(kpi, status);
    const data = useMemo(
        () =>
            kpi.series.map((value, index) => ({
                name: `${index + 1}`,
                value,
            })),
        [kpi.series]
    );

    if (kpi.chartType === 'bar') {
        return (
            <div style={{ height }} className="w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} layout="vertical" margin={{ top: 8, right: 6, bottom: 6, left: 0 }}>
                        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.12} />}
                        <XAxis type="number" hide={!showAxes} stroke="currentColor" />
                        <YAxis type="category" dataKey="name" hide />
                        <Tooltip cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }} />
                        <Bar dataKey="value" fill={color} fillOpacity={0.84} radius={[0, 6, 6, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        );
    }

    if (kpi.chartType === 'column') {
        return (
            <div style={{ height }} className="w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} margin={{ top: 8, right: 6, bottom: 6, left: 6 }}>
                        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.12} />}
                        <XAxis dataKey="name" hide={!showAxes} stroke="currentColor" />
                        <YAxis hide={!showAxes} stroke="currentColor" domain={[0, 'dataMax']} />
                        <Tooltip cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }} />
                        <Bar dataKey="value" fill={color} fillOpacity={0.88} radius={[5, 5, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        );
    }

    if (kpi.chartType === 'line' || kpi.chartType === 'sparkline') {
        return (
            <div style={{ height }} className="w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data} margin={{ top: 10, right: 6, bottom: 6, left: 6 }}>
                        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.12} />}
                        <XAxis dataKey="name" hide={!showAxes} stroke="currentColor" />
                        <YAxis hide={!showAxes} stroke="currentColor" domain={[0, 'dataMax']} />
                        <Tooltip cursor={{ stroke: color, strokeOpacity: 0.18 }} />
                        <Line
                            type="monotone"
                            dataKey="value"
                            stroke={color}
                            strokeWidth={kpi.chartType === 'sparkline' ? 2 : 3}
                            dot={showAxes}
                            activeDot={{ r: 4 }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        );
    }

    return (
        <div style={{ height }} className="w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 10, right: 6, bottom: 6, left: 6 }}>
                    {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.12} />}
                    <XAxis dataKey="name" hide={!showAxes} stroke="currentColor" />
                    <YAxis hide={!showAxes} stroke="currentColor" domain={[0, 'dataMax']} />
                    <Tooltip cursor={{ stroke: color, strokeOpacity: 0.18 }} />
                    <Area
                        type="monotone"
                        dataKey="value"
                        stroke={color}
                        strokeWidth={2.5}
                        fill={color}
                        fillOpacity={0.18}
                        activeDot={{ r: 4 }}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
};

interface HelpTooltipProps {
    kpi: KPIInstance;
}

const HelpTooltip: React.FC<HelpTooltipProps> = ({ kpi }) => {
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const tooltipRef = useRef<HTMLDivElement | null>(null);
    const [open, setOpen] = useState(false);
    const [coords, setCoords] = useState<{ left: number; top: number } | null>(null);
    const status = computeKPIStatus(getStatusBasis(kpi), kpi.thresholds);

    useLayoutEffect(() => {
        if (!open || !triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        const width = 320;
        const height = tooltipRef.current?.getBoundingClientRect().height ?? 0;
        const left = Math.max(8, Math.min(rect.left - width / 2 + rect.width / 2, window.innerWidth - width - 8));
        let top = rect.bottom + 8;
        if (height > 0 && top + height > window.innerHeight - 8) {
            top = Math.max(8, rect.top - height - 8);
        }
        setCoords({ left, top });
    }, [open, kpi.description, kpi.thresholds]);

    useLayoutEffect(() => {
        if (!open) return undefined;
        const reposition = () => {
            if (!triggerRef.current) return;
            const rect = triggerRef.current.getBoundingClientRect();
            const width = 320;
            setCoords({
                left: Math.max(8, Math.min(rect.left - width / 2 + rect.width / 2, window.innerWidth - width - 8)),
                top: rect.bottom + 8,
            });
        };
        window.addEventListener('resize', reposition);
        window.addEventListener('scroll', reposition, true);
        return () => {
            window.removeEventListener('resize', reposition);
            window.removeEventListener('scroll', reposition, true);
        };
    }, [open]);

    const portalTarget =
        typeof document === 'undefined'
            ? null
            : document.getElementById('scan-root') ?? document.body;

    const tooltip =
        open && portalTarget
            ? createPortal(
                  <div
                      ref={tooltipRef}
                      role="tooltip"
                      style={{
                          position: 'fixed',
                          left: coords?.left ?? -9999,
                          top: coords?.top ?? -9999,
                          width: 320,
                          visibility: coords ? 'visible' : 'hidden',
                      }}
                      className="z-[9999] rounded-xl sui-bg-section p-4 text-left sui-color-active shadow-2xl ring-1 sui-focus-ring"
                  >
                      <div className="mb-2 flex items-center gap-2">
                          <span className="h-3 w-1 rounded-full sui-bg-accent" />
                          <span className="sui-color-default font-black uppercase tracking-widest sui-color-active">
                              {kpi.title}
                          </span>
                      </div>
                      <p className="sui-color-default leading-5 sui-color-default">{kpi.description}</p>
                      <div className="mt-3">
                          <p className="text-xs font-black uppercase tracking-[0.22em] sui-color-info">
                              Thresholds
                          </p>
                          {(['Healthy', 'Warning', 'Critical'] as const).map((label) => (
                              <div key={label} className="mt-2 flex items-center justify-between gap-3">
                                  <span className="sui-color-default">{label}</span>
                                  <span
                                      className={cn(
                                          'rounded-full px-2 py-0.5 text-xs font-bold',
                                          label === 'Healthy' && 'sui-bg-notification-positive sui-color-active',
                                          label === 'Warning' && 'sui-bg-notification-warning sui-color-active',
                                          label === 'Critical' && 'sui-bg-notification-negative sui-color-active'
                                      )}
                                  >
                                      {formatThreshold(label, kpi.thresholds, kpi.unit)}
                                  </span>
                              </div>
                          ))}
                      </div>
                      <div className="mt-3 border-t sui-border-default pt-2 text-xs uppercase tracking-widest sui-color-default">
                          Current status: <span className={statusTone[status].text}>{status}</span>
                      </div>
                  </div>,
                  portalTarget
              )
            : null;

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                aria-label={`What does ${kpi.title} measure?`}
                title={`What does ${kpi.title} measure?`}
                onMouseEnter={() => setOpen(true)}
                onMouseLeave={() => setOpen(false)}
                onFocus={() => setOpen(true)}
                onBlur={() => setOpen(false)}
                {...getInteractiveControlProps()}
                className="inline-flex h-5 w-5 items-center justify-center rounded-full sui-color-info transition sui-hover-bg-accent sui-hover-color-info focus:outline-none focus-visible:ring-2 sui-focus-visible-ring"
            >
                <HelpCircle className="h-4 w-4" />
            </button>
            {tooltip}
        </>
    );
};

export const MetricCard: React.FC<MetricCardProps> = ({
    kpi,
    onConfigure,
    onExpand,
    onRemove,
}) => {
    const status = computeKPIStatus(getStatusBasis(kpi), kpi.thresholds);
    const tone = statusTone[status];
    const Icon = iconRegistry[kpi.icon] ?? Activity;
    const displayValue = kpi.display.hideAbsoluteLabel
        ? ''
        : kpi.valueLabel ?? compactNumber(kpi.value);
    const showUnit = Boolean(kpi.unit && !kpi.valueLabel);
    const showSubtitle =
        Boolean(kpi.subtitle && !kpi.display.hideAbsoluteLabel) &&
        (!showUnit || kpi.subtitle !== kpi.unit);

    return (
        <motion.div
            layout
            data-kpi-instance={kpi.instanceId}
            className={cn(
                'group relative flex h-[284px] min-w-0 flex-col rounded-xl border p-5',
                'sui-bg-section sui-color-active sui-shadow-overlay backdrop-blur-xl',
                'sui-border-weak sui-hover-border-info sui-shadow-overlay',
                'sui-bg-section sui-color-active sui-border-default sui-hover-border-info'
            )}
        >
            <button
                type="button"
                aria-label={`Configure ${kpi.title}`}
                title={`Configure ${kpi.title}`}
                {...getInteractiveControlProps(() => onConfigure(kpi))}
                className="absolute left-3 top-3 z-10 inline-flex h-7 w-7 items-center justify-center rounded-lg border    opacity-0 shadow-sm transition sui-hover-color-info group-hover:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 sui-focus-visible-ring sui-border-default sui-bg-section sui-color-default"
            >
                <Settings2 className="h-3.5 w-3.5" />
            </button>
            <Button
                appearance="destructive"
                {...stopDragProps}
                className="absolute -right-2 -top-2 z-20 opacity-0 shadow-lg transition group-hover:opacity-100 focus:opacity-100"
                hideLabel
                icon={<X className="h-4 w-4" />}
                label={`Remove ${kpi.title}`}
                onClick={(event) => {
                    event.stopPropagation();
                    onRemove(kpi);
                }}
            />

            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                    <Icon className={cn('h-5 w-5', tone.text)} />
                    <HelpTooltip kpi={kpi} />
                </div>
                <div className="flex items-center gap-3">
                    {!kpi.display.hideDelta && (
                        <span className={cn('inline-flex items-center gap-1 sui-color-default font-black', tone.text)}>
                            {kpi.trend >= 0 ? (
                                <ArrowUpRight className="h-3 w-3" />
                            ) : (
                                <ArrowDownRight className="h-3 w-3" />
                            )}
                            {Math.abs(kpi.trend)}%
                        </span>
                    )}
                    <button
                        type="button"
                        aria-label={`Expand ${kpi.title}`}
                        title={`Expand ${kpi.title}`}
                        {...getInteractiveControlProps(() => onExpand(kpi))}
                        className="inline-flex h-6 w-6 items-center justify-center rounded sui-color-default transition  sui-hover-color-info focus:outline-none focus-visible:ring-2 sui-focus-visible-ring sui-hover-bg-overlay"
                    >
                        <Maximize2 className="h-4 w-4" />
                    </button>
                </div>
            </div>

            <h3 className="mt-4 min-h-[34px]  font-black leading-tight  sui-color-active">
                {kpi.title}
            </h3>

            <div className="mt-5 flex items-baseline gap-2">
                {displayValue ? (
                    <span className="sui-color-default font-black leading-none tracking-tight  sui-color-active">
                        {displayValue}
                    </span>
                ) : (
                    <span className="sui-color-default font-black leading-none sui-color-default">—</span>
                )}
                {showUnit && !kpi.display.hideAbsoluteLabel && (
                    <span className="text-sm font-semibold  sui-color-default">
                        {kpi.unit}
                    </span>
                )}
                {showSubtitle && (
                    <span className="text-sm font-semibold  sui-color-default">
                        {kpi.subtitle}
                    </span>
                )}
            </div>

            <div className="mt-4">
                <div className="mb-1.5 flex items-center justify-between  font-medium  sui-color-default">
                    <span>Progress</span>
                    <span>{kpi.progress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full sui-bg-progress-track">
                    <div
                        className={cn('h-full rounded-full', tone.progress)}
                        style={{ width: `${Math.max(0, Math.min(kpi.progress, 100))}%` }}
                    />
                </div>
            </div>

            <div className={cn('mt-4 h-[64px] flex-shrink-0 overflow-hidden rounded-lg', tone.soft)}>
                <KPIChart kpi={kpi} />
            </div>
        </motion.div>
    );
};

export const getThresholdSummary = (kpi: KPIInstance): Array<{
    label: 'Healthy' | 'Warning' | 'Critical';
    value: string;
}> =>
    (['Healthy', 'Warning', 'Critical'] as const).map((label) => ({
        label,
        value: formatThreshold(label, kpi.thresholds, kpi.unit),
    }));

export const getStatusTone = (status: KPIStatus) => statusTone[status];
