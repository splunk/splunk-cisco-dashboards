import '@/common/shims/requirejs-emotion-shim';

import React from 'react';
import SplunkThemeProvider from '@splunk/themes/SplunkThemeProvider';
import mountPageRaw from '@/common/render-raw';
import MacroIndexTuningPage from './index';

import '@/common/styles/tailwind.css';

function MacroIndexTuningApp(): JSX.Element {
    return (
        <SplunkThemeProvider family="enterprise" colorScheme="light" density="comfortable">
            <MacroIndexTuningPage />
        </SplunkThemeProvider>
    );
}

mountPageRaw(MacroIndexTuningApp);
