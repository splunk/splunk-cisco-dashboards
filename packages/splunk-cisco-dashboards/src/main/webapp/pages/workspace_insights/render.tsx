// Install compatibility before the Layout API can start the C3 header.
import '@/common/shims/requirejs-emotion-shim';

import React from 'react';
import layout from '@splunk/react-page/18';
import AppThemeProvider from '@/common/theme/AppThemeProvider';
import ExecutiveInsightsPage from '../executive_insights';
import '@/common/styles/tailwind.css';

layout(
    <AppThemeProvider allowColorSchemeChoice>
        <div id="main" tabIndex={-1}>
            <div id="scan-root">
                <ExecutiveInsightsPage />
            </div>
        </div>
    </AppThemeProvider>,
    {
        pageTitle: 'SSNE | Insights Workspace',
        navLayout: 'auto',
        hideAppBar: false,
        theme: 'dark',
        themeDensity: 'comfortable',
        themeFamily: 'prisma',
    },
);
