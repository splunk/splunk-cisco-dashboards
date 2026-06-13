import { cloneDeep } from 'lodash-es';
import { getSearchBaseConfStanza } from '../../common/lib/searchbase';

const SEARCHBASE_DATA_SOURCE_TYPE = 'ds.searchbase';
const SEARCH_DATA_SOURCE_TYPE = 'ds.search';
const SIMPLE_TIME_PICKER_INPUT_TYPE = 'input.simpleTimePicker';
const NATIVE_TIME_RANGE_INPUT_TYPE = 'input.timerange';

export const hasSearchbaseDataSources = (definition = {}) =>
    Object.values(definition?.dataSources || {}).some(
        (dataSource) => dataSource?.type === SEARCHBASE_DATA_SOURCE_TYPE,
    );

const getSearchbaseSearch = async (ref) => {
    const data = await getSearchBaseConfStanza(ref);
    const search = data?.entry?.[0];

    if (!search?.content?.search) {
        throw new Error(`Searchbase stanza "${ref}" did not return a search.`);
    }

    return search.content.search;
};

export const resolveSearchbaseDefinitionForNativeStudio = async (definition = {}) => {
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

                const query = await getSearchbaseSearch(ref);
                const options = {
                    ...value.options,
                    query,
                };

                delete options.ref;

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
        .filter(([, value]) => value?.type === SIMPLE_TIME_PICKER_INPUT_TYPE)
        .map(([key, value]) => {
            const options = {
                ...value.options,
                defaultValue: value.options?.defaultValue || '-24h@h,now',
            };

            delete options.selections;

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

    return {
        definition: resolvedDefinition,
        convertedDataSources: dataSourceUpdates.length,
        convertedInputs: inputUpdates.length,
    };
};
