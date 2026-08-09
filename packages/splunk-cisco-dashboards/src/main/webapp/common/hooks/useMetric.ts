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
import {
    classifySearchDispatchError,
    isAbortError,
    runSearch,
} from '../services/splunkSearchService';
import type { SectionId } from '@/common/config/insightsWorkspaces';

export type { SectionId };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

/**
 * Single row in the THRESHOLDS section of the per-tile info popover.
 * Authored by `deriveThresholdLines` from the same `MetricThresholds`
 * the runtime uses to colour the headline, so the popover is
 * guaranteed to match the colour the user sees on the tile — there's
 * no second source of truth that could drift.
 */
export interface ThresholdLine {
    tone: MetricStatus;
    /** Short status label, e.g. "Healthy", "Warning", "Critical". */
    label: string;
    /** Numeric range, e.g. "≥ 95%", "80% – < 95%", "< 80%". */
    value: string;
}

/**
 * Format a threshold number for display. Adds locale grouping for
 * integers (so 25,000 doesn't read as 25000) and trims a single
 * decimal otherwise. The optional `unit` is appended verbatim.
 */
export const formatThresholdNumber = (n: number, unit?: string): string => {
    if (!Number.isFinite(n)) return '';
    const body = Number.isInteger(n) ? n.toLocaleString() : n.toFixed(1);
    return unit ? `${body}${unit}` : body;
};

/**
 * Derive the human-readable threshold rows from a `MetricThresholds`
 * config. Returns `undefined` when the metric has no numeric
 * thresholds (the caller should fall back to a qualitative
 * `thresholdNote` instead).
 *
 * The sentence ranges mirror `computeStatus` exactly:
 *
 *   higher_is_better: value < critical → critical
 *                     critical ≤ value < warning → warning
 *                     value ≥ warning → healthy
 *   lower_is_better:  value > critical → critical
 *                     warning < value ≤ critical → warning
 *                     value ≤ warning → healthy
 *
 * If only one of `warning` / `critical` is set the function emits a
 * 2-row variant rather than fabricating a fictional middle band.
 */
