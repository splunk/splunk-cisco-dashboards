/**
 * usePersistedSectionTileCounts — per-user, per-section "how many
 * tiles do I want to see" preference, mirrored to localStorage.
 *
 * Each section on the Overview page (it_health, security, building)
 * ships with up to N tiles. The user can dial the visible count down
 * to a configurable minimum (3 by default) when they want a cleaner
 * read, or back up to the section's natural size when they want
 * everything. The trailing tiles in METRIC_CONFIG are the ones that
 * get hidden first — picker overrides on hidden tiles are NOT
 * cleared, so when the user bumps the count back up their
 * customisations come back unchanged.
 *
 * Storage shape (versioned for future migrations):
 *
 *   {
 *     v: 1,
 *     counts: {
 *       "it_health": 5,
 *       "security": 3,
 *       "building": 4
 *     }
 *   }
 *
 * Defaults: all sections start at `defaultCount` (5). The hook
 * clamps every read/write into [minCount, maxCount] so a stale
 * localStorage payload from a future build, or a hand-edited value
 * from devtools, can't render the dashboard with a negative or
 * out-of-range tile count.
 */

import { useCallback, useEffect, useState } from 'react';
import type { SectionId } from '@/common/hooks/useMetric';

const STORAGE_KEY = 'splunk-cisco-dashboards.sectionTileCounts.v1';
const STORAGE_VERSION = 1;

const SECTION_IDS: readonly SectionId[] = ['it_health', 'security', 'building'] as const;
const isSectionId = (raw: unknown): raw is SectionId =>
    typeof raw === 'string' && (SECTION_IDS as readonly string[]).includes(raw);

export interface SectionTileCountBounds {
    /** Lowest count the user is allowed to dial down to. */
    minCount: number;
    /** Highest count the user is allowed to dial up to. */
    maxCount: number;
    /** Initial value when nothing is in localStorage yet. */
    defaultCount: number;
}

export type SectionTileCountMap = Record<SectionId, number>;

interface PersistedShape {
    v: number;
    counts: Partial<Record<SectionId, number>>;
}

const clamp = (n: number, lo: number, hi: number): number =>
    Math.min(Math.max(Math.round(n), lo), hi);

const buildDefaults = (count: number): SectionTileCountMap => ({
    it_health: count,
    security: count,
    building: count,
});

const readFromStorage = (bounds: SectionTileCountBounds): SectionTileCountMap => {
    const fallback = buildDefaults(bounds.defaultCount);
    if (typeof window === 'undefined' || !window.localStorage) return fallback;
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return fallback;
        const parsed = JSON.parse(raw) as Partial<PersistedShape>;
        if (!parsed || parsed.v !== STORAGE_VERSION || !parsed.counts) return fallback;
        const out: SectionTileCountMap = { ...fallback };
        for (const [key, value] of Object.entries(parsed.counts)) {
            if (!isSectionId(key)) continue;
            if (typeof value !== 'number' || !Number.isFinite(value)) continue;
            out[key] = clamp(value, bounds.minCount, bounds.maxCount);
        }
        return out;
    } catch {
        return fallback;
    }
};

const writeToStorage = (counts: SectionTileCountMap): void => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
        const payload: PersistedShape = { v: STORAGE_VERSION, counts };
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
        // Storage may be unavailable (private mode / quota). The pill
        // still works for the current session — we just won't persist.
    }
};

export interface UsePersistedSectionTileCountsResult {
    /** Current visible tile count per section, always within bounds. */
    counts: SectionTileCountMap;
    /** Bounds, mirrored back so callers can wire the pill without re-importing. */
    bounds: SectionTileCountBounds;
    /** Set the visible tile count for a single section. Clamped to bounds. */
    setCount: (section: SectionId, count: number) => void;
    /** Wipe back to defaults across all sections. */
    resetAll: () => void;
}

export const usePersistedSectionTileCounts = (
    bounds: SectionTileCountBounds = {
        minCount: 3,
        maxCount: 5,
        defaultCount: 5,
    }
): UsePersistedSectionTileCountsResult => {
    const [counts, setCounts] = useState<SectionTileCountMap>(() => readFromStorage(bounds));

    // Cross-tab sync: pick up changes made in another tab via the
    // standard `storage` event so the layout stays consistent across
    // multiple Splunk Web tabs the user may have open.
    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const onStorage = (e: StorageEvent) => {
            if (e.key !== STORAGE_KEY) return;
            setCounts(readFromStorage(bounds));
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, [bounds]);

    const setCount = useCallback(
        (section: SectionId, count: number) => {
            if (!isSectionId(section)) return;
            const clamped = clamp(count, bounds.minCount, bounds.maxCount);
            setCounts((prev) => {
                if (prev[section] === clamped) return prev;
                const next = { ...prev, [section]: clamped };
                writeToStorage(next);
                return next;
            });
        },
        [bounds.minCount, bounds.maxCount]
    );

    const resetAll = useCallback(() => {
        const fresh = buildDefaults(bounds.defaultCount);
        writeToStorage(fresh);
        setCounts(fresh);
    }, [bounds.defaultCount]);

    return { counts, bounds, setCount, resetAll };
};
