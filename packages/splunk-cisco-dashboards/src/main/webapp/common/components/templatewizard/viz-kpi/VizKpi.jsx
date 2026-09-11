import React, { useState, useEffect, useMemo } from 'react';
import SplunkVisualization from '@splunk/visualizations/common/SplunkVisualization';
import PlusSquare from '@splunk/react-icons/PlusSquare';
import Pencil from '@splunk/react-icons/Pencil';
import Modal from '@splunk/react-ui/Modal';
import Button from '@splunk/react-ui/Button';
import SingleValue from '@splunk/visualizations/SingleValue';
import Switch from '@splunk/react-ui/Switch';
import Text from '@splunk/react-ui/Text';
import Table from '@splunk/react-ui/Table';
import SearchJob from '@splunk/search-job';
import Divider from '@splunk/react-ui/Divider';
import Magnifier from '@splunk/react-icons/Magnifier';
import ArrowSquareTopRightInset from '@splunk/react-icons/ArrowSquareTopRightInset';
import Tooltip from '@splunk/react-ui/Tooltip';
import Typography from '@splunk/react-ui/Typography';
import { getSearches } from '../../../lib/searchbase';
import ControlGroup from '@splunk/react-ui/ControlGroup';
import CardLayout from '@splunk/react-ui/CardLayout';
import ChartSingleValue from '@splunk/react-icons/ChartSingleValue';
import ChartPie from '@splunk/react-icons/ChartPie';
import ChartLine from '@splunk/react-icons/ChartLine';
import ChartArea from '@splunk/react-icons/ChartArea';
import ChartBar from '@splunk/react-icons/ChartBar';
import TableList from '@splunk/react-icons/TableList';
import ChartSingleValueRadial from '@splunk/react-icons/ChartSingleValueRadial';
import ChartColumn from '@splunk/react-icons/ChartColumn';
import Card from '@splunk/react-ui/Card';
import CheckRadio from '@splunk/react-icons/CheckRadio';
import ColumnLayout from '@splunk/react-ui/ColumnLayout';
import Heading from '@splunk/react-ui/Heading';
import InfoCircle from '@splunk/react-icons/enterprise/InfoCircle';
import CustomTooltip from '../../CustomTooltip/CustomTooltip';
import DOMPurify from 'dompurify';
import InformationCircle from '@splunk/react-icons/InformationCircle';
import useDashboardStore from '../../../state/dashboardStore';
import { cloneDeep, isEqual } from 'lodash-es';
import { appStaticAssetUrl } from '../../../lib/appStaticAssetUrl';

const KPI_PLACEHOLDER_ASSET_URL = appStaticAssetUrl('placeholder.svg');
const KPI_VIEW_ICON_ASSET_URL = appStaticAssetUrl('icn_view.svg');

const generateRandomString = (length = 10) => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
};

const newInsightKpiVizConfig = (search, searchKey) => {
    var vizOptions = {};
    try {
        vizOptions = search.content.viz_options ? JSON.parse(search.content.viz_options) : {};
    } catch (error) {
        vizOptions = {};
        console.log(error);
    }
    return {
        visualizationId: `viz_insightKpi_${generateRandomString()}`,
        visualizationDefinition: {
            type: search.content.default_viz ? search.content.default_viz : 'splunk.table',
            title: search.content.search_name,
            description: search.content.description.replace(/(<([^>]+)>)/gi, ''),
            dataSources: {
                primary: searchKey,
            },
            options: vizOptions,
        },
    };
};

