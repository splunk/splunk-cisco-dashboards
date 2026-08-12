import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Badge from '@splunk/react-ui/Badge';
import { variables } from '@splunk/themes';
import { Check, ExternalLink, Palette, Pause, Play, Settings2 } from '@/common/icons/SuiIcon';
import { cn } from '@/common/lib/utils';
import { C3_VISUALIZATION_COLORS } from '@/common/theme/c3VisualizationPalette';
import type { MetricStatus } from '@/common/hooks/useMetric';
import type {
    SignalTickerDensity,
    SignalTickerFontSize,
    SignalTickerRows,
} from '@/common/hooks/usePersistedSignalTicker';
import { OneCdGlassCard } from './OneCdPrimitives';

export type SignalRailStatus = MetricStatus;
export type SignalRailDeltaDirection = 'up' | 'down' | 'flat';
export type SignalRailVariant =
    | 'one-cisco-glass'
    | 'original'
    | 'bloomberg'
    | 'cisco-blue-gradient'
    | 'minimal-enterprise'
    | 'telemetry-constellation';

export interface SignalRailKpi {
    id: string;
    label: string;
    value: string | number;
    unit?: string;
    status: SignalRailStatus;
    category: string;
    delta?: string | number;
    deltaDir?: SignalRailDeltaDirection;
    href?: string;
    canOpen?: boolean;
}

interface SignalRailTickerProps {
    kpis: SignalRailKpi[];
    className?: string;
    density?: SignalTickerDensity;
    fontSize?: SignalTickerFontSize;
    rows?: SignalTickerRows;
    durationSeconds?: number;
    onOpenEditor?: () => void;
}

const STORAGE_KEY = 'signalRailVariant';
const DEFAULT_VARIANT: SignalRailVariant = 'one-cisco-glass';

const VARIANT_OPTIONS: Array<{
    id: SignalRailVariant;
    label: string;
    description: string;
    swatchClassName: string;
}> = [
    {
        id: 'one-cisco-glass',
        label: 'One Cisco Glass',
        description: '1CD spotlight with SUI glass status cards',
        swatchClassName:
            'border border-sky-200/70 bg-gradient-to-br from-white/80 via-sky-100/55 to-violet-200/55',
    },
    {
        id: 'original',
        label: 'Original',
        description: 'White KPI cards with status badges',
        swatchClassName: 'bg-white border border-emerald-300',
    },
    {
        id: 'bloomberg',
        label: 'Bloomberg Terminal',
        description: 'Dark monospace feed with glowing dots',
        swatchClassName: 'bg-[#0a0e1a] border border-[#1e2d4a]',
    },
    {
        id: 'cisco-blue-gradient',
        label: 'Cisco Blue Gradient',
        description: 'Brand gradient with scan lines',
        swatchClassName: 'bg-gradient-to-br from-[#0d2b5e] via-[#1749a0] to-[#0d4f8a]',
    },
    {
        id: 'minimal-enterprise',
        label: 'Minimal Enterprise',
        description: 'Light chip cards with accent bars',
        swatchClassName: 'bg-[#f8fafc] border border-slate-200',
    },
    {
        id: 'telemetry-constellation',
        label: 'Telemetry Constellation',
        description: 'Orbital glass rail with live signal paths',
        swatchClassName:
            'bg-[radial-gradient(circle_at_30%_30%,#67e8f9_0,#172554_34%,#020617_72%)] border border-cyan-300',
    },
];

