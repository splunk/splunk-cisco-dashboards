import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import { variables } from '@splunk/themes';
import { createStaticURL } from '@splunk/splunk-utils/url';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ExternalLink } from '@/common/icons/SuiIcon';
import type { SignalRailKpi } from './SignalRailTicker';
import { formatSignalRailTime } from '@/common/lib/signalRailSeries';

export type SignalRailShowcaseVariant = 'prism-pulse' | 'signal-orbit' | 'event-horizon';
const imageURL = (name: string) => createStaticURL(`app/splunk-cisco-dashboards/images/signal-rail/${name}.png`);
const colors = { healthy: '#78e0c2', warning: '#ffbd55', critical: '#ff4869', unknown: '#bdc8d8' };
const statuses = { healthy: 'Healthy', warning: 'Warning', critical: 'Critical', unknown: 'Watching' };

const Showcase = styled.div`
    width: 100%; min-width: 0; color: #edf5ff;
    background-color: #060d17; border: 1px solid #3d556b; border-radius: 12px;
    background-position: center; background-size: 100% 100%;
    &[data-showcase="prism-pulse"] { background-size: 100% 200%; }
    .showcase-scroll { overflow-x: auto; scrollbar-width: thin; padding: 10px 12px 4px; }
    .showcase-grid { display: grid; width: 100%; gap: 0; align-items: stretch; }
    .showcase-grid[data-moving="true"] { display: flex; width: max-content; }
    .showcase-grid[data-moving="true"] > article { width: 220px; flex: 0 0 auto; }
    .showcase-grid[data-moving="true"] > article[data-featured="true"] { width: 300px; }
    article { min-width: 0; padding: 4px 18px; border-inline-end: 1px solid #334153; }
    article:last-child { border: 0; }
    .showcase-label-row { display: flex; align-items: start; gap: 8px; min-height: 38px; }
    .showcase-label { flex: 1; font-size: var(--rail-label-size); line-height: 1.35; font-weight: 650; overflow-wrap: anywhere; }
    a { color: #c7deec; flex: 0 0 auto; padding: 3px; border-radius: 3px; }
    a:hover { color: #fff; } a:focus-visible { outline: 2px solid #7bddff; outline-offset: 3px; }
    .showcase-value { display: block; font-size: var(--rail-value-size); font-weight: 750; line-height: 1.15; letter-spacing: -.03em; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
    [data-featured="true"] .showcase-value { font-size: calc(var(--rail-value-size) * 1.25); }
    [data-featured="true"] { box-shadow: inset 3px 0 0 var(--signal-color); }
    .showcase-status { display: inline-block; color: var(--signal-color); font-size: 12px; line-height: 1.5; font-weight: 750; letter-spacing: .06em; text-transform: uppercase; margin: 3px 0; }
    .showcase-trend { height: 34px; width: 100%; min-width: 0; }
    .showcase-no-trend { display: flex; align-items: center; height: 100%; font-size: 12px; color: #b6c5d4; }
    .showcase-summary { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 18px; padding: 5px 24px 7px; font-size: 12px; color: #b9cadd; }
    .showcase-summary strong { margin-inline-end: auto; letter-spacing: .09em; text-transform: uppercase; }
    .showcase-summary span { white-space: nowrap; }
    .showcase-orb { display: flex; flex-direction: column; align-items: center; justify-content: center; width: 120px; height: 120px; margin: 0 auto; background-size: contain; background-position: center; background-repeat: no-repeat; padding: 12px; }
    &[data-showcase="signal-orbit"] .showcase-label-row { text-align: center; }
    &[data-showcase="signal-orbit"] .showcase-value { font-size: calc(var(--rail-value-size) * .88); text-align: center; }
    &[data-showcase="signal-orbit"] .showcase-trend { height: 24px; }
    &[data-showcase="signal-orbit"] .showcase-status { display: block; text-align: center; }
    &[data-showcase="event-horizon"] .showcase-trend { height: 40px; filter: drop-shadow(0 0 4px var(--signal-color)); }
    &[data-showcase="event-horizon"] .showcase-status { border: 1px solid currentColor; padding: 1px 8px; border-radius: 5px; }
    &[data-showcase="event-horizon"] .showcase-no-trend { filter: none; }
    @media (forced-colors: active) { background-image: none !important; color: CanvasText; .showcase-status { color: CanvasText; } }
`;

