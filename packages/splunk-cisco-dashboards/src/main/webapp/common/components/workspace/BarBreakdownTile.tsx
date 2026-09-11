/**
 * BarBreakdownTile — categorical horizontal-bar tile.
 *
 * Sibling of {@link MetricItem} (sparkline) and {@link TableTile}
 * (multi-row table). Used when the underlying searchbase stanza
 * declares `default_viz = splunk.bar` and the search returns a small
 * categorical distribution (e.g. `| stats count by severity`). The
 * tile renders the rows as a tight horizontal bar list inside the
 * same outer chrome as MetricItem, so a section can mix sparkline
 * and bar-breakdown tiles without visual fracture.
 *
 * Design notes:
 *  - Headline = sum across all rows (the "total" the operator
 *    reaches for first), so the tile retains the single-glance
 *    headline experience of MetricItem.
 *  - Each row = one severity (or whatever the dimension column is).
 *    Bar width is proportional to the row's value over the max value
 *    in the result set, NOT the total — bars at the same scale are
 *    easier to compare than bars normalised to the sum.
 *  - Color is driven by the dimension label (severity-aware: red
 *    for critical, orange for high, …). Falls back to a neutral
 *    sky tone for unknown dimensions so this tile can be used for
 *    breakdowns other than severity.
 *  - Up to 5 rows display; anything beyond that becomes "+N more"
 *    captioned at the bottom (matches TableTile's row-cap idiom).
 *
 * The component is dumb: it accepts pre-resolved rows/columns from
 * {@link useTableData} (same shape as TableTile) and just paints
 * them. All dispatch and column-derivation logic lives in the hook.
 */

import React, { useMemo, useState } from "react";
import { ChartFocusDialog } from "./ChartFocusDialog";
import { InfoTooltip, type InfoTooltipAnchor } from "./InfoTooltip";
import { TileActionMenu, TileDrilldownButton } from "./TileActionMenu";
import { cn } from "@/common/lib/utils";
import { formatCompactMetricNumber } from "@/common/lib/metricValueFormat";
import type { DataSource, NoDataReason } from "@/common/hooks/useMetric";

interface BarBreakdownTileProps {
  label: string;
  subLabel?: string;
  description?: string;
  descriptionFootnote?: string;
  /** Forwarded to the info tooltip's THRESHOLDS section. */
  thresholdNote?: string;
  infoAnchor?: InfoTooltipAnchor;
  /** Rows from `useTableData`, already capped to a sensible limit. */
  rows: ReadonlyArray<Record<string, unknown>>;
  /** Visible columns in SPL emission order (first = dimension, second = numeric). */
  columns: ReadonlyArray<string>;
  source?: DataSource;
  onOpenInSearch?: () => void;
  openInSearchHref?: string;
  searchbaseId?: string;
  onOpenDetailTable?: () => void;
  detailTableTitle?: string;
  onConfigure?: () => void;
  isCustomized?: boolean;
  noDataReason?: NoDataReason;
  rangeLabel?: string;
  /** Maximum number of bars rendered. Anything beyond is captioned. */
  visibleRowCap?: number;
  className?: string;
}

const DEFAULT_VISIBLE_ROW_CAP = 5;

/**
 * Severity priority used to order the bars left-to-right (or top-to-
 * bottom in the horizontal layout). Lower index = higher visual
 * priority. Anything not in this list lands at the bottom in
 * search-order. Keeping the list lower-cased and using
 * `dimensionPriority` to look up case-insensitively means TE orgs
 * that emit "Critical" / "CRITICAL" / "critical" all land in the
 * same slot.
 *
 * The Cisco_ThousandEyes data model emits CRITICAL/MAJOR/MINOR/INFO;
 * legacy / non-TE sources still use the high/medium/low/warning
 * vocabulary, so both vocabularies are mapped here.
 */
