import { useEffect, useState } from 'react';

const splunkLocalePrefix = (): string => {
    if (typeof window === 'undefined') return '/en-US';
    const match = window.location.pathname.match(/^\/([a-z]{2}-[A-Z]{2})\//);
    return match ? `/${match[1]}` : '/en-US';
};

export interface UseCanManageInsightsWorkspacesResult {
    canManage: boolean;
    isLoading: boolean;
}

/**
 * UI-side mirror of the insights_workspaces.conf ACL. Splunk remains the
 * security boundary; this check only hides authoring controls from users who
 * would receive a 403 from the config REST endpoint.
 */
export const useCanManageInsightsWorkspaces =
    (): UseCanManageInsightsWorkspacesResult => {
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
                { credentials: 'include', headers: { Accept: 'application/json' } },
            )
                .then((response) => {
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    return response.json() as Promise<{
                        entry?: Array<{ content?: Record<string, unknown> }>;
                    }>;
                })
                .then((json) => {
                    if (cancelled) return;
                    const content = json.entry?.[0]?.content ?? {};
                    const capabilities = Array.isArray(content.capabilities)
                        ? content.capabilities
                        : [];
                    const roles = Array.isArray(content.roles) ? content.roles : [];
                    setCanManage(
                        capabilities.includes('admin_all_objects') ||
                            roles.some((role) =>
                                ['admin', 'power', 'sc_admin'].includes(String(role)),
                            ),
                    );
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
