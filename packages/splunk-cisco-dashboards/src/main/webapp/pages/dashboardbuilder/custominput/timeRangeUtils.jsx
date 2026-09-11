import { isString } from 'lodash-es';
import { isValidTime } from '@splunk/time-range-utils/time';

export const DEFAULT_EARLIEST = '-24h@h';
export const DEFAULT_LATEST = 'now';
export const DEFAULT_SPAN = 'auto';
export const DEFAULT_VALUE = `${DEFAULT_EARLIEST},${DEFAULT_LATEST},${DEFAULT_SPAN}`;
export const DEFAULT_TIMERANGE = {
    earliest: DEFAULT_EARLIEST,
    latest: DEFAULT_LATEST,
    span: DEFAULT_SPAN,
};
export const DEFAULT_OPTIONS = {
    label: '24h',
    value: DEFAULT_VALUE,
};

const VALID_SPAN_PATTERN = /^[1-9]\d*(?:s|m|h|d|w|mon|qtr|y)$/i;

export const normalizeTimeSpan = (span = DEFAULT_SPAN) => {
    if (!isString(span)) {
        return DEFAULT_SPAN;
    }

    const normalizedSpan = span.trim();
    if (!normalizedSpan || normalizedSpan.toLowerCase() === DEFAULT_SPAN) {
        return DEFAULT_SPAN;
    }

    return VALID_SPAN_PATTERN.test(normalizedSpan) ? normalizedSpan : DEFAULT_SPAN;
};

export const isValidTimeSpan = (span) =>
    isString(span) &&
    (span.trim().toLowerCase() === DEFAULT_SPAN || VALID_SPAN_PATTERN.test(span.trim()));

/**
 * Util function to convert from 'earliest,latest' to {earliest:'', latest:''}
 * @param {string} value String format timerange 'earliest,latest'
 * @returns {Object} Time range object with earliest and latest keys
 */
export const parseTimeRangeValue = (value = DEFAULT_VALUE) => {
    if (!isString(value) || value.length === 0) {
        return DEFAULT_TIMERANGE;
    }
    const timeRanges = value.split(',');
    const earliest = timeRanges[0].trim();
    const latest = timeRanges[1] && timeRanges[1].trim() ? timeRanges[1].trim() : DEFAULT_LATEST;
    const span = normalizeTimeSpan(timeRanges[2]);
    return {
        earliest: isValidTime(earliest) ? earliest : DEFAULT_EARLIEST,
        latest: isValidTime(latest) ? latest : DEFAULT_LATEST,
        span,
    };
};

/**
 *
 * @param {Object} timerange in object format
 * @param {string} timerange.earliest
 * @param {string} timerange.latest
 * @returns {string} string formated time range
 */
export const toTimeRangeValue = (timerange = DEFAULT_TIMERANGE) => {
    const { earliest, latest, span } = timerange;
    if (!isValidTime(earliest)) {
        return DEFAULT_VALUE;
    }
    if (!isValidTime(latest)) {
        return `${earliest},${DEFAULT_LATEST},${DEFAULT_SPAN}`;
    }
    return `${earliest},${latest},${normalizeTimeSpan(span)}`;
};
