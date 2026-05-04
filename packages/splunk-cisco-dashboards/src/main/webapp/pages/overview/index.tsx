/**
 * Splunk Cisco Dashboards — Overview Page
 *
 * Executive landing page. Direct port of the Florida Executive design,
 * adapted for Splunk and pumped full of dashboards-tooling niceties:
 *   * Time-range picker (default Last 7 days)
 *   * Auto-refresh interval picker + manual refresh button
 *   * Per-metric saved-search wiring (convention `Overview - ds_<id>`
 *     or override via {@link MetricConfig.savedSearch})
 *   * Threshold-driven status colouring on every metric
 *   * Aggregate health badge derived from those statuses
 *   * Comparison overlay (previous-period dashed line) on every spark
 *   * Click-sparkline → opens the SPL in Splunk Search
 *   * Mini incident ticker driven by `Overview - ds_recent_incidents`
 *   * KPI cards under the map driven by `Overview - ds_top_incident`
 *     and `Overview - ds_operational_lead`
 *   * PNG / PDF export of the entire page
 *   * Keyboard shortcuts (g i, g s, g b, t, r, ?, /)
 *   * Click-to-pin map popups (ESC or X to close)
 *
 * Each "feature" surfaced through this page is independent — see the
 * inline section comments to remove or pare down individual capabilities
 * without rippling the rest of the page.
 */

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
    Bell,
    User,
    RefreshCw,
    Pause,
    Download,
    Keyboard,
} from 'lucide-react';
import { DashboardSection } from '@/common/components/florida/DashboardSection';
import { MetricItem } from '@/common/components/florida/MetricItem';
import { FloridaMap } from '@/common/components/florida/FloridaMap';
import { HealthBadge } from '@/common/components/florida/HealthBadge';
import { IncidentTicker } from '@/common/components/florida/IncidentTicker';
import { HelpOverlay } from '@/common/components/florida/HelpOverlay';
import {
    useMetric,
    useKpi,
    type MetricConfig,
    type KpiConfig,
    type SectionId,
    type TimeRange,
    type MetricStatus,
} from '@/common/hooks/useMetric';
import { useExportPage } from '@/common/hooks/useExportPage';
import { useKeyboardShortcuts } from '@/common/hooks/useKeyboardShortcuts';
import { useTheme } from '@/common/hooks/useTheme';
import { ThemeToggle } from '@/common/components/florida/ThemeToggle';
import { runSearch } from '@/common/services/splunkSearchService';
import { cn } from '@/common/lib/utils';

// =============================================================================
// Branding
// =============================================================================

const APP_NAME = 'splunk-cisco-dashboards';
const CUSTOMER_LOGO_URL = `/static/app/${APP_NAME}/images/customer_logo.png`;
const FALLBACK_LOGO_DATA_URI =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" ' +
            'stroke="white" stroke-width="2" stroke-linecap="round" ' +
            'stroke-linejoin="round"><rect x="3" y="3" width="7" height="9"/>' +
            '<rect x="14" y="3" width="7" height="5"/>' +
            '<rect x="14" y="12" width="7" height="9"/>' +
            '<rect x="3" y="16" width="7" height="5"/></svg>'
    );

const CUSTOMER_NAME_SPL =
    '| makeresults | eval customer_name = `customer_name` | fields customer_name';

// =============================================================================
// Time range
// =============================================================================

const TIME_RANGE_OPTIONS: TimeRange[] = [
    { earliest: '-24h@h', latest: 'now', label: 'Last 24 hours', spanSeconds: 24 * 3600 },
    { earliest: '-7d@d', latest: 'now', label: 'Last 7 days', spanSeconds: 7 * 86400 },
    { earliest: '-30d@d', latest: 'now', label: 'Last 30 days', spanSeconds: 30 * 86400 },
    { earliest: '-90d@d', latest: 'now', label: 'Last 90 days', spanSeconds: 90 * 86400 },
];
const DEFAULT_TIME_RANGE_LABEL = 'Last 7 days';

// =============================================================================
// Auto-refresh
// =============================================================================

const AUTO_REFRESH_OPTIONS: { label: string; seconds: number }[] = [
    { label: 'Off', seconds: 0 },
    { label: '30 s', seconds: 30 },
    { label: '1 m', seconds: 60 },
    { label: '5 m', seconds: 300 },
    { label: '15 m', seconds: 900 },
];

