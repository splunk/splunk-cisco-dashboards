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
 *   * Keyboard shortcuts (g i, g s, g b, g r, t, r, ?, /)
 *   * Click-to-pin map popups (ESC or X to close)
 *
 * Each "feature" surfaced through this page is independent — see the
 * inline section comments to remove or pare down individual capabilities
 * without rippling the rest of the page.
 */

import React, {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    User,
    RefreshCw,
    Pause,
    Download,
    Keyboard,
    RotateCcw,
    Settings2,
    ExternalLink,
    PanelRight,
    PanelBottom,
    PanelTop,
    Edit3,
    Upload,
    X,
    CheckCircle2,
    AlertCircle,
    Table2,
    ClipboardCheck,
    ArrowRight,
    ArrowUp,
    ArrowDown,
    ArrowUpDown,
    Sparkles,
    Plus,
    Eye,
    EyeOff,
} from 'lucide-react';
import { DashboardSection } from '@/common/components/florida/DashboardSection';
import { MetricItem } from '@/common/components/florida/MetricItem';
import { TableTile } from '@/common/components/florida/TableTile';
import { BarBreakdownTile } from '@/common/components/florida/BarBreakdownTile';
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
import {
    DEFAULT_CUSTOMER_TOPOLOGY_SECTION_TITLES,
    type CustomerTopologySectionTitles,
} from '@/common/services/customerTopologyPersistenceService';
import { HealthBadge } from '@/common/components/florida/HealthBadge';
import { IncidentTicker } from '@/common/components/florida/IncidentTicker';
import {
    SignalTickerEditor,
    SignalTickerRail,
    type SignalTickerMetricDefaults,
} from '@/common/components/florida/SignalTickerRail';
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
    isBarBreakdownViz,
    deriveThresholdLines,
    type MetricConfig,
    type KpiConfig,
    type SectionId,
    type TimeRange,
    type MetricStatus,
    type MetricThresholds,
} from '@/common/hooks/useMetric';
import { useExportPage } from '@/common/hooks/useExportPage';
import { useKeyboardShortcuts } from '@/common/hooks/useKeyboardShortcuts';
import { useTheme } from '@/common/hooks/useTheme';
import {
    usePersistedMetricOverrides,
    type MetricOverride,
} from '@/common/hooks/usePersistedMetricOverrides';
import {
    usePersistedSearchbaseDrilldowns,
    type SearchbaseDrilldownMap,
} from '@/common/hooks/usePersistedSearchbaseDrilldowns';
import { usePersistedSectionTileCounts } from '@/common/hooks/usePersistedSectionTileCounts';
import { usePersistedSectionLayout } from '@/common/hooks/usePersistedSectionLayout';
import { usePersistedSectionTileOrder } from '@/common/hooks/usePersistedSectionTileOrder';
import { usePersistedSectionHeights } from '@/common/hooks/usePersistedSectionHeights';
import { usePersistedSignalTicker } from '@/common/hooks/usePersistedSignalTicker';
import {
    useBrandingOverride,
    readImageAsDataUri,
    BRANDING_LOGO_DATA_URI_MAX_BYTES,
    BRANDING_ACCEPTED_LOGO_MIME_TYPES,
    type BrandingOverride,
} from '@/common/hooks/useBrandingOverride';
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
    rectSortingStrategy,
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

// Default subtitle shown beneath the customer name when no per-user
// override is set in localStorage. Operators can change the visible
// text per-user via the header pencil → Edit branding panel
// (`scd_overview_branding`); this constant only defines the
// out-of-the-box value for fresh deployments.
const DEFAULT_HEADER_SUBTITLE = 'Splunk Executive Insights';
const DEFAULT_HEADER_TITLE_FALLBACK = 'Your Organization Name';
const DEFAULT_LOGO_DATA_URI =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" ' +
            'stroke="white" stroke-width="1.8" stroke-linecap="round" ' +
            'stroke-linejoin="round"><circle cx="12" cy="12" r="2.25"/>' +
            '<circle cx="5.5" cy="7" r="1.65"/><circle cx="18.5" cy="7" r="1.65"/>' +
            '<circle cx="5.5" cy="17" r="1.65"/><circle cx="18.5" cy="17" r="1.65"/>' +
            '<path d="M7 8.2 10.2 10.7M16.9 8.2 13.8 10.7M7 15.8 10.2 13.3M16.9 15.8 13.8 13.3"/>' +
            '<path d="M4 12h3M17 12h3"/></svg>'
    );

const CUSTOMER_NAME_SPL =
    '| makeresults | eval customer_name = `customer_name` | fields customer_name';

const splunkLocalePrefix = (): string => {
    if (typeof window === 'undefined') return '/en-US';
    const match = window.location.pathname.match(/^\/([a-z]{2}-[A-Z]{2})(?:\/|$)/);
    return `/${match ? match[1] : 'en-US'}`;
};

const MIN_DASHBOARD_HEIGHT_PX = 520;
const COMPACT_HEIGHT_THRESHOLD_PX = 720;
const SECTION_HEIGHT_BASE_PX = 180;
const SECTION_HEIGHT_COMPACT_BASE_PX = 174;
const SECTION_HEIGHT_STEP_PX = 120;
const SECTION_WRAPPED_TILE_ROW_STEP_PX = 152;
const SECTION_WRAP_TILE_COUNT = 5;
const SECTION_WRAPPED_TILE_COLUMNS = 3;
const VERTICAL_MAP_MIN_HEIGHT_PX = 420;
const VERTICAL_MAP_COMPACT_MIN_HEIGHT_PX = 360;
const VERTICAL_METRICS_MIN_HEIGHT_PX = 220;
const VERTICAL_METRICS_COMPACT_MIN_HEIGHT_PX = 180;
const VERTICAL_SPLIT_CHROME_ALLOWANCE_PX = 32;