const SEVERITY_PRIORITY: Record<string, number> = {
  critical: 0,
  error: 0,
  major: 1,
  high: 1,
  warning: 2,
  medium: 2,
  minor: 2,
  moderate: 2,
  low: 3,
  notice: 4,
  info: 4,
  informational: 4,
};

/**
 * Severity-aware bar colors. Lower-cased substring match against the
 * dimension value so "Critical (P1)" and "critical" both light up red.
 * Order matters: more specific terms win over generic ones. MAJOR/MINOR
 * are the Cisco_ThousandEyes enum equivalents of high/medium.
 */
const SEVERITY_COLOR_MAP: Array<{ match: RegExp; tw: string }> = [
  { match: /critical|fatal|p1\b/i, tw: "bg-rose-500" },
  { match: /error|high|major|p2\b/i, tw: "bg-orange-500" },
  { match: /warn|medium|moderate|minor|p3\b/i, tw: "bg-amber-500" },
  { match: /low|p4\b/i, tw: "bg-yellow-500" },
  { match: /notice|info|p5\b/i, tw: "bg-emerald-500" },
];

const FALLBACK_COLOR_TW = "bg-sky-500";

const colorForLabel = (label: string): string => {
  if (typeof label !== "string" || label.length === 0) return FALLBACK_COLOR_TW;
  for (const entry of SEVERITY_COLOR_MAP) {
    if (entry.match.test(label)) return entry.tw;
  }
  return FALLBACK_COLOR_TW;
};

const dimensionPriority = (label: string): number => {
  if (typeof label !== "string") return 99;
  return SEVERITY_PRIORITY[label.trim().toLowerCase()] ?? 99;
};

