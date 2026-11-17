import React from 'react';
import PropTypes from 'prop-types';
import Button from '@splunk/react-ui/Button';
import InformationCircle from '@splunk/react-icons/InformationCircle';
import { useDashboardApi } from '@splunk/dashboard-context';
import MagnifierWithPlus from '@splunk/react-icons/MagnifierWithPlus';
import SplunkVisualization from '@splunk/visualizations/common/SplunkVisualization';
import withDashboardViz from '@splunk/visualizations/common/withDashboardViz';
import styled from 'styled-components';

import { PanelRightOpen } from '../../common/icons/SuiIcon';
import CustomOpenSearch from './CustomOpenSearch';

import {
    DASHBOARD_ACTION_KIND_DRILLDOWN,
    DASHBOARD_ACTION_KIND_METRIC_INFO,
    DASHBOARD_DRILLDOWN_ACCESSIBLE_TITLE,
    DASHBOARD_DRILLDOWN_ACTION_TYPE,
} from '../../common/lib/dashboardDrilldown';

const ActionContainer = styled.div`
    align-items: center;
    display: flex;
    height: 100%;
    justify-content: center;
    width: 100%;
`;

const ActionButton = styled(Button)`
    && {
        border-radius: 50%;
        height: 36px;
        margin: 0;
        min-width: 36px;
        padding: 0;
        width: 36px;
    }
`;

const OpenSearchAction = ({ targetVisualization, label }) => {
    const dashboardApi = useDashboardApi();
    const definition = dashboardApi.getDefinition();
    const itemDefinition = definition.visualizations?.[targetVisualization];
    if (!itemDefinition?.dataSources?.primary) {
        return null;
    }
    return <CustomOpenSearch standalone label={label} itemId={targetVisualization} dashboardApi={dashboardApi}
        itemDefinition={itemDefinition} dataSources={definition.dataSources || {}} />;
};
OpenSearchAction.propTypes = { targetVisualization: PropTypes.string.isRequired, label: PropTypes.string.isRequired };

const DrilldownActionViz = ({ action, label, iconStyle, targetVisualization, onImageClick }) => {
    const isMetricInfo = action === DASHBOARD_ACTION_KIND_METRIC_INFO;

    if (action === 'open-search') {
        return <ActionContainer><OpenSearchAction targetVisualization={targetVisualization} label={label} /></ActionContainer>;
    }
    let icon = <MagnifierWithPlus height={24} width={24} />;
    if (isMetricInfo) {
        icon = <InformationCircle height={22} width={22} />;
    } else if (iconStyle === 'panel') {
        icon = <PanelRightOpen aria-hidden="true" />;
    }

    return (
        <ActionContainer>
            <ActionButton
                appearance="default"
                data-test={
                    isMetricInfo
                        ? 'dashboard-metric-info-action'
                        : 'dashboard-drilldown-action'
                }
                hideLabel
                icon={icon}
                label={label}
                onClick={onImageClick}
            />
        </ActionContainer>
    );
};

DrilldownActionViz.propTypes = {
    ...SplunkVisualization.propTypes,
    action: PropTypes.oneOf([
        DASHBOARD_ACTION_KIND_DRILLDOWN,
        DASHBOARD_ACTION_KIND_METRIC_INFO,
        'open-search',
    ]),
    iconStyle: PropTypes.oneOf(['default', 'panel']),
    targetVisualization: PropTypes.string,
    label: PropTypes.string,
    onImageClick: PropTypes.func,
};

DrilldownActionViz.defaultProps = {
    ...SplunkVisualization.defaults,
    action: DASHBOARD_ACTION_KIND_DRILLDOWN,
    iconStyle: 'default',
    targetVisualization: '',
    label: DASHBOARD_DRILLDOWN_ACCESSIBLE_TITLE,
    onImageClick: () => {},
};

const dataContract = {
    requiredDataSources: [],
    initialRequestParams: {},
};

const vizConfig = {
    key: DASHBOARD_DRILLDOWN_ACTION_TYPE,
    name: 'Dashboard drill-down action',
    category: 'misc',
    icon: MagnifierWithPlus,
    dataContract,
    size: {
        initialWidth: 42,
        initialHeight: 42,
    },
    defaultContext: {},
    optionsSchema: {
        iconStyle: { type: 'string', default: 'default' },
        targetVisualization: { type: 'string', default: '' },
        action: {
            type: 'string',
            default: DASHBOARD_ACTION_KIND_DRILLDOWN,
        },
        label: {
            type: 'string',
            default: DASHBOARD_DRILLDOWN_ACCESSIBLE_TITLE,
        },
    },
    editorConfig: [],
    supports: ['events'],
    themes: {},
    events: {
        'image.click': {
            description: 'Triggered when the user opens drill-down details',
        },
    },
};

export default withDashboardViz({
    ReactViz: DrilldownActionViz,
    vizConfig,
});
