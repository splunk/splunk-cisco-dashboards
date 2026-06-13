import React, { useEffect, useState, memo } from 'react';
import PropTypes from 'prop-types';
import { _ } from '@splunk/ui-utils/i18n';
import SplunkVisualization from '@splunk/visualizations/common/SplunkVisualization';
import { SingleValue as SingleValueIcon } from '@splunk/visualization-icons';
import Card from '@splunk/react-ui/Card';
import { isEqual, reduce, intersection } from 'lodash-es';
import DOMPurify from 'dompurify';
import ColumnLayout from '@splunk/react-ui/ColumnLayout';

const containerStyle = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
};

const titleStyle = {
    height: '50px',
    textAlign: 'center',
    lineHeight: '50px',
    fontWeight: 'bold',
};

const pictureStyle = {
    flex: 3,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
};

const descriptionStyle = {
    flex: 1,
    overflowY: 'auto',
    padding: '10px',
    boxSizing: 'border-box',
};

const InsightKpiViz = (props) => {
    const { options, title, dataSources, mode } = props;

    const sanitizedDescription = DOMPurify.sanitize(options.description, {
        USE_PROFILES: { html: true },
    });

    return (
        <div style={{ ...containerStyle, background: options.background }}>
            <div style={{ ...titleStyle, color: options.titleColor }}>{options.title}</div>
            <div style={pictureStyle}>Picture</div>
            <div
                style={descriptionStyle}
                dangerouslySetInnerHTML={{ __html: sanitizedDescription }}
            />
        </div>
    );
};

InsightKpiViz.propTypes = {
    ...SplunkVisualization.propTypes,
    options: PropTypes.shape({
        groupName: PropTypes.string,
        kis: PropTypes.arrayOf(
            PropTypes.shape({
                title: PropTypes.string,
                subtitle: PropTypes.string,
                drilldownUri: PropTypes.string,
            })
        ),
    }),
};

InsightKpiViz.defaultProps = {
    ...SplunkVisualization.defaultProps,
    title: 'Key indicators',
};

/**
 * data contract for this visualization
 */
InsightKpiViz.dataContract = {
    // required data sources
    requiredDataSources: [], // requires multiple dataSources based on number of key indicators
    // initial requestParams for each data sources
    initialRequestParams: {
        // primary: {
        //     offset: 0,
        //     count: 50,
        // },
    },
};

/**
 * visualization descriptor
 */
InsightKpiViz.config = {
    dataContract: {},
    editorConfig: [],
    optionsSchema: {},
    key: 'custom.insightKpi',
    name: 'Insight KPI',
    icon: SingleValueIcon,
    category: 'misc',
};

export default memo(InsightKpiViz, (prev, current) => {
    const propsUsed = ['options', 'title', 'dataSources', 'mode'];
    const changedPropNames = reduce(
        prev,
        function (result, value, key) {
            return isEqual(value, current[key]) ? result : result.concat(key);
        },
        []
    );
    return !intersection(propsUsed, changedPropNames).length;
});
