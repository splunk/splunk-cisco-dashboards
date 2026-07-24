/**
 * Persists user-wired drilldown relationships between searchbase entries.
 *
 * The shipped/default relationship lives in `searchbase.conf` via
 * `drilldown_search_name`. This hook stores operator choices keyed by
 * source `search_name`, so a drilldown follows the search binding even
 * when a tile is removed, re-added, or moved to a different tile slot.
 */

import { useCallback, useEffect, useState } from 'react';
import {
    DEFAULT_OVERVIEW_PROFILE_ID,
    profileStorageKey,
    type OverviewProfileId,
} from '@/common/config/overviewProfiles';

const STORAGE_KEY = 'splunk-cisco-dashboards.searchbaseDrilldowns.v1';
const STORAGE_VERSION = 1;

export type SearchbaseDrilldownMap = Record<string, string | null>;

interface PersistedShape {
    v: number;
    drilldowns: SearchbaseDrilldownMap;
}

const isValidSearchName = (value: unknown): value is string =>
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.trim().length <= 256 &&
    !/[\x00-\x1F\x7F]/.test(value);

const storageKeyForProfile = (profileId?: OverviewProfileId): string =>
    profileStorageKey(STORAGE_KEY, profileId ?? DEFAULT_OVERVIEW_PROFILE_ID);

const readFromStorage = (storageKey: string): SearchbaseDrilldownMap => {
    if (typeof window === 'undefined' || !window.localStorage) return {};
    try {
        const raw = window.localStorage.getItem(storageKey);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as Partial<PersistedShape>;
        if (!parsed || parsed.v !== STORAGE_VERSION || !parsed.drilldowns) {
            return {};
        }
        const cleaned: SearchbaseDrilldownMap = {};
        for (const [source, target] of Object.entries(parsed.drilldowns)) {
            if (!isValidSearchName(source)) continue;
            if (target === null || isValidSearchName(target)) {
                cleaned[source.trim()] = target === null ? null : target.trim();
            }
        }
        return cleaned;
    } catch {
        return {};
    }
};

const writeToStorage = (
    storageKey: string,
    drilldowns: SearchbaseDrilldownMap
): void => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
        const payload: PersistedShape = { v: STORAGE_VERSION, drilldowns };
        window.localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {
        // Ignore quota / privacy-mode failures; the in-memory state still works.
    }
};

export const usePersistedSearchbaseDrilldowns = (
    profileId: OverviewProfileId = DEFAULT_OVERVIEW_PROFILE_ID
) => {
    const storageKey = storageKeyForProfile(profileId);
    const [drilldowns, setDrilldowns] =
        useState<SearchbaseDrilldownMap>(() => readFromStorage(storageKey));

    useEffect(() => {
        writeToStorage(storageKey, drilldowns);
    }, [drilldowns, storageKey]);

    const setDrilldown = useCallback(
        (sourceSearchName: string, drilldownSearchName: string | null) => {
            if (!isValidSearchName(sourceSearchName)) return;
            setDrilldowns((prev) => {
                const next: SearchbaseDrilldownMap = { ...prev };
                const source = sourceSearchName.trim();
                if (drilldownSearchName === null) {
                    next[source] = null;
                } else if (isValidSearchName(drilldownSearchName)) {
                    next[source] = drilldownSearchName.trim();
                }
                return next;
            });
        },
        []
    );

    const clearDrilldown = useCallback((sourceSearchName: string) => {
        if (!isValidSearchName(sourceSearchName)) return;
        setDrilldowns((prev) => {
            const next: SearchbaseDrilldownMap = { ...prev };
            delete next[sourceSearchName.trim()];
            return next;
        });
    }, []);

    const resetAll = useCallback(() => {
        setDrilldowns({});
    }, []);

    return { drilldowns, setDrilldown, clearDrilldown, resetAll };
};
