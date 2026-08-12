/**
 * KpiPickerPanel — slide-in panel that lets the user swap which
 * searchbase entry powers a given metric tile.
 *
 * Source of truth
 * ---------------
 * The panel browses `searchbase.conf` (rich KPI catalogue with
 * category / sub_category / tags / description / inline SPL).
 * `searchbase.conf` is the dispatch source of truth. When the user
 * applies a pick, the overview page resolves `search_name` back to the
 * literal `search` field from this catalogue and dispatches that SPL.
 * `savedsearches.conf` is intentionally limited to scheduled,
 * materialized, or explicit compatibility dependencies.
 *
 * Filter model
 * ------------
 * Three orthogonal facets that AND together:
 *   1. Free-text query (matches name, description, sub-category, tag).
 *   2. Category dropdown.
 *   3. Sub-category dropdown (only renders when a category is picked).
 *   4. Tag multi-select — a compact token input. Clicking the field
 *      opens a dropdown of available tags scoped to the current
 *      category/sub-category slice (top-N by frequency, lifted when
 *      typing). Selected tags become pills inside the field and are
 *      AND-combined when filtering the result list, so adding more
 *      tags narrows further. Backspace on an empty input pops the
 *      last pill; Esc closes the dropdown.
 *
 * Selection preview
 * -----------------
 * The bottom panel surfaces the picked entry's category/tag badges,
 * source actions, and compact tile-mapping controls. Rich narrative
 * stays in the result row / Searchbase editor so the form stays tidy.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import Badge from "@splunk/react-ui/Badge";
import Button from "@splunk/react-ui/Button";
import Card from "@splunk/react-ui/Card";
import CardLayout from "@splunk/react-ui/CardLayout";
import Checkbox from "@splunk/react-ui/Checkbox";
import Chip from "@splunk/react-ui/Chip";
import CollapsiblePanel from "@splunk/react-ui/CollapsiblePanel";
import ControlGroup from "@splunk/react-ui/ControlGroup";
import Drawer from "@splunk/react-ui/Drawer";
import Layout from "@splunk/react-ui/Layout";
import Message from "@splunk/react-ui/Message";
import Modal from "@splunk/react-ui/Modal";
import Multiselect from "@splunk/react-ui/Multiselect";
import Paragraph from "@splunk/react-ui/Paragraph";
import RadioBar from "@splunk/react-ui/RadioBar";
import SearchInput from "@splunk/react-ui/Search";
import ScreenReaderContent from "@splunk/react-ui/ScreenReaderContent";
import Select from "@splunk/react-ui/Select";
import Switch from "@splunk/react-ui/Switch";
import Text from "@splunk/react-ui/Text";
import WaitSpinner from "@splunk/react-ui/WaitSpinner";
import { variables } from "@splunk/themes";
import {
  Eye,
  Maximize2,
  Play,
  RotateCcw,
  Settings2,
  Table2,
  X,
} from "@/common/icons/SuiIcon";
import { cn } from "@/common/lib/utils";
import {
  clearSearchbaseCache,
  getSearchbaseCatalogue,
  getSplunkAppLabels,
  plainTextFromHtml,
  searchbaseAppLabel,
  type SearchbaseRecord,
} from "@/common/services/searchbaseCatalogue";
import type { MetricOverride } from "@/common/hooks/usePersistedMetricOverrides";
import type { SearchbaseDrilldownMap } from "@/common/hooks/usePersistedSearchbaseDrilldowns";
import {
  deriveThresholdLines,
  formatThresholdNumber,
  type MetricThresholds,
} from "@/common/hooks/useMetric";
import { VizIcon, resolveVizMapping } from "./vizIcons";

// "All" sentinels for the category facets - using sentinels rather
// than '' keeps the <select> elements rendering predictable.
const ALL_CATEGORIES = "__all__";
const ALL_SUB_CATEGORIES = "__all_sub__";

// Splunk Web's legacy input rule outranks SUI, so restore the themed search background here.
const StyledSearch = styled(SearchInput)`
  && input[role="searchbox"] {
    background-color: ${variables.transparent};
  }
`;

const StyledDrawer = styled(Drawer)`
  max-width: 100vw;

  & > div {
    width: 100%;
    max-width: 100vw;
  }
`;

// The catalogue REST endpoint pulls from every app namespace
// (`/servicesNS/-/-/configs/conf-searchbase`). The App facet starts at
// All apps so operators can discover the complete catalogue immediately,
// then optionally select one or more app namespaces to narrow it.
//
// The UI stores a normalised `catalogueApp` sourced from the stanza's
// `dispatch_context` value; the UI labels it "App" because that's what
// operators recognise. If a stanza omits `dispatch_context`, the
// catalogue falls back to the owning ACL app. Execution separately honors
// `dispatch_context_force`.
//
const makeDefaultAppSelection = (): Set<string> => new Set();

const isDefaultAppSelection = (selection: ReadonlySet<string>): boolean =>
  selection.size === 0;

const entryMatchesAppSelection = (
  entry: SearchbaseRecord,
  selection: ReadonlySet<string>,
): boolean => selection.size === 0 || selection.has(entry.catalogueApp);

const MAX_FIELD_LENGTH = 64;
const FIELD_NAME_PATTERN = /^[A-Za-z_][\w.]{0,63}$/;
const DRILLDOWN_TARGET_LIMIT = 24;
const CHART_STYLE_OPTIONS: Array<{
  v: Exclude<MetricOverride["vizOverride"], undefined> | null;
  label: string;
  splunkViz?: string;
  hint: string;
}> = [
  {
    v: null,
    label: "Default",
    hint: "Use the searchbase default_viz",
  },
  {
    v: "area",
    label: "Area",
    splunkViz: "splunk.area",
    hint: "Sparkline area chart",
  },
  {
    v: "line",
    label: "Line",
    splunkViz: "splunk.line",
    hint: "Sparkline line chart",
  },
  {
    v: "column",
    label: "Column",
    splunkViz: "splunk.column",
    hint: "Sparkline vertical bars, one bar per bucket",
  },
  {
    v: "bar",
    label: "Bar",
    splunkViz: "splunk.bar",
    hint: "Sparkline horizontal bars, one bar per bucket",
  },
  {
    v: "singlevalue",
    label: "Single",
    splunkViz: "splunk.singlevalue",
    hint: "Headline only, with no chart underneath",
  },
  {
    v: "table",
    label: "Table",
    splunkViz: "splunk.table",
    hint: "Raw table rows",
  },
  {
    v: "barbreakdown",
    label: "Breakdown",
    splunkViz: "splunk.bar",
    hint: "Categorical bar breakdown from table rows",
  },
  {
    v: "pie",
    label: "Pie",
    splunkViz: "splunk.pie",
    hint: "Categorical pie chart from table rows",
  },
  {
    v: "singlevalueradial",
    label: "Radial",
    splunkViz: "splunk.singlevalueradial",
    hint: "Single-value radial progress gauge",
  },
  {
    v: "fillergauge",
    label: "Filler",
    splunkViz: "splunk.fillergauge",
    hint: "Horizontal filler gauge",
  },
  {
    v: "markergauge",
    label: "Marker",
    splunkViz: "splunk.markergauge",
    hint: "Marker gauge on a threshold scale",
  },
];

export interface KpiPickerContext {
  /** Stable tile id from the metric/KPI config. */
  tileId: string;
  /** Default label of the tile (shown in the panel header). */
  defaultLabel: string;
  /** Currently-bound saved search name, if any. */
  currentSavedSearch?: string;
  /** Currently-bound value field, if any. */
  currentValueField?: string;
  /** Currently-bound friendly label override, if any. */
  currentLabel?: string;
  /**
   * Static (code-defined) threshold tuple for this tile — the
   * factory baseline. Used by the THRESHOLDS form to:
   *   1. Render the "default: <n>" helper text under each input
   *      so the user always sees the shipped value.
   *   2. Drive the per-field "Reset to default" affordance — only
   *      fields that differ from this baseline are persisted in
   *      the override, so the storage payload stays minimal and
   *      Reset is just "clear the field, drop the override".
   * Undefined for tiles that shipped without numeric thresholds
   * (e.g. KPI cards). The form still renders so the user can
   * establish thresholds if they swap the tile to a numeric search.
   */
  defaultThresholds?: MetricThresholds;
  /**
   * Currently-effective threshold tuple (override merged on top of
   * `defaultThresholds`). Pre-fills the THRESHOLDS form so re-opening
   * the picker on a customised tile shows the customised values, not
   * the static defaults.
   */
  currentThresholds?: MetricThresholds;
  /**
   * Static unit (`%`, `ms`, etc.) for threshold preview formatting.
   * Drives the suffix on the helper text and the live preview ranges.
   */
  thresholdUnit?: string;
  /** Saved-search names already bound to other tiles — for "in use" hints. */
  usedSavedSearches?: Set<string>;
  /**
   * Currently-applied viz override for this tile, if any. Pre-fills
   * the CHART STYLE picker so re-opening the picker on a customised
   * tile shows the active selection rather than always landing on
   * "Default".
   */
  currentVizOverride?: MetricOverride["vizOverride"];
  /**
   * Currently-applied display toggles (Build 1202, from Atef's
   * review). Pre-fill the DISPLAY section so re-opening the picker
   * on a customised tile keeps the toggles in sync with what's
   * actually rendered. All three default to `false` (chrome
   * visible). `currentHideOverlay` (Build 1203) suppresses the
   * dashed previous-period overlay on the sparkline; sibling of
   * `currentHideDelta` but affects the chart canvas rather than
   * the pill next to the headline.
   */
  currentHidePeak?: boolean;
  currentHideDelta?: boolean;
  currentHideOverlay?: boolean;
  /**
   * Opaque section identifier for this tile (Build 1203). When
   * provided alongside an `onApplyDisplayToSection` handler on the
   * panel props, the Display block surfaces an "Apply these
   * settings to all tiles in this section" link so a single edit
   * can fan out to every sibling tile without opening five
   * pickers. The picker treats the value as a black-box string —
   * the page-level handler is responsible for resolving siblings.
   */
  sectionId?: string;
  /**
   * Human-readable section label for the apply-to-section link
   * ("Apply to all tiles in IT Health"). Falls back to a generic
   * "section" word when omitted.
   */
  sectionLabel?: string;
}

/**
 * Patch payload (Build 1203) for the section-level apply shortcut.
 * Only carries the three display flags — chart-style and threshold
 * customizations are deliberately scoped per tile so the section
 * apply does one thing and does it predictably.
 */
export interface DisplaySectionPatch {
  hidePeak: boolean;
  hideDelta: boolean;
  hideOverlay: boolean;
}

export interface KpiPickerPanelProps {
  open: boolean;
  context: KpiPickerContext | null;
  returnFocus: React.MutableRefObject<HTMLElement | null>;
  onClose: () => void;
  onApply: (tileId: string, override: MetricOverride) => void;
  onClearOverride: (tileId: string) => void;
  /**
   * Legacy per-user drilldown bindings keyed by source `search_name`
   * (read-only here). Drilldown moved to admin-controlled
   * `searchbase.conf` via `onSaveFactoryTileConfig` — this map only
   * still feeds the picker's pre-fill so a browser that has a
   * leftover local binding from before the migration doesn't look
   * like it silently reverted.
   */
  drilldownBindings?: SearchbaseDrilldownMap;
  /**
   * Section-level apply for the DISPLAY flags only (Build 1203).
   * When provided, the Display block in the picker renders an
   * "Apply to all tiles in section" link below the toggles. The
   * page is responsible for resolving which tiles belong to the
   * section and merging the patch onto each tile's existing
   * override (or creating a minimal override for tiles that have
   * none yet). The picker stays focused on a single tile's
   * config; this is the ergonomic shortcut, nothing more.
   */
  onApplyDisplayToSection?: (
    sectionId: string,
    patch: DisplaySectionPatch,
  ) => void;
  /**
   * Optional "Open in Splunk Search" handler. When provided, a
   * compact "Test in Search" action appears next to the Searchbase
   * link. The handler receives the *literal* SPL from
   * `searchbase.conf` (the `search` field), not a saved-search
   * reference. The optional app context is the searchbase stanza's
   * dispatch namespace, so testing runs in the same app context as
   * the runtime tile.
   */
  onTestInSearch?: (spl: string, appContext?: string) => void;
  /**
   * Optional "factory reset" handler. When provided, a small
   * destructive-styled link is rendered alongside the "Reset tile"
   * affordance so the user can wipe **every** customisation
   * (picker overrides, section tile counts, section tile orders,
   * map topology, splitter position) in one click. Theme is left
   * alone — that's a UI preference, not a layout customisation.
   *
   * The picker shows a confirmation modal before invoking
   * the handler so a misclick doesn't blow away the user's whole
   * setup. The handler is responsible for performing the actual
   * reset and (typically) closing the picker after.
   */
  onResetAllCustomizations?: () => void;
  /**
   * Optional workspace-layout publish handler. Insights uses this to
   * write the current section tile order/counts to the active workspace's
   * app-level layout stanzas.
   */
  onPublishWorkspaceLayout?: () => void | Promise<void>;
  workspaceLayoutStatus?: "idle" | "saving" | "saved" | "error";
  /**
   * True when the current Splunk user holds `admin_all_objects`
   * (see `useCanManageFactoryTileConfig`). Thresholds, Data Mapping,
   * and Drilldown are org-wide settings now (searchbase.conf), so
   * their inputs render read-only for everyone else. Chart Style
   * and Display stay editable regardless — those are personal
   * preferences, not org-wide config.
   */
  canManageFactoryConfig?: boolean;
  /**
   * Admin-only save for Thresholds / Data Mapping / Drilldown.
   * Only called when `canManageFactoryConfig` is true. The page is
   * responsible for resolving stanza ids and calling
   * `searchbaseTileConfigService.saveFactoryTileConfig`.
   */
  onSaveFactoryTileConfig?: (
    patch: FactoryTileConfigApplyPatch,
  ) => void | Promise<void>;
  factoryTileConfigStatus?: "idle" | "saving" | "saved" | "error";
}

