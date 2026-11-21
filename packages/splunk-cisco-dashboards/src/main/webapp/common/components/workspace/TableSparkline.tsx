import React from 'react';
import { formatPlainMetricNumber } from '@/common/lib/metricValueFormat';

const MARKER = '##__SPARKLINE__##';
const SERIALIZED_MARKER = /^\s*\[\s*"##__SPARKLINE__##"/;
const MAX_SERIALIZED_LENGTH = 65_536;
const MAX_SAMPLES = 4_096;
const WIDTH = 96;
const HEIGHT = 14;
const INSET = 2;

export const isTableSparkline = (value: unknown): boolean =>
    Array.isArray(value)
        ? value[0] === MARKER
        : typeof value === 'string' && SERIALIZED_MARKER.test(value);

const readSamples = (value: unknown): Array<number | null> => {
    let data = value;
    if (typeof data === 'string') {
        if (data.length > MAX_SERIALIZED_LENGTH) return [];
        try {
            data = JSON.parse(data);
        } catch {
            return [];
        }
    }
    if (!Array.isArray(data) || data[0] !== MARKER || data.length > MAX_SAMPLES + 1) {
        return [];
    }

    return data.slice(1).map((sample) => {
        if (typeof sample !== 'number' && (typeof sample !== 'string' || !sample.trim())) {
            return null;
        }
        const numeric = Number(sample);
        return Number.isFinite(numeric) ? numeric : null;
    });
};

export const TableSparkline = ({ value }: { value: unknown }): JSX.Element => {
    const samples = readSamples(value);
    const observed = samples.filter((sample): sample is number => sample !== null);
    if (observed.length === 0) {
        return (
            <>
                <span aria-hidden="true">—</span>
                <span className="sr-only">No trend samples</span>
            </>
        );
    }

    const minimum = Math.min(...observed);
    const maximum = Math.max(...observed);
    const scale = Math.max(Math.abs(minimum), Math.abs(maximum), 1);
    const span = maximum / scale - minimum / scale;
    const format = formatPlainMetricNumber;
    const label = [
        `Trend with ${observed.length} ${observed.length === 1 ? 'sample' : 'samples'}.`,
        `First observed ${format(observed[0])}.`,
        `Latest observed ${format(observed[observed.length - 1])}.`,
        `Low ${format(minimum)}. High ${format(maximum)}.`,
    ].join(' ');
    const points = samples.map((sample, index) => {
        if (sample === null) return null;
        const x = samples.length === 1 ? WIDTH / 2 :
            INSET + (index * (WIDTH - 2 * INSET)) / (samples.length - 1);
        const y = span === 0 ? HEIGHT / 2 :
            INSET + ((maximum / scale - sample / scale) / span) * (HEIGHT - 2 * INSET);
        return { x, y };
    });
    const path = points.map((point, index) => {
        if (!point) return '';
        const command = points[index - 1] ? 'L' : 'M';
        return `${command}${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    }).join(' ');

    return (
        <svg
            aria-label={label}
            className="inline-block align-middle sui-color-info"
            height={HEIGHT}
            role="img"
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            width={WIDTH}
        >
            <title>{label}</title>
            <path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            {points.map((point, index) => point && !points[index - 1] && !points[index + 1] ? (
                <circle key={index} cx={point.x} cy={point.y} r="1.5" fill="currentColor" />
            ) : null)}
        </svg>
    );
};