const signalRailTickerCss = `
@keyframes scd-signal-rail-marquee {
    0% { transform: translateX(0); }
    100% { transform: translateX(-50%); }
}
.scd-signal-rail-marquee-track {
    width: max-content;
    will-change: transform;
    animation-name: scd-signal-rail-marquee;
    animation-timing-function: linear;
    animation-iteration-count: infinite;
}
.scd-signal-rail-marquee-track[data-paused='true'] {
    animation-play-state: paused;
}
@media (prefers-reduced-motion: reduce) {
    .scd-signal-rail-marquee-track {
        animation: none !important;
        transform: none !important;
    }
}
#scan-root .scd-signal-rail-controls {
    opacity: 0;
    pointer-events: none;
    transform: translate(0.25rem, -50%);
}
#scan-root .scd-signal-rail-ticker:hover .scd-signal-rail-controls,
#scan-root .scd-signal-rail-ticker:focus-within .scd-signal-rail-controls,
#scan-root .scd-signal-rail-controls[data-open='true'] {
    opacity: 1 !important;
    pointer-events: auto;
    transform: translate(0, -50%) !important;
}
.scd-signal-rail-cisco {
    background: linear-gradient(135deg, #0d2b5e 0%, #1749a0 52%, #0d4f8a 100%);
}
.scd-signal-rail-cisco::before {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background-image: repeating-linear-gradient(
        0deg,
        rgba(255, 255, 255, 0.08) 0,
        rgba(255, 255, 255, 0.08) 1px,
        transparent 1px,
        transparent 5px
    );
    opacity: 0.45;
    mix-blend-mode: screen;
}
.scd-signal-rail-constellation {
    background:
        radial-gradient(circle at 12% 35%, rgba(34, 211, 238, 0.28), transparent 28%),
        radial-gradient(circle at 88% 42%, rgba(168, 85, 247, 0.24), transparent 32%),
        linear-gradient(100deg, #020617 0%, #07142d 42%, #0c1f3d 100%);
}
.scd-signal-rail-constellation::before {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background-image:
        linear-gradient(rgba(125, 211, 252, 0.09) 1px, transparent 1px),
        linear-gradient(90deg, rgba(125, 211, 252, 0.08) 1px, transparent 1px);
    background-size: 28px 28px;
    mask-image: linear-gradient(90deg, transparent, black 10%, black 90%, transparent);
}
.scd-signal-rail-constellation::after {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: linear-gradient(90deg, transparent, rgba(103, 232, 249, 0.16), transparent);
    mix-blend-mode: screen;
}
.scd-signal-rail-constellation-card::before {
    content: "";
    position: absolute;
    inset: 5px;
    border-radius: 999px;
    border: 1px solid rgba(125, 211, 252, 0.12);
    pointer-events: none;
}
.scd-signal-rail-constellation-card::after {
    content: "";
    position: absolute;
    right: 18px;
    top: 50%;
    width: 54px;
    height: 54px;
    transform: translateY(-50%);
    border-radius: 999px;
    border: 1px dashed rgba(103, 232, 249, 0.25);
    opacity: 0.7;
    pointer-events: none;
}
`;

const STATUS_LABEL: Record<SignalRailStatus, string> = {
    healthy: 'Healthy',
    warning: 'Warning',
    critical: 'Critical',
    unknown: 'Watching',
};

const STATUS_COLOR = {
    healthy: {
        accent: 'bg-emerald-500',
        border: 'border-emerald-300 dark:border-emerald-400/50',
        text: 'text-emerald-600 dark:text-emerald-300',
        textOnDark: 'text-emerald-200',
        soft: 'bg-emerald-500/10 text-emerald-700 border-emerald-400/50 dark:bg-emerald-400/[0.16] dark:text-emerald-200 dark:border-emerald-300/40',
        softOnDark:
            'bg-emerald-300/[0.14] text-emerald-100 border-emerald-200/35',
        glow: 'bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.8)]',
    },
    warning: {
        accent: 'bg-amber-500',
        border: 'border-amber-300 dark:border-amber-400/60',
        text: 'text-amber-600 dark:text-amber-300',
        textOnDark: 'text-amber-200',
        soft: 'bg-amber-500/10 text-amber-700 border-amber-400/60 dark:bg-amber-400/[0.18] dark:text-amber-200 dark:border-amber-300/50',
        softOnDark:
            'bg-amber-300/[0.16] text-amber-100 border-amber-200/40',
        glow: 'bg-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.85)]',
    },
    critical: {
        accent: 'bg-red-500',
        border: 'border-red-300 dark:border-red-400/60',
        text: 'text-red-600 dark:text-red-300',
        textOnDark: 'text-red-200',
        soft: 'bg-red-500/10 text-red-700 border-red-400/60 dark:bg-red-400/[0.18] dark:text-red-200 dark:border-red-300/50',
        softOnDark: 'bg-red-300/[0.16] text-red-100 border-red-200/40',
        glow: 'bg-red-400 shadow-[0_0_14px_rgba(248,113,113,0.85)]',
    },
    unknown: {
        accent: 'bg-slate-400',
        border: 'border-slate-300 dark:border-slate-600',
        text: 'text-slate-500 dark:text-slate-300',
        textOnDark: 'text-slate-200',
        soft: 'bg-slate-500/10 text-slate-600 border-slate-300 dark:bg-slate-300/[0.14] dark:text-slate-200 dark:border-slate-300/35',
        softOnDark:
            'bg-slate-300/[0.14] text-slate-100 border-slate-200/35',
        glow: 'bg-slate-400 shadow-[0_0_12px_rgba(148,163,184,0.65)]',
    },
} satisfies Record<SignalRailStatus, Record<string, string>>;

type BadgeBackground = NonNullable<
    React.ComponentProps<typeof Badge>['backgroundColor']
>;

const STATUS_BADGE_COLOR: Record<SignalRailStatus, string> = {
    healthy: C3_VISUALIZATION_COLORS.positive,
    warning: C3_VISUALIZATION_COLORS.caution,
    critical: C3_VISUALIZATION_COLORS.critical,
    unknown: C3_VISUALIZATION_COLORS.info,
};

