import React, {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import TimeRangeDropdown from '@splunk/react-time-range/Dropdown';
import Badge from '@splunk/react-ui/Badge';
import Button from '@splunk/react-ui/Button';
import Card from '@splunk/react-ui/Card';
import Dropdown from '@splunk/react-ui/Dropdown';
import Heading from '@splunk/react-ui/Heading';
import Menu from '@splunk/react-ui/Menu';
import ScreenReaderContent from '@splunk/react-ui/ScreenReaderContent';
import Select from '@splunk/react-ui/Select';
import SpotLight from '@splunk/react-ui/SpotLight';
import TabLayout from '@splunk/react-ui/TabLayout';
import { variables } from '@splunk/themes';

import AppearanceMenuItems from '@/common/components/AppearanceMenuItems';
import {
    SearchbaseDrilldownGuidance,
    type SearchbaseDrilldownMetadata,
} from '@/common/components/workspace/SearchbaseDrilldownGuidance';
import { WorkspaceModalShell } from '@/common/components/workspace/WorkspaceModalShell';
import {
    AlertTriangle,
    ArrowDown,
    ArrowUp,
    ArrowUpDown,
    ArrowUpRight,
    CheckCircle2,
    ExternalLink,
    FileSearch,
    Info,
    MoreVertical,
    NodeModel,
    RefreshCw,
    RobotFaceWrench,
    Server,
    ShieldKeyhole,
    WallBricks,
    type SuiIcon,
} from '@/common/icons/SuiIcon';
import { cn } from '@/common/lib/utils';
import { splunkSearchAppUrl } from '@/common/lib/splunkSearchUrl';
import type { SearchbaseRecord } from '@/common/services/searchbaseCatalogue';
import {
    useAppThemeControls,
    type AppColorScheme,
} from '@/common/theme/AppThemeProvider';

import timeParser from '../dashboardbuilder/custominput/timeparser';

import { formatPillarValue, PillarVisualization } from './charts';
import {
    DEFAULT_PILLAR_TIME_RANGE,
    isPillarId,
    PILLARS,
    PILLAR_TIME_RANGES,
    type PillarCardDefinition,
    type PillarDefinition,
    type PillarIconName,
    type PillarId,
    type PillarTimeRange,
    ZERO_TRUST_CARDS,
} from './config';
import {
    lastFiniteValue,
    lastTwoFiniteValues,
    toFiniteNumber,
    usePillarCatalogue,
    usePillarSearch,
    visibleColumns,
    type PillarSearchRow,
} from './search';

type CardDialogKind = 'about' | 'investigate';

interface CardDialogState {
    kind: CardDialogKind;
    card: PillarCardDefinition;
}

type HealthTone = 'healthy' | 'warning' | 'critical' | 'informational' | 'unknown';
type SortDirection = 'ascending' | 'descending';

interface DetailSort {
    field: string;
    direction: SortDirection;
}

interface TimeRangeChange {
    earliest?: string | null;
    latest?: string | null;
}

interface TimeParseResult {
    error?: Record<string, unknown>;
    iso?: string;
    time?: string;
    displayValue?: string;
}

const PILLAR_ICONS: Record<PillarIconName, SuiIcon> = {
    'shield-keyhole': ShieldKeyhole,
    servers: Server,
    'node-model': NodeModel,
    'wall-bricks': WallBricks,
    'robot-face-wrench': RobotFaceWrench,
};

const APP_NAME = 'splunk-cisco-dashboards';
const MIN_DASHBOARD_HEIGHT_PX = 520;
const DETAIL_PAGE_SIZE = 50;

const normalizeTimeParseResult = (
    result: TimeParseResult,
    fallbackTime: string
): TimeParseResult => ({
    error: result.error
        ? { message: String(result.error.message || result.error) }
        : undefined,
    iso: result.iso,
    time: result.time || fallbackTime,
    displayValue: result.displayValue,
});

const useTimeRangeParser = (): {
    parseEarliest: TimeParseResult | undefined;
    parseLatest: TimeParseResult | undefined;
    handleRequestParseEarliest: (time: string) => void;
    handleRequestParseLatest: (time: string) => void;
} => {
    const [parseEarliest, setParseEarliest] = useState<TimeParseResult>();
    const [parseLatest, setParseLatest] = useState<TimeParseResult>();
    const mountedRef = useRef(true);
    const earliestRequestRef = useRef(0);
    const latestRequestRef = useRef(0);

    useEffect(
        () => () => {
            mountedRef.current = false;
        },
        []
    );

    const handleRequestParseEarliest = useCallback((time: string) => {
        const requestId = earliestRequestRef.current + 1;
        earliestRequestRef.current = requestId;
        void timeParser(time, 'en_US')
            .then((result: TimeParseResult) => {
                if (mountedRef.current && requestId === earliestRequestRef.current) {
                    setParseEarliest(normalizeTimeParseResult(result, time));
                }
            })
            .catch(() => {
                if (mountedRef.current && requestId === earliestRequestRef.current) {
                    setParseEarliest({
                        error: { message: 'The time string could not be parsed' },
                        time,
                    });
                }
            });
    }, []);

    const handleRequestParseLatest = useCallback((time: string) => {
        const requestId = latestRequestRef.current + 1;
        latestRequestRef.current = requestId;
        void timeParser(time || 'now', 'en_US')
            .then((result: TimeParseResult) => {
                if (mountedRef.current && requestId === latestRequestRef.current) {
                    setParseLatest(normalizeTimeParseResult(result, time));
                }
            })
            .catch(() => {
                if (mountedRef.current && requestId === latestRequestRef.current) {
                    setParseLatest({
                        error: { message: 'The time string could not be parsed' },
                        time,
                    });
                }
            });
    }, []);

    return {
        parseEarliest,
        parseLatest,
        handleRequestParseEarliest,
        handleRequestParseLatest,
    };
};

const useAvailableDashboardHeight = (): number | null => {
    const [height, setHeight] = useState<number | null>(null);

    useLayoutEffect(() => {
        if (typeof window === 'undefined') return undefined;
        let animationFrame = 0;
        let cancelled = false;

        const measure = (): void => {
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
                    current !== null && Math.abs(current - next) < 2 ? current : next
                );
            });
        };

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
            settleTimers.forEach((timer) => window.clearTimeout(timer));
            window.removeEventListener('resize', measure);
            window.removeEventListener('orientationchange', measure);
        };
    }, []);

    return height;
};

