/**
 * usePersistedMetricOverrides — per-user customisations of which saved
 * search powers each metric / KPI tile.
 *
 * Each tile has a stable string id (`network_health`, `top_incident`,
 * etc.). The user can override the saved-search bound to that id via
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
 *         savedSearch: string,    // stanza name to dispatch
 *         label?: string,         // optional friendly label override
 *         valueField?: string,    // optional field to read as the value
 *         description?: string,   // optional info-tooltip override
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

const STORAGE_KEY = 'splunk-cisco-dashboards.metricOverrides.v1';
const STORAGE_VERSION = 1;

export interface MetricOverride {
    /** Saved-search stanza name. The only required field. */
    savedSearch: string;
    /** Optional friendly label to override the metric's default. */
    label?: string;
    /** Optional field name to read the headline value from. */
    valueField?: string;
    /** Optional info-tooltip description override. */
    description?: string;
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
