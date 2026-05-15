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
 * Filter model (mirrors the picker UX in the overview page so
 * customers see the same affordances on both surfaces):
 *
 *   • Free-text search — matches device_name / shortLabel / site
 *     / device_type, case-insensitive, AND-combined with the
 *     facet chips below.
 *   • Device-type chips — auto-derived from the data (e.g.
 *     "switch", "router", "firewall", "wlc", "ap"). Multi-select;
 *     selecting more than one ORs them.
 *   • Site chips — same but for `siteLabel`. Top-N by count
 *     with an "all sites" reset.
 *
 * The list is virtualised-by-cap rather than virtualised-by-
 * library: we cap the visible rows at 200 and show a "+N more,
 * filter to narrow" banner when the underlying set is larger.
 * A 30-device FDEM stack barely tickles this; a 5,000-device
 * enterprise stack would, and at that point we'd swap in
 * `react-window`. For Build 106 the cap keeps the React render
 * cost bounded without taking on a new dep.
 *
 * Drag protocol: each row sets the same `PALETTE_DND_MIME`
 * payload as the Shapes tab, with `variant: 'asset'` and the
 * resolved `assetId`, `shape`, `label`, `shortLabel`,
 * `siteLabel`. The canvas's drop handler reads this verbatim.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Search, X, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/common/lib/utils';
import { CISCO_ICONS } from '@/common/components/topology/ciscoIcons';
import {
    fetchAssetInventory,
    type TopologyDiscoveredNode,
    type DeviceShapeId,
} from '@/common/services/topologyDiscovery';
import { PALETTE_DND_MIME, type PaletteDragPayload } from './types';

const MAX_VISIBLE_ROWS = 200;
const MAX_FACET_CHIPS = 8;

interface FacetEntry {
    value: string;
    count: number;
}

