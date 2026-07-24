import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    AlertCircle,
    Check,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Copy,
    ExternalLink,
    Gauge,
    Maximize2,
    Minimize2,
    MonitorSmartphone,
    Moon,
    MoreVertical,
    PanelRightOpen,
    Play,
    Plus,
    Presentation,
    RefreshCw,
    Save,
    Search,
    Settings2,
    SlidersHorizontal,
    Square,
    Sun,
    Table2,
    Trash2,
    X,
} from 'lucide-react';
import {
    DndContext,
    KeyboardSensor,
    PointerSensor,
    closestCenter,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core';
import {
    SortableContext,
    arrayMove,
    rectSortingStrategy,
    sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { BarBreakdownTile } from '@/common/components/florida/BarBreakdownTile';
import {
    resolveBaselineField,
    resolveDeltaField,
    resolveOverlayLabel,
    resolveSparkDataField,
    resolveValueField,
} from '@/common/components/florida/canvasVizOptions';
import {
    isFillerGaugeViz,
    isMarkerGaugeViz,
    isPieViz,
    isSingleValueRadialViz,
} from '@/common/components/florida/canvasVizPredicates';
import { FillerGaugeTile } from '@/common/components/florida/FillerGaugeTile';
import { MarkerGaugeTile } from '@/common/components/florida/MarkerGaugeTile';
import { MetricItem } from '@/common/components/florida/MetricItem';
import { PieTile } from '@/common/components/florida/PieTile';
import { SingleValueRadialTile } from '@/common/components/florida/SingleValueRadialTile';
import { SortableMetricCard } from '@/common/components/florida/SortableMetricCard';
import { TableTile } from '@/common/components/florida/TableTile';
import { InfoTooltip } from '@/common/components/florida/InfoTooltip';
import { SplPreviewTooltip } from '@/common/components/florida/SplPreviewTooltip';
import {
    normalizeDataValuesDisplay,
    sparklineVizTypeFromSplunkViz,
} from '@/common/components/florida/Sparkline';
import { useTheme } from '@/common/hooks/useTheme';
import {
    isBarBreakdownViz,
    isTableViz,
    useMetric,
    useTableData,
    type MetricResult,
    type MetricConfig,
    type NoDataReason,
    type TableDataResult,
    type TimeRange,
} from '@/common/hooks/useMetric';
import {
    openSplunkSearch,
    splunkSearchAppUrl,
} from '@/common/lib/splunkSearchUrl';
import { cn } from '@/common/lib/utils';
import {
    classifySearchDispatchError,
    runSearch,
} from '@/common/services/splunkSearchService';
import {
    deleteSearchbaseCanvas,
    listSearchbaseCanvases,
    loadSearchbaseCanvas,
    saveSearchbaseCanvas,
    type SavedSearchbaseCanvasPayload,
    type SearchbaseCanvasSummary,
} from '@/common/services/searchbaseCanvasPersistenceService';
import {
    getSearchbaseCatalogue,
    plainTextFromHtml,
    type SearchbaseRecord,
} from '@/common/services/searchbaseCatalogue';
import { recordMatchesCatalogueQuery } from './catalogueSearch';

const APP_NAME = 'splunk-cisco-dashboards';
const STORAGE_KEY = 'scd_searchbase_canvas_v1';
const MAX_BATCH_RUNS = 10;

const isCanvasDebug = (): boolean => {
    if (typeof window === 'undefined') return false;
    try {
        if (window.localStorage.getItem('searchbase.canvas.debug') === '1') {
            return true;
        }
        return new URLSearchParams(window.location.search).get('canvasDebug') === '1';
    } catch {
        return false;
    }
};

/** Gated console debug for Searchbase Canvas (localStorage or ?canvasDebug=1). */
const canvasDebug = (...args: unknown[]): void => {
    if (!isCanvasDebug()) return;
    // eslint-disable-next-line no-console
    console.debug(...args);
};

const TIME_RANGE_OPTIONS: TimeRange[] = [
    { earliest: '-4h@h', latest: 'now', label: 'Last 4 hours', spanSeconds: 4 * 3600 },
    { earliest: '-24h@h', latest: 'now', label: 'Last 24 hours', spanSeconds: 24 * 3600 },
    { earliest: '-7d@d', latest: 'now', label: 'Last 7 days', spanSeconds: 7 * 86400 },
    { earliest: '-30d@d', latest: 'now', label: 'Last 30 days', spanSeconds: 30 * 86400 },
    { earliest: '-90d@d', latest: 'now', label: 'Last 90 days', spanSeconds: 90 * 86400 },
];
const DEFAULT_TIME_RANGE_LABEL = 'Last 24 hours';
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
const DEFAULT_TILE_VIZ = '__default_tile_viz__';
const DEFAULT_OVERLAY_FIELD = '__default_overlay_field__';
const NO_OVERLAY_FIELD = '__no_overlay_field__';
const SPL_PREVIEW_FONT_SCALE = 1.18;

const clampNumber = (value: number, min: number, max: number): number =>
    Math.min(max, Math.max(min, value));

type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];
type TileSpan = 1 | 2 | 4;
type TileResultFilter = 'all' | 'needs_attention' | 'working';
type TileResultStatus = 'needs_attention' | 'working' | 'unobserved';
type CachedTileResult = MetricResult | TableDataResult;

const TILE_RESULT_FILTER_OPTIONS: Array<{
    value: TileResultFilter;
    label: string;
    title: string;
}> = [
    {
        value: 'all',
        label: 'All',
        title: 'Show all canvas tiles',
    },
    {
        value: 'needs_attention',
        label: 'Needs attention',
        title: 'Show searches that failed or returned no data',
    },
    {
        value: 'working',
        label: 'Working',
        title: 'Show searches that ran successfully and returned data',
    },
];

interface CanvasTile {
    id: string;
    searchName: string;
    span: TileSpan;
    addedAt: number;
    vizOverride?: string;
    overlayField?: string | null;
}

interface PersistedCanvasState {
    canvasName: string;
    pageSize: PageSize;
    tiles: CanvasTile[];
}

interface ObservedNoDataEntry {
    tileId: string;
    stanzaName: string;
    searchName: string;
    category: string;
    subCategory: string;
    tags: string[];
    description: string;
    search: string;
    reason: NoDataReason;
    rangeLabel: string;
    observedAt: string;
}

type NoDataReportSortKey =
    | 'stanzaName'
    | 'searchName'
    | 'category'
    | 'subCategory'
    | 'tags';
type SortDirection = 'asc' | 'desc';
type NoDataReportResizeAxis = 'width' | 'height' | 'both';

interface NoDataReportResizeDrag {
    axis: NoDataReportResizeAxis;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    horizontalMultiplier: number;
    verticalMultiplier: number;
}

const NO_DATA_REPORT_SORT_COLUMNS: Array<{
    key: NoDataReportSortKey;
    label: string;
    thClassName: string;
}> = [
    { key: 'stanzaName', label: 'stanza_name', thClassName: 'px-5 py-3' },
    { key: 'searchName', label: 'search_name', thClassName: 'px-4 py-3' },
    { key: 'category', label: 'category', thClassName: 'px-4 py-3' },
    { key: 'subCategory', label: 'sub_category', thClassName: 'px-4 py-3' },
    { key: 'tags', label: 'tags', thClassName: 'px-4 py-3' },
];

const TILE_SPAN_CLASS: Record<TileSpan, string> = {
    1: 'md:col-span-1 xl:col-span-1',
    2: 'md:col-span-2 xl:col-span-2',
    4: 'md:col-span-2 xl:col-span-4',
};

const TILE_SPAN_LABEL: Record<TileSpan, string> = {
    1: 'Compact',
    2: 'Wide',
    4: 'Full',
};

const TILE_VIZ_OPTIONS = [
    { value: 'splunk.area', label: 'Area' },
    { value: 'splunk.line', label: 'Line' },
    { value: 'splunk.column', label: 'Column' },
    { value: 'splunk.bar', label: 'Bar' },
    { value: 'splunk.pie', label: 'Pie' },
    { value: 'splunk.table', label: 'Table' },
    { value: 'splunk.singlevalue', label: 'Single value' },
    { value: 'splunk.singlevalueradial', label: 'Single value radial' },
    { value: 'splunk.fillergauge', label: 'Filler gauge' },
    { value: 'splunk.markergauge', label: 'Marker gauge' },
] as const;

const seriesColorsFromVizOptions = (
    options: Record<string, unknown> | undefined
): string[] | undefined => {
    const colors = options?.seriesColors;
    if (!Array.isArray(colors)) return undefined;
    return colors.filter((entry): entry is string => typeof entry === 'string');
};

const isPageSize = (value: unknown): value is PageSize =>
    PAGE_SIZE_OPTIONS.includes(value as PageSize);

const isTileSpan = (value: unknown): value is TileSpan =>
    value === 1 || value === 2 || value === 4;

const clampText = (value: unknown, fallback: string, maxLength = 80): string => {
    if (typeof value !== 'string') return fallback;
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    return trimmed.slice(0, maxLength);
};

const normalizeTileVizOverride = (value: unknown): string | undefined => {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim().toLowerCase();
    if (!trimmed || trimmed === DEFAULT_TILE_VIZ) return undefined;
    if (!trimmed.startsWith('splunk.')) return undefined;
    return trimmed.slice(0, 64);
};

const SAFE_OVERLAY_FIELD_PATTERN = /^[A-Za-z_][A-Za-z0-9_.:]{0,127}$/;

const normalizeTileOverlayField = (value: unknown): string | null | undefined => {
    if (value === null) return null;
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    if (!trimmed || trimmed === DEFAULT_OVERLAY_FIELD) return undefined;
    if (trimmed === NO_OVERLAY_FIELD) return null;
    return SAFE_OVERLAY_FIELD_PATTERN.test(trimmed) ? trimmed : undefined;
};

const readPersistedState = (): PersistedCanvasState => {
    const fallback: PersistedCanvasState = {
        canvasName: 'Searchbase Canvas',
        pageSize: 25,
        tiles: [],
    };
    if (typeof window === 'undefined') return fallback;
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return fallback;
        const parsed = JSON.parse(raw) as Partial<PersistedCanvasState>;
        const tiles = Array.isArray(parsed.tiles)
            ? parsed.tiles.flatMap((tile): CanvasTile[] => {
                  if (!tile || typeof tile !== 'object') return [];
                  const candidate = tile as Partial<CanvasTile>;
                  if (
                      typeof candidate.id !== 'string' ||
                      typeof candidate.searchName !== 'string'
                  ) {
                      return [];
                  }
                  return [
                      {
                          id: candidate.id,
                          searchName: candidate.searchName,
                          span: isTileSpan(candidate.span) ? candidate.span : 1,
                          addedAt:
                              typeof candidate.addedAt === 'number'
                                  ? candidate.addedAt
                                  : Date.now(),
                          vizOverride: normalizeTileVizOverride(
                              candidate.vizOverride
                          ),
                          overlayField: normalizeTileOverlayField(
                              candidate.overlayField
                          ),
                      },
                  ];
              })
            : [];
        return {
            canvasName: clampText(parsed.canvasName, fallback.canvasName, 96),
            pageSize: isPageSize(parsed.pageSize) ? parsed.pageSize : fallback.pageSize,
            tiles,
        };
    } catch {
        return fallback;
    }
};

const persistState = (state: PersistedCanvasState): void => {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
        // localStorage is best-effort inside Splunk Web.
    }
};

const canvasPayloadFromState = (
    canvasName: string,
    pageSize: PageSize,
    rangeLabel: string,
    tiles: CanvasTile[]
): SavedSearchbaseCanvasPayload => ({
    version: 1,
    canvasName: clampText(canvasName, 'Searchbase Canvas', 96),
    pageSize,
    rangeLabel,
    tiles: tiles.map((tile) => ({
        id: tile.id,
        searchName: tile.searchName,
        span: tile.span,
        addedAt: tile.addedAt,
        vizOverride: normalizeTileVizOverride(tile.vizOverride),
        overlayField: normalizeTileOverlayField(tile.overlayField),
    })),
});

const applyCanvasPayload = (
    payload: SavedSearchbaseCanvasPayload
): PersistedCanvasState & { rangeLabel: string } => ({
    canvasName: clampText(payload.canvasName, 'Searchbase Canvas', 96),
    pageSize: isPageSize(payload.pageSize) ? payload.pageSize : 25,
    rangeLabel:
        TIME_RANGE_OPTIONS.some((option) => option.label === payload.rangeLabel)
            ? payload.rangeLabel
            : DEFAULT_TIME_RANGE_LABEL,
    tiles: Array.isArray(payload.tiles)
        ? payload.tiles.flatMap((tile): CanvasTile[] => {
              if (!tile || typeof tile !== 'object') return [];
              const candidate = tile as Partial<CanvasTile>;
              if (
                  typeof candidate.id !== 'string' ||
                  typeof candidate.searchName !== 'string'
              ) {
                  return [];
              }
              return [
                  {
                      id: candidate.id,
                      searchName: candidate.searchName,
                      span: isTileSpan(candidate.span) ? candidate.span : 1,
                      addedAt:
                          typeof candidate.addedAt === 'number'
                              ? candidate.addedAt
                              : Date.now(),
                      vizOverride: normalizeTileVizOverride(candidate.vizOverride),
                      overlayField: normalizeTileOverlayField(
                          candidate.overlayField
                      ),
                  },
              ];
          })
        : [],
});

const canvasPayloadSignature = (payload: SavedSearchbaseCanvasPayload): string =>
    JSON.stringify(payload);

const hashString = (value: string): number => {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
        hash ^= value.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return Math.abs(hash >>> 0);
};

const createTile = (searchName: string, span: TileSpan = 1): CanvasTile => ({
    id: `tile_${Date.now().toString(36)}_${Math.random()
        .toString(36)
        .slice(2, 8)}`,
    searchName,
    span,
    addedAt: Date.now(),
});

const cycleTileSpan = (span: TileSpan): TileSpan => {
    if (span === 1) return 2;
    if (span === 2) return 4;
    return 1;
};

const firstSeriesColor = (
    options: Record<string, unknown> | undefined,
    fallback = '#0ea5e9'
): string => {
    const colors = options?.seriesColors;
    if (!Array.isArray(colors)) return fallback;
    const first = colors.find((value) => typeof value === 'string') as
        | string
        | undefined;
    return first && /^#[0-9a-f]{3,8}$/i.test(first.trim()) ? first.trim() : fallback;
};

const formatVizLabel = (viz: string | undefined): string => {
    if (!viz) return 'auto';
    return viz.replace(/^splunk\./i, '');
};

const effectiveTileViz = (
    tile: CanvasTile,
    record: SearchbaseRecord
): string | undefined => tile.vizOverride ?? record.defaultViz;

const supportsTileOverlayControl = (viz: string | undefined): boolean => {
    if (
        isTableViz(viz) ||
        isBarBreakdownViz(viz) ||
        isPieViz(viz) ||
        isSingleValueRadialViz(viz) ||
        isFillerGaugeViz(viz) ||
        isMarkerGaugeViz(viz)
    ) {
        return false;
    }
    return sparklineVizTypeFromSplunkViz(viz) !== 'singlevalue';
};

/** Stable key so metric vs table hook trees remount when viz family changes. */
const searchbaseTileBodyKey = (
    tileId: string,
    viz: string | undefined
): string => {
    if (isTableViz(viz)) return `${tileId}:table`;
    if (isBarBreakdownViz(viz)) return `${tileId}:bar`;
    if (isPieViz(viz)) return `${tileId}:pie`;
    return `${tileId}:metric`;
};

const isTableBackedTileViz = (viz: string | undefined): boolean =>
    isTableViz(viz) || isBarBreakdownViz(viz) || isPieViz(viz);

const tileResultStatusFromResult = (
    result: CachedTileResult | undefined
): TileResultStatus => {
    if (!result || result.source !== 'live') return 'unobserved';
    if (result.noDataReason) return 'needs_attention';
    if ('totalRowCount' in result) {
        return result.totalRowCount > 0 ? 'working' : 'unobserved';
    }
    return Number.isFinite(result.value) ? 'working' : 'unobserved';
};

const TileVizSelect: React.FC<{
    tile: CanvasTile;
    record: SearchbaseRecord;
    onChangeViz: (tileId: string, vizOverride?: string) => void;
}> = ({ tile, record, onChangeViz }) => {
    const defaultLabel = formatVizLabel(record.defaultViz);

    return (
        <label
            className="inline-flex min-w-0 items-center gap-1"
            data-tile-control="true"
            title={`Visualization: ${formatVizLabel(effectiveTileViz(tile, record))}`}
        >
            <Gauge className="h-3.5 w-3.5 flex-shrink-0" />
            <select
                value={tile.vizOverride ?? DEFAULT_TILE_VIZ}
                aria-label={`Visualization for ${record.searchName}`}
                onPointerDown={(event) => event.stopPropagation()}
                onChange={(event) =>
                    onChangeViz(
                        tile.id,
                        event.target.value === DEFAULT_TILE_VIZ
                            ? undefined
                            : event.target.value
                    )
                }
                className="h-6 max-w-[132px] rounded border border-transparent bg-transparent px-1 text-[10px] font-black uppercase text-slate-500 outline-none transition hover:border-slate-300 hover:bg-white focus:border-sky-300 focus:bg-white focus:ring-1 focus:ring-sky-300 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-900 dark:focus:border-sky-700 dark:focus:bg-slate-900 dark:focus:ring-sky-800"
            >
                <option value={DEFAULT_TILE_VIZ}>Default ({defaultLabel})</option>
                {TILE_VIZ_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        </label>
    );
};

const TileOverlaySelect: React.FC<{
    tile: CanvasTile;
    record: SearchbaseRecord;
    overlayFields: string[];
    onChangeOverlay: (tileId: string, overlayField?: string | null) => void;
}> = ({ tile, record, overlayFields, onChangeOverlay }) => {
    const defaultOverlayField = resolveBaselineField(record.vizOptions);
    const selectedOverlayField =
        typeof tile.overlayField === 'string' ? tile.overlayField : undefined;
    const fieldOptions = Array.from(
        new Set(
            [selectedOverlayField, ...overlayFields].filter(
                (field): field is string =>
                    typeof field === 'string' && field.length > 0
            )
        )
    ).filter((field) => field !== defaultOverlayField);

    if (!defaultOverlayField && !selectedOverlayField && fieldOptions.length === 0) {
        return null;
    }

    const selectedValue =
        tile.overlayField === undefined
            ? defaultOverlayField
                ? DEFAULT_OVERLAY_FIELD
                : NO_OVERLAY_FIELD
            : tile.overlayField === null
            ? NO_OVERLAY_FIELD
            : tile.overlayField;

    return (
        <label
            className="inline-flex min-w-0 items-center gap-1"
            data-tile-control="true"
            title="Overlay series"
        >
            <SlidersHorizontal className="h-3.5 w-3.5 flex-shrink-0" />
            <select
                value={selectedValue}
                aria-label={`Overlay series for ${record.searchName}`}
                onPointerDown={(event) => event.stopPropagation()}
                onChange={(event) => {
                    const next = event.target.value;
                    if (next === DEFAULT_OVERLAY_FIELD) {
                        onChangeOverlay(tile.id, undefined);
                        return;
                    }
                    if (next === NO_OVERLAY_FIELD) {
                        onChangeOverlay(tile.id, null);
                        return;
                    }
                    onChangeOverlay(tile.id, next);
                }}
                className="h-6 max-w-[152px] rounded border border-transparent bg-transparent px-1 text-[10px] font-black uppercase text-slate-500 outline-none transition hover:border-slate-300 hover:bg-white focus:border-sky-300 focus:bg-white focus:ring-1 focus:ring-sky-300 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-900 dark:focus:border-sky-700 dark:focus:bg-slate-900 dark:focus:ring-sky-800"
            >
                {defaultOverlayField && (
                    <option value={DEFAULT_OVERLAY_FIELD}>
                        Overlay: default ({defaultOverlayField})
                    </option>
                )}
                <option value={NO_OVERLAY_FIELD}>Overlay: none</option>
                {fieldOptions.map((field) => (
                    <option key={field} value={field}>
                        Overlay: {field}
                    </option>
                ))}
            </select>
        </label>
    );
};

const savedSearchSpl = (name: string): string => {
    const escaped = name.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return `| savedsearch "${escaped}"`;
};

const splunkStringLiteral = (value: string): string => {
    const escaped = value
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\r?\n/g, ' ')
        .slice(0, 1024);
    return `"${escaped}"`;
};

const noDataReasonLabel = (reason: NoDataReason): string => {
    if (reason === 'empty_rows') return '0 rows';
    if (reason === 'dispatch_failed') return 'dispatch failed';
    if (reason === 'job_failed') return 'search job failed';
    if (reason === 'error') return 'search failed';
    if (reason === 'column_missing') return 'configured field missing';
    if (reason === 'no_numeric_column') return 'no numeric value';
    return 'no displayable data';
};

