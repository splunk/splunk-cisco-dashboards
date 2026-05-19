/**
 * Silhouette family — Build 115.15 prototype.
 *
 * Build 115.13 introduced a single generic "rack chassis"
 * silhouette for every rack-mount device, with a small lucide
 * icon overlaid on the chassis face to differentiate. Operator
 * verdict: the chassis dominates but the chassis is interchangeable
 * across most device classes, and the icon overlay shrunk to a
 * size where it stopped carrying device-class meaning.
 *
 * Build 115.15 (this rewrite, prototype) replaces that with
 * **per-class chassis silhouettes** — every major rack-mount
 * device family gets its own hand-drawn artwork that fills the
 * card's icon area, signals the device class through chassis
 * geometry alone, and drops the lucide icon overlay (the chassis
 * IS the identity).
 *
 * Specialised chassis (prototype scope):
 *   • Switch    — wide 1U with a 16-port RJ45 array + LCD strip
 *   • L3 Switch — taller 2U with a Layer-3 badge, SFP cages, and
 *                 a denser port array
 *   • Stack     — three thin chassis stacked, with a stack cable
 *                 connecting them on the right
 *   • Router    — squat tower (taller, narrower) with an LCD
 *                 status screen, antenna stub, and 3 fat uplinks
 *   • Firewall  — 1U chassis with a prominent shield etched on
 *                 the front face + red LED rail
 *   • WLC       — 1U chassis with three Wi-Fi ripple arcs
 *                 emanating overhead
 *
 * Everything else still resolves through this file's family map
 * (`SHAPE_FAMILY`):
 *   • Other physical network / security appliances
 *                          → fall back to the generic
 *                             `RackChassis` (with icon overlay)
 *   • Disc / Database       → unchanged from 115.13
 *     Cloud / Building /
 *     Users / Endpoint /
 *     Card fallback
 */

import React from 'react';
import type { DeviceShapeId } from '@/common/services/topologyDiscovery';
import { CISCO_ICONS } from './ciscoIcons';
import { cn } from '@/common/lib/utils';

export type SilhouetteFamily =
    | 'rack'
    | 'disc'
    | 'cylinder'
    | 'cloud'
    | 'building'
    | 'usersGroup'
    | 'endpoint'
    | 'card';

export const SHAPE_FAMILY: Record<DeviceShapeId, SilhouetteFamily> = {
    switch: 'rack',
    l3_switch: 'rack',
    stack: 'rack',
    router: 'rack',
    hub: 'rack',
    gateway: 'rack',
    proxy: 'rack',
    wlc: 'rack',
    access_point: 'disc',
    load_balancer: 'card',
    f5_load_balancer: 'card',
    modular_chassis_switch: 'card',
    nexus_aci_fabric: 'card',
    sdwan_controller: 'card',
    firewall: 'rack',
    palo_alto_firewall: 'card',
    fortinet_firewall: 'card',
    waf: 'rack',
    vpn_concentrator: 'rack',
    ids_ips: 'rack',
    siem: 'rack',
    ca: 'rack',
    bastion: 'rack',
    server: 'card',
    web_server: 'card',
    app_server: 'card',
    dns_server: 'card',
    dhcp_server: 'card',
    mainframe: 'card',
    container: 'card',
    vm: 'card',
    database: 'cylinder',
    storage: 'card',
    nas: 'card',
    san: 'card',
    backup: 'card',
    laptop: 'endpoint',
    mobile_phone: 'endpoint',
    ip_phone: 'endpoint',
    printer: 'endpoint',
    camera: 'endpoint',
    iot_sensor: 'endpoint',
    cloud: 'cloud',
    internet: 'cloud',
    users: 'usersGroup',
    splunk_search_head: 'card',
    splunk_search_head_cluster: 'card',
    splunk_indexer: 'card',
    splunk_indexer_cluster: 'card',
    splunk_heavy_forwarder: 'card',
    splunk_universal_forwarder: 'card',
    splunk_cluster_manager: 'card',
    splunk_deployer: 'card',
    splunk_license_manager: 'card',
    splunk_monitoring_console: 'card',
    splunk_deployment_server: 'card',
    splunk_data_collection: 'card',
    splunk_edge_processor: 'card',
    splunk_sc4s: 'card',
    branch_office: 'building',
    datacenter: 'building',
    cisco_router: 'card',
    cisco_switch: 'card',
    cisco_l3_switch: 'card',
    cisco_stack: 'card',
    cisco_wlc: 'card',
    cisco_access_point: 'card',
    cisco_firewall: 'card',
    cisco_server: 'card',
    cisco_cloud: 'card',
    cisco_data_center: 'card',
    generic: 'card',
};

export const resolveSilhouetteFamily = (
    shape: DeviceShapeId | undefined
): SilhouetteFamily => {
    if (!shape) return 'card';
    return SHAPE_FAMILY[shape] ?? 'card';
};