const STATUS_BADGE_BACKGROUND: Record<SignalRailStatus, BadgeBackground> = {
    healthy: `color-mix(in srgb, ${STATUS_BADGE_COLOR.healthy} 50%, transparent)`,
    warning: `color-mix(in srgb, ${STATUS_BADGE_COLOR.warning} 50%, transparent)`,
    critical: `color-mix(in srgb, ${STATUS_BADGE_COLOR.critical} 50%, transparent)`,
    unknown: `color-mix(in srgb, ${STATUS_BADGE_COLOR.unknown} 50%, transparent)`,
};

const isSignalRailVariant = (value: string | null): value is SignalRailVariant =>
    value === 'one-cisco-glass' ||
    value === 'original' ||
    value === 'bloomberg' ||
    value === 'cisco-blue-gradient' ||
    value === 'minimal-enterprise' ||
    value === 'telemetry-constellation';

const readStoredVariant = (): SignalRailVariant => {
    if (typeof window === 'undefined') return DEFAULT_VARIANT;
    try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        return isSignalRailVariant(stored) ? stored : DEFAULT_VARIANT;
    } catch {
        return DEFAULT_VARIANT;
    }
};

const writeStoredVariant = (variant: SignalRailVariant): void => {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(STORAGE_KEY, variant);
    } catch {
        // Storage can be disabled; keep the in-session selection.
    }
};

const splitRows = (
    kpis: SignalRailKpi[],
    rows: SignalTickerRows
): SignalRailKpi[][] => {
    if (rows === 2 && kpis.length > 3) {
        return [
            kpis.filter((_, idx) => idx % 2 === 0),
            kpis.filter((_, idx) => idx % 2 === 1),
        ].filter((row) => row.length > 0);
    }
    return [kpis];
};

const valueText = (kpi: SignalRailKpi): string =>
    `${kpi.value}${kpi.unit ?? ''}`;

const deltaText = (kpi: SignalRailKpi): string => {
    if (kpi.delta === undefined || kpi.delta === null || kpi.delta === '') {
        return '+0';
    }
    const prefix = kpi.deltaDir === 'down' ? '-' : kpi.deltaDir === 'up' ? '+' : '+';
    return `${prefix}${kpi.delta}`;
};

const deltaArrow = (dir: SignalRailDeltaDirection | undefined): string => {
    if (dir === 'up') return '▲';
    if (dir === 'down') return '▼';
    return '•';
};

const deltaClass = (dir: SignalRailDeltaDirection | undefined): string => {
    if (dir === 'up') return 'text-red-400';
    if (dir === 'down') return 'text-emerald-400';
    return 'text-blue-400';
};

const categoryLabel = (category: string): string => {
    const parts = category.split('/').map((part) => part.trim()).filter(Boolean);
    return parts[parts.length - 1] || category || 'Cisco Enterprise';
};

const passClass = (variant: SignalRailVariant, density: SignalTickerDensity): string =>
    cn(
        'flex shrink-0',
        density === 'compact' ? 'gap-3' : 'gap-4',
        variant === 'bloomberg' && 'gap-0',
        variant === 'cisco-blue-gradient' && 'gap-0',
        variant === 'telemetry-constellation' && 'gap-4',
        variant === 'original' && 'gap-3',
        variant === 'minimal-enterprise' && 'gap-4',
        variant === 'one-cisco-glass' && 'gap-3'
    );

const itemSizeClass = (
    variant: SignalRailVariant,
    density: SignalTickerDensity
): string => {
    if (variant === 'one-cisco-glass') {
        return density === 'compact'
            ? 'min-w-0 px-4 py-3'
            : 'min-w-0 px-5 py-4';
    }
    if (variant === 'bloomberg') {
        return density === 'compact'
            ? 'h-[62px] min-w-[280px] px-7'
            : 'h-[76px] min-w-[320px] px-8';
    }
    if (variant === 'cisco-blue-gradient') {
        return density === 'compact'
            ? 'h-[62px] min-w-[300px] px-8'
            : 'h-[76px] min-w-[340px] px-9';
    }
    if (variant === 'minimal-enterprise') {
        return density === 'compact'
            ? 'h-[54px] min-w-[282px] px-4'
            : 'h-[68px] min-w-[320px] px-5';
    }
    if (variant === 'telemetry-constellation') {
        return density === 'compact'
            ? 'h-[58px] min-w-[310px] px-5'
            : 'h-[72px] min-w-[350px] px-6';
    }
    return density === 'compact'
        ? 'h-[62px] min-w-[238px] px-3 py-2.5'
        : 'h-[82px] min-w-[265px] px-4 py-3';
};

const fontSizeClass = (
    fontSize: SignalTickerFontSize,
    small: string,
    standard: string,
    large: string
): string => {
    if (fontSize === 'small') return small;
    if (fontSize === 'large') return large;
    return standard;
};

