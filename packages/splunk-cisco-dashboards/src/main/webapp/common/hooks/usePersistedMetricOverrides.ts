/**
 * usePersistedMetricOverrides — per-user *display taste* for Overview
 * tiles: chart style and chrome-hiding toggles. Nothing here changes
 * what a tile means or what data it shows — just how the current
 * viewer likes to look at it, so browser-local storage is the right
 * home for it.
 *
 * Everything that affects what a tile MEANS — thresholds, which
 * search feeds it, its value field, its label, its drilldown target —
 * used to live in this same object, but that meant two people looking
 * at the same tile could see different numbers or different
 * drilldowns, which is a correctness problem, not a preference. Those
 * fields moved to admin-controlled `searchbase.conf` (see
 * `searchbaseTileConfigService.ts` and `useCanManageFactoryTileConfig`)
 * so every viewer sees the same thing, editable only by someone with
 * `admin_all_objects`.
 *
 * `STORAGE_VERSION` bumped from 1 to 2 for this split: any override
 * payload written by the old schema (which required `savedSearch` and
 * carried thresholds/label/valueField) is simply discarded on read —
 * the version mismatch check already does this safely, and there's
 * nothing worth migrating since those fields no longer apply here.
 *
 * Storage shape:
 *
 *   {
 *     v: 2,
 *     overrides: {
 *       "<tileId>": {
 *         vizOverride?: MetricVizOverride, // chart style
 *         hidePeak?: true,                 // suppress peak callout
 *         hideDelta?: true,                // suppress delta pill
 *         hideOverlay?: true,              // suppress previous-period dashed overlay
 *       }
 *     }
 *   }
 *
 * The hook returns:
 *   • `overrides` — current map keyed by tileId
 *   • `setOverride(tileId, payload)` — write/replace one tile's override
 *   • `clearOverride(tileId)` — drop one tile's override
 *   • `resetAll()` — wipe the whole store back to defaults
 */

import { useCallback, useEffect, useState } from 'react';
import {
    EXECUTIVE_WORKSPACE_SOURCE_ID,
    readUserScopedStorageItem,
    workspaceStorageKey,
    type WorkspaceId,
} from '@/common/config/insightsWorkspaces';

const STORAGE_KEY = 'splunk-cisco-dashboards.metricOverrides.v1';
const STORAGE_VERSION = 2;

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
    /**
     * Optional viz-type override for the tile's chart (Build 1174).
     * Mirrors the runtime `SparklineVizType` so the picker can swap
     * the rendering without forking the searchbase entry. When unset,
     * the runtime falls back to `searchbase.conf`'s `default_viz`.
     */
    vizOverride?: MetricVizOverride;
    /**
     * Display toggles (Build 1202, from Atef's review on 2026-05-19).
     * Let the operator silence "chrome" around the headline value —
     * peak callout and delta-vs-previous pill — without having to
     * fork the searchbase entry. Both default to `false` (chrome
     * visible, mirrors existing behaviour). Only persisted when
     * explicitly `true` so the storage payload stays minimal and the
     * merge layer can treat absence as "default ON".
     *
     * `hideOverlay` (Build 1203) drops the dashed previous-period (or
     * rolling-average baseline) line from the sparkline canvas.
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

const TILE_ID_PATTERN = /^[a-z0-9_]{1,64}$/;

const sanitizeOverride = (raw: unknown): MetricOverride | null => {
    if (!raw || typeof raw !== 'object') return null;
    const o = raw as Record<string, unknown>;
    const out: MetricOverride = {};
    if (typeof o.vizOverride === 'string' && VALID_VIZ_OVERRIDES.has(o.vizOverride)) {
        out.vizOverride = o.vizOverride as MetricOverride['vizOverride'];
    }
    if (o.hidePeak === true) out.hidePeak = true;
    if (o.hideDelta === true) out.hideDelta = true;
    if (o.hideOverlay === true) out.hideOverlay = true;
    // An override with none of these fields set is a no-op; treat it
    // as "no customisation" so the storage payload and the "(custom)"
    // dot in the UI stay honest.
    if (
        out.vizOverride === undefined &&
        out.hidePeak === undefined &&
        out.hideDelta === undefined &&
        out.hideOverlay === undefined
    ) {
        return null;
    }
    return out;
};

const storageKeyForWorkspace = (workspaceId?: WorkspaceId): string =>
    workspaceStorageKey(STORAGE_KEY, workspaceId ?? EXECUTIVE_WORKSPACE_SOURCE_ID);

const readFromStorage = (storageKey: string): MetricOverrideMap => {
    if (typeof window === 'undefined' || !window.localStorage) return {};
    try {
        const raw = readUserScopedStorageItem(storageKey);
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

const writeToStorage = (storageKey: string, overrides: MetricOverrideMap): void => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
        const payload: PersistedShape = { v: STORAGE_VERSION, overrides };
        window.localStorage.setItem(storageKey, JSON.stringify(payload));
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

export const usePersistedMetricOverrides = (
    workspaceId: WorkspaceId = EXECUTIVE_WORKSPACE_SOURCE_ID
): UsePersistedMetricOverridesResult => {
    const storageKey = storageKeyForWorkspace(workspaceId);
    const [overrides, setOverrides] = useState<MetricOverrideMap>(() =>
        readFromStorage(storageKey)
    );

    // Cross-tab sync: pick up changes made in another tab via the
    // standard `storage` event so the dashboard stays consistent.
    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const onStorage = (e: StorageEvent) => {
            if (e.key !== storageKey) return;
            setOverrides(readFromStorage(storageKey));
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, [storageKey]);

    const setOverride = useCallback((tileId: string, override: MetricOverride) => {
        if (!TILE_ID_PATTERN.test(tileId)) return;
        const sanitized = sanitizeOverride(override);
        setOverrides((prev) => {
            const next = { ...prev };
            if (sanitized) {
                next[tileId] = sanitized;
            } else {
                delete next[tileId];
            }
            writeToStorage(storageKey, next);
            return next;
        });
    }, [storageKey]);

    const clearOverride = useCallback((tileId: string) => {
        if (!TILE_ID_PATTERN.test(tileId)) return;
        setOverrides((prev) => {
            if (!(tileId in prev)) return prev;
            const next = { ...prev };
            delete next[tileId];
            writeToStorage(storageKey, next);
            return next;
        });
    }, [storageKey]);

    const resetAll = useCallback(() => {
        writeToStorage(storageKey, {});
        setOverrides({});
    }, [storageKey]);

    return {
        overrides,
        setOverride,
        clearOverride,
        resetAll,
        overrideCount: Object.keys(overrides).length,
    };
};
