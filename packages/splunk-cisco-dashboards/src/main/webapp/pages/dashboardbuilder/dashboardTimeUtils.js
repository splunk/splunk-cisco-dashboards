const TIME_INPUT_TYPES = new Set(['input.timerange', 'input.simpleTimePicker']);

const isTimeInput = (input) => TIME_INPUT_TYPES.has(input?.type);

const getInputTimeToken = (definition = {}) => {
    const inputs = definition?.inputs || {};
    const globalInputIds = Array.isArray(definition?.layout?.globalInputs)
        ? definition.layout.globalInputs
        : [];
    const orderedInputs = [
        ...globalInputIds.map((id) => [id, inputs[id]]),
        ...Object.entries(inputs).filter(([id]) => !globalInputIds.includes(id)),
    ];

    return orderedInputs
        .map(([, input]) => input)
        .find((input) => isTimeInput(input) && typeof input?.options?.token === 'string')
        ?.options?.token?.trim();
};

const toQueryParameters = (token) => ({
    earliest: `$${token}.earliest$`,
    latest: `$${token}.latest$`,
});

export const getDashboardTimeQueryParameters = (definition = {}) => {
    const token = getInputTimeToken(definition);

    return toQueryParameters(token || 'global_time');
};

export const repairSearchbaseTimeQueryParameters = (definition = {}) => {
    const expectedQueryParameters = getDashboardTimeQueryParameters(definition);
    const expectedToken = getInputTimeToken(definition);

    // A dashboard without a configured time input legitimately uses global_time.
    if (!expectedToken || expectedToken === 'global_time') {
        return definition;
    }

    let hasChanges = false;
    const dataSources = Object.fromEntries(
        Object.entries(definition.dataSources || {}).map(([id, dataSource]) => {
            const queryParameters = dataSource?.options?.queryParameters;
            const usesLegacyGlobalTime =
                dataSource?.type === 'ds.searchbase' &&
                queryParameters?.earliest === '$global_time.earliest$' &&
                queryParameters?.latest === '$global_time.latest$';

            if (!usesLegacyGlobalTime) {
                return [id, dataSource];
            }

            hasChanges = true;
            return [
                id,
                {
                    ...dataSource,
                    options: {
                        ...dataSource.options,
                        queryParameters: expectedQueryParameters,
                    },
                },
            ];
        }),
    );

    return hasChanges ? { ...definition, dataSources } : definition;
};
