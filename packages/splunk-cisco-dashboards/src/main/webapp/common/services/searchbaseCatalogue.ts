/**
 * searchbaseCatalogue — fetches the rich KPI metadata catalogue out of
 * the app's `searchbase.conf` file.
 *
 * Why this exists: `searchbase.conf` is the single catalogue for
 * dashboard-adjacent SPL and rich picker metadata — `category`,
 * `sub_category`, `tags`, friendly `search_name`, descriptions, and
 * the literal `search` body. By using this file as the dispatch
 * catalogue, the picker gets:
 *
 *   • Category / sub-category facet chips out of the box
 *   • Tag chip filters
 *   • Richer per-row descriptions
 *
 * …without requiring every ad-hoc dashboard query to also exist as a
 * saved search.
 *
 * REST endpoint: Splunk serves any custom conf file at
 *   /servicesNS/<owner>/<app>/configs/conf-<name>
 * — same auth model as `saved/searches`. Records are paginated; we ask
 * for `count=0` to get the whole catalogue in one call (currently several
 * hundred stanzas, so still within reason).
 *
 * The stable external key is `search_name`.
 */

import { getSearchAppContext } from './splunkSearchService';

export interface SearchbaseRecord {
    /** Stanza id in searchbase.conf (lowercase, snake_case). */
    id: string;
    /** Friendly label and stable runtime key. */
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
    /**
     * Optional Splunk visualization id (e.g. `splunk.column`,
     * `splunk.line`, `splunk.area`, `splunk.singlevalue`). Mirrors the
     * `default_viz` field in the conf. Tiles use this to override the
     * default sparkline renderer.
     */
    defaultViz?: string;
    /**
     * Parsed `viz_options` JSON from the conf. Common keys:
     *   - `seriesColors`: string[] (hex colours; first entry wins for sparkline tint)
     *   - `stackMode`: "default" | "stacked" (multi-series only)
     *   - `legendDisplay`: "top" | "bottom" | "left" | "right" | "off"
     * Empty / malformed JSON yields `undefined` so a single bad
     * stanza never crashes the picker.
     */
    vizOptions?: Record<string, unknown>;
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
        disabled?: string;
        search_hidden?: string;
        default_viz?: string;
        viz_options?: string;
    };
}

/**
 * Defensive JSON parse for `viz_options`. Splunk conf values are
 * authored as inline JSON; a single malformed quote in one stanza
 * must not propagate up and break the entire catalogue load.
 * Returns undefined on non-string / parse failure / non-object result.
 */
const parseVizOptions = (raw: string | undefined): Record<string, unknown> | undefined => {
    if (typeof raw !== 'string') return undefined;
    const trimmed = raw.trim();
    if (trimmed.length === 0) return undefined;
    try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return parsed as Record<string, unknown>;
        }
    } catch {
        // Swallow: bad JSON → just no viz_options for this stanza.
    }
    return undefined;
};

const SPLUNK_VIZ_PATTERN = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/i;

const sanitizeDefaultViz = (raw: string | undefined): string | undefined => {
    if (typeof raw !== 'string') return undefined;
    const trimmed = raw.trim();
    if (trimmed.length === 0 || trimmed.length > 64) return undefined;
    return SPLUNK_VIZ_PATTERN.test(trimmed) ? trimmed : undefined;
};

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

const isTruthyConfValue = (raw: string | undefined): boolean =>
    typeof raw === 'string' && /^(1|true|yes)$/i.test(raw.trim());

/**
 * Splunk can hand back conf-searchbase `search` values with app macro
 * expansions inlined as a macro plus explicit index disjunction.
 * That makes the preview noisy and reintroduces hardcoded fallback
 * indexes into "Open in Search". Collapse only the narrow macro+index
 * expansion form back to the authored macro, leaving real boolean SPL
 * untouched.
 */
const collapseExpandedIndexMacro = (spl: string): string =>
    spl.replace(
        /\(\s*(`index_[^`]+`)\s*(?:OR\s+index=[A-Za-z0-9_*:-]+(?:\s+OR\s+index=[A-Za-z0-9_*:-]+)*)\s*\)/g,
        '$1'
    );

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
        if (isTruthyConfValue(content.disabled) || isTruthyConfValue(content.search_hidden)) {
            continue;
        }
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
            search:
                typeof content.search === 'string'
                    ? collapseExpandedIndexMacro(content.search)
                    : '',
            defaultViz: sanitizeDefaultViz(content.default_viz),
            vizOptions: parseVizOptions(content.viz_options),
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
