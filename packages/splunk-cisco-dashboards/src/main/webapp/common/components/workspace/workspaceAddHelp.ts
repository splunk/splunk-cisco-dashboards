export const WORKSPACE_ADD_HELP = {
    personal: 'Adds the tile to your personal view of this workspace in this browser.',
    workspace: 'Adds the tile to the shared workspace layout for everyone who can view it. Requires workspace-management permission.',
} as const;

export type WorkspaceAddScope = keyof typeof WORKSPACE_ADD_HELP;