const SVG_VIEWBOX = '0 0 100 100';

interface SilhouetteProps {
    shape: DeviceShapeId;
    Icon: React.ComponentType<{ className?: string }>;
    className?: string;
}

// =============================================================================
// Specialised chassis (Build 115.15)
//
// Each component is a full-card silhouette tuned to its device
// class. Conventions:
//   • viewBox 0 0 100 100 with `preserveAspectRatio="xMidYMid meet"`
//     so the chassis fills the card's icon area without distortion.
//   • The chassis hits the canvas edges (y=20 to y=80, x=2 to x=98)
//     so the silhouette dominates the visible area instead of
//     floating in negative space the way 115.13 did.
//   • Plain SVG primitives only — no <foreignObject>, no lucide
//     icon overlay. The chassis itself signals "switch" / "router" /
//     "firewall" by geometry, not by a glyph caption.
//   • Tailwind classes set `currentColor`; per-class accent colour
//     applies to the chassis tint via the wrapper's `text-…` class.
//   • Status rings, ports, and indicators use opacity-modulated
//     `currentColor` so light/dark modes flow through automatically.
// =============================================================================

const RackEars: React.FC<{ y: number; height: number }> = ({ y, height }) => (
    <g>
        {/* Left ear */}
        <rect
            x={2}
            y={y}
            width={8}
            height={height}
            rx={1}
            fill="currentColor"
            opacity={0.18}
        />
        <circle cx={6} cy={y + 4} r={0.9} fill="currentColor" opacity={0.45} />
        <circle
            cx={6}
            cy={y + height - 4}
            r={0.9}
            fill="currentColor"
            opacity={0.45}
        />
        {/* Right ear */}
        <rect
            x={90}
            y={y}
            width={8}
            height={height}
            rx={1}
            fill="currentColor"
            opacity={0.18}
        />
        <circle cx={94} cy={y + 4} r={0.9} fill="currentColor" opacity={0.45} />
        <circle
            cx={94}
            cy={y + height - 4}
            r={0.9}
            fill="currentColor"
            opacity={0.45}
        />
    </g>
);

/** A generic 8-port array helper used by switch / firewall / WLC. */
const PortRow: React.FC<{
    x: number;
    y: number;
    width: number;
    height: number;
    ports: number;
    accent?: string;
}> = ({ x, y, width, height, ports, accent }) => {
    // Distribute ports evenly with a small gap. Width per port =
    // (width - (ports-1)*gap) / ports. Uniform spacing, small
    // rounded rectangles — at small zoom this reads as "row of
    // RJ45 jacks" without us needing to draw the lattice detail.
    const gap = ports >= 12 ? 0.6 : 1.2;
    const portWidth = (width - (ports - 1) * gap) / ports;
    return (
        <g>
            {Array.from({ length: ports }).map((_, i) => (
                <rect
                    key={i}
                    x={x + i * (portWidth + gap)}
                    y={y}
                    width={portWidth}
                    height={height}
                    rx={0.6}
                    fill="currentColor"
                    opacity={0.55}
                />
            ))}
            {accent && (
                // Activity LED above each port — a tiny dot row that
                // makes the array read as "live ports" instead of
                // "decorative grille".
                <g>
                    {Array.from({ length: ports }).map((_, i) => (
                        <circle
                            key={`led-${i}`}
                            cx={x + i * (portWidth + gap) + portWidth / 2}
                            cy={y - 1.5}
                            r={0.6}
                            fill={accent}
                            opacity={i % 2 === 0 ? 0.9 : 0.5}
                        />
                    ))}
                </g>
            )}
        </g>
    );
};

