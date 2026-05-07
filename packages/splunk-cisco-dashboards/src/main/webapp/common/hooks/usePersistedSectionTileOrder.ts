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
 *       "building":   ["building_score", "active_devices", "wifi_clients", "occupancy", "webex_devices"]
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

const STORAGE_KEY = 'splunk-cisco-dashboards.sectionTileOrder.v1';
const STORAGE_VERSION = 1;

const SECTION_IDS: readonly SectionId[] = ['it_health', 'security', 'building'] as const;
const isSectionId = (raw: unknown): raw is SectionId =>
    typeof raw === 'string' && (SECTION_IDS as readonly string[]).includes(raw);

// Same vocabulary as `MetricConfig.id` — lowercase alnum + underscores,
// short. Anything outside this gate is dropped on read so a hand-edited
// localStorage payload can't smuggle in DOM ids or selectors.
const TILE_ID_PATTERN = /^[a-z0-9_]{1,64}$/;

export type SectionTileOrderMap = Partial<Record<SectionId, string[]>>;

interface PersistedShape {
    v: number;
    order: SectionTileOrderMap;
}

const readFromStorage = (): SectionTileOrderMap => {
    if (typeof window === 'undefined' || !window.localStorage) return {};
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as Partial<PersistedShape>;
        if (!parsed || parsed.v !== STORAGE_VERSION || !parsed.order) return {};
        const out: SectionTileOrderMap = {};
        for (const [section, ids] of Object.entries(parsed.order)) {
            if (!isSectionId(section) || !Array.isArray(ids)) continue;
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

const writeToStorage = (order: SectionTileOrderMap): void => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
        const payload: PersistedShape = { v: STORAGE_VERSION, order };
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
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

export const usePersistedSectionTileOrder = (): UsePersistedSectionTileOrderResult => {
    const [orderMap, setOrderMap] = useState<SectionTileOrderMap>(() => readFromStorage());

    // Cross-tab sync: pick up changes made in another tab via the
    // standard `storage` event so the layout stays consistent across
    // multiple Splunk Web tabs the user may have open.
    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const onStorage = (e: StorageEvent) => {
            if (e.key !== STORAGE_KEY) return;
            setOrderMap(readFromStorage());
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    const getOrder = useCallback(
        (section: SectionId, canonicalIds: string[]): string[] => {
            const persisted = orderMap[section];
            const reconciled = reconcileOrder(persisted, canonicalIds);
            return reconciled ?? canonicalIds;
        },
        [orderMap]
    );

    const setOrder = useCallback((section: SectionId, ids: string[]) => {
        if (!isSectionId(section)) return;
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
            writeToStorage(next);
            return next;
        });
    }, []);

    const resetSection = useCallback((section: SectionId) => {
        if (!isSectionId(section)) return;
        setOrderMap((prev) => {
            if (!(section in prev)) return prev;
            const next: SectionTileOrderMap = { ...prev };
            delete next[section];
            writeToStorage(next);
            return next;
        });
    }, []);

    const resetAll = useCallback(() => {
        writeToStorage({});
        setOrderMap({});
    }, []);

    return {
        getOrder,
        setOrder,
        resetSection,
        resetAll,
        hasAnyOrder: Object.keys(orderMap).length > 0,
    };
};
