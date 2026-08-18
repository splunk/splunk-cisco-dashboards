/**
 * useCanManageFactoryTileConfig — UI-side courtesy check for whether
 * the current Splunk user can edit the admin-controlled Overview tile
 * settings (Thresholds, Data Mapping, Drilldown).
 *
 * This is NOT the security boundary. The real enforcement is
 * server-side: `metadata/default.meta` restricts `searchbase.conf`
 * writes to the `admin` and `sc_admin` roles. A custom role explicitly
 * delegated `admin_all_objects` can also bypass the object ACL. This hook
 * exists purely so the UI can show read-only controls instead of letting
 * someone fill out a form and get a 403 on Save.
 *
 * Fails closed: any error, missing field, or ambiguous response is
 * treated as "cannot manage" rather than granting edit access.
 */

import { useInsightsWorkspacePermissions } from '@/common/hooks/useInsightsWorkspacePermissions';

export interface UseCanManageFactoryTileConfigResult {
    /** True once Splunk confirms the user matches the factory-config ACL. */
    canManage: boolean;
    /** True until the capability check resolves (success or failure). */
    isLoading: boolean;
}

export const useCanManageFactoryTileConfig = (): UseCanManageFactoryTileConfigResult => {
    const { canManageFactoryTileConfig, isLoading } =
        useInsightsWorkspacePermissions();
    return { canManage: canManageFactoryTileConfig, isLoading };
};
