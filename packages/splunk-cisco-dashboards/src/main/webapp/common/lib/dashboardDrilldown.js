const DRILLDOWN_PATH = '/drilldown';
const METRIC_INFO_PATH = '/metric-info';
const DASHBOARD_DRILLDOWN_URL_LIMIT = 4096;
const DASHBOARD_DRILLDOWN_TARGET_LIMIT = 24;
const DASHBOARD_DRILLDOWN_TARGET_LENGTH_LIMIT = 256;
export const DASHBOARD_DRILLDOWN_ACTION_TYPE = 'splunk.cisco_drilldown_action';
const DASHBOARD_DRILLDOWN_VISUALIZATION_TYPES = new Set([
    'splunk.rectangle',
    'splunk.choropleth.svg',
    'splunk.image',
]);
const TIME_INPUT_TYPES = new Set(['input.timerange', 'input.simpleTimePicker']);

export const DEFAULT_DASHBOARD_DRILLDOWN_TIME_RANGE = {
    earliest: '-24h@h',
    latest: 'now',
};

export const DASHBOARD_DRILLDOWN_ACCESSIBLE_TITLE = 'Investigate drivers';
export const DASHBOARD_METRIC_INFO_ACCESSIBLE_TITLE = 'About this metric';
export const DASHBOARD_ACTION_KIND_DRILLDOWN = 'drilldown';
export const DASHBOARD_ACTION_KIND_METRIC_INFO = 'metric-info';

const normalizeText = (value) => (typeof value === 'string' ? value.trim() : '');

const uniqueBoundedTargetIds = (target) => {
    const targetIds = [];
    const seen = new Set();

    normalizeText(target)
        .split(',')
        .some((rawTargetId) => {
            const targetId = rawTargetId.trim();
            if (
                !targetId ||
                targetId.length > DASHBOARD_DRILLDOWN_TARGET_LENGTH_LIMIT ||
                seen.has(targetId)
            ) {
                return false;
            }

            seen.add(targetId);
            targetIds.push(targetId);
            return targetIds.length >= DASHBOARD_DRILLDOWN_TARGET_LIMIT;
        });

    return targetIds;
};

const parseDashboardActionUrl = (url, path) => {
    const normalizedUrl = normalizeText(url);
    if (
        !normalizedUrl ||
        normalizedUrl.length > DASHBOARD_DRILLDOWN_URL_LIMIT ||
        !(normalizedUrl === path || normalizedUrl.startsWith(`${path}?`))
    ) {
        return null;
    }

    const query = normalizedUrl.includes('?') ? normalizedUrl.slice(normalizedUrl.indexOf('?') + 1) : '';
    const params = new URLSearchParams(query);
    const targetIds = uniqueBoundedTargetIds(params.get('target'));

    if (targetIds.length === 0) {
        return null;
    }

    return {
        origin: normalizeText(params.get('origin')),
        targetIds,
    };
};

export const parseDashboardDrilldownUrl = (url) =>
    parseDashboardActionUrl(url, DRILLDOWN_PATH);

export const parseDashboardMetricInfoUrl = (url) =>
    parseDashboardActionUrl(url, METRIC_INFO_PATH);

export const buildDashboardDrilldownUrl = ({ origin, targetIds = [] }) => {
    const params = new URLSearchParams();
    const normalizedOrigin = normalizeText(origin);
    const normalizedTargetIds = uniqueBoundedTargetIds(targetIds.join(','));

    if (normalizedOrigin) {
        params.set('origin', normalizedOrigin);
    }
    if (normalizedTargetIds.length > 0) {
        params.set('target', normalizedTargetIds.join(','));
    }

    return `${DRILLDOWN_PATH}?${params.toString()}`;
};

export const buildDashboardMetricInfoUrl = ({ origin, targetId }) => {
    const params = new URLSearchParams();
    const normalizedOrigin = normalizeText(origin);
    const [normalizedTargetId] = uniqueBoundedTargetIds(targetId);

    if (normalizedOrigin) {
        params.set('origin', normalizedOrigin);
    }
    if (normalizedTargetId) {
        params.set('target', normalizedTargetId);
    }

    return `${METRIC_INFO_PATH}?${params.toString()}`;
};

export const createDashboardDrilldownIconVisualization = ({ origin, targetIds }) => ({
    type: DASHBOARD_DRILLDOWN_ACTION_TYPE,
    options: {
        label: DASHBOARD_DRILLDOWN_ACCESSIBLE_TITLE,
    },
    eventHandlers: [
        {
            type: 'drilldown.customUrl',
            options: {
                url: buildDashboardDrilldownUrl({ origin, targetIds }),
            },
        },
    ],
});

