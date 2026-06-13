/**
 * usePersistedSectionLayout — per-user section visibility for the
 * Overview page. Factory defaults show the original three executive
 * sections; users may reveal one optional custom section or hide
 * sections they do not care about.
 */

import { useCallback, useEffect, useState } from 'react';
import type { SectionId } from '@/common/hooks/useMetric';

const STORAGE_KEY = 'splunk-cisco-dashboards.sectionLayout.v1';
const STORAGE_VERSION = 1;

export const ALL_SECTION_IDS: readonly SectionId[] = [
    'it_health',
    'security',
    'building',
    'custom',
] as const;

export const DEFAULT_SECTION_LAYOUT: readonly SectionId[] = [
    'it_health',
    'security',
    'building',
] as const;

const MAX_VISIBLE_SECTIONS = 4;
const MIN_VISIBLE_SECTIONS = 1;

const isSectionId = (raw: unknown): raw is SectionId =>
    typeof raw === 'string' && (ALL_SECTION_IDS as readonly string[]).includes(raw);

interface PersistedShape {
    v: number;
    sections: SectionId[];
}

const sanitizeSections = (raw: unknown): SectionId[] => {
    const source = Array.isArray(raw) ? raw : DEFAULT_SECTION_LAYOUT;
    const next: SectionId[] = [];
    const seen = new Set<SectionId>();
    for (const value of source) {
        if (!isSectionId(value)) continue;
        if (seen.has(value)) continue;
        seen.add(value);
        next.push(value);
        if (next.length >= MAX_VISIBLE_SECTIONS) break;
    }
    if (next.length < MIN_VISIBLE_SECTIONS) {
        return [...DEFAULT_SECTION_LAYOUT];
    }
    return next;
};

const readFromStorage = (): SectionId[] => {
    if (typeof window === 'undefined' || !window.localStorage) {
        return [...DEFAULT_SECTION_LAYOUT];
    }
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return [...DEFAULT_SECTION_LAYOUT];
        const parsed = JSON.parse(raw) as Partial<PersistedShape>;
        if (!parsed || parsed.v !== STORAGE_VERSION) return [...DEFAULT_SECTION_LAYOUT];
        return sanitizeSections(parsed.sections);
    } catch {
        return [...DEFAULT_SECTION_LAYOUT];
    }
};

const writeToStorage = (sections: SectionId[]): void => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
        const payload: PersistedShape = {
            v: STORAGE_VERSION,
            sections: sanitizeSections(sections),
        };
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
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

export const usePersistedSectionLayout = (): UsePersistedSectionLayoutResult => {
    const [sections, setSectionsState] = useState<SectionId[]>(() => readFromStorage());

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const onStorage = (e: StorageEvent) => {
            if (e.key !== STORAGE_KEY) return;
            setSectionsState(readFromStorage());
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    const setSections = useCallback((nextSections: SectionId[]) => {
        const clean = sanitizeSections(nextSections);
        writeToStorage(clean);
        setSectionsState(clean);
    }, []);

    const addSection = useCallback(
        (section?: SectionId) => {
            setSectionsState((prev) => {
                if (prev.length >= MAX_VISIBLE_SECTIONS) return prev;
                const nextSection =
                    section ??
                    ALL_SECTION_IDS.find((candidate) => !prev.includes(candidate));
                if (!nextSection || prev.includes(nextSection)) return prev;
                const next = sanitizeSections([...prev, nextSection]);
                writeToStorage(next);
                return next;
            });
        },
        []
    );

    const removeSection = useCallback((section: SectionId) => {
        setSectionsState((prev) => {
            if (!prev.includes(section) || prev.length <= MIN_VISIBLE_SECTIONS) return prev;
            const next = sanitizeSections(prev.filter((candidate) => candidate !== section));
            writeToStorage(next);
            return next;
        });
    }, []);

    const resetAll = useCallback(() => {
        const fresh = [...DEFAULT_SECTION_LAYOUT];
        writeToStorage(fresh);
        setSectionsState(fresh);
    }, []);

    return {
        sections,
        availableSections: ALL_SECTION_IDS,
        maxSections: MAX_VISIBLE_SECTIONS,
        setSections,
        addSection,
        removeSection,
        resetAll,
    };
};
