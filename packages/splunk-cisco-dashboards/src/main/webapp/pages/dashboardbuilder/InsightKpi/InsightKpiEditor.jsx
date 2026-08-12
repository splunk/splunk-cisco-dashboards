import React, { useCallback, useEffect, useState, memo, useContext } from 'react';
import PropTypes from 'prop-types';

import { _ } from '@splunk/ui-utils/i18n';
import Text from '@splunk/react-ui/Text';
import { DashboardApiContext } from '@splunk/dashboard-context';
import { DashboardDefinition } from '@splunk/dashboard-definition';
import { Separator } from '@splunk/dashboard-ui';

import { StyledControlGroup, EditorErrorMessage } from './InsightKpiStyles';
import { getSearches } from '../../../common/lib/searchbase';
import Select from '@splunk/react-ui/Select';
import CollapsiblePanel from '@splunk/react-ui/CollapsiblePanel';
import Switch from '@splunk/react-ui/Switch';
import Color from '@splunk/react-ui/Color';
import Number from '@splunk/react-ui/Number';
import SplunkThemeProvider from '@splunk/themes/SplunkThemeProvider';
import ChartArea from '@splunk/react-icons/ChartArea';
import ChartBar from '@splunk/react-icons/ChartBar';
import ChartBubble from '@splunk/react-icons/ChartBubble';
import ChartColumn from '@splunk/react-icons/ChartColumn';
import ChartLine from '@splunk/react-icons/ChartLine';
import ChartPie from '@splunk/react-icons/ChartPie';
import ChartScatter from '@splunk/react-icons/ChartScatter';

const prismaIconProps = {
    height: 20,
    width: 20,
};

const iconMap = {
    'Area chart': <ChartArea {...prismaIconProps} />,
    'Bar chart': <ChartBar {...prismaIconProps} />,
    'Bubble chart': <ChartBubble {...prismaIconProps} />,
    'Column chart': <ChartColumn {...prismaIconProps} />,
    'Line chart': <ChartLine {...prismaIconProps} />,
    'Pie chart': <ChartPie {...prismaIconProps} />,
    'Scatter chart': <ChartScatter {...prismaIconProps} />,
};

