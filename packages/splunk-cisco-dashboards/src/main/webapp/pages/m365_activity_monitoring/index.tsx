import React from 'react';
import Button from '@splunk/react-ui/Button';
import useSplunkTheme from '@splunk/themes/useSplunkTheme';
import {
    Link,
    RouterProvider,
    createBrowserRouter,
    useSearchParams,
} from 'react-router-dom';
import {
    Activity,
    BarChart3,
    Calendar,
    ChevronDown,
    Database,
    Download,
    ExternalLink,
    FileText,
    Globe2,
    Laptop,
    MoreVertical,
    Settings,
    Shield,
    ShieldAlert,
    ShieldCheck,
    Share2,
    SlidersHorizontal,
    Users,
} from '@/common/icons/SuiIcon';
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Line,
    LineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { cn } from '@/common/lib/utils';
import ThemeAwareSearch from '@/common/components/ThemeAwareSearch';
import { C3_VISUALIZATION_COLORS } from '@/common/theme/c3VisualizationPalette';
import {
    authTrend,
    clientActivity,
    clientMetrics,
    executiveMetrics,
    overviewMetrics,
    overviewTimeline,
    topClientIps,
    topOperations,
    topUsers,
    versionInfo,
    workloadDistribution,
    type MetricData,
    type MetricTone,
    type OperationPoint,
} from './data';

const VIEW_NAME = 'workplace_m365_activity_monitoring';

type IconComponent = React.ComponentType<{ className?: string }>;

interface PanelProps {
    title?: string;
    children: React.ReactNode;
    className?: string;
    bodyClassName?: string;
}

interface FilterItem {
    label: string;
    value: string;
}

interface FilterBarProps {
    filters: FilterItem[];
}

interface MetricProps extends MetricData {
    icon: IconComponent;
    className?: string;
}

interface TooltipPayload {
    color?: string;
    dataKey?: string;
    name?: string;
    value?: number | string;
}

interface CustomTooltipProps {
    active?: boolean;
    label?: string | number;
    payload?: TooltipPayload[];
}

const toneClasses: Record<MetricTone, string> = {
    indigo: 'sui-border-notification-info sui-bg-notification-info',
    teal: 'sui-border-notification-info sui-bg-notification-info',
    rose: 'sui-border-notification-negative sui-bg-notification-negative',
    amber: 'sui-border-notification-warning sui-bg-notification-warning',
    violet: 'sui-border-notification-info sui-bg-notification-info',
    slate: 'sui-border-weak sui-bg-section',
};

const navItems = [
    { label: 'Overview', tab: 'overview', to: '/' },
    { label: 'Executive Summary', tab: 'executive-summary', to: '/?tab=executive-summary' },
    { label: 'Client Summary', tab: 'client-summary', to: '/?tab=client-summary' },
    { label: 'About', tab: 'about', to: '/?tab=about' },
];

const chartMargins = { top: 22, right: 28, bottom: 8, left: 0 };
const verticalChartMargins = { top: 24, right: 28, bottom: 8, left: 18 };

const getSplunkViewBasename = (): string => {
    if (typeof window === 'undefined') return `/${VIEW_NAME}`;

    const parts = window.location.pathname.split('/');
    const viewIndex = parts.findIndex((part) => part === VIEW_NAME);
    if (viewIndex === -1) return window.location.pathname.replace(/\/$/, '');

    return parts.slice(0, viewIndex + 1).join('/') || `/${VIEW_NAME}`;
};

const formatShortNumber = (value: number): string => {
    const abs = Math.abs(value);
    if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) {
        const next = value / 1_000;
        return `${Number.isInteger(next) ? next.toFixed(0) : next.toFixed(1)}k`;
    }
    return String(value);
};

const formatTooltipName = (name?: string): string => {
    if (!name) return '';
    return name
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (char) => char.toUpperCase())
        .trim();
};

