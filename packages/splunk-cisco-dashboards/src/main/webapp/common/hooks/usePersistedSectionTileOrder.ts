/**
 * usePersistedSectionTileOrder — per-user, per-section tile ordering
 * preference, mirrored to localStorage.
 *
 * Companion to `usePersistedSectionTileCounts`. Where the count
 * preference says "show me 3 of the 5 tiles", this preference says
 * "and arrange them in *this* order so the trailing-hide rule hides
 * the right ones." Together they give the user full layout control
 * within each section.
 *
 * Storage shape (versioned for future migrations):
 *
 *   {
 *     v: 1,
 *     order: {
 *       "it_health":  ["network_health", "open_issues", "ux_score", "device_health", "compliance"],
 *       "security":   ["fw_blocked", "threat_sources", "failed_auth", "xdr_incidents", "security_score"],
 *       "building":   ["building_score", "active_devices", "wifi_clients", "occupancy", "webex_devices"],
 *       "custom":     ["executive_ux_score", "executive_it_score"]
 *     }
 *   }
 *
 * Self-healing reconciliation (`reconcileOrder`):
 *
 *   * Drops persisted ids that no longer exist in the current
 *     METRIC_CONFIG (e.g., a tile was renamed or removed in code).
 *   * Appends ids that exist in the current METRIC_CONFIG but were
 *     not in the persisted list (e.g., a new tile was added). New
 *     tiles land at the END so they don't accidentally bump the
 *     user's preferred top tiles out of view when a release ships.
 *   * Returns `null` (== "use static order") when no persistence
 *     applies, which lets the page fall through to METRIC_CONFIG's
 *     natural order with zero ceremony for first-time users.
 *
 * Reconciliation runs on every read and on every write. Callers can
 * therefore treat the persisted state as canonical without having
 * to remember to migrate it on schema drift.
 */

import { useCallback, useEffect, useState } from 'react';
import type { SectionId } from '@/common/hooks/useMetric';
import { ALL_SECTION_IDS } from '@/common/hooks/usePersistedSectionLayout';
import {
    EXECUTIVE_WORKSPACE_SOURCE_ID,
    readUserScopedStorageItem,
    workspaceStorageKey,
    type WorkspaceId,
} from '@/common/config/insightsWorkspaces';

const STORAGE_KEY = 'splunk-cisco-dashboards.sectionTileOrder.v1';
const STORAGE_VERSION = 1;

export interface SectionTileOrderOptions {
    workspaceId?: WorkspaceId;
    availableSections?: readonly SectionId[];
}

const storageKeyForWorkspace = (workspaceId?: WorkspaceId): string =>
    workspaceStorageKey(STORAGE_KEY, workspaceId ?? EXECUTIVE_WORKSPACE_SOURCE_ID);

const isSectionId = (
    raw: unknown,
    availableSections: readonly SectionId[] = ALL_SECTION_IDS
): raw is SectionId =>
    typeof raw === 'string' &&
    (availableSections as readonly string[]).includes(raw);

// Same vocabulary as `MetricConfig.id` — lowercase alnum + underscores,
// short. Anything outside this gate is dropped on read so a hand-edited
// localStorage payload can't smuggle in DOM ids or selectors.
const TILE_ID_PATTERN = /^[a-z0-9_]{1,64}$/;

export type SectionTileOrderMap = Partial<Record<SectionId, string[]>>;

interface PersistedShape {
    v: number;
    order: SectionTileOrderMap;
}

const readFromStorage = (
    storageKey: string,
    availableSections: readonly SectionId[]
): SectionTileOrderMap => {
    if (typeof window === 'undefined' || !window.localStorage) return {};
    try {
        const raw = readUserScopedStorageItem(storageKey);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as Partial<PersistedShape>;
        if (!parsed || parsed.v !== STORAGE_VERSION || !parsed.order) return {};
        const out: SectionTileOrderMap = {};
        for (const [section, ids] of Object.entries(parsed.order)) {
            if (!isSectionId(section, availableSections) || !Array.isArray(ids)) continue;
            const cleaned: string[] = [];
            const seen = new Set<string>();
            for (const id of ids) {
                if (typeof id !== 'string') continue;
                if (!TILE_ID_PATTERN.test(id)) continue;
                if (seen.has(id)) continue;
                seen.add(id);
                cleaned.push(id);
            }
            if (cleaned.length > 0) out[section] = cleaned;
        }
        return out;
    } catch {
        return {};
    }
};

const writeToStorage = (storageKey: string, order: SectionTileOrderMap): void => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
        const payload: PersistedShape = { v: STORAGE_VERSION, order };
        window.localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {
        // Storage may be unavailable; the in-memory state still works
        // for the current session.
    }
};

