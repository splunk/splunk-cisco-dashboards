import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import Button from '@splunk/react-ui/Button';
import Modal from '@splunk/react-ui/Modal';
import Select from '@splunk/react-ui/Select';
import Text from '@splunk/react-ui/Text';
import {
    Activity,
    AlertTriangle,
    Bell,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    CircleDot,
    Cloud,
    ExternalLink,
    Filter,
    Globe2,
    Info,
    Minus,
    Network,
    PanelRightClose,
    PanelRightOpen,
    RefreshCw,
    Search,
    Server,
    Shield,
    ShieldAlert,
    TrendingDown,
    TrendingUp,
    UserRoundSearch,
    Wifi,
    X,
    type SuiIcon,
} from '@/common/icons/SuiIcon';
import {
    MapContainer,
    Marker,
    TileLayer,
    Tooltip as MapTooltip,
    ZoomControl,
    useMap,
} from 'react-leaflet';
import L from 'leaflet';
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Line,
    LineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';

import type { SearchbaseRecord } from '@/common/services/searchbaseCatalogue';
import { splunkSearchAppUrl } from '@/common/lib/splunkSearchUrl';
import { C3_SERIES_PALETTE } from '@/common/theme/c3VisualizationPalette';
import {
    asNumber,
    formatNumber,
    getLabelKey,
    getNumericKeys,
    getScalarValue,
    sanitizeSearchValue,
    sanitizeWildcardSearchValue,
    type SearchRow,
    useFilteredRows,
    useSearchbaseCatalogueMap,
    useSearchbaseRows,
} from './search';

const VIEW_NAME = 'secops_overview';

type TabId =
    | 'overview'
    | 'identity'
    | 'firewall'
    | 'network'
    | 'investigation';
type FilterKey =
    | 'location'
    | 'user'
    | 'threatType'
    | 'source'
    | 'severity'
    | 'host';
type Filters = Record<FilterKey, string>;
type ChartKind = 'line' | 'area' | 'bar' | 'pie';
type Tone = 'default' | 'good' | 'warning' | 'critical' | 'info';
type StatusTone = 'good' | 'warning' | 'critical' | 'info' | 'neutral';
type TrendDirection = 'up' | 'down' | 'flat';
type SiteMapStyle = 'terrain' | 'street' | 'satellite';

interface PageContext {
    catalogue: Map<string, SearchbaseRecord> | null;
    earliest: string;
    refreshToken: number;
    filters: Filters;
    showSearchInfo: (record: SearchbaseRecord) => void;
}

interface SearchPanelProps {
    context: PageContext;
    searchId: string;
    title: string;
    subtitle?: string;
    chartKind?: ChartKind;
    className?: string;
    useGlobalFilters?: boolean;
}

interface SearchMetricProps {
    context: PageContext;
    searchId: string;
    label: string;
    preferredFields?: string[];
    suffix?: string;
    tone?: Tone;
    icon?: SuiIcon;
}

interface SearchTableProps {
    context: PageContext;
    searchId: string;
    title: string;
    subtitle?: string;
    className?: string;
    maxRows?: number;
    useGlobalFilters?: boolean;
    transformSearch?: (spl: string) => string;
}

const TABS: Array<{ id: TabId; label: string; icon: SuiIcon }> = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'identity', label: 'Identity & Access', icon: Shield },
    { id: 'firewall', label: 'Firewall & Threats', icon: ShieldAlert },
    { id: 'network', label: 'Network Health', icon: Network },
    { id: 'investigation', label: 'User Investigation', icon: UserRoundSearch },
];

const TIME_RANGES = [
    { label: 'Last 24 hours', value: '-24h' },
    { label: 'Last 7 days', value: '-7d@d' },
    { label: 'Last 30 days', value: '-30d@d' },
    { label: 'Today', value: '@d' },
];

const DEFAULT_FILTERS: Filters = {
    location: 'All Regions',
    user: 'Any',
    threatType: 'All',
    source: 'All',
    severity: 'All',
    host: 'Any',
};

const FILTER_LABELS: Record<FilterKey, string> = {
    location: 'Location',
    user: 'User',
    threatType: 'Threat Type',
    source: 'Source',
    severity: 'Severity',
    host: 'Host',
};

const FILTER_OPTIONS: Record<FilterKey, string[]> = {
    location: ['All Regions', 'AMER', 'EMEAR', 'APJC'],
    user: ['Any', 'admin', 'jsmith', 'jdoe'],
    threatType: ['All', 'Firewall', 'DNS', 'ZTNA', 'Authentication'],
    source: ['All', 'FMC', 'ISE', 'Meraki', 'SD-WAN', 'ThousandEyes'],
    severity: ['All', 'critical', 'high', 'medium', 'low'],
    host: ['Any'],
};

const CHART_COLORS = C3_SERIES_PALETTE;

const titleFromPath = (): string => {
    if (typeof window === 'undefined') return VIEW_NAME;
    return window.location.pathname.split('/').pop() || VIEW_NAME;
};

const compactLabel = (value: unknown): string => {
    const text = String(value ?? 'Unknown');
    if (text.length <= 22) return text;
    return `${text.slice(0, 20)}…`;
};

const getColumns = (rows: SearchRow[]): string[] => {
    const keys = new Set<string>();
    rows.slice(0, 12).forEach((row) => {
        Object.keys(row).forEach((key) => {
            if (!key.startsWith('_') || key === '_time') keys.add(key);
        });
    });
    return [...keys].slice(0, 7);
};

const displayCell = (value: unknown): string => {
    if (Array.isArray(value)) return value.join(', ');
    if (value === null || value === undefined || value === '') return '—';
    return String(value);
};

const MACHINE_LABEL_ACRONYMS = new Set([
    'ACL',
    'API',
    'APP',
    'BGP',
    'CDN',
    'DNS',
    'EPG',
    'FMC',
    'ISE',
    'IP',
    'L3OUT',
    'SDWAN',
    'SGT',
    'URL',
    'VLAN',
]);

const humanizeMachineLabel = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === '—') return trimmed;
    if (
        /^(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?$/.test(trimmed) ||
        /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ||
        /^\d{4}-\d{2}-\d{2}T/.test(trimmed)
    ) {
        return trimmed;
    }
    const separatorCount = (trimmed.match(/[_-]/g) ?? []).length;
    const looksMachineGenerated =
        !/\s/.test(trimmed) &&
        (separatorCount >= 2 ||
            (trimmed.length > 34 && /^[a-z0-9_.:-]+$/i.test(trimmed)));
    if (!looksMachineGenerated) return trimmed;

    return trimmed
        .split(/[_-]+/)
        .filter(Boolean)
        .map((word) => {
            const upper = word.toUpperCase();
            if (upper === 'SDWAN') return 'SD-WAN';
            if (MACHINE_LABEL_ACRONYMS.has(upper)) return upper;
            return `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`;
        })
        .join(' ');
};

const humanizeColumnLabel = (value: string): string =>
    value
        .replace(/^_/, '')
        .replace(/[_.-]+/g, ' ')
        .split(/\s+/)
        .filter(Boolean)
        .map((word) => {
            const upper = word.toUpperCase();
            return MACHINE_LABEL_ACRONYMS.has(upper)
                ? upper === 'SDWAN'
                    ? 'SD-WAN'
                    : upper
                : `${word.charAt(0).toUpperCase()}${word.slice(1)}`;
        })
        .join(' ');

const statusToneForValue = (value: unknown): StatusTone => {
    const normalized = displayCell(value).toLowerCase();
    if (
        /critical|crit|blocked|block|denied|deny|failed|failure|poor|down|offline|fired/.test(
            normalized
        )
    ) {
        return 'critical';
    }
    if (/warning|warn|fair|degraded|attention|medium/.test(normalized)) {
        return 'warning';
    }
    if (
        /healthy|good|online|active|normal|allow|success|passed|pass|green/.test(
            normalized
        )
    ) {
        return 'good';
    }
    if (/info|informational|unknown|notable/.test(normalized)) return 'info';
    return 'neutral';
};

const StatusBadge = ({
    value,
    label,
    compact = false,
}: {
    value: unknown;
    label?: string;
    compact?: boolean;
}): JSX.Element => {
    const raw = displayCell(value);
    const display = label ?? humanizeMachineLabel(raw);
    const tone = statusToneForValue(`${raw} ${display}`);
    return (
        <span
            className={`scd-glass-status-badge scd-glass-status-${tone}${
                compact ? ' is-compact' : ''
            }`}
            title={raw !== display ? raw : undefined}
        >
            <span className="scd-glass-status-symbol" aria-hidden="true" />
            <span>{display}</span>
        </span>
    );
};

const isStatusColumn = (column: string): boolean =>
    /(?:^|[\s_.-])(action|health|result|severity|state|status|verdict)(?:$|[\s_.-])/i.test(
        column
    );