const localePrefix = (): string => {
    if (typeof window === 'undefined') return '/en-US';
    const match = window.location.pathname.match(/^\/([a-z]{2}-[A-Z]{2})(?:\/|$)/);
    return `/${match?.[1] ?? 'en-US'}`;
};

const studioDashboardUrl = (viewName: string): string =>
    `${localePrefix()}/app/${APP_NAME}/dashboard_manager#/${encodeURIComponent(viewName)}`;

const readPillarFromLocation = (): PillarId => {
    if (typeof window === 'undefined') return PILLARS[0].id;
    const requested = new URLSearchParams(window.location.search).get('pillar');
    return isPillarId(requested) ? requested : PILLARS[0].id;
};

const metadataFromRecord = (record: SearchbaseRecord): SearchbaseDrilldownMetadata => ({
    title: record.searchName,
    category: record.category,
    subCategory: record.subCategory,
    description: record.description,
    explanation: record.explanation,
    solution: record.solution,
    relatedInfo: record.relatedInfo,
    executionPlan: record.executionPlan,
});

const formatHeadline = (value: number | null, unit: string): string => {
    if (value === null) return '—';
    const fractionDigits = unit === '%' ? 1 : 2;
    return formatPillarValue(value, fractionDigits);
};

const formatDetailCell = (value: unknown): string => {
    if (value === null || value === undefined || value === '') return '—';
    const numeric = toFiniteNumber(value);
    if (numeric !== null && !String(value).includes('-')) {
        return formatPillarValue(numeric, 2);
    }
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object') {
        try {
            return JSON.stringify(value);
        } catch {
            return String(value);
        }
    }
    return String(value);
};

const compareDetailValues = (left: unknown, right: unknown): number => {
    const leftNumber = toFiniteNumber(left);
    const rightNumber = toFiniteNumber(right);
    if (leftNumber !== null && rightNumber !== null) return leftNumber - rightNumber;
    return String(left ?? '').localeCompare(String(right ?? ''), undefined, {
        numeric: true,
        sensitivity: 'base',
    });
};

const resolveHealthTone = (
    card: PillarCardDefinition,
    value: number | null
): HealthTone => {
    if (value === null) return 'unknown';
    if (!card.thresholds) return 'informational';
    if (value <= card.thresholds.healthyMax) return 'healthy';
    if (value <= card.thresholds.warningMax) return 'warning';
    return 'critical';
};

const HEALTH_LABELS: Record<HealthTone, string> = {
    healthy: 'Healthy',
    warning: 'Attention',
    critical: 'Critical',
    informational: 'Observed',
    unknown: 'No signal',
};