// -----------------------------------------------------------------
// Switch — 1U rack-mount, 16 ports, status LCD, dual port rows.
// -----------------------------------------------------------------
const SwitchChassis: React.FC<SilhouetteProps> = ({ className }) => (
    <svg
        viewBox={SVG_VIEWBOX}
        preserveAspectRatio="xMidYMid meet"
        className={cn(
            'w-full h-full text-emerald-600 dark:text-emerald-400',
            className
        )}
    >
        <RackEars y={32} height={36} />
        {/* Chassis body — 1U, wide and shallow. */}
        <rect
            x={10}
            y={26}
            width={80}
            height={48}
            rx={3}
            fill="currentColor"
            fillOpacity={0.08}
            stroke="currentColor"
            strokeOpacity={0.55}
            strokeWidth={1}
        />
        {/* Top strip: status LCD + vendor tab + console port. */}
        <rect
            x={14}
            y={30}
            width={20}
            height={6}
            rx={1}
            fill="currentColor"
            opacity={0.22}
        />
        {/* Three LEDs inside the LCD */}
        <circle cx={18} cy={33} r={0.9} fill="#10b981" opacity={0.95} />
        <circle cx={22} cy={33} r={0.9} fill="#f59e0b" opacity={0.85} />
        <circle cx={26} cy={33} r={0.9} fill="currentColor" opacity={0.6} />
        {/* Vendor / model tab */}
        <rect
            x={38}
            y={30}
            width={28}
            height={6}
            rx={1}
            fill="currentColor"
            opacity={0.12}
        />
        {/* Console port (right) */}
        <rect
            x={70}
            y={30}
            width={16}
            height={6}
            rx={1}
            fill="currentColor"
            opacity={0.35}
        />
        {/* Port row 1 (top) — 8 ports */}
        <PortRow x={14} y={42} width={72} height={10} ports={8} accent="#10b981" />
        {/* Port row 2 (bottom) — 8 ports */}
        <PortRow x={14} y={56} width={72} height={10} ports={8} accent="#10b981" />
        {/* Bottom rail with status dots */}
        <rect
            x={14}
            y={68}
            width={72}
            height={2.5}
            rx={0.5}
            fill="currentColor"
            opacity={0.18}
        />
    </svg>
);

// -----------------------------------------------------------------
// L3 Switch — 2U chassis, taller, with an explicit "L3" badge
//   and four uplink SFP cages on the front face.
// -----------------------------------------------------------------
const L3SwitchChassis: React.FC<SilhouetteProps> = ({ className }) => (
    <svg
        viewBox={SVG_VIEWBOX}
        preserveAspectRatio="xMidYMid meet"
        className={cn(
            'w-full h-full text-emerald-700 dark:text-emerald-300',
            className
        )}
    >
        <RackEars y={20} height={60} />
        {/* Chassis body — 2U, taller than a switch. */}
        <rect
            x={10}
            y={18}
            width={80}
            height={64}
            rx={3}
            fill="currentColor"
            fillOpacity={0.08}
            stroke="currentColor"
            strokeOpacity={0.55}
            strokeWidth={1}
        />
        {/* Top strip with L3 badge */}
        <rect
            x={14}
            y={22}
            width={14}
            height={8}
            rx={1.5}
            fill="currentColor"
            opacity={0.4}
        />
        <text
            x={21}
            y={28}
            textAnchor="middle"
            fontSize={6}
            fontWeight={700}
            fill="white"
            opacity={0.95}
        >
            L3
        </text>
        {/* LCD strip */}
        <rect
            x={32}
            y={22}
            width={26}
            height={8}
            rx={1}
            fill="currentColor"
            opacity={0.18}
        />
        <circle cx={38} cy={26} r={1} fill="#10b981" />
        <circle cx={42} cy={26} r={1} fill="#f59e0b" />
        <circle cx={46} cy={26} r={1} fill="currentColor" opacity={0.6} />
        {/* SFP uplink cages (top right) — 4 wider slots */}
        <g>
            {Array.from({ length: 4 }).map((_, i) => (
                <rect
                    key={i}
                    x={62 + i * 6}
                    y={22}
                    width={5}
                    height={8}
                    rx={0.5}
                    fill="currentColor"
                    opacity={0.45}
                />
            ))}
        </g>
        {/* Port row 1 — 12 ports */}
        <PortRow x={14} y={36} width={72} height={9} ports={12} accent="#10b981" />
        {/* Port row 2 — 12 ports */}
        <PortRow x={14} y={48} width={72} height={9} ports={12} accent="#10b981" />
        {/* Port row 3 — 12 ports */}
        <PortRow x={14} y={60} width={72} height={9} ports={12} accent="#10b981" />
        {/* Bottom status rail */}
        <rect
            x={14}
            y={73}
            width={72}
            height={3}
            rx={0.5}
            fill="currentColor"
            opacity={0.2}
        />
    </svg>
);

