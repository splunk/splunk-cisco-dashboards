import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';
import {
    SplunkThemeProvider,
    unstable_splunk1cdThemeCustomizer,
} from '@splunk/themes';
import {
    readUserScopedStorageItem,
    userScopedStorageKey,
} from '@/common/config/insightsWorkspaces';
import SemanticThemeStyles from './SemanticThemeStyles';

export type AppColorScheme = 'light' | 'dark';

export const INSIGHTS_WORKSPACE_COLOR_SCHEME_STORAGE_KEY =
    'splunk-cisco-dashboards:insights-workspace-color-scheme';

interface AppThemeProviderProps {
    children: React.ReactNode;
    allowColorSchemeChoice?: boolean;
    colorSchemeStorageKey?: string;
}

interface AppThemeControls {
    colorScheme: AppColorScheme;
    canChooseColorScheme: boolean;
    setColorScheme: (next: AppColorScheme) => void;
}

const AppThemeControlsContext = createContext<AppThemeControls>({
    colorScheme: 'dark',
    canChooseColorScheme: false,
    setColorScheme: () => undefined,
});

const readStoredColorScheme = (storageKey: string): AppColorScheme => {
    if (typeof window === 'undefined') return 'dark';
    try {
        return readUserScopedStorageItem(storageKey) === 'light' ? 'light' : 'dark';
    } catch {
        return 'dark';
    }
};

export const useAppThemeControls = (): AppThemeControls =>
    useContext(AppThemeControlsContext);

/**
 * The single application theme boundary.
 *
 * The app ships in Prisma/1CD dark mode by default. A page may explicitly opt
 * into a private light/dark choice without changing the Splunk shell or any
 * other dashboard. Keeping the resolved scheme here ensures SUI components,
 * portals, semantic utilities, and product-owned styled-components consume
 * one coherent theme.
 */
export default function AppThemeProvider({
    children,
    allowColorSchemeChoice = false,
    colorSchemeStorageKey = INSIGHTS_WORKSPACE_COLOR_SCHEME_STORAGE_KEY,
}: AppThemeProviderProps): JSX.Element {
    const scopedColorSchemeStorageKey = userScopedStorageKey(colorSchemeStorageKey);
    const [colorScheme, setColorSchemeState] = useState<AppColorScheme>(() =>
        allowColorSchemeChoice ? readStoredColorScheme(scopedColorSchemeStorageKey) : 'dark'
    );

    useEffect(() => {
        if (!allowColorSchemeChoice || typeof window === 'undefined') return undefined;
        const handleStorage = (event: StorageEvent) => {
            if (event.key === scopedColorSchemeStorageKey) {
                setColorSchemeState(readStoredColorScheme(scopedColorSchemeStorageKey));
            }
        };
        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, [allowColorSchemeChoice, scopedColorSchemeStorageKey]);

    const setColorScheme = useCallback(
        (next: AppColorScheme) => {
            if (!allowColorSchemeChoice) return;
            setColorSchemeState(next);
            try {
                window.localStorage.setItem(scopedColorSchemeStorageKey, next);
            } catch {
                // Storage is best effort in restricted or private browser contexts.
            }
        },
        [allowColorSchemeChoice, scopedColorSchemeStorageKey]
    );

    const controls = useMemo<AppThemeControls>(
        () => ({
            colorScheme,
            canChooseColorScheme: allowColorSchemeChoice,
            setColorScheme,
        }),
        [allowColorSchemeChoice, colorScheme, setColorScheme]
    );

    useEffect(() => {
        if (typeof document === 'undefined') return undefined;
        const mountRoot = document.getElementById('scan-root');
        if (!mountRoot) return undefined;

        mountRoot.dataset.appColorScheme = colorScheme;
        mountRoot.style.colorScheme = colorScheme;

        return () => {
            if (mountRoot.dataset.appColorScheme === colorScheme) {
                delete mountRoot.dataset.appColorScheme;
            }
            if (mountRoot.style.colorScheme === colorScheme) {
                mountRoot.style.removeProperty('color-scheme');
            }
        };
    }, [colorScheme]);

    return (
        <AppThemeControlsContext.Provider value={controls}>
            <SplunkThemeProvider
                family="prisma"
                colorScheme={colorScheme}
                density="comfortable"
                customizeTheme={unstable_splunk1cdThemeCustomizer}
            >
                <SemanticThemeStyles />
                {children}
            </SplunkThemeProvider>
        </AppThemeControlsContext.Provider>
    );
}
