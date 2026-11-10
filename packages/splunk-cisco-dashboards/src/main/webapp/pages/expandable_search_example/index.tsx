import React, {useCallback, useEffect, useState} from 'react';
import {runManagedSearch} from '@/common/services/splunkSearchService';
import {EXAMPLE_TABS, type ExampleSection} from './config';
import {startSectionSearch} from './lifecycle';

type Row = Record<string, unknown>;
const ranges = [['4h','-4h'],['24h','-24h@h'],['48h','-48h'],['7d','-7d@d'],['30d','-30d@d']];
const buttonClass = 'rounded border sui-border-weak px-3 py-2 sui-bg-section sui-color-active';

export function SectionResults({section, earliest, onStart}: {section: ExampleSection; earliest: string; onStart: () => void}) {
    const [rows, setRows] = useState<Row[]>([]);
    const [status, setStatus] = useState('Starting search…');
    const [sid, setSid] = useState('');
    useEffect(() => {
        setRows([]); setSid(''); setStatus('Starting search…');
        return startSectionSearch({
            onStart,
            run: async (signal) => {
                const response = await runManagedSearch({spl: section.spl, earliestTime: earliest, latestTime: 'now',
                    appContext: 'splunk-cisco-dashboards', count: 20, maxTimeSeconds: 45,
                    tag: `expandable-example:${section.id}`, signal,
                    onProgress: (progress: {sid: string}) => {if (!signal.aborted) setSid(progress.sid);}});
                if (response.timedOut) throw new Error('The search timed out. Partial results are not displayed.');
                return response.results as Row[];
            },
            onResult: (result) => {setRows(result); setStatus(result.length ? 'Search completed' : 'No observations returned for this window.');},
            onError: () => setStatus('Search could not complete. Check the source data, permissions, or search job.'),
        });
    }, [section, earliest, onStart]);
    const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))].filter((key) => !key.startsWith('_'));
    return <div className="mt-4 overflow-x-auto">
        <p role="status">{status}</p>
        {sid && <p className="my-2 text-xs">Search job: <code>{sid}</code></p>}
        {rows.length > 0 && <table className="w-full text-left text-sm"><thead><tr>{columns.map((column) => <th className="border-b sui-border-weak p-2" key={column}>{column}</th>)}</tr></thead>
            <tbody>{rows.map((row, i) => <tr key={i}>{columns.map((column) => <td className="border-b sui-border-weak p-2" key={column}>{String(row[column] ?? '—')}</td>)}</tr>)}</tbody></table>}
    </div>;
}

export function ExpandableSection({section, earliest, onStart}: {section: ExampleSection; earliest: string; onStart: () => void}) {
    const [open, setOpen] = useState(false);
    return <section className="mb-4 rounded-lg border sui-border-weak sui-bg-section p-5">
        <button className="flex w-full items-center justify-between text-left text-lg font-semibold" aria-expanded={open}
            aria-controls={`panel-${section.id}`} onClick={() => setOpen((value) => !value)}>
            <span>{section.title}</span><span aria-hidden="true">{open ? '−' : '+'}</span>
        </button>
        <p className="mt-2 text-sm">{section.description}</p>
        <div id={`panel-${section.id}`} hidden={!open}>{open && <SectionResults section={section} earliest={earliest} onStart={onStart}/>}</div>
        {!open && <p className="mt-3 text-sm">Closed — open this section to request its search.</p>}
    </section>;
}

export default function ExpandableSearchExample() {
    const [tab, setTab] = useState('overview');
    const [earliest, setEarliest] = useState('-4h');
    const [requested, setRequested] = useState(0);
    const [reset, setReset] = useState(0);
    const onStart = useCallback(() => setRequested((count) => count + 1), []);
    const active = EXAMPLE_TABS.find((item) => item.id === tab)!;
    return <main className="min-h-screen sui-bg-page sui-color-active p-6"><div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-bold">Expandable Search Example (Under Dev)</h1>
        <p className="my-3">Try opening a section below. Its search runs only while that section is open.</p>
        <p className="mb-4 text-sm">Closing requests cancellation of an active search. Reopening requests fresh results. Changing tabs closes sections; changing the time range reruns only open sections. These are live Catalyst observations, not sample values.</p>
        <div className="mb-5 flex flex-wrap items-center gap-2"><span>Time range</span>{ranges.map(([label, value]) => <button key={value} className={buttonClass} aria-pressed={earliest === value} style={earliest === value ? {backgroundColor: '#049fd9', color: '#ecf0f5'} : undefined} onClick={() => setEarliest(value)}>{label}</button>)}</div>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded border sui-border-weak p-4">
            <p aria-live="polite">Searches requested this visit: <strong>{requested}</strong></p>
            <button className={buttonClass} onClick={() => setReset((value) => value + 1)}>Close all sections</button>
        </div>
        <div role="tablist" aria-label="Example dashboard tabs" className="mb-4 flex flex-wrap gap-2">{EXAMPLE_TABS.map((item) => <button key={item.id} id={`tab-${item.id}`} role="tab" aria-selected={tab === item.id} style={tab === item.id ? {backgroundColor: '#049fd9', color: '#ecf0f5'} : undefined} aria-controls={`tab-panel-${item.id}`} className={buttonClass} onClick={() => setTab(item.id)}>{item.label}</button>)}</div>
        <div key={`${tab}-${reset}`} id={`tab-panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`}>
            {active.sections.map((section) => <ExpandableSection key={section.id} section={section} earliest={earliest} onStart={onStart}/>)}</div>
    </div></main>;
}