const buildObservedNoDataReportSearch = (
    entries: ObservedNoDataEntry[]
): string => {
    const sorted = [...entries].sort((a, b) =>
        a.stanzaName.localeCompare(b.stanzaName) ||
        a.searchName.localeCompare(b.searchName)
    );
    if (sorted.length === 0) {
        return [
            '| makeresults',
            '| eval message="No observed failed or no-data tiles in the current Searchbase Canvas session."',
            '| table message',
        ].join('\n');
    }

    const caseFor = (field: keyof ObservedNoDataEntry): string =>
        sorted
            .map(
                (entry, index) =>
                    `row=${index + 1},${splunkStringLiteral(String(entry[field]))}`
            )
            .join(',');
    const caseTags = (): string =>
        sorted
            .map(
                (entry, index) =>
                    `row=${index + 1},${splunkStringLiteral(entry.tags.join(', '))}`
            )
            .join(',');

    return [
        `| makeresults count=${sorted.length}`,
        '| streamstats count as row',
        `| eval stanza_name=case(${caseFor('stanzaName')})`,
        `| eval search_name=case(${caseFor('searchName')})`,
        `| eval category=case(${caseFor('category')})`,
        `| eval sub_category=case(${caseFor('subCategory')})`,
        `| eval tags=case(${caseTags()})`,
        `| eval reason=case(${sorted
            .map(
                (entry, index) =>
                    `row=${index + 1},${splunkStringLiteral(
                        noDataReasonLabel(entry.reason)
                    )}`
            )
            .join(',')})`,
        `| eval time_range=case(${caseFor('rangeLabel')})`,
        `| eval observed_at=case(${caseFor('observedAt')})`,
        '| table stanza_name search_name category sub_category tags reason time_range observed_at',
    ].join('\n');
};

const recordPlainText = (record: SearchbaseRecord): string =>
    plainTextFromHtml(record.description).slice(0, 220);

/**
 * Short, single-line "what does this measure" sentence for a tile's
 * meaning-subtitle row. Prefers the conf's richer `explanation` field
 * and falls back to `description` when explanation is empty (existing
 * stanzas often only have description authored). The result is always
 * plain text — HTML tags from the conf are stripped — and capped to
 * a single panel-header-width-friendly length.
 */
const recordMeaningSubtitle = (record: SearchbaseRecord): string => {
    const source = record.explanation || record.description;
    if (!source) return '';
    return plainTextFromHtml(source).slice(0, 160);
};

interface SearchbaseDetailTableColumn {
    field: string;
    label: string;
    align?: 'left' | 'right';
    fallback?: string;
    truncate?: boolean;
}

interface SearchbaseDetailTableConfig {
    title: string;
    buttonTitle: string;
    subtitle: (range: TimeRange) => string;
    spl: string;
    dispatchContext?: string;
    tag: string;
    rowKeyField: string;
    emptyMessage: string;
    errorMessage: string;
    columns: SearchbaseDetailTableColumn[];
}

const readDetailStringOption = (
    options: Record<string, unknown> | undefined,
    key: string
): string | undefined => {
    const raw = options?.[key];
    if (typeof raw !== 'string') return undefined;
    const trimmed = raw.trim();
    return trimmed.length > 0 && trimmed.length <= 256 ? trimmed : undefined;
};

const parseDetailTableColumns = (
    raw: unknown
): SearchbaseDetailTableColumn[] => {
    if (!Array.isArray(raw)) return [];
    const columns: SearchbaseDetailTableColumn[] = [];
    for (const item of raw) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
        const candidate = item as Record<string, unknown>;
        const field =
            typeof candidate.field === 'string' ? candidate.field.trim() : '';
        const label =
            typeof candidate.label === 'string' ? candidate.label.trim() : field;
        if (!field || !label || field.length > 96 || label.length > 96) continue;
        columns.push({
            field,
            label,
            align:
                candidate.align === 'right' || candidate.align === 'left'
                    ? candidate.align
                    : undefined,
            fallback:
                typeof candidate.fallback === 'string'
                    ? candidate.fallback.slice(0, 120)
                    : undefined,
            truncate: candidate.truncate === true,
        });
        if (columns.length >= 12) break;
    }
    return columns;
};

const DETAIL_TABLE_SKIP_FIELDS = new Set([
    '_raw',
    '_serial',
    '_si',
    '_span',
    'splunk_server',
]);

const humanizeDetailFieldLabel = (field: string): string =>
    field
        .replace(/[_.]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, (char) => char.toUpperCase());

const isNumericLike = (value: unknown): boolean => {
    if (typeof value === 'number') return Number.isFinite(value);
    if (typeof value !== 'string') return false;
    return /^-?\d+(?:\.\d+)?%?$/.test(value.trim());
};

const inferDetailTableColumns = (
    rows: Array<Record<string, unknown>>
): SearchbaseDetailTableColumn[] => {
    const fields: string[] = [];
    const seen = new Set<string>();
    for (const row of rows) {
        for (const field of Object.keys(row)) {
            if (seen.has(field)) continue;
            if (DETAIL_TABLE_SKIP_FIELDS.has(field)) continue;
            if (field.startsWith('_') && field !== '_time') continue;
            seen.add(field);
            fields.push(field);
            if (fields.length >= 12) break;
        }
        if (fields.length >= 12) break;
    }
    return fields.map((field) => {
        const sample = rows.find((row) => row[field] !== undefined)?.[field];
        return {
            field,
            label: field === '_time' ? 'Time' : humanizeDetailFieldLabel(field),
            align: isNumericLike(sample) ? 'right' : undefined,
            truncate: field.length > 32,
        };
    });
};

const interpolateDetailSubtitle = (
    template: string,
    source: SearchbaseRecord,
    detail: SearchbaseRecord,
    range: TimeRange
): string =>
    template
        .replace(/\{rangeLabel\}/g, range.label.toLowerCase())
        .replace(/\{RangeLabel\}/g, range.label)
        .replace(/\{searchName\}/g, source.searchName)
        .replace(/\{drilldownSearchName\}/g, detail.searchName);

const buildSearchbaseDetailTableConfig = (
    source: SearchbaseRecord,
    entryByName: Map<string, SearchbaseRecord>
): SearchbaseDetailTableConfig | null => {
    const drilldownName = source.drilldownSearchName?.trim();
    if (!drilldownName) return null;
    const detail = entryByName.get(drilldownName);
    if (!detail?.search) return null;
    const options = detail.vizOptions;
    const columns = parseDetailTableColumns(options?.columns);
    const subtitleTemplate =
        readDetailStringOption(options, 'modalSubtitle') ??
        'Detail table for {searchName} over {rangeLabel}.';
    const tag = `searchbase_canvas_detail_${detail.id || detail.searchName}`.replace(
        /[^A-Za-z0-9_]+/g,
        '_'
    );
    return {
        title:
            readDetailStringOption(options, 'modalTitle') ??
            `${source.searchName} Details`,
        buttonTitle:
            source.drilldownButtonTitle ??
            readDetailStringOption(options, 'buttonTitle') ??
            `View ${source.searchName} detail table`,
        subtitle: (range) =>
            interpolateDetailSubtitle(subtitleTemplate, source, detail, range),
        spl: detail.search,
        dispatchContext: detail.dispatchContext,
        tag,
        rowKeyField:
            readDetailStringOption(options, 'rowKeyField') ?? columns[0]?.field ?? '',
        emptyMessage:
            readDetailStringOption(options, 'emptyMessage') ??
            'No detail rows returned for this time range.',
        errorMessage:
            readDetailStringOption(options, 'errorMessage') ??
            `Unable to load ${detail.searchName}.`,
        columns,
    };
};

const readRowString = (
    row: Record<string, unknown>,
    field: string,
    fallback = ''
): string => {
    const raw = row[field];
    if (raw === null || raw === undefined) return fallback;
    if (Array.isArray(raw)) return raw.map(String).join(', ');
    const text = String(raw).trim();
    if (text.toLowerCase() === 'null') return fallback;
    return text || fallback;
};

interface CachedMetricResultEntry {
    key: string;
    result: MetricResult;
}

interface CachedTableDataEntry {
    key: string;
    result: TableDataResult;
}

interface SearchbaseCanvasTileProps {
    tile: CanvasTile;
    record?: SearchbaseRecord;
    entryByName: Map<string, SearchbaseRecord>;
    range: TimeRange;
    refreshToken: number;
    metricResultCache?: CachedMetricResultEntry;
    tableDataCache?: CachedTableDataEntry;
    isRunning: boolean;
    presentationMode?: boolean;
    onRun: (tileId: string) => void;
    onStop: (tileId: string) => void;
    onRefresh: (tileId: string) => void;
    onConfigure: (tileId: string) => void;
    onRemove: (tileId: string) => void;
    onCycleSize: (tileId: string) => void;
    onChangeViz: (tileId: string, vizOverride?: string) => void;
    overlayFields: string[];
    onChangeOverlay: (tileId: string, overlayField?: string | null) => void;
    onOpenDetailTable: (config: SearchbaseDetailTableConfig) => void;
    onOverlayFieldsChange: (tileId: string, fields: string[]) => void;
    onNoDataObservation: (
        tileId: string,
        entry: ObservedNoDataEntry | null
    ) => void;
    onMetricResultCacheChange: (
        tileId: string,
        cacheKey: string,
        result: MetricResult
    ) => void;
    onTableDataCacheChange: (
        tileId: string,
        cacheKey: string,
        result: TableDataResult
    ) => void;
}

const MissingSearchbaseTile: React.FC<{
    tile: CanvasTile;
    onRemove: (tileId: string) => void;
    presentationMode?: boolean;
}> = ({ tile, onRemove, presentationMode = false }) => (
    <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-200">
        <div className="flex items-center gap-2 font-bold">
            <AlertCircle className="h-4 w-4" />
            Missing searchbase entry
        </div>
        <div className="mt-1 font-mono text-xs">{tile.searchName}</div>
        {!presentationMode && (
            <button
                type="button"
                onClick={() => onRemove(tile.id)}
                className="mt-3 inline-flex items-center gap-1 rounded border border-rose-200 bg-white px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-100"
            >
                <Trash2 className="h-3.5 w-3.5" />
                Remove
            </button>
        )}
    </div>
);

type ResolvedSearchbaseCanvasTileProps = Omit<
    SearchbaseCanvasTileProps,
    'record'
> & {
    record: SearchbaseRecord;
};

interface SearchbaseTileBodyProps {
    tile: CanvasTile;
    record: SearchbaseRecord;
    range: TimeRange;
    refreshToken: number;
    metricResultCache?: CachedMetricResultEntry;
    tableDataCache?: CachedTableDataEntry;
    viz: string | undefined;
    color: string;
    description: string;
    onConfigure: () => void;
    onOpenSearch: () => void;
    onOpenDrilldown?: () => void;
    drilldownTitle?: string;
    presentationMode?: boolean;
    onOverlayFieldsChange?: (tileId: string, fields: string[]) => void;
    onNoDataObservation: (entry: ObservedNoDataEntry | null) => void;
    onMetricResultCacheChange: (
        tileId: string,
        cacheKey: string,
        result: MetricResult
    ) => void;
    onTableDataCacheChange: (
        tileId: string,
        cacheKey: string,
        result: TableDataResult
    ) => void;
}

const noDataCopy = (
    reason: NoDataReason | undefined,
    rangeLabel: string | undefined,
    failureMessage?: string,
    failureHttpStatus?: number
): { title: string; detail: string } => {
    const rangeText = rangeLabel ? ` for ${rangeLabel.toLowerCase()}` : '';
    if (reason === 'dispatch_failed') {
        const statusSuffix =
            typeof failureHttpStatus === 'number' ? ` (HTTP ${failureHttpStatus})` : '';
        return {
            title: `Search dispatch failed${statusSuffix}`,
            detail:
                failureMessage ??
                'Splunk could not start this search (the dispatcher may be overloaded). Use the refresh button below to retry once load drops, or open the search in Search.',
        };
    }
    if (reason === 'job_failed') {
        return {
            title: 'Search failed',
            detail:
                failureMessage ??
                'Splunk reported an error while running this search. Open it in Search to inspect the SPL error.',
        };
    }
    if (reason === 'error') {
        return {
            title: 'Search failed',
            detail:
                failureMessage ??
                'Splunk could not complete this search. Open it in Search to inspect the error.',
        };
    }
    if (reason === 'column_missing') {
        return {
            title: 'No displayable data',
            detail:
                'The search ran, but it did not emit the configured value field.',
        };
    }
    if (reason === 'no_numeric_column') {
        return {
            title: 'No displayable data',
            detail:
                'The search returned rows, but this visualization could not find a usable value column.',
        };
    }
    if (reason === 'empty_rows') {
        return {
            title: 'No data returned',
            detail: `The search completed but returned 0 rows${rangeText}.`,
        };
    }
    return {
        title: 'No data returned',
        detail: `The search completed but did not return data${rangeText}.`,
    };
};

const observedNoDataEntry = (
    tile: CanvasTile,
    record: SearchbaseRecord,
    reason: NoDataReason,
    rangeLabel: string | undefined
): ObservedNoDataEntry => ({
    tileId: tile.id,
    stanzaName: record.id,
    searchName: record.searchName,
    category: record.category,
    subCategory: record.subCategory,
    tags: record.tags,
    description: plainTextFromHtml(record.description),
    search: record.search,
    reason,
    rangeLabel: rangeLabel ?? '',
    observedAt: new Date().toISOString(),
});

const SearchbaseNoDataPanel: React.FC<{
    record: SearchbaseRecord;
    description: string;
    noDataReason?: NoDataReason;
    rangeLabel?: string;
    failureMessage?: string;
    failureHttpStatus?: number;
    onConfigure: () => void;
    onOpenSearch: () => void;
    onOpenDrilldown?: () => void;
    drilldownTitle?: string;
    presentationMode?: boolean;
}> = ({
    record,
    description,
    noDataReason,
    rangeLabel,
    failureMessage,
    failureHttpStatus,
    onConfigure,
    onOpenSearch,
    onOpenDrilldown,
    drilldownTitle,
    presentationMode = false,
}) => {
    const copy = noDataCopy(
        noDataReason,
        rangeLabel,
        failureMessage,
        failureHttpStatus
    );
    const isError =
        noDataReason === 'error' ||
        noDataReason === 'dispatch_failed' ||
        noDataReason === 'job_failed';

    return (
        <div
            className={cn(
                'flex h-full min-h-[220px] flex-col rounded-md border border-dashed p-4',
                isError
                    ? 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100'
                    : 'border-sky-200 bg-sky-50 text-slate-900 dark:border-sky-800 dark:bg-slate-800 dark:text-slate-50'
            )}
        >
            <div className="flex items-start gap-3">
                <div
                    className={cn(
                        'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md',
                        isError
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/70 dark:text-rose-100'
                            : 'bg-white text-sky-700 shadow-sm dark:bg-slate-950 dark:text-sky-200'
                    )}
                >
                    <AlertCircle className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                    <div className="text-sm font-black uppercase tracking-wide">
                        {copy.title}
                    </div>
                    <p
                        className={cn(
                            'mt-1 text-xs leading-snug',
                            isError
                                ? 'text-rose-700 dark:text-rose-200'
                                : 'text-slate-600 dark:text-slate-200'
                        )}
                    >
                        {copy.detail}
                    </p>
                </div>
            </div>

            <div className="mt-4 min-w-0">
                <div className="truncate text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-300">
                    {record.searchName}
                </div>
                <p className="mt-1 line-clamp-3 text-xs leading-snug text-slate-600 dark:text-slate-200">
                    {description || record.id}
                </p>
            </div>

            <div className="mt-auto flex flex-wrap gap-2 pt-4">
                <button
                    type="button"
                    onClick={onOpenSearch}
                    className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-black text-white transition hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-400 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-sky-200"
                >
                    <Search className="h-3.5 w-3.5" />
                    Open in Search
                </button>
                {onOpenDrilldown && (
                    <button
                        type="button"
                        onClick={onOpenDrilldown}
                        className="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-white px-2.5 py-1.5 text-xs font-black text-sky-700 transition hover:border-sky-300 hover:bg-sky-50 focus:outline-none focus:ring-2 focus:ring-sky-300 dark:border-sky-900 dark:bg-slate-950 dark:text-sky-200 dark:hover:bg-sky-950"
                    >
                        <Table2 className="h-3.5 w-3.5" />
                        {drilldownTitle ?? 'View detail'}
                    </button>
                )}
                {!presentationMode && (
                    <button
                        type="button"
                        onClick={onConfigure}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-black text-slate-700 transition hover:border-sky-300 hover:text-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-sky-700 dark:hover:text-sky-200"
                    >
                        <Settings2 className="h-3.5 w-3.5" />
                        Replace
                    </button>
                )}
            </div>
        </div>
    );
};

const SearchbaseMetricTileBody: React.FC<SearchbaseTileBodyProps> = ({
    tile,
    record,
    range,
    refreshToken,
    metricResultCache,
    viz,
    color,
    description,
    onConfigure,
    onOpenSearch,
    onOpenDrilldown,
    drilldownTitle,
    presentationMode = false,
    onOverlayFieldsChange,
    onNoDataObservation,
    onMetricResultCacheChange,
}) => {
    // `viz_options.deltaField` (new in Build 1224) names the SPL
    // column carrying the delta value the radial / gauge tiles render
    // inline with the headline. Maps directly onto MetricConfig's
    // `changeField`, which `useMetric` already supports — the only
    // new wiring is the resolver call.
    const deltaFieldOverride = resolveDeltaField(record.vizOptions) ?? undefined;
    const defaultOverlayField = resolveBaselineField(record.vizOptions) ?? undefined;
    const selectedOverlayField =
        tile.overlayField === null
            ? undefined
            : tile.overlayField ?? defaultOverlayField;
    const overlayLabel =
        selectedOverlayField === defaultOverlayField
            ? resolveOverlayLabel(record.vizOptions) ?? selectedOverlayField
            : selectedOverlayField;
    const valueFieldOverride = resolveValueField(record.vizOptions) ?? undefined;
    const sparkDataFieldOverride =
        resolveSparkDataField(record.vizOptions) ?? undefined;

    const metricConfig = useMemo<MetricConfig>(
        () => ({
            id: tile.id,
            section: 'it_health',
            label: record.searchName,
            subLabel: [record.category, record.subCategory]
                .filter(Boolean)
                .join(' / '),
            description,
            spl: record.search,
            dispatchContext: record.dispatchContext,
            color,
            valueField: valueFieldOverride,
            sparkDataField: sparkDataFieldOverride,
            changeField: deltaFieldOverride,
            baselineField: selectedOverlayField,
            overlayLabel,
            thresholdNote: 'Searchbase canvas tile.',
            suppressMockOnEmpty: true,
            mock: {
                seed: hashString(tile.id),
                sparkMin: 10,
                sparkMax: 90,
                value: 0,
                change: 0,
            },
        }),
        [
            color,
            deltaFieldOverride,
            description,
            overlayLabel,
            record.category,
            record.id,
            record.search,
            record.searchName,
            record.subCategory,
            selectedOverlayField,
            sparkDataFieldOverride,
            tile.id,
            valueFieldOverride,
        ]
    );

    const metricCacheKey = useMemo(
        () =>
            [
                'metric',
                tile.id,
                record.id,
                record.search,
                record.dispatchContext,
                range.earliest,
                range.latest,
                refreshToken,
                viz ?? '',
                valueFieldOverride ?? '',
                sparkDataFieldOverride ?? '',
                deltaFieldOverride ?? '',
                selectedOverlayField ?? '',
            ].join('\u0001'),
        [
            deltaFieldOverride,
            record.dispatchContext,
            record.id,
            record.search,
            range.earliest,
            range.latest,
            refreshToken,
            selectedOverlayField,
            sparkDataFieldOverride,
            tile.id,
            valueFieldOverride,
            viz,
        ]
    );
    const cachedMetricResult =
        metricResultCache?.key === metricCacheKey
            ? metricResultCache.result
            : undefined;
    const handleMetricResultChange = useCallback(
        (cacheKey: string, result: MetricResult) =>
            onMetricResultCacheChange(tile.id, cacheKey, result),
        [onMetricResultCacheChange, tile.id]
    );

    const metric = useMetric(metricConfig, range, refreshToken, {
        cacheKey: metricCacheKey,
        cachedResult: cachedMetricResult,
        onResultChange: handleMetricResultChange,
    });
    const availableOverlayFieldsKey = metric.availableOverlayFields.join('\u0001');

    useEffect(() => {
        onOverlayFieldsChange?.(tile.id, metric.availableOverlayFields);
    }, [
        availableOverlayFieldsKey,
        metric.availableOverlayFields,
        onOverlayFieldsChange,
        tile.id,
    ]);

    useEffect(() => {
        if (metric.source !== 'live') return;
        if (metric.noDataReason) {
            onNoDataObservation(
                observedNoDataEntry(tile, record, metric.noDataReason, metric.rangeLabel)
            );
            return;
        }
        onNoDataObservation(null);
    }, [
        metric.noDataReason,
        metric.rangeLabel,
        metric.source,
        onNoDataObservation,
        record,
        tile,
    ]);

    if (metric.source === 'live' && metric.noDataReason) {
        return (
            <SearchbaseNoDataPanel
                record={record}
                description={description}
                noDataReason={metric.noDataReason}
                rangeLabel={metric.rangeLabel}
                failureMessage={metric.failureMessage}
                failureHttpStatus={metric.failureHttpStatus}
                onConfigure={onConfigure}
                onOpenSearch={onOpenSearch}
                onOpenDrilldown={onOpenDrilldown}
                drilldownTitle={drilldownTitle}
                presentationMode={presentationMode}
            />
        );
    }

    const meaningSubtitle = recordMeaningSubtitle(record);

    const scalarTileProps = {
        label: record.searchName,
        subLabel: [record.category, record.subCategory].filter(Boolean).join(' / '),
        meaningSubtitle: meaningSubtitle || undefined,
        description,
        descriptionFootnote: record.id,
        thresholdNote: 'Searchbase canvas tile.',
        onOpenInSearch: onOpenSearch,
        onConfigure: presentationMode ? undefined : onConfigure,
        onOpenDetailTable: onOpenDrilldown,
        detailTableTitle: drilldownTitle ?? 'View detail',
        isCustomized: presentationMode ? false : (true as const),
        className: 'h-full',
        value: metric.displayValue ?? metric.value,
        accentColor: color,
        vizOptions: record.vizOptions,
        source: metric.source,
        noDataReason: metric.noDataReason,
        rangeLabel: metric.rangeLabel,
    };

    if (isSingleValueRadialViz(viz)) {
        // Only the radial currently surfaces an inline delta; pass
        // `change` separately so other scalar tiles aren't forced to
        // accept a prop they don't render.
        return (
            <SingleValueRadialTile
                {...scalarTileProps}
                change={
                    Number.isFinite(metric.change) ? (metric.change as number) : undefined
                }
            />
        );
    }
    if (isFillerGaugeViz(viz)) {
        return <FillerGaugeTile {...scalarTileProps} />;
    }
    if (isMarkerGaugeViz(viz)) {
        return <MarkerGaugeTile {...scalarTileProps} />;
    }

    const baseVizType = sparklineVizTypeFromSplunkViz(viz);
    const sparklineDisplayOption = record.vizOptions?.sparklineDisplay;
    const singleValueSparklineDisabled =
        record.vizOptions?.showSparkline === false ||
        (typeof sparklineDisplayOption === 'string' &&
            sparklineDisplayOption.trim().toLowerCase() === 'off');
    const shouldRenderSingleValueSparkline =
        baseVizType === 'singlevalue' &&
        !singleValueSparklineDisabled &&
        metric.source === 'live' &&
        metric.sparkData.length > 1 &&
        metric.sparkTimestamps.length === metric.sparkData.length;
    const tileVizType = shouldRenderSingleValueSparkline ? 'line' : baseVizType;
    const tileDataValuesDisplay =
        shouldRenderSingleValueSparkline &&
        record.vizOptions?.dataValuesDisplay === undefined
            ? 'off'
            : normalizeDataValuesDisplay(record.vizOptions?.dataValuesDisplay);

    return (
        <MetricItem
            label={record.searchName}
            subLabel={[record.category, record.subCategory].filter(Boolean).join(' / ')}
            description={description}
            descriptionFootnote={record.id}
            thresholdNote="Searchbase canvas tile."
            onOpenInSearch={onOpenSearch}
            onConfigure={presentationMode ? undefined : onConfigure}
            isCustomized={!presentationMode}
            className="h-full"
            value={metric.displayValue ?? metric.value}
            change={metric.change}
            sparkData={metric.sparkData}
            previousData={metric.previousSparkData}
            previousLabel={overlayLabel ?? 'Prev'}
            sparkTimestamps={metric.sparkTimestamps}
            timeRange={range}
            color={color}
            status={metric.status}
            source={metric.source}
            noDataReason={metric.noDataReason}
            rangeLabel={metric.rangeLabel}
            vizType={tileVizType}
            dataValuesDisplay={tileDataValuesDisplay}
            onOpenDetailTable={onOpenDrilldown}
            detailTableTitle={drilldownTitle ?? 'View detail'}
        />
    );
};

