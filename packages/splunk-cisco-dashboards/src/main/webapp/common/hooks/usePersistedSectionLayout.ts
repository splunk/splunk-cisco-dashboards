/**
 * usePersistedSectionLayout — per-user section visibility for the
 * Overview page. Factory defaults show the original three executive
 * sections; users may reveal one optional custom section or hide
 * sections they do not care about.
 */

import { useCallback, useEffect, useState } from 'react';
import type { SectionId } from '@/common/hooks/useMetric';
import {
    ALL_OVERVIEW_SECTION_IDS,
    DEFAULT_OVERVIEW_PROFILE_ID,
    OVERVIEW_PROFILES,
    profileStorageKey,
    type OverviewProfileId,
} from '@/common/config/overviewProfiles';

const STORAGE_KEY = 'splunk-cisco-dashboards.sectionLayout.v1';
const STORAGE_VERSION = 1;

export const ALL_SECTION_IDS: readonly SectionId[] = ALL_OVERVIEW_SECTION_IDS;
export const DEFAULT_SECTION_LAYOUT: readonly SectionId[] =
    OVERVIEW_PROFILES[DEFAULT_OVERVIEW_PROFILE_ID].defaultVisibleSections;

const MIN_VISIBLE_SECTIONS = 1;

export interface SectionLayoutOptions {
    profileId?: OverviewProfileId;
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
    const profile = OVERVIEW_PROFILES[options.profileId ?? DEFAULT_OVERVIEW_PROFILE_ID];
    const availableSections = options.availableSections ?? profile.sections.map((s) => s.id);
    const defaultSections = options.defaultSections ?? profile.defaultVisibleSections;
    const maxSections = options.maxSections ?? profile.maxVisibleSections;
    const minSections = options.minSections ?? MIN_VISIBLE_SECTIONS;
    const availableSet = new Set(availableSections);
    return {
        profile,
        availableSections,
        defaultSections,
        maxSections,
        minSections,
        availableSet,
        storageKey: profileStorageKey(STORAGE_KEY, profile.id),
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
