import React from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@/common/lib/utils';
import type { KPIInstance, KPISectionId } from '@/data/kpi-templates';
import { DraggableKPICard } from './DraggableKPICard';

interface KPISectionProps {
    sectionId: KPISectionId;
    title: string;
    kpis: KPIInstance[];
    searchTerm: string;
    onAdd: (sectionId: KPISectionId) => void;
    onMove: (sectionId: KPISectionId, fromIndex: number, toIndex: number) => void;
    onConfigure: (kpi: KPIInstance) => void;
    onExpand: (kpi: KPIInstance) => void;
    onRemove: (kpi: KPIInstance) => void;
}

const matchesSearch = (kpi: KPIInstance, searchTerm: string): boolean => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return true;
    return [
        kpi.title,
        kpi.subtitle,
        kpi.description,
        kpi.app,
        kpi.category,
        kpi.subCategory,
        ...kpi.tags,
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query);
};

export const KPISection: React.FC<KPISectionProps> = ({
    sectionId,
    title,
    kpis,
    searchTerm,
    onAdd,
    onMove,
    onConfigure,
    onExpand,
    onRemove,
}) => {
    const filtered = kpis.filter((kpi) => matchesSearch(kpi, searchTerm));

    return (
        <section className="min-w-0">
            <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-[20px] font-black tracking-tight text-slate-900 dark:text-white">
                    {title}
                </h2>
                <button
                    type="button"
                    onClick={() => onAdd(sectionId)}
                    className={cn(
                        'inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-black transition',
                        'border-slate-200 bg-white/85 text-slate-900 shadow-sm hover:border-sky-300 hover:text-sky-700',
                        'focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400',
                        'dark:border-slate-700 dark:bg-slate-900/80 dark:text-white dark:hover:border-sky-500'
                    )}
                >
                    <Plus className="h-4 w-4" />
                    Add KPI
                </button>
            </div>
            {filtered.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
                    {filtered.map((kpi, filteredIndex) => {
                        const canonicalIndex = kpis.findIndex(
                            (candidate) => candidate.instanceId === kpi.instanceId
                        );
                        return (
                            <DraggableKPICard
                                key={kpi.instanceId}
                                kpi={kpi}
                                index={canonicalIndex < 0 ? filteredIndex : canonicalIndex}
                                sectionId={sectionId}
                                onMove={onMove}
                                onConfigure={onConfigure}
                                onExpand={onExpand}
                                onRemove={onRemove}
                            />
                        );
                    })}
                </div>
            ) : (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 p-8 text-center text-sm font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-900/45 dark:text-slate-400">
                    {searchTerm.trim()
                        ? 'No KPIs in this section match the search.'
                        : 'No KPIs in this section yet.'}
                </div>
            )}
        </section>
    );
};
