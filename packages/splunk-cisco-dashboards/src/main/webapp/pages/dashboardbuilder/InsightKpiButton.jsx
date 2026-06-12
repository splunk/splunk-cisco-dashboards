import React, { useState, useEffect } from 'react';
import { IconButton } from '@splunk/dashboard-toolbar';
import Eye from '@splunk/react-icons/Eye';
import {
    getSearchbaseCatalogue,
    plainTextFromHtml,
} from '../../common/services/searchbaseCatalogue';
import DropdownWithSearch from './DropdownWithSearch';

const generateRandomString = (length = 10) => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
};

const createDataSourceName = (search) => {
    const rawName = search.id || search.searchName || generateRandomString();
    const safeName = rawName.replace(/[^A-Za-z0-9_]/g, '_').replace(/^_+/, '');
    return `ds_${safeName || generateRandomString()}`;
};

const newInsightKpiVizConfig = (search, searchKey) => {
    return {
        visualizationId: `viz_insightKpi_${generateRandomString()}`,
        visualizationDefinition: {
            type: search.defaultViz ? search.defaultViz : 'splunk.table',
            title: search.searchName,
            description: plainTextFromHtml(search.description || ''),
            dataSources: {
                primary: searchKey,
            },
            options: search.vizOptions || {},
        },
    };
};

const InsightKpiButton = (props) => {
    // get all searches
    const [searches, setSearches] = useState([]);
    const [selectedKpis, setSelectedKpis] = useState([]);

    useEffect(() => {
        if (searches.length == 0) {
            const getSearchesList = async () => {
                const data = await getSearchbaseCatalogue({ allApps: true });
                setSearches(data.filter((search) => search.id && search.searchName));
            };
            getSearchesList();
        }
    }, []);

    useEffect(() => {
        if (selectedKpis && selectedKpis.length > 0) {
            const { dashboardApi } = props;

            selectedKpis.forEach((selectedKpi) => {
                const searchName = createDataSourceName(selectedKpi);
                var searchKey = findKeyForDsName(
                    dashboardApi.coreApi.getDefinition().dataSources,
                    searchName,
                );
                if (!searchKey) {
                    dashboardApi.createDataSource({
                        type: 'ds.searchbase',
                        options: {
                            ref: selectedKpi.id,
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
                            return searches.filter((s) => selection.includes(s.id));
                        });
                    }
                }}
                appearance="subtle"
                icon={<Eye style={{ width: 24, height: 24 }} />}
                style={{ maxWidth: 40, marginLeft: 10 }}
                searches={searches.filter((s) => s.searchName != undefined && s.id != undefined)}
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
