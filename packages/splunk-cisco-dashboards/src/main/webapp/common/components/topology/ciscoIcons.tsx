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
 * Why we use BOTH lucide-react and local Splunk SVA-style SVGs:
 *   • Lucide remains the best fit for generic Cisco / network
 *     metaphors like Router, RadioTower, Wifi, and Firewall.
 *   • Build 1182 draws Splunk-platform shapes locally so they
 *     resemble the icons used in Splunk Validated Architecture
 *     diagrams (Search Head, Indexer, Forwarder, SC4S, etc.).
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

// Build 1182 — SVA-style load balancer. The Splunk docs draw a
// simple square service icon with inputs fanning into a backend
// pool, not a physical rack appliance. Keep it stroke-based and
// compact so the node card reads like a logical L7/VIP service.
const LoadBalancerSVG: React.FC<IconProps> = ({ className, title }) => (
    <svg
        viewBox="0 0 24 24"
        className={cn(COLOR.ROSE, className)}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-label={title ?? 'Load balancer'}
        role="img"
    >
        {title ? <title>{title}</title> : null}
        <circle cx={6} cy={4} r={1.2} fill="currentColor" stroke="none" />
        <circle cx={12} cy={4} r={1.2} fill="currentColor" stroke="none" />
        <circle cx={18} cy={4} r={1.2} fill="currentColor" stroke="none" />
        <path d="M6 5.5 L9 9" />
        <path d="M12 5.5 V8.6" />
        <path d="M18 5.5 L15 9" />
        <rect x={6.5} y={9} width={11} height={11} rx={1.4} />
        <rect x={8.8} y={11.2} width={2.3} height={2.3} rx={0.2} fill="currentColor" stroke="none" opacity={0.75} />
        <rect x={12.9} y={11.2} width={2.3} height={2.3} rx={0.2} fill="currentColor" stroke="none" opacity={0.75} />
        <path d="M12 14.7 v2.8" />
        <path d="M9.6 17.5 h4.8" />
        <path d="M9.6 17.5 l-1.8 1.6" />
        <path d="M14.4 17.5 l1.8 1.6" />
    </svg>
);
LoadBalancerSVG.displayName = 'DeviceIcon(LoadBalancer)';
export const CiscoLoadBalancerIcon = LoadBalancerSVG;

const F5LoadBalancerSVG: React.FC<IconProps> = ({ className, title }) => (
    <svg
        viewBox="0 0 64 64"
        className={cn(COLOR.RED, className)}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-label={title ?? 'F5 load balancer'}
        role="img"
    >
        {title ? <title>{title}</title> : null}
        <rect x={13} y={16} width={38} height={28} rx={5} fill="white" fillOpacity={0.2} />
        <text
            x={32}
            y={35}
            textAnchor="middle"
            fontSize={16}
            fontWeight={800}
            fill="currentColor"
            stroke="none"
        >
            F5
        </text>
        <circle cx={32} cy={8} r={2.4} fill="currentColor" stroke="none" />
        <circle cx={17} cy={55} r={2.4} fill="currentColor" stroke="none" />
        <circle cx={32} cy={55} r={2.4} fill="currentColor" stroke="none" />
        <circle cx={47} cy={55} r={2.4} fill="currentColor" stroke="none" />
        <path d="M32 10.5 V16" />
        <path d="M24 44 L17 52.5" />
        <path d="M32 44 V52.5" />
        <path d="M40 44 L47 52.5" />
    </svg>
);
F5LoadBalancerSVG.displayName = 'DeviceIcon(F5LoadBalancer)';
export const CiscoF5LoadBalancerIcon = F5LoadBalancerSVG;

const ModularChassisSVG: React.FC<IconProps> = ({ className, title }) => (
    <svg
        viewBox="0 0 64 64"
        className={cn(COLOR.INDIGO, className)}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-label={title ?? 'Modular chassis switch'}
        role="img"
    >
        {title ? <title>{title}</title> : null}
        <rect x={10} y={8} width={44} height={48} rx={3} fill="white" fillOpacity={0.18} />
        <path d="M10 20 H54" />
        <path d="M10 32 H54" />
        <path d="M10 44 H54" />
        <path d="M22 8 V56" />
        <path d="M36 8 V56" />
        <rect x={14} y={24} width={4} height={4} rx={0.6} fill="currentColor" stroke="none" />
        <rect x={28} y={24} width={4} height={4} rx={0.6} fill="currentColor" stroke="none" />
        <rect x={42} y={24} width={4} height={4} rx={0.6} fill="currentColor" stroke="none" />
        <path d="M15 49 H49" />
        <circle cx={49} cy={14} r={1.6} fill="currentColor" stroke="none" />
    </svg>
);
ModularChassisSVG.displayName = 'DeviceIcon(ModularChassisSwitch)';
export const CiscoModularChassisIcon = ModularChassisSVG;

