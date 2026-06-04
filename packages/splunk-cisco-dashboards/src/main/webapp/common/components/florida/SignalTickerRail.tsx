import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ArrowDown,
    ArrowUp,
    ExternalLink,
    GripVertical,
    Plus,
    RotateCcw,
    Search,
    Settings2,
    Sparkles,
    Trash2,
    X,
} from 'lucide-react';
import { cn } from '@/common/lib/utils';
import { openSplunkSearch } from '@/common/lib/splunkSearchUrl';
import {
    plainTextFromHtml,
    type SearchbaseRecord,
} from '@/common/services/searchbaseCatalogue';
import {
    useMetric,
    type MetricConfig,
    type MetricStatus,
    type TimeRange,
} from '@/common/hooks/useMetric';
import {
    makeSignalTickerItemId,
    type SignalTickerConfig,
    type SignalTickerItem,
    type SignalTickerRows,
    type SignalTickerSpeed,
} from '@/common/hooks/usePersistedSignalTicker';

const signalTickerCss = `
@keyframes scd-signal-ticker-scroll {
    from { transform: translate3d(0, 0, 0); }
    to { transform: translate3d(-50%, 0, 0); }
}
.scd-signal-ticker-track {
    width: max-content;
    transform: translate3d(0, 0, 0);
}
.scd-signal-ticker-track--animate {
    animation: scd-signal-ticker-scroll var(--scd-signal-duration, 60s) linear infinite;
}
.scd-signal-ticker-rail:hover .scd-signal-ticker-track--animate,
.scd-signal-ticker-rail:focus-within .scd-signal-ticker-track--animate {
    animation-play-state: paused;
}
@media (prefers-reduced-motion: reduce) {
    .scd-signal-ticker-track--animate {
        animation: none !important;
    }
    .scd-signal-ticker-duplicate {
        display: none !important;
    }
}
`;

const SPEED_SECONDS: Record<SignalTickerSpeed, number> = {
    slow: 86,
    normal: 58,
    fast: 38,
};

const STATUS_ACCENT_CLASS = {
    healthy: 'border-emerald-300/80 dark:border-emerald-400/50',
    warning: 'border-amber-300/90 dark:border-amber-400/60',
    critical: 'border-red-300/90 dark:border-red-400/60',
    unknown: 'border-slate-300/80 dark:border-slate-600/80',
};

const STATUS_DOT_CLASS = {
    healthy: 'bg-emerald-500',
    warning: 'bg-amber-500',
    critical: 'bg-red-500',
    unknown: 'bg-slate-400',
};

const formatTickerNumber = (value: number): string => {
    if (!Number.isFinite(value)) return '--';
    const abs = Math.abs(value);
    const format = (divisor: number, suffix: string) => {
        const n = value / divisor;
        return `${n >= 10 ? n.toFixed(0) : n.toFixed(1)}${suffix}`;
    };
    if (abs >= 1_000_000_000) return format(1_000_000_000, 'B');
    if (abs >= 1_000_000) return format(1_000_000, 'M');
    if (abs >= 100_000) return `${Math.round(value / 1000)}K`;
    if (abs >= 1_000) return format(1_000, 'K');
    if (Number.isInteger(value)) return value.toLocaleString();
    return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
};

const labelForRecord = (
    item: SignalTickerItem,
    record: SearchbaseRecord | undefined
): string => item.label?.trim() || record?.searchName || item.searchName;

const subtitleForRecord = (record: SearchbaseRecord | undefined): string => {
    if (!record) return 'Awaiting searchbase';
    if (record.category && record.subCategory) {
        return `${record.category} / ${record.subCategory}`;
    }
    return record.category || record.subCategory || 'Searchbase KPI';
};

interface SignalTickerTileVisualState {
    label: string;
    subtitle: string;
    valueText: string;
    status: MetricStatus;
    canOpen: boolean;
}