const SearchbaseTableTileBody: React.FC<
    SearchbaseTileBodyProps & { variant: 'table' | 'bar' | 'pie' }
> = ({
    tile,
    record,
    range,
    refreshToken,
    tableDataCache,
    description,
    onConfigure,
    onOpenSearch,
    onOpenDrilldown,
    drilldownTitle,
    variant,
    presentationMode = false,
    onNoDataObservation,
    onTableDataCacheChange,
}) => {
    const tableConfig = useMemo(
        () => ({
            id: tile.id,
            spl: record.search,
            dispatchContext: record.dispatchContext,
            rowLimit: 50,
            suppressMockOnEmpty: true,
        }),
        [record.dispatchContext, record.search, tile.id]
    );
    const tableCacheKey = useMemo(
        () =>
            [
                'table',
                tile.id,
                record.id,
                record.search,
                record.dispatchContext,
                range.earliest,
                range.latest,
                refreshToken,
            ].join('\u0001'),
        [
            record.dispatchContext,
            record.id,
            record.search,
            range.earliest,
            range.latest,
            refreshToken,
            tile.id,
        ]
    );
    const cachedTableData =
        tableDataCache?.key === tableCacheKey ? tableDataCache.result : undefined;
    const handleTableDataChange = useCallback(
        (cacheKey: string, result: TableDataResult) =>
            onTableDataCacheChange(tile.id, cacheKey, result),
        [onTableDataCacheChange, tile.id]
    );

    const table = useTableData(tableConfig, range, refreshToken, {
        cacheKey: tableCacheKey,
        cachedResult: cachedTableData,
        onResultChange: handleTableDataChange,
    });

    useEffect(() => {
        if (table.source !== 'live') return;
        if (table.noDataReason) {
            onNoDataObservation(
                observedNoDataEntry(tile, record, table.noDataReason, table.rangeLabel)
            );
            return;
        }
        onNoDataObservation(null);
    }, [
        onNoDataObservation,
        record,
        table.noDataReason,
        table.rangeLabel,
        table.source,
        tile,
    ]);

    if (table.source === 'live' && table.noDataReason) {
        return (
            <SearchbaseNoDataPanel
                record={record}
                description={description}
                noDataReason={table.noDataReason}
                rangeLabel={table.rangeLabel}
                failureMessage={table.failureMessage}
                failureHttpStatus={table.failureHttpStatus}
                onConfigure={onConfigure}
                onOpenSearch={onOpenSearch}
                onOpenDrilldown={onOpenDrilldown}
                drilldownTitle={drilldownTitle}
                presentationMode={presentationMode}
            />
        );
    }

    const commonTileProps = {
        label: record.searchName,
        subLabel: [record.category, record.subCategory].filter(Boolean).join(' / '),
        description,
        descriptionFootnote: record.id,
        thresholdNote: 'Searchbase canvas tile.',
        onOpenInSearch: onOpenSearch,
        onOpenDetailTable: onOpenDrilldown,
        detailTableTitle: drilldownTitle ?? 'View detail',
        onConfigure: presentationMode ? undefined : onConfigure,
        isCustomized: !presentationMode,
        className: 'h-full',
    };

    if (variant === 'bar') {
        return (
            <BarBreakdownTile
                {...commonTileProps}
                rows={table.rows}
                columns={table.columns}
                source={table.source}
                noDataReason={table.noDataReason}
                rangeLabel={table.rangeLabel}
            />
        );
    }

    if (variant === 'pie') {
        return (
            <PieTile
                {...commonTileProps}
                rows={table.rows}
                columns={table.columns}
                seriesColors={seriesColorsFromVizOptions(record.vizOptions)}
                source={table.source}
                noDataReason={table.noDataReason}
                rangeLabel={table.rangeLabel}
            />
        );
    }

    return (
        <TableTile
            {...commonTileProps}
            rows={table.rows}
            columns={table.columns}
            totalRowCount={table.totalRowCount}
            source={table.source}
            noDataReason={table.noDataReason}
            rangeLabel={table.rangeLabel}
        />
    );
};

const ResolvedSearchbaseCanvasTile: React.FC<ResolvedSearchbaseCanvasTileProps> = ({
    tile,
    record,
    entryByName,
    range,
    refreshToken,
    metricResultCache,
    tableDataCache,
    onConfigure,
    onRemove,
    onCycleSize,
    onChangeViz,
    overlayFields,
    onChangeOverlay,
    onOpenDetailTable,
    onOverlayFieldsChange,
    onNoDataObservation,
    onMetricResultCacheChange,
    onTableDataCacheChange,
    onStop,
    onRefresh,
    presentationMode = false,
}) => {
    const description = recordPlainText(record);
    const color = firstSeriesColor(record.vizOptions);
    const viz = effectiveTileViz(tile, record);
    const tileBodyKey = searchbaseTileBodyKey(tile.id, viz);
    const drilldownRecord = record.drilldownSearchName
        ? entryByName.get(record.drilldownSearchName)
        : undefined;
    const detailTableConfig = useMemo(
        () => buildSearchbaseDetailTableConfig(record, entryByName),
        [entryByName, record]
    );
    const openSearch = useCallback(() => {
        openSplunkSearch(record.search, range, record.dispatchContext);
    }, [record.dispatchContext, record.search, range]);
    const openDrilldown = useCallback(() => {
        if (detailTableConfig) {
            onOpenDetailTable(detailTableConfig);
            return;
        }
        if (record.drilldownSearchName) {
            openSplunkSearch(
                drilldownRecord?.search ?? savedSearchSpl(record.drilldownSearchName),
                range,
                drilldownRecord?.dispatchContext ?? record.dispatchContext
            );
        }
    }, [
        detailTableConfig,
        drilldownRecord?.dispatchContext,
        drilldownRecord?.search,
        onOpenDetailTable,
        record.dispatchContext,
        record.drilldownSearchName,
        range,
    ]);

    return (
        <div className="group/tile flex min-h-[248px] flex-col rounded-md border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-800/95 dark:shadow-none dark:ring-1 dark:ring-slate-900/30">
            <div className="flex h-full min-h-0 flex-1 flex-col p-2">
                {isTableViz(viz) ? (
                    <SearchbaseTableTileBody
                        key={tileBodyKey}
                        tile={tile}
                        record={record}
                        range={range}
                        refreshToken={refreshToken}
                        tableDataCache={tableDataCache}
                        viz={viz}
                        color={color}
                        description={description}
                        onConfigure={() => onConfigure(tile.id)}
                        onOpenSearch={openSearch}
                        onOpenDrilldown={
                            detailTableConfig ? openDrilldown : undefined
                        }
                        drilldownTitle={detailTableConfig?.buttonTitle}
                        presentationMode={presentationMode}
                        variant="table"
                        onNoDataObservation={(entry) =>
                            onNoDataObservation(tile.id, entry)
                        }
                        onMetricResultCacheChange={onMetricResultCacheChange}
                        onTableDataCacheChange={onTableDataCacheChange}
                    />
                ) : isBarBreakdownViz(viz) ? (
                    <SearchbaseTableTileBody
                        key={tileBodyKey}
                        tile={tile}
                        record={record}
                        range={range}
                        refreshToken={refreshToken}
                        tableDataCache={tableDataCache}
                        viz={viz}
                        color={color}
                        description={description}
                        onConfigure={() => onConfigure(tile.id)}
                        onOpenSearch={openSearch}
                        onOpenDrilldown={
                            detailTableConfig ? openDrilldown : undefined
                        }
                        drilldownTitle={detailTableConfig?.buttonTitle}
                        presentationMode={presentationMode}
                        variant="bar"
                        onNoDataObservation={(entry) =>
                            onNoDataObservation(tile.id, entry)
                        }
                        onMetricResultCacheChange={onMetricResultCacheChange}
                        onTableDataCacheChange={onTableDataCacheChange}
                    />
                ) : isPieViz(viz) ? (
                    <SearchbaseTableTileBody
                        key={tileBodyKey}
                        tile={tile}
                        record={record}
                        range={range}
                        refreshToken={refreshToken}
                        tableDataCache={tableDataCache}
                        viz={viz}
                        color={color}
                        description={description}
                        onConfigure={() => onConfigure(tile.id)}
                        onOpenSearch={openSearch}
                        onOpenDrilldown={
                            detailTableConfig ? openDrilldown : undefined
                        }
                        drilldownTitle={detailTableConfig?.buttonTitle}
                        presentationMode={presentationMode}
                        variant="pie"
                        onNoDataObservation={(entry) =>
                            onNoDataObservation(tile.id, entry)
                        }
                        onMetricResultCacheChange={onMetricResultCacheChange}
                        onTableDataCacheChange={onTableDataCacheChange}
                    />
                ) : (
                    <SearchbaseMetricTileBody
                        key={tileBodyKey}
                        tile={tile}
                        record={record}
                        range={range}
                        refreshToken={refreshToken}
                        metricResultCache={metricResultCache}
                        viz={viz}
                        color={color}
                        description={description}
                        onConfigure={() => onConfigure(tile.id)}
                        onOpenSearch={openSearch}
                        onOpenDrilldown={
                            detailTableConfig ? openDrilldown : undefined
                        }
                        drilldownTitle={detailTableConfig?.buttonTitle}
                        presentationMode={presentationMode}
                        onOverlayFieldsChange={onOverlayFieldsChange}
                        onNoDataObservation={(entry) =>
                            onNoDataObservation(tile.id, entry)
                        }
                        onMetricResultCacheChange={onMetricResultCacheChange}
                        onTableDataCacheChange={onTableDataCacheChange}
                    />
                )}
            </div>
            {!presentationMode && (
                <div className="flex items-center gap-2 border-t border-slate-100 px-2 py-1.5 text-[10px] font-semibold text-slate-500 dark:border-slate-700 dark:text-slate-300">
                    <TileVizSelect
                        tile={tile}
                        record={record}
                        onChangeViz={onChangeViz}
                    />
                    {supportsTileOverlayControl(viz) && (
                        <TileOverlaySelect
                            tile={tile}
                            record={record}
                            overlayFields={overlayFields}
                            onChangeOverlay={onChangeOverlay}
                        />
                    )}
                    <span className="ml-auto flex items-center gap-1">
                        <button
                            type="button"
                            onClick={() => onRefresh(tile.id)}
                            title="Refresh this tile"
                            aria-label="Refresh this tile"
                            className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-400 dark:hover:bg-slate-800 dark:hover:text-sky-300"
                        >
                            <RefreshCw className="h-3.5 w-3.5" />
                        </button>
                        {detailTableConfig && (
                            <button
                                type="button"
                                onClick={openDrilldown}
                                title={detailTableConfig.buttonTitle}
                                aria-label={detailTableConfig.buttonTitle}
                                className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-400 dark:hover:bg-slate-800 dark:hover:text-sky-300"
                            >
                                <Table2 className="h-3.5 w-3.5" />
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => onStop(tile.id)}
                            title="Stop this tile"
                            aria-label="Stop this tile"
                            className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-amber-600 focus:outline-none focus:ring-1 focus:ring-amber-400 dark:hover:bg-slate-800 dark:hover:text-amber-300"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                        <button
                            type="button"
                            onClick={() => onCycleSize(tile.id)}
                            title={`Tile size: ${TILE_SPAN_LABEL[tile.span]}`}
                            aria-label={`Tile size: ${TILE_SPAN_LABEL[tile.span]}`}
                            className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-400 dark:hover:bg-slate-800 dark:hover:text-sky-300"
                        >
                            <Maximize2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                            type="button"
                            onClick={() => onRemove(tile.id)}
                            title="Remove tile"
                            aria-label="Remove tile"
                            className="rounded p-1 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 focus:outline-none focus:ring-1 focus:ring-rose-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </button>
                    </span>
                </div>
            )}
        </div>
    );
};

const SearchbasePreviewTile: React.FC<ResolvedSearchbaseCanvasTileProps> = ({
    tile,
    record,
    entryByName,
    range,
    onRun,
    onConfigure,
    onRemove,
    onCycleSize,
    onChangeViz,
    onOpenDetailTable,
    presentationMode = false,
}) => {
    const description = recordPlainText(record);
    const openSearch = () =>
        openSplunkSearch(record.search, range, record.dispatchContext);
    const color = firstSeriesColor(record.vizOptions);
    const viz = effectiveTileViz(tile, record);
    const detailTableConfig = useMemo(
        () => buildSearchbaseDetailTableConfig(record, entryByName),
        [entryByName, record]
    );
    const openDrilldown = () => {
        if (detailTableConfig) onOpenDetailTable(detailTableConfig);
    };

    return (
        <div
            className={cn(
                'group/tile flex min-h-[248px] flex-col rounded-md bg-white shadow-sm dark:bg-slate-800/95 dark:shadow-none dark:ring-1 dark:ring-slate-900/30',
                presentationMode
                    ? 'border border-slate-200 dark:border-slate-700'
                    : 'border border-dashed border-slate-300 dark:border-slate-700'
            )}
        >
            <div className="flex min-h-0 flex-1 flex-col p-4">
                <div className="flex items-start gap-3">
                    <div
                        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200"
                        style={{ borderTop: `3px solid ${color}` }}
                    >
                        <Gauge className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h3 className="line-clamp-2 text-sm font-black uppercase leading-tight tracking-tight text-slate-900 dark:text-slate-50">
                            {record.searchName}
                        </h3>
                        <div className="mt-1 truncate text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                            {[record.category, record.subCategory]
                                .filter(Boolean)
                                .join(' / ')}
                        </div>
                    </div>
                </div>

                <p className="mt-3 line-clamp-4 text-xs leading-snug text-slate-600 dark:text-slate-300">
                    {description || record.id}
                </p>

                <div className="mt-3 flex flex-wrap gap-1">
                    <span className="rounded bg-slate-100 px-2 py-1 text-[10px] font-black uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                        {formatVizLabel(viz)}
                    </span>
                    {tile.vizOverride && (
                        <span className="rounded bg-sky-50 px-2 py-1 text-[10px] font-black uppercase text-sky-700 dark:bg-sky-950 dark:text-sky-200">
                            Override
                        </span>
                    )}
                    {record.drilldownSearchName && (
                        <span className="rounded bg-sky-50 px-2 py-1 text-[10px] font-black uppercase text-sky-700 dark:bg-sky-950 dark:text-sky-200">
                            Drilldown
                        </span>
                    )}
                    {record.tags.slice(0, 3).map((tag) => (
                        <span
                            key={tag}
                            className="rounded bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-500 dark:bg-slate-900 dark:text-slate-400"
                        >
                            {tag}
                        </span>
                    ))}
                </div>

                {!presentationMode && (
                    <button
                        type="button"
                        onClick={() => onRun(tile.id)}
                        className="mt-auto inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-xs font-black text-white transition hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-400 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-sky-200"
                    >
                        <Play className="h-3.5 w-3.5" />
                        Run search
                    </button>
                )}
            </div>

            <div className="flex items-center gap-2 border-t border-slate-100 px-2 py-1.5 text-[10px] font-semibold text-slate-500 dark:border-slate-700 dark:text-slate-300">
                {!presentationMode && (
                    <TileVizSelect
                        tile={tile}
                        record={record}
                        onChangeViz={onChangeViz}
                    />
                )}
                <span className="ml-auto flex items-center gap-1">
                    <button
                        type="button"
                        onClick={openSearch}
                        title="Open in Search"
                        aria-label={`Open ${record.searchName} in Search`}
                        className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-400 dark:hover:bg-slate-800 dark:hover:text-sky-300"
                    >
                        <Search className="h-3.5 w-3.5" />
                    </button>
                    {!presentationMode && (
                        <button
                            type="button"
                            onClick={() => onConfigure(tile.id)}
                            title="Replace tile"
                            aria-label="Replace tile"
                            className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-400 dark:hover:bg-slate-800 dark:hover:text-sky-300"
                        >
                            <Settings2 className="h-3.5 w-3.5" />
                        </button>
                    )}
                    {detailTableConfig && (
                        <button
                            type="button"
                            onClick={openDrilldown}
                            title={detailTableConfig.buttonTitle}
                            aria-label={detailTableConfig.buttonTitle}
                            className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-400 dark:hover:bg-slate-800 dark:hover:text-sky-300"
                        >
                            <Table2 className="h-3.5 w-3.5" />
                        </button>
                    )}
                    {!presentationMode && (
                        <>
                            <button
                                type="button"
                                onClick={() => onCycleSize(tile.id)}
                                title={`Tile size: ${TILE_SPAN_LABEL[tile.span]}`}
                                aria-label={`Tile size: ${TILE_SPAN_LABEL[tile.span]}`}
                                className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-400 dark:hover:bg-slate-800 dark:hover:text-sky-300"
                            >
                                <Maximize2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                                type="button"
                                onClick={() => onRemove(tile.id)}
                                title="Remove tile"
                                aria-label="Remove tile"
                                className="rounded p-1 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 focus:outline-none focus:ring-1 focus:ring-rose-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </button>
                        </>
                    )}
                </span>
            </div>
        </div>
    );
};

const SearchbaseCanvasTile: React.FC<SearchbaseCanvasTileProps> = (props) => {
    useEffect(() => {
        canvasDebug('[canvas/tile-state] mount', {
            stanzaId: props.tile.id,
            searchName: props.tile.searchName,
            isRunning: props.isRunning,
        });
        return () => {
            canvasDebug('[canvas/tile-state] unmount', {
                stanzaId: props.tile.id,
                searchName: props.tile.searchName,
            });
        };
    }, [props.isRunning, props.tile.id, props.tile.searchName]);

    if (!props.record) {
        return (
            <MissingSearchbaseTile
                tile={props.tile}
                onRemove={props.onRemove}
                presentationMode={props.presentationMode}
            />
        );
    }
    if (!props.isRunning) {
        return <SearchbasePreviewTile {...props} record={props.record} />;
    }
    return <ResolvedSearchbaseCanvasTile {...props} record={props.record} />;
};

