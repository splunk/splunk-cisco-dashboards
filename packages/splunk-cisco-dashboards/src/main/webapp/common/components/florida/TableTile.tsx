/**
 * TableTile — categorical row-shaped tile.
 *
 * Sibling of {@link MetricItem}. Used when the underlying searchbase
 * stanza declares `default_viz = splunk.table`, where the search returns
 * a multi-row distribution (e.g. `| stats count by name`) that has no
 * meaningful single-value/sparkline projection. The tile renders the
 * rows as a tight categorical table while preserving the same outer
 * chrome (label, info tooltip, Open-in-Search, gear) so dashboards mix
 * sparkline tiles and table tiles without visual fracture.
 *
 * The component is intentionally dumb: it accepts pre-resolved rows +
 * columns from {@link useTableData} and just paints them. All dispatch,
 * column derivation, and row-cap logic lives in the hook.
 */

import React from 'react';
import { ExternalLink, Settings2 } from 'lucide-react';
import { InfoTooltip, type InfoTooltipAnchor } from './InfoTooltip';
import { cn } from '@/common/lib/utils';
import type {
    DataSource,
    NoDataReason,
} from '@/common/hooks/useMetric';

interface TableTileProps {
    label: string;
    subLabel?: string;
    description?: string;
    descriptionFootnote?: string;
    /**
     * Forwarded to the info tooltip's THRESHOLDS section. Tables
     * generally have no numeric thresholds, but the parent may still
     * pass a `thresholdNote` (e.g. "Browse the rows; no fixed
     * threshold") so every Cisco-tagged tile answers "what counts as
     * good?" consistently.
     */
    thresholdNote?: string;
    infoAnchor?: InfoTooltipAnchor;
    /** Rows already capped to the visible row-limit by the hook. */
    rows: ReadonlyArray<Record<string, unknown>>;
    /** Visible columns in SPL emission order, internal `_*` fields excluded. */
    columns: ReadonlyArray<string>;
    /** Total row count BEFORE the row-cap was applied (for the truncation caption). */
    totalRowCount?: number;
    source?: DataSource;
    onOpenInSearch?: () => void;
    onConfigure?: () => void;
    isCustomized?: boolean;
    noDataReason?: NoDataReason;
    rangeLabel?: string;
    /**
     * Vertical row cap before the body becomes scrollable. Defaults to
     * 5 — matches the metric-tile vertical footprint so a row of mixed
     * sparkline + table tiles aligns cleanly.
     */
    visibleRowCap?: number;
    className?: string;
}

const DEFAULT_VISIBLE_ROW_CAP = 5;
// 22px row × 5 rows + 22px sticky header ≈ 132px, which matches the
// 28px headline + 112px sparkline footprint of MetricItem to within a
// pixel. Don't change without re-aligning MetricItem.
const ROW_HEIGHT_PX = 22;
const HEADER_HEIGHT_PX = 22;

const formatCellValue = (raw: unknown): string => {
    if (raw === null || raw === undefined) return '—';
    if (typeof raw === 'number') {
        if (!Number.isFinite(raw)) return '—';
        // Tabular numbers + locale formatting matches the rest of the
        // dashboard's number conventions (1,234 instead of 1234).
        return raw.toLocaleString(undefined, { maximumFractionDigits: 2 });
    }
    if (typeof raw === 'string') return raw;
    if (typeof raw === 'boolean') return raw ? 'true' : 'false';
    try {
        return JSON.stringify(raw);
    } catch {
        return String(raw);
    }
};

const looksNumeric = (raw: unknown): boolean => {
    if (typeof raw === 'number') return Number.isFinite(raw);
    if (typeof raw === 'string') {
        const t = raw.trim();
        if (t === '') return false;
        return Number.isFinite(Number(t));
    }
    return false;
};

const isNumericColumn = (
    column: string,
    rows: ReadonlyArray<Record<string, unknown>>
): boolean => {
    // Treat a column as numeric only if every non-blank row value
    // parses as a finite number. Mixed columns ("ok"/"42") are left
    // text-aligned to keep the table readable.
    let saw = false;
    for (const r of rows) {
        const v = r[column];
        if (v === null || v === undefined || v === '') continue;
        if (!looksNumeric(v)) return false;
        saw = true;
    }
    return saw;
};