const Panel: React.FC<PanelProps> = ({ title, children, className, bodyClassName }) => (
    <section
        className={cn(
            'overflow-hidden rounded-lg border sui-border-weak sui-bg-section sui-shadow-overlay',
            className
        )}
    >
        {title ? (
            <div className="border-b sui-border-weak px-4 py-3">
                <h2 className="text-sm font-bold sui-color-active">{title}</h2>
            </div>
        ) : null}
        <div className={cn('p-4', bodyClassName)}>{children}</div>
    </section>
);

const Metric: React.FC<MetricProps> = ({
    title,
    value,
    trend,
    trendDirection = 'up',
    goodWhen = 'up',
    tone = 'slate',
    icon: Icon,
    className,
}) => {
    const positive = trendDirection === goodWhen;
    const trendClass = positive ? 'sui-color-positive' : 'sui-color-negative';

    return (
        <Panel
            className={cn('min-h-[108px]', toneClasses[tone], className)}
            bodyClassName="flex h-full flex-col justify-center"
        >
            <div className="flex items-center gap-2 sui-color-default">
                <Icon className="h-4 w-4" />
                <span className="text-xs font-black uppercase tracking-[0.16em]">
                    {title}
                </span>
            </div>
            <div className="mt-4 flex items-end gap-3">
                <span className="text-3xl font-semibold tracking-tight sui-color-active">
                    {value}
                </span>
                {trend ? (
                    <span className={cn('pb-1 text-sm font-black', trendClass)}>
                        {trend}
                    </span>
                ) : null}
            </div>
        </Panel>
    );
};

const FilterBar: React.FC<FilterBarProps> = ({ filters }) => (
    <Panel className="rounded-lg" bodyClassName="flex flex-wrap items-center gap-3 p-3">
        <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-md border sui-border-default sui-bg-popup px-3 text-sm font-bold sui-color-active transition sui-hover-border-info sui-hover-bg-overlay"
        >
            <Calendar className="h-4 w-4 sui-color-default" />
            Last 24 Hours
            <ChevronDown className="h-4 w-4 sui-color-muted" />
        </button>
        <div className="hidden h-8 w-px sui-bg-popup sm:block" />
        {filters.map((filter) => (
            <button
                key={filter.label}
                type="button"
                className="inline-flex h-9 min-w-[130px] items-center justify-between gap-3 rounded-md border border-dashed sui-border-default sui-bg-page px-3 text-sm sui-color-default transition sui-hover-border-info sui-hover-color-active"
            >
                <span>
                    {filter.label}: <strong className="font-bold sui-color-active">{filter.value}</strong>
                </span>
                <ChevronDown className="h-4 w-4 sui-color-default" />
            </button>
        ))}
        <div className="ml-auto min-w-[250px] flex-1 sm:max-w-xs">
            <span id="m365-dashboard-search-label" className="sr-only">
                Search dashboard
            </span>
            <ThemeAwareSearch
                labelledBy="m365-dashboard-search-label"
                placeholder="Search in dashboard..."
            />
        </div>
    </Panel>
);

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;

    return (
        <div className="rounded-lg border sui-border-default sui-bg-page px-3 py-2 shadow-2xl backdrop-blur">
            {label ? (
                <div className="mb-2 text-xs font-bold uppercase tracking-widest sui-color-default">
                    {label}
                </div>
            ) : null}
            <div className="space-y-1.5">
                {payload.map((item) => (
                    <div
                        key={`${item.name ?? item.dataKey}-${item.value}`}
                        className="flex min-w-[150px] items-center justify-between gap-5 text-xs"
                    >
                        <span className="flex items-center gap-2 sui-color-default">
                            <span
                                className="h-2 w-2 rounded-full"
                                style={{
                                    backgroundColor:
                                        item.color ?? C3_VISUALIZATION_COLORS.info,
                                }}
                            />
                            {formatTooltipName(item.name ?? item.dataKey)}
                        </span>
                        <strong className="font-semibold sui-color-active">
                            {typeof item.value === 'number'
                                ? formatShortNumber(item.value)
                                : item.value}
                        </strong>
                    </div>
                ))}
            </div>
        </div>
    );
};

