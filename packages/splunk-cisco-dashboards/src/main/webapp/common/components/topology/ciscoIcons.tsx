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
    Layers,
    Shield,
    Wifi,
    Database,
    Cloud,
    Users,
    SquareArrowRight,
    ShieldAlert,
    Globe,
    Settings2,
    MonitorSmartphone,
    Container,
    Printer,
    Activity,
    LineChart,
    BadgeCheck,
    Lock,
} from '@/common/icons/SuiIcon';
import {
    Router,
    Network,
    Boxes,
    KeyRound,
    Radar,
    RadioTower,
    Server,
    HardDrive,
    Phone,
    Globe2,
    Box,
    Cable,
    Waypoints,
    Code2,
    Cpu,
    Server as MainframeServer,
    HardDriveDownload,
    Laptop,
    Smartphone,
    Camera,
    Building2,
    Warehouse,
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

const ciscoLineIcon = (
    displayName: string,
    fallbackTitle: string,
    defaultColor: string,
    body: React.ReactNode,
    viewBox = '0 0 80 80'
): React.FC<IconProps> => {
    const Wrapped: React.FC<IconProps> = ({ className, title }) => (
        <svg
            viewBox={viewBox}
            className={cn(defaultColor, className)}
            fill="currentColor"
            aria-label={title ?? fallbackTitle}
            role="img"
        >
            {title ? <title>{title}</title> : null}
            {body}
        </svg>
    );
    Wrapped.displayName = `DeviceIcon(${displayName})`;
    return Wrapped;
};

// --- Device class → icon component mapping --------------------------

// Core network
export const CiscoRouterIcon = ciscoLineIcon(
    'CiscoRouter',
    'Cisco router',
    COLOR.AMBER,
    <>
        <path d="M10,56.75h60c.41406,0,.75-.33594,.75-.75v-16c0-.41406-.33594-.75-.75-.75H24.75V18h-1.5v21.25h-4.5v-15.25h-1.5v15.25h-7.25c-.41406,0-.75,.33594-.75,.75v16c0,.41406,.33594,.75,.75,.75Zm.75-16h58.5v14.5H10.75v-14.5Z" />
        <rect x={23.25} y={48} width={1.5} height={4} />
        <rect x={17.25} y={50} width={1.5} height={2} />
        <rect x={29.25} y={46} width={1.5} height={6} />
        <rect x={35.25} y={44} width={1.5} height={8} />
        <circle cx={50} cy={48} r={1} />
        <circle cx={56} cy={48} r={1} />
        <circle cx={62} cy={48} r={1} />
    </>
);

export const CiscoL2SwitchIcon = ciscoLineIcon(
    'CiscoL2Switch',
    'Cisco switch',
    COLOR.SKY,
    <>
        <rect x={34} y={39.25} width={30} height={1.5} />
        <path d="M10,48.75h60c.41406,0,.75-.33594,.75-.75v-16c0-.41406-.33594-.75-.75-.75H10c-.41406,0-.75,.33594-.75,.75v16c0,.41406,.33594,.75,.75,.75Zm.75-16h58.5v14.5H10.75v-14.5Z" />
        <circle cx={16} cy={40} r={1} />
        <circle cx={22} cy={40} r={1} />
        <circle cx={28} cy={40} r={1} />
    </>
);

export const CiscoL3SwitchIcon = ciscoLineIcon(
    'CiscoL3Switch',
    'Cisco layer 3 switch',
    COLOR.INDIGO,
    <>
        <path d="M40.75,24V11.81055l2.71973,2.71973,1.06055-1.06055-4-4c-.29297-.29297-.76758-.29297-1.06055,0l-4,4,1.06055,1.06055,2.71973-2.71973v12.18945h1.5Z" />
        <path d="M39.25,56v12.18945l-2.71973-2.71973-1.06055,1.06055,4,4c.14648,.14648,.33789,.21973,.53027,.21973s.38379-.07324,.53027-.21973l4-4-1.06055-1.06055-2.71973,2.71973v-12.18945h-1.5Z" />
        <path d="M13.46973,44.53027l1.06055-1.06055-2.71973-2.71973h10.18945v-1.5H11.81055l2.71973-2.71973-1.06055-1.06055-4,4c-.29297,.29297-.29297,.76758,0,1.06055l4,4Z" />
        <path d="M66.53027,44.53027l4-4c.29297-.29297,.29297-.76758,0-1.06055l-4-4-1.06055,1.06055,2.71973,2.71973h-10.18945v1.5h10.18945l-2.71973,2.71973,1.06055,1.06055Z" />
        <path d="M25.25,34v12c0,.41406,.33594,.75,.75,.75h28c.41406,0,.75-.33594,.75-.75v-12c0-.41406-.33594-.75-.75-.75H26c-.41406,0-.75,.33594-.75,.75Zm1.5,.75h26.5v10.5H26.75v-10.5Z" />
        <path d="M41.43359,39.79199c.09863-.07324,.18945-.15674,.27051-.25049,.25879-.29102,.39062-.63525,.39062-1.02295,0-.5293-.19922-.95752-.59277-1.27344-.3916-.31201-.90039-.47021-1.51074-.47021-.55273,0-1.0332,.13184-1.42578,.3916-.46777,.30566-.74902,.73926-.83691,1.28857-.01172,.07227,.00977,.14551,.05664,.20117,.04785,.05566,.11719,.08789,.19043,.08789h.82422c.12207,0,.22656-.08838,.24707-.20898,.02734-.16797,.10547-.30273,.23438-.4082,.16895-.13428,.38867-.19922,.66992-.19922,.23047,0,.41895,.04834,.57227,.146,.18555,.12256,.27148,.28174,.27148,.50195,0,.21826-.06543,.38574-.20117,.51465-.13281,.12793-.29492,.19043-.49609,.19043h-.45703c-.1377,0-.25,.11182-.25,.25v.67725c0,.13818,.1123,.25,.25,.25h.47363c.22656,0,.41406,.05469,.57129,.16455,.20801,.1499,.30469,.36035,.30469,.6626,0,.21973-.06836,.39355-.20898,.53125-.17773,.17188-.43262,.25537-.78125,.25537-.55762,0-.85449-.21191-.96484-.6875-.02539-.11328-.12695-.19385-.24316-.19385h-.83203c-.07227,0-.14062,.03125-.18848,.08545-.04785,.05469-.06934,.12695-.05957,.19824,.06836,.49707,.28711,.9043,.64648,1.20801,.41504,.36035,.97266,.54297,1.65723,.54297,.61816,0,1.13867-.15381,1.54688-.4585,.48242-.36328,.72754-.85645,.72754-1.46484,0-.43359-.12891-.80859-.38477-1.11572-.13379-.15967-.29199-.29102-.47168-.39404Z" />
        <path d="M58.68262,32.43408c4.05371-6.05273,4.64062-10.17188,1.84766-12.96436-2.7627-2.76367-7.0332-2.13965-13.05469,1.90771l.83789,1.24512c7.09961-4.77393,9.76758-3.48047,11.15625-2.09229,1.38281,1.3833,2.67773,4.03516-2.0332,11.06885l1.24609,.83496Z" />
        <path d="M21.30078,47.58252c-4.04199,6.04102-4.62402,10.15527-1.83105,12.94775,1.15039,1.1499,2.52344,1.72754,4.16309,1.72754,2.34375,0,5.23047-1.18066,8.78418-3.55811l-.83398-1.24707c-7.01758,4.69629-9.66895,3.40039-11.05273,2.01709s-2.67969-4.03369,2.0166-11.05322l-1.24609-.83398Z" />
        <path d="M19.46973,19.46973c-2.79785,2.79688-2.19141,6.94043,1.9082,13.04004l1.24414-.83691c-4.76855-7.09473-3.47754-9.75732-2.0918-11.14258,1.38672-1.38623,4.04395-2.68506,11.06934,2.01855l.83398-1.24609c-5.96387-3.99219-10.2041-4.59375-12.96387-1.83301Z" />
        <path d="M57.45312,48.40186c4.70312,7.02588,3.40332,9.68164,2.0166,11.06787-1.37988,1.37939-4.0293,2.67041-11.05273-2.03125l-.83398,1.24609c3.56055,2.38428,6.45117,3.56738,8.7959,3.56689,1.63574,0,3.00586-.57568,4.15137-1.72119,2.75977-2.75928,2.16113-6.99902-1.83105-12.9624l-1.24609,.83398Z" />
    </>
);

export const CiscoStackIcon = ciscoLineIcon(
    'CiscoStack',
    'Cisco switch stack',
    COLOR.BLUE,
    <path d="M9.49414,68.75h61.01172c.41406,0,.75-.33594,.75-.75V12c0-.41406-.33594-.75-.75-.75H9.49414c-.41406,0-.75,.33594-.75,.75v56c0,.41406,.33594,.75,.75,.75ZM41.1123,12.75h28.64355v12.5h-28.64355V12.75Zm0,14h28.64355v12.5h-28.64355v-12.5Zm0,14h28.64355v12.5h-28.64355v-12.5Zm0,14h28.64355v12.5h-28.64355v-12.5ZM10.24414,12.75h29.36816v12.5H10.24414V12.75Zm0,14h29.36816v12.5H10.24414v-12.5Zm0,14h29.36816v12.5H10.24414v-12.5Zm0,14h29.36816v12.5H10.24414v-12.5Z" />
);

export const CiscoWlcIcon = ciscoLineIcon(
    'CiscoWlc',
    'Cisco wireless controller',
    COLOR.VIOLET,
    <>
        <path d="M9.25,65.87256c0,.41406,.33594,.75,.75,.75h60c.41406,0,.75-.33594,.75-.75v-16c0-.41406-.33594-.75-.75-.75h-29.25V29.87256h-1.5v19.25H10c-.41406,0-.75,.33594-.75,.75v16Zm1.5-15.25h58.5v14.5H10.75v-14.5Z" />
        <rect x={34} y={57.12256} width={30} height={1.5} />
        <circle cx={16} cy={57.97876} r={1} />
        <circle cx={22} cy={57.97876} r={1} />
        <circle cx={28} cy={57.97876} r={1} />
        <circle cx={40} cy={23.97876} r={1} />
        <path d="M28.8623,12.0874l-1.02539-1.09473c-3.57812,3.35303-5.62988,8.08643-5.62988,12.98584,0,4.81738,1.89453,9.32861,5.33398,12.70264l1.05078-1.07129c-3.15039-3.08936-4.88477-7.22021-4.88477-11.63135,0-4.55273,1.83105-8.77539,5.15527-11.89111Z" />
        <path d="M57.79297,23.97852c0-4.88867-1.94238-9.44629-5.46973-12.83398l-1.03906,1.08203c3.22949,3.10205,5.00879,7.27539,5.00879,11.75195,0,4.35107-1.69531,8.44287-4.77246,11.521l1.06055,1.06055c3.36133-3.36133,5.21191-7.82959,5.21191-12.58154Z" />
        <path d="M35.66797,20.31152c-.86621,1.02344-1.34375,2.32568-1.34375,3.66699,0,1.22217,.38281,2.38721,1.10645,3.36719,.10352,.14062,.21387,.27588,.33008,.40625l1.12109-.99609c-.08496-.09619-.16602-.19531-.24316-.2998-.5332-.72168-.81445-1.57812-.81445-2.47754,0-.98682,.35059-1.94482,.98828-2.69824l-1.14453-.96875Z" />
        <path d="M43.12598,26.74707l1.12305,.99512c.10938-.12354,.21289-.25146,.31055-.38281,.73047-.98389,1.11621-2.15283,1.11621-3.38086,0-1.17432-.35547-2.30127-1.02734-3.25684-.10254-.14746-.21387-.29004-.33203-.42773l-1.13867,.97559c.08496,.09961,.16504,.20312,.24219,.3125,.49414,.7041,.75586,1.53271,.75586,2.39648,0,.90332-.28418,1.76318-.82129,2.4873-.07227,.09717-.14844,.19092-.22852,.28125Z" />
        <path d="M31.33496,31.64551l1.11914-.99805c-.20605-.23145-.40137-.47217-.58594-.72217-1.28809-1.74414-1.96875-3.81689-1.96875-5.99365,0-2.38965,.84863-4.70703,2.39062-6.52637l-1.14453-.96973c-1.77051,2.08984-2.74609,4.75195-2.74609,7.49609,0,2.5,.78223,4.88037,2.26172,6.88428,.21191,.28711,.43652,.56396,.67383,.82959Z" />
        <path d="M47.56152,30.62988l1.12305,.99316c.22266-.25146,.43555-.51221,.63574-.78223,1.49121-2.00977,2.28027-4.39893,2.28027-6.90918,0-2.40039-.72656-4.70312-2.10059-6.66016-.21094-.30029-.43652-.58984-.67285-.86816l-1.14258,.97168c.20703,.24316,.40332,.49561,.58789,.7583,1.19629,1.70312,1.82812,3.7085,1.82812,5.79834,0,2.18555-.68652,4.26562-1.98535,6.01562-.1748,.23584-.36035,.46338-.55371,.68262Z" />
    </>
);

export const CiscoApIcon = ciscoLineIcon(
    'CiscoAccessPoint',
    'Cisco access point',
    COLOR.FUCHSIA,
    <>
        <path d="M40,18.75c11.13672,0,21.60596,4.18701,29.479,11.78955l1.04199-1.0791c-8.1543-7.87402-18.99316-12.21045-30.521-12.21045s-22.3667,4.33643-30.521,12.21045l1.04199,1.0791c7.87305-7.60254,18.34229-11.78955,29.479-11.78955Z" />
        <path d="M60.521,39.46045c-5.48291-5.29443-12.77051-8.21045-20.521-8.21045s-15.03809,2.91602-20.521,8.21045l1.04199,1.0791c5.20166-5.02295,12.11963-7.78955,19.479-7.78955s14.27734,2.7666,19.479,7.78955l1.04199-1.0791Z" />
        <path d="M50.521,49.46045c-2.81152-2.71533-6.54834-4.21045-10.521-4.21045s-7.70947,1.49512-10.521,4.21045l1.04199,1.0791c2.53076-2.44385,5.89697-3.78955,9.479-3.78955s6.94824,1.3457,9.479,3.78955l1.04199-1.0791Z" />
        <path d="M37.25,60c0,1.5166,1.2334,2.75,2.75,2.75s2.75-1.2334,2.75-2.75-1.2334-2.75-2.75-2.75-2.75,1.2334-2.75,2.75Zm4,0c0,.68945-.56055,1.25-1.25,1.25s-1.25-.56055-1.25-1.25,.56055-1.25,1.25-1.25,1.25,.56055,1.25,1.25Z" />
    </>
);

const StandardRouterIcon = wrap(Router, COLOR.AMBER);
const StandardL2SwitchIcon = wrap(Network, COLOR.SKY);
const StandardL3SwitchIcon = wrap(Boxes, COLOR.INDIGO);
const StandardStackIcon = wrap(Layers, COLOR.BLUE);
const StandardWlcIcon = wrap(RadioTower, COLOR.VIOLET);
const StandardApIcon = wrap(Wifi, COLOR.FUCHSIA);

export const CiscoOfficialFirewallIcon = ciscoLineIcon(
    'CiscoOfficialFirewall',
    'Cisco firewall',
    COLOR.ROSE,
    <path d="M13.46973,44.53027l1.06055-1.06055-2.71973-2.71973H31.25v14.5H10v1.5H31.25v13.25c0,.41406,.33594,.75,.75,.75h16c.41406,0,.75-.33594,.75-.75v-13.25h19.43945l-2.71973,2.71973,1.06055,1.06055,4-4c.29297-.29297,.29297-.76758,0-1.06055l-4-4-1.06055,1.06055,2.71973,2.71973h-19.43945v-14.5h21.25v-1.5h-21.25v-14.5h19.43945l-2.71973,2.71973,1.06055,1.06055,4-4c.29297-.29297,.29297-.76758,0-1.06055l-4-4-1.06055,1.06055,2.71973,2.71973h-19.43945V10c0-.41406-.33594-.75-.75-.75h-16c-.41406,0-.75,.33594-.75,.75v13.25H10v1.5H31.25v14.5H11.81055l2.71973-2.71973-1.06055-1.06055-4,4c-.29297,.29297-.29297,.76758,0,1.06055l4,4ZM32.75,10.75h14.5v12.5h-7.25v1.5h7.25v14.5h-7.25v1.5h7.25v14.5h-7.25v1.5h7.25v12.5h-14.5V10.75Z" />
);

export const CiscoOfficialServerIcon = ciscoLineIcon(
    'CiscoOfficialServer',
    'Cisco server',
    COLOR.EMERALD,
    <>
        <rect x={34} y={39.25} width={30} height={1.5} />
        <rect x={34} y={55.25} width={30} height={1.5} />
        <path d="M10,64.75h60c.41406,0,.75-.33594,.75-.75V16c0-.41406-.33594-.75-.75-.75H10c-.41406,0-.75,.33594-.75,.75v48c0,.41406,.33594,.75,.75,.75Zm.75-48h58.5v14.5H10.75v-14.5Zm0,16h58.5v14.5H10.75v-14.5Zm0,16h58.5v14.5H10.75v-14.5Z" />
        <rect x={34} y={23.25} width={30} height={1.5} />
        <circle cx={16.01294} cy={24} r={1} />
        <circle cx={22} cy={24} r={1} />
        <circle cx={28} cy={24} r={1} />
        <circle cx={16.01294} cy={40} r={1} />
        <circle cx={22} cy={40} r={1} />
        <circle cx={28} cy={40} r={1} />
        <circle cx={16.01294} cy={56} r={1} />
        <circle cx={22} cy={56} r={1} />
        <circle cx={28} cy={56} r={1} />
    </>
);

export const CiscoOfficialCloudIcon = ciscoLineIcon(
    'CiscoOfficialCloud',
    'Cisco cloud',
    COLOR.SLATE,
    <path d="M20,52.75H61.667a9.08325,9.08325,0,0,0,0-18.1665,8.88462,8.88462,0,0,0-4.49023,1.21875,17.404,17.404,0,0,0-33.251-3.80127A10.58906,10.58906,0,0,0,20,31.25a10.75,10.75,0,0,0,0,21.5Zm0-20a9.1545,9.1545,0,0,1,4.01562.92773.7491.7491,0,0,0,1.03126-.41992,15.9031,15.9031,0,0,1,30.79394,3.91455.75047.75047,0,0,0,1.207.52344A7.48766,7.48766,0,0,1,61.667,36.0835a7.58325,7.58325,0,0,1,0,15.1665H20a9.25,9.25,0,0,1,0-18.5Z" />
);

export const CiscoOfficialDataCenterIcon = ciscoLineIcon(
    'CiscoOfficialDataCenter',
    'Cisco data center',
    COLOR.SLATE,
    <>
        <path d="M24,58.75H56c.41406,0,.75-.33594,.75-.75V22c0-.41406-.33594-.75-.75-.75H24c-.41406,0-.75,.33594-.75,.75V58c0,.41406,.33594,.75,.75,.75Zm.75-36h30.5v10.5H24.75v-10.5Zm0,12h30.5v10.5H24.75v-10.5Zm0,12h30.5v10.5H24.75v-10.5Z" />
        <rect x={40} y={51.25} width={12} height={1.5} />
        <rect x={40} y={39.25} width={12} height={1.5} />
        <rect x={40} y={27.25} width={12} height={1.5} />
        <path d="M10,54.75h10v-1.5H10.75V26.75h9.25v-1.5H10c-.41406,0-.75,.33594-.75,.75v28c0,.41406,.33594,.75,.75,.75Z" />
        <path d="M70.75,54V26c0-.41406-.33594-.75-.75-.75h-10v1.5h9.25v26.5h-9.25v1.5h10c.41406,0,.75-.33594,.75-.75Z" />
        <circle cx={28} cy={28} r={1} />
        <circle cx={32} cy={28} r={1} />
        <circle cx={36} cy={28} r={1} />
        <circle cx={28} cy={40} r={1} />
        <circle cx={32} cy={40} r={1} />
        <circle cx={36} cy={40} r={1} />
        <circle cx={28} cy={52} r={1} />
        <circle cx={32} cy={52} r={1} />
        <circle cx={36} cy={52} r={1} />
    </>
);

// Build 1222 — generic load balancer. The previous boxed glyph read
// like an abstract badge at canvas size. Use the more familiar
// "one VIP/input distributes to multiple backends" topology mark.
const LoadBalancerSVG: React.FC<IconProps> = ({ className, title }) => (
    <svg
        viewBox="0 0 64 64"
        className={cn(COLOR.BLUE, className)}
        fill="none"
        stroke="currentColor"
        strokeWidth={3.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-label={title ?? 'Load balancer'}
        role="img"
    >
        {title ? <title>{title}</title> : null}
        <circle cx={32} cy={9} r={4} fill="currentColor" stroke="none" />
        <path d="M32 13 V20" />
        <rect
            x={15}
            y={20}
            width={34}
            height={22}
            rx={6}
            fill="white"
            fillOpacity={0.18}
        />
        <path d="M23 30 H41" />
        <path d="M25 36 H39" opacity={0.75} />
        <path d="M32 42 V49" />
        <path d="M32 49 H18" />
        <path d="M32 49 H46" />
        <circle cx={18} cy={54} r={4} fill="currentColor" stroke="none" />
        <circle cx={32} cy={54} r={4} fill="currentColor" stroke="none" />
        <circle cx={46} cy={54} r={4} fill="currentColor" stroke="none" />
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
const SPLUNK_SVA_ICON_BASE =
    '/static/app/splunk-cisco-dashboards/images/splunk_sva';

const svaRasterIcon = (
    filename: string,
    fallbackTitle: string
): React.FC<IconProps> => {
    const Icon: React.FC<IconProps> = ({ className, title }) => {
        const label = title ?? fallbackTitle;
        return (
            <img
                src={`${SPLUNK_SVA_ICON_BASE}/${filename}`}
                className={cn('block h-full w-full object-contain', className)}
                alt={label}
                title={label}
                draggable={false}
            />
        );
    };
    Icon.displayName = `DeviceIcon(${fallbackTitle})`;
    return Icon;
};

export const SplunkDeploymentServerIcon = svaRasterIcon(
    'agent-management.png',
    'Splunk Agent Management'
);
export const SplunkLicenseManagerIcon = svaRasterIcon(
    'license-manager.png',
    'Splunk License Manager'
);
export const SplunkMonitoringConsoleIcon = svaRasterIcon(
    'monitoring-console.png',
    'Splunk Monitoring Console'
);
export const SplunkClusterManagerIcon = svaRasterIcon(
    'cluster-manager.png',
    'Splunk Cluster Manager'
);
export const SplunkDeployerIcon = svaRasterIcon(
    'shc-deployer.png',
    'Splunk Search Head Cluster Deployer'
);
export const SplunkSearchHeadIcon = svaRasterIcon(
    'search-head.png',
    'Splunk Search Head'
);
export const SplunkSearchHeadClusterIcon = svaRasterIcon(
    'search-head-cluster.png',
    'Splunk Search Head Cluster'
);
export const SplunkIndexerIcon = svaRasterIcon('indexer.png', 'Splunk Indexer');
export const SplunkIndexerClusterIcon = svaRasterIcon(
    'indexer.png',
    'Splunk Indexer Cluster'
);
export const SplunkDataCollectionIcon = svaRasterIcon(
    'data-collection.png',
    'Splunk Data Collection'
);

type ForwarderVariant = 'universal' | 'heavy' | 'intermediate';

const FORWARDER_ICON_CONFIG: Record<
    ForwarderVariant,
    { className: string; title: string }
> = {
    universal: {
        className: COLOR.EMERALD,
        title: 'Splunk Universal Forwarder',
    },
    heavy: {
        className: COLOR.AMBER,
        title: 'Splunk Heavy Forwarder',
    },
    intermediate: {
        className: COLOR.RED,
        title: 'Splunk Intermediate Forwarder',
    },
};

const ForwarderSignal: React.FC<{ variant: ForwarderVariant }> = ({
    variant,
}) => {
    if (variant === 'universal') {
        return (
            <>
                <path d="M22 25 H43" />
                <path d="M20 33 H47" />
                <path d="M22 41 H43" />
                <path d="M25 49 H38" />
                <path d="M45 22 L60 37 L45 52" />
            </>
        );
    }

    return (
        <>
            <path d="M21 24 H30 M36 24 H41" />
            <path d="M21 32 H28 M35 32 H44" />
            <path d="M21 40 H31 M38 40 H45" />
            <path d="M21 48 H28 M35 48 H40" />
            <path d="M43 24 L52 33" />
            <path d="M45 50 L52 42" />
            <path d="M50 22 L64 37 L50 52" />
        </>
    );
};

const forwarderIcon = (
    variant: ForwarderVariant
): React.FC<IconProps> => {
    const ForwarderIcon: React.FC<IconProps> = ({ className, title }) => {
        const config = FORWARDER_ICON_CONFIG[variant];
        const label = title ?? config.title;
        const stacked = variant === 'intermediate';
        return (
            <svg
                viewBox="0 0 80 80"
                className={cn(config.className, className)}
                fill="none"
                stroke="currentColor"
                strokeWidth={3.4}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-label={label}
                role="img"
            >
                <title>{label}</title>
                {stacked ? (
                    <>
                        <rect
                            x={19}
                            y={8}
                            width={46}
                            height={58}
                            rx={8}
                            fill="white"
                            fillOpacity={0.92}
                            opacity={0.65}
                        />
                        <rect
                            x={15}
                            y={12}
                            width={46}
                            height={58}
                            rx={8}
                            fill="white"
                            fillOpacity={0.96}
                            opacity={0.82}
                        />
                    </>
                ) : null}
                <rect
                    x={10}
                    y={16}
                    width={50}
                    height={58}
                    rx={8}
                    fill="white"
                    fillOpacity={0.98}
                />
                <path d="M10 58 H60" />
                <circle cx={18} cy={66} r={2.3} fill="currentColor" stroke="none" />
                <g transform="translate(0 -2)">
                    <ForwarderSignal variant={variant} />
                </g>
            </svg>
        );
    };
    ForwarderIcon.displayName = `DeviceIcon(${FORWARDER_ICON_CONFIG[variant].title})`;
    return ForwarderIcon;
};

export const SplunkUniversalForwarderIcon = forwarderIcon('universal');
export const SplunkHeavyForwarderIcon = forwarderIcon('heavy');
export const SplunkIntermediateForwarderIcon =
    forwarderIcon('intermediate');
export const SplunkEdgeProcessorIcon = svaRasterIcon(
    'data-collection.png',
    'Splunk Edge Processor'
);
export const SplunkSc4sIcon = svaRasterIcon(
    'sc4s.png',
    'Splunk Connect for Syslog'
);

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
    router: StandardRouterIcon,
    switch: StandardL2SwitchIcon,
    l3_switch: StandardL3SwitchIcon,
    stack: StandardStackIcon,
    hub: CiscoHubIcon,
    gateway: CiscoGatewayIcon,
    proxy: CiscoProxyIcon,
    wlc: StandardWlcIcon,
    access_point: StandardApIcon,
    load_balancer: CiscoLoadBalancerIcon,
    f5_load_balancer: CiscoF5LoadBalancerIcon,
    modular_chassis_switch: CiscoModularChassisIcon,
    nexus_aci_fabric: CiscoNexusAciFabricIcon,
    sdwan_controller: CiscoSdwanControllerIcon,
    custom_stencil: CiscoGenericIcon,

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
    splunk_intermediate_forwarder: SplunkIntermediateForwarderIcon,
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

    // Official Cisco icon set imported from ~/Cisco/icons/network_icons.
    cisco_router: CiscoRouterIcon,
    cisco_switch: CiscoL2SwitchIcon,
    cisco_l3_switch: CiscoL3SwitchIcon,
    cisco_stack: CiscoStackIcon,
    cisco_wlc: CiscoWlcIcon,
    cisco_access_point: CiscoApIcon,
    cisco_firewall: CiscoOfficialFirewallIcon,
    cisco_server: CiscoOfficialServerIcon,
    cisco_cloud: CiscoOfficialCloudIcon,
    cisco_data_center: CiscoOfficialDataCenterIcon,

    generic: CiscoGenericIcon,
} as const;

export type CiscoIconId = keyof typeof CISCO_ICONS;
