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
    journey: readonly string[];
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

export type PillarThresholds =
    | {
          direction: 'lower-is-better';
          healthyMax: number;
          warningMax: number;
      }
    | {
          direction: 'higher-is-better';
          healthyMin: number;
          warningMin: number;
      };

export interface PillarCardDefinition {
    id: string;
    title: string;
    description: string;
    category: string;
    subCategory: string;
    searchId: string;
    kind: PillarCardKind;
    headlineField: string;
    headlineUnit: string;
    deltaField?: string;
    series?: readonly PillarSeriesDefinition[];
    tableColumns?: readonly string[];
    categoryField?: string;
    valueField?: string;
    valueLabel?: string;
    barColor?: string;
    rankLimit?: number;
    categoryAxisWidth?: number;
    dynamicSeries?: boolean;
    excludedSeriesFields?: readonly string[];
    connectNulls?: boolean;
    zeroOnlyIsEmpty?: boolean;
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
        journey: ['ISE authentication', 'Duo MFA', 'Private access', 'Remote access'],
        implemented: true,
    },
    {
        id: 'secure-infrastructure',
        label: 'Secure Infrastructure',
        shortLabel: 'Infrastructure',
        dashboardTitle: 'Infrastructure Posture',
        description:
            'Unify infrastructure assurance, exposure, and operational control signals.',
        studioView: 'sn_secure_infrastructure_posture',
        icon: 'servers',
        journey: [
            'Data center assurance',
            'Wireless coverage',
            'Threat containment',
            'SD-WAN visibility',
        ],
        implemented: true,
    },
    {
        id: 'scalable-network-segmentation',
        label: 'Scalable Network Segmentation',
        shortLabel: 'Segmentation',
        dashboardTitle: 'Segmentation Readiness',
        description:
            'Connect segmentation posture, trust boundaries, and enforcement coverage at scale.',
        studioView: 'sn_segmentation_readiness',
        icon: 'node-model',
        journey: [
            'Hardware baseline',
            'SGT assignment',
            'Adoption coverage',
            'Site activity',
        ],
        implemented: true,
    },
    {
        id: 'hybrid-mesh-firewalling',
        label: 'Hybrid Mesh Firewalling',
        shortLabel: 'Firewalling',
        dashboardTitle: 'Hybrid Mesh Enforcement',
        description:
            'Unify firewall posture, enforcement, and workload protection across the hybrid mesh.',
        studioView: 'sn_hmf_enforcement',
        icon: 'wall-bricks',
        journey: [
            'Firewall coverage',
            'Unified enforcement',
            'DNS security',
            'Data protection',
        ],
        implemented: true,
    },
    {
        id: 'agentic-ops',
        label: 'Agentic Ops',
        shortLabel: 'Agentic Ops',
        dashboardTitle: 'Operational Intelligence',
        description:
            'Coordinate test health, path quality, routing instability, and AI Defense signals.',
        studioView: 'sn_agentic_ops_operational_intelligence',
        icon: 'robot-face-wrench',
        journey: ['Test health', 'Path quality', 'App availability', 'Routing stability'],
        implemented: true,
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
        title: 'Authentication Outcomes',
        description:
            'Cisco ISE decisions over time, with successful, failed, and other outcomes kept visible.',
        category: 'Identity',
        subCategory: 'Zero Trust Access',
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
        zeroOnlyIsEmpty: true,
        drilldownIds: [
            'secure_networking_zta_failure_reasons_by_site',
            'secure_networking_zta_ise_auth_by_device_fail_rate',
        ],
        featured: true,
    },
    {
        id: 'authentication-friction',
        title: 'Authentication Friction',
        description:
            'Selected-window ISE failure rate, backed by the per-bucket authentication volume.',
        category: 'Identity',
        subCategory: 'Zero Trust Access',
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
        zeroOnlyIsEmpty: true,
        thresholds: {
            direction: 'lower-is-better',
            healthyMax: 5,
            warningMax: 15,
        },
        drilldownIds: ['secure_networking_zta_ise_auth_by_device_fail_rate'],
    },
    {
        id: 'private-access-status',
        title: 'Private Access Status',
        description:
            'Cisco Secure Access ZTNA connection outcomes reveal adoption and denial spikes.',
        category: 'Identity',
        subCategory: 'Zero Trust Access',
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
        zeroOnlyIsEmpty: true,
        drilldownIds: [
            'secure_networking_zta_ztna_app_access_summary',
            'secure_networking_zta_ztna_blocked_access_reasons',
        ],
    },
    {
        id: 'remote-access-health',
        title: 'Remote Access Health',
        description:
            'Failed share of RaVPN attempts, with successful and failed connection volume in context.',
        category: 'Identity',
        subCategory: 'Zero Trust Access',
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
        zeroOnlyIsEmpty: true,
        drilldownIds: [
            'secure_networking_zta_ravpn_sessions_by_profile',
            'secure_networking_zta_ravpn_failure_reasons',
            'secure_networking_zta_ravpn_posture_alerts',
        ],
    },
    {
        id: 'risky-mfa-outcomes',
        title: 'Risky MFA Outcomes',
        description:
            'Denied or fraud Duo MFA events ranked by the affected application and factor pair.',
        category: 'Identity',
        subCategory: 'Zero Trust Access',
        searchId: 'secure_networking_zta_risky_mfa_outcomes_by_application_factor',
        kind: 'table',
        headlineField: '_WindowRiskyOutcomes',
        headlineUnit: 'events',
        tableColumns: ['Application / Factor', 'Risky Outcomes', 'Failure Rate %'],
        zeroOnlyIsEmpty: true,
        drilldownIds: [
            'secure_networking_zta_risky_mfa_outcomes_by_application_factor',
            'secure_networking_infra_duo_blocked_posture_identity',
        ],
    },
    {
        id: 'control-telemetry-volume',
        title: 'Control Telemetry Volume',
        description:
            'Selected-window event volume from ISE, ZTNA, and FMC, shown as collection evidence.',
        category: 'Identity',
        subCategory: 'Zero Trust Access',
        searchId: 'secure_networking_zta_user_activity_by_source_summary',
        kind: 'ranked-bars',
        headlineField: '_WindowEvents',
        headlineUnit: 'events',
        categoryField: 'Control Source',
        valueField: 'Events',
        valueLabel: 'Events',
        barColor: C3_VISUALIZATION_COLORS.info,
        zeroOnlyIsEmpty: true,
        drilldownIds: ['secure_networking_zta_user_activity_cross_source'],
    },
] as const;

