/**
 * ThemeToggle — single-button cycle through light → dark → system.
 *
 * The icon reflects the *user preference*, not the resolved theme.
 * This way "system" always shows a monitor glyph so the user can
 * tell whether they've explicitly opted in or are auto-following.
 */

import React from 'react';
import { Sun, Moon, MonitorSmartphone } from 'lucide-react';
import { cn } from '@/common/lib/utils';
import type { ThemePreference } from '@/common/hooks/useTheme';

interface ThemeToggleProps {
    theme: ThemePreference;
    onCycle: () => void;
    className?: string;
}

const NEXT_LABEL: Record<ThemePreference, string> = {
    light: 'Switch to dark mode',
    dark: 'Switch to follow system theme',
    system: 'Switch to light mode',
};

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ theme, onCycle, className }) => {
    const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : MonitorSmartphone;
    return (
        <button
            type="button"
            onClick={onCycle}
            title={NEXT_LABEL[theme]}
            aria-label={NEXT_LABEL[theme]}
            className={cn(
                'p-1.5 rounded transition-colors',
                'text-slate-500 hover:text-sky-600 hover:bg-slate-50',
                'dark:text-slate-400 dark:hover:text-sky-300 dark:hover:bg-slate-800',
                className
            )}
        >
            <Icon className="w-4 h-4" />
        </button>
    );
};