// -----------------------------------------------------------------
// Stack — three thin chassis stacked, with a stack cable on the
//   right side connecting them. Most visually distinctive switch
//   family — three discrete units = "stack" reads instantly.
// -----------------------------------------------------------------
const StackChassis: React.FC<SilhouetteProps> = ({ className }) => (
    <svg
        viewBox={SVG_VIEWBOX}
        preserveAspectRatio="xMidYMid meet"
        className={cn(
            'w-full h-full text-emerald-600 dark:text-emerald-400',
            className
        )}
    >
        {/* Single-piece tall rack ear on each side spanning all three units. */}
        <rect
            x={2}
            y={20}
            width={6}
            height={60}
            rx={1}
            fill="currentColor"
            opacity={0.18}
        />
        <rect
            x={92}
            y={20}
            width={6}
            height={60}
            rx={1}
            fill="currentColor"
            opacity={0.18}
        />
        {/* Mount holes on the long ears */}
        {[26, 38, 50, 62, 74].map((y) => (
            <React.Fragment key={y}>
                <circle cx={5} cy={y} r={0.8} fill="currentColor" opacity={0.45} />
                <circle cx={95} cy={y} r={0.8} fill="currentColor" opacity={0.45} />
            </React.Fragment>
        ))}
        {/* Three chassis units. */}
        {[24, 44, 64].map((y, idx) => (
            <g key={y}>
                <rect
                    x={8}
                    y={y}
                    width={84}
                    height={14}
                    rx={2}
                    fill="currentColor"
                    fillOpacity={0.08}
                    stroke="currentColor"
                    strokeOpacity={0.55}
                    strokeWidth={1}
                />
                {/* Mini LCD on the left */}
                <rect
                    x={12}
                    y={y + 4}
                    width={10}
                    height={6}
                    rx={0.5}
                    fill="currentColor"
                    opacity={0.25}
                />
                {/* Master indicator (top unit gets a green dot, others amber). */}
                <circle
                    cx={20}
                    cy={y + 7}
                    r={1}
                    fill={idx === 0 ? '#10b981' : '#f59e0b'}
                />
                {/* Mini port row. */}
                <PortRow x={26} y={y + 5} width={56} height={4} ports={12} />
            </g>
        ))}
        {/* Stack cable — vertical run on the right, connecting the
         *  three chassis with small bumps where it enters each. */}
        <path
            d="M84 31 Q88 38 84 44 Q80 51 84 58 Q88 65 84 71"
            stroke="currentColor"
            strokeOpacity={0.6}
            strokeWidth={1.5}
            fill="none"
            strokeLinecap="round"
        />
        <circle cx={84} cy={31} r={1.2} fill="currentColor" opacity={0.7} />
        <circle cx={84} cy={51} r={1.2} fill="currentColor" opacity={0.7} />
        <circle cx={84} cy={71} r={1.2} fill="currentColor" opacity={0.7} />
    </svg>
);

// -----------------------------------------------------------------
// Router — squat tower (taller, narrower than a switch). Has an
//   LCD status screen, console port, two fat uplinks, and an
//   antenna stub poking out the top.
// -----------------------------------------------------------------
const RouterChassis: React.FC<SilhouetteProps> = ({ className }) => (
    <svg
        viewBox={SVG_VIEWBOX}
        preserveAspectRatio="xMidYMid meet"
        className={cn(
            'w-full h-full text-amber-600 dark:text-amber-400',
            className
        )}
    >
        {/* Antenna stub poking out the top. */}
        <line
            x1={50}
            y1={6}
            x2={50}
            y2={18}
            stroke="currentColor"
            strokeOpacity={0.6}
            strokeWidth={1.4}
            strokeLinecap="round"
        />
        <circle cx={50} cy={6} r={1.6} fill="currentColor" opacity={0.7} />
        {/* Wireless ripple arcs near the antenna tip. */}
        <path
            d="M44 10 Q50 4 56 10"
            stroke="currentColor"
            strokeOpacity={0.45}
            strokeWidth={1}
            fill="none"
            strokeLinecap="round"
        />
        {/* Chassis body — narrower than a switch, taller. */}
        <rect
            x={20}
            y={18}
            width={60}
            height={64}
            rx={4}
            fill="currentColor"
            fillOpacity={0.08}
            stroke="currentColor"
            strokeOpacity={0.55}
            strokeWidth={1}
        />
        {/* Top vent slits — three thin horizontal lines. */}
        {[22, 24.5, 27].map((y) => (
            <line
                key={y}
                x1={28}
                y1={y}
                x2={72}
                y2={y}
                stroke="currentColor"
                strokeOpacity={0.4}
                strokeWidth={0.6}
                strokeLinecap="round"
            />
        ))}
        {/* LCD status screen — dark rectangle with a couple of dots. */}
        <rect
            x={28}
            y={32}
            width={44}
            height={14}
            rx={1.5}
            fill="currentColor"
            opacity={0.32}
        />
        <circle cx={34} cy={39} r={1.4} fill="#10b981" />
        <circle cx={40} cy={39} r={1.4} fill="#f59e0b" />
        {/* "Wi-Fi bars" inside the LCD as a router-style flourish. */}
        <g transform="translate(58 35) scale(0.7)">
            <rect x={0} y={6} width={2} height={4} rx={0.5} fill="currentColor" opacity={0.7} />
            <rect x={4} y={3} width={2} height={7} rx={0.5} fill="currentColor" opacity={0.7} />
            <rect x={8} y={0} width={2} height={10} rx={0.5} fill="currentColor" opacity={0.7} />
        </g>
        {/* Console port + status row */}
        <rect
            x={28}
            y={50}
            width={14}
            height={5}
            rx={0.5}
            fill="currentColor"
            opacity={0.45}
        />
        <rect
            x={46}
            y={50}
            width={26}
            height={5}
            rx={0.5}
            fill="currentColor"
            opacity={0.18}
        />
        <circle cx={51} cy={52.5} r={0.8} fill="#10b981" />
        <circle cx={56} cy={52.5} r={0.8} fill="currentColor" opacity={0.6} />
        <circle cx={61} cy={52.5} r={0.8} fill="#f59e0b" />
        <circle cx={66} cy={52.5} r={0.8} fill="currentColor" opacity={0.6} />
        {/* Three fat uplink ports across the bottom. */}
        <g>
            {[28, 47, 66].map((x, i) => (
                <rect
                    key={i}
                    x={x}
                    y={60}
                    width={12}
                    height={10}
                    rx={1}
                    fill="currentColor"
                    opacity={0.5}
                />
            ))}
        </g>
        {/* Two stubby feet at the bottom. */}
        <rect
            x={26}
            y={80}
            width={10}
            height={3}
            rx={0.5}
            fill="currentColor"
            opacity={0.4}
        />
        <rect
            x={64}
            y={80}
            width={10}
            height={3}
            rx={0.5}
            fill="currentColor"
            opacity={0.4}
        />
    </svg>
);

