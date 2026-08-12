import React, { useState } from 'react';
import { Map, Table2 } from '@/common/icons/SuiIcon';
import {
    CustomerTopologyMap,
    CUSTOMER_TOPOLOGY,
    TopologySiteTable,
} from '@/common/components/workspace/CustomerTopologyMap';
import { cn } from '@/common/lib/utils';

interface SiteMapProps {
    isDark: boolean;
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
        className="flex rounded-md bg-slate-100 p-1 dark:bg-slate-800/60"
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
                        'inline-flex h-8 items-center gap-1.5 rounded px-3 text-xs font-black uppercase tracking-wider transition focus:outline-none focus:ring-1 focus:ring-sky-400',
                        active
                            ? 'border border-slate-200 bg-white text-sky-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-sky-300'
                            : 'text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200'
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
    isDark,
    earliestTime,
    latestTime,
}) => {
    const [view, setView] = useState<RegionalView>('map');

    return (
        <aside className="flex h-full min-h-0 w-full flex-col rounded-xl border border-slate-200 bg-white/78 p-3 shadow-[0_18px_55px_-38px_rgba(15,23,42,0.7)] backdrop-blur-xl dark:border-slate-700/80 dark:bg-slate-900/74">
            <div className="mb-2 flex items-start justify-between gap-4 px-1">
                <div className="min-w-0">
                    <h2 className="truncate text-[17px] font-black uppercase tracking-wide text-sky-900 dark:text-sky-200">
                        Customer Site Connectivity
                    </h2>
                    <p className="mt-1 truncate text-xs font-semibold text-slate-400 dark:text-slate-500">
                        Editable customer site connectivity
                    </p>
                </div>
                <RegionalViewToggle value={view} onChange={setView} />
            </div>
            <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg">
                {view === 'map' ? (
                    <CustomerTopologyMap
                        topology={CUSTOMER_TOPOLOGY}
                        isDark={isDark}
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
