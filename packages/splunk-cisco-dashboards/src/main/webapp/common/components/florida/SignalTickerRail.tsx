import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ArrowDown,
    ArrowUp,
    ChevronDown,
    ExternalLink,
    GripVertical,
    Plus,
    RotateCcw,
    Search,
    Settings2,
    Sparkles,
    Tag,
    Trash2,
    X,
} from 'lucide-react';
import { cn } from '@/common/lib/utils';
import { splunkSearchAppUrl } from '@/common/lib/splunkSearchUrl';
import {
    plainTextFromHtml,
    type SearchbaseRecord,
} from '@/common/services/searchbaseCatalogue';
import {
    useMetric,
    type MetricConfig,
    type MetricStatus,
    type MetricThresholds,
    type TimeRange,
} from '@/common/hooks/useMetric';
import {
    makeSignalTickerItemId,
    type SignalTickerConfig,
    type SignalTickerDensity,
    type SignalTickerItem,
    type SignalTickerRows,
    type SignalTickerThresholdDirection,
} from '@/common/hooks/usePersistedSignalTicker';

const signalTickerCss = `
.scd-signal-ticker-track {
    width: max-content;
    transform: translate3d(0, 0, 0);
    will-change: transform;
}
.dark .scd-signal-ticker-rail {
    background: linear-gradient(90deg, rgba(15, 23, 42, 0.98), rgba(15, 23, 42, 0.94));
    border-color: rgba(30, 41, 59, 0.95);
}
.dark .scd-signal-ticker-label-card,
.dark .scd-signal-ticker-settings {
    background: rgba(15, 23, 42, 0.92);
    border-color: rgba(14, 165, 233, 0.22);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 10px 24px rgba(2, 6, 23, 0.18);
}
.dark .scd-signal-ticker-tile {
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.045), 0 10px 24px rgba(2, 6, 23, 0.16);
}
.dark .scd-signal-ticker-tile[data-status='healthy'] {
    background: linear-gradient(90deg, rgba(6, 78, 59, 0.58), rgba(15, 23, 42, 0.93));
    border-color: rgba(52, 211, 153, 0.36);
}
.dark .scd-signal-ticker-tile[data-status='warning'] {
    background: linear-gradient(90deg, rgba(120, 53, 15, 0.6), rgba(15, 23, 42, 0.93));
    border-color: rgba(251, 191, 36, 0.4);
}
.dark .scd-signal-ticker-tile[data-status='critical'] {
    background: linear-gradient(90deg, rgba(127, 29, 29, 0.64), rgba(15, 23, 42, 0.92));
    border-color: rgba(248, 113, 113, 0.42);
}
.dark .scd-signal-ticker-tile[data-status='unknown'] {
    background: linear-gradient(90deg, rgba(30, 41, 59, 0.92), rgba(15, 23, 42, 0.92));
    border-color: rgba(100, 116, 139, 0.44);
}
.dark .scd-signal-ticker-tile .scd-signal-ticker-label {
    color: rgb(203, 213, 225);
}
.dark .scd-signal-ticker-tile .scd-signal-ticker-subtitle {
    color: rgb(148, 163, 184);
}
.dark .scd-signal-ticker-shine {
    background-image: linear-gradient(90deg, transparent, rgba(125, 211, 252, 0.18), transparent);
}
`;

const MIN_SIGNAL_SPEED = 0;
const MAX_SIGNAL_SPEED = 10;
const MAX_SIGNAL_PIXELS_PER_SECOND = 92;
const DRAG_CLICK_THRESHOLD_PX = 5;

const TICKER_TRAVEL_PX_PER_ITEM: Record<SignalTickerDensity, number> = {
    compact: 252,
    comfortable: 285,
};

const speedToPixelsPerSecond = (speed: number): number => {
    const clamped = Math.min(MAX_SIGNAL_SPEED, Math.max(MIN_SIGNAL_SPEED, speed));
    if (clamped <= 0) {
        return 0;
    }
    const eased = (clamped / MAX_SIGNAL_SPEED) ** 1.2;
    return Math.max(8, Math.round(eased * MAX_SIGNAL_PIXELS_PER_SECOND));
};

const wrapOffset = (offset: number, loopWidth: number): number => {
    if (!Number.isFinite(loopWidth) || loopWidth <= 0) {
        return 0;
    }
    const wrapped = offset % loopWidth;
    return wrapped < 0 ? wrapped + loopWidth : wrapped;
};

const ALL_CATEGORIES = '__all__';
const ALL_SUB_CATEGORIES = '__all_sub__';
const ALL_APPS = '__all_apps__';
const DEFAULT_APP_SCOPE = 'splunk-cisco-dashboards';
const TAG_CHIP_LIMIT = 24;

const TILE_SIZE_CLASS: Record<SignalTickerDensity, string> = {
    compact: 'h-[62px] min-w-[238px] max-w-[238px] px-3 py-2.5',
    comfortable: 'h-[82px] min-w-[265px] max-w-[265px] px-4 py-3',
};

const TILE_VALUE_CLASS: Record<SignalTickerDensity, string> = {
    compact: 'text-[22px]',
    comfortable: 'text-[26px]',
};

const TILE_LABEL_CLASS: Record<SignalTickerDensity, string> = {
    compact: 'mt-1.5 text-[9px] leading-tight',
    comfortable: 'mt-2 text-[10px] leading-tight',
};

const TILE_SUBTITLE_CLASS: Record<SignalTickerDensity, string> = {
    compact: 'mt-0.5 text-[8px]',
    comfortable: 'mt-1 text-[9px]',
};

const STATUS_ACCENT_CLASS = {
    healthy: 'border-emerald-300/80 dark:border-emerald-400/50',
    warning: 'border-amber-300/90 dark:border-amber-400/70',
    critical: 'border-red-300/90 dark:border-red-400/70',
    unknown: 'border-slate-300/80 dark:border-slate-600/80',
};

const STATUS_DOT_CLASS = {
    healthy: 'bg-emerald-500',
    warning: 'bg-amber-500',
    critical: 'bg-red-500',
    unknown: 'bg-slate-400',
};

const STATUS_BG_CLASS = {
    healthy: 'bg-white/94 hover:bg-white dark:bg-emerald-950/55 dark:hover:bg-emerald-950/70',
    warning: 'bg-amber-50/95 hover:bg-amber-50 dark:bg-amber-950/55 dark:hover:bg-amber-950/70',
    critical: 'bg-red-50/95 hover:bg-red-50 dark:bg-red-950/60 dark:hover:bg-red-950/75',
    unknown: 'bg-white/92 hover:bg-white dark:bg-slate-900/95 dark:hover:bg-slate-900',
};

