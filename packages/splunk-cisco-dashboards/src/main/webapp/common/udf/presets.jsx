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
import { InspectPanelAction, AddToCanvasPanelAction } from '../../pages/dashboardbuilder/StudioPanelActions';

const actionMenus = {
    view: [
        <CustomOpenSearch key="open" />,
        <InspectPanelAction key="inspect" />,
        <FullscreenButton key="fullscreen" />,
        <RefreshButton key="refresh" />,
        <AddToCanvasPanelAction key="add-to-ai-canvas" />,
        <ExportButton key="export" />,
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
