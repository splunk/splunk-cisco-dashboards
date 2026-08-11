const DRILLDOWN_PATH = '/drilldown';
const DASHBOARD_DRILLDOWN_URL_LIMIT = 4096;
const DASHBOARD_DRILLDOWN_TARGET_LIMIT = 24;
const DASHBOARD_DRILLDOWN_TARGET_LENGTH_LIMIT = 256;
const DASHBOARD_DRILLDOWN_VISUALIZATION_TYPES = new Set([
    'splunk.rectangle',
    'splunk.choropleth.svg',
]);
const TIME_INPUT_TYPES = new Set(['input.timerange', 'input.simpleTimePicker']);

export const DEFAULT_DASHBOARD_DRILLDOWN_TIME_RANGE = {
    earliest: '-24h@h',
    latest: 'now',
};

// Exact outlined paths from @splunk/react-icons/LayoutPanels, which is exposed
// as PanelRightOpen by common/icons/SuiIcon and used by the home dashboard.
export const DASHBOARD_DRILLDOWN_PANEL_ICON_SVG =
    '<svg aria-label="Open details panel" role="img" data-icon="PanelRightOpen" height="32px" viewBox="0 0 24 24" width="32px" xmlns="http://www.w3.org/2000/svg" fill="#64748b"><path fill-rule="evenodd" clip-rule="evenodd" d="M19.5 4C20.3284 4 21 4.67157 21 5.5V9L3 9L3 5.5C3 4.67157 3.67157 4 4.5 4L19.5 4ZM19 6L5 6L5 7L19 7V6Z"></path><path fill-rule="evenodd" clip-rule="evenodd" d="M3 11H14V20H4.5C3.67157 20 3 19.3284 3 18.5V11ZM5 13V18H12V13H5Z"></path><path fill-rule="evenodd" clip-rule="evenodd" d="M16 11H21V18.5C21 19.3284 20.3284 20 19.5 20H16V11ZM18 13V18H19V13H18Z"></path></svg>';
export const DASHBOARD_DRILLDOWN_PANEL_ICON_DATA_URL = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
    DASHBOARD_DRILLDOWN_PANEL_ICON_SVG,
)}`;

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

export const parseDashboardDrilldownUrl = (url) => {
    const normalizedUrl = normalizeText(url);
    if (
        !normalizedUrl ||
        normalizedUrl.length > DASHBOARD_DRILLDOWN_URL_LIMIT ||
        !(normalizedUrl === DRILLDOWN_PATH || normalizedUrl.startsWith(`${DRILLDOWN_PATH}?`))
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

export const createDashboardDrilldownIconVisualization = ({ origin, targetIds }) => ({
    type: 'splunk.image',
    options: {
        preserveAspectRatio: true,
        src: DASHBOARD_DRILLDOWN_PANEL_ICON_DATA_URL,
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

const getInternalDrilldown = (visualization) =>
    (visualization?.eventHandlers || [])
        .filter((handler) => handler?.type === 'drilldown.customUrl')
        .map((handler) => parseDashboardDrilldownUrl(handler?.options?.url))
        .find(Boolean);

export const normalizeDashboardDrilldownIcons = (definition) => {
    if (!definition || typeof definition !== 'object') {
        return definition;
    }

    let changed = false;
    const visualizations = Object.fromEntries(
        Object.entries(definition.visualizations || {}).map(([visualizationId, visualization]) => {
            if (
                !DASHBOARD_DRILLDOWN_VISUALIZATION_TYPES.has(visualization?.type) ||
                !getInternalDrilldown(visualization)
            ) {
                return [visualizationId, visualization];
            }

            changed = true;

            return [
                visualizationId,
                {
                    ...visualization,
                    type: 'splunk.image',
                    options: {
                        preserveAspectRatio: true,
                        src: DASHBOARD_DRILLDOWN_PANEL_ICON_DATA_URL,
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

export const buildDashboardDrilldownDefinition = (
    entry,
    timeRange = DEFAULT_DASHBOARD_DRILLDOWN_TIME_RANGE,
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
        layout: {
            type: 'absolute',
            options: {
                width: 1120,
                height: 520,
                display: 'fit-to-width',
                showTitleAndDescription: false,
            },
            structure: [
                {
                    item: 'viz_drilldown_result',
                    type: 'block',
                    position: {
                        x: 0,
                        y: 0,
                        w: 1120,
                        h: 520,
                    },
                },
            ],
        },
    };
};
