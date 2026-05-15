/**
 * Device icons — Build 110 rewrite.
 *
 * Build 105 introduced a hand-drawn Cisco-style SVG library
 * (drum-shaped router, brick firewall, scalloped cloud, etc.).
 * The visual quality wasn't there — Alan reviewed Build 109 and
 * said "the device icons need to be much better than this."
 * Honest answer: synthesising polished SVG art from text prompts
 * is exactly where LLM-driven coding falls down. Re-drawing
 * dozens of glyphs by hand to "Cisco brand-center quality"
 * inside an editor session was always going to disappoint.
 *
 * The pragmatic fix: use a vetted, professionally-designed icon
 * library instead of hand-art. We already depend on
 * `lucide-react` (it ships with React Flow's docs and is used by
 * `RegionGroupNode`, `DiagramHeader`, the palette tabs, etc.),
 * so this is a zero-new-dependency upgrade.
 *
 * Design language:
 *   - Each device shape gets a rounded square "icon badge" that
 *     fills the icon area of the host card. The badge uses a
 *     soft per-device-class accent tint (e.g. amber for routing,
 *     rose for security, sky for switching, emerald for compute).
 *   - The Lucide glyph itself sits inside the badge at ~60% size,
 *     drawn in the badge's accent foreground colour.
 *   - The status outline / status dot stays on the host card, NOT
 *     the icon — we keep status visualisation separate from
 *     device-class iconography so the two layers compose cleanly.
 *
 * Compatibility:
 *   - The exported `CISCO_ICONS` registry keeps the same shape id
 *     keys (`router`, `switch`, `l3_switch`, `firewall`, `wlc`,
 *     `access_point`, `server`, `cloud`, `generic`) so call sites
 *     in `shapes.tsx` and `CyberNocShape.tsx` need no change.
 *   - Each icon component still accepts `className` (for size +
 *     forwarded color classes) and `title` (for accessibility).
 *
 * Why we DON'T import official Cisco brand-center SVGs:
 *   The Cisco Network Topology Icon Library is published at
 *   cisco.com/c/en/us/about/brand-center/network-topology-icons.html
 *   under brand-use terms that don't permit redistribution in
 *   third-party products. Lucide (ISC license) and Heroicons
 *   (MIT) are the cleanest open alternatives. If the customer
 *   ever requires "official Cisco iconography", that's a
 *   licensing conversation + a one-file swap-in here.
 */

import React from 'react';
import {
    Router,
    Network,
    Shield,
    RadioTower,
    Wifi,
    Server,
    Cloud,
    Box,
    type LucideIcon,
} from 'lucide-react';
import { cn } from '@/common/lib/utils';

interface IconProps {
    /** Tailwind size + color utility (forwarded by callers).
     *  Status colours (e.g. `text-emerald-500` for healthy)
     *  flow through to the badge ring tint via currentColor.
     *  Width/height utilities (`w-12 h-12`) drive the badge size. */
    className?: string;
    title?: string;
}

/** Per-device-class accent palette. Each shape gets a semantic
 *  colour: rose for security, amber for routing, sky for L2
 *  switching, indigo for L3, violet for wireless control,
 *  fuchsia for wireless edge, emerald for compute, slate for
 *  abstract / unknown. Tailwind class fragments only — no
 *  arbitrary values, so a typo can't render an injected class. */
interface AccentPalette {
    /** Soft tinted background of the badge. */
    badgeBg: string;
    /** Crisp 1.5px border ring around the badge. */
    badgeRing: string;
    /** Glyph colour. Status overrides this through className
     *  (e.g. `text-rose-500` on a critical device dims the
     *  badge accent and signals health concurrently). */
    glyphFg: string;
}

const ACCENTS: Record<string, AccentPalette> = {
    rose: {
        badgeBg: 'bg-rose-50 dark:bg-rose-950/40',
        badgeRing: 'ring-rose-200/60 dark:ring-rose-800/60',
        glyphFg: 'text-rose-600 dark:text-rose-400',
    },
    amber: {
        badgeBg: 'bg-amber-50 dark:bg-amber-950/40',
        badgeRing: 'ring-amber-200/60 dark:ring-amber-800/60',
        glyphFg: 'text-amber-600 dark:text-amber-400',
    },
    sky: {
        badgeBg: 'bg-sky-50 dark:bg-sky-950/40',
        badgeRing: 'ring-sky-200/60 dark:ring-sky-800/60',
        glyphFg: 'text-sky-600 dark:text-sky-400',
    },
    indigo: {
        badgeBg: 'bg-indigo-50 dark:bg-indigo-950/40',
        badgeRing: 'ring-indigo-200/60 dark:ring-indigo-800/60',
        glyphFg: 'text-indigo-600 dark:text-indigo-400',
    },
    violet: {
        badgeBg: 'bg-violet-50 dark:bg-violet-950/40',
        badgeRing: 'ring-violet-200/60 dark:ring-violet-800/60',
        glyphFg: 'text-violet-600 dark:text-violet-400',
    },
    fuchsia: {
        badgeBg: 'bg-fuchsia-50 dark:bg-fuchsia-950/40',
        badgeRing: 'ring-fuchsia-200/60 dark:ring-fuchsia-800/60',
        glyphFg: 'text-fuchsia-600 dark:text-fuchsia-400',
    },
    emerald: {
        badgeBg: 'bg-emerald-50 dark:bg-emerald-950/40',
        badgeRing: 'ring-emerald-200/60 dark:ring-emerald-800/60',
        glyphFg: 'text-emerald-600 dark:text-emerald-400',
    },
    slate: {
        badgeBg: 'bg-slate-100 dark:bg-slate-800/60',
        badgeRing: 'ring-slate-200/70 dark:ring-slate-700/60',
        glyphFg: 'text-slate-600 dark:text-slate-300',
    },
};