export const deriveThresholdLines = (
    thresholds?: MetricThresholds,
    unit?: string
): ThresholdLine[] | undefined => {
    if (!thresholds) return undefined;
    const { warning, critical, direction } = thresholds;
    if (warning === undefined && critical === undefined) return undefined;
    const fmt = (n: number) => formatThresholdNumber(n, unit);
    const lines: ThresholdLine[] = [];
    if (direction === 'higher_is_better') {
        if (warning !== undefined) {
            lines.push({ tone: 'healthy', label: 'Healthy', value: `≥ ${fmt(warning)}` });
            if (critical !== undefined) {
                lines.push({
                    tone: 'warning',
                    label: 'Warning',
                    value: `${fmt(critical)} – < ${fmt(warning)}`,
                });
                lines.push({ tone: 'critical', label: 'Critical', value: `< ${fmt(critical)}` });
            } else {
                lines.push({ tone: 'warning', label: 'Warning', value: `< ${fmt(warning)}` });
            }
        } else if (critical !== undefined) {
            lines.push({ tone: 'healthy', label: 'Healthy', value: `≥ ${fmt(critical)}` });
            lines.push({ tone: 'critical', label: 'Critical', value: `< ${fmt(critical)}` });
        }
        return lines;
    }
    // lower_is_better
    if (warning !== undefined) {
        lines.push({ tone: 'healthy', label: 'Healthy', value: `≤ ${fmt(warning)}` });
        if (critical !== undefined) {
            lines.push({
                tone: 'warning',
                label: 'Warning',
                value: `> ${fmt(warning)} – ${fmt(critical)}`,
            });
            lines.push({ tone: 'critical', label: 'Critical', value: `> ${fmt(critical)}` });
        } else {
            lines.push({ tone: 'warning', label: 'Warning', value: `> ${fmt(warning)}` });
        }
    } else if (critical !== undefined) {
        lines.push({ tone: 'healthy', label: 'Healthy', value: `≤ ${fmt(critical)}` });
        lines.push({ tone: 'critical', label: 'Critical', value: `> ${fmt(critical)}` });
    }
    return lines;
};

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
     * Optional searchbase.conf stanza id. Overview factory tiles use this as the
     * stable binding when the tile definition is authored in searchbase metadata.
     */
    searchbaseId?: string;
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
    /** Splunk app namespace to dispatch this search in. */
    dispatchContext?: string;
    /** Field name in the search results to read the headline + sparkline from. */
    valueField?: string;
    /**
     * Optional explicit delta column.
     *
     * Historically the column was assumed to carry a signed *percent*
     * change between the first and last bucket; if missing, the hook
     * auto-computes that percent. As of Build 1224 the column may
     * also carry an *absolute* signed delta — interpretation now
     * happens at the renderer layer (e.g. `SingleValueRadialTile`'s
     * `viz_options.deltaFormat`), so the hook no longer rescales the
     * column it reads. Authors that want the radial's DS-style `↑4`
     * absolute delta should emit a raw signed integer here and set
     * `viz_options.deltaFormat = "absolute"` (the default).
     *
     * Wired from `viz_options.deltaField` on the Searchbase Canvas
     * (see `searchbase_canvas/index.tsx`).
     */
    changeField?: string;
    /**
     * When set, the headline string is pulled from this column instead
     * of the numeric `valueField`. Status / threshold / change still
     * use `valueField`. Lets a single search drive a "12 of 18 available"
     * style headline (string broadcast via `eventstats latest` onto every
     * row of a timechart) while keeping numeric thresholding intact.
     */
    displayField?: string;
    /**
     * When set, the sparkline series is pulled from this column instead
     * of `valueField`. Used by tiles whose `valueField` is a broadcast
     * window-total (so reading it per row would produce a flat line) —
     * the per-bucket trend lives in a separate column.
     */
    sparkDataField?: string;
    /**
     * When set, the dashed comparison overlay reads this column from
     * the same rows as the primary series. Use this for a baseline
     * (rolling-average) overlay computed inline via `eventstats avg`
     * — no second dispatch needed, no shifted-time-range guesswork.
     * Mutually exclusive with `comparePeriod`: if both are set, this
     * field wins and the previous-period dispatch is skipped.
     */
    baselineField?: string;
    /**
     * Tooltip label for the dashed comparison overlay. Defaults to
     * `'Prev'` for {@link comparePeriod}; baseline tiles should set
     * this to `'Avg'` so the hover popover reads naturally.
     */
    overlayLabel?: string;
    /**
     * When true the hook also dispatches a second search shifted back
     * by `range.spanSeconds` to populate the dashed previous-period
     * line on the sparkline. Only meaningful for time-series searches
     * (multiple rows). Defaults to false. Ignored when
     * {@link baselineField} is set.
     */
    comparePeriod?: boolean;
    unit?: string;
    color?: string;
    thresholds?: MetricThresholds;
    /**
     * Optional supplemental sentence shown beneath the auto-derived
     * threshold rows in the per-tile info popover. Use it to:
     *
     *   1. Explain a unit mismatch — e.g. the headline shows "X of Y
     *      sites" but the numeric threshold is on a percentage; the
     *      auto-derived row says "≥ 99.5%" and the note clarifies
     *      that's "per-site availability, not total count".
     *   2. Explain a qualitative threshold for tiles that don't have
     *      a fixed numeric cutoff (e.g. "Active devices" — watch the
     *      day-over-day trend, not a hardcoded number).
     *   3. Cite the source of the threshold (Catalyst Center default,
     *      Cisco hardening guide, customer SLA, etc.).
     *
     * When the metric has no `thresholds` field at all, this note is
     * the only thing rendered in the THRESHOLDS section, so for those
     * tiles always set it — every Cisco-tagged tile should answer
     * "what counts as good?" for the operator.
     */
    thresholdNote?: string;
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
 *   • 'dispatch_failed'    — Splunk refused to create the job (HTTP
 *                            503/429, network/abort after retries).
 *   • 'job_failed'         — Job was created but Splunk reported an
 *                            ERROR/FATAL message (missing macro, etc.).
 *   • 'error'              — other dispatch failure (legacy bucket).
 */
