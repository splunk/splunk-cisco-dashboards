/**
 * IncidentTicker — auto-cycling strip of recent critical events.
 *
 * Driven by a Splunk saved search whose result rows look like
 *
 *     _time, severity, source, message
 *
 * Falls back to a static placeholder list if the search isn't wired or
 * returns no rows. Each row is shown for `intervalMs` (default 5 s) and
 * the ticker pauses on hover so executives can read.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { cn } from '@/common/lib/utils';
import { runSearch } from '@/common/services/splunkSearchService';
import type { TimeRange } from '@/common/hooks/useMetric';

export type IncidentSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface IncidentRow {
    severity: IncidentSeverity;
    source: string;
    message: string;
    when: string;
}

interface IncidentTickerProps {
    /** Saved-search stanza to drive the feed. */
    savedSearch?: string;
    range: TimeRange;
    refreshToken: number;
    intervalMs?: number;
    fallback?: IncidentRow[];
}

const FALLBACK_INCIDENTS: IncidentRow[] = [
    {
        severity: 'medium',
        source: 'Catalyst Center',
        message: 'Awaiting incident feed — wire `Overview - ds_recent_incidents` to populate.',
        when: '—',
    },
];

const ICON: Record<IncidentSeverity, React.ComponentType<{ className?: string }>> = {
    critical: AlertCircle,
    high: AlertCircle,
    medium: AlertTriangle,
    low: Info,
    info: Info,
};

const COLOR: Record<IncidentSeverity, string> = {
    critical: 'text-red-500',
    high: 'text-red-500',
    medium: 'text-amber-500',
    low: 'text-sky-500',
    info: 'text-slate-500',
};

const NAME_PATTERN = /^[\w\s\-.:()]+$/;

const buildSpl = (name: string): string => {
    if (!name || name.length > 256 || !NAME_PATTERN.test(name)) return '';
    return `| savedsearch "${name}"`;
};

const normalizeSeverity = (raw: unknown): IncidentSeverity => {
    const s = String(raw ?? '').toLowerCase();
    if (s.startsWith('crit')) return 'critical';
    if (s.startsWith('high') || s === '4') return 'high';
    if (s.startsWith('med') || s === '3') return 'medium';
    if (s.startsWith('low') || s === '2') return 'low';
    return 'info';
};

export const IncidentTicker: React.FC<IncidentTickerProps> = ({
    savedSearch,
    range,
    refreshToken,
    intervalMs = 5000,
    fallback = FALLBACK_INCIDENTS,
}) => {
    const [rows, setRows] = useState<IncidentRow[]>(fallback);
    const [paused, setPaused] = useState(false);
    const [index, setIndex] = useState(0);

    const spl = useMemo(() => (savedSearch ? buildSpl(savedSearch) : ''), [savedSearch]);

    useEffect(() => {
        if (!spl) {
            setRows(fallback);
            setIndex(0);
            return undefined;
        }
        let cancelled = false;
        runSearch({
            spl,
            earliestTime: range.earliest,
            latestTime: range.latest,
            tag: 'incident_ticker',
        })
            .then((res) => {
                if (cancelled) return;
                const raw = (res?.results ?? []) as Array<Record<string, unknown>>;
                const mapped: IncidentRow[] = raw
                    .map((r) => ({
                        severity: normalizeSeverity(r.severity),
                        source: String(r.source ?? r.host ?? '').trim() || '—',
                        message: String(r.message ?? r._raw ?? '').trim(),
                        when: String(r._time ?? '').trim() || '',
                    }))
                    .filter((r) => r.message);
                if (mapped.length === 0) setRows(fallback);
                else setRows(mapped.slice(0, 25));
                setIndex(0);
            })
            .catch(() => {
                if (!cancelled) setRows(fallback);
            });
        return () => {
            cancelled = true;
        };
    }, [spl, range.earliest, range.latest, refreshToken, fallback]);

    useEffect(() => {
        if (paused || rows.length <= 1) return undefined;
        const id = window.setInterval(() => {
            setIndex((i) => (i + 1) % rows.length);
        }, intervalMs);
        return () => window.clearInterval(id);
    }, [paused, rows.length, intervalMs]);

    const current = rows[index] ?? fallback[0];
    const Icon = ICON[current.severity];
    const colorClass = COLOR[current.severity];

    return (
        <div
            className="flex items-center gap-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300 overflow-hidden"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
        >
            <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex-shrink-0">
                Incident Feed
            </span>
            <Icon className={cn('w-3.5 h-3.5 flex-shrink-0', colorClass)} />
            <div className="flex-1 min-w-0 relative h-4">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={`${current.message}-${index}`}
                        initial={{ y: 8, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -8, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="absolute inset-0 flex items-center gap-2 truncate"
                    >
                        <span
                            className={cn(
                                'font-black uppercase tracking-wider text-[9px]',
                                colorClass
                            )}
                        >
                            {current.severity}
                        </span>
                        <span className="text-slate-400 dark:text-slate-500">
                            {current.source}
                        </span>
                        <span className="text-slate-700 dark:text-slate-200 truncate">
                            {current.message}
                        </span>
                    </motion.div>
                </AnimatePresence>
            </div>
            <span className="text-[9px] text-slate-400 dark:text-slate-500 font-mono flex-shrink-0 ml-2">
                {rows.length > 1 ? `${index + 1}/${rows.length}` : '·'}
                {paused && rows.length > 1 ? ' · paused' : ''}
            </span>
        </div>
    );
};
