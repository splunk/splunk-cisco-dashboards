/**
 * Topology canvas shape library — Build 105 rewrite.
 *
 * Build 104 (the spike) used lucide-react icons inside a pill-style
 * card. Per Alan's feedback ("a wall of pills doesn't look like a
 * topology diagram"), Build 105 promotes the device icon to the
 * primary visual element using inline Cisco-style SVGs from
 * `ciscoIcons.tsx`. The new shape geometry mirrors the look of an
 * actual Visio Cisco network diagram:
 *
 *   ┌────────────────────┐
 *   │   [ icon SVG ]     │  ← icon dominates the upper 2/3 of the card
 *   │     ●              │  ← status dot top-right
 *   ├────────────────────┤
 *   │  short-label       │  ← bold device name
 *   │  device_type       │  ← muted secondary
 *   └────────────────────┘
 *
 * Status outline + status dot ride on the card border, NOT the icon
 * itself, so the icon's intrinsic Cisco branding stays clean.
 *
 * Edge-drawing UX (also new in Build 105):
 *   - Handles on all four sides (Top / Right / Bottom / Left).
 *   - Handles are visually small at rest and grow on node hover so
 *     operators discover the connection points without clutter.
 *   - Invisible full-surface end handles let an in-flight connector
 *     land anywhere on the device face; the canvas persists that
 *     cursor point as a normalised edge anchor.
 *   - `isConnectable={true}` so dragging from any handle creates a
 *     new edge — wired to the canvas's `onConnect` handler which
 *     opens the Build 105 properties panel for the new edge.
 *   - Each shape exposes BOTH a source and target handle on every
 *     side; React Flow picks based on drag direction.
 */

import React, { useState } from 'react';
import { Handle, NodeResizer, Position } from '@xyflow/react';
import { ExternalLink } from '@/common/icons/SuiIcon';
import { cn } from '@/common/lib/utils';
import type {
    HealthStatus,
    TopologyDiscoveredNode,
    DeviceShapeId,
} from '@/common/services/topologyDiscovery';
import type { CustomStencilAsset } from '@/common/services/diagramPersistenceService';
import { ShapeSilhouette } from './silhouettes';
import { useIpAddressVisibility } from '@/common/contexts/IpAddressVisibilityContext';
import {
    buildMetadataHostSpl,
    openSplunkSearch,
} from '@/common/lib/splunkSearchUrl';

interface ShapeData {
    /** The full discovered/synthetic node payload, including any
     *  Build 115.13 IP override (`node.ipAddress`). Routed
     *  through `buildDeviceData` so the React Flow data layer and
     *  the saved payload (`SavedDiagramNode.ipAddress`) stay in
     *  sync via a single field name. */
    node: TopologyDiscoveredNode;
    /** Network Diagram authoring surface only: allow connectors
     *  to land anywhere on the node face and persist exact edge
     *  anchors. The live topology canvas keeps its classic four
     *  port handles. */
    freeformAnchors?: boolean;
    /** User-imported SVG/PNG stencil artwork. Present only for
     *  `device:custom_stencil` nodes in the Network Diagram. */
    customStencil?: CustomStencilAsset;
}

/**
 * Build 111: added `dotGlow` per status — a coloured drop-shadow
 * around the status dot so it reads as a glowing LED rather than a
 * flat circle. Ported from the v0 reference component; the recipe is
 * `shadow-[0_0_<radius>_<spread>_rgba(<r>,<g>,<b>,<alpha>)]` with a
 * fairly tight 8px radius and 2px spread so the glow looks like a
 * physical indicator, not a bloom. Critical gets slightly more alpha
 * (0.5 vs 0.4) so the red dot stays the strongest at-a-glance signal.
 * `unknown` gets no glow — a quiet slate dot for "no telemetry"
 * shouldn't compete for attention with healthy / warning / critical.
 */
const STATUS_PRESETS: Record<
    HealthStatus,
    {
        ring: string;
        dot: string;
        dotGlow: string;
        /** Build 115.10 — radiating ping ring colour. Renders as
         *  a second absolutely-positioned circle on top of the
         *  solid dot, animated with `animate-ping` for the outward
         *  pulse. Empty string disables the ping (used for the
         *  quiet `unknown` state — a "no telemetry" dot shouldn't
         *  call attention to itself). */
        dotPing: string;
        accent: string;
        label: string;
    }
