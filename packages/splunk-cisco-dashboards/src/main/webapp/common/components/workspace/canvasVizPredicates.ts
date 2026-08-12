/** Canvas-only viz routing helpers (Searchbase Canvas tile picker). */

const normalizeViz = (splunkViz: string | undefined): string =>
    typeof splunkViz === 'string' ? splunkViz.trim().toLowerCase() : '';

export const isPieViz = (splunkViz: string | undefined): boolean =>
    normalizeViz(splunkViz) === 'splunk.pie';

export const isSingleValueRadialViz = (splunkViz: string | undefined): boolean =>
    normalizeViz(splunkViz) === 'splunk.singlevalueradial';

export const isFillerGaugeViz = (splunkViz: string | undefined): boolean =>
    normalizeViz(splunkViz) === 'splunk.fillergauge';

export const isMarkerGaugeViz = (splunkViz: string | undefined): boolean =>
    normalizeViz(splunkViz) === 'splunk.markergauge';

export const isScalarGaugeViz = (splunkViz: string | undefined): boolean =>
    isSingleValueRadialViz(splunkViz) ||
    isFillerGaugeViz(splunkViz) ||
    isMarkerGaugeViz(splunkViz);
