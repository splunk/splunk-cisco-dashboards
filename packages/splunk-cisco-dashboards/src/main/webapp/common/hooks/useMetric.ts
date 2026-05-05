/**
 * useMetric — single source of truth for an executive metric.
 *
 * Resolves a {@link MetricConfig} to a {@link MetricResult} by:
 *   1. Dispatching literal SPL from searchbase.conf when available, or
 *      a saved-search fallback when a scheduled search is intentional.
 *   2. Optionally running a second search shifted by the time-range
 *      span to populate {@link MetricResult.previousSparkData} for the
 *      "vs. previous period" overlay.
 *   3. Falling back to deterministic mock data if nothing is wired,
 *      the search errors, or the search returns zero rows.
 *
 * The hook also computes a `status` ('healthy' | 'warning' | 'critical'
 * | 'unknown') from the metric's threshold rules so callers can colour
 * cards / build aggregate health badges without re-implementing the
 * threshold logic.
 */

import { useEffect, useState } from 'react';
import { runSearch } from '../services/splunkSearchService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SectionId = 'it_health' | 'security' | 'building';
export type MetricStatus = 'healthy' | 'warning' | 'critical' | 'unknown';
export type DataSource = 'live' | 'mock' | 'loading';

export interface MetricThresholds {
    /** Headline value at which the metric flips to warning. */
    warning?: number;
    /** Headline value at which the metric flips to critical. */
    critical?: number;
    /**
     * 'higher_is_better' (e.g. health %)  — flag when value < threshold.
     * 'lower_is_better'  (e.g. open issues, threats) — flag when value > threshold.
     */
    direction: 'higher_is_better' | 'lower_is_better';
}

export interface MetricConfig {
    id: string;
    section: SectionId;
    label: string;
    /** Brief sub-label shown directly under the metric headline. */
    subLabel: string;
    /**
     * Long-form description shown in the per-metric Info tooltip. Should
     * answer "what does this number actually mean?" — one or two lines.
     */
    description?: string;
    /**
     * Search binding name. Historically this pointed at savedsearches.conf;
     * new overview bindings resolve to searchbase.conf first and use
     * saved-search dispatch only for deliberately scheduled searches.
     * Mutually exclusive with {@link MetricConfig.spl}.
     */
    savedSearch?: string;
    /**
     * Inline SPL string — preferred when no existing saved search has
     * the right shape. Mutually exclusive with `savedSearch`.
     */
    spl?: string;
    /** Field name in the search results to read the headline + sparkline from. */
    valueField?: string;
    /** Optional explicit signed % change field; if missing, auto-computed. */
    changeField?: string;
    /**
     * When true the hook also dispatches a second search shifted back
     * by `range.spanSeconds` to populate the dashed previous-period
     * line on the sparkline. Only meaningful for time-series searches
     * (multiple rows). Defaults to false.
     */
    comparePeriod?: boolean;
    unit?: string;
    color?: string;
    thresholds?: MetricThresholds;
    /**
     * When true, a successful search that returns zero rows renders an
     * honest "no data" state (value = 0, source = 'live') instead of
     * falling back to {@link MetricConfig.mock}. Used by the picker
     * override path so a swapped tile never re-displays the *original*
     * tile's hardcoded mock value when the new SPL has nothing to say
     * on this Splunk instance — that would look identical to "the
     * picker did nothing" even though the dispatch did change.
     */
    suppressMockOnEmpty?: boolean;
    mock: {
        seed: number;
        sparkMin: number;
        sparkMax: number;
        value: number;
        change: number;
    };
}

export interface TimeRange {
    earliest: string;
    latest: string;
    label: string;
    /**
     * Approximate length of the window in seconds. Used to shift the
     * comparison-period search by the same amount.
     */
    spanSeconds: number;
}

