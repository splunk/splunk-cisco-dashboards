import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    AlertTriangle,
    Check,
    ClipboardCopy,
    ExternalLink,
    Loader2,
    Play,
    RefreshCw,
    Save,
    Search,
} from 'lucide-react';
import { getDefaultFetchInit } from '@splunk/splunk-utils/fetch';

import {
    getSearchAppContext,
    isAbortError,
    runSearch,
} from '@/common/services/splunkSearchService';
import { getSearchbaseCatalogue } from '@/common/services/searchbaseCatalogue';
import { splunkSearchAppUrl } from '@/common/lib/splunkSearchUrl';

const TUNING_SEARCHBASE_ID = 'admin_macro_index_tuning';
const TUNING_SEARCH_NAME = 'Admin - Macro Index Tuning';
const ADHOC_MACRO_NAME = 'summariesonly';
const DEFAULT_SUMMARIESONLY_DEFINITION =
    'summariesonly=false allow_old_summaries=false fillnull_value=null';

type ScanState = 'idle' | 'loading' | 'ready' | 'error';
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface MacroRow {
    macro: string;
    definition: string;
    indexes: string[];
    sourcetypes: string[];
    sourcetypeCount: number;
    events: number;
}

interface EditableMacroRow extends MacroRow {
    draftDefinition: string;
}

interface SaveStatus {
    state: SaveState;
    message?: string;
}

const TIME_RANGE_OPTIONS = [
    { value: '-24h@h', label: 'Last 24 hours' },
    { value: '-7d@d', label: 'Last 7 days' },
    { value: '-30d@d', label: 'Last 30 days' },
    { value: '0', label: 'All time' },
];

const lightButtonBase =
    'inline-flex h-9 items-center justify-center gap-2 rounded border px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-55';

const normalizeText = (value: unknown): string =>
    Array.isArray(value)
        ? value.map((item) => String(item)).join(', ')
        : value == null
          ? ''
          : String(value);

const normalizeMultiValue = (value: unknown): string[] => {
    if (Array.isArray(value)) {
        return value
            .flatMap((item) => normalizeMultiValue(item))
            .map((item) => item.trim())
            .filter(Boolean);
    }
    return normalizeText(value)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
};

const normalizeNumber = (value: unknown): number => {
    const parsed = Number(normalizeText(value).replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
};

const parseSearchResult = (row: Record<string, unknown>): MacroRow | null => {
    const macro = normalizeText(row.macro).trim();
    if (!macro) return null;
    return {
        macro,
        definition: normalizeText(row.definition).trim(),
        indexes: normalizeMultiValue(row.indexes),
        sourcetypes: normalizeMultiValue(row.sourcetypes),
        sourcetypeCount: normalizeNumber(row.sourcetype_count),
        events: normalizeNumber(row.events),
    };
};

const formatNumber = (value: number): string =>
    new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);

const buildMacroStanzas = (rows: EditableMacroRow[]): string =>
    rows
        .filter((row) => row.macro !== 'unknown' && row.draftDefinition.trim())
        .map((row) => `[${row.macro}]\ndefinition = ${row.draftDefinition.trim()}\niseval = 0`)
        .join('\n\n');

const buildMacroStanza = (macro: string, definition: string): string =>
    definition.trim() ? `[${macro}]\ndefinition = ${definition.trim()}\niseval = 0` : '';

const extractSplunkError = (payload: unknown): string | null => {
    if (!payload || typeof payload !== 'object') return null;
    const messages = (payload as { messages?: unknown }).messages;
    if (!Array.isArray(messages)) return null;
    const match = messages.find((message) => {
        if (!message || typeof message !== 'object') return false;
        const type = String((message as { type?: unknown }).type ?? '');
        return /error|fatal/i.test(type);
    });
    if (!match || typeof match !== 'object') return null;
    const text = (match as { text?: unknown }).text;
    return typeof text === 'string' && text.trim() ? text.trim() : null;
};