/** What the picker hands the page on Apply for the admin-gated fields. */
export interface FactoryTileConfigApplyPatch {
  tileId: string;
  thresholds?: {
    enabled?: boolean;
    warning?: number;
    critical?: number;
    direction?: MetricThresholds["direction"];
  };
  dataMapping?: { label?: string; valueField?: string };
  /** Present only when the admin picked a different search entirely. */
  newSearchName?: string;
  /** `undefined` = don't touch; `null` = clear; array = ordered target stanza ids. */
  drilldownSearchNames?: string[] | null;
}

const escapeRegex = (s: string): string =>
  s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Extracts the column names a search will emit by walking the SPL and
 * collecting every `as <alias>` and `eval <name> = …` assignment.
 * These are the things the user can plausibly type into the Value Field
 * and have it actually match a row column at result time.
 *
 * Also adds a couple of well-known implicit columns that common
 * commands emit without an `as`:
 *   `stats count`  → "count"
 *   `timechart count` → "count"
 *
 * Order is preserved so the chips render in roughly pipeline order
 * (i.e. the headline-producing aggregator usually shows up last) and
 * de-duplicated.
 *
 * The patterns match in three flavours: bare identifier, double-quoted
 * (allows spaces/punctuation in the alias), and single-quoted. Bare
 * names must start with a letter / underscore so we don't accidentally
 * pick up the trailing parenthesis of an aggregator.
 */
const extractSplFieldNames = (spl: string): string[] => {
  if (!spl || typeof spl !== "string") return [];
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (name: string | undefined): void => {
    if (!name) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 64) return;
    if (seen.has(trimmed)) return;
    seen.add(trimmed);
    out.push(trimmed);
  };

  // `as <alias>` — three flavours captured in a single regex; only
  // one of the three groups will be non-empty per match.
  const aliasRe = /\bas\s+(?:"([^"]+)"|'([^']+)'|([A-Za-z_][\w.]*))/gi;
  let m: RegExpExecArray | null;
  while ((m = aliasRe.exec(spl)) !== null) {
    push(m[1] || m[2] || m[3]);
  }

  // `eval <name> = …` — the user can read the eval'd field as the
  // headline if the pipeline ends right after the eval.
  const evalRe = /\beval\s+([A-Za-z_][\w.]*)\s*=/gi;
  while ((m = evalRe.exec(spl)) !== null) {
    push(m[1]);
  }

  // `stats count` / `timechart count` (no `as`) → emit "count".
  if (/\b(?:stats|timechart)\b[^|]*\bcount\b(?!\s*\()/i.test(spl)) {
    push("count");
  }

  return out;
};

const highlightMatch = (text: string, query: string): React.ReactNode => {
  const trimmed = query.trim();
  if (!trimmed) return text;
  const re = new RegExp(`(${escapeRegex(trimmed)})`, "ig");
  const parts = text.split(re);
  return parts.map((part, idx) =>
    re.test(part) ? (
      <mark
        key={idx}
        className="sui-bg-info sui-bg-accent text-inherit rounded-sm px-0.5"
      >
        {part}
      </mark>
    ) : (
      <React.Fragment key={idx}>{part}</React.Fragment>
    ),
  );
};

const matchesQuery = (entry: SearchbaseRecord, query: string): boolean => {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return true;
  const plainDescription = plainTextFromHtml(entry.description);
  return (
    entry.searchName.toLowerCase().includes(trimmed) ||
    (entry.drilldownSearchName ?? "").toLowerCase().includes(trimmed) ||
    plainDescription.toLowerCase().includes(trimmed) ||
    entry.subCategory.toLowerCase().includes(trimmed) ||
    entry.tags.some((t) => t.toLowerCase().includes(trimmed))
  );
};

const entryMatchesKey = (
  entry: SearchbaseRecord,
  key: string | null | undefined,
): boolean => {
  const trimmed = key?.trim();
  if (!trimmed) return false;
  return entry.id === trimmed || entry.searchName === trimmed;
};

const entryMatchesFacetSelection = (
  entry: SearchbaseRecord,
  appSelection: ReadonlySet<string>,
  category: string,
  subCategory: string,
  tags: ReadonlySet<string>,
): boolean => {
  if (!entryMatchesAppSelection(entry, appSelection)) {
    return false;
  }
  if (category !== ALL_CATEGORIES && entry.category !== category) {
    return false;
  }
  if (subCategory !== ALL_SUB_CATEGORIES && entry.subCategory !== subCategory) {
    return false;
  }
  for (const tag of tags) {
    if (!entry.tags.includes(tag)) return false;
  }
  return true;
};

const entryIsDrilldownSearch = (
  entry: SearchbaseRecord,
  drilldownSearchNames: ReadonlySet<string>,
): boolean =>
  drilldownSearchNames.has(entry.searchName.trim().toLowerCase()) ||
  drilldownSearchNames.has(entry.id.trim().toLowerCase());

const entryMatchesBrowseVisibility = (
  entry: SearchbaseRecord,
  drilldownSearchNames: ReadonlySet<string>,
  includeHiddenSearches: boolean,
  includeDrilldownSearches: boolean,
  includeTableSearches: boolean,
): boolean => {
  if (!includeHiddenSearches && entry.searchHidden) {
    return false;
  }
  if (
    !includeDrilldownSearches &&
    entryIsDrilldownSearch(entry, drilldownSearchNames)
  ) {
    return false;
  }
  if (!includeTableSearches && entry.defaultViz === "splunk.table") {
    return false;
  }
  return true;
};

const entryIsUsed = (
  entry: SearchbaseRecord,
  used: Set<string> | undefined,
): boolean => {
  if (!used) return false;
  return used.has(entry.id) || used.has(entry.searchName);
};

const labelFromSearchName = (searchName: string): string => {
  const parts = searchName.split(/\s+[–—-]\s+/).map((part) => part.trim());
  return (parts[parts.length - 1] || searchName).slice(0, 80);
};

const getSplunkWebLocalePrefix = (): string => {
  if (typeof window === "undefined") return "/en-US";
  const match = window.location.pathname.match(/^\/([^/]+)\/app\//);
  return match ? `/${match[1]}` : "/en-US";
};

const buildSearchbaseEditUrl = (entry: SearchbaseRecord): string | null => {
  const stanza = entry.id.trim();
  if (!stanza) return null;
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}${getSplunkWebLocalePrefix()}/app/searchbase/start#/edit/${encodeURIComponent(stanza)}#search-spl`;
};

const configuredDrilldownNamesFor = (
  entry: SearchbaseRecord,
  bindings: SearchbaseDrilldownMap | undefined,
): string[] => {
  if (
    bindings &&
    Object.prototype.hasOwnProperty.call(bindings, entry.searchName)
  ) {
    const legacyOverride = bindings[entry.searchName]?.trim();
    return legacyOverride ? [legacyOverride] : [];
  }
  if (entry.drilldownSearchNames?.length) return entry.drilldownSearchNames;
  const legacyTarget = entry.drilldownSearchName?.trim();
  return legacyTarget ? [legacyTarget] : [];
};

const sameOrderedStrings = (
  left: readonly string[],
  right: readonly string[],
): boolean =>
  left.length === right.length &&
  left.every((value, index) => value === right[index]);

