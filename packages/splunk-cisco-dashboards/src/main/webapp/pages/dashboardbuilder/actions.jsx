import React from 'react';
import { createURL } from '@splunk/splunk-utils/url';
import { OpenSearchButton, RefreshButton } from '@splunk/dashboard-action-buttons';
//import InspectButton from './InspectButton';

import ExportButtonCustom from './ExportButton';

import { app } from '@splunk/splunk-utils/config';

function getCurrentApp() {
    return app || 'splunk-cisco-dashboards';
}

const handleOpenSearchClick = ({ options }) => {
    const params = { q: options.query, ...options.queryParameters };
    if (options.ref) {
        // param.s signify Search Title
        params.s = options.ref;
    }
    const searchUrl = createURL(`app/${encodeURIComponent(getCurrentApp())}/search`, params);
    window.open(searchUrl);
};

export const openSearchButton = (
    <OpenSearchButton
        key="openInSearch"
        screenReaderText="Search"
        onOpenSearchClick={handleOpenSearchClick}
    />
);
//export const inspectButton = <InspectButton key="openJobInspector" />;
export const exportButton = <ExportButtonCustom key="exportCustomButton" />;
export const refreshButton = <RefreshButton key="refreshButton" />;

export default [openSearchButton, exportButton, refreshButton];