const TrendTooltip = styled.div<{ $themeAware: boolean }>`
    background: ${({ $themeAware }) => $themeAware ? variables.backgroundColorPopup : '#101c2a'};
    color: ${({ $themeAware }) => $themeAware ? variables.contentColorDefault : '#edf5ff'};
    border: 1px solid ${({ $themeAware }) => $themeAware ? variables.borderColor : '#637588'};
`;

export function SignalRailTrend({ kpi, stroke, themeAware = false }: { kpi: SignalRailKpi; stroke?: string; themeAware?: boolean }) {
    const anchor = useRef<HTMLDivElement>(null);
    const points = kpi.series ?? [];
    return <div ref={anchor} className="showcase-trend" style={themeAware ? { height: '100%' } : undefined} aria-label={points.length > 1 ? `${kpi.label}: ${points.length} observed trend samples` : `${kpi.label}: trend unavailable`}>
        {points.length > 1 ? <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 6, bottom: 4, left: 2, right: 2 }}>
                <XAxis dataKey="time" type="number" domain={['dataMin', 'dataMax']} hide />
                <YAxis domain={['auto', 'auto']} hide />
                <Tooltip content={({ active, payload, label }) => {
                    if (!active || !payload?.length || !anchor.current || typeof document === 'undefined') return null;
                    const rect = anchor.current.getBoundingClientRect();
                    return createPortal(<TrendTooltip $themeAware={themeAware} role="tooltip" style={{
                        position: 'fixed', zIndex: 100000, pointerEvents: 'none', width: 'min(240px, calc(100vw - 16px))',
                        left: Math.max(8, Math.min(rect.left, window.innerWidth - 256)), top: Math.max(8, rect.top - 84),
                        borderRadius: 5, padding: 8,
                        fontSize: 12, lineHeight: 1.4, overflowWrap: 'anywhere',
                    }}><div>{formatSignalRailTime(Number(label))}</div><div>{kpi.label}: <strong>{String(payload[0].value)}{kpi.unit ?? ''}</strong></div></TrendTooltip>, document.body);
                }} />
                <Line type="linear" dataKey="value" stroke={stroke ?? colors[kpi.status]} strokeWidth={2} dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />
            </LineChart>
        </ResponsiveContainer> : <span className="showcase-no-trend">Trend unavailable</span>}
    </div>;
}

const ShowcaseItem = ({ kpi, variant, featured, duplicate }: {
    kpi: SignalRailKpi; variant: SignalRailShowcaseVariant; featured: boolean; duplicate: boolean;
}) => {
    const value = <span className="showcase-value">{kpi.value}{kpi.unit ?? ''}</span>;
    const trend = <SignalRailTrend kpi={kpi} />;
    return <article data-status={kpi.status} data-featured={featured} style={{ '--signal-color': colors[kpi.status] } as React.CSSProperties}>
        <div className="showcase-label-row">
            <span className="showcase-label">{kpi.label}</span>
            {kpi.canOpen !== false && kpi.href && <a href={kpi.href} target="_blank" rel="noopener noreferrer" tabIndex={duplicate ? -1 : 0} aria-label={`Open ${kpi.label} in Search`} title={`Open ${kpi.label} in Search`}><ExternalLink style={{ width: 13, height: 13 }} aria-hidden="true" /></a>}
        </div>
        {variant === 'signal-orbit' ? <div className="showcase-orb" style={{ backgroundImage: `url("${imageURL('signal-orbit')}")` }}>{value}{trend}</div> : value}
        <span className="showcase-status">{statuses[kpi.status]}</span>
        {variant !== 'signal-orbit' && trend}
    </article>;
};

