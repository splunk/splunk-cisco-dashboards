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

export const DASHBOARD_DRILLDOWN_ACCESSIBLE_TITLE = 'Open drill-down details';

// Exact paths from @splunk/react-icons/MagnifierWithPlus. The Dashboard Studio
// image visualization cannot render the React component directly, so it uses
// this self-contained SVG with an accessible label for the modal action.
export const DASHBOARD_DRILLDOWN_PANEL_ICON_SVG =
    '<svg aria-label="Open drill-down details" role="img" data-icon="MagnifierWithPlus" height="32px" viewBox="0 0 24 24" width="32px" xmlns="http://www.w3.org/2000/svg" fill="#64748b"><title>Open drill-down details</title><path d="M19 3C19 2.44772 18.5523 2 18 2C17.4477 2 17 2.44772 17 3V5H15C14.4477 5 14 5.44772 14 6C14 6.55228 14.4477 7 15 7H17V9C17 9.55228 17.4477 10 18 10C18.5523 10 19 9.55228 19 9V7H21C21.5523 7 22 6.55228 22 6C22 5.44772 21.5523 5 21 5H19V3Z"></path><path fill-rule="evenodd" clip-rule="evenodd" d="M11.0228 17.4363C10.0919 18.0887 8.95818 18.4716 7.73507 18.4716C4.56768 18.4716 2 15.9039 2 12.7365C2 9.56914 4.56768 7.00146 7.73507 7.00146C10.9025 7.00146 13.4701 9.56914 13.4701 12.7365C13.4701 13.9585 13.088 15.0912 12.4366 16.0217L15.707 19.292C16.0975 19.6826 16.0975 20.3157 15.707 20.7063C15.3164 21.0968 14.6833 21.0968 14.2928 20.7063L11.0228 17.4363ZM11.4701 12.7365C11.4701 14.7994 9.79789 16.4716 7.73507 16.4716C5.67225 16.4716 4 14.7994 4 12.7365C4 10.6737 5.67225 9.00146 7.73507 9.00146C9.79789 9.00146 11.4701 10.6737 11.4701 12.7365Z"></path></svg>';
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
        title: DASHBOARD_DRILLDOWN_ACCESSIBLE_TITLE,
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
                        ...visualization.options,
                        preserveAspectRatio: true,
                        src: DASHBOARD_DRILLDOWN_PANEL_ICON_DATA_URL,
                        title: DASHBOARD_DRILLDOWN_ACCESSIBLE_TITLE,
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
