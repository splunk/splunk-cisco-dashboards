/**
 * Splunk Cisco Dashboards — Overview Page
 *
 * Executive landing page adapted for Splunk and pumped full of
 * dashboards-tooling niceties:
 *   * Time-range picker (default Last 24 hours)
 *   * Auto-refresh interval picker + manual refresh button
 *   * Per-metric searchbase wiring, with saved-search dispatch used only
 *     for searches that are intentionally scheduled
 *   * Threshold-driven status colouring on every metric
 *   * Aggregate health badge derived from those statuses
 *   * Comparison overlay (previous-period dashed line) on every spark
 *   * Click-sparkline → opens the SPL in Splunk Search
 *   * Mini incident ticker, currently empty until a real incident feed is wired
 *   * KPI cards under the topology map driven by searchbase or inline SPL
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
    User,
    RefreshCw,
    Pause,
    Download,
    Keyboard,
    RotateCcw,
    Settings2,
    ExternalLink,
} from 'lucide-react';
import { DashboardSection } from '@/common/components/florida/DashboardSection';
import { MetricItem } from '@/common/components/florida/MetricItem';
import { TableTile } from '@/common/components/florida/TableTile';
import {
    sparklineVizTypeFromSplunkViz,
    normalizeDataValuesDisplay,
} from '@/common/components/florida/Sparkline';
import {
    CustomerTopologyMap,
    CUSTOMER_TOPOLOGY,
    clearCustomerTopologyStorage,
    type TopologySummaryMetricMap,
    TopologySiteTable,
    usePersistedTopology,
} from '@/common/components/florida/CustomerTopologyMap';
import { HealthBadge } from '@/common/components/florida/HealthBadge';
import { IncidentTicker } from '@/common/components/florida/IncidentTicker';
import { HelpOverlay } from '@/common/components/florida/HelpOverlay';
import { InfoTooltip } from '@/common/components/florida/InfoTooltip';
import {
    KpiPickerPanel,
    type KpiPickerContext,
} from '@/common/components/florida/KpiPickerPanel';
import {
    useMetric,
    useKpi,
    useTableData,
    isTableViz,
    type MetricConfig,
    type KpiConfig,
    type SectionId,
    type TimeRange,
    type MetricStatus,
} from '@/common/hooks/useMetric';
import { useExportPage } from '@/common/hooks/useExportPage';
import { useKeyboardShortcuts } from '@/common/hooks/useKeyboardShortcuts';
import { useTheme } from '@/common/hooks/useTheme';
import {
    usePersistedMetricOverrides,
    type MetricOverride,
} from '@/common/hooks/usePersistedMetricOverrides';
import { usePersistedSectionTileCounts } from '@/common/hooks/usePersistedSectionTileCounts';
import { usePersistedSectionTileOrder } from '@/common/hooks/usePersistedSectionTileOrder';
import { SortableMetricCard } from '@/common/components/florida/SortableMetricCard';
import {
    DndContext,
    PointerSensor,
    KeyboardSensor,
    useSensor,
    useSensors,
    closestCenter,
    type DragEndEvent,
} from '@dnd-kit/core';
import {
    SortableContext,
    sortableKeyboardCoordinates,
    arrayMove,
    horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { ThemeToggle } from '@/common/components/florida/ThemeToggle';
import { runSearch } from '@/common/services/splunkSearchService';
import {
    getSearchbaseCatalogue,
    type SearchbaseRecord,
} from '@/common/services/searchbaseCatalogue';
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

const splunkLocalePrefix = (): string => {
    if (typeof window === 'undefined') return '/en-US';
    const match = window.location.pathname.match(/^\/([a-z]{2}-[A-Z]{2})(?:\/|$)/);
    return `/${match ? match[1] : 'en-US'}`;
};

// =============================================================================
// Time range
// =============================================================================

const TIME_RANGE_OPTIONS: TimeRange[] = [
    { earliest: '-4h@h', latest: 'now', label: 'Last 4 hours', spanSeconds: 4 * 3600 },
    { earliest: '-24h@h', latest: 'now', label: 'Last 24 hours', spanSeconds: 24 * 3600 },
    { earliest: '-7d@d', latest: 'now', label: 'Last 7 days', spanSeconds: 7 * 86400 },
    { earliest: '-30d@d', latest: 'now', label: 'Last 30 days', spanSeconds: 30 * 86400 },
    { earliest: '-90d@d', latest: 'now', label: 'Last 90 days', spanSeconds: 90 * 86400 },
];
const DEFAULT_TIME_RANGE_LABEL = 'Last 24 hours';

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
// Each metric is bound to a `search_name` in `default/searchbase.conf`.
// The page resolves the binding to the literal SPL before dispatch so
// searchbase remains the runtime source of truth. `savedSearch` is kept
// as the config property name for persisted override compatibility.
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
        savedSearch: 'IT - Critical Systems - Network Health Score (Current)',
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
        savedSearch: 'Executive Dashboard - Current Device Health',
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
        savedSearch: 'Executive Dashboard - Issue Summary KPIs',
        valueField: 'total',
        thresholds: { warning: 500, critical: 1000, direction: 'lower_is_better' },
        mock: { seed: 13, sparkMin: 100, sparkMax: 800, value: 650, change: -50 },
    },
    {
        id: 'ux_score',
        section: 'it_health',
        label: 'UX score',
        subLabel: 'Catalyst client + device blend',
        description:
            'Composite user-experience score derived from Catalyst Center client ' +
            'health (scoreType=ALL, clientType=ALL) blended with the device ' +
            'reachability/manageability score. 0-100. Healthy >= 95; Critical < 75.',
        // Single row: { score: 0..100 }
        savedSearch: 'Executive Dashboard - User Experience Score',
        valueField: 'score',
        unit: '%',
        thresholds: { warning: 95, critical: 75, direction: 'higher_is_better' },
        mock: { seed: 14, sparkMin: 80, sparkMax: 100, value: 96, change: 1 },
    },
    {
        id: 'compliance',
        section: 'it_health',
        label: 'Compliance',
        subLabel: 'Catalyst compliance pass rate',
        description:
            'Percentage of Catalyst Center compliance checks that pass ' +
            '(COMPLIANT or COMPLIANT_WARNING). NOT_APPLICABLE checks are ' +
            'excluded. Healthy >= 95; Critical < 80.',
        // Single row: { pct: 0..100 }
        savedSearch: 'IT - Critical Systems - Compliance Rate',
        valueField: 'pct',
        unit: '%',
        thresholds: { warning: 95, critical: 80, direction: 'higher_is_better' },
        mock: { seed: 15, sparkMin: 70, sparkMax: 100, value: 92, change: -1 },
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
        savedSearch: 'Executive Dashboard - Firewall Blocked Connections',
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
        // Promoted to a first-class searchbase stanza so the picker
        // can offer it like the other 14 tiles and authors can tune
        // viz_options + tags from the conf instead of editing this
        // file. The underlying SPL still wraps the same Network_Traffic
        // tstats, just resolved through searchbaseCatalogue.
        savedSearch: 'Executive Dashboard - Threat Sources',
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
        savedSearch: 'Executive Dashboard - Failed Logons',
        valueField: 'count',
        color: '#0ea5e9',
        thresholds: { warning: 25, critical: 100, direction: 'lower_is_better' },
        mock: { seed: 23, sparkMin: 0, sparkMax: 5, value: 1, change: 0 },
    },
    {
        id: 'xdr_incidents',
        section: 'security',
        label: 'XDR incidents',
        subLabel: 'Distinct Cisco XDR incident IDs',
        description:
            'Count of distinct Cisco XDR / SecureX incident IDs in the dispatched ' +
            'window. Includes both real-time and summary incident sourcetypes. ' +
            'Warning at 5 active incidents, critical at 20.',
        // Single row: { total }
        savedSearch: 'Executive Dashboard - XDR Incidents',
        valueField: 'total',
        color: '#ef4444',
        thresholds: { warning: 5, critical: 20, direction: 'lower_is_better' },
        mock: { seed: 24, sparkMin: 0, sparkMax: 4, value: 2, change: 0 },
    },
    {
        id: 'sec_score',
        section: 'security',
        label: 'Security score',
        subLabel: 'ISE + AD auth success rate',
        description:
            'Authentication-success score blending ISE syslog ' +
            '(CISE_Passed_Authentications vs CISE_Failed_Attempts) with ' +
            'Windows AD events (4624 vs 4625). 0-100. Healthy >= 95; Critical < 80.',
        // Single row: { score: 0..100 }
        savedSearch: 'Executive Dashboard - Security Domain Score',
        valueField: 'score',
        unit: '%',
        color: '#10b981',
        thresholds: { warning: 95, critical: 80, direction: 'higher_is_better' },
        mock: { seed: 25, sparkMin: 80, sparkMax: 100, value: 98, change: 0 },
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
        // Time series: { active_devices }
        savedSearch: 'Executive Dashboard - Active Devices',
        valueField: 'active_devices',
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
        savedSearch: 'Executive Dashboard - Wifi Clients',
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
        savedSearch: 'Executive Dashboard - Building Occupancy (Dashboard Tile)',
        valueField: 'score',
        unit: '%',
        mock: { seed: 33, sparkMin: 0, sparkMax: 10, value: 0, change: 0 },
    },
    {
        id: 'bldg_score',
        section: 'building',
        label: 'Building score',
        subLabel: 'AP + presence + occupancy + comply',
        description:
            'Composite building-domain score: AP health (Catalyst Center) + ' +
            'device-presence connectivity (Cisco Spaces) + room occupancy + ' +
            'compliance pass-rate, averaged. 0-100. Healthy >= 90; Critical < 70.',
        // Single row: { score: 0..100 }
        savedSearch: 'Executive Dashboard - Building Score',
        valueField: 'score',
        unit: '%',
        color: '#10b981',
        thresholds: { warning: 90, critical: 70, direction: 'higher_is_better' },
        mock: { seed: 34, sparkMin: 70, sparkMax: 100, value: 87, change: 1 },
    },
    {
        id: 'collab_devices',
        section: 'building',
        label: 'Webex devices',
        subLabel: 'Distinct serials in telemetry',
        description:
            'Count of unique Webex collaboration endpoints reporting telemetry ' +
            '(WEBEX_TELEMETRY events) from Cisco Spaces. Drops in this number can ' +
            'indicate a feed issue or large-scale device offline event.',
        // Single row: { score }
        savedSearch: 'Executive Dashboard - Collab Devices',
        valueField: 'score',
        color: '#0ea5e9',
        mock: { seed: 35, sparkMin: 5, sparkMax: 50, value: 32, change: 0 },
    },
];

// =============================================================================
// Right-column KPI cards
// =============================================================================
//
// "Top incident volume" - site producing the most XDR/SecureX
// incident IDs. Uses eventstats to avoid post-aggregation sort/head.
//
// "Operational lead" - site with the strongest IT health. Derived
// from per-device health rolled up by Site (since there isn't a
// pre-built single-row "best site" stanza).
//
// Both fall back to mock if the data sources are empty (the dispatch
// returns 0 rows and `useKpi` shows the mockValue).
//
// Shape contract — IMPORTANT for the picker:
// These cards display a single STRING (typically a site name), not a
// numeric metric or sparkline. When swapping searches via the gear
// icon, pick one whose final pipeline emits a single row with a
// readable string column (set Value field to that column name). A
// numeric `timechart` will not produce a usable site label and will
// surface the empty-row "—" placeholder.

// Each tile binds to a `search_name` in `searchbase.conf` so:
//   1. the KPI picker's "currently bound" banner + Jump To button can
//      locate the entry (both gate on a non-null `currentSavedSearch`),
//   2. the runtime dispatch is the literal `search` field from the
//      catalogue entry — keeping picker preview, runtime, and the
//      Open-in-Search drilldown in lockstep,
//   3. the SPL itself stays out of this file so any rewrite happens in
//      one place (`searchbase.conf`) without rebuilding the React app.
//
// The same SPL is also embedded as `append [search ...]` blocks inside
// `overview_topology_overview` — that's intentional, the topology
// React component reads it as a single summary feed and shadows the
// useKpi value when no override is bound. Both paths now reference
// the canonical SPL string; neither is duplicated in TypeScript.
const KPI_CONFIG: KpiConfig[] = [
    {
        id: 'top_incident',
        label: 'Top incident volume',
        description:
            'Site name producing the most distinct XDR/SecureX incident IDs in ' +
            'the selected window. Helps the operator answer "which site is ' +
            'noisiest right now?". Outputs a single string (the site label).',
        savedSearch: 'Overview - Top Incident Volume',
        valueField: 'value',
        mockValue: 'Awaiting data',
    },
    {
        id: 'operational_lead',
        label: 'Operational lead',
        description:
            'Site name with the strongest IT health, derived from Catalyst ' +
            'Center device health rolled up by Site (Reachable+Managed=100, ' +
            'Reachable=50, else=0). Outputs a single string (the site label).',
        savedSearch: 'Overview - Operational Lead',
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
    it_health: { title: 'IT Health', linkText: 'Open IT health', href: 'it_health_v1' },
    security: { title: 'Security', linkText: 'Open security', href: 'security_v1' },
    building: {
        title: 'Building Intelligence',
        linkText: 'Open building intelligence',
        href: 'building_v1',
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
    /**
     * Optional override applied on top of the static config. When
     * present, the gear icon is rendered with a "modified" dot.
     */
    override?: MetricOverride;
    onConfigure: () => void;
    /**
     * Lookup of `searchbase.conf` entries keyed by `search_name`.
     *
     * - `null`        → still loading (defer dispatch; show mock).
     * - `Map (size 0)` -> finished loading but empty (fetch failed or
     *                   conf empty). Falls back to the configured binding.
     * - `Map`          → loaded; tile dispatches the literal `search`
     *                   from the matching entry.
     *
     * When a tile's effective binding matches an entry, the
     * dashboard *runtime* dispatches that entry's `search` field
     * (what the executive sees in the picker preview) and the
     * drilldown follows the same SPL — keeping the runtime, the
     * preview, and the drilldown in lockstep.
     */
    searchbaseByName: Map<string, SearchbaseRecord> | null;
}

