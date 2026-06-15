import React, { useCallback, useEffect, useState } from 'react';
import { ActionButton } from '@splunk/dashboard-action-buttons';
import { getSearches } from '../../common/lib/searchbase';

import Magnifier from '@splunk/react-icons/Magnifier';

const ActionButtonIcon = <Magnifier />;
const DEFAULT_EARLIEST = '-24h@h';
const DEFAULT_LATEST = 'now';
const GLOBAL_TIME_TOKEN = 'global_time';

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

    const getUrlParameter = useCallback((name) => {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(name) || urlParams.get(`form.${name}`);
    }, []);

    const getInputDefaultValue = useCallback(
        (token) => {
            const [tokenName, timePart] = token.split('.');
            const input = Object.values(dashboardApi?.getDefinition?.().inputs || {}).find(
                (candidate) => candidate?.options?.token === tokenName,
            );
            const [defaultEarliest, defaultLatest] = `${input?.options?.defaultValue || ''}`.split(
                ',',
            );

            if (timePart === 'earliest') return defaultEarliest;
            if (timePart === 'latest') return defaultLatest;
            return undefined;
        },
        [dashboardApi],
    );

    const resolveTokenValue = useCallback(
        (value) => {
            if (!value) return undefined;

            return `${value}`.replace(/\$(.+?)\$/g, (match, token) => {
                return getUrlParameter(token) || getInputDefaultValue(token) || match;
            });
        },
        [getInputDefaultValue, getUrlParameter],
    );

    const getGlobalTimeValue = useCallback(
        (timePart) => {
            const token = `${GLOBAL_TIME_TOKEN}.${timePart}`;
            const fallback = timePart === 'earliest' ? DEFAULT_EARLIEST : DEFAULT_LATEST;
            return getUrlParameter(token) || getInputDefaultValue(token) || fallback;
        },
        [getInputDefaultValue, getUrlParameter],
    );

    const setResolvedTimeRange = useCallback(
        (queryParameters) => {
            setEarliest(
                resolveTokenValue(queryParameters?.earliest) || getGlobalTimeValue('earliest'),
            );
            setLatest(resolveTokenValue(queryParameters?.latest) || getGlobalTimeValue('latest'));
        },
        [getGlobalTimeValue, resolveTokenValue],
    );

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

                const primaryDataSourceId = itemDefinition.dataSources.primary;
                const primaryDataSource = dataSources[primaryDataSourceId];

                if (!primaryDataSource) {
                    return;
                }

                if (primaryDataSource.type == 'ds.chain') {
                    const extendedDataSourceId = primaryDataSource.options.extend;
                    const extendedDataSource =
                        dashboardApi.getDefinition().dataSources[extendedDataSourceId];
                    spl = `${
                        extendedDataSource?.options?.query || ''
                    }${primaryDataSource.options.query || ''}`;
                    setResolvedTimeRange(
                        dataSourceRegistry.getDataSourceController(extendedDataSourceId)?.def
                            ?.options?.queryParameters ||
                            extendedDataSource?.options?.queryParameters ||
                            primaryDataSource.options?.queryParameters,
                    );
                    setDisabled(false);
                } else if (primaryDataSource.type == 'ds.searchbase') {
                    if (primaryDataSource.options.ref) {
                        const search = searches.find(
                            (s) => s.name == primaryDataSource.options.ref,
                        );
                        if (search) {
                            spl = search.content.search;
                            setResolvedTimeRange(
                                dataSourceRegistry.getDataSourceController(primaryDataSourceId)?.def
                                    ?.options?.queryParameters ||
                                    primaryDataSource.options?.queryParameters,
                            );
                            setDisabled(false);
                        }
                    }
                } else if (primaryDataSource.type == 'ds.search') {
                    if (primaryDataSource.options.query) {
                        spl = primaryDataSource.options.query;
                        setResolvedTimeRange(
                            dataSourceRegistry.getDataSourceController(primaryDataSourceId)?.def
                                ?.options?.queryParameters ||
                                primaryDataSource.options?.queryParameters,
                        );
                        setDisabled(false);
                    }
                }

                if (spl) {
                    const tokens = extractTokens(spl);
                    if (tokens.length > 0) {
                        tokens.forEach((tok) => {
                            var val = getUrlParameter(tok);
                            if (val) {
                                spl = spl.replaceAll(`$${tok}$`, val);
                            }
                        });
                    }

                    setSplSearch(resolveTokenValue(spl));
                }
            }
        }
    }, [
        searches,
        dashboardApi,
        itemDefinition,
        dataSources,
        getUrlParameter,
        resolveTokenValue,
        setResolvedTimeRange,
    ]);

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
