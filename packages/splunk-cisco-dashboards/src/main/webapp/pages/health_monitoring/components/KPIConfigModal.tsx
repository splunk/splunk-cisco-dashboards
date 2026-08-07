import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    Activity,
    BarChart3,
    ChartArea,
    ChartColumn,
    ChartLine,
    Eye,
    Gauge,
    RotateCcw,
    Settings2,
    X,
} from '@/common/icons/SuiIcon';
import { cn } from '@/common/lib/utils';
import type {
    KPIChartType,
    KPIIconName,
    KPIInstance,
    KPIThresholdDirection,
    KPITemplate,
} from '@/data/kpi-templates';
import { getInteractiveControlProps, iconOptions, iconRegistry } from './MetricCard';

interface KPIConfigModalProps {
    kpi: KPIInstance | null;
    template?: KPITemplate;
    onClose: () => void;
    onApply: (next: KPIInstance) => void;
    onFactoryReset: (kpi: KPIInstance) => void;
}

const chartOptions: Array<{
    value: KPIChartType;
    label: string;
    Icon: React.ComponentType<{ className?: string }>;
}> = [
    { value: 'sparkline', label: 'Sparkline', Icon: Activity },
    { value: 'area', label: 'Area', Icon: ChartArea },
    { value: 'line', label: 'Line', Icon: ChartLine },
    { value: 'column', label: 'Column', Icon: ChartColumn },
    { value: 'bar', label: 'Bar', Icon: BarChart3 },
];

const directionOptions: Array<{
    value: KPIThresholdDirection;
    label: string;
}> = [
    { value: 'higher-is-better', label: 'Higher is better' },
    { value: 'lower-is-better', label: 'Lower is better' },
];

