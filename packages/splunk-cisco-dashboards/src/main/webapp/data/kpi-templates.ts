export type KPISectionId = 'it-health' | 'benefits' | 'building-intelligence';

export type KPIChartType = 'area' | 'line' | 'column' | 'bar' | 'sparkline';

export type KPIThresholdDirection = 'higher-is-better' | 'lower-is-better';

export type KPIIconName =
    | 'activity'
    | 'database'
    | 'wifi'
    | 'server'
    | 'shield'
    | 'lock'
    | 'zap'
    | 'hard-drive'
    | 'radio'
    | 'cloud'
    | 'building'
    | 'gauge';

export interface KPIThresholds {
    healthy: number;
    warning: number;
    critical: number;
    direction: KPIThresholdDirection;
}

export interface KPIDisplayOptions {
    hidePeakLabels: boolean;
    hideDelta: boolean;
    hideAbsoluteLabel: boolean;
}

export interface KPITemplate {
    id: string;
    title: string;
    subtitle?: string;
    value: number;
    unit?: string;
    valueLabel?: string;
    progress: number;
    trend: number;
    app: string;
    category: string;
    subCategory: string;
    tags: string[];
    description: string;
    icon: KPIIconName;
    color: string;
    chartType: KPIChartType;
    thresholds: KPIThresholds;
    series: number[];
    display: KPIDisplayOptions;
}

export interface KPIInstance extends KPITemplate {
    instanceId: string;
    templateId: string;
    sectionId: KPISectionId;
}

export const KPI_SECTION_TITLES: Record<KPISectionId, string> = {
    'it-health': 'IT Health',
    benefits: 'Benefits',
    'building-intelligence': 'Building Intelligence',
};

export const DEFAULT_SECTION_TEMPLATE_IDS: Record<KPISectionId, string[]> = {
    'it-health': [
        'it-health-availability',
        'data-available',
        'internet-health',
        'active-it-assets',
    ],
    benefits: [
        'power-outages',
        'active-licenses',
        'failed-logins',
        'security-score',
    ],
    'building-intelligence': [
        'active-devices',
        'wifi-clients',
        'bandwidth-usage',
        'storage-used',
    ],
};

const displayDefaults: KPIDisplayOptions = {
    hidePeakLabels: false,
    hideDelta: false,
    hideAbsoluteLabel: false,
};