const VizKpi = (props) => {
    const { width, height, options, id } = props;
    // const backgroundColor = options?.backgroundColor || 'transparent';

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searches, setSearches] = useState([]);
    const [selectedKpi, setSelectedKpi] = useState();
    const [searchText, setSearchText] = useState('');
    const { dashboardCoreApi } = useDashboardStore();

    useEffect(() => {
        if (searches.length == 0) {
            const getSearchesList = async () => {
                const data = await getSearches();
                if (data.entry)
                    setSearches(data.entry.filter((s) => s.content.search_hidden == '0'));
                else setSearches([]);
            };
            getSearchesList();
        }
    }, []);

    const findKeyForDsName = (data, targetName) => {
        for (const key in data) {
            if (data[key].name === targetName) {
                return key;
            }
        }
        return undefined; // Return null if no match is found
    };

    const handleAddKPI = () => {
        if (dashboardCoreApi) {
            // create the new search in datasource
            const searchName = `ds_${selectedKpi.name.replaceAll('#', '').replace(' ', '_')}`;
            var searchKey = findKeyForDsName(
                dashboardCoreApi.coreApi.getDefinition().dataSources,
                searchName,
            );
            if (!searchKey) {
                dashboardCoreApi.createDataSource({
                    type: 'ds.searchbase',
                    options: {
                        ref: selectedKpi.name,
                        /*queryParameters: {
                            earliest: selectedKpi.content.dispatch_earliest_time,
                            latest: selectedKpi.content.dispatch_latest_time,
                        },*/
                    },
                    name: searchName,
                });

                searchKey = findKeyForDsName(
                    dashboardCoreApi.coreApi.getDefinition().dataSources,
                    searchName,
                );
            }

            if (searchKey) {
                let def = cloneDeep(dashboardCoreApi.coreApi.getDefinition());
                def.visualizations[id] = {
                    ...newInsightKpiVizConfig(selectedKpi, searchKey).visualizationDefinition,
                };
                dashboardCoreApi.coreApi.updateDefinition(def);
            }
            setIsModalOpen(false);
        }
    };

    return (
        <>
            <Tooltip content="Click to bring your data to life !">
                <div
                    style={{
                        width,
                        height,
                        //backgroundColor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxSizing: 'border-box',
                        cursor: options.readonly ? 'auto' : 'pointer',
                        backgroundImage: `url('${KPI_PLACEHOLDER_ASSET_URL}')`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                    }}
                    onClick={() => {
                        if (options.readonly) return;
                        setIsModalOpen(true);
                        setSelectedKpi(undefined);
                        setSearchText('');
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '100%',
                            height: '50%',
                        }}
                    >
                        <img
                            src={KPI_VIEW_ICON_ASSET_URL}
                            style={{ height: '100%', width: '100%' }}
                        ></img>
                    </div>
                </div>
            </Tooltip>

            {/* Modal */}

            <Modal
                open={isModalOpen}
                onRequestClose={() => setIsModalOpen(false)}
                style={{ width: '700px', maxWidth: '90vw' }}
            >
                <Modal.Header title="KPI Selector"></Modal.Header>
                <Modal.Body>
                    <ControlGroup label="Filter">
                        <Text
                            value={searchText}
                            onChange={(e, { value }) => {
                                setSearchText(value);
                            }}
                        ></Text>
                    </ControlGroup>
                    <ControlGroup label="Searches">
                        <CardLayout
                            cardMaxWidth={'100%'}
                            cardMinWidth={'100%'}
                            cardWidth={'100%'}
                            wrapCards
                            gutterSize={10}
                        >
                            {searches
                                .filter(
                                    (s) =>
                                        s.content.search_name != undefined &&
                                        s.content.search_name != undefined &&
                                        s.content.search_hidden != '1',
                                )
                                .filter((s) => {
                                    if (searchText == '') return s;
                                    else if (
                                        s.content.search_name
                                            .toLowerCase()
                                            .includes(searchText.toLowerCase()) ||
                                        s.name.toLowerCase().includes(searchText.toLowerCase())
                                    )
                                        return s;
                                })
                                .map((search) => (
                                    <Card
                                        onClick={() => {
                                            setSelectedKpi(search);
                                        }}
                                    >
                                        <Card.Body>
                                            <ColumnLayout style={{ width: '100%' }}>
                                                <ColumnLayout.Row>
                                                    <ColumnLayout.Column span={2}>
                                                        {search.content.default_viz ? (
                                                            search.content.default_viz.includes(
                                                                'table',
                                                            ) ? (
                                                                <TableList
                                                                    width={40}
                                                                    height={40}
                                                                ></TableList>
                                                            ) : search.content.default_viz.includes(
                                                                  'bar',
                                                              ) ? (
                                                                <ChartBar
                                                                    width={40}
                                                                    height={40}
                                                                ></ChartBar>
                                                            ) : search.content.default_viz.includes(
                                                                  'line',
                                                              ) ? (
                                                                <ChartLine
                                                                    width={40}
                                                                    height={40}
                                                                ></ChartLine>
                                                            ) : search.content.default_viz.includes(
                                                                  'area',
                                                              ) ? (
                                                                <ChartArea
                                                                    width={40}
                                                                    height={40}
                                                                ></ChartArea>
                                                            ) : search.content.default_viz.includes(
                                                                  'column',
                                                              ) ? (
                                                                <ChartColumn
                                                                    width={40}
                                                                    height={40}
                                                                ></ChartColumn>
                                                            ) : search.content.default_viz.includes(
                                                                  'pie',
                                                              ) ? (
                                                                <ChartPie
                                                                    width={40}
                                                                    height={40}
                                                                ></ChartPie>
                                                            ) : search.content.default_viz.includes(
                                                                  'singlevalueradial',
                                                              ) ? (
                                                                <ChartSingleValueRadial
                                                                    width={40}
                                                                    height={40}
                                                                ></ChartSingleValueRadial>
                                                            ) : (
                                                                <ChartSingleValue
                                                                    width={40}
                                                                    height={40}
                                                                ></ChartSingleValue>
                                                            )
                                                        ) : (
                                                            <TableList
                                                                width={40}
                                                                height={40}
                                                            ></TableList>
                                                        )}
                                                    </ColumnLayout.Column>
                                                    <ColumnLayout.Column span={9}>
                                                        <div style={{ display: 'flex' }}>
                                                            <div>
                                                                <Heading level={4}>
                                                                    {search.content.search_name}
                                                                </Heading>
                                                                <Heading
                                                                    level={6}
                                                                    style={{
                                                                        color: '#8a8a8a',
                                                                        fontWeight: 'normal',
                                                                    }}
                                                                >
                                                                    {search.name}
                                                                </Heading>
                                                            </div>
                                                            <CustomTooltip
                                                                width={500}
                                                                height={300}
                                                                delay="300"
                                                                placement="right"
                                                                type="card"
                                                                title={search.content.search_name}
                                                                description={
                                                                    <div
                                                                        dangerouslySetInnerHTML={{
                                                                            __html: DOMPurify.sanitize(
                                                                                search.content
                                                                                    .description,
                                                                                {
                                                                                    USE_PROFILES: {
                                                                                        html: true,
                                                                                    },
                                                                                },
                                                                            ),
                                                                        }}
                                                                    />
                                                                }
                                                            >
                                                                <InformationCircle
                                                                    style={{
                                                                        width: 20,
                                                                        height: 20,
                                                                        marginLeft: 15,
                                                                    }}
                                                                ></InformationCircle>
                                                            </CustomTooltip>
                                                        </div>
                                                    </ColumnLayout.Column>
                                                    <ColumnLayout.Column span={1}>
                                                        <CheckRadio
                                                            color="#00bcd4"
                                                            variant={
                                                                search.name == selectedKpi?.name
                                                                    ? 'filled'
                                                                    : 'default'
                                                            }
                                                            height="20px"
                                                            width="20px"
                                                        />
                                                    </ColumnLayout.Column>
                                                </ColumnLayout.Row>
                                            </ColumnLayout>
                                        </Card.Body>
                                    </Card>
                                ))}
                        </CardLayout>
                    </ControlGroup>
                </Modal.Body>
                <Modal.Footer>
                    <Button
                        appearance="default"
                        label="Cancel"
                        onClick={() => {
                            setIsModalOpen(false);
                        }}
                    ></Button>
                    <Button
                        appearance="primary"
                        label="Select"
                        onClick={() => {
                            handleAddKPI();
                        }}
                        disabled={!selectedKpi}
                    ></Button>
                </Modal.Footer>
            </Modal>
        </>
    );
};

VizKpi.propTypes = {
    ...SplunkVisualization.propTypes,
};
VizKpi.defaultProps = {
    ...SplunkVisualization.defaultProps,
};

export default VizKpi;
