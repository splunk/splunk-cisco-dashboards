/**
 * Splunk Cisco Dashboards — Network Page
 *
 * Performance view with aggregate bandwidth time-series and per-device
 * CPU utilization bars.
 */

import React, { useMemo } from 'react';

import PanelCard from '@/common/components/PanelCard';
import BandwidthChart from '@/common/components/BandwidthChart';
import CpuBarChart from '@/common/components/CpuBarChart';
import useSplunkSearch from '@/common/hooks/useSplunkSearch';
import { SPL } from '@/common/services/splunkSearchService';

const styles = {
    page: { display: 'flex', flexDirection: 'column', gap: 20, padding: 24 },
    title: { margin: '0 0 8px 0', fontSize: 18, color: '#1c2b3a' },
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: 16,
    },
};

const NetworkPage = () => {
    const bandwidthParams = useMemo(
        () => ({ spl: SPL.BANDWIDTH, tag: 'cisco:bandwidth', earliestTime: '-12h' }),
        []
    );
    const cpuParams = useMemo(
        () => ({ spl: SPL.CPU, tag: 'cisco:cpu', earliestTime: '-15m' }),
        []
    );

    const bandwidth = useSplunkSearch(bandwidthParams);
    const cpu = useSplunkSearch(cpuParams);

    return (
        <div style={styles.page}>
            <h2 style={styles.title}>Network Performance</h2>
            <div style={styles.grid}>
                <PanelCard
                    title="Aggregate Bandwidth"
                    subtitle="Inbound vs outbound across edges (Mbps)"
                    loading={bandwidth.loading}
                    error={bandwidth.error}
                >
                    <BandwidthChart data={bandwidth.data} />
                </PanelCard>

                <PanelCard
                    title="Device CPU Utilization"
                    subtitle="Average CPU % per device (last 15 minutes)"
                    loading={cpu.loading}
                    error={cpu.error}
                >
                    <CpuBarChart rows={cpu.data} />
                </PanelCard>
            </div>
        </div>
    );
};

export default NetworkPage;
