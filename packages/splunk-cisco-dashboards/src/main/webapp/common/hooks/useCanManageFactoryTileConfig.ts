/**
 * useCanManageFactoryTileConfig — UI-side courtesy check for whether
 * the current Splunk user can edit the admin-controlled Overview tile
 * settings (Thresholds, Data Mapping, Drilldown).
 *
 * This is NOT the security boundary. The real enforcement is
 * server-side: `metadata/default.meta` restricts `searchbase.conf`
 * writes so that only the `admin_all_objects` capability (which
 * bypasses Splunk's object ACLs entirely) can persist a change. This
 * hook exists purely so the UI can show read-only controls instead of
 * letting someone fill out a form and get a 403 on Save.
 *
 * Fails closed: any error, missing field, or ambiguous response is
 * treated as "cannot manage" rather than granting edit access.
 */

import { useEffect, useState } from 'react';

const splunkLocalePrefix = (): string => {
    if (typeof window === 'undefined') return '/en-US';
    const match = window.location.pathname.match(/^\/([a-z]{2}-[A-Z]{2})\//);
    return match ? `/${match[1]}` : '/en-US';
};

export interface UseCanManageFactoryTileConfigResult {
    /** True once we've heard back from Splunk and the user holds admin_all_objects. */
    canManage: boolean;
    /** True until the capability check resolves (success or failure). */
    isLoading: boolean;
}

export const useCanManageFactoryTileConfig = (): UseCanManageFactoryTileConfigResult => {
    const [canManage, setCanManage] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (typeof window === 'undefined') {
            setIsLoading(false);
            return undefined;
        }
        let cancelled = false;

        fetch(
            `${splunkLocalePrefix()}/splunkd/__raw/services/authentication/current-context?output_mode=json`,
            { credentials: 'include', headers: { Accept: 'application/json' } }
        )
            .then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json() as Promise<{
                    entry?: Array<{ content?: Record<string, unknown> }>;
                }>;
            })
            .then((json) => {
                if (cancelled) return;
                const content = json.entry?.[0]?.content ?? {};
                const capabilities = content.capabilities;
                const hasCapability =
                    Array.isArray(capabilities) &&
                    capabilities.some((c) => c === 'admin_all_objects');
                setCanManage(hasCapability);
            })
            .catch(() => {
                if (!cancelled) setCanManage(false);
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    return { canManage, isLoading };
};
