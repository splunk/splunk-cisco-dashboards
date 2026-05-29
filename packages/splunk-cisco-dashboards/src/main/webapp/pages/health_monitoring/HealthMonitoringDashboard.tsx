import React, {
    createContext,
    useCallback,
    useContext,
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
    Moon,
    Pause,
    Settings,
    Sun,
} from 'lucide-react';
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

type ThemeMode = 'light' | 'dark';
type MapPosition = 'right' | 'top' | 'bottom';

interface ThemeContextValue {
    theme: ThemeMode;
    toggleTheme: () => void;
}

const THEME_STORAGE_KEY = 'splunk-cisco-dashboards.health-monitoring.theme';
const SECTION_STORAGE_KEY = 'splunk-cisco-dashboards.health-monitoring.sections.v1';
const MAP_POSITION_STORAGE_KEY =
    'splunk-cisco-dashboards.health-monitoring.map-position';

const ThemeContext = createContext<ThemeContextValue | null>(null);

const readTheme = (): ThemeMode => {
    if (typeof window === 'undefined') return 'light';
    try {
        const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
        if (saved === 'light' || saved === 'dark') return saved;
    } catch {
        // Best-effort persistence only.
    }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
};

const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [theme, setTheme] = useState<ThemeMode>(readTheme);
    const toggleTheme = useCallback(() => {
        setTheme((current) => {
            const next = current === 'dark' ? 'light' : 'dark';
            try {
                window.localStorage.setItem(THEME_STORAGE_KEY, next);
            } catch {
                // UI still flips for this session.
            }
            return next;
        });
    }, []);

    const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

const useThemeContext = () => {
    const context = useContext(ThemeContext);
    if (!context) throw new Error('ThemeContext is missing.');
    return context;
};

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
            <div className="flex min-h-screen items-center justify-center bg-slate-950 p-8 text-white">
                <div className="max-w-xl rounded-xl border border-red-500/50 bg-red-950/40 p-6 shadow-2xl">
                    <h1 className="text-xl font-black">Dashboard Error</h1>
                    <p className="mt-3 text-sm leading-6 text-red-100">
                        The Health Monitoring Dashboard hit an unexpected render error.
                    </p>
                    {this.state.message && (
                        <pre className="mt-4 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-red-200">
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
    const { theme, toggleTheme } = useThemeContext();
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
            element?.classList.add('ring-2', 'ring-sky-400');
            window.setTimeout(() => {
                element?.classList.remove('ring-2', 'ring-sky-400');
            }, 1600);
        }, 0);
    }, []);

    const configTemplate = configKpi ? getTemplateById(configKpi.templateId) : undefined;
    const mapPanel = (
        <SiteMap
            isDark={theme === 'dark'}
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
            className={cn(
                'h-screen min-h-[720px] overflow-hidden font-sans',
                theme === 'dark'
                    ? 'dark bg-slate-950 text-slate-100'
                    : 'bg-slate-100 text-slate-900'
            )}
        >
            <div className="flex h-full flex-col">
                <header className="flex h-[76px] flex-shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white/86 px-7 shadow-sm backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/82">
                    <div className="min-w-0">
                        <h1 className="truncate text-2xl font-black tracking-tight text-blue-600 dark:text-blue-400">
                            Your Organization Name
                        </h1>
                        <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
                            Health Monitoring Dashboard
                        </p>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-3">
                        <GlobalKPISearch
                            value={searchTerm}
                            resultCount={searchMatchCount}
                            onChange={setSearchTerm}
                            onOpenLibrary={() => setBrowserTarget('it-health')}
                        />
                        <div className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm font-black text-slate-800 shadow-sm lg:flex dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-100">
                            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                            All Systems Operational
                        </div>
                        <div className="relative group">
                            <button
                                type="button"
                                disabled={exporting}
                                title="Export dashboard screenshot"
                                aria-label="Export dashboard screenshot"
                                className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 disabled:cursor-wait disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                            >
                                {exporting ? (
                                    <Pause className="h-5 w-5 animate-pulse" />
                                ) : (
                                    <Download className="h-5 w-5" />
                                )}
                            </button>
                            <div className="absolute right-0 top-full z-50 mt-2 hidden w-32 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg group-hover:block group-focus-within:block dark:border-slate-700 dark:bg-slate-900">
                                <button
                                    type="button"
                                    onClick={() => exportAs('png')}
                                    className="block w-full px-3 py-2 text-left text-xs font-black text-slate-700 transition hover:bg-sky-50 hover:text-sky-700 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-sky-300"
                                >
                                    Save as PNG
                                </button>
                                <button
                                    type="button"
                                    onClick={() => exportAs('pdf')}
                                    className="block w-full border-t border-slate-100 px-3 py-2 text-left text-xs font-black text-slate-700 transition hover:bg-sky-50 hover:text-sky-700 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-sky-300"
                                >
                                    Save as PDF
                                </button>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={toggleTheme}
                            aria-label="Toggle light and dark theme"
                            title="Toggle theme"
                            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                        >
                            {theme === 'dark' ? (
                                <Sun className="h-5 w-5" />
                            ) : (
                                <Moon className="h-5 w-5" />
                            )}
                        </button>
                        <button
                            type="button"
                            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                            aria-label="Notifications"
                        >
                            <Bell className="h-5 w-5" />
                        </button>
                        <button
                            type="button"
                            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                            aria-label="Dashboard settings"
                        >
                            <Settings className="h-5 w-5" />
                        </button>
                    </div>
                </header>

                <main className="min-h-0 flex-1 overflow-y-auto px-7 py-6">
                    <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <CalendarDays className="h-5 w-5 text-slate-500" />
                            <span className="text-sm font-black text-slate-600 dark:text-slate-300">
                                Time Range:
                            </span>
                            {['24h', '7d', '30d', '90d'].map((range) => (
                                <button
                                    key={range}
                                    type="button"
                                    onClick={() => setTimeRange(range)}
                                    className={cn(
                                        'h-9 min-w-14 rounded-lg border px-4 text-sm font-black transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400',
                                        timeRange === range
                                            ? 'border-slate-950 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950'
                                            : 'border-slate-200 bg-white text-slate-900 hover:border-sky-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'
                                    )}
                                >
                                    {range}
                                </button>
                            ))}
                        </div>
                        <label className="flex items-center gap-3">
                            <Grid2X2 className="h-5 w-5 text-slate-400" />
                            <span className="text-sm font-black text-slate-600 dark:text-slate-300">
                                Map Position:
                            </span>
                            <select
                                value={mapPosition}
                                onChange={(event) =>
                                    setMapPosition(event.target.value as MapPosition)
                                }
                                className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-sky-400 dark:border-slate-700 dark:bg-slate-900"
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
        <ThemeProvider>
            <DashboardContent />
        </ThemeProvider>
    </ErrorBoundary>
);

export default HealthMonitoringDashboard;
