import React, { useCallback, useEffect, useState } from 'react';
import { ActionButton } from '@splunk/dashboard-action-buttons';
import { getSearches } from '../../common/lib/searchbase';

import Magnifier from '@splunk/react-icons/Magnifier';

const ActionButtonIcon = <Magnifier />;

const CustomOpenSearch = ({ itemId, dashboardApi, itemDefinition, dataSources }) => {
    const [disabled, setDisabled] = useState(true);
    const [splSearch, setSplSearch] = useState();
    const [searches, setSearches] = useState([]);
    const [earliest, setEarliest] = useState('-24h@h');
    const [latest, setLatest] = useState('now');

    useEffect(() => {
        if (searches.length == 0) {
            const getSearchesList = async () => {
                const data = await getSearches();
                setSearches(data.entry);
            };
            getSearchesList();
        }
    }, []);

    const extractTokens = (input) => {
        const matches = [...input.matchAll(/\$(.+?)\$/g)];
        return [...new Set(matches.map((match) => match[1]))];
    };

    useEffect(() => {
        if (searches.length > 0) {
            if (itemDefinition.dataSources) {
                var spl = undefined;
                var dataSourceRegistry = undefined;
                if (dashboardApi.dataSourceRegistry) {
                    dataSourceRegistry = dashboardApi.dataSourceRegistry;
                } else if (dashboardApi.getDataSourceRegistry) {
                    dataSourceRegistry = dashboardApi.getDataSourceRegistry();
                }

                if (!dataSourceRegistry) {
                    return;
                }

                if (dataSources[itemDefinition.dataSources.primary].type == 'ds.chain') {
                    spl = `${
                        dashboardApi.getDefinition().dataSources[
                            dataSources[itemDefinition.dataSources.primary].options.extend
                        ].options.query
                    }${dataSources[itemDefinition.dataSources.primary].options.query}`;
                    if (
                        dataSourceRegistry.getDataSourceController(
                            dataSources[itemDefinition.dataSources.primary].options.extend,
                        )
                    ) {
                        setEarliest(
                            dataSourceRegistry.getDataSourceController(
                                dataSources[itemDefinition.dataSources.primary].options.extend,
                            ).def.options.queryParameters.earliest,
                        );
                        setLatest(
                            dataSourceRegistry.getDataSourceController(
                                dataSources[itemDefinition.dataSources.primary].options.extend,
                            ).def.options.queryParameters.latest,
                        );
                    }
                    setDisabled(false);
                } else if (
                    dataSources[itemDefinition.dataSources.primary].type == 'ds.searchbase'
                ) {
                    if (dataSources[itemDefinition.dataSources.primary].options.ref) {
                        const search = searches.find(
                            (s) =>
                                s.name ==
                                dataSources[itemDefinition.dataSources.primary].options.ref,
                        );
                        if (search) {
                            spl = search.content.search;
                            setDisabled(false);
                        }
                    }
                } else if (dataSources[itemDefinition.dataSources.primary].type == 'ds.search') {
                    if (dataSources[itemDefinition.dataSources.primary].options.query) {
                        spl = dataSources[itemDefinition.dataSources.primary].options.query;
                        if (
                            dataSourceRegistry.getDataSourceController(
                                itemDefinition.dataSources.primary,
                            )
                        ) {
                            setEarliest(
                                dataSourceRegistry.getDataSourceController(
                                    itemDefinition.dataSources.primary,
                                ).def.options.queryParameters.earliest,
                            );
                            setLatest(
                                dataSourceRegistry.getDataSourceController(
                                    itemDefinition.dataSources.primary,
                                ).def.options.queryParameters.latest,
                            );
                        }
                        setDisabled(false);
                    }
                }

                if (spl) {
                    const tokens = extractTokens(spl);
                    if (tokens.length > 0) {
                        const urlParams = new URLSearchParams(window.location.search);
                        tokens.map((tok) => {
                            var val = urlParams.get(tok);
                            if (!val) val = urlParams.get(`form.${tok}`);
                            if (val) {
                                spl = spl.replaceAll(`$${tok}$`, val);
                            }
                        });
                    }

                    setSplSearch(spl);
                }
            }
        }
    }, [searches, dashboardApi, itemDefinition, dataSources]);

    return (
        <ActionButton
            data-test="CustomOpenSearchButton" // for testing
            onClick={() =>
                window.open(
                    `/app/splunk-cisco-dashboards/search?earliest=${encodeURIComponent(
                        earliest,
                    )}&latest=${encodeURIComponent(latest)}&q=${encodeURIComponent(splSearch)}`,
                    '_blank',
                )
            }
            icon={ActionButtonIcon} // icon for this button
            disabled={disabled}
        />
    );
};

export default CustomOpenSearch;