export type NoDataReason =
    | 'empty_rows'
    | 'no_numeric_column'
    | 'column_missing'
    | 'dispatch_failed'
    | 'job_failed'
    | 'error';

export interface SearchFailureDetail {
    message: string;
    httpStatus?: number;
}

export interface MetricResult {
    value: number;
    /**
     * Optional string override for the headline. Populated when the
     * source search emits a `displayField` column (e.g. "12 of 18
     * available" broadcast onto every row). When undefined, callers
     * fall back to formatting `value` themselves. Status / threshold
     * still derive from the numeric `value`.
     */
    displayValue?: string;
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
    /**
     * Numeric result columns available for a canvas user-selected
     * overlay. Excludes Splunk internal columns and the resolved
     * primary value/spark/delta columns.
     */
    availableOverlayFields: string[];
    source: DataSource;
    status: MetricStatus;
    /** SPL that was (or would be) executed. Used by the click-to-search drilldown. */
    spl: string;
    /** Resolved saved-search name (convention or override). */
    resolvedSavedSearch: string;
    /** Set only when `Number.isNaN(value)` — see {@link NoDataReason}. */
    noDataReason?: NoDataReason;
    /** Human-readable Splunk/dispatch error when {@link noDataReason} is not empty_rows. */
    failureMessage?: string;
    failureHttpStatus?: number;
    /**
     * Echo of the time range we ran against. The UI uses this to show
     * "no data in last 7 days" rather than "no data" alone, so it's
     * obvious whether the swap actually dispatched.
     */
    rangeLabel?: string;
}