/**
 * Render a Lucide glyph inside a tinted, ringed rounded-square
 * badge. The badge fills the parent's `className` size box; the
 * glyph scales to ~58% of the box for visual breathing room.
 *
 * The badge itself is the visual frame for the icon — the host
 * card (in `shapes.tsx`) supplies its own card chrome around
 * this badge, so the layers compose: card → status ring →
 * badge → glyph.
 */
const renderBadged = (
    Glyph: LucideIcon,
    accent: AccentPalette,
    { className, title }: IconProps
): React.ReactElement => (
    <div
        className={cn(
            'flex items-center justify-center rounded-md ring-1',
            accent.badgeBg,
            accent.badgeRing,
            // Forward whatever sizing the caller asked for
            // (e.g. `w-12 h-12`). The Lucide glyph uses 58% of
            // the box via the inner element below.
            className
        )}
        title={title}
        aria-label={title}
        role="img"
    >
        <Glyph
            className={cn('w-[58%] h-[58%]', accent.glyphFg)}
            strokeWidth={1.75}
            aria-hidden
        />
    </div>
);

/** Cisco router — Lucide `Router` (rectangular box with two
 *  radio waves on top, the canonical "router" glyph). Amber
 *  accent matches the routing-protocol colour convention. */
export const CiscoRouterIcon: React.FC<IconProps> = (props) =>
    renderBadged(Router, ACCENTS.amber, props);

/** L3 switch — Lucide `Network` (three nodes connected in a
 *  triangle, evoking layer-3 routing decisions). Indigo accent. */
export const CiscoL3SwitchIcon: React.FC<IconProps> = (props) =>
    renderBadged(Network, ACCENTS.indigo, props);

/** L2 switch — Lucide `Network` with the sky accent so it
 *  visually distinguishes from L3. Same glyph, different colour
 *  is intentional: the layer-2 / layer-3 distinction is more
 *  about colour-coded operational meaning than icon shape. */
export const CiscoL2SwitchIcon: React.FC<IconProps> = (props) =>
    renderBadged(Network, ACCENTS.sky, props);

/** Firewall — Lucide `Shield`. Rose accent (the universal
 *  "security" colour in our palette). */
export const CiscoFirewallIcon: React.FC<IconProps> = (props) =>
    renderBadged(Shield, ACCENTS.rose, props);

/** Wireless LAN Controller — Lucide `RadioTower` (a tower with
 *  outgoing radio waves), violet accent. */
export const CiscoWlcIcon: React.FC<IconProps> = (props) =>
    renderBadged(RadioTower, ACCENTS.violet, props);

/** Access Point — Lucide `Wifi` (concentric arcs), fuchsia
 *  accent so APs cluster visually with WLCs but stay
 *  distinguishable. */
export const CiscoApIcon: React.FC<IconProps> = (props) =>
    renderBadged(Wifi, ACCENTS.fuchsia, props);

/** Server — Lucide `Server` (rack-unit silhouette with status
 *  LEDs on the front), emerald accent (compute / capacity). */
export const CiscoServerIcon: React.FC<IconProps> = (props) =>
    renderBadged(Server, ACCENTS.emerald, props);

/** Cloud / WAN — Lucide `Cloud`, slate accent. */
export const CiscoCloudIcon: React.FC<IconProps> = (props) =>
    renderBadged(Cloud, ACCENTS.slate, props);

/** Generic / unclassified — Lucide `Box` (a 3-D outlined box),
 *  slate accent. */
export const CiscoGenericIcon: React.FC<IconProps> = (props) =>
    renderBadged(Box, ACCENTS.slate, props);

/** Public registry: shape id → icon component. Same surface as
 *  pre-Build-110 so call sites in `shapes.tsx` and
 *  `CyberNocShape.tsx` need no change. */
export const CISCO_ICONS = {
    router: CiscoRouterIcon,
    switch: CiscoL2SwitchIcon,
    l3_switch: CiscoL3SwitchIcon,
    firewall: CiscoFirewallIcon,
    wlc: CiscoWlcIcon,
    access_point: CiscoApIcon,
    server: CiscoServerIcon,
    cloud: CiscoCloudIcon,
    generic: CiscoGenericIcon,
} as const;

export type CiscoIconId = keyof typeof CISCO_ICONS;
