import { useInsightsWorkspacePermissions } from '@/common/hooks/useInsightsWorkspacePermissions';

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
        const { canManageWorkspaces, isLoading } =
            useInsightsWorkspacePermissions();
        return { canManage: canManageWorkspaces, isLoading };
    };
