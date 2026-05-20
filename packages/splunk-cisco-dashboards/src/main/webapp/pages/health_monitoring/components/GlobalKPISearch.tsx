import React from 'react';
import { Search, X } from 'lucide-react';
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
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
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
                'border-slate-200 bg-white/80 text-slate-900 placeholder:text-slate-500 shadow-sm',
                'focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20',
                'dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-100 dark:placeholder:text-slate-400'
            )}
        />
        {value ? (
            <button
                type="button"
                onClick={() => onChange('')}
                aria-label="Clear KPI search"
                className="absolute right-3 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
            >
                <X className="h-3.5 w-3.5" />
            </button>
        ) : (
            <button
                type="button"
                onClick={onOpenLibrary}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500 transition hover:text-sky-600 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300"
                title="Open KPI library"
            >
                Cmd K
            </button>
        )}
        {value && (
            <span className="absolute -bottom-5 left-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {resultCount} match{resultCount === 1 ? '' : 'es'}
            </span>
        )}
    </div>
);
