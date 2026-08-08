/* eslint-disable react/prop-types */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Button from '@splunk/react-ui/Button';
import ControlGroup from '@splunk/react-ui/ControlGroup';
import Message from '@splunk/react-ui/Message';
import Modal from '@splunk/react-ui/Modal';
import Select from '@splunk/react-ui/Select';
import WaitSpinner from '@splunk/react-ui/WaitSpinner';
import { DashboardContextProvider } from '@splunk/dashboard-context';
import { DashboardCore } from '@splunk/dashboard-core';
import { PanelRightOpen } from '../../common/icons/SuiIcon';
import { getSearches } from '../../common/lib/searchbase';
import {
    buildDashboardDrilldownDefinition,
    resolveDashboardDrilldownSearches,
} from '../../common/lib/dashboardDrilldown';

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
    const [activeStanzaId, setActiveStanzaId] = useState('');
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
        if (!open) {
            return;
        }

        const currentTargetIsAvailable = resolvedSearches.some(
            (entry) => entry.name === activeStanzaId,
        );
        if (!currentTargetIsAvailable) {
            setActiveStanzaId(resolvedSearches[0]?.name || '');
        }
    }, [activeStanzaId, open, resolvedSearches, targetKey]);

    const activeSearch =
        resolvedSearches.find((entry) => entry.name === activeStanzaId) || resolvedSearches[0];
    const activeDefinition = useMemo(
        () =>
            activeSearch
                ? buildDashboardDrilldownDefinition(activeSearch, timeRange)
                : undefined,
        [activeSearch, timeRange],
    );
    const dashboardKey = activeSearch
        ? `${activeSearch.name}:${timeRange.earliest}:${timeRange.latest}`
        : 'dashboard-drilldown-empty';

    return (
        <Modal
            open={open}
            className={`dashboard-builder-themed-modal dashboard-builder-drilldown-modal dashboard-builder-themed-modal-${colorScheme}`}
            style={{ width: 'min(1120px, calc(100vw - 64px))', ...modalThemeStyle }}
            onRequestClose={onRequestClose}
        >
            <Modal.Header
                title={`Drill down: ${origin || 'Dashboard details'}`}
                subtitle="Supporting Searchbase results for the dashboard selection."
                icon={<PanelRightOpen size={28} aria-hidden="true" />}
            />
            <Modal.Body style={{ minHeight: 610, padding: '20px 24px' }}>
                {loadError && (
                    <Message type="error" appearance="fill">
                        <Message.Title>Unable to open drilldown</Message.Title>
                        {loadError}
                    </Message>
                )}

                {!loadError && searchEntries === null && (
                    <div
                        role="status"
                        style={{ minHeight: 520, display: 'grid', placeItems: 'center' }}
                    >
                        <WaitSpinner size="large" />
                    </div>
                )}

                {!loadError && searchEntries !== null && resolvedSearches.length === 0 && (
                    <Message type="warning" appearance="fill">
                        <Message.Title>No drilldown searches were found</Message.Title>
                        None of the configured targets exist in this app&apos;s Searchbase catalogue.
                    </Message>
                )}

                {resolvedSearches.length > 1 && (
                    <ControlGroup label="Detail search" style={{ marginBottom: 16 }}>
                        <Select
                            value={activeSearch?.name || ''}
                            onChange={(_event, { value }) => setActiveStanzaId(value)}
                            filter
                        >
                            {resolvedSearches.map((entry) => (
                                <Select.Option
                                    key={entry.name}
                                    value={entry.name}
                                    label={entry.content?.search_name || entry.name}
                                />
                            ))}
                        </Select>
                    </ControlGroup>
                )}

                {missingTargetIds.length > 0 && searchEntries !== null && (
                    <Message type="warning" appearance="fill" style={{ marginBottom: 16 }}>
                        <Message.Title>Some drilldown searches are unavailable</Message.Title>
                        {missingTargetIds.join(', ')}
                    </Message>
                )}

                {activeDefinition && (
                    <div style={{ width: '100%', height: 520, overflow: 'hidden' }}>
                        <DashboardContextProvider
                            key={dashboardKey}
                            preset={preset}
                            featureFlags={featureFlags}
                            iconRegistry={iconRegistry}
                            timezone={timezone}
                            initialDefinition={activeDefinition}
                            initialMode="view"
                        >
                            <DashboardCore width="100%" height="520px" />
                        </DashboardContextProvider>
                    </div>
                )}
            </Modal.Body>
            <Modal.Footer>
                <Button appearance="secondary" label="Close" onClick={onRequestClose} />
            </Modal.Footer>
        </Modal>
    );
};

export default DashboardStudioDrilldownModal;