/**
 * Returns a cloned MetricConfig with user picker overrides merged in.
 *
 * Only overridable fields are touched (search binding, value
 * field, label, description). Everything else — thresholds, mock
 * fallback, section, colour — stays put so the threshold-driven
 * status logic and visual identity stay consistent with the static
 * config.
 *
 * `valueField` does NOT fall back to `cfg.valueField` when an override
 * is in play. When the user binds a different searchbase entry, the
 * original tile's field name almost certainly doesn't exist in the
 * new search's output — carrying it forward used to make `useMetric`
 * read undefined values, filter to an empty series, and silently fall
 * back to the static mock (the "headline didn't change after a picker
 * swap" bug). When `override.valueField` is undefined, `useMetric`
 * auto-detects from the live result rows.
 */
const applyOverride = (cfg: MetricConfig, override?: MetricOverride): MetricConfig => {
    if (!override) return cfg;
    return {
        ...cfg,
        savedSearch: override.savedSearch,
        spl: undefined,
        valueField: override.valueField,
        label: override.label ?? cfg.label,
        description: override.description ?? cfg.description,
        // Blank these when the user binds a different search. The
        // original tile's `subLabel` (e.g. "Catalyst compliance pass
        // rate") and `unit` (e.g. "%") have no business decorating a
        // headline produced by an unrelated search — leaving them in
        // is what made every picker swap look like "the search didn't
        // change" even though it had: the user-visible chrome belonged
        // to the prior metric.
        subLabel: '',
        unit: '',
        // Flip the no-data behaviour: a tile bound by the user must
        // never silently re-render the original tile's hardcoded mock
        // value when its new SPL returns nothing on this Splunk env —
        // that's the "I picked a new search but the number didn't
        // change" bug. With this flag, useMetric emits a NaN sentinel
        // so MetricItem renders "—" instead of falling back to mock.
        suppressMockOnEmpty: true,
    };
};

