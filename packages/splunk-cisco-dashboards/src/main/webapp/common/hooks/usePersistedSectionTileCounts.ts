/**
 * usePersistedSectionTileCounts — per-user, per-section "how many
 * tiles do I want to see" preference, mirrored to localStorage.
 *
 * Each section on the Overview page ships with up to N tiles. The user
 * can dial the visible count down
 * to a configurable minimum (3 by default) when they want a cleaner
 * read, or back up to the section's natural size when they want
 * everything. The trailing tiles in the resolved section catalogue are
 * the ones that get hidden first — picker overrides on hidden tiles are NOT
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
 *       "building": 4,
 *       "custom": 3
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
import { ALL_SECTION_IDS } from '@/common/hooks/usePersistedSectionLayout';
import {
    DEFAULT_OVERVIEW_PROFILE_ID,
    OVERVIEW_PROFILES,
    profileStorageKey,
    type OverviewProfileId,
} from '@/common/config/overviewProfiles';

const STORAGE_KEY = 'splunk-cisco-dashboards.sectionTileCounts.v1';
const STORAGE_VERSION = 1;

const isSectionId = (raw: unknown): raw is SectionId =>
    typeof raw === 'string' && (ALL_SECTION_IDS as readonly string[]).includes(raw);

export interface SectionTileCountBounds {
    /** Lowest count the user is allowed to dial down to. */
    minCount: number;
    /** Highest count the user is allowed to dial up to. */
    maxCount: number;
    /**
     * Initial visible tile count when nothing is in localStorage yet.
     * Either a single number (every section starts at the same value)
     * or a partial per-section map (sections not listed fall back to
     * `fallbackDefault`). Used when individual sections need a
     * different first-paint density without changing the global default.
     */
    defaultCount: number | Partial<Record<SectionId, number>>;
    /**
     * Backstop default when `defaultCount` is a partial map. Defaults
     * to 5 to preserve the historical "all sections start at 5" UX.
     */
    fallbackDefault?: number;
    profileId?: OverviewProfileId;
    availableSections?: readonly SectionId[];
}

export type SectionTileCountMap = Record<SectionId, number>;

interface PersistedShape {
    v: number;
    counts: Partial<Record<SectionId, number>>;
}

const clamp = (n: number, lo: number, hi: number): number =>
    Math.min(Math.max(Math.round(n), lo), hi);

const resolveSectionDefault = (
    section: SectionId,
    bounds: SectionTileCountBounds
): number => {
    const fallback = bounds.fallbackDefault ?? 5;
    if (typeof bounds.defaultCount === 'number') {
        return clamp(bounds.defaultCount, bounds.minCount, bounds.maxCount);
    }
    const explicit = bounds.defaultCount[section];
    const raw = typeof explicit === 'number' && Number.isFinite(explicit)
        ? explicit
        : fallback;
    return clamp(raw, bounds.minCount, bounds.maxCount);
};

const buildDefaults = (bounds: SectionTileCountBounds): SectionTileCountMap =>
    Object.fromEntries(
        ALL_SECTION_IDS.map((section) => [section, resolveSectionDefault(section, bounds)])
    ) as SectionTileCountMap;

const storageKeyForBounds = (bounds: SectionTileCountBounds): string =>
    profileStorageKey(
        STORAGE_KEY,
        bounds.profileId ?? DEFAULT_OVERVIEW_PROFILE_ID
    );

const readFromStorage = (bounds: SectionTileCountBounds): SectionTileCountMap => {
    const fallback = buildDefaults(bounds);
    if (typeof window === 'undefined' || !window.localStorage) return fallback;
    try {
        const raw = window.localStorage.getItem(storageKeyForBounds(bounds));
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

const writeToStorage = (
    counts: SectionTileCountMap,
    bounds: SectionTileCountBounds
): void => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
        const payload: PersistedShape = { v: STORAGE_VERSION, counts };
        window.localStorage.setItem(storageKeyForBounds(bounds), JSON.stringify(payload));
    } catch {
        // Storage may be unavailable (private mode / quota). The pill
        // still works for the current session — we just won't persist.
    }
};

const clearStorage = (bounds: SectionTileCountBounds): void => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
        window.localStorage.removeItem(storageKeyForBounds(bounds));
    } catch {
        // Storage may be unavailable. The in-memory state still resets.
    }
};

const hasStoredCounts = (bounds: SectionTileCountBounds): boolean => {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    try {
        return window.localStorage.getItem(storageKeyForBounds(bounds)) !== null;
    } catch {
        return false;
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
        minCount: OVERVIEW_PROFILES[DEFAULT_OVERVIEW_PROFILE_ID].minTileCount,
        maxCount: OVERVIEW_PROFILES[DEFAULT_OVERVIEW_PROFILE_ID].maxTileCount,
        defaultCount: OVERVIEW_PROFILES[DEFAULT_OVERVIEW_PROFILE_ID].fallbackTileCount,
        profileId: DEFAULT_OVERVIEW_PROFILE_ID,
    }
): UsePersistedSectionTileCountsResult => {
    const [counts, setCounts] = useState<SectionTileCountMap>(() => readFromStorage(bounds));
    const defaultSignature = JSON.stringify(buildDefaults(bounds));
    const storageKey = storageKeyForBounds(bounds);
    const boundsSignature = JSON.stringify({
        minCount: bounds.minCount,
        maxCount: bounds.maxCount,
        defaultSignature,
        fallbackDefault: bounds.fallbackDefault,
        profileId: bounds.profileId ?? DEFAULT_OVERVIEW_PROFILE_ID,
    });

    useEffect(() => {
        if (hasStoredCounts(bounds)) return;
        setCounts(buildDefaults(bounds));
    }, [boundsSignature]);

    // Cross-tab sync: pick up changes made in another tab via the
    // standard `storage` event so the layout stays consistent across
    // multiple Splunk Web tabs the user may have open.
    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const onStorage = (e: StorageEvent) => {
            if (e.key !== storageKey) return;
            setCounts(readFromStorage(bounds));
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, [boundsSignature, storageKey]);

    const setCount = useCallback(
        (section: SectionId, count: number) => {
            if (!isSectionId(section)) return;
            const clamped = clamp(count, bounds.minCount, bounds.maxCount);
            setCounts((prev) => {
                if (prev[section] === clamped) return prev;
                const next = { ...prev, [section]: clamped };
                writeToStorage(next, bounds);
                return next;
            });
        },
        [boundsSignature]
    );

    const resetAll = useCallback(() => {
        const fresh = buildDefaults(bounds);
        clearStorage(bounds);
        setCounts(fresh);
    }, [boundsSignature]);

    return { counts, bounds, setCount, resetAll };
};
