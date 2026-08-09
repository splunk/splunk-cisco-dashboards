import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import CopyrightMark from '@/common/components/CopyrightMark';
import AppThemeProvider from '@/common/theme/AppThemeProvider';
import type { ResolvedTheme } from '@/common/theme/themePreference';
import '@/common/styles/splunkShellTheme.css';

/**
 * Mount helper for custom dashboard surfaces. These pages may own their
 * layout and visualization styling, but still receive the same Splunk-aware
 * theme provider and semantic token bridge as standard SUI pages.
 */
const MAX_RETRIES = 100;

interface MountPageRawOptions {
    fixedColorScheme?: ResolvedTheme;
}

export default function mountPageRaw(
    PageComponent: React.ComponentType,
    options: MountPageRawOptions = {}
): void {
    let reactRoot: Root | null = null;
    let attempts = 0;

    const tryMount = (): void => {
        const el = document.getElementById('scan-root');
        if (!el) {
            attempts += 1;
            if (attempts >= MAX_RETRIES) {
                return;
            }
            window.setTimeout(tryMount, 50);
            return;
        }
        if (!reactRoot) {
            reactRoot = createRoot(el);
        }
        reactRoot.render(
            <React.StrictMode>
                <AppThemeProvider fixedColorScheme={options.fixedColorScheme}>
                    <>
                        <PageComponent />
                        <CopyrightMark />
                    </>
                </AppThemeProvider>
            </React.StrictMode>
        );
    };

    tryMount();
}
