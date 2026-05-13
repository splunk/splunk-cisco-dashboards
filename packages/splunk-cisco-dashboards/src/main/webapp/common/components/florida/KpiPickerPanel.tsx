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
 * The bottom panel surfaces the picked entry's category/tag badges
 * and a description summary up-front, with the SPL block collapsed
 * by default. "Test in Search" is always one click away; the SPL
 * itself opens on demand so the search list above keeps room to
 * breathe.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ChevronRight,
    ExternalLink,
    Loader2,
    Play,
    RotateCcw,
    Search,
    Settings2,
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
import { VizIcon, resolveVizMapping } from './vizIcons';

// "All" sentinel for the facet dropdowns — using a sentinel rather
// than '' keeps the <select> element rendering predictable.
const ALL_CATEGORIES = '__all__';
const ALL_SUB_CATEGORIES = '__all_sub__';
const ALL_DISPATCH_CONTEXTS = '__all_dispatch__';

// Default dispatch-context for the picker. The catalogue REST endpoint
// pulls from any app namespace (`/servicesNS/-/<app>/configs/conf-searchbase`),
// so on a Splunk stack with multiple apps that ship their own
// `searchbase.conf` the catalogue can grow beyond what this app vetted.
// To keep the picker scoped to dashboard-pack searches by default, the
// Dispatch facet starts at this value and only shows entries whose
// `dispatch_context` matches it. Users can switch to "All dispatch
// contexts" or pick a specific other app from the same dropdown to
// browse wider — same UX as the Category facet.
//
// Every stanza shipped in this app's `default/searchbase.conf` carries
// `dispatch_context = splunk-cisco-dashboards` (with
// `dispatch_context_force = 1`), so this default passes the full
// 530-entry catalogue.
//
// Replaces the previous hardcoded Cisco-tag gate (Build 87 dropped the
// `Cisco` noise tag from every stanza, which silently collapsed the
// picker to zero results until Build 91 swapped to a dispatch-context
// constant; Build 92 promoted the constant to a real user-facing facet
// because operators couldn't see why the catalogue was scoped).
const DEFAULT_DISPATCH_CONTEXT = 'splunk-cisco-dashboards';

const MAX_FIELD_LENGTH = 64;
const FIELD_NAME_PATTERN = /^[A-Za-z_][\w.]{0,63}$/;
const TAG_CHIP_LIMIT = 24;

const SPL_COMMANDS = new Set([
    'append',
    'appendcols',
    'bin',
    'chart',
    'dedup',
    'eval',
    'eventstats',
    'fields',
    'filldown',
    'fillnull',
    'head',
    'inputlookup',
    'join',
    'lookup',
    'makeresults',
    'makemv',
    'mvexpand',
    'predict',
    'rename',
    'rex',
    'search',
    'sort',
    'spath',
    'stats',
    'streamstats',
    'table',
    'tail',
    'timechart',
    'tstats',
    'union',
    'where',
]);

const SPL_KEYWORDS = new Set([
    'and',
    'as',
    'by',
    'case',
    'coalesce',
    'earliest',
    'false',
    'if',
    'in',
    'isnotnull',
    'isnull',
    'latest',
    'like',
    'lower',
    'match',
    'max',
    'min',
    'not',
    'null',
    'or',
    'round',
    'sum',
    'tonumber',
    'tostring',
    'true',
    'values',
]);

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
    /** Saved-search names already bound to other tiles — for "in use" hints. */
    usedSavedSearches?: Set<string>;
}