// =============================================================================
// Metric configuration
// =============================================================================
//
// Each metric is bound to an existing saved search in
// `default/savedsearches.conf`. These were hand-picked from the bundled
// Cisco-app saved searches that already produce single-row "current
// value" results — see comments next to each binding for the field
// shape. Binding via `savedSearch` dispatches `| savedsearch "Name"`
// honouring the page-level time range, so changing the time picker
// re-runs every wire automatically.
//
// `comparePeriod` is intentionally off for every metric below: these
// "current value" searches return a single row, so the dashed
// previous-period overlay can't be rendered. Re-enable per metric only
// when you bind it to a *time-series* search (e.g. one that uses
// `timechart` and emits N rows over the dispatched window).

const METRIC_CONFIG: MetricConfig[] = [
    // ----- IT Health -----
    {
        id: 'network_health',
        section: 'it_health',
        label: 'Network health',
        subLabel: 'Catalyst Center network score',
        description:
            "Latest network-wide health score from Catalyst Center for the 'All' " +
            'category. Combines link state, throughput and protocol metrics into a ' +
            "0-100 grade. Healthy >= 95; Critical < 80.",
        // Single row: { score: 0..100 }
        savedSearch: 'Executive Dashboard - ds_network_health_current',
        valueField: 'score',
        unit: '%',
        thresholds: { warning: 95, critical: 80, direction: 'higher_is_better' },
        mock: { seed: 11, sparkMin: 80, sparkMax: 100, value: 99, change: 0 },
    },
    {
        id: 'device_health',
        section: 'it_health',
        label: 'Device health',
        subLabel: 'Reachable + managed devices',
        description:
            'Average reachability + manageability across every device tracked by ' +
            'Catalyst Center. Devices that are reachable AND managed score 100, ' +
            'reachable-only score 50, otherwise 0. Healthy >= 98; Critical < 90.',
        // Single row: { score: 0..100 }
        savedSearch: 'Executive Dashboard - ds_device_health_current',
        valueField: 'score',
        unit: '%',
        thresholds: { warning: 98, critical: 90, direction: 'higher_is_better' },
        mock: { seed: 12, sparkMin: 95, sparkMax: 100, value: 100, change: 0 },
    },
    {
        id: 'open_issues',
        section: 'it_health',
        label: 'Open issues',
        subLabel: 'Active Catalyst Center issues',
        description:
            'Count of open issues raised by Catalyst Center across every priority. ' +
            'Source: cisco:dnac:issue. Crosses warning at 500 active issues and is ' +
            'critical above 1,000.',
        // Single row: { total, critical, high, affected_devices, affected_sites }
        savedSearch: 'Executive Dashboard - ds_base_issues',
        valueField: 'total',
        thresholds: { warning: 500, critical: 1000, direction: 'lower_is_better' },
        mock: { seed: 13, sparkMin: 100, sparkMax: 800, value: 650, change: -50 },
    },
    // ----- Security -----
    {
        id: 'fw_blocked',
        section: 'security',
        label: 'FW blocked',
        subLabel: 'Unique blocked connections',
        description:
            'Distinct (source, destination, dest-port) tuples blocked by the ' +
            'firewall, accelerated via the Network_Traffic data model. A spike ' +
            'usually signals a scan or active exploit attempt.',
        // Single row: { blocked }
        savedSearch: 'Executive Dashboard - ds_fw_blocked',
        valueField: 'blocked',
        color: '#f59e0b',
        thresholds: { warning: 5000, critical: 25000, direction: 'lower_is_better' },
        mock: { seed: 21, sparkMin: 10, sparkMax: 50, value: 142, change: 12 },
    },
    {
        id: 'threat_sources',
        section: 'security',
        label: 'Threat sources',
        subLabel: 'Unique IPs blocked at firewall',
        description:
            'Number of distinct external source IPs being denied by the firewall. ' +
            'Climbing values usually indicate distributed scanning or a low-and-slow ' +
            'campaign. Warning at 25 unique sources, critical at 100.',
        // No off-the-shelf single-row stanza for this — wrap the
        // existing fw_blocked tstats with dc(src) to get one number.
        spl:
            '| tstats `summariesonly` dc(All_Traffic.src) as count from ' +
            'datamodel=Network_Traffic where All_Traffic.action="blocked" ' +
            '| appendpipe [| where isnull(count) | eval count=0]',
        valueField: 'count',
        color: '#ef4444',
        thresholds: { warning: 25, critical: 100, direction: 'lower_is_better' },
        mock: { seed: 22, sparkMin: 5, sparkMax: 20, value: 18, change: -5 },
    },
    {
        id: 'failed_auth',
        section: 'security',
        label: 'Failed auth',
        subLabel: 'Distinct users with auth failures',
        description:
            'Distinct user accounts that have had at least one failed authentication ' +
            'in the window, as reported by the Authentication data model (ISE + AD). ' +
            'Sustained values may indicate credential-stuffing.',
        // Single row: { count }
        savedSearch: 'Executive Dashboard - ds_failed_logons',
        valueField: 'count',
        color: '#0ea5e9',
        thresholds: { warning: 25, critical: 100, direction: 'lower_is_better' },
        mock: { seed: 23, sparkMin: 0, sparkMax: 5, value: 1, change: 0 },
    },
    // ----- Building Intelligence -----
    {
        id: 'active_devices',
        section: 'building',
        label: 'Active devices',
        subLabel: 'Tracked across Cisco Spaces',
        description:
            'Total active tracked devices summed across every monitored location, ' +
            'derived from the latest DEVICE_PRESENCE event per location in Cisco ' +
            'Spaces. Reflects how busy the campus is right now.',
        // Single row: { score }
        savedSearch: 'Executive Dashboard - ds_active_devices',
        valueField: 'score',
        color: '#10b981',
        mock: { seed: 31, sparkMin: 30, sparkMax: 60, value: 54, change: 2600 },
    },
    {
        id: 'wifi_clients',
        section: 'building',
        label: 'Wi-Fi clients',
        subLabel: 'Wireless clients on APs',
        description:
            'Distinct Wi-Fi MAC addresses currently associated to access points, ' +
            'taken from Cisco Spaces DEVICE_ASSOCIATION ASSOCIATE events.',
        // Single row: { score }
        savedSearch: 'Executive Dashboard - ds_wifi_clients',
        valueField: 'score',
        mock: { seed: 32, sparkMin: 1, sparkMax: 5, value: 2, change: 0 },
    },
    {
        id: 'occupancy',
        section: 'building',
        label: 'Occupancy',
        subLabel: 'Occupied rooms as % of total',
        description:
            'Percentage of monitored rooms that have at least one person present, ' +
            'derived from Cisco Spaces SPACE_OCCUPANCY events. 0% may indicate either ' +
            'an empty building or a stalled feed — check the source dot.',
        // Single row: { score: 0..100 }
        savedSearch: 'Executive Dashboard - ds_building_occupancy',
        valueField: 'score',
        unit: '%',
        mock: { seed: 33, sparkMin: 0, sparkMax: 10, value: 0, change: 0 },
    },
];