const AppHeader: React.FC = () => (
    <header className="flex min-h-[72px] items-center justify-between border-b sui-border-weak sui-bg-section px-6 backdrop-blur">
        <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md border sui-border-info sui-bg-accent sui-color-info">
                <Activity className="h-5 w-5" />
            </div>
            <div>
                <h1 className="text-xl font-black tracking-tight sui-color-active">
                    M365 Activity Monitoring
                </h1>
                <p className="text-xs font-medium sui-color-muted">
                    Splunk Add-on for Microsoft Office 365
                </p>
            </div>
        </div>
        <div className="flex items-center gap-4 sui-color-default">
            <div className="inline-flex items-center gap-2 text-sm font-semibold">
                <span className="h-2 w-2 animate-pulse rounded-full sui-bg-status-positive sui-shadow-overlay" />
                Live Data
            </div>
            <div className="h-6 w-px sui-bg-popup" />
            {[
                { Icon: Download, label: 'Download dashboard' },
                { Icon: Share2, label: 'Share dashboard' },
                { Icon: Settings, label: 'Dashboard settings' },
                { Icon: MoreVertical, label: 'More dashboard actions' },
            ].map(({ Icon, label }) => (
                <Button
                    appearance="subtle"
                    hideLabel
                    icon={<Icon className="h-4 w-4" />}
                    key={label}
                    label={label}
                />
            ))}
        </div>
    </header>
);

const Navigation: React.FC = () => (
    <NavigationInner />
);

const NavigationInner: React.FC = () => {
    const [searchParams] = useSearchParams();
    const activeTab = searchParams.get('tab') || 'overview';

    return (
        <nav className="flex h-12 items-end gap-1 border-b sui-border-weak sui-bg-page px-6">
            {navItems.map((item) => {
                const isActive = activeTab === item.tab;

                return (
                    <Link
                        aria-current={isActive ? 'page' : undefined}
                        key={item.tab}
                        to={item.to}
                        className={cn(
                            'flex h-full items-center border-b-2 px-4 text-sm font-bold transition',
                            isActive
                                ? 'sui-border-info sui-color-info'
                                : 'sui-border-transparent sui-color-default sui-hover-color-active'
                        )}
                    >
                        {item.label}
                    </Link>
                );
            })}
        </nav>
    );
};

const RoutedContent: React.FC = () => {
    const [searchParams] = useSearchParams();
    const activeTab = searchParams.get('tab') || 'overview';

    if (activeTab === 'executive-summary') return <ExecutiveSummary />;
    if (activeTab === 'client-summary') return <ClientSummary />;
    if (activeTab === 'about') return <About />;
    return <Overview />;
};

const DashboardShell: React.FC = () => (
    <div className="m365-dashboard scd-c3-atmosphere min-h-screen sui-bg-section font-sans sui-color-active">
        <AppHeader />
        <Navigation />
        <main className="max-h-[calc(100vh-120px)] overflow-y-auto px-6 py-6">
            <RoutedContent />
        </main>
    </div>
);

const ChartLegend: React.FC<{ items: Array<{ name: string; color: string }> }> = ({
    items,
}) => (
    <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
        {items.map((item) => (
            <div key={item.name} className="flex items-center gap-2 text-sm sui-color-default">
                <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                />
                {item.name}
            </div>
        ))}
    </div>
);

