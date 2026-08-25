const COMPACT_SUFFIXES = [
    { value: 1_000_000_000_000, suffix: 'T' },
    { value: 1_000_000_000, suffix: 'B' },
    { value: 1_000_000, suffix: 'M' },
    { value: 1_000, suffix: 'K' },
] as const;

const BYTE_UNITS = [
    { value: 1_000_000_000_000, suffix: 'TB' },
    { value: 1_000_000_000, suffix: 'GB' },
    { value: 1_000_000, suffix: 'MB' },
    { value: 1_000, suffix: 'KB' },
] as const;

const NON_COMPACT_UNITS = new Set(['%', 'ms', 'Mbps']);

export const toFiniteMetricNumber = (value: string | number): number | null => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
};

const formatScaled = (value: number, divisor: number): string => {
    const scaled = value / divisor;
    const decimals = Math.abs(scaled) >= 10 ? 0 : 1;
    return scaled.toFixed(decimals).replace(/\.0$/, '');
};

export const formatPlainMetricNumber = (value: number): string =>
    Number.isInteger(value)
        ? value.toLocaleString()
        : value.toLocaleString(undefined, { maximumFractionDigits: 1 });

export const formatCompactMetricNumber = (value: number): string => {
    if (!Number.isFinite(value)) return '--';
    const abs = Math.abs(value);
    for (const entry of COMPACT_SUFFIXES) {
        if (abs >= entry.value) {
            return `${formatScaled(value, entry.value)}${entry.suffix}`;
        }
    }
    return formatPlainMetricNumber(value);
};

export const formatByteMetricNumber = (value: number): string => {
    if (!Number.isFinite(value)) return '--';
    const abs = Math.abs(value);
    for (const entry of BYTE_UNITS) {
        if (abs >= entry.value) {
            return `${formatScaled(value, entry.value)} ${entry.suffix}`;
        }
    }
    return `${formatPlainMetricNumber(value)} B`;
};

/** Format a complete metric value, including its configured unit. */
export const formatMetricNumber = (value: number, unit = ''): string => {
    if (!Number.isFinite(value)) return '--';
    if (unit === 'B') return formatByteMetricNumber(value);
    if (NON_COMPACT_UNITS.has(unit)) {
        return `${formatPlainMetricNumber(value)}${unit}`;
    }
    return `${formatCompactMetricNumber(value)}${unit}`;
};