const makePendingVisual = (
    item: SignalTickerItem,
    record: SearchbaseRecord | undefined,
    catalogueLoading: boolean
): SignalTickerTileVisualState => ({
    label: labelForRecord(item, record),
    subtitle: subtitleForRecord(record),
    valueText: catalogueLoading ? 'Loading' : '--',
    status: 'unknown',
    canOpen: Boolean(record?.search),
});

const sameVisualState = (
    a: SignalTickerTileVisualState | undefined,
    b: SignalTickerTileVisualState
): boolean =>
    Boolean(a) &&
    a?.label === b.label &&
    a?.subtitle === b.subtitle &&
    a?.valueText === b.valueText &&
    a?.status === b.status &&
    a?.canOpen === b.canOpen;

interface SignalTickerTileChromeProps {
    visual: SignalTickerTileVisualState;
    onOpen?: () => void;
    duplicate?: boolean;
}

const SignalTickerTileChrome: React.FC<SignalTickerTileChromeProps> = ({
    visual,
    onOpen,
    duplicate = false,
}) => {
    const className = cn(
        'group relative h-[76px] min-w-[235px] max-w-[235px] overflow-hidden rounded-lg border px-4 py-3 text-left shadow-sm transition-all',
        'bg-white/92 hover:bg-white dark:bg-slate-950/88 dark:hover:bg-slate-950',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400',
        !visual.canOpen && 'cursor-default',
        STATUS_ACCENT_CLASS[visual.status]
    );
    const content = (
        <>
            <span
                className={cn(
                    'absolute left-0 top-0 h-full w-1',
                    STATUS_DOT_CLASS[visual.status]
                )}
                aria-hidden="true"
            />
            <span
                className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-sky-300/30"
                aria-hidden="true"
            />
            <span className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                    <span className="block truncate text-[25px] font-black leading-none tracking-normal text-slate-900 dark:text-white">
                        {visual.valueText}
                    </span>
                    <span className="mt-2 block line-clamp-2 text-[10px] font-black uppercase leading-tight tracking-[0.08em] text-slate-600 dark:text-slate-300">
                        {visual.label}
                    </span>
                </span>
                <span className="flex flex-col items-end gap-1">
                    <span
                        className={cn(
                            'mt-0.5 h-2 w-2 rounded-full',
                            STATUS_DOT_CLASS[visual.status]
                        )}
                    />
                    {visual.canOpen && (
                        <ExternalLink className="h-3 w-3 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 dark:text-slate-500" />
                    )}
                </span>
            </span>
            <span className="mt-1 block truncate text-[9px] font-semibold text-slate-400 dark:text-slate-500">
                {visual.subtitle}
            </span>
        </>
    );

    if (duplicate) {
        return (
            <div className={className} aria-hidden="true">
                {content}
            </div>
        );
    }

    return (
        <button
            type="button"
            onClick={visual.canOpen ? onOpen : undefined}
            disabled={!visual.canOpen}
            title={visual.canOpen ? `Open ${visual.label} in Search` : visual.label}
            className={className}
        >
            {content}
        </button>
    );
};

interface SignalTickerTileProps {
    item: SignalTickerItem;
    record?: SearchbaseRecord;
    catalogueLoading: boolean;
    range: TimeRange;
    refreshToken: number;
    index: number;
    onVisualState: (id: string, visual: SignalTickerTileVisualState) => void;
}