const MetricCard: React.FC<MetricCardProps> = ({
    cfg,
    range,
    refreshToken,
    onStatus,
    infoAnchor = 'auto',
    override,
    onConfigure,
    searchbaseByName,
}) => {
    const effective = useMemo(() => applyOverride(cfg, override), [cfg, override]);

    // ---------------------------------------------------------------
    // Runtime dispatch config (the SPL the dashboard actually runs)
    // ---------------------------------------------------------------
    // searchbase.conf is the source of truth for SPL the user sees and
    // tweaks. When a tile's effective binding has a matching
    // searchbase entry, we replace the dispatch with the literal
    // `search` field — same SPL the picker preview renders, same SPL
    // the "Open in Search" drilldown opens. This keeps everything the
    // executive interacts with in lock-step.
    //
    // While `searchbaseByName === null` (still loading), we defer the
    // dispatch by stripping spl + savedSearch — useMetric short-circuits
    // to mock and waits. That avoids a "ghost dispatch" that fires
    // compatibility binding on first paint and gets superseded a
    // second later by the real searchbase SPL (double network round-trip).
    //
    // When a compatibility dependency has no matching searchbase
    // entry, we fall back to the configured binding.
    const dispatchedConfig = useMemo<typeof effective>(() => {
        if (!effective.savedSearch) return effective;
        if (searchbaseByName === null || searchbaseByName === undefined) {
            return { ...effective, savedSearch: undefined, spl: undefined };
        }
        const sb = searchbaseByName.get(effective.savedSearch);
        if (sb && sb.search) {
            return { ...effective, spl: sb.search, savedSearch: undefined };
        }
        return effective;
    }, [effective, searchbaseByName]);

    // Resolve the conf record (if any) so we can pull viz hints from it.
    // The picker preview, drilldown, and tile renderer must all agree
    // on which entry is in play — we read the same `effective.savedSearch`
    // → `searchbaseByName` lookup the dispatch logic above already does.
    const sbRecord = useMemo(() => {
        if (!effective.savedSearch || !searchbaseByName) return null;
        return searchbaseByName.get(effective.savedSearch) ?? null;
    }, [effective.savedSearch, searchbaseByName]);

    // Branch on viz type: tables get a wholly different rendering path
    // (TableTile + useTableData) so we never coerce categorical row
    // distributions through the single-value/sparkline pipeline. The
    // branch is component-level (rather than inside the body) so each
    // leaf calls its own data hook unconditionally — Rules of Hooks
    // forbid switching `useMetric` ↔ `useTableData` between renders.
    const showTable = isTableViz(sbRecord?.defaultViz);

    if (showTable) {
        return (
            <TableCardLeaf
                effective={effective}
                dispatchedConfig={dispatchedConfig}
                range={range}
                refreshToken={refreshToken}
                onStatus={onStatus}
                onConfigure={onConfigure}
                infoAnchor={infoAnchor}
                isCustomized={Boolean(override)}
            />
        );
    }
    return (
        <MetricCardLeaf
            effective={effective}
            dispatchedConfig={dispatchedConfig}
            sbRecord={sbRecord}
            range={range}
            refreshToken={refreshToken}
            onStatus={onStatus}
            onConfigure={onConfigure}
            infoAnchor={infoAnchor}
            isCustomized={Boolean(override)}
        />
    );
};

interface CommonLeafProps {
    effective: MetricConfig;
    dispatchedConfig: MetricConfig;
    range: TimeRange;
    refreshToken: number;
    onStatus: (id: string, status: MetricStatus) => void;
    onConfigure: () => void;
    infoAnchor: 'auto' | 'left' | 'right';
    isCustomized: boolean;
}

interface MetricCardLeafProps extends CommonLeafProps {
    sbRecord: SearchbaseRecord | null;
}

/**
 * Sparkline-tile leaf: single-value KPI rendered through MetricItem.
 * Mirrors the original MetricCard body verbatim; extracted into a
 * named component only so `MetricCard` can choose between this and
 * `TableCardLeaf` without violating the Rules of Hooks.
 */
const MetricCardLeaf: React.FC<MetricCardLeafProps> = ({
    effective,
    dispatchedConfig,
    sbRecord,
    range,
    refreshToken,
    onStatus,
    onConfigure,
    infoAnchor,
    isCustomized,
}) => {
    /**
     * Tile viz variant. `searchbase.conf`'s `default_viz` is the source
     * of truth when present; the static MetricConfig has no equivalent
     * field today, so absence falls back to `area` (the prior default).
     * User picker overrides intentionally inherit the new binding's
     * viz hints — the override switches *which* search drives the tile,
     * not how it's drawn, so the chart should track the new search.
     */
    const vizType = useMemo(
        () => sparklineVizTypeFromSplunkViz(sbRecord?.defaultViz),
        [sbRecord?.defaultViz]
    );

    /**
     * `viz_options.seriesColors[0]` overrides the static config colour
     * so the conf author can drive both viz type and palette in one
     * place. We only use the first entry (sparklines are single-series
     * today); multi-series support would honour the full array.
     */
    const tileColor = useMemo(() => {
        const seriesColors = sbRecord?.vizOptions?.seriesColors;
        if (Array.isArray(seriesColors)) {
            const first = seriesColors[0];
            if (typeof first === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(first.trim())) {
                return first.trim();
            }
        }
        return effective.color;
    }, [effective.color, sbRecord?.vizOptions]);

    /**
     * `viz_options.dataValuesDisplay` controls how Sparkline labels
     * the high/low points (Studio v2 analogue). Anything missing or
     * malformed falls through to the Sparkline default of `'minmax'`,
     * which is the project-wide policy now that the hardcoded peak
     * marker has been retired.
     */
    const dataValuesDisplay = useMemo(
        () =>
            normalizeDataValuesDisplay(
                sbRecord?.vizOptions?.dataValuesDisplay
            ),
        [sbRecord?.vizOptions]
    );

    const result = useMetric(dispatchedConfig, range, refreshToken);

    useEffect(() => {
        onStatus(effective.id, result.status);
    }, [effective.id, result.status, onStatus]);

    // Drilldown SPL — what we open in Splunk Search when the user
    // clicks the "open in search" icon or the sparkline. Always
    // mirrors what `useMetric` dispatched (`result.spl`), so the click
    // and the runtime are in sync.
    const drilldownSpl = result.spl;

    const handleClick = useCallback(() => {
        if (!drilldownSpl) return;
        const url = splunkSearchAppUrl(drilldownSpl, range);
        if (typeof window !== 'undefined') window.open(url, '_blank', 'noopener,noreferrer');
    }, [drilldownSpl, range]);

    return (
        <MetricItem
            label={effective.label}
            subLabel={effective.subLabel}
            description={effective.description}
            // Footnote intentionally omitted: surfacing the literal SPL
            // in the info tooltip clutters the executive view and
            // duplicates what the "Open in Search" icon already
            // exposes. The SPL is one click away — we don't need to
            // dump it into a hover popover too.
            descriptionFootnote={undefined}
            infoAnchor={infoAnchor}
            value={result.value}
            unit={effective.unit}
            change={result.change}
            sparkData={result.sparkData}
            previousData={result.previousSparkData}
            sparkTimestamps={result.sparkTimestamps}
            timeRange={range}
            color={tileColor}
            vizType={vizType}
            dataValuesDisplay={dataValuesDisplay}
            status={result.status}
            source={result.source}
            onOpenInSearch={drilldownSpl ? handleClick : undefined}
            onConfigure={onConfigure}
            isCustomized={isCustomized}
            sparkTitle={
                // The chart itself is no longer a click target — the
                // ExternalLink icon next to the tile label is the
                // explicit drilldown affordance. We keep `sparkTitle`
                // around as a hover hint so users still discover the
                // per-bucket Recharts tooltip.
                drilldownSpl ? 'Hover for date and value' : undefined
            }
            noDataReason={result.noDataReason}
            rangeLabel={result.rangeLabel}
        />
    );
};

/**
 * Categorical-tile leaf: multi-row table rendered through TableTile.
 * Activated when the bound searchbase stanza declares
 * `default_viz = splunk.table`. Tables don't have a "status" in the
 * threshold sense, so we always emit `unknown` to keep the aggregate
 * health badge math identical to before this branch existed.
 */
