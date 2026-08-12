import React, { useState } from 'react';
import { Map, Table2 } from '@/common/icons/SuiIcon';
import {
    CustomerTopologyMap,
    CUSTOMER_TOPOLOGY,
    TopologySiteTable,
} from '@/common/components/workspace/CustomerTopologyMap';
import { cn } from '@/common/lib/utils';

interface SiteMapProps {
    earliestTime: string;
    latestTime: string;
}

type RegionalView = 'map' | 'table';

const RegionalViewToggle: React.FC<{
    value: RegionalView;
    onChange: (next: RegionalView) => void;
}> = ({ value, onChange }) => (
    <div
        role="tablist"
        aria-label="Topology view"
        className="flex rounded-md  p-1 sui-bg-popup"
    >
        {([
            { value: 'map', label: 'Map', Icon: Map },
            { value: 'table', label: 'Table', Icon: Table2 },
        ] as const).map((option) => {
            const active = value === option.value;
            return (
                <button
                    key={option.value}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => onChange(option.value)}
                    className={cn(
                        'inline-flex h-8 items-center gap-1.5 rounded px-3 text-xs font-black uppercase tracking-wider transition focus:outline-none focus:ring-1 sui-focus-ring',
                        active
                            ? 'border    shadow-sm sui-border-default sui-bg-section sui-color-info'
                            : 'sui-color-default  sui-color-muted sui-hover-color-active'
                    )}
                >
                    <option.Icon className="h-3.5 w-3.5" />
                    {option.label}
                </button>
            );
        })}
    </div>
);

export const SiteMap: React.FC<SiteMapProps> = ({
    earliestTime,
    latestTime,
}) => {
    const [view, setView] = useState<RegionalView>('map');

    return (
        <aside className="flex h-full min-h-0 w-full flex-col rounded-xl border   p-3 sui-shadow-overlay backdrop-blur-xl sui-border-default sui-bg-section">
            <div className="mb-2 flex items-start justify-between gap-4 px-1">
                <div className="min-w-0">
                    <h2 className="truncate  font-black uppercase tracking-wide  sui-color-info">
                        Customer Site Connectivity
                    </h2>
                    <p className="mt-1 truncate text-xs font-semibold  sui-color-muted">
                        Editable customer site connectivity
                    </p>
                </div>
                <RegionalViewToggle value={view} onChange={setView} />
            </div>
            <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg">
                {view === 'map' ? (
                    <CustomerTopologyMap
                        topology={CUSTOMER_TOPOLOGY}
                        earliestTime={earliestTime}
                        latestTime={latestTime}
                    />
                ) : (
                    <TopologySiteTable topology={CUSTOMER_TOPOLOGY} />
                )}
            </div>
        </aside>
    );
};