export interface MetricResultCacheOptions {
    cacheKey: string;
    cachedResult?: MetricResult;
    onResultChange?: (cacheKey: string, result: MetricResult) => void;
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
        availableOverlayFields: [],
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
const isUsableNumericValue = (raw: unknown): boolean =>
    raw !== null &&
    raw !== undefined &&
    raw !== '' &&
    Number.isFinite(Number(raw));

const isInternalResultField = (field: string): boolean =>
    field.startsWith('_') || field === 'time' || field === 'span';

const detectNumericFields = (
    rows: ReadonlyArray<Record<string, unknown>>
): string[] => {
    const seen = new Set<string>();
    const fields: string[] = [];
    for (const row of rows) {
        for (const [field, raw] of Object.entries(row)) {
            if (isInternalResultField(field) || seen.has(field)) continue;
            if (!isUsableNumericValue(raw)) continue;
            seen.add(field);
            fields.push(field);
        }
    }
    return fields;
};

const autoDetectValueField = (
    rows: ReadonlyArray<Record<string, unknown>>
): string | null => {
    if (rows.length === 0) return null;

    for (const name of PREFERRED_VALUE_FIELDS) {
        for (const r of rows) {
            if (isUsableNumericValue(r[name])) return name;
        }
    }
    // Splunk uses leading underscore for system fields (_time, _span,
    // _raw, etc.) which we never want to surface as a headline value.
    for (const r of rows) {
        for (const [key, val] of Object.entries(r)) {
            if (isInternalResultField(key)) continue;
            if (isUsableNumericValue(val)) return key;
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

const canvasDebug = (...args: unknown[]): void => {
    if (!isCanvasDebug()) return;
    // eslint-disable-next-line no-console
    console.debug(...args);
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
    refreshToken: number,
    cacheOptions?: MetricResultCacheOptions
): MetricResult => {
    const spl = resolveMetricSpl(cfg);
    const savedSearchName = cfg.savedSearch ?? '';
    const initialMock = buildMock(cfg, spl, savedSearchName);
    const [result, setResult] = useState<MetricResult>(
        () => cacheOptions?.cachedResult ?? initialMock
    );

    useEffect(() => {
        const mock = buildMock(cfg, spl, savedSearchName);
        if (cacheOptions?.cachedResult) {
            setResult(cacheOptions.cachedResult);
            return undefined;
        }
        // Empty SPL → no real search wired. Stay mock; never hit the
        // network. This is the primary defence against console-spam
        // 400s when a metric has no binding yet.
        if (!spl) {
            setResult(mock);
            return undefined;
        }
        const controller = new AbortController();
        let cancelled = false;
        canvasDebug('[canvas/tile-dispatch] effect-run', {
            stanzaId: cfg.id,
            refreshToken,
        });
        setResult((prev) => {
            canvasDebug('[canvas/tile-state] transition', {
                stanzaId: cfg.id,
                from: prev.source,
                to: 'loading',
            });
            return { ...mock, source: 'loading' };
        });

        const livePromise = runSearch({
            spl,
            earliestTime: range.earliest,
            latestTime: range.latest,
            tag: cfg.id,
            appContext: cfg.dispatchContext,
            signal: controller.signal,
        });

        const previousRange = computePreviousRange(range);
        // `baselineField` reads the overlay from the live-search rows
        // (a column emitted by `eventstats avg` in the searchbase SPL),
        // so we never need a second time-shifted dispatch when it's
        // set. This is the cheaper + more correct path for tiles that
        // want a "vs. rolling average" overlay rather than a strict
        // "vs. previous period" overlay.
        const previousPromise =
            !cfg.baselineField && cfg.comparePeriod
                ? runSearch({
                      spl,
                      earliestTime: previousRange.earliest,
                      latestTime: previousRange.latest,
                      tag: `${cfg.id}__prev`,
                      appContext: cfg.dispatchContext,
                      signal: controller.signal,
                  }).catch((err) =>
                      isAbortError(err)
                          ? Promise.reject(err)
                          : { results: [] as Array<Record<string, unknown>> }
                  )
                : Promise.resolve({ results: [] as Array<Record<string, unknown>> });

        const buildNoData = (
            reason: NoDataReason,
            failure?: SearchFailureDetail
        ): MetricResult => ({
            value: Number.NaN,
            change: Number.NaN,
            sparkData: [],
            sparkTimestamps: [],
            previousSparkData: [],
            availableOverlayFields: [],
            source: 'live',
            status: 'unknown',
            spl,
            resolvedSavedSearch: savedSearchName,
            noDataReason: reason,
            failureMessage: failure?.message,
            failureHttpStatus: failure?.httpStatus,
            rangeLabel: range.label,
        });

        const setFinalResult = (next: MetricResult) => {
            setResult(next);
            if (cacheOptions?.cacheKey) {
                cacheOptions.onResultChange?.(cacheOptions.cacheKey, next);
            }
        };

        debugLog(cfg.id, 'dispatching', {
            spl,
            dispatchContext: cfg.dispatchContext,
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
                    setFinalResult(
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
                        return isUsableNumericValue(v);
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
                    setFinalResult(
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
                    setFinalResult(
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
                // `sparkDataField` lets a tile keep `valueField` pointed
                // at a broadcast window-total (so the headline number is
                // stable) while sourcing the per-bucket sparkline from a
                // separate column - typical pattern for "current value
                // big number + per-hour trend" tiles. Falls back to
                // `valueField` for the existing tile contract.
                const sparkField = cfg.sparkDataField ?? valueField;
                const sparkSeries = rows.map((r) => rowToNumber(r[sparkField]));
                const sparkData = isSingleRow ? buildMockSparkline(cfg) : sparkSeries;
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

                // Comparison overlay. Two mutually-exclusive sources:
                //   1. `baselineField` - read from the live-search rows
                //      (e.g. `baseline_pct` broadcast via `eventstats avg`).
                //   2. `comparePeriod` - read from the previous-period
                //      dispatch result, indexed by the same `valueField`.
                // The Sparkline component already resamples to data.length
                // so a flat broadcast baseline renders as a clean dashed
                // line through the avg.
                const prevRows = (prevRes?.results ?? []) as Array<Record<string, unknown>>;
                const baselineField =
                    cfg.baselineField && fieldExists(cfg.baselineField)
                        ? cfg.baselineField
                        : undefined;
                const previousSparkData = baselineField
                    ? rows.map((r) => rowToNumber(r[baselineField]))
                    : isSingleRow
                    ? []
                    : prevRows.map((r) => rowToNumber(r[valueField]));
                const availableOverlayFields = detectNumericFields(rows).filter(
                    (field) =>
                        field !== valueField &&
                        field !== sparkField &&
                        field !== changeField
                );

                // Optional string headline override. Read from the
                // latest row only - a `displayField` is always
                // broadcast-constant (via `eventstats latest`) so any
                // row would do, but the latest row matches the
                // `value` source.
                let displayValue: string | undefined;
                if (cfg.displayField) {
                    const raw = latestValueRow[cfg.displayField];
                    if (typeof raw === 'string' && raw.trim().length > 0) {
                        displayValue = raw.trim();
                    } else if (raw !== null && raw !== undefined) {
                        displayValue = String(raw);
                    }
                }

                canvasDebug('[canvas/tile-state] transition', {
                    stanzaId: cfg.id,
                    from: 'loading',
                    to: 'live',
                    rowCount: rows.length,
                });
                setFinalResult({
                    value,
                    displayValue,
                    change,
                    sparkData,
                    sparkTimestamps:
                        sparkTimestamps.length === sparkData.length ? sparkTimestamps : [],
                    previousSparkData,
                    availableOverlayFields,
                    source: 'live',
                    status: computeStatus(value, cfg.thresholds),
                    spl,
                    resolvedSavedSearch: savedSearchName,
                });
            })
            .catch((err) => {
                if (cancelled || isAbortError(err)) return;
                const failure = classifySearchDispatchError(err);
                console.error(
                    `[useMetric] dispatch failed stanzaId=${cfg.id} ` +
                        `httpStatus=${failure.httpStatus ?? 'none'} reason=${failure.reason} ` +
                        `message=${failure.message}`,
                );
                debugLog(cfg.id, 'dispatch threw', {
                    error: failure.message,
                    httpStatus: failure.httpStatus,
                    reason: failure.reason,
                    spl,
                });
                canvasDebug('[canvas/tile-state] transition', {
                    stanzaId: cfg.id,
                    from: 'loading',
                    to: cfg.suppressMockOnEmpty ? 'live-no-data' : 'mock',
                    reason: failure.reason,
                });
                setFinalResult(
                    cfg.suppressMockOnEmpty
                        ? buildNoData(failure.reason, failure)
                        : mock
                );
            });

        return () => {
            cancelled = true;
            canvasDebug('[canvas/tile-dispatch] effect-cleanup', {
                stanzaId: cfg.id,
                aborted: controller.signal.aborted,
            });
            controller.abort();
            setResult(mock);
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
    /**
     * Optional searchbase.conf stanza id. Map footer KPIs use this as
     * the stable binding when the default card is authored in
     * searchbase metadata.
     */
    searchbaseId?: string;
    /** Search binding name; can resolve through searchbase or savedsearches. */
    savedSearch?: string;
    /** Inline SPL — preferred over savedSearch when no stanza fits. */
    spl?: string;
    /** Splunk app namespace to dispatch this search in. */
    dispatchContext?: string;
    /** Field whose value is displayed. Defaults to 'value'. */
    valueField?: string;
    /** Optional suffix appended to numeric KPI values, e.g. '%' or 'ms'. */
    unit?: string;
    /** Mock fallback when no search wired. */
    mockValue: string;
    /**
     * Body text for the info tooltip ("?" icon) on the KPI card. Kept
     * optional so tiles without a description simply omit the icon.
     */
    description?: string;
    /**
     * Qualitative "what counts as good?" sentence rendered in the
     * THRESHOLDS section of the info popover. KPI cards are string-
     * valued (site labels, etc.) and have no numeric threshold, so
     * they describe the *operational reading* instead.
     */
    thresholdNote?: string;
    /**
     * Same semantics as {@link MetricConfig.suppressMockOnEmpty}: when
     * true, an empty/erroring search renders "—" instead of the
     * configured mock — used by override-bound KPI tiles so a swap
     * never re-displays the original tile's mock string.
     */
    suppressMockOnEmpty?: boolean;
}

const formatKpiValue = (raw: unknown, unit?: string): string => {
    const text = String(raw).trim();
    if (!unit || !text || text.includes(unit)) return text;
    // Only append units to plain numeric outputs. String headlines like
    // "3 of 4 available" should render exactly as emitted by SPL.
    if (/^-?\d[\d,]*(?:\.\d+)?$/.test(text)) {
        return `${text}${unit}`;
    }
    return text;
};

export interface KpiResult {
    value: string;
    source: DataSource;
    spl: string;
    resolvedSavedSearch: string;
    noDataReason?: NoDataReason;
    failureMessage?: string;
    failureHttpStatus?: number;
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
        const controller = new AbortController();
        let cancelled = false;
        canvasDebug('[canvas/tile-dispatch] effect-run', {
            stanzaId: cfg.id,
            hook: 'useKpi',
            refreshToken,
        });
        setResult({ ...mock, source: 'loading' });
        const buildKpiNoData = (
            reason: NoDataReason,
            failure?: SearchFailureDetail
        ): KpiResult => ({
            value: '—',
            source: 'live',
            spl,
            resolvedSavedSearch: savedSearchName,
            noDataReason: reason,
            failureMessage: failure?.message,
            failureHttpStatus: failure?.httpStatus,
            rangeLabel: range.label,
        });
        debugLog(cfg.id, 'kpi dispatching', {
            spl,
            dispatchContext: cfg.dispatchContext,
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
            appContext: cfg.dispatchContext,
            signal: controller.signal,
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
                    value: formatKpiValue(raw, cfg.unit),
                    source: 'live',
                    spl,
                    resolvedSavedSearch: savedSearchName,
                });
            })
            .catch((err) => {
                if (cancelled || isAbortError(err)) return;
                debugLog(cfg.id, 'kpi dispatch threw', {
                    error: err instanceof Error ? err.message : String(err),
                    spl,
                });
                const failure = classifySearchDispatchError(err);
                console.error('[useKpi] dispatch failed', {
                    stanzaId: cfg.id,
                    httpStatus: failure.httpStatus,
                    reason: failure.reason,
                    message: failure.message,
                });
                setResult(
                    cfg.suppressMockOnEmpty
                        ? buildKpiNoData(failure.reason, failure)
                        : mock
                );
            });
        return () => {
            cancelled = true;
            canvasDebug('[canvas/tile-dispatch] effect-cleanup', {
                stanzaId: cfg.id,
                hook: 'useKpi',
                aborted: controller.signal.aborted,
            });
            controller.abort();
            setResult(initialMock);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cfg, range.earliest, range.latest, refreshToken]);

    return result;
};

// ---------------------------------------------------------------------------
// useTableData — categorical / row-shaped tile (default_viz = splunk.table)
// ---------------------------------------------------------------------------
//
// MetricItem expects a single number + a sparkline. A `stats count by name`
// distribution doesn't fit that contract — the `count` column has N category
// rows, not N time buckets, and useMetric's auto-detect ends up plotting
// row-order as if it were a time axis (this is the "92 with min=70 / max=99
// bubble pretending to be a sparkline" you see when a table-shaped search
// is wired into a metric tile). useTableData skips all that: it dispatches
// the same SPL useMetric would, then exposes the raw rows + a derived
// column order so TableTile can render an honest categorical table.

export interface TableDataConfig {
    id: string;
    savedSearch?: string;
    spl?: string;
    /** Splunk app namespace to dispatch this search in. */
    dispatchContext?: string;
    /**
     * Maximum rows materialised into the tile. oneShot can return up
     * to 1,000 rows; the executive table tile should cap well before
     * that to keep DOM weight reasonable. Defaults to 50.
     */
    rowLimit?: number;
    /**
     * Mirrors {@link MetricConfig.suppressMockOnEmpty} so the same
     * MetricConfig can be threaded through both hooks. Tables don't
     * have a mock fallback, so this is currently informational only —
     * a zero-row result always renders the no-data state.
     */
    suppressMockOnEmpty?: boolean;
}

export interface TableDataResult {
    rows: Array<Record<string, unknown>>;
    /** Visible (non-internal) field names in SPL emission order. */
    columns: string[];
    /**
     * Row count BEFORE the {@link TableDataConfig.rowLimit} cap. Lets
     * the tile show an honest "5 of 23 rows" caption — without this
     * the cap collapses both numbers to the same value and the user
     * can't tell whether the search returned more than the tile shows.
     */
    totalRowCount: number;
    source: DataSource;
    spl: string;
    resolvedSavedSearch: string;
    noDataReason?: NoDataReason;
    failureMessage?: string;
    failureHttpStatus?: number;
    rangeLabel?: string;
}

export interface TableDataResultCacheOptions {
    cacheKey: string;
    cachedResult?: TableDataResult;
    onResultChange?: (cacheKey: string, result: TableDataResult) => void;
}

const DEFAULT_TABLE_ROW_LIMIT = 50;

/**
 * Predicate used by the Overview wrapper to decide whether to render
 * a metric tile (sparkline) or a table tile. Centralised so both the
 * sparkline mapper and this hook agree on what counts as "table".
 */
export const isTableViz = (splunkViz: string | undefined): boolean => {
    if (typeof splunkViz !== 'string') return false;
    return splunkViz.trim().toLowerCase() === 'splunk.table';
};

/**
 * Predicate that selects the BarBreakdownTile renderer instead of
 * the default sparkline tile. Triggered when the searchbase stanza
 * declares `default_viz = splunk.bar` — i.e. the search emits a
 * categorical (non-temporal) `<dimension>, <count>` shape and
 * should render as a horizontal bar list inside the same tile slot.
 *
 * Distinct from `isTableViz`: tables paint a generic multi-column
 * grid, bars paint a single-series proportional visualisation with
 * a sum headline. Both reuse `useTableData` for dispatch since the
 * row shape is the same.
 */
export const isBarBreakdownViz = (splunkViz: string | undefined): boolean => {
    if (typeof splunkViz !== 'string') return false;
    return splunkViz.trim().toLowerCase() === 'splunk.bar';
};

export const useTableData = (
    cfg: TableDataConfig,
    range: TimeRange,
    refreshToken: number,
    cacheOptions?: TableDataResultCacheOptions
): TableDataResult => {
    const spl = resolveMetricSpl(cfg);
    const savedSearchName = cfg.savedSearch ?? '';
    const rowLimit = Math.max(
        1,
        Math.min(cfg.rowLimit ?? DEFAULT_TABLE_ROW_LIMIT, 1000)
    );

    const [result, setResult] = useState<TableDataResult>(
        () =>
            cacheOptions?.cachedResult ?? {
                rows: [],
                columns: [],
                totalRowCount: 0,
                source: 'mock',
                spl,
                resolvedSavedSearch: savedSearchName,
            }
    );

    useEffect(() => {
        const fresh: TableDataResult = {
            rows: [],
            columns: [],
            totalRowCount: 0,
            source: 'mock',
            spl,
            resolvedSavedSearch: savedSearchName,
        };
        if (cacheOptions?.cachedResult) {
            setResult(cacheOptions.cachedResult);
            return undefined;
        }
        if (!spl) {
            setResult(fresh);
            return undefined;
        }
        const controller = new AbortController();
        let cancelled = false;
        canvasDebug('[canvas/tile-dispatch] effect-run', {
            stanzaId: cfg.id,
            hook: 'useTableData',
            refreshToken,
        });
        setResult({ ...fresh, source: 'loading' });

        const buildNoData = (
            reason: NoDataReason,
            failure?: SearchFailureDetail
        ): TableDataResult => ({
            rows: [],
            columns: [],
            totalRowCount: 0,
            source: 'live',
            spl,
            resolvedSavedSearch: savedSearchName,
            noDataReason: reason,
            failureMessage: failure?.message,
            failureHttpStatus: failure?.httpStatus,
            rangeLabel: range.label,
        });

        const setFinalResult = (next: TableDataResult) => {
            setResult(next);
            if (cacheOptions?.cacheKey) {
                cacheOptions.onResultChange?.(cacheOptions.cacheKey, next);
            }
        };

        debugLog(cfg.id, 'table dispatching', {
            spl,
            dispatchContext: cfg.dispatchContext,
            earliest: range.earliest,
            latest: range.latest,
            label: range.label,
            rowLimit,
        });

        runSearch({
            spl,
            earliestTime: range.earliest,
            latestTime: range.latest,
            tag: cfg.id,
            appContext: cfg.dispatchContext,
            signal: controller.signal,
        })
            .then((res) => {
                if (cancelled) return;
                const allRows = (res?.results ?? []) as Array<
                    Record<string, unknown>
                >;
                if (allRows.length === 0) {
                    debugLog(cfg.id, 'table no rows', { rangeLabel: range.label });
                    setFinalResult(buildNoData('empty_rows'));
                    return;
                }
                // Walk every row's keys to build a stable, SPL-order
                // column list. We can't trust `Object.keys(rows[0])`
                // alone because `| timechart` (and other commands)
                // omit a column from rows whose bucket had nothing —
                // a sparse first row would silently drop columns the
                // user actually cares about.
                const seenKeys = new Set<string>();
                const columns: string[] = [];
                for (const row of allRows) {
                    for (const key of Object.keys(row)) {
                        // Splunk's leading-underscore fields (_time,
                        // _span, _raw, _bkt, …) are noise in a
                        // categorical tile — skip them by convention.
                        if (key.startsWith('_')) continue;
                        if (seenKeys.has(key)) continue;
                        seenKeys.add(key);
                        columns.push(key);
                    }
                }
                if (columns.length === 0) {
                    debugLog(cfg.id, 'table rows had only internal fields', {
                        rowCount: allRows.length,
                        firstRowKeys: Object.keys(allRows[0] ?? {}),
                    });
                    setFinalResult(buildNoData('no_numeric_column'));
                    return;
                }
                debugLog(cfg.id, 'table rendering', {
                    rowCount: allRows.length,
                    columnCount: columns.length,
                    columns,
                });
                setFinalResult({
                    rows: allRows.slice(0, rowLimit),
                    columns,
                    totalRowCount: allRows.length,
                    source: 'live',
                    spl,
                    resolvedSavedSearch: savedSearchName,
                    rangeLabel: range.label,
                });
            })
            .catch((err) => {
                if (cancelled || isAbortError(err)) return;
                const failure = classifySearchDispatchError(err);
                console.error('[useTableData] dispatch failed', {
                    stanzaId: cfg.id,
                    httpStatus: failure.httpStatus,
                    reason: failure.reason,
                    message: failure.message,
                });
                debugLog(cfg.id, 'table dispatch threw', {
                    error: failure.message,
                    httpStatus: failure.httpStatus,
                    reason: failure.reason,
                    spl,
                });
                setFinalResult(buildNoData(failure.reason, failure));
            });

        return () => {
            cancelled = true;
            canvasDebug('[canvas/tile-dispatch] effect-cleanup', {
                stanzaId: cfg.id,
                hook: 'useTableData',
                aborted: controller.signal.aborted,
            });
            controller.abort();
            setResult(fresh);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cfg, range.earliest, range.latest, refreshToken]);

    return result;
};
