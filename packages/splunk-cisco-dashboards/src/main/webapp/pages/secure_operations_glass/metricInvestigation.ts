import type {SearchbaseRecord} from '@/common/services/searchbaseCatalogue';
import type {SearchRow} from './search';

export type MetricInvestigation = {
    searchId: string;
    label: string;
    transformSearch?: (spl: string) => string;
};

/** Resolve only explicitly configured targets; never derive raw SPL by removing commands. */
export function metricInvestigationTargets(source: SearchbaseRecord, catalogue: Map<string, SearchbaseRecord>): SearchbaseRecord[] {
    const targets = [source];
    const configured = source.drilldownSearchNames?.length
        ? source.drilldownSearchNames : [source.drilldownSearchName];
    for (const identity of configured) {
        const record = identity && (catalogue.get(identity) ?? [...catalogue.values()].find(r => r.searchName === identity));
        if (record && !targets.some(r => r.id === record.id)) targets.push(record);
        if (targets.length >= 9) break;
    }
    return targets;
}

type Request = {spl: string; earliestTime: string; latestTime: string; appContext: string; count: number; maxTimeSeconds: number; signal: AbortSignal; tag: string};
type Runner = (request: Request) => Promise<{results: SearchRow[]; timedOut?: boolean}>;
/** Defer dispatch past mount cleanup, cancel on close and suppress stale/partial results. */
export function startMetricInvestigation(record: SearchbaseRecord, earliest: string, transform: MetricInvestigation['transformSearch'], run: Runner,
    onResult: (rows: SearchRow[]) => void, onError: () => void): () => void {
    const controller = new AbortController();
    queueMicrotask(async () => {
        if (controller.signal.aborted) return;
        try {
            const spl = transform ? transform(record.search) : record.search;
            if (/\$[\w.]+\$/.test(spl)) throw new Error('Unresolved search token');
            const result = await run({spl, earliestTime: earliest, latestTime: 'now', appContext: record.dispatchContext,
                count: 201, maxTimeSeconds: 45, signal: controller.signal, tag: 'secops-metric-detail:' + record.id});
            if (result.timedOut) throw new Error('Partial results omitted');
            if (!controller.signal.aborted) onResult(result.results);
        } catch {
            if (!controller.signal.aborted) onError();
        }
    });
    return () => controller.abort();
}
