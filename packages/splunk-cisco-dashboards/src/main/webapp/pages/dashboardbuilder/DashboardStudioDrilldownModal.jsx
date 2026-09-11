/* eslint-disable react/prop-types */
import React, {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import Message from '@splunk/react-ui/Message';
import Paginator from '@splunk/react-ui/Paginator';
import ScreenReaderContent from '@splunk/react-ui/ScreenReaderContent';
import WaitSpinner from '@splunk/react-ui/WaitSpinner';
import { variables } from '@splunk/themes';
import { DashboardContextProvider } from '@splunk/dashboard-context';
import { DashboardCore } from '@splunk/dashboard-core';
import DOMPurify from 'dompurify';
import styled from 'styled-components';
import SearchbaseDrilldownGuidance from '../../common/components/workspace/SearchbaseDrilldownGuidance';
import { WorkspaceModalShell } from '../../common/components/workspace/WorkspaceModalShell';
import {
    ExternalLink,
    Info,
    Search,
} from '../../common/icons/SuiIcon';
import { addDash } from '../../common/lib/splunk';
import { getSearches } from '../../common/lib/searchbase';
import { splunkSearchAppUrl } from '../../common/lib/splunkSearchUrl';
import {
    buildDashboardDrilldownDefinition,
    getDashboardDrilldownMetadata,
    resolveDashboardDrilldownSearches,
} from '../../common/lib/dashboardDrilldown';
import '../../common/styles/tailwind.css';

const metadataHtmlToText = (value) =>
    DOMPurify.sanitize(value || '', { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })
        .replace(/\s+/g, ' ')
        .trim();

const isTruthyConfValue = (value) =>
    ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());

const DRILLDOWN_RESULT_HEIGHT = 340;

const DrilldownWorkflow = styled.div`
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    padding: ${variables.spacingSmall} ${variables.spacingMedium};
    border-bottom: 1px solid ${variables.borderColorWeak};
    background: ${variables.backgroundColorPage};
`;

