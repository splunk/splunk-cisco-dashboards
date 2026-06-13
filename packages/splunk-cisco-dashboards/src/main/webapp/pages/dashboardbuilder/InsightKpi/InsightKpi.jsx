import React, { useEffect, useState, memo } from 'react';
import SingleValue from '@splunk/visualizations/SingleValue';

// data source to use when there is no data
const noDataDs = {
    data: {
        fields: [{ name: 'current_count' }],
        columns: [[0]],
    },
};

// default options for single value viz
const singleValueOptions = {
    majorFontSize: 42,
    trendFontSize: 20,
    sparklineDisplay: 'off',
    shouldAbbreviateTrendValue: true,
    numberPrecision: '> majorValue | matchValue(numberPrecisionConfig, 1)',
};

/**
 * This component renders the key indicator as SingleValue viz using provided data source.
 *
 * @param {object} props
 * @param {object} props.dataSource - data source to get data from
 *
 * @returns react component
 */
const InsightKpi = (props) => {
    const { dataSource, mode, drilldownAutoPause } = props;
    const [isModelExists, setIsModelExists] = useState(null);

    // drilldown handler
    const handleValueClick = ({ type }) => {
        if (type === 'value.click') {
            //const drilldownURI = makeDrilldownURI(kiOptions.drilldown_uri, drilldownAutoPause);
            //window.open(drilldownURI, '_blank');
            console.log('DrillDown clicked');
        }
    };

    // props to use with single value viz
    const singleValueProps = {
        hasEventHandlers: true,
        mode: mode,
        //context: getKeyIndicatorContext(kiOptions),
        height: '60px',
        options: { ...singleValueOptions },
        // use noDataDs initially
        dataSources: {
            primary: noDataDs,
        },
    };

    // attach click handler if uri exists
    /*if (kiOptions.drilldown_uri) {
        singleValueProps.onEventTrigger = (ev) => handleValueClick(ev);
    }*/

    // use actual data source if data is available
    if (Array.isArray(dataSource?.data?.columns) && dataSource.data.columns.length) {
        singleValueProps.dataSources = {
            primary: dataSource,
        };
    }

    // process data source and prepare options for SingleValue viz
    const computedOptions = {}; //getKeyIndicatorOptions(kiOptions, dataSource);
    singleValueProps.options = { ...singleValueOptions, ...computedOptions };

    return (
        <div>
            {!dataSource?.error && !dataSource?.data ? (
                // show wait spinner when data is loading
                <div>loading</div>
            ) : (
                <SingleValueContainer>
                    {isModelExists === false || !dataSource?.error ? (
                        <SingleValue data-test="key-indicator-sv" {...singleValueProps} />
                    ) : (
                        <div>ERROR</div>
                    )}
                </SingleValueContainer>
            )}
        </div>
    );
};

InsightKpi.defaultProps = {
    dataSource: {},
    mode: 'view',
};

export default memo(InsightKpi, (prevProps, nextProps) => {
    return JSON.stringify(prevProps) === JSON.stringify(nextProps);
});
