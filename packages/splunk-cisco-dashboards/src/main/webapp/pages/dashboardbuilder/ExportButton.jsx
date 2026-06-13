import React from 'react';
import PropTypes from 'prop-types';
import { ExportButton } from '@splunk/dashboard-action-buttons';

/**
 * Custom Export Button
 * Export functionality have 2 options, CSV and PNG. Key indicators viz do not have primary data source
 * so export to CSV would not work. There is no way to define the export type based on different viz type,
 * so we are not showing export button for key indicators viz.
 *
 * @param {object} props
 * @param {object} props.visualization - viz definition
 * @param {object} props.visualization.type - type of viz
 * @returns react component or null
 */
const ExportButtonCustom = (props) => {
    const { visualization } = props;
    if (visualization?.type === 'custom.insightKpi') {
        // avoid showing Export action button for insightKpi
        return null;
    }
    return <ExportButton key="exportButton" {...props} />;
};

ExportButtonCustom.propTypes = {
    visualization: PropTypes.shape({
        type: PropTypes.string,
    }),
};

export default ExportButtonCustom;
