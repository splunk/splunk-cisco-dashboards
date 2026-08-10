import React from 'react';
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
    Search,
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
    indigo: 'border-indigo-500/35 bg-indigo-950/10',
    teal: 'border-teal-500/30 bg-teal-950/10',
    rose: 'border-rose-500/35 bg-rose-950/10',
    amber: 'border-amber-500/35 bg-amber-950/10',
    violet: 'border-violet-500/35 bg-violet-950/10',
    slate: 'border-slate-800/60 bg-slate-900',
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
            'overflow-hidden rounded-lg border border-slate-800/60 bg-slate-900 shadow-[0_20px_80px_rgba(0,0,0,0.18)]',
            className
        )}
    >
        {title ? (
            <div className="border-b border-slate-800/60 px-4 py-3">
                <h2 className="text-sm font-bold text-slate-100">{title}</h2>
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
    const trendClass = positive ? 'text-emerald-400' : 'text-rose-400';

    return (
        <Panel
            className={cn('min-h-[108px]', toneClasses[tone], className)}
            bodyClassName="flex h-full flex-col justify-center"
        >
            <div className="flex items-center gap-2 text-slate-400">
                <Icon className="h-4 w-4" />
                <span className="text-xs font-black uppercase tracking-[0.16em]">
                    {title}
                </span>
            </div>
            <div className="mt-4 flex items-end gap-3">
                <span className="text-3xl font-semibold tracking-tight text-white">
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
            className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-700 bg-slate-800 px-3 text-sm font-bold text-slate-200 transition hover:border-indigo-400/70 hover:bg-slate-800/75"
        >
            <Calendar className="h-4 w-4 text-slate-400" />
            Last 24 Hours
            <ChevronDown className="h-4 w-4 text-slate-500" />
        </button>
        <div className="hidden h-8 w-px bg-slate-800 sm:block" />
        {filters.map((filter) => (
            <button
                key={filter.label}
                type="button"
                className="inline-flex h-9 min-w-[130px] items-center justify-between gap-3 rounded-md border border-dashed border-slate-700 bg-slate-950 px-3 text-sm text-slate-400 transition hover:border-indigo-400/70 hover:text-slate-200"
            >
                <span>
                    {filter.label}: <strong className="font-bold text-slate-200">{filter.value}</strong>
                </span>
                <ChevronDown className="h-4 w-4 text-slate-600" />
            </button>
        ))}
        <label className="relative ml-auto min-w-[250px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
                aria-label="Search dashboard"
                placeholder="Search in dashboard..."
                className="h-9 w-full rounded-md border border-slate-800 bg-slate-950 py-0 pl-9 pr-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-indigo-400/80 focus:ring-2 focus:ring-indigo-500/20"
            />
        </label>
    </Panel>
);

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;

    return (
        <div className="rounded-lg border border-slate-700 bg-slate-950/95 px-3 py-2 shadow-2xl backdrop-blur">
            {label ? (
                <div className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">
                    {label}
                </div>
            ) : null}
            <div className="space-y-1.5">
                {payload.map((item) => (
                    <div
                        key={`${item.name ?? item.dataKey}-${item.value}`}
                        className="flex min-w-[150px] items-center justify-between gap-5 text-xs"
                    >
                        <span className="flex items-center gap-2 text-slate-300">
                            <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: item.color ?? '#6366f1' }}
                            />
                            {formatTooltipName(item.name ?? item.dataKey)}
                        </span>
                        <strong className="font-semibold text-white">
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
    <header className="flex min-h-[72px] items-center justify-between border-b border-slate-800/80 bg-slate-900/80 px-6 backdrop-blur">
        <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md border border-indigo-500/60 bg-indigo-500/15 text-indigo-300">
                <Activity className="h-5 w-5" />
            </div>
            <div>
                <h1 className="text-xl font-black tracking-tight text-slate-100">
                    M365 Activity Monitoring
                </h1>
                <p className="text-xs font-medium text-slate-500">
                    Splunk Add-on for Microsoft Office 365
                </p>
            </div>
        </div>
        <div className="flex items-center gap-4 text-slate-400">
            <div className="inline-flex items-center gap-2 text-sm font-semibold">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.9)]" />
                Live Data
            </div>
            <div className="h-6 w-px bg-slate-800" />
            {[Download, Share2, Settings, MoreVertical].map((Icon, index) => (
                <button
                    key={index}
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-800 hover:text-indigo-300"
                >
                    <Icon className="h-4 w-4" />
                </button>
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
        <nav className="flex h-12 items-end gap-1 border-b border-slate-800/80 bg-slate-950/30 px-6">
            {navItems.map((item) => {
                const isActive = activeTab === item.tab;

                return (
                    <Link
                        key={item.tab}
                        to={item.to}
                        className={cn(
                            'flex h-full items-center border-b-2 px-4 text-sm font-bold transition',
                            isActive
                                ? 'border-indigo-400 text-indigo-300'
                                : 'border-transparent text-slate-400 hover:text-slate-200'
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
    <div className="m365-dashboard scd-c3-atmosphere min-h-screen bg-[#0A0E17] font-sans text-slate-200">
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
            <div key={item.name} className="flex items-center gap-2 text-sm text-slate-300">
                <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                />
                {item.name}
            </div>
        ))}
    </div>
);

const Overview: React.FC = () => (
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
                                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.45} />
                                <stop offset="100%" stopColor="#6366f1" stopOpacity={0.03} />
                            </linearGradient>
                            <linearGradient id="m365Teams" x1="0" x2="0" y1="0" y2="1">
                                <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.4} />
                                <stop offset="100%" stopColor="#14b8a6" stopOpacity={0.03} />
                            </linearGradient>
                            <linearGradient id="m365Azure" x1="0" x2="0" y1="0" y2="1">
                                <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.42} />
                                <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.03} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid stroke="#334155" strokeDasharray="3 4" opacity={0.55} />
                        <XAxis
                            axisLine={false}
                            dataKey="date"
                            tick={{ fill: '#94a3b8', fontSize: 12 }}
                            tickLine={false}
                        />
                        <YAxis
                            axisLine={false}
                            tick={{ fill: '#94a3b8', fontSize: 12 }}
                            tickFormatter={formatShortNumber}
                            tickLine={false}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Area
                            dataKey="exchange"
                            fill="url(#m365Exchange)"
                            name="Exchange"
                            stackId="1"
                            stroke="#6366f1"
                            strokeWidth={1.6}
                            type="monotone"
                        />
                        <Area
                            dataKey="teams"
                            fill="url(#m365Teams)"
                            name="Teams"
                            stackId="1"
                            stroke="#14b8a6"
                            strokeWidth={1.6}
                            type="monotone"
                        />
                        <Area
                            dataKey="azureAd"
                            fill="url(#m365Azure)"
                            name="Azure AD"
                            stackId="1"
                            stroke="#8b5cf6"
                            strokeWidth={1.6}
                            type="monotone"
                        />
                        <Legend iconType="circle" wrapperStyle={{ color: '#cbd5e1' }} />
                    </AreaChart>
                </ResponsiveContainer>
            </Panel>
            <HorizontalBarPanel
                color="#6366f1"
                data={topOperations}
                title="Top Operations"
            />
        </div>
    </div>
);

const ExecutiveSummary: React.FC = () => (
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
                            stroke="#0f172a"
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
                        <CartesianGrid stroke="#334155" strokeDasharray="3 4" opacity={0.55} />
                        <XAxis
                            axisLine={false}
                            dataKey="date"
                            interval={2}
                            tick={{ fill: '#94a3b8', fontSize: 12 }}
                            tickLine={false}
                        />
                        <YAxis
                            axisLine={false}
                            tick={{ fill: '#94a3b8', fontSize: 12 }}
                            tickFormatter={formatShortNumber}
                            tickLine={false}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Line
                            dataKey="successful"
                            dot={false}
                            name="Successful Logins"
                            stroke="#14b8a6"
                            strokeWidth={2}
                            type="monotone"
                        />
                        <Line
                            dataKey="failed"
                            dot={false}
                            name="Failed Logins"
                            stroke="#f43f5e"
                            strokeWidth={2}
                            type="monotone"
                        />
                        <Legend iconType="circle" wrapperStyle={{ color: '#cbd5e1' }} />
                    </LineChart>
                </ResponsiveContainer>
            </Panel>
        </div>
    </div>
);

const ClientSummary: React.FC = () => (
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
                            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.5} />
                            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.03} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#334155" strokeDasharray="3 4" opacity={0.55} />
                    <XAxis
                        axisLine={false}
                        dataKey="date"
                        tick={{ fill: '#94a3b8', fontSize: 12 }}
                        tickLine={false}
                    />
                    <YAxis
                        axisLine={false}
                        tick={{ fill: '#94a3b8', fontSize: 12 }}
                        tickFormatter={formatShortNumber}
                        tickLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                        dataKey="events"
                        fill="url(#m365ClientActivity)"
                        name="Events"
                        stroke="#3b82f6"
                        strokeWidth={1.8}
                        type="monotone"
                    />
                </AreaChart>
            </ResponsiveContainer>
        </Panel>
        <div className="grid gap-6 xl:grid-cols-2">
            <HorizontalBarPanel color="#14b8a6" data={topUsers} title="Top 10 Active Users" />
            <HorizontalBarPanel color="#f59e0b" data={topClientIps} title="Top 10 Client IPs" />
        </div>
    </div>
);

const About: React.FC = () => (
    <div className="mx-auto max-w-4xl">
        <Panel className="border-indigo-500/30 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/20">
            <div className="space-y-8 p-8">
                <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-indigo-500/60 bg-indigo-500/15 text-indigo-300">
                        <Shield className="h-7 w-7" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black tracking-tight text-white">
                            M365 Activity Monitoring
                        </h2>
                        <p className="text-base font-medium text-slate-400">
                            Splunk Add-on for Microsoft Office 365
                        </p>
                    </div>
                </div>
                <p className="max-w-3xl text-lg leading-8 text-slate-300">
                    This dashboard provides a comprehensive, modern view of Microsoft
                    365 activity. It is designed to feel like a highly polished Splunk
                    Dashboard Studio experience while using standard dashboard building
                    blocks: single values, bar charts, area charts, line charts, and
                    pie charts.
                </p>
                <div className="grid gap-6 md:grid-cols-2">
                    <InfoCard icon={Database} title="Data Sources">
                        <ul className="space-y-3 text-sm text-slate-400">
                            <li>Azure Active Directory audit logs</li>
                            <li>Exchange Online message trace</li>
                            <li>SharePoint and OneDrive activity</li>
                            <li>Microsoft Teams events</li>
                        </ul>
                    </InfoCard>
                    <InfoCard icon={FileText} title="Documentation">
                        <div className="space-y-3 text-sm text-slate-300">
                            <a className="flex items-center gap-2 transition hover:text-indigo-300" href="https://docs.splunk.com/" rel="noreferrer" target="_blank">
                                <ExternalLink className="h-4 w-4" />
                                Splunk Add-on Configuration Guide
                            </a>
                            <a className="flex items-center gap-2 transition hover:text-indigo-300" href="https://docs.splunk.com/Documentation/DashStudio" rel="noreferrer" target="_blank">
                                <ExternalLink className="h-4 w-4" />
                                Dashboard Studio Reference
                            </a>
                        </div>
                    </InfoCard>
                </div>
                <div className="border-t border-slate-800 pt-7">
                    <h3 className="mb-5 text-sm font-black uppercase tracking-[0.16em] text-slate-200">
                        Version Information
                    </h3>
                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                        {versionInfo.map((item) => (
                            <div key={item.label}>
                                <div className="text-sm font-semibold text-slate-500">
                                    {item.label}
                                </div>
                                <div className="mt-2 font-mono text-sm font-bold text-slate-100">
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
    <div className="rounded-lg border border-slate-800 bg-slate-950/35 p-5">
        <div className="mb-4 flex items-center gap-3 text-indigo-300">
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
}> = ({ color, data, title }) => (
    <Panel title={title} bodyClassName="h-[330px] p-4">
        <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={verticalChartMargins}>
                <CartesianGrid horizontal={false} stroke="#334155" strokeDasharray="3 4" opacity={0.55} />
                <XAxis
                    axisLine={false}
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                    tickFormatter={formatShortNumber}
                    tickLine={false}
                    type="number"
                />
                <YAxis
                    axisLine={false}
                    dataKey="name"
                    tick={{ fill: '#e2e8f0', fontSize: 12 }}
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
