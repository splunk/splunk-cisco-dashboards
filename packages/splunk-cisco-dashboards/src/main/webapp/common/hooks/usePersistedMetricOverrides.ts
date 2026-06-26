/**
 * usePersistedMetricOverrides — per-user customisations of which
 * searchbase entry powers each metric / KPI tile.
 *
 * Each tile has a stable string id (`network_health`, `top_incident`,
 * etc.). The user can override the searchbase entry bound to that id via
 * the KPI picker, and the override is mirrored into `localStorage` so
 * it survives reloads. Overrides are scoped to this app's storage key
 * to avoid leaking into / from other Splunk apps that might be loaded
 * in the same browser.
 *
 * Storage shape (versioned for future migrations):
 *
 *   {
 *     v: 1,
 *     overrides: {
 *       "<tileId>": {
 *         savedSearch: string,         // searchbase search_name to resolve
 *         label?: string,              // optional friendly label override
 *         valueField?: string,         // optional field to read as the value
 *         description?: string,        // optional info-tooltip override
 *         thresholdWarning?: number,   // optional override for threshold.warning
 *         thresholdCritical?: number,  // optional override for threshold.critical
 *         thresholdDirection?: 'higher_is_better' | 'lower_is_better',
 *         vizOverride?: MetricVizOverride, // Builds 1174 / 1187 / 1225
 *         hidePeak?: true,             // Build 1202 — suppress peak callout
 *         hideDelta?: true,            // Build 1202 — suppress delta pill
 *         hideOverlay?: true,          // Build 1203 — suppress previous-period dashed overlay
 *       }
 *     }
 *   }
 *
 * Threshold storage rules (Build 97):
 *   • Only fields that differ from the tile's static `MetricThresholds`
 *     default are persisted. The picker form passes the tile's
 *     `defaultThresholds` through `KpiPickerContext` so it can omit
 *     redundant values at apply-time. This keeps the storage payload
 *     small and makes "Reset to default" trivial — clearing a
 *     threshold field from the override is identical to falling back
 *     to the static default at runtime.
 *   • The runtime merge lives in `applyOverride()` in
 *     `pages/overview/index.tsx`: any override field that's set wins
 *     over the static default; unset fields fall through. So a
 *     partial override (e.g. only `thresholdWarning`) keeps the
 *     existing critical and direction values untouched.
 *
 * The hook returns:
 *   • `overrides` — current map keyed by tileId
 *   • `setOverride(tileId, payload)` — write/replace one tile's override
 *   • `clearOverride(tileId)` — drop one tile's override
 *   • `resetAll()` — wipe the whole store back to defaults
 */

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'splunk-cisco-dashboards.metricOverrides.v1';
const STORAGE_VERSION = 1;

/**
 * Bounds for sanitised threshold numbers. The runtime can express
 * percentages (0–100), counts (0–N), and rates, so the bounds need to
 * cover the full usable numeric range while still rejecting obviously
 * malformed values like `Infinity` or 1e30. The actual sane-range
 * check (warning < critical for higher_is_better, etc.) is left to the
 * picker form — operators sometimes intentionally want a "warn-only"
 * tile with critical higher than warning to disable the red band, and
 * the storage layer shouldn't second-guess that.
 */
const THRESHOLD_MIN = -1_000_000_000;
const THRESHOLD_MAX = 1_000_000_000;

const isFiniteThresholdNumber = (n: unknown): n is number =>
    typeof n === 'number' &&
    Number.isFinite(n) &&
    n >= THRESHOLD_MIN &&
    n <= THRESHOLD_MAX;

const VALID_DIRECTIONS = new Set<string>(['higher_is_better', 'lower_is_better']);

/**
 * Allow-list of viz overrides accepted from the picker (Build 1174).
 * Mirrors the runtime `SparklineVizType` union — kept as a literal
 * Set here so a stale localStorage entry can't smuggle in an
 * unrecognised viz name. New viz types must be added in three
 * places at once: this set, the runtime SparklineVizType, and the
 * picker UI's option list.
 */
export type MetricVizOverride =
    | 'area'
    | 'line'
    | 'column'
    | 'bar'
    | 'singlevalue'
    | 'table'
    | 'barbreakdown'
    | 'pie'
    | 'singlevalueradial'
    | 'fillergauge'
    | 'markergauge';

const VALID_VIZ_OVERRIDES = new Set<string>([
    'area',
    'line',
    'column',
    'bar',
    'singlevalue',
    'table',
    'barbreakdown',
    'pie',
    'singlevalueradial',
    'fillergauge',
    'markergauge',
]);

