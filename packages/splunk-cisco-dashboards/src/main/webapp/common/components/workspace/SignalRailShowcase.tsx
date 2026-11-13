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
    background-color: #060d17; border: 1px solid #3d556b; border-radius: 9px;
    background-position: center; background-size: 100% 100%;
    &[data-showcase="prism-pulse"] { display: flex; align-items: stretch; background-size: 100% 200%; background-color: transparent; border: 0; border-radius: 0; }
    .showcase-scroll { overflow-x: auto; scrollbar-width: thin; padding: 6px 8px; }
    .showcase-grid { display: grid; width: 100%; gap: 0; align-items: stretch; }
    .showcase-grid[data-moving="true"] { display: flex; width: max-content; }
    .showcase-grid[data-moving="true"] > article { width: 190px; flex: 0 0 auto; }
    .showcase-grid[data-moving="true"] > article[data-featured="true"] { width: 230px; }
    article { min-width: 0; padding: 4px 8px; border-inline-end: 1px solid #334153; }
    article:last-child { border: 0; }
    .showcase-label-row { display: flex; align-items: start; gap: 4px; min-height: 32px; }
    .showcase-label { flex: 1; min-width: 0; font-size: var(--rail-label-size); line-height: 1.2; font-weight: 650; overflow-wrap: anywhere; }
    a { color: #c7deec; flex: 0 0 auto; padding: 2px; border-radius: 3px; }
    a:hover { color: #fff; } a:focus-visible { outline: 2px solid #7bddff; outline-offset: 3px; }
    .showcase-readout { display: flex; flex-wrap: wrap; align-items: center; gap: 3px 6px; }
    .showcase-value { display: block; min-width: 0; font-size: var(--rail-value-size); font-weight: 750; line-height: 1.1; letter-spacing: -.03em; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
    .showcase-value[data-loading="true"] { font-size: 16px; }
    [data-featured="true"] .showcase-value { font-size: calc(var(--rail-value-size) * 1.1); }
    [data-featured="true"] .showcase-value[data-loading="true"] { font-size: 16px; }
    [data-featured="true"] { box-shadow: inset 3px 0 0 var(--signal-color); }
    .showcase-status { display: inline-flex; flex: 0 0 auto; white-space: nowrap; color: var(--signal-color); border: 1px solid currentColor; border-radius: 12px; padding: 1px 5px; font-size: 10px; line-height: 1.4; font-weight: 750; letter-spacing: .02em; text-transform: uppercase; }
    .showcase-trend { height: 12px; width: 100%; min-width: 0; }
    &[data-showcase="prism-pulse"] .showcase-scroll { flex: 1; min-width: 0; padding: 8px 10px; }
    &[data-showcase="prism-pulse"] article { display: flex; flex-direction: column; min-height: 146px; padding: 8px 12px; }
    &[data-showcase="prism-pulse"] .showcase-label-row { min-height: 38px; }
    &[data-showcase="prism-pulse"] .showcase-label { font-size: calc(var(--rail-label-size) + 1px); }
    &[data-showcase="prism-pulse"] .showcase-readout { flex-direction: column; align-items: flex-start; gap: 4px; }
    &[data-showcase="prism-pulse"] .showcase-value { font-size: calc(var(--rail-value-size) * 1.22); }
    &[data-showcase="prism-pulse"] .showcase-value[data-loading="true"] { font-size: 16px; }
    &[data-showcase="prism-pulse"] .showcase-status { border: 0; border-radius: 0; padding: 0; font-size: 12px; }
    &[data-showcase="prism-pulse"] .showcase-trend { height: 32px; margin-top: auto; padding-top: 4px; }
    &[data-showcase="prism-pulse"] [data-featured="true"] { padding-inline: 16px 24px; box-shadow: none; background-size: 100% 100%; background-repeat: no-repeat; }
    &[data-showcase="prism-pulse"] [data-featured="true"] .showcase-label { font-size: calc(var(--rail-label-size) + 8px); }
    &[data-showcase="prism-pulse"] [data-featured="true"] .showcase-readout { flex-direction: row; align-items: center; gap: 12px; }
    &[data-showcase="prism-pulse"] [data-featured="true"] .showcase-value { font-size: calc(var(--rail-value-size) * 2); }
    &[data-showcase="prism-pulse"] [data-featured="true"] .showcase-value[data-loading="true"] { font-size: 16px; }
    &[data-showcase="prism-pulse"] [data-featured="true"] .showcase-status { font-size: 14px; }
    &[data-showcase="prism-pulse"] .showcase-grid[data-moving="true"] > article { width: 180px; }
    &[data-showcase="prism-pulse"] .showcase-grid[data-moving="true"] > article[data-featured="true"] { width: 330px; }
    .showcase-integrated-controls { display: flex; flex: 0 0 112px; align-items: center; justify-content: center; padding: 8px; }
    .showcase-no-trend { display: flex; align-items: center; height: 100%; font-size: 10px; line-height: 1; white-space: nowrap; color: #b6c5d4; }
    .showcase-orb { display: flex; flex: 0 0 auto; align-items: center; justify-content: center; width: var(--rail-orbit-size); height: var(--rail-orbit-size); background-size: contain; background-position: center; background-repeat: no-repeat; padding: 5px; }
    .showcase-orbit-copy { flex: 1; min-width: 0; }
    &[data-showcase="signal-orbit"] article { display: flex; align-items: center; gap: 4px; padding-inline: 5px; }
    &[data-showcase="signal-orbit"] .showcase-label-row { min-height: 0; gap: 2px; }
    &[data-showcase="signal-orbit"] .showcase-value { font-size: min(calc(var(--rail-value-size) * .8), calc((var(--rail-orbit-size) - 10px) / var(--rail-value-chars) * 1.3)); white-space: nowrap; text-align: center; }
    &[data-showcase="signal-orbit"] .showcase-value[data-loading="true"] { font-size: 11px; }
    &[data-showcase="signal-orbit"] .showcase-status { margin: 2px 0; }
    &[data-showcase="event-horizon"] .showcase-trend { filter: drop-shadow(0 0 2px var(--signal-color)); }
    &[data-showcase="event-horizon"] .showcase-no-trend { filter: none; }
    @media (forced-colors: active) { background-image: none !important; color: CanvasText; .showcase-status { color: CanvasText; } }
`;

const TrendTooltip = styled.div<{ $themeAware: boolean }>`
    background: ${({ $themeAware }) => $themeAware ? variables.backgroundColorPopup : '#101c2a'};
    color: ${({ $themeAware }) => $themeAware ? variables.contentColorDefault : '#edf5ff'};
    border: 1px solid ${({ $themeAware }) => $themeAware ? variables.borderColor : '#637588'};
`;

export function SignalRailTrend({ kpi, stroke, themeAware = false, compact = false }: { kpi: SignalRailKpi; stroke?: string; themeAware?: boolean; compact?: boolean }) {
    const anchor = useRef<HTMLDivElement>(null);
    const points = kpi.series ?? [];
    return <div ref={anchor} className="showcase-trend" style={themeAware ? { height: '100%' } : undefined} aria-label={points.length > 1 ? `${kpi.label}: ${points.length} observed trend samples` : `${kpi.label}: trend unavailable`}>
        {points.length > 1 ? <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: compact ? 2 : 6, bottom: compact ? 1 : 4, left: 2, right: 2 }}>
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
        </ResponsiveContainer> : <span className="showcase-no-trend">{compact ? 'No trend' : 'Trend unavailable'}</span>}
    </div>;
}

const ShowcaseItem = ({ kpi, variant, featured, duplicate }: {
    kpi: SignalRailKpi; variant: SignalRailShowcaseVariant; featured: boolean; duplicate: boolean;
}) => {
    const value = <span className="showcase-value" data-loading={kpi.value === 'Loading'}>{kpi.value}{kpi.unit ?? ''}</span>;
    const trend = <SignalRailTrend kpi={kpi} compact />;
    const label = <div className="showcase-label-row">
            <span className="showcase-label">{kpi.label}</span>
            {kpi.canOpen !== false && kpi.href && <a href={kpi.href} target="_blank" rel="noopener noreferrer" tabIndex={duplicate ? -1 : 0} aria-label={`Open ${kpi.label} in Search`} title={`Open ${kpi.label} in Search`}><ExternalLink style={{ width: 13, height: 13 }} aria-hidden="true" /></a>}
        </div>;
    const status = <span className="showcase-status">{statuses[kpi.status]}</span>;
    return <article data-status={kpi.status} data-featured={featured} style={{ '--signal-color': colors[kpi.status], '--rail-value-chars': Math.max(1, `${kpi.value}${kpi.unit ?? ''}`.length), backgroundImage: featured && kpi.status === 'critical' ? `url("${imageURL('prism-critical-facet')}")` : undefined } as React.CSSProperties}>
        {variant === 'signal-orbit' ? <>
            <div className="showcase-orb" style={{ backgroundImage: `url("${imageURL('signal-orbit')}")` }}>{value}</div>
            <div className="showcase-orbit-copy">{label}{status}{trend}</div>
        </> : <>{label}<div className="showcase-readout">{value}{status}</div>{trend}</>}
    </article>;
};

export default function SignalRailShowcase({ kpis, variant, fontSize, density, rows, durationSeconds, paused, onOverflowChange, controls }: {
    kpis: SignalRailKpi[]; variant: SignalRailShowcaseVariant; fontSize: string;
    density: string; rows: number; durationSeconds: number; paused: boolean;
    onOverflowChange?: (overflow: boolean) => void;
    controls?: React.ReactNode;
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
    const cardMin = variant === 'signal-orbit' ? 176 : variant === 'prism-pulse' ? 148 : density === 'compact' ? 154 : 160;
    const requiredWidth = Math.max(...groups.map((g, r) => g.length * cardMin + (variant === 'prism-pulse' && r === 0 ? 330 - cardMin : 0))) + (variant === 'prism-pulse' ? 20 : 18);
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
    const size = fontSize === 'large' ? [14, 32, 64] : fontSize === 'small' ? [12, 24, 52] : [13, 28, 60];
    const background = variant === 'signal-orbit' ? undefined : `url("${imageURL(variant)}")`;
    return <Showcase data-showcase={variant} style={{ backgroundImage: background, '--rail-label-size': `${size[0]}px`, '--rail-value-size': `${size[1]}px`, '--rail-orbit-size': `${size[2]}px` } as React.CSSProperties}>
        <div ref={scrollArea} className="showcase-scroll" tabIndex={0} role="region" aria-label="Signal cards; scroll horizontally for more signals">
            {groups.map((group, r) => {
                const columns = group.map((_, i) => variant === 'prism-pulse' && r === 0 && i === 0 ? 'minmax(330px,2fr)' : `minmax(${cardMin}px,1fr)`).join(' ');
                const pass = (duplicate: boolean) => <div key={String(duplicate)} className="showcase-grid" data-moving={moving} aria-hidden={duplicate || undefined} style={{ gridTemplateColumns: columns }}>
                    {group.map((kpi, i) => <ShowcaseItem key={kpi.id} kpi={kpi} variant={variant} featured={variant === 'prism-pulse' && i === 0 && r === 0} duplicate={duplicate} />)}
                </div>;
                return <div key={r} className={moving ? 'scd-signal-rail-marquee-track flex' : ''} data-paused={paused} style={{ animationDuration: `${durationSeconds}s` }}>
                    {pass(false)}{moving && pass(true)}
                </div>;
            })}
        </div>
        {controls && variant === 'prism-pulse' && <div className="showcase-integrated-controls">{controls}</div>}
    </Showcase>;
}
