/**
 * Per-user, per-workspace control for Insights Workspace search pressure.
 * The preference is intentionally browser-local: it lets an operator tune a
 * constrained Splunk stack without changing the shared workspace topology.
 */

import { useCallback, useEffect, useState } from 'react';
import {
    DEFAULT_CONCURRENT_TILE_SEARCHES,
    MAX_CONCURRENT_TILE_SEARCHES,
    MIN_CONCURRENT_TILE_SEARCHES,
    setTileSearchConcurrency,
} from '@/common/services/splunkSearchService';
import {
    EXECUTIVE_WORKSPACE_SOURCE_ID,
    readUserScopedStorageItem,
    workspaceStorageKey,
    type WorkspaceId,
} from '@/common/config/insightsWorkspaces';

const STORAGE_KEY = 'splunk-cisco-dashboards.searchConcurrency.v1';
const STORAGE_VERSION = 1;

interface PersistedShape {
    v: number;
    concurrency: number;
}

const clampConcurrency = (value: unknown): number => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return DEFAULT_CONCURRENT_TILE_SEARCHES;
    return Math.max(
        MIN_CONCURRENT_TILE_SEARCHES,
        Math.min(MAX_CONCURRENT_TILE_SEARCHES, Math.round(parsed))
    );
};

const storageKeyForWorkspace = (workspaceId?: WorkspaceId): string =>
    workspaceStorageKey(
        STORAGE_KEY,
        workspaceId ?? EXECUTIVE_WORKSPACE_SOURCE_ID
    );

const readFromStorage = (storageKey: string): number => {
    if (typeof window === 'undefined' || !window.localStorage) {
        return DEFAULT_CONCURRENT_TILE_SEARCHES;
    }
    try {
        const raw = readUserScopedStorageItem(storageKey);
        if (!raw) return DEFAULT_CONCURRENT_TILE_SEARCHES;
        const parsed = JSON.parse(raw) as Partial<PersistedShape>;
        if (parsed.v !== STORAGE_VERSION) return DEFAULT_CONCURRENT_TILE_SEARCHES;
        return clampConcurrency(parsed.concurrency);
    } catch {
        return DEFAULT_CONCURRENT_TILE_SEARCHES;
    }
};

const writeToStorage = (storageKey: string, concurrency: number): void => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
        const payload: PersistedShape = {
            v: STORAGE_VERSION,
            concurrency,
        };
        window.localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {
        // The in-memory setting remains active for this browser session.
    }
};

export interface UsePersistedSearchConcurrencyResult {
    concurrency: number;
    setConcurrency: (value: number) => void;
    reset: () => void;
}

export const usePersistedSearchConcurrency = (
    workspaceId?: WorkspaceId
): UsePersistedSearchConcurrencyResult => {
    const storageKey = storageKeyForWorkspace(workspaceId);
    const [concurrency, setConcurrencyState] = useState<number>(() =>
        readFromStorage(storageKey)
    );

    useEffect(() => {
        const next = readFromStorage(storageKey);
        setConcurrencyState(next);
        setTileSearchConcurrency(next);
    }, [storageKey]);

    useEffect(() => {
        setTileSearchConcurrency(concurrency);
    }, [concurrency]);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const onStorage = (event: StorageEvent) => {
            if (event.key !== storageKey) return;
            setConcurrencyState(readFromStorage(storageKey));
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, [storageKey]);

    const setConcurrency = useCallback(
        (value: number) => {
            const next = clampConcurrency(value);
            setConcurrencyState(next);
            writeToStorage(storageKey, next);
        },
        [storageKey]
    );

    const reset = useCallback(() => {
        if (typeof window !== 'undefined' && window.localStorage) {
            try {
                window.localStorage.removeItem(storageKey);
            } catch {
                // The state reset below is sufficient for this session.
            }
        }
        setConcurrencyState(DEFAULT_CONCURRENT_TILE_SEARCHES);
    }, [storageKey]);

    return { concurrency, setConcurrency, reset };
};
