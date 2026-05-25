/**
 * CyberNocShape — high-density device card used by the Network
 * Diagram authoring canvas (Build 109).
 *
 * Why a separate shape file (instead of editing
 * `topology/shapes.tsx`):
 *   The live `TopologyCanvas` continues to use the bigger,
 *   status-ringed cards on a light background; that surface is
 *   "operations dashboard" themed. The Network Diagram canvas
 *   gets the "Cyber-NOC" / "war room" theme — deep dark
 *   background, glowing status LEDs, smaller footprint, port
 *   handles only on hover. Two visual styles, two component
 *   files, zero shared mutation surface. Adding a third theme
 *   in the future is a copy-paste of THIS file with the styles
 *   re-tuned.
 *
 * Visual model (matches Google AI Studio's "stunning node"
 * blueprint, adapted to our existing TopologyDiscoveredNode +
 * Cisco icon registry):
 *
 *     ╭───────────────────────────────────────╮
 *     │ ●                                     │  ← glow LED
 *     │ ┌──────┐  CORE-SW-01                  │
 *     │ │ icon │  10.10.0.1                   │  ← compact pill
 *     │ └──────┘                              │
 *     ╰───────────────────────────────────────╯
 *      ●  port handles (4 sides) appear on hover
 *
 * Status → LED colour mapping mirrors the operations canvas
 * convention (healthy = emerald, warning = amber, critical =
 * rose, unknown = slate). The glow uses CSS box-shadow so it
 * actually *radiates* — a flat dot wouldn't read at zoom-out.
 *
 * Port handles are 4-side (top/right/bottom/left) and ship as
 * BOTH source and target so React Flow can draw an edge in
 * either direction depending on which side the operator drags
 * from. They are `opacity-0` at rest and `group-hover:opacity-
 * 100` so the canvas stays clean until the operator actually
 * approaches a device.
 */

import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { cn } from '@/common/lib/utils';
import type {
    HealthStatus,
    TopologyDiscoveredNode,
    DeviceShapeId,
} from '@/common/services/topologyDiscovery';
import { CISCO_ICONS } from '@/common/components/topology/ciscoIcons';

interface CyberNocShapeData {
    node: TopologyDiscoveredNode;
}

/** Status → LED colour and shadow. The shadow values are tuned
 *  so the glow is visible but doesn't bleed into adjacent nodes
 *  even when devices are placed close together. Tailwind's
 *  arbitrary value syntax (`shadow-[0_0_8px_#10b981]`) lets us
 *  inline the colour without adding bespoke utilities. */
const STATUS_LED: Record<
    HealthStatus,
    { dot: string; glow: string; label: string }
> = {
    healthy: {
        dot: 'bg-emerald-500',
        glow: 'shadow-[0_0_8px_#10b981]',
        label: 'Healthy',
    },
    warning: {
        dot: 'bg-amber-500',
        glow: 'shadow-[0_0_8px_#f59e0b]',
        label: 'Warning',
    },
    critical: {
        dot: 'bg-rose-500',
        glow: 'shadow-[0_0_8px_#ef4444]',
        label: 'Critical',
    },
    unknown: {
        dot: 'bg-slate-500',
        glow: 'shadow-[0_0_4px_#64748b]',
        label: 'No telemetry',
    },
};

/** Map shape ids to icons. Identical to the operations canvas's
 *  registry — shapes are an inventory concept, themes are
 *  presentation. */
