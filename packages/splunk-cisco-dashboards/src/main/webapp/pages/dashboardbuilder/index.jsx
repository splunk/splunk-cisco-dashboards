import React from 'react';

import DashboardStudioEditor from './DashboardStudioEditor';
import { initialDefinition } from './DashboardStudioEditor';
import {
    Route,
    RouterProvider,
    createHashRouter,
    createRoutesFromElements,
} from 'react-router-dom';
import { Outlet } from 'react-router-dom';
import SearchBaseDataSource from './SearchBaseDataSource';
import EnterprisePreset from '@splunk/dashboard-presets/EnterprisePreset';
import { renderAsPage } from '../../common/render';
import SimpleTimePicker from './custominput/SimpleTimePicker';
import VizKpi from '../../common/components/templatewizard/viz-kpi/VizKpi';
import VizOther from '../../common/components/templatewizard/viz-other/VizOther';
import { actionMenus } from '../../common/udf/presets';
import DBHomePage from './DBHomePage';

const router = createHashRouter(
    //<Route path="/:dashboardid/:currentmode" element={<DashbiardStudioEditor />} />
    createRoutesFromElements([
        <Route path="/" element={<Outlet />}>
            {/*
            <Route path="/" element={<DashboardStudioEditorPage />} />
            */}
            <Route path="/" element={<DBHomePage />} />
            <Route path="/:dashboardid" element={<DashboardStudioEditorPage />} />
            <Route path="/:dashboardid/:currentmode" element={<DashboardStudioEditorPage />} />
        </Route>,
    ]),
);

function CustomDSEditorPage() {
    return (
        <RouterProvider router={router}>
            <Outlet />
        </RouterProvider>
    );
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
renderAsPage(<CustomDSEditorPage />);