/**
 * Why a tile is rendering "no data". Populated only when `value` is
 * `Number.NaN` — `MetricItem` uses it to draw a more diagnostic
 * subtext (e.g. "0 rows returned in last 7 days") instead of a bare
 * "no data" that looks identical to a code bug.
 *
 *   • 'empty_rows'         — Splunk returned 0 rows for the dispatched SPL.
 *   • 'no_numeric_column'  — rows came back but no row exposed any
 *                            usable numeric column (typical of a
 *                            timechart whose every bucket was empty,
 *                            or an `eventstats` that returned only
 *                            string fields).
 *   • 'column_missing'     — rows came back, the user explicitly
 *                            specified a `valueField`, but no row
 *                            exposed that column. We deliberately do
 *                            NOT silently substitute another column —
 *                            the user typed it on purpose, so we let
 *                            them see the failure (and the picker
 *                            chips guide them to a valid one).
 *   • 'error'              — the dispatch itself rejected (e.g. CIM
 *                            data model missing, app namespace mis-
 *                            configuration, SPL validation failure).
 */
export type NoDataReason =
    | 'empty_rows'
    | 'no_numeric_column'
    | 'column_missing'
    | 'error';

export interface MetricResult {
    value: number;
    change: number;
    sparkData: number[];
    /**
     * Per-bucket timestamps (Unix-epoch ms) aligned 1:1 with
     * `sparkData`. Populated when the underlying search returns rows
     * with a parseable `_time` (e.g. `timechart`-based saved searches).
     * Empty for single-row + mock spark — the Sparkline component
     * synthesises evenly-spaced timestamps in that case.
     */
    sparkTimestamps: number[];
    /** Same shape as sparkData but for the previous period; empty if unavailable. */
    previousSparkData: number[];
    source: DataSource;
    status: MetricStatus;
    /** SPL that was (or would be) executed. Used by the click-to-search drilldown. */
    spl: string;
    /** Resolved saved-search name (convention or override). */
    resolvedSavedSearch: string;
    /** Set only when `Number.isNaN(value)` — see {@link NoDataReason}. */
    noDataReason?: NoDataReason;
    /**
     * Echo of the time range we ran against. The UI uses this to show
     * "no data in last 7 days" rather than "no data" alone, so it's
     * obvious whether the swap actually dispatched.
     */
    rangeLabel?: string;
}

// ---------------------------------------------------------------------------
// Mock generator (seeded LCG so renders are stable)
// ---------------------------------------------------------------------------

const seededRandom = (seed: number): (() => number) => {
    let s = seed >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 0xffffffff;
    };
};

