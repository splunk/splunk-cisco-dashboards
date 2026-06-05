/**
 * usePersistedSectionHeights — per-user vertical room preference for
 * each Overview metric section.
 *
 * Tile count answers "how many KPIs should I see?" This hook answers
 * "how much breathing room should this section get?" The values are
 * small integer levels, not raw pixels, so future CSS/layout changes
 * can reinterpret the levels without migrating localStorage.
 */

import { useCallback, useEffect, useState } from 'react';
import type { SectionId } from '@/common/hooks/useMetric';
import { ALL_SECTION_IDS } from '@/common/hooks/usePersistedSectionLayout';

const STORAGE_KEY = 'splunk-cisco-dashboards.sectionHeights.v1';
const STORAGE_VERSION = 1;

const isSectionId = (raw: unknown): raw is SectionId =>
    typeof raw === 'string' && (ALL_SECTION_IDS as readonly string[]).includes(raw);

export interface SectionHeightBounds {
    /** Smallest height level. */
    minLevel: number;
    /** Largest height level. */
    maxLevel: number;
    /** Initial height level for every section. */
    defaultLevel: number;
}

export type SectionHeightMap = Record<SectionId, number>;

interface PersistedShape {
    v: number;
    heights: Partial<Record<SectionId, number>>;
}

const clamp = (n: number, lo: number, hi: number): number =>
    Math.min(Math.max(Math.round(n), lo), hi);

const buildDefaults = (bounds: SectionHeightBounds): SectionHeightMap => {
    const level = clamp(bounds.defaultLevel, bounds.minLevel, bounds.maxLevel);
    return {
        it_health: level,
        security: level,
        building: level,
        custom: level,
    };
};

const readFromStorage = (bounds: SectionHeightBounds): SectionHeightMap => {
    const fallback = buildDefaults(bounds);
    if (typeof window === 'undefined' || !window.localStorage) return fallback;
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return fallback;
        const parsed = JSON.parse(raw) as Partial<PersistedShape>;
        if (!parsed || parsed.v !== STORAGE_VERSION || !parsed.heights) return fallback;
        const out: SectionHeightMap = { ...fallback };
        for (const [key, value] of Object.entries(parsed.heights)) {
            if (!isSectionId(key)) continue;
            if (typeof value !== 'number' || !Number.isFinite(value)) continue;
            out[key] = clamp(value, bounds.minLevel, bounds.maxLevel);
        }
        return out;
    } catch {
        return fallback;
    }
};

const writeToStorage = (heights: SectionHeightMap): void => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
        const payload: PersistedShape = { v: STORAGE_VERSION, heights };
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
        // Storage may be unavailable; the current in-memory session
        // still reflects the user's height changes.
    }
};

export interface UsePersistedSectionHeightsResult {
    heights: SectionHeightMap;
    bounds: SectionHeightBounds;
    setHeight: (section: SectionId, level: number) => void;
    resetAll: () => void;
}

export const usePersistedSectionHeights = (
    bounds: SectionHeightBounds = {
        minLevel: 1,
        maxLevel: 4,
        defaultLevel: 1,
    }
): UsePersistedSectionHeightsResult => {
    const [heights, setHeights] = useState<SectionHeightMap>(() => readFromStorage(bounds));

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const onStorage = (e: StorageEvent) => {
            if (e.key !== STORAGE_KEY) return;
            setHeights(readFromStorage(bounds));
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, [bounds]);

    const setHeight = useCallback(
        (section: SectionId, level: number) => {
            if (!isSectionId(section)) return;
            const clamped = clamp(level, bounds.minLevel, bounds.maxLevel);
            setHeights((prev) => {
                if (prev[section] === clamped) return prev;
                const next = { ...prev, [section]: clamped };
                writeToStorage(next);
                return next;
            });
        },
        [bounds.minLevel, bounds.maxLevel]
    );

    const resetAll = useCallback(() => {
        const fresh = buildDefaults(bounds);
        writeToStorage(fresh);
        setHeights(fresh);
    }, [bounds]);

    return { heights, bounds, setHeight, resetAll };
};
