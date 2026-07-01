/* eslint-disable react/jsx-filename-extension */
import '@/common/shims/requirejs-emotion-shim';

import React from 'react';
import SplunkThemeProvider from '@splunk/themes/SplunkThemeProvider';
import mountPageRaw from '@/common/render-raw';
import UserGuidePage from './index';

import '@/common/styles/tailwind.css';

function UserGuideApp(): JSX.Element {
    return (
        <SplunkThemeProvider family="enterprise" colorScheme="light" density="comfortable">
            <UserGuidePage />
        </SplunkThemeProvider>
    );
}

mountPageRaw(UserGuideApp);
