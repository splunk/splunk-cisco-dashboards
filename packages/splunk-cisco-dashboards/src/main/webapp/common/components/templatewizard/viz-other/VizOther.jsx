import React, { useState, useEffect, useMemo } from 'react';
import SplunkVisualization from '@splunk/visualizations/common/SplunkVisualization';
import PlusSquare from '@splunk/react-icons/PlusSquare';
import Pencil from '@splunk/react-icons/Pencil';
import Modal from '@splunk/react-ui/Modal';
import Button from '@splunk/react-ui/Button';
import Text from '@splunk/react-ui/Text';
import Table from '@splunk/react-ui/Table';
import SearchJob from '@splunk/search-job';
import Divider from '@splunk/react-ui/Divider';
import Magnifier from '@splunk/react-icons/Magnifier';
import ArrowSquareTopRightInset from '@splunk/react-icons/ArrowSquareTopRightInset';
import Tooltip from '@splunk/react-ui/Tooltip';
import Typography from '@splunk/react-ui/Typography';
import ChartBar from '@splunk/react-icons/ChartBar';
import ChartBarBeside from '@splunk/react-icons/ChartBarBeside';
import ChartLine from '@splunk/react-icons/ChartLine';
import ChartPie from '@splunk/react-icons/ChartPie';

import Bar from '@splunk/visualizations/Bar';
import Column from '@splunk/visualizations/Column';
import Line from '@splunk/visualizations/Line';
import Pie from '@splunk/visualizations/Pie';
import useDashboardStore from '../../../state/dashboardStore';
import ComboBox from '@splunk/react-ui/ComboBox';

