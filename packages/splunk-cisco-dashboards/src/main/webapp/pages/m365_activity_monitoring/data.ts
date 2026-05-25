export type MetricTone = 'indigo' | 'teal' | 'rose' | 'amber' | 'violet' | 'slate';

export interface MetricData {
    title: string;
    value: string;
    trend?: string;
    trendDirection?: 'up' | 'down';
    goodWhen?: 'up' | 'down';
    tone?: MetricTone;
}

export interface WorkloadPoint {
    date: string;
    exchange: number;
    teams: number;
    azureAd: number;
}

export interface OperationPoint {
    name: string;
    value: number;
}

export interface DistributionPoint {
    name: string;
    value: number;
    color: string;
}

export interface AuthTrendPoint {
    date: string;
    successful: number;
    failed: number;
}

export interface ClientActivityPoint {
    date: string;
    events: number;
}

export const overviewMetrics: MetricData[] = [
    {
        title: 'Total Events',
        value: '1.2M',
        trend: '+5.2%',
        trendDirection: 'up',
        tone: 'indigo',
    },
    {
        title: 'Unique Users',
        value: '1,452',
        trend: '+1.1%',
        trendDirection: 'up',
        tone: 'teal',
    },
    {
        title: 'Unique Client IPs',
        value: '845',
        trend: '-2.4%',
        trendDirection: 'down',
        tone: 'violet',
    },
    {
        title: 'Failed Logins',
        value: '12.5K',
        trend: '+15.3%',
        trendDirection: 'up',
        goodWhen: 'down',
        tone: 'rose',
    },
];

export const executiveMetrics: MetricData[] = [
    {
        title: 'Total Authentications',
        value: '3.4M',
        trend: '+12.5%',
        trendDirection: 'up',
        tone: 'indigo',
    },
    {
        title: 'Suspicious Activities',
        value: '142',
        trend: '-5.1%',
        trendDirection: 'down',
        goodWhen: 'down',
        tone: 'rose',
    },
    {
        title: 'Active Workloads',
        value: '5',
        tone: 'amber',
    },
];

export const clientMetrics: MetricData[] = [
    {
        title: 'Total Client Events',
        value: '845.2K',
        trend: '+2.1%',
        trendDirection: 'up',
        tone: 'indigo',
    },
    {
        title: 'Unique Client IPs',
        value: '1,204',
        trend: '+5.4%',
        trendDirection: 'up',
        goodWhen: 'down',
        tone: 'teal',
    },
    {
        title: 'Unique Devices',
        value: '3,492',
        trend: '+0.8%',
        trendDirection: 'up',
        tone: 'violet',
    },
];

export const overviewTimeline: WorkloadPoint[] = [
    { date: 'May 10', exchange: 5200, teams: 8700, azureAd: 7200 },
    { date: 'May 11', exchange: 3200, teams: 8900, azureAd: 1800 },
    { date: 'May 12', exchange: 2500, teams: 6400, azureAd: 5100 },
    { date: 'May 13', exchange: 2600, teams: 8300, azureAd: 6700 },
    { date: 'May 14', exchange: 4100, teams: 7900, azureAd: 1200 },
    { date: 'May 15', exchange: 4700, teams: 11100, azureAd: 2600 },
    { date: 'May 16', exchange: 5600, teams: 15200, azureAd: 4200 },
    { date: 'May 17', exchange: 4200, teams: 13200, azureAd: 6100 },
    { date: 'May 18', exchange: 1400, teams: 7100, azureAd: 1700 },
    { date: 'May 19', exchange: 3300, teams: 12800, azureAd: 7800 },
    { date: 'May 20', exchange: 2300, teams: 6600, azureAd: 1900 },
    { date: 'May 21', exchange: 5800, teams: 9400, azureAd: 3600 },
    { date: 'May 22', exchange: 3100, teams: 6200, azureAd: 6800 },
    { date: 'May 23', exchange: 5100, teams: 14600, azureAd: 4300 },
    { date: 'May 24', exchange: 5900, teams: 8200, azureAd: 2500 },
];

