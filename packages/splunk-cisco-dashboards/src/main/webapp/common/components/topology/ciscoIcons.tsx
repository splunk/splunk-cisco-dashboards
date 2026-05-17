/**
 * Device icons — Build 115.2 modernisation.
 *
 * History:
 *   • Builds 110/111 used Lucide glyphs inside a tinted-glass badge.
 *   • Builds 112/115 ported the Cisco Visio stencil silhouettes as
 *     hand-drawn inline SVGs. Operator pushed back: the silhouettes
 *     were technically accurate but read as dated next to the rest of
 *     the modern flat-card UI ("not happy with our icons … did lucide
 *     have anything to offer?").
 *   • Build 115.2 (this file) returns to lucide-react as the icon
 *     source of truth, but applies the lessons from the v0.dev
 *     polish work: each icon ships with a per-class default colour,
 *     a slightly thicker stroke for visual presence at small sizes,
 *     and a stable `text-N` class so callers retain caller-side
 *     colour overrides via `tailwind-merge`.
 *
 * Why lucide-react (vs another modernisation path):
 *   • Already a project dependency — no new package, no licence dance.
 *   • Tree-shakable — only the icons referenced below land in the
 *     diagram bundle.
 *   • Stroke-based, 24×24, optical-grid-aligned. Renders cleanly at
 *     16, 24, 32, 36, 40px without sub-pixel blur.
 *   • Active upstream — fixes ship monthly, vs. the static
 *     Cisco Visio stencil pack.
 *
 * Why we DID NOT use @splunk/react-icons:
 *   • The Splunk icon set is heavily UI-chrome biased (toolbar
 *     glyphs, action icons). It does not include network device
 *     metaphors like Router, Database, RadioTower, Wifi, etc.
 *
 * Why we DID NOT keep the Cisco stencil silhouettes:
 *   • Visual mismatch with the rest of the diagram chrome (rounded
 *     cards, soft shadows, lucide elsewhere in the toolbar).
 *   • Per-icon weight inconsistency — some stencils were dense,
 *     others were spindly, so the canvas read as "ten different
 *     authors drew these icons over twenty years" (because they did).
 *
 * Export contract preserved:
 *   `CISCO_ICONS` is still a record keyed by `DeviceShapeId`, and the
 *   value is still a React component that takes `{ className?, title? }`.
 *   Every existing call site (shapes.tsx, ShapesTab.tsx,
 *   InventoryTab.tsx, CyberNocShape.tsx, PropertiesPanel.tsx) keeps
 *   working unchanged. The filename is also kept (despite no longer
 *   being literal Cisco artwork) to avoid churning those imports.
 */

import React from 'react';
import {
    Router,
    Network,
    Boxes,
    Layers,
    Shield,
    KeyRound,
    Radar,
    RadioTower,
    Wifi,
    Server,
    Database,
    HardDrive,
    Phone,
    Cloud,
    Globe2,
    Box,
    Users,
    // Build 115.5 — new shape additions. Each was picked from
    // lucide-react's icon set on the criterion "is this read at
    // 36–40px without a caption?". Ones that didn't pass that
    // bar (e.g. Iot, which reads as a generic chip at small
    // sizes) get a custom SVG below the lucide section.
    Cable, // hub — multi-port concentrator
    Waypoints, // gateway / SD-WAN edge — branch path icon
    SquareArrowRight, // proxy — request relay
    ShieldAlert, // waf — shield with alert tick
    Globe, // dns_server — DNS lookups touch the world
    Settings2, // dhcp_server — config knob
    MonitorSmartphone, // web_server — UI presence
    Code2, // app_server — code-running server
    Container, // container — stylised crate
    Cpu, // vm — hypervisor / VM
    Server as MainframeServer, // mainframe — heavier server (also used for siem)
    HardDriveDownload, // backup — store-then-restore
    Laptop, // laptop
    Smartphone, // mobile_phone
    Printer, // printer
    Camera, // camera
    Activity, // iot_sensor — telemetry pulse
    LineChart, // siem — analytics-on-events glyph
    BadgeCheck, // ca / cert authority — verified badge
    Lock, // bastion — gatekeeper
    Building2, // branch_office
    Warehouse, // datacenter
    type LucideIcon,
} from 'lucide-react';
import { cn } from '@/common/lib/utils';

