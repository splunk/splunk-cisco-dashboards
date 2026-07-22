/**
 * usePersistedSectionHiddenTiles — per-user hidden Overview tiles.
 *
 * This is intentionally local profile state. Factory tiles remain
 * authored in searchbase.conf / overview_factory_tiles.conf; hiding a
 * tile removes it from the user's visible section without mutating the
 * shared dashboard defaults.
 */

import { useCallback, useEffect, useState } from 'react';
import type { SectionId } from '@/common/hooks/useMetric';
import { ALL_SECTION_IDS } from '@/common/hooks/usePersistedSectionLayout';
import {
    DEFAULT_OVERVIEW_PROFILE_ID,
    profileStorageKey,
    type OverviewProfileId,
} from '@/common/config/overviewProfiles';

const STORAGE_KEY = 'splunk-cisco-dashboards.sectionHiddenTiles.v1';
const STORAGE_VERSION = 1;
const TILE_ID_PATTERN = /^[a-z0-9_]{1,64}$/;

export type SectionHiddenTileMap = Partial<Record<SectionId, string[]>>;

export interface SectionHiddenTilesOptions {
    profileId?: OverviewProfileId;
    availableSections?: readonly SectionId[];
}

interface PersistedShape {
    v: number;
    hidden: SectionHiddenTileMap;
}

const storageKeyForProfile = (profileId?: OverviewProfileId): string =>
    profileStorageKey(STORAGE_KEY, profileId ?? DEFAULT_OVERVIEW_PROFILE_ID);

const isSectionId = (
    raw: unknown,
    availableSections: readonly SectionId[] = ALL_SECTION_IDS
): raw is SectionId =>
    typeof raw === 'string' &&
    (availableSections as readonly string[]).includes(raw);

const cleanTileIds = (ids: unknown): string[] => {
    if (!Array.isArray(ids)) return [];
    const out: string[] = [];
    const seen = new Set<string>();
    ids.forEach((id) => {
        if (typeof id !== 'string') return;
        const trimmed = id.trim();
        if (!TILE_ID_PATTERN.test(trimmed) || seen.has(trimmed)) return;
        seen.add(trimmed);
        out.push(trimmed);
    });
    return out;
};

const readFromStorage = (
    storageKey: string,
    availableSections: readonly SectionId[]
): SectionHiddenTileMap => {
    if (typeof window === 'undefined' || !window.localStorage) return {};
    try {
        const raw = window.localStorage.getItem(storageKey);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as Partial<PersistedShape>;
        if (!parsed || parsed.v !== STORAGE_VERSION || !parsed.hidden) return {};
        const out: SectionHiddenTileMap = {};
        Object.entries(parsed.hidden).forEach(([section, ids]) => {
            if (!isSectionId(section, availableSections)) return;
            const cleaned = cleanTileIds(ids);
            if (cleaned.length > 0) out[section] = cleaned;
        });
        return out;
    } catch {
        return {};
    }
};

const writeToStorage = (
    storageKey: string,
    hidden: SectionHiddenTileMap
): void => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
        const payload: PersistedShape = { v: STORAGE_VERSION, hidden };
        window.localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {
        // In-memory state still works for the current tab.
    }
};

export interface UsePersistedSectionHiddenTilesResult {
    hidden: SectionHiddenTileMap;
    getHidden: (section: SectionId) => string[];
    isHidden: (section: SectionId, tileId: string) => boolean;
    hideTile: (section: SectionId, tileId: string) => void;
    showTile: (section: SectionId, tileId: string) => void;
    resetAll: () => void;
    hasAnyHidden: boolean;
}

export const usePersistedSectionHiddenTiles = (
    options: SectionHiddenTilesOptions = {}
): UsePersistedSectionHiddenTilesResult => {
    const storageKey = storageKeyForProfile(options.profileId);
    const availableSections = options.availableSections ?? ALL_SECTION_IDS;
    const optionsSignature = JSON.stringify({ storageKey, availableSections });
    const [hidden, setHidden] = useState<SectionHiddenTileMap>(() =>
        readFromStorage(storageKey, availableSections)
    );

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const onStorage = (e: StorageEvent) => {
            if (e.key !== storageKey) return;
            setHidden(readFromStorage(storageKey, availableSections));
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, [availableSections, optionsSignature, storageKey]);

    const getHidden = useCallback(
        (section: SectionId): string[] =>
            isSectionId(section, availableSections) ? hidden[section] ?? [] : [],
        [availableSections, hidden]
    );

    const isHidden = useCallback(
        (section: SectionId, tileId: string): boolean =>
            getHidden(section).includes(tileId),
        [getHidden]
    );

    const hideTile = useCallback(
        (section: SectionId, tileId: string) => {
            if (!isSectionId(section, availableSections)) return;
            const cleanId = tileId.trim();
            if (!TILE_ID_PATTERN.test(cleanId)) return;
            setHidden((prev) => {
                const current = prev[section] ?? [];
                if (current.includes(cleanId)) return prev;
                const next: SectionHiddenTileMap = {
                    ...prev,
                    [section]: [...current, cleanId],
                };
                writeToStorage(storageKey, next);
                return next;
            });
        },
        [availableSections, storageKey]
    );

    const showTile = useCallback(
        (section: SectionId, tileId: string) => {
            if (!isSectionId(section, availableSections)) return;
            const cleanId = tileId.trim();
            if (!TILE_ID_PATTERN.test(cleanId)) return;
            setHidden((prev) => {
                const current = prev[section] ?? [];
                const filtered = current.filter((id) => id !== cleanId);
                if (filtered.length === current.length) return prev;
                const next: SectionHiddenTileMap = { ...prev };
                if (filtered.length > 0) {
                    next[section] = filtered;
                } else {
                    delete next[section];
                }
                writeToStorage(storageKey, next);
                return next;
            });
        },
        [availableSections, storageKey]
    );

    const resetAll = useCallback(() => {
        writeToStorage(storageKey, {});
        setHidden({});
    }, [storageKey]);

    return {
        hidden,
        getHidden,
        isHidden,
        hideTile,
        showTile,
        resetAll,
        hasAnyHidden: Object.keys(hidden).length > 0,
    };
};
