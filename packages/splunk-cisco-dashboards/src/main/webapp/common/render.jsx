import React from 'react';
import { createRoot } from 'react-dom/client';
import layout from '@splunk/react-page/18';
import CopyrightMark from './components/CopyrightMark';
import AppThemeProvider from './theme/AppThemeProvider';
import {
    APP_THEME_DENSITY,
    APP_THEME_FAMILY,
    resolveThemePreference,
} from './theme/themePreference';

/**
 * Shared mount helper used by every page entrypoint.
 *
 * Splunk Web boots dashboards via RequireJS, which can race against the
 * Simple XML <html> panel that owns `#scan-root`. We retry with a small
 * delay until the mount target exists.
 */
const MAX_RETRIES = 100;

export default function mountPage(PageComponent) {
    let reactRoot = null;
    let attempts = 0;

    const tryMount = () => {
        const el = document.getElementById('scan-root');
        if (!el) {
            attempts += 1;
            if (attempts >= MAX_RETRIES) {
                // Stop quietly if the panel was removed; avoid log spam.
                return;
            }
            setTimeout(tryMount, 50);
            return;
        }
        if (!reactRoot) {
            reactRoot = createRoot(el);
        }
        reactRoot.render(
            <AppThemeProvider>
                <>
                    <PageComponent />
                    <CopyrightMark />
                </>
            </AppThemeProvider>
        );
    };

    tryMount();
}

export function renderAsPage(pageElement, options = {}) {
    const {
        hideAppBar = false,
        navLayout = 'auto',
        pageTitle,
        ...layoutOptions
    } = options;

    resolveThemePreference()
        .then((colorScheme) => {
            const theme = colorScheme;

            layout(
                <AppThemeProvider initialColorScheme={colorScheme}>
                    <>
                        {pageElement}
                        <CopyrightMark />
                    </>
                </AppThemeProvider>,
                {
                    ...layoutOptions,
                    hideAppBar,
                    navLayout,
                    pageTitle,
                    theme,
                    themeDensity: APP_THEME_DENSITY,
                    themeFamily: APP_THEME_FAMILY,
                }
            );
        })
        .catch((e) => {
            const errorEl = document.createElement('span');
            errorEl.textContent = e instanceof Error ? e.message : String(e);
            document.body.appendChild(errorEl);
        });
}