export const SECURE_INFRASTRUCTURE_CARDS: readonly PillarCardDefinition[] = [
    {
        id: 'data-center-signals',
        title: 'Data Center Signals',
        description:
            'Compares distinct Cisco Nexus Dashboard anomaly and advisory observations over time; the headline counts unique anomalies in the selected window.',
        category: 'Network',
        subCategory: 'Secure Infrastructure',
        searchId: 'secure_networking_dc_health_signals_trend',
        kind: 'stacked-columns',
        headlineField: 'WindowUniqueAnomalies',
        headlineUnit: 'unique anomalies',
        deltaField: 'Anomaly',
        series: [
            { field: 'Anomaly', label: 'Anomaly', color: C3_VISUALIZATION_COLORS.critical },
            { field: 'Advisory', label: 'Advisory', color: C3_VISUALIZATION_COLORS.caution },
            { field: 'Unknown', label: 'Unknown', color: C3_VISUALIZATION_COLORS.neutral },
        ],
        zeroOnlyIsEmpty: true,
        drilldownIds: [
            'secure_networking_dc_anomalies_by_severity',
            'secure_networking_secure_infra_status_rollup',
        ],
        featured: true,
    },
    {
        id: 'critical-advisories',
        title: 'Critical Advisories',
        description:
            'Distinct critical Cisco Nexus Dashboard security advisories observed in the selected window; this does not claim that each advisory is currently active.',
        category: 'Security',
        subCategory: 'Secure Infrastructure',
        searchId: 'secure_networking_dc_advisory_count',
        kind: 'line',
        headlineField: 'critical_count',
        headlineUnit: 'critical advisories',
        deltaField: 'critical_count_trend',
        series: [
            {
                field: 'critical_count_trend',
                label: 'Critical advisories',
                color: C3_VISUALIZATION_COLORS.critical,
            },
        ],
        zeroOnlyIsEmpty: true,
        thresholds: {
            direction: 'lower-is-better',
            healthyMax: 0,
            warningMax: 0,
        },
        drilldownIds: [
            'secure_networking_dc_security_advisory_detail',
            'secure_networking_psirt_exposure_by_site_family',
            'secure_networking_intersight_advisory_exposure',
        ],
    },
    {
        id: 'reporting-access-points',
        title: 'Reporting Access Points',
        description:
            'Distinct Cisco Meraki access points observed reporting in the selected window; this is telemetry coverage, not configured wireless inventory.',
        category: 'Asset',
        subCategory: 'Secure Infrastructure',
        searchId: 'secure_networking_meraki_ap_count',
        kind: 'line',
        headlineField: 'WindowReportingAPs',
        headlineUnit: 'access points',
        deltaField: 'ap_count',
        series: [
            {
                field: 'ap_count',
                label: 'Reporting access points',
                color: C3_VISUALIZATION_COLORS.info,
            },
        ],
        zeroOnlyIsEmpty: true,
        drilldownIds: ['secure_networking_meraki_ap_inventory_detail'],
    },
    {
        id: 'wireless-containment',
        title: 'Wireless Containment',
        description:
            'Trends contained and uncontained Meraki rogue access points over time, with the SSID-level status table available on drill-down.',
        category: 'Network',
        subCategory: 'Secure Infrastructure',
        searchId: 'secure_networking_meraki_rogue_ap_containment_trend',
        kind: 'stacked-columns',
        headlineField: 'WindowUncontainedAPs',
        headlineUnit: 'uncontained APs',
        deltaField: 'Uncontained',
        series: [
            { field: 'Contained', label: 'Contained', color: C3_VISUALIZATION_COLORS.positive },
            {
                field: 'Uncontained',
                label: 'Uncontained',
                color: C3_VISUALIZATION_COLORS.critical,
            },
        ],
        zeroOnlyIsEmpty: true,
        drilldownIds: [
            'secure_networking_meraki_rogue_ap_containment',
            'secure_networking_meraki_ssid_encryption_breakdown',
        ],
    },
    {
        id: 'wireless-clients-observed',
        title: 'Wireless Clients Observed',
        description:
            'Distinct wireless client MAC addresses observed authenticating to Cisco Meraki access points in the selected window.',
        category: 'Asset',
        subCategory: 'Secure Infrastructure',
        searchId: 'secure_networking_meraki_wireless_client_count',
        kind: 'line',
        headlineField: 'WindowUniqueClients',
        headlineUnit: 'clients',
        deltaField: 'wireless_client_count',
        series: [
            {
                field: 'wireless_client_count',
                label: 'Wireless clients',
                color: C3_VISUALIZATION_COLORS.positive,
            },
        ],
        zeroOnlyIsEmpty: true,
        drilldownIds: ['secure_networking_meraki_top_clients_by_bandwidth'],
    },
    {
        id: 'reporting-sd-wan-sites',
        title: 'Reporting SD-WAN Sites',
        description:
            'Distinct Cisco Catalyst SD-WAN sites observed reporting health telemetry, with per-interval collection context.',
        category: 'Network',
        subCategory: 'Secure Infrastructure',
        searchId: 'secure_networking_sdwan_reporting_sites_trend',
        kind: 'line',
        headlineField: 'total_sites',
        headlineUnit: 'sites',
        deltaField: 'reporting_sites',
        series: [
            {
                field: 'reporting_sites',
                label: 'Reporting sites',
                color: C3_VISUALIZATION_COLORS.cyan,
            },
        ],
        zeroOnlyIsEmpty: true,
        drilldownIds: [
            'secure_networking_sdwan_site_view',
            'secure_networking_sdwan_tunnel_health_log',
        ],
    },
] as const;

