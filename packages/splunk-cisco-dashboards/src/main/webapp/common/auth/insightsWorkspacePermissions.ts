export interface SplunkCurrentContext {
    capabilities?: unknown;
    roles?: unknown;
    username?: unknown;
}

export interface InsightsWorkspacePermissions {
    username: string | null;
    roles: readonly string[];
    capabilities: readonly string[];
    canManageWorkspaces: boolean;
    canManageSharedTopology: boolean;
    canManageFactoryTileConfig: boolean;
}

export const INSIGHTS_WORKSPACE_MANAGEMENT_CAPABILITY =
    'scd_manage_insights_workspaces';

const SHARED_WORKSPACE_MANAGER_ROLES = new Set([
    'admin',
    'power',
    'sc_admin',
]);
const FACTORY_TILE_MANAGER_ROLES = new Set(['admin', 'sc_admin']);

const stringList = (value: unknown): string[] =>
    Array.isArray(value)
        ? value
              .filter((item): item is string => typeof item === 'string')
              .map((item) => item.trim())
              .filter(Boolean)
        : [];

export const resolveInsightsWorkspacePermissions = (
    context: SplunkCurrentContext,
): InsightsWorkspacePermissions => {
    const roles = stringList(context.roles);
    const capabilities = stringList(context.capabilities);
    const canManageAllObjects = capabilities.includes('admin_all_objects');
    const hasDelegatedWorkspaceCapability = capabilities.includes(
        INSIGHTS_WORKSPACE_MANAGEMENT_CAPABILITY,
    );
    const hasSharedManagerRole = roles.some((role) =>
        SHARED_WORKSPACE_MANAGER_ROLES.has(role),
    );
    const hasFactoryTileManagerRole = roles.some((role) =>
        FACTORY_TILE_MANAGER_ROLES.has(role),
    );
    const canManageSharedConfiguration =
        canManageAllObjects ||
        hasDelegatedWorkspaceCapability ||
        hasSharedManagerRole;
    const username =
        typeof context.username === 'string' && context.username.trim()
            ? context.username.trim()
            : null;

    return {
        username,
        roles,
        capabilities,
        canManageWorkspaces: canManageSharedConfiguration,
        canManageSharedTopology: canManageSharedConfiguration,
        canManageFactoryTileConfig:
            canManageAllObjects || hasFactoryTileManagerRole,
    };
};