const SignalTickerTile: React.FC<SignalTickerTileProps> = ({
    item,
    record,
    catalogueLoading,
    range,
    refreshToken,
    index,
    onVisualState,
}) => {
    const label = labelForRecord(item, record);
    const cfg = useMemo<MetricConfig>(
        () => ({
            id: `signal_ticker_${item.id}`,
            section: 'it_health',
            label,
            subLabel: subtitleForRecord(record),
            description: record
                ? plainTextFromHtml(record.explanation || record.description)
                : undefined,
            spl: record?.search,
            valueField: item.valueField,
            color: '#0ea5e9',
            suppressMockOnEmpty: true,
            mock: {
                seed: 700 + index,
                sparkMin: 0,
                sparkMax: 100,
                value: 0,
                change: 0,
            },
        }),
        [index, item.id, item.valueField, label, record]
    );
    const result = useMetric(cfg, range, refreshToken);
    const loading = catalogueLoading || result.source === 'loading';
    const valueText = loading
        ? 'Loading'
        : result.displayValue ?? formatTickerNumber(result.value);
    const status: MetricStatus = loading ? 'unknown' : result.status;
    const subtitle = subtitleForRecord(record);
    const visual = useMemo<SignalTickerTileVisualState>(
        () => ({
            label,
            subtitle,
            valueText,
            status,
            canOpen: Boolean(record?.search),
        }),
        [label, record?.search, status, subtitle, valueText]
    );

    useEffect(() => {
        onVisualState(item.id, visual);
    }, [item.id, onVisualState, visual]);

    return (
        <SignalTickerTileChrome
            visual={visual}
            onOpen={() => {
                if (record?.search) openSplunkSearch(record.search, range);
            }}
        />
    );
};

interface SignalTickerRailProps {
    config: SignalTickerConfig;
    catalogueByName: Map<string, SearchbaseRecord> | null;
    range: TimeRange;
    refreshToken: number;
    onOpenEditor: () => void;
}