const STATUS_TEXT_CLASS = {
    healthy: 'text-slate-900 dark:text-white',
    warning: 'text-amber-700 dark:text-amber-200',
    critical: 'text-red-600 dark:text-red-200',
    unknown: 'text-slate-900 dark:text-white',
};

const STATUS_PILL_CLASS = {
    healthy: 'bg-emerald-500/10 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-200',
    warning: 'bg-amber-500/12 text-amber-700 dark:bg-amber-400/15 dark:text-amber-200',
    critical: 'bg-red-500/12 text-red-700 dark:bg-red-400/15 dark:text-red-200',
    unknown: 'bg-slate-500/10 text-slate-500 dark:bg-slate-400/10 dark:text-slate-300',
};

const STATUS_LABEL: Record<MetricStatus, string> = {
    healthy: 'Healthy',
    warning: 'Warning',
    critical: 'Critical',
    unknown: 'Watching',
};

export interface SignalTickerMetricDefaults {
    label?: string;
    subLabel?: string;
    description?: string;
    valueField?: string;
    displayField?: string;
    sparkDataField?: string;
    baselineField?: string;
    overlayLabel?: string;
    changeField?: string;
    comparePeriod?: boolean;
    unit?: string;
    color?: string;
    thresholds?: MetricThresholds;
}

const formatTickerNumber = (value: number, unit?: string): string => {
    if (!Number.isFinite(value)) return '--';
    const abs = Math.abs(value);
    const format = (divisor: number, suffix: string) => {
        const n = value / divisor;
        return `${n >= 10 ? n.toFixed(0) : n.toFixed(1)}${suffix}`;
    };
    const body =
        abs >= 1_000_000_000
            ? format(1_000_000_000, 'B')
            : abs >= 1_000_000
            ? format(1_000_000, 'M')
            : abs >= 100_000
            ? `${Math.round(value / 1000)}K`
            : abs >= 1_000
            ? format(1_000, 'K')
            : Number.isInteger(value)
            ? value.toLocaleString()
            : value.toLocaleString(undefined, { maximumFractionDigits: 1 });
    return unit ? `${body}${unit}` : body;
};

const labelForRecord = (
    item: SignalTickerItem,
    record: SearchbaseRecord | undefined,
    metricDefault?: SignalTickerMetricDefaults
): string =>
    item.label?.trim() ||
    metricDefault?.label ||
    record?.searchName ||
    item.searchName;

const subtitleForRecord = (
    record: SearchbaseRecord | undefined,
    metricDefault?: SignalTickerMetricDefaults
): string => {
    if (metricDefault?.subLabel) return metricDefault.subLabel;
    if (!record) return 'Awaiting searchbase';
    if (record.category && record.subCategory) {
        return `${record.category} / ${record.subCategory}`;
    }
    return record.category || record.subCategory || 'Searchbase KPI';
};

const descriptionForRecord = (
    record: SearchbaseRecord | undefined,
    metricDefault?: SignalTickerMetricDefaults
): string | undefined =>
    metricDefault?.description ||
    (record ? plainTextFromHtml(record.explanation || record.description) : undefined);

const resolveThresholds = (
    item: SignalTickerItem,
    metricDefault?: SignalTickerMetricDefaults
): MetricThresholds | undefined => {
    const hasItemThreshold =
        item.thresholdWarning !== undefined ||
        item.thresholdCritical !== undefined ||
        item.thresholdDirection !== undefined;
    if (!hasItemThreshold) return metricDefault?.thresholds;
    const warning = item.thresholdWarning ?? metricDefault?.thresholds?.warning;
    const critical = item.thresholdCritical ?? metricDefault?.thresholds?.critical;
    if (warning === undefined && critical === undefined) return undefined;
    return {
        warning,
        critical,
        direction:
            item.thresholdDirection ??
            metricDefault?.thresholds?.direction ??
            'higher_is_better',
    };
};

const resolveUnit = (
    item: SignalTickerItem,
    metricDefault?: SignalTickerMetricDefaults
): string | undefined => item.thresholdUnit ?? metricDefault?.unit;