// =============================================================================
// Right-column KPI cards
// =============================================================================
//
// "Top incident volume" — site producing the most XDR/SecureX
// incident IDs. We wrap the existing aggregator with `top 1`.
//
// "Operational lead" — site with the strongest IT health. Derived
// from per-device health rolled up by Site (since there isn't a
// pre-built single-row "best site" stanza).
//
// Both fall back to mock if the data sources are empty (the dispatch
// returns 0 rows and `useKpi` shows the mockValue).

const KPI_CONFIG: KpiConfig[] = [
    {
        id: 'top_incident',
        label: 'Top incident volume',
        spl:
            '`index_security` (sourcetype="cisco:xdr:incidents" OR ' +
            'sourcetype="cisco:xdr:incidents-summary") ' +
            '| stats dc(id) as incidents by site ' +
            '| sort -incidents | head 1 | rename site as value | fields value',
        valueField: 'value',
        mockValue: 'Awaiting data',
    },
    {
        id: 'operational_lead',
        label: 'Operational lead',
        spl:
            '`index_catalyst` sourcetype="cisco:dnac:devicehealth" ' +
            '| stats latest(Reachability) as Reachability, latest(Manageability) as ' +
            'Manageability by DeviceID, Site ' +
            '| where Site!="" ' +
            '| eval h=case(Reachability=="Reachable" AND match(Manageability,"^Managed"),100, ' +
            'Reachability=="Reachable",50, 1==1,0) ' +
            '| stats avg(h) as score by Site | sort -score | head 1 ' +
            '| rename Site as value | fields value',
        valueField: 'value',
        mockValue: 'Awaiting data',
    },
];

// =============================================================================
// Section meta (titles, drilldown hrefs)
// =============================================================================

const SECTION_META: Record<
    SectionId,
    { title: string; linkText: string; href: string }
> = {
    it_health: { title: 'IT Health', linkText: 'Open IT health', href: 'it_health_v2' },
    security: { title: 'Security', linkText: 'Open security', href: 'security_v2' },
    building: {
        title: 'Building Intelligence',
        linkText: 'Open building intelligence',
        href: 'building_v2',
    },
};

// =============================================================================
// Splunk Search drilldown URL builder
// =============================================================================

