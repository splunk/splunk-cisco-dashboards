/**
 * ciscoIcons — inline SVG components that approximate the official
 * Cisco Network Topology Icon library (router, switch, firewall,
 * WLC, AP, server, cloud, generic node).
 *
 * Why inline SVGs and not a third-party icon package:
 *   1. Cisco's official Network Topology Icons are published at
 *      cisco.com/c/en/us/about/brand-center/network-topology-
 *      icons.html as PNG/EPS/Visio bundles. There's no MIT-licensed
 *      npm package that mirrors them, and Splunk Cloud Vetting
 *      doesn't tolerate runtime fetches from cisco.com.
 *   2. Inline SVGs let us inherit `currentColor` from CSS so a single
 *      shape renders correctly in light/dark themes and across
 *      health-status outlines (`text-emerald-500`, `text-rose-500`,
 *      etc.) without per-shape tinting code.
 *   3. Dropping a future official Cisco SVG bundle becomes a one-
 *      file replacement; consumers import from `@/common/components/
 *      topology/ciscoIcons` and get whatever ships.
 *
 * Visual conventions (matching the Cisco brand-center reference):
 *   - **Router**: cylindrical/drum body with directional arrows on
 *     top, evoking "this thing routes traffic in multiple
 *     directions".
 *   - **L3 Switch**: stacked planar body with arrow icons,
 *     differentiating from L2 by the multi-direction arrows.
 *   - **L2 Switch**: stacked planar body with horizontal arrows
 *     only (single-plane forwarding).
 *   - **Firewall**: brick-pattern wall, the universal Cisco firewall
 *     glyph since the late 1990s.
 *   - **WLC (Wireless LAN Controller)**: hexagonal body with
 *     antenna lines, distinguishing from APs by the controller
 *     chassis form.
 *   - **AP (Access Point)**: small puck with concentric radio
 *     rings emanating outward.
 *   - **Server**: rack-unit silhouette with drive bays.
 *   - **Cloud**: classic Cisco scalloped cloud outline.
 *   - **Generic**: simple rectangle for anything we can't classify
 *     yet.
 *
 * All shapes are designed for a 64x64 viewport and centred for
 * consistent scaling. Stroke widths use `vector-effect:
 * non-scaling-stroke` so the line weight stays uniform regardless
 * of how the shape is sized inside its host node.
 */

import React from 'react';

interface IconProps {
    /** Tailwind/CSS color class consumed via `currentColor` for the
     *  primary stroke. Defaults to `text-slate-700` so the icon is
     *  legible against a white card before the parent applies a
     *  status-aware tint. */
    className?: string;
    title?: string;
}

const baseSvgProps = {
    viewBox: '0 0 64 64',
    fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg',
    'aria-hidden': true,
} as const;

