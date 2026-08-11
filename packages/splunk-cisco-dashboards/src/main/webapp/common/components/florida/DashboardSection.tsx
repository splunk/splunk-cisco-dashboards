import React from "react";
import Badge from "@splunk/react-ui/Badge";
import { variables } from "@splunk/themes";
import {
  ChevronDown,
  ChevronRight,
  ArrowUpRight,
  ArrowUpDown,
  Maximize2,
  Minimize2,
  Minus,
  Pencil,
  Plus,
} from "@/common/icons/SuiIcon";
import { cn } from "@/common/lib/utils";
import { C3_VISUALIZATION_COLORS } from "@/common/theme/c3VisualizationPalette";

interface TileCountControlConfig {
  /** Currently visible tile count. */
  value: number;
  /** Lower bound (inclusive). Buttons disable when value === min. */
  min: number;
  /** Upper bound (inclusive). Buttons disable when value === max. */
  max: number;
  /** Called with the new count after clicking − or +. Caller is responsible
   *  for clamping; the pill will not invoke onChange when at a bound. */
  onChange: (next: number) => void;
  /** Optional aria/title prefix, e.g. "IT Health tiles". Defaults to "Tiles". */
  label?: string;
}

interface HeightControlConfig {
  /** Current height level. */
  value: number;
  /** Lower bound (inclusive). Buttons disable when value === min. */
  min: number;
  /** Upper bound (inclusive). Buttons disable when value === max. */
  max: number;
  /** Called with the new height level. */
  onChange: (next: number) => void;
  /** Optional aria/title prefix, e.g. "IT Health height". */
  label?: string;
}

interface HeaderActionConfig {
  onClick: () => void;
  label: string;
  title?: string;
  disabled?: boolean;
}

interface CollapsedSummaryConfig {
  kpiCount: number;
  healthyCount: number;
  warningCount: number;
  criticalCount: number;
  unknownCount: number;
}

interface DashboardSectionProps {
  title: string;
  linkText: string;
  /**
   * Splunk view name (without app prefix). Resolved relative to the
   * current app, so {href: 'netops_critical_systems_health'} navigates to
   * `/<locale>/app/splunk-cisco-dashboards/netops_critical_systems_health`. If omitted
   * the link is non-interactive.
   */
  href?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /**
   * When provided, renders a small `−  N  +` pill at the right of
   * the section header so the user can dial the visible tile count
   * up or down. Omit to suppress the control entirely (legacy
   * callers continue to work unchanged).
   */
  tileCount?: TileCountControlConfig;
  /**
   * When provided, renders a compact height control so the user can
   * give a section more vertical chart room without changing how
   * many tiles are visible.
   */
  height?: HeightControlConfig;
  /** True when a dense tile section should flow into multiple rows. */
  wrapTiles?: boolean;
  /** True when the section is at H1 and should use the compact chart floor. */
  compactHeight?: boolean;
  /** Optional section-level action rendered as a compact icon button. */
  addTileAction?: HeaderActionConfig;
  onEditTitle?: () => void;
  /** Collapses only the body; children stay mounted to preserve live searches. */
  collapsed?: boolean;
  /** True while this section owns the metrics pane's focused presentation. */
  focused?: boolean;
  /** Compact KPI/status summary shown while the section is collapsed. */
  collapsedSummary?: CollapsedSummaryConfig;
  onToggleCollapsed?: () => void;
  onToggleFocus?: () => void;
}

type SummaryTone = "info" | "healthy" | "warning" | "critical";
type BadgeBackground = NonNullable<
  React.ComponentProps<typeof Badge>["backgroundColor"]
>;

const SUMMARY_BADGE_COLOR: Record<SummaryTone, string> = {
  info: C3_VISUALIZATION_COLORS.info,
  healthy: C3_VISUALIZATION_COLORS.positive,
  warning: C3_VISUALIZATION_COLORS.caution,
  critical: C3_VISUALIZATION_COLORS.critical,
};