export const SignalTickerRail: React.FC<SignalTickerRailProps> = ({
    config,
    catalogueByName,
    range,
    refreshToken,
    onOpenEditor,
}) => {
    const [visualById, setVisualById] = useState<
        Record<string, SignalTickerTileVisualState>
    >({});
    const handleVisualState = useCallback(
        (id: string, visual: SignalTickerTileVisualState) => {
            setVisualById((current) => {
                if (sameVisualState(current[id], visual)) return current;
                return { ...current, [id]: visual };
            });
        },
        []
    );
    const rows = useMemo(() => {
        const items = config.items;
        if (config.rows === 2 && items.length > 3) {
            return [
                items.filter((_, idx) => idx % 2 === 0),
                items.filter((_, idx) => idx % 2 === 1),
            ].filter((row) => row.length > 0);
        }
        return [items];
    }, [config.items, config.rows]);

    if (!config.enabled || config.items.length === 0) return null;

    const baseDuration = SPEED_SECONDS[config.speed];

    return (
        <section className="scd-signal-ticker-rail flex-shrink-0 border-b border-slate-200 bg-slate-50/95 px-1.5 py-1.5 dark:border-slate-800 dark:bg-slate-950/95">
            <style>{signalTickerCss}</style>
            <div className="flex items-center gap-2">
                <div className="hidden shrink-0 items-center gap-2 rounded-lg border border-sky-200 bg-white px-3 py-2 shadow-sm dark:border-sky-900/70 dark:bg-slate-900 lg:flex">
                    <Sparkles className="h-4 w-4 text-sky-500" />
                    <div className="leading-tight">
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-sky-700 dark:text-sky-300">
                            Signal Rail
                        </p>
                        <p className="text-[9px] font-semibold text-slate-400 dark:text-slate-500">
                            {config.items.length} live KPIs
                        </p>
                    </div>
                </div>
                <div className="min-w-0 flex-1 space-y-1 overflow-hidden">
                    {rows.map((rowItems, rowIndex) => {
                        const animate = rowItems.length > 1;
                        const duration =
                            baseDuration + rowItems.length * 3 + rowIndex * 9;
                        return (
                            <div
                                key={`ticker-row-${rowIndex}`}
                                className="overflow-hidden"
                            >
                                <div
                                    className={cn(
                                        'scd-signal-ticker-track flex gap-2',
                                        animate &&
                                            'scd-signal-ticker-track--animate'
                                    )}
                                    style={
                                        {
                                            '--scd-signal-duration': `${duration}s`,
                                        } as React.CSSProperties
                                    }
                                >
                                    {[0, 1].map((pass) => (
                                        <div
                                            key={`pass-${pass}`}
                                            className={cn(
                                                'flex gap-2',
                                                pass === 1 &&
                                                    'scd-signal-ticker-duplicate'
                                            )}
                                                aria-hidden={pass === 1}
                                        >
                                            {rowItems.map((item, idx) => {
                                                const record =
                                                    catalogueByName?.get(
                                                        item.searchName
                                                    );
                                                const catalogueLoading =
                                                    catalogueByName === null;
                                                if (pass === 1) {
                                                    return (
                                                        <SignalTickerTileChrome
                                                            key={`${pass}-${item.id}`}
                                                            visual={
                                                                visualById[item.id] ??
                                                                makePendingVisual(
                                                                    item,
                                                                    record,
                                                                    catalogueLoading
                                                                )
                                                            }
                                                            duplicate
                                                        />
                                                    );
                                                }
                                                return (
                                                    <SignalTickerTile
                                                        key={`${pass}-${item.id}`}
                                                        item={item}
                                                        record={record}
                                                        catalogueLoading={
                                                            catalogueLoading
                                                        }
                                                        range={range}
                                                        refreshToken={refreshToken}
                                                        index={idx + rowIndex * 10}
                                                        onVisualState={
                                                            handleVisualState
                                                        }
                                                    />
                                                );
                                            })}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
                <button
                    type="button"
                    onClick={onOpenEditor}
                    title="Configure signal rail"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:bg-sky-50 hover:text-sky-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-sky-950/50 dark:hover:text-sky-200"
                >
                    <Settings2 className="h-4 w-4" />
                </button>
            </div>
        </section>
    );
};

interface SignalTickerEditorProps {
    open: boolean;
    config: SignalTickerConfig;
    catalogue: SearchbaseRecord[];
    catalogueLoading: boolean;
    onChange: (config: SignalTickerConfig) => void;
    onReset: () => void;
    onClose: () => void;
}

const SPEED_LABELS: Record<SignalTickerSpeed, string> = {
    slow: 'Slow',
    normal: 'Normal',
    fast: 'Fast',
};

export const SignalTickerEditor: React.FC<SignalTickerEditorProps> = ({
    open,
    config,
    catalogue,
    catalogueLoading,
    onChange,
    onReset,
    onClose,
}) => {
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState('All');
    const selectedNames = useMemo(
        () => new Set(config.items.map((item) => item.searchName)),
        [config.items]
    );
    const categories = useMemo(() => {
        const values = Array.from(
            new Set(catalogue.map((entry) => entry.category).filter(Boolean))
        ).sort((a, b) => a.localeCompare(b));
        return ['All', ...values];
    }, [catalogue]);
    const filteredCatalogue = useMemo(() => {
        const q = query.trim().toLowerCase();
        return catalogue
            .filter((entry) => {
                if (category !== 'All' && entry.category !== category) return false;
                if (!q) return true;
                const haystack = [
                    entry.searchName,
                    entry.category,
                    entry.subCategory,
                    entry.tags.join(' '),
                    plainTextFromHtml(entry.description),
                ]
                    .join('\n')
                    .toLowerCase();
                return haystack.includes(q);
            })
            .slice(0, 80);
    }, [catalogue, category, query]);

    if (!open) return null;

    const updateConfig = (patch: Partial<SignalTickerConfig>) =>
        onChange({ ...config, ...patch });
    const addEntry = (entry: SearchbaseRecord) => {
        if (selectedNames.has(entry.searchName) || config.items.length >= 24) {
            return;
        }
        const nextItem: SignalTickerItem = {
            id: makeSignalTickerItemId(
                entry.searchName,
                config.items.map((item) => item.id)
            ),
            searchName: entry.searchName,
            label: entry.searchName,
        };
        updateConfig({ items: [...config.items, nextItem], enabled: true });
    };
    const updateItem = (id: string, patch: Partial<SignalTickerItem>) => {
        updateConfig({
            items: config.items.map((item) =>
                item.id === id ? { ...item, ...patch } : item
            ),
        });
    };
    const removeItem = (id: string) => {
        updateConfig({ items: config.items.filter((item) => item.id !== id) });
    };
    const moveItem = (id: string, direction: -1 | 1) => {
        const idx = config.items.findIndex((item) => item.id === id);
        const nextIdx = idx + direction;
        if (idx < 0 || nextIdx < 0 || nextIdx >= config.items.length) return;
        const next = [...config.items];
        const [item] = next.splice(idx, 1);
        next.splice(nextIdx, 0, item);
        updateConfig({ items: next });
    };

    return (
        <div
            className="fixed inset-0 z-[1800] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label="Signal rail editor"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <div className="flex max-h-[86vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                    <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-500 text-white shadow-sm">
                            <Sparkles className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-lg font-black leading-tight text-slate-900 dark:text-white">
                                Signal Rail
                            </h3>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                Pick the KPIs that should move through the executive view.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white"
                        aria-label="Close signal rail editor"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-hidden lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                    <section className="min-h-0 overflow-y-auto border-b border-slate-200 p-4 dark:border-slate-800 lg:border-b-0 lg:border-r">
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() =>
                                    updateConfig({ enabled: !config.enabled })
                                }
                                className={cn(
                                    'rounded-lg border px-3 py-2 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400',
                                    config.enabled
                                        ? 'border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-700 dark:bg-sky-950/50 dark:text-sky-200'
                                        : 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400'
                                )}
                            >
                                <span className="block text-[10px] font-black uppercase tracking-[0.16em]">
                                    Rail
                                </span>
                                <span className="mt-1 block text-sm font-bold">
                                    {config.enabled ? 'Enabled' : 'Hidden'}
                                </span>
                            </button>
                            <button
                                type="button"
                                onClick={() =>
                                    updateConfig({
                                        rows: (config.rows === 1
                                            ? 2
                                            : 1) as SignalTickerRows,
                                    })
                                }
                                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-slate-700 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                                <span className="block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                                    Rows
                                </span>
                                <span className="mt-1 block text-sm font-bold">
                                    {config.rows === 1 ? 'One row' : 'Two rows'}
                                </span>
                            </button>
                        </div>

                        <div className="mt-4">
                            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                                Speed
                            </span>
                            <div className="mt-2 grid grid-cols-3 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
                                {(['slow', 'normal', 'fast'] as const).map(
                                    (speed) => (
                                        <button
                                            key={speed}
                                            type="button"
                                            onClick={() => updateConfig({ speed })}
                                            className={cn(
                                                'px-3 py-2 text-xs font-black uppercase tracking-wide transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400',
                                                config.speed === speed
                                                    ? 'bg-sky-500 text-white'
                                                    : 'bg-white text-slate-500 hover:bg-slate-50 dark:bg-slate-950 dark:text-slate-400 dark:hover:bg-slate-900'
                                            )}
                                        >
                                            {SPEED_LABELS[speed]}
                                        </button>
                                    )
                                )}
                            </div>
                        </div>

                        <div className="mt-5 flex items-center justify-between gap-3">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                                Selected KPIs
                            </h4>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                                {config.items.length}/24
                            </span>
                        </div>
                        <div className="mt-2 space-y-2">
                            {config.items.length === 0 && (
                                <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                                    Add KPIs from the catalogue to start the rail.
                                </div>
                            )}
                            {config.items.map((item, idx) => (
                                <div
                                    key={item.id}
                                    className="rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-900/70"
                                >
                                    <div className="flex items-center gap-2">
                                        <GripVertical className="h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600" />
                                        <input
                                            value={item.label ?? item.searchName}
                                            onChange={(event) =>
                                                updateItem(item.id, {
                                                    label: event.target.value,
                                                })
                                            }
                                            className="min-w-0 flex-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-700 outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                                            aria-label={`Ticker label for ${item.searchName}`}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => moveItem(item.id, -1)}
                                            disabled={idx === 0}
                                            className="rounded p-1.5 text-slate-500 transition-colors hover:bg-white hover:text-slate-900 disabled:opacity-30 dark:hover:bg-slate-800 dark:hover:text-white"
                                            title="Move up"
                                        >
                                            <ArrowUp className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => moveItem(item.id, 1)}
                                            disabled={idx === config.items.length - 1}
                                            className="rounded p-1.5 text-slate-500 transition-colors hover:bg-white hover:text-slate-900 disabled:opacity-30 dark:hover:bg-slate-800 dark:hover:text-white"
                                            title="Move down"
                                        >
                                            <ArrowDown className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => removeItem(item.id)}
                                            className="rounded p-1.5 text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-950/40"
                                            title="Remove KPI"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                    <p className="mt-1 truncate pl-6 text-[10px] font-semibold text-slate-400">
                                        {item.searchName}
                                    </p>
                                    <label className="mt-2 block pl-6">
                                        <span className="block text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">
                                            Value field
                                        </span>
                                        <input
                                            value={item.valueField ?? ''}
                                            onChange={(event) => {
                                                const next =
                                                    event.target.value.trim();
                                                updateItem(item.id, {
                                                    valueField:
                                                        next.length > 0
                                                            ? next
                                                            : undefined,
                                                });
                                            }}
                                            placeholder="Auto"
                                            className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                                        />
                                    </label>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="min-h-0 overflow-y-auto p-4">
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <div className="relative flex-1">
                                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <input
                                    value={query}
                                    onChange={(event) => setQuery(event.target.value)}
                                    placeholder="Search KPIs by name, category, or tag..."
                                    className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm text-slate-800 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-sky-950"
                                />
                            </div>
                            <select
                                value={category}
                                onChange={(event) => setCategory(event.target.value)}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-sky-950"
                            >
                                {categories.map((value) => (
                                    <option key={value} value={value}>
                                        {value}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="mt-3 space-y-2">
                            {catalogueLoading && (
                                <div className="rounded-lg border border-slate-200 p-4 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
                                    Loading searchbase catalogue...
                                </div>
                            )}
                            {!catalogueLoading &&
                                filteredCatalogue.map((entry) => {
                                    const selected = selectedNames.has(
                                        entry.searchName
                                    );
                                    return (
                                        <div
                                            key={entry.id}
                                            className={cn(
                                                'rounded-lg border p-3 transition-colors',
                                                selected
                                                    ? 'border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/30'
                                                    : 'border-slate-200 bg-white hover:border-sky-200 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-sky-900'
                                            )}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <h5 className="truncate text-sm font-black text-slate-800 dark:text-slate-100">
                                                        {entry.searchName}
                                                    </h5>
                                                    <p className="mt-0.5 text-xs font-semibold text-slate-400">
                                                        {entry.category}
                                                        {entry.subCategory
                                                            ? ` / ${entry.subCategory}`
                                                            : ''}
                                                    </p>
                                                    <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                                                        {plainTextFromHtml(
                                                            entry.explanation ||
                                                                entry.description
                                                        ) || 'No description supplied.'}
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => addEntry(entry)}
                                                    disabled={selected}
                                                    className={cn(
                                                        'inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-black uppercase tracking-wide transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400',
                                                        selected
                                                            ? 'bg-slate-100 text-slate-400 dark:bg-slate-900 dark:text-slate-600'
                                                            : 'bg-sky-500 text-white hover:bg-sky-600'
                                                    )}
                                                >
                                                    <Plus className="h-3.5 w-3.5" />
                                                    {selected ? 'Added' : 'Add'}
                                                </button>
                                            </div>
                                            {entry.tags.length > 0 && (
                                                <div className="mt-2 flex flex-wrap gap-1">
                                                    {entry.tags.slice(0, 5).map((tag) => (
                                                        <span
                                                            key={tag}
                                                            className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-900 dark:text-slate-400"
                                                        >
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            {!catalogueLoading && filteredCatalogue.length === 0 && (
                                <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                                    No matching KPIs. Clear filters or try a broader term.
                                </div>
                            )}
                        </div>
                    </section>
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-3 dark:border-slate-800">
                    <button
                        type="button"
                        onClick={onReset}
                        className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-600 transition-colors hover:bg-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300"
                    >
                        <RotateCcw className="h-4 w-4" />
                        Factory rail
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-black text-white shadow-sm transition-colors hover:bg-sky-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
};