export const SEGMENTATION_CARDS: readonly PillarCardDefinition[] = [
    {
        id: 'trustsec-hardware-inventory',
        title: 'TrustSec Hardware Inventory',
        description:
            'Ranks the observed Catalyst Center hardware inventory by device family as a deployment baseline; an authoritative TrustSec capability lookup is not currently available.',
        category: 'Asset',
        subCategory: 'Scalable Network Segmentation',
        searchId: 'secure_networking_trustsec_hardware_readiness_summary',
        kind: 'ranked-bars',
        headlineField: 'WindowDevices',
        headlineUnit: 'devices',
        categoryField: 'Device Family',
        valueField: 'Devices',
        valueLabel: 'Devices',
        barColor: C3_VISUALIZATION_COLORS.info,
        rankLimit: 10,
        categoryAxisWidth: 126,
        zeroOnlyIsEmpty: true,
        drilldownIds: ['secure_networking_trustsec_hardware_readiness'],
        featured: true,
    },
    {
        id: 'endpoint-sgt-assignments',
        title: 'Observed Endpoint-SGT Assignments',
        description:
            'Counts distinct endpoint-to-SGT assignments observed in Cisco ISE authentication events; this is reporting activity, not current assignment state.',
        category: 'Identity',
        subCategory: 'Scalable Network Segmentation',
        searchId: 'secure_networking_sgt_total_assignments_count',
        kind: 'line',
        headlineField: 'total_assignments',
        headlineUnit: 'assignments',
        deltaField: 'assignments_trend',
        series: [
            {
                field: 'assignments_trend',
                label: 'Observed assignments',
                color: C3_VISUALIZATION_COLORS.purple,
            },
        ],
        zeroOnlyIsEmpty: true,
        drilldownIds: [
            'secure_networking_sgt_distribution_by_site_device',
            'secure_networking_excessive_mac_per_port',
            'secure_networking_ot_iot_device_visibility',
        ],
    },
    {
        id: 'security-groups-in-use',
        title: 'Observed Security Groups in Use',
        description:
            'Ranks non-default Security Group Tags by observed ISE authentication activity and reports the selected-window classification breadth.',
        category: 'Identity',
        subCategory: 'Scalable Network Segmentation',
        searchId: 'secure_networking_sgt_activity_summary',
        kind: 'ranked-bars',
        headlineField: 'WindowSecurityGroups',
        headlineUnit: 'groups',
        categoryField: 'Security Group',
        valueField: 'Events',
        valueLabel: 'Events',
        barColor: C3_VISUALIZATION_COLORS.purple,
        rankLimit: 10,
        categoryAxisWidth: 126,
        zeroOnlyIsEmpty: true,
        drilldownIds: [
            'secure_networking_sgt_distribution_by_site_device',
            'secure_networking_sgt_by_site',
        ],
    },
    {
        id: 'segmentation-adoption-rate',
        title: 'Observed Segmentation Adoption Rate',
        description:
            'Shows the weighted selected-window percentage of Cisco ISE authentication activity carrying a non-default Security Group Tag, with its bucket trend.',
        category: 'Identity',
        subCategory: 'Scalable Network Segmentation',
        searchId: 'secure_networking_segmentation_adoption_rate_trend',
        kind: 'line',
        headlineField: 'WindowAdoptionRate',
        headlineUnit: '%',
        deltaField: 'AdoptionRate',
        series: [
            {
                field: 'AdoptionRate',
                label: 'Adoption rate',
                color: C3_VISUALIZATION_COLORS.positive,
            },
        ],
        connectNulls: true,
        zeroOnlyIsEmpty: true,
        drilldownIds: [
            'secure_networking_segmentation_status_rollup',
            'secure_networking_sgt_distribution_by_site_device',
        ],
    },
    {
        id: 'zero-sgt-coverage-sites',
        title: 'Sites With No Observed SGT Coverage',
        description:
            'Lists real ISE locations with authentication activity but no observed non-default SGT assignments; missing site enrichment is kept separate.',
        category: 'Identity',
        subCategory: 'Scalable Network Segmentation',
        searchId: 'secure_networking_segmentation_zero_coverage_sites_summary',
        kind: 'table',
        headlineField: 'WindowZeroCoverageSites',
        headlineUnit: 'sites',
        tableColumns: ['Site', 'Authentication Events', 'Tagged Events', 'Coverage %'],
        zeroOnlyIsEmpty: true,
        drilldownIds: [
            'secure_networking_segmentation_status_rollup',
            'secure_networking_sgt_by_site',
        ],
    },
    {
        id: 'tagged-authentication-by-location',
        title: 'Tagged Authentication Events by Location',
        description:
            'Ranks observed TrustSec-tagged ISE authentication events across the best available site, reporting device, or ISE node context.',
        category: 'Identity',
        subCategory: 'Scalable Network Segmentation',
        searchId: 'secure_networking_sgt_site_activity_summary',
        kind: 'ranked-bars',
        headlineField: 'WindowEvents',
        headlineUnit: 'events',
        categoryField: 'Location Context',
        valueField: 'Events',
        valueLabel: 'Events',
        barColor: C3_VISUALIZATION_COLORS.cyan,
        rankLimit: 10,
        categoryAxisWidth: 126,
        zeroOnlyIsEmpty: true,
        drilldownIds: ['secure_networking_sgt_by_site'],
    },
] as const;

