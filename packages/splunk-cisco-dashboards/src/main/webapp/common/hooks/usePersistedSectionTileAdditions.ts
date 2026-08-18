/**
 * usePersistedSectionTileAdditions — per-user Overview tiles promoted
 * from searchbase.conf into a profile section.
 *
 * Factory/discovered tiles remain owned by searchbase.conf and
 * insights_workspaces.conf. This hook stores only the lightweight
 * local additions: "show searchbase stanza X in section Y for this
 * profile". The Overview page rebuilds normal MetricConfig objects
 * from the live searchbase catalogue on every render, so labels, SPL,
 * viz defaults, and tags still come from the canonical stanza.
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

const STORAGE_KEY = 'splunk-cisco-dashboards.sectionTileAdditions.v1';
const STORAGE_VERSION = 1;
const SEARCHBASE_ID_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9_.:-]{0,255}$/;

export interface SectionTileAdditionsOptions {
    workspaceId?: WorkspaceId;
    availableSections?: readonly SectionId[];
}

export type SectionTileAdditionMap = Partial<Record<SectionId, string[]>>;

interface PersistedShape {
    v: number;
    additions: SectionTileAdditionMap;
}

const storageKeyForWorkspace = (workspaceId?: WorkspaceId): string =>
    workspaceStorageKey(STORAGE_KEY, workspaceId ?? EXECUTIVE_WORKSPACE_SOURCE_ID);

const isSectionId = (
    raw: unknown,
    availableSections: readonly SectionId[] = ALL_SECTION_IDS
): raw is SectionId =>
    typeof raw === 'string' &&
    (availableSections as readonly string[]).includes(raw);

const cleanSearchbaseIds = (ids: unknown): string[] => {
    if (!Array.isArray(ids)) return [];
    const cleaned: string[] = [];
    const seen = new Set<string>();
    for (const id of ids) {
        if (typeof id !== 'string') continue;
        const trimmed = id.trim();
        if (!SEARCHBASE_ID_PATTERN.test(trimmed) || seen.has(trimmed)) continue;
        seen.add(trimmed);
        cleaned.push(trimmed);
    }
    return cleaned;
};

const readFromStorage = (
    storageKey: string,
    availableSections: readonly SectionId[]
): SectionTileAdditionMap => {
    if (typeof window === 'undefined' || !window.localStorage) return {};
    try {
        const raw = readUserScopedStorageItem(storageKey);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as Partial<PersistedShape>;
        if (!parsed || parsed.v !== STORAGE_VERSION || !parsed.additions) return {};
        const out: SectionTileAdditionMap = {};
        for (const [section, ids] of Object.entries(parsed.additions)) {
            if (!isSectionId(section, availableSections)) continue;
            const cleaned = cleanSearchbaseIds(ids);
            if (cleaned.length > 0) out[section] = cleaned;
        }
        return out;
    } catch {
        return {};
    }
};

const writeToStorage = (
    storageKey: string,
    additions: SectionTileAdditionMap
): void => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
        const payload: PersistedShape = { v: STORAGE_VERSION, additions };
        window.localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {
        // Storage may be unavailable; in-memory state remains useful
        // for the current tab.
    }
};

export interface UsePersistedSectionTileAdditionsResult {
    additions: SectionTileAdditionMap;
    getAdditions: (section: SectionId) => string[];
    addTile: (section: SectionId, searchbaseId: string) => void;
    removeTile: (section: SectionId, searchbaseId: string) => void;
    resetAll: () => void;
    hasAnyAdditions: boolean;
}

export const usePersistedSectionTileAdditions = (
    options: SectionTileAdditionsOptions = {}
): UsePersistedSectionTileAdditionsResult => {
    const storageKey = storageKeyForWorkspace(options.workspaceId);
    const availableSections = options.availableSections ?? ALL_SECTION_IDS;
    const optionsSignature = JSON.stringify({
        storageKey,
        availableSections,
    });
    const [additions, setAdditions] = useState<SectionTileAdditionMap>(() =>
        readFromStorage(storageKey, availableSections)
    );

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const onStorage = (e: StorageEvent) => {
            if (e.key !== storageKey) return;
            setAdditions(readFromStorage(storageKey, availableSections));
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, [optionsSignature, storageKey]);

    const getAdditions = useCallback(
        (section: SectionId): string[] => {
            if (!isSectionId(section, availableSections)) return [];
            return additions[section] ?? [];
        },
        [additions, optionsSignature]
    );

    const addTile = useCallback((section: SectionId, searchbaseId: string) => {
        if (!isSectionId(section, availableSections)) return;
        const stanzaId = searchbaseId.trim();
        if (!SEARCHBASE_ID_PATTERN.test(stanzaId)) return;
        setAdditions((prev) => {
            const current = prev[section] ?? [];
            if (current.includes(stanzaId)) return prev;
            const next: SectionTileAdditionMap = {
                ...prev,
                [section]: [...current, stanzaId],
            };
            writeToStorage(storageKey, next);
            return next;
        });
    }, [optionsSignature, storageKey]);

    const removeTile = useCallback((section: SectionId, searchbaseId: string) => {
        if (!isSectionId(section, availableSections)) return;
        const stanzaId = searchbaseId.trim();
        if (!SEARCHBASE_ID_PATTERN.test(stanzaId)) return;
        setAdditions((prev) => {
            const current = prev[section] ?? [];
            const filtered = current.filter((id) => id !== stanzaId);
            if (filtered.length === current.length) return prev;
            const next: SectionTileAdditionMap = { ...prev };
            if (filtered.length > 0) {
                next[section] = filtered;
            } else {
                delete next[section];
            }
            writeToStorage(storageKey, next);
            return next;
        });
    }, [optionsSignature, storageKey]);

    const resetAll = useCallback(() => {
        writeToStorage(storageKey, {});
        setAdditions({});
    }, [storageKey]);

    return {
        additions,
        getAdditions,
        addTile,
        removeTile,
        resetAll,
        hasAnyAdditions: Object.keys(additions).length > 0,
    };
};