const macroConfigUrl = (macro: string): string => {
    const app = encodeURIComponent(getSearchAppContext());
    return `/en-US/splunkd/__raw/servicesNS/nobody/${app}/configs/conf-macros/${encodeURIComponent(
        macro
    )}?output_mode=json`;
};

const saveMacroDefinition = async (macro: string, definition: string): Promise<void> => {
    const response = await fetch(macroConfigUrl(macro), {
        ...getDefaultFetchInit(),
        method: 'POST',
        body: new URLSearchParams({
            definition,
            iseval: '0',
        }).toString(),
    });

    let payload: unknown = null;
    try {
        payload = await response.json();
    } catch {
        payload = null;
    }

    if (!response.ok) {
        throw new Error(extractSplunkError(payload) || `Save failed with HTTP ${response.status}.`);
    }
};

const loadMacroDefinition = async (macro: string): Promise<string> => {
    const response = await fetch(macroConfigUrl(macro), {
        ...getDefaultFetchInit(),
        method: 'GET',
    });

    let payload: unknown = null;
    try {
        payload = await response.json();
    } catch {
        payload = null;
    }

    if (!response.ok) {
        throw new Error(extractSplunkError(payload) || `Load failed with HTTP ${response.status}.`);
    }

    const entries = (payload as { entry?: Array<{ content?: { definition?: unknown } }> } | null)
        ?.entry;
    const definition = entries?.[0]?.content?.definition;
    return typeof definition === 'string' ? definition : '';
};

function CopyButton({ text, label }: { text: string; label: string }): JSX.Element {
    const [copied, setCopied] = useState(false);

    const onCopy = useCallback(() => {
        if (!text) return;
        navigator.clipboard
            .writeText(text)
            .then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1400);
            })
            .catch(() => {
                setCopied(false);
            });
    }, [text]);

    return (
        <button
            type="button"
            onClick={onCopy}
            disabled={!text}
            className={`${lightButtonBase} border-slate-300 bg-white text-slate-700 hover:border-sky-400 hover:text-sky-700`}
        >
            {copied ? <Check size={16} /> : <ClipboardCopy size={16} />}
            {copied ? 'Copied' : label}
        </button>
    );
}

function FieldPills({ values, tone = 'slate' }: { values: string[]; tone?: 'slate' | 'sky' }): JSX.Element {
    const visible = values.slice(0, 6);
    const extra = Math.max(0, values.length - visible.length);
    const classes =
        tone === 'sky'
            ? 'border-sky-100 bg-sky-50 text-sky-800'
            : 'border-slate-200 bg-slate-50 text-slate-700';

    return (
        <div className="flex flex-wrap gap-1.5">
            {visible.map((value) => (
                <span
                    key={value}
                    className={`max-w-[220px] truncate rounded border px-2 py-0.5 font-mono text-xs ${classes}`}
                    title={value}
                >
                    {value}
                </span>
            ))}
            {extra > 0 && (
                <span className="rounded border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-500">
                    +{extra}
                </span>
            )}
        </div>
    );
}