// -----------------------------------------------------------------
// Firewall — 1U chassis with a prominent shield etched on the
//   front face + a red LED rail communicating "security
//   appliance".
// -----------------------------------------------------------------
const FirewallChassis: React.FC<SilhouetteProps> = ({ className }) => (
    <svg
        viewBox={SVG_VIEWBOX}
        preserveAspectRatio="xMidYMid meet"
        className={cn(
            'w-full h-full text-rose-600 dark:text-rose-400',
            className
        )}
    >
        <RackEars y={30} height={40} />
        {/* Chassis body */}
        <rect
            x={10}
            y={24}
            width={80}
            height={52}
            rx={3}
            fill="currentColor"
            fillOpacity={0.08}
            stroke="currentColor"
            strokeOpacity={0.55}
            strokeWidth={1}
        />
        {/* Red LED rail across the top — five LEDs */}
        <rect
            x={14}
            y={28}
            width={72}
            height={5}
            rx={1}
            fill="currentColor"
            fillOpacity={0.15}
        />
        {[20, 32, 44, 56, 68, 80].map((cx) => (
            <circle
                key={cx}
                cx={cx}
                cy={30.5}
                r={1.3}
                fill="#ef4444"
                opacity={cx === 20 || cx === 56 ? 0.95 : 0.55}
            />
        ))}
        {/* Shield on the chassis face (centre-left). The shield
         *  silhouette is the key device-class cue. */}
        <g transform="translate(20 38)">
            <path
                d="M14 0 L26 4 L26 14 Q26 22 14 28 Q2 22 2 14 L2 4 Z"
                fill="currentColor"
                fillOpacity={0.9}
                stroke="currentColor"
                strokeOpacity={0.95}
                strokeWidth={1}
            />
            {/* Checkmark inside the shield */}
            <path
                d="M9 14 L13 18 L20 9"
                fill="none"
                stroke="white"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </g>
        {/* Right of shield: small port group + console */}
        <rect
            x={52}
            y={42}
            width={32}
            height={6}
            rx={0.5}
            fill="currentColor"
            opacity={0.18}
        />
        {/* Six small ports */}
        <g>
            {[54, 60, 66, 72, 78].map((x, i) => (
                <rect
                    key={x}
                    x={x}
                    y={52}
                    width={4}
                    height={8}
                    rx={0.5}
                    fill="currentColor"
                    opacity={0.55}
                />
            ))}
        </g>
        {/* Console port (right side) */}
        <rect
            x={70}
            y={64}
            width={14}
            height={4}
            rx={0.5}
            fill="currentColor"
            opacity={0.4}
        />
    </svg>
);