export const HYBRID_MESH_FIREWALLING_CARDS: readonly PillarCardDefinition[] = [
    {
        id: 'reporting-firewalls',
        title: 'Reporting Firewalls',
        description:
            'Distinct Cisco Firepower/FTD devices reporting FMC telemetry in the latest populated interval; this is observed telemetry, not a configured inventory denominator.',
        category: 'Asset',
        subCategory: 'Hybrid Mesh Firewalling',
        searchId: 'secure_networking_infra_fmc_firewall_count',
        kind: 'line',
        headlineField: 'firewall_count',
        headlineUnit: 'firewalls',
        deltaField: 'firewall_count',
        series: [
            {
                field: 'firewall_count',
                label: 'Reporting firewalls',
                color: C3_VISUALIZATION_COLORS.info,
            },
        ],
        zeroOnlyIsEmpty: true,
        drilldownIds: ['secure_networking_hmf_enforcement_coverage_by_site'],
        featured: true,
    },
    {
        id: 'unified-block-activity',
        title: 'Unified Block Activity',
        description:
            'Creates a unified block trend across Meraki security events, SD-WAN UTD, Secure Access firewall events, and Secure Firewall/ASA-style feeds.',
        category: 'Security',
        subCategory: 'Hybrid Mesh Firewalling',
        searchId: 'secure_networking_hmf_unified_blocks_trend',
        kind: 'stacked-columns',
        headlineField: 'WindowBlocks',
        headlineUnit: 'blocks',
        deltaField: 'BucketBlocks',
        dynamicSeries: true,
        excludedSeriesFields: ['BucketBlocks'],
        zeroOnlyIsEmpty: true,
        drilldownIds: [
            'secure_networking_fmc_blocked_connection_detail',
            'secure_networking_sse_security_event_detail',
        ],
    },
    {
        id: 'fmc-enforcement-activity',
        title: 'FMC Enforcement Activity',
        description:
            'Hourly time-series trend of Cisco FMC firewall actions and advanced connection observations, enabling operators to correlate enforcement spikes with overall flow activity.',
        category: 'Security',
        subCategory: 'Hybrid Mesh Firewalling',
        searchId: 'secure_networking_fmc_activity_trend',
        kind: 'stacked-columns',
        headlineField: 'WindowBlocks',
        headlineUnit: 'blocked events',
        deltaField: 'Block',
        series: [
            { field: 'Allow', label: 'Allow', color: C3_VISUALIZATION_COLORS.positive },
            { field: 'Block', label: 'Block', color: C3_VISUALIZATION_COLORS.critical },
            { field: 'Trust', label: 'Trust', color: C3_VISUALIZATION_COLORS.info },
            { field: 'Observed', label: 'Observed', color: C3_VISUALIZATION_COLORS.caution },
            { field: 'Other', label: 'Other', color: C3_VISUALIZATION_COLORS.neutral },
        ],
        zeroOnlyIsEmpty: true,
        drilldownIds: [
            'secure_networking_fmc_blocked_connection_detail',
            'secure_networking_fmc_top_policies_by_action',
        ],
    },
    {
        id: 'dns-security-activity',
        title: 'DNS Security Activity',
        description:
            'Hourly trend of Cisco Umbrella/SSE DNS activity split by allow vs block actions, allowing operators to identify spikes in DNS blocking that may correspond to threat campaigns or policy enforcement events.',
        category: 'Security',
        subCategory: 'Hybrid Mesh Firewalling',
        searchId: 'secure_networking_sse_dns_activity_trend',
        kind: 'stacked-columns',
        headlineField: 'WindowBlocked',
        headlineUnit: 'blocked requests',
        deltaField: 'blocked',
        series: [
            { field: 'allowed', label: 'Allowed', color: C3_VISUALIZATION_COLORS.positive },
            { field: 'blocked', label: 'Blocked', color: C3_VISUALIZATION_COLORS.critical },
            { field: 'unknown', label: 'Unknown', color: C3_VISUALIZATION_COLORS.neutral },
        ],
        dynamicSeries: true,
        zeroOnlyIsEmpty: true,
        drilldownIds: [
            'secure_networking_sse_dns_blocked_categories',
            'secure_networking_sse_security_event_detail',
        ],
    },
    {
        id: 'sgt-tagged-policy-decisions',
        title: 'SGT-tagged Policy Decisions',
        description:
            'Trends Palo Alto allow, block, and other traffic decisions carrying time-aware Cisco ISE SGT context; the headline counts blocked tagged decisions.',
        category: 'Security',
        subCategory: 'Hybrid Mesh Firewalling',
        searchId: 'secure_networking_sgt_palo_alto_policy_effectiveness_trend',
        kind: 'stacked-columns',
        headlineField: 'WindowBlocked',
        headlineUnit: 'blocked decisions',
        deltaField: 'Blocked',
        series: [
            { field: 'Allowed', label: 'Allowed', color: C3_VISUALIZATION_COLORS.positive },
            { field: 'Blocked', label: 'Blocked', color: C3_VISUALIZATION_COLORS.critical },
            { field: 'Other', label: 'Other', color: C3_VISUALIZATION_COLORS.neutral },
        ],
        zeroOnlyIsEmpty: true,
        drilldownIds: [
            'secure_networking_sgt_palo_alto_policy_effectiveness',
            'secure_networking_sgt_palo_alto_traffic_detail',
        ],
    },
    {
        id: 'data-protection-findings',
        title: 'Data Protection Findings',
        description:
            'Tracks Secure Access DLP findings by severity over time and moves the full finding breakdown into the drill-down modal.',
        category: 'Security',
        subCategory: 'Hybrid Mesh Firewalling',
        searchId: 'secure_networking_secure_access_dlp_findings_trend',
        kind: 'stacked-columns',
        headlineField: 'WindowElevatedFindings',
        headlineUnit: 'findings',
        deltaField: 'ElevatedFindings',
        series: [
            { field: 'CRITICAL', label: 'Critical', color: C3_VISUALIZATION_COLORS.critical },
            { field: 'HIGH', label: 'High', color: C3_VISUALIZATION_COLORS.orange },
            { field: 'MEDIUM', label: 'Medium', color: C3_VISUALIZATION_COLORS.caution },
            { field: 'LOW', label: 'Low', color: C3_VISUALIZATION_COLORS.info },
            { field: 'UNKNOWN', label: 'Unknown', color: C3_VISUALIZATION_COLORS.neutral },
        ],
        dynamicSeries: true,
        excludedSeriesFields: ['ElevatedFindings'],
        zeroOnlyIsEmpty: true,
        drilldownIds: ['secure_networking_secure_access_dlp_findings'],
    },
] as const;