const coerceNumber = (raw: unknown): number => {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const n = Number(raw.trim());
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

const formatCount = (n: number): string => formatCompactMetricNumber(n);

const NoDataState: React.FC<{
  noDataReason?: NoDataReason;
  rangeLabel?: string;
  source?: DataSource;
}> = ({ noDataReason, rangeLabel, source }) => {
  let subtext: string;
  if (source === "loading") {
    subtext = "loading…";
  } else if (noDataReason === "error") {
    subtext = "search failed";
  } else if (noDataReason === "empty_rows") {
    subtext = rangeLabel
      ? `0 rows · ${rangeLabel.toLowerCase()}`
      : "0 rows returned";
  } else {
    subtext = rangeLabel ? `no data · ${rangeLabel.toLowerCase()}` : "no data";
  }
  return (
    <div className="flex flex-col items-start mb-1">
      <span className="text-4xl font-black tracking-tighter leading-none  sui-color-muted">
        —
      </span>
      <span className="text-xs font-medium  sui-color-muted mt-0.5 leading-tight">
        {subtext}
      </span>
    </div>
  );
};

export const BarBreakdownTile: React.FC<BarBreakdownTileProps> = ({
  label,
  subLabel,
  description,
  descriptionFootnote,
  thresholdNote,
  infoAnchor = "auto",
  rows,
  columns,
  source,
  onOpenInSearch,
  openInSearchHref,
  searchbaseId,
  onOpenDetailTable,
  detailTableTitle,
  onConfigure,
  isCustomized = false,
  noDataReason,
  rangeLabel,
  visibleRowCap = DEFAULT_VISIBLE_ROW_CAP,
  className,
}) => {
  const [isFocusOpen, setIsFocusOpen] = useState(false);
  // First column = dimension (severity), second column = numeric
  // count. We don't try to be smart about which numeric column to
  // pick because the bar tile is single-series by design — the
  // catalogue stanza is responsible for emitting `<dimension>,
  // <count>` in that order. If a caller binds a wider table here,
  // the extra columns are simply ignored.
  const dimensionCol = columns[0];
  const valueCol = columns[1];

  const aggregated = useMemo(() => {
    if (!dimensionCol || !valueCol) {
      return {
        entries: [] as Array<{ key: string; value: number }>,
        total: 0,
        max: 0,
      };
    }
    const buckets = new Map<string, number>();
    for (const r of rows) {
      const dimRaw = r[dimensionCol];
      const valRaw = r[valueCol];
      const key =
        typeof dimRaw === "string"
          ? dimRaw.trim()
          : dimRaw === null || dimRaw === undefined
            ? ""
            : String(dimRaw);
      if (key === "") continue;
      buckets.set(key, (buckets.get(key) ?? 0) + coerceNumber(valRaw));
    }
    const entries = Array.from(buckets.entries()).map(([key, value]) => ({
      key,
      value,
    }));
    // Stable order: severity priority first, then descending count
    // for ties / unknown dimensions.
    entries.sort((a, b) => {
      const pa = dimensionPriority(a.key);
      const pb = dimensionPriority(b.key);
      if (pa !== pb) return pa - pb;
      return b.value - a.value;
    });
    const total = entries.reduce((acc, e) => acc + e.value, 0);
    const max = entries.reduce((acc, e) => Math.max(acc, e.value), 0);
    return { entries, total, max };
  }, [rows, dimensionCol, valueCol]);

  const visibleEntries = aggregated.entries.slice(0, visibleRowCap);
  const overflowCount = Math.max(
    0,
    aggregated.entries.length - visibleEntries.length,
  );
  const focusEntries = aggregated.entries.slice(0, Math.max(visibleRowCap, 12));
  const focusOverflowCount = Math.max(
    0,
    aggregated.entries.length - focusEntries.length,
  );
  const hasData = aggregated.entries.length > 0;

  return (
    <div
      className={cn(
        "flex flex-col flex-1 basis-0 min-w-[140px] px-1.5 py-1 relative",
        className,
      )}
    >
      {source && (
        <span
          className={cn(
            "absolute top-1 right-2 w-1.5 h-1.5 rounded-full",
            source === "live"
              ? "sui-bg-positive"
              : source === "loading"
                ? "sui-bg-warning animate-pulse"
                : "sui-bg-floating",
          )}
          title={
            source === "live"
              ? "Wired to saved search (live)"
              : source === "loading"
                ? "Loading saved search…"
                : "No saved search assigned"
          }
        />
      )}

      <div
        // `data-tile-control` so the title/header row
        // suppresses the SortableMetricCard drag handle
        // while the cursor is over the tile name. See
        // the matching block in MetricItem.tsx for the
        // full rationale (label-clip from the grip chip
        // at top-0.5 left-0.5).
        data-tile-control="true"
        className="flex flex-col mb-0.5"
      >
        <span className="sui-color-default font-bold sui-color-active tracking-tight leading-tight flex items-center gap-1">
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
            <TileDrilldownButton
              label={label}
              onOpenDetailTable={onOpenDetailTable}
              detailTableTitle={detailTableTitle}
            />
              <TileActionMenu
                label={label}
                openInSearchHref={openInSearchHref}
                onOpenInSearch={onOpenInSearch}
              searchbaseId={searchbaseId}
              onExpand={hasData ? () => setIsFocusOpen(true) : undefined}
              onConfigure={onConfigure}
              isCustomized={isCustomized}
            />
          </span>
        </span>
        {subLabel && (
          <span className="sui-color-default  sui-color-muted font-medium tracking-tight leading-tight line-clamp-1 min-h-[12px]">
            {subLabel}
          </span>
        )}
      </div>

      {hasData ? (
        <div
          role="img"
          aria-label={`${label} bar chart. Total ${formatCount(
            aggregated.total,
          )}.`}
          title="Category values are shown beside each bar"
          data-tile-control="true"
          className="mt-0.5 flex min-h-[116px] max-h-36 flex-1 flex-col p-1"
        >
          {/* Headline = sum across all rows. Same big-number
                        shape as MetricItem so a row of mixed sparkline
                        and bar-breakdown tiles aligns vertically. The
                        sum-to-headline mapping deliberately ignores
                        the visibleRowCap, so when the cap kicks in the
                        headline still reflects the full result set. */}
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-4xl font-black tracking-tighter leading-none  sui-color-active">
              {formatCount(aggregated.total)}
            </span>
          </div>

          {/* Bar list. flex-1 + min-h-[72px] + max-h-28 so
                        the row of bars consumes the same slot as the
                        sparkline canvas in MetricItem; tighter mt/pt
                        than MetricItem because horizontal bars don't
                        need the visual breathing room a sparkline
                        peak-label needs. overflow-hidden contains
                        any content beyond the slot at the local
                        boundary. `data-tile-control` so hovering
                        over a bar (to read its title tooltip)
                        suppresses the SortableMetricCard drag
                        handle just like the sparkline canvas does. */}
          <div
            data-tile-control="true"
            className="flex-1 min-h-[72px] mt-1 pt-0.5 overflow-hidden flex flex-col gap-1"
          >
            {visibleEntries.map((entry) => {
              const widthPct =
                aggregated.max > 0
                  ? Math.max(2, (entry.value / aggregated.max) * 100)
                  : 0;
              return (
                <div
                  key={entry.key}
                  className="flex items-center gap-1.5 text-xs leading-tight"
                  title={`${entry.key}: ${formatCount(entry.value)}`}
                >
                  <span className="w-14 truncate  sui-color-default font-medium capitalize">
                    {entry.key}
                  </span>
                  <div className="flex-1 min-w-0 h-2  sui-bg-popup rounded-sm overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-sm",
                        colorForLabel(entry.key),
                      )}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                  <span className="w-8 text-right  sui-color-active font-semibold tabular-nums">
                    {formatCount(entry.value)}
                  </span>
                </div>
              );
            })}
            {overflowCount > 0 && (
              <span className="text-xs  sui-color-muted italic">
                +{overflowCount} more
              </span>
            )}
          </div>
        </div>
      ) : (
        <NoDataState
          noDataReason={noDataReason}
          rangeLabel={rangeLabel}
          source={source}
        />
      )}

      <ChartFocusDialog
        isOpen={isFocusOpen && hasData}
        label={label}
        subLabel={subLabel}
        onClose={() => setIsFocusOpen(false)}
        onOpenInSearch={onOpenInSearch}
        onOpenDetailTable={onOpenDetailTable}
        detailTableTitle={detailTableTitle}
      >
        <div
          role="img"
          aria-label={`Expanded ${label} bar chart. Total ${formatCount(
            aggregated.total,
          )}.`}
          className="flex h-full min-h-[320px] flex-col rounded-[10px] border sui-border-default sui-bg-section p-5"
        >
          <span className="text-5xl font-black tracking-tighter leading-none sui-color-active">
            {formatCount(aggregated.total)}
          </span>
          <div className="mt-7 flex flex-1 flex-col gap-4 overflow-y-auto">
            {focusEntries.map((entry) => {
              const widthPct =
                aggregated.max > 0
                  ? Math.max(2, (entry.value / aggregated.max) * 100)
                  : 0;
              return (
                <div
                  key={entry.key}
                  className="flex items-center gap-3 text-sm leading-tight"
                >
                  <span className="w-40 truncate font-semibold capitalize sui-color-default">
                    {entry.key}
                  </span>
                  <div className="h-5 min-w-0 flex-1 overflow-hidden rounded sui-bg-popup">
                    <div
                      className={cn("h-full rounded", colorForLabel(entry.key))}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                  <span className="w-20 text-right font-bold tabular-nums sui-color-active">
                    {formatCount(entry.value)}
                  </span>
                </div>
              );
            })}
            {focusOverflowCount > 0 && (
              <span className="text-xs italic sui-color-muted">
                +{focusOverflowCount} more
              </span>
            )}
          </div>
        </div>
      </ChartFocusDialog>
    </div>
  );
};