export const createDashboardMetricInfoIconVisualization = ({ origin, targetId }) => ({
    type: DASHBOARD_DRILLDOWN_ACTION_TYPE,
    options: {
        action: DASHBOARD_ACTION_KIND_METRIC_INFO,
        label: DASHBOARD_METRIC_INFO_ACCESSIBLE_TITLE,
    },
    eventHandlers: [
        {
            type: 'drilldown.customUrl',
            options: {
                url: buildDashboardMetricInfoUrl({ origin, targetId }),
            },
        },
    ],
});

const getInternalDashboardAction = (visualization) => {
    const urls = (visualization?.eventHandlers || [])
        .filter((handler) => handler?.type === 'drilldown.customUrl')
        .map((handler) => handler?.options?.url);
    const metricInfo = urls.map(parseDashboardMetricInfoUrl).find(Boolean);
    if (metricInfo) {
        return { ...metricInfo, action: DASHBOARD_ACTION_KIND_METRIC_INFO };
    }
    const drilldown = urls.map(parseDashboardDrilldownUrl).find(Boolean);
    return drilldown ? { ...drilldown, action: DASHBOARD_ACTION_KIND_DRILLDOWN } : null;
};

export const normalizeDashboardDrilldownIcons = (definition) => {
    if (!definition || typeof definition !== 'object') {
        return definition;
    }

    let changed = false;
    const visualizations = Object.fromEntries(
        Object.entries(definition.visualizations || {}).map(([visualizationId, visualization]) => {
            const dashboardAction = getInternalDashboardAction(visualization);
            if (
                !DASHBOARD_DRILLDOWN_VISUALIZATION_TYPES.has(visualization?.type) ||
                !dashboardAction
            ) {
                return [visualizationId, visualization];
            }

            changed = true;

            return [
                visualizationId,
                {
                    ...visualization,
                    type: DASHBOARD_DRILLDOWN_ACTION_TYPE,
                    options: {
                        action: dashboardAction.action,
                        label:
                            dashboardAction.action === DASHBOARD_ACTION_KIND_METRIC_INFO
                                ? DASHBOARD_METRIC_INFO_ACCESSIBLE_TITLE
                                : DASHBOARD_DRILLDOWN_ACCESSIBLE_TITLE,
                    },
                },
            ];
        }),
    );

    return changed ? { ...definition, visualizations } : definition;
};

export const resolveDashboardDrilldownSearches = (entries = [], targetIds = []) => {
    const byId = new Map();

    entries.forEach((entry) => {
        const stanzaId = normalizeText(entry?.name);
        const searchName = normalizeText(entry?.content?.search_name);
        if (stanzaId && !byId.has(stanzaId)) {
            byId.set(stanzaId, entry);
        }
        if (searchName && !byId.has(searchName)) {
            byId.set(searchName, entry);
        }
    });

    const resolvedSearches = [];
    const missingTargetIds = [];
    const seenStanzas = new Set();

    uniqueBoundedTargetIds(targetIds.join(',')).forEach((targetId) => {
        const entry = byId.get(targetId);
        const stanzaId = normalizeText(entry?.name);

        if (!entry) {
            missingTargetIds.push(targetId);
        } else if (!seenStanzas.has(stanzaId)) {
            seenStanzas.add(stanzaId);
            resolvedSearches.push(entry);
        }
    });

    return { resolvedSearches, missingTargetIds };
};

export const getDashboardDrilldownMetadata = (entry) => ({
    title: normalizeText(entry?.content?.search_name) || normalizeText(entry?.name),
    category: normalizeText(entry?.content?.category),
    subCategory: normalizeText(entry?.content?.sub_category),
    description: normalizeText(entry?.content?.description),
    explanation: normalizeText(entry?.content?.explanation),
    solution: normalizeText(entry?.content?.solution),
    relatedInfo: normalizeText(entry?.content?.related_info),
    executionPlan: normalizeText(entry?.content?.execution_plan),
});

export const parseDashboardDrilldownTimeRange = (
    value,
    fallback = DEFAULT_DASHBOARD_DRILLDOWN_TIME_RANGE,
) => {
    let parts = [];
    if (Array.isArray(value)) {
        parts = value;
    } else if (typeof value === 'string') {
        parts = value.split(',');
    } else if (value && typeof value === 'object') {
        parts = [value.earliest, value.latest];
    }
    const earliest = normalizeText(parts[0]);
    const latest = normalizeText(parts[1]);

    return earliest && latest ? { earliest, latest } : { ...fallback };
};