const NexusAciFabricSVG: React.FC<IconProps> = ({ className, title }) => (
    <svg
        viewBox="0 0 64 64"
        className={cn(COLOR.BLUE, className)}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-label={title ?? 'Nexus ACI fabric'}
        role="img"
    >
        {title ? <title>{title}</title> : null}
        <polygon points="32,8 50,19 50,41 32,52 14,41 14,19" />
        <circle cx={32} cy={18} r={3} fill="currentColor" stroke="none" />
        <circle cx={22} cy={38} r={3} fill="currentColor" stroke="none" />
        <circle cx={42} cy={38} r={3} fill="currentColor" stroke="none" />
        <path d="M32 21 V30" />
        <path d="M30 32 L24 36" />
        <path d="M34 32 L40 36" />
        <rect x={25} y={27} width={14} height={9} rx={1.8} />
    </svg>
);
NexusAciFabricSVG.displayName = 'DeviceIcon(NexusAciFabric)';
export const CiscoNexusAciFabricIcon = NexusAciFabricSVG;

const SdwanControllerSVG: React.FC<IconProps> = ({ className, title }) => (
    <svg
        viewBox="0 0 64 64"
        className={cn(COLOR.SKY, className)}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-label={title ?? 'SD-WAN controller'}
        role="img"
    >
        {title ? <title>{title}</title> : null}
        <path d="M20 38 Q10 38 10 30 Q10 22 20 22 Q23 12 34 12 Q44 12 48 22 Q56 23 56 31 Q56 38 47 38 Z" />
        <rect x={20} y={43} width={24} height={12} rx={2} />
        <path d="M26 49 H38" />
        <circle cx={22} cy={29} r={2.5} fill="currentColor" stroke="none" />
        <circle cx={33} cy={24} r={2.5} fill="currentColor" stroke="none" />
        <circle cx={44} cy={30} r={2.5} fill="currentColor" stroke="none" />
        <path d="M24 28 L31 25" />
        <path d="M35 25 L42 29" />
    </svg>
);
SdwanControllerSVG.displayName = 'DeviceIcon(SdwanController)';
export const CiscoSdwanControllerIcon = SdwanControllerSVG;

// Security
export const CiscoFirewallIcon = wrap(Shield, COLOR.ROSE);
const PaloAltoFirewallSVG: React.FC<IconProps> = ({ className, title }) => (
    <svg
        viewBox="0 0 64 64"
        className={cn(COLOR.ROSE, className)}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-label={title ?? 'Palo Alto firewall'}
        role="img"
    >
        {title ? <title>{title}</title> : null}
        <path d="M32 8 L49 15 V30 Q49 45 32 56 Q15 45 15 30 V15 Z" fill="white" fillOpacity={0.18} />
        <text
            x={32}
            y={35}
            textAnchor="middle"
            fontSize={14}
            fontWeight={800}
            fill="currentColor"
            stroke="none"
        >
            PA
        </text>
    </svg>
);
PaloAltoFirewallSVG.displayName = 'DeviceIcon(PaloAltoFirewall)';
export const CiscoPaloAltoFirewallIcon = PaloAltoFirewallSVG;

const FortinetFirewallSVG: React.FC<IconProps> = ({ className, title }) => (
    <svg
        viewBox="0 0 64 64"
        className={cn(COLOR.RED, className)}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-label={title ?? 'Fortinet firewall'}
        role="img"
    >
        {title ? <title>{title}</title> : null}
        <path d="M32 8 L49 15 V30 Q49 45 32 56 Q15 45 15 30 V15 Z" fill="white" fillOpacity={0.18} />
        <text
            x={32}
            y={35}
            textAnchor="middle"
            fontSize={14}
            fontWeight={800}
            fill="currentColor"
            stroke="none"
        >
            FG
        </text>
    </svg>
);
FortinetFirewallSVG.displayName = 'DeviceIcon(FortinetFirewall)';
export const CiscoFortinetFirewallIcon = FortinetFirewallSVG;
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