const SUMMARY_BADGE_BACKGROUND: Record<SummaryTone, BadgeBackground> = {
  info: `color-mix(in srgb, ${SUMMARY_BADGE_COLOR.info} 28%, transparent)`,
  healthy: `color-mix(in srgb, ${SUMMARY_BADGE_COLOR.healthy} 50%, transparent)`,
  warning: `color-mix(in srgb, ${SUMMARY_BADGE_COLOR.warning} 50%, transparent)`,
  critical: `color-mix(in srgb, ${SUMMARY_BADGE_COLOR.critical} 50%, transparent)`,
};

const CollapsedSummaryBadges: React.FC<CollapsedSummaryConfig> = ({
  kpiCount,
  healthyCount,
  warningCount,
  criticalCount,
  unknownCount,
}) => {
  const items: Array<{ label: string; tone: SummaryTone }> = [
    {
      label: `${kpiCount} KPI${kpiCount === 1 ? "" : "s"}`,
      tone: "info",
    },
  ];
  if (criticalCount > 0) {
    items.push({
      label: `${criticalCount} Critical`,
      tone: "critical",
    });
  }
  if (warningCount > 0) {
    items.push({
      label: `${warningCount} Warning`,
      tone: "warning",
    });
  }
  if (criticalCount === 0 && warningCount === 0) {
    if (unknownCount > 0) {
      items.push({
        label: `${unknownCount} Updating`,
        tone: "info",
      });
    } else if (healthyCount > 0) {
      items.push({ label: "Healthy", tone: "healthy" });
    }
  }

  return (
    <span
      className="inline-flex min-w-0 flex-shrink-0 items-center gap-1"
      aria-label={`${kpiCount} KPIs: ${healthyCount} healthy, ${warningCount} warning, ${criticalCount} critical, ${unknownCount} updating`}
      data-collapsed-status-summary="true"
    >
      {items.map((item) => (
        <Badge
          key={`${item.tone}-${item.label}`}
          label={item.label}
          backgroundColor={SUMMARY_BADGE_BACKGROUND[item.tone]}
          foregroundColor={variables.contentColorActive}
          style={{
            border: `1px solid ${SUMMARY_BADGE_COLOR[item.tone]}`,
          }}
        />
      ))}
    </span>
  );
};

const TileCountPill: React.FC<TileCountControlConfig> = ({
  value,
  min,
  max,
  onChange,
  label = "Tiles",
}) => {
  const atMin = value <= min;
  const atMax = value >= max;
  return (
    <div
      // The pill is purely a layout preference, not a data
      // affordance — so it whispers rather than shouts. Same
      // colour vocabulary as the section's "Open …" footer
      // link so it reads as part of the chrome.
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md",
        "border border-slate-200 dark:border-slate-700",
        "bg-slate-50/80 dark:bg-slate-800/60",
        "text-slate-600 dark:text-slate-300",
        "select-none",
      )}
      role="group"
      aria-label={`${label}: ${value} of ${max}`}
    >
      <button
        type="button"
        onClick={() => !atMin && onChange(value - 1)}
        disabled={atMin}
        aria-label={`Show fewer ${label.toLowerCase()}`}
        title={
          atMin
            ? `Minimum ${min} ${label.toLowerCase()}`
            : `Show ${value - 1} ${label.toLowerCase()}`
        }
        className={cn(
          "flex items-center justify-center w-5 h-5 rounded-l-md",
          "transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-sky-400",
          atMin
            ? "opacity-40 cursor-not-allowed"
            : "hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer",
        )}
      >
        <Minus className="w-3 h-3" />
      </button>
      <span
        // tabular-nums keeps the pill width steady as the
        // user clicks through 3/4/5 — otherwise the +/-
        // buttons jitter sideways on every press.
        className="text-xs font-semibold tabular-nums leading-none w-3 text-center"
        aria-hidden="true"
      >
        {value}
      </span>
      <button
        type="button"
        onClick={() => !atMax && onChange(value + 1)}
        disabled={atMax}
        aria-label={`Show more ${label.toLowerCase()}`}
        title={
          atMax
            ? `Maximum ${max} ${label.toLowerCase()}`
            : `Show ${value + 1} ${label.toLowerCase()}`
        }
        className={cn(
          "flex items-center justify-center w-5 h-5 rounded-r-md",
          "transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-sky-400",
          atMax
            ? "opacity-40 cursor-not-allowed"
            : "hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer",
        )}
      >
        <Plus className="w-3 h-3" />
      </button>
    </div>
  );
};