export interface KpiPickerPanelProps {
    open: boolean;
    context: KpiPickerContext | null;
    onClose: () => void;
    onApply: (tileId: string, override: MetricOverride) => void;
    onClearOverride: (tileId: string) => void;
    /**
     * Optional "Open in Splunk Search" handler. When provided, the SPL
     * preview becomes clickable and a small "Test in Search" button
     * sits next to it. The handler receives the *literal* SPL from
     * `searchbase.conf` (the `search` field), not a saved-search
     * reference — that way the executive sees and tweaks exactly what
     * the picker is showing them, and can compare against the
     * dispatched saved-search separately if they want to.
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

const renderSplBlock = (spl: string): React.ReactNode => {
    const lines = spl.split('\n');
    return lines.map((line, lineIndex) => (
        <React.Fragment key={`spl-line-${lineIndex}`}>
            {renderSplLine(line, lineIndex)}
            {lineIndex < lines.length - 1 ? '\n' : null}
        </React.Fragment>
    ));
};

const renderSplLine = (line: string, lineIndex: number): React.ReactNode[] => {
    const pattern =
        /(`[^`]*`|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\|\s*[A-Za-z_][A-Za-z0-9_]*|\b\d+(?:\.\d+)?\b|\b[A-Za-z_][A-Za-z0-9_.:{}-]*\b)/g;
    const parts = line.split(pattern);

    return parts.map((part, partIndex) => {
        if (!part) return null;

        const key = `spl-${lineIndex}-${partIndex}`;

        if (part.startsWith('`') && part.endsWith('`')) {
            return (
                <span key={key} className="text-amber-700 dark:text-amber-300">
                    {part}
                </span>
            );
        }

        if (
            (part.startsWith('"') && part.endsWith('"')) ||
            (part.startsWith("'") && part.endsWith("'"))
        ) {
            return (
                <span key={key} className="text-emerald-700 dark:text-emerald-300">
                    {part}
                </span>
            );
        }

        if (part.startsWith('|')) {
            const command = part.slice(1).trim();
            return (
                <React.Fragment key={key}>
                    <span className="text-sky-700 dark:text-sky-400">|</span>
                    {command ? (
                        <>
                            {' '}
                            <span className="text-violet-700 dark:text-violet-300">
                                {command}
                            </span>
                        </>
                    ) : null}
                </React.Fragment>
            );
        }

        if (/^\d+(?:\.\d+)?$/.test(part)) {
            return (
                <span key={key} className="text-orange-700 dark:text-orange-300">
                    {part}
                </span>
            );
        }

        const normalized = part.toLowerCase();
        if (SPL_COMMANDS.has(normalized)) {
            return (
                <span key={key} className="text-violet-700 dark:text-violet-300">
                    {part}
                </span>
            );
        }

        if (SPL_KEYWORDS.has(normalized)) {
            return (
                <span key={key} className="text-sky-700 dark:text-sky-300">
                    {part}
                </span>
            );
        }

        if (part.includes('=') || part.includes('.')) {
            return (
                <span key={key} className="text-slate-700 dark:text-slate-200">
                    {part}
                </span>
            );
        }

        return (
            <span key={key} className="text-slate-900 dark:text-slate-100">
                {part}
            </span>
        );
    });
};

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

const entryIsUsed = (entry: SearchbaseRecord, used: Set<string> | undefined): boolean => {
    if (!used) return false;
    return used.has(entry.id) || used.has(entry.searchName);
};

const labelFromSearchName = (searchName: string): string => {
    const parts = searchName.split(/\s+[–—-]\s+/).map((part) => part.trim());
    return (parts[parts.length - 1] || searchName).slice(0, 80);
};

export const KpiPickerPanel: React.FC<KpiPickerPanelProps> = ({
    open,
    context,
    onClose,
    onApply,
    onClearOverride,
    onTestInSearch,
    onResetAllCustomizations,
}) => {
    const [catalogue, setCatalogue] = useState<SearchbaseRecord[]>([]);
    const [loadState, setLoadState] = useState<'idle' | 'loading' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState<string>('');
    const [query, setQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>(ALL_CATEGORIES);
    const [selectedSubCategory, setSelectedSubCategory] = useState<string>(ALL_SUB_CATEGORIES);
    // Dispatch-context facet — defaults to this app's namespace so the
    // picker stays scoped to dashboard-pack searches at first open.
    // Switch to ALL_DISPATCH_CONTEXTS or another app's namespace via
    // the dropdown to browse wider.
    const [selectedDispatchContext, setSelectedDispatchContext] = useState<string>(
        DEFAULT_DISPATCH_CONTEXT
    );
    const [activeTags, setActiveTags] = useState<Set<string>>(() => new Set());
    // Free-text input that powers the tag multi-select dropdown. As
    // the user types, the dropdown narrows to substring matches and
    // lifts its top-N cap so any of the ~260 catalogue tags is
    // reachable in two keystrokes. Independent of the main `query`
    // so the result list isn't polluted while hunting for a tag.
    const [tagFilter, setTagFilter] = useState('');
    const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [valueField, setValueField] = useState('');
    const [labelOverride, setLabelOverride] = useState('');
    // SPL block is hidden by default — most pickers don't need to
    // re-read the SPL each time, and the block ate ~150px of vertical
    // real-estate. Reset when the user picks a different entry.
    const [showSpl, setShowSpl] = useState(false);
    const searchInputRef = useRef<HTMLInputElement | null>(null);
    const tagSelectRef = useRef<HTMLDivElement | null>(null);
    const tagInputRef = useRef<HTMLInputElement | null>(null);

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
        getSearchbaseCatalogue()
            .then((list) => {
                if (cancelled) return;
                const sorted = sortAlphabetical(list);
                // Cache-staleness check operates on the full catalogue,
                // not a dispatch-filtered slice — that way a binding
                // pointed at another app's stanza still resolves and
                // the "Currently bound" banner can render once the
                // user widens the Dispatch facet.
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
                getSearchbaseCatalogue().then(applyList).catch(handleError);
            })
            .catch(handleError);

        return () => {
            cancelled = true;
        };
        // `context?.currentSavedSearch` participates so re-opening the
        // picker for a different tile re-evaluates whether its bound
        // search is in the cache.
    }, [open, context?.currentSavedSearch]);

    // Reset transient form state when the panel opens for a new tile.
    // Sub-category and tag selections start cleared every time so the
    // user always sees the full slice of the chosen category. Dispatch
    // context resets to the dashboard-pack default so each new picker
    // open is scoped to vetted searches by default.
    useEffect(() => {
        if (!open || !context) return;
        setQuery('');
        setSelectedCategory(ALL_CATEGORIES);
        setSelectedSubCategory(ALL_SUB_CATEGORIES);
        setSelectedDispatchContext(DEFAULT_DISPATCH_CONTEXT);
        setActiveTags(new Set());
        setTagFilter('');
        setTagDropdownOpen(false);
        setShowSpl(false);
        // Highlight the row whose `search_name` matches the tile's
        // currently-bound saved search (if it's in the catalogue).
        const initial = context.currentSavedSearch ?? null;
        setSelectedId(initial);
        setValueField(context.currentValueField ?? '');
        setLabelOverride(context.currentLabel ?? '');
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

    // When the dispatch context changes, reset the downstream facets.
    // Picking a different app namespace surfaces a different category
    // / sub-category / tag vocabulary, so carrying old selections over
    // would silently filter the new slice down to nothing. Same idea
    // as the cascade above for category → sub-category.
    useEffect(() => {
        setSelectedCategory(ALL_CATEGORIES);
        setSelectedSubCategory(ALL_SUB_CATEGORIES);
        setActiveTags(new Set());
    }, [selectedDispatchContext]);

    // Different selection -> collapse SPL. The user explicitly opens
    // it for the entry they care about; carrying the open state across
    // selections shows the wrong SPL for a beat while the new content
    // renders, which feels broken.
    //
    // Same effect also drops the prefilled `valueField` whenever the
    // user picks a search that isn't the tile's current binding.
    // Carrying the field across a search swap was the root cause of
    // headlines remaining stale after a picker change: the new SPL
    // emits e.g. `pct` but the input still said `blocked`, so the
    // metric hook read undefined and silently fell back to mock.
    // Clearing tells `applyOverride` to leave `valueField` undefined,
    // which lets `useMetric` auto-detect the column from live rows.
    useEffect(() => {
        setShowSpl(false);
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

    // Distinct, sorted category list — drives the Category dropdown.
    // Scoped to the active dispatch context so picking a single app
    // narrows the Category dropdown to that app's category vocabulary.
    const categories = useMemo(() => {
        const set = new Set<string>();
        for (const e of catalogue) {
            if (
                selectedDispatchContext !== ALL_DISPATCH_CONTEXTS &&
                e.dispatchContext !== selectedDispatchContext
            ) {
                continue;
            }
            if (e.category) set.add(e.category);
        }
        return Array.from(set).sort((a, b) =>
            a.localeCompare(b, undefined, { sensitivity: 'base' })
        );
    }, [catalogue, selectedDispatchContext]);

    // Sub-categories scoped to the current category and dispatch
    // context. Empty array when no category is picked — that hides
    // the dropdown.
    const subCategories = useMemo(() => {
        if (selectedCategory === ALL_CATEGORIES) return [];
        const set = new Set<string>();
        for (const e of catalogue) {
            if (
                selectedDispatchContext !== ALL_DISPATCH_CONTEXTS &&
                e.dispatchContext !== selectedDispatchContext
            ) {
                continue;
            }
            if (e.category !== selectedCategory) continue;
            if (e.subCategory) set.add(e.subCategory);
        }
        return Array.from(set).sort((a, b) =>
            a.localeCompare(b, undefined, { sensitivity: 'base' })
        );
    }, [catalogue, selectedDispatchContext, selectedCategory]);

    // Distinct dispatch_context values present in the catalogue. Used
    // to populate the Dispatch facet dropdown. Sorted alphabetically
    // so the order is stable across loads.
    const dispatchContexts = useMemo(() => {
        const set = new Set<string>();
        for (const e of catalogue) {
            if (e.dispatchContext) set.add(e.dispatchContext);
        }
        return Array.from(set).sort((a, b) =>
            a.localeCompare(b, undefined, { sensitivity: 'base' })
        );
    }, [catalogue]);

    // Tag counts are scoped to the current result slice, including
    // already-selected tags. This makes the tag picker progressive:
    // after choosing one tag, the dropdown shows only tags that still
    // co-occur in the narrowed results rather than the full catalogue.
    const tagFacetEntries = useMemo(() => {
        return catalogue.filter((entry) => {
            if (
                selectedDispatchContext !== ALL_DISPATCH_CONTEXTS &&
                entry.dispatchContext !== selectedDispatchContext
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
    }, [catalogue, query, selectedDispatchContext, selectedCategory, selectedSubCategory, activeTags]);

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

    const filtered = useMemo(() => {
        return catalogue.filter((entry) => {
            if (
                selectedDispatchContext !== ALL_DISPATCH_CONTEXTS &&
                entry.dispatchContext !== selectedDispatchContext
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
                // AND across selected tags so executives can compose
                // narrower filters (e.g. Network + Catalyst_Center).
                for (const t of activeTags) {
                    if (!entry.tags.includes(t)) return false;
                }
            }
            return matchesQuery(entry, query);
        });
    }, [catalogue, query, selectedDispatchContext, selectedCategory, selectedSubCategory, activeTags]);

    const selectedEntry = useMemo(
        () =>
            selectedId
                ? catalogue.find((e) => entryMatchesKey(e, selectedId)) ?? null
                : null,
        [catalogue, selectedId]
    );
    const selectedDescriptionPlain = useMemo(
        () => (selectedEntry ? plainTextFromHtml(selectedEntry.description) : ''),
        [selectedEntry]
    );

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

    const fieldNameValid = valueField === '' || FIELD_NAME_PATTERN.test(valueField);
    const labelValid = labelOverride === '' || labelOverride.trim().length <= 80;
    const canApply = Boolean(selectedEntry && fieldNameValid && labelValid);

    const facetsActive =
        selectedDispatchContext !== DEFAULT_DISPATCH_CONTEXT ||
        selectedCategory !== ALL_CATEGORIES ||
        selectedSubCategory !== ALL_SUB_CATEGORIES ||
        activeTags.size > 0 ||
        tagFilter.trim().length > 0;

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
        onApply(context.tileId, payload);
    };

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
                '  • The visible tile count in each section\n' +
                '  • The order of tiles within each section\n' +
                '  • The map topology (sites, links, names, positions)\n' +
                '  • The map ↔ tiles splitter position\n\n' +
                'Your light/dark theme preference will be kept.\n\n' +
                'This action cannot be undone.'
        );
        if (!ok) return;
        onResetAllCustomizations();
    };

    const handleClearFacets = () => {
        setSelectedDispatchContext(DEFAULT_DISPATCH_CONTEXT);
        setSelectedCategory(ALL_CATEGORIES);
        setSelectedSubCategory(ALL_SUB_CATEGORIES);
        setActiveTags(new Set());
        setTagFilter('');
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

                    {/* Dispatch-context facet — defaults to this app's
                        namespace so the picker stays scoped to the
                        dashboard pack. Switch to "All dispatch
                        contexts" or another app's namespace to widen.
                        Always renders so operators can see which scope
                        they're browsing — even when only one context
                        is present in the catalogue. */}
                    <div className="flex items-center gap-2">
                        <span
                            className="text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 flex-shrink-0 w-16"
                            title="Dispatch context (Splunk app namespace) the search is registered against"
                        >
                            Dispatch
                        </span>
                        <select
                            value={selectedDispatchContext}
                            onChange={(e) => setSelectedDispatchContext(e.target.value)}
                            className="flex-1 px-2 py-1 text-[11px] rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400"
                        >
                            <option value={ALL_DISPATCH_CONTEXTS}>
                                All dispatch contexts ({dispatchContexts.length})
                            </option>
                            {dispatchContexts.map((dc) => (
                                <option key={dc} value={dc}>
                                    {dc}
                                </option>
                            ))}
                            {/* Keep the default visible even when the
                                catalogue hasn't loaded yet (initial
                                paint, error states) so the dropdown
                                never collapses to "All" with the
                                default value silently lost. */}
                            {!dispatchContexts.includes(DEFAULT_DISPATCH_CONTEXT) && (
                                <option value={DEFAULT_DISPATCH_CONTEXT}>
                                    {DEFAULT_DISPATCH_CONTEXT}
                                </option>
                            )}
                        </select>
                    </div>

                    {categories.length > 1 && (
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 flex-shrink-0 w-16">
                                Category
                            </span>
                            <select
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                className="flex-1 px-2 py-1 text-[11px] rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400"
                            >
                                <option value={ALL_CATEGORIES}>All categories</option>
                                {categories.map((c) => (
                                    <option key={c} value={c}>
                                        {c}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Sub-category facet — only renders when a category
                        is picked AND that category has multiple
                        sub-categories. Otherwise the dropdown would be
                        a one-option no-op. */}
                    {selectedCategory !== ALL_CATEGORIES && subCategories.length > 0 && (
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 flex-shrink-0 w-16">
                                Sub-cat
                            </span>
                            <select
                                value={selectedSubCategory}
                                onChange={(e) => setSelectedSubCategory(e.target.value)}
                                className="flex-1 px-2 py-1 text-[11px] rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400"
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
                        </div>
                    )}

                    {facetsActive && (
                        <div className="flex justify-end">
                            <button
                                type="button"
                                onClick={handleClearFacets}
                                title="Clear all facet filters"
                                className="text-[9px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200"
                            >
                                Clear filters
                            </button>
                        </div>
                    )}

                    {/* Tag multi-select — compact token input. Click to
                        open the dropdown of available tags (top-N by
                        frequency, lifted when typing). Selected tags
                        become AND-combined pills inside the field. */}
                    {(allTagsWithCounts.length > 0 || activeTags.size > 0) && (
                        <div className="relative" ref={tagSelectRef}>
                            <div
                                onClick={() => {
                                    setTagDropdownOpen(true);
                                    tagInputRef.current?.focus();
                                }}
                                className={cn(
                                    'flex flex-wrap items-center gap-1 px-1.5 py-1 rounded-md border bg-white dark:bg-slate-800 cursor-text transition-shadow',
                                    tagDropdownOpen
                                        ? 'border-sky-400 ring-2 ring-sky-400/40'
                                        : 'border-slate-200 dark:border-slate-700'
                                )}
                            >
                                <Tag className="w-3 h-3 text-slate-400 flex-shrink-0 ml-0.5" />
                                {Array.from(activeTags).map((tag) => {
                                    const count = tagCountByName.get(tag) ?? 0;
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
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    removeTag(tag);
                                                }}
                                                title={`Remove ${tag} filter`}
                                                aria-label={`Remove ${tag} filter`}
                                                className="p-0.5 rounded-full hover:bg-sky-700/40"
                                            >
                                                <X className="w-2 h-2" />
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
                                            ? `Filter by tag (${allTagsWithCounts.length} available, AND combined)…`
                                            : 'Add tag…'
                                    }
                                    maxLength={64}
                                    aria-label="Filter results by tag"
                                    className="flex-1 min-w-[80px] bg-transparent border-0 outline-none text-[11px] text-slate-700 dark:text-slate-100 placeholder:text-slate-400 py-0.5"
                                />
                            </div>

                            {tagDropdownOpen && (
                                <div
                                    role="listbox"
                                    aria-label="Available tags"
                                    className="absolute left-0 right-0 top-full mt-1 z-20 max-h-56 overflow-auto rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl"
                                >
                                    {tagDropdownOptions.length === 0 ? (
                                        <p className="px-2 py-2 text-[10px] italic text-slate-400 dark:text-slate-500">
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
                                                    idx === 0 && Boolean(tagFilter.trim());
                                                return (
                                                    <button
                                                        key={tag}
                                                        type="button"
                                                        role="option"
                                                        aria-selected={isFirstTyped}
                                                        onClick={() => addTag(tag)}
                                                        title={`${count} search${count === 1 ? '' : 'es'} tagged ${tag}`}
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
                                                                {tagFilter.trim()
                                                                    ? highlightMatch(tag, tagFilter)
                                                                    : tag}
                                                            </span>
                                                        </span>
                                                        <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 flex-shrink-0">
                                                            {count}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                            {!tagFilter.trim() &&
                                                allTagsWithCounts.length - activeTags.size >
                                                    tagDropdownOptions.length && (
                                                    <p className="px-2 py-1 text-[9px] text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800">
                                                        Top {tagDropdownOptions.length} of{' '}
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
                    )}
                </div>

                {/* Currently-bound banner — sits above the result list
                    so the user can always see *which* search is wired
                    up right now and jump to it with one click. Hidden
                    when the bound search isn't in the catalogue (e.g.
                    a non-searchbase saved search), or when the user
                    has already filtered/selected their way to it. */}
                {currentBoundEntry && (
                    <div className="px-3 py-2 mx-2 mb-1 rounded-md border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 flex items-center gap-2 flex-shrink-0">
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500 text-white text-[8px] font-black flex-shrink-0">
                            ✓
                        </span>
                        <div className="flex-1 min-w-0">
                            <p className="text-[8px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400 leading-none">
                                Currently bound
                            </p>
                            <p
                                className="text-[11px] font-bold text-slate-800 dark:text-slate-100 truncate"
                                title={currentBoundEntry.searchName}
                            >
                                {currentBoundEntry.searchName}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={jumpToCurrent}
                            title="Scroll the list to the currently bound search and select it"
                            className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest rounded text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border border-emerald-300 dark:border-emerald-800 transition-colors flex-shrink-0"
                        >
                            Jump to
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
                                            <div className="flex items-baseline gap-2 flex-wrap">
                                                <span className="text-[11px] font-bold text-slate-800 dark:text-slate-100 break-all select-text cursor-text">
                                                    {highlightMatch(entry.searchName, query)}
                                                </span>
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
                                                </div>
                                            )}
                                            {plainDesc && (
                                                <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2">
                                                    {highlightMatch(plainDesc, query)}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                </div>

                {/* Selection preview + form */}
                <div className="border-t border-slate-200 dark:border-slate-800 flex-shrink-0 px-4 py-3 space-y-2.5 max-h-[42%] overflow-auto">
                    {selectedEntry ? (
                        <>
                            <div>
                                <div className="flex items-center justify-between gap-2 mb-1">
                                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                                        Search name
                                    </p>
                                    {/* Right-aligned viz hint + label.
                                        Same icon vocabulary the row list uses, but
                                        with a written label here so the user gets
                                        an unambiguous "yes, this is what you'll
                                        see when you Apply" confirmation. */}
                                    <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
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
                            </div>

                            {(selectedEntry.category || selectedEntry.tags.length > 0) && (
                                <div className="flex flex-wrap items-center gap-1">
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
                                </div>
                            )}

                            <div>
                                {/* Header row: "Show SPL" toggle (collapsed by
                                    default; the SPL block ate ~150px of
                                    vertical real-estate the user rarely needed
                                    to re-read) + always-visible "Test in
                                    Search" launcher. Both reference the
                                    *literal* SPL from searchbase.conf. */}
                                <div className="flex items-center justify-between gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowSpl((p) => !p)}
                                        aria-expanded={showSpl}
                                        aria-controls="kpi-picker-spl-block"
                                        title={
                                            showSpl
                                                ? 'Hide the SPL preview'
                                                : 'Show the literal SPL from searchbase.conf'
                                        }
                                        className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-400 rounded px-1 py-0.5"
                                    >
                                        <ChevronRight
                                            className={cn(
                                                'w-2.5 h-2.5 transition-transform',
                                                showSpl && 'rotate-90'
                                            )}
                                        />
                                        {showSpl ? 'Hide SPL' : 'Show SPL'}
                                        {!showSpl && selectedEntry.search && (
                                            <span className="font-mono normal-case tracking-normal text-[10px] text-slate-400 dark:text-slate-500 truncate max-w-[180px] ml-1">
                                                · {selectedEntry.search.split(/\s+/).slice(0, 3).join(' ')}…
                                            </span>
                                        )}
                                    </button>
                                    {onTestInSearch && selectedEntry.search && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                onTestInSearch(selectedEntry.search)
                                            }
                                            title="Run this exact SPL in Splunk Search & Reporting (new tab)"
                                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest text-sky-600 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-900/30 border border-sky-200 dark:border-sky-800 transition-colors focus:outline-none focus:ring-1 focus:ring-sky-400"
                                        >
                                            <Play className="w-2.5 h-2.5" />
                                            Test in Search
                                            <ExternalLink className="w-2.5 h-2.5" />
                                        </button>
                                    )}
                                </div>

                                {showSpl &&
                                    (onTestInSearch && selectedEntry.search ? (
                                        <button
                                            id="kpi-picker-spl-block"
                                            type="button"
                                            onClick={() =>
                                                onTestInSearch(selectedEntry.search)
                                            }
                                            title="Click to run this SPL in Splunk Search & Reporting"
                                            className="mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-left transition-colors hover:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-sky-500"
                                        >
                                            <pre className="m-0 max-h-[20rem] overflow-auto rounded-md border border-slate-200 bg-white px-3 py-3 text-[12px] leading-6 whitespace-pre-wrap break-words text-slate-900 ring-1 ring-black/5 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:ring-white/5">
                                                {renderSplBlock(selectedEntry.search)}
                                            </pre>
                                        </button>
                                    ) : (
                                        <pre
                                            id="kpi-picker-spl-block"
                                            className="mt-1 max-h-[20rem] overflow-auto rounded-lg border border-slate-200 bg-white px-3 py-3 text-[12px] leading-6 whitespace-pre-wrap break-words text-slate-900 ring-1 ring-black/5 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:ring-white/5"
                                        >
                                            {selectedEntry.search
                                                ? renderSplBlock(selectedEntry.search)
                                                : '(searchbase.conf entry has no `search` value)'}
                                        </pre>
                                    ))}
                            </div>

                            {selectedDescriptionPlain && (
                                <div>
                                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">
                                        Description
                                    </p>
                                    <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-4">
                                        {selectedDescriptionPlain}
                                    </p>
                                </div>
                            )}

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
                        </>
                    ) : (
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 italic">
                            Pick a search above to preview SPL and apply.
                        </p>
                    )}
                </div>

                {/* Footer: actions */}
                <div className="border-t border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 py-2.5 flex-shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <button
                            type="button"
                            onClick={handleResetThisTile}
                            title="Restore this tile to its default saved search"
                            className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 flex-shrink-0"
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
                                    title="Wipe every dashboard customisation and start fresh"
                                    className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 flex-shrink-0"
                                >
                                    <RotateCcw className="w-3 h-3" />
                                    Factory reset
                                </button>
                            </>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
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