// Splunk platform
const SvaDocument: React.FC<{
    children?: React.ReactNode;
    className?: string;
    stacked?: boolean;
    title?: string;
}> = ({ children, className, stacked = false, title }) => (
    <svg
        viewBox="0 0 64 64"
        className={cn(COLOR.SLATE, className)}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-label={title ?? 'Splunk architecture icon'}
        role="img"
    >
        {title ? <title>{title}</title> : null}
        {stacked ? (
            <>
                <rect x={20} y={12} width={30} height={38} rx={3} opacity={0.45} />
                <rect x={15} y={17} width={30} height={38} rx={3} opacity={0.7} />
            </>
        ) : null}
        <rect x={10} y={8} width={34} height={44} rx={3} fill="white" fillOpacity={0.2} />
        <circle cx={15} cy={48} r={1.1} fill="currentColor" stroke="none" opacity={0.65} />
        {children}
    </svg>
);

export const SplunkSearchHeadIcon: React.FC<IconProps> = ({ className, title }) => (
    <SvaDocument className={className} title={title ?? 'Splunk Search Head'}>
        <circle cx={24} cy={25} r={7} />
        <path d="M29 30 L36 37" />
        <path d="M16 37 H37" />
        <path d="M16 42 H33" />
        <path d="M17 20 H14" />
        <path d="M17 27 H14" />
        <path d="M32 20 H38" />
        <path d="M35 25 H40" />
    </SvaDocument>
);
SplunkSearchHeadIcon.displayName = 'DeviceIcon(SplunkSearchHead)';

export const SplunkSearchHeadClusterIcon: React.FC<IconProps> = ({
    className,
    title,
}) => (
    <SvaDocument
        className={className}
        stacked
        title={title ?? 'Splunk Search Head Cluster'}
    >
        <circle cx={23} cy={25} r={6} />
        <path d="M27.5 29.5 L34 36" />
        <path d="M16 39 H36" />
        <path d="M16 43 H31" />
    </SvaDocument>
);
SplunkSearchHeadClusterIcon.displayName =
    'DeviceIcon(SplunkSearchHeadCluster)';

const IndexerGlyph: React.FC = () => (
    <>
        <path d="M21 18 L34 23.5 V38.5 L21 44 L8 38.5 V23.5 Z" />
        <path d="M8 23.5 L21 29 L34 23.5" />
        <path d="M21 29 V44" />
        <path d="M14 34 H19" />
        <path d="M23 34 H28" />
        <path d="M14 38 H19" />
        <path d="M23 38 H28" />
    </>
);

export const SplunkIndexerIcon: React.FC<IconProps> = ({ className, title }) => (
    <SvaDocument className={cn(COLOR.SLATE, className)} title={title ?? 'Splunk Indexer'}>
        <IndexerGlyph />
    </SvaDocument>
);
SplunkIndexerIcon.displayName = 'DeviceIcon(SplunkIndexer)';

export const SplunkIndexerClusterIcon: React.FC<IconProps> = ({
    className,
    title,
}) => (
    <SvaDocument
        className={cn(COLOR.SLATE, className)}
        stacked
        title={title ?? 'Splunk Indexer Cluster'}
    >
        <IndexerGlyph />
    </SvaDocument>
);
SplunkIndexerClusterIcon.displayName = 'DeviceIcon(SplunkIndexerCluster)';

const ForwarderGlyph: React.FC<{ heavy?: boolean }> = ({ heavy = false }) => (
    <>
        <path d="M16 20 H30" />
        <path d="M16 27 H35" />
        <path d="M16 34 H31" />
        <path d="M30 18 L39 27 L30 36" strokeWidth={heavy ? 3.2 : 2.4} />
        {heavy ? <path d="M21 41 H36" /> : null}
    </>
);