const modules = {
    toolbar: [
        [{ header: [1, 2, false] }],
        ['bold', 'italic', 'underline'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['undo', 'redo'], // Optional if using custom toolbar
    ],
    history: {
        delay: 1000, // Time in ms before stacking changes
        maxStack: 50, // Maximum undo stack size
        userOnly: true, // Only track user changes, not API calls
    },
};

const InsightKpiEditor = (props) => {
    const {
        visualization = {},
        visualization: { options: vizOptions = {} },
        onOptionsChange,
        onVisualizationChange,
    } = props;

    const dashboardApi = useContext(DashboardApiContext);
    const [keyIndicatorSearches, setKeyIndicatorSearches] = useState([]);
    const [groupName, setGroupName] = useState(vizOptions.groupName || '');
    const [groupNameTextInput, setGroupNameTextInput] = useState(vizOptions.groupName || '');
    const [removedKis, setRemovedKis] = useState([]);
    const [groupNameTextInputError, setGroupNameTextInputError] = useState(
        vizOptions.groupName === ''
    );

    const [showTitle, setShowTitle] = useState(true);
    const [showDescription, setShowDescription] = useState(true);
    const [kpiTitle, setKpiTitle] = useState('');
    const [kpiDescription, setKpiDescription] = useState('');
    const [bgColor, setBgColor] = useState('#ffffff');
    const [titleColor, setTitleColor] = useState('#000000');
    const [borderColor, setBorderColor] = useState('#ffffff');
    const [borderSize, setBorderSize] = useState(0);
    const [vizType, setVizType] = useState('Chart3');

    // get all searches
    const [searches, setSearches] = useState([]);
    const [selectedKpi, setSelectedKpi] = useState();

    useEffect(() => {
        onVisualizationChange({
            ...visualization,
            options: {
                ...vizOptions,
                showTitle: showTitle,
                showDescription: showDescription,
                title: kpiTitle,
                description: kpiDescription,
                background: bgColor,
                titleColor: titleColor,
                borderColor: borderColor,
                borderSize: borderSize,
                vizType: vizType,
            },
        });
    }, [
        showTitle,
        showDescription,
        kpiTitle,
        kpiDescription,
        bgColor,
        titleColor,
        borderColor,
        borderSize,
        vizType,
    ]);
    useEffect(() => {
        if (searches.length == 0) {
            const getSearchesList = async () => {
                const data = await getSearches();
                setSearches(data.entry);
            };
            getSearchesList();
        }
    }, []);

    // function to signal visualization update
    const triggerVisualizationChange = (options) => {
        // Use DashboardAPI to get the definition as JSON
        const jsonDef = dashboardApi.getDefinition();
        // Use the DashboardDefinition class from `@splunk/dashboard-definition`
        // to parse the JSON definition and expose utilities for definition manipulation
        const dashboardDefinition = DashboardDefinition.fromJSON(jsonDef);
        const { dataSources } = visualization;
        // prepare updated viz definition
        const vizDefinition = {
            ...visualization,
            dataSources: visualization.dataSources,
            options: {
                ...vizOptions,
                ...options,
            },
        };
        // update the viz definition
        dashboardDefinition.updateVisualization('viz_keyIndicators', vizDefinition);

        // handle data source bindings which would be needed for the new kis so when the viz
        // is mounted it doesn't need to connect anything/change the dashboard definition
        const unboundKIs = options.kis.filter((kiOptions) => !dataSources[kiOptions.dataSourceKey]);
        if (unboundKIs.length) {
            unboundKIs.forEach((kiOptions) => {
                dashboardDefinition.connectNewDataSourceToItem({
                    itemId: 'viz_keyIndicators',
                    dataSourceType: kiOptions.dataSourceKey,
                    dataSourceDefinition: {
                        type: 'ds.savedSearch',
                        options: {
                            query: `| savedsearch "${kiOptions.name}"`,
                            ref: kiOptions.name,
                        },
                        name: kiOptions.name,
                    },
                });
            });
        }
        // trigger change
        dashboardApi.updateDefinition(dashboardDefinition.toJSON());
    };

    const handleKpiSelectChange = (e, { value }) => {
        if (value != selectedKpi) {
            var currKpi = searches.find((s) => s.name == value);
            if (currKpi) {
                setSelectedKpi((prev) => value);
                setKpiDescription(currKpi.content.description);
                setKpiTitle(currKpi.content.search_name);
            }
        }
    };

    // function to handle blur event of group name text input
    const handleGroupNameInputBlur = async () => {};

    // function to handle change event of group name text input
    const handleGroupNameInputChange = (e, { value }) => {
        setGroupNameTextInput(value);
        setGroupNameTextInputError(value === '');
    };

    return (
        <React.Fragment key="InsightKpiEditor">
            <StyledControlGroup
                label={_('Group Name')}
                labelPosition="top"
                controlsLayout="fillJoin"
            >
                <Text
                    canClear
                    value={groupNameTextInput}
                    onChange={handleGroupNameInputChange}
                    onBlur={handleGroupNameInputBlur}
                    data-test="group-name-text-input"
                    error={groupNameTextInputError}
                />
            </StyledControlGroup>
            {groupNameTextInputError && (
                <EditorErrorMessage type="error" data-test="group-name-error">
                    {_('Empty group name is not allowed')}
                </EditorErrorMessage>
            )}
            <CollapsiblePanel title="Data source">
                <StyledControlGroup
                    label={'Cisco KPIs'}
                    labelPosition="top"
                    controlsLayout="fillJoin"
                >
                    <Select
                        values={selectedKpi}
                        onChange={handleKpiSelectChange}
                        inline
                        filter
                        error={!selectedKpi}
                    >
                        {searches
                            .filter((s) => s.content.search_type == 'display')
                            .map((search) => (
                                <Select.Option
                                    truncate
                                    key={search.name}
                                    label={search.content.search_name}
                                    value={search.name}
                                />
                            ))}
                    </Select>
                </StyledControlGroup>
            </CollapsiblePanel>
            <CollapsiblePanel title="Data display">
                <StyledControlGroup
                    label={'Visualization type'}
                    labelPosition="top"
                    controlsLayout="fillJoin"
                >
                    <Select
                        value={vizType}
                        onChange={(e, { value: key }) => {
                            setVizType(key);
                        }}
                        disabled={selectedKpi == undefined}
                    >
                        <Select.Option
                            label="Area chart"
                            icon={iconMap['Area chart']}
                            value="Chart1"
                        />
                        <Select.Option
                            label="Bar chart"
                            icon={iconMap['Bar chart']}
                            value="Chart2"
                        />
                        <Select.Option
                            label="Bubble chart"
                            icon={iconMap['Bubble chart']}
                            value="Chart3"
                        />
                        <Select.Option
                            label="Column chart"
                            icon={iconMap['Column chart']}
                            value="Chart4"
                        />
                        <Select.Option
                            label="Line chart"
                            icon={iconMap['Line chart']}
                            value="Chart5"
                        />
                        <Select.Option
                            label="Pie chart"
                            icon={iconMap['Pie chart']}
                            value="Chart6"
                        />
                        <Select.Option
                            label="Scatter chart"
                            icon={iconMap['Scatter chart']}
                            value="Chart7"
                        />
                    </Select>
                </StyledControlGroup>
                <div style={{ padding: '15px' }}>
                    <Switch
                        appearance="checkbox"
                        selected={showTitle}
                        onClick={() => setShowTitle(!showTitle)}
                        disabled={selectedKpi == undefined}
                    >
                        Show Title
                    </Switch>
                    {showTitle && (
                        <Text
                            value={kpiTitle}
                            onChange={(e) => setKpiTitle(e.target.value)}
                            disabled={selectedKpi == undefined}
                        />
                    )}
                    <Switch
                        appearance="checkbox"
                        selected={showDescription}
                        onClick={() => setShowDescription(!showDescription)}
                        disabled={selectedKpi == undefined}
                    >
                        Show Description
                    </Switch>
                    {/* TC - 3-3-2025 - Disabled this section due to vulnerability with Quill */}
                    {/* {showDescription && (
                        <ReactQuill
                            theme="snow"
                            value={kpiDescription}
                            onChange={setKpiDescription}
                            modules={modules}
                            style={{ maxHeight: '300px' }}
                        />
                    )} */}
                </div>
            </CollapsiblePanel>
            <CollapsiblePanel title="Color and style">
                <SplunkThemeProvider density="compact">
                    <StyledControlGroup
                        label="Title Color"
                        labelPosition="top"
                        controlsLayout="fillJoin"
                    >
                        <Color
                            value={titleColor}
                            onChange={({ value }) => {
                                setTitleColor(value);
                            }}
                            disabled={selectedKpi == undefined}
                        />
                    </StyledControlGroup>
                    <StyledControlGroup
                        label="Background Color"
                        labelPosition="top"
                        controlsLayout="fillJoin"
                    >
                        <Color
                            value={bgColor}
                            onChange={({ value }) => {
                                setBgColor(value);
                            }}
                            disabled={selectedKpi == undefined}
                        />
                    </StyledControlGroup>
                    <StyledControlGroup
                        label="Border"
                        labelPosition="top"
                        controlsLayout="fillJoin"
                    >
                        <div>
                            <Number
                                value={borderSize}
                                onChange={(e, { value }) => {
                                    setBorderSize(value);
                                }}
                                inline
                                title="Border size"
                                style={{ marginBottom: '10px' }}
                                disabled={selectedKpi == undefined}
                            />
                            <Color
                                value={borderColor}
                                onChange={(e, { value }) => {
                                    setBorderColor(value);
                                }}
                                disabled={selectedKpi == undefined}
                            />
                        </div>
                    </StyledControlGroup>
                </SplunkThemeProvider>
            </CollapsiblePanel>
            <CollapsiblePanel title="Interactions">
                <StyledControlGroup
                    label={_('Group Name')}
                    labelPosition="top"
                    controlsLayout="fillJoin"
                ></StyledControlGroup>
            </CollapsiblePanel>
            <Separator />
        </React.Fragment>
    );
};

InsightKpiEditor.propTypes = {
    /**
     * visualization options
     */
    options: PropTypes.shape({
        [PropTypes.string]: PropTypes.oneOfType([PropTypes.any]),
    }),
    visualization: PropTypes.shape({
        options: PropTypes.shape({
            groupName: PropTypes.string,
            kis: PropTypes.arrayOf(
                PropTypes.shape({
                    [PropTypes.string]: PropTypes.oneOfType([PropTypes.any]),
                })
            ),
        }),
        dataSources: PropTypes.shape({}),
        [PropTypes.string]: PropTypes.oneOfType([PropTypes.any]),
    }),
};

InsightKpiEditor.defaultProps = {
    options: {},
    visualization: {},
};

export default memo(InsightKpiEditor);