export default function SignalRailShowcase({ kpis, variant, fontSize, density, rows, durationSeconds, paused, onOverflowChange }: {
    kpis: SignalRailKpi[]; variant: SignalRailShowcaseVariant; fontSize: string;
    density: string; rows: number; durationSeconds: number; paused: boolean;
    onOverflowChange?: (overflow: boolean) => void;
}) {
    const scrollArea = useRef<HTMLDivElement>(null);
    const [hasOverflow, setHasOverflow] = useState(false);
    const ordered = useMemo(() => {
        if (variant !== 'prism-pulse') return kpis;
        const i = kpis.findIndex(k => k.status === 'critical');
        if (i <= 0) return kpis;
        return [kpis[i], ...kpis.slice(0, i), ...kpis.slice(i + 1)];
    }, [kpis, variant]);
    const groups = rows === 2 && ordered.length > 3
        ? [ordered.filter((_, i) => i % 2 === 0), ordered.filter((_, i) => i % 2 === 1)] : [ordered];
    const counts = { healthy: 0, warning: 0, critical: 0, unknown: 0 };
    kpis.forEach(k => counts[k.status]++);
    const cardMin = variant === 'signal-orbit' ? 205 : density === 'compact' ? 170 : 185;
    const requiredWidth = Math.max(...groups.map((g, r) => g.length * cardMin + (variant === 'prism-pulse' && r === 0 ? 260 - cardMin : 0))) + 26;
    useEffect(() => {
        const node = scrollArea.current;
        if (!node) return;
        const measure = () => {
            const overflow = requiredWidth > node.clientWidth;
            setHasOverflow(overflow); onOverflowChange?.(overflow);
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(node);
        return () => observer.disconnect();
    }, [requiredWidth, onOverflowChange]);
    const moving = durationSeconds > 0 && hasOverflow;
    const size = fontSize === 'large' ? [16, 44] : fontSize === 'small' ? [13, 32] : [14, 38];
    const background = variant === 'signal-orbit' ? undefined : `url("${imageURL(variant)}")`;
    return <Showcase data-showcase={variant} style={{ backgroundImage: background, '--rail-label-size': `${size[0]}px`, '--rail-value-size': `${size[1]}px` } as React.CSSProperties}>
        <div ref={scrollArea} className="showcase-scroll" tabIndex={0} role="region" aria-label="Signal cards; scroll horizontally for more signals">
            {groups.map((group, r) => {
                const columns = group.map((_, i) => variant === 'prism-pulse' && r === 0 && i === 0 ? 'minmax(260px,1.6fr)' : `minmax(${cardMin}px,1fr)`).join(' ');
                const pass = (duplicate: boolean) => <div key={String(duplicate)} className="showcase-grid" data-moving={moving} aria-hidden={duplicate || undefined} style={{ gridTemplateColumns: columns }}>
                    {group.map((kpi, i) => <ShowcaseItem key={kpi.id} kpi={kpi} variant={variant} featured={variant === 'prism-pulse' && i === 0 && r === 0} duplicate={duplicate} />)}
                </div>;
                return <div key={r} className={moving ? 'scd-signal-rail-marquee-track flex' : ''} data-paused={paused} style={{ animationDuration: `${durationSeconds}s` }}>
                    {pass(false)}{moving && pass(true)}
                </div>;
            })}
        </div>
        <div className="showcase-summary"><strong>{kpis.length} signals</strong>
            {Object.entries(counts).map(([status, count]) => <span key={status} style={{ color: colors[status as keyof typeof colors] }}>{count} {statuses[status as keyof typeof statuses]}</span>)}
        </div>
    </Showcase>;
}
