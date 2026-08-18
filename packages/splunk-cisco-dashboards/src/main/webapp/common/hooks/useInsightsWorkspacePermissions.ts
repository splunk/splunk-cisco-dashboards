import { useEffect, useState } from 'react';

import {
    resolveInsightsWorkspacePermissions,
    type InsightsWorkspacePermissions,
    type SplunkCurrentContext,
} from '@/common/auth/insightsWorkspacePermissions';

export interface UseInsightsWorkspacePermissionsResult
    extends InsightsWorkspacePermissions {
    isLoading: boolean;
}

const DENIED_PERMISSIONS = resolveInsightsWorkspacePermissions({});

const splunkLocalePrefix = (): string => {
    if (typeof window === 'undefined') {return '/en-US';}
    const match = window.location.pathname.match(/^\/([a-z]{2}-[A-Z]{2})\//);
    return match ? `/${match[1]}` : '/en-US';
};

let currentContextRequest: Promise<SplunkCurrentContext> | null = null;

const loadCurrentContext = async (): Promise<SplunkCurrentContext> => {
    if (!currentContextRequest) {
        currentContextRequest = fetch(
            `${splunkLocalePrefix()}/splunkd/__raw/services/authentication/current-context?output_mode=json`,
            { credentials: 'include', headers: { Accept: 'application/json' } },
        )
            .then(async (response) => {
                if (!response.ok) {throw new Error(`HTTP ${response.status}`);}
                const json = (await response.json()) as {
                    entry?: Array<{ content?: SplunkCurrentContext }>;
                };
                return json.entry?.[0]?.content ?? {};
            })
            .catch((error) => {
                currentContextRequest = null;
                throw error;
            });
    }
    return currentContextRequest;
};

export const useInsightsWorkspacePermissions =
    (): UseInsightsWorkspacePermissionsResult => {
        const [permissions, setPermissions] =
            useState<InsightsWorkspacePermissions>(DENIED_PERMISSIONS);
        const [isLoading, setIsLoading] = useState(true);

        useEffect(() => {
            if (typeof window === 'undefined') {
                setIsLoading(false);
                return undefined;
            }
            let cancelled = false;
            loadCurrentContext()
                .then((context) => {
                    if (!cancelled) {
                        setPermissions(resolveInsightsWorkspacePermissions(context));
                    }
                })
                .catch(() => {
                    if (!cancelled) {setPermissions(DENIED_PERMISSIONS);}
                })
                .finally(() => {
                    if (!cancelled) {setIsLoading(false);}
                });

            return () => {
                cancelled = true;
            };
        }, []);

        return { ...permissions, isLoading };
    };
