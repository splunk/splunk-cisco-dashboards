/**
 * useTheme — light / dark / system theme manager.
 *
 * Source of truth is the user's choice persisted to localStorage. The
 * "system" option follows the Splunk Web user theme. The hook returns both the *user
 * preference* (`theme`) and the *resolved* mode that should drive the
 * UI (`resolvedTheme`, always either 'light' or 'dark').
 *
 * Toggle pattern: cycle through light → dark → system → light…
 */

import { useCallback, useEffect, useState } from 'react';
import {
    readThemePreference,
    resolveThemePreference,
    writeThemePreference,
    type ResolvedTheme,
    type ThemePreference,
} from '@/common/theme/themePreference';
import { syncSplunkShellTheme } from '@/common/theme/splunkShellTheme';

export type { ResolvedTheme, ThemePreference } from '@/common/theme/themePreference';

interface UseThemeResult {
    /** User-selected preference. */
    theme: ThemePreference;
    /** Effective theme to render. Always 'light' or 'dark'. */
    resolvedTheme: ResolvedTheme;
    setTheme: (next: ThemePreference) => void;
    /** Cycle through light → dark → system → light. */
    cycle: () => void;
}

export const useTheme = (): UseThemeResult => {
    const [theme, setThemeState] = useState<ThemePreference>(readThemePreference);
    const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
        readThemePreference() === 'dark' ? 'dark' : 'light'
    );

    useEffect(() => {
        let active = true;
        void resolveThemePreference(theme).then((next) => {
            if (active) setResolvedTheme(next);
        });
        return () => {
            active = false;
        };
    }, [theme]);

    useEffect(() => syncSplunkShellTheme(resolvedTheme), [resolvedTheme]);

    const setTheme = useCallback((next: ThemePreference) => {
        setThemeState(next);
        writeThemePreference(next);
    }, []);

    const cycle = useCallback(() => {
        setTheme(theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light');
    }, [theme, setTheme]);

    return { theme, resolvedTheme, setTheme, cycle };
};
