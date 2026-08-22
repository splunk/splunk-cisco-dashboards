import { C3_VISUALIZATION_COLORS } from '@/common/theme/c3VisualizationPalette';

export type PillarId =
    | 'zero-trust-access'
    | 'secure-infrastructure'
    | 'scalable-network-segmentation'
    | 'hybrid-mesh-firewalling'
    | 'agentic-ops';

export type PillarIconName =
    | 'shield-keyhole'
    | 'servers'
    | 'node-model'
    | 'wall-bricks'
    | 'robot-face-wrench';

export interface PillarDefinition {
    id: PillarId;
    label: string;
    shortLabel: string;
    dashboardTitle: string;
    description: string;
    studioView: string;
    icon: PillarIconName;
    implemented: boolean;
}

export type PillarCardKind =
    | 'stacked-columns'
    | 'line'
    | 'table'
    | 'ranked-bars';

export interface PillarSeriesDefinition {
    field: string;
    label: string;
    color: string;
}

export interface PillarThresholds {
    healthyMax: number;
    warningMax: number;
}

export interface PillarCardDefinition {
    id: string;
    title: string;
    description: string;
    searchId: string;
    kind: PillarCardKind;
    headlineField: string;
    headlineUnit: string;
    deltaField?: string;
    series?: readonly PillarSeriesDefinition[];
    tableColumns?: readonly string[];
    categoryField?: string;
    valueField?: string;
    dynamicSeries?: boolean;
    thresholds?: PillarThresholds;
    drilldownIds: readonly string[];
    featured?: boolean;
}

export interface PillarTimeRange {
    label: string;
    shortLabel: string;
    earliest: string;
    latest: string;
}

export const PILLARS: readonly PillarDefinition[] = [
    {
        id: 'zero-trust-access',
        label: 'Zero Trust Access',
        shortLabel: 'Zero Trust',
        dashboardTitle: 'Zero Trust Posture',
        description:
            'Connect identity, posture, policy, and response signals across the access journey.',
        studioView: 'sn_zta_posture',
        icon: 'shield-keyhole',
        implemented: true,
    },
    {
        id: 'secure-infrastructure',
        label: 'Secure Infrastructure',
        shortLabel: 'Infrastructure',
        dashboardTitle: 'Infrastructure Posture',
        description:
            'Unify device, platform, fabric, and availability evidence for infrastructure operations.',
        studioView: 'sn_secure_infrastructure_posture',
        icon: 'servers',
        implemented: false,
    },
    {
        id: 'scalable-network-segmentation',
        label: 'Scalable Network Segmentation',
        shortLabel: 'Segmentation',
        dashboardTitle: 'Segmentation Readiness',
        description:
            'Assess policy readiness, assignment coverage, and enforcement signals across the estate.',
        studioView: 'sn_segmentation_readiness',
        icon: 'node-model',
        implemented: false,
    },
    {
        id: 'hybrid-mesh-firewalling',
        label: 'Hybrid Mesh Firewalling',
        shortLabel: 'Firewalling',
        dashboardTitle: 'Hybrid Mesh Enforcement',
        description:
            'Correlate distributed enforcement, threat, and policy telemetry across hybrid controls.',
        studioView: 'sn_hmf_enforcement',
        icon: 'wall-bricks',
        implemented: false,
    },
    {
        id: 'agentic-ops',
        label: 'Agentic Ops',
        shortLabel: 'Agentic Ops',
        dashboardTitle: 'Operational Intelligence',
        description:
            'Turn assurance evidence into prioritized investigations and explainable operator actions.',
        studioView: 'sn_agentic_ops_operational_intelligence',
        icon: 'robot-face-wrench',
        implemented: false,
    },
] as const;

export const PILLAR_TIME_RANGES: readonly PillarTimeRange[] = [
    { label: 'Last 4 hours', shortLabel: '4h', earliest: '-4h', latest: 'now' },
    { label: 'Last 24 hours', shortLabel: '24h', earliest: '-24h', latest: 'now' },
    { label: 'Last 48 hours', shortLabel: '48h', earliest: '-48h', latest: 'now' },
    { label: 'Last 7 days', shortLabel: '7d', earliest: '-7d@d', latest: 'now' },
    { label: 'Last 30 days', shortLabel: '30d', earliest: '-30d@d', latest: 'now' },
] as const;

export const DEFAULT_PILLAR_TIME_RANGE = PILLAR_TIME_RANGES[1];

