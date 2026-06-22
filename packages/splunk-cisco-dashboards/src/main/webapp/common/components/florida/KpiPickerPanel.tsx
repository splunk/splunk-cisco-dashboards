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

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    BarChart3,
    ChevronDown,
    ChevronRight,
    Eye,
    ExternalLink,
    Gauge,
    Info,
    Loader2,
    Play,
    RotateCcw,
    Search,
    Settings2,
    Table2,
    Tag,
    X,
} from 'lucide-react';
import { cn } from '@/common/lib/utils';
import {
    clearSearchbaseCache,
    getSearchbaseCatalogue,
    plainTextFromHtml,
    type SearchbaseRecord,
} from '@/common/services/searchbaseCatalogue';
import type { MetricOverride } from '@/common/hooks/usePersistedMetricOverrides';
import type { SearchbaseDrilldownMap } from '@/common/hooks/usePersistedSearchbaseDrilldowns';
import {
    deriveThresholdLines,
    formatThresholdNumber,
    type MetricThresholds,
} from '@/common/hooks/useMetric';
import { VizIcon, resolveVizMapping } from './vizIcons';

// "All" sentinel for the facet dropdowns — using a sentinel rather
// than '' keeps the <select> element rendering predictable.
const ALL_CATEGORIES = '__all__';
const ALL_SUB_CATEGORIES = '__all_sub__';
const ALL_APPS = '__all_apps__';

// Default app scope for the picker. The catalogue REST endpoint pulls
// from every app namespace (`/servicesNS/-/-/configs/conf-searchbase`),
// so on a Splunk stack with multiple apps that ship their own
// `searchbase.conf` the catalogue can grow beyond what this app vetted.
// To keep the picker scoped to dashboard-pack searches by default, the
// App facet starts at this value and only shows entries whose
// owning app matches it. Users can switch to "All apps" or pick a
// specific other app from the same dropdown to browse wider — same UX
// as the Category facet.
//
// The UI stores a normalised `dispatchContext` sourced from the stanza's
// owning ACL app; the UI labels it "App" because that's what operators
// recognise.
//
// Every stanza shipped in this app's `default/searchbase.conf` carries
// `dispatch_context = splunk-cisco-dashboards` (with
// `dispatch_context_force = 1`), so this default passes the full
// 530-entry catalogue.
//
// Build trail:
//   - Build 87: dropped the `Cisco` noise tag from every stanza,
//     which silently collapsed the picker to zero results because the
//     picker used a hardcoded `tags.includes('Cisco')` gate.
//   - Build 91: swapped the gate for a hardcoded
//     `dispatch_context === 'splunk-cisco-dashboards'` check.
//   - Build 92: promoted the constant to a real user-facing facet
//     (Dispatch dropdown).
//   - Build 93: renamed Dispatch → App for clarity, collapsed the
//     facet block by default to give the result list more room.
const DEFAULT_APP_SCOPE = 'splunk-cisco-dashboards';

const MAX_FIELD_LENGTH = 64;
const FIELD_NAME_PATTERN = /^[A-Za-z_][\w.]{0,63}$/;
const TAG_CHIP_LIMIT = 24;

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
     * Currently-applied viz override for this tile, if any (Build 1174;
     * `bar` added in Build 1187). Pre-fills the CHART STYLE picker so
     * re-opening the picker on a customised tile shows the active
     * selection rather than always landing on "Default".
     */
    currentVizOverride?: MetricOverride['vizOverride'];
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
    onClose: () => void;
    onApply: (tileId: string, override: MetricOverride) => void;
    onClearOverride: (tileId: string) => void;
    /**
     * Search-level drilldown bindings keyed by source `search_name`.
     * These sit beside `searchbase.conf`'s shipped
     * `drilldown_search_name` relationship and let an operator attach
     * a drilldown from the picker without hand-editing conf.
     */
    drilldownBindings?: SearchbaseDrilldownMap;
    onSetSearchDrilldown?: (
        sourceSearchName: string,
        drilldownSearchName: string | null
    ) => void;
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
    onApplyDisplayToSection?: (sectionId: string, patch: DisplaySectionPatch) => void;
    /**
     * Optional "Open in Splunk Search" handler. When provided, a
     * compact "Test in Search" action appears next to the Searchbase
     * link. The handler receives the *literal* SPL from
     * `searchbase.conf` (the `search` field), not a saved-search
     * reference.
     */
    onTestInSearch?: (spl: string) => void;
    /**
     * Optional "factory reset" handler. When provided, a small
     * destructive-styled link is rendered alongside the "Reset tile"
     * affordance so the user can wipe **every** customisation
     * (picker overrides, section tile counts, section tile orders,
     * map topology, splitter position) in one click. Theme is left
     * alone — that's a UI preference, not a layout customisation.
     *
     * The picker shows a `window.confirm()` prompt before invoking
     * the handler so a misclick doesn't blow away the user's whole
     * setup. The handler is responsible for performing the actual
     * reset and (typically) closing the picker after.
     */
    onResetAllCustomizations?: () => void;
}

const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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
    if (!spl || typeof spl !== 'string') return [];
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
        push('count');
    }

    return out;
};

const highlightMatch = (text: string, query: string): React.ReactNode => {
    const trimmed = query.trim();
    if (!trimmed) return text;
    const re = new RegExp(`(${escapeRegex(trimmed)})`, 'ig');
    const parts = text.split(re);
    return parts.map((part, idx) =>
        re.test(part) ? (
            <mark
                key={idx}
                className="bg-sky-200 dark:bg-sky-700/60 text-inherit rounded-sm px-0.5"
            >
                {part}
            </mark>
        ) : (
            <React.Fragment key={idx}>{part}</React.Fragment>
        )
    );
};

const matchesQuery = (entry: SearchbaseRecord, query: string): boolean => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return true;
    const plainDescription = plainTextFromHtml(entry.description);
    return (
        entry.searchName.toLowerCase().includes(trimmed) ||
        (entry.drilldownSearchName ?? '').toLowerCase().includes(trimmed) ||
        plainDescription.toLowerCase().includes(trimmed) ||
        entry.subCategory.toLowerCase().includes(trimmed) ||
        entry.tags.some((t) => t.toLowerCase().includes(trimmed))
    );
};

const entryMatchesKey = (entry: SearchbaseRecord, key: string | null | undefined): boolean => {
    const trimmed = key?.trim();
    if (!trimmed) return false;
    return entry.id === trimmed || entry.searchName === trimmed;
};