const splunkSearchbaseEditUrl = (stanzaId) => {
    const path = typeof window !== 'undefined' ? window.location.pathname : '/en-US';
    const localeMatch = path.match(/^\/([a-z]{2}-[A-Z]{2})\//);
    const locale = localeMatch ? localeMatch[1] : 'en-US';
    return `/${locale}/app/searchbase/start#/edit/${encodeURIComponent(stanzaId)}#search-spl`;
};

const getSearchApp = (entry, fallbackApp) => {
    const content = entry?.content || {};
    if (isTruthyConfValue(content.dispatch_context_force) && content.dispatch_context) {
        return content.dispatch_context;
    }
    return entry?.acl?.app || fallbackApp;
};

const DashboardStudioDrilldownModal = ({
    open,
    origin,
    targetIds,
    timeRange,
    ownerApp,
    preset,
    featureFlags,
    iconRegistry,
    timezone,
    colorScheme,
    mode = 'drilldown',
    onRequestClose,
}) => {
    const isMetricInfo = mode === 'metric-info';
    const [searchEntries, setSearchEntries] = useState(null);
    const [loadError, setLoadError] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const [generationState, setGenerationState] = useState({ type: '', message: '' });
    const [resultWidth, setResultWidth] = useState(0);
    const catalogueRequestRef = useRef(null);
    const resultContainerRef = useRef(null);
    const targetKey = targetIds.join('\u0000');

    useEffect(() => {
        catalogueRequestRef.current = null;
        setSearchEntries(null);
        setLoadError('');
    }, [ownerApp]);

    useEffect(() => {
        if (!open || searchEntries !== null || catalogueRequestRef.current) {
            return;
        }

        setLoadError('');
        const catalogueRequest = getSearches(ownerApp);
        catalogueRequestRef.current = catalogueRequest;
        catalogueRequest
            .then((data) => {
                if (catalogueRequestRef.current !== catalogueRequest) {
                    return;
                }
                if (typeof data?.status === 'number' && (data.status < 200 || data.status >= 300)) {
                    throw new Error(`Searchbase catalogue request failed (${data.status}).`);
                }
                setSearchEntries(data?.entry || []);
            })
            .catch((error) => {
                if (catalogueRequestRef.current === catalogueRequest) {
                    setLoadError(error?.message || 'Unable to load the Searchbase catalogue.');
                }
            })
            .finally(() => {
                if (catalogueRequestRef.current === catalogueRequest) {
                    catalogueRequestRef.current = null;
                }
            });
    }, [open, ownerApp, searchEntries]);

    const { resolvedSearches, missingTargetIds } = useMemo(
        () => resolveDashboardDrilldownSearches(searchEntries || [], targetIds),
        [searchEntries, targetIds],
    );

    useEffect(() => {
        if (open) {
            setActiveIndex(0);
            setGenerationState({ type: '', message: '' });
        }
    }, [open, targetKey]);

    useEffect(() => {
        if (activeIndex >= resolvedSearches.length) {
            setActiveIndex(0);
        }
    }, [activeIndex, resolvedSearches.length]);

    const activeSearch = resolvedSearches[activeIndex] || resolvedSearches[0];
    const activeDefinition = useMemo(
        () =>
            activeSearch && !isMetricInfo
                ? buildDashboardDrilldownDefinition(activeSearch, timeRange, {
                      width: resultWidth,
                      height: DRILLDOWN_RESULT_HEIGHT,
                  })
                : undefined,
        [activeSearch, isMetricInfo, resultWidth, timeRange],
    );
    const activeMetadata = useMemo(
        () => getDashboardDrilldownMetadata(activeSearch),
        [activeSearch],
    );

    useLayoutEffect(() => {
        const container = resultContainerRef.current;
        if (!open || isMetricInfo || !activeSearch || !container) {
            setResultWidth(0);
            return undefined;
        }

        const updateResultWidth = () => {
            const nextWidth = Math.floor(container.getBoundingClientRect().width);
            if (nextWidth > 0) {
                setResultWidth(nextWidth);
            }
        };

        updateResultWidth();
        if (typeof ResizeObserver === 'undefined') {
            return undefined;
        }

        const observer = new ResizeObserver(updateResultWidth);
        observer.observe(container);
        return () => observer.disconnect();
    }, [activeSearch, isMetricInfo, open]);

    const activeClassification = [activeMetadata.category, activeMetadata.subCategory].filter(
        Boolean,
    );
    const dashboardKey = activeSearch
        ? `${activeSearch.name}:${timeRange.earliest}:${timeRange.latest}:${resultWidth}`
        : 'dashboard-drilldown-empty';
    const activeSearchUrl = activeSearch?.content?.search
        ? splunkSearchAppUrl(
              activeSearch.content.search,
              timeRange,
              getSearchApp(activeSearch, ownerApp),
          )
        : '';
    const generateDashboard = useCallback(async () => {
        if (!activeSearch || !activeDefinition || generationState.type === 'loading') {
            return;
        }

        const safeStanzaId = String(activeSearch.name || 'search')
            .replace(/[^A-Za-z0-9_-]+/g, '_')
            .slice(0, 80);
        const dashboardId = `scd_drilldown_${safeStanzaId}_${Date.now()}`;
        const dashboardTitle = `${activeMetadata.title || 'Search details'} Dashboard`;
        const dashboardDescription = metadataHtmlToText(activeMetadata.description).slice(0, 500);

        setGenerationState({ type: 'loading', message: 'Generating dashboard…' });
        try {
            const response = await addDash(
                dashboardId,
                JSON.stringify({
                    ...activeDefinition,
                    title: dashboardTitle,
                    description: dashboardDescription,
                }),
                dashboardTitle,
                dashboardDescription,
                '',
                colorScheme,
                undefined,
                'app',
            );
            if (response.status < 200 || response.status > 299) {
                throw new Error(`Dashboard creation failed (${response.status}).`);
            }

            setGenerationState({ type: 'success', message: `Created ${dashboardTitle}.` });
            window.open(
                `/app/splunk-cisco-dashboards/dashboard_manager#/${encodeURIComponent(
                    dashboardId,
                )}/edit`,
                '_blank',
                'noopener,noreferrer',
            );
        } catch (error) {
            setGenerationState({
                type: 'error',
                message: error?.message || 'Unable to generate the dashboard.',
            });
        }
    }, [
        activeDefinition,
        activeMetadata.description,
        activeMetadata.title,
        activeSearch,
        colorScheme,
        generationState.type,
    ]);

    return (
        <WorkspaceModalShell
            isOpen={open}
            variant="detail"
            title={
                isMetricInfo
                    ? `About ${origin || 'this metric'}`
                    : `Investigate ${origin || 'dashboard activity'}`
            }
            subtitle={
                isMetricInfo
                    ? 'Primary metric definition, calculation, interpretation, and source.'
                    : 'Searchbase evidence that helps explain what changed and what drove it.'
            }
            onClose={onRequestClose}
            openInSearchHref={activeSearchUrl || undefined}
            openInSearchbaseHref={
                activeSearch ? splunkSearchbaseEditUrl(activeSearch.name) : undefined
            }
            renderInDocumentBody
            dialogClassName="dashboard-builder-drilldown-modal"
            contentClassName="dashboard-builder-drilldown-shell flex min-h-0 flex-1 flex-col overflow-hidden sui-bg-page"
        >
            {loadError && (
                <div className="dashboard-builder-drilldown-status">
                    <Message type="error" appearance="fill">
                        <Message.Title>
                            {isMetricInfo
                                ? 'Unable to open metric information'
                                : 'Unable to open investigation'}
                        </Message.Title>
                        {loadError}
                    </Message>
                </div>
            )}

            {!loadError && searchEntries === null && (
                <div role="status" className="dashboard-builder-drilldown-loading">
                    <WaitSpinner size="large" />
                </div>
            )}

            {!loadError && searchEntries !== null && resolvedSearches.length === 0 && (
                <div className="dashboard-builder-drilldown-status">
                    <Message type="warning" appearance="fill">
                        <Message.Title>
                            {isMetricInfo
                                ? 'The primary metric search was not found'
                                : 'No investigation searches were found'}
                        </Message.Title>
                        The configured target does not exist in this app&apos;s Searchbase catalogue.
                    </Message>
                </div>
            )}

            {!isMetricInfo && resolvedSearches.length > 1 && (
                <DrilldownWorkflow>
                    <Paginator.Compact
                        aria-label="Investigation search navigation"
                        current={activeIndex + 1}
                        onChange={(_event, { page }) => {
                            if (page === undefined) {
                                return;
                            }
                            setGenerationState({ type: '', message: '' });
                            setActiveIndex(page - 1);
                        }}
                        renderLabel={({ current, totalPages }) =>
                            `${current ?? 1} / ${totalPages ?? resolvedSearches.length}`
                        }
                        totalPages={resolvedSearches.length}
                    />
                    <ScreenReaderContent aria-live="polite">
                        Showing {activeMetadata.title}, investigation {activeIndex + 1} of{' '}
                        {resolvedSearches.length}
                    </ScreenReaderContent>
                </DrilldownWorkflow>
            )}

            {missingTargetIds.length > 0 && searchEntries !== null && (
                <div className="dashboard-builder-drilldown-status dashboard-builder-drilldown-warning">
                    <Message type="warning" appearance="fill">
                        <Message.Title>Some investigation searches are unavailable</Message.Title>
                        {missingTargetIds.join(', ')}
                    </Message>
                </div>
            )}

            {activeSearch && (
                <article className="dashboard-builder-drilldown-slide dashboard-builder-drilldown-workspace">
                        <div className="dashboard-builder-drilldown-search-title">
                            {isMetricInfo ? (
                                <Info size={20} aria-hidden="true" />
                            ) : (
                                <Search size={20} aria-hidden="true" />
                            )}
                            <h2>{activeMetadata.title}</h2>
                            {activeClassification.length > 0 && (
                                <span
                                    className="dashboard-builder-drilldown-classification"
                                    aria-label={`Search classification: ${activeClassification.join(
                                        ', ',
                                    )}`}
                                >
                                    {activeMetadata.category && (
                                        <span>{activeMetadata.category}</span>
                                    )}
                                    {activeMetadata.category && activeMetadata.subCategory && (
                                        <span aria-hidden="true">•</span>
                                    )}
                                    {activeMetadata.subCategory && (
                                        <span>{activeMetadata.subCategory}</span>
                                    )}
                                </span>
                            )}
                        </div>

                        {!isMetricInfo && (
                            <div className="dashboard-builder-drilldown-result-shell">
                                <div
                                    ref={resultContainerRef}
                                    className="dashboard-builder-drilldown-dashboard"
                                    aria-busy={resultWidth <= 0}
                                >
                                    {resultWidth > 0 ? (
                                        <DashboardContextProvider
                                            key={dashboardKey}
                                            preset={preset}
                                            featureFlags={featureFlags}
                                            iconRegistry={iconRegistry}
                                            timezone={timezone}
                                            initialDefinition={activeDefinition}
                                            initialMode="view"
                                        >
                                            <DashboardCore
                                                width={resultWidth}
                                                height={DRILLDOWN_RESULT_HEIGHT}
                                            />
                                        </DashboardContextProvider>
                                    ) : (
                                        <div
                                            role="status"
                                            className="dashboard-builder-drilldown-loading"
                                        >
                                            <WaitSpinner size="large" />
                                            <ScreenReaderContent>
                                                Preparing drill-down visualization…
                                            </ScreenReaderContent>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {!isMetricInfo && (
                            <div className="dashboard-builder-drilldown-actions">
                                <button
                                    type="button"
                                    className="dashboard-builder-drilldown-link-button"
                                    disabled={generationState.type === 'loading'}
                                    onClick={generateDashboard}
                                >
                                    Generate a Dashboard{' '}
                                    <ExternalLink size={14} aria-hidden="true" />
                                </button>
                            </div>
                        )}

                        {!isMetricInfo && generationState.message && (
                            <div className="dashboard-builder-drilldown-status dashboard-builder-drilldown-generation-status">
                                <Message
                                    type={generationState.type === 'error' ? 'error' : 'info'}
                                    appearance="fill"
                                >
                                    {generationState.message}
                                </Message>
                            </div>
                        )}

                        <SearchbaseDrilldownGuidance
                            metadata={activeMetadata}
                            appearance="workspace"
                            heading={isMetricInfo ? 'About this metric' : undefined}
                            summary={
                                isMetricInfo
                                    ? 'What it measures, how it is calculated, and how to interpret it'
                                    : undefined
                            }
                        />
                </article>
            )}
        </WorkspaceModalShell>
    );
};

export default DashboardStudioDrilldownModal;
