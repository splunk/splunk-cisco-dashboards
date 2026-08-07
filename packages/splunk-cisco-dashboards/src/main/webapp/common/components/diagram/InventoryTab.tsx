/**
 * InventoryTab — filterable list of real devices from
 * `asset_inventory.csv`, draggable into the diagram canvas.
 *
 * This is the "ease-of-use plus mind-blowing graphics" half of
 * the Build 106 design: instead of asking the customer to type
 * device names by hand, the side panel shows their actual
 * fleet — pulled from the same lookup the rest of the app
 * already runs on — and lets them drag a row onto the canvas to
 * spawn a node bound to that real device id. From that point on,
 * health overlays, KPI tooltips, and click-to-investigate flows
 * all light up automatically because the node carries the live
 * `assetId`.
 *
 * Filter model (Build 115 — cascading dropdowns):
 *
 *   • Free-text search — matches device_name / shortLabel / site
 *     / device_type / model / serial, case-insensitive,
 *     AND-combined with the dropdowns below.
 *   • Three cascading multi-select dropdowns, evaluated in
 *     order:
 *       1. Management Source — the contributing system that
 *          owns the device (Catalyst Center, Meraki Dashboard,
 *          IOS Syslog, ASA/FTD Syslog, ISE NAD, F5 iControl,
 *          Windows/AD). The "Catalyst Center" pill the user
 *          asked for surfaces here, and selecting it filters
 *          the next two dropdowns to just devices with that
 *          provenance.
 *       2. Device Type — derived from `device_type` (Switch,
 *          Router, Firewall, AP, WLC, Load Balancer, Server,
 *          …). Auto-recomputed from the rows that pass the
 *          Management Source filter, so the option list
 *          stays accurate as you drill down.
 *       3. Model — `platform_id` from asset_inventory (e.g.
 *          `WS-C6504-E`, `9300-48UXM`, `BIG-IP i5800`). Same
 *          cascade rule: only models present in the
 *          source+type-filtered subset show up.
 *
 *   This mirrors the asset_inventory_v1 dashboard's filter
 *   approach (multi-select + auto-population) — operators
 *   already know how to drive it from there.
 *
 * The list is virtualised-by-cap rather than virtualised-by-
 * library: we cap the visible rows at 200 and show a "+N more,
 * filter to narrow" banner when the underlying set is larger.
 *
 * Drag protocol: each row sets the same `PALETTE_DND_MIME`
 * payload as the Shapes tab, with `variant: 'asset'` and the
 * resolved `assetId`, `shape`, `label`, `shortLabel`,
 * `siteLabel`. The canvas's drop handler reads this verbatim.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Search, X, Loader2, AlertCircle, Filter } from '@/common/icons/SuiIcon';
import { cn } from '@/common/lib/utils';
import { CISCO_ICONS } from '@/common/components/topology/ciscoIcons';
import {
    fetchAssetInventory,
    fetchSplunkInventory,
    type TopologyDiscoveredNode,
    type DeviceShapeId,
} from '@/common/services/topologyDiscovery';
import { PALETTE_DND_MIME, type PaletteDragPayload } from './types';

const MAX_VISIBLE_ROWS = 200;

/** Build 115.4 — unified inventory hook that loads BOTH the
 *  Cisco asset_inventory feed and the Splunk infrastructure
 *  feed in parallel. Each source is independent: a partial
 *  failure (e.g. splunk_inventory empty before the daily
 *  saved-search runs its first time) doesn't blank the panel,
 *  it just shows whatever loaded. The error string is set
 *  only when BOTH fail; that's the case operators actually
 *  want to know about. */