> = {
    healthy: {
        ring: 'sui-focus-ring sui-border-positive',
        dot: 'sui-bg-positive',
        dotGlow: 'sui-shadow-overlay',
        dotPing: 'sui-bg-positive',
        accent: 'sui-color-positive',
        label: 'Healthy',
    },
    warning: {
        ring: 'sui-focus-ring sui-border-warning',
        dot: 'sui-bg-warning',
        dotGlow: 'sui-shadow-overlay',
        dotPing: 'sui-bg-warning',
        accent: 'sui-color-warning',
        label: 'Warning',
    },
    critical: {
        ring: 'sui-focus-ring sui-border-negative',
        dot: 'sui-bg-negative',
        dotGlow: 'sui-shadow-overlay',
        dotPing: 'sui-bg-negative',
        accent: 'sui-color-negative',
        label: 'Critical',
    },
    unknown: {
        ring: 'sui-focus-ring  sui-border-default',
        dot: 'sui-bg-floating',
        dotGlow: '',
        dotPing: '',
        accent: 'sui-color-muted sui-color-default',
        label: 'No telemetry',
    },
};

/** Build 115.13 — the per-`DeviceShapeId` → lucide icon map that
 *  used to live here moved into `silhouettes.tsx` (which owns the
 *  full silhouette family rendering, including the icon overlay
 *  on each chassis face). DeviceShape now delegates the entire
 *  icon area to `<ShapeSilhouette shape={...} />`; the legacy
 *  `SHAPE_TO_ICON` constant was removed once no callers
 *  remained. If a future palette UI needs the inverse mapping
 *  (e.g. "give me the lucide icon for this shape"),
 *  `CISCO_ICONS[shape]` from `ciscoIcons.tsx` is the canonical
 *  source — the keys are 1:1 with `DeviceShapeId`. */

const SURFACE_HANDLE_STYLE: React.CSSProperties = {
    left: 0,
    top: 0,
    width: '100%',
    height: '100%',
    transform: 'none',
    borderRadius: 0,
    border: 0,
    background: 'transparent',
    zIndex: 10,
};

const CUSTOM_STENCIL_PORT_ANCHORS = [22, 36, 50, 64, 78].flatMap((y) =>
    Array.from({ length: 19 }, (_, index) => ({
        x: 5 + index * 5,
        y,
    }))
);

const isCustomStencilGuideAnchor = (anchor: { x: number; y: number }): boolean =>
    anchor.y === 50 && (anchor.x - 5) % 15 === 0;

/** Connection handles on all four sides. Each side gets BOTH a
 *  `source` and `target` handle so React Flow can attach edges in
 *  either direction. They share an id-prefix per side so the
 *  properties panel can record "left port" vs "right port" later
 *  if we want directional edge routing.
 *
 *  Build 115.9 — render order is target FIRST, source SECOND. When
 *  two handles share a Position, React Flow's pointer pickup
 *  selects the topmost handle (the one rendered LAST in DOM
 *  order). With source rendered last, a drag that starts on a
 *  node's edge picks up the SOURCE handle, which makes the new
 *  edge's `source = the node where the drag began` and
 *  `target  = the node where the drop landed`. That matches the
 *  operator's mental model: "I drew an arrow from A to B; the
 *  arrowhead points at B; animation flows A → B."
 *
 *  Build 115.5 made the same swap inside `CyberNocShape.tsx`,
 *  but the canvas actually renders this `shapes.tsx` component
 *  (CyberNocShape is a future opt-in dark variant — see
 *  NetworkDiagramCanvas.tsx file header). The operator-visible
 *  bug ("arrow points the wrong way") survived 115.5 because
 *  the swap landed in the wrong file. Fixing it here is the
 *  actual fix. */
