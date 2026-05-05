/**
 * savedSearchCatalog — fetches the list of saved searches in this app
 * (`splunk-cisco-dashboards`) for the KPI picker.
 *
 * We hit the `/servicesNS/-/<app>/saved/searches` REST endpoint with
 * `output_mode=json`, scoped to the app namespace so each user sees the
 * same catalogue our metric tiles can actually dispatch. The endpoint
 * is paginated, but for a single app the count is small (under a few
 * hundred), so we ask for `count=0` (all) in one shot.
 *
 * The result is cached for the lifetime of the page — saved-search
 * lists don't change while the user is on the dashboard, and refetching
 * on every picker open would be wasteful. Use `clearSavedSearchCache()`
 * to force a refresh (e.g. after a user adds a stanza in Splunk Web).
 */

import { getSearchAppContext } from './splunkSearchService';

export interface SavedSearchRecord {
    /** Stanza name — what `| savedsearch "..."` references. */
    name: string;
    /** Owner (often `nobody` for app-default stanzas). */
    owner: string;
    /** App namespace, defensive — should always equal the current app. */
    app: string;
    /** Long description if set on the stanza, used for the info tooltip. */
    description: string;
    /** SPL of the search (`search` field of the stanza). */
    search: string;
    /** Whether the stanza is disabled. We hide disabled rows by default. */
    disabled: boolean;
    /** Whether the search is scheduled (informational only). */
    scheduled: boolean;
}

interface SavedSearchEntry {
    name: string;
    acl?: { app?: string; owner?: string };
    content?: {
        description?: string;
        search?: string;
        disabled?: boolean | string | number;
        is_scheduled?: boolean | string | number;
    };
}

interface SavedSearchResponse {
    entry?: SavedSearchEntry[];
}

const truthy = (value: unknown): boolean => {
    if (value === true) return true;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
        return value === '1' || value.toLowerCase() === 'true';
    }
    return false;
};

const APP_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_\-.]{0,127}$/;

const buildCatalogueUrl = (appName: string): string => {
    if (!APP_NAME_PATTERN.test(appName)) {
        throw new Error('Invalid Splunk app name.');
    }
    // `count=0` means "no per-page limit" → return all stanzas.
    // `search=...` filters server-side; we leave it open and filter
    // client-side for snappier interactivity in the picker.
    const params = new URLSearchParams({
        output_mode: 'json',
        count: '0',
    });
    return `/en-US/splunkd/__raw/servicesNS/-/${encodeURIComponent(appName)}/saved/searches?${params.toString()}`;
};

let CACHED_PROMISE: Promise<SavedSearchRecord[]> | null = null;

const isInSplunkRuntime = (): boolean => {
    if (typeof window === 'undefined') return false;
    if ((window as unknown as { __SPLUNK_RUNTIME__?: boolean }).__SPLUNK_RUNTIME__ === false) return false;
    if ((window as unknown as { __SPLUNK_RUNTIME__?: boolean }).__SPLUNK_RUNTIME__ === true) return true;
    return Boolean((window as unknown as { $C?: unknown }).$C);
};

const getCsrfToken = (): string | null => {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(/(?:^|;\s*)splunkweb_csrf_token_\w+=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
};

const fetchCatalogue = async (): Promise<SavedSearchRecord[]> => {
    if (!isInSplunkRuntime()) return [];
    const appName = getSearchAppContext();
    const url = buildCatalogueUrl(appName);
    const headers: Record<string, string> = {
        Accept: 'application/json',
    };
    const csrf = getCsrfToken();
    if (csrf) headers['X-Splunk-Form-Key'] = csrf;
    const res = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers,
    });
    if (!res.ok) {
        throw new Error(`saved/searches REST call failed: HTTP ${res.status}`);
    }
    const json = (await res.json()) as SavedSearchResponse;
    const entries = Array.isArray(json.entry) ? json.entry : [];
    return entries.map((e): SavedSearchRecord => {
        const content = e.content ?? {};
        return {
            name: typeof e.name === 'string' ? e.name : '',
            owner: e.acl?.owner ?? 'nobody',
            app: e.acl?.app ?? appName,
            description: typeof content.description === 'string' ? content.description : '',
            search: typeof content.search === 'string' ? content.search : '',
            disabled: truthy(content.disabled),
            scheduled: truthy(content.is_scheduled),
        };
    });
};

/**
 * Returns the saved-search catalogue scoped to the current app, with
 * an in-memory cache. The first call kicks off the network request;
 * subsequent calls share the same promise.
 *
 * Disabled stanzas are filtered out by default — they 400 on dispatch,
 * which is exactly what the picker is designed to avoid.
 */
export const getSavedSearchCatalogue = async (): Promise<SavedSearchRecord[]> => {
    if (!CACHED_PROMISE) {
        CACHED_PROMISE = fetchCatalogue().catch((err) => {
            // Reset the cache on failure so the next call retries.
            CACHED_PROMISE = null;
            throw err;
        });
    }
    const list = await CACHED_PROMISE;
    return list.filter((s) => !s.disabled && s.name.length > 0);
};

/** Force the next call to re-fetch from Splunk. */
export const clearSavedSearchCache = (): void => {
    CACHED_PROMISE = null;
};