const Overview: React.FC = () => {
    const theme = useSplunkTheme();
    return (
        <div className="space-y-6">
        <FilterBar
            filters={[
                { label: 'Workload', value: 'All' },
                { label: 'Operation', value: 'All' },
                { label: 'User', value: 'All' },
                { label: 'Client IP', value: 'All' },
            ]}
        />
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            <Metric {...overviewMetrics[0]} icon={Activity} />
            <Metric {...overviewMetrics[1]} icon={Users} />
            <Metric {...overviewMetrics[2]} icon={Globe2} />
            <Metric {...overviewMetrics[3]} icon={ShieldAlert} />
        </div>
        <div className="grid gap-6 xl:grid-cols-3">
            <Panel
                title="Events over Time by Workload"
                className="xl:col-span-2"
                bodyClassName="h-[330px] p-4"
            >
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={overviewTimeline} margin={chartMargins}>
                        <defs>
                            <linearGradient id="m365Exchange" x1="0" x2="0" y1="0" y2="1">
                                <stop offset="0%" stopColor={C3_VISUALIZATION_COLORS.info} stopOpacity={0.45} />
                                <stop offset="100%" stopColor={C3_VISUALIZATION_COLORS.info} stopOpacity={0.03} />
                            </linearGradient>
                            <linearGradient id="m365Teams" x1="0" x2="0" y1="0" y2="1">
                                <stop offset="0%" stopColor={C3_VISUALIZATION_COLORS.positive} stopOpacity={0.4} />
                                <stop offset="100%" stopColor={C3_VISUALIZATION_COLORS.positive} stopOpacity={0.03} />
                            </linearGradient>
                            <linearGradient id="m365Azure" x1="0" x2="0" y1="0" y2="1">
                                <stop offset="0%" stopColor={C3_VISUALIZATION_COLORS.lavender} stopOpacity={0.42} />
                                <stop offset="100%" stopColor={C3_VISUALIZATION_COLORS.lavender} stopOpacity={0.03} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid stroke={theme.borderColor} strokeDasharray="3 4" opacity={0.55} />
                        <XAxis
                            axisLine={false}
                            dataKey="date"
                            tick={{ fill: theme.contentColorMuted, fontSize: 12 }}
                            tickLine={false}
                        />
                        <YAxis
                            axisLine={false}
                            tick={{ fill: theme.contentColorMuted, fontSize: 12 }}
                            tickFormatter={formatShortNumber}
                            tickLine={false}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Area
                            dataKey="exchange"
                            fill="url(#m365Exchange)"
                            name="Exchange"
                            stackId="1"
                            stroke={C3_VISUALIZATION_COLORS.info}
                            strokeWidth={1.6}
                            type="monotone"
                        />
                        <Area
                            dataKey="teams"
                            fill="url(#m365Teams)"
                            name="Teams"
                            stackId="1"
                            stroke={C3_VISUALIZATION_COLORS.positive}
                            strokeWidth={1.6}
                            type="monotone"
                        />
                        <Area
                            dataKey="azureAd"
                            fill="url(#m365Azure)"
                            name="Azure AD"
                            stackId="1"
                            stroke={C3_VISUALIZATION_COLORS.lavender}
                            strokeWidth={1.6}
                            type="monotone"
                        />
                        <Legend iconType="circle" wrapperStyle={{ color: theme.contentColorDefault }} />
                    </AreaChart>
                </ResponsiveContainer>
            </Panel>
            <HorizontalBarPanel
                color={C3_VISUALIZATION_COLORS.info}
                data={topOperations}
                title="Top Operations"
            />
        </div>
        </div>
    );
};