export const KPI_TEMPLATES: KPITemplate[] = [
    {
        id: 'it-health-availability',
        title: 'IT Health',
        subtitle: 'available',
        value: 3,
        valueLabel: '3 of 8',
        progress: 67,
        trend: -5,
        unit: '',
        app: 'splunk-cisco-dashboards',
        category: 'Network',
        subCategory: 'Health',
        tags: ['health', 'availability', 'network'],
        description:
            'Composite health status across critical network, internet, and infrastructure signals.',
        icon: 'activity',
        color: '#f97316',
        chartType: 'sparkline',
        thresholds: {
            healthy: 90,
            warning: 75,
            critical: 50,
            direction: 'higher-is-better',
        },
        series: [62, 66, 68, 64, 61, 69, 72, 70, 67],
        display: displayDefaults,
    },
    {
        id: 'data-available',
        title: 'Data Available',
        subtitle: 'pts',
        value: 940,
        progress: 94,
        trend: 12,
        unit: 'pts',
        app: 'splunk-cisco-dashboards',
        category: 'Platform',
        subCategory: 'Ingestion',
        tags: ['data', 'telemetry', 'health'],
        description: 'Percentage of data points available and successfully collected.',
        icon: 'database',
        color: '#10b981',
        chartType: 'area',
        thresholds: {
            healthy: 90,
            warning: 80,
            critical: 70,
            direction: 'higher-is-better',
        },
        series: [82, 84, 86, 88, 90, 92, 94],
        display: displayDefaults,
    },
    {
        id: 'internet-health',
        title: 'Internet Health',
        subtitle: 'site',
        value: 1,
        progress: 100,
        trend: 0,
        unit: 'site',
        app: 'thousandeyes-monitoring',
        category: 'Internet',
        subCategory: 'Path Health',
        tags: ['internet', 'wan', 'thousandeyes'],
        description: 'Current health of monitored internet paths and external services.',
        icon: 'wifi',
        color: '#10b981',
        chartType: 'line',
        thresholds: {
            healthy: 95,
            warning: 80,
            critical: 60,
            direction: 'higher-is-better',
        },
        series: [100, 100, 100, 99, 100, 100],
        display: displayDefaults,
    },
    {
        id: 'active-it-assets',
        title: 'Active IT Assets',
        subtitle: 'devices',
        value: 52,
        progress: 88,
        trend: 3,
        unit: 'devices',
        app: 'asset-inventory',
        category: 'Infrastructure',
        subCategory: 'Inventory',
        tags: ['asset', 'inventory', 'devices'],
        description: 'Total active network devices reporting telemetry in the selected time window.',
        icon: 'server',
        color: '#14b8a6',
        chartType: 'column',
        thresholds: {
            healthy: 45,
            warning: 35,
            critical: 25,
            direction: 'higher-is-better',
        },
        series: [38, 42, 45, 49, 52],
        display: displayDefaults,
    },
    {
        id: 'power-outages',
        title: 'Power Outages',
        value: 2400,
        valueLabel: '2.4k',
        progress: 76,
        trend: -8,
        app: 'building-resilience',
        category: 'Facilities',
        subCategory: 'Power',
        tags: ['power', 'outage', 'facilities'],
        description: 'Reported power events and outage impact across monitored sites.',
        icon: 'zap',
        color: '#10b981',
        chartType: 'area',
        thresholds: {
            healthy: 1200,
            warning: 2200,
            critical: 3200,
            direction: 'lower-is-better',
        },
        series: [88, 80, 74, 70, 68, 65, 63],
        display: displayDefaults,
    },
    {
        id: 'active-licenses',
        title: 'Active Licenses',
        value: 575,
        progress: 92,
        trend: 12,
        app: 'licensing',
        category: 'Operations',
        subCategory: 'Entitlements',
        tags: ['licenses', 'benefits', 'capacity'],
        description: 'Active software and platform licenses currently assigned to users or assets.',
        icon: 'shield',
        color: '#10b981',
        chartType: 'line',
        thresholds: {
            healthy: 500,
            warning: 420,
            critical: 350,
            direction: 'higher-is-better',
        },
        series: [520, 528, 541, 552, 563, 575],
        display: displayDefaults,
    },
    {
        id: 'failed-logins',
        title: 'Failed Logins',
        value: 26,
        progress: 58,
        trend: -15,
        app: 'security-monitoring',
        category: 'Security',
        subCategory: 'Authentication',
        tags: ['security', 'authentication', 'monitoring'],
        description: 'Number of failed authentication attempts in the last 24 hours.',
        icon: 'lock',
        color: '#10b981',
        chartType: 'column',
        thresholds: {
            healthy: 20,
            warning: 45,
            critical: 75,
            direction: 'lower-is-better',
        },
        series: [44, 40, 36, 34, 31, 26],
        display: displayDefaults,
    },
    {
        id: 'security-score',
        title: 'Security Score',
        value: 72,
        progress: 72,
        trend: 5,
        unit: '%',
        app: 'security-monitoring',
        category: 'Security',
        subCategory: 'Posture',
        tags: ['score', 'security', 'risk'],
        description: 'Composite security posture based on authentication, firewall, and endpoint signals.',
        icon: 'gauge',
        color: '#f59e0b',
        chartType: 'area',
        thresholds: {
            healthy: 85,
            warning: 70,
            critical: 50,
            direction: 'higher-is-better',
        },
        series: [63, 65, 66, 68, 70, 71, 72],
        display: displayDefaults,
    },
    {
        id: 'active-devices',
        title: 'Active Devices',
        value: 381,
        progress: 91,
        trend: 4,
        app: 'building-intelligence',
        category: 'Building',
        subCategory: 'Device Health',
        tags: ['building', 'devices', 'sensors'],
        description: 'Building sensors and connected devices that are actively reporting telemetry.',
        icon: 'server',
        color: '#10b981',
        chartType: 'column',
        thresholds: {
            healthy: 340,
            warning: 280,
            critical: 220,
            direction: 'higher-is-better',
        },
        series: [320, 336, 351, 366, 381],
        display: displayDefaults,
    },
    {
        id: 'wifi-clients',
        title: 'Wi-Fi Clients',
        value: 1180,
        valueLabel: '1.18k',
        progress: 86,
        trend: 39,
        app: 'splunk-cisco-dashboards',
        category: 'Network',
        subCategory: 'Wireless',
        tags: ['wireless', 'clients', 'wifi'],
        description: 'Total number of connected wireless clients across all access points.',
        icon: 'wifi',
        color: '#f97316',
        chartType: 'line',
        thresholds: {
            healthy: 800,
            warning: 600,
            critical: 400,
            direction: 'higher-is-better',
        },
        series: [640, 720, 800, 930, 1060, 1180],
        display: displayDefaults,
    },
    {
        id: 'bandwidth-usage',
        title: 'Bandwidth Usage',
        subtitle: 'Mbps',
        value: 742,
        progress: 78,
        trend: 15,
        unit: 'Mbps',
        app: 'splunk-cisco-dashboards',
        category: 'Network',
        subCategory: 'Performance',
        tags: ['bandwidth', 'performance', 'utilization'],
        description: 'Average bandwidth utilization across all monitored network interfaces.',
        icon: 'activity',
        color: '#f97316',
        chartType: 'sparkline',
        thresholds: {
            healthy: 600,
            warning: 780,
            critical: 900,
            direction: 'lower-is-better',
        },
        series: [610, 640, 680, 700, 724, 742],
        display: displayDefaults,
    },
    {
        id: 'storage-used',
        title: 'Storage Used',
        value: 63,
        progress: 63,
        trend: 8,
        unit: '%',
        app: 'building-intelligence',
        category: 'Building',
        subCategory: 'Capacity',
        tags: ['storage', 'capacity', 'building'],
        description: 'Storage utilization for building telemetry archives and operational datasets.',
        icon: 'hard-drive',
        color: '#10b981',
        chartType: 'bar',
        thresholds: {
            healthy: 65,
            warning: 80,
            critical: 90,
            direction: 'lower-is-better',
        },
        series: [44, 49, 53, 58, 63],
        display: displayDefaults,
    },
    {
        id: 'network-health-score',
        title: 'Network Health Score',
        value: 91,
        progress: 91,
        trend: 7,
        unit: '%',
        app: 'splunk-cisco-dashboards',
        category: 'Network',
        subCategory: 'Health',
        tags: ['network', 'cisco', 'health'],
        description:
            "Latest network-wide health score from Catalyst Center for the 'All' category.",
        icon: 'wifi',
        color: '#10b981',
        chartType: 'area',
        thresholds: {
            healthy: 90,
            warning: 80,
            critical: 70,
            direction: 'higher-is-better',
        },
        series: [83, 85, 87, 88, 90, 91],
        display: displayDefaults,
    },
    {
        id: 'sites-below-threshold',
        title: 'Sites < 90%',
        value: 2,
        progress: 84,
        trend: -2,
        app: 'splunk-cisco-dashboards',
        category: 'Network',
        subCategory: 'Client Distribution',
        tags: ['sites', 'threshold', 'monitoring'],
        description:
            "Two-slice breakdown of wireless versus wired client populations using Catalyst Center's ALL-score counts.",
        icon: 'radio',
        color: '#f97316',
        chartType: 'bar',
        thresholds: {
            healthy: 0,
            warning: 2,
            critical: 5,
            direction: 'lower-is-better',
        },
        series: [5, 4, 3, 3, 2],
        display: displayDefaults,
    },
    {
        id: 'ssl-expiring',
        title: 'SSL Certificates Expiring',
        value: 4,
        progress: 73,
        trend: -1,
        app: 'security-monitoring',
        category: 'Security',
        subCategory: 'Certificates',
        tags: ['ssl', 'certificates', 'expiration'],
        description: 'SSL/TLS certificates expiring within the next 30 days.',
        icon: 'shield',
        color: '#f97316',
        chartType: 'column',
        thresholds: {
            healthy: 0,
            warning: 5,
            critical: 10,
            direction: 'lower-is-better',
        },
        series: [7, 6, 5, 5, 4],
        display: displayDefaults,
    },
    {
        id: 'firewall-rules',
        title: 'Active Firewall Rules',
        value: 1280,
        valueLabel: '1.28k',
        progress: 82,
        trend: 6,
        app: 'security-monitoring',
        category: 'Security',
        subCategory: 'Firewall',
        tags: ['firewall', 'rules', 'security'],
        description: 'Total number of active firewall rules across all security devices.',
        icon: 'shield',
        color: '#10b981',
        chartType: 'line',
        thresholds: {
            healthy: 1000,
            warning: 700,
            critical: 500,
            direction: 'higher-is-better',
        },
        series: [1180, 1195, 1210, 1240, 1260, 1280],
        display: displayDefaults,
    },
    {
        id: 'cloud-service-health',
        title: 'Cloud Service Health',
        value: 98,
        progress: 98,
        trend: 2,
        unit: '%',
        app: 'cloud-monitoring',
        category: 'Cloud',
        subCategory: 'Availability',
        tags: ['cloud', 'availability', 'health'],
        description: 'Availability of critical cloud services used by the organization.',
        icon: 'cloud',
        color: '#10b981',
        chartType: 'area',
        thresholds: {
            healthy: 95,
            warning: 85,
            critical: 75,
            direction: 'higher-is-better',
        },
        series: [94, 95, 96, 97, 98],
        display: displayDefaults,
    },
    {
        id: 'occupancy-health',
        title: 'Occupancy Health',
        value: 64,
        progress: 64,
        trend: 9,
        unit: '%',
        app: 'building-intelligence',
        category: 'Building',
        subCategory: 'Occupancy',
        tags: ['occupancy', 'spaces', 'building'],
        description: 'Utilization health derived from occupancy trends and configured target bands.',
        icon: 'building',
        color: '#0ea5e9',
        chartType: 'area',
        thresholds: {
            healthy: 55,
            warning: 75,
            critical: 90,
            direction: 'lower-is-better',
        },
        series: [48, 52, 56, 58, 61, 64],
        display: displayDefaults,
    },
];

export const createKPIInstance = (
    template: KPITemplate,
    sectionId: KPISectionId,
    instanceId = `${sectionId}-${template.id}`
): KPIInstance => ({
    ...template,
    sectionId,
    templateId: template.id,
    instanceId,
    display: { ...template.display },
    thresholds: { ...template.thresholds },
    tags: [...template.tags],
    series: [...template.series],
});

export const getTemplateById = (id: string): KPITemplate | undefined =>
    KPI_TEMPLATES.find((template) => template.id === id);
