import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Button from '@splunk/react-ui/Button';
import Slider from '@splunk/react-ui/Slider';
import {
    ArrowDown,
    ArrowUp,
    Check,
    ChevronDown,
    ExternalLink,
    GripVertical,
    Info,
    Plus,
    RotateCcw,
    Search,
    Sparkles,
    Tag,
    Trash2,
    X,
} from '@/common/icons/SuiIcon';
import { cn } from '@/common/lib/utils';
import { formatMetricNumber } from '@/common/lib/metricValueFormat';
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
    MAX_SIGNAL_TICKER_SPEED,
    MIN_SIGNAL_TICKER_SPEED,
    NORMAL_SIGNAL_TICKER_SPEED,
    SIGNAL_TICKER_SPEED_STEP,
    makeSignalTickerItemId,
    type SignalTickerConfig,
    type SignalTickerDensity,
    type SignalTickerFontSize,
    type SignalTickerItem,
    type SignalTickerPersistenceStatus,
    type SignalTickerRows,
    type SignalTickerThresholdDirection,
} from '@/common/hooks/usePersistedSignalTicker';
import {
    SignalRailTicker,
    type SignalRailDeltaDirection,
    type SignalRailKpi,
} from './SignalRailTicker';

const ALL_CATEGORIES = '__all__';
const ALL_SUB_CATEGORIES = '__all_sub__';
const ALL_APPS = '__all_apps__';
const TAG_CHIP_LIMIT = 24;

const TILE_SIZE_CLASS: Record<SignalTickerDensity, string> = {
    compact: 'h-[62px] min-w-[238px] max-w-[238px] px-3 py-2.5',
    comfortable: 'h-[82px] min-w-[265px] max-w-[265px] px-4 py-3',
};

const TILE_VALUE_CLASS: Record<SignalTickerDensity, string> = {
    compact: 'sui-color-default',
    comfortable: 'sui-color-default',
};

const TILE_LABEL_CLASS: Record<SignalTickerDensity, string> = {
    compact: 'mt-1.5 text-xs leading-tight',
    comfortable: 'mt-2 text-xs leading-tight',
};

const TILE_SUBTITLE_CLASS: Record<SignalTickerDensity, string> = {
    compact: 'mt-0.5 text-xs',
    comfortable: 'mt-1 text-xs',
};

const STATUS_ACCENT_CLASS = {
    healthy: 'sui-border-positive',
    warning: 'sui-border-warning',
    critical: 'sui-border-negative',
    unknown: 'sui-border-default',
};

const STATUS_DOT_CLASS = {
    healthy: 'sui-bg-positive',
    warning: 'sui-bg-warning',
    critical: 'sui-bg-negative',
    unknown: 'sui-bg-floating',
};

const STATUS_BG_CLASS = {
    healthy: 'sui-bg-section  sui-bg-positive sui-hover-bg-positive',
    warning: 'sui-bg-warning sui-hover-bg-warning',
    critical: 'sui-bg-negative sui-hover-bg-negative',
    unknown: 'sui-bg-section sui-hover-bg-section',
};

const STATUS_TEXT_CLASS = {
    healthy: 'sui-color-active',
    warning: 'sui-color-warning',
    critical: 'sui-color-negative',
    unknown: 'sui-color-active',
};

