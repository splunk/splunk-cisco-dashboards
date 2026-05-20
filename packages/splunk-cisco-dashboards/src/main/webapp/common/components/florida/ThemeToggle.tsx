/**
 * ThemeToggle — clearly-labeled pill button that cycles
 *   light → dark → system → light …
 *
 * We show both an icon AND a text label so the control is impossible
 * to overlook in the dashboard header. The label always reflects the
 * user's *preference* (not the resolved theme), so "AUTO" stays
 * visible when following the OS.
 */

import React from 'react';
import { Sun, Moon, MonitorSmartphone } from 'lucide-react';
import { cn } from '@/common/lib/utils';
import type { ThemePreference } from '@/common/hooks/useTheme';

interface ThemeToggleProps {
    theme: ThemePreference;
    onCycle: () => void;
    className?: string;
    iconOnly?: boolean;
}

const PRESET: Record<
    ThemePreference,
    {
        label: string;
        nextLabel: string;
        Icon: React.ComponentType<{ className?: string }>;
        chrome: string;
    }
> = {
    light: {
        label: 'LIGHT',
        nextLabel: 'Switch to dark mode',
        Icon: Sun,
        chrome:
            'bg-amber-100 border-amber-300 text-amber-700 hover:bg-amber-200',
    },
    dark: {
        label: 'DARK',
        nextLabel: 'Switch to follow system theme',
        Icon: Moon,
        chrome:
            'bg-indigo-900/60 border-indigo-700 text-indigo-200 hover:bg-indigo-900',
    },
    system: {
        label: 'AUTO',
        nextLabel: 'Switch to light mode',
        Icon: MonitorSmartphone,
        chrome:
            'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700',
    },
};

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
    theme,
    onCycle,
    className,
    iconOnly = false,
}) => {
    const preset = PRESET[theme];
    const Icon = preset.Icon;
    return (
        <button
            type="button"
            onClick={onCycle}
            title={preset.nextLabel}
            aria-label={preset.nextLabel}
            className={cn(
                iconOnly
                    ? 'inline-flex items-center justify-center w-10 h-10 rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-sky-400'
                    : 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest transition-colors focus:outline-none focus:ring-2 focus:ring-sky-400',
                preset.chrome,
                className
            )}
        >
            <Icon className={iconOnly ? 'w-5 h-5' : 'w-3.5 h-3.5'} />
            {!iconOnly && preset.label}
        </button>
    );
};
