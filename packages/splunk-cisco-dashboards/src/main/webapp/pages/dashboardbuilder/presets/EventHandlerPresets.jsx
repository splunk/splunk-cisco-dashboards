import EnterprisePreset from '@splunk/dashboard-presets/EnterprisePreset';

import InsightKpiViz from '../InsightKpi/InsightKpiViz';

const overrideRequestCount = (component, newCount) => {
    Object.keys(component?.config?.dataContract?.initialRequestParams ?? {}).forEach(
        (bindingType) => {
            component.config.dataContract.initialRequestParams[bindingType].count = newCount;
        }
    );

    return component;
};

const EventHandlerPresets = (workFlowActions = null) => {
    return {
        ...EnterprisePreset,
        eventHandlers: {
            ...EnterprisePreset.eventHandlers,
            /*'drilldown.declarativeHandler': (...args) => {
                return new DeclarativeEventHandler(...args, workFlowActions);
            },*/
        },

        visualizations: {
            ...EnterprisePreset.visualizations,
            'custom.insightKpi': InsightKpiViz,
            //'custom.perPanelFilter': PerPanelFilter,
            //'custom.essConfigHealthIntro': ESSConfigHealthIntro,
        },
    };
};

export default EventHandlerPresets;