interface KpiItemProps {
    kpi: SignalRailKpi;
    variant: SignalRailVariant;
    density: SignalTickerDensity;
    fontSize: SignalTickerFontSize;
    duplicate?: boolean;
}

const KpiItem: React.FC<KpiItemProps> = ({
    kpi,
    variant,
    density,
    fontSize,
    duplicate = false,
}) => {
    const status = STATUS_COLOR[kpi.status];
    const label = kpi.label;
    const category = categoryLabel(kpi.category);
    const openTabIndex = duplicate ? -1 : 0;
    const openLink =
        kpi.canOpen !== false && kpi.href ? (
            <a
                href={kpi.href}
                target="_blank"
                rel="noopener noreferrer"
                tabIndex={openTabIndex}
                title={`Open ${label} in Search`}
                aria-label={`Open ${label} in Search`}
                className="inline-flex rounded p-0.5 text-current opacity-55 transition-opacity hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                onClick={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
            >
                <ExternalLink className="h-3 w-3 stroke-[2.5px]" />
            </a>
        ) : null;

    if (variant === 'one-cisco-glass') {
        return (
            <OneCdGlassCard
                tag="article"
                className={cn(
                    'scd-signal-rail-item flex flex-col gap-0 overflow-hidden',
                    itemSizeClass(variant, density)
                )}
                data-status={kpi.status}
            >
                <span className="flex min-w-0 items-start justify-between gap-3">
                    <span className="min-w-0">
                        <span
                            className={cn(
                                'block truncate font-bold text-slate-950 dark:text-white',
                                fontSizeClass(fontSize, 'text-xs', 'text-sm', 'text-base')
                            )}
                        >
                            {label}
                        </span>
                        <span
                            className={cn(
                                'mt-1 block truncate text-slate-500 dark:text-slate-300',
                                fontSizeClass(fontSize, 'text-[10px]', 'text-xs', 'text-sm')
                            )}
                        >
                            {category}
                        </span>
                    </span>
                    {openLink}
                </span>
                <span className="mt-1.5 flex items-end justify-between gap-3">
                    <span
                        className={cn(
                            'font-black leading-none text-slate-950 dark:text-white',
                            fontSizeClass(fontSize, 'text-[24px]', 'text-[30px]', 'text-[34px]')
                        )}
                    >
                        {valueText(kpi)}
                    </span>
                    <Badge
                        label={STATUS_LABEL[kpi.status]}
                        backgroundColor={STATUS_BADGE_BACKGROUND[kpi.status]}
                        foregroundColor={variables.contentColorActive}
                        style={{ border: `1px solid ${STATUS_BADGE_COLOR[kpi.status]}` }}
                    />
                </span>
            </OneCdGlassCard>
        );
    }

    if (variant === 'bloomberg') {
        return (
            <div
                className={cn(
                    'scd-signal-rail-item flex items-center border-r border-[#1e2d4a] bg-[#0a0e1a] font-mono text-slate-100',
                    itemSizeClass(variant, density)
                )}
                data-status={kpi.status}
            >
                <span className={cn('mr-4 h-2.5 w-2.5 shrink-0 rounded-full', status.glow)} />
                <span className="min-w-0 flex-1">
                    <span
                        className={cn(
                            'block truncate font-bold uppercase tracking-[0.18em] text-blue-300/70',
                            fontSizeClass(fontSize, 'text-[11px]', 'text-[13px]', 'text-[15px]')
                        )}
                    >
                        {label}
                    </span>
                    <span className="mt-1 flex items-baseline gap-3">
                        <span
                            className={cn(
                                'font-black leading-none text-emerald-400',
                                fontSizeClass(fontSize, 'text-[24px]', 'text-[28px]', 'text-[32px]')
                            )}
                        >
                            {valueText(kpi)}
                        </span>
                        <span
                            className={cn(
                                'font-black',
                                fontSizeClass(fontSize, 'text-[10px]', 'text-[12px]', 'text-[13px]'),
                                deltaClass(kpi.deltaDir)
                            )}
                        >
                            {deltaArrow(kpi.deltaDir)} {deltaText(kpi)}
                        </span>
                    </span>
                </span>
                {openLink}
            </div>
        );
    }

    if (variant === 'cisco-blue-gradient') {
        return (
            <div
                className={cn(
                    'scd-signal-rail-item flex items-center border-r border-white/10 text-white',
                    itemSizeClass(variant, density)
                )}
                data-status={kpi.status}
            >
                <div className="min-w-0 flex-1">
                    <span
                        className={cn(
                            'block truncate font-black uppercase tracking-[0.2em] text-white/60',
                            fontSizeClass(fontSize, 'text-[10px]', 'text-xs', 'text-[13px]')
                        )}
                    >
                        {category}
                    </span>
                    <span className="mt-1 flex min-w-0 items-center gap-4">
                        <span
                            className={cn(
                                'truncate font-black uppercase tracking-[0.08em] text-white/90',
                                fontSizeClass(fontSize, 'text-[12px]', 'text-[15px]', 'text-[17px]')
                            )}
                        >
                            {label}
                        </span>
                        <span
                            className={cn(
                                'shrink-0 font-black leading-none text-white',
                                fontSizeClass(fontSize, 'text-[24px]', 'text-[28px]', 'text-[32px]')
                            )}
                        >
                            {valueText(kpi)}
                        </span>
                        <span
                            className={cn(
                                'shrink-0 rounded-full border px-3 py-1 font-black uppercase tracking-[0.12em] shadow-[0_0_16px_rgba(255,255,255,0.12)]',
                                fontSizeClass(fontSize, 'text-[10px]', 'text-xs', 'text-[13px]'),
                                status.softOnDark
                            )}
                        >
                            {STATUS_LABEL[kpi.status]}
                        </span>
                    </span>
                </div>
                {openLink}
            </div>
        );
    }

    if (variant === 'minimal-enterprise') {
        return (
            <div
                className={cn(
                    'scd-signal-rail-item relative flex items-center overflow-hidden rounded-lg border border-slate-200 bg-white text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100',
                    itemSizeClass(variant, density)
                )}
                data-status={kpi.status}
            >
                <span className={cn('absolute inset-y-0 left-0 w-1', status.accent)} />
                <div className="min-w-0 flex-1 pl-2">
                    <span
                        className={cn(
                            'block truncate font-black uppercase tracking-[0.12em] text-slate-400 dark:text-slate-300',
                            fontSizeClass(fontSize, 'text-[10px]', 'text-xs', 'text-sm')
                        )}
                    >
                        {label}
                    </span>
                    <span
                        className={cn(
                            'mt-0.5 block truncate font-semibold text-slate-400 dark:text-slate-500',
                            fontSizeClass(fontSize, 'text-[10px]', 'text-xs', 'text-[13px]')
                        )}
                    >
                        {kpi.category}
                    </span>
                </div>
                <span className="mx-4 h-8 w-px bg-slate-200 dark:bg-slate-700" />
                <span
                    className={cn(
                        'shrink-0 font-black leading-none text-slate-900 dark:text-white',
                        fontSizeClass(fontSize, 'text-[22px]', 'text-[26px]', 'text-[30px]')
                    )}
                >
                    {valueText(kpi)}
                </span>
                <span className="ml-4 flex shrink-0 items-center gap-1.5">
                    <span className={cn('h-2.5 w-2.5 rounded-full', status.glow)} />
                    <span
                        className={cn(
                            'font-black uppercase tracking-[0.08em]',
                            fontSizeClass(fontSize, 'text-[10px]', 'text-xs', 'text-[13px]'),
                            status.text
                        )}
                    >
                        {STATUS_LABEL[kpi.status]}
                    </span>
                </span>
                <span className="ml-3">{openLink}</span>
            </div>
        );
    }

    if (variant === 'telemetry-constellation') {
        return (
            <div
                className={cn(
                    'scd-signal-rail-item scd-signal-rail-constellation-card relative flex items-center overflow-hidden rounded-full border border-cyan-300/25 bg-slate-950/72 text-cyan-50 shadow-[0_0_34px_rgba(34,211,238,0.18)] backdrop-blur-md',
                    itemSizeClass(variant, density)
                )}
                data-status={kpi.status}
            >
                <span className={cn('relative z-10 mr-4 h-3 w-3 shrink-0 rounded-full ring-4 ring-cyan-300/10', status.glow)} />
                <span className="relative z-10 min-w-0 flex-1">
                    <span
                        className={cn(
                            'block truncate font-black uppercase tracking-[0.22em] text-cyan-200/60',
                            fontSizeClass(fontSize, 'text-[10px]', 'text-xs', 'text-[13px]')
                        )}
                    >
                        {category}
                    </span>
                    <span className="mt-1 flex min-w-0 items-baseline gap-3">
                        <span
                            className={cn(
                                'truncate font-black uppercase tracking-[0.12em] text-cyan-50',
                                fontSizeClass(fontSize, 'text-[11px]', 'text-[13px]', 'text-[15px]')
                            )}
                        >
                            {label}
                        </span>
                        <span
                            className={cn(
                                'shrink-0 font-mono font-black leading-none text-white drop-shadow-[0_0_12px_rgba(103,232,249,0.55)]',
                                fontSizeClass(fontSize, 'text-[23px]', 'text-[27px]', 'text-[31px]')
                            )}
                        >
                            {valueText(kpi)}
                        </span>
                    </span>
                </span>
                <span className="relative z-10 ml-4 flex shrink-0 items-center gap-2 pr-1">
                    <span
                        className={cn(
                            'font-black uppercase tracking-[0.16em]',
                            fontSizeClass(fontSize, 'text-[10px]', 'text-xs', 'text-[13px]'),
                            status.textOnDark
                        )}
                    >
                        {STATUS_LABEL[kpi.status]}
                    </span>
                    {openLink}
                </span>
            </div>
        );
    }

    return (
        <div
            className={cn(
                'scd-signal-rail-item group relative overflow-hidden rounded-lg border bg-white/[0.94] text-left shadow-sm transition-all dark:bg-slate-900/95 dark:text-slate-100',
                itemSizeClass(variant, density),
                status.border
            )}
            data-status={kpi.status}
        >
            <span className={cn('absolute left-0 top-0 h-full w-1', status.accent)} />
            <span
                className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-sky-300/30"
                aria-hidden="true"
            />
            <span className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                    <span
                        className={cn(
                            'block truncate font-black leading-none tracking-normal text-slate-900 dark:text-white',
                            fontSizeClass(fontSize, 'text-[18px]', 'text-[22px]', 'text-[26px]')
                        )}
                    >
                        {valueText(kpi)}
                    </span>
                    <span
                        className={cn(
                            'mt-1.5 block line-clamp-2 font-black uppercase leading-tight tracking-[0.08em] text-slate-600 dark:text-slate-300',
                            fontSizeClass(fontSize, 'text-[10px]', 'text-xs', 'text-sm')
                        )}
                    >
                        {label}
                    </span>
                </span>
                <span className="flex shrink-0 items-center gap-0.5">
                    <span
                        className={cn(
                            'rounded-full px-1.5 py-0.5 font-black uppercase tracking-[0.12em]',
                            fontSizeClass(fontSize, 'text-[10px]', 'text-xs', 'text-[13px]'),
                            status.soft
                        )}
                    >
                        {STATUS_LABEL[kpi.status]}
                    </span>
                    {openLink}
                </span>
            </span>
            <span
                className={cn(
                    'mt-0.5 block truncate font-semibold text-slate-400 dark:text-slate-500',
                    fontSizeClass(fontSize, 'text-[10px]', 'text-xs', 'text-[13px]')
                )}
            >
                {kpi.category}
            </span>
        </div>
    );
};