const CustomStencilPortHandles: React.FC<{ selected?: boolean }> = ({
    selected,
}) => (
    <>
        {CUSTOM_STENCIL_PORT_ANCHORS.map((anchor) => {
            const idBase = `surface-${anchor.x}-${anchor.y}`;
            const guideAnchor = isCustomStencilGuideAnchor(anchor);
            const style: React.CSSProperties = {
                left: `${anchor.x}%`,
                top: `${anchor.y}%`,
                transform: 'translate(-50%, -50%)',
                zIndex: 20,
            };
            const className = cn(
                guideAnchor ? '!h-1.5 !w-1.5' : '!h-1 !w-1',
                '!min-h-0 !min-w-0 !rounded-full',
                '!border sui-important-border-strong sui-important-bg-accent',
                'transition-opacity',
                selected && guideAnchor ? 'opacity-70' : 'opacity-0',
                guideAnchor ? 'group-hover:opacity-80' : 'group-hover:opacity-40'
            );
            return (
                <React.Fragment key={idBase}>
                    <Handle
                        type="target"
                        position={Position.Top}
                        id={`${idBase}-target`}
                        className={className}
                        style={style}
                    />
                    <Handle
                        type="source"
                        position={Position.Top}
                        id={`${idBase}-source`}
                        className={className}
                        style={style}
                    />
                </React.Fragment>
            );
        })}
    </>
);

const NodeHandles: React.FC<{
    freeform?: boolean;
    customStencil?: boolean;
    selected?: boolean;
}> = ({ freeform, customStencil, selected }) => {
    const sides: Array<{ pos: Position; id: string; style: React.CSSProperties }> = [
        { pos: Position.Top, id: 'top', style: { top: -4 } },
        { pos: Position.Right, id: 'right', style: { right: -4 } },
        { pos: Position.Bottom, id: 'bottom', style: { bottom: -4 } },
        { pos: Position.Left, id: 'left', style: { left: -4 } },
    ];
    return (
        <>
            {freeform && (
                <>
                    <Handle
                        type="target"
                        position={Position.Top}
                        id="surface-target"
                        isConnectableStart={false}
                        isConnectableEnd
                        className="!min-w-0 !min-h-0 !opacity-0"
                        style={SURFACE_HANDLE_STYLE}
                    />
                    <Handle
                        type="source"
                        position={Position.Top}
                        id="surface-source"
                        isConnectableStart={false}
                        isConnectableEnd
                        className="!min-w-0 !min-h-0 !opacity-0"
                        style={SURFACE_HANDLE_STYLE}
                    />
                </>
            )}
            {freeform && customStencil && (
                <CustomStencilPortHandles selected={selected} />
            )}
            {!customStencil &&
                sides.map((s) => (
                    <React.Fragment key={s.id}>
                        <Handle
                            type="target"
                            position={s.pos}
                            id={`${s.id}-target`}
                            className="!w-2.5 !h-2.5 sui-important-bg-accent !border-2 sui-important-border-strong sui-important-border-weak opacity-0 group-hover:opacity-100 transition-opacity"
                            style={s.style}
                        />
                        <Handle
                            type="source"
                            position={s.pos}
                            id={`${s.id}-source`}
                            className="!w-2.5 !h-2.5 sui-important-bg-accent !border-2 sui-important-border-strong sui-important-border-weak opacity-0 group-hover:opacity-100 transition-opacity"
                            style={s.style}
                        />
                    </React.Fragment>
                ))}
        </>
    );
};

