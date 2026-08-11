/**
 * Topology Canvas v1 page — Visio-style network diagram backed by
 * `asset_inventory.csv` (devices) + `site_topology_lookup.csv`
 * (zones) and the existing `[overview_link_te_a2a_health]` searchbase
 * stanza (synthetic edges).
 *
 * This is the v1 spike requested by Alan: prove out the architecture
 * (auto-discover from existing customer data, manual reposition with
 * persistence, deterministic auto-layout) on top of React Flow +
 * elkjs before we invest in the full editor (palette dragging,
 * custom edge creation, KVStore-backed multi-user persistence,
 * floor-plan overlays).
 *
 * Layout: full-bleed canvas with a slim header bar carrying title,
 * subtitle, and a refresh affordance. Editing affordances
 * (refresh, reset-layout) live INSIDE the canvas component as a
 * floating toolbar — that way the canvas chrome scales to whatever
 * embedding context surfaces it later (e.g. a tile inside the
 * overview page).
 */

import React from 'react';
import { Layers, Sparkles } from '@/common/icons/SuiIcon';
import { TopologyCanvas } from '@/common/components/topology/TopologyCanvas';
import { fetchAllEdges } from '@/common/components/topology/edgeFetchers';
import { useTheme } from '@/common/hooks/useTheme';
import { cn } from '@/common/lib/utils';

const TopologyCanvasPage: React.FC = () => {
    const { resolvedTheme } = useTheme();

    return (
        <div
            className={cn(
                'flex flex-col w-full h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100',
                resolvedTheme === 'dark' && 'dark scd-c3-atmosphere'
            )}
        >
        <header className="flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="flex items-center gap-3 min-w-0">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 flex-shrink-0">
                    <Layers className="w-5 h-5" aria-hidden />
                </div>
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <h1 className="text-base font-semibold tracking-tight truncate">
                            Network Topology Canvas
                        </h1>
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                            <Sparkles className="w-2.5 h-2.5" aria-hidden />
                            v1 spike
                        </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        Auto-discovered from <code className="font-mono">asset_inventory.csv</code> and{' '}
                        <code className="font-mono">site_topology_lookup.csv</code>; ThousandEyes A2A
                        measurements overlay as dashed sky-blue edges. Drag any device to override its
                        position — overrides persist locally per browser.
                    </p>
                </div>
            </div>
        </header>
        <main className="flex-1 min-h-0 p-4">
            <TopologyCanvas fetchEdges={fetchAllEdges} className="h-full" />
        </main>
        </div>
    );
};

export default TopologyCanvasPage;
