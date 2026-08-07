import { getUserTheme } from '@splunk/splunk-utils/themes';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const APP_THEME_FAMILY = 'prisma' as const;
export const APP_THEME_DENSITY = 'comfortable' as const;
export const THEME_STORAGE_KEY = 'splunk-cisco-dashboards:theme';
export const THEME_CHANGE_EVENT = 'splunk-cisco-dashboards:theme-change';

export const isThemePreference = (value: unknown): value is ThemePreference =>
    value === 'light' || value === 'dark' || value === 'system';

export const readThemePreference = (): ThemePreference => {
    if (typeof window === 'undefined') return 'system';

    try {
        const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
        return isThemePreference(stored) ? stored : 'system';
    } catch {
        return 'system';
    }
};

export const getSplunkColorScheme = async (): Promise<ResolvedTheme> => {
    try {
        return (await getUserTheme()) === 'dark' ? 'dark' : 'light';
    } catch {
        return 'light';
    }
};

export const resolveThemePreference = async (
    preference: ThemePreference = readThemePreference()
): Promise<ResolvedTheme> => {
    if (preference === 'light' || preference === 'dark') return preference;
    return getSplunkColorScheme();
};

export const writeThemePreference = (preference: ThemePreference): void => {
    if (typeof window === 'undefined') return;

    try {
        window.localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
        // Storage is best effort in restricted or private browser contexts.
    }

    window.dispatchEvent(
        new CustomEvent<ThemePreference>(THEME_CHANGE_EVENT, { detail: preference })
    );
};