const TableCellContent = ({
    column,
    value,
}: {
    column: string;
    value: unknown;
}): JSX.Element => {
    const raw = displayCell(value);
    if (raw !== '—' && isStatusColumn(column)) {
        return <StatusBadge value={raw} compact />;
    }
    const display = humanizeMachineLabel(raw);
    return (
        <span
            className={display !== raw ? 'scd-glass-human-label' : undefined}
            title={display !== raw ? raw : undefined}
        >
            {display}
        </span>
    );
};

const metricTrendForRow = (
    row: SearchRow | undefined
): { direction: TrendDirection; label: string } | null => {
    if (!row) return null;
    const entry = Object.entries(row).find(([key]) =>
        /^(trend|delta|change|change_pct|pct_change|percent_change)$/i.test(key)
    );
    if (!entry) return null;
    const [key, value] = entry;
    const numeric = asNumber(value);
    if (numeric !== null) {
        const suffix = /pct|percent/i.test(key) ? '%' : '';
        return {
            direction: numeric > 0 ? 'up' : numeric < 0 ? 'down' : 'flat',
            label: `${numeric > 0 ? '+' : ''}${numeric}${suffix}`,
        };
    }
    const text = displayCell(value);
    if (!text || text === '—') return null;
    return {
        direction: /up|increase|higher|positive/i.test(text)
            ? 'up'
            : /down|decrease|lower|negative/i.test(text)
              ? 'down'
              : 'flat',
        label: text,
    };
};

const toneClass = (tone: Tone): string => `scd-glass-tone-${tone}`;

const plainTextFromHtml = (value: string): string => {
    let text = value
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<\/(p|li|div|ul|ol)>/gi, ' ');

    let previous: string;
    do {
        previous = text;
        text = text.replace(/<[^>]+>/g, '');
    } while (text !== previous);

    return text
        .replace(/&nbsp;/gi, ' ')
        .replace(/&lt;/gi, '')
        .replace(/&gt;/gi, '')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&amp;/gi, '&')
        .replace(/\s+/g, ' ')
        .trim();
};

const SearchActions = ({
    context,
    searchId,
    transformSearch,
}: {
    context: PageContext;
    searchId: string;
    transformSearch?: (spl: string) => string;
}): JSX.Element | null => {
    const record = context.catalogue?.get(searchId);
    if (!record) return null;
    const spl = transformSearch ? transformSearch(record.search) : record.search;
    const searchUrl = splunkSearchAppUrl(
        spl,
        { earliest: context.earliest, latest: 'now' },
        record.dispatchContext
    );

    return (
        <div className="scd-glass-search-actions">
            <Button
                appearance="subtle"
                title={`About ${record.searchName}`}
                aria-label={`Information about ${record.searchName}`}
                onClick={() => context.showSearchInfo(record)}
                icon={<Info size={16} aria-hidden />}
            />
            <Button
                appearance="subtle"
                to={searchUrl}
                openInNewContext
                title={`Open ${record.searchName} in Search`}
                aria-label={`Open ${record.searchName} in Search`}
                icon={<ExternalLink size={16} aria-hidden />}
            />
        </div>
    );
};

const SearchInfoDialog = ({
    record,
    onClose,
    returnFocus,
}: {
    record: SearchbaseRecord;
    onClose: () => void;
    returnFocus: React.MutableRefObject<HTMLElement | null>;
}): JSX.Element => {
    const description = plainTextFromHtml(
        record.explanation || record.description || record.solution
    );

    return (
        <Modal
            open
            closeOnClickAway
            divider="both"
            onRequestClose={onClose}
            returnFocus={returnFocus}
            style={{ width: 'min(680px, calc(100vw - 32px))' }}
        >
            <Modal.Header title={record.searchName} subtitle="Searchbase search" />
            <Modal.Body className="scd-glass-info-body">
                    <p>{description || 'No description is available.'}</p>
                    <dl>
                        <div>
                            <dt>Category</dt>
                            <dd>{record.category || '—'}</dd>
                        </div>
                        <div>
                            <dt>Subcategory</dt>
                            <dd>{record.subCategory || '—'}</dd>
                        </div>
                        <div>
                            <dt>Dispatch app</dt>
                            <dd>{record.dispatchContext || record.ownerApp}</dd>
                        </div>
                        <div>
                            <dt>Search ID</dt>
                            <dd>{record.id}</dd>
                        </div>
                    </dl>
                    {record.tags.length > 0 ? (
                        <div className="scd-glass-info-tags">
                            {record.tags.map((tag) => (
                                <span key={tag}>{tag}</span>
                            ))}
                        </div>
                    ) : null}
            </Modal.Body>
            <Modal.Footer>
                <Button appearance="primary" label="Done" onClick={onClose} />
            </Modal.Footer>
        </Modal>
    );
};

const EmptyState = ({
    loading,
    error,
    message = 'No matching data returned for this time range.',
}: {
    loading: boolean;
    error: string | null;
    message?: string;
}): JSX.Element => (
    <div className="scd-glass-empty">
        {loading ? (
            <>
                <RefreshCw size={22} className="scd-glass-spin" />
                <span>Running Splunk search…</span>
            </>
        ) : error ? (
            <>
                <AlertTriangle size={22} />
                <span>{error}</span>
            </>
        ) : (
            <>
                <CircleDot size={22} />
                <span>{message}</span>
            </>
        )}
    </div>
);

const Panel = ({
    title,
    subtitle,
    children,
    className = '',
    action,
    linked = false,
}: {
    title: string;
    subtitle?: string;
    children: React.ReactNode;
    className?: string;
    action?: React.ReactNode;
    linked?: boolean;
}): JSX.Element => (
    <section className={`scd-glass-panel ${className}`}>
        <header className="scd-glass-panel-header">
            <div className="scd-glass-panel-heading">
                <div className="scd-glass-panel-title">
                    <h2>{title}</h2>
                    {linked ? (
                        <span
                            className="scd-glass-linked"
                            aria-label="Linked to live dashboard context"
                            title="Linked to live dashboard context"
                        >
                            ◆
                        </span>
                    ) : null}
                </div>
                {subtitle ? <p>{subtitle}</p> : null}
            </div>
            {action}
        </header>
        <div className="scd-glass-panel-body">{children}</div>
    </section>
);

const SearchMetric = ({
    context,
    searchId,
    label,
    preferredFields = [],
    suffix = '',
    tone = 'default',
    icon: Icon = Activity,
}: SearchMetricProps): JSX.Element => {
    const state = useSearchbaseRows({
        catalogue: context.catalogue,
        searchId,
        earliest: context.earliest,
        refreshToken: context.refreshToken,
        count: 10,
    });
    const value = getScalarValue(state.rows, preferredFields);
    const trend = metricTrendForRow(state.rows[0]);
    const TrendIcon =
        trend?.direction === 'up'
            ? TrendingUp
            : trend?.direction === 'down'
              ? TrendingDown
              : Minus;

    return (
        <article
            className={`scd-glass-metric ${toneClass(tone)}`}
            aria-label={`${label}: ${formatNumber(value, suffix)}`}
        >
            <SearchActions
                context={context}
                searchId={searchId}
            />
            <div className="scd-glass-metric-label">
                <Icon size={16} strokeWidth={2} />
                <span>{label}</span>
            </div>
            <strong>{state.loading ? '…' : formatNumber(value, suffix)}</strong>
            <span className="scd-glass-metric-status">
                <span>
                    {state.error ? 'Search unavailable' : 'Live Searchbase result'}
                </span>
                {!state.loading && !state.error && trend ? (
                    <span
                        className={`scd-glass-metric-trend is-${trend.direction}`}
                        title="Trend returned by the live search"
                    >
                        <TrendIcon size={11} aria-hidden="true" />
                        {trend.label}
                    </span>
                ) : null}
            </span>
        </article>
    );
};