const HeightPill: React.FC<HeightControlConfig> = ({
  value,
  min,
  max,
  onChange,
  label = "Section height",
}) => {
  const atMin = value <= min;
  const atMax = value >= max;
  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md",
        "border border-sky-100 dark:border-sky-800/80",
        "bg-sky-50/70 dark:bg-sky-950/40",
        "text-sky-700 dark:text-sky-200",
        "select-none",
      )}
      role="group"
      aria-label={`${label}: level ${value} of ${max}`}
      title={`${label}: level ${value} of ${max}`}
    >
      <button
        type="button"
        onClick={() => !atMin && onChange(value - 1)}
        disabled={atMin}
        aria-label={`Make ${label.toLowerCase()} shorter`}
        title={
          atMin
            ? `Minimum ${label.toLowerCase()}`
            : `Make ${label.toLowerCase()} shorter`
        }
        className={cn(
          "flex items-center justify-center w-5 h-5 rounded-l-md",
          "transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-sky-400",
          atMin
            ? "opacity-40 cursor-not-allowed"
            : "hover:bg-sky-100 dark:hover:bg-sky-900 cursor-pointer",
        )}
      >
        <Minus className="w-3 h-3" />
      </button>
      <span
        className="inline-flex items-center justify-center gap-0.5 text-xs font-semibold tabular-nums leading-none w-9"
        aria-hidden="true"
      >
        <ArrowUpDown className="w-3 h-3" />H{value}
      </span>
      <button
        type="button"
        onClick={() => !atMax && onChange(value + 1)}
        disabled={atMax}
        aria-label={`Make ${label.toLowerCase()} taller`}
        title={
          atMax
            ? `Maximum ${label.toLowerCase()}`
            : `Make ${label.toLowerCase()} taller`
        }
        className={cn(
          "flex items-center justify-center w-5 h-5 rounded-r-md",
          "transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-sky-400",
          atMax
            ? "opacity-40 cursor-not-allowed"
            : "hover:bg-sky-100 dark:hover:bg-sky-900 cursor-pointer",
        )}
      >
        <Plus className="w-3 h-3" />
      </button>
    </div>
  );
};