const TableCardLeaf: React.FC<CommonLeafProps> = ({
    effective,
    dispatchedConfig,
    range,
    refreshToken,
    onStatus,
    onConfigure,
    infoAnchor,
    isCustomized,
}) => {
    const result = useTableData(dispatchedConfig, range, refreshToken);

    useEffect(() => {
        onStatus(effective.id, 'unknown');
    }, [effective.id, onStatus]);

    const drilldownSpl = result.spl;
    const handleClick = useCallback(() => {
        if (!drilldownSpl) return;
        const url = splunkSearchAppUrl(drilldownSpl, range);
        if (typeof window !== 'undefined') window.open(url, '_blank', 'noopener,noreferrer');
    }, [drilldownSpl, range]);

    return (
        <TableTile
            label={effective.label}
            subLabel={effective.subLabel}
            description={effective.description}
            descriptionFootnote={undefined}
            infoAnchor={infoAnchor}
            rows={result.rows}
            columns={result.columns}
            totalRowCount={result.totalRowCount}
            source={result.source}
            onOpenInSearch={drilldownSpl ? handleClick : undefined}
            onConfigure={onConfigure}
            isCustomized={isCustomized}
            noDataReason={result.noDataReason}
            rangeLabel={result.rangeLabel}
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
    const [splunkUsername, setSplunkUsername] = useState<string>('');

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

    // ------------------------------ Section tile-count preference ------------------------------
    //
    // Per-user, per-section "how many tiles do I want visible". The
    // user dials it via the small `−  N  +` pill on each section
    // header. Trailing tiles (from the bottom of METRIC_CONFIG for
    // that section) are the ones that hide first when narrowing —
    // picker overrides on hidden tiles are NOT cleared, so a user
    // who customises tile #5, dials down to 3, then back up to 5,
    // gets their customisation back unchanged.
    //
    // Bounds: 3..5 with a default of 5 (today's behaviour). Bumping
    // the cap above 5 only requires changing `maxCount` here and
    // adding more tiles to METRIC_CONFIG; the pill, the slicing,
    // and the status-aggregation filter all key off this single
    // source of truth.
    //
    // Declared up here (before the aggregate status block) because
    // the HealthBadge filter below needs to know which tiles are
    // currently visible.
    const {
        counts: sectionTileCounts,
        bounds: sectionTileBounds,
        setCount: setSectionTileCount,
        resetAll: resetAllSectionTileCounts,
    } = usePersistedSectionTileCounts({ minCount: 3, maxCount: 5, defaultCount: 5 });

    // ------------------------------ Section tile-order preference ------------------------------
    //
    // Companion to the count preference: the user can drag tiles
    // within a section to put their favourites first. Combined with
    // the count pill's trailing-hide rule, the user has full control
    // over which tiles appear and in what order.
    //
    // `getOrder(section, canonicalIds)` reconciles the persisted
    // order against METRIC_CONFIG on every read — renamed/removed
    // tiles drop out, new tiles are appended at the end so they
    // can't bump the user's chosen top tiles out of view when a
    // release ships.
    const {
        getOrder: getSectionTileOrder,
        setOrder: setSectionTileOrder,
        resetAll: resetAllSectionTileOrder,
    } = usePersistedSectionTileOrder();

    // Drag sensors:
    //   * PointerSensor with a small activationConstraint so a click
    //     on the grip handle that doesn't move (e.g., a missed drag
    //     attempt) doesn't accidentally trigger reordering.
    //   * KeyboardSensor for users who navigate by keyboard — the
    //     `sortableKeyboardCoordinates` helper translates arrow
    //     keys into drag deltas that respect the sortable layout.
    const dndSensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 5 },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // ------------------------------ Aggregate status ------------------------------
    const [statuses, setStatuses] = useState<Record<string, MetricStatus>>({});
    const reportStatus = useCallback((id: string, s: MetricStatus) => {
        setStatuses((prev) => (prev[id] === s ? prev : { ...prev, [id]: s }));
    }, []);

    // The HealthBadge should only reflect tiles the user is
    // currently *seeing*. When a tile is hidden (because the user
    // dialled the section count down), its last reported status
    // would otherwise stick around in `statuses` and skew the
    // aggregate. Recompute the visible-tile id set whenever the
    // per-section count preference changes and use it as the gate
    // both for the badge and (below) for the section render.
    const visibleMetricIds = useMemo(() => {
        const out = new Set<string>();
        for (const section of ['it_health', 'security', 'building'] as const) {
            // Same pipeline the render below uses: canonical ids ->
            // apply user reorder -> slice to visible count. Keeping
            // the badge filter and the render in lockstep means a
            // tile dragged into the visible window also gets its
            // status counted in the aggregate, and a tile dragged
            // out is dropped immediately.
            const canonicalIds = METRIC_CONFIG.filter((m) => m.section === section).map(
                (m) => m.id
            );
            const orderedIds = getSectionTileOrder(section, canonicalIds);
            const visible = orderedIds.slice(0, sectionTileCounts[section]);
            for (const id of visible) out.add(id);
        }
        return out;
    }, [sectionTileCounts, getSectionTileOrder]);

    const statusList = useMemo(
        () =>
            Object.entries(statuses)
                .filter(([id]) => visibleMetricIds.has(id))
                .map(([, s]) => s),
        [statuses, visibleMetricIds]
    );

    // ------------------------------ Help overlay ------------------------------
    const [helpOpen, setHelpOpen] = useState(false);

    // ------------------------------ Searchbase metadata ------------------------------
    // Loaded once at page mount and shared across all metric tiles via
    // a Map keyed by `search_name`. Drives the *runtime dispatch* of
    // each metric tile. When a tile's effective binding matches
    // an entry, we run that entry's literal SPL instead of the
    // `| savedsearch "..."` indirection. The drilldown / hover preview
    // / picker all read from the same SPL, so they're guaranteed to
    // agree with what's actually executing.
    //
    // `null` is the loading sentinel — tiles defer their dispatch
    // until the catalogue resolves so we don't fire a ghost
    // compatibility request that gets superseded a moment later.
    // On fetch failure we set an empty Map so tiles fall back to the
    // configured dispatch path (still functional, just less
    // executive-friendly drilldowns).
    const [searchbaseByName, setSearchbaseByName] = useState<
        Map<string, SearchbaseRecord> | null
    >(null);
    useEffect(() => {
        let cancelled = false;
        getSearchbaseCatalogue()
            .then((list) => {
                if (cancelled) return;
                const map = new Map<string, SearchbaseRecord>();
                for (const entry of list) {
                    if (entry.searchName) map.set(entry.searchName, entry);
                }
                setSearchbaseByName(map);
            })
            .catch(() => {
                if (!cancelled) setSearchbaseByName(new Map());
            });
        return () => {
            cancelled = true;
        };
    }, []);

    // ------------------------------ Regional view (map | table) ------------------------------
    const [regionalView, setRegionalView] = useState<RegionalView>('map');
    const [topologySummaryById, setTopologySummaryById] =
        useState<TopologySummaryMetricMap>({});
    const handleTopologySummaryChange = useCallback(
        (metrics: TopologySummaryMetricMap) => {
            setTopologySummaryById(metrics);
        },
        []
    );

    // ------------------------------ Layout split (tiles ↔ map) ------------------------------
    // Percentage of the dashboard width allocated to the left-hand
    // metric tile column. The remainder goes to the map column. The
    // splitter is the thin vertical handle between the two — drag it
    // left to widen the map, right to widen the tiles. Default 58.33%
    // matches the previous fixed 7-of-12 grid so the page boots
    // identically until the user reaches for the handle. Persisted to
    // localStorage so the operator's preference survives reloads.
    //
    // Clamped 35–80% to keep both columns usable: below 35% and the
    // tiles can't even fit one row of headlines without truncating;
    // above 80% and the map collapses to a slim band that's hard to
    // read region labels on.
    const SPLIT_KEY = 'scd_overview_split_pct';
    const SPLIT_DEFAULT = 58.33;
    const SPLIT_MIN = 35;
    const SPLIT_MAX = 80;
    const [leftPct, setLeftPct] = useState<number>(() => {
        if (typeof window === 'undefined') return SPLIT_DEFAULT;
        try {
            const saved = window.localStorage.getItem(SPLIT_KEY);
            const n = saved ? Number(saved) : NaN;
            return Number.isFinite(n) && n >= SPLIT_MIN && n <= SPLIT_MAX
                ? n
                : SPLIT_DEFAULT;
        } catch {
            return SPLIT_DEFAULT;
        }
    });
    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            window.localStorage.setItem(SPLIT_KEY, String(leftPct));
        } catch {
            // localStorage may be disabled (private mode / quota); the
            // split still works for the session, we just can't
            // persist it. No-op rather than spamming console.errors.
        }
    }, [leftPct]);

    // While the splitter is being dragged, every mousemove updates the
    // percentage. We keep the handler attached to the window (not the
    // splitter element) so the drag survives the cursor leaving the
    // 4px-wide handle — same UX pattern as VS Code panel resizers.
    const splitContainerRef = useRef<HTMLDivElement | null>(null);
    const [dragging, setDragging] = useState(false);
    const beginDrag = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setDragging(true);
    }, []);
    useEffect(() => {
        if (!dragging) return undefined;
        const onMove = (ev: MouseEvent) => {
            const el = splitContainerRef.current;
            if (!el) return;
            const rect = el.getBoundingClientRect();
            if (rect.width <= 0) return;
            const pct = ((ev.clientX - rect.left) / rect.width) * 100;
            const clamped = Math.max(SPLIT_MIN, Math.min(SPLIT_MAX, pct));
            setLeftPct(clamped);
        };
        const onUp = () => setDragging(false);
        // Lock the cursor and suppress text-selection while dragging.
        // Without this the cursor flickers between col-resize and the
        // default arrow as the pointer crosses tile boundaries, and
        // sustained drags accidentally select metric labels.
        const prevCursor = document.body.style.cursor;
        const prevUserSelect = document.body.style.userSelect;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            document.body.style.cursor = prevCursor;
            document.body.style.userSelect = prevUserSelect;
        };
    }, [dragging]);
    // Keyboard nudge: arrow keys ±1, Shift+arrow ±5. Double-click
    // restores the default split. Both make the handle keyboard- and
    // touch-friendly without hijacking page-level shortcuts.
    const onSplitterKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            const step = e.shiftKey ? 5 : 1;
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                setLeftPct((p) => Math.max(SPLIT_MIN, p - step));
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                setLeftPct((p) => Math.min(SPLIT_MAX, p + step));
            } else if (e.key === 'Home') {
                e.preventDefault();
                setLeftPct(SPLIT_MIN);
            } else if (e.key === 'End') {
                e.preventDefault();
                setLeftPct(SPLIT_MAX);
            }
        },
        [SPLIT_MIN, SPLIT_MAX]
    );
    const resetSplit = useCallback(() => setLeftPct(SPLIT_DEFAULT), []);

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

    // ------------------------------ Splunk user fetch ------------------------------
    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        let cancelled = false;
        const bootstrap = (window as unknown as {
            $C?: {
                USERNAME?: string;
                username?: string;
                USER?: { name?: string; username?: string };
                user?: { name?: string; username?: string };
            };
        }).$C;
        const bootstrapName =
            bootstrap?.USERNAME ??
            bootstrap?.username ??
            bootstrap?.USER?.username ??
            bootstrap?.USER?.name ??
            bootstrap?.user?.username ??
            bootstrap?.user?.name ??
            '';

        fetch(
            `${splunkLocalePrefix()}/splunkd/__raw/services/authentication/current-context?output_mode=json`,
            {
                credentials: 'include',
                headers: { Accept: 'application/json' },
            }
        )
            .then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json() as Promise<{
                    entry?: Array<{ content?: Record<string, unknown> }>;
                }>;
            })
            .then((json) => {
                if (cancelled) return;
                const content = json.entry?.[0]?.content ?? {};
                const raw =
                    content.username ??
                    content.user ??
                    content.name ??
                    bootstrapName;
                const username = typeof raw === 'string' ? raw.trim() : '';
                setSplunkUsername(username);
            })
            .catch(() => {
                if (!cancelled) setSplunkUsername(bootstrapName.trim());
            });

        return () => {
            cancelled = true;
        };
    }, []);

    // ------------------------------ Metric / KPI overrides (picker) ------------------------------
    //
    // Each tile stores its (optional) override under its `id`. The
    // picker writes via `setOverride` and the gear icons read out of
    // the same map so the customised dot stays in sync. Reset wipes
    // every override and brings the dashboard back to the static
    // config defined in this file.
    const {
        overrides,
        setOverride,
        clearOverride,
        resetAll: resetAllOverrides,
        overrideCount,
    } = usePersistedMetricOverrides();
    const [pickerContext, setPickerContext] = useState<KpiPickerContext | null>(null);

    // Bump this counter to force a fresh mount of <CustomerTopologyMap>.
    // localStorage `storage` events only fire across tabs, so wiping
    // the persisted topology in this tab won't reseed the map's
    // internal state on its own — a remount via `key={topologyResetKey}`
    // gets the hook to re-read storage (now empty) and fall back to
    // the canonical CUSTOMER_TOPOLOGY factory.
    const [topologyResetKey, setTopologyResetKey] = useState(0);

    // Read the persisted topology so the dashboard header can show the
    // user's edited name / subtitle from the topology editor (instead of
    // hardcoded "Network Topology" / "Site connectivity and path
    // health"). The same hook the map uses; same localStorage key, so
    // edits land here without any manual sync.
    const { topology: persistedTopology } = usePersistedTopology(
        CUSTOMER_TOPOLOGY
    );
    const topologyHeaderName =
        persistedTopology.name?.trim() || 'Network Topology';
    const topologyHeaderSubtitle =
        persistedTopology.subtitle?.trim() ||
        'Site connectivity and path health';

    // Saved-search names already bound across the dashboard, so the
    // picker can flag duplicates with an "in use" badge.
    const usedSavedSearches = useMemo(() => {
        const used = new Set<string>();
        for (const m of METRIC_CONFIG) {
            const ov = overrides[m.id];
            const name = ov?.savedSearch ?? m.savedSearch;
            if (name) used.add(name);
        }
        for (const k of KPI_CONFIG) {
            const ov = overrides[k.id];
            const name = ov?.savedSearch ?? k.savedSearch;
            if (name) used.add(name);
        }
        return used;
    }, [overrides]);

    const openPicker = useCallback(
        (
            tileId: string,
            defaultLabel: string,
            current?: { savedSearch?: string; valueField?: string }
        ) => {
            const ov: MetricOverride | undefined = overrides[tileId];
            // CRITICAL: when an override exists, an undefined
            // `valueField` is the user's explicit "use auto-detect"
            // choice and must NOT fall through to the original tile's
            // valueField. The previous `??` did exactly that, which
            // pre-filled the picker input with the original column
            // name and caused every subsequent Apply to clobber the
            // user's auto-detect intent.
            setPickerContext({
                tileId,
                defaultLabel,
                currentSavedSearch: ov ? ov.savedSearch : current?.savedSearch,
                currentValueField: ov ? ov.valueField : current?.valueField,
                currentLabel: ov?.label,
                usedSavedSearches,
            });
        },
        [overrides, usedSavedSearches]
    );

    const closePicker = useCallback(() => setPickerContext(null), []);

    const handlePickerApply = useCallback(
        (tileId: string, override: MetricOverride) => {
            setOverride(tileId, override);
            setPickerContext(null);
        },
        [setOverride]
    );

    // "Factory reset" — wipes every persisted dashboard customisation
    // in one shot. The picker shows a `window.confirm()` prompt before
    // calling this, so misclicks are caught at the UI layer; we only
    // get here if the user has explicitly agreed.
    //
    // What gets reset (and the localStorage key cleared):
    //   • metricOverrides.v1            — per-tile picker bindings
    //   • sectionTileCounts.v1          — visible tile count per section
    //   • sectionTileOrder.v1           — drag-to-reorder preference
    //   • customerTopology.v3           — Florida map customisations
    //   • scd_overview_split_pct        — tiles ↔ map splitter position
    //
    // What is intentionally NOT reset:
    //   • theme (light / dark) — UI preference, not layout
    //   • Splunk-side preferences (saved searches, scheduled jobs) —
    //     those don't live in this dashboard's localStorage
    //
    // After reset, we close the picker and bump `topologyResetKey` so
    // the map re-mounts with its now-empty persisted state and falls
    // through to the canonical CUSTOMER_TOPOLOGY factory.
    const handleResetAllCustomizations = useCallback(() => {
        resetAllOverrides();
        resetAllSectionTileCounts();
        resetAllSectionTileOrder();
        clearCustomerTopologyStorage();
        setTopologyResetKey((n) => n + 1);
        setLeftPct(SPLIT_DEFAULT);
        if (typeof window !== 'undefined' && window.localStorage) {
            try {
                window.localStorage.removeItem(SPLIT_KEY);
            } catch {
                // Storage unavailable; the setLeftPct above is the
                // authoritative reset for this session anyway.
            }
        }
        setPickerContext(null);
    }, [
        resetAllOverrides,
        resetAllSectionTileCounts,
        resetAllSectionTileOrder,
        SPLIT_KEY,
        SPLIT_DEFAULT,
        setLeftPct,
    ]);

    // ------------------------------ KPI cards ------------------------------
    // Same `valueField: ov.valueField` (no fallback) and
    // `suppressMockOnEmpty: true` rules as `applyOverride` for the
    // metric grid — see the long comment there. The fallback to the
    // original tile's `valueField` was the same root cause: useKpi
    // would read a column the new SPL doesn't emit, get undefined,
    // and quietly fall back to the original tile's mock string.
    //
    // Searchbase resolution mirrors `dispatchedConfig` for the metric
    // grid: when the picker writes `savedSearch: <searchbase entry name>`,
    // we look that name up in `searchbaseByName` and replace the binding
    // with the literal `search` field — same SPL the picker preview shows
    // and the "Open in Search" drilldown opens. This is the critical step
    // that was missing: most catalogue searches (e.g.
    // "Building Resilience - Power Trend") live ONLY in searchbase.conf,
    // not in savedsearches.conf, so a raw `| savedsearch "X"` dispatch
    // was failing silently → tile showed "Awaiting data" / "—" → looked
    // like the picker did nothing.
    //
    // While `searchbaseByName === null` (still loading) we strip both
    // `spl` and `savedSearch` so useKpi short-circuits to mock and waits
    // — same defer pattern as `dispatchedConfig` to avoid a doomed first
    // dispatch that gets superseded once the catalogue lands.
    const buildEffectiveKpiCfg = (
        base: KpiConfig,
        ov: MetricOverride | undefined
    ): KpiConfig => {
        // Defer until the catalogue is ready — same defer pattern as
        // `dispatchedConfig` for the metric grid. Without this, the first
        // dispatch fires against the static binding before searchbase
        // resolves and gets immediately superseded; useKpi's mock briefly
        // flashes through to the user.
        if (searchbaseByName === null) {
            return {
                ...base,
                spl: undefined,
                savedSearch: undefined,
                ...(ov
                    ? {
                          valueField: ov.valueField,
                          label: ov.label ?? base.label,
                          suppressMockOnEmpty: true,
                      }
                    : {}),
            };
        }
        // No override — use the static binding from KPI_CONFIG. Resolve
        // `savedSearch` through the searchbase catalogue to literal SPL
        // exactly like the override branch does, so:
        //   1. The KPI picker's "currently bound" banner / Jump To
        //      button can match this saved search to a catalogue entry
        //      (both gate on `cfg.savedSearch` being set at picker-open
        //      time, which we preserve via `currentSavedSearch`).
        //   2. The runtime dispatch is the catalogue's literal `search`
        //      field — same SPL the picker preview shows and the Open
        //      in Search drilldown opens, no `| savedsearch "..."`
        //      indirection that would fail for searchbase-only entries.
        if (!ov) {
            const sbBase = base.savedSearch
                ? searchbaseByName.get(base.savedSearch)
                : undefined;
            if (sbBase && sbBase.search) {
                return {
                    ...base,
                    // Keep `savedSearch` set so the picker can locate
                    // the currently-bound entry, but inject the literal
                    // SPL so useKpi dispatches that directly instead
                    // of a doomed `| savedsearch` indirection.
                    spl: sbBase.search,
                };
            }
            return base;
        }
        const sb = ov.savedSearch
            ? searchbaseByName.get(ov.savedSearch)
            : undefined;
        if (sb && sb.search) {
            return {
                ...base,
                spl: sb.search,
                savedSearch: undefined,
                valueField: ov.valueField,
                label: ov.label ?? base.label,
                suppressMockOnEmpty: true,
            };
        }
        // No matching searchbase entry — fall through to the configured
        // savedsearch name (will resolve only if a real savedsearches.conf
        // stanza of that name exists).
        return {
            ...base,
            savedSearch: ov.savedSearch,
            spl: undefined,
            valueField: ov.valueField,
            label: ov.label ?? base.label,
            suppressMockOnEmpty: true,
        };
    };
    const effectiveTopIncidentCfg = useMemo<KpiConfig>(
        () => buildEffectiveKpiCfg(KPI_CONFIG[0], overrides[KPI_CONFIG[0].id]),
        [overrides, searchbaseByName]
    );
    const effectiveOpLeadCfg = useMemo<KpiConfig>(
        () => buildEffectiveKpiCfg(KPI_CONFIG[1], overrides[KPI_CONFIG[1].id]),
        [overrides, searchbaseByName]
    );
    const topIncident = useKpi(effectiveTopIncidentCfg, timeRange, refreshToken);
    const operationalLead = useKpi(effectiveOpLeadCfg, timeRange, refreshToken);
    const topologyTopIncident = topologySummaryById.top_incident;
    const topologyOperationalLead = topologySummaryById.operational_lead;
    // Picker-override precedence: when the operator has explicitly bound
    // a different search via the gear icon (overrides[id] present), the
    // user's `useKpi` result wins. Otherwise we fall through to the
    // topology overview SPL summary row (cheap, already-running, kept in
    // lockstep with the map). Without this branch, the topology summary
    // silently shadowed the override and the picker appeared broken.
    const topIncidentOverride = overrides[KPI_CONFIG[0].id];
    const operationalLeadOverride = overrides[KPI_CONFIG[1].id];
    const topIncidentCard = topIncidentOverride
        ? {
              label: effectiveTopIncidentCfg.label,
              value: topIncident.value,
              source: topIncident.source,
          }
        : {
              label: topologyTopIncident?.label ?? effectiveTopIncidentCfg.label,
              value: topologyTopIncident?.value ?? topIncident.value,
              source: topologyTopIncident?.source ?? topIncident.source,
          };
    const operationalLeadCard = operationalLeadOverride
        ? {
              label: effectiveOpLeadCfg.label,
              value: operationalLead.value,
              source: operationalLead.source,
          }
        : {
              label: topologyOperationalLead?.label ?? effectiveOpLeadCfg.label,
              value: topologyOperationalLead?.value ?? operationalLead.value,
              source: topologyOperationalLead?.source ?? operationalLead.source,
          };
    // Footnote shown at the bottom of the info tooltip — surfaces the
    // current data source so the operator can trace lineage. When an
    // override is bound, we point at the user's saved search; otherwise
    // we name the topology overview stanza that's actually emitting the
    // value (or "(inline SPL)" if both are absent).
    // Drilldown SPL: always the literal SPL useKpi just dispatched
    // (`topIncident.spl` / `operationalLead.spl`). When no override is
    // bound, that's the inline KPI_CONFIG SPL — a clean, single-purpose
    // query — which is a far better drilldown target than the giant
    // `overview_topology_overview` pipeline. When an override is bound,
    // it's the resolved searchbase SPL → exactly what the picker preview
    // showed. Either way: see-and-click parity with what's running.
    const topIncidentDrilldownSpl = topIncident.spl;
    const operationalLeadDrilldownSpl = operationalLead.spl;
    const handleTopIncidentOpenInSearch = useCallback(() => {
        if (!topIncidentDrilldownSpl) return;
        const url = splunkSearchAppUrl(topIncidentDrilldownSpl, timeRange);
        if (typeof window !== 'undefined') {
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    }, [topIncidentDrilldownSpl, timeRange]);
    const handleOperationalLeadOpenInSearch = useCallback(() => {
        if (!operationalLeadDrilldownSpl) return;
        const url = splunkSearchAppUrl(operationalLeadDrilldownSpl, timeRange);
        if (typeof window !== 'undefined') {
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    }, [operationalLeadDrilldownSpl, timeRange]);
    // Footnote precedence:
    //   1. Override bound  → user's saved search (or "(inline SPL)" if
    //      they wired a free-form SPL via the picker).
    //   2. Topology summary feed  → that's the actual source of the
    //      displayed value; surface the topology overview stanza.
    //   3. useKpi default path  → the static binding from KPI_CONFIG,
    //      which is a real searchbase entry now (`Overview - Top Incident
    //      Volume` / `Overview - Operational Lead`). Surface that name
    //      so the footnote credits the actual SPL that ran.
    const topIncidentBindingFootnote = topIncidentOverride
        ? topIncidentOverride.savedSearch
            ? `Saved search: ${topIncidentOverride.savedSearch}`
            : '(inline SPL)'
        : topologyTopIncident
        ? 'Saved search: Overview - Topology Overview'
        : KPI_CONFIG[0].savedSearch
        ? `Saved search: ${KPI_CONFIG[0].savedSearch}`
        : '(inline SPL)';
    const operationalLeadBindingFootnote = operationalLeadOverride
        ? operationalLeadOverride.savedSearch
            ? `Saved search: ${operationalLeadOverride.savedSearch}`
            : '(inline SPL)'
        : topologyOperationalLead
        ? 'Saved search: Overview - Topology Overview'
        : KPI_CONFIG[1].savedSearch
        ? `Saved search: ${KPI_CONFIG[1].savedSearch}`
        : '(inline SPL)';

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
                    {overrideCount > 0 && (
                        <button
                            type="button"
                            onClick={() => {
                                if (
                                    typeof window !== 'undefined' &&
                                    !window.confirm(
                                        `Reset ${overrideCount} customised tile${
                                            overrideCount === 1 ? '' : 's'
                                        } to their default search bindings?`
                                    )
                                ) {
                                    return;
                                }
                                resetAllOverrides();
                            }}
                            title={`Reset ${overrideCount} customised tile${
                                overrideCount === 1 ? '' : 's'
                            }`}
                            className={cn(
                                iconBtnClass,
                                'relative text-sky-600 dark:text-sky-300'
                            )}
                        >
                            <RotateCcw className="w-4 h-4" />
                            <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] rounded-full bg-sky-500 text-white text-[9px] font-black leading-[14px] text-center px-0.5 border border-white dark:border-slate-900">
                                {overrideCount}
                            </span>
                        </button>
                    )}
                    <ThemeToggle theme={theme} onCycle={cycleTheme} />
                    <button
                        type="button"
                        onClick={() => setHelpOpen(true)}
                        title="Keyboard shortcuts (?)"
                        className={iconBtnClass}
                    >
                        <Keyboard className="w-4 h-4" />
                    </button>
                    {splunkUsername && (
                        <div className="flex items-center gap-2">
                            <div className="text-right hidden xl:block">
                                <p
                                    className="text-[11px] font-bold text-slate-700 dark:text-slate-200 leading-none max-w-[140px] truncate"
                                    title={splunkUsername}
                                >
                                    {splunkUsername}
                                </p>
                                <p className="text-[9px] text-slate-400 dark:text-slate-500 leading-tight">
                                    Splunk session
                                </p>
                            </div>
                            <div
                                className="w-8 h-8 rounded-full bg-sky-100 dark:bg-sky-900/40 border border-sky-200 dark:border-sky-800 flex items-center justify-center text-sky-600 dark:text-sky-300"
                                title={`Signed in as ${splunkUsername}`}
                            >
                                <User className="w-4 h-4" />
                            </div>
                        </div>
                    )}
                </div>
            </header>

            {/* Mini incident ticker */}
            <IncidentTicker range={timeRange} refreshToken={refreshToken} />

            {/* Edge-to-edge layout: no `max-w` clamp and only a thin
                horizontal gutter. The previous `max-w-[1600px] mx-auto`
                left half-inch margins on either side at executive-
                display resolutions; widening lets the metric tiles and
                map breathe to fill the screen. The viewport gets a 6px
                gutter on each side (just enough to keep the section
                cards from touching the chrome border) and the splitter
                drives column widths from there.
                
                Below xl (<1280px) the layout collapses to a single
                stacked column so the splitter never strands the map
                or tiles in a slim phone-sized strip. */}
            <main className="flex-1 min-h-0 px-1.5 py-2 w-full overflow-hidden">
                <div
                    ref={splitContainerRef}
                    className="flex flex-col xl:flex-row gap-2 h-full min-h-0 relative"
                    style={
                        {
                            '--scd-left-pct': `${leftPct}%`,
                        } as React.CSSProperties
                    }
                >
                    {/* Left column — three sections.
                        On xl+ widths the column basis is driven by the
                        --scd-left-pct CSS variable, which the splitter
                        updates on drag. Below xl we ignore it and let
                        flex-col stack at full width. */}
                    <div className="flex flex-col gap-2 min-h-0 min-w-0 w-full xl:w-[var(--scd-left-pct)] xl:flex-shrink-0">
                        {(['it_health', 'security', 'building'] as const).map((section) => {
                            const meta = SECTION_META[section];
                            const allSectionMetrics = METRIC_CONFIG.filter(
                                (m) => m.section === section
                            );
                            // The pill's max is whichever is smaller —
                            // the global cap (sectionTileBounds.maxCount)
                            // or what METRIC_CONFIG actually offers for
                            // this section. Today both are 5 across the
                            // board, but this keeps the UI honest if
                            // someone trims a section to 4 tiles in
                            // METRIC_CONFIG without touching this code.
                            const sectionMaxAvailable = Math.min(
                                sectionTileBounds.maxCount,
                                allSectionMetrics.length
                            );
                            const visibleCount = Math.min(
                                sectionTileCounts[section],
                                sectionMaxAvailable
                            );

                            // Apply the user's drag-reorder
                            // preference (if any) to the canonical
                            // tile list, then slice to the visible
                            // count. The id-keyed `byId` lookup lets
                            // the render iterate ordered ids while
                            // still resolving each id back to its
                            // full MetricConfig — no per-iteration
                            // .find() scan.
                            const canonicalIds = allSectionMetrics.map((m) => m.id);
                            const orderedIds = getSectionTileOrder(section, canonicalIds);
                            const visibleIds = orderedIds.slice(0, visibleCount);
                            const byId = new Map(allSectionMetrics.map((m) => [m.id, m]));

                            // Drag handler scoped to this section: dnd-kit
                            // emits the dragged id and the id it was
                            // dropped over. We translate that into a
                            // reordered array of *all* tile ids (visible
                            // + hidden) so that ordering preferences
                            // survive a count change. Dropping outside the
                            // sortable context is a no-op (`over === null`).
                            const handleDragEnd = (event: DragEndEvent) => {
                                const { active, over } = event;
                                if (!over || active.id === over.id) return;
                                const fromIdx = orderedIds.indexOf(String(active.id));
                                const toIdx = orderedIds.indexOf(String(over.id));
                                if (fromIdx < 0 || toIdx < 0) return;
                                const next = arrayMove(orderedIds, fromIdx, toIdx);
                                setSectionTileOrder(section, next);
                            };

                            return (
                                <DashboardSection
                                    key={section}
                                    title={meta.title}
                                    linkText={meta.linkText}
                                    href={meta.href}
                                    className="flex-1 min-h-0"
                                    tileCount={{
                                        value: visibleCount,
                                        min: sectionTileBounds.minCount,
                                        max: sectionMaxAvailable,
                                        onChange: (next) => setSectionTileCount(section, next),
                                        label: `${meta.title} tiles`,
                                    }}
                                >
                                    <DndContext
                                        sensors={dndSensors}
                                        collisionDetection={closestCenter}
                                        onDragEnd={handleDragEnd}
                                    >
                                        <SortableContext
                                            items={visibleIds}
                                            strategy={horizontalListSortingStrategy}
                                        >
                                            {visibleIds.map((id, idx) => {
                                                const cfg = byId.get(id);
                                                if (!cfg) return null;
                                                return (
                                                    <SortableMetricCard
                                                        key={cfg.id}
                                                        id={cfg.id}
                                                        ariaLabel={cfg.label}
                                                    >
                                                        <MetricCard
                                                            cfg={cfg}
                                                            range={timeRange}
                                                            refreshToken={refreshToken}
                                                            onStatus={reportStatus}
                                                            // Anchor the tooltip to the right
                                                            // edge for the last metric so the
                                                            // popover stays inside the section
                                                            // card instead of overflowing.
                                                            infoAnchor={
                                                                idx === visibleIds.length - 1
                                                                    ? 'right'
                                                                    : 'auto'
                                                            }
                                                            override={overrides[cfg.id]}
                                                            searchbaseByName={searchbaseByName}
                                                            onConfigure={() =>
                                                                openPicker(cfg.id, cfg.label, {
                                                                    savedSearch: cfg.savedSearch,
                                                                    valueField: cfg.valueField,
                                                                })
                                                            }
                                                        />
                                                    </SortableMetricCard>
                                                );
                                            })}
                                        </SortableContext>
                                    </DndContext>
                                </DashboardSection>
                            );
                        })}
                    </div>

                    {/* Splitter handle — only renders at xl+ where the
                        side-by-side layout is active. 4px hit-area
                        (visually 2px) widens to 6px on hover/drag so
                        it's easy to grab. Drag horizontally to
                        rebalance tiles ↔ map; arrow keys nudge ±1%
                        (Shift = ±5%); Home/End jump to the limits;
                        double-click restores the default split.
                        Persisted across reloads in localStorage. */}
                    <button
                        type="button"
                        role="separator"
                        aria-orientation="vertical"
                        aria-label="Resize tiles vs map"
                        aria-valuenow={Math.round(leftPct)}
                        aria-valuemin={SPLIT_MIN}
                        aria-valuemax={SPLIT_MAX}
                        title="Drag to resize · arrows ±1% · double-click to reset"
                        onMouseDown={beginDrag}
                        onKeyDown={onSplitterKeyDown}
                        onDoubleClick={resetSplit}
                        className={cn(
                            'hidden xl:flex flex-shrink-0 items-center justify-center group relative',
                            'w-1.5 mx-0.5 rounded-full transition-colors cursor-col-resize',
                            'focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400',
                            dragging
                                ? 'bg-sky-500'
                                : 'bg-slate-200 dark:bg-slate-700 hover:bg-sky-400 dark:hover:bg-sky-500'
                        )}
                    >
                        {/* Visible grip dots — three subtle dashes,
                            centred vertically. Helps signal the handle
                            is interactive at a glance. */}
                        <span
                            aria-hidden="true"
                            className={cn(
                                'flex flex-col gap-0.5 opacity-50 transition-opacity',
                                dragging ? 'opacity-100' : 'group-hover:opacity-90'
                            )}
                        >
                            <span className="block w-0.5 h-1 rounded-full bg-white" />
                            <span className="block w-0.5 h-1 rounded-full bg-white" />
                            <span className="block w-0.5 h-1 rounded-full bg-white" />
                        </span>
                    </button>

                    {/* Right column — map.
                        Width is the complement of leftPct on xl+; full
                        width below xl. Both columns set min-w-0 so a
                        long word in a metric label or a wide map tile
                        can't blow the column wider than its share. */}
                    <div
                        className="flex flex-col min-h-0 min-w-0 w-full xl:flex-1"
                    >
                        <div className="flex-1 min-h-0 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-3 shadow-sm flex flex-col">
                            <div className="flex items-center justify-between mb-2 flex-shrink-0">
                                <div>
                                    <h3 className="text-base font-bold text-sky-900 dark:text-sky-200 uppercase tracking-wide leading-none">
                                        {topologyHeaderName}
                                    </h3>
                                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">
                                        {topologyHeaderSubtitle}
                                    </p>
                                </div>
                                <RegionalViewToggle
                                    value={regionalView}
                                    onChange={setRegionalView}
                                />
                            </div>

                            <div className="flex-1 min-h-0">
                                {regionalView === 'map' ? (
                                    <CustomerTopologyMap
                                        // Bumping `topologyResetKey` forces a
                                        // remount of the map after a "Factory
                                        // reset", so its internal hook re-reads
                                        // (now-empty) storage and falls back
                                        // to the canonical CUSTOMER_TOPOLOGY.
                                        key={topologyResetKey}
                                        topology={CUSTOMER_TOPOLOGY}
                                        isDark={resolvedTheme === 'dark'}
                                        earliestTime={timeRange.earliest}
                                        latestTime={timeRange.latest}
                                        refreshToken={refreshToken}
                                        onSummaryMetricsChange={
                                            handleTopologySummaryChange
                                        }
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
                                    <TopologySiteTable topology={CUSTOMER_TOPOLOGY} />
                                )}
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-3 flex-shrink-0">
                                <KpiCard
                                    label={topIncidentCard.label}
                                    value={topIncidentCard.value}
                                    source={topIncidentCard.source}
                                    accentClassName="bg-red-500"
                                    description={KPI_CONFIG[0].description}
                                    bindingFootnote={topIncidentBindingFootnote}
                                    onOpenInSearch={
                                        topIncidentDrilldownSpl
                                            ? handleTopIncidentOpenInSearch
                                            : undefined
                                    }
                                    onConfigure={() =>
                                        openPicker(KPI_CONFIG[0].id, KPI_CONFIG[0].label, {
                                            savedSearch: KPI_CONFIG[0].savedSearch,
                                            valueField: KPI_CONFIG[0].valueField,
                                        })
                                    }
                                    isCustomized={Boolean(overrides[KPI_CONFIG[0].id])}
                                />
                                <KpiCard
                                    label={operationalLeadCard.label}
                                    value={operationalLeadCard.value}
                                    source={operationalLeadCard.source}
                                    accentClassName="bg-emerald-500"
                                    description={KPI_CONFIG[1].description}
                                    bindingFootnote={operationalLeadBindingFootnote}
                                    onOpenInSearch={
                                        operationalLeadDrilldownSpl
                                            ? handleOperationalLeadOpenInSearch
                                            : undefined
                                    }
                                    onConfigure={() =>
                                        openPicker(KPI_CONFIG[1].id, KPI_CONFIG[1].label, {
                                            savedSearch: KPI_CONFIG[1].savedSearch,
                                            valueField: KPI_CONFIG[1].valueField,
                                        })
                                    }
                                    isCustomized={Boolean(overrides[KPI_CONFIG[1].id])}
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

            <KpiPickerPanel
                open={pickerContext !== null}
                context={pickerContext}
                onClose={closePicker}
                onApply={handlePickerApply}
                onClearOverride={(tileId) => {
                    clearOverride(tileId);
                    closePicker();
                }}
                onTestInSearch={(spl) => {
                    // Open Splunk Search & Reporting with the *literal*
                    // SPL pulled from `searchbase.conf` — the executive
                    // sees-and-tests exactly what the picker is showing
                    // them, no `| savedsearch` indirection. Open in a
                    // new tab so the picker stays open for further
                    // browsing. URLSearchParams handles encoding of
                    // backticks, quotes, pipes, and embedded newlines.
                    if (!spl) return;
                    const url = splunkSearchAppUrl(spl, timeRange);
                    if (typeof window !== 'undefined') {
                        window.open(url, '_blank', 'noopener,noreferrer');
                    }
                }}
                onResetAllCustomizations={handleResetAllCustomizations}
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
    accentClassName: string;
    /** When provided, renders a gear icon that opens the KPI picker. */
    onConfigure?: () => void;
    /** Marks the gear with a small dot when the tile is overridden. */
    isCustomized?: boolean;
    /** Body text for the (?) info tooltip. Hides the icon when omitted. */
    description?: string;
    /**
     * Italic footnote shown at the bottom of the tooltip — typically the
     * search binding (saved-search stanza or "(inline SPL)") so the
     * operator can trace the data lineage at a glance.
     */
    bindingFootnote?: string;
    /**
     * Click handler for the ExternalLink icon — opens the literal SPL
     * the tile dispatched in the standard Splunk Search & Reporting UI.
     * Hidden when omitted, matching `MetricItem`'s behavior.
     */
    onOpenInSearch?: () => void;
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
            aria-label="Topology view"
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

const KpiCard: React.FC<KpiCardProps> = ({
    label,
    value,
    source,
    accentClassName,
    onConfigure,
    isCustomized = false,
    description,
    bindingFootnote,
    onOpenInSearch,
}) => (
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
                    : 'No live source assigned'
            }
        />
        <div className="flex items-center gap-2 mb-0.5">
            <div className={cn('w-1.5 h-1.5 rounded-full', accentClassName)} />
            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider truncate flex-1">
                {label}
            </span>
            {description && (
                <InfoTooltip
                    title={label}
                    description={description}
                    footnote={bindingFootnote}
                    anchor="right"
                    iconAriaLabel={`What is ${label}?`}
                    className="flex-shrink-0"
                />
            )}
            {onOpenInSearch && (
                <button
                    type="button"
                    onClick={onOpenInSearch}
                    title="Open in Splunk Search"
                    aria-label={`Open ${label} in Splunk Search`}
                    className="p-0.5 -my-0.5 text-slate-300 dark:text-slate-500 hover:text-sky-600 dark:hover:text-sky-300 transition-colors rounded focus:outline-none focus:ring-1 focus:ring-sky-400 flex-shrink-0"
                >
                    <ExternalLink className="w-3 h-3 stroke-[2.5px]" />
                </button>
            )}
            {onConfigure && (
                <button
                    type="button"
                    onClick={onConfigure}
                    title={isCustomized ? `Configure ${label} (customised)` : `Configure ${label}`}
                    aria-label={`Configure ${label} tile`}
                    className="p-0.5 -my-0.5 mr-2 text-slate-300 dark:text-slate-500 hover:text-sky-600 dark:hover:text-sky-300 transition-colors rounded focus:outline-none focus:ring-1 focus:ring-sky-400 relative flex-shrink-0"
                >
                    <Settings2 className="w-3 h-3 stroke-[2.5px]" />
                    {isCustomized && (
                        <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-sky-500 border border-white dark:border-slate-900" />
                    )}
                </button>
            )}
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
