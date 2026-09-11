import React from 'react';
import { createRoot } from 'react-dom/client';
import layout from '@splunk/react-page/18';
import AppThemeProvider from './theme/AppThemeProvider';

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
                <PageComponent />
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

    layout(
        <AppThemeProvider>
            {pageElement}
        </AppThemeProvider>,
        {
            ...layoutOptions,
            hideAppBar,
            navLayout,
            pageTitle,
            theme: 'dark',
            themeDensity: 'comfortable',
            themeFamily: 'prisma',
        }
    );
}
