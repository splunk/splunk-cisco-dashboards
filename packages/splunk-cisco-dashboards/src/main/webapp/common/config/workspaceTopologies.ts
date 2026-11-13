import type { CustomerTopology, TopologyLink, TopologySite } from '@/common/types';
import type { WorkspaceId } from './insightsWorkspaces';
import { CUSTOMER_TOPOLOGY } from '@/common/components/workspace/CustomerTopologyMap';

const site = (
    id: string,
    name: string,
    shortName: string,
    role: TopologySite['role'],
    lat: number,
    lng: number,
    status: TopologySite['status'],
    healthPct: number,
    latencyMs: number,
    alerts: number,
): TopologySite => ({
    id,
    name,
    shortName,
    role,
    lat,
    lng,
    status,
    metrics: {
        healthPct,
        activeDevices: Math.max(24, Math.round(healthPct * 0.8)),
        alerts,
        latencyMs,
    },
    internetEdgeMbps: status === 'stable' ? 1000 : 500,
    dataState: 'static',
    telemetrySource: `Workspace demo telemetry (${status})`,
});

const link = (
    id: string,
    name: string,
    sourceSiteId: string,
    targetSiteId: string,
    status: TopologyLink['status'],
    latencyMs: number,
    utilizationPct: number,
    lossPct: number,
): TopologyLink => ({
    id,
    name,
    sourceSiteId,
    targetSiteId,
    status,
    capacityMbps: status === 'stable' ? 1000 : 500,
    throughputMbps: Math.round((status === 'stable' ? 1000 : 500) * utilizationPct / 100),
    peakThroughputMbps: Math.round((status === 'stable' ? 1000 : 500) * Math.min(0.98, utilizationPct / 100 + 0.12)),
    utilizationPct,
    peakUtilizationPct: Math.min(99, utilizationPct + 12),
    latencyMs,
    lossPct,
    jitterMs: status === 'stable' ? 3 : status === 'warning' ? 14 : 28,
    endpointHealthPct: status === 'stable' ? 98 : status === 'warning' ? 88 : 72,
    endpointDevices: status === 'stable' ? 148 : 96,
    searchName:
        status === 'stable'
            ? 'Overview - Link Demo (Healthy)'
            : 'Overview - Link Demo (Warning)',
    teLink: 'https://app.thousandeyes.com/',
    dataState: 'static',
    telemetrySource: `Workspace synthetic WAN feed (${status})`,
});

const ZERO_TRUST_EUROPE_TOPOLOGY: CustomerTopology = {
    id: 'workspace-zero-trust-europe',
    name: 'Identity Trust Journey',
    subtitle: 'Follow every access decision from identity to policy enforcement',
    map: {
        center: [50.2, 4.1],
        zoom: 5.2,
        fitSitesOnLoad: true,
        minZoom: 4,
        maxZoom: 12,
        bounds: [[45.5, -7], [55, 14]],
    },
    sites: [
        site('london', 'London', 'LON', 'state_hq', 51.5074, -0.1278, 'stable', 99, 11, 0),
        site('paris', 'Paris', 'PAR', 'campus', 48.8566, 2.3522, 'stable', 97, 14, 1),
        site('frankfurt', 'Frankfurt', 'FRA', 'datacenter', 50.1109, 8.6821, 'warning', 89, 38, 3),
    ],
    links: [
        link('london-paris', 'London to Paris', 'london', 'paris', 'stable', 12, 44, 0.01),
        link('paris-frankfurt', 'Paris to Frankfurt', 'paris', 'frankfurt', 'warning', 41, 79, 0.42),
        link('frankfurt-london', 'Frankfurt to London', 'frankfurt', 'london', 'stable', 24, 56, 0.03),
    ],
};

const NETWORK_RESILIENCE_APAC_TOPOLOGY: CustomerTopology = {
    id: 'workspace-network-resilience-apac',
    name: 'Resilience Path Atlas',
    subtitle: 'See service dependencies and failover paths before disruption spreads',
    map: {
        center: [4, 128],
        zoom: 3.2,
        fitSitesOnLoad: true,
        minZoom: 2,
        maxZoom: 11,
        bounds: [[-42, 92], [44, 158]],
    },
    sites: [
        site('singapore', 'Singapore', 'SIN', 'regional_hub', 1.3521, 103.8198, 'stable', 98, 18, 0),
        site('tokyo', 'Tokyo', 'TYO', 'datacenter', 35.6762, 139.6503, 'warning', 91, 62, 2),
        site('sydney', 'Sydney', 'SYD', 'branch', -33.8688, 151.2093, 'critical', 76, 128, 6),
    ],
    links: [
        link('singapore-tokyo', 'Singapore to Tokyo', 'singapore', 'tokyo', 'stable', 68, 58, 0.04),
        link('tokyo-sydney', 'Tokyo to Sydney', 'tokyo', 'sydney', 'critical', 164, 94, 1.8),
        link('sydney-singapore', 'Sydney to Singapore', 'sydney', 'singapore', 'warning', 112, 83, 0.65),
    ],
};

