/**
 * useTheme — light / dark / system theme manager.
 *
 * Source of truth is the user's choice persisted to localStorage. The
 * "system" option follows `prefers-color-scheme` and updates live when
 * the user flips their OS setting. The hook returns both the *user
 * preference* (`theme`) and the *resolved* mode that should drive the
 * UI (`resolvedTheme`, always either 'light' or 'dark').
 *
 * Toggle pattern: cycle through light → dark → system → light…
 */

import { useCallback, useEffect, useState } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'splunk-cisco-dashboards:theme';

const isValidPreference = (value: unknown): value is ThemePreference =>
    value === 'light' || value === 'dark' || value === 'system';

const readStoredPreference = (): ThemePreference => {
    if (typeof window === 'undefined') return 'system';
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        return isValidPreference(raw) ? raw : 'system';
    } catch {
        // localStorage can throw in some sandboxed contexts (e.g. when
        // cookies / storage are disabled). Fall back to system safely.
        return 'system';
    }
};

const detectSystemTheme = (): ResolvedTheme => {
    if (typeof window === 'undefined' || !window.matchMedia) return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

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
    const [theme, setThemeState] = useState<ThemePreference>(readStoredPreference);
    const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(detectSystemTheme);

    // Re-evaluate system theme whenever the OS setting flips.
    useEffect(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return undefined;
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = (e: MediaQueryListEvent) => {
            setSystemTheme(e.matches ? 'dark' : 'light');
        };
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);

    const setTheme = useCallback((next: ThemePreference) => {
        setThemeState(next);
        try {
            if (typeof window !== 'undefined') {
                window.localStorage.setItem(STORAGE_KEY, next);
            }
        } catch {
            // Persistence best-effort; failure shouldn't break the UI.
        }
    }, []);

    const cycle = useCallback(() => {
        setTheme(theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light');
    }, [theme, setTheme]);

    const resolvedTheme: ResolvedTheme = theme === 'system' ? systemTheme : theme;

    return { theme, resolvedTheme, setTheme, cycle };
};