const SearchbaseDetailTableModal: React.FC<{
    config: SearchbaseDetailTableConfig;
    range: TimeRange;
    refreshToken: number;
    onClose: () => void;
}> = ({ config, range, refreshToken, onClose }) => {
    const [rows, setRows] = useState<Array<Record<string, string>>>([]);
    const [columns, setColumns] = useState<SearchbaseDetailTableColumn[]>(
        config.columns
    );
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onClose]);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setRows([]);
        setColumns(config.columns);
        setErrorMessage('');

        runSearch({
            spl: config.spl,
            earliestTime: range.earliest,
            latestTime: range.latest,
            tag: config.tag,
            appContext: config.dispatchContext,
        })
            .then((response) => {
                if (cancelled) return;
                const rawRows = (response?.results ?? []) as Array<
                    Record<string, unknown>
                >;
                const nextColumns =
                    config.columns.length > 0
                        ? config.columns
                        : inferDetailTableColumns(rawRows);
                const nextRows = rawRows.map((row) => {
                    const detailRow: Record<string, string> = {};
                    for (const column of nextColumns) {
                        detailRow[column.field] = readRowString(
                            row,
                            column.field,
                            column.fallback ?? ''
                        );
                    }
                    return detailRow;
                });
                setColumns(nextColumns);
                setRows(nextRows);
            })
            .catch((err) => {
                if (cancelled) return;
                const failure = classifySearchDispatchError(err);
                console.error('[searchbase_canvas] detail dispatch failed', {
                    tag: config.tag,
                    httpStatus: failure.httpStatus,
                    reason: failure.reason,
                    message: failure.message,
                });
                setRows([]);
                setColumns(config.columns);
                setErrorMessage(failure.message || config.errorMessage);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [config, range.earliest, range.latest, refreshToken]);

    const titleId = `${config.tag}-title`;
    const displayColumns = columns.length > 0 ? columns : config.columns;
    const columnCount = Math.max(displayColumns.length, 1);
    const searchUrl = splunkSearchAppUrl(config.spl, range, config.dispatchContext);

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="fixed inset-0 z-[2200] flex items-center justify-center p-4"
            onClick={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" />
            <div className="relative w-full max-w-6xl max-h-[88vh] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-950">
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                    <div>
                        <div className="flex items-center gap-2">
                            <Table2 className="h-4 w-4 text-sky-600 dark:text-sky-300" />
                            <h2
                                id={titleId}
                                className="text-base font-bold text-slate-900 dark:text-slate-100"
                            >
                                {config.title}
                            </h2>
                        </div>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            {config.subtitle(range)}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <a
                            href={searchUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-400 dark:border-slate-700 dark:text-slate-300 dark:hover:border-sky-600 dark:hover:bg-sky-950/40 dark:hover:text-sky-200"
                        >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Open in Search
                        </a>
                        <button
                            type="button"
                            onClick={onClose}
                            title="Close"
                            aria-label={`Close ${config.title}`}
                            className="rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                <div className="max-h-[calc(88vh-90px)] overflow-auto">
                    <table className="w-full min-w-[760px] text-sm">
                        <thead className="sticky top-0 z-10 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
                            <tr className="text-left text-xs font-bold text-slate-500 dark:text-slate-400">
                                {displayColumns.map((column, index) => (
                                    <th
                                        key={column.field}
                                        scope="col"
                                        className={cn(
                                            index === 0 ? 'px-5' : 'px-4',
                                            'py-3',
                                            column.align === 'right' && 'text-right'
                                        )}
                                    >
                                        {column.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {loading ? (
                                <tr>
                                    <td
                                        colSpan={columnCount}
                                        className="px-5 py-10 text-center text-sm text-slate-500 dark:text-slate-400"
                                    >
                                        Loading {config.title.toLowerCase()}...
                                    </td>
                                </tr>
                            ) : errorMessage ? (
                                <tr>
                                    <td
                                        colSpan={columnCount}
                                        className="px-5 py-10 text-center text-sm text-rose-600 dark:text-rose-300"
                                    >
                                        {errorMessage}
                                    </td>
                                </tr>
                            ) : rows.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={columnCount}
                                        className="px-5 py-10 text-center text-sm text-slate-500 dark:text-slate-400"
                                    >
                                        {config.emptyMessage}
                                    </td>
                                </tr>
                            ) : (
                                rows.map((row, rowIndex) => {
                                    const rowKey =
                                        (config.rowKeyField &&
                                            row[config.rowKeyField]) ||
                                        displayColumns
                                            .map((column) => row[column.field])
                                            .join('|') ||
                                        'detail-row';
                                    return (
                                        <tr
                                            key={`${rowKey}-${rowIndex}`}
                                            className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/70"
                                        >
                                            {displayColumns.map((column, index) => (
                                                <td
                                                    key={column.field}
                                                    className={cn(
                                                        index === 0
                                                            ? 'px-5 font-medium text-slate-900 dark:text-slate-100'
                                                            : 'px-4 text-slate-600 dark:text-slate-300',
                                                        'py-3',
                                                        column.align === 'right' &&
                                                            'text-right tabular-nums',
                                                        column.truncate &&
                                                            'max-w-xs truncate'
                                                    )}
                                                >
                                                    {row[column.field]}
                                                </td>
                                            ))}
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const NoDataReportModal: React.FC<{
    entries: ObservedNoDataEntry[];
    entryByName: Map<string, SearchbaseRecord>;
    range: TimeRange;
    onClose: () => void;
}> = ({ entries, entryByName, range, onClose }) => {
    const dialogRef = useRef<HTMLDivElement | null>(null);
    const resizeDragRef = useRef<NoDataReportResizeDrag | null>(null);
    const [dialogPixels, setDialogPixels] = useState({ width: 0, height: 0 });
    const [manualDialogSize, setManualDialogSize] = useState<{
        width?: number;
        height?: number;
    }>({});
    const [sortConfig, setSortConfig] = useState<{
        key: NoDataReportSortKey;
        direction: SortDirection;
    }>({ key: 'stanzaName', direction: 'asc' });

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onClose]);

    useEffect(() => {
        const updateDialogPixels = () => {
            if (!dialogRef.current) return;
            const rect = dialogRef.current.getBoundingClientRect();
            setDialogPixels((current) =>
                Math.abs(current.width - rect.width) < 1 &&
                Math.abs(current.height - rect.height) < 1
                    ? current
                    : { width: rect.width, height: rect.height }
            );
        };

        updateDialogPixels();

        if (typeof ResizeObserver === 'undefined') {
            window.addEventListener('resize', updateDialogPixels);
            return () => window.removeEventListener('resize', updateDialogPixels);
        }

        const observer = new ResizeObserver(updateDialogPixels);
        if (dialogRef.current) observer.observe(dialogRef.current);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const onPointerMove = (event: PointerEvent) => {
            const drag = resizeDragRef.current;
            if (!drag) return;

            const maxWidth = Math.max(320, window.innerWidth - 32);
            const maxHeight = Math.max(320, window.innerHeight - 32);
            const minWidth = Math.min(760, maxWidth);
            const minHeight = Math.min(360, maxHeight);
            const deltaX = event.clientX - drag.startX;
            const deltaY = event.clientY - drag.startY;

            setManualDialogSize((current) => ({
                width:
                    drag.axis === 'height'
                        ? current.width
                        : clampNumber(
                              drag.startWidth + deltaX * drag.horizontalMultiplier,
                              minWidth,
                              maxWidth
                          ),
                height:
                    drag.axis === 'width'
                        ? current.height
                        : clampNumber(
                              drag.startHeight + deltaY * drag.verticalMultiplier,
                              minHeight,
                              maxHeight
                          ),
            }));
        };

        const onPointerUp = () => {
            if (!resizeDragRef.current) return;
            resizeDragRef.current = null;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
        window.addEventListener('pointercancel', onPointerUp);
        return () => {
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
            window.removeEventListener('pointercancel', onPointerUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
    }, []);

    const startDialogResize = useCallback(
        (
            event: React.PointerEvent<HTMLElement>,
            axis: NoDataReportResizeAxis,
            horizontalMultiplier: number,
            verticalMultiplier: number
        ) => {
            if (!dialogRef.current) return;
            event.preventDefault();
            event.stopPropagation();

            const rect = dialogRef.current.getBoundingClientRect();
            resizeDragRef.current = {
                axis,
                startX: event.clientX,
                startY: event.clientY,
                startWidth: rect.width,
                startHeight: rect.height,
                horizontalMultiplier,
                verticalMultiplier,
            };
            document.body.style.cursor =
                axis === 'both'
                    ? 'nwse-resize'
                    : axis === 'width'
                      ? 'ew-resize'
                      : 'ns-resize';
            document.body.style.userSelect = 'none';
        },
        []
    );

    const toggleSort = useCallback((key: NoDataReportSortKey) => {
        setSortConfig((current) =>
            current.key === key
                ? {
                      key,
                      direction: current.direction === 'asc' ? 'desc' : 'asc',
                  }
                : { key, direction: 'asc' }
        );
    }, []);

    const rows = useMemo(() => {
        const valueFor = (
            entry: ObservedNoDataEntry,
            key: NoDataReportSortKey
        ): string => {
            if (key === 'tags') {
                return (entryByName.get(entry.searchName)?.tags ?? entry.tags).join(', ');
            }
            return entry[key] ?? '';
        };

        return [...entries].sort((a, b) => {
            const direction = sortConfig.direction === 'asc' ? 1 : -1;
            const primary =
                valueFor(a, sortConfig.key).localeCompare(
                    valueFor(b, sortConfig.key),
                    undefined,
                    { numeric: true, sensitivity: 'base' }
                ) * direction;
            return (
                primary ||
                a.stanzaName.localeCompare(b.stanzaName) ||
                a.searchName.localeCompare(b.searchName)
            );
        });
    }, [entries, entryByName, sortConfig]);
    const reportSearch = useMemo(
        () => buildObservedNoDataReportSearch(rows),
        [rows]
    );
    const reportUrl = splunkSearchAppUrl(reportSearch, range);
    const splPreviewMaxWidth = useMemo(() => {
        const viewportMax =
            typeof window === 'undefined' ? 1180 : Math.max(320, window.innerWidth - 48);
        const scaledWidth = 760 + Math.max(0, dialogPixels.width - 1080) * 0.5;
        return clampNumber(scaledWidth, 760, Math.min(1180, viewportMax));
    }, [dialogPixels.width]);
    const dialogStyle = useMemo(
        () =>
            ({
                width: manualDialogSize.width
                    ? `${manualDialogSize.width}px`
                    : 'min(96vw, 1680px)',
                height: manualDialogSize.height
                    ? `${manualDialogSize.height}px`
                    : 'min(88vh, 900px)',
                minWidth: 'min(760px, calc(100vw - 2rem))',
                minHeight: 'min(360px, calc(100vh - 2rem))',
                maxWidth: 'calc(100vw - 2rem)',
                maxHeight: 'calc(100vh - 2rem)',
                resize: 'both',
            }) as React.CSSProperties,
        [manualDialogSize.height, manualDialogSize.width]
    );
    const renderSortHeader = (column: (typeof NO_DATA_REPORT_SORT_COLUMNS)[number]) => {
        const active = sortConfig.key === column.key;
        const ariaSort = active
            ? sortConfig.direction === 'asc'
                ? 'ascending'
                : 'descending'
            : 'none';

        return (
            <th key={column.key} className={column.thClassName} aria-sort={ariaSort}>
                <button
                    type="button"
                    onClick={() => toggleSort(column.key)}
                    className={cn(
                        'inline-flex items-center gap-1.5 rounded px-1 py-0.5 text-left transition-colors hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-400 dark:hover:bg-slate-800 dark:hover:text-slate-100',
                        active && 'text-slate-900 dark:text-slate-100'
                    )}
                >
                    <span>{column.label}</span>
                    <ChevronDown
                        className={cn(
                            'h-3.5 w-3.5 transition-transform',
                            active
                                ? sortConfig.direction === 'asc' && 'rotate-180'
                                : 'opacity-25'
                        )}
                    />
                </button>
            </th>
        );
    };

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="searchbase-no-data-report-title"
            className="fixed inset-0 z-[1700] flex items-center justify-center p-4"
            onClick={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" />
            <div
                ref={dialogRef}
                className="relative flex overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-950"
                style={dialogStyle}
            >
                <div className="flex min-h-0 w-full flex-col">
                <div className="flex flex-shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                    <div>
                        <div className="flex items-center gap-2">
                            <Table2 className="h-4 w-4 text-sky-600 dark:text-sky-300" />
                            <h2
                                id="searchbase-no-data-report-title"
                                className="text-base font-bold text-slate-900 dark:text-slate-100"
                            >
                                Needs attention report
                            </h2>
                        </div>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            {rows.length.toLocaleString()} observed{' '}
                            {rows.length === 1 ? 'search' : 'searches'} failed or returned no data.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <a
                            href={reportUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-400 dark:border-slate-700 dark:text-slate-300 dark:hover:border-sky-600 dark:hover:bg-sky-950/40 dark:hover:text-sky-200"
                        >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Open in Search
                        </a>
                        <button
                            type="button"
                            onClick={onClose}
                            title="Close"
                            aria-label="Close needs attention report"
                            className="rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                <div className="min-h-0 flex-1 overflow-auto">
                    <table className="w-full min-w-[1180px] text-sm">
                        <thead className="sticky top-0 z-10 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
                            <tr className="text-left text-xs font-bold text-slate-500 dark:text-slate-400">
                                {NO_DATA_REPORT_SORT_COLUMNS.map(renderSortHeader)}
                                <th className="px-4 py-3">reason</th>
                                <th className="px-4 py-3">time_range</th>
                                <th className="px-4 py-3 text-right">action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {rows.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={8}
                                        className="px-5 py-10 text-center text-sm text-slate-500 dark:text-slate-400"
                                    >
                                        Run tiles first; searches that fail or return no data
                                        will appear here.
                                    </td>
                                </tr>
                            ) : (
                                rows.map((row) => {
                                    const record = entryByName.get(row.searchName);
                                    const searchDescription =
                                        (record ? recordPlainText(record) : row.description) ||
                                        'No description available';
                                    const searchSpl = record?.search ?? row.search;
                                    const tags = record?.tags ?? row.tags;
                                    return (
                                        <tr
                                            key={`${row.tileId}-${row.observedAt}`}
                                            className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/70"
                                        >
                                            <td className="px-5 py-3 font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
                                                {row.stanzaName}
                                            </td>
                                            <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                                                <div className="flex items-start gap-2">
                                                    <span>{row.searchName}</span>
                                                    <InfoTooltip
                                                        title={row.searchName}
                                                        description={searchDescription}
                                                        footnote={row.stanzaName}
                                                        anchor="right"
                                                        iconAriaLabel={`Show description for ${row.searchName}`}
                                                        className="mt-0.5 flex-none"
                                                        iconClassName="text-sky-600 hover:text-sky-700 focus:text-sky-700 dark:text-sky-300 dark:hover:text-sky-200 dark:focus:text-sky-200"
                                                    />
                                                    <SplPreviewTooltip
                                                        title={row.searchName}
                                                        spl={searchSpl}
                                                        footnote={row.stanzaName}
                                                        anchor="left"
                                                        iconAriaLabel={`Preview SPL for ${row.searchName}`}
                                                        className="mt-0.5 flex-none"
                                                        iconClassName="text-indigo-600 hover:text-indigo-700 focus:text-indigo-700 dark:text-indigo-300 dark:hover:text-indigo-200 dark:focus:text-indigo-200"
                                                        fontScale={SPL_PREVIEW_FONT_SCALE}
                                                        maxWidth={splPreviewMaxWidth}
                                                    />
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                                                {row.category || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                                                {row.subCategory || '-'}
                                            </td>
                                            <td
                                                className="px-4 py-3 text-slate-600 dark:text-slate-300"
                                                title={tags.join(', ') || 'No tags'}
                                            >
                                                {tags.length > 0 ? (
                                                    <div className="flex max-w-[220px] flex-wrap gap-1">
                                                        {tags.slice(0, 4).map((tag) => (
                                                            <span
                                                                key={tag}
                                                                className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:border-slate-700 dark:text-slate-300"
                                                            >
                                                                {tag}
                                                            </span>
                                                        ))}
                                                        {tags.length > 4 && (
                                                            <span className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 dark:border-slate-700 dark:text-slate-500">
                                                                +{tags.length - 4}
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    '-'
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                                                {noDataReasonLabel(row.reason)}
                                            </td>
                                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                                                {row.rangeLabel || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {record && (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            openSplunkSearch(
                                                                record.search,
                                                                range,
                                                                record.dispatchContext
                                                            )
                                                        }
                                                        className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 transition-colors hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-400 dark:border-slate-700 dark:text-slate-300 dark:hover:border-sky-600 dark:hover:bg-sky-950/40 dark:hover:text-sky-200"
                                                    >
                                                        <Search className="h-3.5 w-3.5" />
                                                        Open
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
                </div>
                <button
                    type="button"
                    tabIndex={-1}
                    aria-label="Resize needs attention report from the left edge"
                    onPointerDown={(event) => startDialogResize(event, 'width', -1, 0)}
                    className="absolute bottom-10 left-0 top-14 z-20 w-2 cursor-ew-resize rounded-l-lg transition-colors hover:bg-sky-400/20"
                />
                <button
                    type="button"
                    tabIndex={-1}
                    aria-label="Resize needs attention report from the right edge"
                    onPointerDown={(event) => startDialogResize(event, 'width', 1, 0)}
                    className="absolute bottom-10 right-0 top-14 z-20 w-2 cursor-ew-resize rounded-r-lg transition-colors hover:bg-sky-400/20"
                />
                <button
                    type="button"
                    tabIndex={-1}
                    aria-label="Resize needs attention report from the top edge"
                    onPointerDown={(event) => startDialogResize(event, 'height', 0, -1)}
                    className="absolute left-10 right-10 top-0 z-20 h-2 cursor-ns-resize rounded-t-lg transition-colors hover:bg-sky-400/20"
                />
                <button
                    type="button"
                    tabIndex={-1}
                    aria-label="Resize needs attention report from the bottom edge"
                    onPointerDown={(event) => startDialogResize(event, 'height', 0, 1)}
                    className="absolute bottom-0 left-10 right-10 z-20 h-2 cursor-ns-resize transition-colors hover:bg-sky-400/20"
                />
                <button
                    type="button"
                    tabIndex={-1}
                    aria-label="Resize needs attention report from the corner"
                    onPointerDown={(event) => startDialogResize(event, 'both', 1, 1)}
                    className="absolute bottom-0 right-0 z-30 h-8 w-8 cursor-nwse-resize rounded-br-lg transition-colors hover:bg-sky-400/20"
                >
                    <span className="pointer-events-none absolute bottom-1 right-1 h-3 w-3 border-b border-r border-slate-400 dark:border-slate-500" />
                    <span className="pointer-events-none absolute bottom-2 right-2 h-2 w-2 border-b border-r border-slate-300 dark:border-slate-600" />
                </button>
            </div>
        </div>
    );
};

interface SearchbaseBrowserProps {
    open: boolean;
    records: SearchbaseRecord[];
    canvasTiles: CanvasTile[];
    replaceTileId: string | null;
    includeHiddenSearches: boolean;
    onClose: () => void;
    onAddRecord: (record: SearchbaseRecord) => void;
    onAddRecords: (records: SearchbaseRecord[]) => void;
    onIncludeHiddenSearchesChange: (includeHidden: boolean) => void;
}

const ALL = '__all__';
const UNSET_VIZ = '__unset_viz__';

const makeDefaultAppSelection = (): Set<string> => new Set([APP_NAME]);

const appSelectionsEqual = (
    left: ReadonlySet<string>,
    right: ReadonlySet<string>
): boolean => {
    if (left.size !== right.size) return false;
    for (const value of left) {
        if (!right.has(value)) return false;
    }
    return true;
};

const isDefaultAppSelection = (
    selection: ReadonlySet<string>,
    defaultSelection: ReadonlySet<string> = makeDefaultAppSelection()
): boolean => appSelectionsEqual(selection, defaultSelection);

const vizFilterValue = (record: SearchbaseRecord): string => {
    const raw = record.defaultViz?.trim();
    return raw ? raw.toLowerCase() : UNSET_VIZ;
};

const vizFilterLabel = (value: string): string =>
    value === UNSET_VIZ ? 'No default_viz' : formatVizLabel(value);

const recordOwnerApp = (record: SearchbaseRecord): string =>
    record.ownerApp || APP_NAME;

const recordDispatchContext = (record: SearchbaseRecord): string =>
    record.dispatchContext || recordOwnerApp(record);

const makeOwnerAppSelection = (records: SearchbaseRecord[]): Set<string> => {
    const selection = new Set<string>();
    for (const record of records) {
        if (recordOwnerApp(record) === APP_NAME) {
            selection.add(recordDispatchContext(record));
        }
    }
    return selection.size > 0 ? selection : makeDefaultAppSelection();
};

const recordMatchesAppSelection = (
    record: SearchbaseRecord,
    selection: ReadonlySet<string>
): boolean => selection.size === 0 || selection.has(recordDispatchContext(record));

const normalizeSearchIdentity = (value: unknown): string =>
    String(value ?? '').trim().toLowerCase();

const recordIsDrilldownSearch = (
    record: SearchbaseRecord,
    drilldownSearchNames: ReadonlySet<string>
): boolean =>
    drilldownSearchNames.has(normalizeSearchIdentity(record.searchName)) ||
    drilldownSearchNames.has(normalizeSearchIdentity(record.id));

const recordMatchesBrowserVisibility = (
    record: SearchbaseRecord,
    drilldownSearchNames: ReadonlySet<string>,
    includeHiddenSearches: boolean,
    includeDrilldownSearches: boolean,
    includeTableSearches: boolean
): boolean => {
    if (!includeHiddenSearches && record.searchHidden) {
        return false;
    }
    if (
        !includeDrilldownSearches &&
        recordIsDrilldownSearch(record, drilldownSearchNames)
    ) {
        return false;
    }
    if (!includeTableSearches && isTableViz(record.defaultViz)) {
        return false;
    }
    return true;
};

interface SearchableFilterSelectProps {
    value: string;
    options: string[];
    allLabel: string;
    searchPlaceholder: string;
    ariaLabel: string;
    onChange: (value: string) => void;
}

const SearchableFilterSelect: React.FC<SearchableFilterSelectProps> = ({
    value,
    options,
    allLabel,
    searchPlaceholder,
    ariaLabel,
    onChange,
}) => {
    const rootRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');

    const selectOptions = useMemo(
        () => [
            { value: ALL, label: allLabel },
            ...options.map((option) => ({ value: option, label: option })),
        ],
        [allLabel, options]
    );

    const selectedLabel = useMemo(() => {
        if (value === ALL) return allLabel;
        return selectOptions.find((option) => option.value === value)?.label ?? value;
    }, [allLabel, selectOptions, value]);

    const filteredOptions = useMemo(() => {
        const normalized = search.trim().toLowerCase();
        if (!normalized) return selectOptions;
        return selectOptions.filter((option) =>
            option.label.toLowerCase().includes(normalized)
        );
    }, [search, selectOptions]);

    useEffect(() => {
        if (!open) {
            setSearch('');
            return undefined;
        }

        const focusHandle = window.setTimeout(() => {
            inputRef.current?.focus();
        }, 0);
        const handlePointerDown = (event: MouseEvent | TouchEvent) => {
            if (
                rootRef.current &&
                event.target instanceof Node &&
                !rootRef.current.contains(event.target)
            ) {
                setOpen(false);
            }
        };

        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('touchstart', handlePointerDown);
        return () => {
            window.clearTimeout(focusHandle);
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('touchstart', handlePointerDown);
        };
    }, [open]);

    const selectValue = (nextValue: string) => {
        onChange(nextValue);
        setOpen(false);
        setSearch('');
    };

    return (
        <div ref={rootRef} className="relative">
            <button
                type="button"
                aria-label={ariaLabel}
                aria-haspopup="listbox"
                aria-expanded={open}
                onClick={() => setOpen((current) => !current)}
                onKeyDown={(event) => {
                    if (event.key === 'ArrowDown' || event.key === 'Enter') {
                        event.preventDefault();
                        setOpen(true);
                    }
                    if (event.key === 'Escape') {
                        setOpen(false);
                    }
                }}
                className="flex h-10 w-full items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-left text-sm text-slate-700 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-sky-900"
            >
                <span className="min-w-0 flex-1 truncate">{selectedLabel}</span>
                <ChevronDown
                    className={cn(
                        'h-4 w-4 flex-shrink-0 text-slate-500 transition-transform',
                        open && 'rotate-180'
                    )}
                />
            </button>

            {open && (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-950">
                    <label className="relative block border-b border-slate-100 dark:border-slate-800">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                            ref={inputRef}
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Escape') {
                                    event.stopPropagation();
                                    setOpen(false);
                                }
                                if (
                                    event.key === 'Enter' &&
                                    filteredOptions.length === 1
                                ) {
                                    event.preventDefault();
                                    selectValue(filteredOptions[0].value);
                                }
                            }}
                            placeholder={searchPlaceholder}
                            className="h-10 w-full bg-white pl-9 pr-3 text-sm text-slate-700 outline-none dark:bg-slate-950 dark:text-slate-100"
                        />
                    </label>
                    <div role="listbox" aria-label={ariaLabel} className="max-h-56 overflow-y-auto p-1">
                        {filteredOptions.length === 0 ? (
                            <div className="px-3 py-3 text-sm text-slate-500 dark:text-slate-400">
                                No matches
                            </div>
                        ) : (
                            filteredOptions.map((option) => {
                                const selected = option.value === value;
                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        role="option"
                                        aria-selected={selected}
                                        onClick={() => selectValue(option.value)}
                                        className={cn(
                                            'flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm transition-colors',
                                            selected
                                                ? 'bg-sky-50 font-bold text-sky-700 dark:bg-sky-950 dark:text-sky-200'
                                                : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-900'
                                        )}
                                    >
                                        <span className="min-w-0 flex-1 truncate">
                                            {option.label}
                                        </span>
                                        {selected && (
                                            <Check className="h-4 w-4 flex-shrink-0" />
                                        )}
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

interface SearchableAppMultiSelectProps {
    selectedApps: ReadonlySet<string>;
    options: string[];
    countsByApp: Map<string, number>;
    ariaLabel: string;
    onChange: (selection: Set<string>) => void;
}

const SearchableAppMultiSelect: React.FC<SearchableAppMultiSelectProps> = ({
    selectedApps,
    options,
    countsByApp,
    ariaLabel,
    onChange,
}) => {
    const rootRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');

    const selectableApps = useMemo(() => {
        const values = new Set(options);
        values.add(APP_NAME);
        for (const selectedApp of selectedApps) {
            values.add(selectedApp);
        }
        return Array.from(values).sort((left, right) => left.localeCompare(right));
    }, [options, selectedApps]);

    const totalCount = useMemo(
        () =>
            Array.from(countsByApp.values()).reduce(
                (total, count) => total + count,
                0
            ),
        [countsByApp]
    );

    const selectedLabel = useMemo(() => {
        if (selectedApps.size === 0) return `All apps (${totalCount})`;
        const selected = Array.from(selectedApps).sort((left, right) =>
            left.localeCompare(right)
        );
        if (selected.length === 1) return selected[0];
        return `${selected.length} apps selected`;
    }, [selectedApps, totalCount]);

    const filteredApps = useMemo(() => {
        const normalized = search.trim().toLowerCase();
        if (!normalized) return selectableApps;
        return selectableApps.filter((option) =>
            option.toLowerCase().includes(normalized)
        );
    }, [search, selectableApps]);

    const allAppsMatches = useMemo(() => {
        const normalized = search.trim().toLowerCase();
        return !normalized || 'all apps'.includes(normalized);
    }, [search]);

    useEffect(() => {
        if (!open) {
            setSearch('');
            return undefined;
        }

        const focusHandle = window.setTimeout(() => {
            inputRef.current?.focus();
        }, 0);
        const handlePointerDown = (event: MouseEvent | TouchEvent) => {
            if (
                rootRef.current &&
                event.target instanceof Node &&
                !rootRef.current.contains(event.target)
            ) {
                setOpen(false);
            }
        };

        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('touchstart', handlePointerDown);
        return () => {
            window.clearTimeout(focusHandle);
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('touchstart', handlePointerDown);
        };
    }, [open]);

    const setAllApps = () => onChange(new Set());

    const toggleApp = (option: string) => {
        const next = selectedApps.size === 0 ? new Set<string>() : new Set(selectedApps);
        if (next.has(option)) next.delete(option);
        else next.add(option);
        onChange(next);
    };

    return (
        <div ref={rootRef} className="relative">
            <button
                type="button"
                aria-label={ariaLabel}
                aria-haspopup="listbox"
                aria-expanded={open}
                onClick={() => setOpen((current) => !current)}
                onKeyDown={(event) => {
                    if (event.key === 'ArrowDown' || event.key === 'Enter') {
                        event.preventDefault();
                        setOpen(true);
                    }
                    if (event.key === 'Escape') {
                        setOpen(false);
                    }
                }}
                className="flex h-10 w-full items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-left text-sm font-semibold text-slate-700 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-sky-900"
            >
                <span className="min-w-0 flex-1 truncate">{selectedLabel}</span>
                <ChevronDown
                    className={cn(
                        'h-4 w-4 flex-shrink-0 text-slate-500 transition-transform',
                        open && 'rotate-180'
                    )}
                />
            </button>

            {open && (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-950">
                    <label className="relative block border-b border-slate-100 dark:border-slate-800">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                            ref={inputRef}
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Escape') {
                                    event.stopPropagation();
                                    setOpen(false);
                                }
                                if (
                                    event.key === 'Enter' &&
                                    filteredApps.length === 1 &&
                                    !allAppsMatches
                                ) {
                                    event.preventDefault();
                                    toggleApp(filteredApps[0]);
                                }
                            }}
                            placeholder="Search apps..."
                            className="h-10 w-full bg-white pl-9 pr-3 text-sm text-slate-700 outline-none dark:bg-slate-950 dark:text-slate-100"
                        />
                    </label>
                    <div
                        role="listbox"
                        aria-label={ariaLabel}
                        aria-multiselectable="true"
                        className="max-h-56 overflow-y-auto p-1"
                    >
                        {allAppsMatches && (
                            <button
                                type="button"
                                role="option"
                                aria-selected={selectedApps.size === 0}
                                onClick={setAllApps}
                                className={cn(
                                    'flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm transition-colors',
                                    selectedApps.size === 0
                                        ? 'bg-sky-50 font-bold text-sky-700 dark:bg-sky-950 dark:text-sky-200'
                                        : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-900'
                                )}
                            >
                                <span className="min-w-0 flex-1 truncate">All apps</span>
                                <span className="text-xs font-bold text-slate-400">
                                    {totalCount}
                                </span>
                                {selectedApps.size === 0 && (
                                    <Check className="h-4 w-4 flex-shrink-0" />
                                )}
                            </button>
                        )}
                        {filteredApps.length === 0 && !allAppsMatches ? (
                            <div className="px-3 py-3 text-sm text-slate-500 dark:text-slate-400">
                                No matches
                            </div>
                        ) : (
                            filteredApps.map((option) => {
                                const selected =
                                    selectedApps.size > 0 && selectedApps.has(option);
                                return (
                                    <button
                                        key={option}
                                        type="button"
                                        role="option"
                                        aria-selected={selected}
                                        onClick={() => toggleApp(option)}
                                        className={cn(
                                            'flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm transition-colors',
                                            selected
                                                ? 'bg-sky-50 font-bold text-sky-700 dark:bg-sky-950 dark:text-sky-200'
                                                : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-900'
                                        )}
                                    >
                                        <span className="min-w-0 flex-1 truncate">
                                            {option}
                                        </span>
                                        <span className="text-xs font-bold text-slate-400">
                                            {countsByApp.get(option) ?? 0}
                                        </span>
                                        {selected && (
                                            <Check className="h-4 w-4 flex-shrink-0" />
                                        )}
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const SearchbaseBrowser: React.FC<SearchbaseBrowserProps> = ({
    open,
    records,
    canvasTiles,
    replaceTileId,
    includeHiddenSearches,
    onClose,
    onAddRecord,
    onAddRecords,
    onIncludeHiddenSearchesChange,
}) => {
    const [query, setQuery] = useState('');
    const [selectedApps, setSelectedApps] = useState<Set<string>>(
        makeDefaultAppSelection
    );
    const [category, setCategory] = useState(ALL);
    const [subCategory, setSubCategory] = useState(ALL);
    const [vizType, setVizType] = useState(ALL);
    const [tagInput, setTagInput] = useState('');
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [includeDrilldownSearches, setIncludeDrilldownSearches] =
        useState(false);
    const [includeTableSearches, setIncludeTableSearches] = useState(false);
    const [filtersCollapsed, setFiltersCollapsed] = useState(true);
    const [selectedNames, setSelectedNames] = useState<Set<string>>(
        () => new Set()
    );

    const countsBySearch = useMemo(() => {
        const counts = new Map<string, number>();
        for (const tile of canvasTiles) {
            counts.set(tile.searchName, (counts.get(tile.searchName) ?? 0) + 1);
        }
        return counts;
    }, [canvasTiles]);

    useEffect(() => {
        if (open) {
            setFiltersCollapsed(true);
        }
    }, [open]);

    const drilldownSearchNames = useMemo(
        () =>
            new Set(
                records
                    .map((record) => record.drilldownSearchName)
                    .filter(Boolean)
                    .map(normalizeSearchIdentity)
            ),
        [records]
    );

    const browserRecords = useMemo(
        () =>
            records.filter((record) =>
                recordMatchesBrowserVisibility(
                    record,
                    drilldownSearchNames,
                    includeHiddenSearches,
                    includeDrilldownSearches,
                    includeTableSearches
                )
            ),
        [
            drilldownSearchNames,
            includeDrilldownSearches,
            includeHiddenSearches,
            includeTableSearches,
            records,
        ]
    );

    const defaultAppSelection = useMemo(
        () => makeOwnerAppSelection(records),
        [records]
    );

    useEffect(() => {
        setSelectedApps((current) => {
            if (appSelectionsEqual(current, defaultAppSelection)) return current;
            return isDefaultAppSelection(current)
                ? new Set(defaultAppSelection)
                : current;
        });
    }, [defaultAppSelection]);

    const blockedSearchNames = useMemo(() => {
        const names = new Set<string>();
        for (const tile of canvasTiles) {
            if (replaceTileId && tile.id === replaceTileId) continue;
            names.add(tile.searchName);
        }
        return names;
    }, [canvasTiles, replaceTileId]);

    useEffect(() => {
        setSelectedNames((current) => {
            let changed = false;
            const next = new Set<string>();
            for (const searchName of current) {
                if (blockedSearchNames.has(searchName)) {
                    changed = true;
                } else {
                    next.add(searchName);
                }
            }
            return changed ? next : current;
        });
    }, [blockedSearchNames]);

    const appOptions = useMemo(
        () =>
            Array.from(new Set(browserRecords.map(recordDispatchContext))).sort(
                (left, right) => left.localeCompare(right)
            ),
        [browserRecords]
    );

    const appCountsByName = useMemo(() => {
        const counts = new Map<string, number>();
        for (const record of browserRecords) {
            const value = recordDispatchContext(record);
            counts.set(value, (counts.get(value) ?? 0) + 1);
        }
        return counts;
    }, [browserRecords]);

    useEffect(() => {
        setSelectedApps((current) => {
            if (current.size === 0) return current;

            const availableApps = new Set(appOptions);
            for (const defaultApp of defaultAppSelection) {
                availableApps.add(defaultApp);
            }

            let changed = false;
            const next = new Set<string>();
            for (const selectedApp of current) {
                if (availableApps.has(selectedApp)) {
                    next.add(selectedApp);
                } else {
                    changed = true;
                }
            }

            if (!changed) return current;
            return next.size > 0 ? next : new Set(defaultAppSelection);
        });
    }, [appOptions, defaultAppSelection]);

    const appScopedRecords = useMemo(
        () =>
            browserRecords.filter((record) =>
                recordMatchesAppSelection(record, selectedApps)
            ),
        [browserRecords, selectedApps]
    );

    const categoryOptions = useMemo(
        () =>
            Array.from(
                new Set(appScopedRecords.map((record) => record.category).filter(Boolean))
            ).sort(),
        [appScopedRecords]
    );

    useEffect(() => {
        if (category !== ALL && !categoryOptions.includes(category)) {
            setCategory(ALL);
            setSubCategory(ALL);
            setVizType(ALL);
            setSelectedTags([]);
            setTagInput('');
        }
    }, [category, categoryOptions]);

    const categoryScopedRecords = useMemo(
        () =>
            appScopedRecords.filter((record) =>
                category === ALL ? true : record.category === category
            ),
        [appScopedRecords, category]
    );

    const subCategoryOptions = useMemo(
        () =>
            Array.from(
                new Set(
                    categoryScopedRecords
                        .map((record) => record.subCategory)
                        .filter(Boolean)
                )
            ).sort(),
        [categoryScopedRecords]
    );

    useEffect(() => {
        if (subCategory !== ALL && !subCategoryOptions.includes(subCategory)) {
            setSubCategory(ALL);
            setVizType(ALL);
            setSelectedTags([]);
            setTagInput('');
        }
    }, [subCategory, subCategoryOptions]);

    useEffect(() => {
        setSubCategory(ALL);
    }, [category]);

    const subCategoryScopedRecords = useMemo(
        () =>
            categoryScopedRecords.filter((record) =>
                subCategory === ALL ? true : record.subCategory === subCategory
            ),
        [categoryScopedRecords, subCategory]
    );

    const vizTypeOptions = useMemo(() => {
        const counts = new Map<string, number>();
        for (const record of subCategoryScopedRecords) {
            const value = vizFilterValue(record);
            counts.set(value, (counts.get(value) ?? 0) + 1);
        }
        return Array.from(counts.entries())
            .map(([value, count]) => ({
                value,
                count,
                label: vizFilterLabel(value),
            }))
            .sort((a, b) => {
                if (a.value === UNSET_VIZ) return 1;
                if (b.value === UNSET_VIZ) return -1;
                return a.label.localeCompare(b.label);
            });
    }, [subCategoryScopedRecords]);

    useEffect(() => {
        if (
            vizType !== ALL &&
            !vizTypeOptions.some((option) => option.value === vizType)
        ) {
            setVizType(ALL);
        }
    }, [vizType, vizTypeOptions]);

    const facetScopedRecords = useMemo(
        () =>
            subCategoryScopedRecords.filter((record) =>
                vizType === ALL ? true : vizFilterValue(record) === vizType
            ),
        [subCategoryScopedRecords, vizType]
    );

    const tagScopedRecords = useMemo(
        () =>
            facetScopedRecords.filter((record) =>
                selectedTags.every((tag) => record.tags.includes(tag))
            ),
        [facetScopedRecords, selectedTags]
    );

    const availableTagCount = useMemo(
        () => new Set(facetScopedRecords.flatMap((record) => record.tags)).size,
        [facetScopedRecords]
    );

    const tagOptions = useMemo(() => {
        const tagCounts = new Map<string, number>();
        for (const record of tagScopedRecords) {
            for (const tag of record.tags) {
                tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
            }
        }
        const normalizedInput = tagInput.trim().toLowerCase();
        return Array.from(tagCounts.entries())
            .filter(([tag]) => !selectedTags.includes(tag))
            .filter(([tag]) =>
                normalizedInput ? tag.toLowerCase().includes(normalizedInput) : true
            )
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
            .slice(0, 18)
            .map(([tag, count]) => ({ tag, count }));
    }, [selectedTags, tagInput, tagScopedRecords]);

    const filteredRecords = useMemo(() => {
        return tagScopedRecords.filter((record) =>
            recordMatchesCatalogueQuery(record, query, plainTextFromHtml)
        );
    }, [query, tagScopedRecords]);
    const availableSearchCount = filteredRecords.length;
    const availableSearchLabel = `${availableSearchCount.toLocaleString()} ${
        availableSearchCount === 1 ? 'search' : 'searches'
    } available`;

    const selectedRecords = useMemo(
        () =>
            filteredRecords.filter(
                (record) =>
                    selectedNames.has(record.searchName) &&
                    !blockedSearchNames.has(record.searchName)
            ),
        [blockedSearchNames, filteredRecords, selectedNames]
    );

    const addableFilteredRecords = useMemo(
        () =>
            filteredRecords.filter(
                (record) => !blockedSearchNames.has(record.searchName)
            ),
        [blockedSearchNames, filteredRecords]
    );

    const activeFilterChips = useMemo(() => {
        const chips: Array<{ id: string; label: string }> = [];
        if (!isDefaultAppSelection(selectedApps, defaultAppSelection)) {
            const selectedAppLabels = Array.from(selectedApps).sort((left, right) =>
                left.localeCompare(right)
            );
            const label =
                selectedAppLabels.length === 0
                    ? 'All apps'
                    : selectedAppLabels.length === 1
                      ? `App: ${selectedAppLabels[0]}`
                      : `Apps: ${selectedAppLabels
                            .slice(0, 2)
                            .join(', ')}${
                            selectedAppLabels.length > 2
                                ? ` +${selectedAppLabels.length - 2}`
                                : ''
                        }`;
            chips.push({
                id: 'app-selection',
                label,
            });
        }
        if (includeHiddenSearches) {
            chips.push({ id: 'hidden', label: 'Hidden included' });
        }
        if (includeDrilldownSearches) {
            chips.push({ id: 'drilldown', label: 'Drill-down included' });
        }
        if (includeTableSearches) {
            chips.push({ id: 'tables', label: 'Tables included' });
        }
        if (category !== ALL) chips.push({ id: `category-${category}`, label: category });
        if (subCategory !== ALL) {
            chips.push({ id: `sub-category-${subCategory}`, label: subCategory });
        }
        if (vizType !== ALL) {
            chips.push({ id: `viz-${vizType}`, label: vizFilterLabel(vizType) });
        }
        for (const tag of selectedTags) chips.push({ id: `tag-${tag}`, label: tag });
        return chips;
    }, [
        category,
        defaultAppSelection,
        includeDrilldownSearches,
        includeHiddenSearches,
        includeTableSearches,
        selectedApps,
        selectedTags,
        subCategory,
        vizType,
    ]);

    const hasActiveFilters =
        query.trim().length > 0 || activeFilterChips.length > 0;

    const resetFilters = () => {
        setQuery('');
        setSelectedApps(new Set(defaultAppSelection));
        onIncludeHiddenSearchesChange(false);
        setIncludeDrilldownSearches(false);
        setIncludeTableSearches(false);
        setCategory(ALL);
        setSubCategory(ALL);
        setVizType(ALL);
        setSelectedTags([]);
        setTagInput('');
        setSelectedNames(new Set());
    };

    const toggleSelected = (searchName: string) => {
        if (blockedSearchNames.has(searchName)) return;
        setSelectedNames((current) => {
            const next = new Set(current);
            if (next.has(searchName)) next.delete(searchName);
            else next.add(searchName);
            return next;
        });
    };

    const selectTag = (tag: string) => {
        setSelectedTags((current) => (current.includes(tag) ? current : [...current, tag]));
        setTagInput('');
    };

    if (!open) return null;

    const replaceMode = replaceTileId !== null;

    return (
        <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[560px] flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-300">
                    <SlidersHorizontal className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                    <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">
                        {replaceMode ? 'Replace tile' : 'Add tiles'}
                    </div>
                    <h2 className="truncate text-lg font-black text-slate-900 dark:text-slate-50">
                        Searchbase catalogue
                    </h2>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    title="Close"
                    aria-label="Close"
                    className="ml-auto rounded p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                >
                    <X className="h-5 w-5" />
                </button>
            </div>

            <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                <label className="relative block">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Filter by stanza, name, SPL, or description..."
                        className="h-11 w-full rounded-md border border-slate-300 bg-white pl-10 pr-3 text-sm font-medium text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-sky-900"
                    />
                </label>

                <div className="mt-3 flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setFiltersCollapsed((current) => !current)}
                        aria-expanded={!filtersCollapsed}
                        className="inline-flex min-w-0 items-center gap-2 rounded-md bg-slate-100 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-slate-800 transition hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-300 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 dark:focus:ring-sky-800"
                    >
                        <span>Filters</span>
                        {hasActiveFilters && (
                            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] tracking-normal text-sky-700 dark:bg-sky-900 dark:text-sky-200">
                                active
                            </span>
                        )}
                        <ChevronDown
                            className={cn(
                                'h-4 w-4 flex-shrink-0 text-slate-500 transition-transform dark:text-slate-300',
                                filtersCollapsed && '-rotate-90'
                            )}
                        />
                    </button>
                    <div className="ml-auto flex items-center gap-3">
                        <span
                            title="Searchbase stanzas matching the current app, visibility, category, sub-category, viz, tag, and text filters"
                            className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-black uppercase tracking-wider text-sky-700 shadow-sm dark:border-sky-900/70 dark:bg-sky-950/50 dark:text-sky-200"
                        >
                            {availableSearchLabel}
                        </span>
                        <button
                            type="button"
                            onClick={resetFilters}
                            className="text-xs font-black uppercase tracking-[0.18em] text-slate-400 transition-colors hover:text-sky-600 dark:hover:text-sky-300"
                        >
                            Clear filters
                        </button>
                    </div>
                </div>

                {filtersCollapsed ? (
                    activeFilterChips.length > 0 && (
                        <div className="mt-2 flex max-h-14 flex-wrap gap-1 overflow-y-auto">
                            {activeFilterChips.slice(0, 10).map((chip) => (
                                <span
                                    key={chip.id}
                                    className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                                >
                                    {chip.label}
                                </span>
                            ))}
                            {activeFilterChips.length > 10 && (
                                <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                    +{activeFilterChips.length - 10}
                                </span>
                            )}
                        </div>
                    )
                ) : (
                    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/60">
                        <div className="grid grid-cols-[76px_minmax(0,1fr)] gap-x-3 gap-y-3">
                            <span className="self-center text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                                App
                            </span>
                            <SearchableAppMultiSelect
                                selectedApps={selectedApps}
                                options={appOptions}
                                countsByApp={appCountsByName}
                                ariaLabel="Filter searches by app"
                                onChange={(nextSelection) => {
                                    setSelectedApps(nextSelection);
                                    setCategory(ALL);
                                    setSubCategory(ALL);
                                    setVizType(ALL);
                                    setSelectedTags([]);
                                    setTagInput('');
                                }}
                            />

                            <span className="self-start pt-4 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                                Visibility
                            </span>
                            <div className="grid gap-2 sm:grid-cols-3">
                                <label className="flex min-h-16 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm font-bold leading-tight text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100">
                                    <input
                                        type="checkbox"
                                        checked={includeHiddenSearches}
                                        onChange={(event) =>
                                            onIncludeHiddenSearchesChange(
                                                event.target.checked
                                            )
                                        }
                                        className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-400 dark:border-slate-700 dark:bg-slate-950"
                                    />
                                    <span>Show hidden searches</span>
                                </label>
                                <label className="flex min-h-16 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm font-bold leading-tight text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100">
                                    <input
                                        type="checkbox"
                                        checked={includeDrilldownSearches}
                                        onChange={(event) =>
                                            setIncludeDrilldownSearches(
                                                event.target.checked
                                            )
                                        }
                                        className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-400 dark:border-slate-700 dark:bg-slate-950"
                                    />
                                    <span>Show drill-down searches</span>
                                </label>
                                <label className="flex min-h-16 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm font-bold leading-tight text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100">
                                    <input
                                        type="checkbox"
                                        checked={includeTableSearches}
                                        onChange={(event) =>
                                            setIncludeTableSearches(event.target.checked)
                                        }
                                        className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-400 dark:border-slate-700 dark:bg-slate-950"
                                    />
                                    <span>Show table searches</span>
                                </label>
                            </div>

                            <label className="self-center text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                                Category
                            </label>
                            <SearchableFilterSelect
                                value={category}
                                options={categoryOptions}
                                allLabel="All categories"
                                searchPlaceholder="Search categories..."
                                ariaLabel="Category"
                                onChange={(value) => {
                                    setCategory(value);
                                    setSubCategory(ALL);
                                    setVizType(ALL);
                                    setSelectedTags([]);
                                    setTagInput('');
                                }}
                            />

                            {category !== ALL && subCategoryOptions.length > 0 && (
                                <>
                                    <label className="self-center text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                                        Sub-cat
                                    </label>
                                    <SearchableFilterSelect
                                        value={subCategory}
                                        options={subCategoryOptions}
                                        allLabel={`All sub-categories (${subCategoryOptions.length})`}
                                        searchPlaceholder="Search sub-categories..."
                                        ariaLabel="Sub-category"
                                        onChange={(value) => {
                                            setSubCategory(value);
                                            setVizType(ALL);
                                            setSelectedTags([]);
                                            setTagInput('');
                                        }}
                                    />
                                </>
                            )}

                            <label className="self-center text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                                Viz
                            </label>
                            <select
                                value={vizType}
                                onChange={(event) => {
                                    setVizType(event.target.value);
                                    setSelectedTags([]);
                                    setTagInput('');
                                }}
                                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-sky-900"
                            >
                                <option value={ALL}>All viz types</option>
                                {vizTypeOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label} ({option.count})
                                    </option>
                                ))}
                            </select>

                            <label className="self-center text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                                Tags
                            </label>
                            <div>
                                <input
                                    value={tagInput}
                                    onChange={(event) => setTagInput(event.target.value)}
                                    placeholder={`Filter by tag (${availableTagCount} tags available, AND combined)...`}
                                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-sky-900"
                                />
                                {(selectedTags.length > 0 || tagOptions.length > 0) && (
                                    <div className="mt-2 flex max-h-20 flex-wrap gap-1 overflow-y-auto">
                                        {selectedTags.map((tag) => (
                                            <button
                                                key={tag}
                                                type="button"
                                                onClick={() =>
                                                    setSelectedTags((current) =>
                                                        current.filter(
                                                            (value) => value !== tag
                                                        )
                                                    )
                                                }
                                                className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-1 text-[11px] font-bold text-sky-700 hover:bg-sky-200 dark:bg-sky-900 dark:text-sky-100 dark:hover:bg-sky-800"
                                            >
                                                {tag}
                                                <X className="h-3 w-3" />
                                            </button>
                                        ))}
                                        {tagOptions.map(({ tag, count }) => (
                                            <button
                                                key={tag}
                                                type="button"
                                                onClick={() => selectTag(tag)}
                                                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-500 hover:border-sky-300 hover:text-sky-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400 dark:hover:border-sky-700 dark:hover:text-sky-300"
                                            >
                                                {tag}
                                                <span className="text-slate-400">{count}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <span
                    className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 font-black uppercase tracking-wider text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/50 dark:text-sky-200"
                    title={`${browserRecords.length.toLocaleString()} searches are in the current app and visibility scope before category, tag, viz, and text filters`}
                >
                    {availableSearchLabel}
                </span>
                {!replaceMode && addableFilteredRecords.length !== filteredRecords.length && (
                    <span>{addableFilteredRecords.length.toLocaleString()} addable</span>
                )}
                {!replaceMode && selectedNames.size > 0 && (
                    <span>{selectedNames.size.toLocaleString()} selected</span>
                )}
                {!replaceMode && (
                    <div className="ml-auto flex flex-wrap justify-end gap-2">
                        <button
                            type="button"
                            disabled={addableFilteredRecords.length === 0}
                            onClick={() => {
                                onAddRecords(addableFilteredRecords);
                                setSelectedNames(new Set());
                            }}
                            className="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-white px-3 py-1.5 text-xs font-black text-sky-700 transition hover:border-sky-300 hover:bg-sky-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 dark:border-sky-900 dark:bg-slate-950 dark:text-sky-300 dark:hover:bg-sky-950 dark:disabled:border-slate-800 dark:disabled:bg-slate-900 dark:disabled:text-slate-600"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            Add all filtered
                        </button>
                        <button
                            type="button"
                            disabled={selectedRecords.length === 0}
                            onClick={() => {
                                onAddRecords(selectedRecords);
                                setSelectedNames(new Set());
                            }}
                            className="inline-flex items-center gap-1 rounded-md bg-sky-600 px-3 py-1.5 text-xs font-black text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            Add selected
                        </button>
                    </div>
                )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
                {browserRecords.length === 0 ? (
                    <div className="rounded-md border border-dashed border-slate-300 p-5 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                        Searchbase catalogue is empty in this runtime.
                    </div>
                ) : filteredRecords.length === 0 ? (
                    <div className="rounded-md border border-dashed border-slate-300 p-5 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                        No matches.
                    </div>
                ) : (
                    <div className="space-y-2">
                        {filteredRecords.map((record) => {
                            const canvasCount = countsBySearch.get(record.searchName) ?? 0;
                            const duplicateBlocked = blockedSearchNames.has(
                                record.searchName
                            );
                            const checked = selectedNames.has(record.searchName);
                            return (
                                <div
                                    key={record.id || record.searchName}
                                    className={cn(
                                        'rounded-md border bg-white p-3 transition-colors dark:bg-slate-950',
                                        checked
                                            ? 'border-sky-300 ring-1 ring-sky-200 dark:border-sky-700 dark:ring-sky-900'
                                            : 'border-slate-200 hover:border-sky-200 dark:border-slate-800 dark:hover:border-sky-800'
                                    )}
                                >
                                    <div className="flex items-start gap-2">
                                        {!replaceMode && (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    toggleSelected(record.searchName)
                                                }
                                                disabled={duplicateBlocked}
                                                aria-label={`Select ${record.searchName}`}
                                                aria-checked={checked}
                                                role="checkbox"
                                                className={cn(
                                                    'mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border-2 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-sky-300 dark:focus:ring-sky-800',
                                                    checked
                                                        ? 'border-sky-500 bg-sky-500 text-white'
                                                        : duplicateBlocked
                                                        ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-transparent opacity-60 dark:border-slate-800 dark:bg-slate-900'
                                                        : 'border-slate-400 bg-white text-transparent hover:border-sky-500 hover:bg-sky-50 dark:border-slate-600 dark:bg-slate-950 dark:hover:border-sky-500 dark:hover:bg-sky-950'
                                                )}
                                            >
                                                <Check className="h-3.5 w-3.5" />
                                            </button>
                                        )}
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <h3 className="truncate text-sm font-black text-slate-900 dark:text-slate-50">
                                                    {record.searchName}
                                                </h3>
                                                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-black uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                                                    {formatVizLabel(record.defaultViz)}
                                                </span>
                                            </div>
                                            <div className="mt-0.5 truncate text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                                {[
                                                    record.category,
                                                    record.subCategory,
                                                    recordDispatchContext(record),
                                                ]
                                                    .filter(Boolean)
                                                    .join(' / ')}
                                            </div>
                                            <p className="mt-1 line-clamp-2 text-xs leading-snug text-slate-600 dark:text-slate-300">
                                                {recordPlainText(record) || record.id}
                                            </p>
                                            {record.tags.length > 0 && (
                                                <div className="mt-2 flex flex-wrap gap-1">
                                                    {record.tags.slice(0, 5).map((tag) => (
                                                        <button
                                                            key={tag}
                                                            type="button"
                                                            onClick={() => selectTag(tag)}
                                                            className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 hover:bg-sky-100 hover:text-sky-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-sky-900 dark:hover:text-sky-100"
                                                        >
                                                            {tag}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => onAddRecord(record)}
                                            disabled={duplicateBlocked}
                                            title={
                                                duplicateBlocked
                                                    ? 'Already on the canvas'
                                                    : replaceMode
                                                    ? 'Replace tile'
                                                    : 'Add tile'
                                            }
                                            className="inline-flex flex-shrink-0 items-center gap-1 rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-black text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-sky-200 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
                                        >
                                            <Plus className="h-3.5 w-3.5" />
                                            {duplicateBlocked
                                                ? 'Added'
                                                : replaceMode
                                                ? 'Replace'
                                                : 'Add'}
                                        </button>
                                    </div>
                                    {canvasCount > 0 && (
                                        <div className="mt-2 text-[11px] font-semibold text-sky-600 dark:text-sky-300">
                                            In canvas: {canvasCount}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </aside>
    );
};

const SearchbaseCanvasPage: React.FC = () => {
    const initial = useMemo(readPersistedState, []);
    const [canvasName, setCanvasName] = useState(initial.canvasName);
    const [pageSize, setPageSize] = useState<PageSize>(initial.pageSize);
    const [tiles, setTiles] = useState<CanvasTile[]>(initial.tiles);
    const [records, setRecords] = useState<SearchbaseRecord[]>([]);
    const [catalogueError, setCatalogueError] = useState<string | null>(null);
    const [loadingCatalogue, setLoadingCatalogue] = useState(true);
    const [includeHiddenSearches, setIncludeHiddenSearches] = useState(false);
    const [rangeLabel, setRangeLabel] = useState(DEFAULT_TIME_RANGE_LABEL);
    const [refreshToken, setRefreshToken] = useState(0);
    const [tileRefreshCounts, setTileRefreshCounts] = useState<Record<string, number>>({});
    const [browserOpen, setBrowserOpen] = useState(tiles.length === 0);
    const [replaceTileId, setReplaceTileId] = useState<string | null>(null);
    const [activeDetailTable, setActiveDetailTable] =
        useState<SearchbaseDetailTableConfig | null>(null);
    const [noDataReportOpen, setNoDataReportOpen] = useState(false);
    const [pageIndex, setPageIndex] = useState(0);
    const [tileSearchQuery, setTileSearchQuery] = useState('');
    const [tileResultFilter, setTileResultFilter] =
        useState<TileResultFilter>('all');
    const [presentationMode, setPresentationMode] = useState(false);
    const [runningTileIds, setRunningTileIds] = useState<Set<string>>(
        () => new Set()
    );
    const userStoppedRef = useRef(false);
    const runningTileIdsRef = useRef(runningTileIds);
    runningTileIdsRef.current = runningTileIds;
    const runnableVisibleTilesRef = useRef<CanvasTile[]>([]);
    const runVisibleTilesRef = useRef<() => void>(() => undefined);
    const [observedNoDataByTile, setObservedNoDataByTile] = useState<
        Map<string, ObservedNoDataEntry>
    >(() => new Map());
    const [overlayFieldsByTile, setOverlayFieldsByTile] = useState<
        Map<string, string[]>
    >(() => new Map());
    const [metricResultCacheByTile, setMetricResultCacheByTile] = useState<
        Map<string, CachedMetricResultEntry>
    >(() => new Map());
    const [tableDataCacheByTile, setTableDataCacheByTile] = useState<
        Map<string, CachedTableDataEntry>
    >(() => new Map());
    const [savedCanvases, setSavedCanvases] = useState<SearchbaseCanvasSummary[]>(
        []
    );
    const [activeSavedCanvasName, setActiveSavedCanvasName] = useState<
        string | null
    >(null);
    const [lastSavedSignature, setLastSavedSignature] = useState('');
    const [saveStatus, setSaveStatus] = useState('');
    const [savingCanvas, setSavingCanvas] = useState(false);
    const [moreMenuOpen, setMoreMenuOpen] = useState(false);
    const [editingCanvasName, setEditingCanvasName] = useState(false);
    const canvasNameInputRef = useRef<HTMLInputElement | null>(null);
    const { theme, resolvedTheme, cycle } = useTheme();

    const range =
        TIME_RANGE_OPTIONS.find((option) => option.label === rangeLabel) ??
        TIME_RANGE_OPTIONS[1];
    const currentCanvasPayload = useMemo(
        () => canvasPayloadFromState(canvasName, pageSize, rangeLabel, tiles),
        [canvasName, pageSize, rangeLabel, tiles]
    );
    const currentCanvasSignature = useMemo(
        () => canvasPayloadSignature(currentCanvasPayload),
        [currentCanvasPayload]
    );
    const canvasDirty =
        activeSavedCanvasName !== null &&
        lastSavedSignature.length > 0 &&
        currentCanvasSignature !== lastSavedSignature;
    const hasUnsavedCurrentCanvas =
        activeSavedCanvasName === null &&
        (tiles.length > 0 ||
            (canvasName.trim().length > 0 &&
                canvasName.trim() !== 'Searchbase Canvas'));
    const observedNoDataRows = useMemo(
        () => Array.from(observedNoDataByTile.values()),
        [observedNoDataByTile]
    );
    const canvasNameDisplay = canvasName.trim() || 'Untitled canvas';

    useEffect(() => {
        if (!editingCanvasName) return;
        canvasNameInputRef.current?.focus();
        canvasNameInputRef.current?.select();
    }, [editingCanvasName]);

    useEffect(() => {
        if (!presentationMode) return undefined;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setPresentationMode(false);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [presentationMode]);

    useEffect(() => {
        let cancelled = false;
        setLoadingCatalogue(true);
        getSearchbaseCatalogue({ allApps: true, includeHidden: true })
            .then((list) => {
                if (cancelled) return;
                setRecords(list);
                setCatalogueError(null);
            })
            .catch((error) => {
                if (cancelled) return;
                setCatalogueError(error instanceof Error ? error.message : String(error));
            })
            .finally(() => {
                if (!cancelled) setLoadingCatalogue(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const refreshSavedCanvases = useCallback(() => {
        listSearchbaseCanvases()
            .then((list) => {
                setSavedCanvases(list);
            })
            .catch((error) => {
                setSaveStatus(
                    `Canvas list failed: ${
                        error instanceof Error ? error.message : String(error)
                    }`
                );
            });
    }, []);

    useEffect(() => {
        refreshSavedCanvases();
    }, [refreshSavedCanvases]);

    useEffect(() => {
        persistState({ canvasName, pageSize, tiles });
    }, [canvasName, pageSize, tiles]);

    useEffect(() => {
        setObservedNoDataByTile(new Map());
        setOverlayFieldsByTile(new Map());
        setMetricResultCacheByTile(new Map());
        setTableDataCacheByTile(new Map());
        setTileResultFilter('all');
    }, [rangeLabel]);

    const entryByName = useMemo(() => {
        const map = new Map<string, SearchbaseRecord>();
        for (const record of records) {
            if (record.searchName) map.set(record.searchName, record);
        }
        return map;
    }, [records]);

    const cachedResultForTile = useCallback(
        (tile: CanvasTile): CachedTileResult | undefined => {
            const record = entryByName.get(tile.searchName);
            if (!record) return undefined;
            const viz = effectiveTileViz(tile, record);
            if (isTableBackedTileViz(viz)) {
                return tableDataCacheByTile.get(tile.id)?.result;
            }
            return metricResultCacheByTile.get(tile.id)?.result;
        },
        [entryByName, metricResultCacheByTile, tableDataCacheByTile]
    );

    const resultStatusForTile = useCallback(
        (tile: CanvasTile): TileResultStatus => {
            if (observedNoDataByTile.has(tile.id)) return 'needs_attention';
            return tileResultStatusFromResult(cachedResultForTile(tile));
        },
        [cachedResultForTile, observedNoDataByTile]
    );

    const tileSearchTerms = useMemo(
        () =>
            tileSearchQuery
                .trim()
                .toLowerCase()
                .split(/\s+/)
                .filter(Boolean),
        [tileSearchQuery]
    );
    const hasTileSearch = tileSearchTerms.length > 0;
    const searchedTiles = useMemo(() => {
        if (!hasTileSearch) return tiles;
        return tiles.filter((tile) => {
            const record = entryByName.get(tile.searchName);
            const searchableText = [
                tile.searchName,
                record?.id,
                record?.searchName,
                record?.category,
                record?.subCategory,
                ...(record?.tags ?? []),
                record?.search,
                record?.description ? plainTextFromHtml(record.description) : '',
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            return tileSearchTerms.every((term) => searchableText.includes(term));
        });
    }, [entryByName, hasTileSearch, tileSearchTerms, tiles]);
    const resultFilterCounts = useMemo(() => {
        const counts: Record<TileResultStatus, number> = {
            needs_attention: 0,
            working: 0,
            unobserved: 0,
        };
        for (const tile of searchedTiles) {
            counts[resultStatusForTile(tile)] += 1;
        }
        return counts;
    }, [resultStatusForTile, searchedTiles]);
    const filteredTiles = useMemo(() => {
        if (tileResultFilter === 'all') return searchedTiles;
        return searchedTiles.filter(
            (tile) => resultStatusForTile(tile) === tileResultFilter
        );
    }, [resultStatusForTile, searchedTiles, tileResultFilter]);

    const totalPages = Math.max(1, Math.ceil(filteredTiles.length / pageSize));
    const clampedPageIndex = Math.min(pageIndex, totalPages - 1);
    const pageStart = clampedPageIndex * pageSize;
    const visibleTiles = filteredTiles.slice(pageStart, pageStart + pageSize);
    const pageEnd = Math.min(pageStart + pageSize, filteredTiles.length);
    const visibleTilesRunKey = useMemo(
        () =>
            filteredTiles
                .slice(pageStart, pageStart + pageSize)
                .filter((tile) => entryByName.has(tile.searchName))
                .map((tile) => tile.id)
                .join('\u0001'),
        [clampedPageIndex, entryByName, filteredTiles, pageSize, pageStart]
    );
    const runnableVisibleTiles = useMemo(
        () =>
            filteredTiles
                .slice(pageStart, pageStart + pageSize)
                .filter((tile) => entryByName.has(tile.searchName)),
        [clampedPageIndex, entryByName, filteredTiles, pageSize, pageStart]
    );
    const idleVisibleTileCount = runnableVisibleTiles.filter(
        (tile) => !runningTileIds.has(tile.id)
    ).length;
    const runVisibleTitle =
        idleVisibleTileCount > 0
            ? `Run ${idleVisibleTileCount.toLocaleString()} visible ${
                  idleVisibleTileCount === 1 ? 'tile' : 'tiles'
              }`
            : 'All visible tiles are already active';

    useEffect(() => {
        setPageIndex((current) => Math.min(current, totalPages - 1));
    }, [totalPages]);

    useEffect(() => {
        setPageIndex(0);
    }, [tileResultFilter, tileSearchQuery]);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const runNewTiles = useCallback(
        (newTiles: CanvasTile[], limit = MAX_BATCH_RUNS) => {
            const tileIds = newTiles.slice(0, limit).map((tile) => tile.id);
            if (tileIds.length === 0) return;
            setRunningTileIds((current) => {
                const next = new Set(current);
                for (const tileId of tileIds) {
                    next.add(tileId);
                }
                return next;
            });
        },
        []
    );

    const clearObservedNoData = useCallback((tileIds: string[]) => {
        if (tileIds.length === 0) return;
        setObservedNoDataByTile((current) => {
            let changed = false;
            const next = new Map(current);
            for (const tileId of tileIds) {
                if (next.delete(tileId)) changed = true;
            }
            return changed ? next : current;
        });
    }, []);

    const clearTileResultCache = useCallback((tileIds: string[]) => {
        if (tileIds.length === 0) return;
        setMetricResultCacheByTile((current) => {
            let changed = false;
            const next = new Map(current);
            for (const tileId of tileIds) {
                if (next.delete(tileId)) changed = true;
            }
            return changed ? next : current;
        });
        setTableDataCacheByTile((current) => {
            let changed = false;
            const next = new Map(current);
            for (const tileId of tileIds) {
                if (next.delete(tileId)) changed = true;
            }
            return changed ? next : current;
        });
    }, []);

    const updateMetricResultCache = useCallback(
        (tileId: string, cacheKey: string, result: MetricResult) => {
            setMetricResultCacheByTile((current) => {
                const previous = current.get(tileId);
                if (previous?.key === cacheKey && previous.result === result) {
                    return current;
                }
                const next = new Map(current);
                next.set(tileId, { key: cacheKey, result });
                return next;
            });
        },
        []
    );

    const updateTableDataCache = useCallback(
        (tileId: string, cacheKey: string, result: TableDataResult) => {
            setTableDataCacheByTile((current) => {
                const previous = current.get(tileId);
                if (previous?.key === cacheKey && previous.result === result) {
                    return current;
                }
                const next = new Map(current);
                next.set(tileId, { key: cacheKey, result });
                return next;
            });
        },
        []
    );

    const updateNoDataObservation = useCallback(
        (tileId: string, entry: ObservedNoDataEntry | null) => {
            setObservedNoDataByTile((current) => {
                const previous = current.get(tileId);
                if (!entry) {
                    if (!previous) return current;
                    const next = new Map(current);
                    next.delete(tileId);
                    return next;
                }
                if (
                    previous?.stanzaName === entry.stanzaName &&
                    previous?.searchName === entry.searchName &&
                    previous?.reason === entry.reason &&
                    previous?.rangeLabel === entry.rangeLabel
                ) {
                    return current;
                }
                const next = new Map(current);
                next.set(tileId, entry);
                return next;
            });
        },
        []
    );

    const updateOverlayFields = useCallback((tileId: string, fields: string[]) => {
        const nextFields = fields.filter((field) => normalizeTileOverlayField(field));
        setOverlayFieldsByTile((current) => {
            const previous = current.get(tileId) ?? [];
            if (
                previous.length === nextFields.length &&
                previous.every((field, index) => field === nextFields[index])
            ) {
                return current;
            }
            const next = new Map(current);
            if (nextFields.length === 0) {
                next.delete(tileId);
            } else {
                next.set(tileId, nextFields);
            }
            return next;
        });
    }, []);

    const saveCanvasWithName = useCallback(
        async (name: string) => {
            const trimmed = name.trim();
            if (!trimmed) return;
            setSavingCanvas(true);
            setSaveStatus('Saving canvas...');
            try {
                const payload = {
                    ...currentCanvasPayload,
                    canvasName: trimmed,
                };
                const summary = await saveSearchbaseCanvas(trimmed, payload);
                const savedPayload = {
                    ...payload,
                    canvasName: summary.title || trimmed,
                };
                setCanvasName(savedPayload.canvasName);
                setActiveSavedCanvasName(summary.name);
                setLastSavedSignature(canvasPayloadSignature(savedPayload));
                setSaveStatus(`Saved "${summary.name}".`);
                refreshSavedCanvases();
            } catch (error) {
                setSaveStatus(
                    error instanceof Error ? error.message : `Save failed: ${String(error)}`
                );
            } finally {
                setSavingCanvas(false);
            }
        },
        [currentCanvasPayload, refreshSavedCanvases]
    );

    const saveCurrentCanvas = useCallback(() => {
        void saveCanvasWithName(canvasName);
    }, [canvasName, saveCanvasWithName]);

    const saveCanvasAs = useCallback(() => {
        if (typeof window === 'undefined') return;
        const name = window.prompt('Save canvas as', canvasName);
        if (!name) return;
        void saveCanvasWithName(name);
    }, [canvasName, saveCanvasWithName]);

    const loadCanvasByName = useCallback(
        async (name: string) => {
            if (!name) return;
            if (
                (canvasDirty || hasUnsavedCurrentCanvas) &&
                typeof window !== 'undefined' &&
                !window.confirm('Discard unsaved canvas changes?')
            ) {
                return;
            }
            setSavingCanvas(true);
            setSaveStatus(`Loading "${name}"...`);
            try {
                const payload = await loadSearchbaseCanvas(name);
                if (!payload) {
                    setSaveStatus(`Canvas "${name}" was not found.`);
                    refreshSavedCanvases();
                    return;
                }
                const next = applyCanvasPayload(payload);
                setCanvasName(next.canvasName);
                setPageSize(next.pageSize);
                setRangeLabel(next.rangeLabel);
                setTiles(next.tiles);
                setPageIndex(0);
                setTileSearchQuery('');
                setTileResultFilter('all');
                setRunningTileIds(new Set());
                setObservedNoDataByTile(new Map());
                setOverlayFieldsByTile(new Map());
                setMetricResultCacheByTile(new Map());
                setTableDataCacheByTile(new Map());
                setBrowserOpen(next.tiles.length === 0);
                setReplaceTileId(null);
                setActiveSavedCanvasName(name);
                setLastSavedSignature(
                    canvasPayloadSignature(
                        canvasPayloadFromState(
                            next.canvasName,
                            next.pageSize,
                            next.rangeLabel,
                            next.tiles
                        )
                    )
                );
                setSaveStatus(`Loaded "${name}".`);
            } catch (error) {
                setSaveStatus(
                    error instanceof Error ? error.message : `Load failed: ${String(error)}`
                );
            } finally {
                setSavingCanvas(false);
            }
        },
        [canvasDirty, hasUnsavedCurrentCanvas, refreshSavedCanvases]
    );

    const deleteActiveCanvas = useCallback(async () => {
        if (!activeSavedCanvasName || typeof window === 'undefined') return;
        if (!window.confirm(`Delete saved canvas "${activeSavedCanvasName}"?`)) {
            return;
        }
        setSavingCanvas(true);
        setSaveStatus(`Deleting "${activeSavedCanvasName}"...`);
        try {
            await deleteSearchbaseCanvas(activeSavedCanvasName);
            setSaveStatus(`Deleted "${activeSavedCanvasName}".`);
            setCanvasName('');
            setActiveSavedCanvasName(null);
            setLastSavedSignature('');
            refreshSavedCanvases();
        } catch (error) {
            setSaveStatus(
                error instanceof Error ? error.message : `Delete failed: ${String(error)}`
            );
        } finally {
            setSavingCanvas(false);
        }
    }, [activeSavedCanvasName, refreshSavedCanvases]);

    const addRecord = useCallback(
        (record: SearchbaseRecord) => {
            if (replaceTileId) {
                let replaced = false;
                setTiles((current) => {
                    if (
                        current.some(
                            (tile) =>
                                tile.id !== replaceTileId &&
                                tile.searchName === record.searchName
                        )
                    ) {
                        return current;
                    }
                    replaced = true;
                    return current.map((tile) =>
                        tile.id === replaceTileId
                            ? {
                                  ...tile,
                                  searchName: record.searchName,
                                  overlayField: undefined,
                              }
                            : tile
                    );
                });
                if (!replaced) return;
                clearObservedNoData([replaceTileId]);
                clearTileResultCache([replaceTileId]);
                setOverlayFieldsByTile((current) => {
                    if (!current.has(replaceTileId)) return current;
                    const next = new Map(current);
                    next.delete(replaceTileId);
                    return next;
                });
                setRunningTileIds((current) => {
                    const next = new Set(current);
                    next.add(replaceTileId);
                    return next;
                });
                setTileResultFilter('all');
                setReplaceTileId(null);
                setBrowserOpen(false);
                return;
            }
            if (tiles.some((tile) => tile.searchName === record.searchName)) {
                return;
            }
            const newTile = createTile(record.searchName);
            setTiles((current) => {
                if (current.some((tile) => tile.searchName === record.searchName)) {
                    return current;
                }
                return [...current, newTile];
            });
            runNewTiles([newTile], 1);
            setTileResultFilter('all');
            setPageIndex(Math.floor(tiles.length / pageSize));
        },
        [
            clearObservedNoData,
            clearTileResultCache,
            pageSize,
            replaceTileId,
            runNewTiles,
            tiles,
        ]
    );

    const addRecords = useCallback(
        (selected: SearchbaseRecord[]) => {
            if (selected.length === 0 || replaceTileId) return;
            const seen = new Set(tiles.map((tile) => tile.searchName));
            const additions: CanvasTile[] = [];
            for (const record of selected) {
                if (seen.has(record.searchName)) continue;
                seen.add(record.searchName);
                additions.push(createTile(record.searchName));
            }
            if (additions.length === 0) return;
            setTiles((current) => {
                const currentNames = new Set(current.map((tile) => tile.searchName));
                const currentAdditions = additions.filter((tile) => {
                    if (currentNames.has(tile.searchName)) return false;
                    currentNames.add(tile.searchName);
                    return true;
                });
                if (currentAdditions.length === 0) {
                    return current;
                }
                return [...current, ...currentAdditions];
            });
            runNewTiles(additions);
            setTileResultFilter('all');
            setPageIndex(Math.floor(tiles.length / pageSize));
        },
        [pageSize, replaceTileId, runNewTiles, tiles]
    );

    const configureTile = useCallback((tileId: string) => {
        setReplaceTileId(tileId);
        setBrowserOpen(true);
    }, []);

    const removeTile = useCallback((tileId: string) => {
        setTiles((current) => current.filter((tile) => tile.id !== tileId));
        setRunningTileIds((current) => {
            if (!current.has(tileId)) return current;
            const next = new Set(current);
            next.delete(tileId);
            return next;
        });
        setTileRefreshCounts((current) => {
            if (!(tileId in current)) return current;
            const next = { ...current };
            delete next[tileId];
            return next;
        });
        setOverlayFieldsByTile((current) => {
            if (!current.has(tileId)) return current;
            const next = new Map(current);
            next.delete(tileId);
            return next;
        });
        clearObservedNoData([tileId]);
        clearTileResultCache([tileId]);
    }, [clearObservedNoData, clearTileResultCache]);

    const runTile = useCallback((tileId: string) => {
        setRunningTileIds((current) => {
            if (current.has(tileId)) return current;
            const next = new Set(current);
            next.add(tileId);
            return next;
        });
    }, []);

    const stopTile = useCallback((tileId: string) => {
        setRunningTileIds((current) => {
            if (!current.has(tileId)) return current;
            const next = new Set(current);
            next.delete(tileId);
            return next;
        });
    }, []);

    const runVisibleTiles = useCallback(() => {
        userStoppedRef.current = false;
        const tiles = runnableVisibleTilesRef.current.filter(
            (tile) => !runningTileIdsRef.current.has(tile.id)
        );
        const tileIds = tiles.map((tile) => tile.id);
        canvasDebug('[canvas/run-visible] entry', {
            tileIds,
            userStopped: userStoppedRef.current,
            runnableCount: tiles.length,
        });
        if (tileIds.length === 0) {
            canvasDebug('[canvas/run-visible] bail-out', { reason: 'no_runnable_tiles' });
            return;
        }
        setRunningTileIds((current) => {
            const next = new Set(current);
            for (const tileId of tileIds) {
                next.add(tileId);
            }
            canvasDebug('[canvas/run-visible] running-set', {
                added: tileIds,
                sizeBefore: current.size,
                sizeAfter: next.size,
            });
            return next;
        });
    }, []);

    runnableVisibleTilesRef.current = runnableVisibleTiles;
    runVisibleTilesRef.current = runVisibleTiles;

    useEffect(() => {
        if (loadingCatalogue) {
            canvasDebug('[canvas/auto-run] bail-out', { reason: 'loading_catalogue' });
            return undefined;
        }

        const runnableCount = runnableVisibleTilesRef.current.length;
        const idleCount = runnableVisibleTilesRef.current.filter(
            (tile) => !runningTileIdsRef.current.has(tile.id)
        ).length;
        canvasDebug('[canvas/auto-run] schedule', {
            page: clampedPageIndex + 1,
            pageSize,
            runnableCount,
            idleCount,
            userStopped: userStoppedRef.current,
            debounceMs: 200,
        });

        const timeoutId = window.setTimeout(() => {
            if (userStoppedRef.current) {
                canvasDebug('[canvas/auto-run] bail-out', { reason: 'user_stopped' });
                return;
            }
            const tiles = runnableVisibleTilesRef.current;
            const hasIdleVisible = tiles.some(
                (tile) => !runningTileIdsRef.current.has(tile.id)
            );
            if (!hasIdleVisible) {
                canvasDebug('[canvas/auto-run] bail-out', {
                    reason: 'no_idle_visible',
                    runnableCount: tiles.length,
                    runningCount: runningTileIdsRef.current.size,
                });
                return;
            }
            canvasDebug('[canvas/auto-run] firing', {
                page: clampedPageIndex + 1,
                pageSize,
                runnableCount: tiles.length,
                tileIds: tiles.map((tile) => tile.id),
                userStopped: userStoppedRef.current,
            });
            runVisibleTilesRef.current();
        }, 200);

        return () => {
            canvasDebug('[canvas/auto-run] debounce-clear', {
                page: clampedPageIndex + 1,
            });
            window.clearTimeout(timeoutId);
        };
    }, [
        clampedPageIndex,
        pageSize,
        tileSearchQuery,
        visibleTilesRunKey,
        loadingCatalogue,
    ]);

    const stopAllTiles = useCallback(() => {
        const stoppedCount = runningTileIdsRef.current.size;
        canvasDebug('[canvas/stop] click', {
            runningCount: stoppedCount,
            runningIds: Array.from(runningTileIdsRef.current),
        });
        userStoppedRef.current = true;
        canvasDebug('[canvas/stop] userStopped-set', { userStopped: true });
        setRunningTileIds(new Set());
    }, []);

    const refreshRunningTiles = useCallback(() => {
        userStoppedRef.current = false;
        const targets = runnableVisibleTiles;
        const tileIds = targets.map((tile) => tile.id);
        canvasDebug('[canvas/refresh] click', {
            tileIds,
            mode: 'all_visible',
            runningCount: runningTileIds.size,
        });
        if (tileIds.length === 0) {
            canvasDebug('[canvas/refresh] bail-out', { reason: 'no_targets' });
            return;
        };
        setTileRefreshCounts((current) => {
            const next = { ...current };
            for (const tileId of tileIds) {
                next[tileId] = (current[tileId] ?? 0) + 1;
            }
            return next;
        });
        setRunningTileIds((current) => {
            const next = new Set(current);
            for (const tileId of tileIds) {
                next.add(tileId);
            }
            return next;
        });
        setRefreshToken((current) => current + 1);
    }, [runningTileIds.size, runnableVisibleTiles]);

    const refreshTile = useCallback(
        (tileId: string) => {
            setTileRefreshCounts((current) => ({
                ...current,
                [tileId]: (current[tileId] ?? 0) + 1,
            }));
        },
        []
    );

    const cycleSize = useCallback((tileId: string) => {
        setTiles((current) =>
            current.map((tile) =>
                tile.id === tileId
                    ? { ...tile, span: cycleTileSpan(tile.span) }
                    : tile
            )
        );
    }, []);

    const changeTileViz = useCallback(
        (tileId: string, vizOverride?: string) => {
            setTiles((current) =>
                current.map((tile) =>
                    tile.id === tileId
                        ? {
                              ...tile,
                              vizOverride: normalizeTileVizOverride(vizOverride),
                          }
                        : tile
                )
            );
        },
        []
    );

    const changeTileOverlay = useCallback(
        (tileId: string, overlayField?: string | null) => {
            setTiles((current) =>
                current.map((tile) =>
                    tile.id === tileId
                        ? {
                              ...tile,
                              overlayField: normalizeTileOverlayField(overlayField),
                          }
                        : tile
                )
            );
        },
        []
    );

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        setTiles((current) => {
            const oldIndex = current.findIndex((tile) => tile.id === active.id);
            const newIndex = current.findIndex((tile) => tile.id === over.id);
            if (oldIndex < 0 || newIndex < 0) return current;
            return arrayMove(current, oldIndex, newIndex);
        });
    }, []);

    const clearCanvas = () => {
        setTiles([]);
        setRunningTileIds(new Set());
        setObservedNoDataByTile(new Map());
        setOverlayFieldsByTile(new Map());
        setMetricResultCacheByTile(new Map());
        setTableDataCacheByTile(new Map());
        setPageIndex(0);
        setTileSearchQuery('');
        setTileResultFilter('all');
        setBrowserOpen(true);
        setReplaceTileId(null);
        setActiveSavedCanvasName(null);
        setLastSavedSignature('');
    };

    const createNewCanvas = useCallback(() => {
        if (
            (canvasDirty || hasUnsavedCurrentCanvas) &&
            typeof window !== 'undefined' &&
            !window.confirm('Discard unsaved canvas changes?')
        ) {
            return;
        }
        setCanvasName('Searchbase Canvas');
        setPageSize(25);
        setRangeLabel(DEFAULT_TIME_RANGE_LABEL);
        setTiles([]);
        setRunningTileIds(new Set());
        setObservedNoDataByTile(new Map());
        setOverlayFieldsByTile(new Map());
        setMetricResultCacheByTile(new Map());
        setTableDataCacheByTile(new Map());
        setPageIndex(0);
        setTileSearchQuery('');
        setTileResultFilter('all');
        setBrowserOpen(false);
        setReplaceTileId(null);
        setActiveSavedCanvasName(null);
        setLastSavedSignature('');
        setSaveStatus('New empty canvas.');
    }, [canvasDirty, hasUnsavedCurrentCanvas]);

    const HeaderThemeIcon =
        theme === 'system' ? MonitorSmartphone : resolvedTheme === 'dark' ? Moon : Sun;
    const themeTitle =
        theme === 'system'
            ? 'Following system theme'
            : resolvedTheme === 'dark'
            ? 'Dark theme'
            : 'Light theme';
    const hasTileResultFilter = tileResultFilter !== 'all';
    const hasTileFilters = hasTileSearch || hasTileResultFilter;
    const visibleTileSummary =
        filteredTiles.length === 0
            ? '0 shown'
            : `${pageStart + 1}-${pageEnd} of ${
                  hasTileFilters
                      ? `${filteredTiles.length.toLocaleString()} matched`
                      : filteredTiles.length.toLocaleString()
              }`;
    const enterPresentationMode = () => {
        setBrowserOpen(false);
        setReplaceTileId(null);
        setNoDataReportOpen(false);
        setActiveDetailTable(null);
        setMoreMenuOpen(false);
        if (idleVisibleTileCount > 0) {
            runVisibleTiles();
        }
        setPresentationMode(true);
    };
    const renderCanvasTile = (tile: CanvasTile, isPresentation = false) => {
        const tileContent = (
            <SearchbaseCanvasTile
                tile={tile}
                record={entryByName.get(tile.searchName)}
                entryByName={entryByName}
                range={range}
                refreshToken={refreshToken + (tileRefreshCounts[tile.id] ?? 0)}
                metricResultCache={metricResultCacheByTile.get(tile.id)}
                tableDataCache={tableDataCacheByTile.get(tile.id)}
                isRunning={runningTileIds.has(tile.id)}
                presentationMode={isPresentation}
                onRun={runTile}
                onStop={stopTile}
                onRefresh={refreshTile}
                onConfigure={configureTile}
                onRemove={removeTile}
                onCycleSize={cycleSize}
                onChangeViz={changeTileViz}
                overlayFields={overlayFieldsByTile.get(tile.id) ?? []}
                onChangeOverlay={changeTileOverlay}
                onOpenDetailTable={setActiveDetailTable}
                onOverlayFieldsChange={updateOverlayFields}
                onNoDataObservation={updateNoDataObservation}
                onMetricResultCacheChange={updateMetricResultCache}
                onTableDataCacheChange={updateTableDataCache}
            />
        );

        return (
            <div key={tile.id} className={cn(TILE_SPAN_CLASS[tile.span])}>
                {isPresentation ? (
                    tileContent
                ) : (
                    <SortableMetricCard id={tile.id} ariaLabel={tile.searchName}>
                        {tileContent}
                    </SortableMetricCard>
                )}
            </div>
        );
    };

    return (
        <div
            className={cn(
                resolvedTheme === 'dark' && 'dark',
                'relative min-h-screen overflow-x-hidden bg-[#f5f7fb] font-sans text-slate-900 dark:bg-slate-900 dark:text-slate-50'
            )}
        >
            <div className="flex min-h-screen min-w-0 flex-col overflow-x-hidden">
                <header className="border-b border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
                    <div className="flex min-w-0 flex-wrap items-center gap-3 px-4 py-3">
                        <div className="min-w-[240px] flex-1">
                            {editingCanvasName ? (
                                <input
                                    ref={canvasNameInputRef}
                                    value={canvasName}
                                    onChange={(event) => setCanvasName(event.target.value)}
                                    onBlur={() => setEditingCanvasName(false)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter' || event.key === 'Escape') {
                                            setEditingCanvasName(false);
                                        }
                                    }}
                                    placeholder="Untitled canvas"
                                    className="block h-9 w-full max-w-[460px] rounded-none border-0 border-b border-slate-300 bg-transparent p-0 text-2xl font-black leading-9 text-slate-950 outline-none transition-colors placeholder:text-slate-400 focus:ring-0 dark:border-slate-600 dark:text-slate-50 dark:placeholder:text-slate-600"
                                    aria-label="Canvas name"
                                />
                            ) : (
                                <button
                                    type="button"
                                    onDoubleClick={() => setEditingCanvasName(true)}
                                    className="block max-w-[520px] truncate border-0 bg-transparent p-0 text-left text-2xl font-black leading-tight text-slate-950 transition-colors focus:outline-none dark:text-slate-50"
                                    title="Double-click to rename"
                                    aria-label="Edit canvas name"
                                >
                                    {canvasNameDisplay}
                                </button>
                            )}
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                <span
                                    className="inline-flex h-6 items-center rounded-md border border-slate-200 bg-slate-50 px-2 text-xs font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                                    title="Total tiles on this canvas"
                                >
                                    {tiles.length.toLocaleString()} canvas tiles
                                </span>
                                <span
                                    className={cn(
                                        'inline-flex h-6 items-center rounded-md border px-2 text-xs font-bold',
                                        runningTileIds.size > 0
                                            ? 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-200'
                                            : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
                                    )}
                                    title="Tiles with an active result view"
                                >
                                    {runningTileIds.size.toLocaleString()} active
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setNoDataReportOpen(true)}
                                    className={cn(
                                        'inline-flex h-6 items-center rounded-md border px-2 text-xs font-bold transition focus:outline-none focus:ring-2 focus:ring-amber-300',
                                        observedNoDataRows.length > 0
                                            ? 'border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200 dark:hover:bg-amber-900'
                                            : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                                    )}
                                    title="Open needs attention report"
                                    aria-label={`Open needs attention report. ${observedNoDataRows.length.toLocaleString()} observed searches need attention.`}
                                >
                                    {observedNoDataRows.length.toLocaleString()} attention
                                </button>
                                <span
                                    className="inline-flex h-6 items-center rounded-md border border-slate-200 bg-slate-50 px-2 text-xs font-bold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                                    title="Loaded searches available in the catalogue"
                                >
                                    {records.length.toLocaleString()} in catalogue
                                </span>
                            </div>
                        </div>

                        <span className="sr-only" aria-live="polite">
                            {catalogueError
                                ? catalogueError
                                : loadingCatalogue
                                ? 'Loading catalogue'
                                : saveStatus || (canvasDirty ? 'Unsaved changes' : '')}
                        </span>
                        <div className="flex flex-wrap items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={saveCurrentCanvas}
                                disabled={savingCanvas || tiles.length === 0}
                                title="Save canvas"
                                className="inline-flex h-10 items-center gap-1.5 rounded-md bg-emerald-600 px-3 text-sm font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-45 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                            >
                                <Save className="h-3.5 w-3.5" />
                                Save
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setReplaceTileId(null);
                                    setBrowserOpen(true);
                                }}
                                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md bg-sky-600 px-4 text-sm font-black text-white transition hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-300"
                            >
                                <Plus className="h-4 w-4" />
                                Add
                            </button>
                            <button
                                type="button"
                                disabled={idleVisibleTileCount === 0}
                                onClick={() => {
                                    canvasDebug('[canvas/run-visible] click', {
                                        idleVisibleTileCount,
                                        runnableCount: runnableVisibleTiles.length,
                                    });
                                    runVisibleTiles();
                                }}
                                title={runVisibleTitle}
                                className="inline-flex h-10 items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-3 text-sm font-black text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-45 focus:outline-none focus:ring-2 focus:ring-emerald-300 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200 dark:hover:bg-emerald-900"
                            >
                                <Play className="h-3.5 w-3.5" />
                                Run
                            </button>
                            <button
                                type="button"
                                disabled={runningTileIds.size === 0}
                                onClick={stopAllTiles}
                                title="Stop all running tiles"
                                className="inline-flex h-10 items-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-3 text-sm font-black text-rose-700 transition hover:border-rose-300 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-45 focus:outline-none focus:ring-2 focus:ring-rose-300 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200 dark:hover:bg-rose-900"
                            >
                                <Square className="h-3.5 w-3.5" />
                                Stop
                            </button>
                            <button
                                type="button"
                                onClick={enterPresentationMode}
                                disabled={tiles.length === 0}
                                title="Present this canvas"
                                className="inline-flex h-10 items-center gap-1.5 rounded-md bg-slate-950 px-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-45 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white"
                            >
                                <Presentation className="h-3.5 w-3.5" />
                                Present
                            </button>
                            <button
                                type="button"
                                onClick={refreshRunningTiles}
                                disabled={runnableVisibleTiles.length === 0}
                                title="Refresh visible tiles"
                                aria-label="Refresh visible tiles"
                                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus:ring-slate-700"
                            >
                                <RefreshCw className="h-4 w-4" />
                            </button>
                            <button
                                type="button"
                                onClick={cycle}
                                title={themeTitle}
                                aria-label={themeTitle}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus:ring-slate-700"
                            >
                                <HeaderThemeIcon className="h-4 w-4" />
                            </button>
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setMoreMenuOpen((open) => !open)}
                                    aria-expanded={moreMenuOpen}
                                    title="More canvas actions"
                                    aria-label="More canvas actions"
                                    className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus:ring-slate-700"
                                >
                                    <MoreVertical className="h-4 w-4" />
                                </button>
                                {moreMenuOpen && (
                                    <div className="absolute right-0 z-30 mt-2 w-56 rounded-md border border-slate-200 bg-white p-1.5 shadow-lg dark:border-slate-800 dark:bg-slate-900">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setMoreMenuOpen(false);
                                                createNewCanvas();
                                            }}
                                            className="flex h-9 w-full items-center gap-2 rounded px-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                                        >
                                            <Plus className="h-3.5 w-3.5" />
                                            New empty canvas
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setMoreMenuOpen(false);
                                                saveCanvasAs();
                                            }}
                                            disabled={savingCanvas || tiles.length === 0}
                                            className="flex h-9 w-full items-center gap-2 rounded px-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-200 dark:hover:bg-slate-800"
                                        >
                                            <Copy className="h-3.5 w-3.5" />
                                            Save as
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setNoDataReportOpen(true)}
                                            className="flex h-9 w-full items-center gap-2 rounded px-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                                        >
                                            <Table2 className="h-3.5 w-3.5" />
                                            Needs attention report
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setMoreMenuOpen(false);
                                                void deleteActiveCanvas();
                                            }}
                                            disabled={savingCanvas || !activeSavedCanvasName}
                                            className="flex h-9 w-full items-center gap-2 rounded px-2 text-left text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-rose-300 dark:hover:bg-rose-950"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                            Delete saved canvas
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex min-w-0 flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50/80 px-4 py-2 dark:border-slate-800 dark:bg-slate-900/60">
                        <div className="flex flex-wrap items-center gap-2">
                            <select
                                value={activeSavedCanvasName ?? ''}
                                onChange={(event) => {
                                    const name = event.target.value;
                                    if (name) void loadCanvasByName(name);
                                }}
                                disabled={savingCanvas}
                                className="h-9 w-[250px] shrink-0 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-sky-950"
                            >
                                <option value="">Load saved canvas...</option>
                                {savedCanvases.map((canvas) => (
                                    <option key={canvas.name} value={canvas.name}>
                                        {canvas.name}
                                    </option>
                                ))}
                            </select>
                            <select
                                value={rangeLabel}
                                onChange={(event) => setRangeLabel(event.target.value)}
                                aria-label="Time range"
                                className="h-9 w-[150px] rounded-md border border-slate-300 bg-white px-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-sky-950"
                            >
                                {TIME_RANGE_OPTIONS.map((option) => (
                                    <option key={option.label} value={option.label}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                            <select
                                value={pageSize}
                                onChange={(event) =>
                                    setPageSize(Number(event.target.value) as PageSize)
                                }
                                aria-label="Tiles per page"
                                className="h-9 w-[130px] rounded-md border border-slate-300 bg-white px-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-sky-950"
                            >
                                {PAGE_SIZE_OPTIONS.map((option) => (
                                    <option key={option} value={option}>
                                        {option} per page
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-500 dark:text-slate-400">
                            {catalogueError
                                ? catalogueError
                                : loadingCatalogue
                                ? 'Loading catalogue...'
                                : saveStatus || (canvasDirty ? 'Unsaved changes' : 'Ready')}
                        </div>
                    </div>
                </header>

                <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden bg-[#f5f7fb] p-4 dark:bg-slate-900">
                    <div className="mb-3 flex min-w-0 flex-wrap items-center gap-3 rounded-md border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                        <div className="relative w-full max-w-[520px]">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
                            <input
                                type="search"
                                value={tileSearchQuery}
                                onChange={(event) => setTileSearchQuery(event.target.value)}
                                placeholder="Search tiles by name or query..."
                                disabled={tiles.length === 0}
                                className="h-11 w-full rounded-md border border-slate-300 bg-white pl-10 pr-10 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-500 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-sky-500 dark:focus:ring-sky-950 dark:disabled:bg-slate-900"
                                aria-label="Search tiles by name or query"
                            />
                            {tileSearchQuery.trim().length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setTileSearchQuery('')}
                                    title="Clear tile search"
                                    aria-label="Clear tile search"
                                    className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-sm text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 dark:focus:ring-slate-700"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                        <div
                            role="group"
                            aria-label="Filter tiles by last observed search result"
                            className="inline-flex h-11 max-w-full overflow-hidden rounded-md border border-slate-300 bg-white p-1 dark:border-slate-700 dark:bg-slate-950"
                        >
                            {TILE_RESULT_FILTER_OPTIONS.map((option) => {
                                const selected = tileResultFilter === option.value;
                                const count =
                                    option.value === 'all'
                                        ? searchedTiles.length
                                        : resultFilterCounts[option.value];
                                const Icon =
                                    option.value === 'needs_attention'
                                        ? AlertCircle
                                        : option.value === 'working'
                                        ? Check
                                        : SlidersHorizontal;
                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => setTileResultFilter(option.value)}
                                        title={option.title}
                                        aria-pressed={selected}
                                        className={cn(
                                            'inline-flex min-w-0 items-center gap-1.5 rounded px-2.5 text-xs font-black transition focus:outline-none focus:ring-2 focus:ring-sky-300 sm:px-3',
                                            selected
                                                ? 'bg-slate-900 text-white shadow-sm dark:bg-slate-100 dark:text-slate-950'
                                                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-50'
                                        )}
                                    >
                                        <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                                        <span className="truncate">{option.label}</span>
                                        <span
                                            className={cn(
                                                'rounded-full px-1.5 py-0.5 text-[10px] leading-none',
                                                selected
                                                    ? 'bg-white/20 text-current dark:bg-slate-950/10'
                                                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'
                                            )}
                                        >
                                            {count.toLocaleString()}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <button
                            type="button"
                            disabled={clampedPageIndex === 0}
                            onClick={() =>
                                setPageIndex((current) => Math.max(0, current - 1))
                            }
                            title="Previous page"
                            aria-label="Previous page"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-slate-300 bg-white text-slate-600 transition hover:border-slate-400 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        <div className="inline-flex h-8 items-center rounded-sm border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
                            Page {clampedPageIndex + 1} of {totalPages}
                        </div>
                        <button
                            type="button"
                            disabled={clampedPageIndex >= totalPages - 1}
                            onClick={() =>
                                setPageIndex((current) =>
                                    Math.min(totalPages - 1, current + 1)
                                )
                            }
                            title="Next page"
                            aria-label="Next page"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-slate-300 bg-white text-slate-600 transition hover:border-slate-400 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                        <div className="whitespace-nowrap text-sm font-semibold text-slate-500 dark:text-slate-400">
                            {visibleTileSummary}
                        </div>
                        </div>
                        {tiles.length > 0 && (
                            <button
                                type="button"
                                onClick={clearCanvas}
                                className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-xs font-black text-slate-500 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-rose-800 dark:hover:bg-rose-950 dark:hover:text-rose-300"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                                Clear
                            </button>
                        )}
                    </div>

                    {tiles.length === 0 ? (
                        <div className="flex min-h-[calc(100vh-280px)] items-center justify-center rounded-md border border-dashed border-slate-300 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
                            <div className="mx-auto max-w-sm px-6 text-center">
                                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-md bg-sky-50 text-sky-600 ring-1 ring-sky-100 dark:bg-sky-950 dark:text-sky-300 dark:ring-sky-900">
                                    <Plus className="h-7 w-7" />
                                </div>
                                <h2 className="mt-4 text-2xl font-black text-slate-950 dark:text-slate-50">
                                    No tiles yet
                                </h2>
                                <p className="mt-2 text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">
                                    Start with the catalogue, add the searches you want, then run or present the canvas.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setReplaceTileId(null);
                                        setBrowserOpen(true);
                                    }}
                                    className="mt-5 inline-flex items-center gap-2 rounded-md bg-sky-600 px-4 py-2 text-sm font-black text-white transition hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-400"
                                >
                                    <PanelRightOpen className="h-4 w-4" />
                                    Open catalogue
                                </button>
                            </div>
                        </div>
                    ) : filteredTiles.length === 0 ? (
                        <div className="flex min-h-[360px] items-center justify-center rounded-md border border-dashed border-slate-300 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
                            <div className="mx-auto max-w-sm px-6 text-center">
                                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-md bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                                    <Search className="h-7 w-7" />
                                </div>
                                <h2 className="mt-4 text-xl font-black text-slate-950 dark:text-slate-50">
                                    {hasTileResultFilter
                                        ? 'No tiles in this result state'
                                        : 'No matching tiles'}
                                </h2>
                                <p className="mt-2 text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">
                                    {hasTileResultFilter
                                        ? 'Run searches from the All view, or switch result filters after results come back.'
                                        : 'Try a different tile name, tag, category, or SPL fragment.'}
                                </p>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setTileSearchQuery('');
                                        setTileResultFilter('all');
                                    }}
                                    className="mt-5 inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-black text-white transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white"
                                >
                                    <X className="h-4 w-4" />
                                    {hasTileResultFilter ? 'Clear filters' : 'Clear search'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >
                            <SortableContext
                                items={visibleTiles.map((tile) => tile.id)}
                                strategy={rectSortingStrategy}
                            >
                                <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4 [&>*]:min-w-0">
                                    {visibleTiles.map((tile) => renderCanvasTile(tile))}
                                </div>
                            </SortableContext>
                        </DndContext>
                    )}
                </main>
            </div>

            {presentationMode && (
                <div className="absolute inset-0 z-[70] min-h-screen overflow-y-auto bg-[#f5f7fb] p-4 text-slate-950 dark:bg-slate-950 dark:text-slate-50">
                    <div className="mb-4 flex min-w-0 items-center gap-3 rounded-md border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <div className="min-w-0 flex-1">
                            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
                                Presenting
                            </div>
                            <h1 className="truncate text-2xl font-black leading-tight text-slate-950 dark:text-slate-50">
                                {canvasNameDisplay}
                            </h1>
                        </div>
                        <button
                            type="button"
                            onClick={() => setPresentationMode(false)}
                            className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800"
                        >
                            <Minimize2 className="h-4 w-4" />
                            Exit
                        </button>
                    </div>

                    {visibleTiles.length === 0 ? (
                        <div className="flex min-h-[calc(100vh-180px)] items-center justify-center rounded-md border border-dashed border-slate-300 bg-white text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <div className="max-w-sm px-6">
                                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-md bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                                    <Presentation className="h-7 w-7" />
                                </div>
                                <h2 className="mt-4 text-xl font-black text-slate-950 dark:text-slate-50">
                                    Nothing to present
                                </h2>
                                <p className="mt-2 text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">
                                    Add tiles or clear the current tile search, then present the canvas.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4 [&>*]:min-w-0">
                            {visibleTiles.map((tile) => renderCanvasTile(tile, true))}
                        </div>
                    )}
                </div>
            )}

            {!presentationMode && browserOpen && (
                <button
                    type="button"
                    aria-label="Close catalogue"
                    className="fixed inset-0 z-40 bg-slate-950/20 backdrop-blur-[1px] dark:bg-slate-950/50"
                    onClick={() => {
                        setBrowserOpen(false);
                        setReplaceTileId(null);
                    }}
                />
            )}
            <SearchbaseBrowser
                open={!presentationMode && browserOpen}
                records={records}
                canvasTiles={tiles}
                replaceTileId={replaceTileId}
                includeHiddenSearches={includeHiddenSearches}
                onClose={() => {
                    setBrowserOpen(false);
                    setReplaceTileId(null);
                }}
                onAddRecord={addRecord}
                onAddRecords={addRecords}
                onIncludeHiddenSearchesChange={setIncludeHiddenSearches}
            />
            {activeDetailTable && (
                <SearchbaseDetailTableModal
                    config={activeDetailTable}
                    range={range}
                    refreshToken={refreshToken}
                    onClose={() => setActiveDetailTable(null)}
                />
            )}
            {noDataReportOpen && (
                <NoDataReportModal
                    entries={observedNoDataRows}
                    entryByName={entryByName}
                    range={range}
                    onClose={() => setNoDataReportOpen(false)}
                />
            )}
        </div>
    );
};

export default SearchbaseCanvasPage;