// -----------------------------------------------------------------
// WLC — 1U chassis with three Wi-Fi ripple arcs above. The
//   ripples + a single antenna tower silhouette signal "wireless
//   controller" instantly.
// -----------------------------------------------------------------
const WlcChassis: React.FC<SilhouetteProps> = ({ className }) => (
    <svg
        viewBox={SVG_VIEWBOX}
        preserveAspectRatio="xMidYMid meet"
        className={cn(
            'w-full h-full text-violet-600 dark:text-violet-400',
            className
        )}
    >
        {/* Antenna tower — vertical line + tip */}
        <line
            x1={20}
            y1={16}
            x2={20}
            y2={42}
            stroke="currentColor"
            strokeOpacity={0.55}
            strokeWidth={1.4}
            strokeLinecap="round"
        />
        <circle cx={20} cy={16} r={1.5} fill="currentColor" opacity={0.7} />
        {/* Wi-Fi ripple arcs emanating right from the antenna tip. */}
        <path
            d="M22 10 Q34 16 32 28"
            stroke="currentColor"
            strokeOpacity={0.55}
            strokeWidth={1.2}
            fill="none"
            strokeLinecap="round"
        />
        <path
            d="M28 6 Q48 16 46 32"
            stroke="currentColor"
            strokeOpacity={0.4}
            strokeWidth={1.2}
            fill="none"
            strokeLinecap="round"
        />
        <path
            d="M34 4 Q60 16 60 36"
            stroke="currentColor"
            strokeOpacity={0.25}
            strokeWidth={1.2}
            fill="none"
            strokeLinecap="round"
        />
        {/* Chassis body */}
        <RackEars y={48} height={28} />
        <rect
            x={10}
            y={44}
            width={80}
            height={36}
            rx={3}
            fill="currentColor"
            fillOpacity={0.08}
            stroke="currentColor"
            strokeOpacity={0.55}
            strokeWidth={1}
        />
        {/* LCD strip with two LEDs */}
        <rect
            x={14}
            y={48}
            width={20}
            height={6}
            rx={1}
            fill="currentColor"
            opacity={0.22}
        />
        <circle cx={18} cy={51} r={0.9} fill="#10b981" />
        <circle cx={22} cy={51} r={0.9} fill="#a78bfa" />
        {/* "WLC" tag */}
        <rect
            x={38}
            y={48}
            width={20}
            height={6}
            rx={1}
            fill="currentColor"
            opacity={0.4}
        />
        <text
            x={48}
            y={53}
            textAnchor="middle"
            fontSize={4.5}
            fontWeight={700}
            fill="white"
            opacity={0.95}
        >
            WLC
        </text>
        {/* AP-count display (right) */}
        <rect
            x={62}
            y={48}
            width={24}
            height={6}
            rx={1}
            fill="currentColor"
            opacity={0.18}
        />
        {/* Status LEDs in the AP-count display — represents managed APs */}
        {[66, 70, 74, 78, 82].map((cx) => (
            <circle
                key={cx}
                cx={cx}
                cy={51}
                r={0.8}
                fill="#a78bfa"
                opacity={0.85}
            />
        ))}
        {/* Single port row — WLCs typically have 2-4 uplinks */}
        <PortRow x={14} y={60} width={72} height={10} ports={4} accent="#a78bfa" />
        {/* Bottom rail */}
        <rect
            x={14}
            y={73}
            width={72}
            height={2}
            rx={0.5}
            fill="currentColor"
            opacity={0.18}
        />
    </svg>
);

// -----------------------------------------------------------------
// Generic rack chassis — fallback for rack devices that don't
//   have a specialised silhouette yet (hub, gateway, proxy, waf,
//   vpn_concentrator, ids_ips, siem, ca, bastion).
//
//   Keeps the lucide icon overlay because the chassis itself
//   is generic — the operator needs the icon to tell device
//   classes apart in the fallback case.
// -----------------------------------------------------------------
type RackFlavour = 'switch' | 'router' | 'security' | 'generic';

const RACK_FLAVOUR: Partial<Record<DeviceShapeId, RackFlavour>> = {
    hub: 'switch',
    gateway: 'router',
    proxy: 'router',
    waf: 'security',
    vpn_concentrator: 'security',
    ids_ips: 'security',
    siem: 'security',
    ca: 'security',
    bastion: 'security',
};

const RackChassis: React.FC<SilhouetteProps> = ({ shape, Icon, className }) => {
    const flavour = RACK_FLAVOUR[shape] ?? 'generic';
    const accentByFlavour: Record<RackFlavour, string> = {
        switch: '#10b981',
        router: '#f59e0b',
        security: '#ef4444',
        generic: '#64748b',
    };
    const accent = accentByFlavour[flavour];
    return (
        <svg
            viewBox={SVG_VIEWBOX}
            preserveAspectRatio="xMidYMid meet"
            className={cn(
                'w-full h-full text-slate-500 dark:text-slate-400',
                className
            )}
        >
            <RackEars y={32} height={36} />
            <rect
                x={10}
                y={26}
                width={80}
                height={48}
                rx={3}
                fill="currentColor"
                fillOpacity={0.08}
                stroke="currentColor"
                strokeOpacity={0.45}
                strokeWidth={1}
            />
            {/* Icon overlay (kept for the generic fallback only —
             *  specialised chassis above don't need the lucide
             *  caption because the chassis art carries the
             *  identity). */}
            <foreignObject x={28} y={32} width={44} height={26}>
                <div className="w-full h-full flex items-center justify-center">
                    <Icon className="w-7 h-7" />
                </div>
            </foreignObject>
            {/* Status / port strip at the bottom */}
            <rect
                x={14}
                y={62}
                width={68}
                height={4}
                rx={0.5}
                fill="currentColor"
                opacity={0.18}
            />
            <circle cx={84} cy={64} r={1.4} fill={accent} opacity={0.85} />
        </svg>
    );
};