const SHAPE_TO_ICON: Record<DeviceShapeId, keyof typeof CISCO_ICONS> = {
    // Core network
    switch: 'switch',
    l3_switch: 'l3_switch',
    stack: 'stack',
    router: 'router',
    // Build 115.5 — new core-network archetypes.
    hub: 'hub',
    gateway: 'gateway',
    proxy: 'proxy',
    wlc: 'wlc',
    access_point: 'access_point',
    load_balancer: 'load_balancer',
    f5_load_balancer: 'f5_load_balancer',
    modular_chassis_switch: 'modular_chassis_switch',
    nexus_aci_fabric: 'nexus_aci_fabric',
    sdwan_controller: 'sdwan_controller',
    custom_stencil: 'custom_stencil',
    // Security
    firewall: 'firewall',
    palo_alto_firewall: 'palo_alto_firewall',
    fortinet_firewall: 'fortinet_firewall',
    waf: 'waf',
    vpn_concentrator: 'vpn_concentrator',
    ids_ips: 'ids_ips',
    siem: 'siem',
    ca: 'ca',
    bastion: 'bastion',
    // Servers & infrastructure
    server: 'server',
    web_server: 'web_server',
    app_server: 'app_server',
    dns_server: 'dns_server',
    dhcp_server: 'dhcp_server',
    mainframe: 'mainframe',
    container: 'container',
    vm: 'vm',
    database: 'database',
    // Storage
    storage: 'storage',
    nas: 'nas',
    san: 'san',
    backup: 'backup',
    // End-user / IoT
    laptop: 'laptop',
    mobile_phone: 'mobile_phone',
    ip_phone: 'ip_phone',
    printer: 'printer',
    camera: 'camera',
    iot_sensor: 'iot_sensor',
    // Edge / cloud
    cloud: 'cloud',
    internet: 'internet',
    users: 'users',
    // Splunk platform
    splunk_search_head: 'splunk_search_head',
    splunk_search_head_cluster: 'splunk_search_head_cluster',
    splunk_indexer: 'splunk_indexer',
    splunk_indexer_cluster: 'splunk_indexer_cluster',
    splunk_heavy_forwarder: 'splunk_heavy_forwarder',
    splunk_universal_forwarder: 'splunk_universal_forwarder',
    splunk_intermediate_forwarder: 'splunk_intermediate_forwarder',
    splunk_cluster_manager: 'splunk_cluster_manager',
    splunk_deployer: 'splunk_deployer',
    splunk_license_manager: 'splunk_license_manager',
    splunk_monitoring_console: 'splunk_monitoring_console',
    splunk_deployment_server: 'splunk_deployment_server',
    splunk_data_collection: 'splunk_data_collection',
    splunk_edge_processor: 'splunk_edge_processor',
    splunk_sc4s: 'splunk_sc4s',
    // Places
    branch_office: 'branch_office',
    datacenter: 'datacenter',
    // Official Cisco icon set
    cisco_router: 'cisco_router',
    cisco_switch: 'cisco_switch',
    cisco_l3_switch: 'cisco_l3_switch',
    cisco_stack: 'cisco_stack',
    cisco_wlc: 'cisco_wlc',
    cisco_access_point: 'cisco_access_point',
    cisco_firewall: 'cisco_firewall',
    cisco_server: 'cisco_server',
    cisco_cloud: 'cisco_cloud',
    cisco_data_center: 'cisco_data_center',
    generic: 'generic',
};

/** All four sides expose BOTH source and target handles so the
 *  operator can drag in either direction. They share an id-prefix
 *  per side so a future "port assignment" editor can persist
 *  which side an edge attached to.
 *
 *  Build 115.5 — the SOURCE handle MUST render after the target
 *  handle so it sits on top of the target in DOM z-order. When
 *  both handles are stacked at the same `Position` (e.g. top
 *  centre), React Flow's pointer pickup chooses the topmost
 *  handle. Render-order target-first makes the source handle the
 *  one the operator picks up, which means the connection's
 *  `source` is the node where the drag STARTED — matching the
 *  operator's mental model ("I drew an arrow from A to B; the
 *  arrow points to B"). The previous (source-first) order
 *  made the arrow point in the OPPOSITE direction of the
 *  drag for any drag that started on the AP / lower-card side. */
const NodeHandles: React.FC = () => {
    const sides: Array<{ pos: Position; id: string }> = [
        { pos: Position.Top, id: 'top' },
        { pos: Position.Right, id: 'right' },
        { pos: Position.Bottom, id: 'bottom' },
        { pos: Position.Left, id: 'left' },
    ];
    return (
        <>
            {sides.map((s) => (
                <React.Fragment key={s.id}>
                    <Handle
                        type="target"
                        position={s.pos}
                        id={`${s.id}-target`}
                        className={cn(
                            '!w-2 !h-2 !bg-sky-300 !border-none',
                            'opacity-0 group-hover:opacity-100 transition-opacity'
                        )}
                    />
                    <Handle
                        type="source"
                        position={s.pos}
                        id={`${s.id}-source`}
                        className={cn(
                            '!w-2 !h-2 !bg-sky-400 !border-none',
                            'opacity-0 group-hover:opacity-100 transition-opacity'
                        )}
                    />
                </React.Fragment>
            ))}
        </>
    );
};

/** The "MGMT-INT" fallback in the secondary line is a deliberate
 *  homage to the expert blueprint — when a node is generic /
 *  unbound (no IP, no asset row), we show a placeholder that
 *  reads as "this is a port/management interface" rather than
 *  an empty string. Real assets surface their `mgmt_ip` or
 *  `device_name` here. */
