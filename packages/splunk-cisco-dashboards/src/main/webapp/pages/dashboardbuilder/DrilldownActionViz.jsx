import React from 'react';
import PropTypes from 'prop-types';
import Button from '@splunk/react-ui/Button';
import MagnifierWithPlus from '@splunk/react-icons/MagnifierWithPlus';
import SplunkVisualization from '@splunk/visualizations/common/SplunkVisualization';
import withDashboardViz from '@splunk/visualizations/common/withDashboardViz';
import styled from 'styled-components';

import {
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

const DrilldownActionViz = ({ label, onImageClick }) => (
    <ActionContainer>
        <ActionButton
            appearance="default"
            data-test="dashboard-drilldown-action"
            hideLabel
            icon={<MagnifierWithPlus height={24} width={24} />}
            label={label}
            onClick={onImageClick}
        />
    </ActionContainer>
);

DrilldownActionViz.propTypes = {
    ...SplunkVisualization.propTypes,
    label: PropTypes.string,
    onImageClick: PropTypes.func,
};

DrilldownActionViz.defaultProps = {
    ...SplunkVisualization.defaults,
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
