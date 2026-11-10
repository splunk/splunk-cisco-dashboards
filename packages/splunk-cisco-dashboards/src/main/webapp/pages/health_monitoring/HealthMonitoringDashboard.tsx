import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import {
    Bell,
    CalendarDays,
    Download,
    Grid2X2,
    Pause,
    Settings,
} from '@/common/icons/SuiIcon';
import { useExportPage } from '@/common/hooks/useExportPage';
import { cn } from '@/common/lib/utils';
import {
    createKPIInstance,
    DEFAULT_SECTION_TEMPLATE_IDS,
    getTemplateById,
    KPI_SECTION_TITLES,
    KPI_TEMPLATES,
    type KPIInstance,
    type KPISectionId,
    type KPITemplate,
} from '@/data/kpi-templates';
import { ExpandedKPIModal } from './components/ExpandedKPIModal';
import { GlobalKPISearch } from './components/GlobalKPISearch';
import { KPIBrowser } from './components/KPIBrowser';
import { KPIConfigModal } from './components/KPIConfigModal';
import { KPISection } from './components/KPISection';
import { SiteMap } from './components/SiteMap';

type MapPosition = 'right' | 'top' | 'bottom';

const SECTION_STORAGE_KEY = 'splunk-cisco-dashboards.health-monitoring.sections.v1';
const MAP_POSITION_STORAGE_KEY =
    'splunk-cisco-dashboards.health-monitoring.map-position';

interface ErrorBoundaryState {
    hasError: boolean;
    message?: string;
}

class ErrorBoundary extends React.Component<
    { children: React.ReactNode },
    ErrorBoundaryState
> {
    state: ErrorBoundaryState = { hasError: false };

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, message: error.message };
    }

    componentDidCatch(error: Error) {
        // eslint-disable-next-line no-console
        console.error('Health Monitoring Dashboard failed to render', error);
    }

    render() {
        if (!this.state.hasError) return this.props.children;
        return (
            <div className="flex min-h-screen items-center justify-center sui-bg-page p-8 sui-color-active">
                <div
                    aria-atomic="true"
                    className="max-w-xl rounded-xl border sui-border-notification-negative sui-bg-notification-negative p-6 shadow-2xl"
                    role="alert"
                >
                    <h1 className="text-xl font-black">Dashboard Error</h1>
                    <p className="mt-3 text-sm leading-6 sui-color-active">
                        The Health Monitoring Dashboard hit an unexpected render error.
                    </p>
                    {this.state.message && (
                        <pre className="mt-4 overflow-auto rounded-lg sui-bg-page p-3 text-xs sui-color-negative">
                            {this.state.message}
                        </pre>
                    )}
                </div>
            </div>
        );
    }
}

type SectionState = Record<KPISectionId, KPIInstance[]>;

const sectionIds: KPISectionId[] = [
    'it-health',
    'benefits',
    'building-intelligence',
];

const buildDefaultSections = (): SectionState =>
    sectionIds.reduce((acc, sectionId) => {
        acc[sectionId] = DEFAULT_SECTION_TEMPLATE_IDS[sectionId]
            .map((templateId) => getTemplateById(templateId))
            .filter((template): template is KPITemplate => Boolean(template))
            .map((template) => createKPIInstance(template, sectionId));
        return acc;
    }, {} as SectionState);

const isSectionState = (value: unknown): value is SectionState => {
    if (!value || typeof value !== 'object') return false;
    const maybe = value as Partial<Record<KPISectionId, unknown>>;
    return sectionIds.every((sectionId) => Array.isArray(maybe[sectionId]));
};

const readSections = (): SectionState => {
    const fallback = buildDefaultSections();
    if (typeof window === 'undefined') return fallback;
    try {
        const raw = window.localStorage.getItem(SECTION_STORAGE_KEY);
        if (!raw) return fallback;
        const parsed = JSON.parse(raw) as unknown;
        if (!isSectionState(parsed)) return fallback;
        return {
            'it-health': parsed['it-health'],
            benefits: parsed.benefits,
            'building-intelligence': parsed['building-intelligence'],
        };
    } catch {
        return fallback;
    }
};

