/**
 * useMetric — single source of truth for an executive metric.
 *
 * Resolves a {@link MetricConfig} to a {@link MetricResult} by:
 *   1. Trying a Splunk saved search (named per the configured override
 *      or per the convention `Overview - ds_<id>`).
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
     * Splunk saved-search stanza to drive this metric. The hook will
     * dispatch `| savedsearch "<savedSearch>"` honouring the page-level
     * time range. Mutually exclusive with {@link MetricConfig.spl}.
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

        Promise.all([livePromise, previousPromise])
            .then(([liveRes, prevRes]) => {
                if (cancelled) return;
                const rows = (liveRes?.results ?? []) as Array<Record<string, unknown>>;
                if (rows.length === 0) {
                    setResult(mock);
                    return;
                }
                const valueField = cfg.valueField ?? 'value';
                const changeField = cfg.changeField ?? 'change';
                const liveSeries = rows
                    .map((r) => Number(r[valueField]))
                    .filter((n) => Number.isFinite(n));
                if (liveSeries.length === 0) {
                    setResult(mock);
                    return;
                }

                // Single-row searches (typical of "current value"
                // saved searches like ds_network_health_current) give
                // us a real headline but a meaningless 1-point spark.
                // We keep the live headline and substitute mock spark
                // data so the trendline still has visual interest.
                const isSingleRow = liveSeries.length < 2;
                const value = liveSeries[liveSeries.length - 1];
                const sparkData = isSingleRow ? buildMockSparkline(cfg) : liveSeries;
                // Real timestamps from time-series searches; empty
                // otherwise so the Sparkline can synthesise from the
                // page's dispatched range.
                const sparkTimestamps = isSingleRow
                    ? []
                    : rows
                          .map(extractRowTimestamp)
                          .filter((t): t is number => t !== null);
                const lastRow = rows[rows.length - 1];
                const explicitChange = Number(lastRow[changeField]);
                const change = Number.isFinite(explicitChange)
                    ? explicitChange
                    : isSingleRow
                    ? 0
                    : liveSeries[0] !== 0
                    ? Math.round(((value - liveSeries[0]) / liveSeries[0]) * 100)
                    : 0;

                const prevRows = (prevRes?.results ?? []) as Array<Record<string, unknown>>;
                const previousSparkData = isSingleRow
                    ? []
                    : prevRows
                          .map((r) => Number(r[valueField]))
                          .filter((n) => Number.isFinite(n));

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
            .catch(() => {
                if (!cancelled) setResult(mock);
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
    /** Saved-search stanza driving the value. */
    savedSearch?: string;
    /** Inline SPL — preferred over savedSearch when no stanza fits. */
    spl?: string;
    /** Field whose value is displayed. Defaults to 'value'. */
    valueField?: string;
    /** Mock fallback when no search wired. */
    mockValue: string;
}

export interface KpiResult {
    value: string;
    source: DataSource;
    spl: string;
    resolvedSavedSearch: string;
}

export const useKpi = (
    cfg: KpiConfig,
    range: TimeRange,
    refreshToken: number
): KpiResult => {
    const spl = resolveMetricSpl(cfg);
    const savedSearchName = cfg.savedSearch ?? '';
    const valueField = cfg.valueField ?? 'value';
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
                    setResult(mock);
                    return;
                }
                const last = rows[rows.length - 1];
                const raw = last[valueField];
                const value = raw === undefined || raw === null ? cfg.mockValue : String(raw);
                setResult({
                    value,
                    source: 'live',
                    spl,
                    resolvedSavedSearch: savedSearchName,
                });
            })
            .catch(() => {
                if (!cancelled) setResult(mock);
            });
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cfg, range.earliest, range.latest, refreshToken]);

    return result;
};