export default function MacroIndexTuningPage(): JSX.Element {
    const [rows, setRows] = useState<EditableMacroRow[]>([]);
    const [scanState, setScanState] = useState<ScanState>('idle');
    const [error, setError] = useState<string>('');
    const [searchSpl, setSearchSpl] = useState<string>('');
    const [timeRange, setTimeRange] = useState(TIME_RANGE_OPTIONS[2].value);
    const [saveStatuses, setSaveStatuses] = useState<Record<string, SaveStatus>>({});
    const [adhocDefinition, setAdhocDefinition] = useState(DEFAULT_SUMMARIESONLY_DEFINITION);
    const [adhocStatus, setAdhocStatus] = useState<SaveStatus>({ state: 'idle' });
    const abortRef = useRef<AbortController | null>(null);
    const searchSplRef = useRef<string>('');

    const generatedMacroStanzas = useMemo(() => buildMacroStanzas(rows), [rows]);
    const macroStanzas = useMemo(
        () =>
            [
                buildMacroStanza(ADHOC_MACRO_NAME, adhocDefinition),
                generatedMacroStanzas,
            ]
                .filter(Boolean)
                .join('\n\n'),
        [adhocDefinition, generatedMacroStanzas]
    );
    const hasUnknown = rows.some((row) => row.macro === 'unknown');
    const rowsToSave = rows.filter((row) => row.macro !== 'unknown' && row.draftDefinition.trim());
    const totalEvents = rows.reduce((sum, row) => sum + row.events, 0);
    const totalIndexes = new Set(rows.flatMap((row) => row.indexes)).size;
    const isLoading = scanState === 'loading';
    const isSavingAll = Object.values(saveStatuses).some((status) => status.state === 'saving');
    const openSearchUrl = searchSpl
        ? splunkSearchAppUrl(searchSpl, { earliest: timeRange, latest: 'now' })
        : '';

    const loadTuningSearch = useCallback(async (): Promise<string> => {
        if (searchSplRef.current) return searchSplRef.current;
        const catalogue = await getSearchbaseCatalogue({ includeHidden: true });
        const record = catalogue.find(
            (item) => item.id === TUNING_SEARCHBASE_ID || item.searchName === TUNING_SEARCH_NAME
        );
        if (!record?.search) {
            throw new Error(`Could not find ${TUNING_SEARCHBASE_ID} in searchbase.conf.`);
        }
        searchSplRef.current = record.search;
        setSearchSpl(record.search);
        return record.search;
    }, []);

    const runScan = useCallback(async () => {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        setScanState('loading');
        setError('');
        setSaveStatuses({});

        try {
            const spl = await loadTuningSearch();
            const result = await runSearch({
                spl,
                earliestTime: timeRange,
                latestTime: 'now',
                count: 0,
                tag: TUNING_SEARCHBASE_ID,
                signal: controller.signal,
            });
            const parsed = ((result.results || []) as Record<string, unknown>[])
                .map(parseSearchResult)
                .filter((row): row is MacroRow => Boolean(row))
                .sort((left, right) => {
                    if (left.macro === 'unknown') return 1;
                    if (right.macro === 'unknown') return -1;
                    return left.macro.localeCompare(right.macro);
                })
                .map((row) => ({
                    ...row,
                    draftDefinition: row.definition,
                }));
            setRows(parsed);
            setScanState('ready');
        } catch (err) {
            if (isAbortError(err)) return;
            setScanState('error');
            setRows([]);
            setError(err instanceof Error ? err.message : String(err));
        }
    }, [loadTuningSearch, timeRange]);

    useEffect(() => {
        void runScan();
        return () => {
            abortRef.current?.abort();
        };
    }, [runScan]);

    const loadAdhocMacro = useCallback(async () => {
        setAdhocStatus({ state: 'saving', message: 'Loading current macro' });
        try {
            const definition = await loadMacroDefinition(ADHOC_MACRO_NAME);
            setAdhocDefinition(definition || DEFAULT_SUMMARIESONLY_DEFINITION);
            setAdhocStatus({ state: 'idle' });
        } catch (err) {
            setAdhocDefinition(DEFAULT_SUMMARIESONLY_DEFINITION);
            setAdhocStatus({
                state: 'error',
                message: err instanceof Error ? err.message : String(err),
            });
        }
    }, []);

    useEffect(() => {
        void loadAdhocMacro();
    }, [loadAdhocMacro]);

    const updateDraftDefinition = useCallback((macro: string, definition: string) => {
        setRows((current) =>
            current.map((row) =>
                row.macro === macro
                    ? {
                          ...row,
                          draftDefinition: definition,
                      }
                    : row
            )
        );
        setSaveStatuses((current) => ({
            ...current,
            [macro]: { state: 'idle' },
        }));
    }, []);

    const saveOne = useCallback(async (row: EditableMacroRow) => {
        if (row.macro === 'unknown') return;
        const definition = row.draftDefinition.trim();
        if (!definition) return;
        setSaveStatuses((current) => ({
            ...current,
            [row.macro]: { state: 'saving' },
        }));
        try {
            await saveMacroDefinition(row.macro, definition);
            setSaveStatuses((current) => ({
                ...current,
                [row.macro]: { state: 'saved', message: 'Saved' },
            }));
        } catch (err) {
            setSaveStatuses((current) => ({
                ...current,
                [row.macro]: {
                    state: 'error',
                    message: err instanceof Error ? err.message : String(err),
                },
            }));
        }
    }, []);

    const saveAll = useCallback(async () => {
        for (const row of rowsToSave) {
            // Save sequentially so Splunk config writes stay predictable.
            // eslint-disable-next-line no-await-in-loop
            await saveOne(row);
        }
    }, [rowsToSave, saveOne]);

    const saveAdhocMacro = useCallback(async () => {
        const definition = adhocDefinition.trim();
        if (!definition) return;
        setAdhocStatus({ state: 'saving' });
        try {
            await saveMacroDefinition(ADHOC_MACRO_NAME, definition);
            setAdhocStatus({ state: 'saved', message: 'Saved' });
        } catch (err) {
            setAdhocStatus({
                state: 'error',
                message: err instanceof Error ? err.message : String(err),
            });
        }
    }, [adhocDefinition]);

    return (
        <main className="min-h-screen bg-[#f4f6f8] px-6 py-5 text-slate-800">
            <section className="mb-4 border-b border-slate-200 pb-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h1 className="m-0 text-xl font-bold tracking-normal text-slate-900">
                            Macro Index Tuning
                        </h1>
                        <p className="mt-1 max-w-3xl text-sm text-slate-600">
                            Scan your Splunk indexes for Cisco and related sourcetypes, map the
                            detected data into the dashboard index macros, then review and save the
                            generated macro definitions so dashboard searches run against the right
                            indexes.
                        </p>
                        <p className="mt-1 max-w-3xl text-xs text-slate-500">
                            Powered by searchbase entry{' '}
                            <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs">
                                {TUNING_SEARCHBASE_ID}
                            </code>
                            .
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                            Range
                            <select
                                value={timeRange}
                                onChange={(event) => setTimeRange(event.target.value)}
                                className="h-9 rounded border border-slate-300 bg-white px-2 text-sm font-normal text-slate-800"
                            >
                                {TIME_RANGE_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <button
                            type="button"
                            onClick={runScan}
                            disabled={isLoading}
                            className={`${lightButtonBase} border-sky-600 bg-sky-600 text-white hover:bg-sky-700`}
                        >
                            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                            {isLoading ? 'Running' : 'Run scan'}
                        </button>
                        <a
                            href={openSearchUrl || undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-disabled={!openSearchUrl}
                            className={`${lightButtonBase} border-slate-300 bg-white text-slate-700 hover:border-sky-400 hover:text-sky-700 ${
                                openSearchUrl ? '' : 'pointer-events-none opacity-55'
                            }`}
                        >
                            <ExternalLink size={16} />
                            Open in Search
                        </a>
                        <button
                            type="button"
                            onClick={saveAll}
                            disabled={!rowsToSave.length || isLoading || isSavingAll}
                            className={`${lightButtonBase} border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700`}
                        >
                            {isSavingAll ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            Save all
                        </button>
                    </div>
                </div>
            </section>

            <section className="mb-4 border border-slate-200 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
                    <div>
                        <h2 className="m-0 text-base font-bold text-slate-900">Ad hoc macro</h2>
                        <p className="mt-1 text-sm text-slate-600">
                            Update{' '}
                            <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs">
                                {ADHOC_MACRO_NAME}
                            </code>{' '}
                            before saving generated index macros.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={loadAdhocMacro}
                        disabled={adhocStatus.state === 'saving'}
                        className={`${lightButtonBase} border-slate-300 bg-white text-slate-700 hover:border-sky-400 hover:text-sky-700`}
                    >
                        <RefreshCw
                            size={16}
                            className={adhocStatus.state === 'saving' ? 'animate-spin' : ''}
                        />
                        Reload
                    </button>
                </div>
                <div className="grid gap-3 px-4 py-4 lg:grid-cols-[180px_minmax(0,1fr)_auto] lg:items-start">
                    <div>
                        <div className="font-mono text-sm font-bold text-sky-800">
                            {ADHOC_MACRO_NAME}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">tstats acceleration options</div>
                    </div>
                    <div>
                        <input
                            value={adhocDefinition}
                            onChange={(event) => {
                                setAdhocDefinition(event.target.value);
                                setAdhocStatus({ state: 'idle' });
                            }}
                            className="h-9 w-full rounded border border-slate-300 bg-white px-2 font-mono text-xs text-slate-900"
                        />
                        {adhocStatus.state === 'error' && adhocStatus.message && (
                            <div className="mt-1 text-xs text-red-700">{adhocStatus.message}</div>
                        )}
                        {adhocStatus.state === 'saved' && (
                            <div className="mt-1 text-xs font-semibold text-emerald-700">Saved</div>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={saveAdhocMacro}
                        disabled={adhocStatus.state === 'saving' || !adhocDefinition.trim()}
                        className={`${lightButtonBase} border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700`}
                    >
                        {adhocStatus.state === 'saving' ? (
                            <Loader2 size={16} className="animate-spin" />
                        ) : (
                            <Save size={16} />
                        )}
                        Save
                    </button>
                </div>
            </section>

            <section className="mb-4 grid gap-3 md:grid-cols-4">
                <div className="border border-slate-200 bg-white px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Macros</div>
                    <div className="mt-1 text-2xl font-bold text-slate-900">{formatNumber(rows.length)}</div>
                </div>
                <div className="border border-slate-200 bg-white px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Indexes</div>
                    <div className="mt-1 text-2xl font-bold text-slate-900">{formatNumber(totalIndexes)}</div>
                </div>
                <div className="border border-slate-200 bg-white px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Events</div>
                    <div className="mt-1 text-2xl font-bold text-slate-900">{formatNumber(totalEvents)}</div>
                </div>
                <div className="border border-slate-200 bg-white px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Unknown</div>
                    <div className={`mt-1 text-2xl font-bold ${hasUnknown ? 'text-amber-700' : 'text-emerald-700'}`}>
                        {formatNumber(rows.filter((row) => row.macro === 'unknown').length)}
                    </div>
                </div>
            </section>

            {error && (
                <section className="mb-4 flex items-start gap-2 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                    <AlertTriangle className="mt-0.5 shrink-0" size={17} />
                    <div>
                        <div className="font-bold">Macro tuning scan failed.</div>
                        <div>{error}</div>
                    </div>
                </section>
            )}

            {hasUnknown && (
                <section className="mb-4 flex items-start gap-2 border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    <AlertTriangle className="mt-0.5 shrink-0" size={17} />
                    <div>
                        <div className="font-bold">One or more sourcetypes were classified as unknown.</div>
                        <div>Review those rows before saving so high-volume data does not keep falling back to broad searches.</div>
                    </div>
                </section>
            )}

            <section className="mb-4 border border-slate-200 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
                    <div className="flex items-center gap-2">
                        <Search size={17} className="text-sky-700" />
                        <h2 className="m-0 text-base font-bold text-slate-900">Generated macro definitions</h2>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <CopyButton text={macroStanzas} label="Copy macros.conf" />
                        <a
                            href="/en-US/manager/splunk-cisco-dashboards/admin/macros"
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`${lightButtonBase} border-slate-300 bg-white text-slate-700 hover:border-sky-400 hover:text-sky-700`}
                        >
                            <ExternalLink size={16} />
                            Open macros
                        </a>
                    </div>
                </div>

                {isLoading && rows.length === 0 ? (
                    <div className="flex min-h-[260px] items-center justify-center gap-3 text-sm text-slate-600">
                        <Loader2 size={18} className="animate-spin text-sky-700" />
                        Scanning indexes and sourcetypes...
                    </div>
                ) : rows.length === 0 ? (
                    <div className="min-h-[220px] px-4 py-12 text-center text-sm text-slate-500">
                        No macro rows returned for the selected range.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full border-collapse text-left text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                                    <th className="w-[190px] px-4 py-3 font-bold">Macro</th>
                                    <th className="min-w-[330px] px-4 py-3 font-bold">Definition</th>
                                    <th className="min-w-[220px] px-4 py-3 font-bold">Indexes</th>
                                    <th className="min-w-[260px] px-4 py-3 font-bold">Sourcetypes</th>
                                    <th className="w-[110px] px-4 py-3 text-right font-bold">Events</th>
                                    <th className="w-[130px] px-4 py-3 text-right font-bold">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row) => {
                                    const status = saveStatuses[row.macro] || { state: 'idle' };
                                    const isUnknown = row.macro === 'unknown';
                                    const isSaving = status.state === 'saving';
                                    return (
                                        <tr key={row.macro} className="border-b border-slate-100 align-top">
                                            <td className="px-4 py-3">
                                                <div
                                                    className={`font-mono text-sm font-bold ${
                                                        isUnknown ? 'text-amber-700' : 'text-sky-800'
                                                    }`}
                                                >
                                                    {row.macro}
                                                </div>
                                                <div className="mt-1 text-xs text-slate-500">
                                                    {formatNumber(row.sourcetypeCount)} sourcetypes
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <input
                                                    value={row.draftDefinition}
                                                    onChange={(event) =>
                                                        updateDraftDefinition(row.macro, event.target.value)
                                                    }
                                                    disabled={isUnknown}
                                                    className="h-9 w-full rounded border border-slate-300 bg-white px-2 font-mono text-xs text-slate-900 disabled:bg-slate-100 disabled:text-slate-500"
                                                />
                                                {status.state === 'error' && status.message && (
                                                    <div className="mt-1 text-xs text-red-700">{status.message}</div>
                                                )}
                                                {status.state === 'saved' && (
                                                    <div className="mt-1 text-xs font-semibold text-emerald-700">
                                                        Saved
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <FieldPills values={row.indexes} tone="sky" />
                                            </td>
                                            <td className="px-4 py-3">
                                                <FieldPills values={row.sourcetypes} />
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono text-sm text-slate-700">
                                                {formatNumber(row.events)}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => saveOne(row)}
                                                    disabled={isUnknown || isSaving || !row.draftDefinition.trim()}
                                                    className={`${lightButtonBase} h-8 border-slate-300 bg-white text-slate-700 hover:border-emerald-500 hover:text-emerald-700`}
                                                >
                                                    {isSaving ? (
                                                        <Loader2 size={15} className="animate-spin" />
                                                    ) : (
                                                        <Save size={15} />
                                                    )}
                                                    Save
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(340px,420px)]">
                <div className="border border-slate-200 bg-white">
                    <div className="border-b border-slate-200 px-4 py-3">
                        <h2 className="m-0 text-base font-bold text-slate-900">macros.conf preview</h2>
                    </div>
                    <pre className="m-0 max-h-[320px] overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-xs leading-relaxed text-slate-800">
                        {macroStanzas || '# Run the scan to populate macro definitions.'}
                    </pre>
                </div>

                <details className="border border-slate-200 bg-white">
                    <summary className="cursor-pointer border-b border-slate-200 px-4 py-3 text-base font-bold text-slate-900">
                        Search SPL
                    </summary>
                    <pre className="m-0 max-h-[320px] overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-xs leading-relaxed text-slate-800">
                        {searchSpl || '# Loading searchbase SPL...'}
                    </pre>
                </details>
            </section>
        </main>
    );
}