const useAssetInventory = (): {
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
        fetchAssetInventory()
            .then((rows) => {
                if (!cancelled) setAssets(rows);
            })
            .catch((err: unknown) => {
                if (!cancelled) {
                    setError(
                        err instanceof Error
                            ? err.message
                            : 'Failed to load asset_inventory'
                    );
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

const facetCounts = (
    rows: TopologyDiscoveredNode[],
    pick: (r: TopologyDiscoveredNode) => string | undefined
): FacetEntry[] => {
    const counts = new Map<string, number>();
    for (const r of rows) {
        const v = (pick(r) ?? '').trim();
        if (!v) continue;
        counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    return Array.from(counts.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
        .slice(0, MAX_FACET_CHIPS);
};

const matches = (
    asset: TopologyDiscoveredNode,
    query: string,
    typeFilter: Set<string>,
    siteFilter: Set<string>
): boolean => {
    if (typeFilter.size > 0) {
        const t = ((asset.raw['device_type'] as string | undefined) ?? '').toLowerCase();
        if (!typeFilter.has(t)) return false;
    }
    if (siteFilter.size > 0) {
        const s = (asset.siteLabel ?? '').trim();
        if (!siteFilter.has(s)) return false;
    }
    if (query.trim().length === 0) return true;
    const q = query.trim().toLowerCase();
    if (asset.label.toLowerCase().includes(q)) return true;
    if (asset.shortLabel.toLowerCase().includes(q)) return true;
    const t = ((asset.raw['device_type'] as string | undefined) ?? '').toLowerCase();
    if (t.includes(q)) return true;
    if ((asset.siteLabel ?? '').toLowerCase().includes(q)) return true;
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

const Chip: React.FC<{
    label: string;
    count: number;
    active: boolean;
    onClick: () => void;
}> = ({ label, count, active, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className={cn(
            'flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors',
            active
                ? 'bg-sky-500 text-white border-sky-600'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-sky-400 hover:text-sky-600 dark:hover:text-sky-400'
        )}
    >
        <span className="capitalize">{label}</span>
        <span
            className={cn(
                'text-[9px] font-mono px-1 rounded-sm',
                active
                    ? 'bg-sky-700/40 text-sky-50'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
            )}
        >
            {count}
        </span>
    </button>
);

const InventoryRow: React.FC<{ asset: TopologyDiscoveredNode }> = ({ asset }) => {
    const Icon = CISCO_ICONS[asset.shape] ?? CISCO_ICONS.generic;
    const handleDragStart = (e: React.DragEvent<HTMLDivElement>): void => {
        const payload = dragPayloadForAsset(asset);
        e.dataTransfer.setData(PALETTE_DND_MIME, JSON.stringify(payload));
        e.dataTransfer.setData('text/plain', asset.label);
        e.dataTransfer.effectAllowed = 'copy';
    };
    const deviceType =
        (asset.raw['device_type'] as string | undefined) ??
        (asset.raw['device_family'] as string | undefined) ??
        asset.shape;
    return (
        <div
            draggable
            onDragStart={handleDragStart}
            role="button"
            tabIndex={0}
            aria-label={`Drag ${asset.label} to canvas`}
            title={`${asset.label}\n${deviceType}${asset.siteLabel ? `\n${asset.siteLabel}` : ''}`}
            className={cn(
                'flex items-center gap-2 px-2 py-1.5 rounded-md cursor-grab active:cursor-grabbing select-none',
                'border border-transparent hover:border-sky-400 hover:bg-sky-50/60 dark:hover:bg-sky-950/30',
                'transition-colors duration-100'
            )}
        >
            <Icon className="w-6 h-6 flex-shrink-0 text-slate-500 dark:text-slate-400" />
            <div className="min-w-0 flex-1">
                <div className="text-[11px] font-medium text-slate-900 dark:text-slate-100 truncate">
                    {asset.shortLabel}
                </div>
                <div className="text-[9px] text-slate-500 dark:text-slate-400 truncate uppercase tracking-wide">
                    {deviceType}
                    {asset.siteLabel ? ` · ${asset.siteLabel}` : ''}
                </div>
            </div>
        </div>
    );
};

export const InventoryTab: React.FC = () => {
    const { assets, error, isLoading, reload } = useAssetInventory();
    const [query, setQuery] = useState<string>('');
    const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set());
    const [siteFilter, setSiteFilter] = useState<Set<string>>(new Set());

    const typeFacets = useMemo(
        () =>
            facetCounts(assets, (r) =>
                ((r.raw['device_type'] as string | undefined) ?? '').toLowerCase()
            ),
        [assets]
    );
    const siteFacets = useMemo(
        () => facetCounts(assets, (r) => r.siteLabel),
        [assets]
    );

    const filtered = useMemo(
        () => assets.filter((a) => matches(a, query, typeFilter, siteFilter)),
        [assets, query, typeFilter, siteFilter]
    );

    const visible = filtered.slice(0, MAX_VISIBLE_ROWS);
    const overflow = filtered.length - visible.length;

    const toggleSetMember = (
        prev: Set<string>,
        value: string
    ): Set<string> => {
        const next = new Set(prev);
        if (next.has(value)) next.delete(value);
        else next.add(value);
        return next;
    };

    const clearAllFilters = (): void => {
        setQuery('');
        setTypeFilter(new Set());
        setSiteFilter(new Set());
    };

    const hasFilters =
        query.trim().length > 0 || typeFilter.size > 0 || siteFilter.size > 0;

    return (
        <div className="flex flex-col gap-2 p-3 h-full min-h-0">
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
                    placeholder="Search devices…"
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

            {/* Type chips */}
            {typeFacets.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {typeFacets.map((f) => (
                        <Chip
                            key={`type-${f.value}`}
                            label={f.value || '(none)'}
                            count={f.count}
                            active={typeFilter.has(f.value)}
                            onClick={() =>
                                setTypeFilter((prev) => toggleSetMember(prev, f.value))
                            }
                        />
                    ))}
                </div>
            )}

            {/* Site chips */}
            {siteFacets.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pb-1">
                    {siteFacets.map((f) => (
                        <Chip
                            key={`site-${f.value}`}
                            label={f.value}
                            count={f.count}
                            active={siteFilter.has(f.value)}
                            onClick={() =>
                                setSiteFilter((prev) => toggleSetMember(prev, f.value))
                            }
                        />
                    ))}
                </div>
            )}

            {/* Counter + clear */}
            <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
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
                    <div className="flex items-center gap-2 py-3 text-[11px] text-slate-500 dark:text-slate-400">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
                        Reading asset_inventory.csv…
                    </div>
                )}
                {error && (
                    <div className="flex flex-col gap-1.5 py-3 text-[11px] text-rose-600 dark:text-rose-400">
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
                            className="self-start mt-1 px-2 py-0.5 rounded border text-[10px] border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-700 dark:hover:bg-rose-950/30"
                        >
                            Retry
                        </button>
                    </div>
                )}
                {!isLoading && !error && filtered.length === 0 && (
                    <p className="py-6 text-center text-[11px] text-slate-400">
                        No devices match the current filters.
                    </p>
                )}
                <div className="flex flex-col gap-0.5">
                    {visible.map((a) => (
                        <InventoryRow key={a.id} asset={a} />
                    ))}
                </div>
                {overflow > 0 && (
                    <p className="mt-2 px-2 py-1 rounded bg-amber-50 dark:bg-amber-950/30 text-[10px] text-amber-700 dark:text-amber-300 leading-snug">
                        {overflow} more match — filter to narrow.
                    </p>
                )}
            </div>
        </div>
    );
};