const PillarCard = ({
    card,
    catalogue,
    range,
    refreshToken,
    enabled,
    colorScheme,
    onDialog,
}: {
    card: PillarCardDefinition;
    catalogue: Map<string, SearchbaseRecord> | null;
    range: PillarTimeRange;
    refreshToken: number;
    enabled: boolean;
    colorScheme: AppColorScheme;
    onDialog: (state: CardDialogState) => void;
}): JSX.Element => {
    const { rows, loading, error } = usePillarSearch({
        catalogue,
        searchId: card.searchId,
        range,
        refreshToken,
        enabled,
        zeroOnlyIsEmpty: true,
    });
    const headline = lastFiniteValue(rows, card.headlineField);
    const deltaPair = card.deltaField
        ? lastTwoFiniteValues(rows, card.deltaField)
        : null;
    const delta = deltaPair ? deltaPair[0] - deltaPair[1] : null;
    const tone = error ? 'unknown' : resolveHealthTone(card, headline);
    const DeltaIcon = delta === 0 ? ArrowUpDown : delta !== null && delta < 0 ? ArrowDown : ArrowUp;
    const dataStatus = loading ? 'loading' : error ? 'error' : rows.length ? 'live' : 'empty';

    return (
        <Card
            className={cn('scd-pillar-card', card.featured && 'scd-pillar-card-featured')}
            data-card-id={card.id}
            data-data-status={dataStatus}
            data-health-tone={tone}
            tag="article"
        >
            <Card.Body className="scd-pillar-card-body">
                <div className="scd-pillar-card-header">
                    <div className="scd-pillar-card-title-block">
                        <p className="scd-pillar-eyebrow">Identity · Zero Trust Access</p>
                        <Heading level={3} variant="title3">
                            {card.title}
                        </Heading>
                    </div>
                    <div className="scd-pillar-card-actions">
                        <Button
                            appearance="subtle"
                            className="scd-pillar-about-action"
                            hideLabel
                            icon={<Info aria-hidden="true" />}
                            label={`About ${card.title}`}
                            onClick={() => onDialog({ kind: 'about', card })}
                        />
                        <Button
                            appearance="standalone"
                            aria-label={`Investigate ${card.title}`}
                            icon={<FileSearch aria-hidden="true" />}
                            label="Investigate"
                            onClick={() => onDialog({ kind: 'investigate', card })}
                        />
                    </div>
                </div>
                <p className="scd-pillar-card-description">{card.description}</p>
                <ScreenReaderContent role="status">
                    {card.title}:{' '}
                    {loading
                        ? 'Loading live signal.'
                        : error
                          ? error
                          : rows.length
                            ? `${rows.length.toLocaleString()} results loaded.`
                            : `No evidence in ${range.label.toLowerCase()}.`}
                </ScreenReaderContent>

                <div className="scd-pillar-card-value-row">
                    <div className="scd-pillar-card-value-block">
                        <span className="scd-pillar-card-value">
                            {loading ? '…' : formatHeadline(headline, card.headlineUnit)}
                        </span>
                        <span className="scd-pillar-card-unit">{card.headlineUnit}</span>
                    </div>
                    <div className="scd-pillar-card-value-meta">
                        <span className={`scd-pillar-health-chip is-${tone}`}>
                            <span className="scd-pillar-status-dot" aria-hidden="true" />
                            {HEALTH_LABELS[tone]}
                        </span>
                        {delta !== null ? (
                            <span
                                className="scd-pillar-delta"
                                title="Change from the previous time bucket"
                            >
                                <DeltaIcon aria-hidden="true" />
                                {delta === 0
                                    ? 'Unchanged vs prior bucket'
                                    : `${Math.abs(delta).toLocaleString(undefined, {
                                          maximumFractionDigits: 1,
                                      })} ${delta > 0 ? 'increase' : 'decrease'} vs prior bucket`}
                            </span>
                        ) : null}
                    </div>
                </div>

                <div className="scd-pillar-card-visual" aria-busy={loading}>
                    {loading ? (
                        <div className="scd-pillar-card-state">
                            <span className="scd-pillar-loading-mark" aria-hidden="true" />
                            <span>Loading live signal…</span>
                        </div>
                    ) : error ? (
                        <div className="scd-pillar-card-state is-error">
                            <AlertTriangle aria-hidden="true" />
                            <span>{error}</span>
                        </div>
                    ) : rows.length === 0 ? (
                        <div className="scd-pillar-card-state">
                            <span>No evidence in {range.label.toLowerCase()}.</span>
                        </div>
                    ) : (
                        <PillarVisualization
                            card={card}
                            rows={rows}
                            colorScheme={colorScheme}
                        />
                    )}
                </div>
                <div className="scd-pillar-card-footer">
                    <span className="scd-pillar-live-label">
                        <span
                            className={cn(
                                'scd-pillar-live-dot',
                                dataStatus === 'live' && 'is-live',
                                dataStatus === 'loading' && 'is-loading'
                            )}
                            aria-hidden="true"
                        />
                        {dataStatus === 'live'
                            ? 'Live Searchbase data'
                            : dataStatus === 'loading'
                              ? 'Refreshing'
                              : dataStatus === 'error'
                                ? 'Search unavailable'
                                : 'No matching telemetry'}
                    </span>
                    <span>{range.shortLabel}</span>
                </div>
            </Card.Body>
        </Card>
    );
};

