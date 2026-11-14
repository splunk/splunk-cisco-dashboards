import React, { useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { variables } from '@splunk/themes';
import { ExternalLink } from '@/common/icons/SuiIcon';
import { refinedSignalRailLayout, isSignalRailSearchHref } from '@/common/lib/refinedSignalRail';
import type { SignalRailKpi } from './SignalRailTicker';
import { SignalRailTrend } from './SignalRailShowcase';

const Rail = styled.div`
    display: flex; align-items: stretch; gap: 10px; width: 100%; min-width: 0;
    color: ${variables.contentColorActive};
    &[data-refined-style="prism-pulse"] {
        padding: 8px; border: 1px solid color-mix(in srgb, ${variables.severityColorInfo} 35%, ${variables.borderColor});
        border-radius: 9px; background: ${variables.backgroundColorPage};
    }
    .refined-signals { flex: 1; min-width: 0; overflow-x: auto; scrollbar-width: thin; }
    .refined-signals[data-moving="true"] { overflow: hidden; }
    .refined-row + .refined-row { margin-top: 8px; }
    .refined-grid { display: grid; gap: 8px; width: 100%; }
    .refined-grid[data-moving="true"] { flex: 0 0 auto; }
    article { position: relative; isolation: isolate; min-width: 0; padding: var(--refined-padding); border: 1px solid ${variables.borderColorWeak}; border-radius: 6px; background: ${variables.backgroundColorSection}; }
    .refined-label { display: block; min-height: 2.4em; padding-right: 17px; font-size: var(--refined-label); font-weight: 650; line-height: 1.2; overflow-wrap: anywhere; }
    .refined-category { display: block; margin: 3px 0 4px; color: ${variables.contentColorMuted}; font-size: 12px; line-height: 1.25; overflow-wrap: anywhere; }
    .refined-readout { display: flex; flex-wrap: wrap; gap: 5px 8px; align-items: center; justify-content: space-between; }
    .refined-value { min-width: 0; font-size: var(--refined-value); font-weight: 750; line-height: 1.2; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
    .refined-value[data-loading="true"] { font-size: 16px; }
    .refined-status { flex: 0 0 auto; padding: 2px 5px; border: 1px solid var(--refined-status-color); border-radius: 5px; color: var(--refined-status-color); font-size: 12px; line-height: 1.25; font-weight: 650; white-space: nowrap; }
    article[data-status="healthy"] { --refined-status-color: ${variables.severityColorNormal}; }
    article[data-status="warning"] { --refined-status-color: ${variables.severityColorNotice}; }
    article[data-status="critical"] { --refined-status-color: ${variables.severityColorAlert}; }
    article[data-status="unknown"] { --refined-status-color: ${variables.contentColorMuted}; }
    .refined-search { position: absolute; top: 8px; right: 7px; color: ${variables.contentColorMuted}; border-radius: 3px; padding: 2px; }
    .refined-search:hover { color: ${variables.contentColorActive}; }
    .refined-search:focus-visible { outline: 2px solid ${variables.focusColor}; outline-offset: 2px; }
    .refined-trend { height: 14px; min-width: 0; margin-top: 6px; color: var(--refined-status-color); }
    &[data-refined-style="prism-pulse"] article { border-color: transparent; background: color-mix(in srgb, ${variables.backgroundColorSection} 65%, transparent); }
    &[data-refined-style="prism-pulse"] article[data-featured="true"] { border-color: color-mix(in srgb, ${variables.severityColorAlert} 45%, ${variables.borderColor}); }
    &[data-refined-style="prism-pulse"] article[data-featured="true"]::before {
        content: ''; position: absolute; z-index: -1; inset: 0; pointer-events: none;
        background: color-mix(in srgb, ${variables.severityColorAlert} 12%, ${variables.backgroundColorSection});
        clip-path: polygon(0 0, 100% 0, calc(100% - 16px) 100%, 0 100%); border-radius: inherit;
    }
    .refined-controls { flex: 0 0 84px; align-self: center; max-width: 84px; }
    && .refined-controls .scd-signal-rail-controls { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px; }
    && .refined-controls .showcase-inline-summary { flex: 0 0 100%; width: 100%; justify-content: center; }
    @media (prefers-reduced-motion: reduce) { .scd-signal-rail-marquee-track { animation: none; transform: none; } }
    @media (forced-colors: active) { article { border: 1px solid CanvasText; } article::before { display: none; } .refined-status { color: CanvasText; border-color: CanvasText; } }
`;

const statusLabels = { healthy: 'Healthy', warning: 'Warning', critical: 'Critical', unknown: 'Unknown' };

export default function RefinedSignalRail({ kpis, variant, fontSize, density, rows, durationSeconds, paused, onOverflowChange, controls }: {
    kpis: SignalRailKpi[]; variant: 'minimal-enterprise' | 'prism-pulse'; fontSize: string;
    density: string; rows: number; durationSeconds: number; paused: boolean;
    onOverflowChange: (overflow: boolean) => void; controls: React.ReactNode;
}) {
    const viewport = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(0);
    const [reducedMotion, setReducedMotion] = useState(false);
    const minimum = fontSize === 'large' ? 240 : fontSize === 'small' ? 196 : 208;
    const layout = refinedSignalRailLayout(kpis.length, width, minimum, rows);
    const moving = layout.overflow && durationSeconds > 0 && !reducedMotion;
    useEffect(() => {
        const node = viewport.current;
        if (!node) return;
        const measure = () => setWidth(node.clientWidth);
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(node);
        return () => observer.disconnect();
    }, []);
    useEffect(() => {
        const media = window.matchMedia('(prefers-reduced-motion: reduce)');
        const update = () => setReducedMotion(media.matches);
        update(); media.addEventListener('change', update);
        return () => media.removeEventListener('change', update);
    }, []);
    useEffect(() => onOverflowChange(layout.overflow && !reducedMotion), [layout.overflow, reducedMotion, onOverflowChange]);
    const ordered = useMemo(() => {
        if (variant !== 'prism-pulse') return kpis;
        const firstCritical = kpis.findIndex(kpi => kpi.status === 'critical');
        return firstCritical > 0 ? [kpis[firstCritical], ...kpis.slice(0, firstCritical), ...kpis.slice(firstCritical + 1)] : kpis;
    }, [kpis, variant]);
    const groups = Array.from({ length: layout.rowCount }, (_, i) => ordered.slice(i * layout.columns, (i + 1) * layout.columns)).filter(group => group.length);
    const renderGrid = (group: SignalRailKpi[], duplicate: boolean) => <div className="refined-grid" data-moving={moving} aria-hidden={duplicate || undefined}
        style={{ gridTemplateColumns: `repeat(${layout.columns}, minmax(${layout.overflow ? `${minimum}px` : '0'}, 1fr))`, width: layout.overflow ? layout.columns * minimum + (layout.columns - 1) * 8 : undefined }}>
        {group.map(kpi => <article key={kpi.id} data-status={kpi.status} data-featured={variant === 'prism-pulse' && kpi === ordered[0] && kpi.status === 'critical' || undefined}>
            <span className="refined-label">{kpi.label}</span>
            {kpi.canOpen !== false && isSignalRailSearchHref(kpi.href) && <a className="refined-search" href={kpi.href} target="_blank" rel="noopener noreferrer" tabIndex={duplicate ? -1 : 0} aria-label={`Open ${kpi.label} in Search`} title={`Open ${kpi.label} in Search`}><ExternalLink style={{ width: 13, height: 13 }} aria-hidden="true" /></a>}
            {variant === 'minimal-enterprise' && <span className="refined-category">{kpi.category}</span>}
            <div className="refined-readout"><span className="refined-value" data-loading={kpi.value === 'Loading'}>{kpi.value}{kpi.unit ?? ''}</span><span className="refined-status">{statusLabels[kpi.status]}</span></div>
            {variant === 'prism-pulse' && <div className="refined-trend"><SignalRailTrend kpi={kpi} compact themeAware stroke="currentColor" /></div>}
        </article>)}
    </div>;
    return <Rail data-refined-style={variant} style={{ '--refined-label': fontSize === 'large' ? '16px' : '14px', '--refined-value': fontSize === 'large' ? '32px' : fontSize === 'small' ? '24px' : '28px', '--refined-padding': density === 'compact' ? '7px 8px' : '9px 10px' } as React.CSSProperties}>
        <div className="refined-signals" ref={viewport} data-moving={moving} tabIndex={layout.overflow && !moving ? 0 : undefined} role="region" aria-label="Signal cards">
            {groups.map((group, i) => <div className="refined-row" key={i}><div className={moving ? 'scd-signal-rail-marquee-track flex' : undefined} data-paused={paused} style={{ animationDuration: `${durationSeconds}s` }}>{renderGrid(group, false)}{moving && renderGrid(group, true)}</div></div>)}
        </div>
        <div className="refined-controls">{controls}</div>
    </Rail>;
}
