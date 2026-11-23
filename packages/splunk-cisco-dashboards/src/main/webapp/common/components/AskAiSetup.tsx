import React, { useEffect, useRef, useState } from 'react';
import Button from '@splunk/react-ui/Button';
import ControlGroup from '@splunk/react-ui/ControlGroup';
import Heading from '@splunk/react-ui/Heading';
import Link from '@splunk/react-ui/Link';
import Message from '@splunk/react-ui/Message';
import Text from '@splunk/react-ui/Text';
import {
    aiToolkitUrl, getAskAiSettings, isValidAiConnection, saveAskAiSettings, testAskAiConnection,
    type AskAiSettings,
} from '../services/askAiToolkit';

export default function AskAiSetup() {
    const [settings, setSettings] = useState<AskAiSettings>();
    const [connection, setConnection] = useState('');
    const [busy, setBusy] = useState(false);
    const updating = useRef(false);
    const connectionInput = useRef<HTMLInputElement>(null);
    const disableButton = useRef<HTMLButtonElement | HTMLAnchorElement>(null);
    const [notice, setNotice] = useState('');
    const [error, setError] = useState('');
    const backUrl = `${window.location.pathname}?setup=1&step=3`;
    useEffect(() => {
        let mounted = true;
        getAskAiSettings().then((current) => {
            if (!mounted) return;
            setSettings(current);
            setConnection(current.connection);
        }).catch(() => {
            if (mounted) setError('Ask AI settings could not be loaded. Refresh this page to retry.');
        });
        return () => { mounted = false; };
    }, []);

    async function update(enable: boolean) {
        const name = connection.trim();
        if (updating.current || !settings?.writable ||
            (enable && (!settings.canUseModel || !isValidAiConnection(name)))) return;
        const disablingFromButton = !enable && document.activeElement === disableButton.current;
        updating.current = true;
        setBusy(true);
        setError('');
        setNotice('');
        try {
            if (enable) await testAskAiConnection(name);
            await saveAskAiSettings(enable ? name : settings?.connection || '', enable);
            setSettings((current) => current && ({ ...current, enabled: enable, connection: enable ? name : current.connection }));
            setNotice(enable ? 'Connection verified. Ask AI is enabled.' : 'Ask AI is disabled. Find searches remains available.');
            if (disablingFromButton) {
                requestAnimationFrame(() => {
                    if (document.activeElement === document.body) connectionInput.current?.focus();
                });
            }
        } catch {
            setError(enable
                ? 'Ask AI could not be enabled. Check the AI Toolkit connection name, model availability, and your permissions.'
                : 'Ask AI could not be disabled. Check your Splunk permissions.');
        } finally {
            updating.current = false;
            setBusy(false);
        }
    }

    return <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-6">
        <Heading level={1}>Set up Ask AI</Heading>
        <p>Ask AI is optional. The workspace uses Find searches until a model is enabled for the signed-in user.</p>
        <ol className="list-decimal space-y-2 pl-6">
            <li>Install Splunk AI Toolkit if needed, then create or choose an approved LLM connection in AI Toolkit.</li>
            <li>Grant users who should use Ask AI the <code>apply_ai_commander_command</code> capability and any access required by that connection.</li>
            <li>Enter the connection name and select Test and enable. The test sends a sample prompt without catalog or customer data.</li>
        </ol>
        <div className="flex flex-wrap items-center gap-3">
            <Link appearance="standalone" to={aiToolkitUrl()} openInNewContext>Open AI Toolkit</Link>
            <Link to="https://splunkbase.splunk.com/app/2890" openInNewContext>Get AI Toolkit on Splunkbase</Link>
        </div>
        <p>Ask AI sends the user’s question and selected search definitions to the approved model. Indexed events stay in Splunk.</p>
        {error && <Message type="error" role="alert">{error}</Message>}
        {notice && <Message type="success" role="status">{notice}</Message>}
        {!settings && !error && <p role="status">Loading Ask AI settings…</p>}
        {settings && <form onSubmit={(event) => { event.preventDefault(); void update(true); }} className="flex flex-col gap-3">
            <p role="status">{settings.enabled ? `Enabled with ${settings.connection}` : 'Ask AI is off.'}</p>
            {!settings.writable && <p>Only an app administrator can change these settings.</p>}
            {settings.writable && !settings.canUseModel && <p>Your account needs permission to run the AI Toolkit command before you can test the connection.</p>}
            <ControlGroup label="AI Toolkit connection name" help="Enter the name as it appears in AI Toolkit Connections.">
                <Text inputRef={connectionInput} value={connection} onChange={(_, { value }) => setConnection(value)} disabled={busy || !settings.writable} />
            </ControlGroup>
            <div className="flex flex-wrap gap-2">
                <Button appearance="primary" label={busy ? 'Working…' : 'Test and enable'} type="submit"
                    disabled={busy || !settings.writable || !settings.canUseModel || !isValidAiConnection(connection.trim())} />
                {settings.enabled && <Button appearance="secondary" label="Disable Ask AI" elementRef={disableButton} disabled={busy || !settings.writable}
                    onClick={() => { void update(false); }} />}
            </div>
        </form>}
        <div><Link appearance="standalone" to={backUrl}>Back to Review packages</Link></div>
    </main>;
}