const directionLabel = (
    direction: SignalTickerThresholdDirection | undefined
): string =>
    direction === 'lower_is_better' ? 'lower is better' : 'higher is better';

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
    catalogueLoading: boolean,
    metricDefault?: SignalTickerMetricDefaults
): SignalTickerTileVisualState => ({
    label: labelForRecord(item, record, metricDefault),
    subtitle: subtitleForRecord(record, metricDefault),
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
    density: SignalTickerDensity;
    searchHref?: string;
    duplicate?: boolean;
}

const SignalTickerTileChrome: React.FC<SignalTickerTileChromeProps> = ({
    visual,
    density,
    searchHref,
    duplicate = false,
}) => {
    const handleOpenInSearchClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
        event.stopPropagation();
    };

    const stopRailDrag = (event: React.PointerEvent<HTMLAnchorElement>) => {
        event.stopPropagation();
    };

    const className = cn(
        'group relative overflow-hidden rounded-lg border text-left shadow-sm transition-all',
        'scd-signal-ticker-tile',
        TILE_SIZE_CLASS[density],
        STATUS_BG_CLASS[visual.status],
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400',
        'cursor-default',
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
                className="scd-signal-ticker-shine absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-sky-300/30"
                aria-hidden="true"
            />
            <span className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                    <span
                        className={cn(
                            'block truncate font-black leading-none tracking-normal',
                            TILE_VALUE_CLASS[density],
                            STATUS_TEXT_CLASS[visual.status]
                        )}
                    >
                        {visual.valueText}
                    </span>
                    <span
                        className={cn(
                            'scd-signal-ticker-label block line-clamp-2 font-black uppercase tracking-[0.08em] text-slate-600 dark:text-slate-300',
                            TILE_LABEL_CLASS[density]
                        )}
                    >
                        {visual.label}
                    </span>
                </span>
                <span className="flex flex-col items-end gap-1">
                    <span className="flex items-center gap-0.5">
                        <span
                            className={cn(
                                'rounded-full px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.12em]',
                                STATUS_PILL_CLASS[visual.status]
                            )}
                        >
                            {STATUS_LABEL[visual.status]}
                        </span>
                        {visual.canOpen && searchHref && (
                            <a
                                href={searchHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                onPointerDown={stopRailDrag}
                                onClick={handleOpenInSearchClick}
                                title="Open in Search"
                                aria-label={`Open ${visual.label} in Search`}
                                tabIndex={duplicate ? -1 : 0}
                                data-tile-control="true"
                                className="p-0.5 -my-0.5 text-slate-300 transition-colors rounded hover:text-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-400 dark:text-slate-500 dark:hover:text-sky-300"
                            >
                                <ExternalLink className="h-3 w-3 stroke-[2.5px]" />
                            </a>
                        )}
                    </span>
                </span>
            </span>
            <span
                className={cn(
                    'scd-signal-ticker-subtitle block truncate font-semibold text-slate-400 dark:text-slate-500',
                    TILE_SUBTITLE_CLASS[density]
                )}
            >
                {visual.subtitle}
            </span>
        </>
    );

    if (duplicate) {
        return (
            <div
                className={className}
                data-status={visual.status}
                aria-hidden="true"
                title={visual.canOpen ? `Open ${visual.label} in Search` : visual.label}
            >
                {content}
            </div>
        );
    }

    return (
        <div
            data-status={visual.status}
            title={visual.label}
            className={className}
        >
            {content}
        </div>
    );
};

interface SignalTickerTileProps {
    item: SignalTickerItem;
    record?: SearchbaseRecord;
    metricDefault?: SignalTickerMetricDefaults;
    catalogueLoading: boolean;
    density: SignalTickerDensity;
    range: TimeRange;
    refreshToken: number;
    index: number;
    onVisualState: (id: string, visual: SignalTickerTileVisualState) => void;
}

const SignalTickerTile: React.FC<SignalTickerTileProps> = ({
    item,
    record,
    metricDefault,
    catalogueLoading,
    density,
    range,
    refreshToken,
    index,
    onVisualState,
}) => {
    const label = labelForRecord(item, record, metricDefault);
    const thresholds = useMemo(
        () => resolveThresholds(item, metricDefault),
        [
            item.thresholdCritical,
            item.thresholdDirection,
            item.thresholdWarning,
            metricDefault,
        ]
    );
    const unit = resolveUnit(item, metricDefault);
    const cfg = useMemo<MetricConfig>(
        () => ({
            id: `signal_ticker_${item.id}`,
            section: 'it_health',
            label,
            subLabel: subtitleForRecord(record, metricDefault),
            description: descriptionForRecord(record, metricDefault),
            spl: record?.search,
            valueField: item.valueField ?? metricDefault?.valueField,
            displayField: metricDefault?.displayField,
            sparkDataField: metricDefault?.sparkDataField,
            baselineField: metricDefault?.baselineField,
            overlayLabel: metricDefault?.overlayLabel,
            changeField: metricDefault?.changeField,
            comparePeriod: metricDefault?.comparePeriod,
            unit,
            thresholds,
            color: metricDefault?.color ?? '#0ea5e9',
            suppressMockOnEmpty: true,
            mock: {
                seed: 700 + index,
                sparkMin: 0,
                sparkMax: 100,
                value: 0,
                change: 0,
            },
        }),
        [index, item.id, item.valueField, label, metricDefault, record, thresholds, unit]
    );
    const result = useMetric(cfg, range, refreshToken);
    const loading = catalogueLoading || result.source === 'loading';
    const valueText = loading
        ? 'Loading'
        : result.displayValue ?? formatTickerNumber(result.value, unit);
    const status: MetricStatus = loading ? 'unknown' : result.status;
    const subtitle = subtitleForRecord(record, metricDefault);
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
            density={density}
            searchHref={
                record?.search
                    ? splunkSearchAppUrl(record.search, range)
                    : undefined
            }
        />
    );
};

interface SignalTickerRailProps {
    config: SignalTickerConfig;
    catalogueByName: Map<string, SearchbaseRecord> | null;
    metricDefaultsBySearchName?: Map<string, SignalTickerMetricDefaults>;
    range: TimeRange;
    refreshToken: number;
    onOpenEditor: () => void;
}

