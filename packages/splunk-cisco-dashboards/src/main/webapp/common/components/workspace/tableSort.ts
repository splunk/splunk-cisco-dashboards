/**
 * Column-sort helpers for {@link TableTile}. Detects column value kind
 * from the visible row set and compares cells for stable client-side sort.
 */

export type TableColumnSortKind = 'ip' | 'numeric' | 'date' | 'string';
export type TableSortDirection = 'asc' | 'desc';

const IP_ADDRESS_RE = /^\d{1,3}(\.\d{1,3}){3}(\/\d{1,2})?$/;
const ISO_DATE_PREFIX_RE = /^\d{4}-\d{2}-\d{2}/;
/** `_time`, or field names ending in `_time` / `_at` (case-insensitive). */
const TIME_COLUMN_RE = /(^_time$|_time$|_at$)/i;

export const isSortCellEmpty = (raw: unknown): boolean => {
    if (raw === null || raw === undefined) return true;
    if (typeof raw === 'string' && raw.trim() === '') return true;
    return false;
};

const cellString = (raw: unknown): string => {
    if (typeof raw === 'string') return raw.trim();
    if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw);
    if (typeof raw === 'boolean') return raw ? 'true' : 'false';
    return String(raw).trim();
};

const parseFiniteNumber = (raw: unknown): number | null => {
    if (typeof raw === 'number') {
        return Number.isFinite(raw) ? raw : null;
    }
    if (typeof raw === 'string') {
        const t = raw.trim();
        if (t === '') return null;
        const n = Number(t);
        return Number.isFinite(n) ? n : null;
    }
    return null;
};

const isTimeColumnName = (column: string): boolean => TIME_COLUMN_RE.test(column);

const parseSortDateMs = (raw: unknown, column: string): number | null => {
    if (typeof raw === 'number' && Number.isFinite(raw)) {
        if (!isTimeColumnName(column)) return null;
        // Epoch seconds vs millis: values before year ~33658 in ms are seconds.
        return raw < 1e12 ? raw * 1000 : raw;
    }
    const text = cellString(raw);
    if (!text) return null;
    const ms = Date.parse(text);
    return Number.isFinite(ms) ? ms : null;
};

const columnHasNonEmpty = (
    column: string,
    rows: ReadonlyArray<Record<string, unknown>>
): boolean => {
    for (const row of rows) {
        if (!isSortCellEmpty(row[column])) return true;
    }
    return false;
};

const isIpColumn = (
    column: string,
    rows: ReadonlyArray<Record<string, unknown>>
): boolean => {
    if (!columnHasNonEmpty(column, rows)) return false;
    for (const row of rows) {
        const raw = row[column];
        if (isSortCellEmpty(raw)) continue;
        if (!IP_ADDRESS_RE.test(cellString(raw))) return false;
    }
    return true;
};

const isNumericColumnForSort = (
    column: string,
    rows: ReadonlyArray<Record<string, unknown>>
): boolean => {
    if (!columnHasNonEmpty(column, rows)) return false;
    for (const row of rows) {
        const raw = row[column];
        if (isSortCellEmpty(raw)) continue;
        if (parseFiniteNumber(raw) === null) return false;
    }
    return true;
};

const isDateColumn = (
    column: string,
    rows: ReadonlyArray<Record<string, unknown>>
): boolean => {
    if (!columnHasNonEmpty(column, rows)) return false;
    const timeColumn = isTimeColumnName(column);
    for (const row of rows) {
        const raw = row[column];
        if (isSortCellEmpty(raw)) continue;
        const text = cellString(raw);
        if (!timeColumn && !ISO_DATE_PREFIX_RE.test(text)) return false;
        if (parseSortDateMs(raw, column) === null) return false;
    }
    return true;
};

/** Infer sort semantics from every non-empty value in the column. */
export const detectColumnSortKind = (
    column: string,
    rows: ReadonlyArray<Record<string, unknown>>
): TableColumnSortKind => {
    if (isIpColumn(column, rows)) return 'ip';
    if (isNumericColumnForSort(column, rows)) return 'numeric';
    if (isDateColumn(column, rows)) return 'date';
    return 'string';
};

const parseIpOctets = (value: string): number[] => {
    const host = value.split('/')[0];
    return host.split('.').map((part) => Number.parseInt(part, 10));
};

const compareIpStrings = (a: string, b: string): number => {
    const ao = parseIpOctets(a);
    const bo = parseIpOctets(b);
    for (let i = 0; i < 4; i += 1) {
        const diff = (ao[i] ?? 0) - (bo[i] ?? 0);
        if (diff !== 0) return diff;
    }
    const aCidr = a.includes('/') ? Number.parseInt(a.split('/')[1] ?? '0', 10) : 32;
    const bCidr = b.includes('/') ? Number.parseInt(b.split('/')[1] ?? '0', 10) : 32;
    return aCidr - bCidr;
};

/**
 * Compare two cell values. Null/empty cells always sort after non-empty
 * values — intentional, not a bug — regardless of asc/desc (direction is
 * applied only after this empty check in {@link sortTableRows}).
 */
export const compareSortCells = (
    aRaw: unknown,
    bRaw: unknown,
    kind: TableColumnSortKind,
    column: string
): number => {
    const aEmpty = isSortCellEmpty(aRaw);
    const bEmpty = isSortCellEmpty(bRaw);
    if (aEmpty && bEmpty) return 0;
    if (aEmpty) return 1;
    if (bEmpty) return -1;

    switch (kind) {
        case 'ip':
            return compareIpStrings(cellString(aRaw), cellString(bRaw));
        case 'numeric': {
            const aNum = parseFiniteNumber(aRaw) ?? 0;
            const bNum = parseFiniteNumber(bRaw) ?? 0;
            return aNum - bNum;
        }
        case 'date': {
            const aMs = parseSortDateMs(aRaw, column) ?? 0;
            const bMs = parseSortDateMs(bRaw, column) ?? 0;
            return aMs - bMs;
        }
        default:
            return cellString(aRaw).localeCompare(cellString(bRaw), undefined, {
                numeric: true,
                sensitivity: 'base',
            });
    }
};

/**
 * Returns a new sorted array (does not mutate `rows`). Uses stable tie-break
 * on original index when cell values compare equal.
 */
export const sortTableRows = (
    rows: ReadonlyArray<Record<string, unknown>>,
    column: string,
    direction: TableSortDirection,
    kind: TableColumnSortKind
): Array<Record<string, unknown>> => {
    const indexed = rows.map((row, index) => ({ row, index }));
    indexed.sort((a, b) => {
        let cmp = compareSortCells(a.row[column], b.row[column], kind, column);
        if (direction === 'desc') cmp = -cmp;
        return cmp || a.index - b.index;
    });
    return indexed.map(({ row }) => row);
};
