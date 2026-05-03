import React from 'react';
import PropTypes from 'prop-types';
import Card from '@splunk/react-ui/Card';

const TONE_COLORS = {
    neutral: '#1c2b3a',
    positive: '#2ea44f',
    warning: '#d97706',
    critical: '#c0392b',
};

const styles = {
    card: { minHeight: 120, border: '1px solid #e1e6eb', borderRadius: 6, background: '#fff' },
    label: {
        fontSize: 12,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        color: '#6c7a89',
        marginBottom: 6,
    },
    value: { fontSize: 30, fontWeight: 600, lineHeight: 1.1 },
    sublabel: { marginTop: 8, fontSize: 12, color: '#6c7a89' },
};

const KpiCard = ({ label, value, sublabel, tone }) => (
    <Card style={styles.card}>
        <Card.Body>
            <div style={styles.label}>{label}</div>
            <div style={{ ...styles.value, color: TONE_COLORS[tone] }}>{value}</div>
            {sublabel ? <div style={styles.sublabel}>{sublabel}</div> : null}
        </Card.Body>
    </Card>
);

KpiCard.propTypes = {
    label: PropTypes.string.isRequired,
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    sublabel: PropTypes.string,
    tone: PropTypes.oneOf(['neutral', 'positive', 'warning', 'critical']),
};

KpiCard.defaultProps = {
    sublabel: undefined,
    tone: 'neutral',
};

export default KpiCard;
