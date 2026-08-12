import React from 'react';
import { Search, X } from '@/common/icons/SuiIcon';
import { cn } from '@/common/lib/utils';

interface GlobalKPISearchProps {
    value: string;
    resultCount: number;
    onChange: (next: string) => void;
    onOpenLibrary: () => void;
}

export const GlobalKPISearch: React.FC<GlobalKPISearchProps> = ({
    value,
    resultCount,
    onChange,
    onOpenLibrary,
}) => (
    <div className="relative w-[min(340px,42vw)]">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 sui-color-default" />
        <input
            type="search"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    onOpenLibrary();
                }
            }}
            placeholder="Search KPIs..."
            className={cn(
                'h-10 w-full rounded-lg border py-0 pl-9 pr-20 text-sm font-semibold outline-none transition',
                'sui-border-weak sui-bg-section  sui-color-muted shadow-sm',
                'sui-focus-border-info focus:ring-2 sui-focus-ring',
                'sui-border-default sui-bg-popup  sui-color-default'
            )}
        />
        {value ? (
            <button
                type="button"
                onClick={() => onChange('')}
                aria-label="Clear KPI search"
                className="absolute right-3 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md sui-color-default transition   sui-hover-bg-floating sui-hover-color-active"
            >
                <X className="h-3.5 w-3.5" />
            </button>
        ) : (
            <button
                type="button"
                onClick={onOpenLibrary}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md border   px-2 py-1 text-xs font-black uppercase tracking-wider  transition sui-hover-color-info sui-border-default sui-bg-floating sui-color-default"
                title="Open KPI library"
            >
                Cmd K
            </button>
        )}
        {value && (
            <span className="absolute -bottom-5 left-1 text-xs font-bold uppercase tracking-wider sui-color-default">
                {resultCount} match{resultCount === 1 ? '' : 'es'}
            </span>
        )}
    </div>
);