const secondaryLine = (node: TopologyDiscoveredNode): string => {
    const ip = node.raw['mgmt_ip'];
    if (typeof ip === 'string' && ip.length > 0) return ip;
    const platform = node.raw['platform_id'];
    if (typeof platform === 'string' && platform.length > 0) return platform;
    return 'MGMT-INT';
};

const CyberNocShape: React.FC<{
    data: CyberNocShapeData;
    selected?: boolean;
}> = ({ data, selected }) => {
    const { node } = data;
    const led = STATUS_LED[node.status];
    const iconId = SHAPE_TO_ICON[node.shape] ?? 'generic';
    const Icon = CISCO_ICONS[iconId];

    return (
        <div
            className={cn(
                'group relative bg-[#111827]/90 backdrop-blur-md',
                'border border-slate-700 rounded-lg shadow-[0_0_15px_rgba(0,0,0,0.5)]',
                'p-3 min-w-[170px]',
                'hover:border-sky-500 hover:shadow-[0_0_10px_rgba(56,189,248,0.5)]',
                'transition-all',
                selected && 'border-sky-500 shadow-[0_0_12px_rgba(56,189,248,0.7)]'
            )}
            title={`${node.label}\nStatus: ${led.label}${
                node.healthScore !== undefined ? ` (${node.healthScore})` : ''
            }`}
        >
            {/* Status LED — top-left, glowing */}
            <span
                className={cn(
                    'absolute -top-1 -left-1 w-2.5 h-2.5 rounded-full border border-slate-900',
                    led.dot,
                    led.glow
                )}
                aria-label={led.label}
            />

            <div className="flex items-center gap-3">
                <div
                    className={cn(
                        'p-2 bg-slate-800/50 rounded-md',
                        'group-hover:bg-sky-500/10 transition-colors'
                    )}
                >
                    <Icon className="w-[18px] h-[18px] text-sky-400" />
                </div>
                <div className="overflow-hidden">
                    <div className="text-[11px] font-bold text-slate-100 truncate uppercase tracking-wider">
                        {node.shortLabel ?? node.label}
                    </div>
                    <div className="text-[9px] text-slate-500 font-mono truncate">
                        {secondaryLine(node)}
                    </div>
                </div>
            </div>

            <NodeHandles />
        </div>
    );
};

/** Single component is fine — every device shape uses the same
 *  visual chrome and only the inner Cisco icon swaps. We export
 *  per-shape names anyway for parity with `topology/shapes.tsx`
 *  in case future builds want to specialise (e.g. firewall gets
 *  brick-pattern background). */
export const CyberNocSwitch = CyberNocShape;
export const CyberNocL3Switch = CyberNocShape;
export const CyberNocRouter = CyberNocShape;
export const CyberNocFirewall = CyberNocShape;
export const CyberNocWlc = CyberNocShape;
export const CyberNocAccessPoint = CyberNocShape;
export const CyberNocServer = CyberNocShape;
export const CyberNocCloud = CyberNocShape;
export const CyberNocGeneric = CyberNocShape;

/** Diagram-canvas node-types map. Mirrors `TOPOLOGY_NODE_TYPES`
 *  shape ids exactly so payloads saved on either canvas can be
 *  rendered on either canvas without translation — only the
 *  visual style differs. */
export const DIAGRAM_DEVICE_NODE_TYPES = {
    'device:switch': CyberNocSwitch,
    'device:l3_switch': CyberNocL3Switch,
    'device:router': CyberNocRouter,
    'device:firewall': CyberNocFirewall,
    'device:palo_alto_firewall': CyberNocFirewall,
    'device:fortinet_firewall': CyberNocFirewall,
    'device:wlc': CyberNocWlc,
    'device:access_point': CyberNocAccessPoint,
    'device:load_balancer': CyberNocGeneric,
    'device:f5_load_balancer': CyberNocGeneric,
    'device:modular_chassis_switch': CyberNocL3Switch,
    'device:nexus_aci_fabric': CyberNocL3Switch,
    'device:sdwan_controller': CyberNocRouter,
    'device:server': CyberNocServer,
    'device:cloud': CyberNocCloud,
    'device:cisco_router': CyberNocRouter,
    'device:cisco_switch': CyberNocSwitch,
    'device:cisco_l3_switch': CyberNocL3Switch,
    'device:cisco_stack': CyberNocL3Switch,
    'device:cisco_wlc': CyberNocWlc,
    'device:cisco_access_point': CyberNocAccessPoint,
    'device:cisco_firewall': CyberNocFirewall,
    'device:cisco_server': CyberNocServer,
    'device:cisco_cloud': CyberNocCloud,
    'device:cisco_data_center': CyberNocGeneric,
    'device:generic': CyberNocGeneric,
} as const;