const NoDataState: React.FC<{
    noDataReason?: NoDataReason;
    rangeLabel?: string;
    source?: DataSource;
}> = ({ noDataReason, rangeLabel, source }) => {
    let subtext: string;
    if (source === 'loading') {
        subtext = 'loading…';
    } else if (noDataReason === 'error') {
        subtext = 'search failed';
    } else if (noDataReason === 'empty_rows') {
        subtext = rangeLabel
            ? `0 rows · ${rangeLabel.toLowerCase()}`
            : '0 rows returned';
    } else if (noDataReason === 'no_numeric_column') {
        subtext = 'no usable columns';
    } else if (noDataReason === 'column_missing') {
        subtext = 'value field not emitted by search';
    } else {
        subtext = rangeLabel
            ? `no data · ${rangeLabel.toLowerCase()}`
            : 'no data';
    }
    return (
        <div className="flex flex-col items-start mb-1">
            <span className="text-2xl font-black tracking-tighter leading-none text-slate-400 dark:text-slate-500">
                —
            </span>
            <span className="text-[9px] font-medium text-slate-400 dark:text-slate-500 mt-0.5 leading-tight">
                {subtext}
            </span>
        </div>
    );
};

export const TableTile: React.FC<TableTileProps> = ({
    label,
    subLabel,
    description,
    descriptionFootnote,
    thresholdNote,
    infoAnchor = 'auto',
    rows,
    columns,
    totalRowCount,
    source,
    onOpenInSearch,
    onConfigure,
    isCustomized = false,
    noDataReason,
    rangeLabel,
    visibleRowCap = DEFAULT_VISIBLE_ROW_CAP,
    className,
}) => {
    const hasRows = rows.length > 0 && columns.length > 0;
    const numericColumnFlags = React.useMemo(
        () => columns.map((c) => isNumericColumn(c, rows)),
        [columns, rows]
    );
    const reportedTotal = totalRowCount ?? rows.length;
    const truncated = reportedTotal > rows.length;
    // Body height matches MetricItem (headline 28px + spark 112px ≈ 140px)
    // so a section of mixed tile types stays vertically aligned.
    const bodyHeightPx = visibleRowCap * ROW_HEIGHT_PX + HEADER_HEIGHT_PX;

    return (
        // min-w bumped to 180px (vs 108px on MetricItem): a single-column
        // table is only useful when the dimension column is wide enough
        // to read. Wider tile minimum still expands via flex-1/basis-0
        // when the section has horizontal slack.
        <div
            className={cn(
                'flex flex-col flex-1 basis-0 min-w-[180px] px-1.5 py-1 relative',
                className
            )}
        >
            {source && (
                <span
                    className={cn(
                        'absolute top-1 right-2 w-1.5 h-1.5 rounded-full',
                        source === 'live'
                            ? 'bg-emerald-500'
                            : source === 'loading'
                            ? 'bg-amber-400 animate-pulse'
                            : 'bg-slate-300'
                    )}
                    title={
                        source === 'live'
                            ? 'Wired to saved search (live)'
                            : source === 'loading'
                            ? 'Loading saved search…'
                            : 'No saved search assigned'
                    }
                />
            )}

            <div className="flex flex-col mb-1">
                <span className="text-[12px] font-bold text-slate-800 dark:text-slate-100 tracking-tight leading-tight uppercase flex items-center gap-1">
                    <span className="flex items-center gap-1 min-w-0 truncate">
                        {label}
                    </span>
                    <span className="ml-auto flex items-center gap-0.5 flex-shrink-0">
                        {description && (
                            <InfoTooltip
                                title={label}
                                description={description}
                                thresholdNote={thresholdNote}
                                footnote={descriptionFootnote}
                                anchor={infoAnchor}
                                iconAriaLabel={`What does ${label} measure?`}
                            />
                        )}
                        {onOpenInSearch && (
                            <button
                                type="button"
                                onClick={onOpenInSearch}
                                title="Open in Search"
                                aria-label={`Open ${label} in Search`}
                                data-tile-control="true"
                                className="p-0.5 -my-0.5 text-slate-300 dark:text-slate-500 hover:text-sky-600 dark:hover:text-sky-300 transition-colors rounded focus:outline-none focus:ring-1 focus:ring-sky-400"
                            >
                                <ExternalLink className="w-3 h-3 stroke-[2.5px]" />
                            </button>
                        )}
                        {onConfigure && (
                            <button
                                type="button"
                                onClick={onConfigure}
                                title={
                                    isCustomized
                                        ? `Configure ${label} (customised)`
                                        : `Configure ${label}`
                                }
                                aria-label={`Configure ${label} tile`}
                                data-tile-control="true"
                                className="p-0.5 -my-0.5 text-slate-300 dark:text-slate-500 hover:text-sky-600 dark:hover:text-sky-300 transition-colors rounded focus:outline-none focus:ring-1 focus:ring-sky-400 relative"
                            >
                                <Settings2 className="w-3 h-3 stroke-[2.5px]" />
                                {isCustomized && (
                                    <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-sky-500 border border-white dark:border-slate-900" />
                                )}
                            </button>
                        )}
                    </span>
                </span>
                {subLabel && (
                    <span className="text-[9.5px] text-slate-400 dark:text-slate-500 font-medium tracking-tight leading-tight line-clamp-1 min-h-[12px]">
                        {subLabel}
                    </span>
                )}
            </div>

            {!hasRows ? (
                <NoDataState
                    noDataReason={noDataReason}
                    rangeLabel={rangeLabel}
                    source={source}
                />
            ) : (
                <div className="flex flex-col">
                    <div
                        // `data-tile-control` so the table body
                        // suppresses the SortableMetricCard drag
                        // handle while the user is reading rows
                        // (hovering rows is content-reading
                        // intent, not drag intent).
                        data-tile-control="true"
                        className="overflow-y-auto overflow-x-auto rounded border border-slate-200/60 dark:border-slate-700/60"
                        style={{ maxHeight: `${bodyHeightPx}px` }}
                    >
                        <table className="w-full text-[11px] leading-tight border-collapse">
                            <thead className="bg-slate-50/80 dark:bg-slate-800/40 sticky top-0 z-10">
                                <tr>
                                    {columns.map((col, idx) => (
                                        <th
                                            key={col}
                                            className={cn(
                                                'px-2 py-1 font-semibold text-[9px] uppercase tracking-wide text-slate-500 dark:text-slate-400 whitespace-nowrap border-b border-slate-200 dark:border-slate-700',
                                                numericColumnFlags[idx]
                                                    ? 'text-right'
                                                    : 'text-left'
                                            )}
                                        >
                                            {col}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row, rowIdx) => (
                                    <tr
                                        key={rowIdx}
                                        className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                                    >
                                        {columns.map((col, colIdx) => {
                                            const raw = row[col];
                                            const numeric = numericColumnFlags[colIdx];
                                            const display = formatCellValue(raw);
                                            return (
                                                <td
                                                    key={col}
                                                    className={cn(
                                                        'px-2 py-1 text-slate-700 dark:text-slate-300 max-w-[160px] overflow-hidden text-ellipsis whitespace-nowrap',
                                                        numeric
                                                            ? 'text-right tabular-nums font-medium'
                                                            : 'text-left'
                                                    )}
                                                    title={display}
                                                >
                                                    {display}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="flex items-baseline justify-between text-[9px] text-slate-400 dark:text-slate-500 mt-1 px-1 leading-tight">
                        <span className="tabular-nums">
                            {truncated
                                ? `${rows.length} of ${reportedTotal} rows`
                                : `${rows.length} ${
                                      rows.length === 1 ? 'row' : 'rows'
                                  }`}
                        </span>
                        {rangeLabel && (
                            <span className="truncate ml-2">{rangeLabel.toLowerCase()}</span>
                        )}
                    </div>
                </div>
            )}
            <div className="flex-1 min-h-0" aria-hidden="true" />
        </div>
    );
};