export const SplunkHeavyForwarderIcon: React.FC<IconProps> = ({
    className,
    title,
}) => (
    <SvaDocument className={className} title={title ?? 'Splunk Heavy Forwarder'}>
        <ForwarderGlyph heavy />
    </SvaDocument>
);
SplunkHeavyForwarderIcon.displayName = 'DeviceIcon(SplunkHeavyForwarder)';

export const SplunkUniversalForwarderIcon: React.FC<IconProps> = ({
    className,
    title,
}) => (
    <SvaDocument
        className={className}
        title={title ?? 'Splunk Universal Forwarder'}
    >
        <ForwarderGlyph />
    </SvaDocument>
);
SplunkUniversalForwarderIcon.displayName =
    'DeviceIcon(SplunkUniversalForwarder)';

export const SplunkClusterManagerIcon: React.FC<IconProps> = ({
    className,
    title,
}) => (
    <SvaDocument className={className} title={title ?? 'Splunk Cluster Manager'}>
        <path d="M18 21 H36" />
        <circle cx={24} cy={21} r={2.3} fill="currentColor" stroke="none" />
        <path d="M18 31 H36" />
        <circle cx={31} cy={31} r={2.3} fill="currentColor" stroke="none" />
        <path d="M18 41 H36" />
        <circle cx={22} cy={41} r={2.3} fill="currentColor" stroke="none" />
    </SvaDocument>
);
SplunkClusterManagerIcon.displayName = 'DeviceIcon(SplunkClusterManager)';

export const SplunkDeployerIcon: React.FC<IconProps> = ({ className, title }) => (
    <SvaDocument className={className} title={title ?? 'Splunk Deployer'}>
        <rect x={20} y={18} width={14} height={10} rx={1.5} />
        <path d="M27 28 V36" />
        <path d="M16 43 L27 36 L38 43" />
        <circle cx={16} cy={43} r={3} />
        <circle cx={27} cy={36} r={3} />
        <circle cx={38} cy={43} r={3} />
    </SvaDocument>
);
SplunkDeployerIcon.displayName = 'DeviceIcon(SplunkDeployer)';

export const SplunkLicenseManagerIcon: React.FC<IconProps> = ({
    className,
    title,
}) => (
    <SvaDocument className={className} title={title ?? 'Splunk License Manager'}>
        <rect x={17} y={18} width={20} height={14} rx={2} />
        <path d="M21 25 H31" />
        <path d="M22 39 L27 43 L37 34" />
    </SvaDocument>
);
SplunkLicenseManagerIcon.displayName = 'DeviceIcon(SplunkLicenseManager)';

export const SplunkMonitoringConsoleIcon: React.FC<IconProps> = ({
    className,
    title,
}) => (
    <svg
        viewBox="0 0 64 64"
        className={cn(COLOR.SLATE, className)}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-label={title ?? 'Splunk Monitoring Console'}
        role="img"
    >
        {title ? <title>{title}</title> : null}
        <rect x={12} y={14} width={40} height={28} rx={3} fill="white" fillOpacity={0.2} />
        <path d="M28 48 H36" />
        <path d="M32 42 V48" />
        <rect x={20} y={26} width={4} height={8} rx={0.8} fill="currentColor" stroke="none" />
        <rect x={30} y={22} width={4} height={12} rx={0.8} fill="currentColor" stroke="none" />
        <rect x={40} y={18} width={4} height={16} rx={0.8} fill="currentColor" stroke="none" />
    </svg>
);
SplunkMonitoringConsoleIcon.displayName =
    'DeviceIcon(SplunkMonitoringConsole)';

export const SplunkDeploymentServerIcon: React.FC<IconProps> = ({
    className,
    title,
}) => (
    <SvaDocument
        className={className}
        title={title ?? 'Splunk Deployment Server'}
    >
        <path d="M18 20 H30" />
        <path d="M18 42 H30" />
        <path d="M30 20 L39 31 L30 42" />
        <circle cx={39} cy={31} r={3} />
        <circle cx={18} cy={20} r={2.4} fill="currentColor" stroke="none" />
        <circle cx={18} cy={42} r={2.4} fill="currentColor" stroke="none" />
    </SvaDocument>
);
SplunkDeploymentServerIcon.displayName = 'DeviceIcon(SplunkDeploymentServer)';