const SearchChartPanel = ({
    context,
    searchId,
    title,
    subtitle,
    chartKind = 'line',
    className = '',
    useGlobalFilters = true,
}: SearchPanelProps): JSX.Element => {
    const state = useSearchbaseRows({
        catalogue: context.catalogue,
        searchId,
        earliest: context.earliest,
        refreshToken: context.refreshToken,
        count: 200,
    });
    const filteredRows = useFilteredRows(
        state.rows,
        useGlobalFilters ? context.filters : DEFAULT_FILTERS
    );
    const labelKey = getLabelKey(filteredRows);
    const numericKeys = getNumericKeys(filteredRows).slice(0, 4);
    const colors = CHART_COLORS;
    const axisColor = 'var(--glass-muted)';
    const gridColor = 'var(--glass-border)';
    const tooltipStyle = {
        background: 'var(--glass-panel-subtle)',
        border: '1px solid var(--glass-border-strong)',
        borderRadius: 8,
        color: 'var(--glass-text)',
        fontSize: 12,
    };

    const renderChart = (): React.ReactNode => {
        if (!labelKey || numericKeys.length === 0) {
            return (
                <EmptyState
                    loading={state.loading}
                    error={state.error}
                />
            );
        }

        if (chartKind === 'pie') {
            const valueKey = numericKeys[0];
            const data = filteredRows.slice(0, 8).map((row) => ({
                name: compactLabel(row[labelKey]),
                value: asNumber(row[valueKey]) ?? 0,
            }));
            return (
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            dataKey="value"
                            nameKey="name"
                            innerRadius="52%"
                            outerRadius="78%"
                            paddingAngle={2}
                        >
                            {data.map((entry, index) => (
                                <Cell
                                    key={`${entry.name}-${index}`}
                                    fill={colors[index % colors.length]}
                                />
                            ))}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                </ResponsiveContainer>
            );
        }

        if (chartKind === 'bar') {
            const isTimeSeries =
                labelKey === '_time' || /(?:^|[_\s-])(time|date)(?:$|[_\s-])/i.test(labelKey);
            const barRows = isTimeSeries
                ? filteredRows.slice(-12)
                : filteredRows.slice(0, 12);

            return (
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barRows}>
                        <CartesianGrid
                            stroke={gridColor}
                            strokeDasharray="3 4"
                            vertical={false}
                        />
                        <XAxis
                            dataKey={labelKey}
                            stroke={axisColor}
                            tick={{ fill: axisColor, fontSize: 10 }}
                            tickFormatter={compactLabel}
                        />
                        <YAxis
                            stroke={axisColor}
                            tick={{ fill: axisColor, fontSize: 10 }}
                            width={42}
                        />
                        <Tooltip contentStyle={tooltipStyle} />
                        {numericKeys.slice(0, 3).map((key, index) => (
                            <Bar
                                key={key}
                                dataKey={key}
                                fill={colors[index % colors.length]}
                                radius={[4, 4, 0, 0]}
                            />
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            );
        }

        if (chartKind === 'area') {
            return (
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={filteredRows.slice(-48)}>
                        <CartesianGrid
                            stroke={gridColor}
                            strokeDasharray="3 4"
                            vertical={false}
                        />
                        <XAxis
                            dataKey={labelKey}
                            stroke={axisColor}
                            tick={{ fill: axisColor, fontSize: 10 }}
                            tickFormatter={compactLabel}
                        />
                        <YAxis
                            stroke={axisColor}
                            tick={{ fill: axisColor, fontSize: 10 }}
                            width={42}
                        />
                        <Tooltip contentStyle={tooltipStyle} />
                        {numericKeys.slice(0, 3).map((key, index) => (
                            <Area
                                key={key}
                                type="monotone"
                                dataKey={key}
                                stroke={colors[index % colors.length]}
                                fill={colors[index % colors.length]}
                                fillOpacity={0.12}
                                strokeWidth={2}
                            />
                        ))}
                    </AreaChart>
                </ResponsiveContainer>
            );
        }

        return (
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={filteredRows.slice(-48)}>
                    <CartesianGrid
                        stroke={gridColor}
                        strokeDasharray="3 4"
                        vertical={false}
                    />
                    <XAxis
                        dataKey={labelKey}
                        stroke={axisColor}
                        tick={{ fill: axisColor, fontSize: 10 }}
                        tickFormatter={compactLabel}
                    />
                    <YAxis
                        stroke={axisColor}
                        tick={{ fill: axisColor, fontSize: 10 }}
                        width={42}
                    />
                    <Tooltip contentStyle={tooltipStyle} />
                    {numericKeys.slice(0, 3).map((key, index) => (
                        <Line
                            key={key}
                            type="monotone"
                            dataKey={key}
                            stroke={colors[index % colors.length]}
                            dot={false}
                            strokeWidth={2}
                        />
                    ))}
                </LineChart>
            </ResponsiveContainer>
        );
    };

    return (
        <Panel
            title={title}
            subtitle={subtitle}
            className={`scd-glass-chart-panel ${className}`}
            linked
            action={
                <SearchActions
                    context={context}
                    searchId={searchId}
                />
            }
        >
            <div className="scd-glass-chart">{renderChart()}</div>
        </Panel>
    );
};

const SearchTablePanel = ({
    context,
    searchId,
    title,
    subtitle,
    className = '',
    maxRows = 8,
    useGlobalFilters = true,
    transformSearch,
}: SearchTableProps): JSX.Element => {
    const state = useSearchbaseRows({
        catalogue: context.catalogue,
        searchId,
        earliest: context.earliest,
        refreshToken: context.refreshToken,
        count: 200,
        transformSearch,
    });
    const rows = useFilteredRows(
        state.rows,
        useGlobalFilters ? context.filters : DEFAULT_FILTERS
    );
    const columns = getColumns(rows);

    return (
        <Panel
            title={title}
            subtitle={subtitle}
            className={`scd-glass-table-panel ${className}`}
            linked
            action={
                <SearchActions
                    context={context}
                    searchId={searchId}
                    transformSearch={transformSearch}
                />
            }
        >
            {rows.length === 0 ? (
                <EmptyState loading={state.loading} error={state.error} />
            ) : (
                <div className="scd-glass-table-wrap">
                    <table>
                        <thead>
                            <tr>
                                {columns.map((column) => (
                                    <th key={column} title={column}>
                                        {humanizeColumnLabel(column)}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.slice(0, maxRows).map((row, rowIndex) => (
                                <tr key={`${searchId}-${rowIndex}`}>
                                    {columns.map((column) => (
                                        <td key={column}>
                                            <TableCellContent
                                                column={column}
                                                value={row[column]}
                                            />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </Panel>
    );
};

const SectionBand = ({
    children,
    icon: Icon,
    count,
}: {
    children: React.ReactNode;
    icon: SuiIcon;
    count?: React.ReactNode;
}): JSX.Element => (
    <div className="scd-glass-section-band">
        <Icon size={14} strokeWidth={2} aria-hidden="true" />
        <span>{children}</span>
        {count !== undefined ? (
            <span className="scd-glass-section-count">{count}</span>
        ) : null}
        <span className="scd-glass-section-rule" aria-hidden="true" />
    </div>
);

const OverviewTab = ({ context }: { context: PageContext }): JSX.Element => (
    <div className="scd-glass-tab-content">
        <div className="scd-glass-metric-grid scd-glass-metric-grid-six">
            <SearchMetric
                context={context}
                searchId="secure_networking_sse_total_security_events"
                label="Total Security Events"
                preferredFields={['total_events']}
                icon={Shield}
            />
            <SearchMetric
                context={context}
                searchId="secure_networking_fmc_blocked_count"
                label="Firewall Blocks"
                preferredFields={['blocked_events']}
                tone="critical"
                icon={ShieldAlert}
            />
            <SearchMetric
                context={context}
                searchId="secure_networking_sse_dns_blocked_categories"
                label="DNS Threat Categories"
                preferredFields={['Block Count']}
                tone="warning"
                icon={Globe2}
            />
            <SearchMetric
                context={context}
                searchId="secure_networking_zta_ise_auth_events_count"
                label="Authentication Events"
                preferredFields={['auth_events']}
                icon={Shield}
            />
            <SearchMetric
                context={context}
                searchId="secure_networking_zta_ise_failed_auth_count"
                label="Failed Authentications"
                preferredFields={['failed_auth']}
                tone="critical"
                icon={AlertTriangle}
            />
            <SearchMetric
                context={context}
                searchId="secure_networking_dc_anomaly_count"
                label="DC Issues"
                preferredFields={['anomaly_count']}
                tone="warning"
                icon={Server}
            />
        </div>
        <div className="scd-glass-grid-three">
            <SearchChartPanel
                context={context}
                searchId="secure_networking_sse_dns_activity_trend"
                title="Security Events by Source"
                subtitle="SSE DNS activity over time"
                chartKind="area"
            />
            <SearchChartPanel
                context={context}
                searchId="secure_networking_zta_auth_outcome_trend"
                title="Authentication Activity"
                subtitle="Passed versus failed authentications"
            />
            <SearchChartPanel
                context={context}
                searchId="secure_networking_fmc_activity_trend"
                title="On-Prem Firewall Activity"
                subtitle="FMC allow, block, trust, and other actions"
                chartKind="bar"
            />
        </div>
        <div className="scd-glass-grid-two">
            <SearchChartPanel
                context={context}
                searchId="secure_networking_sse_cloud_firewall_verdict_split"
                title="Cloud Firewall Verdicts"
                subtitle="Cisco SSE enforcement distribution"
                chartKind="pie"
            />
            <SearchTablePanel
                context={context}
                searchId="secure_networking_source_health_by_pillar"
                title="Secure Networking Source Health"
                subtitle="Ingestion freshness across security pillars"
            />
        </div>
    </div>
);

const IdentityTab = ({ context }: { context: PageContext }): JSX.Element => (
    <div className="scd-glass-tab-content">
        <div className="scd-glass-metric-grid scd-glass-metric-grid-five">
            <SearchMetric
                context={context}
                searchId="secure_networking_zta_ise_auth_events_count"
                label="Auth Events"
                preferredFields={['auth_events']}
                icon={Shield}
            />
            <SearchMetric
                context={context}
                searchId="secure_networking_zta_ise_failed_auth_count"
                label="Failed Auth"
                preferredFields={['failed_auth']}
                tone="critical"
                icon={ShieldAlert}
            />
            <SearchMetric
                context={context}
                searchId="secure_networking_sgt_total_assignments_count"
                label="SGT Assignments"
                preferredFields={['sgt_assignments']}
                icon={Network}
            />
            <SearchMetric
                context={context}
                searchId="secure_networking_sgt_unique_count"
                label="Unique SGTs"
                preferredFields={['unique_sgts']}
                tone="info"
                icon={CircleDot}
            />
            <SearchMetric
                context={context}
                searchId="secure_networking_zta_ztna_session_count"
                label="ZTNA Sessions"
                preferredFields={['session_count']}
                tone="good"
                icon={CheckCircle2}
            />
        </div>
        <div className="scd-glass-grid-identity">
            <SearchChartPanel
                context={context}
                searchId="secure_networking_zta_auth_outcome_trend"
                title="Authentication — Passed vs Failed"
                subtitle="CIM-normalized ISE authentication outcomes"
                className="scd-glass-span-two"
            />
            <SearchChartPanel
                context={context}
                searchId="secure_networking_zta_ise_enforcement_by_domain"
                title="Enforcement by Policy Set"
                chartKind="pie"
            />
            <SearchChartPanel
                context={context}
                searchId="secure_networking_zta_ztna_connection_status_trend"
                title="ZTNA Connection Status"
                chartKind="bar"
            />
        </div>
        <div className="scd-glass-grid-two">
            <SearchTablePanel
                context={context}
                searchId="secure_networking_sgacl_policy_matrix"
                title="SGT Policy Activity"
                subtitle="Observed SGT-to-SGT enforcement hits"
            />
            <SearchTablePanel
                context={context}
                searchId="secure_networking_zta_ise_auth_by_device_fail_rate"
                title="ISE Authentication by Device"
                subtitle="Network-device failure-rate analysis"
            />
        </div>
    </div>
);

const PolicyDrilldown = ({
    context,
}: {
    context: PageContext;
}): JSX.Element => {
    const policies = useSearchbaseRows({
        catalogue: context.catalogue,
        searchId: 'secure_networking_fmc_top_policies_by_action',
        earliest: context.earliest,
        refreshToken: context.refreshToken,
        count: 50,
    });
    const [selectedPolicy, setSelectedPolicy] = useState('');
    const policyKey =
        policies.rows[0] && 'Firewall Policy' in policies.rows[0]
            ? 'Firewall Policy'
            : getLabelKey(policies.rows);

    useEffect(() => {
        if (!selectedPolicy && policyKey && policies.rows[0]) {
            const firstPolicy = String(policies.rows[0][policyKey] ?? '');
            setSelectedPolicy(firstPolicy);
        }
    }, [selectedPolicy, policyKey, policies.rows]);

    const transformRules = useMemo(() => {
        const safePolicy = sanitizeSearchValue(selectedPolicy);
        if (!safePolicy) return undefined;
        return (spl: string): string =>
            spl.replace(
                ' FirewallRule!=""',
                ` FirewallPolicy="${safePolicy}" FirewallRule!=""`
            );
    }, [selectedPolicy]);

    const rules = useSearchbaseRows({
        catalogue: context.catalogue,
        searchId: 'secure_networking_fmc_top_rules_hit',
        earliest: context.earliest,
        refreshToken: context.refreshToken,
        count: 100,
        transformSearch: transformRules,
    });
    const ruleColumns = getColumns(rules.rows);

    const selectPolicy = (policy: string): void => {
        setSelectedPolicy(policy);
    };

    return (
        <section className="scd-glass-policy-panel">
            <div className="scd-glass-policy-list">
                <header>
                    <div>
                        <h2>Firewall Policies (FMC)</h2>
                        <p>Select a policy to inspect its access-control rules.</p>
                    </div>
                    <SearchActions
                        context={context}
                        searchId="secure_networking_fmc_top_policies_by_action"
                    />
                </header>
                <div className="scd-glass-policy-items">
                    {policies.rows.length === 0 ? (
                        <EmptyState
                            loading={policies.loading}
                            error={policies.error}
                        />
                    ) : (
                        policies.rows.slice(0, 10).map((row, index) => {
                            const policy = policyKey
                                ? String(row[policyKey] ?? `Policy ${index + 1}`)
                                : `Policy ${index + 1}`;
                            const count =
                                getScalarValue([row], ['Total Events']) ?? 0;
                            return (
                                <button
                                    type="button"
                                    key={policy}
                                    className={
                                        selectedPolicy === policy
                                            ? 'is-selected'
                                            : ''
                                    }
                                    onClick={() => selectPolicy(policy)}
                                >
                                    <span>{policy}</span>
                                    <strong>{formatNumber(count)}</strong>
                                    <ChevronRight size={16} />
                                </button>
                            );
                        })
                    )}
                </div>
            </div>
            <div className="scd-glass-policy-detail">
                <header>
                    <div>
                        <h2>
                            Rules Hit For:{' '}
                            <span>{selectedPolicy || 'Select a policy'}</span>
                        </h2>
                        <p>
                            Live FMC rule activity scoped to the selected
                            firewall policy.
                        </p>
                    </div>
                    <div className="scd-glass-search-toolbar">
                        <span className="scd-glass-count-badge">
                            {rules.rows.length} rules found
                        </span>
                        <SearchActions
                            context={context}
                            searchId="secure_networking_fmc_top_rules_hit"
                            transformSearch={transformRules}
                        />
                    </div>
                </header>
                {rules.rows.length === 0 ? (
                    <EmptyState loading={rules.loading} error={rules.error} />
                ) : (
                    <div className="scd-glass-table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    {ruleColumns.map((column) => (
                                        <th key={column} title={column}>
                                            {humanizeColumnLabel(column)}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {rules.rows.slice(0, 12).map((row, rowIndex) => (
                                    <tr key={`${selectedPolicy}-${rowIndex}`}>
                                        {ruleColumns.map((column) => (
                                            <td key={column}>
                                                <TableCellContent
                                                    column={column}
                                                    value={row[column]}
                                                />
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </section>
    );
};

const FirewallTab = ({ context }: { context: PageContext }): JSX.Element => {
    return (
        <div className="scd-glass-tab-content">
            <div className="scd-glass-metric-grid scd-glass-metric-grid-five">
                <SearchMetric
                    context={context}
                    searchId="secure_networking_fmc_total_events_count"
                    label="FMC Total Events"
                    preferredFields={['total_events']}
                    icon={Shield}
                />
                <SearchMetric
                    context={context}
                    searchId="secure_networking_fmc_blocked_count"
                    label="FMC Blocked"
                    preferredFields={['blocked_events']}
                    tone="critical"
                    icon={ShieldAlert}
                />
                <SearchMetric
                    context={context}
                    searchId="secure_networking_sse_dns_blocked_categories"
                    label="DNS Block Categories"
                    preferredFields={['Block Count']}
                    tone="warning"
                    icon={Globe2}
                />
                <SearchMetric
                    context={context}
                    searchId="secure_networking_sse_amp_malware_detections"
                    label="AMP Detections"
                    preferredFields={['threat_events']}
                    tone="critical"
                    icon={AlertTriangle}
                />
                <SearchMetric
                    context={context}
                    searchId="secure_networking_secure_access_dlp_findings"
                    label="DLP Policy Hits"
                    preferredFields={['finding_count', 'total_findings']}
                    tone="warning"
                    icon={Cloud}
                />
            </div>
            <PolicyDrilldown context={context} />
            <div className="scd-glass-grid-two">
                <SearchChartPanel
                    context={context}
                    searchId="secure_networking_sse_dns_blocked_categories"
                    title="Top DNS Blocked Categories"
                    chartKind="bar"
                    useGlobalFilters={false}
                />
                <SearchChartPanel
                    context={context}
                    searchId="secure_networking_sse_dns_activity_trend"
                    title="DNS Activity — Allowed vs Blocked"
                    chartKind="area"
                    useGlobalFilters={false}
                />
            </div>
            <div className="scd-glass-grid-two">
                <SearchChartPanel
                    context={context}
                    searchId="secure_networking_fmc_top_applications"
                    title="Top Applications Through FMC"
                    chartKind="bar"
                    useGlobalFilters={false}
                />
                <SearchChartPanel
                    context={context}
                    searchId="secure_networking_fmc_top_url_categories_blocked"
                    title="Top FMC URL Categories Blocked"
                    chartKind="bar"
                    useGlobalFilters={false}
                />
            </div>
            <SearchTablePanel
                context={context}
                searchId="secure_networking_sse_amp_threat_detail_table"
                title="AMP Threat Investigation"
                subtitle="Identity, file disposition, hash, and domain details"
                useGlobalFilters={false}
            />
        </div>
    );
};

const siteNameForRow = (row: SearchRow, index: number): string =>
    String(
        row['Site Name'] ??
            row.Site ??
            row['Site ID'] ??
            `Site ${index + 1}`
    );

const siteStatusForRow = (row: SearchRow): string =>
    String(
        row['Site Health'] ??
            row['Device Health'] ??
            row.Status ??
            'Unknown'
    );

const siteCoordinateForRow = (row: SearchRow): [number, number] | null => {
    const latitude = asNumber(
        row.Latitude ?? row.latitude ?? row.lat ?? row['Site Latitude']
    );
    const longitude = asNumber(
        row.Longitude ?? row.longitude ?? row.lon ?? row.lng ?? row['Site Longitude']
    );
    if (
        latitude === null ||
        longitude === null ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
    ) {
        return null;
    }
    return [latitude, longitude];
};

interface SiteMapStylePreset {
    id: SiteMapStyle;
    label: string;
    lightUrl: string;
    darkUrl: string;
    attribution: string;
}

const SITE_MAP_STYLE_PRESETS: SiteMapStylePreset[] = [
    {
        id: 'terrain',
        label: 'Terrain',
        lightUrl:
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
        darkUrl:
            'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
        attribution: 'Tiles &copy; Esri',
    },
    {
        id: 'street',
        label: 'Street',
        lightUrl:
            'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        darkUrl:
            'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        attribution:
            '&copy; OpenStreetMap contributors &copy; CARTO',
    },
    {
        id: 'satellite',
        label: 'Satellite',
        lightUrl:
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        darkUrl:
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attribution: 'Tiles &copy; Esri',
    },
];

const escapeMapText = (value: string): string =>
    value.replace(/[&<>"']/g, (character) => {
        switch (character) {
            case '&':
                return '&amp;';
            case '<':
                return '&lt;';
            case '>':
                return '&gt;';
            case '"':
                return '&quot;';
            case "'":
                return '&#39;';
            default:
                return character;
        }
    });

const siteShortCode = (name: string): string => {
    const numericSuffix = name.match(/(\d{1,3})$/)?.[1];
    if (numericSuffix) return numericSuffix;
    const words = name
        .split(/[\s_-]+/)
        .map((word) => word.trim())
        .filter(Boolean);
    if (words.length > 1) {
        return words
            .slice(0, 3)
            .map((word) => word[0])
            .join('')
            .toUpperCase();
    }
    return name.replace(/[^a-z0-9]/gi, '').slice(0, 3).toUpperCase() || 'SITE';
};

const siteHealthTone = (status: string): 'good' | 'bad' | 'unknown' => {
    if (/poor|critical|offline|down|failed/i.test(status)) return 'bad';
    if (/good|healthy|online|normal|fair/i.test(status)) return 'good';
    return 'unknown';
};

const createOperationsSiteIcon = ({
    name,
    status,
    selected,
}: {
    name: string;
    status: string;
    selected: boolean;
}): L.DivIcon => {
    const safeName = escapeMapText(name);
    const safeStatus = escapeMapText(status);
    const safeCode = escapeMapText(siteShortCode(name));
    return L.divIcon({
        className: 'scd-glass-map-marker-icon',
        html: `
            <div
                class="scd-glass-map-marker is-${siteHealthTone(status)}${
                    selected ? ' is-selected' : ''
                } is-dark"
                role="button"
                aria-label="${safeName}, ${safeStatus}"
            >
                <span class="scd-glass-map-marker-wave" aria-hidden="true"></span>
                <span class="scd-glass-map-marker-core">${safeCode}</span>
                <span class="scd-glass-map-marker-label">
                    <strong>${safeName}</strong>
                    <em>${safeStatus}</em>
                </span>
            </div>
        `,
        iconSize: [144, 72],
        iconAnchor: [72, 28],
        tooltipAnchor: [0, -30],
    });
};

const SiteMapViewport = ({
    coordinateKey,
}: {
    coordinateKey: string;
}): null => {
    const map = useMap();

    useEffect(() => {
        const coordinates = coordinateKey
            .split('|')
            .filter(Boolean)
            .map((coordinate) => coordinate.split(':').map(Number))
            .filter(
                (coordinate): coordinate is [number, number] =>
                    coordinate.length === 2 &&
                    coordinate.every(Number.isFinite)
            );
        map.invalidateSize({ pan: false });
        if (coordinates.length === 1) {
            map.setView(coordinates[0], 5, { animate: false });
            return;
        }
        if (coordinates.length > 1) {
            map.fitBounds(L.latLngBounds(coordinates), {
                animate: false,
                maxZoom: 5,
                padding: [44, 44],
            });
        }
    }, [coordinateKey, map]);

    return null;
};

const SiteHealthPanel = ({
    context,
    setFilter,
}: {
    context: PageContext;
    setFilter: (key: FilterKey, value: string) => void;
}): JSX.Element => {
    const sites = useSearchbaseRows({
        catalogue: context.catalogue,
        searchId: 'secure_networking_sdwan_site_view',
        earliest: context.earliest,
        refreshToken: context.refreshToken,
        count: 100,
    });
    const [selectedSite, setSelectedSite] = useState('');
    const [mapStyle, setMapStyle] = useState<SiteMapStyle>('terrain');
    const visibleSites = sites.rows.slice(0, 8);
    const selectedRow = visibleSites.find(
        (row, index) => siteNameForRow(row, index) === selectedSite
    );
    const onlineCount = visibleSites.filter((row) =>
        /good|healthy|online|normal/i.test(siteStatusForRow(row))
    ).length;
    const offlineCount = visibleSites.filter((row) =>
        /poor|critical|offline|down|failed/i.test(siteStatusForRow(row))
    ).length;
    const mappableSites = visibleSites.flatMap((row, index) => {
        const coordinate = siteCoordinateForRow(row);
        if (!coordinate) return [];
        const status = siteStatusForRow(row);
        return [
            {
                row,
                name: siteNameForRow(row, index),
                status,
                coordinate,
                isBad: /poor|critical|offline|down|failed/i.test(status),
            },
        ];
    });
    const selectedMapStyle =
        SITE_MAP_STYLE_PRESETS.find((preset) => preset.id === mapStyle) ??
        SITE_MAP_STYLE_PRESETS[0];
    const tileUrl = selectedMapStyle.darkUrl;

    const chooseSite = (name: string): void => {
        setSelectedSite(name);
        setFilter('location', name);
    };

    const clearSite = (): void => {
        setSelectedSite('');
        setFilter('location', 'All Regions');
    };

    return (
        <>
            <SectionBand
                icon={Globe2}
                count={`${visibleSites.length} sites`}
            >
                Site Health &amp; Reachability
            </SectionBand>
            <section className="scd-glass-site-panel">
                <div className="scd-glass-site-map">
                    <header>
                        <div className="scd-glass-panel-title">
                            <h2>Site Health Overview</h2>
                            <span
                                className="scd-glass-linked"
                                aria-label="Linked to live dashboard context"
                                title="Linked to live dashboard context"
                            >
                                ◆
                            </span>
                        </div>
                        <SearchActions
                            context={context}
                            searchId="secure_networking_sdwan_site_view"
                        />
                    </header>
                    <div className="scd-glass-map-canvas">
                        {mappableSites.length === 0 ? (
                            <EmptyState
                                loading={sites.loading}
                                error={sites.error}
                                message="No latitude and longitude fields were returned for these sites."
                            />
                        ) : (
                            <>
                                <MapContainer
                                    center={[22, 0]}
                                    zoom={2}
                                    minZoom={1}
                                    maxZoom={12}
                                    scrollWheelZoom
                                    worldCopyJump
                                    zoomControl={false}
                                    className="scd-glass-leaflet-map"
                                >
                                    <TileLayer
                                        key={`dark-${selectedMapStyle.id}`}
                                        attribution={selectedMapStyle.attribution}
                                        url={tileUrl}
                                    />
                                    <SiteMapViewport
                                        coordinateKey={mappableSites
                                            .map(
                                                ({ coordinate }) =>
                                                    `${coordinate[0]}:${coordinate[1]}`
                                            )
                                            .join('|')}
                                    />
                                    <ZoomControl position="bottomright" />
                                    {mappableSites.map(
                                        ({ name, status, coordinate, isBad }) => (
                                            <Marker
                                                key={name}
                                                position={coordinate}
                                                icon={createOperationsSiteIcon({
                                                    name,
                                                    status,
                                                    selected: selectedSite === name,
                                                })}
                                                title={`${name} — ${status}`}
                                                eventHandlers={{
                                                    click: () => chooseSite(name),
                                                }}
                                            >
                                                <MapTooltip
                                                    direction="top"
                                                    offset={[0, -7]}
                                                >
                                                    <strong>{name}</strong>
                                                    <span>
                                                        {isBad
                                                            ? 'Needs attention'
                                                            : status}
                                                    </span>
                                                </MapTooltip>
                                            </Marker>
                                        )
                                    )}
                                </MapContainer>
                                <div
                                    className="scd-glass-map-style-switcher"
                                    role="group"
                                    aria-label="Map style"
                                >
                                    {SITE_MAP_STYLE_PRESETS.map((preset) => (
                                        <button
                                            type="button"
                                            key={preset.id}
                                            className={
                                                mapStyle === preset.id
                                                    ? 'is-active'
                                                    : undefined
                                            }
                                            onClick={() => setMapStyle(preset.id)}
                                        >
                                            {preset.label}
                                        </button>
                                    ))}
                                </div>
                                <div className="scd-glass-map-legend">
                                    <span className="is-good">Healthy</span>
                                    <span className="is-bad">Attention</span>
                                    <span className="is-unknown">Unknown</span>
                                </div>
                            </>
                        )}
                    </div>
                </div>
                <div className="scd-glass-site-detail">
                    {visibleSites.length === 0 ? (
                        <EmptyState loading={sites.loading} error={sites.error} />
                    ) : selectedRow ? (
                        <>
                            <button
                                type="button"
                                className="scd-glass-back"
                                onClick={clearSite}
                            >
                                <ChevronLeft size={15} />
                                Back to all sites
                            </button>
                            <div className="scd-glass-site-heading">
                                <div>
                                    <span>Selected Site</span>
                                    <h2>{selectedSite}</h2>
                                </div>
                                <strong>
                                    {displayCell(
                                        selectedRow['Devices Score'] ??
                                            selectedRow['Apps Score'] ??
                                            '—'
                                    )}
                                </strong>
                            </div>
                            <div className="scd-glass-site-kpis">
                                {([
                                    ['Status', selectedRow['Site Health']],
                                    ['Devices', selectedRow['Devices Health']],
                                    ['Tunnels', selectedRow['Tunnels Health']],
                                    ['Applications', selectedRow['Apps Health']],
                                    ['Tunnel Score', selectedRow['Tunnels Score']],
                                    ['Last Seen', selectedRow['Last Seen']],
                                ] as Array<[string, unknown]>).map(([label, value]) => (
                                    <div key={String(label)}>
                                        <span>{label}</span>
                                        {/^(Status|Devices|Tunnels|Applications)$/.test(
                                            label
                                        ) ? (
                                            <StatusBadge value={value} compact />
                                        ) : (
                                            <strong>{displayCell(value)}</strong>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="scd-glass-site-summary">
                                <div>
                                    <span>Total Sites</span>
                                    <strong>{visibleSites.length}</strong>
                                </div>
                                <div className="is-good">
                                    <span>Healthy</span>
                                    <strong>{onlineCount}</strong>
                                </div>
                                <div className="is-bad">
                                    <span>Attention</span>
                                    <strong>{offlineCount}</strong>
                                </div>
                            </div>
                            <div className="scd-glass-site-list">
                                {visibleSites.map((row, index) => {
                                    const name = siteNameForRow(row, index);
                                    const status = siteStatusForRow(row);
                                    const isBad =
                                        /poor|critical|offline|down|failed/i.test(
                                            status
                                        );
                                    return (
                                        <button
                                            type="button"
                                            key={name}
                                            onClick={() => chooseSite(name)}
                                        >
                                            <strong>{name}</strong>
                                            <StatusBadge
                                                value={status}
                                                label={
                                                    isBad
                                                        ? 'Attention'
                                                        : status
                                                }
                                                compact
                                            />
                                            <ChevronRight size={14} />
                                        </button>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>
            </section>
        </>
    );
};

const NetworkTab = ({
    context,
    setFilter,
}: {
    context: PageContext;
    setFilter: (key: FilterKey, value: string) => void;
}): JSX.Element => (
    <div className="scd-glass-tab-content">
        <SiteHealthPanel context={context} setFilter={setFilter} />
        <SectionBand icon={Server}>Nexus Dashboard</SectionBand>
        <div className="scd-glass-network-row">
            <div className="scd-glass-network-metrics">
                <SearchMetric
                    context={context}
                    searchId="secure_networking_dc_anomaly_count"
                    label="Nexus Anomalies"
                    preferredFields={['anomaly_count']}
                    tone="warning"
                    icon={AlertTriangle}
                />
                <SearchMetric
                    context={context}
                    searchId="secure_networking_dc_advisory_count"
                    label="Nexus Advisories"
                    preferredFields={['advisory_count']}
                    tone="critical"
                    icon={ShieldAlert}
                />
            </div>
            <SearchTablePanel
                context={context}
                searchId="secure_networking_dc_anomalies_by_severity"
                title="Nexus Fabric Anomalies by Severity"
                className="scd-glass-flex-one"
                useGlobalFilters={false}
            />
        </div>
        <SectionBand icon={Network}>SD-WAN</SectionBand>
        <div className="scd-glass-grid-three">
            <SearchChartPanel
                context={context}
                searchId="secure_networking_sdwan_apps_health_breakdown"
                title="SD-WAN Application Experience"
                chartKind="pie"
                useGlobalFilters={false}
            />
            <SearchChartPanel
                context={context}
                searchId="secure_networking_sdwan_site_health_breakdown"
                title="SD-WAN Site Health"
                chartKind="pie"
                useGlobalFilters={false}
            />
            <SearchTablePanel
                context={context}
                searchId="secure_networking_sdwan_tunnel_health_log"
                title="SD-WAN Tunnel Health"
                maxRows={6}
                useGlobalFilters={false}
            />
        </div>
        <SectionBand icon={Wifi}>Meraki</SectionBand>
        <div className="scd-glass-metric-grid scd-glass-metric-grid-four">
            <SearchMetric
                context={context}
                searchId="secure_networking_meraki_switch_count"
                label="Switches"
                preferredFields={['switch_count']}
                icon={Network}
            />
            <SearchMetric
                context={context}
                searchId="secure_networking_meraki_ap_count"
                label="Access Points"
                preferredFields={['ap_count']}
                icon={Wifi}
            />
            <SearchMetric
                context={context}
                searchId="secure_networking_meraki_wired_client_count"
                label="Wired Clients"
                preferredFields={['wired_clients']}
                icon={Server}
            />
            <SearchMetric
                context={context}
                searchId="secure_networking_meraki_wireless_client_count"
                label="Wireless Clients"
                preferredFields={['wireless_clients']}
                icon={Wifi}
            />
        </div>
        <div className="scd-glass-grid-two">
            <SearchChartPanel
                context={context}
                searchId="secure_networking_meraki_ssid_encryption_breakdown"
                title="SSID Encryption Posture"
                chartKind="bar"
                useGlobalFilters={false}
            />
            <SearchTablePanel
                context={context}
                searchId="secure_networking_meraki_top_clients_by_bandwidth"
                title="Top Clients by Bandwidth"
                useGlobalFilters={false}
            />
        </div>
        <SectionBand icon={Cloud}>ThousandEyes</SectionBand>
        <div className="scd-glass-metric-grid scd-glass-metric-grid-four">
            <SearchMetric
                context={context}
                searchId="secure_networking_thousandeyes_test_success_vs_failed"
                label="Degraded Tests"
                preferredFields={['degraded_tests']}
                tone="warning"
                icon={AlertTriangle}
            />
            <SearchMetric
                context={context}
                searchId="secure_networking_thousandeyes_avg_latency"
                label="Average Latency"
                preferredFields={['avg_latency_ms']}
                suffix=" ms"
                tone="info"
                icon={Activity}
            />
            <SearchMetric
                context={context}
                searchId="secure_networking_thousandeyes_avg_loss_pct"
                label="Average Loss"
                preferredFields={['avg_loss_pct']}
                suffix="%"
                tone="critical"
                icon={Network}
            />
            <SearchMetric
                context={context}
                searchId="secure_networking_thousandeyes_avg_jitter"
                label="Average Jitter"
                preferredFields={['avg_jitter_ms']}
                suffix=" ms"
                tone="warning"
                icon={Activity}
            />
        </div>
        <div className="scd-glass-grid-two">
            <SearchChartPanel
                context={context}
                searchId="secure_networking_thousandeyes_network_loss_trend"
                title="Network Loss Trend"
                chartKind="area"
                useGlobalFilters={false}
            />
            <SearchTablePanel
                context={context}
                searchId="secure_networking_thousandeyes_http_availability_by_test"
                title="HTTP Availability by Test"
                useGlobalFilters={false}
            />
        </div>
    </div>
);

const UserInvestigationTab = ({
    context,
    setFilter,
}: {
    context: PageContext;
    setFilter: (key: FilterKey, value: string) => void;
}): JSX.Element => {
    const [draftUser, setDraftUser] = useState('');
    const [appliedUser, setAppliedUser] = useState('');
    const safeUser = sanitizeWildcardSearchValue(appliedUser);
    const isWildcardSearch = safeUser.includes('*');
    const transformSearch = useMemo(() => {
        if (!safeUser) return undefined;
        return (spl: string): string => {
            const aggregateMarker = '\n| stats count as event_count';
            if (spl.includes(aggregateMarker)) {
                return spl.replace(
                    aggregateMarker,
                    `\n| search identity="${safeUser}"${aggregateMarker}`
                );
            }
            return `${spl}\n| search "Identity"="${safeUser}"`;
        };
    }, [safeUser]);
    const activity = useSearchbaseRows({
        catalogue: context.catalogue,
        searchId: 'secure_networking_zta_user_activity_cross_source',
        earliest: context.earliest,
        refreshToken: context.refreshToken,
        enabled: Boolean(safeUser),
        transformSearch,
        count: 100,
    });
    const row = activity.rows[0] ?? {};
    const columns = getColumns(activity.rows);
    const summary = useMemo(() => {
        if (!isWildcardSearch) {
            return {
                totalEvents: row['Total Events'],
                secondLabel: 'Layers Seen',
                secondValue: row['Layers Seen'],
                thirdLabel: 'Fail / Block Layers',
                thirdValue: row['Fail/Block Layers'],
                sources: row.Sources,
                lastSeen: row['Last Seen'],
            };
        }

        const sourceSet = new Set<string>();
        let totalEvents = 0;
        let identitiesWithBlocks = 0;
        let lastSeen = '';

        activity.rows.forEach((activityRow) => {
            totalEvents += asNumber(activityRow['Total Events']) ?? 0;
            if ((asNumber(activityRow['Fail/Block Layers']) ?? 0) > 0) {
                identitiesWithBlocks += 1;
            }
            String(activityRow.Sources ?? '')
                .split(',')
                .map((source) => source.trim())
                .filter(Boolean)
                .forEach((source) => sourceSet.add(source));
            const candidateLastSeen = String(activityRow['Last Seen'] ?? '');
            if (candidateLastSeen > lastSeen) {
                lastSeen = candidateLastSeen;
            }
        });

        return {
            totalEvents,
            secondLabel: 'Matching Identities',
            secondValue: activity.rows.length,
            thirdLabel: 'Identities with Blocks',
            thirdValue: identitiesWithBlocks,
            sources: Array.from(sourceSet).join(', '),
            lastSeen,
        };
    }, [activity.rows, isWildcardSearch, row]);

    const submit = (event: React.FormEvent): void => {
        event.preventDefault();
        const next = sanitizeWildcardSearchValue(draftUser);
        setAppliedUser(next);
        setFilter('user', next || 'Any');
    };

    return (
        <div className="scd-glass-tab-content">
            <section className="scd-glass-investigation-hero">
                <div>
                    <UserRoundSearch size={28} />
                    <div>
                        <h2>
                            Trace a user session across Campus Wireless → ISE
                            Auth → Cloud Firewall → Web Proxy → ZTNA
                        </h2>
                        <p>
                            Enter an identity to correlate its activity across
                            the Secure Networking enforcement stack. Use * for
                            wildcard matches, for example user47*.
                        </p>
                    </div>
                    <SearchActions
                        context={context}
                        searchId="secure_networking_zta_user_activity_cross_source"
                        transformSearch={transformSearch}
                    />
                </div>
                <form onSubmit={submit}>
                    <Search size={17} />
                    <Text
                        inline={false}
                        value={draftUser}
                        onChange={(_event, { value }) => setDraftUser(value)}
                        placeholder="Enter username or wildcard, e.g. user47*…"
                        aria-label="Username to investigate"
                    />
                    <Button type="submit" appearance="primary" label="Search" />
                </form>
            </section>
            <div className="scd-glass-metric-grid scd-glass-metric-grid-five">
                {([
                    ['Total Events', summary.totalEvents, 'default'],
                    [summary.secondLabel, summary.secondValue, 'info'],
                    [summary.thirdLabel, summary.thirdValue, 'critical'],
                    ['Sources', summary.sources, 'good'],
                    ['Last Seen', summary.lastSeen, 'warning'],
                ] as Array<[string, unknown, Tone]>).map(([label, value, tone]) => (
                    <div
                        key={String(label)}
                        className={`scd-glass-metric scd-glass-investigation-metric ${toneClass(
                            tone
                        )}`}
                    >
                        <span className="scd-glass-metric-label">{label}</span>
                        <strong>{safeUser ? displayCell(value) : '—'}</strong>
                        <span className="scd-glass-metric-status">
                            {safeUser ? safeUser : 'Waiting for a username'}
                        </span>
                    </div>
                ))}
            </div>
            <Panel
                title="Activity Timeline — Enforcement Layers"
                linked
                subtitle={
                    safeUser
                        ? `Correlated activity for ${safeUser}`
                        : 'Run a user search to populate this view.'
                }
                action={
                    <SearchActions
                        context={context}
                        searchId="secure_networking_zta_user_activity_cross_source"
                        transformSearch={transformSearch}
                    />
                }
            >
                {!safeUser || activity.rows.length === 0 ? (
                    <EmptyState
                        loading={activity.loading && Boolean(safeUser)}
                        error={activity.error}
                        message={
                            safeUser
                                ? 'No matching identity activity returned.'
                                : 'No user has been selected.'
                        }
                    />
                ) : (
                    <div className="scd-glass-layer-flow">
                        {['Campus Wireless', 'ISE / NAC', 'Cloud Firewall', 'Web Proxy', 'ZTNA'].map(
                            (layer, index) => (
                                <React.Fragment key={layer}>
                                    <div className="scd-glass-layer-node">
                                        <span>{index + 1}</span>
                                        <strong>{layer}</strong>
                                    </div>
                                    {index < 4 ? (
                                        <ChevronRight size={20} />
                                    ) : null}
                                </React.Fragment>
                            )
                        )}
                    </div>
                )}
            </Panel>
            <Panel
                title="User Activity Log"
                linked
                subtitle="Searchbase cross-source correlation results"
                action={
                    <SearchActions
                        context={context}
                        searchId="secure_networking_zta_user_activity_cross_source"
                        transformSearch={transformSearch}
                    />
                }
            >
                {activity.rows.length === 0 ? (
                    <EmptyState
                        loading={activity.loading && Boolean(safeUser)}
                        error={activity.error}
                        message="No matching identity activity returned."
                    />
                ) : (
                    <div className="scd-glass-table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    {columns.map((column) => (
                                        <th key={column} title={column}>
                                            {humanizeColumnLabel(column)}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {activity.rows.map((activityRow, index) => (
                                    <tr key={`${safeUser}-${index}`}>
                                        {columns.map((column) => (
                                            <td key={column}>
                                                <TableCellContent
                                                    column={column}
                                                    value={activityRow[column]}
                                                />
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Panel>
        </div>
    );
};

const formatEventTime = (value: unknown): string => {
    const raw = displayCell(value);
    const timestamp = raw.match(/T(\d{2}:\d{2}:\d{2})/);
    if (timestamp) return timestamp[1];
    const clock = raw.match(/\b(\d{2}:\d{2}(?::\d{2})?)\b/);
    return clock?.[1] ?? compactLabel(raw);
};

const eventSeverityForRow = (
    row: SearchRow
): { raw: string; label: string } => {
    const raw = displayCell(
        row.Severity ??
            row.severity ??
            row.Action ??
            row.action ??
            row.AC_RuleAction ??
            row.result ??
            row.status ??
            'info'
    );
    if (/critical|crit|high/i.test(raw)) return { raw, label: 'CRIT' };
    if (/block|deny|fail|drop|reset/i.test(raw)) {
        return { raw, label: 'BLOCK' };
    }
    if (/warn|medium|fair|degrad/i.test(raw)) {
        return { raw, label: 'WARN' };
    }
    if (/allow|success|pass|permit/i.test(raw)) {
        return { raw, label: 'ALLOW' };
    }
    return { raw, label: 'INFO' };
};

const EventLog = ({ context }: { context: PageContext }): JSX.Element => {
    const events = useSearchbaseRows({
        catalogue: context.catalogue,
        searchId: 'secure_networking_fmc_blocked_connection_detail',
        earliest: context.earliest,
        refreshToken: context.refreshToken,
        count: 30,
    });
    const filtered = useFilteredRows(events.rows, context.filters);

    return (
        <div className="scd-glass-event-log">
            {filtered.length === 0 ? (
                <EmptyState loading={events.loading} error={events.error} />
            ) : (
                filtered.slice(0, 18).map((row, index) => {
                    const time =
                        row._time ?? row['Last Seen'] ?? row['Last Event'] ?? '';
                    const severity = eventSeverityForRow(row);
                    const source = displayCell(row.product ?? 'FMC');
                    const messageFields = Object.entries(row).filter(
                        ([key]) =>
                            !/^(_time|time|last seen|last event|severity|action|ac_ruleaction|result|status|product)$/i.test(
                                key
                            )
                    );
                    return (
                        <div key={`event-${index}`}>
                            <time>{formatEventTime(time)}</time>
                            <StatusBadge
                                value={severity.raw}
                                label={severity.label}
                                compact
                            />
                            <span
                                className="scd-glass-event-source"
                                title={source}
                            >
                                {humanizeMachineLabel(source)}
                            </span>
                            <p>
                                {messageFields
                                    .slice(0, 3)
                                    .map(([, value]) =>
                                        humanizeMachineLabel(displayCell(value))
                                    )
                                    .join(' · ')}
                            </p>
                        </div>
                    );
                })
            )}
        </div>
    );
};

const FilterSidebar = ({
    context,
    filters,
    setFilter,
}: {
    context: PageContext;
    filters: Filters;
    setFilter: (key: FilterKey, value: string) => void;
}): JSX.Element => (
    <aside className="scd-glass-sidebar">
        <section className="scd-glass-sidebar-filters">
            <header>
                <Filter size={18} />
                <h2>Filters</h2>
            </header>
            {(Object.keys(FILTER_LABELS) as FilterKey[]).map((key) => {
                const options = FILTER_OPTIONS[key];
                const values = options.includes(filters[key])
                    ? options
                    : [...options, filters[key]];
                return (
                    <div className="scd-glass-filter-field" key={key}>
                        <span>{FILTER_LABELS[key]}</span>
                        <Select
                            inline={false}
                            labelText={FILTER_LABELS[key]}
                            value={filters[key]}
                            onChange={(_event, { value }) =>
                                setFilter(key, String(value))
                            }
                        >
                            {values.map((value) => (
                                <Select.Option key={value} value={value} label={value} />
                            ))}
                        </Select>
                    </div>
                );
            })}
        </section>
        <section className="scd-glass-sidebar-events">
            <header>
                <Activity size={18} />
                <h2>Event Log</h2>
                <span className="scd-glass-live-indicator">
                    <span aria-hidden="true" />
                    Live
                </span>
                <SearchActions
                    context={context}
                    searchId="secure_networking_fmc_blocked_connection_detail"
                />
            </header>
            <EventLog context={context} />
        </section>
    </aside>
);

const SecureOperationsGlassPage = (): JSX.Element => {
    const [activeTab, setActiveTab] = useState<TabId>('overview');
    const [earliest, setEarliest] = useState('-7d@d');
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
    const [refreshToken, setRefreshToken] = useState(0);
    const [infoRecord, setInfoRecord] = useState<SearchbaseRecord | null>(null);
    const infoReturnFocusRef = useRef<HTMLElement | null>(null);
    const { catalogue, error: catalogueError } = useSearchbaseCatalogueMap();

    useEffect(() => {
        document.documentElement.classList.add('scd-overview-active');
        document.body.classList.add('scd-overview-active');
        return () => {
            document.documentElement.classList.remove('scd-overview-active');
            document.body.classList.remove('scd-overview-active');
        };
    }, []);

    const setFilter = useCallback((key: FilterKey, value: string): void => {
        setFilters((current) => ({ ...current, [key]: value }));
    }, []);
    const showSearchInfo = useCallback((record: SearchbaseRecord): void => {
        infoReturnFocusRef.current =
            document.activeElement instanceof HTMLElement ? document.activeElement : null;
        setInfoRecord(record);
    }, []);
    const clearFilter = (key: FilterKey): void =>
        setFilter(key, DEFAULT_FILTERS[key]);
    const clearFilters = (): void => setFilters(DEFAULT_FILTERS);
    const activeFilters = (Object.keys(filters) as FilterKey[]).filter(
        (key) => filters[key] !== DEFAULT_FILTERS[key]
    );
    const context = useMemo<PageContext>(
        () => ({
            catalogue,
            earliest,
            refreshToken,
            filters,
            showSearchInfo,
        }),
        [catalogue, earliest, refreshToken, filters, showSearchInfo]
    );

    const renderTab = (): React.ReactNode => {
        switch (activeTab) {
            case 'identity':
                return <IdentityTab context={context} />;
            case 'firewall':
                return <FirewallTab context={context} />;
            case 'network':
                return <NetworkTab context={context} setFilter={setFilter} />;
            case 'investigation':
                return (
                    <UserInvestigationTab
                        context={context}
                        setFilter={setFilter}
                    />
                );
            case 'overview':
            default:
                return <OverviewTab context={context} />;
        }
    };

    return (
        <div
            className="scd-glass scd-overview-page scd-c3-surface scd-c3-atmosphere"
        >
            <header className="scd-glass-header">
                <div className="scd-glass-title-block">
                    <div className="scd-glass-title-row">
                        <div>
                            <h1>Cisco Secure Networking — Operations Glass</h1>
                            <p>
                                Security Operations · Identity · Firewall ·
                                Health · Investigation
                            </p>
                        </div>
                    </div>
                    <div className="scd-glass-time">
                        <span>Time Range</span>
                        <Select
                            inline
                            labelText="Time Range"
                            value={earliest}
                            onChange={(_event, { value }) => setEarliest(String(value))}
                        >
                            {TIME_RANGES.map((range) => (
                                <Select.Option
                                    key={range.value}
                                    value={range.value}
                                    label={range.label}
                                />
                            ))}
                        </Select>
                    </div>
                </div>
                <div className="scd-glass-header-actions">
                    <Button
                        appearance="subtle"
                        className="scd-glass-icon-button"
                        onClick={() => setRefreshToken((token) => token + 1)}
                        aria-label="Refresh all dashboard searches"
                        icon={<RefreshCw size={17} aria-hidden />}
                    />
                    <Button
                        appearance="subtle"
                        className="scd-glass-icon-button"
                        aria-label="Notifications"
                        icon={<Bell size={17} aria-hidden />}
                    />
                    <Button
                        appearance="subtle"
                        className="scd-glass-panel-toggle"
                        onClick={() => setSidebarOpen((current) => !current)}
                        icon={sidebarOpen ? (
                            <PanelRightClose size={17} />
                        ) : (
                            <PanelRightOpen size={17} />
                        )}
                        label={sidebarOpen ? 'Close Panel' : 'Open Panel'}
                    />
                </div>
            </header>
            <div
                className="scd-glass-tabs"
                aria-label="Dashboard sections"
                role="tablist"
            >
                {TABS.map((tab) => {
                    const Icon = tab.icon;
                    return (
                        <button
                            type="button"
                            key={tab.id}
                            className={activeTab === tab.id ? 'is-active' : ''}
                            onClick={() => setActiveTab(tab.id)}
                            role="tab"
                            id={`scd-glass-tab-${tab.id}`}
                            aria-selected={activeTab === tab.id}
                            aria-controls={`scd-glass-panel-${tab.id}`}
                        >
                            <Icon size={16} />
                            <span>{tab.label}</span>
                        </button>
                    );
                })}
            </div>
            {activeFilters.length > 0 ? (
                <div className="scd-glass-active-filters">
                    <Filter size={15} />
                    <strong>Active Filters</strong>
                    {activeFilters.map((key) => (
                        <button
                            type="button"
                            key={key}
                            onClick={() => clearFilter(key)}
                        >
                            <span>{FILTER_LABELS[key]}:</span>
                            {filters[key]}
                            <X size={13} />
                        </button>
                    ))}
                    <button
                        type="button"
                        className="scd-glass-clear"
                        onClick={clearFilters}
                    >
                        Clear all
                    </button>
                </div>
            ) : null}
            {catalogueError ? (
                <div className="scd-glass-catalogue-warning">
                    <AlertTriangle size={16} />
                    {catalogueError}
                </div>
            ) : null}
            <div
                className={`scd-glass-workspace ${
                    sidebarOpen ? 'has-sidebar' : ''
                }`}
            >
                <main
                    id={`scd-glass-panel-${activeTab}`}
                    role="tabpanel"
                    aria-labelledby={`scd-glass-tab-${activeTab}`}
                >
                    {renderTab()}
                </main>
                {sidebarOpen ? (
                    <FilterSidebar
                        context={context}
                        filters={filters}
                        setFilter={setFilter}
                    />
                ) : null}
            </div>
            <span className="scd-glass-view-id" aria-hidden="true">
                {titleFromPath()}
            </span>
            {infoRecord ? (
                <SearchInfoDialog
                    record={infoRecord}
                    onClose={() => setInfoRecord(null)}
                    returnFocus={infoReturnFocusRef}
                />
            ) : null}
        </div>
    );
};

export default SecureOperationsGlassPage;
