/**
 * Persists user-wired drilldown relationships between searchbase entries.
 *
 * The shipped/default relationship lives in `searchbase.conf` via the
 * canonical `drilldown_stanza_id`. This hook stores operator choices keyed
 * by source `search_name`, so a drilldown follows the search binding even
 * when a tile is removed, re-added, or moved to a different tile slot.
 * Existing persisted target `search_name` values remain valid because the
 * runtime resolves target identities by stanza id first, then friendly name.
 */

import { useCallback, useEffect, useState } from 'react';
import {
    EXECUTIVE_WORKSPACE_SOURCE_ID,
    readUserScopedStorageItem,
    workspaceStorageKey,
    type WorkspaceId,
} from '@/common/config/insightsWorkspaces';

const STORAGE_KEY = 'splunk-cisco-dashboards.searchbaseDrilldowns.v1';
const STORAGE_VERSION = 1;

export type SearchbaseDrilldownMap = Record<string, string | null>;

interface PersistedShape {
    v: number;
    drilldowns: SearchbaseDrilldownMap;
}

const isValidSearchIdentity = (value: unknown): value is string =>
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.trim().length <= 256 &&
    !/[\x00-\x1F\x7F]/.test(value);

const storageKeyForWorkspace = (workspaceId?: WorkspaceId): string =>
    workspaceStorageKey(STORAGE_KEY, workspaceId ?? EXECUTIVE_WORKSPACE_SOURCE_ID);

const readFromStorage = (storageKey: string): SearchbaseDrilldownMap => {
    if (typeof window === 'undefined' || !window.localStorage) return {};
    try {
        const raw = readUserScopedStorageItem(storageKey);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as Partial<PersistedShape>;
        if (!parsed || parsed.v !== STORAGE_VERSION || !parsed.drilldowns) {
            return {};
        }
        const cleaned: SearchbaseDrilldownMap = {};
        for (const [source, target] of Object.entries(parsed.drilldowns)) {
            if (!isValidSearchIdentity(source)) continue;
            if (target === null || isValidSearchIdentity(target)) {
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
    workspaceId: WorkspaceId = EXECUTIVE_WORKSPACE_SOURCE_ID
) => {
    const storageKey = storageKeyForWorkspace(workspaceId);
    const [drilldowns, setDrilldowns] =
        useState<SearchbaseDrilldownMap>(() => readFromStorage(storageKey));

    useEffect(() => {
        writeToStorage(storageKey, drilldowns);
    }, [drilldowns, storageKey]);

    const setDrilldown = useCallback(
        (sourceSearchName: string, drilldownSearchName: string | null) => {
            if (!isValidSearchIdentity(sourceSearchName)) return;
            setDrilldowns((prev) => {
                const next: SearchbaseDrilldownMap = { ...prev };
                const source = sourceSearchName.trim();
                if (drilldownSearchName === null) {
                    next[source] = null;
                } else if (isValidSearchIdentity(drilldownSearchName)) {
                    next[source] = drilldownSearchName.trim();
                }
                return next;
            });
        },
        []
    );

    const clearDrilldown = useCallback((sourceSearchName: string) => {
        if (!isValidSearchIdentity(sourceSearchName)) return;
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
