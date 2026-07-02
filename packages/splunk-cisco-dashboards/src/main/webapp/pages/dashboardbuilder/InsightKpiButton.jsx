import React, { useState, useEffect } from 'react';
import { IconButton } from '@splunk/dashboard-toolbar';
import Tooltip from '@splunk/react-ui/Tooltip';
import { cloneDeep } from 'lodash-es';
import {
    getSearchbaseCatalogue,
    plainTextFromHtml,
} from '../../common/services/searchbaseCatalogue';
import DropdownWithSearch from './DropdownWithSearch';

const GLOBAL_TIME_QUERY_PARAMETERS = {
    earliest: '$global_time.earliest$',
    latest: '$global_time.latest$',
};

const LAYOUT_MARGIN = 24;
const LAYOUT_GAP = 24;
const MIN_KPI_WIDTH = 560;
const MAX_KPI_WIDTH = 660;
const DEFAULT_KPI_HEIGHT = 260;
const SINGLE_VALUE_KPI_HEIGHT = 190;
const TABLE_KPI_HEIGHT = 320;
const SEARCHBASE_ICON_SRC = '/static/app/splunk-cisco-dashboards/searchbase-app-icon.png';

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

const getActiveLayout = (definition, dashboardApi) => {
    const layout = definition?.layout;
    if (!layout) return undefined;

    if (layout.layoutDefinitions) {
        const activeTab = dashboardApi.getActiveTab?.();
        const activeLayoutKey =
            activeTab && layout.layoutDefinitions[activeTab]
                ? activeTab
                : Object.keys(layout.layoutDefinitions)[0];

        return activeLayoutKey ? layout.layoutDefinitions[activeLayoutKey] : undefined;
    }

    return layout;
};

const getVisualizationHeight = (visualizationType = '') => {
    if (visualizationType.includes('singlevalue')) return SINGLE_VALUE_KPI_HEIGHT;
    if (visualizationType.includes('table')) return TABLE_KPI_HEIGHT;
    return DEFAULT_KPI_HEIGHT;
};

const getLayoutBounds = (structure = []) =>
    structure.reduce(
        (bounds, item) => {
            const position = item?.position || {};
            const x = Number(position.x) || 0;
            const y = Number(position.y) || 0;
            const w = Number(position.w) || 0;
            const h = Number(position.h) || 0;

            return {
                bottom: Math.max(bounds.bottom, y + h),
                right: Math.max(bounds.right, x + w),
            };
        },
        { bottom: 0, right: 0 },
    );

const applyKpiLayout = (dashboardApi, visualizationConfigs) => {
    if (!visualizationConfigs.length) return;

    const definition = cloneDeep(dashboardApi.coreApi.getDefinition());
    const activeLayout = getActiveLayout(definition, dashboardApi);

    if (!activeLayout) return;

    const createdVisualizationIds = new Set(
        visualizationConfigs.map((config) => config.visualizationId),
    );
    const existingStructure = (activeLayout.structure || []).filter(
        (item) => !createdVisualizationIds.has(item?.item),
    );
    const canvasOptions = activeLayout.options || definition.layout?.options || {};
    const canvasWidth = Number(canvasOptions.width) || 1440;
    const availableWidth = Math.max(canvasWidth - LAYOUT_MARGIN * 2, MIN_KPI_WIDTH);
    const columns = Math.max(
        1,
        Math.floor((availableWidth + LAYOUT_GAP) / (MIN_KPI_WIDTH + LAYOUT_GAP)),
    );
    const tileWidth = Math.min(
        MAX_KPI_WIDTH,
        Math.floor((availableWidth - LAYOUT_GAP * (columns - 1)) / columns),
    );
    const startY =
        existingStructure.length === 0
            ? 0
            : Math.ceil((getLayoutBounds(existingStructure).bottom + LAYOUT_GAP) / LAYOUT_GAP) *
              LAYOUT_GAP;

    let rowY = startY;
    let rowHeight = 0;

    const createdStructure = visualizationConfigs.map((config, index) => {
        const column = index % columns;

        if (index > 0 && column === 0) {
            rowY += rowHeight + LAYOUT_GAP;
            rowHeight = 0;
        }

        const tileHeight = getVisualizationHeight(config.visualizationDefinition.type);
        rowHeight = Math.max(rowHeight, tileHeight);

        return {
            item: config.visualizationId,
            position: {
                h: tileHeight,
                w: tileWidth,
                x: LAYOUT_MARGIN + column * (tileWidth + LAYOUT_GAP),
                y: rowY,
            },
            type: 'block',
        };
    });

    const nextHeight =
        getLayoutBounds([...existingStructure, ...createdStructure]).bottom + LAYOUT_MARGIN;
    activeLayout.structure = [...existingStructure, ...createdStructure];
    activeLayout.options = {
        ...activeLayout.options,
        height: Math.max(Number(activeLayout.options?.height) || 0, nextHeight),
        width: canvasWidth,
    };

    if (dashboardApi.updateDefinition) {
        dashboardApi.updateDefinition(definition);
    } else {
        dashboardApi.coreApi.updateDefinition?.(definition);
    }
};

const InsightKpiButton = (props) => {
    // get all searches
    const [searches, setSearches] = useState([]);
    const [selectedKpis, setSelectedKpis] = useState([]);

    useEffect(() => {
        if (searches.length == 0) {
            const getSearchesList = async () => {
                const data = await getSearchbaseCatalogue({ allApps: true, includeHidden: true });
                setSearches(data.filter((search) => search.id && search.searchName));
            };
            getSearchesList();
        }
    }, []);

    useEffect(() => {
        if (selectedKpis && selectedKpis.length > 0) {
            const { dashboardApi } = props;
            const visualizationConfigs = [];

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
                            queryParameters: GLOBAL_TIME_QUERY_PARAMETERS,
                        },
                        name: searchName,
                    });
                    searchKey = findKeyForDsName(
                        dashboardApi.coreApi.getDefinition().dataSources,
                        searchName,
                    );
                }

                if (searchKey) {
                    const visualizationConfig = newInsightKpiVizConfig(selectedKpi, searchKey);
                    visualizationConfigs.push(visualizationConfig);
                    dashboardApi.coreApi.createVisualization(visualizationConfig);
                }
            });

            applyKpiLayout(dashboardApi, visualizationConfigs);
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
            <Tooltip content="Cisco extension: add Searchbase KPIs">
                <DropdownWithSearch
                    onSelect={(selection) => {
                        if (selection) {
                            setSelectedKpis(searches.filter((s) => selection.includes(s.id)));
                        }
                    }}
                    appearance="subtle"
                    icon={
                        <img
                            alt=""
                            className="dashboardbuilder-searchbase-toolbar-icon"
                            src={SEARCHBASE_ICON_SRC}
                            style={{
                                width: 24,
                                height: 24,
                            }}
                        />
                    }
                    style={{ maxWidth: 40, marginLeft: 10 }}
                    searches={searches.filter(
                        (s) => s.searchName != undefined && s.id != undefined,
                    )}
                ></DropdownWithSearch>
            </Tooltip>
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