// =============================================================================
// Non-rack family silhouettes (unchanged from 115.13)
// =============================================================================

const DiscSilhouette: React.FC<SilhouetteProps> = ({ Icon, className }) => (
    <svg
        viewBox={SVG_VIEWBOX}
        preserveAspectRatio="xMidYMid meet"
        className={cn(
            'w-full h-full text-sky-500 dark:text-sky-400',
            className
        )}
    >
        <path
            d="M30 32 Q50 18 70 32"
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.25}
            strokeWidth={1.5}
            strokeLinecap="round"
        />
        <path
            d="M36 38 Q50 28 64 38"
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.45}
            strokeWidth={1.5}
            strokeLinecap="round"
        />
        <path
            d="M42 44 Q50 38 58 44"
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.7}
            strokeWidth={1.5}
            strokeLinecap="round"
        />
        <ellipse cx={50} cy={78} rx={20} ry={3} fill="currentColor" opacity={0.15} />
        <rect
            x={28}
            y={50}
            width={44}
            height={22}
            rx={11}
            fill="currentColor"
            opacity={0.12}
            stroke="currentColor"
            strokeOpacity={0.55}
            strokeWidth={1}
        />
        <circle cx={50} cy={61} r={2} fill="currentColor" opacity={0.6} />
        <foreignObject x={37} y={51} width={26} height={20}>
            <div className="w-full h-full flex items-center justify-center">
                <Icon className="w-4 h-4" />
            </div>
        </foreignObject>
    </svg>
);

const CylinderSilhouette: React.FC<SilhouetteProps> = ({ Icon, className }) => (
    <svg
        viewBox={SVG_VIEWBOX}
        preserveAspectRatio="xMidYMid meet"
        className={cn(
            'w-full h-full text-amber-600 dark:text-amber-400',
            className
        )}
    >
        <ellipse cx={50} cy={86} rx={26} ry={3} fill="currentColor" opacity={0.15} />
        <path
            d="M22 32 V72 A28 6 0 0 0 78 72 V32"
            fill="currentColor"
            fillOpacity={0.1}
            stroke="currentColor"
            strokeOpacity={0.5}
            strokeWidth={1}
        />
        <path
            d="M22 46 A28 6 0 0 0 78 46"
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.3}
            strokeWidth={0.8}
        />
        <path
            d="M22 60 A28 6 0 0 0 78 60"
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.3}
            strokeWidth={0.8}
        />
        <ellipse
            cx={50}
            cy={32}
            rx={28}
            ry={6}
            fill="currentColor"
            fillOpacity={0.18}
            stroke="currentColor"
            strokeOpacity={0.55}
            strokeWidth={1}
        />
        <foreignObject x={37} y={48} width={26} height={20}>
            <div className="w-full h-full flex items-center justify-center">
                <Icon className="w-5 h-5" />
            </div>
        </foreignObject>
    </svg>
);

const CloudSilhouette: React.FC<SilhouetteProps> = ({ Icon, className }) => (
    <svg
        viewBox={SVG_VIEWBOX}
        preserveAspectRatio="xMidYMid meet"
        className={cn(
            'w-full h-full text-sky-600 dark:text-sky-400',
            className
        )}
    >
        <path
            d="M30 70 Q14 70 14 56 Q14 44 28 44 Q30 30 46 30 Q60 30 64 42 Q86 42 86 58 Q86 70 72 70 Z"
            fill="currentColor"
            fillOpacity={0.12}
            stroke="currentColor"
            strokeOpacity={0.55}
            strokeWidth={1.2}
        />
        <foreignObject x={32} y={42} width={36} height={24}>
            <div className="w-full h-full flex items-center justify-center">
                <Icon className="w-6 h-6" />
            </div>
        </foreignObject>
    </svg>
);

const BuildingSilhouette: React.FC<SilhouetteProps> = ({ Icon, className }) => (
    <svg
        viewBox={SVG_VIEWBOX}
        preserveAspectRatio="xMidYMid meet"
        className={cn(
            'w-full h-full text-violet-600 dark:text-violet-400',
            className
        )}
    >
        <path
            d="M18 36 L50 22 L82 36 Z"
            fill="currentColor"
            fillOpacity={0.18}
            stroke="currentColor"
            strokeOpacity={0.55}
            strokeWidth={1}
        />
        <rect
            x={22}
            y={36}
            width={56}
            height={42}
            fill="currentColor"
            fillOpacity={0.08}
            stroke="currentColor"
            strokeOpacity={0.55}
            strokeWidth={1}
        />
        {[42, 52, 62].map((y) =>
            [27, 37, 53, 63].map((x) => (
                <rect
                    key={`${x}-${y}`}
                    x={x}
                    y={y}
                    width={6}
                    height={6}
                    rx={0.5}
                    fill="currentColor"
                    opacity={0.35}
                />
            ))
        )}
        <rect
            x={45}
            y={66}
            width={10}
            height={12}
            rx={0.5}
            fill="currentColor"
            opacity={0.45}
        />
        <ellipse cx={50} cy={82} rx={32} ry={2.5} fill="currentColor" opacity={0.15} />
        <foreignObject x={42} y={26} width={16} height={10}>
            <div className="w-full h-full flex items-center justify-center text-white">
                <Icon className="w-3 h-3" />
            </div>
        </foreignObject>
    </svg>
);

