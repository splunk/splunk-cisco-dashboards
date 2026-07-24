import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import CopyrightMark from '@/common/components/CopyrightMark';

/**
 * Raw mount helper — same retry semantics as `common/render.jsx` but
 * without `SplunkThemeProvider`. Used by dashboards that own their
 * full visual style via Tailwind / custom CSS (e.g. the Florida
 * Executive design) and don't need Splunk's Prisma theme tokens.
 */
const MAX_RETRIES = 100;

export default function mountPageRaw(PageComponent: React.ComponentType): void {
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
                <>
                    <PageComponent />
                    <CopyrightMark />
                </>
            </React.StrictMode>
        );
    };

    tryMount();
}
