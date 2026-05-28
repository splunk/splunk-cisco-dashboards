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
    ChevronLeft,
    ChevronRight,
    Copy,
    ExternalLink,
    Gauge,
    Maximize2,
    MonitorSmartphone,
    Moon,
    MoreVertical,
    PanelRightOpen,
    Play,
    Plus,
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
import { MetricItem } from '@/common/components/florida/MetricItem';
import { SortableMetricCard } from '@/common/components/florida/SortableMetricCard';
import { TableTile } from '@/common/components/florida/TableTile';
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
    type MetricConfig,
    type NoDataReason,
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

const APP_NAME = 'splunk-cisco-dashboards';
const STORAGE_KEY = 'scd_searchbase_canvas_v1';
const MAX_BATCH_RUNS = 10;

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

type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];
type TileSpan = 1 | 2 | 4;

interface CanvasTile {
    id: string;
    searchName: string;
    span: TileSpan;
    addedAt: number;
    vizOverride?: string;
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
    reason: NoDataReason;
    rangeLabel: string;
    observedAt: string;
}

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
    { value: 'splunk.table', label: 'Table' },
    { value: 'splunk.singlevalue', label: 'Single value' },
] as const;

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
            '| eval message="No observed no-data tiles in the current Searchbase Canvas session."',
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

    return [
        `| makeresults count=${sorted.length}`,
        '| streamstats count as row',
        `| eval stanza_name=case(${caseFor('stanzaName')})`,
        `| eval search_name=case(${caseFor('searchName')})`,
        `| eval category=case(${caseFor('category')})`,
        `| eval sub_category=case(${caseFor('subCategory')})`,
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
        '| table stanza_name search_name category sub_category reason time_range observed_at',
        '| sort stanza_name',
    ].join('\n');
};

const recordPlainText = (record: SearchbaseRecord): string =>
    plainTextFromHtml(record.description).slice(0, 220);

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

interface SearchbaseCanvasTileProps {
    tile: CanvasTile;
    record?: SearchbaseRecord;
    entryByName: Map<string, SearchbaseRecord>;
    range: TimeRange;
    refreshToken: number;
    isRunning: boolean;
    onRun: (tileId: string) => void;
    onStop: (tileId: string) => void;
    onRefresh: (tileId: string) => void;
    onConfigure: (tileId: string) => void;
    onRemove: (tileId: string) => void;
    onCycleSize: (tileId: string) => void;
    onChangeViz: (tileId: string, vizOverride?: string) => void;
    onOpenDetailTable: (config: SearchbaseDetailTableConfig) => void;
    onNoDataObservation: (
        tileId: string,
        entry: ObservedNoDataEntry | null
    ) => void;
}

const MissingSearchbaseTile: React.FC<{
    tile: CanvasTile;
    onRemove: (tileId: string) => void;
}> = ({ tile, onRemove }) => (
    <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-200">
        <div className="flex items-center gap-2 font-bold">
            <AlertCircle className="h-4 w-4" />
            Missing searchbase entry
        </div>
        <div className="mt-1 font-mono text-xs">{tile.searchName}</div>
        <button
            type="button"
            onClick={() => onRemove(tile.id)}
            className="mt-3 inline-flex items-center gap-1 rounded border border-rose-200 bg-white px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-100"
        >
            <Trash2 className="h-3.5 w-3.5" />
            Remove
        </button>
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
    viz: string | undefined;
    color: string;
    description: string;
    onConfigure: () => void;
    onOpenSearch: () => void;
    onOpenDrilldown?: () => void;
    drilldownTitle?: string;
    onNoDataObservation: (entry: ObservedNoDataEntry | null) => void;
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
                <button
                    type="button"
                    onClick={onConfigure}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-black text-slate-700 transition hover:border-sky-300 hover:text-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-sky-700 dark:hover:text-sky-200"
                >
                    <Settings2 className="h-3.5 w-3.5" />
                    Replace
                </button>
            </div>
        </div>
    );
};