const DeviceShape: React.FC<{ data: ShapeData; selected?: boolean }> = ({
    data,
    selected,
}) => {
    const { node } = data;
    const status = STATUS_PRESETS[node.status];
    const detail =
        (node.raw['device_type'] as string | undefined) ??
        (node.raw['platform_id'] as string | undefined) ??
        node.shape;
    const vendor =
        node.vendor ?? (node.raw['vendor'] as string | undefined) ?? undefined;
    const model =
        node.model ?? (node.raw['platform_id'] as string | undefined) ?? undefined;
    const vendorModelLine =
        vendor && model ? `${vendor} · ${model}` : vendor ?? model ?? null;

    // Build 115.13 — IP address resolution. Prefer the operator's
    // explicit override (`node.ipAddress`, set in the inspector);
    // fall back to the bound asset_inventory row's `ip_address`
    // column when present (asset_inventory.csv carries
    // `ip_address` for most rows; splunk_inventory carries
    // `management_ip`). We hide the row entirely when nothing
    // resolves so the card doesn't grow a stray empty line for
    // unbound shapes that never had an IP.
    const rawIp =
        (node.raw['ip_address'] as string | undefined) ??
        (node.raw['management_ip'] as string | undefined) ??
        undefined;
    const ipAddress = node.ipAddress ?? rawIp;
    const ipVisible = useIpAddressVisibility();
    const showIp = Boolean(ipAddress) && ipVisible;

    // Build 115.13 — host selection for the LED "Open in Search"
    // popover. Pick the first plausible Splunk host alias from
    // the bound row; an unbound shape gets `null`, which disables
    // the popover (the LED still renders but the cursor stays
    // default and the click is a no-op).
    const candidateHost: string | null = (() => {
        const candidates: Array<string | undefined | null> = [
            (node.raw['hostname'] as string | undefined) ?? undefined,
            (node.raw['device_name'] as string | undefined) ?? undefined,
            node.shortLabel,
            node.label,
            node.id,
        ];
        for (const candidate of candidates) {
            if (typeof candidate !== 'string') continue;
            const trimmed = candidate.trim();
            if (trimmed.length === 0) continue;
            return trimmed;
        }
        return null;
    })();

    const [ledHover, setLedHover] = useState<boolean>(false);
    const handleOpenInSearch = (event: React.MouseEvent): void => {
        // Stop the click from selecting the underlying node; the
        // operator wanted to drill into Splunk, not edit the shape.
        event.stopPropagation();
        if (!candidateHost) return;
        const spl = buildMetadataHostSpl(candidateHost);
        openSplunkSearch(spl);
    };
    const customStencil = data.customStencil;
    const title = `${node.label}\nStatus: ${status.label}${
        node.healthScore !== undefined ? ` (${node.healthScore})` : ''
    }${node.managementSource ? `\nSource: ${node.managementSource}` : ''}${
        vendorModelLine ? `\nHardware: ${vendorModelLine}` : ''
    }${showIp ? `\nIP: ${ipAddress}` : ''}${
        node.serialNumber ? `\nSerial: ${node.serialNumber}` : ''
    }`;

    if (customStencil) {
        return (
            <div
                className="group relative flex h-full w-full items-center justify-center overflow-visible sui-bg-transparent"
                style={{ width: '100%', height: '100%' }}
                title={title}
            >
                <NodeResizer
                    isVisible={selected === true}
                    minWidth={180}
                    minHeight={20}
                    lineClassName="sui-important-border-info"
                    handleClassName="sui-important-bg-accent sui-important-border-strong !w-2 !h-2"
                />
                <NodeHandles
                    freeform={data.freeformAnchors === true}
                    customStencil
                    selected={selected}
                />
                <img
                    src={customStencil.src}
                    alt={customStencil.label}
                    className="pointer-events-none block h-full w-full object-contain"
                    draggable={false}
                />
                <div className="pointer-events-none absolute left-0 top-full mt-1 min-w-28 max-w-72 rounded-md border   px-1.5 py-1 leading-tight shadow-sm backdrop-blur-sm sui-border-default sui-bg-section">
                    <div className="flex items-center gap-1">
                        <span
                            className={cn(
                                'h-1.5 w-1.5 shrink-0 rounded-full',
                                status.dot,
                                status.dotGlow
                            )}
                            aria-hidden
                        />
                        <span className="truncate text-xs font-semibold  sui-color-active">
                            {node.shortLabel}
                        </span>
                    </div>
                    <div
                        className={cn(
                            'truncate text-xs font-mono tracking-tight',
                            vendorModelLine
                                ? 'sui-color-default'
                                : 'sui-color-transparent'
                        )}
                        title={vendorModelLine ?? undefined}
                    >
                        {vendorModelLine ?? '-'}
                    </div>
                    <div
                        className={cn(
                            'truncate text-xs font-mono tracking-tight',
                            showIp
                                ? 'sui-color-info'
                                : 'sui-color-transparent'
                        )}
                        title={showIp ? ipAddress : undefined}
                    >
                        {showIp ? ipAddress : '-'}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            className={cn(
                'group relative flex flex-col items-stretch rounded-lg border  sui-bg-section',
                // Build 111: layered shadow recipe ported from the v0
                // reference. A tight contact shadow + a softer
                // ambient shadow stack to deliver the "premium
                // floating card" depth without committing to a heavy
                // single shadow. The hover state bumps both layers
                // simultaneously for a subtle lift on cursor.
                // Dark-mode variants increase alpha because shadows
                // need to read against a near-black canvas.
                'sui-shadow-overlay',
                'sui-shadow-overlay',
                'transition-shadow duration-200',
                'sui-shadow-overlay',
                'sui-shadow-overlay',
                // Status ring softened from `ring-2` (Build 105) to
                // `ring-1` (Build 111). The chunky ring + offset
                // combo competed visually with the new layered
                // shadows; a 1px coloured ring still carries the
                // status signal at a glance but lets the shadow do
                // the depth work uncontested.
                'ring-1 ring-offset-1 sui-ring-offset-page',
                status.ring,
                selected &&
                    'outline outline-2 outline-sky-500/70 outline-offset-2'
            )}
            // Build 115.11 — fill the React Flow wrapper instead of
            // hard-coding 110×122. The wrapper's size comes from
            // node.style.width / height (set on every drop and
            // round-tripped through rfToSaved), so swapping to
            // 100% / 100% lets `<NodeResizer>` below grow / shrink
            // the card without us re-rendering or fighting with
            // overflowing children. Defaults stay at 110×122 (the
            // values seeded in NODE_SIZE_PRESETS.device); the
            // resizer enforces a 90×100 floor so a panicked drag
            // can't collapse the card to an unreadable nub.
            style={{ width: '100%', height: '100%' }}
            title={title}
        >
            {/* Build 115.11 — eight resize handles (4 corners + 4
             *  edges) appear when the card is selected. Min sizes
             *  are tight enough to keep the icon + label readable
             *  while leaving lots of room to grow for diagrams
             *  that want a "hero" device. The resizer's
             *  `dimensions` change carries `resizing: true` so
             *  `isMutatingNodeChanges` knows the operator
             *  committed a resize and emits a payload update.
             *  We disable the resizer entirely on shapes that
             *  aren't selected — eight handles on every card
             *  would compete with the connect handles on hover
             *  and turn the canvas into a sea of dots. */}
            <NodeResizer
                isVisible={selected === true}
                minWidth={90}
                minHeight={100}
                lineClassName="sui-important-border-info"
                handleClassName="sui-important-bg-accent sui-important-border-strong !w-2 !h-2"
            />
            <NodeHandles freeform={data.freeformAnchors === true} />
            {/* Silhouette area — top 2/3.

                Build 115.13 replaces the previous "centred lucide
                icon" rendering with a per-class silhouette family
                (rack chassis / disc / cylinder / cloud / building
                / users / endpoint / card). The silhouette ride
                inside the existing card chrome so the React Flow
                bounding box, status ring, and LED corner stay
                identical — only the icon area changes shape. The
                lucide glyph still rides on top of each silhouette
                so the operator gets the device-class hint at zoom
                levels where the silhouette outline starts to
                dissolve into the page.

                Status is communicated by the card's own border
                ring (`status.ring`) and the corner LED dot below
                — the silhouette doesn't recolour itself for
                status so that "this is a switch" reads
                independently of "this switch is critical". */}
            <div className="flex-1 flex items-center justify-center px-2 pt-2 pb-1 relative">
                <ShapeSilhouette shape={node.shape} />
                {/* Status dot, top-right. Build 111 added the
                    `dotGlow` halo; Build 115.10 layered the
                    radiating `animate-ping` ring; Build 115.13
                    wires the LED to a click-through into Splunk
                    Search (`| metadata type=hosts | search
                    host="<bound>"`) so operators can validate
                    the inventory device names that drive the
                    LED itself. We disable the affordance when
                    the shape is unbound (no candidate host) so
                    a generic palette drop doesn't pretend it
                    has a search behind it.

                    Hover state expands a thin "Open in Search"
                    pill to the LEFT of the dot so the operator
                    sees an explicit affordance — the dot itself
                    looks the same as before from a distance,
                    but mousing over it surfaces the action.

                    Layout: an outer wrapper sized to the dot
                    contains the absolute-positioned ping ring,
                    the solid dot, and the hover pill. The ping
                    ring scales from 100% to 175% via Tailwind's
                    `animate-ping` keyframe; the solid dot stays
                    put on top. The pill renders alongside the
                    dot only on hover. */}
                <span
                    className="absolute top-1.5 right-1.5 inline-flex items-center justify-center w-2.5 h-2.5"
                    aria-label={status.label}
                    onMouseEnter={() => setLedHover(true)}
                    onMouseLeave={() => setLedHover(false)}
                >
                    {status.dotPing && (
                        <span
                            className={cn(
                                'absolute inset-0 rounded-full opacity-75 animate-ping pointer-events-none',
                                status.dotPing
                            )}
                            aria-hidden
                        />
                    )}
                    <button
                        type="button"
                        onClick={handleOpenInSearch}
                        disabled={!candidateHost}
                        title={
                            candidateHost
                                ? `${status.label} · click to open | metadata type=hosts | search host="${candidateHost}" in Splunk Search`
                                : status.label
                        }
                        className={cn(
                            'relative w-2.5 h-2.5 rounded-full',
                            status.dot,
                            status.dotGlow,
                            candidateHost
                                ? 'cursor-pointer'
                                : 'cursor-default'
                        )}
                    />
                    {ledHover && candidateHost && (
                        <span
                            className="absolute top-full right-0 mt-1 z-20 inline-flex items-center gap-1 px-1.5 py-0.5 rounded  sui-bg-popup sui-color-active text-xs font-semibold whitespace-nowrap shadow-md pointer-events-none"
                            role="status"
                        >
                            <ExternalLink className="w-2.5 h-2.5" aria-hidden />
                            Open in Search
                        </span>
                    )}
                </span>
            </div>
            {/* Label area — bottom of card. Build 115 swapped the
                two-line layout for three lines: name / type /
                vendor·model. Build 115.13 adds an optional fourth
                line for the operator-supplied IP address (gated
                by the page-level "Show IPs" toggle). We collapse
                missing rows to invisible (sui-color-transparent) rather
                than removing them so the card height stays
                consistent across rows in the same diagram, which
                keeps grid-aligned OOB diagrams from re-flowing
                when one card has an IP and a neighbour doesn't. */}
            <div className="border-t  sui-border-weak px-2 py-1 leading-tight">
                <div className="text-xs font-semibold  sui-color-active truncate">
                    {node.shortLabel}
                </div>
                <div className="text-xs  sui-color-default truncate uppercase tracking-wide">
                    {detail}
                </div>
                <div
                    className={cn(
                        'text-xs truncate font-mono tracking-tight',
                        vendorModelLine
                            ? 'sui-color-default'
                            : 'sui-color-transparent'
                    )}
                    title={vendorModelLine ?? undefined}
                >
                    {vendorModelLine ?? '—'}
                </div>
                <div
                    className={cn(
                        'text-xs truncate font-mono tracking-tight',
                        showIp
                            ? 'sui-color-info'
                            : 'sui-color-transparent'
                    )}
                    title={showIp ? ipAddress : undefined}
                >
                    {showIp ? ipAddress : '—'}
                </div>
            </div>
        </div>
    );
};

export const SwitchShape = DeviceShape;
export const RouterShape = DeviceShape;
export const FirewallShape = DeviceShape;
export const WlcShape = DeviceShape;
export const AccessPointShape = DeviceShape;
export const ServerShape = DeviceShape;
export const CloudShape = DeviceShape;
export const GenericShape = DeviceShape;
export const L3SwitchShape = DeviceShape;
// Build 115 — every shape variant share the same DeviceShape
// renderer (icon + chrome differ via SHAPE_TO_ICON, status, and
// data, not via separate components). Keeping them as named
// exports preserves the existing import graph and lets the React
// Flow node-type registry reference them by stable identifier.
export const StackShape = DeviceShape;
export const LoadBalancerShape = DeviceShape;
export const F5LoadBalancerShape = DeviceShape;
export const ModularChassisSwitchShape = DeviceShape;
export const NexusAciFabricShape = DeviceShape;
export const SdwanControllerShape = DeviceShape;
export const CustomStencilShape = DeviceShape;
export const VpnConcentratorShape = DeviceShape;
export const IdsIpsShape = DeviceShape;
export const PaloAltoFirewallShape = DeviceShape;
export const FortinetFirewallShape = DeviceShape;
export const DatabaseShape = DeviceShape;
export const StorageShape = DeviceShape;
export const IpPhoneShape = DeviceShape;
export const InternetShape = DeviceShape;
// Build 115.2 — `users` archetype (group-of-people glyph).
export const UsersShape = DeviceShape;
// Build 115.5 — 24 new shape variants, all backed by the same
// DeviceShape renderer. Named exports kept for symmetry with the
// pre-115.5 surface; the React Flow node-type registry below
// references them by stable identifier so a future per-shape
// renderer specialisation can be slotted in without churning
// every consumer.
export const HubShape = DeviceShape;
export const GatewayShape = DeviceShape;
export const ProxyShape = DeviceShape;
export const WafShape = DeviceShape;
export const SiemShape = DeviceShape;
export const CaShape = DeviceShape;
export const BastionShape = DeviceShape;
export const WebServerShape = DeviceShape;
export const AppServerShape = DeviceShape;
export const DnsServerShape = DeviceShape;
export const DhcpServerShape = DeviceShape;
export const MainframeShape = DeviceShape;
export const ContainerShape = DeviceShape;
export const VmShape = DeviceShape;
export const NasShape = DeviceShape;
export const SanShape = DeviceShape;
export const BackupShape = DeviceShape;
export const LaptopShape = DeviceShape;
export const MobilePhoneShape = DeviceShape;
export const PrinterShape = DeviceShape;
export const CameraShape = DeviceShape;
export const IotSensorShape = DeviceShape;
export const SplunkSearchHeadShape = DeviceShape;
export const SplunkSearchHeadClusterShape = DeviceShape;
export const SplunkIndexerShape = DeviceShape;
export const SplunkIndexerClusterShape = DeviceShape;
export const SplunkHeavyForwarderShape = DeviceShape;
export const SplunkUniversalForwarderShape = DeviceShape;
export const SplunkIntermediateForwarderShape = DeviceShape;
export const SplunkClusterManagerShape = DeviceShape;
export const SplunkDeployerShape = DeviceShape;
export const SplunkLicenseManagerShape = DeviceShape;
export const SplunkMonitoringConsoleShape = DeviceShape;
export const SplunkDeploymentServerShape = DeviceShape;
export const SplunkDataCollectionShape = DeviceShape;
export const SplunkEdgeProcessorShape = DeviceShape;
export const SplunkSc4sShape = DeviceShape;
export const BranchOfficeShape = DeviceShape;
export const DatacenterShape = DeviceShape;
// Official Cisco icon palette entries. They use the same DeviceShape
// chrome as the rest of the canvas; the icon itself is selected by
// `ShapeSilhouette` from `node.shape`.
export const CiscoRouterShape = DeviceShape;
export const CiscoSwitchShape = DeviceShape;
export const CiscoL3SwitchShape = DeviceShape;
export const CiscoStackShape = DeviceShape;
export const CiscoWlcShape = DeviceShape;
export const CiscoAccessPointShape = DeviceShape;
export const CiscoFirewallShape = DeviceShape;
export const CiscoServerShape = DeviceShape;
export const CiscoCloudShape = DeviceShape;
export const CiscoDataCenterShape = DeviceShape;

/** Parent zone container — visual chrome for grouping devices by
 *  customer site. Non-draggable, non-clickable, no handles. */
export const TopologyZoneNode: React.FC<{
    data: { label: string; isUnsited: boolean; deviceCount: number };
}> = ({ data }) => (
    <div
        className={cn(
            'rounded-xl border-2 border-dashed  sui-bg-section',
            data.isUnsited
                ? 'sui-border-warning'
                : 'sui-border-default'
        )}
        style={{ width: '100%', height: '100%' }}
    >
        <div className="flex items-center justify-between px-3 py-1.5 text-xs font-semibold uppercase tracking-wider  sui-color-default">
            <span className="truncate">{data.label}</span>
            <span className="ml-2 px-1.5 py-0.5 rounded  sui-bg-popup  sui-color-default text-xs">
                {data.deviceCount}
            </span>
        </div>
    </div>
);

export const TOPOLOGY_NODE_TYPES = {
    // Core network
    'device:switch': SwitchShape,
    'device:l3_switch': L3SwitchShape,
    'device:stack': StackShape,
    'device:router': RouterShape,
    'device:hub': HubShape,
    'device:gateway': GatewayShape,
    'device:proxy': ProxyShape,
    'device:wlc': WlcShape,
    'device:access_point': AccessPointShape,
    'device:load_balancer': LoadBalancerShape,
    'device:f5_load_balancer': F5LoadBalancerShape,
    'device:modular_chassis_switch': ModularChassisSwitchShape,
    'device:nexus_aci_fabric': NexusAciFabricShape,
    'device:sdwan_controller': SdwanControllerShape,
    'device:custom_stencil': CustomStencilShape,
    // Security
    'device:firewall': FirewallShape,
    'device:palo_alto_firewall': PaloAltoFirewallShape,
    'device:fortinet_firewall': FortinetFirewallShape,
    'device:waf': WafShape,
    'device:vpn_concentrator': VpnConcentratorShape,
    'device:ids_ips': IdsIpsShape,
    'device:siem': SiemShape,
    'device:ca': CaShape,
    'device:bastion': BastionShape,
    // Servers & infrastructure
    'device:server': ServerShape,
    'device:web_server': WebServerShape,
    'device:app_server': AppServerShape,
    'device:dns_server': DnsServerShape,
    'device:dhcp_server': DhcpServerShape,
    'device:mainframe': MainframeShape,
    'device:container': ContainerShape,
    'device:vm': VmShape,
    'device:database': DatabaseShape,
    // Storage
    'device:storage': StorageShape,
    'device:nas': NasShape,
    'device:san': SanShape,
    'device:backup': BackupShape,
    // End-user / IoT
    'device:laptop': LaptopShape,
    'device:mobile_phone': MobilePhoneShape,
    'device:ip_phone': IpPhoneShape,
    'device:printer': PrinterShape,
    'device:camera': CameraShape,
    'device:iot_sensor': IotSensorShape,
    // Edge / cloud
    'device:cloud': CloudShape,
    'device:internet': InternetShape,
    'device:users': UsersShape,
    // Splunk platform
    'device:splunk_search_head': SplunkSearchHeadShape,
    'device:splunk_search_head_cluster': SplunkSearchHeadClusterShape,
    'device:splunk_indexer': SplunkIndexerShape,
    'device:splunk_indexer_cluster': SplunkIndexerClusterShape,
    'device:splunk_heavy_forwarder': SplunkHeavyForwarderShape,
    'device:splunk_universal_forwarder': SplunkUniversalForwarderShape,
    'device:splunk_intermediate_forwarder': SplunkIntermediateForwarderShape,
    'device:splunk_cluster_manager': SplunkClusterManagerShape,
    'device:splunk_deployer': SplunkDeployerShape,
    'device:splunk_license_manager': SplunkLicenseManagerShape,
    'device:splunk_monitoring_console': SplunkMonitoringConsoleShape,
    'device:splunk_deployment_server': SplunkDeploymentServerShape,
    'device:splunk_data_collection': SplunkDataCollectionShape,
    'device:splunk_edge_processor': SplunkEdgeProcessorShape,
    'device:splunk_sc4s': SplunkSc4sShape,
    // Places
    'device:branch_office': BranchOfficeShape,
    'device:datacenter': DatacenterShape,
    // Official Cisco icon set
    'device:cisco_router': CiscoRouterShape,
    'device:cisco_switch': CiscoSwitchShape,
    'device:cisco_l3_switch': CiscoL3SwitchShape,
    'device:cisco_stack': CiscoStackShape,
    'device:cisco_wlc': CiscoWlcShape,
    'device:cisco_access_point': CiscoAccessPointShape,
    'device:cisco_firewall': CiscoFirewallShape,
    'device:cisco_server': CiscoServerShape,
    'device:cisco_cloud': CiscoCloudShape,
    'device:cisco_data_center': CiscoDataCenterShape,
    'device:generic': GenericShape,
    topologyZone: TopologyZoneNode,
} as const;
