export interface SignalRailPoint { time: number; value: number }

/** Accept only observed, paired time/value samples; never a generated fallback. */
export const observedSignalSeries = (
    source: string, values: readonly number[], timestamps: readonly number[],
): SignalRailPoint[] => {
    if (source !== 'live' || values.length < 2 || timestamps.length !== values.length) return [];
    const paired = values.map((value, i) => ({ time: timestamps[i], value }));
    if (paired.some(p => !Number.isFinite(new Date(p.time).getTime()) || !Number.isFinite(p.value))) return [];
    const ordered = [...new Map(paired.map(p => [p.time, p])).values()].sort((a, b) => a.time - b.time);
    return ordered.length < 2 ? [] : ordered.slice(-60);
};

export const sameSignalSeries = (a: readonly SignalRailPoint[] = [], b: readonly SignalRailPoint[] = []) =>
    a.length === b.length && a.every((p, i) => p.time === b[i].time && p.value === b[i].value);

/** useMetric supplies epoch milliseconds, including numeric Splunk _time rows. */
export const formatSignalRailTime = (time: number, locale?: string, timeZone?: string) =>
    new Intl.DateTimeFormat(locale, {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short', timeZone,
    }).format(new Date(time));