export const getDashboardDrilldownInitialTimeRange = (definition = {}) => {
    const inputs = definition.inputs || {};
    const globalInputIds = Array.isArray(definition?.layout?.globalInputs)
        ? definition.layout.globalInputs
        : [];
    const orderedInputIds = [
        ...globalInputIds,
        ...Object.keys(inputs).filter((inputId) => !globalInputIds.includes(inputId)),
    ];
    const timeInput = orderedInputIds
        .map((inputId) => inputs[inputId])
        .find((input) => TIME_INPUT_TYPES.has(input?.type));

    return parseDashboardDrilldownTimeRange(timeInput?.options?.defaultValue);
};

const safeVisualizationType = (value) => {
    const normalizedValue = normalizeText(value);
    return /^splunk\.[a-z0-9_.-]+$/i.test(normalizedValue) ? normalizedValue : 'splunk.table';
};

const parseVisualizationOptions = (value) => {
    if (!value) {
        return {};
    }
    if (typeof value === 'object' && !Array.isArray(value)) {
        return value;
    }

    try {
        const options = JSON.parse(value);
        return options && typeof options === 'object' && !Array.isArray(options) ? options : {};
    } catch (_error) {
        return {};
    }
};

const buildDrilldownLayout = ({ width = 1120, height }) => {
    const canvasWidth = Number.isFinite(width) && width > 0 ? Math.floor(width) : 1120;
    const canvasHeight = Number.isFinite(height) && height > 0 ? Math.floor(height) : 420;

    return {
        type: 'absolute',
        options: {
            width: canvasWidth,
            height: canvasHeight,
            display: 'actual-size',
            showTitleAndDescription: false,
        },
        structure: [
            {
                item: 'viz_drilldown_result',
                type: 'block',
                position: {
                    x: 0,
                    y: 0,
                    w: canvasWidth,
                    h: canvasHeight,
                },
            },
        ],
    };
};

export const buildWorkspaceDrilldownDefinition = (
    target,
    timeRange = DEFAULT_DASHBOARD_DRILLDOWN_TIME_RANGE,
    layoutDimensions = {},
) => {
    const searchName = normalizeText(target?.searchName) || 'Search details';
    const visualizationType = safeVisualizationType(target?.defaultViz);
    const visualizationOptions = parseVisualizationOptions(target?.vizOptions);
    const dispatchContext = normalizeText(target?.dispatchContext);

    return {
        title: searchName,
        description: '',
        visualizations: {
            viz_drilldown_result: {
                type: visualizationType,
                title: searchName,
                options:
                    visualizationType === 'splunk.table'
                        ? {
                              count: 50,
                              showInternalFields: false,
                              ...visualizationOptions,
                          }
                        : visualizationOptions,
                dataSources: {
                    primary: 'ds_drilldown_target',
                },
            },
        },
        dataSources: {
            ds_drilldown_target: {
                type: 'ds.search',
                name: searchName,
                options: {
                    query: normalizeText(target?.search),
                    queryParameters: parseDashboardDrilldownTimeRange(timeRange),
                    ...(dispatchContext ? { app: dispatchContext } : {}),
                },
            },
        },
        defaults: {},
        inputs: {},
        layout: buildDrilldownLayout({ height: 420, ...layoutDimensions }),
    };
};

export const buildDashboardDrilldownDefinition = (
    entry,
    timeRange = DEFAULT_DASHBOARD_DRILLDOWN_TIME_RANGE,
    layoutDimensions = {},
) => {
    const stanzaId = normalizeText(entry?.name);
    const searchName = normalizeText(entry?.content?.search_name) || stanzaId || 'Search details';
    const visualizationType = safeVisualizationType(entry?.content?.default_viz);
    const visualizationOptions = parseVisualizationOptions(entry?.content?.viz_options);

    return {
        title: searchName,
        description: '',
        visualizations: {
            viz_drilldown_result: {
                type: visualizationType,
                title: searchName,
                options:
                    visualizationType === 'splunk.table'
                        ? {
                              count: 50,
                              showInternalFields: false,
                              ...visualizationOptions,
                          }
                        : visualizationOptions,
                dataSources: {
                    primary: 'ds_drilldown_target',
                },
            },
        },
        dataSources: {
            ds_drilldown_target: {
                type: 'ds.searchbase',
                name: searchName,
                options: {
                    ref: stanzaId,
                    ...(normalizeText(entry?.acl?.app) ? { ownerApp: entry.acl.app.trim() } : {}),
                    queryParameters: parseDashboardDrilldownTimeRange(timeRange),
                },
            },
        },
        defaults: {},
        inputs: {},
        layout: buildDrilldownLayout({ height: 520, ...layoutDimensions }),
    };
};