export const KpiPickerPanel: React.FC<KpiPickerPanelProps> = ({
  open,
  context: contextProp,
  returnFocus,
  onClose,
  onApply,
  onClearOverride,
  drilldownBindings,
  onTestInSearch,
  onResetAllCustomizations,
  onPublishWorkspaceLayout,
  workspaceLayoutStatus = "idle",
  onApplyDisplayToSection,
  canManageFactoryConfig = false,
  onSaveFactoryTileConfig,
  factoryTileConfigStatus = "idle",
}) => {
  const lastContextRef = useRef<KpiPickerContext | null>(contextProp);
  if (contextProp) lastContextRef.current = contextProp;
  const context = contextProp ?? lastContextRef.current;
  const [confirmation, setConfirmation] = useState<{
    body: React.ReactNode;
    confirmLabel: string;
    destructive?: boolean;
    onConfirm: () => void;
    title: string;
  } | null>(null);
  const confirmationReturnFocusRef = useRef<HTMLElement | null>(null);
  const [catalogue, setCatalogue] = useState<SearchbaseRecord[]>([]);
  const [loadState, setLoadState] = useState<"idle" | "loading" | "error">(
    "idle",
  );
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] =
    useState<string>(ALL_CATEGORIES);
  const [selectedSubCategory, setSelectedSubCategory] =
    useState<string>(ALL_SUB_CATEGORIES);
  // App facet - defaults to this app's namespace (read from the
  // searchbase entry's `dispatch_context` field) so the picker stays
  // scoped to dashboard-pack searches at first open. Empty selection
  // means "All apps"; otherwise selected app namespaces are OR-combined.
  const [selectedApps, setSelectedApps] = useState<Set<string>>(
    makeDefaultAppSelection,
  );
  const [includeHiddenSearches, setIncludeHiddenSearches] = useState(false);
  const [includeDrilldownSearches, setIncludeDrilldownSearches] =
    useState(false);
  const [includeTableSearches, setIncludeTableSearches] = useState(false);
  const [activeTags, setActiveTags] = useState<Set<string>>(() => new Set());
  // Collapse the App / Category / Sub-cat / Tag facet block behind a
  // single "Filters" toggle so the result list gets back ~140px of
  // vertical real-estate at rest (Build 93 — the picker was eating
  // most of the popover height with facets the user often didn't
  // touch). Free-text search stays visible. The block auto-expands
  // whenever any facet is non-default so applied filters are never
  // hidden silently.
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Dismiss the green "Bound: <name>" strip for the current panel
  // open. Once the user has used Jump-To (or seen which search is
  // bound), the ~32px strip is dead weight; this lets them reclaim
  // it. Resets every time the panel reopens so the strip is always
  // available for a fresh tile context. Build 94.
  const [boundDismissed, setBoundDismissed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [valueField, setValueField] = useState("");
  const [labelOverride, setLabelOverride] = useState("");
  // ---------- THRESHOLDS form state (Build 97) ----------
  //
  // The form drives the same `MetricThresholds` shape the runtime
  // already consumes via `computeStatus` and `deriveThresholdLines`,
  // so editing here is equivalent to editing the static config in
  // code — persisted to the shared searchbase stanza and reversible.
  //
  // State shape:
  //   • `thresholdsOpen` — collapsible flag. Defaults to `true`
  //     (Build 98 fix-up: was `false`, but Alan reported the
  //     section was undiscoverable behind a tiny chevron toggle).
  //     The auto-expand effect below preserves the open state on
  //     panel open. Users who want to collapse it for vertical
  //     room can click the toggle; their preference is local to
  //     the open session (next picker open re-expands).
  //   • `thresholdWarningInput` / `thresholdCriticalInput` — the
  //     raw text content of the number inputs. Stored as strings
  //     so the user can clear an input back to empty (== "no
  //     warning band") and we can validate without `NaN` flicker.
  //   • `thresholdDirection` — the segmented-control selection.
  //     Defaults to the tile's static direction; the segment whose
  //     value matches the currently-applied (or default) direction
  //     is highlighted.
  //
  // All five pieces of state reset on panel open / selected-entry
  // change in the same `useEffect` blocks that already handle
  // valueField and labelOverride, so the picker behaves the same
  // way for thresholds as for those fields.
  const [thresholdsOpen, setThresholdsOpen] = useState(true);
  const [thresholdsEnabled, setThresholdsEnabled] = useState(true);
  const [thresholdWarningInput, setThresholdWarningInput] = useState("");
  const [thresholdCriticalInput, setThresholdCriticalInput] = useState("");
  const [thresholdDirection, setThresholdDirection] =
    useState<MetricThresholds["direction"]>("higher_is_better");

  /**
   * Viz override picker state (Build 1174). `null` means "use the
   * default", which the runtime resolves from `searchbase.conf`'s
   * `default_viz`. Any other value pins the chart style for this
   * tile regardless of which searchbase entry drives the data,
   * including across binding swaps. The "Default" affordance maps
   * back to clearing the override on Apply, matching the
   * "Reset to default" pattern used elsewhere in the picker.
   */
  const [vizOverrideInput, setVizOverrideInput] = useState<Exclude<
    MetricOverride["vizOverride"],
    undefined
  > | null>(null);

  /**
   * Display toggle state (Build 1202, Atef's review on 2026-05-19).
   *
   * Both toggles default to `false` (chrome visible — matches the
   * shipped behaviour and what every operator sees today). When the
   * user flips a toggle ON we suppress the corresponding decoration
   * around the headline value:
   *
   *   • `hidePeakInput`  → drop the peak / min-max labels on the
   *     sparkline canvas (Sparkline's `dataValuesDisplay='none'`)
   *   • `hideDeltaInput` → drop the ↑/↓ delta-vs-previous pill next
   *     to the headline
   *
   * These are deliberately separate from `vizOverrideInput`:
   * collapsing the chart entirely is reachable via Chart style →
   * Single, and adding a third "hide trend" toggle here would
   * duplicate that state with two competing controls.
   *
   * Reset path: `handleResetDisplay` clears both back to the
   * shipped defaults; the per-section "Reset to default" link only
   * surfaces when something is customised so the panel stays clean
   * for the common case.
   */
  const [hidePeakInput, setHidePeakInput] = useState(false);
  const [hideDeltaInput, setHideDeltaInput] = useState(false);
  const [hideOverlayInput, setHideOverlayInput] = useState(false);

  /**
   * Collapse state for the editor blocks. All editor groups start
   * collapsed so the selected search preview lands as a tidy menu
   * stack. Groups auto-expand only when an existing customisation
   * needs to be surfaced immediately.
   *
   * Why collapsed by default: the picker was running 1000+px
   * vertical at full bleed (filters + binding + value field +
   * chart style + display + thresholds + actions). Keeping the
   * controls in consistent accordions lets operators scan the
   * available edits without the footer being crowded by whichever
   * form happens to be expanded.
   */
  const [dataMappingOpen, setDataMappingOpen] = useState(false);
  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const [drilldownQuery, setDrilldownQuery] = useState("");
  const [drilldownDraftSearchNames, setDrilldownDraftSearchNames] = useState<
    string[]
  >([]);
  const [drilldownFiltersOpen, setDrilldownFiltersOpen] = useState(false);
  const [drilldownSelectedApps, setDrilldownSelectedApps] = useState<
    Set<string>
  >(makeDefaultAppSelection);
  const [drilldownSelectedCategory, setDrilldownSelectedCategory] =
    useState<string>(ALL_CATEGORIES);
  const [drilldownSelectedSubCategory, setDrilldownSelectedSubCategory] =
    useState<string>(ALL_SUB_CATEGORIES);
  const [drilldownActiveTags, setDrilldownActiveTags] = useState<Set<string>>(
    () => new Set(),
  );
  const [chartStyleOpen, setChartStyleOpen] = useState(false);
  const [displayOpen, setDisplayOpen] = useState(false);
  // Collapses the lower inspector into a compact selected-search
  // strip so the catalogue list can own most of the drawer while
  // users are browsing. The full editor is still one click away.
  const [detailsCollapsed, setDetailsCollapsed] = useState(true);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const drilldownDraftResetKeyRef = useRef<string>("");

  // Lazy-load searchbase.conf when the panel first opens. Cached at
  // the service layer; subsequent opens reuse the in-memory list.
  //
  // Self-healing refetch: if the tile reports a `currentSavedSearch`
  // that the cached catalogue doesn't recognise, transparently bust
  // the cache and refetch once. This recovers from the common case
  // where the user opens the picker shortly after a `searchbase.conf`
  // edit / Splunk reload — without it, the previously-cached list
  // hides the new entry, the "Currently bound" banner can't render,
  // and the Jump-To button vanishes. Alan flagged this on
  // 2026-05-11 ("you took out the jump-to feature again"). The retry
  // is bounded to one extra fetch per panel-open so a genuinely
  // missing entry doesn't cause an infinite refresh loop.
  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setLoadState("loading");
    setErrorMsg("");

    // The whole catalogue lives in `catalogue` state — facet
    // filtering (including dispatch-context) happens at render time
    // in the `filtered` useMemo so the user can switch facets
    // without re-fetching. Sort once at load so the result list is
    // stable.
    const sortAlphabetical = (list: SearchbaseRecord[]) =>
      [...list].sort((a, b) =>
        a.searchName.localeCompare(b.searchName, undefined, {
          sensitivity: "base",
        }),
      );

    const applyList = (list: SearchbaseRecord[]) => {
      if (cancelled) return;
      setCatalogue(sortAlphabetical(list));
      setLoadState("idle");
    };

    const handleError = (err: unknown) => {
      if (cancelled) return;
      setCatalogue([]);
      setLoadState("error");
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to load searchbase.conf.",
      );
    };

    const expectedKey = context?.currentSavedSearch?.trim();
    const catalogueOptions = includeHiddenSearches
      ? { allApps: true, includeHidden: true }
      : { allApps: true };
    getSearchbaseCatalogue(catalogueOptions)
      .then((list) => {
        if (cancelled) return;
        const sorted = sortAlphabetical(list);
        // Cache-staleness check operates on the full catalogue,
        // not a dispatch-filtered slice — that way a binding
        // pointed at another app's stanza still resolves and
        // the "Currently bound" banner can render once the
        // user widens the App facet.
        const cacheRecognisesBinding =
          !expectedKey ||
          sorted.some((entry) => entryMatchesKey(entry, expectedKey));
        if (cacheRecognisesBinding) {
          setCatalogue(sorted);
          setLoadState("idle");
          return;
        }
        // Cache is stale relative to the bound search; force one
        // refetch so a freshly-deployed stanza shows up without
        // the user having to reload the whole page.
        clearSearchbaseCache();
        getSearchbaseCatalogue(catalogueOptions)
          .then(applyList)
          .catch(handleError);
      })
      .catch(handleError);

    return () => {
      cancelled = true;
    };
    // `context?.currentSavedSearch` participates so re-opening the
    // picker for a different tile re-evaluates whether its bound
    // search is in the cache.
  }, [open, context?.currentSavedSearch, includeHiddenSearches]);

  // Reset transient form state when the panel opens for a new tile.
  // Sub-category and tag selections start cleared every time so the
  // user always sees the full slice of the chosen category. The App
  // facet resets to All apps so every new picker open starts with the
  // complete catalogue. Filters block collapses so the user lands on a
  // clean result list.
  useEffect(() => {
    if (!open || !context) return;
    setQuery("");
    setSelectedCategory(ALL_CATEGORIES);
    setSelectedSubCategory(ALL_SUB_CATEGORIES);
    setSelectedApps(makeDefaultAppSelection());
    setIncludeHiddenSearches(false);
    setIncludeDrilldownSearches(false);
    setIncludeTableSearches(false);
    setActiveTags(new Set());
    setFiltersOpen(false);
    setBoundDismissed(false);
    // Highlight the row whose `search_name` matches the tile's
    // currently-bound saved search (if it's in the catalogue).
    const initial = context.currentSavedSearch ?? null;
    setSelectedId(initial);
    setValueField(context.currentValueField ?? "");
    setLabelOverride(context.currentLabel ?? "");
    // Pre-fill the THRESHOLDS form from the tile's *current*
    // effective tuple (override merged onto default by openPicker),
    // so re-opening the picker on a customised tile shows the
    // customised values rather than the static defaults. Empty
    // strings stay empty — they represent "no warning band" /
    // "no critical band", which is a valid configuration for
    // tiles that only flag one direction of trouble.
    const cur = context.currentThresholds;
    setThresholdsEnabled(cur?.enabled !== false);
    setThresholdWarningInput(
      cur && cur.warning !== undefined ? String(cur.warning) : "",
    );
    setThresholdCriticalInput(
      cur && cur.critical !== undefined ? String(cur.critical) : "",
    );
    setThresholdDirection(cur?.direction ?? "higher_is_better");
    // Build 1174: pre-fill the CHART STYLE picker from any
    // currently-applied viz override so re-opening shows the
    // active selection. `null` falls through to "Default" in
    // the picker, which on Apply resolves to "no override
    // persisted" — same pattern as the threshold reset path.
    setVizOverrideInput(context.currentVizOverride ?? null);
    // Build 1202 / 1203: pre-fill the DISPLAY toggles from the
    // active override so a tile that's been customised re-opens
    // with the user's choices visible. All three default to
    // `false` (chrome visible) — only `true` is persisted, so
    // absence reliably means "default ON" and the storage
    // payload stays minimal.
    const hidePeakActive = context.currentHidePeak === true;
    const hideDeltaActive = context.currentHideDelta === true;
    const hideOverlayActive = context.currentHideOverlay === true;
    setHidePeakInput(hidePeakActive);
    setHideDeltaInput(hideDeltaActive);
    setHideOverlayInput(hideOverlayActive);

    setDataMappingOpen(false);
    setDrilldownOpen(false);
    setDrilldownFiltersOpen(false);
    setDrilldownSelectedApps(makeDefaultAppSelection());
    setDrilldownSelectedCategory(ALL_CATEGORIES);
    setDrilldownSelectedSubCategory(ALL_SUB_CATEGORIES);
    setDrilldownActiveTags(new Set());
    // Build 1203: auto-expand CHART STYLE and DISPLAY when the
    // tile is already customised in those areas. Operators
    // landing on a tile they've previously tweaked should see
    // their customisations without an extra click; for fresh
    // tiles the collapsed default keeps the panel compact.
    setChartStyleOpen(Boolean(context.currentVizOverride));
    setDisplayOpen(hidePeakActive || hideDeltaActive || hideOverlayActive);
    setDetailsCollapsed(true);
    const defaultThresholds = context.defaultThresholds;
    const currentDirection = cur?.direction ?? "higher_is_better";
    const defaultDirection = defaultThresholds?.direction ?? "higher_is_better";
    setThresholdsOpen(
      cur?.warning !== defaultThresholds?.warning ||
        cur?.critical !== defaultThresholds?.critical ||
        currentDirection !== defaultDirection,
    );
    const id = window.setTimeout(() => searchInputRef.current?.focus(), 30);
    return () => window.clearTimeout(id);
  }, [open, context]);

  // When the category changes, reset sub-category and active tags.
  // Any tag that's no longer present in the new slice would render
  // an empty list, which feels broken — better to clear and let the
  // user re-pick.
  useEffect(() => {
    setSelectedSubCategory(ALL_SUB_CATEGORIES);
    setActiveTags(new Set());
  }, [selectedCategory]);

  useEffect(() => {
    setDrilldownSelectedSubCategory(ALL_SUB_CATEGORIES);
    setDrilldownActiveTags(new Set());
  }, [drilldownSelectedCategory]);

  // When the App facet changes, reset the downstream facets. Picking
  // a different app namespace surfaces a different category /
  // sub-category / tag vocabulary, so carrying old selections over
  // would silently filter the new slice down to nothing. Same idea
  // as the cascade above for category → sub-category.
  useEffect(() => {
    setSelectedCategory(ALL_CATEGORIES);
    setSelectedSubCategory(ALL_SUB_CATEGORIES);
    setActiveTags(new Set());
  }, [selectedApps]);

  useEffect(() => {
    setDrilldownSelectedCategory(ALL_CATEGORIES);
    setDrilldownSelectedSubCategory(ALL_SUB_CATEGORIES);
    setDrilldownActiveTags(new Set());
  }, [drilldownSelectedApps]);

  // Auto-expand the Filters block whenever an applied facet appears
  // — guarantees the user can always see what's narrowing the result
  // list, even if they applied a filter, scrolled, then collapsed
  // the block from a previous open. Closing is left manual: once
  // expanded, the user controls when to hide the block again.
  useEffect(() => {
    if (
      !isDefaultAppSelection(selectedApps) ||
      includeHiddenSearches ||
      includeDrilldownSearches ||
      includeTableSearches ||
      selectedCategory !== ALL_CATEGORIES ||
      selectedSubCategory !== ALL_SUB_CATEGORIES ||
      activeTags.size > 0
    ) {
      setFiltersOpen(true);
    }
  }, [
    selectedApps,
    includeHiddenSearches,
    includeDrilldownSearches,
    includeTableSearches,
    selectedCategory,
    selectedSubCategory,
    activeTags,
  ]);

  useEffect(() => {
    if (
      !isDefaultAppSelection(drilldownSelectedApps) ||
      drilldownSelectedCategory !== ALL_CATEGORIES ||
      drilldownSelectedSubCategory !== ALL_SUB_CATEGORIES ||
      drilldownActiveTags.size > 0
    ) {
      setDrilldownFiltersOpen(true);
    }
  }, [
    drilldownSelectedApps,
    drilldownSelectedCategory,
    drilldownSelectedSubCategory,
    drilldownActiveTags,
  ]);

  // Different selection drops the prefilled `valueField` whenever the
  // user picks a search that isn't the tile's current binding.
  // Carrying the field across a search swap was the root cause of
  // headlines remaining stale after a picker change: the new SPL
  // emits e.g. `pct` but the input still said `blocked`, so the
  // metric hook read undefined and silently fell back to mock.
  // Clearing tells `applyOverride` to leave `valueField` undefined,
  // which lets `useMetric` auto-detect the column from live rows.
  useEffect(() => {
    if (!context) return;
    const selectedIsCurrent =
      selectedId === context.currentSavedSearch ||
      catalogue.some(
        (entry) =>
          entryMatchesKey(entry, selectedId) &&
          entryMatchesKey(entry, context.currentSavedSearch),
      );
    if (selectedId && !selectedIsCurrent) {
      setValueField("");
      const selected = catalogue.find((entry) =>
        entryMatchesKey(entry, selectedId),
      );
      setLabelOverride(
        selected ? labelFromSearchName(selected.searchName) : "",
      );
    } else {
      setValueField(context.currentValueField ?? "");
      setLabelOverride(context.currentLabel ?? "");
    }
  }, [selectedId, context, catalogue]);

  const drilldownSearchNames = useMemo(() => {
    const names = new Set<string>();
    for (const entry of catalogue) {
      for (const rawName of entry.drilldownSearchNames ?? []) {
        const name = rawName.trim();
        if (name) names.add(name.toLowerCase());
      }
      const compatibilityName = entry.drilldownSearchName?.trim();
      if (compatibilityName) names.add(compatibilityName.toLowerCase());
    }
    return names;
  }, [catalogue]);

  // This is deliberately independent of the App facet. App choices and
  // counts must reflect the active visibility controls; otherwise an app
  // containing only hidden searches remains selectable and leads to an
  // empty result list.
  const visibilityEligibleEntries = useMemo(() => {
    return catalogue.filter((entry) =>
      entryMatchesBrowseVisibility(
        entry,
        drilldownSearchNames,
        includeHiddenSearches,
        includeDrilldownSearches,
        includeTableSearches,
      ),
    );
  }, [
    catalogue,
    drilldownSearchNames,
    includeHiddenSearches,
    includeDrilldownSearches,
    includeTableSearches,
  ]);

  // Entries the main browse list is allowed to render after App and
  // Visibility filters. Category / sub-category / tag option lists are
  // derived from this same slice so unavailable branches cannot be selected
  // into an empty result list.
  const browseVisibleEntries = useMemo(
    () =>
      visibilityEligibleEntries.filter((entry) =>
        entryMatchesAppSelection(entry, selectedApps),
      ),
    [selectedApps, visibilityEligibleEntries],
  );

  // Distinct, sorted category list - drives the Category dropdown.
  // Scoped to the active App and Visibility facets so app selections
  // and "show drilldown/table" toggles narrow the Category dropdown to
  // branches that can still render results.
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const e of browseVisibleEntries) {
      if (e.category) set.add(e.category);
    }
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    );
  }, [browseVisibleEntries]);

  // Sub-categories scoped to the current category, dispatch context,
  // and Visibility facets. Empty array when no category is picked —
  // that hides the dropdown.
  const subCategories = useMemo(() => {
    if (selectedCategory === ALL_CATEGORIES) return [];
    const set = new Set<string>();
    for (const e of browseVisibleEntries) {
      if (e.category !== selectedCategory) continue;
      if (e.subCategory) set.add(e.subCategory);
    }
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    );
  }, [browseVisibleEntries, selectedCategory]);

  useEffect(() => {
    if (
      selectedCategory !== ALL_CATEGORIES &&
      !categories.includes(selectedCategory)
    ) {
      setSelectedCategory(ALL_CATEGORIES);
    }
  }, [categories, selectedCategory]);

  useEffect(() => {
    if (
      selectedSubCategory !== ALL_SUB_CATEGORIES &&
      !subCategories.includes(selectedSubCategory)
    ) {
      setSelectedSubCategory(ALL_SUB_CATEGORIES);
    }
  }, [selectedSubCategory, subCategories]);

  // Distinct app namespaces (`dispatch_context` values) in the visibility
  // slice. Drives the App facet dropdown.
  const apps = useMemo(() => {
    const set = new Set<string>();
    for (const e of visibilityEligibleEntries) {
      if (e.catalogueApp) set.add(e.catalogueApp);
    }
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    );
  }, [visibilityEligibleEntries]);

  const appCountByName = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of visibilityEligibleEntries) {
      if (entry.catalogueApp) {
        map.set(entry.catalogueApp, (map.get(entry.catalogueApp) ?? 0) + 1);
      }
    }
    return map;
  }, [visibilityEligibleEntries]);

  useEffect(() => {
    setSelectedApps((current) => {
      if (current.size === 0) return current;
      const next = new Set([...current].filter((app) => apps.includes(app)));
      return next.size === current.size ? current : next;
    });
  }, [apps]);

  const [appLabelsById, setAppLabelsById] = useState<Map<string, string>>(
    () => new Map(),
  );

  useEffect(() => {
    let cancelled = false;
    getSplunkAppLabels(new Set(apps))
      .then((labels) => {
        if (!cancelled) setAppLabelsById(labels);
      })
      .catch(() => {
        if (!cancelled) setAppLabelsById(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, [apps]);

  const drilldownBaseEntries = useMemo(
    () =>
      catalogue.filter((entry) => {
        if (!entry.search?.trim()) return false;
        if (!selectedId) return true;
        return !entryMatchesKey(entry, selectedId);
      }),
    [catalogue, selectedId],
  );

  const drilldownApps = useMemo(() => {
    const set = new Set<string>();
    for (const entry of drilldownBaseEntries) {
      if (entry.catalogueApp) set.add(entry.catalogueApp);
    }
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    );
  }, [drilldownBaseEntries]);

  const drilldownAppCountByName = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of drilldownBaseEntries) {
      if (entry.catalogueApp) {
        map.set(entry.catalogueApp, (map.get(entry.catalogueApp) ?? 0) + 1);
      }
    }
    return map;
  }, [drilldownBaseEntries]);

  const drilldownCategories = useMemo(() => {
    const set = new Set<string>();
    for (const entry of drilldownBaseEntries) {
      if (!entryMatchesAppSelection(entry, drilldownSelectedApps)) {
        continue;
      }
      if (entry.category) set.add(entry.category);
    }
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    );
  }, [drilldownBaseEntries, drilldownSelectedApps]);

  const drilldownSubCategories = useMemo(() => {
    if (drilldownSelectedCategory === ALL_CATEGORIES) return [];
    const set = new Set<string>();
    for (const entry of drilldownBaseEntries) {
      if (!entryMatchesAppSelection(entry, drilldownSelectedApps)) {
        continue;
      }
      if (entry.category !== drilldownSelectedCategory) continue;
      if (entry.subCategory) set.add(entry.subCategory);
    }
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    );
  }, [drilldownBaseEntries, drilldownSelectedApps, drilldownSelectedCategory]);

  // Tag counts are scoped to the current result slice, including
  // already-selected tags. This makes the tag picker progressive:
  // after choosing one tag, the dropdown shows only tags that still
  // co-occur in the narrowed results rather than the full catalogue.
  const tagFacetEntries = useMemo(() => {
    return browseVisibleEntries.filter((entry) => {
      if (
        selectedCategory !== ALL_CATEGORIES &&
        entry.category !== selectedCategory
      ) {
        return false;
      }
      if (
        selectedSubCategory !== ALL_SUB_CATEGORIES &&
        entry.subCategory !== selectedSubCategory
      ) {
        return false;
      }
      if (activeTags.size > 0) {
        for (const tag of activeTags) {
          if (!entry.tags.includes(tag)) return false;
        }
      }
      return matchesQuery(entry, query);
    });
  }, [
    activeTags,
    browseVisibleEntries,
    query,
    selectedCategory,
    selectedSubCategory,
  ]);

  // Full tag counts for the narrowed slice, sorted by frequency
  // descending and then alphabetically.
  const allTagsWithCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of tagFacetEntries) {
      for (const tag of entry.tags) map.set(tag, (map.get(tag) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    );
  }, [tagFacetEntries]);

  const drilldownTagFacetEntries = useMemo(() => {
    return drilldownBaseEntries.filter((entry) => {
      if (
        !entryMatchesFacetSelection(
          entry,
          drilldownSelectedApps,
          drilldownSelectedCategory,
          drilldownSelectedSubCategory,
          drilldownActiveTags,
        )
      ) {
        return false;
      }
      return matchesQuery(entry, drilldownQuery);
    });
  }, [
    drilldownBaseEntries,
    drilldownSelectedApps,
    drilldownSelectedCategory,
    drilldownSelectedSubCategory,
    drilldownActiveTags,
    drilldownQuery,
  ]);

  const drilldownAllTagsWithCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of drilldownTagFacetEntries) {
      for (const tag of entry.tags) map.set(tag, (map.get(tag) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    );
  }, [drilldownTagFacetEntries]);

  const filtered = useMemo(() => {
    return browseVisibleEntries.filter((entry) => {
      if (
        selectedCategory !== ALL_CATEGORIES &&
        entry.category !== selectedCategory
      ) {
        return false;
      }
      if (
        selectedSubCategory !== ALL_SUB_CATEGORIES &&
        entry.subCategory !== selectedSubCategory
      ) {
        return false;
      }
      if (activeTags.size > 0) {
        // AND across selected tags so executives can compose
        // narrower filters (e.g. Network + Catalyst_Center).
        for (const t of activeTags) {
          if (!entry.tags.includes(t)) return false;
        }
      }
      return matchesQuery(entry, query);
    });
  }, [
    activeTags,
    browseVisibleEntries,
    query,
    selectedCategory,
    selectedSubCategory,
  ]);

  const selectedEntry = useMemo(
    () =>
      selectedId
        ? (catalogue.find((e) => entryMatchesKey(e, selectedId)) ?? null)
        : null,
    [catalogue, selectedId],
  );
  const selectedSearchbaseUrl = selectedEntry
    ? buildSearchbaseEditUrl(selectedEntry)
    : null;
  const selectedConfiguredDrilldownNames = useMemo(
    () =>
      selectedEntry
        ? configuredDrilldownNamesFor(selectedEntry, drilldownBindings)
        : [],
    [selectedEntry, drilldownBindings],
  );
  const selectedDrilldownEntries = useMemo(
    () =>
      drilldownDraftSearchNames.map((target) => ({
        target,
        entry:
          catalogue.find((candidate) => entryMatchesKey(candidate, target)) ??
          null,
      })),
    [catalogue, drilldownDraftSearchNames],
  );
  const drilldownCandidates = useMemo(() => {
    if (!selectedEntry) return [];
    const q = drilldownQuery.trim();
    return catalogue
      .filter((entry) => {
        if (!entry.search?.trim()) return false;
        if (entry.id === selectedEntry.id) return false;
        if (entry.searchName === selectedEntry.searchName) return false;
        if (
          !entryMatchesFacetSelection(
            entry,
            drilldownSelectedApps,
            drilldownSelectedCategory,
            drilldownSelectedSubCategory,
            drilldownActiveTags,
          )
        ) {
          return false;
        }
        return matchesQuery(entry, q);
      })
      .sort((a, b) => {
        const aSelected = drilldownDraftSearchNames.some((target) =>
          entryMatchesKey(a, target),
        )
          ? 1
          : 0;
        const bSelected = drilldownDraftSearchNames.some((target) =>
          entryMatchesKey(b, target),
        )
          ? 1
          : 0;
        if (aSelected !== bSelected) return bSelected - aSelected;
        const aTable = a.defaultViz === "splunk.table" ? 1 : 0;
        const bTable = b.defaultViz === "splunk.table" ? 1 : 0;
        if (aTable !== bTable) return bTable - aTable;
        return a.searchName.localeCompare(b.searchName, undefined, {
          sensitivity: "base",
        });
      });
  }, [
    catalogue,
    selectedEntry,
    drilldownQuery,
    drilldownDraftSearchNames,
    drilldownSelectedApps,
    drilldownSelectedCategory,
    drilldownSelectedSubCategory,
    drilldownActiveTags,
  ]);
  const selectedDescriptionPlain = useMemo(
    () => (selectedEntry ? plainTextFromHtml(selectedEntry.description) : ""),
    [selectedEntry],
  );

  useEffect(() => {
    if (!open || !selectedEntry) {
      drilldownDraftResetKeyRef.current = "";
      setDrilldownDraftSearchNames([]);
      setDrilldownQuery("");
      return;
    }
    const resetKey = `${selectedEntry.id}:${selectedConfiguredDrilldownNames.join("\u0000")}`;
    if (drilldownDraftResetKeyRef.current === resetKey) return;
    drilldownDraftResetKeyRef.current = resetKey;
    setDrilldownDraftSearchNames(selectedConfiguredDrilldownNames);
    setDrilldownQuery("");
  }, [open, selectedEntry?.id, selectedConfiguredDrilldownNames]);

  // Output column names parsed from the selected entry's SPL — drives
  // the clickable chip list under the Value Field input. Empty array
  // for SPL we can't statically infer columns from (e.g. a bare
  // `| eventstats` pass-through with no aliases), in which case we
  // hide the chip row and rely on the auto-detect placeholder.
  const splFieldSuggestions = useMemo(
    () => (selectedEntry ? extractSplFieldNames(selectedEntry.search) : []),
    [selectedEntry],
  );

  // Resolve the entry that's currently bound to this tile (whether by
  // the user via override or by the original tile config). Used by
  // the "currently bound" banner at the top of the list and by the
  // auto-scroll-on-open behaviour. Falls back to null if the binding
  // isn't in `searchbase.conf` (e.g. the tile points at a non-
  // searchbase saved search) — in which case there's no banner to
  // show because there's no entry to jump to.
  const currentBoundEntry = useMemo(() => {
    if (!context?.currentSavedSearch) return null;
    return (
      catalogue.find((e) => entryMatchesKey(e, context.currentSavedSearch)) ??
      null
    );
  }, [catalogue, context]);
  const currentBoundSearchbaseUrl = currentBoundEntry
    ? buildSearchbaseEditUrl(currentBoundEntry)
    : null;

  // Refs for scroll-to-current behaviour. When the panel opens, we
  // want the bound entry to be on-screen even if it's deep in a
  // 600+-entry alphabetical list. Browser-native `scrollIntoView`
  // with `block: 'center'` keeps it from sitting flush against the
  // sticky filters at the top.
  const listScrollRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Map<string, HTMLElement>>(new Map());
  const setItemRef = (id: string) => (el: HTMLElement | null) => {
    if (el) itemRefs.current.set(id, el);
    else itemRefs.current.delete(id);
  };
  const jumpToCurrent = () => {
    if (!currentBoundEntry) return;
    const el = itemRefs.current.get(currentBoundEntry.id);
    if (el) {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      // Also select it so the bottom panel updates to the
      // currently-bound entry's preview.
      setSelectedId(currentBoundEntry.id);
    }
  };

  // Run the jump once when the catalogue finishes loading and the
  // panel is open with a current binding. We delay one frame so the
  // list has rendered and the item refs are populated before we try
  // to scroll. Without that the lookup misses and nothing happens.
  useEffect(() => {
    if (!open || !currentBoundEntry) return undefined;
    const id = window.setTimeout(() => {
      const el = itemRefs.current.get(currentBoundEntry.id);
      if (el && listScrollRef.current) {
        el.scrollIntoView({ block: "center" });
      }
    }, 50);
    return () => window.clearTimeout(id);
  }, [open, currentBoundEntry, catalogue.length]);

  if (!context) return null;

  const fieldNameValid =
    valueField === "" || FIELD_NAME_PATTERN.test(valueField);
  const labelValid = labelOverride === "" || labelOverride.trim().length <= 80;

  // ---------- Threshold form derived state ----------
  //
  // `parseThresholdInput` accepts the raw text input and returns the
  // canonical numeric value (or `undefined` when the input is empty
  // or unparseable). Used for both validation feedback and the merge
  // into the apply payload — so the same parser drives the visible
  // "this isn't a number" hint and the persisted value, eliminating
  // any chance of a UI/runtime drift.
  const parseThresholdInput = (raw: string): number | undefined => {
    const trimmed = raw.trim();
    if (trimmed === "") return undefined;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : undefined;
  };

  const warningParsed = parseThresholdInput(thresholdWarningInput);
  const criticalParsed = parseThresholdInput(thresholdCriticalInput);
  const warningInputValid =
    thresholdWarningInput.trim() === "" || warningParsed !== undefined;
  const criticalInputValid =
    thresholdCriticalInput.trim() === "" || criticalParsed !== undefined;

  // Sanity-check the warning-vs-critical relationship for the chosen
  // direction. Used for an inline yellow hint, not a hard gate —
  // some operators intentionally invert the bands to disable a
  // colour (e.g. set warning > critical on `higher_is_better` to
  // suppress the warning band entirely).
  const thresholdRelationshipWarning: string | null = (() => {
    if (warningParsed === undefined || criticalParsed === undefined)
      return null;
    if (
      thresholdDirection === "higher_is_better" &&
      criticalParsed >= warningParsed
    ) {
      return '"Higher is better" usually wants critical < warning.';
    }
    if (
      thresholdDirection === "lower_is_better" &&
      criticalParsed <= warningParsed
    ) {
      return '"Lower is better" usually wants critical > warning.';
    }
    return null;
  })();

  // Live preview of the resulting bands. Built from the same
  // `deriveThresholdLines` the per-tile info popover uses, so what
  // the picker shows here is exactly what the popover will render
  // after Apply — no second source of truth that could drift.
  //
  // Intentionally NOT wrapped in useMemo: `deriveThresholdLines` is
  // O(1) (returns at most 3 short objects, no DOM work, no I/O), so
  // the memoization win is negligible while the cost — having to
  // sit *above* the `if (!open || !context) return null` early
  // return on line ~985 to satisfy the Rules of Hooks — is real.
  // Calling it directly on every render avoids React error #310
  // ("Rendered more hooks than during the previous render") that
  // hit Build 97 when the picker was opened from a tile config
  // gear, because before the panel opens the early return fires
  // and the hook never registers, but after it opens the hook
  // does — a different hook count between renders.
  const previewLines: ReturnType<typeof deriveThresholdLines> =
    !thresholdsEnabled ||
    (warningParsed === undefined && criticalParsed === undefined)
      ? undefined
      : deriveThresholdLines(
          {
            warning: warningParsed,
            critical: criticalParsed,
            direction: thresholdDirection,
          },
          context?.thresholdUnit,
        );

  // "Has the user changed any threshold field away from default?"
  // Drives the per-section "Reset to default" link visibility and
  // the "(custom)" badge on the collapsed THRESHOLDS toggle.
  const def = context?.defaultThresholds;
  const defaultThresholdsEnabled = def?.enabled !== false;
  const thresholdsCustomised =
    thresholdsEnabled !== defaultThresholdsEnabled ||
    warningParsed !== def?.warning ||
    criticalParsed !== def?.critical ||
    thresholdDirection !== (def?.direction ?? "higher_is_better");

  const canApply = Boolean(
    selectedEntry &&
    fieldNameValid &&
    labelValid &&
    warningInputValid &&
    criticalInputValid,
  );

  // Count of *applied* facets (excluding the in-progress tag-filter
  // typing buffer). Drives the "Filters (N active)" badge on the
  // collapsed toggle and feeds `facetsActive` for the Clear-filters
  // button visibility.
  const activeFilterCount =
    (!isDefaultAppSelection(selectedApps) ? 1 : 0) +
    (includeHiddenSearches ? 1 : 0) +
    (includeDrilldownSearches ? 1 : 0) +
    (includeTableSearches ? 1 : 0) +
    (selectedCategory !== ALL_CATEGORIES ? 1 : 0) +
    (selectedSubCategory !== ALL_SUB_CATEGORIES ? 1 : 0) +
    activeTags.size;

  const facetsActive = activeFilterCount > 0;
  const availableSearchCount = filtered.length;
  const availableSearchLabel = `${availableSearchCount.toLocaleString()} ${
    availableSearchCount === 1 ? "search" : "searches"
  } available`;
  const drilldownActiveFilterCount =
    (!isDefaultAppSelection(drilldownSelectedApps) ? 1 : 0) +
    (drilldownSelectedCategory !== ALL_CATEGORIES ? 1 : 0) +
    (drilldownSelectedSubCategory !== ALL_SUB_CATEGORIES ? 1 : 0) +
    drilldownActiveTags.size;
  const drilldownFacetsActive = drilldownActiveFilterCount > 0;

  const handleApply = () => {
    if (!selectedEntry || !canApply || !context) return;

    // ---- Personal display taste: always applies, always local. ----
    // Viz override (Build 1174) and the three display toggles are
    // the only things left in the localStorage override — chart
    // style and chrome-hiding are genuinely per-viewer taste, not
    // org-wide fact.
    const displayPayload: MetricOverride = {};
    if (vizOverrideInput) {
      displayPayload.vizOverride = vizOverrideInput;
    }
    if (hidePeakInput) displayPayload.hidePeak = true;
    if (hideDeltaInput) displayPayload.hideDelta = true;
    if (hideOverlayInput) displayPayload.hideOverlay = true;
    onApply(context.tileId, displayPayload);

    // ---- Org-wide fields: admin-only, saved server-side. ----
    // Thresholds / Data Mapping / Drilldown inputs render
    // read-only when `canManageFactoryConfig` is false, so there's
    // nothing meaningful to persist for a non-admin — bail rather
    // than silently no-op through `onSaveFactoryTileConfig`.
    if (!canManageFactoryConfig || !onSaveFactoryTileConfig) {
      return;
    }

    const thresholds: FactoryTileConfigApplyPatch["thresholds"] = {};
    if (thresholdsEnabled !== defaultThresholdsEnabled) {
      thresholds.enabled = thresholdsEnabled;
    }
    if (warningParsed !== def?.warning && warningParsed !== undefined) {
      thresholds.warning = warningParsed;
    }
    if (criticalParsed !== def?.critical && criticalParsed !== undefined) {
      thresholds.critical = criticalParsed;
    }
    const defaultDirection = def?.direction ?? "higher_is_better";
    if (thresholdDirection !== defaultDirection) {
      thresholds.direction = thresholdDirection;
    }

    const dataMapping: FactoryTileConfigApplyPatch["dataMapping"] = {};
    if (valueField !== (context.currentValueField ?? "")) {
      dataMapping.valueField = valueField || undefined;
    }
    const trimmedLabel = labelOverride.trim();
    if (trimmedLabel && trimmedLabel !== context.currentLabel) {
      dataMapping.label = trimmedLabel;
    }

    const searchChanged =
      selectedEntry.searchName !== context.currentSavedSearch;
    const nextDrilldowns =
      drilldownDraftSearchNames.length > 0 ? drilldownDraftSearchNames : null;
    const drilldownChanged = !sameOrderedStrings(
      nextDrilldowns ?? [],
      configuredDrilldownNamesFor(selectedEntry, drilldownBindings),
    );

    // Rebinding a tile to a different search is shared with the
    // current workspace's viewers, but
    // `selectedEntry` also drives simple browsing/previewing in
    // the results list above — clicking around to look at other
    // searches while this picker happens to be open for a
    // different tile is completely normal, and shouldn't silently
    // commit a rebind just because Apply was clicked afterward.
    // Require an explicit, named confirmation before a rebind
    // actually writes anything, same pattern as Factory Reset.
    const patch: FactoryTileConfigApplyPatch = {
      tileId: context.tileId,
      thresholds: Object.keys(thresholds).length > 0 ? thresholds : undefined,
      dataMapping:
        Object.keys(dataMapping).length > 0 ? dataMapping : undefined,
      newSearchName: searchChanged ? selectedEntry.searchName : undefined,
      drilldownSearchNames: drilldownChanged ? nextDrilldowns : undefined,
    };

    if (searchChanged) {
      setConfirmation({
        title: `Replace search for ${context.defaultLabel}?`,
        body: (
          <>
            <Paragraph>
              Current: {context.currentSavedSearch ?? "None"}
            </Paragraph>
            <Paragraph>New: {selectedEntry.searchName}</Paragraph>
            <Paragraph>
              This shared workspace tile will change for all viewers.
            </Paragraph>
          </>
        ),
        confirmLabel: "Replace search",
        onConfirm: () => void onSaveFactoryTileConfig(patch),
      });
      return;
    }

    void onSaveFactoryTileConfig(patch);
  };

  /**
   * Reset just the THRESHOLDS form back to the tile's static
   * defaults — pre-fills the inputs and the direction toggle so the
   * user sees what will be applied. Doesn't touch search binding,
   * value field, label, or description: scoped to thresholds only,
   * matching the per-section affordance pattern. The user still has
   * to hit Apply to commit the reset; if they Cancel afterwards,
   * nothing is persisted.
   */
  const handleResetThresholds = () => {
    const d = context?.defaultThresholds;
    setThresholdsEnabled(d?.enabled !== false);
    setThresholdWarningInput(
      d && d.warning !== undefined ? String(d.warning) : "",
    );
    setThresholdCriticalInput(
      d && d.critical !== undefined ? String(d.critical) : "",
    );
    setThresholdDirection(d?.direction ?? "higher_is_better");
  };

  /**
   * Reset the DISPLAY toggles back to the shipped defaults (Build
   * 1202). Both toggles ship `false`, so this just flips them off
   * regardless of their previous state. Scoped to the Display
   * section only — search binding, value field, label, chart
   * style, and thresholds are left untouched. User still has to
   * hit Apply to commit the reset.
   */
  const handleResetDisplay = () => {
    setHidePeakInput(false);
    setHideDeltaInput(false);
    setHideOverlayInput(false);
  };

  /**
   * Apply just the current Display selections to every tile in
   * this tile's section (Build 1203). Doesn't touch the tile's
   * search binding, value field, label, chart style, or
   * thresholds — scoped to the three display flags only. The
   * page-level handler decides how to merge onto each sibling
   * tile's existing override; we just hand it the patch and the
   * section id.
   *
   * The current tile is included in the fan-out: that way the
   * picker doesn't need a separate "apply locally + apply to
   * siblings" path. The page handler also writes the current
   * tile, so the user can close the picker afterwards without
   * having to also click Apply.
   */
  const handleApplyDisplayToSection = () => {
    if (!context?.sectionId || !onApplyDisplayToSection) return;
    onApplyDisplayToSection(context.sectionId, {
      hidePeak: hidePeakInput,
      hideDelta: hideDeltaInput,
      hideOverlay: hideOverlayInput,
    });
  };

  /**
   * Has the user changed any display toggle away from the shipped
   * default? Drives the "(custom)" badge on the Display section
   * heading and the visibility of the per-section "Reset to
   * default" affordance — same UX pattern as Chart style and
   * Thresholds.
   */
  const displayCustomised = hidePeakInput || hideDeltaInput || hideOverlayInput;

  const handleResetThisTile = () => {
    onClearOverride(context.tileId);
  };

  const handleResetAllCustomizations = () => {
    if (!onResetAllCustomizations) return;
    setConfirmation({
      title: "Reset all dashboard customizations?",
      body: (
        <Paragraph>
          This removes personal tile, section, map, and layout customizations.
          Published workspace configuration is kept. This cannot be undone.
        </Paragraph>
      ),
      confirmLabel: "Factory reset",
      destructive: true,
      onConfirm: onResetAllCustomizations,
    });
  };

  const handlePublishWorkspaceLayout = () => {
    if (!onPublishWorkspaceLayout) return;
    setConfirmation({
      title: "Publish workspace layout?",
      body: (
        <Paragraph>
          This updates the shared tile order and visible tile counts for all
          workspace viewers.
        </Paragraph>
      ),
      confirmLabel: "Publish layout",
      onConfirm: () => void onPublishWorkspaceLayout(),
    });
  };

  const handleClearFacets = () => {
    setSelectedApps(makeDefaultAppSelection());
    setIncludeHiddenSearches(false);
    setIncludeDrilldownSearches(false);
    setIncludeTableSearches(false);
    setSelectedCategory(ALL_CATEGORIES);
    setSelectedSubCategory(ALL_SUB_CATEGORIES);
    setActiveTags(new Set());
  };

  const handleClearDrilldownFacets = () => {
    setDrilldownSelectedApps(makeDefaultAppSelection());
    setDrilldownSelectedCategory(ALL_CATEGORIES);
    setDrilldownSelectedSubCategory(ALL_SUB_CATEGORIES);
    setDrilldownActiveTags(new Set());
  };

  return (
    <>
      <StyledDrawer
        id="configure-tile-drawer"
        divider="both"
        material="glass"
        onRequestClose={onClose}
        open={open}
        position="page"
        returnFocus={returnFocus}
        width="650px"
      >
        <Drawer.Header
          icon={<Settings2 aria-hidden="true" />}
          title="Configure tile"
          subtitle={context.defaultLabel}
        />

        <Drawer.Body>
          <Button
            appearance="subtle"
            disabled={!selectedEntry}
            icon={
              detailsCollapsed ? (
                <Settings2 aria-hidden="true" />
              ) : (
                <Maximize2 aria-hidden="true" />
              )
            }
            label={detailsCollapsed ? "Show tile options" : "Hide tile options"}
            onClick={() => setDetailsCollapsed((value) => !value)}
          />

          <ControlGroup hideLabel label="Search">
            <StyledSearch
              inputRef={searchInputRef}
              onChange={(_event, { value }) => setQuery(value)}
              placeholder="Search by name, description, or tag"
              value={query}
            />
          </ControlGroup>

          <CollapsiblePanel
            actions={
              facetsActive ? (
                <Button
                  appearance="subtle"
                  aria-label="Clear search filters"
                  label="Clear filters"
                  onClick={handleClearFacets}
                />
              ) : null
            }
            appearance="subtle"
            description={availableSearchLabel}
            inset
            onChange={(_event, { action }) => setFiltersOpen(action === "open")}
            open={filtersOpen}
            title={
              activeFilterCount > 0
                ? `Filters (${activeFilterCount} active)`
                : "Filters"
            }
          >
            <ControlGroup label="App">
              <Multiselect
                compact
                filter
                onChange={(_event, { values }) =>
                  setSelectedApps(new Set(values.map(String)))
                }
                placeholder={`All apps (${apps.length})`}
                showSelectedValuesFirst="nextOpen"
                values={Array.from(selectedApps)}
              >
                {apps.map((app) => (
                  <Multiselect.Option
                    description={`${appCountByName.get(app) ?? 0} searches`}
                    descriptionPosition="right"
                    key={app}
                    label={searchbaseAppLabel(app, appLabelsById)}
                    value={app}
                  />
                ))}
              </Multiselect>
            </ControlGroup>

            <ControlGroup controlsLayout="stack" label="Visibility">
              <Checkbox
                checked={includeHiddenSearches}
                onChange={(_event, { checked }) =>
                  setIncludeHiddenSearches(checked)
                }
              >
                Show hidden searches
              </Checkbox>
              <Checkbox
                checked={includeDrilldownSearches}
                onChange={(_event, { checked }) =>
                  setIncludeDrilldownSearches(checked)
                }
              >
                Show drill-down searches
              </Checkbox>
              <Checkbox
                checked={includeTableSearches}
                onChange={(_event, { checked }) =>
                  setIncludeTableSearches(checked)
                }
              >
                Show table searches
              </Checkbox>
            </ControlGroup>

            {categories.length > 1 && (
              <ControlGroup label="Category">
                <Select
                  onChange={(_event, { value }) =>
                    setSelectedCategory(String(value))
                  }
                  value={selectedCategory}
                >
                  <Select.Option
                    label="All categories"
                    value={ALL_CATEGORIES}
                  />
                  {categories.map((category) => (
                    <Select.Option
                      key={category}
                      label={category}
                      value={category}
                    />
                  ))}
                </Select>
              </ControlGroup>
            )}

            {selectedCategory !== ALL_CATEGORIES &&
              subCategories.length > 0 && (
                <ControlGroup label="Subcategory">
                  <Select
                    onChange={(_event, { value }) =>
                      setSelectedSubCategory(String(value))
                    }
                    value={selectedSubCategory}
                  >
                    <Select.Option
                      label={`All subcategories (${subCategories.length})`}
                      value={ALL_SUB_CATEGORIES}
                    />
                    {subCategories.map((subCategory) => (
                      <Select.Option
                        key={subCategory}
                        label={subCategory}
                        value={subCategory}
                      />
                    ))}
                  </Select>
                </ControlGroup>
              )}

            {(allTagsWithCounts.length > 0 || activeTags.size > 0) && (
              <ControlGroup
                help="Selected tags are combined with AND."
                label="Tags"
              >
                <Multiselect
                  compact
                  filter
                  onChange={(_event, { values }) =>
                    setActiveTags(new Set(values.map(String)))
                  }
                  placeholder={`All tags (${allTagsWithCounts.length})`}
                  showSelectedValuesFirst="nextOpen"
                  values={Array.from(activeTags)}
                >
                  {allTagsWithCounts.map(([tag, count]) => (
                    <Multiselect.Option
                      description={`${count} searches`}
                      descriptionPosition="right"
                      key={tag}
                      label={tag}
                      value={tag}
                    />
                  ))}
                </Multiselect>
              </ControlGroup>
            )}
          </CollapsiblePanel>

          {currentBoundEntry && !boundDismissed && (
            <Message
              appearance="fill"
              onRequestRemove={() => setBoundDismissed(true)}
              type="success"
            >
              <Message.Title>Bound search</Message.Title>
              <Paragraph>{currentBoundEntry.searchName}</Paragraph>
              <Layout data-current-search-actions="true">
                <Button
                  appearance="standalone"
                  label="Jump to"
                  onClick={jumpToCurrent}
                />
                {currentBoundSearchbaseUrl && (
                  <Button
                    appearance="standalone"
                    label="View in Searchbase"
                    openInNewContext
                    to={currentBoundSearchbaseUrl}
                  />
                )}
                {onTestInSearch && currentBoundEntry.search && (
                  <Button
                    appearance="standalone"
                    icon={<Play aria-hidden="true" />}
                    label="Test in Search"
                    onClick={() =>
                      onTestInSearch(
                        currentBoundEntry.search,
                        currentBoundEntry.dispatchContext,
                      )
                    }
                  />
                )}
              </Layout>
            </Message>
          )}

          <div
            aria-busy={loadState === "loading"}
            id="kpi-picker-search-results"
            ref={listScrollRef}
          >
            <ScreenReaderContent aria-live="polite" role="status">
              {loadState === "loading"
                ? "Loading searches"
                : loadState === "idle"
                  ? availableSearchLabel
                  : "Searches could not be loaded"}
            </ScreenReaderContent>
            {loadState === "loading" && (
              <Layout>
                <WaitSpinner screenReaderText={null} size="medium" />
                <span>Loading searches</span>
              </Layout>
            )}

            {loadState === "error" && (
              <Message role="alert" type="error">
                <Message.Title>Couldn't load searchbase.conf</Message.Title>
                {errorMsg}
              </Message>
            )}

            {loadState === "idle" && filtered.length === 0 && (
              <Message type="info">
                No searches match the current filters.
              </Message>
            )}

            {loadState === "idle" && filtered.length > 0 && (
              <CardLayout cardWidth="100%">
                {filtered.map((entry) => {
                  const isSelected = entryMatchesKey(entry, selectedId);
                  const isCurrent =
                    currentBoundEntry !== null &&
                    currentBoundEntry.id === entry.id;
                  const isInUse = entryIsUsed(entry, context.usedSavedSearches);
                  const plainDesc = plainTextFromHtml(entry.description);
                  return (
                    <Card
                      aria-pressed={isSelected}
                      elementRef={setItemRef(entry.id)}
                      key={entry.id}
                      onClick={() => setSelectedId(entry.id)}
                      value={entry.id}
                    >
                      <Card.Header
                        icon={
                          entry.defaultViz ? (
                            <VizIcon splunkViz={entry.defaultViz} size={16} />
                          ) : undefined
                        }
                        subtitle={
                          [entry.category, entry.subCategory]
                            .filter(Boolean)
                            .join(" / ") || entry.id
                        }
                        title={
                          <Layout>
                            <span>
                              {highlightMatch(entry.searchName, query)}
                            </span>
                            {isSelected && <Badge label="Selected" />}
                            {isCurrent && <Badge label="Current" />}
                            {isInUse && !isCurrent && <Badge label="In use" />}
                          </Layout>
                        }
                      />
                      {(plainDesc ||
                        entry.tags.length > 0 ||
                        (entry.drilldownSearchNames?.length ?? 0) > 0) && (
                        <Card.Body>
                          {plainDesc && (
                            <Paragraph>
                              {highlightMatch(plainDesc, query)}
                            </Paragraph>
                          )}
                          <Layout>
                            {entry.tags.slice(0, 4).map((tag) => (
                              <Chip key={tag}>{tag}</Chip>
                            ))}
                            {entry.tags.length > 4 && (
                              <Chip>+{entry.tags.length - 4}</Chip>
                            )}
                            {(entry.drilldownSearchNames?.length ?? 0) > 0 && (
                              <Chip
                                appearance="success"
                                icon={<Table2 aria-hidden="true" />}
                              >
                                {entry.drilldownSearchNames?.length} drilldown
                              </Chip>
                            )}
                          </Layout>
                        </Card.Body>
                      )}
                    </Card>
                  );
                })}
              </CardLayout>
            )}
          </div>

          {/* Selection preview + form.
           *
           * `max-h-[48%]` gives the accordion editor enough
           * room to breathe when one section is open while the
           * search result list still owns the majority of the
           * drawer. The internal `overflow-auto` keeps every
           * field reachable when the panel content exceeds the
           * cap, and the footer lives in a separate sibling so
           * primary actions stay anchored. */}
          <div
            className={cn(
              "border-t  sui-border-weak flex-shrink-0",
              detailsCollapsed
                ? "px-3 py-2 max-h-[118px] overflow-hidden"
                : "px-4 py-3 space-y-2.5 max-h-[48%] overflow-auto",
            )}
          >
            {selectedEntry ? (
              detailsCollapsed ? (
                <Layout>
                  <VizIcon
                    splunkViz={selectedEntry.defaultViz}
                    size={14}
                    showTooltip={false}
                  />
                  <div className="min-w-0 flex-1">
                    <Layout>
                      {selectedEntry.category && (
                        <Chip>
                          {[selectedEntry.category, selectedEntry.subCategory]
                            .filter(Boolean)
                            .join(" / ")}
                        </Chip>
                      )}
                      <Chip>
                        {resolveVizMapping(selectedEntry.defaultViz).label}
                      </Chip>
                    </Layout>
                    <Paragraph title={selectedEntry.searchName}>
                      {selectedEntry.searchName}
                    </Paragraph>
                    <Layout>
                      {selectedSearchbaseUrl && (
                        <Button
                          appearance="standalone"
                          label="Searchbase"
                          openInNewContext
                          to={selectedSearchbaseUrl}
                        />
                      )}
                      {onTestInSearch && selectedEntry.search && (
                        <Button
                          appearance="standalone"
                          icon={<Play aria-hidden="true" />}
                          label="Test"
                          onClick={() =>
                            onTestInSearch(
                              selectedEntry.search,
                              selectedEntry.dispatchContext,
                            )
                          }
                        />
                      )}
                    </Layout>
                  </div>
                  <Button
                    appearance="subtle"
                    icon={<Settings2 aria-hidden="true" />}
                    label="Options"
                    onClick={() => setDetailsCollapsed(false)}
                  />
                </Layout>
              ) : (
                <>
                  <div>
                    {/* Build 96: chips moved inline with the
                                    "Search name" header line. The
                                    header was a near-empty ~16px row
                                    (label + viz icon) and the chips
                                    row was a 30–50px wraparound row
                                    that ate vertical real-estate every
                                    render. Folding them into a single
                                    flex row reclaims ~30–50px without
                                    hiding any info — the category /
                                    sub-cat chip and individual tag
                                    chips still render at the same
                                    size, and the viz-type pill stays
                                    right-anchored as the
                                    "yes-this-is-what-Apply-renders"
                                    confirmation. Long chip lists wrap
                                    rather than overflow horizontally
                                    so nothing is silently clipped. */}
                    <Layout>
                      {selectedEntry.category && (
                        <Chip appearance="info">
                          {[selectedEntry.category, selectedEntry.subCategory]
                            .filter(Boolean)
                            .join(" · ")}
                        </Chip>
                      )}
                      {selectedEntry.tags.map((t) => (
                        <Chip key={t}>{t}</Chip>
                      ))}
                      {/* Viz-type pill, right-anchored.
                                        `ml-auto` pushes it past any
                                        category/tag chips that
                                        accumulate on the same wrap
                                        line. */}
                      <Chip
                        icon={
                          <VizIcon
                            splunkViz={selectedEntry.defaultViz}
                            size={12}
                            showTooltip={false}
                          />
                        }
                      >
                        {resolveVizMapping(selectedEntry.defaultViz).label}
                      </Chip>
                      <Button
                        appearance="subtle"
                        icon={<Maximize2 aria-hidden="true" />}
                        label="Hide tile options"
                        onClick={() => setDetailsCollapsed(true)}
                      />
                    </Layout>
                    <Paragraph title="Drag to select part of the search name for copying.">
                      {selectedEntry.searchName}
                    </Paragraph>
                    <Layout>
                      {selectedSearchbaseUrl && (
                        <Button
                          appearance="standalone"
                          label="View in Searchbase"
                          openInNewContext
                          to={selectedSearchbaseUrl}
                        />
                      )}
                      {onTestInSearch && selectedEntry.search && (
                        <Button
                          appearance="standalone"
                          icon={<Play aria-hidden="true" />}
                          label="Test in Search"
                          onClick={() =>
                            onTestInSearch(
                              selectedEntry.search,
                              selectedEntry.dispatchContext,
                            )
                          }
                        />
                      )}
                      {drilldownDraftSearchNames.length > 0 && (
                        <Chip
                          appearance="success"
                          icon={<Table2 aria-hidden="true" />}
                        >
                          {drilldownDraftSearchNames.length}{" "}
                          {drilldownDraftSearchNames.length === 1
                            ? "drilldown search"
                            : "drilldown searches"}
                        </Chip>
                      )}
                    </Layout>
                  </div>

                  <CollapsiblePanel
                    appearance="subtle"
                    description={`${valueField ? `Value: ${valueField}` : "Automatic value"}${labelOverride.trim() ? " · Custom label" : ""}`}
                    inset
                    onChange={(_event, { action }) =>
                      setDataMappingOpen(action === "open")
                    }
                    open={dataMappingOpen}
                    title="Data mapping"
                  >
                    <ControlGroup
                      error={
                        !fieldNameValid &&
                        "Letters, digits, underscores, and dots only."
                      }
                      help={
                        !canManageFactoryConfig
                          ? "Org-wide setting — requires admin"
                          : "Leave blank to automatically select the first numeric result field."
                      }
                      label="Value field"
                    >
                      <Text
                        disabled={!canManageFactoryConfig}
                        error={!fieldNameValid}
                        value={valueField}
                        onChange={(_event, { value }) =>
                          setValueField(value.slice(0, MAX_FIELD_LENGTH))
                        }
                        placeholder="auto-detect"
                      />
                      {/* Clickable chips parsed from the SPL — these
                                        are the columns the search will emit (`as
                                        <alias>` and `eval <name>`). Clicking one
                                        fills the input. Helps users discover
                                        valid column names without having to read
                                        the SPL — and makes it obvious that
                                        typing a non-emitted column won't match.
                                        Hidden when no aliases parse out. */}
                      {fieldNameValid && splFieldSuggestions.length > 0 && (
                        <Layout>
                          {splFieldSuggestions.map((name) => {
                            const isPicked = valueField === name;
                            return (
                              <Button
                                appearance={isPicked ? "secondary" : "subtle"}
                                key={name}
                                label={name}
                                onClick={() => setValueField(name)}
                              />
                            );
                          })}
                        </Layout>
                      )}
                      {fieldNameValid &&
                        valueField &&
                        splFieldSuggestions.length > 0 &&
                        !splFieldSuggestions.includes(valueField) && (
                          <Message type="warning">
                            "{valueField}" doesn't match any column emitted by
                            this SPL.
                          </Message>
                        )}
                    </ControlGroup>
                    <ControlGroup label="Label override">
                      <Text
                        disabled={!canManageFactoryConfig}
                        value={labelOverride}
                        onChange={(_event, { value }) =>
                          setLabelOverride(value.slice(0, 80))
                        }
                        placeholder={context.defaultLabel}
                      />
                    </ControlGroup>
                  </CollapsiblePanel>

                  <CollapsiblePanel
                    appearance="subtle"
                    description={
                      drilldownDraftSearchNames.length > 0
                        ? `${drilldownDraftSearchNames.length} searches`
                        : "None"
                    }
                    inset
                    onChange={(_event, { action }) =>
                      setDrilldownOpen(action === "open")
                    }
                    open={drilldownOpen}
                    title="Drilldown"
                  >
                    <div className="space-y-2">
                      <div>
                        {selectedDrilldownEntries.length > 0 ? (
                          <>
                            <Layout>
                              <strong>Navigation order</strong>
                              <Button
                                appearance="standalone"
                                label="Clear all"
                                onClick={() => setDrilldownDraftSearchNames([])}
                              />
                            </Layout>
                            <CardLayout cardWidth="100%">
                              {selectedDrilldownEntries.map(
                                ({ target, entry }, index) => {
                                  const searchbaseUrl = entry
                                    ? buildSearchbaseEditUrl(entry)
                                    : null;
                                  return (
                                    <Card key={target}>
                                      <Card.Header
                                        actions={() => (
                                          <Button
                                            appearance="subtle"
                                            icon={<X aria-hidden="true" />}
                                            onClick={() =>
                                              setDrilldownDraftSearchNames(
                                                (current) =>
                                                  current.filter(
                                                    (candidate) =>
                                                      candidate !== target,
                                                  ),
                                              )
                                            }
                                            label={`Remove ${entry?.searchName ?? target}`}
                                          />
                                        )}
                                        icon={
                                          <Badge label={String(index + 1)} />
                                        }
                                        title={entry?.searchName ?? target}
                                      />
                                      {(searchbaseUrl ||
                                        (onTestInSearch && entry?.search)) && (
                                        <Card.Body>
                                          <Layout>
                                            {searchbaseUrl && (
                                              <Button
                                                appearance="standalone"
                                                aria-label={`Open ${entry?.searchName ?? target} in Searchbase`}
                                                label="Searchbase"
                                                openInNewContext
                                                to={searchbaseUrl}
                                              />
                                            )}
                                            {onTestInSearch &&
                                              entry?.search && (
                                                <Button
                                                  appearance="standalone"
                                                  aria-label={`Test ${entry?.searchName ?? target} in Search`}
                                                  icon={
                                                    <Play aria-hidden="true" />
                                                  }
                                                  label="Test"
                                                  onClick={() =>
                                                    onTestInSearch(
                                                      entry.search,
                                                      entry.dispatchContext,
                                                    )
                                                  }
                                                />
                                              )}
                                          </Layout>
                                        </Card.Body>
                                      )}
                                    </Card>
                                  );
                                },
                              )}
                            </CardLayout>
                          </>
                        ) : (
                          <Paragraph>No drilldown attached.</Paragraph>
                        )}
                      </div>

                      <ControlGroup hideLabel label="Search drilldowns">
                        <StyledSearch
                          onChange={(_event, { value }) =>
                            setDrilldownQuery(value)
                          }
                          placeholder="Search Searchbase drilldowns"
                          value={drilldownQuery}
                        />
                      </ControlGroup>

                      <CollapsiblePanel
                        actions={
                          drilldownFacetsActive ? (
                            <Button
                              appearance="subtle"
                              aria-label="Clear drilldown filters"
                              label="Clear filters"
                              onClick={handleClearDrilldownFacets}
                            />
                          ) : null
                        }
                        appearance="subtle"
                        inset
                        onChange={(_event, { action }) =>
                          setDrilldownFiltersOpen(action === "open")
                        }
                        open={drilldownFiltersOpen}
                        title={
                          drilldownActiveFilterCount > 0
                            ? `Filters (${drilldownActiveFilterCount} active)`
                            : "Filters"
                        }
                      >
                        <ControlGroup label="App">
                          <Multiselect
                            compact
                            filter
                            onChange={(_event, { values }) =>
                              setDrilldownSelectedApps(
                                new Set(values.map(String)),
                              )
                            }
                            placeholder={`All apps (${drilldownApps.length})`}
                            values={Array.from(drilldownSelectedApps)}
                          >
                            {drilldownApps.map((app) => (
                              <Multiselect.Option
                                description={`${drilldownAppCountByName.get(app) ?? 0} searches`}
                                descriptionPosition="right"
                                key={app}
                                label={searchbaseAppLabel(app, appLabelsById)}
                                value={app}
                              />
                            ))}
                          </Multiselect>
                        </ControlGroup>

                        {drilldownCategories.length > 1 && (
                          <ControlGroup label="Category">
                            <Select
                              value={drilldownSelectedCategory}
                              onChange={(_event, { value }) =>
                                setDrilldownSelectedCategory(String(value))
                              }
                            >
                              <Select.Option
                                label="All categories"
                                value={ALL_CATEGORIES}
                              />
                              {drilldownCategories.map((category) => (
                                <Select.Option
                                  key={category}
                                  label={category}
                                  value={category}
                                />
                              ))}
                            </Select>
                          </ControlGroup>
                        )}

                        {drilldownSelectedCategory !== ALL_CATEGORIES &&
                          drilldownSubCategories.length > 0 && (
                            <ControlGroup label="Subcategory">
                              <Select
                                value={drilldownSelectedSubCategory}
                                onChange={(_event, { value }) =>
                                  setDrilldownSelectedSubCategory(String(value))
                                }
                              >
                                <Select.Option
                                  label={`All subcategories (${drilldownSubCategories.length})`}
                                  value={ALL_SUB_CATEGORIES}
                                />
                                {drilldownSubCategories.map((subCategory) => (
                                  <Select.Option
                                    key={subCategory}
                                    label={subCategory}
                                    value={subCategory}
                                  />
                                ))}
                              </Select>
                            </ControlGroup>
                          )}

                        {(drilldownAllTagsWithCounts.length > 0 ||
                          drilldownActiveTags.size > 0) && (
                          <ControlGroup
                            help="Selected tags are combined with AND."
                            label="Tags"
                          >
                            <Multiselect
                              compact
                              filter
                              onChange={(_event, { values }) =>
                                setDrilldownActiveTags(
                                  new Set(values.map(String)),
                                )
                              }
                              placeholder={`All tags (${drilldownAllTagsWithCounts.length})`}
                              values={Array.from(drilldownActiveTags)}
                            >
                              {drilldownAllTagsWithCounts.map(
                                ([tag, count]) => (
                                  <Multiselect.Option
                                    description={`${count} searches`}
                                    descriptionPosition="right"
                                    key={tag}
                                    label={tag}
                                    value={tag}
                                  />
                                ),
                              )}
                            </Multiselect>
                          </ControlGroup>
                        )}
                      </CollapsiblePanel>

                      <Layout>
                        <Badge
                          label={`${drilldownCandidates.length.toLocaleString()} ${drilldownCandidates.length === 1 ? "match" : "matches"}`}
                        />
                        <Badge
                          label={`${drilldownBaseEntries.length.toLocaleString()} searchable`}
                        />
                      </Layout>

                      {drilldownCandidates.length === 0 ? (
                        <Paragraph>No matching Searchbase entries.</Paragraph>
                      ) : (
                        <CardLayout cardWidth="100%">
                          {drilldownCandidates.map((entry) => {
                            const isPicked = drilldownDraftSearchNames.some(
                              (target) => entryMatchesKey(entry, target),
                            );
                            const viz = resolveVizMapping(entry.defaultViz);
                            const description = plainTextFromHtml(
                              entry.description,
                            );
                            return (
                              <Card key={entry.id}>
                                <Card.Header
                                  actions={() => (
                                    <Checkbox
                                      aria-label={`Select ${entry.searchName} for drilldown`}
                                      checked={isPicked}
                                      onChange={() =>
                                        setDrilldownDraftSearchNames(
                                          (current) =>
                                            isPicked
                                              ? current.filter(
                                                  (target) =>
                                                    !entryMatchesKey(
                                                      entry,
                                                      target,
                                                    ),
                                                )
                                              : current.length <
                                                  DRILLDOWN_TARGET_LIMIT
                                                ? [...current, entry.id]
                                                : current,
                                        )
                                      }
                                    />
                                  )}
                                  icon={
                                    <VizIcon
                                      splunkViz={entry.defaultViz}
                                      size={16}
                                      showTooltip={false}
                                    />
                                  }
                                  subtitle={viz.label}
                                  title={highlightMatch(
                                    entry.searchName,
                                    drilldownQuery,
                                  )}
                                />
                                {description && (
                                  <Card.Body>
                                    <Paragraph>{description}</Paragraph>
                                  </Card.Body>
                                )}
                              </Card>
                            );
                          })}
                        </CardLayout>
                      )}
                    </div>
                  </CollapsiblePanel>

                  {/* CHART STYLE form.
                   *
                   * Lets the operator override how the tile
                   * renders WITHOUT changing which search
                   * drives it. Storage rule: persisted only
                   * when the user picks something other than
                   * "Default"; picking Default silently
                   * drops the override field from the stored
                   * payload. The runtime resolves structural
                   * choices (table, pie, gauge, breakdown)
                   * before the sparkline path, so this list
                   * only exposes renderer families the
                   * overview page can actually draw. */}
                  <CollapsiblePanel
                    actions={
                      vizOverrideInput ? (
                        <Button
                          appearance="subtle"
                          aria-label="Reset chart style to default"
                          icon={<RotateCcw aria-hidden="true" />}
                          label="Reset to default"
                          onClick={() => setVizOverrideInput(null)}
                        />
                      ) : null
                    }
                    appearance="subtle"
                    description={
                      vizOverrideInput
                        ? "Custom"
                        : `Default: ${resolveVizMapping(selectedEntry.defaultViz).label}`
                    }
                    inset
                    onChange={(_event, { action }) =>
                      setChartStyleOpen(action === "open")
                    }
                    open={chartStyleOpen}
                    title="Chart style"
                  >
                    <ControlGroup
                      help="Default uses the searchbase default_viz setting."
                      label="Visualization"
                    >
                      <RadioBar
                        onChange={(_event, { value }) =>
                          setVizOverrideInput(
                            value === "default"
                              ? null
                              : (value as Exclude<
                                  MetricOverride["vizOverride"],
                                  undefined
                                >),
                          )
                        }
                        value={vizOverrideInput ?? "default"}
                      >
                        {CHART_STYLE_OPTIONS.map((option) => (
                          <RadioBar.Option
                            key={option.label}
                            label={option.label}
                            value={option.v ?? "default"}
                          />
                        ))}
                      </RadioBar>
                    </ControlGroup>
                  </CollapsiblePanel>

                  {/* DISPLAY form (Build 1202, from Atef's
                   * review on 2026-05-19; Build 1203 added
                   * the previous-period overlay toggle and
                   * the section-apply shortcut).
                   *
                   * Two opt-out toggles that silence the
                   * "chrome" around the headline value when
                   * the operator wants the tile to read as a
                   * clean single number. Distinct from Chart
                   * style: Chart style controls the
                   * underlying viz (area/line/column/bar/
                   * single); these toggles only affect the
                   * decoration that sits on top of whichever
                   * viz is active.
                   *
                   * Why no "hide sparkline" toggle: Chart
                   * style → Single already collapses the
                   * chart entirely, and a third toggle here
                   * would duplicate that state with two
                   * competing controls. The helper text
                   * points users there if that's what they
                   * actually want.
                   *
                   * Storage rule: only `true` is persisted
                   * (sanitiser drops anything else), so a
                   * future flip of the shipped default flows
                   * through automatically for any tile the
                   * user hasn't customised. */}
                  <CollapsiblePanel
                    actions={
                      displayCustomised ? (
                        <Button
                          appearance="subtle"
                          aria-label="Reset display to default"
                          icon={<RotateCcw aria-hidden="true" />}
                          label="Reset to default"
                          onClick={handleResetDisplay}
                        />
                      ) : null
                    }
                    appearance="subtle"
                    description={displayCustomised ? "Custom" : "Default"}
                    inset
                    onChange={(_event, { action }) =>
                      setDisplayOpen(action === "open")
                    }
                    open={displayOpen}
                    title="Display"
                  >
                    <ControlGroup
                      controlsLayout="stack"
                      help="To remove the chart entirely, choose Single under Chart style."
                      label="Tile details"
                    >
                      <Checkbox
                        checked={hidePeakInput}
                        onChange={(_event, { checked }) =>
                          setHidePeakInput(checked)
                        }
                      >
                        Hide peak labels
                      </Checkbox>
                      <Checkbox
                        checked={hideDeltaInput}
                        onChange={(_event, { checked }) =>
                          setHideDeltaInput(checked)
                        }
                      >
                        Hide delta vs previous
                      </Checkbox>
                      <Checkbox
                        checked={hideOverlayInput}
                        onChange={(_event, { checked }) =>
                          setHideOverlayInput(checked)
                        }
                      >
                        Hide comparison overlay
                      </Checkbox>
                    </ControlGroup>
                    {/* Section-level apply shortcut (Build
                     * 1203, from Atef's "global vs per
                     * KPI" framing). Surfaces only when
                     * the page wired a handler AND the
                     * tile reports a section id. Writes
                     * the *current* Display selections
                     * (whatever the toggles read right
                     * now) to every tile in this section
                     * — including this one — so the user
                     * can close the picker without a
                     * separate Apply click. Threshold
                     * and Chart style customisations
                     * remain per-tile by design. */}
                    {displayOpen &&
                      context?.sectionId &&
                      onApplyDisplayToSection && (
                        <Layout>
                          <Button
                            appearance="standalone"
                            icon={<Eye aria-hidden="true" />}
                            label={`Apply to all tiles in ${context.sectionLabel || "section"}`}
                            onClick={handleApplyDisplayToSection}
                          />
                        </Layout>
                      )}
                  </CollapsiblePanel>

                  <CollapsiblePanel
                    actions={
                      thresholdsCustomised ? (
                        <Button
                          appearance="subtle"
                          aria-label="Reset thresholds to default"
                          icon={<RotateCcw aria-hidden="true" />}
                          label="Reset to default"
                          onClick={handleResetThresholds}
                        />
                      ) : null
                    }
                    appearance="subtle"
                    description={
                      !thresholdsEnabled
                        ? "Off"
                        : thresholdsCustomised
                          ? "Custom"
                          : "Default"
                    }
                    inset
                    onChange={(_event, { action }) =>
                      setThresholdsOpen(action === "open")
                    }
                    open={thresholdsOpen}
                    title="Thresholds"
                  >
                    {!canManageFactoryConfig && (
                      <Message type="warning">
                        Org-wide setting — requires admin to change.
                      </Message>
                    )}
                    <ControlGroup
                      help="Off removes threshold colors and status icons while preserving the configured bands."
                      label="Status colors"
                    >
                      <Switch
                        appearance="toggle"
                        selected={thresholdsEnabled}
                        disabled={!canManageFactoryConfig}
                        onClick={() =>
                          setThresholdsEnabled((enabled) => !enabled)
                        }
                      >
                        Use thresholds
                      </Switch>
                    </ControlGroup>

                    {/* Direction segmented control — two
                                            mutually-exclusive buttons. The
                                            small description under each
                                            segment doubles as a teach-in
                                            (operators sometimes forget which
                                            way the bands work for inverted
                                            metrics). */}
                    <ControlGroup
                      help={
                        thresholdDirection === "higher_is_better"
                          ? "Healthy when value is at or above warning."
                          : "Healthy when value is at or below warning."
                      }
                      label="Direction"
                    >
                      <RadioBar
                        disabled={!canManageFactoryConfig || !thresholdsEnabled}
                        onChange={(_event, { value }) =>
                          setThresholdDirection(
                            value as MetricThresholds["direction"],
                          )
                        }
                        value={thresholdDirection}
                      >
                        <RadioBar.Option
                          label="Higher is better"
                          value="higher_is_better"
                        />
                        <RadioBar.Option
                          label="Lower is better"
                          value="lower_is_better"
                        />
                      </RadioBar>
                    </ControlGroup>

                    {/* Warning + Critical inputs side by
                                            side. Each shows the static
                                            default in the helper line under
                                            the input so the user can always
                                            see what the tile shipped with. */}
                    <ControlGroup
                      error={!warningInputValid && "Enter a valid number."}
                      help={
                        def?.warning !== undefined
                          ? `Default: ${formatThresholdNumber(def.warning, context.thresholdUnit)}`
                          : "No shipped default"
                      }
                      label="Warning"
                    >
                      <Text
                        type="number"
                        disabled={!canManageFactoryConfig || !thresholdsEnabled}
                        error={!warningInputValid}
                        value={thresholdWarningInput}
                        onChange={(_event, { value }) =>
                          setThresholdWarningInput(value.slice(0, 32))
                        }
                        placeholder={
                          def?.warning !== undefined
                            ? String(def.warning)
                            : "none"
                        }
                      />
                    </ControlGroup>
                    <ControlGroup
                      error={!criticalInputValid && "Enter a valid number."}
                      help={
                        def?.critical !== undefined
                          ? `Default: ${formatThresholdNumber(def.critical, context.thresholdUnit)}`
                          : "No shipped default"
                      }
                      label="Critical"
                    >
                      <Text
                        type="number"
                        disabled={!canManageFactoryConfig || !thresholdsEnabled}
                        error={!criticalInputValid}
                        value={thresholdCriticalInput}
                        onChange={(_event, { value }) =>
                          setThresholdCriticalInput(value.slice(0, 32))
                        }
                        placeholder={
                          def?.critical !== undefined
                            ? String(def.critical)
                            : "none"
                        }
                      />
                    </ControlGroup>

                    {/* Sanity-check hint — non-blocking.
                                            Some operators intentionally
                                            invert the bands to suppress a
                                            colour, so we surface the issue
                                            but don't gate Apply on it. */}
                    {thresholdRelationshipWarning && (
                      <Message type="warning">
                        {thresholdRelationshipWarning}
                      </Message>
                    )}

                    {/* Live preview — same words and
                                            ranges the per-tile info popover
                                            will render after Apply, because
                                            both call `deriveThresholdLines`
                                            with the same `MetricThresholds`
                                            tuple. */}
                    {previewLines && previewLines.length > 0 && (
                      <ControlGroup controlsLayout="none" label="Preview">
                        <Layout>
                          {previewLines.map((row) => (
                            <Chip
                              appearance={
                                row.tone === "healthy"
                                  ? "success"
                                  : row.tone === "critical"
                                    ? "error"
                                    : "warning"
                              }
                              key={row.tone}
                            >
                              {row.label}: {row.value}
                            </Chip>
                          ))}
                        </Layout>
                      </ControlGroup>
                    )}

                    {/* No-thresholds message — both
                                            inputs blank with no shipped
                                            defaults. The form is still usable
                                            (user can establish thresholds
                                            from scratch if they swap the
                                            tile to a numeric search), but we
                                            tell them what the runtime
                                            behaviour will be. */}
                    {!thresholdsEnabled ? (
                      <Message type="info">
                        Threshold status is off — the headline uses its neutral
                        colour and no status icon.
                      </Message>
                    ) : !previewLines ? (
                      <Message type="info">
                        No thresholds set — the headline will render in the
                        neutral colour with no status icon.
                      </Message>
                    ) : null}
                  </CollapsiblePanel>
                </>
              )
            ) : (
              <Paragraph>
                Pick a search above to preview SPL and apply.
              </Paragraph>
            )}
          </div>
        </Drawer.Body>

        <Drawer.Footer layout="none">
          <Layout>
            <Button
              appearance="subtle"
              icon={<RotateCcw aria-hidden="true" />}
              label="Reset tile"
              onClick={handleResetThisTile}
            />
            {onResetAllCustomizations && (
              <Button
                appearance="destructiveSecondary"
                icon={<RotateCcw aria-hidden="true" />}
                label="Factory reset"
                onClick={(event) => {
                  confirmationReturnFocusRef.current = event.currentTarget;
                  handleResetAllCustomizations();
                }}
              />
            )}
            {onPublishWorkspaceLayout && (
              <Button
                appearance="standalone"
                disabled={workspaceLayoutStatus === "saving"}
                icon={
                  workspaceLayoutStatus === "saving" ? (
                    <WaitSpinner screenReaderText={null} />
                  ) : (
                    <Settings2 aria-hidden="true" />
                  )
                }
                label={
                  workspaceLayoutStatus === "saving"
                    ? "Publishing layout"
                    : workspaceLayoutStatus === "saved"
                      ? "Layout published"
                      : "Publish workspace layout"
                }
                onClick={(event) => {
                  confirmationReturnFocusRef.current = event.currentTarget;
                  handlePublishWorkspaceLayout();
                }}
              />
            )}
            <Button appearance="secondary" onClick={onClose} label="Cancel" />
            <Button
              appearance="primary"
              onClick={(event) => {
                confirmationReturnFocusRef.current = event.currentTarget;
                handleApply();
              }}
              disabled={!canApply}
              label="Apply"
            />
          </Layout>
        </Drawer.Footer>
      </StyledDrawer>
      <Modal
        onRequestClose={() => setConfirmation(null)}
        open={confirmation !== null}
        returnFocus={() => confirmationReturnFocusRef.current?.focus()}
      >
        <Modal.Header title={confirmation?.title} />
        <Modal.Body>{confirmation?.body}</Modal.Body>
        <Modal.Footer>
          <Button
            appearance="secondary"
            label="Cancel"
            onClick={() => setConfirmation(null)}
          />
          <Button
            appearance={confirmation?.destructive ? "destructive" : "primary"}
            label={confirmation?.confirmLabel ?? "Confirm"}
            onClick={() => {
              confirmation?.onConfirm();
              setConfirmation(null);
            }}
          />
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default KpiPickerPanel;
