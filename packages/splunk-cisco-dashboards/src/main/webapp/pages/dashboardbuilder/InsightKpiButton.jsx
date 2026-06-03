import React, { useCallback, useState, useEffect } from 'react';
import { IconButton, PopoverItemButton } from '@splunk/dashboard-toolbar';
import Eye from '@splunk/react-icons/Eye';
import Dropdown from '@splunk/react-ui/Dropdown';
import Menu from '@splunk/react-ui/Menu';
import Button from '@splunk/react-ui/Button';
import { getSearches } from '../../common/lib/searchbase';
import Search from '@splunk/react-ui/Search';
import Text from '@splunk/react-ui/Text';
import ChartSingleValue from '@splunk/react-icons/ChartSingleValue';
import ChartPie from '@splunk/react-icons/ChartPie';
import ChartLine from '@splunk/react-icons/ChartLine';
import ChartArea from '@splunk/react-icons/ChartArea';
import ChartBar from '@splunk/react-icons/ChartBar';
import TableList from '@splunk/react-icons/TableList';
import ChartSingleValueRadial from '@splunk/react-icons/ChartSingleValueRadial';
import ChartColumn from '@splunk/react-icons/ChartColumn';
import TooltipWithTheme from '@splunk/react-ui/Tooltip';
import DropdownWithSearch, { DropdownItem } from './DropdownWithSearch';

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

const newCustomInsightKpiVizConfig = () => {
    return {
        visualizationId: `viz_insightKpi_${generateRandomString()}`,
        visualizationDefinition: {
            type: 'custom.insightKpi',
            options: {
                groupName: '',
            },
        },
    };
};

const buttonToggle = (
    <Button
        label=""
        appearance="subtle"
        icon={<Eye style={{ width: 24, height: 24 }} />}
        isMenu
        style={{ maxWidth: 40 }}
    />
);

const InsightKpiButton = (props) => {
    // get all searches
    const [searches, setSearches] = useState([]);
    const [selectedKpis, setSelectedKpis] = useState([]);
    const [searchText, setSearchText] = useState('');

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

    useEffect(() => {
        if (selectedKpis && selectedKpis.length > 0) {
            const { dashboardApi } = props;

            selectedKpis.map((selectedKpi) => {
                const searchName = `ds_${selectedKpi.name.replaceAll('#', '').replace(' ', '_')}`;
                var searchKey = findKeyForDsName(
                    dashboardApi.coreApi.getDefinition().dataSources,
                    searchName,
                );
                if (!searchKey) {
                    dashboardApi.createDataSource({
                        type: 'ds.searchbase',
                        options: {
                            ref: selectedKpi.name,
                        },
                        name: searchName,
                    });
                    searchKey = findKeyForDsName(
                        dashboardApi.coreApi.getDefinition().dataSources,
                        searchName,
                    );
                }

                if (searchKey) {
                    dashboardApi.coreApi.createVisualization(
                        newInsightKpiVizConfig(selectedKpi, searchKey),
                    );
                }
            });

            setSelectedKpis([]);
        }
    }, [selectedKpis]);

    const handleAddInsightKpi = useCallback(() => {
        const { dashboardApi } = props;

        dashboardApi.coreApi.createVisualization(newCustomInsightKpiVizConfig());
    }, [props]);

    const handleSearchChange = (e, { value }) => {
        setSearchText(value);
    };

    const findKeyForDsName = (data, targetName) => {
        for (const key in data) {
            if (data[key].name === targetName) {
                return key;
            }
        }
        return undefined; // Return null if no match is found
    };

    return (
        <>
            <DropdownWithSearch
                onSelect={(selection) => {
                    if (selection) {
                        setSelectedKpis((prev) => {
                            return searches.filter((s) => selection.includes(s.name));
                        });
                    }
                }}
                appearance="subtle"
                icon={<Eye style={{ width: 24, height: 24 }} />}
                style={{ maxWidth: 40, marginLeft: 10 }}
                tags={[
                    ...new Set(
                        searches
                            .map((search) => search.content.tags)
                            .join(',')
                            .split(','),
                    ),
                ]}
                searches={searches
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
                    })}
            ></DropdownWithSearch>
        </>
    );
};

InsightKpiButton.propTypes = {
    ...IconButton.propTypes,
};

InsightKpiButton.defaultProps = {
    ...IconButton.defaultProps,
};

export default InsightKpiButton;
