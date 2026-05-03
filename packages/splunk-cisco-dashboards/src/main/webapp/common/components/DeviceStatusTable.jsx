import React, { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import Table from '@splunk/react-ui/Table';
import Text from '@splunk/react-ui/Text';

const STATUS_BADGE_STYLES = {
    up: { backgroundColor: '#e6f4ea', color: '#137333' },
    degraded: { backgroundColor: '#fff4e5', color: '#b06000' },
    down: { backgroundColor: '#fde7e9', color: '#a52a2a' },
};

const StatusBadge = ({ value }) => (
    <span
        style={{
            ...STATUS_BADGE_STYLES[value],
            display: 'inline-block',
            padding: '2px 8px',
            borderRadius: 12,
            fontSize: 12,
            textTransform: 'capitalize',
        }}
    >
        {value}
    </span>
);

StatusBadge.propTypes = { value: PropTypes.oneOf(['up', 'degraded', 'down']).isRequired };

const DeviceStatusTable = ({ rows }) => {
    const [filterText, setFilterText] = useState('');

    const filteredRows = useMemo(() => {
        const trimmed = filterText.trim().toLowerCase();
        if (!trimmed) return rows;
        // Treat user input strictly as data; substring match only.
        return rows.filter((r) =>
            [r.hostname, r.model, r.site].some((v) =>
                String(v == null ? '' : v).toLowerCase().includes(trimmed)
            )
        );
    }, [rows, filterText]);

    return (
        <div>
            <div style={{ marginBottom: 12, maxWidth: 320 }}>
                <Text
                    placeholder="Filter by hostname, model, or site"
                    value={filterText}
                    onChange={(_, payload) => setFilterText(payload.value)}
                />
            </div>
            <Table stripeRows>
                <Table.Head>
                    <Table.HeadCell>Hostname</Table.HeadCell>
                    <Table.HeadCell>Model</Table.HeadCell>
                    <Table.HeadCell>Site</Table.HeadCell>
                    <Table.HeadCell>Status</Table.HeadCell>
                    <Table.HeadCell align="right">Uptime (days)</Table.HeadCell>
                </Table.Head>
                <Table.Body>
                    {filteredRows.map((row) => (
                        <Table.Row key={row.hostname}>
                            <Table.Cell>{row.hostname}</Table.Cell>
                            <Table.Cell>{row.model}</Table.Cell>
                            <Table.Cell>{row.site}</Table.Cell>
                            <Table.Cell>
                                <StatusBadge value={row.status} />
                            </Table.Cell>
                            <Table.Cell align="right">{row.uptime_days}</Table.Cell>
                        </Table.Row>
                    ))}
                    {filteredRows.length === 0 ? (
                        <Table.Row>
                            <Table.Cell colSpan={5}>No devices match the current filter.</Table.Cell>
                        </Table.Row>
                    ) : null}
                </Table.Body>
            </Table>
        </div>
    );
};

DeviceStatusTable.propTypes = {
    rows: PropTypes.arrayOf(
        PropTypes.shape({
            hostname: PropTypes.string.isRequired,
            model: PropTypes.string.isRequired,
            site: PropTypes.string.isRequired,
            status: PropTypes.oneOf(['up', 'degraded', 'down']).isRequired,
            uptime_days: PropTypes.number.isRequired,
        })
    ).isRequired,
};

export default DeviceStatusTable;