export interface MetricOverride {
    /** searchbase search_name. The property name is kept for compatibility. */
    savedSearch: string;
    /** Optional friendly label to override the metric's default. */
    label?: string;
    /** Optional field name to read the headline value from. */
    valueField?: string;
    /** Optional info-tooltip description override. */
    description?: string;
    /**
     * Optional override for the warning threshold. When set, replaces
     * the tile's static `cfg.thresholds.warning` at runtime — the
     * status colour, the THRESHOLDS rows in the info popover, and
     * the trend-arrow tint all pick this up automatically because
     * they all read through the same `MetricThresholds` shape.
     *
     * Storage rule: omitted by the picker when the value matches the
     * static default, so the persisted override map only carries
     * genuine deltas.
     */
    thresholdWarning?: number;
    /** Optional override for the critical threshold. Same rules as `thresholdWarning`. */
    thresholdCritical?: number;
    /**
     * Optional override for the direction in which the threshold
     * applies. Use sparingly — flipping direction on a tile usually
     * means the user picked a value field with inverse semantics
     * (e.g. swapped a "% healthy" column for a "% failed" one), in
     * which case overriding direction makes the red/green colours
     * read correctly without having to fork the tile.
     */
    thresholdDirection?: 'higher_is_better' | 'lower_is_better';
    /**
     * Optional viz-type override for the tile's chart (Build 1174).
     * Mirrors the runtime `SparklineVizType` so the picker can swap
     * the rendering without forking the searchbase entry: an `area`
     * tile can be re-styled as `line` / `column` / `bar` /
     * `singlevalue` per user. Build 1225 extended the same persisted
     * knob to structural tile renderers that already exist in the app:
     * `table`, `barbreakdown`, `pie`, `singlevalueradial`,
     * `fillergauge`, and `markergauge`. `bar` remains the sparkline
     * horizontal-bar style for backward compatibility; use
     * `barbreakdown` for categorical row distributions. When unset,
     * the runtime falls back to `searchbase.conf`'s `default_viz`.
     */
    vizOverride?: MetricVizOverride;
    /**
     * Display toggles (Build 1202, from Atef's review on 2026-05-19).
     * Together with the picker-driven KPI binding and Chart style,
     * these let the operator silence "chrome" around the headline
     * value when they want the tile to read as a clean single
     * number — peak callout and delta-vs-previous pill — without
     * having to fork the searchbase entry. Both default to `false`
     * (chrome visible, mirrors existing behaviour). Only persisted
     * when explicitly `true` so the storage payload stays minimal
     * and the merge layer can treat absence as "default ON".
     *
     * Scope note: deliberately NOT a "hide sparkline" toggle —
     * collapsing the chart is already reachable via
     * `vizOverride: 'singlevalue'` and a second control would
     * duplicate the state. The Display section in the picker
     * documents that path inline.
     *
     * `hideOverlay` (Build 1203) was added in the same family: drops
     * the dashed previous-period (or rolling-average baseline) line
     * from the sparkline canvas. The chart itself remains, but the
     * period-over-period comparison overlay is suppressed so the
     * tile reads as a clean trend.
     */
    hidePeak?: boolean;
    hideDelta?: boolean;
    hideOverlay?: boolean;
}

export type MetricOverrideMap = Record<string, MetricOverride>;

interface PersistedShape {
    v: number;
    overrides: MetricOverrideMap;
}

const SAVED_SEARCH_NAME_PATTERN = /^[\w\s\-.:()]+$/;
const TILE_ID_PATTERN = /^[a-z0-9_]{1,64}$/;
const FIELD_NAME_PATTERN = /^[A-Za-z_][\w.]{0,63}$/;