const splunkSearchAppUrl = (spl: string, range: TimeRange): string => {
    // Open the stock Splunk search bar but *under this app's namespace*
    // (`/app/splunk-cisco-dashboards/search`). The platform `search`
    // view is exported system-wide, so navigating to /app/<any-app>/search
    // renders the standard Search & Reporting UI while dispatching in
    // the current app's namespace — meaning `| savedsearch "..."`
    // references to stanzas defined in this app resolve correctly
    // without the app needing to be exported globally.
    const path = typeof window !== 'undefined' ? window.location.pathname : '/en-US';
    const localeMatch = path.match(/^\/([a-z]{2}-[A-Z]{2})\//);
    const locale = localeMatch ? localeMatch[1] : 'en-US';
    const params = new URLSearchParams({
        q: spl,
        earliest: range.earliest,
        latest: range.latest,
    });
    return `/${locale}/app/${APP_NAME}/search?${params.toString()}`;
};

// =============================================================================
// Per-metric component (renders one MetricItem and reports its status up)
// =============================================================================

interface MetricCardProps {
    cfg: MetricConfig;
    range: TimeRange;
    refreshToken: number;
    onStatus: (id: string, status: MetricStatus) => void;
    /**
     * Where the per-metric Info tooltip should anchor. Pass 'right'
     * for the rightmost metric in a section so the popover doesn't
     * overflow the card.
     */
    infoAnchor?: 'auto' | 'left' | 'right';
}

const MetricCard: React.FC<MetricCardProps> = ({
    cfg,
    range,
    refreshToken,
    onStatus,
    infoAnchor = 'auto',
}) => {
    const result = useMetric(cfg, range, refreshToken);

    useEffect(() => {
        onStatus(cfg.id, result.status);
    }, [cfg.id, result.status, onStatus]);

    const handleClick = useCallback(() => {
        const url = splunkSearchAppUrl(result.spl, range);
        if (typeof window !== 'undefined') window.open(url, '_blank', 'noopener,noreferrer');
    }, [result.spl, range]);

    return (
        <MetricItem
            label={cfg.label}
            subLabel={cfg.subLabel}
            description={cfg.description}
            descriptionFootnote={
                cfg.savedSearch
                    ? `savedsearch "${cfg.savedSearch}"`
                    : cfg.spl
                    ? cfg.spl.length > 120
                        ? `${cfg.spl.slice(0, 117)}…`
                        : cfg.spl
                    : undefined
            }
            infoAnchor={infoAnchor}
            value={result.value}
            unit={cfg.unit}
            change={result.change}
            sparkData={result.sparkData}
            previousData={result.previousSparkData}
            sparkTimestamps={result.sparkTimestamps}
            timeRange={range}
            color={cfg.color}
            status={result.status}
            source={result.source}
            onOpenInSearch={result.spl ? handleClick : undefined}
            sparkTitle={
                result.spl
                    ? `Hover for date · click to open in Splunk Search:\n${result.spl}`
                    : undefined
            }
        />
    );
};

// =============================================================================
// Page
// =============================================================================

const OverviewPage: React.FC = () => {
    // ------------------------------ Theme ------------------------------
    const { theme, resolvedTheme, cycle: cycleTheme } = useTheme();

    // ------------------------------ Branding ------------------------------
    const [customerName, setCustomerName] = useState<string>('');
    const [logoSrc, setLogoSrc] = useState<string>(CUSTOMER_LOGO_URL);

    // ------------------------------ Time + refresh ------------------------------
    const [timeRange, setTimeRange] = useState<TimeRange>(
        () =>
            TIME_RANGE_OPTIONS.find((o) => o.label === DEFAULT_TIME_RANGE_LABEL) ??
            TIME_RANGE_OPTIONS[1]
    );
    const [autoRefreshSeconds, setAutoRefreshSeconds] = useState<number>(0);
    const [refreshToken, setRefreshToken] = useState<number>(0);
    const [lastRefreshed, setLastRefreshed] = useState<Date>(() => new Date());
    const refreshNow = useCallback(() => {
        setRefreshToken((n) => n + 1);
        setLastRefreshed(new Date());
    }, []);

    // ------------------------------ Aggregate status ------------------------------
    const [statuses, setStatuses] = useState<Record<string, MetricStatus>>({});
    const reportStatus = useCallback((id: string, s: MetricStatus) => {
        setStatuses((prev) => (prev[id] === s ? prev : { ...prev, [id]: s }));
    }, []);
    const statusList = useMemo(() => Object.values(statuses), [statuses]);

    // ------------------------------ Help overlay ------------------------------
    const [helpOpen, setHelpOpen] = useState(false);

    // ------------------------------ Regional view (map | table) ------------------------------
    const [regionalView, setRegionalView] = useState<RegionalView>('map');

    // ------------------------------ Export ------------------------------
    const exportRef = useRef<HTMLDivElement>(null);
    const { exporting, exportAs } = useExportPage({
        targetRef: exportRef,
        fileName: 'overview',
    });

    // ------------------------------ Auto-refresh timer ------------------------------
    useEffect(() => {
        if (autoRefreshSeconds <= 0) return undefined;
        const id = window.setInterval(() => {
            refreshNow();
        }, autoRefreshSeconds * 1000);
        return () => window.clearInterval(id);
    }, [autoRefreshSeconds, refreshNow]);

    // ------------------------------ Customer name fetch ------------------------------
    useEffect(() => {
        let cancelled = false;
        runSearch({
            spl: CUSTOMER_NAME_SPL,
            earliestTime: '-1m',
            latestTime: 'now',
            tag: 'customer_name',
        })
            .then((res) => {
                if (cancelled) return;
                const rows = (res?.results ?? []) as Array<Record<string, unknown>>;
                const raw = rows[0]?.customer_name;
                const name = typeof raw === 'string' ? raw.trim() : '';
                setCustomerName(name);
            })
            .catch(() => {
                if (!cancelled) setCustomerName('');
            });
        return () => {
            cancelled = true;
        };
    }, [refreshToken]);

    // ------------------------------ KPI cards ------------------------------
    const topIncident = useKpi(KPI_CONFIG[0], timeRange, refreshToken);
    const operationalLead = useKpi(KPI_CONFIG[1], timeRange, refreshToken);

    // ------------------------------ Keyboard shortcuts ------------------------------
    // Drilldowns open in a new tab so the executive can keep the
    // overview as a persistent "command center" view alongside the
    // detail dashboard.
    const openDrilldown = useCallback((view: string) => {
        if (typeof window === 'undefined') return;
        window.open(view, '_blank', 'noopener,noreferrer');
    }, []);
    const cycleTimeRange = useCallback(() => {
        setTimeRange((current) => {
            const idx = TIME_RANGE_OPTIONS.findIndex((o) => o.label === current.label);
            return TIME_RANGE_OPTIONS[(idx + 1) % TIME_RANGE_OPTIONS.length];
        });
    }, []);
    const focusGlobalSearch = useCallback(() => {
        // Right now the only focusable input is the time-range select.
        // Once a global search bar is wired this is where it goes.
        const el = document.querySelector<HTMLSelectElement>(
            'select[data-shortcut-search]'
        );
        el?.focus();
    }, []);

    const SHORTCUTS: { keys: string; description: string; handler: () => void }[] = [
        {
            keys: 'g i',
            description: 'Open IT Health dashboard (new tab)',
            handler: () => openDrilldown(SECTION_META.it_health.href),
        },
        {
            keys: 'g s',
            description: 'Open Security dashboard (new tab)',
            handler: () => openDrilldown(SECTION_META.security.href),
        },
        {
            keys: 'g b',
            description: 'Open Building Intelligence (new tab)',
            handler: () => openDrilldown(SECTION_META.building.href),
        },
        { keys: 't', description: 'Cycle time range', handler: cycleTimeRange },
        { keys: 'r', description: 'Refresh all data now', handler: refreshNow },
        { keys: '/', description: 'Focus the time-range picker', handler: focusGlobalSearch },
        {
            keys: '?',
            description: 'Toggle this help overlay',
            handler: () => setHelpOpen((o) => !o),
        },
    ];
    useKeyboardShortcuts(
        SHORTCUTS.map((s) => ({
            keys: s.keys,
            description: s.description,
            handler: s.handler,
        })),
        true
    );
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && helpOpen) setHelpOpen(false);
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [helpOpen]);

    // ------------------------------ Render ------------------------------
    const inputClass =
        'text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 border border-slate-200 ' +
        'dark:border-slate-700 rounded-md px-2 py-1 text-slate-700 dark:text-slate-200 ' +
        'hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 ' +
        'focus:ring-sky-500 cursor-pointer';
    const iconBtnClass =
        'p-1.5 rounded transition-colors text-slate-500 dark:text-slate-400 ' +
        'hover:text-sky-600 dark:hover:text-sky-300 hover:bg-slate-50 dark:hover:bg-slate-800';

    return (
        <div
            ref={exportRef}
            className={cn(
                'h-screen flex flex-col font-sans overflow-hidden',
                'bg-slate-50 text-slate-900',
                'dark:bg-slate-950 dark:text-slate-100',
                resolvedTheme === 'dark' && 'dark'
            )}
        >
            {/* Header */}
            <header className="h-14 flex-shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 bg-sky-600 rounded-lg flex items-center justify-center text-white overflow-hidden p-1 flex-shrink-0">
                        <img
                            src={logoSrc}
                            alt="Customer logo"
                            className="w-full h-full object-contain"
                            onError={() => {
                                if (logoSrc !== FALLBACK_LOGO_DATA_URI) {
                                    setLogoSrc(FALLBACK_LOGO_DATA_URI);
                                }
                            }}
                        />
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-base font-black text-sky-900 dark:text-sky-200 tracking-tight leading-none uppercase truncate">
                            {customerName || 'Operations Command Center'}
                        </h1>
                        <p className="text-[9px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-[0.3em] mt-1 leading-none truncate">
                            Splunk Executive Control Center
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2.5 flex-shrink-0">
                    <HealthBadge statuses={statusList} />
                    <label className="flex items-center gap-1.5">
                        <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest hidden lg:inline">
                            Range
                        </span>
                        <select
                            data-shortcut-search
                            value={timeRange.label}
                            onChange={(e) => {
                                const next = TIME_RANGE_OPTIONS.find(
                                    (o) => o.label === e.target.value
                                );
                                if (next) setTimeRange(next);
                            }}
                            className={inputClass}
                        >
                            {TIME_RANGE_OPTIONS.map((o) => (
                                <option key={o.label} value={o.label}>
                                    {o.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="flex items-center gap-1.5">
                        <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest hidden lg:inline">
                            Auto
                        </span>
                        <select
                            value={autoRefreshSeconds}
                            onChange={(e) => setAutoRefreshSeconds(Number(e.target.value))}
                            className={inputClass}
                            title="Auto-refresh interval"
                        >
                            {AUTO_REFRESH_OPTIONS.map((o) => (
                                <option key={o.seconds} value={o.seconds}>
                                    {o.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <button
                        type="button"
                        onClick={refreshNow}
                        title={`Refresh now (last: ${lastRefreshed.toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                        })})`}
                        className={iconBtnClass}
                    >
                        <RefreshCw
                            className={
                                'w-4 h-4 ' + (autoRefreshSeconds > 0 ? 'animate-pulse' : '')
                            }
                        />
                    </button>
                    <div className="relative group">
                        <button
                            type="button"
                            disabled={exporting}
                            className={cn(
                                iconBtnClass,
                                'disabled:opacity-50 disabled:cursor-wait'
                            )}
                            title="Export"
                        >
                            {exporting ? (
                                <Pause className="w-4 h-4 animate-pulse" />
                            ) : (
                                <Download className="w-4 h-4" />
                            )}
                        </button>
                        <div className="absolute right-0 top-full mt-1 hidden group-hover:flex group-focus-within:flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md shadow-lg overflow-hidden z-50 w-28">
                            <button
                                type="button"
                                onClick={() => exportAs('png')}
                                className="px-3 py-1.5 text-[11px] text-left font-semibold text-slate-700 dark:text-slate-200 hover:bg-sky-50 dark:hover:bg-slate-800"
                            >
                                Save as PNG
                            </button>
                            <button
                                type="button"
                                onClick={() => exportAs('pdf')}
                                className="px-3 py-1.5 text-[11px] text-left font-semibold text-slate-700 dark:text-slate-200 hover:bg-sky-50 dark:hover:bg-slate-800 border-t border-slate-100 dark:border-slate-700"
                            >
                                Save as PDF
                            </button>
                        </div>
                    </div>
                    <ThemeToggle theme={theme} onCycle={cycleTheme} />
                    <button
                        type="button"
                        onClick={() => setHelpOpen(true)}
                        title="Keyboard shortcuts (?)"
                        className={iconBtnClass}
                    >
                        <Keyboard className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        className="relative p-1.5 text-slate-400 dark:text-slate-500 hover:text-sky-600 dark:hover:text-sky-300 transition-colors"
                    >
                        <Bell className="w-4 h-4" />
                        <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full border border-white dark:border-slate-900"></span>
                    </button>
                    <div className="flex items-center gap-2">
                        <div className="text-right hidden xl:block">
                            <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200 leading-none">
                                Executive Admin
                            </p>
                            <p className="text-[9px] text-slate-400 dark:text-slate-500 leading-tight">
                                Security Operations
                            </p>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-sky-100 dark:bg-sky-900/40 border border-sky-200 dark:border-sky-800 flex items-center justify-center text-sky-600 dark:text-sky-300">
                            <User className="w-4 h-4" />
                        </div>
                    </div>
                </div>
            </header>

            {/* Mini incident ticker */}
            <IncidentTicker
                savedSearch="Overview - ds_recent_incidents"
                range={timeRange}
                refreshToken={refreshToken}
            />

            <main className="flex-1 min-h-0 px-4 py-2 max-w-[1600px] mx-auto w-full overflow-hidden">
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-2 h-full min-h-0">
                    {/* Left column — three sections */}
                    <div className="xl:col-span-7 flex flex-col gap-2 min-h-0">
                        {(['it_health', 'security', 'building'] as const).map((section) => {
                            const meta = SECTION_META[section];
                            const sectionMetrics = METRIC_CONFIG.filter(
                                (m) => m.section === section
                            );
                            return (
                                <DashboardSection
                                    key={section}
                                    title={meta.title}
                                    linkText={meta.linkText}
                                    href={meta.href}
                                    className="flex-1 min-h-0"
                                >
                                    {sectionMetrics.map((cfg, idx) => (
                                        <MetricCard
                                            key={cfg.id}
                                            cfg={cfg}
                                            range={timeRange}
                                            refreshToken={refreshToken}
                                            onStatus={reportStatus}
                                            // Anchor the tooltip to the right
                                            // edge for the last metric so the
                                            // popover stays inside the section
                                            // card instead of overflowing.
                                            infoAnchor={
                                                idx === sectionMetrics.length - 1
                                                    ? 'right'
                                                    : 'auto'
                                            }
                                        />
                                    ))}
                                </DashboardSection>
                            );
                        })}
                    </div>

                    {/* Right column — map */}
                    <div className="xl:col-span-5 flex flex-col min-h-0">
                        <div className="flex-1 min-h-0 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-3 shadow-sm flex flex-col">
                            <div className="flex items-center justify-between mb-2 flex-shrink-0">
                                <div>
                                    <h3 className="text-base font-bold text-sky-900 dark:text-sky-200 uppercase tracking-wide leading-none">
                                        Regional Overview
                                    </h3>
                                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">
                                        Site real-time status
                                    </p>
                                </div>
                                <RegionalViewToggle
                                    value={regionalView}
                                    onChange={setRegionalView}
                                />
                            </div>

                            <div className="flex-1 min-h-0">
                                {regionalView === 'map' ? (
                                    <FloridaMap
                                        isDark={resolvedTheme === 'dark'}
                                        onOpenInSearch={(spl) => {
                                            const url = splunkSearchAppUrl(spl, timeRange);
                                            if (typeof window !== 'undefined') {
                                                window.open(
                                                    url,
                                                    '_blank',
                                                    'noopener,noreferrer'
                                                );
                                            }
                                        }}
                                    />
                                ) : (
                                    <SiteTable />
                                )}
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-3 flex-shrink-0">
                                <KpiCard
                                    label={KPI_CONFIG[0].label}
                                    value={topIncident.value}
                                    source={topIncident.source}
                                    accentColor="text-red-500"
                                />
                                <KpiCard
                                    label={KPI_CONFIG[1].label}
                                    value={operationalLead.value}
                                    source={operationalLead.source}
                                    accentColor="text-emerald-500"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <footer className="flex-shrink-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-1 text-center text-[8.5px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] leading-none">
                Splunk Adaptive Operations · Secure Executive Environment ©{' '}
                {lastRefreshed.getFullYear()}
            </footer>

            <HelpOverlay
                open={helpOpen}
                onClose={() => setHelpOpen(false)}
                shortcuts={SHORTCUTS.map((s) => ({
                    keys: s.keys,
                    description: s.description,
                }))}
            />
        </div>
    );
};

// =============================================================================
// Tiny KPI card under the map
// =============================================================================

interface KpiCardProps {
    label: string;
    value: string;
    source: 'live' | 'mock' | 'loading';
    accentColor: string;
}

// =============================================================================
// Regional view toggle (MAP / TABLE)
// =============================================================================

type RegionalView = 'map' | 'table';

interface RegionalViewToggleProps {
    value: RegionalView;
    onChange: (next: RegionalView) => void;
}

const RegionalViewToggle: React.FC<RegionalViewToggleProps> = ({ value, onChange }) => {
    const baseClass =
        'px-3 py-1 text-[10px] font-bold transition-colors rounded focus:outline-none focus:ring-1 focus:ring-sky-400';
    const activeClass =
        'bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 text-sky-600 dark:text-sky-300';
    const inactiveClass =
        'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300';
    return (
        <div
            role="tablist"
            aria-label="Regional view"
            className="flex bg-slate-100 dark:bg-slate-800/60 p-1 rounded-md"
        >
            <button
                type="button"
                role="tab"
                aria-selected={value === 'map'}
                onClick={() => onChange('map')}
                className={cn(baseClass, value === 'map' ? activeClass : inactiveClass)}
            >
                MAP
            </button>
            <button
                type="button"
                role="tab"
                aria-selected={value === 'table'}
                onClick={() => onChange('table')}
                className={cn(baseClass, value === 'table' ? activeClass : inactiveClass)}
            >
                TABLE
            </button>
        </div>
    );
};

// =============================================================================
// Site status table — rendered when the user flips MAP -> TABLE
// =============================================================================
//
// The catalogue mirrors the Florida cities baked into FloridaMap. Once a
// `Cisco - ds_site_status` saved search is wired in, swap this static
// list for a useMetric-style hook.

interface SiteRow {
    id: string;
    name: string;
    role: 'STATE HQ' | 'REGIONAL' | 'LOGISTICS';
    status: 'stable' | 'warning' | 'critical';
    events: number;
    alerts: number;
    latencyMs: number;
}

// Mirror of the 3 sites in FloridaMap. Keep the order in sync.
const SITE_ROWS: SiteRow[] = [
    { id: 'TLH', name: 'Tallahassee (State EOC)', role: 'STATE HQ', status: 'stable', events: 1240, alerts: 0, latencyMs: 28 },
    { id: 'MCO', name: 'Orlando (Regional Hub)', role: 'REGIONAL', status: 'warning', events: 4100, alerts: 12, latencyMs: 145 },
    { id: 'AUB', name: 'Auburndale (Logistics)', role: 'LOGISTICS', status: 'critical', events: 8200, alerts: 42, latencyMs: 310 },
];

const STATUS_DOT_CLASS: Record<SiteRow['status'], string> = {
    critical: 'bg-red-500',
    warning: 'bg-amber-500',
    stable: 'bg-emerald-500',
};

const SiteTable: React.FC = () => (
    <div className="h-full w-full overflow-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full text-left text-[11px] tabular-nums">
            <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900/95 backdrop-blur-sm">
                <tr className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                    <th className="px-3 py-2 font-black">Site</th>
                    <th className="px-3 py-2 font-black">Role</th>
                    <th className="px-3 py-2 font-black text-right">Events</th>
                    <th className="px-3 py-2 font-black text-right">Alerts</th>
                    <th className="px-3 py-2 font-black text-right">Latency</th>
                </tr>
            </thead>
            <tbody>
                {SITE_ROWS.map((row) => (
                    <tr
                        key={row.id}
                        className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                        <td className="px-3 py-1.5">
                            <div className="flex items-center gap-2">
                                <span
                                    className={cn(
                                        'w-2 h-2 rounded-full flex-shrink-0',
                                        STATUS_DOT_CLASS[row.status]
                                    )}
                                    title={row.status}
                                />
                                <div className="flex flex-col leading-tight">
                                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-100">
                                        {row.name}
                                    </span>
                                    <span className="text-[9px] font-mono text-slate-400 dark:text-slate-500 uppercase">
                                        {row.id}
                                    </span>
                                </div>
                            </div>
                        </td>
                        <td className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                            {row.role}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono text-slate-700 dark:text-slate-200">
                            {row.events.toLocaleString()}
                        </td>
                        <td
                            className={cn(
                                'px-3 py-1.5 text-right font-mono font-bold',
                                row.alerts > 0
                                    ? 'text-red-500 dark:text-red-400'
                                    : 'text-slate-400 dark:text-slate-500'
                            )}
                        >
                            {row.alerts}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono text-slate-700 dark:text-slate-200">
                            {row.latencyMs}ms
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

const KpiCard: React.FC<KpiCardProps> = ({ label, value, source, accentColor }) => (
    <div className="p-2 border border-slate-100 dark:border-slate-800 rounded-lg bg-slate-50/50 dark:bg-slate-800/40 relative">
        <span
            className={
                'absolute top-1 right-2 w-1.5 h-1.5 rounded-full ' +
                (source === 'live'
                    ? 'bg-emerald-500'
                    : source === 'loading'
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-slate-300 dark:bg-slate-600')
            }
            title={
                source === 'live'
                    ? 'Live'
                    : source === 'loading'
                    ? 'Loading…'
                    : 'No saved search assigned'
            }
        />
        <div className="flex items-center gap-2 mb-0.5">
            <div className={`w-1.5 h-1.5 rounded-full ${accentColor}`} />
            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                {label}
            </span>
        </div>
        <p
            className="text-xs font-bold text-slate-700 dark:text-slate-200 leading-tight truncate"
            title={value}
        >
            {value}
        </p>
    </div>
);

export default OverviewPage;
