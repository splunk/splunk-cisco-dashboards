/**
 * Shared `viz_options` parsing for Searchbase Canvas scalar/gauge tiles.
 * Mirrors Splunk Dashboard Studio keys where practical; falls back to
 * safe defaults when a stanza omits `viz_options`.
 *
 * Additional radial-specific keys (consumed by `SingleValueRadialTile`):
 *
 *   - `arcDegrees` (number, 0 < x ≤ 360, default `180`) — arc sweep in
 *     degrees. `180` is the Dashboard Studio scoreboard look; `360`
 *     reverts to the legacy donut.
 *   - `min`, `max` (number, defaults `0` / `100`) — flat aliases for
 *     the existing `gaugeMin` / `gaugeMax` / `range.min` / `range.max`
 *     and `minValue` / `maxValue` keys. Authors may use whichever
 *     spelling is clearest.
 *   - `showDelta` (boolean, default `true`) — toggles the inline
 *     delta indicator next to the headline value.
 *   - `deltaFormat` (`"absolute"` | `"percent"`, default `"absolute"`)
 *     — chooses the delta rendering. `"absolute"` matches the DS
 *     scoreboard style (`↑4`); `"percent"` appends `%`.
 *   - `deltaField` (string | null, default `null`) — names the SPL
 *     column carrying the delta value. The Searchbase Canvas wires
 *     this into `MetricConfig.changeField`; an empty / null value
 *     falls back to whatever `useMetric` already produces (typically
 *     auto-computed % change between first and last bucket).
 *   - `decimals` (number, 0 ≤ n ≤ 4, default `0`) — decimal places
 *     for the headline value.
 *   - `valueSuffix` (string, default `""`) — appended verbatim after
 *     the headline (e.g. `"%"`, `" Mbps"`).
 *   - `trackColor` (string, hex) — overrides the radial track colour.
 *   - `fillColor` (string, hex) — overrides the radial fill colour
 *     (takes precedence over `seriesColors[0]` / `accentColor`).
 *
 * Bad input (wrong type, NaN, malformed hex) is silently dropped so
 * one bad stanza never throws inside a tile body.
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

const HEX_COLOR_PATTERN = /^#[0-9a-f]{3,8}$/i;

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
        // Honor flat `min` / `max` aliases used by the radial-specific
        // schema, then fall through to the legacy nested aliases.
        options?.min ?? options?.gaugeMin ?? options?.minValue,
        DEFAULT_GAUGE_RANGE.min
    );
    const max = coerceFinite(
        options?.max ?? options?.gaugeMax ?? options?.maxValue,
        DEFAULT_GAUGE_RANGE.max
    );
    if (max > min) return { min, max };
    return DEFAULT_GAUGE_RANGE;
};

// ---------------------------------------------------------------------------
// Radial-specific viz_options resolvers
// ---------------------------------------------------------------------------

/** Default scoreboard arc sweep — matches Splunk Dashboard Studio. */
export const DEFAULT_RADIAL_ARC_DEGREES = 180;

export const resolveArcDegrees = (
    options: Record<string, unknown> | undefined
): number => {
    const raw = options?.arcDegrees;
    const candidate = coerceFinite(raw, Number.NaN);
    if (!Number.isFinite(candidate)) return DEFAULT_RADIAL_ARC_DEGREES;
    if (candidate <= 0 || candidate > 360) return DEFAULT_RADIAL_ARC_DEGREES;
    return candidate;
};

export const resolveShowDelta = (
    options: Record<string, unknown> | undefined
): boolean => {
    const raw = options?.showDelta;
    if (raw === false) return false;
    if (typeof raw === 'string' && /^(false|0|no|off)$/i.test(raw.trim())) {
        return false;
    }
    return true;
};

export type DeltaFormat = 'absolute' | 'percent';

export const resolveDeltaFormat = (
    options: Record<string, unknown> | undefined
): DeltaFormat => {
    const raw = options?.deltaFormat;
    if (typeof raw === 'string' && raw.trim().toLowerCase() === 'percent') {
        return 'percent';
    }
    return 'absolute';
};

const SAFE_FIELD_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_.:]{0,127}$/;

/**
 * Resolve a SPL column name from `viz_options.deltaField`. Returns
 * `null` for empty / non-string / unsafe values so the caller falls
 * back to whatever `useMetric.change` already produces.
 */
export const resolveDeltaField = (
    options: Record<string, unknown> | undefined
): string | null => {
    const raw = options?.deltaField;
    if (typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    if (trimmed.length === 0) return null;
    return SAFE_FIELD_NAME_PATTERN.test(trimmed) ? trimmed : null;
};

export const resolveDecimals = (
    options: Record<string, unknown> | undefined
): number => {
    const raw = options?.decimals;
    const n = coerceFinite(raw, 0);
    if (!Number.isFinite(n)) return 0;
    const clamped = Math.max(0, Math.min(4, Math.floor(n)));
    return clamped;
};

export const resolveValueSuffix = (
    options: Record<string, unknown> | undefined
): string => {
    const raw = options?.valueSuffix;
    if (typeof raw !== 'string') return '';
    if (raw.length > 16) return '';
    return raw;
};

const resolveHexColor = (raw: unknown): string | null => {
    if (typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    if (trimmed.length === 0 || trimmed.length > 9) return null;
    return HEX_COLOR_PATTERN.test(trimmed) ? trimmed : null;
};

export const resolveTrackColor = (
    options: Record<string, unknown> | undefined
): string | null => resolveHexColor(options?.trackColor);

export const resolveFillColorOverride = (
    options: Record<string, unknown> | undefined
): string | null => resolveHexColor(options?.fillColor);

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
