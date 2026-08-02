export interface SearchbaseAppContexts {
    ownerApp: string;
    catalogueApp: string;
    dispatchContextForce: boolean;
    dispatchContext: string;
}

/**
 * Keep source-app classification separate from the namespace used to execute
 * a Searchbase stanza. Splunk's force=0 contract means the owning app runs the
 * search even when `dispatch_context` names a different source app.
 */
export const resolveSearchbaseAppContexts = (
    ownerApp: string,
    configuredContext: string | undefined,
    dispatchContextForce: boolean
): SearchbaseAppContexts => {
    const catalogueApp = configuredContext || ownerApp;
    return {
        ownerApp,
        catalogueApp,
        dispatchContextForce,
        dispatchContext: dispatchContextForce ? catalogueApp : ownerApp,
    };
};
