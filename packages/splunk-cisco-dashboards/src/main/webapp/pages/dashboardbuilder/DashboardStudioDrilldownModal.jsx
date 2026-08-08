/* eslint-disable react/prop-types */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Button from '@splunk/react-ui/Button';
import Link from '@splunk/react-ui/Link';
import Message from '@splunk/react-ui/Message';
import Modal from '@splunk/react-ui/Modal';
import WaitSpinner from '@splunk/react-ui/WaitSpinner';
import { DashboardContextProvider } from '@splunk/dashboard-context';
import { DashboardCore } from '@splunk/dashboard-core';
import DOMPurify from 'dompurify';
import {
    ChevronLeft,
    ChevronRight,
    ExternalLink,
    PanelRightOpen,
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

const sanitizeMetadataHtml = (value) =>
    DOMPurify.sanitize(value || '', {
        USE_PROFILES: { html: true },
        ADD_ATTR: ['target'],
    });

const metadataHtmlToText = (value) =>
    DOMPurify.sanitize(value || '', { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })
        .replace(/\s+/g, ' ')
        .trim();

const isTruthyConfValue = (value) =>
    ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());

const getSearchApp = (entry, fallbackApp) => {
    const content = entry?.content || {};
    if (isTruthyConfValue(content.dispatch_context_force) && content.dispatch_context) {
        return content.dispatch_context;
    }
    return entry?.acl?.app || fallbackApp;
};