const SearchbaseMetricTileBody: React.FC<SearchbaseTileBodyProps> = ({
    tile,
    record,
    range,
    refreshToken,
    viz,
    color,
    description,
    onConfigure,
    onOpenSearch,
    onOpenDrilldown,
    drilldownTitle,
    onNoDataObservation,
}) => {
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
            color,
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
            description,
            record.category,
            record.id,
            record.search,
            record.searchName,
            record.subCategory,
            tile.id,
        ]
    );

    const metric = useMetric(metricConfig, range, refreshToken);

    useEffect(() => {
        if (metric.source === 'live' && metric.noDataReason === 'empty_rows') {
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
            />
        );
    }

    return (
        <MetricItem
            label={record.searchName}
            subLabel={[record.category, record.subCategory].filter(Boolean).join(' / ')}
            description={description}
            descriptionFootnote={record.id}
            thresholdNote="Searchbase canvas tile."
            onOpenInSearch={onOpenSearch}
            onConfigure={onConfigure}
            isCustomized
            className="h-full"
            value={metric.displayValue ?? metric.value}
            change={metric.change}
            sparkData={metric.sparkData}
            previousData={metric.previousSparkData}
            previousLabel="Prev"
            sparkTimestamps={metric.sparkTimestamps}
            timeRange={range}
            color={color}
            status={metric.status}
            source={metric.source}
            noDataReason={metric.noDataReason}
            rangeLabel={metric.rangeLabel}
            vizType={sparklineVizTypeFromSplunkViz(viz)}
            dataValuesDisplay={normalizeDataValuesDisplay(
                record.vizOptions?.dataValuesDisplay
            )}
            onOpenDetailTable={onOpenDrilldown}
            detailTableTitle={drilldownTitle ?? 'View detail'}
        />
    );
};

const SearchbaseTableTileBody: React.FC<
    SearchbaseTileBodyProps & { variant: 'table' | 'bar' }