export const ZERO_TRUST_CARDS: readonly PillarCardDefinition[] = [
    {
        id: 'authentication-outcomes',
        title: 'Authentication outcomes',
        description:
            'Cisco ISE decisions over time, with successful, failed, and other outcomes kept visible.',
        searchId: 'secure_networking_zta_auth_outcome_trend',
        kind: 'stacked-columns',
        headlineField: 'WindowAuthentications',
        headlineUnit: 'authentications',
        deltaField: 'BucketAuthentications',
        series: [
            { field: 'Success', label: 'Success', color: C3_VISUALIZATION_COLORS.positive },
            { field: 'Failure', label: 'Failure', color: C3_VISUALIZATION_COLORS.critical },
            { field: 'Other', label: 'Other', color: C3_VISUALIZATION_COLORS.neutral },
        ],
        drilldownIds: [
            'secure_networking_zta_failure_reasons_by_site',
            'secure_networking_zta_ise_auth_by_device_fail_rate',
        ],
        featured: true,
    },
    {
        id: 'authentication-friction',
        title: 'Authentication friction',
        description:
            'Selected-window ISE failure rate, backed by the per-bucket authentication volume.',
        searchId: 'secure_networking_zta_ise_auth_failure_rate_trend',
        kind: 'line',
        headlineField: 'WindowFailureRatePct',
        headlineUnit: '%',
        deltaField: 'Failure Rate %',
        series: [
            {
                field: 'Failure Rate %',
                label: 'Failure rate',
                color: C3_VISUALIZATION_COLORS.purple,
            },
        ],
        thresholds: { healthyMax: 5, warningMax: 15 },
        drilldownIds: ['secure_networking_zta_ise_auth_by_device_fail_rate'],
    },
    {
        id: 'private-access-status',
        title: 'Private access status',
        description:
            'Cisco Secure Access ZTNA connection outcomes reveal adoption and denial spikes.',
        searchId: 'secure_networking_zta_ztna_connection_status_trend',
        kind: 'stacked-columns',
        headlineField: 'WindowConnections',
        headlineUnit: 'connections',
        deltaField: 'BucketConnections',
        series: [
            {
                field: 'Connected',
                label: 'Connected',
                color: C3_VISUALIZATION_COLORS.positive,
            },
            { field: 'Denied', label: 'Denied', color: C3_VISUALIZATION_COLORS.critical },
            { field: 'Unknown', label: 'Unknown', color: C3_VISUALIZATION_COLORS.neutral },
        ],
        dynamicSeries: true,
        drilldownIds: [
            'secure_networking_zta_ztna_app_access_summary',
            'secure_networking_zta_ztna_blocked_access_reasons',
        ],
    },
    {
        id: 'remote-access-health',
        title: 'Remote access health',
        description:
            'Failed share of RaVPN attempts, with successful and failed connection volume in context.',
        searchId: 'secure_networking_zta_ravpn_connection_attempts_trend',
        kind: 'stacked-columns',
        headlineField: 'WindowFailureRatePct',
        headlineUnit: '%',
        deltaField: 'Failure Rate %',
        series: [
            { field: 'Connects', label: 'Connected', color: C3_VISUALIZATION_COLORS.positive },
            {
                field: 'Connect Failures',
                label: 'Failed',
                color: C3_VISUALIZATION_COLORS.critical,
            },
        ],
        drilldownIds: [
            'secure_networking_zta_ravpn_sessions_by_profile',
            'secure_networking_zta_ravpn_failure_reasons',
            'secure_networking_zta_ravpn_posture_alerts',
        ],
    },
    {
        id: 'risky-mfa-outcomes',
        title: 'Risky MFA outcomes',
        description:
            'Denied or fraud Duo MFA events ranked by the affected application and factor pair.',
        searchId: 'secure_networking_zta_risky_mfa_outcomes_by_application_factor',
        kind: 'table',
        headlineField: '_WindowRiskyOutcomes',
        headlineUnit: 'events',
        tableColumns: ['Application / Factor', 'Risky Outcomes', 'Failure Rate %'],
        drilldownIds: [
            'secure_networking_zta_risky_mfa_outcomes_by_application_factor',
            'secure_networking_infra_duo_blocked_posture_identity',
        ],
    },
    {
        id: 'control-telemetry-volume',
        title: 'Control telemetry volume',
        description:
            'Selected-window event volume from ISE, ZTNA, and FMC, shown as collection evidence.',
        searchId: 'secure_networking_zta_user_activity_by_source_summary',
        kind: 'ranked-bars',
        headlineField: '_WindowEvents',
        headlineUnit: 'events',
        categoryField: 'Control Source',
        valueField: 'Events',
        drilldownIds: ['secure_networking_zta_user_activity_cross_source'],
    },
] as const;

export const isPillarId = (value: unknown): value is PillarId =>
    typeof value === 'string' && PILLARS.some((pillar) => pillar.id === value);
