import React, { useId, useState } from 'react';
import Button from '@splunk/react-ui/Button';
import { normalizeDcScopeValue, type DcNetworkingScope } from '@/common/lib/dcNetworkingScope';

export default function DcNetworkingScopeBar({ scope, onChange, dashboardUrl }: {
    scope: DcNetworkingScope;
    onChange: (scope: DcNetworkingScope) => void;
    dashboardUrl: string;
}) {
    const scopeId = useId();
    const labels = { account: 'Account / controller', fabric: 'Fabric / site', device: 'Device / address' };
    const [draft, setDraft] = useState(scope);
    const [error, setError] = useState('');
    return <section aria-label="DC Networking investigation scope" className="border-b sui-border-weak px-4 py-2 sui-bg-section">
        <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => {
            event.preventDefault();
            try {
                const next = Object.fromEntries(Object.entries(draft).map(([key, value]) => [key, normalizeDcScopeValue(value)]));
                onChange(next);
                setError('');
            } catch (cause) { setError(cause instanceof Error ? cause.message : 'Invalid scope'); }
        }}>
            {(['account', 'fabric', 'device'] as const).map((key) => <label key={key} htmlFor={`${scopeId}-${key}`} className="text-xs sui-color-muted">
                {labels[key]}
                <input id={`${scopeId}-${key}`} aria-label={`DC ${key}`} maxLength={128} placeholder="All" value={draft[key] || ''}
                    onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
                    className="block h-8 rounded border sui-border-weak sui-bg-default sui-color-default px-2" />
            </label>)}
            <Button type="submit" label="Apply scope" />
            <Button type="button" label="Clear" onClick={() => { setDraft({}); onChange({}); setError(''); }} />
            <a href={dashboardUrl} className="pb-2 text-sm underline sui-color-info">Open DC Networking dashboard →</a>
        </form>
        {error && <p role="alert" className="text-sm sui-color-negative">{error}</p>}
        <p className="mt-1 text-xs sui-color-muted">Lab observations · Exact names; blank means all. Time and scope apply to tiles, details and Search. Missing data is unknown. Inventory matches, reported links and measured traffic are different evidence.</p>
    </section>;
}