const VizOther = (props) => {
    const vizTypeMap = {
        bar: 'splunk.bar',
        barBeside: 'splunk.column',
        line: 'splunk.line',
        pie: 'splunk.pie',
    };

    const [selectedChartType, setSelectedChartType] = useState('All Apps');

    const handleChartTypeChange = (e, { value }) => {
        setSelectedChartType(value);
        console.log('Selected app filter:', value);
        // 🔍 Add table filtering here if needed
    };

    const [appList, setAppList] = useState([]);

    const [selectedSearchQuery, setSelectedSearchQuery] = useState('');

    const { width, height, options, title } = props;
    // const backgroundColor = options?.backgroundColor || 'transparent';
    const backgroundColor = '#000000';
    const [isModalOpen, setIsModalOpen] = useState(false);

    const { updateDashboardDefinition, incrementRefreshKey } = useDashboardStore();

    const [selectedVizId, setSelectedVizId] = useState(null); // Stores the selected visualization ID
    const [editableTitle, setEditableTitle] = useState(title); // Store user-modified title

    const [selectedViz, setSelectedViz] = useState(null); // Inside JSX - Move it!

    // Toggle States
    const [showThresholding, setShowThresholding] = useState(false);
    const [showSparkline, setShowSparkline] = useState(false);
    const [showTrend, setShowTrend] = useState(false); // NEW: Default OFF
    const [refreshKey, setRefreshKey] = useState(0); // 🔄 Force refresh when toggled

    const [isEditingTitle, setIsEditingTitle] = useState(false); // Toggle edit mode

    const [searchTerm, setSearchTerm] = useState('');

    // console.log("VizOther Props:", props);

    // Context for Thresholding (Only affects trend color)
    const singleValueContext = useMemo(
        () => ({
            trendColorThresholds: showThresholding
                ? [
                      { from: 0, value: '#118832' }, // Green if positive
                      { to: 0, value: '#D41F1F' }, // Red if negative
                  ]
                : undefined, // Default color if thresholding is off
        }),
        [showThresholding]
    );

    // Dynamic SingleValue options (Sparkline & Trend)
    const singleValueOptions = useMemo(
        () => ({
            trendValue: '> sparklineValues | delta(-2)', // Trend always computed
            trendDisplay: showTrend ? 'absolute' : 'off', // **New trend toggle logic**
            trendColor: showThresholding
                ? '> trendValue | rangeValue(trendColorThresholds)' // Apply thresholds if ON
                : '#ffffff', // Default color if OFF
            sparklineStrokeColor: showThresholding
                ? '> trendValue | rangeValue(trendColorThresholds)' // Apply thresholds if ON
                : '#ffffff', // Default color if OFF
            sparklineDisplay: showSparkline ? 'below' : 'off', // Sparkline toggle
        }),
        [showThresholding, showSparkline, showTrend]
    );

    // Toggle Functions
    const toggleSparkline = () => {
        setShowSparkline((prev) => !prev);
        setRefreshKey((prev) => prev + 1); // Force refresh
    };

    const toggleTrend = () => {
        setShowTrend((prev) => !prev);
        setRefreshKey((prev) => prev + 1); // Force refresh
    };

    return (
        <>
            <div
                style={{
                    width,
                    height,
                    backgroundColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxSizing: 'border-box',
                    cursor: 'pointer',
                }}
                onClick={() => {
                    setIsModalOpen(true);
                    setSelectedVizId(props.id); // ✅ Store the clicked visualization ID
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '100%',
                    }}
                >
                    <PlusSquare
                        color="#00bcd4"
                        style={{ fontSize: '50px', width: '50px', height: '50px' }}
                    />
                </div>
            </div>

            {/* Modal */}
            <Modal
                open={isModalOpen}
                onRequestClose={() => setIsModalOpen(false)}
                style={{ width: '700px', maxWidth: '90vw' }}
            >
                <Modal.Header>
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-start',
                            width: '100%',
                        }}
                    >
                        <Typography as="h4" variant="title2" style={{ marginBottom: '12px' }}>
                            Panel configuration and preview
                        </Typography>

                        {/* Input and edit icon below */}
                        <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                            <Pencil
                                style={{
                                    cursor: 'pointer',
                                    marginRight: '10px',
                                    verticalAlign: 'middle',
                                }}
                            />

                            <Text
                                value={editableTitle}
                                onChange={(e, { value }) => setEditableTitle(value)} // Updates state as user types
                                canClear
                            />
                        </div>
                    </div>
                </Modal.Header>
                <Modal.Body>
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            flexDirection: 'column',
                            width: '100%',
                        }}
                    >
                        {selectedViz === 'bar' ||
                        selectedViz === 'barBeside' ||
                        selectedViz === 'line' ||
                        selectedViz === 'pie' ? (
                            <div
                                style={{
                                    width: '100%',
                                    display: 'flex',
                                    flexDirection: 'column', // Stack back button & chart vertically
                                    alignItems: 'center',
                                    backgroundColor: 'transparent',
                                    textAlign: 'center',
                                }}
                            >
                                {/* 🔙 Back Button */}
                                <Button
                                    appearance="secondary"
                                    icon={<ArrowSquareTopRightInset />}
                                    onClick={() => setSelectedViz(null)} // Reset to selection grid
                                    style={{ alignSelf: 'flex-start', marginBottom: '10px' }}
                                >
                                    Back
                                </Button>

                                {/* 📊 Bar Chart */}
                                <div style={{ width: '100%', height: '300px' }}>
                                    {selectedViz === 'bar' ? (
                                        <Bar
                                            width="100%"
                                            height="80%"
                                            options={{}}
                                            dataSources={{
                                                primary: {
                                                    requestParams: { offset: 0, count: 20 },
                                                    data: {
                                                        fields: [
                                                            {
                                                                name: 'component',
                                                                groupby_rank: '0',
                                                            },
                                                            { name: 'admin' },
                                                        ],
                                                        columns: [
                                                            ['foo', 'bar', 'foobar'],
                                                            ['1556', '8904', '2327'],
                                                        ],
                                                    },
                                                    meta: { totalCount: 20 },
                                                },
                                            }}
                                        />
                                    ) : selectedViz === 'barBeside' ? (
                                        <Column
                                            width="100%"
                                            height="80%"
                                            options={{}}
                                            dataSources={{
                                                primary: {
                                                    requestParams: { offset: 0, count: 20 },
                                                    data: {
                                                        fields: [
                                                            { name: '_time', groupby_rank: '0' },
                                                            { name: 'admin' },
                                                            { name: '_span' },
                                                        ],
                                                        columns: [
                                                            [
                                                                '2018-05-02T18:10:46.000-07:00',
                                                                '2018-05-02T18:11:47.000-07:00',
                                                                '2018-05-02T18:12:48.000-07:00',
                                                                '2018-05-02T18:13:49.000-07:00',
                                                                '2018-05-02T18:15:50.000-07:00',
                                                                '2018-05-02T18:17:30.000-07:00',
                                                            ],
                                                            ['2', '10', '13', '60', '43', '85'],
                                                            ['1', '1', '1', '1', '1', '1'],
                                                        ],
                                                    },
                                                    meta: { totalCount: 20 },
                                                },
                                            }}
                                        />
                                    ) : selectedViz === 'line' ? (
                                        <Line
                                            width="100%"
                                            height="80%"
                                            options={{}}
                                            dataSources={{
                                                primary: {
                                                    requestParams: { offset: 0, count: 20 },
                                                    data: {
                                                        fields: [
                                                            {
                                                                name: '_time',
                                                            },
                                                            {
                                                                name: 'count',
                                                                type_special: 'count',
                                                            },
                                                        ],
                                                        columns: [
                                                            [
                                                                '2018-05-02T18:10:46.000-07:00',
                                                                '2018-05-02T18:11:47.000-07:00',
                                                                '2018-05-02T18:12:48.000-07:00',
                                                                '2018-05-02T18:13:49.000-07:00',
                                                                '2018-05-02T18:15:50.000-07:00',
                                                            ],
                                                            [
                                                                '600',
                                                                '525',
                                                                '295',
                                                                '213',
                                                                '122',
                                                                '19',
                                                            ],
                                                        ],
                                                    },
                                                    meta: { totalCount: 20 },
                                                },
                                            }}
                                        />
                                    ) : selectedViz === 'pie' ? (
                                        <Pie
                                            width="100%"
                                            height="80%"
                                            options={{}}
                                            dataSources={{
                                                primary: {
                                                    requestParams: { offset: 0, count: 20 },
                                                    data: {
                                                        fields: [
                                                            { name: 'component' },
                                                            { name: 'count' },
                                                        ],
                                                        columns: [
                                                            [
                                                                'January',
                                                                'February',
                                                                'March',
                                                                'April',
                                                                'May',
                                                                'June',
                                                                'July',
                                                                'August',
                                                                'September',
                                                                'October',
                                                                'November',
                                                                'December',
                                                            ],
                                                            [
                                                                '1',
                                                                '1',
                                                                '1',
                                                                '2',
                                                                '10',
                                                                '10',
                                                                '5',
                                                                '5',
                                                                '5',
                                                                '5',
                                                                '5',
                                                                '50',
                                                            ],
                                                        ],
                                                    },
                                                    meta: { totalCount: 20 },
                                                },
                                            }}
                                        />
                                    ) : null}
                                </div>
                            </div>
                        ) : (
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(2, 1fr)' /* 2 columns */,
                                    gridTemplateRows: 'repeat(2, 1fr)' /* 2 rows */,
                                    gap: '20px' /* Equal spacing between items */,
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    margin: 'auto',
                                    marginBottom: '50px' /* Increased space below the squares */,
                                    width: '260px' /* Ensures the grid forms a perfect square */,
                                    height: '260px' /* Ensures the grid forms a perfect square */,
                                }}
                            >
                                {[
                                    {
                                        icon: (
                                            <ChartBar
                                                style={{
                                                    fontSize: '40px',
                                                    width: '40px',
                                                    height: '40px',
                                                }}
                                            />
                                        ),
                                        label: 'Bar Chart',
                                        type: 'bar',
                                    },
                                    {
                                        icon: (
                                            <ChartBarBeside
                                                style={{
                                                    fontSize: '40px',
                                                    width: '40px',
                                                    height: '40px',
                                                }}
                                            />
                                        ),
                                        label: 'Column',
                                        type: 'barBeside',
                                    },
                                    {
                                        icon: (
                                            <ChartLine
                                                style={{
                                                    fontSize: '40px',
                                                    width: '40px',
                                                    height: '40px',
                                                }}
                                            />
                                        ),
                                        label: 'Line Chart',
                                        type: 'line',
                                    },
                                    {
                                        icon: (
                                            <ChartPie
                                                style={{
                                                    fontSize: '40px',
                                                    width: '40px',
                                                    height: '40px',
                                                }}
                                            />
                                        ),
                                        label: 'Pie Chart',
                                        type: 'pie',
                                    },
                                ].map(({ icon, label, type }, index) => (
                                    <div
                                        key={index}
                                        style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            width: '120px' /* Ensures each square is equal */,
                                            height: '120px' /* Ensures each square is equal */,
                                            border: '1px solid #ccc',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            transition:
                                                'background-color 0.3s ease, transform 0.2s ease',
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.backgroundColor = '#2a2a2a'; // Darken on hover
                                            e.currentTarget.style.transform = 'scale(1.05)'; // Slight pop effect
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.backgroundColor = 'transparent'; // Reset
                                            e.currentTarget.style.transform = 'scale(1)'; // Reset scale
                                        }}
                                        onClick={() => {
                                            console.log('Setting selectedViz to:', type);
                                            setSelectedViz(type);
                                            setRefreshKey((prev) => prev + 1); // Forces re-render
                                        }}
                                    >
                                        {icon}
                                        <Typography as="h4" variant="title3">
                                            {label}
                                        </Typography>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <Divider />

                    {/* ✅ Correct Splunk Search Integration */}
                    {(() => {
                        const [searchData, setSearchData] = useState([]);
                        const [loading, setLoading] = useState(true);

                        const [modalOpen, setModalOpen] = useState(false);
                        const [modalContent, setModalContent] = useState('');

                        const handleClick = (description) => {
                            setModalContent(description);
                            setModalOpen(true);
                        };

                        const [selectedRows, setSelectedRows] = useState([]);

                        const handleToggleRow = (event, { rowIndex }) => {
                            setSelectedRows(
                                (prevSelected) =>
                                    prevSelected.includes(rowIndex) ? [] : [rowIndex] // ✅ Ensure only one selection at a time
                            );

                            console.log('Search Column Data:', searchData.columns[2]);

                            console.log('🔍 Clicked Row Index:', rowIndex); // ✅ Log which row was clicked

                            if (searchData.columns && searchData.columns.length >= 3) {
                                const selectedQuery = searchData.columns[2][rowIndex] || ''; // ✅ Fetch the saved search query

                                setSelectedSearchQuery(selectedQuery); // ✅ Store the query in state

                                console.log('✅ Selected Search Query:', selectedQuery); // ✅ Log the selected search query
                            } else {
                                console.warn(
                                    '⚠️ No search query found in column index 2! Check if `searchData.columns` has enough data.'
                                );
                            }
                        };

                        const handleToggleAll = () => {
                            if (selectedRows.length === searchData.columns[0].length) {
                                setSelectedRows([]);
                            } else {
                                setSelectedRows(searchData.columns[0].map((_, index) => index));
                            }
                        };

                        const rowSelectionState = () => {
                            if (selectedRows.length === 0) return 'none';
                            if (selectedRows.length === searchData.columns[0].length) return 'all';
                            return 'some';
                        };

                        useEffect(() => {
                            const searchQuery =
                                '| rest /servicesNS/-/-/saved/searches | fields title description search eai:acl.app';

                            const job = SearchJob.create(
                                {
                                    search: searchQuery,
                                    earliest_time: '-30d',
                                    latest_time: 'now',
                                },
                                { app: 'splunk-cisco-dashboards' }
                            );

                            if (!job) {
                                console.error('❌ Failed to create search job!');
                                setLoading(false);
                                return;
                            }

                            const subscription = job
                                .getResults({ output_mode: 'json_cols', count: '0' })
                                .subscribe((results) => {
                                    console.log('📊 Raw Search Results:', results);

                                    if (
                                        results?.columns?.length > 0 &&
                                        results?.fields?.length > 0
                                    ) {
                                        setSearchData({
                                            fields: results.fields.map((field) => ({
                                                name: field,
                                            })),
                                            columns: results.columns,
                                        });

                                        // Extract index of "eai:acl.app"
                                        const appFieldIndex = results.fields.indexOf('eai:acl.app');

                                        if (appFieldIndex !== -1) {
                                            const rawAppList = results.columns[appFieldIndex];
                                            const uniqueApps = [...new Set(rawAppList)].sort();

                                            setAppList(uniqueApps); // 👈 Save to state
                                        } else {
                                            console.warn(
                                                "⚠️ 'eai:acl.app' field not found in results."
                                            );
                                        }

                                        console.log('✅ Processed Search Data:', results.columns);
                                    } else {
                                        console.warn('⚠️ No valid rows found in search results.');
                                    }

                                    setLoading(false);
                                });

                            return () => {
                                subscription.unsubscribe();
                            };
                        }, []);

                        const filteredData =
                            searchData.columns?.length > 0
                                ? searchData.columns[0]
                                      .map((_, rowIndex) => {
                                          const title = searchData.columns[0][rowIndex];
                                          const description = searchData.columns[1][rowIndex] || '';
                                          const query = searchData.columns[2][rowIndex] || '';
                                          const app = searchData.columns[3]?.[rowIndex] || '';
                                          return {
                                              title,
                                              description,
                                              query,
                                              app,
                                              originalIndex: rowIndex,
                                          };
                                      })
                                      .filter((row) => {
                                          const matchesSearch =
                                              row.title
                                                  .toLowerCase()
                                                  .includes(searchTerm.toLowerCase()) ||
                                              row.description
                                                  .toLowerCase()
                                                  .includes(searchTerm.toLowerCase());
                                          const matchesApp =
                                              selectedChartType === 'All Apps' ||
                                              row.app === selectedChartType;
                                          return matchesSearch && matchesApp;
                                      })
                                : [];

                        const [tableWidth, setTableWidth] = useState(700); // Default width

                        useEffect(() => {
                            const updateWidth = () => {
                                const modalElement = document.querySelector('.modal-classname'); // Adjust selector if needed
                                if (modalElement) {
                                    setTableWidth(modalElement.clientWidth); // Get dynamic width
                                }
                            };

                            window.addEventListener('resize', updateWidth);
                            updateWidth(); // Initial calculation

                            return () => window.removeEventListener('resize', updateWidth);
                        }, []);

                        // Dynamically calculate column widths based on tableWidth
                        const selectionColumnWidth = Math.round(tableWidth * 0.1); // 10%
                        const titleColumnWidth = Math.round(tableWidth * 0.65); // 65%
                        const descriptionColumnWidth = Math.round(tableWidth * 0.25); // 25%

                        return (
                            <div style={{ marginTop: '20px' }}>
                                {/* ✅ Scrollable table body while keeping headers fixed */}
                                <Typography
                                    as="h4"
                                    variant="title3"
                                    style={{ marginBottom: '12px' }}
                                >
                                    Select a single Saved Search below:
                                </Typography>
                                <div style={{ marginTop: '20px' }} />
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '16px',
                                        flexWrap: 'wrap',
                                    }}
                                >
                                    <Tooltip content="If you know the name of the Saved Search you're looking for, enter it here">
                                        <Text
                                            inline
                                            canClear
                                            value={searchTerm}
                                            onChange={(e, { value }) => setSearchTerm(value)}
                                            startAdornment={
                                                <div style={{ display: 'flex', padding: '0 8px' }}>
                                                    <Magnifier />
                                                </div>
                                            }
                                            style={{ minWidth: '250px', flexGrow: 1 }}
                                        />
                                    </Tooltip>

                                    <ComboBox
                                        value={selectedChartType}
                                        onChange={handleChartTypeChange}
                                        inline
                                        placeholder="Filter by app"
                                        style={{ minWidth: '220px' }}
                                    >
                                        <ComboBox.Option
                                            value="All Apps"
                                            description="Show saved searches from all apps"
                                        />
                                        {appList.map((app, index) => (
                                            <ComboBox.Option key={index} value={app} />
                                        ))}
                                    </ComboBox>
                                </div>

                                <div
                                    style={{
                                        maxHeight: '200px',
                                        overflowY: 'auto',
                                        border: '1px solid #ccc',
                                        marginTop: '20px',
                                    }}
                                >
                                    <Table
                                        key={searchData?.columns?.length || 0}
                                        onRequestToggleAllRows={null}
                                        rowSelection={rowSelectionState()}
                                        stripeRows={true}
                                    >
                                        <Table.Head>
                                            <Table.HeadCell width={selectionColumnWidth} />{' '}
                                            {/* Selection */}
                                            <Table.HeadCell width={titleColumnWidth}>
                                                Title
                                            </Table.HeadCell>
                                            <Table.HeadCell width={descriptionColumnWidth}>
                                                Description
                                            </Table.HeadCell>
                                        </Table.Head>

                                        <Table.Body>
                                            {loading ? (
                                                <Table.Row>
                                                    <Table.Cell colSpan={3}>Loading...</Table.Cell>
                                                </Table.Row>
                                            ) : filteredData.length > 0 ? (
                                                filteredData.map((row) => (
                                                    <Table.Row
                                                        key={row.originalIndex} // Use original index as key
                                                        onRequestToggle={(event) =>
                                                            handleToggleRow(event, {
                                                                rowIndex: row.originalIndex,
                                                            })
                                                        }
                                                        selected={selectedRows.includes(
                                                            row.originalIndex
                                                        )}
                                                    >
                                                        <Table.Cell>{row.title}</Table.Cell>
                                                        <Table.Cell>
                                                            {row.description ? (
                                                                <span
                                                                    style={{
                                                                        color: 'white',
                                                                        cursor: 'pointer',
                                                                        textDecoration: 'underline',
                                                                    }}
                                                                    onClick={() =>
                                                                        handleClick(row.description)
                                                                    }
                                                                >
                                                                    Read{' '}
                                                                    <ArrowSquareTopRightInset />
                                                                </span>
                                                            ) : (
                                                                ''
                                                            )}
                                                        </Table.Cell>
                                                    </Table.Row>
                                                ))
                                            ) : (
                                                <Table.Row>
                                                    <Table.Cell colSpan={3}>
                                                        No results found.
                                                    </Table.Cell>
                                                </Table.Row>
                                            )}
                                        </Table.Body>
                                    </Table>
                                </div>

                                {/* Modal for Description */}
                                <Modal open={modalOpen} onRequestClose={() => setModalOpen(false)}>
                                    <Modal.Header>Description</Modal.Header>
                                    <Modal.Body>{modalContent}</Modal.Body>
                                    <Modal.Footer>
                                        <Button
                                            onClick={() => setModalOpen(false)}
                                            label="Close"
                                        />
                                        <Button
                                            appearance="primary"
                                            onClick={() => {
                                                const {
                                                    dashboardDefinition,
                                                    setDashboardDefinition,
                                                } = useDashboardStore.getState();

                                                console.log(
                                                    '🟢 Attempting to insert visualization...'
                                                );
                                                console.log(
                                                    '🟢 Current Selected Search Query:',
                                                    selectedSearchQuery
                                                );

                                                if (!dashboardDefinition || !selectedVizId) {
                                                    console.warn(
                                                        '❌ Missing required data for insertion! Aborting.'
                                                    );
                                                    return;
                                                }

                                                const updatedDefinition =
                                                    structuredClone(dashboardDefinition);

                                                // Generate a unique data source ID based on visualization ID
                                                const dataSourceId = `ds_${selectedVizId}`;

                                                console.log(
                                                    '🔍 BEFORE Insert - Current dataSources:',
                                                    updatedDefinition.dataSources
                                                );

                                                // Update the visualization title
                                                if (
                                                    updatedDefinition.visualizations &&
                                                    updatedDefinition.visualizations[selectedVizId]
                                                ) {
                                                    updatedDefinition.visualizations[
                                                        selectedVizId
                                                    ].title = editableTitle || '';
                                                }

                                                // Ensure `dataSources` exists
                                                if (!updatedDefinition.dataSources) {
                                                    updatedDefinition.dataSources = {};
                                                }

                                                // Insert the new data source using the **selected search query**
                                                updatedDefinition.dataSources[dataSourceId] = {
                                                    name: dataSourceId,
                                                    options: {
                                                        query:
                                                            selectedSearchQuery ||
                                                            '| makeresults | eval field=0 | table field', // ✅ Ensure fallback
                                                        queryParameters: {
                                                            earliest: '-24h@h',
                                                            latest: 'now',
                                                        },
                                                    },
                                                    type: 'ds.search',
                                                };

                                                console.log(
                                                    '✅ AFTER Insert - Updated dataSources:',
                                                    JSON.stringify(
                                                        updatedDefinition.dataSources,
                                                        null,
                                                        2
                                                    )
                                                );

                                                // Ensure visualization exists and link the data source
                                                if (
                                                    updatedDefinition.visualizations &&
                                                    updatedDefinition.visualizations[selectedVizId]
                                                ) {
                                                    updatedDefinition.visualizations[
                                                        selectedVizId
                                                    ].dataSources = { primary: dataSourceId };
                                                    updatedDefinition.visualizations[
                                                        selectedVizId
                                                    ].type =
                                                        vizTypeMap[selectedViz] || 'splunk.bar';
                                                }

                                                setDashboardDefinition(updatedDefinition);
                                                incrementRefreshKey(); // ✅ Forces UI re-render

                                                // Log AFTER state update & re-render
                                                setTimeout(() => {
                                                    const { dashboardDefinition: updatedState } =
                                                        useDashboardStore.getState();
                                                    console.log(
                                                        '🔄 AFTER RE-RENDER - Final Dashboard Definition:',
                                                        updatedState
                                                    );
                                                }, 100);
                                            }}
                                        >
                                            Insert
                                        </Button>
                                    </Modal.Footer>
                                </Modal>
                            </div>
                        );
                    })()}
                </Modal.Body>

                <Modal.Footer>
                    <Button onClick={() => setIsModalOpen(false)} label="Close" />
                    <Button
                        appearance="primary"
                        onClick={() => {
                            const { dashboardDefinition, setDashboardDefinition } =
                                useDashboardStore.getState();

                            if (!dashboardDefinition || !selectedVizId) {
                                console.warn('⚠️ Missing required data for insertion!');
                                return;
                            }

                            // 🚨 Log the search query to ensure it's updated
                            console.log(
                                '🟢 Using Search Query Before Insert:',
                                selectedSearchQuery
                            );

                            if (!selectedSearchQuery) {
                                console.warn(
                                    '⚠️ selectedSearchQuery is EMPTY! Using fallback search instead.'
                                );
                            }

                            const updatedDefinition = structuredClone(dashboardDefinition);
                            const dataSourceId = `ds_${selectedVizId}`;

                            // ✅ Ensure `dataSources` exists before modification
                            if (!updatedDefinition.dataSources) {
                                updatedDefinition.dataSources = {}; // ✅ Initialize it if missing
                            }

                            // ✅ Ensure correct query is used
                            updatedDefinition.dataSources[dataSourceId] = {
                                name: dataSourceId,
                                options: {
                                    query:
                                        selectedSearchQuery ||
                                        '| makeresults | eval field=0 | table field', // ✅ Correct query
                                    queryParameters: {
                                        earliest: '-24h@h',
                                        latest: 'now',
                                    },
                                },
                                type: 'ds.search',
                            };

                            // Ensure visualization is linked to the data source
                            if (
                                updatedDefinition.visualizations &&
                                updatedDefinition.visualizations[selectedVizId]
                            ) {
                                updatedDefinition.visualizations[selectedVizId].dataSources = {
                                    primary: dataSourceId,
                                };
                                updatedDefinition.visualizations[selectedVizId].type =
                                    vizTypeMap[selectedViz] || 'splunk.bar';
                                updatedDefinition.visualizations[selectedVizId].title =
                                    editableTitle || 'Untitled'; // ✅ Add this line
                            }

                            setDashboardDefinition(updatedDefinition);
                            incrementRefreshKey(); // ✅ Forces UI re-render

                            // 🚀 Log AFTER state update
                            setTimeout(() => {
                                const { dashboardDefinition: updatedState } =
                                    useDashboardStore.getState();
                                console.log(
                                    '🔄 AFTER RE-RENDER - Final Dashboard Definition:',
                                    updatedState
                                );
                            }, 100);
                        }}
                    >
                        Insert
                    </Button>
                </Modal.Footer>
            </Modal>
        </>
    );
};

VizOther.propTypes = {
    ...SplunkVisualization.propTypes,
};
VizOther.defaultProps = {
    ...SplunkVisualization.defaultProps,
};

VizOther.dataContract = {
    requiredDataSources: ['primary'],
    initialRequestParams: {
        primary: { offset: 0, count: 50 },
    },
};

VizOther.config = {
    dataContract: {},
    optionsSchema: {},
    key: 'viz.custom',
    name: 'Custom Viz',
    icon: PlusSquare,
    category: 'misc',
};

VizOther.showTitleAndDescription = true;
VizOther.showProgressBar = true;

export default VizOther;
