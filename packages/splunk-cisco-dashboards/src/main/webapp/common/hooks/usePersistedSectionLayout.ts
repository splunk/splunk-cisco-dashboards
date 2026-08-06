/**
 * usePersistedSectionLayout — per-user section visibility for the
 * Insights workspace. Each workspace supplies its own available and default
 * sections; the Executive source remains the no-argument compatibility
 * fallback for callers outside the workspace runtime.
 */

import { useCallback, useEffect, useState } from 'react';
import type { SectionId } from '@/common/hooks/useMetric';
import {
    ALL_WORKSPACE_SECTION_IDS,
    EXECUTIVE_WORKSPACE_SOURCE_ID,
    WORKSPACE_SOURCES,
    workspaceStorageKey,
    type WorkspaceId,
} from '@/common/config/insightsWorkspaces';

const STORAGE_KEY = 'splunk-cisco-dashboards.sectionLayout.v1';
const STORAGE_VERSION = 1;

export const ALL_SECTION_IDS: readonly SectionId[] = ALL_WORKSPACE_SECTION_IDS;
export const DEFAULT_SECTION_LAYOUT: readonly SectionId[] =
    WORKSPACE_SOURCES[EXECUTIVE_WORKSPACE_SOURCE_ID].defaultVisibleSections;

const MIN_VISIBLE_SECTIONS = 1;

export interface SectionLayoutOptions {
    workspaceId?: WorkspaceId;
    availableSections?: readonly SectionId[];
    defaultSections?: readonly SectionId[];
    maxSections?: number;
    minSections?: number;
}

interface PersistedShape {
    v: number;
    sections: SectionId[];
}

const buildOptions = (options: SectionLayoutOptions = {}) => {
    const fallback = WORKSPACE_SOURCES[EXECUTIVE_WORKSPACE_SOURCE_ID];
    const availableSections =
        options.availableSections ?? fallback.sections.map((section) => section.id);
    const defaultSections = options.defaultSections ?? fallback.defaultVisibleSections;
    const maxSections = options.maxSections ?? fallback.maxVisibleSections;
    const minSections = options.minSections ?? MIN_VISIBLE_SECTIONS;
    const availableSet = new Set(availableSections);
    return {
        availableSections,
        defaultSections,
        maxSections,
        minSections,
        availableSet,
        storageKey: workspaceStorageKey(
            STORAGE_KEY,
            options.workspaceId ?? EXECUTIVE_WORKSPACE_SOURCE_ID
        ),
    };
};

const sanitizeSections = (
    raw: unknown,
    options: ReturnType<typeof buildOptions>
): SectionId[] => {
    const source = Array.isArray(raw) ? raw : options.defaultSections;
    const next: SectionId[] = [];
    const seen = new Set<SectionId>();
    for (const value of source) {
        if (!options.availableSet.has(value)) continue;
        if (seen.has(value)) continue;
        seen.add(value);
        next.push(value);
        if (next.length >= options.maxSections) break;
    }
    if (next.length < options.minSections) {
        return [...options.defaultSections].slice(0, options.maxSections);
    }
    return next;
};

const readFromStorage = (options: ReturnType<typeof buildOptions>): SectionId[] => {
    if (typeof window === 'undefined' || !window.localStorage) {
        return sanitizeSections(options.defaultSections, options);
    }
    try {
        const raw = window.localStorage.getItem(options.storageKey);
        if (!raw) return sanitizeSections(options.defaultSections, options);
        const parsed = JSON.parse(raw) as Partial<PersistedShape>;
        if (!parsed || parsed.v !== STORAGE_VERSION) {
            return sanitizeSections(options.defaultSections, options);
        }
        return sanitizeSections(parsed.sections, options);
    } catch {
        return sanitizeSections(options.defaultSections, options);
    }
};

const writeToStorage = (
    sections: SectionId[],
    options: ReturnType<typeof buildOptions>
): void => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
        const payload: PersistedShape = {
            v: STORAGE_VERSION,
            sections: sanitizeSections(sections, options),
        };
        window.localStorage.setItem(options.storageKey, JSON.stringify(payload));
    } catch {
        // Storage may be unavailable; the in-memory state still works.
    }
};

export interface UsePersistedSectionLayoutResult {
    sections: SectionId[];
    availableSections: readonly SectionId[];
    maxSections: number;
    setSections: (sections: SectionId[]) => void;
    addSection: (section?: SectionId) => void;
    removeSection: (section: SectionId) => void;
    resetAll: () => void;
}

export const usePersistedSectionLayout = (
    layoutOptions: SectionLayoutOptions = {}
): UsePersistedSectionLayoutResult => {
    const options = buildOptions(layoutOptions);
    const [sections, setSectionsState] = useState<SectionId[]>(() =>
        readFromStorage(options)
    );

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const onStorage = (e: StorageEvent) => {
            if (e.key !== options.storageKey) return;
            setSectionsState(readFromStorage(options));
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, [options]);

    const setSections = useCallback((nextSections: SectionId[]) => {
        const clean = sanitizeSections(nextSections, options);
        writeToStorage(clean, options);
        setSectionsState(clean);
    }, [options]);

    const addSection = useCallback(
        (section?: SectionId) => {
            setSectionsState((prev) => {
                if (prev.length >= options.maxSections) return prev;
                const nextSection =
                    section ??
                    options.availableSections.find((candidate) => !prev.includes(candidate));
                if (!nextSection || prev.includes(nextSection)) return prev;
                const next = sanitizeSections([...prev, nextSection], options);
                writeToStorage(next, options);
                return next;
            });
        },
        [options]
    );

    const removeSection = useCallback((section: SectionId) => {
        setSectionsState((prev) => {
            if (!prev.includes(section) || prev.length <= options.minSections) return prev;
            const next = sanitizeSections(
                prev.filter((candidate) => candidate !== section),
                options
            );
            writeToStorage(next, options);
            return next;
        });
    }, [options]);

    const resetAll = useCallback(() => {
        const fresh = sanitizeSections(options.defaultSections, options);
        writeToStorage(fresh, options);
        setSectionsState(fresh);
    }, [options]);

    return {
        sections,
        availableSections: options.availableSections,
        maxSections: options.maxSections,
        setSections,
        addSection,
        removeSection,
        resetAll,
    };
};