const useUnifiedInventory = (): {
    assets: TopologyDiscoveredNode[];
    error: string | null;
    isLoading: boolean;
    reload: () => void;
} => {
    const [assets, setAssets] = useState<TopologyDiscoveredNode[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [reloadKey, setReloadKey] = useState<number>(0);

    useEffect(() => {
        let cancelled = false;
        setIsLoading(true);
        setError(null);
        Promise.allSettled([fetchAssetInventory(), fetchSplunkInventory()])
            .then(([ciscoResult, splunkResult]) => {
                if (cancelled) return;
                const merged: TopologyDiscoveredNode[] = [];
                if (ciscoResult.status === 'fulfilled') merged.push(...ciscoResult.value);
                if (splunkResult.status === 'fulfilled') merged.push(...splunkResult.value);
                setAssets(merged);
                if (
                    ciscoResult.status === 'rejected' &&
                    splunkResult.status === 'rejected'
                ) {
                    const ciscoErr =
                        ciscoResult.reason instanceof Error
                            ? ciscoResult.reason.message
                            : 'asset_inventory failed';
                    const splunkErr =
                        splunkResult.reason instanceof Error
                            ? splunkResult.reason.message
                            : 'splunk_inventory failed';
                    setError(`Both inventories failed: ${ciscoErr}; ${splunkErr}`);
                }
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [reloadKey]);

    return { assets, error, isLoading, reload: () => setReloadKey((k) => k + 1) };
};

/** Build 115 — accessor that pulls a single facet value off an
 *  asset row in a normalised, fall-through way. We're matching
 *  asset_inventory.csv columns (lower_snake) but the live
 *  `TopologyDiscoveredNode` already exposes some of them as
 *  derived fields (`vendor`, `model`, `managementSource`). */
const facetAccessor = {
    managementSource: (r: TopologyDiscoveredNode): string | undefined =>
        r.managementSource,
    deviceType: (r: TopologyDiscoveredNode): string | undefined =>
        (r.raw['device_type'] as string | undefined) ??
        (r.raw['device_family'] as string | undefined),
    model: (r: TopologyDiscoveredNode): string | undefined =>
        r.model ??
        (r.raw['platform_id'] as string | undefined) ??
        (r.raw['device_series'] as string | undefined),
};

interface FacetCount {
    value: string;
    count: number;
}

/** Compute the unique values for a given accessor across a
 *  pre-filtered set of rows, preserving counts. Sorted by count
 *  descending so the most populated value rises to the top of
 *  any picker. */
const computeFacet = (
    rows: TopologyDiscoveredNode[],
    pick: (r: TopologyDiscoveredNode) => string | undefined
): FacetCount[] => {
    const counts = new Map<string, number>();
    for (const r of rows) {
        const v = (pick(r) ?? '').trim();
        if (!v) continue;
        counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    return Array.from(counts.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
};

/** Build 115.4 — top-level inventory source filter. The
 *  InventoryTab can pull from two feeds (Cisco asset_inventory
 *  and Splunk splunk_inventory); the chips at the top of the
 *  panel let operators pin themselves to one source quickly
 *  without wading through the cascading dropdowns. */
type ProvenanceFilter = 'all' | 'cisco' | 'splunk';

/** Cascading-aware filter. Each dropdown narrows the working set
 *  before the next dropdown's option list is computed, so an
 *  operator who picks "Catalyst Center" then opens "Device Type"
 *  sees only the types Catalyst Center actually contributes. */
const passes = (
    asset: TopologyDiscoveredNode,
    selected: {
        provenance: ProvenanceFilter;
        sources: Set<string>;
        types: Set<string>;
        models: Set<string>;
    }
): boolean => {
    if (selected.provenance !== 'all') {
        // Default `provenance` to 'cisco' for older rows that
        // predate the field — fetchAssetInventory now stamps it
        // explicitly, but a saved-payload-only row from before
        // 115.4 won't carry it. This matches the historical
        // behaviour of "all rows came from asset_inventory".
        const p = asset.provenance ?? 'cisco';
        if (p !== selected.provenance) return false;
    }
    if (selected.sources.size > 0) {
        const v = (facetAccessor.managementSource(asset) ?? '').trim();
        // "Catalyst Center, ISE NAD" rows pass when ANY listed
        // source is selected — provenance can be a comma list.
        const tokens = v
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
        if (!tokens.some((t) => selected.sources.has(t))) return false;
    }
    if (selected.types.size > 0) {
        const v = (facetAccessor.deviceType(asset) ?? '').trim();
        if (!selected.types.has(v)) return false;
    }
    if (selected.models.size > 0) {
        const v = (facetAccessor.model(asset) ?? '').trim();
        if (!selected.models.has(v)) return false;
    }
    return true;
};

const matchesQuery = (asset: TopologyDiscoveredNode, query: string): boolean => {
    if (query.trim().length === 0) return true;
    const q = query.trim().toLowerCase();
    if (asset.label.toLowerCase().includes(q)) return true;
    if (asset.shortLabel.toLowerCase().includes(q)) return true;
    if ((facetAccessor.deviceType(asset) ?? '').toLowerCase().includes(q))
        return true;
    if ((asset.siteLabel ?? '').toLowerCase().includes(q)) return true;
    if ((asset.model ?? '').toLowerCase().includes(q)) return true;
    if ((asset.serialNumber ?? '').toLowerCase().includes(q)) return true;
    return false;
};

const dragPayloadForAsset = (asset: TopologyDiscoveredNode): PaletteDragPayload => ({
    variant: 'asset',
    assetId: asset.id,
    shape: asset.shape as DeviceShapeId,
    label: asset.label,
    shortLabel: asset.shortLabel,
    siteLabel: asset.siteLabel,
});

const InventoryRow: React.FC<{ asset: TopologyDiscoveredNode }> = ({ asset }) => {
    const Icon = CISCO_ICONS[asset.shape] ?? CISCO_ICONS.generic;
    const handleDragStart = (e: React.DragEvent<HTMLDivElement>): void => {
        const payload = dragPayloadForAsset(asset);
        e.dataTransfer.setData(PALETTE_DND_MIME, JSON.stringify(payload));
        e.dataTransfer.setData('text/plain', asset.label);
        e.dataTransfer.effectAllowed = 'copy';
    };
    const deviceType = facetAccessor.deviceType(asset) ?? asset.shape;
    const model = facetAccessor.model(asset);
    return (
        <div
            draggable
            onDragStart={handleDragStart}
            role="button"
            tabIndex={0}
            aria-label={`Drag ${asset.label} to canvas`}
            title={`${asset.label}\n${deviceType}${
                model ? `\nModel: ${model}` : ''
            }${asset.siteLabel ? `\n${asset.siteLabel}` : ''}`}
            className={cn(
                'flex items-center gap-2 px-2 py-1.5 rounded-md cursor-grab active:cursor-grabbing select-none',
                'border border-transparent hover:border-sky-400 hover:bg-sky-50/60 dark:hover:bg-sky-950/30',
                'transition-colors duration-100'
            )}
        >
            {/* Build 112: dropped the `text-slate-*` colour override
                so each inventory row picks up its icon's per-class
                accent (router=amber, firewall=rose, etc.). */}
            <Icon className="w-6 h-6 flex-shrink-0" />
            <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
                    {asset.shortLabel}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 truncate uppercase tracking-wide">
                    {deviceType}
                    {model ? ` · ${model}` : ''}
                </div>
            </div>
        </div>
    );
};

/** Build 115 — multi-select dropdown with checklist-style
 *  options. Keeps the panel narrow (3 stacked dropdowns + search
 *  fits in ~280px) and stays accessible because each option is a
 *  proper `<button>` inside a popover. We don't hand-roll keyboard
 *  navigation — the existing canvas tab order is enough for the
 *  short option lists this dashboard surfaces. */
const FilterDropdown: React.FC<{
    label: string;
    options: FacetCount[];
    selected: Set<string>;
    onToggle: (value: string) => void;
    onClear: () => void;
    placeholder?: string;
}> = ({ label, options, selected, onToggle, onClear, placeholder }) => {
    const [open, setOpen] = useState(false);
    const summary =
        selected.size === 0
            ? (placeholder ?? `All ${label.toLowerCase()}s`)
            : selected.size === 1
              ? Array.from(selected)[0]
              : `${selected.size} selected`;
    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className={cn(
                    'w-full flex items-center justify-between gap-2 px-2 py-1 rounded-md text-xs',
                    'border bg-white dark:bg-slate-900',
                    'border-slate-200 dark:border-slate-700',
                    'hover:border-sky-400 dark:hover:border-sky-500',
                    selected.size > 0 &&
                        'border-sky-400 bg-sky-50/60 dark:bg-sky-950/40 dark:border-sky-500'
                )}
                aria-expanded={open}
            >
                <span className="flex items-center gap-1.5 min-w-0">
                    <Filter className="w-3 h-3 flex-shrink-0 text-slate-400" />
                    <span className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        {label}
                    </span>
                </span>
                <span className="truncate text-slate-700 dark:text-slate-200 flex-1 text-right">
                    {summary}
                </span>
            </button>
            {open && (
                <div
                    className={cn(
                        'absolute z-30 mt-1 left-0 right-0 max-h-64 overflow-y-auto',
                        'rounded-md border border-slate-200 dark:border-slate-700',
                        'bg-white dark:bg-slate-900 shadow-xl'
                    )}
                    onMouseLeave={() => setOpen(false)}
                >
                    {selected.size > 0 && (
                        <button
                            type="button"
                            onClick={() => {
                                onClear();
                            }}
                            className="w-full flex items-center justify-between gap-2 px-2 py-1 text-xs text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/40 border-b border-slate-200 dark:border-slate-700"
                        >
                            Clear all
                            <X className="w-2.5 h-2.5" />
                        </button>
                    )}
                    {options.length === 0 ? (
                        <div className="px-2 py-2 text-xs text-slate-400 italic">
                            No values in the current set.
                        </div>
                    ) : (
                        options.map((opt) => {
                            const active = selected.has(opt.value);
                            return (
                                <button
                                    type="button"
                                    key={opt.value}
                                    onClick={() => onToggle(opt.value)}
                                    className={cn(
                                        'w-full flex items-center justify-between gap-2 px-2 py-1 text-xs',
                                        active
                                            ? 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300'
                                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                                    )}
                                >
                                    <span className="flex items-center gap-1.5 min-w-0">
                                        <span
                                            className={cn(
                                                'w-3 h-3 flex-shrink-0 rounded-sm border',
                                                active
                                                    ? 'bg-sky-500 border-sky-600'
                                                    : 'border-slate-300 dark:border-slate-600'
                                            )}
                                        />
                                        <span className="truncate">
                                            {opt.value}
                                        </span>
                                    </span>
                                    <span className="text-xs font-mono text-slate-400 flex-shrink-0">
                                        {opt.count}
                                    </span>
                                </button>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
};

/** Build 115.4 — segmented control for the inventory source.
 *  Renders three pills (All / Cisco / Splunk) with live counts.
 *  A pill with zero matches stays in the row but is disabled
 *  (greyed text + cursor-not-allowed) so the available sources
 *  remain obvious even before the Splunk daily discovery search
 *  has populated splunk_inventory.csv. We don't hide empty pills
 *  to keep the chip-row layout stable across page loads. */
const ProvenanceChips: React.FC<{
    value: ProvenanceFilter;
    counts: { all: number; cisco: number; splunk: number };
    onChange: (next: ProvenanceFilter) => void;
}> = ({ value, counts, onChange }) => {
    const items: Array<{
        id: ProvenanceFilter;
        label: string;
        count: number;
    }> = [
        { id: 'all', label: 'All', count: counts.all },
        { id: 'cisco', label: 'Cisco', count: counts.cisco },
        { id: 'splunk', label: 'Splunk', count: counts.splunk },
    ];
    return (
        <div
            role="tablist"
            aria-label="Inventory source filter"
            className="flex items-center gap-1 p-0.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
        >
            {items.map((it) => {
                const active = value === it.id;
                const empty = it.id !== 'all' && it.count === 0;
                return (
                    <button
                        key={it.id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        disabled={empty}
                        onClick={() => onChange(it.id)}
                        className={cn(
                            'flex-1 px-2 py-1 rounded-[5px] text-xs font-medium uppercase tracking-wider transition-colors',
                            'flex items-center justify-center gap-1.5',
                            active
                                ? 'bg-white dark:bg-slate-800 text-sky-700 dark:text-sky-300 shadow-sm border border-sky-200 dark:border-sky-700'
                                : empty
                                  ? 'text-slate-400 dark:text-slate-600 cursor-not-allowed'
                                  : 'text-slate-600 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-slate-800/60'
                        )}
                    >
                        <span>{it.label}</span>
                        <span
                            className={cn(
                                'text-xs font-mono',
                                active
                                    ? 'text-sky-500 dark:text-sky-400'
                                    : 'text-slate-400 dark:text-slate-500'
                            )}
                        >
                            {it.count}
                        </span>
                    </button>
                );
            })}
        </div>
    );
};

export const InventoryTab: React.FC = () => {
    const { assets, error, isLoading, reload } = useUnifiedInventory();
    const [query, setQuery] = useState<string>('');
    const [provenanceFilter, setProvenanceFilter] = useState<ProvenanceFilter>('all');
    const [sourceFilter, setSourceFilter] = useState<Set<string>>(new Set());
    const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set());
    const [modelFilter, setModelFilter] = useState<Set<string>>(new Set());

    /* ─────────  Provenance counts (Build 115.4)  ─────────
     *
     * Counts are computed against the full set so an operator
     * can see "231 Cisco · 42 Splunk" at a glance, regardless
     * of any active filter chips. Chips with a count of 0 stay
     * in the row but render disabled so the available sources
     * are obvious without flickering layout when one feed is
     * empty (very common before the daily Splunk discovery
     * saved-search runs its first time).
     */
    const provenanceCounts = useMemo(() => {
        let cisco = 0;
        let splunk = 0;
        for (const a of assets) {
            const p = a.provenance ?? 'cisco';
            if (p === 'cisco') cisco += 1;
            else if (p === 'splunk') splunk += 1;
        }
        return { all: assets.length, cisco, splunk };
    }, [assets]);

    /* ─────────  Cascading facet computation  ───────── */

    // After provenance filter: working set we drive sources from.
    const afterProvenance = useMemo(
        () =>
            provenanceFilter === 'all'
                ? assets
                : assets.filter(
                      (a) => (a.provenance ?? 'cisco') === provenanceFilter
                  ),
        [assets, provenanceFilter]
    );

    // Source facet: shows sources from the provenance-filtered set.
    const sourceFacets = useMemo(
        () => computeFacet(afterProvenance, facetAccessor.managementSource),
        [afterProvenance]
    );

    // After source filter: working set we drive types from.
    const afterSource = useMemo(
        () =>
            assets.filter((a) =>
                passes(a, {
                    provenance: provenanceFilter,
                    sources: sourceFilter,
                    types: new Set(),
                    models: new Set(),
                })
            ),
        [assets, provenanceFilter, sourceFilter]
    );

    const typeFacets = useMemo(
        () => computeFacet(afterSource, facetAccessor.deviceType),
        [afterSource]
    );

    // After source + type: working set we drive models from.
    const afterSourceAndType = useMemo(
        () =>
            assets.filter((a) =>
                passes(a, {
                    provenance: provenanceFilter,
                    sources: sourceFilter,
                    types: typeFilter,
                    models: new Set(),
                })
            ),
        [assets, provenanceFilter, sourceFilter, typeFilter]
    );

    const modelFacets = useMemo(
        () => computeFacet(afterSourceAndType, facetAccessor.model),
        [afterSourceAndType]
    );

    /* ─────────  Final filtered list  ───────── */

    const filtered = useMemo(
        () =>
            assets.filter(
                (a) =>
                    passes(a, {
                        provenance: provenanceFilter,
                        sources: sourceFilter,
                        types: typeFilter,
                        models: modelFilter,
                    }) && matchesQuery(a, query)
            ),
        [assets, provenanceFilter, sourceFilter, typeFilter, modelFilter, query]
    );

    const visible = filtered.slice(0, MAX_VISIBLE_ROWS);
    const overflow = filtered.length - visible.length;

    /** Toggle a value in a Set, immutably. Mirrors the existing
     *  helper in the previous filter incarnation. */
    const toggle = (
        prev: Set<string>,
        value: string
    ): Set<string> => {
        const next = new Set(prev);
        if (next.has(value)) next.delete(value);
        else next.add(value);
        return next;
    };

    /** Build 115 — when an upstream filter changes, downstream
     *  selections may now reference values that are no longer
     *  reachable. Drop those silently rather than confusing the
     *  operator with empty result sets. We do this in an effect so
     *  the cascade reads naturally on any upstream change. */
    useEffect(() => {
        const allowedTypes = new Set(typeFacets.map((f) => f.value));
        setTypeFilter((prev) => {
            const next = new Set<string>();
            for (const v of prev) if (allowedTypes.has(v)) next.add(v);
            return next.size === prev.size ? prev : next;
        });
    }, [typeFacets]);
    useEffect(() => {
        const allowedModels = new Set(modelFacets.map((f) => f.value));
        setModelFilter((prev) => {
            const next = new Set<string>();
            for (const v of prev) if (allowedModels.has(v)) next.add(v);
            return next.size === prev.size ? prev : next;
        });
    }, [modelFacets]);

    const clearAllFilters = (): void => {
        setQuery('');
        setProvenanceFilter('all');
        setSourceFilter(new Set());
        setTypeFilter(new Set());
        setModelFilter(new Set());
    };

    const hasFilters =
        query.trim().length > 0 ||
        provenanceFilter !== 'all' ||
        sourceFilter.size > 0 ||
        typeFilter.size > 0 ||
        modelFilter.size > 0;

    return (
        <div className="flex flex-col gap-2 p-3 h-full min-h-0">
            {/* Build 115.4 — provenance chips. Pinned at the
                very top because "which feed is this from" is
                often the first decision an operator makes when
                they open the panel ("I want to drag indexers"
                vs "I want to drag a switch"). */}
            <ProvenanceChips
                value={provenanceFilter}
                counts={provenanceCounts}
                onChange={setProvenanceFilter}
            />
            {/* Search bar */}
            <div className="relative">
                <Search
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400"
                    aria-hidden
                />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search devices, models, serials…"
                    className={cn(
                        'w-full pl-7 pr-7 py-1.5 text-xs rounded-md border bg-white dark:bg-slate-900',
                        'border-slate-200 dark:border-slate-700',
                        'focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20',
                        'placeholder:text-slate-400'
                    )}
                />
                {query.length > 0 && (
                    <button
                        type="button"
                        onClick={() => setQuery('')}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                        aria-label="Clear search"
                    >
                        <X className="w-3 h-3 text-slate-400" aria-hidden />
                    </button>
                )}
            </div>

            {/* Build 115 — cascading filters. Source first
                (typically the most-discriminating in fleets that
                pull from multiple sources), then Type, then
                Model. Each dropdown's options are derived from
                the rows that survive the previous filter. */}
            <div className="flex flex-col gap-1.5">
                <FilterDropdown
                    label="Management Source"
                    options={sourceFacets}
                    selected={sourceFilter}
                    onToggle={(v) => setSourceFilter((prev) => toggle(prev, v))}
                    onClear={() => setSourceFilter(new Set())}
                    placeholder="All sources"
                />
                <FilterDropdown
                    label="Device Type"
                    options={typeFacets}
                    selected={typeFilter}
                    onToggle={(v) => setTypeFilter((prev) => toggle(prev, v))}
                    onClear={() => setTypeFilter(new Set())}
                    placeholder="All types"
                />
                <FilterDropdown
                    label="Model"
                    options={modelFacets}
                    selected={modelFilter}
                    onToggle={(v) => setModelFilter((prev) => toggle(prev, v))}
                    onClear={() => setModelFilter(new Set())}
                    placeholder="All models"
                />
            </div>

            {/* Counter + clear */}
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>
                    {filtered.length} of {assets.length} device
                    {assets.length === 1 ? '' : 's'}
                </span>
                {hasFilters && (
                    <button
                        type="button"
                        onClick={clearAllFilters}
                        className="text-sky-600 dark:text-sky-400 hover:underline"
                    >
                        Clear filters
                    </button>
                )}
            </div>

            {/* List */}
            <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1">
                {isLoading && (
                    <div className="flex items-center gap-2 py-3 text-xs text-slate-500 dark:text-slate-400">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
                        Reading asset_inventory + splunk_inventory…
                    </div>
                )}
                {error && (
                    <div className="flex flex-col gap-1.5 py-3 text-xs text-rose-600 dark:text-rose-400">
                        <div className="flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5" aria-hidden />
                            <span className="font-medium">Couldn't load inventory</span>
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 leading-snug">
                            {error}
                        </p>
                        <button
                            type="button"
                            onClick={reload}
                            className="self-start mt-1 px-2 py-0.5 rounded border text-xs border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-700 dark:hover:bg-rose-950/30"
                        >
                            Retry
                        </button>
                    </div>
                )}
                {!isLoading && !error && filtered.length === 0 && (
                    <p className="py-6 text-center text-xs text-slate-400">
                        No devices match the current filters.
                    </p>
                )}
                <div className="flex flex-col gap-0.5">
                    {visible.map((a) => (
                        <InventoryRow key={a.id} asset={a} />
                    ))}
                </div>
                {overflow > 0 && (
                    <p className="mt-2 px-2 py-1 rounded bg-amber-50 dark:bg-amber-950/30 text-xs text-amber-700 dark:text-amber-300 leading-snug">
                        {overflow} more match — filter to narrow.
                    </p>
                )}
            </div>
        </div>
    );
};