const UsersGroupSilhouette: React.FC<SilhouetteProps> = ({ className }) => (
    <svg
        viewBox={SVG_VIEWBOX}
        preserveAspectRatio="xMidYMid meet"
        className={cn(
            'w-full h-full text-emerald-600 dark:text-emerald-400',
            className
        )}
    >
        <circle cx={28} cy={42} r={6} fill="currentColor" opacity={0.35} />
        <path
            d="M16 70 Q16 56 28 56 Q40 56 40 70 Z"
            fill="currentColor"
            opacity={0.35}
        />
        <circle cx={72} cy={42} r={6} fill="currentColor" opacity={0.35} />
        <path
            d="M60 70 Q60 56 72 56 Q84 56 84 70 Z"
            fill="currentColor"
            opacity={0.35}
        />
        <circle
            cx={50}
            cy={38}
            r={8}
            fill="currentColor"
            opacity={0.7}
            stroke="currentColor"
            strokeOpacity={0.5}
        />
        <path
            d="M34 78 Q34 56 50 56 Q66 56 66 78 Z"
            fill="currentColor"
            opacity={0.7}
        />
    </svg>
);

const EndpointSilhouette: React.FC<SilhouetteProps> = ({ Icon, className }) => (
    <svg
        viewBox={SVG_VIEWBOX}
        preserveAspectRatio="xMidYMid meet"
        className={cn(
            'w-full h-full text-slate-600 dark:text-slate-300',
            className
        )}
    >
        <ellipse cx={50} cy={82} rx={26} ry={3} fill="currentColor" opacity={0.15} />
        <foreignObject x={20} y={18} width={60} height={60}>
            <div className="w-full h-full flex items-center justify-center">
                <Icon className="w-12 h-12" />
            </div>
        </foreignObject>
    </svg>
);

const CardSilhouette: React.FC<SilhouetteProps> = ({ Icon, className }) => (
    <div
        className={cn(
            'w-full h-full flex items-center justify-center',
            className
        )}
    >
        <Icon className="w-12 h-12" />
    </div>
);

// =============================================================================
// Dispatcher
// =============================================================================

/** Specialised rack-chassis lookup. Build 115.15 prototype: 6
 *  device classes get hand-drawn artwork; everything else falls
 *  back to `RackChassis` (with lucide icon overlay). */
const SPECIALISED_RACK: Partial<
    Record<
        DeviceShapeId,
        React.FC<SilhouetteProps>
    >
> = {
    switch: SwitchChassis,
    l3_switch: L3SwitchChassis,
    stack: StackChassis,
    router: RouterChassis,
    firewall: FirewallChassis,
    wlc: WlcChassis,
};

export const ShapeSilhouette: React.FC<{
    shape: DeviceShapeId;
    className?: string;
}> = ({ shape, className }) => {
    const family = resolveSilhouetteFamily(shape);
    const Icon = (CISCO_ICONS[shape] ?? CISCO_ICONS.generic) as React.ComponentType<{
        className?: string;
    }>;
    if (family === 'rack') {
        const Specialised = SPECIALISED_RACK[shape];
        if (Specialised) {
            return <Specialised shape={shape} Icon={Icon} className={className} />;
        }
        return <RackChassis shape={shape} Icon={Icon} className={className} />;
    }
    switch (family) {
        case 'disc':
            return <DiscSilhouette shape={shape} Icon={Icon} className={className} />;
        case 'cylinder':
            return (
                <CylinderSilhouette shape={shape} Icon={Icon} className={className} />
            );
        case 'cloud':
            return <CloudSilhouette shape={shape} Icon={Icon} className={className} />;
        case 'building':
            return (
                <BuildingSilhouette shape={shape} Icon={Icon} className={className} />
            );
        case 'usersGroup':
            return (
                <UsersGroupSilhouette
                    shape={shape}
                    Icon={Icon}
                    className={className}
                />
            );
        case 'endpoint':
            return (
                <EndpointSilhouette shape={shape} Icon={Icon} className={className} />
            );
        case 'card':
        default:
            return <CardSilhouette shape={shape} Icon={Icon} className={className} />;
    }
};