const readMapPosition = (): MapPosition => {
    if (typeof window === 'undefined') return 'right';
    try {
        const saved = window.localStorage.getItem(MAP_POSITION_STORAGE_KEY);
        if (saved === 'right' || saved === 'top' || saved === 'bottom') {
            return saved;
        }
    } catch {
        // Best-effort persistence only.
    }
    return 'right';
};

const replaceKpi = (
    sections: SectionState,
    nextKpi: KPIInstance
): SectionState => ({
    ...sections,
    [nextKpi.sectionId]: sections[nextKpi.sectionId].map((kpi) =>
        kpi.instanceId === nextKpi.instanceId ? nextKpi : kpi
    ),
});

const matchesGlobalSearch = (kpi: KPIInstance, query: string): boolean => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [
        kpi.title,
        kpi.description,
        kpi.app,
        kpi.category,
        kpi.subCategory,
        ...kpi.tags,
    ]
        .join(' ')
        .toLowerCase()
        .includes(q);
};

const timeRangeToSplunkEarliest = (range: string): string => {
    switch (range) {
        case '24h':
            return '-24h@h';
        case '30d':
            return '-30d@d';
        case '90d':
            return '-90d@d';
        case '7d':
        default:
            return '-7d@d';
    }
};

const DashboardContent: React.FC = () => {
    const [sections, setSections] = useState<SectionState>(readSections);
    const [searchTerm, setSearchTerm] = useState('');
    const [timeRange, setTimeRange] = useState('7d');
    const [mapPosition, setMapPositionState] = useState<MapPosition>(readMapPosition);
    const [browserTarget, setBrowserTarget] = useState<KPISectionId | null>(null);
    const [configKpi, setConfigKpi] = useState<KPIInstance | null>(null);
    const [expandedKpi, setExpandedKpi] = useState<KPIInstance | null>(null);
    const exportRef = useRef<HTMLDivElement | null>(null);
    const { exporting, exportAs } = useExportPage({
        targetRef: exportRef,
        fileName: 'health-monitoring-dashboard',
    });

    useEffect(() => {
        try {
            window.localStorage.setItem(SECTION_STORAGE_KEY, JSON.stringify(sections));
        } catch {
            // Session state is still authoritative.
        }
    }, [sections]);

    const setMapPosition = useCallback((next: MapPosition) => {
        setMapPositionState(next);
        try {
            window.localStorage.setItem(MAP_POSITION_STORAGE_KEY, next);
        } catch {
            // Session state is still authoritative.
        }
    }, []);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                setBrowserTarget('it-health');
            }
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, []);

    const allKpis = useMemo(
        () => sectionIds.flatMap((sectionId) => sections[sectionId]),
        [sections]
    );
    const searchMatchCount = useMemo(
        () => allKpis.filter((kpi) => matchesGlobalSearch(kpi, searchTerm)).length,
        [allKpis, searchTerm]
    );
    const bindings = useMemo(() => {
        const out: Record<string, { instanceId: string; sectionId: KPISectionId }> = {};
        for (const kpi of allKpis) {
            out[kpi.templateId] = {
                instanceId: kpi.instanceId,
                sectionId: kpi.sectionId,
            };
        }
        return out;
    }, [allKpis]);

    const handleMove = useCallback(
        (sectionId: KPISectionId, fromIndex: number, toIndex: number) => {
            setSections((current) => {
                const nextSection = [...current[sectionId]];
                const [moved] = nextSection.splice(fromIndex, 1);
                if (!moved) return current;
                nextSection.splice(toIndex, 0, moved);
                return { ...current, [sectionId]: nextSection };
            });
        },
        []
    );

    const handleSelectTemplate = useCallback(
        (template: KPITemplate, sectionId: KPISectionId) => {
            if (bindings[template.id]) {
                const existing = bindings[template.id];
                if (existing) {
                    window.setTimeout(() => {
                        document
                            .querySelector(`[data-kpi-instance="${existing.instanceId}"]`)
                            ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 0);
                }
                return;
            }
            setSections((current) => ({
                ...current,
                [sectionId]: [
                    ...current[sectionId],
                    createKPIInstance(
                        template,
                        sectionId,
                        `${sectionId}-${template.id}-${Date.now()}`
                    ),
                ],
            }));
            setBrowserTarget(null);
        },
        [bindings]
    );

    const handleRemove = useCallback((target: KPIInstance) => {
        setSections((current) => ({
            ...current,
            [target.sectionId]: current[target.sectionId].filter(
                (kpi) => kpi.instanceId !== target.instanceId
            ),
        }));
    }, []);

    const handleApplyConfig = useCallback((nextKpi: KPIInstance) => {
        setSections((current) => replaceKpi(current, nextKpi));
        setConfigKpi(null);
    }, []);

    const handleFactoryReset = useCallback((target: KPIInstance) => {
        const template = getTemplateById(target.templateId);
        if (!template) return;
        const reset = createKPIInstance(
            template,
            target.sectionId,
            target.instanceId
        );
        setSections((current) => replaceKpi(current, reset));
        setConfigKpi(null);
    }, []);

    const jumpToKpi = useCallback((instanceId: string) => {
        window.setTimeout(() => {
            const element = document.querySelector(
                `[data-kpi-instance="${instanceId}"]`
            );
            element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element?.classList.add('ring-2', 'sui-focus-ring');
            window.setTimeout(() => {
                element?.classList.remove('ring-2', 'sui-focus-ring');
            }, 1600);
        }, 0);
    }, []);

    const configTemplate = configKpi ? getTemplateById(configKpi.templateId) : undefined;
    const mapPanel = (
        <SiteMap
            earliestTime={timeRangeToSplunkEarliest(timeRange)}
            latestTime="now"
        />
    );
    const sectionPanel = (
        <div className="min-w-0 space-y-10">
            {sectionIds.map((sectionId) => (
                <KPISection
                    key={sectionId}
                    sectionId={sectionId}
                    title={KPI_SECTION_TITLES[sectionId]}
                    kpis={sections[sectionId]}
                    searchTerm={searchTerm}
                    onAdd={(target) => setBrowserTarget(target)}
                    onMove={handleMove}
                    onConfigure={setConfigKpi}
                    onExpand={setExpandedKpi}
                    onRemove={handleRemove}
                />
            ))}
        </div>
    );

    return (
        <div
            ref={exportRef}
            className="scd-c3-atmosphere h-screen min-h-[720px] overflow-hidden font-sans sui-bg-page sui-color-active"
        >
            <div className="flex h-full flex-col">
                <header className="flex h-[76px] flex-shrink-0 items-center justify-between gap-4 border-b   px-7 shadow-sm backdrop-blur-xl sui-border-weak sui-bg-page">
                    <div className="min-w-0">
                        <h1 className="truncate text-2xl font-black tracking-tight  sui-color-info">
                            Your Organization Name
                        </h1>
                        <p className="mt-1 text-sm font-semibold  sui-color-default">
                            Health Monitoring Dashboard (Under Dev)
                        </p>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-3">
                        <GlobalKPISearch
                            value={searchTerm}
                            resultCount={searchMatchCount}
                            onChange={setSearchTerm}
                            onOpenLibrary={() => setBrowserTarget('it-health')}
                        />
                        <div className="hidden items-center gap-2 rounded-lg border   px-3 py-2 text-sm font-black  shadow-sm lg:flex sui-border-default sui-bg-section sui-color-active">
                            <span className="h-2.5 w-2.5 rounded-full sui-bg-status-positive" />
                            All Systems Operational
                        </div>
                        <div className="relative group">
                            <button
                                type="button"
                                disabled={exporting}
                                title="Export dashboard screenshot"
                                aria-label="Export dashboard screenshot"
                                className="inline-flex h-10 w-10 items-center justify-center rounded-lg  transition   disabled:cursor-wait disabled:opacity-50 focus:outline-none focus-visible:ring-2 sui-focus-visible-ring sui-color-default sui-hover-bg-overlay sui-hover-color-active"
                            >
                                {exporting ? (
                                    <Pause className="h-5 w-5 animate-pulse" />
                                ) : (
                                    <Download className="h-5 w-5" />
                                )}
                            </button>
                            <div className="absolute right-0 top-full z-50 mt-2 hidden w-32 overflow-hidden rounded-lg border   shadow-lg group-hover:block group-focus-within:block sui-border-default sui-bg-section">
                                <button
                                    type="button"
                                    onClick={() => exportAs('png')}
                                    className="block w-full px-3 py-2 text-left text-xs font-black  transition   sui-color-active sui-hover-bg-overlay sui-hover-color-info"
                                >
                                    Save as PNG
                                </button>
                                <button
                                    type="button"
                                    onClick={() => exportAs('pdf')}
                                    className="block w-full border-t  px-3 py-2 text-left text-xs font-black  transition   sui-border-default sui-color-active sui-hover-bg-overlay sui-hover-color-info"
                                >
                                    Save as PDF
                                </button>
                            </div>
                        </div>
                        <button
                            type="button"
                            className="inline-flex h-10 w-10 items-center justify-center rounded-lg  transition   focus:outline-none focus-visible:ring-2 sui-focus-visible-ring sui-color-default sui-hover-bg-overlay sui-hover-color-active"
                            aria-label="Notifications"
                        >
                            <Bell className="h-5 w-5" />
                        </button>
                        <button
                            type="button"
                            className="inline-flex h-10 w-10 items-center justify-center rounded-lg  transition   focus:outline-none focus-visible:ring-2 sui-focus-visible-ring sui-color-default sui-hover-bg-overlay sui-hover-color-active"
                            aria-label="Dashboard settings"
                        >
                            <Settings className="h-5 w-5" />
                        </button>
                    </div>
                </header>

                <main className="min-h-0 flex-1 overflow-y-auto px-7 py-6">
                    <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <CalendarDays className="h-5 w-5 sui-color-muted" />
                            <span className="text-sm font-black  sui-color-default">
                                Time Range:
                            </span>
                            {['24h', '7d', '30d', '90d'].map((range) => (
                                <button
                                    key={range}
                                    type="button"
                                    onClick={() => setTimeRange(range)}
                                    className={cn(
                                        'h-9 min-w-14 rounded-lg border px-4 text-sm font-black transition focus:outline-none focus-visible:ring-2 sui-focus-visible-ring',
                                        timeRange === range
                                            ? 'sui-border-weak   sui-border-strong sui-bg-section sui-color-active'
                                            : 'sui-border-weak   sui-hover-border-info sui-border-default sui-bg-section sui-color-active'
                                    )}
                                >
                                    {range}
                                </button>
                            ))}
                        </div>
                        <label className="flex items-center gap-3">
                            <Grid2X2 className="h-5 w-5 sui-color-default" />
                            <span className="text-sm font-black  sui-color-default">
                                Map Position:
                            </span>
                            <select
                                value={mapPosition}
                                onChange={(event) =>
                                    setMapPosition(event.target.value as MapPosition)
                                }
                                className="h-10 rounded-lg border   px-4 text-sm font-semibold outline-none sui-focus-border-info sui-border-default sui-bg-section"
                            >
                                <option value="right">Right Side</option>
                                <option value="top">Top</option>
                                <option value="bottom">Bottom</option>
                            </select>
                        </label>
                    </div>

                    <DndProvider backend={HTML5Backend}>
                        {mapPosition === 'top' && (
                            <div className="mb-8 h-[560px]">{mapPanel}</div>
                        )}
                        {mapPosition === 'right' ? (
                            <div className="grid min-w-0 gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(380px,34vw)]">
                                {sectionPanel}
                                <div className="min-h-[560px] xl:sticky xl:top-6 xl:h-[calc(100vh-220px)]">
                                    {mapPanel}
                                </div>
                            </div>
                        ) : (
                            sectionPanel
                        )}
                        {mapPosition === 'bottom' && (
                            <div className="mt-10 h-[560px]">{mapPanel}</div>
                        )}
                    </DndProvider>
                </main>
            </div>

            <KPIBrowser
                open={browserTarget !== null}
                targetSectionId={browserTarget ?? 'it-health'}
                templates={KPI_TEMPLATES}
                bindings={bindings}
                initialQuery={searchTerm}
                onClose={() => setBrowserTarget(null)}
                onSelect={handleSelectTemplate}
                onJumpTo={jumpToKpi}
            />
            <KPIConfigModal
                kpi={configKpi}
                template={configTemplate}
                onClose={() => setConfigKpi(null)}
                onApply={handleApplyConfig}
                onFactoryReset={handleFactoryReset}
            />
            <ExpandedKPIModal kpi={expandedKpi} onClose={() => setExpandedKpi(null)} />
        </div>
    );
};

const HealthMonitoringDashboard: React.FC = () => (
    <ErrorBoundary>
        <DashboardContent />
    </ErrorBoundary>
);

export default HealthMonitoringDashboard;