export const topOperations: OperationPoint[] = [
    { name: 'UserLoginFailed', value: 12480 },
    { name: 'FileDownloaded', value: 9810 },
    { name: 'MailboxLogin', value: 8420 },
    { name: 'MessageSent', value: 7160 },
    { name: 'FileModified', value: 6050 },
    { name: 'TeamCreated', value: 380 },
    { name: 'PasswordChanged', value: 260 },
];

export const workloadDistribution: DistributionPoint[] = [
    { name: 'Azure AD', value: 44, color: '#6366f1' },
    { name: 'Teams', value: 30, color: '#14b8a6' },
    { name: 'Exchange', value: 15, color: '#f43f5e' },
    { name: 'SharePoint', value: 7, color: '#f59e0b' },
    { name: 'OneDrive', value: 4, color: '#8b5cf6' },
];

export const authTrend: AuthTrendPoint[] = [
    { date: 'Apr 25', successful: 17600, failed: 260 },
    { date: 'Apr 26', successful: 6900, failed: 390 },
    { date: 'Apr 27', successful: 5200, failed: 285 },
    { date: 'Apr 28', successful: 17800, failed: 640 },
    { date: 'Apr 29', successful: 10400, failed: 430 },
    { date: 'Apr 30', successful: 13100, failed: 510 },
    { date: 'May 1', successful: 8700, failed: 360 },
    { date: 'May 2', successful: 9600, failed: 480 },
    { date: 'May 3', successful: 17700, failed: 730 },
    { date: 'May 4', successful: 11200, failed: 420 },
    { date: 'May 5', successful: 9900, failed: 390 },
    { date: 'May 6', successful: 12300, failed: 560 },
    { date: 'May 7', successful: 18300, failed: 890 },
    { date: 'May 8', successful: 5300, failed: 410 },
    { date: 'May 9', successful: 19000, failed: 980 },
    { date: 'May 10', successful: 10900, failed: 490 },
    { date: 'May 11', successful: 6100, failed: 300 },
    { date: 'May 12', successful: 5400, failed: 315 },
    { date: 'May 13', successful: 17300, failed: 620 },
    { date: 'May 14', successful: 16900, failed: 590 },
    { date: 'May 15', successful: 10800, failed: 460 },
    { date: 'May 16', successful: 16300, failed: 670 },
    { date: 'May 17', successful: 18400, failed: 740 },
    { date: 'May 18', successful: 13200, failed: 520 },
    { date: 'May 19', successful: 14100, failed: 610 },
    { date: 'May 20', successful: 11300, failed: 455 },
    { date: 'May 21', successful: 19800, failed: 1080 },
    { date: 'May 22', successful: 9400, failed: 390 },
    { date: 'May 23', successful: 13900, failed: 580 },
    { date: 'May 24', successful: 13300, failed: 540 },
];

export const clientActivity: ClientActivityPoint[] = [
    { date: 'May 17', events: 5600 },
    { date: 'May 18', events: 3100 },
    { date: 'May 19', events: 5700 },
    { date: 'May 20', events: 1200 },
    { date: 'May 21', events: 5300 },
    { date: 'May 22', events: 1800 },
    { date: 'May 23', events: 4900 },
    { date: 'May 24', events: 4450 },
];

export const topUsers: OperationPoint[] = [
    { name: 'admin@corp.com', value: 14560 },
    { name: 'j.doe@corp.com', value: 8260 },
    { name: 'svc_account@corp.com', value: 7140 },
    { name: 's.smith@corp.com', value: 5420 },
    { name: 'a.jones@corp.com', value: 4210 },
    { name: 'm.brown@corp.com', value: 3890 },
    { name: 'backup_exec@corp.com', value: 3120 },
    { name: 'p.davis@corp.com', value: 2840 },
];

export const topClientIps: OperationPoint[] = [
    { name: '192.168.1.100', value: 5480 },
    { name: '10.0.0.52', value: 4260 },
    { name: '172.16.0.12', value: 3860 },
    { name: '203.0.113.45', value: 2190 },
    { name: '198.51.100.8', value: 1580 },
    { name: '45.22.19.100', value: 920 },
];

export const versionInfo = [
    { label: 'App Version', value: 'v3.2.0' },
    { label: 'Last Updated', value: 'May 25, 2026' },
    { label: 'Author', value: 'Security Eng Team' },
    { label: 'Compatibility', value: 'Splunk Cloud 9.x+' },
];
