import React from 'react';
import { ChevronRight, ArrowUpRight } from 'lucide-react';
import { cn } from '@/common/lib/utils';

interface DashboardSectionProps {
    title: string;
    linkText: string;
    children: React.ReactNode;
    className?: string;
}

export const DashboardSection: React.FC<DashboardSectionProps> = ({
    title,
    linkText,
    children,
    className,
}) => {
    return (
        <div
            className={cn(
                'bg-white rounded-xl border border-slate-200 p-6 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.1)] relative overflow-hidden group',
                className
            )}
        >
            <div className="absolute top-0 left-0 w-1.5 h-full bg-sky-100 group-hover:bg-sky-600 transition-colors" />

            <div className="flex items-center justify-between mb-6">
                <h3 className="text-[17px] font-black text-sky-950 uppercase tracking-tight">
                    {title}
                </h3>
            </div>

            <div className="flex flex-wrap md:flex-nowrap gap-0 divide-x divide-slate-100">
                {children}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-50">
                <a
                    href="#"
                    className="inline-flex items-center text-[11px] font-black text-sky-600 hover:text-sky-700 transition-colors group/link uppercase tracking-wider"
                >
                    <ChevronRight className="w-3 h-3 mr-0.5 group-hover/link:translate-x-0.5 transition-transform" />
                    {linkText}
                    <ArrowUpRight className="w-3 h-3 ml-1 opacity-0 -translate-y-0.5 translate-x-0.5 group-hover/link:opacity-100 group-hover/link:translate-y-0 group-hover/link:translate-x-0 transition-all" />
                </a>
            </div>
        </div>
    );
};
