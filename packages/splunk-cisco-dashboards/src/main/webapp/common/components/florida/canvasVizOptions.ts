/**
 * Shared `viz_options` parsing for Searchbase Canvas scalar/gauge tiles.
 * Mirrors Splunk Dashboard Studio keys where practical; falls back to
 * safe defaults when a stanza omits `viz_options`.
 */

export interface GaugeRange {
    min: number;
    max: number;
}

export interface ColorBand {
    from?: number;
    to?: number;
    value: string;
}

const coerceFinite = (raw: unknown, fallback: number): number => {
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    if (typeof raw === 'string') {
        const parsed = Number(raw.trim());
        if (Number.isFinite(parsed)) return parsed;
    }
    return fallback;
};

const readRangeObject = (
    raw: unknown
): { min?: unknown; max?: unknown } | undefined => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
    const obj = raw as Record<string, unknown>;
    return { min: obj.min ?? obj.gaugeMin ?? obj.minValue, max: obj.max ?? obj.gaugeMax ?? obj.maxValue };
};

/** Default 0–100 for percentage-style single-value and gauge tiles. */
export const DEFAULT_GAUGE_RANGE: GaugeRange = { min: 0, max: 100 };

export const resolveGaugeRange = (
    options: Record<string, unknown> | undefined
): GaugeRange => {
    const fromRange = readRangeObject(options?.range);
    if (fromRange) {
        const min = coerceFinite(fromRange.min, DEFAULT_GAUGE_RANGE.min);
        const max = coerceFinite(fromRange.max, DEFAULT_GAUGE_RANGE.max);
        if (max > min) return { min, max };
    }
    const min = coerceFinite(
        options?.gaugeMin ?? options?.minValue,
        DEFAULT_GAUGE_RANGE.min
    );
    const max = coerceFinite(
        options?.gaugeMax ?? options?.maxValue,
        DEFAULT_GAUGE_RANGE.max
    );
    if (max > min) return { min, max };
    return DEFAULT_GAUGE_RANGE;
};

const normalizeBandList = (raw: unknown): ColorBand[] => {
    if (!Array.isArray(raw)) return [];
    const bands: ColorBand[] = [];
    for (const entry of raw) {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
        const band = entry as Record<string, unknown>;
        const color = band.value ?? band.color;
        if (typeof color !== 'string' || !/^#[0-9a-f]{3,8}$/i.test(color.trim())) {
            continue;
        }
        bands.push({
            from:
                band.from !== undefined
                    ? coerceFinite(band.from, Number.NaN)
                    : undefined,
            to:
                band.to !== undefined ? coerceFinite(band.to, Number.NaN) : undefined,
            value: color.trim(),
        });
    }
    return bands;
};

/** Studio `healthColorRange` / `thresholds` / `gaugeRanges` colour bands. */
export const resolveColorBands = (
    options: Record<string, unknown> | undefined
): ColorBand[] => {
    const candidates = [
        options?.healthColorRange,
        options?.thresholds,
        options?.gaugeRanges,
        options?.rangeColors,
    ];
    for (const raw of candidates) {
        const bands = normalizeBandList(raw);
        if (bands.length > 0) return bands;
    }
    return [];
};

export const colorForValueInBands = (
    value: number,
    bands: ColorBand[],
    fallback: string
): string => {
    if (!Number.isFinite(value) || bands.length === 0) return fallback;
    for (const band of bands) {
        const from = band.from ?? Number.NEGATIVE_INFINITY;
        const to = band.to ?? Number.POSITIVE_INFINITY;
        if (value >= from && value < to) return band.value;
        if (band.to === undefined && value >= from) return band.value;
    }
    const last = bands[bands.length - 1];
    if (last && last.from !== undefined && value >= last.from) return last.value;
    return fallback;
};

export const clampToRange = (value: number, range: GaugeRange): number =>
    Math.max(range.min, Math.min(range.max, value));

export const percentInRange = (value: number, range: GaugeRange): number => {
    const span = range.max - range.min;
    if (!Number.isFinite(span) || span <= 0) return 0;
    return ((clampToRange(value, range) - range.min) / span) * 100;
};
