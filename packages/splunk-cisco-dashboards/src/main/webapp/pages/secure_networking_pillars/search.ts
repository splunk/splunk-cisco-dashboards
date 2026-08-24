import { useEffect, useMemo, useState } from 'react';

import {
    getSearchbaseCatalogue,
    type SearchbaseRecord,
} from '@/common/services/searchbaseCatalogue';
import {
    isAbortError,
    runSearch,
} from '@/common/services/splunkSearchService';

import type { PillarTimeRange } from './config';

export type PillarSearchRow = Record<string, unknown>;

export interface PillarCatalogueState {
    byIdentity: Map<string, SearchbaseRecord> | null;
    error: string | null;
}

export interface PillarSearchState {
    record: SearchbaseRecord | null;
    rows: PillarSearchRow[];
    loading: boolean;
    error: string | null;
}

export const usePillarCatalogue = (refreshToken = 0): PillarCatalogueState => {
    const [records, setRecords] = useState<SearchbaseRecord[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setRecords(null);
        setError(null);

        getSearchbaseCatalogue({ includeHidden: true })
            .then((nextRecords) => {
                if (cancelled) return;
                setRecords(nextRecords);
                setError(null);
            })
            .catch(() => {
                if (cancelled) return;
                setRecords([]);
                setError('The Searchbase catalogue could not be loaded.');
            });

        return () => {
            cancelled = true;
        };
    }, [refreshToken]);

    const byIdentity = useMemo(() => {
        if (!records) return null;
        const identities = new Map<string, SearchbaseRecord>();
        records.forEach((record) => {
            identities.set(record.id, record);
            if (!identities.has(record.searchName)) {
                identities.set(record.searchName, record);
            }
        });
        return identities;
    }, [records]);

    return { byIdentity, error };
};

interface UsePillarSearchArgs {
    catalogue: Map<string, SearchbaseRecord> | null;
    searchId: string;
    range: PillarTimeRange;
    refreshToken: number;
    enabled?: boolean;
    count?: number;
    zeroOnlyIsEmpty?: boolean;
}

export const usePillarSearch = ({
    catalogue,
    searchId,
    range,
    refreshToken,
    enabled = true,
    count = 1000,
    zeroOnlyIsEmpty = false,
}: UsePillarSearchArgs): PillarSearchState => {
    const record = catalogue?.get(searchId) ?? null;
    const [state, setState] = useState<Omit<PillarSearchState, 'record'>>({
        rows: [],
        loading: true,
        error: null,
    });

    useEffect(() => {
        if (!enabled) {
            setState({ rows: [], loading: false, error: null });
            return undefined;
        }
        if (!catalogue) {
            setState({ rows: [], loading: true, error: null });
            return undefined;
        }
        if (!record?.search) {
            setState({
                rows: [],
                loading: false,
                error: `Searchbase stanza "${searchId}" is unavailable.`,
            });
            return undefined;
        }

        const controller = new AbortController();
        setState((current) => ({ ...current, loading: true, error: null }));

        runSearch({
            spl: record.search,
            earliestTime: range.earliest,
            latestTime: range.latest,
            appContext: record.dispatchContext,
            tag: `react-pillar:${searchId}`,
            count,
            signal: controller.signal,
        })
            .then((response) => {
                if (controller.signal.aborted) return;
                if (response?.cachedFailure) {
                    setState({
                        rows: [],
                        loading: false,
                        error: 'This search is unavailable after an earlier dispatch failure.',
                    });
                    return;
                }
                const responseRows = Array.isArray(response?.results)
                    ? response.results.map((result) => result as PillarSearchRow)
                    : [];
                setState({
                    rows: normalizePillarRows(responseRows, { zeroOnlyIsEmpty }),
                    loading: false,
                    error: null,
                });
            })
            .catch((searchError: unknown) => {
                if (controller.signal.aborted || isAbortError(searchError)) return;
                setState({
                    rows: [],
                    loading: false,
                    error: 'This search could not be completed.',
                });
            });

        return () => controller.abort();
    }, [
        catalogue,
        count,
        range.earliest,
        range.latest,
        record,
        refreshToken,
        searchId,
        enabled,
        zeroOnlyIsEmpty,
    ]);

    return { record, ...state };
};

export const toFiniteNumber = (value: unknown): number | null => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value !== 'string') return null;
    const normalized = value.replace(/[,%$\s]/g, '').trim();
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
};

const NO_DATA_MARKER =
    /(?:no matching (?:telemetry|data|evidence|events|results)|no denied or fraud|no [^.!]{0,80} telemetry (?:was )?found|^(?:no telemetry|no data)$|no reporting devices|no non-default sgt activity|no attributed zero-coverage sites|no tagged authentication activity)/i;

export const isPillarNoDataRow = (row: PillarSearchRow): boolean =>
    [...Object.keys(row), ...Object.values(row)].some(
        (value) => typeof value === 'string' && NO_DATA_MARKER.test(value)
    );

const isZeroOnlyResult = (rows: readonly PillarSearchRow[]): boolean => {
    if (rows.length === 0) return false;
    const numericValues = rows.flatMap((row) =>
        Object.entries(row)
            .filter(([field]) => field !== '_time')
            .map(([, value]) => toFiniteNumber(value))
            .filter((value): value is number => value !== null)
    );
    return numericValues.length > 0 && numericValues.every((value) => value === 0);
};

export const normalizePillarRows = (
    rows: readonly PillarSearchRow[],
    { zeroOnlyIsEmpty = false }: { zeroOnlyIsEmpty?: boolean } = {}
): PillarSearchRow[] => {
    const withoutMarkers = rows.filter((row) => !isPillarNoDataRow(row));
    if (zeroOnlyIsEmpty && isZeroOnlyResult(withoutMarkers)) return [];
    return withoutMarkers;
};

export const lastFiniteValue = (
    rows: readonly PillarSearchRow[],
    field: string
): number | null => {
    for (let index = rows.length - 1; index >= 0; index -= 1) {
        const value = toFiniteNumber(rows[index]?.[field]);
        if (value !== null) return value;
    }
    return null;
};

export const lastTwoFiniteValues = (
    rows: readonly PillarSearchRow[],
    field: string
): readonly [number, number] | null => {
    const values: number[] = [];
    for (let index = rows.length - 1; index >= 0 && values.length < 2; index -= 1) {
        const value = toFiniteNumber(rows[index]?.[field]);
        if (value !== null) values.push(value);
    }
    return values.length === 2 ? [values[0], values[1]] : null;
};

export const visibleColumns = (rows: readonly PillarSearchRow[]): string[] => {
    const seen = new Set<string>();
    const columns: string[] = [];
    rows.forEach((row) => {
        Object.keys(row).forEach((column) => {
            if (column.startsWith('_') || seen.has(column)) return;
            seen.add(column);
            columns.push(column);
        });
    });
    return columns;
};