interface IconProps {
    /** Tailwind size + optional colour override. Status callers can
     *  pass e.g. `text-rose-500` to recolour the icon for a critical
     *  alert; without a `text-*` class the per-class default below
     *  takes over via tailwind-merge. Width/height utilities
     *  (`w-9 h-9`) drive the icon size. */
    className?: string;
    title?: string;
}

// Build 115.2 — per-device-class default colours. Picked so each
// device class is visually distinct at-a-glance even when the
// silhouettes look similar (e.g. switch vs L3 switch). Status
// (healthy / warning / critical) is signalled separately via the
// host card's border ring + status LED, NOT by recolouring the icon
// — operators would lose the ability to tell a "healthy router"
// apart from a "healthy switch" at a glance otherwise.
const COLOR = {
    AMBER: 'text-amber-600 dark:text-amber-400',
    SKY: 'text-sky-600 dark:text-sky-400',
    INDIGO: 'text-indigo-600 dark:text-indigo-400',
    BLUE: 'text-blue-600 dark:text-blue-400',
    ROSE: 'text-rose-600 dark:text-rose-400',
    VIOLET: 'text-violet-600 dark:text-violet-400',
    FUCHSIA: 'text-fuchsia-600 dark:text-fuchsia-400',
    EMERALD: 'text-emerald-600 dark:text-emerald-400',
    TEAL: 'text-teal-600 dark:text-teal-400',
    CYAN: 'text-cyan-600 dark:text-cyan-400',
    PURPLE: 'text-purple-600 dark:text-purple-400',
    RED: 'text-red-600 dark:text-red-400',
    LIME: 'text-lime-600 dark:text-lime-400',
    SLATE: 'text-slate-500 dark:text-slate-400',
    PINK: 'text-pink-600 dark:text-pink-400',
} as const;

/**
 * Wrap a `LucideIcon` so it (a) carries a per-class default colour,
 * (b) renders at a slightly thicker stroke (1.75) for visual
 * presence at the 36–40px sizes the diagram canvas uses, and
 * (c) accepts caller `className` overrides through `tailwind-merge`.
 *
 * Stroke-width 1.75 is a deliberate compromise: the lucide default
 * (2) reads slightly heavy when an icon shares card real estate
 * with text labels; 1.5 gets spindly at 32px. 1.75 is the sweet
 * spot for our card sizes.
 */
const wrap = (
    Icon: LucideIcon,
    defaultColor: string
): React.FC<IconProps> => {
    const Wrapped: React.FC<IconProps> = ({ className, title }) => (
        <Icon
            className={cn(defaultColor, className)}
            strokeWidth={1.75}
            // `aria-label` and `<title>` together make these icons
            // accessible to screen readers without forcing every
            // call site to pass titles. The wrapper falls back to a
            // generic "device icon" for legacy callers.
            aria-label={title ?? 'Device icon'}
            role="img"
        >
            {title ? <title>{title}</title> : null}
        </Icon>
    );
    // Friendly displayName helps when debugging React Flow nodes in
    // the React DevTools tree (otherwise every icon shows as
    // "Wrapped").
    Wrapped.displayName = `DeviceIcon(${Icon.displayName ?? Icon.name})`;
    return Wrapped;
};

// --- Device class → icon component mapping --------------------------

// Core network
export const CiscoRouterIcon = wrap(Router, COLOR.AMBER);
export const CiscoL2SwitchIcon = wrap(Network, COLOR.SKY);
export const CiscoL3SwitchIcon = wrap(Boxes, COLOR.INDIGO);
export const CiscoStackIcon = wrap(Layers, COLOR.BLUE);
export const CiscoWlcIcon = wrap(RadioTower, COLOR.VIOLET);
export const CiscoApIcon = wrap(Wifi, COLOR.FUCHSIA);

