import React from 'react';
import PropTypes from 'prop-types';
import Card from '@splunk/react-ui/Card';
import Heading from '@splunk/react-ui/Heading';
import WaitSpinner from '@splunk/react-ui/WaitSpinner';
import Message from '@splunk/react-ui/Message';

const styles = {
    card: { background: '#fff', border: '1px solid #e1e6eb', borderRadius: 6 },
    header: {
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
    },
    title: { margin: 0, fontSize: 16, color: '#1c2b3a' },
    subtitle: { fontSize: 12, color: '#6c7a89', marginTop: 4 },
    actions: { display: 'flex', gap: 8 },
    body: { minHeight: 120 },
    state: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', color: '#6c7a89' },
};

const PanelCard = ({ title, subtitle, loading, error, children, actions }) => (
    <Card style={styles.card}>
        <Card.Header style={styles.header}>
            <div>
                <Heading level={3} style={styles.title}>
                    {title}
                </Heading>
                {subtitle ? <div style={styles.subtitle}>{subtitle}</div> : null}
            </div>
            {actions ? <div style={styles.actions}>{actions}</div> : null}
        </Card.Header>
        <Card.Body style={styles.body}>
            {loading ? (
                <div style={styles.state}>
                    <WaitSpinner size="medium" />
                    <span>Loading…</span>
                </div>
            ) : error ? (
                <Message appearance="fill" type="error">
                    {error.message}
                </Message>
            ) : (
                children
            )}
        </Card.Body>
    </Card>
);

PanelCard.propTypes = {
    title: PropTypes.string.isRequired,
    subtitle: PropTypes.string,
    loading: PropTypes.bool,
    error: PropTypes.instanceOf(Error),
    children: PropTypes.node,
    actions: PropTypes.node,
};

PanelCard.defaultProps = {
    subtitle: undefined,
    loading: false,
    error: null,
    children: null,
    actions: null,
};

export default PanelCard;