export const SignalRailTicker: React.FC<SignalRailTickerProps> = ({
    kpis,
    className,
    density = 'comfortable',
    fontSize = 'standard',
    rows = 1,
    durationSeconds = 60,
    onOpenEditor,
}) => {
    const [variant, setVariant] = useState<SignalRailVariant>(() => readStoredVariant());
    const [manualPaused, setManualPaused] = useState(false);
    const [interactionPaused, setInteractionPaused] = useState(false);
    const [pickerOpen, setPickerOpen] = useState(false);
    const pickerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const onStorage = (event: StorageEvent) => {
            if (event.key !== STORAGE_KEY) return;
            setVariant(readStoredVariant());
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    const selectVariant = useCallback((nextVariant: SignalRailVariant) => {
        setVariant(nextVariant);
        writeStoredVariant(nextVariant);
        setPickerOpen(false);
    }, []);

    const tickerRows = useMemo(() => splitRows(kpis, rows), [kpis, rows]);
    // Aileen's 1CD status overview is a static set of glass cards. Motion
    // belongs to the connector trails in the topology map, not this rail.
    // Retain marquee support only for the optional legacy rail variants.
    const staticMode = variant === 'one-cisco-glass' || durationSeconds <= 0;
    const effectivePaused = manualPaused || interactionPaused || durationSeconds <= 0;
    const activeOption = VARIANT_OPTIONS.find((option) => option.id === variant);
    const counts = useMemo(() => {
        const map: Record<SignalRailStatus, number> = {
            healthy: 0,
            warning: 0,
            critical: 0,
            unknown: 0,
        };
        for (const kpi of kpis) map[kpi.status] += 1;
        return map;
    }, [kpis]);

    const controlButtonClassName = cn(
        'flex items-center justify-center rounded-md border border-transparent bg-transparent shadow-none transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400',
        density === 'compact' ? 'h-8 w-8' : 'h-9 w-9',
        variant === 'bloomberg'
            ? 'text-blue-300 hover:bg-blue-400/15 hover:text-white'
            : variant === 'telemetry-constellation'
            ? 'text-cyan-200 hover:bg-cyan-300/15 hover:text-white'
            : variant === 'cisco-blue-gradient'
            ? 'text-white/85 hover:bg-white/15 hover:text-white'
            : 'text-slate-500 hover:bg-sky-500/10 hover:text-sky-700 dark:text-slate-300 dark:hover:bg-sky-300/10 dark:hover:text-sky-200'
    );

    const renderPass = (row: SignalRailKpi[], pass: number) => (
        <div
            key={`pass-${pass}`}
            className={passClass(variant, density)}
            aria-hidden={pass === 1}
        >
            {row.map((kpi) => (
                <KpiItem
                    key={`${pass}-${kpi.id}`}
                    kpi={kpi}
                    variant={variant}
                    density={density}
                    fontSize={fontSize}
                    duplicate={pass === 1}
                />
            ))}
        </div>
    );

    if (kpis.length === 0) return null;

    return (
        <section
            className={cn(
                'scd-signal-rail-ticker group/signal-rail relative z-40 flex w-full min-w-0 max-w-full flex-shrink-0 flex-col overflow-visible border-b',
                variant === 'one-cisco-glass' &&
                    'border-transparent bg-transparent px-3 py-3 text-slate-950 dark:text-white',
                variant === 'original' &&
                    'border-slate-200 bg-white/[0.82] px-1.5 py-1 dark:border-slate-800 dark:bg-slate-950/95',
                variant === 'bloomberg' &&
                    'border-[#1e2d4a] bg-[#0a0e1a] px-1.5 py-1 text-slate-100',
                variant === 'cisco-blue-gradient' &&
                    'scd-signal-rail-cisco border-sky-900/60 px-1.5 py-1 text-white',
                variant === 'minimal-enterprise' &&
                    'border-slate-200 bg-[#f8fafc] px-1.5 py-2 text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100',
                variant === 'telemetry-constellation' &&
                    'scd-signal-rail-constellation border-cyan-500/30 px-1.5 py-1.5 text-cyan-50',
                className
            )}
            data-variant={variant}
            data-font-size={fontSize}
            aria-label={`Signal Rail with ${kpis.length} KPIs`}
            onMouseEnter={() => setInteractionPaused(true)}
            onMouseLeave={() => setInteractionPaused(false)}
            onFocusCapture={() => setInteractionPaused(true)}
            onBlurCapture={(event) => {
                const nextTarget = event.relatedTarget;
                if (
                    nextTarget instanceof Node &&
                    event.currentTarget.contains(nextTarget)
                ) {
                    return;
                }
                setInteractionPaused(false);
            }}
        >
            <style>{signalRailTickerCss}</style>
            <div
                className={cn(
                    'relative z-[70] flex w-full min-w-0 max-w-full items-center overflow-visible',
                    density === 'compact' ? 'gap-2' : 'gap-3'
                )}
            >
                <div
                    className={cn(
                        'w-full min-w-0 max-w-full flex-1 overflow-hidden select-none',
                        density === 'compact' ? 'space-y-0.5' : 'space-y-1'
                    )}
                >
                    {tickerRows.map((row, rowIndex) => (
                        <div
                            key={`row-${rowIndex}`}
                            className={cn(
                                'w-full min-w-0 max-w-full py-0.5',
                                staticMode ? 'overflow-visible' : 'overflow-hidden'
                            )}
                        >
                            {staticMode ? (
                                <div className="grid w-full grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
                                    {row.map((kpi) => (
                                        <KpiItem
                                            key={kpi.id}
                                            kpi={kpi}
                                            variant={variant}
                                            density={density}
                                            fontSize={fontSize}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div
                                    className="scd-signal-rail-marquee-track flex"
                                    data-paused={effectivePaused}
                                    style={{ animationDuration: `${durationSeconds}s` }}
                                >
                                    {[0, 1].map((pass) => renderPass(row, pass))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <div
                    className={cn(
                        'scd-signal-rail-controls absolute right-2 top-1/2 z-[90] flex items-center gap-0.5 rounded-xl border p-1 shadow-lg transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none',
                        variant === 'bloomberg'
                            ? 'border-blue-300/15 bg-[#070b14]/35'
                            : variant === 'telemetry-constellation'
                            ? 'border-cyan-300/20 bg-slate-950/30 shadow-[0_0_18px_rgba(34,211,238,0.1)]'
                            : variant === 'cisco-blue-gradient'
                            ? 'border-white/15 bg-slate-950/20'
                            : 'border-slate-300/30 bg-white/35 dark:border-slate-600/30 dark:bg-slate-950/30'
                    )}
                    data-signal-rail-controls="true"
                    data-open={pickerOpen}
                    ref={pickerRef}
                >
                    {variant !== 'one-cisco-glass' && <button
                        type="button"
                        onClick={() => setManualPaused((current) => !current)}
                        disabled={staticMode}
                        aria-pressed={manualPaused}
                        aria-label={
                            staticMode
                                ? 'Signal rail is static; configure speed to enable motion'
                                : manualPaused
                                ? 'Resume signal rail'
                                : 'Pause signal rail'
                        }
                        title={
                            staticMode
                                ? 'Static by default — configure speed to enable motion'
                                : manualPaused
                                ? 'Resume signal rail'
                                : 'Pause signal rail'
                        }
                        className={cn(
                            controlButtonClassName,
                            staticMode && 'cursor-not-allowed opacity-45'
                        )}
                    >
                        {manualPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                    </button>}
                    <button
                        type="button"
                        onClick={() => setPickerOpen((current) => !current)}
                        aria-haspopup="menu"
                        aria-expanded={pickerOpen}
                        aria-label={`Ticker style: ${activeOption?.label ?? 'Original'}`}
                        title={`Ticker style: ${activeOption?.label ?? 'Original'}`}
                        className={controlButtonClassName}
                    >
                        <Palette className="h-4 w-4" />
                    </button>
                    {onOpenEditor && (
                        <button
                            type="button"
                            onClick={onOpenEditor}
                            aria-label="Configure signal rail"
                            title="Configure signal rail"
                            className={controlButtonClassName}
                        >
                            <Settings2 className="h-4 w-4" />
                        </button>
                    )}

                    {pickerOpen && (
                        <div
                            role="menu"
                            aria-label="Choose signal rail style"
                            className="absolute right-0 top-[calc(100%+0.75rem)] z-[120] w-[min(25rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-2 text-slate-900 shadow-[0_24px_60px_rgba(15,23,42,0.28)] ring-1 ring-slate-950/5 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                        >
                            <div className="flex items-center justify-between px-2.5 pb-2 pt-1.5">
                                <div>
                                    <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                                        Ticker style
                                    </p>
                                    <p className="mt-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                                        Choose a rail treatment
                                    </p>
                                </div>
                                <span className="rounded-full bg-sky-50 px-2 py-1 text-xs font-black uppercase tracking-[0.1em] text-sky-700 dark:bg-sky-950/50 dark:text-sky-200">
                                    {VARIANT_OPTIONS.length} styles
                                </span>
                            </div>
                            <div className="space-y-1">
                                {VARIANT_OPTIONS.map((option) => (
                                    <button
                                        key={option.id}
                                        type="button"
                                        role="menuitemradio"
                                        aria-checked={variant === option.id}
                                        data-variant-option={option.id}
                                        onClick={() => selectVariant(option.id)}
                                        className={cn(
                                            'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-sky-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 dark:hover:bg-slate-900',
                                            variant === option.id && 'bg-sky-50 dark:bg-sky-950/40',
                                            option.id === 'telemetry-constellation' &&
                                                'border border-cyan-200/70 bg-cyan-50/60 hover:bg-cyan-50 dark:border-cyan-900/70 dark:bg-cyan-950/20 dark:hover:bg-cyan-950/30'
                                        )}
                                    >
                                        <span
                                            className={cn(
                                                'h-10 w-12 shrink-0 rounded-lg shadow-inner',
                                                option.swatchClassName
                                            )}
                                            aria-hidden="true"
                                        />
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-[12px] font-black uppercase tracking-[0.12em]">
                                                {option.label}
                                            </span>
                                            <span className="mt-0.5 block text-xs font-semibold leading-snug text-slate-500 dark:text-slate-400">
                                                {option.description}
                                            </span>
                                        </span>
                                        {variant === option.id && (
                                            <Check className="h-4 w-4 shrink-0 text-sky-600" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {variant === 'bloomberg' && (
                <div className="relative z-10 border-t border-[#1e2d4a] px-8 py-2 font-mono text-xs font-bold uppercase tracking-[0.18em] text-blue-300/60">
                    Signal Rail · Live · {kpis.length} KPIs Monitored
                </div>
            )}
            {variant === 'cisco-blue-gradient' && (
                <div className="relative z-10 border-t border-white/10 bg-[#0a2d64]/[0.45] px-8 py-2 text-xs font-black uppercase tracking-[0.16em] text-white/60">
                    <span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.85)]" />
                    Signal Rail · Live Feed · All Systems Nominal
                </div>
            )}
            {variant === 'minimal-enterprise' && (
                <div className="relative z-0 flex items-center justify-between border-t border-slate-200 px-8 py-2 text-xs font-black uppercase tracking-[0.12em] text-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-500">
                    <span>Signal Rail · {kpis.length} KPIs</span>
                    <span className="normal-case tracking-normal">
                        <span className="text-emerald-500">• {counts.healthy} Healthy</span>
                        <span className="ml-3 text-amber-500">• {counts.warning} Warning</span>
                        <span className="ml-3 text-red-500">• {counts.critical} Critical</span>
                    </span>
                </div>
            )}
            {variant === 'telemetry-constellation' && (
                <div className="relative z-0 flex items-center justify-between border-t border-cyan-300/20 bg-slate-950/25 px-8 py-2 font-mono text-xs font-black uppercase tracking-[0.16em] text-cyan-200/60">
                    <span>
                        <span className="mr-2 inline-block h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_14px_rgba(103,232,249,0.9)]" />
                        Telemetry Constellation
                    </span>
                    <span className="text-cyan-100/70">
                        {counts.healthy} nominal / {counts.warning} drift / {counts.critical} breach
                    </span>
                </div>
            )}
        </section>
    );
};

export default SignalRailTicker;