const useAvailableDashboardHeight = (): number | null => {
    const [height, setHeight] = useState<number | null>(null);

    useLayoutEffect(() => {
        if (typeof window === 'undefined') return undefined;

        let animationFrame = 0;
        let cancelled = false;

        const measure = () => {
            window.cancelAnimationFrame(animationFrame);
            animationFrame = window.requestAnimationFrame(() => {
                if (cancelled) return;
                const mount = document.getElementById('scan-root');
                const top = mount?.getBoundingClientRect().top ?? 0;
                const next = Math.max(
                    MIN_DASHBOARD_HEIGHT_PX,
                    Math.floor(window.innerHeight - Math.max(top, 0))
                );
                setHeight((current) =>
                    current !== null && Math.abs(current - next) < 2
                        ? current
                        : next
                );
            });
        };

        // The shell height we write back lives *inside* document.body
        // and #scan-root's parent, so observing those elements with a
        // ResizeObserver turns every height write into a fresh resize
        // notification — a self-referential measure→resize→measure
        // cycle that visibly flickers whenever a scrollbar toggles or
        // chrome above the mount reflows (the guard below only damps
        // it, it doesn't stop it). The shell height is a pure function
        // of the viewport height and the mount's top offset, both of
        // which change on window resize / rotation, not on our own
        // writes — so a resize listener is sufficient and loop-free.
        // The delayed re-measures catch Splunk's app chrome (nav bar)
        // settling asynchronously after first paint, which is the one
        // legitimate post-mount `top` shift the ResizeObserver used to
        // absorb.
        measure();
        const settleTimers = [
            window.setTimeout(measure, 250),
            window.setTimeout(measure, 1000),
        ];
        window.addEventListener('resize', measure);
        window.addEventListener('orientationchange', measure);

        return () => {
            cancelled = true;
            window.cancelAnimationFrame(animationFrame);
            settleTimers.forEach((t) => window.clearTimeout(t));
            window.removeEventListener('resize', measure);
            window.removeEventListener('orientationchange', measure);
        };
    }, []);

    return height;
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
    //
    // Per the Overview review with the customer (Alan, 2026-05-11), the IT
    // Health row was reworked: `critical_website_availability` sits
    // at position 1, then Network health, then Device health (the
    // three Alan defaulted onto). The two legacy composite-score
    // tiles (UX Score, Compliance) were replaced in the same review
    // with named, countable signals: Active TE alerts (Critical+High)
    // and Sites < 90%. The composite searchbase entries themselves
    // stay in the catalogue so anyone who wants them back can re-bind
    // via the KPI picker. As of 2026-06-04 every section ships with
    // nine factory candidates but still defaults to three visible
    // tiles, so the executive view stays tight while operators can
    // dial up breadth with the count pill. Drag-to-reorder stays in place.
    {
        id: 'critical_website_availability',
        section: 'it_health',
        label: 'Critical sites available',
        subLabel: 'ThousandEyes HTTP availability',
        description:
            "Count of business-critical websites whose ThousandEyes HTTP Server " +
            'Availability AVG is at least 99.5% over the dispatched window, vs. the ' +
            'total monitored. Headline reads "X of Y available". Sparkline shows the ' +
            'live availability percentage; dashed line is the rolling-average baseline ' +
            'so anomalies stand out without remembering "what is normal".',
        // Timechart row: { _time, current_pct, baseline_pct, sites_up,
        // sites_total, display, headline_pct }. `display` and
        // `headline_pct` are broadcast onto every row via eventstats
        // latest, so reading the latest row gives a stable string +
        // numeric pair.
        savedSearch: 'Executive - Critical Website Availability',
        valueField: 'headline_pct',
        displayField: 'display',
        sparkDataField: 'current_pct',
        baselineField: 'baseline_pct',
        overlayLabel: 'Avg',
        unit: '%',
        color: '#16A34A',
        thresholds: { warning: 99.5, critical: 90, direction: 'higher_is_better' },
        thresholdNote:
            'Threshold applies to the per-window availability percentage that drives ' +
            'the headline colour. The "X of Y" headline counts each site whose ' +
            'individual ThousandEyes HTTP Server Availability AVG is ≥ 99.5%. ' +
            '99.5% is the standard four-nines-plus SLO operators expect from ' +
            'public-facing critical sites.',
        // Mock falls back to a "16 of 18" feel so the tile is
        // recognisable even before the search resolves.
        mock: { seed: 10, sparkMin: 88, sparkMax: 100, value: 89, change: -1 },
    },
    {
        id: 'network_health',
        section: 'it_health',
        label: 'Network health',
        subLabel: 'Catalyst Center network score',
        description:
            "Latest network-wide health score from Catalyst Center for the 'All' " +
            'category. Combines link state, throughput and protocol metrics into a ' +
            '0-100 grade.',
        // Single row: { score: 0..100 }
        savedSearch: 'IT - Critical Systems - Network Health Score (Current)',
        valueField: 'score',
        unit: '%',
        thresholds: { warning: 95, critical: 80, direction: 'higher_is_better' },
        thresholdNote:
            'Bands match the Catalyst Center default policy: ≥ 95 is "good", ' +
            '80–94 is "fair" (Cisco labels this orange in CC), < 80 is "poor". ' +
            'Tune via override if your network has a different baseline normal.',
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
            'reachable-only score 50, otherwise 0.',
        // Single row: { score: 0..100 }
        savedSearch: 'Executive - Current Device Health',
        valueField: 'score',
        unit: '%',
        thresholds: { warning: 98, critical: 90, direction: 'higher_is_better' },
        thresholdNote:
            'Tighter than network-health on purpose: any non-managed device drags ' +
            'the average by 50, so 98% means at most ~4% of the fleet is ' +
            'reachable-only. < 90% typically signals more than one site has lost ' +
            'a device-management integration.',
        mock: { seed: 12, sparkMin: 95, sparkMax: 100, value: 100, change: 0 },
    },
    {
        id: 'open_issues',
        section: 'it_health',
        label: 'Open issues',
        subLabel: 'Active Catalyst Center issues',
        description:
            'Count of open issues raised by Catalyst Center across every priority. ' +
            'Source: cisco:dnac:issue. ',
        // Single row: { total, critical, high, affected_devices, affected_sites }
        savedSearch: 'Executive - Issue Summary KPIs',
        valueField: 'total',
        thresholds: { warning: 500, critical: 1000, direction: 'lower_is_better' },
        thresholdNote:
            'Counts issues across every priority, including informational. The ' +
            'companion "active TE alerts" tile narrows to high+critical only when ' +
            'you want a more selective signal.',
        mock: { seed: 13, sparkMin: 100, sparkMax: 800, value: 650, change: -50 },
    },
    // Composite-metric replacements per Alan's 2026-05-11 review:
    // "UX score" (Catalyst client + device blend) and "Compliance"
    // (% of compliance checks passing) were both 0-100 composites that
    // executives could not act on directly ("80% means what?"). They
    // are replaced here with two named, countable signals. The original
    // stanzas (`Executive Dashboard - User Experience Score`,
    // `IT - Critical Systems - Compliance Rate`) stay in the catalogue
    // so anyone who wants the composite back can dial it up via the
    // KPI picker; we just stop defaulting them onto the executive view.
    {
        id: 'active_te_alerts',
        section: 'it_health',
        label: 'Active TE alerts',
        subLabel: 'Severity breakdown (count by severity)',
        description:
            'Count of currently-active ThousandEyes alerts in the dispatched ' +
            'window, broken down by severity. Headline is the total across all ' +
            'severities; the bars below show the per-severity counts so the ' +
            'executive sees at a glance which severity bucket is loud right ' +
            'now (critical vs. high vs. medium…). Replaces the legacy UX ' +
            'Score composite tile and, as of Build 85, the time-series ' +
            "headline-with-sparkline view (still available via the picker as " +
            '"IT Health - Active TE Alerts (High + Critical)").',
        // Bar-breakdown rows: { Severity, count }. Tile renders as
        // BarBreakdownTile because the bound searchbase stanza
        // declares default_viz = splunk.bar.
        savedSearch: 'IT Health - Active TE Alerts by Severity',
        // valueField/sparkDataField/baselineField are unused by the
        // bar-breakdown leaf (it reads `rows` + `columns` from
        // useTableData), but kept here as a safety net so a picker
        // override that swaps to a *time-series* binding still has
        // sensible field hints to fall back on.
        valueField: 'count',
        // Resting/healthy color is neutral sky; the bar tile's
        // severity-aware color map (red for critical, orange for
        // high, …) overrides this on a per-bar basis, but the value
        // is preserved so a picker swap to a non-bar viz reverts
        // cleanly.
        color: '#0ea5e9',
        thresholds: { warning: 5, critical: 20, direction: 'lower_is_better' },
        thresholdNote:
            'Threshold applies to the total count across all severities. The ' +
            'severity-aware bar colours (red = critical, orange = high, …) ' +
            'flag the dominant severity at a glance; pivot to ' +
            '[it_health_thousandeyes_alerts_table] for the recent-20 ' +
            'drill-down filtered to whichever bar is loud.',
        mock: { seed: 14, sparkMin: 0, sparkMax: 8, value: 12, change: 0 },
    },
    {
        id: 'sites_below_threshold',
        section: 'it_health',
        label: 'Sites < 90%',
        subLabel: 'Sites below health threshold',
        description:
            'How many monitored sites (Tallahassee, Auburndale) have a current ' +
            'device-health rollup below 90%. Discrete count, not a composite — ' +
            '0 = all sites healthy, 1+ = open the Overview map to identify which ' +
            'site is degraded. Uses the same HA-pair-aware filter as the Overview ' +
            'site markers so a standby device reporting 0 does not unfairly flag ' +
            'its site.',
        // Single row: { sites_below, sites_total }
        savedSearch: 'IT Health - Sites Below Health Threshold',
        valueField: 'sites_below',
        color: '#0ea5e9',
        thresholds: { warning: 1, critical: 2, direction: 'lower_is_better' },
        thresholdNote:
            'The 90% per-site cutoff matches the Catalyst Center "fair vs poor" ' +
            'boundary; widen / narrow it in the underlying SPL stanza if your ' +
            'network has a different normal.',
        mock: { seed: 15, sparkMin: 0, sparkMax: 1, value: 0, change: 0 },
    },
    {
        id: 'it_domain_score',
        section: 'it_health',
        label: 'IT domain score',
        subLabel: 'Network + device + compliance',
        description:
            'Composite IT score blending Catalyst Center network health, device ' +
            'readiness, and compliance pass rate into a single executive signal.',
        savedSearch: 'Executive - IT Domain Score',
        valueField: 'score',
        unit: '%',
        color: '#2563eb',
        thresholds: { warning: 90, critical: 70, direction: 'higher_is_better' },
        thresholdNote:
            'Same three-pillar posture used by the executive rollup. Drops should ' +
            'be decomposed into network, device, and compliance contributors before ' +
            'declaring a broad IT incident.',
        mock: { seed: 16, sparkMin: 70, sparkMax: 100, value: 92, change: 0 },
    },
    {
        id: 'thousandeyes_health',
        section: 'it_health',
        label: 'ThousandEyes health',
        subLabel: 'Synthetic monitoring composite',
        description:
            'Synthetic monitoring health across packet loss, latency, HTTP ' +
            'availability, and page-load completion from ThousandEyes data model ' +
            'summaries.',
        savedSearch: 'Executive - ThousandEyes Health Score',
        valueField: 'score',
        unit: '%',
        color: '#0ea5e9',
        thresholds: { warning: 90, critical: 70, direction: 'higher_is_better' },
        thresholdNote:
            'A directional experience score: use the ThousandEyes drilldown to ' +
            'separate transport, HTTP, and page-load contributors when the score moves.',
        mock: { seed: 17, sparkMin: 70, sparkMax: 100, value: 94, change: 0 },
    },
    {
        id: 'compliance_rate',
        section: 'it_health',
        label: 'Compliance rate',
        subLabel: 'Catalyst checks passing',
        description:
            'Percentage of Catalyst Center compliance checks passing, excluding ' +
            'not-applicable checks from the denominator.',
        savedSearch: 'IT - Critical Systems - Compliance Rate',
        valueField: 'pct',
        unit: '%',
        color: '#14b8a6',
        thresholds: { warning: 95, critical: 70, direction: 'higher_is_better' },
        thresholdNote:
            'This is check-level compliance, not percent of devices fully compliant. ' +
            'A sharp fall usually indicates new failing checks or assessment scope drift.',
        mock: { seed: 18, sparkMin: 70, sparkMax: 100, value: 96, change: 0 },
    },
    // ----- Security -----
    {
        id: 'fw_blocked',
        section: 'security',
        label: 'FW blocked',
        subLabel: 'Unique blocked connections',
        description:
            'Distinct (source, destination, dest-port) tuples blocked by the ' +
            'firewall over the dispatched window. The headline is the window-total ' +
            "count — same meaning as the original 'Firewall Blocked Count' tile. " +
            'The sparkline shows per-hour distinct blocks; the dashed line is the ' +
            'rolling-average baseline so an anomalous spike stands out at a glance.',
        // Hour-bucket timechart: { _time, blocked, baseline, total_blocked }.
        // total_blocked is broadcast (window-total, headline value);
        // blocked is per-hour (sparkline); baseline is window-avg
        // (dashed overlay).
        savedSearch:
            'Executive - Firewall Blocked Connections (with Baseline)',
        valueField: 'total_blocked',
        sparkDataField: 'blocked',
        baselineField: 'baseline',
        overlayLabel: 'Avg',
        color: '#f59e0b',
        thresholds: { warning: 5000, critical: 25000, direction: 'lower_is_better' },
        thresholdNote:
            'Tuned for a typical mid-size enterprise edge: < 5k blocks per window ' +
            'is steady-state internet noise, > 25k usually means a scanning campaign ' +
            'or a misconfigured peer hammering the policy. Compare against the ' +
            'baseline overlay before sounding the alarm — sustained elevation ' +
            'matters more than a single hot bucket.',
        mock: { seed: 21, sparkMin: 10, sparkMax: 50, value: 142, change: 12 },
    },
    {
        id: 'threat_sources',
        section: 'security',
        label: 'Threat sources',
        subLabel: 'Unique IPs blocked (with baseline)',
        description:
            'Distinct external source IPs blocked by the firewall over the ' +
            'dispatched window. The headline is the window-wide distinct count — ' +
            "same meaning as the original 'Threat Sources' single-value tile. " +
            'The sparkline shows per-bucket distinct sources; the dashed line ' +
            'is the rolling-average baseline so a sustained spike (i.e. ' +
            'distributed scanning) stands out against normal background noise.',
        // Bucketed timechart variant: { _time, sources, baseline, total_sources }.
        // total_sources is broadcast (window-wide dc(src), the headline);
        // sources is per-bucket (sparkline); baseline is window-avg
        // (dashed overlay). Replaces the single-row Network_Traffic
        // tstats binding, which was triggering useMetric's
        // `isSingleRow` mock-spark fallback — the chart was synthesised
        // RNG between sparkMin (5) and sparkMax (20), not real data.
        // See SESSION_LOG Build 1209 for the full diagnosis.
        savedSearch: 'Executive - Threat Sources (with Baseline)',
        valueField: 'total_sources',
        sparkDataField: 'sources',
        baselineField: 'baseline',
        overlayLabel: 'Avg',
        // Resting/healthy color is neutral sky so the line doesn't pre-
        // tint as "alarming" when the count is fine. The status palette
        // in MetricItem flips the sparkline to amber/red when the tile
        // crosses warning/critical thresholds, so red is reserved for
        // "actually bad" state across every tile in the dashboard.
        color: '#0ea5e9',
        thresholds: { warning: 25, critical: 100, direction: 'lower_is_better' },
        thresholdNote:
            'Distinct *source* IPs, not block events. A single IP retrying 10,000 ' +
            'times still counts as one. > 100 distinct sources in a 24h window is ' +
            'the classic distributed-scan signature and warrants a look at the ' +
            'firewall logs. Compare against the baseline overlay before sounding ' +
            'the alarm — sustained elevation matters more than a single hot bucket.',
        mock: { seed: 22, sparkMin: 5, sparkMax: 20, value: 18, change: -5 },
    },
    {
        id: 'failed_auth',
        section: 'security',
        label: 'Failed auth',
        subLabel: 'ISE + AD failures (with baseline)',
        description:
            'Total failed authentication events from ISE syslog (5400) and Windows ' +
            'Security log (EventCode=4625) over the dispatched window. Sparkline ' +
            'shows per-hour failures; dashed line is the rolling-average baseline. ' +
            'Sustained elevation above the baseline often indicates credential-' +
            'stuffing or a lockout storm.',
        // Hour-bucket timechart: { _time, failures, baseline, total_count }.
        savedSearch:
            'Executive - Failed Logon Count (with Baseline)',
        valueField: 'total_count',
        sparkDataField: 'failures',
        baselineField: 'baseline',
        overlayLabel: 'Avg',
        color: '#0ea5e9',
        thresholds: { warning: 25, critical: 100, direction: 'lower_is_better' },
        thresholdNote:
            'Window-total across both ISE and Windows AD. The bands assume a ' +
            'typical mid-size workforce; raise them by an order of magnitude for ' +
            'large fleets. Sustained drift above the dashed baseline matters more ' +
            'than the absolute count for stuffing detection.',
        mock: { seed: 23, sparkMin: 0, sparkMax: 5, value: 1, change: 0 },
    },
    {
        id: 'xdr_incidents',
        section: 'security',
        label: 'XDR incidents',
        subLabel: 'Distinct Cisco XDR incident IDs',
        description:
            'Count of distinct Cisco XDR / SecureX incident IDs in the dispatched ' +
            'window. Includes both real-time and summary incident sourcetypes.',
        // Single row: { total }
        savedSearch: 'Executive - XDR Incidents',
        valueField: 'total',
        // Same rationale as Threat Sources: resting state stays neutral
        // sky; MetricItem's status palette turns the sparkline amber/
        // red when the count crosses warning/critical thresholds.
        color: '#0ea5e9',
        thresholds: { warning: 5, critical: 20, direction: 'lower_is_better' },
        thresholdNote:
            'XDR groups related detections into a single incident ID, so even small ' +
            'numbers matter. > 5 simultaneous open incidents typically exceeds what a ' +
            'single SOC analyst can triage at once; > 20 is "all hands" territory.',
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
            'Windows AD events (4624 vs 4625). 0-100.',
        // Single row: { score: 0..100 }
        savedSearch: 'Executive - Security Domain Score',
        valueField: 'score',
        unit: '%',
        color: '#10b981',
        thresholds: { warning: 95, critical: 80, direction: 'higher_is_better' },
        thresholdNote:
            'A success-rate metric, not a posture score: 100% means every auth ' +
            'attempt succeeded in the window. < 95% usually flags a misconfigured ' +
            'service account, an MFA outage, or active credential-stuffing — the ' +
            '"failed auth" tile next to this one is the natural companion drilldown.',
        mock: { seed: 25, sparkMin: 80, sparkMax: 100, value: 98, change: 0 },
    },
    // Narrows XDR Incidents to severity=Critical
    // only — answers "how many incidents need a war-room right now?"
    // separately from the broader xdr_incidents trend.
    {
        id: 'xdr_critical',
        section: 'security',
        label: 'XDR critical',
        subLabel: 'Severity=Critical incidents only',
        description:
            'Distinct Cisco XDR incident IDs at Critical severity in the ' +
            'dispatched window. Companion to the broader "XDR incidents" tile ' +
            'next door; this one isolates the escalation-pressure tier.',
        // Single row: { total }
        savedSearch: 'Overview - XDR Critical Incidents',
        valueField: 'total',
        color: '#dc2626',
        thresholds: { warning: 1, critical: 5, direction: 'lower_is_better' },
        thresholdNote:
            'Critical XDR incidents are pre-triaged by SecureX as the tier most ' +
            'likely to require executive escalation. > 1 already warrants war-room ' +
            'consideration; > 5 simultaneously open exceeds the routing capacity ' +
            'of a single SOC shift on most SecOps teams.',
        mock: { seed: 26, sparkMin: 0, sparkMax: 2, value: 0, change: 0 },
    },
    {
        id: 'dns_blocked_queries',
        section: 'security',
        label: 'DNS blocks',
        subLabel: 'Unique policy-blocked queries',
        description:
            'Unique blocked DNS resolutions from Cisco Cloud Security / Umbrella, ' +
            'deduplicated by source and queried domain.',
        savedSearch: 'Security Resilience - DNS Blocked Queries',
        valueField: 'blocked',
        color: '#0ea5e9',
        thresholds: { warning: 5000, critical: 50000, direction: 'lower_is_better' },
        thresholdNote:
            'Unique client-domain blocks, not raw DNS log lines. Sustained spikes ' +
            'usually point to a campaign, new policy, or a noisy internal source.',
        mock: { seed: 27, sparkMin: 0, sparkMax: 400, value: 120, change: 0 },
    },
    {
        id: 'ids_ips_alerts',
        section: 'security',
        label: 'IDS/IPS alerts',
        subLabel: 'Secure Firewall intrusion events',
        description:
            'Accelerated count of Secure Firewall intrusion events from the Cisco ' +
            'Security data model.',
        savedSearch: 'Security Resilience - IDS/IPS Alert Count',
        valueField: 'count',
        color: '#0ea5e9',
        thresholds: { warning: 10000, critical: 100000, direction: 'lower_is_better' },
        thresholdNote:
            'IPS volume is environment-sensitive. Treat sudden increases or sudden ' +
            'zeros as the actionable signal, then pivot to classifications.',
        mock: { seed: 28, sparkMin: 0, sparkMax: 1000, value: 240, change: 0 },
    },
    {
        id: 'email_threat_count',
        section: 'security',
        label: 'Email threats',
        subLabel: 'AMP + spam + content scanner',
        description:
            'High-risk Cisco Email Security verdict count across AMP, antispam, ' +
            'and content scanner telemetry.',
        savedSearch: 'Security Resilience - Email Threat Count',
        valueField: 'count',
        color: '#0ea5e9',
        thresholds: { warning: 1000, critical: 5000, direction: 'lower_is_better' },
        thresholdNote:
            'This is a blended intensity signal. Use the email breakdown drilldown ' +
            'to determine whether AMP, spam, or content scanning drove the change.',
        mock: { seed: 29, sparkMin: 0, sparkMax: 600, value: 80, change: 0 },
    },
    // ----- Building Intelligence -----
    //
    // The four "presence" tiles below (active devices, Wi-Fi clients,
    // occupancy, Webex devices) deliberately have no numeric
    // thresholds — they're trend signals against an environment-
    // specific baseline, not pass/fail metrics. Each carries a
    // `thresholdNote` so the operator still gets a clear answer to
    // "what counts as good?". Building score is a composite with
    // numeric bands.
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
        savedSearch: 'Executive - Active Devices',
        valueField: 'active_devices',
        color: '#10b981',
        thresholdNote:
            'Trend metric — no fixed cutoff. The "right" number depends on the ' +
            'campus, day-of-week, and event calendar. Watch for sudden drops vs. ' +
            'the same hour the prior week (likely a feed outage) or sustained ' +
            'climbs above seasonal norm (planning signal for capacity).',
        mock: { seed: 31, sparkMin: 30, sparkMax: 60, value: 54, change: 2600 },
    },
    {
        id: 'wifi_clients',
        section: 'building',
        label: 'Wi-Fi clients',
        subLabel: 'Wireless clients on APs (with baseline)',
        description:
            'Distinct Wi-Fi MAC addresses that associated to access points across ' +
            'the dispatched window, taken from Cisco Spaces DEVICE_ASSOCIATION ' +
            'ASSOCIATE events. Headline is the window-wide distinct-MAC count ' +
            "broadcast onto every row (so the executive number is stable and " +
            "does not drift with the latest bucket's noise); sparkline is the " +
            'per-bucket distinct count with a rolling-average baseline overlay.',
        // Bucketed timechart: { _time, clients, baseline, total_clients, score }.
        // score is broadcast (= total_clients, window-wide dc(mac), the
        // headline); clients is per-bucket (sparkline); baseline is
        // window-avg (dashed overlay). See searchbase stanza
        // executive_dashboard_wifi_clients for the SPL.
        savedSearch: 'Executive - Wifi Clients',
        valueField: 'score',
        sparkDataField: 'clients',
        baselineField: 'baseline',
        overlayLabel: 'Avg',
        thresholdNote:
            'Trend metric — no fixed cutoff. Use this against the AP-capacity ' +
            'baseline for the campus: a sudden drop usually means an AP cluster ' +
            'has gone offline; a sustained climb signals it is time to revisit ' +
            'AP density planning.',
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
        savedSearch: 'Executive - Building Occupancy',
        valueField: 'score',
        unit: '%',
        thresholdNote:
            'Operational signal, not a pass/fail. Building managers typically ' +
            'target 60-75% peak utilisation for healthy work patterns; sustained ' +
            '> 85% suggests booking pressure, < 20% during business hours suggests ' +
            'the space is underused.',
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
            'compliance pass-rate, averaged. 0-100.',
        // Single row: { score: 0..100 }
        savedSearch: 'Executive - Building Score',
        valueField: 'score',
        unit: '%',
        color: '#10b981',
        thresholds: { warning: 90, critical: 70, direction: 'higher_is_better' },
        thresholdNote:
            'Composite of four sub-scores averaged equally. A 70% headline can ' +
            'still hide one fully-failed sub-score (e.g. compliance at 0 with ' +
            'others at 90+). When this drops, expand each contributor on the ' +
            'Building dashboard before reacting at a building-wide level.',
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
        savedSearch: 'Executive - Collab Devices',
        valueField: 'score',
        color: '#0ea5e9',
        thresholdNote:
            'Trend metric — no fixed cutoff. The number you expect is "the count ' +
            'of Webex endpoints you own". A drop of more than ~10% from yesterday ' +
            'is the actionable signal — it usually means a telemetry feed has ' +
            'stalled, not that devices were physically removed.',
        mock: { seed: 35, sparkMin: 5, sparkMax: 50, value: 32, change: 0 },
    },
    // Catalyst Center AP reachability % — the
    // obvious complement to "Wi-Fi clients" and "Active devices": if APs
    // are unreachable, the rest of the building section is fiction.
    {
        id: 'ap_health',
        section: 'building',
        label: 'AP health',
        subLabel: 'Reachable APs (Catalyst Center)',
        description:
            'Percentage of access points reporting Reachable in Catalyst Center ' +
            'device-health snapshots. The control-plane availability metric for ' +
            'the wireless infrastructure that backs Wi-Fi clients and presence.',
        // Single row: { pct, total, up, down }
        savedSearch: 'Overview - AP Health',
        valueField: 'pct',
        unit: '%',
        color: '#10b981',
        thresholds: { warning: 97, critical: 92, direction: 'higher_is_better' },
        thresholdNote:
            'Wireless availability ladder. ≥99% is steady-state for a healthy AP ' +
            'fleet; 92-96% means active wireless impact (open a wireless bridge ' +
            'call); <92% is a major outage cluster. Calibrate to your fleet — ' +
            'some campuses normally run at 97-98% because of permanently-offline ' +
            'spare-pool APs.',
        mock: { seed: 36, sparkMin: 90, sparkMax: 100, value: 99, change: 0 },
    },
    {
        id: 'environmental_health',
        section: 'building',
        label: 'Environmental health',
        subLabel: 'Temperature + humidity index',
        description:
            'Percentage of environmental sensor readings inside normal temperature ' +
            'and humidity ranges across Meraki and Cisco Spaces telemetry.',
        savedSearch: 'Building Resilience - Environmental Health Index',
        valueField: 'score',
        unit: '%',
        color: '#10b981',
        thresholds: { warning: 75, critical: 60, direction: 'higher_is_better' },
        thresholdNote:
            'Facility comfort signal. Persistent drops usually mean HVAC, sensor ' +
            'placement, or localized environmental issues rather than a network problem.',
        mock: { seed: 37, sparkMin: 60, sparkMax: 100, value: 91, change: 0 },
    },
    {
        id: 'rooms_occupied',
        section: 'building',
        label: 'Rooms occupied',
        subLabel: 'ROOM spaces with presence',
        description:
            'Time series of the percent of room-type spaces with people present ' +
            'from Cisco Spaces occupancy events.',
        savedSearch: 'Building Resilience - Rooms Occupied Trend',
        valueField: 'Rooms Occupied',
        unit: '%',
        color: '#0ea5e9',
        thresholdNote:
            'Space-utilization signal, not pass/fail. Compare this against meeting ' +
            'room inventory and business-hour expectations before acting.',
        mock: { seed: 38, sparkMin: 15, sparkMax: 85, value: 62, change: 0 },
    },
    {
        id: 'water_leaks',
        section: 'building',
        label: 'Water leaks',
        subLabel: 'Active Meraki leak detections',
        description:
            'Count of active Meraki sensor readings reporting water present.',
        savedSearch: 'Building Resilience - Water Leak Detection',
        valueField: 'leaks',
        color: '#0ea5e9',
        thresholds: { warning: 1, critical: 2, direction: 'lower_is_better' },
        thresholdNote:
            'Water is a safety-critical signal. Any positive value should be ' +
            'validated quickly by facilities staff.',
        mock: { seed: 39, sparkMin: 0, sparkMax: 1, value: 0, change: 0 },
    },
    // ----- Optional Executive Signals -----
    //
    // Hidden by default. The section editor can reveal this fourth
    // section when a user wants a broader command-center rollup without
    // replacing the three shipped domain sections.
    {
        id: 'executive_ux_score',
        section: 'custom',
        label: 'UX score',
        subLabel: 'Client + infrastructure health',
        description:
            'User-experience domain score combining Catalyst Center client health ' +
            'and infrastructure readiness.',
        savedSearch: 'Executive - User Experience Domain Score',
        valueField: 'score',
        unit: '%',
        color: '#0ea5e9',
        thresholds: { warning: 90, critical: 70, direction: 'higher_is_better' },
        thresholdNote:
            'Blends client health and device readiness. Drops often need both RF ' +
            'and infrastructure review.',
        mock: { seed: 41, sparkMin: 70, sparkMax: 100, value: 93, change: 0 },
    },
    {
        id: 'executive_it_score',
        section: 'custom',
        label: 'IT score',
        subLabel: 'IT domain rollup',
        description: 'Executive IT domain score for command-center layouts.',
        savedSearch: 'Executive - IT Domain Score',
        valueField: 'score',
        unit: '%',
        color: '#2563eb',
        thresholds: { warning: 90, critical: 70, direction: 'higher_is_better' },
        thresholdNote:
            'Composite IT health. Use the default IT section for contributor-level context.',
        mock: { seed: 42, sparkMin: 70, sparkMax: 100, value: 92, change: 0 },
    },
    {
        id: 'executive_security_score',
        section: 'custom',
        label: 'Security score',
        subLabel: 'Identity trust rollup',
        description:
            'Executive security-domain score built from ISE and Active Directory ' +
            'authentication success rates.',
        savedSearch: 'Executive - Security Domain Score',
        valueField: 'score',
        unit: '%',
        color: '#10b981',
        thresholds: { warning: 95, critical: 80, direction: 'higher_is_better' },
        thresholdNote:
            'Authentication success-rate composite. Pair with failed-auth and ' +
            'threat-source counts when explaining movement.',
        mock: { seed: 43, sparkMin: 80, sparkMax: 100, value: 98, change: 0 },
    },
    {
        id: 'executive_building_score',
        section: 'custom',
        label: 'Building score',
        subLabel: 'Facility domain rollup',
        description:
            'Executive building-domain score across AP health, presence, occupancy, ' +
            'and compliance pillars.',
        savedSearch: 'Executive - Building Domain Score',
        valueField: 'score',
        unit: '%',
        color: '#10b981',
        thresholds: { warning: 85, critical: 55, direction: 'higher_is_better' },
        thresholdNote:
            'Building composite. Drops should be decomposed into AP, presence, ' +
            'occupancy, and compliance contributors.',
        mock: { seed: 44, sparkMin: 55, sparkMax: 100, value: 87, change: 0 },
    },
    {
        id: 'executive_active_clients',
        section: 'custom',
        label: 'Active clients',
        subLabel: 'Catalyst endpoint count',
        description:
            'Active Catalyst Center clients by connection type. Useful as an ' +
            'occupancy and capacity proxy.',
        savedSearch: 'Executive - Active Clients',
        valueField: 'count',
        color: '#0ea5e9',
        thresholdNote:
            'Environment-specific capacity signal. Watch for sharp drops versus ' +
            'the same business-hour baseline.',
        mock: { seed: 45, sparkMin: 100, sparkMax: 1000, value: 420, change: 0 },
    },
    {
        id: 'executive_active_alerts',
        section: 'custom',
        label: 'Active alerts',
        subLabel: 'Critical ThousandEyes alerts',
        description:
            'Count of currently-active critical or error severity ThousandEyes alerts.',
        savedSearch: 'Overview - Active Critical Alerts',
        valueField: 'value',
        color: '#0ea5e9',
        thresholds: { warning: 1, critical: 5, direction: 'lower_is_better' },
        thresholdNote:
            'Pressure gauge. Any positive value deserves a quick incident review; ' +
            'sustained growth means the issue is not clearing.',
        mock: { seed: 46, sparkMin: 1, sparkMax: 20, value: 12, change: 0 },
    },
    {
        id: 'executive_ai_defense_blocks',
        section: 'custom',
        label: 'AI blocks',
        subLabel: 'Cisco AI Defense block rate',
        description:
            'Percent of GenAI prompts or responses denied by Cisco AI Defense policy.',
        savedSearch: 'Security - GenAI Protection - Cisco AI Defense Block Rate',
        valueField: 'block_pct',
        unit: '%',
        color: '#0ea5e9',
        thresholds: { warning: 20, critical: 50, direction: 'lower_is_better' },
        thresholdNote:
            'High block rates can mean active probing or a policy/model change. ' +
            'Review top blocked policies for context.',
        mock: { seed: 47, sparkMin: 0, sparkMax: 30, value: 4, change: 0 },
    },
    {
        id: 'executive_duo_users',
        section: 'custom',
        label: 'Duo users',
        subLabel: 'Tenant snapshot users',
        description:
            'Latest Duo tenant user count from the tenant KPI snapshot.',
        savedSearch: 'Identity - Duo MFA - Tenant KPI Snapshot',
        valueField: 'Users',
        color: '#8b5cf6',
        thresholdNote:
            'Inventory signal. Treat unexpected drops as a tenant, API, or parsing ' +
            'issue until confirmed.',
        mock: { seed: 48, sparkMin: 500, sparkMax: 5000, value: 1280, change: 0 },
    },
    {
        id: 'executive_issue_pressure',
        section: 'custom',
        label: 'Issue pressure',
        subLabel: 'Active Catalyst Center issues',
        description:
            'Active Catalyst Center issue volume with P1/P2 and footprint context.',
        savedSearch: 'Executive - Issue Summary KPIs',
        valueField: 'total',
        color: '#0ea5e9',
        thresholds: { warning: 50, critical: 250, direction: 'lower_is_better' },
        thresholdNote:
            'Broad issue pressure gauge. P1/P2 counts and affected-site footprint ' +
            'matter more than total volume alone.',
        mock: { seed: 49, sparkMin: 0, sparkMax: 200, value: 36, change: 0 },
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
// Default bindings (2026-05-12): the right-column KPI tiles next to
// the topology map were originally site-ranking strings ("Top
// incident volume", "Operational lead"). Both broke on Alan's stack:
// XDR `site` enrichment isn't wired so the incident-ranking tile
// always shows the "Site enrichment unavailable" sentinel, and the
// DNAC fixture on the stack carries Sydney/APAC sites from a
// different demo customer's data so the operational-lead tile
// surfaces those instead of TLH or AUB.
//
// Even with the data fixed, ranking is barely informative for a
// 2-site footprint — leader and trailer are the same two
// sites every refresh. The map already shows per-site health colours
// and per-link colours, so the right-column tiles add more value as
// **aggregate signals** the map can't show:
//
//   - `active_critical_alerts` — count of currently-firing TE alerts
//     at critical/error severity. Direct pressure-gauge answer to
//     "is anything firing?". Sourced from the same accelerated
//     `Cisco_ThousandEyes.Alerts` data model that powers the IT
//     Health "Active TE Alerts" sparkline tile, so the data path is
//     proven against live customer data.
//   - `inter_site_latency` — current path latency between TLH and
//     AUB ThousandEyes agents, as a formatted "12 ms" / "—" string.
//     Sourced from the same A2A test that powers the topology map
//     link health (via `[overview_link_auburndale_tallahassee_health]`).
//
// Both saved searches `appendpipe` a `count==0` fallback so the tile
// never renders blank — `0` for the alert count, `—` for latency
// when no measurement exists in the window.
//
// **Legacy alternates:** the original `[overview_top_incident_volume]`
// and `[overview_operational_lead]` stanzas (and their `_demo`
// counterparts) stay in the catalogue tagged `Legacy_KPI` so any
// deployment with real XDR `site` enrichment or a bigger-than-2-site
// footprint can rebind via the picker.
const KPI_CONFIG: KpiConfig[] = [
    {
        id: 'active_critical_alerts',
        label: 'Active critical alerts',
        description:
            'Count of currently-active ThousandEyes alerts at critical or ' +
            'error severity. Pulled from the accelerated ' +
            'Cisco_ThousandEyes.Alerts data model with a defensive ' +
            'fallback to "0" when the data model is empty so the tile ' +
            'never renders blank.',
        thresholdNote:
            'Pressure gauge: 0 = quiet window, no action. 1+ = pivot to ' +
            'the IT Health "ThousandEyes Active Alerts" table for the ' +
            'recent-20 list and triage from the top. Sustained elevation ' +
            'across refreshes = long-running incident not yet cleared.',
        savedSearch: 'Overview - Active Critical Alerts',
        valueField: 'value',
        mockValue: 'Awaiting data',
    },
    {
        id: 'inter_site_latency',
        label: 'TLH ↔ AUB latency',
        description:
            'Current path latency between Tallahassee and Auburndale ' +
            'ThousandEyes agents-to-agent test, formatted as "12 ms". ' +
            'Renders "—" when the data model returns no measurement ' +
            '(typically because the source/target agent is offline). The ' +
            'topology map link popup names which agents are being measured.',
        thresholdNote:
            'Health bands match the inter-site link health stanza: under ' +
            '30 ms is calm, 30–100 ms is warning territory, ≥100 ms is ' +
            'critical. A reading of "—" means the A2A test isn\'t producing ' +
            'data — check agent status on both ends. For path-level detail ' +
            '(loss, jitter, hops), open the topology map link popup and use ' +
            'the "View in ThousandEyes" deep link.',
        savedSearch: 'Overview - Inter-Site Latency (TLH <-> AUB)',
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
    it_health: {
        title: DEFAULT_CUSTOMER_TOPOLOGY_SECTION_TITLES.it_health,
        linkText: 'Open IT health',
        href: 'it_health_v1',
    },
    security: {
        title: DEFAULT_CUSTOMER_TOPOLOGY_SECTION_TITLES.security,
        linkText: 'Open security',
        href: 'security_v1',
    },
    building: {
        title: DEFAULT_CUSTOMER_TOPOLOGY_SECTION_TITLES.building,
        linkText: 'Open building intelligence',
        href: 'building_v1',
    },
    custom: {
        title: DEFAULT_CUSTOMER_TOPOLOGY_SECTION_TITLES.custom,
        linkText: 'Open executive signals',
        href: 'home_launchpad_v1',
    },
};

// Leave blank until a deployment wires a saved search returning
// `_time, severity, source, message`. When blank, the incident ticker
// stays hidden rather than showing customer-facing placeholder copy.
const OVERVIEW_INCIDENT_TICKER_SAVED_SEARCH: string = '';

interface AppPriorityDrilldown {
    viewName: string;
    title: string;
    description: string;
    timeToken?: string;
}

const PRIORITY_DRILLDOWN_LABEL = 'Priority Drill-Down';
const PRIORITY_DRILLDOWN_CTA = 'Open dashboard';
const PRIORITY_DRILLDOWN_STORAGE_KEY =
    'splunk-cisco-dashboards.priorityDrilldown.v1';
const DEFAULT_PRIORITY_DRILLDOWN_VIEW = 'statewide_exercise_v1';

// App-local allow-list only. These are shipped views in this app, curated
// from default/data/ui/nav/default.xml plus default/data/ui/views/*.xml.
// Archive, overview, test, template, admin, and platform utility views are
// intentionally excluded from the executive drill-down picker.
const APP_PRIORITY_DRILLDOWNS: readonly AppPriorityDrilldown[] = [
    {
        viewName: 'statewide_exercise_v1',
        title: 'Statewide Network Activation Report',
        description: 'Client health, readiness, and activation signals across all sites.',
        timeToken: 'time_tok',
    },
    {
        viewName: 'it_health_v1',
        title: 'IT Health',
        description: 'Critical systems, network posture, device health, and compliance.',
        timeToken: 'global_time',
    },
    {
        viewName: 'security_v1',
        title: 'Security Resilience',
        description: 'Firewall, identity, XDR, IDS/IPS, DNS, and endpoint signals.',
        timeToken: 'global_time',
    },
    {
        viewName: 'building_v1',
        title: 'Building Intelligence',
        description: 'Cisco Spaces occupancy, wireless trust, and workplace telemetry.',
        timeToken: 'global_time',
    },
    {
        viewName: 'health_monitoring',
        title: 'Health Monitoring',
        description: 'Operational health monitoring for sites and infrastructure.',
    },
    {
        viewName: 'netops_readiness_v1',
        title: 'NetOps Readiness',
        description: 'Readiness, site posture, and field-operation validation.',
        timeToken: 'global_time',
    },
    {
        viewName: 'spaces_intelligence_v1',
        title: 'Spaces Intelligence',
        description: 'Cisco Spaces intelligence for locations, devices, and activity.',
        timeToken: 'global_time',
    },
    {
        viewName: 'workplace_spog_v1',
        title: 'Workplace Single Pane',
        description: 'Unified workplace and collaboration operating view.',
        timeToken: 'global_time',
    },
    {
        viewName: 'asset_inventory_v1',
        title: 'Asset Inventory',
        description: 'Asset inventory across Cisco and Splunk-connected sources.',
        timeToken: 'time_tok',
    },
    {
        viewName: 'network_diagram',
        title: 'Network Diagram',
        description: 'Network diagram and topology-oriented operational context.',
    },
    {
        viewName: 'topology_canvas_v1',
        title: 'Topology Canvas',
        description: 'Interactive network topology canvas for site and device context.',
    },
];

const getPriorityDrilldown = (viewName: string): AppPriorityDrilldown =>
    APP_PRIORITY_DRILLDOWNS.find((item) => item.viewName === viewName) ??
    APP_PRIORITY_DRILLDOWNS[0];

const readPriorityDrilldownView = (): string => {
    if (typeof window === 'undefined' || !window.localStorage) {
        return DEFAULT_PRIORITY_DRILLDOWN_VIEW;
    }
    try {
        const raw = window.localStorage.getItem(PRIORITY_DRILLDOWN_STORAGE_KEY);
        if (!raw) return DEFAULT_PRIORITY_DRILLDOWN_VIEW;
        const parsed = JSON.parse(raw) as { viewName?: unknown };
        const viewName = typeof parsed.viewName === 'string' ? parsed.viewName : '';
        return getPriorityDrilldown(viewName).viewName;
    } catch {
        return DEFAULT_PRIORITY_DRILLDOWN_VIEW;
    }
};

const writePriorityDrilldownView = (viewName: string): void => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
        window.localStorage.setItem(
            PRIORITY_DRILLDOWN_STORAGE_KEY,
            JSON.stringify({ viewName })
        );
    } catch {
        // Storage may be unavailable; the in-memory state still works
        // for the current session.
    }
};

