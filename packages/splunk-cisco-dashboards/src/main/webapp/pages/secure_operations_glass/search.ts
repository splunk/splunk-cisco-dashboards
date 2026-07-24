import { useEffect, useMemo, useState } from 'react';

import {
    getSearchbaseCatalogue,
    type SearchbaseRecord,
} from '@/common/services/searchbaseCatalogue';
import {
    isAbortError,
    runSearch,
} from '@/common/services/splunkSearchService';

export type SearchRow = Record<string, unknown>;

export interface SearchState {
    rows: SearchRow[];
    loading: boolean;
    error: string | null;
}

export interface SearchRequest {
    catalogue: Map<string, SearchbaseRecord> | null;
    searchId: string;
    earliest: string;
    latest?: string;
    refreshToken: number;
    enabled?: boolean;
    transformSearch?: (spl: string) => string;
    count?: number;
}

const EMPTY_STATE: SearchState = {
    rows: [],
    loading: true,
    error: null,
};

export const useSearchbaseCatalogueMap = (): {
    catalogue: Map<string, SearchbaseRecord> | null;
    error: string | null;
} => {
    const [catalogue, setCatalogue] =
        useState<Map<string, SearchbaseRecord> | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        getSearchbaseCatalogue({ includeHidden: true })
            .then((records) => {
                if (cancelled) return;
                setCatalogue(new Map(records.map((record) => [record.id, record])));
                setError(null);
            })
            .catch(() => {
                if (cancelled) return;
                setCatalogue(new Map());
                setError('The Searchbase catalogue could not be loaded.');
            });

        return () => {
            cancelled = true;
        };
    }, []);

    return { catalogue, error };
};

export const useSearchbaseRows = ({
    catalogue,
    searchId,
    earliest,
    latest = 'now',
    refreshToken,
    enabled = true,
    transformSearch,
    count = 1000,
}: SearchRequest): SearchState => {
    const [state, setState] = useState<SearchState>(EMPTY_STATE);

    useEffect(() => {
        if (!enabled) {
            setState({ rows: [], loading: false, error: null });
            return undefined;
        }
        if (!catalogue) {
            setState(EMPTY_STATE);
            return undefined;
        }

        const record = catalogue.get(searchId);
        if (!record || !record.search) {
            setState({
                rows: [],
                loading: false,
                error: `Searchbase stanza "${searchId}" is unavailable.`,
            });
            return undefined;
        }

        const controller = new AbortController();
        const spl = transformSearch
            ? transformSearch(record.search)
            : record.search;

        setState((current) => ({
            ...current,
            loading: true,
            error: null,
        }));

        runSearch({
            spl,
            earliestTime: earliest,
            latestTime: latest,
            appContext: record.dispatchContext,
            tag: searchId,
            count,
            signal: controller.signal,
        })
            .then((response) => {
                setState({
                    rows: Array.isArray(response?.results)
                        ? response.results.map(
                              (result) => result as SearchRow
                          )
                        : [],
                    loading: false,
                    error: null,
                });
            })
            .catch((searchError: unknown) => {
                if (isAbortError(searchError)) return;
                setState({
                    rows: [],
                    loading: false,
                    error: 'This search could not be completed.',
                });
            });

        return () => controller.abort();
    }, [
        catalogue,
        searchId,
        earliest,
        latest,
        refreshToken,
        enabled,
        transformSearch,
        count,
    ]);

    return state;
};

export const asNumber = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value !== 'string') return null;
    const normalized = value.replace(/[%,$\s]/g, '');
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
};

export const formatNumber = (
    value: number | null,
    suffix = '',
    maximumFractionDigits = 1
): string => {
    if (value === null) return '—';
    return `${new Intl.NumberFormat(undefined, {
        notation: Math.abs(value) >= 100000 ? 'compact' : 'standard',
        maximumFractionDigits,
    }).format(value)}${suffix}`;
};

const LABEL_KEY_PATTERN =
    /(^_time$|time|date|name|label|site|policy|rule|category|status|action|identity|device|source)/i;

export const getNumericKeys = (rows: SearchRow[]): string[] => {
    const keys = new Set<string>();
    rows.slice(0, 25).forEach((row) => {
        Object.entries(row).forEach(([key, value]) => {
            if (key !== '_time' && asNumber(value) !== null) keys.add(key);
        });
    });
    return [...keys];
};

export const getLabelKey = (rows: SearchRow[]): string | null => {
    const keys = rows[0] ? Object.keys(rows[0]) : [];
    return (
        keys.find((key) => key === '_time') ??
        keys.find(
            (key) =>
                LABEL_KEY_PATTERN.test(key) &&
                rows.some((row) => asNumber(row[key]) === null)
        ) ??
        keys.find((key) => rows.some((row) => asNumber(row[key]) === null)) ??
        keys[0] ??
        null
    );
};

export const getScalarValue = (
    rows: SearchRow[],
    preferredFields: string[] = []
): number | null => {
    const first = rows[0];
    if (!first) return null;
    for (const field of preferredFields) {
        const value = asNumber(first[field]);
        if (value !== null) return value;
    }
    for (const [key, rawValue] of Object.entries(first)) {
        if (key === '_time') continue;
        const value = asNumber(rawValue);
        if (value !== null) return value;
    }
    return null;
};

export const rowText = (row: SearchRow): string =>
    Object.values(row)
        .map((value) =>
            Array.isArray(value) ? value.join(' ') : String(value ?? '')
        )
        .join(' ')
        .toLowerCase();

export const useFilteredRows = (
    rows: SearchRow[],
    filters: Record<string, string>
): SearchRow[] =>
    useMemo(() => {
        const values = Object.values(filters)
            .filter(
                (value) =>
                    value &&
                    !/^(all|any|all regions)$/i.test(value)
            )
            .map((value) => value.toLowerCase());
        if (values.length === 0) return rows;
        return rows.filter((row) => {
            const haystack = rowText(row);
            return values.every((value) => haystack.includes(value));
        });
    }, [rows, filters]);

export const sanitizeSearchValue = (value: string): string =>
    value.replace(/[^A-Za-z0-9@._:\-\s]/g, '').trim().slice(0, 128);

export const sanitizeWildcardSearchValue = (value: string): string =>
    value.replace(/[^A-Za-z0-9@._:\-\s*]/g, '').trim().slice(0, 128);