export const SplunkDataCollectionIcon: React.FC<IconProps> = ({
    className,
    title,
}) => (
    <SvaDocument
        className={cn(COLOR.ROSE, className)}
        title={title ?? 'Splunk Data Collection'}
    >
        <path d="M20 17 V35" />
        <path d="M20 35 H34" />
        <path d="M34 35 L29 30" />
        <path d="M34 35 L29 40" />
        <path d="M16 22 H28" />
        <path d="M16 28 H31" />
        <path d="M16 42 H26" />
    </SvaDocument>
);
SplunkDataCollectionIcon.displayName = 'DeviceIcon(SplunkDataCollection)';

export const SplunkEdgeProcessorIcon: React.FC<IconProps> = ({
    className,
    title,
}) => (
    <svg
        viewBox="0 0 64 64"
        className={cn(COLOR.SLATE, className)}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-label={title ?? 'Splunk Edge Processor'}
        role="img"
    >
        {title ? <title>{title}</title> : null}
        <path d="M20 42 Q10 42 10 34 Q10 26 19 26 Q21 16 33 16 Q43 16 47 26 Q55 27 55 35 Q55 42 46 42 Z" />
        <circle cx={24} cy={34} r={3} />
        <circle cx={34} cy={28} r={3} />
        <circle cx={43} cy={35} r={3} />
        <path d="M27 33 L31 29" />
        <path d="M37 29 L41 34" />
    </svg>
);
SplunkEdgeProcessorIcon.displayName = 'DeviceIcon(SplunkEdgeProcessor)';

export const SplunkSc4sIcon: React.FC<IconProps> = ({ className, title }) => (
    <svg
        viewBox="0 0 64 64"
        className={cn(COLOR.SLATE, className)}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-label={title ?? 'Splunk Connect for Syslog'}
        role="img"
    >
        {title ? <title>{title}</title> : null}
        <rect x={10} y={12} width={38} height={34} rx={3} fill="white" fillOpacity={0.2} />
        <path d="M10 26 H48" />
        <text
            x={29}
            y={22}
            textAnchor="middle"
            fontSize={9}
            fontWeight={700}
            fill="currentColor"
            stroke="none"
        >
            SC4S
        </text>
        <path d="M18 37 H38" />
        <circle cx={49} cy={45} r={9} fill="white" stroke="currentColor" />
        <path d="M45 49 Q49 42 53 49" />
        <path d="M45 44 Q49 39 53 44" />
        <circle cx={46.5} cy={45} r={1} fill="currentColor" stroke="none" />
        <circle cx={51.5} cy={45} r={1} fill="currentColor" stroke="none" />
    </svg>
);
SplunkSc4sIcon.displayName = 'DeviceIcon(SplunkSc4s)';

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
    f5_load_balancer: CiscoF5LoadBalancerIcon,
    modular_chassis_switch: CiscoModularChassisIcon,
    nexus_aci_fabric: CiscoNexusAciFabricIcon,
    sdwan_controller: CiscoSdwanControllerIcon,

    // Security
    firewall: CiscoFirewallIcon,
    palo_alto_firewall: CiscoPaloAltoFirewallIcon,
    fortinet_firewall: CiscoFortinetFirewallIcon,
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

    // Splunk platform
    splunk_search_head: SplunkSearchHeadIcon,
    splunk_search_head_cluster: SplunkSearchHeadClusterIcon,
    splunk_indexer: SplunkIndexerIcon,
    splunk_indexer_cluster: SplunkIndexerClusterIcon,
    splunk_heavy_forwarder: SplunkHeavyForwarderIcon,
    splunk_universal_forwarder: SplunkUniversalForwarderIcon,
    splunk_cluster_manager: SplunkClusterManagerIcon,
    splunk_deployer: SplunkDeployerIcon,
    splunk_license_manager: SplunkLicenseManagerIcon,
    splunk_monitoring_console: SplunkMonitoringConsoleIcon,
    splunk_deployment_server: SplunkDeploymentServerIcon,
    splunk_data_collection: SplunkDataCollectionIcon,
    splunk_edge_processor: SplunkEdgeProcessorIcon,
    splunk_sc4s: SplunkSc4sIcon,

    // Places
    branch_office: CiscoBranchOfficeIcon,
    datacenter: CiscoDatacenterIcon,

    generic: CiscoGenericIcon,
} as const;

export type CiscoIconId = keyof typeof CISCO_ICONS;
