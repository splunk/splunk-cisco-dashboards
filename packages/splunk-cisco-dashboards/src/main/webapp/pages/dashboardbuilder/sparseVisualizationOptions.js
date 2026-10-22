import { Options } from '@splunk/visualization-encoding/Options';

const numeric = (value) => value !== null && value !== undefined && value !== ''
    && Number.isFinite(Number(value));
const automatic = (value) => value === undefined || value === null || value === 'auto' || value === '';
const directSource = (expression, sources) => typeof expression === 'string'
    && Object.prototype.hasOwnProperty.call(sources, expression.match(/^>\s*(\w+)\s*\|/)?.[1]);

// Run before the vendor visualization evaluates its dependent color expressions.
// Preserve data, headline metrics and explicit user ranges; never invent samples.
export function sparseVisualizationOptions(type, props) {
    const { options = {}, context = {}, dataSources = {} } = props;
    let result = options;
    if (type === 'splunk.singlevalue' && directSource(options.sparklineValues, dataSources)
        && /^>\s*sparklineValues\s*\|\s*delta\(-2\)\s*$/.test(options.trendValue || '')) {
        const { sparklineValues } = Options.evaluate({ context, options: {
            sparklineValues: options.sparklineValues,
        } }, dataSources);
        if (!Array.isArray(sparklineValues) || sparklineValues.length < 2
            || !sparklineValues.slice(-2).every(numeric)) {
            result = { ...result, trendDisplay: 'off', showTrendIndicator: false,
                trendValue: '', trendColor: null };
        }
    }
    if (['splunk.line', 'splunk.area'].includes(type) && directSource(options.y, dataSources)
        && (!options.yAxisScale || options.yAxisScale === 'linear')
        && automatic(options.yAxisMin) && automatic(options.yAxisMax)) {
        const { y } = Options.evaluate({ context, options: { y: options.y } }, dataSources);
        const values = (Array.isArray(y) ? y.flat(Infinity) : []).filter(numeric).map(Number);
        if (values.length && values.every((value) => value === values[0])) {
            const value = values[0];
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
