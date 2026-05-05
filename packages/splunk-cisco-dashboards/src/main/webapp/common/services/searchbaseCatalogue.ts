/**
 * searchbaseCatalogue — fetches the rich KPI metadata catalogue out of
 * the app's `searchbase.conf` file.
 *
 * Why this exists: `savedsearches.conf` only carries `description` and
 * the SPL itself. `searchbase.conf` carries the things executives want
 * to filter on — `category`, `sub_category`, `tags`, friendly
 * `search_name`, and a curated long-form `description`. By keeping
 * the dispatch path on saved-searches and using `searchbase.conf` as
 * a *metadata layer*, the picker gets:
 *
 *   • Category / sub-category facet chips out of the box
 *   • Tag chip filters
 *   • Richer per-row descriptions
 *
 * …without touching saved-search names (which would break dashboards
 * and scheduled-search references).
 *
 * REST endpoint: Splunk serves any custom conf file at
 *   /servicesNS/<owner>/<app>/configs/conf-<name>
 * — same auth model as `saved/searches`. Records are paginated; we ask
 * for `count=0` to get the whole catalogue in one call (currently ~100
 * stanzas, so well within reason).
 *
 * The bridge field is `search_name`. searchbase entries declare it
 * explicitly, and 100% of overlapping entries match a stanza in
 * `savedsearches.conf` (verified at build-time via grep diff). When
 * the picker enriches a saved-search row, the join key is
 * `savedsearches[].name === searchbase[].search_name`.
 */

import { getSearchAppContext } from './splunkSearchService';

export interface SearchbaseRecord {
    /** Stanza id in searchbase.conf (lowercase, snake_case). */
    id: string;
    /** Friendly label and join key against savedsearches.conf. */
    searchName: string;
    /** Top-level grouping (e.g. "Building", "Network", "Security"). */
    category: string;
    /** Free-form sub-grouping (e.g. "Environmental Sensors"). */
    subCategory: string;
    /** Comma-separated `tags` field, normalised into an array. */
    tags: string[];
    /** Full app namespace expected (`splunk-cisco-dashboards`). */
    dispatchContext: string;
    /** HTML description (carries inline tags from the conf). */
    description: string;
    /** SPL body — useful for the picker's preview pane. */
    search: string;
}

interface SearchbaseEntry {
    name: string;
    acl?: { app?: string };
    content?: {
        search_name?: string;
        category?: string;
        sub_category?: string;
        tags?: string;
        dispatch_context?: string;
        description?: string;
        search?: string;
    };
}

interface SearchbaseResponse {
    entry?: SearchbaseEntry[];
}

const APP_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_\-.]{0,127}$/;

const buildUrl = (appName: string): string => {
    if (!APP_NAME_PATTERN.test(appName)) {
        throw new Error('Invalid Splunk app name.');
    }
    const params = new URLSearchParams({
        output_mode: 'json',
        count: '0',
    });
    return `/en-US/splunkd/__raw/servicesNS/-/${encodeURIComponent(appName)}/configs/conf-searchbase?${params.toString()}`;
};

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

const splitTags = (raw: string | undefined): string[] => {
    if (typeof raw !== 'string' || raw.length === 0) return [];
    return raw
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0 && t.length <= 64)
        .slice(0, 20);
};

let CACHED_PROMISE: Promise<SearchbaseRecord[]> | null = null;

const fetchSearchbase = async (): Promise<SearchbaseRecord[]> => {
    if (!isInSplunkRuntime()) return [];
    const appName = getSearchAppContext();
    const headers: Record<string, string> = { Accept: 'application/json' };
    const csrf = getCsrfToken();
    if (csrf) headers['X-Splunk-Form-Key'] = csrf;
    const res = await fetch(buildUrl(appName), {
        method: 'GET',
        credentials: 'include',
        headers,
    });
    if (!res.ok) {
        throw new Error(`configs/conf-searchbase REST call failed: HTTP ${res.status}`);
    }
    const json = (await res.json()) as SearchbaseResponse;
    const entries = Array.isArray(json.entry) ? json.entry : [];
    const out: SearchbaseRecord[] = [];
    for (const e of entries) {
        const content = e.content ?? {};
        const searchName = typeof content.search_name === 'string' ? content.search_name.trim() : '';
        if (searchName.length === 0) continue; // Without a join key we can't enrich anything.
        out.push({
            id: typeof e.name === 'string' ? e.name : '',
            searchName,
            category: typeof content.category === 'string' ? content.category : '',
            subCategory: typeof content.sub_category === 'string' ? content.sub_category : '',
            tags: splitTags(content.tags),
            dispatchContext:
                typeof content.dispatch_context === 'string' ? content.dispatch_context : appName,
            description: typeof content.description === 'string' ? content.description : '',
            search: typeof content.search === 'string' ? content.search : '',
        });
    }
    return out;
};

/**
 * Returns the searchbase catalogue with an in-memory cache. The first
 * call kicks off the REST request; subsequent calls reuse the same
 * promise. On error the cache resets so the next call retries.
 */
export const getSearchbaseCatalogue = async (): Promise<SearchbaseRecord[]> => {
    if (!CACHED_PROMISE) {
        CACHED_PROMISE = fetchSearchbase().catch((err) => {
            CACHED_PROMISE = null;
            throw err;
        });
    }
    return CACHED_PROMISE;
};

/**
 * Strips the inline HTML tags Splunk allows in conf descriptions so
 * the picker can show the text in a tooltip / pill without rendering
 * markup. Whitespace is collapsed for compact preview.
 */
export const plainTextFromHtml = (html: string): string => {
    if (typeof html !== 'string' || html.length === 0) return '';
    return html
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&mdash;/gi, '—')
        .replace(/&ndash;/gi, '–')
        .replace(/\s+/g, ' ')
        .trim();
};

/** Force the next call to re-fetch from Splunk. */
export const clearSearchbaseCache = (): void => {
    CACHED_PROMISE = null;
};