const MetadataBlock = ({ title, html }) => {
    if (!html) {
        return null;
    }

    return (
        <section className="dashboard-builder-drilldown-metadata-block">
            <h3>{title}</h3>
            {/* Searchbase metadata is sanitized with DOMPurify before this component renders. */}
            {/* eslint-disable-next-line react/no-danger */}
            <div dangerouslySetInnerHTML={{ __html: html }} />
        </section>
    );
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
    modalThemeStyle,
    onRequestClose,
}) => {
    const [searchEntries, setSearchEntries] = useState(null);
    const [loadError, setLoadError] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const [generationState, setGenerationState] = useState({ type: '', message: '' });
    const catalogueRequestRef = useRef(null);
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
            activeSearch
                ? buildDashboardDrilldownDefinition(activeSearch, timeRange)
                : undefined,
        [activeSearch, timeRange],
    );
    const activeMetadata = useMemo(
        () => getDashboardDrilldownMetadata(activeSearch),
        [activeSearch],
    );
    const activeClassification = [activeMetadata.category, activeMetadata.subCategory].filter(
        Boolean,
    );
    const sanitizedMetadata = useMemo(
        () => ({
            description: sanitizeMetadataHtml(activeMetadata.description),
            explanation: sanitizeMetadataHtml(activeMetadata.explanation),
            solution: sanitizeMetadataHtml(activeMetadata.solution),
            relatedInfo: sanitizeMetadataHtml(activeMetadata.relatedInfo),
            executionPlan: sanitizeMetadataHtml(activeMetadata.executionPlan),
        }),
        [activeMetadata],
    );
    const dashboardKey = activeSearch
        ? `${activeSearch.name}:${timeRange.earliest}:${timeRange.latest}`
        : 'dashboard-drilldown-empty';
    const activeSearchUrl = activeSearch?.content?.search
        ? splunkSearchAppUrl(
              activeSearch.content.search,
              timeRange,
              getSearchApp(activeSearch, ownerApp),
          )
        : '';
    const canGoBack = activeIndex > 0;
    const canGoForward = activeIndex < resolvedSearches.length - 1;

    const showPrevious = useCallback(() => {
        setGenerationState({ type: '', message: '' });
        setActiveIndex((index) => Math.max(0, index - 1));
    }, []);

    const showNext = useCallback(() => {
        setGenerationState({ type: '', message: '' });
        setActiveIndex((index) => Math.min(resolvedSearches.length - 1, index + 1));
    }, [resolvedSearches.length]);

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
            );
            if (response.status < 200 || response.status > 299) {
                throw new Error(`Dashboard creation failed (${response.status}).`);
            }

            setGenerationState({ type: 'success', message: `Created ${dashboardTitle}.` });
            window.open(
                `/app/splunk-cisco-dashboards/dashboardbuilder#/${encodeURIComponent(
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
        <Modal
            open={open}
            className={`dashboard-builder-themed-modal dashboard-builder-drilldown-modal dashboard-builder-themed-modal-${colorScheme}`}
            style={{
                width: 'min(1400px, calc(100vw - 48px))',
                maxHeight: 'calc(100vh - 40px)',
                ...modalThemeStyle,
            }}
            onRequestClose={onRequestClose}
        >
            <Modal.Header
                title={`Drill down: ${origin || 'Dashboard details'}`}
                subtitle="Supporting Searchbase results and guidance for the dashboard selection."
                icon={<PanelRightOpen size={32} aria-hidden="true" />}
            />
            <Modal.Body
                className="dashboard-builder-drilldown-body"
                style={{ padding: 0, maxHeight: 'calc(100vh - 172px)', overflowY: 'auto' }}
            >
                {loadError && (
                    <div className="dashboard-builder-drilldown-status">
                        <Message type="error" appearance="fill">
                            <Message.Title>Unable to open drilldown</Message.Title>
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
                            <Message.Title>No drilldown searches were found</Message.Title>
                            None of the configured targets exist in this app&apos;s Searchbase catalogue.
                        </Message>
                    </div>
                )}

                {resolvedSearches.length > 1 && (
                    <nav
                        className="dashboard-builder-drilldown-workflow"
                        aria-label="Drilldown search navigation"
                    >
                        <button type="button" disabled={!canGoBack} onClick={showPrevious}>
                            Back
                        </button>
                        <span aria-live="polite">
                            {activeIndex + 1} / {resolvedSearches.length}
                        </span>
                        <button type="button" disabled={!canGoForward} onClick={showNext}>
                            Forward
                        </button>
                    </nav>
                )}

                {missingTargetIds.length > 0 && searchEntries !== null && (
                    <div className="dashboard-builder-drilldown-status dashboard-builder-drilldown-warning">
                        <Message type="warning" appearance="fill">
                            <Message.Title>Some drilldown searches are unavailable</Message.Title>
                            {missingTargetIds.join(', ')}
                        </Message>
                    </div>
                )}

                {activeDefinition && (
                    <article className="dashboard-builder-drilldown-slide">
                        <div className="dashboard-builder-drilldown-search-title">
                            <Search size={20} aria-hidden="true" />
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

                        <div className="dashboard-builder-drilldown-result-shell">
                            {resolvedSearches.length > 1 && (
                                <button
                                    type="button"
                                    className="dashboard-builder-drilldown-arrow dashboard-builder-drilldown-arrow-back"
                                    aria-label="Previous drilldown search"
                                    disabled={!canGoBack}
                                    onClick={showPrevious}
                                >
                                    <ChevronLeft size={24} aria-hidden="true" />
                                </button>
                            )}
                            <div className="dashboard-builder-drilldown-dashboard">
                                <DashboardContextProvider
                                    key={dashboardKey}
                                    preset={preset}
                                    featureFlags={featureFlags}
                                    iconRegistry={iconRegistry}
                                    timezone={timezone}
                                    initialDefinition={activeDefinition}
                                    initialMode="view"
                                >
                                    <DashboardCore width="100%" height="420px" />
                                </DashboardContextProvider>
                            </div>
                            {resolvedSearches.length > 1 && (
                                <button
                                    type="button"
                                    className="dashboard-builder-drilldown-arrow dashboard-builder-drilldown-arrow-forward"
                                    aria-label="Next drilldown search"
                                    disabled={!canGoForward}
                                    onClick={showNext}
                                >
                                    <ChevronRight size={24} aria-hidden="true" />
                                </button>
                            )}
                        </div>

                        <div className="dashboard-builder-drilldown-actions">
                            {activeSearchUrl && (
                                <Link to={activeSearchUrl} openInNewContext>
                                    Open in Search
                                </Link>
                            )}
                            <button
                                type="button"
                                className="dashboard-builder-drilldown-link-button"
                                disabled={generationState.type === 'loading'}
                                onClick={generateDashboard}
                            >
                                Generate a Dashboard <ExternalLink size={14} aria-hidden="true" />
                            </button>
                        </div>

                        {generationState.message && (
                            <div className="dashboard-builder-drilldown-status dashboard-builder-drilldown-generation-status">
                                <Message
                                    type={generationState.type === 'error' ? 'error' : 'info'}
                                    appearance="fill"
                                >
                                    {generationState.message}
                                </Message>
                            </div>
                        )}

                        <div className="dashboard-builder-drilldown-metadata">
                            <div>
                                <MetadataBlock
                                    title="Description"
                                    html={sanitizedMetadata.description}
                                />
                                <MetadataBlock
                                    title="Explanation"
                                    html={sanitizedMetadata.explanation}
                                />
                                <MetadataBlock
                                    title="Related information"
                                    html={sanitizedMetadata.relatedInfo}
                                />
                            </div>
                            <div>
                                <MetadataBlock title="Solution" html={sanitizedMetadata.solution} />
                                <MetadataBlock
                                    title="Execution plan"
                                    html={sanitizedMetadata.executionPlan}
                                />
                            </div>
                        </div>
                    </article>
                )}
            </Modal.Body>
            <Modal.Footer>
                <Button appearance="secondary" label="Close" onClick={onRequestClose} />
            </Modal.Footer>
        </Modal>
    );
};

export default DashboardStudioDrilldownModal;
