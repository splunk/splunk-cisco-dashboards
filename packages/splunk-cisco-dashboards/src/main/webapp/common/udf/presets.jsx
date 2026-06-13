import React from 'react';

import EnterpriseViewOnlyPreset from '@splunk/dashboard-presets/EnterpriseViewOnlyPreset';

import {
    CloneButton,
    DeleteButton,
    FullscreenButton,
    RefreshButton,
    ExportButton,
    LayerButton,
} from '@splunk/dashboard-action-buttons';
import CustomOpenSearch from '../../pages/dashboardbuilder/CustomOpenSearch';

const actionMenus = {
    view: [
        <CustomOpenSearch key="open" />,
        <FullscreenButton key="fullscreen" />,
        <ExportButton key="export" />,
        <RefreshButton key="refresh" />,
    ],
    edit: [
        <LayerButton key="layers" />,
        <CloneButton key="clone" />,
        <DeleteButton key="delete" />,
    ],
};

const PresetWithIndicatorViz = {
    ...EnterpriseViewOnlyPreset,
    visualizations: {
        ...EnterpriseViewOnlyPreset.visualizations,
    },
};

export { PresetWithIndicatorViz, actionMenus };