const generateMockSparkline = (
    seed: number,
    len: number,
    min: number,
    max: number
): number[] => {
    const rnd = seededRandom(seed);
    return Array.from({ length: len }, () => Math.floor(rnd() * (max - min + 1) + min));
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SAVED_SEARCH_NAME_PATTERN = /^[\w\s\-.:()]+$/;

const buildSavedSearchSpl = (name: string): string => {
    if (!name || name.length > 256) return '';
    if (!SAVED_SEARCH_NAME_PATTERN.test(name)) return '';
    return `| savedsearch "${name}"`;
};

/**
 * Resolve the SPL to dispatch for a metric. Inline SPL wins; otherwise
 * we wrap a saved search; otherwise we return the empty string which
 * tells the hook to skip the network call entirely (mock-only).
 */
const resolveMetricSpl = (cfg: { spl?: string; savedSearch?: string }): string => {
    if (cfg.spl && cfg.spl.trim().length > 0) return cfg.spl;
    if (cfg.savedSearch) return buildSavedSearchSpl(cfg.savedSearch);
    return '';
};

export const computeStatus = (
    value: number,
    thresholds?: MetricThresholds
): MetricStatus => {
    if (!thresholds || !Number.isFinite(value)) return 'unknown';
    const { warning, critical, direction } = thresholds;
    if (direction === 'higher_is_better') {
        if (critical !== undefined && value < critical) return 'critical';
        if (warning !== undefined && value < warning) return 'warning';
        return 'healthy';
    }
    if (critical !== undefined && value > critical) return 'critical';
    if (warning !== undefined && value > warning) return 'warning';
    return 'healthy';
};

const buildMockSparkline = (cfg: MetricConfig): number[] =>
    generateMockSparkline(cfg.mock.seed, 20, cfg.mock.sparkMin, cfg.mock.sparkMax);

const buildMock = (cfg: MetricConfig, spl: string, savedSearch: string): MetricResult => {
    const value = cfg.mock.value;
    return {
        value,
        change: cfg.mock.change,
        sparkData: buildMockSparkline(cfg),
        sparkTimestamps: [],
        previousSparkData: [],
        source: 'mock',
        status: computeStatus(value, cfg.thresholds),
        spl,
        resolvedSavedSearch: savedSearch,
    };
};

// ---------------------------------------------------------------------------
// Value-field auto-detection
// ---------------------------------------------------------------------------
//
// When a tile is bound to a searchbase entry via the picker without an
// explicit `valueField`, we don't know in advance what column the SPL
// emits — `stats count`, `stats latest(score) as score`, `stats dc(x) as
// active`, `timechart count`, etc. all have different output names.
//
// Critical: we MUST scan every row (not just rows[0]). Splunk's
// timechart JSON output omits the value column from rows whose bucket
// had no events. On a sparse search (e.g. one big spike on day N and
// silence everywhere else), rows[0] is often just `{_time, _span}`
// with no value column at all — inspecting only the first row makes
// auto-detect fall through to the default 'value' and every subsequent
// lookup returns undefined → NaN → empty series → "no data". That bug
// made every picker-swapped tile show "no data" regardless of whether
// the search had real data later in the window.
const PREFERRED_VALUE_FIELDS: readonly string[] = [
    'value',
    'count',
    'score',
    'pct',
    'total',
    'health',
    'rate',
    'sum',
    'avg',
];

/**
 * Returns the name of a numeric column found anywhere in `rows`, or
 * null when no row exposes a usable numeric value. The two-stage scan
 * prefers conventional column names (`value`, `count`, `score`, …)
 * across all rows before falling back to the first non-internal
 * numeric column it finds.
 */
const autoDetectValueField = (
    rows: ReadonlyArray<Record<string, unknown>>
): string | null => {
    if (rows.length === 0) return null;
    const isUsable = (raw: unknown): boolean =>
        raw !== null &&
        raw !== undefined &&
        raw !== '' &&
        Number.isFinite(Number(raw));

    for (const name of PREFERRED_VALUE_FIELDS) {
        for (const r of rows) {
            if (isUsable(r[name])) return name;
        }
    }
    // Splunk uses leading underscore for system fields (_time, _span,
    // _raw, etc.) which we never want to surface as a headline value.
    for (const r of rows) {
        for (const [key, val] of Object.entries(r)) {
            if (key.startsWith('_')) continue;
            if (isUsable(val)) return key;
        }
    }
    return null;
};

/**
 * Convert a single row's column value into a number, treating empty
 * buckets as 0 for sparkline continuity. The headline is selected
 * separately from the latest row that actually contains the metric
 * field, so trailing empty `timechart` buckets don't become a fake 0.
 */
const rowToNumber = (raw: unknown): number => {
    if (raw === null || raw === undefined || raw === '') return 0;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
};

// ---------------------------------------------------------------------------
// Diagnostic logging
// ---------------------------------------------------------------------------
//
// Set `window.__SCD_DEBUG_METRICS__ = true` in the browser console
// before swapping a tile to see exactly what the hook is doing —
// dispatched SPL, row counts, detected value field, and which
// branch the result took. Off by default so executives never see
// debug spam in their console.
const isMetricDebug = (): boolean => {
    if (typeof window === 'undefined') return false;
    return Boolean(
        (window as unknown as { __SCD_DEBUG_METRICS__?: boolean })
            .__SCD_DEBUG_METRICS__
    );
};

const debugLog = (id: string, msg: string, payload: unknown): void => {
    if (!isMetricDebug()) return;
    // eslint-disable-next-line no-console
    console.debug(`[scd-metric][${id}] ${msg}`, payload);
};

// Pull a Unix-epoch (ms) timestamp out of a search result row. Splunk
// returns _time as either a numeric epoch (string), an ISO 8601 string,
// or both depending on output_mode. We try epoch first, then ISO. Returns
// null if neither parses.
const extractRowTimestamp = (row: Record<string, unknown>): number | null => {
    const raw = row._time;
    if (raw === undefined || raw === null) return null;
    if (typeof raw === 'number' && Number.isFinite(raw)) {
        // Heuristic: epoch < 1e12 → seconds; else ms.
        return raw < 1e12 ? raw * 1000 : raw;
    }
    const str = String(raw).trim();
    if (str === '') return null;
    const numeric = Number(str);
    if (Number.isFinite(numeric)) {
        return numeric < 1e12 ? numeric * 1000 : numeric;
    }
    const parsed = Date.parse(str);
    return Number.isFinite(parsed) ? parsed : null;
};

// Tries to shift `earliest` and `latest` back by spanSeconds. Used for
// the comparison-period search. Falls back to relative -2*span/-1*span
// strings when we can't derive a real timestamp from `latest`.
const computePreviousRange = (range: TimeRange): { earliest: string; latest: string } => {
    if (range.spanSeconds > 0) {
        return {
            earliest: `-${range.spanSeconds * 2}s`,
            latest: `-${range.spanSeconds}s`,
        };
    }
    return { earliest: '-14d@d', latest: '-7d@d' };
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export const useMetric = (
    cfg: MetricConfig,
    range: TimeRange,
    refreshToken: number
): MetricResult => {
    const spl = resolveMetricSpl(cfg);
    const savedSearchName = cfg.savedSearch ?? '';
    const initialMock = buildMock(cfg, spl, savedSearchName);
    const [result, setResult] = useState<MetricResult>(initialMock);

    useEffect(() => {
        const mock = buildMock(cfg, spl, savedSearchName);
        // Empty SPL → no real search wired. Stay mock; never hit the
        // network. This is the primary defence against console-spam
        // 400s when a metric has no binding yet.
        if (!spl) {
            setResult(mock);
            return undefined;
        }
        let cancelled = false;
        setResult({ ...mock, source: 'loading' });

        const livePromise = runSearch({
            spl,
            earliestTime: range.earliest,
            latestTime: range.latest,
            tag: cfg.id,
        });

        const previousRange = computePreviousRange(range);
        const previousPromise = cfg.comparePeriod
            ? runSearch({
                  spl,
                  earliestTime: previousRange.earliest,
                  latestTime: previousRange.latest,
                  tag: `${cfg.id}__prev`,
              }).catch(() => ({ results: [] as Array<Record<string, unknown>> }))
            : Promise.resolve({ results: [] as Array<Record<string, unknown>> });

        const buildNoData = (reason: NoDataReason): MetricResult => ({
            value: Number.NaN,
            change: Number.NaN,
            sparkData: [],
            sparkTimestamps: [],
            previousSparkData: [],
            source: 'live',
            status: 'unknown',
            spl,
            resolvedSavedSearch: savedSearchName,
            noDataReason: reason,
            rangeLabel: range.label,
        });

        debugLog(cfg.id, 'dispatching', {
            spl,
            earliest: range.earliest,
            latest: range.latest,
            label: range.label,
            valueField: cfg.valueField,
            suppressMockOnEmpty: Boolean(cfg.suppressMockOnEmpty),
        });

        Promise.all([livePromise, previousPromise])
            .then(([liveRes, prevRes]) => {
                if (cancelled) return;
                const rows = (liveRes?.results ?? []) as Array<Record<string, unknown>>;

                // Truly empty result (Splunk returned no rows at all).
                if (rows.length === 0) {
                    debugLog(cfg.id, 'no rows returned', {
                        rangeLabel: range.label,
                    });
                    setResult(
                        cfg.suppressMockOnEmpty ? buildNoData('empty_rows') : mock
                    );
                    return;
                }

                // Resolve which column we'll read for the headline /
                // sparkline. Two paths:
                //
                //   A) cfg.valueField IS set — the user explicitly
                //      typed a column in the picker. Honor it strictly:
                //      if no row exposes it we surface 'column_missing'
                //      rather than silently substituting another
                //      column. Silently substituting is what made the
                //      Value Field appear to "have no effect" — the
                //      user types `num`, the SPL emits `score`, and
                //      auto-detect kicks in to pick `score`. Looks
                //      identical to ignoring the input.
                //
                //   B) cfg.valueField is NOT set — auto-detect scans
                //      every row for a usable numeric column,
                //      preferring well-known names (count / score /
                //      pct / value) before falling back to the first
                //      finite numeric column.
                const fieldExists = (name: string): boolean =>
                    rows.some((r) => {
                        const v = r[name];
                        return (
                            v !== null &&
                            v !== undefined &&
                            v !== '' &&
                            Number.isFinite(Number(v))
                        );
                    });

                let detected: string | null;
                let strictMissing = false;
                if (cfg.valueField !== undefined && cfg.valueField !== '') {
                    if (fieldExists(cfg.valueField)) {
                        detected = cfg.valueField;
                    } else {
                        detected = null;
                        strictMissing = true;
                    }
                } else {
                    detected = autoDetectValueField(rows);
                }

                if (!detected) {
                    debugLog(
                        cfg.id,
                        strictMissing
                            ? 'configured valueField missing from results'
                            : 'no numeric column found',
                        {
                            rowCount: rows.length,
                            firstRowKeys: Object.keys(rows[0] ?? {}),
                            configuredValueField: cfg.valueField,
                        }
                    );
                    setResult(
                        cfg.suppressMockOnEmpty
                            ? buildNoData(
                                  strictMissing ? 'column_missing' : 'no_numeric_column'
                              )
                            : mock
                    );
                    return;
                }
                const valueField: string = detected;
                debugLog(cfg.id, 'rendering', {
                    rowCount: rows.length,
                    valueField,
                    configuredValueField: cfg.valueField,
                });

                // Empty buckets become 0 (timechart convention) so the
                // spark draws a continuous time axis; spikes still show.
                // We deliberately do NOT special-case "all zero" — a
                // real result of 0 (e.g. stats count over a quiet
                // period, or "0 high-severity incidents this week") is
                // legitimate and must render as 0, not as "no data" or
                // mock fallback. The truly-empty case is already
                // covered by `autoDetectValueField` returning null
                // when no row exposes a usable numeric column.
                const rowHasNumericValue = (
                    row: Record<string, unknown>
                ): boolean => {
                    const raw = row[valueField];
                    return (
                        raw !== null &&
                        raw !== undefined &&
                        raw !== '' &&
                        Number.isFinite(Number(raw))
                    );
                };

                const liveSeries = rows.map((r) => rowToNumber(r[valueField]));
                const firstValueRow = rows.find(rowHasNumericValue);
                const latestValueRow = [...rows].reverse().find(rowHasNumericValue);

                if (!latestValueRow || !firstValueRow) {
                    debugLog(cfg.id, 'all metric buckets empty after field detect', {
                        rowCount: rows.length,
                        valueField,
                    });
                    setResult(
                        cfg.suppressMockOnEmpty
                            ? buildNoData('no_numeric_column')
                            : mock
                    );
                    return;
                }

                const changeField = cfg.changeField ?? 'change';
                const latestChangeRow = [...rows].reverse().find((row) => {
                    const raw = row[changeField];
                    return (
                        raw !== null &&
                        raw !== undefined &&
                        raw !== '' &&
                        Number.isFinite(Number(raw))
                    );
                });

                // Single-row searches (typical of "current value"
                // saved searches like ds_network_health_current) give
                // us a real headline but a meaningless 1-point spark.
                // We keep the live headline and substitute mock spark
                // data so the trendline still has visual interest.
                const isSingleRow = liveSeries.length < 2;
                const value = rowToNumber(latestValueRow[valueField]);
                const sparkData = isSingleRow ? buildMockSparkline(cfg) : liveSeries;
                const sparkTimestamps = isSingleRow
                    ? []
                    : rows
                          .map(extractRowTimestamp)
                          .filter((t): t is number => t !== null);
                const explicitChange = Number(latestChangeRow?.[changeField]);
                const baseline = rowToNumber(firstValueRow[valueField]);
                const change = Number.isFinite(explicitChange)
                    ? explicitChange
                    : isSingleRow
                    ? 0
                    : baseline !== 0
                    ? Math.round(((value - baseline) / baseline) * 100)
                    : 0;

                const prevRows = (prevRes?.results ?? []) as Array<Record<string, unknown>>;
                const previousSparkData = isSingleRow
                    ? []
                    : prevRows.map((r) => rowToNumber(r[valueField]));

                setResult({
                    value,
                    change,
                    sparkData,
                    sparkTimestamps:
                        sparkTimestamps.length === sparkData.length ? sparkTimestamps : [],
                    previousSparkData,
                    source: 'live',
                    status: computeStatus(value, cfg.thresholds),
                    spl,
                    resolvedSavedSearch: savedSearchName,
                });
            })
            .catch((err) => {
                if (cancelled) return;
                debugLog(cfg.id, 'dispatch threw', {
                    error: err instanceof Error ? err.message : String(err),
                    spl,
                });
                setResult(cfg.suppressMockOnEmpty ? buildNoData('error') : mock);
            });

        return () => {
            cancelled = true;
        };
        // refreshToken in deps ensures the manual "refresh now" button
        // and the auto-refresh interval re-trigger every metric.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cfg, range.earliest, range.latest, refreshToken]);

    return result;
};

// ---------------------------------------------------------------------------
// useKpi — single-row "what is the latest <thing>" tile
// ---------------------------------------------------------------------------

export interface KpiConfig {
    id: string;
    label: string;
    /** Search binding name; can resolve through searchbase or savedsearches. */
    savedSearch?: string;
    /** Inline SPL — preferred over savedSearch when no stanza fits. */
    spl?: string;
    /** Field whose value is displayed. Defaults to 'value'. */
    valueField?: string;
    /** Mock fallback when no search wired. */
    mockValue: string;
    /**
     * Same semantics as {@link MetricConfig.suppressMockOnEmpty}: when
     * true, an empty/erroring search renders "—" instead of the
     * configured mock — used by override-bound KPI tiles so a swap
     * never re-displays the original tile's mock string.
     */
    suppressMockOnEmpty?: boolean;
}

export interface KpiResult {
    value: string;
    source: DataSource;
    spl: string;
    resolvedSavedSearch: string;
    noDataReason?: NoDataReason;
    rangeLabel?: string;
}

export const useKpi = (
    cfg: KpiConfig,
    range: TimeRange,
    refreshToken: number
): KpiResult => {
    const spl = resolveMetricSpl(cfg);
    const savedSearchName = cfg.savedSearch ?? '';
    // Value field may be unset when the picker binds a fresh
    // searchbase entry — defer to row inspection at result time.
    const explicitValueField = cfg.valueField;
    const initialMock: KpiResult = {
        value: cfg.mockValue,
        source: 'mock',
        spl,
        resolvedSavedSearch: savedSearchName,
    };
    const [result, setResult] = useState<KpiResult>(initialMock);

    useEffect(() => {
        const mock: KpiResult = {
            value: cfg.mockValue,
            source: 'mock',
            spl,
            resolvedSavedSearch: savedSearchName,
        };
        if (!spl) {
            setResult(mock);
            return undefined;
        }
        let cancelled = false;
        setResult({ ...mock, source: 'loading' });
        const buildKpiNoData = (reason: NoDataReason): KpiResult => ({
            value: '—',
            source: 'live',
            spl,
            resolvedSavedSearch: savedSearchName,
            noDataReason: reason,
            rangeLabel: range.label,
        });
        debugLog(cfg.id, 'kpi dispatching', {
            spl,
            earliest: range.earliest,
            latest: range.latest,
            label: range.label,
            valueField: explicitValueField,
            suppressMockOnEmpty: Boolean(cfg.suppressMockOnEmpty),
        });
        runSearch({
            spl,
            earliestTime: range.earliest,
            latestTime: range.latest,
            tag: cfg.id,
        })
            .then((res) => {
                if (cancelled) return;
                const rows = (res?.results ?? []) as Array<Record<string, unknown>>;
                if (rows.length === 0) {
                    debugLog(cfg.id, 'kpi no rows', { rangeLabel: range.label });
                    setResult(
                        cfg.suppressMockOnEmpty
                            ? buildKpiNoData('empty_rows')
                            : mock
                    );
                    return;
                }
                // Multi-row scan: see useMetric for rationale (Splunk
                // omits empty-bucket columns from JSON, breaking
                // single-row sniffing on sparse timecharts). Same
                // strict-vs-auto rule as useMetric: an explicit
                // valueField is honored — if no row exposes it we
                // surface 'column_missing' rather than silently
                // substituting another column.
                const fieldExists = (name: string): boolean =>
                    rows.some((r) => {
                        const v = r[name];
                        return v !== null && v !== undefined && v !== '';
                    });

                let detected: string | null;
                let strictMissing = false;
                if (explicitValueField !== undefined && explicitValueField !== '') {
                    if (fieldExists(explicitValueField)) {
                        detected = explicitValueField;
                    } else {
                        detected = null;
                        strictMissing = true;
                    }
                } else {
                    detected = autoDetectValueField(rows);
                }

                if (!detected) {
                    debugLog(
                        cfg.id,
                        strictMissing
                            ? 'kpi configured valueField missing from results'
                            : 'kpi no numeric column',
                        {
                            rowCount: rows.length,
                            firstRowKeys: Object.keys(rows[0] ?? {}),
                            configuredValueField: explicitValueField,
                        }
                    );
                    setResult(
                        cfg.suppressMockOnEmpty
                            ? buildKpiNoData(
                                  strictMissing ? 'column_missing' : 'no_numeric_column'
                              )
                            : mock
                    );
                    return;
                }
                const valueField: string = detected;
                // Pick the last row that actually has a value, walking
                // backwards through trailing empty buckets. This makes
                // the headline reflect the most recent real reading
                // rather than 0 from a final empty bucket.
                let raw: unknown = undefined;
                for (let i = rows.length - 1; i >= 0; i -= 1) {
                    const candidate = rows[i][valueField];
                    if (
                        candidate !== undefined &&
                        candidate !== null &&
                        candidate !== ''
                    ) {
                        raw = candidate;
                        break;
                    }
                }
                if (raw === undefined) {
                    debugLog(cfg.id, 'kpi all empty buckets', {
                        rowCount: rows.length,
                        valueField,
                    });
                    setResult(
                        cfg.suppressMockOnEmpty
                            ? buildKpiNoData('no_numeric_column')
                            : mock
                    );
                    return;
                }
                debugLog(cfg.id, 'kpi rendering', {
                    rowCount: rows.length,
                    valueField,
                    raw,
                });
                setResult({
                    value: String(raw),
                    source: 'live',
                    spl,
                    resolvedSavedSearch: savedSearchName,
                });
            })
            .catch((err) => {
                if (cancelled) return;
                debugLog(cfg.id, 'kpi dispatch threw', {
                    error: err instanceof Error ? err.message : String(err),
                    spl,
                });
                setResult(cfg.suppressMockOnEmpty ? buildKpiNoData('error') : mock);
            });
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cfg, range.earliest, range.latest, refreshToken]);

    return result;
};
