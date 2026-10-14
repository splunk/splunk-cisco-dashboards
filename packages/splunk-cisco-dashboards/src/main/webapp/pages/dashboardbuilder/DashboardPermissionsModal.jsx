import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import Button from '@splunk/react-ui/Button';
import ControlGroup from '@splunk/react-ui/ControlGroup';
import Message from '@splunk/react-ui/Message';
import Modal from '@splunk/react-ui/Modal';
import RadioList from '@splunk/react-ui/RadioList';
import {
    canSetDashboardSharing,
    getDashboardPermissions,
    updateDashboardPermissions,
} from '../../common/lib/splunk';
import { dashboardResponseMessage } from './dashboardNotifications';

export default function DashboardPermissionsModal({
    dashboard, colorScheme, themeStyle, returnFocus, onClose, onSaved,
}) {
    const [acl, setAcl] = useState(null);
    const [sharing, setSharing] = useState('user');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [needsReload, setNeedsReload] = useState(false);
    const saveInFlight = useRef(false);

    useEffect(() => {
        let cancelled = false;
        setAcl(null);
        setError('');
        setNeedsReload(false);
        if (!dashboard) {
            return undefined;
        }
        setLoading(true);
        getDashboardPermissions(dashboard.title, dashboard.owner, dashboard.app)
            .then((response) => {
                if (cancelled) {
                    return;
                }
                const current = response.entry?.[0]?.acl;
                if (response.status < 200 || response.status > 299 || !['user', 'app', 'global'].includes(current?.sharing)) {
                    setError(`Unable to load permissions. ${dashboardResponseMessage(response)}`);
                    return;
                }
                setAcl(current);
                setSharing(current.sharing);
            })
            .catch(() => {
                if (!cancelled) {
                    setError('Unable to load permissions. Check your connection and reopen this dialog.');
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setLoading(false);
                }
            });
        return () => { cancelled = true; };
    }, [dashboard]);

    const close = () => {
        if (!saveInFlight.current) {
            onClose();
        }
    };
    const save = async () => {
        if (!acl || !dashboard || saveInFlight.current || needsReload || sharing === acl.sharing) {
            return;
        }
        saveInFlight.current = true;
        setSaving(true);
        setError('');
        try {
            const response = await updateDashboardPermissions(
                dashboard.title, dashboard.owner, dashboard.app, sharing, acl,
            );
            if (response.status >= 200 && response.status <= 299) {
                await onSaved(sharing);
            } else {
                setError(`Unable to update permissions. ${dashboardResponseMessage(response)}`);
                setNeedsReload(response.status === 409);
            }
        } catch {
            setError('The permission change could not be confirmed. Close and reopen Permissions to check the saved visibility before retrying.');
            setNeedsReload(true);
        } finally {
            saveInFlight.current = false;
            setSaving(false);
        }
    };
    const canShareApp = canSetDashboardSharing(acl, 'app');
    const canShareUser = canSetDashboardSharing(acl, 'user');
    const supported = acl && ['user', 'app'].includes(acl.sharing);
    const textStyle = { color: 'var(--dashboard-builder-modal-content-default)' };

    return (
        <Modal
            open={Boolean(dashboard)}
            className={`dashboard-builder-metadata-modal dashboard-builder-themed-modal dashboard-builder-themed-modal-${colorScheme}`}
            style={themeStyle}
            returnFocus={returnFocus}
            onRequestClose={close}
        >
            <Modal.Header title="Edit permissions" subtitle={<span style={textStyle}>{dashboard?.label || dashboard?.title}</span>} hideCloseButton={saving} />
            <Modal.Body className="dashboard-builder-modal-body">
                <div role="status">{loading && 'Loading permissions…'}{saving && 'Saving permissions…'}</div>
                <div role="alert">{error && <Message type="error">{error}</Message>}</div>
                {acl && (
                    <>
                        <p><span style={textStyle}>Owner: {acl.owner}</span></p>
                        {supported ? (
                            <ControlGroup
                                label="Who can see this dashboard?"
                                labelPosition="top"
                                help="Share when your dashboard is ready so colleagues can benefit. Existing edit access stays the same."
                            >
                                <RadioList value={sharing} disabled={saving || needsReload} onChange={(event, { value }) => setSharing(value)}>
                                    <RadioList.Option value="user" disabled={!canShareUser}>
                                        Private — Only the owner can see it
                                    </RadioList.Option>
                                    <RadioList.Option value="app" disabled={!canShareApp}>
                                        Shared in App — Let app users view and benefit from it
                                    </RadioList.Option>
                                </RadioList>
                            </ControlGroup>
                        ) : <Message type="info">This dashboard is shared across all apps. Use Splunk Dashboards to manage its permissions.</Message>}
                        {supported && !canShareApp && <Message type="info">Your Splunk permissions do not allow app sharing for this dashboard. Ask the owner or a Splunk administrator to share it.</Message>}
                        {supported && !canShareUser && <Message type="info">Your Splunk permissions do not allow making this dashboard private.</Message>}
                        {sharing === 'app' && acl.sharing === 'user' && <Message type="info">Saving will give all app users read access. It will not grant additional edit access.</Message>}
                        {acl.sharing === 'app' && <p><span style={textStyle}>Current read access: {(acl.perms?.read || []).map((role) => (role === '*' ? 'All app users' : role)).filter(Boolean).join(', ') || 'Owner only'}</span></p>}
                        {sharing === 'user' && acl.sharing === 'app' && <Message type="warning">Other app users will lose access to this dashboard. Existing links may stop working for them.</Message>}
                    </>
                )}
            </Modal.Body>
            <Modal.Footer>
                <Button label="Cancel" disabled={saving} onClick={close} />
                <Button
                    appearance="primary"
                    label={saving ? 'Saving…' : 'Save permissions'}
                    disabled={loading || saving || needsReload || !supported || sharing === acl?.sharing || !canSetDashboardSharing(acl, sharing)}
                    onClick={save}
                />
            </Modal.Footer>
        </Modal>
    );
}

DashboardPermissionsModal.propTypes = {
    dashboard: PropTypes.shape({ title: PropTypes.string, label: PropTypes.string, owner: PropTypes.string, app: PropTypes.string }),
    colorScheme: PropTypes.string.isRequired,
    themeStyle: PropTypes.object.isRequired,
    returnFocus: PropTypes.func.isRequired,
    onClose: PropTypes.func.isRequired,
    onSaved: PropTypes.func.isRequired,
};
DashboardPermissionsModal.defaultProps = { dashboard: undefined };
