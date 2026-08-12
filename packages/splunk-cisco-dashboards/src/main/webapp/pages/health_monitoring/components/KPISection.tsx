import React from 'react';
import { Plus } from '@/common/icons/SuiIcon';
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
                <h2 className="sui-color-default font-black tracking-tight  sui-color-active">
                    {title}
                </h2>
                <button
                    type="button"
                    onClick={() => onAdd(sectionId)}
                    className={cn(
                        'inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-black transition',
                        'sui-border-weak sui-bg-section sui-color-active shadow-sm sui-hover-border-info sui-hover-color-info',
                        'focus:outline-none focus-visible:ring-2 sui-focus-visible-ring',
                        'sui-border-default sui-bg-section sui-color-active sui-hover-border-info'
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
                <div className="rounded-xl border border-dashed   p-8 text-center text-sm font-semibold  sui-border-default sui-bg-section sui-color-default">
                    {searchTerm.trim()
                        ? 'No KPIs in this section match the search.'
                        : 'No KPIs in this section yet.'}
                </div>
            )}
        </section>
    );
};