const clearPriorityDrilldownView = (): void => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
        window.localStorage.removeItem(PRIORITY_DRILLDOWN_STORAGE_KEY);
    } catch {
        // Storage unavailable; ignore.
    }
};

// =============================================================================
// Splunk Search drilldown URL builder
// =============================================================================

// Locale-aware URL builder for a sibling Splunk view inside this app
// (e.g. statewide_exercise_v1). Mirrors splunkSearchAppUrl's locale
// detection so the URL stays valid in non-en-US Splunk installs.
const splunkViewAppUrl = (
    viewName: string,
    range?: TimeRange,
    timeToken?: string
): string => {
    const path = typeof window !== 'undefined' ? window.location.pathname : '/en-US';
    const localeMatch = path.match(/^\/([a-z]{2}-[A-Z]{2})\//);
    const locale = localeMatch ? localeMatch[1] : 'en-US';
    const baseUrl = `/${locale}/app/${APP_NAME}/${viewName}`;
    if (!range || !timeToken) return baseUrl;

    const params = new URLSearchParams();
    params.set(`form.${timeToken}.earliest`, range.earliest);
    params.set(`form.${timeToken}.latest`, range.latest);
    return `${baseUrl}?${params.toString()}`;
};

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

type MetricDetailTableColumnKind = 'text' | 'status' | 'metric';

interface MetricDetailTableColumn {
    field: string;
    label: string;
    align?: 'left' | 'right';
    kind?: MetricDetailTableColumnKind;
    fallback?: string;
    truncate?: boolean;
}

interface MetricDetailTableConfig {
    title: string;
    buttonTitle: string;
    subtitle: (range: TimeRange) => string;
    spl: string;
    tag: string;
    rowKeyField: string;
    emptyMessage: string;
    errorMessage: string;
    statusField?: string;
    availableStatus?: string;
    unavailableStatus?: string;
    columns: MetricDetailTableColumn[];
}

const DETAIL_TABLE_COLUMN_KINDS = new Set<MetricDetailTableColumnKind>([
    'text',
    'status',
    'metric',
]);

const readDetailStringOption = (
    options: Record<string, unknown> | undefined,
    key: string
): string | undefined => {
    const raw = options?.[key];
    if (typeof raw !== 'string') return undefined;
    const trimmed = raw.trim();
    return trimmed.length > 0 && trimmed.length <= 256 ? trimmed : undefined;
};

const parseDetailTableColumns = (
    raw: unknown
): MetricDetailTableColumn[] => {
    if (!Array.isArray(raw)) return [];
    const columns: MetricDetailTableColumn[] = [];
    raw.forEach((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return;
        const candidate = item as Record<string, unknown>;
        const field = typeof candidate.field === 'string' ? candidate.field.trim() : '';
        const label =
            typeof candidate.label === 'string' ? candidate.label.trim() : field;
        if (!field || !label || field.length > 96 || label.length > 96) return;
        const align =
            candidate.align === 'right' || candidate.align === 'left'
                ? candidate.align
                : undefined;
        const kind =
            typeof candidate.kind === 'string' &&
            DETAIL_TABLE_COLUMN_KINDS.has(candidate.kind as MetricDetailTableColumnKind)
                ? (candidate.kind as MetricDetailTableColumnKind)
                : undefined;
        const fallback =
            typeof candidate.fallback === 'string'
                ? candidate.fallback.slice(0, 120)
                : undefined;
        columns.push({
            field,
            label,
            align,
            kind,
            fallback,
            truncate: candidate.truncate === true,
        });
    });
    return columns.slice(0, 12);
};

const INFERRED_DETAIL_TABLE_SKIP_FIELDS = new Set([
    '_raw',
    '_serial',
    '_si',
    '_span',
    'splunk_server',
]);

const humanizeDetailFieldLabel = (field: string): string =>
    field
        .replace(/^Test_Metrics\./, '')
        .replace(/[_.]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, (char) => char.toUpperCase());

const isNumericLike = (value: unknown): boolean => {
    if (typeof value === 'number') return Number.isFinite(value);
    if (typeof value !== 'string') return false;
    return /^-?\d+(?:\.\d+)?%?$/.test(value.trim());
};

const inferDetailTableColumns = (
    rows: Array<Record<string, unknown>>
): MetricDetailTableColumn[] => {
    const fields: string[] = [];
    const seen = new Set<string>();
    for (const row of rows) {
        for (const field of Object.keys(row)) {
            if (seen.has(field)) continue;
            if (INFERRED_DETAIL_TABLE_SKIP_FIELDS.has(field)) continue;
            if (field.startsWith('_') && field !== '_time') continue;
            seen.add(field);
            fields.push(field);
            if (fields.length >= 12) break;
        }
        if (fields.length >= 12) break;
    }
    return fields.map((field) => {
        const sample = rows.find((row) => row[field] !== undefined)?.[field];
        return {
            field,
            label: humanizeDetailFieldLabel(field),
            align: isNumericLike(sample) ? 'right' : undefined,
            truncate: field.length > 32,
        };
    });
};

const interpolateDetailSubtitle = (
    template: string,
    source: SearchbaseRecord,
    detail: SearchbaseRecord,
    range: TimeRange
): string =>
    template
        .replace(/\{rangeLabel\}/g, range.label.toLowerCase())
        .replace(/\{RangeLabel\}/g, range.label)
        .replace(/\{searchName\}/g, source.searchName)
        .replace(/\{drilldownSearchName\}/g, detail.searchName);

const buildMetricDetailTableConfig = (
    source: SearchbaseRecord | null,
    searchbaseByName: Map<string, SearchbaseRecord> | null | undefined,
    searchbaseDrilldowns: SearchbaseDrilldownMap
): MetricDetailTableConfig | null => {
    const userDrilldown =
        source && Object.prototype.hasOwnProperty.call(searchbaseDrilldowns, source.searchName)
            ? searchbaseDrilldowns[source.searchName]
            : undefined;
    const drilldownName =
        userDrilldown === null
            ? ''
            : (userDrilldown ?? source?.drilldownSearchName)?.trim();
    if (!source || !drilldownName || !searchbaseByName) return null;
    const detail = searchbaseByName.get(drilldownName);
    if (!detail?.search) return null;
    const options = detail.vizOptions;
    const columns = parseDetailTableColumns(options?.columns);
    const subtitleTemplate =
        readDetailStringOption(options, 'modalSubtitle') ??
        'Detail table for {searchName} over {rangeLabel}.';
    const tag = `detail_table_${detail.id || detail.searchName}`.replace(
        /[^A-Za-z0-9_]+/g,
        '_'
    );
    return {
        title:
            readDetailStringOption(options, 'modalTitle') ??
            `${source.searchName} Details`,
        buttonTitle:
            source.drilldownButtonTitle ??
            readDetailStringOption(options, 'buttonTitle') ??
            `View ${source.searchName} detail table`,
        subtitle: (range) =>
            interpolateDetailSubtitle(subtitleTemplate, source, detail, range),
        spl: detail.search,
        tag,
        rowKeyField:
            readDetailStringOption(options, 'rowKeyField') ?? columns[0]?.field ?? '',
        emptyMessage:
            readDetailStringOption(options, 'emptyMessage') ??
            'No detail rows returned for this time range.',
        errorMessage:
            readDetailStringOption(options, 'errorMessage') ??
            `Unable to load ${detail.searchName}.`,
        statusField: readDetailStringOption(options, 'statusField'),
        availableStatus: readDetailStringOption(options, 'availableStatus'),
        unavailableStatus: readDetailStringOption(options, 'unavailableStatus'),
        columns,
    };
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
    /** Tightens nonessential chart chrome when the available viewport is short. */
    compactDensity?: boolean;
    /**
     * Optional override applied on top of the static config. When
     * present, the gear icon is rendered with a "modified" dot.
     */
    override?: MetricOverride;
    onConfigure: () => void;
    onOpenDetailTable?: (config: MetricDetailTableConfig) => void;
    searchbaseDrilldowns: SearchbaseDrilldownMap;
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
 * field, label, description, thresholds). Everything else — mock
 * fallback, section, colour — stays put so the visual identity
 * stays consistent with the static config.
 *
 * `valueField` does NOT fall back to `cfg.valueField` when an override
 * is in play. When the user binds a different searchbase entry, the
 * original tile's field name almost certainly doesn't exist in the
 * new search's output — carrying it forward used to make `useMetric`
 * read undefined values, filter to an empty series, and silently fall
 * back to the static mock (the "headline didn't change after a picker
 * swap" bug). When `override.valueField` is undefined, `useMetric`
 * auto-detects from the live result rows.
 *
 * Thresholds (Build 97): each of `thresholdWarning` /
 * `thresholdCritical` / `thresholdDirection` is independently
 * optional. When set, the override field replaces the static
 * default; when undefined, the static default carries through. This
 * means a partial override (e.g. only `thresholdWarning`) keeps the
 * other two threshold fields anchored to the shipped values, which
 * is exactly what users want when they want to "tweak the warning
 * point but leave critical alone". The merged `MetricThresholds`
 * tuple is fed to `computeStatus` and `deriveThresholdLines` so the
 * tile colour, the trend-arrow tint, the sparkline stroke, and the
 * THRESHOLDS rows in the per-tile info popover all stay in lockstep
 * — there's still exactly one source of truth.
 */
const mergeThresholds = (
    base: MetricThresholds | undefined,
    override: MetricOverride
): MetricThresholds | undefined => {
    const hasOverride =
        override.thresholdWarning !== undefined ||
        override.thresholdCritical !== undefined ||
        override.thresholdDirection !== undefined;
    if (!hasOverride) return base;
    return {
        warning: override.thresholdWarning ?? base?.warning,
        critical: override.thresholdCritical ?? base?.critical,
        // Direction is required on the type even when warning/critical
        // are both undefined. Fall back to `higher_is_better` if the
        // tile shipped without thresholds at all so the override path
        // produces a valid `MetricThresholds` shape rather than a
        // partial that breaks `computeStatus`.
        direction: override.thresholdDirection ?? base?.direction ?? 'higher_is_better',
    };
};

const applyOverride = (cfg: MetricConfig, override?: MetricOverride): MetricConfig => {
    if (!override) return cfg;
    // Detect "binding-swap" overrides vs. "tweak-only" overrides
    // (Build 1188.1).
    //
    // Originally `applyOverride` assumed every override was a
    // saved-search swap and aggressively blanked the original
    // `subLabel` / `unit` / `spl` / mock-fallback so the prior
    // tile's chrome wouldn't decorate a now-different headline.
    // That assumption broke once Build 1174 introduced
    // viz-only overrides (`vizOverride` and threshold tweaks
    // without changing the binding): the picker was writing
    // `savedSearch: <same as cfg.savedSearch>` because the
    // payload always carries it, but `applyOverride` couldn't
    // tell the difference and still nuked the original tile's
    // mock-fallback. The chart promptly went blank for any
    // tile whose searchbase entry returned 0 rows, because the
    // mock series that had been painting the sparkline was
    // suppressed (Alan flagged on 2026-05-18: "it works only
    // with the viz type set in searchbase.conf, changing to
    // anything is broken").
    //
    // Heuristic: when `override.savedSearch` matches the static
    // `cfg.savedSearch`, the user explicitly kept the binding
    // (or never changed it). In that case keep the original
    // tile's chrome — don't drop `spl` (the static SPL is what
    // the binding *means*), don't blank `subLabel`/`unit`, and
    // don't suppress the mock fallback. Apply only the genuinely
    // user-set fields (label / description / threshold / valueField
    // / vizOverride). When the saved searches differ, fall through
    // to the historical "binding swap" behaviour so a different
    // search no longer carries the prior tile's identity.
    const isBindingSwap = override.savedSearch !== cfg.savedSearch;
    if (!isBindingSwap) {
        return {
            ...cfg,
            // Apply user-set overrides only when they have a value.
            // `valueField` is special: undefined here means "use
            // auto-detect", which is a legitimate user choice on
            // tweak-only overrides too, so we still set it through
            // (the picker carries the static cfg's valueField when
            // the user hasn't changed it, so this rarely actually
            // changes anything in practice).
            valueField: override.valueField ?? cfg.valueField,
            label: override.label ?? cfg.label,
            description: override.description ?? cfg.description,
            thresholds: mergeThresholds(cfg.thresholds, override),
        };
    }
    return {
        ...cfg,
        savedSearch: override.savedSearch,
        spl: undefined,
        valueField: override.valueField,
        label: override.label ?? cfg.label,
        description: override.description ?? cfg.description,
        thresholds: mergeThresholds(cfg.thresholds, override),
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
    compactDensity = false,
    override,
    onConfigure,
    onOpenDetailTable,
    searchbaseDrilldowns,
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

    const detailTableConfig = useMemo(
        () =>
            buildMetricDetailTableConfig(
                sbRecord,
                searchbaseByName,
                searchbaseDrilldowns
            ),
        [sbRecord, searchbaseByName, searchbaseDrilldowns]
    );
    const openDetailTable =
        detailTableConfig && onOpenDetailTable
            ? () => onOpenDetailTable(detailTableConfig)
            : undefined;

    // Branch on viz type: tables and bar-breakdowns get wholly different
    // rendering paths (TableTile / BarBreakdownTile + useTableData) so we
    // never coerce categorical row distributions through the
    // single-value/sparkline pipeline. The branch is component-level
    // (rather than inside the body) so each leaf calls its own data hook
    // unconditionally — Rules of Hooks forbid switching `useMetric` ↔
    // `useTableData` between renders.
    //
    // Both table and bar-breakdown leaves use the same `useTableData`
    // hook (rows + columns shape) but render the result differently.
    const showTable = isTableViz(sbRecord?.defaultViz);
    const showBarBreakdown = isBarBreakdownViz(sbRecord?.defaultViz);

    if (showTable) {
        return (
            <TableCardLeaf
                effective={effective}
                dispatchedConfig={dispatchedConfig}
                range={range}
                refreshToken={refreshToken}
                onStatus={onStatus}
                onConfigure={onConfigure}
                onOpenDetailTable={openDetailTable}
                detailTableTitle={detailTableConfig?.buttonTitle}
                infoAnchor={infoAnchor}
                isCustomized={Boolean(override)}
            />
        );
    }
    if (showBarBreakdown) {
        return (
            <BarBreakdownCardLeaf
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
            onOpenDetailTable={openDetailTable}
            detailTableTitle={detailTableConfig?.buttonTitle}
            infoAnchor={infoAnchor}
            isCustomized={Boolean(override)}
            vizOverride={override?.vizOverride}
            hidePeak={override?.hidePeak}
            hideDelta={override?.hideDelta}
            hideOverlay={override?.hideOverlay}
            compactDensity={compactDensity}
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
    onOpenDetailTable?: () => void;
    detailTableTitle?: string;
    infoAnchor: 'auto' | 'left' | 'right';
    isCustomized: boolean;
}

interface MetricCardLeafProps extends CommonLeafProps {
    sbRecord: SearchbaseRecord | null;
    /**
     * User-picked viz override (Build 1174, extended in 1187). When
     * set, takes precedence over `searchbase.conf`'s `default_viz`
     * for the sparkline render path. `applyOverride()` does NOT
     * bake this into `effective` because the override applies to
     * the chart rendering, not the metric semantics — the same
     * headline value, threshold, and SPL keep flowing through;
     * only the viz primitive changes.
     */
    vizOverride?: 'area' | 'line' | 'column' | 'bar' | 'singlevalue';
    /**
     * Display toggles (Build 1202, from Atef's review). When set,
     * suppress the corresponding chrome around the headline value:
     *   • `hidePeak` → forces `dataValuesDisplay='off'` so the
     *     Sparkline draws without min/peak bubble labels.
     *   • `hideDelta` → drops the `change` prop so MetricItem renders
     *     no ↑/↓ percentage pill next to the headline.
     *   • `hideOverlay` (Build 1203) → suppresses the dashed
     *     previous-period (or baseline) line on the sparkline by
     *     passing `previousData={undefined}` to MetricItem. The
     *     primary trend stays; only the comparison overlay goes away.
     * All three default to `undefined` (treated as `false`); the
     * runtime merge layer in `applyOverride` deliberately leaves
     * these on the override object — they affect rendering, not
     * metric semantics, same shape as `vizOverride`.
     */
    hidePeak?: boolean;
    hideDelta?: boolean;
    hideOverlay?: boolean;
    compactDensity?: boolean;
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
    onOpenDetailTable,
    detailTableTitle,
    infoAnchor,
    isCustomized,
    vizOverride,
    hidePeak,
    hideDelta,
    hideOverlay,
    compactDensity = false,
}) => {
    /**
     * Tile viz variant. Resolution order (highest precedence first):
     *   1. `vizOverride` — Build 1174 picker setting per tile, persisted
     *      in localStorage via `usePersistedMetricOverrides`. Lets the
     *      operator switch chart style (area / line / column /
     *      singlevalue) without touching the searchbase or forking the
     *      tile.
     *   2. `searchbase.conf`'s `default_viz` — conf-level default.
     *   3. Fallback to `area` (the prior project-wide default), handled
     *      inside `sparklineVizTypeFromSplunkViz` for unknown / absent
     *      ids.
     *
     * Cross-binding behaviour: when the picker switches the searchbase
     * binding (a different `savedSearch`) WITHOUT setting `vizOverride`,
     * the tile inherits the new binding's `default_viz`. With
     * `vizOverride` set, the chart style is pinned regardless of which
     * binding drives the data — the override is about *how* it's drawn,
     * not what it's drawing.
     */
    const vizType = useMemo(
        () => vizOverride ?? sparklineVizTypeFromSplunkViz(sbRecord?.defaultViz),
        [vizOverride, sbRecord?.defaultViz]
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

    // Threshold rows are derived from the same `MetricThresholds` the
    // runtime uses to colour the headline (`computeStatus`), so the
    // popover and the live tile colour can never disagree. The unit
    // ("%", "ms", etc.) is appended verbatim. For tiles whose unit
    // doesn't apply to the threshold (e.g. `critical_website_availability`
    // headline is "X of Y" but the threshold is on a percentage),
    // `thresholdNote` clarifies — see METRIC_CONFIG.
    const thresholdLines = useMemo(
        () => deriveThresholdLines(effective.thresholds, effective.unit),
        [effective.thresholds, effective.unit]
    );

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
            thresholdLines={thresholdLines}
            thresholdNote={effective.thresholdNote}
            infoAnchor={infoAnchor}
            // `displayValue` (string broadcast from the search) wins
            // over the numeric `value` when present. Status, threshold,
            // and change still derive from the numeric `value` so the
            // headline color remains accurate even for tiles that
            // render a non-numeric headline (e.g. "12 of 18 available").
            value={
                typeof result.displayValue === 'string'
                    ? result.displayValue
                    : result.value
            }
            unit={
                typeof result.displayValue === 'string'
                    ? ''
                    : effective.unit
            }
            // `hideDelta` (Build 1202) drops the change pill entirely
            // by omitting the `change` prop. MetricItem's `showChange`
            // guard treats `undefined` as "no pill" — same path as
            // tiles whose search emits no comparable previous-period
            // value, so we get the right rendering with zero extra
            // MetricItem branching.
            change={hideDelta ? undefined : result.change}
            sparkData={result.sparkData}
            // `hideOverlay` (Build 1203) drops the dashed previous-
            // period / baseline line from the sparkline canvas by
            // omitting `previousData` and its label. The Sparkline
            // component treats `undefined` as "no overlay" — the
            // same path as tiles whose search doesn't emit a
            // comparable previous series — so we get the right
            // rendering with no extra Sparkline branching. The
            // primary trend, peaks (if enabled), and headline are
            // unaffected.
            previousData={hideOverlay ? undefined : result.previousSparkData}
            previousLabel={hideOverlay ? undefined : effective.overlayLabel}
            sparkTimestamps={result.sparkTimestamps}
            timeRange={range}
            color={tileColor}
            vizType={vizType}
            // `hidePeak` (Build 1202) forces the Sparkline to draw
            // without min/peak bubble labels. Mapping to the existing
            // `'off'` mode (the Studio v2 analogue Sparkline already
            // supports) means we don't add a new prop — we just pin
            // the existing one regardless of what the searchbase
            // entry asked for.
            dataValuesDisplay={
                hidePeak
                    ? 'off'
                    : compactDensity && dataValuesDisplay === 'minmax'
                    ? 'maxonly'
                    : dataValuesDisplay
            }
            status={result.status}
            source={result.source}
            onOpenInSearch={drilldownSpl ? handleClick : undefined}
            onOpenDetailTable={onOpenDetailTable}
            detailTableTitle={detailTableTitle}
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
            thresholdNote={effective.thresholdNote}
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

/**
 * Bar-breakdown leaf: single-series categorical distribution rendered
 * through BarBreakdownTile. Activated when the bound searchbase stanza
 * declares `default_viz = splunk.bar`. Reuses the table dispatcher
 * (`useTableData`) since the underlying SPL shape is the same
 * (`<dimension>, <count>`), then paints the rows as horizontal bars
 * with a sum headline. Status is always `unknown` for the same reason
 * as TableCardLeaf — no per-row threshold semantics — so the
 * aggregate health badge math is unchanged.
 */
const BarBreakdownCardLeaf: React.FC<CommonLeafProps> = ({
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
        <BarBreakdownTile
            label={effective.label}
            subLabel={effective.subLabel}
            description={effective.description}
            descriptionFootnote={undefined}
            thresholdNote={effective.thresholdNote}
            infoAnchor={infoAnchor}
            rows={result.rows}
            columns={result.columns}
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
    const availableDashboardHeight = useAvailableDashboardHeight();
    const compactDensity =
        availableDashboardHeight !== null &&
        availableDashboardHeight < COMPACT_HEIGHT_THRESHOLD_PX;
    const dashboardShellStyle = useMemo<React.CSSProperties>(
        () => ({
            height:
                availableDashboardHeight !== null
                    ? `${availableDashboardHeight}px`
                    : '100vh',
        }),
        [availableDashboardHeight]
    );

    // ------------------------------ Branding ------------------------------
    //
    // Three layered defaults govern what the header chrome shows:
    //
    //   1. `brandingOverride` (per-user, localStorage) — values from
    //      the header pencil → Edit branding panel. Highest priority.
    //   2. `customerName` (per-deployment, Splunk macro) — the
    //      `[customer_name]` macro value fetched at mount. Operator-
    //      controlled via `local/macros.conf`.
    //   3. Hardcoded fallbacks (`DEFAULT_HEADER_TITLE_FALLBACK`,
    //      `DEFAULT_HEADER_SUBTITLE`, `DEFAULT_LOGO_DATA_URI`) — what
    //      every fresh install ships with. The default logo is a
    //      neutral network mark so the app doesn't imply a specific
    //      customer, agency, or vendor brand before setup.
    //
    // `effectiveTitle` / `effectiveSubtitle` / `effectiveLogoSrc`
    // (derived below) collapse those layers into the strings the
    // JSX actually renders.
    const [customerName, setCustomerName] = useState<string>('');
    const [logoSrc, setLogoSrc] = useState<string>(DEFAULT_LOGO_DATA_URI);
    const [splunkUsername, setSplunkUsername] = useState<string>('');
    const {
        override: brandingOverride,
        setOverride: setBrandingOverride,
        resetAll: resetBrandingOverride,
    } = useBrandingOverride();
    const [isBrandingEditorOpen, setBrandingEditorOpen] = useState<boolean>(false);
    const [isSectionTitlesEditorOpen, setSectionTitlesEditorOpen] =
        useState<boolean>(false);

    const effectiveTitle =
        brandingOverride.title ||
        customerName ||
        DEFAULT_HEADER_TITLE_FALLBACK;
    const effectiveSubtitle =
        brandingOverride.subtitle || DEFAULT_HEADER_SUBTITLE;
    // Logo precedence: explicit override (data URI from upload) →
    // current `logoSrc` (the neutral built-in default unless this
    // session has recovered from an image error). Header branding is
    // intentionally independent from tile/layout factory reset.
    const effectiveLogoSrc = brandingOverride.logoDataUri || logoSrc;

    // ------------------------------ Time + refresh ------------------------------
    const [timeRange, setTimeRange] = useState<TimeRange>(
        () =>
            TIME_RANGE_OPTIONS.find((o) => o.label === DEFAULT_TIME_RANGE_LABEL) ??
            TIME_RANGE_OPTIONS[1]
    );
    const [selectedPriorityDrilldownView, setSelectedPriorityDrilldownView] =
        useState<string>(readPriorityDrilldownView);
    const configuredIncidentTickerSearch = OVERVIEW_INCIDENT_TICKER_SAVED_SEARCH.trim();
    const selectedPriorityDrilldown = useMemo(
        () => getPriorityDrilldown(selectedPriorityDrilldownView),
        [selectedPriorityDrilldownView]
    );
    const featuredDrilldownHref = useMemo(
        () =>
            splunkViewAppUrl(
                selectedPriorityDrilldown.viewName,
                timeRange,
                selectedPriorityDrilldown.timeToken
            ),
        [selectedPriorityDrilldown, timeRange]
    );
    const handlePriorityDrilldownChange = useCallback(
        (viewName: string) => {
            const next = getPriorityDrilldown(viewName);
            setSelectedPriorityDrilldownView(next.viewName);
            writePriorityDrilldownView(next.viewName);
        },
        []
    );
    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const onStorage = (e: StorageEvent) => {
            if (e.key !== PRIORITY_DRILLDOWN_STORAGE_KEY) return;
            setSelectedPriorityDrilldownView(readPriorityDrilldownView());
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);
    const [autoRefreshSeconds, setAutoRefreshSeconds] = useState<number>(0);
    const [refreshToken, setRefreshToken] = useState<number>(0);
    const [lastRefreshed, setLastRefreshed] = useState<Date>(() => new Date());
    const refreshNow = useCallback(() => {
        setRefreshToken((n) => n + 1);
        setLastRefreshed(new Date());
    }, []);

    // ------------------------------ Section layout preference ------------------------------
    //
    // Factory shows the original three executive sections. Users can
    // hide sections they do not care about or reveal the fourth
    // optional section for a broader command-center layout.
    const {
        sections: visibleSections,
        availableSections,
        maxSections: maxVisibleSections,
        setSections: setVisibleSections,
        resetAll: resetAllSectionLayout,
    } = usePersistedSectionLayout();

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
    // Bounds: 3..9 with per-section defaults. Cap is 9 so every
    // shipped section can expose the full factory catalogue while
    // still booting at a tight three-tile executive summary.
    //
    // *Default* count is 3 across every section (Build 83). The exec
    // view boots with a tight, three-headline-per-row layout that
    // fits cleanly into the new 2/3-tiles / 1/3-map split. Operators
    // who want more breadth dial up via the `−  N  +` pill on each
    // section header (cap is 9).
    //
    // History: earlier revisions defaulted to 3 (Alan's original
    // "show me the three I asked for"), then bumped to 6 on
    // 2026-05-12 because the right-side map fought for horizontal
    // width and the wider tile column looked empty at 3 tiles. With
    // Build 83's 2/3-tile column the visual balance flips back —
    // 3 tiles fill the row cleanly without collisions, and 6 starts
    // truncating headlines at 1280px. Returning users keep whatever
    // count they had configured because the per-section preference
    // is keyed off localStorage.
    //
    // Declared up here (before the aggregate status block) because
    // the HealthBadge filter below needs to know which tiles are
    // currently visible.
    const {
        counts: sectionTileCounts,
        bounds: sectionTileBounds,
        setCount: setSectionTileCount,
        resetAll: resetAllSectionTileCounts,
    } = usePersistedSectionTileCounts({
        minCount: 3,
        maxCount: 9,
        defaultCount: {},
        fallbackDefault: 3,
    });

    // ------------------------------ Section height preference ------------------------------
    //
    // A companion to tile count and tile order. Some teams want one
    // section to act as the primary work surface for the day; the
    // height pill lets them give that section a taller chart canvas
    // without changing global topology config or removing other
    // sections.
    const {
        heights: sectionHeights,
        bounds: sectionHeightBounds,
        setHeight: setSectionHeight,
        resetAll: resetAllSectionHeights,
    } = usePersistedSectionHeights({
        minLevel: 1,
        maxLevel: 5,
        defaultLevel: 1,
    });

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
        for (const section of visibleSections) {
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
    }, [visibleSections, sectionTileCounts, getSectionTileOrder]);

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
    // Runtime dispatch intentionally includes `search_hidden = 1`
    // stanzas. A few factory tiles bind to hidden support searches in
    // `searchbase.conf`; if those are omitted here, the tile falls
    // back to `| savedsearch "..."` and Splunk returns 400 because
    // the hidden searchbase stanza is not a savedsearches.conf entry.
    //
    // UI browsers/pickers still fetch the default visible-only
    // catalogue below so hidden support stanzas never surface as
    // selectable KPI options.
    useEffect(() => {
        let cancelled = false;
        getSearchbaseCatalogue({ includeHidden: true })
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

    const [visibleSearchbaseCatalogue, setVisibleSearchbaseCatalogue] = useState<
        SearchbaseRecord[] | null
    >(null);
    const [signalTickerIncludeHiddenSearches, setSignalTickerIncludeHiddenSearches] =
        useState(false);
    useEffect(() => {
        let cancelled = false;
        setVisibleSearchbaseCatalogue(null);
        getSearchbaseCatalogue(
            signalTickerIncludeHiddenSearches
                ? { allApps: true, includeHidden: true }
                : { allApps: true }
        )
            .then((list) => {
                if (cancelled) return;
                setVisibleSearchbaseCatalogue(list);
            })
            .catch(() => {
                if (!cancelled) setVisibleSearchbaseCatalogue([]);
            });
        return () => {
            cancelled = true;
        };
    }, [signalTickerIncludeHiddenSearches]);

    // ------------------------------ Signal rail ------------------------------
    // A configurable, moving executive KPI rail. This first slice follows the
    // page's existing per-browser customization model for KPI bindings; the
    // selected entries still come from `searchbase.conf` so the content model
    // stays app-owned and familiar to operators.
    const {
        config: signalTickerConfig,
        setConfig: setSignalTickerConfig,
        resetAll: resetSignalTickerConfig,
        itemCount: signalTickerItemCount,
    } = usePersistedSignalTicker();
    const [signalTickerEditorOpen, setSignalTickerEditorOpen] = useState(false);
    const searchbaseCatalogue = useMemo(
        () =>
            visibleSearchbaseCatalogue
                ? [...visibleSearchbaseCatalogue].sort((a, b) =>
                      a.searchName.localeCompare(b.searchName)
                  )
                : [],
        [visibleSearchbaseCatalogue]
    );

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

    // ------------------------------ Map position (right / below / above) ------------------------------
    // Where the topology map sits relative to the metric tiles. Default
    // is `right` (per the 2026-05-13 review): the topology map is the
    // executive's anchor visual, so it lives on the right where the eye
    // returns after scanning the metric rails on the left. Build 83
    // pairs this with a tighter map column (≈1/3 of the width — see
    // `SPLIT_DEFAULT` below) so the metric tiles still get 2/3 of the
    // viewport for headline KPIs.
    //
    // Earlier revisions defaulted to `below` because the original
    // right-side-only layout fought for horizontal width on
    // 1280-1440px displays. That concern is addressed by the new
    // 66.67% tile / 33.33% map split, which keeps tile headlines
    // legible at 1280px while still giving the map enough room for
    // region labels.
    //
    // `right` is the side-by-side split-pane (draggable vertical
    // splitter); `below` stacks tiles-on-top + map-below; `above`
    // stacks the other way for operators who treat the map as the
    // primary view.
    //
    // Declared *above* the layout-split block because the drag and
    // keyboard handlers below need to read this value to decide which
    // axis to operate on.
    //
    // Persisted in localStorage so the operator's preference survives
    // reloads, cleared by the factory reset alongside the splitter
    // position.
    const MAP_POS_KEY = 'scd_overview_map_pos';
    const MAP_POS_DEFAULT: MapPosition = 'right';
    const [mapPosition, setMapPosition] = useState<MapPosition>(() => {
        if (typeof window === 'undefined') return MAP_POS_DEFAULT;
        try {
            const saved = window.localStorage.getItem(MAP_POS_KEY);
            return saved === 'right' || saved === 'below' || saved === 'above'
                ? saved
                : MAP_POS_DEFAULT;
        } catch {
            return MAP_POS_DEFAULT;
        }
    });
    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            window.localStorage.setItem(MAP_POS_KEY, mapPosition);
        } catch {
            // localStorage may be disabled (private mode / quota);
            // the choice still works for the session, we just can't
            // persist it. Mirrors the split-percentage handling.
        }
    }, [mapPosition]);
    // Convenience flag for the drag / keyboard handlers and the
    // splitter styling: `right` mode drags on the X axis, `below` /
    // `above` modes drag on the Y axis.
    const isVerticalSplit = mapPosition !== 'right';

    // ------------------------------ Layout split (tiles ↔ map) ------------------------------
    // Percentage of the container allocated to the tile column,
    // regardless of layout mode. In `right` mode the splitter is the
    // thin vertical handle between the two side-by-side columns — drag
    // it left to widen the map, right to widen the tiles. In `below` /
    // `above` modes the same percentage controls vertical share: drag
    // the horizontal handle up/down to rebalance heights. (In `above`
    // mode the axis is inverted because tiles sit at the visual bottom
    // — see `onMove` below.) Default 58.33% matches the previous fixed
    // 7-of-12 grid so the page boots identically until the user
    // reaches for the handle. Persisted to localStorage so the
    // operator's preference survives reloads.
    //
    // Clamped 35–80% to keep both columns usable: below 35% and the
    // tiles can't even fit one row of headlines without truncating;
    // above 80% and the map collapses to a slim band that's hard to
    // read region labels on. The same range applies vertically — at
    // 35% map (= 65% tiles) the map height drops to ~280px on a
    // standard 1080p display, which is the bottom of "still useful".
    //
    // Default 66.67% (Build 83): metrics get 2/3 of the width, map
    // gets 1/3. Pairs with `MAP_POS_DEFAULT = 'right'` to put the
    // headline KPI rails on the left and the topology map as the
    // anchor visual on the right at boot. Earlier revisions used
    // 58.33% (= 7/12, matching the legacy fixed grid), but that left
    // the map column too wide for an exec view where the metrics are
    // the primary read.
    const SPLIT_KEY = 'scd_overview_split_pct';
    const SPLIT_DEFAULT = 66.67;
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
            let pct: number;
            if (mapPosition === 'right') {
                if (rect.width <= 0) return;
                pct = ((ev.clientX - rect.left) / rect.width) * 100;
            } else {
                if (rect.height <= 0) return;
                // Raw pct is the splitter's vertical position as a
                // fraction of container height (0 = top edge, 100 =
                // bottom edge). In `below` mode the tiles occupy the
                // top portion, so that *is* the tiles' share. In
                // `above` mode the layout is flex-col-reverse — tiles
                // sit at the visual bottom — so the share is inverted.
                const rawPct = ((ev.clientY - rect.top) / rect.height) * 100;
                pct = mapPosition === 'above' ? 100 - rawPct : rawPct;
            }
            const clamped = Math.max(SPLIT_MIN, Math.min(SPLIT_MAX, pct));
            setLeftPct(clamped);
        };
        const onUp = () => setDragging(false);
        // Lock the cursor and suppress text-selection while dragging.
        // Without this the cursor flickers between resize and the
        // default arrow as the pointer crosses tile boundaries, and
        // sustained drags accidentally select metric labels. The axis
        // matches the splitter orientation so the locked cursor lines
        // up with what the user is actually doing.
        const prevCursor = document.body.style.cursor;
        const prevUserSelect = document.body.style.userSelect;
        document.body.style.cursor = isVerticalSplit ? 'row-resize' : 'col-resize';
        document.body.style.userSelect = 'none';
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            document.body.style.cursor = prevCursor;
            document.body.style.userSelect = prevUserSelect;
        };
    }, [dragging, mapPosition, isVerticalSplit]);
    // Keyboard nudge: arrow keys ±1, Shift+arrow ±5. Double-click
    // restores the default split. Both make the handle keyboard- and
    // touch-friendly without hijacking page-level shortcuts.
    //
    // The arrow key axis follows the splitter orientation so the
    // visual mental model holds: pressing the arrow in a direction
    // always moves the splitter line in that direction.
    //   - `right` mode: ←/→ adjust tiles' width share directly.
    //   - `below` mode: ↑ shrinks tiles (top section), ↓ grows them.
    //   - `above` mode: tiles sit at the bottom, so ↑ *grows* them
    //     (the splitter rises into map territory) and ↓ shrinks them.
    // Home / End always snap to the min / max share for the tiles
    // regardless of orientation — they're "first / last" semantics,
    // not directional.
    const onSplitterKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            const step = e.shiftKey ? 5 : 1;
            const clamp = (p: number) => Math.max(SPLIT_MIN, Math.min(SPLIT_MAX, p));
            if (mapPosition === 'right') {
                if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    setLeftPct((p) => clamp(p - step));
                } else if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    setLeftPct((p) => clamp(p + step));
                }
            } else {
                // `above` inverts the axis (see onMove comment).
                const sign = mapPosition === 'above' ? -1 : 1;
                if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setLeftPct((p) => clamp(p - sign * step));
                } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setLeftPct((p) => clamp(p + sign * step));
                }
            }
            if (e.key === 'Home') {
                e.preventDefault();
                setLeftPct(SPLIT_MIN);
            } else if (e.key === 'End') {
                e.preventDefault();
                setLeftPct(SPLIT_MAX);
            }
        },
        [SPLIT_MIN, SPLIT_MAX, mapPosition]
    );
    const resetSplit = useCallback(() => setLeftPct(SPLIT_DEFAULT), []);
    const verticalMapMinHeight = compactDensity
        ? VERTICAL_MAP_COMPACT_MIN_HEIGHT_PX
        : VERTICAL_MAP_MIN_HEIGHT_PX;
    const verticalMetricsMinHeight = compactDensity
        ? VERTICAL_METRICS_COMPACT_MIN_HEIGHT_PX
        : VERTICAL_METRICS_MIN_HEIGHT_PX;
    const verticalMetricsStyle = useMemo<React.CSSProperties | undefined>(
        () =>
            isVerticalSplit
                ? {
                      flexBasis: `${leftPct}%`,
                      flexGrow: 0,
                      flexShrink: 1,
                      minHeight: verticalMetricsMinHeight,
                  }
                : undefined,
        [isVerticalSplit, leftPct, verticalMetricsMinHeight]
    );
    const verticalMapStyle = useMemo<React.CSSProperties | undefined>(
        () =>
            isVerticalSplit
                ? {
                      minHeight: `min(${verticalMapMinHeight}px, calc(100% - ${verticalMetricsMinHeight}px))`,
                  }
                : undefined,
        [isVerticalSplit, verticalMapMinHeight, verticalMetricsMinHeight]
    );
    const firstVisibleSectionMinHeight = useMemo(() => {
        const section = visibleSections[0];
        if (!section) return verticalMetricsMinHeight;
        const sectionMetricCount = METRIC_CONFIG.filter(
            (metric) => metric.section === section
        ).length;
        const visibleCount = Math.min(
            sectionTileCounts[section],
            Math.min(sectionTileBounds.maxCount, sectionMetricCount)
        );
        const estimatedTileRows =
            visibleCount >= SECTION_WRAP_TILE_COUNT
                ? Math.ceil(visibleCount / SECTION_WRAPPED_TILE_COLUMNS)
                : 1;
        const heightLevel =
            sectionHeights[section] ?? sectionHeightBounds.defaultLevel;
        const baseMinHeight = compactDensity
            ? SECTION_HEIGHT_COMPACT_BASE_PX
            : SECTION_HEIGHT_BASE_PX;
        return Math.max(
            verticalMetricsMinHeight,
            baseMinHeight +
                (heightLevel - sectionHeightBounds.minLevel) *
                    SECTION_HEIGHT_STEP_PX +
                (estimatedTileRows - 1) * SECTION_WRAPPED_TILE_ROW_STEP_PX
        );
    }, [
        compactDensity,
        sectionHeightBounds.defaultLevel,
        sectionHeightBounds.minLevel,
        sectionHeights,
        sectionTileBounds.maxCount,
        sectionTileCounts,
        verticalMetricsMinHeight,
        visibleSections,
    ]);
    const splitStyle = useMemo(
        () =>
            ({
                '--scd-left-pct': `${leftPct}%`,
                ...(isVerticalSplit
                    ? {
                          minHeight:
                              verticalMapMinHeight +
                              firstVisibleSectionMinHeight +
                              VERTICAL_SPLIT_CHROME_ALLOWANCE_PX,
                      }
                    : null),
            }) as React.CSSProperties,
        [
            firstVisibleSectionMinHeight,
            isVerticalSplit,
            leftPct,
            verticalMapMinHeight,
        ]
    );

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
    const signalTickerMetricDefaults = useMemo(() => {
        const toDefault = (cfg: MetricConfig): SignalTickerMetricDefaults => ({
            label: cfg.label,
            subLabel: cfg.subLabel,
            description: cfg.description,
            valueField: cfg.valueField,
            displayField: cfg.displayField,
            sparkDataField: cfg.sparkDataField,
            baselineField: cfg.baselineField,
            overlayLabel: cfg.overlayLabel,
            changeField: cfg.changeField,
            comparePeriod: cfg.comparePeriod,
            unit: cfg.unit,
            color: cfg.color,
            thresholds: cfg.thresholds,
        });
        const map = new Map<string, SignalTickerMetricDefaults>();
        for (const cfg of METRIC_CONFIG) {
            if (cfg.savedSearch) map.set(cfg.savedSearch, toDefault(cfg));
            const effective = applyOverride(cfg, overrides[cfg.id]);
            if (effective.savedSearch) {
                map.set(effective.savedSearch, toDefault(effective));
            }
        }
        return map;
    }, [overrides]);
    const {
        drilldowns: searchbaseDrilldowns,
        setDrilldown: setSearchbaseDrilldown,
        clearDrilldown: clearSearchbaseDrilldown,
        resetAll: resetAllSearchbaseDrilldowns,
    } = usePersistedSearchbaseDrilldowns();
    const [pickerContext, setPickerContext] = useState<KpiPickerContext | null>(null);
    const [activeDetailTable, setActiveDetailTable] =
        useState<MetricDetailTableConfig | null>(null);

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
    const {
        topology: persistedTopology,
        sectionTitles,
        saveSectionTitles,
    } = usePersistedTopology(CUSTOMER_TOPOLOGY);
    const topologyHeaderName =
        persistedTopology.name?.trim() || 'Network Topology';
    const topologyHeaderSubtitle =
        persistedTopology.subtitle?.trim() ||
        'Site connectivity and path health';
    const effectiveSectionMeta = useMemo(
        () =>
            ({
                it_health: {
                    ...SECTION_META.it_health,
                    title:
                        sectionTitles.it_health ||
                        SECTION_META.it_health.title,
                },
                security: {
                    ...SECTION_META.security,
                    title:
                        sectionTitles.security ||
                        SECTION_META.security.title,
                },
                building: {
                    ...SECTION_META.building,
                    title:
                        sectionTitles.building ||
                        SECTION_META.building.title,
                },
                custom: {
                    ...SECTION_META.custom,
                    title:
                        sectionTitles.custom ||
                        SECTION_META.custom.title,
                },
            } as Record<
                SectionId,
                { title: string; linkText: string; href: string }
            >),
        [sectionTitles]
    );

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
            current?: {
                savedSearch?: string;
                valueField?: string;
                /**
                 * Static (code-defined) threshold tuple for this tile.
                 * The picker uses this to pre-fill the THRESHOLDS form
                 * with the tile's factory baseline, so the user always
                 * sees what they're modifying away from. Also drives
                 * the per-field "Reset to default" affordance — fields
                 * matching `defaultThresholds` are omitted from the
                 * persisted override so the storage payload only
                 * carries genuine deltas. Undefined for tiles that
                 * shipped without numeric thresholds (e.g. KPI cards
                 * with string headlines); the form still renders so
                 * the user can establish thresholds if they swap the
                 * tile to a numeric search.
                 */
                defaultThresholds?: MetricThresholds;
                /** Static unit ('%', 'ms', etc.) for threshold preview formatting. */
                unit?: string;
                /**
                 * Section the tile lives in (Build 1203). Threaded
                 * through to the picker so the Display block can
                 * offer "Apply to all tiles in <section>" as an
                 * ergonomic shortcut for operators who want every
                 * KPI in a section to read the same way (e.g. hide
                 * delta pills across all IT Health tiles for a
                 * cleaner status board view). Optional — when
                 * omitted (e.g. MetricItem tiles outside the KPI
                 * grid) the picker silently skips the link, no
                 * other behaviour changes.
                 */
                section?: SectionId;
            }
        ) => {
            const ov: MetricOverride | undefined = overrides[tileId];
            // CRITICAL: when an override exists, an undefined
            // `valueField` is the user's explicit "use auto-detect"
            // choice and must NOT fall through to the original tile's
            // valueField. The previous `??` did exactly that, which
            // pre-filled the picker input with the original column
            // name and caused every subsequent Apply to clobber the
            // user's auto-detect intent.
            //
            // Threshold context (Build 97):
            //   • `defaultThresholds` always reflects the *static*
            //     code-defined tuple — the picker uses this for the
            //     factory-default helper text and the per-field
            //     Reset-to-default behaviour.
            //   • `currentThresholds` reflects the current effective
            //     tuple after merging any persisted override on top of
            //     the default. The picker pre-fills its inputs from
            //     this, so re-opening the picker on a customised tile
            //     shows the customised values, not the defaults.
            const merged: MetricThresholds | undefined = ov
                ? mergeThresholds(current?.defaultThresholds, ov)
                : current?.defaultThresholds;
            setPickerContext({
                tileId,
                defaultLabel,
                currentSavedSearch: ov ? ov.savedSearch : current?.savedSearch,
                currentValueField: ov ? ov.valueField : current?.valueField,
                currentLabel: ov?.label,
                defaultThresholds: current?.defaultThresholds,
                currentThresholds: merged,
                thresholdUnit: current?.unit,
                usedSavedSearches,
                currentVizOverride: ov?.vizOverride,
                currentHidePeak: ov?.hidePeak,
                currentHideDelta: ov?.hideDelta,
                currentHideOverlay: ov?.hideOverlay,
                sectionId: current?.section,
                sectionLabel: current?.section
                    ? effectiveSectionMeta[current.section]?.title
                    : undefined,
            });
        },
        [effectiveSectionMeta, overrides, usedSavedSearches]
    );

    const closePicker = useCallback(() => setPickerContext(null), []);

    const handlePickerApply = useCallback(
        (tileId: string, override: MetricOverride) => {
            setOverride(tileId, override);
            setPickerContext(null);
        },
        [setOverride]
    );

    const handleSearchbaseDrilldownApply = useCallback(
        (sourceSearchName: string, drilldownSearchName: string | null) => {
            const source = searchbaseByName?.get(sourceSearchName);
            const defaultName = source?.drilldownSearchName?.trim() ?? '';
            const nextName = drilldownSearchName?.trim() ?? '';
            if (nextName === defaultName || (!nextName && !defaultName)) {
                clearSearchbaseDrilldown(sourceSearchName);
                return;
            }
            setSearchbaseDrilldown(sourceSearchName, nextName || null);
        },
        [clearSearchbaseDrilldown, searchbaseByName, setSearchbaseDrilldown]
    );

    /**
     * Section-level "Apply these Display settings to all tiles in
     * this section" handler (Build 1203, from Atef's "global vs
     * per-KPI settings" framing). Fans the three display flags
     * (`hidePeak`, `hideDelta`, `hideOverlay`) out to every
     * MetricItem AND KpiCard in the named section, including the
     * current tile, so the picker can close immediately afterwards
     * without a separate Apply click.
     *
     * Merge semantics:
     *   • Tiles with an existing override → keep every existing
     *     field (savedSearch, valueField, thresholds, chart style,
     *     label, etc.) and just overlay the three display flags.
     *     `false` writes are normalised to "absent" via the
     *     sanitiser, so a "show everything" patch wipes the flags
     *     rather than persisting `false`.
     *   • Tiles without an existing override → write a minimal
     *     override carrying the tile's own `savedSearch` (the
     *     required field on `MetricOverride`) plus the requested
     *     display flags. The tile picks up a "(custom)" dot in
     *     the UI, which is honest: it IS customised now.
     *
     * Why this lives in the page (not the picker): the picker
     * doesn't know the section roster, and we don't want to hand
     * it the whole `METRIC_CONFIG` / `KPI_CONFIG` catalogue. The
     * page owns the catalogue; the picker hands us the section id
     * and the patch and we do the fan-out.
     *
     * Scope contract: deliberately limited to display flags so
     * the link's behaviour stays predictable. Chart style and
     * thresholds are still per-tile customisations — that's where
     * tile-by-tile semantics matter and a section-wide apply would
     * be more confusing than helpful (a status board with five
     * tiles forced into the same chart style usually isn't what
     * the operator wanted).
     */
    const handleApplyDisplayToSection = useCallback(
        (
            sectionId: string,
            patch: { hidePeak: boolean; hideDelta: boolean; hideOverlay: boolean }
        ) => {
            // Resolve siblings from both catalogues. `KPI_CONFIG`
            // entries (the two summary cards above the topology map)
            // don't carry a section, so they're naturally excluded —
            // see comment on `openPicker` for the rationale.
            const sectionMetrics = METRIC_CONFIG.filter((m) => m.section === sectionId);
            for (const m of sectionMetrics) {
                const existing = overrides[m.id];
                const baseSavedSearch = existing?.savedSearch ?? m.savedSearch;
                const next: MetricOverride = {
                    ...(existing ?? { savedSearch: baseSavedSearch }),
                    savedSearch: baseSavedSearch,
                    // Pass `undefined` for false flags so the sanitiser
                    // strips them from the persisted payload — gives us
                    // a "show everything" reset path through the same
                    // code that handles "hide everything".
                    hidePeak: patch.hidePeak ? true : undefined,
                    hideDelta: patch.hideDelta ? true : undefined,
                    hideOverlay: patch.hideOverlay ? true : undefined,
                };
                setOverride(m.id, next);
            }
            setPickerContext(null);
        },
        [overrides, setOverride]
    );

    // "Factory reset" — wipes every persisted dashboard customisation
    // in one shot. The picker shows a `window.confirm()` prompt before
    // calling this, so misclicks are caught at the UI layer; we only
    // get here if the user has explicitly agreed.
    //
    // What gets reset (and the localStorage keys cleared):
    //   • metricOverrides.v1            — per-tile picker bindings
    //   • searchbaseDrilldowns.v1       — picker-wired drilldown bindings
    //   • sectionLayout.v1              — visible section roster
    //   • sectionTileCounts.v1          — visible tile count per section
    //   • sectionHeights.v1             — vertical room per section
    //   • sectionTileOrder.v1           — drag-to-reorder preference
    //   • customerTopology.v4           — retired per-browser map payload
    //   • scd_overview_split_pct        — tiles ↔ map splitter position
    //   • scd_overview_map_pos          — map position (right / below / above)
    //   • priorityDrilldown.v1          — pinned app-local drill-down target
    //   • signalTicker.v1               — moving KPI rail selection
    //
    // What is intentionally NOT reset:
    //   • header branding (title / subtitle / logo) — identity, not
    //     dashboard layout or tile state
    //   • theme (light / dark) — UI preference, not layout
    //   • shared customer_topology.conf — site/link and section-title
    //     edits are global app state, not per-user layout preference
    //
    // After reset, we close the picker and bump `topologyResetKey` to
    // clear any retired in-browser topology payload from old builds.
    const handleResetAllCustomizations = useCallback(() => {
        resetAllOverrides();
        resetAllSearchbaseDrilldowns();
        resetAllSectionLayout();
        resetAllSectionTileCounts();
        resetAllSectionHeights();
        resetAllSectionTileOrder();
        resetSignalTickerConfig();
        clearCustomerTopologyStorage();
        setTopologyResetKey((n) => n + 1);
        setLeftPct(SPLIT_DEFAULT);
        setMapPosition(MAP_POS_DEFAULT);
        setSelectedPriorityDrilldownView(DEFAULT_PRIORITY_DRILLDOWN_VIEW);
        clearPriorityDrilldownView();
        if (typeof window !== 'undefined' && window.localStorage) {
            try {
                window.localStorage.removeItem(SPLIT_KEY);
                window.localStorage.removeItem(MAP_POS_KEY);
            } catch {
                // Storage unavailable; the setLeftPct / setMapPosition
                // calls above are the authoritative reset for this
                // session anyway.
            }
        }
        setPickerContext(null);
    }, [
        resetAllOverrides,
        resetAllSearchbaseDrilldowns,
        resetAllSectionLayout,
        resetAllSectionTileCounts,
        resetAllSectionHeights,
        resetAllSectionTileOrder,
        resetSignalTickerConfig,
        SPLIT_KEY,
        SPLIT_DEFAULT,
        setLeftPct,
        MAP_POS_KEY,
        MAP_POS_DEFAULT,
        setMapPosition,
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
    const effectiveActiveAlertsCfg = useMemo<KpiConfig>(
        () => buildEffectiveKpiCfg(KPI_CONFIG[0], overrides[KPI_CONFIG[0].id]),
        [overrides, searchbaseByName]
    );
    const effectiveInterSiteLatencyCfg = useMemo<KpiConfig>(
        () => buildEffectiveKpiCfg(KPI_CONFIG[1], overrides[KPI_CONFIG[1].id]),
        [overrides, searchbaseByName]
    );
    const activeAlerts = useKpi(effectiveActiveAlertsCfg, timeRange, refreshToken);
    const interSiteLatency = useKpi(effectiveInterSiteLatencyCfg, timeRange, refreshToken);
    // Topology summary feed key parity with KPI_CONFIG ids — when the
    // overview_topology_overview SPL emits a `summary` row with
    // `summaryId="active_critical_alerts"` / `"inter_site_latency"`
    // it shadows the standalone useKpi value. Earlier revisions keyed
    // these on `top_incident` / `operational_lead`; both sides moved
    // in lockstep on 2026-05-12.
    const topologyActiveAlerts = topologySummaryById.active_critical_alerts;
    const topologyInterSiteLatency = topologySummaryById.inter_site_latency;
    // Picker-override precedence: when the operator has explicitly bound
    // a different search via the gear icon (overrides[id] present), the
    // user's `useKpi` result wins. Otherwise we fall through to the
    // topology overview SPL summary row (cheap, already-running, kept in
    // lockstep with the map). Without this branch, the topology summary
    // silently shadowed the override and the picker appeared broken.
    const activeAlertsOverride = overrides[KPI_CONFIG[0].id];
    const interSiteLatencyOverride = overrides[KPI_CONFIG[1].id];
    const activeAlertsCard = activeAlertsOverride
        ? {
              label: effectiveActiveAlertsCfg.label,
              value: activeAlerts.value,
              source: activeAlerts.source,
          }
        : {
              label: topologyActiveAlerts?.label ?? effectiveActiveAlertsCfg.label,
              value: topologyActiveAlerts?.value ?? activeAlerts.value,
              source: topologyActiveAlerts?.source ?? activeAlerts.source,
          };
    const interSiteLatencyCard = interSiteLatencyOverride
        ? {
              label: effectiveInterSiteLatencyCfg.label,
              value: interSiteLatency.value,
              source: interSiteLatency.source,
          }
        : {
              label: topologyInterSiteLatency?.label ?? effectiveInterSiteLatencyCfg.label,
              value: topologyInterSiteLatency?.value ?? interSiteLatency.value,
              source: topologyInterSiteLatency?.source ?? interSiteLatency.source,
          };
    // Footnote shown at the bottom of the info tooltip — surfaces the
    // current data source so the operator can trace lineage. When an
    // override is bound, we point at the user's saved search; otherwise
    // we name the topology overview stanza that's actually emitting the
    // value (or "(inline SPL)" if both are absent).
    // Drilldown SPL: always the literal SPL useKpi just dispatched
    // (`activeAlerts.spl` / `interSiteLatency.spl`). When no override is
    // bound, that's the inline KPI_CONFIG SPL — a clean, single-purpose
    // query — which is a far better drilldown target than the giant
    // `overview_topology_overview` pipeline. When an override is bound,
    // it's the resolved searchbase SPL → exactly what the picker preview
    // showed. Either way: see-and-click parity with what's running.
    const activeAlertsDrilldownSpl = activeAlerts.spl;
    const interSiteLatencyDrilldownSpl = interSiteLatency.spl;
    const handleActiveAlertsOpenInSearch = useCallback(() => {
        if (!activeAlertsDrilldownSpl) return;
        const url = splunkSearchAppUrl(activeAlertsDrilldownSpl, timeRange);
        if (typeof window !== 'undefined') {
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    }, [activeAlertsDrilldownSpl, timeRange]);
    const handleInterSiteLatencyOpenInSearch = useCallback(() => {
        if (!interSiteLatencyDrilldownSpl) return;
        const url = splunkSearchAppUrl(interSiteLatencyDrilldownSpl, timeRange);
        if (typeof window !== 'undefined') {
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    }, [interSiteLatencyDrilldownSpl, timeRange]);
    // Footnote precedence:
    //   1. Override bound  → user's saved search (or "(inline SPL)" if
    //      they wired a free-form SPL via the picker).
    //   2. Topology summary feed  → that's the actual source of the
    //      displayed value; surface the topology overview stanza.
    //   3. useKpi default path  → the static binding from KPI_CONFIG,
    //      which is a real searchbase entry (`Overview - Active
    //      Critical Alerts` / `Overview - Inter-Site Latency (TLH <->
    //      AUB)`). Surface that name so the footnote credits the
    //      actual SPL that ran.
    const activeAlertsBindingFootnote = activeAlertsOverride
        ? activeAlertsOverride.savedSearch
            ? `Saved search: ${activeAlertsOverride.savedSearch}`
            : '(inline SPL)'
        : topologyActiveAlerts
        ? 'Saved search: Overview - Topology Overview'
        : KPI_CONFIG[0].savedSearch
        ? `Saved search: ${KPI_CONFIG[0].savedSearch}`
        : '(inline SPL)';
    const interSiteLatencyBindingFootnote = interSiteLatencyOverride
        ? interSiteLatencyOverride.savedSearch
            ? `Saved search: ${interSiteLatencyOverride.savedSearch}`
            : '(inline SPL)'
        : topologyInterSiteLatency
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
    const openSignalTickerEditor = useCallback(() => {
        setSignalTickerEditorOpen(true);
    }, []);
    const closeHelp = useCallback(() => {
        setHelpOpen(false);
    }, []);

    const SHORTCUTS = useMemo<
        { keys: string; description: string; handler: () => void }[]
    >(
        () => [
            {
                keys: 'g i',
                description: `Open ${effectiveSectionMeta.it_health.title} dashboard (new tab)`,
                handler: () => openDrilldown(effectiveSectionMeta.it_health.href),
            },
            {
                keys: 'g s',
                description: `Open ${effectiveSectionMeta.security.title} dashboard (new tab)`,
                handler: () => openDrilldown(effectiveSectionMeta.security.href),
            },
            {
                keys: 'g b',
                description: `Open ${effectiveSectionMeta.building.title} (new tab)`,
                handler: () => openDrilldown(effectiveSectionMeta.building.href),
            },
            {
                keys: 'g r',
                description: 'Configure Signal Rail',
                handler: openSignalTickerEditor,
            },
            { keys: 't', description: 'Cycle time range', handler: cycleTimeRange },
            { keys: 'r', description: 'Refresh all data now', handler: refreshNow },
            {
                keys: '/',
                description: 'Focus the time-range picker',
                handler: focusGlobalSearch,
            },
            {
                keys: '?',
                description: 'Toggle this help overlay',
                handler: () => setHelpOpen((o) => !o),
            },
        ],
        [
            cycleTimeRange,
            effectiveSectionMeta.building.href,
            effectiveSectionMeta.building.title,
            effectiveSectionMeta.it_health.href,
            effectiveSectionMeta.it_health.title,
            effectiveSectionMeta.security.href,
            effectiveSectionMeta.security.title,
            focusGlobalSearch,
            openDrilldown,
            openSignalTickerEditor,
            refreshNow,
        ]
    );
    const helpShortcutRows = useMemo(
        () =>
            SHORTCUTS.map((s) => ({
                keys: s.keys,
                description: s.description,
            })),
        [SHORTCUTS]
    );
    useKeyboardShortcuts(SHORTCUTS, true);
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && helpOpen) closeHelp();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [closeHelp, helpOpen]);

    // ------------------------------ Render ------------------------------
    const inputClass =
        'text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 border border-slate-200 ' +
        'dark:border-slate-700 rounded-md m-0 h-8 px-2 py-0 text-slate-700 dark:text-slate-200 ' +
        'hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 ' +
        'focus:ring-sky-500 cursor-pointer';
    const iconBtnClass =
        'p-1.5 rounded transition-colors text-slate-500 dark:text-slate-400 ' +
        'hover:text-sky-600 dark:hover:text-sky-300 hover:bg-slate-50 dark:hover:bg-slate-800';

    return (
        <div
            ref={exportRef}
            style={dashboardShellStyle}
            className={cn(
                'scd-overview-page flex flex-col font-sans overflow-hidden',
                compactDensity && 'scd-overview-compact',
                'bg-slate-50 text-slate-900',
                'dark:bg-slate-950 dark:text-slate-100',
                resolvedTheme === 'dark' && 'dark'
            )}
        >
            {/* Header */}
            <header className="h-14 flex-shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 flex items-center justify-between shadow-sm">
                {/*
                  * The branding cluster (logo + title/subtitle + edit
                  * pencil) is the hover-trigger group. The pencil sits
                  * hidden by default (`opacity-0`) and reveals on hover
                  * anywhere in the cluster, OR on keyboard focus of the
                  * pencil itself via `focus-visible`. `focus-visible`
                  * (not `focus`) keeps the pencil hidden when the user
                  * clicks elsewhere and the button is mouse-focused —
                  * we only want the hover/keyboard reveal so the
                  * default header stays visually clean for executives
                  * who don't need to rebrand. The named-group form
                  * (`group/branding`) scopes the hover trigger to the
                  * cluster so any future ancestor `group` class doesn't
                  * accidentally fire the same reveal.
                  */}
                <div className="flex items-center gap-3 min-w-0 group/branding">
                    <div className="w-9 h-9 bg-sky-600 rounded-lg flex items-center justify-center text-white overflow-hidden p-1 flex-shrink-0">
                        <img
                            src={effectiveLogoSrc}
                            alt="Dashboard logo"
                            className="w-full h-full object-contain"
                            onError={() => {
                                // If a future non-data default logo fails to
                                // load, recover to the neutral built-in mark
                                // instead of leaving a broken image in the
                                // executive header. User-uploaded data URIs
                                // are self-contained and managed by the
                                // branding editor.
                                if (
                                    !brandingOverride.logoDataUri &&
                                    logoSrc !== DEFAULT_LOGO_DATA_URI
                                ) {
                                    setLogoSrc(DEFAULT_LOGO_DATA_URI);
                                }
                            }}
                        />
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-base font-black text-sky-900 dark:text-sky-200 tracking-tight leading-none uppercase truncate">
                            {effectiveTitle}
                        </h1>
                        <p className="text-[9px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-[0.3em] mt-1 leading-none truncate">
                            {effectiveSubtitle}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setBrandingEditorOpen(true)}
                        title="Edit branding (title, subtitle, logo)"
                        aria-label="Edit branding (title, subtitle, logo)"
                        className="flex-shrink-0 p-1 rounded text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-slate-100 dark:hover:bg-slate-800 opacity-0 group-hover/branding:opacity-100 focus-visible:opacity-100 transition"
                    >
                        <Edit3 className="w-3.5 h-3.5" />
                    </button>
                </div>

                <div className="flex items-center gap-2.5 flex-shrink-0">
                    <HealthBadge statuses={statusList} />
                    <label className="m-0 flex h-8 items-center gap-1.5">
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
                    <label className="m-0 flex h-8 items-center gap-1.5">
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
                    <button
                        type="button"
                        onClick={() => setSignalTickerEditorOpen(true)}
                        title={`Configure signal rail (${signalTickerItemCount} KPI${
                            signalTickerItemCount === 1 ? '' : 's'
                        })`}
                        className={cn(
                            iconBtnClass,
                            signalTickerConfig.enabled
                                ? 'text-sky-600 dark:text-sky-300'
                                : 'text-slate-400 dark:text-slate-500'
                        )}
                    >
                        <Sparkles className="w-4 h-4" />
                    </button>
                    <ThemeToggle theme={theme} onCycle={cycleTheme} />
                    <button
                        type="button"
                        onClick={() => setHelpOpen(true)}
                        // Build 1205: title widened from "Keyboard
                        // shortcuts" to reflect the overlay's broader
                        // remit — it now also documents the picker's
                        // scope contract (tile vs. section vs.
                        // drill-down). The `?` shortcut still works
                        // and is the affordance power users learned;
                        // the title text is the discovery hook for
                        // everyone else.
                        title="Help & reference (?)"
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

            {/* Mini incident ticker: hidden until a saved search is configured. */}
            {configuredIncidentTickerSearch ? (
                <IncidentTicker
                    savedSearch={configuredIncidentTickerSearch}
                    range={timeRange}
                    refreshToken={refreshToken}
                />
            ) : null}

            <SignalTickerRail
                config={signalTickerConfig}
                catalogueByName={searchbaseByName}
                metricDefaultsBySearchName={signalTickerMetricDefaults}
                range={timeRange}
                refreshToken={refreshToken}
                paused={
                    helpOpen ||
                    signalTickerEditorOpen ||
                    pickerContext !== null ||
                    activeDetailTable !== null
                }
                onOpenEditor={openSignalTickerEditor}
            />

            {/* Customer-pinned, app-local drill-down. Keep this to one
                primary path so the executive overview has a decisive
                next step without becoming another navigation menu. */}
            <div
                data-testid="priority-drilldown-row"
                className="group flex-shrink-0 relative block border-b border-sky-200 dark:border-sky-800/60 bg-white hover:bg-sky-50/80 dark:bg-slate-900 dark:hover:bg-sky-950/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-inset"
            >
                <div
                    aria-hidden="true"
                    className="absolute left-0 top-0 bottom-0 w-1 bg-sky-600 dark:bg-sky-500"
                />
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 pl-5 pr-4 py-2">
                    <a
                        href={featuredDrilldownHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`Open ${selectedPriorityDrilldown.title} in a new tab`}
                        aria-label={`Open ${selectedPriorityDrilldown.title} in a new tab`}
                        className="min-w-0 h-7 flex items-center gap-3 rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                    >
                        <div className="flex-shrink-0 w-7 h-7 rounded bg-sky-600 text-white flex items-center justify-center shadow-sm">
                            <ClipboardCheck className="w-4 h-4 stroke-[2.5px]" />
                        </div>
                        <span className="text-[9px] font-black text-sky-700 dark:text-sky-300 uppercase tracking-[0.25em] whitespace-nowrap flex-shrink-0 hidden sm:inline w-[172px]">
                            {PRIORITY_DRILLDOWN_LABEL}
                        </span>
                        <span className="text-[13px] font-bold text-slate-900 dark:text-slate-100 truncate min-w-0">
                            {selectedPriorityDrilldown.title}
                        </span>
                        <span className="text-[11px] text-slate-600 dark:text-slate-400 truncate min-w-0 hidden lg:inline">
                            {selectedPriorityDrilldown.description}
                        </span>
                    </a>
                    <div className="flex items-center justify-end gap-2">
                        <label className="hidden md:flex flex-shrink-0 items-center gap-1.5 h-7 !mb-0">
                            <span className="sr-only">Priority drill-down dashboard</span>
                            <Settings2
                                className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500"
                                aria-hidden="true"
                            />
                            <select
                                value={selectedPriorityDrilldown.viewName}
                                onChange={(e) => handlePriorityDrilldownChange(e.target.value)}
                                title="Choose priority drill-down dashboard"
                                aria-label="Choose priority drill-down dashboard"
                                className="h-7 !mb-0 w-[220px] max-w-[22vw] rounded-md border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 px-2 py-0 text-[11px] leading-none font-semibold text-slate-700 dark:text-slate-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                            >
                                {APP_PRIORITY_DRILLDOWNS.map((item) => (
                                    <option key={item.viewName} value={item.viewName}>
                                        {item.title}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <a
                            href={featuredDrilldownHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`Open ${selectedPriorityDrilldown.title} in a new tab`}
                            aria-label={`Open ${selectedPriorityDrilldown.title} in a new tab`}
                            data-testid="featured-report-cta"
                            className="h-7 flex-shrink-0 inline-flex items-center gap-1.5 px-3 rounded bg-sky-600 group-hover:bg-sky-500 active:bg-sky-700 text-white text-[11px] font-bold tracking-wide uppercase shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                        >
                            {PRIORITY_DRILLDOWN_CTA}
                            <ArrowRight className="w-3.5 h-3.5 stroke-[2.5px]" />
                        </a>
                    </div>
                </div>
            </div>

            {/* Edge-to-edge layout: no `max-w` clamp and only a thin
                horizontal gutter. The previous `max-w-[1600px] mx-auto`
                left half-inch margins on either side at executive-
                display resolutions; widening lets the metric tiles and
                map breathe to fill the screen. The viewport gets a 6px
                gutter on each side (just enough to keep the section
                cards from touching the chrome border) and the splitter
                drives column widths from there.
                
                Below ~1120px the layout collapses to a single stacked
                column so the splitter never strands the map or tiles in
                a slim phone-sized strip. The exact breakpoint lives in
                tailwind.css because it sits between Tailwind's stock lg
                and xl stops. */}
            <main
                className={cn(
                    'flex-1 min-h-0 w-full',
                    isVerticalSplit
                        ? 'overflow-y-auto overflow-x-hidden'
                        : 'overflow-hidden',
                    compactDensity ? 'px-1 py-1.5' : 'px-1.5 py-2'
                )}
            >
                <div
                    ref={splitContainerRef}
                    data-map-position={mapPosition}
                    className={cn(
                        // Map placement is now operator-configurable. Three
                        // modes are wired to the segmented control in the
                        // map card header (default `below`):
                        //   • right  — original split-pane behaviour, side-
                        //              by-side at xl+, stacked below on
                        //              smaller widths. Drag splitter to
                        //              rebalance.
                        //   • below  — tiles on top, map below. No
                        //              breakpoint switch — same layout at
                        //              every width.
                        //   • above  — same as below but with the column
                        //              order reversed so the map sits on
                        //              top. Uses `flex-col-reverse` rather
                        //              than rearranging the JSX so the
                        //              splitter logic stays attached to
                        //              its sibling.
                        'scd-overview-split flex gap-2 h-full min-h-0 relative',
                        mapPosition === 'right'
                            ? 'flex-col xl:flex-row'
                            : mapPosition === 'above'
                            ? 'flex-col-reverse'
                            : 'flex-col'
                    )}
                    style={splitStyle}
                >
                    {/* Left column — configurable metric sections.
                        In right mode at xl+ widths the column width is
                        driven by the --scd-left-pct CSS variable, which
                        the splitter updates on drag. In below/above modes
                        the column is full-width and its *height* is
                        driven by `leftPct` via an inline flex-basis (we
                        can't reuse the CSS var because Tailwind's
                        responsive variants don't conditionally swap
                        width vs height cleanly). The map column then
                        takes the remainder via `flex-1`, which gives
                        the same drag-to-resize feel vertically as the
                        existing right-mode splitter delivers
                        horizontally. */}
                    <div
                        // overflow-y-auto: when the viewport is too short
                        // to fit visible sections at their min-h-[180px]
                        // floor (plus ticker + header +
                        // gap), the metric column scrolls vertically
                        // instead of squishing the chart canvases below
                        // readability. The map column keeps its own
                        // height so the topology stays anchor-visible.
                        // Below xl in `right` mode, the layout has
                        // already collapsed to a stacked column anyway,
                        // so this overflow rule applies in every mode.
                        // overflow-x-hidden prevents a horizontal
                        // scrollbar from showing up due to the cards'
                        // shadow bleed at narrow widths.
                        className={cn(
                            'scd-overview-metrics flex flex-col gap-2 min-h-0 min-w-0 w-full overflow-y-auto overflow-x-hidden',
                            mapPosition === 'right'
                                ? 'xl:w-[var(--scd-left-pct)] xl:flex-shrink-0'
                                : ''
                        )}
                        data-map-position={mapPosition}
                        style={verticalMetricsStyle}
                    >
                        {visibleSections.map((section) => {
                            const meta = effectiveSectionMeta[section];
                            const allSectionMetrics = METRIC_CONFIG.filter(
                                (m) => m.section === section
                            );
                            // The pill's max is whichever is smaller —
                            // the global cap (sectionTileBounds.maxCount)
                            // or what METRIC_CONFIG actually offers for
                            // this section. This keeps the UI honest if
                            // someone trims a section to fewer tiles in
                            // METRIC_CONFIG without touching this code.
                            const sectionMaxAvailable = Math.min(
                                sectionTileBounds.maxCount,
                                allSectionMetrics.length
                            );
                            const visibleCount = Math.min(
                                sectionTileCounts[section],
                                sectionMaxAvailable
                            );
                            const wrapTiles = visibleCount >= SECTION_WRAP_TILE_COUNT;
                            const estimatedTileRows = wrapTiles
                                ? Math.ceil(
                                      visibleCount / SECTION_WRAPPED_TILE_COLUMNS
                                  )
                                : 1;
                            const heightLevel =
                                sectionHeights[section] ?? sectionHeightBounds.defaultLevel;
                            const baseMinHeight = compactDensity
                                ? SECTION_HEIGHT_COMPACT_BASE_PX
                                : SECTION_HEIGHT_BASE_PX;
                            const sectionMinHeight =
                                baseMinHeight +
                                (heightLevel - sectionHeightBounds.minLevel) *
                                    SECTION_HEIGHT_STEP_PX +
                                (estimatedTileRows - 1) *
                                    SECTION_WRAPPED_TILE_ROW_STEP_PX;

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
                                    // Height level influences both
                                    // proportional growth on roomy
                                    // screens and the hard min-height
                                    // floor that triggers metric-column
                                    // scrolling on short screens.
                                    className="flex-1"
                                    style={{
                                        flexGrow: heightLevel,
                                        minHeight: sectionMinHeight,
                                    }}
                                    height={{
                                        value: heightLevel,
                                        min: sectionHeightBounds.minLevel,
                                        max: sectionHeightBounds.maxLevel,
                                        onChange: (next) => setSectionHeight(section, next),
                                        label: `${meta.title} height`,
                                    }}
                                    wrapTiles={wrapTiles}
                                    tileCount={{
                                        value: visibleCount,
                                        min: sectionTileBounds.minCount,
                                        max: sectionMaxAvailable,
                                        onChange: (next) => setSectionTileCount(section, next),
                                        label: `${meta.title} tiles`,
                                    }}
                                    onEditTitle={() => setSectionTitlesEditorOpen(true)}
                                >
                                    <DndContext
                                        sensors={dndSensors}
                                        collisionDetection={closestCenter}
                                        onDragEnd={handleDragEnd}
                                    >
                                        <SortableContext
                                            items={visibleIds}
                                            strategy={
                                                wrapTiles
                                                    ? rectSortingStrategy
                                                    : horizontalListSortingStrategy
                                            }
                                        >
                                            {visibleIds.map((id, idx) => {
                                                const cfg = byId.get(id);
                                                if (!cfg) return null;
                                                return (
                                                    <SortableMetricCard
                                                        key={cfg.id}
                                                        id={cfg.id}
                                                        ariaLabel={cfg.label}
                                                        className={
                                                            wrapTiles
                                                                ? 'min-w-[240px] md:min-w-[250px] min-h-[148px]'
                                                                : undefined
                                                        }
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
                                                            searchbaseDrilldowns={
                                                                searchbaseDrilldowns
                                                            }
                                                            compactDensity={compactDensity}
                                                            onOpenDetailTable={
                                                                setActiveDetailTable
                                                            }
                                                            onConfigure={() =>
                                                                openPicker(cfg.id, cfg.label, {
                                                                    savedSearch: cfg.savedSearch,
                                                                    valueField: cfg.valueField,
                                                                    defaultThresholds: cfg.thresholds,
                                                                    unit: cfg.unit,
                                                                    section: cfg.section,
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

                    {/* Splitter handle — renders in every layout mode.
                        Right mode: thin vertical bar visible at xl+,
                        hidden on smaller widths where the layout
                        collapses to a single stacked column anyway.
                        Below/above modes: thin horizontal bar always
                        visible, spanning the full width. 6-8px hit-
                        area so it's easy to grab without being
                        visually heavy. Drag along the splitter's
                        short axis to rebalance tiles ↔ map; arrow
                        keys nudge ±1% (Shift = ±5%); Home/End jump to
                        the limits; double-click restores the default
                        split. Same `leftPct` persists across modes so
                        switching back to a previous orientation
                        preserves the user's intent. */}
                    <button
                        type="button"
                        role="separator"
                        aria-orientation={isVerticalSplit ? 'horizontal' : 'vertical'}
                        aria-label="Resize tiles vs map"
                        aria-valuenow={Math.round(leftPct)}
                        aria-valuemin={SPLIT_MIN}
                        aria-valuemax={SPLIT_MAX}
                        title="Drag to resize · arrows ±1% · double-click to reset"
                        onMouseDown={beginDrag}
                        onKeyDown={onSplitterKeyDown}
                        onDoubleClick={resetSplit}
                        className={cn(
                            'scd-overview-splitter flex flex-shrink-0 items-center justify-center group relative',
                            'rounded-full transition-colors',
                            'focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400',
                            // Right mode hides the splitter on sub-xl
                            // widths because the layout collapses to a
                            // single column there. Vertical modes
                            // never collapse, so the splitter is
                            // always visible in those.
                            mapPosition === 'right' && 'hidden xl:flex',
                            isVerticalSplit
                                ? 'h-1.5 my-0.5 w-full cursor-row-resize'
                                : 'w-1.5 mx-0.5 cursor-col-resize',
                            dragging
                                ? 'bg-sky-500'
                                : 'bg-slate-200 dark:bg-slate-700 hover:bg-sky-400 dark:hover:bg-sky-500'
                        )}
                        data-map-position={mapPosition}
                    >
                        {/* Visible grip dots — three subtle dashes,
                            oriented perpendicular to the drag axis so
                            they read as a grip handle. Helps signal
                            the handle is interactive at a glance. */}
                        <span
                            aria-hidden="true"
                            className={cn(
                                'flex gap-0.5 opacity-50 transition-opacity',
                                isVerticalSplit ? 'flex-row' : 'flex-col',
                                dragging ? 'opacity-100' : 'group-hover:opacity-90'
                            )}
                        >
                            <span
                                className={cn(
                                    'block rounded-full bg-white',
                                    isVerticalSplit ? 'h-0.5 w-1' : 'w-0.5 h-1'
                                )}
                            />
                            <span
                                className={cn(
                                    'block rounded-full bg-white',
                                    isVerticalSplit ? 'h-0.5 w-1' : 'w-0.5 h-1'
                                )}
                            />
                            <span
                                className={cn(
                                    'block rounded-full bg-white',
                                    isVerticalSplit ? 'h-0.5 w-1' : 'w-0.5 h-1'
                                )}
                            />
                        </span>
                    </button>

                    {/* Map column.
                        right mode: width is the complement of leftPct
                        on xl+, full width below xl. below/above modes:
                        full width, height is the complement of leftPct
                        because the tiles column carries an explicit
                        flex-basis of leftPct% and the map fills the
                        remainder via flex-1. Both columns set min-w-0
                        so a long word in a metric label or a wide map
                        tile can't blow the column wider than its
                        share. */}
                    <div
                        className={cn(
                            'scd-overview-map flex flex-col min-h-0 min-w-0 w-full',
                            mapPosition === 'right' ? 'xl:flex-1' : 'flex-1'
                        )}
                        data-map-position={mapPosition}
                        style={verticalMapStyle}
                    >
                        <div className="flex-1 min-h-0 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-3 shadow-sm flex flex-col overflow-hidden">
                            <div className="flex items-center justify-between mb-2 flex-shrink-0">
                                <div>
                                    <h3 className="text-base font-bold text-sky-900 dark:text-sky-200 uppercase tracking-wide leading-none">
                                        {topologyHeaderName}
                                    </h3>
                                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">
                                        {topologyHeaderSubtitle}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <MapPositionToggle
                                        value={mapPosition}
                                        onChange={setMapPosition}
                                    />
                                    <RegionalViewToggle
                                        value={regionalView}
                                        onChange={setRegionalView}
                                    />
                                </div>
                            </div>

                            <div className="flex-1 min-h-0">
                                {regionalView === 'map' ? (
                                    /* Build 1190 — render the live map
                                       during export instead of swapping
                                       to TopologySiteTable. The Build
                                       1186 substitute approach was
                                       overcorrecting on the original
                                       export complaint: the operator
                                       wanted the *map with sites and
                                       connectivity lines* in the export,
                                       just without the broken-mid-frame
                                       SMIL animation artifacts. The
                                       SMIL pause in `useExportPage`
                                       (still active) freezes the
                                       stroke-dashoffset flow lines at a
                                       clean keyframe; html2canvas
                                       rasterises the underlying Leaflet
                                       tiles + the static SVG paths
                                       cleanly. The CSS animation freeze
                                       in `tailwind.css` covers any
                                       remaining keyframe-driven motion.
                                       The previous `data-export-hide` /
                                       `data-export-placeholder`
                                       attributes have been removed; the
                                       generic CSS rules that consume
                                       them are kept in `tailwind.css`
                                       so other components can opt in
                                       to the same swap pattern in the
                                       future. */
                                    <CustomerTopologyMap
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
                                    label={activeAlertsCard.label}
                                    value={activeAlertsCard.value}
                                    source={activeAlertsCard.source}
                                    accentClassName="bg-red-500"
                                    description={KPI_CONFIG[0].description}
                                    thresholdNote={KPI_CONFIG[0].thresholdNote}
                                    bindingFootnote={activeAlertsBindingFootnote}
                                    onOpenInSearch={
                                        activeAlertsDrilldownSpl
                                            ? handleActiveAlertsOpenInSearch
                                            : undefined
                                    }
                                    onConfigure={() =>
                                        openPicker(KPI_CONFIG[0].id, KPI_CONFIG[0].label, {
                                            savedSearch: KPI_CONFIG[0].savedSearch,
                                            valueField: KPI_CONFIG[0].valueField,
                                            // KPI cards ship without numeric
                                            // thresholds (string headlines), but
                                            // the picker form still renders so
                                            // the user can establish thresholds
                                            // if they swap to a numeric search.
                                            unit: undefined,
                                        })
                                    }
                                    isCustomized={Boolean(overrides[KPI_CONFIG[0].id])}
                                />
                                <KpiCard
                                    label={interSiteLatencyCard.label}
                                    value={interSiteLatencyCard.value}
                                    source={interSiteLatencyCard.source}
                                    accentClassName="bg-sky-500"
                                    description={KPI_CONFIG[1].description}
                                    thresholdNote={KPI_CONFIG[1].thresholdNote}
                                    bindingFootnote={interSiteLatencyBindingFootnote}
                                    onOpenInSearch={
                                        interSiteLatencyDrilldownSpl
                                            ? handleInterSiteLatencyOpenInSearch
                                            : undefined
                                    }
                                    onConfigure={() =>
                                        openPicker(KPI_CONFIG[1].id, KPI_CONFIG[1].label, {
                                            savedSearch: KPI_CONFIG[1].savedSearch,
                                            valueField: KPI_CONFIG[1].valueField,
                                            unit: undefined,
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
                Splunk Field Solutions - Executive Insights
            </footer>

            <HelpOverlay
                open={helpOpen}
                onClose={closeHelp}
                shortcuts={helpShortcutRows}
            />

            <KpiPickerPanel
                open={pickerContext !== null}
                context={pickerContext}
                onClose={closePicker}
                onApply={handlePickerApply}
                onApplyDisplayToSection={handleApplyDisplayToSection}
                drilldownBindings={searchbaseDrilldowns}
                onSetSearchDrilldown={handleSearchbaseDrilldownApply}
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

            <SignalTickerEditor
                open={signalTickerEditorOpen}
                config={signalTickerConfig}
                catalogue={searchbaseCatalogue}
                metricDefaultsBySearchName={signalTickerMetricDefaults}
                catalogueLoading={visibleSearchbaseCatalogue === null}
                includeHiddenSearches={signalTickerIncludeHiddenSearches}
                onIncludeHiddenSearchesChange={setSignalTickerIncludeHiddenSearches}
                onChange={setSignalTickerConfig}
                onReset={resetSignalTickerConfig}
                onClose={() => setSignalTickerEditorOpen(false)}
            />

            {activeDetailTable && (
                <MetricDetailTableModal
                    config={activeDetailTable}
                    onClose={() => setActiveDetailTable(null)}
                    range={timeRange}
                    refreshToken={refreshToken}
                />
            )}

            <BrandingEditorModal
                isOpen={isBrandingEditorOpen}
                onClose={() => setBrandingEditorOpen(false)}
                override={brandingOverride}
                titlePlaceholder={customerName || DEFAULT_HEADER_TITLE_FALLBACK}
                subtitlePlaceholder={DEFAULT_HEADER_SUBTITLE}
                logoFallbackSrc={logoSrc}
                onSave={(next) => setBrandingOverride(next)}
                onResetToDefaults={() => {
                    resetBrandingOverride();
                    setBrandingEditorOpen(false);
                }}
            />

            <SectionTitlesEditorModal
                isOpen={isSectionTitlesEditorOpen}
                onClose={() => setSectionTitlesEditorOpen(false)}
                values={sectionTitles}
                defaults={DEFAULT_CUSTOMER_TOPOLOGY_SECTION_TITLES}
                visibleSections={visibleSections}
                availableSections={availableSections}
                maxSections={maxVisibleSections}
                onSave={async (next) => {
                    await saveSectionTitles(next);
                    setSectionTitlesEditorOpen(false);
                }}
                onResetToDefaults={async () => {
                    await saveSectionTitles(DEFAULT_CUSTOMER_TOPOLOGY_SECTION_TITLES);
                    setSectionTitlesEditorOpen(false);
                }}
                onLayoutChange={setVisibleSections}
                onResetLayout={resetAllSectionLayout}
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
     * Qualitative "what counts as good?" sentence rendered in the
     * THRESHOLDS section. The KPI cards in this column are string-
     * valued (site labels — top incident volume, operational lead),
     * so they have no numeric threshold; this note explains how to
     * read the value instead.
     */
    thresholdNote?: string;
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

// =============================================================================
// Metric detail-table modal
// =============================================================================

interface MetricDetailTableModalProps {
    config: MetricDetailTableConfig;
    onClose: () => void;
    range: TimeRange;
    refreshToken: number;
}

type MetricDetailSortDirection = 'asc' | 'desc';

interface MetricDetailSortState {
    field: string;
    direction: MetricDetailSortDirection;
}

const readRowString = (
    row: Record<string, unknown>,
    field: string,
    fallback = ''
): string => {
    const raw = row[field];
    if (raw === null || raw === undefined) return fallback;
    if (Array.isArray(raw)) return raw.map(String).join(', ');
    const text = String(raw).trim();
    if (text.toLowerCase() === 'null') return fallback;
    return text || fallback;
};

const EMPTY_SORT_VALUES = new Set([
    '',
    '-',
    'n/a',
    'na',
    'none',
    'null',
    'undefined',
    'no current sample',
]);

const DURATION_UNIT_TO_MS: Record<string, number> = {
    ms: 1,
    millisecond: 1,
    milliseconds: 1,
    s: 1000,
    sec: 1000,
    secs: 1000,
    second: 1000,
    seconds: 1000,
    m: 60_000,
    min: 60_000,
    mins: 60_000,
    minute: 60_000,
    minutes: 60_000,
    h: 3_600_000,
    hr: 3_600_000,
    hrs: 3_600_000,
    hour: 3_600_000,
    hours: 3_600_000,
    d: 86_400_000,
    day: 86_400_000,
    days: 86_400_000,
};

const isEmptySortValue = (value: string): boolean =>
    EMPTY_SORT_VALUES.has(value.trim().toLowerCase());

const parseSortableDetailNumber = (value: string): number | null => {
    const normalized = value.trim().toLowerCase().replace(/,/g, '');
    if (!normalized || isEmptySortValue(normalized)) return null;

    if (/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)\s*%?$/.test(normalized)) {
        return Number.parseFloat(normalized);
    }

    const durationMatch = normalized.match(
        /^([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*([a-z]+)(?:\s+ago)?$/
    );
    if (durationMatch) {
        const unit = durationMatch[2];
        const multiplier = DURATION_UNIT_TO_MS[unit];
        if (multiplier !== undefined) {
            return Number.parseFloat(durationMatch[1]) * multiplier;
        }
    }

    return null;
};

const compareDetailCellValues = (
    a: string,
    b: string,
    direction: MetricDetailSortDirection
): number => {
    const aEmpty = isEmptySortValue(a);
    const bEmpty = isEmptySortValue(b);
    if (aEmpty && bEmpty) return 0;
    if (aEmpty) return 1;
    if (bEmpty) return -1;

    const aNumber = parseSortableDetailNumber(a);
    const bNumber = parseSortableDetailNumber(b);
    const base =
        aNumber !== null && bNumber !== null
            ? aNumber - bNumber
            : a.localeCompare(b, undefined, {
                  numeric: true,
                  sensitivity: 'base',
              });
    return direction === 'asc' ? base : -base;
};

const MetricDetailTableModal: React.FC<MetricDetailTableModalProps> = ({
    config,
    onClose,
    range,
    refreshToken,
}) => {
    const [rows, setRows] = useState<Array<Record<string, string>>>([]);
    const [tableColumns, setTableColumns] =
        useState<MetricDetailTableColumn[]>(config.columns);
    const [loading, setLoading] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [sortState, setSortState] = useState<MetricDetailSortState | null>(null);

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            e.preventDefault();
            e.stopImmediatePropagation();
            onClose();
        };
        window.addEventListener('keydown', onKeyDown, true);
        return () => window.removeEventListener('keydown', onKeyDown, true);
    }, [onClose]);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setRows([]);
        setTableColumns(config.columns);
        setErrorMessage('');

        runSearch({
            spl: config.spl,
            earliestTime: range.earliest,
            latestTime: range.latest,
            tag: config.tag,
        })
            .then((res) => {
                if (cancelled) return;
                const rawRows = (res?.results ?? []) as Array<
                    Record<string, unknown>
                >;
                const columns =
                    config.columns.length > 0
                        ? config.columns
                        : inferDetailTableColumns(rawRows);
                const nextRows = rawRows.map((row) => {
                    const detailRow: Record<string, string> = {};
                    columns.forEach((column) => {
                        detailRow[column.field] = readRowString(
                            row,
                            column.field,
                            column.fallback ?? ''
                        );
                    });
                    return detailRow;
                });
                setTableColumns(columns);
                setRows(nextRows);
            })
            .catch(() => {
                if (!cancelled) {
                    setRows([]);
                    setTableColumns(config.columns);
                    setErrorMessage(config.errorMessage);
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [config, range.earliest, range.latest, refreshToken]);

    const availableStatus = config.availableStatus ?? 'Available';
    const unavailableStatus = config.unavailableStatus ?? 'Unavailable';
    const titleId = `${config.tag}-title`;
    const statusField = config.statusField;
    const displayColumns = tableColumns.length > 0 ? tableColumns : config.columns;
    const columnCount = Math.max(displayColumns.length, 1);
    const sortedRows = useMemo(() => {
        if (!sortState) return rows;
        const columnExists = displayColumns.some(
            (column) => column.field === sortState.field
        );
        if (!columnExists) return rows;
        return rows
            .map((row, index) => ({ row, index }))
            .sort((a, b) => {
                const result = compareDetailCellValues(
                    a.row[sortState.field] ?? '',
                    b.row[sortState.field] ?? '',
                    sortState.direction
                );
                return result || a.index - b.index;
            })
            .map(({ row }) => row);
    }, [displayColumns, rows, sortState]);
    const handleSortColumn = (field: string) => {
        setSortState((current) => {
            if (current?.field === field) {
                return {
                    field,
                    direction: current.direction === 'asc' ? 'desc' : 'asc',
                };
            }
            return { field, direction: 'asc' };
        });
    };
    const availableCount = statusField
        ? rows.filter((row) => row[statusField] === availableStatus).length
        : 0;
    const unavailableCount = statusField ? rows.length - availableCount : 0;
    const searchUrl = splunkSearchAppUrl(config.spl, range);

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="fixed inset-0 z-[1900] flex items-center justify-center p-4"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
                onClick={onClose}
            />
            <div className="relative w-full max-w-6xl max-h-[88vh] overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 shadow-2xl">
                <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-200 dark:border-slate-800">
                    <div>
                        <div className="flex items-center gap-2">
                            <Table2 className="w-4 h-4 text-sky-600 dark:text-sky-300" />
                            <h2
                                id={titleId}
                                className="text-base font-bold text-slate-900 dark:text-slate-100"
                            >
                                {config.title}
                            </h2>
                        </div>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            {config.subtitle(range)}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {statusField && (
                            <div className="hidden sm:flex items-center gap-2 text-xs font-semibold">
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 px-2 py-1 text-emerald-700 dark:text-emerald-300">
                                    <CheckCircle2 className="w-3 h-3" />
                                    {availableCount} available
                                </span>
                                <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 dark:bg-rose-950/50 px-2 py-1 text-rose-700 dark:text-rose-300">
                                    <AlertCircle className="w-3 h-3" />
                                    {unavailableCount} unavailable
                                </span>
                            </div>
                        )}
                        <a
                            href={searchUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`Open ${config.title} in Search`}
                            aria-label={`Open ${config.title} in Search`}
                            className="inline-flex items-center gap-1.5 rounded border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-sky-700 dark:hover:text-sky-200 hover:border-sky-300 dark:hover:border-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/40 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-400"
                        >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Open in Search</span>
                        </a>
                        <button
                            type="button"
                            onClick={onClose}
                            title="Close"
                            aria-label={`Close ${config.title}`}
                            className="p-1.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-400"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div className="overflow-auto max-h-[calc(88vh-90px)]">
                    <table className="w-full min-w-[860px] text-sm">
                        <thead className="sticky top-0 z-10 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
                            <tr className="text-left text-xs font-bold text-slate-500 dark:text-slate-400">
                                {displayColumns.map((column, index) => {
                                    const isSorted = sortState?.field === column.field;
                                    const SortIcon = isSorted
                                        ? sortState.direction === 'asc'
                                            ? ArrowUp
                                            : ArrowDown
                                        : ArrowUpDown;
                                    return (
                                        <th
                                            key={column.field}
                                            scope="col"
                                            aria-sort={
                                                isSorted
                                                    ? sortState.direction === 'asc'
                                                        ? 'ascending'
                                                        : 'descending'
                                                    : 'none'
                                            }
                                            className={cn(
                                                index === 0 ? 'px-5' : 'px-4',
                                                'py-3',
                                                column.align === 'right' && 'text-right'
                                            )}
                                        >
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    handleSortColumn(column.field)
                                                }
                                                title={`Sort by ${column.label}`}
                                                className={cn(
                                                    'group inline-flex w-full items-center gap-1.5 rounded px-1 py-0.5 -mx-1 text-left transition-colors hover:text-sky-600 dark:hover:text-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-400',
                                                    column.align === 'right'
                                                        ? 'justify-end'
                                                        : 'justify-start',
                                                    isSorted &&
                                                        'text-sky-600 dark:text-sky-300'
                                                )}
                                            >
                                                <span>{column.label}</span>
                                                <SortIcon
                                                    className={cn(
                                                        'h-3 w-3 flex-shrink-0',
                                                        isSorted
                                                            ? 'opacity-100'
                                                            : 'opacity-35 group-hover:opacity-80'
                                                    )}
                                                    aria-hidden="true"
                                                />
                                            </button>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {loading ? (
                                <tr>
                                    <td
                                        colSpan={columnCount}
                                        className="px-5 py-10 text-center text-sm text-slate-500 dark:text-slate-400"
                                    >
                                        Loading {config.title.toLowerCase()}...
                                    </td>
                                </tr>
                            ) : errorMessage ? (
                                <tr>
                                    <td
                                        colSpan={columnCount}
                                        className="px-5 py-10 text-center text-sm text-rose-600 dark:text-rose-300"
                                    >
                                        {errorMessage}
                                    </td>
                                </tr>
                            ) : rows.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={columnCount}
                                        className="px-5 py-10 text-center text-sm text-slate-500 dark:text-slate-400"
                                    >
                                        {config.emptyMessage}
                                    </td>
                                </tr>
                            ) : (
                                sortedRows.map((row, rowIndex) => {
                                    const rowStatus = statusField
                                        ? row[statusField]
                                        : '';
                                    const rowIsAvailable =
                                        rowStatus === availableStatus;
                                    const rowKey =
                                        (config.rowKeyField &&
                                            row[config.rowKeyField]) ||
                                        displayColumns
                                            .map((column) => row[column.field])
                                            .join('|') ||
                                        'detail-row';
                                    return (
                                        <tr
                                            key={`${rowKey}-${rowIndex}`}
                                            className="hover:bg-slate-50 dark:hover:bg-slate-900/70 transition-colors"
                                        >
                                            {displayColumns.map((column, index) => {
                                                const value = row[column.field];
                                                const isStatusColumn =
                                                    column.kind === 'status';
                                                const statusIsAvailable =
                                                    value === availableStatus;
                                                const statusIsUnavailable =
                                                    value === unavailableStatus;
                                                return (
                                                    <td
                                                        key={column.field}
                                                        className={cn(
                                                            index === 0
                                                                ? 'px-5 font-medium text-slate-900 dark:text-slate-100'
                                                                : 'px-4 text-slate-600 dark:text-slate-300',
                                                            'py-3',
                                                            column.align === 'right' &&
                                                                'text-right tabular-nums',
                                                            column.truncate &&
                                                                'max-w-xs truncate',
                                                            column.kind === 'metric' &&
                                                                statusField &&
                                                                (rowIsAvailable
                                                                    ? 'font-medium text-emerald-600 dark:text-emerald-300'
                                                                    : 'font-medium text-rose-600 dark:text-rose-300')
                                                        )}
                                                    >
                                                        {isStatusColumn ? (
                                                            <span
                                                                className={cn(
                                                                    'inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold',
                                                                    statusIsAvailable
                                                                        ? 'bg-emerald-600 text-white'
                                                                        : statusIsUnavailable
                                                                          ? 'bg-rose-600 text-white'
                                                                          : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                                                                )}
                                                            >
                                                                {statusIsAvailable ? (
                                                                    <CheckCircle2 className="w-3 h-3" />
                                                                ) : (
                                                                    <AlertCircle className="w-3 h-3" />
                                                                )}
                                                                {value}
                                                            </span>
                                                        ) : (
                                                            value
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// =============================================================================
// Section title editor
// =============================================================================

interface SectionTitlesEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    values: CustomerTopologySectionTitles;
    defaults: CustomerTopologySectionTitles;
    visibleSections: SectionId[];
    availableSections: readonly SectionId[];
    maxSections: number;
    onSave: (next: CustomerTopologySectionTitles) => Promise<void>;
    onResetToDefaults: () => Promise<void>;
    onLayoutChange: (next: SectionId[]) => void;
    onResetLayout: () => void;
}

const SectionTitlesEditorModal: React.FC<SectionTitlesEditorModalProps> = ({
    isOpen,
    onClose,
    values,
    defaults,
    visibleSections,
    availableSections,
    maxSections,
    onSave,
    onResetToDefaults,
    onLayoutChange,
    onResetLayout,
}) => {
    const [draft, setDraft] =
        useState<CustomerTopologySectionTitles>(values);
    const [layoutDraft, setLayoutDraft] =
        useState<SectionId[]>(visibleSections);
    const [isSaving, setIsSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        setDraft(values);
        setLayoutDraft(visibleSections);
        setErrorMessage('');
        setIsSaving(false);
    }, [isOpen, values, visibleSections]);

    useEffect(() => {
        if (!isOpen) return undefined;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !isSaving) onClose();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isOpen, isSaving, onClose]);

    if (!isOpen) return null;

    const setTitle = (key: SectionId, value: string) => {
        setDraft((current) => ({
            ...current,
            [key]: value,
        }));
    };

    const activeSet = new Set(layoutDraft);
    const hiddenSections = availableSections.filter((section) => !activeSet.has(section));
    const canAddSection = layoutDraft.length < maxSections && hiddenSections.length > 0;

    const addSection = () => {
        if (!canAddSection) return;
        setLayoutDraft((current) => {
            const next = availableSections.find((section) => !current.includes(section));
            if (!next) return current;
            return [...current, next].slice(0, maxSections);
        });
    };

    const showSection = (section: SectionId) => {
        setLayoutDraft((current) => {
            if (current.includes(section) || current.length >= maxSections) return current;
            return [...current, section];
        });
    };

    const hideSection = (section: SectionId) => {
        setLayoutDraft((current) => {
            if (!current.includes(section) || current.length <= 1) return current;
            return current.filter((candidate) => candidate !== section);
        });
    };

    const save = async () => {
        setIsSaving(true);
        setErrorMessage('');
        try {
            await onSave({
                it_health: draft.it_health.trim() || defaults.it_health,
                security: draft.security.trim() || defaults.security,
                building: draft.building.trim() || defaults.building,
                custom: draft.custom.trim() || defaults.custom,
            });
            onLayoutChange(layoutDraft);
        } catch (err) {
            setErrorMessage(err instanceof Error ? err.message : String(err));
            setIsSaving(false);
        }
    };

    const reset = async () => {
        setIsSaving(true);
        setErrorMessage('');
        try {
            await onResetToDefaults();
            onResetLayout();
        } catch (err) {
            setErrorMessage(err instanceof Error ? err.message : String(err));
            setIsSaving(false);
        }
    };

    const inputClass =
        'w-full px-2 py-1.5 text-sm bg-white dark:bg-slate-800 border ' +
        'border-slate-300 dark:border-slate-600 rounded text-slate-900 ' +
        'dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 ' +
        'focus:outline-none focus:ring-1 focus:ring-sky-400';
    const labelClass =
        'block text-[10px] font-bold text-slate-600 dark:text-slate-400 ' +
        'uppercase tracking-wider mb-1';

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="section-titles-editor-title"
            className="fixed inset-0 z-[60] flex items-center justify-center"
            onClick={(e) => {
                if (!isSaving && e.target === e.currentTarget) onClose();
            }}
        >
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl w-full max-w-2xl mx-4">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                    <h2
                        id="section-titles-editor-title"
                        className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider"
                    >
                        Edit sections
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSaving}
                        title="Close"
                        aria-label="Close"
                        className={cn(
                            'p-1 rounded text-slate-400 hover:text-slate-600',
                            'dark:hover:text-slate-300 hover:bg-slate-100',
                            'dark:hover:bg-slate-800 transition-colors',
                            isSaving && 'cursor-not-allowed opacity-50'
                        )}
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="px-4 py-4 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                            {layoutDraft.length} of {maxSections} visible
                        </div>
                        <button
                            type="button"
                            onClick={addSection}
                            disabled={!canAddSection || isSaving}
                            className={cn(
                                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded',
                                'border border-sky-200 bg-sky-50 text-xs font-bold',
                                'text-sky-700 hover:bg-sky-100 dark:border-sky-900/60',
                                'dark:bg-sky-950/40 dark:text-sky-200',
                                (!canAddSection || isSaving) &&
                                    'cursor-not-allowed opacity-50'
                            )}
                        >
                            <Plus className="w-3.5 h-3.5" />
                            Add section
                        </button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        {availableSections.map((section, idx) => {
                            const isVisible = activeSet.has(section);
                            const canShow = !isVisible && layoutDraft.length < maxSections;
                            const canHide = isVisible && layoutDraft.length > 1;
                            return (
                                <div
                                    key={section}
                                    className={cn(
                                        'rounded-lg border p-3 transition-colors',
                                        isVisible
                                            ? 'border-sky-200 bg-sky-50/60 dark:border-sky-900/60 dark:bg-sky-950/20'
                                            : 'border-slate-200 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-800/40'
                                    )}
                                >
                                    <div className="mb-2 flex items-center justify-between gap-2">
                                        <label
                                            htmlFor={`section-title-${section}`}
                                            className={cn(labelClass, 'mb-0')}
                                        >
                                            Section {idx + 1}
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                isVisible
                                                    ? hideSection(section)
                                                    : showSection(section)
                                            }
                                            disabled={
                                                isSaving ||
                                                (isVisible ? !canHide : !canShow)
                                            }
                                            title={
                                                isVisible
                                                    ? 'Hide section'
                                                    : 'Show section'
                                            }
                                            aria-label={
                                                isVisible
                                                    ? `Hide ${draft[section] || defaults[section]}`
                                                    : `Show ${draft[section] || defaults[section]}`
                                            }
                                            className={cn(
                                                'inline-flex h-8 items-center gap-1.5 rounded px-2',
                                                'text-xs font-bold transition-colors',
                                                isVisible
                                                    ? 'bg-white text-slate-600 hover:text-slate-900 dark:bg-slate-900 dark:text-slate-300'
                                                    : 'bg-sky-600 text-white hover:bg-sky-500',
                                                (isSaving ||
                                                    (isVisible ? !canHide : !canShow)) &&
                                                    'cursor-not-allowed opacity-50'
                                            )}
                                        >
                                            {isVisible ? (
                                                <EyeOff className="h-3.5 w-3.5" />
                                            ) : (
                                                <Eye className="h-3.5 w-3.5" />
                                            )}
                                            {isVisible ? 'Hide' : 'Show'}
                                        </button>
                                    </div>
                                    <input
                                        id={`section-title-${section}`}
                                        type="text"
                                        value={draft[section]}
                                        onChange={(e) => setTitle(section, e.target.value)}
                                        placeholder={defaults[section]}
                                        maxLength={48}
                                        className={inputClass}
                                    />
                                </div>
                            );
                        })}
                    </div>

                    {errorMessage && (
                        <div className="flex items-start gap-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
                            <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                            <span className="min-w-0 break-words">{errorMessage}</span>
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-slate-200 dark:border-slate-700">
                    <button
                        type="button"
                        onClick={reset}
                        disabled={isSaving}
                        className={cn(
                            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded border',
                            'border-slate-300 dark:border-slate-600 text-xs font-bold',
                            'text-slate-700 dark:text-slate-200 hover:bg-slate-50',
                            'dark:hover:bg-slate-800 transition-colors',
                            isSaving && 'cursor-not-allowed opacity-50'
                        )}
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Reset
                    </button>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSaving}
                            className={cn(
                                'px-3 py-1.5 rounded border border-slate-300',
                                'dark:border-slate-600 text-xs font-bold text-slate-700',
                                'dark:text-slate-200 hover:bg-slate-50',
                                'dark:hover:bg-slate-800 transition-colors',
                                isSaving && 'cursor-not-allowed opacity-50'
                            )}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={save}
                            disabled={isSaving}
                            className={cn(
                                'inline-flex items-center gap-1.5 px-3 py-1.5',
                                'rounded bg-sky-600 text-xs font-bold text-white',
                                'hover:bg-sky-500 transition-colors',
                                isSaving && 'cursor-not-allowed opacity-60'
                            )}
                        >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Save
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// =============================================================================
// Branding editor (header pencil → "Edit branding" modal)
// =============================================================================

interface BrandingEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    override: BrandingOverride;
    /** Placeholder text shown in the title input when no override is set.
     * Falls back through `customerName` (macro) → hardcoded fallback,
     * matching the precedence rules in the live header. */
    titlePlaceholder: string;
    /** Placeholder text for the subtitle input. Always the
     * out-of-the-box default ("Splunk Executive Insights"). */
    subtitlePlaceholder: string;
    /** Image src to display in the "current logo" preview when no
     * override logo is set. Lets the user see what they're replacing. */
    logoFallbackSrc: string;
    onSave: (next: BrandingOverride) => boolean;
    onResetToDefaults: () => void;
}

/**
 * Centered modal for editing the per-user header branding override
 * (title, subtitle, logo). Title and subtitle are plain text inputs;
 * the logo is a file upload that's encoded to a `data:` URI and
 * stored in localStorage by the parent's `useBrandingOverride` hook.
 *
 * Behaviour notes:
 *  - "Save" persists whatever's in the form fields. Empty strings
 *    are treated as "use the default" — the hook strips them so
 *    the live header re-derives from the macro / hardcoded
 *    constants. Returning `false` from `onSave` (e.g. logo too big)
 *    keeps the modal open with an inline error.
 *  - "Reset to defaults" wipes the override entirely (storage key
 *    removed) and closes the modal.
 *  - "Cancel" / Esc / backdrop click discards local form changes.
 *  - The file input rejects anything outside the accepted MIME
 *    list, and the FileReader path enforces a 256 KiB cap on the
 *    encoded data URI (~190 KiB binary).
 */
const BrandingEditorModal: React.FC<BrandingEditorModalProps> = ({
    isOpen,
    onClose,
    override,
    titlePlaceholder,
    subtitlePlaceholder,
    logoFallbackSrc,
    onSave,
    onResetToDefaults,
}) => {
    // Form state — initialised from the persisted override every time
    // the modal opens so reopening after a Cancel doesn't show stale
    // values. The `key` is a `useEffect` re-init pattern (sync external
    // → internal) rather than a `key={isOpen}` remount, so we keep a
    // single instance and avoid reinitialising the file input.
    const [titleField, setTitleField] = useState<string>(override.title ?? '');
    const [subtitleField, setSubtitleField] = useState<string>(override.subtitle ?? '');
    const [logoDataUri, setLogoDataUri] = useState<string | undefined>(
        override.logoDataUri
    );
    const [errorMessage, setErrorMessage] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // Re-sync the form when the modal is (re)opened — picks up any
    // override mutations from another tab while the modal was closed,
    // and discards prior unsaved typing if the user re-opens.
    useEffect(() => {
        if (!isOpen) return;
        setTitleField(override.title ?? '');
        setSubtitleField(override.subtitle ?? '');
        setLogoDataUri(override.logoDataUri);
        setErrorMessage('');
    }, [isOpen, override]);

    // Esc-to-close. Listen on the window because focus moves around as
    // the user tabs through the form fields.
    useEffect(() => {
        if (!isOpen) return undefined;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        setErrorMessage('');
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const dataUri = await readImageAsDataUri(file);
            if (dataUri.length > BRANDING_LOGO_DATA_URI_MAX_BYTES) {
                const kb = Math.round(BRANDING_LOGO_DATA_URI_MAX_BYTES / 1024);
                setErrorMessage(
                    `Logo too large after encoding (${Math.round(
                        dataUri.length / 1024
                    )} KB). Maximum allowed is ${kb} KB. Please upload a smaller image.`
                );
                if (fileInputRef.current) fileInputRef.current.value = '';
                return;
            }
            setLogoDataUri(dataUri);
        } catch (err) {
            setErrorMessage(
                err instanceof Error
                    ? err.message
                    : 'Failed to read image. Please pick a different file.'
            );
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleClearLogo = () => {
        setLogoDataUri(undefined);
        setErrorMessage('');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleSave = () => {
        const next: BrandingOverride = {
            title: titleField.trim() || undefined,
            subtitle: subtitleField.trim() || undefined,
            logoDataUri,
        };
        const ok = onSave(next);
        if (!ok) {
            setErrorMessage(
                'Could not save branding (logo may exceed the size limit). Please try a smaller image.'
            );
            return;
        }
        onClose();
    };

    const previewLogoSrc = logoDataUri || logoFallbackSrc;
    const acceptList = BRANDING_ACCEPTED_LOGO_MIME_TYPES.join(',');

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="branding-editor-title"
            className="fixed inset-0 z-[60] flex items-center justify-center"
            onClick={(e) => {
                // Close only when the user clicks the backdrop itself,
                // not when their drag started inside an input and ended
                // on the backdrop. The shallow `e.target === e.currentTarget`
                // check is the standard React idiom.
                if (e.target === e.currentTarget) onClose();
            }}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />

            {/* Card */}
            <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                    <h2
                        id="branding-editor-title"
                        className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider"
                    >
                        Edit branding
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        title="Close"
                        aria-label="Close"
                        className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="px-4 py-4 space-y-4">
                    {/* Title */}
                    <div>
                        <label
                            htmlFor="branding-title-input"
                            className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1"
                        >
                            Title
                        </label>
                        <input
                            id="branding-title-input"
                            type="text"
                            value={titleField}
                            onChange={(e) => setTitleField(e.target.value)}
                            placeholder={titlePlaceholder}
                            maxLength={120}
                            className="w-full px-2 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-400"
                        />
                        <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-500">
                            Leave blank to use the value from the
                            <code className="mx-1 px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">
                                [customer_name]
                            </code>
                            macro.
                        </p>
                    </div>

                    {/* Subtitle */}
                    <div>
                        <label
                            htmlFor="branding-subtitle-input"
                            className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1"
                        >
                            Subtitle
                        </label>
                        <input
                            id="branding-subtitle-input"
                            type="text"
                            value={subtitleField}
                            onChange={(e) => setSubtitleField(e.target.value)}
                            placeholder={subtitlePlaceholder}
                            maxLength={120}
                            className="w-full px-2 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-400"
                        />
                        <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-500">
                            Leave blank for the default
                            (&ldquo;{subtitlePlaceholder}&rdquo;).
                        </p>
                    </div>

                    {/* Logo */}
                    <div>
                        <span className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                            Logo
                        </span>
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-sky-600 rounded-lg flex items-center justify-center text-white overflow-hidden p-1 flex-shrink-0">
                                <img
                                    src={previewLogoSrc}
                                    alt="Logo preview"
                                    className="w-full h-full object-contain"
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="inline-flex items-center gap-1.5 px-2 py-1 text-[11px] font-bold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-900/30 hover:bg-sky-100 dark:hover:bg-sky-900/50 rounded transition-colors"
                                >
                                    <Upload className="w-3 h-3" />
                                    {logoDataUri ? 'Replace logo' : 'Upload logo'}
                                </button>
                                {logoDataUri ? (
                                    <button
                                        type="button"
                                        onClick={handleClearLogo}
                                        className="text-[10px] text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 underline"
                                    >
                                        Clear (use default)
                                    </button>
                                ) : null}
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept={acceptList}
                                    onChange={handleLogoUpload}
                                    className="hidden"
                                />
                            </div>
                        </div>
                        <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-500">
                            PNG, SVG, JPEG, WebP, or GIF. Max{' '}
                            {Math.round(BRANDING_LOGO_DATA_URI_MAX_BYTES / 1024)} KB after
                            encoding. Stored in your browser only.
                        </p>
                    </div>

                    {errorMessage ? (
                        <div
                            role="alert"
                            className="text-[11px] text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 rounded px-2 py-1.5"
                        >
                            {errorMessage}
                        </div>
                    ) : null}
                </div>

                <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                    <button
                        type="button"
                        onClick={onResetToDefaults}
                        className="text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-300 underline"
                    >
                        Reset to defaults
                    </button>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-3 py-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            className="px-3 py-1.5 text-[11px] font-bold text-white bg-sky-600 hover:bg-sky-700 rounded transition-colors"
                        >
                            Save
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Map position relative to the metric tile column. Persisted to
// `scd_overview_map_pos` in localStorage; cleared by the factory reset.
// See the splitter / map-position useState block in the Overview page
// for the wiring and the rationale on defaulting to `right` (Build 83).
type MapPosition = 'right' | 'below' | 'above';

interface MapPositionToggleProps {
    value: MapPosition;
    onChange: (next: MapPosition) => void;
}

// Three-segment selector for the topology map's placement, rendered
// in the map card header next to the MAP/TABLE toggle. Each segment
// is an icon-only button (PanelBottom / PanelRight / PanelTop) with a
// title tooltip so the meaning stays clear at icon-only widths. The
// styling mirrors `RegionalViewToggle` for visual parity in the
// header.
const MapPositionToggle: React.FC<MapPositionToggleProps> = ({ value, onChange }) => {
    const baseClass =
        'p-1 transition-colors rounded focus:outline-none focus:ring-1 focus:ring-sky-400';
    const activeClass =
        'bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 text-sky-600 dark:text-sky-300';
    const inactiveClass =
        'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300';
    const options: Array<{
        id: MapPosition;
        icon: React.ReactNode;
        label: string;
    }> = [
        { id: 'below', icon: <PanelBottom className="w-3.5 h-3.5" />, label: 'Map below tiles' },
        { id: 'right', icon: <PanelRight className="w-3.5 h-3.5" />, label: 'Map on the right' },
        { id: 'above', icon: <PanelTop className="w-3.5 h-3.5" />, label: 'Map above tiles' },
    ];
    return (
        <div
            role="tablist"
            aria-label="Map position"
            className="flex bg-slate-100 dark:bg-slate-800/60 p-1 rounded-md"
        >
            {options.map((opt) => (
                <button
                    key={opt.id}
                    type="button"
                    role="tab"
                    aria-selected={value === opt.id}
                    aria-label={opt.label}
                    title={opt.label}
                    onClick={() => onChange(opt.id)}
                    className={cn(
                        baseClass,
                        value === opt.id ? activeClass : inactiveClass
                    )}
                >
                    {opt.icon}
                </button>
            ))}
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
    thresholdNote,
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
                    thresholdNote={thresholdNote}
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
                    title="Open in Search"
                    aria-label={`Open ${label} in Search`}
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