export const DashboardSection: React.FC<DashboardSectionProps> = ({
  title,
  linkText,
  href,
  icon,
  children,
  className,
  style,
  tileCount,
  height,
  wrapTiles = false,
  compactHeight = false,
  addTileAction,
  onEditTitle,
  collapsed = false,
  focused = false,
  collapsedSummary,
  onToggleCollapsed,
  onToggleFocus,
}) => {
  const sectionBodyId = `dashboard-section-${React.useId().replace(/:/g, "")}`;
  let densityClass = "min-h-[180px] py-2.5";
  if (compactHeight) densityClass = "min-h-[152px] py-2";
  if (collapsed) densityClass = "min-h-0 py-2";
  let sectionState = "expanded";
  if (collapsed) sectionState = "collapsed";
  if (focused) sectionState = "focused";
  // Build 101 (2026-05-13): the drill-down link moved from a
  // bottom footer row up onto the section title itself. On short
  // viewports the footer was the first thing to get clipped — Alan
  // showed a screenshot at ~600px viewport height where all three
  // "OPEN ..." links were partially obscured and unreachable, even
  // though the page already scrolled. Promoting the title to be
  // the click target solves three problems at once:
  //
  //   1. The section header is the most stable, always-on-top piece
  //      of section chrome — clipping it would imply the section
  //      itself isn't visible.
  //   2. ~36px of vertical chrome per section is reclaimed (3
  //      sections = ~108px back) without changing tile sizing,
  //      letting the chart canvas breathe at its previous floor
  //      height.
  //   3. One affordance to learn instead of two ("click the title
  //      OR the OPEN link").
  //
  // The `linkText` prop is repurposed as the hover/title tooltip
  // ("Open IT health (new tab)") so existing callers don't need
  // to change their contract.
  const labelNode = (
    <>
      {icon && (
        <span
          className={cn(
            "inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg",
            "bg-sky-50/90 text-sky-800 dark:bg-sky-950/70 dark:text-sky-200",
            "border border-sky-200/80 dark:border-sky-800/80 shadow-sm",
          )}
          aria-hidden="true"
        >
          {icon}
        </span>
      )}
      <h2 className="leading-none">{title}</h2>
    </>
  );

  const titleNode = href ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={`${linkText} (new tab)`}
      // The whole title row is the hit target. We keep the
      // `<h2>` semantic underneath via aria-label so screen
      // readers still announce it as the section heading
      // first, then read the link role as secondary.
      className={cn(
        "inline-flex items-center gap-1.5 text-[14px] font-black uppercase tracking-tight leading-none transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-sky-400 rounded-sm group/link",
        "text-sky-950 hover:text-sky-700 dark:text-sky-100 dark:hover:text-sky-300",
      )}
    >
      {labelNode}
      {/* Affordance group: chevron nudges right on hover, an
                ArrowUpRight fades in to telegraph "opens new tab".
                Same animation language the old footer link used so
                the visual vocabulary stays consistent across the
                app — operators who learned the previous pattern
                see the same hover behaviour, just on a different
                element. */}
      <ChevronRight
        className="w-3.5 h-3.5 opacity-60 group-hover/link:opacity-100 group-hover/link:translate-x-0.5 transition-all"
        aria-hidden="true"
      />
      <ArrowUpRight
        className="w-3 h-3 -ml-1 opacity-0 -translate-y-0.5 translate-x-0.5 group-hover/link:opacity-100 group-hover/link:translate-y-0 group-hover/link:translate-x-0 transition-all"
        aria-hidden="true"
      />
    </a>
  ) : (
    <div className="inline-flex items-center gap-1.5 text-[14px] font-black text-sky-950 dark:text-sky-100 uppercase tracking-tight leading-none">
      {labelNode}
    </div>
  );

  return (
    <section
      // `min-h-[180px]` is the legibility floor for a row of
      // tiles after the bottom drill-down footer was removed
      // (was 220px when the footer existed; -36px footer chrome
      // = -36px floor). Keeps the headline + sparkline canvas
      // at sizes the design intends:
      //   ~22px section header + ~4px gap +
      //   ~36px tile headline + ~72px chart floor +
      //   ~16px tile margins / section chrome ≈ 180px.
      // Below this the sparkline degenerates to a wavy pixel
      // line, so we cap there and let the page degrade to
      // vertical scroll via the parent column's `overflow-y-auto`
      // — same fixed-height-grid model Splunk Dashboard Studio
      // uses, just with a tighter floor since this layout has
      // less per-section chrome to amortise.
      className={cn(
        "scd-c3-panel bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 px-4 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.1)] dark:shadow-[0_4px_20px_-10px_rgba(0,0,0,0.45)] relative overflow-hidden group flex flex-col flex-shrink-0",
        densityClass,
        focused &&
          "border-sky-300/90 dark:border-sky-700/90 shadow-[0_10px_34px_-18px_rgba(2,132,199,0.48)] dark:shadow-[0_10px_34px_-18px_rgba(14,165,233,0.38)]",
        className,
      )}
      data-section-density={compactHeight ? "compact" : "standard"}
      data-section-state={sectionState}
      style={style}
    >
      {!collapsed && (
        <div className="absolute top-0 left-0 w-1.5 h-full bg-sky-100 dark:bg-sky-900/40 group-hover:bg-sky-600 dark:group-hover:bg-sky-500 transition-colors" />
      )}

      <div
        className={cn(
          "flex items-center justify-between gap-2",
          collapsed ? "mb-0" : "mb-1.5",
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          {titleNode}
          {collapsed && collapsedSummary && (
            <CollapsedSummaryBadges {...collapsedSummary} />
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {!collapsed && addTileAction && (
            <button
              type="button"
              onClick={addTileAction.onClick}
              disabled={addTileAction.disabled}
              title={addTileAction.title ?? addTileAction.label}
              aria-label={addTileAction.label}
              className={cn(
                "flex items-center justify-center w-6 h-6 rounded-md",
                "transition focus:outline-none focus-visible:ring-1 focus-visible:ring-sky-400",
                addTileAction.disabled
                  ? "cursor-not-allowed text-slate-300 dark:text-slate-700"
                  : [
                      "border border-sky-100 dark:border-sky-900/70",
                      "bg-sky-50/80 dark:bg-sky-950/50",
                      "text-sky-700 dark:text-sky-200",
                      "hover:bg-sky-100 dark:hover:bg-sky-900/70",
                    ],
              )}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
          {!collapsed && onEditTitle && (
            <button
              type="button"
              onClick={onEditTitle}
              title="Edit section titles"
              aria-label="Edit section titles"
              className={cn(
                "flex items-center justify-center w-6 h-6 rounded-md",
                "text-slate-400 hover:text-sky-600 dark:hover:text-sky-300",
                "hover:bg-slate-100 dark:hover:bg-slate-800",
                "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
                "transition focus:outline-none focus-visible:ring-1 focus-visible:ring-sky-400",
              )}
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          {!collapsed && height && <HeightPill {...height} />}
          {!collapsed && tileCount && <TileCountPill {...tileCount} />}
          {onToggleFocus && (
            <button
              type="button"
              onClick={onToggleFocus}
              aria-pressed={focused}
              aria-label={
                focused ? `Exit ${title} focus view` : `Focus ${title}`
              }
              title={focused ? "Exit focus view" : "Focus this section"}
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-md border transition",
                "focus:outline-none focus-visible:ring-1 focus-visible:ring-sky-400",
                focused
                  ? "border-sky-300 bg-sky-100 text-sky-800 dark:border-sky-700 dark:bg-sky-950 dark:text-sky-200"
                  : "border-transparent text-slate-400 hover:border-slate-200 hover:bg-slate-100 hover:text-sky-700 dark:hover:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-sky-200",
              )}
            >
              {focused ? (
                <Minimize2 className="h-3.5 w-3.5" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" />
              )}
            </button>
          )}
          {onToggleCollapsed && (
            <button
              type="button"
              onClick={onToggleCollapsed}
              aria-expanded={!collapsed}
              aria-controls={sectionBodyId}
              aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
              title={collapsed ? "Expand section" : "Collapse section"}
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-md border border-transparent text-slate-400 transition",
                "hover:border-slate-200 hover:bg-slate-100 hover:text-sky-700 dark:hover:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-sky-200",
                "focus:outline-none focus-visible:ring-1 focus-visible:ring-sky-400",
              )}
            >
              {collapsed ? (
                <ChevronRight className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
          )}
        </div>
      </div>

      {/*
       * Tile row is intentionally NOT `overflow-hidden`. An
       * earlier fix added that clip here as a chart-bleed
       * safety net, but it was a sledgehammer: it also clipped
       * floating UI rendered into descendant tiles - notably
       * the InfoTooltip popover, whose body would get truncated
       * mid-sentence when it tried to extend below the row. The
       * chart-bleed risk is now contained at the source by an
       * `overflow-hidden` on the chart container inside
       * MetricItem (the only descendant that ever produces
       * unbounded vertical content), so the row can stay open
       * and lets popovers/tooltips/menus extend out of the row
       * naturally. The InfoTooltip is also portaled to
       * `document.body`, which is a separate belt-and-braces
       * defense against any future ancestor clipping pattern.
       */}
      <div
        id={sectionBodyId}
        aria-hidden={collapsed}
        className={cn(
          "flex flex-1 min-h-0",
          collapsed && "hidden",
          wrapTiles
            ? "flex-wrap content-stretch items-stretch gap-2"
            : "flex-wrap md:flex-nowrap gap-0 divide-x divide-slate-100 dark:divide-slate-800",
        )}
      >
        {children}
      </div>
    </section>
  );
};