export const KPIConfigModal: React.FC<KPIConfigModalProps> = ({
    kpi,
    template,
    onClose,
    onApply,
    onFactoryReset,
}) => {
    const [draft, setDraft] = useState<KPIInstance | null>(kpi);

    useEffect(() => {
        setDraft(kpi);
    }, [kpi]);

    useEffect(() => {
        if (!kpi) return undefined;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [kpi, onClose]);

    const IconPreview = useMemo(() => {
        if (!draft) return Gauge;
        return iconRegistry[draft.icon] ?? Gauge;
    }, [draft]);

    if (!kpi || !draft || typeof document === 'undefined') return null;

    const portalTarget = document.getElementById('scan-root') ?? document.body;

    const updateDraft = (patch: Partial<KPIInstance>) => {
        setDraft((current) => (current ? { ...current, ...patch } : current));
    };

    const updateThreshold = (
        key: 'healthy' | 'warning' | 'critical',
        value: string
    ) => {
        const parsed = Number(value);
        setDraft((current) =>
            current
                ? {
                      ...current,
                      thresholds: {
                          ...current.thresholds,
                          [key]: Number.isFinite(parsed) ? parsed : 0,
                      },
                  }
                : current
        );
    };

    return createPortal(
        <div
            className="fixed inset-0 z-[9997] flex items-center justify-center overflow-hidden bg-slate-950/55 p-3 backdrop-blur-sm sm:p-5"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
            role="dialog"
            aria-modal="true"
            aria-label={`Configure ${kpi.title}`}
        >
            <div className="flex max-h-[92vh] w-[min(500px,96vw)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-950 shadow-2xl dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                <header className="flex flex-shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                    <div>
                        <h2 className="text-lg font-black tracking-tight">Edit KPI</h2>
                        <p className="mt-1 max-w-[390px] text-xs leading-5 text-slate-500 dark:text-slate-400">
                            Configure the KPI tile settings, chart style, display options, and thresholds.
                        </p>
                    </div>
                    <button
                        type="button"
                        aria-label="Close KPI editor"
                        {...getInteractiveControlProps(() => onClose())}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 dark:hover:bg-slate-800 dark:hover:text-white"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </header>

                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                    <section>
                        <div className="mb-3 flex items-center gap-2">
                            <Settings2 className="h-4 w-4 text-blue-600" />
                            <h3 className="text-xs font-black uppercase tracking-wide">
                                Basic Information
                            </h3>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <label className="block">
                                <span className="text-xs font-semibold">Title</span>
                                <input
                                    value={draft.title}
                                    onChange={(event) => updateDraft({ title: event.target.value })}
                                    className="mt-1.5 h-9 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 text-sm font-semibold outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 dark:border-slate-700 dark:bg-slate-900"
                                />
                            </label>
                            <label className="block">
                                <span className="text-xs font-semibold">Icon</span>
                                <div className="mt-1.5 flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-3 dark:border-slate-700 dark:bg-slate-900">
                                    <IconPreview className="h-4 w-4 text-slate-500" />
                                    <select
                                        value={draft.icon}
                                        onChange={(event) =>
                                            updateDraft({ icon: event.target.value as KPIIconName })
                                        }
                                        className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"
                                    >
                                        {iconOptions.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </label>
                            <label className="block">
                                <span className="text-xs font-semibold">Value</span>
                                <input
                                    type="number"
                                    value={draft.value}
                                    onChange={(event) =>
                                        updateDraft({ value: Number(event.target.value) })
                                    }
                                    className="mt-1.5 h-9 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 text-sm font-semibold outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 dark:border-slate-700 dark:bg-slate-900"
                                />
                            </label>
                            <label className="block">
                                <span className="text-xs font-semibold">Subtitle (optional)</span>
                                <input
                                    value={draft.subtitle ?? ''}
                                    onChange={(event) => updateDraft({ subtitle: event.target.value })}
                                    className="mt-1.5 h-9 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 text-sm font-semibold outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 dark:border-slate-700 dark:bg-slate-900"
                                />
                            </label>
                            <label className="block sm:col-span-2">
                                <span className="text-xs font-semibold">Description (for tooltip)</span>
                                <input
                                    value={draft.description}
                                    onChange={(event) =>
                                        updateDraft({ description: event.target.value })
                                    }
                                    className="mt-1.5 h-9 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 text-sm font-semibold outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 dark:border-slate-700 dark:bg-slate-900"
                                />
                            </label>
                            <label className="block">
                                <span className="text-xs font-semibold">Progress %</span>
                                <input
                                    type="number"
                                    value={draft.progress}
                                    onChange={(event) =>
                                        updateDraft({ progress: Number(event.target.value) })
                                    }
                                    className="mt-1.5 h-9 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 text-sm font-semibold outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 dark:border-slate-700 dark:bg-slate-900"
                                />
                            </label>
                            <label className="block">
                                <span className="text-xs font-semibold">Trend %</span>
                                <input
                                    type="number"
                                    value={draft.trend}
                                    onChange={(event) =>
                                        updateDraft({ trend: Number(event.target.value) })
                                    }
                                    className="mt-1.5 h-9 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 text-sm font-semibold outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 dark:border-slate-700 dark:bg-slate-900"
                                />
                            </label>
                        </div>
                    </section>

                    <section className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-800">
                        <div className="mb-3 flex items-center gap-2">
                            <ChartLine className="h-4 w-4 text-blue-600" />
                            <h3 className="text-xs font-black uppercase tracking-wide">
                                Chart Style
                            </h3>
                        </div>
                        <div className="grid grid-cols-5 gap-2">
                            {chartOptions.map(({ value, label, Icon }) => {
                                const active = draft.chartType === value;
                                return (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => updateDraft({ chartType: value })}
                                        className={cn(
                                            'flex h-12 flex-col items-center justify-center gap-0.5 rounded-lg border text-xs font-black uppercase transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400',
                                            active
                                                ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                                                : 'border-slate-200 text-slate-600 hover:border-sky-300 dark:border-slate-700 dark:text-slate-300'
                                        )}
                                    >
                                        <Icon className="h-4 w-4" />
                                        {label}
                                    </button>
                                );
                            })}
                        </div>
                    </section>

                    <section className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-800">
                        <div className="mb-3 flex items-center gap-2">
                            <Eye className="h-4 w-4 text-blue-600" />
                            <h3 className="text-xs font-black uppercase tracking-wide">Display</h3>
                        </div>
                        {[
                            {
                                key: 'hidePeakLabels',
                                label: 'Hide peak labels',
                                body: 'Peak labels are displayed on sparkline and trend charts when a data point significantly deviates from the average.',
                            },
                            {
                                key: 'hideDelta',
                                label: 'Hide delta vs previous',
                                body: 'Hides the trend percentage chip that shows how this KPI changed.',
                            },
                            {
                                key: 'hideAbsoluteLabel',
                                label: 'Hide absolute number label for chart and band',
                                body: 'Reduces displayed text by hiding the absolute value label in the card headline.',
                            },
                        ].map((option) => (
                            <label key={option.key} className="mb-3 flex items-start gap-3">
                                <input
                                    type="checkbox"
                                    checked={
                                        draft.display[
                                            option.key as keyof typeof draft.display
                                        ]
                                    }
                                    onChange={(event) =>
                                        setDraft((current) =>
                                            current
                                                ? {
                                                      ...current,
                                                      display: {
                                                          ...current.display,
                                                          [option.key]: event.target.checked,
                                                      },
                                                  }
                                                : current
                                        )
                                    }
                                    className="mt-0.5 h-3.5 w-3.5"
                                />
                                <span>
                                    <span className="block text-xs font-semibold">{option.label}</span>
                                    <span className="mt-0.5 block text-xs leading-4 text-slate-500 dark:text-slate-400">
                                        {option.body}
                                    </span>
                                </span>
                            </label>
                        ))}
                    </section>

                    <section className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-800">
                        <div className="mb-3 flex items-center gap-2">
                            <Gauge className="h-4 w-4 text-blue-600" />
                            <h3 className="text-xs font-black uppercase tracking-wide">
                                Thresholds
                            </h3>
                        </div>
                        <p className="mb-3 text-xs leading-4 text-slate-500 dark:text-slate-400">
                            Set the healthy, warning, and critical bands used to colour the headline value and status icon.
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                            {directionOptions.map((option) => (
                                <button
                                    type="button"
                                    key={option.value}
                                    onClick={() =>
                                        setDraft((current) =>
                                            current
                                                ? {
                                                      ...current,
                                                      thresholds: {
                                                          ...current.thresholds,
                                                          direction: option.value,
                                                      },
                                                  }
                                                : current
                                        )
                                    }
                                    className={cn(
                                        'h-9 rounded-lg border text-xs font-black uppercase transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400',
                                        draft.thresholds.direction === option.value
                                            ? 'border-slate-950 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950'
                                            : 'border-slate-200 bg-white text-slate-900 hover:border-sky-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100'
                                    )}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                        <div className="mt-4 grid gap-4 sm:grid-cols-3">
                            {(['healthy', 'warning', 'critical'] as const).map((key) => (
                                <label key={key} className="block">
                                    <span className="text-xs font-black uppercase tracking-wider">
                                        {key}
                                    </span>
                                    <input
                                        type="number"
                                        value={draft.thresholds[key]}
                                        onChange={(event) =>
                                            updateThreshold(key, event.target.value)
                                        }
                                        className="mt-1.5 h-9 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 text-sm font-semibold outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 dark:border-slate-700 dark:bg-slate-900"
                                    />
                                </label>
                            ))}
                        </div>
                    </section>
                </div>

                <footer className="flex flex-shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-white px-5 py-3 dark:border-slate-800 dark:bg-slate-950">
                    <button
                        type="button"
                        onClick={() => {
                            if (template) {
                                setDraft({
                                    ...draft,
                                    ...template,
                                    instanceId: draft.instanceId,
                                    templateId: draft.templateId,
                                    sectionId: draft.sectionId,
                                    display: { ...template.display },
                                    thresholds: { ...template.thresholds },
                                    series: [...template.series],
                                    tags: [...template.tags],
                                });
                            }
                        }}
                        className="mr-auto inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-black uppercase text-slate-800 transition hover:border-sky-300 hover:text-sky-700 dark:border-slate-700 dark:text-slate-100"
                    >
                        <RotateCcw className="h-4 w-4" />
                        Reset Tile
                    </button>
                    <button
                        type="button"
                        onClick={() => onFactoryReset(kpi)}
                        className="h-9 rounded-lg bg-rose-600 px-3 text-xs font-black uppercase text-white transition hover:bg-rose-500"
                    >
                        Factory Reset
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-black uppercase transition hover:border-sky-300 dark:border-slate-700"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={() => onApply(draft)}
                        className="h-9 rounded-lg bg-slate-950 px-3 text-xs font-black uppercase text-white transition hover:bg-sky-700 dark:bg-white dark:text-slate-950 dark:hover:bg-sky-200"
                    >
                        Apply
                    </button>
                </footer>
            </div>
        </div>,
        portalTarget
    );
};
