import React from 'react';
import { createRoot } from 'react-dom/client';
import { SplunkThemeProvider } from '@splunk/themes';
import layout from '@splunk/react-page/18';
import { getUserTheme } from '@splunk/splunk-utils/themes';
import CopyrightMark from './components/CopyrightMark';

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
            <SplunkThemeProvider family="prisma" colorScheme="light" density="comfortable">
                <>
                    <PageComponent />
                    <CopyrightMark />
                </>
            </SplunkThemeProvider>
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

    getUserTheme()
        .then((theme) => {
            const colorScheme = theme === 'dark' ? 'dark' : 'light';

            layout(
                <SplunkThemeProvider
                    family="prisma"
                    colorScheme={colorScheme}
                    density="comfortable"
                >
                    <>
                        {pageElement}
                        <CopyrightMark />
                    </>
                </SplunkThemeProvider>,
                {
                    ...layoutOptions,
                    hideAppBar,
                    navLayout,
                    pageTitle,
                    theme,
                    themeDensity: 'comfortable',
                    themeFamily: 'prisma',
                }
            );
        })
        .catch((e) => {
            const errorEl = document.createElement('span');
            errorEl.textContent = e instanceof Error ? e.message : String(e);
            document.body.appendChild(errorEl);
        });
}