const STATUS_PILL_CLASS = {
    healthy: 'sui-bg-positive sui-color-positive',
    warning: 'sui-bg-warning sui-color-warning',
    critical: 'sui-bg-negative sui-color-negative',
    unknown: 'sui-bg-floating sui-color-default',
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
    (record ? plainTextFromHtml(record.description || record.explanation) : undefined);

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
    delta?: string;
    deltaDir?: SignalRailDeltaDirection;
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
    deltaDir: 'flat',
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
    a?.canOpen === b.canOpen &&
    a?.delta === b.delta &&
    a?.deltaDir === b.deltaDir;

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
        'focus:outline-none focus-visible:ring-2 sui-focus-visible-ring',
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
                className="scd-signal-ticker-shine absolute inset-x-0 top-0 h-px bg-gradient-to-r sui-gradient-from-transparent sui-gradient-to-transparent sui-gradient-via-info"
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
                            'scd-signal-ticker-label block line-clamp-2 font-black uppercase tracking-[0.08em]  sui-color-default',
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
                                'rounded-full px-1.5 py-0.5 text-xs font-black uppercase tracking-[0.12em]',
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
                                className="p-0.5 -my-0.5  transition-colors rounded  focus:outline-none focus:ring-1 sui-focus-ring sui-color-muted sui-hover-color-info"
                            >
                                <ExternalLink className="h-3 w-3 sui-stroke-default" />
                            </a>
                        )}
                    </span>
                </span>
            </span>
            <span
                className={cn(
                    'scd-signal-ticker-subtitle block truncate font-semibold  sui-color-muted',
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
    probeOnly?: boolean;
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
    probeOnly = false,
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
            dispatchContext: record?.dispatchContext,
            dispatchPriority: 0,
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
        : result.displayValue ?? formatMetricNumber(result.value, unit);
    const status: MetricStatus = loading ? 'unknown' : result.status;
    const subtitle = subtitleForRecord(record, metricDefault);
    const deltaDir: SignalRailDeltaDirection =
        !Number.isFinite(result.change) || Math.abs(result.change) < 0.01
            ? 'flat'
            : result.change > 0
            ? 'up'
            : 'down';
    const delta =
        !loading && Number.isFinite(result.change)
            ? formatMetricNumber(Math.abs(result.change), unit)
            : undefined;
    const visual = useMemo<SignalTickerTileVisualState>(
        () => ({
            label,
            subtitle,
            valueText,
            status,
            canOpen: Boolean(record?.search),
            delta,
            deltaDir,
        }),
        [delta, deltaDir, label, record?.search, status, subtitle, valueText]
    );

    useEffect(() => {
        onVisualState(item.id, visual);
    }, [item.id, onVisualState, visual]);

    if (probeOnly) {
        return null;
    }

    return (
        <SignalTickerTileChrome
            visual={visual}
            density={density}
            searchHref={
                record?.search
                    ? splunkSearchAppUrl(record.search, range, record.dispatchContext)
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
    paused?: boolean;
    onOpenEditor: () => void;
}

export const SignalTickerRail: React.FC<SignalTickerRailProps> = ({
    config,
    catalogueByName,
    metricDefaultsBySearchName,
    range,
    refreshToken,
    paused = false,
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
    const density = config.density ?? 'comfortable';
    const fontSize = config.fontSize ?? 'standard';
    const durationSeconds = useMemo(() => {
        if (paused || config.speed <= 0) return 0;
        const clamped = Math.min(
            MAX_SIGNAL_TICKER_SPEED,
            Math.max(MIN_SIGNAL_TICKER_SPEED, config.speed)
        );
        const multiplier = clamped / NORMAL_SIGNAL_TICKER_SPEED;
        return Math.round(60 / multiplier);
    }, [config.speed, paused]);
    const tickerKpis = useMemo<SignalRailKpi[]>(
        () =>
            config.items.map((item) => {
                const record = catalogueByName?.get(item.searchName);
                const metricDefault = metricDefaultsBySearchName?.get(
                    item.searchName
                );
                const visual =
                    visualById[item.id] ??
                    makePendingVisual(
                        item,
                        record,
                        catalogueByName === null,
                        metricDefault
                    );
                return {
                    id: item.id,
                    label: visual.label,
                    value: visual.valueText,
                    status: visual.status,
                    category: visual.subtitle,
                    delta: visual.delta,
                    deltaDir: visual.deltaDir,
                    href: record?.search
                        ? splunkSearchAppUrl(record.search, range, record.dispatchContext)
                        : undefined,
                    canOpen: visual.canOpen,
                };
            }),
        [
            catalogueByName,
            config.items,
            metricDefaultsBySearchName,
            range,
            visualById,
        ]
    );

    if (!config.enabled || config.items.length === 0) return null;

    return (
        <>
            {config.items.map((item, index) => {
                const record = catalogueByName?.get(item.searchName);
                return (
                    <SignalTickerTile
                        key={item.id}
                        item={item}
                        record={record}
                        metricDefault={metricDefaultsBySearchName?.get(
                            item.searchName
                        )}
                        catalogueLoading={catalogueByName === null}
                        density={density}
                        range={range}
                        refreshToken={refreshToken}
                        index={index}
                        onVisualState={handleVisualState}
                        probeOnly
                    />
                );
            })}
            <SignalRailTicker
                kpis={tickerKpis}
                density={density}
                fontSize={fontSize}
                rows={config.rows}
                durationSeconds={durationSeconds}
                onOpenEditor={onOpenEditor}
            />
        </>
    );
};

interface SignalTickerEditorProps {
    open: boolean;
    config: SignalTickerConfig;
    catalogue: SearchbaseRecord[];
    metricDefaultsBySearchName?: Map<string, SignalTickerMetricDefaults>;
    catalogueLoading: boolean;
    range: TimeRange;
    includeHiddenSearches?: boolean;
    includeDrilldownSearches?: boolean;
    includeTableSearches?: boolean;
    onIncludeHiddenSearchesChange?: (includeHidden: boolean) => void;
    onIncludeDrilldownSearchesChange?: (includeDrilldowns: boolean) => void;
    onIncludeTableSearchesChange?: (includeTables: boolean) => void;
    onChange: (config: SignalTickerConfig) => void;
    onReset: () => void;
    isWorkspaceDefault?: boolean;
    persistenceStatus?: SignalTickerPersistenceStatus;
    persistenceError?: string;
    onClose: () => void;
}

const DENSITY_LABELS: Record<SignalTickerDensity, string> = {
    compact: 'Compact',
    comfortable: 'Comfortable',
};

const FONT_SIZE_LABELS: Record<SignalTickerFontSize, string> = {
    small: 'Small',
    standard: 'Standard',
    large: 'Large',
};

const nextFontSize = (current: SignalTickerFontSize): SignalTickerFontSize => {
    if (current === 'small') return 'standard';
    if (current === 'standard') return 'large';
    return 'small';
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
    range,
    includeHiddenSearches = false,
    includeDrilldownSearches = false,
    includeTableSearches = false,
    onIncludeHiddenSearchesChange,
    onIncludeDrilldownSearchesChange,
    onIncludeTableSearchesChange,
    onChange,
    onReset,
    isWorkspaceDefault = false,
    persistenceStatus = 'account',
    persistenceError,
    onClose,
}) => {
    const [query, setQuery] = useState('');
    const [selectedApp, setSelectedApp] = useState(ALL_APPS);
    const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORIES);
    const [selectedSubCategory, setSelectedSubCategory] =
        useState(ALL_SUB_CATEGORIES);
    const [activeTags, setActiveTags] = useState<Set<string>>(() => new Set());
    const [tagFilter, setTagFilter] = useState('');
    const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [expandedDescriptionId, setExpandedDescriptionId] = useState<
        string | null
    >(null);
    const tagSelectRef = useRef<HTMLDivElement | null>(null);
    const tagInputRef = useRef<HTMLInputElement | null>(null);
    const selectedNames = useMemo(
        () => new Set(config.items.map((item) => item.searchName)),
        [config.items]
    );
    // Keep every facet aligned with the visibility controls. The catalogue can
    // briefly retain hidden entries while an async refresh is in flight, so
    // applying this locally prevents an app with zero eligible searches from
    // appearing in the App selector.
    const drilldownSearchNames = useMemo(
        () =>
            new Set(
                catalogue
                    .flatMap((entry) => entry.drilldownSearchNames ?? [])
                    .map((name) => name.trim().toLowerCase())
                    .filter((name): name is string => Boolean(name))
            ),
        [catalogue]
    );
    const visibilityCatalogue = useMemo(
        () =>
            catalogue.filter((entry) => {
                if (!includeHiddenSearches && entry.searchHidden) return false;
                const key = entry.searchName.trim().toLowerCase();
                const id = entry.id.trim().toLowerCase();
                if (
                    !includeDrilldownSearches &&
                    (drilldownSearchNames.has(key) || drilldownSearchNames.has(id))
                ) {
                    return false;
                }
                return includeTableSearches || entry.defaultViz !== 'splunk.table';
            }),
        [
            catalogue,
            drilldownSearchNames,
            includeDrilldownSearches,
            includeHiddenSearches,
            includeTableSearches,
        ]
    );
    const apps = useMemo(() => {
        const set = new Set<string>();
        for (const entry of visibilityCatalogue) {
            if (entry.catalogueApp) set.add(entry.catalogueApp);
        }
        return Array.from(set).sort((a, b) =>
            a.localeCompare(b, undefined, { sensitivity: 'base' })
        );
    }, [visibilityCatalogue]);
    useEffect(() => {
        if (selectedApp !== ALL_APPS && !apps.includes(selectedApp)) {
            setSelectedApp(ALL_APPS);
        }
    }, [apps, selectedApp]);
    const categories = useMemo(() => {
        const set = new Set<string>();
        for (const entry of visibilityCatalogue) {
            if (
                selectedApp !== ALL_APPS &&
                entry.catalogueApp !== selectedApp
            ) {
                continue;
            }
            if (entry.category) set.add(entry.category);
        }
        return Array.from(set).sort((a, b) =>
            a.localeCompare(b, undefined, { sensitivity: 'base' })
        );
    }, [visibilityCatalogue, selectedApp]);
    const subCategories = useMemo(() => {
        if (selectedCategory === ALL_CATEGORIES) return [];
        const set = new Set<string>();
        for (const entry of visibilityCatalogue) {
            if (
                selectedApp !== ALL_APPS &&
                entry.catalogueApp !== selectedApp
            ) {
                continue;
            }
            if (entry.category !== selectedCategory) continue;
            if (entry.subCategory) set.add(entry.subCategory);
        }
        return Array.from(set).sort((a, b) =>
            a.localeCompare(b, undefined, { sensitivity: 'base' })
        );
    }, [visibilityCatalogue, selectedApp, selectedCategory]);
    const tagFacetEntries = useMemo(() => {
        const q = query.trim().toLowerCase();
        return visibilityCatalogue.filter((entry) => {
            if (
                selectedApp !== ALL_APPS &&
                entry.catalogueApp !== selectedApp
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
        visibilityCatalogue,
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
        (selectedApp !== ALL_APPS ? 1 : 0) +
        (includeHiddenSearches ? 1 : 0) +
        (includeDrilldownSearches ? 1 : 0) +
        (includeTableSearches ? 1 : 0) +
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

    useEffect(() => {
        if (!open) return undefined;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            onClose();
        };
        document.addEventListener('keydown', onKeyDown, true);
        return () => document.removeEventListener('keydown', onKeyDown, true);
    }, [open, onClose]);

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
        setSelectedApp(ALL_APPS);
        onIncludeHiddenSearchesChange?.(false);
        onIncludeDrilldownSearchesChange?.(false);
        onIncludeTableSearchesChange?.(false);
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

    const persistenceCopy: Record<SignalTickerPersistenceStatus, string> = {
        loading: 'Loading your private workspace preferences…',
        saving: 'Saving privately to your Splunk account…',
        account: 'Private to your Splunk account and this workspace',
        browser: 'Browser-only fallback — account storage is unavailable',
    };

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
            className="fixed inset-0 z-[1800] flex items-center justify-center sui-bg-page p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label="Signal rail editor"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <div className="flex max-h-[86vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border   shadow-2xl sui-border-weak sui-bg-page">
                <div className="flex items-start justify-between gap-4 border-b  px-5 py-4 sui-border-weak">
                    <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg sui-bg-accent sui-color-active shadow-sm">
                            <Sparkles className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-lg font-black leading-tight  sui-color-active">
                                Signal Rail
                            </h3>
                            <p className="mt-1 text-sm  sui-color-default">
                                Pick the KPIs that should move through the executive view.
                            </p>
                            <p
                                className={cn(
                                    'mt-1 text-xs font-semibold',
                                    persistenceStatus === 'browser'
                                        ? 'sui-color-warning'
                                        : 'sui-color-positive'
                                )}
                                aria-live="polite"
                                title={persistenceError}
                            >
                                {persistenceCopy[persistenceStatus]}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-2  transition-colors   focus:outline-none focus-visible:ring-2 sui-focus-visible-ring sui-color-default sui-hover-bg-section sui-hover-color-active"
                        aria-label="Close signal rail editor"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-hidden lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                    <section className="min-h-0 overflow-y-auto border-b  p-4 sui-border-weak lg:border-b-0 lg:border-r">
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                            <button
                                type="button"
                                onClick={() =>
                                    updateConfig({ enabled: !config.enabled })
                                }
                                aria-pressed={config.enabled}
                                className={cn(
                                    'rounded-lg border px-3 py-2 text-left transition-colors focus:outline-none focus-visible:ring-2 sui-focus-visible-ring',
                                    config.enabled
                                        ? 'sui-border-interactive sui-bg-selected sui-color-active'
                                        : 'sui-border-weak sui-bg-section sui-color-default'
                                )}
                            >
                                <span className="block text-xs font-black uppercase tracking-[0.16em]">
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
                                className="rounded-lg border   px-3 py-2 text-left  transition-colors  focus:outline-none focus-visible:ring-2 sui-focus-visible-ring sui-border-weak sui-bg-section sui-color-active sui-hover-bg-overlay"
                            >
                                <span className="block text-xs font-black uppercase tracking-[0.16em] sui-color-default">
                                    Density
                                </span>
                                <span className="mt-1 block text-sm font-bold">
                                    {DENSITY_LABELS[config.density ?? 'comfortable']}
                                </span>
                            </button>
                            <button
                                type="button"
                                onClick={() =>
                                    updateConfig({
                                        fontSize: nextFontSize(
                                            config.fontSize ?? 'standard'
                                        ),
                                    })
                                }
                                className="rounded-lg border   px-3 py-2 text-left  transition-colors  focus:outline-none focus-visible:ring-2 sui-focus-visible-ring sui-border-weak sui-bg-section sui-color-active sui-hover-bg-overlay"
                                title="Cycle Signal Rail tile font size"
                            >
                                <span className="block text-xs font-black uppercase tracking-[0.16em] sui-color-default">
                                    Font size
                                </span>
                                <span className="mt-1 block text-sm font-bold">
                                    {FONT_SIZE_LABELS[config.fontSize ?? 'standard']}
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
                                className="rounded-lg border   px-3 py-2 text-left  transition-colors  focus:outline-none focus-visible:ring-2 sui-focus-visible-ring sui-border-weak sui-bg-section sui-color-active sui-hover-bg-overlay"
                            >
                                <span className="block text-xs font-black uppercase tracking-[0.16em] sui-color-default">
                                    Rows
                                </span>
                                <span className="mt-1 block text-sm font-bold">
                                    {config.rows === 1 ? 'One row' : 'Two rows'}
                                </span>
                            </button>
                            <button
                                type="button"
                                onClick={() =>
                                    updateConfig({
                                        showPriorityDrilldown:
                                            !config.showPriorityDrilldown,
                                    })
                                }
                                aria-pressed={config.showPriorityDrilldown}
                                className={cn(
                                    'rounded-lg border px-3 py-2 text-left transition-colors focus:outline-none focus-visible:ring-2 sui-focus-visible-ring',
                                    config.showPriorityDrilldown
                                        ? 'sui-border-interactive sui-bg-selected sui-color-active'
                                        : 'sui-border-weak sui-bg-section sui-color-default'
                                )}
                                title="Show or hide the Priority Drill-Down row below the Signal Rail"
                            >
                                <span className="block text-xs font-black uppercase tracking-[0.16em]">
                                    Drill-down
                                </span>
                                <span className="mt-1 block text-sm font-bold">
                                    {config.showPriorityDrilldown
                                        ? 'Shown'
                                        : 'Hidden'}
                                </span>
                            </button>
                        </div>

                        <div className="mt-4">
                            <div className="flex items-center justify-between gap-3">
                                <span
                                    id="signal-rail-speed-label"
                                    className="text-xs font-black uppercase tracking-[0.16em] sui-color-default"
                                >
                                    Legacy ticker speed
                                </span>
                                <span className="rounded-full  px-2 py-0.5 text-xs font-black uppercase tracking-[0.12em]  sui-bg-section sui-color-default">
                                    {config.speed === 0
                                        ? 'Static'
                                        : `${(config.speed / NORMAL_SIGNAL_TICKER_SPEED)
                                              .toFixed(2)
                                              .replace(/\.00$/, '')
                                              .replace(/0$/, '')}×`}
                                </span>
                            </div>
                            <div className="mt-3 rounded-lg border   px-3 py-2.5 sui-border-weak sui-bg-page">
                                <Slider
                                    inputId="signal-rail-speed"
                                    labelledBy="signal-rail-speed-label"
                                    min={MIN_SIGNAL_TICKER_SPEED}
                                    max={MAX_SIGNAL_TICKER_SPEED}
                                    step={SIGNAL_TICKER_SPEED_STEP}
                                    stepMarks="always"
                                    value={config.speed}
                                    displayValue={
                                        config.speed === 0
                                            ? 'Static'
                                            : `${(config.speed / NORMAL_SIGNAL_TICKER_SPEED)
                                                  .toFixed(2)
                                                  .replace(/\.00$/, '')
                                                  .replace(/0$/, '')}×`
                                    }
                                    minLabel="Static"
                                    maxLabel="2×"
                                    onChange={(_event, { value }) =>
                                        updateConfig({
                                            speed: value,
                                        })
                                    }
                                />
                                <p className="mt-2 text-xs leading-snug  sui-color-muted">
                                    The 1CD glass status cards remain static. This speed applies only to optional legacy ticker styles.
                                </p>
                            </div>
                        </div>

                        <div className="mt-5 flex items-center justify-between gap-3">
                            <h4 className="text-xs font-black uppercase tracking-[0.16em] sui-color-default">
                                Selected KPIs
                            </h4>
                            <span className="rounded-full  px-2 py-0.5 text-xs font-bold  sui-bg-section sui-color-default">
                                {config.items.length}/24
                            </span>
                        </div>
                        <div className="mt-2 space-y-2">
                            {config.items.length === 0 && (
                                <div className="rounded-lg border border-dashed  p-4 text-sm  sui-border-default sui-color-default">
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
                                        className="rounded-lg border   p-2 sui-border-weak sui-bg-section"
                                    >
                                        <div className="flex items-center gap-2">
                                            <GripVertical className="h-4 w-4 shrink-0  sui-color-default" />
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
                                                className="min-w-0 flex-1 rounded border   px-2 py-1 text-xs font-bold  outline-none sui-focus-border-info focus:ring-1 sui-focus-ring sui-border-default sui-bg-page sui-color-active"
                                                aria-label={`Ticker label for ${item.searchName}`}
                                            />
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    moveItem(item.id, -1)
                                                }
                                                disabled={idx === 0}
                                                className="rounded p-1.5 sui-color-muted transition-colors   disabled:opacity-30 sui-hover-bg-overlay sui-hover-color-active"
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
                                                className="rounded p-1.5 sui-color-muted transition-colors   disabled:opacity-30 sui-hover-bg-overlay sui-hover-color-active"
                                                title="Move down"
                                            >
                                                <ArrowDown className="h-3.5 w-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    removeItem(item.id)
                                                }
                                                className="rounded p-1.5 sui-color-negative transition-colors  sui-hover-bg-negative"
                                                title="Remove KPI"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                        <p className="mt-1 truncate pl-6 text-xs font-semibold sui-color-default">
                                            {item.searchName}
                                        </p>
                                        <div className="mt-2 grid grid-cols-2 gap-2 pl-6">
                                            <label className="block">
                                                <span className="block text-xs font-black uppercase tracking-[0.14em] sui-color-default">
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
                                                    className="mt-1 w-full rounded border   px-2 py-1 text-xs font-semibold  outline-none sui-focus-border-info focus:ring-1 sui-focus-ring sui-border-default sui-bg-page sui-color-active"
                                                />
                                            </label>
                                            <label className="block">
                                                <span className="block text-xs font-black uppercase tracking-[0.14em] sui-color-default">
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
                                                    className="mt-1 w-full rounded border   px-2 py-1 text-xs font-semibold  outline-none sui-focus-border-info focus:ring-1 sui-focus-ring sui-border-default sui-bg-page sui-color-active"
                                                />
                                            </label>
                                        </div>
                                        <div className="mt-2 grid grid-cols-3 gap-2 pl-6">
                                            <label className="block">
                                                <span className="block text-xs font-black uppercase tracking-[0.14em] sui-color-default">
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
                                                    className="mt-1 w-full rounded border   px-2 py-1 text-xs font-semibold  outline-none sui-focus-border-info focus:ring-1 sui-focus-ring sui-border-default sui-bg-page sui-color-active"
                                                />
                                            </label>
                                            <label className="block">
                                                <span className="block text-xs font-black uppercase tracking-[0.14em] sui-color-default">
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
                                                    className="mt-1 w-full rounded border   px-2 py-1 text-xs font-semibold  outline-none sui-focus-border-info focus:ring-1 sui-focus-ring sui-border-default sui-bg-page sui-color-active"
                                                />
                                            </label>
                                            <label className="block">
                                                <span className="block text-xs font-black uppercase tracking-[0.14em] sui-color-default">
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
                                                    className="mt-1 w-full rounded border   px-2 py-1 text-xs font-semibold  outline-none sui-focus-border-info focus:ring-1 sui-focus-ring sui-border-default sui-bg-page sui-color-active"
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
                                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 sui-color-default" />
                                <input
                                    value={query}
                                    onChange={(event) => setQuery(event.target.value)}
                                    placeholder="Search KPIs by name, category, or tag..."
                                    className="w-full rounded-lg border   py-2 pl-8 pr-3 text-sm  outline-none sui-focus-border-info focus:ring-2 sui-focus-ring sui-border-weak sui-bg-page sui-color-active sui-focus-ring"
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
                                        'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-black uppercase tracking-[0.16em] transition-colors focus:outline-none focus-visible:ring-2 sui-focus-visible-ring',
                                        filtersOpen
                                            ? 'sui-bg-section sui-color-active'
                                            : 'sui-bg-page   sui-bg-section sui-color-default sui-hover-bg-section'
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
                                        <span className="rounded-full sui-bg-accent px-1.5 py-0.5 text-xs sui-color-active">
                                            {activeFilterCount}
                                        </span>
                                    )}
                                </button>
                                {activeFilterCount > 0 && (
                                    <button
                                        type="button"
                                        onClick={clearFilters}
                                        className="text-xs font-bold  transition-colors  sui-color-muted sui-hover-color-info"
                                    >
                                        Clear filters
                                    </button>
                                )}
                            </div>

                            {filtersOpen && (
                                <div className="space-y-3 rounded-lg border   p-3 sui-border-weak sui-bg-section">
                                    <label className="grid gap-1 sm:grid-cols-[90px_minmax(0,1fr)] sm:items-center">
                                        <span
                                            className="text-xs font-black uppercase tracking-[0.18em] sui-color-default"
                                            title="Splunk app the search belongs to"
                                        >
                                            App
                                        </span>
                                        <select
                                            value={selectedApp}
                                            onChange={(event) =>
                                                setSelectedApp(event.target.value)
                                            }
                                            className="w-full rounded-lg border   px-3 py-2 text-sm font-semibold  outline-none sui-focus-border-info focus:ring-2 sui-focus-ring sui-border-weak sui-bg-page sui-color-active sui-focus-ring"
                                        >
                                            <option value={ALL_APPS}>
                                                All apps ({apps.length})
                                            </option>
                                            {apps.map((app) => (
                                                <option key={app} value={app}>
                                                    {app}
                                                </option>
                                            ))}
                                        </select>
                                    </label>

                                    <div className="grid gap-1 sm:grid-cols-[90px_minmax(0,1fr)] sm:items-start">
                                        <span className="text-xs font-black uppercase tracking-[0.18em] sui-color-default">
                                            Visibility
                                        </span>
                                        <div className="grid gap-2 md:grid-cols-3">
                                            <label className="flex items-center gap-2 rounded-lg border   px-3 py-2 text-sm font-semibold  sui-border-weak sui-bg-page sui-color-active">
                                                <input
                                                    type="checkbox"
                                                    checked={includeHiddenSearches}
                                                    onChange={(event) =>
                                                        onIncludeHiddenSearchesChange?.(
                                                            event.target.checked
                                                        )
                                                    }
                                                    className="h-4 w-4 rounded  sui-color-info sui-focus-ring sui-border-default sui-bg-section"
                                                />
                                                <span>Show hidden searches</span>
                                            </label>
                                            <label className="flex items-center gap-2 rounded-lg border   px-3 py-2 text-sm font-semibold  sui-border-weak sui-bg-page sui-color-active">
                                                <input
                                                    type="checkbox"
                                                    checked={includeDrilldownSearches}
                                                    onChange={(event) =>
                                                        onIncludeDrilldownSearchesChange?.(
                                                            event.target.checked
                                                        )
                                                    }
                                                    className="h-4 w-4 rounded  sui-color-info sui-focus-ring sui-border-default sui-bg-section"
                                                />
                                                <span>Show drill-down searches</span>
                                            </label>
                                            <label className="flex items-center gap-2 rounded-lg border   px-3 py-2 text-sm font-semibold  sui-border-weak sui-bg-page sui-color-active">
                                                <input
                                                    type="checkbox"
                                                    checked={includeTableSearches}
                                                    onChange={(event) =>
                                                        onIncludeTableSearchesChange?.(
                                                            event.target.checked
                                                        )
                                                    }
                                                    className="h-4 w-4 rounded  sui-color-info sui-focus-ring sui-border-default sui-bg-section"
                                                />
                                                <span>Show table searches</span>
                                            </label>
                                        </div>
                                    </div>

                                    {categories.length > 0 && (
                                        <label className="grid gap-1 sm:grid-cols-[90px_minmax(0,1fr)] sm:items-center">
                                            <span className="text-xs font-black uppercase tracking-[0.18em] sui-color-default">
                                                Category
                                            </span>
                                            <select
                                                value={selectedCategory}
                                                onChange={(event) =>
                                                    setSelectedCategory(
                                                        event.target.value
                                                    )
                                                }
                                                className="w-full rounded-lg border   px-3 py-2 text-sm font-semibold  outline-none sui-focus-border-info focus:ring-2 sui-focus-ring sui-border-weak sui-bg-page sui-color-active sui-focus-ring"
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
                                                <span className="text-xs font-black uppercase tracking-[0.18em] sui-color-default">
                                                    Sub-cat
                                                </span>
                                                <select
                                                    value={selectedSubCategory}
                                                    onChange={(event) =>
                                                        setSelectedSubCategory(
                                                            event.target.value
                                                        )
                                                    }
                                                    className="w-full rounded-lg border   px-3 py-2 text-sm font-semibold  outline-none sui-focus-border-info focus:ring-2 sui-focus-ring sui-border-weak sui-bg-page sui-color-active sui-focus-ring"
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
                                            <span className="pt-2 text-xs font-black uppercase tracking-[0.18em] sui-color-default">
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
                                                        'flex min-h-[42px] cursor-text flex-wrap items-center gap-1 rounded-lg border  px-2 py-1.5 transition-shadow sui-bg-page',
                                                        tagDropdownOpen
                                                            ? 'sui-border-info ring-2 sui-focus-ring'
                                                            : 'sui-border-weak'
                                                    )}
                                                >
                                                    <Tag className="ml-0.5 h-3.5 w-3.5 shrink-0 sui-color-default" />
                                                    {Array.from(activeTags).map(
                                                        (tag) => {
                                                            const count =
                                                                tagCountByName.get(
                                                                    tag
                                                                ) ?? 0;
                                                            return (
                                                                <span
                                                                    key={tag}
                                                                    className="inline-flex items-center gap-1 rounded-full sui-bg-accent py-0.5 pl-2 pr-1 text-xs font-bold uppercase tracking-wide sui-color-active"
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
                                                                        className="rounded-full p-0.5 sui-hover-bg-accent"
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
                                                        className="min-w-[120px] flex-1 border-0 sui-bg-transparent py-1 text-sm  outline-none  sui-color-active"
                                                    />
                                                </div>

                                                {tagDropdownOpen && (
                                                    <div
                                                        role="listbox"
                                                        aria-label="Available tags"
                                                        className="absolute left-0 right-0 top-full z-[1900] mt-1 max-h-56 overflow-auto rounded-lg border   shadow-xl sui-border-weak sui-bg-section"
                                                    >
                                                        {tagDropdownOptions.length ===
                                                        0 ? (
                                                            <p className="px-3 py-2 text-xs italic  sui-color-muted">
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
                                                                            className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs transition-colors   focus:outline-none sui-hover-bg-info sui-focus-bg-info"
                                                                        >
                                                                            <span className="flex min-w-0 items-center gap-1.5 truncate  sui-color-active">
                                                                                <Tag className="h-3 w-3 shrink-0 sui-color-default" />
                                                                                <span className="truncate">
                                                                                    {
                                                                                        tag
                                                                                    }
                                                                                </span>
                                                                            </span>
                                                                            <span className="shrink-0 text-xs font-bold  sui-color-muted">
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
                                                                        <p className="border-t  px-3 py-1.5 text-xs  sui-border-weak sui-color-muted">
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
                                <div className="rounded-lg border  p-4 text-sm  sui-border-weak sui-color-default">
                                    Loading searchbase catalogue...
                                </div>
                            )}
                            {!catalogueLoading &&
                                filteredCatalogue.map((entry) => {
                                    const selected = selectedNames.has(
                                        entry.searchName
                                    );
                                    const searchDescription =
                                        plainTextFromHtml(
                                            entry.description ||
                                                entry.explanation
                                        ) || 'No description supplied.';
                                    const descriptionExpanded =
                                        expandedDescriptionId === entry.id;
                                    const descriptionId = `signal-rail-search-description-${entry.id.replace(
                                        /[^A-Za-z0-9_-]/g,
                                        '-'
                                    )}`;
                                    const searchHref = entry.search?.trim()
                                        ? splunkSearchAppUrl(
                                              entry.search,
                                              range,
                                              entry.dispatchContext
                                          )
                                        : undefined;
                                    return (
                                        <div
                                            key={entry.id}
                                            className={cn(
                                                'rounded-lg border p-3 transition-colors',
                                                selected
                                                    ? 'sui-border-interactive sui-bg-selected'
                                                    : 'sui-border-weak sui-bg-page sui-hover-border-info'
                                            )}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <h5 className="truncate text-sm font-black  sui-color-active">
                                                        {entry.searchName}
                                                    </h5>
                                                    <p className="mt-0.5 text-xs font-semibold sui-color-default">
                                                        {entry.category}
                                                        {entry.subCategory
                                                            ? ` / ${entry.subCategory}`
                                                            : ''}
                                                    </p>
                                                </div>
                                                <div className="flex shrink-0 items-center gap-1.5">
                                                    <button
                                                        type="button"
                                                        aria-label={`Show description for ${entry.searchName}`}
                                                        aria-controls={descriptionId}
                                                        aria-expanded={descriptionExpanded}
                                                        title="Show search description"
                                                        onClick={() =>
                                                            setExpandedDescriptionId(
                                                                descriptionExpanded
                                                                    ? null
                                                                    : entry.id
                                                            )
                                                        }
                                                        className={cn(
                                                            'inline-flex h-8 w-8 items-center justify-center rounded-lg border  transition-colors focus:outline-none focus-visible:ring-2 sui-focus-visible-ring sui-color-default',
                                                            descriptionExpanded
                                                                ? 'sui-border-interactive sui-bg-selected sui-color-active'
                                                                : 'sui-border-weak sui-bg-page sui-hover-border-info sui-hover-bg-info sui-hover-color-info'
                                                        )}
                                                    >
                                                        <Info className="h-3.5 w-3.5" />
                                                    </button>
                                                    {searchHref ? (
                                                        <a
                                                            href={searchHref}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            aria-label={`Open ${entry.searchName} in Search`}
                                                            title={`Open ${entry.searchName} in Search`}
                                                            className="inline-flex items-center gap-1 rounded-lg border   px-2.5 py-1.5 text-xs font-black uppercase tracking-wide  transition-colors    focus:outline-none focus-visible:ring-2 sui-focus-visible-ring sui-border-weak sui-bg-page sui-color-default sui-hover-border-info sui-hover-bg-info sui-hover-color-info"
                                                        >
                                                            <ExternalLink className="h-3.5 w-3.5" />
                                                            Open
                                                        </a>
                                                    ) : (
                                                        <span
                                                            aria-label={`No search available for ${entry.searchName}`}
                                                            title="No SPL available"
                                                            className="inline-flex cursor-not-allowed items-center gap-1 rounded-lg border   px-2.5 py-1.5 text-xs font-black uppercase tracking-wide  sui-border-weak sui-bg-section sui-color-default"
                                                        >
                                                            <ExternalLink className="h-3.5 w-3.5" />
                                                            Open
                                                        </span>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => addEntry(entry)}
                                                        disabled={selected}
                                                        className={cn(
                                                            'inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-black uppercase tracking-wide transition-colors focus:outline-none focus-visible:ring-2 sui-focus-visible-ring',
                                                            selected
                                                                ? 'sui-bg-section sui-color-default'
                                                                : 'sui-bg-accent sui-color-active sui-hover-bg-accent'
                                                        )}
                                                    >
                                                        <Plus className="h-3.5 w-3.5" />
                                                        {selected ? 'Added' : 'Add'}
                                                    </button>
                                                </div>
                                            </div>
                                            {descriptionExpanded && (
                                                <div
                                                    id={descriptionId}
                                                    className="mt-3 rounded-lg border px-3 py-2 text-xs leading-relaxed sui-border-interactive sui-bg-selected sui-color-default"
                                                >
                                                    {searchDescription}
                                                </div>
                                            )}
                                            {entry.tags.length > 0 && (
                                                <div className="mt-2 flex flex-wrap gap-1">
                                                    {entry.tags.slice(0, 5).map((tag) => (
                                                        <span
                                                            key={tag}
                                                            className="rounded-full  px-2 py-0.5 text-xs font-semibold  sui-bg-section sui-color-default"
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
                                <div className="rounded-lg border border-dashed  p-4 text-sm  sui-border-default sui-color-default">
                                    No matching KPIs. Clear filters or try a broader term.
                                </div>
                            )}
                        </div>
                    </section>
                </div>

                <div className="flex items-center justify-between gap-3 border-t  px-5 py-3 sui-border-weak">
                    <Button
                        onClick={onReset}
                        disabled={isWorkspaceDefault}
                        appearance={
                            isWorkspaceDefault
                                ? 'secondary'
                                : 'destructiveSecondary'
                        }
                        icon={
                            isWorkspaceDefault ? (
                                <Check className="h-4 w-4 sui-color-positive" />
                            ) : (
                                <RotateCcw className="h-4 w-4" />
                            )
                        }
                        label={
                            isWorkspaceDefault
                                ? 'Using workspace default'
                                : 'Restore workspace default'
                        }
                    />
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg sui-bg-accent px-4 py-2 text-sm font-black sui-color-active shadow-sm transition-colors sui-hover-bg-accent focus:outline-none focus-visible:ring-2 sui-focus-visible-ring"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
};