// Build 115.5 — Load balancer icon: AWS/F5-style "stacked
// rectangles with fanning arrows". Operator feedback: the
// previous Scale (justice) glyph read as "legal", not network.
// Lucide doesn't ship anything that conveys "single ingress
// fans out to multiple backends" cleanly at 36px, so this is a
// custom SVG drawn to match the visual conventions used by AWS
// (ELB), F5, and Cisco diagrams. Stroke-only so it inherits the
// `text-*` colour the same way the lucide-wrapped icons do.
const LoadBalancerSVG: React.FC<IconProps> = ({ className, title }) => (
    <svg
        viewBox="0 0 24 24"
        className={cn(COLOR.TEAL, className)}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-label={title ?? 'Load balancer'}
        role="img"
    >
        {title ? <title>{title}</title> : null}
        {/* Single ingress at the top — represents the VIP. */}
        <rect x="9" y="2" width="6" height="4" rx="0.75" />
        {/* Fanning trunk + branches: down then split to three
            backend ports below. */}
        <path d="M12 6v3" />
        <path d="M12 9 L4.5 14" />
        <path d="M12 9 L12 14" />
        <path d="M12 9 L19.5 14" />
        {/* Three backend rectangles. The middle one is a beat
            taller so the silhouette reads as load-balanced
            distribution rather than a fixed 3-way switch. */}
        <rect x="2" y="14" width="5" height="7" rx="0.75" />
        <rect x="9.5" y="14" width="5" height="8" rx="0.75" />
        <rect x="17" y="14" width="5" height="7" rx="0.75" />
        {/* Tiny indicator dot inside each backend so the
            rectangles read as servers, not blank boxes. */}
        <circle cx="4.5" cy="17.5" r="0.6" fill="currentColor" />
        <circle cx="12" cy="17.5" r="0.6" fill="currentColor" />
        <circle cx="19.5" cy="17.5" r="0.6" fill="currentColor" />
    </svg>
);
LoadBalancerSVG.displayName = 'DeviceIcon(LoadBalancer)';
export const CiscoLoadBalancerIcon = LoadBalancerSVG;

// Security
export const CiscoFirewallIcon = wrap(Shield, COLOR.ROSE);
export const CiscoVpnIcon = wrap(KeyRound, COLOR.PURPLE);
export const CiscoIdsIpsIcon = wrap(Radar, COLOR.RED);

// Servers & data
export const CiscoServerIcon = wrap(Server, COLOR.EMERALD);
export const CiscoDatabaseIcon = wrap(Database, COLOR.CYAN);
export const CiscoStorageIcon = wrap(HardDrive, COLOR.LIME);

// Edge / cloud / endpoints
export const CiscoCloudIcon = wrap(Cloud, COLOR.SLATE);
export const CiscoInternetIcon = wrap(Globe2, COLOR.SKY);
export const CiscoIpPhoneIcon = wrap(Phone, COLOR.SLATE);
export const CiscoUsersIcon = wrap(Users, COLOR.PINK);
export const CiscoGenericIcon = wrap(Box, COLOR.SLATE);

// =================================================================
// Build 115.5 — 24 new shapes. Each is grouped by section to match
// the palette layout in ShapesTab.tsx:
//   • Core network  : hub, gateway, proxy
//   • Security      : waf, ca, bastion, siem
//   • Infrastructure: dns_server, dhcp_server, web_server,
//                     app_server, container, vm, mainframe, nas,
//                     san, backup
//   • End-user / IoT: laptop, mobile_phone, printer, camera,
//                     iot_sensor
//   • Places        : branch_office, datacenter
// Colour palette extends the per-class default scheme — adjacent
// shapes use distinct hues so an operator scanning the canvas can
// tell them apart at a glance even without reading captions.
// =================================================================

// Core network additions
export const CiscoHubIcon = wrap(Cable, COLOR.AMBER);
export const CiscoGatewayIcon = wrap(Waypoints, COLOR.SKY);
export const CiscoProxyIcon = wrap(SquareArrowRight, COLOR.INDIGO);

// Security additions
export const CiscoWafIcon = wrap(ShieldAlert, COLOR.ROSE);
export const CiscoCaIcon = wrap(BadgeCheck, COLOR.PURPLE);
export const CiscoBastionIcon = wrap(Lock, COLOR.RED);
export const CiscoSiemIcon = wrap(LineChart, COLOR.VIOLET);

