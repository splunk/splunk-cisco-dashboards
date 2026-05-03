import React from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { Sparkline } from './Sparkline';
import { cn } from '@/common/lib/utils';

interface MetricItemProps {
    label: string;
    subLabel?: string;
    value: string | number;
    unit?: string;
    change?: number;
    sparkData: number[];
    color?: string;
    className?: string;
}

export const MetricItem: React.FC<MetricItemProps> = ({
    label,
    subLabel,
    value,
    unit = '',
    change,
    sparkData,
    color = '#0ea5e9',
    className,
}) => {
    return (
        <div className={cn('flex flex-col min-w-[180px] px-2', className)}>
            <div className="flex flex-col mb-1">
                <span className="text-[13px] font-bold text-slate-800 tracking-tight leading-tight uppercase">
                    {label}
                </span>
                {subLabel && (
                    <span className="text-[10px] text-slate-400 font-medium tracking-tight h-8 leading-tight">
                        {subLabel}
                    </span>
                )}
            </div>

            <div className="flex items-baseline gap-2 mb-2">
                <span className="text-5xl font-black tracking-tighter text-sky-600">
                    {value}
                    {unit}
                </span>
                {change !== undefined && (
                    <div
                        className={cn(
                            'flex items-center text-[10px] font-black',
                            change >= 0 ? 'text-green-500' : 'text-red-500'
                        )}
                    >
                        {change >= 0 ? (
                            <ArrowUp className="w-3 h-3 stroke-[3px]" />
                        ) : (
                            <ArrowDown className="w-3 h-3 stroke-[3px]" />
                        )}
                        <span>{change > 0 ? `+${change}` : change}%</span>
                    </div>
                )}
            </div>

            <div className="h-10 mt-auto opacity-80 hover:opacity-100 transition-opacity">
                <Sparkline data={sparkData} color={color} />
            </div>
        </div>
    );
};