/**
 * Reconcile a user-persisted ordering against the canonical list of
 * tiles available in the section right now. Returns `null` when no
 * reconciliation applies (caller should use the canonical order).
 */
const reconcileOrder = (
    persistedIds: string[] | undefined,
    canonicalIds: string[]
): string[] | null => {
    if (!persistedIds || persistedIds.length === 0) return null;
    const canonicalSet = new Set(canonicalIds);
    // 1. Keep persisted ids that still exist, in user-preferred order.
    const kept = persistedIds.filter((id) => canonicalSet.has(id));
    // 2. Append canonical ids the user hasn't seen yet (new tiles
    //    shipped since they last touched the order). These land at
    //    the end so they can't inadvertently bump the user's
    //    favourites out of the visible window.
    const keptSet = new Set(kept);
    const appended = canonicalIds.filter((id) => !keptSet.has(id));
    const merged = [...kept, ...appended];
    // 3. If the result equals the canonical list, the user has no
    //    meaningful customisation — return `null` so the caller can
    //    treat it as "no override" and skip the indirection.
    const isCanonical =
        merged.length === canonicalIds.length &&
        merged.every((id, i) => id === canonicalIds[i]);
    return isCanonical ? null : merged;
};

export interface UsePersistedSectionTileOrderResult {
    /**
     * Resolve the effective ordering for a section against its
     * canonical id list. Returns the user-preferred order if one
     * exists (with auto-reconciliation), otherwise returns
     * `canonicalIds` unchanged.
     *
     * Always returns a *new* array reference when an order is
     * applied, so React can detect changes for keying.
     */
    getOrder: (section: SectionId, canonicalIds: string[]) => string[];
    /**
     * Persist a new ordering for a single section. The list is
     * sanitised the same way as a fresh storage read, so callers
     * can pass any string array without pre-filtering.
     */
    setOrder: (section: SectionId, ids: string[]) => void;
    /** Drop the ordering for a single section back to the static default. */
    resetSection: (section: SectionId) => void;
    /** Drop all per-section ordering preferences. */
    resetAll: () => void;
    /** True if any section has a persisted ordering preference. */
    hasAnyOrder: boolean;
}

export const usePersistedSectionTileOrder = (
    options: SectionTileOrderOptions = {}
): UsePersistedSectionTileOrderResult => {
    const storageKey = storageKeyForWorkspace(options.workspaceId);
    const availableSections = options.availableSections ?? ALL_SECTION_IDS;
    const optionsSignature = JSON.stringify({
        storageKey,
        availableSections,
    });
    const [orderMap, setOrderMap] = useState<SectionTileOrderMap>(() =>
        readFromStorage(storageKey, availableSections)
    );

    // Cross-tab sync: pick up changes made in another tab via the
    // standard `storage` event so the layout stays consistent across
    // multiple Splunk Web tabs the user may have open.
    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const onStorage = (e: StorageEvent) => {
            if (e.key !== storageKey) return;
            setOrderMap(readFromStorage(storageKey, availableSections));
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, [optionsSignature, storageKey]);

    const getOrder = useCallback(
        (section: SectionId, canonicalIds: string[]): string[] => {
            const persisted = orderMap[section];
            const reconciled = reconcileOrder(persisted, canonicalIds);
            return reconciled ?? canonicalIds;
        },
        [orderMap]
    );

    const setOrder = useCallback((section: SectionId, ids: string[]) => {
        if (!isSectionId(section, availableSections)) return;
        const cleaned: string[] = [];
        const seen = new Set<string>();
        for (const id of ids) {
            if (typeof id !== 'string') continue;
            if (!TILE_ID_PATTERN.test(id)) continue;
            if (seen.has(id)) continue;
            seen.add(id);
            cleaned.push(id);
        }
        setOrderMap((prev) => {
            const next: SectionTileOrderMap = { ...prev };
            if (cleaned.length === 0) {
                delete next[section];
            } else {
                next[section] = cleaned;
            }
            writeToStorage(storageKey, next);
            return next;
        });
    }, [optionsSignature, storageKey]);

    const resetSection = useCallback((section: SectionId) => {
        if (!isSectionId(section, availableSections)) return;
        setOrderMap((prev) => {
            if (!(section in prev)) return prev;
            const next: SectionTileOrderMap = { ...prev };
            delete next[section];
            writeToStorage(storageKey, next);
            return next;
        });
    }, [optionsSignature, storageKey]);

    const resetAll = useCallback(() => {
        writeToStorage(storageKey, {});
        setOrderMap({});
    }, [storageKey]);

    return {
        getOrder,
        setOrder,
        resetSection,
        resetAll,
        hasAnyOrder: Object.keys(orderMap).length > 0,
    };
};
