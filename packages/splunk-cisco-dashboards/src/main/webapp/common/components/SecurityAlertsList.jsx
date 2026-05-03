import React from 'react';
import PropTypes from 'prop-types';
import List from '@splunk/react-ui/List';

const SEVERITY_STYLES = {
    critical: { color: '#a52a2a', label: 'Critical' },
    high: { color: '#c0392b', label: 'High' },
    medium: { color: '#b06000', label: 'Medium' },
    low: { color: '#2c7a2c', label: 'Low' },
};

const styles = {
    empty: { padding: 16, color: '#6c7a89' },
    item: { padding: '8px 0', borderBottom: '1px solid #f0f2f5' },
    row: { display: 'flex', alignItems: 'flex-start', gap: 12 },
    severity: (color) => ({
        border: `1px solid ${color}`,
        color,
        borderRadius: 4,
        padding: '2px 8px',
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        flexShrink: 0,
        minWidth: 72,
        textAlign: 'center',
    }),
    body: { display: 'flex', flexDirection: 'column', gap: 4 },
    signature: { fontWeight: 500, color: '#1c2b3a' },
    meta: { display: 'flex', flexWrap: 'wrap', gap: 12, color: '#6c7a89', fontSize: 12 },
};

const formatTimestamp = (iso) => {
    try {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return iso;
        return d.toLocaleString();
    } catch (err) {
        return iso;
    }
};

const SecurityAlertsList = ({ alerts }) => {
    if (!alerts || alerts.length === 0) {
        return <div style={styles.empty}>No alerts in the selected window.</div>;
    }

    return (
        <List>
            {alerts.map((alert) => {
                const style = SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.low;
                return (
                    <List.Item key={`${alert._time}-${alert.signature}`} style={styles.item}>
                        <div style={styles.row}>
                            <div style={styles.severity(style.color)}>{style.label}</div>
                            <div style={styles.body}>
                                <div style={styles.signature}>{alert.signature}</div>
                                <div style={styles.meta}>
                                    <span>Device: {alert.device}</span>
                                    <span>Source: {alert.src_ip}</span>
                                    <span>{formatTimestamp(alert._time)}</span>
                                </div>
                            </div>
                        </div>
                    </List.Item>
                );
            })}
        </List>
    );
};

SecurityAlertsList.propTypes = {
    alerts: PropTypes.arrayOf(
        PropTypes.shape({
            _time: PropTypes.string.isRequired,
            severity: PropTypes.oneOf(['critical', 'high', 'medium', 'low']).isRequired,
            signature: PropTypes.string.isRequired,
            src_ip: PropTypes.string.isRequired,
            device: PropTypes.string.isRequired,
        })
    ).isRequired,
};

export default SecurityAlertsList;
