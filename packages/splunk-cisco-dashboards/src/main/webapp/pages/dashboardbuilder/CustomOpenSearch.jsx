import React, { useCallback, useEffect, useState } from 'react';
import Button from '@splunk/react-ui/Button';
import { ActionButton } from '@splunk/dashboard-action-buttons';
import Magnifier from '@splunk/react-icons/Magnifier';
import PropTypes from 'prop-types';
import { getSearches } from '../../common/lib/searchbase';
import { applyDcNetworkingScope } from '../../common/lib/dcNetworkingScope';
import {
    resolveOpenSearchQuery,
    resolveOpenSearchToken,
} from '../../common/lib/openSearchTokenResolution';

import { ExternalLink } from '../../common/icons/SuiIcon';

const ActionButtonIcon = <Magnifier />;
const DEFAULT_EARLIEST = '-24h@h';
const DEFAULT_LATEST = 'now';
const GLOBAL_TIME_TOKEN = 'global_time';
const DEFAULT_SEARCH_APP = 'splunk-cisco-dashboards';
const APP_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_\-.]{0,127}$/;

const resolveSearchApp = (appName) =>
    typeof appName === 'string' && APP_NAME_PATTERN.test(appName.trim())
        ? appName.trim()
        : DEFAULT_SEARCH_APP;

const CustomOpenSearch = ({ dashboardApi, itemDefinition, dataSources, standalone = false, label = 'Open in Search' }) => {
    const [disabled, setDisabled] = useState(true);
    const [splSearch, setSplSearch] = useState();
    const [searchApp, setSearchApp] = useState(DEFAULT_SEARCH_APP);
    const [searches, setSearches] = useState([]);
    const [earliest, setEarliest] = useState('-24h@h');
    const [latest, setLatest] = useState('now');

    useEffect(() => {
        const getSearchesList = async () => {
            const data = await getSearches();
            setSearches(data.entry);
        };
        getSearchesList();
    }, []);

    const resolveTokenValue = useCallback(
        (value) =>
            resolveOpenSearchQuery(
                value,
                dashboardApi?.getDefinition?.().inputs || {},
                new URLSearchParams(window.location.search),
            ),
        [dashboardApi],
    );

    const getGlobalTimeValue = useCallback(
        (timePart) => {
            const token = `${GLOBAL_TIME_TOKEN}.${timePart}`;
            const fallback = timePart === 'earliest' ? DEFAULT_EARLIEST : DEFAULT_LATEST;
            return (
                resolveOpenSearchToken(
                    token,
                    dashboardApi?.getDefinition?.().inputs || {},
                    new URLSearchParams(window.location.search),
                ) || fallback
            );
        },
        [dashboardApi],
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
                let spl;
                let dataSourceRegistry;
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

                if (primaryDataSource.type === 'ds.chain') {
                    setSearchApp(DEFAULT_SEARCH_APP);
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
                } else if (primaryDataSource.type === 'ds.searchbase') {
                    if (primaryDataSource.options.ref) {
                        const search = searches.find(
                            (s) => s.name === primaryDataSource.options.ref,
                        );
                        if (search) {
                            const resolvedOptions = dataSourceRegistry.getDataSourceController(primaryDataSourceId)?.def?.options || primaryDataSource.options;
                            try {
                                spl = applyDcNetworkingScope(search.content.search, resolvedOptions.dcScope);
                            } catch {
                                setDisabled(true);
                                return;
                            }
                            setSearchApp(resolveSearchApp(search.content.dispatch_context));
                            setResolvedTimeRange(
                                dataSourceRegistry.getDataSourceController(primaryDataSourceId)?.def
                                    ?.options?.queryParameters ||
                                    primaryDataSource.options?.queryParameters,
                            );
                            setDisabled(false);
                        }
                    }
                } else if (primaryDataSource.type === 'ds.search') {
                    setSearchApp(DEFAULT_SEARCH_APP);
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
                    setSplSearch(resolveTokenValue(spl));
                }
            }
        }
    }, [
        searches,
        dashboardApi,
        itemDefinition,
        dataSources,
        resolveTokenValue,
        setResolvedTimeRange,
    ]);

    const SearchButton = standalone ? Button : ActionButton;
    return (
        <SearchButton
            title={label}
            aria-label={label}
            {...(standalone ? { appearance: 'subtle', hideLabel: true, label } : {})}
            data-test="CustomOpenSearchButton" // for testing
            onClick={() => {
                const registry = dashboardApi.dataSourceRegistry || dashboardApi.getDataSourceRegistry?.();
                const currentParameters = registry?.getDataSourceController(itemDefinition.dataSources?.primary)?.def?.options?.queryParameters;
                const currentEarliest = resolveTokenValue(currentParameters?.earliest) || earliest;
                const currentLatest = resolveTokenValue(currentParameters?.latest) || latest;
                window.open(
                    `/app/${searchApp}/search?earliest=${encodeURIComponent(
                        currentEarliest,
                    )}&latest=${encodeURIComponent(currentLatest)}&q=${encodeURIComponent(splSearch)}`,
                    '_blank',
                );
            }}
            icon={standalone ? <ExternalLink aria-hidden="true" /> : ActionButtonIcon} // icon for this button
            disabled={disabled}
        />
    );
};

const sourceShape = PropTypes.shape({
    type: PropTypes.string,
    options: PropTypes.shape({
        query: PropTypes.string,
        ref: PropTypes.string,
        extend: PropTypes.string,
        queryParameters: PropTypes.shape({ earliest: PropTypes.string, latest: PropTypes.string }),
    }),
});
CustomOpenSearch.propTypes = {
    standalone: PropTypes.bool,
    label: PropTypes.string,
    dashboardApi: PropTypes.shape({
        getDefinition: PropTypes.func,
        getDataSourceRegistry: PropTypes.func,
        dataSourceRegistry: PropTypes.shape({ getDataSourceController: PropTypes.func }),
    }).isRequired,
    itemDefinition: PropTypes.shape({ dataSources: PropTypes.shape({ primary: PropTypes.string }) }).isRequired,
    dataSources: PropTypes.objectOf(sourceShape).isRequired,
};

export default CustomOpenSearch;