> = ({
    tile,
    record,
    range,
    refreshToken,
    description,
    onConfigure,
    onOpenSearch,
    variant,
    onNoDataObservation,
}) => {
    const tableConfig = useMemo(
        () => ({
            id: tile.id,
            spl: record.search,
            rowLimit: 50,
            suppressMockOnEmpty: true,
        }),
        [record.search, tile.id]
    );
    const table = useTableData(tableConfig, range, refreshToken);

    useEffect(() => {
        if (table.source === 'live' && table.noDataReason === 'empty_rows') {
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
        onConfigure,
        isCustomized: true,
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
    onConfigure,
    onRemove,
    onCycleSize,
    onChangeViz,
    onOpenDetailTable,
    onNoDataObservation,
    onStop,
    onRefresh,
}) => {
    const description = recordPlainText(record);
    const color = firstSeriesColor(record.vizOptions);
    const viz = effectiveTileViz(tile, record);
    const drilldownRecord = record.drilldownSearchName
        ? entryByName.get(record.drilldownSearchName)
        : undefined;
    const detailTableConfig = useMemo(
        () => buildSearchbaseDetailTableConfig(record, entryByName),
        [entryByName, record]
    );
    const openSearch = useCallback(() => {
        openSplunkSearch(record.search, range);
    }, [record.search, range]);
    const openDrilldown = useCallback(() => {
        if (detailTableConfig) {
            onOpenDetailTable(detailTableConfig);
            return;
        }
        if (record.drilldownSearchName) {
            openSplunkSearch(
                drilldownRecord?.search ?? savedSearchSpl(record.drilldownSearchName),
                range
            );
        }
    }, [
        detailTableConfig,
        drilldownRecord?.search,
        onOpenDetailTable,
        record.drilldownSearchName,
        range,
    ]);

    return (
        <div className="group/tile flex min-h-[248px] flex-col rounded-md border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-800/95 dark:shadow-none dark:ring-1 dark:ring-slate-900/30">
            <div className="flex h-full min-h-0 flex-1 flex-col p-2">
                {isTableViz(viz) ? (
                    <SearchbaseTableTileBody
                        tile={tile}
                        record={record}
                        range={range}
                        refreshToken={refreshToken}
                        viz={viz}
                        color={color}
                        description={description}
                        onConfigure={() => onConfigure(tile.id)}
                        onOpenSearch={openSearch}
                        variant="table"
                        onNoDataObservation={(entry) =>
                            onNoDataObservation(tile.id, entry)
                        }
                    />
                ) : isBarBreakdownViz(viz) ? (
                    <SearchbaseTableTileBody
                        tile={tile}
                        record={record}
                        range={range}
                        refreshToken={refreshToken}
                        viz={viz}
                        color={color}
                        description={description}
                        onConfigure={() => onConfigure(tile.id)}
                        onOpenSearch={openSearch}
                        variant="bar"
                        onNoDataObservation={(entry) =>
                            onNoDataObservation(tile.id, entry)
                        }
                    />
                ) : (
                    <SearchbaseMetricTileBody
                        tile={tile}
                        record={record}
                        range={range}
                        refreshToken={refreshToken}
                        viz={viz}
                        color={color}
                        description={description}
                        onConfigure={() => onConfigure(tile.id)}
                        onOpenSearch={openSearch}
                        onOpenDrilldown={
                            detailTableConfig ? openDrilldown : undefined
                        }
                        drilldownTitle={detailTableConfig?.buttonTitle}
                        onNoDataObservation={(entry) =>
                            onNoDataObservation(tile.id, entry)
                        }
                    />
                )}
            </div>
            <div className="flex items-center gap-2 border-t border-slate-100 px-2 py-1.5 text-[10px] font-semibold text-slate-500 dark:border-slate-700 dark:text-slate-300">
                <TileVizSelect
                    tile={tile}
                    record={record}
                    onChangeViz={onChangeViz}
                />
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
}) => {
    const description = recordPlainText(record);
    const openSearch = () => openSplunkSearch(record.search, range);
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
        <div className="group/tile flex min-h-[248px] flex-col rounded-md border border-dashed border-slate-300 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800/95 dark:shadow-none dark:ring-1 dark:ring-slate-900/30">
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

                <button
                    type="button"
                    onClick={() => onRun(tile.id)}
                    className="mt-auto inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-xs font-black text-white transition hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-400 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-sky-200"
                >
                    <Play className="h-3.5 w-3.5" />
                    Run search
                </button>
            </div>

            <div className="flex items-center gap-2 border-t border-slate-100 px-2 py-1.5 text-[10px] font-semibold text-slate-500 dark:border-slate-700 dark:text-slate-300">
                <TileVizSelect
                    tile={tile}
                    record={record}
                    onChangeViz={onChangeViz}
                />
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
                    <button
                        type="button"
                        onClick={() => onConfigure(tile.id)}
                        title="Replace tile"
                        aria-label="Replace tile"
                        className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-400 dark:hover:bg-slate-800 dark:hover:text-sky-300"
                    >
                        <Settings2 className="h-3.5 w-3.5" />
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
        </div>
    );
};

const SearchbaseCanvasTile: React.FC<SearchbaseCanvasTileProps> = (props) => {
    if (!props.record) {
        return <MissingSearchbaseTile tile={props.tile} onRemove={props.onRemove} />;
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
    const searchUrl = splunkSearchAppUrl(config.spl, range);

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="fixed inset-0 z-[1700] flex items-center justify-center p-4"
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
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onClose]);

    const rows = useMemo(
        () =>
            [...entries].sort(
                (a, b) =>
                    a.stanzaName.localeCompare(b.stanzaName) ||
                    a.searchName.localeCompare(b.searchName)
            ),
        [entries]
    );
    const reportSearch = useMemo(
        () => buildObservedNoDataReportSearch(rows),
        [rows]
    );
    const reportUrl = splunkSearchAppUrl(reportSearch, range);

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
            <div className="relative w-full max-w-6xl max-h-[88vh] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-950">
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                    <div>
                        <div className="flex items-center gap-2">
                            <Table2 className="h-4 w-4 text-sky-600 dark:text-sky-300" />
                            <h2
                                id="searchbase-no-data-report-title"
                                className="text-base font-bold text-slate-900 dark:text-slate-100"
                            >
                                No data report
                            </h2>
                        </div>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            {rows.length.toLocaleString()} observed{' '}
                            {rows.length === 1 ? 'search' : 'searches'} returned 0 rows.
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
                            aria-label="Close no data report"
                            className="rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                <div className="max-h-[calc(88vh-90px)] overflow-auto">
                    <table className="w-full min-w-[900px] text-sm">
                        <thead className="sticky top-0 z-10 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
                            <tr className="text-left text-xs font-bold text-slate-500 dark:text-slate-400">
                                <th className="px-5 py-3">stanza_name</th>
                                <th className="px-4 py-3">search_name</th>
                                <th className="px-4 py-3">category</th>
                                <th className="px-4 py-3">reason</th>
                                <th className="px-4 py-3">time_range</th>
                                <th className="px-4 py-3 text-right">action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {rows.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={6}
                                        className="px-5 py-10 text-center text-sm text-slate-500 dark:text-slate-400"
                                    >
                                        Run tiles first; searches that complete with 0 rows
                                        will appear here.
                                    </td>
                                </tr>
                            ) : (
                                rows.map((row) => {
                                    const record = entryByName.get(row.searchName);
                                    return (
                                        <tr
                                            key={`${row.tileId}-${row.observedAt}`}
                                            className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/70"
                                        >
                                            <td className="px-5 py-3 font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
                                                {row.stanzaName}
                                            </td>
                                            <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                                                {row.searchName}
                                            </td>
                                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                                                {[row.category, row.subCategory]
                                                    .filter(Boolean)
                                                    .join(' / ') || '-'}
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
                                                                range
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
        </div>
    );
};

interface SearchbaseBrowserProps {
    open: boolean;
    records: SearchbaseRecord[];
    canvasTiles: CanvasTile[];
    replaceTileId: string | null;
    onClose: () => void;
    onAddRecord: (record: SearchbaseRecord) => void;
    onAddRecords: (records: SearchbaseRecord[]) => void;
}

const ALL = '__all__';
const UNSET_VIZ = '__unset_viz__';

const vizFilterValue = (record: SearchbaseRecord): string => {
    const raw = record.defaultViz?.trim();
    return raw ? raw.toLowerCase() : UNSET_VIZ;
};

const vizFilterLabel = (value: string): string =>
    value === UNSET_VIZ ? 'No default_viz' : formatVizLabel(value);

const SearchbaseBrowser: React.FC<SearchbaseBrowserProps> = ({
    open,
    records,
    canvasTiles,
    replaceTileId,
    onClose,
    onAddRecord,
    onAddRecords,
}) => {
    const [query, setQuery] = useState('');
    const [app, setApp] = useState(APP_NAME);
    const [category, setCategory] = useState(ALL);
    const [subCategory, setSubCategory] = useState(ALL);
    const [vizType, setVizType] = useState(ALL);
    const [tagInput, setTagInput] = useState('');
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
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
            Array.from(new Set(records.map((record) => record.dispatchContext).filter(Boolean))).sort(),
        [records]
    );

    useEffect(() => {
        if (appOptions.length > 0 && !appOptions.includes(app) && app !== ALL) {
            setApp(appOptions.includes(APP_NAME) ? APP_NAME : ALL);
        }
    }, [app, appOptions]);

    const appScopedRecords = useMemo(
        () =>
            records.filter((record) =>
                app === ALL ? true : record.dispatchContext === app
            ),
        [app, records]
    );

    const categoryOptions = useMemo(
        () =>
            Array.from(
                new Set(appScopedRecords.map((record) => record.category).filter(Boolean))
            ).sort(),
        [appScopedRecords]
    );

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

    const tagOptions = useMemo(() => {
        const tagCounts = new Map<string, number>();
        for (const record of facetScopedRecords) {
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
    }, [facetScopedRecords, selectedTags, tagInput]);

    const filteredRecords = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        return facetScopedRecords.filter((record) => {
            if (
                selectedTags.length > 0 &&
                !selectedTags.every((tag) => record.tags.includes(tag))
            ) {
                return false;
            }
            if (!normalizedQuery) return true;
            const haystack = [
                record.id,
                record.searchName,
                record.category,
                record.subCategory,
                record.dispatchContext,
                record.tags.join(' '),
                plainTextFromHtml(record.description),
            ]
                .join(' ')
                .toLowerCase();
            return haystack.includes(normalizedQuery);
        });
    }, [facetScopedRecords, query, selectedTags]);

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

    const hasActiveFilters =
        query.trim().length > 0 ||
        app !== APP_NAME ||
        category !== ALL ||
        subCategory !== ALL ||
        vizType !== ALL ||
        selectedTags.length > 0;

    const resetFilters = () => {
        setQuery('');
        setApp(appOptions.includes(APP_NAME) ? APP_NAME : ALL);
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
        <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[520px] flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
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

            <div className="border-b border-slate-200 p-4 dark:border-slate-800">
                <label className="relative block">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Filter by name, description, or tag..."
                        className="h-12 w-full rounded-md border border-slate-300 bg-white pl-10 pr-3 text-base text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-sky-900"
                    />
                </label>

                <div className="mt-4 flex items-center gap-2">
                    <div className="inline-flex items-center gap-2 rounded-md bg-slate-100 px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-slate-800 dark:bg-slate-800 dark:text-slate-100">
                        <span>Filters</span>
                        {hasActiveFilters && (
                            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] tracking-normal text-sky-700 dark:bg-sky-900 dark:text-sky-200">
                                active
                            </span>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={resetFilters}
                        className="ml-auto text-xs font-black uppercase tracking-[0.18em] text-slate-400 transition-colors hover:text-sky-600 dark:hover:text-sky-300"
                    >
                        Clear filters
                    </button>
                </div>

                <div className="mt-3 grid grid-cols-[88px_minmax(0,1fr)] gap-x-3 gap-y-3">
                    <label className="self-center text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                        App
                    </label>
                    <select
                        value={app}
                        onChange={(event) => setApp(event.target.value)}
                        className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-sky-900"
                    >
                        <option value={ALL}>All apps</option>
                        {appOptions.map((option) => (
                            <option key={option} value={option}>
                                {option}
                            </option>
                        ))}
                    </select>

                    <label className="self-center text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                        Category
                    </label>
                    <select
                        value={category}
                        onChange={(event) => setCategory(event.target.value)}
                        className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-sky-900"
                    >
                        <option value={ALL}>All categories</option>
                        {categoryOptions.map((option) => (
                            <option key={option} value={option}>
                                {option}
                            </option>
                        ))}
                    </select>

                    <label className="self-center text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                        Sub-cat
                    </label>
                    <select
                        value={subCategory}
                        onChange={(event) => setSubCategory(event.target.value)}
                        className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-sky-900"
                    >
                        <option value={ALL}>All sub-categories</option>
                        {subCategoryOptions.map((option) => (
                            <option key={option} value={option}>
                                {option}
                            </option>
                        ))}
                    </select>

                    <label className="self-center text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                        Viz
                    </label>
                    <select
                        value={vizType}
                        onChange={(event) => setVizType(event.target.value)}
                        className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-sky-900"
                    >
                        <option value={ALL}>All viz types</option>
                        {vizTypeOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label} ({option.count})
                            </option>
                        ))}
                    </select>
                </div>

                <div className="mt-4">
                    <label className="relative block">
                        <input
                            value={tagInput}
                            onChange={(event) => setTagInput(event.target.value)}
                            placeholder="Filter by tag..."
                            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-sky-900"
                        />
                    </label>
                    {(selectedTags.length > 0 || tagOptions.length > 0) && (
                        <div className="mt-2 flex max-h-24 flex-wrap gap-1 overflow-y-auto">
                            {selectedTags.map((tag) => (
                                <button
                                    key={tag}
                                    type="button"
                                    onClick={() =>
                                        setSelectedTags((current) =>
                                            current.filter((value) => value !== tag)
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
                                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-500 hover:border-sky-300 hover:text-sky-600 dark:border-slate-700 dark:text-slate-400 dark:hover:border-sky-700 dark:hover:text-sky-300"
                                >
                                    {tag}
                                    <span className="text-slate-400">{count}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <span className="font-bold">{filteredRecords.length.toLocaleString()} searches</span>
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
                {records.length === 0 ? (
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
                                                {[record.category, record.subCategory]
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
    const [runningTileIds, setRunningTileIds] = useState<Set<string>>(
        () => new Set()
    );
    const userStoppedRef = useRef(false);
    const [observedNoDataByTile, setObservedNoDataByTile] = useState<
        Map<string, ObservedNoDataEntry>
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
        let cancelled = false;
        setLoadingCatalogue(true);
        getSearchbaseCatalogue()
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
    }, [rangeLabel]);

    const entryByName = useMemo(() => {
        const map = new Map<string, SearchbaseRecord>();
        for (const record of records) {
            if (record.searchName) map.set(record.searchName, record);
        }
        return map;
    }, [records]);

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
    const filteredTiles = useMemo(() => {
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

    const totalPages = Math.max(1, Math.ceil(filteredTiles.length / pageSize));
    const clampedPageIndex = Math.min(pageIndex, totalPages - 1);
    const pageStart = clampedPageIndex * pageSize;
    const visibleTiles = filteredTiles.slice(pageStart, pageStart + pageSize);
    const pageEnd = Math.min(pageStart + pageSize, filteredTiles.length);
    const runnableVisibleTiles = visibleTiles.filter((tile) =>
        entryByName.has(tile.searchName)
    );
    const visibleTilesRunKey = useMemo(
        () => runnableVisibleTiles.map((tile) => tile.id).join('\u0001'),
        [runnableVisibleTiles]
    );
    const idleVisibleTileCount = runnableVisibleTiles.filter(
        (tile) => !runningTileIds.has(tile.id)
    ).length;
    const runVisibleTitle =
        idleVisibleTileCount > 0
            ? `Run ${idleVisibleTileCount.toLocaleString()} visible ${
                  idleVisibleTileCount === 1 ? 'tile' : 'tiles'
              }`
            : 'All visible tiles are already running';

    useEffect(() => {
        setPageIndex((current) => Math.min(current, totalPages - 1));
    }, [totalPages]);

    useEffect(() => {
        setPageIndex(0);
    }, [tileSearchQuery]);

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
                setRunningTileIds(new Set());
                setObservedNoDataByTile(new Map());
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
                            ? { ...tile, searchName: record.searchName }
                            : tile
                    );
                });
                if (!replaced) return;
                clearObservedNoData([replaceTileId]);
                setRunningTileIds((current) => {
                    const next = new Set(current);
                    next.add(replaceTileId);
                    return next;
                });
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
            setPageIndex(Math.floor(tiles.length / pageSize));
        },
        [clearObservedNoData, pageSize, replaceTileId, runNewTiles, tiles]
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
        clearObservedNoData([tileId]);
    }, [clearObservedNoData]);

    const runTile = useCallback((tileId: string) => {
        clearObservedNoData([tileId]);
        setRunningTileIds((current) => {
            if (current.has(tileId)) return current;
            const next = new Set(current);
            next.add(tileId);
            return next;
        });
    }, [clearObservedNoData]);

    const stopTile = useCallback((tileId: string) => {
        setRunningTileIds((current) => {
            if (!current.has(tileId)) return current;
            const next = new Set(current);
            next.delete(tileId);
            return next;
        });
        userStoppedRef.current = true;
    }, []);

    const runVisibleTiles = useCallback(() => {
        userStoppedRef.current = false;
        clearObservedNoData(runnableVisibleTiles.map((tile) => tile.id));
        setRunningTileIds((current) => {
            const next = new Set(current);
            for (const tile of runnableVisibleTiles) {
                next.add(tile.id);
            }
            return next;
        });
    }, [clearObservedNoData, runnableVisibleTiles]);

    useEffect(() => {
        userStoppedRef.current = false;

        if (loadingCatalogue || idleVisibleTileCount === 0) {
            return undefined;
        }

        const timeoutId = window.setTimeout(() => {
            if (userStoppedRef.current) return;
            runVisibleTiles();
        }, 200);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [
        clampedPageIndex,
        pageSize,
        tileSearchQuery,
        visibleTilesRunKey,
        loadingCatalogue,
        runVisibleTiles,
    ]);

    const stopAllTiles = useCallback(() => {
        userStoppedRef.current = true;
        setRunningTileIds(new Set());
    }, []);

    const refreshRunningTiles = useCallback(() => {
        const runningIds = Array.from(runningTileIds);
        clearObservedNoData(runningIds);
        setRefreshToken((current) => current + 1);
    }, [clearObservedNoData, runningTileIds]);

    const refreshTile = useCallback(
        (tileId: string) => {
            clearObservedNoData([tileId]);
            setTileRefreshCounts((current) => ({
                ...current,
                [tileId]: (current[tileId] ?? 0) + 1,
            }));
        },
        [clearObservedNoData]
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
        setPageIndex(0);
        setTileSearchQuery('');
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
        setPageIndex(0);
        setTileSearchQuery('');
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

    return (
        <div
            className={cn(
                resolvedTheme === 'dark' && 'dark',
                'min-h-screen overflow-x-hidden bg-slate-50 font-sans text-slate-900 dark:bg-slate-900 dark:text-slate-50'
            )}
        >
            <div className="flex min-h-screen min-w-0 flex-col overflow-x-hidden">
                <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
                    <div className="flex h-12 min-w-0 items-center border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-950">
                        <div className="flex h-8 w-[240px] min-w-0 shrink-0 items-center">
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
                                    className="block h-8 w-full rounded-none border-0 border-b border-slate-300 bg-transparent p-0 text-base font-bold leading-8 text-slate-950 outline-none transition-colors placeholder:text-slate-400 focus:ring-0 dark:border-slate-600 dark:text-slate-50 dark:placeholder:text-slate-600"
                                    aria-label="Canvas name"
                                />
                            ) : (
                                <button
                                    type="button"
                                    onDoubleClick={() => setEditingCanvasName(true)}
                                    className="flex h-8 w-full items-center truncate border-0 bg-transparent p-0 text-left text-base font-bold leading-8 text-slate-950 transition-colors focus:outline-none dark:text-slate-50"
                                    title="Double-click to rename"
                                    aria-label="Edit canvas name"
                                >
                                    {canvasNameDisplay}
                                </button>
                            )}
                        </div>
                        <select
                            value={activeSavedCanvasName ?? ''}
                            onChange={(event) => {
                                const name = event.target.value;
                                if (name) void loadCanvasByName(name);
                            }}
                            disabled={savingCanvas}
                            className="ml-3 block h-8 w-[260px] shrink-0 rounded-sm border border-slate-300 bg-white px-3 py-0 text-sm leading-8 text-slate-900 outline-none focus:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-slate-500"
                        >
                            <option value="">Load saved canvas...</option>
                            {savedCanvases.map((canvas) => (
                                <option key={canvas.name} value={canvas.name}>
                                    {canvas.name}
                                </option>
                            ))}
                        </select>
                        <span className="sr-only" aria-live="polite">
                            {catalogueError
                                ? catalogueError
                                : loadingCatalogue
                                ? 'Loading catalogue'
                                : saveStatus || (canvasDirty ? 'Unsaved changes' : '')}
                        </span>
                        <div className="ml-auto flex h-8 items-center gap-1">
                            <button
                                type="button"
                                onClick={cycle}
                                title={themeTitle}
                                aria-label={themeTitle}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus:ring-slate-700"
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
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus:ring-slate-700"
                                >
                                    <MoreVertical className="h-4 w-4" />
                                </button>
                                {moreMenuOpen && (
                                    <div className="absolute right-0 z-30 mt-2 w-52 rounded-sm border border-slate-200 bg-white p-1.5 shadow-lg dark:border-slate-800 dark:bg-slate-900">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setMoreMenuOpen(false);
                                                createNewCanvas();
                                            }}
                                            className="flex h-8 w-full items-center gap-2 rounded px-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
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
                                            className="flex h-8 w-full items-center gap-2 rounded px-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-200 dark:hover:bg-slate-800"
                                        >
                                            <Copy className="h-3.5 w-3.5" />
                                            Save as
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setMoreMenuOpen(false);
                                                setNoDataReportOpen(true);
                                            }}
                                            className="flex h-8 w-full items-center gap-2 rounded px-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                                        >
                                            <Table2 className="h-3.5 w-3.5" />
                                            No data report
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setMoreMenuOpen(false);
                                                void deleteActiveCanvas();
                                            }}
                                            disabled={savingCanvas || !activeSavedCanvasName}
                                            className="flex h-8 w-full items-center gap-2 rounded px-2 text-left text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-rose-300 dark:hover:bg-rose-950"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                            Delete saved canvas
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="relative flex h-[54px] min-w-0 items-center border-b border-slate-200 bg-slate-50/60 px-4 dark:border-slate-800 dark:bg-slate-950">
                        <div className="flex min-w-0 items-center gap-2">
                            <button
                                type="button"
                                onClick={saveCurrentCanvas}
                                disabled={savingCanvas || tiles.length === 0}
                                title="Save canvas"
                                className="inline-flex h-9 items-center gap-1.5 rounded-sm bg-[#00A86B] px-3 text-sm font-bold text-white transition hover:bg-[#008556] disabled:cursor-not-allowed disabled:opacity-45 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                            >
                                <Save className="h-3.5 w-3.5" />
                                Save
                            </button>
                            <button
                                type="button"
                                onClick={saveCanvasAs}
                                disabled={savingCanvas || tiles.length === 0}
                                title="Save canvas as"
                                className="inline-flex h-9 items-center rounded-sm bg-slate-200 px-3 text-sm font-bold text-slate-900 transition hover:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-45 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                            >
                                Save As
                            </button>
                            <button
                                type="button"
                                onClick={deleteActiveCanvas}
                                disabled={savingCanvas || !activeSavedCanvasName}
                                title="Delete saved canvas"
                                className="inline-flex h-9 items-center gap-1.5 rounded-sm px-2.5 text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-45 focus:outline-none focus:ring-2 focus:ring-red-200 dark:text-red-300 dark:hover:bg-red-950"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                                Delete
                            </button>
                            <button
                                type="button"
                                onClick={createNewCanvas}
                                title="Create a new empty canvas"
                                className="inline-flex h-9 items-center gap-1.5 rounded-sm px-2.5 text-sm font-bold text-slate-900 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:text-slate-100 dark:hover:bg-slate-900 dark:focus:ring-slate-700"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                New
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={() => {
                                setReplaceTileId(null);
                                setBrowserOpen(true);
                            }}
                            className="absolute left-1/2 inline-flex h-9 -translate-x-1/2 items-center justify-center gap-1.5 rounded-sm bg-[#00A86B] px-7 text-sm font-bold text-white transition hover:bg-[#008556] focus:outline-none focus:ring-2 focus:ring-emerald-300"
                        >
                            <Plus className="h-4 w-4" />
                            Add Tiles
                        </button>

                        <div className="ml-auto flex min-w-0 items-center gap-2">
                            <button
                                type="button"
                                disabled={idleVisibleTileCount === 0}
                                onClick={runVisibleTiles}
                                title={runVisibleTitle}
                                className="inline-flex h-9 items-center gap-1.5 rounded-sm bg-[#00A86B] px-3 text-sm font-bold text-white transition hover:bg-[#008556] disabled:cursor-not-allowed disabled:opacity-45 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                            >
                                <Play className="h-3.5 w-3.5" />
                                Run Visible
                            </button>
                            <button
                                type="button"
                                disabled={runningTileIds.size === 0}
                                onClick={stopAllTiles}
                                title="Stop all running tiles"
                                className="inline-flex h-9 items-center gap-1.5 rounded-sm bg-red-500 px-3 text-sm font-bold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-45 focus:outline-none focus:ring-2 focus:ring-red-300"
                            >
                                <Square className="h-3.5 w-3.5" />
                                Stop
                            </button>
                            <button
                                type="button"
                                onClick={refreshRunningTiles}
                                disabled={runningTileIds.size === 0}
                                title="Refresh running tiles"
                                aria-label="Refresh running tiles"
                                className="inline-flex h-9 w-9 items-center justify-center rounded-sm text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-45 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus:ring-slate-700"
                            >
                                <RefreshCw className="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                    <div className="flex h-10 min-w-0 items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 dark:border-slate-800 dark:bg-slate-900/70">
                        <span className="inline-flex h-7 items-center rounded-sm border border-slate-300 bg-white px-2 text-sm font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                            Tiles: {tiles.length.toLocaleString()}
                        </span>
                        <span
                            className={cn(
                                'inline-flex h-7 items-center rounded-sm border px-2 text-sm font-semibold',
                                runningTileIds.size > 0
                                    ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200'
                                    : 'border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300'
                            )}
                        >
                            Running: {runningTileIds.size.toLocaleString()}
                        </span>
                        <span
                            className={cn(
                                'inline-flex h-7 items-center rounded-sm border px-2 text-sm font-semibold',
                                observedNoDataRows.length > 0
                                    ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200'
                                    : 'border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300'
                            )}
                        >
                            No Data: {observedNoDataRows.length.toLocaleString()}
                        </span>
                        <span className="inline-flex h-7 items-center rounded-sm border border-slate-300 bg-white px-2 text-sm font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                            Total Searches: {records.length.toLocaleString()}
                        </span>

                        <div className="ml-auto flex items-center gap-2">
                            <select
                                value={rangeLabel}
                                onChange={(event) => setRangeLabel(event.target.value)}
                                aria-label="Time range"
                                className="h-8 w-[150px] rounded-sm border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none focus:border-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-500"
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
                                className="h-8 w-[130px] rounded-sm border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none focus:border-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-500"
                            >
                                {PAGE_SIZE_OPTIONS.map((option) => (
                                    <option key={option} value={option}>
                                        {option} per page
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </header>

                <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden bg-slate-50 p-5 dark:bg-slate-900">
                    <div className="mb-4 flex min-w-0 items-center gap-3">
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
                        {hasTileSearch && (
                            <div className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                                {filteredTiles.length.toLocaleString()} of{' '}
                                {tiles.length.toLocaleString()} matched
                            </div>
                        )}
                    </div>

                    <div className="mb-4 flex min-w-0 flex-wrap items-center gap-2">
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
                        <div className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                            {filteredTiles.length === 0
                                ? '0 shown'
                                : `${pageStart + 1}-${pageEnd} of ${
                                      hasTileSearch
                                          ? `${filteredTiles.length.toLocaleString()} matched`
                                          : filteredTiles.length.toLocaleString()
                                  }`}
                        </div>
                        {tiles.length > 0 && (
                            <button
                                type="button"
                                onClick={clearCanvas}
                                className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-sm border border-slate-300 bg-white px-3 text-xs font-black text-slate-500 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-rose-800 dark:hover:bg-rose-950 dark:hover:text-rose-300"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                                Clear
                            </button>
                        )}
                    </div>

                    {tiles.length === 0 ? (
                        <div className="flex min-h-[420px] items-center justify-center rounded-md border border-dashed border-slate-300 bg-white dark:border-slate-800 dark:bg-slate-900">
                            <div className="mx-auto max-w-sm px-6 text-center">
                                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-md bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-300">
                                    <Plus className="h-7 w-7" />
                                </div>
                                <h2 className="mt-4 text-xl font-black text-slate-950 dark:text-slate-50">
                                    No tiles yet
                                </h2>
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
                        <div className="flex min-h-[360px] items-center justify-center rounded-md border border-dashed border-slate-300 bg-white dark:border-slate-800 dark:bg-slate-900">
                            <div className="mx-auto max-w-sm px-6 text-center">
                                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-md bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                                    <Search className="h-7 w-7" />
                                </div>
                                <h2 className="mt-4 text-xl font-black text-slate-950 dark:text-slate-50">
                                    No matching tiles
                                </h2>
                                <p className="mt-2 text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">
                                    Try a different tile name, tag, category, or SPL fragment.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setTileSearchQuery('')}
                                    className="mt-5 inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-black text-white transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white"
                                >
                                    <X className="h-4 w-4" />
                                    Clear search
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
                                    {visibleTiles.map((tile) => (
                                        <div
                                            key={tile.id}
                                            className={cn(TILE_SPAN_CLASS[tile.span])}
                                        >
                                            <SortableMetricCard
                                                id={tile.id}
                                                ariaLabel={tile.searchName}
                                            >
                                                <SearchbaseCanvasTile
                                                    tile={tile}
                                                    record={entryByName.get(tile.searchName)}
                                                    entryByName={entryByName}
                                                    range={range}
                                                    refreshToken={
                                                        refreshToken +
                                                        (tileRefreshCounts[tile.id] ?? 0)
                                                    }
                                                    isRunning={runningTileIds.has(tile.id)}
                                                    onRun={runTile}
                                                    onStop={stopTile}
                                                    onRefresh={refreshTile}
                                                    onConfigure={configureTile}
                                                    onRemove={removeTile}
                                                    onCycleSize={cycleSize}
                                                    onChangeViz={changeTileViz}
                                                    onOpenDetailTable={setActiveDetailTable}
                                                    onNoDataObservation={
                                                        updateNoDataObservation
                                                    }
                                                />
                                            </SortableMetricCard>
                                        </div>
                                    ))}
                                </div>
                            </SortableContext>
                        </DndContext>
                    )}
                </main>
            </div>

            {browserOpen && (
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
                open={browserOpen}
                records={records}
                canvasTiles={tiles}
                replaceTileId={replaceTileId}
                onClose={() => {
                    setBrowserOpen(false);
                    setReplaceTileId(null);
                }}
                onAddRecord={addRecord}
                onAddRecords={addRecords}
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
