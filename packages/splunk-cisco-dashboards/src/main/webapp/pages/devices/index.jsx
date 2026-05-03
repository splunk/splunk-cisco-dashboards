/**
 * Splunk Cisco Dashboards — Devices Page
 *
 * Inventory + status table with client-side filtering. Lists every Cisco
 * device the search returns and shows an at-a-glance status badge per row.
 */

import React, { useMemo } from 'react';
import Button from '@splunk/react-ui/Button';

import PanelCard from '@/common/components/PanelCard';
import DeviceStatusTable from '@/common/components/DeviceStatusTable';
import useSplunkSearch from '@/common/hooks/useSplunkSearch';
import { SPL } from '@/common/services/splunkSearchService';

const styles = {
    page: { display: 'flex', flexDirection: 'column', gap: 20, padding: 24 },
    title: { margin: '0 0 8px 0', fontSize: 18, color: '#1c2b3a' },
};

const DevicesPage = () => {
    const params = useMemo(
        () => ({ spl: SPL.DEVICES, tag: 'cisco:devices', earliestTime: '-15m' }),
        []
    );
    const { data, loading, error, refresh } = useSplunkSearch(params);

    return (
        <div style={styles.page}>
            <h2 style={styles.title}>Cisco Devices</h2>
            <PanelCard
                title="Inventory & Status"
                subtitle="Latest reported status per device"
                loading={loading}
                error={error}
                actions={<Button appearance="secondary" onClick={refresh} label="Refresh" />}
            >
                <DeviceStatusTable rows={data} />
            </PanelCard>
        </div>
    );
};

export default DevicesPage;
