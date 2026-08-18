/**
 * Private, workspace-scoped presentation preferences for Insights Workspace
 * sections. Collapsed state is persisted for the current browser profile;
 * focus mode remains transient in the page component so a reload never traps
 * an operator in a single-section view.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SectionId } from '@/common/hooks/useMetric';
import { ALL_SECTION_IDS } from '@/common/hooks/usePersistedSectionLayout';
import {
    EXECUTIVE_WORKSPACE_SOURCE_ID,
    readUserScopedStorageItem,
    workspaceStorageKey,
    type WorkspaceId,
} from '@/common/config/insightsWorkspaces';

const STORAGE_KEY = 'splunk-cisco-dashboards.sectionPresentation.v1';
const STORAGE_VERSION = 1;

export type SectionCollapsedMap = Record<SectionId, boolean>;

interface PersistedShape {
    v: number;
    collapsed: Partial<Record<SectionId, boolean>>;
}

interface SectionPresentationOptions {
    workspaceId?: WorkspaceId;
    availableSections?: readonly SectionId[];
}

const buildDefaults = (): SectionCollapsedMap =>
    Object.fromEntries(
        ALL_SECTION_IDS.map((section) => [section, false])
    ) as SectionCollapsedMap;

const isAvailableSection = (
    value: unknown,
    availableSections: readonly SectionId[]
): value is SectionId =>
    typeof value === 'string' &&
    (availableSections as readonly string[]).includes(value);

const storageKeyForOptions = (options: SectionPresentationOptions): string =>
    workspaceStorageKey(
        STORAGE_KEY,
        options.workspaceId ?? EXECUTIVE_WORKSPACE_SOURCE_ID
    );

const readFromStorage = (
    options: SectionPresentationOptions
): SectionCollapsedMap => {
    const fallback = buildDefaults();
    if (typeof window === 'undefined' || !window.localStorage) return fallback;
    try {
        const raw = readUserScopedStorageItem(storageKeyForOptions(options));
        if (!raw) return fallback;
        const parsed = JSON.parse(raw) as Partial<PersistedShape>;
        if (
            !parsed ||
            parsed.v !== STORAGE_VERSION ||
            !parsed.collapsed
        ) {
            return fallback;
        }
        const availableSections = options.availableSections ?? ALL_SECTION_IDS;
        const next = { ...fallback };
        for (const [section, collapsed] of Object.entries(parsed.collapsed)) {
            if (!isAvailableSection(section, availableSections)) continue;
            if (typeof collapsed !== 'boolean') continue;
            next[section] = collapsed;
        }
        return next;
    } catch {
        return fallback;
    }
};

const writeToStorage = (
    collapsed: SectionCollapsedMap,
    options: SectionPresentationOptions
): void => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
        const payload: PersistedShape = {
            v: STORAGE_VERSION,
            collapsed,
        };
        window.localStorage.setItem(
            storageKeyForOptions(options),
            JSON.stringify(payload)
        );
    } catch {
        // The live session remains authoritative when storage is unavailable.
    }
};

export interface UsePersistedSectionPresentationResult {
    collapsed: SectionCollapsedMap;
    setCollapsed: (section: SectionId, value: boolean) => void;
    resetAll: () => void;
}

export const usePersistedSectionPresentation = (
    options: SectionPresentationOptions = {}
): UsePersistedSectionPresentationResult => {
    const storageKey = storageKeyForOptions(options);
    const availableSections = options.availableSections ?? ALL_SECTION_IDS;
    const availableSignature = availableSections.join('|');
    const stableOptions = useMemo<SectionPresentationOptions>(
        () => ({
            workspaceId: options.workspaceId,
            availableSections,
        }),
        [availableSignature, options.workspaceId]
    );
    const [collapsed, setCollapsedState] = useState<SectionCollapsedMap>(() =>
        readFromStorage(stableOptions)
    );

    useEffect(() => {
        setCollapsedState(readFromStorage(stableOptions));
    }, [stableOptions, storageKey]);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const onStorage = (event: StorageEvent) => {
            if (event.key !== storageKey) return;
            setCollapsedState(readFromStorage(stableOptions));
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, [stableOptions, storageKey]);

    const setCollapsed = useCallback(
        (section: SectionId, value: boolean) => {
            if (!isAvailableSection(section, availableSections)) return;
            setCollapsedState((previous) => {
                if (previous[section] === value) return previous;
                const next = { ...previous, [section]: value };
                writeToStorage(next, stableOptions);
                return next;
            });
        },
        [availableSignature, stableOptions]
    );

    const resetAll = useCallback(() => {
        const next = buildDefaults();
        if (typeof window !== 'undefined' && window.localStorage) {
            try {
                window.localStorage.removeItem(storageKey);
            } catch {
                // The in-memory reset below is sufficient for this session.
            }
        }
        setCollapsedState(next);
    }, [storageKey]);

    return { collapsed, setCollapsed, resetAll };
};
