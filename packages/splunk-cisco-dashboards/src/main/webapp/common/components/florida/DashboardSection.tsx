import React from 'react';
import { ChevronRight, ArrowUpRight } from 'lucide-react';
import { cn } from '@/common/lib/utils';

interface DashboardSectionProps {
    title: string;
    linkText: string;
    /**
     * Splunk view name (without app prefix). Resolved relative to the
     * current app, so {href: 'it_health_v2'} navigates to
     * `/<locale>/app/splunk-cisco-dashboards/it_health_v2`. If omitted
     * the link is non-interactive.
     */
    href?: string;
    children: React.ReactNode;
    className?: string;
}

export const DashboardSection: React.FC<DashboardSectionProps> = ({
    title,
    linkText,
    href,
    children,
    className,
}) => {
    return (
        <div
            className={cn(
                'bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2.5 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.1)] dark:shadow-[0_4px_20px_-10px_rgba(0,0,0,0.45)] relative overflow-hidden group flex flex-col',
                className
            )}
        >
            <div className="absolute top-0 left-0 w-1.5 h-full bg-sky-100 dark:bg-sky-900/40 group-hover:bg-sky-600 dark:group-hover:bg-sky-500 transition-colors" />

            <div className="flex items-center justify-between mb-1.5">
                <h3 className="text-[14px] font-black text-sky-950 dark:text-sky-100 uppercase tracking-tight leading-none">
                    {title}
                </h3>
            </div>

            <div className="flex flex-wrap md:flex-nowrap gap-0 divide-x divide-slate-100 dark:divide-slate-800 flex-1 min-h-0">
                {children}
            </div>

            <div className="mt-1.5 pt-1.5 border-t border-slate-50 dark:border-slate-800">
                <a
                    href={href ?? '#'}
                    aria-disabled={!href}
                    target={href ? '_blank' : undefined}
                    rel={href ? 'noopener noreferrer' : undefined}
                    onClick={(e) => {
                        if (!href) e.preventDefault();
                    }}
                    className={cn(
                        'inline-flex items-center text-[11px] font-black uppercase tracking-wider transition-colors group/link',
                        href
                            ? 'text-sky-600 hover:text-sky-700 dark:text-sky-300 dark:hover:text-sky-200 cursor-pointer'
                            : 'text-slate-400 dark:text-slate-600 cursor-not-allowed'
                    )}
                >
                    <ChevronRight className="w-3 h-3 mr-0.5 group-hover/link:translate-x-0.5 transition-transform" />
                    {linkText}
                    <ArrowUpRight className="w-3 h-3 ml-1 opacity-0 -translate-y-0.5 translate-x-0.5 group-hover/link:opacity-100 group-hover/link:translate-y-0 group-hover/link:translate-x-0 transition-all" />
                </a>
            </div>
        </div>
    );
};