export const SignalTickerRail: React.FC<SignalTickerRailProps> = ({
    config,
    catalogueByName,
    metricDefaultsBySearchName,
    range,
    refreshToken,
    onOpenEditor,
}) => {
    const [visualById, setVisualById] = useState<
        Record<string, SignalTickerTileVisualState>
    >({});
    const trackRefs = useRef<Array<HTMLDivElement | null>>([]);
    const offsetsRef = useRef<number[]>([]);
    const dragRef = useRef<{
        active: boolean;
        pointerId: number | null;
        lastX: number;
        totalMovement: number;
    }>({
        active: false,
        pointerId: null,
        lastX: 0,
        totalMovement: 0,
    });
    const suppressNextClickRef = useRef(false);
    const [isDragging, setIsDragging] = useState(false);
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

    const density = config.density ?? 'compact';
    const getLoopWidth = useCallback(
        (rowIndex: number, rowItemCount: number): number => {
            const track = trackRefs.current[rowIndex];
            if (!track) {
                return rowItemCount * TICKER_TRAVEL_PX_PER_ITEM[density];
            }
            return track.scrollWidth / 2;
        },
        [density]
    );
    const applyTrackTransform = useCallback(
        (rowIndex: number, rowItemCount: number) => {
            const track = trackRefs.current[rowIndex];
            if (!track) {
                return;
            }
            const loopWidth = getLoopWidth(rowIndex, rowItemCount);
            const offset = wrapOffset(offsetsRef.current[rowIndex] ?? 0, loopWidth);
            offsetsRef.current[rowIndex] = offset;
            track.style.transform = `translate3d(${-offset}px, 0, 0)`;
        },
        [getLoopWidth]
    );
    const moveRowsBy = useCallback(
        (deltaX: number) => {
            rows.forEach((rowItems, rowIndex) => {
                if (rowItems.length <= 1) {
                    return;
                }
                const loopWidth = getLoopWidth(rowIndex, rowItems.length);
                offsetsRef.current[rowIndex] = wrapOffset(
                    (offsetsRef.current[rowIndex] ?? 0) - deltaX,
                    loopWidth
                );
                applyTrackTransform(rowIndex, rowItems.length);
            });
        },
        [applyTrackTransform, getLoopWidth, rows]
    );

    useEffect(() => {
        offsetsRef.current = rows.map(
            (_, rowIndex) => offsetsRef.current[rowIndex] ?? 0
        );
        rows.forEach((rowItems, rowIndex) =>
            applyTrackTransform(rowIndex, rowItems.length)
        );
    }, [applyTrackTransform, rows]);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return undefined;
        }
        const reduceMotion = window.matchMedia?.(
            '(prefers-reduced-motion: reduce)'
        ).matches;
        const pixelsPerSecond = reduceMotion ? 0 : speedToPixelsPerSecond(config.speed);
        if (pixelsPerSecond <= 0) {
            return undefined;
        }

        let animationFrame = 0;
        let lastTimestamp = window.performance.now();
        const tick = (timestamp: number) => {
            const deltaSeconds = Math.min(
                0.1,
                Math.max(0, (timestamp - lastTimestamp) / 1000)
            );
            lastTimestamp = timestamp;
            if (!dragRef.current.active) {
                rows.forEach((rowItems, rowIndex) => {
                    if (rowItems.length <= 1) {
                        return;
                    }
                    const loopWidth = getLoopWidth(rowIndex, rowItems.length);
                    offsetsRef.current[rowIndex] = wrapOffset(
                        (offsetsRef.current[rowIndex] ?? 0) +
                            deltaSeconds * pixelsPerSecond,
                        loopWidth
                    );
                    applyTrackTransform(rowIndex, rowItems.length);
                });
            }
            animationFrame = window.requestAnimationFrame(tick);
        };
        animationFrame = window.requestAnimationFrame(tick);
        return () => window.cancelAnimationFrame(animationFrame);
    }, [applyTrackTransform, config.speed, getLoopWidth, rows]);

    const handleRailPointerDown = useCallback(
        (event: React.PointerEvent<HTMLDivElement>) => {
            if (event.button !== 0) {
                return;
            }
            dragRef.current = {
                active: true,
                pointerId: event.pointerId,
                lastX: event.clientX,
                totalMovement: 0,
            };
            setIsDragging(true);
            event.currentTarget.setPointerCapture(event.pointerId);
        },
        []
    );
    const handleRailPointerMove = useCallback(
        (event: React.PointerEvent<HTMLDivElement>) => {
            const drag = dragRef.current;
            if (!drag.active || drag.pointerId !== event.pointerId) {
                return;
            }
            const deltaX = event.clientX - drag.lastX;
            if (deltaX === 0) {
                return;
            }
            drag.lastX = event.clientX;
            drag.totalMovement += Math.abs(deltaX);
            moveRowsBy(deltaX);
            event.preventDefault();
        },
        [moveRowsBy]
    );
    const finishRailDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current;
        if (!drag.active || drag.pointerId !== event.pointerId) {
            return;
        }
        if (drag.totalMovement >= DRAG_CLICK_THRESHOLD_PX) {
            suppressNextClickRef.current = true;
            window.setTimeout(() => {
                suppressNextClickRef.current = false;
            }, 0);
        }
        dragRef.current = {
            active: false,
            pointerId: null,
            lastX: 0,
            totalMovement: 0,
        };
        setIsDragging(false);
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
    }, []);
    const handleRailClickCapture = useCallback(
        (event: React.MouseEvent<HTMLDivElement>) => {
            if (!suppressNextClickRef.current) {
                return;
            }
            suppressNextClickRef.current = false;
            event.preventDefault();
            event.stopPropagation();
        },
        []
    );

    if (!config.enabled || config.items.length === 0) return null;

    const trackGap = density === 'compact' ? 'gap-3' : 'gap-4';
    const labelCopy =
        density === 'compact'
            ? `${config.items.length} KPIs`
            : `${config.items.length} live KPIs`;

    return (
        <section className="scd-signal-ticker-rail flex-shrink-0 border-b border-slate-200 bg-white/82 px-1.5 py-1 dark:border-slate-800 dark:bg-slate-950/95">
            <style>{signalTickerCss}</style>
            <div className={cn('flex items-center', density === 'compact' ? 'gap-2' : 'gap-3')}>
                <div
                    className={cn(
                        'scd-signal-ticker-label-card hidden shrink-0 items-center gap-2 rounded-lg border border-sky-100 bg-white/90 shadow-sm dark:border-sky-900/70 dark:bg-slate-900/95 lg:flex',
                        density === 'compact' ? 'px-2.5 py-1.5' : 'px-3 py-2'
                    )}
                >
                    <Sparkles className="h-4 w-4 text-sky-500" />
                    <div className="leading-tight">
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-sky-700 dark:text-sky-300">
                            Signal Rail
                        </p>
                        <p className="text-[9px] font-semibold text-slate-400 dark:text-slate-500">
                            {labelCopy}
                        </p>
                    </div>
                </div>
                <div
                    className={cn(
                        'min-w-0 flex-1 overflow-hidden select-none touch-pan-y',
                        isDragging ? 'cursor-grabbing' : 'cursor-grab',
                        density === 'compact' ? 'space-y-0.5' : 'space-y-1'
                    )}
                    onPointerDown={handleRailPointerDown}
                    onPointerMove={handleRailPointerMove}
                    onPointerUp={finishRailDrag}
                    onPointerCancel={finishRailDrag}
                    onClickCapture={handleRailClickCapture}
                    title="Drag left or right to browse Signal Rail"
                >
                    {rows.map((rowItems, rowIndex) => {
                        const rowKey = rowItems.map((item) => item.id).join('-');
                        return (
                            <div
                                key={`ticker-row-${rowIndex}-${rowKey}`}
                                className="overflow-hidden py-0.5"
                            >
                                <div
                                    key={`ticker-track-${rowIndex}-${density}-${rowKey}`}
                                    ref={(node) => {
                                        trackRefs.current[rowIndex] = node;
                                    }}
                                    className={cn('scd-signal-ticker-track flex', trackGap)}
                                >
                                    {[0, 1].map((pass) => (
                                        <div
                                            key={`pass-${pass}`}
                                            className={cn(
                                                'flex',
                                                trackGap,
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
                                                const metricDefault =
                                                    metricDefaultsBySearchName?.get(
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
                                                                    catalogueLoading,
                                                                    metricDefault
                                                                )
                                                            }
                                                            density={density}
                                                            searchHref={
                                                                record?.search
                                                                    ? splunkSearchAppUrl(
                                                                          record.search,
                                                                          range
                                                                      )
                                                                    : undefined
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
                                                        metricDefault={
                                                            metricDefault
                                                        }
                                                        catalogueLoading={
                                                            catalogueLoading
                                                        }
                                                        density={density}
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
                    className={cn(
                        'scd-signal-ticker-settings flex shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:bg-sky-50 hover:text-sky-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 dark:border-slate-800 dark:bg-slate-900/95 dark:text-slate-300 dark:hover:bg-sky-950/50 dark:hover:text-sky-200',
                        density === 'compact' ? 'h-9 w-9' : 'h-10 w-10'
                    )}
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
    metricDefaultsBySearchName?: Map<string, SignalTickerMetricDefaults>;
    catalogueLoading: boolean;
    includeHiddenSearches?: boolean;
    onIncludeHiddenSearchesChange?: (includeHidden: boolean) => void;
    onChange: (config: SignalTickerConfig) => void;
    onReset: () => void;
    onClose: () => void;
}

const DENSITY_LABELS: Record<SignalTickerDensity, string> = {
    compact: 'Compact',
    comfortable: 'Comfortable',
};

const optionalNumberFromInput = (value: string): number | undefined => {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
};

const thresholdPlaceholder = (
    value: number | undefined,
    label: string
): string =>
    value === undefined
        ? label
        : `Default ${Number.isInteger(value) ? value : value.toFixed(1)}`;

export const SignalTickerEditor: React.FC<SignalTickerEditorProps> = ({
    open,
    config,
    catalogue,
    metricDefaultsBySearchName,
    catalogueLoading,
    includeHiddenSearches = false,
    onIncludeHiddenSearchesChange,
    onChange,
    onReset,
    onClose,
}) => {
    const [query, setQuery] = useState('');
    const [selectedApp, setSelectedApp] = useState(DEFAULT_APP_SCOPE);
    const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORIES);
    const [selectedSubCategory, setSelectedSubCategory] =
        useState(ALL_SUB_CATEGORIES);
    const [activeTags, setActiveTags] = useState<Set<string>>(() => new Set());
    const [tagFilter, setTagFilter] = useState('');
    const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const tagSelectRef = useRef<HTMLDivElement | null>(null);
    const tagInputRef = useRef<HTMLInputElement | null>(null);
    const selectedNames = useMemo(
        () => new Set(config.items.map((item) => item.searchName)),
        [config.items]
    );
    const apps = useMemo(() => {
        const set = new Set<string>();
        for (const entry of catalogue) {
            if (entry.dispatchContext) set.add(entry.dispatchContext);
        }
        return Array.from(set).sort((a, b) =>
            a.localeCompare(b, undefined, { sensitivity: 'base' })
        );
    }, [catalogue]);
    const categories = useMemo(() => {
        const set = new Set<string>();
        for (const entry of catalogue) {
            if (
                selectedApp !== ALL_APPS &&
                entry.dispatchContext !== selectedApp
            ) {
                continue;
            }
            if (entry.category) set.add(entry.category);
        }
        return Array.from(set).sort((a, b) =>
            a.localeCompare(b, undefined, { sensitivity: 'base' })
        );
    }, [catalogue, selectedApp]);
    const subCategories = useMemo(() => {
        if (selectedCategory === ALL_CATEGORIES) return [];
        const set = new Set<string>();
        for (const entry of catalogue) {
            if (
                selectedApp !== ALL_APPS &&
                entry.dispatchContext !== selectedApp
            ) {
                continue;
            }
            if (entry.category !== selectedCategory) continue;
            if (entry.subCategory) set.add(entry.subCategory);
        }
        return Array.from(set).sort((a, b) =>
            a.localeCompare(b, undefined, { sensitivity: 'base' })
        );
    }, [catalogue, selectedApp, selectedCategory]);
    const tagFacetEntries = useMemo(() => {
        const q = query.trim().toLowerCase();
        return catalogue.filter((entry) => {
            if (
                selectedApp !== ALL_APPS &&
                entry.dispatchContext !== selectedApp
            ) {
                return false;
            }
            if (
                selectedCategory !== ALL_CATEGORIES &&
                entry.category !== selectedCategory
            ) {
                return false;
            }
            if (
                selectedSubCategory !== ALL_SUB_CATEGORIES &&
                entry.subCategory !== selectedSubCategory
            ) {
                return false;
            }
            for (const tag of activeTags) {
                if (!entry.tags.includes(tag)) return false;
            }
            if (!q) return true;
            const haystack = [
                entry.searchName,
                entry.category,
                entry.subCategory,
                entry.tags.join(' '),
                plainTextFromHtml(entry.description),
                plainTextFromHtml(entry.explanation),
            ]
                .join('\n')
                .toLowerCase();
            return haystack.includes(q);
        });
    }, [
        activeTags,
        catalogue,
        query,
        selectedApp,
        selectedCategory,
        selectedSubCategory,
    ]);
    const allTagsWithCounts = useMemo(() => {
        const map = new Map<string, number>();
        for (const entry of tagFacetEntries) {
            for (const tag of entry.tags) map.set(tag, (map.get(tag) ?? 0) + 1);
        }
        return Array.from(map.entries()).sort(
            (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
        );
    }, [tagFacetEntries]);
    const tagDropdownOptions = useMemo(() => {
        const filter = tagFilter.trim().toLowerCase();
        const available = allTagsWithCounts.filter(
            ([tag]) => !activeTags.has(tag)
        );
        if (!filter) return available.slice(0, TAG_CHIP_LIMIT);
        return available.filter(([tag]) => tag.toLowerCase().includes(filter));
    }, [activeTags, allTagsWithCounts, tagFilter]);
    const tagCountByName = useMemo(() => {
        const map = new Map<string, number>();
        for (const [tag, count] of allTagsWithCounts) map.set(tag, count);
        return map;
    }, [allTagsWithCounts]);
    const activeFilterCount =
        (selectedApp !== DEFAULT_APP_SCOPE ? 1 : 0) +
        (includeHiddenSearches ? 1 : 0) +
        (selectedCategory !== ALL_CATEGORIES ? 1 : 0) +
        (selectedSubCategory !== ALL_SUB_CATEGORIES ? 1 : 0) +
        activeTags.size;
    const filteredCatalogue = useMemo(() => {
        return tagFacetEntries.slice(0, 80);
    }, [tagFacetEntries]);

    useEffect(() => {
        setSelectedCategory(ALL_CATEGORIES);
        setSelectedSubCategory(ALL_SUB_CATEGORIES);
        setActiveTags(new Set());
        setTagFilter('');
        setTagDropdownOpen(false);
    }, [selectedApp]);

    useEffect(() => {
        setSelectedSubCategory(ALL_SUB_CATEGORIES);
        setActiveTags(new Set());
        setTagFilter('');
        setTagDropdownOpen(false);
    }, [selectedCategory]);

    useEffect(() => {
        setActiveTags(new Set());
        setTagFilter('');
        setTagDropdownOpen(false);
    }, [selectedSubCategory]);

    useEffect(() => {
        if (activeFilterCount > 0) setFiltersOpen(true);
    }, [activeFilterCount]);

    useEffect(() => {
        if (!open || !tagDropdownOpen) return undefined;
        const handler = (event: MouseEvent) => {
            if (!tagSelectRef.current?.contains(event.target as Node)) {
                setTagDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open, tagDropdownOpen]);

    const addTag = (tag: string) => {
        setActiveTags((current) => {
            if (current.has(tag)) return current;
            const next = new Set(current);
            next.add(tag);
            return next;
        });
        setTagFilter('');
        setTagDropdownOpen(true);
        window.setTimeout(() => tagInputRef.current?.focus(), 0);
    };
    const removeTag = (tag: string) => {
        setActiveTags((current) => {
            if (!current.has(tag)) return current;
            const next = new Set(current);
            next.delete(tag);
            return next;
        });
    };
    const clearFilters = () => {
        setSelectedApp(DEFAULT_APP_SCOPE);
        onIncludeHiddenSearchesChange?.(false);
        setSelectedCategory(ALL_CATEGORIES);
        setSelectedSubCategory(ALL_SUB_CATEGORIES);
        setActiveTags(new Set());
        setTagFilter('');
        setTagDropdownOpen(false);
    };
    const handleTagInputKeyDown = (
        event: React.KeyboardEvent<HTMLInputElement>
    ) => {
        if (
            event.key === 'Backspace' &&
            tagFilter.length === 0 &&
            activeTags.size > 0
        ) {
            event.preventDefault();
            const tags = Array.from(activeTags);
            const last = tags[tags.length - 1];
            if (last) removeTag(last);
        }
        if (event.key === 'Enter' && tagDropdownOptions.length > 0) {
            event.preventDefault();
            addTag(tagDropdownOptions[0][0]);
        }
        if (event.key === 'Escape') {
            setTagDropdownOpen(false);
        }
    };

    if (!open) return null;

    const updateConfig = (patch: Partial<SignalTickerConfig>) =>
        onChange({ ...config, ...patch });
    const addEntry = (entry: SearchbaseRecord) => {
        if (selectedNames.has(entry.searchName) || config.items.length >= 24) {
            return;
        }
        const metricDefault = metricDefaultsBySearchName?.get(entry.searchName);
        const nextItem: SignalTickerItem = {
            id: makeSignalTickerItemId(
                entry.searchName,
                config.items.map((item) => item.id)
            ),
            searchName: entry.searchName,
            label: metricDefault?.label ?? entry.searchName,
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
                        <div className="grid grid-cols-3 gap-2">
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
                                        density:
                                            config.density === 'comfortable'
                                                ? 'compact'
                                                : 'comfortable',
                                    })
                                }
                                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-slate-700 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                                <span className="block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                                    Density
                                </span>
                                <span className="mt-1 block text-sm font-bold">
                                    {DENSITY_LABELS[config.density ?? 'compact']}
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
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                                    Speed
                                </span>
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 dark:bg-slate-900 dark:text-slate-300">
                                    {config.speed === 0
                                        ? 'Paused'
                                        : `${config.speed}/10`}
                                </span>
                            </div>
                            <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-950">
                                <input
                                    type="range"
                                    min={MIN_SIGNAL_SPEED}
                                    max={MAX_SIGNAL_SPEED}
                                    step={1}
                                    value={config.speed}
                                    onChange={(event) =>
                                        updateConfig({
                                            speed: Number(event.currentTarget.value),
                                        })
                                    }
                                    className="w-full accent-sky-500"
                                    aria-label="Signal rail speed"
                                />
                                <div className="mt-1 flex justify-between text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">
                                    <span>0</span>
                                    <span>10</span>
                                </div>
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
                            {config.items.map((item, idx) => {
                                const metricDefault =
                                    metricDefaultsBySearchName?.get(
                                        item.searchName
                                    );
                                const inheritedDirection =
                                    item.thresholdDirection ??
                                    metricDefault?.thresholds?.direction;
                                return (
                                    <div
                                        key={item.id}
                                        className="rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-900/70"
                                    >
                                        <div className="flex items-center gap-2">
                                            <GripVertical className="h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600" />
                                            <input
                                                value={
                                                    item.label ??
                                                    metricDefault?.label ??
                                                    item.searchName
                                                }
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
                                                onClick={() =>
                                                    moveItem(item.id, -1)
                                                }
                                                disabled={idx === 0}
                                                className="rounded p-1.5 text-slate-500 transition-colors hover:bg-white hover:text-slate-900 disabled:opacity-30 dark:hover:bg-slate-800 dark:hover:text-white"
                                                title="Move up"
                                            >
                                                <ArrowUp className="h-3.5 w-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    moveItem(item.id, 1)
                                                }
                                                disabled={
                                                    idx ===
                                                    config.items.length - 1
                                                }
                                                className="rounded p-1.5 text-slate-500 transition-colors hover:bg-white hover:text-slate-900 disabled:opacity-30 dark:hover:bg-slate-800 dark:hover:text-white"
                                                title="Move down"
                                            >
                                                <ArrowDown className="h-3.5 w-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    removeItem(item.id)
                                                }
                                                className="rounded p-1.5 text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-950/40"
                                                title="Remove KPI"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                        <p className="mt-1 truncate pl-6 text-[10px] font-semibold text-slate-400">
                                            {item.searchName}
                                        </p>
                                        <div className="mt-2 grid grid-cols-2 gap-2 pl-6">
                                            <label className="block">
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
                                                    placeholder={
                                                        metricDefault?.valueField ??
                                                        'Auto'
                                                    }
                                                    className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                                                />
                                            </label>
                                            <label className="block">
                                                <span className="block text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">
                                                    Unit
                                                </span>
                                                <input
                                                    value={item.thresholdUnit ?? ''}
                                                    onChange={(event) => {
                                                        const next =
                                                            event.target.value.trim();
                                                        updateItem(item.id, {
                                                            thresholdUnit:
                                                                next.length > 0
                                                                    ? next
                                                                    : undefined,
                                                        });
                                                    }}
                                                    placeholder={
                                                        metricDefault?.unit || 'None'
                                                    }
                                                    className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                                                />
                                            </label>
                                        </div>
                                        <div className="mt-2 grid grid-cols-3 gap-2 pl-6">
                                            <label className="block">
                                                <span className="block text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">
                                                    Warning
                                                </span>
                                                <input
                                                    type="number"
                                                    value={
                                                        item.thresholdWarning ??
                                                        ''
                                                    }
                                                    onChange={(event) =>
                                                        updateItem(item.id, {
                                                            thresholdWarning:
                                                                optionalNumberFromInput(
                                                                    event.target
                                                                        .value
                                                                ),
                                                        })
                                                    }
                                                    placeholder={thresholdPlaceholder(
                                                        metricDefault?.thresholds
                                                            ?.warning,
                                                        'Warn'
                                                    )}
                                                    className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                                                />
                                            </label>
                                            <label className="block">
                                                <span className="block text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">
                                                    Critical
                                                </span>
                                                <input
                                                    type="number"
                                                    value={
                                                        item.thresholdCritical ??
                                                        ''
                                                    }
                                                    onChange={(event) =>
                                                        updateItem(item.id, {
                                                            thresholdCritical:
                                                                optionalNumberFromInput(
                                                                    event.target
                                                                        .value
                                                                ),
                                                        })
                                                    }
                                                    placeholder={thresholdPlaceholder(
                                                        metricDefault?.thresholds
                                                            ?.critical,
                                                        'Crit'
                                                    )}
                                                    className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                                                />
                                            </label>
                                            <label className="block">
                                                <span className="block text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">
                                                    Direction
                                                </span>
                                                <select
                                                    value={
                                                        item.thresholdDirection ??
                                                        ''
                                                    }
                                                    onChange={(event) =>
                                                        updateItem(item.id, {
                                                            thresholdDirection:
                                                                event.target.value ===
                                                                ''
                                                                    ? undefined
                                                                    : (event.target
                                                                          .value as SignalTickerThresholdDirection),
                                                        })
                                                    }
                                                    title={directionLabel(
                                                        inheritedDirection
                                                    )}
                                                    className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                                                >
                                                    <option value="">
                                                        Inherit
                                                    </option>
                                                    <option value="higher_is_better">
                                                        High good
                                                    </option>
                                                    <option value="lower_is_better">
                                                        Low good
                                                    </option>
                                                </select>
                                            </label>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>

                    <section className="min-h-0 overflow-y-auto p-4">
                        <div className="space-y-3">
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <input
                                    value={query}
                                    onChange={(event) => setQuery(event.target.value)}
                                    placeholder="Search KPIs by name, category, or tag..."
                                    className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm text-slate-800 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-sky-950"
                                />
                            </div>

                            <div className="flex items-center justify-between gap-2">
                                <button
                                    type="button"
                                    onClick={() =>
                                        setFiltersOpen((current) => !current)
                                    }
                                    aria-expanded={filtersOpen}
                                    className={cn(
                                        'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400',
                                        filtersOpen
                                            ? 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-100'
                                            : 'bg-slate-50 text-slate-500 hover:bg-slate-100 dark:bg-slate-900/70 dark:text-slate-400 dark:hover:bg-slate-900'
                                    )}
                                >
                                    <ChevronDown
                                        className={cn(
                                            'h-3.5 w-3.5 transition-transform',
                                            filtersOpen && 'rotate-180'
                                        )}
                                    />
                                    Filters
                                    {activeFilterCount > 0 && (
                                        <span className="rounded-full bg-sky-500 px-1.5 py-0.5 text-[9px] text-white">
                                            {activeFilterCount}
                                        </span>
                                    )}
                                </button>
                                {activeFilterCount > 0 && (
                                    <button
                                        type="button"
                                        onClick={clearFilters}
                                        className="text-[11px] font-bold text-slate-400 transition-colors hover:text-sky-700 dark:text-slate-500 dark:hover:text-sky-300"
                                    >
                                        Clear filters
                                    </button>
                                )}
                            </div>

                            {filtersOpen && (
                                <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/50">
                                    <label className="grid gap-1 sm:grid-cols-[90px_minmax(0,1fr)] sm:items-center">
                                        <span
                                            className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400"
                                            title="Splunk app the search belongs to"
                                        >
                                            App
                                        </span>
                                        <select
                                            value={selectedApp}
                                            onChange={(event) =>
                                                setSelectedApp(event.target.value)
                                            }
                                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-sky-950"
                                        >
                                            <option value={ALL_APPS}>
                                                All apps ({apps.length})
                                            </option>
                                            {apps.map((app) => (
                                                <option key={app} value={app}>
                                                    {app}
                                                </option>
                                            ))}
                                            {!apps.includes(DEFAULT_APP_SCOPE) && (
                                                <option value={DEFAULT_APP_SCOPE}>
                                                    {DEFAULT_APP_SCOPE}
                                                </option>
                                            )}
                                        </select>
                                    </label>

                                    <label className="grid gap-1 sm:grid-cols-[90px_minmax(0,1fr)] sm:items-center">
                                        <span className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">
                                            Hidden
                                        </span>
                                        <span className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100">
                                            <input
                                                type="checkbox"
                                                checked={includeHiddenSearches}
                                                onChange={(event) =>
                                                    onIncludeHiddenSearchesChange?.(
                                                        event.target.checked
                                                    )
                                                }
                                                className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-400 dark:border-slate-700 dark:bg-slate-900"
                                            />
                                            <span>Show hidden searches</span>
                                        </span>
                                    </label>

                                    {categories.length > 0 && (
                                        <label className="grid gap-1 sm:grid-cols-[90px_minmax(0,1fr)] sm:items-center">
                                            <span className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">
                                                Category
                                            </span>
                                            <select
                                                value={selectedCategory}
                                                onChange={(event) =>
                                                    setSelectedCategory(
                                                        event.target.value
                                                    )
                                                }
                                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-sky-950"
                                            >
                                                <option value={ALL_CATEGORIES}>
                                                    All categories
                                                </option>
                                                {categories.map((value) => (
                                                    <option
                                                        key={value}
                                                        value={value}
                                                    >
                                                        {value}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                    )}

                                    {selectedCategory !== ALL_CATEGORIES &&
                                        subCategories.length > 0 && (
                                            <label className="grid gap-1 sm:grid-cols-[90px_minmax(0,1fr)] sm:items-center">
                                                <span className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">
                                                    Sub-cat
                                                </span>
                                                <select
                                                    value={selectedSubCategory}
                                                    onChange={(event) =>
                                                        setSelectedSubCategory(
                                                            event.target.value
                                                        )
                                                    }
                                                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-sky-950"
                                                >
                                                    <option
                                                        value={
                                                            ALL_SUB_CATEGORIES
                                                        }
                                                    >
                                                        All sub-categories (
                                                        {subCategories.length})
                                                    </option>
                                                    {subCategories.map((value) => (
                                                        <option
                                                            key={value}
                                                            value={value}
                                                        >
                                                            {value}
                                                        </option>
                                                    ))}
                                                </select>
                                            </label>
                                        )}

                                    {(allTagsWithCounts.length > 0 ||
                                        activeTags.size > 0) && (
                                        <div className="grid gap-1 sm:grid-cols-[90px_minmax(0,1fr)] sm:items-start">
                                            <span className="pt-2 text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">
                                                Tags
                                            </span>
                                            <div
                                                className="relative"
                                                ref={tagSelectRef}
                                            >
                                                <div
                                                    onClick={() => {
                                                        setTagDropdownOpen(true);
                                                        tagInputRef.current?.focus();
                                                    }}
                                                    className={cn(
                                                        'flex min-h-[42px] cursor-text flex-wrap items-center gap-1 rounded-lg border bg-white px-2 py-1.5 transition-shadow dark:bg-slate-950',
                                                        tagDropdownOpen
                                                            ? 'border-sky-400 ring-2 ring-sky-400/25'
                                                            : 'border-slate-200 dark:border-slate-800'
                                                    )}
                                                >
                                                    <Tag className="ml-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                                                    {Array.from(activeTags).map(
                                                        (tag) => {
                                                            const count =
                                                                tagCountByName.get(
                                                                    tag
                                                                ) ?? 0;
                                                            return (
                                                                <span
                                                                    key={tag}
                                                                    className="inline-flex items-center gap-1 rounded-full bg-sky-500 py-0.5 pl-2 pr-1 text-[10px] font-bold uppercase tracking-wide text-white"
                                                                >
                                                                    {tag}
                                                                    {count > 0 && (
                                                                        <span className="font-normal opacity-75">
                                                                            {count}
                                                                        </span>
                                                                    )}
                                                                    <button
                                                                        type="button"
                                                                        onClick={(
                                                                            event
                                                                        ) => {
                                                                            event.stopPropagation();
                                                                            removeTag(tag);
                                                                        }}
                                                                        title={`Remove ${tag} filter`}
                                                                        aria-label={`Remove ${tag} filter`}
                                                                        className="rounded-full p-0.5 hover:bg-sky-700/40"
                                                                    >
                                                                        <X className="h-2.5 w-2.5" />
                                                                    </button>
                                                                </span>
                                                            );
                                                        }
                                                    )}
                                                    <input
                                                        ref={tagInputRef}
                                                        type="text"
                                                        value={tagFilter}
                                                        onChange={(event) => {
                                                            setTagFilter(
                                                                event.target.value
                                                            );
                                                            setTagDropdownOpen(true);
                                                        }}
                                                        onFocus={() =>
                                                            setTagDropdownOpen(true)
                                                        }
                                                        onKeyDown={
                                                            handleTagInputKeyDown
                                                        }
                                                        placeholder={
                                                            activeTags.size === 0
                                                                ? `Filter by tag (${allTagsWithCounts.length} available, AND combined)...`
                                                                : 'Add tag...'
                                                        }
                                                        maxLength={64}
                                                        aria-label="Filter signal rail catalogue by tag"
                                                        className="min-w-[120px] flex-1 border-0 bg-transparent py-1 text-sm text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-100"
                                                    />
                                                </div>

                                                {tagDropdownOpen && (
                                                    <div
                                                        role="listbox"
                                                        aria-label="Available tags"
                                                        className="absolute left-0 right-0 top-full z-[1900] mt-1 max-h-56 overflow-auto rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900"
                                                    >
                                                        {tagDropdownOptions.length ===
                                                        0 ? (
                                                            <p className="px-3 py-2 text-xs italic text-slate-400 dark:text-slate-500">
                                                                {tagFilter.trim()
                                                                    ? `No more tags match "${tagFilter.trim()}".`
                                                                    : activeTags.size >
                                                                      0
                                                                    ? 'All available tags already selected.'
                                                                    : 'No tags available in this slice.'}
                                                            </p>
                                                        ) : (
                                                            <>
                                                                {tagDropdownOptions.map(
                                                                    ([
                                                                        tag,
                                                                        count,
                                                                    ]) => (
                                                                        <button
                                                                            key={tag}
                                                                            type="button"
                                                                            role="option"
                                                                            aria-selected="false"
                                                                            onClick={() =>
                                                                                addTag(
                                                                                    tag
                                                                                )
                                                                            }
                                                                            title={`${count} search${count === 1 ? '' : 'es'} tagged ${tag}`}
                                                                            className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-sky-50 focus:bg-sky-50 focus:outline-none dark:hover:bg-sky-900/30 dark:focus:bg-sky-900/30"
                                                                        >
                                                                            <span className="flex min-w-0 items-center gap-1.5 truncate text-slate-700 dark:text-slate-200">
                                                                                <Tag className="h-3 w-3 shrink-0 text-slate-400" />
                                                                                <span className="truncate">
                                                                                    {
                                                                                        tag
                                                                                    }
                                                                                </span>
                                                                            </span>
                                                                            <span className="shrink-0 text-[10px] font-bold text-slate-400 dark:text-slate-500">
                                                                                {
                                                                                    count
                                                                                }
                                                                            </span>
                                                                        </button>
                                                                    )
                                                                )}
                                                                {!tagFilter.trim() &&
                                                                    allTagsWithCounts.length -
                                                                        activeTags.size >
                                                                        tagDropdownOptions.length && (
                                                                        <p className="border-t border-slate-100 px-3 py-1.5 text-[10px] text-slate-400 dark:border-slate-800 dark:text-slate-500">
                                                                            Top{' '}
                                                                            {
                                                                                tagDropdownOptions.length
                                                                            }{' '}
                                                                            of{' '}
                                                                            {allTagsWithCounts.length -
                                                                                activeTags.size}{' '}
                                                                            tags.
                                                                            Type
                                                                            to
                                                                            filter.
                                                                        </p>
                                                                    )}
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
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