// Infrastructure additions
export const CiscoDnsServerIcon = wrap(Globe, COLOR.SKY);
export const CiscoDhcpServerIcon = wrap(Settings2, COLOR.AMBER);
export const CiscoWebServerIcon = wrap(MonitorSmartphone, COLOR.EMERALD);
export const CiscoAppServerIcon = wrap(Code2, COLOR.TEAL);
export const CiscoContainerIcon = wrap(Container, COLOR.BLUE);
export const CiscoVmIcon = wrap(Cpu, COLOR.PURPLE);
export const CiscoMainframeIcon = wrap(MainframeServer, COLOR.SLATE);
export const CiscoNasIcon = wrap(HardDrive, COLOR.LIME);
// `san` and `nas` both want hard-drive iconography but need to
// read distinctly. We tint them differently and rely on the
// caption + colour to disambiguate at small sizes.
export const CiscoSanIcon = wrap(HardDrive, COLOR.CYAN);
export const CiscoBackupIcon = wrap(HardDriveDownload, COLOR.PINK);

// End-user / IoT additions
export const CiscoLaptopIcon = wrap(Laptop, COLOR.SLATE);
export const CiscoMobilePhoneIcon = wrap(Smartphone, COLOR.PINK);
export const CiscoPrinterIcon = wrap(Printer, COLOR.SLATE);
export const CiscoCameraIcon = wrap(Camera, COLOR.RED);
export const CiscoIotSensorIcon = wrap(Activity, COLOR.LIME);

// Places additions
export const CiscoBranchOfficeIcon = wrap(Building2, COLOR.INDIGO);
export const CiscoDatacenterIcon = wrap(Warehouse, COLOR.SLATE);

/** Registry — keys are `DeviceShapeId` values. Order matters for
 *  human-friendly diffing only; consumers index by id.
 *
 *  Build 115.5 — registry expanded from 18 → 42 entries (the 18
 *  pre-existing shapes + 24 new shape additions). The grouping
 *  comments are advisory; consumers (palette / inspector) read
 *  by id, not by section. */
export const CISCO_ICONS = {
    // Core network
    router: CiscoRouterIcon,
    switch: CiscoL2SwitchIcon,
    l3_switch: CiscoL3SwitchIcon,
    stack: CiscoStackIcon,
    hub: CiscoHubIcon,
    gateway: CiscoGatewayIcon,
    proxy: CiscoProxyIcon,
    wlc: CiscoWlcIcon,
    access_point: CiscoApIcon,
    load_balancer: CiscoLoadBalancerIcon,

    // Security
    firewall: CiscoFirewallIcon,
    waf: CiscoWafIcon,
    vpn_concentrator: CiscoVpnIcon,
    ids_ips: CiscoIdsIpsIcon,
    siem: CiscoSiemIcon,
    ca: CiscoCaIcon,
    bastion: CiscoBastionIcon,

    // Servers & infrastructure
    server: CiscoServerIcon,
    web_server: CiscoWebServerIcon,
    app_server: CiscoAppServerIcon,
    dns_server: CiscoDnsServerIcon,
    dhcp_server: CiscoDhcpServerIcon,
    mainframe: CiscoMainframeIcon,
    container: CiscoContainerIcon,
    vm: CiscoVmIcon,
    database: CiscoDatabaseIcon,

    // Storage
    storage: CiscoStorageIcon,
    nas: CiscoNasIcon,
    san: CiscoSanIcon,
    backup: CiscoBackupIcon,

    // End-user / IoT
    laptop: CiscoLaptopIcon,
    mobile_phone: CiscoMobilePhoneIcon,
    ip_phone: CiscoIpPhoneIcon,
    printer: CiscoPrinterIcon,
    camera: CiscoCameraIcon,
    iot_sensor: CiscoIotSensorIcon,

    // Edge / cloud
    cloud: CiscoCloudIcon,
    internet: CiscoInternetIcon,
    // Build 115.2 — "users" archetype. Most common operator ask
    // from the OOB Splunk Cloud review.
    users: CiscoUsersIcon,

    // Places
    branch_office: CiscoBranchOfficeIcon,
    datacenter: CiscoDatacenterIcon,

    generic: CiscoGenericIcon,
} as const;

export type CiscoIconId = keyof typeof CISCO_ICONS;
