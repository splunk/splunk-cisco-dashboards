import React from 'react';
import PropTypes from 'prop-types';
import Button from '@splunk/react-ui/Button';
import InformationCircle from '@splunk/react-icons/InformationCircle';
import MagnifierWithPlus from '@splunk/react-icons/MagnifierWithPlus';
import SplunkVisualization from '@splunk/visualizations/common/SplunkVisualization';
import withDashboardViz from '@splunk/visualizations/common/withDashboardViz';
import styled from 'styled-components';

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

const DrilldownActionViz = ({ action, label, onImageClick }) => {
    const isMetricInfo = action === DASHBOARD_ACTION_KIND_METRIC_INFO;

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
                icon={
                    isMetricInfo ? (
                        <InformationCircle height={22} width={22} />
                    ) : (
                        <MagnifierWithPlus height={24} width={24} />
                    )
                }
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
    ]),
    label: PropTypes.string,
    onImageClick: PropTypes.func,
};

DrilldownActionViz.defaultProps = {
    ...SplunkVisualization.defaults,
    action: DASHBOARD_ACTION_KIND_DRILLDOWN,
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