const sanitizeOverride = (raw: unknown): MetricOverride | null => {
    if (!raw || typeof raw !== 'object') return null;
    const o = raw as Record<string, unknown>;
    const savedSearch = typeof o.savedSearch === 'string' ? o.savedSearch.trim() : '';
    if (savedSearch.length === 0 || savedSearch.length > 256) return null;
    if (!SAVED_SEARCH_NAME_PATTERN.test(savedSearch)) return null;
    const out: MetricOverride = { savedSearch };
    if (typeof o.label === 'string' && o.label.length > 0 && o.label.length <= 80) {
        out.label = o.label;
    }
    if (typeof o.valueField === 'string' && FIELD_NAME_PATTERN.test(o.valueField)) {
        out.valueField = o.valueField;
    }
    if (typeof o.description === 'string' && o.description.length > 0 && o.description.length <= 600) {
        out.description = o.description;
    }
    // Threshold overrides (Build 97). Each is independently optional:
    // the runtime merge in `applyOverride()` falls back to the static
    // default for any field that's missing, so a partial override is
    // valid (e.g. only `thresholdWarning` set, critical inherited).
    if (isFiniteThresholdNumber(o.thresholdWarning)) {
        out.thresholdWarning = o.thresholdWarning;
    }
    if (isFiniteThresholdNumber(o.thresholdCritical)) {
        out.thresholdCritical = o.thresholdCritical;
    }
    if (typeof o.thresholdDirection === 'string' && VALID_DIRECTIONS.has(o.thresholdDirection)) {
        out.thresholdDirection = o.thresholdDirection as MetricOverride['thresholdDirection'];
    }
    // Viz override (Build 1174). Same rules as threshold overrides:
    // optional, only stored when the picker explicitly chose a viz
    // distinct from the conf default. Anything outside the allow-
    // list is silently dropped so a stale or hand-edited localStorage
    // payload can't smuggle an unrecognised viz name into the
    // runtime.
    if (typeof o.vizOverride === 'string' && VALID_VIZ_OVERRIDES.has(o.vizOverride)) {
        out.vizOverride = o.vizOverride as MetricOverride['vizOverride'];
    }
    // Display toggles (Build 1202). Only persist `true` values; the
    // runtime treats absence as "default ON" so we keep the storage
    // payload tiny and any future default flip happens automatically
    // for tiles the user hasn't customised.
    if (o.hidePeak === true) {
        out.hidePeak = true;
    }
    if (o.hideDelta === true) {
        out.hideDelta = true;
    }
    if (o.hideOverlay === true) {
        out.hideOverlay = true;
    }
    return out;
};

const readFromStorage = (): MetricOverrideMap => {
    if (typeof window === 'undefined' || !window.localStorage) return {};
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as Partial<PersistedShape>;
        if (!parsed || parsed.v !== STORAGE_VERSION || !parsed.overrides) return {};
        const cleaned: MetricOverrideMap = {};
        for (const [key, value] of Object.entries(parsed.overrides)) {
            if (!TILE_ID_PATTERN.test(key)) continue;
            const ov = sanitizeOverride(value);
            if (ov) cleaned[key] = ov;
        }
        return cleaned;
    } catch {
        return {};
    }
};

const writeToStorage = (overrides: MetricOverrideMap): void => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
        const payload: PersistedShape = { v: STORAGE_VERSION, overrides };
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
        // Storage may be unavailable (private mode / quota). The picker
        // still works for the current session — we just won't persist.
    }
};

export interface UsePersistedMetricOverridesResult {
    overrides: MetricOverrideMap;
    setOverride: (tileId: string, override: MetricOverride) => void;
    clearOverride: (tileId: string) => void;
    resetAll: () => void;
    /** Number of active overrides — handy for "Reset (3)" buttons. */
    overrideCount: number;
}

export const usePersistedMetricOverrides = (): UsePersistedMetricOverridesResult => {
    const [overrides, setOverrides] = useState<MetricOverrideMap>(() => readFromStorage());

    // Cross-tab sync: pick up changes made in another tab via the
    // standard `storage` event so the dashboard stays consistent.
    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const onStorage = (e: StorageEvent) => {
            if (e.key !== STORAGE_KEY) return;
            setOverrides(readFromStorage());
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    const setOverride = useCallback((tileId: string, override: MetricOverride) => {
        if (!TILE_ID_PATTERN.test(tileId)) return;
        const sanitized = sanitizeOverride(override);
        if (!sanitized) return;
        setOverrides((prev) => {
            const next = { ...prev, [tileId]: sanitized };
            writeToStorage(next);
            return next;
        });
    }, []);

    const clearOverride = useCallback((tileId: string) => {
        if (!TILE_ID_PATTERN.test(tileId)) return;
        setOverrides((prev) => {
            if (!(tileId in prev)) return prev;
            const next = { ...prev };
            delete next[tileId];
            writeToStorage(next);
            return next;
        });
    }, []);

    const resetAll = useCallback(() => {
        writeToStorage({});
        setOverrides({});
    }, []);

    return {
        overrides,
        setOverride,
        clearOverride,
        resetAll,
        overrideCount: Object.keys(overrides).length,
    };
};