const SECURITY_OPERATIONS_AMERICAS_TOPOLOGY: CustomerTopology = {
    id: 'workspace-security-operations-americas',
    name: 'Threat Response Theater',
    subtitle: 'Correlate exposure, affected sites, and containment paths',
    map: {
        center: [14, -70],
        zoom: 2.9,
        fitSitesOnLoad: true,
        minZoom: 2,
        maxZoom: 11,
        bounds: [[-30, -112], [58, -35]],
    },
    sites: [
        site('toronto', 'Toronto', 'YYZ', 'regional_hub', 43.6532, -79.3832, 'stable', 99, 16, 0),
        site('washington', 'Washington, DC', 'IAD', 'state_hq', 38.9072, -77.0369, 'warning', 90, 31, 4),
        site('sao-paulo', 'São Paulo', 'GRU', 'datacenter', -23.5505, -46.6333, 'stable', 96, 82, 1),
    ],
    links: [
        link('toronto-washington', 'Toronto to Washington', 'toronto', 'washington', 'warning', 34, 77, 0.31),
        link('washington-sao-paulo', 'Washington to São Paulo', 'washington', 'sao-paulo', 'stable', 94, 63, 0.08),
        link('sao-paulo-toronto', 'São Paulo to Toronto', 'sao-paulo', 'toronto', 'stable', 103, 52, 0.05),
    ],
};

const EXECUTIVE_GLOBAL_TOPOLOGY: CustomerTopology = {
    id: 'workspace-executive-global',
    name: 'Global Operations Pulse',
    subtitle: 'Board-level view of reach, risk, and service continuity',
    map: {
        center: [28, 55],
        zoom: 2.8,
        fitSitesOnLoad: true,
        minZoom: 2,
        maxZoom: 10,
        bounds: [[-5, -15], [60, 115]],
    },
    sites: [
        site('exec-london', 'London', 'LON', 'state_hq', 51.5074, -0.1278, 'stable', 99, 13, 0),
        site('dubai', 'Dubai', 'DXB', 'regional_hub', 25.2048, 55.2708, 'stable', 97, 54, 1),
        site('exec-singapore', 'Singapore', 'SIN', 'datacenter', 1.3521, 103.8198, 'warning', 88, 93, 3),
    ],
    links: [
        link('london-dubai', 'London to Dubai', 'exec-london', 'dubai', 'stable', 72, 48, 0.03),
        link('dubai-singapore', 'Dubai to Singapore', 'dubai', 'exec-singapore', 'warning', 118, 82, 0.58),
        link('singapore-london', 'Singapore to London', 'exec-singapore', 'exec-london', 'stable', 156, 61, 0.07),
    ],
};

const WORKSPACE_TOPOLOGIES: Record<string, CustomerTopology> = {
    dc_networking: {
        id: 'workspace-dc-fabrics', name: 'DC fabrics and connections',
        subtitle: 'Lab fabric inventory · health and inter-fabric connections unreported',
        telemetrySearchName: 'DC Networking Workspace - DC fabrics for the standard map',
        map: { center: [0, 0], zoom: 1, minZoom: 1, maxZoom: 1, bounds: [[0, 0], [0, 0]] },
        sites: [], links: [],
    },
    secure_networking: CUSTOMER_TOPOLOGY,
    zero_trust_access_demo: ZERO_TRUST_EUROPE_TOPOLOGY,
    network_resilience_demo: NETWORK_RESILIENCE_APAC_TOPOLOGY,
    security_operations_demo: SECURITY_OPERATIONS_AMERICAS_TOPOLOGY,
    executive: EXECUTIVE_GLOBAL_TOPOLOGY,
};

export const getWorkspaceTopology = (workspaceId: WorkspaceId): CustomerTopology =>
    WORKSPACE_TOPOLOGIES[workspaceId] ?? CUSTOMER_TOPOLOGY;

export {
    EXECUTIVE_GLOBAL_TOPOLOGY,
    NETWORK_RESILIENCE_APAC_TOPOLOGY,
    SECURITY_OPERATIONS_AMERICAS_TOPOLOGY,
    ZERO_TRUST_EUROPE_TOPOLOGY,
};