export const AGENTIC_OPS_CARDS: readonly PillarCardDefinition[] = [
    {
        id: 'degraded-thousandeyes-tests',
        title: 'Degraded ThousandEyes Tests',
        description:
            'Lists the monitored ThousandEyes tests whose observed availability or loss crosses the documented degradation thresholds.',
        category: 'Network',
        subCategory: 'Agentic Ops',
        searchId: 'secure_networking_thousandeyes_test_health_summary',
        kind: 'table',
        headlineField: 'DegradedTests',
        headlineUnit: 'degraded tests',
        tableColumns: ['Test', 'Latest Availability %', 'Peak Loss %', 'Status'],
        drilldownIds: [
            'secure_networking_thousandeyes_http_availability_by_test',
            'secure_networking_thousandeyes_http_trace_log',
        ],
        featured: true,
    },
    {
        id: 'ai-defense-policy-outcomes',
        title: 'AI Defense Policy Outcomes',
        description:
            'Time series trend of Cisco AI Defense Block vs Allow decisions. Useful to spot bursts of denied prompts (likely attack/probing) against the steady-state allow baseline.',
        category: 'Security',
        subCategory: 'GenAI Protection',
        searchId: 'security_ai_defense_action_trend',
        kind: 'stacked-columns',
        headlineField: 'WindowBlocked',
        headlineUnit: 'blocked decisions',
        deltaField: 'Blocked',
        series: [
            { field: 'Allowed', label: 'Allowed', color: C3_VISUALIZATION_COLORS.positive },
            { field: 'Blocked', label: 'Blocked', color: C3_VISUALIZATION_COLORS.critical },
            { field: 'Other', label: 'Other', color: C3_VISUALIZATION_COLORS.neutral },
        ],
        zeroOnlyIsEmpty: true,
        drilldownIds: [
            'security_ai_defense_top_blocked_policies',
            'security_ai_defense_recent_blocked_prompts',
        ],
    },
    {
        id: 'latency-by-reporting-agent',
        title: 'Latency by Reporting Agent',
        description:
            'Ranks ThousandEyes reporting agent locations by selected-window p95 network latency so the worst observed paths are immediately identifiable.',
        category: 'Network',
        subCategory: 'Agentic Ops',
        searchId: 'secure_networking_thousandeyes_latency_by_agent_summary',
        kind: 'ranked-bars',
        headlineField: 'WindowPeakLatencyMs',
        headlineUnit: 'ms',
        categoryField: 'Agent',
        valueField: 'P95 Latency ms',
        valueLabel: 'P95 latency (ms)',
        barColor: C3_VISUALIZATION_COLORS.caution,
        rankLimit: 10,
        categoryAxisWidth: 126,
        drilldownIds: ['secure_networking_thousandeyes_latency_by_agent'],
    },
    {
        id: 'network-loss',
        title: 'Network Loss',
        description:
            'Hourly trend of average and maximum network packet loss from Cisco ThousandEyes, enabling detection of transient vs sustained path quality degradation over time.',
        category: 'Network',
        subCategory: 'Agentic Ops',
        searchId: 'secure_networking_thousandeyes_network_loss_trend',
        kind: 'line',
        headlineField: 'WindowAvgLossPct',
        headlineUnit: '%',
        deltaField: 'avg_loss_pct',
        series: [
            {
                field: 'avg_loss_pct',
                label: 'Average loss',
                color: C3_VISUALIZATION_COLORS.info,
            },
            {
                field: 'max_loss_pct',
                label: 'Maximum loss',
                color: C3_VISUALIZATION_COLORS.critical,
            },
        ],
        connectNulls: true,
        thresholds: {
            direction: 'lower-is-better',
            healthyMax: 1,
            warningMax: 3,
        },
        drilldownIds: [
            'secure_networking_thousandeyes_latency_by_agent',
            'secure_networking_thousandeyes_http_trace_log',
        ],
    },
    {
        id: 'lowest-application-availability',
        title: 'Lowest Application Availability',
        description:
            'Ranks monitored ThousandEyes tests by their lowest observed HTTP availability and retains average and latest values in the metric detail.',
        category: 'Network',
        subCategory: 'Agentic Ops',
        searchId: 'secure_networking_thousandeyes_http_availability_summary',
        kind: 'ranked-bars',
        headlineField: 'WindowMinAvailabilityPct',
        headlineUnit: '%',
        categoryField: 'Test',
        valueField: 'Minimum Availability %',
        valueLabel: 'Minimum availability (%)',
        barColor: C3_VISUALIZATION_COLORS.positive,
        rankLimit: 10,
        categoryAxisWidth: 126,
        drilldownIds: [
            'secure_networking_thousandeyes_http_availability_by_test',
            'secure_networking_thousandeyes_http_trace_log',
        ],
    },
    {
        id: 'bgp-path-changes-by-test',
        title: 'BGP Path Changes by Test',
        description:
            'Ranks monitored ThousandEyes tests by observed BGP path changes so the reporting tests driving routing instability are visible.',
        category: 'Network',
        subCategory: 'Agentic Ops',
        searchId: 'secure_networking_thousandeyes_bgp_path_changes_summary',
        kind: 'ranked-bars',
        headlineField: 'WindowPathChanges',
        headlineUnit: 'path changes',
        categoryField: 'Test',
        valueField: 'Path Changes',
        valueLabel: 'Path changes',
        barColor: C3_VISUALIZATION_COLORS.cyan,
        rankLimit: 10,
        categoryAxisWidth: 126,
        drilldownIds: ['secure_networking_thousandeyes_bgp_path_change_detail'],
    },
] as const;

export const PILLAR_CARDS: Readonly<Record<PillarId, readonly PillarCardDefinition[]>> = {
    'zero-trust-access': ZERO_TRUST_CARDS,
    'secure-infrastructure': SECURE_INFRASTRUCTURE_CARDS,
    'scalable-network-segmentation': SEGMENTATION_CARDS,
    'hybrid-mesh-firewalling': HYBRID_MESH_FIREWALLING_CARDS,
    'agentic-ops': AGENTIC_OPS_CARDS,
};

export const isPillarId = (value: unknown): value is PillarId =>
    typeof value === 'string' && PILLARS.some((pillar) => pillar.id === value);