const entryMatchesFacetSelection = (
    entry: SearchbaseRecord,
    app: string,
    category: string,
    subCategory: string,
    tags: ReadonlySet<string>
): boolean => {
    if (app !== ALL_APPS && entry.dispatchContext !== app) {
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

const entryIsUsed = (entry: SearchbaseRecord, used: Set<string> | undefined): boolean => {
    if (!used) return false;
    return used.has(entry.id) || used.has(entry.searchName);
};

const labelFromSearchName = (searchName: string): string => {
    const parts = searchName.split(/\s+[–—-]\s+/).map((part) => part.trim());
    return (parts[parts.length - 1] || searchName).slice(0, 80);
};

const getSplunkWebLocalePrefix = (): string => {
    if (typeof window === 'undefined') return '/en-US';
    const match = window.location.pathname.match(/^\/([^/]+)\/app\//);
    return match ? `/${match[1]}` : '/en-US';
};

const buildSearchbaseEditUrl = (entry: SearchbaseRecord): string | null => {
    const stanza = entry.id.trim();
    if (!stanza) return null;
    const origin = typeof window === 'undefined' ? '' : window.location.origin;
    return `${origin}${getSplunkWebLocalePrefix()}/app/searchbase/start#/edit/${encodeURIComponent(stanza)}#search-spl`;
};

const configuredDrilldownNameFor = (
    entry: SearchbaseRecord,
    bindings: SearchbaseDrilldownMap | undefined
): string => {
    if (bindings && Object.prototype.hasOwnProperty.call(bindings, entry.searchName)) {
        return bindings[entry.searchName]?.trim() ?? '';
    }
    return entry.drilldownSearchName?.trim() ?? '';
};

export const KpiPickerPanel: React.FC<KpiPickerPanelProps> = ({
    open,
    context,
    onClose,
    onApply,
    onClearOverride,
    drilldownBindings,
    onSetSearchDrilldown,
    onTestInSearch,
    onResetAllCustomizations,
    onApplyDisplayToSection,
}) => {
    const [catalogue, setCatalogue] = useState<SearchbaseRecord[]>([]);
    const [loadState, setLoadState] = useState<'idle' | 'loading' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState<string>('');
    const [query, setQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>(ALL_CATEGORIES);
    const [selectedSubCategory, setSelectedSubCategory] = useState<string>(ALL_SUB_CATEGORIES);
    // App facet — defaults to this app's namespace (read from the
    // searchbase entry's `dispatch_context` field) so the picker stays
    // scoped to dashboard-pack searches at first open.
    // Switch to ALL_APPS or another app's namespace via
    // the dropdown to browse wider.
    const [selectedApp, setSelectedApp] = useState<string>(
        DEFAULT_APP_SCOPE
    );
    const [includeHiddenSearches, setIncludeHiddenSearches] = useState(false);
    const [includeDrilldownSearches, setIncludeDrilldownSearches] = useState(false);
    const [includeTableSearches, setIncludeTableSearches] = useState(false);
    const [activeTags, setActiveTags] = useState<Set<string>>(() => new Set());
    // Free-text input that powers the tag multi-select dropdown. As
    // the user types, the dropdown narrows to substring matches and
    // lifts its top-N cap so any of the ~260 catalogue tags is
    // reachable in two keystrokes. Independent of the main `query`
    // so the result list isn't polluted while hunting for a tag.
    const [tagFilter, setTagFilter] = useState('');
    const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
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
    const [expandedDescriptionId, setExpandedDescriptionId] = useState<string | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [valueField, setValueField] = useState('');
    const [labelOverride, setLabelOverride] = useState('');
    // ---------- THRESHOLDS form state (Build 97) ----------
    //
    // The form drives the same `MetricThresholds` shape the runtime
    // already consumes via `computeStatus` and `deriveThresholdLines`,
    // so editing here is equivalent to editing the static config in
    // code — but per-user, persisted in localStorage, and reversible.
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
    // All four pieces of state reset on panel open / selected-entry
    // change in the same `useEffect` blocks that already handle
    // valueField and labelOverride, so the picker behaves the same
    // way for thresholds as for those fields.
    const [thresholdsOpen, setThresholdsOpen] = useState(true);
    const [thresholdWarningInput, setThresholdWarningInput] = useState('');
    const [thresholdCriticalInput, setThresholdCriticalInput] = useState('');
    const [thresholdDirection, setThresholdDirection] =
        useState<MetricThresholds['direction']>('higher_is_better');

    /**
     * Viz override picker state (Build 1174). `null` means "use the
     * default", which the runtime resolves from `searchbase.conf`'s
     * `default_viz`. Any other value pins the chart style for this
     * tile regardless of which searchbase entry drives the data,
     * including across binding swaps. The "Default" affordance maps
     * back to clearing the override on Apply, matching the
     * "Reset to default" pattern used elsewhere in the picker.
     */
    const [vizOverrideInput, setVizOverrideInput] = useState<
        Exclude<MetricOverride['vizOverride'], undefined> | null
    >(null);

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
    const [drilldownQuery, setDrilldownQuery] = useState('');
    const [drilldownDraftSearchName, setDrilldownDraftSearchName] = useState('');
    const [drilldownFiltersOpen, setDrilldownFiltersOpen] = useState(false);
    const [drilldownSelectedApp, setDrilldownSelectedApp] =
        useState<string>(DEFAULT_APP_SCOPE);
    const [drilldownSelectedCategory, setDrilldownSelectedCategory] =
        useState<string>(ALL_CATEGORIES);
    const [drilldownSelectedSubCategory, setDrilldownSelectedSubCategory] =
        useState<string>(ALL_SUB_CATEGORIES);
    const [drilldownActiveTags, setDrilldownActiveTags] = useState<Set<string>>(
        () => new Set()
    );
    const [drilldownTagFilter, setDrilldownTagFilter] = useState('');
    const [drilldownTagDropdownOpen, setDrilldownTagDropdownOpen] = useState(false);
    const [chartStyleOpen, setChartStyleOpen] = useState(false);
    const [displayOpen, setDisplayOpen] = useState(false);

    const searchInputRef = useRef<HTMLInputElement | null>(null);
    const tagSelectRef = useRef<HTMLDivElement | null>(null);
    const tagInputRef = useRef<HTMLInputElement | null>(null);
    const drilldownTagSelectRef = useRef<HTMLDivElement | null>(null);
    const drilldownTagInputRef = useRef<HTMLInputElement | null>(null);
    const drilldownDraftResetKeyRef = useRef<string>('');

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
        setLoadState('loading');
        setErrorMsg('');

        // The whole catalogue lives in `catalogue` state — facet
        // filtering (including dispatch-context) happens at render time
        // in the `filtered` useMemo so the user can switch facets
        // without re-fetching. Sort once at load so the result list is
        // stable.
        const sortAlphabetical = (list: SearchbaseRecord[]) =>
            [...list].sort((a, b) =>
                a.searchName.localeCompare(b.searchName, undefined, {
                    sensitivity: 'base',
                })
            );

        const applyList = (list: SearchbaseRecord[]) => {
            if (cancelled) return;
            setCatalogue(sortAlphabetical(list));
            setLoadState('idle');
        };

        const handleError = (err: unknown) => {
            if (cancelled) return;
            setCatalogue([]);
            setLoadState('error');
            setErrorMsg(
                err instanceof Error ? err.message : 'Failed to load searchbase.conf.'
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
                    setLoadState('idle');
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
    // facet resets to the dashboard-pack default so each new picker
    // open is scoped to vetted searches by default. Filters block
    // collapses so the user lands on a clean result list.
    useEffect(() => {
        if (!open || !context) return;
        setQuery('');
        setSelectedCategory(ALL_CATEGORIES);
        setSelectedSubCategory(ALL_SUB_CATEGORIES);
        setSelectedApp(DEFAULT_APP_SCOPE);
        setIncludeHiddenSearches(false);
        setIncludeDrilldownSearches(false);
        setIncludeTableSearches(false);
        setActiveTags(new Set());
        setTagFilter('');
        setTagDropdownOpen(false);
        setFiltersOpen(false);
        setBoundDismissed(false);
        setExpandedDescriptionId(null);
        // Highlight the row whose `search_name` matches the tile's
        // currently-bound saved search (if it's in the catalogue).
        const initial = context.currentSavedSearch ?? null;
        setSelectedId(initial);
        setValueField(context.currentValueField ?? '');
        setLabelOverride(context.currentLabel ?? '');
        // Pre-fill the THRESHOLDS form from the tile's *current*
        // effective tuple (override merged onto default by openPicker),
        // so re-opening the picker on a customised tile shows the
        // customised values rather than the static defaults. Empty
        // strings stay empty — they represent "no warning band" /
        // "no critical band", which is a valid configuration for
        // tiles that only flag one direction of trouble.
        const cur = context.currentThresholds;
        setThresholdWarningInput(
            cur && cur.warning !== undefined ? String(cur.warning) : ''
        );
        setThresholdCriticalInput(
            cur && cur.critical !== undefined ? String(cur.critical) : ''
        );
        setThresholdDirection(cur?.direction ?? 'higher_is_better');
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
        setDrilldownSelectedApp(DEFAULT_APP_SCOPE);
        setDrilldownSelectedCategory(ALL_CATEGORIES);
        setDrilldownSelectedSubCategory(ALL_SUB_CATEGORIES);
        setDrilldownActiveTags(new Set());
        setDrilldownTagFilter('');
        setDrilldownTagDropdownOpen(false);
        // Build 1203: auto-expand CHART STYLE and DISPLAY when the
        // tile is already customised in those areas. Operators
        // landing on a tile they've previously tweaked should see
        // their customisations without an extra click; for fresh
        // tiles the collapsed default keeps the panel compact.
        setChartStyleOpen(Boolean(context.currentVizOverride));
        setDisplayOpen(hidePeakActive || hideDeltaActive || hideOverlayActive);
        const defaultThresholds = context.defaultThresholds;
        const currentDirection = cur?.direction ?? 'higher_is_better';
        const defaultDirection = defaultThresholds?.direction ?? 'higher_is_better';
        setThresholdsOpen(
            cur?.warning !== defaultThresholds?.warning ||
                cur?.critical !== defaultThresholds?.critical ||
                currentDirection !== defaultDirection
        );
        const id = window.setTimeout(() => searchInputRef.current?.focus(), 30);
        return () => window.clearTimeout(id);
    }, [open, context]);

    // Esc closes the panel.
    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, onClose]);

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
    }, [selectedApp]);

    useEffect(() => {
        setDrilldownSelectedCategory(ALL_CATEGORIES);
        setDrilldownSelectedSubCategory(ALL_SUB_CATEGORIES);
        setDrilldownActiveTags(new Set());
    }, [drilldownSelectedApp]);

    // Auto-expand the Filters block whenever an applied facet appears
    // — guarantees the user can always see what's narrowing the result
    // list, even if they applied a filter, scrolled, then collapsed
    // the block from a previous open. Closing is left manual: once
    // expanded, the user controls when to hide the block again.
    useEffect(() => {
        if (
            selectedApp !== DEFAULT_APP_SCOPE ||
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
        selectedApp,
        includeHiddenSearches,
        includeDrilldownSearches,
        includeTableSearches,
        selectedCategory,
        selectedSubCategory,
        activeTags,
    ]);

    useEffect(() => {
        if (
            drilldownSelectedApp !== DEFAULT_APP_SCOPE ||
            drilldownSelectedCategory !== ALL_CATEGORIES ||
            drilldownSelectedSubCategory !== ALL_SUB_CATEGORIES ||
            drilldownActiveTags.size > 0
        ) {
            setDrilldownFiltersOpen(true);
        }
    }, [
        drilldownSelectedApp,
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
                    entryMatchesKey(entry, context.currentSavedSearch)
            );
        if (selectedId && !selectedIsCurrent) {
            setValueField('');
            const selected = catalogue.find((entry) => entryMatchesKey(entry, selectedId));
            setLabelOverride(selected ? labelFromSearchName(selected.searchName) : '');
        } else {
            setValueField(context.currentValueField ?? '');
            setLabelOverride(context.currentLabel ?? '');
        }
    }, [selectedId, context, catalogue]);

    // Close the tag dropdown when the user clicks outside the
    // multi-select. Mirrors the standard combobox pattern.
    useEffect(() => {
        if (!open || !tagDropdownOpen) return undefined;
        const handler = (e: MouseEvent) => {
            if (!tagSelectRef.current?.contains(e.target as Node)) {
                setTagDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open, tagDropdownOpen]);

    useEffect(() => {
        if (!open || !drilldownTagDropdownOpen) return undefined;
        const handler = (e: MouseEvent) => {
            if (!drilldownTagSelectRef.current?.contains(e.target as Node)) {
                setDrilldownTagDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open, drilldownTagDropdownOpen]);

    // Distinct, sorted category list — drives the Category dropdown.
    // Scoped to the active App facet so picking a single app narrows
    // the Category dropdown to that app's category vocabulary.
    const categories = useMemo(() => {
        const set = new Set<string>();
        for (const e of catalogue) {
            if (
                selectedApp !== ALL_APPS &&
                e.dispatchContext !== selectedApp
            ) {
                continue;
            }
            if (e.category) set.add(e.category);
        }
        return Array.from(set).sort((a, b) =>
            a.localeCompare(b, undefined, { sensitivity: 'base' })
        );
    }, [catalogue, selectedApp]);

    // Sub-categories scoped to the current category and dispatch
    // context. Empty array when no category is picked — that hides
    // the dropdown.
    const subCategories = useMemo(() => {
        if (selectedCategory === ALL_CATEGORIES) return [];
        const set = new Set<string>();
        for (const e of catalogue) {
            if (
                selectedApp !== ALL_APPS &&
                e.dispatchContext !== selectedApp
            ) {
                continue;
            }
            if (e.category !== selectedCategory) continue;
            if (e.subCategory) set.add(e.subCategory);
        }
        return Array.from(set).sort((a, b) =>
            a.localeCompare(b, undefined, { sensitivity: 'base' })
        );
    }, [catalogue, selectedApp, selectedCategory]);

    // Distinct app namespaces (`dispatch_context` values) present in
    // the catalogue. Drives the App facet dropdown. Sorted
    // alphabetically so the order is stable across loads.
    const apps = useMemo(() => {
        const set = new Set<string>();
        for (const e of catalogue) {
            if (e.dispatchContext) set.add(e.dispatchContext);
        }
        return Array.from(set).sort((a, b) =>
            a.localeCompare(b, undefined, { sensitivity: 'base' })
        );
    }, [catalogue]);

    const drilldownBaseEntries = useMemo(
        () =>
            catalogue.filter((entry) => {
                if (!entry.search?.trim()) return false;
                if (!selectedId) return true;
                return !entryMatchesKey(entry, selectedId);
            }),
        [catalogue, selectedId]
    );

    const drilldownApps = useMemo(() => {
        const set = new Set<string>();
        for (const entry of drilldownBaseEntries) {
            if (entry.dispatchContext) set.add(entry.dispatchContext);
        }
        return Array.from(set).sort((a, b) =>
            a.localeCompare(b, undefined, { sensitivity: 'base' })
        );
    }, [drilldownBaseEntries]);

    const drilldownCategories = useMemo(() => {
        const set = new Set<string>();
        for (const entry of drilldownBaseEntries) {
            if (
                drilldownSelectedApp !== ALL_APPS &&
                entry.dispatchContext !== drilldownSelectedApp
            ) {
                continue;
            }
            if (entry.category) set.add(entry.category);
        }
        return Array.from(set).sort((a, b) =>
            a.localeCompare(b, undefined, { sensitivity: 'base' })
        );
    }, [drilldownBaseEntries, drilldownSelectedApp]);

    const drilldownSubCategories = useMemo(() => {
        if (drilldownSelectedCategory === ALL_CATEGORIES) return [];
        const set = new Set<string>();
        for (const entry of drilldownBaseEntries) {
            if (
                drilldownSelectedApp !== ALL_APPS &&
                entry.dispatchContext !== drilldownSelectedApp
            ) {
                continue;
            }
            if (entry.category !== drilldownSelectedCategory) continue;
            if (entry.subCategory) set.add(entry.subCategory);
        }
        return Array.from(set).sort((a, b) =>
            a.localeCompare(b, undefined, { sensitivity: 'base' })
        );
    }, [drilldownBaseEntries, drilldownSelectedApp, drilldownSelectedCategory]);

    // Tag counts are scoped to the current result slice, including
    // already-selected tags. This makes the tag picker progressive:
    // after choosing one tag, the dropdown shows only tags that still
    // co-occur in the narrowed results rather than the full catalogue.
    const tagFacetEntries = useMemo(() => {
        return catalogue.filter((entry) => {
            if (
                selectedApp !== ALL_APPS &&
                entry.dispatchContext !== selectedApp
            ) {
                return false;
            }
            if (selectedCategory !== ALL_CATEGORIES && entry.category !== selectedCategory) {
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
    }, [catalogue, query, selectedApp, selectedCategory, selectedSubCategory, activeTags]);

    // Full tag counts for the narrowed slice. Sorted by frequency
    // desc, then alpha. Not capped — that happens in
    // `tagDropdownOptions` so typing can lift the cap.
    const allTagsWithCounts = useMemo(() => {
        const map = new Map<string, number>();
        for (const entry of tagFacetEntries) {
            for (const tag of entry.tags) map.set(tag, (map.get(tag) ?? 0) + 1);
        }
        return Array.from(map.entries()).sort(
            (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
        );
    }, [tagFacetEntries]);

    // What renders in the tag dropdown — i.e. the *unselected*
    // tags the user can add. Selected tags are shown as pills inside
    // the input, so we hide them here.
    //   - no tag filter:  top-N by frequency (TAG_CHIP_LIMIT)
    //   - tag filter set: every available tag whose name substring-
    //                     matches, no cap (preserves frequency order).
    const tagDropdownOptions = useMemo(() => {
        const filter = tagFilter.trim().toLowerCase();
        const available = allTagsWithCounts.filter(([tag]) => !activeTags.has(tag));
        if (!filter) {
            return available.slice(0, TAG_CHIP_LIMIT);
        }
        return available.filter(([tag]) => tag.toLowerCase().includes(filter));
    }, [allTagsWithCounts, tagFilter, activeTags]);

    // Map for quick "what's this tag's count in the current slice?"
    // lookups when rendering the selected pills.
    const tagCountByName = useMemo(() => {
        const m = new Map<string, number>();
        for (const [t, c] of allTagsWithCounts) m.set(t, c);
        return m;
    }, [allTagsWithCounts]);

    const drilldownTagFacetEntries = useMemo(() => {
        return drilldownBaseEntries.filter((entry) => {
            if (
                !entryMatchesFacetSelection(
                    entry,
                    drilldownSelectedApp,
                    drilldownSelectedCategory,
                    drilldownSelectedSubCategory,
                    drilldownActiveTags
                )
            ) {
                return false;
            }
            return matchesQuery(entry, drilldownQuery);
        });
    }, [
        drilldownBaseEntries,
        drilldownSelectedApp,
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
            (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
        );
    }, [drilldownTagFacetEntries]);

    const drilldownTagDropdownOptions = useMemo(() => {
        const filter = drilldownTagFilter.trim().toLowerCase();
        const available = drilldownAllTagsWithCounts.filter(
            ([tag]) => !drilldownActiveTags.has(tag)
        );
        if (!filter) {
            return available.slice(0, TAG_CHIP_LIMIT);
        }
        return available.filter(([tag]) => tag.toLowerCase().includes(filter));
    }, [drilldownAllTagsWithCounts, drilldownTagFilter, drilldownActiveTags]);

    const drilldownTagCountByName = useMemo(() => {
        const m = new Map<string, number>();
        for (const [t, c] of drilldownAllTagsWithCounts) m.set(t, c);
        return m;
    }, [drilldownAllTagsWithCounts]);

    const drilldownSearchNames = useMemo(() => {
        const names = new Set<string>();
        for (const entry of catalogue) {
            const name = entry.drilldownSearchName?.trim();
            if (name) names.add(name.toLowerCase());
        }
        return names;
    }, [catalogue]);

    const filtered = useMemo(() => {
        return catalogue.filter((entry) => {
            if (
                selectedApp !== ALL_APPS &&
                entry.dispatchContext !== selectedApp
            ) {
                return false;
            }
            if (selectedCategory !== ALL_CATEGORIES && entry.category !== selectedCategory) {
                return false;
            }
            if (
                selectedSubCategory !== ALL_SUB_CATEGORIES &&
                entry.subCategory !== selectedSubCategory
            ) {
                return false;
            }
            const isDrilldownSearch =
                drilldownSearchNames.has(entry.searchName.trim().toLowerCase()) ||
                drilldownSearchNames.has(entry.id.trim().toLowerCase());
            if (!includeDrilldownSearches && isDrilldownSearch) {
                return false;
            }
            if (!includeTableSearches && entry.defaultViz === 'splunk.table') {
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
        catalogue,
        drilldownSearchNames,
        includeDrilldownSearches,
        includeTableSearches,
        query,
        selectedApp,
        selectedCategory,
        selectedSubCategory,
    ]);

    const selectedEntry = useMemo(
        () =>
            selectedId
                ? catalogue.find((e) => entryMatchesKey(e, selectedId)) ?? null
                : null,
        [catalogue, selectedId]
    );
    const selectedSearchbaseUrl = selectedEntry ? buildSearchbaseEditUrl(selectedEntry) : null;
    const selectedConfiguredDrilldownName = useMemo(
        () =>
            selectedEntry
                ? configuredDrilldownNameFor(selectedEntry, drilldownBindings)
                : '',
        [selectedEntry, drilldownBindings]
    );
    const selectedDrilldownEntry = useMemo(() => {
        const drilldownName = drilldownDraftSearchName.trim();
        if (!drilldownName) return null;
        return catalogue.find((entry) => entryMatchesKey(entry, drilldownName)) ?? null;
    }, [catalogue, drilldownDraftSearchName]);
    const selectedDrilldownUrl = selectedDrilldownEntry
        ? buildSearchbaseEditUrl(selectedDrilldownEntry)
        : null;
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
                        drilldownSelectedApp,
                        drilldownSelectedCategory,
                        drilldownSelectedSubCategory,
                        drilldownActiveTags
                    )
                ) {
                    return false;
                }
                return matchesQuery(entry, q);
            })
            .sort((a, b) => {
                const aSelected = entryMatchesKey(a, drilldownDraftSearchName) ? 1 : 0;
                const bSelected = entryMatchesKey(b, drilldownDraftSearchName) ? 1 : 0;
                if (aSelected !== bSelected) return bSelected - aSelected;
                const aTable = a.defaultViz === 'splunk.table' ? 1 : 0;
                const bTable = b.defaultViz === 'splunk.table' ? 1 : 0;
                if (aTable !== bTable) return bTable - aTable;
                return a.searchName.localeCompare(b.searchName, undefined, {
                    sensitivity: 'base',
                });
            });
    }, [
        catalogue,
        selectedEntry,
        drilldownQuery,
        drilldownDraftSearchName,
        drilldownSelectedApp,
        drilldownSelectedCategory,
        drilldownSelectedSubCategory,
        drilldownActiveTags,
    ]);
    const selectedDescriptionPlain = useMemo(
        () => (selectedEntry ? plainTextFromHtml(selectedEntry.description) : ''),
        [selectedEntry]
    );

    useEffect(() => {
        if (!open || !selectedEntry) {
            drilldownDraftResetKeyRef.current = '';
            setDrilldownDraftSearchName('');
            setDrilldownQuery('');
            return;
        }
        const resetKey = `${selectedEntry.id}:${selectedConfiguredDrilldownName}`;
        if (drilldownDraftResetKeyRef.current === resetKey) return;
        drilldownDraftResetKeyRef.current = resetKey;
        setDrilldownDraftSearchName(selectedConfiguredDrilldownName);
        setDrilldownQuery('');
    }, [open, selectedEntry?.id, selectedConfiguredDrilldownName]);

    // Output column names parsed from the selected entry's SPL — drives
    // the clickable chip list under the Value Field input. Empty array
    // for SPL we can't statically infer columns from (e.g. a bare
    // `| eventstats` pass-through with no aliases), in which case we
    // hide the chip row and rely on the auto-detect placeholder.
    const splFieldSuggestions = useMemo(
        () => (selectedEntry ? extractSplFieldNames(selectedEntry.search) : []),
        [selectedEntry]
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
            catalogue.find((e) => entryMatchesKey(e, context.currentSavedSearch)) ?? null
        );
    }, [catalogue, context]);

    // Refs for scroll-to-current behaviour. When the panel opens, we
    // want the bound entry to be on-screen even if it's deep in a
    // 600+-entry alphabetical list. Browser-native `scrollIntoView`
    // with `block: 'center'` keeps it from sitting flush against the
    // sticky filters at the top.
    const listScrollRef = useRef<HTMLDivElement | null>(null);
    const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
    const setItemRef = (id: string) => (el: HTMLDivElement | null) => {
        if (el) itemRefs.current.set(id, el);
        else itemRefs.current.delete(id);
    };
    const jumpToCurrent = () => {
        if (!currentBoundEntry) return;
        const el = itemRefs.current.get(currentBoundEntry.id);
        if (el) {
            el.scrollIntoView({ block: 'center', behavior: 'smooth' });
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
                el.scrollIntoView({ block: 'center' });
            }
        }, 50);
        return () => window.clearTimeout(id);
    }, [open, currentBoundEntry, catalogue.length]);

    if (!open || !context) return null;

    const addTag = (tag: string) => {
        setActiveTags((prev) => {
            if (prev.has(tag)) return prev;
            const next = new Set(prev);
            next.add(tag);
            return next;
        });
        // Clear the typed filter so the dropdown immediately shows the
        // remaining options ranked by frequency, ready for the user to
        // pick a second tag if they want to AND further.
        setTagFilter('');
        tagInputRef.current?.focus();
    };

    const removeTag = (tag: string) => {
        setActiveTags((prev) => {
            if (!prev.has(tag)) return prev;
            const next = new Set(prev);
            next.delete(tag);
            return next;
        });
    };

    const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && tagFilter === '' && activeTags.size > 0) {
            // Empty input + Backspace pops the last selected pill —
            // standard token-input affordance.
            e.preventDefault();
            const arr = Array.from(activeTags);
            removeTag(arr[arr.length - 1]);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            setTagDropdownOpen(false);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (tagDropdownOptions.length > 0) {
                addTag(tagDropdownOptions[0][0]);
            }
        } else if (e.key === 'ArrowDown' && !tagDropdownOpen) {
            setTagDropdownOpen(true);
        }
    };

    const addDrilldownTag = (tag: string) => {
        setDrilldownActiveTags((prev) => {
            if (prev.has(tag)) return prev;
            const next = new Set(prev);
            next.add(tag);
            return next;
        });
        setDrilldownTagFilter('');
        drilldownTagInputRef.current?.focus();
    };

    const removeDrilldownTag = (tag: string) => {
        setDrilldownActiveTags((prev) => {
            if (!prev.has(tag)) return prev;
            const next = new Set(prev);
            next.delete(tag);
            return next;
        });
    };

    const handleDrilldownTagInputKeyDown = (
        e: React.KeyboardEvent<HTMLInputElement>
    ) => {
        if (
            e.key === 'Backspace' &&
            drilldownTagFilter === '' &&
            drilldownActiveTags.size > 0
        ) {
            e.preventDefault();
            const arr = Array.from(drilldownActiveTags);
            removeDrilldownTag(arr[arr.length - 1]);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            setDrilldownTagDropdownOpen(false);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (drilldownTagDropdownOptions.length > 0) {
                addDrilldownTag(drilldownTagDropdownOptions[0][0]);
            }
        } else if (e.key === 'ArrowDown' && !drilldownTagDropdownOpen) {
            setDrilldownTagDropdownOpen(true);
        }
    };

    const fieldNameValid = valueField === '' || FIELD_NAME_PATTERN.test(valueField);
    const labelValid = labelOverride === '' || labelOverride.trim().length <= 80;

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
        if (trimmed === '') return undefined;
        const n = Number(trimmed);
        return Number.isFinite(n) ? n : undefined;
    };

    const warningParsed = parseThresholdInput(thresholdWarningInput);
    const criticalParsed = parseThresholdInput(thresholdCriticalInput);
    const warningInputValid =
        thresholdWarningInput.trim() === '' || warningParsed !== undefined;
    const criticalInputValid =
        thresholdCriticalInput.trim() === '' || criticalParsed !== undefined;

    // Sanity-check the warning-vs-critical relationship for the chosen
    // direction. Used for an inline yellow hint, not a hard gate —
    // some operators intentionally invert the bands to disable a
    // colour (e.g. set warning > critical on `higher_is_better` to
    // suppress the warning band entirely).
    const thresholdRelationshipWarning: string | null = (() => {
        if (warningParsed === undefined || criticalParsed === undefined) return null;
        if (thresholdDirection === 'higher_is_better' && criticalParsed >= warningParsed) {
            return '"Higher is better" usually wants critical < warning.';
        }
        if (thresholdDirection === 'lower_is_better' && criticalParsed <= warningParsed) {
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
        warningParsed === undefined && criticalParsed === undefined
            ? undefined
            : deriveThresholdLines(
                  {
                      warning: warningParsed,
                      critical: criticalParsed,
                      direction: thresholdDirection,
                  },
                  context?.thresholdUnit
              );

    // "Has the user changed any threshold field away from default?"
    // Drives the per-section "Reset to default" link visibility and
    // the "(custom)" badge on the collapsed THRESHOLDS toggle.
    const def = context?.defaultThresholds;
    const thresholdsCustomised =
        warningParsed !== def?.warning ||
        criticalParsed !== def?.critical ||
        thresholdDirection !== (def?.direction ?? 'higher_is_better');

    const canApply = Boolean(
        selectedEntry &&
            fieldNameValid &&
            labelValid &&
            warningInputValid &&
            criticalInputValid
    );

    // Count of *applied* facets (excluding the in-progress tag-filter
    // typing buffer). Drives the "Filters (N active)" badge on the
    // collapsed toggle and feeds `facetsActive` for the Clear-filters
    // button visibility.
    const activeFilterCount =
        (selectedApp !== DEFAULT_APP_SCOPE ? 1 : 0) +
        (includeHiddenSearches ? 1 : 0) +
        (includeDrilldownSearches ? 1 : 0) +
        (includeTableSearches ? 1 : 0) +
        (selectedCategory !== ALL_CATEGORIES ? 1 : 0) +
        (selectedSubCategory !== ALL_SUB_CATEGORIES ? 1 : 0) +
        activeTags.size;

    const facetsActive = activeFilterCount > 0 || tagFilter.trim().length > 0;
    const drilldownActiveFilterCount =
        (drilldownSelectedApp !== DEFAULT_APP_SCOPE ? 1 : 0) +
        (drilldownSelectedCategory !== ALL_CATEGORIES ? 1 : 0) +
        (drilldownSelectedSubCategory !== ALL_SUB_CATEGORIES ? 1 : 0) +
        drilldownActiveTags.size;
    const drilldownFacetsActive =
        drilldownActiveFilterCount > 0 || drilldownTagFilter.trim().length > 0;

    const handleApply = () => {
        if (!selectedEntry || !canApply) return;
        // Persist the catalogue key. The page resolves it through
        // searchbase.conf before dispatching, so the picker and runtime
        // use the same SPL.
        const payload: MetricOverride = { savedSearch: selectedEntry.searchName };
        if (valueField) payload.valueField = valueField;
        if (labelOverride.trim()) payload.label = labelOverride.trim();
        if (selectedDescriptionPlain) {
            payload.description = selectedDescriptionPlain.slice(0, 600);
        }
        // Threshold deltas (Build 97). Only persist values that
        // differ from the tile's static default — keeps the
        // localStorage payload minimal, makes "Reset to default" a
        // simple drop-the-field operation at runtime, and ensures
        // that future changes to the shipped defaults flow through
        // automatically for any field the user hasn't customised.
        //
        // Comparison rule: empty input matches `undefined` default,
        // so leaving the field blank when the tile shipped without a
        // warning band is correctly recognised as "unchanged" and
        // omitted. Numeric comparisons are direct === since the
        // parsed values are already finite numbers; a 95 user-typed
        // value matches a 95 default exactly.
        if (warningParsed !== def?.warning && warningParsed !== undefined) {
            payload.thresholdWarning = warningParsed;
        }
        if (criticalParsed !== def?.critical && criticalParsed !== undefined) {
            payload.thresholdCritical = criticalParsed;
        }
        const defaultDirection = def?.direction ?? 'higher_is_better';
        if (thresholdDirection !== defaultDirection) {
            payload.thresholdDirection = thresholdDirection;
        }
        // Viz override (Build 1174). Stored only when set — `null`
        // means "use the conf default", which we represent at the
        // storage layer by simply omitting the field. Same pattern
        // as the threshold deltas above: only persist genuine
        // user-set values, fall through to defaults at runtime.
        if (vizOverrideInput) {
            payload.vizOverride = vizOverrideInput;
        }
        // Display toggles (Build 1202). Only `true` is persisted —
        // the storage sanitiser enforces this too, but doing it here
        // means the payload that hits localStorage matches what the
        // user picked exactly, with no surprise drops downstream.
        // `false` means "let the runtime defaults render the chrome",
        // which is the same as omitting the field entirely.
        if (hidePeakInput) {
            payload.hidePeak = true;
        }
        if (hideDeltaInput) {
            payload.hideDelta = true;
        }
        if (hideOverlayInput) {
            payload.hideOverlay = true;
        }
        onSetSearchDrilldown?.(
            selectedEntry.searchName,
            drilldownDraftSearchName.trim() || null
        );
        // Edge case: the user *cleared* a default-set threshold
        // (e.g. tile defaulted to warning=95, user blanked the input
        // to mean "no warning band"). We can't represent "explicitly
        // undefined" in the override map without a sentinel, so we
        // store the deletion as a sentinel value the merge layer
        // recognises. For now, clearing a defaulted threshold is a
        // rare-enough case that we punt on it — the picker shows a
        // hint when the user blanks an input that has a default, so
        // they're aware the default will be re-applied on next merge.
        // (See comment near the input field.)
        onApply(context.tileId, payload);
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
        setThresholdWarningInput(d && d.warning !== undefined ? String(d.warning) : '');
        setThresholdCriticalInput(d && d.critical !== undefined ? String(d.critical) : '');
        setThresholdDirection(d?.direction ?? 'higher_is_better');
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
        // Native confirm() is intentional: it's universally
        // supported, blocks until the user answers, and visually
        // detaches from the panel chrome — the user can't conflate
        // it with the per-tile "Reset tile" button. The message
        // enumerates exactly what gets wiped so the user knows what
        // they're agreeing to before they click OK.
        const ok = window.confirm(
            'Reset all dashboard customisations?\n\n' +
                'This will undo every change you have made to:\n' +
                "  • Each tile's bound search, value field, label, and description\n" +
                '  • Searchbase drilldown bindings chosen in this picker\n' +
                '  • The visible tile count in each section\n' +
                '  • The order of tiles within each section\n' +
                '  • The map topology (sites, links, names, positions)\n' +
                '  • The map ↔ tiles splitter position\n\n' +
                'Your header title, subtitle, logo, and light/dark theme preference will be kept.\n\n' +
                'This action cannot be undone.'
        );
        if (!ok) return;
        onResetAllCustomizations();
    };

    const handleClearFacets = () => {
        setSelectedApp(DEFAULT_APP_SCOPE);
        setIncludeHiddenSearches(false);
        setIncludeDrilldownSearches(false);
        setIncludeTableSearches(false);
        setSelectedCategory(ALL_CATEGORIES);
        setSelectedSubCategory(ALL_SUB_CATEGORIES);
        setActiveTags(new Set());
        setTagFilter('');
    };

    const handleClearDrilldownFacets = () => {
        setDrilldownSelectedApp(DEFAULT_APP_SCOPE);
        setDrilldownSelectedCategory(ALL_CATEGORIES);
        setDrilldownSelectedSubCategory(ALL_SUB_CATEGORIES);
        setDrilldownActiveTags(new Set());
        setDrilldownTagFilter('');
    };

    return (
        <>
            {/* Backdrop — click outside to dismiss. */}
            <div
                className="fixed inset-0 z-[1500] bg-slate-950/30 backdrop-blur-sm"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Slide-in panel */}
            <aside
                role="dialog"
                aria-modal="true"
                aria-label={`Configure ${context.defaultLabel}`}
                className="fixed top-0 right-0 z-[1600] h-full w-full max-w-[440px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <Settings2 className="w-4 h-4 text-sky-600 dark:text-sky-300" />
                        <div>
                            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 leading-none">
                                Configure tile
                            </p>
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-tight">
                                {context.defaultLabel}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        title="Close (Esc)"
                        aria-label="Close picker"
                        className="p-1.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Filters — search box + facet dropdowns + tag chips */}
                <div className="px-4 pt-3 pb-2 flex-shrink-0 space-y-2">
                    <label className="relative block">
                        <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Filter by name, description, or tag…"
                            maxLength={120}
                            className="w-full pl-8 pr-2.5 py-1.5 text-[12px] rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400"
                        />
                    </label>

                    {/* Filters toggle — collapses the App / Category /
                        Sub-cat / Tag block so the result list gets back
                        ~140px of vertical real-estate at rest. The
                        active-count badge plus the auto-expand effect
                        upstream guarantee the user always knows when a
                        non-default facet is in play. Clear-filters
                        sits inline so dismissing applied filters
                        doesn't require expanding the block first. */}
                    <div className="flex items-center justify-between gap-2">
                        <button
                            type="button"
                            onClick={() => setFiltersOpen((o) => !o)}
                            aria-expanded={filtersOpen}
                            aria-controls="kpi-picker-filters"
                            title={filtersOpen ? 'Hide filters' : 'Show filters (App, Category, Sub-cat, Tags)'}
                            className="flex items-center gap-1.5 px-1.5 py-1 -ml-1.5 rounded text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
                        >
                            {filtersOpen ? (
                                <ChevronDown className="w-3 h-3" />
                            ) : (
                                <ChevronRight className="w-3 h-3" />
                            )}
                            <span>Filters</span>
                            {activeFilterCount > 0 && (
                                <span
                                    className="ml-1 px-1.5 py-px rounded-full bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300 text-[9px] tracking-normal normal-case font-semibold"
                                    title={`${activeFilterCount} active filter${activeFilterCount === 1 ? '' : 's'}`}
                                >
                                    {activeFilterCount} active
                                </span>
                            )}
                        </button>
                        {facetsActive && (
                            <button
                                type="button"
                                onClick={handleClearFacets}
                                title="Reset every filter to its default"
                                className="text-[9px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200"
                            >
                                Clear filters
                            </button>
                        )}
                    </div>

                    {filtersOpen && (
                        <div
                            id="kpi-picker-filters"
                            className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/50"
                        >
                            {/* App facet — defaults to this app's namespace
                                so each picker open starts scoped to vetted
                                dashboard-pack searches. */}
                            <label className="grid gap-1 sm:grid-cols-[82px_minmax(0,1fr)] sm:items-center">
                                <span
                                    className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400"
                                    title="Splunk app the search belongs to"
                                >
                                    App
                                </span>
                                <select
                                    value={selectedApp}
                                    onChange={(e) => setSelectedApp(e.target.value)}
                                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-sky-950"
                                >
                                    <option value={ALL_APPS}>
                                        All apps ({apps.length})
                                    </option>
                                    {apps.map((app) => (
                                        <option key={app} value={app}>
                                            {app}
                                        </option>
                                    ))}
                                    {!apps.includes(DEFAULT_APP_SCOPE) && (
                                        <option value={DEFAULT_APP_SCOPE}>
                                            {DEFAULT_APP_SCOPE}
                                        </option>
                                    )}
                                </select>
                            </label>

                            <div className="grid gap-1 sm:grid-cols-[82px_minmax(0,1fr)] sm:items-start">
                                <span className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">
                                    Visibility
                                </span>
                                <div className="grid grid-cols-3 gap-2">
                                    <label className="flex min-h-[58px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-bold leading-snug text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100">
                                        <input
                                            type="checkbox"
                                            checked={includeHiddenSearches}
                                            onChange={(e) =>
                                                setIncludeHiddenSearches(e.target.checked)
                                            }
                                            className="h-4 w-4 shrink-0 rounded border-slate-300 text-sky-600 focus:ring-sky-400 dark:border-slate-700 dark:bg-slate-900"
                                        />
                                        <span>Show hidden searches</span>
                                    </label>
                                    <label className="flex min-h-[58px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-bold leading-snug text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100">
                                        <input
                                            type="checkbox"
                                            checked={includeDrilldownSearches}
                                            onChange={(e) =>
                                                setIncludeDrilldownSearches(e.target.checked)
                                            }
                                            className="h-4 w-4 shrink-0 rounded border-slate-300 text-sky-600 focus:ring-sky-400 dark:border-slate-700 dark:bg-slate-900"
                                        />
                                        <span>Show drill-down searches</span>
                                    </label>
                                    <label className="flex min-h-[58px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-bold leading-snug text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100">
                                        <input
                                            type="checkbox"
                                            checked={includeTableSearches}
                                            onChange={(e) =>
                                                setIncludeTableSearches(e.target.checked)
                                            }
                                            className="h-4 w-4 shrink-0 rounded border-slate-300 text-sky-600 focus:ring-sky-400 dark:border-slate-700 dark:bg-slate-900"
                                        />
                                        <span>Show table searches</span>
                                    </label>
                                </div>
                            </div>

                            {categories.length > 1 && (
                                <label className="grid gap-1 sm:grid-cols-[82px_minmax(0,1fr)] sm:items-center">
                                    <span className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">
                                        Category
                                    </span>
                                    <select
                                        value={selectedCategory}
                                        onChange={(e) => setSelectedCategory(e.target.value)}
                                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-sky-950"
                                    >
                                        <option value={ALL_CATEGORIES}>All categories</option>
                                        {categories.map((c) => (
                                            <option key={c} value={c}>
                                                {c}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            )}

                            {selectedCategory !== ALL_CATEGORIES &&
                                subCategories.length > 0 && (
                                    <label className="grid gap-1 sm:grid-cols-[82px_minmax(0,1fr)] sm:items-center">
                                        <span className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">
                                            Sub-cat
                                        </span>
                                        <select
                                            value={selectedSubCategory}
                                            onChange={(e) =>
                                                setSelectedSubCategory(e.target.value)
                                            }
                                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-sky-950"
                                        >
                                            <option value={ALL_SUB_CATEGORIES}>
                                                All sub-categories ({subCategories.length})
                                            </option>
                                            {subCategories.map((s) => (
                                                <option key={s} value={s}>
                                                    {s}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                )}

                            {(allTagsWithCounts.length > 0 || activeTags.size > 0) && (
                                <div className="grid gap-1 sm:grid-cols-[82px_minmax(0,1fr)] sm:items-start">
                                    <span className="pt-2 text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">
                                        Tags
                                    </span>
                                    <div className="relative" ref={tagSelectRef}>
                                        <div
                                            onClick={() => {
                                                setTagDropdownOpen(true);
                                                tagInputRef.current?.focus();
                                            }}
                                            className={cn(
                                                'flex min-h-[42px] cursor-text flex-wrap items-center gap-1 rounded-lg border bg-white px-2 py-1.5 transition-shadow dark:bg-slate-950',
                                                tagDropdownOpen
                                                    ? 'border-sky-400 ring-2 ring-sky-400/25'
                                                    : 'border-slate-200 dark:border-slate-800'
                                            )}
                                        >
                                            <Tag className="ml-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                                            {Array.from(activeTags).map((tag) => {
                                                const count = tagCountByName.get(tag) ?? 0;
                                                return (
                                                    <span
                                                        key={tag}
                                                        className="inline-flex items-center gap-1 rounded-full bg-sky-500 py-0.5 pl-2 pr-1 text-[10px] font-bold uppercase tracking-wide text-white"
                                                    >
                                                        {tag}
                                                        {count > 0 && (
                                                            <span className="font-normal opacity-75">
                                                                {count}
                                                            </span>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                removeTag(tag);
                                                            }}
                                                            title={`Remove ${tag} filter`}
                                                            aria-label={`Remove ${tag} filter`}
                                                            className="rounded-full p-0.5 hover:bg-sky-700/40"
                                                        >
                                                            <X className="h-2.5 w-2.5" />
                                                        </button>
                                                    </span>
                                                );
                                            })}
                                            <input
                                                ref={tagInputRef}
                                                type="text"
                                                value={tagFilter}
                                                onChange={(e) => {
                                                    setTagFilter(e.target.value);
                                                    setTagDropdownOpen(true);
                                                }}
                                                onFocus={() => setTagDropdownOpen(true)}
                                                onKeyDown={handleTagInputKeyDown}
                                                placeholder={
                                                    activeTags.size === 0
                                                        ? `Filter by tag (${allTagsWithCounts.length} available, AND combined)...`
                                                        : 'Add tag...'
                                                }
                                                maxLength={64}
                                                aria-label="Filter results by tag"
                                                className="min-w-[120px] flex-1 border-0 bg-transparent py-1 text-sm text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-100"
                                            />
                                        </div>

                                        {tagDropdownOpen && (
                                            <div
                                                role="listbox"
                                                aria-label="Available tags"
                                                className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-auto rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900"
                                            >
                                                {tagDropdownOptions.length === 0 ? (
                                                    <p className="px-3 py-2 text-xs italic text-slate-400 dark:text-slate-500">
                                                        {tagFilter.trim()
                                                            ? `No more tags match "${tagFilter.trim()}".`
                                                            : activeTags.size > 0
                                                            ? 'All available tags already selected.'
                                                            : 'No tags available in this slice.'}
                                                    </p>
                                                ) : (
                                                    <>
                                                        {tagDropdownOptions.map(([tag, count], idx) => {
                                                            const isFirstTyped =
                                                                idx === 0 &&
                                                                Boolean(tagFilter.trim());
                                                            return (
                                                                <button
                                                                    key={tag}
                                                                    type="button"
                                                                    role="option"
                                                                    aria-selected={isFirstTyped}
                                                                    onClick={() => addTag(tag)}
                                                                    title={`${count} search${count === 1 ? '' : 'es'} tagged ${tag}`}
                                                                    className={cn(
                                                                        'flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs transition-colors focus:outline-none',
                                                                        isFirstTyped
                                                                            ? 'bg-sky-50 dark:bg-sky-900/30'
                                                                            : 'hover:bg-sky-50 dark:hover:bg-sky-900/30'
                                                                    )}
                                                                >
                                                                    <span className="flex min-w-0 items-center gap-1.5 truncate text-slate-700 dark:text-slate-200">
                                                                        <Tag className="h-3 w-3 shrink-0 text-slate-400" />
                                                                        <span className="truncate">
                                                                            {tagFilter.trim()
                                                                                ? highlightMatch(tag, tagFilter)
                                                                                : tag}
                                                                        </span>
                                                                    </span>
                                                                    <span className="shrink-0 text-[10px] font-bold text-slate-400 dark:text-slate-500">
                                                                        {count}
                                                                    </span>
                                                                </button>
                                                            );
                                                        })}
                                                        {!tagFilter.trim() &&
                                                            allTagsWithCounts.length -
                                                                activeTags.size >
                                                                tagDropdownOptions.length && (
                                                                <p className="border-t border-slate-100 px-3 py-1.5 text-[10px] text-slate-400 dark:border-slate-800 dark:text-slate-500">
                                                                    Top{' '}
                                                                    {tagDropdownOptions.length}{' '}
                                                                    of{' '}
                                                                    {allTagsWithCounts.length -
                                                                        activeTags.size}{' '}
                                                                    — type to filter.
                                                                </p>
                                                            )}
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Currently-bound banner — sits above the result list
                    so the user can always see *which* search is wired
                    up right now and jump to it with one click. Hidden
                    when the bound search isn't in the catalogue (e.g.
                    a non-searchbase saved search), when the user has
                    already filtered/selected their way to it, or when
                    the user dismissed the strip via the × on the
                    right (Build 94 — once you've seen which search is
                    bound, the strip is dead weight; let users reclaim
                    that ~32px for the result list). */}
                {currentBoundEntry && !boundDismissed && (
                    // Single-row banner. The whole strip (minus the
                    // dismiss × on the right) is the "Jump to"
                    // affordance so the click target is generous and
                    // the bound name stays visible. Built as a flex
                    // row of two siblings instead of nested buttons
                    // (nested <button> isn't valid HTML and Safari
                    // refuses the click).
                    <div className="mx-2 mb-1 px-2 py-1 rounded-md border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 flex items-center gap-2 flex-shrink-0">
                        <button
                            type="button"
                            onClick={jumpToCurrent}
                            title={`Scroll to "${currentBoundEntry.searchName}" and select it`}
                            className="flex-1 min-w-0 flex items-center gap-2 text-left hover:opacity-80 focus:outline-none focus:ring-1 focus:ring-emerald-400 rounded"
                        >
                            <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-emerald-500 text-white text-[8px] font-black flex-shrink-0">
                                ✓
                            </span>
                            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400 flex-shrink-0">
                                Bound:
                            </span>
                            <span
                                className="flex-1 text-[11px] font-bold text-slate-800 dark:text-slate-100 truncate min-w-0"
                                title={currentBoundEntry.searchName}
                            >
                                {currentBoundEntry.searchName}
                            </span>
                            <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-300 flex-shrink-0">
                                Jump to
                            </span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setBoundDismissed(true)}
                            title="Dismiss this strip (gives the result list more room — reopens next time you open the picker)"
                            aria-label="Dismiss currently-bound strip"
                            className="p-0.5 rounded text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 flex-shrink-0 transition-colors focus:outline-none focus:ring-1 focus:ring-emerald-400"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </div>
                )}

                {/* List of searchbase entries */}
                <div ref={listScrollRef} className="flex-1 min-h-0 overflow-auto px-2 pb-2">
                    {loadState === 'loading' && (
                        <div className="flex items-center justify-center gap-2 py-8 text-slate-400 dark:text-slate-500">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="text-[11px] font-bold uppercase tracking-widest">
                                Loading searchbase.conf
                            </span>
                        </div>
                    )}

                    {loadState === 'error' && (
                        <div className="px-3 py-4 mx-2 rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-[11px]">
                            <p className="font-bold mb-1">Couldn't load searchbase.conf.</p>
                            <p className="break-words font-mono text-[10px]">{errorMsg}</p>
                        </div>
                    )}

                    {loadState === 'idle' && filtered.length === 0 && (
                        <div className="px-3 py-8 text-center text-slate-400 dark:text-slate-500 text-[11px]">
                            No searches match the current filters.
                        </div>
                    )}

                    {loadState === 'idle' &&
                        filtered.map((entry) => {
                            const isSelected = entryMatchesKey(entry, selectedId);
                            const isCurrent =
                                currentBoundEntry !== null &&
                                currentBoundEntry.id === entry.id;
                            const isInUse = entryIsUsed(entry, context.usedSavedSearches);
                            const plainDesc = plainTextFromHtml(entry.description);
                            const descExpanded = expandedDescriptionId === entry.id;
                            return (
                                <div
                                    key={entry.id}
                                    role="button"
                                    tabIndex={0}
                                    ref={setItemRef(entry.id)}
                                    onClick={() => setSelectedId(entry.id)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            setSelectedId(entry.id);
                                        }
                                    }}
                                    className={cn(
                                        // Three visual states layered:
                                        //   isSelected (clicked, pending Apply)  → blue
                                        //   isCurrent  (the live binding)         → emerald left rail
                                        //   neither                              → transparent
                                        'w-full text-left mx-1 my-0.5 px-2.5 py-1.5 rounded-md border transition-colors focus:outline-none focus:ring-2 focus:ring-sky-400',
                                        isSelected
                                            ? 'bg-sky-50 dark:bg-sky-900/30 border-sky-400 dark:border-sky-700'
                                            : isCurrent
                                              ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
                                              : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/60'
                                    )}
                                >
                                    <div className="flex items-start gap-2">
                                        <span
                                            className={cn(
                                                'mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0',
                                                isSelected
                                                    ? 'bg-sky-500'
                                                    : isCurrent
                                                      ? 'bg-emerald-500'
                                                      : 'bg-slate-300 dark:bg-slate-600'
                                            )}
                                        />
                                        {/* Viz hint: small Splunk-Studio glyph showing
                                            what kind of chart/table this search will
                                            render. Helps the user filter by viz type
                                            at a glance ("oh that's a pie chart, not
                                            a sparkline") without having to apply
                                            and find out. The icon resolves to the
                                            generic `ChartBasic` glyph when an entry
                                            has no `default_viz` set. */}
                                        <VizIcon
                                            splunkViz={entry.defaultViz}
                                            size={13}
                                            className={cn(
                                                'mt-0.5',
                                                isSelected
                                                    ? 'text-sky-600 dark:text-sky-400'
                                                    : isCurrent
                                                      ? 'text-emerald-600 dark:text-emerald-400'
                                                      : 'text-slate-400 dark:text-slate-500'
                                            )}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-[11px] font-bold text-slate-800 dark:text-slate-100 break-all select-text cursor-text">
                                                    {highlightMatch(entry.searchName, query)}
                                                </span>
                                                {plainDesc && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setExpandedDescriptionId(
                                                                descExpanded ? null : entry.id
                                                            );
                                                        }}
                                                        aria-label={`Show description for ${entry.searchName}`}
                                                        aria-expanded={descExpanded}
                                                        title={
                                                            descExpanded
                                                                ? 'Hide description'
                                                                : 'Show description'
                                                        }
                                                        className={cn(
                                                            'inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border transition-colors focus:outline-none focus:ring-1 focus:ring-sky-400',
                                                            descExpanded
                                                                ? 'border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-200'
                                                                : 'border-transparent text-slate-400 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700 dark:text-slate-500 dark:hover:border-sky-800 dark:hover:bg-sky-950/40 dark:hover:text-sky-200'
                                                        )}
                                                    >
                                                        <Info className="w-3 h-3" />
                                                    </button>
                                                )}
                                                {isCurrent && (
                                                    <span className="inline-flex items-center gap-0.5 text-[8px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400 flex-shrink-0">
                                                        <span className="inline-block w-1 h-1 rounded-full bg-emerald-500" />
                                                        Current
                                                    </span>
                                                )}
                                                {isInUse && !isCurrent && (
                                                    <span className="text-[8px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 flex-shrink-0">
                                                        In use
                                                    </span>
                                                )}
                                            </div>
                                            {(entry.category || entry.tags.length > 0) && (
                                                <div className="mt-1 flex flex-wrap items-center gap-1">
                                                    {entry.category && (
                                                        <span className="inline-flex items-center px-1.5 py-px rounded-sm text-[8px] font-black uppercase tracking-widest bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300">
                                                            {entry.category}
                                                            {entry.subCategory ? (
                                                                <span className="opacity-70 ml-1">
                                                                    · {entry.subCategory}
                                                                </span>
                                                            ) : null}
                                                        </span>
                                                    )}
                                                    {entry.tags.slice(0, 4).map((t) => (
                                                        <span
                                                            key={t}
                                                            className="inline-flex items-center px-1.5 py-px rounded-sm text-[8px] font-bold tracking-wide bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                                                        >
                                                            {t}
                                                        </span>
                                                    ))}
                                                    {entry.tags.length > 4 && (
                                                        <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500">
                                                            +{entry.tags.length - 4}
                                                        </span>
                                                    )}
                                                    {entry.drilldownSearchName && (
                                                        <span
                                                            title={`Attached drilldown: ${entry.drilldownSearchName}`}
                                                            className="inline-flex items-center gap-0.5 px-1.5 py-px rounded-sm text-[8px] font-black uppercase tracking-widest bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                                                        >
                                                            <Table2 className="w-2.5 h-2.5" />
                                                            Drilldown
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                            {plainDesc && descExpanded && (
                                                <p className="mt-2 rounded-md border border-sky-100 bg-sky-50/70 px-2 py-1.5 text-[10px] leading-relaxed text-slate-600 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-slate-300">
                                                    {highlightMatch(plainDesc, query)}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                </div>

                {/* Selection preview + form.
                  *
                  * `max-h-[44%]` gives the accordion editor enough
                  * room to breathe when one section is open while the
                  * search result list still owns the majority of the
                  * drawer. The internal `overflow-auto` keeps every
                  * field reachable when the panel content exceeds the
                  * cap, and the footer lives in a separate sibling so
                  * primary actions stay anchored. */}
                <div className="border-t border-slate-200 dark:border-slate-800 flex-shrink-0 px-4 py-3 space-y-2.5 max-h-[44%] overflow-auto">
                    {selectedEntry ? (
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
                                <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                    {selectedEntry.category && (
                                        <span className="inline-flex items-center px-1.5 py-px rounded-sm text-[9px] font-black uppercase tracking-widest bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300">
                                            {selectedEntry.category}
                                            {selectedEntry.subCategory ? (
                                                <span className="opacity-70 ml-1">
                                                    · {selectedEntry.subCategory}
                                                </span>
                                            ) : null}
                                        </span>
                                    )}
                                    {selectedEntry.tags.map((t) => (
                                        <span
                                            key={t}
                                            className="inline-flex items-center px-1.5 py-px rounded-sm text-[9px] font-bold tracking-wide bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                                        >
                                            {t}
                                        </span>
                                    ))}
                                    {/* Viz-type pill, right-anchored.
                                        `ml-auto` pushes it past any
                                        category/tag chips that
                                        accumulate on the same wrap
                                        line. */}
                                    <span className="ml-auto inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                                        <VizIcon
                                            splunkViz={selectedEntry.defaultViz}
                                            size={12}
                                            showTooltip={false}
                                            className="text-sky-600 dark:text-sky-400"
                                        />
                                        {resolveVizMapping(selectedEntry.defaultViz).label}
                                    </span>
                                </div>
                                <p
                                    className="select-text cursor-text text-[12px] font-bold text-slate-800 dark:text-slate-100 break-words leading-snug"
                                    title="Drag to select part of the search name for copying."
                                >
                                    {selectedEntry.searchName}
                                </p>
                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                    {selectedSearchbaseUrl && (
                                        <a
                                            href={selectedSearchbaseUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            title={`Open ${selectedEntry.id} in Searchbase`}
                                            className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-sky-600 dark:text-sky-300 hover:text-sky-800 dark:hover:text-sky-100 focus:outline-none focus:ring-1 focus:ring-sky-400 rounded px-1 py-0.5"
                                        >
                                            View in Searchbase
                                            <ExternalLink className="w-2.5 h-2.5" />
                                        </a>
                                    )}
                                    {onTestInSearch && selectedEntry.search && (
                                        <button
                                            type="button"
                                            onClick={() => onTestInSearch(selectedEntry.search)}
                                            title="Run this exact SPL in Search (new tab)"
                                            className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-sky-600 dark:text-sky-300 hover:text-sky-800 dark:hover:text-sky-100 focus:outline-none focus:ring-1 focus:ring-sky-400 rounded px-1 py-0.5"
                                        >
                                            <Play className="w-2.5 h-2.5" />
                                            Test in Search
                                            <ExternalLink className="w-2.5 h-2.5" />
                                        </button>
                                    )}
                                    {drilldownDraftSearchName && (
                                        selectedDrilldownUrl ? (
                                            <a
                                                href={selectedDrilldownUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                title={`Open attached drilldown ${selectedDrilldownEntry?.id ?? ''} in Searchbase`}
                                                className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-300 hover:text-emerald-800 dark:hover:text-emerald-100 focus:outline-none focus:ring-1 focus:ring-emerald-400 rounded px-1 py-0.5"
                                            >
                                                <Table2 className="w-2.5 h-2.5" />
                                                Drilldown table
                                                <ExternalLink className="w-2.5 h-2.5" />
                                            </a>
                                        ) : (
                                            <span
                                                title="Attached drilldown searchbase entry is not loaded"
                                                className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-300 rounded px-1 py-0.5"
                                            >
                                                <Table2 className="w-2.5 h-2.5" />
                                                Drilldown table
                                                </span>
                                        )
                                    )}
                                </div>
                            </div>

                            <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 overflow-hidden">
                                <div className="flex items-center justify-between gap-2 px-2.5 py-2 bg-slate-50 dark:bg-slate-900/80">
                                    <button
                                        type="button"
                                        onClick={() => setDataMappingOpen((p) => !p)}
                                        aria-expanded={dataMappingOpen}
                                        aria-controls="kpi-picker-data-mapping-block"
                                        title={
                                            dataMappingOpen
                                                ? 'Hide data mapping fields'
                                                : 'Show data mapping fields'
                                        }
                                        className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 hover:text-sky-700 dark:hover:text-sky-300 focus:outline-none focus:ring-1 focus:ring-sky-400 rounded px-0.5 py-0.5"
                                    >
                                        <Settings2 className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400 flex-shrink-0" />
                                        <span className="flex-shrink-0">Data mapping</span>
                                        <span className="min-w-0 truncate text-[9px] font-semibold normal-case tracking-normal text-slate-400 dark:text-slate-500">
                                            {valueField ? `value: ${valueField}` : 'auto value'}
                                            {labelOverride.trim() ? ' · custom label' : ''}
                                        </span>
                                        <ChevronRight
                                            className={cn(
                                                'w-3 h-3 ml-auto text-slate-400 dark:text-slate-500 transition-transform flex-shrink-0',
                                                dataMappingOpen && 'rotate-90'
                                            )}
                                        />
                                    </button>
                                </div>

                                {dataMappingOpen && (
                                    <div
                                        id="kpi-picker-data-mapping-block"
                                        className="border-t border-slate-200 dark:border-slate-800 p-2.5"
                                    >
                                        <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">
                                        Value field
                                    </label>
                                    <input
                                        type="text"
                                        value={valueField}
                                        onChange={(e) =>
                                            setValueField(
                                                e.target.value.slice(0, MAX_FIELD_LENGTH)
                                            )
                                        }
                                        placeholder="auto-detect"
                                        title={
                                            'The exact column name in the search results to read for the headline / sparkline value.\n\n' +
                                            'Examples: score, count, pct, totalUsers, avg_latency.\n\n' +
                                            'Leave blank to auto-detect (uses the first numeric column found, preferring value / count / score / pct).'
                                        }
                                        className={cn(
                                            'w-full px-2 py-1 text-[11px] rounded border focus:outline-none focus:ring-2 focus:ring-sky-400 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-100',
                                            fieldNameValid
                                                ? 'border-slate-200 dark:border-slate-700'
                                                : 'border-red-400 dark:border-red-600'
                                        )}
                                    />
                                    {!fieldNameValid && (
                                        <p className="mt-0.5 text-[9px] text-red-600 dark:text-red-400">
                                            Letters / digits / underscores / dot only.
                                        </p>
                                    )}
                                    {/* Clickable chips parsed from the SPL — these
                                        are the columns the search will emit (`as
                                        <alias>` and `eval <name>`). Clicking one
                                        fills the input. Helps users discover
                                        valid column names without having to read
                                        the SPL — and makes it obvious that
                                        typing a non-emitted column won't match.
                                        Hidden when no aliases parse out. */}
                                    {fieldNameValid && splFieldSuggestions.length > 0 && (
                                        <div className="mt-1 flex flex-wrap gap-1">
                                            <span className="text-[8px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 self-center">
                                                Use:
                                            </span>
                                            {splFieldSuggestions.map((name) => {
                                                const isPicked = valueField === name;
                                                return (
                                                    <button
                                                        key={name}
                                                        type="button"
                                                        onClick={() => setValueField(name)}
                                                        title={`Use "${name}" — emitted by this SPL`}
                                                        className={cn(
                                                            'inline-flex items-center px-1.5 py-px rounded font-mono text-[9px] border transition-colors',
                                                            isPicked
                                                                ? 'bg-sky-500 text-white border-sky-500'
                                                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-sky-100 dark:hover:bg-sky-900/40 hover:border-sky-400'
                                                        )}
                                                    >
                                                        {name}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                    {fieldNameValid &&
                                        valueField &&
                                        splFieldSuggestions.length > 0 &&
                                        !splFieldSuggestions.includes(valueField) && (
                                            <p className="mt-0.5 text-[9px] text-amber-600 dark:text-amber-400">
                                                "{valueField}" doesn't match any column emitted by this SPL.
                                            </p>
                                        )}
                                </div>
                                <div>
                                    <label className="block text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">
                                        Label override
                                    </label>
                                    <input
                                        type="text"
                                        value={labelOverride}
                                        onChange={(e) =>
                                            setLabelOverride(e.target.value.slice(0, 80))
                                        }
                                        placeholder={context.defaultLabel}
                                        className="w-full px-2 py-1 text-[11px] rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400"
                                    />
                                </div>
                            </div>
                                    </div>
                                )}
                            </div>

                            <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-2.5">
                                <div className="flex items-center justify-between gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setDrilldownOpen((p) => !p)}
                                        aria-expanded={drilldownOpen}
                                        aria-controls="kpi-picker-drilldown-block"
                                        title={
                                            drilldownOpen
                                                ? 'Hide drilldown details'
                                                : 'Show attached drilldown details'
                                        }
                                        className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 hover:text-sky-700 dark:hover:text-sky-300 focus:outline-none focus:ring-1 focus:ring-sky-400 rounded px-0.5 py-0.5"
                                    >
                                        <Table2 className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400 flex-shrink-0" />
                                        <span className="flex-shrink-0">Drilldown</span>
                                        <span className="min-w-0 truncate text-[9px] font-semibold normal-case tracking-normal text-slate-400 dark:text-slate-500">
                                            {drilldownDraftSearchName
                                                ? selectedDrilldownEntry?.searchName ??
                                                  drilldownDraftSearchName
                                                : 'none'}
                                        </span>
                                        <ChevronRight
                                            className={cn(
                                                'w-3 h-3 ml-auto text-slate-400 dark:text-slate-500 transition-transform flex-shrink-0',
                                                drilldownOpen && 'rotate-90'
                                            )}
                                        />
                                    </button>
                                </div>

                                {drilldownOpen && (
                                    <div
                                        id="kpi-picker-drilldown-block"
                                        className="mt-2 border-t border-slate-200 dark:border-slate-800 pt-2"
                                    >
                                        <div className="space-y-2">
                                            <div className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5">
                                                {drilldownDraftSearchName ? (
                                                    <div className="space-y-1">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <p className="min-w-0 text-[11px] font-bold text-slate-700 dark:text-slate-200 leading-snug break-words">
                                                                {selectedDrilldownEntry?.searchName ??
                                                                    drilldownDraftSearchName}
                                                            </p>
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    setDrilldownDraftSearchName('')
                                                                }
                                                                title="Remove this drilldown binding"
                                                                className="flex-shrink-0 inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-300 focus:outline-none focus:ring-1 focus:ring-sky-400 rounded px-1 py-0.5"
                                                            >
                                                                <X className="w-2.5 h-2.5" />
                                                                Clear
                                                            </button>
                                                        </div>
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            {selectedDrilldownUrl && (
                                                                <a
                                                                    href={selectedDrilldownUrl}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    title={`Open attached drilldown ${selectedDrilldownEntry?.id ?? ''} in Searchbase`}
                                                                    className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-300 hover:text-emerald-800 dark:hover:text-emerald-100 focus:outline-none focus:ring-1 focus:ring-emerald-400 rounded px-1 py-0.5"
                                                                >
                                                                    View in Searchbase
                                                                    <ExternalLink className="w-2.5 h-2.5" />
                                                                </a>
                                                            )}
                                                            {onTestInSearch &&
                                                                selectedDrilldownEntry?.search && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            onTestInSearch(
                                                                                selectedDrilldownEntry.search
                                                                            )
                                                                        }
                                                                        title="Run the attached drilldown SPL in Search (new tab)"
                                                                        className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-300 hover:text-emerald-800 dark:hover:text-emerald-100 focus:outline-none focus:ring-1 focus:ring-emerald-400 rounded px-1 py-0.5"
                                                                    >
                                                                        <Play className="w-2.5 h-2.5" />
                                                                        Test drilldown
                                                                        <ExternalLink className="w-2.5 h-2.5" />
                                                                    </button>
                                                                )}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                                        No drilldown attached.
                                                    </p>
                                                )}
                                            </div>

                                            <label className="relative block">
                                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                                                <input
                                                    type="text"
                                                    value={drilldownQuery}
                                                    onChange={(e) =>
                                                        setDrilldownQuery(e.target.value)
                                                    }
                                                    placeholder="Search Searchbase drilldowns..."
                                                    className="w-full pl-7 pr-2 py-1.5 text-[11px] rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400"
                                                />
                                            </label>

                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setDrilldownFiltersOpen((o) => !o)
                                                        }
                                                        aria-expanded={drilldownFiltersOpen}
                                                        aria-controls="kpi-picker-drilldown-filters"
                                                        title={
                                                            drilldownFiltersOpen
                                                                ? 'Hide drilldown filters'
                                                                : 'Show drilldown filters'
                                                        }
                                                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-slate-100 dark:bg-slate-800/80 text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200 hover:text-sky-700 dark:hover:text-sky-300 focus:outline-none focus:ring-1 focus:ring-sky-400"
                                                    >
                                                        <ChevronDown
                                                            className={cn(
                                                                'w-3 h-3 transition-transform',
                                                                !drilldownFiltersOpen &&
                                                                    '-rotate-90'
                                                            )}
                                                        />
                                                        Filters
                                                        {drilldownActiveFilterCount > 0 && (
                                                            <span
                                                                className="ml-1 px-1.5 py-px rounded-full bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300 text-[8px] tracking-normal normal-case font-semibold"
                                                                title={`${drilldownActiveFilterCount} active drilldown filter${drilldownActiveFilterCount === 1 ? '' : 's'}`}
                                                            >
                                                                {drilldownActiveFilterCount} active
                                                            </span>
                                                        )}
                                                    </button>
                                                    {drilldownFacetsActive && (
                                                        <button
                                                            type="button"
                                                            onClick={handleClearDrilldownFacets}
                                                            title="Reset every drilldown filter to its default"
                                                            className="text-[9px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200"
                                                        >
                                                            Clear filters
                                                        </button>
                                                    )}
                                                </div>

                                                {drilldownFiltersOpen && (
                                                    <div
                                                        id="kpi-picker-drilldown-filters"
                                                        className="space-y-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <span
                                                                className="text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 flex-shrink-0 w-16"
                                                                title="Splunk app the drilldown search belongs to"
                                                            >
                                                                App
                                                            </span>
                                                            <select
                                                                value={drilldownSelectedApp}
                                                                onChange={(e) =>
                                                                    setDrilldownSelectedApp(
                                                                        e.target.value
                                                                    )
                                                                }
                                                                className="flex-1 px-2 py-1 text-[11px] rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400"
                                                            >
                                                                <option value={ALL_APPS}>
                                                                    All apps ({drilldownApps.length})
                                                                </option>
                                                                {drilldownApps.map((app) => (
                                                                    <option key={app} value={app}>
                                                                        {app}
                                                                    </option>
                                                                ))}
                                                                {!drilldownApps.includes(
                                                                    DEFAULT_APP_SCOPE
                                                                ) && (
                                                                    <option
                                                                        value={DEFAULT_APP_SCOPE}
                                                                    >
                                                                        {DEFAULT_APP_SCOPE}
                                                                    </option>
                                                                )}
                                                            </select>
                                                        </div>

                                                        {drilldownCategories.length > 1 && (
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 flex-shrink-0 w-16">
                                                                    Category
                                                                </span>
                                                                <select
                                                                    value={
                                                                        drilldownSelectedCategory
                                                                    }
                                                                    onChange={(e) =>
                                                                        setDrilldownSelectedCategory(
                                                                            e.target.value
                                                                        )
                                                                    }
                                                                    className="flex-1 px-2 py-1 text-[11px] rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400"
                                                                >
                                                                    <option
                                                                        value={ALL_CATEGORIES}
                                                                    >
                                                                        All categories
                                                                    </option>
                                                                    {drilldownCategories.map(
                                                                        (category) => (
                                                                            <option
                                                                                key={category}
                                                                                value={category}
                                                                            >
                                                                                {category}
                                                                            </option>
                                                                        )
                                                                    )}
                                                                </select>
                                                            </div>
                                                        )}

                                                        {drilldownSelectedCategory !==
                                                            ALL_CATEGORIES &&
                                                            drilldownSubCategories.length > 0 && (
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 flex-shrink-0 w-16">
                                                                        Sub-cat
                                                                    </span>
                                                                    <select
                                                                        value={
                                                                            drilldownSelectedSubCategory
                                                                        }
                                                                        onChange={(e) =>
                                                                            setDrilldownSelectedSubCategory(
                                                                                e.target.value
                                                                            )
                                                                        }
                                                                        className="flex-1 px-2 py-1 text-[11px] rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400"
                                                                    >
                                                                        <option
                                                                            value={
                                                                                ALL_SUB_CATEGORIES
                                                                            }
                                                                        >
                                                                            All sub-categories (
                                                                            {
                                                                                drilldownSubCategories.length
                                                                            }
                                                                            )
                                                                        </option>
                                                                        {drilldownSubCategories.map(
                                                                            (subCategory) => (
                                                                                <option
                                                                                    key={
                                                                                        subCategory
                                                                                    }
                                                                                    value={
                                                                                        subCategory
                                                                                    }
                                                                                >
                                                                                    {
                                                                                        subCategory
                                                                                    }
                                                                                </option>
                                                                            )
                                                                        )}
                                                                    </select>
                                                                </div>
                                                            )}

                                                        {(drilldownAllTagsWithCounts.length > 0 ||
                                                            drilldownActiveTags.size > 0) && (
                                                            <div
                                                                className="relative"
                                                                ref={drilldownTagSelectRef}
                                                            >
                                                                <div
                                                                    onClick={() => {
                                                                        setDrilldownTagDropdownOpen(
                                                                            true
                                                                        );
                                                                        drilldownTagInputRef.current?.focus();
                                                                    }}
                                                                    className={cn(
                                                                        'flex flex-wrap items-center gap-1 px-1.5 py-1 rounded-md border bg-white dark:bg-slate-800 cursor-text transition-shadow',
                                                                        drilldownTagDropdownOpen
                                                                            ? 'border-sky-400 ring-2 ring-sky-400/40'
                                                                            : 'border-slate-200 dark:border-slate-700'
                                                                    )}
                                                                >
                                                                    <Tag className="w-3 h-3 text-slate-400 flex-shrink-0 ml-0.5" />
                                                                    {Array.from(
                                                                        drilldownActiveTags
                                                                    ).map((tag) => {
                                                                        const count =
                                                                            drilldownTagCountByName.get(
                                                                                tag
                                                                            ) ?? 0;
                                                                        return (
                                                                            <span
                                                                                key={tag}
                                                                                className="inline-flex items-center gap-1 pl-1.5 pr-0.5 py-0.5 rounded-full bg-sky-500 text-white text-[9px] font-bold uppercase tracking-wider"
                                                                            >
                                                                                {tag}
                                                                                {count > 0 && (
                                                                                    <span className="opacity-70 font-normal">
                                                                                        {count}
                                                                                    </span>
                                                                                )}
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={(
                                                                                        e
                                                                                    ) => {
                                                                                        e.stopPropagation();
                                                                                        removeDrilldownTag(
                                                                                            tag
                                                                                        );
                                                                                    }}
                                                                                    title={`Remove ${tag} drilldown filter`}
                                                                                    aria-label={`Remove ${tag} drilldown filter`}
                                                                                    className="p-0.5 rounded-full hover:bg-sky-700/40"
                                                                                >
                                                                                    <X className="w-2 h-2" />
                                                                                </button>
                                                                            </span>
                                                                        );
                                                                    })}
                                                                    <input
                                                                        ref={drilldownTagInputRef}
                                                                        type="text"
                                                                        value={drilldownTagFilter}
                                                                        onChange={(e) => {
                                                                            setDrilldownTagFilter(
                                                                                e.target.value
                                                                            );
                                                                            setDrilldownTagDropdownOpen(
                                                                                true
                                                                            );
                                                                        }}
                                                                        onFocus={() =>
                                                                            setDrilldownTagDropdownOpen(
                                                                                true
                                                                            )
                                                                        }
                                                                        onKeyDown={
                                                                            handleDrilldownTagInputKeyDown
                                                                        }
                                                                        placeholder={
                                                                            drilldownActiveTags.size ===
                                                                            0
                                                                                ? `Filter by tag (${drilldownAllTagsWithCounts.length} available, AND combined)…`
                                                                                : 'Add tag…'
                                                                        }
                                                                        maxLength={64}
                                                                        aria-label="Filter drilldown results by tag"
                                                                        className="flex-1 min-w-[80px] bg-transparent border-0 outline-none text-[11px] text-slate-700 dark:text-slate-100 placeholder:text-slate-400 py-0.5"
                                                                    />
                                                                </div>

                                                                {drilldownTagDropdownOpen && (
                                                                    <div
                                                                        role="listbox"
                                                                        aria-label="Available drilldown tags"
                                                                        className="absolute left-0 right-0 top-full mt-1 z-30 max-h-56 overflow-auto rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl"
                                                                    >
                                                                        {drilldownTagDropdownOptions.length ===
                                                                        0 ? (
                                                                            <p className="px-2 py-2 text-[10px] italic text-slate-400 dark:text-slate-500">
                                                                                {drilldownTagFilter.trim()
                                                                                    ? `No more tags match "${drilldownTagFilter.trim()}".`
                                                                                    : drilldownActiveTags.size >
                                                                                        0
                                                                                      ? 'All available tags already selected.'
                                                                                      : 'No tags available in this slice.'}
                                                                            </p>
                                                                        ) : (
                                                                            <>
                                                                                {drilldownTagDropdownOptions.map(
                                                                                    ([
                                                                                        tag,
                                                                                        count,
                                                                                    ], idx) => {
                                                                                        const isFirstTyped =
                                                                                            idx ===
                                                                                                0 &&
                                                                                            Boolean(
                                                                                                drilldownTagFilter.trim()
                                                                                            );
                                                                                        return (
                                                                                            <button
                                                                                                key={
                                                                                                    tag
                                                                                                }
                                                                                                type="button"
                                                                                                role="option"
                                                                                                aria-selected={
                                                                                                    isFirstTyped
                                                                                                }
                                                                                                onClick={() =>
                                                                                                    addDrilldownTag(
                                                                                                        tag
                                                                                                    )
                                                                                                }
                                                                                                title={`${count} drilldown search${count === 1 ? '' : 'es'} tagged ${tag}`}
                                                                                                className={cn(
                                                                                                    'w-full flex items-center justify-between gap-2 px-2 py-1 text-left text-[11px] focus:outline-none transition-colors',
                                                                                                    isFirstTyped
                                                                                                        ? 'bg-sky-50 dark:bg-sky-900/30'
                                                                                                        : 'hover:bg-sky-50 dark:hover:bg-sky-900/30'
                                                                                                )}
                                                                                            >
                                                                                                <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200 truncate min-w-0">
                                                                                                    <Tag className="w-2.5 h-2.5 flex-shrink-0 text-slate-400" />
                                                                                                    <span className="truncate">
                                                                                                        {drilldownTagFilter.trim()
                                                                                                            ? highlightMatch(
                                                                                                                  tag,
                                                                                                                  drilldownTagFilter
                                                                                                              )
                                                                                                            : tag}
                                                                                                    </span>
                                                                                                </span>
                                                                                                <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 flex-shrink-0">
                                                                                                    {
                                                                                                        count
                                                                                                    }
                                                                                                </span>
                                                                                            </button>
                                                                                        );
                                                                                    }
                                                                                )}
                                                                                {!drilldownTagFilter.trim() &&
                                                                                    drilldownAllTagsWithCounts.length -
                                                                                        drilldownActiveTags.size >
                                                                                        drilldownTagDropdownOptions.length && (
                                                                                        <p className="px-2 py-1 text-[9px] text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800">
                                                                                            Top{' '}
                                                                                            {
                                                                                                drilldownTagDropdownOptions.length
                                                                                            }{' '}
                                                                                            of{' '}
                                                                                            {drilldownAllTagsWithCounts.length -
                                                                                                drilldownActiveTags.size}{' '}
                                                                                            — type to filter.
                                                                                        </p>
                                                                                    )}
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex items-center justify-between gap-2 px-1 text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                                                <span>
                                                    {drilldownCandidates.length.toLocaleString()}{' '}
                                                    {drilldownCandidates.length === 1
                                                        ? 'match'
                                                        : 'matches'}
                                                </span>
                                                <span>
                                                    {drilldownBaseEntries.length.toLocaleString()}{' '}
                                                    searchable
                                                </span>
                                            </div>

                                            <div className="max-h-72 overflow-auto space-y-1 pr-1">
                                                {drilldownCandidates.length === 0 ? (
                                                    <p className="px-1 py-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                                                        No matching Searchbase entries.
                                                    </p>
                                                ) : (
                                                    drilldownCandidates.map((entry) => {
                                                        const isPicked = entryMatchesKey(
                                                            entry,
                                                            drilldownDraftSearchName
                                                        );
                                                        const viz = resolveVizMapping(
                                                            entry.defaultViz
                                                        );
                                                        const description =
                                                            plainTextFromHtml(
                                                                entry.description
                                                            );
                                                        return (
                                                            <button
                                                                key={entry.id}
                                                                type="button"
                                                                onClick={() =>
                                                                    setDrilldownDraftSearchName(
                                                                        entry.searchName
                                                                    )
                                                                }
                                                                title={`Use ${entry.searchName} as the drilldown table`}
                                                                className={cn(
                                                                    'w-full text-left rounded border px-2 py-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-400',
                                                                    isPicked
                                                                        ? 'border-sky-400 bg-sky-50 dark:border-sky-600 dark:bg-sky-950/40'
                                                                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-sky-300 dark:hover:border-sky-700'
                                                                )}
                                                            >
                                                                <span className="flex items-center gap-1.5">
                                                                    <VizIcon
                                                                        splunkViz={
                                                                            entry.defaultViz
                                                                        }
                                                                        size={12}
                                                                        showTooltip={false}
                                                                        className="text-sky-600 dark:text-sky-300 flex-shrink-0"
                                                                    />
                                                                    <span className="min-w-0 flex-1 truncate text-[10.5px] font-bold text-slate-700 dark:text-slate-200">
                                                                        {highlightMatch(
                                                                            entry.searchName,
                                                                            drilldownQuery
                                                                        )}
                                                                    </span>
                                                                    <span
                                                                        className={cn(
                                                                            'flex-shrink-0 rounded-sm px-1 py-px text-[8px] font-black uppercase tracking-widest',
                                                                            entry.defaultViz ===
                                                                                'splunk.table'
                                                                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                                                                                : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                                                                        )}
                                                                    >
                                                                        {entry.defaultViz ===
                                                                        'splunk.table'
                                                                            ? 'table'
                                                                            : viz.label}
                                                                    </span>
                                                                </span>
                                                                {description && (
                                                                    <span className="mt-0.5 block line-clamp-2 text-[9.5px] leading-snug text-slate-500 dark:text-slate-400">
                                                                        {description}
                                                                    </span>
                                                                )}
                                                            </button>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* CHART STYLE form (Build 1174).
                              *
                              * Lets the operator override how the tile
                              * renders WITHOUT changing which search
                              * drives it. Useful when the conf default
                              * (e.g. `splunk.column` for FW Blocked)
                              * doesn't fit the operator's preference
                              * (Alan asked for area on FW Blocked on
                              * 2026-05-18). Also exposes the
                              * `singlevalue` collapse-the-chart option
                              * for tiles whose timechart adds clutter.
                              *
                              * Storage rule: persisted only when the
                              * user picks something other than
                              * "Default". Picking Default on Apply
                              * silently drops the override field from
                              * the stored payload — same as
                              * "Reset to default" for thresholds. The
                              * runtime `MetricCardLeaf` reads
                              * `override.vizOverride` first and falls
                              * back to `searchbase.conf`'s
                              * `default_viz` so this picker can never
                              * desync from what the tile actually
                              * shows.
                              *
                              * Choices intentionally limited to the
                              * four sparkline variants; switching to
                              * a TABLE / BAR-BREAKDOWN viz changes
                              * the data hook, not just the rendering,
                              * so it must come through a different
                              * `savedSearch` whose conf default
                              * already names that viz. */}
                            <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-2.5">
                                <div className="flex items-center justify-between gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setChartStyleOpen((p) => !p)}
                                        aria-expanded={chartStyleOpen}
                                        aria-controls="kpi-picker-chart-style-block"
                                        title={
                                            chartStyleOpen
                                                ? 'Hide the chart style picker'
                                                : 'Show the chart style picker (override how this tile renders)'
                                        }
                                        className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 hover:text-sky-700 dark:hover:text-sky-300 focus:outline-none focus:ring-1 focus:ring-sky-400 rounded px-0.5 py-0.5"
                                    >
                                        <BarChart3 className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
                                        Chart style
                                        {vizOverrideInput && (
                                            <span
                                                title="This tile has a custom chart style applied (different from the searchbase default)"
                                                className="ml-1 inline-flex items-center px-1 py-px rounded-sm bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 text-[8px] font-bold tracking-wide normal-case"
                                            >
                                                custom
                                            </span>
                                        )}
                                        <ChevronRight
                                            className={cn(
                                                'w-3 h-3 ml-1 text-slate-400 dark:text-slate-500 transition-transform',
                                                chartStyleOpen && 'rotate-90'
                                            )}
                                        />
                                    </button>
                                    {chartStyleOpen && vizOverrideInput && (
                                        <button
                                            type="button"
                                            onClick={() => setVizOverrideInput(null)}
                                            title="Restore the chart style to the searchbase default for this tile (still has to be applied)"
                                            className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-400 rounded px-1 py-0.5"
                                        >
                                            <RotateCcw className="w-2.5 h-2.5" />
                                            Reset to default
                                        </button>
                                    )}
                                </div>
                                {chartStyleOpen && (
                                <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400 leading-snug">
                                    Override how this tile renders. {' '}
                                    <span className="text-slate-400 dark:text-slate-500">
                                        Default uses the searchbase{' '}
                                        <code className="font-mono">default_viz</code>
                                        {selectedEntry?.defaultViz ? (
                                            <>
                                                {' '}
                                                ({resolveVizMapping(selectedEntry.defaultViz).label})
                                            </>
                                        ) : null}
                                        .
                                    </span>
                                </p>
                                )}
                                {chartStyleOpen && (
                                <div id="kpi-picker-chart-style-block" className="mt-2 grid grid-cols-6 gap-1 p-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                                    {(
                                        [
                                            { v: null, label: 'Default', splunkViz: undefined, hint: 'Use the searchbase default_viz' },
                                            { v: 'area' as const, label: 'Area', splunkViz: 'splunk.area', hint: 'Filled area chart' },
                                            { v: 'line' as const, label: 'Line', splunkViz: 'splunk.line', hint: 'Line chart' },
                                            { v: 'column' as const, label: 'Column', splunkViz: 'splunk.column', hint: 'Vertical bars (each bar grows up; one per bucket)' },
                                            // Build 1187 — horizontal bars, recharts `layout="vertical"`.
                                            // Kept distinct from Column so operators can pick which
                                            // axis the bars sit on without editing searchbase.conf.
                                            { v: 'bar' as const, label: 'Bar', splunkViz: 'splunk.bar', hint: 'Horizontal bars (each bar grows right; one per bucket)' },
                                            { v: 'singlevalue' as const, label: 'Single', splunkViz: 'splunk.singlevalue', hint: 'Headline only — no chart underneath' },
                                        ]
                                    ).map((opt) => {
                                        const active = vizOverrideInput === opt.v;
                                        return (
                                            <button
                                                key={opt.label}
                                                type="button"
                                                onClick={() => setVizOverrideInput(opt.v)}
                                                title={opt.hint}
                                                className={cn(
                                                    'inline-flex items-center justify-center gap-1 px-1 py-1 text-[10px] font-bold uppercase tracking-wider rounded transition-colors focus:outline-none focus:ring-1 focus:ring-sky-400',
                                                    active
                                                        ? 'bg-sky-500 text-white'
                                                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                                                )}
                                                aria-pressed={active}
                                            >
                                                {opt.splunkViz && (
                                                    <VizIcon
                                                        splunkViz={opt.splunkViz}
                                                        size={11}
                                                        showTooltip={false}
                                                        className={active ? 'text-white' : undefined}
                                                    />
                                                )}
                                                {opt.label}
                                            </button>
                                        );
                                    })}
                                </div>
                                )}
                            </div>

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
                            <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-2.5">
                                <div className="flex items-center justify-between gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setDisplayOpen((p) => !p)}
                                        aria-expanded={displayOpen}
                                        aria-controls="kpi-picker-display-block"
                                        title={
                                            displayOpen
                                                ? 'Hide the display chrome toggles'
                                                : 'Show the display chrome toggles (hide peak labels, delta pill, comparison overlay)'
                                        }
                                        className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 hover:text-sky-700 dark:hover:text-sky-300 focus:outline-none focus:ring-1 focus:ring-sky-400 rounded px-0.5 py-0.5"
                                    >
                                        <Eye className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
                                        Display
                                        {displayCustomised && (
                                            <span
                                                title="This tile has display chrome hidden (different from the shipped defaults)"
                                                className="ml-1 inline-flex items-center px-1 py-px rounded-sm bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 text-[8px] font-bold tracking-wide normal-case"
                                            >
                                                custom
                                            </span>
                                        )}
                                        <ChevronRight
                                            className={cn(
                                                'w-3 h-3 ml-1 text-slate-400 dark:text-slate-500 transition-transform',
                                                displayOpen && 'rotate-90'
                                            )}
                                        />
                                    </button>
                                    {displayOpen && displayCustomised && (
                                        <button
                                            type="button"
                                            onClick={handleResetDisplay}
                                            title="Restore the peak / delta / overlay visibility to the shipped defaults for this tile (still has to be applied)"
                                            className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-400 rounded px-1 py-0.5"
                                        >
                                            <RotateCcw className="w-2.5 h-2.5" />
                                            Reset to default
                                        </button>
                                    )}
                                </div>
                                {displayOpen && (
                                <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400 leading-snug">
                                    Hide the decoration around the headline value. {' '}
                                    <span className="text-slate-400 dark:text-slate-500">
                                        To collapse the chart entirely, use {' '}
                                        <span className="font-bold">Chart style → Single</span> {' '}
                                        above.
                                    </span>
                                </p>
                                )}
                                {displayOpen && (
                                <div id="kpi-picker-display-block" className="mt-2 grid grid-cols-1 gap-1.5">
                                    {/* Peak callout toggle. */}
                                    <label
                                        className={cn(
                                            'flex items-start gap-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 cursor-pointer transition-colors',
                                            'hover:border-sky-300 dark:hover:border-sky-700'
                                        )}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={hidePeakInput}
                                            onChange={(e) => setHidePeakInput(e.target.checked)}
                                            className="mt-0.5 h-3 w-3 rounded border-slate-300 dark:border-slate-600 text-sky-500 focus:ring-1 focus:ring-sky-400 flex-shrink-0"
                                        />
                                        <span className="flex-1 min-w-0">
                                            <span className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 leading-tight">
                                                Hide peak labels
                                            </span>
                                            <span className="block mt-0.5 text-[9.5px] text-slate-500 dark:text-slate-400 leading-snug">
                                                Removes the min / peak bubbles on the
                                                sparkline. Useful when the headline value is
                                                what matters and the highs / lows distract.
                                            </span>
                                        </span>
                                    </label>

                                    {/* Delta-vs-previous toggle. */}
                                    <label
                                        className={cn(
                                            'flex items-start gap-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 cursor-pointer transition-colors',
                                            'hover:border-sky-300 dark:hover:border-sky-700'
                                        )}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={hideDeltaInput}
                                            onChange={(e) => setHideDeltaInput(e.target.checked)}
                                            className="mt-0.5 h-3 w-3 rounded border-slate-300 dark:border-slate-600 text-sky-500 focus:ring-1 focus:ring-sky-400 flex-shrink-0"
                                        />
                                        <span className="flex-1 min-w-0">
                                            <span className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 leading-tight">
                                                Hide delta vs previous
                                            </span>
                                            <span className="block mt-0.5 text-[9.5px] text-slate-500 dark:text-slate-400 leading-snug">
                                                Removes the ↑ / ↓ percentage pill next to the
                                                headline. Pick this when the absolute number
                                                speaks for itself and the period-over-period
                                                comparison adds noise.
                                            </span>
                                        </span>
                                    </label>

                                    {/* Previous-period overlay toggle (Build 1203). */}
                                    <label
                                        className={cn(
                                            'flex items-start gap-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 cursor-pointer transition-colors',
                                            'hover:border-sky-300 dark:hover:border-sky-700'
                                        )}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={hideOverlayInput}
                                            onChange={(e) => setHideOverlayInput(e.target.checked)}
                                            className="mt-0.5 h-3 w-3 rounded border-slate-300 dark:border-slate-600 text-sky-500 focus:ring-1 focus:ring-sky-400 flex-shrink-0"
                                        />
                                        <span className="flex-1 min-w-0">
                                            <span className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 leading-tight">
                                                Hide comparison overlay
                                            </span>
                                            <span className="block mt-0.5 text-[9.5px] text-slate-500 dark:text-slate-400 leading-snug">
                                                Removes the dashed previous-period / baseline
                                                line from the sparkline canvas. The trend stays;
                                                the side-by-side comparison goes away.
                                            </span>
                                        </span>
                                    </label>
                                </div>
                                )}
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
                                {displayOpen && context?.sectionId && onApplyDisplayToSection && (
                                    <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                                        <button
                                            type="button"
                                            onClick={handleApplyDisplayToSection}
                                            title="Write these Display settings to every tile in this section. Other tile customisations (search binding, value field, chart style, thresholds) are left untouched."
                                            className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-sky-600 hover:text-sky-800 dark:text-sky-400 dark:hover:text-sky-200 focus:outline-none focus:ring-1 focus:ring-sky-400 rounded px-1 py-0.5"
                                        >
                                            <Eye className="w-3 h-3" />
                                            Apply to all tiles in {context.sectionLabel || 'section'}
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* THRESHOLDS form.
                              *
                              * Build 97: introduced the form.
                              * Build 98: visual surface + default-expand
                              *   to fix discoverability — the form was
                              *   here all along, but its toggle row used
                              *   to read like a minor utility link.
                              *   Wrapping in a panel-like surface with
                              *   a Gauge icon and a slightly heftier
                              *   heading makes it clear this is *the*
                              *   per-tile customisation, not a minor
                              *   sub-detail. Default-expand on every
                              *   open so the user lands on the inputs.
                              *
                              * Behaviour: collapsible section that lets
                              * the user override the tile's
                              * `MetricThresholds` tuple at runtime. Uses
                              * the same `MetricThresholds` shape and
                              * `deriveThresholdLines` formatter the
                              * per-tile info popover and `computeStatus`
                              * runtime use, so what the picker previews
                              * here is exactly what the popover and the
                              * tile colour will show after Apply — there's
                              * exactly one source of truth, no chance of
                              * UI/runtime drift.
                              *
                              * Layout: heading row (Gauge icon + label +
                              * custom-badge + collapse chevron + Reset
                              * link), then a 3-row form when expanded
                              * (direction segmented control, side-by-side
                              * Warning + Critical number inputs, then the
                              * live "Healthy / Warning / Critical"
                              * preview). The "Reset to default" link
                              * surfaces only when the user has changed
                              * something away from the shipped default. */}
                            <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-2.5">
                                <div className="flex items-center justify-between gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setThresholdsOpen((p) => !p)}
                                        aria-expanded={thresholdsOpen}
                                        aria-controls="kpi-picker-thresholds-block"
                                        title={
                                            thresholdsOpen
                                                ? 'Hide the thresholds form'
                                                : 'Show the thresholds form (set custom warning / critical bands for this tile)'
                                        }
                                        className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 hover:text-sky-700 dark:hover:text-sky-300 focus:outline-none focus:ring-1 focus:ring-sky-400 rounded px-0.5 py-0.5"
                                    >
                                        <Gauge className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
                                        Thresholds
                                        {thresholdsCustomised && (
                                            <span
                                                title="This tile has custom thresholds applied (different from the shipped defaults)"
                                                className="ml-1 inline-flex items-center px-1 py-px rounded-sm bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 text-[8px] font-bold tracking-wide normal-case"
                                            >
                                                custom
                                            </span>
                                        )}
                                        <ChevronRight
                                            className={cn(
                                                'w-3 h-3 ml-1 text-slate-400 dark:text-slate-500 transition-transform',
                                                thresholdsOpen && 'rotate-90'
                                            )}
                                        />
                                    </button>
                                    {thresholdsOpen && thresholdsCustomised && (
                                        <button
                                            type="button"
                                            onClick={handleResetThresholds}
                                            title="Restore warning / critical / direction to the shipped defaults for this tile (still has to be applied)"
                                            className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-400 rounded px-1 py-0.5"
                                        >
                                            <RotateCcw className="w-2.5 h-2.5" />
                                            Reset to default
                                        </button>
                                    )}
                                </div>

                                {/* Helper line — telegraphs what this
                                    section actually does on a fresh
                                    picker open before the user has
                                    typed anything. Shown only when
                                    expanded so the collapsed state
                                    remains a single compact row. */}
                                {thresholdsOpen && (
                                    <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400 leading-snug">
                                        Set the warning and critical bands
                                        used to colour the headline value
                                        and the status icon for this tile.
                                        Leave a field blank to disable
                                        that band.
                                    </p>
                                )}

                                {thresholdsOpen && (
                                    <div
                                        id="kpi-picker-thresholds-block"
                                        className="mt-2 space-y-2"
                                    >
                                        {/* Direction segmented control — two
                                            mutually-exclusive buttons. The
                                            small description under each
                                            segment doubles as a teach-in
                                            (operators sometimes forget which
                                            way the bands work for inverted
                                            metrics). */}
                                        <div>
                                            <label className="block text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">
                                                Direction
                                            </label>
                                            <div className="grid grid-cols-2 gap-1 p-0.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                                                {(
                                                    [
                                                        {
                                                            v: 'higher_is_better' as const,
                                                            label: 'Higher is better',
                                                            hint: 'Healthy when value ≥ warning threshold',
                                                        },
                                                        {
                                                            v: 'lower_is_better' as const,
                                                            label: 'Lower is better',
                                                            hint: 'Healthy when value ≤ warning threshold',
                                                        },
                                                    ]
                                                ).map((opt) => {
                                                    const active =
                                                        thresholdDirection === opt.v;
                                                    return (
                                                        <button
                                                            key={opt.v}
                                                            type="button"
                                                            onClick={() =>
                                                                setThresholdDirection(opt.v)
                                                            }
                                                            title={opt.hint}
                                                            className={cn(
                                                                'px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded transition-colors focus:outline-none focus:ring-1 focus:ring-sky-400',
                                                                active
                                                                    ? 'bg-sky-500 text-white'
                                                                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                                                            )}
                                                            aria-pressed={active}
                                                        >
                                                            {opt.label}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Warning + Critical inputs side by
                                            side. Each shows the static
                                            default in the helper line under
                                            the input so the user can always
                                            see what the tile shipped with. */}
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="block text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">
                                                    Warning
                                                </label>
                                                <input
                                                    type="number"
                                                    inputMode="decimal"
                                                    step="any"
                                                    value={thresholdWarningInput}
                                                    onChange={(e) =>
                                                        setThresholdWarningInput(
                                                            e.target.value.slice(0, 32)
                                                        )
                                                    }
                                                    placeholder={
                                                        def?.warning !== undefined
                                                            ? String(def.warning)
                                                            : 'none'
                                                    }
                                                    title="Value at which the headline flips to the warning colour. Leave blank to disable the warning band."
                                                    className={cn(
                                                        'w-full px-2 py-1 text-[11px] rounded border focus:outline-none focus:ring-2 focus:ring-sky-400 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-100',
                                                        warningInputValid
                                                            ? 'border-slate-200 dark:border-slate-700'
                                                            : 'border-red-400 dark:border-red-600'
                                                    )}
                                                />
                                                <p className="mt-0.5 text-[9px] text-slate-400 dark:text-slate-500">
                                                    {def?.warning !== undefined
                                                        ? `default: ${formatThresholdNumber(def.warning, context.thresholdUnit)}`
                                                        : 'no shipped default'}
                                                </p>
                                            </div>
                                            <div>
                                                <label className="block text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">
                                                    Critical
                                                </label>
                                                <input
                                                    type="number"
                                                    inputMode="decimal"
                                                    step="any"
                                                    value={thresholdCriticalInput}
                                                    onChange={(e) =>
                                                        setThresholdCriticalInput(
                                                            e.target.value.slice(0, 32)
                                                        )
                                                    }
                                                    placeholder={
                                                        def?.critical !== undefined
                                                            ? String(def.critical)
                                                            : 'none'
                                                    }
                                                    title="Value at which the headline flips to the critical colour. Leave blank to disable the critical band."
                                                    className={cn(
                                                        'w-full px-2 py-1 text-[11px] rounded border focus:outline-none focus:ring-2 focus:ring-sky-400 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-100',
                                                        criticalInputValid
                                                            ? 'border-slate-200 dark:border-slate-700'
                                                            : 'border-red-400 dark:border-red-600'
                                                    )}
                                                />
                                                <p className="mt-0.5 text-[9px] text-slate-400 dark:text-slate-500">
                                                    {def?.critical !== undefined
                                                        ? `default: ${formatThresholdNumber(def.critical, context.thresholdUnit)}`
                                                        : 'no shipped default'}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Sanity-check hint — non-blocking.
                                            Some operators intentionally
                                            invert the bands to suppress a
                                            colour, so we surface the issue
                                            but don't gate Apply on it. */}
                                        {thresholdRelationshipWarning && (
                                            <p className="text-[10px] text-amber-600 dark:text-amber-400">
                                                ⚠ {thresholdRelationshipWarning}
                                            </p>
                                        )}

                                        {/* Live preview — same words and
                                            ranges the per-tile info popover
                                            will render after Apply, because
                                            both call `deriveThresholdLines`
                                            with the same `MetricThresholds`
                                            tuple. */}
                                        {previewLines && previewLines.length > 0 && (
                                            <div className="rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2 py-1.5">
                                                <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">
                                                    Preview
                                                </p>
                                                <ul className="space-y-0.5">
                                                    {previewLines.map((row) => (
                                                        <li
                                                            key={row.tone}
                                                            className="flex items-center gap-2 text-[10px]"
                                                        >
                                                            <span
                                                                className={cn(
                                                                    'inline-block w-1.5 h-1.5 rounded-full flex-shrink-0',
                                                                    row.tone === 'healthy' &&
                                                                        'bg-emerald-500',
                                                                    row.tone === 'warning' &&
                                                                        'bg-amber-500',
                                                                    row.tone === 'critical' &&
                                                                        'bg-red-500'
                                                                )}
                                                            />
                                                            <span className="font-bold text-slate-700 dark:text-slate-200">
                                                                {row.label}
                                                            </span>
                                                            <span className="font-mono text-slate-500 dark:text-slate-400">
                                                                {row.value}
                                                            </span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        {/* No-thresholds message — both
                                            inputs blank with no shipped
                                            defaults. The form is still usable
                                            (user can establish thresholds
                                            from scratch if they swap the
                                            tile to a numeric search), but we
                                            tell them what the runtime
                                            behaviour will be. */}
                                        {!previewLines && (
                                            <p className="text-[10px] text-slate-500 dark:text-slate-400 italic">
                                                No thresholds set — the headline will render in the
                                                neutral colour with no status icon.
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 italic">
                            Pick a search above to preview SPL and apply.
                        </p>
                    )}
                </div>

                {/* Footer: actions */}
                <div className="border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 px-3 py-2.5 flex-shrink-0">
                    <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                        <button
                            type="button"
                            onClick={handleResetThisTile}
                            title="Restore this tile to its default saved search"
                            className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 flex-shrink-0"
                        >
                            <RotateCcw className="w-3 h-3" />
                            Reset tile
                        </button>
                        {onResetAllCustomizations && (
                            <>
                                {/* Visual divider between the two
                                    "Reset" actions so the
                                    destructive one stands apart. */}
                                <span
                                    aria-hidden="true"
                                    className="w-px h-3 bg-slate-200 dark:bg-slate-700 flex-shrink-0"
                                />
                                <button
                                    type="button"
                                    onClick={handleResetAllCustomizations}
                                    // Red text + the literal phrase
                                    // "factory default" to telegraph
                                    // "this is bigger than 'Reset
                                    // tile'". A confirm() prompt
                                    // catches misclicks before
                                    // anything is wiped.
                                    title="Wipe tile, layout, and map customisations; keep header branding"
                                    className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 flex-shrink-0"
                                >
                                    <RotateCcw className="w-3 h-3" />
                                    Factory reset
                                </button>
                            </>
                        )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleApply}
                            disabled={!canApply}
                            className={cn(
                                'px-3 py-1 text-[11px] font-black uppercase tracking-wider rounded transition-colors',
                                canApply
                                    ? 'bg-sky-500 hover:bg-sky-600 text-white'
                                    : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                            )}
                        >
                            Apply
                        </button>
                    </div>
                </div>
            </aside>
        </>
    );
};

export default KpiPickerPanel;