const ExecutiveSummary: React.FC = () => {
    const theme = useSplunkTheme();
    return (
        <div className="space-y-6">
        <FilterBar filters={[{ label: 'Workload', value: 'All' }]} />
        <div className="grid gap-6 lg:grid-cols-3">
            <Metric {...executiveMetrics[0]} icon={ShieldCheck} />
            <Metric {...executiveMetrics[1]} icon={ShieldAlert} />
            <Metric {...executiveMetrics[2]} icon={BarChart3} />
        </div>
        <div className="grid gap-6 xl:grid-cols-3">
            <Panel
                title="Event Distribution by Workload"
                bodyClassName="flex h-[360px] flex-col items-center justify-center p-4"
            >
                <ResponsiveContainer width="100%" height="82%">
                    <PieChart>
                        <Tooltip content={<CustomTooltip />} />
                        <Pie
                            data={workloadDistribution}
                            dataKey="value"
                            innerRadius="58%"
                            outerRadius="82%"
                            paddingAngle={2}
                            stroke={theme.backgroundColorSection}
                            strokeWidth={3}
                        >
                            {workloadDistribution.map((entry) => (
                                <Cell key={entry.name} fill={entry.color} />
                            ))}
                        </Pie>
                    </PieChart>
                </ResponsiveContainer>
                <ChartLegend items={workloadDistribution} />
            </Panel>
            <Panel
                title="Authentication Trends (30 Days)"
                className="xl:col-span-2"
                bodyClassName="h-[360px] p-4"
            >
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={authTrend} margin={chartMargins}>
                        <CartesianGrid stroke={theme.borderColor} strokeDasharray="3 4" opacity={0.55} />
                        <XAxis
                            axisLine={false}
                            dataKey="date"
                            interval={2}
                            tick={{ fill: theme.contentColorMuted, fontSize: 12 }}
                            tickLine={false}
                        />
                        <YAxis
                            axisLine={false}
                            tick={{ fill: theme.contentColorMuted, fontSize: 12 }}
                            tickFormatter={formatShortNumber}
                            tickLine={false}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Line
                            dataKey="successful"
                            dot={false}
                            name="Successful Logins"
                            stroke={C3_VISUALIZATION_COLORS.positive}
                            strokeWidth={2}
                            type="monotone"
                        />
                        <Line
                            dataKey="failed"
                            dot={false}
                            name="Failed Logins"
                            stroke={C3_VISUALIZATION_COLORS.critical}
                            strokeWidth={2}
                            type="monotone"
                        />
                        <Legend iconType="circle" wrapperStyle={{ color: theme.contentColorDefault }} />
                    </LineChart>
                </ResponsiveContainer>
            </Panel>
        </div>
        </div>
    );
};

const ClientSummary: React.FC = () => {
    const theme = useSplunkTheme();
    return (
        <div className="space-y-6">
        <FilterBar
            filters={[
                { label: 'User', value: 'All' },
                { label: 'Client IP', value: 'All' },
                { label: 'Workload', value: 'All' },
                { label: 'Operation', value: 'All' },
                { label: 'App', value: 'All' },
            ]}
        />
        <div className="grid gap-6 lg:grid-cols-3">
            <Metric {...clientMetrics[0]} icon={Activity} />
            <Metric {...clientMetrics[1]} icon={SlidersHorizontal} />
            <Metric {...clientMetrics[2]} icon={Laptop} />
        </div>
        <Panel title="Client Activity Volume" bodyClassName="h-[300px] p-4">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={clientActivity} margin={chartMargins}>
                    <defs>
                        <linearGradient id="m365ClientActivity" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor={C3_VISUALIZATION_COLORS.cyan} stopOpacity={0.5} />
                            <stop offset="100%" stopColor={C3_VISUALIZATION_COLORS.cyan} stopOpacity={0.03} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid stroke={theme.borderColor} strokeDasharray="3 4" opacity={0.55} />
                    <XAxis
                        axisLine={false}
                        dataKey="date"
                        tick={{ fill: theme.contentColorMuted, fontSize: 12 }}
                        tickLine={false}
                    />
                    <YAxis
                        axisLine={false}
                        tick={{ fill: theme.contentColorMuted, fontSize: 12 }}
                        tickFormatter={formatShortNumber}
                        tickLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                        dataKey="events"
                        fill="url(#m365ClientActivity)"
                        name="Events"
                        stroke={C3_VISUALIZATION_COLORS.cyan}
                        strokeWidth={1.8}
                        type="monotone"
                    />
                </AreaChart>
            </ResponsiveContainer>
        </Panel>
        <div className="grid gap-6 xl:grid-cols-2">
            <HorizontalBarPanel color={C3_VISUALIZATION_COLORS.positive} data={topUsers} title="Top 10 Active Users" />
            <HorizontalBarPanel color={C3_VISUALIZATION_COLORS.caution} data={topClientIps} title="Top 10 Client IPs" />
        </div>
        </div>
    );
};

