import React from 'react';
import PropTypes from 'prop-types';

const colorForCpu = (pct) => {
    if (pct >= 80) return '#c0392b';
    if (pct >= 60) return '#d97706';
    return '#2ea44f';
};

const styles = {
    list: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 },
    row: {
        display: 'grid',
        gridTemplateColumns: '160px 1fr 56px',
        gap: 12,
        alignItems: 'center',
        fontSize: 13,
    },
    label: { color: '#1c2b3a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    track: {
        backgroundColor: '#eef1f5',
        height: 12,
        borderRadius: 6,
        overflow: 'hidden',
        position: 'relative',
    },
    fill: (pct) => ({
        display: 'block',
        height: '100%',
        borderRadius: 6,
        width: `${Math.min(Math.max(pct, 0), 100)}%`,
        backgroundColor: colorForCpu(pct),
        transition: 'width 200ms ease',
    }),
    value: { textAlign: 'right', color: '#6c7a89', fontVariantNumeric: 'tabular-nums' },
    empty: { padding: 12, color: '#6c7a89' },
};

const CpuBarChart = ({ rows }) => {
    if (!rows || rows.length === 0) {
        return <div style={styles.empty}>No CPU samples available.</div>;
    }

    return (
        <ul style={styles.list}>
            {rows.map((r) => (
                <li key={r.hostname} style={styles.row}>
                    <span style={styles.label}>{r.hostname}</span>
                    <span style={styles.track} aria-hidden="true">
                        <span style={styles.fill(r.cpu_pct)} />
                    </span>
                    <span style={styles.value}>{r.cpu_pct}%</span>
                </li>
            ))}
        </ul>
    );
};

CpuBarChart.propTypes = {
    rows: PropTypes.arrayOf(
        PropTypes.shape({
            hostname: PropTypes.string.isRequired,
            cpu_pct: PropTypes.number.isRequired,
        })
    ).isRequired,
};

export default CpuBarChart;
