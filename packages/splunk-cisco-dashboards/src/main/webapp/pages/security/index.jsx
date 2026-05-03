/**
 * Splunk Cisco Dashboards — Security Page
 *
 * Severity KPIs, time-window selector, and an alert timeline backed by
 * Cisco ASA / Firepower events. The time-window selector is allow-listed
 * to avoid passing arbitrary client-supplied strings to the search layer.
 */

import React, { useMemo, useState } from 'react';
import Select from '@splunk/react-ui/Select';

import KpiCard from '@/common/components/KpiCard';
import PanelCard from '@/common/components/PanelCard';
import SecurityAlertsList from '@/common/components/SecurityAlertsList';
import useSplunkSearch from '@/common/hooks/useSplunkSearch';
import { SPL } from '@/common/services/splunkSearchService';

const TIME_WINDOWS = [
    { value: '-1h', label: 'Last 1 hour' },
    { value: '-6h', label: 'Last 6 hours' },
    { value: '-24h', label: 'Last 24 hours' },
    { value: '-7d', label: 'Last 7 days' },
];

const ALLOWED_WINDOW_VALUES = TIME_WINDOWS.map((w) => w.value);

const styles = {
    page: { display: 'flex', flexDirection: 'column', gap: 20, padding: 24 },
    title: { margin: '0 0 8px 0', fontSize: 18, color: '#1c2b3a' },
    kpiGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 16,
    },
};

const SecurityPage = () => {
    const [earliest, setEarliest] = useState('-24h');

    const params = useMemo(
        () => ({
            spl: SPL.SECURITY_ALERTS,
            tag: 'cisco:security',
            // Defense-in-depth: re-validate against the allow-list before
            // forwarding to the search layer.
            earliestTime: ALLOWED_WINDOW_VALUES.indexOf(earliest) >= 0 ? earliest : '-24h',
        }),
        [earliest]
    );

    const { data, loading, error } = useSplunkSearch(params);

    const counts = (data || []).reduce(
        (acc, alert) => {
            acc[alert.severity] = (acc[alert.severity] || 0) + 1;
            return acc;
        },
        { critical: 0, high: 0, medium: 0, low: 0 }
    );

    return (
        <div style={styles.page}>
            <h2 style={styles.title}>Security Posture</h2>

            <div style={styles.kpiGrid}>
                <KpiCard label="Critical" value={counts.critical} tone="critical" />
                <KpiCard label="High" value={counts.high} tone="critical" />
                <KpiCard label="Medium" value={counts.medium} tone="warning" />
                <KpiCard label="Low" value={counts.low} tone="positive" />
            </div>

            <PanelCard
                title="Alert Timeline"
                subtitle="Cisco ASA & Firepower"
                loading={loading}
                error={error}
                actions={
                    <Select
                        value={earliest}
                        onChange={(_, payload) => {
                            // Only accept allow-listed values; never trust
                            // arbitrary strings from the UI when forming
                            // search parameters.
                            if (ALLOWED_WINDOW_VALUES.indexOf(payload.value) >= 0) {
                                setEarliest(payload.value);
                            }
                        }}
                    >
                        {TIME_WINDOWS.map((w) => (
                            <Select.Option key={w.value} value={w.value} label={w.label} />
                        ))}
                    </Select>
                }
            >
                <SecurityAlertsList alerts={data} />
            </PanelCard>
        </div>
    );
};

export default SecurityPage;
