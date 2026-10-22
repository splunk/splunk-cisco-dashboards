import { Options } from '@splunk/visualization-encoding/Options';

const numeric = (value) => value !== null && value !== undefined && value !== ''
    && Number.isFinite(Number(value));
const automatic = (value) => value === undefined || value === null || value === 'auto' || value === '';
const directSource = (expression, sources) => typeof expression === 'string'
    && Object.prototype.hasOwnProperty.call(sources, expression.match(/^>\s*(\w+)\s*\|/)?.[1]);

export function chartDataSources(type, sources = {}, options = {}, schema = {}) {
    if (!['splunk.line', 'splunk.area', 'splunk.column', 'splunk.bar', 'splunk.scatter'].includes(type)) { return sources; }
    const expression = options.x ?? schema.x?.default;
    let timeSource = typeof expression === 'string'
        ? expression.match(/^>\s*(\w+)\s*\|\s*seriesByName\(["']_time["']\)\s*$/)?.[1] : undefined;
    const indexed = typeof expression === 'string'
        ? expression.match(/^>\s*(\w+)\s*\|\s*seriesByIndex\((\d+)\)\s*$/) : undefined;
    if (!timeSource && indexed) {
        const field = sources[indexed[1]]?.data?.fields?.[Number(indexed[2])];
        if ((field?.name || field) === '_time') { [, timeSource] = indexed; }
    }
    if (!timeSource) { return sources; }
    let result = sources;
    Object.entries(sources).forEach(([name, source]) => {
        if (name !== timeSource) { return; }
        const data = source?.data;
        const index = data?.fields?.findIndex((field) => (field.name || field) === '_time');
        if (!(index >= 0) || !Array.isArray(data.columns?.[index])) { return; }
        const valid = data.columns[index].map((value, row) => ({ value, row }))
            .filter(({ value }) => numeric(value) || (typeof value === 'string' && value.trim() !== ''
                && Number.isFinite(Date.parse(value)))).map(({ row }) => row);
        if (valid.length === data.columns[index].length) { return; }
        result = { ...result, [name]: { ...source, data: { ...data,
            columns: data.columns.map((column) => valid.map((row) => column[row])),
        } } };
    });
    return result;
}

// Run before the vendor visualization evaluates its dependent color expressions.
// Preserve data, headline metrics and explicit user ranges; never invent samples.
export function sparseVisualizationOptions(type, props, schema = {}) {
    const { options = {}, context = {}, dataSources = {} } = props;
    let result = options;
    const sparklineExpression = options.sparklineValues ?? schema.sparklineValues?.default;
    const trendExpression = options.trendValue ?? schema.trendValue?.default;
    if (type === 'splunk.singlevalue' && directSource(sparklineExpression, dataSources)
        && /^>\s*sparklineValues\s*\|\s*delta\(-2\)\s*$/.test(trendExpression)) {
        const { sparklineValues, majorValue } = Options.evaluate({ context, options: {
            sparklineValues: sparklineExpression,
            majorValue: options.majorValue ?? schema.majorValue?.default,
        } }, dataSources);
        const root = sparklineExpression.match(/^>\s*(\w+)/)?.[1];
        const frame = Options.dataFrameFromDataSource(dataSources)[root];
        const named = sparklineExpression.match(/seriesByName\(["']([^"']+)["']\)/);
        let seriesType;
        if (named) { seriesType = frame?.seriesByName(named[1])?.type; }
        else if (sparklineExpression === schema.sparklineValues?.default) {
            seriesType = frame?.seriesByPrioritizedTypes('number', 'string', 'time')?.type;
        }
        if (!Array.isArray(sparklineValues) || sparklineValues.length < 2
            || (seriesType && seriesType !== 'number')
            || !sparklineValues.slice(-2).every((value) => typeof value === 'number' && Number.isFinite(value))) {
            result = { ...result, trendDisplay: 'off', showTrendIndicator: false,
                trendValue: '', trendColor: null };
        }
        if (!numeric(majorValue) && /rangeValue/.test(options.majorColor || '')) {
            result = { ...result, majorColor: null };
        }
    }
    const yExpression = options.y ?? schema.y?.default;
    if (['splunk.line', 'splunk.area'].includes(type) && directSource(yExpression, dataSources)
        && (!options.yAxisScale || options.yAxisScale === 'linear')
        && automatic(options.yAxisMin) && automatic(options.yAxisMax)) {
        const { y } = Options.evaluate({ context, options: { y: yExpression } }, dataSources);
        const values = (Array.isArray(y) ? y.flat(Infinity) : []).filter(numeric).map(Number);
        if (values.every((value) => value === values[0])) {
            const value = values[0] ?? 0;
            const padding = Math.max(1, Math.abs(value) * 0.05);
            const minimum = value === 0 ? 0 : value - padding;
            const maximum = value + padding;
            if (Number.isFinite(minimum) && Number.isFinite(maximum)) {
                result = { ...result, yAxisMin: minimum, yAxisMax: maximum };
            }
        }
    }
    return result;
}