/** Cisco-style cylindrical router with directional arrows. */
export const CiscoRouterIcon: React.FC<IconProps> = ({ className, title }) => (
    <svg {...baseSvgProps} className={className}>
        {title ? <title>{title}</title> : null}
        {/* Drum body */}
        <ellipse
            cx="32"
            cy="20"
            rx="22"
            ry="6"
            stroke="currentColor"
            strokeWidth="2"
            fill="white"
        />
        <path
            d="M 10 20 L 10 42 A 22 6 0 0 0 54 42 L 54 20"
            stroke="currentColor"
            strokeWidth="2"
            fill="white"
        />
        <ellipse
            cx="32"
            cy="42"
            rx="22"
            ry="6"
            stroke="currentColor"
            strokeWidth="1"
            strokeDasharray="2 2"
            opacity="0.5"
        />
        {/* North/south arrows on top */}
        <path d="M 26 16 L 22 12 L 22 20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M 38 16 L 42 20 L 42 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M 22 16 L 42 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        {/* East/west arrows */}
        <path d="M 32 8 L 28 12 L 36 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M 32 28 L 28 24 L 36 24" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

/** Cisco-style L3 switch — planar stacked body + multi-direction arrows. */
export const CiscoL3SwitchIcon: React.FC<IconProps> = ({ className, title }) => (
    <svg {...baseSvgProps} className={className}>
        {title ? <title>{title}</title> : null}
        {/* Top face (parallelogram, evoking 3D depth) */}
        <path
            d="M 8 32 L 18 22 L 56 22 L 46 32 Z"
            stroke="currentColor"
            strokeWidth="2"
            fill="white"
        />
        {/* Front face */}
        <path
            d="M 8 32 L 46 32 L 46 44 L 8 44 Z"
            stroke="currentColor"
            strokeWidth="2"
            fill="white"
        />
        {/* Side face */}
        <path
            d="M 46 32 L 56 22 L 56 34 L 46 44 Z"
            stroke="currentColor"
            strokeWidth="2"
            fill="white"
            opacity="0.85"
        />
        {/* Multi-direction arrows on top face */}
        <path d="M 22 27 L 32 27 M 28 24 L 32 27 L 28 30" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M 42 27 L 32 27 M 36 24 L 32 27 L 36 30" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        {/* Front-face port LEDs */}
        <circle cx="14" cy="38" r="0.9" fill="currentColor" />
        <circle cx="20" cy="38" r="0.9" fill="currentColor" />
        <circle cx="26" cy="38" r="0.9" fill="currentColor" />
        <circle cx="32" cy="38" r="0.9" fill="currentColor" />
        <circle cx="38" cy="38" r="0.9" fill="currentColor" />
    </svg>
);

/** Cisco-style L2 switch — planar stacked body + horizontal arrows only. */
export const CiscoL2SwitchIcon: React.FC<IconProps> = ({ className, title }) => (
    <svg {...baseSvgProps} className={className}>
        {title ? <title>{title}</title> : null}
        <path
            d="M 8 32 L 18 22 L 56 22 L 46 32 Z"
            stroke="currentColor"
            strokeWidth="2"
            fill="white"
        />
        <path
            d="M 8 32 L 46 32 L 46 44 L 8 44 Z"
            stroke="currentColor"
            strokeWidth="2"
            fill="white"
        />
        <path
            d="M 46 32 L 56 22 L 56 34 L 46 44 Z"
            stroke="currentColor"
            strokeWidth="2"
            fill="white"
            opacity="0.85"
        />
        {/* Horizontal arrows only — L2 forwarding */}
        <path d="M 20 27 L 36 27 M 32 24 L 36 27 L 32 30" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M 44 27 L 28 27 M 32 30 L 28 27 L 32 24" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <circle cx="14" cy="38" r="0.9" fill="currentColor" />
        <circle cx="20" cy="38" r="0.9" fill="currentColor" />
        <circle cx="26" cy="38" r="0.9" fill="currentColor" />
        <circle cx="32" cy="38" r="0.9" fill="currentColor" />
        <circle cx="38" cy="38" r="0.9" fill="currentColor" />
    </svg>
);

/** Cisco-style firewall — brick wall pattern. */
export const CiscoFirewallIcon: React.FC<IconProps> = ({ className, title }) => (
    <svg {...baseSvgProps} className={className}>
        {title ? <title>{title}</title> : null}
        {/* Outer wall */}
        <rect x="8" y="14" width="48" height="36" stroke="currentColor" strokeWidth="2" fill="white" />
        {/* Brick rows */}
        <line x1="8" y1="23" x2="56" y2="23" stroke="currentColor" strokeWidth="1.2" />
        <line x1="8" y1="32" x2="56" y2="32" stroke="currentColor" strokeWidth="1.2" />
        <line x1="8" y1="41" x2="56" y2="41" stroke="currentColor" strokeWidth="1.2" />
        {/* Brick offsets */}
        <line x1="20" y1="14" x2="20" y2="23" stroke="currentColor" strokeWidth="1.2" />
        <line x1="32" y1="14" x2="32" y2="23" stroke="currentColor" strokeWidth="1.2" />
        <line x1="44" y1="14" x2="44" y2="23" stroke="currentColor" strokeWidth="1.2" />

        <line x1="14" y1="23" x2="14" y2="32" stroke="currentColor" strokeWidth="1.2" />
        <line x1="26" y1="23" x2="26" y2="32" stroke="currentColor" strokeWidth="1.2" />
        <line x1="38" y1="23" x2="38" y2="32" stroke="currentColor" strokeWidth="1.2" />
        <line x1="50" y1="23" x2="50" y2="32" stroke="currentColor" strokeWidth="1.2" />

        <line x1="20" y1="32" x2="20" y2="41" stroke="currentColor" strokeWidth="1.2" />
        <line x1="32" y1="32" x2="32" y2="41" stroke="currentColor" strokeWidth="1.2" />
        <line x1="44" y1="32" x2="44" y2="41" stroke="currentColor" strokeWidth="1.2" />

        <line x1="14" y1="41" x2="14" y2="50" stroke="currentColor" strokeWidth="1.2" />
        <line x1="26" y1="41" x2="26" y2="50" stroke="currentColor" strokeWidth="1.2" />
        <line x1="38" y1="41" x2="38" y2="50" stroke="currentColor" strokeWidth="1.2" />
        <line x1="50" y1="41" x2="50" y2="50" stroke="currentColor" strokeWidth="1.2" />
    </svg>
);

/** Cisco-style WLC — hexagonal chassis with antenna lines. */
export const CiscoWlcIcon: React.FC<IconProps> = ({ className, title }) => (
    <svg {...baseSvgProps} className={className}>
        {title ? <title>{title}</title> : null}
        {/* Hex body */}
        <path d="M 16 24 L 32 12 L 48 24 L 48 44 L 32 56 L 16 44 Z" stroke="currentColor" strokeWidth="2" fill="white" />
        {/* Antenna stalks */}
        <line x1="22" y1="20" x2="18" y2="8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <line x1="32" y1="14" x2="32" y2="4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <line x1="42" y1="20" x2="46" y2="8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        {/* Antenna terminators */}
        <circle cx="18" cy="8" r="1.6" fill="currentColor" />
        <circle cx="32" cy="4" r="1.6" fill="currentColor" />
        <circle cx="46" cy="8" r="1.6" fill="currentColor" />
        {/* Front-face status indicator */}
        <rect x="22" y="32" width="20" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" fill="white" />
        <circle cx="26" cy="35" r="0.9" fill="currentColor" />
        <circle cx="32" cy="35" r="0.9" fill="currentColor" />
        <circle cx="38" cy="35" r="0.9" fill="currentColor" />
    </svg>
);

/** Cisco-style AP — round puck with radio rings. */
export const CiscoApIcon: React.FC<IconProps> = ({ className, title }) => (
    <svg {...baseSvgProps} className={className}>
        {title ? <title>{title}</title> : null}
        {/* Radio rings */}
        <circle cx="32" cy="32" r="24" stroke="currentColor" strokeWidth="1.2" fill="none" opacity="0.3" strokeDasharray="3 2" />
        <circle cx="32" cy="32" r="18" stroke="currentColor" strokeWidth="1.2" fill="none" opacity="0.5" strokeDasharray="3 2" />
        {/* AP puck */}
        <circle cx="32" cy="32" r="11" stroke="currentColor" strokeWidth="2" fill="white" />
        <circle cx="32" cy="32" r="3.5" stroke="currentColor" strokeWidth="1.4" fill="white" />
    </svg>
);

/** Generic server — rack-unit silhouette. */
export const CiscoServerIcon: React.FC<IconProps> = ({ className, title }) => (
    <svg {...baseSvgProps} className={className}>
        {title ? <title>{title}</title> : null}
        <rect x="12" y="10" width="40" height="44" rx="2" stroke="currentColor" strokeWidth="2" fill="white" />
        {/* Three rack units */}
        <rect x="16" y="14" width="32" height="10" stroke="currentColor" strokeWidth="1.2" fill="white" />
        <rect x="16" y="27" width="32" height="10" stroke="currentColor" strokeWidth="1.2" fill="white" />
        <rect x="16" y="40" width="32" height="10" stroke="currentColor" strokeWidth="1.2" fill="white" />
        {/* Drive-bay slots */}
        <line x1="22" y1="17" x2="42" y2="17" stroke="currentColor" strokeWidth="1" />
        <line x1="22" y1="20" x2="42" y2="20" stroke="currentColor" strokeWidth="1" />
        <line x1="22" y1="30" x2="42" y2="30" stroke="currentColor" strokeWidth="1" />
        <line x1="22" y1="33" x2="42" y2="33" stroke="currentColor" strokeWidth="1" />
        <line x1="22" y1="43" x2="42" y2="43" stroke="currentColor" strokeWidth="1" />
        <line x1="22" y1="46" x2="42" y2="46" stroke="currentColor" strokeWidth="1" />
        {/* Status LEDs */}
        <circle cx="18" cy="19" r="0.8" fill="currentColor" />
        <circle cx="18" cy="32" r="0.8" fill="currentColor" />
        <circle cx="18" cy="45" r="0.8" fill="currentColor" />
    </svg>
);

/** Cisco-style cloud — scalloped outline, the WAN/internet glyph. */
export const CiscoCloudIcon: React.FC<IconProps> = ({ className, title }) => (
    <svg {...baseSvgProps} className={className}>
        {title ? <title>{title}</title> : null}
        <path
            d="M 16 38
               C 8 38 8 26 16 26
               C 16 18 26 16 30 22
               C 32 16 42 16 44 22
               C 54 22 54 36 46 38
               C 50 44 42 48 36 44
               C 32 50 22 50 18 44
               C 12 46 10 40 16 38 Z"
            stroke="currentColor"
            strokeWidth="2"
            fill="white"
        />
    </svg>
);

/** Generic / unknown device — neutral box with a dot. */
export const CiscoGenericIcon: React.FC<IconProps> = ({ className, title }) => (
    <svg {...baseSvgProps} className={className}>
        {title ? <title>{title}</title> : null}
        <rect x="14" y="18" width="36" height="28" rx="3" stroke="currentColor" strokeWidth="2" fill="white" />
        <circle cx="32" cy="32" r="3" fill="currentColor" />
    </svg>
);

/** Public registry: shape id → icon component. Consumers in the
 *  topology canvas use this to switch icons without a giant
 *  switch statement. */
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
