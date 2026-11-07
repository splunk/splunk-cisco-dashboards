import { cloneDeep } from 'lodash-es';
import { getSearchBaseConfStanza } from '../../common/lib/searchbase';
import { requiresDashboardManagerRuntime } from '../../common/config/managedStudioViews';

const SEARCHBASE_DATA_SOURCE_TYPE = 'ds.searchbase';
const SEARCH_DATA_SOURCE_TYPE = 'ds.search';
const SIMPLE_TIME_PICKER_INPUT_TYPE = 'input.simpleTimePicker';
const NATIVE_TIME_RANGE_INPUT_TYPE = 'input.timerange';

export const hasSearchbaseDataSources = (definition = {}) =>
    Object.values(definition?.dataSources || {}).some(
        (dataSource) => dataSource?.type === SEARCHBASE_DATA_SOURCE_TYPE,
    );

// Older conversions already contain inline SPL, but can still require the
// Manager's time-span token or visualization extensions. Let users repair them.
export const needsNativeStudioConversion = (definition = {}) =>
    requiresDashboardManagerRuntime(definition) ||
    definition.applicationProperties?.hideEdit === true ||
    Object.values(definition.inputs || {}).some((input) =>
        input?.type === NATIVE_TIME_RANGE_INPUT_TYPE &&
        String(input.options?.defaultValue || '').split(',').length > 2,
    ) ||
    Object.values(definition.dataSources || {}).some((source) =>
        source?.type === SEARCH_DATA_SOURCE_TYPE &&
        source.options?.queryParameters?.span !== undefined,
    );

const removeLayoutItems = (value, removedIds) => {
    if (Array.isArray(value)) {
        return value.filter((item) => !removedIds.has(item?.item))
            .map((item) => removeLayoutItems(item, removedIds));
    }
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([key, child]) =>
            [key, removeLayoutItems(child, removedIds)],
        ));
    }
    return value;
};

const getSearchbaseSearch = async (ref, ownerApp) => {
    const data = await getSearchBaseConfStanza(ref, ownerApp);
    const search = data?.entry?.[0];

    if ((data.status && (data.status < 200 || data.status >= 300)) || !search?.content?.search) {
        throw new Error(`Searchbase stanza "${ref}" did not return a search.`);
    }

    return search.content.search;
};

export const resolveSearchbaseDefinitionForNativeStudio = async (definition = {}) => {
    if (Object.values(definition.dataSources || {}).some((source) => source.options?.dcScope)) {
        throw new Error('DC Networking scope filters require Dashboard Manager. Keep this dashboard in Dashboard Manager so investigation scope is preserved.');
    }
    const resolvedDefinition = cloneDeep(definition || {});
    const dataSources = resolvedDefinition.dataSources || {};

    const dataSourceUpdates = await Promise.all(
        Object.entries(dataSources)
            .filter(([, value]) => value?.type === SEARCHBASE_DATA_SOURCE_TYPE)
            .map(async ([key, value]) => {
                const ref = value?.options?.ref;

                if (!ref) {
                    throw new Error(`Searchbase data source "${key}" is missing a ref.`);
                }

                const query = await getSearchbaseSearch(ref, value?.options?.ownerApp);
                const options = {
                    ...value.options,
                    query,
                };

                delete options.ref;
                delete options.ownerApp;

                return {
                    key,
                    newDataSource: {
                        ...value,
                        type: SEARCH_DATA_SOURCE_TYPE,
                        options,
                    },
                };
            }),
    );

    dataSourceUpdates.forEach(({ key, newDataSource }) => {
        dataSources[key] = newDataSource;
    });

    const inputs = resolvedDefinition.inputs || {};
    const inputUpdates = Object.entries(inputs)
        .filter(([, value]) => value?.type === SIMPLE_TIME_PICKER_INPUT_TYPE ||
            (value?.type === NATIVE_TIME_RANGE_INPUT_TYPE &&
                String(value.options?.defaultValue || '').split(',').length > 2))
        .map(([key, value]) => {
            const options = {
                ...value.options,
                defaultValue: (value.options?.defaultValue || '-24h@h,now').split(',').slice(0, 2).join(','),
            };

            delete options.selections;
            delete options.showAdvanced;

            return {
                key,
                newInput: {
                    ...value,
                    type: NATIVE_TIME_RANGE_INPUT_TYPE,
                    options,
                },
            };
        });

    inputUpdates.forEach(({ key, newInput }) => {
        inputs[key] = newInput;
    });

    // span is a Manager-only dispatch option, not a native search parameter.
    // Keeping it blocks dispatch because input.timerange only sets earliest/latest.
    Object.entries(dataSources).forEach(([id, source]) => {
        if (source.type === SEARCH_DATA_SOURCE_TYPE && source.options?.queryParameters) {
            const { span, ...queryParameters } = source.options.queryParameters;
            dataSources[id] = { ...source, options: { ...source.options, queryParameters } };
        }
    });

    const removedIds = new Set();
    Object.entries(resolvedDefinition.visualizations || {}).forEach(([id, viz]) => {
        if (viz.type === 'splunk.cisco_drilldown_action') {
            removedIds.add(id);
            delete resolvedDefinition.visualizations[id];
        }
    });
    resolvedDefinition.layout = removeLayoutItems(resolvedDefinition.layout, removedIds);

    if (requiresDashboardManagerRuntime(resolvedDefinition)) {
        throw new Error('This dashboard contains other Dashboard Manager extensions. Replace its custom visualizations or inputs before converting. No changes were applied.');
    }

    // Packaged Manager dashboards also hide editing inside the JSON itself.
    // Native Studio reads this independently of the XML hiddenElements metadata.
    resolvedDefinition.applicationProperties = {
        ...resolvedDefinition.applicationProperties,
        hideEdit: false,
    };

    return {
        definition: resolvedDefinition,
        convertedDataSources: dataSourceUpdates.length,
        convertedInputs: inputUpdates.length,
        removedActions: removedIds.size,
    };
};
