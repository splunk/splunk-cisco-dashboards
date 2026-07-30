import React from 'react';

import EnterprisePreset from '@splunk/dashboard-presets/EnterprisePreset';
import {
    Route,
    RouterProvider,
    createHashRouter,
    createRoutesFromElements,
} from 'react-router-dom';

import '../../common/shims/requirejs-emotion-shim';
import VizKpi from '../../common/components/templatewizard/viz-kpi/VizKpi';
import VizOther from '../../common/components/templatewizard/viz-other/VizOther';
import mountPage from '../../common/render';
import { actionMenus } from '../../common/udf/presets';
import DBHomePage from './DBHomePage';
import DashboardStudioEditor, { initialDefinition } from './DashboardStudioEditor';
import './dashboardbuilder-shell.css';
import SearchBaseDataSource from './SearchBaseDataSource';
import SpaceManagerViz from './SpaceManager/SpaceManagerViz';
import SimpleTimePicker from './custominput/SimpleTimePicker';

const router = createHashRouter(
    createRoutesFromElements([
        <Route index element={<DBHomePage />} />,
        <Route path=":dashboardid" element={<DashboardStudioEditorPage />} />,
        <Route path=":dashboardid/:currentmode" element={<DashboardStudioEditorPage />} />,
    ]),
);

function CustomDSEditorPage() {
    return <RouterProvider router={router} />;
}

const customPresets = {
    ...EnterprisePreset,
    dataSources: {
        ...EnterprisePreset.dataSources,
        'ds.searchbase': SearchBaseDataSource,
    },
    inputs: {
        ...EnterprisePreset.inputs,
        'input.simpleTimePicker': SimpleTimePicker,
    },
    visualizations: {
        ...EnterprisePreset.visualizations,
        'splunk.template_kpi': VizKpi,
        'splunk.template_other': VizOther,
        'splunk.cisco_spaces_space_manager': SpaceManagerViz,
    },
};

function DashboardStudioEditorPage() {
    return (
        <DashboardStudioEditor
            definition={initialDefinition}
            pageName="Cisco Dashboard Builder"
            actionMenus={actionMenus}
            preset={customPresets}
        />
    );
}

mountPage(CustomDSEditorPage);