const About: React.FC = () => (
    <div className="mx-auto max-w-4xl">
        <Panel className="sui-border-info bg-gradient-to-br sui-gradient-from-section sui-gradient-via-section sui-gradient-to-info">
            <div className="space-y-8 p-8">
                <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg border sui-border-info sui-bg-accent sui-color-info">
                        <Shield className="h-7 w-7" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black tracking-tight sui-color-active">
                            M365 Activity Monitoring
                        </h2>
                        <p className="text-base font-medium sui-color-default">
                            Splunk Add-on for Microsoft Office 365
                        </p>
                    </div>
                </div>
                <p className="max-w-3xl text-lg leading-8 sui-color-default">
                    This dashboard provides a comprehensive, modern view of Microsoft
                    365 activity. It is designed to feel like a highly polished Splunk
                    Dashboard Studio experience while using standard dashboard building
                    blocks: single values, bar charts, area charts, line charts, and
                    pie charts.
                </p>
                <div className="grid gap-6 md:grid-cols-2">
                    <InfoCard icon={Database} title="Data Sources">
                        <ul className="space-y-3 text-sm sui-color-default">
                            <li>Azure Active Directory audit logs</li>
                            <li>Exchange Online message trace</li>
                            <li>SharePoint and OneDrive activity</li>
                            <li>Microsoft Teams events</li>
                        </ul>
                    </InfoCard>
                    <InfoCard icon={FileText} title="Documentation">
                        <div className="space-y-3 text-sm sui-color-default">
                            <a className="flex items-center gap-2 transition sui-hover-color-info" href="https://docs.splunk.com/" rel="noreferrer" target="_blank">
                                <ExternalLink className="h-4 w-4" />
                                Splunk Add-on Configuration Guide
                            </a>
                            <a className="flex items-center gap-2 transition sui-hover-color-info" href="https://docs.splunk.com/Documentation/DashStudio" rel="noreferrer" target="_blank">
                                <ExternalLink className="h-4 w-4" />
                                Dashboard Studio Reference
                            </a>
                        </div>
                    </InfoCard>
                </div>
                <div className="border-t sui-border-weak pt-7">
                    <h3 className="mb-5 text-sm font-black uppercase tracking-[0.16em] sui-color-active">
                        Version Information
                    </h3>
                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                        {versionInfo.map((item) => (
                            <div key={item.label}>
                                <div className="text-sm font-semibold sui-color-muted">
                                    {item.label}
                                </div>
                                <div className="mt-2 font-mono text-sm font-bold sui-color-active">
                                    {item.value}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </Panel>
    </div>
);

const InfoCard: React.FC<{
    children: React.ReactNode;
    icon: IconComponent;
    title: string;
}> = ({ children, icon: Icon, title }) => (
    <div className="rounded-lg border sui-border-weak sui-bg-page p-5">
        <div className="mb-4 flex items-center gap-3 sui-color-info">
            <Icon className="h-5 w-5" />
            <h3 className="text-lg font-bold">{title}</h3>
        </div>
        {children}
    </div>
);

const HorizontalBarPanel: React.FC<{
    color: string;
    data: OperationPoint[];
    title: string;
}> = ({ color, data, title }) => {
    const theme = useSplunkTheme();
    return (
        <Panel title={title} bodyClassName="h-[330px] p-4">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} layout="vertical" margin={verticalChartMargins}>
                    <CartesianGrid
                        horizontal={false}
                        opacity={0.55}
                        stroke={theme.borderColor}
                        strokeDasharray="3 4"
                    />
                    <XAxis
                        axisLine={false}
                        tick={{ fill: theme.contentColorMuted, fontSize: 12 }}
                        tickFormatter={formatShortNumber}
                        tickLine={false}
                        type="number"
                    />
                    <YAxis
                        axisLine={false}
                        dataKey="name"
                        tick={{ fill: theme.contentColorDefault, fontSize: 12 }}
                        tickLine={false}
                        type="category"
                        width={128}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" fill={color} radius={[0, 5, 5, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </Panel>
    );
};

const router = createBrowserRouter(
    [
        {
            path: '/',
            element: <DashboardShell />,
        },
    ],
    { basename: getSplunkViewBasename() }
);

const M365ActivityMonitoringPage: React.FC = () => <RouterProvider router={router} />;

export default M365ActivityMonitoringPage;