const AboutMetricDialog = ({
    card,
    catalogue,
    range,
    onClose,
}: {
    card: PillarCardDefinition;
    catalogue: Map<string, SearchbaseRecord> | null;
    range: PillarTimeRange;
    onClose: () => void;
}): JSX.Element => {
    const record = catalogue?.get(card.searchId) ?? null;
    const searchUrl = record
        ? splunkSearchAppUrl(record.search, range, record.dispatchContext)
        : undefined;

    return (
        <WorkspaceModalShell
            variant="metric"
            title={card.title}
            subtitle="Metric definition, interpretation, and operating guidance"
            onClose={onClose}
            openInSearchHref={searchUrl}
            headerMeta={
                <Badge
                    backgroundColor={variables.backgroundColorSection}
                    foregroundColor={variables.contentColorInfo}
                    label="Zero Trust Access"
                />
            }
            contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden sui-bg-page"
        >
            {record ? (
                <>
                    <div className="scd-pillar-guidance-heading">
                        <Heading level={3} variant="title3">
                            About this metric
                        </Heading>
                    </div>
                    <SearchbaseDrilldownGuidance
                        metadata={metadataFromRecord(record)}
                        heading="Guidance sections"
                        summary="Definition, interpretation, response, and references"
                    />
                </>
            ) : (
                <div className="scd-pillar-modal-state">
                    <AlertTriangle aria-hidden="true" />
                    <p>The metric metadata is not available in this Splunk instance.</p>
                </div>
            )}
        </WorkspaceModalShell>
    );
};

