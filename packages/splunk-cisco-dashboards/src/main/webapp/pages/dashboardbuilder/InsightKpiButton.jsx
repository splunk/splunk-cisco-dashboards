import React, { useEffect, useId, useState } from 'react';
import { IconButton } from '@splunk/dashboard-toolbar';
import Layout from '@splunk/react-ui/Layout';
import Typography from '@splunk/react-ui/Typography';
import { cloneDeep } from 'lodash-es';
import {
    getSearchbaseCatalogue,
    plainTextFromHtml,
} from '../../common/services/searchbaseCatalogue';
import DropdownWithSearch from './DropdownWithSearch';
import { getDashboardTimeQueryParameters } from './dashboardTimeUtils';

const LAYOUT_MARGIN = 24;
const LAYOUT_GAP = 24;
const MIN_KPI_WIDTH = 560;
const MAX_KPI_WIDTH = 660;
const DEFAULT_KPI_HEIGHT = 260;
const SINGLE_VALUE_KPI_HEIGHT = 190;
const TABLE_KPI_HEIGHT = 320;
const SEARCHBASE_ICON_SRC = '/static/app/splunk-cisco-dashboards/searchbase-app-icon.png';
const DARK_TREND_COLOR = '#8bb8ff';
const LIGHT_TREND_COLOR = '#006d9c';

const generateRandomString = (length = 10) => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
};

const createDataSourceName = (search) => {
    const rawName = [search.ownerApp, search.id || search.searchName]
        .filter(Boolean)
        .join('_') || generateRandomString();
    const safeName = rawName.replace(/[^A-Za-z0-9_]/g, '_').replace(/^_+/, '');
    return `ds_${safeName || generateRandomString()}`;
};

const newInsightKpiVizConfig = (
    search,
    searchKey,
    trendColor = DARK_TREND_COLOR,
) => {
    const visualizationType = search.defaultViz || 'splunk.table';
    const options = search.vizOptions || {};
    const isSingleValue = visualizationType.toLowerCase().includes('singlevalue');
    return {
        visualizationId: `viz_insightKpi_${generateRandomString()}`,
        visualizationDefinition: {
            type: visualizationType,
            title: search.searchName,
            description: plainTextFromHtml(search.description || ''),
            dataSources: {
                primary: searchKey,
            },
            options: isSingleValue
                ? {
                      trendColor,
                      ...options,
                  }
                : options,
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
            ? LAYOUT_MARGIN
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
    const trendColor =
        props.colorScheme === 'light' ? LIGHT_TREND_COLOR : DARK_TREND_COLOR;
    // get all searches
    const [searches, setSearches] = useState([]);
    const [selectedKpis, setSelectedKpis] = useState([]);
    const helpTextId = useId();

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
            const queryParameters = getDashboardTimeQueryParameters(
                dashboardApi.coreApi.getDefinition(),
            );

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
                            ownerApp: selectedKpi.ownerApp,
                            queryParameters,
                        },
                        name: searchName,
                    });
                    searchKey = findKeyForDsName(
                        dashboardApi.coreApi.getDefinition().dataSources,
                        searchName,
                    );
                }

                if (searchKey) {
                    const visualizationConfig = newInsightKpiVizConfig(
                        selectedKpi,
                        searchKey,
                        trendColor,
                    );
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
        <Layout>
            <DropdownWithSearch
                onSelect={(selection) => {
                    if (selection) {
                        setSelectedKpis(searches.filter((s) => selection.includes(s.id)));
                    }
                }}
                appearance="primary"
                ariaLabel="Add Searchbase searches"
                className="dashboardbuilder-searchbase-toolbar-control"
                describedBy={helpTextId}
                label="Add Searchbase"
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
                style={{ marginLeft: 10 }}
                searches={searches.filter((s) => s.searchName != undefined && s.id != undefined)}
            />
            <Typography
                as="span"
                color="inherit"
                id={helpTextId}
                lineHeight="normal"
                variant="smallBody"
            >
                Browse reusable, centrally managed searches from the Cisco Searchbase catalogue.
            </Typography>
        </Layout>
    );
};

InsightKpiButton.propTypes = {
    ...IconButton.propTypes,
};

InsightKpiButton.defaultProps = {
    ...IconButton.defaultProps,
};

export default InsightKpiButton;