const InvestigationDialog = ({
    card,
    catalogue,
    range,
    refreshToken,
    onClose,
}: {
    card: PillarCardDefinition;
    catalogue: Map<string, SearchbaseRecord> | null;
    range: PillarTimeRange;
    refreshToken: number;
    onClose: () => void;
}): JSX.Element => {
    const configuredTargetIds = useMemo(() => {
        const primaryRecord = catalogue?.get(card.searchId) ?? null;
        return [
            ...card.drilldownIds,
            ...(primaryRecord?.drilldownSearchNames ?? []),
        ];
    }, [card.drilldownIds, card.searchId, catalogue]);
    const targets = useMemo(() => {
        const seen = new Set<string>();
        return configuredTargetIds
            .map((identity) => catalogue?.get(identity) ?? null)
            .filter((record): record is SearchbaseRecord => {
                if (!record || seen.has(record.id)) return false;
                seen.add(record.id);
                return true;
            });
    }, [catalogue, configuredTargetIds]);
    const [activeTargetId, setActiveTargetId] = useState(configuredTargetIds[0] ?? '');
    const [sort, setSort] = useState<DetailSort | null>(null);
    const [page, setPage] = useState(0);

    useEffect(() => {
        setActiveTargetId(targets[0]?.id ?? configuredTargetIds[0] ?? '');
        setSort(null);
        setPage(0);
    }, [configuredTargetIds, targets]);

    const activeRecord =
        targets.find((record) => record.id === activeTargetId) ?? targets[0] ?? null;
    const searchState = usePillarSearch({
        catalogue,
        searchId: activeRecord?.id ?? activeTargetId,
        range,
        refreshToken,
        enabled: Boolean(activeRecord),
        count: 0,
    });
    const columns = useMemo(() => {
        const discovered = visibleColumns(searchState.rows);
        const hasTime = searchState.rows.some((row) => row._time !== undefined);
        return [...(hasTime ? ['_time'] : []), ...discovered];
    }, [searchState.rows]);
    const sortedRows = useMemo(() => {
        if (!sort) return searchState.rows;
        return [...searchState.rows].sort((left, right) => {
            const comparison = compareDetailValues(left[sort.field], right[sort.field]);
            return sort.direction === 'ascending' ? comparison : -comparison;
        });
    }, [searchState.rows, sort]);
    const pageCount = Math.max(1, Math.ceil(sortedRows.length / DETAIL_PAGE_SIZE));
    const displayedRows = useMemo(
        () => sortedRows.slice(page * DETAIL_PAGE_SIZE, (page + 1) * DETAIL_PAGE_SIZE),
        [page, sortedRows]
    );

    useEffect(() => {
        setPage((current) => Math.min(current, pageCount - 1));
    }, [pageCount]);
    const searchUrl = activeRecord
        ? splunkSearchAppUrl(activeRecord.search, range, activeRecord.dispatchContext)
        : undefined;
    const detailStatusMessage =
        targets.length === 0
            ? 'The configured drilldown searches are not available.'
            : searchState.loading
              ? `Running ${activeRecord?.searchName ?? 'investigation search'}.`
              : searchState.error
                ? searchState.error
                : `${searchState.rows.length.toLocaleString()} investigation results loaded.`;

    const cycleSort = (field: string): void => {
        setPage(0);
        setSort((current) => {
            if (current?.field !== field) return { field, direction: 'ascending' };
            if (current.direction === 'ascending') return { field, direction: 'descending' };
            return null;
        });
    };

    return (
        <WorkspaceModalShell
            variant="detail"
            title={`${card.title} investigation`}
            subtitle={`${range.label} · ${targets.length || configuredTargetIds.length} contextual searches`}
            onClose={onClose}
            openInSearchHref={searchUrl}
            wide
            contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden sui-bg-page"
            headerMeta={
                activeRecord ? (
                    <Badge
                        backgroundColor={variables.backgroundColorSection}
                        foregroundColor={variables.contentColorInfo}
                        label={activeRecord.subCategory || 'Zero Trust Access'}
                    />
                ) : undefined
            }
        >
            <div
                className="scd-pillar-drilldown-tabs"
                role="group"
                aria-label="Investigation searches"
            >
                {targets.map((target, index) => (
                    <Button
                        key={target.id}
                        appearance={target.id === activeRecord?.id ? 'primary' : 'subtle'}
                        aria-pressed={target.id === activeRecord?.id}
                        label={`${index + 1}. ${target.searchName.replace(/^Secure Networking - /, '')}`}
                        onClick={() => {
                            setActiveTargetId(target.id);
                            setSort(null);
                            setPage(0);
                        }}
                    />
                ))}
            </div>

            <section
                className="scd-pillar-detail-results"
                aria-busy={searchState.loading}
            >
                <ScreenReaderContent role="status">
                    {detailStatusMessage}
                </ScreenReaderContent>
                <div className="scd-pillar-detail-heading">
                    <div>
                        <p className="scd-pillar-eyebrow">
                            {activeRecord
                                ? [activeRecord.category, activeRecord.subCategory]
                                      .filter(Boolean)
                                      .join(' · ')
                                : 'Investigation'}
                        </p>
                        <Heading level={3} variant="title3">
                            {activeRecord?.searchName ?? 'Search unavailable'}
                        </Heading>
                    </div>
                    {!searchState.loading && !searchState.error ? (
                        <span className="scd-pillar-result-count">
                            {searchState.rows.length.toLocaleString()} results
                            {searchState.rows.length > DETAIL_PAGE_SIZE
                                ? ` · Page ${page + 1} of ${pageCount}`
                                : ''}
                        </span>
                    ) : null}
                </div>

                {targets.length === 0 ? (
                    <div className="scd-pillar-modal-state">
                        <AlertTriangle aria-hidden="true" />
                        <p>The configured drilldown searches are not available.</p>
                    </div>
                ) : searchState.loading ? (
                    <div className="scd-pillar-modal-state">
                        <span className="scd-pillar-loading-mark" aria-hidden="true" />
                        <p>Running {activeRecord?.searchName.toLowerCase()}…</p>
                    </div>
                ) : searchState.error ? (
                    <div className="scd-pillar-modal-state is-error">
                        <AlertTriangle aria-hidden="true" />
                        <p>{searchState.error} Open the query in Search for diagnostics.</p>
                    </div>
                ) : displayedRows.length === 0 ? (
                    <div className="scd-pillar-modal-state">
                        <CheckCircle2 aria-hidden="true" />
                        <p>No matching evidence in {range.label.toLowerCase()}.</p>
                    </div>
                ) : (
                    <div className="scd-pillar-detail-table-wrap">
                        <table className="scd-pillar-detail-table">
                            <caption>
                                <ScreenReaderContent>
                                    {activeRecord?.searchName} results
                                </ScreenReaderContent>
                            </caption>
                            <thead>
                                <tr>
                                    {columns.map((column) => {
                                        const activeSort = sort?.field === column ? sort : null;
                                        const SortIcon = !activeSort
                                            ? ArrowUpDown
                                            : activeSort.direction === 'ascending'
                                              ? ArrowUp
                                              : ArrowDown;
                                        return (
                                            <th
                                                key={column}
                                                scope="col"
                                                aria-sort={activeSort?.direction ?? 'none'}
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => cycleSort(column)}
                                                >
                                                    <span>{column === '_time' ? 'Time' : column}</span>
                                                    <SortIcon aria-hidden="true" />
                                                </button>
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody>
                                {displayedRows.map((row, rowIndex) => (
                                    <tr key={`detail-row-${rowIndex}`}>
                                        {columns.map((column) => (
                                            <td key={column}>{formatDetailCell(row[column])}</td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {sortedRows.length > DETAIL_PAGE_SIZE ? (
                            <div className="scd-pillar-detail-pager">
                                <span>
                                    Showing{' '}
                                    {(page * DETAIL_PAGE_SIZE + 1).toLocaleString()}–
                                    {Math.min(
                                        (page + 1) * DETAIL_PAGE_SIZE,
                                        sortedRows.length
                                    ).toLocaleString()}{' '}
                                    of {sortedRows.length.toLocaleString()}
                                </span>
                                <div>
                                    <Button
                                        appearance="subtle"
                                        disabled={page === 0}
                                        label="Previous page"
                                        onClick={() => setPage((current) => current - 1)}
                                    />
                                    <Button
                                        appearance="subtle"
                                        disabled={page >= pageCount - 1}
                                        label="Next page"
                                        onClick={() => setPage((current) => current + 1)}
                                    />
                                </div>
                            </div>
                        ) : null}
                    </div>
                )}
            </section>

            {activeRecord ? (
                <SearchbaseDrilldownGuidance
                    metadata={metadataFromRecord(activeRecord)}
                    defaultExpanded={false}
                    heading="Investigation guidance"
                    summary="Why this matters and what to do next"
                />
            ) : null}
        </WorkspaceModalShell>
    );
};

const PillarPreview = ({ pillar }: { pillar: PillarDefinition }): JSX.Element => {
    const Icon = PILLAR_ICONS[pillar.icon];
    return (
        <div className="scd-pillar-preview">
            <Card className="scd-pillar-preview-card" tag="section">
                <Card.Body className="scd-pillar-preview-body">
                    <div className="scd-pillar-preview-icon">
                        <Icon aria-hidden="true" />
                    </div>
                    <Badge
                        backgroundColor={variables.backgroundColorSection}
                        foregroundColor={variables.contentColorInfo}
                        label="Conversion slot ready"
                    />
                    <Heading level={2} variant="title2">
                        {pillar.dashboardTitle}
                    </Heading>
                    <p>{pillar.description}</p>
                    <p className="scd-pillar-preview-note">
                        This tab is wired into the shared React shell. Zero Trust Access is the
                        implemented pilot; this pillar can follow the same native data, chart,
                        theme, and investigation contracts.
                    </p>
                    <Button
                        appearance="secondary"
                        icon={<ExternalLink aria-hidden="true" />}
                        label="Open current Studio dashboard"
                        openInNewContext
                        to={studioDashboardUrl(pillar.studioView)}
                    />
                </Card.Body>
            </Card>
        </div>
    );
};

const ZeroTrustDashboard = ({
    catalogue,
    catalogueError,
    range,
    refreshToken,
    enabled,
    colorScheme,
    onDialog,
}: {
    catalogue: Map<string, SearchbaseRecord> | null;
    catalogueError: string | null;
    range: PillarTimeRange;
    refreshToken: number;
    enabled: boolean;
    colorScheme: AppColorScheme;
    onDialog: (state: CardDialogState) => void;
}): JSX.Element => (
    <div className="scd-pillar-dashboard" data-pillar-dashboard="zero-trust-access">
        <section className="scd-pillar-hero" aria-labelledby="zero-trust-title">
            <div className="scd-pillar-hero-main">
                <div className="scd-pillar-hero-icon">
                    <ShieldKeyhole aria-hidden="true" />
                </div>
                <div>
                    <div className="scd-pillar-hero-badges">
                        <Badge
                            backgroundColor={variables.backgroundColorSection}
                            foregroundColor={variables.contentColorInfo}
                            label="React pilot"
                        />
                        <Badge
                            backgroundColor={variables.backgroundColorSection}
                            foregroundColor={variables.contentColorPositive}
                            label="6 Searchbase signals"
                        />
                    </div>
                    <Heading id="zero-trust-title" level={2} variant="title2">
                        Zero Trust Posture
                    </Heading>
                    <p>
                        Connect identity, posture, policy, and response signals across the
                        access journey.
                    </p>
                </div>
            </div>
            <ol className="scd-pillar-journey" aria-label="Zero Trust control journey">
                {['ISE authentication', 'Duo MFA', 'Private access', 'Remote access'].map(
                    (stage, index) => (
                        <li className="scd-pillar-journey-stage" key={stage}>
                            <span aria-hidden="true">{index + 1}</span>
                            {stage}
                        </li>
                    )
                )}
            </ol>
        </section>

        {catalogueError ? (
            <div className="scd-pillar-catalogue-warning" role="status">
                <AlertTriangle aria-hidden="true" />
                {catalogueError} Choose Refresh to retry the catalogue and live searches.
            </div>
        ) : null}

        <section className="scd-pillar-grid" aria-label="Zero Trust posture signals">
            {ZERO_TRUST_CARDS.map((card) => (
                <PillarCard
                    key={card.id}
                    card={card}
                    catalogue={catalogue}
                    range={range}
                    refreshToken={refreshToken}
                    enabled={enabled}
                    colorScheme={colorScheme}
                    onDialog={onDialog}
                />
            ))}
        </section>
    </div>
);

const SecureNetworkingPillarsPage = (): JSX.Element => {
    const { colorScheme } = useAppThemeControls();
    const [activePillar, setActivePillar] = useState<PillarId>(readPillarFromLocation);
    const [range, setRange] = useState<PillarTimeRange>(DEFAULT_PILLAR_TIME_RANGE);
    const [refreshToken, setRefreshToken] = useState(0);
    const { byIdentity: catalogue, error: catalogueError } =
        usePillarCatalogue(refreshToken);
    const availableDashboardHeight = useAvailableDashboardHeight();
    const [lastRefreshed, setLastRefreshed] = useState(() => new Date());
    const [actionsOpen, setActionsOpen] = useState(false);
    const [dialog, setDialog] = useState<CardDialogState | null>(null);
    const actionsToggleRef = useRef<HTMLAnchorElement | HTMLButtonElement>(null);
    const timeRangeParser = useTimeRangeParser();

    const activeDefinition =
        PILLARS.find((pillar) => pillar.id === activePillar) ?? PILLARS[0];
    const dashboardShellStyle = useMemo<React.CSSProperties>(
        () => ({
            colorScheme,
            height:
                availableDashboardHeight !== null
                    ? `${availableDashboardHeight}px`
                    : '100vh',
        }),
        [availableDashboardHeight, colorScheme]
    );

    useEffect(() => {
        document.documentElement.classList.add('scd-overview-active');
        document.body.classList.add('scd-overview-active');
        const onPopState = (): void => setActivePillar(readPillarFromLocation());
        window.addEventListener('popstate', onPopState);
        return () => {
            window.removeEventListener('popstate', onPopState);
            document.documentElement.classList.remove('scd-overview-active');
            document.body.classList.remove('scd-overview-active');
        };
    }, []);

    const changePillar = useCallback((next: PillarId): void => {
        setActivePillar(next);
        if (typeof window === 'undefined') return;
        const url = new URL(window.location.href);
        url.searchParams.set('pillar', next);
        window.history.pushState({ pillar: next }, '', url);
    }, []);

    const refresh = (): void => {
        setRefreshToken((token) => token + 1);
        setLastRefreshed(new Date());
    };

    const changeTimeRange = useCallback(
        (_event: React.SyntheticEvent, data?: TimeRangeChange): void => {
            setRange((current) => {
                const earliest = data?.earliest ?? current.earliest;
                const latest = data?.latest ?? current.latest;
                const preset = PILLAR_TIME_RANGES.find(
                    (candidate) =>
                        candidate.earliest === earliest && candidate.latest === latest
                );
                return (
                    preset ?? {
                        label: `${earliest} to ${latest}`,
                        shortLabel: 'Custom',
                        earliest,
                        latest,
                    }
                );
            });
        },
        []
    );

    return (
        <div
            className="scd-pillar-page scd-overview-page scd-c3-surface scd-one-cisco-spotlight-canvas sui-bg-page sui-color-default"
            data-color-scheme={colorScheme}
            style={dashboardShellStyle}
        >
            <SpotLight aria-hidden="true" variant="page-top" intensity="low" scale={0.5} />

            <header className="scd-pillar-toolbar scd-c3-toolbar">
                <div className="scd-pillar-branding">
                    <div className="scd-pillar-brand-mark">
                        <ShieldKeyhole aria-hidden="true" />
                    </div>
                    <div className="scd-pillar-brand-copy">
                        <Heading level={1} variant="title1">
                            Secure Networking Pillars
                        </Heading>
                        <p>React-native operational dashboards · side-by-side Studio comparison</p>
                    </div>
                </div>
                <div className="scd-pillar-toolbar-actions">
                    <div className="scd-pillar-time-range">
                        <TimeRangeDropdown
                            appearance="subtle"
                            aria-label="Dashboard time range"
                            earliest={range.earliest}
                            inline
                            labelMaxChars={24}
                            latest={range.latest}
                            onChange={changeTimeRange}
                            onRequestParseEarliest={
                                timeRangeParser.handleRequestParseEarliest
                            }
                            onRequestParseLatest={timeRangeParser.handleRequestParseLatest}
                            parseEarliest={timeRangeParser.parseEarliest}
                            parseLatest={timeRangeParser.parseLatest}
                            presets={[...PILLAR_TIME_RANGES]}
                            realTimeDisabled
                        />
                    </div>
                    <Button
                        appearance="subtle"
                        hideLabel
                        icon={<RefreshCw aria-hidden="true" />}
                        label={`Refresh all pillar searches. Last refreshed ${lastRefreshed.toLocaleTimeString(
                            [],
                            { hour: '2-digit', minute: '2-digit' }
                        )}`}
                        onClick={refresh}
                    />
                    <Dropdown
                        focusToggleReasons={['escapeKey', 'tabKey', 'toggleClick']}
                        open={actionsOpen}
                        onRequestClose={() => setActionsOpen(false)}
                        onRequestOpen={() => setActionsOpen(true)}
                        toggle={
                            <Button
                                appearance="subtle"
                                elementRef={actionsToggleRef}
                                hideLabel
                                icon={<MoreVertical aria-hidden="true" />}
                                label="Dashboard actions"
                            />
                        }
                    >
                        <Menu>
                            <Menu.Heading title>Dashboard controls</Menu.Heading>
                            <Menu.Item
                                to={studioDashboardUrl(activeDefinition.studioView)}
                                openInNewContext
                                startAdornment={<ExternalLink aria-hidden="true" />}
                            >
                                Open {activeDefinition.dashboardTitle} in Studio
                            </Menu.Item>
                            <AppearanceMenuItems onSelect={() => setActionsOpen(false)} />
                        </Menu>
                    </Dropdown>
                </div>
            </header>

            <main className="scd-pillar-main">
                <Select
                    className="scd-pillar-mobile-selector"
                    labelText="Pillar dashboard"
                    value={activePillar}
                    onChange={(_event, { value }) => {
                        if (isPillarId(value)) changePillar(value);
                    }}
                >
                    {PILLARS.map((pillar) => (
                        <Select.Option
                            key={pillar.id}
                            label={pillar.label}
                            value={pillar.id}
                        />
                    ))}
                </Select>
                <TabLayout
                    activePanelId={activePillar}
                    className="scd-pillar-tabs"
                    maxTabWidth={260}
                    onChange={(_event, { activePanelId }) => {
                        if (isPillarId(activePanelId)) changePillar(activePanelId);
                    }}
                >
                    {PILLARS.map((pillar) => {
                        const Icon = PILLAR_ICONS[pillar.icon];
                        return (
                            <TabLayout.Panel
                                key={pillar.id}
                                icon={<Icon aria-hidden="true" />}
                                inset={false}
                                label={pillar.shortLabel}
                                panelId={pillar.id}
                                tooltip={pillar.label}
                            >
                                {pillar.implemented ? (
                                    <ZeroTrustDashboard
                                        catalogue={catalogue}
                                        catalogueError={catalogueError}
                                        range={range}
                                        refreshToken={refreshToken}
                                        enabled={activePillar === pillar.id}
                                        colorScheme={colorScheme}
                                        onDialog={setDialog}
                                    />
                                ) : (
                                    <PillarPreview pillar={pillar} />
                                )}
                            </TabLayout.Panel>
                        );
                    })}
                </TabLayout>
            </main>

            <footer className="scd-pillar-footer">
                <span>React pilot · same Searchbase contracts as Dashboard Manager</span>
                <Button
                    appearance="standalone"
                    icon={<ArrowUpRight aria-hidden="true" />}
                    label="Compare with Studio"
                    openInNewContext
                    to={studioDashboardUrl(activeDefinition.studioView)}
                />
            </footer>

            {dialog?.kind === 'about' ? (
                <AboutMetricDialog
                    key={`about-${dialog.card.id}`}
                    card={dialog.card}
                    catalogue={catalogue}
                    range={range}
                    onClose={() => setDialog(null)}
                />
            ) : null}
            {dialog?.kind === 'investigate' ? (
                <InvestigationDialog
                    key={`investigate-${dialog.card.id}`}
                    card={dialog.card}
                    catalogue={catalogue}
                    range={range}
                    refreshToken={refreshToken}
                    onClose={() => setDialog(null)}
                />
            ) : null}
        </div>
    );
};

export default SecureNetworkingPillarsPage;
